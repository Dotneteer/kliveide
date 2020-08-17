import * as path from "path";
import * as fs from "fs";
import * as electronLocalShortcut from "electron-localshortcut";

import {
  __DARWIN__,
  __WIN32__,
  __LINUX__,
  __DEV__,
} from "./utils/electron-utils";
import {
  BrowserWindow,
  app,
  Menu,
  MenuItemConstructorOptions,
  MenuItem,
  ipcMain,
  IpcMainEvent,
  webContents,
} from "electron";
import {
  mainProcessStore,
  createMainProcessStateAware,
} from "./mainProcessStore";
import {
  appGotFocusAction,
  appLostFocusAction,
} from "../../src/shared/state/redux-app-focus";
import {
  restoreAppWindowAction,
  maximizeAppWindowAction,
  minimizeAppWindowAction,
} from "../../src/shared/state/redux-window-state";
import { RendererMessage } from "../shared/messaging/message-types";
import {
  RENDERER_MESSAGING_CHANNEL,
  MAIN_MESSAGING_CHANNEL,
} from "../../src/shared/utils/channel-ids";
import { processRendererMessage } from "./mainMessageProcessor";
import { EmulatorPanelState } from "../shared/state/AppState";
import { emulatorSetSavedDataAction } from "../shared/state/redux-emulator-state";
import { BinaryWriter } from "../shared/utils/BinaryWriter";
import { TzxHeader, TzxStandardSpeedDataBlock } from "../shared/tape/tzx-file";

/**
 * Stores a reference to the lazily loaded `electron-window-state` package.
 */
let windowStateKeeper: any | null = null;

/**
 * Minimum application window dimesnions
 */
const MIN_WIDTH = 960;
const MIN_HEIGHT = 676;

/**
 * This class encapsulates the functionality of the application's window
 * at the main process side.
 */
export class AppWindow {
  // --- The associated BrowserWindow instance
  private _window: BrowserWindow | null;

  // ==========================================================================
  // Static members

  /**
   * Now, we allow only a singleton instance
   */
  static instance: AppWindow;

  // ==========================================================================
  // Lifecycle methods

  /**
   * Instantiates the browser window
   */
  constructor() {
    // --- Store the reference to the singleton instance
    AppWindow.instance = this;

    // --- Setup the state keeper module
    if (!windowStateKeeper) {
      windowStateKeeper = require("electron-window-state");
    }

    // --- Restore the last window state
    const savedWindowState = windowStateKeeper({
      defaultWidth: MIN_WIDTH,
      defaultHeight: MIN_HEIGHT,
    });

    // --- Prepare the configuration options for the app window
    const windowOptions: Electron.BrowserWindowConstructorOptions = {
      x: savedWindowState.x,
      y: savedWindowState.y,
      width: savedWindowState.width,
      height: savedWindowState.height,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      show: true,
      // --- This fixes subpixel aliasing on Windows
      // --- See https://github.com/atom/atom/commit/683bef5b9d133cb194b476938c77cc07fd05b972
      backgroundColor: "#fff",
      webPreferences: {
        webSecurity: false,
        devTools: process.env.NODE_ENV === "production" ? false : true,
        nodeIntegration: true,
      },
      acceptFirstMouse: true,
      icon: path.join(__dirname, "icons/spectnet-logo.png"),
    };

    // --- Additional options depending on the host platform
    if (__DARWIN__) {
      windowOptions.frame = true;
    } else if (__WIN32__) {
      windowOptions.frame = true;
    } else if (__LINUX__) {
      windowOptions.icon = path.join(__dirname, "icons/spectnet-logo.png");
    }

    this._window = new BrowserWindow(windowOptions);

    // --- Set up main window events
    this._window.on("focus", () => {
      electronLocalShortcut.register(
        this._window,
        ["CommandOrControl+R", "CommandOrControl+Shift+R", "F5"],
        () => {}
      );
      mainProcessStore.dispatch(appGotFocusAction());
    });
    this._window.on("blur", () => {
      electronLocalShortcut.unregisterAll(this._window);
      mainProcessStore.dispatch(appLostFocusAction());
    });
    this.window.on("enter-full-screen", () => {
      // TODO: Implement this
    });

    // So this is a bit of a hack. If we call window.isFullScreen directly after
    // receiving the leave-full-screen event it'll return true which isn't what
    // we're after. So we'll say that we're transitioning to 'normal' even though
    // we might be maximized. This works because electron will emit a 'maximized'
    // event after 'leave-full-screen' if the state prior to full-screen was maximized.
    this.window.on("leave-full-screen", () => {
      mainProcessStore.dispatch(restoreAppWindowAction());
    });
    this.window.on("maximize", () => {
      mainProcessStore.dispatch(maximizeAppWindowAction());
    });
    this.window.on("minimize", () => {
      mainProcessStore.dispatch(minimizeAppWindowAction());
    });
    this.window.on("unmaximize", () => {
      mainProcessStore.dispatch(restoreAppWindowAction());
    });
    this.window.on("restore", () => {
      mainProcessStore.dispatch(restoreAppWindowAction());
    });
    this.window.on("hide", () => {
      // TODO: Implement this
    });
    this.window.on("show", () => {
      mainProcessStore.dispatch(restoreAppWindowAction());
    });
    this._window.on("closed", () => {
      // --- Release resources
      this._window = null;
    }); // --- Load the main file

    // --- Allow the `electron-windows-state` package to follow and save the
    // --- app window's state
    savedWindowState.manage(this._window);

    // --- Set up message processing
    ipcMain.on(
      RENDERER_MESSAGING_CHANNEL,
      (_ev: IpcMainEvent, message: RendererMessage) => {
        const response = processRendererMessage(message);
        response.correlationId = message.correlationId;
        const allWebContents = webContents.getAllWebContents();
        const pageContenst =
          webContents.length === 1 ? allWebContents[0] : webContents.fromId(1);
        if (!pageContenst) return;
        pageContenst.send(MAIN_MESSAGING_CHANNEL, response);
      }
    );

    // --- catch state changes
    const stateAware = createMainProcessStateAware("emulatorPanelState");
    stateAware.stateChanged.on((state) =>
      this.processStateChange(state as EmulatorPanelState)
    );
  }

  /**
   * Gets the associated BrowserWindow
   */
  get window(): BrowserWindow | null {
    return this._window;
  }

  /**
   * Loads the contenst of the main window
   */
  load(): void {
    this._window.loadFile(path.join(__dirname, "index.html"));
  }

  setupMenu(): void {
    const template: (MenuItemConstructorOptions | MenuItem)[] = [];
    if (__DARWIN__) {
      template.push({
        label: app.name,
        submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      });
    }
    template.push(
      {
        label: "File",
        submenu: [__DARWIN__ ? { role: "close" } : { role: "quit" }],
      },
      {
        label: "View",
        submenu: [
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      }
    );
    if (__DARWIN__) {
      template.push({
        label: "Window",
        submenu: [
          { role: "minimize" },
          { role: "zoom" },
          { type: "separator" },
          { role: "front" },
          { type: "separator" },
          { role: "window" },
        ],
      });
    }
    template.push({
      role: "help",
      submenu: [
        {
          label: "Learn More",
          click: async () => {
            const { shell } = require("electron");
            await shell.openExternal("https://electronjs.org");
          },
        },
      ],
    });
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  /**
   * Processes emulator data changes
   * @param state Emulator state
   */
  processStateChange(state: EmulatorPanelState): void {
    if (state?.savedData && state.savedData.length > 0) {
      const data = state.savedData;
      const ideConfig = mainProcessStore.getState().ideConfiguration
      if (!ideConfig) {
        return
      }

      // --- Create filename
      const tapeFilePath = path.join(ideConfig.projectFolder, ideConfig.saveFolder);
      const nameBytes = data.slice(2, 12);
      let name = "";
      for (let i = 0; i < 10; i++) {
        name += String.fromCharCode(nameBytes[i]);
      }
      const tapeFileName = path.join(tapeFilePath, `${name.trimRight()}.tzx`);
      console.log(tapeFileName);

      // --- We use this writer to save file info into
      const writer = new BinaryWriter();
      new TzxHeader().writeTo(writer);

      // --- The first 19 bytes is the header
      new TzxStandardSpeedDataBlock(data.slice(0, 19)).writeTo(writer);

      // --- Other bytes are the data block
      new TzxStandardSpeedDataBlock(data.slice(19)).writeTo(writer);

      // --- Now, save the file
      fs.writeFileSync(tapeFileName, writer.buffer);

      // --- Sign that the file has been saved
      mainProcessStore.dispatch(
        emulatorSetSavedDataAction(new Uint8Array(0))()
      );
    }
  }
}
