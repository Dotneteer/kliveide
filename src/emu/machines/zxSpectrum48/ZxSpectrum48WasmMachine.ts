import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { Sp48WasmLoaderOptions, Sp48WasmRuntime } from "./wasm/Sp48WasmLoader";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { TapeMode } from "@emu/abstractions/TapeMode";
import { MC_MEM_SIZE } from "@common/machines/constants";
import { RenderingPhase } from "@renderer/abstractions/RenderingPhase";
import type { BeeperTransition } from "../BeeperDevice";
import { loadSp48Wasm } from "./wasm/Sp48WasmLoader";
import { ZxSpectrum48Machine } from "./ZxSpectrum48Machine";
import { SP48_WASM_LAYOUT } from "./wasm/sp48-wasm-layout.generated";

export type Sp48WasmDirtyRange = {
  start: number;
  length: number;
};

export type Sp48WasmSnapshot = {
  memory: Uint8Array;
  machineState: Uint8Array;
};

export type Sp48WasmBorderTrace = {
  tact: number;
  value: number;
  color: number;
  ear: boolean;
  mic: boolean;
};

export type Sp48WasmAudioTrace = BeeperTransition & {
  value: number;
};

export type Sp48WasmTapeSaveTrace = {
  tact: number;
  value: number;
  mic: boolean;
  ear: boolean;
};

export type Sp48WasmDiagnostics = {
  backend: "wasm";
  abiVersion: number;
  artifactName: string;
  lastTerminationStatus: FrameTerminationMode | null | undefined;
  lastCpuStatus: number;
  eventStatus: number;
  counters: Sp48WasmDiagnosticsCounters;
};

export type Sp48WasmDiagnosticsCounters = {
  instructions: number;
  memoryReads: number;
  memoryWrites: number;
  portReads: number;
  portWrites: number;
  contentionDelays: number;
  floatingBusReads: number;
  traceEvents: number;
  tapeBoundaryYields: number;
};

export type Sp48WasmTapeEarSyncStats = {
  generations: number;
  reused: number;
  filledTacts: number;
  lastStartOffset: number;
  lastEndOffset: number;
};

export type Sp48WasmAdapterSyncStats = {
  inputSyncs: number;
  keyboardRowWrites: number;
  tapeModeWrites: number;
  tapeEarDefaultWrites: number;
  timingTableSyncs: number;
  contentionTableWrites: number;
  floatingBusTableWrites: number;
  skippedTraceReads: number;
  eventBufferViewReads: number;
};

const WASM_DIAGNOSTICS_COUNTER = {
  instructions: 0,
  memoryReads: 1,
  memoryWrites: 2,
  portReads: 3,
  portWrites: 4,
  contentionDelays: 5,
  floatingBusReads: 6,
  traceEvents: 7,
  tapeBoundaryYields: 8
} as const;

const CPU_STATE = {
  af: 0,
  bc: 2,
  de: 4,
  hl: 6,
  af_: 8,
  bc_: 10,
  de_: 12,
  hl_: 14,
  ix: 16,
  iy: 18,
  ir: 20,
  wz: 22,
  pc: 24,
  sp: 26,
  tacts: 28,
  frameTacts: 32,
  frames: 36,
  tactsInFrame: 40,
  prefix: 44,
  halted: 45,
  opCode: 46,
  interruptMode: 47,
  iff1: 48,
  iff2: 49,
  sigINT: 50,
  sigNMI: 51,
  sigRST: 52,
  eiBacklog: 53,
  afterLdAIR: 54,
  interruptVector: 55,
  z80nMode: 56,
  cpuTactScale: 57
} as const;

const WASM_TAPE_MODE_BOUNDARY_TERMINATION = FrameTerminationMode.UntilExecutionPoint;

/**
 * Bootstrap implementation selected for the future C/WebAssembly core.
 *
 * The public machine contract remains identical to the TypeScript machine, so
 * renderers, debuggers, media devices, and tests need no backend-specific
 * paths. Until the C core implements that contract, execution deliberately
 * remains delegated to the proven TypeScript implementation. This class is the
 * replacement point for the WASM-backed adapter, not a claim that CPU execution
 * has already moved to WASM.
 */
export class ZxSpectrum48WasmMachine extends ZxSpectrum48Machine {
  public readonly implementation = "wasm" as const;
  public wasmRuntime?: Sp48WasmRuntime;
  private wasmTapeEarSyncTapeMode = -1;
  private wasmTapeEarSyncBlocksVersion = 0;
  private wasmTapeEarSyncBlockIndex = -2;
  private wasmTapeEarSyncTapeStartTact = 0;
  private wasmTapeEarSyncTapeEof = false;
  private wasmTapeEarSyncFrameStartTact = -1;
  private wasmTapeEarSyncLength = 0;
  private wasmTapeEarSyncBlock?: unknown;
  private wasmTapeEarSyncData?: unknown;
  private wasmTapeEarSyncPilotPulseLength = 0;
  private wasmTapeEarSyncPilotPulseCount = 0;
  private wasmTapeEarSyncSync1PulseLength = 0;
  private wasmTapeEarSyncSync2PulseLength = 0;
  private wasmTapeEarSyncZeroBitPulseLength = 0;
  private wasmTapeEarSyncOneBitPulseLength = 0;
  private wasmTapeEarSyncEndSyncPulseLength = 0;
  private wasmTapeEarSyncLastByteUsedBits = 0;
  private wasmTapeEarSyncPauseAfter = 0;
  private wasmTapeEarSyncStartOffset = 0;
  private wasmTapeEarSyncEndOffset = 0;
  private wasmTapeEarSyncStats: Sp48WasmTapeEarSyncStats = {
    generations: 0,
    reused: 0,
    filledTacts: 0,
    lastStartOffset: 0,
    lastEndOffset: 0
  };
  private wasmTapeBlocksRef?: unknown;
  private wasmTapeBlocksVersion = 0;
  private readonly wasmKeyboardRows = new Uint8Array(8);
  private wasmKeyboardRowsValid = false;
  private wasmTapeModeSyncValue = -1;
  private wasmTapeEarDefaultSyncValue = -1;
  private wasmTimingTablesDirty = true;
  private wasmAudioSampleRate = -1;
  private readonly wasmAudioSamples: AudioSample[] = [];
  private wasmAdapterSyncStats: Sp48WasmAdapterSyncStats = {
    inputSyncs: 0,
    keyboardRowWrites: 0,
    tapeModeWrites: 0,
    tapeEarDefaultWrites: 0,
    timingTableSyncs: 0,
    contentionTableWrites: 0,
    floatingBusTableWrites: 0,
    skippedTraceReads: 0,
    eventBufferViewReads: 0
  };

  constructor(
    modelInfo?: MachineModel,
    config?: MachineConfigSet,
    private readonly wasmLoaderOptions?: Sp48WasmLoaderOptions
  ) {
    super(modelInfo, config);
  }

  /**
   * Sets up the WASM artifact and then keeps the existing TypeScript machine
   * setup path active until later phases move execution into the C frame kernel.
   */
  override async setup(): Promise<void> {
    this.wasmRuntime = await loadSp48Wasm(this.wasmLoaderOptions);
    this.wasmRuntime.exports.sp48_set_16k_model(this.modelInfo?.config?.[MC_MEM_SIZE] === 16 ? 1 : 0);
    await super.setup();
    this.invalidateWasmAdapterSync();
    this.syncTimingTablesToWasm(this.wasmRuntime);
    this.invalidateWasmTapeEarSync();
    this.syncWasmAudioSampleRate(this.wasmRuntime);
    this.syncCpuToWasm();
  }

  override hardReset(): void {
    super.hardReset();
    if (this.wasmRuntime != null) {
      this.wasmRuntime.exports.sp48_set_16k_model(this.modelInfo?.config?.[MC_MEM_SIZE] === 16 ? 1 : 0);
      this.wasmRuntime.exports.sp48_reset();
      this.invalidateWasmAdapterSync();
      this.syncTimingTablesToWasm(this.wasmRuntime);
      this.invalidateWasmTapeEarSync();
      this.syncWasmAudioSampleRate(this.wasmRuntime);
      this.syncCpuFromWasm();
    }
  }

  override executeMachineFrame(): FrameTerminationMode {
    if (this.wasmRuntime == null) {
      return super.executeMachineFrame();
    }

    const runtime = this.requireWasmRuntime();
    if (
      this.executionContext.debugStepMode === DebugStepMode.NoDebug &&
      this.executionContext.frameTerminationMode === FrameTerminationMode.Normal
    ) {
      if (this.frameCompleted) {
        this.onInitNewFrame(false);
        this.frameCompleted = false;
        this.emulateKeystroke();
      }
      this.tapeDevice.updateTapeMode();
      this.syncWasmAudioSampleRate(runtime);
      this.syncInputToWasm(runtime);
      this.syncCpuToWasm();
      let termination = FrameTerminationMode.Normal;
      const frameStartTact = this.tacts;
      const frameStartOffset = this.frameTacts;
      do {
        termination = runtime.exports.sp48_execute_frame() as FrameTerminationMode;
        this.syncCpuFromWasm();
        this.tapeDevice.updateTapeMode();
        if (termination === WASM_TAPE_MODE_BOUNDARY_TERMINATION && !this.frameCompleted) {
          this.syncInputToWasm(runtime);
          this.syncCpuToWasm();
        }
      } while (termination === WASM_TAPE_MODE_BOUNDARY_TERMINATION && !this.frameCompleted);
      this.syncMachineOutputFromWasm(runtime, true);
      this.replayWasmTapeSaveTrace(runtime, frameStartTact, frameStartOffset);
      this.executionContext.lastTerminationReason = termination;
      return termination;
    }

    return this.executeWasmDebugLoop(runtime);
  }

  override readScreenMemory(offset: number): number {
    return this.get64KFlatMemory()[0x4000 + (offset & 0x3fff)];
  }

  override get64KFlatMemory(): Uint8Array {
    return this.wasmRuntime?.memory ?? super.get64KFlatMemory();
  }

  override doReadMemory(address: number): number {
    return this.wasmRuntime?.memory[address & 0xffff] ?? super.doReadMemory(address);
  }

  override doWriteMemory(address: number, value: number): void {
    if (this.wasmRuntime == null) {
      super.doWriteMemory(address, value);
      return;
    }
    this.wasmRuntime.exports.sp48_write_memory(address & 0xffff, value & 0xff);
  }

  override doReadPort(address: number): number {
    if (this.wasmRuntime == null) {
      return super.doReadPort(address);
    }
    this.syncInputToWasm(this.wasmRuntime);
    this.syncCpuToWasm();
    return this.wasmRuntime.exports.sp48_read_port(address & 0xffff) & 0xff;
  }

  override doWritePort(address: number, value: number): void {
    if (this.wasmRuntime == null) {
      super.doWritePort(address, value);
      return;
    }
    this.wasmRuntime.exports.sp48_write_port(address & 0xffff, value & 0xff);
    this.syncMachineOutputFromWasm(this.wasmRuntime, true);
  }

  override getAudioSamples(): AudioSample[] {
    const runtime = this.wasmRuntime;
    if (runtime == null) return super.getAudioSamples();
    const count = Math.min(
      runtime.exports.sp48_audio_sample_count(),
      runtime.exports.sp48_audio_sample_capacity()
    );
    const scale = SP48_WASM_LAYOUT.audioSampleScale;
    this.wasmAudioSamples.length = count;
    for (let index = 0; index < count; index++) {
      const sample = this.wasmAudioSamples[index] ?? { left: 0, right: 0 };
      sample.left = Math.max(-1, Math.min(1, runtime.audioSamples[index * 2] / scale));
      sample.right = Math.max(-1, Math.min(1, runtime.audioSamples[index * 2 + 1] / scale));
      this.wasmAudioSamples[index] = sample;
    }
    return this.wasmAudioSamples;
  }

  override uploadRomBytes(data: Uint8Array): void {
    super.uploadRomBytes(data);
    if (this.wasmRuntime == null) return;
    for (let i = 0; i < data.length && i < 0x4000; i++) {
      this.wasmRuntime.exports.sp48_load_rom_byte(i, data[i]);
    }
  }

  patchMemory(address: number, value: number): void {
    if (this.wasmRuntime == null) {
      super.get64KFlatMemory()[address & 0xffff] = value & 0xff;
      return;
    }
    this.wasmRuntime.exports.sp48_patch_memory(address & 0xffff, value & 0xff);
  }

  clearWasmDirtyRanges(): void {
    this.wasmRuntime?.exports.sp48_clear_dirty_ranges();
  }

  clearWasmBorderTrace(): void {
    this.wasmRuntime?.exports.sp48_clear_border_trace();
  }

  clearWasmAudioTrace(): void {
    this.wasmRuntime?.exports.sp48_clear_audio_trace();
  }

  clearWasmTapeSaveTrace(): void {
    this.wasmRuntime?.exports.sp48_clear_tape_save_trace();
  }

  getWasmEventStatus(): number {
    return this.wasmRuntime?.exports.sp48_event_status() ?? 0;
  }

  getWasmDiagnostics(): Sp48WasmDiagnostics {
    const runtime = this.requireWasmRuntime();
    return {
      backend: this.implementation,
      abiVersion: runtime.exports.sp48_abi_version(),
      artifactName: runtime.artifactName,
      lastTerminationStatus: this.executionContext.lastTerminationReason,
      lastCpuStatus: runtime.result.getUint32(SP48_WASM_LAYOUT.resultCpuStatusOffset, true),
      eventStatus: runtime.exports.sp48_event_status(),
      counters: this.getWasmDiagnosticsCounters()
    };
  }

  resetWasmDiagnosticsCounters(): void {
    this.wasmRuntime?.exports.sp48_diagnostics_reset();
  }

  getWasmDiagnosticsCounters(): Sp48WasmDiagnosticsCounters {
    const runtime = this.requireWasmRuntime();
    return {
      instructions: runtime.exports.sp48_diagnostics_value(WASM_DIAGNOSTICS_COUNTER.instructions),
      memoryReads: runtime.exports.sp48_diagnostics_value(WASM_DIAGNOSTICS_COUNTER.memoryReads),
      memoryWrites: runtime.exports.sp48_diagnostics_value(WASM_DIAGNOSTICS_COUNTER.memoryWrites),
      portReads: runtime.exports.sp48_diagnostics_value(WASM_DIAGNOSTICS_COUNTER.portReads),
      portWrites: runtime.exports.sp48_diagnostics_value(WASM_DIAGNOSTICS_COUNTER.portWrites),
      contentionDelays: runtime.exports.sp48_diagnostics_value(WASM_DIAGNOSTICS_COUNTER.contentionDelays),
      floatingBusReads: runtime.exports.sp48_diagnostics_value(WASM_DIAGNOSTICS_COUNTER.floatingBusReads),
      traceEvents: runtime.exports.sp48_diagnostics_value(WASM_DIAGNOSTICS_COUNTER.traceEvents),
      tapeBoundaryYields: runtime.exports.sp48_diagnostics_value(WASM_DIAGNOSTICS_COUNTER.tapeBoundaryYields)
    };
  }

  getWasmTapeEarSyncStats(): Sp48WasmTapeEarSyncStats {
    return { ...this.wasmTapeEarSyncStats };
  }

  resetWasmTapeEarSyncStats(): void {
    this.wasmTapeEarSyncStats = {
      generations: 0,
      reused: 0,
      filledTacts: 0,
      lastStartOffset: 0,
      lastEndOffset: 0
    };
  }

  getWasmAdapterSyncStats(): Sp48WasmAdapterSyncStats {
    return { ...this.wasmAdapterSyncStats };
  }

  resetWasmAdapterSyncStats(): void {
    this.wasmAdapterSyncStats = {
      inputSyncs: 0,
      keyboardRowWrites: 0,
      tapeModeWrites: 0,
      tapeEarDefaultWrites: 0,
      timingTableSyncs: 0,
      contentionTableWrites: 0,
      floatingBusTableWrites: 0,
      skippedTraceReads: 0,
      eventBufferViewReads: 0
    };
  }

  getWasmBorderTrace(): Sp48WasmBorderTrace[] {
    const runtime = this.wasmRuntime;
    if (runtime == null) return [];
    const count = runtime.exports.sp48_border_trace_count();
    if (count <= 0) {
      this.wasmAdapterSyncStats.skippedTraceReads++;
      return [];
    }
    const events: Sp48WasmBorderTrace[] = [];
    const eventBuffer = runtime.eventBuffer;
    const eventBufferView = runtime.eventBufferView;
    for (let index = 0; index < count; index++) {
      const offset = index * SP48_WASM_LAYOUT.borderTraceRecordSize;
      events.push({
        tact: eventBufferView.getUint32(offset, true),
        value: eventBuffer[offset + 4],
        color: eventBuffer[offset + 5],
        ear: eventBuffer[offset + 6] !== 0,
        mic: eventBuffer[offset + 7] !== 0
      });
    }
    this.wasmAdapterSyncStats.eventBufferViewReads += count;
    return events;
  }

  getWasmAudioTrace(): Sp48WasmAudioTrace[] {
    const runtime = this.wasmRuntime;
    if (runtime == null) return [];
    const count = runtime.exports.sp48_audio_trace_count();
    if (count <= 0) {
      this.wasmAdapterSyncStats.skippedTraceReads++;
      return [];
    }
    const events: Sp48WasmAudioTrace[] = [];
    const eventBuffer = runtime.eventBuffer;
    const eventBufferView = runtime.eventBufferView;
    for (let index = 0; index < count; index++) {
      const offset =
        SP48_WASM_LAYOUT.audioTraceOffset +
        index * SP48_WASM_LAYOUT.audioTraceRecordSize;
      events.push({
        tact: eventBufferView.getUint32(offset, true),
        value: eventBuffer[offset + 4],
        ear: eventBuffer[offset + 5] !== 0,
        mic: eventBuffer[offset + 6] !== 0
      });
    }
    this.wasmAdapterSyncStats.eventBufferViewReads += count;
    return events;
  }

  getWasmTapeSaveTrace(): Sp48WasmTapeSaveTrace[] {
    const runtime = this.wasmRuntime;
    if (runtime == null) return [];
    const count = runtime.exports.sp48_tape_save_trace_count();
    if (count <= 0) {
      this.wasmAdapterSyncStats.skippedTraceReads++;
      return [];
    }
    const events: Sp48WasmTapeSaveTrace[] = [];
    const eventBuffer = runtime.eventBuffer;
    const eventBufferView = runtime.eventBufferView;
    for (let index = 0; index < count; index++) {
      const offset =
        SP48_WASM_LAYOUT.tapeSaveTraceOffset +
        index * SP48_WASM_LAYOUT.tapeSaveTraceRecordSize;
      events.push({
        tact: eventBufferView.getUint32(offset, true),
        value: eventBuffer[offset + 4],
        mic: eventBuffer[offset + 5] !== 0,
        ear: eventBuffer[offset + 6] !== 0
      });
    }
    this.wasmAdapterSyncStats.eventBufferViewReads += count;
    return events;
  }

  getWasmDirtyRanges(): Sp48WasmDirtyRange[] {
    const runtime = this.wasmRuntime;
    if (runtime == null) return [];
    const count = runtime.exports.sp48_dirty_range_count();
    const ranges: Sp48WasmDirtyRange[] = [];
    for (let index = 0; index < count; index++) {
      const offset = index * SP48_WASM_LAYOUT.dirtyRangeRecordSize;
      ranges.push({
        start: runtime.dirtyRanges.getUint16(offset, true),
        length: runtime.dirtyRanges.getUint16(offset + 2, true)
      });
    }
    return ranges;
  }

  exportWasmSnapshot(): Sp48WasmSnapshot {
    const runtime = this.requireWasmRuntime();
    runtime.exports.sp48_export_snapshot();
    return {
      memory: new Uint8Array(runtime.memory),
      machineState: new Uint8Array(runtime.machineState.buffer, runtime.machineState.byteOffset, runtime.machineState.byteLength).slice()
    };
  }

  importWasmSnapshot(snapshot: Sp48WasmSnapshot): void {
    const runtime = this.requireWasmRuntime();
    runtime.memory.set(snapshot.memory.subarray(0, runtime.memory.length));
    new Uint8Array(runtime.machineState.buffer, runtime.machineState.byteOffset, runtime.machineState.byteLength)
      .set(snapshot.machineState.subarray(0, runtime.machineState.byteLength));
    runtime.exports.sp48_import_snapshot();
  }

  private requireWasmRuntime(): Sp48WasmRuntime {
    if (this.wasmRuntime == null) {
      throw new Error("ZX Spectrum 48K WASM runtime is not loaded. Call setup() first.");
    }
    return this.wasmRuntime;
  }

  private syncWasmAudioSampleRate(runtime: Sp48WasmRuntime): void {
    const sampleRate = this.beeperDevice.getAudioSampleRate() || 44_100;
    if (sampleRate === this.wasmAudioSampleRate) return;
    runtime.exports.sp48_set_audio_sample_rate(sampleRate);
    this.wasmAudioSampleRate = sampleRate;
  }

  private configureWasmTerminationInput(runtime: Sp48WasmRuntime): void {
    const input = runtime.input;
    input.setUint8(SP48_WASM_LAYOUT.inputTerminationPointEnabledOffset, 0);
    if (
      this.executionContext.frameTerminationMode === FrameTerminationMode.UntilExecutionPoint &&
      this.executionContext.terminationPoint != null
    ) {
      input.setUint16(
        SP48_WASM_LAYOUT.inputTerminationPointOffset,
        this.executionContext.terminationPoint & 0xffff,
        true
      );
      input.setUint8(SP48_WASM_LAYOUT.inputTerminationPointEnabledOffset, 1);
    }
  }

  private executeWasmDebugLoop(runtime: Sp48WasmRuntime): FrameTerminationMode {
    const debugSupport = this.executionContext.debugSupport;
    let instructionsExecuted = 0;
    this.executionContext.lastTerminationReason = undefined;

    if (this.frameCompleted) {
      this.onInitNewFrame(false);
      this.frameCompleted = false;
    }

    if (debugSupport && this.pc !== debugSupport.lastStartupBreakpoint) {
      if (this.shouldStopAtCurrentBreakpoint(instructionsExecuted)) {
        return this.finishWasmDebugLoop(FrameTerminationMode.DebugEvent, instructionsExecuted);
      }
    }
    if (debugSupport) {
      debugSupport.lastStartupBreakpoint = undefined;
    }

    while (!this.frameCompleted) {
      if (this.frameCompleted) {
        this.onInitNewFrame(false);
        this.frameCompleted = false;
      }

      this.tapeDevice.updateTapeMode();
      this.syncCpuToWasm();
      this.syncInputToWasm(runtime);
      this.configureWasmTerminationInput(runtime);
      const frameStartTact = this.tacts;
      const frameStartOffset = this.frameTacts;
      const termination = runtime.exports.sp48_execute_instructions(
        1,
        this.tactsInCurrentFrame,
        this.executionContext.frameTerminationMode
      ) as FrameTerminationMode;
      this.syncCpuFromWasm();
      this.importWasmAccessLogs(runtime);
      this.syncMachineOutputFromWasm(runtime, true);
      this.replayWasmTapeSaveTrace(runtime, frameStartTact, frameStartOffset);
      this.tapeDevice.updateTapeMode();
      instructionsExecuted++;

      if (termination === FrameTerminationMode.UntilExecutionPoint) {
        return this.finishWasmDebugLoop(FrameTerminationMode.UntilExecutionPoint, instructionsExecuted);
      }
      if (this.hasWasmAccessBreakpoint()) {
        return this.finishWasmDebugLoop(FrameTerminationMode.DebugEvent, instructionsExecuted);
      }
      if (this.testTerminationPoint()) {
        return this.finishWasmDebugLoop(FrameTerminationMode.UntilExecutionPoint, instructionsExecuted);
      }
      if (this.shouldStopAtCurrentBreakpoint(instructionsExecuted)) {
        return this.finishWasmDebugLoop(FrameTerminationMode.DebugEvent, instructionsExecuted);
      }
      if (this.executionContext.debugStepMode === DebugStepMode.StepInto) {
        debugSupport && (debugSupport.imminentBreakpoint = undefined);
        return this.finishWasmDebugLoop(FrameTerminationMode.DebugEvent, instructionsExecuted);
      }
      if (this.getFrameCommand()) {
        return this.finishWasmDebugLoop(FrameTerminationMode.Normal, instructionsExecuted);
      }
    }

    return this.finishWasmDebugLoop(FrameTerminationMode.Normal, instructionsExecuted);
  }

  private finishWasmDebugLoop(
    termination: FrameTerminationMode,
    instructionsExecuted: number
  ): FrameTerminationMode {
    this.wasmRuntime?.result.setUint32(
      SP48_WASM_LAYOUT.resultInstructionCountOffset,
      instructionsExecuted,
      true
    );
    return (this.executionContext.lastTerminationReason = termination);
  }

  private shouldStopAtCurrentBreakpoint(instructionsExecuted: number): boolean {
    const debugSupport = this.executionContext.debugSupport;
    if (!debugSupport) return false;

    const stopAt = debugSupport.shouldStopAt(this.pc, () => this.getPartition(this.pc));
    if (
      stopAt &&
      (instructionsExecuted > 0 ||
        debugSupport.lastBreakpoint === undefined ||
        debugSupport.lastBreakpoint !== this.pc)
    ) {
      debugSupport.lastBreakpoint = this.pc;
      debugSupport.imminentBreakpoint = undefined;
      return true;
    }

    if (this.executionContext.debugStepMode === DebugStepMode.StopAtBreakpoint) {
      return false;
    }

    if (this.executionContext.debugStepMode === DebugStepMode.StepOver) {
      if (debugSupport.imminentBreakpoint !== undefined) {
        if (debugSupport.imminentBreakpoint === this.pc) {
          debugSupport.imminentBreakpoint = undefined;
          return true;
        }
        return false;
      }
      const length = this.getCallInstructionLength();
      if (length > 0) {
        debugSupport.imminentBreakpoint = (this.pc + length) & 0xffff;
        return false;
      }
      return instructionsExecuted > 0;
    }

    if (this.executionContext.debugStepMode === DebugStepMode.StepOut) {
      if (this.stepOutAddress === this.pc) {
        debugSupport.imminentBreakpoint = undefined;
        return true;
      }
      return false;
    }

    return false;
  }

  private hasWasmAccessBreakpoint(): boolean {
    const debugSupport = this.executionContext.debugSupport;
    if (!debugSupport) return false;
    return (
      debugSupport.hasMemoryRead(this.lastMemoryReads, this.lastMemoryReadsCount, (addr) => this.getPartition(addr)) ||
      debugSupport.hasMemoryWrite(this.lastMemoryWrites, this.lastMemoryWritesCount, (addr) => this.getPartition(addr)) ||
      debugSupport.hasIoRead(this.lastIoReadPort) ||
      debugSupport.hasIoWrite(this.lastIoWritePort)
    );
  }

  private importWasmAccessLogs(runtime: Sp48WasmRuntime): void {
    this.lastMemoryReadsCount = 0;
    this.lastMemoryWritesCount = 0;
    this.lastIoReadPort = undefined;
    this.lastIoWritePort = undefined;

    const memoryLogCount = Math.min(
      runtime.exports.sp48_debug_memory_log_count(),
      SP48_WASM_LAYOUT.debugAccessLogCapacity
    );
    for (let index = 0; index < memoryLogCount; index++) {
      const offset = index * SP48_WASM_LAYOUT.debugAccessLogRecordSize;
      const address = runtime.debugMemoryLog.getUint16(offset, true);
      const value = runtime.debugMemoryLog.getUint8(offset + 2);
      const operation = runtime.debugMemoryLog.getUint8(offset + 3);
      if (operation === 1) {
        if (this.lastMemoryWritesCount < this.lastMemoryWrites.length) {
          this.lastMemoryWrites[this.lastMemoryWritesCount++] = address;
        }
        this.lastMemoryWriteValue = value;
      } else {
        if (this.lastMemoryReadsCount < this.lastMemoryReads.length) {
          this.lastMemoryReads[this.lastMemoryReadsCount++] = address;
        }
        this.lastMemoryReadValue = value;
      }
    }

    const ioLogCount = Math.min(
      runtime.exports.sp48_debug_io_log_count(),
      SP48_WASM_LAYOUT.debugAccessLogCapacity
    );
    for (let index = 0; index < ioLogCount; index++) {
      const offset = index * SP48_WASM_LAYOUT.debugAccessLogRecordSize;
      const address = runtime.debugIoLog.getUint16(offset, true);
      const value = runtime.debugIoLog.getUint8(offset + 2);
      const operation = runtime.debugIoLog.getUint8(offset + 3);
      if (operation === 1) {
        this.lastIoWritePort = address;
        this.lastIoWriteValue = value;
      } else {
        this.lastIoReadPort = address;
        this.lastIoReadValue = value;
      }
    }
  }

  private syncInputToWasm(runtime: Sp48WasmRuntime): void {
    this.wasmAdapterSyncStats.inputSyncs++;
    for (let line = 0; line < 8; line++) {
      const keyLineValue = this.keyboardDevice.getKeyLineValue(line) & 0x1f;
      if (!this.wasmKeyboardRowsValid || this.wasmKeyboardRows[line] !== keyLineValue) {
        this.wasmKeyboardRows[line] = keyLineValue;
        runtime.keyboardLines[line] = keyLineValue;
        this.wasmAdapterSyncStats.keyboardRowWrites++;
      }
    }
    this.wasmKeyboardRowsValid = true;

    const tapeMode = this.tapeDevice.tapeMode;
    if (this.wasmTapeModeSyncValue !== tapeMode) {
      this.wasmTapeModeSyncValue = tapeMode;
      runtime.input.setUint8(SP48_WASM_LAYOUT.inputTapeModeOffset, tapeMode);
      this.wasmAdapterSyncStats.tapeModeWrites++;
    }

    if (this.wasmTapeEarDefaultSyncValue !== 1) {
      this.wasmTapeEarDefaultSyncValue = 1;
      runtime.input.setUint8(SP48_WASM_LAYOUT.inputTapeEarDefaultOffset, 1);
      this.wasmAdapterSyncStats.tapeEarDefaultWrites++;
    }
    this.syncTapeEarTableToWasm(runtime);
  }

  private invalidateWasmAdapterSync(): void {
    this.wasmKeyboardRowsValid = false;
    this.wasmTapeModeSyncValue = -1;
    this.wasmTapeEarDefaultSyncValue = -1;
    this.wasmTimingTablesDirty = true;
  }

  private syncTapeEarTableToWasm(runtime: Sp48WasmRuntime): void {
    const frameStartTact = this.tacts - this.frameTacts;
    const length = Math.min(
      runtime.tapeEarTable.length,
      this.tactsInCurrentFrame || this.tactsInFrame
    );
    const tapeState = this.getWasmTapeEarState(frameStartTact, length);
    if (this.tapeDevice.tapeMode !== TapeMode.Load || length <= 0) {
      this.storeWasmTapeEarState(tapeState);
      this.wasmTapeEarSyncStartOffset = 0;
      this.wasmTapeEarSyncEndOffset = 0;
      return;
    }

    const startOffset = Math.max(0, Math.min(this.frameTacts, length));
    if (
      this.matchesWasmTapeEarState(tapeState) &&
      this.wasmTapeEarSyncStartOffset <= startOffset &&
      this.wasmTapeEarSyncEndOffset >= length
    ) {
      this.wasmTapeEarSyncStats.reused++;
      return;
    }

    const savedTacts = this.tacts;
    const savedFrameTacts = this.frameTacts;
    const savedCurrentFrameTact = this.currentFrameTact;

    for (let tact = startOffset; tact < length; tact++) {
      this.setTacts(frameStartTact + tact);
      this.frameTacts = tact;
      this.currentFrameTact = tact;
      runtime.tapeEarTable[tact] = this.tapeDevice.getTapeEarBit() ? 1 : 0;
    }

    this.storeWasmTapeEarState(tapeState);
    this.wasmTapeEarSyncStartOffset = startOffset;
    this.wasmTapeEarSyncEndOffset = length;
    this.wasmTapeEarSyncStats.generations++;
    this.wasmTapeEarSyncStats.filledTacts += length - startOffset;
    this.wasmTapeEarSyncStats.lastStartOffset = startOffset;
    this.wasmTapeEarSyncStats.lastEndOffset = length;

    this.setTacts(savedTacts);
    this.frameTacts = savedFrameTacts;
    this.currentFrameTact = savedCurrentFrameTact;
  }

  private invalidateWasmTapeEarSync(): void {
    this.wasmTapeEarSyncTapeMode = -1;
    this.wasmTapeEarSyncStartOffset = 0;
    this.wasmTapeEarSyncEndOffset = 0;
  }

  private getWasmTapeEarState(frameStartTact: number, length: number): {
    tapeMode: number;
    blocksVersion: number;
    currentBlockIndex: number;
    tapeStartTact: number;
    tapeEof: boolean;
    frameStartTact: number;
    length: number;
    block?: unknown;
    data?: unknown;
    pilotPulseLength: number;
    pilotPulseCount: number;
    sync1PulseLength: number;
    sync2PulseLength: number;
    zeroBitPulseLength: number;
    oneBitPulseLength: number;
    endSyncPulseLength: number;
    lastByteUsedBits: number;
    pauseAfter: number;
  } {
    const tape = this.tapeDevice as unknown as {
      _blocks?: unknown;
      _currentBlockIndex?: number;
      _tapeStartTact?: number;
      _tapeEof?: boolean;
    };
    const blocksVersion = this.getWasmTapeBlocksVersion(tape._blocks);
    const blocks = Array.isArray(tape._blocks) ? tape._blocks : undefined;
    const currentBlockIndex = tape._currentBlockIndex ?? -1;
    const block = blocks?.[currentBlockIndex] as
      | {
          data?: { length?: number };
          pilotPulseLength?: number;
          pilotPulseCount?: number;
          sync1PulseLength?: number;
          sync2PulseLength?: number;
          zeroBitPulseLength?: number;
          oneBitPulseLength?: number;
          endSyncPulseLength?: number;
          lastByteUsedBits?: number;
          pauseAfter?: number;
        }
      | undefined;

    return {
      tapeMode: this.tapeDevice.tapeMode,
      blocksVersion,
      currentBlockIndex,
      tapeStartTact: tape._tapeStartTact ?? 0,
      tapeEof: tape._tapeEof ?? false,
      frameStartTact,
      length,
      block,
      data: block?.data,
      pilotPulseLength: block?.pilotPulseLength ?? 0,
      pilotPulseCount: block?.pilotPulseCount ?? 0,
      sync1PulseLength: block?.sync1PulseLength ?? 0,
      sync2PulseLength: block?.sync2PulseLength ?? 0,
      zeroBitPulseLength: block?.zeroBitPulseLength ?? 0,
      oneBitPulseLength: block?.oneBitPulseLength ?? 0,
      endSyncPulseLength: block?.endSyncPulseLength ?? 0,
      lastByteUsedBits: block?.lastByteUsedBits ?? 0,
      pauseAfter: block?.pauseAfter ?? 0
    };
  }

  private matchesWasmTapeEarState(state: ReturnType<ZxSpectrum48WasmMachine["getWasmTapeEarState"]>): boolean {
    return (
      this.wasmTapeEarSyncTapeMode === state.tapeMode &&
      this.wasmTapeEarSyncBlocksVersion === state.blocksVersion &&
      this.wasmTapeEarSyncBlockIndex === state.currentBlockIndex &&
      this.wasmTapeEarSyncTapeStartTact === state.tapeStartTact &&
      this.wasmTapeEarSyncTapeEof === state.tapeEof &&
      this.wasmTapeEarSyncFrameStartTact === state.frameStartTact &&
      this.wasmTapeEarSyncLength === state.length &&
      this.wasmTapeEarSyncBlock === state.block &&
      this.wasmTapeEarSyncData === state.data &&
      this.wasmTapeEarSyncPilotPulseLength === state.pilotPulseLength &&
      this.wasmTapeEarSyncPilotPulseCount === state.pilotPulseCount &&
      this.wasmTapeEarSyncSync1PulseLength === state.sync1PulseLength &&
      this.wasmTapeEarSyncSync2PulseLength === state.sync2PulseLength &&
      this.wasmTapeEarSyncZeroBitPulseLength === state.zeroBitPulseLength &&
      this.wasmTapeEarSyncOneBitPulseLength === state.oneBitPulseLength &&
      this.wasmTapeEarSyncEndSyncPulseLength === state.endSyncPulseLength &&
      this.wasmTapeEarSyncLastByteUsedBits === state.lastByteUsedBits &&
      this.wasmTapeEarSyncPauseAfter === state.pauseAfter
    );
  }

  private storeWasmTapeEarState(state: ReturnType<ZxSpectrum48WasmMachine["getWasmTapeEarState"]>): void {
    this.wasmTapeEarSyncTapeMode = state.tapeMode;
    this.wasmTapeEarSyncBlocksVersion = state.blocksVersion;
    this.wasmTapeEarSyncBlockIndex = state.currentBlockIndex;
    this.wasmTapeEarSyncTapeStartTact = state.tapeStartTact;
    this.wasmTapeEarSyncTapeEof = state.tapeEof;
    this.wasmTapeEarSyncFrameStartTact = state.frameStartTact;
    this.wasmTapeEarSyncLength = state.length;
    this.wasmTapeEarSyncBlock = state.block;
    this.wasmTapeEarSyncData = state.data;
    this.wasmTapeEarSyncPilotPulseLength = state.pilotPulseLength;
    this.wasmTapeEarSyncPilotPulseCount = state.pilotPulseCount;
    this.wasmTapeEarSyncSync1PulseLength = state.sync1PulseLength;
    this.wasmTapeEarSyncSync2PulseLength = state.sync2PulseLength;
    this.wasmTapeEarSyncZeroBitPulseLength = state.zeroBitPulseLength;
    this.wasmTapeEarSyncOneBitPulseLength = state.oneBitPulseLength;
    this.wasmTapeEarSyncEndSyncPulseLength = state.endSyncPulseLength;
    this.wasmTapeEarSyncLastByteUsedBits = state.lastByteUsedBits;
    this.wasmTapeEarSyncPauseAfter = state.pauseAfter;
  }

  private getWasmTapeBlocksVersion(blocks: unknown): number {
    if (this.wasmTapeBlocksRef !== blocks) {
      this.wasmTapeBlocksRef = blocks;
      this.wasmTapeBlocksVersion++;
      this.invalidateWasmTapeEarSync();
    }
    return this.wasmTapeBlocksVersion;
  }

  private syncTimingTablesToWasm(runtime: Sp48WasmRuntime): void {
    if (!this.wasmTimingTablesDirty) return;

    const table = this.screenDevice.renderingTactTable;
    runtime.contentionTable.fill(0);
    this.wasmAdapterSyncStats.contentionTableWrites += runtime.contentionTable.length;
    for (let tact = 0; tact < runtime.floatingBusTable.byteLength / 2; tact++) {
      runtime.floatingBusTable.setUint16(tact * 2, SP48_WASM_LAYOUT.floatingBusNone, true);
    }
    this.wasmAdapterSyncStats.floatingBusTableWrites += runtime.floatingBusTable.byteLength / 2;
    for (let tact = 0; tact < table.length && tact < SP48_WASM_LAYOUT.timingTableCapacity; tact++) {
      runtime.contentionTable[tact] = this.getContentionValue(tact) & 0xff;
      const renderingTact = table[tact];
      switch (renderingTact?.phase) {
        case RenderingPhase.BorderFetchPixel:
        case RenderingPhase.DisplayB1FetchB2:
        case RenderingPhase.DisplayB2FetchB1:
          runtime.floatingBusTable.setUint16(tact * 2, 0x4000 + (renderingTact.pixelAddress & 0x3fff), true);
          break;
        case RenderingPhase.BorderFetchAttr:
        case RenderingPhase.DisplayB1FetchA2:
        case RenderingPhase.DisplayB2FetchA1:
          runtime.floatingBusTable.setUint16(tact * 2, 0x4000 + (renderingTact.attributeAddress & 0x3fff), true);
          break;
      }
    }
    this.wasmTimingTablesDirty = false;
    this.wasmAdapterSyncStats.timingTableSyncs++;
  }

  private syncCpuToWasm(): void {
    const runtime = this.requireWasmRuntime();
    const state = runtime.machineState;
    state.setUint16(CPU_STATE.af, this.af, true);
    state.setUint16(CPU_STATE.bc, this.bc, true);
    state.setUint16(CPU_STATE.de, this.de, true);
    state.setUint16(CPU_STATE.hl, this.hl, true);
    state.setUint16(CPU_STATE.af_, this.af_, true);
    state.setUint16(CPU_STATE.bc_, this.bc_, true);
    state.setUint16(CPU_STATE.de_, this.de_, true);
    state.setUint16(CPU_STATE.hl_, this.hl_, true);
    state.setUint16(CPU_STATE.ix, this.ix, true);
    state.setUint16(CPU_STATE.iy, this.iy, true);
    state.setUint16(CPU_STATE.ir, this.ir, true);
    state.setUint16(CPU_STATE.wz, this.wz, true);
    state.setUint16(CPU_STATE.pc, this.pc, true);
    state.setUint16(CPU_STATE.sp, this.sp, true);
    state.setUint32(CPU_STATE.tacts, this.tacts, true);
    state.setUint32(CPU_STATE.frameTacts, this.frameTacts, true);
    state.setUint32(CPU_STATE.frames, this.frames, true);
    state.setUint32(CPU_STATE.tactsInFrame, this.tactsInCurrentFrame || this.tactsInFrame, true);
    state.setUint8(CPU_STATE.prefix, this.prefix);
    state.setUint8(CPU_STATE.halted, this.halted ? 1 : 0);
    state.setUint8(CPU_STATE.opCode, this.opCode);
    state.setUint8(CPU_STATE.interruptMode, this.interruptMode);
    state.setUint8(CPU_STATE.iff1, this.iff1 ? 1 : 0);
    state.setUint8(CPU_STATE.iff2, this.iff2 ? 1 : 0);
    state.setUint8(CPU_STATE.sigINT, this.sigINT ? 1 : 0);
    state.setUint8(CPU_STATE.sigNMI, this.sigNMI ? 1 : 0);
    state.setUint8(CPU_STATE.sigRST, this.sigRST ? 1 : 0);
    state.setUint8(CPU_STATE.eiBacklog, this.eiBacklog);
    state.setUint8(CPU_STATE.afterLdAIR, this.afterLdAIR ? 1 : 0);
    state.setUint8(CPU_STATE.interruptVector, 0xff);
    state.setUint8(CPU_STATE.z80nMode, 0);
    state.setUint8(CPU_STATE.cpuTactScale, 1);
    runtime.exports.sp48_import_state();
  }

  private syncCpuFromWasm(): void {
    const runtime = this.requireWasmRuntime();
    runtime.exports.sp48_export_state();
    const state = runtime.machineState;
    const previousFrames = this.frames;
    this.af = state.getUint16(CPU_STATE.af, true);
    this.bc = state.getUint16(CPU_STATE.bc, true);
    this.de = state.getUint16(CPU_STATE.de, true);
    this.hl = state.getUint16(CPU_STATE.hl, true);
    this.af_ = state.getUint16(CPU_STATE.af_, true);
    this.bc_ = state.getUint16(CPU_STATE.bc_, true);
    this.de_ = state.getUint16(CPU_STATE.de_, true);
    this.hl_ = state.getUint16(CPU_STATE.hl_, true);
    this.ix = state.getUint16(CPU_STATE.ix, true);
    this.iy = state.getUint16(CPU_STATE.iy, true);
    this.ir = state.getUint16(CPU_STATE.ir, true);
    this.wz = state.getUint16(CPU_STATE.wz, true);
    this.pc = state.getUint16(CPU_STATE.pc, true);
    this.sp = state.getUint16(CPU_STATE.sp, true);
    this.tacts = state.getUint32(CPU_STATE.tacts, true);
    this.frameTacts = state.getUint32(CPU_STATE.frameTacts, true);
    this.frames = state.getUint32(CPU_STATE.frames, true);
    this.prefix = state.getUint8(CPU_STATE.prefix);
    this.halted = state.getUint8(CPU_STATE.halted) !== 0;
    this.opCode = state.getUint8(CPU_STATE.opCode);
    this.interruptMode = state.getUint8(CPU_STATE.interruptMode);
    this.iff1 = state.getUint8(CPU_STATE.iff1) !== 0;
    this.iff2 = state.getUint8(CPU_STATE.iff2) !== 0;
    this.sigINT = state.getUint8(CPU_STATE.sigINT) !== 0;
    this.sigNMI = state.getUint8(CPU_STATE.sigNMI) !== 0;
    this.sigRST = state.getUint8(CPU_STATE.sigRST) !== 0;
    this.eiBacklog = state.getUint8(CPU_STATE.eiBacklog);
    this.afterLdAIR = state.getUint8(CPU_STATE.afterLdAIR) !== 0;
    this.frameCompleted = this.frames !== previousFrames;
    this.currentFrameTact = Math.floor(this.frameTacts / this.clockMultiplier);
    this.syncMachineOutputFromWasm(runtime);
  }

  private syncMachineOutputFromWasm(runtime: Sp48WasmRuntime, syncBeeper = false): void {
    this.screenDevice.borderColor = runtime.machineState.getUint8(
      SP48_WASM_LAYOUT.machineStateBorderColorOffset
    ) & 0x07;
    if (syncBeeper) {
      this.beeperDevice.setOutputLevel(
        runtime.machineState.getUint8(SP48_WASM_LAYOUT.machineStateEarLatchOffset) !== 0,
        runtime.machineState.getUint8(SP48_WASM_LAYOUT.machineStateMicLatchOffset) !== 0
      );
    }
  }

  private replayWasmTapeSaveTrace(
    _runtime: Sp48WasmRuntime,
    frameStartTact: number,
    frameStartOffset: number
  ): void {
    if (this.tapeDevice.tapeMode !== TapeMode.Save) return;
    if (_runtime.exports.sp48_tape_save_trace_count() <= 0) {
      this.wasmAdapterSyncStats.skippedTraceReads++;
      return;
    }
    const savedTact = this.tacts;
    const savedFrameTacts = this.frameTacts;
    const savedCurrentFrameTact = this.currentFrameTact;
    const frameTacts = this.tactsInCurrentFrame || this.tactsInFrame;
    let previousAbsoluteTact = frameStartTact;

    for (const transition of this.getWasmTapeSaveTrace()) {
      const relativeTact =
        frameTacts <= 0
          ? transition.tact
          : (transition.tact - frameStartOffset + frameTacts) % frameTacts;
      let absoluteTact = frameStartTact + relativeTact;
      while (absoluteTact < previousAbsoluteTact) {
        absoluteTact += frameTacts;
      }
      this.setTacts(absoluteTact);
      this.frameTacts = frameTacts <= 0 ? transition.tact : transition.tact % frameTacts;
      this.currentFrameTact = this.frameTacts;
      this.tapeDevice.processMicBit(transition.mic);
      previousAbsoluteTact = absoluteTact;
    }

    this.setTacts(savedTact);
    this.frameTacts = savedFrameTacts;
    this.currentFrameTact = savedCurrentFrameTact;
  }
}
