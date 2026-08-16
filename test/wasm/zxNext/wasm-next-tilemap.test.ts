import { describe, expect, it } from "vitest";

import { OFFS_NEXT_RAM } from "@emu/machines/zxNext/MemoryDevice";
import {
  createTestZxNextRomSet,
  createTestZxNextWasmMachine
} from "./wasm-next-test-helpers";

const SCREEN_WIDTH = 720;
const DISPLAY_X = 96;
const DISPLAY_Y_50HZ = 48;
const DISPLAY_PIXEL = DISPLAY_Y_50HZ * SCREEN_WIDTH + DISPLAY_X;
const BANK_5_BASE = OFFS_NEXT_RAM + 5 * 0x4000;
const SAFE_TILE_DEF_OFFSET = 0x1c;
const SAFE_MAP_OFFSET = 0x20;

describe("ZX Spectrum Next WASM v2 tilemap", () => {
  it("owns tilemap NextRegs and diagnostic state", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.nextRegDevice.directSetRegValue(0x1c, 0x08);
    machine.nextRegDevice.directSetRegValue(0x1b, 0x12);
    machine.nextRegDevice.directSetRegValue(0x1b, 0x34);
    machine.nextRegDevice.directSetRegValue(0x1b, 0x56);
    machine.nextRegDevice.directSetRegValue(0x2f, 0x03);
    machine.nextRegDevice.directSetRegValue(0x30, 0x9a);
    machine.nextRegDevice.directSetRegValue(0x31, 0xbc);
    machine.nextRegDevice.directSetRegValue(0x4c, 0xa5);
    machine.nextRegDevice.directSetRegValue(0x6b, 0xfb);
    machine.nextRegDevice.directSetRegValue(0x6c, 0x8f);
    machine.nextRegDevice.directSetRegValue(0x6e, 0xa2);
    machine.nextRegDevice.directSetRegValue(0x6f, 0x23);

    expect(machine.nextRegDevice.directGetRegValue(0x1b)).toBe(0xff);
    expect(machine.nextRegDevice.directGetRegValue(0x2f)).toBe(0x03);
    expect(machine.nextRegDevice.directGetRegValue(0x30)).toBe(0x9a);
    expect(machine.nextRegDevice.directGetRegValue(0x31)).toBe(0xbc);
    expect(machine.nextRegDevice.directGetRegValue(0x4c)).toBe(0x05);
    expect(machine.nextRegDevice.directGetRegValue(0x6b)).toBe(0xfb);
    expect(machine.nextRegDevice.directGetRegValue(0x6c)).toBe(0x8f);
    expect(machine.nextRegDevice.directGetRegValue(0x6e)).toBe(0xa2);
    expect(machine.nextRegDevice.directGetRegValue(0x6f)).toBe(0x23);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      tilemapEnabled: true,
      tilemap80x32Resolution: true,
      tilemapEliminateAttributes: true,
      paletteSecondTilemap: true,
      tilemapTextMode: true,
      tilemap512TileMode: true,
      tilemapForceOnTopOfUla: true,
      tilemapTransparencyIndex: 0x05,
      tilemapClipIndex: 3,
      tilemapClipWindowX1: 0x12,
      tilemapClipWindowX2: 0x34,
      tilemapClipWindowY1: 0x56,
      tilemapScrollX: 0x39a,
      tilemapScrollY: 0xbc,
      tilemapUseBank7: true,
      tilemapBank5Msb: 0x22,
      tilemapTileDefUseBank7: false,
      tilemapTileDefBank5Msb: 0x23,
      tilemapDefaultAttr: 0x8f
    });
  });

  it("matches the TypeScript oracle for 40x32 graphics tilemap pixels", async () => {
    const wasmMachine = await createTestZxNextWasmMachine(createTestZxNextRomSet());

    setTilemapPaletteEntry(wasmMachine, 0x12, 0x1c0);
    wasmMachine.nextRegDevice.directSetRegValue(0x6e, SAFE_MAP_OFFSET);
    wasmMachine.nextRegDevice.directSetRegValue(0x6f, SAFE_TILE_DEF_OFFSET);
    writeTileDef(wasmMachine, false, SAFE_TILE_DEF_OFFSET, 1, 0x02);
    writeMapEntry(wasmMachine, false, SAFE_MAP_OFFSET, 40, 4, 4, 1, 0x10);
    wasmMachine.nextRegDevice.directSetRegValue(0x6b, 0x80);
    renderTilemapFixture(wasmMachine);

    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL]).toBe(bgraFromRgb333(0x1c0));
  });

  it("matches the TypeScript oracle for 80x32 paired tilemap pixels", async () => {
    const wasmMachine = await createTestZxNextWasmMachine(createTestZxNextRomSet());

    setTilemapPaletteEntry(wasmMachine, 0x1a, 0x1c0);
    setTilemapPaletteEntry(wasmMachine, 0x15, 0x038);
    wasmMachine.nextRegDevice.directSetRegValue(0x6e, SAFE_MAP_OFFSET);
    wasmMachine.nextRegDevice.directSetRegValue(0x6f, SAFE_TILE_DEF_OFFSET);
    writeTileDefPattern(wasmMachine, false, SAFE_TILE_DEF_OFFSET, 1, 0xa5);
    writeMapEntry(wasmMachine, false, SAFE_MAP_OFFSET, 80, 8, 4, 1, 0x10);
    wasmMachine.nextRegDevice.directSetRegValue(0x6b, 0xc0);
    renderTilemapFixture(wasmMachine);

    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL]).toBe(bgraFromRgb333(0x1c0));
    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL + 1]).toBe(bgraFromRgb333(0x038));
  });

  it("keeps below-ULA tilemap pixels under ULA unless force-on-top is set", async () => {
    const wasmMachine = await createTestZxNextWasmMachine(createTestZxNextRomSet());

    writeUlaPixel(wasmMachine);
    setTilemapPaletteEntry(wasmMachine, 0x12, 0x1c0);
    wasmMachine.nextRegDevice.directSetRegValue(0x6e, SAFE_MAP_OFFSET);
    wasmMachine.nextRegDevice.directSetRegValue(0x6f, SAFE_TILE_DEF_OFFSET);
    writeTileDef(wasmMachine, false, SAFE_TILE_DEF_OFFSET, 1, 0x02);
    writeMapEntry(wasmMachine, false, SAFE_MAP_OFFSET, 40, 4, 4, 1, 0x11);
    wasmMachine.nextRegDevice.directSetRegValue(0x6b, 0x80);
    renderTilemapFixture(wasmMachine);

    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL]).toBe(defaultUlaBgra(15));
    const belowPixel = wasmMachine.getPixelBuffer()[DISPLAY_PIXEL];

    wasmMachine.nextRegDevice.directSetRegValue(0x6b, 0x81);
    renderTilemapFixture(wasmMachine);

    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL]).toBe(bgraFromRgb333(0x1c0));
    expect(wasmMachine.getPixelBuffer()[DISPLAY_PIXEL]).not.toBe(belowPixel);
  });

  it("uses a five-bit map-base offset mask for bank 7 tilemap VRAM", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;
    const bank7Offset0 = OFFS_NEXT_RAM + 7 * 0x4000;

    expect(wasm.zxnextGetTilemapVramOffset(1, 0x20, 0)).toBe(bank7Offset0);
    expect(wasm.zxnextGetTilemapVramOffset(0, 0x20, 0)).toBe(BANK_5_BASE + 0x2000);
  });
});

function writeTileDef(
  machine: TilemapTestMachine,
  useBank7: boolean,
  baseMsb: number,
  tileIndex: number,
  pixelValue: number
): void {
  const bytePair = ((pixelValue & 0x0f) << 4) | (pixelValue & 0x0f);
  for (let i = 0; i < 32; i++) {
    writeTilemapVram(machine, useBank7, baseMsb, tileIndex * 32 + i, bytePair);
  }
}

function writeTileDefPattern(
  machine: TilemapTestMachine,
  useBank7: boolean,
  baseMsb: number,
  tileIndex: number,
  firstByte: number
): void {
  writeTilemapVram(machine, useBank7, baseMsb, tileIndex * 32, firstByte);
  for (let i = 1; i < 32; i++) {
    writeTilemapVram(machine, useBank7, baseMsb, tileIndex * 32 + i, 0x00);
  }
}

function writeMapEntry(
  machine: TilemapTestMachine,
  useBank7: boolean,
  baseMsb: number,
  columns: number,
  col: number,
  row: number,
  tileIndex: number,
  attr: number
): void {
  const entryAddr = (row * columns + col) * 2;
  writeTilemapVram(machine, useBank7, baseMsb, entryAddr, tileIndex);
  writeTilemapVram(machine, useBank7, baseMsb, entryAddr + 1, attr);
}

function writeTilemapVram(
  machine: TilemapTestMachine,
  useBank7: boolean,
  baseMsb: number,
  address: number,
  value: number
): void {
  const physicalOffset = tilemapPhysicalOffset(useBank7, baseMsb, address);
  writePhysical(machine, physicalOffset, value);
}

function writeUlaPixel(machine: TilemapTestMachine): void {
  writePhysical(machine, BANK_5_BASE, 0x80);
  writePhysical(machine, BANK_5_BASE + 0x1800, 0x47);
}

function writePhysical(machine: TilemapTestMachine, offset: number, value: number): void {
  if (machine.wasmV2Runtime != null) {
    machine.wasmV2Runtime.exports.zxnextWritePhysical(offset, value & 0xff);
  } else {
    machine.memoryDevice.memory[offset] = value & 0xff;
  }
}

function tilemapPhysicalOffset(useBank7: boolean, baseMsb: number, address: number): number {
  const offsetMask = useBank7 ? 0x1f : 0x3f;
  const highByte = (((baseMsb & offsetMask) + ((address >> 8) & 0x3f)) & 0x3f) << 8;
  const bankBase = OFFS_NEXT_RAM + (useBank7 ? 7 : 5) * 0x4000;
  return bankBase + highByte + (address & 0xff);
}

function setTilemapPaletteEntry(
  machine: { nextRegDevice: { directSetRegValue(reg: number, value: number): void } },
  index: number,
  rgb333: number
): void {
  machine.nextRegDevice.directSetRegValue(0x43, 0x30);
  machine.nextRegDevice.directSetRegValue(0x40, index);
  machine.nextRegDevice.directSetRegValue(0x44, (rgb333 >> 1) & 0xff);
  machine.nextRegDevice.directSetRegValue(0x44, rgb333 & 0x01);
}

function defaultUlaBgra(index: number): number {
  return bgraFromRgb333(DEFAULT_ULA_COLORS[index & 0x0f]);
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

const DEFAULT_ULA_COLORS = [
  0x000, 0x005, 0x140, 0x145, 0x028, 0x02d, 0x168, 0x16d,
  0x000, 0x007, 0x1c0, 0x1cf, 0x038, 0x03f, 0x1f8, 0x1ff
];

type TilemapTestMachine = {
  wasmV2Runtime?: { exports: { zxnextWritePhysical(offset: number, value: number): number } };
  memoryDevice: { memory: Uint8Array };
  renderInstantScreen(): Uint32Array;
  composedScreenDevice?: { renderFullScreen(): Uint32Array };
};

function renderTilemapFixture(machine: TilemapTestMachine): void {
  if (machine.wasmV2Runtime != null) {
    machine.renderInstantScreen();
  } else {
    machine.composedScreenDevice!.renderFullScreen();
  }
}
