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
   * Indicates that this project requires an open Klive project
   */
  readonly requiresProject?: boolean;

  /**
   * "deny": the automation server's `ide.command` refuses this command
   * (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` T5) because it would deadlock an unattended run: it
   * opens a modal dialog, waits for a confirmation, or quits the app.
   */
  readonly automation?: "deny";

  /**
   * Optional function to validate the parsed command arguments
   * @param args Parsed command arguments
   * @returns Validation result
   */
  validateCommandArgs?: (context: IdeCommandContext, args: any) => Promise<ValidationMessage[]>;

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
  allowRest?: boolean;
  /**
   * An option that takes **the rest of the line, verbatim**, as its value (`bp-set ... -if A == 1`).
   * The command service cuts the text at this option before tokenizing - the tokenizer would drop
   * `==`/`&&` and split `[...]` - so it must be the last option. The value lands in the arguments
   * under the option's name; a tail that is one double-quoted string is unquoted.
   */
  rawTailOption?: string;
};

export type CommandArgumentValue = Record<string, string | number | boolean | any[]>;
