import { IOutputBuffer } from "./output-pane-service";

/**
 * Represents a token
 */
 export interface Token {
  /**
   * The raw text of the token
   */
  readonly text: string;

  /**
   * The type of the token
   */
  readonly type: TokenType;

  /**
   * The location of the token
   */
  readonly location: TokenLocation;
}

/**
 * Represents the location of a token
 */
 export interface TokenLocation {
  /**
   * Start position in the source stream
   */
  readonly startPos: number;

  /**
   * End position in the source stream
   */
  readonly endPos: number;

  /**
   * Source code line of the token
   */
  readonly line: number;

  /**
   * The token's start column within the line
   */
  readonly startColumn: number;

  /**
   * The tokens end column within the line
   */
  readonly endColumn: number;
}

/**
 * This enumeration defines the token types
 */
 export enum TokenType {
  Eof = -1,
  Ws = -2,
  InlineComment = -3,
  EolComment = -4,
  Unknown = 0,

  NewLine,
  Argument,
  Variable,
  Option,
  Path,
  Identifier,
  String,
  DecimalLiteral,
  HexadecimalLiteral,
  BinaryLiteral,
}

/**
 * This class represents information about commands
 */
export type InteractiveCommandInfo = {
  /**
   * The unique identifier of the command
   */
  id: string;

  /**
   * Executes the command within the specified context
   */
  execute: (context: InteractiveCommandContext) => Promise<InteractiveCommandResult>;
};

/**
 * Describes the execution context of a command
 */
export type InteractiveCommandContext = {
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
export type InteractiveCommandResult = {
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
 * IInteractiveCommandService is responsible for keeping a registry of 
 * commands that can be executed in the Interactive window pane.
 */
export abstract class InteractiveCommandBase {
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
  async execute(context: InteractiveCommandContext): Promise<InteractiveCommandResult> {
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
  async doExecute(context: InteractiveCommandContext): Promise<InteractiveCommandResult> {
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
export interface IInteractiveCommandService {
  /**
   * Registers a command
   * @param command Command to register
   */
  registerCommand(command: InteractiveCommandInfo): void;

  /**
   * Gets the information about the command with the specified ID
   * @param id Command identifier
   * @returns Command information, if found; otherwise, undefined
   */
  getCommandInfo(id: string): InteractiveCommandInfo | undefined;

  /**
   * Executes the specified command line
   * @param command Command to execute
   */
  executeCommand(
    command: string,
    buffer: IOutputBuffer
  ): Promise<InteractiveCommandResult>;
}
