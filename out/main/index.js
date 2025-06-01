import { app, session, ipcMain, BrowserWindow, screen, shell } from "electron";
import { join } from "node:path";
import { promises } from "node:fs";
import { homedir } from "node:os";
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
let kliveSettings = {};
function getKliveSettingsPath() {
  const kliveFolder = join(homedir(), "Klive");
  return join(kliveFolder, "klive.settings");
}
async function loadKliveSettings() {
  try {
    const settingsPath = getKliveSettingsPath();
    const settingsData = await promises.readFile(settingsPath, "utf-8");
    kliveSettings = JSON.parse(settingsData);
    console.log("Klive settings loaded successfully");
  } catch (error) {
    console.log("No existing settings file found or error reading settings, using defaults");
    kliveSettings = {};
  }
}
async function saveKliveSettings() {
  try {
    if (emuWindow && !emuWindow.isDestroyed()) {
      const bounds = emuWindow.getBounds();
      const display = screen.getDisplayMatching(bounds);
      if (!kliveSettings.windowStates) {
        kliveSettings.windowStates = {};
      }
      kliveSettings.windowStates.emuWindow = {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        displayBounds: {
          x: display.bounds.x,
          y: display.bounds.y,
          width: display.bounds.width,
          height: display.bounds.height
        },
        isFullScreen: emuWindow.isFullScreen(),
        isMaximized: emuWindow.isMaximized()
      };
    }
    if (ideWindow && !ideWindow.isDestroyed()) {
      const bounds = ideWindow.getBounds();
      const display = screen.getDisplayMatching(bounds);
      if (!kliveSettings.windowStates) {
        kliveSettings.windowStates = {};
      }
      kliveSettings.windowStates.ideWindow = {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        displayBounds: {
          x: display.bounds.x,
          y: display.bounds.y,
          width: display.bounds.width,
          height: display.bounds.height
        },
        isFullScreen: ideWindow.isFullScreen(),
        isMaximized: ideWindow.isMaximized()
      };
    }
    const settingsPath = getKliveSettingsPath();
    const kliveFolder = join(homedir(), "Klive");
    await promises.mkdir(kliveFolder, { recursive: true });
    const settingsData = JSON.stringify(kliveSettings, null, 2);
    await promises.writeFile(settingsPath, settingsData, "utf-8");
    console.log("Klive settings saved successfully");
  } catch (error) {
    console.error("Error saving Klive settings:", error);
  }
}
function createEmulatorWindow() {
  const savedWindow = kliveSettings.windowStates?.emuWindow;
  const windowOptions = {
    width: savedWindow?.width || 800,
    height: savedWindow?.height || 600,
    title: "Klive Emulator",
    show: false,
    autoHideMenuBar: true,
    ...process.platform === "linux" ? { icon: join(__dirname, "../../resources/icon.png") } : {},
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  };
  if (savedWindow?.x !== void 0 && savedWindow?.y !== void 0) {
    windowOptions.x = savedWindow.x;
    windowOptions.y = savedWindow.y;
  }
  emuWindow = new BrowserWindow(windowOptions);
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
  emuWindow.on("closed", async () => {
    await saveKliveSettings();
    if (ideWindow && !ideWindow.isDestroyed()) {
      ideWindow.close();
    }
    emuWindow = null;
    app.quit();
  });
}
function createIDEWindow() {
  const savedWindow = kliveSettings.windowStates?.ideWindow;
  const windowOptions = {
    width: savedWindow?.width || 1200,
    height: savedWindow?.height || 800,
    title: "Klive IDE",
    show: false,
    autoHideMenuBar: true,
    ...process.platform === "linux" ? { icon: join(__dirname, "../../resources/icon.png") } : {},
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  };
  if (savedWindow?.x !== void 0 && savedWindow?.y !== void 0) {
    windowOptions.x = savedWindow.x;
    windowOptions.y = savedWindow.y;
  }
  ideWindow = new BrowserWindow(windowOptions);
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
  ideWindow.on("closed", async () => {
    await saveKliveSettings();
    if (emuWindow && !emuWindow.isDestroyed()) {
      emuWindow.close();
    }
    ideWindow = null;
    app.quit();
  });
}
function createWindows() {
  createEmulatorWindow();
  createIDEWindow();
}
app.whenReady().then(async () => {
  await loadKliveSettings();
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
app.on("window-all-closed", async () => {
  await saveKliveSettings();
  app.quit();
});
