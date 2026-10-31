import { describe, expect, it } from "vitest";

import { decodeEpContext, describeEpContext } from "@common/history/contexts/epContext";

import { describeHistoryCore, history } from "./historyCoreSuite";
import { epDriver } from "./drivers";

/*
 * The Enterprise's execution history (`.plans/ENTERPRISE_PLAN.md` §11): the shared suite on both
 * models, and the machine's own context - the page registers B0h-B3h, the model and BFh.
 */

/** From code in page 1, every segment through pages 0, 2 and 3 (B0h, B2h, B3h) */
const PAGING = (base: number) => `
        .org ${base}
Start:  di
        ld e,0
Loop:   ld a,e
        out ($b0),a
        out ($b2),a
        out ($b3),a
        inc e
        jr Loop`;

describeHistoryCore("the Enterprise 128", {
  machineId: "ep",
  create: () => epDriver("ep128"),
  codeBase: 0x6000,
  pagingProgram: PAGING,
  pagingSteps: 2400
});

describeHistoryCore("the Enterprise 64", {
  machineId: "ep",
  create: () => epDriver("ep64"),
  codeBase: 0x6000,
  pagingProgram: PAGING,
  pagingSteps: 2400
});

describe("execution history on the Enterprise", () => {
  it("records the model, BFh and the page registers in the context", async () => {
    for (const [model, is128] of [
      ["ep128", true],
      ["ep64", false]
    ] as const) {
      const d = await epDriver(model);
      d.machine.setHistoryEnabled(true);
      d.runFrames(1);
      const [last] = history(d).slice(-1);
      const c = decodeEpContext(last.context);
      expect(c.is128).toBe(is128);
      expect(c.bf).toBe(0x04);
      expect(describeEpContext(last.context)).toMatch(new RegExp(`^Enterprise ${is128 ? 128 : 64} BF 04h \\[[0-9A-F]{2} [0-9A-F]{2} [0-9A-F]{2} [0-9A-F]{2}\\]$`));
    }
  });
});
