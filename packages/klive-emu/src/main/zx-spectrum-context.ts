import * as fs from "fs";

import { dialog, Menu, MenuItemConstructorOptions } from "electron";
import { LinkDescriptor, MachineContextProviderBase } from "./machine-context";
import { AppState } from "../shared/state/AppState";
import { BinaryReader } from "../shared/utils/BinaryReader";
import { checkTapeFile } from "../shared/tape/readers";
import { mainStore } from "./mainStore";
import {
  spectrumBeamPositionAction,
  spectrumFastLoadAction,
  spectrumTapeContentsAction,
} from "../shared/state/spectrum-specific-reducer";
import { emuSetClockMultiplierAction } from "../shared/state/emulator-panel-reducer";
import { EmuWindow } from "./EmuWindow";

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
   * Constructs the provider with the specified options
   * @param options
   */
  constructor(options?: Record<string, any>) {
    super(options);
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
        click: (mi) =>
          mainStore.dispatch(spectrumBeamPositionAction(mi.checked)),
      },
      {
        id: TOGGLE_FAST_LOAD,
        label: "Fast load from tape",
        type: "checkbox",
        checked: true,
        click: (mi) => mainStore.dispatch(spectrumFastLoadAction(mi.checked)),
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
  updateMenuStatus(state: AppState): void {
    const menu = Menu.getApplicationMenu();
    const toggleBeam = menu.getMenuItemById(TOGGLE_BEAM);
    if (toggleBeam) {
      toggleBeam.checked = !!state.spectrumSpecific?.showBeamPosition;
    }
    const toggleFastLoad = menu.getMenuItemById(TOGGLE_FAST_LOAD);
    if (toggleFastLoad) {
      toggleFastLoad.checked = !!state.spectrumSpecific?.fastLoad;
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
    const state = mainStore.getState();
    const spectrum = state.spectrumSpecific;
    return {
      fastLoad: !!spectrum?.fastLoad,
      showBeam: !!spectrum?.showBeamPosition,
      lastTapeFile: this._lastTapeFile,
      clockMultiplier: state.emulatorPanel?.clockMultiplier ?? 1,
      soundLevel: state.emulatorPanel?.soundLevel ?? 1.0,
    };
  }

  /**
   * Override this method to set the machine-specific settings
   */
  async setMachineSpecificSettings(
    settings: Record<string, any>
  ): Promise<void> {
    if (settings.clockMultiplier) {
      mainStore.dispatch(emuSetClockMultiplierAction(settings.clockMultiplier));
    }
    if (settings.soundLevel) {
      // TODO: Implement this
      //   AppWindow.instance.setSoundLevel(settings.soundLevel);
      //   AppWindow.instance.setSoundLevelMenu(false, settings.soundLevel);
    }
    mainStore.dispatch(spectrumFastLoadAction(!!settings.fastLoad));
    mainStore.dispatch(spectrumBeamPositionAction(!!settings.showBeam));
    this._lastTapeFile = settings.lastTapeFile;
    if (settings.lastTapeFile) {
      try {
        const contents = fs.readFileSync(settings.lastTapeFile);
        if (checkTapeFile(new BinaryReader(contents))) {
          mainStore.dispatch(spectrumTapeContentsAction(contents));
        }
      } catch {
        // --- This error is intentionally ignored
      }
    } else {
      mainStore.dispatch(spectrumTapeContentsAction(new Uint8Array(0)));
    }
  }

  /**
   * Select a tape file to use with the ZX Spectrum
   */
  private async selectTapeFile(): Promise<void> {
    const window = EmuWindow.instance.window;
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
          mainStore.dispatch(spectrumTapeContentsAction(contents));
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
   * Constructs the provider with the specified options
   * @param options
   */
  constructor(options?: Record<string, any>) {
    super(options);
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
   * @return Firmware contents, if found; otherwise, error message
   */
   getFirmware(): Uint8Array[] | string {
    return this.loadRoms(["sp48.rom"], [0x4000]);
  }
}

/**
 * Context provider for the ZX Spectrum machine model
 */
export class ZxSpectrum128ContextProvider extends ZxSpectrumContextProviderBase {
  /**
   * Constructs the provider with the specified options
   * @param options
   */
  constructor(options?: Record<string, any>) {
    super(options);
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
   * @return Firmware contents, if found; otherwise, error message
   */
   getFirmware(): Uint8Array[] | string {
    return this.loadRoms(["sp128-0.rom", "sp128-1.rom"], [0x4000]);
  }
}
