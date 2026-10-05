import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

import { TimexWasmV2Machine } from "./TimexWasmV2Machine";

/** Creates a Timex machine (the TC2048) on the Timex WASM core. */
export function createTimexMachine(model?: MachineModel, config?: MachineConfigSet): TimexWasmV2Machine {
  return new TimexWasmV2Machine(model, config);
}
