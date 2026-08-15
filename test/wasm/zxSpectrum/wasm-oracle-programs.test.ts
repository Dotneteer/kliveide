import { describe, expect, it } from "vitest";

import {
  createOracleSp128Machine,
  createOracleSp48Machine,
  createOracleSpp3eMachine,
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine,
  expectSameMemoryReads,
  testRom,
  type TestOracleSp128Machine,
  type TestOracleSp48Machine,
  type TestOracleSpp3eMachine,
  type TestSp128WasmMachine,
  type TestSp48WasmMachine,
  type TestSpp3eWasmMachine
} from "./wasm-test-helpers";

type Prefix = "sp48" | "sp128" | "spp3e";
type WasmMachine = TestSp48WasmMachine | TestSp128WasmMachine | TestSpp3eWasmMachine;
type OracleMachine = TestOracleSp48Machine | TestOracleSp128Machine | TestOracleSpp3eMachine;

type ProgramCase = {
  name: string;
  prefix: Prefix;
  createWasmMachine: (rom: Uint8Array) => Promise<WasmMachine>;
  createOracleMachine: (rom: Uint8Array) => Promise<OracleMachine>;
};

describe("ZX Spectrum WASM cross-backend oracle programs", () => {
  for (const testCase of programCases()) {
    it(`${testCase.name} writes screen memory like the TypeScript oracle`, async () => {
      const program = [
        0x3e, 0xff,             // LD A,ff
        0x32, 0x00, 0x40,       // LD (4000),A
        0x3e, 0x47,             // LD A,47
        0x32, 0x00, 0x58        // LD (5800),A
      ];
      const wasmMachine = await testCase.createWasmMachine(testRom(program));
      const oracleMachine = await testCase.createOracleMachine(testRom(program));

      executeBoth(wasmMachine, oracleMachine, 4);

      expectCpuSubset(wasmMachine, oracleMachine);
      expectSameMemoryReads(wasmMachine, oracleMachine, [0x4000, 0x5800]);
      expect(wasmMachine.readScreenMemory(0x0000)).toBe(oracleMachine.readScreenMemory(0x0000));
    });

    it(`${testCase.name} reads keyboard state into RAM like the TypeScript oracle`, async () => {
      const program = [
        0x3e, 0xfe,             // LD A,fe
        0xdb, 0xfe,             // IN A,(fe)
        0x32, 0x00, 0x40        // LD (4000),A
      ];
      const wasmMachine = await testCase.createWasmMachine(testRom(program));
      const oracleMachine = await testCase.createOracleMachine(testRom(program));

      wasmMachine.keyboardDevice.setKeyStatus(0, true);
      oracleMachine.keyboardDevice.setKeyStatus(0, true);
      callWasmExport(wasmMachine, `${testCase.prefix}SetKeyStatus`)(0, 1);

      executeBoth(wasmMachine, oracleMachine, 3);

      expectCpuSubset(wasmMachine, oracleMachine);
      expectSameMemoryReads(wasmMachine, oracleMachine, [0x4000]);
      expect(wasmMachine.readTestMemory(0x4000)).toBe(0xbe);
    });

    it(`${testCase.name} updates ULA border and beeper port state like the TypeScript oracle`, async () => {
      const program = [
        0x3e, 0x1d,             // LD A,1d
        0xd3, 0xfe              // OUT (fe),A
      ];
      const wasmMachine = await testCase.createWasmMachine(testRom(program));
      const oracleMachine = await testCase.createOracleMachine(testRom(program));

      executeBoth(wasmMachine, oracleMachine, 2);

      expectCpuSubset(wasmMachine, oracleMachine);
      expect(callWasmExport(wasmMachine, `${testCase.prefix}GetBorderColor`)()).toBe(
        oracleMachine.screenDevice.borderColor
      );
      expect(callWasmExport(wasmMachine, `${testCase.prefix}GetLastPortAddress`)()).toBe(0x1dfe);
      expect(callWasmExport(wasmMachine, `${testCase.prefix}GetLastPortValue`)()).toBe(0x1d);
      expect(callWasmExport(wasmMachine, `${testCase.prefix}GetLastPortIsWrite`)()).toBe(1);
    });
  }

  it("128K pages RAM and reads/writes the selected bank like the TypeScript oracle", async () => {
    const program = [
      0x01, 0xfd, 0x7f,       // LD BC,7ffd
      0x3e, 0x03,             // LD A,03
      0xed, 0x79,             // OUT (C),A
      0x3e, 0x9a,             // LD A,9a
      0x32, 0x10, 0xc0,       // LD (c010),A
      0x3a, 0x10, 0xc0        // LD A,(c010)
    ];
    const rom = testRom(program);
    const wasmMachine = await createTestSp128WasmMachine(rom, testRom([]));
    const oracleMachine = await createOracleSp128Machine(rom, testRom([]));

    executeBoth(wasmMachine, oracleMachine, 6);

    expectCpuSubset(wasmMachine, oracleMachine);
    expect(wasmMachine.getTestPagingState()).toMatchObject(oracleMachine.getTestPagingState());
    expect(wasmMachine.getSelectedRamBank()).toBe(3);
    expect(wasmMachine.getMemoryPartition(3)[0x0010]).toBe(0x9a);
    expect(oracleMachine.getMemoryPartition(3)[0x0010]).toBe(0x9a);
  });

  it("+3E special paging reads/writes the mapped bank like the TypeScript oracle", async () => {
    const roms = [testRom([0x00]), testRom([]), testRom([]), testRom([])];
    const wasmMachine = await createTestSpp3eWasmMachine(roms);
    const oracleMachine = await createOracleSpp3eMachine(roms);

    wasmMachine.writeTestPort(0x1ffd, 0x0f);
    oracleMachine.writeTestPort(0x1ffd, 0x0f);
    wasmMachine.initCode([
      0x3e, 0x6c,             // LD A,6c
      0x32, 0x20, 0x40,       // LD (4020),A; special mode 3 maps this to bank 7
      0x3a, 0x20, 0x40        // LD A,(4020)
    ], 0x0000);
    oracleMachine.initCode([
      0x3e, 0x6c,
      0x32, 0x20, 0x40,
      0x3a, 0x20, 0x40
    ], 0x0000);

    executeBoth(wasmMachine, oracleMachine, 3);

    expectCpuSubset(wasmMachine, oracleMachine);
    expect(wasmMachine.getTestPagingState()).toMatchObject(oracleMachine.getTestPagingState());
    expect(wasmMachine.readTestMemory(0x4020)).toBe(0x6c);
    expect(oracleMachine.readTestMemory(0x4020)).toBe(0x6c);
  });

  for (const testCase of psgProgramCases()) {
    it(`${testCase.name} applies PSG register writes like the TypeScript oracle`, async () => {
      const program = [
        0x01, 0xfd, 0xff,       // LD BC,fffd
        0x3e, 0x08,             // LD A,08
        0xed, 0x79,             // OUT (C),A; select PSG register 8
        0x01, 0xfd, 0xbf,       // LD BC,bffd
        0x3e, 0x0f,             // LD A,0f
        0xed, 0x79              // OUT (C),A; write register value
      ];
      const wasmMachine = await testCase.createWasmMachine(testRom(program));
      const oracleMachine = await testCase.createOracleMachine(testRom(program));

      executeBoth(wasmMachine, oracleMachine, 6);

      expectCpuSubset(wasmMachine, oracleMachine);
      expect(callWasmExport(wasmMachine, `${testCase.prefix}GetPsgRegisterIndex`)()).toBe(8);
      expect(callWasmExport(wasmMachine, `${testCase.prefix}GetPsgRegisterValue`)(8)).toBe(
        oracleMachine.psgDevice.getPsgState().regValues[8]
      );
    });
  }
});

function programCases(): ProgramCase[] {
  return [
    {
      name: "ZX Spectrum 48K",
      prefix: "sp48",
      createWasmMachine: rom => createTestSp48WasmMachine(rom),
      createOracleMachine: rom => createOracleSp48Machine(rom)
    },
    {
      name: "ZX Spectrum 128K",
      prefix: "sp128",
      createWasmMachine: rom => createTestSp128WasmMachine(rom, testRom([])),
      createOracleMachine: rom => createOracleSp128Machine(rom, testRom([]))
    },
    {
      name: "ZX Spectrum +3E",
      prefix: "spp3e",
      createWasmMachine: rom => createTestSpp3eWasmMachine([rom, testRom([]), testRom([]), testRom([])]),
      createOracleMachine: rom => createOracleSpp3eMachine([rom, testRom([]), testRom([]), testRom([])])
    }
  ];
}

function psgProgramCases(): Array<ProgramCase & {
  prefix: "sp128" | "spp3e";
  createWasmMachine: (rom: Uint8Array) => Promise<TestSp128WasmMachine | TestSpp3eWasmMachine>;
  createOracleMachine: (rom: Uint8Array) => Promise<TestOracleSp128Machine | TestOracleSpp3eMachine>;
}> {
  return [
    {
      name: "ZX Spectrum 128K",
      prefix: "sp128",
      createWasmMachine: rom => createTestSp128WasmMachine(rom, testRom([])),
      createOracleMachine: rom => createOracleSp128Machine(rom, testRom([]))
    },
    {
      name: "ZX Spectrum +3E",
      prefix: "spp3e",
      createWasmMachine: rom => createTestSpp3eWasmMachine([rom, testRom([]), testRom([]), testRom([])]),
      createOracleMachine: rom => createOracleSpp3eMachine([rom, testRom([]), testRom([]), testRom([])])
    }
  ];
}

function executeBoth(wasmMachine: WasmMachine, oracleMachine: OracleMachine, instructionCount: number): void {
  for (let i = 0; i < instructionCount; i++) {
    wasmMachine.executeOne();
    oracleMachine.executeOne();
  }
}

function expectCpuSubset(wasmMachine: WasmMachine, oracleMachine: OracleMachine): void {
  const wasm = wasmMachine.getTestCpuRegisters();
  const oracle = oracleMachine.getTestCpuRegisters();
  expect(wasm.pc).toBe(oracle.pc);
  expect(wasm.sp).toBe(oracle.sp);
  expect(wasm.af >> 8).toBe(oracle.af >> 8);
  expect(wasm.bc).toBe(oracle.bc);
  expect(wasm.de).toBe(oracle.de);
  expect(wasm.hl).toBe(oracle.hl);
  if (Number.isFinite(wasm.tacts) && Number.isFinite(oracle.tacts)) {
    expect(wasm.tacts).toBe(oracle.tacts);
  }
}

function callWasmExport(machine: WasmMachine, name: string): (...args: number[]) => number {
  const fn = (machine.wasmV2Runtime?.exports as Record<string, unknown> | undefined)?.[name];
  if (typeof fn !== "function") {
    throw new Error(`WASM export '${name}' is not available.`);
  }
  return fn as (...args: number[]) => number;
}
