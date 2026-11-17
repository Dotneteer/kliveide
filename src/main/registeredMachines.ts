import type { MachineConfigSet } from "@common/machines/info-types";
import type { OutputColor } from "@renderer/appIde/ToolArea/abstractions";

import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { PANE_ID_EMU } from "@common/integration/constants";
import { getMachineName } from "@common/machines/machine-registry";
import { machineMenuRegistry } from "./machine-menus/machine-menu-registry";
import { clearStandIn } from "./standInMachine";

/**
 * What a machine change did: "applied"; "superseded" by another change that started while this one
 * set up; "declined" by the machine's setup (a Next whose SD card the user did not download), which
 * leaves the previous machine running
 */
export type MachineChangeOutcome = "applied" | "superseded" | "declined";

/**
 * This function set the machine type to the specified one
 * @param machineId ID of the machine type
 * @param modelId ID of the machine model
 * @param config Optional machine configuration
 * @returns true when the machine changed
 */
export async function setMachineType(
  machineId: string,
  modelId?: string,
  config?: MachineConfigSet
): Promise<boolean> {
  return (await changeMachineType(machineId, modelId, config)) === "applied";
}

/**
 * Changes the machine, saying what happened
 * @param options.keepStandIn A stand-in for a declined machine (`standInMachine.ts`): the machine
 * the settings keep stays the one the user chose. Any other change is the user's and ends a stand-in.
 */
export async function changeMachineType(
  machineId: string,
  modelId?: string,
  config?: MachineConfigSet,
  options: { keepStandIn?: boolean } = {}
): Promise<MachineChangeOutcome> {
  // --- Setup the machine, it it requires a setup
  const machineInfo = machineMenuRegistry[machineId];
  const machineName = getMachineName(machineId, modelId);
  if ((await machineInfo?.setup?.(modelId)) === false) {
    await logEmuEvent(`The machine stays as it was: ${machineName} cannot run without its SD card`, "yellow");
    return "declined";
  }

  // --- Set the emulator to the selected machine type and log the event
  const applied = await getEmuApi().setMachineType(machineId, modelId, config);
  if (applied === false) {
    // --- Another machine change started while this one was setting up and won. Say so instead of
    // --- reporting a change that did not actually take effect.
    await logEmuEvent(
      `Switching to ${machineName} was superseded by another machine change`,
      "yellow"
    );
    return "superseded";
  }
  if (!options.keepStandIn) clearStandIn();
  await logEmuEvent(`Machine type changed to ${machineName}`, "bright-cyan");
  return "applied";
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
  // --- One message, not two: see `MachineController.sendOutput`.
  await ideApi.displayOutputBatch([
    {
      pane: PANE_ID_EMU,
      text: `[${loggedEmuOutputEvents}] `,
      foreground: "yellow",
      writeLine: false
    },
    {
      pane: PANE_ID_EMU,
      text,
      foreground,
      writeLine: true
    }
  ]);
}
