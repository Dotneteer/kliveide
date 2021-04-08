// ============================================================================
// The startup file of the main Electron process
// ============================================================================

// eslint-disable-next-line import/no-extraneous-dependencies
import { BrowserWindow, app, ipcMain } from "electron";
import { forwardRendererState } from "./mainStore";
import { MAIN_STATE_REQUEST_CHANNEL } from "../shared/messaging/channels";
import { ForwardActionRequest } from "../shared/messaging/message-types";
import {
  setupMenu,
  setupWindows,
  watchStateChanges,
} from "./app-menu-state";

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () => {
  await setupWindows();
  setupMenu();
  watchStateChanges();
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
