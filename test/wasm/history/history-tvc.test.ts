import { describe, expect, it } from "vitest";

import { decodeTvcContext, describeTvcContext } from "@common/history/contexts/tvcContext";

import { describeHistoryCore, history } from "./historyCoreSuite";
import { tvcDriver } from "./drivers";

/*
 * The Videoton TVC's execution history (`.plans/VIDEOTON_TVC_PLAN.md` §13): the shared suite on both
 * models, and the machine's own context - port 02h and the 64K+'s port 0Ch.
 */

/**
 * From code in U1, every paging of pages 0, 2 and 3 (port 02h, bit 2 kept clear so page 1 stays U1)
 * and every CPU and display video bank (port 0Ch)
 */
const PAGING = (base: number) => `
        .org ${base}
Start:  di
        ld e,0
Loop:   ld a,e
        and $fb
        out ($02),a
        ld a,e
        rrca
        rrca
        out ($0c),a
        inc e
        jr Loop`;

describeHistoryCore("the Videoton TVC 64K+", {
  machineId: "tvc",
  create: () => tvcDriver("tvc64p"),
  codeBase: 0x6000,
  pagingProgram: PAGING,
  pagingSteps: 2400
});

describeHistoryCore("the Videoton TVC 64K", {
  machineId: "tvc",
  create: () => tvcDriver("tvc64"),
  codeBase: 0x6000,
  pagingProgram: PAGING,
  pagingSteps: 2400
});

describe("execution history on the TVC", () => {
  it("records the model and the paging ports in the context", async () => {
    for (const [model, plus] of [
      ["tvc64", false],
      ["tvc64p", true]
    ] as const) {
      const d = await tvcDriver(model);
      d.machine.setHistoryEnabled(true);
      d.runFrames(1);
      const [last] = history(d).slice(-1);
      const c = decodeTvcContext(last.context);
      expect(c.plus).toBe(plus);
      expect(describeTvcContext(last.context)).toMatch(plus ? /^TVC 64K\+ P02 [0-9A-F]{2}h P0C/ : /^TVC 64K P02 [0-9A-F]{2}h \[/);
    }
  });
});
