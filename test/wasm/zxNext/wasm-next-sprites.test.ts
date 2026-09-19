import { describe, expect, it } from "vitest";

import { zxNextBgra } from "@emu/machines/zxNext/nextColorTables";
import {
  ZXNEXT_WASM_V2_SCREEN_HEIGHT,
  ZXNEXT_WASM_V2_SCREEN_WIDTH
} from "@emu/machines/zxNext/wasm/ZxNextWasmV2Loader";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

const STANDARD_SCREEN_HEIGHT = 192;
const STANDARD_SCREEN_Y = (ZXNEXT_WASM_V2_SCREEN_HEIGHT - STANDARD_SCREEN_HEIGHT) / 2;
const LAYER2_WIDE_SCREEN_HEIGHT = 256;
const LAYER2_WIDE_SCREEN_X = 32;
const LAYER2_WIDE_SCREEN_Y = STANDARD_SCREEN_Y - (LAYER2_WIDE_SCREEN_HEIGHT - STANDARD_SCREEN_HEIGHT) / 2;

/*
 * Values marked "pinned" are the ones both the WASM and the TypeScript cores agreed on at tag
 * `pre-zxnext-ts-removal-2026-09-19`.
 */
describe("ZX Next WASM advanced video sprites", () => {
  it("tracks clip state, sequential attributes, and transformed pattern writes", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    for (const value of [0x23, 0x34, 0x45, 0x56]) {
      exports.zxnextSetNextRegisterDirect(0x19, value);
    }
    exports.zxnextSpriteWritePort303b(0x82);
    for (const value of [0x11, 0x22, 0xf6, 0xc2, 0xa9]) {
      exports.zxnextSpriteWritePort57(value);
    }
    exports.zxnextSpriteWritePort5b(0xab);

    // --- Four $19 writes fill x1, x2, y1, y2 in order
    expect([0, 1, 2, 3].map(i => exports.zxnextGetSpriteClip(i))).toEqual([0x23, 0x34, 0x45, 0x56]);
    // --- $303B = $82 selects sprite 2 and pattern 2, second half ($80); attr3 bit 6 makes it a
    // --- 5-byte sprite, so five $57 writes move on to sprite 3, and one $5B write to sub-index $81
    expect(exports.zxnextGetSpriteIndex()).toBe(3);
    expect(exports.zxnextGetSpritePatternIndex()).toBe(2);
    expect(exports.zxnextGetSpritePatternSubIndex()).toBe(0x81);
    expect(exports.zxnextGetSpriteSubIndex()).toBe(0);
    expect([0, 1, 2, 3, 4].map(attr => exports.zxnextGetSpriteAttribute(2, attr))).toEqual([
      0x11,
      0x22,
      0xf6,
      0xc2,
      0xa9
    ]);
    // --- pinned
    expect(exports.zxnextGetSpritePatternByte8(16, 0x80)).toBe(0xab);
    expect(exports.zxnextGetSpritePatternByte8(17, 0x70)).toBe(0xab);
    /*
     * On the hardware, $AB written at pattern 2, sub-index
     * $80 is byte 0 of 4-bit pattern 5 (2 * 2 + 1): pixel 0 is its high nibble, pixel 1 its low one.
     * See `wasm-next-sprites-fpga.test.ts`.
     */
    expect(exports.zxnextGetSpritePatternByte4(5 << 3, 0x00)).toBe(0x0a);
    expect(exports.zxnextGetSpritePatternByte4(5 << 3, 0x01)).toBe(0x0b);
  });

  it("routes sprite ports and renders a BASIC-style 4-byte visible sprite", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;
    wasm.hardReset();

    wasm.doWritePort(0x303b, 0x00);
    for (let i = 0; i < 256; i++) {
      const value = i === 0 ? 0x11 : 0xe3;
      wasm.doWritePort(0x005b, value);
    }

    wasm.doWritePort(0x303b, 0x00);
    for (const value of [0x18, 0x18, 0x00, 0x80]) {
      wasm.doWritePort(0x0057, value);
    }

    exports.zxnextSetNextRegisterDirect(0x15, 0x03);

    expect(exports.zxnextGetSpritePatternByte8(0, 0)).toBe(0x11);
    expect(exports.zxnextGetSpriteAttribute(0, 0)).toBe(0x18);
    expect(exports.zxnextGetSpriteAttribute(0, 1)).toBe(0x18);
    expect(exports.zxnextGetSpriteAttribute(0, 3)).toBe(0x80);
    expect(exports.zxnextGetSpriteIndex()).toBe(1);
    expect(exports.zxnextGetNextRegisterDirect(0x15)).toBe(0x03); // $15 reads back all 8 bits

    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();
    const visibleIndex = spriteScreenIndex(0x18, 0x18);
    const duplicatedIndex = spriteScreenIndex(0x18, 0x18) + 1;
    const transparentIndex = spriteScreenIndex(0x19, 0x18);

    expect(exports.zxnextGetSpritePatternByte8(0, 0)).toBe(0x11);
    expect(exports.zxnextGetSpritePatternByte8(0, 1)).toBe(0xe3);
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
