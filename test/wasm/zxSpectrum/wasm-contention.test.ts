import { describe, expect, it } from "vitest";

import {
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine,
  testRom,
  type TestCpuRegisters,
  type TestSp128WasmMachine,
  type TestSp48WasmMachine,
  type TestSpp3eWasmMachine
} from "./wasm-test-helpers";

type WasmMachine = TestSp48WasmMachine | TestSp128WasmMachine | TestSpp3eWasmMachine;

const DELAY = 6;
const START_TACT = 100;
const CONTENTION_RANGE = 200;

describe("ZX Spectrum WASM contention", () => {
  it("48K delays only the contended 0x4000-0x7fff memory range", async () => {
    const machine = await createTestSp48WasmMachine(testRom([]));

    expectAddressDelay(machine, "sp48", 0x4000, DELAY);
    expectAddressDelay(machine, "sp48", 0x8000, 0);
  });

  it("128K delays 0x4000 and the top slot only when an odd RAM bank is selected", async () => {
    const machine = await createTestSp128WasmMachine(testRom([]), testRom([]));

    expectAddressDelay(machine, "sp128", 0x4000, DELAY);

    machine.writeTestPort(0x7ffd, 0x03);
    expectAddressDelay(machine, "sp128", 0xc000, DELAY);

    machine.writeTestPort(0x7ffd, 0x04);
    expectAddressDelay(machine, "sp128", 0xc000, 0);
  });

  /*
   * The +2A/+3 gate array contends only MREQ cycles (Sinclair Wiki, "Contended memory"): a memory read
   * of the top slot with RAM bank 4-7 paged in waits; the internal cycles of `INC BC` with IR in
   * contended memory do not (the ULA's `pc:4,ir:1 x2` is the gate array's `pc:6`).
   */
  it("+3E delays memory reads of the top slot when RAM bank 4-7 is selected, not internal cycles", async () => {
    const machine = await createTestSpp3eWasmMachine([testRom([]), testRom([]), testRom([]), testRom([])]);
    const ldANn = { code: [0x3a, 0x00, 0xc0], startAddress: 0x8000, registers: { ir: 0 } };

    machine.writeTestPort(0x7ffd, 0x04);
    expectInstructionContention(machine, { ...ldANn, expectedTacts: 13 + DELAY, expectedDelay: DELAY });

    machine.writeTestPort(0x7ffd, 0x03);
    expectInstructionContention(machine, { ...ldANn, expectedTacts: 13, expectedDelay: 0 });

    expectInstructionContention(machine, { code: [0x03], startAddress: 0x8000, registers: { ir: 0x4000 }, expectedTacts: 6, expectedDelay: 0 });
  });

  it("48K applies I/O contention only for contended odd ports", async () => {
    const machine = await createTestSp48WasmMachine(testRom([]));

    expectOutInstructionContention(machine, {
      accumulator: 0x40,
      operand: 0xff,
      expectedTacts: 4 + 3 + 4 * DELAY + 4,
      expectedDelay: 4 * DELAY
    });

    expectOutInstructionContention(machine, {
      accumulator: 0x80,
      operand: 0xff,
      expectedTacts: 4 + 3 + 4,
      expectedDelay: 0
    });
  });

  it("128K applies I/O contention for 0xc000 odd-bank and 0x4000 ports", async () => {
    const machine = await createTestSp128WasmMachine(testRom([]), testRom([]));

    machine.writeTestPort(0x7ffd, 0x03);
    expectOutInstructionContention(machine, {
      accumulator: 0xc0,
      operand: 0xff,
      expectedTacts: 4 + 3 + 4 * DELAY + 4,
      expectedDelay: 4 * DELAY
    });

    machine.writeTestPort(0x7ffd, 0x00);
    expectOutInstructionContention(machine, {
      accumulator: 0xc0,
      operand: 0xff,
      expectedTacts: 4 + 3 + 4,
      expectedDelay: 0
    });

    expectOutInstructionContention(machine, {
      accumulator: 0x40,
      operand: 0xff,
      expectedTacts: 4 + 3 + 4 * DELAY + 4,
      expectedDelay: 4 * DELAY
    });
  });

  /*
   * No I/O cycle is contended on the +2A/+3, port $FE included (WoS 128K reference, "+2A/+3"; Sinclair
   * Wiki, "Contended I/O": the gate array contends only while MREQ is active, which it is not for I/O).
   */
  it("+3E applies no I/O contention", async () => {
    const machine = await createTestSpp3eWasmMachine([testRom([]), testRom([]), testRom([]), testRom([])]);

    machine.writeTestPort(0x7ffd, 0x05);
    expectOutInstructionContention(machine, { accumulator: 0xc0, operand: 0xff, expectedTacts: 4 + 3 + 4, expectedDelay: 0 });
    expectOutInstructionContention(machine, { accumulator: 0x40, operand: 0xfe, expectedTacts: 4 + 3 + 4, expectedDelay: 0 });
    expectOutInstructionContention(machine, { accumulator: 0x00, operand: 0xfe, expectedTacts: 4 + 3 + 4, expectedDelay: 0 });
  });

  it("48K HALT applies contention at 0x4000 but not 0x8000", async () => {
    const contended = await createTestSp48WasmMachine(testRom([]));
    expectInstructionContention(contended, {
      code: [0x76],
      startAddress: 0x4000,
      registers: { ir: 0 },
      expectedTacts: DELAY + 4,
      expectedDelay: DELAY
    });
    expect(contended.getTestCpuRegisters().halted).toBe(true);

    prepCpuContention(contended);
    contended.setTestCpuRegisters({ pc: 0x4000 });
    const before = contended.getTestCpuRegisters().tacts;
    contended.executeOne();
    expect(contended.getTestCpuRegisters().tacts - before).toBe(DELAY + 4);
    expect(contended.getContentionDelayTotalForTest()).toBe(DELAY);

    const nonContended = await createTestSp48WasmMachine(testRom([]));
    expectInstructionContention(nonContended, {
      code: [0x76],
      startAddress: 0x8000,
      registers: { ir: 0 },
      expectedTacts: 4,
      expectedDelay: 0
    });
    expect(nonContended.getTestCpuRegisters().halted).toBe(true);
  });

  /*
   * An opcode fetch is `pc:4`: the ULA halts the CPU only on an M-cycle's first T-state, so the
   * refresh with IR in contended memory is not delayed (z80.c, Z80_DELAY_REFRESH_BUS_ACCESS). It used
   * to be, which put IR Contention's lower border bars out of place on the 48K and the 128K, and drew
   * ULA 128 Timing Test wrong; both now match the real machines' pictures.
   */
  it("48K and 128K M1 refresh is not contended via the IR address", async () => {
    const refreshOnly = await createTestSp48WasmMachine(testRom([]));
    expectInstructionContention(refreshOnly, {
      code: [0x00],
      startAddress: 0x8000,
      registers: { ir: 0x4000 },
      expectedTacts: 4,
      expectedDelay: 0
    });

    const refreshOnly128 = await createTestSp128WasmMachine(testRom([]), testRom([]));
    expectInstructionContention(refreshOnly128, {
      code: [0x00],
      startAddress: 0x8000,
      registers: { ir: 0x4000 },
      expectedTacts: 4,
      expectedDelay: 0
    });

    const noRefresh = await createTestSp48WasmMachine(testRom([]));
    expectInstructionContention(noRefresh, {
      code: [0x00],
      startAddress: 0x8000,
      registers: { ir: 0 },
      expectedTacts: 4,
      expectedDelay: 0
    });

    const fetchOnly = await createTestSp48WasmMachine(testRom([]));
    expectInstructionContention(fetchOnly, {
      code: [0x00],
      startAddress: 0x4000,
      registers: { ir: 0x4000 },
      expectedTacts: 4 + DELAY,
      expectedDelay: DELAY
    });
  });

  it("mirrors the WASM contention counters onto the machine state", async () => {
    const machines: WasmMachine[] = [
      await createTestSp48WasmMachine(testRom([])),
      await createTestSp128WasmMachine(testRom([]), testRom([])),
      await createTestSpp3eWasmMachine([testRom([]), testRom([]), testRom([]), testRom([])])
    ];

    for (const machine of machines) {
      // --- The counters live in the WASM backend; the machine must surface them, as the ULA panel
      // --- reads them straight off the machine object.
      const afterStart = runFramesUntilContention(machine);
      expect(afterStart).toBeGreaterThan(0);
      expect(machine.totalContentionDelaySinceStart).toBe(afterStart);
      expect(machine.contentionDelaySincePause).toBe(afterStart);

      // --- A new run restarts the "since pause" counter without disturbing the total.
      machine.resetContentionDelaySincePause();
      expect(machine.contentionDelaySincePause).toBe(0);
      expect(machine.totalContentionDelaySinceStart).toBe(afterStart);

      const afterResume = runFramesUntilContention(machine, afterStart);
      expect(machine.totalContentionDelaySinceStart).toBe(afterResume);
      expect(machine.contentionDelaySincePause).toBe(afterResume - afterStart);
    }
  });

  it("48K contention stats include only real I/O delays", async () => {
    const machine = await createTestSp48WasmMachine(testRom([]));

    expectOutInstructionContention(machine, {
      accumulator: 0x80,
      operand: 0xff,
      expectedTacts: 4 + 3 + 4,
      expectedDelay: 0
    });

    expectOutInstructionContention(machine, {
      accumulator: 0x40,
      operand: 0xff,
      expectedTacts: 4 + 3 + 4 * DELAY + 4,
      expectedDelay: 4 * DELAY
    });
  });
});

function runFramesUntilContention(machine: WasmMachine, from = 0): number {
  for (let i = 0; i < 32; i++) {
    machine.executeMachineFrame();
    const total = machine.getContentionDelayTotalForTest();
    if (total > from) {
      return total;
    }
  }
  throw new Error("The machine did not accumulate any contention delay.");
}

function expectAddressDelay(
  machine: WasmMachine,
  prefix: "sp48" | "sp128" | "spp3e",
  address: number,
  expectedDelay: number
): void {
  prepCpuContention(machine);
  if (prefix === "sp128") {
    machine.delayAddressBusAccess(address);
  } else {
    callWasmExport(machine, `${prefix}DelayAddressBusAccess`)(address & 0xffff);
    machine.getCpuState();
  }
  expect(machine.getContentionDelayTotalForTest(), `${prefix} ${address.toString(16)}`).toBe(expectedDelay);
}

function expectOutInstructionContention(
  machine: WasmMachine,
  args: {
    accumulator: number;
    operand: number;
    expectedTacts: number;
    expectedDelay: number;
  }
): void {
  expectInstructionContention(machine, {
    code: [0xd3, args.operand],
    startAddress: 0x8000,
    registers: { af: args.accumulator << 8, ir: 0 },
    expectedTacts: args.expectedTacts,
    expectedDelay: args.expectedDelay
  });
}

function expectInstructionContention(
  machine: WasmMachine,
  args: {
    code: number[];
    startAddress: number;
    registers?: TestCpuRegisters;
    expectedTacts: number;
    expectedDelay: number;
  }
): void {
  machine.initCode(args.code, args.startAddress);
  prepCpuContention(machine);
  machine.setTestCpuRegisters({
    pc: args.startAddress,
    sp: 0xffff,
    af: args.registers?.af ?? 0,
    ir: args.registers?.ir ?? 0
  });

  const before = machine.getTestCpuRegisters().tacts;
  machine.executeOne();

  expect(machine.getTestCpuRegisters().tacts - before).toBe(args.expectedTacts);
  expect(machine.getContentionDelayTotalForTest()).toBe(args.expectedDelay);
}

function prepCpuContention(machine: WasmMachine): void {
  machine.setContentionRange(START_TACT, CONTENTION_RANGE, DELAY);
  machine.setAbsoluteTacts(START_TACT);
  machine.resetContentionCounters();
}

function callWasmExport(machine: WasmMachine, name: string): (...args: number[]) => number {
  const fn = (machine.wasmV2Runtime?.exports as Record<string, unknown> | undefined)?.[name];
  if (typeof fn !== "function") {
    throw new Error(`WASM export '${name}' is not available.`);
  }
  return fn as (...args: number[]) => number;
}
