import { describe, expect, it } from "vitest";

import { createTestNextMachine } from "../../zxnext/TestNextMachine";
import { zxNextBgra } from "@emu/machines/zxNext/PaletteDevice";
import {
  ZXNEXT_WASM_V2_SCREEN_HEIGHT,
  ZXNEXT_WASM_V2_SCREEN_WIDTH
} from "@emu/machines/zxNext/wasm/ZxNextWasmV2Loader";
import { createTestZxNextWasmMachine, createZxNextOracleHarness } from "./wasm-next-test-helpers";

const STANDARD_SCREEN_HEIGHT = 192;
const STANDARD_SCREEN_Y = (ZXNEXT_WASM_V2_SCREEN_HEIGHT - STANDARD_SCREEN_HEIGHT) / 2;
const LAYER2_WIDE_SCREEN_HEIGHT = 256;
const LAYER2_WIDE_SCREEN_X = 32;
const LAYER2_WIDE_SCREEN_Y = STANDARD_SCREEN_Y - (LAYER2_WIDE_SCREEN_HEIGHT - STANDARD_SCREEN_HEIGHT) / 2;

describe("ZX Next WASM advanced video sprites", () => {
  it("matches clip state, sequential attributes, and transformed pattern writes", async () => {
    const oracle = await createTestNextMachine();
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;
    const sprites = oracle.spriteDevice;

    for (const value of [0x23, 0x34, 0x45, 0x56]) {
      oracle.nextRegDevice.directSetRegValue(0x19, value);
      exports.zxnextSetNextRegisterDirect(0x19, value);
    }
    sprites.writePort303bValue(0x82);
    exports.zxnextSpriteWritePort303b(0x82);
    for (const value of [0x11, 0x22, 0xf6, 0xc2, 0xa9]) {
      sprites.writeSpriteAttribute(0x57, value);
      exports.zxnextSpriteWritePort57(value);
    }
    sprites.writeSpritePattern(0xab);
    exports.zxnextSpriteWritePort5b(0xab);

    expect([0, 1, 2, 3].map(i => exports.zxnextGetSpriteClip(i))).toEqual([
      sprites.clipWindowX1,
      sprites.clipWindowX2,
      sprites.clipWindowY1,
      sprites.clipWindowY2
    ]);
    expect(exports.zxnextGetSpriteIndex()).toBe(sprites.spriteIndex);
    expect(exports.zxnextGetSpritePatternIndex()).toBe(sprites.patternIndex);
    expect(exports.zxnextGetSpritePatternSubIndex()).toBe(sprites.patternSubIndex);
    expect(exports.zxnextGetSpriteSubIndex()).toBe(sprites.spriteSubIndex);
    expect([0, 1, 2, 3, 4].map(attr => exports.zxnextGetSpriteAttribute(2, attr))).toEqual([
      0x11,
      0x22,
      0xf6,
      0xc2,
      0xa9
    ]);
    expect(exports.zxnextGetSpritePatternByte8(16, 0x80)).toBe(sprites.patternMemory8bit[16][0x80]);
    expect(exports.zxnextGetSpritePatternByte8(17, 0x70)).toBe(sprites.patternMemory8bit[17][0x70]);
    expect(exports.zxnextGetSpritePatternByte4(40, 0x80)).toBe(sprites.patternMemory4bit[40][0x80]);
  });

  it("routes sprite ports and renders a BASIC-style 4-byte visible sprite", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;
    oracle.hardReset();
    wasm.hardReset();

    oracle.doWritePort(0x303b, 0x00);
    wasm.doWritePort(0x303b, 0x00);
    for (let i = 0; i < 256; i++) {
      const value = i === 0 ? 0x11 : 0xe3;
      oracle.doWritePort(0x005b, value);
      wasm.doWritePort(0x005b, value);
    }

    oracle.doWritePort(0x303b, 0x00);
    wasm.doWritePort(0x303b, 0x00);
    for (const value of [0x18, 0x18, 0x00, 0x80]) {
      oracle.doWritePort(0x0057, value);
      wasm.doWritePort(0x0057, value);
    }

    oracle.nextRegDevice.directSetRegValue(0x15, 0x03);
    exports.zxnextSetNextRegisterDirect(0x15, 0x03);

    expect(exports.zxnextGetSpritePatternByte8(0, 0)).toBe(0x11);
    expect(exports.zxnextGetSpriteAttribute(0, 0)).toBe(0x18);
    expect(exports.zxnextGetSpriteAttribute(0, 1)).toBe(0x18);
    expect(exports.zxnextGetSpriteAttribute(0, 3)).toBe(0x80);
    expect(exports.zxnextGetSpriteIndex()).toBe(1);
    expect(exports.zxnextGetNextRegisterDirect(0x15)).toBe(oracle.nextRegDevice.directGetRegValue(0x15));

    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();
    const visibleIndex = spriteScreenIndex(0x18, 0x18);
    const duplicatedIndex = spriteScreenIndex(0x18, 0x18) + 1;
    const transparentIndex = spriteScreenIndex(0x19, 0x18);

    expect(exports.zxnextGetSpritePatternByte8(0, 0)).toBe(oracle.spriteDevice.patternMemory8bit[0][0]);
    expect(exports.zxnextGetSpritePatternByte8(0, 1)).toBe(oracle.spriteDevice.patternMemory8bit[0][1]);
    expect(pixels[visibleIndex]).toBe(spriteBgra(0x11));
    expect(pixels[duplicatedIndex]).toBe(spriteBgra(0x11));
    expect(pixels[transparentIndex]).not.toBe(spriteBgra(0xe3));
  });
});

function spriteScreenIndex(x: number, y: number): number {
  return (LAYER2_WIDE_SCREEN_Y + y) * ZXNEXT_WASM_V2_SCREEN_WIDTH + LAYER2_WIDE_SCREEN_X + x * 2;
}

function spriteBgra(index: number): number {
  return zxNextBgra[((index << 1) | (index & 0x02 ? 0x01 : 0x00)) & 0x1ff];
}
