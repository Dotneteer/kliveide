import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { TestZxNextMachine } from "../../zxnext/TestNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import {
  ZXNEXT_WASM_V2_SCREEN_HEIGHT,
  ZXNEXT_WASM_V2_SCREEN_WIDTH
} from "@emu/machines/zxNext/wasm/ZxNextWasmV2Loader";

import { createZxNextOracleHarness } from "./wasm-next-test-helpers";

type FrameRunnerMachine = TestZxNextMachine | ZxNextWasmV2Machine;

type FrameSnapshot = {
  termination: FrameTerminationMode;
  lastTerminationReason: FrameTerminationMode | undefined;
  pc: number;
  frames: number;
  tacts: number;
  currentFrameTact: number;
  lastRenderedFrameTact: number;
  frameCompleted: boolean;
};

describe("ZX Spectrum Next WASM v2 frame runner", () => {
  it("executes full frames with TypeScript-compatible tact and frame counters", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    initializeFrameRunnerMachine(oracle);
    initializeFrameRunnerMachine(wasm);

    const oracleSnapshot = executeAndCaptureFrame(oracle);
    const wasmSnapshot = executeAndCaptureFrame(wasm);

    expect(wasmSnapshot).toEqual(oracleSnapshot);
    expect(wasmSnapshot).toMatchObject({
      termination: FrameTerminationMode.Normal,
      lastTerminationReason: FrameTerminationMode.Normal,
      frames: 1,
      currentFrameTact: 0,
      frameCompleted: true
    });
    expect(wasm.getWasmV2Diagnostics()).toMatchObject({
      normalFrames: 1,
      lastWasmStopReason: "wasmFrameComplete"
    });
    expect(wasm.getWasmV2Diagnostics().lastWasmStopReason).not.toMatch(/scaffold/i);
    expect(wasm.getWasmV2Diagnostics().migratedSurfaces).toContain("frame");

    const pixels = wasm.getPixelBuffer();
    expect(pixels.length).toBe(ZXNEXT_WASM_V2_SCREEN_WIDTH * ZXNEXT_WASM_V2_SCREEN_HEIGHT);
    expect(wasm.getPixelBufferBytes().byteLength).toBe(pixels.length * 4);
    expect(wasm.renderInstantScreen().length).toBe(pixels.length);
  });

  it("stops at execution points with TypeScript-compatible frame runner state", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    initializeFrameRunnerMachine(oracle);
    initializeFrameRunnerMachine(wasm);
    oracle.executionContext.frameTerminationMode = FrameTerminationMode.UntilExecutionPoint;
    wasm.executionContext.frameTerminationMode = FrameTerminationMode.UntilExecutionPoint;
    oracle.executionContext.terminationPoint = 0x8002;
    wasm.executionContext.terminationPoint = 0x8002;

    expect(executeAndCaptureFrame(wasm)).toEqual(executeAndCaptureFrame(oracle));
  });

  it("stops at breakpoints with TypeScript-compatible frame runner state", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    initializeFrameRunnerMachine(oracle);
    initializeFrameRunnerMachine(wasm);
    const oracleDebugSupport = new DebugSupport(undefined, [{ address: 0x8001, exec: true }]);
    const wasmDebugSupport = new DebugSupport(undefined, [{ address: 0x8001, exec: true }]);
    oracle.executionContext.debugSupport = oracleDebugSupport;
    wasm.executionContext.debugSupport = wasmDebugSupport;
    oracle.executionContext.debugStepMode = DebugStepMode.StopAtBreakpoint;
    wasm.executionContext.debugStepMode = DebugStepMode.StopAtBreakpoint;

    expect(executeAndCaptureFrame(wasm)).toEqual(executeAndCaptureFrame(oracle));
  });

  it("stops after a debug step with TypeScript-compatible frame runner state", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    initializeFrameRunnerMachine(oracle);
    initializeFrameRunnerMachine(wasm);
    oracle.executionContext.debugSupport = new DebugSupport(undefined, []);
    wasm.executionContext.debugSupport = new DebugSupport(undefined, []);
    oracle.executionContext.debugStepMode = DebugStepMode.StepInto;
    wasm.executionContext.debugStepMode = DebugStepMode.StepInto;

    expect(executeAndCaptureFrame(wasm)).toEqual(executeAndCaptureFrame(oracle));
  });

  it("stops when a frame command is queued without completing the frame", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    initializeFrameRunnerMachine(oracle);
    initializeFrameRunnerMachine(wasm);
    oracle.setFrameCommand({ command: "sd-read" });
    wasm.setFrameCommand({ command: "sd-read" });

    expect(executeAndCaptureFrame(wasm)).toEqual(executeAndCaptureFrame(oracle));
  });

  it("stops the native WASM frame loop when an SD command is queued mid-frame", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    initializeFrameRunnerMachine(oracle);
    initializeFrameRunnerMachine(wasm);
    installSdReadProgram(oracle);
    installSdReadProgram(wasm);

    const oracleSnapshot = executeAndCaptureFrame(oracle);
    const wasmSnapshot = executeAndCaptureFrame(wasm);

    expect(wasm.getFrameCommand()).toEqual(oracle.getFrameCommand());
    expect(wasmSnapshot).toMatchObject({
      termination: FrameTerminationMode.Normal,
      lastTerminationReason: FrameTerminationMode.Normal,
      pc: oracleSnapshot.pc,
      frames: 0,
      frameCompleted: false
    });
    expect(wasm.getWasmV2Diagnostics()).toMatchObject({
      normalFrames: 0,
      lastWasmStopReason: "wasmFrameCommand"
    });
  });
});

function initializeFrameRunnerMachine(machine: FrameRunnerMachine): void {
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

function executeAndCaptureFrame(machine: FrameRunnerMachine): FrameSnapshot {
  const termination = machine.executeMachineFrame();
  return {
    termination,
    lastTerminationReason: machine.executionContext.lastTerminationReason,
    pc: machine.pc,
    frames: machine.frames,
    tacts: machine.tacts,
    currentFrameTact: machine.currentFrameTact,
    lastRenderedFrameTact: machine.lastRenderedFrameTact,
    frameCompleted: machine.frameCompleted
  };
}

function installSdReadProgram(machine: FrameRunnerMachine): void {
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
}
