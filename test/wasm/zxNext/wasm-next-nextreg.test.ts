import { describe, expect, it } from "vitest";

import { TestZxNextMachine } from "../../zxnext/TestNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createZxNextOracleHarness } from "./wasm-next-test-helpers";

type NextRegMachine = TestZxNextMachine | ZxNextWasmV2Machine;

const RESET_NEXT_REGS = [
  0x00,
  0x01,
  0x0e,
  0x12,
  0x13,
  0x14,
  0x15,
  0x42,
  0x4b,
  0x4c,
  0x50,
  0x51,
  0x52,
  0x53,
  0x54,
  0x55,
  0x56,
  0x57,
  0x82,
  0x83,
  0x84,
  0x85,
  0x8c,
  0x8e
];

describe("ZX Spectrum Next WASM NextReg core parity", () => {
  it("matches TypeScript hard-reset NextReg defaults used by memory and ports", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    hardResetBoth(oracle, wasm);

    for (const reg of RESET_NEXT_REGS) {
      expect(readNextReg(wasm, reg), `reg $${hex(reg)}`).toBe(readNextReg(oracle, reg));
    }
    expect(wasm.nextRegDevice.getNextRegDeviceState().lastRegisterIndex).toBe(
      oracle.nextRegDevice.getNextRegDeviceState().lastRegisterIndex
    );
    expect(wasm.getCurrentPartitions()).toEqual(oracle.getCurrentPartitions());
    expect(wasm.getCurrentPartitionLabels()).toEqual(oracle.getCurrentPartitionLabels());
  });

  it("matches TypeScript NextReg select/data port side effects", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    hardResetBoth(oracle, wasm);

    for (const machine of [oracle, wasm]) {
      machine.doWritePort(0x243b, 0x50);
      machine.doWritePort(0x253b, 0x04);
    }
    const oracleRead = oracle.doReadPort(0x253b);
    const wasmRead = wasm.doReadPort(0x253b);

    expect(wasmRead).toBe(oracleRead);
    expect(readNextReg(wasm, 0x50)).toBe(readNextReg(oracle, 0x50));
    expect(wasm.getCurrentPartitions()).toEqual(oracle.getCurrentPartitions());
    expect(wasm.getCurrentPartitionLabels()).toEqual(oracle.getCurrentPartitionLabels());
    expect(wasm.lastIoReadPort).toBe(0x253b);
    expect(wasm.lastIoReadValue).toBe(wasmRead);
  });

  it("matches TypeScript memory-affecting NextReg writes", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    hardResetBoth(oracle, wasm);

    for (const machine of [oracle, wasm]) {
      writeNextReg(machine, 0x8e, 0x8f);
      writeNextReg(machine, 0x8c, 0x90);
    }

    for (const reg of [0x56, 0x57, 0x8c, 0x8e]) {
      expect(readNextReg(wasm, reg), `reg $${hex(reg)}`).toBe(readNextReg(oracle, reg));
    }
    expect(wasm.getSelectedRomPage()).toBe(oracle.getSelectedRomPage());
    expect(wasm.getSelectedRamBank()).toBe(oracle.getSelectedRamBank());
    expect(wasm.getCurrentPartitionLabels()).toEqual(oracle.getCurrentPartitionLabels());
  });
});

function hardResetBoth(oracle: TestZxNextMachine, wasm: ZxNextWasmV2Machine): void {
  oracle.hardReset();
  wasm.hardReset();
}

function writeNextReg(machine: NextRegMachine, reg: number, value: number): void {
  machine.nextRegDevice.setNextRegisterIndex(reg);
  machine.nextRegDevice.setNextRegisterValue(value);
}

function readNextReg(machine: NextRegMachine, reg: number): number {
  machine.nextRegDevice.setNextRegisterIndex(reg);
  return machine.nextRegDevice.getNextRegisterValue();
}

function hex(value: number): string {
  return value.toString(16).padStart(2, "0");
}
