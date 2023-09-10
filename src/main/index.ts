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

import * as path from "path";
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
  isWindowsAction,
  unloadWindowsAction
} from "../common/state/actions";
import { Unsubscribe } from "../common/state/redux-light";
import { app, BrowserWindow, shell, ipcMain, Menu } from "electron";
import { release } from "os";
import { join } from "path";
import { setupMenu } from "./app-menu";
import { __WIN32__ } from "../electron/electron-utils";
import { processRendererToMainMessages } from "./RendererToMainProcessor";
import { setMachineType } from "./machines";
import { mainStore } from "./main-store";
import { registerMainToEmuMessenger } from "../common/messaging/MainToEmuMessenger";
import { registerMainToIdeMessenger, sendFromMainToIde } from "../common/messaging/MainToIdeMessenger";
import { appSettings, loadAppSettings, saveAppSettings } from "./settings";
import { createWindowStateManager } from "./WindowStateManager";
import { registerCompiler } from "./compiler-integration/compiler-registry";
import { Z80Compiler } from "./z80-compiler/Z80Compiler";

// --- We use the same index.html file for the EMU and IDE renderers. The UI receives a parameter to
// --- determine which UI to display
const EMU_QP = "?emu"; // EMU discriminator
const IDE_QP = "?ide"; // IDE discriminator

// --- Let's prepare the environment variables
process.env.DIST_ELECTRON = join(__dirname, "../..");
process.env.DIST = join(process.env.DIST_ELECTRON, "dist");
process.env.PUBLIC = app.isPackaged
  ? process.env.DIST
  : join(process.env.DIST_ELECTRON, "public");

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

loadAppSettings();

// --- Hold references to the renderer windows
let ideWindow: BrowserWindow | null = null;
let emuWindow: BrowserWindow | null = null;

// --- Sign if closing the IDE window is allowed
let allowCloseIde: boolean;

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
const homeDir = path.join(app.getPath("home"), "KliveProjects");
//fileChangeWatcher.startWatching(homeDir);

async function createAppWindows () {
  // --- Reset renderer window flags used during re-activation
  machineTypeInitialized = false;
  allowCloseIde = false;

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

  // Rather than setting up the application menu we'll configure it per window.
  Menu.setApplicationMenu(null);
  // --- Prepare the main menu. Update items on application state change
  setupMenu(emuWindow, ideWindow);

  // --- Respond to state changes
  storeUnsubscribe = mainStore.subscribe(async () => {
    const state = mainStore.getState();
    const loaded = state.emuLoaded;
    if (loaded && !machineTypeInitialized) {
      // --- Set the default machine type to ZX Spectrum 48
      machineTypeInitialized = true;
      await setMachineType("sp48");

      // --- Set the flag indicating if we're using Windows
      mainStore.dispatch(isWindowsAction(__WIN32__));
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
  ideWindow.on("close", e => {
    if (allowCloseIde) {
      return;
    }
    e.preventDefault();
    ideWindow.hide();
    if (appSettings.windowStates) {
      appSettings.windowStates.showIdeOnStartup = false;
      saveAppSettings();
    }
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
  let ensureSavedBeforeQuit = () => {
    mainStore.dispatch(dimMenuAction(true));
    const finallyFn = () => {
      if (emuWindow?.isDestroyed() === false) {
        emuWindow.close();
      }
    };
    if (!ideWindow.isDestroyed()) {
      sendFromMainToIde({type: "IdeSaveAllBeforeQuit"})
        .finally(finallyFn);
    } else {
      finallyFn();
    }
  };
  emuWindow.on("close", e => {
    if (ensureSavedBeforeQuit) {
      e.preventDefault();
      ensureSavedBeforeQuit();
      ensureSavedBeforeQuit = null;
      return;
    }
    allowCloseIde = true;
    ideVisibleOnClose = !ideWindow.isDestroyed() && ideWindow.isVisible();
    if (!ideWindow.isDestroyed()) {
      ideWindow.close();
      ideWindow = null;
    }
  });
}

// --- Initialize the renderer windows whenever the app is ready to display them
app.whenReady().then(() => {
  createAppWindows();
});

// --- When the user is about to quit the app, allow closing the IDE window (otherwise, it gets only hidden and that
// --- behavior prevents the app from quitting).
app.on("before-quit", () => {
  allowCloseIde = true;
});

// --- Close all windows when requested so
app.on("window-all-closed", () => {
  storeUnsubscribe();
  ideWindow = null;
  emuWindow = null;
  allowCloseIde = true;
  if (process.platform !== "darwin") app.quit();
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
