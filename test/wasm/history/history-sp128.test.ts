import { describe, expect, it } from "vitest";

import { decodeSp128Context } from "@common/history/contexts/sp128Context";
import { HistoryKind } from "@common/history/historyRecord";

import { describeHistoryCore, history, loadRecording } from "./historyCoreSuite";
import { sp128Driver } from "./drivers";
import { trdosRomFromEnvironment } from "../../harness/sp128";

/*
 * The 128K core's execution history (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` Phase 2): the ZX
 * Spectrum 128K, the Pentagon 128 and the Scorpion ZS-256, which share one context (D5).
 */

/** Pages every bank in at $C000 and both ROMs in at $0000, from code in bank 2 */
const PAGING_7FFD = (base: number) => `
        .org ${base}
Start:  di
        ld e,0
Loop:   ld bc,$7ffd
        ld a,e
        and $17
        out (c),a
        inc e
        jr Loop`;

/** The Scorpion's $1FFD too: RAM bank 0 or the service ROM at $0000, and banks 8-15 */
const PAGING_SCORPION = (base: number) => `
        .org ${base}
Start:  di
        ld e,0
Loop:   ld bc,$7ffd
        ld a,e
        and $17
        out (c),a
        ld bc,$1ffd
        ld a,e
        rrca
        rrca
        and $13
        out (c),a
        inc e
        jr Loop`;

describeHistoryCore("the ZX Spectrum 128K", {
  machineId: "sp128",
  create: () => sp128Driver("sp128"),
  codeBase: 0x8000,
  pagingProgram: PAGING_7FFD,
  pagingSteps: 500
});

describeHistoryCore("the Pentagon 128", {
  machineId: "sp128",
  create: () => sp128Driver("pentagon"),
  codeBase: 0x8000,
  pagingProgram: PAGING_7FFD,
  pagingSteps: 300
});

describeHistoryCore("the Scorpion ZS-256", {
  machineId: "scorpion",
  create: () => sp128Driver("scorpion"),
  codeBase: 0x8000,
  pagingProgram: PAGING_SCORPION,
  pagingSteps: 800
});

describe("execution history on the 128K: paging", () => {
  it("names the bank each instruction saw, and the lock", async () => {
    const d = await sp128Driver("sp128");
    await loadRecording(d, 0x8000, PAGING_7FFD(0x8000));
    d.step(200);
    const contexts = history(d)
      .filter((r) => r.kind === HistoryKind.Instruction)
      .map((r) => decodeSp128Context(r.context));
    expect(new Set(contexts.map((c) => c.slots[3]))).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(new Set(contexts.map((c) => c.slots[0]))).toEqual(new Set([-1, -2]));
    expect(contexts.every((c) => c.slots[1] === 5 && c.slots[2] === 2 && !c.pagingLocked && c.profile === 0)).toBe(true);
  });

  const trdosRom = trdosRomFromEnvironment();
  it.skipIf(!trdosRom)("names the TR-DOS ROM for an instruction the Beta 128 paged it in for (T7)", async () => {
    const d = await sp128Driver("pentagon", { trdosRom });
    await loadRecording(
      d,
      0x8000,
      `
        .org $8000
Start:  di
        ld bc,$7ffd
        ld a,$10          ; the 48K BASIC ROM: the Beta 128 traps fetches at $3Dxx
        out (c),a
        jp $3d00`
    );
    d.step(5);
    const records = history(d).filter((r) => r.kind === HistoryKind.Instruction);
    const jp = records.find((r) => r.regs.pc === 0x800a)!;
    const trap = records.find((r) => r.regs.pc === 0x3d00)!;
    expect(decodeSp128Context(jp.context)).toMatchObject({ trdosPaged: false, slots: [-2, 5, 2, 0] });
    // --- The fetch at $3D00 paged TR-DOS in, and read its byte: the record names the TR-DOS ROM
    expect(decodeSp128Context(trap.context)).toMatchObject({ trdosPaged: true, slots: [-3, 5, 2, 0] });
    expect(trap.bytes[0]).toBe(trdosRom![0x3d00]);
  });
});
