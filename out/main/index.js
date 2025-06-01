import { app, session, ipcMain, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const is = {
  dev: !app.isPackaged
};
const platform = {
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
};
const electronApp = {
  setAppUserModelId(id) {
    if (platform.isWindows)
      app.setAppUserModelId(is.dev ? process.execPath : id);
  },
  setAutoLaunch(auto) {
    if (platform.isLinux)
      return false;
    const isOpenAtLogin = () => {
      return app.getLoginItemSettings().openAtLogin;
    };
    if (isOpenAtLogin() !== auto) {
      app.setLoginItemSettings({ openAtLogin: auto });
      return isOpenAtLogin() === auto;
    } else {
      return true;
    }
  },
  skipProxy() {
    return session.defaultSession.setProxy({ mode: "direct" });
  }
};
const optimizer = {
  watchWindowShortcuts(window, shortcutOptions) {
    if (!window)
      return;
    const { webContents } = window;
    const { escToCloseWindow = false, zoom = false } = shortcutOptions || {};
    webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown") {
        if (!is.dev) {
          if (input.code === "KeyR" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "KeyI" && (input.alt && input.meta || input.control && input.shift)) {
            event.preventDefault();
          }
        } else {
          if (input.code === "F12") {
            if (webContents.isDevToolsOpened()) {
              webContents.closeDevTools();
            } else {
              webContents.openDevTools({ mode: "undocked" });
              console.log("Open dev tool...");
            }
          }
        }
        if (escToCloseWindow) {
          if (input.code === "Escape" && input.key !== "Process") {
            window.close();
            event.preventDefault();
          }
        }
        if (!zoom) {
          if (input.code === "Minus" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "Equal" && input.shift && (input.control || input.meta))
            event.preventDefault();
        }
      }
    });
  },
  registerFramelessWindowIpc() {
    ipcMain.on("win:invoke", (event, action) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        if (action === "show") {
          win.show();
        } else if (action === "showInactive") {
          win.showInactive();
        } else if (action === "min") {
          win.minimize();
        } else if (action === "max") {
          const isMaximized = win.isMaximized();
          if (isMaximized) {
            win.unmaximize();
          } else {
            win.maximize();
          }
        } else if (action === "close") {
          win.close();
        }
      }
    });
  }
};
let emuWindow = null;
let ideWindow = null;
function createEmulatorWindow() {
  emuWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: "Klive Emulator",
    show: false,
    autoHideMenuBar: true,
    ...process.platform === "linux" ? { icon: join(__dirname, "../../resources/icon.png") } : {},
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  emuWindow.on("ready-to-show", () => {
    emuWindow?.show();
    emuWindow?.focus();
  });
  emuWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    emuWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/emulator/`);
  } else {
    emuWindow.loadFile(join(__dirname, "../renderer/emulator.html"));
  }
  emuWindow.on("closed", () => {
    emuWindow = null;
  });
}
function createIDEWindow() {
  ideWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Klive IDE",
    show: false,
    autoHideMenuBar: true,
    ...process.platform === "linux" ? { icon: join(__dirname, "../../resources/icon.png") } : {},
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  ideWindow.on("ready-to-show", () => {
    ideWindow?.show();
  });
  ideWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    ideWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/ide/`);
  } else {
    ideWindow.loadFile(join(__dirname, "../renderer/ide.html"));
  }
  ideWindow.on("closed", () => {
    ideWindow = null;
  });
}
function createWindows() {
  createEmulatorWindow();
  createIDEWindow();
}
app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.electron");
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });
  createWindows();
  app.on("activate", function() {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindows();
    }
  });
});
app.on("window-all-closed", () => {
  app.quit();
});
