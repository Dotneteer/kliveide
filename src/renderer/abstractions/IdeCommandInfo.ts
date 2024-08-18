import type { IdeCommandContext } from "./IdeCommandContext";
import type { IdeCommandResult } from "./IdeCommandResult";
import type { ValidationMessage } from "./ValidationMessage";

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
   * Indicates whether the command can be used interactively
   */
  readonly noInteractiveUsage?: boolean;

  /**
   * The information to parse the command arguments
   */
  readonly argumentInfo?: CommandArgumentInfo;

  /**
   * Optional function to validate the parsed command arguments
   * @param args Parsed command arguments
   * @returns Validation result
   */
  validateCommandArgs?: (context: IdeCommandContext, args: any) => ValidationMessage[];

  /**
   * Executes the command within the specified context
   */
  execute: (context: IdeCommandContext, args?: any) => Promise<IdeCommandResult>;

  /**
   * Retrieves the usage message
   * @returns
   */
  usageMessage: () => ValidationMessage[];
};

export type CommandParameterType = "string" | "number";

export type CommandArg = {
  name: string;
  type?: CommandParameterType;
  minValue?: number;
  maxValue?: number;
  defaultValue?: number | string;
};

export type CommandArgumentInfo = {
  mandatory?: CommandArg[];
  optional?: CommandArg[];
  commandOptions?: string[];
  namedOptions?: CommandArg[];
};

export type CommandArgumentValue = Record<string, string | number | boolean>;
