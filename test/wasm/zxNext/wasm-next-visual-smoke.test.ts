import { describe, expect, it } from "vitest";

import {
  ZXNEXT_WASM_V2_SCREEN_HEIGHT,
  ZXNEXT_WASM_V2_SCREEN_WIDTH
} from "@emu/machines/zxNext/wasm/ZxNextWasmV2Loader";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

const BLANK_BORDER_PIXEL = 0xffb6b6b6;
const STANDARD_SCREEN_WIDTH = 256;
const STANDARD_SCREEN_SCALE_X = 2;
const STANDARD_SCREEN_OUTPUT_WIDTH = STANDARD_SCREEN_WIDTH * STANDARD_SCREEN_SCALE_X;
const STANDARD_SCREEN_HEIGHT = 192;
const STANDARD_SCREEN_X = 96;
const STANDARD_SCREEN_Y = (ZXNEXT_WASM_V2_SCREEN_HEIGHT - STANDARD_SCREEN_HEIGHT) / 2;

describe("ZX Spectrum Next WASM visual smoke", () => {
  it("renders a 256x192 standard screen inside the full Next output instead of a gray fallback pane", async () => {
    const machine = await createTestZxNextWasmMachine();
    machine.hardReset();

    machine.renderInstantScreen();
    const blankPixels = machine.getPixelBuffer();

    expect(machine.screenWidthInPixels).toBe(ZXNEXT_WASM_V2_SCREEN_WIDTH);
    expect(machine.screenHeightInPixels).toBe(ZXNEXT_WASM_V2_SCREEN_HEIGHT);
    expect(blankPixels.length).toBe(ZXNEXT_WASM_V2_SCREEN_WIDTH * ZXNEXT_WASM_V2_SCREEN_HEIGHT);
    expect(blankPixels[0]).toBe(BLANK_BORDER_PIXEL);
    expect(blankPixels[screenIndex(0, 0)]).toBe(0xff000000);
    expect(isUniform(blankPixels, BLANK_BORDER_PIXEL)).toBe(false);

    machine.doWriteMemory(0x4000, 0xff);
    machine.doWriteMemory(0x5800, 0x47);
    machine.renderInstantScreen();
    const drawnPixels = machine.getPixelBuffer();

    expect(drawnPixels[screenIndex(0, 0)]).toBe(0xffffffff);
    expect(drawnPixels[screenIndex(1, 0)]).toBe(0xffffffff);
    expect(drawnPixels[screenIndex(15, 0)]).toBe(0xffffffff);
    expect(drawnPixels[screenIndex(16, 0)]).toBe(0xff000000);
    expect(countDistinctPixels(drawnPixels)).toBeGreaterThanOrEqual(3);
  });
});

function screenIndex(x: number, y: number): number {
  return (STANDARD_SCREEN_Y + y) * ZXNEXT_WASM_V2_SCREEN_WIDTH + STANDARD_SCREEN_X + x;
}

function isUniform(pixels: Uint32Array, value: number): boolean {
  return pixels.every(pixel => pixel === value);
}

function countDistinctPixels(pixels: Uint32Array): number {
  const distinct = new Set<number>();
  for (const pixel of pixels) {
    distinct.add(pixel);
    if (distinct.size >= 3) return distinct.size;
  }
  return distinct.size;
}
