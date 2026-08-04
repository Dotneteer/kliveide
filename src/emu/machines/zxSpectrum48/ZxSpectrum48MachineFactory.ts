import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

import { getZxSpectrum48Implementation } from "./ZxSpectrum48Implementation";
import { ZxSpectrum48Machine } from "./ZxSpectrum48Machine";
import { ZxSpectrum48WasmV2Machine } from "./ZxSpectrum48WasmV2Machine";

/** Creates a 48K machine using the backend explicitly requested in config. */
export function createZxSpectrum48Machine(
  model?: MachineModel,
  config?: MachineConfigSet
): ZxSpectrum48Machine {
  const effectiveConfig = config ?? model?.config;
  const implementation = getZxSpectrum48Implementation(effectiveConfig);
  return implementation === "wasm"
    ? new ZxSpectrum48WasmV2Machine(model, config)
    : new ZxSpectrum48Machine(model, config);
}
