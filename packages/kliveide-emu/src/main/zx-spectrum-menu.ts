import * as fs from "fs";

import {
  BrowserWindow,
  dialog,
  Menu,
  MenuItemConstructorOptions,
} from "electron";
import { MachineMenuProvider } from "./machine-menu";
import { mainProcessStore } from "./mainProcessStore";
import {
  emulatorDisableFastLoadAction,
  emulatorEnableFastLoadAction,
  emulatorHideBeamPositionAction,
  emulatorSetTapeContenstAction,
} from "../shared/state/redux-emulator-state";
import { emulatorShowBeamPositionAction } from "../shared/state/redux-emulator-state";
import { EmulatorPanelState } from "../shared/state/AppState";
import { BinaryReader } from "../shared/utils/BinaryReader";
import { checkTapeFile } from "../shared/tape/readers";
import { IAppWindow } from "./IAppWindows";

// --- Menu identifier contants
const TOGGLE_BEAM = "sp_toggle_beam_position";
const TOGGLE_FAST_LOAD = "sp_toggle_fast_load";
const SET_TAPE_FILE = "sp_set_tape_file";

export abstract class ZxSpectrumMenuProviderBase
  implements MachineMenuProvider {
  /**
   * Instantiates the provider
   * @param appWindow: AppWindow instance
   */
  constructor(public appWindow: IAppWindow) {}

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
   * Items to add to the main menu, right after the machine menu
   */
  provideMainMenuItem(): MenuItemConstructorOptions | null {
    return null;
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
   * The normal CPU frequency of the machine
   */
  abstract getNormalCpuFrequency(): number;

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
 * Menu provider for the ZX Spectrum machine model
 */
export class ZxSpectrum48MenuProvider extends ZxSpectrumMenuProviderBase {
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
}

/**
 * Menu provider for the ZX Spectrum machine model
 */
export class ZxSpectrum128MenuProvider extends ZxSpectrumMenuProviderBase {
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
}
