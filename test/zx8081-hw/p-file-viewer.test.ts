import { describe, expect, it } from "vitest";

import type { SavedFileInfo } from "@emu/abstractions/ITapeDevice";
import { SAVED_TO_TAPE } from "@emu/machines/machine-props";
import { Zx8081KeyCode } from "@emu/machines/zx8081/Zx8081KeyCode";
import { analyzePFile, describeZx81Variable } from "@renderer/appIde/DocumentPanels/PFile/pFileView";
import { createZx81Session, type Zx81TestSession } from "../harness/zx81";

/*
 * The `.P` viewer's model against the real ROM: a program sets one variable of every kind and saves
 * itself; the file the ROM wrote reads back with those variables, its listing and its autorun line.
 * The variables' bytes are the fixture `test/renderer/pfile/pFileView.test.ts` uses.
 */

/** Types a program line and waits until the ROM has listed it */
function typeLine(s: Zx81TestSession, text: string): void {
  s.typeKeys(text, { settle: 0 });
  s.runUntil(() => s.hasKCursor(), { maxFrames: 300 }, `the line ${text}`).runFrames(10);
}

describe("ZX81 .P viewer model on a saved program", () => {
  it("reads the variables, listing and autorun line the ROM saved", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    // --- K mode: L is LET, D is DIM, F is FOR, S is SAVE; TO is SHIFT+4
    typeLine(s, "10LA=1\n");
    typeLine(s, "20LTOTAL=-2.5\n");
    typeLine(s, '30LB$="HI"\n');
    typeLine(s, "40DC(3)\n");
    typeLine(s, "50DD$(2,3)\n");
    s.typeKeys("60FI=1", { settle: 10 });
    s.typeChords([Zx8081KeyCode.Shift, Zx8081KeyCode.N4]);
    typeLine(s, "10\n");
    typeLine(s, '70S"VARS"\n');
    s.typeKeys("R\n", { settle: 0 });
    s.runUntil(() => s.machine.getMachineProperty(SAVED_TO_TAPE) !== undefined, { maxFrames: 600 }, "the SAVE");

    const saved = s.machine.getMachineProperty(SAVED_TO_TAPE) as SavedFileInfo;
    expect(saved.name).toBe("VARS.p");
    const { analysis } = analyzePFile(saved.contents);
    const { summary, variables } = analysis!;
    expect(summary.layoutValid).toBe(true);
    expect(summary.lineCount).toBe(7);
    // --- Saved by line 70, which has no line after it: NXTLIN points at the display file
    expect(summary.autorunLine).toBeUndefined();
    expect(summary.slowMode).toBe(true);
    expect(variables.map((v) => `${v.name} = ${describeZx81Variable(v)}`)).toEqual([
      "A = 1",
      "TOTAL = -2.5",
      'B$ = "HI"',
      "C() = DIM (3)",
      "D$() = DIM (2, 3)",
      "I = 1 TO 10 STEP 1, NEXT goes to line 61 or the first after it"
    ]);
    const varsBytes = saved.contents.subarray(summary.vars - 0x4009);
    expect(Buffer.from(varsBytes).toString("hex")).toBe(
      "668100000000b9343926b182a00000004702002d2e881200010300000000000000000000000000000000c90b000202000300000000000000ee8100000000842000000081000000003d0080"
    );
  }, 60_000);
});
