import { describe, expect, it } from "vitest";

import { TestZxNextMachine } from "../../zxnext/TestNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createZxNextOracleHarness } from "./wasm-next-test-helpers";

type MemoryMachine = TestZxNextMachine | ZxNextWasmV2Machine;

const OFFS_NEXT_ROM = 0x000000;
const OFFS_NEXT_RAM = 0x040000;

const BOUNDARY_ADDRESSES = [
  0x0000,
  0x1fff,
  0x2000,
  0x3fff,
  0x4000,
  0x5fff,
  0x8000,
  0xbfff,
  0xc000,
  0xffff
];

describe("ZX Spectrum Next WASM memory MMU parity", () => {
  it("matches TypeScript reset mapping across debugger read paths", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    seedResetPhysicalMemory(oracle);
    seedResetPhysicalMemory(wasm);

    expectSamePublicMemoryMap(wasm, oracle, BOUNDARY_ADDRESSES);

    const romBefore = oracle.doReadMemory(0x0000);
    for (const machine of [oracle, wasm]) {
      machine.doWriteMemory(0x0000, 0xa5);
      machine.doWriteMemory(0x4000, 0x66);
    }

    expect(wasm.doReadMemory(0x0000)).toBe(oracle.doReadMemory(0x0000));
    expect(wasm.doReadMemory(0x0000)).toBe(romBefore);
    expect(wasm.doReadMemory(0x4000)).toBe(oracle.doReadMemory(0x4000));
    expect(wasm.get64KFlatMemory()[0x4000]).toBe(oracle.get64KFlatMemory()[0x4000]);
    expect(wasm.getMemoryPartition(0x0a)[0]).toBe(oracle.getMemoryPartition(0x0a)[0]);
  });

  it("matches TypeScript MMU NextReg RAM remapping and sentinel system-region fallback", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    seedResetPhysicalMemory(oracle);
    seedResetPhysicalMemory(wasm);

    for (const machine of [oracle, wasm]) {
      writeNextReg(machine, 0x50, 0x04);
      writeNextReg(machine, 0x51, 0x05);
      writeNextReg(machine, 0x52, 0xe0);
      machine.doWriteMemory(0x0000, 0x77);
    }

    expectSamePublicMemoryMap(wasm, oracle, [0x0000, 0x1fff, 0x2000, 0x4000, 0x5fff]);
    expect(wasm.getMemoryPartition(0x04)[0]).toBe(oracle.getMemoryPartition(0x04)[0]);
    expect(wasm.getMemoryPartition(0x04)[0]).toBe(0x77);
  });

  it("matches TypeScript all-RAM mapping writes through public memory APIs", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    seedResetPhysicalMemory(oracle);
    seedResetPhysicalMemory(wasm);

    for (const machine of [oracle, wasm]) {
      writeNextReg(machine, 0x8e, 0x04);
      machine.doWriteMemory(0x0000, 0x21);
      machine.doWriteMemory(0x4000, 0x22);
      machine.doWriteMemory(0x8000, 0x23);
      machine.doWriteMemory(0xc000, 0x24);
    }

    expectSamePublicMemoryMap(wasm, oracle, BOUNDARY_ADDRESSES);
    expect(wasm.getMemoryPartition(0)[0]).toBe(oracle.getMemoryPartition(0)[0]);
    expect(wasm.getMemoryPartition(2)[0]).toBe(oracle.getMemoryPartition(2)[0]);
    expect(wasm.getMemoryPartition(4)[0]).toBe(oracle.getMemoryPartition(4)[0]);
    expect(wasm.getMemoryPartition(6)[0]).toBe(oracle.getMemoryPartition(6)[0]);
  });
});

function expectSamePublicMemoryMap(
  wasm: ZxNextWasmV2Machine,
  oracle: TestZxNextMachine,
  addresses: number[]
): void {
  expect(wasm.getCurrentPartitions()).toEqual(oracle.getCurrentPartitions());
  expect(wasm.getCurrentPartitionLabels()).toEqual(oracle.getCurrentPartitionLabels());
  expect(wasm.getSelectedRomPage()).toBe(oracle.getSelectedRomPage());
  expect(wasm.getSelectedRamBank()).toBe(oracle.getSelectedRamBank());

  const wasmFlat = wasm.get64KFlatMemory();
  const oracleFlat = oracle.get64KFlatMemory();
  for (const address of addresses) {
    expect(wasm.getPartition(address), `partition ${address.toString(16)}`).toBe(
      oracle.getPartition(address)
    );
    expect(wasm.doReadMemory(address), `read ${address.toString(16)}`).toBe(
      oracle.doReadMemory(address)
    );
    expect(wasmFlat[address], `flat ${address.toString(16)}`).toBe(oracleFlat[address]);
  }
}

function seedResetPhysicalMemory(machine: MemoryMachine): void {
  writePhysical(machine, OFFS_NEXT_ROM + 0x0000, 0x10);
  writePhysical(machine, OFFS_NEXT_ROM + 0x1fff, 0x11);
  writePhysical(machine, OFFS_NEXT_ROM + 0x2000, 0x12);
  writePhysical(machine, OFFS_NEXT_ROM + 0x3fff, 0x13);
  for (const bank8 of [0x00, 0x01, 0x04, 0x05, 0x0a, 0x0b]) {
    writePhysical(machine, OFFS_NEXT_RAM + bank8 * 0x2000, 0x40 + bank8);
    writePhysical(machine, OFFS_NEXT_RAM + bank8 * 0x2000 + 0x1fff, 0x60 + bank8);
  }
}

function writePhysical(machine: MemoryMachine, offset: number, value: number): void {
  if (machine instanceof TestZxNextMachine) {
    machine.memoryDevice.directWrite(offset, value);
  } else {
    machine.getMemoryPartition(physicalOffsetToPartition(offset))[offset & partitionOffsetMask(offset)] = value;
  }
}

function physicalOffsetToPartition(offset: number): number {
  if (offset < OFFS_NEXT_RAM) {
    return -1 - ((offset - OFFS_NEXT_ROM) >> 14);
  }
  return (offset - OFFS_NEXT_RAM) >> 13;
}

function partitionOffsetMask(offset: number): number {
  return offset < OFFS_NEXT_RAM ? 0x3fff : 0x1fff;
}

function writeNextReg(machine: MemoryMachine, reg: number, value: number): void {
  machine.nextRegDevice.setNextRegisterIndex(reg);
  machine.nextRegDevice.setNextRegisterValue(value);
}
