import { describe, expect, it } from "vitest";

import { decodeSamContext, describeSamContext, samPartitionFor } from "@common/history/contexts/samContext";

import { describeHistoryCore, history } from "./historyCoreSuite";
import { samDriver } from "./drivers";

/*
 * The SAM Coupé's execution history (`dev/plans/SAM_COUPE_PLAN.md` §11): the shared suite on both models,
 * and the machine's own context - LMPR, HMPR, VMPR, the external page registers and the pages fitted.
 */

/**
 * From code in section C (HMPR's page, which stays), every LMPR: section A ROM0 or a RAM page, section B
 * the page after it, section D ROM1 or HMPR's next page
 */
const PAGING = (base: number) => `
        .org ${base}
Start:  di
        ld e,0
Loop:   ld a,e
        and $7f
        out ($fa),a
        inc e
        jr Loop`;

describeHistoryCore("the SAM Coupé 512K", {
  machineId: "sam",
  create: () => samDriver("sam512"),
  codeBase: 0x8000,
  pagingProgram: PAGING,
  pagingSteps: 1200
});

describeHistoryCore("the SAM Coupé 256K", {
  machineId: "sam",
  create: () => samDriver("sam256"),
  codeBase: 0x8000,
  pagingProgram: PAGING,
  pagingSteps: 1200
});

describe("execution history on the SAM Coupé", () => {
  it("records the paging registers and the pages fitted in the context", async () => {
    for (const [model, pages] of [
      ["sam512", 32],
      ["sam256", 16]
    ] as const) {
      const d = await samDriver(model);
      d.machine.setHistoryEnabled(true);
      d.runFrames(1);
      const [last] = history(d).slice(-1);
      const c = decodeSamContext(last.context);
      expect(c.ramPages).toBe(pages);
      expect(describeSamContext(last.context)).toMatch(
        new RegExp(`^SAM Coupé ${pages * 16}K LMPR [0-9A-F]{2}h HMPR [0-9A-F]{2}h VMPR [0-9A-F]{2}h \\[\\S+ \\S+ \\S+ \\S+\\]$`)
      );
    }
  });

  it("decodes the sections as the core maps them", () => {
    const context = (lmpr: number, hmpr: number, lepr = 0, hepr = 0) => Uint8Array.from([lmpr, hmpr, 0, lepr, hepr, 32, ...Array(10).fill(0)]);
    // --- ROM0, page 1, page 3, ROM1 (LMPR bit 6)
    expect([0x0000, 0x4000, 0x8000, 0xc000].map((a) => samPartitionFor(context(0x40, 0x03), a))).toEqual([0x40, 1, 3, 0x41]);
    // --- RAM0 (bit 5): page 5 at 0000h, page 6 at 4000h; HMPR 31 wraps to page 0 in section D
    expect([0x0000, 0x4000, 0x8000, 0xc000].map((a) => samPartitionFor(context(0x25, 0x1f), a))).toEqual([5, 6, 31, 0]);
    // --- MCNTRL: the external pages LEPR and HEPR, over ROM1
    expect([0x8000, 0xc000].map((a) => samPartitionFor(context(0x40, 0x80, 2, 9), a))).toEqual([0x82, 0x89]);
  });
});
