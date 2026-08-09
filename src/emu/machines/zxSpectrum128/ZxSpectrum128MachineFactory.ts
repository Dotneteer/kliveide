import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

import { getZxSpectrum128Implementation } from "./ZxSpectrum128Implementation";
import { ZxSpectrum128Machine } from "./ZxSpectrum128Machine";
import { ZxSpectrum128WasmV2Machine } from "./ZxSpectrum128WasmV2Machine";

/** Creates a 128K machine using the backend explicitly requested in config. */
export function createZxSpectrum128Machine(
  model?: MachineModel,
  config?: MachineConfigSet
): ZxSpectrum128Machine {
  const effectiveConfig = config ?? model?.config;
  const implementation = getZxSpectrum128Implementation(effectiveConfig);
  return implementation === "wasm"
    ? new ZxSpectrum128WasmV2Machine(model, config)
    : new ZxSpectrum128Machine();
}
