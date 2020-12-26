import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { BreakpointDefinition } from "./breakpoints";

// ============================================================================
// File and folder name constants

// --- The location of spectrum system files
export const KLIVE_PROJ_FOLDER = ".klive";
export const KLIVE_CONFIG_FILE = "klive.machine";
export const KLIVE_CONFIG_FULL = path.join(KLIVE_PROJ_FOLDER, KLIVE_CONFIG_FILE);
export const TAPE_FOLDER = "tape";
export const CODE_FOLDER = "code";
export const CODE_FILE = "code.z80asm";
export const CODE_BAS_FILE = "program.bor";
export const MEMORY_FILE = "view.memory";
export const DISASSEMBLY_FILE = "view.disassembly";
export const BASIC_FILE = "view.basic";
export const JETSET_TAPE = "jet-set-willy.tzx";
export const JUNGLE_TAPE = "jungle-trouble.tzx";
export const PACMAN_TAPE = "pac-man.tzx";
export const TEMPLATE_PATH = "out/templates";

/**
 * Disassembly file name
 */
export const DISASS_ANN_FILE = ".klive/view.disassembly";

/**
 * The default configuration file, if none is provided
 */
export const DEFAULT_SPECTRUM_CONFIG: MachineConfigData = {
  type: "48",
  annotations: ["#spectrum48.disann"],
};

/**
 * This class represents the configuration of the current ZX Spectrum machine
 */
class MachineConfiguration {
  private _config: MachineConfigData | null = null;

  /**
   * Gets the current configuration
   */
  get configuration(): MachineConfigData {
    return this._config ?? DEFAULT_SPECTRUM_CONFIG;
  }

  /**
   * Initializes configuration from the machine config file
   */
  initialize(): void {
   
    // --- Check for available project folder
    const folders = vscode.workspace.workspaceFolders;
    const projFolder = folders ? folders[0].uri.fsPath : null;
    if (!projFolder) {
      // --- No project folder, postpone the configuration
      return;
    }

    try {
      const configFile = path.join(projFolder, KLIVE_CONFIG_FULL);
      if (!fs.existsSync(configFile)) {
        // --- No config file, postpone the configuration
        return;
      }
      const contents = fs.readFileSync(configFile, "utf8");
      const configObj = JSON.parse(contents);
      this._config = {
        type: configObj.type,
        annotations: configObj.annotations,
      };
      // TODO: Validate configuration object

      // --- Let's sign successful configuration
      vscode.commands.executeCommand(
        "setContext",
        "spectrumConfigured",
        true
      );
    } catch (err) {
      vscode.window.showErrorMessage(
        `Cannot build machine configuration: ${err}`
      );
    }
  }
}

/**
 * This interface represents the configuration of a Klive virtual machine
 */
export interface MachineConfigData {
  /**
   * Virtual machine type identifier
   */
  type: string;

  /**
   * Virtual machine disassembly annotations
   */
  annotations?: string[];

  /**
   * Current breakpoint definitions
   */
  breakpoints?: BreakpointDefinition[]
}

/**
 * The singleton instance of the machine configuration
 */
export const machineConfigurationInstance = new MachineConfiguration();
