import { app } from "electron";
import { AppWindow } from "./AppWindow";
import { startApiServer } from "../remote-api/api-server";
import { mainProcessStore } from "./mainProcessStore";
import { emulatorRequestTypeAction } from "../shared/state/redux-emulator-state";

// --- Global reference to the mainwindow
let mainWindow: AppWindow;

/**
 * Sets up the main window
 */
function setupAppWindow(): void {
  mainWindow = new AppWindow();
  mainWindow.setupMenu();
  mainWindow.load();
  // --- Start with the ZX Spectrum 48 model by default
  mainProcessStore.dispatch(emulatorRequestTypeAction("48")());

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
app.on("activate", () => {
  if (mainWindow === null) {
    setupAppWindow();
    startApiServer();
  }
});
