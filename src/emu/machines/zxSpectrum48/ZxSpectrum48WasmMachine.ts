import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { Sp48WasmLoaderOptions, Sp48WasmRuntime } from "./wasm/Sp48WasmLoader";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { TapeMode } from "@emu/abstractions/TapeMode";
import { MC_MEM_SIZE } from "@common/machines/constants";
import { RenderingPhase } from "@renderer/abstractions/RenderingPhase";
import { SpectrumBeeperDevice, type BeeperTransition } from "../BeeperDevice";
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
    this.syncTimingTablesToWasm(this.wasmRuntime);
    this.syncCpuToWasm();
  }

  override hardReset(): void {
    super.hardReset();
    if (this.wasmRuntime != null) {
      this.wasmRuntime.exports.sp48_set_16k_model(this.modelInfo?.config?.[MC_MEM_SIZE] === 16 ? 1 : 0);
      this.wasmRuntime.exports.sp48_reset();
      this.syncTimingTablesToWasm(this.wasmRuntime);
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
      this.syncInputToWasm(runtime);
      this.syncCpuToWasm();
      const frameStartTact = this.tacts;
      const frameStartOffset = this.frameTacts;
      const termination = runtime.exports.sp48_execute_frame() as FrameTerminationMode;
      this.syncCpuFromWasm();
      this.replayWasmAudioTrace(runtime, frameStartTact, frameStartOffset, this.tacts);
      this.replayWasmTapeSaveTrace(runtime, frameStartTact, frameStartOffset);
      this.tapeDevice.updateTapeMode();
      this.executionContext.lastTerminationReason = termination;
      return termination;
    }

    this.tapeDevice.updateTapeMode();
    this.syncCpuToWasm();
    this.syncInputToWasm(runtime);
    this.configureWasmTerminationInput(runtime);
    const frameStartTact = this.tacts;
    const frameStartOffset = this.frameTacts;

    const maxInstructions =
      this.executionContext.debugStepMode === DebugStepMode.StepInto ? 1 : 100_000;
    const termination = runtime.exports.sp48_execute_instructions(
      maxInstructions,
      this.tactsInCurrentFrame,
      this.executionContext.frameTerminationMode
    ) as FrameTerminationMode;
    this.syncCpuFromWasm();
    this.replayWasmAudioTrace(runtime, frameStartTact, frameStartOffset, this.tacts);
    this.replayWasmTapeSaveTrace(runtime, frameStartTact, frameStartOffset);
    this.tapeDevice.updateTapeMode();

    const result =
      this.executionContext.debugStepMode === DebugStepMode.StepInto
        ? FrameTerminationMode.DebugEvent
        : termination;
    this.executionContext.lastTerminationReason = result;
    return result;
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

  getWasmBorderTrace(): Sp48WasmBorderTrace[] {
    const runtime = this.wasmRuntime;
    if (runtime == null) return [];
    const count = runtime.exports.sp48_border_trace_count();
    const events: Sp48WasmBorderTrace[] = [];
    for (let index = 0; index < count; index++) {
      const offset = index * SP48_WASM_LAYOUT.borderTraceRecordSize;
      events.push({
        tact: new DataView(
          runtime.eventBuffer.buffer,
          runtime.eventBuffer.byteOffset + offset,
          SP48_WASM_LAYOUT.borderTraceRecordSize
        ).getUint32(0, true),
        value: runtime.eventBuffer[offset + 4],
        color: runtime.eventBuffer[offset + 5],
        ear: runtime.eventBuffer[offset + 6] !== 0,
        mic: runtime.eventBuffer[offset + 7] !== 0
      });
    }
    return events;
  }

  getWasmAudioTrace(): Sp48WasmAudioTrace[] {
    const runtime = this.wasmRuntime;
    if (runtime == null) return [];
    const count = runtime.exports.sp48_audio_trace_count();
    const events: Sp48WasmAudioTrace[] = [];
    for (let index = 0; index < count; index++) {
      const offset =
        SP48_WASM_LAYOUT.audioTraceOffset +
        index * SP48_WASM_LAYOUT.audioTraceRecordSize;
      events.push({
        tact: new DataView(
          runtime.eventBuffer.buffer,
          runtime.eventBuffer.byteOffset + offset,
          SP48_WASM_LAYOUT.audioTraceRecordSize
        ).getUint32(0, true),
        value: runtime.eventBuffer[offset + 4],
        ear: runtime.eventBuffer[offset + 5] !== 0,
        mic: runtime.eventBuffer[offset + 6] !== 0
      });
    }
    return events;
  }

  getWasmTapeSaveTrace(): Sp48WasmTapeSaveTrace[] {
    const runtime = this.wasmRuntime;
    if (runtime == null) return [];
    const count = runtime.exports.sp48_tape_save_trace_count();
    const events: Sp48WasmTapeSaveTrace[] = [];
    for (let index = 0; index < count; index++) {
      const offset =
        SP48_WASM_LAYOUT.tapeSaveTraceOffset +
        index * SP48_WASM_LAYOUT.tapeSaveTraceRecordSize;
      events.push({
        tact: new DataView(
          runtime.eventBuffer.buffer,
          runtime.eventBuffer.byteOffset + offset,
          SP48_WASM_LAYOUT.tapeSaveTraceRecordSize
        ).getUint32(0, true),
        value: runtime.eventBuffer[offset + 4],
        mic: runtime.eventBuffer[offset + 5] !== 0,
        ear: runtime.eventBuffer[offset + 6] !== 0
      });
    }
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

  private syncInputToWasm(runtime: Sp48WasmRuntime): void {
    for (let line = 0; line < 8; line++) {
      runtime.input.setUint8(
        SP48_WASM_LAYOUT.inputKeyboardRowsOffset + line,
        this.keyboardDevice.getKeyLineValue(line) & 0x1f
      );
    }
    runtime.input.setUint8(SP48_WASM_LAYOUT.inputTapeModeOffset, this.tapeDevice.tapeMode);
    runtime.input.setUint8(SP48_WASM_LAYOUT.inputTapeEarDefaultOffset, 1);
    this.syncTapeEarTableToWasm(runtime);
  }

  private syncTapeEarTableToWasm(runtime: Sp48WasmRuntime): void {
    runtime.tapeEarTable.fill(1);
    if (this.tapeDevice.tapeMode !== TapeMode.Load) return;

    const savedTacts = this.tacts;
    const savedFrameTacts = this.frameTacts;
    const savedCurrentFrameTact = this.currentFrameTact;
    const frameStartTact = this.tacts - this.frameTacts;
    const length = Math.min(
      runtime.tapeEarTable.length,
      this.tactsInCurrentFrame || this.tactsInFrame
    );

    for (let tact = 0; tact < length; tact++) {
      this.setTacts(frameStartTact + tact);
      this.frameTacts = tact;
      this.currentFrameTact = tact;
      runtime.tapeEarTable[tact] = this.tapeDevice.getTapeEarBit() ? 1 : 0;
    }

    this.setTacts(savedTacts);
    this.frameTacts = savedFrameTacts;
    this.currentFrameTact = savedCurrentFrameTact;
  }

  private syncTimingTablesToWasm(runtime: Sp48WasmRuntime): void {
    const table = this.screenDevice.renderingTactTable;
    runtime.contentionTable.fill(0);
    for (let tact = 0; tact < runtime.floatingBusTable.byteLength / 2; tact++) {
      runtime.floatingBusTable.setUint16(tact * 2, SP48_WASM_LAYOUT.floatingBusNone, true);
    }
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

  private replayWasmAudioTrace(
    runtime: Sp48WasmRuntime,
    frameStartTact: number,
    frameStartOffset: number,
    frameEndTact: number
  ): void {
    if (!(this.beeperDevice instanceof SpectrumBeeperDevice)) return;
    const transitions = this.getWasmAudioTrace();
    this.beeperDevice.renderTransitionTrace(
      transitions,
      frameStartTact,
      frameStartOffset,
      this.tactsInCurrentFrame || this.tactsInFrame,
      frameEndTact
    );
    this.beeperDevice.setOutputLevel(
      runtime.machineState.getUint8(SP48_WASM_LAYOUT.machineStateEarLatchOffset) !== 0,
      runtime.machineState.getUint8(SP48_WASM_LAYOUT.machineStateMicLatchOffset) !== 0
    );
  }

  private replayWasmTapeSaveTrace(
    _runtime: Sp48WasmRuntime,
    frameStartTact: number,
    frameStartOffset: number
  ): void {
    if (this.tapeDevice.tapeMode !== TapeMode.Save) return;
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
