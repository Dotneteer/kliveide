import {
  parseCommand,
  Token,
} from "../../../shared/command-parser/token-stream";
import { IOutputBuffer } from "./OutputPaneService";

/**
 * This class represents information about commands
 */
export type CommandInfo = {
  /**
   * The unique identifier of the command
   */
  id: string;

  /**
   * Executes the command within the specified context
   */
  execute: (context: CommandContext) => Promise<CommandResult>;
};

/**
 * Describes the execution context of a command
 */
export type CommandContext = {
  /**
   * The set of tokens used as command arguments
   */
  argTokens: Token[];

  /**
   * The buffer to send output messages
   */
  output: IOutputBuffer;
};

/**
 * Describes the result of a command
 */
export type CommandResult = {
  /**
   * Indicates if the command execution was successful
   */
  success: boolean;

  /**
   * Final message of the command to display
   */
  finalMessage?: string;
};

/**
 * Available type of trace messages
 */
export enum TraceMessageType {
  Info,
  Warning,
  Error,
}

/**
 * Describes a trace message
 */
export type TraceMessage = {
  type: TraceMessageType;
  message: string;
};

/**
 * This class is intended to be the base class of all commands
 */
export abstract class CommandBase {
  /**
   * The unique identifier of the command
   */
  abstract readonly id: string;

  /**
   * Represents the usage of a command
   */
  abstract readonly usage: string | string[];

  /**
   * Executes the command within the specified context
   */
  async execute(context: CommandContext): Promise<CommandResult> {
    // --- Validate the arguments and display potential issues
    const received = await this.validateArgs(context.argTokens);
    const validationMessages = Array.isArray(received) ? received : [received];
    const hasError = validationMessages.some(
      (m) => m.type === TraceMessageType.Error
    );
    if (hasError) {
      validationMessages.push(...this.usageMessage());
    }
    for (var trace of validationMessages) {
      context.output.color(
        trace.type === TraceMessageType.Error
          ? "bright-red"
          : trace.type === TraceMessageType.Warning
          ? "yellow"
          : "bright-blue"
      );
      context.output.writeLine(trace.message);
    }
    if (hasError) {
      // --- Sign validation error
      return {
        success: false,
      };
    }

    // --- Now, it's time to execute the command
    return this.doExecute(context);
  }

  /**
   * Executes the command after argument validation
   * @param context Command execution context
   */
  async doExecute(context: CommandContext): Promise<CommandResult> {
    return {
      success: true,
      finalMessage: "This command has been executed successfully.",
    };
  }

  /**
   * Validates the input arguments
   * @param _args Arguments to validate
   * @returns A list of issues
   */
  async validateArgs(_args: Token[]): Promise<TraceMessage | TraceMessage[]> {
    return [];
  }

  /**
   * Retrieves the usage message
   * @returns
   */
  usageMessage(): TraceMessage[] {
    const usage = this.usage;
    const messages = typeof usage === "string" ? [usage] : usage;
    return messages.map(
      (message) =>
        <TraceMessage>{
          type: TraceMessageType.Info,
          message,
        }
    );
  }
}

/**
 * This class is responsible to execute commands
 */
class CommandService {
  private readonly _commands = new Map<string, CommandInfo>();

  /**
   * Registers a command
   * @param command Command to register
   */
  registerCommand(command: CommandInfo): void {
    if (this._commands.has(command.id)) {
      throw new Error(
        `Command with ID ${command.id} has already been registered.`
      );
    }
    this._commands.set(command.id, command);
  }

  /**
   * Gets the information about the command with the specified ID
   * @param id Command identifier
   * @returns Command information, if found; otherwise, undefined
   */
  getCommandInfo(id: string): CommandInfo | undefined {
    return this._commands.get(id);
  }

  /**
   * Executes the specified command line
   * @param command Command to execute
   */
  async executeCommand(
    command: string,
    buffer: IOutputBuffer
  ): Promise<CommandResult> {
    const tokens = parseCommand(command);
    if (tokens.length === 0) {
      // --- No token, no command to execute
      return {
        success: false,
        finalMessage: `The command '${command}' cannot be parsed.`,
      };
    }

    // --- Test if command is registered
    const commandId = tokens[0].text;
    const commandInfo = this._commands.get(tokens[0].text);
    if (!commandInfo) {
      return {
        success: false,
        finalMessage: `Unknown command '${commandId}'.`,
      };
    }

    // --- Execute the registered command
    const context: CommandContext = {
      argTokens: tokens.slice(1),
      output: buffer,
    };
    return await commandInfo.execute(context);
  }
}

/**
 * The singleton instance of the command service
 */
export const commandService = new CommandService();
