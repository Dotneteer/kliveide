import { describe, expect, it } from "vitest";

import { compileCondition, compileConditionWith } from "@common/utils/breakpoint-condition/condition-checker";
import { CondEnv, NO_VALUE, emitCondition } from "@common/utils/breakpoint-condition/condition-bytecode";
import { parseDezogExpression } from "@common/utils/breakpoint-condition/dezog/dezog-parser";
import {
  compileLogTemplate,
  renderLogTemplate,
  type LogValue
} from "@common/utils/breakpoint-condition/logpoint-template";
import type {
  ConditionContext,
  ConditionEnvironment,
  ConditionRegister
} from "@common/utils/breakpoint-condition/condition-types";
import { RESULT, runProgram, setConditionEnv } from "./condition-host";

/*
 * Logpoint expressions on the C evaluator (`.plans/LOGPOINTS_PLAN.md` §3.4-§3.5, Phase 2): the
 * multiplicative operators, division by zero, the machine specials, the DeZog dialect's precedence,
 * and whole templates rendered from values the evaluator computed.
 */

const EXEC: ConditionEnvironment = { accessKind: "exec" };

type Fake = Partial<Record<ConditionRegister, number>> & { memory?: Uint8Array; tstates?: number };

function context(m: Fake = {}): ConditionContext {
  const memory = m.memory ?? new Uint8Array(0x10000);
  return {
    reg: (id) => m[id] ?? 0,
    readMemory: (a) => memory[a],
    readPartition: () => 0,
    readBank: () => 0,
    partitionOf: () => undefined,
    tstates: () => m.tstates ?? 0
  };
}

function klive(text: string, m: Fake = {}) {
  const compiled = compileCondition(text, EXEC).compiled;
  if (!compiled) throw new Error(compileCondition(text, EXEC).errors[0].message);
  return runProgram(emitCondition(compiled), context(m));
}

function dezog(text: string, m: Fake = {}) {
  const result = compileConditionWith(text, EXEC, parseDezogExpression);
  if (!result.compiled) throw new Error(result.errors[0].message);
  return runProgram(emitCondition(result.compiled), context(m));
}

describe("Multiplicative operators", () => {
  it("multiply and divide as integers, truncating toward zero", () => {
    expect(klive("6 * 7").value).toBe(42);
    expect(klive("7 / 2").value).toBe(3);
    expect(klive("-7 / 2").value).toBe(-3);
    expect(klive("A * 2 + 1", { A: 20 }).value).toBe(41);
    expect(klive("A + B * 2 == 7", { A: 1, B: 3 }).status).toBe(RESULT.TRUE);
  });

  it("takes the remainder with the dividend's sign (DeZog dialect only)", () => {
    expect(dezog("7 % 3").value).toBe(1);
    expect(dezog("-7 % 3").value).toBe(-1);
    expect(dezog("7 % -1").value).toBe(0);
    expect(dezog("-7 / -1").value).toBe(7);
  });

  it("reports a division by zero as its own status", () => {
    expect(klive("1 / 0").status).toBe(RESULT.DIVZERO);
    expect(klive("A / B", { A: 3 }).status).toBe(RESULT.DIVZERO);
    expect(dezog("5 % 0").status).toBe(RESULT.DIVZERO);
    // --- Short-circuiting still guards it
    expect(klive("B != 0 && A / B > 1", { A: 3 }).status).toBe(RESULT.FALSE);
  });
});

describe("Machine specials", () => {
  it("reads T-states from the core and the clock and frame counter from the env", () => {
    expect(klive("tstates()", { tstates: 123456 }).value).toBe(123456);
    setConditionEnv(CondEnv.CPUFREQ, 3_500_000);
    setConditionEnv(CondEnv.FRAME, 77);
    expect(klive("cpufreq()").value).toBe(3_500_000);
    expect(klive("frame() == 77").status).toBe(RESULT.TRUE);
    // --- DeZog's own example: integer division (Q3)
    expect(dezog("Remote.cpuFrequency/1000000").value).toBe(3);
    expect(dezog("Remote.tStates", { tstates: 9 }).value).toBe(9);
  });
});

describe("DeZog dialect evaluation", () => {
  it("evaluates with C precedence", () => {
    // --- DeZog: A & (0x0F == 3) = A & 0; Klive: (A & $0F) == 3
    expect(dezog("A & 0x0F == 3", { A: 0x13 }).value).toBe(0);
    expect(klive("A & $0F == 3", { A: 0x13 }).status).toBe(RESULT.TRUE);
    expect(dezog("(A & 0x0F) == 3", { A: 0x13 }).status).toBe(RESULT.TRUE);
  });

  it("reads memory with b@ and w@, little-endian", () => {
    const memory = new Uint8Array(0x10000);
    memory[0x8000] = 0x34;
    memory[0x8001] = 0x12;
    expect(dezog("b@(HL)", { HL: 0x8000, memory }).value).toBe(0x34);
    expect(dezog("w@(HL)", { HL: 0x8000, memory }).value).toBe(0x1234);
    expect(dezog("b@(DE+1)", { DE: 0x8000, memory }).value).toBe(0x12);
    expect(dezog("(HL)", { HL: 0x8000, memory }).value).toBe(0x8000);
  });
});

describe("Templates rendered on the evaluator", () => {
  function render(text: string, dialect: "klive" | "dezog", m: Fake, symbols = {}) {
    const result = compileLogTemplate(text, dialect, { ...EXEC, symbols });
    if (!result.template) throw new Error(result.errors[0].message);
    const ctx = context(m);
    const memory = m.memory ?? new Uint8Array(0x10000);
    return renderLogTemplate(
      result.template,
      (index): LogValue => {
        const segment = result.template!.segments[index];
        if (segment.k !== "value") return { status: "error" };
        const run = runProgram(emitCondition(segment.compiled), ctx);
        if (run.status === RESULT.ERROR) return { status: "error" };
        if (run.status === RESULT.DIVZERO) return { status: "divZero" };
        if (Number.isNaN(run.value)) return { status: "noValue" };
        return { status: "ok", value: BigInt(run.value) };
      },
      { peek: (a) => memory[a], slots: () => "R0 B5 B2 B0" }
    );
  }

  it("renders the plan's Klive examples", () => {
    expect(render("x={A} at {PC:hex16}", "klive", { A: 0x3f, PC: 0x8012 })).toBe("x=$3F at 8012");
    const memory = new Uint8Array(0x10000);
    memory[0x9002] = 0x00;
    memory[0x9003] = 0xc0;
    memory[0x9004] = 0x80;
    expect(
      render("[SPRITES] sprite {B} at {w[IX+2]:hex16}, visible={b[IX+4] & $80 != 0}", "klive", {
        B: 3,
        IX: 0x9000,
        memory
      })
    ).toBe("sprite $03 at C000, visible=1");
    expect(render("{{literal braces}} and a dollar $ sign", "klive", {})).toBe(
      "{literal braces} and a dollar $ sign"
    );
  });

  it("renders the plan's DeZog examples", () => {
    const memory = new Uint8Array(0x10000);
    memory[0x7000] = 42;
    expect(
      render("[SPRITES] Status=${A:hex8}, Counter=${b@(sprite.counter)}", "dezog", { A: 0xf3, memory }, {
        "sprite.counter": 0x7000
      })
    ).toBe("Status=F3, Counter=$2A");
    setConditionEnv(CondEnv.CPUFREQ, 3_546_900);
    expect(render("Freq=${Remote.cpuFrequency/1000000}MHz", "dezog", {})).toBe("Freq=3MHz");
    expect(render("${1/0} and ${Remote.slots}", "dezog", {})).toBe("<division by zero> and R0 B5 B2 B0");
  });

  it("reads strings through the evaluator's paging", () => {
    const memory = new Uint8Array(0x10000);
    memory.set([0x4b, 0x4c, 0x49, 0x56, 0x45, 0x60, 0], 0x6000);
    expect(render("name={HL:string}", "klive", { HL: 0x6000, memory })).toBe("name=KLIVE£");
  });

  it("prints 'no value' for an unpaged partition", () => {
    expect(NO_VALUE).toBe(-(2n ** 63n));
  });
});
