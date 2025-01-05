import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  MenuItem,
  MenuItemConstructorOptions,
  shell
} from "electron";
import fs from "fs";
import path from "path";
import os from "os";

import type { IdeExecuteCommandResponse } from "@messaging/any-to-ide";

import { __DARWIN__ } from "./electron-utils";
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
  showIdeToolbarAction,
  showIdeStatusBarAction,
  closeFolderAction,
  displayDialogAction,
  setIdeFontSizeAction,
  dimMenuAction,
  setVolatileDocStateAction,
  setRestartTarget,
  showKeyboardAction,
  setKeyMappingsAction
} from "@state/actions";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { appSettings, saveAppSettings } from "./settings";
import { openFolder, saveKliveProject } from "./projects";
import {
  NEW_PROJECT_DIALOG,
  EXCLUDED_PROJECT_ITEMS_DIALOG,
  FIRST_STARTUP_DIALOG_EMU,
  FIRST_STARTUP_DIALOG_IDE
} from "@messaging/dialog-ids";
import { MEMORY_PANEL_ID, DISASSEMBLY_PANEL_ID } from "@state/common-ids";
import { logEmuEvent, setMachineType } from "./registeredMachines";
import { createSettingsReader } from "@common/utils/SettingsReader";
import { parseKeyMappings } from "./key-mappings/keymapping-parser";
import { machineRegistry } from "@common/machines/machine-registry";
import { machineMenuRegistry } from "./machine-menus/machine-menu-registry";
import { fileChangeWatcher } from "./file-watcher";
import { collectedBuildTasks } from "./build";
import { MF_ALLOW_CLOCK_MULTIPLIER } from "@common/machines/constants";

export const KLIVE_GITHUB_PAGES = "https://dotneteer.github.io/kliveide";

const SYSTEM_MENU_ID = "system_menu";
const NEW_PROJECT = "new_project";
const OPEN_FOLDER = "open_folder";
const RECENT_PROJECTS = "recent_projects";
const CLOSE_FOLDER = "close_folder";
const TOGGLE_KEYBOARD = "toggle_keyboard";
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
const EXCLUDED_PROJECT_ITEMS = "manage_excluded_items";

const SHOW_IDE_WINDOW = "show_ide_window";

const MACHINE_TYPES = "machine_types";
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
const SELECT_KEY_MAPPING = "select_key_mapping";
const RESET_KEY_MAPPING = "reset_key_mapping";

const IDE_MENU = "ide_menu";
const IDE_SHOW_MEMORY = "show_memory";
const IDE_SHOW_DISASSEMBLY = "show_banked_disassembly";

const EDITOR_FONT_SIZE = "editor_font_size";

const HELP_MENU = "help_menu";
const HELP_ABOUT = "help_about";
const HELP_HOME_PAGE = "help_home_page";
const HELP_SHOW_WELCOME = "help_welcome";
const KEY_MAPPING_FOLDER = "keyMappingFolder";

/**
 * Creates and sets the main menu of the app
 */
export function setupMenu(emuWindow: BrowserWindow, ideWindow: BrowserWindow): void {
  // --- We'll put the entire menu here
  const template: (MenuItemConstructorOptions | MenuItem)[] = [];

  // --- Extract values from the current state. We'll use it to assemble the menu according to the
  // --- current state
  const appState = mainStore.getState();
  const tools = appState.ideView?.tools ?? [];
  const execState = appState?.emulatorState?.machineState;
  const machineWaits =
    execState === MachineControllerState.None ||
    execState === MachineControllerState.Paused ||
    execState === MachineControllerState.Stopped;
  const machineRuns = execState === MachineControllerState.Running;
  const machinePaused = execState === MachineControllerState.Paused;
  const machineRestartable = machineRuns || machinePaused;
  const folderOpen = appState?.project?.folderPath;
  const kliveProject = appState?.project?.isKliveProject;
  const hasBuildFile = !!appState?.project?.hasBuildFile;
  const volatileDocs = appState?.ideView?.volatileDocs ?? {};
  const machineId = appState?.emulatorState?.machineId;
  const modelId = appState?.emulatorState?.modelId;
  const currentMachine = machineRegistry.find((m) => m.machineId === machineId);
  const currentModel = currentMachine?.models?.find((m) => m.modelId === modelId);
  const machineMenus = machineMenuRegistry[machineId];
  const ideFocus = appState?.ideFocused;

  const settingsReader = createSettingsReader(mainStore);
  const allowDevTools = settingsReader.readSetting("devTools.allow");

  const getWindowTraits = (w?: BrowserWindow) => {
    return {
      isFocused: (w?.isDestroyed() ?? false) === false && w.isFocused?.(),
      isVisible: (w?.isDestroyed() ?? false) === false && w.isVisible?.()
    };
  };

  const emuTraits = getWindowTraits(emuWindow);
  const ideTraits = getWindowTraits(ideWindow);

  // ==========================================================================
  // Application system menu on MacOS
  if (__DARWIN__) {
    template.push({
      label: app.name,
      id: SYSTEM_MENU_ID,
      submenu: [
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" }
      ]
    });
  }

  // ==========================================================================
  // File menu
  const recentProjectNames = appSettings.recentProjects ?? [];

  const recentProjects: MenuItemConstructorOptions[] = recentProjectNames.map((rp) => {
    return {
      label: rp,
      click: async () => {
        await executeIdeCommand(ideWindow, `open "${rp}"`, undefined, true);
      }
    };
  });

  let recentProjectHolder: MenuItemConstructorOptions[] = [];

  if (recentProjects.length > 0) {
    recentProjectHolder.push(
      { type: "separator" },
      {
        id: RECENT_PROJECTS,
        label: "Recent Folders",
        submenu: recentProjects
      }
    );
  }

  template.push({
    label: "File",
    submenu: filterVisibleItems([
      {
        id: NEW_PROJECT,
        label: "New project...",
        click: () => {
          ensureIdeWindow();
          mainStore.dispatch(displayDialogAction(NEW_PROJECT_DIALOG));
        }
      },
      {
        id: OPEN_FOLDER,
        label: "Open folder...",
        click: async () => {
          ensureIdeWindow();
          await openFolder(ideWindow);
        }
      },
      ...recentProjectHolder,
      { type: "separator" },
      {
        id: CLOSE_FOLDER,
        label: "Close Folder",
        enabled: !!folderOpen,
        click: async () => {
          ensureIdeWindow();
          await getIdeApi().saveAllBeforeQuit();
          mainStore.dispatch(closeFolderAction());
          fileChangeWatcher.stopWatching();
          await saveKliveProject();
        }
      },
      ...(!kliveProject
        ? []
        : ([
            { type: "separator" },
            {
              id: EXCLUDED_PROJECT_ITEMS,
              label: "\nManage Excluded Items",
              enabled: true,
              click: () => {
                mainStore.dispatch(displayDialogAction(EXCLUDED_PROJECT_ITEMS_DIALOG));
              }
            }
          ] as MenuItemConstructorOptions[])),
      ...(__DARWIN__
        ? []
        : ([{ type: "separator" }, { role: "quit" }] as MenuItemConstructorOptions[]))
    ])
  });

  // ==========================================================================
  // Edit menu on MacOS
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

  // ==========================================================================
  // View menu

  // --- Use the menu to put together tool-related menus
  const toolMenus: MenuItemConstructorOptions[] = tools.map((t) => {
    return {
      id: `${TOOL_PREFIX}${t.id}`,
      label: `Show ${t.name} Panel`,
      type: "checkbox",
      checked: t.visible,
      visible: ideTraits.isFocused,
      click: (mi) => {
        const panelId = mi.id.substring(TOOL_PREFIX.length);
        mainStore.dispatch(changeToolVisibilityAction(panelId, mi.checked));
      }
    };
  });

  // --- Prepare the view menu
  // --- Font size option
  const editorFontOptions = [
    {
      label: "Smallest",
      value: 12
    },
    {
      label: "Small",
      value: 14
    },
    {
      label: "Medium",
      value: 16
    },
    {
      label: "Large",
      value: 20
    },
    {
      label: "Largest",
      value: 24
    }
  ];
  const editorFontMenu: MenuItemConstructorOptions[] = editorFontOptions.map((f, idx) => {
    return {
      id: `${EDITOR_FONT_SIZE}_${idx}`,
      label: f.label,
      type: "checkbox",
      checked: appState.ideViewOptions?.editorFontSize === f.value,
      click: async () => {
        mainStore.dispatch(setIdeFontSizeAction(f.value));
        await saveKliveProject();
      }
    };
  });

  // --- Machine-specific view menu items
  let specificViewMenus: MenuItemConstructorOptions[] = [];
  if (machineMenus && machineMenus.viewItems) {
    specificViewMenus = machineMenus.viewItems(
      {
        emuWindow,
        ideWindow
      },
      currentMachine,
      currentModel
    );
  }

  // --- Assemble the view menu
  template.push({
    label: "View",
    submenu: filterVisibleItems([
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
      {
        id: TOGGLE_DEVTOOLS,
        label: "Toggle Developer Tools",
        visible: !!allowDevTools,
        accelerator: "Ctrl+Shift+I",
        click: () => {
          BrowserWindow.getFocusedWindow().webContents.toggleDevTools();
        }
      },
      { type: "separator" },
      {
        id: SHOW_IDE_WINDOW,
        label: "Show IDE",
        visible: !ideTraits.isVisible,
        click: () => {
          ensureIdeWindow();
        }
      },
      {
        type: "separator",
        visible: !ideTraits.isVisible
      },
      {
        id: TOGGLE_EMU_TOOLBAR,
        label: "Show the Toolbar",
        type: "checkbox",
        visible: emuTraits.isFocused,
        checked: appState.emuViewOptions.showToolbar,
        click: async (mi) => {
          mainStore.dispatch(showEmuToolbarAction(mi.checked));
          await saveKliveProject();
        }
      },
      {
        id: TOGGLE_IDE_TOOLBAR,
        label: "Show the Toolbar",
        type: "checkbox",
        visible: ideTraits.isFocused,
        checked: appState.ideViewOptions.showToolbar,
        click: async (mi) => {
          mainStore.dispatch(showIdeToolbarAction(mi.checked));
          await saveKliveProject();
        }
      },
      {
        id: TOGGLE_EMU_STATUS_BAR,
        label: "Show the Status Bar",
        type: "checkbox",
        visible: emuTraits.isFocused,
        checked: appState.emuViewOptions.showStatusBar,
        click: async (mi) => {
          mainStore.dispatch(showEmuStatusBarAction(mi.checked));
          await saveKliveProject();
        }
      },
      {
        id: TOGGLE_IDE_STATUS_BAR,
        label: "Show the Status Bar",
        type: "checkbox",
        visible: ideTraits.isFocused,
        checked: appState.ideViewOptions.showStatusBar,
        click: async (mi) => {
          mainStore.dispatch(showIdeStatusBarAction(mi.checked));
          await saveKliveProject();
        }
      },
      {
        id: TOGGLE_KEYBOARD,
        label: "Show the Virtual Keyboard",
        type: "checkbox",
        visible: emuTraits.isFocused,
        checked: appState.emuViewOptions.showKeyboard,
        click: async (mi) => {
          mainStore.dispatch(showKeyboardAction(mi.checked));
          await saveKliveProject();
        }
      },
      {
        type: "separator",
        visible: emuTraits.isFocused || ideTraits.isFocused
      },
      {
        id: TOGGLE_SIDE_BAR,
        label: "Show the Side Bar",
        type: "checkbox",
        checked: appState.ideViewOptions.showSidebar,
        visible: ideTraits.isFocused,
        click: async (mi) => {
          mainStore.dispatch(showSideBarAction(mi.checked));
          await saveKliveProject();
        }
      },
      {
        id: TOGGLE_PRIMARY_BAR_RIGHT,
        label: "Move Primary Side Bar Right",
        type: "checkbox",
        checked: appState.ideViewOptions.primaryBarOnRight,
        visible: ideTraits.isFocused,
        click: async (mi) => {
          mainStore.dispatch(primaryBarOnRightAction(mi.checked));
          await saveKliveProject();
        }
      },
      {
        id: TOGGLE_TOOL_PANELS,
        label: "Show Tool Panels",
        type: "checkbox",
        checked: appState.ideViewOptions.showToolPanels,
        visible: ideTraits.isFocused,
        click: async (mi) => {
          const checked = mi.checked;
          mainStore.dispatch(showToolPanelsAction(checked));
          if (checked) {
            mainStore.dispatch(maximizeToolsAction(false));
          }
          await saveKliveProject();
        }
      },
      {
        id: TOGGLE_TOOLS_TOP,
        label: "Move Tool Panels Top",
        type: "checkbox",
        checked: appState.ideViewOptions.toolPanelsOnTop,
        visible: ideTraits.isFocused,
        click: async (mi) => {
          mainStore.dispatch(toolPanelsOnTopAction(mi.checked));
          await saveKliveProject();
        }
      },
      {
        id: MAXIMIZE_TOOLS,
        label: "Maximize Tool Panels",
        type: "checkbox",
        checked: appState.ideViewOptions.maximizeTools,
        visible: ideTraits.isFocused,
        click: async (mi) => {
          const checked = mi.checked;
          if (checked) {
            mainStore.dispatch(showToolPanelsAction(true));
          }
          mainStore.dispatch(maximizeToolsAction(checked));
          await saveKliveProject();
        }
      },
      {
        type: "separator",
        visible: ideTraits.isFocused
      },
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
            click: async () => {
              mainStore.dispatch(setThemeAction("light"));
              await saveKliveProject();
            }
          },
          {
            id: DARK_THEME,
            label: "Dark",
            type: "checkbox",
            checked: appState.theme === "dark",
            click: async () => {
              mainStore.dispatch(setThemeAction("dark"));
              await saveKliveProject();
            }
          }
        ]
      },
      { type: "separator" },
      {
        id: EDITOR_FONT_SIZE,
        label: "Editor Font Size",
        submenu: editorFontMenu
      },
      { type: "separator" },
      ...specificViewMenus
    ])
  });

  // ==========================================================================
  // Machine menu

  // --- Prepare the clock multiplier submenu
  const multiplierValues = [1, 2, 4, 6, 8, 10, 12, 16, 20, 24];
  const multiplierMenu: MenuItemConstructorOptions[] =
    currentMachine?.features?.[MF_ALLOW_CLOCK_MULTIPLIER] !== false
      ? multiplierValues.map((v) => {
          return {
            id: `${CLOCK_MULT}_${v}`,
            label: v === 1 ? "Normal" : `${v}x`,
            type: "checkbox",
            checked: appState.emulatorState?.clockMultiplier === v,
            click: async () => {
              mainStore.dispatch(setClockMultiplierAction(v));
              await logEmuEvent(`Clock multiplier set to ${v}`);
              await saveKliveProject();
            }
          };
        })
      : [];

  // --- Prepare the sound level submenus
  const soundLevelValues = [
    { value: 0.0, label: "Mute" },
    { value: 0.2, label: "Low" },
    { value: 0.4, label: "Medium" },
    { value: 0.8, label: "High" },
    { value: 1.0, label: "Highest" }
  ];
  const soundLeveMenu: MenuItemConstructorOptions[] = soundLevelValues.map((v) => {
    return {
      id: `${SOUND_LEVEL}_${v.value}`,
      label: v.label,
      type: "checkbox",
      checked: appState.emulatorState?.soundLevel === v.value,
      click: async () => {
        mainStore.dispatch(setSoundLevelAction(v.value));
        await logEmuEvent(`Sound level set to ${v.label} (${v.value})`);
        await saveKliveProject();
      }
    };
  });

  // --- Machine types submenu (use the registered machines)
  const machineTypesMenu: MenuItemConstructorOptions[] = [];
  machineRegistry.forEach((mt) => {
    if (!mt.models) {
      machineTypesMenu.push({
        id: `machine_${mt.machineId}`,
        label: mt.displayName,
        type: "checkbox",
        checked: appState.emulatorState?.machineId === mt.machineId,
        click: async () => {
          await setMachineType(mt.machineId);
          await saveKliveProject();
        }
      });
    } else {
      mt.models.forEach((m) => {
        machineTypesMenu.push({
          id: `machine_${mt.machineId}_${m.modelId}`,
          label: m.displayName,
          type: "checkbox",
          checked:
            appState.emulatorState?.machineId === mt.machineId &&
            appState.emulatorState?.modelId === m.modelId,
          click: async () => {
            await setMachineType(mt.machineId, m.modelId);
            await saveKliveProject();
          }
        });
      });
    }
    machineTypesMenu.push({ type: "separator" });
  });

  // --- Machine-specific menus
  let specificMachineMenus: MenuItemConstructorOptions[] = [];
  if (machineMenus && machineMenus.machineItems) {
    specificMachineMenus = machineMenus.machineItems(
      {
        emuWindow,
        ideWindow
      },
      currentMachine,
      currentModel
    );
  }

  // --- All standard submenus under "Machine"
  const machineSubMenu: MenuItemConstructorOptions[] = [
    {
      id: MACHINE_TYPES,
      label: "Machine type",
      submenu: machineTypesMenu
    },
    { type: "separator" },
    {
      id: START_MACHINE,
      label: "Start",
      enabled: machineWaits,
      accelerator: "F5",
      click: async () => {
        mainStore.dispatch(setRestartTarget("machine"));
        await getEmuApi().issueMachineCommand("start");
      }
    },
    {
      id: PAUSE_MACHINE,
      label: "Pause",
      enabled: machineRuns,
      accelerator: "Shift+F5",
      click: async () => {
        await getEmuApi().issueMachineCommand("pause");
      }
    },
    {
      id: STOP_MACHINE,
      label: "Stop",
      enabled: machineRestartable,
      accelerator: "F4",
      click: async () => {
        await getEmuApi().issueMachineCommand("stop");
      }
    },
    {
      id: RESTART_MACHINE,
      label: "Restart",
      enabled: machineRestartable,
      accelerator: "Shift+F4",
      click: async () => {
        mainStore.dispatch(setRestartTarget("machine"));
        await getEmuApi().issueMachineCommand("restart");
      }
    },
    { type: "separator" },
    {
      id: DEBUG_MACHINE,
      label: "Start with Debugging",
      enabled: machineWaits,
      accelerator: "Ctrl+F5",
      click: async () => {
        mainStore.dispatch(setRestartTarget("machine"));
        await getEmuApi().issueMachineCommand("debug");
      }
    },
    {
      id: STEP_INTO,
      label: "Step Into",
      enabled: machinePaused,
      accelerator: "F10",
      click: async () => {
        await getEmuApi().issueMachineCommand("stepInto");
      }
    },
    {
      id: STEP_OVER,
      label: "Step Over",
      enabled: machinePaused,
      accelerator: "Shift+F11",
      click: async () => {
        await getEmuApi().issueMachineCommand("stepOver");
      }
    },
    {
      id: STEP_OUT,
      label: "Step Out",
      enabled: machinePaused,
      accelerator: "Ctrl+F11",
      click: async () => {
        await getEmuApi().issueMachineCommand("stepOut");
      }
    }
  ];
  if (multiplierMenu.length > 0) {
    machineSubMenu.push(
      { type: "separator" },
      {
        id: CLOCK_MULT,
        label: "Clock Multiplier",
        submenu: multiplierMenu
      }
    );
  }
  machineSubMenu.push(
    { type: "separator" },
    {
      id: SOUND_LEVEL,
      label: "Sound Level",
      submenu: soundLeveMenu
    },
    { type: "separator" },
    ...specificMachineMenus,
    { type: "separator" },
    {
      id: SELECT_KEY_MAPPING,
      label: "Select Key Mapping...",
      visible: !ideTraits.isFocused,
      click: async () => {
        await setKeyMappingFile(emuWindow);
        await saveKliveProject();
      }
    },
    {
      id: RESET_KEY_MAPPING,
      label: "Reset Key Mapping",
      visible: !ideTraits.isFocused,
      click: async () => {
        mainStore.dispatch(setKeyMappingsAction(undefined, undefined));
        await saveKliveProject();
      }
    }
  );

  // --- Prepare the machine menu
  template.push({
    label: "Machine",
    submenu: machineSubMenu
  });

  // ==========================================================================
  // Project Menu

  if (kliveProject) {
    if (hasBuildFile) {
      let buildTasks: MenuItemConstructorOptions[] = [];
      for (const task of collectedBuildTasks) {
        if (task.separatorBefore) {
          buildTasks.push({ type: "separator" });
        }
        buildTasks.push({
          id: `BF_${task.id}`,
          label: task.displayName,
          click: async () => {
            const commandResult = await executeIdeCommand(
              ideWindow,
              `run-build-function ${task.id}`,
              undefined,
              true
            );
            if (commandResult.success && commandResult.value) {
              await executeIdeCommand(
                ideWindow,
                `script-output ${commandResult.value}`,
                undefined,
                true
              );
            }
          }
        });
      }

      if (buildTasks.length > 0) {
        template.push({
          label: "Build",
          submenu: buildTasks
        });
      }
    }
  }

  // ==========================================================================
  // IDE Menu

  let specificIdeMenus: MenuItemConstructorOptions[] = [];
  if (machineMenus && machineMenus.ideItems) {
    specificIdeMenus = machineMenus.ideItems(
      {
        emuWindow,
        ideWindow
      },
      currentMachine,
      currentModel
    );
  }

  template.push({
    id: IDE_MENU,
    visible: ideTraits.isVisible,
    label: "IDE",
    submenu: [
      {
        id: IDE_SHOW_MEMORY,
        label: "Show Machine Memory",
        type: "checkbox",
        checked: volatileDocs[MEMORY_PANEL_ID],
        click: async () => {
          await getIdeApi().showMemory(!volatileDocs[MEMORY_PANEL_ID]);
          mainStore.dispatch(
            setVolatileDocStateAction(MEMORY_PANEL_ID, !volatileDocs[MEMORY_PANEL_ID])
          );
        }
      },
      {
        id: IDE_SHOW_DISASSEMBLY,
        label: "Show Z80 Disassembly",
        type: "checkbox",
        checked: volatileDocs[DISASSEMBLY_PANEL_ID],
        click: async () => {
          await getIdeApi().showDisassembly(!volatileDocs[DISASSEMBLY_PANEL_ID]);
          mainStore.dispatch(
            setVolatileDocStateAction(DISASSEMBLY_PANEL_ID, !volatileDocs[DISASSEMBLY_PANEL_ID])
          );
        }
      },
      { type: "separator" },
      ...specificIdeMenus
    ]
  });

  // ==========================================================================
  // Help menu

  let specificHelpMenus: MenuItemConstructorOptions[] = [];
  if (machineMenus && machineMenus.helpItems) {
    specificIdeMenus = machineMenus.helpItems(
      {
        emuWindow,
        ideWindow
      },
      currentMachine,
      currentModel
    );
  }

  const helpLinks: MenuItemConstructorOptions[] = (machineMenus?.helpLinks ?? []).map((hl) => {
    if (hl.label) {
      return {
        label: hl.label,
        click: () => shell.openExternal(hl.url)
      };
    } else {
      return { type: "separator" };
    }
  });

  template.push({
    id: HELP_MENU,
    label: "Help",
    submenu: [
      {
        id: HELP_ABOUT,
        label: "About",
        click: async () => {
          const result = await dialog.showMessageBox(ideFocus ? ideWindow : emuWindow, {
            message: "About Klive IDE",
            detail:
              `${KLIVE_GITHUB_PAGES}\n\nVersion: ${app.getVersion()}\n` +
              `Electron version: ${process.versions.electron}\n` +
              `OS version: ${os.version()}`,
            buttons: ["Close", "Visit website"]
          });
          if (result.response) {
            shell.openExternal(KLIVE_GITHUB_PAGES);
          }
        }
      },
      {
        id: HELP_HOME_PAGE,
        label: "Klive IDE Home Page",
        click: () => shell.openExternal(KLIVE_GITHUB_PAGES)
      },
      { type: "separator" },
      {
        id: HELP_SHOW_WELCOME,
        label: "Welcome screen",
        click: () => {
          if (ideTraits.isFocused) {
            mainStore.dispatch(displayDialogAction(FIRST_STARTUP_DIALOG_IDE));
          } else {
            mainStore.dispatch(displayDialogAction(FIRST_STARTUP_DIALOG_EMU));
          }
        }
      },
      { type: "separator" },
      ...specificHelpMenus,
      { type: "separator" },
      ...helpLinks
    ]
  });

  // --- If we show dialogs, the all menu item should be disabled
  if (appState?.dimMenu) {
    disableAllMenuItems(template);
  }

  // Preserve the submenus as a dedicated array.
  const submenus = template.map((i) => i.submenu);

  // --- Set the menu
  if (__DARWIN__) {
    const windowFocused = emuTraits.isFocused ? emuWindow : ideWindow;
    if (!windowFocused.isDestroyed()) {
      template.forEach(templateTransform(windowFocused));
      Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    }
  } else {
    if (emuWindow && !emuWindow.isDestroyed()) {
      template.forEach(templateTransform(emuWindow));
      emuWindow.setMenu(Menu.buildFromTemplate(template));
    }
    if (ideWindow && !ideWindow.isDestroyed()) {
      template.forEach(templateTransform(ideWindow));
      ideWindow.setMenu(Menu.buildFromTemplate(template));
    }
  }

  function ensureIdeWindow() {
    ideWindow.show();
    if (appSettings?.windowStates?.ideWindow?.isMaximized) {
      ideWindow.maximize();
    }
    appSettings.windowStates ??= {};
    appSettings.windowStates.showIdeOnStartup = true;
    saveAppSettings();
  }

  function templateTransform(wnd: BrowserWindow) {
    return wnd.isFocused()
      ? (
          i: { submenu: Electron.MenuItemConstructorOptions[] | Electron.Menu },
          idx: string | number
        ) => (i.submenu = submenus[idx])
      : (i: { submenu: null }) => (i.submenu = null);
  }
}

/**
 * Sets the key mapping file
 * @param browserWindow Host browser window
 * @returns The key mappings file is set in the app state
 */
async function setKeyMappingFile(browserWindow: BrowserWindow): Promise<void> {
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

  // --- Read the file
  const filename = dialogResult.filePaths[0];
  try {
    const mappingSource = fs.readFileSync(filename, "utf8");
    const mappings = parseKeyMappings(mappingSource);
    mainStore.dispatch(setKeyMappingsAction(filename, mappings));

    // --- Save the folder into settings
    appSettings.folders ??= {};
    appSettings.folders[KEY_MAPPING_FOLDER] = path.dirname(filename);
    saveAppSettings();
  } catch (err) {
    dialog.showErrorBox(
      "\nError while reading key mapping file",
      `Reading file ${filename} resulted in error: ${err.message}`
    );
  }
}

// --- Disable all menu items (except the system menu)
function disableAllMenuItems(
  items: (Electron.MenuItemConstructorOptions | Electron.MenuItem)[]
): void {
  visitMenu(items, (item) => {
    if (item.id === SYSTEM_MENU_ID) return false;
    item.enabled = false;
    return true;
  });
}

// --- Visitor for each menu item in the current application menu
function visitMenu(
  items: (Electron.MenuItemConstructorOptions | Electron.MenuItem)[],
  visitor: (item: Electron.MenuItemConstructorOptions | Electron.MenuItem) => boolean
): void {
  items.forEach((i) => visitMenuItem(i));

  function visitMenuItem(item: Electron.MenuItemConstructorOptions | Electron.MenuItem): boolean {
    const visitResult = visitor(item);
    if (visitResult) {
      if (item.submenu) {
        if (Array.isArray(item.submenu)) {
          item.submenu.forEach((i) => visitMenuItem(i));
        } else {
          item.submenu.items.forEach((i) => visitMenuItem(i));
        }
      }
    }
    return visitResult;
  }
}

export async function executeIdeCommand(
  window: BrowserWindow,
  commandText: string,
  title?: string,
  ignoreSuccess = false
): Promise<IdeExecuteCommandResponse> {
  const response = await getIdeApi().executeCommand(commandText);
  if (response.success) {
    if (!ignoreSuccess) {
      await showMessage(
        window,
        "info",
        title ?? "Command execution",
        response.finalMessage ?? "Command successfully executed."
      );
    }
  } else {
    await showMessage(window, "error", title, response.finalMessage ?? "Error executing command.");
  }
  return response;
}

async function showMessage(
  window: BrowserWindow,
  type: string,
  title: string,
  message: string
): Promise<void> {
  mainStore.dispatch(dimMenuAction(true));
  try {
    await dialog.showMessageBox(window, {
      type: (type ?? "none") as any,
      title,
      message
    });
  } finally {
    mainStore.dispatch(dimMenuAction(false));
  }
}

function filterVisibleItems<T extends MenuItemConstructorOptions | MenuItem>(items: T[]): T[] {
  return items.filter((i) => i.visible !== false);
}
