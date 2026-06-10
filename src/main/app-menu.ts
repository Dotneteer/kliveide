import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  shell,
  type MessageBoxOptions,
  type MessageBoxReturnValue,
  type MenuItemConstructorOptions
} from "electron";
import os from "node:os";
import {
  SETTING_EDITOR_ALLOW_BACKGROUND_COMPILE,
  SETTING_EDITOR_AUTOCOMPLETE,
  SETTING_EDITOR_DETECT_INDENTATION,
  SETTING_EDITOR_FONT_SIZE,
  SETTING_EDITOR_INSERT_SPACES,
  SETTING_EDITOR_OCCURRENCES_HIGHLIGHT,
  SETTING_EDITOR_QUICK_SUGGESTION_DELAY,
  SETTING_EDITOR_RENDER_WHITESPACE,
  SETTING_EDITOR_SELECTION_HIGHLIGHT,
  SETTING_EDITOR_TABSIZE,
  SETTING_EMU_SCANLINE_EFFECT,
  SETTING_EMU_MACHINE_TYPE,
  SETTING_EMU_SHOW_INSTANT_SCREEN,
  SETTING_EMU_SHOW_KEYBOARD,
  SETTING_EMU_SHOW_STATUS_BAR,
  SETTING_EMU_SHOW_TOOLBAR,
  SETTING_EMU_STAY_ON_TOP,
  SETTING_EMU_FAST_LOAD,
  SETTING_IDE_CLOSE_EMU,
  SETTING_IDE_MAXIMIZE_TOOLS,
  SETTING_IDE_OPEN_LAST_PROJECT,
  SETTING_IDE_SHOW_SIDEBAR,
  SETTING_IDE_SHOW_STATUS_BAR,
  SETTING_IDE_SHOW_TOOLBAR,
  SETTING_IDE_SHOW_TOOLS,
  SETTING_IDE_SIDEBAR_TO_RIGHT,
  SETTING_IDE_SYNC_BREAKPOINTS,
  SETTING_IDE_TOOLS_ON_TOP
} from "../common/settings/setting-const";
import {
  clearTapeMediaAction,
  dimMenuAction,
  setTapeMediaAction,
  setThemeAction
} from "../common/state/actions";
import { getEmuApi } from "../common/messaging/MainToEmuMessenger";
import type { EmuMachineCommand } from "../common/messaging/EmuApi";
import { MachineControllerState } from "../common/abstractions/MachineControllerState";
import { MF_ALLOW_SCAN_LINES, MF_TAPE_SUPPORT } from "../common/machines/constants";
import {
  getMachineInfo,
  machineRegistry,
  resolveMachineSelection
} from "../common/machines/machine-registry";
import { mainStore } from "./main-store";
import {
  appSettings,
  getSettingDefinition,
  getSettingValue,
  saveAppSettings,
  setSettingValue
} from "./settings";
import { MEDIA_TAPE } from "../common/structs/project-const";

export const KLIVE_GITHUB_PAGES = "https://dotneteer.github.io/kliveide";

type MenuContext = "emu" | "ide";

const SYSTEM_MENU_ID = "system_menu";

let currentEmuWindow: BrowserWindow | null = null;
let currentIdeWindow: BrowserWindow | null = null;
let openIdeWindow: (() => Promise<void> | void) | null = null;
let unsubscribeMenuRefresh: (() => void) | undefined;
let menuRefreshQueued = false;
let lastMenuRefreshSignature = "";

export function startApplicationMenu(
  emuWindow: BrowserWindow,
  ideWindowProvider: () => BrowserWindow | null,
  openIdeWindowHandler: () => Promise<void> | void
): void {
  currentEmuWindow = emuWindow;
  currentIdeWindow = ideWindowProvider();
  openIdeWindow = openIdeWindowHandler;

  refreshApplicationMenu();
  lastMenuRefreshSignature = getMenuRefreshSignature();
  unsubscribeMenuRefresh?.();
  unsubscribeMenuRefresh = mainStore.subscribe(queueMenuRefresh);
}

export function updateApplicationMenuWindows(
  emuWindow: BrowserWindow | null,
  ideWindow: BrowserWindow | null
): void {
  currentEmuWindow = emuWindow;
  currentIdeWindow = ideWindow;
  queueMenuRefresh();
}

export function stopApplicationMenu(): void {
  unsubscribeMenuRefresh?.();
  unsubscribeMenuRefresh = undefined;
  Menu.setApplicationMenu(null);
}

function queueMenuRefresh(): void {
  const nextSignature = getMenuRefreshSignature();
  if (nextSignature === lastMenuRefreshSignature) {
    return;
  }
  lastMenuRefreshSignature = nextSignature;

  if (menuRefreshQueued) {
    return;
  }

  menuRefreshQueued = true;
  setImmediate(() => {
    menuRefreshQueued = false;
    refreshApplicationMenu();
  });
}

function refreshApplicationMenu(): void {
  if (process.platform === "darwin") {
    const context = currentIdeWindow?.isFocused() ? "ide" : "emu";
    Menu.setApplicationMenu(Menu.buildFromTemplate(createMenuTemplate(context)));
    return;
  }

  if (currentEmuWindow && !currentEmuWindow.isDestroyed()) {
    currentEmuWindow.setMenu(Menu.buildFromTemplate(createMenuTemplate("emu")));
  }

  if (currentIdeWindow && !currentIdeWindow.isDestroyed()) {
    currentIdeWindow.setMenu(Menu.buildFromTemplate(createMenuTemplate("ide")));
  }
}

function createMenuTemplate(context: MenuContext): MenuItemConstructorOptions[] {
  const state = mainStore.getState();
  const template: MenuItemConstructorOptions[] = [];

  if (process.platform === "darwin") {
    template.push({
      id: SYSTEM_MENU_ID,
      label: app.name,
      submenu: [
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" }
      ]
    });
  }

  template.push(createFileMenu());

  if (process.platform === "darwin") {
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

  template.push(createViewMenu(context));
  template.push(createMachineMenu());
  template.push(createIdeMenu(context));
  template.push(createHelpMenu(context));

  if (state.dimMenu) {
    disableAllMenuItems(template);
  }

  return template;
}

function createFileMenu(): MenuItemConstructorOptions {
  return {
    label: "File",
    submenu: filterVisibleItems([
      {
        id: "new_project",
        label: "New project...",
        click: notImplemented("New project", `
          ensureIdeWindow();
          mainStore.dispatch(displayDialogAction(NEW_PROJECT_DIALOG));
        `)
      },
      {
        id: "open_folder",
        label: "Open folder...",
        click: notImplemented("Open folder", `
          ensureIdeWindow();
          await openFolder(ideWindow);
        `)
      },
      { type: "separator" },
      {
        id: "close_folder",
        label: "Close Folder",
        click: notImplemented("Close Folder", `
          ensureIdeWindow();
          await getIdeApi().saveAllBeforeQuit();
          mainStore.dispatch(closeFolderAction());
          await getEmuApi().eraseAllBreakpoints();
          fileChangeWatcher.stopWatching();
          await saveKliveProject();
        `)
      },
      {
        id: "manage_excluded_items",
        label: "Manage Excluded Items",
        click: notImplemented("Manage Excluded Items", `
          mainStore.dispatch(displayDialogAction(EXCLUDED_PROJECT_ITEMS_DIALOG));
        `)
      },
      ...(process.platform === "darwin"
        ? []
        : ([{ type: "separator" }, { role: "quit" }] as MenuItemConstructorOptions[]))
    ])
  };
}

function createViewMenu(context: MenuContext): MenuItemConstructorOptions {
  const state = mainStore.getState();
  const editorFontSizeMenu = createOptionMenu(
    "editor_font_size",
    SETTING_EDITOR_FONT_SIZE,
    [
      ["Smallest", 12],
      ["Small", 14],
      ["Medium", 16],
      ["Large", 20],
      ["Largest", 24]
    ]
  );
  const editorTabSizeMenu = createOptionMenu("editor_tab_size", SETTING_EDITOR_TABSIZE, [
    ["2", 2],
    ["4", 4],
    ["8", 8],
    ["16", 16]
  ]);
  const editorRenderWhitespaceMenu = createOptionMenu(
    "editor_render_whitespace",
    SETTING_EDITOR_RENDER_WHITESPACE,
    [
      ["Do not render whitespaces", "none"],
      ["Render whitespace at line boundaries", "boundary"],
      ["Only render whitespace inside selected text", "selection"],
      ["Render all whitespace characters", "all"]
    ]
  );
  const quickSuggestionDelayMenu = createOptionMenu(
    "editor_quick_suggestion_delay",
    SETTING_EDITOR_QUICK_SUGGESTION_DELAY,
    [
      ["Instantenous", 10],
      ["Short (100ms)", 100],
      ["Medium (200ms)", 200],
      ["Long (500ms)", 500],
      ["Longest (1s)", 1000]
    ]
  );

  return {
    label: "View",
    submenu: filterVisibleItems([
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      {
        label: "Toggle Full Screen",
        accelerator: "Ctrl+Shift+F9",
        click: () => {
          const target = getContextWindow(context);
          target?.setFullScreen(!target.isFullScreen());
        }
      },
      {
        id: "toggle_devtools",
        label: "Toggle Developer Tools",
        accelerator: "Ctrl+Shift+I",
        click: () => {
          getContextWindow(context)?.webContents.toggleDevTools();
        }
      },
      { type: "separator" },
      {
        id: "show_ide_window",
        label: "Show IDE",
        visible: context === "emu" && !isIdeWindowVisible(),
        click: () => {
          void openIdeWindow?.();
          appSettings.windowStates ??= {};
          appSettings.windowStates.showIdeOnStartup = true;
          saveAppSettings();
        }
      },
      {
        type: "separator",
        visible: context === "emu" && !isIdeWindowVisible()
      },
      createBooleanSettingsMenu(SETTING_EMU_SHOW_TOOLBAR, context),
      createBooleanSettingsMenu(SETTING_IDE_SHOW_TOOLBAR, context),
      createBooleanSettingsMenu(SETTING_EMU_SHOW_STATUS_BAR, context),
      createBooleanSettingsMenu(SETTING_IDE_SHOW_STATUS_BAR, context),
      { type: "separator" },
      createBooleanSettingsMenu(SETTING_EMU_SHOW_KEYBOARD, context),
      createBooleanSettingsMenu(SETTING_EMU_SHOW_INSTANT_SCREEN, context),
      createBooleanSettingsMenu(SETTING_EMU_STAY_ON_TOP, context),
      createBooleanSettingsMenu(SETTING_IDE_SHOW_SIDEBAR, context),
      createBooleanSettingsMenu(SETTING_IDE_SIDEBAR_TO_RIGHT, context),
      { type: "separator" },
      createBooleanSettingsMenu(SETTING_IDE_SHOW_TOOLS, context),
      createBooleanSettingsMenu(SETTING_IDE_TOOLS_ON_TOP, context, {
        enabledFn: () => !!getSettingValue(SETTING_IDE_SHOW_TOOLS)
      }),
      createBooleanSettingsMenu(SETTING_IDE_MAXIMIZE_TOOLS, context, {
        enabledFn: () => !!getSettingValue(SETTING_IDE_SHOW_TOOLS)
      }),
      { type: "separator" },
      createBooleanSettingsMenu(SETTING_IDE_SYNC_BREAKPOINTS, context),
      { type: "separator" },
      {
        id: "themes",
        label: "Themes",
        submenu: [
          {
            id: "light_theme",
            label: "Light",
            type: "checkbox",
            checked: state.theme === "light",
            click: () => {
              mainStore.dispatch(setThemeAction("light"), "main");
              saveAppSettings();
            }
          },
          {
            id: "dark_theme",
            label: "Dark",
            type: "checkbox",
            checked: state.theme === "dark",
            click: () => {
              mainStore.dispatch(setThemeAction("dark"), "main");
              saveAppSettings();
            }
          }
        ]
      },
      { type: "separator" },
      {
        id: "editor_options",
        label: "Editor Options",
        visible: context === "ide",
        submenu: [
          {
            id: "editor_font_size",
            label: "Font Size",
            submenu: editorFontSizeMenu
          },
          createBooleanSettingsMenu(SETTING_EDITOR_AUTOCOMPLETE, context),
          createBooleanSettingsMenu(SETTING_EDITOR_SELECTION_HIGHLIGHT, context),
          createBooleanSettingsMenu(SETTING_EDITOR_OCCURRENCES_HIGHLIGHT, context),
          {
            id: "editor_quick_suggestion_delay",
            label: "Quick Suggestion Delay",
            submenu: quickSuggestionDelayMenu
          },
          { type: "separator" },
          createBooleanSettingsMenu(SETTING_EDITOR_DETECT_INDENTATION, context),
          createBooleanSettingsMenu(SETTING_EDITOR_INSERT_SPACES, context),
          {
            id: "editor_render_whitespace",
            label: "Render Whitespaces",
            submenu: editorRenderWhitespaceMenu
          },
          { type: "separator" },
          {
            id: "editor_tab_size",
            label: "Tab Size",
            submenu: editorTabSizeMenu
          },
          { type: "separator" },
          createBooleanSettingsMenu(SETTING_EDITOR_ALLOW_BACKGROUND_COMPILE, context)
        ]
      }
    ])
  };
}

function createMachineMenu(): MenuItemConstructorOptions {
  const appState = mainStore.getState();
  const machineState = appState.emulatorState?.machineState ?? MachineControllerState.None;
  const isRunning = machineState === MachineControllerState.Running;
  const isPaused = machineState === MachineControllerState.Paused;
  const canStart = !isRunning;
  const canPause = isRunning;
  const canStopOrRestart = isRunning || isPaused;
  const canStep = isPaused;
  const machineTypesMenu = createMachineTypesMenu();
  const machineInfo = getMachineInfo(appState.emulatorState?.machineId);
  const supportsTape = !!machineInfo?.features?.[MF_TAPE_SUPPORT];
  const tapeMedia = appState.media?.[MEDIA_TAPE];
  const hasTape = !!tapeMedia?.displayName;

  return {
    label: "Machine",
    submenu: [
      {
        id: "machine_types",
        label: "Machine type",
        submenu: machineTypesMenu
      },
      { type: "separator" },
      {
        id: "start",
        label: "Start",
        accelerator: "F5",
        enabled: canStart,
        click: issueMachineCommand("start")
      },
      {
        id: "pause",
        label: "Pause",
        accelerator: "Shift+F5",
        enabled: canPause,
        click: issueMachineCommand("pause")
      },
      {
        id: "stop",
        label: "Stop",
        accelerator: "F4",
        enabled: canStopOrRestart,
        click: issueMachineCommand("stop")
      },
      {
        id: "restart",
        label: "Restart",
        accelerator: "Shift+F4",
        enabled: canStopOrRestart,
        click: issueMachineCommand("restart")
      },
      ...(supportsTape
        ? [
            { type: "separator" as const },
            createBooleanSettingsMenu(SETTING_EMU_FAST_LOAD, "emu"),
            {
              id: "rewind_tape",
              label: "Rewind Tape",
              enabled: hasTape,
              click: issueMachineCommand("rewind")
            },
            {
              id: "select_tape_file",
              label: "Select Tape File...",
              click: selectTapeFileSkeleton
            },
            {
              id: "eject_tape",
              label: "Eject Tape",
              enabled: hasTape,
              click: ejectTapeSkeleton
            }
          ]
        : []),
      { type: "separator" },
      {
        id: "debug",
        label: "Start with Debugging",
        accelerator: "Ctrl+F5",
        enabled: canStart,
        click: issueMachineCommand("debug")
      },
      {
        id: "step_into",
        label: "Step Into",
        accelerator: process.platform === "darwin" ? "F12" : "F11",
        enabled: canStep,
        click: issueMachineCommand("stepInto")
      },
      {
        id: "step_over",
        label: "Step Over",
        accelerator: "F10",
        enabled: canStep,
        click: issueMachineCommand("stepOver")
      },
      {
        id: "step_out",
        label: "Step Out",
        accelerator: process.platform === "darwin" ? "Shift+F12" : "Shift+F11",
        enabled: canStep,
        click: issueMachineCommand("stepOut")
      },
      { type: "separator" },
      {
        id: "clock_mult",
        label: "Clock Multiplier",
        submenu: ["Normal", "2x", "4x", "6x", "8x", "10x", "12x", "16x", "20x", "24x"].map(
          (label) => ({
            label,
            type: "checkbox" as const,
            click: notImplemented(`Clock Multiplier ${label}`, `
              mainStore.dispatch(setClockMultiplierAction(v));
              await logEmuEvent(\`Clock multiplier set to \${v}\`);
              await saveKliveProject();
            `)
          })
        )
      },
      {
        id: "sound_level",
        label: "Sound Level",
        submenu: ["Mute", "Low", "Medium", "High", "Highest"].map((label) => ({
          label,
          type: "checkbox" as const,
          click: notImplemented(`Sound Level ${label}`, `
            mainStore.dispatch(setSoundLevelAction(v.value));
            await logEmuEvent(\`Sound level set to \${v.label} (\${v.value})\`);
            await saveKliveProject();
          `)
        }))
      },
      { type: "separator" },
      {
        id: "scanline_effect",
        label: "Scanline Effect",
        submenu: createOptionMenu("scanline_effect", SETTING_EMU_SCANLINE_EFFECT, [
          ["Off", "off"],
          ["50%", "50%"],
          ["25%", "25%"],
          ["12.5%", "12.5%"]
        ])
      },
      { type: "separator" },
      {
        id: "select_key_mapping",
        label: "Select Key Mapping...",
        click: notImplemented("Select Key Mapping", `
          await setKeyMappingFile(emuWindow);
          await saveKliveProject();
        `)
      },
      {
        id: "reset_key_mapping",
        label: "Reset Key Mapping",
        click: notImplemented("Reset Key Mapping", `
          mainStore.dispatch(setKeyMappingsAction(undefined, undefined));
          await saveKliveProject();
        `)
      },
      { type: "separator" },
      {
        id: "recording_menu",
        label: "Recording",
        submenu: [
          {
            id: "recording_half_fps",
            label: "Half fps",
            type: "checkbox",
            click: notImplemented("Recording Half fps", `
              await getEmuApi().issueRecordingCommand(
                appState?.emulatorState?.screenRecordingFps === "half"
                  ? "set-fps-native"
                  : "set-fps-half"
              );
            `)
          },
          { type: "separator" },
          {
            id: "recording_quality_lossless",
            label: "Highest (lossless) quality",
            type: "checkbox",
            click: notImplemented("Recording Quality", `
              await getEmuApi().issueRecordingCommand("set-quality-lossless");
            `)
          },
          {
            id: "recording_start_stop",
            label: "Start recording",
            click: notImplemented("Start recording", `
              await getEmuApi().issueRecordingCommand(isRecordingIdle ? "start-recording" : "disarm");
            `)
          }
        ]
      }
    ]
  };
}

function createMachineTypesMenu(): MenuItemConstructorOptions[] {
  const appState = mainStore.getState();
  const currentMachineId = appState.emulatorState?.machineId;
  const currentModelId = appState.emulatorState?.modelId;
  const machineTypesMenu: MenuItemConstructorOptions[] = [];

  for (const machine of machineRegistry) {
    if (!machine.models?.length) {
      machineTypesMenu.push({
        id: `machine_${machine.machineId}`,
        label: machine.displayName,
        type: "radio",
        enabled: true,
        checked: currentMachineId === machine.machineId,
        click: () => handleSelectMachineType(machine.machineId)
      });
    } else {
      for (const model of machine.models) {
        machineTypesMenu.push({
          id: `machine_${machine.machineId}_${model.modelId}`,
          label: model.displayName,
          type: "radio",
          enabled: true,
          checked: currentMachineId === machine.machineId && currentModelId === model.modelId,
          click: () => handleSelectMachineType(machine.machineId, model.modelId)
        });
      }
    }
    machineTypesMenu.push({ type: "separator" });
  }

  if (machineTypesMenu.at(-1)?.type === "separator") {
    machineTypesMenu.pop();
  }

  return machineTypesMenu;
}

function handleSelectMachineType(machineId: string, modelId?: string): void {
  void selectMachineType(machineId, modelId).catch(async (err) => {
    await showMessageBox(currentEmuWindow ?? BrowserWindow.getFocusedWindow(), {
      type: "error",
      title: "Machine type change failed",
      message: "Could not change the selected machine type.",
      detail: err instanceof Error ? err.message : String(err)
    });
  });
}

async function selectMachineType(machineId: string, modelId?: string): Promise<void> {
  const machine = getMachineInfo(machineId);
  const selection = resolveMachineSelection(machineId, modelId);
  const current = mainStore.getState().emulatorState;
  if (
    current?.machineId === selection.machineId &&
    current?.modelId === selection.modelId &&
    stableJson(current?.config ?? {}) === stableJson(selection.config)
  ) {
    return;
  }

  setSettingValue(SETTING_EMU_MACHINE_TYPE, selection);
  await getEmuApi().setMachineType(selection.machineId, selection.modelId, selection.config);

  if (machine?.features?.[MF_ALLOW_SCAN_LINES] === false) {
    setSettingValue(SETTING_EMU_SCANLINE_EFFECT, "off");
  }
}

async function selectTapeFileSkeleton(): Promise<void> {
  mainStore.dispatch(
    setTapeMediaAction({
      fileName: "__tape_ui_skeleton__",
      displayName: "Tape UI skeleton",
      size: 0,
      blockCount: 0
    }),
    "main"
  );
}

async function ejectTapeSkeleton(): Promise<void> {
  mainStore.dispatch(clearTapeMediaAction(), "main");
}

function createIdeMenu(context: MenuContext): MenuItemConstructorOptions {
  return {
    id: "ide_menu",
    visible: context === "ide",
    label: "IDE",
    submenu: [
      {
        id: "show_memory",
        label: "Show Machine Memory",
        type: "checkbox",
        click: notImplemented("Show Machine Memory", `
          await getIdeApi().showMemory(!volatileDocs[MEMORY_PANEL_ID]);
          mainStore.dispatch(setVolatileDocStateAction(MEMORY_PANEL_ID, !volatileDocs[MEMORY_PANEL_ID]));
        `)
      },
      {
        id: "show_banked_disassembly",
        label: "Show Disassembly",
        type: "checkbox",
        click: notImplemented("Show Disassembly", `
          await getIdeApi().showDisassembly(!volatileDocs[DISASSEMBLY_PANEL_ID]);
          mainStore.dispatch(setVolatileDocStateAction(DISASSEMBLY_PANEL_ID, !volatileDocs[DISASSEMBLY_PANEL_ID]));
        `)
      },
      { type: "separator" },
      {
        type: "submenu",
        id: "ide_settings",
        label: "IDE Settings",
        submenu: [
          createBooleanSettingsMenu(SETTING_IDE_OPEN_LAST_PROJECT, context),
          { type: "separator" },
          createBooleanSettingsMenu(SETTING_IDE_CLOSE_EMU, context)
        ]
      }
    ]
  };
}

function createHelpMenu(context: MenuContext): MenuItemConstructorOptions {
  return {
    id: "help_menu",
    label: "Help",
    submenu: [
      {
        id: "help_about",
        label: "About",
        click: async () => {
          const result = await showMessageBox(getContextWindow(context), {
            message: "About Klive IDE",
            detail:
              `${KLIVE_GITHUB_PAGES}\n\nVersion: ${app.getVersion()}\n` +
              `Electron version: ${process.versions.electron}\n` +
              `OS version: ${os.version()}`,
            buttons: ["Close", "Visit website"]
          });
          if (result.response) {
            await shell.openExternal(KLIVE_GITHUB_PAGES);
          }
        }
      },
      {
        id: "help_home_page",
        label: "Klive IDE Home Page",
        click: () => {
          void shell.openExternal(KLIVE_GITHUB_PAGES);
        }
      },
      { type: "separator" },
      {
        id: "help_welcome",
        label: "Welcome screen",
        click: notImplemented("Welcome screen", `
          if (isIdeWindowFocused()) {
            mainStore.dispatch(displayDialogAction(FIRST_STARTUP_DIALOG_IDE));
          } else {
            mainStore.dispatch(displayDialogAction(FIRST_STARTUP_DIALOG_EMU));
          }
        `)
      }
    ]
  };
}

function createBooleanSettingsMenu(
  settingsId: string,
  context: MenuContext,
  options?: { enabledFn?: () => boolean; visibleFn?: () => boolean }
): MenuItemConstructorOptions {
  const definition = getSettingDefinition(settingsId);
  if (!definition) {
    throw new Error(`Setting definition not found for ${settingsId}`);
  }

  const visible = options?.visibleFn
    ? options.visibleFn()
    : definition.boundTo === "emu"
      ? context === "emu"
      : definition.boundTo === "ide"
        ? context === "ide"
        : true;

  return {
    id: `Setting_${settingsId}`,
    label: definition.title,
    type: "checkbox",
    enabled: options?.enabledFn?.() ?? true,
    visible,
    checked: !!getSettingValue(settingsId),
    click: (menuItem) => {
      setSettingValue(settingsId, menuItem.checked);
    }
  };
}

function createOptionMenu(
  menuId: string,
  settingsId: string,
  options: Array<[string, unknown]>
): MenuItemConstructorOptions[] {
  const currentValue = getSettingValue(settingsId);

  return options.map(([label, value], index) => ({
    id: `${menuId}_${index}`,
    label,
    type: "checkbox",
    checked: currentValue === value,
    click: () => {
      setSettingValue(settingsId, value);
    }
  }));
}

function issueMachineCommand(command: EmuMachineCommand): () => Promise<void> {
  return async () => {
    mainStore.dispatch(dimMenuAction(true), "main");
    try {
      await getEmuApi().issueMachineCommand(command);
    } catch (err) {
      await showMessageBox(currentEmuWindow ?? BrowserWindow.getFocusedWindow(), {
        type: "error",
        title: "Machine command failed",
        message: `Could not issue machine command: ${command}`,
        detail: err instanceof Error ? err.message : String(err)
      });
    } finally {
      mainStore.dispatch(dimMenuAction(false), "main");
    }
  };
}

function notImplemented(label: string, _originalHandler: string): () => Promise<void> {
  // The original handler body is intentionally passed by each caller and kept in
  // source as a nearby comment string until the corresponding shell subsystem exists.
  return async () => {
    const window = BrowserWindow.getFocusedWindow() ?? currentIdeWindow ?? currentEmuWindow;
    mainStore.dispatch(dimMenuAction(true), "main");
    try {
      await showMessageBox(window, {
        type: "info",
        title: label,
        message: "Not implemented",
        detail: "This menu command is reserved for the full Klive IDE implementation."
      });
    } finally {
      mainStore.dispatch(dimMenuAction(false), "main");
    }
  };
}

function showMessageBox(
  window: BrowserWindow | null,
  options: MessageBoxOptions
): Promise<MessageBoxReturnValue> {
  return window && !window.isDestroyed()
    ? dialog.showMessageBox(window, options)
    : dialog.showMessageBox(options);
}

function getContextWindow(context: MenuContext): BrowserWindow | null {
  return context === "ide" ? currentIdeWindow : currentEmuWindow;
}

function isIdeWindowVisible(): boolean {
  return !!currentIdeWindow && !currentIdeWindow.isDestroyed() && currentIdeWindow.isVisible();
}

function disableAllMenuItems(items: MenuItemConstructorOptions[]): void {
  visitMenu(items, (item) => {
    if (item.id === SYSTEM_MENU_ID) {
      return false;
    }

    item.enabled = false;
    return true;
  });
}

function visitMenu(
  items: MenuItemConstructorOptions[],
  visitor: (item: MenuItemConstructorOptions) => boolean
): void {
  for (const item of items) {
    if (visitor(item) && Array.isArray(item.submenu)) {
      visitMenu(item.submenu, visitor);
    }
  }
}

function filterVisibleItems(items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return items.filter((item) => item.visible !== false);
}

function getMenuRefreshSignature(): string {
  const state = mainStore.getState();
  return stableJson({
    dimMenu: state.dimMenu,
    emuFocused: state.emuFocused,
    ideFocused: state.ideFocused,
    theme: state.theme,
    machineId: state.emulatorState?.machineId,
    modelId: state.emulatorState?.modelId,
    machineState: state.emulatorState?.machineState,
    media: state.media,
    globalSettings: state.globalSettings
  });
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}
