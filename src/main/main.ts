import { app, BrowserWindow, ipcMain, type Event as ElectronEvent } from "electron";
import path from "node:path";
import { registerMainToEmuMessenger } from "../common/messaging/MainToEmuMessenger";
import { registerMainToIdeMessenger } from "../common/messaging/MainToIdeMessenger";
import { type Channel, type RequestMessage } from "../common/messaging/messages-core";
import {
  emuFocusedAction,
  emuLoadedAction,
  emuSynchedAction,
  ideFocusedAction,
  ideLoadedAction,
  initGlobalSettingsAction,
  isWindowsAction,
  setAppPathAction,
  dimMenuAction
} from "../common/state/actions";
import { createWindowStateManager } from "./WindowStateManager";
import {
  startApplicationMenu,
  stopApplicationMenu,
  updateApplicationMenuWindows
} from "./app-menu";
import { mainStore } from "./main-store";
import { processRendererToMainMessages } from "./RendererToMainProcessor";
import {
  appSettings,
  applyPersistedSettingsToStore,
  loadAppSettings,
  saveAppSettings,
  startSettingsPersistence,
  stopSettingsPersistence
} from "./settings";

const SAVE_BEFORE_CLOSE_TIMEOUT_MS = 1000;

let emuWindow: BrowserWindow | null = null;
let ideWindow: BrowserWindow | null = null;
let closeRequestStarted = false;
let closeAllWindowsAllowed = false;
let saveRequestId = 0;

function getPreloadPath(): string {
  return path.join(__dirname, "../preload/preload.js");
}

async function loadRenderer(window: BrowserWindow, page: "emulator" | "ide"): Promise<void> {
  const appPath = app.isPackaged ? process.resourcesPath : app.getAppPath();

  if (process.env.ELECTRON_RENDERER_URL) {
    const rendererUrl = new URL(process.env.ELECTRON_RENDERER_URL);
    rendererUrl.searchParams.set("window", page);
    rendererUrl.searchParams.set("apppath", appPath);
    await window.loadURL(rendererUrl.toString());
    return;
  }

  await window.loadFile(path.join(__dirname, "../renderer/index.html"), {
    query: { window: page, apppath: appPath }
  });
}

function dispatchMainOwnedState(): void {
  const state = mainStore.getState();

  mainStore.dispatch(setAppPathAction(app.isPackaged ? process.resourcesPath : app.getAppPath()));
  mainStore.dispatch(isWindowsAction(process.platform === "win32"));
  mainStore.dispatch(initGlobalSettingsAction(state.globalSettings ?? {}));
  mainStore.dispatch(dimMenuAction(state.dimMenu ?? false));
  mainStore.dispatch(emuFocusedAction(emuWindow?.isFocused() ?? false));
  mainStore.dispatch(ideFocusedAction(ideWindow?.isFocused() ?? false));
}

function requestRendererSaveBeforeClose(window: BrowserWindow | null): Promise<void> {
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) {
    return Promise.resolve();
  }

  const requestId = `${Date.now()}-${++saveRequestId}`;
  const responseChannel = `window:save-before-close-complete:${requestId}`;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      ipcMain.removeAllListeners(responseChannel);
      resolve();
    }, SAVE_BEFORE_CLOSE_TIMEOUT_MS);

    ipcMain.once(responseChannel, () => {
      clearTimeout(timeout);
      resolve();
    });

    try {
      window.webContents.send("window:save-before-close", requestId);
    } catch {
      clearTimeout(timeout);
      ipcMain.removeAllListeners(responseChannel);
      resolve();
    }
  });
}

async function closeAllWindows(): Promise<void> {
  if (closeRequestStarted) {
    return;
  }

  closeRequestStarted = true;

  await Promise.all([
    requestRendererSaveBeforeClose(emuWindow),
    requestRendererSaveBeforeClose(ideWindow)
  ]);

  closeAllWindowsAllowed = true;

  for (const window of [emuWindow, ideWindow]) {
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }

  app.quit();
}

function handleWindowClose(event: ElectronEvent): void {
  if (closeAllWindowsAllowed) {
    return;
  }

  event.preventDefault();
  void closeAllWindows();
}

async function createEmulatorWindow(): Promise<void> {
  const emuWindowStateManager = createWindowStateManager(appSettings.windowStates?.emuWindow, {
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

  emuWindow = new BrowserWindow({
    x: emuWindowStateManager.x,
    y: emuWindowStateManager.y,
    width: emuWindowStateManager.width,
    height: emuWindowStateManager.height,
    minWidth: 640,
    minHeight: 480,
    title: "Emulator",
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  emuWindow.on("close", handleWindowClose);

  emuWindow.on("focus", () => {
    mainStore.dispatch(emuFocusedAction(true), "main");
  });

  emuWindow.on("blur", () => {
    mainStore.dispatch(emuFocusedAction(false), "main");
  });

  emuWindow.on("closed", () => {
    mainStore.dispatch(emuFocusedAction(false), "main");
    emuWindow = null;
    updateApplicationMenuWindows(emuWindow, ideWindow);
  });

  emuWindowStateManager.manage(emuWindow);
  registerMainToEmuMessenger(emuWindow);
  updateApplicationMenuWindows(emuWindow, ideWindow);

  await loadRenderer(emuWindow, "emulator");
  mainStore.dispatch(emuLoadedAction());
  dispatchMainOwnedState();
  mainStore.dispatch(emuSynchedAction());
}

async function createIdeWindow(): Promise<void> {
  if (ideWindow) {
    ideWindow.focus();
    return;
  }

  const ideWindowStateManager = createWindowStateManager(appSettings.windowStates?.ideWindow, {
    defaultWidth: 640,
    defaultHeight: 480,
    maximize: false,
    fullScreen: false,
    stateSaver: (state) => {
      appSettings.windowStates ??= {};
      appSettings.windowStates.ideWindow = state;
      saveAppSettings();
    }
  });

  ideWindow = new BrowserWindow({
    x: ideWindowStateManager.x,
    y: ideWindowStateManager.y,
    width: ideWindowStateManager.width,
    height: ideWindowStateManager.height,
    minWidth: 640,
    minHeight: 480,
    title: "IDE",
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  ideWindow.on("close", handleWindowClose);

  ideWindow.on("focus", () => {
    mainStore.dispatch(ideFocusedAction(true), "main");
  });

  ideWindow.on("blur", () => {
    mainStore.dispatch(ideFocusedAction(false), "main");
  });

  ideWindow.on("closed", () => {
    mainStore.dispatch(ideFocusedAction(false), "main");
    ideWindow = null;
    updateApplicationMenuWindows(emuWindow, ideWindow);
  });

  ideWindowStateManager.manage(ideWindow);
  registerMainToIdeMessenger(ideWindow);
  updateApplicationMenuWindows(emuWindow, ideWindow);

  await loadRenderer(ideWindow, "ide");
  mainStore.dispatch(ideLoadedAction());
  dispatchMainOwnedState();
}

function registerRendererToMainIpc(): void {
  registerRendererToMainChannel("EmuToMain", "EmuToMainResponse");
  registerRendererToMainChannel("IdeToMain", "IdeToMainResponse");
}

function registerRendererToMainChannel(requestChannel: Channel, responseChannel: Channel): void {
  ipcMain.on(requestChannel, async (event, message: RequestMessage) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const response = window
      ? await processRendererToMainMessages(message, window)
      : {
          type: "ErrorResponse" as const,
          message: "Sender window is not available."
        };

    event.sender.send(responseChannel, {
      ...response,
      correlationId: message.correlationId
    });
  });
}

app.whenReady().then(async () => {
  loadAppSettings();
  applyPersistedSettingsToStore();
  startSettingsPersistence();
  registerRendererToMainIpc();
  ipcMain.handle("ide:open", createIdeWindow);
  await createEmulatorWindow();
  if (emuWindow) {
    startApplicationMenu(emuWindow, () => ideWindow, createIdeWindow);
  }

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createEmulatorWindow();
    }
  });
});

app.on("before-quit", () => {
  saveAppSettings();
  stopApplicationMenu();
  stopSettingsPersistence();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    saveAppSettings();
    app.quit();
  }
});
