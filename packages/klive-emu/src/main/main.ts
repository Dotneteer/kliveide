// eslint-disable-next-line import/no-extraneous-dependencies
import { BrowserWindow, app, ipcMain } from "electron";
import { EmuWindow } from "./EmuWindow";
import { IdeWindow } from "./IdeWindow";
import { forwardRendererState, registerEmuWindowForwarder, registerIdeWindowForwarder } from "./mainStore";
import { MAIN_STATE_REQUEST_CHANNEL } from "../shared/messaging/channels";
import { ForwardActionMessage, RequestMessage } from "../shared/messaging/message-types";

// --- Global reference to the mainwindow
let emuWindow: EmuWindow;
let ideWindow: IdeWindow;

/**
 * Sets up the main window
 */
function setupEmuWindow(): void {
  emuWindow = new EmuWindow();
  emuWindow.setupMenu();
  emuWindow.load();
  registerEmuWindowForwarder(emuWindow.window);
}

function setupIdeWindow(): void {
  ideWindow = new IdeWindow();
  ideWindow.hide();
  ideWindow.setupMenu();
  ideWindow.load();
  registerIdeWindowForwarder(ideWindow.window);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  setupEmuWindow();
  setupIdeWindow();
});

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    setupEmuWindow();
  }
});

ipcMain.on(MAIN_STATE_REQUEST_CHANNEL, (_ev, msg: ForwardActionMessage) => {
  forwardRendererState(msg);
});