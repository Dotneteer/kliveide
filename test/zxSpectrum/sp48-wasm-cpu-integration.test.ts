import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { Sp48WasmLoaderOptions } from "@emu/machines/zxSpectrum48/wasm/Sp48WasmLoader";

import { readFileSync } from "node:fs";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { TapeMode } from "@emu/abstractions/TapeMode";
import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { ZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48Machine";
import { ZxSpectrum48WasmMachine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmMachine";
import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";
import { FAST_LOAD } from "@emu/machines/machine-props";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { resetSp48WasmModuleCache } from "@emu/machines/zxSpectrum48/wasm/Sp48WasmLoader";
import { SP48_WASM_LAYOUT } from "@emu/machines/zxSpectrum48/wasm/sp48-wasm-layout.generated";
import { buildSp48Wasm, output } from "../../scripts/build-sp48-wasm.cjs";
import { afterEach, describe, expect, it } from "vitest";

class TestTypeScript48Machine extends ZxSpectrum48Machine {
  readonly beeperTransitions: Array<{ tact: number; value: number; ear: boolean; mic: boolean }> = [];
  private lastEar = false;
  private lastMic = false;

  constructor(
    private readonly rom: Uint8Array,
    modelInfo?: MachineModel,
    config?: MachineConfigSet
  ) {
    super(modelInfo, config);
  }

  protected override async loadRomFromResource(): Promise<Uint8Array> {
    return this.rom;
  }

  protected override writePort0xFE(value: number): void {
    super.writePort0xFE(value);
    const ear = (value & 0x10) !== 0;
    const mic = (value & 0x08) !== 0;
    if (ear !== this.lastEar || mic !== this.lastMic) {
      this.beeperTransitions.push({
        tact: this.frameTacts,
        value: value & 0xff,
        ear,
        mic
      });
      this.lastEar = ear;
      this.lastMic = mic;
    }
  }
}

class TestWasm48Machine extends ZxSpectrum48WasmMachine {
  constructor(
    private readonly rom: Uint8Array,
    modelInfo?: MachineModel,
    config?: MachineConfigSet
  ) {
    super(modelInfo, config, actualLoaderOptions());
  }

  protected override async loadRomFromResource(): Promise<Uint8Array> {
    return this.rom;
  }
}

class NoCpuDelegateWasm48Machine extends TestWasm48Machine {
  override executeCpuCycle(): void {
    throw new Error("Normal WASM frame execution must not delegate to TypeScript CPU cycles.");
  }

  override tactPlusN(_n: number): void {
    throw new Error("Normal WASM frame execution must not delegate per-tact timing to TypeScript.");
  }

  override doReadMemory(_address: number): number {
    throw new Error("Normal WASM frame execution must not delegate memory reads to TypeScript.");
  }

  override doWriteMemory(_address: number, _value: number): void {
    throw new Error("Normal WASM frame execution must not delegate memory writes to TypeScript.");
  }
}

describe("ZX Spectrum 48K WASM CPU integration", () => {
  afterEach(() => resetSp48WasmModuleCache());

  it("runs instructions through the 48K memory and FE-port bus", async () => {
    const rom = testRom([0x3e, 0x12, 0x32, 0x00, 0x40, 0xd3, 0xfe]);
    const ts = await createTsMachine(rom);
    const wasm = await createWasmMachine(rom);

    executeTsInstructions(ts, 3);
    executeWasmStepInto(wasm, 3);

    expectCpuSubset(wasm, ts);
    expect(wasm.doReadMemory(0x4000)).toBe(ts.doReadMemory(0x4000));
    expect(wasm.wasmRuntime!.machineState.getUint8(SP48_WASM_LAYOUT.machineStateUlaPortOffset)).toBe(0x12);
  });

  it("stops bounded execution at a configured execution point", async () => {
    const wasm = await createWasmMachine(testRom([0x00, 0x00, 0x00]));

    wasm.executionContext.frameTerminationMode = FrameTerminationMode.UntilExecutionPoint;
    wasm.executionContext.debugStepMode = DebugStepMode.NoDebug;
    wasm.executionContext.terminationPoint = 0x0002;

    expect(wasm.executeMachineFrame()).toBe(FrameTerminationMode.UntilExecutionPoint);
    expect(wasm.pc).toBe(0x0002);
    expect(wasm.wasmRuntime!.result.getUint32(SP48_WASM_LAYOUT.resultInstructionCountOffset, true)).toBe(2);
  });

  it("keeps HALT progression in parity with the TypeScript 48K machine", async () => {
    const rom = testRom([0x76, 0x00, 0x00]);
    const ts = await createTsMachine(rom);
    const wasm = await createWasmMachine(rom);

    executeTsInstructions(ts, 2);
    executeWasmStepInto(wasm, 2);

    expectCpuSubset(wasm, ts);
    expect(wasm.halted).toBe(true);
  });

  it("detects frame end during bounded WASM execution", async () => {
    const wasm = await createWasmMachine(testRom([0x00, 0x00, 0x00]));
    wasm.setTactsInFrame(4);
    wasm.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
    wasm.executionContext.debugStepMode = DebugStepMode.StopAtBreakpoint;

    expect(wasm.executeMachineFrame()).toBe(FrameTerminationMode.Normal);
    expect(wasm.frames).toBe(1);
    expect(wasm.frameCompleted).toBe(true);
  });

  it("accepts maskable interrupts during bounded WASM execution", async () => {
    const rom = testRom([0x76, 0x00, 0x00]);
    const ts = await createTsMachine(rom);
    const wasm = await createWasmMachine(rom);

    executeTsInstructions(ts, 1);
    executeWasmStepInto(wasm, 1);
    ts.iff1 = ts.iff2 = true;
    ts.sigINT = true;
    wasm.iff1 = wasm.iff2 = true;
    wasm.sigINT = true;

    executeTsInstructions(ts, 1);
    executeWasmStepInto(wasm, 1);

    expectCpuSubset(wasm, ts);
    expect(wasm.pc).toBe(0x0038);
    expect(wasm.halted).toBe(false);
  });

  it("replays seeded instruction programs with TypeScript/WASM parity", async () => {
    for (const seed of [0x1234, 0x600d, 0xc0de, 0x5eed]) {
      const { rom, instructionCount } = seededProgram(seed, 48);
      const ts = await createTsMachine(rom);
      const wasm = await createWasmMachine(rom);

      executeTsInstructions(ts, instructionCount);
      executeWasmStepInto(wasm, instructionCount);

      expectCpuSubset(wasm, ts);
      expect(Array.from(wasm.get64KFlatMemory().subarray(0x4000, 0x4020))).toEqual(
        Array.from(ts.get64KFlatMemory().subarray(0x4000, 0x4020))
      );
    }
  });

  it("matches TypeScript contention timing for contended and uncontended memory reads", async () => {
    const contendedRom = testRom([0x3a, 0x00, 0x40]);
    const uncontendedRom = testRom([0x3a, 0x00, 0x80]);
    const contendedTs = await createTsMachine(contendedRom);
    const contendedWasm = await createWasmMachine(contendedRom);
    const uncontendedTs = await createTsMachine(uncontendedRom);
    const uncontendedWasm = await createWasmMachine(uncontendedRom);
    for (const machine of [contendedTs, contendedWasm, uncontendedTs, uncontendedWasm]) {
      fillContention(machine, 3);
      machine.doWriteMemory(0x4000, 0xa5);
      machine.doWriteMemory(0x8000, 0x5a);
    }
    contendedWasm.wasmRuntime!.contentionTable.fill(3);
    uncontendedWasm.wasmRuntime!.contentionTable.fill(3);

    executeTsInstructions(contendedTs, 1);
    executeWasmStepInto(contendedWasm, 1);
    executeTsInstructions(uncontendedTs, 1);
    executeWasmStepInto(uncontendedWasm, 1);

    expect(contendedWasm.tacts).toBe(contendedTs.tacts);
    expect(uncontendedWasm.tacts).toBe(uncontendedTs.tacts);
    expect(contendedWasm.tacts).toBeGreaterThan(uncontendedWasm.tacts);
  });

  it("matches TypeScript floating-bus reads at representative screen fetch tacts", async () => {
    const ts = await createTsMachine(testRom([]));
    const wasm = await createWasmMachine(testRom([]));
    const pixelFetch = findFloatingBusFetch(ts, "pixel");
    const attrFetch = findFloatingBusFetch(ts, "attr");

    setFrameTactForFloatingRead(ts, pixelFetch.tact);
    setFrameTactForFloatingRead(wasm, pixelFetch.tact);
    ts.doWriteMemory(pixelFetch.address, 0x34);
    wasm.patchMemory(pixelFetch.address, 0x34);
    expect(wasm.doReadPort(0xffff)).toBe(ts.doReadPort(0xffff));

    setFrameTactForFloatingRead(ts, attrFetch.tact);
    setFrameTactForFloatingRead(wasm, attrFetch.tact);
    ts.doWriteMemory(attrFetch.address, 0x56);
    wasm.patchMemory(attrFetch.address, 0x56);
    expect(wasm.doReadPort(0xffff)).toBe(ts.doReadPort(0xffff));
  });

  it("records border-change trace events from C during normal frame execution", async () => {
    const wasm = await createWasmMachine(testRom([0x3e, 0x02, 0xd3, 0xfe, 0x3e, 0x15, 0xd3, 0xfe]));
    wasm.setTactsInFrame(32);

    wasm.executeMachineFrame();

    expect(wasm.getWasmBorderTrace()).toEqual([
      { tact: 18, value: 0x02, color: 0x02, ear: false, mic: false },
      { tact: 4, value: 0x15, color: 0x05, ear: true, mic: false }
    ]);
    expect(wasm.wasmRuntime!.result.getUint32(SP48_WASM_LAYOUT.resultBorderTraceCountOffset, true)).toBe(2);
  });

  it("records tact-ordered EAR/MIC audio transitions from C during normal frame execution", async () => {
    const wasm = await createWasmMachine(testRom([0x3e, 0x10, 0xd3, 0xfe, 0x3e, 0x08, 0xd3, 0xfe]));
    wasm.setTactsInFrame(64);

    wasm.executeMachineFrame();

    expect(wasm.getWasmAudioTrace()).toEqual([
      { tact: 18, value: 0x10, ear: true, mic: false },
      { tact: 36, value: 0x08, ear: false, mic: true }
    ]);
    expect(wasm.wasmRuntime!.result.getUint32(SP48_WASM_LAYOUT.resultAudioTraceCountOffset, true)).toBe(2);
    expect(wasm.getWasmEventStatus()).toBe(0);
  });

  it("feeds WASM audio transitions through the existing beeper sample plumbing", async () => {
    const wasm = await createWasmMachine(testRom([0x3e, 0x10, 0xd3, 0xfe, 0x00, 0x00, 0x3e, 0x00, 0xd3, 0xfe]));
    wasm.beeperDevice.setAudioSampleRate(44_100);
    wasm.setTactsInFrame(256);

    wasm.executeMachineFrame();

    const samples = wasm.getAudioSamples();
    expect(samples.length).toBeGreaterThan(0);
    expect(samples.some(sample => sample.left > 0)).toBe(true);
    expect(samples.every(sample => sample.right === 0)).toBe(true);
  });

  it("matches TypeScript and WASM beeper transitions for square-wave and silence programs", async () => {
    const squareProgram = testRom([0x3e, 0x10, 0xd3, 0xfe, 0x00, 0x3e, 0x00, 0xd3, 0xfe, 0x00]);
    const silenceProgram = testRom([0x00, 0x00, 0x00, 0x00, 0x00]);

    for (const rom of [squareProgram, silenceProgram]) {
      const ts = await createTsMachine(rom);
      const wasm = await createWasmMachine(rom);
      ts.setTactsInFrame(96);
      wasm.setTactsInFrame(96);

      ts.executeMachineFrame();
      wasm.executeMachineFrame();

      expect(wasm.getWasmAudioTrace()).toEqual(ts.beeperTransitions);
    }
  });

  it("reports audio-event buffer overflow without writing beyond the bounded static trace", async () => {
    const wasm = await createWasmMachine(testRom(alternatingFeWrites(SP48_WASM_LAYOUT.audioTraceCapacity + 8)));
    wasm.setTactsInFrame(20_000);

    wasm.executeMachineFrame();

    expect(wasm.getWasmAudioTrace()).toHaveLength(SP48_WASM_LAYOUT.audioTraceCapacity);
    expect(wasm.getWasmEventStatus() & SP48_WASM_LAYOUT.eventStatusAudioOverflowMask).toBe(
      SP48_WASM_LAYOUT.eventStatusAudioOverflowMask
    );
  });

  it("matches TypeScript EAR sampling from the precomputed WASM tape input table", async () => {
    for (const tact of [0, 3, 4, 7, 8, 15, 16, 20]) {
      const ts = await createTsMachine(testRom([]));
      const wasm = await createWasmMachine(testRom([]));
      const block = tinyTapeBlock([0xff, 0x00]);
      prepareTapeLoad(ts, block);
      prepareTapeLoad(wasm, tinyTapeBlock([0xff, 0x00]));
      ts.setTactsInFrame(64);
      wasm.setTactsInFrame(64);
      setFrameTactForTapeRead(ts, tact);
      setFrameTactForTapeRead(wasm, tact);

      expect(wasm.doReadPort(0x00fe) & 0x40).toBe(ts.doReadPort(0x00fe) & 0x40);
    }
  });

  it("records MIC/tape-save trace events from FE writes while tape save mode is active", async () => {
    const wasm = await createWasmMachine(testRom([0x3e, 0x08, 0xd3, 0xfe, 0x3e, 0x00, 0xd3, 0xfe]));
    wasm.tapeDevice.tapeMode = TapeMode.Save;
    wasm.setTactsInFrame(64);

    wasm.executeMachineFrame();

    expect(wasm.getWasmTapeSaveTrace()).toEqual([
      { tact: 18, value: 0x08, mic: true, ear: false },
      { tact: 36, value: 0x00, mic: false, ear: false }
    ]);
  });

  it("reports tape-save trace overflow without writing beyond the bounded static trace", async () => {
    const wasm = await createWasmMachine(testRom(alternatingMicWrites(SP48_WASM_LAYOUT.tapeSaveTraceCapacity + 8)));
    wasm.tapeDevice.tapeMode = TapeMode.Save;
    wasm.setTactsInFrame(20_000);

    wasm.executeMachineFrame();

    expect(wasm.getWasmTapeSaveTrace()).toHaveLength(SP48_WASM_LAYOUT.tapeSaveTraceCapacity);
    expect(wasm.getWasmEventStatus() & SP48_WASM_LAYOUT.eventStatusTapeSaveOverflowMask).toBe(
      SP48_WASM_LAYOUT.eventStatusTapeSaveOverflowMask
    );
  });

  it("updates tape mode at WASM frame boundaries and honors fast-load disabled", async () => {
    const wasm = await createWasmMachine(testRom([]));
    wasm.setMachineProperty(FAST_LOAD, false);
    wasm.setMachineProperty(MEDIA_TAPE, [tinyTapeBlock([0xff, 0x11, 0xee])]);
    wasm.pc = 0x056c;
    wasm.setTactsInFrame(16);

    wasm.executeMachineFrame();

    expect(wasm.tapeDevice.tapeMode).toBe(TapeMode.Load);
  });

  it("fast-loads a small tape data block through the WASM boundary path with TypeScript parity", async () => {
    const bytes = [0xff, 0x42, 0x24];
    const ts = await createTsMachine(testRom([]));
    const wasm = await createWasmMachine(testRom([]));
    prepareFastLoadRegisters(ts);
    prepareFastLoadRegisters(wasm);
    ts.setMachineProperty(MEDIA_TAPE, [tinyTapeBlock(bytes)]);
    wasm.setMachineProperty(MEDIA_TAPE, [tinyTapeBlock(bytes)]);

    ts.tapeDevice.updateTapeMode();
    wasm.executeMachineFrame();

    expect(Array.from(wasm.get64KFlatMemory().subarray(0x8000, 0x8002))).toEqual(
      Array.from(ts.get64KFlatMemory().subarray(0x8000, 0x8002))
    );
    expect(wasm.tapeDevice.tapeMode).toBe(ts.tapeDevice.tapeMode);
  });

  it("renders screens from WASM RAM through the existing TypeScript screen renderer", async () => {
    const ts = await createTsMachine(testRom([]));
    const wasm = await createWasmMachine(testRom([]));
    ts.screenDevice.borderColor = 3;
    wasm.screenDevice.borderColor = 3;
    for (let offset = 0; offset < 0x1b00; offset++) {
      const value = (offset * 17 + 23) & 0xff;
      ts.doWriteMemory(0x4000 + offset, value);
      wasm.patchMemory(0x4000 + offset, value);
    }

    ts.renderInstantScreen();
    wasm.renderInstantScreen();

    expect(Array.from(wasm.getPixelBuffer())).toEqual(Array.from(ts.getPixelBuffer()));
  });

  it("executes a normal frame in WASM with TypeScript state parity", async () => {
    const rom = testRom([0x3e, 0x07, 0xd3, 0xfe, 0x32, 0x00, 0x40, 0x00, 0x00]);
    const ts = await createTsMachine(rom);
    const wasm = await createWasmMachine(rom);
    ts.setTactsInFrame(32);
    wasm.setTactsInFrame(32);

    const tsTermination = ts.executeMachineFrame();
    const wasmTermination = wasm.executeMachineFrame();

    expect(wasmTermination).toBe(tsTermination);
    expectCpuSubset(wasm, ts);
    expect(wasm.doReadMemory(0x4000)).toBe(ts.doReadMemory(0x4000));
    expect(wasm.screenDevice.borderColor).toBe(ts.screenDevice.borderColor);
  });

  it("reads FE keyboard rows from the WASM input block", async () => {
    const ts = await createTsMachine(testRom([]));
    const wasm = await createWasmMachine(testRom([]));

    expect(wasm.doReadPort(keyLineAddress(1))).toBe(ts.doReadPort(keyLineAddress(1)));

    ts.keyboardDevice.setKeyStatus(SpectrumKeyCode.A, true);
    wasm.keyboardDevice.setKeyStatus(SpectrumKeyCode.A, true);
    expect(wasm.doReadPort(keyLineAddress(1))).toBe(ts.doReadPort(keyLineAddress(1)));

    ts.keyboardDevice.setKeyStatus(SpectrumKeyCode.N1, true);
    wasm.keyboardDevice.setKeyStatus(SpectrumKeyCode.N1, true);
    expect(wasm.doReadPort(0x00fe)).toBe(ts.doReadPort(0x00fe));
  });

  it("exports FE output state after normal WASM frame execution", async () => {
    const ts = await createTsMachine(testRom([0x3e, 0x1b, 0xd3, 0xfe]));
    const wasm = await createWasmMachine(testRom([0x3e, 0x1b, 0xd3, 0xfe]));
    ts.setTactsInFrame(16);
    wasm.setTactsInFrame(16);

    ts.executeMachineFrame();
    wasm.executeMachineFrame();

    expect(wasm.wasmRuntime!.machineState.getUint8(SP48_WASM_LAYOUT.machineStateUlaPortOffset)).toBe(0x1b);
    expect(wasm.wasmRuntime!.machineState.getUint8(SP48_WASM_LAYOUT.machineStateBorderColorOffset)).toBe(0x03);
    expect(wasm.wasmRuntime!.machineState.getUint8(SP48_WASM_LAYOUT.machineStateEarLatchOffset)).toBe(1);
    expect(wasm.wasmRuntime!.machineState.getUint8(SP48_WASM_LAYOUT.machineStateMicLatchOffset)).toBe(1);
    expect(wasm.screenDevice.borderColor).toBe(ts.screenDevice.borderColor);
  });

  it("does not delegate normal frame execution to TypeScript CPU cycles", async () => {
    const machine = new NoCpuDelegateWasm48Machine(testRom([0x00, 0x00, 0x00]));
    await machine.setup();
    machine.setTactsInFrame(4);
    machine.executionContext.debugStepMode = DebugStepMode.NoDebug;
    machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;

    expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.Normal);
    expect(machine.frames).toBe(1);
  });

  it("imports instruction-bound memory and I/O access logs from C", async () => {
    const wasm = await createWasmMachine(testRom([0x3e, 0x77, 0x32, 0x00, 0x40, 0xd3, 0xfe]));

    executeWasmStepInto(wasm, 2);

    expect(Array.from(wasm.lastMemoryWrites.subarray(0, wasm.lastMemoryWritesCount))).toEqual([0x4000]);
    expect(wasm.lastMemoryWriteValue).toBe(0x77);

    executeWasmStepInto(wasm, 1);

    expect(wasm.lastIoWritePort).toBe(0x77fe);
    expect(wasm.lastIoWriteValue).toBe(0x77);
  });

  it("stops at WASM memory and I/O access breakpoints", async () => {
    const memoryWrite = await createWasmMachine(testRom([0x3e, 0x42, 0x32, 0x00, 0x40, 0x00]));
    memoryWrite.executionContext.debugSupport = new DebugSupport(undefined, [
      { address: 0x4000, memoryWrite: true }
    ]);
    memoryWrite.executionContext.debugStepMode = DebugStepMode.StopAtBreakpoint;
    memoryWrite.executionContext.frameTerminationMode = FrameTerminationMode.Normal;

    expect(memoryWrite.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
    expect(memoryWrite.pc).toBe(0x0005);

    const ioWrite = await createWasmMachine(testRom([0x3e, 0x10, 0xd3, 0xfe, 0x00]));
    ioWrite.executionContext.debugSupport = new DebugSupport(undefined, [
      { address: 0x10fe, ioWrite: true }
    ]);
    ioWrite.executionContext.debugStepMode = DebugStepMode.StopAtBreakpoint;
    ioWrite.executionContext.frameTerminationMode = FrameTerminationMode.Normal;

    expect(ioWrite.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
    expect(ioWrite.pc).toBe(0x0004);
  });

  it("supports WASM stop-at-breakpoint, step-over, step-out, and run-to-address policies", async () => {
    const stopAt = await createWasmMachine(testRom([0x00, 0x00, 0x00]));
    stopAt.executionContext.debugSupport = new DebugSupport(undefined, [{ address: 0x0001, exec: true }]);
    stopAt.executionContext.debugStepMode = DebugStepMode.StopAtBreakpoint;
    stopAt.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
    expect(stopAt.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
    expect(stopAt.pc).toBe(0x0001);

    const stepOver = await createWasmMachine(testRom([0xcd, 0x06, 0x00, 0x00, 0x00, 0x00, 0xc9]));
    stepOver.executionContext.debugSupport = new DebugSupport();
    stepOver.executionContext.debugStepMode = DebugStepMode.StepOver;
    stepOver.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
    expect(stepOver.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
    expect(stepOver.pc).toBe(0x0003);

    const stepOut = await createWasmMachine(testRom([0xc9]));
    stepOut.sp = 0xfffc;
    stepOut.patchMemory(0xfffc, 0x34);
    stepOut.patchMemory(0xfffd, 0x12);
    stepOut.stepOutAddress = 0x1234;
    stepOut.executionContext.debugSupport = new DebugSupport();
    stepOut.executionContext.debugStepMode = DebugStepMode.StepOut;
    stepOut.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
    expect(stepOut.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
    expect(stepOut.pc).toBe(0x1234);

    const runTo = await createWasmMachine(testRom([0x00, 0x00, 0x00]));
    runTo.executionContext.debugStepMode = DebugStepMode.NoDebug;
    runTo.executionContext.frameTerminationMode = FrameTerminationMode.UntilExecutionPoint;
    runTo.executionContext.terminationPoint = 0x0002;
    expect(runTo.executeMachineFrame()).toBe(FrameTerminationMode.UntilExecutionPoint);
    expect(runTo.pc).toBe(0x0002);
  });

  it("serves debugger CPU state and WASM diagnostics from the adapter", async () => {
    const wasm = await createWasmMachine(testRom([0x3e, 0x5a]));

    executeWasmStepInto(wasm, 1);

    expect(wasm.getCpuState()).toMatchObject({
      af: wasm.af,
      pc: 0x0002,
      sp: wasm.sp
    });
    expect(wasm.getWasmDiagnostics()).toMatchObject({
      backend: "wasm",
      abiVersion: 1,
      artifactName: "p2-cpu.wasm",
      lastTerminationStatus: FrameTerminationMode.DebugEvent,
      eventStatus: 0
    });
  });

  it("runs a P8 compatibility fixture across ROM, input, timing, border, audio, and tape summaries", async () => {
    const rom = testRom([
      0x3e, 0xfd,             // LD A,$FD: select keyboard row 1 for IN A,($FE)
      0xdb, 0xfe,             // IN A,($FE)
      0x32, 0x00, 0x40,       // LD ($4000),A
      0x3e, 0x18,             // LD A,$18: EAR+MIC high, border 0
      0xd3, 0xfe,             // OUT ($FE),A
      0x3e, 0x03,             // LD A,$03: EAR+MIC low, border 3
      0xd3, 0xfe,             // OUT ($FE),A
      0x00, 0x00, 0x00
    ]);
    const ts = await createTsMachine(rom);
    const wasm = await createWasmMachine(rom);
    ts.keyboardDevice.setKeyStatus(SpectrumKeyCode.A, true);
    wasm.keyboardDevice.setKeyStatus(SpectrumKeyCode.A, true);
    fillContention(ts, 1);
    fillContention(wasm, 1);
    wasm.wasmRuntime!.contentionTable.fill(1);
    ts.setTactsInFrame(128);
    wasm.setTactsInFrame(128);
    wasm.tapeDevice.tapeMode = TapeMode.Save;

    const tsTermination = ts.executeMachineFrame();
    const wasmTermination = wasm.executeMachineFrame();

    expect(wasmTermination).toBe(tsTermination);
    expectCpuSubset(wasm, ts);
    expect(Array.from(wasm.get64KFlatMemory().subarray(0x4000, 0x4008))).toEqual(
      Array.from(ts.get64KFlatMemory().subarray(0x4000, 0x4008))
    );
    expect(wasm.screenDevice.borderColor).toBe(ts.screenDevice.borderColor);
    expect(wasm.getWasmBorderTrace().map(({ tact, value, color }) => ({ tact, value, color }))).toEqual(
      ts.beeperTransitions.map(({ tact, value }) => ({ tact, value, color: value & 0x07 }))
    );
    expect(wasm.getWasmAudioTrace()).toEqual(ts.beeperTransitions);
    expect(wasm.getWasmTapeSaveTrace()).toEqual([
      { tact: ts.beeperTransitions[0].tact, value: 0x18, mic: true, ear: true },
      { tact: ts.beeperTransitions[1].tact, value: 0x03, mic: false, ear: false }
    ]);

    for (const tact of [0, 4, 8, 16, 24, 32]) {
      const tapeTs = await createTsMachine(testRom([]));
      const tapeWasm = await createWasmMachine(testRom([]));
      prepareTapeLoad(tapeTs, tinyTapeBlock([0xff, 0x5a, 0xa5]));
      prepareTapeLoad(tapeWasm, tinyTapeBlock([0xff, 0x5a, 0xa5]));
      tapeTs.setTactsInFrame(64);
      tapeWasm.setTactsInFrame(64);
      setFrameTactForTapeRead(tapeTs, tact);
      setFrameTactForTapeRead(tapeWasm, tact);
      expect(tapeWasm.doReadPort(0x00fe) & 0x40, `Tape EAR at tact ${tact}`).toBe(
        tapeTs.doReadPort(0x00fe) & 0x40
      );
    }
  });

  it("runs a correctness-first P8 release benchmark before recording timings", async () => {
    const { rom } = seededProgram(0x48_48, 64);
    const ts = await createTsMachine(rom);
    const wasm = await createWasmMachine(rom);
    ts.setTactsInFrame(128);
    wasm.setTactsInFrame(128);

    const tsStart = performance.now();
    const tsTermination = ts.executeMachineFrame();
    const tsElapsed = performance.now() - tsStart;
    const wasmStart = performance.now();
    const wasmTermination = wasm.executeMachineFrame();
    const wasmElapsed = performance.now() - wasmStart;

    expect(wasmTermination).toBe(tsTermination);
    expectCpuSubset(wasm, ts);
    expect(Array.from(wasm.get64KFlatMemory().subarray(0x4000, 0x4020))).toEqual(
      Array.from(ts.get64KFlatMemory().subarray(0x4000, 0x4020))
    );
    const benchmark = {
      frames: 1,
      frameTacts: wasm.tactsInFrame,
      typeScriptMs: Number(tsElapsed.toFixed(3)),
      wasmMs: Number(wasmElapsed.toFixed(3))
    };
    console.info(
      `ZX Spectrum 48K WASM P8 release benchmark: ${JSON.stringify(benchmark)}`
    );
  });
});

async function createTsMachine(rom: Uint8Array): Promise<TestTypeScript48Machine> {
  const machine = new TestTypeScript48Machine(rom);
  await machine.setup();
  return machine;
}

async function createWasmMachine(rom: Uint8Array): Promise<TestWasm48Machine> {
  const machine = new TestWasm48Machine(rom);
  await machine.setup();
  return machine;
}

function executeTsInstructions(machine: ZxSpectrum48Machine, count: number): void {
  for (let i = 0; i < count; i++) {
    do {
      machine.executeCpuCycle();
    } while (machine.instructionExecutionInProgress());
  }
}

function executeWasmStepInto(machine: ZxSpectrum48WasmMachine, count: number): void {
  machine.executionContext.debugStepMode = DebugStepMode.StepInto;
  machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
  for (let i = 0; i < count; i++) {
    expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
  }
}

function expectCpuSubset(wasm: ZxSpectrum48WasmMachine, ts: ZxSpectrum48Machine): void {
  expect({
    af: wasm.af,
    bc: wasm.bc,
    de: wasm.de,
    hl: wasm.hl,
    pc: wasm.pc,
    sp: wasm.sp,
    ir: wasm.ir,
    wz: wasm.wz,
    tacts: wasm.tacts,
    frameTacts: wasm.frameTacts,
    halted: wasm.halted,
    iff1: wasm.iff1,
    iff2: wasm.iff2,
    interruptMode: wasm.interruptMode
  }).toEqual({
    af: ts.af,
    bc: ts.bc,
    de: ts.de,
    hl: ts.hl,
    pc: ts.pc,
    sp: ts.sp,
    ir: ts.ir,
    wz: ts.wz,
    tacts: ts.tacts,
    frameTacts: ts.frameTacts,
    halted: ts.halted,
    iff1: ts.iff1,
    iff2: ts.iff2,
    interruptMode: ts.interruptMode
  });
}

function actualLoaderOptions(): Sp48WasmLoaderOptions {
  return {
    artifactName: "p2-cpu.wasm",
    readArtifact: async () => readFileSync(output)
  };
}

function fillContention(machine: ZxSpectrum48Machine, value: number): void {
  for (let tact = 0; tact < machine.tactsInFrame; tact++) {
    machine.setContentionValue(tact, value);
  }
}

function findFloatingBusFetch(
  machine: ZxSpectrum48Machine,
  kind: "pixel" | "attr"
): { tact: number; address: number } {
  for (let tact = 0; tact < machine.screenDevice.renderingTactTable.length; tact++) {
    const renderingTact = machine.screenDevice.renderingTactTable[tact];
    const address = kind === "pixel" ? renderingTact.pixelAddress : renderingTact.attributeAddress;
    if (address !== 0) {
      return { tact, address: 0x4000 + address };
    }
  }
  throw new Error(`No ${kind} floating-bus fetch tact found.`);
}

function setFrameTactForFloatingRead(machine: ZxSpectrum48Machine, floatingBusFetchTact: number): void {
  machine.frameTacts = (floatingBusFetchTact + 5) % machine.tactsInFrame;
  machine.currentFrameTact = machine.frameTacts;
}

function setFrameTactForTapeRead(machine: ZxSpectrum48Machine, tact: number): void {
  machine.setTacts(tact);
  machine.frameTacts = tact;
  machine.currentFrameTact = tact;
}

function testRom(bytes: number[]): Uint8Array {
  const rom = new Uint8Array(0x4000);
  rom.set(bytes);
  return rom;
}

function keyLineAddress(line: number): number {
  return (((~(1 << line)) & 0xff) << 8) | 0xfe;
}

function seededProgram(seed: number, instructionCount: number): { rom: Uint8Array; instructionCount: number } {
  const bytes: number[] = [];
  let state = seed >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state;
  };

  for (let i = 0; i < instructionCount; i++) {
    switch (next() % 8) {
      case 0:
        bytes.push(0x00);
        break;
      case 1:
        bytes.push(0x3e, next() & 0xff);
        break;
      case 2:
        bytes.push(0x06, next() & 0xff);
        break;
      case 3:
        bytes.push(0x0e, next() & 0xff);
        break;
      case 4:
        bytes.push(0x04);
        break;
      case 5:
        bytes.push(0x05);
        break;
      case 6: {
        const address = 0x4000 + (next() & 0x1f);
        bytes.push(0x32, address & 0xff, address >> 8);
        break;
      }
      default:
        bytes.push(0xd3, 0xfe);
        break;
    }
  }
  return { rom: testRom(bytes), instructionCount };
}

function alternatingFeWrites(count: number): number[] {
  const bytes: number[] = [];
  for (let index = 0; index < count; index++) {
    bytes.push(0x3e, index % 2 === 0 ? 0x10 : 0x00, 0xd3, 0xfe);
  }
  return bytes;
}

function alternatingMicWrites(count: number): number[] {
  const bytes: number[] = [];
  for (let index = 0; index < count; index++) {
    bytes.push(0x3e, index % 2 === 0 ? 0x08 : 0x00, 0xd3, 0xfe);
  }
  return bytes;
}

function tinyTapeBlock(payloadWithoutChecksum: number[]): TapeDataBlock {
  const block = new TapeDataBlock();
  const checksum = payloadWithoutChecksum.reduce((acc, value) => acc ^ value, 0);
  block.data = new Uint8Array([...payloadWithoutChecksum, checksum]);
  block.pilotPulseLength = 4;
  block.pilotPulseCount = 4;
  block.sync1PulseLength = 2;
  block.sync2PulseLength = 2;
  block.zeroBitPulseLength = 4;
  block.oneBitPulseLength = 8;
  block.endSyncPulseLength = 2;
  block.pauseAfter = 1;
  return block;
}

function prepareTapeLoad(machine: ZxSpectrum48Machine, block: TapeDataBlock): void {
  machine.setMachineProperty(MEDIA_TAPE, [block]);
  machine.tapeDevice.tapeMode = TapeMode.Load;
  machine.tapeDevice.nextTapeBlock();
}

function prepareFastLoadRegisters(machine: ZxSpectrum48Machine): void {
  machine.pc = 0x056c;
  machine.af_ = 0xff00;
  machine.ix = 0x8000;
  machine.de = 2;
  machine.setTactsInFrame(64);
}
