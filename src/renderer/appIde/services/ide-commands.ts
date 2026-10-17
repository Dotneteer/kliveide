import { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import {
  CommandArg,
  CommandArgumentInfo,
  CommandArgumentValue,
  IdeCommandInfo
} from "@renderer/abstractions/IdeCommandInfo";
import { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";
import { IOutputBuffer, OutputColor } from "@renderer/appIde/ToolArea/abstractions";
import { Token, TokenType } from "./command-parser";
import { t } from "@common/i18n/i18n";

export abstract class IdeCommandBase<T = any> implements IdeCommandInfo {
  /**
   * The unique identifier of the command
   */
  abstract readonly id: string;

  /**
   * Represents the usage of a command
   */
  abstract readonly usage: string | string[];

  /**
   * Concise explanation of the command. Translated UI text: a subclass implements it as a getter
   * (`get description() { return t("commands.<area>.description"); }`) so it follows the language.
   */
  abstract readonly description: string;

  /**
   * Command aliases;
   */
  readonly aliases?: string[] = [];

  /**
   * The information to parse the command arguments
   */
  readonly argumentInfo?: CommandArgumentInfo = {};

  /**
   * Indicates that this project requires an open Klive project
   */
  readonly requiresProject?: boolean = false;

  /**
   * Execute the command
   * @param _context Command execution context
   * @param _args Object with command arguments
   * @returns Command execution result
   */
  async execute(_context: IdeCommandContext, _args?: T): Promise<IdeCommandResult> {
    return {
      success: true,
      finalMessage: t("commands.common.executedDefault")
    };
  }

  /**
   * Retrieves the usage message
   * @returns
   */
  usageMessage(): ValidationMessage[] {
    const usage = this.usage;
    const messages = typeof usage === "string" ? [usage] : usage;
    const renderedMessages: ValidationMessage[] = [];
    renderedMessages.push(<ValidationMessage>{
      type: ValidationMessageType.Info,
      message: this.description
    });
    if (messages.length > 0) {
      renderedMessages.push(<ValidationMessage>{
        type: ValidationMessageType.Info,
        message: t("commands.common.usageLine", { usage: messages[0] })
      });
      messages.slice(1).forEach((m) =>
        renderedMessages.push(<ValidationMessage>{
          type: ValidationMessageType.Info,
          message: m
        })
      );
    }
    if (this.aliases && this.aliases.length > 0) {
      renderedMessages.push(<ValidationMessage>{
        type: ValidationMessageType.Info,
        message: t("commands.common.aliasesLine", {
          count: this.aliases.length,
          aliases: this.aliases.map((a) => getAlias(a)).join(", ")
        })
      });
    }
    return renderedMessages;

    function getAlias(alias: string): string {
      return alias;
    }
  }
}

export type NoCommandArgs = {};

/**
 * Represents successful command execution
 */
export const commandSuccess: IdeCommandResult = { success: true };

/**
 * Represents successful command execution
 */
export function commandSuccessWith(msg: string, value?: any): IdeCommandResult {
  return { success: true, finalMessage: msg, value };
}

/**
 * Creates a message with the specified count as the expected number of arguments.
 * @param count Number of expected arguments
 */
export function expectArgs(count: number): ValidationMessage {
  return {
    type: ValidationMessageType.Error,
    message: t("commands.common.expectArgs", { count })
  };
}

/**
 * Creates a message with the specified count as the expected number of arguments.
 * @param count Number of expected arguments
 */
export function validationError(message: string): ValidationMessage {
  return {
    type: ValidationMessageType.Error,
    message
  };
}

/**
 * Represents a command execution error
 * @param message Error message
 */
export function commandError(message: string, value?: any): IdeCommandResult {
  return {
    success: false,
    finalMessage: message,
    value
  };
}

/**
 * Writes a message to the specified output
 */
export function writeMessage(
  output: IOutputBuffer,
  text: string,
  color?: OutputColor,
  closeLine = true
): void {
  if (color) {
    output.color(color);
  } else {
    output.resetStyle();
  }
  if (closeLine) {
    output.writeLine(text);
  } else {
    output.write(text);
  }
  output.resetStyle();
}

/**
 * Writes a info message to the specified output
 * @param output
 * @param text
 */
export function writeInfoMessage(output: IOutputBuffer, text: string): void {
  writeMessage(output, text, "bright-blue");
}

/**
 * Writes a success message to the specified output
 * @param output
 * @param text
 */
export function writeSuccessMessage(output: IOutputBuffer, text: string): void {
  writeMessage(output, text, "green");
}

export function toHexa8(value: number): string {
  return value.toString(16).toUpperCase().padStart(8, "0");
}

export function toHexa6(value: number): string {
  return value.toString(16).toUpperCase().padStart(6, "0");
}

export function toHexa6Dash(value: number): string {
  const hex = value.toString(16).toUpperCase().padStart(6, "0");
  return hex.slice(0, 2) + "-" + hex.slice(2);
}

export function toHexa4(value: number): string {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

export function toHexa2(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

export function toDecimal5(value: number): string {
  return value.toString(10).toUpperCase().padStart(5, "0");
}

export function toDecimal7(value: number): string {
  return value.toString(10).toUpperCase().padStart(7, "0");
}

export function toDecimal3(value: number): string {
  return value.toString(10).toUpperCase().padStart(3, "0");
}

export function toBin8(value: number): string {
  const binValue =  value.toString(2).toUpperCase().padStart(8, "0");
  return `%${binValue.substring(0, 4)} ${binValue.substring(4)}`;
}

export function toBin16(value: number): string {
  const binValue =  value.toString(2).toUpperCase().padStart(16, "0");
  return `%${binValue.substring(0, 4)} ${binValue.substring(4, 8)}\xa0\xa0${binValue.substring(8, 12)} ${binValue.substring(12)}`;
}


/**
 * Converts a token to an integer value
 * @param token Token to convert
 * @returns Integer value if conversion successful; otherwise, null
 */
export function getNumericTokenValue(token: Token): {
  value?: number;
  messages?: ValidationMessage[];
} {
  const plainText = token.text.replace("'", "").replace("_", "");
  try {
    switch (token.type) {
      case TokenType.DecimalLiteral:
        return { value: parseInt(plainText, 10) };
      case TokenType.BinaryLiteral:
        return { value: parseInt(plainText.substring(1), 2) };
      case TokenType.HexadecimalLiteral:
        return { value: parseInt(plainText.substring(1), 16) };
    }
    return null;
  } catch {
    return {
      messages: [{ type: ValidationMessageType.Error, message: t("commands.common.invalidNumber") }]
    };
  }
}

/**
 * Converts a token to a 16-bit address value
 * @param token Token to convert
 * @param name Optional argument name
 * @returns
 */
export function getAddressValue(
  token: Token,
  name?: string
): { value?: number; messages?: ValidationMessage[] } {
  const { value, messages } = getNumericTokenValue(token);
  if (!value) return { messages };
  if (value < 0 || value > 65535) {
    return {
      messages: [
        validationError(
          name
            ? t("commands.common.invalidAddress16Named", { name })
            : t("commands.common.invalidAddress16")
        )
      ]
    };
  }
  return { value };
}

/**
 * Split a command line at a raw-tail option (`CommandArgumentInfo.rawTailOption`).
 *
 * Text-level, so the tokenizer never sees the tail: the option counts only as a whole word outside
 * double quotes and outside `[...]` (a `[file:line]` source spec cannot be cut). The tail is
 * trimmed, and unquoted when it is exactly one double-quoted string (`-if "A == 1"`).
 *
 * @returns The line before the option and the tail after it; `undefined` when the option is absent
 */
export function splitRawTail(
  command: string,
  option: string
): { head: string; tail: string } | undefined {
  let inQuote = false;
  let depth = 0;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (inQuote) {
      if (ch === "\\") i++;
      else if (ch === '"') inQuote = false;
      continue;
    }
    if (ch === '"') {
      inQuote = true;
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]") depth = Math.max(0, depth - 1);
    if (
      depth === 0 &&
      (i === 0 || /\s/.test(command[i - 1])) &&
      command.startsWith(option, i) &&
      (i + option.length === command.length || /\s/.test(command[i + option.length]))
    ) {
      let tail = command.substring(i + option.length).trim();
      const quoted = /^"((?:[^"\\]|\\.)*)"$/.exec(tail);
      if (quoted) tail = quoted[1].replace(/\\(["\\])/g, "$1");
      return { head: command.substring(0, i), tail };
    }
  }
  return undefined;
}

export function extractArguments(
  tokens: Token[],
  argInfo: CommandArgumentInfo
): CommandArgumentValue | string[] {
  const result: CommandArgumentValue = {};
  const errors: string[] = [];

  // --- Traverse through tokens to extract arguments
  let tokenIdx = 0;
  let argIdx = 0;
  let tooManyArgs = false;
  const optionsUsed = new Set<string>();
  const mandatoryLength = argInfo.mandatory?.length ?? 0;
  const optionalLength = argInfo.optional?.length ?? 0;
  while (tokenIdx < tokens.length) {
    const token = tokens[tokenIdx];
    switch (token.type) {
      case TokenType.Option:
        const optionName = token.text;
        if (argInfo?.commandOptions?.includes(optionName)) {
          // --- This is a command option
          if (optionsUsed.has(optionName)) {
            errors.push(t("commands.common.optionAlreadyUsed", { option: optionName }));
            break;
          }
          result[optionName] = true;
          optionsUsed.add(optionName);
          break;
        }

        // --- Check if this is a named option
        const namedOption = argInfo?.namedOptions?.find((o) => o.name === optionName);
        if (namedOption) {
          // --- Found the named options. The next token should be the value.
          tokenIdx++;
          if (tokenIdx >= tokens.length) {
            errors.push(t("commands.common.missingOptionValue", { option: optionName }));
            break;
          }
          result[optionName] = getValue(tokens[tokenIdx], namedOption);
        } else {
          errors.push(t("commands.common.unknownOption", { option: optionName }));
        }
        break;
      default:
        // --- This is a positional argument. Check if the command still has this argument.
        if (tooManyArgs || (argIdx >= mandatoryLength + optionalLength && !argInfo.allowRest)) {
          // --- Too many arguments
          tooManyArgs = true;
          break;
        }

        // --- Ok, process the argument
        if (argIdx >= mandatoryLength + optionalLength) {
          result.rest ??= [];
          (result.rest as any[]).push(token.text);
        } else {
          const argName =
            argIdx < mandatoryLength
              ? argInfo.mandatory[argIdx].name
              : argInfo.optional[argIdx - mandatoryLength].name;
          const argDesc =
            argIdx < mandatoryLength
              ? argInfo.mandatory[argIdx]
              : argInfo.optional[argIdx - mandatoryLength];
          result[argName] = getValue(token, argDesc);
        }
        argIdx++;
    }

    // --- Next token
    tokenIdx++;
  }

  // --- Check for argument count
  if (argIdx < mandatoryLength) {
    errors.push(t("commands.common.missingMandatory"));
  } else if (tooManyArgs) {
    errors.push(t("commands.common.tooManyArgs"));
  }

  // --- Done.
  return errors.length > 0 ? errors : result;

  function getValue(token: Token, argDesc: CommandArg): string | number | null {
    if ((argDesc.type ?? "string") === "string") {
      return token.text;
    }
    switch (token.type) {
      case TokenType.DecimalLiteral:
      case TokenType.BinaryLiteral:
      case TokenType.HexadecimalLiteral:
        // --- Extract the numeric value
        const { value, messages } = getNumericTokenValue(token);
        if (messages && messages.length > 0) {
          errors.push(t("commands.common.numericExpected", { name: argDesc.name }));
        }

        // --- Check the value range
        if (
          (argDesc.minValue !== undefined && value < argDesc.minValue) ||
          (argDesc.maxValue !== undefined && value > argDesc.maxValue)
        ) {
          if (argDesc.minValue === undefined) {
            errors.push(t("commands.common.argUpTo", { name: argDesc.name, max: String(argDesc.maxValue) }));
          } else if (argDesc.maxValue === undefined) {
            errors.push(t("commands.common.argAtLeast", { name: argDesc.name, min: String(argDesc.minValue) }));
          } else {
            errors.push(
              t("commands.common.argBetween", {
                name: argDesc.name,
                min: String(argDesc.minValue),
                max: String(argDesc.maxValue)
              })
            );
          }
          return null;
        } else {
          return value;
        }
      default:
        errors.push(t("commands.common.numericExpected", { name: argDesc.name }));
        return null;
    }
  }
}
