import { describe, expect, it } from "vitest";

import type { MachineModel } from "@common/machines/info-types";

import { MC_MEM_SIZE } from "@common/machines/constants";
import {
  MemoryDevice,
  OFFS_DIVMMC_RAM,
  OFFS_NEXT_RAM
} from "@emu/machines/zxNext/MemoryDevice";
import {
  createOracleZxNextMachine,
  createTestZxNextRomSet,
  createTestZxNextWasmMachine,
  executeOneInstruction,
  initCodeBytes
} from "./wasm-next-test-helpers";

const DEFAULT_MMU_REGS = [0xff, 0xff, 0x0a, 0x0b, 0x04, 0x05, 0x00, 0x01];
const DEFAULT_PARTITIONS = [0xff, 0xff, 0x05, 0x05, 0x02, 0x02, 0x00, 0x00];
const INVALID_PAGE_VALUE = 0x7e;

const memoryCases = [
  { kb: 512, pages: 32, sentinel: 0x080000 },
  { kb: 1024, pages: 96, sentinel: 0x100000 },
  { kb: 1536, pages: 160, sentinel: 0x180000 },
  { kb: 2048, pages: 224, sentinel: 0x200000 },
  { kb: 4096, pages: 480, sentinel: 0x400000 }
];

describe("ZX Spectrum Next WASM v2 memory/MMU baseline", () => {
  it("matches the TypeScript cold-start MMU layout", async () => {
    const romSet = createTestZxNextRomSet({
      next: patternedBytes(0x10000, 0x11),
      divMmc: patternedBytes(0x4000, 0x41),
      multiface: patternedBytes(0x4000, 0x61),
      alt: patternedBytes(0x8000, 0x81)
    });
    const wasmMachine = await createTestZxNextWasmMachine(romSet);
    const oracleMachine = await createOracleZxNextMachine(romSet);
    const wasm = wasmMachine.wasmV2Runtime!.exports;

    expect(wasmMachine.getCurrentPartitions()).toEqual(oracleMachine.getCurrentPartitions());
    expect(wasmMachine.getCurrentPartitions()).toEqual(DEFAULT_PARTITIONS);
    expect(Array.from({ length: 8 }, (_, index) => wasm.zxnextGetMmuReg(index))).toEqual(DEFAULT_MMU_REGS);
    expect(Array.from(oracleMachine.memoryDevice.mmuRegs)).toEqual(DEFAULT_MMU_REGS);

    expect(wasm.zxnextGetPageReadOffset(0)).toBe(0x0000);
    expect(wasm.zxnextGetPageReadOffset(1)).toBe(0x2000);
    expect(wasm.zxnextGetPageReadOffset(2)).toBe(OFFS_NEXT_RAM + 0x0a * 0x2000);
    expect(wasm.zxnextGetPageReadOffset(7)).toBe(OFFS_NEXT_RAM + 0x01 * 0x2000);
    expect(wasm.zxnextGetPageWriteOffset(0)).toBe(-1);
    expect(wasm.zxnextGetPageWriteOffset(2)).toBe(OFFS_NEXT_RAM + 0x0a * 0x2000);
  });

  it("keeps ROM read-only while RAM writes update physical memory and the 64K view", async () => {
    const romSet = createTestZxNextRomSet({ next: patternedBytes(0x10000, 0x20) });
    const machine = await createTestZxNextWasmMachine(romSet);
    const wasm = machine.wasmV2Runtime!.exports;
    const originalRomByte = machine.doReadMemory(0x0000);

    machine.doWriteMemory(0x0000, 0xee);
    expect(machine.doReadMemory(0x0000)).toBe(originalRomByte);
    expect(machine.get64KFlatMemory()[0x0000]).toBe(originalRomByte);

    machine.doWriteMemory(0x4000, 0x34);
    expect(machine.doReadMemory(0x4000)).toBe(0x34);
    expect(machine.get64KFlatMemory()[0x4000]).toBe(0x34);
    expect(wasm.zxnextReadPhysical(OFFS_NEXT_RAM + 0x0a * 0x2000)).toBe(0x34);

    wasm.zxnextWritePhysical(OFFS_NEXT_RAM + 0x01 * 0x2000 + 0x1ffe, 0x9a);
    expect(machine.doReadMemory(0xfffe)).toBe(0x9a);
    expect(machine.get64KFlatMemory()[0xfffe]).toBe(0x9a);
  });

  it("exposes memory partitions for IDE inspection through the WASM-owned state", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    wasm.zxnextWritePhysical(OFFS_NEXT_RAM + 0x0a * 0x2000, 0x45);
    wasm.zxnextWritePhysical(OFFS_DIVMMC_RAM + 3 * 0x2000, 0x67);

    expect(machine.getMemoryPartition(0x0a)[0]).toBe(0x45);
    expect(machine.getMemoryPartition(-11)[0]).toBe(0x67);
    expect(machine.readScreenMemory(0)).toBe(0x45);
  });

  it("preserves RAM on soft reset and clears mutable storage on hard reset", async () => {
    const romSet = createTestZxNextRomSet({ next: patternedBytes(0x10000, 0x30) });
    const machine = await createTestZxNextWasmMachine(romSet);
    const wasm = machine.wasmV2Runtime!.exports;

    wasm.zxnextWritePhysical(OFFS_DIVMMC_RAM, 0x77);
    machine.doWriteMemory(0xc000, 0x88);
    machine.reset();

    expect(wasm.zxnextReadPhysical(OFFS_DIVMMC_RAM)).toBe(0x77);
    expect(machine.doReadMemory(0xc000)).toBe(0x88);
    expect(machine.getCurrentPartitions()).toEqual(DEFAULT_PARTITIONS);

    machine.hardReset();
    expect(wasm.zxnextReadPhysical(OFFS_DIVMMC_RAM)).toBe(0x00);
    expect(machine.doReadMemory(0xc000)).toBe(0x00);
    expect(machine.doReadMemory(0x0000)).toBe(romSet.next[0]);
  });

  it("matches TypeScript memory page counts for currently supported sizes", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    for (const { kb, pages } of memoryCases.filter(({ kb }) => kb !== 4096)) {
      const oracleMemory = new MemoryDevice({} as any, kb);
      expect(wasm.zxnextConfigureMemorySize(kb)).toBe(1);
      expect(wasm.zxnextGetMainRamPageCount()).toBe(oracleMemory.maxPages);
      expect(wasm.zxnextGetMainRamPageCount()).toBe(pages);
      expect(machine.getCurrentPartitions()).toEqual(oracleMemory.getPartitions());
    }
  });

  it("supports active memory sizing and sentinel pages through the future 4MB KS3 shape", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    for (const { kb, pages, sentinel } of memoryCases) {
      expect(wasm.zxnextConfigureMemorySize(kb)).toBe(1);
      expect(wasm.zxnextGetConfiguredMemorySizeKb()).toBe(kb);
      expect(wasm.zxnextGetMainRamPageCount()).toBe(pages);
      expect(wasm.zxnextGetActiveMainRamSize()).toBe(pages * 0x2000);
      expect(wasm.zxnextGetActiveMemorySize()).toBe(sentinel);
      expect(wasm.zxnextGetSentinelOffset()).toBe(sentinel);
      expect(wasm.zxnextGetSentinelSize()).toBe(0x2000);
      expect(wasm.zxnextReadPhysical(sentinel)).toBe(INVALID_PAGE_VALUE);

      wasm.zxnextWriteSramPage(pages - 1, 0x1fff, 0xa5);
      expect(wasm.zxnextReadSramPage(pages - 1, 0x1fff)).toBe(0xa5);
      expect(wasm.zxnextReadSramPage(pages, 0x0000)).toBe(INVALID_PAGE_VALUE);
      wasm.zxnextWriteSramPage(pages, 0x0000, 0x5a);
      expect(wasm.zxnextReadSramPage(pages, 0x0000)).toBe(INVALID_PAGE_VALUE);
    }

    expect(wasm.zxnextGetMaxMainRamPageCount()).toBe(480);
  });

  it("configures 4MB memory from a model config without changing TypeScript defaults", async () => {
    const model: MachineModel = {
      modelId: "zxnext-ks3-test",
      displayName: "ZX Spectrum Next KS3 Test",
      config: { [MC_MEM_SIZE]: 4096 }
    };
    const machine = await createTestZxNextWasmMachine(createTestZxNextRomSet(), model);
    const wasm = machine.wasmV2Runtime!.exports;

    expect(wasm.zxnextGetConfiguredMemorySizeKb()).toBe(4096);
    expect(wasm.zxnextGetMainRamPageCount()).toBe(480);
    expect(wasm.zxnextGetSentinelOffset()).toBe(0x400000);
    expect(machine.getWasmV2Diagnostics().mainRamPages).toBe(480);
  });

  it("rejects invalid memory sizes without mutating the current configuration", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    expect(wasm.zxnextConfigureMemorySize(4096)).toBe(1);
    expect(wasm.zxnextConfigureMemorySize(3072)).toBe(0);
    expect(wasm.zxnextGetConfiguredMemorySizeKb()).toBe(4096);
    expect(wasm.zxnextGetMainRamPageCount()).toBe(480);
  });

  it("matches TypeScript 0x7ffd RAM/ROM paging writes", async () => {
    const { wasmMachine, oracleMachine } = await createMachinePair();

    for (let bank = 0; bank < 8; bank++) {
      const value = bank | ((bank & 0x01) << 4) | ((bank & 0x02) << 2);
      wasmMachine.doWritePort(0x7ffd, value);
      oracleMachine.doWritePort(0x7ffd, value);
      expectWasmMatchesOraclePaging(wasmMachine, oracleMachine);
      expect(wasmMachine.wasmV2Runtime!.exports.zxnextGetPort7ffdValue()).toBe(oracleMachine.memoryDevice.port7ffdValue);
    }
  });

  it("matches TypeScript 0xdffd extended bank writes", async () => {
    const { wasmMachine, oracleMachine } = await createMachinePair();

    for (const highBank of [0, 1, 7, 13]) {
      wasmMachine.doWritePort(0x7ffd, 0x03);
      oracleMachine.doWritePort(0x7ffd, 0x03);
      wasmMachine.doWritePort(0xdffd, highBank);
      oracleMachine.doWritePort(0xdffd, highBank);
      expectWasmMatchesOraclePaging(wasmMachine, oracleMachine);
      expect(wasmMachine.wasmV2Runtime!.exports.zxnextGetPortDffdValue()).toBe(oracleMachine.memoryDevice.portDffdValue);
    }
  });

  it("matches TypeScript 0x1ffd all-RAM mappings and restoration", async () => {
    const expectedAllRamPartitions = [
      [0, 0, 1, 1, 2, 2, 3, 3],
      [4, 4, 5, 5, 6, 6, 7, 7],
      [4, 4, 5, 5, 6, 6, 3, 3],
      [4, 4, 7, 7, 6, 6, 3, 3]
    ];

    for (let config = 0; config < 4; config++) {
      const { wasmMachine, oracleMachine } = await createMachinePair();
      wasmMachine.doWritePort(0x7ffd, 0x13);
      oracleMachine.doWritePort(0x7ffd, 0x13);
      wasmMachine.doWritePort(0xdffd, 0x02);
      oracleMachine.doWritePort(0xdffd, 0x02);

      wasmMachine.doWritePort(0x1ffd, 0x01 | (config << 1));
      oracleMachine.doWritePort(0x1ffd, 0x01 | (config << 1));
      expect(wasmMachine.getCurrentPartitions()).toEqual(expectedAllRamPartitions[config]);
      expectWasmMatchesOraclePaging(wasmMachine, oracleMachine);
      expect(wasmMachine.wasmV2Runtime!.exports.zxnextGetAllRamMode()).toBe(1);
      expect(wasmMachine.wasmV2Runtime!.exports.zxnextGetSpecialConfig()).toBe(config);

      wasmMachine.doWritePort(0x1ffd, 0x00);
      oracleMachine.doWritePort(0x1ffd, 0x00);
      expectWasmMatchesOraclePaging(wasmMachine, oracleMachine);
      expect(wasmMachine.wasmV2Runtime!.exports.zxnextGetAllRamMode()).toBe(0);
    }
  });

  it("matches TypeScript paging lock semantics from 0x7ffd bit 5", async () => {
    const { wasmMachine, oracleMachine } = await createMachinePair();

    wasmMachine.doWritePort(0x7ffd, 0x25);
    oracleMachine.doWritePort(0x7ffd, 0x25);
    expectWasmMatchesOraclePaging(wasmMachine, oracleMachine);
    expect(wasmMachine.wasmV2Runtime!.exports.zxnextGetPagingEnabled()).toBe(0);

    wasmMachine.doWritePort(0x7ffd, 0x02);
    oracleMachine.doWritePort(0x7ffd, 0x02);
    wasmMachine.doWritePort(0xdffd, 0x0d);
    oracleMachine.doWritePort(0xdffd, 0x0d);
    wasmMachine.doWritePort(0x1ffd, 0x01);
    oracleMachine.doWritePort(0x1ffd, 0x01);
    expectWasmMatchesOraclePaging(wasmMachine, oracleMachine);
    expect(wasmMachine.wasmV2Runtime!.exports.zxnextGetPort7ffdValue()).toBe(0x25);
  });

  it("matches TypeScript 0xeff7 bank-0 override behavior", async () => {
    const { wasmMachine, oracleMachine } = await createMachinePair();

    wasmMachine.doWritePort(0xeff7, 0x08);
    oracleMachine.doWritePort(0xeff7, 0x08);
    expectWasmMatchesOraclePaging(wasmMachine, oracleMachine);
    expect(wasmMachine.getCurrentPartitions().slice(0, 2)).toEqual([0, 0]);
    expect(wasmMachine.wasmV2Runtime!.exports.zxnextGetPortEff7Value()).toBe(oracleMachine.memoryDevice.portEff7Value);

    wasmMachine.doWritePort(0xeff7, 0x00);
    oracleMachine.doWritePort(0xeff7, 0x00);
    expectWasmMatchesOraclePaging(wasmMachine, oracleMachine);
    expect(wasmMachine.getCurrentPartitions().slice(0, 2)).toEqual([0xff, 0xff]);
  });

  it("matches TypeScript MMU writes through NextReg 0x50..0x57", async () => {
    const { wasmMachine, oracleMachine } = await createMachinePair();

    const writes = [
      { reg: 0x50, value: 0x00 },
      { reg: 0x51, value: 0x01 },
      { reg: 0x52, value: 0x12 },
      { reg: 0x56, value: 0x10 },
      { reg: 0x57, value: 0xff }
    ];

    for (const { reg, value } of writes) {
      wasmMachine.tbblueOut(reg, value);
      oracleMachine.tbblueOut(reg, value);
      expect(wasmMachine.wasmV2Runtime!.exports.zxnextReadNextReg(reg)).toBe(oracleMachine.memoryDevice.getNextRegMmuValue(reg - 0x50));
      expectWasmMatchesOraclePaging(wasmMachine, oracleMachine);
    }

    wasmMachine.doWriteMemory(0xc000, 0x5c);
    expect(wasmMachine.wasmV2Runtime!.exports.zxnextReadPhysical(OFFS_NEXT_RAM + 0x10 * 0x2000)).toBe(0x5c);
  });

  it("applies CPU NEXTREG MMU side effects to WASM-owned memory mapping", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    initCodeBytes(machine, [0xed, 0x91, 0x56, 0x10]);
    executeOneInstruction(machine);

    expect(wasm.zxnextReadNextReg(0x56)).toBe(0x10);
    expect(wasm.zxnextGetMmuReg(6)).toBe(0x10);
    expect(machine.getCurrentPartitions()[6]).toBe(0x08);
    machine.doWriteMemory(0xc000, 0x6d);
    expect(wasm.zxnextReadPhysical(OFFS_NEXT_RAM + 0x10 * 0x2000)).toBe(0x6d);
  });
});

function patternedBytes(size: number, seed: number): Uint8Array {
  const result = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    result[i] = (seed + i * 17) & 0xff;
  }
  return result;
}

async function createMachinePair() {
  const romSet = createTestZxNextRomSet({
    next: patternedBytes(0x10000, 0x21),
    divMmc: patternedBytes(0x4000, 0x31),
    multiface: patternedBytes(0x4000, 0x41),
    alt: patternedBytes(0x8000, 0x51)
  });
  const wasmMachine = await createTestZxNextWasmMachine(romSet);
  const oracleMachine = await createOracleZxNextMachine(romSet);
  return { wasmMachine, oracleMachine };
}

function expectWasmMatchesOraclePaging(
  wasmMachine: Awaited<ReturnType<typeof createTestZxNextWasmMachine>>,
  oracleMachine: Awaited<ReturnType<typeof createOracleZxNextMachine>>
): void {
  const wasm = wasmMachine.wasmV2Runtime!.exports;
  expect(wasmMachine.getCurrentPartitions()).toEqual(oracleMachine.getCurrentPartitions());
  expect(wasmMachine.getSelectedRomPage()).toBe(oracleMachine.getSelectedRomPage());
  expect(wasmMachine.getSelectedRamBank()).toBe(oracleMachine.getSelectedRamBank());
  for (let slot = 0; slot < 8; slot++) {
    const page = oracleMachine.memoryDevice.pageInfo[slot];
    expect(wasm.zxnextGetMmuReg(slot), `mmu ${slot}`).toBe(oracleMachine.memoryDevice.mmuRegs[slot]);
    expect(wasm.zxnextGetPageBank16k(slot), `bank16 ${slot}`).toBe(page.bank16k);
    expect(wasm.zxnextGetPageBank8k(slot), `bank8 ${slot}`).toBe(page.bank8k);
    expect(wasm.zxnextGetPageReadOffset(slot), `read ${slot}`).toBe(page.readOffset);
    expect(normalizeWasmOffset(wasm.zxnextGetPageWriteOffset(slot)), `write ${slot}`).toBe(page.writeOffset);
  }
}

function normalizeWasmOffset(offset: number): number | null {
  return offset === -1 ? null : offset;
}
