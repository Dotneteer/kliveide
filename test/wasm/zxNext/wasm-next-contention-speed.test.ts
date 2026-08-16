import { describe, expect, it } from "vitest";

import {
  createOracleZxNextMachine,
  createTestZxNextWasmMachine,
  executeOneInstruction,
  initCodeBytes
} from "./wasm-next-test-helpers";

describe("ZX Spectrum Next WASM v2 contention and CPU speed", () => {
  it("matches TypeScript CPU speed NextReg values and diagnostics", async () => {
    const wasmMachine = await createTestZxNextWasmMachine();
    const oracleMachine = await createOracleZxNextMachine();

    for (const speed of [0, 1, 2, 3]) {
      wasmMachine.nextRegDevice.directSetRegValue(0x07, speed);
      oracleMachine.nextRegDevice.directSetRegValue(0x07, speed);

      const expectedValue = oracleMachine.nextRegDevice.directGetRegValue(0x07);
      expect(wasmMachine.nextRegDevice.directGetRegValue(0x07)).toBe(expectedValue);
      expect(wasmMachine.getWasmV2Diagnostics()).toMatchObject({
        cpuProgrammedSpeed: speed,
        cpuEffectiveSpeed: speed,
        cpuEffectiveClockMultiplier: 1 << speed,
        cpuTactScale: 8 >> speed
      });
    }
  });

  it("preserves CPU speed across soft reset and clears it on hard reset", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.nextRegDevice.directSetRegValue(0x07, 0x03);
    machine.reset();
    expect(machine.nextRegDevice.directGetRegValue(0x07)).toBe(0x33);
    expect(machine.getWasmV2Diagnostics().cpuEffectiveSpeed).toBe(3);

    machine.hardReset();
    expect(machine.nextRegDevice.directGetRegValue(0x07)).toBe(0x00);
    expect(machine.getWasmV2Diagnostics().cpuEffectiveSpeed).toBe(0);
  });

  it("matches TypeScript CPU tacts for memory reads across CPU speeds", async () => {
    for (const speed of [0, 1, 2, 3]) {
      const { wasmMachine, oracleMachine } = await createMemoryReadPair();
      wasmMachine.nextRegDevice.directSetRegValue(0x07, speed);
      oracleMachine.nextRegDevice.directSetRegValue(0x07, speed);

      executeOneInstruction(wasmMachine);
      executeOneInstruction(oracleMachine);

      expect(wasmMachine.getCpuState().tacts).toBe(oracleMachine.getCpuState().tacts);
      expect(wasmMachine.getCpuState().af).toBe(oracleMachine.getCpuState().af);
    }
  });

  it("matches the 28 MHz bank-7 read wait-state exception", async () => {
    const regular = await createMemoryReadPair(0x9000);
    regular.wasmMachine.nextRegDevice.directSetRegValue(0x07, 0x03);
    regular.oracleMachine.nextRegDevice.directSetRegValue(0x07, 0x03);
    executeOneInstruction(regular.wasmMachine);
    executeOneInstruction(regular.oracleMachine);

    const bank7 = await createMemoryReadPair(0xc000);
    bank7.wasmMachine.nextRegDevice.directSetRegValue(0x56, 0x0e);
    bank7.oracleMachine.nextRegDevice.directSetRegValue(0x56, 0x0e);
    bank7.wasmMachine.nextRegDevice.directSetRegValue(0x07, 0x03);
    bank7.oracleMachine.nextRegDevice.directSetRegValue(0x07, 0x03);
    executeOneInstruction(bank7.wasmMachine);
    executeOneInstruction(bank7.oracleMachine);

    expect(regular.wasmMachine.getCpuState().tacts).toBe(regular.oracleMachine.getCpuState().tacts);
    expect(bank7.wasmMachine.getCpuState().tacts).toBe(bank7.oracleMachine.getCpuState().tacts);
    expect(regular.wasmMachine.getCpuState().tacts - bank7.wasmMachine.getCpuState().tacts).toBe(1);
    expect(regular.wasmMachine.getWasmV2Diagnostics().cpuContentionDelaySinceStart).toBe(2);
    expect(bank7.wasmMachine.getWasmV2Diagnostics().cpuContentionDelaySinceStart).toBe(1);
  });
});

async function createMemoryReadPair(address = 0x9000): Promise<{
  wasmMachine: Awaited<ReturnType<typeof createTestZxNextWasmMachine>>;
  oracleMachine: Awaited<ReturnType<typeof createOracleZxNextMachine>>;
}> {
  const wasmMachine = await createTestZxNextWasmMachine();
  const oracleMachine = await createOracleZxNextMachine();
  initCodeBytes(wasmMachine, [0x7e], 0x8000);
  initCodeBytes(oracleMachine, [0x7e], 0x8000);
  wasmMachine.doWriteMemory(address, 0xa5);
  oracleMachine.doWriteMemory(address, 0xa5);
  wasmMachine.setTestCpuRegisters({ hl: address });
  oracleMachine.setTestCpuRegisters({ hl: address });
  return { wasmMachine, oracleMachine };
}
