import { describe, expect, it } from "vitest";

import { ZX8081_KEY } from "@emu/machines/zx8081/Zx8081KeyCode";
import { basicListingText } from "@renderer/appIde/DocumentPanels/basicListing";
import { decodeZx8081Program, zx8081ProgramArea } from "@renderer/appIde/DocumentPanels/zx8081BasicListing";
import { createZx81Session, Zx81TestSession } from "../harness/zx81";

/**
 * The BASIC Listing view's ZX81 and ZX80 detokenizers against the ROMs themselves: a program is typed
 * on the real machine, the ROM lists it on the screen, and the view must list the same memory the
 * same way - the token spacing included.
 */

/** Key chords from a compact form: `P`, `N1`, `S+P` (SHIFT + P), `NL` (NEW LINE), `SP` (SPACE) */
function chords(spec: string): number[][] {
  const name = (k: string) => ({ NL: "NewLine", SP: "Space", ".": "Period" })[k] ?? (/^\d$/.test(k) ? `N${k}` : k);
  return spec
    .trim()
    .split(/\s+/)
    .map((k) => (k.startsWith("S+") ? [ZX8081_KEY.Shift, ZX8081_KEY[name(k.slice(2))]] : [ZX8081_KEY[name(k)]]));
}

/** Types a program line and waits until the ROM has entered it and shows the K cursor again */
function typeLine(s: Zx81TestSession, spec: string): void {
  s.typeChords(...chords(spec));
  try {
    s.runUntil(() => s.screenText()[23] === "[K]", { maxFrames: 300 }, "the K cursor");
  } catch (e) {
    throw new Error(`${spec}: no K cursor; the screen shows ${JSON.stringify(s.screenText().filter(Boolean))}`);
  }
}

/** The ROM's listing lines as the view prints them: the `>` program cursor is a space there */
function romListing(s: Zx81TestSession, lines: number): string[] {
  return s
    .screenText()
    .slice(0, lines)
    .map((l) => l.replace("[>]", " "));
}

function viewListing(s: Zx81TestSession, kind: "zx81" | "zx80"): string[] {
  const memory = new Uint8Array(0x10000);
  for (let a = 0x4000; a < 0x10000; a++) memory[a] = s.peek(a);
  const { start, end } = zx8081ProgramArea(memory, kind);
  const listing = decodeZx8081Program(memory, start, end, kind);
  expect(listing.corrupted).toBe(false);
  // --- The screen reader trims the end of a line; a token's trailing space is the ROM's too
  return basicListingText(listing.lines)
    .split("\n")
    .map((l) => l.trimEnd());
}

describe("BASIC Listing view: ZX81", () => {
  it("lists a program exactly as the ROM's LIST does", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    const program = [
      // 10 PRINT "HI";RND
      "1 0 P S+P H I S+P S+X S+NL T NL",
      // 20 IF A<=1 THEN GOTO 10
      "2 0 U A S+R 1 S+3 G 1 0 NL",
      // 30 LET B=5**2
      "3 0 L B S+L 5 S+H 2 NL",
      // 40 PRINT AT 1,2;PI
      "4 0 P S+NL C 1 S+. 2 S+X S+NL M NL",
      // 50 LET C$=INKEY$+STR$ B
      "5 0 L C S+U S+L S+NL B S+K S+NL Y B NL",
      // 60 REM A  B
      "6 0 E SP A SP SP B NL"
    ];
    for (const line of program) typeLine(s, line);
    const rom = romListing(s, program.length);
    expect(rom[0]).toBe('  10 PRINT "HI";RND');
    expect(viewListing(s, "zx81")).toEqual(rom);
  });
});

describe("BASIC Listing view: a third-party ZX81 program", () => {
  it("lists the programs in basic/ that do not start themselves as the ROM's LIST does, wrapped at 32 columns", async () => {
    for (const file of ["BASE.p", "POKE1.p", "Characters.P"]) {
      const s = await createZx81Session();
      s.bootToBasic();
      s.loadProgram(Zx81TestSession.readProgram(`basic/${file}`), { autoRun: false });
      s.typeChords(...chords("K NL"));
      s.runUntil(() => s.screenText().some((l) => l !== ""), { maxFrames: 300 }, "the listing");
      s.runFrames(100);
      // --- The ROM lists until the screen is full (rows 0-21, then "5/0" or the cursor)
      const rom = s.screenText().slice(0, 22);
      const rows = viewListing(s, "zx81").flatMap((line) => {
        const chunks: string[] = [];
        for (let i = 0; i < Math.max(line.length, 1); i += 32) chunks.push(line.slice(i, i + 32).trimEnd());
        return chunks;
      });
      const shown = rom.findIndex((l) => l === "") === -1 ? rom.length : rom.findIndex((l) => l === "");
      expect(shown, file).toBeGreaterThan(0);
      // --- Inverse characters show as `[x]` on the screen; the view draws them inverse instead
      expect(rows.slice(0, shown), file).toEqual(rom.slice(0, shown).map((l) => l.replace(/\[(.)\]/g, "$1").replace("[>]", " ")));
    }
  });
});

describe("BASIC Listing view: ZX80", () => {
  it("lists a program exactly as the ROM's LIST does", async () => {
    const s = await createZx81Session({ machineId: "zx80" });
    s.bootToBasic();
    const program = [
      // 10 PRINT "HI";A
      "1 0 O S+Y H I S+Y S+X A NL",
      // 20 IF A=1 THEN STOP
      "2 0 U A S+L 1 S+3 S NL",
      // 30 LET B=PEEK(1)*2 AND 3
      "3 0 K B S+L P E E K S+I 1 S+O S+P 2 S+2 3 NL",
      // 40 GO SUB 10
      "4 0 V 1 0 NL",
      // 50 REM A  B
      "5 0 Y SP A SP SP B NL"
    ];
    for (const line of program) typeLine(s, line);
    const rom = romListing(s, program.length);
    expect(rom[0]).toBe('  10 PRINT "HI";A');
    expect(viewListing(s, "zx80")).toEqual(rom);
  });
});
