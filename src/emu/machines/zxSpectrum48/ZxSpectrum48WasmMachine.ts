import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { Sp48WasmLoaderOptions, Sp48WasmRuntime } from "./wasm/Sp48WasmLoader";

import { loadSp48Wasm } from "./wasm/Sp48WasmLoader";
import { ZxSpectrum48Machine } from "./ZxSpectrum48Machine";

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
    await super.setup();
  }
}
