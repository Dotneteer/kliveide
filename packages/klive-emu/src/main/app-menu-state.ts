// ============================================================================
// This module provides functions to set up the application menu and change
// it dinamically as the state of the app changes.
// ============================================================================

import {
  app,
  BrowserWindow,
  Menu,
  MenuItem,
  MenuItemConstructorOptions,
  shell,
} from "electron";
import {
  emuMuteSoundAction,
  emuSetClockMultiplierAction,
  emuSetSoundLevelAction,
  emuUnmuteSoundAction,
} from "../shared/state/emulator-panel-reducer";
import { KliveAction } from "../shared/state/state-core";
import { AppState } from "../shared/state/AppState";
import {
  emuHideFrameInfoAction,
  emuHideKeyboardAction,
  emuHideStatusbarAction,
  emuHideToolbarAction,
  emuShowFrameInfoAction,
  emuShowKeyboardAction,
  emuShowStatusbarAction,
  emuShowToolbarAction,
} from "../shared/state/emu-view-options-reducer";
import { __DARWIN__ } from "./electron-utils";
import {
  mainStore,
  registerEmuWindowForwarder,
  registerIdeWindowForwarder,
} from "./mainStore";
import { MainToEmulatorMessenger } from "./MainToEmulatorMessenger";
import { EmuWindow } from "./EmuWindow";
import { IdeWindow } from "./IdeWindow";
import { StateAwareObject } from "../shared/state/StateAwareObject";
import { appConfiguration, appSettings } from "./klive-configuration";
import { ideHideAction, ideShowAction } from "../shared/state/show-ide-reducer";
import { MainToIdeMessenger } from "./MainToIdeMessenger";
import {
  ideToolFrameMaximizeAction,
  ideToolFrameShowAction,
} from "../shared/state/tool-frame-reducer";
import { MainToEmuForwarder } from "./MainToEmuForwarder";

// --- Global reference to the mainwindow
export let emuWindow: EmuWindow;
export let ideWindow: IdeWindow;
export let stateAware: StateAwareObject;

/**
 * Messenger instance to the emulator window
 */
export let emuMessenger: MainToEmulatorMessenger;

/**
 * Messenger instance to the emulator window
 */
export let emuForwarder: MainToEmuForwarder;

/**
 * Messenger instance to the IDE window
 */
export let ideMessenger: MainToIdeMessenger;

/**
 * Last known machine type
 */
let lastMachineType = "";

/**
 * Last known sound level
 */
let lastSoundLevel: number | null = null;

/**
 * Was the sound muted?
 */
let lastMuted: boolean | null = null;

export async function setupWindows(): Promise<void> {
  // --- Prepare the mulator window
  emuWindow = new EmuWindow();
  emuWindow.load();
  registerEmuWindowForwarder(emuWindow.window);
  await emuWindow.ensureStarted();

  // --- Prepare the IDE window
  ideWindow = new IdeWindow();
  ideWindow.hide();
  ideWindow.load();
  registerIdeWindowForwarder(ideWindow.window);

  // --- Prepare the state change observer
  stateAware = new StateAwareObject(mainStore);
}

/**
 * Sets the messenger to the emulator window
 * @param messenger
 */
export function setEmuMessenger(messenger: MainToEmulatorMessenger): void {
  emuMessenger = messenger;
}

/**
 * Sets the forwarder to the emulator window
 * @param forwarder
 */
 export function setEmuForwarder(forwarder: MainToEmuForwarder): void {
  emuForwarder = forwarder;
}

/**
 * Sets the messenger to the IDE window
 * @param messenger
 */
export function setIdeMessenger(messenger: MainToIdeMessenger): void {
  ideMessenger = messenger;
}

// --- Menu IDs
const TOGGLE_KEYBOARD = "toggle_keyboard";
const TOGGLE_TOOLBAR = "toggle_toolbar";
const TOGGLE_STATUSBAR = "toggle_statusbar";
const TOGGLE_FRAMES = "toggle_frames";
const TOGGLE_DEVTOOLS = "toggle_devtools";
const START_VM = "start_vm";
const PAUSE_VM = "pause_vm";
const STOP_VM = "stop_vm";
const RESTART_VM = "restart_vm";
const DEBUG_VM = "debug_vm";
const STEP_INTO_VM = "step_into_vm";
const STEP_OVER_VM = "step_over_vm";
const STEP_OUT_VM = "step_out_vm";
const SHOW_IDE = "show_ide";
const SHOW_IDE_TOOLS = "show_ide_tools";

/**
 * Sets up the application menu
 */
export function setupMenu(): void {
  // --- Merge startup configuration and settings
  const viewOptions = appSettings?.viewOptions ?? {
    showToolbar: true,
    showStatusbar: true,
    showFrameInfo: true,
  };

  const template: (MenuItemConstructorOptions | MenuItem)[] = [];
  if (__DARWIN__) {
    template.push({
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  // --- Prepare the File menu
  const fileMenu: MenuItemConstructorOptions = {
    label: "File",
    submenu: [__DARWIN__ ? { role: "close" } : { role: "quit" }],
  };

  // --- Preapre the view menu
  const viewSubMenu: MenuItemConstructorOptions[] = [
    { role: "resetZoom" },
    { role: "zoomIn" },
    { role: "zoomOut" },
    { type: "separator" },
    { role: "togglefullscreen" },
    {
      id: TOGGLE_DEVTOOLS,
      label: "Toggle Developer Tools",
      accelerator: "Ctrl+Shift+I",
      visible: appConfiguration?.showDevTools ?? false,
      enabled: appConfiguration?.showDevTools ?? false,
      click: () => {
        BrowserWindow.getFocusedWindow().webContents.toggleDevTools();
      },
    },
    { type: "separator" },
    {
      id: TOGGLE_KEYBOARD,
      label: "Show keyboard",
      type: "checkbox",
      checked: false,
      click: (mi) =>
        checkboxAction(mi, emuShowKeyboardAction(), emuHideKeyboardAction()),
    },
    { type: "separator" },
  ];

  let extraViewItems: MenuItemConstructorOptions[] =
    emuWindow.machineContextProvider?.provideViewMenuItems() ?? [];
  if (extraViewItems.length > 0) {
    extraViewItems.push({ type: "separator" });
  }
  viewSubMenu.push(...extraViewItems);

  viewSubMenu.push(
    {
      id: TOGGLE_TOOLBAR,
      label: "Show toolbar",
      type: "checkbox",
      checked: viewOptions.showToolbar ?? true,
      click: (mi) =>
        checkboxAction(mi, emuShowToolbarAction(), emuHideToolbarAction()),
    },
    {
      id: TOGGLE_STATUSBAR,
      label: "Show statusbar",
      type: "checkbox",
      checked: viewOptions.showStatusbar ?? true,
      click: (mi) =>
        checkboxAction(mi, emuShowStatusbarAction(), emuHideStatusbarAction()),
    },
    {
      id: TOGGLE_FRAMES,
      label: "Show frame information",
      type: "checkbox",
      checked: viewOptions.showFrameInfo ?? true,
      click: (mi) => {
        if (mi.checked) {
          mainStore.dispatch(emuShowFrameInfoAction());
        } else {
          mainStore.dispatch(emuHideFrameInfoAction());
        }
      },
    }
  );

  // --- Add the file and view menu
  template.push(fileMenu, {
    label: "View",
    submenu: viewSubMenu,
  });

  // --- Prepare the Run menu
  const runMenu: MenuItemConstructorOptions = {
    label: "Run",
    submenu: [
      {
        id: START_VM,
        label: "Start",
        accelerator: "F5",
        enabled: true,
        click: async () => {
          await emuMessenger.sendMessage({ type: "StartVm" });
        },
      },
      {
        id: PAUSE_VM,
        label: "Pause",
        accelerator: "Shift+F5",
        enabled: false,
        click: async () => await emuMessenger.sendMessage({ type: "PauseVm" }),
      },
      {
        id: STOP_VM,
        label: "Stop",
        accelerator: "F4",
        enabled: false,
        click: async () => await emuMessenger.sendMessage({ type: "StopVm" }),
      },
      {
        id: RESTART_VM,
        label: "Restart",
        accelerator: "Shift+F4",
        enabled: false,
        click: async () =>
          await emuMessenger.sendMessage({ type: "RestartVm" }),
      },
      { type: "separator" },
      {
        id: DEBUG_VM,
        label: "Start with debugging",
        accelerator: "Ctrl+F5",
        enabled: true,
        click: async () => await emuMessenger.sendMessage({ type: "DebugVm" }),
      },
      {
        id: STEP_INTO_VM,
        label: "Step into",
        accelerator: "F3",
        enabled: false,
        click: async () =>
          await emuMessenger.sendMessage({ type: "StepIntoVm" }),
      },
      {
        id: STEP_OVER_VM,
        label: "Step over",
        accelerator: "Shift+F3",
        enabled: false,
        click: async () =>
          await emuMessenger.sendMessage({ type: "StepOverVm" }),
      },
      {
        id: STEP_OUT_VM,
        label: "Step out",
        accelerator: "Ctrl+F3",
        enabled: false,
        click: async () =>
          await emuMessenger.sendMessage({ type: "StepOutVm" }),
      },
    ],
  };
  template.push(runMenu);

  // --- Prepare the machine menu
  const machineSubMenu: MenuItemConstructorOptions[] = [];
  const machineType = mainStore.getState()?.machineType?.split("_")[0];
  for (let i = 0; i < MACHINE_MENU_ITEMS.length; i++) {
    machineSubMenu.push({
      id: menuIdFromMachineId(MACHINE_MENU_ITEMS[i].id),
      label: MACHINE_MENU_ITEMS[i].label,
      type: "radio",
      checked: MACHINE_MENU_ITEMS[i].id === machineType,
      enabled: MACHINE_MENU_ITEMS[i].enabled,
      click: async (mi) => {
        try {
          emuWindow.saveAppSettings();
        } catch {
          // --- Intentionally ignored
        }
        const machineType = mi.id.split("_")[1];
        emuWindow.requestMachineType(machineType);
      },
    });
  }

  // --- Create menu items for sound
  const soundMenuItems: MenuItemConstructorOptions[] = SOUND_MENU_ITEMS.map(
    (item, index) => ({
      id: item.id,
      label: item.label,
      type: "radio",
      checked: index === 3,
      click: () => setSoundLevel(item.level),
    })
  );

  machineSubMenu.push({ type: "separator" }, ...soundMenuItems);

  if (emuWindow?.machineContextProvider) {
    // --- Add clock multiplier submenu
    const cpuClockSubmenu: MenuItemConstructorOptions = {
      type: "submenu",
      label: "CPU clock multiplier",
      submenu: [],
    };
    const baseClockFrequency =
      emuWindow.machineContextProvider?.getNormalCpuFrequency() ?? 1_000_000;

    for (let i = 1; i <= 24; i++) {
      (cpuClockSubmenu.submenu as MenuItemConstructorOptions[]).push({
        id: `clockMultiplier_${i}`,
        type: "radio",
        label:
          (i > 1 ? `${i}x` : `Normal`) +
          ` (${((i * baseClockFrequency) / 1_000_000).toFixed(4)}MHz)`,
        click: () => {
          mainStore.dispatch(emuSetClockMultiplierAction(i));
        },
      });
    }
    machineSubMenu.push({ type: "separator" });
    machineSubMenu.push(cpuClockSubmenu);

    // --- Add machine-specific submenus
    let extraMachineItems: MenuItemConstructorOptions[] =
      emuWindow.machineContextProvider?.provideMachineMenuItems() ?? [];
    if (extraMachineItems.length > 0) {
      machineSubMenu.push({ type: "separator" });
      machineSubMenu.push(...extraMachineItems);
    }
  }

  template.push({
    label: "Machine",
    submenu: machineSubMenu,
  });

  if (__DARWIN__) {
    template.push({
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "front" },
        { type: "separator" },
        { role: "window" },
      ],
    });
  }

  const ideMenu: MenuItemConstructorOptions = {
    label: "IDE",
    submenu: [
      {
        id: SHOW_IDE,
        label: "Show IDE window",
        type: "checkbox",
        checked: false,
        enabled: true,
        click: async (mi) => {
          checkboxAction(mi, ideShowAction(), ideHideAction());
          if (mi.checked) {
            ideMessenger.sendMessage({
              type: "SyncMainState",
              mainState: { ...mainStore.getState() },
            });
          }
        },
      },
      { type: "separator" },
      {
        id: SHOW_IDE_TOOLS,
        label: "Show Tools",
        type: "checkbox",
        checked: mainStore.getState()?.toolFrame?.visible ?? false,
        enabled: true,
        click: async (mi) => {
          const toolsMaximized = !!mainStore.getState().toolFrame?.maximized;
          const toolsVisible = !!mainStore.getState()?.toolFrame?.visible;
          if (toolsMaximized) {
            mainStore.dispatch(ideToolFrameMaximizeAction(false));
            await new Promise((r) => setTimeout(r, 20));
          }
          mainStore.dispatch(ideToolFrameShowAction(!toolsVisible));
          if (toolsMaximized) {
            await new Promise((r) => setTimeout(r, 20));
            mainStore.dispatch(ideToolFrameMaximizeAction(true));
          }
        },
      },
    ],
  };

  template.push(ideMenu);

  const helpSubmenu: MenuItemConstructorOptions[] = [
    {
      label: "Klive on Github",
      click: async () => {
        await shell.openExternal("https://github.com/Dotneteer/kliveide");
      },
    },
    {
      label: "Getting started with Klive",
      click: async () => {
        await shell.openExternal(
          "https://dotneteer.github.io/kliveide/getting-started/install-kliveide.html"
        );
      },
    },
  ];

  // --- Add machine-specific help menu items
  if (emuWindow?.machineContextProvider) {
    let extraHelpItems: MenuItemConstructorOptions[] =
      emuWindow.machineContextProvider?.provideHelpMenuItems() ?? [];
    if (extraHelpItems.length > 0) {
      helpSubmenu.push({ type: "separator" });
      helpSubmenu.push(...extraHelpItems);
    }
  }

  template.push({
    role: "help",
    submenu: helpSubmenu,
  });
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Sets up state change cathing
 */
export function watchStateChanges(): void {
  stateAware.stateChanged.on((state) => {
    processStateChange(state);
  });
}

let lastShowIde = false;

/**
 * Processes emulator data changes
 * @param state Emulator state
 */
export function processStateChange(fullState: AppState): void {
  const menu = Menu.getApplicationMenu();
  const viewOptions = fullState.emuViewOptions;
  const emuState = fullState.emulatorPanel;

  // --- Visibility of the IDE window
  if (lastShowIde !== fullState.showIde) {
    lastShowIde = fullState.showIde;
    if (fullState.showIde) {
      ideWindow.show();
    } else {
      ideWindow.hide();
    }
  }

  if (menu) {
    // --- IDE window visibility
    const showIDE = menu.getMenuItemById(SHOW_IDE);
    if (showIDE) {
      showIDE.checked = fullState.showIde;
    }

    // --- Tools panel visibility
    const showTools = menu.getMenuItemById(SHOW_IDE_TOOLS);
    if (showTools) {
      showTools.checked = fullState.toolFrame?.visible ?? false;
    }

    // --- Keyboard panel status
    const toggleKeyboard = menu.getMenuItemById(TOGGLE_KEYBOARD);
    if (toggleKeyboard) {
      toggleKeyboard.checked = !!viewOptions.showKeyboard;
    }

    // --- Clock multiplier status
    if (emuState) {
      const clockMultiplier = emuState.clockMultiplier ?? 1;
      const cmItem = menu.getMenuItemById(`clockMultiplier_${clockMultiplier}`);
      if (cmItem) {
        cmItem.checked = false;
      }
    }

    // --- VM control commands
    const executionState = emuState.executionState;
    const startVm = menu.getMenuItemById(START_VM);
    if (startVm) {
      startVm.enabled =
        executionState === 0 || executionState === 3 || executionState === 5;
    }
    const pauseVm = menu.getMenuItemById(PAUSE_VM);
    if (pauseVm) {
      pauseVm.enabled = executionState === 1;
    }
    const stopVm = menu.getMenuItemById(STOP_VM);
    if (stopVm) {
      stopVm.enabled = executionState === 1 || executionState === 3;
    }
    const restartVm = menu.getMenuItemById(RESTART_VM);
    if (restartVm) {
      restartVm.enabled = executionState === 1 || executionState === 3;
    }
    const debugVm = menu.getMenuItemById(DEBUG_VM);
    if (debugVm) {
      debugVm.enabled =
        executionState === 0 || executionState === 3 || executionState === 5;
    }
    const stepIntoVm = menu.getMenuItemById(STEP_INTO_VM);
    if (stepIntoVm) {
      stepIntoVm.enabled = executionState === 3;
    }
    const stepOverVm = menu.getMenuItemById(STEP_OVER_VM);
    if (stepOverVm) {
      stepOverVm.enabled = executionState === 3;
    }
    const stepOutVm = menu.getMenuItemById(STEP_OUT_VM);
    if (stepOutVm) {
      stepOutVm.enabled = executionState === 3;
    }
  }

  // --- Take care that custom machine menus are updated
  emuWindow.machineContextProvider?.updateMenuStatus(fullState);

  if (lastMachineType !== fullState.machineType) {
    // --- Current machine types has changed
    lastMachineType = fullState.machineType;
    setupMenu();
  }

  // --- Sound level has changed
  lastSoundLevel = emuState.soundLevel;
  lastMuted = emuState.muted;
  setSoundLevelMenu(lastMuted, lastSoundLevel);

  // // --- The engine has just saved a ZX Spectrum file
  // if (emuState?.savedData && emuState.savedData.length > 0) {
  //   const data = emuState.savedData;
  //   const ideConfig = mainProcessStore.getState().ideConfiguration;
  //   if (!ideConfig) {
  //     return;
  //   }

  //   // --- Create filename
  //   const tapeFilePath = path.join(
  //     ideConfig.projectFolder,
  //     ideConfig.saveFolder
  //   );
  //   const nameBytes = data.slice(2, 12);
  //   let name = "";
  //   for (let i = 0; i < 10; i++) {
  //     name += String.fromCharCode(nameBytes[i]);
  //   }
  //   const tapeFileName = path.join(tapeFilePath, `${name.trimRight()}.tzx`);

  //   // --- We use this writer to save file info into
  //   const writer = new BinaryWriter();
  //   new TzxHeader().writeTo(writer);

  //   // --- The first 19 bytes is the header
  //   new TzxStandardSpeedDataBlock(data.slice(0, 19)).writeTo(writer);

  //   // --- Other bytes are the data block
  //   new TzxStandardSpeedDataBlock(data.slice(19)).writeTo(writer);

  //   // --- Now, save the file
  //   fs.writeFileSync(tapeFileName, writer.buffer);

  //   // --- Sign that the file has been saved
  //   mainProcessStore.dispatch(
  //     emulatorSetSavedDataAction(new Uint8Array(0))()
  //   );
  // }
}

/**
 * Sets the specified sound level
 * @param level Sound level (between 0.0 and 1.0)
 */
export function setSoundLevel(level: number): void {
  if (level === 0) {
    mainStore.dispatch(emuMuteSoundAction());
  } else {
    mainStore.dispatch(emuUnmuteSoundAction());
    mainStore.dispatch(emuSetSoundLevelAction(level));
  }
}

/**
 * Sets the sound menu with the specified level
 * @param level Sound level
 */
export function setSoundLevelMenu(muted: boolean, level: number): void {
  for (const menuItem of SOUND_MENU_ITEMS) {
    const item = Menu.getApplicationMenu().getMenuItemById(menuItem.id);
    if (item) {
      item.checked = false;
    }
  }
  if (muted) {
    const soundItem = Menu.getApplicationMenu().getMenuItemById(
      SOUND_MENU_ITEMS[0].id
    );
    if (soundItem) {
      soundItem.checked = true;
    }
  } else {
    for (let i = 0; i < SOUND_MENU_ITEMS.length; i++) {
      if (level < SOUND_MENU_ITEMS[i].level + 0.02) {
        const soundItem = Menu.getApplicationMenu().getMenuItemById(
          SOUND_MENU_ITEMS[i].id
        );
        if (soundItem) {
          soundItem.checked = true;
        }
        break;
      }
    }
  }
}

// ============================================================================
// Helper types and methods

/**
 * Executes a checkbox action
 * @param menuItem Menu item
 * @param showAction Action on show
 * @param hideAction Action on hide
 */
function checkboxAction(
  menuItem: MenuItem,
  showAction: KliveAction,
  hideAction: KliveAction
): void {
  mainStore.dispatch(menuItem.checked ? showAction : hideAction);
}

/**
 * Creates a menu ID from a machine ID
 * @param machineId Machine ID
 */
function menuIdFromMachineId(machineId: string): string {
  return `machine_${machineId}`;
}
/**
 * Represents a machine menu item
 */
interface MachineMenuItem {
  id: string;
  label: string;
  enabled: boolean;
}

/**
 * The list of machine menu items
 */
const MACHINE_MENU_ITEMS: MachineMenuItem[] = [
  { id: "sp48", label: "ZX Spectrum 48", enabled: true },
  { id: "sp128", label: "ZX Spectrum 128", enabled: true },
  { id: "spp3e", label: "ZX Spectrum +3E (to be done)", enabled: false },
  {
    id: "next",
    label: "ZX Spectrum Next (to be done)",
    enabled: false,
  },
  { id: "cz88", label: "Cambridge Z88 (in progress)", enabled: true },
];

/**
 * Represents a sound level menu item
 */
interface SoundMenuItem {
  id: string;
  label: string;
  level: number;
}

/**
 * The list of sound menu items
 */
const SOUND_MENU_ITEMS: SoundMenuItem[] = [
  { id: "mute_sound", label: "Mute sound", level: 0.0 },
  { id: "sound_level_low", label: "Sound: low", level: 0.13 },
  { id: "sound_level_medium", label: "Sound: Medium", level: 0.25 },
  { id: "sound_level_high", label: "Sound: High", level: 0.5 },
  { id: "sound_level_highest", label: "Sound: Highest", level: 1.0 },
];
