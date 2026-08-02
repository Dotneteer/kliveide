import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { Sp48WasmLoaderOptions, Sp48WasmRuntime } from "./wasm/Sp48WasmLoader";

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
  }

  override hardReset(): void {
    super.hardReset();
    if (this.wasmRuntime != null) {
      this.wasmRuntime.exports.sp48_set_16k_model(this.modelInfo?.config?.[MC_MEM_SIZE] === 16 ? 1 : 0);
      this.wasmRuntime.exports.sp48_reset();
    }
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
}
