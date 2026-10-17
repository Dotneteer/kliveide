import { describe, expect, it } from "vitest";

import { ZX8081_KEY } from "@emu/machines/zx8081/Zx8081KeyCode";
import { parseZxProgramFile } from "@emu/machines/zx8081/ZxPFile";
import { analyzeOFile } from "@renderer/appIde/DocumentPanels/PFile/oFileView";
import { describeZx8081Variable } from "@renderer/appIde/DocumentPanels/PFile/pFileView";
import { createZx81Session, type Zx81TestSession } from "../harness/zx81";
import { zx80VarsFile } from "../renderer/pfile/zx80VarsFile";

/*
 * The ZX80 `.O` viewer's model against the real 4K ROM. The core does not capture a ZX80 SAVE, so the
 * file is what SAVE sends - memory from $4000 up to E_LINE - read after a program set one variable of
 * every kind; loading it into a second ZX80 proves the ROM's LOAD takes exactly those bytes.
 * The file is the fixture the unit and panel tests use (`test/renderer/pfile/zx80VarsFile.ts`); the
 * system variables the ROM changes while it runs (FRAMES, S_POSN...) are left out of the comparison.
 */

const VARS = 0x4008;
const E_LINE = 0x400a;

/** Key chords from a compact form: `P`, `N1`, `S+P` (SHIFT + P), `NL` (NEW LINE) */
function chords(spec: string): number[][] {
  const name = (k: string) => ({ NL: "NewLine", SP: "Space" })[k] ?? (/^\d$/.test(k) ? `N${k}` : k);
  return spec
    .trim()
    .split(/\s+/)
    .map((k) => (k.startsWith("S+") ? [ZX8081_KEY.Shift, ZX8081_KEY[name(k.slice(2))]] : [ZX8081_KEY[name(k)]]));
}

/** Types a program line and waits until the ROM has entered it and shows the K cursor again */
function typeLine(s: Zx81TestSession, spec: string): void {
  s.typeChords(...chords(spec));
  s.runUntil(() => s.screenText()[23] === "[K]", { maxFrames: 300 }, spec);
}

function memoryFile(s: Zx81TestSession): Uint8Array {
  const bytes: number[] = [];
  for (let a = 0x4000; a < s.peekWord(E_LINE); a++) bytes.push(s.peek(a));
  return new Uint8Array(bytes);
}

describe("ZX80 .O viewer model on a program's memory", () => {
  it("reads the variables and listing the ROM keeps, and LOAD takes the same bytes", async () => {
    const s = await createZx81Session({ machineId: "zx80" });
    s.bootToBasic();
    // --- K mode: K is LET, D is DIM, F is FOR; SHIFT+L is =, SHIFT+J -, SHIFT+U $, SHIFT+Y the
    // --- quote, SHIFT+I/O the brackets, SHIFT+4 TO
    const program = [
      "1 0 K A S+L 1 NL",
      "2 0 K T O T A L S+L S+J 2 5 NL",
      "3 0 K B S+U S+L S+Y H I S+Y NL",
      "4 0 D C S+I 3 S+O NL",
      "4 5 K C S+I 1 S+O S+L 7 NL",
      "5 0 F I S+L 1 S+4 1 0 NL",
      "7 0 F J S+L 2 S+4 5 NL"
    ];
    for (const line of program) typeLine(s, line);
    s.typeChords(...chords("R NL"));
    s.runFrames(100);
    expect(s.screenText().filter(Boolean)).toEqual(["0/70"]);

    const file = memoryFile(s);
    const { analysis } = analyzeOFile(file);
    const { summary, variables, regions } = analysis!;
    expect(summary.layoutValid).toBe(true);
    expect(summary.lineCount).toBe(7);
    expect(summary.programCorrupted).toBe(false);
    expect(summary.variablesCorrupted).toBe(false);
    expect(regions.map((r) => r.kind)).toEqual(["sysvars", "program", "variables"]);
    expect(variables.map((v) => `${v.name} = ${describeZx8081Variable(v)}`)).toEqual([
      "A = 1",
      "TOTAL = -25",
      'B$ = "HI"',
      "C() = DIM (3)",
      "I = 1 TO 10, NEXT goes to line 51 or the first after it",
      "J = 2 TO 5, NEXT goes to line 71 or the first after it"
    ]);
    const varsBytes = file.subarray(s.peekWord(VARS) - 0x4000);
    expect(Buffer.from(varsBytes).toString("hex")).toBe(
      "66010059343926b1e7ff872d2e01a8030000070000000000ee01000a003300ef02000500470080"
    );
    // --- The fixture: the same program, variables and pointers (VARS, E_LINE, D_FILE)
    const fixture = zx80VarsFile();
    expect([...file.subarray(0x28)]).toEqual([...fixture.subarray(0x28)]);
    expect([...file.subarray(0x08, 0x0e)]).toEqual([...fixture.subarray(0x08, 0x0e)]);

    // --- LOAD on another ZX80 reads the file back as it is
    const t = await createZx81Session({ machineId: "zx80" });
    t.bootToBasic();
    t.loadProgram(parseZxProgramFile(file, "VARS.o")!, { autoRun: false });
    expect([...memoryFile(t).subarray(0x28)]).toEqual([...file.subarray(0x28)]);
    t.typeChords(...chords("O T O T A L NL"));
    t.runFrames(60);
    expect(t.screenText()[0]).toBe("-25");
  }, 60_000);
});
