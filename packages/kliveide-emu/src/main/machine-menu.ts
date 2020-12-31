import { MenuItem, MenuItemConstructorOptions } from "electron";
import { EmulatorPanelState } from "../shared/state/AppState";

/**
 * Describes the responsibility of a menu provider for a particular machine
 */
export interface MachineMenuProvider {
  /**
   * Items to add to the View menu
   */
  provideViewMenuItems(): MenuItemConstructorOptions[] | null;

  /**
   * Items to add to the machine menu
   */
  provideMachineMenuItems(): MenuItemConstructorOptions[] | null;

  /**
   * Items to add to the main menu, right after the machine menu
   */
  provideMainMenuItem(): MenuItemConstructorOptions | null;

  /**
   * When the application state changes, you can update the menus
   */
  updateMenuStatus(state: EmulatorPanelState): void;
}
