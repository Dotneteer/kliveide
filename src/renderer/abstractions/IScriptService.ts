import { ILiteEvent } from "@emu/utils/lite-event";
import { OutputContentLine } from "@renderer/appIde/ToolArea/abstractions";

/**
 * This interface represents the service that can manage scripts.
 */
export interface IScriptService {
  /**
   * Starts the execution of the specified script.
   * @param scriptFilePath Script file path
   * @returns The script ID if the script is started, or a negative number if the script is already running.
   */
  runScript(scriptFilePath: string): Promise<number>;

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
  getScriptOutput(scriptId: number): OutputContentLine[];

  /**
   * Add a new output line to the specified script
   * @param scriptId Script ID
   * @param prevLine Previous output line to override
   * @param currentLine New output line to add
   */
  addOutput(
    scriptId: number,
    prevLine: OutputContentLine | undefined,
    currentLine: OutputContentLine | undefined
  ): void;

  /**
   * Raised when the contents of the output buffer have changed
   */
  contentsChanged(): ILiteEvent<number>;
}
