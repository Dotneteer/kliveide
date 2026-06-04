import { app, BrowserWindow, ipcMain, type Event as ElectronEvent } from "electron";
import path from "node:path";
import { createWindowStateManager } from "./WindowStateManager";
import { appSettings, loadAppSettings, saveAppSettings } from "./settings";

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
  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(`${process.env.ELECTRON_RENDERER_URL}/${page}.html`);
    return;
  }

  await window.loadFile(path.join(__dirname, "../renderer", `${page}.html`));
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

  emuWindow.on("closed", () => {
    emuWindow = null;
  });

  emuWindowStateManager.manage(emuWindow);

  await loadRenderer(emuWindow, "emulator");
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

  ideWindow.on("closed", () => {
    ideWindow = null;
  });

  ideWindowStateManager.manage(ideWindow);

  await loadRenderer(ideWindow, "ide");
}

app.whenReady().then(async () => {
  loadAppSettings();
  ipcMain.handle("ide:open", createIdeWindow);
  await createEmulatorWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createEmulatorWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
