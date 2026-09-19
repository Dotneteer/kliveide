import { describe, expect, it } from "vitest";

import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

/*
 * The debugger's view of the Next memory map: `getCurrentPartitions`, `getCurrentPartitionLabels`,
 * `getPartition`, `get64KFlatMemory`, `getMemoryPartition`, `getSelectedRomPage/RamBank`. The paging
 * hardware itself is covered by `test/zxnext-hw/memory/`; these tests pin what the IDE reads.
 *
 * Byte values come from `seedResetPhysicalMemory`: ROM 0 carries $10/$11/$12/$13 at offsets
 * $0000/$1FFF/$2000/$3FFF, and each seeded 8K RAM page n carries $40+n at its first byte and $60+n at
 * its last. Values not derived that way are pinned: they are the ones both cores agreed on at tag
 * `pre-zxnext-ts-removal-2026-09-19`.
 */

const OFFS_NEXT_ROM = 0x000000;
const OFFS_NEXT_RAM = 0x040000;

/** [address, partition, byte read] */
type AddressRow = [number, number, number];

type ExpectedMap = {
  partitions: number[];
  labels: string[];
  rom: number;
  bank: number;
  addresses: AddressRow[];
};

describe("ZX Spectrum Next WASM memory map (debugger read paths)", () => {
  it("reports the reset mapping and keeps the ROM read-only through every read path", async () => {
    const wasm = await createTestZxNextWasmMachine();
    seedResetPhysicalMemory(wasm);

    // --- MMU reset layout $FF,$FF,$0A,$0B,$04,$05,$00,$01 (catalogue MEM-001); ROM partitions are -1 ("R0")
    expectPublicMemoryMap(wasm, {
      partitions: [0xff, 0xff, 0x0a, 0x0b, 0x04, 0x05, 0x00, 0x01],
      labels: ["R0", "R0", "0A", "0B", "04", "05", "00", "01"],
      rom: 0,
      bank: 0,
      addresses: [
        [0x0000, -1, 0x10],
        [0x1fff, -1, 0x11],
        [0x2000, -1, 0x12],
        [0x3fff, -1, 0x13],
        [0x4000, 0x0a, 0x4a],
        [0x5fff, 0x0a, 0x6a],
        [0x8000, 0x04, 0x44],
        [0xbfff, 0x05, 0x65],
        [0xc000, 0x00, 0x40],
        [0xffff, 0x01, 0x61]
      ]
    });

    wasm.doWriteMemory(0x0000, 0xa5);
    wasm.doWriteMemory(0x4000, 0x66);

    // --- The ROM write is ignored; the RAM write lands in page $0A
    expect(wasm.doReadMemory(0x0000)).toBe(0x10);
    expect(wasm.doReadMemory(0x4000)).toBe(0x66);
    expect(wasm.get64KFlatMemory()[0x4000]).toBe(0x66);
    expect(wasm.getMemoryPartition(0x0a)[0]).toBe(0x66);
  });

  it("follows MMU NextReg RAM remapping and the sentinel system-region fallback", async () => {
    const wasm = await createTestZxNextWasmMachine();
    seedResetPhysicalMemory(wasm);

    writeNextReg(wasm, 0x50, 0x04);
    writeNextReg(wasm, 0x51, 0x05);
    writeNextReg(wasm, 0x52, 0xe0);
    wasm.doWriteMemory(0x0000, 0x77);

    // --- Pages $04/$05 in slots 0/1; page $E0 in slot 2 is past the last RAM page and is reported as
    // --- ROM ($FF, "R0", partition -1), reading ROM 0's bytes (pinned).
    expectPublicMemoryMap(wasm, {
      partitions: [0x04, 0x05, 0xff, 0x0b, 0x04, 0x05, 0x00, 0x01],
      labels: ["04", "05", "R0", "0B", "04", "05", "00", "01"],
      rom: 0,
      bank: 0,
      addresses: [
        [0x0000, 0x04, 0x77],
        [0x1fff, 0x04, 0x64],
        [0x2000, 0x05, 0x45],
        [0x4000, -1, 0x10],
        [0x5fff, -1, 0x11]
      ]
    });
    expect(wasm.getMemoryPartition(0x04)[0]).toBe(0x77);
  });

  it("maps the +3 all-RAM layout 0-1-2-3 and writes through the public memory APIs", async () => {
    const wasm = await createTestZxNextWasmMachine();
    seedResetPhysicalMemory(wasm);

    // --- $8E = $04: bit 2 enters +3 special mode, layout 00 = banks 0-1-2-3 (catalogue MEM-010/MEM-014)
    writeNextReg(wasm, 0x8e, 0x04);
    wasm.doWriteMemory(0x0000, 0x21);
    wasm.doWriteMemory(0x4000, 0x22);
    wasm.doWriteMemory(0x8000, 0x23);
    wasm.doWriteMemory(0xc000, 0x24);

    expectPublicMemoryMap(wasm, {
      partitions: [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07],
      labels: ["00", "01", "02", "03", "04", "05", "06", "07"],
      rom: 0,
      bank: 0,
      addresses: [
        [0x0000, 0x00, 0x21],
        [0x1fff, 0x00, 0x60],
        [0x2000, 0x01, 0x41],
        [0x3fff, 0x01, 0x61],
        [0x4000, 0x02, 0x22],
        [0x5fff, 0x02, 0x00], // --- page 2 is not seeded
        [0x8000, 0x04, 0x23],
        [0xbfff, 0x05, 0x65],
        [0xc000, 0x06, 0x24],
        [0xffff, 0x07, 0x00] // --- page 7 is not seeded
      ]
    });
    expect(wasm.getMemoryPartition(0)[0]).toBe(0x21);
    expect(wasm.getMemoryPartition(2)[0]).toBe(0x22);
    expect(wasm.getMemoryPartition(4)[0]).toBe(0x23);
    expect(wasm.getMemoryPartition(6)[0]).toBe(0x24);
  });
});

function expectPublicMemoryMap(wasm: ZxNextWasmV2Machine, expected: ExpectedMap): void {
  expect(wasm.getCurrentPartitions()).toEqual(expected.partitions);
  expect(wasm.getCurrentPartitionLabels()).toEqual(expected.labels);
  expect(wasm.getSelectedRomPage()).toBe(expected.rom);
  expect(wasm.getSelectedRamBank()).toBe(expected.bank);

  const flat = wasm.get64KFlatMemory();
  for (const [address, partition, value] of expected.addresses) {
    expect(wasm.getPartition(address), `partition ${address.toString(16)}`).toBe(partition);
    expect(wasm.doReadMemory(address), `read ${address.toString(16)}`).toBe(value);
    expect(flat[address], `flat ${address.toString(16)}`).toBe(value);
  }
}

function seedResetPhysicalMemory(machine: ZxNextWasmV2Machine): void {
  writePhysical(machine, OFFS_NEXT_ROM + 0x0000, 0x10);
  writePhysical(machine, OFFS_NEXT_ROM + 0x1fff, 0x11);
  writePhysical(machine, OFFS_NEXT_ROM + 0x2000, 0x12);
  writePhysical(machine, OFFS_NEXT_ROM + 0x3fff, 0x13);
  for (const bank8 of [0x00, 0x01, 0x04, 0x05, 0x0a, 0x0b]) {
    writePhysical(machine, OFFS_NEXT_RAM + bank8 * 0x2000, 0x40 + bank8);
    writePhysical(machine, OFFS_NEXT_RAM + bank8 * 0x2000 + 0x1fff, 0x60 + bank8);
  }
}

function writePhysical(machine: ZxNextWasmV2Machine, offset: number, value: number): void {
  machine.getMemoryPartition(physicalOffsetToPartition(offset))[offset & partitionOffsetMask(offset)] = value;
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

function writeNextReg(machine: ZxNextWasmV2Machine, reg: number, value: number): void {
  machine.doWritePort(0x243b, reg);
  machine.doWritePort(0x253b, value);
}
