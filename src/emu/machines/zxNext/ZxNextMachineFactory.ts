import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";

import { ZxNextWasmV2Machine } from "./ZxNextWasmV2Machine";

/**
 * Creates a ZX Spectrum Next machine.
 *
 * There is one backend: the WASM core. The TypeScript emulator that used to sit behind a
 * `zxnextImplementation` config key was removed once the WASM core reached parity
 * (`.plans/ZX_SPECTRUM_NEXT_TYPESCRIPT_REMOVAL_PLAN.md`).
 */
export function createZxNextMachine(
  model?: MachineModel,
  config?: MachineConfigSet,
  messenger?: MessengerBase
): ZxNextWasmV2Machine {
  return new ZxNextWasmV2Machine(model, config, messenger);
}
