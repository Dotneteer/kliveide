import { describe, expect, it } from "vitest";

import {
  createOracleSp128Machine,
  createOracleSp48Machine,
  createOracleSpp3eMachine,
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine,
  testRom,
  type TestOracleSp128Machine,
  type TestOracleSp48Machine,
  type TestOracleSpp3eMachine,
  type TestSp128WasmMachine,
  type TestSp48WasmMachine,
  type TestSpp3eWasmMachine
} from "./wasm-test-helpers";

type WasmMachine = TestSp48WasmMachine | TestSp128WasmMachine | TestSpp3eWasmMachine;
type OracleMachine = TestOracleSp48Machine | TestOracleSp128Machine | TestOracleSpp3eMachine;

type ContentionCase = {
  name: string;
  createWasmMachine: () => Promise<WasmMachine>;
  createOracleMachine: () => Promise<OracleMachine>;
};

const DELAY = 6;
const START_TACT = 100;
const CONTENTION_RANGE = 200;

describe("ZX Spectrum WASM contention parity", () => {
  for (const testCase of contentionCases()) {
    it(`${testCase.name} generated contention table matches representative TypeScript tacts`, async () => {
      const wasmMachine = await testCase.createWasmMachine();
      const oracleMachine = await testCase.createOracleMachine();
      const activeDisplayTact = findTact(oracleMachine, value => value > 0);
      const inactiveTact = findTact(oracleMachine, value => value === 0);
      const tacts = uniqueTacts([
        0,
        inactiveTact,
        activeDisplayTact,
        activeDisplayTact + 1,
        activeDisplayTact + 5,
        oracleMachine.tactsInFrame - 1
      ], oracleMachine.tactsInFrame);

      expect(oracleMachine.getContentionValueForTest(activeDisplayTact)).toBeGreaterThan(0);
      expect(oracleMachine.getContentionValueForTest(inactiveTact)).toBe(0);
      for (const tact of tacts) {
        expect(wasmMachine.getContentionValueForTest(tact), `${testCase.name} tact ${tact}`).toBe(
          oracleMachine.getContentionValueForTest(tact)
        );
      }
    });
  }

  it("48K delays only the contended 0x4000-0x7fff memory range", async () => {
    const wasmMachine = await createTestSp48WasmMachine(testRom([]));
    const oracleMachine = await createOracleSp48Machine(testRom([]));
    const tact = findTact(oracleMachine, value => value > 0);

    expectDelayForAddress(wasmMachine, oracleMachine, tact, 0x4000, "sp48");
    expectDelayForAddress(wasmMachine, oracleMachine, tact, 0x8000, "sp48");
  });

  it("128K delays 0x4000 and the top slot only when an odd RAM bank is selected", async () => {
    const wasmMachine = await createTestSp128WasmMachine(testRom([]), testRom([]));
    const oracleMachine = await createOracleSp128Machine(testRom([]), testRom([]));
    const tact = findTact(oracleMachine, value => value > 0);

    expectDelayForAddress(wasmMachine, oracleMachine, tact, 0x4000, "sp128");

    wasmMachine.writeTestPort(0x7ffd, 0x03);
    oracleMachine.writeTestPort(0x7ffd, 0x03);
    expectDelayForAddress(wasmMachine, oracleMachine, tact, 0xc000, "sp128");

    wasmMachine.writeTestPort(0x7ffd, 0x04);
    oracleMachine.writeTestPort(0x7ffd, 0x04);
    expectDelayForAddress(wasmMachine, oracleMachine, tact, 0xc000, "sp128");
  });

  it("+3E delays the top slot when RAM bank 4-7 is selected", async () => {
    const wasmMachine = await createTestSpp3eWasmMachine([testRom([]), testRom([]), testRom([]), testRom([])]);
    const oracleMachine = await createOracleSpp3eMachine([testRom([]), testRom([]), testRom([]), testRom([])]);
    const tact = findTact(oracleMachine, value => value > 0);

    wasmMachine.writeTestPort(0x7ffd, 0x04);
    oracleMachine.writeTestPort(0x7ffd, 0x04);
    expectDelayForAddress(wasmMachine, oracleMachine, tact, 0xc000, "spp3e");

    wasmMachine.writeTestPort(0x7ffd, 0x03);
    oracleMachine.writeTestPort(0x7ffd, 0x03);
    expectDelayForAddress(wasmMachine, oracleMachine, tact, 0xc000, "spp3e");
  });

  describe("CPU-level contention slices", () => {
    it("128K D1 applies I/O contention for 0xc000 odd-bank and 0x4000 ports", async () => {
      const wasmMachine = await createTestSp128WasmMachine(testRom([]), testRom([]));
      const oracleMachine = await createOracleSp128Machine(testRom([]), testRom([]));

      await expectOutInstructionContention({
        wasmMachine,
        oracleMachine,
        prefix: "sp128",
        selectedBank: 3,
        accumulator: 0xc0,
        operand: 0xff,
        expectedDelay: 4 * DELAY
      });
      await expectOutInstructionContention({
        wasmMachine,
        oracleMachine,
        prefix: "sp128",
        selectedBank: 0,
        accumulator: 0xc0,
        operand: 0xff,
        expectedDelay: 0
      });
      await expectOutInstructionContention({
        wasmMachine,
        oracleMachine,
        prefix: "sp128",
        selectedBank: 0,
        accumulator: 0x40,
        operand: 0xff,
        expectedDelay: 4 * DELAY
      });
    });

    it("+3E D1 applies I/O contention for 0xc000 ports only when bank 4-7 is selected", async () => {
      const roms = [testRom([]), testRom([]), testRom([]), testRom([])];
      const wasmMachine = await createTestSpp3eWasmMachine(roms);
      const oracleMachine = await createOracleSpp3eMachine(roms);

      await expectOutInstructionContention({
        wasmMachine,
        oracleMachine,
        prefix: "spp3e",
        selectedBank: 5,
        accumulator: 0xc0,
        operand: 0xff,
        expectedDelay: 4 * DELAY
      });
      await expectOutInstructionContention({
        wasmMachine,
        oracleMachine,
        prefix: "spp3e",
        selectedBank: 2,
        accumulator: 0xc0,
        operand: 0xff,
        expectedDelay: 0
      });
    });

    for (const testCase of cpuContentionCases()) {
      it(`${testCase.name} D2 applies HALT contention at 0x4000 but not 0x8000`, async () => {
        const wasmMachine = await testCase.createWasmMachine();
        const oracleMachine = await testCase.createOracleMachine();

        expectInstructionContention({
          wasmMachine,
          oracleMachine,
          prefix: testCase.prefix,
          code: [0x76],
          startAddress: 0x4000,
          expectedDelay: DELAY
        });
        expect(wasmMachine.getTestCpuRegisters().halted).toBe(true);

        const wasmMachine2 = await testCase.createWasmMachine();
        const oracleMachine2 = await testCase.createOracleMachine();
        expectInstructionContention({
          wasmMachine: wasmMachine2,
          oracleMachine: oracleMachine2,
          prefix: testCase.prefix,
          code: [0x76],
          startAddress: 0x8000,
          expectedDelay: 0
        });
        expect(wasmMachine2.getTestCpuRegisters().halted).toBe(true);
      });

      it(`${testCase.name} D5 records only real I/O contention delays`, async () => {
        const wasmMachine = await testCase.createWasmMachine();
        const oracleMachine = await testCase.createOracleMachine();

        expectOutInstructionContention({
          wasmMachine,
          oracleMachine,
          prefix: testCase.prefix,
          selectedBank: testCase.nonContendedTopBank,
          accumulator: 0x80,
          operand: 0xff,
          expectedDelay: 0
        });
        expectOutInstructionContention({
          wasmMachine,
          oracleMachine,
          prefix: testCase.prefix,
          selectedBank: testCase.contendedTopBank,
          accumulator: testCase.contendedPortHighByte,
          operand: 0xff,
          expectedDelay: 4 * DELAY
        });
        expectOutInstructionContention({
          wasmMachine,
          oracleMachine,
          prefix: testCase.prefix,
          selectedBank: testCase.nonContendedTopBank,
          accumulator: 0x80,
          operand: 0xfe,
          expectedDelay: DELAY
        });
        expectOutInstructionContention({
          wasmMachine,
          oracleMachine,
          prefix: testCase.prefix,
          selectedBank: testCase.contendedTopBank,
          accumulator: testCase.contendedPortHighByte,
          operand: 0xfe,
          expectedDelay: 2 * DELAY
        });
      });
    }
  });
});

function contentionCases(): ContentionCase[] {
  const rom = testRom([]);
  return [
    {
      name: "ZX Spectrum 48K",
      createWasmMachine: () => createTestSp48WasmMachine(rom),
      createOracleMachine: () => createOracleSp48Machine(rom)
    },
    {
      name: "ZX Spectrum 128K",
      createWasmMachine: () => createTestSp128WasmMachine(rom, rom),
      createOracleMachine: () => createOracleSp128Machine(rom, rom)
    },
    {
      name: "ZX Spectrum +3E",
      createWasmMachine: () => createTestSpp3eWasmMachine([rom, rom, rom, rom]),
      createOracleMachine: () => createOracleSpp3eMachine([rom, rom, rom, rom])
    }
  ];
}

function findTact(machine: OracleMachine, predicate: (value: number) => boolean): number {
  for (let tact = 0; tact < machine.tactsInFrame; tact++) {
    if (predicate(machine.getContentionValueForTest(tact))) {
      return tact;
    }
  }
  throw new Error("Could not find a matching contention tact.");
}

function uniqueTacts(tacts: number[], tactsInFrame: number): number[] {
  return [...new Set(tacts.map(tact => ((tact % tactsInFrame) + tactsInFrame) % tactsInFrame))];
}

function expectDelayForAddress(
  wasmMachine: WasmMachine,
  oracleMachine: OracleMachine,
  tact: number,
  address: number,
  prefix: "sp48" | "sp128" | "spp3e"
): void {
  wasmMachine.setAbsoluteTacts(tact);
  oracleMachine.setFrameTact(tact);
  wasmMachine.resetContentionCounters();
  oracleMachine.resetContentionCounters();

  delayWasmAddressBusAccess(wasmMachine, address, prefix);
  oracleMachine.delayAddressBusAccess(address);

  expect(wasmMachine.getContentionDelayTotalForTest(), `${prefix} ${address.toString(16)}`).toBe(
    oracleMachine.getContentionDelayTotalForTest()
  );
}

function delayWasmAddressBusAccess(
  machine: WasmMachine,
  address: number,
  prefix: "sp48" | "sp128" | "spp3e"
): void {
  if (prefix === "sp128") {
    machine.delayAddressBusAccess(address);
    return;
  }
  const fn = (machine.wasmV2Runtime!.exports as Record<string, unknown>)[
    `${prefix}DelayAddressBusAccess`
  ];
  if (typeof fn !== "function") {
    throw new Error(`${prefix}DelayAddressBusAccess is not available.`);
  }
  (fn as (address: number) => void)(address & 0xffff);
  machine.getCpuState();
}

function cpuContentionCases(): Array<{
  name: string;
  prefix: "sp128" | "spp3e";
  createWasmMachine: () => Promise<TestSp128WasmMachine | TestSpp3eWasmMachine>;
  createOracleMachine: () => Promise<TestOracleSp128Machine | TestOracleSpp3eMachine>;
  contendedTopBank: number;
  nonContendedTopBank: number;
  contendedPortHighByte: number;
}> {
  return [
    {
      name: "ZX Spectrum 128K",
      prefix: "sp128",
      createWasmMachine: () => createTestSp128WasmMachine(testRom([]), testRom([])),
      createOracleMachine: () => createOracleSp128Machine(testRom([]), testRom([])),
      contendedTopBank: 3,
      nonContendedTopBank: 0,
      contendedPortHighByte: 0x40
    },
    {
      name: "ZX Spectrum +3E",
      prefix: "spp3e",
      createWasmMachine: () => createTestSpp3eWasmMachine([testRom([]), testRom([]), testRom([]), testRom([])]),
      createOracleMachine: () => createOracleSpp3eMachine([testRom([]), testRom([]), testRom([]), testRom([])]),
      contendedTopBank: 5,
      nonContendedTopBank: 2,
      contendedPortHighByte: 0xc0
    }
  ];
}

function expectOutInstructionContention(args: {
  wasmMachine: TestSp128WasmMachine | TestSpp3eWasmMachine;
  oracleMachine: TestOracleSp128Machine | TestOracleSpp3eMachine;
  prefix: "sp128" | "spp3e";
  selectedBank: number;
  accumulator: number;
  operand: number;
  expectedDelay: number;
}): void {
  args.wasmMachine.writeTestPort(0x7ffd, args.selectedBank);
  args.oracleMachine.writeTestPort(0x7ffd, args.selectedBank);
  expectInstructionContention({
    wasmMachine: args.wasmMachine,
    oracleMachine: args.oracleMachine,
    prefix: args.prefix,
    code: [0xd3, args.operand],
    startAddress: 0x8000,
    registers: { af: args.accumulator << 8 },
    expectedDelay: args.expectedDelay
  });
}

function expectInstructionContention(args: {
  wasmMachine: TestSp128WasmMachine | TestSpp3eWasmMachine;
  oracleMachine: TestOracleSp128Machine | TestOracleSpp3eMachine;
  prefix: "sp128" | "spp3e";
  code: number[];
  startAddress: number;
  registers?: { af?: number };
  expectedDelay: number;
}): void {
  args.wasmMachine.initCode(args.code, args.startAddress);
  args.oracleMachine.initCode(args.code, args.startAddress);
  prepCpuContention(args.wasmMachine, args.oracleMachine);
  args.wasmMachine.setTestCpuRegisters({
    pc: args.startAddress,
    sp: 0xffff,
    af: args.registers?.af ?? 0
  });
  args.oracleMachine.setTestCpuRegisters({
    pc: args.startAddress,
    sp: 0xffff,
    af: args.registers?.af ?? 0,
    ir: 0
  });

  const wasmBefore = args.wasmMachine.getTestCpuRegisters().tacts;
  const oracleBefore = args.oracleMachine.getTestCpuRegisters().tacts;

  args.wasmMachine.executeOne();
  args.oracleMachine.executeOne();

  const wasmTactsUsed = args.wasmMachine.getTestCpuRegisters().tacts - wasmBefore;
  const oracleTactsUsed = args.oracleMachine.getTestCpuRegisters().tacts - oracleBefore;
  expect(wasmTactsUsed, args.prefix).toBe(oracleTactsUsed);
  expect(args.wasmMachine.getContentionDelayTotalForTest(), args.prefix).toBe(
    args.oracleMachine.getContentionDelayTotalForTest()
  );
  expect(args.wasmMachine.getContentionDelayTotalForTest(), args.prefix).toBe(args.expectedDelay);
}

function prepCpuContention(
  wasmMachine: TestSp128WasmMachine | TestSpp3eWasmMachine,
  oracleMachine: TestOracleSp128Machine | TestOracleSpp3eMachine
): void {
  wasmMachine.setContentionRange(START_TACT, CONTENTION_RANGE, DELAY);
  oracleMachine.setContentionRange(START_TACT, CONTENTION_RANGE, DELAY);
  wasmMachine.setAbsoluteTacts(START_TACT);
  oracleMachine.setFrameTact(START_TACT);
  wasmMachine.resetContentionCounters();
  oracleMachine.resetContentionCounters();
}
