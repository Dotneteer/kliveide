import { describe, expect, it } from "vitest";

import { OFFS_NEXT_RAM } from "@emu/machines/zxNext/MemoryDevice";
import {
  createOracleZxNextMachine,
  createTestZxNextRomSet,
  createTestZxNextWasmMachine
} from "./wasm-next-test-helpers";

const SCREEN_WIDTH = 720;
const DISPLAY_X = 96;
const DISPLAY_Y_50HZ = 48;
const DISPLAY_PIXEL = DISPLAY_Y_50HZ * SCREEN_WIDTH + DISPLAY_X;
const BANK_5_BASE = OFFS_NEXT_RAM + 5 * 0x4000;

describe("ZX Spectrum Next WASM v2 Layer 2 and LoRes screen", () => {
  it("owns port 0x123b and maps Layer 2 RAM over CPU memory", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    machine.doWritePort(0x123b, 0x07);
    const layer2MappedBase = wasm.zxnextGetLayer2MappedOffset(0x0000, 0);
    wasm.zxnextWritePhysical(layer2MappedBase, 0x5a);

    expect(machine.doReadPort(0x123b)).toBe(0x07);
    expect(machine.doReadMemory(0x0000)).toBe(0x5a);
    expect(layer2MappedBase).not.toBe(0xffffffff);

    machine.doWriteMemory(0x0001, 0xa5);
    expect(wasm.zxnextReadPhysical(wasm.zxnextGetLayer2MappedOffset(0x0001, 1))).toBe(0xa5);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      layer2Enabled: true,
      layer2Bank: 0,
      layer2MappingReadsEnabled: true,
      layer2MappingWritesEnabled: true
    });

    machine.doWritePort(0x123b, 0x12);
    expect(machine.doReadPort(0x123b)).toBe(0x07);
    expect(machine.getWasmV2Diagnostics().layer2BankOffset).toBe(2);
  });

  it("matches the TypeScript oracle for 256x192 Layer 2 palette offset and transparency", async () => {
    const romSet = createTestZxNextRomSet();
    const wasmMachine = await createTestZxNextWasmMachine(romSet);
    const oracleMachine = await createOracleZxNextMachine(romSet);

    for (const machine of [wasmMachine, oracleMachine]) {
      setLayer2PaletteEntry(machine, 0xf3, 0x1c0);
      machine.nextRegDevice.directSetRegValue(0x70, 0x01);
      machine.doWritePort(0x123b, 0x02);
      writeLayer2Sram(machine, "256", 0, 0, 0xe3);
      writeLayer2Sram(machine, "256", 1, 0, 0xd3);
      machine.renderInstantScreen();
    }

    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL]).toBe(oracleMachine.getPixelBuffer()[DISPLAY_PIXEL]);
    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL]).not.toBe(0xff000000);
    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL + 2]).toBe(
      oracleMachine.getPixelBuffer()[DISPLAY_PIXEL + 2]
    );
  });

  it("matches the TypeScript oracle for 320x256 Layer 2 pixels", async () => {
    const romSet = createTestZxNextRomSet();
    const wasmMachine = await createTestZxNextWasmMachine(romSet);
    const oracleMachine = await createOracleZxNextMachine(romSet);

    for (const machine of [wasmMachine, oracleMachine]) {
      setLayer2PaletteEntry(machine, 0x42, 0x038);
      machine.nextRegDevice.directSetRegValue(0x70, 0x10);
      machine.doWritePort(0x123b, 0x02);
      writeLayer2Sram(machine, "320", 32, 32, 0x42);
      machine.renderInstantScreen();
    }

    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL]).toBe(oracleMachine.getPixelBuffer()[DISPLAY_PIXEL]);
    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL]).not.toBe(0xff000000);
  });

  it("matches the TypeScript oracle for 640x256 Layer 2 nibbles", async () => {
    const romSet = createTestZxNextRomSet();
    const wasmMachine = await createTestZxNextWasmMachine(romSet);
    const oracleMachine = await createOracleZxNextMachine(romSet);

    for (const machine of [wasmMachine, oracleMachine]) {
      setLayer2PaletteEntry(machine, 0x0a, 0x007);
      setLayer2PaletteEntry(machine, 0x05, 0x1c0);
      machine.nextRegDevice.directSetRegValue(0x70, 0x20);
      machine.doWritePort(0x123b, 0x02);
      writeLayer2Sram(machine, "640", 32, 32, 0xa5);
      machine.renderInstantScreen();
    }

    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL]).toBe(oracleMachine.getPixelBuffer()[DISPLAY_PIXEL]);
    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL + 1]).toBe(
      oracleMachine.getPixelBuffer()[DISPLAY_PIXEL + 1]
    );
    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL]).not.toBe(0xff000000);
    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL + 1]).not.toBe(0xff000000);
    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL]).not.toBe(
      wasmMachine.getPixelBuffer()[DISPLAY_PIXEL + 1]
    );
  });

  it("matches the TypeScript oracle for standard LoRes bank 5 pixels", async () => {
    const romSet = createTestZxNextRomSet();
    const wasmMachine = await createTestZxNextWasmMachine(romSet);
    const oracleMachine = await createOracleZxNextMachine(romSet);

    for (const machine of [wasmMachine, oracleMachine]) {
      setUlaPaletteEntry(machine, 0x0e, 0x1f8);
      machine.doWriteMemory(0x4000, 0x0e);
      machine.nextRegDevice.directSetRegValue(0x15, 0x80);
      machine.renderInstantScreen();
    }

    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL]).toBe(oracleMachine.getPixelBuffer()[DISPLAY_PIXEL]);
    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL]).toBe(bgraFromRgb333(0x1f8));
    expect(wasmMachine.getWasmV2Diagnostics()).toMatchObject({
      loResEnabled: true,
      loResRadastanMode: false
    });
  });

  it("matches the TypeScript oracle for Radastan LoRes scroll and Timex dfile XOR", async () => {
    const romSet = createTestZxNextRomSet();
    const wasmMachine = await createTestZxNextWasmMachine(romSet);
    const oracleMachine = await createOracleZxNextMachine(romSet);
    wasmMachine.wasmV2Runtime!.exports.zxnextWritePhysical(BANK_5_BASE, 0xa6);
    wasmMachine.wasmV2Runtime!.exports.zxnextWritePhysical(BANK_5_BASE + 0x2000, 0xc4);

    for (const machine of [wasmMachine, oracleMachine]) {
      if (machine === oracleMachine) {
        machine.doWriteMemory(0x4000, 0xa6);
        machine.doWriteMemory(0x6000, 0xc4);
      }
      machine.nextRegDevice.directSetRegValue(0x15, 0x80);
      machine.nextRegDevice.directSetRegValue(0x6a, 0x20);
      machine.nextRegDevice.directSetRegValue(0x32, 0x02);
      machine.renderInstantScreen();
    }

    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL]).toBe(oracleMachine.getPixelBuffer()[DISPLAY_PIXEL]);

    wasmMachine.wasmV2Runtime!.exports.zxnextWritePhysical(BANK_5_BASE, 0xaa);
    wasmMachine.wasmV2Runtime!.exports.zxnextWritePhysical(BANK_5_BASE + 0x2000, 0xcc);
    for (const machine of [wasmMachine, oracleMachine]) {
      if (machine === oracleMachine) {
        machine.doWriteMemory(0x4000, 0xaa);
        machine.doWriteMemory(0x6000, 0xcc);
      }
      machine.nextRegDevice.directSetRegValue(0x32, 0x00);
      machine.doWritePort(0x00ff, 0x01);
      machine.nextRegDevice.directSetRegValue(0x6a, 0x20);
      machine.renderInstantScreen();
    }
    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL]).toBe(oracleMachine.getPixelBuffer()[DISPLAY_PIXEL]);

    for (const machine of [wasmMachine, oracleMachine]) {
      machine.nextRegDevice.directSetRegValue(0x6a, 0x30);
      machine.renderInstantScreen();
    }
    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL]).toBe(oracleMachine.getPixelBuffer()[DISPLAY_PIXEL]);
    expect(wasmMachine.getWasmV2Diagnostics()).toMatchObject({
      loResRadastanMode: true,
      loResRadastanTimexXor: true
    });
  });
});

function writeLayer2Sram(
  machine: {
    wasmV2Runtime?: { exports: { zxnextWritePhysical(offset: number, value: number): number } };
    memoryDevice?: { memory: Uint8Array };
  },
  resolution: "256" | "320" | "640",
  x: number,
  y: number,
  value: number
): void {
  const offset = resolution === "256" ? (y << 8) | x : (x << 8) | y;
  const segment16K = (offset >> 14) & 0x07;
  const half8K = (offset >> 13) & 0x01;
  const bank8K = (8 + segment16K) * 2 + half8K;
  const physicalOffset = OFFS_NEXT_RAM + (bank8K << 13) + (offset & 0x1fff);
  if (machine.wasmV2Runtime != null) {
    machine.wasmV2Runtime.exports.zxnextWritePhysical(physicalOffset, value & 0xff);
  } else {
    machine.memoryDevice!.memory[physicalOffset] = value & 0xff;
  }
}

function setLayer2PaletteEntry(machine: { nextRegDevice: { directSetRegValue(reg: number, value: number): void } }, index: number, rgb333: number): void {
  machine.nextRegDevice.directSetRegValue(0x43, 0x10);
  machine.nextRegDevice.directSetRegValue(0x40, index);
  machine.nextRegDevice.directSetRegValue(0x44, (rgb333 >> 1) & 0xff);
  machine.nextRegDevice.directSetRegValue(0x44, rgb333 & 0x01);
}

function setUlaPaletteEntry(machine: { nextRegDevice: { directSetRegValue(reg: number, value: number): void } }, index: number, rgb333: number): void {
  machine.nextRegDevice.directSetRegValue(0x43, 0x00);
  machine.nextRegDevice.directSetRegValue(0x40, index);
  machine.nextRegDevice.directSetRegValue(0x44, (rgb333 >> 1) & 0xff);
  machine.nextRegDevice.directSetRegValue(0x44, rgb333 & 0x01);
}

function bgraFromRgb333(rgb333: number): number {
  return (
    0xff000000 |
    (level(rgb333 & 0x07) << 16) |
    (level((rgb333 >> 3) & 0x07) << 8) |
    level((rgb333 >> 6) & 0x07)
  ) >>> 0;
}

function level(value: number): number {
  return [0, 36, 73, 109, 146, 182, 219, 255][value & 0x07];
}
