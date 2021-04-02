import {
  app,
  BrowserWindow,
  ipcMain,
  IpcMainEvent,
  Menu,
  MenuItem,
  MenuItemConstructorOptions,
} from "electron";
import { setMachineTypeAction } from "../shared/state/machine-type-reducer";
import {
  emuHideKeyboardAction,
  emuHideStatusbarAction,
  emuHideToolbarAction,
  emuShowKeyboardAction,
  emuShowStatusbarAction,
  emuShowToolbarAction,
} from "../shared/state/emu-view-options-reducer";
import { AppWindow } from "./AppWindow";
import { __DARWIN__ } from "./electron-utils";
import { mainStore } from "./mainStore";
import { MessengerBase } from "../shared/messaging/MessengerBase";
import {
  RequestMessage,
  ResponseMessage,
} from "../shared/messaging/message-types";
import {
  MAIN_TO_EMU_REQUEST_CHANNEL,
  MAIN_TO_EMU_RESPONE_CHANNEL,
} from "../shared/messaging/channels";
import { IEmuAppWindow } from "./IEmuAppWindow";
import {
  MachineContextProvider,
  MachineContextProviderBase,
} from "./machine-context";
import {
  ZxSpectrum128ContextProvider,
  ZxSpectrum48ContextProvider,
} from "./zx-spectrum-context";
import { MachineCreationOptions } from "../renderer/machines/vm-core-types";

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
 * Represents the singleton emulator window
 */
export class EmuWindow extends AppWindow implements IEmuAppWindow {
  private _machineContextProvider: MachineContextProvider;

  /**
   * Now, we allow only a singleton instance
   */
  static instance: EmuWindow;

  /**
   * Messaging channel to the Emulator renderer
   */
  readonly emuMessenger: MainToEmulatorMessenger;

  /**
   * Initializes the window instance
   */
  constructor() {
    super();
    EmuWindow.instance = this;
    this.emuMessenger = new MainToEmulatorMessenger(this.window);
  }

  get contentFile(): string {
    return "emu-index.html";
  }

  /**
   * The file to store the window state
   */
  get stateFile(): string {
    return "emu-window-state.json";
  }

  /**
   * The window has been closed
   */
  onClosed(): void {
    app.quit();
  }

  /**
   * Sets up the application menu
   */
  setupMenu(): void {
    // // --- Merge startup configuration and settings
    // const viewOptions = appSettings?.viewOptions ?? {
    //   showToolbar: true,
    //   showStatusbar: true,
    //   showFrameInfo: true,
    // };

    // if (viewOptions.showFrameInfo === undefined) {
    //   viewOptions.showFrameInfo = appConfiguration?.viewOptions.showFrameInfo;
    // }
    // if (viewOptions.showToolbar === undefined) {
    //   viewOptions.showToolbar = appConfiguration?.viewOptions?.showToolbar;
    // }
    // if (viewOptions.showStatusbar === undefined) {
    //   viewOptions.showStatusbar = appConfiguration?.viewOptions?.showStatusbar;
    // }
    // if (viewOptions.showKeyboard === undefined) {
    //   viewOptions.showKeyboard = appConfiguration?.viewOptions?.showStatusbar;
    // }

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
        visible: true, //appConfiguration?.viewOptions?.showDevTools ?? false,
        enabled: true, //appConfiguration?.viewOptions?.showDevTools ?? false,
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
        click: (mi) =>
          this.checkboxAction(
            mi,
            emuShowKeyboardAction(),
            emuHideKeyboardAction()
          ),
      },
      { type: "separator" },
    ];

    // let extraViewItems: MenuItemConstructorOptions[] =
    //   this._machineContextProvider?.provideViewMenuItems() ?? [];
    // if (extraViewItems.length > 0) {
    //   extraViewItems.push({ type: "separator" });
    // }
    // viewSubMenu.push(...extraViewItems);

    viewSubMenu.push(
      {
        id: TOGGLE_TOOLBAR,
        label: "Show toolbar",
        type: "checkbox",
        checked: true, //viewOptions.showToolbar ?? true,
        click: (mi) =>
          this.checkboxAction(
            mi,
            emuShowToolbarAction(),
            emuHideToolbarAction()
          ),
      },
      {
        id: TOGGLE_STATUSBAR,
        label: "Show statusbar",
        type: "checkbox",
        checked: true, //viewOptions.showStatusbar ?? true,
        click: (mi) =>
          this.checkboxAction(
            mi,
            emuShowStatusbarAction(),
            emuHideStatusbarAction()
          ),
      },
      {
        id: TOGGLE_FRAMES,
        label: "Show frame information",
        type: "checkbox",
        checked: true, //viewOptions.showFrameInfo ?? true,
        click: (mi) => {
          if (mi.checked) {
            //mainProcessStore.dispatch(emulatorShowFramesAction());
          } else {
            //mainProcessStore.dispatch(emulatorHideFramesAction());
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
          click: async () => {
            console.log("StartVm");
            await this.emuMessenger.sendMessage({ type: "startVm" });
          },
        },
        {
          id: PAUSE_VM,
          label: "Pause",
          accelerator: "Shift+F5",
          enabled: false,
          click: async () =>
            await this.emuMessenger.sendMessage({ type: "pauseVm" }),
        },
        {
          id: STOP_VM,
          label: "Stop",
          accelerator: "F4",
          enabled: false,
          click: async () =>
            await this.emuMessenger.sendMessage({ type: "stopVm" }),
        },
        {
          id: RESTART_VM,
          label: "Restart",
          accelerator: "Shift+F4",
          enabled: false,
          click: async () =>
            await this.emuMessenger.sendMessage({ type: "restartVm" }),
        },
        { type: "separator" },
        {
          id: DEBUG_VM,
          label: "Start with debugging",
          accelerator: "Ctrl+F5",
          enabled: true,
          click: async () =>
            await this.emuMessenger.sendMessage({ type: "debugVm" }),
        },
        {
          id: STEP_INTO_VM,
          label: "Step into",
          accelerator: "F3",
          enabled: false,
          click: async () =>
            await this.emuMessenger.sendMessage({ type: "stepIntoVm" }),
        },
        {
          id: STEP_OVER_VM,
          label: "Step over",
          accelerator: "Shift+F3",
          enabled: false,
          click: async () =>
            await this.emuMessenger.sendMessage({ type: "stepOverVm" }),
        },
        {
          id: STEP_OUT_VM,
          label: "Step out",
          accelerator: "Ctrl+F3",
          enabled: false,
          click: async () =>
            await this.emuMessenger.sendMessage({ type: "stepOutVm" }),
        },
      ],
    };
    template.push(runMenu);

    // --- Prepare the machine menu
    const machineSubMenu: MenuItemConstructorOptions[] = [];
    // for (let i = 0; i < MACHINE_MENU_ITEMS.length; i++) {
    //   machineSubMenu.push({
    //     id: menuIdFromMachineId(MACHINE_MENU_ITEMS[i].id),
    //     label: MACHINE_MENU_ITEMS[i].label,
    //     type: "radio",
    //     checked: i ? false : true,
    //     enabled: MACHINE_MENU_ITEMS[i].enabled,
    //     click: async (mi) => {
    //       try {
    //         this.saveAppSettings();
    //       } catch {
    //         // --- Intentionally ignored
    //       }
    //       const machineType = mi.id.split("_")[1];
    //       this.requestMachineType(machineType);
    //       // --- Wait while the menu is instantiated
    //       await new Promise((r) => setTimeout(r, 200));
    //       this.setMachineTypeMenu(mi.id);
    //       await new Promise((r) => setTimeout(r, 200));
    //       AppWindow.instance.applyStoredSettings(machineType);
    //     },
    //   });
    // }

    machineSubMenu.push(
      { type: "separator" },
      {
        id: SOUND_MENU_ITEMS[0].id,
        label: "Mute sound",
        type: "radio",
        checked: false,
        //click: () => this.setSoundLevel(SOUND_MENU_ITEMS[0].level),
      },
      {
        id: SOUND_MENU_ITEMS[1].id,
        label: "Sound: Low ",
        type: "radio",
        checked: false,
        //click: () => this.setSoundLevel(SOUND_MENU_ITEMS[1].level),
      },
      {
        id: SOUND_MENU_ITEMS[2].id,
        label: "Sound: Medium",
        type: "radio",
        checked: false,
        //click: () => this.setSoundLevel(SOUND_MENU_ITEMS[2].level),
      },
      {
        id: SOUND_MENU_ITEMS[3].id,
        label: "Sound: High",
        type: "radio",
        checked: true,
        //click: () => this.setSoundLevel(SOUND_MENU_ITEMS[3].level),
      },
      {
        id: SOUND_MENU_ITEMS[4].id,
        label: "Sound: Highest",
        type: "radio",
        checked: false,
        //click: () => this.setSoundLevel(SOUND_MENU_ITEMS[4].level),
      }
    );

    // const emuState = mainProcessStore.getState().emulatorPanelState;
    // emuState.internalState;
    // const cpuClockSubmenu: MenuItemConstructorOptions = {
    //   type: "submenu",
    //   label: "CPU clock multiplier",
    //   submenu: [],
    // };
    // const baseClockFrequency =
    //   this._machineContextProvider?.getNormalCpuFrequency() ?? 1_000_000;

    // for (let i = 1; i <= 24; i++) {
    //   (cpuClockSubmenu.submenu as MenuItemConstructorOptions[]).push({
    //     id: `clockMultiplier_${i}`,
    //     type: "radio",
    //     label:
    //       (i > 1 ? `${i}x` : `Normal`) +
    //       ` (${((i * baseClockFrequency) / 1_000_000).toFixed(4)}MHz)`,
    //     click: () => {
    //       mainProcessStore.dispatch(emulatorSetClockMultiplierAction(i)());
    //     },
    //   });
    // }
    // machineSubMenu.push({ type: "separator" });
    // machineSubMenu.push(cpuClockSubmenu);

    // let extraMachineItems: MenuItemConstructorOptions[] =
    //   this._machineContextProvider?.provideMachineMenuItems() ?? [];
    // if (extraMachineItems.length > 0) {
    //   machineSubMenu.push({ type: "separator" });
    //   machineSubMenu.push(...extraMachineItems);
    // }

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

    // const helpSubmenu: MenuItemConstructorOptions[] = [
    //   {
    //     label: "Klive on Github",
    //     click: async () => {
    //       await shell.openExternal("https://github.com/Dotneteer/kliveide");
    //     },
    //   },
    //   {
    //     label: "Getting started with Klive",
    //     click: async () => {
    //       await shell.openExternal(
    //         "https://dotneteer.github.io/kliveide/getting-started/install-kliveide.html"
    //       );
    //     },
    //   },
    // ];
    // let extraHelpItems: MenuItemConstructorOptions[] =
    //   this._machineContextProvider?.provideHelpMenuItems() ?? [];
    // if (extraHelpItems.length > 0) {
    //   helpSubmenu.push({ type: "separator" });
    //   helpSubmenu.push(...extraHelpItems);
    // }

    // template.push({
    //   role: "help",
    //   submenu: helpSubmenu,
    // });
    const menu = Menu.buildFromTemplate(template);
    this.window.setMenu(menu);
    // Menu.setApplicationMenu(menu);

    // if (this._machineContextProvider) {
    //   mainProcessStore.dispatch(
    //     emulatorSetMachineContextAction(
    //       this._machineContextProvider.getMachineContextDescription()
    //     )()
    //   );
    // }
  }

  /**
   * Saves the current application settings
   */
  saveAppSettings(): void {
    const state = mainStore.getState();
    // const machineType = state.currentType.split("_")[0];
    // const kliveSettings: KliveSettings = {
    //   machineType,
    //   viewOptions: {
    //     showToolbar: state.showToolbar,
    //     showFrameInfo: state.showFrames,
    //     showKeyboard: state.keyboardPanel,
    //     showStatusbar: state.statusbar,
    //     keyboardHeight: state.keyboardHeight,
    //   },
    // };
    // if (this._machineContextProvider) {
    //   kliveSettings.machineSpecific = appSettings?.machineSpecific;
    //   if (!kliveSettings.machineSpecific) {
    //     kliveSettings.machineSpecific = {};
    //   }
    //   kliveSettings.machineSpecific[
    //     machineType
    //   ] = this._machineContextProvider.getMachineSpecificSettings();
    // }
    // saveKliveSettings(kliveSettings);
    // reloadSettings();
  }

  // ==========================================================================
  // IEmuAppWindow implementation

  /**
   * Posts a message from the renderer to the main
   * @param message Message contents
   */
  postMessageToEmulator(message: RequestMessage): void {}

  /**
   * Requests a machine type according to its menu ID
   * @param id Machine type, or menu ID of the machine type
   * @param options Machine construction options
   */
  async requestMachineType(id: string, options?: MachineCreationOptions): Promise<void> {
    // #1: Create the context provider for the machine
    const contextProvider = contextRegistry[id];
    if (!contextProvider) {
      // TODO: issue an error
      return;
    }

    // #2: Set up the firmware
    this._machineContextProvider = new (contextProvider as any)(options) as MachineContextProvider;
    const firmware = this._machineContextProvider.getFirmware();
    if (typeof firmware === "string") {
      // TODO: issue an error
      console.log(`firmware issue: ${firmware}`);
      return;
    }
    const creationOptions = {...options, firmware }

    // #3: Instantiate the machine

    mainStore.dispatch(setMachineTypeAction(id));
    console.log(`Machine type changed to: ${id}`);
  }

  // ==========================================================================
  // Helpers

  /**
   * Ensures that the Emulator UI is started
   */
  async ensureStarted(): Promise<void> {
    return new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (mainStore.getState().emuUiLoaded) {
          clearInterval(interval);
          resolve();
        }
      }, 20);
    });
  }
}

/**
 * This class sends messages from main to the emulator window
 */
class MainToEmulatorMessenger extends MessengerBase {
  /**
   * Initializes the listener that processes responses
   */
  constructor(public readonly window: BrowserWindow) {
    super();
    ipcMain.on(
      this.responseChannel,
      (_ev: IpcMainEvent, response: ResponseMessage) =>
        this.processResponse(response)
    );
  }

  /**
   * Sends out the message
   * @param message Message to send
   */
  protected send(message: RequestMessage): void {
    this.window.webContents.send(this.requestChannel, message);
  }

  /**
   * The channel to send the request out
   */
  readonly requestChannel = MAIN_TO_EMU_REQUEST_CHANNEL;

  /**
   * The channel to listen for responses
   */
  readonly responseChannel = MAIN_TO_EMU_RESPONE_CHANNEL;
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

/**
 * Stores the registry of context providers
 */
const contextRegistry: Record<string, typeof MachineContextProviderBase> = {
  sp48: ZxSpectrum48ContextProvider,
  sp128: ZxSpectrum128ContextProvider,
};
