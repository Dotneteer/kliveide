import { describe, expect, it } from "vitest";

import { TestZxNextMachine } from "../../zxnext/TestNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createZxNextOracleHarness } from "./wasm-next-test-helpers";

type PortMachine = TestZxNextMachine | ZxNextWasmV2Machine;

describe("ZX Spectrum Next WASM port core parity", () => {
  it("matches TypeScript 0x7ffd paging writes and lock behavior", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    hardResetBoth(oracle, wasm);

    for (const machine of [oracle, wasm]) machine.doWritePort(0x7ffd, 0x13);

    expectSameMemoryPortState(wasm, oracle);
    expectSameNextRegs(wasm, oracle, [0x56, 0x57, 0x8e]);
    expectWasmLastWrite(wasm, 0x7ffd, 0x13);

    for (const machine of [oracle, wasm]) {
      machine.doWritePort(0x7ffd, 0x3f);
      machine.doWritePort(0x7ffd, 0x00);
      machine.doWritePort(0x7ffd, 0x10);
    }

    expectSameMemoryPortState(wasm, oracle);
    expectSameNextRegs(wasm, oracle, [0x56, 0x57, 0x8e]);
  });

  it("matches TypeScript 0xdffd RAM bank extension writes", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    hardResetBoth(oracle, wasm);

    for (const machine of [oracle, wasm]) {
      machine.doWritePort(0x7ffd, 0x05);
      machine.doWritePort(0xdffd, 0x01);
    }

    expectSameMemoryPortState(wasm, oracle);
    expectSameNextRegs(wasm, oracle, [0x56, 0x57, 0x8e]);
    expectWasmLastWrite(wasm, 0xdffd, 0x01);
  });

  it("matches TypeScript 0x1ffd all-RAM and ROM MSB writes", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    hardResetBoth(oracle, wasm);

    for (const machine of [oracle, wasm]) machine.doWritePort(0x1ffd, 0x05);

    expectSameMemoryPortState(wasm, oracle);
    expectSameNextRegs(wasm, oracle, [0x50, 0x51, 0x52, 0x53, 0x56, 0x57, 0x8e]);
    expectWasmLastWrite(wasm, 0x1ffd, 0x05);
  });

  it("matches TypeScript NR $82 gating for paging ports", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    hardResetBoth(oracle, wasm);

    for (const machine of [oracle, wasm]) {
      writeNextReg(machine, 0x82, 0xf1);
      machine.doWritePort(0x7ffd, 0x07);
      machine.doWritePort(0xdffd, 0x01);
      machine.doWritePort(0x1ffd, 0x05);
    }

    expectSameMemoryPortState(wasm, oracle);
    expectSameNextRegs(wasm, oracle, [0x56, 0x57, 0x82, 0x8e]);
    expectWasmLastWrite(wasm, 0x1ffd, 0x05);
  });

  it("matches TypeScript ULA port side effects and read value", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    hardResetBoth(oracle, wasm);

    for (const machine of [oracle, wasm]) machine.doWritePort(0x00fe, 0x18);
    const oracleRead = oracle.doReadPort(0x00fe);
    const wasmRead = wasm.doReadPort(0x00fe);

    expect(wasmRead).toBe(oracleRead);
    expect(wasm.getWasmV2UlaState().bor).toBe(oracle.composedScreenDevice.borderColor);
    expect(wasm.getWasmV2UlaState().ear).toBe(true);
    expect(wasm.getWasmV2UlaState().mic).toBe(true);
    expect(wasm.lastIoReadPort).toBe(0x00fe);
    expect(wasm.lastIoReadValue).toBe(wasmRead);
  });

  it("matches TypeScript AY register, data, and info port reads", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    hardResetBoth(oracle, wasm);

    for (const machine of [oracle, wasm]) {
      machine.doWritePort(0xfffd, 0x01);
      machine.doWritePort(0xbffd, 0xa5);
    }

    for (const port of [0xfffd, 0xbffd, 0xbff5]) {
      expect(wasm.doReadPort(port)).toBe(oracle.doReadPort(port));
    }
  });

  it("matches TypeScript floating/open-port read behavior separately from handled ports", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    hardResetBoth(oracle, wasm);

    const oracleRead = oracle.doReadPort(0xffff);
    const wasmRead = wasm.doReadPort(0xffff);

    expect(wasmRead).toBe(oracleRead);
    expect(wasm.lastIoReadPort).toBe(0xffff);
    expect(wasm.lastIoReadValue).toBe(wasmRead);
  });
});

function hardResetBoth(oracle: TestZxNextMachine, wasm: ZxNextWasmV2Machine): void {
  oracle.hardReset();
  wasm.hardReset();
}

function writeNextReg(machine: PortMachine, reg: number, value: number): void {
  machine.nextRegDevice.setNextRegisterIndex(reg);
  machine.nextRegDevice.setNextRegisterValue(value);
}

function readNextReg(machine: PortMachine, reg: number): number {
  machine.nextRegDevice.setNextRegisterIndex(reg);
  return machine.nextRegDevice.getNextRegisterValue();
}

function expectSameNextRegs(wasm: ZxNextWasmV2Machine, oracle: TestZxNextMachine, regs: number[]): void {
  for (const reg of regs) {
    expect(readNextReg(wasm, reg), `reg $${reg.toString(16)}`).toBe(readNextReg(oracle, reg));
  }
}

function expectSameMemoryPortState(wasm: ZxNextWasmV2Machine, oracle: TestZxNextMachine): void {
  expect(wasm.getSelectedRomPage()).toBe(oracle.getSelectedRomPage());
  expect(wasm.getSelectedRamBank()).toBe(oracle.getSelectedRamBank());
  expect(wasm.getCurrentPartitions()).toEqual(oracle.getCurrentPartitions());
  expect(wasm.getCurrentPartitionLabels()).toEqual(oracle.getCurrentPartitionLabels());
}

function expectWasmLastWrite(wasm: ZxNextWasmV2Machine, port: number, value: number): void {
  expect(wasm.lastIoWritePort).toBe(port);
  expect(wasm.lastIoWriteValue).toBe(value);
}
