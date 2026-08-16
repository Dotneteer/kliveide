import { describe, expect, it } from "vitest";

import {
  createOracleZxNextMachine,
  createTestZxNextRomSet,
  createTestZxNextWasmMachine,
  initCodeBytes,
  testRom
} from "./wasm-next-test-helpers";

describe("ZX Spectrum Next WASM test helpers", () => {
  it("creates TypeScript oracle and WASM machines with deterministic ROM bytes", async () => {
    const romSet = createTestZxNextRomSet({
      next: testRom([0x3e, 0x42], 0x10000),
      divMmc: testRom([0xd1], 0x4000),
      multiface: testRom([0xf1], 0x4000),
      alt: testRom([0xa1], 0x8000)
    });

    const wasmMachine = await createTestZxNextWasmMachine(romSet);
    const oracleMachine = await createOracleZxNextMachine(romSet);

    expect(wasmMachine.implementation).toBe("wasm");
    expect(wasmMachine.wasmV2Runtime?.exports.zxnextReadRomByte(0, 0)).toBe(0x3e);
    expect(oracleMachine.memoryDevice.memory[0]).toBe(0x3e);

    initCodeBytes(wasmMachine, [0x00], 0x8000);
    initCodeBytes(oracleMachine, [0x00], 0x8000);

    expect(wasmMachine.getTestCpuRegisters().pc).toBe(0x8000);
    expect(oracleMachine.getTestCpuRegisters().pc).toBe(0x8000);
  });
});
