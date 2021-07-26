import { InputStream } from "./input-stream";

/**
 * This class implements the tokenizer (lexer) of the Klive command parser.
 * It recognizes these tokens:
 *
 * Identifier
 *   : idStart idContinuation*
 *   ;
 *
 * idStart
 *   : 'a'..'z' | 'A'..'Z' | '_'
 *   ;
 *
 * idContinuation
 *   : idStart | '0'..'9' | '-' | '$' | '.' | '!' | ':' | '#'
 *   ;
 *
 *  Variable
 *   : '${' Identifier '}'
 *   ;
 *
 * Option
 *   : '-' idStart idContinuation*
 *   ;
 *
 * Path
 *   : pathStart pathContinuation*
 *   ;
 *
 * pathStart
 *   : 'a'..'z' | 'A'..'Z' | '_' | '/' | '\' | '.' | '*' | '?'
 *   ;
 *
 * pathContinuation
 *   : pathStart | ':'
 *   ;
 *
 * String
 *   : '"' (stringChar | escapeChar) '"'
 *   ;
 *
 * stringChar
 *   : [any characted except NL or CR]
 *   ;
 *
 * escapeChar
 *   : '\b' | '\f' | '\n' | '\r' | '\t' | '\v' | '\0' | '\'' | '\"' | '\\'
 *   | '\x' hexadecimalDigit hexadecimalDigit
 *   ;
 *
 * Number
 *   : '-'? (decimalNumber | hexadecimalNumber | binaryNumber)
 *   ;
 *
 * decimalNumber
 *   : decimalDigit xDecimalDigit*
 *   ;
 *
 * hexadecimalNumber
 *   : '$' hexadecimalDigit xHexadecimalDigit*
 *   ;
 *
 * binaryNumber
 *   : '%' binarydigit xBinaryDigit*
 *   ;
 *
 * decimalDigit
 *   : '0'..'9'
 *   ;
 *
 * xDecimalDigit
 *   : decimalDigit | '_' | ''''
 *   ;
 *
 * hexadecimalDigit
 *   : '0'..'9' | 'a'..'f' | 'A'..'F'
 *   ;
 *
 * xHexadecimalDigit
 *   : hexadecimalDigit | '_' | ''''
 *   ;
 *
 * binaryDigit
 *   : '0' | '1'
 *   ;
 *
 * xBinaryDigit
 *   : binaryDigit | '_' | ''''
 *   ;
 *
 * Argument
 *   : [any characted except NL, CR, or other whitespace]+
 *   ;
 */
export class TokenStream {
  // --- Already fetched tokens
  private _ahead: Token[] = [];

  // --- Prefetched character (from the next token)
  private _prefetched: string | null = null;

  // --- Prefetched character position (from the next token)
  private _prefetchedPos: number | null = null;

  // --- Prefetched character column (from the next token)
  private _prefetchedColumn: number | null = null;

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
    const line = input.line;
    const startColumn = this._prefetchedColumn || input.column;
    let text = "";
    let tokenType = TokenType.Eof;
    let lastEndPos = input.position;
    let lastEndColumn = input.column;
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
          switch (ch) {
            // --- Go on with whitespaces
            case " ":
            case "\t":
              phase = LexerPhase.InWhiteSpace;
              tokenType = TokenType.Ws;
              break;

            // --- New line
            case "\n":
              return completeToken(TokenType.NewLine);

            // --- Potential new line
            case "\r":
              phase = LexerPhase.PotentialNewLine;
              tokenType = TokenType.NewLine;
              break;

            case '"':
              phase = LexerPhase.String;
              break;

            case "-":
              phase = LexerPhase.OptionOrNumber;
              break;

            case "$":
              phase = LexerPhase.VariableOrHexaDecimal;
              break;

            case "%":
              phase = LexerPhase.Binary;
              break;

            default:
              if (isIdStart(ch)) {
                phase = LexerPhase.IdTail;
                tokenType = TokenType.Identifier;
              } else if (isDecimalDigit(ch)) {
                phase = LexerPhase.Decimal;
                tokenType = TokenType.DecimalLiteral;
              } else if (isPathStart(ch)) {
                phase = LexerPhase.PathTail;
                tokenType = TokenType.Path;
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

        // --- We already received a "\r", so this is a new line
        case LexerPhase.PotentialNewLine:
          if (ch === "\n") {
            return completeToken(TokenType.NewLine);
          }
          return makeToken();

        // ====================================================================
        // Identifier and keyword like tokens

        // --- Wait for the completion of an identifier
        case LexerPhase.IdTail:
          if (isIdContinuation(ch)) {
            break;
          }
          if (isTokenSeparator(ch)) {
            return makeToken();
          }
          if (isPathContinuation(ch)) {
            phase = LexerPhase.PathTail;
            tokenType = TokenType.Path;
          } else {
            phase = LexerPhase.ArgumentTail;
            tokenType = TokenType.Argument;
          }
          break;

        case LexerPhase.PathTail:
          if (isPathContinuation(ch)) {
            break;
          }
          if (isTokenSeparator(ch)) {
            return makeToken();
          }
          phase = LexerPhase.ArgumentTail;
          tokenType = TokenType.Argument;
          break;

        // ====================================================================
        // Variables

        case LexerPhase.VariableOrHexaDecimal:
          if (ch === "{") {
            phase = LexerPhase.Variable;
            break;
          } else if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.HexaDecimalTail;
            tokenType = TokenType.HexadecimalLiteral;
          } else {
            phase = LexerPhase.ArgumentTail;
            tokenType = TokenType.Argument;
          }
          break;

        // We already parsed "${"
        case LexerPhase.Variable:
          if (isIdStart(ch)) {
            phase = LexerPhase.VariableTail;
          } else {
            return completeToken();
          }
          break;

        // We identified the start character of a variable, and wait for continuation
        case LexerPhase.VariableTail:
          if (isIdContinuation(ch)) {
            break;
          }
          return ch === "}"
            ? completeToken(TokenType.Variable)
            : completeToken(TokenType.Unknown);

        // ====================================================================
        // --- Options

        case LexerPhase.OptionOrNumber:
          if (ch === "$") {
            phase = LexerPhase.Hexadecimal;
          } else if (ch === "%") {
            phase = LexerPhase.Binary;
          } else if (isDecimalDigit(ch)) {
            phase = LexerPhase.Decimal;
            tokenType = TokenType.DecimalLiteral;
          } else if (isIdStart(ch)) {
            phase = LexerPhase.OptionTail;
            tokenType = TokenType.Option;
          } else {
            tokenType = TokenType.Argument;
            phase = LexerPhase.ArgumentTail;
          }
          break;

        case LexerPhase.OptionTail:
          if (isIdContinuation(ch)) {
            break;
          }
          if (isTokenSeparator(ch)) {
            return makeToken();
          }
          tokenType = TokenType.Argument;
          phase = LexerPhase.ArgumentTail;
          break;

        case LexerPhase.ArgumentTail:
          if (isTokenSeparator(ch)) {
            return makeToken();
          }
          break;

        // ====================================================================
        // --- Literals

        // String data
        case LexerPhase.String:
          if (ch === '"') {
            return completeToken(TokenType.String);
          } else if (isRestrictedInString(ch)) {
            return completeToken(TokenType.Unknown);
          } else if (ch === "\\") {
            phase = LexerPhase.StringBackSlash;
            tokenType = TokenType.Unknown;
          }
          break;

        // Start of string character escape
        case LexerPhase.StringBackSlash:
          switch (ch) {
            case "b":
            case "f":
            case "n":
            case "r":
            case "t":
            case "v":
            case "0":
            case "'":
            case '"':
            case "\\":
              phase = LexerPhase.String;
              break;
            default:
              if (ch === "x") {
                phase = LexerPhase.StringHexa1;
              } else {
                phase = LexerPhase.String;
              }
          }
          break;

        // First hexadecimal digit of string character escape
        case LexerPhase.StringHexa1:
          if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.StringHexa2;
          } else {
            return completeToken(TokenType.Unknown);
          }
          break;

        // Second hexadecimal digit of character escape
        case LexerPhase.StringHexa2:
          if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.String;
          } else {
            return completeToken(TokenType.Unknown);
          }
          break;

        // The first character after "$"
        case LexerPhase.Hexadecimal:
          if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.HexaDecimalTail;
            tokenType = TokenType.HexadecimalLiteral;
          } else {
            tokenType = TokenType.Argument;
            phase = LexerPhase.ArgumentTail;
          }
          break;

        case LexerPhase.HexaDecimalTail:
          if (isXHexadecimalDigit(ch)) {
            break;
          }
          if (isTokenSeparator(ch)) {
            return makeToken();
          }
          tokenType = TokenType.Argument;
          phase = LexerPhase.ArgumentTail;
          break;

        // The first character after "%"
        case LexerPhase.Binary:
          if (isBinaryDigit(ch)) {
            phase = LexerPhase.BinaryTail;
            tokenType = TokenType.BinaryLiteral;
          } else {
            tokenType = TokenType.Argument;
            phase = LexerPhase.ArgumentTail;
          }
          break;

        case LexerPhase.BinaryTail:
          if (isXBinaryDigit(ch)) {
            break;
          }
          if (isTokenSeparator(ch)) {
            return makeToken();
          }
          tokenType = TokenType.Argument;
          phase = LexerPhase.ArgumentTail;
          break;

        // The first decimal lieterl character
        case LexerPhase.Decimal:
          if (isDecimalDigit(ch)) {
            phase = LexerPhase.DecimalTail;
            tokenType = TokenType.DecimalLiteral;
          } else if (isTokenSeparator(ch)) {
            return makeToken();
          } else {
            tokenType = TokenType.Argument;
            phase = LexerPhase.ArgumentTail;
          }
          break;

        case LexerPhase.DecimalTail:
          if (isXDecimalDigit(ch)) {
            break;
          }
          if (isTokenSeparator(ch)) {
            return makeToken();
          }
          tokenType = TokenType.Argument;
          phase = LexerPhase.ArgumentTail;
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
      lexer._prefetchedColumn = null;
      lastEndPos = input.position;
      lastEndColumn = input.position;
    }

    /**
     * Fetches the next character from the input stream
     */
    function fetchNextChar(): string | null {
      let ch: string;
      if (!lexer._prefetched) {
        lexer._prefetchedPos = input.position;
        lexer._prefetchedColumn = input.column;
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
          line,
          startColumn,
          endColumn: lastEndColumn,
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
 * This enum indicates the current lexer phase
 */
enum LexerPhase {
  // Start getting a token
  Start = 0,

  // Collecting whitespace
  InWhiteSpace,

  // Waiting for "\n" after "\r"
  PotentialNewLine,

  // Waiting for Option or Number decision
  OptionOrNumber,

  // Waiting for a Vatiable or a hexadecimal number
  VariableOrHexaDecimal,

  // Waiting for an argument tail
  ArgumentTail,

  // Variable related phases
  Variable,
  VariableTail,

  // String-related parsing phases
  IdTail,
  String,
  StringBackSlash,
  StringHexa1,
  StringHexa2,
  StringTail,

  OptionTail,
  PathTail,

  Decimal,
  DecimalTail,
  Hexadecimal,
  HexaDecimalTail,
  Binary,
  BinaryTail,
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

// ----------------------------------------------------------------------------
// Character classification

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
 * Tests if a character can be the start of an identifier
 * @param ch Character to test
 */
function isIdStart(ch: string): boolean {
  return (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || ch === "_";
}

/**
 * Tests if a character can be the continuation of an identifier
 * @param ch Character to test
 */
function isIdContinuation(ch: string): boolean {
  return (
    isIdStart(ch) ||
    isDecimalDigit(ch) ||
    ch === "-" ||
    ch === "$" ||
    ch === "." ||
    ch === "!" ||
    ch === ":" ||
    ch === "#"
  );
}

/**
 * Tests if a character can be the start of a path
 * @param ch Character to test
 */
function isPathStart(ch: string): boolean {
  return (
    (ch >= "A" && ch <= "Z") ||
    (ch >= "a" && ch <= "z") ||
    ch === "_" ||
    ch === "/" ||
    ch === "\\" ||
    ch === "." ||
    ch === "*" ||
    ch === "?"
  );
}

/**
 * Tests if a character can be the continuation of a path
 * @param ch Character to test
 */
function isPathContinuation(ch: string): boolean {
  return isPathStart(ch) || ch === ":";
}

/**
 * Tests if a character is a decimal digit
 * @param ch Character to test
 */
function isDecimalDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

/**
 * Tests if a character is an extended decimal digit
 * @param ch Character to test
 */
function isXDecimalDigit(ch: string): boolean {
  return isDecimalDigit(ch) || ch === "_" || ch === "'";
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

/**
 * Tests if a character is a hexadecimal digit
 * @param ch Character to test
 */
function isXHexadecimalDigit(ch: string): boolean {
  return isHexadecimalDigit(ch) || ch === "_" || ch === "'";
}

/**
 * Tests if a character is a binary digit
 * @param ch Character to test
 */
function isBinaryDigit(ch: string): boolean {
  return ch === "0" || ch === "1";
}

/**
 * Tests if a character is an extended binary digit
 * @param ch Character to test
 */
function isXBinaryDigit(ch: string): boolean {
  return isBinaryDigit(ch) || ch === "_" || ch === "'";
}

/**
 * Tests if a character is a token separator
 * @param ch Character to test
 */
function isTokenSeparator(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\r" || ch === "\r";
}

/**
 * Tests if a character is restricted in a string
 * @param ch Character to test
 */
function isRestrictedInString(ch: string): boolean {
  return (
    ch === "\r" ||
    ch === "\n" ||
    ch === "\u0085" ||
    ch === "\u2028" ||
    ch === "\u2029"
  );
}
