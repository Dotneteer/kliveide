import { describe, expect, it } from "vitest";

import { createTestNextMachine } from "../../zxnext/TestNextMachine";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

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
});
