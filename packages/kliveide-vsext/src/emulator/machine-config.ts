import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

/**
 * The path of the configuration file within the workspace
 */
export const MACHINE_CONFIG_FILE = ".spectrum/spectrum.machine";

/**
 * The default configuration file, if none is provided
 */
export const DEFAULT_SPECTRUM_CONFIG: SpectrumConfig = {
  type: "Spectrum48",
  annotations: ["#spectrum48.disann"],
};

/**
 * This class represents the configuration of the current ZX Spectrum machine
 */
class MachineConfiguration {
  private _initialized = false;
  private _config: SpectrumConfig | null = null;

  /**
   * Gets the current configuration
   */
  get configuration(): SpectrumConfig {
    return this._config ?? DEFAULT_SPECTRUM_CONFIG;
  }

  /**
   * Initializes configuration from the machine config file
   */
  initialize(): void {
    // --- Initialize only once
    if (this._initialized) {
        return;
    }
    
    // --- Check for available project folder
    const folders = vscode.workspace.workspaceFolders;
    const projFolder = folders ? folders[0].uri.fsPath : null;
    if (!projFolder) {
      // --- No project folder, postpone the configuration
      return;
    }

    try {
      const configFile = path.join(projFolder, MACHINE_CONFIG_FILE);
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
      this._initialized = true;
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

  /**
   * Tests if the machine configuration has already been initialized
   */
  get initialized(): boolean {
    return this._initialized;
  }
}

/**
 * This interface represents the configuration of the ZX Spectrum machine
 */
export interface SpectrumConfig {
  type: string;
  annotations: string[];
}

/**
 * The singleton instance of the machine configuration
 */
export const spectrumConfigurationInstance = new MachineConfiguration();
