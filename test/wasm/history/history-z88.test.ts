import { describe, expect, it } from "vitest";

import { decodeZ88Context } from "@common/history/contexts/z88Context";
import { HistoryKind } from "@common/history/historyRecord";

import { describeHistoryCore, history, historyInfo, loadRecording } from "./historyCoreSuite";
import { z88Driver } from "./drivers";

/*
 * The Cambridge Z88's execution history (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` Phase 4). Its
 * debugger runs instructions in C (`z88ExecuteUntilStop`), which records too (D9). A snoozed CPU and a
 * CPU in coma run no cycle, so they leave a gap the frame numbers show (T8).
 */

describeHistoryCore("the Cambridge Z88", { machineId: "z88", create: z88Driver, codeBase: 0x8000, halts: false });

describe("execution history on the Z88", () => {
  it("records the segment registers and the bank behind each 8K page", async () => {
    const d = await z88Driver();
    await loadRecording(d, 0x8000, `.org $8000\nStart: di\n nop\n jr Start`);
    d.step(3);
    const c = decodeZ88Context(history(d, 1)[0].context);
    expect(c).toMatchObject({ segments: [0x21, 0x21, 0x22, 0x23], rams: true });
    expect(c.pageBanks).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((page) => exportsOf(d).z88GetPageBank(page)));
  });

  it("records nothing while the CPU snoozes on the keyboard, and resumes with the frame gap (T8)", async () => {
    const d = await z88Driver();
    await loadRecording(
      d,
      0x8000,
      `
        .org $8000
Start:  di
        ld a,$81
        out ($b1),a       ; INT: KWAIT and GINT, no TIME - nothing wakes the CPU but a key
        ld bc,$00b2
        in a,(c)          ; no key down: snooze
Loop:   inc a
        jr Loop`
    );
    d.runFrames(1);
    expect(exportsOf(d).z88GetCpuSnoozed()).toBe(1);
    const before = historyInfo(d);
    const asleep = history(d, 1)[0];
    expect(asleep.regs.pc, "the IN that snoozed").toBe(0x8008);
    d.runFrames(3);
    expect(historyInfo(d).newestSequence, "nothing recorded while snoozing").toBe(before.newestSequence);
    exportsOf(d).z88SetCpuSnoozed(0);
    d.step(1);
    const resumed = history(d, 1)[0];
    expect(resumed).toMatchObject({ kind: HistoryKind.Instruction, sequence: before.newestSequence + 1, regs: { pc: 0x800a } });
    expect(resumed.frame).toBeGreaterThanOrEqual(asleep.frame + 3);
  });
});

function exportsOf(d: { machine: unknown }): Record<string, (value?: number) => number> {
  return (d.machine as { wasmV2Runtime: { exports: Record<string, (value?: number) => number> } }).wasmV2Runtime.exports;
}
