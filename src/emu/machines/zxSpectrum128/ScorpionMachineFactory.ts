import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

import { ScorpionWasmV2Machine } from "./ScorpionWasmV2Machine";

/** Creates a Scorpion ZS-256 on the 128K's WASM core. */
export function createScorpionMachine(model?: MachineModel, config?: MachineConfigSet): ScorpionWasmV2Machine {
  return new ScorpionWasmV2Machine(model, config);
}
