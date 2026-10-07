import { describe, expect, it } from "vitest";

import { bindCondition, compileCondition } from "@common/utils/breakpoint-condition/condition-checker";
import type { ConditionEnvironment } from "@common/utils/breakpoint-condition/condition-types";
import type { HistoryRegisters } from "@common/history/historyRecord";
import { evaluateHistoryCondition } from "@common/history/historyCondition";

/*
 * The register-only condition evaluator Reverse Continue uses (`.plans/LITE_STEP_BACK_PLAN.md` D11,
 * T5). Its agreement with the C evaluator is checked operator by operator in
 * `test/wasm/condition/history-condition-differential.test.ts`; this file checks what it refuses.
 */

const EXEC: ConditionEnvironment = { accessKind: "exec", isZ80: true, hasPartitions: true, parsePartitionLabel: () => 0 };

const REGS: HistoryRegisters = {
  pc: 0x8000,
  af: 0x12c5, // A=$12, F=$C5: S, Z, P/V, C
  bc: 0x3456,
  de: 0x789a,
  hl: 0xbcde,
  af_: 0x1111,
  bc_: 0x2222,
  de_: 0x3333,
  hl_: 0x4444,
  ix: 0x5566,
  iy: 0x7788,
  sp: 0xfefe,
  ir: 0x3f42,
  wz: 0x9abc,
  iff1: true,
  iff2: true,
  interruptMode: 1
};

function run(text: string) {
  const { compiled, errors } = compileCondition(text, { ...EXEC, symbols: { Counter: 0x3456 } });
  if (!compiled) throw new Error(errors.map((e) => e.message).join("; "));
  bindCondition(compiled, { counter: 0x3456 });
  return evaluateHistoryCondition(compiled, REGS);
}

describe("evaluateHistoryCondition", () => {
  it("evaluates registers, flags, labels and arithmetic from the record", () => {
    expect(run("A == $12")).toEqual({ evaluable: true, value: true });
    expect(run("hl == $bcde && sp < $ff00")).toEqual({ evaluable: true, value: true });
    expect(run("zf && cf && !nf")).toEqual({ evaluable: true, value: true });
    expect(run("bc == Counter")).toEqual({ evaluable: true, value: true });
    expect(run("R == $42 || I == 0")).toEqual({ evaluable: true, value: true });
    expect(run("s8(L) < 0")).toEqual({ evaluable: true, value: true });
    expect(run("(hl' >> 8) == $44")).toEqual({ evaluable: true, value: true });
    expect(run("de > hl")).toEqual({ evaluable: true, value: false });
  });

  it("fails safe on a zero divisor, as the core does", () => {
    expect(run("A / (B - $34) == 1")).toEqual({ evaluable: true, value: true });
  });

  it("refuses what a record does not hold", () => {
    expect(run("b[hl] == 0")).toEqual({ evaluable: false, reason: "it reads memory" });
    expect(run("A == 1 && w[$5c00] == 0")).toEqual({ evaluable: false, reason: "it reads memory" });
    expect(run("page(pc) == 0")).toEqual({ evaluable: false, reason: "it reads the memory paging" });
    expect(run("frame() > 10")).toEqual({ evaluable: false, reason: "it reads the frame counter" });
    expect(run("tstates() > 10")).toMatchObject({ evaluable: false });
  });
});
