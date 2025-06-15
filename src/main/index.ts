// ====================================================================================================================
// This file contains the startup code of the Klive application.
//
// This code creates two renderer processes with their corresponding windows:
// - `emuWindow`: Displays the emulator
// - `ideWindow`: Displays the IDE tools
//
// By default, only the EMU window is displayed. The app displays the IDE window whenever the user requests directly
// (with the Show IDE function) or indirectly (with any other menu commands that require the IDE).
//
// The app manages the communication among the three processes (main, emu, ide). The application state is synched;
// thus, if any of these processes change the state, the actions causing the changes are sent to the other two
// processes.
//
// Both renderer processes load the same `index.html` file into their browsers. However, they add a parameter to let
// the renderer process know whether it functions as an emulator (`?emu` parameter) or as an IDE window (`?ide`
// parameter).
// ====================================================================================================================
import { app, shell, BrowserWindow, ipcMain, Menu } from "electron";

import fs from "fs";
import { release } from "os";
import { join } from "path";
import { is } from "@electron-toolkit/utils";

import {
  defaultResponse,
  errorResponse,
  RequestMessage,
  ResponseMessage
} from "@messaging/messages-core";
import {
  emuFocusedAction,
  ideFocusedAction,
  saveUserSettingAction,
  isWindowsAction,
  unloadWindowsAction,
  setClockMultiplierAction,
  setSoundLevelAction,
  setThemeAction,
  displayDialogAction,
  startScreenDisplayedAction,
  setKeyMappingsAction,
  setMachineSpecificAction,
  setMediaAction,
  initGlobalSettingsAction
} from "@state/actions";
import { Unsubscribe } from "@state/redux-light";
import { registerMainToEmuMessenger } from "@messaging/MainToEmuMessenger";
import { getIdeApi, registerMainToIdeMessenger } from "@messaging/MainToIdeMessenger";
import { createSettingsReader } from "@utils/SettingsReader";
import { FIRST_STARTUP_DIALOG_EMU } from "@messaging/dialog-ids";
import { MEDIA_TAPE } from "@common/structs/project-const";

import { setupMenu } from "./app-menu";
import { __WIN32__ } from "./electron-utils";
import { processRendererToMainMessages } from "./RendererToMainProcessor";
import { mainStore } from "./main-store";
import { createWindowStateManager } from "./WindowStateManager";
import { setMachineType } from "./registeredMachines";
import { parseKeyMappings } from "./key-mappings/keymapping-parser";
import { setSelectedTapeFile } from "./machine-menus/zx-specrum-menus";
import { processBuildFile } from "./build";
import { machineMenuRegistry } from "./machine-menus/machine-menu-registry";
import { SETTING_EMU_STAY_ON_TOP, SETTING_IDE_CLOSE_EMU } from "@common/settings/setting-const";
import { appSettings, getSettingValue, loadAppSettings, saveAppSettings } from "./settings-utils";

// --- We use the same index.html file for the EMU and IDE renderers. The UI receives a parameter to
// --- determine which UI to display
const EMU_QP = "?emu"; // EMU discriminator
const IDE_QP = "?ide"; // IDE discriminator
process.env.DIST_ELECTRON = join(__dirname, "../..");
process.env.DIST = join(process.env.DIST_ELECTRON, "dist");
process.env.PUBLIC = app.isPackaged
  ? process.resourcesPath
  : join(process.env.DIST_ELECTRON, "src/public");

// --- Disable GPU Acceleration for Windows 7
if (release().startsWith("6.1")) app.disableHardwareAcceleration();

// --- Set application name for Windows 10+ notifications
if (__WIN32__) app.setAppUserModelId(app.getName());

// --- Make sure, only one instance is running
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

loadAppSettings();

// --- Store initial user settings
mainStore.dispatch(saveUserSettingAction(appSettings.userSettings));

// --- Get seeting used
const settingsReader = createSettingsReader(mainStore.getState());
const allowDevTools = !!settingsReader.readSetting("devTools.allow");
const displayIdeDevTools = !!settingsReader.readSetting("devTools.ide") && allowDevTools;
const displayEmuDevTools = !!settingsReader.readSetting("devTools.emu") && allowDevTools;

// --- Copy workers to the public Klive folder
// const workerDestFolder = path.join(app.getPath("home"), KLIVE_HOME_FOLDER);
// if (!fs.existsSync(workerDestFolder)) {
//   fs.mkdirSync(workerDestFolder, { recursive: true });
// }
// const workerFile = path.join(workerDestFolder, COMPILER_WORKER_FILE + ".js");
// if (fs.existsSync(workerFile)) {
//   fs.unlinkSync(workerFile); // Remove the file if it exists
// }
// // --- Copy the Worker file from the public resources
// const sourceWorkerFile = path.join(process.env.PUBLIC, "workers", COMPILER_WORKER_FILE + ".js");
// if (fs.existsSync(sourceWorkerFile) && fs.statSync(sourceWorkerFile).isFile()) {
//   fs.copyFileSync(sourceWorkerFile, workerFile);
// }

// --- Remove the chunck folder, if it exists
// const chunkFolder = path.join(workerDestFolder, "chunks");
// if (fs.existsSync(chunkFolder) && fs.statSync(chunkFolder).isDirectory()) {
//   fs.rmSync(chunkFolder, { recursive: true, force: true });
// }
// const sourceChunksFolder = path.join(process.env.PUBLIC, "workers", "chunks");
// if (fs.existsSync(sourceChunksFolder) && fs.statSync(sourceChunksFolder).isDirectory()) {
//   // --- Copy all files from the source chunks folder
//   fs.readdirSync(sourceChunksFolder).forEach((file) => {
//     const sourceFile = path.join(sourceChunksFolder, file);
//     const destFile = path.join(workerDestFolder, "chunks", file);
//     if (fs.statSync(sourceFile).isFile()) {
//       fs.copyFileSync(sourceFile, destFile);
//     }
//   });
// }

// --- Hold references to the renderer windows
let ideWindow: BrowserWindow | null = null;
let emuWindow: BrowserWindow | null = null;

// --- Sign if closing the IDE window is allowed
let allowCloseIde: boolean;
let ideWindowStateSaved = false;
let ideSaved: boolean;

// --- Flag indicating if any virtual machine has been initialized
let machineTypeInitialized: boolean;

// --- Flag indicating the visibility of the IDE window when the EMU window was closed.
// --- By default, the IDE window is created, loaded. However, it remains hidden.
let ideVisibleOnClose = false;

// --- Unsubscribe function for the store state change subscription
let storeUnsubscribe: Unsubscribe | undefined;

// --- URLs/URIs for the EMU and IDE windows
const preload = join(__dirname, "../preload/index.js");

// --- Store the latest build menu version to detect changes
let lastBuildMenuVersion = 0;

async function initializeMachineTypes() {
  Object.entries(machineMenuRegistry).forEach(async ([_, machine]) => {
    await machine.initializer?.();
  });
}

// --- Prepare the application windows
async function createAppWindows() {
  // --- Reset renderer window flags used during re-activation
  machineTypeInitialized = false;
  allowCloseIde = false;
  ideSaved = false;

  // --- Create state manager for the EMU window
  const emuWindowStateManager = createWindowStateManager(appSettings?.windowStates?.emuWindow, {
    defaultWidth: 720,
    defaultHeight: 540,
    maximize: true,
    fullScreen: true,
    stateSaver: (state) => {
      appSettings.windowStates ??= {};
      appSettings.windowStates.emuWindow = state;
      saveAppSettings();
    }
  });

  // --- Create the EMU window
  emuWindow = new BrowserWindow({
    title: "Emu window",
    icon: join(process.env.PUBLIC, "images/klive-logo.png"),
    minWidth: 640,
    minHeight: 480,
    x: emuWindowStateManager.x,
    y: emuWindowStateManager.y,
    width: emuWindowStateManager.width,
    height: emuWindowStateManager.height,
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      backgroundThrottling: false
    }
  });
  if (displayEmuDevTools) {
    emuWindow.webContents.openDevTools();
  }

  emuWindowStateManager.manage(emuWindow);

  // --- Create state manager for the EMU window
  const ideWindowStateManager = createWindowStateManager(appSettings?.windowStates?.ideWindow, {
    defaultWidth: 640,
    defaultHeight: 480,
    maximize: false,
    fullScreen: false,
    stateSaver: (state) => {
      appSettings.windowStates ??= {};
      appSettings.windowStates.ideWindow = state;
      appSettings.windowStates.showIdeOnStartup = ideWindow.isVisible();
      saveAppSettings();
    }
  });

  // --- Create the IDE window
  const disableIde = process.argv.includes("--noide");
  const forceIde = process.argv.includes("--showide");
  const showIde =
    !disableIde &&
    (forceIde || ideVisibleOnClose || (appSettings?.windowStates?.showIdeOnStartup ?? false));
  const maximizeIde = showIde && (appSettings?.windowStates?.ideWindow?.isMaximized ?? false);
  ideWindow = new BrowserWindow({
    title: "Ide window",
    icon: join(process.env.PUBLIC, "images/klive-logo.png"),
    minWidth: 640,
    minHeight: 480,
    x: ideWindowStateManager.x,
    y: ideWindowStateManager.y,
    width: ideWindowStateManager.width,
    height: ideWindowStateManager.height,
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      backgroundThrottling: false
    },
    show: showIde
  });
  if (displayIdeDevTools && !!appSettings.windowStates?.showIdeOnStartup) {
    ideWindow.webContents.toggleDevTools();
  }

  ideWindowStateManager.manage(ideWindow);

  // --- Initialize messaging
  registerMainToEmuMessenger(emuWindow);
  registerMainToIdeMessenger(ideWindow);

  // --- Prepare the main menu. Update items on application state change
  Menu.setApplicationMenu(null);
  setupMenu(emuWindow, ideWindow);

  // --- Respond to state changes
  storeUnsubscribe = mainStore.subscribe(async () => {
    const state = mainStore.getState();

    if (state.emuLoaded && !machineTypeInitialized) {
      // --- Sign machine initialization is done, so we do not run into this code again
      machineTypeInitialized = true;

      // --- Set the flag indicating if we're using Windows
      mainStore.dispatch(isWindowsAction(__WIN32__));

      // --- Store all global settings
      mainStore.dispatch(initGlobalSettingsAction(appSettings.globalSettings ?? {}));

      // --- Set saved traits
      if (appSettings.startScreenDisplayed) {
        mainStore.dispatch(startScreenDisplayedAction());
      }
      mainStore.dispatch(setThemeAction(appSettings.theme ?? "dark"));

      // --- Update IDE Settings
      mainStore.dispatch(setMachineSpecificAction(appSettings.machineSpecific ?? {}));
      mainStore.dispatch(setClockMultiplierAction(appSettings.clockMultiplier ?? 1));
      mainStore.dispatch(setSoundLevelAction(appSettings.soundLevel ?? 0.5));
      Object.entries(appSettings.media).forEach(([key, value]) => {
        mainStore.dispatch(setMediaAction(key, value));
      });

      // --- At this point the machine can be initialized
      await setMachineType(
        appSettings.machineId ?? "sp48",
        appSettings.modelId,
        appSettings.config
      );
      if (appSettings.media[MEDIA_TAPE]) {
        setSelectedTapeFile(appSettings.media[MEDIA_TAPE]);
      }

      // --- Set key mappings
      if (appSettings.keyMappingFile) {
        try {
          const mappingSource = fs.readFileSync(appSettings.keyMappingFile, "utf8");
          const mappings = parseKeyMappings(mappingSource);
          mainStore.dispatch(setKeyMappingsAction(appSettings.keyMappingFile, mappings));
        } catch (err) {
          // --- Intentionally ignored
        }
      }

      if (!appSettings.startScreenDisplayed) {
        await new Promise((r) => setTimeout(r, 400));
        if (!appSettings.startScreenDisplayed) {
          mainStore.dispatch(displayDialogAction(FIRST_STARTUP_DIALOG_EMU));
        }
      }
    }

    // --- Handle build file version changes
    if (state.project?.hasBuildFile && state.project?.buildFileVersion !== lastBuildMenuVersion) {
      lastBuildMenuVersion = state.project?.buildFileVersion;
      (async () => await processBuildFile())();
    }

    // --- Manage the Stay on top for the emu window
    const isEmuOnTop = !!getSettingValue(SETTING_EMU_STAY_ON_TOP);
    if (isEmuOnTop && !emuWindow?.isAlwaysOnTop()) {
      emuWindow?.setAlwaysOnTop(true);
    } else if (!isEmuOnTop && emuWindow?.isAlwaysOnTop()) {
      emuWindow?.setAlwaysOnTop(false);
    }

    // --- Adjust menu items whenever the app state changes
    setupMenu(emuWindow, ideWindow);
  });

  // --- We use a little hack here. We pass the application path value in the query parameter
  // --- of the URL we pass to the browser windows. The IDE window will use this parameter to
  // --- initialize the Monaco editor as soon as the IDE app starts.
  const devAppPath = `&apppath=${encodeURI(app.getAppPath())}`;
  const prodAppPath = `&apppath=${process.resourcesPath}`;

  // --- HMR for renderer base on electron-vite cli.
  // --- Load the remote URL for development or the local html file for production.
  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  const prodUrl = join(__dirname, "../renderer/index.html");
  if (is.dev && devUrl) {
    emuWindow.loadURL(devUrl + EMU_QP + devAppPath);
    ideWindow.loadURL(devUrl + IDE_QP + devAppPath);
  } else {
    emuWindow.loadFile(prodUrl, {
      search: EMU_QP + prodAppPath
    });
    ideWindow.loadFile(prodUrl, {
      search: IDE_QP + prodAppPath
    });
  }

  if (maximizeIde) {
    ideWindow.maximize();
  }

  // --- Test actively push message to the Electron-Renderer
  ideWindow.webContents.on("did-finish-load", () => {
    ideWindow?.webContents.send("main-process-message", new Date().toLocaleString());
    if (appSettings.windowStates?.ideZoomFactor != undefined) {
      ideWindow.webContents.setZoomFactor(appSettings.windowStates?.ideZoomFactor ?? 1.0);
    }
  });

  // --- Make all links open with the browser, not with the application
  ideWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });

  // --- Sign when IDE is focused
  ideWindow.on("focus", () => {
    mainStore.dispatch(ideFocusedAction(true));
  });

  // --- Sign when IDE loses the focus
  ideWindow.on("blur", () => {
    mainStore.dispatch(ideFocusedAction(false));
  });

  // --- Do not close the IDE (unless exiting the app), only hide it
  ideWindow.on("close", async (e) => {
    const closeIde = getSettingValue(SETTING_IDE_CLOSE_EMU);

    if (ideWindow?.webContents) {
      appSettings.windowStates ??= {};
      appSettings.windowStates.ideZoomFactor = ideWindow.webContents.getZoomFactor();
    }
    if (allowCloseIde) {
      // --- The emu allows closing the IDE
      if (!ideSaved) {
        // --- Do not allow the ide close while IDE is not saved
        e.preventDefault();
        // --- Make sure all edited documents are saved
        await saveOnClose();

        // --- Try to close the IDE (provided, it's not disposed)
        ideWindow?.close();
      }
      return;
    }

    e.preventDefault();
    if (closeIde) {
      // --- Close the EMU window as well
      emuWindow?.close();
    } else {
      // --- Do not allow the IDE close, instead, hide it.
      ideWindow.hide();
      if (appSettings.windowStates && !ideWindowStateSaved) {
        // --- Make sure to save the last IDE settings
        appSettings.windowStates.showIdeOnStartup = false;
      }

      // --- IDE id hidden, so it's not focused
      mainStore.dispatch(ideFocusedAction(false));
    }
  });

  // --- Test actively push message to the Electron-Renderer
  emuWindow.webContents.on("did-finish-load", () => {
    emuWindow?.webContents.send("main-process-message", new Date().toLocaleString());
    // --- Set emu zoom factor
    if (appSettings.windowStates?.emuZoomFactor != undefined) {
      emuWindow.webContents.setZoomFactor(appSettings.windowStates?.emuZoomFactor ?? 1.0);
    }
  });

  // --- Make all links open with the browser, not with the application
  emuWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });

  // --- Sign when EMU is focused
  emuWindow.on("focus", () => {
    mainStore.dispatch(emuFocusedAction(true), "main");
  });

  // --- Sign when EMU loses the focus
  emuWindow.on("blur", () => {
    mainStore.dispatch(emuFocusedAction(false), "main");
  });

  // --- Close the emu window with the IDE window
  emuWindow.on("close", async (e) => {
    if (emuWindow?.webContents) {
      appSettings.windowStates ??= {};
      appSettings.windowStates.emuZoomFactor = emuWindow.webContents.getZoomFactor();
    }
    saveAppSettings();
    if (!ideSaved) {
      // --- Do not allow the emu close while IDE is not saved
      e.preventDefault();
      // --- Start saving the IDE and return back from event. The IDE will be still alive
      await saveOnClose();

      // --- Close both renderer windows (unless already disposed)
      allowCloseIde = true;
      ideWindow?.close();
      emuWindow.close();
    } else {
      // --- The IDE is saved, so the app can be closed.
      app.quit();
    }
  });
}

// --- Initialize the renderer windows whenever the app is ready to display them
app.whenReady().then(() => {
  initializeMachineTypes();
  createAppWindows();
});

// --- When the user is about to quit the app, allow closing the IDE window
app.on("before-quit", (_e) => {
  ideWindowStateSaved = true;
  saveAppSettings();
});

// --- Close all windows when requested so
app.on("window-all-closed", () => {
  storeUnsubscribe();
  ideWindow = null;
  emuWindow = null;
  app.quit();
});

// --- Focus on the main window if the user tried to open another
app.on("second-instance", () => {
  if (ideWindow) {
    if (ideWindow.isMinimized()) ideWindow.restore();
    ideWindow.focus();
  }
});

// --- Activate the windows either by displaying or re-creating them
app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    for (let i = allWindows.length - 1; i >= 0; i--) {
      allWindows[i].focus();
    }
  } else {
    // --- Let's initialize the machine type again after creating the window
    mainStore.dispatch(unloadWindowsAction());

    // --- Now, re-create the renderer windows
    createAppWindows();
  }
});

// https://www.electronjs.org/docs/latest/api/app#appsetaboutpaneloptionsoptions
// app.setAboutPanelOptions(...);

// --- This channel processes emulator requests and sends the results back
ipcMain.on("EmuToMain", async (_ev, msg: RequestMessage) => {
  let response = await forwardActions(msg);
  if (response === null) {
    try {
      response = await processRendererToMainMessages(msg, emuWindow);
    } catch (err) {
      response = errorResponse(err.toString());
    }
  }
  response.correlationId = msg.correlationId;
  response.sourceId = "main";
  if (emuWindow?.isDestroyed() === false) {
    emuWindow.webContents.send("EmuToMainResponse", response);
  }
});

// --- This channel processes ide requests and sends the results back
ipcMain.on("IdeToMain", async (_ev, msg: RequestMessage) => {
  let response = await forwardActions(msg);
  if (response === null) {
    try {
      response = await processRendererToMainMessages(msg, ideWindow);
    } catch (err) {
      response = errorResponse(err.toString());
    }
  }
  response.correlationId = msg.correlationId;
  response.sourceId = "main";
  if (ideWindow?.isDestroyed() === false) {
    ideWindow.webContents.send("IdeToMainResponse", response);
  }
});

// --- Process an action forward message coming from any of the renderers
async function forwardActions(message: RequestMessage): Promise<ResponseMessage | null> {
  if (message.type !== "ForwardAction") return null;
  mainStore.dispatch(message.action, message.sourceId);
  return defaultResponse();
}

async function saveOnClose() {
  await getIdeApi().saveAllBeforeQuit();
  ideSaved = true;
}

export function isEmuWindowFocused() {
  return (emuWindow?.isDestroyed() ?? false) === false && emuWindow.isFocused?.();
}

export function isEmuWindowVisible() {
  return (emuWindow?.isDestroyed() ?? false) === false && emuWindow.isVisible?.();
}

export function isIdeWindowFocused() {
  return (ideWindow?.isDestroyed() ?? false) === false && ideWindow.isFocused?.();
}

export function isIdeWindowVisible() {
  return (ideWindow?.isDestroyed() ?? false) === false && ideWindow.isVisible?.();
}
