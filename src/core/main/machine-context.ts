import * as fs from "fs";
import * as path from "path";

import { MenuItemConstructorOptions, shell } from "electron";
import { AppState } from "@state/AppState";
import { ExtraMachineFeatures } from "@abstractions/machine-specfic";
import { MachineCreationOptions } from "../abstractions/vm-core-types";

/**
 * Describes the responsibility of a menu provider for a particular machine
 */
export interface MachineContextProvider {
  /**
   * Gets the names of firmware files
   */
  readonly firmwareFiles: string[];

  /**
   * Firmware sizes accected by the virtual machine
   */
  readonly acceptedFirmwareSizes: number[] | null;

  /**
   * Function that checks the firmware integrity
   */
  readonly checkFirmware?: (contents: Uint8Array) => string | null;

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
  updateMenuStatus(state: AppState): void;

  /**
   * The normal CPU frequency of the machine
   */
  getNormalCpuFrequency(): number;

  /**
   * Gets the startup ROMs for the machine
   * @param options Machine setup options
   * @return Firmware contents, if found; otherwise, error message
   */
  getFirmware(options?: MachineCreationOptions): Uint8Array[] | string;

  /**
   * Override this method tom provide a context description
   */
  getMachineContextDescription(): string;

  /**
   * Override this method to get the machine-specific settings
   */
  getMachineSpecificSettings(): Record<string, any>;

  /**
   * Override this method to set the machine-specific settings
   */
  setMachineSpecificSettings(
    settings: Record<string, any>
  ): Promise<MachineCreationOptions | null>;

  /**
   * Get the list of machine features supported
   */
  getExtraMachineFeatures(): ExtraMachineFeatures[];
}

/**
 * Root implementation of MachineContextProvider. Use this base
 * class for your context provider classes.
 */
export abstract class MachineContextProviderBase
  implements MachineContextProvider
{
  /**
   * Constructs the provider with the specified options
   * @param options
   */
  constructor(protected readonly options?: Record<string, any>) {}

  /**
   * Gets the names of firmware files
   */
  abstract readonly firmwareFiles: string[];

  /**
   * Firmware sizes accected by the virtual machine
   */
  readonly acceptedFirmwareSizes: number[] | null = null;

  /**
   * Function that checks the firmware integrity
   */
  readonly checkFirmware?: (contents: Uint8Array) => string | null;

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
  updateMenuStatus(state: AppState): void {}

  /**
   * The normal CPU frequency of the machine
   */
  abstract getNormalCpuFrequency(): number;

  /**
   * Gets the startup ROMs for the machine
   * @param options Machine setup options
   * @return Firmware contents, if found; otherwise, error message
   */
  getFirmware(options?: MachineCreationOptions): Uint8Array[] | string {
    if (options?.firmware) {
      return options.firmware;
    }
    return this.loadFirmware();
  }

  /**
   * Override this method tom provide a context description
   */
  getMachineContextDescription(): string {
    return "";
  }

  /**
   * Override this method to get the machine-specific settings
   */
  getMachineSpecificSettings(): Record<string, any> {
    return {};
  }

  /**
   * Override this method to set the machine-specific settings
   */
  async setMachineSpecificSettings(
    _settings: Record<string, any>
  ): Promise<MachineCreationOptions | null> {
    return null;
  }

  /**
   * Get the list of machine features supported
   */
  getExtraMachineFeatures(): ExtraMachineFeatures[] {
    return [];
  }

  /**
   * Loads the startup ROMs of the machine
   * @param filenames ROM file names relative to the "roms" folder
   * @param acceptedSizes Accepted ROM sizes in bytes
   * @param checkfunction Optional function to check ROM integrity
   * @returns The array of loaded ROMs, if ok. Otherwise, the error message
   */
  protected loadFirmware(): Uint8Array[] | string {
    const result: Uint8Array[] = [];

    // --- Iterate throug all ROM files
    try {
      for (let i = 0; i < this.firmwareFiles.length; i++) {
        // --- Read the file
        const romfile = path.join(__dirname, "roms", this.firmwareFiles[i]);
        const contents = fs.readFileSync(romfile);
        const byteArray = Uint8Array.from(contents);

        // --- Validate the size
        if (this.acceptedFirmwareSizes) {
          const matchingSize = this.acceptedFirmwareSizes.find(
            (size) => byteArray.length === size
          );
          if (matchingSize === undefined) {
            return `ROM #${i} has an invalid size of ${byteArray.length}.`;
          }
        }

        // --- Carry out the ROM consistency check
        if (this.checkFirmware) {
          const check = this.checkFirmware(byteArray);
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
