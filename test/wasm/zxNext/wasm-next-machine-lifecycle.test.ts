import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { OFFS_NEXT_RAM } from "@emu/machines/zxNext/MemoryDevice";
import {
  createTestZxNextRomSet,
  createTestZxNextWasmMachine,
  initCodeBytes,
  testRom
} from "./wasm-next-test-helpers";

const SCREEN_WIDTH = 720;
const DISPLAY_X = 96;
const DISPLAY_Y_50HZ = 48;
const BANK_5_BASE = OFFS_NEXT_RAM + 5 * 0x4000;

describe("ZX Spectrum Next WASM v2 machine lifecycle", () => {
  it("executes a normal frame in WASM and syncs only frame counters", async () => {
    const machine = await createTestZxNextWasmMachine(createTestZxNextRomSet({
      next: testRom([0x00], 0x10000)
    }));
    const wasm = machine.wasmV2Runtime!.exports;

    const mode = machine.executeMachineFrame();

    expect(mode).toBe(FrameTerminationMode.Normal);
    expect(machine.executionContext.lastTerminationReason).toBe(FrameTerminationMode.Normal);
    expect(machine.frames).toBe(1);
    expect(machine.tacts).toBe(wasm.zxnextGetCpuTactsPerFrame());
    expect(machine.frameTacts).toBe(0);
    expect(machine.currentFrameTact).toBe(0);
    expect(machine.frameCompleted).toBe(true);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      frames: 1,
      frameCallCount: 1,
      frameTacts: 0,
      currentFrameTact: 0,
      lastFrameInstructionsExecuted: wasm.zxnextGetCpuTactsPerFrame() / 4
    });

    expect(wasm.zxnextGetCpuPc()).toBeGreaterThan(0);
    expect(machine.pc).toBe(0);
    expect(machine.getCpuState().pc).toBe(wasm.zxnextGetCpuPc());
  });

  it("preserves instruction overshoot across consecutive WASM frames", async () => {
    const machine = await createTestZxNextWasmMachine(createTestZxNextRomSet({
      next: testRom([0xc3, 0x00, 0x00], 0x10000)
    }));
    const wasm = machine.wasmV2Runtime!.exports;

    machine.executeMachineFrame();
    const firstFrameTacts = wasm.zxnextGetFrameTacts();
    const firstCurrentFrameTact = wasm.zxnextGetCurrentFrameTact();

    machine.executeMachineFrame();

    expect(firstFrameTacts).toBe(16);
    expect(firstCurrentFrameTact).toBe(4);
    expect(wasm.zxnextGetFrameCallCount()).toBe(2);
    expect(machine.frames).toBe(2);
    expect(machine.frameTacts).toBe(32);
    expect(machine.currentFrameTact).toBe(8);
  });

  it("syncs changed keyboard rows before a WASM frame executes", async () => {
    const machine = await createTestZxNextWasmMachine(createTestZxNextRomSet({
      next: testRom([0x01, 0xfe, 0xff, 0xed, 0x78, 0x32, 0x00, 0x40, 0xc3, 0x00, 0x00], 0x10000)
    }));
    const wasm = machine.wasmV2Runtime!.exports;

    machine.keyboardDevice.setKeyStatus(0, true);
    machine.executeMachineFrame();

    expect(wasm.zxnextGetKeyboardRowWrites()).toBe(1);
    expect(wasm.zxnextGetKeyboardRow(0)).toBe(0x01);
    expect(wasm.zxnextGetLastFrameInstructionsExecuted()).toBeGreaterThan(0);
  });

  it("renders the standard ULA screen from WASM at frame end", async () => {
    const machine = await createTestZxNextWasmMachine(createTestZxNextRomSet({
      next: testRom([0x00], 0x10000)
    }));
    const wasm = machine.wasmV2Runtime!.exports;

    machine.doWritePort(0x00fe, 0x01);
    wasm.zxnextWritePhysical(BANK_5_BASE + 0x0000, 0x80);
    wasm.zxnextWritePhysical(BANK_5_BASE + 0x1800, 0x47);

    machine.executeMachineFrame();

    const displayPixel = DISPLAY_Y_50HZ * SCREEN_WIDTH + DISPLAY_X;
    expect(wasm.zxnextGetScreenRenderCount()).toBe(1);
    expect(machine.getPixelBuffer()[displayPixel]).toBe(defaultUlaBgra(15));
  });

  it("uses C-owned single-instruction stepping for debug StepInto", async () => {
    const machine = await createTestZxNextWasmMachine();

    initCodeBytes(machine, [0x3e, 0x42], 0x8000);
    machine.executionContext.debugStepMode = DebugStepMode.StepInto;

    const mode = machine.executeMachineFrame();

    expect(mode).toBe(FrameTerminationMode.DebugEvent);
    expect(machine.frames).toBe(0);
    const cpuState = machine.getCpuState();
    expect(cpuState.pc).toBe(0x8002);
    expect(cpuState.af >> 8).toBe(0x42);
    expect(machine.wasmV2Runtime!.exports.zxnextGetCpuInstructionsExecuted()).toBe(1);
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
