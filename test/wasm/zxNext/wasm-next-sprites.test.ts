import { describe, expect, it } from "vitest";

import {
  createTestZxNextRomSet,
  createTestZxNextWasmMachine,
  type TestZxNextWasmMachine
} from "./wasm-next-test-helpers";

const SCREEN_WIDTH = 720;
const DISPLAY_X = 96;
const DISPLAY_Y_50HZ = 48;
const DISPLAY_PIXEL = DISPLAY_Y_50HZ * SCREEN_WIDTH + DISPLAY_X;
const SPRITE_X_AT_DISPLAY_ORIGIN = 32;
const SPRITE_Y_AT_DISPLAY_ORIGIN = 32;

describe("ZX Spectrum Next WASM v2 sprites", () => {
  it("owns sprite NextRegs and diagnostic state", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.writeNextReg(0x09, 0x10);
    machine.writeNextReg(0x15, 0x63);
    machine.writeNextReg(0x1c, 0x02);
    machine.writeNextReg(0x19, 0x11);
    machine.writeNextReg(0x19, 0x22);
    machine.writeNextReg(0x19, 0x33);
    machine.writeNextReg(0x19, 0x44);
    machine.writeNextReg(0x4b, 0x0a);
    machine.writeNextReg(0x34, 0x44);
    machine.writeNextReg(0x35, 0x99);
    machine.writeNextReg(0x75, 0x88);

    expect(machine.readNextReg(0x09)).toBe(0x10);
    expect(machine.readNextReg(0x15)).toBe(0x63);
    expect(machine.readNextReg(0x19)).toBe(0x11);
    expect(machine.readNextReg(0x34)).toBe(0x45);
    expect(machine.readNextReg(0x4b)).toBe(0x0a);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      spriteMirrorTie: true,
      spriteMirrorQ: 0x45,
      spriteMirrorIndex: 0,
      spriteMirrorInc: true,
      sprite0OnTop: true,
      spriteClippingEnabled: true,
      spritesEnabled: true,
      spritesOverBorderEnabled: true,
      spriteClipIndex: 0,
      spriteClipWindowX1: 0x11,
      spriteClipWindowX2: 0x22,
      spriteClipWindowY1: 0x33,
      spriteClipWindowY2: 0x44,
      spriteTransparencyIndex: 0x0a,
      spritePatternIndex: 0x05,
      spritePatternSubIndex: 0,
      spriteIndex: 0x45,
      spriteSubIndex: 0
    });
    expect(machine.wasmV2Runtime!.exports.zxnextGetSpriteAttribute(0x44, 0)).toBe(0x88);
  });

  it("writes 8-bit and 4-bit sprite pattern variants through port 0x5b", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    machine.doWritePort(0x303b, 0x00);
    machine.doWritePort(0x005b, 0x11);
    machine.doWritePort(0x005b, 0x22);

    expect(wasm.zxnextReadSpritePattern8(0, 0)).toBe(0x11);
    expect(wasm.zxnextReadSpritePattern8(0, 1)).toBe(0x22);
    expect(wasm.zxnextReadSpritePattern8(2, 15)).toBe(0x11);
    expect(wasm.zxnextReadSpritePattern8(2, 14)).toBe(0x22);
    expect(wasm.zxnextReadSpritePattern8(4, 15)).toBe(0x11);
    expect(wasm.zxnextReadSpritePattern8(4, 31)).toBe(0x22);
    expect(wasm.zxnextReadSpritePattern4(0, 0)).toBe(0x01);
    expect(wasm.zxnextReadSpritePattern4(0, 1)).toBe(0x02);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      spritePatternIndex: 0,
      spritePatternSubIndex: 2
    });
  });

  it("renders 8-bit sprite pixels with upper-nibble palette offset", async () => {
    const machine = await createTestZxNextWasmMachine(createTestZxNextRomSet());

    setSpritePaletteEntry(machine, 0x3a, 0x1c0);
    machine.doWritePort(0x303b, 0x00);
    machine.doWritePort(0x005b, 0x2a);
    writeSequentialSprite(machine, SPRITE_X_AT_DISPLAY_ORIGIN, SPRITE_Y_AT_DISPLAY_ORIGIN, 0x10, 0x80);
    machine.writeNextReg(0x15, 0x01);
    machine.renderInstantScreen();

    expect(machine.getPixelBuffer()[DISPLAY_PIXEL]).toBe(bgraFromRgb333(0x1c0));
  });

  it("renders 4-bit sprite pixels with palette offset replacing the upper nibble", async () => {
    const machine = await createTestZxNextWasmMachine(createTestZxNextRomSet());

    setSpritePaletteEntry(machine, 0x2b, 0x038);
    machine.doWritePort(0x303b, 0x00);
    machine.doWritePort(0x005b, 0x0b);
    writeSequentialSprite(machine, SPRITE_X_AT_DISPLAY_ORIGIN, SPRITE_Y_AT_DISPLAY_ORIGIN, 0x20, 0xc0, 0x80);
    machine.writeNextReg(0x15, 0x01);
    machine.renderInstantScreen();

    expect(machine.getPixelBuffer()[DISPLAY_PIXEL]).toBe(bgraFromRgb333(0x038));
  });

  it("applies sprite priority and latches collision status for overlapping pixels", async () => {
    const machine = await createTestZxNextWasmMachine(createTestZxNextRomSet());

    setSpritePaletteEntry(machine, 0x21, 0x1c0);
    setSpritePaletteEntry(machine, 0x31, 0x038);
    writeSinglePatternPixel(machine, 0, 0x21);
    writeSinglePatternPixel(machine, 1, 0x31);
    machine.doWritePort(0x303b, 0x00);
    writeSequentialSprite(machine, SPRITE_X_AT_DISPLAY_ORIGIN, SPRITE_Y_AT_DISPLAY_ORIGIN, 0x00, 0x80);
    writeSequentialSprite(machine, SPRITE_X_AT_DISPLAY_ORIGIN, SPRITE_Y_AT_DISPLAY_ORIGIN, 0x00, 0x81);

    machine.writeNextReg(0x15, 0x01);
    machine.renderInstantScreen();
    expect(machine.getPixelBuffer()[DISPLAY_PIXEL]).toBe(bgraFromRgb333(0x038));
    expect(machine.doReadPort(0x303b)).toBe(0x01);
    expect(machine.doReadPort(0x303b)).toBe(0x00);

    machine.writeNextReg(0x15, 0x41);
    machine.renderInstantScreen();
    expect(machine.getPixelBuffer()[DISPLAY_PIXEL]).toBe(bgraFromRgb333(0x1c0));
  });
});

function writeSinglePatternPixel(machine: TestZxNextWasmMachine, patternIndex: number, value: number): void {
  machine.doWritePort(0x303b, patternIndex & 0x3f);
  machine.doWritePort(0x005b, value & 0xff);
}

function writeSequentialSprite(
  machine: TestZxNextWasmMachine,
  x: number,
  y: number,
  attr2: number,
  attr3: number,
  attr4?: number
): void {
  machine.doWritePort(0x0057, x & 0xff);
  machine.doWritePort(0x0057, y & 0xff);
  machine.doWritePort(0x0057, attr2 & 0xff);
  machine.doWritePort(0x0057, attr3 & 0xff);
  if (attr4 != null) machine.doWritePort(0x0057, attr4 & 0xff);
}

function setSpritePaletteEntry(machine: TestZxNextWasmMachine, index: number, rgb333: number): void {
  machine.writeNextReg(0x43, 0x20);
  machine.writeNextReg(0x40, index);
  machine.writeNextReg(0x44, (rgb333 >> 1) & 0xff);
  machine.writeNextReg(0x44, rgb333 & 0x01);
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
