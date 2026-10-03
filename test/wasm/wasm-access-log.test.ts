import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { WASM_ACCESS_LOG_WRITE } from "@emu/machines/wasmAccessLog";

import {
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine
} from "./zxSpectrum/wasm-test-helpers";
import { createTestZxNextWasmMachine } from "./zxNext/wasm-next-test-helpers";

/**
 * The per-instruction data-access log of the four WASM Z80 cores (`z80.c`, plan
 * CONDITIONAL_BREAKPOINTS_PLAN.md Phase 0). Every data access of an instruction is recorded in access
 * order with its byte; opcode, displacement and operand fetches are not data and are never logged.
 * Before the log, each core kept one scalar record that every access overwrote, so only an
 * instruction's last access was visible to the memory breakpoints.
 */

type Prefix = "sp48" | "sp128" | "spp3e" | "zxnext";

type Access = { r?: number; w?: number; v: number };

interface LogMachine {
  hardReset(): void | Promise<void>;
  doWriteMemory(address: number, value: number): void;
  doReadMemory(address: number): number;
  pc: number;
  sp: number;
  bc: number;
  de: number;
  hl: number;
  ix: number;
  lastMemoryReads: Uint16Array;
  lastMemoryReadValues: Uint8Array;
  lastMemoryReadsCount: number;
  lastMemoryWrites: Uint16Array;
  lastMemoryWriteValues: Uint8Array;
  lastMemoryWritesCount: number;
  executeMachineFrame(): FrameTerminationMode;
  executionContext: {
    debugStepMode: DebugStepMode;
    frameTerminationMode: FrameTerminationMode;
  };
  wasmV2Runtime?: { accessLog: Uint32Array; exports: unknown };
}

type CoreCase = { prefix: Prefix; create: () => Promise<LogMachine> };

const cores: CoreCase[] = [
  { prefix: "sp48", create: async () => (await createTestSp48WasmMachine()) as unknown as LogMachine },
  { prefix: "sp128", create: async () => (await createTestSp128WasmMachine()) as unknown as LogMachine },
  { prefix: "spp3e", create: async () => (await createTestSpp3eWasmMachine()) as unknown as LogMachine },
  { prefix: "zxnext", create: async () => (await createTestZxNextWasmMachine()) as unknown as LogMachine }
];

const CODE = 0x8000;

type Row = {
  name: string;
  /** Instructions run before the one under test (their accesses are not checked) */
  setup: number[];
  /** The instruction under test */
  instr: number[];
  memory?: Record<number, number>;
  regs?: Partial<Record<"bc" | "de" | "hl" | "ix", number>>;
  expected: Access[];
};

/* The rows of the table in the plan's Phase 0, plus the remaining read-modify-write shapes */
const rows: Row[] = [
  {
    name: "LD ($9000),HL writes both bytes, low first",
    setup: [],
    instr: [0x22, 0x00, 0x90],
    regs: { hl: 0x1234 },
    expected: [
      { w: 0x9000, v: 0x34 },
      { w: 0x9001, v: 0x12 }
    ]
  },
  {
    name: "PUSH BC writes both stack bytes, high first",
    setup: [],
    instr: [0xc5],
    regs: { bc: 0xabcd },
    expected: [
      { w: 0xfeff, v: 0xab },
      { w: 0xfefe, v: 0xcd }
    ]
  },
  {
    name: "CALL nn pushes both bytes of the return address",
    setup: [],
    instr: [0xcd, 0x00, 0xa0],
    expected: [
      { w: 0xfeff, v: 0x80 },
      { w: 0xfefe, v: 0x03 }
    ]
  },
  {
    name: "RST $38 pushes both bytes of the return address",
    setup: [],
    instr: [0xff],
    expected: [
      { w: 0xfeff, v: 0x80 },
      { w: 0xfefe, v: 0x01 }
    ]
  },
  {
    name: "LD HL,($9000) reads both bytes, low first",
    setup: [],
    instr: [0x2a, 0x00, 0x90],
    memory: { 0x9000: 0x11, 0x9001: 0x22 },
    expected: [
      { r: 0x9000, v: 0x11 },
      { r: 0x9001, v: 0x22 }
    ]
  },
  {
    name: "INC (HL) reads, then writes",
    setup: [],
    instr: [0x34],
    regs: { hl: 0x9000 },
    memory: { 0x9000: 0x41 },
    expected: [
      { r: 0x9000, v: 0x41 },
      { w: 0x9000, v: 0x42 }
    ]
  },
  {
    name: "RLC (HL) reads, then writes",
    setup: [],
    instr: [0xcb, 0x06],
    regs: { hl: 0x9000 },
    memory: { 0x9000: 0x81 },
    expected: [
      { r: 0x9000, v: 0x81 },
      { w: 0x9000, v: 0x03 }
    ]
  },
  {
    name: "SET 0,(HL) reads, then writes",
    setup: [],
    instr: [0xcb, 0xc6],
    regs: { hl: 0x9000 },
    memory: { 0x9000: 0x40 },
    expected: [
      { r: 0x9000, v: 0x40 },
      { w: 0x9000, v: 0x41 }
    ]
  },
  {
    name: "SET 1,(IX+3) reads, then writes (displacement and opcode are not data)",
    setup: [],
    instr: [0xdd, 0xcb, 0x03, 0xce],
    regs: { ix: 0x9000 },
    memory: { 0x9003: 0x00 },
    expected: [
      { r: 0x9003, v: 0x00 },
      { w: 0x9003, v: 0x02 }
    ]
  },
  {
    name: "LDI reads the source, then writes the destination",
    setup: [],
    instr: [0xed, 0xa0],
    regs: { hl: 0x9000, de: 0xa000, bc: 0x0002 },
    memory: { 0x9000: 0x5a },
    expected: [
      { r: 0x9000, v: 0x5a },
      { w: 0xa000, v: 0x5a }
    ]
  },
  {
    name: "LDIR (one iteration) reads the source, then writes the destination",
    setup: [],
    instr: [0xed, 0xb0],
    regs: { hl: 0x9000, de: 0xa000, bc: 0x0002 },
    memory: { 0x9000: 0xa5 },
    expected: [
      { r: 0x9000, v: 0xa5 },
      { w: 0xa000, v: 0xa5 }
    ]
  },
  {
    name: "EX (SP),HL reads both bytes, then writes high, then low",
    setup: [],
    instr: [0xe3],
    regs: { hl: 0x1234 },
    memory: { 0xff00: 0x78, 0xff01: 0x56 },
    expected: [
      { r: 0xff00, v: 0x78 },
      { r: 0xff01, v: 0x56 },
      { w: 0xff01, v: 0x12 },
      { w: 0xff00, v: 0x34 }
    ]
  },
  {
    name: "EX (SP),IX reads both bytes, then writes high, then low",
    setup: [],
    instr: [0xdd, 0xe3],
    regs: { ix: 0x1234 },
    memory: { 0xff00: 0x78, 0xff01: 0x56 },
    expected: [
      { r: 0xff00, v: 0x78 },
      { r: 0xff01, v: 0x56 },
      { w: 0xff01, v: 0x12 },
      { w: 0xff00, v: 0x34 }
    ]
  },
  {
    name: "LD A,n and NOP make no data access",
    setup: [],
    instr: [0x3e, 0x47],
    expected: []
  },
  {
    name: "a read of 0 from address 0 is still a read",
    setup: [],
    instr: [0x3a, 0x00, 0x00],
    expected: [{ r: 0x0000, v: -1 }]
  }
];

function exportFn(machine: LogMachine, name: string): () => number {
  return (machine.wasmV2Runtime!.exports as Record<string, () => number>)[name];
}

async function prepare(core: CoreCase, row: Row): Promise<LogMachine> {
  const machine = await core.create();
  await machine.hardReset();
  const code = [...row.setup, ...row.instr, 0x00];
  code.forEach((byte, i) => machine.doWriteMemory(CODE + i, byte));
  for (const [address, value] of Object.entries(row.memory ?? {})) {
    machine.doWriteMemory(Number(address), value);
  }
  machine.pc = CODE;
  machine.sp = 0xff00;
  for (const [reg, value] of Object.entries(row.regs ?? {})) {
    machine[reg as "bc" | "de" | "hl" | "ix"] = value;
  }
  machine.executionContext.debugStepMode = DebugStepMode.StepInto;
  machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
  return machine;
}

/*
 * Steps until PC is no longer inside the instruction's bytes. A prefix may be a step of its own on
 * some cores (PC then points into the instruction); a repeating block instruction lands back on its
 * first byte, which ends the step too.
 */
function stepInstruction(machine: LogMachine, start: number, length: number): void {
  for (let i = 0; i < 4; i++) {
    expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
    if (machine.pc <= start || machine.pc >= start + length) return;
  }
}

function rawLog(machine: LogMachine, prefix: Prefix): Access[] {
  const count = exportFn(machine, `${prefix}GetAccessLogCount`)();
  return Array.from(machine.wasmV2Runtime!.accessLog.subarray(0, count), (entry) =>
    entry & WASM_ACCESS_LOG_WRITE
      ? { w: entry & 0xffff, v: (entry >>> 16) & 0xff }
      : { r: entry & 0xffff, v: (entry >>> 16) & 0xff }
  );
}

describe("WASM per-instruction data-access log", () => {
  for (const core of cores) {
    describe(core.prefix, () => {
      for (const row of rows) {
        it(row.name, async () => {
          const machine = await prepare(core, row);
          let pc = CODE;
          for (const _ of row.setup) {
            // --- setup instructions are single-byte here
            stepInstruction(machine, pc, 1);
            pc = machine.pc;
          }
          stepInstruction(machine, pc, row.instr.length);

          // --- A value of -1 stands for "whatever the ROM holds there"
          const expected = row.expected.map((a) =>
            a.v === -1 ? { ...a, v: machine.doReadMemory(a.r ?? a.w!) } : a
          );
          expect(rawLog(machine, core.prefix)).toEqual(expected);

          // --- The machine's lists: each address with its own byte
          const reads = expected.filter((a) => a.r !== undefined);
          const writes = expected.filter((a) => a.w !== undefined);
          expect(machine.lastMemoryReadsCount).toBe(reads.length);
          expect(machine.lastMemoryWritesCount).toBe(writes.length);
          reads.forEach((a, i) => {
            expect(machine.lastMemoryReads[i]).toBe(a.r);
            expect(machine.lastMemoryReadValues[i]).toBe(a.v);
          });
          writes.forEach((a, i) => {
            expect(machine.lastMemoryWrites[i]).toBe(a.w);
            expect(machine.lastMemoryWriteValues[i]).toBe(a.v);
          });

          expect(exportFn(machine, `${core.prefix}GetAccessLogOverflows`)()).toBe(0);
        });
      }

      it("logs nothing in a normal (fast) frame", async () => {
        const machine = await prepare(core, {
          name: "fast frame",
          setup: [],
          // --- LD ($9000),HL / JR -5: writes memory on every pass
          instr: [0x22, 0x00, 0x90, 0x18, 0xfb],
          expected: []
        });
        machine.executionContext.debugStepMode = DebugStepMode.NoDebug;
        machine.executeMachineFrame();
        expect(exportFn(machine, `${core.prefix}GetAccessLogCount`)()).toBe(0);
        expect(exportFn(machine, `${core.prefix}GetAccessLogOverflows`)()).toBe(0);
      });

      it("an IDE memory read leaves the log untouched", async () => {
        const machine = await prepare(core, rows[0]);
        stepInstruction(machine, CODE, 3);
        const before = rawLog(machine, core.prefix);
        expect(before).toHaveLength(2);
        machine.doReadMemory(0x9000);
        machine.doReadMemory(0x4000);
        expect(rawLog(machine, core.prefix)).toEqual(before);
      });
    });
  }
});
