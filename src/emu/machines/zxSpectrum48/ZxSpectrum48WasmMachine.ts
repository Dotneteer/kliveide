import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { Sp48WasmLoaderOptions, Sp48WasmRuntime } from "./wasm/Sp48WasmLoader";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { MC_MEM_SIZE } from "@common/machines/constants";
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
    this.syncCpuToWasm();
  }

  override hardReset(): void {
    super.hardReset();
    if (this.wasmRuntime != null) {
      this.wasmRuntime.exports.sp48_set_16k_model(this.modelInfo?.config?.[MC_MEM_SIZE] === 16 ? 1 : 0);
      this.wasmRuntime.exports.sp48_reset();
      this.syncCpuFromWasm();
    }
  }

  override executeMachineFrame(): FrameTerminationMode {
    if (
      this.wasmRuntime == null ||
      (this.executionContext.debugStepMode === DebugStepMode.NoDebug &&
        this.executionContext.frameTerminationMode === FrameTerminationMode.Normal)
    ) {
      return super.executeMachineFrame();
    }

    const runtime = this.requireWasmRuntime();
    this.syncCpuToWasm();
    this.configureWasmTerminationInput(runtime);

    const maxInstructions =
      this.executionContext.debugStepMode === DebugStepMode.StepInto ? 1 : 100_000;
    const termination = runtime.exports.sp48_execute_instructions(
      maxInstructions,
      this.tactsInCurrentFrame,
      this.executionContext.frameTerminationMode
    ) as FrameTerminationMode;
    this.syncCpuFromWasm();

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
  }
}
