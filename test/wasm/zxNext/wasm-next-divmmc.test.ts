import { describe, expect, it } from "vitest";

import { TestZxNextMachine } from "../../zxnext/TestNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createZxNextOracleHarness } from "./wasm-next-test-helpers";

const OFFS_DIVMMC_ROM = 0x010000;
const OFFS_DIVMMC_RAM = 0x020000;
const OFFS_NEXT_ROM = 0x000000;

describe("ZX Spectrum Next WASM DivMMC parity", () => {
  it("matches TypeScript control port state, MAPRAM latch, and memory-map side effects", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.hardReset();
    wasm.hardReset();

    seedPhysical(oracle, wasm, OFFS_NEXT_ROM, 0x11);
    seedPhysical(oracle, wasm, OFFS_DIVMMC_ROM, 0xd1);
    seedPhysical(oracle, wasm, OFFS_DIVMMC_RAM + 2 * 0x2000, 0xd2);
    seedPhysical(oracle, wasm, OFFS_DIVMMC_RAM + 3 * 0x2000, 0xd3);

    for (const machine of [oracle, wasm]) {
      machine.doWritePort(0xe3, 0x82);
    }
    expectDivMmcState(wasm, oracle);
    expect(wasm.doReadMemory(0x0000)).toBe(oracle.doReadMemory(0x0000));
    expect(wasm.doReadMemory(0x0000)).toBe(0xd1);
    expect(wasm.doReadMemory(0x2000)).toBe(oracle.doReadMemory(0x2000));
    expect(wasm.doReadMemory(0x2000)).toBe(0xd2);

    for (const machine of [oracle, wasm]) {
      machine.doWritePort(0xe3, 0xc2);
    }
    expectDivMmcState(wasm, oracle);
    expect(wasm.doReadMemory(0x0000)).toBe(oracle.doReadMemory(0x0000));
    expect(wasm.doReadMemory(0x0000)).toBe(0xd3);

    for (const machine of [oracle, wasm]) {
      machine.tbblueOut(0x09, 0x08);
      machine.doWritePort(0xe3, 0x82);
    }
    expectDivMmcState(wasm, oracle);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetDivMmcMapram()).toBe(0);
  });

  it("matches TypeScript delayed automap entry, 1ff8 delayed exit, and RETN exit", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.hardReset();
    wasm.hardReset();

    for (const machine of [oracle, wasm]) {
      machine.tbblueOut(0x0a, 0x11);
      machine.pc = 0x0000;
    }

    oracle.divMmcDevice.beforeOpcodeFetch();
    wasm.wasmV2Runtime!.exports.zxnextDivMmcBeforeFetch(0x0000);
    expectDivMmcState(wasm, oracle);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetDivMmcRequestAutomapOn()).toBe(1);

    oracle.divMmcDevice.afterOpcodeFetch();
    wasm.wasmV2Runtime!.exports.zxnextDivMmcAfterFetch(0, 0);
    expectDivMmcState(wasm, oracle);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetDivMmcAutoMapActive()).toBe(1);

    oracle.pc = 0x1ff8;
    oracle.divMmcDevice.beforeOpcodeFetch();
    wasm.wasmV2Runtime!.exports.zxnextDivMmcBeforeFetch(0x1ff8);
    expectDivMmcState(wasm, oracle);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetDivMmcRequestAutomapOff()).toBe(1);

    oracle.divMmcDevice.afterOpcodeFetch();
    wasm.wasmV2Runtime!.exports.zxnextDivMmcAfterFetch(0, 0);
    expectDivMmcState(wasm, oracle);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetDivMmcAutoMapActive()).toBe(0);

    oracle.pc = 0x0000;
    oracle.divMmcDevice.beforeOpcodeFetch();
    oracle.divMmcDevice.afterOpcodeFetch();
    wasm.wasmV2Runtime!.exports.zxnextDivMmcBeforeFetch(0x0000);
    wasm.wasmV2Runtime!.exports.zxnextDivMmcAfterFetch(0, 0);
    oracle.divMmcDevice.handleRetnExecution();
    wasm.wasmV2Runtime!.exports.zxnextDivMmcAfterFetch(1, 0);
    expectDivMmcState(wasm, oracle);
  });
});

function expectDivMmcState(wasm: ZxNextWasmV2Machine, oracle: TestZxNextMachine): void {
  const exports = wasm.wasmV2Runtime!.exports;
  expect(exports.zxnextGetDivMmcPortE3Value()).toBe(oracle.divMmcDevice.port0xe3Value);
  expect(exports.zxnextGetDivMmcEnabled()).toBe(oracle.divMmcDevice.enabled ? 1 : 0);
  expect(exports.zxnextGetDivMmcEnableAutomap()).toBe(oracle.divMmcDevice.enableAutomap ? 1 : 0);
  expect(exports.zxnextGetDivMmcConmem()).toBe(oracle.divMmcDevice.conmem ? 1 : 0);
  expect(exports.zxnextGetDivMmcMapram()).toBe(oracle.divMmcDevice.mapram ? 1 : 0);
  expect(exports.zxnextGetDivMmcBank()).toBe(oracle.divMmcDevice.bank);
  expect(exports.zxnextGetDivMmcAutoMapActive()).toBe(oracle.divMmcDevice.autoMapActive ? 1 : 0);
  expect(exports.zxnextGetDivMmcNmiHold()).toBe(oracle.divMmcDevice.divMmcNmiHold ? 1 : 0);
}

function seedPhysical(
  oracle: TestZxNextMachine,
  wasm: ZxNextWasmV2Machine,
  offset: number,
  value: number
): void {
  oracle.memoryDevice.directWrite(offset, value);
  wasm.wasmV2Runtime!.memory[offset] = value;
}
