import { app, shell, BrowserWindow, screen } from "electron";
import { join } from "node:path";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import type { KliveSettings } from "../common/abstractions/KliveSettings";

let emuWindow: BrowserWindow | null = null;
let ideWindow: BrowserWindow | null = null;
let kliveSettings: KliveSettings = {};

// --- Get the path to the Klive settings folder and file
function getKliveSettingsPath(): string {
  const kliveFolder = join(homedir(), "Klive");
  return join(kliveFolder, "klive.settings");
}

// --- Load Klive settings from the settings file
async function loadKliveSettings(): Promise<void> {
  try {
    const settingsPath = getKliveSettingsPath();
    const settingsData = await fs.readFile(settingsPath, "utf-8");
    kliveSettings = JSON.parse(settingsData) as KliveSettings;
    console.log("Klive settings loaded successfully");
  } catch (error) {
    console.log(
      "No existing settings file found or error reading settings, using defaults"
    );
    kliveSettings = {};
  }
}

// --- Save window state to settings
function saveWindowState(
  window: BrowserWindow,
  windowKey: "emuWindow" | "ideWindow"
): void {
  if (window && !window.isDestroyed()) {
    const bounds = window.getBounds();
    const display = screen.getDisplayMatching(bounds);

    if (!kliveSettings.windowStates) {
      kliveSettings.windowStates = {};
    }

    kliveSettings.windowStates[windowKey] = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      displayBounds: {
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
      },
      isFullScreen: window.isFullScreen(),
      isMaximized: window.isMaximized(),
    };
  }
}

// --- Save Klive settings to the settings file
async function saveKliveSettings(): Promise<void> {
  try {
    // --- Update window states before saving
    if (emuWindow && !emuWindow.isDestroyed()) {
      saveWindowState(emuWindow, "emuWindow");
    }
    if (ideWindow && !ideWindow.isDestroyed()) {
      saveWindowState(ideWindow, "ideWindow");
    }

    const settingsPath = getKliveSettingsPath();
    const kliveFolder = join(homedir(), "Klive");

    // --- Ensure the Klive folder exists
    await fs.mkdir(kliveFolder, { recursive: true });

    // --- Save the settings
    const settingsData = JSON.stringify(kliveSettings, null, 2);
    await fs.writeFile(settingsPath, settingsData, "utf-8");
    console.log("Klive settings saved successfully");
  } catch (error) {
    console.error("Error saving Klive settings:", error);
  }
}

function createEmulatorWindow(): void {
  // --- Get saved window state or use defaults
  const savedWindow = kliveSettings.windowStates?.emuWindow;
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: savedWindow?.width || 800,
    height: savedWindow?.height || 600,
    title: "Klive Emulator",    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux"
      ? { icon: join(__dirname, "../resources/icon.png") }
      : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  };

  // --- Set position if saved
  if (savedWindow?.x !== undefined && savedWindow?.y !== undefined) {
    windowOptions.x = savedWindow.x;
    windowOptions.y = savedWindow.y;
  }

  // --- Create the emulator window
  emuWindow = new BrowserWindow(windowOptions);
  emuWindow.on("ready-to-show", () => {
    emuWindow?.show();
    emuWindow?.focus(); // --- Focus the emulator window
    emuWindow?.webContents.openDevTools(); // --- Open dev tools
  });
  emuWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });
  // --- Load the renderer content
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    emuWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/emulator/`);
  } else {
    emuWindow.loadFile(join(__dirname, "../renderer/emulator.html"));
  }
  emuWindow.on("closed", async () => {
    // --- When emulator window is closed, save settings, close IDE window and quit app
    await saveKliveSettings();
    if (ideWindow && !ideWindow.isDestroyed()) {
      ideWindow.close();
    }
    emuWindow = null;
    app.quit();
  });
}

function createIDEWindow(): void {
  // --- Get saved window state or use defaults
  const savedWindow = kliveSettings.windowStates?.ideWindow;
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: savedWindow?.width || 1200,
    height: savedWindow?.height || 800,
    title: "Klive IDE",
    show: false,    autoHideMenuBar: true,
    ...(process.platform === "linux"
      ? { icon: join(__dirname, "../resources/icon.png") }
      : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  };

  // --- Set position if saved
  if (savedWindow?.x !== undefined && savedWindow?.y !== undefined) {
    windowOptions.x = savedWindow.x;
    windowOptions.y = savedWindow.y;
  }

  // --- Create the IDE window
  ideWindow = new BrowserWindow(windowOptions);

  ideWindow.on("ready-to-show", () => {
    ideWindow?.show();
  });
  ideWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });
  // --- Load the renderer content
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    ideWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/ide/`);
  } else {
    ideWindow.loadFile(join(__dirname, "../renderer/ide.html"));
  }
  ideWindow.on("closed", async () => {
    // --- When IDE window is closed, save settings, close emulator window and quit app
    await saveKliveSettings();
    if (emuWindow && !emuWindow.isDestroyed()) {
      emuWindow.close();
    }
    ideWindow = null;
    app.quit();
  });
}

function createWindows(): void {
  createEmulatorWindow();
  createIDEWindow();
}

// --- This method will be called when Electron has finished
// --- initialization and is ready to create browser windows.
// --- Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // --- Load Klive settings first
  await loadKliveSettings();

  // --- Set app user model id for windows
  electronApp.setAppUserModelId("com.electron");

  // --- Default open or close DevTools by F12 in development
  // --- and ignore CommandOrControl + R in production.
  // --- see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });
  createWindows();

  app.on("activate", function () {
    // --- On macOS it's common to re-create windows in the app when the
    // --- dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindows();
    }
  });
});

// --- Quit when all windows are closed on all platforms
app.on("window-all-closed", async () => {
  await saveKliveSettings();
  app.quit();
});

// --- In this file you can include the rest of your app"s specific main process
// --- code. You can also put them in separate files and require them here.
