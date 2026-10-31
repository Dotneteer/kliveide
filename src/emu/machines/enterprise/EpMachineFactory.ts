import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";

import { MI_ENTERPRISE } from "@common/machines/constants";
import { EpWasmV2Machine } from "./EpWasmV2Machine";

/**
 * Creates an Enterprise 64/128: one WASM core for both models (`.plans/ENTERPRISE_PLAN.md`, D2).
 * @param model The machine model
 * @param config The machine configuration; it overrides the model's configuration
 * @param messenger The messenger to the main process
 */
export function createEpMachine(model?: MachineModel, config?: MachineConfigSet, messenger?: MessengerBase): EpWasmV2Machine {
  return new EpWasmV2Machine(MI_ENTERPRISE, model, config, messenger);
}
