import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";

import { ZxNextMachine } from "./ZxNextMachine";

/** Creates a ZX Spectrum Next machine. */
export function createZxNextMachine(
  model?: MachineModel,
  _config?: MachineConfigSet,
  messenger?: MessengerBase
): ZxNextMachine {
  return new ZxNextMachine(model, messenger);
}
