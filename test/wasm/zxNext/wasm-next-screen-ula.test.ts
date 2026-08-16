import { describe, expect, it } from "vitest";

import { OFFS_NEXT_RAM } from "@emu/machines/zxNext/MemoryDevice";
import {
  createOracleZxNextMachine,
  createTestZxNextRomSet,
  createTestZxNextWasmMachine
} from "./wasm-next-test-helpers";

const SCREEN_WIDTH = 720;
const SCREEN_HEIGHT = 288;
const DISPLAY_X = 96;
const DISPLAY_Y_50HZ = 48;
const DISPLAY_Y_60HZ = 24;
const BANK_5_BASE = OFFS_NEXT_RAM + 5 * 0x4000;
const BANK_7_BASE = OFFS_NEXT_RAM + 7 * 0x4000;
const SCR_DISPLAY_AREA = 0x01;
const SCR_CONTENTION_WINDOW = 0x02;
const SCR_BYTE1_READ = 0x08;
const SCR_SHIFT_REG_LOAD = 0x20;
const SCR_BORDER_AREA = 0x80;

describe("ZX Spectrum Next WASM v2 standard ULA screen", () => {
  it("exposes WASM-owned renderer buffers through public machine APIs", async () => {
    const machine = await createTestZxNextWasmMachine();
    const runtime = machine.wasmV2Runtime!;

    expect(machine.screenWidthInPixels).toBe(SCREEN_WIDTH);
    expect(machine.screenHeightInPixels).toBe(SCREEN_HEIGHT);
    expect(machine.getPixelBuffer()).toBe(runtime.pixelBuffer);
    expect(machine.getPixelBufferBytes()).toBe(runtime.pixelBufferBytes);
    expect(machine.getBufferStartOffset()).toBe(0);
    expect(runtime.exports.zxnextGetPixelBufferStartOffset()).toBeGreaterThan(0);
  });

  it("reports 50 Hz and 60 Hz timing from NextReg 0x05", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      screenIs60Hz: false,
      screenRenderingTacts: 456 * 311,
      screenIntStartTact: 0x252,
      screenIntEndTact: 0x272
    });

    machine.nextRegDevice.directSetRegValue(0x05, 0x04);
    expect(wasm.zxnextGetScreenIs60Hz()).toBe(1);
    expect(wasm.zxnextGetScreenRenderingTacts()).toBe(456 * 264);
    expect(wasm.zxnextGetScreenIntStartTact()).toBe(0x138);
    expect(wasm.zxnextGetScreenIntEndTact()).toBe(0x158);
  });

  it("builds the ULA standard rendering tact tables used by instant rendering", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;
    const firstVisibleTact50 = 16 * 456 + 96;
    const firstDisplayTact50 = 64 * 456 + 144;

    expect(wasm.zxnextGetUlaRenderingFlags(0)).toBe(0);
    expect(wasm.zxnextGetRenderingPixelIndex(0)).toBe(-1);
    expect(wasm.zxnextGetRenderingHc(firstVisibleTact50)).toBe(96);
    expect(wasm.zxnextGetRenderingVc(firstVisibleTact50)).toBe(16);
    expect(wasm.zxnextGetUlaRenderingFlags(firstVisibleTact50)).toBe(SCR_BORDER_AREA);
    expect(wasm.zxnextGetRenderingPixelIndex(firstVisibleTact50)).toBe(0);

    expect(wasm.zxnextGetRenderingHc(firstDisplayTact50)).toBe(144);
    expect(wasm.zxnextGetRenderingVc(firstDisplayTact50)).toBe(64);
    expect(wasm.zxnextGetUlaRenderingFlags(firstDisplayTact50)).toBe(
      SCR_DISPLAY_AREA | SCR_CONTENTION_WINDOW | SCR_BYTE1_READ | SCR_SHIFT_REG_LOAD
    );
    expect(wasm.zxnextGetRenderingPixelIndex(firstDisplayTact50)).toBe(
      DISPLAY_Y_50HZ * SCREEN_WIDTH + DISPLAY_X
    );

    machine.nextRegDevice.directSetRegValue(0x05, 0x04);
    const firstDisplayTact60 = 40 * 456 + 144;
    expect(wasm.zxnextGetRenderingHc(firstDisplayTact60)).toBe(144);
    expect(wasm.zxnextGetRenderingVc(firstDisplayTact60)).toBe(40);
    expect(wasm.zxnextGetRenderingPixelIndex(firstDisplayTact60)).toBe(
      DISPLAY_Y_60HZ * SCREEN_WIDTH + DISPLAY_X
    );
  });

  it("renders border and standard ULA pixels from bank 5 screen memory", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    machine.doWritePort(0x00fe, 0x01);
    wasm.zxnextWritePhysical(BANK_5_BASE + 0x0000, 0x80);
    wasm.zxnextWritePhysical(BANK_5_BASE + 0x1800, 0x47);

    machine.renderInstantScreen();

    const displayPixel = DISPLAY_Y_50HZ * SCREEN_WIDTH + DISPLAY_X;
    expect(machine.getPixelBuffer()[0]).toBe(defaultUlaBgra(16 + 1));
    expect(machine.getPixelBuffer()[displayPixel]).toBe(defaultUlaBgra(15));
    expect(machine.getPixelBuffer()[displayPixel + 1]).toBe(defaultUlaBgra(15));
    expect(machine.getPixelBuffer()[displayPixel + 2]).toBe(defaultUlaBgra(16));
    expect(wasm.zxnextGetScreenRenderCount()).toBe(1);
  });

  it("matches TypeScript oracle pixels for a focused standard ULA example", async () => {
    const romSet = createTestZxNextRomSet();
    const wasmMachine = await createTestZxNextWasmMachine(romSet);
    const oracleMachine = await createOracleZxNextMachine(romSet);

    wasmMachine.doWritePort(0x00fe, 0x01);
    oracleMachine.doWritePort(0x00fe, 0x01);
    wasmMachine.writeTestMemory(0x4000, 0x80);
    wasmMachine.writeTestMemory(0x5800, 0x47);
    oracleMachine.writeTestMemory(0x4000, 0x80);
    oracleMachine.writeTestMemory(0x5800, 0x47);

    wasmMachine.renderInstantScreen();
    oracleMachine.renderInstantScreen();

    const displayPixel = DISPLAY_Y_50HZ * SCREEN_WIDTH + DISPLAY_X;
    expect(wasmMachine.getPixelBuffer()[0]).toBe(oracleMachine.getPixelBuffer()[0]);
    expect(wasmMachine.getPixelBuffer()[displayPixel]).toBe(oracleMachine.getPixelBuffer()[displayPixel]);
    expect(wasmMachine.getPixelBuffer()[displayPixel + 2]).toBe(
      oracleMachine.getPixelBuffer()[displayPixel + 2]
    );
  });

  it("reads and renders the shadow screen bank when selected", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    wasm.zxnextWritePhysical(BANK_5_BASE + 0x0000, 0x80);
    wasm.zxnextWritePhysical(BANK_5_BASE + 0x1800, 0x47);
    wasm.zxnextWritePhysical(BANK_7_BASE + 0x0000, 0x80);
    wasm.zxnextWritePhysical(BANK_7_BASE + 0x1800, 0x41);

    machine.renderInstantScreen();
    const displayPixel = DISPLAY_Y_50HZ * SCREEN_WIDTH + DISPLAY_X;
    expect(wasm.zxnextGetScreenBank()).toBe(5);
    expect(machine.readScreenMemory(0x1800)).toBe(0x47);
    expect(machine.getPixelBuffer()[displayPixel]).toBe(defaultUlaBgra(15));

    machine.doWritePort(0x7ffd, 0x08);
    machine.renderInstantScreen();

    expect(wasm.zxnextGetScreenBank()).toBe(7);
    expect(machine.readScreenMemory(0x1800)).toBe(0x41);
    expect(machine.getPixelBuffer()[displayPixel]).toBe(defaultUlaBgra(9));
  });

  it("reads and renders the shadow screen bank when selected through NextReg 0x69", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    wasm.zxnextWritePhysical(BANK_5_BASE + 0x0000, 0x80);
    wasm.zxnextWritePhysical(BANK_5_BASE + 0x1800, 0x47);
    wasm.zxnextWritePhysical(BANK_7_BASE + 0x0000, 0x80);
    wasm.zxnextWritePhysical(BANK_7_BASE + 0x1800, 0x41);

    machine.nextRegDevice.directSetRegValue(0x69, 0x40);
    machine.renderInstantScreen();

    const displayPixel = DISPLAY_Y_50HZ * SCREEN_WIDTH + DISPLAY_X;
    expect(machine.nextRegDevice.directGetRegValue(0x69) & 0x40).toBe(0x40);
    expect(machine.getWasmV2Diagnostics().useShadowScreen).toBe(true);
    expect(wasm.zxnextGetScreenBank()).toBe(7);
    expect(machine.readScreenMemory(0x1800)).toBe(0x41);
    expect(machine.getPixelBuffer()[displayPixel]).toBe(defaultUlaBgra(9));

    machine.nextRegDevice.directSetRegValue(0x69, 0x00);
    machine.renderInstantScreen();

    expect(machine.nextRegDevice.directGetRegValue(0x69) & 0x40).toBe(0x00);
    expect(wasm.zxnextGetScreenBank()).toBe(5);
    expect(machine.readScreenMemory(0x1800)).toBe(0x47);
    expect(machine.getPixelBuffer()[displayPixel]).toBe(defaultUlaBgra(15));
  });

  it("uses the 60 Hz vertical display start when rendering standard ULA pixels", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    machine.nextRegDevice.directSetRegValue(0x05, 0x04);
    wasm.zxnextWritePhysical(BANK_5_BASE + 0x0000, 0x80);
    wasm.zxnextWritePhysical(BANK_5_BASE + 0x1800, 0x47);

    machine.renderInstantScreen();

    const displayPixel = DISPLAY_Y_60HZ * SCREEN_WIDTH + DISPLAY_X;
    expect(machine.getWasmV2Diagnostics().screenIs60Hz).toBe(true);
    expect(machine.getPixelBuffer()[displayPixel]).toBe(defaultUlaBgra(15));
  });
});

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
