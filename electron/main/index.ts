import {
  defaultResponse,
  RequestMessage,
  ResponseMessage
} from "../../common/messaging/messages-core";
import {
  emuFocusedAction,
  ideFocusedAction,
  isWindowsAction,
  unloadWindowsAction
} from "../../common/state/actions";
import { Unsubscribe } from "@state/redux-light";
import { app, BrowserWindow, shell, ipcMain } from "electron";
import { release } from "os";
import { join } from "path";
import { setupMenu } from "../app-menu";
import { __WIN32__ } from "../electron-utils";
import { processRendererToMainMessages } from "../RendererToMainProcessor";
import { setMachineType } from "../machines";
import { mainStore } from "../main-store";
import { registerMainToEmuMessenger } from "../../common/messaging/MainToEmuMessenger";
import { registerMainToIdeMessenger } from "../../common/messaging/MainToIdeMessenger";

// --- We use the same index.html file for the EMU and IDE renderers. The UI receives a parameter to
// --- determine which UI to display
const EMU_QP = "?emu"; // EMU discriminator
const IDE_QP = "?ide"; // IDE discriminator

process.env.DIST_ELECTRON = join(__dirname, "../..");
process.env.DIST = join(process.env.DIST_ELECTRON, "../dist");
process.env.PUBLIC = app.isPackaged
  ? process.env.DIST
  : join(process.env.DIST_ELECTRON, "../public");

// Disable GPU Acceleration for Windows 7
if (release().startsWith("6.1")) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let ideWindow: BrowserWindow | null = null;
let emuWindow: BrowserWindow | null = null;
let storeUnsubscribe: Unsubscribe | undefined;
let machineTypeInitialized = false;

// Here, you can also use other preload
const preload = join(__dirname, "../preload/index.js");
const emuDevUrl = process.env.VITE_DEV_SERVER_URL + EMU_QP;
const ideDevUrl = process.env.VITE_DEV_SERVER_URL + IDE_QP;
const indexHtml = join(process.env.DIST, "index.html");

async function createAppWindows () {
  // --- Create the EMU window
  emuWindow = new BrowserWindow({
    title: "Emu window",
    icon: join(process.env.PUBLIC, "favicon.svg"),
    minWidth: 640,
    minHeight: 480,
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // --- Create the IDE window
  ideWindow = new BrowserWindow({
    title: "Ide window",
    icon: join(process.env.PUBLIC, "favicon.svg"),
    minWidth: 640,
    minHeight: 480,
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false
    },
    show: true
  });

  // --- Initialize messaging
  registerMainToEmuMessenger(emuWindow);
  registerMainToIdeMessenger(ideWindow);

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

  // --- Load the contents of the browser windows
  if (process.env.VITE_DEV_SERVER_URL) {
    emuWindow.loadURL(emuDevUrl);
    emuWindow.webContents.openDevTools();
    ideWindow.loadURL(ideDevUrl);
    ideWindow.webContents.openDevTools();
  } else {
    emuWindow.loadFile(indexHtml, {
      search: EMU_QP
    });
    ideWindow.loadFile(indexHtml, {
      search: IDE_QP
    });
  }

  // Test actively push message to the Electron-Renderer
  ideWindow.webContents.on("did-finish-load", () => {
    ideWindow?.webContents.send(
      "main-process-message",
      new Date().toLocaleString()
    );
  });

  // Make all links open with the browser, not with the application
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

  // Test actively push message to the Electron-Renderer
  emuWindow.webContents.on("did-finish-load", () => {
    emuWindow?.webContents.send(
      "main-process-message",
      new Date().toLocaleString()
    );
  });

  // Make all links open with the browser, not with the application
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
}

app.whenReady().then(() => {
  createAppWindows();
});

app.on("window-all-closed", () => {
  storeUnsubscribe();
  ideWindow = null;
  if (process.platform !== "darwin") app.quit();
});

app.on("second-instance", () => {
  if (ideWindow) {
    // Focus on the main window if the user tried to open another
    if (ideWindow.isMinimized()) ideWindow.restore();
    ideWindow.focus();
  }
});

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    for (let i = allWindows.length - 1; i >= 0; i--) {
      allWindows[i].focus();
    }
  } else {
    // --- Let's initialize the machine type again after creating the window
    mainStore.dispatch(unloadWindowsAction());
    machineTypeInitialized = false;
    createAppWindows();
  }
});

// --- This channel processes emulator requests and sends the results back
ipcMain.on("EmuToMain", async (_ev, msg: RequestMessage) => {
  let response = await forwardActions(msg);
  if (response === null) {
    response = await processRendererToMainMessages(msg, emuWindow);
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
    response = await processRendererToMainMessages(msg, ideWindow);
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
