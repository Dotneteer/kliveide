import path from "path";
import fs from "fs";

import type { MachineMenuItem, MachineMenuRenderer } from "@common/machines/info-types";

import { app, BrowserWindow, dialog } from "electron";
import { mainStore } from "@main/main-store";
import { logEmuEvent, setMachineType } from "@main/registeredMachines";
import { appSettings, getSettingValue, saveAppSettings, setSettingValue } from "@main/settings-utils";
import { incMenuVersionAction, setMediaAction } from "@state/actions";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { JOYSTICK_BINDINGS_DIALOG } from "@common/messaging/dialog-ids";
import {
  SETTING_EMU_JOYSTICK_BINDINGS,
  SETTING_EMU_TC2048_ROM,
  SETTING_EMU_TC2068_ROM,
  SETTING_EMU_TS2068_ROM
} from "@common/settings/setting-const";
import {
  JOYSTICK_SIDE_LABELS,
  JOYSTICK_SIDES,
  JOYSTICK_SOURCES,
  normalizeJoystickBindings,
  type JoystickSide
} from "@common/settings/joystick-bindings";
import { getTimexModel, type TimexModelId } from "@emu/machines/timex/timexModels";
import { MEDIA_DOCK } from "@common/structs/project-const";
import { saveKliveProject } from "@main/projects";

/** The setting that names each model's ROM file */
const ROM_SETTING: Record<TimexModelId, string> = {
  tc2048: SETTING_EMU_TC2048_ROM,
  tc2068: SETTING_EMU_TC2068_ROM,
  ts2068: SETTING_EMU_TS2068_ROM
};

/** The settings key of the folder the last cartridge was taken from */
const DOCK_FILE_FOLDER = "dockFileFolder";

/**
 * The model's ROM (`.plans/TIMEX_SCORPION_PLAN.md` P5): Klive cannot ship Timex's ROMs, so the user
 * names their own copy in Settings › Machine; without one the machine boots the Sinclair 48K ROM.
 * Choosing or forgetting it restarts the machine. Both act on the running Timex model.
 */
export function timexRomSettingId(config: Record<string, any> | undefined): string {
  return ROM_SETTING[getTimexModel(config).id];
}

/** Asks for the running Timex model's ROM and restarts the machine with it */
export async function selectTimexRom(emuWindow: BrowserWindow): Promise<void> {
  const model = getTimexModel(mainStore.getState()?.emulatorState?.config);
  await selectTimexRomFile(emuWindow, model.id, model.romSize);
}

/** Forgets the running Timex model's ROM; the 48K ROM boots */
export async function forgetTimexRom(): Promise<void> {
  const model = getTimexModel(mainStore.getState()?.emulatorState?.config);
  setSettingValue(ROM_SETTING[model.id], "");
  await restartForTimexRom(`${model.id.toUpperCase()} ROM cleared: the 48K ROM boots`);
}

/**
 * The joysticks, driven by the host's joystick bindings (the same table the Next's joysticks use):
 * the TC2048's built-in Kempston port (joystick 1), or the 2068s' two sticks read through the AY.
 * The machines have one mode each, so there is no mode menu.
 */
export const timexJoystickMenuRenderer: MachineMenuRenderer = (_, __, modelInfo) => {
  const model = getTimexModel(modelInfo?.config);
  const bindings = normalizeJoystickBindings(getSettingValue(SETTING_EMU_JOYSTICK_BINDINGS));
  const sides: JoystickSide[] = model.is2068 ? JOYSTICK_SIDES : ["left"];
  const sourceMenu = (side: JoystickSide): MachineMenuItem => ({
    id: `timex_joy_${side}_source`,
    label: model.is2068 ? `${JOYSTICK_SIDE_LABELS[side]}: driven by` : "Driven by",
    submenu: JOYSTICK_SOURCES.map((option) => ({
      id: `timex_joy_${side}_source_${option.value}`,
      label: option.label,
      type: "radio",
      checked: bindings[side].source === option.value,
      click: async () => {
        setSettingValue(SETTING_EMU_JOYSTICK_BINDINGS, {
          ...bindings,
          [side]: { ...bindings[side], source: option.value }
        });
        await logEmuEvent(`${JOYSTICK_SIDE_LABELS[side]}: ${option.label.toLowerCase()}`);
      }
    }))
  });
  return [
    {
      id: "timex_joystick",
      label: model.is2068 ? "Joysticks" : "Kempston Joystick",
      submenu: [
        ...sides.map(sourceMenu),
        { type: "separator" },
        {
          id: "timex_joy_bindings",
          label: "Configure bindings...",
          click: async () => {
            await getEmuApi().displayDialog(JOYSTICK_BINDINGS_DIALOG);
          }
        }
      ]
    },
    { type: "separator" }
  ];
};

/**
 * The 2068s' cartridge: a `.dck` file in the DOCK. The ROM looks for a cartridge when it starts, so
 * inserting or ejecting one hard-resets the machine.
 */
export const timexDockMenuRenderer: MachineMenuRenderer = (windowInfo, _, modelInfo) => {
  if (!getTimexModel(modelInfo?.config).is2068) return [];
  const dockFile = mainStore.getState()?.media?.[MEDIA_DOCK] as string | undefined;
  return [
    {
      id: "timex_dock_insert",
      label: dockFile ? `Change Cartridge (${path.basename(dockFile)})...` : "Insert Cartridge...",
      click: async () => {
        await selectDockFile(windowInfo.emuWindow);
        await saveKliveProject();
      }
    },
    {
      id: "timex_dock_eject",
      label: "Eject Cartridge",
      enabled: !!dockFile,
      click: async () => {
        await ejectDock();
        await saveKliveProject();
      }
    },
    { type: "separator" }
  ];
};

/** Asks for a `.dck` file and inserts it */
export async function selectDockFile(emuWindow: BrowserWindow): Promise<void> {
  const current = mainStore.getState()?.media?.[MEDIA_DOCK] as string | undefined;
  const dialogResult = await dialog.showOpenDialog(emuWindow, {
    title: "Insert a Timex Cartridge",
    defaultPath: appSettings?.folders?.[DOCK_FILE_FOLDER] || (current ? path.dirname(current) : app.getPath("home")),
    filters: [
      { name: "Timex Cartridges", extensions: ["dck"] },
      { name: "All Files", extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;
  await setDockFile(dialogResult.filePaths[0]);
}

/** Inserts a `.dck` file into the DOCK; the machine restarts to find it */
export async function setDockFile(filename: string, showErrors = true): Promise<string | undefined> {
  appSettings.folders ??= {};
  appSettings.folders[DOCK_FILE_FOLDER] = path.dirname(filename);
  try {
    const contents = fs.readFileSync(filename);
    const problem = await getEmuApi().setDockFile(filename, new Uint8Array(contents));
    if (problem) throw new Error(problem);
    mainStore.dispatch(setMediaAction(MEDIA_DOCK, filename));
    await logEmuEvent(`Cartridge ${filename} inserted`);
    return undefined;
  } catch (err) {
    if (showErrors) {
      dialog.showErrorBox("Cannot insert the cartridge", `${filename}: ${(err as Error).message}`);
    }
    return (err as Error).message;
  }
}

/** Removes the cartridge; the machine restarts without it */
export async function ejectDock(): Promise<void> {
  mainStore.dispatch(setMediaAction(MEDIA_DOCK, ""));
  await getEmuApi().ejectDock();
  await logEmuEvent("Cartridge ejected");
}

async function selectTimexRomFile(emuWindow: BrowserWindow, model: TimexModelId, size: number): Promise<void> {
  const name = model.toUpperCase();
  const current = getSettingValue(ROM_SETTING[model]) as string | undefined;
  const dialogResult = await dialog.showOpenDialog(emuWindow, {
    title: `Select the ${name} ROM (${size / 1024}K)`,
    defaultPath: current ? path.dirname(current) : app.getPath("home"),
    filters: [
      { name: "ROM Files", extensions: ["rom", "bin"] },
      { name: "All Files", extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;
  const filename = dialogResult.filePaths[0];
  const actual = fs.statSync(filename).size;
  if (actual !== size) {
    dialog.showErrorBox(
      `Not a ${name} ROM`,
      `The ${name} ROM is ${size} bytes${size === 0x6000 ? " (the 16K HOME ROM followed by the 8K EXROM)" : ""}; ${filename} has ${actual}.`
    );
    return;
  }
  setSettingValue(ROM_SETTING[model], filename);
  await restartForTimexRom(`${name} ROM set to ${filename}`);
}

/** Rebuilds the machine, which reads the ROM setting when it starts */
async function restartForTimexRom(message: string): Promise<void> {
  const emulatorState = mainStore.getState()?.emulatorState;
  await setMachineType(emulatorState?.machineId, emulatorState?.modelId, emulatorState?.config ?? {});
  mainStore.dispatch(incMenuVersionAction());
  saveAppSettings();
  await logEmuEvent(message);
}
