import { app, BrowserWindow, ipcMain } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import {
  createEmulatorWindow,
  destroyEmulatorWindow,
  getEmulatorState,
  loadEmulatorContent,
  emuWindow
} from "./emulatorWindow";
import { 
  createIdeWindow, 
  destroyIdeWindow, 
  getIdeState, 
  loadIdeContent,
  ideWindow
} from "./ideWindow";
import { loadAppSettings, saveAppSettings, appSettings } from "./settingsManager";
import { initializeMainStore, mainStore } from "./mainStore";
import type { Action } from "@state/Action";
import {
  emuFocusedAction,
  ideFocusedAction,
  isWindowsAction,
  setOsAction,
  setAppPathAction,
  setGlobalSettingAction
} from "@state/actions";
import { setupMenu } from "./app-menu";

// Helper functions to send actions to renderers
function sendActionToEmu(action: Action, sourceProcess: string = "main"): void {
  if (emuWindow && !emuWindow.isDestroyed()) {
    emuWindow.webContents.send("ForwardActionToRenderer", {
      action,
      sourceProcess
    });
  }
}

function sendActionToIde(action: Action, sourceProcess: string = "main"): void {
  if (ideWindow && !ideWindow.isDestroyed()) {
    ideWindow.webContents.send("ForwardActionToRenderer", {
      action,
      sourceProcess
    });
  }
}

// Initialize main store with forwarders
initializeMainStore(sendActionToEmu, sendActionToIde);

// Track initialization state
let emulationSetupDone = false;
let globalSettingsRestored = false;

// Initialize OS and app path immediately (no need to wait for windows)
const isWindows = process.platform === "win32";
mainStore.dispatch(isWindowsAction(isWindows), "main");
mainStore.dispatch(setOsAction(process.platform), "main");
mainStore.dispatch(setAppPathAction(app.getAppPath()), "main");

/**
 * Sets up emulation when both windows are loaded - called only once
 */
function setupEmulation(): void {
  // TODO: Implement emulation setup logic
}

/**
 * Restores global settings from saved app settings - called only once after both windows are loaded
 */
function restoreGlobalSettings(): void {
  if (appSettings.globalSettings) {
    for (const [key, value] of Object.entries(appSettings.globalSettings)) {
      mainStore.dispatch(setGlobalSettingAction(key, value), "main");
    }
    console.log("Global settings restored");
  }
}

// Subscribe to store changes for menu updates and emulation setup
mainStore.subscribe(() => {
  const state = mainStore.getState();

  // Restore global settings once when both windows are loaded
  if (state.emuLoaded && state.ideLoaded && !globalSettingsRestored) {
    globalSettingsRestored = true;
    restoreGlobalSettings();
  }

  // Setup emulation once when both windows are loaded
  if (state.emuLoaded && state.ideLoaded && !emulationSetupDone) {
    emulationSetupDone = true;
    setupEmulation();
  }

  // Update menu whenever state changes using singleton windows
  if (emuWindow && ideWindow) {
    setupMenu(state);
  }
});

// Save all window states with timeout
async function saveAllStates(): Promise<void> {
  const saveTimeout = 3000;

  try {
    // Capture current window states
    const emulatorState = getEmulatorState();
    const ideState = getIdeState();

    // Capture global settings from main store
    const currentState = mainStore.getState();
    const globalSettings = currentState.globalSettings || {};

    // Update the global appSettings object
    if (!appSettings.windowStates) {
      appSettings.windowStates = {};
    }
    appSettings.windowStates.emuWindow = emulatorState;
    appSettings.windowStates.ideWindow = ideState;
    appSettings.globalSettings = globalSettings;

    // Save to disk with timeout
    await Promise.race([
      saveAppSettings(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Save timeout")), saveTimeout)
      )
    ]);

    console.log("All window states saved successfully");
  } catch (error) {
    console.error("Failed to save window states:", error);
  }
}

// Handle window close - called by both windows
async function handleWindowClose(): Promise<void> {
  // Save states before closing
  await saveAllStates();

  // Now close both windows
  destroyIdeWindow();
  destroyEmulatorWindow();

  // Quit the app
  app.quit();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron");

  // Load settings before creating windows
  await loadAppSettings();

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on("ping", () => console.log("pong"));

  // Create windows first (but don't load content yet)
  const emuWindow = createEmulatorWindow(handleWindowClose);
  const ideWindow = createIdeWindow(handleWindowClose);

  // Set up focus tracking for both windows
  emuWindow.on("focus", () => {
    mainStore.dispatch(emuFocusedAction(true), "main");
  });

  emuWindow.on("blur", () => {
    mainStore.dispatch(emuFocusedAction(false), "main");
  });

  ideWindow.on("focus", () => {
    mainStore.dispatch(ideFocusedAction(true), "main");
  });

  ideWindow.on("blur", () => {
    mainStore.dispatch(ideFocusedAction(false), "main");
  });

  // Set up IPC handler for forwarding Redux actions between renderers
  // This must be done AFTER windows are created but BEFORE content is loaded
  ipcMain.handle("ForwardAction", async (_event, data) => {
    const { action, sourceProcess } = data;

    // Dispatch to main store (which will update main state and forward to renderers)
    // Pass sourceProcess so the forwarder knows where it came from
    mainStore.dispatch(action, sourceProcess);
  });

  // Now that IPC infrastructure is ready, load the window contents
  loadEmulatorContent();
  loadIdeContent();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createEmulatorWindow(handleWindowClose);
      createIdeWindow(handleWindowClose);
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// Window state utility functions
export function isEmuWindowFocused(): boolean {
  return emuWindow ? !emuWindow.isDestroyed() && emuWindow.isFocused() : false;
}

export function isEmuWindowVisible(): boolean {
  return emuWindow ? !emuWindow.isDestroyed() && emuWindow.isVisible() : false;
}

export function isIdeWindowFocused(): boolean {
  return ideWindow ? !ideWindow.isDestroyed() && ideWindow.isFocused() : false;
}

export function isIdeWindowVisible(): boolean {
  return ideWindow ? !ideWindow.isDestroyed() && ideWindow.isVisible() : false;
}
