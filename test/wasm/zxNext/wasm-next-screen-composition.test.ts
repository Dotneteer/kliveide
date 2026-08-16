import { describe, expect, it } from "vitest";

import { OFFS_NEXT_RAM } from "@emu/machines/zxNext/MemoryDevice";
import {
  createTestZxNextRomSet,
  createTestZxNextWasmMachine,
  type TestZxNextWasmMachine
} from "./wasm-next-test-helpers";

const SCREEN_WIDTH = 720;
const DISPLAY_X = 96;
const DISPLAY_Y_50HZ = 48;
const DISPLAY_PIXEL = DISPLAY_Y_50HZ * SCREEN_WIDTH + DISPLAY_X;
const BANK_5_BASE = OFFS_NEXT_RAM + 5 * 0x4000;
const LAYER2_BANK_8_BASE = OFFS_NEXT_RAM + 8 * 0x4000;
const SPRITE_X_AT_DISPLAY_ORIGIN = 32;
const SPRITE_Y_AT_DISPLAY_ORIGIN = 32;

const ULA_RGB = 0x1ff;
const LAYER2_RGB = 0x1c0;
const SPRITE_RGB = 0x038;

describe("ZX Spectrum Next WASM v2 screen composition", () => {
  it("selects the expected layer for the six standard NR $15 priority modes", async () => {
    const machine = await createComposedPixelFixture();
    const expectedByPriority = [
      SPRITE_RGB, // SLU
      LAYER2_RGB, // LSU
      SPRITE_RGB, // SUL
      LAYER2_RGB, // LUS
      ULA_RGB, // USL
      ULA_RGB // ULS
    ];

    for (let priority = 0; priority < expectedByPriority.length; priority++) {
      machine.writeNextReg(0x15, 0x01 | (priority << 2));
      machine.renderInstantScreen();
      expect(machine.getPixelBuffer()[DISPLAY_PIXEL], `priority ${priority}`).toBe(
        bgraFromRgb333(expectedByPriority[priority])
      );
    }
  });

  it("lets the Layer 2 priority bit override standard layer priority", async () => {
    const machine = await createComposedPixelFixture({ layer2Priority: true });

    machine.writeNextReg(0x15, 0x01);
    machine.renderInstantScreen();

    expect(machine.getPixelBuffer()[DISPLAY_PIXEL]).toBe(bgraFromRgb333(LAYER2_RGB));
  });

  it("blends ULA/tilemap and Layer 2 in priority modes 6 and 7", async () => {
    const machine = await createComposedPixelFixture({ includeSprite: false });

    machine.writeNextReg(0x15, 0x18);
    machine.renderInstantScreen();
    expect(machine.getPixelBuffer()[DISPLAY_PIXEL]).toBe(
      bgraFromRgb333(blendRgb333(ULA_RGB, LAYER2_RGB, 0))
    );

    machine.writeNextReg(0x15, 0x1c);
    machine.renderInstantScreen();
    expect(machine.getPixelBuffer()[DISPLAY_PIXEL]).toBe(
      bgraFromRgb333(blendRgb333(ULA_RGB, LAYER2_RGB, 1))
    );
  });
});

async function createComposedPixelFixture(options: {
  includeSprite?: boolean;
  layer2Priority?: boolean;
} = {}): Promise<TestZxNextWasmMachine> {
  const includeSprite = options.includeSprite ?? true;
  const machine = await createTestZxNextWasmMachine(createTestZxNextRomSet());

  writeUlaOriginPixel(machine);
  setLayer2PaletteEntry(machine, 0x42, LAYER2_RGB, options.layer2Priority ?? false);
  writePhysical(machine, LAYER2_BANK_8_BASE, 0x42);
  machine.writeNextReg(0x70, 0x00);
  machine.doWritePort(0x123b, 0x02);

  if (includeSprite) {
    setSpritePaletteEntry(machine, 0x21, SPRITE_RGB);
    machine.doWritePort(0x303b, 0x00);
    machine.doWritePort(0x005b, 0x21);
    writeSequentialSprite(machine, SPRITE_X_AT_DISPLAY_ORIGIN, SPRITE_Y_AT_DISPLAY_ORIGIN, 0x00, 0x80);
  }

  return machine;
}

function writeUlaOriginPixel(machine: TestZxNextWasmMachine): void {
  setUlaPaletteEntry(machine, 0x0f, ULA_RGB);
  writePhysical(machine, BANK_5_BASE, 0x80);
  writePhysical(machine, BANK_5_BASE + 0x1800, 0x47);
}

function writeSequentialSprite(
  machine: TestZxNextWasmMachine,
  x: number,
  y: number,
  attr2: number,
  attr3: number
): void {
  machine.doWritePort(0x0057, x & 0xff);
  machine.doWritePort(0x0057, y & 0xff);
  machine.doWritePort(0x0057, attr2 & 0xff);
  machine.doWritePort(0x0057, attr3 & 0xff);
}

function setUlaPaletteEntry(machine: TestZxNextWasmMachine, index: number, rgb333: number): void {
  machine.writeNextReg(0x43, 0x00);
  writePaletteEntry(machine, index, rgb333);
}

function setLayer2PaletteEntry(
  machine: TestZxNextWasmMachine,
  index: number,
  rgb333: number,
  priority: boolean
): void {
  machine.writeNextReg(0x43, 0x10);
  writePaletteEntry(machine, index, rgb333, priority);
}

function setSpritePaletteEntry(machine: TestZxNextWasmMachine, index: number, rgb333: number): void {
  machine.writeNextReg(0x43, 0x20);
  writePaletteEntry(machine, index, rgb333);
}

function writePaletteEntry(
  machine: TestZxNextWasmMachine,
  index: number,
  rgb333: number,
  priority = false
): void {
  machine.writeNextReg(0x40, index);
  machine.writeNextReg(0x44, (rgb333 >> 1) & 0xff);
  machine.writeNextReg(0x44, (priority ? 0x80 : 0x00) | (rgb333 & 0x01));
}

function writePhysical(machine: TestZxNextWasmMachine, offset: number, value: number): void {
  machine.wasmV2Runtime!.exports.zxnextWritePhysical(offset, value & 0xff);
}

function blendRgb333(a: number, b: number, mixer: number): number {
  const rA = (a >> 6) & 7;
  const gA = (a >> 3) & 7;
  const bA = a & 7;
  const rB = (b >> 6) & 7;
  const gB = (b >> 3) & 7;
  const bB = b & 7;
  if (mixer === 0) {
    return (Math.min(7, rA + rB) << 6) |
      (Math.min(7, gA + gB) << 3) |
      Math.min(7, bA + bB);
  }
  return (Math.max(0, Math.min(7, rA + rB - 5)) << 6) |
    (Math.max(0, Math.min(7, gA + gB - 5)) << 3) |
    Math.max(0, Math.min(7, bA + bB - 5));
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
