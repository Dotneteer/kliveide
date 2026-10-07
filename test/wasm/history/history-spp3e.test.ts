import { describe, expect, it } from "vitest";

import { decodeSpP3eContext } from "@common/history/contexts/spp3eContext";
import { HistoryKind } from "@common/history/historyRecord";

import { describeHistoryCore, history, loadRecording } from "./historyCoreSuite";
import { sp128Driver } from "./drivers";

/*
 * The +2A/+3/+2E/+3E core's execution history (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` Phase 3).
 * The partition check steps through $7FFD paging, the four ROMs ($1FFD bit 2) and the special
 * all-RAM mode whose configuration keeps bank 2 at $8000, where the program runs.
 */

const PAGING_P3 = (base: number) => `
        .org ${base}
Start:  di
        ld e,0
Loop:   ld bc,$7ffd
        ld a,e
        and $17
        out (c),a
        ld a,e
        and 3
        ld hl,Modes
        add a,l
        ld l,a
        ld a,(hl)
        ld bc,$1ffd
        out (c),a
        inc e
        jr Loop
        .org ${base + 0x80}
Modes:  .defb $00, $01, $04, $00`;

for (const model of ["nofdd", "plus3-fdd1"] as const) {
  describeHistoryCore(`the +2A/+3/+2E/+3E (${model})`, {
    machineId: "spp3e",
    create: () => sp128Driver(model),
    codeBase: 0x8000,
    pagingProgram: PAGING_P3,
    pagingSteps: 700
  });
}

describe("execution history on the +3: special paging", () => {
  it("records the special all-RAM mode and the four ROMs in the instruction's context", async () => {
    const d = await sp128Driver("nofdd");
    await loadRecording(d, 0x8000, PAGING_P3(0x8000));
    d.step(600);
    const contexts = history(d)
      .filter((r) => r.kind === HistoryKind.Instruction)
      .map((r) => decodeSpP3eContext(r.context));
    const special = contexts.filter((c) => c.specialPaging);
    expect(special.length).toBeGreaterThan(0);
    expect(special.every((c) => c.slots.join() === "0,1,2,3")).toBe(true);
    expect(new Set(contexts.filter((c) => !c.specialPaging).map((c) => c.slots[0]))).toEqual(new Set([-1, -2, -3, -4]));
  });
});
