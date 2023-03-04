import { InteractiveCommandContext } from "./InteractiveCommandContext";
import { InteractiveCommandResult } from "./InteractiveCommandResult";
import { ValidationMessage } from "./ValidationMessage";

/**
 * This class represents information about commands
 */
export type InteractiveCommandInfo = {
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
    context: InteractiveCommandContext
  ) => Promise<InteractiveCommandResult>;

  /**
   * Retrieves the usage message
   * @returns
   */
  usageMessage: () => ValidationMessage[];
};
