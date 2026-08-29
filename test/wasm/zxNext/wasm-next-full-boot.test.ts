import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import {
  ZXNEXT_WASM_V2_SCREEN_HEIGHT,
  ZXNEXT_WASM_V2_SCREEN_WIDTH
} from "@emu/machines/zxNext/wasm/ZxNextWasmV2Loader";

import { createBootTrace, readZxNextBootRomImages } from "./wasm-next-boot-trace";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

const START_MENU_MILESTONE_STEPS = 15;
const POST_MILESTONE_FRAME_COUNT = 3;

describe("ZX Spectrum Next WASM full boot smoke", () => {
  it("continues from the deterministic NextZXOS milestone into bounded app-level frames", async () => {
    const trace = await createBootTrace(START_MENU_MILESTONE_STEPS);
    expect(withoutTacts(trace.wasm)).toEqual(withoutTacts(trace.oracle));

    const machine = await createTestZxNextWasmMachine();
    machine.uploadWasmV2RomImages(readZxNextBootRomImages());
    machine.reset();
    machine.executionContext.debugStepMode = DebugStepMode.StepInto;
    machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
    machine.executionContext.debugSupport = new DebugSupport(undefined, []);
    machine.executionContext.lastTerminationReason = undefined;

    for (let i = 0; i < START_MENU_MILESTONE_STEPS; i++) {
      expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
    }
    expect(machine.pc).toBe(trace.wasm.at(-1)!.pc);

    const keyboardLineBeforeInput = machine.wasmV2Runtime!.exports.zxnextGetKeyboardLine(0);
    machine.setKeyStatus(0, true);
    expect(machine.wasmV2Runtime!.exports.zxnextGetKeyboardLine(0)).not.toBe(keyboardLineBeforeInput);

    machine.executionContext.debugStepMode = DebugStepMode.NoDebug;
    machine.executionContext.debugSupport = undefined;
    const startingFrames = machine.frames;
    const terminations = Array.from({ length: POST_MILESTONE_FRAME_COUNT }, () => machine.executeMachineFrame());

    machine.setKeyStatus(0, false);
    machine.renderInstantScreen();
    const diagnostics = machine.getWasmV2Diagnostics();

    expect(terminations).toEqual(Array(POST_MILESTONE_FRAME_COUNT).fill(FrameTerminationMode.Normal));
    expect(machine.frames - startingFrames).toBe(POST_MILESTONE_FRAME_COUNT);
    expect(machine.currentFrameTact).toBeGreaterThanOrEqual(0);
    expect(machine.currentFrameTact).toBeLessThanOrEqual(machine.frameTacts);
    expect(machine.frameCompleted).toBe(true);
    expect(machine.executionContext.lastTerminationReason).toBe(FrameTerminationMode.Normal);
    expect(diagnostics.lastWasmStopReason).toBe("wasmFrameComplete");
    expect(diagnostics.lastWasmStopReason).not.toMatch(/scaffold|guard|safety/i);
    expect(machine.wasmV2Runtime!.exports.zxnextGetKeyboardLine(0)).toBe(keyboardLineBeforeInput);

    const pixels = machine.getPixelBuffer();
    expect(machine.screenWidthInPixels).toBe(ZXNEXT_WASM_V2_SCREEN_WIDTH);
    expect(machine.screenHeightInPixels).toBe(ZXNEXT_WASM_V2_SCREEN_HEIGHT);
    expect(pixels.length).toBe(ZXNEXT_WASM_V2_SCREEN_WIDTH * ZXNEXT_WASM_V2_SCREEN_HEIGHT);
    expect(countDistinctPixels(pixels)).toBeGreaterThan(1);
    expect(pixels.every(pixel => pixel === 0xffb6b6b6)).toBe(false);
  });
});

function countDistinctPixels(pixels: Uint32Array): number {
  const distinct = new Set<number>();
  for (const pixel of pixels) {
    distinct.add(pixel);
    if (distinct.size > 1) return distinct.size;
  }
  return distinct.size;
}

function withoutTacts<T extends { tacts: number }>(snapshots: T[]): Omit<T, "tacts">[] {
  return snapshots.map(({ tacts: _tacts, ...snapshot }) => snapshot);
}
