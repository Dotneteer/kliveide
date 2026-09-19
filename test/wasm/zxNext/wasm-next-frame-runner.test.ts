import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import {
  ZXNEXT_WASM_V2_SCREEN_HEIGHT,
  ZXNEXT_WASM_V2_SCREEN_WIDTH
} from "@emu/machines/zxNext/wasm/ZxNextWasmV2Loader";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

type FrameSnapshot = {
  termination: FrameTerminationMode;
  lastTerminationReason: FrameTerminationMode | undefined;
  pc: number;
  frames: number;
  tacts: number;
  currentFrameTact: number;
  frameCompleted: boolean;
};

/**
 * The frame runner's counters after each way a frame can end. The programs run NOPs from $8000 at
 * 3.5 MHz (4 T-states each, `currentFrameTact` counts 7 MHz half-tacts). The full-frame end PC is
 * pinned: it is the value both the TypeScript and the WASM core agreed on at tag
 * `pre-zxnext-ts-removal-2026-09-19`.
 */
describe("ZX Spectrum Next WASM v2 frame runner", () => {
  it("executes full frames with the frame's tact and frame counters", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initializeFrameRunnerMachine(wasm);

    expect(executeAndCaptureFrame(wasm)).toEqual({
      termination: FrameTerminationMode.Normal,
      lastTerminationReason: FrameTerminationMode.Normal,
      // --- pinned: where a frame of NOPs from $8000 ends
      pc: 0xc53f,
      frames: 1,
      // --- 128K-timing frame: 311 lines x 228 T-states
      tacts: 311 * 228,
      currentFrameTact: 0,
      frameCompleted: true
    });
    expect(wasm.getWasmV2Diagnostics()).toMatchObject({
      normalFrames: 1,
      lastWasmStopReason: "wasmFrameComplete"
    });
    expect(wasm.getWasmV2Diagnostics().lastWasmStopReason).not.toMatch(/scaffold/i);

    const pixels = wasm.getPixelBuffer();
    expect(pixels.length).toBe(ZXNEXT_WASM_V2_SCREEN_WIDTH * ZXNEXT_WASM_V2_SCREEN_HEIGHT);
    expect(wasm.getPixelBufferBytes().byteLength).toBe(pixels.length * 4);
    expect(wasm.renderInstantScreen().length).toBe(pixels.length);
  });

  it("stops at execution points with the frame runner state of that point", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initializeFrameRunnerMachine(wasm);
    wasm.executionContext.frameTerminationMode = FrameTerminationMode.UntilExecutionPoint;
    wasm.executionContext.terminationPoint = 0x8002;

    // --- two NOPs
    expect(executeAndCaptureFrame(wasm)).toEqual({
      termination: FrameTerminationMode.UntilExecutionPoint,
      lastTerminationReason: FrameTerminationMode.UntilExecutionPoint,
      pc: 0x8002,
      frames: 0,
      tacts: 8,
      currentFrameTact: 16,
      frameCompleted: false
    });
  });

  it("stops at breakpoints with the frame runner state of the breakpoint", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initializeFrameRunnerMachine(wasm);
    wasm.executionContext.debugSupport = new DebugSupport(undefined, [{ address: 0x8001, exec: true }]);
    wasm.executionContext.debugStepMode = DebugStepMode.StopAtBreakpoint;

    // --- one NOP
    expect(executeAndCaptureFrame(wasm)).toEqual(oneNopStop(FrameTerminationMode.DebugEvent));
  });

  it("stops after a debug step with the frame runner state after one instruction", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initializeFrameRunnerMachine(wasm);
    wasm.executionContext.debugSupport = new DebugSupport(undefined, []);
    wasm.executionContext.debugStepMode = DebugStepMode.StepInto;

    expect(executeAndCaptureFrame(wasm)).toEqual(oneNopStop(FrameTerminationMode.DebugEvent));
  });

  it("stops when a frame command is queued without completing the frame", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initializeFrameRunnerMachine(wasm);
    wasm.setFrameCommand({ command: "sd-read" });

    // --- the command is noticed after the first instruction; the frame ends normally, incomplete
    expect(executeAndCaptureFrame(wasm)).toEqual(oneNopStop(FrameTerminationMode.Normal));
  });

  it("stops the native WASM frame loop when an SD command is queued mid-frame", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initializeFrameRunnerMachine(wasm);
    const programEnd = installSdReadProgram(wasm);

    const snapshot = executeAndCaptureFrame(wasm);

    // --- CMD17 (read single block) with argument $00000005
    expect(wasm.getFrameCommand()).toEqual({ command: "sd-read", sector: 5 });
    expect(snapshot).toMatchObject({
      termination: FrameTerminationMode.Normal,
      lastTerminationReason: FrameTerminationMode.Normal,
      // --- right after the OUT that completes the CMD17 frame
      pc: programEnd,
      frames: 0,
      frameCompleted: false
    });
    expect(wasm.getWasmV2Diagnostics()).toMatchObject({
      normalFrames: 0,
      lastWasmStopReason: "wasmFrameCommand"
    });
  });
});

function oneNopStop(termination: FrameTerminationMode): FrameSnapshot {
  return {
    termination,
    lastTerminationReason: termination,
    pc: 0x8001,
    frames: 0,
    tacts: 4,
    currentFrameTact: 8,
    frameCompleted: false
  };
}

function initializeFrameRunnerMachine(machine: ZxNextWasmV2Machine): void {
  machine.hardReset();
  machine.pc = 0x8000;
  machine.setTacts(0);
  machine.frameTacts = 0;
  machine.currentFrameTact = 0;
  machine.frames = 0;
  machine.frameCompleted = false;
  machine.executionContext.debugStepMode = DebugStepMode.NoDebug;
  machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
  machine.executionContext.lastTerminationReason = undefined;
  for (let i = 0; i < 0x100; i++) {
    machine.doWriteMemory(0x8000 + i, 0x00);
  }
}

function executeAndCaptureFrame(machine: ZxNextWasmV2Machine): FrameSnapshot {
  const termination = machine.executeMachineFrame();
  return {
    termination,
    lastTerminationReason: machine.executionContext.lastTerminationReason,
    pc: machine.pc,
    frames: machine.frames,
    tacts: machine.tacts,
    currentFrameTact: machine.currentFrameTact,
    // --- Not lastRenderedFrameTact: the WASM raster tracks rendered pixels and leaves the field 0
    frameCompleted: machine.frameCompleted
  };
}

/** Installs the program at $8000 and returns the address after its last byte. */
function installSdReadProgram(machine: ZxNextWasmV2Machine): number {
  const bytes = [
    0x01, 0xe7, 0xff,       // LD BC,$FFE7
    0x3e, 0x02,             // LD A,$02
    0xed, 0x79,             // OUT (C),A: select SD card 0
    0x01, 0xeb, 0xff,       // LD BC,$FFEB
    0x3e, 0x51, 0xed, 0x79, // CMD17
    0x3e, 0x00, 0xed, 0x79,
    0x3e, 0x00, 0xed, 0x79,
    0x3e, 0x00, 0xed, 0x79,
    0x3e, 0x05, 0xed, 0x79,
    0x3e, 0xff, 0xed, 0x79
  ];
  bytes.forEach((byte, offset) => machine.doWriteMemory(0x8000 + offset, byte));
  return 0x8000 + bytes.length;
}
