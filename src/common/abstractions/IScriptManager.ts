export interface IScriptManager {
  /**
   * Starts the execution of a script.
   * @param scriptFileName The name of the script file to run.
   * @returns The script ID if the script is started, or a negative number if the script is already running.
   */
  runScript(scriptFileName: string): number;

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
}
