import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";

import { MI_HT1080Z } from "@common/machines/constants";
import { Ht1080zWasmV2Machine } from "./Ht1080zWasmV2Machine";

/**
 * Creates an HT-1080Z: one WASM core for every model (`.plans/HT1080Z_PLAN.md`, D1).
 * @param model The machine model
 * @param config The machine configuration; it overrides the model's configuration
 * @param messenger The messenger to the main process
 */
export function createHt1080zMachine(
  model?: MachineModel,
  config?: MachineConfigSet,
  messenger?: MessengerBase
): Ht1080zWasmV2Machine {
  return new Ht1080zWasmV2Machine(MI_HT1080Z, model, config, messenger);
}
