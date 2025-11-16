import {
  app,
  shell,
  dialog,
  BrowserWindow,
  Menu,
  MenuItem,
  MenuItemConstructorOptions
} from "electron";
import os from "os";
import { AppState } from "@state/AppState";
import {
  appSettings,
  getSettingDefinition,
  getSettingValue,
  saveAppSettings,
  setSettingValue
} from "./settingsManager";
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
  SETTING_EMU_SHOW_INSTANT_SCREEN,
  SETTING_EMU_SHOW_KEYBOARD,
  SETTING_EMU_SHOW_STATUS_BAR,
  SETTING_EMU_SHOW_TOOLBAR,
  SETTING_EMU_STAY_ON_TOP,
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
} from "@common/settings/setting-const";
import { machineRegistry } from "@common/machines/machine-registry";
import { emuWindow } from "./emulatorWindow";
import { ideWindow } from "./ideWindow";
import { isEmuWindowFocused, isIdeWindowFocused, isIdeWindowVisible } from ".";
import {
  setClockMultiplierAction,
  setKeyMappingsAction,
  setSoundLevelAction,
  setThemeAction
} from "@state/actions";
import { mainStore } from "./mainStore";
import { MF_ALLOW_CLOCK_MULTIPLIER } from "@common/machines/constants";
import { logEmuEvent, setMachineType } from "./registeredMachines";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { getIdeApi } from "@messaging/MainToIdeMessenger";

export const KLIVE_GITHUB_PAGES = "https://dotneteer.github.io/kliveide";

const SYSTEM_MENU_ID = "system_menu";
const EDITOR_FONT_SIZE = "editor_font_size";
const EDITOR_TAB_SIZE = "editor_tab_size";
const EDITOR_RENDER_WHITESPACE = "editor_render_whitespace";
const EDITOR_QUICK_SUGGESTION_DELAY = "editor_quick_suggestion_delay";
const TOGGLE_DEVTOOLS = "toggle_devtools";
const SHOW_IDE_WINDOW = "show_ide_window";
const CLOCK_MULT = "clock_mult";
const SOUND_LEVEL = "sound_level";

/**
 * Sets up the application menu based on current app state
 * @param state The current application state
 */
export function setupMenu(state: AppState): void {
  // --- We'll put the entire menu here
  const template: (MenuItemConstructorOptions | MenuItem)[] = [];

  // ==========================================================================
  // Application system menu on MacOS

  if (state.os === "darwin") {
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

  // --- Recent projects submenu
  const recentProjectNames = appSettings.recentProjects ?? [];
  const recentProjects: MenuItemConstructorOptions[] = recentProjectNames.map(rp => {
    return {
      label: rp,
      click: async () => {
        ensureIdeWindow();
        // TODO: IMplement this method
      }
    };
  });

  let recentProjectHolder: MenuItemConstructorOptions[] = [];
  if (recentProjects.length > 0) {
    recentProjectHolder.push(
      { type: "separator" },
      {
        id: "recent_projects",
        label: "Recent Folders",
        submenu: recentProjects
      }
    );
  }

  template.push({
    label: "File",
    submenu: filterVisibleItems([
      {
        id: "new_project",
        label: "New project...",
        click: () => {
          ensureIdeWindow();
          // TODO: Implement this method
        }
      },
      {
        id: "open_folder",
        label: "Open folder...",
        click: async () => {
          ensureIdeWindow();
          // TODO: Implement this method
        }
      },
      ...recentProjectHolder,
      { type: "separator" },
      {
        id: "close_folder",
        label: "Close Folder",
        enabled: true, // --- Allow only when there is no folder open
        click: async () => {
          ensureIdeWindow();
          // TODO: Implement this method
        }
      },
      ...(!(false /* TODO: kliveProject, if loaded */)
        ? []
        : ([
            { type: "separator" },
            {
              id: "excluded_project_items",
              label: "Manage Excluded Items",
              enabled: true,
              click: () => {
                // TODO: Implement this method
              }
            }
          ] as MenuItemConstructorOptions[])),
      { type: "separator" },
      {
        id: "bkg_compile",
        label: "Compile in background",
        click: async () => {}
      },
      {
        id: "bkg_compile_stop",
        label: "Stop background compilation",
        click: async () => {}
      },
      ...(state.os === "darwin"
        ? []
        : ([{ type: "separator" }, { role: "quit" }] as MenuItemConstructorOptions[]))
    ])
  });

  // ==========================================================================
  // Edit menu on MacOS
  if (state.os === "darwin") {
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
  const currentFontSize = getSettingValue(SETTING_EDITOR_FONT_SIZE);
  const editorFontSizeMenu: MenuItemConstructorOptions[] = editorFontOptions.map((f, idx) => {
    return {
      id: `${EDITOR_FONT_SIZE}_${idx}`,
      label: f.label,
      type: "checkbox",
      checked: currentFontSize === f.value,
      click: async () => {
        setSettingValue(SETTING_EDITOR_FONT_SIZE, f.value);
      }
    };
  });

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
  const machineId = state?.emulatorState?.machineId;
  const modelId = state?.emulatorState?.modelId;
  const currentMachine = machineRegistry.find(m => m.machineId === machineId);
  const currentModel = currentMachine?.models?.find(m => m.modelId === modelId);
  const machineMenus = machineRegistry[machineId];

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
        // TODO: accelerator: fullScreenShortcut,
        click: () => {
          if (state.ideFocused) {
            ideWindow.setFullScreen(!ideWindow.isFullScreen());
          } else {
            emuWindow.setFullScreen(!emuWindow.isFullScreen());
          }
        }
      },
      {
        id: TOGGLE_DEVTOOLS,
        label: "Toggle Developer Tools",
        // TODO: visible: !!allowDevTools,
        accelerator: "F12",
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
        id: "themes",
        label: "Themes",
        submenu: [
          {
            id: "light_theme",
            label: "Light",
            type: "checkbox",
            checked: state.theme === "light",
            click: async () => {
              mainStore.dispatch(setThemeAction("light"));
              // TODO: await saveKliveProject();
            }
          },
          {
            id: "dark_theme",
            label: "Dark",
            type: "checkbox",
            checked: state.theme === "dark",
            click: async () => {
              mainStore.dispatch(setThemeAction("dark"));
              // TODO: await saveKliveProject();
            }
          }
        ]
      },
      { type: "separator" },
      {
        id: "editor_options",
        label: "Editor Options",
        submenu: [
          {
            id: "editor_font_size",
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
      ? multiplierValues.map(v => {
          return {
            id: `${CLOCK_MULT}_${v}`,
            label: v === 1 ? "Normal" : `${v}x`,
            type: "checkbox",
            checked: state.emulatorState?.clockMultiplier === v,
            click: async () => {
              mainStore.dispatch(setClockMultiplierAction(v));
              await logEmuEvent(`Clock multiplier set to ${v}`);
              // TODO: await saveKliveProject();
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
  const soundLeveMenu: MenuItemConstructorOptions[] = soundLevelValues.map(v => {
    return {
      id: `${SOUND_LEVEL}_${v.value}`,
      label: v.label,
      type: "checkbox",
      checked: state.emulatorState?.soundLevel === v.value,
      click: async () => {
        mainStore.dispatch(setSoundLevelAction(v.value));
        await logEmuEvent(`Sound level set to ${v.label} (${v.value})`);
        // TODO: await saveKliveProject();
      }
    };
  });

  // --- Machine types submenu (use the registered machines)
  const machineTypesMenu: MenuItemConstructorOptions[] = [];
  machineRegistry.forEach(mt => {
    if (!mt.models) {
      machineTypesMenu.push({
        id: `machine_${mt.machineId}`,
        label: mt.displayName,
        type: "checkbox",
        checked: state.emulatorState?.machineId === mt.machineId,
        click: async () => {
          console.log(`Switching to machine type: ${mt.machineId}`);
          await setMachineType(mt.machineId);
          // TODO: await saveKliveProject();
        }
      });
    } else {
      mt.models.forEach(m => {
        machineTypesMenu.push({
          id: `machine_${mt.machineId}_${m.modelId}`,
          label: m.displayName,
          type: "checkbox",
          checked:
            state.emulatorState?.machineId === mt.machineId &&
            state.emulatorState?.modelId === m.modelId,
          click: async () => {
            console.log(`Switching to machine type: ${mt.machineId}, model: ${m.modelId}`);
            await setMachineType(mt.machineId, m.modelId);
            // TODO: await saveKliveProject();
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
      id: "machine_types",
      label: "Machine type",
      submenu: machineTypesMenu
    },
    { type: "separator" },
    {
      id: "start_machine",
      label: "Start",
      enabled: true, // TODO: machineWaits,
      accelerator: "F5",
      click: async () => {
        await getEmuApi().issueMachineCommand("start");
      }
    },
    {
      id: "pause_machine",
      label: "Pause",
      enabled: true, // TODO: machineRuns,
      accelerator: "Shift+F5",
      click: async () => {
        await getEmuApi().issueMachineCommand("pause");
      }
    },
    {
      id: "stop_machine",
      label: "Stop",
      enabled: true, // TODO: machineRestartable,
      accelerator: "F4",
      click: async () => {
        await getEmuApi().issueMachineCommand("stop");
      }
    },
    {
      id: "restart_machine",
      label: "Restart",
      enabled: true, // TODO: machineRestartable,
      accelerator: "Shift+F4",
      click: async () => {
        if (state.ideFocused && state.project.isKliveProject) {
          getIdeApi().executeCommand("outp build");
          getIdeApi().executeCommand(state.emulatorState?.isDebugging ? "debug" : "run");
        } else {
          await getEmuApi().issueMachineCommand("restart");
        }
      }
    },
    { type: "separator" },
    {
      id: "debug_machine",
      label: "Start with Debugging",
      enabled: true, // TODO: machineWaits,
      accelerator: "Ctrl+F5",
      click: async () => {
        await getEmuApi().issueMachineCommand("debug");
      }
    },
    {
      id: "step_into",
      label: "Step Into",
      enabled: true, // TODO: machinePaused,
      accelerator: null, // TODO: stepIntoShortcut,
      click: async () => {
        await getEmuApi().issueMachineCommand("stepInto");
      }
    },
    {
      id: "step_over",
      label: "Step Over",
      enabled: true, // TODO: machinePaused,
      accelerator: null, // TODO: stepOverShortcut,
      click: async () => {
        await getEmuApi().issueMachineCommand("stepOver");
      }
    },
    {
      id: "step_out",
      label: "Step Out",
      enabled: true, // TODO: machinePaused,
      accelerator: null, // TODO: stepOutShortcut,
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
      id: "select_key_mapping",
      label: "Select Key Mapping...",
      visible: !isIdeWindowFocused(),
      click: async () => {
        // TODO: await setKeyMappingFile(emuWindow);
        // TODO: await saveKliveProject();
      }
    },
    {
      id: "reset_key_mapping",
      label: "Reset Key Mapping",
      visible: !isIdeWindowFocused(),
      click: async () => {
        mainStore.dispatch(setKeyMappingsAction(undefined, undefined));
        // TODO: await saveKliveProject();
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

  // if ((true /* TODO: kliveProject */)) {
  //   if (true /* TODO: hasBuildFile */) {
  //     let buildTasks: MenuItemConstructorOptions[] = [];
  //     for (const task of collectedBuildTasks) {
  //       if (task.separatorBefore) {
  //         buildTasks.push({ type: "separator" });
  //       }
  //       buildTasks.push({
  //         id: `BF_${task.id}`,
  //         label: task.displayName,
  //         click: async () => {
  //           const commandResult = await executeIdeCommand(
  //             ideWindow,
  //             `run-build-function ${task.id}`,
  //             undefined,
  //             true
  //           );
  //           if (!commandResult.success) {
  //             if (task.id !== "exportCode") {
  //               await executeIdeCommand(ideWindow, "outp build", undefined, true);
  //             }
  //           }
  //         }
  //       });
  //     }

  //     if (buildTasks.length > 0) {
  //       template.push({
  //         label: "Build",
  //         submenu: buildTasks
  //       });
  //     }
  //   }
  // }

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
    id: "ide_menu",
    visible: isIdeWindowVisible(),
    label: "IDE",
    submenu: [
      {
        id: "ide_show_memory",
        label: "Show Machine Memory",
        type: "checkbox",
        checked: true, // TODO: volatileDocs[MEMORY_PANEL_ID],
        click: async () => {
          // await getIdeApi().showMemory(!volatileDocs[MEMORY_PANEL_ID]);
          // mainStore.dispatch(
          //   setVolatileDocStateAction(MEMORY_PANEL_ID, !volatileDocs[MEMORY_PANEL_ID])
          // );
        }
      },
      {
        id: "ide_show_assembly",
        label: "Show Disassembly",
        type: "checkbox",
        checked: true, // TODO: volatileDocs[DISASSEMBLY_PANEL_ID],
        click: async () => {
          // await getIdeApi().showDisassembly(!volatileDocs[DISASSEMBLY_PANEL_ID]);
          // mainStore.dispatch(
          //   setVolatileDocStateAction(DISASSEMBLY_PANEL_ID, !volatileDocs[DISASSEMBLY_PANEL_ID])
          // );
        }
      },
      { type: "separator" },
      ...specificIdeMenus,
      { type: "separator" },
      {
        type: "submenu",
        id: "ide_settings",
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
    specificIdeMenus = machineMenus.helpItems(
      {
        emuWindow,
        ideWindow
      },
      currentMachine,
      currentModel
    );
  }

  const helpLinks: MenuItemConstructorOptions[] = (machineMenus?.helpLinks ?? []).map(hl => {
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
    id: "help_menu",
    label: "Help",
    submenu: [
      {
        id: "help_about",
        label: "About",
        click: async () => {
          const result = await dialog.showMessageBox(state.ideFocused ? ideWindow : emuWindow, {
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
        id: "help_home_page",
        label: "Klive IDE Home Page",
        click: () => shell.openExternal(KLIVE_GITHUB_PAGES)
      },
      { type: "separator" },
      {
        id: "help_show_welcome",
        label: "Welcome screen",
        click: () => {
          if (isIdeWindowFocused()) {
            // TODO: mainStore.dispatch(displayDialogAction(FIRST_STARTUP_DIALOG_IDE));
          } else {
            // TODO: mainStore.dispatch(displayDialogAction(FIRST_STARTUP_DIALOG_EMU));
          }
        }
      },
      { type: "separator" },
      ...specificHelpMenus,
      { type: "separator" },
      ...helpLinks
    ]
  });

  // --- Preserve the submenus as a dedicated array.
  const submenus = template.map(i => i.submenu);

  // --- Set the menu based on platform
  if (state.os === "darwin") {
    // --- On macOS, use a single application menu that applies to all windows
    // --- Determine which window is currently focused to apply the correct menu state
    const windowFocused = state.emuFocused ? emuWindow : ideWindow;
    if (!windowFocused.isDestroyed()) {
      // --- Transform the template based on the focused window and set as application menu
      template.forEach(templateTransform(windowFocused));
      Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    }
  } else {
    // --- On Windows/Linux, each window has its own menu bar
    // --- Set menu for emulator window if it exists and is not destroyed
    if (emuWindow && !emuWindow.isDestroyed()) {
      template.forEach(templateTransform(emuWindow));
      emuWindow.setMenu(Menu.buildFromTemplate(template));
    }
    // --- Set menu for IDE window if it exists and is not destroyed
    if (ideWindow && !ideWindow.isDestroyed()) {
      template.forEach(templateTransform(ideWindow));
      ideWindow.setMenu(Menu.buildFromTemplate(template));
    }
  }

  /**
   * Transforms menu template based on window focus state
   * @param wnd The target browser window
   * @returns Transform function that either shows full submenus (focused) or hides them (unfocused)
   */
  function templateTransform(wnd: BrowserWindow) {
    return wnd.isFocused()
      ? (
          // --- Window is focused: show full submenu content
          i: { submenu: Electron.MenuItemConstructorOptions[] | Electron.Menu },
          idx: string | number
        ) => (i.submenu = submenus[idx])
      : (
          // --- Window is not focused: hide submenu content
          i: { submenu: null }
        ) => (i.submenu = null);
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
}

function filterVisibleItems<T extends MenuItemConstructorOptions | MenuItem>(items: T[]): T[] {
  return items.filter(i => i.visible !== false);
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
    click: mi => {
      setSettingValue(settingsId, mi.checked);
    }
  };
}
