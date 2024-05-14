export interface IScriptManager {
  /**
   * Starts the execution of a script.
   * @param scriptFileName The name of the script file to run.
   * @returns The script ID if the script is started, or a negative number if the script is already running.
   */
  runScript(scriptFileName: string): Promise<ScriptStartInfo>;

  /**
   * Stops the execution of a running script.
   * @param scriptFileName The name of the script file to stop.
   */
  stopScript(idOrFileName: number | string): Promise<boolean>;

  /**
   * Awaits for the completion of a script.
   * @param scriptFileName The name of the script file to wait for.
   * @returns
   */
  completeScript(id: number): Promise<void>;

  /**
   * Remove the completed scripts from the list.
   */
  removeCompletedScripts(): void;

  /**
   * Registers a package object to be used in the script execution.
   * @param packageName Name of the package
   * @param packageObject Package object to register
   */
  registerPackage(packageName: string, packageObject: any): void;
}

/**
 * Represents the information required to start a script.
 */
export type ScriptStartInfo = {
  id?: number;
  target?: string;
  contents?: string;
  hasParseError?: boolean;
};
