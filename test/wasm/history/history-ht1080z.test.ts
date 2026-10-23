import { describe, expect, it } from "vitest";

import { decodeHt1080zContext, describeHt1080zContext } from "@common/history/contexts/ht1080zContext";
import { HistoryKind } from "@common/history/historyRecord";

import { describeHistoryCore, history } from "./historyCoreSuite";
import { ht1080zDriver } from "./drivers";

/*
 * The HT-1080Z's execution history (`.plans/HT1080Z_PLAN.md` §11): the shared suite, and the
 * machine's own context. There are no interrupts; the RESET key is an NMI.
 */

describeHistoryCore("the HT-1080Z", { machineId: "ht1080z", create: () => ht1080zDriver(), codeBase: 0x6000, interrupts: false });

describe("execution history on the HT-1080Z", () => {
  it("records each model in the context", async () => {
    for (const [model, expected] of [
      ["ht1080z-s1", { model: "Series I", ram: "16K" }],
      ["ht1080z-64", { model: "/64", ram: "48K" }],
      ["ht1080z-s2-48k", { model: "Series II", ram: "48K" }]
    ] as const) {
      const d = await ht1080zDriver(model);
      d.machine.setHistoryEnabled(true);
      d.runFrames(1);
      const [last] = history(d).slice(-1);
      expect(decodeHt1080zContext(last.context)).toEqual(expected);
      expect(describeHt1080zContext(last.context)).toBe(`HT-1080Z ${expected.model} ${expected.ram}`);
    }
  });

  it("records the RESET key's NMI, followed by the ROM's handler at 0066h", async () => {
    const d = await ht1080zDriver();
    d.machine.setHistoryEnabled(true);
    d.runFrames(1);
    (d.machine as unknown as { pressResetKey(): void }).pressResetKey();
    d.runFrames(2);
    const records = history(d);
    const nmi = records.findIndex((r) => r.kind === HistoryKind.Nmi);
    expect(nmi).toBeGreaterThanOrEqual(0);
    expect(records[nmi + 1].regs.pc).toBe(0x0066);
  });
});
