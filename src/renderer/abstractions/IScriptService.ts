import { ILiteEvent } from "@emu/utils/lite-event";
import { OutputPaneBuffer } from "@renderer/appIde/ToolArea/OutputPaneBuffer";

/**
 * This interface represents the service that can manage scripts.
 */
export interface IScriptService {
  /**
   * Gets the ID of the latest script with the specified file path.
   * @param scriptFilePath Script file path
   */
  getLatestScriptId(scriptFilePath: string): number;

  /**
   * Starts the execution of the specified script.
   * @param scriptFilePath Script file path
   * @returns The script ID if the script is started, or a negative number if the script is already running.
   */
  runScript(scriptFilePath: string): Promise<number>;

  /**
   * Starts the execution of the script specified with the given text.
   * @param scriptText The text of the script to run
   * @param scriptFunction The script function to run
   * @param filename The file name of the script
   * @param speciality The speciality of the script
   * @returns The script ID of the started script.
   */
  runScriptText(
    scriptText: string,
    scriptFunction: string,
    filename: string,
    speciality: string
  ): Promise<number>;

  /**
   * Stops the execution of the specified script.
   * @param scriptId ID of the script to stop
   * @returns True, if the script is stopped; otherwise, false
   */
  cancelScript(scriptId: number | string): Promise<boolean>;

  /**
   * Gets the output of the specified script
   * @param scriptId Script ID
   */
  getScriptOutputBuffer(scriptId: number): OutputPaneBuffer | undefined;

  /**
   * Raised when the contents of the output buffer have changed
   */
  contentsChanged(): ILiteEvent<number>;
}
