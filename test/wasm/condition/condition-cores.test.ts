import { describe, expect, it } from "vitest";

import { compileCondition } from "@common/utils/breakpoint-condition/condition-checker";
import { conditionMachineFacts } from "@common/utils/breakpoint-condition/condition-machine";
import { NO_VALUE, emitCondition } from "@common/utils/breakpoint-condition/condition-bytecode";
import { ConditionStore, type ConditionCoreExports } from "@emu/machines/conditionStore";

import {
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine
} from "../zxSpectrum/wasm-test-helpers";
import { createTestZxNextWasmMachine } from "../zxNext/wasm-next-test-helpers";
import { createHarnessZ88Machine } from "../../harness/z88";

/*
 * The breakpoint condition evaluator wired into each Z80 core
 * (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md` Phase 2): the C hooks must read exactly what the
 * machine's TypeScript views read - every partition at its boundaries, the CPU view, the paging -
 * and the registers come from the core's own CPU.
 */

type CoreMachine = {
  machineId: string;
  wasmV2Runtime?: { memory: Uint8Array; exports: ConditionCoreExports };
  getPartitionLabels(): Record<number, string>;
  getMemoryPartition(index: number): Uint8Array;
  getPartition(address: number): number | undefined;
  doReadMemory(address: number): number;
  doWriteMemory(address: number, value: number): void;
  hardReset(): Promise<void>;
  af: number;
  hl: number;
  ix: number;
};

/** Evaluate a condition on the core itself: emit, upload into slot 0, run. */
function onCore(machine: CoreMachine, text: string): number {
  const runtime = machine.wasmV2Runtime!;
  const facts = conditionMachineFacts(machine.machineId, machine.getPartitionLabels());
  const result = compileCondition(text, { ...facts, accessKind: "exec" });
  if (!result.compiled) throw new Error(`'${text}': ${result.errors[0].message}`);
  const store = new ConditionStore(runtime.memory.buffer, runtime.exports);
  const code = emitCondition(result.compiled);
  store.arena.set(code);
  store.slots.set([0, code.length]);
  const raw = runtime.exports.condEvaluateValue(0, 0, 0);
  if (runtime.exports.condGetLastStatus() === 2) throw new Error(`'${text}' failed on the core`);
  return raw === NO_VALUE ? Number.NaN : Number(raw);
}

/** Fill every partition with a pattern that differs per partition and per offset. */
function fillPartitions(machine: CoreMachine): number[] {
  const indexes = Object.keys(machine.getPartitionLabels()).map(Number);
  for (const p of indexes) {
    const view = machine.getMemoryPartition(p);
    for (let i = 0; i < view.length; i++) view[i] = (i * 7 + p * 31 + (i >> 8)) & 0xff;
  }
  return indexes;
}

type Case = { name: string; create: () => Promise<CoreMachine> };

const CORES: Case[] = [
  { name: "ZX Spectrum 48K", create: async () => (await createTestSp48WasmMachine()) as unknown as CoreMachine },
  { name: "ZX Spectrum 128", create: async () => (await createTestSp128WasmMachine()) as unknown as CoreMachine },
  { name: "ZX Spectrum +3E", create: async () => (await createTestSpp3eWasmMachine()) as unknown as CoreMachine },
  { name: "ZX Spectrum Next", create: async () => (await createTestZxNextWasmMachine()) as unknown as CoreMachine },
  { name: "Cambridge Z88", create: async () => (await createHarnessZ88Machine()) as unknown as CoreMachine }
];

describe.each(CORES)("the condition evaluator in the $name core", ({ create }) => {
  it("reads every partition as getMemoryPartition does, at every boundary", async () => {
    const machine = await create();
    await machine.hardReset();
    const labels = machine.getPartitionLabels();
    const indexes = fillPartitions(machine);
    for (const p of indexes) {
      const view = machine.getMemoryPartition(p);
      for (const offset of [0, 1, 0x1fff, 0x2000, 0x3fff, view.length - 1]) {
        const expected = view[offset % view.length];
        expect(onCore(machine, `b[${labels[p]}:$${offset.toString(16)}]`), `${labels[p]}:${offset}`).toBe(
          expected
        );
      }
      // --- A word across the partition's end wraps inside the partition
      const last = view.length - 1;
      expect(onCore(machine, `w[${labels[p]}:$${last.toString(16)}]`)).toBe(view[last] | (view[0] << 8));
    }
  });

  it("reads the CPU view as the machine does", async () => {
    const machine = await create();
    await machine.hardReset();
    fillPartitions(machine);
    for (const address of [0x0000, 0x1fff, 0x4000, 0x5c3a, 0x8000, 0xbfff, 0xc000, 0xffff]) {
      expect(onCore(machine, `b[$${address.toString(16)}]`), `$${address.toString(16)}`).toBe(
        machine.doReadMemory(address)
      );
    }
  });

  it("reports the paging as getPartition does", async () => {
    const machine = await create();
    await machine.hardReset();
    if (!Object.keys(machine.getPartitionLabels()).length) return;
    for (let page = 0; page < 8; page++) {
      const address = page * 0x2000;
      const expected = machine.getPartition(address);
      expect(onCore(machine, `page($${address.toString(16)})`), `page ${page}`).toBe(expected ?? Number.NaN);
    }
  });

  it("reads the registers from the core's CPU, with no sync", async () => {
    const machine = await create();
    await machine.hardReset();
    machine.af = 0x12d5;
    machine.hl = 0xc010;
    machine.ix = 0x8000;
    expect(onCore(machine, "A")).toBe(0x12);
    expect(onCore(machine, "ZF")).toBe(1);
    expect(onCore(machine, "HL")).toBe(0xc010);
    expect(onCore(machine, "XH")).toBe(0x80);
  });
});

describe("side effects", () => {
  it("does not latch the +3E floating bus or touch the access log", async () => {
    const machine = (await createTestSpp3eWasmMachine()) as unknown as CoreMachine & {
      wasmV2Runtime: { exports: Record<string, () => number> };
    };
    await machine.hardReset();
    const wasm = machine.wasmV2Runtime.exports;
    const logBefore = wasm.spp3eGetAccessLogCount();
    // --- $4000 is contended: the core's own read export would latch the value read there
    machine.doWriteMemory(0x4000, 0x5a);
    (wasm.spp3eSetLastContendedValue as (v: number) => void)(0x11);
    expect(onCore(machine, "b[$4000]")).toBe(0x5a);
    expect(wasm.spp3eGetAccessLogCount()).toBe(logBefore);
    expect(wasm.spp3eGetLastContendedValue()).toBe(0x11);
  });
});

describe("the ZX Spectrum Next's own facts", () => {
  it("reads 16K banks and Next registers", async () => {
    const machine = (await createTestZxNextWasmMachine()) as unknown as CoreMachine & {
      wasmV2Runtime: { exports: Record<string, (...args: number[]) => number> };
    };
    await machine.hardReset();
    fillPartitions(machine);
    const low = machine.getMemoryPartition(0x0a);
    const high = machine.getMemoryPartition(0x0b);
    expect(onCore(machine, "b[05:+$0010]")).toBe(low[0x10]);
    expect(onCore(machine, "b[05:+$2010]")).toBe(high[0x10]);
    expect(onCore(machine, "w[05:+$1FFF]")).toBe(low[0x1fff] | (high[0] << 8));
    const exports = machine.wasmV2Runtime.exports;
    for (const reg of [0x07, 0x50, 0x56, 0x57]) {
      expect(onCore(machine, `nr($${reg.toString(16)})`)).toBe(exports.zxnextPeekNextRegister(reg) & 0xff);
    }
  });
});
