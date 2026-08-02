import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

import { getZxSpectrum48Implementation } from "./ZxSpectrum48Implementation";
import { ZxSpectrum48Machine } from "./ZxSpectrum48Machine";
import { ZxSpectrum48WasmMachine } from "./ZxSpectrum48WasmMachine";

/** Creates a 48K machine using the backend explicitly requested in config. */
export function createZxSpectrum48Machine(
  model?: MachineModel,
  config?: MachineConfigSet
): ZxSpectrum48Machine {
  const effectiveConfig = config ?? model?.config;
  return getZxSpectrum48Implementation(effectiveConfig) === "wasm"
    ? new ZxSpectrum48WasmMachine(model, config)
    : new ZxSpectrum48Machine(model, config);
}
