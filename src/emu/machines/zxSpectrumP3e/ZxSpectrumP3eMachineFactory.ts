import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

import { getZxSpectrumP3eImplementation } from "./ZxSpectrumP3eImplementation";
import { mergeZxSpectrumP3eConfig, ZxSpectrumP3EMachine } from "./ZxSpectrumP3eMachine";
import { ZxSpectrumP3eWasmV2Machine } from "./ZxSpectrumP3eWasmV2Machine";

/** Creates a +2E/+3E machine using the backend explicitly requested in config. */
export function createZxSpectrumP3eMachine(
  model?: MachineModel,
  config?: MachineConfigSet
): ZxSpectrumP3EMachine {
  const effectiveConfig = mergeZxSpectrumP3eConfig(model, config);
  const implementation = getZxSpectrumP3eImplementation(effectiveConfig);
  return implementation === "wasm"
    ? new ZxSpectrumP3eWasmV2Machine(model, effectiveConfig)
    : new ZxSpectrumP3EMachine(model, effectiveConfig);
}
