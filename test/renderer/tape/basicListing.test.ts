import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { ZxSpectrumChars } from "@common/machines/char-codes";
import { basicListingText, decodeBasicProgram } from "@renderer/appIde/DocumentPanels/basicListing";
import { analyzeTape, blockPayload } from "@renderer/appIde/DocumentPanels/Tape/tapeView";

/*
 * The BASIC detokenizer shared by the live BASIC panel and the tape viewer
 * (`.plans/TAPE_VIEWER_PLAN.md` §4.3).
 */

const tape = analyzeTape(
  new Uint8Array(readFileSync(resolve(__dirname, "../../testfiles/floatspy.tap")))
).analysis!;
const program = blockPayload(tape.blocks[1])!;
const varsOffset = tape.blocks[0].header!.variablesOffset!;

const line = (no: number, ...body: number[]) => [
  no >> 8,
  no & 0xff,
  (body.length + 1) & 0xff,
  (body.length + 1) >> 8,
  ...body,
  0x0d
];
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

describe("decodeBasicProgram", () => {
  it("lists a program from a tape block", () => {
    const listing = decodeBasicProgram(program, 0, varsOffset, { charSet: ZxSpectrumChars });
    const text = basicListingText(listing.lines).split("\n");
    expect(listing.corrupted).toBe(false);
    expect(text[2].trim()).toBe("10 BORDER 1: PAPER 1: INK 9: CLEAR 49151");
    expect(text[4].trim()).toBe("30 LET ioport=255");
    expect(listing.lineCount).toBe(95);
  });

  it("skips the hidden binary form of a number", () => {
    const bytes = new Uint8Array(line(5, 0xf5, ...ascii("1"), 0x0e, 0, 0, 1, 0, 0));
    const text = basicListingText(
      decodeBasicProgram(bytes, 0, bytes.length, { charSet: ZxSpectrumChars }).lines
    );
    expect(text.trim()).toBe("5 PRINT 1");
  });

  it("consumes TAB's two argument bytes", () => {
    const bytes = new Uint8Array(line(1, 0xf5, 0x22, 0x17, 0x41, 0x42, ...ascii("x"), 0x22));
    const text = basicListingText(
      decodeBasicProgram(bytes, 0, bytes.length, { charSet: ZxSpectrumChars }).lines
    );
    expect(text.trim()).toBe('1 PRINT "x"');
  });

  it("shows codes when asked", () => {
    const bytes = new Uint8Array(line(1, 0xf5, 0x10, 0x02, ...ascii("x")));
    const text = basicListingText(
      decodeBasicProgram(bytes, 0, bytes.length, { charSet: ZxSpectrumChars, showCodes: true })
        .lines
    );
    expect(text).toContain("$10");
  });

  it("stops at a line out of order", () => {
    const bytes = new Uint8Array([...line(20, 0xfb), ...line(10, 0xfb)]);
    const listing = decodeBasicProgram(bytes, 0, bytes.length, { charSet: ZxSpectrumChars });
    expect(listing.corrupted).toBe(true);
    expect(listing.lineCount).toBe(1);
    expect(basicListingText(listing.lines)).toContain("corrupted");
  });
});
