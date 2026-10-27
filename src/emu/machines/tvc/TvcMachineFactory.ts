import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";

import { MI_TVC } from "@common/machines/constants";
import { TvcWasmV2Machine } from "./TvcWasmV2Machine";

/**
 * Creates a Videoton TVC: one WASM core for both models (`.plans/VIDEOTON_TVC_PLAN.md`, D2).
 * @param model The machine model
 * @param config The machine configuration; it overrides the model's configuration
 * @param messenger The messenger to the main process
 */
export function createTvcMachine(model?: MachineModel, config?: MachineConfigSet, messenger?: MessengerBase): TvcWasmV2Machine {
  return new TvcWasmV2Machine(MI_TVC, model, config, messenger);
}
