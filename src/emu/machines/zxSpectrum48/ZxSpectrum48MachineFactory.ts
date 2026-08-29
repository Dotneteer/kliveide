import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

import { ZxSpectrum48WasmV2Machine } from "./ZxSpectrum48WasmV2Machine";

/** Creates a 48K machine using the production WASM backend. */
export function createZxSpectrum48Machine(
  model?: MachineModel,
  config?: MachineConfigSet
): ZxSpectrum48WasmV2Machine {
  return new ZxSpectrum48WasmV2Machine(model, config);
}
