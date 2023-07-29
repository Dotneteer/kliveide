import { IOutputBuffer } from "../appIde/ToolArea/abstractions";
import { IdeCommandContext } from "./IdeCommandContext";
import { IdeCommandInfo } from "./IdeCommandInfo";
import { IdeCommandResult } from "./IdeCommandResult";
import { ValidationMessage } from "./ValidationMessage";

/**
 * This interface defines the functions managing the interactive commands within the IDE
 */
export interface IIdeCommandService {
  /**
   * Gets the output buffer of the interactive commands
   */
  getBuffer(): IOutputBuffer;

  /**
   * Registers a command
   * @param command Command to register
   */
  registerCommand(command: IdeCommandInfo): void;

  /**
   * Retrieves all registered commands
   */
  getRegisteredCommands(): IdeCommandInfo[];

  /**
   * Gets the information about the command with the specified ID
   * @param id Command identifier
   * @returns Command information, if found; otherwise, undefined
   */
  getCommandInfo(id: string): IdeCommandInfo | undefined;

  /**
   * Gets the information about the command with the specified ID or alias
   * @param idOrAlias
   * @returns Command information, if found; otherwise, undefined
   */
  getCommandByIdOrAlias(idOrAlias: string): IdeCommandInfo | undefined;

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
   * Executes the specified command line interactively
   * @param command Command to execute
   * @param buffer Optional output buffer
   * @param useHistory Add the command to the history
   */
  executeInteractiveCommand(
    command: string,
    buffer?: IOutputBuffer,
    useHistory?: boolean
  ): Promise<IdeCommandResult>;

  /**
   * Executes the specified command line
   * @param command Command to execute
   * @param buffer Optional output buffer
   */
  executeCommand(
    command: string,
    buffer?: IOutputBuffer
  ): Promise<IdeCommandResult>;

  /**
   * Displays the specified trace messages
   * @param messages Trace messages to display
   * @param context Context to display the messages in
   */
  displayTraceMessages(
    messages: ValidationMessage[],
    context: IdeCommandContext
  ): void;

  /**
   * Displays a navigation action to the specified project file
   * @param context Context to display the messages in
   * @param file Filename
   * @param line Optional line number
   * @param column Optional column number
   */
  writeNavigationAction(
    context: IdeCommandContext,
    file: string,
    line?: number,
    column?: number
  ): void;
}
