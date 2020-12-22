import { MarkedString } from "vscode-languageclient";
import { InputStream } from "./input-stream";

/**
 * This class implements the tokenizer (lexer) of the Z80 Assembler
 */
export class TokenStream {
  // --- Already fetched tokens
  private _ahead: Token[] = [];

  // --- Prefetched character (from the next token)
  private _prefetched: string | null = null;

  // --- Prefetched character position (from the next token)
  private _prefetchedPos: number | null = null;

  /**
   * Initializes the tokenizer with the input stream
   * @param input Input source code stream
   */
  constructor(public readonly input: InputStream) {}

  /**
   * Gets the specified part of the source code
   * @param start Start position
   * @param end End position
   */
  getSourceSpan(start: number, end: number): string {
    return this.input.getSourceSpan(start, end);
  }

  /**
   * Fethches the next token without advancing to its position
   * @param ws If true, retrieve whitespaces too
   */
  peek(ws = false): Token {
    return this.ahead(0, ws);
  }

  /**
   *
   * @param n Number of token positions to read ahead
   * @param ws If true, retrieve whitespaces too
   */
  ahead(n = 1, ws = false): Token {
    if (n > 16) {
      throw new Error("Cannot look ahead more than 16 tokens");
    }

    // --- Prefetch missing tokens
    while (this._ahead.length <= n) {
      const token = this.fetch();
      if (isEof(token)) {
        return token;
      }
      if (ws || (!ws && !isWs(token))) {
        this._ahead.push(token);
      }
    }
    return this._ahead[n];
  }

  /**
   * Fethces the nex token and advances the stream position
   * @param ws If true, retrieve whitespaces too
   */
  get(ws = false): Token {
    if (this._ahead.length > 0) {
      const token = this._ahead.shift();
      if (!token) {
        throw new Error("Token expected");
      }
      return token;
    }
    while (true) {
      const token = this.fetch();
      if (isEof(token) || ws || (!ws && !isWs(token))) {
        return token;
      }
    }
  }

  /**
   * Fetches the next token from the input stream
   */
  private fetch(): Token {
    const lexer = this;
    const input = this.input;
    const startPos = this._prefetchedPos || input.position;
    let text = "";
    let tokenType = TokenType.Eof;
    let lastEndPos = input.position;
    let ch: string | null = null;

    let phase: LexerPhase = LexerPhase.Start;
    while (true) {
      // --- Get the next character
      ch = fetchNextChar();

      // --- In case of EOF, return the current token data
      if (ch === null) {
        return makeToken();
      }

      // --- Set the intial token type to unknown for the other characters
      if (tokenType === TokenType.Eof) {
        tokenType = TokenType.Unknown;
      }

      // --- Follow the lexer state machine
      switch (phase) {
        // ====================================================================
        // Process the first character
        case LexerPhase.Start:
          tokenType = TokenType.Unknown;
          switch (ch) {
            // --- Go on with whitespaces
            case " ":
            case "\t":
              phase = LexerPhase.InWhiteSpace;
              tokenType = TokenType.Ws;
              break;

            // --- ":", "::", or ":="
            case ":":
              return completeToken(TokenType.Colon);

            // --- Comma
            case ",":
              return completeToken(TokenType.Comma);

            // --- "$" received
            case "$":
              phase = LexerPhase.Dollar;
              break;

            // --- Start of a numeric literal
            case "0":
            case "1":
            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7":
            case "8":
            case "9":
              phase = LexerPhase.Digit;
              tokenType = TokenType.DecimalLiteral;
              break;

            default:
              if (isIdStart(ch)) {
                phase = LexerPhase.IdTail;
              }
              break;
          }
          break;

        // ====================================================================
        // Process whitespaces, comments, and new line

        // --- Looking for the end of whitespace
        case LexerPhase.InWhiteSpace:
          if (ch !== " " && ch !== "\t") {
            return makeToken();
          }
          break;

        // ====================================================================
        // Identifier and keyword like tokens

        // --- Wait for the completion of an identifier
        case LexerPhase.IdTail:
          if (!isIdContinuation(ch)) {
            return makeToken();
          }
          break;

        // ====================================================================
        // --- Literals

        // --- Tail of a hexadecimal literal
        case LexerPhase.Dollar:
        case LexerPhase.HexaTail:
          if (!isHexadecimalDigit(ch)) {
            return makeToken();
          }
          phase = LexerPhase.HexaTail;
          tokenType = TokenType.HexadecimalLiteral;
          break;

        case LexerPhase.Digit:
          if (!isDecimalDigit(ch)) {
            return makeToken();
          }
          tokenType = TokenType.DecimalLiteral;
          break;

        // ====================================================================
        // --- We cannot continue
        default:
          return makeToken();
      }

      // --- Append the char to the current text
      appendTokenChar();

      // --- Go on with parsing the next character
    }

    /**
     * Appends the last character to the token, and manages positions
     */
    function appendTokenChar(): void {
      text += ch;
      lexer._prefetched = null;
      lexer._prefetchedPos = null;
      lastEndPos = input.position;
    }

    /**
     * Fetches the next character from the input stream
     */
    function fetchNextChar(): string | null {
      let ch: string;
      if (!lexer._prefetched) {
        lexer._prefetchedPos = input.position;
        lexer._prefetched = input.get();
      }
      return lexer._prefetched;
    }

    /**
     * Packs the specified type of token to send back
     * @param type
     */
    function makeToken(): Token {
      return {
        text,
        type: tokenType,
        location: {
          startPos,
          endPos: lastEndPos,
        },
      };
    }

    /**
     * Add the last character to the token and return it
     */
    function completeToken(suggestedType?: TokenType): Token {
      appendTokenChar();

      // --- Send back the token
      if (suggestedType !== undefined) {
        tokenType = suggestedType;
      }
      return makeToken();
    }
  }
}

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
}

enum LexerPhase {
  // Start getting a token
  Start = 0,
  InWhiteSpace,
  Dollar,
  HexaTail,
  Digit,

  IdTail,
}

/**
 * This enumeration defines the token types
 */
export enum TokenType {
  Eof = -1,
  Ws = -2,
  Unknown = 0,

  Identifier,
  Colon,
  Comma,
  DecimalLiteral,
  HexadecimalLiteral,

  SetBreakpoint,
  RemoveBreakpoint,
  EraseAllBreakpoint
}

/**
 * Tests if a token id EOF
 * @param t Token instance
 */
function isEof(t: Token): boolean {
  return t.type === TokenType.Eof;
}

/**
 * Tests if a token is whitespace
 * @param t Token instance
 */
function isWs(t: Token): boolean {
  return t.type <= TokenType.Ws;
}

/**
 * Tests if a character can be the start of an identifier
 * @param ch Character to test
 */
function isIdStart(ch: string): boolean {
  return (
    ch === "." ||
    ch === "_" ||
    ch === "@" ||
    ch === "`" ||
    (ch >= "A" && ch <= "Z") ||
    (ch >= "a" && ch <= "z")
  );
}

/**
 * Tests if a character can be the continuation of an identifier
 * @param ch Character to test
 */
function isIdContinuation(ch: string): boolean {
  return (
    ch === "_" ||
    ch === "@" ||
    ch === "!" ||
    ch === "?" ||
    ch === "#" ||
    ch === "." ||
    isLetterOrDigit(ch)
  );
}

/**
 * Tests if a character is a letter
 * @param ch Character to test
 */
function isLetterOrDigit(ch: string): boolean {
  return (
    (ch >= "A" && ch <= "Z") ||
    (ch >= "a" && ch <= "z") ||
    (ch >= "0" && ch <= "9")
  );
}

/**
 * Tests if a character is a decimal digit
 * @param ch Character to test
 */
function isDecimalDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

/**
 * Tests if a character is a hexadecimal digit
 * @param ch Character to test
 */
function isHexadecimalDigit(ch: string): boolean {
  return (
    (ch >= "0" && ch <= "9") ||
    (ch >= "A" && ch <= "F") ||
    (ch >= "a" && ch <= "f")
  );
}
