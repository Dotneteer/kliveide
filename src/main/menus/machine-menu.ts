/*
 * The Machine menu (`.plans/MENU_REDESIGN_PLAN.md` §3): the machine type, running it, speed and
 * sound, one submenu per device the machine has, the machine's own hardware actions, and Record.
 * Debugging is the Debug menu; set-once options (ROMs, the Z88's keyboard and LCD, key mapping,
 * scanlines, recording formats) are in Settings.
 */
import type { MenuItemConstructorOptions } from "electron";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MACHINE_DEVICE_MENUS, MACHINE_DEVICE_MENU_LABELS } from "@common/machines/info-types";
import { MF_ALLOW_CLOCK_MULTIPLIER } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { normalizeMachineFavorites } from "@common/machines/machine-favorites";
import { SETTING_EMU_MACHINE_FAVORITES } from "@common/settings/setting-const";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { getSettingValue } from "@main/settings-utils";
import { createMachineTypesMenu } from "@main/machine-types-menu";
import { readRecordIdeEmuShortcut } from "@common/utils/recordingShortcuts";
import { toggleWindowRecording } from "@main/recording/window-recording/windowRecordingController";
import { createWindowRecordingMenuItems } from "@main/recording/window-recording/windowRecordingMenu";
import { setClockMultiplier, setSoundLevel } from "@main/emulator-preferences";
import { CLOCK_MULTIPLIERS, clockMultiplierLabel, SOUND_LEVELS } from "@common/machines/emulator-levels";
import { mainStore } from "@main/main-store";
import { type MenuContext, windowInfoOf } from "./menu-context";
import { hasVisibleItems, submenuContent, tidySeparators } from "./menu-utils";

/** Machine › Speed, or nothing for a machine with a fixed clock */
export function createSpeedMenu(context: MenuContext): MenuItemConstructorOptions[] {
  if (context.currentMachine?.features?.[MF_ALLOW_CLOCK_MULTIPLIER] === false) return [];
  const current = context.appState?.emulatorState?.clockMultiplier;
  return CLOCK_MULTIPLIERS.map((v) => ({
    id: `clock_mult_${v}`,
    label: clockMultiplierLabel(v),
    type: "checkbox" as const,
    checked: current === v,
    click: async () => await setClockMultiplier(v)
  }));
}

/** Machine › Sound */
export function createSoundMenu(context: MenuContext): MenuItemConstructorOptions[] {
  const current = context.appState?.emulatorState?.soundLevel;
  return SOUND_LEVELS.map((v) => ({
    id: `sound_level_${v.value}`,
    label: v.label,
    type: "checkbox" as const,
    checked: current === v.value,
    click: async () => await setSoundLevel(v.value)
  }));
}

/** The device submenus (Tape, Program, Disks, Cartridge, SD Card, Input), in their fixed order */
export function createDeviceMenus(context: MenuContext): MenuItemConstructorOptions[] {
  const devices = context.machineMenus?.devices ?? {};
  const windowInfo = windowInfoOf(context);
  const result: MenuItemConstructorOptions[] = [];
  for (const id of MACHINE_DEVICE_MENUS) {
    const content = submenuContent(
      devices[id]?.(windowInfo, context.currentMachine, context.currentModel) ?? []
    );
    if (id === "input") {
      // --- Every machine has a keyboard, so Input is always there, with its settings
      content.push(
        { type: "separator" },
        {
          id: "input_settings",
          label: "Input Settings...",
          click: async () => await context.openSettings("input")
        }
      );
    }
    if (hasVisibleItems(content)) {
      result.push({ id: `device_${id}`, label: MACHINE_DEVICE_MENU_LABELS[id], submenu: tidySeparators(content) });
    }
  }
  return result;
}

/** The machine's own hardware actions, in a submenu named after it */
export function createHardwareMenu(context: MenuContext): MenuItemConstructorOptions[] {
  const content = submenuContent(
    context.machineMenus?.hardwareItems?.(windowInfoOf(context), context.currentMachine, context.currentModel) ?? []
  );
  if (!hasVisibleItems(content)) return [];
  return [{ id: "machine_hardware", label: context.currentMachine?.displayName ?? "Hardware", submenu: content }];
}

/** Machine › Record: the video, IDE + Emulator and RZX recordings */
export function createRecordMenu(context: MenuContext): MenuItemConstructorOptions[] {
  const { appState, emuWindow, ideWindow } = context;
  const emulatorState = appState?.emulatorState;
  const videoAvailable = emulatorState?.screenRecordingAvailable !== false;
  const recState = emulatorState?.screenRecordingState;
  const screenIdle = !recState || recState === "idle";
  const windowRecording = emulatorState?.windowRecordingState === "recording";
  const machineItems = submenuContent(
    context.machineMenus?.recordItems?.(windowInfoOf(context), context.currentMachine, context.currentModel) ?? []
  );

  const items: MenuItemConstructorOptions[] = [];
  if (videoAvailable) {
    items.push(
      {
        id: "recording_start_stop",
        label: screenIdle ? "Start Video Recording" : "Stop Video Recording",
        enabled: !windowRecording,
        click: async () =>
          await getEmuApi().issueRecordingCommand(screenIdle ? "start-recording" : "disarm")
      },
      {
        id: "recording_pause_resume",
        label: recState === "paused" ? "Continue Video Recording" : "Pause Video Recording",
        enabled: recState === "recording" || recState === "paused",
        click: async () =>
          await getEmuApi().issueRecordingCommand(
            recState === "paused" ? "resume-recording" : "pause-recording"
          )
      },
      { type: "separator" },
      // --- IDE + Emulator recording (.plans/IDE_EMU_RECORDING_PLAN.md §5.2)
      ...createWindowRecordingMenuItems({
        state: appState,
        ideWindowVisible: context.ideWindowVisible,
        shortcut: readRecordIdeEmuShortcut(mainStore.getState()),
        toggleRecording: () => toggleWindowRecording(emuWindow, ideWindow)
      })
    );
  }
  if (machineItems.length) items.push({ type: "separator" }, ...machineItems);
  if (!items.length) return [];
  items.push(
    { type: "separator" },
    {
      id: "recording_settings",
      label: "Recording Settings...",
      click: async () => await context.openSettings("recording")
    }
  );
  return [{ id: "recording_menu", label: "Record", submenu: tidySeparators(items) }];
}

export function createMachineMenu(context: MenuContext): MenuItemConstructorOptions {
  const { appState } = context;
  const execState = appState?.emulatorState?.machineState;
  const machineWaits =
    execState === MachineControllerState.None ||
    execState === MachineControllerState.Paused ||
    execState === MachineControllerState.Stopped;
  const machineRuns = execState === MachineControllerState.Running;
  const machinePaused = execState === MachineControllerState.Paused;
  const machineRestartable = machineRuns || machinePaused;

  // --- Machine types submenu: the favourites, then "Select machine…"
  // --- (.plans/MACHINE_SELECT_DIALOG_PLAN.md §3)
  const machineFavorites = normalizeMachineFavorites(
    getSettingValue(SETTING_EMU_MACHINE_FAVORITES),
    machineRegistry
  );
  const machineTypesMenu = createMachineTypesMenu(
    machineRegistry,
    machineFavorites,
    appState?.emulatorState?.machineId,
    appState?.emulatorState?.modelId,
    context.selectMachineType,
    context.openMachineSelector
  );

  const speed = createSpeedMenu(context);
  const items: MenuItemConstructorOptions[] = [
    { id: "machine_types", label: "Machine Type", submenu: machineTypesMenu },
    { type: "separator" },
    {
      id: "start",
      label: "Start",
      enabled: machineWaits,
      accelerator: "F5",
      click: async () => {
        await getEmuApi().issueMachineCommand("start");
      }
    },
    {
      id: "pause",
      label: "Pause",
      enabled: machineRuns,
      accelerator: "Shift+F5",
      click: async () => {
        await getEmuApi().issueMachineCommand("pause");
      }
    },
    {
      id: "stop",
      label: "Stop",
      enabled: machineRestartable,
      accelerator: "F4",
      click: async () => {
        await getEmuApi().issueMachineCommand("stop");
      }
    },
    {
      id: "restart",
      label: "Restart",
      enabled: machineRestartable,
      accelerator: "Shift+F4",
      click: async () => {
        if (appState.ideFocused && appState.project?.isKliveProject) {
          // --- Await the first command: these are independent IPC round trips, so firing both at
          // --- once lets the build output pane switch race the build it is meant to display.
          await getIdeApi().executeCommand("outp build");
          await getIdeApi().executeCommand(appState.emulatorState?.isDebugging ? "debug" : "run");
        } else {
          await getEmuApi().issueMachineCommand("restart");
        }
      }
    },
    { type: "separator" },
    ...(speed.length ? [{ id: "clock_mult", label: "Speed", submenu: speed }] : []),
    { id: "sound_level", label: "Sound", submenu: createSoundMenu(context) },
    { type: "separator" },
    ...createDeviceMenus(context),
    ...createHardwareMenu(context),
    { type: "separator" },
    ...createRecordMenu(context)
  ];
  return { label: "Machine", submenu: tidySeparators(items) };
}
