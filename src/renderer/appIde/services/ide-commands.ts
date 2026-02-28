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
import { Token, TokenType, parseCommand } from "./command-parser";

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
   * Concise explanation of the command
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
      finalMessage: "This command has been executed successfully."
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
        message: `Usage: ${messages[0]}`
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
        message: `${
          this.aliases.length === 1 ? "Alias" : "Aliases"
        }: ${this.aliases.map((a) => getAlias(a)).join(", ")}`
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
    message: `This command expects ${count} argument${count > 1 ? "s" : ""}`
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
      messages: [{ type: ValidationMessageType.Error, message: "Invalid numeric value" }]
    };
  }
}

/// <summary>
/// Converts a token to an integer value
/// </summary>
/// <param name="token">Token to convert</param>
/// <returns>Integer value if conversion successful; otherwise, null</returns>
export function getPartitionedValue(token: Token): {
  value?: number;
  partition?: number;
  partitionType?: string;
  messages?: ValidationMessage[];
} {
  const plainText = token.text.replace("'", "").replace("_", "");
  let errorText: string | undefined;
  try {
    switch (token.type) {
      case TokenType.DecimalLiteral:
        return { value: parseInt(plainText, 10) };
      case TokenType.BinaryLiteral:
        return { value: parseInt(plainText.substring(1), 2) };
      case TokenType.HexadecimalLiteral:
        return { value: parseInt(plainText.substring(1), 16) };
      default:
        const segments = token.text.toLowerCase().split(":");
        if (segments.length === 2 && segments[0].length <= 2) {
          // --- Extract partition information
          let partition: number | undefined;
          let partitionType = "B";
          const partStr = segments[0].toUpperCase();
          let partNoIdx = 0;
          if (partStr.startsWith("R")) {
            partitionType = "R";
            partNoIdx = 1;
          }
          const partV = partStr[partNoIdx];
          if (!partV || partV < "0" || partV > "9") break;
          partition = partV.charCodeAt(0) - "0".charCodeAt(0);

          // --- Extract address
          const tokens = parseCommand(segments[1]);
          if (tokens.length !== 1) break;
          const valueInfo = getNumericTokenValue(tokens[0]);
          if (valueInfo.messages) break;

          // --- Return with the info
          return { value: valueInfo.value, partition, partitionType };
        }
        break;
    }
    return {
      messages: [{ type: ValidationMessageType.Error, message: errorText }]
    };
  } catch {
    return {
      messages: [{ type: ValidationMessageType.Error, message: "Invalid numeric value" }]
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
      messages: [validationError(`Invalid 16-bit address value ${name ? ` (${name})` : ""}`)]
    };
  }
  return { value };
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
            errors.push(`Option '${optionName}' is already used`);
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
            errors.push(`Missing value for named option '${optionName}'`);
            break;
          }
          result[optionName] = getValue(tokens[tokenIdx], namedOption);
        } else {
          errors.push(`Unknown named option: '${optionName}'`);
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
    errors.push(`Missing mandatory argument`);
  } else if (tooManyArgs) {
    errors.push(`Too many arguments`);
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
          errors.push(`Numeric value expected for argument '${argDesc.name}'`);
        }

        // --- Check the value range
        if (
          (argDesc.minValue !== undefined && value < argDesc.minValue) ||
          (argDesc.maxValue !== undefined && value > argDesc.maxValue)
        ) {
          if (argDesc.minValue === undefined) {
            errors.push(`Argument value of '${argDesc.name}' must be up to ${argDesc.maxValue}`);
          } else if (argDesc.maxValue === undefined) {
            errors.push(`Argument value of '${argDesc.name}' must be at least ${argDesc.minValue}`);
          } else {
            errors.push(
              `Argument value of '${argDesc.name}' must be between ${argDesc.minValue} and ${argDesc.maxValue}`
            );
          }
          return null;
        } else {
          return value;
        }
      default:
        errors.push(`Numeric value expected for argument '${argDesc.name}'`);
        return null;
    }
  }
}
