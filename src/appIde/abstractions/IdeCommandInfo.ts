import { IdeCommandContext } from "./IdeCommandContext";
import { IdeCommandResult } from "./IdeCommandResult";
import { ValidationMessage } from "./ValidationMessage";

/**
 * This class represents information about commands
 */
export type IdeCommandInfo = {
  /**
   * The unique identifier of the command
   */
  readonly id: string;

  /**
   * Concise explanation of the command
   */
  readonly description: string;

  /**
   * Command aliases;
   */
  readonly aliases?: string[];

  /**
   * Represents the usage of a command
   */
  readonly usage: string | string[];

  /**
   * Executes the command within the specified context
   */
  execute: (
    context: IdeCommandContext
  ) => Promise<IdeCommandResult>;

  /**
   * Retrieves the usage message
   * @returns
   */
  usageMessage: () => ValidationMessage[];
};
