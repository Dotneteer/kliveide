import { ILiteEvent } from "../utils/LiteEvent";
import { CommandResult } from "./ICommandService";
import { IOutputBuffer } from "./IOutputPaneService";

/**
 * This class implements the functionality of the interactive pane service
 */
export interface IInteractivePaneService {
  /**
   * Gets the output buffer
   * @returns The output buffer
   */
  getOutputBuffer(): IOutputBuffer;

  /**
   * Clears the contents of the output buffer
   */
  clearOutputBuffer(): void;

  /**
   * Clears the command history
   */
  clearHistory(): void;

  /**
   * Gets the length of the command history
   */
  getHistoryLength(): number;

  /**
   * Adds a new command to the history
   * @param command The command to add to the history
   */
  appendHistory(command: string): void;

  /**
   * Gets a command from the history
   * @param index The index from the end the command history
   * @returns The command from the history
   */
  getCommandFromHistory(index: number): string;

  /**
   * Submits a command
   * @param command Command string
   */
  submitCommand(command: string): void;

  /**
   * Gets the flag that indicates if a command is being executed
   * @returns Command execution flag
   */
  isCommandExecuting(): boolean;

  /**
   * Signs that the last submitted command has been completed
   */
  signCommandExecuted(result: CommandResult): void;

  /**
   * Request the focus to set to the prompt
   */
  requestFocus(): void;

  /**
   * Fires when to contents of the output within the interactive pane changes
   */
  get outputContentChanged(): ILiteEvent<void>;

  /**
   * Fires when a command has been submitted
   */
  get commandSubmitted(): ILiteEvent<string>;

  /**
   * Fires when a command has been executed
   */
  get commandExecuted(): ILiteEvent<CommandResult>;

  /**
   * This event is raised when the interactive pane is requested to get the focus
   */
  get focusRequested(): ILiteEvent<void>;
}
