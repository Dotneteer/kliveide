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
  "condEvaluateValue",
  "condSetEnv",
  "condPeek"
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
  condSetEnv(index: number, value: number): void;
  condPeek(address: number): number;
};

/**
 * What `condEvaluate` answers. `DIVZERO` (a division or remainder by zero) is an error to a
 * condition - anything but `FALSE` fails safe - and `<division by zero>` to a logpoint.
 */
export const ConditionResult = { FALSE: 0, TRUE: 1, ERROR: 2, DIVZERO: 3 } as const;

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

  /** Run the program in `slot`: `ConditionResult.TRUE`, `FALSE`, `ERROR` or `DIVZERO`. */
  evaluate(slot: number, accessValue = 0, accessAddress = 0): number {
    return this.exports.condEvaluate(slot, accessValue >>> 0, accessAddress >>> 0);
  }

  /**
   * The value of the expression in `slot` - a logpoint placeholder - and the run's status. "No
   * value" (`page()` of an unpaged address) comes back as `NO_VALUE`.
   */
  evaluateValue(slot: number, accessValue = 0, accessAddress = 0): { status: number; value: bigint } {
    const value = this.exports.condEvaluateValue(slot, accessValue >>> 0, accessAddress >>> 0);
    return { status: this.exports.condGetLastStatus(), value: BigInt.asIntN(64, BigInt(value)) };
  }

  /** Write a machine fact a program reads with `ENV` (`CondEnv`): the clock, the frame counter. */
  setEnv(index: number, value: number): void {
    this.exports.condSetEnv(index, value >>> 0);
  }

  /** A byte as the CPU sees it now, without side effects (the core's `COND_PEEK`). */
  peek(address: number): number {
    return this.exports.condPeek(address & 0xffff) & 0xff;
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
  getPartition?(address: number): number | undefined;
  readonly baseClockFrequency?: number;
  readonly clockMultiplier?: number;
  readonly frames?: number;
};

/**
 * The machine facts a logpoint or condition reads that the core does not keep itself
 * (`.plans/LOGPOINTS_PLAN.md` §3.5): the CPU clock, the frame counter and the slot map.
 */
export type ConditionMachineInfo = {
  /** Base clock times the multiplier, in Hz (Next turbo included). */
  cpuFrequency(): number;
  /** Frames since the machine started. */
  frame(): number;
  /** The partition paged into each slot, in the machine's own labels (`R0 B5 B2 B0`). */
  slots(): string;
};

/** The machine's slot layout for `slots()`: the Next pages 8K slots, the others 16K ones. */
function slotSizeOf(machineId: string): number {
  return machineId === "zxnext" ? 0x2000 : 0x4000;
}

/** The `ConditionMachineInfo` of a machine. */
export function conditionMachineInfo(machine: ConditionMachine): ConditionMachineInfo {
  const slotSize = slotSizeOf(machine.machineId);
  return {
    cpuFrequency: () =>
      Math.round((machine.baseClockFrequency ?? 0) * (machine.clockMultiplier ?? 1)),
    frame: () => machine.frames ?? 0,
    slots: () => {
      const labels = machine.getPartitionLabels?.() ?? {};
      if (!machine.getPartition || Object.keys(labels).length === 0) return "";
      const parts: string[] = [];
      for (let address = 0; address < 0x10000; address += slotSize) {
        const partition = machine.getPartition(address);
        parts.push(partition === undefined ? "?" : (labels[partition] ?? String(partition)));
      }
      return parts.join(" ");
    }
  };
}

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
  debugSupport.machineInfo = conditionMachineInfo(machine);
  debugSupport.setConditionEnvironment(
    conditionMachineFacts(machine.machineId, machine.getPartitionLabels?.() ?? {})
  );
}
