import { CmdNode } from "./command-line-nodes";
import {
  ErrorCodes,
  errorMessages,
  KliveCommandError,
  ParserErrorMessage,
} from "./errors";
import { Token, TokenStream, TokenType } from "./token-stream";

/**
 * This class implements the Z80 assembly parser
 */
export class KliveCommandParser {
  private _parseError: ParserErrorMessage | null = null;

  /**
   * Initializes the parser with the specified token stream
   * @param tokens Token stream of the source code
   * @param fileIndex Optional file index of the file being parsed
   */
  constructor(public readonly tokens: TokenStream) {}

  /**
   * The errors raised during the parse phase
   */
  get error(): ParserErrorMessage {
    return this._parseError;
  }

  /**
   * Indicates if there were any errors during the parse phase
   */
  get hasErrors(): boolean {
    return !!this._parseError;
  }

  /**
   * Parses the command
   */
  parseCommand(): CmdNode | null {
    const token = this.tokens.get();
    if (token.type !== TokenType.Identifier) {
    }
    return null;
  }

  /**
   * Reports the specified error
   * @param errorCode Error code
   * @param token Token that represents the error's position
   * @param options Error message options
   */
  private reportError(
    errorCode: ErrorCodes,
    token?: Token,
    options?: any[]
  ): void {
    let errorText: string = errorMessages[errorCode] ?? "Unkonwn error";
    if (options) {
      options.forEach(
        (o, idx) =>
          (errorText = replace(errorText, `{${idx}}`, options[idx].toString()))
      );
    }
    if (!token) {
      token = this.tokens.peek();
    }
    this._parseError = {
      code: errorCode,
      text: errorText,
      position: token.location.startPos,
    };
    throw new KliveCommandError(errorText, errorCode);

    function replace(
      input: string,
      placeholder: string,
      replacement: string
    ): string {
      do {
        input = input.replace(placeholder, replacement);
      } while (input.includes(placeholder));
      return input;
    }
  }
}
