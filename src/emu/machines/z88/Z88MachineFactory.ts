import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";

import { getZ88Implementation } from "./Z88Implementation";
import { Z88Machine } from "./Z88Machine";
import { Z88WasmV2Machine } from "./Z88WasmV2Machine";

/**
 * Creates a Cambridge Z88 machine on the backend its configuration (or its model) selects.
 * @param model The machine model
 * @param config The machine configuration; it overrides the model's configuration
 * @param messenger The messenger to the main process
 */
export function createZ88Machine(
  model?: MachineModel,
  config?: MachineConfigSet,
  messenger?: MessengerBase
): Z88Machine | Z88WasmV2Machine {
  return getZ88Implementation(config, model) === "wasm"
    ? new Z88WasmV2Machine(model, config, messenger)
    : new Z88Machine(model, config, messenger);
}
