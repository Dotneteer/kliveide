// ============================================================================
// The startup file of the main Electron process
// ============================================================================

// eslint-disable-next-line import/no-extraneous-dependencies
import { BrowserWindow, app, ipcMain } from "electron";
import { forwardRendererState, mainStore } from "./mainStore";
import { MAIN_STATE_REQUEST_CHANNEL } from "../shared/messaging/channels";
import { ForwardActionRequest } from "../shared/messaging/message-types";
import {
  emuWindow,
  setupMenu,
  setupWindows,
  watchStateChanges,
} from "./app-menu-state";
import { KliveSettings } from "./klive-settings";

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () => {
  await setupWindows();
  setupMenu();
  watchStateChanges();
  emuWindow.requestMachineType("sp48");
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

ipcMain.on(MAIN_STATE_REQUEST_CHANNEL, (_ev, msg: ForwardActionRequest) => {
  forwardRendererState(msg);
});

  /**
   * Saves the current application settings
   */
  // function saveAppSettings(): void {
  //   const state = mainStore.getState();
  //   const emuSettings = state.emulatorPanel;
  //   const machineType = state.machineType.split("_")[0];
  //   const kliveSettings: KliveSettings = {
  //     machineType,
  //     viewOptions: {
  //       showToolbar: state.emuViewOptions.showToolbar,
  //       showFrameInfo: state.emuViewOptions.showFrameInfo,
  //       showKeyboard: state.emuViewOptions.showKeyboard,
  //       showStatusBar: state.emuViewOptions.showStatusBar,
  //       keyboardHeight: state.emuViewOptions.keyboardHeight,
  //     },
  //   };
  //   // if (this._machineContextProvider) {
  //   //   kliveSettings.machineSpecific = appSettings?.machineSpecific;
  //   //   if (!kliveSettings.machineSpecific) {
  //   //     kliveSettings.machineSpecific = {};
  //   //   }
  //   //   kliveSettings.machineSpecific[
  //   //     machineType
  //   //   ] = this._machineContextProvider.getMachineSpecificSettings();
  //   // }
  //   // saveKliveSettings(kliveSettings);
  //   // reloadSettings();
  // }

