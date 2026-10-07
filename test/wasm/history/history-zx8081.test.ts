import { describe, expect, it } from "vitest";

import { decodeZx8081Context } from "@common/history/contexts/zx8081Context";
import { HistoryKind, type HistoryRecord } from "@common/history/historyRecord";

import { createZx81Session } from "../../harness/zx81";
import { describeHistoryCore, history, loadRecording } from "./historyCoreSuite";
import { zx8081Driver } from "./drivers";

/*
 * The ZX80/ZX81's execution history (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` Phase 5). The CPU
 * executes the display file: each M1 above 32K of a byte with bit 6 clear reads a NOP the ULA forced
 * onto the bus. Those merge into one forced-NOP record per display line (D6, T2); the SLOW mode's NMIs
 * and the ZX80's per-line INTs are genuine and recorded (T3).
 */

describeHistoryCore("the ZX81", { machineId: "zx81", create: () => zx8081Driver("zx81"), codeBase: 0x6000 });
describeHistoryCore("the ZX80", { machineId: "zx80", create: () => zx8081Driver("zx80"), codeBase: 0x6000 });

/** The records of one whole frame (the middle one of those held) */
function oneFrame(records: HistoryRecord[]): HistoryRecord[] {
  const frames = [...new Set(records.map((r) => r.frame))].sort((a, b) => a - b);
  const frame = frames[Math.floor(frames.length / 2)];
  return records.filter((r) => r.frame === frame);
}

describe("execution history on the ZX81: the display (T2, T3)", () => {
  it("records a SLOW-mode picture as one forced-NOP record per display line", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    s.recordHistory(true).clearHistory();
    s.runFrames(4);
    const records = s.history();
    const dFile = s.peekWord(0x400c);
    // --- Each run starts where its row does: D_FILE + 1 + 33 * row, through the upper echo
    const rowOf = (r: HistoryRecord) => (r.regs.pc - 0x8000 - dFile - 1) / 33;
    // --- The first run may have started before recording did, the last one may not have ended
    const runs = records.filter((r) => r.kind === HistoryKind.ForcedNop).slice(1, -1);
    expect(runs.every((r) => r.repeat === 32 && r.bytes.every((b) => b === 0))).toBe(true);
    expect(runs.every((r) => Number.isInteger(rowOf(r)) && rowOf(r) >= 0 && rowOf(r) < 24)).toBe(true);
    // --- One whole picture (the machine's frame is not the picture's: the ROM times the picture):
    // --- from the first scan line of row 0 that follows row 23, 24 rows of 8 scan lines, in order
    const first = runs.findIndex((r, i) => i > 0 && rowOf(r) === 0 && rowOf(runs[i - 1]) === 23);
    expect(first).toBeGreaterThan(0);
    const picture = runs.slice(first, first + 24 * 8);
    expect(picture.map(rowOf)).toEqual(Array.from({ length: 24 * 8 }, (_, line) => line >> 3));
    // --- Between the runs of a picture only the line's HALT, the INT and its service ran: no display
    // --- byte ran as an instruction of its own
    const from = records.indexOf(picture[0]);
    const to = records.indexOf(picture[picture.length - 1]);
    expect(records.slice(from, to).some((r) => r.kind === HistoryKind.Instruction && r.regs.pc >= 0x8000 && r.bytes[0] === 0)).toBe(false);
    expect(decodeZx8081Context(picture[0].context)).toMatchObject({ zx81Ula: true, ram: "16K" });
  });

  it("records the SLOW mode's NMIs, each followed by the ROM's NMI service", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    s.recordHistory(true).clearHistory();
    s.runFrames(3);
    const records = s.history();
    const frame = oneFrame(records);
    const nmis = frame.filter((r) => r.kind === HistoryKind.Nmi);
    expect(nmis.length).toBeGreaterThan(50);
    for (const nmi of nmis) {
      const next = records[records.indexOf(nmi) + 1];
      if (next) expect(next.regs.pc).toBe(0x0066);
    }
  });

  it("keeps the ring to a few hundred records per frame, not one per display byte", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    s.recordHistory(true).clearHistory();
    s.runFrames(1);
    const before = s.historyInfo().newestSequence;
    s.runFrames(1);
    const perFrame = s.historyInfo().newestSequence - before;
    // --- 192 lines x 32 NOPs would be 6,144 records on their own
    expect(perFrame).toBeLessThan(6144);
  });
});

describe("execution history on the ZX81: folded interrupt service (D10)", () => {
  it("folds every NMI's service, the one that draws the picture included, so the rows are the program", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    s.recordHistory(true).clearHistory();
    s.runFrames(3);
    const info = s.historyInfo();
    const spans = s.machine.getHistoryServiceSpans()!;
    const records = s.history();
    const covered = (sequence: number) => spans.some((span) => sequence >= span.first && sequence <= span.last);
    // --- Every NMI and every forced-NOP run from the first whole picture to the last one is inside a
    // --- folded span (recording started in the middle of a picture, and may stop in one)
    const pictures = spans.filter((span) => span.kind === HistoryKind.Nmi && span.instructions > 1000);
    const display = pictures[0];
    const lastEnd = pictures.at(-1)!.last;
    const settled = records.filter((r) => r.sequence <= lastEnd && r.sequence >= display.first);
    expect(settled.filter((r) => r.kind === HistoryKind.Nmi || r.kind === HistoryKind.ForcedNop).every((r) => covered(r.sequence))).toBe(true);
    // --- The display's NMI service runs the display routine: long, with the line INTs nested in it
    expect(spans.some((span) => span.kind === HistoryKind.Nmi && span.instructions > 1000)).toBe(true);
    // --- What is left is mostly the ROM's keyboard loop, a few percent of the records
    const hidden = spans.reduce((n, span) => n + span.last - span.first, 0);
    expect(hidden / info.count).toBeGreaterThan(0.5);
  });
});

describe("execution history on the ZX80: the display", () => {
  it("records forced-NOP runs and the per-line INT, followed by the ROM's $0038 service", async () => {
    const s = await createZx81Session({ machineId: "zx80" });
    s.bootToBasic();
    s.recordHistory(true).clearHistory();
    s.runFrames(3);
    const records = s.history();
    const frame = oneFrame(records);
    expect(frame.filter((r) => r.kind === HistoryKind.ForcedNop).length).toBeGreaterThan(0);
    expect(frame.some((r) => r.kind === HistoryKind.Nmi)).toBe(false);
    const ints = frame.filter((r) => r.kind === HistoryKind.Int);
    expect(ints.length).toBeGreaterThan(0);
    for (const int of ints) {
      const next = records[records.indexOf(int) + 1];
      if (next) expect(next.regs.pc).toBe(0x0038);
    }
  });

  it("merges forced NOPs only while they run at consecutive addresses", async () => {
    const d = await zx8081Driver("zx81");
    // --- Code above 32K on a stock ZX81: every opcode with bit 6 clear is a forced NOP
    await loadRecording(d, 0x6000, `.org $6000\nStart: di\n jp $c000`);
    d.poke(0xc000, [0x00, 0x00, 0x01, 0x02, 0x76]);
    d.step(6);
    const runs = history(d).filter((r) => r.kind === HistoryKind.ForcedNop);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ repeat: 4, regs: { pc: 0xc000 } });
  });
});
