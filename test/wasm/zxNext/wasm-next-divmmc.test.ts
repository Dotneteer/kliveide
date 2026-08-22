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
    expectBasePageMappings(wasm, oracle, [0, 1]);
    expect(wasm.doReadMemory(0x0000)).toBe(oracle.doReadMemory(0x0000));
    expect(wasm.doReadMemory(0x0000)).toBe(0xd1);
    expect(wasm.doReadMemory(0x2000)).toBe(oracle.doReadMemory(0x2000));
    expect(wasm.doReadMemory(0x2000)).toBe(0xd2);

    for (const machine of [oracle, wasm]) {
      machine.doWritePort(0xe3, 0xc2);
    }
    expectDivMmcState(wasm, oracle);
    expectBasePageMappings(wasm, oracle, [0, 1]);
    expect(wasm.doReadMemory(0x0000)).toBe(oracle.doReadMemory(0x0000));
    expect(wasm.doReadMemory(0x0000)).toBe(0xd3);

    for (const machine of [oracle, wasm]) {
      machine.tbblueOut(0x09, 0x08);
      machine.doWritePort(0xe3, 0x82);
    }
    expectDivMmcState(wasm, oracle);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetDivMmcMapram()).toBe(0);
  });

  it("keeps exported page maps on the base MMU map while CONMEM overlays memory access", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.hardReset();
    wasm.hardReset();

    seedPhysical(oracle, wasm, OFFS_NEXT_ROM, 0x11);
    seedPhysical(oracle, wasm, OFFS_DIVMMC_ROM, 0xd1);
    seedPhysical(oracle, wasm, OFFS_DIVMMC_RAM + 0x2000, 0xd2);

    for (const machine of [oracle, wasm]) {
      machine.doWritePort(0xe3, 0x81);
    }

    expectBasePageMappings(wasm, oracle, [0, 1]);
    expect(wasm.doReadMemory(0x0000)).toBe(oracle.doReadMemory(0x0000));
    expect(wasm.doReadMemory(0x0000)).toBe(0xd1);
    expect(wasm.doReadMemory(0x2000)).toBe(oracle.doReadMemory(0x2000));
    expect(wasm.doReadMemory(0x2000)).toBe(0xd2);
  });

  it("uses NextReg $83 bit 0 to gate DivMMC port $E3 reads and writes", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.hardReset();
    wasm.hardReset();

    for (const machine of [oracle, wasm]) {
      machine.doWritePort(0xe3, 0x85);
    }
    expect(wasm.doReadPort(0xe3)).toBe(oracle.doReadPort(0xe3));
    expect(wasm.doReadPort(0xe3)).toBe(0x85);
    expectDivMmcState(wasm, oracle);

    for (const machine of [oracle, wasm]) {
      writeNextReg(machine, 0x83, 0xfe);
      machine.doWritePort(0xe3, 0x81);
    }
    expect(wasm.doReadPort(0xe3)).toBe(oracle.doReadPort(0xe3));
    expect(wasm.doReadPort(0xe3)).toBe(0xff);
    expectDivMmcState(wasm, oracle);

    for (const machine of [oracle, wasm]) {
      writeNextReg(machine, 0x83, 0xff);
    }
    expect(wasm.doReadPort(0xe3)).toBe(oracle.doReadPort(0xe3));
    expect(wasm.doReadPort(0xe3)).toBe(0x85);
    expectDivMmcState(wasm, oracle);
  });

  it("matches TypeScript DivMMC entry NextReg round-trips", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.hardReset();
    wasm.hardReset();

    for (const [reg, value] of [
      [0xb8, 0xa5],
      [0xb9, 0x3c],
      [0xba, 0x5a],
      [0xbb, 0xf2]
    ] as const) {
      writeNextReg(oracle, reg, value);
      writeNextReg(wasm, reg, value);
      expect(readNextReg(wasm, reg), `reg $${hex(reg)}`).toBe(readNextReg(oracle, reg));
      expectDivMmcState(wasm, oracle);
    }
  });

  it("matches TypeScript RST automap ROM3 gating and instant/delayed timing", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.hardReset();
    wasm.hardReset();

    for (const machine of [oracle, wasm]) {
      writeNextReg(machine, 0x0a, 0x11);
      writeNextReg(machine, 0xb8, 0x02);
      writeNextReg(machine, 0xb9, 0x00);
      writeNextReg(machine, 0xba, 0x02);
    }

    runBeforeFetch(oracle, 0x0008);
    runBeforeFetch(wasm, 0x0008);
    expectDivMmcState(wasm, oracle);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetDivMmcAutoMapActive()).toBe(0);

    for (const machine of [oracle, wasm]) {
      writeNextReg(machine, 0x8e, 0x0b);
    }
    runBeforeFetch(oracle, 0x0008);
    runBeforeFetch(wasm, 0x0008);
    expectDivMmcState(wasm, oracle);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetDivMmcAutoMapActive()).toBe(1);

    oracle.hardReset();
    wasm.hardReset();
    for (const machine of [oracle, wasm]) {
      writeNextReg(machine, 0x0a, 0x11);
      writeNextReg(machine, 0x8e, 0x0b);
      writeNextReg(machine, 0xb8, 0x02);
      writeNextReg(machine, 0xb9, 0x00);
      writeNextReg(machine, 0xba, 0x00);
    }
    runBeforeFetch(oracle, 0x0008);
    runBeforeFetch(wasm, 0x0008);
    expectDivMmcInternalState(wasm, oracle);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetDivMmcAutoMapActive()).toBe(0);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetDivMmcRequestAutomapOn()).toBe(1);

    runAfterFetch(oracle);
    runAfterFetch(wasm);
    expectDivMmcState(wasm, oracle);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetDivMmcAutoMapActive()).toBe(1);
  });

  it("matches TypeScript custom, NMI, and 1FF8 DivMMC automap transitions", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.hardReset();
    wasm.hardReset();

    for (const machine of [oracle, wasm]) {
      writeNextReg(machine, 0x0a, 0x11);
      writeNextReg(machine, 0x8e, 0x0b);
      writeNextReg(machine, 0xbb, 0x04);
    }
    runBeforeFetch(oracle, 0x04c6);
    runBeforeFetch(wasm, 0x04c6);
    expectDivMmcInternalState(wasm, oracle);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetDivMmcRequestAutomapOn()).toBe(1);
    runAfterFetch(oracle);
    runAfterFetch(wasm);
    expectDivMmcState(wasm, oracle);

    for (const machine of [oracle, wasm]) {
      writeNextReg(machine, 0xbb, 0x00);
    }
    runBeforeFetch(oracle, 0x1ff8);
    runBeforeFetch(wasm, 0x1ff8);
    runAfterFetch(oracle);
    runAfterFetch(wasm);
    expectDivMmcState(wasm, oracle);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetDivMmcAutoMapActive()).toBe(1);

    oracle.hardReset();
    wasm.hardReset();
    for (const machine of [oracle, wasm]) {
      writeNextReg(machine, 0x0a, 0x11);
      writeNextReg(machine, 0xbb, 0x01);
    }
    oracle.divMmcDevice.armNmiButton();
    wasm.wasmV2Runtime!.exports.zxnextDivMmcArmNmi();
    runBeforeFetch(oracle, 0x0066);
    runBeforeFetch(wasm, 0x0066);
    expectDivMmcInternalState(wasm, oracle);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetDivMmcRequestAutomapOn()).toBe(1);
    runAfterFetch(oracle);
    runAfterFetch(wasm);
    expectDivMmcState(wasm, oracle);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetDivMmcAutoMapActive()).toBe(1);
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
  expectDivMmcInternalState(wasm, oracle);
}

function expectDivMmcInternalState(wasm: ZxNextWasmV2Machine, oracle: TestZxNextMachine): void {
  const exports = wasm.wasmV2Runtime!.exports;
  const oracleDivMmc = oracle.divMmcDevice as any;
  expect(exports.zxnextGetDivMmcRequestAutomapOn()).toBe(oracleDivMmc._requestAutomapOn ? 1 : 0);
  expect(exports.zxnextGetDivMmcRequestAutomapOff()).toBe(oracleDivMmc._requestAutomapOff ? 1 : 0);
}

function expectBasePageMappings(
  wasm: ZxNextWasmV2Machine,
  oracle: TestZxNextMachine,
  pages: number[]
): void {
  const exports = wasm.wasmV2Runtime!.exports;
  for (const page of pages) {
    const pageInfo = oracle.memoryDevice.getPageInfo(page);
    expect(exports.zxnextGetMemoryPageReadOffset(page) >>> 0).toBe(pageInfo.readOffset);
    expect(normalizeWasmOffset(exports.zxnextGetMemoryPageWriteOffset(page))).toBe(pageInfo.writeOffset);
    expect(exports.zxnextGetMemoryPageBank16(page)).toBe(pageInfo.bank16k ?? 0xff);
    expect(exports.zxnextGetMemoryPageBank8(page)).toBe(pageInfo.bank8k ?? 0xff);
  }
}

function normalizeWasmOffset(offset: number): number | null {
  const normalized = offset >>> 0;
  return normalized === 0xffffffff ? null : normalized;
}

function writeNextReg(machine: TestZxNextMachine | ZxNextWasmV2Machine, reg: number, value: number): void {
  machine.nextRegDevice.setNextRegisterIndex(reg);
  machine.nextRegDevice.setNextRegisterValue(value);
}

function readNextReg(machine: TestZxNextMachine | ZxNextWasmV2Machine, reg: number): number {
  machine.nextRegDevice.setNextRegisterIndex(reg);
  return machine.nextRegDevice.getNextRegisterValue();
}

function runBeforeFetch(machine: TestZxNextMachine | ZxNextWasmV2Machine, pc: number): void {
  if (machine instanceof ZxNextWasmV2Machine) {
    machine.wasmV2Runtime!.exports.zxnextDivMmcBeforeFetch(pc);
    return;
  }
  machine.pc = pc;
  machine.divMmcDevice.beforeOpcodeFetch();
}

function runAfterFetch(machine: TestZxNextMachine | ZxNextWasmV2Machine): void {
  if (machine instanceof ZxNextWasmV2Machine) {
    machine.wasmV2Runtime!.exports.zxnextDivMmcAfterFetch(0, 0);
    return;
  }
  machine.divMmcDevice.afterOpcodeFetch();
}

function hex(value: number): string {
  return value.toString(16).padStart(2, "0");
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
