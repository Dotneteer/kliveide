import { BrowserWindow, MenuItemConstructorOptions } from "electron";
import { EmulatorPanelState } from "../shared/state/AppState";
import { MachineMenuProvider } from "./machine-menu";

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
    return null
  }

  /**
   * Items to add to the machine menu
   */
  provideMachineMenuItems(): MenuItemConstructorOptions[] | null {
    return null;
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
  }

  /**
   * The normal CPU frequency of the machine
   */
  getNormalCpuFrequency(): number {
      return 3_276_800;
  }
}
