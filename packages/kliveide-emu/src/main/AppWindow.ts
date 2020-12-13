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
  dialog,
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
import {
  RequestMessage,
  ResponseMessage,
} from "../shared/messaging/message-types";
import {
  RENDERER_REQUEST_CHANNEL,
  MAIN_RESPONSE_CHANNEL,
  MAIN_REQUEST_CHANNEL,
  RENDERER_RESPONSE_CHANNEL,
} from "../../src/shared/utils/channel-ids";
import { processMessageFromRenderer } from "./mainMessageProcessor";
import { EmulatorPanelState, IdeConnection } from "../shared/state/AppState";
import {
  emulatorSetSavedDataAction,
  emulatorRequestTypeAction,
  emulatorSetTapeContenstAction,
  emulatorSetSoundLevelAction,
  emulatorMuteAction,
  emulatorUnmuteAction,
  emulatorShowStatusbarAction,
  emulatorHideStatusbarAction,
} from "../shared/state/redux-emulator-state";
import { BinaryWriter } from "../shared/utils/BinaryWriter";
import { TzxHeader, TzxStandardSpeedDataBlock } from "../shared/tape/tzx-file";
import { ideDisconnectsAction } from "../shared/state/redux-ide-connection.state";
import { checkTapeFile } from "../shared/tape/readers";
import { BinaryReader } from "../shared/utils/BinaryReader";

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

  // --- Last machine type used
  private _lastMachineType: string | null = null;

  // --- Last sound level used
  private _lastSoundLevel: number | null = null;

  // --- Last muted value
  private _lastMuted: boolean | null = null;

  // --- Indicates that the main window watches for IDE notifications
  private _watchingIde = false;

  /**
   * ID of the last message
   */
  private _mainMessageSeqNo = 0;

  /**
   * Message resolvers
   */
  private _mainMessageResolvers = new Map<
    number,
    (msg?: ResponseMessage | PromiseLike<ResponseMessage>) => void
  >();

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
      RENDERER_REQUEST_CHANNEL,
      (_ev: IpcMainEvent, message: RequestMessage) => {
        const response = processMessageFromRenderer(message);
        response.correlationId = message.correlationId;
        const allWebContents = webContents.getAllWebContents();
        const pageContenst =
          webContents.length === 1 ? allWebContents[0] : webContents.fromId(1);
        if (!pageContenst) return;
        pageContenst.send(MAIN_RESPONSE_CHANNEL, response);
      }
    );

    // --- Process the results coming from the renderer process
    ipcMain.on(
      RENDERER_RESPONSE_CHANNEL,
      (_ev: IpcMainEvent, response: ResponseMessage) => {
        // --- Check for UI message
        const resolver = this._mainMessageResolvers.get(response.correlationId);

        // --- Resolve the message
        if (resolver) {
          resolver(response);
          this._mainMessageResolvers.delete(response.correlationId);
        }
      }
    );

    // --- Catch state changes
    const emulatorStateAware = createMainProcessStateAware(
      "emulatorPanelState"
    );
    emulatorStateAware.stateChanged.on((state) =>
      this.processStateChange(state as EmulatorPanelState)
    );
    const ideConnectionStateAware = createMainProcessStateAware(
      "ideConnection"
    );
    ideConnectionStateAware.stateChanged.on((state) => {
      const conn = state as IdeConnection;
      if (conn.connected) {
        this.disableMachineMenu();
      } else {
        this.enableMachineMenu();
      }
    });
  }

  /**
   * Gets the associated BrowserWindow
   */
  get window(): BrowserWindow | null {
    return this._window;
  }

  /**
   * Posts a message from the renderer to the main
   * @param message Message contents
   */
  postMessageToRenderer(message: RequestMessage): void {
    if (this._window) {
      this._window.webContents.send(MAIN_REQUEST_CHANNEL, message);
    }
  }

  /**
   * Sends an async message to the main process
   * @param message Message to send
   */
  sendMessageToRenderer<TMessage extends ResponseMessage>(
    message: RequestMessage
  ): Promise<TMessage> {
    message.correlationId = this._mainMessageSeqNo++;
    const promise = new Promise<TMessage>((resolve) => {
      this._mainMessageResolvers.set(message.correlationId, resolve);
    });
    this.postMessageToRenderer(message);
    return promise;
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
          { type: "separator" },
          {
            id: "toggle_statusbar",
            label: "Show statusbar",
            type: "checkbox",
            checked: true,
            click: (mi) => {
              if (mi.checked) {
                mainProcessStore.dispatch(emulatorShowStatusbarAction());
              } else {
                mainProcessStore.dispatch(emulatorHideStatusbarAction());
              }
            },
          },
        ],
      }
    );

    template.push({
      label: "Machine",
      submenu: [
        {
          id: MACHINE_MENU_ITEMS[0],
          label: "ZX Spectrum 48",
          type: "radio",
          checked: true,
          click: (mi) => this.requestMachineType(mi.id),
        },
        {
          id: MACHINE_MENU_ITEMS[1],
          label: "ZX Spectrum 128",
          type: "radio",
          checked: false,
          click: (mi) => this.requestMachineType(mi.id),
        },
        {
          id: MACHINE_MENU_ITEMS[2],
          label: "ZX Spectrum +3E",
          type: "radio",
          checked: false,
          click: (mi) => this.requestMachineType(mi.id),
        },
        {
          id: MACHINE_MENU_ITEMS[3],
          label: "ZX Spectrum Next",
          type: "radio",
          checked: false,
          click: (mi) => this.requestMachineType(mi.id),
        },
        {
          id: MACHINE_MENU_ITEMS[4],
          label: "Cambridge Z88",
          type: "radio",
          checked: false,
          click: (mi) => this.requestMachineType(mi.id),
        },
        { type: "separator" },
        {
          id: SOUND_MENU_ITEMS[0].id,
          label: "Mute sound",
          type: "radio",
          checked: false,
          click: () => this.setSoundLevel(SOUND_MENU_ITEMS[0].level),
        },
        {
          id: SOUND_MENU_ITEMS[1].id,
          label: "Sound: Low ",
          type: "radio",
          checked: false,
          click: () => this.setSoundLevel(SOUND_MENU_ITEMS[1].level),
        },
        {
          id: SOUND_MENU_ITEMS[2].id,
          label: "Sound: Medium",
          type: "radio",
          checked: false,
          click: () => this.setSoundLevel(SOUND_MENU_ITEMS[2].level),
        },
        {
          id: SOUND_MENU_ITEMS[3].id,
          label: "Sound: High",
          type: "radio",
          checked: true,
          click: () => this.setSoundLevel(SOUND_MENU_ITEMS[3].level),
        },
        {
          id: SOUND_MENU_ITEMS[4].id,
          label: "Sound: Highest",
          type: "radio",
          checked: false,
          click: () => this.setSoundLevel(SOUND_MENU_ITEMS[4].level),
        },
        { type: "separator" },
        {
          id: MACHINE_MENU_ITEMS[5],
          label: "Set tape file...",
          click: async () => await this.selectTapeFile(),
        },
      ],
    });

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
            await shell.openExternal("https://dotneteer.github.io/kliveide/");
          },
        },
      ],
    });
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  /**
   * Disables all machine menu items
   */
  disableMachineMenu(): void {
    for (const id of MACHINE_MENU_ITEMS) {
      const menuItem = Menu.getApplicationMenu().getMenuItemById(id);
      if (menuItem) {
        menuItem.enabled = false;
      }
    }
  }

  /**
   * Disables all machine menu items
   */
  enableMachineMenu(): void {
    for (const id of MACHINE_MENU_ITEMS) {
      const menuItem = Menu.getApplicationMenu().getMenuItemById(id);
      if (menuItem) {
        menuItem.enabled = true;
      }
    }
  }

  /**
   * Sets the active menu according to the current machine type
   */
  setMachineTypeMenu(type: string): void {
    const menuItem = Menu.getApplicationMenu().getMenuItemById(
      `machine_${type}`
    );
    if (menuItem) {
      menuItem.checked = true;
    }
  }

  /**
   * Requests a machine type according to its menu ID
   * @param id Menu ID of the machine type
   */
  requestMachineType(id: string): void {
    const parts = id.split("_");
    if (parts.length > 1) {
      const typeId = parts[1];
      mainProcessStore.dispatch(emulatorRequestTypeAction(typeId)());
    }
  }

  /**
   * Sets the sound menu with the specified level
   * @param level Sound level
   */
  setSoundLevelMenu(muted: boolean, level: number): void {
    for (const menuItem of SOUND_MENU_ITEMS) {
      const item = Menu.getApplicationMenu().getMenuItemById(menuItem.id);
      item.checked = false;
    }
    if (muted) {
      const soundItem = Menu.getApplicationMenu().getMenuItemById(
        SOUND_MENU_ITEMS[0].id
      );
      if (soundItem) {
        soundItem.checked = true;
      }
    } else {
      for (let i = 0; i < SOUND_MENU_ITEMS.length; i++) {
        if (level < SOUND_MENU_ITEMS[i].level + 0.02) {
          const soundItem = Menu.getApplicationMenu().getMenuItemById(
            SOUND_MENU_ITEMS[i].id
          );
          if (soundItem) {
            soundItem.checked = true;
          }
          break;
        }
      }
    }
  }

  /**
   * Sets the specified sound level
   * @param level Sound level (between 0.0 and 1.0)
   */
  setSoundLevel(level: number): void {
    if (level === 0) {
      mainProcessStore.dispatch(emulatorMuteAction());
    } else {
      mainProcessStore.dispatch(emulatorUnmuteAction());
      mainProcessStore.dispatch(emulatorSetSoundLevelAction(level)());
    }
  }

  /**
   * Processes emulator data changes
   * @param state Emulator state
   */
  processStateChange(state: EmulatorPanelState): void {
    if (this._lastMachineType !== state.currentType) {
      // --- Current machine types has changed
      this._lastMachineType = state.currentType;
      this.setMachineTypeMenu(this._lastMachineType);
    }

    if (
      this._lastSoundLevel !== state.soundLevel ||
      this._lastMuted !== state.muted
    ) {
      // --- Sound level has changed
      this._lastSoundLevel = state.soundLevel;
      this._lastMuted = state.muted;
      this.setSoundLevelMenu(this._lastMuted, this._lastSoundLevel);
    }

    if (state?.savedData && state.savedData.length > 0) {
      const data = state.savedData;
      const ideConfig = mainProcessStore.getState().ideConfiguration;
      if (!ideConfig) {
        return;
      }

      // --- Create filename
      const tapeFilePath = path.join(
        ideConfig.projectFolder,
        ideConfig.saveFolder
      );
      const nameBytes = data.slice(2, 12);
      let name = "";
      for (let i = 0; i < 10; i++) {
        name += String.fromCharCode(nameBytes[i]);
      }
      const tapeFileName = path.join(tapeFilePath, `${name.trimRight()}.tzx`);

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

  /**
   * Verifies if IDE is still connected
   */
  async startWatchingIde(): Promise<void> {
    this._watchingIde = true;
    while (this._watchingIde) {
      await new Promise((r) => setTimeout(r, 400));
      const state = mainProcessStore.getState();
      const lastHeartBeat = state.ideConnection?.lastHeartBeat ?? -1;
      if (lastHeartBeat > 0) {
        if (Date.now() - lastHeartBeat > 3000) {
          // --- IDE seems to be disconnected
          mainProcessStore.dispatch(ideDisconnectsAction());
        }
      }
    }
  }

  /**
   * Stops watching IDE connection
   */
  stopWatchingIde(): void {
    this._watchingIde = false;
  }

  async selectTapeFile(): Promise<void> {
    const result = await dialog.showOpenDialog(this.window, {
      title: "Open tape file",
      filters: [
        { name: "Tape files", extensions: ["tzx", "tap"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    let tapeFile: string = "";
    if (!result.canceled) {
      try {
        tapeFile = result.filePaths[0];
        const contents = fs.readFileSync(tapeFile);
        if (checkTapeFile(new BinaryReader(contents))) {
          mainProcessStore.dispatch(emulatorSetTapeContenstAction(contents)());
          await dialog.showMessageBox(this.window, {
            title: `Tape file loaded`,
            message: `Tape file ${tapeFile} successfully loaded.`,
            type: "info",
          });
        } else {
          throw new Error("Could not process the contenst of tape file.");
        }
      } catch (err) {
        // --- This error is intentionally ignored
        await dialog.showMessageBox(this.window, {
          title: `Error processing the tape file ${tapeFile}`,
          message: err.toString(),
          type: "error",
          detail:
            "Please check if you have the appropriate access rights to read the files contents and the file is a valid .tap or .tzx file (note: 'dsk' format is not supported, yet).",
        });
      }
    }
  }
}

/**
 * The list of machine menu items
 */
const MACHINE_MENU_ITEMS = [
  "machine_48",
  "machine_128",
  "machine_p3e",
  "machine_next",
  "cambridge_cz88",
  "set_tape",
];

/**
 * The list of sound menu items
 */
const SOUND_MENU_ITEMS: { id: string; level: number }[] = [
  { id: "mute_sound", level: 0.0 },
  { id: "sound_level_low", level: 0.13 },
  { id: "sound_level_medium", level: 0.25 },
  { id: "sound_level_high", level: 0.5 },
  { id: "sound_level_highest", level: 1.0 },
];
