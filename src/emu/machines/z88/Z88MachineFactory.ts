import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";

import { Z88WasmV2Machine } from "./Z88WasmV2Machine";

/**
 * Creates a Cambridge Z88 machine: the WASM core (`wasm/`), the only Z88 emulation since the
 * TypeScript one was removed (`.plans/CAMBRIDGE_Z88_TYPESCRIPT_REMOVAL_PLAN.md`).
 * @param model The machine model
 * @param config The machine configuration; it overrides the model's configuration
 * @param messenger The messenger to the main process
 */
export function createZ88Machine(
  model?: MachineModel,
  config?: MachineConfigSet,
  messenger?: MessengerBase
): Z88WasmV2Machine {
  return new Z88WasmV2Machine(model, config, messenger);
}
