import { app, shell, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import { I } from "nextra/dist/types-c8e621b7";

// --- We use the same index.html file for the EMU and IDE renderers. The UI receives a parameter to
// --- determine which UI to display
const EMU_QP = "?emu"; // EMU discriminator
const IDE_QP = "?ide"; // IDE discriminator

function createWindow(message: string): BrowserWindow {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (is.dev && devUrl) {
    console.log(devUrl);
    mainWindow.loadURL(devUrl + message);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"), {
      search: message
    });
  }

  return mainWindow;
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron");

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on("ping", () => console.log("pong"));

  // --- We use a little hack here. We pass the application path value in the query parameter
  // --- of the URL we pass to the browser windows. The IDE window will use this parameter to
  // --- initialize the Monaco editor as soon as the IDE app starts.
  const appPathParam = `&apppath=${encodeURI(app.getAppPath())}`;

  let emu = createWindow(EMU_QP + appPathParam);
  let ide = createWindow(IDE_QP + appPathParam);

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      emu = createWindow(EMU_QP + appPathParam);
      ide = createWindow(IDE_QP + appPathParam);
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
