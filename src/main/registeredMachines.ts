import { sendFromMainToEmu } from "../common/messaging/MainToEmuMessenger";
import { sendFromMainToIde } from "../common/messaging/MainToIdeMessenger";
import { OutputColor } from "@renderer/appIde/ToolArea/abstractions";

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
 * @param machineId
 */
export async function setMachineType (machineId: string): Promise<void> {
  await sendFromMainToEmu({
    type: "EmuSetMachineType",
    machineId
  });
  const mt = registeredMachines.find(mt => mt.id === machineId);
  if (mt) {
    await logEmuEvent(
      `Machine type set to ${mt.displayName} (${mt.id})`,
      "bright-cyan"
    );
  }
}

// --- The number of events logged with the emulator
let loggedEmuOutputEvents = 0;

/**
 * Log emulator events
 * @param text Log text
 * @param color Text color to use
 */
export async function logEmuEvent (
  text: string,
  color?: OutputColor
): Promise<void> {
  loggedEmuOutputEvents++;
  await sendFromMainToIde({
    type: "IdeDisplayOutput",
    pane: "emu",
    text: `[${loggedEmuOutputEvents}] `,
    color: "yellow",
    writeLine: false
  });
  await sendFromMainToIde({
    type: "IdeDisplayOutput",
    pane: "emu",
    text,
    color,
    writeLine: true
  });
}
