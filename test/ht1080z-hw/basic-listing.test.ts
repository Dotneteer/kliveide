import { describe, expect, it } from "vitest";

import { ht1080zCharsFor, type Ht1080zCharSetId } from "@common/machines/char-codes";
import { decodeHt1080zProgram, ht1080zProgramArea } from "@renderer/appIde/DocumentPanels/ht1080zBasicListing";
import { createHtSession, type Ht1080zTestSession as HtSession } from "../harness/ht1080z";

/*
 * The BASIC Listing view's HT-1080Z decoder against the ROM's own LIST (`.plans/HT1080Z_PLAN.md` §13,
 * Phase 8): a program is typed, LISTed on the machine, and decoded from the same memory; both must
 * give the same lines. Screen codes are compared through the model's character set.
 */

/** The listing's text in screen codes, as `screenText` writes them */
function listingAsScreen(s: HtSession, set: Ht1080zCharSetId): string[] {
  const memory = new Uint8Array(0x10000);
  for (let a = 0x4000; a < 0x10000; a++) memory[a] = s.peek(a);
  const charSet = ht1080zCharsFor(set);
  // --- A glyph back to its code; letters prefer 20h-7Fh, the /64's specials are below 20h
  const codeOf = new Map<string, number>();
  for (let code = 0x7f; code >= 0; code--) {
    const v = charSet[code]?.v;
    if (v && (!codeOf.has(v) || code >= 0x20)) codeOf.set(v, code);
  }
  const { start, end } = ht1080zProgramArea(memory);
  const { lines, corrupted } = decodeHt1080zProgram(memory, start, end, { charSet, backtickPairs: set === "s64" });
  expect(corrupted).toBe(false);
  // --- The buffer ends with the empty line after the last one
  return lines.filter((line) => line.spans.some((span) => span.text)).map((line) =>
    [...line.spans.map((span) => span.text).join("")]
      .map((ch) => {
        const code = codeOf.get(ch) ?? 0x3f;
        // --- Series I/II screen letters 00h-1Fh read as 40h-5Fh; the /64's specials as {xx}
        return code < 0x20 && set === "s64" ? `{${code.toString(16).padStart(2, "0")}}` : String.fromCharCode(code);
      })
      .join("")
  );
}

function listOnMachine(s: HtSession): string[] {
  s.typeKeys("CLS:LIST\n", { settle: 40 });
  const text = s.screenText().filter((l) => l !== "");
  return text.slice(0, text.indexOf("READY"));
}

describe("HT-1080Z BASIC listing", () => {
  it("Series II: keywords, ELSE, the apostrophe, accents, as LIST prints them", async () => {
    const s = (await createHtSession({ model: "ht1080z-s2" })).bootToPrompt().extensionOn();
    s.typeKeys('10 FOR I=1 TO 10 STEP 2:PRINT "ÁÉÜÖ";I:NEXT\n', { settle: 20 });
    s.typeKeys("20 IF A>=B THEN 10 ELSE PRINT \"X\" ' REMARK\n", { settle: 20 });
    s.typeKeys("30 A$=MID$(\"áéüö\",2,1):REM PRINT GOTO\n", { settle: 20 });
    s.typeKeys("65000 DATA 1,2,3:END\n", { settle: 20 });
    const listing = listingAsScreen(s, "s2");
    expect(listing).toHaveLength(4);
    expect(listing).toEqual(listOnMachine(s));
  });

  it("Series I: the same program text in plain ASCII", async () => {
    const s = (await createHtSession({ model: "ht1080z-s1" })).bootToPrompt();
    s.typeKeys('10 PRINT "HELLO";TAB(5);CHR$(65)\n20 X=USR(0)+PEEK(16384)*2\n', { settle: 20 });
    const listing = listingAsScreen(s, "s1");
    expect(listing[0]).toBe('10 PRINT "HELLO";TAB(5);CHR$(65)');
    expect(listing).toEqual(listOnMachine(s));
  });

  it("/64: backtick pairs list as the Hungarian and mathematical characters", async () => {
    const s = (await createHtSession({ model: "ht1080z-64" })).bootToPrompt().extensionOn();
    s.typeKeys("PRINT CHR$(21)\n");
    s.typeKeys('10 PRINT "ÁRVÍZTŰRŐ ∞π":REM őú√\n', { settle: 30 });
    const listing = listingAsScreen(s, "s64");
    expect(listing[0]).toBe('10 PRINT "{00}RV{02}ZT{08}R{05} {0b}{0c}":REM {15}{16}{19}');
    expect(listing).toEqual(listOnMachine(s));
  });
});
