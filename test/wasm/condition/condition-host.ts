import { readFileSync } from "node:fs";

import type {
  CompiledCondition,
  ConditionContext
} from "@common/utils/breakpoint-condition/condition-types";
import {
  CONDITION_REGISTER_IDS,
  NO_VALUE,
  emitCondition
} from "@common/utils/breakpoint-condition/condition-bytecode";

import { ConditionStore, type ConditionCoreExports } from "@emu/machines/conditionStore";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildConditionWasm } = require("../../../scripts/build-condition-wasm.cjs");

/*
 * The breakpoint condition evaluator - the C code every Z80 core includes - run standalone for tests
 * (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md` §6).
 *
 * Its machine facts are WebAssembly imports bound to whatever `ConditionContext` the test supplies,
 * so a test describes registers, memory and paging exactly as it did when the evaluator was
 * TypeScript, and the expectations carry over unchanged - now checked against C.
 */

type Exports = {
  memory: WebAssembly.Memory;
  condArenaPtr(): number;
  condSlotTablePtr(): number;
  condEvaluate(slot: number, value: number, address: number): number;
  condEvaluateValue(slot: number, value: number, address: number): bigint;
  condGetLastStatus(): number;
};

let instance: Exports | undefined;
let current: ConditionContext | undefined;

function host(): Exports {
  if (instance) return instance;
  const { output } = buildConditionWasm();
  const ctx = () => {
    if (!current) throw new Error("No condition context");
    return current;
  };
  const module = new WebAssembly.Module(readFileSync(output));
  const created = new WebAssembly.Instance(module, {
    env: {
      reg: (id: number) => ctx().reg(CONDITION_REGISTER_IDS[id]) >>> 0,
      peek: (address: number) => ctx().readMemory(address) >>> 0,
      peekPartition: (partition: number, address: number) =>
        ctx().readPartition(partition, address >>> 0) >>> 0,
      peekBank: (bank: number, offset: number) => ctx().readBank(bank, offset) >>> 0,
      partitionOf: (address: number) => ctx().partitionOf(address) ?? Number.NaN,
      nextReg: (reg: number) => (ctx().nextReg ? ctx().nextReg!(reg) >>> 0 : 0)
    }
  });
  instance = created.exports as unknown as Exports;
  return instance;
}

/** Status codes of `condEvaluate`. */
export const RESULT = { FALSE: 0, TRUE: 1, ERROR: 2 } as const;

/** Run a raw program in slot 0. */
export function runProgram(
  code: Uint32Array,
  ctx: ConditionContext,
  access: { value?: number; address?: number } = {}
): { status: number; value: number } {
  const wasm = host();
  new Uint32Array(wasm.memory.buffer, wasm.condArenaPtr(), code.length).set(code);
  new Uint32Array(wasm.memory.buffer, wasm.condSlotTablePtr(), 2).set([0, code.length]);
  current = ctx;
  try {
    const raw = wasm.condEvaluateValue(0, access.value ?? 0, access.address ?? 0);
    const status = wasm.condGetLastStatus();
    return { status, value: raw === NO_VALUE ? Number.NaN : Number(raw) };
  } finally {
    current = undefined;
  }
}

/** The value of a compiled condition's expression, evaluated by the C evaluator. */
export function evaluateValue(compiled: CompiledCondition, ctx: ConditionContext): number {
  const { status, value } = runProgram(emitCondition(compiled), ctx, {
    value: ctx.accessValue,
    address: ctx.accessAddress
  });
  if (status === RESULT.ERROR) throw new Error(`The evaluator refused '${compiled.source}'`);
  return value;
}

/** Is a compiled condition true? Evaluated by the C evaluator. */
export function evaluateCondition(compiled: CompiledCondition, ctx: ConditionContext): boolean {
  const { status } = runProgram(emitCondition(compiled), ctx, {
    value: ctx.accessValue,
    address: ctx.accessAddress
  });
  if (status === RESULT.ERROR) throw new Error(`The evaluator refused '${compiled.source}'`);
  return status === RESULT.TRUE;
}

/**
 * A program store over the standalone evaluator, reading the given context - what a machine's
 * `getConditionStore()` returns, for testing `DebugSupport` without a machine. The context stays
 * bound until the next call.
 */
export function conditionTestStore(ctx: ConditionContext): ConditionStore {
  const wasm = host();
  current = ctx;
  return new ConditionStore(wasm.memory.buffer, wasm as unknown as ConditionCoreExports);
}
