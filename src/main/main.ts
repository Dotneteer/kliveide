import { app, BrowserWindow, ipcMain, type Event as ElectronEvent } from "electron";
import path from "node:path";
import { registerMainToEmuMessenger } from "../common/messaging/MainToEmuMessenger";
import { registerMainToIdeMessenger } from "../common/messaging/MainToIdeMessenger";
import { type Channel, type RequestMessage } from "../common/messaging/messages-core";
import { SETTING_EMU_STAY_ON_TOP, SETTING_IDE_CLOSE_EMU } from "../common/settings/setting-const";
import {
  emuFocusedAction,
  emuLoadedAction,
  emuSynchedAction,
  ideFocusedAction,
  ideLoadedAction,
  initGlobalSettingsAction,
  isWindowsAction,
  setAppPathAction,
  dimMenuAction,
  setThemeAction,
  setMachineTypeAction,
  setTapeMediaAction,
  clearTapeMediaAction,
  setClockMultiplierAction,
  setSoundLevelAction,
  setScreenRecordingAvailableAction,
  setKeyMappingsAction
} from "../common/state/actions";
import { createWindowStateManager } from "./WindowStateManager";
import {
  restorePersistedTapeFile,
  startApplicationMenu,
  stopApplicationMenu,
  updateApplicationMenuWindows
} from "./app-menu";
import { mainStore } from "./main-store";
import { processRendererToMainMessages } from "./RendererToMainProcessor";
import {
  appSettings,
  applyPersistedSettingsToStore,
  getSettingValue,
  loadAppSettings,
  saveAppSettings,
  startSettingsPersistence,
  stopSettingsPersistence
} from "./settings";
import { isFFmpegAvailable } from "./recording/ffmpegAvailable";

const SAVE_BEFORE_CLOSE_TIMEOUT_MS = 1000;
const EMULATOR_WINDOW_TITLE = "Klive Retro-Computer Emulator";
const IDE_WINDOW_TITLE = "Klive IDE";

let emuWindow: BrowserWindow | null = null;
let ideWindow: BrowserWindow | null = null;
let closeRequestStarted = false;
let closeAllWindowsAllowed = false;
let closeIdeWindowAllowed = false;
let ideStartupVisibilityHandledForQuit = false;
let saveRequestId = 0;
let emuWindowStateManager: ReturnType<typeof createWindowStateManager> | null = null;
let ideWindowStateManager: ReturnType<typeof createWindowStateManager> | null = null;
let lastStayOnTopValue: boolean | undefined;

function getPreloadPath(): string {
  return path.join(__dirname, "../preload/preload.js");
}

function keepWindowTitle(window: BrowserWindow, title: string): void {
  window.setTitle(title);
  window.on("page-title-updated", (event) => {
    event.preventDefault();
    window.setTitle(title);
  });
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
  mainStore.dispatch(setThemeAction(state.theme ?? "dark"));
  mainStore.dispatch(initGlobalSettingsAction(state.globalSettings ?? {}));
  if (state.emulatorState?.machineId) {
    mainStore.dispatch(
      setMachineTypeAction(
        state.emulatorState.machineId,
        state.emulatorState.modelId,
        state.emulatorState.config
      )
    );
  }
  mainStore.dispatch(setClockMultiplierAction(state.emulatorState?.clockMultiplier ?? 1));
  mainStore.dispatch(
    setSoundLevelAction(
      state.emulatorState?.soundLevel ?? 0.8,
      state.emulatorState?.savedSoundLevel ?? 0.8
    )
  );
  mainStore.dispatch(setScreenRecordingAvailableAction(isFFmpegAvailable()));
  if (state.media?.tape?.fileName) {
    mainStore.dispatch(setTapeMediaAction(state.media.tape));
  } else {
    mainStore.dispatch(clearTapeMediaAction());
  }
  mainStore.dispatch(setKeyMappingsAction(state.keyMappingFile, state.keyMappings));
  mainStore.dispatch(dimMenuAction(state.dimMenu ?? false));
  mainStore.dispatch(emuFocusedAction(emuWindow?.isFocused() ?? false));
  mainStore.dispatch(ideFocusedAction(ideWindow?.isFocused() ?? false));
}

function applyEmulatorStayOnTop(force = false): void {
  if (!emuWindow || emuWindow.isDestroyed()) {
    return;
  }
  const stayOnTop = !!getSettingValue(SETTING_EMU_STAY_ON_TOP);
  if (!force && lastStayOnTopValue === stayOnTop) {
    return;
  }
  lastStayOnTopValue = stayOnTop;
  emuWindow.setAlwaysOnTop(stayOnTop, process.platform === "linux" ? "normal" : undefined);
}

function rememberIdeStartupVisibility(isVisible: boolean): void {
  appSettings.windowStates ??= {};
  appSettings.windowStates.showIdeOnStartup = isVisible;
  saveAppSettings();
}

function saveManagedWindowStates(): void {
  emuWindowStateManager?.saveState(emuWindow ?? undefined);
  ideWindowStateManager?.saveState(ideWindow ?? undefined);
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

async function closeAllWindows(restoreIdeOnNextStart = !!ideWindow && !ideWindow.isDestroyed()): Promise<void> {
  if (closeRequestStarted) {
    return;
  }

  closeRequestStarted = true;

  await Promise.all([
    requestRendererSaveBeforeClose(emuWindow),
    requestRendererSaveBeforeClose(ideWindow)
  ]);

  rememberIdeStartupVisibility(restoreIdeOnNextStart);
  ideStartupVisibilityHandledForQuit = true;
  saveManagedWindowStates();
  closeAllWindowsAllowed = true;

  for (const window of [emuWindow, ideWindow]) {
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }

  app.quit();
}

async function closeIdeWindowOnly(): Promise<void> {
  if (!ideWindow || ideWindow.isDestroyed()) {
    return;
  }

  await requestRendererSaveBeforeClose(ideWindow);
  ideWindowStateManager?.saveState(ideWindow);
  rememberIdeStartupVisibility(false);
  closeIdeWindowAllowed = true;
  ideWindow.close();
  closeIdeWindowAllowed = false;
}

function handleEmuWindowClose(event: ElectronEvent): void {
  if (closeAllWindowsAllowed) {
    return;
  }

  event.preventDefault();
  void closeAllWindows();
}

function handleIdeWindowClose(event: ElectronEvent): void {
  if (closeAllWindowsAllowed || closeIdeWindowAllowed) {
    return;
  }

  event.preventDefault();

  if (getSettingValue(SETTING_IDE_CLOSE_EMU) !== false) {
    void closeAllWindows(true);
    return;
  }

  void closeIdeWindowOnly();
}

async function createEmulatorWindow(): Promise<void> {
  emuWindowStateManager = createWindowStateManager(appSettings.windowStates?.emuWindow, {
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
    title: EMULATOR_WINDOW_TITLE,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  keepWindowTitle(emuWindow, EMULATOR_WINDOW_TITLE);

  emuWindow.on("close", handleEmuWindowClose);

  emuWindow.on("focus", () => {
    mainStore.dispatch(emuFocusedAction(true), "main");
    if (process.platform === "linux") {
      applyEmulatorStayOnTop(true);
    }
  });

  emuWindow.on("blur", () => {
    mainStore.dispatch(emuFocusedAction(false), "main");
  });

  emuWindow.on("closed", () => {
    mainStore.dispatch(emuFocusedAction(false), "main");
    emuWindow = null;
    emuWindowStateManager = null;
    lastStayOnTopValue = undefined;
    updateApplicationMenuWindows(emuWindow, ideWindow);
  });

  emuWindowStateManager.manage(emuWindow);
  applyEmulatorStayOnTop(true);
  registerMainToEmuMessenger(emuWindow);
  updateApplicationMenuWindows(emuWindow, ideWindow);

  await loadRenderer(emuWindow, "emulator");
  mainStore.dispatch(emuLoadedAction());
  dispatchMainOwnedState();
  mainStore.dispatch(emuSynchedAction());
  await restorePersistedTapeFile();
}

async function createIdeWindow(): Promise<void> {
  if (ideWindow) {
    ideWindow.focus();
    return;
  }

  ideWindowStateManager = createWindowStateManager(appSettings.windowStates?.ideWindow, {
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
    title: IDE_WINDOW_TITLE,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  keepWindowTitle(ideWindow, IDE_WINDOW_TITLE);

  rememberIdeStartupVisibility(true);
  ideWindow.on("close", handleIdeWindowClose);

  ideWindow.on("focus", () => {
    mainStore.dispatch(ideFocusedAction(true), "main");
  });

  ideWindow.on("blur", () => {
    mainStore.dispatch(ideFocusedAction(false), "main");
  });

  ideWindow.on("closed", () => {
    mainStore.dispatch(ideFocusedAction(false), "main");
    ideWindow = null;
    ideWindowStateManager = null;
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
  mainStore.subscribe(() => applyEmulatorStayOnTop());
  registerRendererToMainIpc();
  ipcMain.handle("ide:open", createIdeWindow);
  await createEmulatorWindow();
  if (appSettings.windowStates?.showIdeOnStartup) {
    await createIdeWindow();
  }
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
  if (!ideStartupVisibilityHandledForQuit) {
    rememberIdeStartupVisibility(!!ideWindow && !ideWindow.isDestroyed());
  }
  saveManagedWindowStates();
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
