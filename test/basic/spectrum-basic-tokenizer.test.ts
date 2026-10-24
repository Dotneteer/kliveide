import { describe, expect, it } from "vitest";

import { basicNumberBytes, tokenizeBasicProgram, BasicTokenizeError } from "@common/basic/spectrumBasicTokenizer";
import { ZxSpectrumChars } from "@common/machines/char-codes";
import { basicListingText, decodeBasicProgram } from "@renderer/appIde/DocumentPanels/basicListing";
import { PRINT_42 } from "../diskfs/fixtures";

/*
 * Spectrum BASIC text to tokens (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, B4), checked against
 * hand-encoded bytes and against the listing decoder it is the inverse of.
 */

const listing = (bytes: Uint8Array) =>
  basicListingText(decodeBasicProgram(bytes, 0, bytes.length, { charSet: ZxSpectrumChars }).lines);

describe("Spectrum BASIC tokenizer", () => {
  it("tokenises a line as the ROM stores it", () => {
    expect(tokenizeBasicProgram("10 PRINT 42")).toEqual(PRINT_42);
  });

  it("encodes numbers in the 5-byte forms", () => {
    expect(basicNumberBytes(0)).toEqual([0, 0, 0, 0, 0]);
    expect(basicNumberBytes(65535)).toEqual([0, 0, 0xff, 0xff, 0]);
    expect(basicNumberBytes(-1)).toEqual([0, 0xff, 0xff, 0xff, 0]);
    // --- 0.5 = 0.5 x 2^0: exponent 128, mantissa $80000000 with the sign bit cleared
    expect(basicNumberBytes(0.5)).toEqual([0x80, 0x00, 0x00, 0x00, 0x00]);
    expect(basicNumberBytes(-0.5)).toEqual([0x80, 0x80, 0x00, 0x00, 0x00]);
    // --- 100000 = 0.762939453125 x 2^17
    expect(basicNumberBytes(100000)).toEqual([0x91, 0x43, 0x50, 0x00, 0x00]);
  });

  it("round trips through the listing decoder", () => {
    const source = [
      '10 REM a "quoted" line: PRINT is not a token here',
      '20 LET total=10: FOR i=1 TO total STEP 2: PRINT AT 1,i;"x": NEXT i',
      "30 IF INKEY$<>\"\" THEN GO TO 20",
      "40 RANDOMIZE USR 32768: LOAD \"game\"CODE 24000",
      "50 DEF FN f(x)=x*2.5: PRINT FN f(3), BIN 1010",
      "60 OPEN #4,\"s\": CLOSE #4"
    ].join("\n");
    const bytes = tokenizeBasicProgram(source);
    const text = listing(bytes).replace(/ +/g, " ");
    // --- REM's text is stored as typed: no PRINT token in line 10
    const line10 = bytes.subarray(4, bytes[2] + 4);
    expect(line10[0]).toBe(0xea);
    expect(Array.from(line10).includes(0xf5)).toBe(false);
    expect(text).toContain('REM a "quoted" line: PRINT is not a token here');
    expect(text).toContain("LET total=10");
    expect(text).toContain("TO total STEP 2");
    expect(text).toContain("GO TO 20");
    expect(text).toContain("RANDOMIZE USR 32768");
    expect(text).toContain("DEF FN f");
    expect(text).toContain("BIN 1010");
    expect(text).toContain("OPEN # 4");
  });

  it("keeps names that start like keywords", () => {
    const bytes = tokenizeBasicProgram("10 LET total=1: LET attr1=2: LET tox=3");
    // --- One LET token per statement and no TO, ATTR or AT token
    expect(Array.from(bytes).filter((b) => b === 0xf1).length).toBe(3);
    expect(Array.from(bytes).some((b) => b === 0xcc || b === 0xab || b === 0xac)).toBe(false);
  });

  it("accepts GOTO, GOSUB, lower case, and the 128K keywords when asked", () => {
    const bytes = tokenizeBasicProgram("10 goto 20\n20 gosub 10\n30 PLAY \"a\"", { plus128: true });
    expect(bytes).toContain(0xec);
    expect(bytes).toContain(0xed);
    expect(bytes).toContain(0xa4);
    expect(tokenizeBasicProgram("10 PLAY \"a\"")).not.toContain(0xa4);
  });

  it("leaves out the hidden number forms when asked (text after a REM, as TR-DOS reads it)", async () => {
    const { tokenizeStatementText } = await import("@common/basic/spectrumBasicTokenizer");
    expect(tokenizeStatementText('LOAD "x"CODE 50000', { noHiddenNumbers: true })).toEqual([
      0xef, 0x22, 0x78, 0x22, 0xaf, 0x35, 0x30, 0x30, 0x30, 0x30
    ]);
    expect(tokenizeStatementText("LOAD 1")).toContain(0x0e);
  });

  it("refuses a line without a number or with an open string", () => {
    expect(() => tokenizeBasicProgram("PRINT 1")).toThrow(BasicTokenizeError);
    expect(() => tokenizeBasicProgram('10 PRINT "x')).toThrow(BasicTokenizeError);
    expect(() => tokenizeBasicProgram("10000 STOP")).toThrow(BasicTokenizeError);
  });
});
