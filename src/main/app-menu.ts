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

import { __DARWIN__, __WIN32__ } from "./electron-utils";
import { getMonospaceFontOptions } from "@common/settings/monospace-fonts";
import {
  EDITOR_FONT_SIZES,
  PANEL_FONT_SIZES,
  type FontSizeOption
} from "@common/settings/font-sizes";
import { ACCENT_MENU_ITEMS, DEFAULT_ACCENT } from "@common/theming/accents";
import { mainStore } from "./main-store";
import {
  setThemeAction,
  setAccentAction,
  setClockMultiplierAction,
  setSoundLevelAction,
  closeFolderAction,
  dimMenuAction,
  setVolatileDocStateAction,
  setKeyMappingsAction
} from "@state/actions";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { AppState } from "@state/AppState";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { openFolder, openFolderByPath, saveKliveProject } from "./projects";
import {
  ABOUT_DIALOG,
  NEW_PROJECT_DIALOG,
  EXCLUDED_PROJECT_ITEMS_DIALOG,
  FIRST_STARTUP_DIALOG_EMU,
  FIRST_STARTUP_DIALOG_IDE
} from "@messaging/dialog-ids";
import { createAboutDialogData } from "@messaging/about-dialog";
import { MEMORY_PANEL_ID, DISASSEMBLY_PANEL_ID } from "@state/common-ids";
import { logEmuEvent, setMachineType } from "./registeredMachines";
import { createSettingsReader } from "@common/utils/SettingsReader";
import { parseKeyMappings } from "./key-mappings/keymapping-parser";
import { machineRegistry } from "@common/machines/machine-registry";
import { machineMenuRegistry } from "./machine-menus/machine-menu-registry";
import { fileChangeWatcher } from "./file-watcher";
import { collectedBuildTasks } from "./build";
import { MF_ALLOW_CLOCK_MULTIPLIER, MF_ALLOW_SCAN_LINES } from "@common/machines/constants";
import { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import {
  appSettings,
  getSettingDefinition,
  getSettingValue,
  saveAppSettings,
  setSettingValue
} from "./settings-utils";
import { createIdeIntegrationsMenu } from "./ide-integrations-menu";
import {
  SETTING_EMU_SHOW_INSTANT_SCREEN,
  SETTING_EMU_SHOW_KEYBOARD,
  SETTING_EMU_SHOW_STATUS_BAR,
  SETTING_EMU_SHOW_TOOLBAR,
  SETTING_EMU_STAY_ON_TOP,
  SETTING_EMU_SCANLINE_EFFECT,
  SETTING_IDE_CLOSE_EMU,
  SETTING_EDITOR_FONT_SIZE,
  SETTING_EDITOR_FONT_FAMILY,
  SETTING_PANEL_FONT_FAMILY,
  SETTING_PANEL_FONT_SIZE,
  SETTING_IDE_MAXIMIZE_TOOLS,
  SETTING_IDE_OPEN_LAST_PROJECT,
  SETTING_IDE_SHOW_SIDEBAR,
  SETTING_IDE_SHOW_STATUS_BAR,
  SETTING_IDE_SHOW_TOOLBAR,
  SETTING_IDE_SHOW_TOOLS,
  SETTING_IDE_SIDEBAR_TO_RIGHT,
  SETTING_IDE_SYNC_BREAKPOINTS,
  SETTING_IDE_TOOLS_ON_TOP,
  SETTING_EDITOR_AUTOCOMPLETE,
  SETTING_EDITOR_INSERT_SPACES,
  SETTING_EDITOR_TABSIZE,
  SETTING_EDITOR_RENDER_WHITESPACE,
  SETTING_EDITOR_DETECT_INDENTATION,
  SETTING_EDITOR_SELECTION_HIGHLIGHT,
  SETTING_EDITOR_OCCURRENCES_HIGHLIGHT,
  SETTING_EDITOR_QUICK_SUGGESTION_DELAY,
  SETTING_EDITOR_ALLOW_BACKGROUND_COMPILE
} from "@common/settings/setting-const";
import { isEmuWindowFocused, isIdeWindowFocused, isIdeWindowVisible } from ".";

export const KLIVE_GITHUB_PAGES = "https://dotneteer.github.io/kliveide";

const SYSTEM_MENU_ID = "system_menu";
const NEW_PROJECT = "new_project";
const OPEN_FOLDER = "open_folder";
const RECENT_PROJECTS = "recent_projects";
const CLOSE_FOLDER = "close_folder";
const TOGGLE_DEVTOOLS = "toggle_devtools";
const THEMES = "themes";
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
const SCANLINE_EFFECT = "scanline_effect";
const SELECT_KEY_MAPPING = "select_key_mapping";
const RESET_KEY_MAPPING = "reset_key_mapping";
const RECORDING_MENU = "recording_menu";

const IDE_MENU = "ide_menu";
const IDE_SHOW_MEMORY = "show_memory";
const IDE_SHOW_DISASSEMBLY = "show_banked_disassembly";
const IDE_SETTINGS = "ide_settings";

const EDITOR_OPTIONS = "editor_options";
const EDITOR_FONT_SIZE = "editor_font_size";
const EDITOR_FONT_FAMILY = "editor_font_family";
const PANEL_OPTIONS = "panel_options";
const PANEL_FONT_FAMILY = "panel_font_family";
const PANEL_FONT_SIZE = "panel_font_size";
const EDITOR_TAB_SIZE = "editor_tab_size";
const EDITOR_QUICK_SUGGESTION_DELAY = "editor_quick_suggestion_delay";
const EDITOR_RENDER_WHITESPACE = "editor_render_whitespace";

const HELP_MENU = "help_menu";
const HELP_ABOUT = "help_about";
const HELP_HOME_PAGE = "help_home_page";
const HELP_SHOW_WELCOME = "help_welcome";
const KEY_MAPPING_FOLDER = "keyMappingFolder";

/**
 * Builds the theme menu items for a single tone: one checkbox per accent, so that a single click
 * selects the complete tone + accent pair. The item matching the pair currently in effect is
 * ticked.
 * @param tone The light or dark tone this block covers
 * @param appState Current application state, holding the active theme and accent
 */
function createThemeMenuItems(
  tone: "light" | "dark",
  appState: AppState
): MenuItemConstructorOptions[] {
  const toneLabel = tone === "light" ? "Light" : "Dark";
  const currentAccent = appState.accent ?? DEFAULT_ACCENT;
  return ACCENT_MENU_ITEMS.map(({ id, label }) => ({
    id: `theme_${tone}_${id}`,
    label: `${label} (${toneLabel})`,
    type: "checkbox" as const,
    checked: appState.theme === tone && currentAccent === id,
    click: async () => {
      mainStore.dispatch(setThemeAction(tone));
      mainStore.dispatch(setAccentAction(id));
      await saveKliveProject();
    }
  }));
}

/**
 * Builds a monospace font-family submenu from the shared font registry. Both View | Editor Options
 * | Font Family and View | Panel Font are built with this, so the two lists cannot drift apart -
 * add a font to `@common/settings/monospace-fonts` and it appears in both.
 *
 * Only the fonts available on this platform are offered. A value persisted on another platform
 * stays in the settings file but shows nothing checked here, and the consumer falls back to the
 * bundled default until the user picks again.
 * @param idPrefix Menu id prefix for the generated items
 * @param settingId The setting the items read and write
 */
function createFontFamilyMenu(idPrefix: string, settingId: string): MenuItemConstructorOptions[] {
  const currentFontId = getSettingValue(settingId);
  return getMonospaceFontOptions(__WIN32__).map((f, idx) => ({
    id: `${idPrefix}_${idx}`,
    label: f.label,
    type: "checkbox" as const,
    checked: currentFontId === f.id,
    click: async () => {
      setSettingValue(settingId, f.id);
    }
  }));
}

/**
 * Builds a font-size submenu from one of the shared ladders in `@common/settings/font-sizes`. The
 * editor's and the panels' menus are both built with this, so the two stay structurally identical
 * even though their ladders differ.
 * @param idPrefix Menu id prefix for the generated items
 * @param settingId The setting the items read and write
 * @param sizes The ladder to offer
 */
function createFontSizeMenu(
  idPrefix: string,
  settingId: string,
  sizes: FontSizeOption[]
): MenuItemConstructorOptions[] {
  const currentSize = getSettingValue(settingId);
  return sizes.map((f, idx) => ({
    id: `${idPrefix}_${idx}`,
    label: f.label,
    type: "checkbox" as const,
    checked: currentSize === f.value,
    click: async () => {
      setSettingValue(settingId, f.value);
    }
  }));
}

/**
 * Creates and sets the main menu of the app
 */
export function setupMenu(emuWindow: BrowserWindow, ideWindow: BrowserWindow): void {
  // --- We'll put the entire menu here
  const template: (MenuItemConstructorOptions | MenuItem)[] = [];

  // --- Extract values from the current state. We'll use it to assemble the menu according to the
  // --- current state
  const appState = mainStore.getState();
  const execState = appState?.emulatorState?.machineState;
  const machineWaits =
    execState === MachineControllerState.None ||
    execState === MachineControllerState.Paused ||
    execState === MachineControllerState.Stopped;
  const machineRuns = execState === MachineControllerState.Running;
  const machinePaused = execState === MachineControllerState.Paused;
  const machineRestartable = machineRuns || machinePaused;
  const recState = appState?.emulatorState?.screenRecordingState;
  const isRecordingIdle = !recState || recState === "idle";
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

  const settingsReader = createSettingsReader(mainStore.getState());
  const devToolsValue = settingsReader.readSetting("devTools.allow");
  const allowDevTools = devToolsValue === "1" || devToolsValue === "true";
  const fullScreenShortcut = settingsReader.readSetting("shortcuts.fullScreen") ?? "Ctrl+Shift+F9";
  const stepIntoShortcut =
    settingsReader.readSetting("shortcuts.stepInto") ?? (__DARWIN__ ? "F12" : "F11");
  const stepOverShortcut = settingsReader.readSetting("shortcuts.stepOver") ?? "F10";
  const stepOutShortcut =
    settingsReader.readSetting("shortcuts.stepOut") ?? (__DARWIN__ ? "Shift+F12" : "Shift+F11");

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
        ensureIdeWindow();
        await getIdeApi().saveAllBeforeQuit();
        mainStore.dispatch(closeFolderAction());
        await getEmuApi().eraseAllBreakpoints();
        fileChangeWatcher.stopWatching();
        await saveKliveProject();
        await openFolderByPath(rp);
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
        click: async () => {
          ensureIdeWindow();
          await getIdeApi().displayDialog(NEW_PROJECT_DIALOG);
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
          await getEmuApi().eraseAllBreakpoints();
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
              click: async () => {
                ensureIdeWindow();
                await getIdeApi().displayDialog(EXCLUDED_PROJECT_ITEMS_DIALOG);
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

  // --- Prepare the view menu
  // --- The editor and the monitoring panels each pick from the same font registry, so both menus
  // --- are built by the same helper from @common/settings/monospace-fonts.
  const editorFontFamilyMenu = createFontFamilyMenu(EDITOR_FONT_FAMILY, SETTING_EDITOR_FONT_FAMILY);
  const panelFontFamilyMenu = createFontFamilyMenu(PANEL_FONT_FAMILY, SETTING_PANEL_FONT_FAMILY);

  // --- Font size options. The two ladders differ - prose-sized code against dense tabular data -
  // --- but both live in @common/settings/font-sizes and are rendered by the same helper.
  const editorFontSizeMenu = createFontSizeMenu(
    EDITOR_FONT_SIZE,
    SETTING_EDITOR_FONT_SIZE,
    EDITOR_FONT_SIZES
  );
  const panelFontSizeMenu = createFontSizeMenu(
    PANEL_FONT_SIZE,
    SETTING_PANEL_FONT_SIZE,
    PANEL_FONT_SIZES
  );

  const tabSizeOptions = [
    {
      label: "2",
      value: 2
    },
    {
      label: "4",
      value: 4
    },
    {
      label: "8",
      value: 8
    },
    {
      label: "16",
      value: 16
    }
  ];
  const currentTabSize = getSettingValue(SETTING_EDITOR_TABSIZE);
  const editorTabSizeMenu: MenuItemConstructorOptions[] = tabSizeOptions.map((f, idx) => {
    return {
      id: `${EDITOR_TAB_SIZE}_${idx}`,
      label: f.label,
      type: "checkbox",
      checked: currentTabSize === f.value,
      click: async () => {
        setSettingValue(SETTING_EDITOR_TABSIZE, f.value);
      }
    };
  });

  const renderWhitespaceOptions = [
    {
      label: "Do not render whitespaces",
      value: "none"
    },
    {
      label: "Render whitespace at line boundaries",
      value: "boundary"
    },
    {
      label: "Only render whitespace inside selected text",
      value: "selection"
    },
    {
      label: "Render all whitespace characters",
      value: "all"
    }
  ];

  const currentRenderWhitespace = getSettingValue(SETTING_EDITOR_RENDER_WHITESPACE);
  const editorRenderWhitespaceMenu: MenuItemConstructorOptions[] = renderWhitespaceOptions.map(
    (f, idx) => {
      return {
        id: `${EDITOR_RENDER_WHITESPACE}_${idx}`,
        label: f.label,
        type: "checkbox",
        checked: currentRenderWhitespace === f.value,
        click: async () => {
          setSettingValue(SETTING_EDITOR_RENDER_WHITESPACE, f.value);
        }
      };
    }
  );

  const quickSuggestionDelayOptions = [
    {
      label: "Instantenous",
      value: 10
    },
    {
      label: "Short (100ms)",
      value: 100
    },
    {
      label: "Medium (200ms)",
      value: 200
    },
    {
      label: "Long (500ms)",
      value: 500
    },
    {
      label: "Longest (1s)",
      value: 1000
    }
  ];
  const currentQuickSuggestionDelay = getSettingValue(SETTING_EDITOR_QUICK_SUGGESTION_DELAY);
  const quickSuggestionDelayMenu: MenuItemConstructorOptions[] = quickSuggestionDelayOptions.map(
    (f, idx) => {
      return {
        id: `${EDITOR_QUICK_SUGGESTION_DELAY}_${idx}`,
        label: f.label,
        type: "checkbox",
        checked: currentQuickSuggestionDelay === f.value,
        click: async () => {
          setSettingValue(SETTING_EDITOR_QUICK_SUGGESTION_DELAY, f.value);
        }
      };
    }
  );

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
      {
        label: "Toggle Full Screen",
        accelerator: fullScreenShortcut,
        click: () => {
          if (ideFocus) {
            ideWindow.setFullScreen(!ideWindow.isFullScreen());
          } else {
            emuWindow.setFullScreen(!emuWindow.isFullScreen());
          }
        }
      },
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
        visible: !isIdeWindowVisible(),
        click: () => {
          ensureIdeWindow();
        }
      },
      {
        type: "separator",
        visible: !isIdeWindowVisible()
      },
      createBooleanSettingsMenu(SETTING_EMU_SHOW_TOOLBAR),
      createBooleanSettingsMenu(SETTING_IDE_SHOW_TOOLBAR),
      createBooleanSettingsMenu(SETTING_EMU_SHOW_STATUS_BAR),
      createBooleanSettingsMenu(SETTING_IDE_SHOW_STATUS_BAR),
      {
        type: "separator"
      },
      createBooleanSettingsMenu(SETTING_EMU_SHOW_KEYBOARD),
      createBooleanSettingsMenu(SETTING_EMU_SHOW_INSTANT_SCREEN),
      createBooleanSettingsMenu(SETTING_EMU_STAY_ON_TOP),
      createBooleanSettingsMenu(SETTING_IDE_SHOW_SIDEBAR),
      createBooleanSettingsMenu(SETTING_IDE_SIDEBAR_TO_RIGHT),
      { type: "separator" },
      createBooleanSettingsMenu(SETTING_IDE_SHOW_TOOLS),
      createBooleanSettingsMenu(SETTING_IDE_TOOLS_ON_TOP, {
        enabledFn: () => !!getSettingValue(SETTING_IDE_SHOW_TOOLS)
      }),
      createBooleanSettingsMenu(SETTING_IDE_MAXIMIZE_TOOLS, {
        enabledFn: () => !!getSettingValue(SETTING_IDE_SHOW_TOOLS)
      }),
      { type: "separator" },
      createBooleanSettingsMenu(SETTING_IDE_SYNC_BREAKPOINTS),
      { type: "separator" },
      {
        id: THEMES,
        label: "Theme",
        // A single flat list: every accent paired with the light tone, then the same with dark.
        // The pair currently in effect carries the tick mark.
        submenu: [
          ...createThemeMenuItems("light", appState),
          { type: "separator" as const },
          ...createThemeMenuItems("dark", appState)
        ]
      },
      { type: "separator" },
      {
        id: EDITOR_OPTIONS,
        label: "Editor Options",
        submenu: [
          {
            id: EDITOR_FONT_FAMILY,
            label: "Font Family",
            submenu: editorFontFamilyMenu
          },
          {
            id: EDITOR_FONT_SIZE,
            label: "Font Size",
            submenu: editorFontSizeMenu
          },
          createBooleanSettingsMenu(SETTING_EDITOR_AUTOCOMPLETE),
          createBooleanSettingsMenu(SETTING_EDITOR_SELECTION_HIGHLIGHT),
          createBooleanSettingsMenu(SETTING_EDITOR_OCCURRENCES_HIGHLIGHT),
          {
            id: EDITOR_QUICK_SUGGESTION_DELAY,
            label: "Quick Suggestion Delay",
            submenu: quickSuggestionDelayMenu
          },
          { type: "separator" },
          createBooleanSettingsMenu(SETTING_EDITOR_DETECT_INDENTATION),
          createBooleanSettingsMenu(SETTING_EDITOR_INSERT_SPACES),
          {
            id: EDITOR_RENDER_WHITESPACE,
            label: "Render Whitespaces",
            submenu: editorRenderWhitespaceMenu
          },
          { type: "separator" },
          {
            id: EDITOR_TAB_SIZE,
            label: "Tab Size",
            submenu: editorTabSizeMenu
          },
          { type: "separator" },
          createBooleanSettingsMenu(SETTING_EDITOR_ALLOW_BACKGROUND_COMPILE)
        ]
      },
      {
        // --- The monitoring views (memory, disassembly, CPU, ULA, ...), which get the same pair of
        // --- knobs as the editor above: family from the same font registry, size from its own
        // --- ladder. Their titles, tabs and the status bar are chrome and follow neither, exactly
        // --- as the editor's own settings leave the tab bar alone.
        id: PANEL_OPTIONS,
        label: "Panel Options",
        submenu: [
          {
            id: PANEL_FONT_FAMILY,
            label: "Font Family",
            submenu: panelFontFamilyMenu
          },
          {
            id: PANEL_FONT_SIZE,
            label: "Font Size",
            submenu: panelFontSizeMenu
          }
        ]
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

  // --- Prepare the scanline effect submenus
  const scanlineEffectValues = [
    { value: "off", label: "Off" },
    { value: "50%", label: "50%" },
    { value: "25%", label: "25%" },
    { value: "12.5%", label: "12.5%" }
  ];
  const currentScanlineEffect = getSettingValue(SETTING_EMU_SCANLINE_EFFECT) ?? "off";
  const scanlineEffectMenu: MenuItemConstructorOptions[] = scanlineEffectValues.map((v) => {
    return {
      id: `${SCANLINE_EFFECT}_${v.value}`,
      label: v.label,
      type: "checkbox",
      checked: currentScanlineEffect === v.value,
      click: async () => {
        setSettingValue(SETTING_EMU_SCANLINE_EFFECT, v.value);
        await logEmuEvent(`Scanline effect set to ${v.label}`);
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
            const newMachine = machineRegistry.find((m) => m.machineId === mt.machineId);
            if (newMachine?.features?.[MF_ALLOW_SCAN_LINES] === false) {
              // --- Turn off scanline effect for machines that support it by default
              setSettingValue(SETTING_EMU_SCANLINE_EFFECT, "off");
            }
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
        if (appState.ideFocused && appState.project.isKliveProject) {
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
    {
      id: DEBUG_MACHINE,
      label: "Start with Debugging",
      enabled: machineWaits,
      accelerator: "Ctrl+F5",
      click: async () => {
        await getEmuApi().issueMachineCommand("debug");
      }
    },
    {
      id: STEP_INTO,
      label: "Step Into",
      enabled: machinePaused,
      accelerator: stepIntoShortcut,
      click: async () => {
        await getEmuApi().issueMachineCommand("stepInto");
      }
    },
    {
      id: STEP_OVER,
      label: "Step Over",
      enabled: machinePaused,
      accelerator: stepOverShortcut,
      click: async () => {
        await getEmuApi().issueMachineCommand("stepOver");
      }
    },
    {
      id: STEP_OUT,
      label: "Step Out",
      enabled: machinePaused,
      accelerator: stepOutShortcut,
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
    { type: "separator" }
  );

  if (currentMachine?.features?.[MF_ALLOW_SCAN_LINES] !== false) {
    machineSubMenu.push({
      id: SCANLINE_EFFECT,
      label: "Scanline Effect",
      submenu: scanlineEffectMenu
    });
  }

  machineSubMenu.push(
    { type: "separator" },
    ...specificMachineMenus,
    { type: "separator" },
    {
      id: SELECT_KEY_MAPPING,
      label: "Select Key Mapping...",
      visible: !isIdeWindowFocused(),
      click: async () => {
        await setKeyMappingFile(emuWindow);
        await saveKliveProject();
      }
    },
    {
      id: RESET_KEY_MAPPING,
      label: "Reset Key Mapping",
      visible: !isIdeWindowFocused(),
      click: async () => {
        mainStore.dispatch(setKeyMappingsAction(undefined, undefined));
        await saveKliveProject();
      }
    },
    ...(appState?.emulatorState?.screenRecordingAvailable !== false ? [{ type: "separator" as const }] : []),
    {
      id: RECORDING_MENU,
      label: "Recording",
      visible: appState?.emulatorState?.screenRecordingAvailable !== false,
      submenu: [
        {
          id: "recording_half_fps",
          label: "Half fps",
          type: "checkbox",
          checked: appState?.emulatorState?.screenRecordingFps === "half",
          enabled: isRecordingIdle,
          click: async () =>
            await getEmuApi().issueRecordingCommand(
              appState?.emulatorState?.screenRecordingFps === "half"
                ? "set-fps-native"
                : "set-fps-half"
            )
        },
        { type: "separator" },
        {
          id: "recording_quality_lossless",
          label: "Highest (lossless) quality",
          type: "checkbox",
          checked: (appState?.emulatorState?.screenRecordingQuality ?? "good") === "lossless",
          enabled: isRecordingIdle,
          click: async () => await getEmuApi().issueRecordingCommand("set-quality-lossless")
        },
        {
          id: "recording_quality_high",
          label: "High quality",
          type: "checkbox",
          checked: (appState?.emulatorState?.screenRecordingQuality ?? "good") === "high",
          enabled: isRecordingIdle,
          click: async () => await getEmuApi().issueRecordingCommand("set-quality-high")
        },
        {
          id: "recording_quality_good",
          label: "Best compression quality",
          type: "checkbox",
          checked: (appState?.emulatorState?.screenRecordingQuality ?? "good") === "good",
          enabled: isRecordingIdle,
          click: async () => await getEmuApi().issueRecordingCommand("set-quality-good")
        },
        { type: "separator" },
        {
          id: "recording_format_mp4",
          label: "Format: MP4 (H.264) – Universal, small files",
          type: "checkbox",
          checked: (appState?.emulatorState?.screenRecordingFormat ?? "mp4") === "mp4",
          enabled: isRecordingIdle,
          click: async () => await getEmuApi().issueRecordingCommand("set-format-mp4")
        },
        {
          id: "recording_format_webm",
          label: "Format: WebM (VP9) – Best for web sharing",
          type: "checkbox",
          checked: (appState?.emulatorState?.screenRecordingFormat ?? "mp4") === "webm",
          enabled: isRecordingIdle,
          click: async () => await getEmuApi().issueRecordingCommand("set-format-webm")
        },
        {
          id: "recording_format_mkv",
          label: "Format: MKV (H.265) – Best compression",
          type: "checkbox",
          checked: (appState?.emulatorState?.screenRecordingFormat ?? "mp4") === "mkv",
          enabled: isRecordingIdle,
          click: async () => await getEmuApi().issueRecordingCommand("set-format-mkv")
        },
        { type: "separator" },
        {
          id: "recording_start_stop",
          label: isRecordingIdle ? "Start recording" : "Stop recording",
          click: async () =>
            await getEmuApi().issueRecordingCommand(isRecordingIdle ? "start-recording" : "disarm")
        },
        { type: "separator" },
        {
          id: "recording_pause_resume",
          label: recState === "paused" ? "Continue recording" : "Pause recording",
          enabled: recState === "recording" || recState === "paused",
          click: async () =>
            await getEmuApi().issueRecordingCommand(
              recState === "paused" ? "resume-recording" : "pause-recording"
            )
        }
      ]
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
            if (!commandResult.success) {
              if (task.id !== "exportCode") {
                await executeIdeCommand(ideWindow, "outp build", undefined, true);
              }
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
    visible: isIdeWindowVisible(),
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
        label: "Show Disassembly",
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
      ...specificIdeMenus,
      { type: "separator" },
      createIdeIntegrationsMenu((dialogId) => getIdeApi().displayDialog(dialogId)),
      { type: "separator" },
      {
        type: "submenu",
        id: IDE_SETTINGS,
        label: "IDE Settings",
        submenu: [
          createBooleanSettingsMenu(SETTING_IDE_OPEN_LAST_PROJECT),
          { type: "separator" },
          createBooleanSettingsMenu(SETTING_IDE_CLOSE_EMU)
        ]
      }
    ]
  });

  // ==========================================================================
  // Help menu

  let specificHelpMenus: MenuItemConstructorOptions[] = [];
  if (machineMenus && machineMenus.helpItems) {
    specificHelpMenus = machineMenus.helpItems(
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
          const about = createAboutDialogData(
            app.getVersion(),
            process.versions.electron,
            os.version()
          );
          if (ideFocus) {
            await getIdeApi().displayDialog(ABOUT_DIALOG, about);
          } else {
            await getEmuApi().displayDialog(ABOUT_DIALOG, about);
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
        click: async () => {
          if (isIdeWindowFocused()) {
            await getIdeApi().displayDialog(FIRST_STARTUP_DIALOG_IDE);
          } else {
            await getEmuApi().displayDialog(FIRST_STARTUP_DIALOG_EMU);
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

  // --- Set the menu. `setupMenu` runs on *every* state change, and most of those changes do not
  // --- alter the menu at all. Handing an unchanged menu to the OS is not free: on macOS every
  // --- `Menu.setApplicationMenu` call replaces the single global NSMenu, which makes an
  // --- auto-hidden menu bar (System Settings > "Automatically hide and show the menu bar", or
  // --- full-screen mode) tear down and re-reveal itself - the menu bar visibly flashes while the
  // --- pointer rests at the top of the screen. So only touch the native menu when the rendered
  // --- menu really differs from the one already installed.
  if (__DARWIN__) {
    const windowFocused = isEmuWindowFocused() ? emuWindow : ideWindow;
    if (!windowFocused.isDestroyed()) {
      template.forEach(templateTransform(windowFocused));
      if (menuChanged("app", template)) {
        Menu.setApplicationMenu(Menu.buildFromTemplate(template));
      }
    }
  } else {
    if (emuWindow && !emuWindow.isDestroyed()) {
      template.forEach(templateTransform(emuWindow));
      if (menuChanged("emu", template)) {
        emuWindow.setMenu(Menu.buildFromTemplate(template));
      }
    }
    if (ideWindow && !ideWindow.isDestroyed()) {
      template.forEach(templateTransform(ideWindow));
      if (menuChanged("ide", template)) {
        ideWindow.setMenu(Menu.buildFromTemplate(template));
      }
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
 * The signature of the menu last handed to the OS, per menu target ("app" on macOS, "emu"/"ide"
 * elsewhere). Used to suppress redundant native menu updates.
 */
const lastMenuSignatures = new Map<string, string>();

/**
 * Counts the menu updates suppressed since the last real rebuild, per target. Reported only when
 * the KLIVE_MENU_DEBUG environment variable is set.
 */
const suppressedMenuUpdates = new Map<string, number>();

/**
 * Serializes the visible shape of a menu template: everything that can make the rendered menu look
 * or behave differently (labels, ids, roles, types, accelerators, enabled/visible/checked flags and
 * the nesting of submenus). Click handlers are deliberately excluded: they are freshly created
 * closures on every build, so comparing them would never report an unchanged menu.
 */
function menuSignature(items: (MenuItemConstructorOptions | MenuItem)[] | Electron.Menu): string {
  return JSON.stringify(items, (key, value) =>
    typeof value === "function" || key === "icon" || key === "sharingItem" ? undefined : value
  );
}

/**
 * Tests whether the given menu template differs from the one most recently installed for the
 * specified target, and remembers it when it does.
 * @param target Menu target key
 * @param template The template about to be installed
 * @returns True if the native menu needs to be replaced
 */
function menuChanged(
  target: string,
  template: (MenuItemConstructorOptions | MenuItem)[]
): boolean {
  let signature: string;
  try {
    signature = menuSignature(template);
  } catch {
    // --- A template we cannot serialize (unexpected cyclic value) must never suppress an update.
    lastMenuSignatures.delete(target);
    return true;
  }
  if (lastMenuSignatures.get(target) === signature) {
    suppressedMenuUpdates.set(target, (suppressedMenuUpdates.get(target) ?? 0) + 1);
    return false;
  }
  if (process.env.KLIVE_MENU_DEBUG) {
    console.log(
      `[menu] rebuilding '${target}' menu (${suppressedMenuUpdates.get(target) ?? 0} redundant ` +
        `update(s) suppressed since the previous rebuild)`
    );
  }
  suppressedMenuUpdates.set(target, 0);
  lastMenuSignatures.set(target, signature);
  return true;
}

/**
 * Forgets the cached menu signatures so that the next `setupMenu` call rebuilds the native menu
 * even if its contents are unchanged (for example after the menu has been cleared).
 */
export function invalidateMenuCache(): void {
  lastMenuSignatures.clear();
  suppressedMenuUpdates.clear();
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
): Promise<IdeCommandResult> {
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

export function createBooleanSettingsMenu(
  settingsId: string,
  options?: { enabledFn?: () => boolean; visibleFn?: () => boolean }
): MenuItemConstructorOptions {
  const definition = getSettingDefinition(settingsId);
  if (!definition) {
    throw new Error(`Setting definition not found for ${settingsId}`);
  }

  const currentValue = getSettingValue(settingsId);
  let visible = options?.visibleFn
    ? options.visibleFn()
    : definition.boundTo === "emu"
      ? isEmuWindowFocused()
      : definition.boundTo === "ide"
        ? isIdeWindowFocused()
        : true;
  return {
    id: `Setting_${settingsId}`,
    label: definition.title,
    type: "checkbox",
    enabled: options?.enabledFn?.() ?? true,
    visible,
    checked: !!currentValue,
    click: (mi) => {
      setSettingValue(settingsId, mi.checked);
    }
  };
}
