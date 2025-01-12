import type { MachineConfigSet } from "@common/machines/info-types";
import type { OutputColor } from "@renderer/appIde/ToolArea/abstractions";

import { getEmuAltApi } from "@messaging/MainToEmuMessenger";
import { getIdeAltApi } from "@messaging/MainToIdeMessenger";
import { PANE_ID_EMU } from "@common/integration/constants";

export const registeredMachines = [
  {
    id: "sp48",
    displayName: "ZX Spectrum 48K"
  },
  {
    id: "sp128",
    displayName: "ZX Spectrum 128K"
  },
  {
    id: "spp2e",
    displayName: "ZX Spectrum +2E"
  },
  {
    id: "spp3e",
    displayName: "ZX Spectrum +3E WIP (1 FDD)",
    supportedFdds: 1
  },
  {
    id: "spp3ef2",
    displayName: "ZX Spectrum +3E WIP (2 FDDs)",
    supportedFdds: 2
  },
  {
    id: "z88",
    displayName: "Cambridge Z88 WIP"
  }
];

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
  await getEmuAltApi().setMachineType(machineId, modelId, config);
  const mt = registeredMachines.find((mt) => mt.id === machineId);
  if (mt) {
    await logEmuEvent(`Machine type set to ${mt.displayName} (${mt.id})`, "bright-cyan");
  }
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
  const ideApi = getIdeAltApi();
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
