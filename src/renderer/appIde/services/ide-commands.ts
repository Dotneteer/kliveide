import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandInfo } from "../../abstractions/IdeCommandInfo";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { ValidationMessage } from "../../abstractions/ValidationMessage";
import { ValidationMessageType } from "../../abstractions/ValidationMessageType";
import { IOutputBuffer, OutputColor } from "../ToolArea/abstractions";
import { Token, TokenType, parseCommand } from "./command-parser";

/**
 * IdeCommandService is responsible for keeping a registry of
 * commands that can be executed in the Interactive window pane.
 */
export abstract class IdeCommandBase implements IdeCommandInfo {
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
   * Override this method to reset command parameters
   */
  prepareCommand(): void {}

  /**
   * Executes the command within the specified context
   */
  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    // --- Validate the arguments and display potential issues
    this.prepareCommand();
    const received = await this.validateArgs(context);
    const validationMessages = Array.isArray(received) ? received : [received];
    const hasError = validationMessages.some(
      m => m.type === ValidationMessageType.Error
    );
    if (hasError) {
      validationMessages.push(...this.usageMessage());
    }
    context.service.ideCommandsService.displayTraceMessages(
      validationMessages,
      context
    );
    if (hasError) {
      // --- Sign validation error
      return {
        success: false
      };
    }

    // --- Now, it's time to execute the command
    try {
      return await this.doExecute(context);
    } catch (err) {
      console.log(err);
      return {
        success: false,
        finalMessage: `Error caught: ${err.toString()}`
      };
    }
  }

  /**
   * Executes the command after argument validation
   * @param context Command execution context
   */
  async doExecute(_context: IdeCommandContext): Promise<IdeCommandResult> {
    return {
      success: true,
      finalMessage: "This command has been executed successfully."
    };
  }

  /**
   * Validates the input arguments
   * @param _args Arguments to validate
   * @returns A list of issues
   */
  async validateArgs(
    _context: IdeCommandContext
  ): Promise<ValidationMessage | ValidationMessage[]> {
    return [];
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
      messages.slice(1).forEach(m =>
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
        }: ${this.aliases.map(a => getAlias(a)).join(", ")}`
      });
    }
    return renderedMessages;

    function getAlias(alias: string): string {
      return alias;
    }
  }
}

/**
 * Represents successful command execution
 */
export const commandSuccess: IdeCommandResult = { success: true };

/**
 * Represents successful command execution
 */
export function commandSuccessWith(msg: string): IdeCommandResult {
  return { success: true, finalMessage: msg };
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
export function commandError(message: string): IdeCommandResult {
  return {
    success: false,
    finalMessage: message
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

export function toHexa4(value: number): string {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

export function toHexa2(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, "0");
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
  } catch {
    return {
      messages: [
        { type: ValidationMessageType.Error, message: "Invalid numeric value" }
      ]
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
          let partitionType = "B"
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
          return { value: valueInfo.value, partition, partitionType}
        }
        break;
    }
    return {
      messages: [{ type: ValidationMessageType.Error, message: errorText }]
    };
  } catch {
    return {
      messages: [
        { type: ValidationMessageType.Error, message: "Invalid numeric value" }
      ]
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
          `Invalid 16-bit address value ${name ? ` (${name})` : ""}`
        )
      ]
    };
  }
  return { value };
}
