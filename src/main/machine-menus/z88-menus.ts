import fs from "fs";

import { MachineControllerState } from "@common/abstractions/MachineControllerState";
import { MachineMenuRenderer } from "@common/machines/info-types";
import { getEmuApi } from "@common/messaging/MainToEmuMessenger";
import { incMenuVersionAction } from "@common/state/actions";
import { mainStore } from "@main/main-store";
import { saveKliveProject } from "@main/projects";
import { getModelConfig } from "@common/machines/machine-registry";
import { MC_SCREEN_SIZE } from "@common/machines/constants";
import { setMachineType } from "@main/registeredMachines";

/** The LCD sizes a Z88 can have; the value is the machine configuration's `MC_SCREEN_SIZE` */
export const Z88_LCD_SIZES: { label: string; value: string }[] = [
  { label: "640 x 64", value: "640x64" },
  { label: "640 x 256", value: "640x256" },
  { label: "640 x 320", value: "640x320" },
  { label: "640 x 480", value: "640x480" }
];

/**
 * Rebuilds the Z88 with another LCD size (Settings › Machine). The new configuration is every key of
 * the model's (e.g. the Z88 backend selection) plus the size; the registered model's own config
 * object is never changed. Does nothing when the size is already in force.
 */
export async function setZ88Lcd(lcd: string): Promise<void> {
  const emulatorState = mainStore.getState()?.emulatorState;
  if ((emulatorState?.config ?? {})[MC_SCREEN_SIZE] === lcd) return;
  const machineId = emulatorState?.machineId;
  const modelId = emulatorState?.modelId;
  const config = { ...getModelConfig(machineId, modelId), [MC_SCREEN_SIZE]: lcd };
  setMachineType(machineId, modelId, config);
  mainStore.dispatch(incMenuVersionAction());
  await saveKliveProject();
}

/**
 * Renders reset-related menus
 */
export const z88ResetRenderer: MachineMenuRenderer = () => {
  const execState = mainStore.getState()?.emulatorState?.machineState;
  return [
    { type: "separator" },
    {
      id: "z88_reset",
      label: "Soft Reset",
      accelerator: "F8",
      click: async () => {
        await getEmuApi().issueMachineCommand("reset");
      }
    },
    {
      id: "z88_hard_reset",
      label: "Hard Reset",
      accelerator: "F9",
      click: async () => {
        await getEmuApi().issueMachineCommand("restart");
      }
    },
    { type: "separator" },
    {
      id: "z88_press_both_shifts",
      label: "Press Both SHIFT Keys",
      accelerator: "F6",
      enabled: execState === MachineControllerState.Running,
      click: async () => {
        await getEmuApi().issueMachineCommand("custom", "press_shifts");
      }
    },
    {
      id: "z88_battery_low",
      label: "Raise Battery Low Signal",
      enabled: execState === MachineControllerState.Running,
      click: async () => {
        await getEmuApi().issueMachineCommand("custom", "battery_low");
      }
    }
  ];
};

/**
 * Checks if specified file is a vlid OZ Application Card
 * @param filename File to check
 * @returns File contents or error message
 */
export async function checkZ88SlotFile(
  filename: string,
  expectedSize?: number
): Promise<string | Uint8Array> {
  try {
    const contents = Uint8Array.from(fs.readFileSync(filename));

    // --- Check contents length
    if (expectedSize && expectedSize !== contents.length) {
      return `Invalid card file length: ${contents.length}. The card file length should be ${expectedSize} bytes.`;
    }

    // --- Done: valid ROM
    return contents;
  } catch (err) {
    // --- This error is intentionally ignored
    return (
      `Error processing card file ${filename}. ` +
      "Please check if you have the appropriate access rights " +
      "to read the files contents and the file is a valid ROM file."
    );
  }
}
