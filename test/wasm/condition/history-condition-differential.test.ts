import { describe, expect, it } from "vitest";

import { compileCondition } from "@common/utils/breakpoint-condition/condition-checker";
import type { ConditionContext, ConditionRegister } from "@common/utils/breakpoint-condition/condition-types";
import { historyRegister, evaluateHistoryCondition, evaluateHistoryValue } from "@common/history/historyCondition";
import type { HistoryRegisters } from "@common/history/historyRecord";
import { RESULT, runProgram } from "./condition-host";
import { emitCondition } from "@common/utils/breakpoint-condition/condition-bytecode";

/*
 * The history evaluator against the C evaluator (`.plans/LITE_STEP_BACK_PLAN.md` T5): random
 * register-only conditions, the same registers, the same answers. Reverse Continue must decide a
 * register condition exactly as the live machine would have at that instruction.
 */

const REGISTERS: ConditionRegister[] = [
  "A", "F", "B", "C", "D", "E", "H", "L", "I", "R", "XH", "XL", "YH", "YL",
  "AF", "BC", "DE", "HL", "IX", "IY", "SP", "PC", "WZ", "AF'", "BC'", "DE'", "HL'"
];
const FLAGS = ["sf", "zf", "f5f", "hf", "f3f", "pvf", "nf", "cf"];
const BINARY = ["+", "-", "*", "/", "%", "&", "|", "^", "<<", ">>", ">>>", "==", "!=", "<", "<=", ">", ">=", "&&", "||"];
const UNARY = ["!", "~", "-"];

/** A small deterministic generator, so a failure reproduces */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

function randomRegs(next: () => number): HistoryRegisters {
  const w = () => Math.floor(next() * 0x10000);
  return {
    pc: w(), af: w(), bc: w(), de: w(), hl: w(), af_: w(), bc_: w(), de_: w(), hl_: w(),
    ix: w(), iy: w(), sp: w(), ir: w(), wz: w(), iff1: true, iff2: false, interruptMode: 1
  };
}

function randomExpression(next: () => number, depth: number): string {
  const pick = <T,>(xs: T[]) => xs[Math.floor(next() * xs.length)];
  if (depth <= 0 || next() < 0.25) {
    const r = next();
    if (r < 0.45) return pick(REGISTERS).toLowerCase();
    if (r < 0.6) return pick(FLAGS);
    if (r < 0.75) return `s${pick([8, 16, 32])}(${pick(REGISTERS).toLowerCase()})`;
    return String(Math.floor(next() * (next() < 0.5 ? 16 : 0x10000)));
  }
  if (next() < 0.2) return `${pick(UNARY)}(${randomExpression(next, depth - 1)})`;
  return `(${randomExpression(next, depth - 1)} ${pick(BINARY)} ${randomExpression(next, depth - 1)})`;
}

function contextOf(regs: HistoryRegisters): ConditionContext {
  return {
    reg: (id) => historyRegister(regs, id),
    readMemory: () => 0,
    readPartition: () => 0,
    readBank: () => 0,
    partitionOf: () => 0
  };
}

describe("history conditions match the C evaluator", () => {
  it("on 3,000 random register-only conditions", () => {
    const next = rng(0x4733);
    let checked = 0;
    for (let i = 0; i < 3000; i++) {
      const text = randomExpression(next, 4);
      const { compiled } = compileCondition(text, { accessKind: "exec", isZ80: true });
      if (!compiled) continue;
      const regs = randomRegs(next);
      const c = runProgram(emitCondition(compiled), contextOf(regs));
      expect(c.status, text).not.toBe(RESULT.ERROR);
      const ts = evaluateHistoryValue(compiled, regs);
      if (c.status === RESULT.DIVZERO) {
        expect(ts, text).toBe("divzero");
        expect(evaluateHistoryCondition(compiled, regs), text).toEqual({ evaluable: true, value: true });
      } else {
        expect(ts, text).toBe(c.value);
        expect(evaluateHistoryCondition(compiled, regs), text).toEqual({
          evaluable: true,
          value: c.status === RESULT.TRUE
        });
      }
      checked++;
    }
    // --- The checker refuses some random forms (chained comparisons); most compile
    expect(checked).toBeGreaterThan(2000);
  });
});
