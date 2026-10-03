/*
 * The breakpoint condition evaluator as every Z80 core exports it
 * (`src/emu/z80/wasm/z80-condition.c`, `.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md` §4.2).
 *
 * The names are the same in all five cores (E8), so one binding serves them all: the loaders add
 * `CONDITION_CORE_EXPORTS` to their required exports and `ConditionCoreExports` to their export
 * type, and a machine wraps its runtime in a `ConditionStore`.
 */

import type { IDebugSupport } from "@renderer/abstractions/IDebugSupport";

import { conditionMachineFacts } from "@common/utils/breakpoint-condition/condition-machine";

/** The evaluator's exports, identical in every Z80 core. */
export const CONDITION_CORE_EXPORTS = [
  "condArenaPtr",
  "condArenaCapacity",
  "condSlotTablePtr",
  "condSlotCapacity",
  "condMaxProgramWords",
  "condGetToken",
  "condSetToken",
  "condGetLastStatus",
  "condEvaluate",
  "condEvaluateValue"
] as const;

export type ConditionCoreExports = {
  condArenaPtr(): number;
  condArenaCapacity(): number;
  condSlotTablePtr(): number;
  condSlotCapacity(): number;
  condMaxProgramWords(): number;
  condGetToken(): number;
  condSetToken(token: number): void;
  condGetLastStatus(): number;
  condEvaluate(slot: number, accessValue: number, accessAddress: number): number;
  condEvaluateValue(slot: number, accessValue: number, accessAddress: number): bigint;
};

/** What `condEvaluate` answers. */
export const ConditionResult = { FALSE: 0, TRUE: 1, ERROR: 2 } as const;

/**
 * A core's program store: the arena the programs live in, the slot table that names them, and the
 * call that runs one. Views over the core's own memory, which never grows (the cores' initial and
 * maximum memory are equal), so they stay valid for the runtime's life.
 */
export class ConditionStore {
  readonly arena: Uint32Array;
  readonly slots: Uint32Array;
  readonly slotCount: number;
  readonly maxProgramWords: number;

  constructor(
    buffer: ArrayBufferLike,
    private readonly exports: ConditionCoreExports
  ) {
    this.arena = new Uint32Array(buffer, exports.condArenaPtr(), exports.condArenaCapacity());
    this.slotCount = exports.condSlotCapacity();
    this.slots = new Uint32Array(buffer, exports.condSlotTablePtr(), this.slotCount * 2);
    this.maxProgramWords = exports.condMaxProgramWords();
  }

  /** The token the last rebuild wrote; a store this side did not write (a fresh core) differs. */
  get token(): number {
    return this.exports.condGetToken() >>> 0;
  }

  set token(value: number) {
    this.exports.condSetToken(value >>> 0);
  }

  /** Run the program in `slot`: `ConditionResult.TRUE`, `FALSE` or `ERROR`. */
  evaluate(slot: number, accessValue = 0, accessAddress = 0): number {
    return this.exports.condEvaluate(slot, accessValue >>> 0, accessAddress >>> 0);
  }
}

/** One store per core runtime: a machine that instantiates a new core gets a new store. */
const stores = new WeakMap<object, ConditionStore>();

/** The program store of a loaded core runtime (its memory view and its exports). */
export function conditionStoreOf(runtime: { memory: Uint8Array; exports: ConditionCoreExports }): ConditionStore {
  let store = stores.get(runtime);
  if (!store) {
    store = new ConditionStore(runtime.memory.buffer, runtime.exports);
    stores.set(runtime, store);
  }
  return store;
}

/** The machine members `connectConditionSupport` reads. */
export type ConditionMachine = {
  readonly machineId: string;
  getConditionStore?(): ConditionStore | undefined;
  getPartitionLabels?(): Record<number, string>;
};

/**
 * Give a breakpoint store what conditions need from its machine: the core's condition evaluator and
 * the machine facts conditions compile against - built with the same helper the IDE validates with.
 * The emulator's machine service calls this for every machine it creates; the test harnesses call
 * it too, so a real-machine test arms conditions exactly as the emulator does.
 */
export function connectConditionSupport(debugSupport: IDebugSupport, machine: ConditionMachine): void {
  debugSupport.conditionStoreProvider = machine.getConditionStore
    ? () => machine.getConditionStore!()
    : undefined;
  debugSupport.setConditionEnvironment(
    conditionMachineFacts(machine.machineId, machine.getPartitionLabels?.() ?? {})
  );
}
