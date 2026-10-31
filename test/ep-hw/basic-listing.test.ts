import { describe, expect, it } from "vitest";

import { EpChars } from "@common/machines/char-codes";
import { decodeEpBasicListing } from "@renderer/appIde/DocumentPanels/epBasicListing";
import { createEpSession, type EpTestSession } from "../harness/enterprise";

/*
 * The BASIC Listing view on the Enterprise (`epBasicListing.ts`): a program typed into IS-BASIC 2.1,
 * listed from the bytes it stored, as LIST prints it - keywords in capitals, blocks indented, and 23h
 * through EXOS's font as £.
 */

const PROGRAM = [`10 print "HI";x`, `20 for i=1 to 3`, `30 let a$="#"`, `40 next`, `50 rem keep it`];
const LISTED = [`10 PRINT "HI";X`, `20 FOR I=1 TO 3`, `30   LET A$="£"`, `40 NEXT`, `50 REM keep it`];

function listing(s: EpTestSession) {
  const memory = new Uint8Array(0x10000);
  for (let a = 0; a < 0x10000; a++) memory[a] = s.peek(a);
  const { lines, corrupted, lineCount } = decodeEpBasicListing(memory, { charSet: EpChars });
  return {
    corrupted,
    lineCount,
    text: lines.map((line) => line.spans.map((span) => span.text).join("").replace(/\xa0/g, " ")).filter((l) => l)
  };
}

describe("IS-BASIC listing", () => {
  it("lists a program typed on the Enterprise 128", async () => {
    const s = (await createEpSession()).bootToBasic();
    s.typeKeys(PROGRAM.join("\n") + "\n", { settle: 10 });
    expect(listing(s)).toEqual({ corrupted: false, lineCount: PROGRAM.length, text: LISTED });
  });
});
