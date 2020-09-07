import { InputStream } from "./input-stream";
import { totalmem } from "os";

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

  // --- Prefetched character column (from the next token)
  private _prefetchedColumn: number | null = null;

  /**
   * Initializes the tokenizer with the input stream
   * @param input Input source code stream
   */
  constructor(public readonly input: InputStream) {}

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
    while (this._ahead.length < n) {
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
      return this._ahead.shift();
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
    let useResolver = false;

    let phase = LexerPhase.Start;
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

            // --- Standard assembly comment
            case ";":
              phase = LexerPhase.InEolComment;
              tokenType = TokenType.EolComment;
              break;

            // --- Divison or comment
            case "/":
              phase = LexerPhase.InPotentialComment;
              tokenType = TokenType.Divide;
              break;

            // --- New line
            case "\n":
              return completeToken(TokenType.NewLine);

            // --- Potential new line
            case "\r":
              phase = LexerPhase.PotentialNewLine;
              tokenType = TokenType.NewLine;
              break;

            // --- ":", "::", or ":="
            case ":":
              phase = LexerPhase.Colon;
              tokenType = TokenType.Colon;
              break;

            // --- Comma
            case ",":
              return completeToken(TokenType.Comma);

            // --- "=", "==", and "==="
            case "=":
              phase = LexerPhase.Assign;
              tokenType = TokenType.Assign;
              break;

            // --- Left parenthesis
            case "(":
              return completeToken(TokenType.LPar);

            // --- Right parenthesis
            case ")":
              return completeToken(TokenType.RPar);

            // --- Left square bracket
            case "[":
              return completeToken(TokenType.LSBrac);

            // --- Right square bracket
            case "]":
              return completeToken(TokenType.RSBrac);

            // --- Question mark
            case "?":
              return completeToken(TokenType.QuestionMark);

            // --- Plus mark
            case "+":
              return completeToken(TokenType.Plus);

            // --- "-" or "->"
            case "-":
              phase = LexerPhase.Minus;
              tokenType = TokenType.Minus;
              break;

            // --- Vertical bar
            case "|":
              return completeToken(TokenType.VerticalBar);

            // --- Up arrow
            case "^":
              return completeToken(TokenType.UpArrow);

            // --- Ampersand
            case "&":
              return completeToken(TokenType.Ampersand);

            // --- "!", "!=", or "!=="
            case "!":
              phase = LexerPhase.Exclamation;
              tokenType = TokenType.Exclamation;
              break;

            // --- "<", "<=", "<<", "<?", or file-string
            case "<":
              phase = LexerPhase.AngleLeft;
              tokenType = TokenType.LessThan;
              break;

            // --- ">", ">=", ">>", ">?", or file-string
            case ">":
              phase = LexerPhase.AngleRight;
              tokenType = TokenType.GreaterThan;
              break;

            // --- Multiplication operation
            case "*":
              return completeToken(TokenType.Multiplication);

            // --- Modulo operation
            case "%":
              return completeToken(TokenType.Modulo);

            // --- Binary not
            case "~":
              return completeToken(TokenType.BinaryNot);

            // --- Beginning "{{"
            case "{":
              phase = LexerPhase.LBracket;
              break;

            // --- Beginning "}}"
            case "}":
              phase = LexerPhase.RBracket;
              break;

            // ---".", keyword-like, real number
            case ".":
              phase = LexerPhase.Dot;
              tokenType = TokenType.Dot;
              break;

            default:
              if (isIdStart(ch)) {
                useResolver = true;
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

        // --- Looking for the end of ";" comment
        case LexerPhase.InEolComment:
          if (ch === "\r" || ch === "\n") {
            return makeToken();
          }
          break;

        // --- Looking for the beginning an "//" or "/*" comment
        case LexerPhase.InPotentialComment:
          switch (ch) {
            case "/":
              phase = LexerPhase.InEolComment;
              tokenType = TokenType.EolComment;
              break;
            case "*":
              phase = LexerPhase.InlineCommentBody;
              tokenType = TokenType.Unknown;
              break;
            default:
              return makeToken();
          }
          break;

        // --- Looking for the "*" within an inline comment
        case LexerPhase.InlineCommentBody:
          if (ch === "*") {
            phase = LexerPhase.InlineCommentTail;
          } else if (ch === "\r" || ch === "\n") {
            // --- Invalid continuation of an inline comment
            return makeToken();
          }
          break;

        // --- Looking for the closing "/" of an inline comment
        case LexerPhase.InlineCommentTail:
          if (ch === "/") {
            return completeToken(TokenType.InlineComment);
          }
          break;

        // --- We already received a "\r", so this is a new line
        case LexerPhase.PotentialNewLine:
          if (ch === "\n") {
            return completeToken(TokenType.NewLine);
          }
          return makeToken();

        // ====================================================================
        // Operator-like tokens

        // --- Colon or double colon
        case LexerPhase.Colon:
          if (ch === ":") {
            return completeToken(TokenType.DoubleColon);
          } else if (ch === "=") {
            return completeToken(TokenType.Var);
          }
          return makeToken();

        // --- Assign or equal
        case LexerPhase.Assign:
          if (ch !== "=") {
            return makeToken();
          }
          phase = LexerPhase.Equal;
          tokenType = TokenType.Equal;
          break;

        // --- Equal or case-insensitive equal
        case LexerPhase.Equal:
          if (ch === "=") {
            return completeToken(TokenType.CiEqual);
          }
          return makeToken();

        // --- "-" or "->"
        case LexerPhase.Minus:
          if (ch === ">") {
            return completeToken(TokenType.GoesTo);
          }
          return makeToken();

        // --- Exclamation ot not equal
        case LexerPhase.Exclamation:
          if (ch !== "=") {
            return makeToken();
          }
          phase = LexerPhase.NotEqual;
          tokenType = TokenType.NotEqual;
          break;

        // --- Not equal or case-insensitive not equal
        case LexerPhase.NotEqual:
          if (ch === "=") {
            return completeToken(TokenType.CiNotEqual);
          }
          return makeToken();

        // --- "<", "<=", "<<", "<?", or file-string
        case LexerPhase.AngleLeft:
          switch (ch) {
            case "=":
              return completeToken(TokenType.LessThanOrEqual);
            case "<":
              return completeToken(TokenType.LeftShift);
            case "?":
              return completeToken(TokenType.MinOp);
            default:
              return makeToken();
            // TODO: Handle file-string
          }

        // --- ">", ">=", ">>", ">?"
        case LexerPhase.AngleRight:
          switch (ch) {
            case "=":
              return completeToken(TokenType.GreaterThanOrEqual);
            case ">":
              return completeToken(TokenType.RightShift);
            case "?":
              return completeToken(TokenType.MaxOp);
            default:
              return makeToken();
          }

        // --- "{{"
        case LexerPhase.LBracket:
          if (ch === "{") {
            return completeToken(TokenType.LDBrac);
          }
          return makeToken();

        // --- "}}"
        case LexerPhase.RBracket:
          if (ch === "}") {
            return completeToken(TokenType.RDBrac);
          }
          return makeToken();

        // --- ".", keyword-like, real-number
        case LexerPhase.Dot:
          if (isLetter(ch)) {
            phase = LexerPhase.KeywordLike;
          } else if (isDecimalDigit(ch)) {
            phase = LexerPhase.RealFractional;
          } else {
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

        // --- Wait for the completion of a keyword-like character
        case LexerPhase.KeywordLike:
          useResolver = true;
          if (!isLetterOrDigit(ch)) {
            return makeToken();
          }
          break;

        // ====================================================================
        // --- We cannot continue
        default:
          return makeToken();
      }

      // --- Append the char to the current text
      text += ch;
      lexer._prefetched = null;
      lexer._prefetchedPos = null;
      lexer._prefetchedColumn = null;
      lastEndPos = input.position;
      lastEndColumn = input.position;

      // --- Go on with parsing the next character
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
      if (useResolver) {
        tokenType =
          resolverHash[text] ??
          (isIdStart(text[0]) ? TokenType.Identifier : TokenType.Unknown);
      }
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
      // --- Make the last character part of the token
      text += ch;
      lexer._prefetched = null;
      lexer._prefetchedPos = null;
      lexer._prefetchedColumn = null;
      lastEndPos = input.position;
      lastEndColumn = input.position;

      // --- Send back the token
      if (suggestedType) {
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
  Divide,
  NewLine,
  Colon,
  DoubleColon,
  Comma,
  Assign,
  Equal,
  CiEqual,
  LPar,
  RPar,
  LSBrac,
  RSBrac,
  QuestionMark,
  Plus,
  Minus,
  GoesTo,
  VerticalBar,
  UpArrow,
  Ampersand,
  Exclamation,
  NotEqual,
  CiNotEqual,
  LessThan,
  LessThanOrEqual,
  LeftShift,
  MinOp,
  FString,
  GreaterThan,
  GreaterThanOrEqual,
  RightShift,
  MaxOp,
  Multiplication,
  Modulo,
  BinaryNot,
  LDBrac,
  RDBrac,
  Dot,

  Identifier,

  Org,
  Xorg,
  Ent,
  Xent,
  Equ,
  Var,
  Disp,
  Defb,
  Defw,
  Defm,
  Defn,
  Defh,
  Defgx,
  Defg,
  Defc,
  Skip,
  Extern,
  Defs,
  Fillb,
  Fillw,
  Model,
  Align,
  Trace,
  TraceHex,
  RndSeed,
  Error,
  IncludeBin,
  CompareBin,
  Macro,
  Endm,
  Proc,
  Endp,
  Loop,
  Endl,
  Repeat,
  Until,
  While,
  Endw,
  If,
  IfUsed,
  IfNUsed,
  Elif,
  Else,
  Endif,
  For,
  To,
  Step,
  Next,
  Break,
  Continue,
  Module,
  EndModule,
  Struct,
  Ends,
}

/**
 * This enum indicates the current lexer phase
 */
enum LexerPhase {
  // Start getting a token
  Start = 0,

  // Collecting whitespace
  InWhiteSpace,

  // Collecting comment characters following ";"
  InEolComment,

  // Potential comment after "/"
  InPotentialComment,

  // Body of an inline comment
  InlineCommentBody,

  // Waiting for the end of an inline comment
  InlineCommentTail,

  // Waiting for "\n" after "\r"
  PotentialNewLine,

  // ":" received
  Colon,

  // "=" received
  Assign,

  // "==" received
  Equal,

  // "-" received
  Minus,

  // "!" received
  Exclamation,

  // "!=" received
  NotEqual,

  // "<" received
  AngleLeft,

  // ">" received
  AngleRight,

  // "{" received
  LBracket,

  // "}" received
  RBracket,

  // "." received
  Dot,

  // Waiting for keyword completion
  KeywordLike,

  // Collecting the fractional part of a real number
  RealFractional,

  // Waiting for the identifier completion
  IdTail,
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
 * Tests if a character is a letter
 * @param ch Character to test
 */
function isLetter(ch: string): boolean {
  return (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z");
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
 * Tests if a character is a binary digit
 * @param ch Character to test
 */
function isBinaryDigit(ch: string): boolean {
  return ch === "0" || ch === "1";
}

/**
 * Tests if a character is an octal digit
 * @param ch Character to test
 */
function isOctalDigit(ch: string): boolean {
  return ch >= "0" && ch <= "7";
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

/**
 * Tests if a character can be the start of an identifier
 * @param ch Character to test
 */
function isIdStart(ch: string): boolean {
  return (
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
    isLetterOrDigit(ch)
  );
}

// A hash of keyword-like tokens starting with a dot
const resolverHash: { [key: string]: TokenType } = {
  ".org": TokenType.Org,
  ".ORG": TokenType.Org,
  org: TokenType.Org,
  ORG: TokenType.Org,

  ".xorg": TokenType.Xorg,
  ".XORG": TokenType.Xorg,
  xorg: TokenType.Xorg,
  XORG: TokenType.Xorg,

  ".ent": TokenType.Ent,
  ".ENT": TokenType.Ent,
  ent: TokenType.Ent,
  ENT: TokenType.Ent,

  ".xent": TokenType.Xent,
  ".XENT": TokenType.Xent,
  xent: TokenType.Xent,
  XENT: TokenType.Xent,

  ".equ": TokenType.Equ,
  ".EQU": TokenType.Equ,
  equ: TokenType.Equ,
  EQU: TokenType.Equ,

  ".var": TokenType.Var,
  ".VAR": TokenType.Var,
  var: TokenType.Var,
  VAR: TokenType.Var,

  ".disp": TokenType.Disp,
  ".DISP": TokenType.Disp,
  disp: TokenType.Disp,
  DISP: TokenType.Disp,

  ".defb": TokenType.Defb,
  ".DEFB": TokenType.Defb,
  defb: TokenType.Defb,
  DEFB: TokenType.Defb,
  ".db": TokenType.Defb,
  ".DB": TokenType.Defb,
  db: TokenType.Defb,
  DB: TokenType.Defb,

  ".defw": TokenType.Defw,
  ".DEFW": TokenType.Defw,
  defw: TokenType.Defw,
  DEFW: TokenType.Defw,
  ".dw": TokenType.Defw,
  ".DW": TokenType.Defw,
  dw: TokenType.Defw,
  DW: TokenType.Defw,

  ".defm": TokenType.Defm,
  ".DEFM": TokenType.Defm,
  defm: TokenType.Defm,
  DEFM: TokenType.Defm,
  ".dm": TokenType.Defm,
  ".DM": TokenType.Defm,
  dm: TokenType.Defm,
  DM: TokenType.Defm,

  ".defn": TokenType.Defn,
  ".DEFN": TokenType.Defn,
  defn: TokenType.Defn,
  DEFN: TokenType.Defn,
  ".dn": TokenType.Defn,
  ".DN": TokenType.Defn,
  dn: TokenType.Defn,
  DN: TokenType.Defn,

  ".defh": TokenType.Defh,
  ".DEFH": TokenType.Defh,
  defh: TokenType.Defh,
  DEFH: TokenType.Defh,
  ".dh": TokenType.Defh,
  ".DH": TokenType.Defh,
  dh: TokenType.Defh,
  DH: TokenType.Defh,

  ".defgx": TokenType.Defgx,
  ".DEFGX": TokenType.Defgx,
  defgx: TokenType.Defgx,
  DEFGX: TokenType.Defgx,
  ".dgx": TokenType.Defgx,
  ".DGX": TokenType.Defgx,
  dgx: TokenType.Defgx,
  DGX: TokenType.Defgx,

  ".defg": TokenType.Defg,
  ".DEFG": TokenType.Defg,
  defg: TokenType.Defg,
  DEFG: TokenType.Defg,
  ".dg": TokenType.Defg,
  ".DG": TokenType.Defg,
  dg: TokenType.Defg,
  DG: TokenType.Defg,

  ".defc": TokenType.Defc,
  ".DEFC": TokenType.Defc,
  defc: TokenType.Defc,
  DEFC: TokenType.Defc,
  ".dc": TokenType.Defc,
  ".DC": TokenType.Defc,
  dc: TokenType.Defc,
  DC: TokenType.Defc,

  ".skip": TokenType.Skip,
  ".SKIP": TokenType.Skip,
  skip: TokenType.Skip,
  SKIP: TokenType.Skip,

  ".extern": TokenType.Extern,
  ".EXTERN": TokenType.Extern,
  extern: TokenType.Extern,
  EXTERN: TokenType.Extern,

  ".defs": TokenType.Defs,
  ".DEFS": TokenType.Defs,
  defs: TokenType.Defs,
  DEFS: TokenType.Defs,
  ".ds": TokenType.Defs,
  ".DS": TokenType.Defs,
  ds: TokenType.Defs,
  DS: TokenType.Defs,

  ".fillb": TokenType.Fillb,
  ".FILLB": TokenType.Fillb,
  fillb: TokenType.Fillb,
  FILLB: TokenType.Fillb,

  ".fillw": TokenType.Fillw,
  ".FILLW": TokenType.Fillw,
  fillw: TokenType.Fillw,
  FILLW: TokenType.Fillw,

  ".model": TokenType.Model,
  ".MODEL": TokenType.Model,
  model: TokenType.Model,
  MODEL: TokenType.Model,

  ".align": TokenType.Align,
  ".ALIGN": TokenType.Align,
  align: TokenType.Align,
  ALIGN: TokenType.Align,
};
