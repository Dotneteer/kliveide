import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

import { ZxSpectrum128WasmV2Machine } from "./ZxSpectrum128WasmV2Machine";

/** Creates a 128K machine using the production WASM backend. */
export function createZxSpectrum128Machine(
  model?: MachineModel,
  config?: MachineConfigSet
): ZxSpectrum128WasmV2Machine {
  return new ZxSpectrum128WasmV2Machine(model, config);
}
