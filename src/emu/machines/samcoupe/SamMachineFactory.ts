import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";

import { MI_SAM_COUPE } from "@common/machines/constants";
import { SamWasmV2Machine } from "./SamWasmV2Machine";

/**
 * Creates a SAM Coupé: one WASM core for both models (`dev/plans/SAM_COUPE_PLAN.md`, D2).
 * @param model The machine model
 * @param config The machine configuration; it overrides the model's configuration
 * @param messenger The messenger to the main process
 */
export function createSamMachine(model?: MachineModel, config?: MachineConfigSet, messenger?: MessengerBase): SamWasmV2Machine {
  return new SamWasmV2Machine(MI_SAM_COUPE, model, config, messenger);
}
