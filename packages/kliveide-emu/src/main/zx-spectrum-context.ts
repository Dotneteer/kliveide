import * as fs from "fs";

import { dialog, Menu, MenuItemConstructorOptions } from "electron";
import { LinkDescriptor, MachineContextProviderBase } from "./machine-context";
import { mainProcessStore } from "./mainProcessStore";
import {
  emulatorDisableFastLoadAction,
  emulatorEnableFastLoadAction,
  emulatorHideBeamPositionAction,
  emulatorSetClockMultiplierAction,
  emulatorSetTapeContenstAction,
} from "../shared/state/redux-emulator-state";
import { emulatorShowBeamPositionAction } from "../shared/state/redux-emulator-state";
import { EmulatorPanelState } from "../shared/state/AppState";
import { BinaryReader } from "../shared/utils/BinaryReader";
import { checkTapeFile } from "../shared/tape/readers";
import { IAppWindow } from "./IAppWindows";
import { AppWindow } from "./AppWindow";

// --- Menu identifier contants
const TOGGLE_BEAM = "sp_toggle_beam_position";
const TOGGLE_FAST_LOAD = "sp_toggle_fast_load";
const SET_TAPE_FILE = "sp_set_tape_file";

// --- ZX Spectrum-specific menu items
const zxSpectrumLinks: LinkDescriptor[] = [
  {
    label: "ZX Spectrum 48 BASIC",
    uri: "https://dotneteer.github.io/kliveide/spectrum/basic-toc.html",
  },
];

/**
 * Context provider for ZX Spectrum machine types
 */
export abstract class ZxSpectrumContextProviderBase extends MachineContextProviderBase {
  // --- The last used tape file
  private _lastTapeFile: string | null = null;

  /**
   * Instantiates the provider
   * @param appWindow: AppWindow instance
   */
  constructor(public appWindow: IAppWindow) {
    super();
  }

  /**
   * Items to add to the Show menu
   */
  provideViewMenuItems(): MenuItemConstructorOptions[] | null {
    return [
      {
        id: TOGGLE_BEAM,
        label: "Show ULA beam position",
        type: "checkbox",
        checked: true,
        click: (mi) => {
          if (mi.checked) {
            mainProcessStore.dispatch(emulatorShowBeamPositionAction());
          } else {
            mainProcessStore.dispatch(emulatorHideBeamPositionAction());
          }
        },
      },
      {
        id: TOGGLE_FAST_LOAD,
        label: "Fast load from tape",
        type: "checkbox",
        checked: true,
        click: (mi) => {
          if (mi.checked) {
            mainProcessStore.dispatch(emulatorEnableFastLoadAction());
          } else {
            mainProcessStore.dispatch(emulatorDisableFastLoadAction());
          }
        },
      },
    ];
  }

  /**
   * Items to add to the machine menu
   */
  provideMachineMenuItems(): MenuItemConstructorOptions[] | null {
    return [
      {
        id: SET_TAPE_FILE,
        label: "Set tape file...",
        click: async () => await this.selectTapeFile(),
      },
    ];
  }

  /**
   * When the application state changes, you can update the menus
   */
  updateMenuStatus(state: EmulatorPanelState): void {
    const menu = Menu.getApplicationMenu();
    const toggleBeam = menu.getMenuItemById(TOGGLE_BEAM);
    if (toggleBeam) {
      toggleBeam.checked = !!state.beamPosition;
    }
    const toggleFastLoad = menu.getMenuItemById(TOGGLE_FAST_LOAD);
    if (toggleFastLoad) {
      toggleFastLoad.checked = !!state.fastLoad;
    }
  }

  /**
   * Items to add to the Help menu
   */
  provideHelpMenuItems(): MenuItemConstructorOptions[] | null {
    return this.getHyperlinkItems(zxSpectrumLinks);
  }

  /**
   * The normal CPU frequency of the machine
   */
  abstract getNormalCpuFrequency(): number;

  /**
   * Override this method to get the machine-specific settings
   */
  getMachineSpecificSettings(): Record<string, any> {
    const state = mainProcessStore.getState().emulatorPanelState;
    return {
      fastLoad: state.fastLoad,
      showBeam: state.beamPosition,
      lastTapeFile: this._lastTapeFile,
      clockMultiplier: state.clockMultiplier,
      soundLevel: state.soundLevel
    };
  }

  /**
   * Override this method to set the machine-specific settings
   */
  async setMachineSpecificSettings(settings: Record<string, any>): Promise<void> {
    if (settings.clockMultiplier) {
      mainProcessStore.dispatch(
        emulatorSetClockMultiplierAction(settings.clockMultiplier)()
      );
    }
    if (settings.soundLevel) {
      AppWindow.instance.setSoundLevel(settings.soundLevel);
      AppWindow.instance.setSoundLevelMenu(false, settings.soundLevel);
    }
    mainProcessStore.dispatch(
      settings.fastLoad
        ? emulatorEnableFastLoadAction()
        : emulatorDisableFastLoadAction()
    );
    mainProcessStore.dispatch(
      settings.showBeam
        ? emulatorShowBeamPositionAction()
        : emulatorHideBeamPositionAction()
    );
    this._lastTapeFile = settings.lastTapeFile;
    if (settings.lastTapeFile) {
      try {
        const contents = fs.readFileSync(settings.lastTapeFile);
        if (checkTapeFile(new BinaryReader(contents))) {
          mainProcessStore.dispatch(emulatorSetTapeContenstAction(contents)());
        }
      } catch {
        // --- This error is intentionally ignored
      }
    } else {
      mainProcessStore.dispatch(emulatorSetTapeContenstAction(new Uint8Array(0))());
    }
  }

  /**
   * Select a tape file to use with the ZX Spectrum
   */
  private async selectTapeFile(): Promise<void> {
    const window = this.appWindow.window;
    const result = await dialog.showOpenDialog(window, {
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
          this._lastTapeFile = tapeFile;
          await dialog.showMessageBox(window, {
            title: `Tape file loaded`,
            message: `Tape file ${tapeFile} successfully loaded.`,
            type: "info",
          });
        } else {
          throw new Error("Could not process the contenst of tape file.");
        }
      } catch (err) {
        // --- This error is intentionally ignored
        await dialog.showMessageBox(window, {
          title: `Error processing the tape file ${tapeFile}`,
          message: err.toString(),
          type: "error",
          detail:
            "Please check if you have the appropriate access rights to read the files contents " +
            "and the file is a valid .tap or .tzx file (note: 'dsk' format is not supported, yet).",
        });
      }
    }
  }
}

/**
 * Context provider for the ZX Spectrum machine model
 */
export class ZxSpectrum48ContextProvider extends ZxSpectrumContextProviderBase {
  /**
   * Instantiates the provider
   * @param appWindow: AppWindow instance
   */
  constructor(public appWindow: IAppWindow) {
    super(appWindow);
  }

  /**
   * The normal CPU frequency of the machine
   */
  getNormalCpuFrequency(): number {
    return 3_500_000;
  }

  /**
   * Context description for ZX Spectrum 48
   */
  getMachineContextDescription(): string {
    return `Screen: 256x192, ROM: sp48.rom (16KB), RAM: 48KB`;
  }

  /**
   * Gets the startup ROMs for the machine
   */
  getStartupRoms(): Uint8Array[] | string {
    return this.loadRoms(["sp48.rom"], [0x4000]);
  }
}

/**
 * Context provider for the ZX Spectrum machine model
 */
export class ZxSpectrum128ContextProvider extends ZxSpectrumContextProviderBase {
  /**
   * Instantiates the provider
   * @param appWindow: AppWindow instance
   */
  constructor(public appWindow: IAppWindow) {
    super(appWindow);
  }

  /**
   * The normal CPU frequency of the machine
   */
  getNormalCpuFrequency(): number {
    return 3_546_900;
  }

  /**
   * Context description for ZX Spectrum 48
   */
  getMachineContextDescription(): string {
    return `Screen: 256x192, ROM: sp128.rom (32KB), RAM: 128KB`;
  }

  /**
   * Gets the startup ROMs for the machine
   */
  getStartupRoms(): Uint8Array[] | string {
    return this.loadRoms(["sp128-0.rom", "sp128-1.rom"], [0x4000]);
  }
}
