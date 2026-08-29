import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

import { mergeZxSpectrumP3eConfig } from "./ZxSpectrumP3eWasmHost";
import { ZxSpectrumP3eWasmV2Machine } from "./ZxSpectrumP3eWasmV2Machine";

/** Creates a +2E/+3E machine using the production WASM backend. */
export function createZxSpectrumP3eMachine(
  model?: MachineModel,
  config?: MachineConfigSet
): ZxSpectrumP3eWasmV2Machine {
  const effectiveConfig = mergeZxSpectrumP3eConfig(model, config);
  return new ZxSpectrumP3eWasmV2Machine(model, effectiveConfig);
}
