import { BrowserWindow, Menu, MenuItemConstructorOptions } from "electron";
import { EmulatorPanelState } from "../shared/state/AppState";
import { MachineMenuProvider } from "./machine-menu";
import { mainProcessStore } from "./mainProcessStore";
import { machineCommandAction } from "../shared/state/redux-machine-command-state";
import {
  CZ88_HARD_RESET,
  CZ88_SOFT_RESET,
} from "../shared/machines/macine-commands";

// --- Menu identifier contants
const SOFT_RESET = "cz88_soft_reset";
const HARD_RESET = "cz88_hard_reset";

export class Cz88MenuProvider implements MachineMenuProvider {
  /**
   * Instantiates the provider
   * @param window Bowser window this menu provider is associated with
   */
  constructor(public window: BrowserWindow) {}

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
        id: SOFT_RESET,
        label: "Soft reset",
        click: () =>
          mainProcessStore.dispatch(machineCommandAction(CZ88_SOFT_RESET)()),
      },
      {
        id: HARD_RESET,
        label: "Hard reset",
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
  }

  /**
   * The normal CPU frequency of the machine
   */
  getNormalCpuFrequency(): number {
    return 3_276_800;
  }
}
