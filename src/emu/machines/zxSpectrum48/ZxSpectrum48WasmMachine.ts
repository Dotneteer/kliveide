import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

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

  constructor(modelInfo?: MachineModel, config?: MachineConfigSet) {
    super(modelInfo, config);
  }
}
