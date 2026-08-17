import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";

import { getZxNextImplementation } from "./ZxNextImplementation";
import { ZxNextMachine } from "./ZxNextMachine";
import { ZxNextWasmV2Machine } from "./ZxNextWasmV2Machine";

/** Creates a ZX Spectrum Next machine. */
export function createZxNextMachine(
  model?: MachineModel,
  config?: MachineConfigSet,
  messenger?: MessengerBase
): ZxNextMachine {
  const effectiveConfig = config ?? model?.config;
  const implementation = getZxNextImplementation(effectiveConfig);
  return implementation === "wasm"
    ? new ZxNextWasmV2Machine(model, config, messenger)
    : new ZxNextMachine(model, messenger);
}
