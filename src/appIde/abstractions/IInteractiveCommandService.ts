import { IOutputBuffer } from "../ToolArea/abstractions";
import { InteractiveCommandContext } from "./InteractiveCommandContext";
import { InteractiveCommandInfo } from "./InteractiveCommandInfo";
import { InteractiveCommandResult } from "./InteractiveCommandResult";
import { ValidationMessage } from "./ValidationMessage";

/**
 * This interface defines the functions managing the interactive commands within the IDE
 */
export interface IInteractiveCommandService {
  /**
   * Gets the output buffer of the interactive commands
   */
  getBuffer(): IOutputBuffer;

  /**
   * Registers a command
   * @param command Command to register
   */
  registerCommand(command: InteractiveCommandInfo): void;

  /**
   * Retrieves all registered commands
   */
  getRegisteredCommands(): InteractiveCommandInfo[];

  /**
   * Gets the information about the command with the specified ID
   * @param id Command identifier
   * @returns Command information, if found; otherwise, undefined
   */
  getCommandInfo(id: string): InteractiveCommandInfo | undefined;

  /**
   * Gets the information about the command with the specified ID or alias
   * @param idOrAlias
   * @returns Command information, if found; otherwise, undefined
   */
  getCommandByIdOrAlias(idOrAlias: string): InteractiveCommandInfo | undefined;

  /**
   * Gets the command with the specified index from the command history
   * @param index Command index
   */
  getCommandFromHistory(index: number): string;

  /**
   * Gets the length of the command history
   */
  getCommandHistoryLength(): number;

  /**
   * Clears the command history
   */
  clearHistory(): void;

  /**
   * Executes the specified command line
   * @param command Command to execute
   */
  executeCommand(
    command: string,
    buffer: IOutputBuffer
  ): Promise<InteractiveCommandResult>;

  /**
   * Displays the specified trace messages
   * @param messages Trace messages to display
   * @param context Context to display the messages in
   */
  displayTraceMessages(
    messages: ValidationMessage[],
    context: InteractiveCommandContext
  ): void;
}
