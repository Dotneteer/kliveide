import { Menu, MenuItemConstructorOptions } from "electron";
import { EmulatorPanelState } from "../shared/state/AppState";
import { MachineMenuProvider } from "./machine-menu";
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

// --- Machine type (by LCD resolution) constants
const Z88_640_64 = "machine_cz88_255_8";
const Z88_640_320 = "machine_cz88_255_40";
const Z88_640_480 = "machine_cz88_255_60";
const Z88_800_320 = "machine_cz88_100_40";
const Z88_800_480 = "machine_cz88_100_60";

let lastLcdType = Z88_640_64;

export class Cz88MenuProvider implements MachineMenuProvider {

  /**
   * Instantiates the provider
   * @param appWindow: AppWindow instance
   */
  constructor(public appWindow: IAppWindow) {}

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
        type: "submenu",
        label: "LCD resolution",
        submenu: [
          {
            id: Z88_640_64,
            type: "radio",
            label: "640 x 64",
            click: () => this.setLcdType(Z88_640_64),
          },
          {
            id: Z88_640_320,
            type: "radio",
            label: "640 x 320",
            click: () => this.setLcdType(Z88_640_320),
          },
          {
            id: Z88_640_480,
            type: "radio",
            label: "640 x 480",
            click: () => this.setLcdType(Z88_640_480),
          },
          {
            id: Z88_800_320,
            type: "radio",
            label: "800 x 320",
            click: () => this.setLcdType(Z88_800_320),
          },
          {
            id: Z88_800_480,
            type: "radio",
            label: "800 x 480",
            click: () => this.setLcdType(Z88_800_480),
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
    const softReset = menu.getMenuItemById(SOFT_RESET);
    if (softReset) {
      // --- Soft reset is available only if the machine is started, paused, or stopped.
      softReset.enabled = state.executionState > 0;
    }
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
   * Sets the Z88 with the specified LCD type
   * @param typeId Machine type with LCD size specification
   */
  private setLcdType(typeId: string): void {
    const machineType = typeId.split("_").slice(1).join("_");
    this.appWindow.requestMachineType(machineType);
    lastLcdType = typeId;
  }
}
