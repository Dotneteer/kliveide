import * as path from "path";
import * as fs from "fs";
import * as electronLocalShortcut from "electron-localshortcut";

import {
  __DARWIN__,
  __WIN32__,
  __LINUX__,
  __DEV__,
  menuIdFromMachineId,
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
  shell,
  WebContents,
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
import { AppState, IdeConnection } from "../shared/state/AppState";
import {
  emulatorSetSavedDataAction,
  emulatorRequestTypeAction,
  emulatorSetSoundLevelAction,
  emulatorMuteAction,
  emulatorUnmuteAction,
  emulatorShowStatusbarAction,
  emulatorHideStatusbarAction,
  emulatorShowKeyboardAction,
  emulatorHideKeyboardAction,
  emulatorSetClockMultiplierAction,
  emulatorShowFramesAction,
  emulatorHideFramesAction,
  emulatorShowToolbarAction,
  emulatorHideToolbarAction,
  emulatorSetMachineContextAction,
  emulatorKeyboardHeightAction,
} from "../shared/state/redux-emulator-state";
import { BinaryWriter } from "../shared/utils/BinaryWriter";
import { TzxHeader, TzxStandardSpeedDataBlock } from "../shared/tape/tzx-file";
import { ideDisconnectsAction } from "../shared/state/redux-ide-connection.state";
import { MachineContextProvider } from "./machine-context";
import {
  ZxSpectrum128ContextProvider,
  ZxSpectrum48ContextProvider,
} from "./zx-spectrum-context";
import { Cz88ContextProvider } from "./cz-88-context";
import { IAppWindow } from "./IAppWindows";
import {
  appConfiguration,
  appSettings,
  saveKliveSettings,
} from "./klive-configuration";
import { KliveSettings } from "../shared/messaging/emu-configurations";

/**
 * Stores a reference to the lazily loaded `electron-window-state` package.
 */
let windowStateKeeper: any | null = null;

/**
 * Minimum application window dimensions
 */
const MIN_WIDTH = 640;
const MIN_HEIGHT = 128;

// --- Menu IDs
const TOGGLE_KEYBOARD = "toggle_keyboard";
const TOGGLE_TOOLBAR = "toggle_toolbar";
const TOGGLE_STATUSBAR = "toggle_statusbar";
const TOGGLE_FRAMES = "toggle_frames";
const TOGGLE_DEVTOOLS = "toggle_devtools";
const START_VM = "start_vm";
const PAUSE_VM = "pause_vm";
const STOP_VM = "stop_vm";
const RESTART_VM = "restart_vm";
const DEBUG_VM = "debug_vm";
const STEP_INTO_VM = "step_into_vm";
const STEP_OVER_VM = "step_over_vm";
const STEP_OUT_VM = "step_out_vm";

/**
 * This class encapsulates the functionality of the application's window
 * at the main process side.
 */
export class AppWindow implements IAppWindow {
  // --- The associated BrowserWindow instance
  private _window: BrowserWindow | null;

  // --- Last machine type used
  private _lastMachineType: string | null = null;

  // --- Menu provider for the machine type
  private _machineContextProvider: MachineContextProvider | null = null;

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

  /**
   * Gets the current machine context provider
   */
  static getContextProvider(): MachineContextProvider | null {
    return AppWindow.instance._machineContextProvider;
  }

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
        contextIsolation: true,
        preload: path.join(__dirname, "preload.bundled.js"),
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
      async (_ev: IpcMainEvent, message: RequestMessage) => {
        const response = await processMessageFromRenderer(message);
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
    const emulatorStateAware = createMainProcessStateAware();
    emulatorStateAware.stateChanged.on((state) =>
      this.processStateChange(state)
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

    // --- Set up the default provider
    this._machineContextProvider = new ZxSpectrum48ContextProvider(this);
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

  /**
   * Sets up the application menu
   */
  setupMenu(): void {
    // --- Merge startup configuration and settings
    const viewOptions = appSettings?.viewOptions ?? {
      showToolbar: true,
      showStatusbar: true,
      showFrameInfo: true,
    };

    if (viewOptions.showFrameInfo === undefined) {
      viewOptions.showFrameInfo = appConfiguration?.viewOptions.showFrameInfo;
    }
    if (viewOptions.showToolbar === undefined) {
      viewOptions.showToolbar = appConfiguration?.viewOptions?.showToolbar;
    }
    if (viewOptions.showStatusbar === undefined) {
      viewOptions.showStatusbar = appConfiguration?.viewOptions?.showStatusbar;
    }
    if (viewOptions.showKeyboard === undefined) {
      viewOptions.showKeyboard = appConfiguration?.viewOptions?.showStatusbar;
    }

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

    // --- Prepare the File menu
    const fileMenu: MenuItemConstructorOptions = {
      label: "File",
      submenu: [__DARWIN__ ? { role: "close" } : { role: "quit" }],
    };

    // --- Preapre the view menu
    const viewSubMenu: MenuItemConstructorOptions[] = [
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
      {
        id: TOGGLE_DEVTOOLS,
        label: "Toggle Developer Tools",
        accelerator: "Ctrl+Shift+I",
        visible: appConfiguration?.viewOptions?.showDevTools ?? false,
        enabled: appConfiguration?.viewOptions?.showDevTools ?? false,
        click: () => {
          this.window.webContents.toggleDevTools();
        },
      },
      { type: "separator" },
      {
        id: TOGGLE_KEYBOARD,
        label: "Show keyboard",
        type: "checkbox",
        checked: false,
        click: (mi) => {
          if (mi.checked) {
            mainProcessStore.dispatch(emulatorShowKeyboardAction());
          } else {
            mainProcessStore.dispatch(emulatorHideKeyboardAction());
          }
        },
      },
      { type: "separator" },
    ];

    let extraViewItems: MenuItemConstructorOptions[] =
      this._machineContextProvider?.provideViewMenuItems() ?? [];
    if (extraViewItems.length > 0) {
      extraViewItems.push({ type: "separator" });
    }
    viewSubMenu.push(...extraViewItems);

    viewSubMenu.push(
      {
        id: TOGGLE_TOOLBAR,
        label: "Show toolbar",
        type: "checkbox",
        checked: viewOptions.showToolbar ?? true,
        click: (mi) => {
          if (mi.checked) {
            mainProcessStore.dispatch(emulatorShowToolbarAction());
          } else {
            mainProcessStore.dispatch(emulatorHideToolbarAction());
          }
        },
      },
      {
        id: TOGGLE_STATUSBAR,
        label: "Show statusbar",
        type: "checkbox",
        checked: viewOptions.showStatusbar ?? true,
        click: (mi) => {
          if (mi.checked) {
            mainProcessStore.dispatch(emulatorShowStatusbarAction());
          } else {
            mainProcessStore.dispatch(emulatorHideStatusbarAction());
          }
        },
      },
      {
        id: TOGGLE_FRAMES,
        label: "Show frame information",
        type: "checkbox",
        checked: viewOptions.showFrameInfo ?? true,
        click: (mi) => {
          if (mi.checked) {
            mainProcessStore.dispatch(emulatorShowFramesAction());
          } else {
            mainProcessStore.dispatch(emulatorHideFramesAction());
          }
        },
      }
    );

    // --- Add the file and view menu
    template.push(fileMenu, {
      label: "View",
      submenu: viewSubMenu,
    });

    // --- Prepare the Run menu
    const runMenu: MenuItemConstructorOptions = {
      label: "Run",
      submenu: [
        {
          id: START_VM,
          label: "Start",
          accelerator: "F5",
          enabled: true,
          click: async () => await this.startVm(),
        },
        {
          id: PAUSE_VM,
          label: "Pause",
          accelerator: "Shift+F5",
          enabled: false,
          click: async () => await this.pauseVm(),
        },
        {
          id: STOP_VM,
          label: "Stop",
          accelerator: "F4",
          enabled: false,
          click: async () => await this.stopVm(),
        },
        {
          id: RESTART_VM,
          label: "Restart",
          accelerator: "Shift+F4",
          enabled: false,
          click: async () => await this.restartVm(),
        },
        { type: "separator" },
        {
          id: DEBUG_VM,
          label: "Start with debugging",
          accelerator: "Ctrl+F5",
          enabled: true,
          click: async () => await this.debugVm(),
        },
        {
          id: STEP_INTO_VM,
          label: "Step into",
          accelerator: "F3",
          enabled: false,
          click: async () => await this.stepIntoVm(),
        },
        {
          id: STEP_OVER_VM,
          label: "Step over",
          accelerator: "Shift+F3",
          enabled: false,
          click: async () => await this.stepOverVm(),
        },
        {
          id: STEP_OUT_VM,
          label: "Step out",
          accelerator: "Ctrl+F3",
          enabled: false,
          click: async () => await this.stepOutVm(),
        },
      ],
    };
    template.push(runMenu);

    // --- Prepare the machine menu
    const machineSubMenu: MenuItemConstructorOptions[] = [];
    for (let i = 0; i < MACHINE_MENU_ITEMS.length; i++) {
      machineSubMenu.push({
        id: menuIdFromMachineId(MACHINE_MENU_ITEMS[i].id),
        label: MACHINE_MENU_ITEMS[i].label,
        type: "radio",
        checked: i ? false : true,
        enabled: MACHINE_MENU_ITEMS[i].enabled,
        click: async (mi) => {
          this.requestMachineType(mi.id.split("_")[1]);
          // --- Wait while the menu is instantiated
          await new Promise((r) => setTimeout(r, 400));
          this.setMachineTypeMenu(mi.id);
        },
      });
    }

    machineSubMenu.push(
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
      }
    );

    const emuState = mainProcessStore.getState().emulatorPanelState;
    emuState.internalState;
    const cpuClockSubmenu: MenuItemConstructorOptions = {
      type: "submenu",
      label: "CPU clock multiplier",
      submenu: [],
    };
    const baseClockFrequency =
      this._machineContextProvider?.getNormalCpuFrequency() ?? 1_000_000;

    for (let i = 1; i <= 16; i++) {
      (cpuClockSubmenu.submenu as MenuItemConstructorOptions[]).push({
        id: `clockMultiplier_${i}`,
        type: "radio",
        label:
          (i > 1 ? `${i}x` : `Normal`) +
          ` (${((i * baseClockFrequency) / 1_000_000).toFixed(4)}MHz)`,
        click: () => {
          mainProcessStore.dispatch(emulatorSetClockMultiplierAction(i)());
        },
      });
    }
    machineSubMenu.push({ type: "separator" });
    machineSubMenu.push(cpuClockSubmenu);

    let extraMachineItems: MenuItemConstructorOptions[] =
      this._machineContextProvider?.provideMachineMenuItems() ?? [];
    if (extraMachineItems.length > 0) {
      machineSubMenu.push({ type: "separator" });
      machineSubMenu.push(...extraMachineItems);
    }

    template.push({
      label: "Machine",
      submenu: machineSubMenu,
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

    const helpSubmenu: MenuItemConstructorOptions[] = [
      {
        label: "Klive on Github",
        click: async () => {
          await shell.openExternal("https://github.com/Dotneteer/kliveide");
        },
      },
      {
        label: "Getting started with Klive",
        click: async () => {
          await shell.openExternal(
            "https://dotneteer.github.io/kliveide/getting-started/install-kliveide.html"
          );
        },
      },
    ];
    let extraHelpItems: MenuItemConstructorOptions[] =
      this._machineContextProvider?.provideHelpMenuItems() ?? [];
    if (extraHelpItems.length > 0) {
      helpSubmenu.push({ type: "separator" });
      helpSubmenu.push(...extraHelpItems);
    }

    template.push({
      role: "help",
      submenu: helpSubmenu,
    });
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    if (this._machineContextProvider) {
      mainProcessStore.dispatch(
        emulatorSetMachineContextAction(
          this._machineContextProvider.getMachineContextDescription()
        )()
      );
    }
  }

  applyStoredSettings(): void {
    // --- Set view options
    const viewOptions = appSettings?.viewOptions ?? {
      showToolbar: true,
      showStatusbar: true,
      showFrameInfo: true,
    };

    if (viewOptions?.showFrameInfo === undefined) {
      viewOptions.showFrameInfo = appConfiguration?.viewOptions?.showFrameInfo;
    }
    mainProcessStore.dispatch(
      viewOptions?.showFrameInfo
        ? emulatorShowFramesAction()
        : emulatorHideFramesAction()
    );
    if (viewOptions?.showToolbar === undefined) {
      viewOptions.showToolbar = appConfiguration?.viewOptions?.showToolbar;
    }
    mainProcessStore.dispatch(
      viewOptions?.showToolbar
        ? emulatorShowToolbarAction()
        : emulatorHideToolbarAction()
    );
    if (viewOptions?.showStatusbar === undefined) {
      viewOptions.showStatusbar = appConfiguration?.viewOptions?.showStatusbar;
    }
    mainProcessStore.dispatch(
      viewOptions?.showStatusbar
        ? emulatorShowStatusbarAction()
        : emulatorHideStatusbarAction()
    );
    if (viewOptions?.showKeyboard === undefined) {
      viewOptions.showKeyboard = appConfiguration?.viewOptions?.showStatusbar;
    }
    if (viewOptions?.keyboardHeight) {
      mainProcessStore.dispatch(
        emulatorKeyboardHeightAction(viewOptions.keyboardHeight)()
      );
    }
    mainProcessStore.dispatch(
      viewOptions?.showKeyboard
        ? emulatorShowKeyboardAction()
        : emulatorHideKeyboardAction()
    );

    // --- CPU settings
    if (appSettings?.clockMultiplier) {
      mainProcessStore.dispatch(
        emulatorSetClockMultiplierAction(appSettings.clockMultiplier)()
      );
    }

    // --- Machine specific
    if (appSettings?.machineSpecific && this._machineContextProvider) {
      this._machineContextProvider.setMachineSpecificSettings(
        appSettings.machineSpecific
      );
    }
    if (this._machineContextProvider) {
      mainProcessStore.dispatch(
        emulatorSetMachineContextAction(
          this._machineContextProvider.getMachineContextDescription()
        )()
      );
    }

    // --- Sound
    if (appSettings?.soundLevel) {
      this.setSoundLevel(appSettings.soundLevel);
      this.setSoundLevelMenu(false, appSettings.soundLevel);
    }
  }

  /**
   * Requests a machine type according to its menu ID
   * @param id Machine type, or menu ID of the machine type
   * @param options Machine construction options
   */
  requestMachineType(id: string, options?: Record<string, any>): void {
    const parts = id.split("_");
    const typeId = parts[0];

    // --- Set the new machine type in the state vector
    mainProcessStore.dispatch(emulatorRequestTypeAction(id, options)());

    // --- Prepare the menu provider for the machine
    switch (typeId) {
      case "48":
        this._machineContextProvider = new ZxSpectrum48ContextProvider(this);
        break;
      case "128":
        this._machineContextProvider = new ZxSpectrum128ContextProvider(this);
        break;
      case "cz88":
        this._machineContextProvider = new Cz88ContextProvider(this);
        break;
    }

    // --- Now, create the menu with the current machine type
    this.setupMenu();
    this.setMachineTypeMenu(menuIdFromMachineId(typeId));

    // --- Take care that the menu is updated according to the state
    const emuState = mainProcessStore.getState().emulatorPanelState;
    if (emuState) {
      this._machineContextProvider?.updateMenuStatus(emuState);
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
          if (!(appConfiguration?.viewOptions?.showDevTools ?? false)) {
            this.window.webContents.closeDevTools();
          }
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

  // ==========================================================================
  // Menu helpers

  /**
   * Disables all machine menu items
   */
  private disableMachineMenu(): void {
    for (const item of MACHINE_MENU_ITEMS) {
      const menuItem = Menu.getApplicationMenu().getMenuItemById(item.id);
      if (menuItem) {
        menuItem.enabled = false;
      }
    }
  }

  /**
   * Disables all machine menu items
   */
  private enableMachineMenu(): void {
    for (const item of MACHINE_MENU_ITEMS) {
      const menuItem = Menu.getApplicationMenu().getMenuItemById(item.id);
      if (menuItem) {
        menuItem.enabled = item.enabled;
      }
    }
  }

  /**
   * Sets the active menu according to the current machine type
   */
  setMachineTypeMenu(id: string): void {
    const menuItem = Menu.getApplicationMenu().getMenuItemById(`${id}`);
    if (menuItem) {
      menuItem.checked = true;
    }
  }

  /**
   * Sets the sound menu with the specified level
   * @param level Sound level
   */
  setSoundLevelMenu(muted: boolean, level: number): void {
    for (const menuItem of SOUND_MENU_ITEMS) {
      const item = Menu.getApplicationMenu().getMenuItemById(menuItem.id);
      if (item) {
        item.checked = false;
      }
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
   * Saves the current application settings
   */
  saveAppSettings(): void {
    const state = mainProcessStore.getState().emulatorPanelState;
    const kliveSettings: KliveSettings = {
      machineType: state.currentType.split("_")[0],
      viewOptions: {
        showToolbar: state.showToolbar,
        showFrameInfo: state.showFrames,
        showKeyboard: state.keyboardPanel,
        showStatusbar: state.statusbar,
        keyboardHeight: state.keyboardHeight,
      },
      clockMultiplier: state.clockMultiplier,
      soundLevel: state.soundLevel,
    };
    if (this._machineContextProvider) {
      kliveSettings.machineSpecific = this._machineContextProvider.getMachineSpecificSettings();
    }
    saveKliveSettings(kliveSettings);
  }

  // ==========================================================================
  // Virtual machine helpers

  /**
   * Starts the virtual machine
   */
  private async startVm(): Promise<void> {
    await this.sendMessageToRenderer({ type: "startVm" });
  }

  /**
   * Pauses the virtual machine
   */
  private async pauseVm(): Promise<void> {
    await this.sendMessageToRenderer({ type: "pauseVm" });
  }

  /**
   * Stops the virtual machine
   */
  private async stopVm(): Promise<void> {
    if (await this.confirmStop("stopping", "stop")) {
      await this.sendMessageToRenderer({ type: "stopVm" });
    }
  }

  /**
   * Restarts the virtual machine
   */
  private async restartVm(): Promise<void> {
    if (await this.confirmStop("restarting", "restart")) {
      await this.sendMessageToRenderer({ type: "restartVm" });
    }
  }

  /**
   * Starts debugging the virtual machine
   */
  private async debugVm(): Promise<void> {
    await this.sendMessageToRenderer({ type: "debugVm" });
  }

  /**
   * Steps into the virtual machine
   */
  private async stepIntoVm(): Promise<void> {
    await this.sendMessageToRenderer({ type: "stepIntoVm" });
  }

  /**
   * Steps over the virtual machine
   */
  private async stepOverVm(): Promise<void> {
    await this.sendMessageToRenderer({ type: "stepOverVm" });
  }

  /**
   * Steps out the virtual machine
   */
  private async stepOutVm(): Promise<void> {
    await this.sendMessageToRenderer({ type: "stepOutVm" });
  }

  /**
   * Display a confirm message for reset
   */
  private async confirmStop(
    actionName: string,
    actionVerb: string
  ): Promise<boolean> {
    const result = await dialog.showMessageBox(this.window, {
      title: `Confirm ${actionName} the machine`,
      message: `Are you sure you want to ${actionVerb} the machine?`,
      buttons: ["Yes", "No"],
      defaultId: 0,
      type: "question",
    });
    return result.response === 0;
  }

  /**
   * Sets the specified sound level
   * @param level Sound level (between 0.0 and 1.0)
   */
  private setSoundLevel(level: number): void {
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
  private processStateChange(fullState: AppState): void {
    const menu = Menu.getApplicationMenu();
    const emuState = fullState.emulatorPanelState;
    if (menu) {
      // --- DevTools visibility
      const devToolVisible =
        (fullState?.ideConnection?.connected ?? false) ||
        (appConfiguration?.viewOptions?.showDevTools ?? false);
      const toggleDevTools = menu.getMenuItemById(TOGGLE_DEVTOOLS);
      if (toggleDevTools) {
        toggleDevTools.visible = toggleDevTools.enabled = devToolVisible;
      }

      // --- Keyboard panel status
      const toggleKeyboard = menu.getMenuItemById(TOGGLE_KEYBOARD);
      if (toggleKeyboard) {
        toggleKeyboard.checked = !!emuState.keyboardPanel;
      }

      // --- Clock multiplier status
      if (emuState) {
        const clockMultiplier = emuState.clockMultiplier ?? 1;
        const cmItem = menu.getMenuItemById(
          `clockMultiplier_${clockMultiplier}`
        );
        if (cmItem) {
          cmItem.checked = false;
        }
      }

      // --- VM control commands
      const executionState = emuState.executionState;
      const startVm = menu.getMenuItemById(START_VM);
      if (startVm) {
        startVm.enabled =
          executionState === 0 || executionState === 3 || executionState === 5;
      }
      const pauseVm = menu.getMenuItemById(PAUSE_VM);
      if (pauseVm) {
        pauseVm.enabled = executionState === 1;
      }
      const stopVm = menu.getMenuItemById(STOP_VM);
      if (stopVm) {
        stopVm.enabled = executionState === 1 || executionState === 3;
      }
      const restartVm = menu.getMenuItemById(RESTART_VM);
      if (restartVm) {
        restartVm.enabled = executionState === 1 || executionState === 3;
      }
      const debugVm = menu.getMenuItemById(DEBUG_VM);
      if (debugVm) {
        debugVm.enabled =
          executionState === 0 || executionState === 3 || executionState === 5;
      }
      const stepIntoVm = menu.getMenuItemById(STEP_INTO_VM);
      if (stepIntoVm) {
        stepIntoVm.enabled = executionState === 3;
      }
      const stepOverVm = menu.getMenuItemById(STEP_OVER_VM);
      if (stepOverVm) {
        stepOverVm.enabled = executionState === 3;
      }
      const stepOutVm = menu.getMenuItemById(STEP_OUT_VM);
      if (stepOutVm) {
        stepOutVm.enabled = executionState === 3;
      }
    }

    // --- Take care that custom machine menus are updated
    this._machineContextProvider?.updateMenuStatus(emuState);

    if (this._lastMachineType !== emuState.currentType) {
      // --- Current machine types has changed
      this._lastMachineType = emuState.currentType;
      this.requestMachineType(this._lastMachineType);
    }

    // --- Sound level has changed
    this._lastSoundLevel = emuState.soundLevel;
    this._lastMuted = emuState.muted;
    this.setSoundLevelMenu(this._lastMuted, this._lastSoundLevel);

    // --- The engine has just saved a ZX Spectrum file
    if (emuState?.savedData && emuState.savedData.length > 0) {
      const data = emuState.savedData;
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
}

/**
 * The list of machine menu items
 */
const MACHINE_MENU_ITEMS: { id: string; label: string; enabled: boolean }[] = [
  { id: "48", label: "ZX Spectrum 48", enabled: true },
  { id: "128", label: "ZX Spectrum 128", enabled: true },
  { id: "p3e", label: "ZX Spectrum +3E (to be done)", enabled: false },
  {
    id: "next",
    label: "ZX Spectrum Next (to be done)",
    enabled: false,
  },
  { id: "cz88", label: "Cambridge Z88 (in progress)", enabled: true },
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
