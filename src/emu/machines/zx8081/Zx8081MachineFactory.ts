import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";

import { Zx8081WasmV2Machine } from "./Zx8081WasmV2Machine";

/**
 * Creates a Sinclair ZX80 or ZX81: one WASM core for both (`.plans/ZX8081_WASM_PLAN.md`, D2/D6).
 * @param machineId `zx80` or `zx81`
 * @param model The machine model
 * @param config The machine configuration; it overrides the model's configuration
 * @param messenger The messenger to the main process
 */
export function createZx8081Machine(
  machineId: string,
  model?: MachineModel,
  config?: MachineConfigSet,
  messenger?: MessengerBase
): Zx8081WasmV2Machine {
  return new Zx8081WasmV2Machine(machineId, model, config, messenger);
}
