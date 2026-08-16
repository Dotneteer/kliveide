import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
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
    expect(machine.pc).toBe(wasm.zxnextGetCpuPc());
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

  it("stops StepOut when the WASM CPU executes RET", async () => {
    const machine = await createTestZxNextWasmMachine();
    const debugSupport = new DebugSupport();

    initCodeBytes(machine, [0xc9], 0x8000);
    machine.writeTestMemory(0xfffe, 0x34);
    machine.writeTestMemory(0xffff, 0x12);
    machine.executionContext.debugSupport = debugSupport;
    machine.executionContext.debugStepMode = DebugStepMode.StepOut;
    machine.executionContext.frameTerminationMode = FrameTerminationMode.DebugEvent;
    machine.stepOutAddress = -1;

    const mode = machine.executeMachineFrame();

    expect(mode).toBe(FrameTerminationMode.DebugEvent);
    expect(machine.getCpuState().pc).toBe(0x1234);
    expect(machine.retExecuted).toBe(true);
  });

  it("stops at execution breakpoints while running in debug mode", async () => {
    const machine = await createTestZxNextWasmMachine(createTestZxNextRomSet({
      next: testRom([0x00, 0x00, 0x00], 0x10000)
    }));
    const debugSupport = new DebugSupport();

    debugSupport.addBreakpoint({ address: 0x0001, exec: true });
    machine.executionContext.debugSupport = debugSupport;
    machine.executionContext.debugStepMode = DebugStepMode.StopAtBreakpoint;
    machine.executionContext.frameTerminationMode = FrameTerminationMode.DebugEvent;

    const mode = machine.executeMachineFrame();

    expect(mode).toBe(FrameTerminationMode.DebugEvent);
    expect(machine.executionContext.lastTerminationReason).toBe(FrameTerminationMode.DebugEvent);
    expect(machine.getCpuState().pc).toBe(0x0001);
    expect(debugSupport.lastBreakpoint).toBe(0x0001);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      wasmExecuteFrameCalls: 0,
      wasmExecuteInstructionCalls: 1
    });
  });

  it("syncs tact and CPU register mutations into WASM", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    machine.setTacts(0x1234);
    expect(machine.tacts).toBe(0x1234);
    expect(wasm.zxnextGetTacts()).toBe(0x1234);

    expect(machine.setCpuRegisterValue("PC", 0x8123)).toBe(true);
    expect(wasm.zxnextGetCpuPc()).toBe(0x8123);
    expect(machine.getCpuState().pc).toBe(0x8123);

    expect(machine.setCpuRegisterValue("A", 0x5a)).toBe(true);
    expect(wasm.zxnextGetCpuAf() >> 8).toBe(0x5a);
    expect(machine.getCpuState().af >> 8).toBe(0x5a);
  });

  it("reports memory mapping and partition labels from WASM-owned MMU state", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.wasmV2Runtime!.exports.zxnextWriteNextReg(0x52, 0x12);

    const mapping = machine.getNextMemoryMapping();
    expect(machine.getCurrentPartitions()[2]).toBe(0x09);
    expect(machine.getCurrentPartitionLabels()[2]).toBe("09");
    expect(mapping.pageInfo[2]).toMatchObject({
      bank16k: 0x09,
      bank8k: 0x12,
      readOffset: OFFS_NEXT_RAM + 0x12 * 0x2000,
      writeOffset: OFFS_NEXT_RAM + 0x12 * 0x2000
    });
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
