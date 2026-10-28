import { describe, expect, it } from "vitest";

import { TvcChars } from "@common/machines/char-codes";
import { decodeTvcProgram } from "@renderer/appIde/DocumentPanels/tvcBasicListing";
import { createTvcSession, type TvcTestSession } from "../harness/tvc";

/*
 * The TVC BASIC listing (`tvcBasicListing.ts`): programs typed into BASIC on both models, listed
 * from the bytes BASIC stored. Spaces come back as typed, keywords in capitals, and the text of
 * strings, REM, `!` and DATA as it was.
 */

const PROGRAM = [
  `10 PRINT "A,B";X:REM hi, there`,
  `20 DATA 1,"x:y",abc:print 2`,
  `30 IF A>=1 THEN 10 ELSE GOTO 20`,
  `40 ! note: "kept"`,
  `50 for i=1to 9 step 2: next`,
  `60 a$="árvíztűrő tükörfúrógép"`
];

const LISTED = [
  `10 PRINT "A,B";X:REM hi, there`,
  `20 DATA 1,"x:y",abc:PRINT 2`,
  `30 IF A>=1 THEN 10 ELSE GOTO 20`,
  `40 ! note: "kept"`,
  `50 FOR I=1TO 9 STEP 2: NEXT`,
  `60 A$="árvíztűrő tükörfúrógép"`
];

function listing(s: TvcTestSession, basic22: boolean) {
  const memory = new Uint8Array(0x10000);
  for (let a = 0; a < 0x10000; a++) memory[a] = s.peek(a);
  const { lines, corrupted, lineCount } = decodeTvcProgram(memory, { charSet: TvcChars, basic22 });
  return {
    corrupted,
    lineCount,
    text: lines.map((line) => line.spans.map((span) => span.text).join("").replace(/\xa0/g, " ")).filter((l) => l)
  };
}

describe("TVC BASIC listing", () => {
  it.each([
    ["tvc64", false],
    ["tvc64p", true]
  ] as const)("lists a program typed on the %s", async (model, basic22) => {
    const s = (await createTvcSession({ model })).bootToBasic();
    s.typeKeys(PROGRAM.join("\n") + "\n", { settle: 10 });
    expect(listing(s, basic22)).toEqual({ corrupted: false, lineCount: PROGRAM.length, text: LISTED });
  });

  it("names BASIC 2.2's own keywords", async () => {
    const s = (await createTvcSession({ model: "tvc64p" })).bootToBasic();
    s.typeKeys("10 RECTANGLE 10,20\n", { settle: 10 });
    expect(listing(s, true).text).toEqual(["10 RECTANGLE 10,20"]);
  });

  it("follows TEXT after LOMEM moved the program", async () => {
    const s = (await createTvcSession()).bootToBasic();
    s.typeKeys("LOMEM 24576\n10 PRINT 1\n", { settle: 10 });
    expect(s.peekWord(0x1722)).toBe(0x6000);
    expect(listing(s, false).text).toEqual(["10 PRINT 1"]);
  });

  it("shows an empty program as no lines, and a broken one as corrupted", async () => {
    const s = (await createTvcSession({ model: "tvc64" })).bootToBasic();
    expect(listing(s, false)).toEqual({ corrupted: false, lineCount: 0, text: [] });
    // --- A line whose length points past its terminator
    s.poke(0x19ef, [0x06, 0x0a, 0x00, 0xdd, 0x20, 0x00, 0x00]);
    expect(listing(s, false).corrupted).toBe(true);
  });
});
