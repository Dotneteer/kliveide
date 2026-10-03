import type {
  ConditionContext,
  ConditionRegister
} from "@common/utils/breakpoint-condition/condition-types";
import type { IDebugSupport } from "@renderer/abstractions/IDebugSupport";

import { conditionMachineFacts } from "@common/utils/breakpoint-condition/condition-machine";

/*
 * Building the context a breakpoint condition reads (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §3.8,
 * §4.6). Registers come from the TypeScript CPU fields - on a WASM machine after the one register
 * sync the machine does before asking - and memory from reads that have no side effects (R3).
 */

/** The register file a condition reads, as `Z80Cpu` exposes it. */
export type ConditionRegisterFile = {
  readonly a: number;
  readonly f: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly h: number;
  readonly l: number;
  readonly i: number;
  readonly r: number;
  readonly xh: number;
  readonly xl: number;
  readonly yh: number;
  readonly yl: number;
  readonly af: number;
  readonly bc: number;
  readonly de: number;
  readonly hl: number;
  readonly ix: number;
  readonly iy: number;
  readonly sp: number;
  readonly pc: number;
  readonly wz: number;
  readonly af_: number;
  readonly bc_: number;
  readonly de_: number;
  readonly hl_: number;
};

/** The memory side of a context: side-effect-free reads only. */
export type ConditionMemory = Pick<
  ConditionContext,
  "readMemory" | "readPartition" | "readBank" | "partitionOf" | "nextReg"
>;

/** The value of a condition register in a register file. */
export function readConditionRegister(cpu: ConditionRegisterFile, id: ConditionRegister): number {
  switch (id) {
    case "A":
      return cpu.a;
    case "F":
      return cpu.f;
    case "B":
      return cpu.b;
    case "C":
      return cpu.c;
    case "D":
      return cpu.d;
    case "E":
      return cpu.e;
    case "H":
      return cpu.h;
    case "L":
      return cpu.l;
    case "I":
      return cpu.i;
    case "R":
      return cpu.r;
    case "XH":
      return cpu.xh;
    case "XL":
      return cpu.xl;
    case "YH":
      return cpu.yh;
    case "YL":
      return cpu.yl;
    case "AF":
      return cpu.af;
    case "BC":
      return cpu.bc;
    case "DE":
      return cpu.de;
    case "HL":
      return cpu.hl;
    case "IX":
      return cpu.ix;
    case "IY":
      return cpu.iy;
    case "SP":
      return cpu.sp;
    case "PC":
      return cpu.pc;
    case "WZ":
      return cpu.wz;
    case "AF'":
      return cpu.af_;
    case "BC'":
      return cpu.bc_;
    case "DE'":
      return cpu.de_;
    case "HL'":
      return cpu.hl_;
  }
}

/** A context over a register file and a memory reader. */
export function createConditionContext(
  cpu: ConditionRegisterFile,
  memory: ConditionMemory
): ConditionContext {
  return {
    reg: (id) => readConditionRegister(cpu, id),
    ...memory
  };
}

/** The machine members the partition-view memory reader uses. */
export type PartitionedMemorySource = {
  getPartition(address: number): number | undefined;
  getMemoryPartition(index: number): Uint8Array;
  get64KFlatMemory(): Uint8Array;
};

/**
 * Memory reads through the machine's partition views: `getMemoryPartition` returns a view onto the
 * machine's own memory (no copy), so these reads touch nothing.
 *
 * - CPU address: the partition paged in there, at the address modulo the partition's size; a
 *   machine without partitions reads its flat 64K, fetched once per context.
 * - Partition: the byte at the address modulo that partition's size (8K pages and 16K ROMs alike).
 * - ZX Spectrum Next 16K bank: its two 8K pages.
 */
export function partitionViewMemory(machine: PartitionedMemorySource): ConditionMemory {
  let flat: Uint8Array | undefined;
  const views = new Map<number, Uint8Array>();
  const view = (partition: number) => {
    let found = views.get(partition);
    if (!found) {
      found = machine.getMemoryPartition(partition);
      views.set(partition, found);
    }
    return found;
  };
  return {
    readMemory: (address) => {
      const partition = machine.getPartition(address);
      if (partition === undefined) {
        flat ??= machine.get64KFlatMemory();
        return flat[address & 0xffff] ?? 0;
      }
      const v = view(partition);
      return v.length ? v[address % v.length] : 0;
    },
    readPartition: (partition, address) => {
      const v = view(partition);
      return v.length ? v[address % v.length] : 0;
    },
    readBank: (bank, offset) => {
      const v = view(bank * 2 + ((offset >> 13) & 1));
      return v[offset & 0x1fff] ?? 0;
    },
    partitionOf: (address) => machine.getPartition(address)
  };
}

/** The machine members `connectConditionSupport` reads. */
export type ConditionMachine = {
  readonly machineId: string;
  getConditionContext?(): ConditionContext;
  getPartitionLabels?(): Record<number, string>;
};

/**
 * Give a breakpoint store what conditions need from its machine: the context provider and the
 * machine facts, built with the same helper the IDE validates with. The emulator's machine service
 * calls this for every machine it creates; the test harnesses call it too, so a real-machine test
 * arms conditions exactly as the IDE's emulator does.
 */
export function connectConditionSupport(debugSupport: IDebugSupport, machine: ConditionMachine): void {
  debugSupport.conditionContextProvider = machine.getConditionContext
    ? () => machine.getConditionContext!()
    : undefined;
  debugSupport.setConditionEnvironment(
    conditionMachineFacts(machine.machineId, machine.getPartitionLabels?.() ?? {})
  );
}
