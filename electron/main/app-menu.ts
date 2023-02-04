import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  MenuItem,
  MenuItemConstructorOptions
} from "electron";
import * as fs from "fs";
import * as path from "path";
import { __DARWIN__ } from "../electron-utils";
import { mainStore } from "./main-store";
import {
  showEmuStatusBarAction,
  showEmuToolbarAction,
  primaryBarOnRightAction,
  showSideBarAction,
  showToolPanelsAction,
  toolPanelsOnTopAction,
  maximizeToolsAction,
  setThemeAction,
  changeToolVisibilityAction,
  setClockMultiplierAction,
  setSoundLevelAction,
  setTapeFileAction,
  showIdeToolbarAction,
  showIdeStatusBarAction
} from "../../common/state/actions";
import { setMachineType } from "./machines";
import { MachineControllerState } from "../../common/state/MachineControllerState";
import { sendFromMainToEmu } from "../../common/messaging/MainToEmuMessenger";
import { TapeDataBlock } from "@/emu/machines/tape/abstractions";
import { createMachineCommand } from "../../common/messaging/main-to-emu";
import { sendFromMainToIde } from "../../common/messaging/MainToIdeMessenger";
import { OutputColor } from "@/appIde/ToolArea/abstractions";
import { BASIC_PANEL_ID, DISASSEMBLY_PANEL_ID, MEMORY_PANEL_ID } from "../../common/state/common-ids";
import { AppSettings, saveAppSettings } from "./settings";

const TOGGLE_DEVTOOLS = "toggle_devtools";
const TOGGLE_SIDE_BAR = "toggle_side_bar";
const TOGGLE_PRIMARY_BAR_RIGHT = "primary_side_bar_right";
const TOGGLE_EMU_TOOLBAR = "toggle_emu_toolbar";
const TOGGLE_EMU_STATUS_BAR = "toggle_emu_status_bar";
const TOGGLE_IDE_TOOLBAR = "toggle_ide_toolbar";
const TOGGLE_IDE_STATUS_BAR = "toggle_ide_status_bar";
const TOGGLE_TOOL_PANELS = "toggle_tool_panels";
const TOGGLE_TOOLS_TOP = "tool_panels_top";
const MAXIMIZE_TOOLS = "tools_maximize";
const TOOL_PREFIX = "tool_panel_";
const THEMES = "themes";
const LIGHT_THEME = "light_theme";
const DARK_THEME = "dark_theme";

const SHOW_IDE_WINDOW = "show_ide_window";

const MACHINE_TYPES = "machine_types";
const MACHINE_SP48 = "machine_sp48";
const START_MACHINE = "start";
const PAUSE_MACHINE = "pause";
const STOP_MACHINE = "stop";
const RESTART_MACHINE = "restart";
const DEBUG_MACHINE = "debug";
const STEP_INTO = "step_into";
const STEP_OVER = "step_over";
const STEP_OUT = "step_out";
const CLOCK_MULT = "clock_mult";
const SOUND_LEVEL = "sound_level";
const SELECT_TAPE_FILE = "select_tape_file";

const IDE_MENU = "ide_menu";
const IDE_SHOW_MEMORY = "show_memory";
const IDE_SHOW_DISASSEMBLY = "show_disassembly";
const IDE_SHOW_BASIC = "show_basic";

// --- The number of events logged with the emulator
let loggedEmuOutputEvents = 0;

/**
 * Creates and sets the main menu of the app
 */
export function setupMenu (
  emuWindow: BrowserWindow,
  ideWindow: BrowserWindow,
  appSettings: AppSettings
): void {
  const template: (MenuItemConstructorOptions | MenuItem)[] = [];
  const appState = mainStore.getState();
  const tools = appState.ideView?.tools ?? [];
  const execState = appState?.emulatorState?.machineState;
  const openDocs = appState?.ideView?.openDocuments;

  /**
   * Application system menu on MacOS
   */
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
        { role: "quit" }
      ]
    });
  }

  /**
   * Edit menu on MacOS
   */
  if (__DARWIN__) {
    template.push({
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" }
      ]
    });
  }

  const toolMenus: MenuItemConstructorOptions[] = tools.map(t => {
    return {
      id: `${TOOL_PREFIX}${t.id}`,
      label: `Show ${t.name} Panel`,
      type: "checkbox",
      checked: t.visible,
      visible: appState.ideFocused,
      click: mi => {
        const panelId = mi.id.substring(TOOL_PREFIX.length);
        mainStore.dispatch(changeToolVisibilityAction(panelId, mi.checked));
      }
    };
  });

  // --- Prepare the view menu
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
      click: () => {
        BrowserWindow.getFocusedWindow().webContents.toggleDevTools();
      }
    },
    { type: "separator" },
    {
      id: SHOW_IDE_WINDOW,
      label: "Show IDE",
      visible: ideWindow.isDestroyed() || !ideWindow.isVisible(),
      click: () => {
        ideWindow.show();
        if (appSettings?.windowStates?.ideWindow?.isMaximized) {
          ideWindow.maximize();
        }
        appSettings.windowStates ??= {};
        appSettings.windowStates.showIdeOnStartup = true;
        saveAppSettings(appSettings);
      }
    },
    { type: "separator" },
    {
      id: TOGGLE_EMU_TOOLBAR,
      label: "Show the Toolbar",
      type: "checkbox",
      visible: appState.emuFocused,
      checked: appState.emuViewOptions.showToolbar,
      click: mi => {
        mainStore.dispatch(showEmuToolbarAction(mi.checked));
      }
    },
    {
      id: TOGGLE_IDE_TOOLBAR,
      label: "Show the Toolbar",
      type: "checkbox",
      visible: appState.ideFocused,
      checked: appState.ideViewOptions.showToolbar,
      click: mi => {
        mainStore.dispatch(showIdeToolbarAction(mi.checked));
      }
    },
    {
      id: TOGGLE_EMU_STATUS_BAR,
      label: "Show the Status Bar",
      type: "checkbox",
      visible: appState.emuFocused,
      checked: appState.emuViewOptions.showStatusBar,
      click: mi => {
        mainStore.dispatch(showEmuStatusBarAction(mi.checked));
      }
    },
    {
      id: TOGGLE_IDE_STATUS_BAR,
      label: "Show the Status Bar",
      type: "checkbox",
      visible: appState.ideFocused,
      checked: appState.ideViewOptions.showStatusBar,
      click: mi => {
        mainStore.dispatch(showIdeStatusBarAction(mi.checked));
      }
    },
    { type: "separator" },
    {
      id: TOGGLE_SIDE_BAR,
      label: "Show the Side Bar",
      type: "checkbox",
      checked: appState.ideViewOptions.showSidebar,
      visible: appState.ideFocused,
      click: mi => {
        mainStore.dispatch(showSideBarAction(mi.checked));
      }
    },
    {
      id: TOGGLE_PRIMARY_BAR_RIGHT,
      label: "Move Primary Side Bar Right",
      type: "checkbox",
      checked: appState.ideViewOptions.primaryBarOnRight,
      visible: appState.ideFocused,
      click: mi => {
        mainStore.dispatch(primaryBarOnRightAction(mi.checked));
      }
    },
    {
      id: TOGGLE_TOOL_PANELS,
      label: "Show Tool Panels",
      type: "checkbox",
      checked: appState.ideViewOptions.showToolPanels,
      visible: appState.ideFocused,
      click: mi => {
        const checked = mi.checked;
        mainStore.dispatch(showToolPanelsAction(checked));
        if (checked) {
          mainStore.dispatch(maximizeToolsAction(false));
        }
      }
    },
    {
      id: TOGGLE_TOOLS_TOP,
      label: "Move Tool Panels Top",
      type: "checkbox",
      checked: appState.ideViewOptions.toolPanelsOnTop,
      visible: appState.ideFocused,
      click: mi => {
        mainStore.dispatch(toolPanelsOnTopAction(mi.checked));
      }
    },
    {
      id: MAXIMIZE_TOOLS,
      label: "Maximize Tool Panels",
      type: "checkbox",
      checked: appState.ideViewOptions.maximizeTools,
      visible: appState.ideFocused,
      click: mi => {
        const checked = mi.checked;
        if (checked) {
          mainStore.dispatch(showToolPanelsAction(true));
        }
        mainStore.dispatch(maximizeToolsAction(checked));
      }
    },
    { type: "separator" },
    ...toolMenus,
    { type: "separator" },
    {
      id: THEMES,
      label: "Themes",
      submenu: [
        {
          id: LIGHT_THEME,
          label: "Light",
          type: "checkbox",
          checked: appState.theme === "light",
          click: () => {
            mainStore.dispatch(setThemeAction("light"));
          }
        },
        {
          id: DARK_THEME,
          label: "Dark",
          type: "checkbox",
          checked: appState.theme === "dark",
          click: () => {
            mainStore.dispatch(setThemeAction("dark"));
          }
        }
      ]
    },
  ];

  template.push({
    label: "View",
    submenu: viewSubMenu
  });

  // --- Prepare the machine menu
  const multiplierValues = [1, 2, 4, 6, 8, 10, 12, 16, 20, 24];
  const multiplierMenu: MenuItemConstructorOptions[] = multiplierValues.map(
    v => {
      return {
        id: `${CLOCK_MULT}_${v}`,
        label: v === 1 ? "Normal" : `${v}x`,
        type: "checkbox",
        checked: appState.emulatorState?.clockMultiplier === v,
        click: async () => {
          mainStore.dispatch(setClockMultiplierAction(v));
          logEmuEvent(`Clock multiplier set to ${v}`);
        }
      };
    }
  );

  const soundLevelValues = [
    { value: 0.0, label: "Mute" },
    { value: 0.2, label: "Low" },
    { value: 0.4, label: "Medium" },
    { value: 0.8, label: "High" },
    { value: 1.0, label: "Highest" }
  ];
  const soundLeveMenu: MenuItemConstructorOptions[] = soundLevelValues.map(
    v => {
      return {
        id: `${SOUND_LEVEL}_${v.value}`,
        label: v.label,
        type: "checkbox",
        checked: appState.emulatorState?.soundLevel === v.value,
        click: async () => {
          mainStore.dispatch(setSoundLevelAction(v.value));
          logEmuEvent(`Sound level set to ${v.label} (${v.value})`);
        }
      };
    }
  );

  // --- Calculate flags from the current machine's execution state
  const machineWaits =
    execState === MachineControllerState.None ||
    execState === MachineControllerState.Paused ||
    execState === MachineControllerState.Stopped;
  const machineRuns = execState === MachineControllerState.Running;
  const machinePaused = execState === MachineControllerState.Paused;
  const machineRestartable = machineRuns || machinePaused;

  template.push({
    label: "Machine",
    submenu: [
      {
        id: MACHINE_TYPES,
        label: "Machine type",
        submenu: [
          {
            id: MACHINE_SP48,
            label: "ZX Spectrum 48K",
            type: "checkbox",
            checked: appState.emulatorState?.machineId === "sp48",
            click: async () => {
              await setMachineType("sp48");
            }
          }
        ]
      },
      { type: "separator" },
      {
        id: START_MACHINE,
        label: "Start",
        enabled: machineWaits,
        click: async () => {
          await sendFromMainToEmu(createMachineCommand("start"));
        }
      },
      {
        id: PAUSE_MACHINE,
        label: "Pause",
        enabled: machineRuns,
        click: async () => {
          await sendFromMainToEmu(createMachineCommand("pause"));
        }
      },
      {
        id: STOP_MACHINE,
        label: "Stop",
        enabled: machineRestartable,
        click: async () => {
          await sendFromMainToEmu(createMachineCommand("stop"));
        }
      },
      {
        id: RESTART_MACHINE,
        label: "Restart",
        enabled: machineRestartable,
        click: async () => {
          await sendFromMainToEmu(createMachineCommand("restart"));
        }
      },
      { type: "separator" },
      {
        id: DEBUG_MACHINE,
        label: "Start with Debugging",
        enabled: machineWaits,
        click: async () => {
          await sendFromMainToEmu(createMachineCommand("debug"));
        }
      },
      {
        id: STEP_INTO,
        label: "Step Into",
        enabled: machinePaused,
        click: async () => {
          await sendFromMainToEmu(createMachineCommand("stepInto"));
        }
      },
      {
        id: STEP_OVER,
        label: "Step Over",
        enabled: machinePaused,
        click: async () => {
          await sendFromMainToEmu(createMachineCommand("stepOver"));
        }
      },
      {
        id: STEP_OUT,
        label: "Step Out",
        enabled: machinePaused,
        click: async () => {
          await sendFromMainToEmu(createMachineCommand("stepOut"));
        }
      },
      { type: "separator" },
      {
        id: CLOCK_MULT,
        label: "Clock Multiplier",
        submenu: multiplierMenu
      },
      { type: "separator" },
      {
        id: SOUND_LEVEL,
        label: "Sound Level",
        submenu: soundLeveMenu
      },
      { type: "separator" },
      {
        id: SELECT_TAPE_FILE,
        label: "Select Tape File...",
        click: async () => {
          await setTapeFile(emuWindow);
        }
      }
    ]
  });

  const memoryDisplayed = !!openDocs.find(d => d.id === MEMORY_PANEL_ID);
  const disassemblyDisplayed = !!openDocs.find(d => d.id === DISASSEMBLY_PANEL_ID);
  const basicDisplayed = !!openDocs.find(d => d.id === BASIC_PANEL_ID);
  template.push({
    id: IDE_MENU,
    visible: !ideWindow.isDestroyed() && ideWindow.isVisible(),
    label: "IDE",
    submenu: [
      {
        id: IDE_SHOW_MEMORY,
        label: "Show Machine Memory",
        type: "checkbox",
        checked: memoryDisplayed,
        click: async () => {
          await sendFromMainToIde({
            type: "IdeShowMemory",
            show: !memoryDisplayed
          });
        }
      },
      {
        id: IDE_SHOW_DISASSEMBLY,
        label: "Show Z80 Disassembly",
        type: "checkbox",
        checked: disassemblyDisplayed,
        click: async () => {
          await sendFromMainToIde({
            type: "IdeShowDisassembly",
            show: !disassemblyDisplayed
          });
        }
      },
      { type: "separator" },
      {
        id: IDE_SHOW_BASIC,
        label: "Show BASIC Listing",
        type: "checkbox",
        checked: basicDisplayed,
        click: async () => {
          await sendFromMainToIde({
            type: "IdeShowBasic",
            show: !basicDisplayed
          });
        }
      },
    ]
  });

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Sets the tape file to use with the machine
 * @param browserWindow Host browser window
 * @returns The data blocks read from the tape, if successful; otherwise, undefined.
 */
async function setTapeFile (
  browserWindow: BrowserWindow
): Promise<TapeDataBlock[] | undefined> {
  const lastFile = mainStore.getState()?.emulatorState?.tapeFile;
  const defaultPath = lastFile ? path.dirname(lastFile) : app.getPath("home");
  const dialogResult = await dialog.showOpenDialog(browserWindow, {
    title: "Select Tape File",
    defaultPath,
    filters: [
      { name: "Tape Files", extensions: ["tap", "tzx"] },
      { name: "All Files", extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;

  // --- Read the file
  const filename = dialogResult.filePaths[0];

  // --- Store the last selected tape file
  mainStore.dispatch(setTapeFileAction(filename));

  try {
    const contents = fs.readFileSync(filename);
    await sendFromMainToEmu({
      type: "EmuSetTapeFile",
      file: filename,
      contents
    });
    logEmuEvent(`Tape file set to ${filename}`);
  } catch (err) {
    dialog.showErrorBox(
      "Error while reading tape file",
      `Reading file ${filename} resulted in error: ${err.message}`
    );
  }
}

/**
 * Log emulator events
 * @param text Log text
 * @param color Text color to use
 */
async function logEmuEvent (text: string, color?: OutputColor): Promise<void> {
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
