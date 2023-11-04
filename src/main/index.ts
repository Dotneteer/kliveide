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

import {
  defaultResponse,
  errorResponse,
  RequestMessage,
  ResponseMessage
} from "../common/messaging/messages-core";
import {
  dimMenuAction,
  emuFocusedAction,
  ideFocusedAction,
  saveUserSettingAction,
  isWindowsAction,
  unloadWindowsAction,
  setClockMultiplierAction,
  setSoundLevelAction,
  setThemeAction,
  showKeyboardAction,
  setFastLoadAction,
  setTapeFileAction
} from "../common/state/actions";
import { Unsubscribe } from "../common/state/redux-light";
import { app, BrowserWindow, shell, ipcMain, Menu } from "electron";
import { release } from "os";
import { join } from "path";
import { setSelectedTapeFile, setupMenu } from "./app-menu";
import { __WIN32__ } from "../electron/electron-utils";
import { processRendererToMainMessages } from "./RendererToMainProcessor";
import { mainStore } from "./main-store";
import { registerMainToEmuMessenger } from "../common/messaging/MainToEmuMessenger";
import {
  registerMainToIdeMessenger,
  sendFromMainToIde
} from "../common/messaging/MainToIdeMessenger";
import { appSettings, loadAppSettings, saveAppSettings } from "./settings";
import { createWindowStateManager } from "./WindowStateManager";
import { registerCompiler } from "./compiler-integration/compiler-registry";
import { Z80Compiler } from "./z80-compiler/Z80Compiler";
import { setMachineType } from "./registeredMachines";
import { ZxBasicCompiler } from "./zxb-integration/ZxBasicCompiler";

// --- We use the same index.html file for the EMU and IDE renderers. The UI receives a parameter to
// --- determine which UI to display
const EMU_QP = "?emu"; // EMU discriminator
const IDE_QP = "?ide"; // IDE discriminator

// --- Let's prepare the environment variables
process.env.DIST_ELECTRON = join(__dirname, "../..");
process.env.DIST = join(process.env.DIST_ELECTRON, "dist");
process.env.PUBLIC = app.isPackaged
  ? process.env.DIST
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

// --- Register available compilers
registerCompiler(new Z80Compiler());
registerCompiler(new ZxBasicCompiler());

loadAppSettings();

// --- Hold references to the renderer windows
let ideWindow: BrowserWindow | null = null;
let emuWindow: BrowserWindow | null = null;

// --- Sign if closing the IDE window is allowed
let allowCloseIde: boolean;
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
const emuDevUrl = process.env.VITE_DEV_SERVER_URL + EMU_QP;
const ideDevUrl = process.env.VITE_DEV_SERVER_URL + IDE_QP;
const indexHtml = join(process.env.DIST, "index.html");

// --- Start watching file changes
// const homeDir = path.join(app.getPath("home"), "KliveProjects");
//fileChangeWatcher.startWatching(homeDir);

async function createAppWindows () {
  // --- Reset renderer window flags used during re-activation
  machineTypeInitialized = false;
  allowCloseIde = false;
  ideSaved = false;

  // --- Create state manager for the EMU window
  const emuWindowStateManager = createWindowStateManager(
    appSettings?.windowStates?.emuWindow,
    {
      defaultWidth: 640,
      defaultHeight: 480,
      maximize: true,
      fullScreen: true,
      stateSaver: state => {
        appSettings.windowStates = {
          ...appSettings.windowStates,
          emuWindow: state
        };
        saveAppSettings();
      }
    }
  );

  // --- Create the EMU window
  emuWindow = new BrowserWindow({
    title: "Emu window",
    icon: join(process.env.PUBLIC, "favicon.svg"),
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
      webSecurity: false
    }
  });

  emuWindowStateManager.manage(emuWindow);

  // --- Create state manager for the EMU window
  const ideWindowStateManager = createWindowStateManager(
    appSettings?.windowStates?.ideWindow,
    {
      defaultWidth: 640,
      defaultHeight: 480,
      maximize: false,
      fullScreen: false,
      stateSaver: state => {
        appSettings.windowStates = {
          ...appSettings.windowStates,
          ideWindow: state
        };
        saveAppSettings();
      }
    }
  );

  // --- Create the IDE window
  const showIde =
    ideVisibleOnClose || (appSettings?.windowStates?.showIdeOnStartup ?? false);
  const maximizeIde =
    showIde && (appSettings?.windowStates?.ideWindow?.isMaximized ?? false);
  ideWindow = new BrowserWindow({
    title: "Ide window",
    icon: join(process.env.PUBLIC, "favicon.svg"),
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
      webSecurity: false
    },
    show:
      ideVisibleOnClose || (appSettings.windowStates?.showIdeOnStartup ?? false)
  });

  ideWindowStateManager.manage(ideWindow);

  // --- Initialize messaging
  registerMainToEmuMessenger(emuWindow);
  registerMainToIdeMessenger(ideWindow);

  // --- Store initial user settings
  mainStore.dispatch(saveUserSettingAction(appSettings.userSettings));

  // --- Prepare the main menu. Update items on application state change
  Menu.setApplicationMenu(null);
  setupMenu(emuWindow, ideWindow);

  // --- Respond to state changes
  storeUnsubscribe = mainStore.subscribe(async () => {
    const state = mainStore.getState();
    const loaded = state.emuLoaded;
    if (loaded && !machineTypeInitialized) {
      // --- Sign machine initialization is done, so we do not run into this code again
      machineTypeInitialized = true;

      // --- Set the flag indicating if we're using Windows
      mainStore.dispatch(isWindowsAction(__WIN32__));

      // --- Set saved traits
      mainStore.dispatch(setThemeAction(appSettings.theme ?? "dark"));
      await setMachineType(appSettings.machineId ?? "sp48");
      mainStore.dispatch(
        setClockMultiplierAction(appSettings.clockMultiplier ?? 1)
      );
      mainStore.dispatch(setSoundLevelAction(appSettings.soundLevel ?? 0.5));
      mainStore.dispatch(showKeyboardAction(appSettings.showKeyboard ?? false));
      mainStore.dispatch(setFastLoadAction(appSettings.fastLoad ?? true));
      if (appSettings.lastTapeFile) {
        setSelectedTapeFile(appSettings.lastTapeFile, false, false);
      }
    }

    // --- Adjust menu items whenever the app state changes
    setupMenu(emuWindow, ideWindow);
  });

  // --- We use a little hack here. We pass the application path value in the query parameter
  // --- of the URL we pass to the browser windows. The IDE window will use this parameter to
  // --- initialize the Monaco editor as soon as the IDE app starts.
  const appPathParam = `&apppath=${encodeURI(app.getAppPath())}`;

  // --- Load the contents of the browser windows. Observe, we pass the application path parameter
  // --- to all URLs.
  if (process.env.VITE_DEV_SERVER_URL) {
    emuWindow.loadURL(emuDevUrl + appPathParam);
    ideWindow.loadURL(ideDevUrl + appPathParam);
  } else {
    emuWindow.loadFile(indexHtml, {
      search: EMU_QP + appPathParam
    });
    ideWindow.loadFile(indexHtml, {
      search: IDE_QP + appPathParam
    });
  }
  if (maximizeIde) {
    ideWindow.maximize();
  }

  // --- Test actively push message to the Electron-Renderer
  ideWindow.webContents.on("did-finish-load", () => {
    ideWindow?.webContents.send(
      "main-process-message",
      new Date().toLocaleString()
    );
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
  ideWindow.on("close", async e => {
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

    // --- Do not allow the IDE close, instead, hide it.
    e.preventDefault();
    ideWindow.hide();
    if (appSettings.windowStates) {
      // --- Make sure to save the last IDE settings
      appSettings.windowStates.showIdeOnStartup = false;
      saveAppSettings();
    }

    // --- IDE id hidden, so it's not focused
    mainStore.dispatch(ideFocusedAction(false));
  });

  // --- Test actively push message to the Electron-Renderer
  emuWindow.webContents.on("did-finish-load", () => {
    emuWindow?.webContents.send(
      "main-process-message",
      new Date().toLocaleString()
    );
  });

  // --- Make all links open with the browser, not with the application
  emuWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });

  // --- Sign when EMU is focused
  emuWindow.on("focus", () => {
    mainStore.dispatch(emuFocusedAction(true));
  });

  // --- Sign when EMU loses the focus
  emuWindow.on("blur", () => {
    mainStore.dispatch(emuFocusedAction(false));
  });

  // --- Close the emu window with the IDE window
  emuWindow.on("close", async e => {
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
  createAppWindows();
});

// --- When the user is about to quit the app, allow closing the IDE window
app.on("before-quit", async e => {
  allowCloseIde = true;
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
      response = errorResponse(err.toString);
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
      response = errorResponse(err.toString);
    }
  }
  response.correlationId = msg.correlationId;
  response.sourceId = "main";
  if (ideWindow?.isDestroyed() === false) {
    ideWindow.webContents.send("IdeToMainResponse", response);
  }
});

// --- Process an action forward message coming from any of the renderers
async function forwardActions (
  message: RequestMessage
): Promise<ResponseMessage | null> {
  if (message.type !== "ForwardAction") return null;
  mainStore.dispatch(message.action, message.sourceId);
  return defaultResponse();
}

async function saveOnClose () {
  mainStore.dispatch(dimMenuAction(true));
  await sendFromMainToIde({ type: "IdeSaveAllBeforeQuit" });
  ideSaved = true;
}
