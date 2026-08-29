import { describe, expect, it } from "vitest";

import { OFFS_BANK_05 } from "@emu/machines/zxNext/MemoryDevice";
import {
  ZXNEXT_WASM_V2_SCREEN_HEIGHT,
  ZXNEXT_WASM_V2_SCREEN_WIDTH
} from "@emu/machines/zxNext/wasm/ZxNextWasmV2Loader";
import { zxNextBgra } from "@emu/machines/zxNext/PaletteDevice";
import { createTestNextMachine } from "../../zxnext/TestNextMachine";
import { createTestZxNextWasmMachine, createZxNextOracleHarness } from "./wasm-next-test-helpers";

const STANDARD_SCREEN_WIDTH = 256;
const STANDARD_SCREEN_SCALE_X = 2;
const STANDARD_SCREEN_OUTPUT_WIDTH = STANDARD_SCREEN_WIDTH * STANDARD_SCREEN_SCALE_X;
const STANDARD_SCREEN_HEIGHT = 192;
const STANDARD_SCREEN_X = 96;
const STANDARD_SCREEN_Y = (ZXNEXT_WASM_V2_SCREEN_HEIGHT - STANDARD_SCREEN_HEIGHT) / 2;
const TILEMAP_SCREEN_X = 32;
const TILEMAP_SCREEN_Y = STANDARD_SCREEN_Y - (256 - STANDARD_SCREEN_HEIGHT) / 2;

describe("ZX Next WASM advanced video tilemap", () => {
  it("matches TypeScript tilemap control, clip, scroll, and base registers", async () => {
    const oracle = await createTestNextMachine();
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;
    const screen = oracle.composedScreenDevice;

    for (const [reg, value] of [
      [0x1b, 0x01],
      [0x1b, 0x9f],
      [0x1b, 0x02],
      [0x1b, 0xfe],
      [0x2f, 0x02],
      [0x30, 0x55],
      [0x31, 0x44],
      [0x4c, 0x07],
      [0x6b, 0xf3],
      [0x6c, 0x9b],
      [0x6e, 0xa0],
      [0x6f, 0x9f]
    ]) {
      oracle.nextRegDevice.directSetRegValue(reg, value);
      exports.zxnextSetNextRegisterDirect(reg, value);
    }

    expect(exports.zxnextGetTilemapEnabled()).toBe(screen.tilemapEnabled ? 1 : 0);
    expect(exports.zxnextGetTilemapNextReg(0x6b)).toBe(
      (screen.tilemapEnabled ? 0x80 : 0) |
        (screen.tilemap80x32Resolution ? 0x40 : 0) |
        (screen.tilemapEliminateAttributes ? 0x20 : 0) |
        (oracle.paletteDevice.secondTilemapPalette ? 0x10 : 0) |
        (screen.tilemapTextMode ? 0x08 : 0) |
        (screen.tilemap512TileMode ? 0x02 : 0) |
        (screen.tilemapForceOnTopOfUla ? 0x01 : 0)
    );
    expect([0, 1, 2, 3].map(i => exports.zxnextGetTilemapClip(i))).toEqual([
      screen.tilemapClipWindowX1,
      screen.tilemapClipWindowX2,
      screen.tilemapClipWindowY1,
      screen.tilemapClipWindowY2
    ]);
    expect(exports.zxnextGetTilemapScrollX()).toBe(screen.tilemapScrollX);
    expect(exports.zxnextGetTilemapScrollY()).toBe(screen.tilemapScrollY);
    expect(exports.zxnextGetTilemapPaletteOffset()).toBe(screen.tilemapPaletteOffset);
    expect(exports.zxnextGetTilemapBaseAddressUseBank7()).toBe(screen.tilemapUseBank7 ? 1 : 0);
    expect(exports.zxnextGetTilemapBaseAddressMsb()).toBe(screen.tilemapBank5Msb);
    expect(exports.zxnextGetTilemapDefinitionAddressUseBank7()).toBe(screen.tilemapTileDefUseBank7 ? 1 : 0);
    expect(exports.zxnextGetTilemapDefinitionAddressMsb()).toBe(screen.tilemapTileDefBank5Msb);
  });

  it("renders 40x32 graphics tilemap pixels from bank 5 over ULA", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;
    oracle.hardReset();
    wasm.hardReset();

    for (const [reg, value] of [
      [0x1c, 0x08],
      [0x1b, 0x00],
      [0x1b, 0x9f],
      [0x1b, 0x00],
      [0x1b, 0xff],
      [0x2f, 0x00],
      [0x30, 0x00],
      [0x31, 0x00],
      [0x6e, 0x00],
      [0x6f, 0x18],
      [0x43, 0x30],
      [0x40, 0x00],
      [0x41, 0x00],
      [0x41, 0x03],
      [0x41, 0xe0],
      [0x41, 0xe3],
      [0x41, 0x1c],
      [0x41, 0x1f],
      [0x41, 0xfc],
      [0x41, 0xff],
      [0x6b, 0xa1],
      [0x6c, 0x00]
    ]) {
      oracle.nextRegDevice.directSetRegValue(reg, value);
      exports.zxnextSetNextRegisterDirect(reg, value);
    }

    const tileBytes = [
      0x00, 0x00, 0x00, 0x00,
      0x04, 0x44, 0x44, 0x40,
      0x04, 0x44, 0x44, 0x40,
      0x04, 0x44, 0x22, 0x22,
      0x04, 0x44, 0x22, 0x22,
      0x04, 0x44, 0x33, 0x33,
      0x04, 0x44, 0x33, 0x33,
      0x04, 0x44, 0x11, 0x11
    ];
    for (let i = 0; i < tileBytes.length; i++) {
      oracle.memoryDevice.memory[OFFS_BANK_05 + 0x1800 + i] = tileBytes[i];
      wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + 0x1800 + i] = tileBytes[i];
    }

    const oraclePixels = oracle.composedScreenDevice.renderFullScreen();
    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    expect(pixels[tilemapScreenIndex(0, 1)]).toBe(oraclePixels[tilemapScreenIndex(0, 1)]);
    expect(pixels[tilemapScreenIndex(2, 1)]).toBe(oraclePixels[tilemapScreenIndex(2, 1)]);
    expect(pixels[tilemapScreenIndex(2, 1)]).toBe(tilemapPaletteBgra(4));
    expect(pixels[tilemapScreenIndex(0, 3)]).toBe(tilemapPaletteBgra(0));
    expect(pixels[tilemapScreenIndex(12, 3)]).toBe(tilemapPaletteBgra(2));
    expect(pixels[tilemapScreenIndex(0, 7)]).toBe(tilemapPaletteBgra(0));
    expect(pixels[tilemapScreenIndex(12, 7)]).toBe(tilemapPaletteBgra(1));
  });

  it("renders 80x32 graphics tilemap pixels from bank 5 over ULA", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;
    oracle.hardReset();
    wasm.hardReset();

    for (const [reg, value] of [
      [0x1c, 0x08],
      [0x1b, 0x00],
      [0x1b, 0x9f],
      [0x1b, 0x00],
      [0x1b, 0xff],
      [0x2f, 0x00],
      [0x30, 0x00],
      [0x31, 0x00],
      [0x6e, 0x00],
      [0x6f, 0x18],
      [0x43, 0x30],
      [0x40, 0x00],
      [0x41, 0x00],
      [0x41, 0x03],
      [0x41, 0xe0],
      [0x41, 0xe3],
      [0x41, 0x1c],
      [0x41, 0x1f],
      [0x41, 0xfc],
      [0x41, 0xff],
      [0x6b, 0xe1],
      [0x6c, 0x0e]
    ]) {
      oracle.nextRegDevice.directSetRegValue(reg, value);
      exports.zxnextSetNextRegisterDirect(reg, value);
    }

    const tileBytes = [
      0x00, 0x00, 0x00, 0x00,
      0x04, 0x44, 0x44, 0x40,
      0x04, 0x44, 0x44, 0x40,
      0x04, 0x44, 0x22, 0x22,
      0x04, 0x44, 0x22, 0x22,
      0x04, 0x44, 0x33, 0x33,
      0x04, 0x44, 0x33, 0x33,
      0x04, 0x44, 0x11, 0x11,
      0x55, 0x55, 0x55, 0x55,
      0x55, 0x55, 0x55, 0x55,
      0x55, 0x55, 0x55, 0x55,
      0x55, 0x55, 0x55, 0x55,
      0x55, 0x55, 0x55, 0x55,
      0x55, 0x55, 0x55, 0x55,
      0x55, 0x55, 0x55, 0x55,
      0x55, 0x55, 0x55, 0x55,
      0x66, 0x66, 0x66, 0x66,
      0x66, 0x66, 0x66, 0x66,
      0x66, 0x66, 0x66, 0x66,
      0x66, 0x66, 0x66, 0x66,
      0x66, 0x66, 0x66, 0x66,
      0x66, 0x66, 0x66, 0x66,
      0x66, 0x66, 0x66, 0x66,
      0x66, 0x66, 0x66, 0x66
    ];
    for (let i = 0; i < tileBytes.length; i++) {
      oracle.memoryDevice.memory[OFFS_BANK_05 + 0x1800 + i] = tileBytes[i];
      wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + 0x1800 + i] = tileBytes[i];
    }
    for (const [address, value] of [
      [0x0001, 0x01],
      [0x0003, 0x02],
      [0x0006, 0x01],
      [0x0007, 0x02],
      [0x0052, 0x01],
      [0x0054, 0x02]
    ]) {
      oracle.memoryDevice.memory[OFFS_BANK_05 + address] = value;
      wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + address] = value;
    }

    const oraclePixels = oracle.composedScreenDevice.renderFullScreen();
    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    for (const [x, y] of [
      [0, 0],
      [8, 0],
      [24, 0],
      [48, 0],
      [56, 0],
      [16, 8],
      [32, 8],
      [0, 7],
      [1, 7],
      [12, 7]
    ]) {
      expect(pixels[tilemapScreenIndex(x, y)]).toBe(oraclePixels[tilemapScreenIndex(x, y)]);
    }
    expect(pixels[tilemapScreenIndex(8, 0)]).toBe(tilemapPaletteBgra(5));
    expect(pixels[tilemapScreenIndex(24, 0)]).toBe(tilemapPaletteBgra(6));
  });

  it("renders 40x32 text tilemap pixels from 1bpp tile definitions", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;
    oracle.hardReset();
    wasm.hardReset();

    for (const [reg, value] of [
      [0x1c, 0x00],
      [0x1b, 0x00],
      [0x1b, 0x9f],
      [0x1b, 0x00],
      [0x1b, 0xff],
      [0x2f, 0x00],
      [0x30, 0x00],
      [0x31, 0x00],
      [0x6e, 0x20],
      [0x6f, 0x30],
      [0x43, 0x30],
      [0x40, 0x00],
      [0x41, 0x00],
      [0x41, 0x03],
      [0x41, 0xe0],
      [0x41, 0xe3],
      [0x41, 0x1c],
      [0x41, 0x1f],
      [0x41, 0xfc],
      [0x41, 0xff],
      [0x6b, 0xa9],
      [0x6c, 0x02]
    ]) {
      oracle.nextRegDevice.directSetRegValue(reg, value);
      exports.zxnextSetNextRegisterDirect(reg, value);
    }

    const tileBytes = [0xff, 0x81, 0x81, 0x83, 0x87, 0x8f, 0x9f, 0xff];
    for (let i = 0; i < 40 * 32; i++) {
      oracle.memoryDevice.memory[OFFS_BANK_05 + 0x2000 + i] = 0x00;
      wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + 0x2000 + i] = 0x00;
    }
    for (let i = 0; i < tileBytes.length; i++) {
      oracle.memoryDevice.memory[OFFS_BANK_05 + 0x3000 + i] = tileBytes[i];
      wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + 0x3000 + i] = tileBytes[i];
    }

    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    expect40ColumnTextTilePattern(pixels, tilemapPaletteBgra(2));
  });

  it("renders 80x32 text tilemap pixels from 1bpp tile definitions", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;
    oracle.hardReset();
    wasm.hardReset();

    for (const [reg, value] of [
      [0x1c, 0x08],
      [0x1b, 0x00],
      [0x1b, 0x9f],
      [0x1b, 0x00],
      [0x1b, 0xff],
      [0x2f, 0x00],
      [0x30, 0x00],
      [0x31, 0x00],
      [0x6e, 0x20],
      [0x6f, 0x30],
      [0x43, 0x30],
      [0x40, 0x00],
      [0x41, 0x00],
      [0x41, 0x03],
      [0x41, 0xe0],
      [0x41, 0xe3],
      [0x41, 0x1c],
      [0x41, 0x1f],
      [0x41, 0xfc],
      [0x41, 0xff],
      [0x6b, 0xe9],
      [0x6c, 0x02]
    ]) {
      oracle.nextRegDevice.directSetRegValue(reg, value);
      exports.zxnextSetNextRegisterDirect(reg, value);
    }

    const tileBytes = [0xff, 0x81, 0x81, 0x83, 0x87, 0x8f, 0x9f, 0xff];
    for (let i = 0; i < 80 * 32; i++) {
      oracle.memoryDevice.memory[OFFS_BANK_05 + 0x2000 + i] = 0x00;
      wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + 0x2000 + i] = 0x00;
    }
    for (let i = 0; i < tileBytes.length; i++) {
      oracle.memoryDevice.memory[OFFS_BANK_05 + 0x3000 + i] = tileBytes[i];
      wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + 0x3000 + i] = tileBytes[i];
    }

    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    expect80ColumnTextTilePattern(pixels, tilemapPaletteBgra(2));
  });
});

function tilemapScreenIndex(x: number, y: number): number {
  return (TILEMAP_SCREEN_Y + y) * ZXNEXT_WASM_V2_SCREEN_WIDTH + TILEMAP_SCREEN_X + x;
}

function tilemapPaletteBgra(index: number): number {
  const valuesWrittenThroughReg41 = [0x00, 0x03, 0xe0, 0xe3, 0x1c, 0x1f, 0xfc, 0xff];
  const value = valuesWrittenThroughReg41[index];
  return zxNextBgra[((value << 1) | (value & 0x03 ? 0x01 : 0x00)) & 0x1ff];
}

function expect40ColumnTextTilePattern(pixels: Uint32Array, visibleColor: number): void {
  for (const x of [0, 1, 14, 15]) {
    expect(pixels[tilemapScreenIndex(x, 1)]).not.toBe(visibleColor);
  }
  for (let x = 2; x < 14; x++) {
    expect(pixels[tilemapScreenIndex(x, 1)]).toBe(visibleColor);
  }
  for (let x = 0; x < 16; x++) {
    expect(pixels[tilemapScreenIndex(x, 0)]).not.toBe(visibleColor);
    expect(pixels[tilemapScreenIndex(x, 7)]).not.toBe(visibleColor);
  }
}

function expect80ColumnTextTilePattern(pixels: Uint32Array, visibleColor: number): void {
  expect(pixels[tilemapScreenIndex(0, 1)]).not.toBe(visibleColor);
  expect(pixels[tilemapScreenIndex(7, 1)]).not.toBe(visibleColor);
  for (let x = 1; x < 7; x++) {
    expect(pixels[tilemapScreenIndex(x, 1)]).toBe(visibleColor);
  }
  for (let x = 0; x < 8; x++) {
    expect(pixels[tilemapScreenIndex(x, 0)]).not.toBe(visibleColor);
    expect(pixels[tilemapScreenIndex(x, 7)]).not.toBe(visibleColor);
  }
}
