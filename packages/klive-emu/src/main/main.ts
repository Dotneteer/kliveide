// ============================================================================
// The startup file of the main Electron process
// ============================================================================

// eslint-disable-next-line import/no-extraneous-dependencies
import { BrowserWindow, app, ipcMain } from "electron";
import { forwardRendererState, mainStore } from "./mainStore";
import {
  EMU_TO_MAIN_REQUEST_CHANNEL,
  EMU_TO_MAIN_RESPONSE_CHANNEL,
  IDE_TO_EMU_MAIN_REQUEST_CHANNEL,
  IDE_TO_EMU_MAIN_RESPONSE_CHANNEL,
  MAIN_STATE_REQUEST_CHANNEL,
} from "../shared/messaging/channels";
import { ForwardActionRequest } from "../shared/messaging/message-types";
import {
  emuMessenger,
  emuWindow,
  ideWindow,
  setupMenu,
  setupWindows,
  watchStateChanges,
} from "./app-menu-state";
import { appConfiguration, appSettings } from "./klive-configuration";
import {
  emuHideFrameInfoAction,
  emuHideKeyboardAction,
  emuHideStatusbarAction,
  emuHideToolbarAction,
  emuShowFrameInfoAction,
  emuShowKeyboardAction,
  emuShowStatusbarAction,
  emuShowToolbarAction,
} from "../shared/state/emu-view-options-reducer";
import { __WIN32__ } from "./electron-utils";
import { setWindowsAction } from "../shared/state/is-windows-reducer";
import { processEmulatorRequest, processIdeRequest } from "./process-messages";

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () => {
  // --- Is Klive running on Windows?
  await setupWindows();
  watchStateChanges();
  setupMenu();
  mainStore.dispatch(setWindowsAction(__WIN32__));

  // --- Set up application state according to saved settings
  if (appSettings) {
    const viewOptions = appSettings.viewOptions;
    if (viewOptions) {
      mainStore.dispatch(
        viewOptions.showToolbar
          ? emuShowToolbarAction()
          : emuHideToolbarAction()
      );
      mainStore.dispatch(
        viewOptions.showStatusbar
          ? emuShowStatusbarAction()
          : emuHideStatusbarAction()
      );
      mainStore.dispatch(
        viewOptions.showFrameInfo
          ? emuShowFrameInfoAction()
          : emuHideFrameInfoAction()
      );
      mainStore.dispatch(
        viewOptions.showKeyboard
          ? emuShowKeyboardAction()
          : emuHideKeyboardAction()
      );
    }
  }

  emuMessenger.sendMessage({
    type: "ForwardAppConfig",
    config: appConfiguration,
  });

  // --- Create the machine and set its state according to the saved settings
  const initialMachineType =
    appSettings?.machineType ?? appConfiguration?.machineType ?? "sp48";
  const settings = appSettings?.machineSpecific?.[initialMachineType];
  await emuWindow.requestMachineType(initialMachineType, undefined, settings);
});

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await setupWindows();
    setupMenu();
    watchStateChanges();
  }
});

app.on("before-quit", () => {
  emuWindow.saveAppSettings();
  ideWindow.allowClose = true;
});

// --- This channel forwards renderer state (Emu or IDE) to the other renderer (IDE or Emu)
ipcMain.on(MAIN_STATE_REQUEST_CHANNEL, (_ev, msg: ForwardActionRequest) => {
  forwardRendererState(msg);
});

// --- This channel processes requests arriving from the Emu process
ipcMain.on(
  EMU_TO_MAIN_REQUEST_CHANNEL,
  async (_ev, msg: ForwardActionRequest) => {
    const response = await processEmulatorRequest(msg);
    response.correlationId = msg.correlationId;
    emuWindow.window.webContents.send(EMU_TO_MAIN_RESPONSE_CHANNEL, response);
  }
);

// --- This channel processes requests arriving from the Emu process
ipcMain.on(
  IDE_TO_EMU_MAIN_REQUEST_CHANNEL,
  async (_ev, msg: ForwardActionRequest) => {
    const response = await processIdeRequest(msg);
    response.correlationId = msg.correlationId;
    ideWindow.window.webContents.send(IDE_TO_EMU_MAIN_RESPONSE_CHANNEL, response);
  }
);
