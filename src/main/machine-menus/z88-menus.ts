import * as path from "path";
import * as fs from "fs";
import { BrowserWindow, dialog } from "electron";
import { MachineControllerState } from "../../common/abstractions/MachineControllerState";
import {
  MachineMenuItem,
  MachineMenuRenderer
} from "../../common/machines/info-types";
import { sendFromMainToEmu } from "../../common/messaging/MainToEmuMessenger";
import { createMachineCommand } from "../../common/messaging/main-to-emu";
import {
  displayDialogAction,
  emuSetKeyboardLayoutAction,
  incMenuVersionAction,
  setMachineConfigAction,
  setMachineSpecificAction
} from "../../common/state/actions";
import { mainStore } from "../../main/main-store";
import { saveKliveProject } from "../../main/projects";
import { getModelConfig } from "../../common/machines/machine-registry";
import {
  MC_SCREEN_SIZE,
  MC_Z88_INTRAM,
  MC_Z88_INTROM
} from "../../common/machines/constants";
import { setMachineType } from "../../main/registeredMachines";
import { Z88_CARDS_DIALOG } from "../../common/messaging/dialog-ids";

const Z88_KEYBOARDS = "z88_keyboards";
const Z88_DE_KEYBOARD = "z88_de_layout";
const Z88_DK_KEYBOARD = "z88_dk_layout";
const Z88_FR_KEYBOARD = "z88_fr_layout";
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
      submenu: layouts.map(layout => ({
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
      submenu: lcds.map(lcd => ({
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
  function setLcd (lcdId?: string): void {
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
 * Renders RAM, ROM, and card-related menus
 */
export const z88RomAndCardRenderer: MachineMenuRenderer = windowInfo => {
  const emuWindow = windowInfo.emuWindow;
  const romsSubmenu: MachineMenuItem[] = [];
  const config = mainStore.getState()?.emulatorState?.config ?? {};
  const intRam = config?.[MC_Z88_INTRAM] ?? 0x01;
  const machineSpecific =
    mainStore.getState()?.emulatorState?.machineSpecific ?? {};
  recentRoms = machineSpecific.recentRoms ?? [];
  recentRomSelected = machineSpecific.recentRomSelected ?? false;
  usedRomFile = machineSpecific.usedRomFile;

  romsSubmenu.push({
    id: "z88_use_default_rom",
    label: "Use default ROM",
    type: "radio",
    checked: !recentRomSelected,
    click: async () => {
      if (recentRomSelected) {
        recentRomSelected = false;
        usedRomFile = null;
        setIntRom();
      }
    }
  });
  if (recentRoms.length > 0) {
    for (let i = 0; i < recentRoms.length; i++) {
      romsSubmenu.push({
        id: `z88_use_rom_${i}`,
        label: path.basename(recentRoms[i]),
        type: "radio",
        checked: i === 0 && recentRomSelected,
        click: async () => {
          const prevRom = recentRoms[0];
          await selectRecentRomItem(emuWindow, i);
          if (prevRom !== recentRoms[0]) {
            setIntRom(recentRoms[0]);
          }
        }
      });
    }
  }
  romsSubmenu.push(
    { type: "separator" },
    {
      id: "z88_select_rom_file",
      label: "Select ROM file...",
      click: async () => {
        const prevRom = recentRoms[0];
        await selectRomFileToUse(emuWindow);
        if (prevRom !== recentRoms[0]) {
          setIntRom(recentRoms[0]);
        }
      }
    }
  );

  return [
    { type: "separator" },
    {
      id: "z88_internal_ram",
      label: "Internal RAM size",
      submenu: [
        {
          id: "z88_ram_32k",
          label: "32K",
          type: "radio",
          checked: intRam === 0x01,
          click: async () => setIntRam(0x01)
        },
        {
          id: "z88_ram_128k",
          label: "128K",
          type: "radio",
          checked: intRam === 0x07,
          click: async () => setIntRam(0x07)
        },
        {
          id: "z88_ram_512k",
          label: "512K",
          type: "radio",
          checked: intRam === 0x1f,
          click: async () => setIntRam(0x1f)
        }
      ]
    },
    {
      id: "select_z88_rom",
      label: "Select ROM",
      submenu: romsSubmenu
    },
    {
      id: "z88_insert_card",
      label: "Insert or remove card",
      click: async () => {
        mainStore.dispatch(displayDialogAction(Z88_CARDS_DIALOG));
      }
    }
  ];

  // --- Sets the internal ROM
  function setIntRom (romId?: string): void {
    const emulatorState = mainStore.getState()?.emulatorState;
    const machineId = emulatorState?.machineId;
    const modelId = emulatorState?.modelId;
    const config = getModelConfig(machineId, modelId);
    config[MC_Z88_INTROM] = romId;
    saveRecentRomInfo();
    setMachineType(machineId, modelId, config);
  }

  // --- Sets the internal ROM
  function setIntRam (ramSize?: number): void {
    const emulatorState = mainStore.getState()?.emulatorState;
    const machineId = emulatorState?.machineId;
    const modelId = emulatorState?.modelId;
    const config = emulatorState?.config ?? {};
    if (config[MC_Z88_INTRAM] === ramSize) {
      return;
    }
    config[MC_Z88_INTRAM] = ramSize;
    mainStore.dispatch(setMachineConfigAction({ ...config }));

    setMachineType(machineId, modelId, config);
  }
};

/**
 * Checks if specified file is a vlid OZ Application Card
 * @param filename File to check
 * @returns File contents or error message
 */
export async function checkZ88SlotFile (
  filename: string
): Promise<string | Uint8Array> {
  try {
    const contents = Uint8Array.from(fs.readFileSync(filename));

    // --- Check contents length
    if (
      contents.length !== 0x10_0000 &&
      contents.length !== 0x08_0000 &&
      contents.length !== 0x04_0000 &&
      contents.length !== 0x02_0000 &&
      contents.length !== 0x00_8000
    ) {
      return `Invalid card file length: ${contents.length}. The card file length can be 32K, 128K, 256K, 512K, or 1M.`;
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

// --- The current ROM file (null, if default is used)
let usedRomFile: string | null = null;

// --- The list of recently used ROMs
let recentRoms: string[] = [];

// --- The size of the most recent ROM
let recentRomSize: number;

// ---Indicates that a recent ROM is selected. If false, we use the default ROM
let recentRomSelected = false;

/**
 * Selects one of the recent ROM items
 * @param idx Selected ROM index
 */
async function selectRecentRomItem (
  window: BrowserWindow,
  idx: number
): Promise<void> {
  if (idx < 0 || idx >= recentRoms.length) {
    return;
  }

  await selectRomFileToUse(window, recentRoms[idx]);
}

/**
 * Select the ROM file to use with Z88
 */
async function selectRomFileToUse (
  window: BrowserWindow,
  filename?: string
): Promise<void> {
  if (!filename) {
    filename = await selectRomFileFromDialog(window);
    if (!filename) {
      return;
    }
  }

  const contents = await checkCz88Rom(filename);
  if (typeof contents === "string") {
    await dialog.showMessageBox(window, {
      title: "ROM error",
      message: contents,
      type: "error"
    });
    return;
  }

  // --- Use the selected contents
  const recentFileIdx = recentRoms.indexOf(filename);
  if (recentFileIdx >= 0) {
    recentRoms.splice(recentFileIdx, 1);
  }
  usedRomFile = filename;
  recentRoms.unshift(filename);
  recentRoms.splice(4);
  recentRomSize = contents.length;

  // --- Now set the ROM name and refresh the menu
  recentRomSelected = true;
  saveRecentRomInfo();
  mainStore.dispatch(incMenuVersionAction());
}

/**
 * Select a ROM file to use with Z88
 */
async function selectRomFileFromDialog (
  window: BrowserWindow
): Promise<string | null> {
  const result = await dialog.showOpenDialog(window, {
    title: "Open ROM file",
    filters: [
      { name: "ROM files", extensions: ["rom"] },
      { name: "BIN files", extensions: ["bin"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  return result ? result.filePaths[0] : null;
}

/**
 * Checks if the specified file is a valid Z88 ROM
 * @param filename ROM file name
 * @returns The contents, if the ROM is valid; otherwise, the error message
 */
async function checkCz88Rom (filename: string): Promise<string | Uint8Array> {
  try {
    const contents = Uint8Array.from(fs.readFileSync(filename));

    // --- Check contents length
    if (
      contents.length !== 0x8_0000 &&
      contents.length !== 0x4_0000 &&
      contents.length !== 0x2_0000
    ) {
      return `Invalid ROM file length: ${contents.length}. The ROM file length can be 128K, 256K, or 512K.`;
    }

    // --- Check watermark
    if (!isOZRom(contents)) {
      return "The file does not contain the OZ ROM watermark.";
    }

    // --- Done: valid ROM
    return contents;
  } catch (err) {
    console.log(err);
    // --- This error is intentionally ignored
    return (
      `Error processing ROM file ${filename}. ` +
      "Please check if you have the appropriate access rights " +
      "to read the files contents and the file is a valid ROM file."
    );
  }
}

/**
 * Check if specified slot contains an OZ Operating system
 * @param contents Binary contents
 * @returns true if Application Card is available in slot; otherwise false
 */
function isOZRom (contents: Uint8Array): boolean {
  const topBankOffset = (contents.length & 0xe_c000) - 0x4000;
  return (
    contents[topBankOffset + 0x3ffb] === 0x81 &&
    contents[topBankOffset + 0x3ffe] === "O".charCodeAt(0) &&
    contents[topBankOffset + 0x3fff] === "Z".charCodeAt(0)
  );
}

/**
 * Saves the recent ROM information to the store
 */
function saveRecentRomInfo (): void {
  const machineSpecific = {
    ...(mainStore.getState()?.emulatorState?.machineSpecific ?? {}),
    recentRoms,
    recentRomSelected,
    usedRomFile,
    recentRomSize
  };
  mainStore.dispatch(setMachineSpecificAction(machineSpecific));
}