import type { MachineConfigSet } from "../common/machines/info-types";

import { getEmuApi } from "../common/messaging/MainToEmuMessenger";
import { getIdeApi } from "../common/messaging/MainToIdeMessenger";
import { PANE_ID_EMU } from "../common/integration/constants";
import { getMachineName } from "../common/machines/machine-registry";
import { machineMenuRegistry } from "./machine-menus/machine-menu-registry";
import { OutputColor } from "../common/abstractions/OutputBuffer";

/**
 * This function set the machine type to the specified one
 * @param machineId ID of the machine type
 * @param modelId ID of the machine model
 * @param config Optional machine configuration
 */
export async function setMachineType(
  machineId: string,
  modelId?: string,
  config?: MachineConfigSet
): Promise<void> {
  // --- Setup the machine, it it requires a setup
  const machineInfo = machineMenuRegistry[machineId];
  machineInfo?.setup?.();

  // --- Set the emulator to the selected machine type and log the event
  await getEmuApi().setMachineType(machineId, modelId, config);
  const machineName = getMachineName(machineId, modelId);
  await logEmuEvent(`Machine type changed to ${machineName}`, "bright-cyan");
}

// --- The number of events logged with the emulator
let loggedEmuOutputEvents = 0;

/**
 * Log emulator events
 * @param text Log text
 * @param foreground Text color to use
 */
export async function logEmuEvent(text: string, foreground?: OutputColor): Promise<void> {
  loggedEmuOutputEvents++;
  const ideApi = getIdeApi();
  await ideApi.displayOutput({
    pane: PANE_ID_EMU,
    text: `[${loggedEmuOutputEvents}] `,
    foreground: "yellow",
    writeLine: false
  });
  await ideApi.displayOutput({
    pane: PANE_ID_EMU,
    text,
    foreground,
    writeLine: true
  });
}
