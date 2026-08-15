import { describe, expect, it } from "vitest";

import {
  createOracleSp128Machine,
  createOracleSp48Machine,
  createOracleSpp3eMachine,
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine,
  expectSameMemoryReads,
  expectSamePartitions,
  testRom,
  type TestCpuRegisters
} from "./wasm-test-helpers";

describe("ZX Spectrum WASM test control surface", () => {
  it("executes exactly one WASM instruction and matches the TypeScript oracle", async () => {
    const program = [0x32, 0x00, 0x40, 0x00];
    const initialCpu: TestCpuRegisters = {
      af: 0x5a00,
      pc: 0x0000,
      sp: 0xffff,
      tacts: 0
    };
    const cases = [
      {
        name: "ZX Spectrum 48K",
        createWasm: () => createTestSp48WasmMachine(testRom(program)),
        createOracle: () => createOracleSp48Machine(testRom(program))
      },
      {
        name: "ZX Spectrum 128K",
        createWasm: () => createTestSp128WasmMachine(testRom(program), testRom([])),
        createOracle: () => createOracleSp128Machine(testRom(program), testRom([]))
      },
      {
        name: "ZX Spectrum +3E",
        createWasm: () => createTestSpp3eWasmMachine([testRom(program), testRom([]), testRom([]), testRom([])]),
        createOracle: () => createOracleSpp3eMachine([testRom(program), testRom([]), testRom([]), testRom([])])
      }
    ];

    for (const testCase of cases) {
      const wasmMachine = await testCase.createWasm();
      const oracleMachine = await testCase.createOracle();

      wasmMachine.setTestCpuRegisters(initialCpu);
      oracleMachine.setTestCpuRegisters(initialCpu);

      wasmMachine.executeOne();
      oracleMachine.executeOne();

      const wasmCpu = wasmMachine.getTestCpuRegisters();
      const oracleCpu = oracleMachine.getTestCpuRegisters();
      expect(wasmCpu.pc, `${testCase.name} PC`).toBe(oracleCpu.pc);
      expect(wasmCpu.tacts, `${testCase.name} tacts`).toBe(oracleCpu.tacts);
      expectSameMemoryReads(wasmMachine, oracleMachine, [0x4000]);
      expect(wasmMachine.readTestMemory(0x4000), testCase.name).toBe(0x5a);
    }
  });

  it("exposes paging and contention controls through test helpers", async () => {
    const sp128 = await createTestSp128WasmMachine(testRom([]), testRom([]));
    const sp128Oracle = await createOracleSp128Machine(testRom([]), testRom([]));
    sp128.writeTestPort(0x7ffd, 0x1b);
    sp128Oracle.writeTestPort(0x7ffd, 0x1b);
    expectSamePartitions(sp128, sp128Oracle);
    expect(sp128.getTestPagingState()).toMatchObject({
      selectedRomPage: 1,
      selectedRamBank: 3,
      pagingEnabled: true,
      useShadowScreen: true
    });

    sp128.setAbsoluteTacts(14362);
    sp128.resetContentionCounters();
    sp128.setContentionRange(14362, 1, 6);
    sp128.delayAddressBusAccess(0x4000);
    expect(sp128.getCurrentFrameTactForTest()).toBe(14368);
    expect(sp128.getContentionDelayTotalForTest()).toBe(6);
    expect(sp128.getContentionValueForTest(14362)).toBe(6);

    const spp3e = await createTestSpp3eWasmMachine([testRom([]), testRom([]), testRom([]), testRom([])]);
    spp3e.writeTestPort(0x1ffd, 0x09);
    expect(spp3e.getTestPagingState()).toMatchObject({
      inSpecialPagingMode: true,
      specialConfigMode: 0,
      diskMotorOn: true,
      fdcCurrentDrive: 0,
      fdcOperationPhase: 0
    });
  });
});
