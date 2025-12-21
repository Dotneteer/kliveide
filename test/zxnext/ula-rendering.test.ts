import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { TimingConfig } from "@emu/machines/zxNext/screen/TimingConfig";
import { NextComposedScreenDevice } from "@emu/machines/zxNext/screen/NextComposedScreenDevice";
import { get } from "lodash";

let m: TestZxNextMachine;
let d: NextComposedScreenDevice;

describe("Next - ULA rendering", function () {
  beforeEach(async () => {
    m = await createTestNextMachine();
    d = m.composedScreenDevice;
    initScreenBytes(m, 0x00);
    initAttrBytes(m, 0x38);
  });

  it("empty screen is rendered properly", async () => {
    // --- Arrange
    m.writePort(0xfe, 0x03); // magenta border

    // --- Act
    const buffer = d.renderFullScreen();

    // --- Assert
    expect(buffer).toBeDefined();

    // --- Check magenta border
    expect(getFirstBorderPixel(buffer)).toBe(0xffb600b6); // black border
    const firstPixel = getDisplayPixel(d.config, buffer, 0, 0);
    const matchingBorderPixels = getMatchingBorderPixels(d.config, buffer, 0xffb600b6);
    const borderPixelCount = getBorderPixelCount(d.config);
    expect(matchingBorderPixels).toBe(borderPixelCount);

    // --- Check paper white/ink black display
    expect(firstPixel).toBe(0xffb6b6b6); // paper color
    const matchingDisplayPixels = getMatchingDisplayPixels(d.config, buffer, 0xffb6b6b6);
    const displayPixelCount = getDisplayPixelCount(d.config);
    expect(matchingDisplayPixels).toBe(displayPixelCount);
  });

  it("Single byte in 0x0000 is rendered properly", async () => {
    // --- Arrange
    m.memoryDevice.writeScreenMemory(getDisplayByteAddress(0, 0), 0xff);
    m.memoryDevice.writeScreenMemory(getDisplayByteAddress(1, 0), 0xaa);
    m.memoryDevice.writeScreenMemory(getDisplayAttributeAddress(1, 0), 0x72);
    m.writePort(0xfe, 0x03); // magenta border

    // --- Act
    const buffer = d.renderFullScreen();

    // --- Assert
    expect(buffer).toBeDefined();

    // --- Check magenta border
    expect(getFirstBorderPixel(buffer)).toBe(0xffb600b6); // black border
    const matchingBorderPixels = getMatchingBorderPixels(d.config, buffer, 0xffb600b6);
    const borderPixelCount = getBorderPixelCount(d.config);
    expect(matchingBorderPixels).toBe(borderPixelCount);

    // --- Check paper white/ink black display
    expect(getDisplayPixel(d.config, buffer, 0, 0)).toBe(0xff000000); // ink
    expect(getDisplayPixel(d.config, buffer, 1, 0)).toBe(0xff000000); // ink
    expect(getDisplayPixel(d.config, buffer, 2, 0)).toBe(0xff000000); // ink
    expect(getDisplayPixel(d.config, buffer, 3, 0)).toBe(0xff000000); // ink
    expect(getDisplayPixel(d.config, buffer, 4, 0)).toBe(0xff000000); // ink
    expect(getDisplayPixel(d.config, buffer, 5, 0)).toBe(0xff000000); // ink
    expect(getDisplayPixel(d.config, buffer, 6, 0)).toBe(0xff000000); // ink
    expect(getDisplayPixel(d.config, buffer, 7, 0)).toBe(0xff000000); // ink
    expect(getDisplayPixel(d.config, buffer, 8, 0)).toBe(0xff000000); // ink
    expect(getDisplayPixel(d.config, buffer, 9, 0)).toBe(0xff000000); // ink
    expect(getDisplayPixel(d.config, buffer, 10, 0)).toBe(0xff000000); // ink
    expect(getDisplayPixel(d.config, buffer, 11, 0)).toBe(0xff000000); // ink
    expect(getDisplayPixel(d.config, buffer, 12, 0)).toBe(0xff000000); // ink
    expect(getDisplayPixel(d.config, buffer, 13, 0)).toBe(0xff000000); // ink
    expect(getDisplayPixel(d.config, buffer, 14, 0)).toBe(0xff000000); // ink
    expect(getDisplayPixel(d.config, buffer, 15, 0)).toBe(0xff000000); // ink
    expect(getDisplayPixel(d.config, buffer, 16, 0)).toBe(0xff0000ff); // ink 
    expect(getDisplayPixel(d.config, buffer, 17, 0)).toBe(0xff0000ff); // ink 
    expect(getDisplayPixel(d.config, buffer, 18, 0)).toBe(0xff00ffff); // paper 
    expect(getDisplayPixel(d.config, buffer, 19, 0)).toBe(0xff00ffff); // paper 
    expect(getDisplayPixel(d.config, buffer, 20, 0)).toBe(0xff0000ff); // ink 
    expect(getDisplayPixel(d.config, buffer, 21, 0)).toBe(0xff0000ff); // paper 
    expect(getDisplayPixel(d.config, buffer, 22, 0)).toBe(0xff00ffff); // paper 
    expect(getDisplayPixel(d.config, buffer, 23, 0)).toBe(0xff00ffff); // paper 
    expect(getDisplayPixel(d.config, buffer, 24, 0)).toBe(0xff0000ff); // ink 
    expect(getDisplayPixel(d.config, buffer, 25, 0)).toBe(0xff0000ff); // paper 
    expect(getDisplayPixel(d.config, buffer, 26, 0)).toBe(0xff00ffff); // paper 
    expect(getDisplayPixel(d.config, buffer, 27, 0)).toBe(0xff00ffff); // paper 
    expect(getDisplayPixel(d.config, buffer, 28, 0)).toBe(0xff0000ff); // ink 
    expect(getDisplayPixel(d.config, buffer, 29, 0)).toBe(0xff0000ff); // paper 
    expect(getDisplayPixel(d.config, buffer, 30, 0)).toBe(0xff00ffff); // paper 
    expect(getDisplayPixel(d.config, buffer, 31, 0)).toBe(0xff00ffff); // paper 
    expect(getDisplayPixel(d.config, buffer, 32, 0)).toBe(0xffb6b6b6); // ink 
    expect(getDisplayPixel(d.config, buffer, 33, 0)).toBe(0xffb6b6b6); // paper 
    expect(getMatchingDisplayPixels(d.config, buffer, 0xff000000)).toBe(16);
    expect(getMatchingDisplayPixels(d.config, buffer, 0xff0000ff)).toBe(8);
    expect(getMatchingDisplayPixels(d.config, buffer, 0xff00ffff)).toBe(120);
  });
});

function initScreenBytes(machine: IZxNextMachine, byte: number) {
  for (let addr = 0; addr < 0x1800; addr++) {
    machine.memoryDevice.writeScreenMemory(addr, byte);
  }
}

function initAttrBytes(machine: IZxNextMachine, byte: number) {
  for (let addr = 0x1800; addr < 0x1b00; addr++) {
    machine.memoryDevice.writeScreenMemory(addr, byte);
  }
}

const SCREEN_WIDTH = 720;
const SCREEN_HEIGHT = 288;

function getDisplayPixel(config: TimingConfig, buffer: Uint32Array, x: number, y: number): number {
  // Map display area coordinates (x, y) to buffer coordinates
  // The display area starts at HC=144, which maps to buffer X offset
  // HC range: firstVisibleHC (96) to maxHC (455) -> buffer X: 0 to 719
  // Each pixel in standard mode is doubled horizontally (2 buffer pixels per source pixel)
  const displayXOffset = (config.displayXStart - config.firstVisibleHC) * 2;
  const displayYOffset = config.displayYStart - config.firstBitmapVC;

  const bufferX = displayXOffset + x;
  const bufferY = displayYOffset + y;
  const index = bufferY * SCREEN_WIDTH + bufferX;

  return buffer[index];
}

function getFirstBorderPixel(buffer: Uint32Array): number {
  return buffer[0];
}

function getBorderPixelCount(config: TimingConfig): number {
  const displayXOffset = (config.displayXStart - config.firstVisibleHC) * 2;
  const displayYOffset = config.displayYStart - config.firstBitmapVC;
  const displayXEndOffset = (config.displayXEnd - config.firstVisibleHC + 1) * 2;
  const displayYEndOffset = config.displayYEnd - config.firstBitmapVC + 1;

  const totalPixels = SCREEN_WIDTH * SCREEN_HEIGHT;
  const displayPixels = (displayXEndOffset - displayXOffset) * (displayYEndOffset - displayYOffset);
  return totalPixels - displayPixels;
}

function getDisplayPixelCount(config: TimingConfig): number {
  const displayXOffset = (config.displayXStart - config.firstVisibleHC) * 2;
  const displayYOffset = config.displayYStart - config.firstBitmapVC;
  const displayXEndOffset = (config.displayXEnd - config.firstVisibleHC + 1) * 2;
  const displayYEndOffset = config.displayYEnd - config.firstBitmapVC + 1;

  return (displayXEndOffset - displayXOffset) * (displayYEndOffset - displayYOffset);
}

function getMatchingBorderPixels(
  config: TimingConfig,
  buffer: Uint32Array,
  pixelArgb: number
): number {
  // --- Traverse through all border pixels and count matches
  let count = 0;
  const displayXOffset = (config.displayXStart - config.firstVisibleHC) * 2;
  const displayYOffset = config.displayYStart - config.firstBitmapVC;
  const displayXEndOffset = (config.displayXEnd - config.firstVisibleHC + 1) * 2;
  const displayYEndOffset = config.displayYEnd - config.firstBitmapVC + 1;

  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      // Check if pixel is in border area
      if (
        x < displayXOffset ||
        x >= displayXEndOffset ||
        y < displayYOffset ||
        y >= displayYEndOffset
      ) {
        const index = y * SCREEN_WIDTH + x;
        if (buffer[index] === pixelArgb) {
          count++;
        }
      }
    }
  }
  return count;
}

function getMatchingDisplayPixels(
  config: TimingConfig,
  buffer: Uint32Array,
  pixelArgb: number
): number {
  // --- Traverse through all display pixels and count matches
  let count = 0;
  const displayXOffset = (config.displayXStart - config.firstVisibleHC) * 2;
  const displayYOffset = config.displayYStart - config.firstBitmapVC;
  const displayXEndOffset = (config.displayXEnd - config.firstVisibleHC + 1) * 2;
  const displayYEndOffset = config.displayYEnd - config.firstBitmapVC + 1;

  for (let y = displayYOffset; y < displayYEndOffset; y++) {
    for (let x = displayXOffset; x < displayXEndOffset; x++) {
      const index = y * SCREEN_WIDTH + x;
      if (buffer[index] === pixelArgb) {
        //console.log(x - displayXOffset, y - displayYOffset);
        count++;
      }
    }
  }
  return count;
}

function getDisplayByteAddress(col: number, y: number): number {
  // --- Calculate ZX Spectrum screen memory address for pixel (col, y)
  // --- col: 0-31, y: 0-191
  const row = y & 0b00000111; // y % 8
  const block = (y >> 3) & 0b00000111; // (y / 8) % 8
  const section = (y >> 6) & 0b00000011; // y / 64
  const address = (section << 11) | (block << 8) | (row << 5) | col;
  return address;
}

function getDisplayAttributeAddress(col: number, y: number): number {
  // --- Calculate ZX Spectrum attribute memory address for pixel (col, y)
  // --- col: 0-255, y: 0-191
  const attrRow = Math.floor(y / 8);
  const address = 0x1800 + (attrRow * 32) + col;
  return address;
} 
