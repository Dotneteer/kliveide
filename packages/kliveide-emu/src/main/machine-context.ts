import * as fs from "fs";
import * as path from "path";

import { MenuItemConstructorOptions, shell } from "electron";
import { EmulatorPanelState } from "../shared/state/AppState";

/**
 * Describes the responsibility of a menu provider for a particular machine
 */
export interface MachineContextProvider {
  /**
   * Items to add to the View menu
   */
  provideViewMenuItems(): MenuItemConstructorOptions[] | null;

  /**
   * Items to add to the machine menu
   */
  provideMachineMenuItems(): MenuItemConstructorOptions[] | null;

  /**
   * Items to add to the Help menu
   */
  provideHelpMenuItems(): MenuItemConstructorOptions[] | null;

  /**
   * Items to add to the main menu, right after the machine menu
   */
  provideMainMenuItem(): MenuItemConstructorOptions | null;

  /**
   * When the application state changes, you can update the menus
   */
  updateMenuStatus(state: EmulatorPanelState): void;

  /**
   * The normal CPU frequency of the machine
   */
  getNormalCpuFrequency(): number;

  /**
   * Gets the startup ROMs for the machine
   */
  getStartupRoms(): Uint8Array[] | string;

  /**
   * Override this method tom provide a context description
   */
  getMachineContextDescription(): string;
}

export abstract class MachineContextProviderBase
  implements MachineContextProvider {
  /**
   * Items to add to the View menu
   */
  provideViewMenuItems(): MenuItemConstructorOptions[] | null {
    return null;
  }

  /**
   * Items to add to the Machine menu
   */
  provideMachineMenuItems(): MenuItemConstructorOptions[] | null {
    return null;
  }

  /**
   * Items to add to the Help menu
   */
  provideHelpMenuItems(): MenuItemConstructorOptions[] | null {
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
  updateMenuStatus(state: EmulatorPanelState): void {}

  /**
   * The normal CPU frequency of the machine
   */
  abstract getNormalCpuFrequency(): number;

  /**
   * Gets the startup ROMs for the machine
   */
  abstract getStartupRoms(): Uint8Array[] | string;

  /**
   * Override this method tom provide a context description
   */
  getMachineContextDescription(): string {
    return "";
  }

  /**
   * Loads the startup ROMs of the machine
   * @param filenames ROM file names relative to the "roms" folder
   * @param acceptedSizes Accepted ROM sizes in bytes
   * @param checkfunction Optional function to check ROM integrity
   * @returns The array of loaded ROMs, if ok. Otherwise, the error message
   */
  protected loadRoms(
    filenames: string[],
    acceptedSizes: number[],
    checkfunction?: (contents: Uint8Array) => string | null
  ): Uint8Array[] | string {
    const result: Uint8Array[] = [];

    // --- Iterate throug all ROM files
    try {
      for (let i = 0; i < filenames.length; i++) {
        // --- Read the file
        const romfile = path.join(__dirname, "roms", filenames[i]);
        const contents = fs.readFileSync(romfile);
        const byteArray = Uint8Array.from(contents);

        // --- Validate the size
        const matchingSize = acceptedSizes.find(
          (size) => byteArray.length === size
        );
        if (matchingSize === undefined) {
          return `ROM #${i} has an invalid size of ${byteArray.length}.`;
        }

        // --- Carry out the ROM consistency check
        if (checkfunction) {
          const check = checkfunction(byteArray);
          if (check) {
            return check;
          }
        }

        // --- This ROM file is OK.
        result.push(byteArray);
      }
    } catch (err) {
      // --- Return with the issue
      return err.toString();
    }
    return result;
  }

  /**
   * Gets hyperlink items from a LinkDescriptor array
   */
  protected getHyperlinkItems(
    links: LinkDescriptor[]
  ): MenuItemConstructorOptions[] {
    return links.map((li) => ({
      type: li.label ? "normal" : "separator",
      label: li?.label,
      click: async () => {
        if (li.uri) {
          await shell.openExternal(li.uri);
        }
      },
    }));
  }
}

/**
 * Describes a link in the Helpmenu
 */
export interface LinkDescriptor {
  /**
   * Label to display. Set null to display a separator.
   */
  label: string | null;

  /**
   * Uri to access
   */
  uri?: string;
}
