import * as fs from "fs";
import * as path from "path";

import { dialog, Menu, MenuItemConstructorOptions } from "electron";
import { EmulatorPanelState } from "@state/AppState";
import { LinkDescriptor, MachineContextProviderBase } from "./machine-context";
import { mainProcessStore } from "./mainProcessStore";
import { machineCommandAction } from "@state/redux-machine-command-state";
import {
  CZ88_BATTERY_LOW,
  CZ88_HARD_RESET,
  CZ88_PRESS_BOTH_SHIFTS,
  CZ88_SOFT_RESET,
} from "../shared/machines/macine-commands";
import { IAppWindow } from "./IAppWindows";
import {
  machineIdFromMenuId,
  menuIdFromMachineId,
} from "./utils/electron-utils";
import {
  emulatorSetClockMultiplierAction,
  emulatorSetKeyboardAction,
  emulatorSetMachineContextAction,
} from "@state/redux-emulator-state";
import { AppWindow } from "./AppWindow";

// --- Default ROM file
const DEFAULT_ROM = "Z88OZ47.rom";

// --- Menu identifier contants
const SOFT_RESET = "cz88_soft_reset";
const HARD_RESET = "cz88_hard_reset";
const PRESS_SHIFTS = "cz88_press_shifts";
const BATTERY_LOW = "cz88_battery_low";
const LCD_DIMS = "cz88_lcd_dims";
const ROM_MENU = "cz88_roms";
const SELECT_ROM_FILE = "cz88_select_rom_file";
const USE_DEFAULT_ROM = "cz88_use_default_rom";
const USE_ROM_FILE = "cz88_rom";
const KEYBOARDS = "cz88_keyboards";
const DE_KEYBOARD = "cz88_de_layout";
const DK_KEYBOARD = "cz88_dk_layout";
const FR_KEYBOARD = "cz88_fr_layout";
const ES_KEYBOARD = "cz88_es_layout";
const SE_KEYBOARD = "cz88_se_layout";
const UK_KEYBOARD = "cz88_uk_layout";
const INSERT_CARDS = "cz88_insert_cards";
const INS_SLOT1 = "cz88_insert_slot1";
const INS_SLOT2 = "cz88_insert_slot2";
const INS_SLOT3 = "cz88_insert_slot3";
const REMOVE_CARDS = "cz88_remove_cards";
const REM_SLOT1 = "cz88_remove_slot1";
const REM_SLOT2 = "cz88_remove_slot2";
const REM_SLOT3 = "cz88_remove_slot3";

// --- Machine type (by LCD resolution) constants
const Z88_640_64 = "machine_cz88_255_8";
const Z88_640_320 = "machine_cz88_255_40";
const Z88_640_480 = "machine_cz88_255_60";
const Z88_800_320 = "machine_cz88_100_40";
const Z88_800_480 = "machine_cz88_100_60";

// ----------------------------------------------------------------------------
// Z88-specific help menu items
const z88Links: LinkDescriptor[] = [
  {
    label: "Cambridge Z88 User Guide",
    uri: "https://cambridgez88.jira.com/wiki/spaces/UG/",
  },
  {
    label: "Cambridge Z88 Developers' Notes",
    uri: "https://cambridgez88.jira.com/wiki/spaces/DN/",
  },
  {
    label: "BBC BASIC (Z80) Reference Guide for Z88",
    uri: "https://docs.google.com/document/d/1ZFxKYsfNvbuTyErnH5Xtv2aKXWk1vg5TjrAxZnrLsuI",
  },
  {
    label: null,
  },
  {
    label: "Cambridge Z88 ROM && 3rd party application source code",
    uri: "https://bitbucket.org/cambridge/",
  },
  {
    label: "Cambridge Z88 on Wikipedia",
    uri: "https://en.wikipedia.org/wiki/Cambridge_Z88",
  },
  {
    label: "Cambridge Z88 assembler tools and utilities",
    uri: "https://gitlab.com/bits4fun",
  },
];

// ----------------------------------------------------------------------------
// We use these two variables to identify the current Z88 machine type

// The last used LCD specification
let recentLcdType = machineIdFromMenuId(Z88_640_64);
let lcdLabel = "640x64";

// The name of the recent ROM
let recentRomName: string | null = null;
// The current ROM size
let romSize = 512;
// The current RAM size
let ramSize = 512;
// The current keyboard layout
let kbLayout = "uk";

// !!! Temporary implementation
let lastSlot1FileName: string | null = null;
let lastSlot2FileName: string | null = null;
let lastSlot3FileName: string | null = null;
// !!! End

// ----------------------------------------------------------------------------
// Configuration we use to instantiate the Z88 machine

let recentOptions: Cz88ContructionOptions = {
  scw: 0xff,
  sch: 8,
};

// ----------------------------------------------------------------------------
// UI state of the ROM submenu

// The list of recently used ROMs
let recentRoms: string[] = [];
// Indicates that a recent ROM is selected. If false, we use the default ROM
let recentRomSelected = false;

/**
 * Represents the construction options of Z88
 */
export interface Cz88ContructionOptions {
  sch?: number;
  scw?: number;
  rom?: Uint8Array;
  slot1?: Uint8Array;
  slot2?: Uint8Array;
  slot3?: Uint8Array;
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
   * The normal CPU frequency of the machine
   */
  getNormalCpuFrequency(): number {
    return 3_276_800;
  }

  /**
   * Context description for Z88
   */
  getMachineContextDescription(): string {
    return `Screen: ${lcdLabel}, ROM: ${
      recentRomName ?? DEFAULT_ROM
    } (${romSize}KB), RAM: ${ramSize}KB`;
  }

  /**
   * Sets the current machine context
   */
  setContext(): void {
    mainProcessStore.dispatch(
      emulatorSetMachineContextAction(this.getMachineContextDescription())()
    );
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
    // --- Create the submenu of recent roms
    const romsSubmenu: MenuItemConstructorOptions[] = [];
    romsSubmenu.push({
      id: USE_DEFAULT_ROM,
      label: "Use default ROM",
      type: "checkbox",
      checked: !recentRomSelected,
      click: (mi) => {
        mi.checked = true;
        recentRomSelected = false;
        const lastRomId = `${USE_ROM_FILE}_0`;
        const item = Menu.getApplicationMenu().getMenuItemById(lastRomId);
        if (item) {
          item.checked = false;
        }
        if (recentOptions?.rom) {
          recentRomName = null;
          recentOptions = { ...recentOptions, rom: undefined };
          this.requestMachine();
        }
        this.setContext();
      },
    });
    if (recentRoms.length > 0) {
      romsSubmenu.push({ type: "separator" });
      for (let i = 0; i < recentRoms.length; i++) {
        romsSubmenu.push({
          id: `${USE_ROM_FILE}_${i}`,
          label: path.basename(recentRoms[i]),
          type: i === 0 ? "checkbox" : "normal",
          checked: i === 0 && recentRomSelected,
          click: () => this.selectRecentRomItem(i),
        });
      }
    }
    romsSubmenu.push(
      { type: "separator" },
      {
        id: SELECT_ROM_FILE,
        label: "Select ROM file...",
        click: async () => await this.selectRomFileToUse(),
      }
    );
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
            click: () => this.setLcd(Z88_640_64, "640x64", 0xff, 8),
          },
          {
            id: Z88_640_320,
            type: "radio",
            label: "640 x 320",
            click: () => this.setLcd(Z88_640_320, "640x320", 0xff, 40),
          },
          {
            id: Z88_640_480,
            type: "radio",
            label: "640 x 480",
            click: () => this.setLcd(Z88_640_480, "640x480", 0xff, 60),
          },
          {
            id: Z88_800_320,
            type: "radio",
            label: "800 x 320",
            click: () => this.setLcd(Z88_800_320, "800x320", 100, 40),
          },
          {
            id: Z88_800_480,
            type: "radio",
            label: "800 x 480",
            click: () => this.setLcd(Z88_800_480, "800x480", 100, 60),
          },
        ],
      },
      {
        id: KEYBOARDS,
        label: "Keyboard layout",
        type: "submenu",
        submenu: [
          {
            id: UK_KEYBOARD,
            label: "British && American",
            type: "radio",
            click: () => {
              kbLayout = "uk";
              mainProcessStore.dispatch(emulatorSetKeyboardAction(kbLayout)());
            },
          },
          {
            id: ES_KEYBOARD,
            label: "Spanish",
            type: "radio",
            click: () => {
              kbLayout = "es";
              mainProcessStore.dispatch(emulatorSetKeyboardAction(kbLayout)());
            },
          },
          {
            id: FR_KEYBOARD,
            label: "French",
            type: "radio",
            click: () => {
              kbLayout = "fr";
              mainProcessStore.dispatch(emulatorSetKeyboardAction(kbLayout)());
            },
          },
          {
            id: DE_KEYBOARD,
            label: "German",
            type: "radio",
            click: () => {
              kbLayout = "de";
              mainProcessStore.dispatch(emulatorSetKeyboardAction(kbLayout)());
            },
          },
          {
            id: DK_KEYBOARD,
            label: "Danish && Norwegian",
            type: "radio",
            click: () => {
              kbLayout = "dk";
              mainProcessStore.dispatch(emulatorSetKeyboardAction(kbLayout)());
            },
          },
          {
            id: SE_KEYBOARD,
            label: "Swedish && Finish",
            type: "radio",
            click: () => {
              kbLayout = "se";
              mainProcessStore.dispatch(emulatorSetKeyboardAction(kbLayout)());
            },
          },
        ],
      },
      { type: "separator" },
      {
        id: SOFT_RESET,
        label: "Soft reset",
        accelerator: "F8",
        click: async () => await this.softReset(),
      },
      {
        id: HARD_RESET,
        label: "Hard reset",
        accelerator: "F9",
        click: async () => await this.hardReset(),
      },
      { type: "separator" },
      {
        id: PRESS_SHIFTS,
        label: "Press both SHIFT keys",
        accelerator: "F6",
        click: async () => await this.pressBothShifts(),
      },
      {
        id: BATTERY_LOW,
        label: "Raise Battery low signal",
        click: async () => await this.raiseBatteryLow(),
      },
      { type: "separator" },
      {
        id: ROM_MENU,
        type: "submenu",
        label: "Select ROM",
        submenu: romsSubmenu,
      },
      { type: "separator" },
      {
        id: INSERT_CARDS,
        label: "Insert card in",
        type: "submenu",
        submenu: [
          {
            id: INS_SLOT1,
            label: `Slot 1${lastSlot1FileName ? ` (${path.basename(lastSlot1FileName)})` : ""}`,
            click: () => {
              this.selectCardFileToUse(1)
            },
          },
          {
            id: INS_SLOT2,
            label: `Slot 2${lastSlot2FileName ? ` (${path.basename(lastSlot2FileName)})` : ""}`,
            click: () => {
              this.selectCardFileToUse(2)
            },
          },
          {
            id: INS_SLOT3,
            label: `Slot 3${lastSlot3FileName ? ` (${path.basename(lastSlot3FileName)})` : ""}`,
            click: () => {
              this.selectCardFileToUse(3)
            },
          },
        ],
      },
      { type: "separator" },
      {
        id: REMOVE_CARDS,
        label: "Remove card from",
        type: "submenu",
        submenu: [
          {
            id: REM_SLOT1,
            label: "Slot 1",
            click: () => {
              this.removeCardFromSlot(1);
            },
          },
          {
            id: REM_SLOT2,
            label: "Slot 2",
            click: () => {
              this.removeCardFromSlot(2);
            },
          },
          {
            id: REM_SLOT3,
            label: "Slot 3",
            click: () => {
              this.removeCardFromSlot(3);
            },
          },
        ],
      },
    ];
  }

  /**
   * Items to add to the Help menu
   */
  provideHelpMenuItems(): MenuItemConstructorOptions[] | null {
    return this.getHyperlinkItems(z88Links);
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
    const lcdType = menu.getMenuItemById(menuIdFromMachineId(recentLcdType));
    if (lcdType) {
      lcdType.checked = true;
    }

    // --- Select the current keyboard layout
    const keyboardId = `cz88_${
      state?.keyboardLayout ? state.keyboardLayout : "uk"
    }_layout`;
    const keyboardItem = menu.getMenuItemById(keyboardId);
    if (keyboardItem) {
      keyboardItem.checked = true;
    }

    // --- Enable/disable commands requiring a running machine
    const bothShifts = menu.getMenuItemById(PRESS_SHIFTS);
    if (bothShifts) {
      bothShifts.enabled = state.executionState === 1;
    }
    const batLow = menu.getMenuItemById(BATTERY_LOW);
    if (batLow) {
      batLow.enabled = state.executionState === 1;
    }
  }

  /**
   * Gets the startup ROMs for the machine
   */
  getStartupRoms(): Uint8Array[] | string {
    return this.loadRoms([DEFAULT_ROM], [0x2_0000, 0x4_0000, 0x8_0000]);
  }

  /**
   * Override this method to get the machine-specific settings
   */
  getMachineSpecificSettings(): Record<string, any> {
    const state = mainProcessStore.getState().emulatorPanelState;
    return {
      lcd: lcdLabel,
      kbLayout,
      romFile: recentRoms.length > 0 ? recentRoms[0] : null,
      slot1File: lastSlot1FileName,
      slot2File: lastSlot2FileName,
      slot3File: lastSlot3FileName,
      clockMultiplier: state.clockMultiplier,
      soundLevel: state.soundLevel,
    };
  }

  /**
   * Override this method to set the machine-specific settings
   */
  async setMachineSpecificSettings(
    settings: Record<string, any>
  ): Promise<void> {
    if (settings.lcd) {
      switch (settings.lcd) {
        case "640x64":
          this.setLcd(Z88_640_64, "640x64", 0xff, 8);
          break;

        case "640x320":
          this.setLcd(Z88_640_320, "640x320", 0xff, 40);
          break;

        case "640x480":
          this.setLcd(Z88_640_480, "640x480", 0xff, 60);
          break;

        case "800x320":
          this.setLcd(Z88_800_320, "800x320", 100, 40);
          break;

        case "800x480":
          this.setLcd(Z88_800_480, "800x480", 100, 60);
          break;
      }
    }
    if (settings.kbLayout) {
      switch (settings.kbLayout) {
        case "uk":
        case "fr":
        case "es":
        case "de":
        case "dk":
        case "se":
          kbLayout = settings.kbLayout;
          mainProcessStore.dispatch(emulatorSetKeyboardAction(kbLayout)());
          break;
      }
    }
    if (settings.clockMultiplier) {
      mainProcessStore.dispatch(
        emulatorSetClockMultiplierAction(settings.clockMultiplier)()
      );
    }
    if (settings.soundLevel) {
      AppWindow.instance.setSoundLevel(settings.soundLevel);
      AppWindow.instance.setSoundLevelMenu(false, settings.soundLevel);
    }

    await new Promise((r) => setTimeout(r, 600));
    if (settings.romFile) {
      await this.selectRomFileToUse(settings.romFile);
    }
    if (settings.slot1File) {
      await this.selectCardFileToUse(1, settings.slot1File);
    }
    if (settings.slot2File) {
      await this.selectCardFileToUse(2, settings.slot2File);
    }
    if (settings.slot3File) {
      await this.selectCardFileToUse(3, settings.slot3File);
    }
  }

  /**
   * Sets the Z88 with the specified LCD type
   * @param typeId Machine type with LCD size specification
   */
  private requestMachine(): void {
    const typeId = `${recentLcdType}_${recentRomName ?? ""}_${lastSlot1FileName ?? "$"}_${lastSlot2FileName ?? "$"}_${lastSlot3FileName ?? "$"}`;
    this.appWindow.requestMachineType(typeId, recentOptions);
  }

  /**
   * Sets the Z88 LCD mode
   * @param menuId LCD menu id
   * @param label LCD label
   * @param scw LCD width
   * @param sch LCD height
   */
  private setLcd(
    menuId: string,
    label: string,
    scw: number,
    sch: number
  ): void {
    recentLcdType = machineIdFromMenuId(menuId);
    lcdLabel = label;
    recentOptions = { ...recentOptions, scw, sch };
    this.requestMachine();
    this.setContext();
  }

  /**
   * Select the ROM file to use with Z88
   */
  private async selectRomFileToUse(filename?: string): Promise<void> {
    if (!filename) {
      filename = await this.selectRomFileFromDialog();
      if (!filename) {
        return;
      }
    }

    const contents = await this.checkCz88Rom(filename);
    if (typeof contents === "string") {
      await dialog.showMessageBox(this.appWindow.window, {
        title: "ROM error",
        message: contents,
        type: "error",
      });
      return;
    }

    // --- Ok, let's use the contents of this file
    recentOptions = { ...recentOptions, rom: contents };

    // --- Use the selected contents
    const recentFileIdx = recentRoms.indexOf(filename);
    if (recentFileIdx >= 0) {
      recentRoms.splice(recentFileIdx, 1);
    }
    recentRoms.unshift(filename);
    recentRoms.splice(4);

    // --- Now set the ROM name and refresh the menu
    recentRomName = path.basename(filename);
    recentRomSelected = true;
    this.appWindow.setupMenu();

    // --- Request the current machine type
    this.requestMachine();
  }

  /**
   * Select a ROM file to use with Z88
   */
  private async selectRomFileFromDialog(): Promise<string | null> {
    const window = this.appWindow.window;
    const result = await dialog.showOpenDialog(window, {
      title: "Open ROM file",
      filters: [
        { name: "ROM files", extensions: ["rom"] },
        { name: "BIN files", extensions: ["bin"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    return result ? result.filePaths[0] : null;
  }

  /**
   * Select the card file to use with Z88
   */
  private async selectCardFileToUse(
    slot: number,
    filename?: string
  ): Promise<void> {
    if (!filename) {
      filename = await this.selectCardFileFromDialog();
      if (!filename) {
        return;
      }
    }

    const contents = await this.checkSlotFile(filename);
    if (typeof contents === "string") {
      await dialog.showMessageBox(this.appWindow.window, {
        title: "Card file error",
        message: contents,
        type: "error",
      });
      return;
    }

    switch (slot) {
      case 1:
        lastSlot1FileName = filename;
        recentOptions = { ...recentOptions, slot1: contents };
        break;
      case 2:
        lastSlot2FileName = filename;
        recentOptions = { ...recentOptions, slot2: contents };
        break;
      default:
        lastSlot3FileName = filename;
        recentOptions = { ...recentOptions, slot3: contents };
        break;
    }

    // --- Now refresh the menu
    this.appWindow.setupMenu();

    // --- Request the current machine type
    this.requestMachine();
  }

  /**
   * Removes card from the specified slot
   * @param slot Slot index
   */
  private removeCardFromSlot(slot: number): void {
    switch (slot) {
      case 1:
        lastSlot1FileName = null;
        recentOptions = { ...recentOptions, slot1: null };
        break;
      case 2:
        lastSlot2FileName = null;
        recentOptions = { ...recentOptions, slot2: null };
        break;
      default:
        lastSlot3FileName = null;
        recentOptions = { ...recentOptions, slot3: null };
        break;
    }

    // --- Now refresh the menu
    this.appWindow.setupMenu();

    // --- Request the current machine type
    this.requestMachine();
  }

  /**
   * Select a ROM file to use with Z88
   */
  private async selectCardFileFromDialog(): Promise<string | null> {
    const window = this.appWindow.window;
    const result = await dialog.showOpenDialog(window, {
      title: "Open EPROM file",
      filters: [
        { name: "EPR files", extensions: ["epr"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    return result ? result.filePaths[0] : null;
  }

  /**
   * Checks if the specified file is a valid Z88 ROM
   * @param filename ROM file name
   * @returns The contents, if the ROM is valid; otherwise, the error message
   */
  private async checkCz88Rom(filename: string): Promise<string | Uint8Array> {
    try {
      const contents = Uint8Array.from(fs.readFileSync(filename));

      // --- Check contents length
      if (
        contents.length !== 0x8_0000 &&
        contents.length !== 0x4_0000 &&
        contents.length !== 0x2_0000
      ) {
        return `Invalid ROM file length: ${contents.length}. The ROM file length can be 128K, 256K, or 512K.`;
      }

      // --- Check watermark
      if (!this.isOZRom(contents)) {
        return "The file does not contain the OZ ROM watermark.";
      }
      // --- Done: valid ROM
      return contents;
    } catch (err) {
      // --- This error is intentionally ignored
      return (
        `Error processing ROM file ${filename}. ` +
        "Please check if you have the appropriate access rights " +
        "to read the files contents and the file is a valid ROM file."
      );
    }
  }

  /**
   * Checks if the specified file is a valid Z88 ROM
   * @param filename ROM file name
   * @returns The contents, if the ROM is valid; otherwise, the error message
   */
   private async checkSlotFile(filename: string): Promise<string | Uint8Array> {
    try {
      const contents = Uint8Array.from(fs.readFileSync(filename));

      // --- Check contents length
      if (
        contents.length !== 0x10_0000 &&
        contents.length !== 0x08_0000 &&
        contents.length !== 0x04_0000 &&
        contents.length !== 0x02_0000 &&
        contents.length !== 0x00_8000
      ) {
        return `Invalid card file length: ${contents.length}. The card file length can be 32K, 128K, 256K, 512K, or 1M.`;
      }

      // --- Check watermark
      // --- Done: valid ROM
      return contents;
    } catch (err) {
      // --- This error is intentionally ignored
      return (
        `Error processing card file ${filename}. ` +
        "Please check if you have the appropriate access rights " +
        "to read the files contents and the file is a valid ROM file."
      );
    }
  }

  /**
   * Selects one of the recent ROM items
   * @param idx Selected ROM index
   */
  private selectRecentRomItem(idx: number): void {
    if (idx < 0 || idx >= recentRoms.length) {
      return;
    }

    this.selectRomFileToUse(recentRoms[idx]);
  }

  /**
   *
   */
  private checkTopRecentRom(): void {
    // --- Clear the default ROM
    const defaultItem =
      Menu.getApplicationMenu().getMenuItemById(USE_DEFAULT_ROM);
    if (defaultItem) {
      defaultItem.checked = false;
    }

    // --- Set the top ROM
    const lastRomId = `${USE_ROM_FILE}_0`;
    const item = Menu.getApplicationMenu().getMenuItemById(lastRomId);
    if (item) {
      item.checked = true;
    }
  }

  /**
   * Check if specified slot contains an OZ Operating system
   * @param contents Binary contents
   * @returns true if Application Card is available in slot; otherwise false
   */
  private isOZRom(contents: Uint8Array): boolean {
    const topBankOffset = (contents.length & 0xe_c000) - 0x4000;
    return (
      contents[topBankOffset + 0x3ffb] === 0x81 &&
      contents[topBankOffset + 0x3ffe] === "O".charCodeAt(0) &&
      contents[topBankOffset + 0x3fff] === "Z".charCodeAt(0)
    );
  }

  /**
   * Execure soft reset
   */
  private async softReset(): Promise<void> {
    if (await this.confirmReset("Soft")) {
      mainProcessStore.dispatch(machineCommandAction(CZ88_SOFT_RESET)());
    }
  }

  /**
   * Execute hard reset
   */
  private async hardReset(): Promise<void> {
    if (await this.confirmReset("Hard")) {
      mainProcessStore.dispatch(machineCommandAction(CZ88_HARD_RESET)());
    }
  }

  /**
   * Press both shift keys
   */
  private async pressBothShifts(): Promise<void> {
    mainProcessStore.dispatch(machineCommandAction(CZ88_PRESS_BOTH_SHIFTS)());
  }

  /**
   * Press both shift keys
   */
  private async raiseBatteryLow(): Promise<void> {
    mainProcessStore.dispatch(machineCommandAction(CZ88_BATTERY_LOW)());
  }

  /**
   * Display a confirm message for reset
   */
  private async confirmReset(type: string): Promise<boolean> {
    const result = await dialog.showMessageBox(this.appWindow.window, {
      title: `Confirm Cambridge Z88 ${type} Reset`,
      message: "Are you sure you want to reset the machine?",
      buttons: ["Yes", "No"],
      defaultId: 0,
      type: "question",
    });
    return result.response === 0;
  }
}
