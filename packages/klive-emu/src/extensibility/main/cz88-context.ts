import * as fs from "fs";
import * as path from "path";

import { Menu, MenuItemConstructorOptions } from "electron";
import {
  emuMachineContextAction,
  emuSetClockMultiplierAction,
  emuSetKeyboardLayoutAction,
} from "../../shared/state/emulator-panel-reducer";
import {
  machineIdFromMenuId,
  menuIdFromMachineId,
} from "../../main/utils/electron-utils";
import { LinkDescriptor, MachineContextProviderBase } from "./machine-context";
import { mainStore } from "../../main/main-state/main-store";
import {
  emuMessenger,
  emuWindow,
  setSoundLevel,
  setSoundLevelMenu,
  setupMenu,
} from "../../main/app/app-menu";
import { dialog } from "electron";
import { AppState } from "../../shared/state/AppState";
import { MachineCreationOptions } from "../../renderer/machines/core/vm-core-types";
import {
  CZ88_BATTERY_LOW,
  CZ88_CARDS,
  CZ88_HARD_RESET,
  CZ88_PRESS_BOTH_SHIFTS,
  CZ88_REFRESH_OPTIONS,
  CZ88_SOFT_RESET,
} from "../../shared/machines/macine-commands";
import {
  Cz88ContructionOptions,
  SlotContent,
  Z88CardsState,
} from "../../shared/machines/cz88-specific";
import { ExecuteMachineCommandResponse } from "../../shared/messaging/message-types";
import { ExtraMachineFeatures } from "../../shared/machines/machine-specfic";
import { VirtualMachineType } from "./machine-registry";

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
const CARDS_DIALOG = "cz88_cards_dialog";
const KEYBOARDS = "cz88_keyboards";
const DE_KEYBOARD = "cz88_de_layout";
const DK_KEYBOARD = "cz88_dk_layout";
const FR_KEYBOARD = "cz88_fr_layout";
const ES_KEYBOARD = "cz88_es_layout";
const SE_KEYBOARD = "cz88_se_layout";
const UK_KEYBOARD = "cz88_uk_layout";

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

// The current ROM file (null, if default is used)
let usedRomFile: string | null = null;
// The current ROM size
let romSize = 512;
// The current RAM size
let ramSize = 512;
// The current keyboard layout
let kbLayout = "uk";

// ----------------------------------------------------------------------------
// Configuration we use to instantiate the Z88 machine

let recentOptions: MachineCreationOptions & Cz88ContructionOptions = {
  baseClockFrequency: 1,
  tactsInFrame: 16384,
  scw: 0xff,
  sch: 8,
};

// ----------------------------------------------------------------------------
// UI state of the ROM submenu

// The list of recently used ROMs
let recentRoms: string[] = [];
// Indicates that a recent ROM is selected. If false, we use the default ROM
let recentRomSelected = false;

// ----------------------------------------------------------------------------
// State of the card slots

let slotsState: Z88CardsState = {
  slot1: { content: "empty" },
  slot2: { content: "empty" },
  slot3: { content: "empty" },
};

/**
 * Context provider for the Cambridge Z88 machine type
 */
@VirtualMachineType({
  id: "cz88",
  label: "Cambridge Z88 (in progress)",
  active: true,
})
export class Cz88ContextProvider extends MachineContextProviderBase {
  /**
   * Constructs the provider with the specified options
   * @param options
   */
  constructor(options?: Record<string, any>) {
    super(options);
  }

  /**
   * Gets the names of firmware files
   */
  readonly firmwareFiles: string[] = [DEFAULT_ROM];

  /**
   * Firmware sizes accected by the virtual machine
   */
  readonly acceptedFirmwareSizes: number[] | null = [
    0x2_0000, 0x4_0000, 0x8_0000,
  ];

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
      usedRomFile ? path.basename(usedRomFile) : DEFAULT_ROM
    } (${romSize}KB), RAM: ${ramSize}KB`;
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
        usedRomFile = null;
        const lastRomId = `${USE_ROM_FILE}_0`;
        const item = Menu.getApplicationMenu().getMenuItemById(lastRomId);
        if (item) {
          item.checked = false;
        }
        if (recentOptions?.firmware) {
          recentOptions = { ...recentOptions, firmware: undefined };
          this.requestMachine();
        }
        this.setContext();
        emuWindow.saveKliveProject();
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
          click: async () => {
            await this.selectRecentRomItem(i);
            emuWindow.saveKliveProject();
          },
        });
      }
    }
    romsSubmenu.push(
      { type: "separator" },
      {
        id: SELECT_ROM_FILE,
        label: "Select ROM file...",
        click: async () => {
          await this.selectRomFileToUse();
          emuWindow.saveKliveProject();
        },
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
            click: async () => await this.setLcd(Z88_640_64, "640x64", 0xff, 8),
          },
          {
            id: Z88_640_320,
            type: "radio",
            label: "640 x 320",
            click: async () =>
              await this.setLcd(Z88_640_320, "640x320", 0xff, 40),
          },
          {
            id: Z88_640_480,
            type: "radio",
            label: "640 x 480",
            click: async () =>
              await this.setLcd(Z88_640_480, "640x480", 0xff, 60),
          },
          {
            id: Z88_800_320,
            type: "radio",
            label: "800 x 320",
            click: async () =>
              await this.setLcd(Z88_800_320, "800x320", 100, 40),
          },
          {
            id: Z88_800_480,
            type: "radio",
            label: "800 x 480",
            click: async () =>
              await this.setLcd(Z88_800_480, "800x480", 100, 60),
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
            click: () => setKbLayout("uk"),
          },
          {
            id: ES_KEYBOARD,
            label: "Spanish",
            type: "radio",
            click: () => setKbLayout("es"),
          },
          {
            id: FR_KEYBOARD,
            label: "French",
            type: "radio",
            click: () => setKbLayout("fr"),
          },
          {
            id: DE_KEYBOARD,
            label: "German",
            type: "radio",
            click: () => setKbLayout("de"),
          },
          {
            id: DK_KEYBOARD,
            label: "Danish && Norwegian",
            type: "radio",
            click: () => setKbLayout("dk"),
          },
          {
            id: SE_KEYBOARD,
            label: "Swedish && Finish",
            type: "radio",
            click: () => setKbLayout("se"),
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
        id: CARDS_DIALOG,
        label: "Insert or remove cards",
        click: async () => await this.insertOrRemoveCards(),
      },
    ];

    function setKbLayout(layout: string): void {
      kbLayout = layout;
      mainStore.dispatch(emuSetKeyboardLayoutAction(kbLayout));
      emuWindow.saveKliveProject();
    }
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
  updateMenuStatus(state: AppState): void {
    const menu = Menu.getApplicationMenu();
    const softReset = menu.getMenuItemById(SOFT_RESET);
    if (softReset) {
      // --- Soft reset is available only if the machine is started, paused, or stopped.
      softReset.enabled = state.emulatorPanel.executionState > 0;
    }

    // --- Select the current LCD dimension
    const lcdType = menu.getMenuItemById(menuIdFromMachineId(recentLcdType));
    if (lcdType) {
      lcdType.checked = true;
    }

    // --- Select the current keyboard layout
    const keyboardId = `cz88_${
      state.emulatorPanel.keyboardLayout ?? "uk"
    }_layout`;
    const keyboardItem = menu.getMenuItemById(keyboardId);
    if (keyboardItem) {
      keyboardItem.checked = true;
    }

    // --- Enable/disable commands requiring a running machine
    const bothShifts = menu.getMenuItemById(PRESS_SHIFTS);
    if (bothShifts) {
      bothShifts.enabled = state.emulatorPanel.executionState === 1;
    }
    const batLow = menu.getMenuItemById(BATTERY_LOW);
    if (batLow) {
      batLow.enabled = state.emulatorPanel.executionState === 1;
    }
  }

  /**
   * Get the list of machine features supported
   */
  getExtraMachineFeatures(): ExtraMachineFeatures[] {
    return ["Z88Cards"];
  }

  /**
   * Sets the Z88 with the specified LCD type
   * @param typeId Machine type with LCD size specification
   */
  private async requestMachine(): Promise<void> {
    const typeId = "cz88";
    await emuWindow.requestMachineType(typeId, recentOptions);
  }

  /**
   * Override this method to get the machine-specific settings
   */
  getMachineSpecificSettings(): Record<string, any> {
    const state = mainStore.getState().emulatorPanel;
    return {
      lcd: lcdLabel,
      kbLayout,
      romFile: usedRomFile,
      clockMultiplier: state.clockMultiplier,
      soundLevel: state.soundLevel,
      muted: state.muted,
      slotsState,
    };
  }

  /**
   * Override this method to set the machine-specific settings
   */
  async setMachineSpecificSettings(
    settings: Record<string, any>
  ): Promise<MachineCreationOptions | null> {
    if (settings.lcd) {
      switch (settings.lcd) {
        case "640x64":
          await this.setLcd(Z88_640_64, "640x64", 0xff, 8);
          break;

        case "640x320":
          await this.setLcd(Z88_640_320, "640x320", 0xff, 40);
          break;

        case "640x480":
          await this.setLcd(Z88_640_480, "640x480", 0xff, 60);
          break;

        case "800x320":
          await this.setLcd(Z88_800_320, "800x320", 100, 40);
          break;

        case "800x480":
          await this.setLcd(Z88_800_480, "800x480", 100, 60);
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
          mainStore.dispatch(emuSetKeyboardLayoutAction(kbLayout));
          break;
      }
    }
    if (settings.clockMultiplier) {
      mainStore.dispatch(emuSetClockMultiplierAction(settings.clockMultiplier));
    }
    if (settings.soundLevel) {
      setSoundLevel(settings.soundLevel);
      setSoundLevelMenu(settings.muted, settings.soundLevel);
    }

    await new Promise((r) => setTimeout(r, 600));
    if (settings.romFile) {
      await this.selectRomFileToUse(settings.romFile);
    }

    // --- Handle slot states
    if (settings.slotsState) {
      slotsState = settings.slotsState;
    }

    await this.processSlotState(1);
    await this.processSlotState(2);
    await this.processSlotState(3);
    return recentOptions;
  }

  /**
   * Processes the slot information for the specified card
   * @param slot
   * @returns
   */
  private async processSlotState(
    slot: number
  ): Promise<Uint8Array | undefined> {
    const anySlot = slotsState as any;
    if (!anySlot) {
      return;
    }

    const slotProp = `slot${slot}`;
    const cardProp = `card${slot}`;

    if (!anySlot[slotProp]) {
      anySlot[slotProp] = { content: "empty" };
    } else {
      let eprom: Uint8Array | undefined;
      let ramSize: number | undefined;
      switch (anySlot[slotProp].content) {
        case "32K":
          ramSize = 0x00_8000;
          break;
        case "128K":
          ramSize = 0x02_0000;
          break;
        case "512K":
          ramSize = 0x08_0000;
          break;
        case "1M":
          ramSize = 0x10_0000;
          break;
        case "eprom":
          const contents = await this.selectCardFileToUse(
            anySlot[slotProp].epromFile
          );
          if (contents) {
            eprom = contents;
          }
          break;
      }
      recentOptions[cardProp] = {
        ramSize,
        eprom,
      };
      return eprom;
    }
  }

  /**
   * Sets the Z88 LCD mode
   * @param menuId LCD menu id
   * @param label LCD label
   * @param scw LCD width
   * @param sch LCD height
   */
  private async setLcd(
    menuId: string,
    label: string,
    scw: number,
    sch: number
  ): Promise<void> {
    recentLcdType = machineIdFromMenuId(menuId);
    lcdLabel = label;
    recentOptions = { ...recentOptions, scw, sch };
    await this.requestMachine();
    this.setContext();
    emuWindow.saveKliveProject();
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
      await dialog.showMessageBox(emuWindow.window, {
        title: "ROM error",
        message: contents,
        type: "error",
      });
      return;
    }

    // --- Ok, let's use the contents of this file
    recentOptions = { ...recentOptions, firmware: [contents] };

    // --- Use the selected contents
    const recentFileIdx = recentRoms.indexOf(filename);
    if (recentFileIdx >= 0) {
      recentRoms.splice(recentFileIdx, 1);
    }
    usedRomFile = filename;
    recentRoms.unshift(filename);
    recentRoms.splice(4);

    // --- Now set the ROM name and refresh the menu
    recentRomSelected = true;
    setupMenu();

    // --- Request the current machine type
    await this.requestMachine();
  }

  /**
   * Select a ROM file to use with Z88
   */
  private async selectRomFileFromDialog(): Promise<string | null> {
    const window = emuWindow.window;
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
    filename?: string
  ): Promise<Uint8Array | null> {
    if (!filename) {
      return;
    }
    const contents = await this.checkSlotFile(filename);
    if (typeof contents === "string") {
      await dialog.showMessageBox(emuWindow.window, {
        title: "Card file error",
        message: contents,
        type: "error",
      });
      return null;
    }
    return contents;
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
  private async selectRecentRomItem(idx: number): Promise<void> {
    if (idx < 0 || idx >= recentRoms.length) {
      return;
    }

    await this.selectRomFileToUse(recentRoms[idx]);
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
      this.executeMachineCommand(CZ88_SOFT_RESET);
    }
  }

  /**
   * Execute hard reset
   */
  private async hardReset(): Promise<void> {
    if (await this.confirmReset("Hard")) {
      this.executeMachineCommand(CZ88_HARD_RESET);
    }
  }

  /**
   * Execute insert/remove cards
   */
  async insertOrRemoveCards(): Promise<void> {
    const lastSlotState = { ...slotsState } as Z88CardsState;
    const result = (await this.executeMachineCommand(
      CZ88_CARDS,
      slotsState
    )) as Z88CardsState;
    if (result) {
      let changed = false;
      let useSoftReset = true;
      slotsState = result;

      if (
        lastSlotState.slot1?.content !== slotsState.slot1?.content ||
        lastSlotState.slot1?.epromFile !== slotsState.slot1?.epromFile
      ) {
        changed = true;
        if (changed) {
          useSoftReset =
            useSoftReset &&
            requiresSoftReset(
              lastSlotState.slot1?.content,
              slotsState.slot1?.content
            );
          await this.processSlotState(1);
        }
      }
      if (
        lastSlotState.slot2?.content !== slotsState.slot2?.content ||
        lastSlotState.slot2?.epromFile !== slotsState.slot2?.epromFile
      ) {
        changed = true;
        if (changed) {
          useSoftReset =
            useSoftReset &&
            requiresSoftReset(
              lastSlotState.slot2?.content,
              slotsState.slot2?.content
            );
        }
        await this.processSlotState(2);
      }
      if (
        lastSlotState.slot3?.content !== slotsState.slot3?.content ||
        lastSlotState.slot3?.epromFile !== slotsState.slot3?.epromFile
      ) {
        changed = true;
        if (changed) {
          useSoftReset =
            useSoftReset &&
            requiresSoftReset(
              lastSlotState.slot3?.content,
              slotsState.slot3?.content
            );
        }
        await this.processSlotState(3);
      }
      if (changed) {
        this.executeMachineCommand(CZ88_REFRESH_OPTIONS, recentOptions);
        if (useSoftReset) {
          this.executeMachineCommand(CZ88_SOFT_RESET);
        } else {
          const stateBefore =
            mainStore.getState().emulatorPanel?.executionState ?? 0;
          await this.requestMachine();
          if (stateBefore) {
            await this.executeMachineCommand(CZ88_HARD_RESET);
          }
        }
      }
    }

    // --- Check if slot content change requires a soft reset
    function requiresSoftReset(
      oldContent: SlotContent,
      newContent: SlotContent
    ): boolean {
      return (
        (oldContent === "eprom" && newContent === "empty") ||
        (oldContent === "empty" && newContent === "eprom") ||
        (oldContent === "empty" && newContent === "empty") ||
        (oldContent === "eprom" && newContent === "eprom")
      );
    }
  }

  /**
   * Executes the specified machine command
   * @param command Command to execute
   */
  private async executeMachineCommand(
    command: string,
    args?: unknown
  ): Promise<unknown> {
    const response = (await emuMessenger.sendMessage({
      type: "ExecuteMachineCommand",
      command,
      args,
    })) as ExecuteMachineCommandResponse;
    return response.result;
  }

  /**
   * Press both shift keys
   */
  private async pressBothShifts(): Promise<void> {
    this.executeMachineCommand(CZ88_PRESS_BOTH_SHIFTS);
  }

  /**
   * Press both shift keys
   */
  private async raiseBatteryLow(): Promise<void> {
    this.executeMachineCommand(CZ88_BATTERY_LOW);
  }

  /**
   * Display a confirm message for reset
   */
  private async confirmReset(type: string): Promise<boolean> {
    const result = await dialog.showMessageBox(emuWindow.window, {
      title: `Confirm Cambridge Z88 ${type} Reset`,
      message: "Are you sure you want to reset the machine?",
      buttons: ["Yes", "No"],
      defaultId: 0,
      type: "question",
    });
    return result.response === 0;
  }

  /**
   * Sets the current machine context
   */
  setContext(): void {
    mainStore.dispatch(
      emuMachineContextAction(this.getMachineContextDescription())
    );
  }
}
