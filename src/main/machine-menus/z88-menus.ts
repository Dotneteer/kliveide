import fs from "fs";

import { MachineControllerState } from "@common/abstractions/MachineControllerState";
import { MachineMenuRenderer } from "@common/machines/info-types";
import { sendFromMainToEmu } from "@common/messaging/MainToEmuMessenger";
import { createMachineCommand } from "@common/messaging/main-to-emu";
import { emuSetKeyboardLayoutAction, incMenuVersionAction } from "@common/state/actions";
import { mainStore } from "@main/main-store";
import { saveKliveProject } from "@main/projects";
import { getModelConfig } from "@common/machines/machine-registry";
import { MC_SCREEN_SIZE } from "@common/machines/constants";
import { setMachineType } from "@main/registeredMachines";

const Z88_KEYBOARDS = "z88_keyboards";
const Z88_DE_KEYBOARD = "z88_de_layout";
const Z88_DK_KEYBOARD = "z88_dk_layout";
const Z88_FR_KEYBOARD = "z88_fr_layout";
const Z88_IT_KEYBOARD = "z88_it_layout";
const Z88_ES_KEYBOARD = "z88_es_layout";
const Z88_SE_KEYBOARD = "z88_se_layout";
const Z88_UK_KEYBOARD = "z88_uk_layout";

/**
 * Renders Z88 keyboard layout commands
 */
export const z88KeyboardLayoutRenderer: MachineMenuRenderer = () => {
  const layouts = [
    { id: Z88_UK_KEYBOARD, label: "British && American", kdid: "uk" },
    { id: Z88_ES_KEYBOARD, label: "Spanish", kdid: "es" },
    { id: Z88_FR_KEYBOARD, label: "French", kdid: "fr" },
    { id: Z88_IT_KEYBOARD, label: "Italian", kdid: "it" },
    { id: Z88_DE_KEYBOARD, label: "German", kdid: "de" },
    { id: Z88_DK_KEYBOARD, label: "Danish && Norwegian", kdid: "dk" },
    { id: Z88_SE_KEYBOARD, label: "Swedish && Finish", kdid: "se" }
  ];
  const kbState = mainStore.getState()?.emuViewOptions?.keyboardLayout;
  return [
    {
      id: Z88_KEYBOARDS,
      label: "Keyboard layout",
      type: "submenu",
      submenu: layouts.map((layout) => ({
        id: layout.id,
        label: layout.label,
        type: "radio",
        checked: layout.kdid === kbState,
        click: async () => {
          mainStore.dispatch(emuSetKeyboardLayoutAction(layout.kdid));
          await saveKliveProject();
        }
      }))
    }
  ];
};

/**
 * Renders Z88 keyboard layout commands
 */
export const z88LcdRenderer: MachineMenuRenderer = () => {
  const lcds = [
    { id: "z88_640_64", label: "640 x 64" },
    { id: "z88_640_320", label: "640 x 320" },
    { id: "z88_640_480", label: "640 x 480" },
    { id: "z88_800_320", label: "800 x 320" },
    { id: "z88_800_480", label: "800 x 480" }
  ];
  const config = mainStore.getState()?.emulatorState?.config ?? {};
  const lcdState = config?.[MC_SCREEN_SIZE];
  return [
    {
      id: "z88_lcd",
      label: "LCD resolution",
      type: "submenu",
      submenu: lcds.map((lcd) => ({
        id: lcd.id,
        label: lcd.label,
        type: "radio",
        checked: lcd.label.replaceAll(" ", "") === lcdState,
        click: async () => {
          const newLcd = lcd.label.replaceAll(" ", "");
          if (config.lcd !== newLcd) {
            setLcd(newLcd);
            await saveKliveProject();
          }
        }
      }))
    }
  ];

  // --- Sets the LCD dimentsions
  function setLcd(lcdId?: string): void {
    const emulatorState = mainStore.getState()?.emulatorState;
    const machineId = emulatorState?.machineId;
    const modelId = emulatorState?.modelId;
    const config = getModelConfig(machineId, modelId);
    config[MC_SCREEN_SIZE] = lcdId;
    setMachineType(machineId, modelId, config);
    mainStore.dispatch(incMenuVersionAction());
  }
};

/**
 * Renders reset-related menus
 */
export const z88ResetRenderer: MachineMenuRenderer = () => {
  const execState = mainStore.getState()?.emulatorState?.machineState;
  return [
    { type: "separator" },
    {
      id: "z88_reset",
      label: "Soft reset",
      accelerator: "F8",
      click: async () => {
        await sendFromMainToEmu(createMachineCommand("reset"));
      }
    },
    {
      id: "z88_hard_reset",
      label: "Hard reset",
      accelerator: "F9",
      click: async () => {
        await sendFromMainToEmu(createMachineCommand("restart"));
      }
    },
    { type: "separator" },
    {
      id: "z88_press_both_shifts",
      label: "Press both SHIFT keys",
      accelerator: "F6",
      enabled: execState === MachineControllerState.Running,
      click: async () => {
        await sendFromMainToEmu(createMachineCommand("custom", "press_shifts"));
      }
    },
    {
      id: "z88_battery_low",
      label: "Raise battery low signal",
      enabled: execState === MachineControllerState.Running,
      click: async () => {
        await sendFromMainToEmu(createMachineCommand("custom", "battery_low"));
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
