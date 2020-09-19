import { app, BrowserWindow } from "electron";
import { AppWindow } from "./AppWindow";
import { startApiServer } from "../remote-api/api-server";
import { mainProcessStore, createMainProcessStateAware } from "./mainProcessStore";
import { emulatorRequestTypeAction } from "../shared/state/redux-emulator-state";
import { appConfiguration } from "./klive-configuration";

// --- Global reference to the mainwindow
let mainWindow: AppWindow;

/**
 * Sets up the main window
 */
function setupAppWindow(): void {
  mainWindow = new AppWindow();
  mainWindow.setupMenu();
  mainWindow.load();

  // --- Start with the preconfigured ZX Spectrum model
  const startupType = appConfiguration?.machineType ?? "48";
  mainProcessStore.dispatch(emulatorRequestTypeAction(startupType)());
  mainWindow.startWatchingIde();
}

// --- This method will be called when Electron has finished
// --- initialization and is ready to create browser windows.
// --- Some APIs can only be used after this event occurs.
app.on("ready", () => {
  setupAppWindow();
  startApiServer();
});

// --- Quit when all windows are closed.
app.on("window-all-closed", () => {
  // --- On macOS it is common for applications and their menu bar
  // --- to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// --- On macOS it's common to re-create a window in the app when the
// --- dock icon is clicked and there are no other windows open.
// --- On macOS it's common to re-create a window in the app when the
// --- dock icon is clicked and there are no other windows open.
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    setupAppWindow();
  }
});

app.on("before-quit", () => {
  mainWindow.stopWatchingIde();
})