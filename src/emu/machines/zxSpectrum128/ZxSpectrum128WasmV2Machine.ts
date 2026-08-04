import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

import { ZxSpectrum128Machine } from "./ZxSpectrum128Machine";

/**
 * Placeholder adapter for the ZX Spectrum 128K WASM V2 migration path.
 *
 * Step 1 makes backend selection testable without changing the default 128K
 * machine. Later migration slices replace this TypeScript-backed placeholder
 * with the full C/WASM adapter.
 */
export class ZxSpectrum128WasmV2Machine extends ZxSpectrum128Machine {
  public readonly implementation = "wasm" as const;

  constructor(
    public readonly requestedModelInfo?: MachineModel,
    public readonly requestedConfig?: MachineConfigSet
  ) {
    super();
  }
}
