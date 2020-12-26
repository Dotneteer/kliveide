import {
  CmdNode,
  EraseAllBreakpointsCmd,
  ListBreakpointsCmd,
  RemoveBreakpointCmd,
  SetBreakpointCmd,
} from "./command-line-nodes";
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
      this.reportError("C01");
    }
    let cmd: CmdNode;
    switch (token.text.toLowerCase()) {
      case "sb":
        cmd = this.parseSetBreakpointCmd();
        break;

      case "rb":
        cmd = this.parseRemoveBreakpointCommand();
        break;

      case "eab":
        cmd = <EraseAllBreakpointsCmd>{
          type: "EraseAllBreakpointsCmd",
        };
        break;

      case "lb":
        cmd = <ListBreakpointsCmd>{
          type: "ListBreakpointsCmd",
        };
        break;

      default:
        return null;
    }

    // --- Test that no unparsed parts of the command left
    if (this.tokens.peek().type !== TokenType.Eof) {
      this.reportError("C06", token, token.text);
      return null;
    }
    return cmd;
  }

  /**
   * "sb" ("mr" | "mw" | "ir" | "iw")? (partition ":")? address ("mask" ":" mask)? ("hit" ":" hitcount)? ("val" ":" value)?
   */
  private parseSetBreakpointCmd(): SetBreakpointCmd | null {
    const parser = this;
    const command: SetBreakpointCmd = {
      type: "SetBreakpointCmd",
      address: 0,
    };
    let next = this.tokens.peek();
    if (next.type === TokenType.Identifier) {
      // --- It must be one of the modes
      const mode = next.text.toLowerCase();
      switch (mode) {
        case "mr":
        case "mw":
        case "ir":
        case "iw":
          command.mode = mode;
          this.tokens.get();
          break;
        default:
          this.reportError("C02", next, next.text);
          return null;
      }
    }

    // --- Either partition or address must be a literal
    const partitionOrAddress = this.getLiteral();
    if (!partitionOrAddress) {
      return null;
    }

    // --- Decide: partition or address
    next = this.tokens.peek();
    if (next.type === TokenType.Colon) {
      command.partition = partitionOrAddress;
      // --- Skip colon
      this.tokens.get();
      const address = this.getLiteral();
      if (!address) {
        return null;
      }
      command.address = address;
    } else {
      command.address = partitionOrAddress;
    }

    // --- Is there any remaining part of the command?
    next = this.tokens.peek();
    if (next.type === TokenType.Eof) {
      return command;
    }

    // --- Continuation can be "mask", "hit", or "count"
    if (!this.getBreakpointParam(command)) {
      return checkCommand();
    }

    // --- Is there any remaining part of the command?
    next = this.tokens.peek();
    if (next.type === TokenType.Eof) {
      return checkCommand();
    }

    // --- Continuation can be "mask", "hit", or "count"
    if (!this.getBreakpointParam(command)) {
      return checkCommand();
    }

    // --- Is there any remaining part of the command?
    next = this.tokens.peek();
    if (next.type === TokenType.Eof) {
      return checkCommand();
    }

    // --- Continuation can be "mask", "hit", or "count"
    this.getBreakpointParam(command);
    return checkCommand();

    /**
     * Checks the set breakpoint command rules
     */
    function checkCommand(): SetBreakpointCmd | null {
      if (
        command.mode === undefined &&
        (command.hit !== undefined || command.value !== undefined)
      ) {
        parser.reportError("C07");
        return null;
      }

      if (
        (command.mode === undefined || command.mode.startsWith("m")) &&
        command.mask !== undefined
      ) {
        parser.reportError("C08");
        return null;
      }

      return command;
    }
  }

  /**
   * "rb" ("mr" | "mw" | "ir" | "iw")? address
   */
  private parseRemoveBreakpointCommand(): RemoveBreakpointCmd | null {
    const cmd: RemoveBreakpointCmd = {
      type: "RemoveBreakpointCmd",
      address: 0,
    };

    let next = this.tokens.peek();
    if (next.type === TokenType.Identifier) {
      // --- It must be one of the modes
      const mode = next.text.toLowerCase();
      switch (mode) {
        case "mr":
        case "mw":
        case "ir":
        case "iw":
          cmd.mode = mode;
          this.tokens.get();
          break;
        default:
          this.reportError("C02", next, next.text);
          return null;
      }
    }

    const address = this.getLiteral();
    if (address === null) {
      return null;
    }
    cmd.address = address;
    return cmd;
  }

  /**
   * Get "hit" or "val" parameter
   * @param command Command that uses "hit" or "count"
   */
  private getBreakpointParam(command: SetBreakpointCmd): boolean {
    const param = this.getParameter();
    if (!param) {
      return false;
    }
    const paramName = param[0].toLowerCase();
    if (paramName === "hit") {
      command.hit = param[1];
      return true;
    }
    if (paramName === "val") {
      command.value = param[1];
      return true;
    }
    if (paramName === "mask") {
      command.mask = param[1];
      return true;
    }
    this.reportError("C05");
    return false;
  }

  /**
   * Gets a literal value from the current parse position
   */
  private getLiteral(token?: Token): number | null {
    if (!token) {
      token = this.tokens.peek();
    }
    if (token.type === TokenType.DecimalLiteral) {
      const next = this.tokens.get();
      return parseInt(token.text, 10);
    } else if (token.type === TokenType.HexadecimalLiteral) {
      const next = this.tokens.get();
      return parseInt(token.text.substr(1), 16);
    } else {
      this.reportError("C03");
      return null;
    }
  }

  /**
   * Gets a parameter: "name": "value"
   * @param token Optional token
   */
  private getParameter(token?: Token): [string, number] | null {
    if (!token) {
      token = this.tokens.peek();
    }
    if (token.type !== TokenType.Identifier) {
      return null;
    }

    // --- Check for colon separator
    this.tokens.get();
    const colon = this.tokens.get();
    if (colon.type !== TokenType.Colon) {
      this.reportError("C04");
      return null;
    }

    // --- Get the value
    const value = this.getLiteral();
    if (value === null) {
      return null;
    }

    // --- Done
    return [token.text, value];
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
    ...options: any[]
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
