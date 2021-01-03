import * as fs from "fs";

import { dialog, Menu, MenuItemConstructorOptions } from "electron";
import { EmulatorPanelState } from "../shared/state/AppState";
import { MachineContextProviderBase } from "./machine-context";
import { mainProcessStore } from "./mainProcessStore";
import { machineCommandAction } from "../shared/state/redux-machine-command-state";
import {
  CZ88_HARD_RESET,
  CZ88_SOFT_RESET,
} from "../shared/machines/macine-commands";
import { IAppWindow } from "./IAppWindows";

// --- Menu identifier contants
const SOFT_RESET = "cz88_soft_reset";
const HARD_RESET = "cz88_hard_reset";
const LCD_DIMS = "cz88_lcd_dims";
const SELECT_ROM_FILE = "cz88_select_rom_file";

// --- Machine type (by LCD resolution) constants
const Z88_640_64 = "machine_cz88_255_8";
const Z88_640_320 = "machine_cz88_255_40";
const Z88_640_480 = "machine_cz88_255_60";
const Z88_800_320 = "machine_cz88_100_40";
const Z88_800_480 = "machine_cz88_100_60";

let lastLcdType = Z88_640_64;

/**
 * Represents the construction options of Z88
 */
export interface Cz88ContructionOptions {
  sch?: number;
  scw?: number;
  rom?: Uint8Array;
}

/**
 * Context provider for the Cambridge Z88 machine model
 */
export class Cz88ContextProvider extends MachineContextProviderBase {
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
    return null;
  }

  /**
   * Items to add to the machine menu
   */
  provideMachineMenuItems(): MenuItemConstructorOptions[] | null {
    return [
      {
        id: LCD_DIMS,
        type: "submenu",
        label: "LCD resolution",
        submenu: [
          {
            id: Z88_640_64,
            type: "radio",
            label: "640 x 64",
            click: () => this.requestMachine(Z88_640_64, { scw: 0xff, sch: 8 }),
          },
          {
            id: Z88_640_320,
            type: "radio",
            label: "640 x 320",
            click: () =>
              this.requestMachine(Z88_640_320, { scw: 0xff, sch: 40 }),
          },
          {
            id: Z88_640_480,
            type: "radio",
            label: "640 x 480",
            click: () =>
              this.requestMachine(Z88_640_480, { scw: 0xff, sch: 60 }),
          },
          {
            id: Z88_800_320,
            type: "radio",
            label: "800 x 320",
            click: () =>
              this.requestMachine(Z88_800_320, { scw: 100, sch: 40 }),
          },
          {
            id: Z88_800_480,
            type: "radio",
            label: "800 x 480",
            click: () =>
              this.requestMachine(Z88_800_480, { scw: 100, sch: 60 }),
          },
        ],
      },
      { type: "separator" },
      {
        id: SOFT_RESET,
        label: "Soft reset",
        accelerator: "F8",
        click: () =>
          mainProcessStore.dispatch(machineCommandAction(CZ88_SOFT_RESET)()),
      },
      {
        id: HARD_RESET,
        label: "Hard reset",
        accelerator: "F9",
        click: () =>
          mainProcessStore.dispatch(machineCommandAction(CZ88_HARD_RESET)()),
      },
      { type: "separator" },
      {
        id: SELECT_ROM_FILE,
        label: "Select ROM file...",
        click: async () => this.selectRomFile(),
      },
    ];
  }

  /**
   * When the application state changes, you can update the menus
   */
  updateMenuStatus(state: EmulatorPanelState): void {
    const menu = Menu.getApplicationMenu();
    const softReset = menu.getMenuItemById(SOFT_RESET);
    if (softReset) {
      // --- Soft reset is available only if the machine is started, paused, or stopped.
      softReset.enabled = state.executionState > 0;
    }

    // --- Select the current LCD dimension
    const lcdType = menu.getMenuItemById(lastLcdType);
    if (lcdType) {
      lcdType.checked = true;
    }
  }

  /**
   * The normal CPU frequency of the machine
   */
  getNormalCpuFrequency(): number {
    return 3_276_800;
  }

  /**
   * Gets the startup ROMs for the machine
   */
  getStartupRoms(): Uint8Array[] | string {
    return this.loadRoms(["Z88OZ47.rom"], [0x2_0000, 0x4_0000, 0x8_0000]);
  }

  /**
   * Sets the Z88 with the specified LCD type
   * @param typeId Machine type with LCD size specification
   */
  private requestMachine(id: string, options: Cz88ContructionOptions): void {
    const typeId = id.split("_").slice(1).join("_");
    this.appWindow.requestMachineType(typeId, options);
    lastLcdType = typeId;
  }

  /**
   * Select a ROM file to use with Z88
   */
  private async selectRomFile(): Promise<void> {
    const window = this.appWindow.window;
    const result = await dialog.showOpenDialog(window, {
      title: "Open ROM file",
      filters: [
        { name: "ROM files", extensions: ["rom"] },
        { name: "BIN files", extensions: ["bin"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    let romFile: string = "";
    if (!result.canceled) {
      try {
        romFile = result.filePaths[0];
        const contents = Uint8Array.from(fs.readFileSync(romFile));

        // --- Check contents length
        if (contents.length !== 0x8_0000 && contents.length !== 0x4_0000 && contents.length !== 0x2_0000) {
          await dialog.showMessageBox(window, {
            title: `Invalid ROM file length: ${contents.length}`,
            message: "The ROM file length can be 128K, 256K, or 512K.",
            type: "error",
          });
          return;
        }

        // --- Check watermark
        if (!this.isOZRom(contents)) {
          await dialog.showMessageBox(window, {
            title: `Invalid ROM file ${romFile}`,
            message: "The file does not contain the OZ ROM watermark.",
            type: "error",
          });
        }
      } catch (err) {
        // --- This error is intentionally ignored
        await dialog.showMessageBox(window, {
          title: `Error processing ROM file ${romFile}`,
          message: err.toString(),
          type: "error",
          detail:
            "Please check if you have the appropriate access rights to read the files contents " +
            "and the file is a valid ROM file.",
        });
      }
    }
  }

  /**
   * Check if specified slot contains an Application Card ('OZ' watermark)
   * @param contents Binary contents
   * @returns true if Application Card is available in slot; otherwise false
   */
  private isApplicationCard(contents: Uint8Array): boolean {
    const topBankOffset = (contents.length & 0xe_c000) - 0x4000;
    return (
      contents[topBankOffset + 0x3ffb] === 0x80 &&
      contents[topBankOffset + 0x3ffe] === "O".charCodeAt(0) &&
      contents[topBankOffset + 0x3fff] === "Z".charCodeAt(0)
    );
  }

  /**
   * Check if specified slot contains an OZ Operating system
   * @param contents Binary contents
   * @returns true if Application Card is available in slot; otherwise false
   */
  private isOZRom(contents: Uint8Array): boolean {
    const topBankOffset = (contents.length & 0xe_c000) - 0x4000;
    console.log(`offset: ${topBankOffset.toString(16)}`);
    return (
      contents[topBankOffset + 0x3ffb] === 0x81 &&
      contents[topBankOffset + 0x3ffe] === "O".charCodeAt(0) &&
      contents[topBankOffset + 0x3fff] === "Z".charCodeAt(0)
    );
  }
}
