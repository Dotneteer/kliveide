/*
 * The main-process actions the Settings dialog and the in-window controls run
 * (`.plans/MENU_REDESIGN_PLAN.md` §4–§5). Every action calls the code its old menu item called, so
 * moving a command out of the menu changes where it is, not what it does. The renderers reach these
 * through `MainApi.runUiAction`; the ids are listed in `@common/settings/ui-action-ids`.
 */
import fs from "fs";
import path from "path";
import { app, BrowserWindow, dialog } from "electron";

import type { UiActionId } from "@common/settings/ui-action-ids";
import type { SettingsPageId } from "@common/settings/settings-pages";
import type { SettingsDialogData } from "@common/settings/settings-dialog";
import { ACCENT_MENU_ITEMS } from "@common/theming/accents";
import { setAccentAction, setKeyMappingsAction, setThemeAction } from "@state/actions";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import type {
  MachineSelectDialogData,
  MachineSelectDialogResult
} from "@common/messaging/machine-select-dialog";
import { normalizeMachineFavorites } from "@common/machines/machine-favorites";
import { machineRegistry } from "@common/machines/machine-registry";
import { MF_ALLOW_SCAN_LINES } from "@common/machines/constants";
import { SETTING_EMU_MACHINE_FAVORITES, SETTING_EMU_SCANLINE_EFFECT } from "@common/settings/setting-const";
import { setMachineType } from "./registeredMachines";
import {
  EXCLUDED_PROJECT_ITEMS_DIALOG,
  MACHINE_SELECT_DIALOG,
  JOYSTICK_BINDINGS_DIALOG,
  SETTINGS_DIALOG,
  SJASMPLUS_INTEGRATION_DIALOG
} from "@messaging/dialog-ids";
import { mainStore } from "./main-store";
import { saveKliveProject } from "./projects";
import { appSettings, getSettingValue, saveAppSettings, setSettingValue } from "./settings-utils";
import { parseKeyMappings } from "./key-mappings/keymapping-parser";
import { setClockMultiplier, setSoundLevel } from "./emulator-preferences";
import {
  type WindowRecordingPreference,
  windowRecordingPreferenceAction
} from "./recording/window-recording/windowRecordingMenu";
import { setZ88Lcd } from "./machine-menus/z88-menus";
import {
  forgetTrdosRom,
  resetSp48RomFile,
  selectSp48RomFile,
  selectTrdosRomFile
} from "./machine-menus/zx-specrum-menus";
import { forgetTimexRom, selectTimexRom } from "./machine-menus/timex-menus";
import { forgetScorpionRom, selectScorpionRomFile } from "./machine-menus/scorpion-menus";
import { toggleWindowRecording } from "./recording/window-recording/windowRecordingController";
import { focusEmuWindow, getAppWindows, isIdeWindowFocused, isIdeWindowVisible, showIdeWindow } from ".";

const KEY_MAPPING_FOLDER = "keyMappingFolder";

/** The window a dialog started from Settings or a control belongs to */
function ownerWindow(): BrowserWindow | undefined {
  const { emuWindow } = getAppWindows();
  return BrowserWindow.getFocusedWindow() ?? emuWindow ?? undefined;
}

/**
 * Shows a dialog in the focused window: the IDE's when the IDE has the focus, the emulator's
 * otherwise (dialogs both registries render, such as Select Machine and Settings).
 */
export async function displayDialogInFocusedWindow(dialogId: number, data?: unknown): Promise<unknown> {
  const ideFocused = !!mainStore.getState()?.ideFocused || isIdeWindowFocused();
  return ideFocused
    ? await getIdeApi().displayDialog(dialogId, data)
    : await getEmuApi().displayDialog(dialogId, data);
}

/** Opens the Settings dialog in the focused window */
export async function openSettingsDialog(page?: SettingsPageId): Promise<void> {
  const data: SettingsDialogData = { page };
  await displayDialogInFocusedWindow(SETTINGS_DIALOG, data);
}

/**
 * Opens the Select Machine dialog in the focused window and applies its result
 */
export async function openMachineSelector(): Promise<void> {
  const appState = mainStore.getState();
  const machineFavorites = normalizeMachineFavorites(
    getSettingValue(SETTING_EMU_MACHINE_FAVORITES),
    machineRegistry
  );
  const data: MachineSelectDialogData = {
    favorites: machineFavorites,
    current: appState?.emulatorState?.machineId
      ? { machineId: appState.emulatorState.machineId, modelId: appState.emulatorState.modelId }
      : undefined
  };
  const result = (await displayDialogInFocusedWindow(MACHINE_SELECT_DIALOG, data)) as
    | MachineSelectDialogResult
    | undefined;
  await applyMachineSelectResult(result);
}

/**
 * Switches the emulator to a machine type, as the Machine type menu and the Select Machine dialog
 * both do.
 */
export async function selectMachineType(machineId: string, modelId?: string): Promise<void> {
  await setMachineType(machineId, modelId);
  if (modelId !== undefined) {
    const newMachine = machineRegistry.find((m) => m.machineId === machineId);
    if (newMachine?.features?.[MF_ALLOW_SCAN_LINES] === false) {
      // --- Turn off scanline effect for machines that support it by default
      setSettingValue(SETTING_EMU_SCANLINE_EFFECT, "off");
    }
  }
  await saveKliveProject();
}

/**
 * Applies what the Select Machine dialog returned: the dialog itself has no side effects.
 * @param result The dialog result; undefined when cancelled
 */
async function applyMachineSelectResult(result: MachineSelectDialogResult | undefined): Promise<void> {
  if (!result) return;
  if (result.favorites) {
    setSettingValue(
      SETTING_EMU_MACHINE_FAVORITES,
      normalizeMachineFavorites(result.favorites, machineRegistry)
    );
  }
  if (result.switchTo) {
    await selectMachineType(result.switchTo.machineId, result.switchTo.modelId);
  }
}

/** Asks for a key mapping file and puts it in force */
export async function selectKeyMappingFile(browserWindow: BrowserWindow): Promise<void> {
  const lastFile = appSettings.keyMappingFile;
  const defaultPath =
    appSettings?.folders?.[KEY_MAPPING_FOLDER] ||
    (lastFile ? path.dirname(lastFile) : app.getPath("home"));
  const dialogResult = await dialog.showOpenDialog(browserWindow, {
    title: "Select Key Mapping File",
    defaultPath,
    filters: [
      { name: "Key Mapping Files", extensions: ["keymap"] },
      { name: "All Files", extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;

  const filename = dialogResult.filePaths[0];
  try {
    const mappingSource = fs.readFileSync(filename, "utf8");
    const mappings = parseKeyMappings(mappingSource);
    mainStore.dispatch(setKeyMappingsAction(filename, mappings));
    appSettings.folders ??= {};
    appSettings.folders[KEY_MAPPING_FOLDER] = path.dirname(filename);
    saveAppSettings();
    await saveKliveProject();
  } catch (err) {
    dialog.showErrorBox(
      "Error while reading key mapping file",
      `Reading file ${filename} resulted in error: ${(err as Error).message}`
    );
  }
}

/** The recording preferences the emulator renderer owns, and the commands that set them */
const RECORDING_COMMANDS: Record<string, Record<string, string>> = {
  "set:recordingFps": { native: "set-fps-native", half: "set-fps-half" },
  "set:recordingQuality": { lossless: "set-quality-lossless", high: "set-quality-high", good: "set-quality-good" },
  "set:recordingFormat": { mp4: "set-format-mp4", webm: "set-format-webm", mkv: "set-format-mkv" }
};

const WINDOW_RECORDING_PREFERENCES: Record<string, WindowRecordingPreference> = {
  "set:windowRecordingIdePosition": "idePosition",
  "set:windowRecordingPointer": "pointer",
  "set:windowRecordingClicks": "clicks",
  "set:windowRecordingHiDpi": "hiDpi"
};

/**
 * Runs one UI action.
 * @param actionId The action
 * @param value Its argument: the new value of a `set:` action, the page of `open-settings`
 * @returns An error message for an unknown action or value, undefined when done
 */
export async function runUiAction(actionId: UiActionId, value?: unknown): Promise<string | undefined> {
  const owner = ownerWindow();

  const recording = RECORDING_COMMANDS[actionId];
  if (recording) {
    const command = recording[String(value)];
    if (!command) return `Unknown value for ${actionId}: ${value}`;
    await getEmuApi().issueRecordingCommand(command as any);
    return undefined;
  }
  const windowPreference = WINDOW_RECORDING_PREFERENCES[actionId];
  if (windowPreference) {
    const action = windowRecordingPreferenceAction(windowPreference, value);
    if (!action) return `Unknown value for ${actionId}: ${value}`;
    mainStore.dispatch(action);
    saveAppSettings();
    return undefined;
  }

  switch (actionId) {
    case "open-settings":
      await openSettingsDialog(value as SettingsPageId | undefined);
      return undefined;
    case "toggle-ide-emu-recording": {
      // --- The same rules as Machine › Record: one recording at a time, and a visible IDE
      const emu = mainStore.getState()?.emulatorState;
      const recording = emu?.windowRecordingState === "recording";
      const screenIdle = !emu?.screenRecordingState || emu.screenRecordingState === "idle";
      if (!recording && !screenIdle) return "A video recording is running.";
      if (!recording && !isIdeWindowVisible()) return "The IDE must be visible to be recorded.";
      const { emuWindow, ideWindow } = getAppWindows();
      await toggleWindowRecording(emuWindow, ideWindow);
      return undefined;
    }
    case "open-machine-selector":
      await openMachineSelector();
      return undefined;
    case "set:clockMultiplier":
      await setClockMultiplier(Number(value));
      return undefined;
    case "set:soundLevel":
      await setSoundLevel(Number(value));
      return undefined;
    case "set:theme":
      if (value !== "light" && value !== "dark") return `Unknown theme: ${value}`;
      mainStore.dispatch(setThemeAction(value));
      await saveKliveProject();
      return undefined;
    case "set:accent": {
      const accent = ACCENT_MENU_ITEMS.find((a) => a.id === value);
      if (!accent) return `Unknown accent: ${value}`;
      mainStore.dispatch(setAccentAction(accent.id));
      await saveKliveProject();
      return undefined;
    }
    case "set:z88Lcd":
      await setZ88Lcd(String(value));
      return undefined;
    case "rom:sp48:select":
      await selectSp48RomFile(owner);
      return undefined;
    case "rom:sp48:reset":
      await resetSp48RomFile();
      return undefined;
    case "rom:trdos:select":
      await selectTrdosRomFile(owner);
      return undefined;
    case "rom:trdos:forget":
      await forgetTrdosRom();
      return undefined;
    case "rom:timex:select":
      await selectTimexRom(owner);
      return undefined;
    case "rom:timex:forget":
      await forgetTimexRom();
      return undefined;
    case "rom:scorpion:select":
      await selectScorpionRomFile(owner);
      return undefined;
    case "rom:scorpion:forget":
      await forgetScorpionRom();
      return undefined;
    case "keymap:select":
      await selectKeyMappingFile(owner);
      return undefined;
    case "keymap:reset":
      mainStore.dispatch(setKeyMappingsAction(undefined, undefined));
      await saveKliveProject();
      return undefined;
    case "dialog:joystick-bindings":
      // --- An emulator dialog: the bindings are tested against the emulator's own input
      focusEmuWindow();
      await getEmuApi().displayDialog(JOYSTICK_BINDINGS_DIALOG);
      return undefined;
    case "dialog:sjasmplus":
      showIdeWindow();
      await getIdeApi().displayDialog(SJASMPLUS_INTEGRATION_DIALOG);
      return undefined;
    case "dialog:excluded-items":
      showIdeWindow();
      await getIdeApi().displayDialog(EXCLUDED_PROJECT_ITEMS_DIALOG);
      return undefined;
    default:
      return `Unknown UI action: ${actionId}`;
  }
}
