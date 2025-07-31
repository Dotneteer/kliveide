import { Token } from "@main/compiler-common/tree-nodes";
import { InputStream } from "../compiler-common/input-stream";
import {
  commonResolverHash,
  CommonTokens,
  CommonTokenType
} from "@main/compiler-common/common-tokens";

/**
 * This class implements the tokenizer (lexer) of the Z80 Assembler
 */
export class TokenStream<TToken extends CommonTokenType> {
  // --- Already fetched tokens
  private _ahead: Token<TToken>[] = [];

  // --- Prefetched character (from the next token)
  private _prefetched: string | null = null;

  // --- Prefetched character position (from the next token)
  private _prefetchedPos: number | null = null;

  // --- Prefetched character column (from the next token)
  private _prefetchedColumn: number | null = null;

  // --- The last end-of-line comment
  private _lastComment: string | null = null;

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
   * Resets the last comment
   */
  resetComment(): void {
    this._lastComment = null;
  }

  /**
   * Gets the last end-of-line comment
   */
  get lastComment(): string | null {
    return this._lastComment;
  }

  /**
   * Fethches the next token without advancing to its position
   * @param ws If true, retrieve whitespaces too
   */
  peek(ws = false): Token<TToken> {
    return this.ahead(0, ws);
  }

  /**
   *
   * @param n Number of token positions to read ahead
   * @param ws If true, retrieve whitespaces too
   */
  ahead(n = 1, ws = false): Token<TToken> {
    if (n > 16) {
      throw new Error("Cannot look ahead more than 16 tokens");
    }

    // --- Prefetch missing tokens
    while (this._ahead.length <= n) {
      const token = this.fetch();
      if (token.type === Z80Tokens.EolComment) {
        this._lastComment = token.text;
      }
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
  get(ws = false): Token<CommonTokenType> {
    if (this._ahead.length > 0) {
      const token = this._ahead.shift();
      if (!token) {
        throw new Error("Token expected");
      }
      return token;
    }
    while (true) {
      const token = this.fetch();
      if (token.type === Z80Tokens.EolComment) {
        this._lastComment = token.text;
      }
      if (isEof(token) || ws || (!ws && !isWs(token))) {
        return token;
      }
    }
  }

  /**
   * Fetches the next token from the input stream
   */
  private fetch(): Token<TToken> {
    const lexer = this;
    const input = this.input;
    const startPos = this._prefetchedPos || input.position;
    const line = input.line;
    const startColumn = this._prefetchedColumn || input.column;
    let text = "";
    let tokenType: CommonTokenType = CommonTokens.Eof;
    let lastEndPos = input.position;
    let lastEndColumn = input.column;
    let ch: string | null = null;
    let useResolver = false;

    let phase: LexerPhase = LexerPhase.Start;
    while (true) {
      // --- Get the next character
      ch = fetchNextChar();

      // --- In case of EOF, return the current token data
      if (ch === null) {
        return makeToken();
      }

      // --- Set the intial token type to unknown for the other characters
      if (tokenType === Z80Tokens.Eof) {
        tokenType = Z80Tokens.Unknown;
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
              tokenType = Z80Tokens.Ws;
              break;

            // --- Standard assembly comment
            case ";":
              phase = LexerPhase.InEolComment;
              tokenType = Z80Tokens.EolComment;
              break;

            // --- Divison or comment
            case "/":
              phase = LexerPhase.InPotentialComment;
              tokenType = Z80Tokens.Divide;
              break;

            // --- New line
            case "\n":
              return completeToken(CommonTokens.NewLine);

            // --- Potential new line
            case "\r":
              phase = LexerPhase.PotentialNewLine;
              tokenType = Z80Tokens.NewLine;
              break;

            // --- ":", "::", or ":="
            case ":":
              phase = LexerPhase.Colon;
              tokenType = Z80Tokens.Colon;
              break;

            // --- Comma
            case ",":
              return completeToken(Z80Tokens.Comma);

            // --- "=", "==", and "==="
            case "=":
              phase = LexerPhase.Assign;
              tokenType = Z80Tokens.Assign;
              break;

            // --- Left parenthesis
            case "(":
              return completeToken(Z80Tokens.LPar);

            // --- Right parenthesis
            case ")":
              return completeToken(Z80Tokens.RPar);

            // --- Left square bracket
            case "[":
              return completeToken(Z80Tokens.LSBrac);

            // --- Right square bracket
            case "]":
              return completeToken(Z80Tokens.RSBrac);

            // --- Question mark
            case "?":
              return completeToken(Z80Tokens.QuestionMark);

            // --- Plus mark
            case "+":
              return completeToken(Z80Tokens.Plus);

            // --- "-" or "->"
            case "-":
              phase = LexerPhase.Minus;
              tokenType = Z80Tokens.Minus;
              break;

            // --- Vertical bar
            case "|":
              return completeToken(Z80Tokens.VerticalBar);

            // --- Up arrow
            case "^":
              return completeToken(Z80Tokens.UpArrow);

            // --- Ampersand
            case "&":
              return completeToken(Z80Tokens.Ampersand);

            // --- "!", "!=", or "!=="
            case "!":
              phase = LexerPhase.Exclamation;
              tokenType = Z80Tokens.Exclamation;
              break;

            // --- "<", "<=", "<<", "<?", or file-string
            case "<":
              phase = LexerPhase.AngleLeft;
              tokenType = Z80Tokens.LessThan;
              break;

            // --- ">", ">=", ">>", ">?", or file-string
            case ">":
              phase = LexerPhase.AngleRight;
              tokenType = Z80Tokens.GreaterThan;
              break;

            // --- Multiplication operation
            case "*":
              return completeToken(Z80Tokens.Multiplication);

            // --- Modulo operation or binary literal
            case "%":
              phase = LexerPhase.ModuloOrBinary;
              tokenType = Z80Tokens.Modulo;
              break;

            // --- Binary not
            case "~":
              return completeToken(Z80Tokens.BinaryNot);

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
              tokenType = Z80Tokens.Dot;
              break;

            // --- "#" received
            case "#":
              phase = LexerPhase.DirectiveOrHexLiteral;
              break;

            // --- "$" received
            case "$":
              phase = LexerPhase.Dollar;
              tokenType = Z80Tokens.CurAddress;
              break;

            // Start of a numeric literal
            case "0":
              phase = LexerPhase.LitBodhr;
              tokenType = Z80Tokens.DecimalLiteral;
              break;

            case "1":
              phase = LexerPhase.LitBodhr2;
              tokenType = Z80Tokens.DecimalLiteral;
              break;

            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7":
              phase = LexerPhase.LitOdhr;
              tokenType = Z80Tokens.DecimalLiteral;
              break;

            case "8":
            case "9":
              phase = LexerPhase.LitDhr;
              tokenType = Z80Tokens.DecimalLiteral;
              break;

            case "'":
              phase = LexerPhase.Char;
              break;

            case '"':
              phase = LexerPhase.String;
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
              tokenType = Z80Tokens.EolComment;
              break;
            case "*":
              phase = LexerPhase.InlineCommentBody;
              tokenType = Z80Tokens.Unknown;
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
            return completeToken(Z80Tokens.InlineComment);
          }
          break;

        // --- We already received a "\r", so this is a new line
        case LexerPhase.PotentialNewLine:
          if (ch === "\n") {
            return completeToken(Z80Tokens.NewLine);
          }
          return makeToken();

        // ====================================================================
        // Operator-like tokens

        // --- Colon or double colon
        case LexerPhase.Colon:
          if (ch === ":") {
            return completeToken(Z80Tokens.DoubleColon);
          } else if (ch === "=") {
            return completeToken(Z80Tokens.VarPragma);
          }
          return makeToken();

        // --- Assign or equal
        case LexerPhase.Assign:
          if (ch !== "=") {
            return makeToken();
          }
          phase = LexerPhase.Equal;
          tokenType = Z80Tokens.Equal;
          break;

        // --- Equal or case-insensitive equal
        case LexerPhase.Equal:
          if (ch === "=") {
            return completeToken(Z80Tokens.CiEqual);
          }
          return makeToken();

        // --- "-" or "->"
        case LexerPhase.Minus:
          if (ch === ">") {
            return completeToken(Z80Tokens.GoesTo);
          }
          return makeToken();

        // --- Exclamation ot not equal
        case LexerPhase.Exclamation:
          if (ch !== "=") {
            return makeToken();
          }
          phase = LexerPhase.NotEqual;
          tokenType = Z80Tokens.NotEqual;
          break;

        // --- Not equal or case-insensitive not equal
        case LexerPhase.NotEqual:
          if (ch === "=") {
            return completeToken(Z80Tokens.CiNotEqual);
          }
          return makeToken();

        // --- "<", "<=", "<<", "<?", or file-string
        case LexerPhase.AngleLeft:
          switch (ch) {
            case "=":
              return completeToken(Z80Tokens.LessThanOrEqual);
            case "<":
              return completeToken(Z80Tokens.LeftShift);
            case "?":
              return completeToken(Z80Tokens.MinOp);
            default:
              return makeToken();
          }

        // --- ">", ">=", ">>", ">?"
        case LexerPhase.AngleRight:
          switch (ch) {
            case "=":
              return completeToken(Z80Tokens.GreaterThanOrEqual);
            case ">":
              return completeToken(Z80Tokens.RightShift);
            case "?":
              return completeToken(Z80Tokens.MaxOp);
            default:
              return makeToken();
          }

        // --- "{{"
        case LexerPhase.LBracket:
          if (ch === "{") {
            return completeToken(Z80Tokens.LDBrac);
          }
          return makeToken();

        // --- "}}"
        case LexerPhase.RBracket:
          if (ch === "}") {
            return completeToken(Z80Tokens.RDBrac);
          }
          return makeToken();

        // --- ".", keyword-like, real-number
        case LexerPhase.Dot:
          if (isIdStart(ch)) {
            phase = LexerPhase.IdTail;
          } else if (isDecimalDigit(ch)) {
            phase = LexerPhase.LitRfrac2;
            tokenType = Z80Tokens.RealLiteral;
          } else {
            return makeToken();
          }
          break;

        // ====================================================================
        // Identifier and keyword like tokens

        // --- Wait for the completion of an identifier
        case LexerPhase.IdTail:
          useResolver = true;
          if (ch === "'") {
            return completeToken(Z80Tokens.Identifier);
          } else if (!isIdContinuation(ch)) {
            // --- Special case: DEFG pragma
            if (
              text === "defg" ||
              text === "DEFG" ||
              text === "dg" ||
              text === "DG" ||
              text === ".defg" ||
              text === ".DEFG" ||
              text === ".dg" ||
              text === ".DG"
            ) {
              phase = LexerPhase.DefgTail;
              useResolver = false;
              tokenType = Z80Tokens.DefgPragma;
              break;
            }
            return makeToken();
          }
          break;

        // // --- Wait for the completion of a keyword-like character
        // case LexerPhase.KeywordLike:
        //   useResolver = true;
        //   if (!isLetterOrDigit(ch) && ch !== "_") {
        //     // --- Special case: DEFG pragma
        //     if (
        //       text === ".defg" ||
        //       text === ".DEFG" ||
        //       text === ".dg" ||
        //       text === ".DG"
        //     ) {
        //       phase = LexerPhase.DefgTail;
        //       useResolver = false;
        //       tokenType = TokenType.DefgPragma;
        //       break;
        //     }
        //     return makeToken();
        //   }
        //   break;

        // --- Wait for the completion of hexadecimal number of preprocessor directive
        case LexerPhase.DirectiveOrHexLiteral:
          if (isLetterOrDigit(ch)) {
            if (input.peek() !== null) {
              break;
            }
            appendTokenChar();
          }
          if (
            text.length <= 5 &&
            text
              .substr(1)
              .split("")
              .every((c) => isHexadecimalDigit(c))
          ) {
            tokenType = Z80Tokens.HexadecimalLiteral;
          } else {
            useResolver = true;
          }
          return makeToken();

        // --- Continuation of a "$"
        case LexerPhase.Dollar:
          if (ch === "<") {
            phase = LexerPhase.NoneArgTail;
            break;
          }
          if (isLetterOrDigit(ch)) {
            if (input.peek() !== null) {
              break;
            }
            appendTokenChar();
          }
          if (
            text.length <= 5 &&
            text.length >= 2 &&
            text
              .substr(1)
              .split("")
              .every((c) => isHexadecimalDigit(c))
          ) {
            tokenType = Z80Tokens.HexadecimalLiteral;
          } else {
            useResolver = true;
          }
          return makeToken();

        // --- Wait for the completion od "$<none>$" placeholder
        case LexerPhase.NoneArgTail:
          if (ch === "$") {
            useResolver = false;
            tokenType = text === "$<none>" ? Z80Tokens.NoneArg : Z80Tokens.Unknown;
            return completeToken();
          }
          break;

        case LexerPhase.DefgTail:
          if (ch === "\r" || ch === "\n") {
            return makeToken();
          }
          break;

        // ====================================================================
        // --- Literals

        // --- Modulo operator or continuation of a binary literal
        case LexerPhase.ModuloOrBinary:
          if (!isBinaryDigit(ch)) {
            return makeToken();
          }
          phase = LexerPhase.BinLiteral;
          tokenType = Z80Tokens.BinaryLiteral;
          break;

        // --- Wait for the completion of a binary literal
        case LexerPhase.BinLiteral:
          if (!isBinaryDigit(ch)) {
            return makeToken();
          }
          break;

        // --- "0" received
        case LexerPhase.LitBodhr:
          if (isHexaMark(ch)) {
            phase = LexerPhase.LitHx1;
            tokenType = Z80Tokens.Unknown;
          } else if (isHexaSuffix(ch)) {
            return completeToken(Z80Tokens.HexadecimalLiteral);
          } else if (isOctalSuffix(ch)) {
            return completeToken(Z80Tokens.OctalLiteral);
          } else if (isBinarySuffix(ch, input.ahead(0))) {
            return completeToken(Z80Tokens.BinaryLiteral);
          } else if (ch === ".") {
            phase = LexerPhase.LitRfrac;
            tokenType = Z80Tokens.Unknown;
          } else if (ch === "0" || ch === "1") {
            phase = LexerPhase.LitBodhr2;
          } else if (ch >= "2" && ch <= "7") {
            phase = LexerPhase.LitOdhr;
          } else if (ch === "8" || ch === "9") {
            phase = LexerPhase.LitDhr;
          } else if (ch === "e" || ch === "E") {
            phase = LexerPhase.LitHr;
            tokenType = Z80Tokens.Unknown;
          } else if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.LitH;
            tokenType = Z80Tokens.Unknown;
          } else {
            return makeToken();
          }
          break;

        // --- "0x" received
        case LexerPhase.LitHx1:
          if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.LitHx2;
            tokenType = Z80Tokens.HexadecimalLiteral;
          } else {
            return makeToken();
          }
          break;

        // --- Tail of "0x" hexadecimal literal
        case LexerPhase.LitHx2:
          if (!isHexadecimalDigit(ch)) {
            return makeToken();
          }
          break;

        // Binary, Octal, Decimal, or Hexadecimal
        case LexerPhase.LitBodhr2:
          if (isHexaSuffix(ch)) {
            return completeToken(Z80Tokens.HexadecimalLiteral);
          } else if (isOctalSuffix(ch)) {
            return completeToken(Z80Tokens.OctalLiteral);
          } else if (isBinarySuffix(ch, input.ahead(0))) {
            return completeToken(Z80Tokens.BinaryLiteral);
          } else if (ch === ".") {
            phase = LexerPhase.LitRfrac;
            tokenType = Z80Tokens.Unknown;
          } else if (ch === "0" || ch === "1") {
          } else if (ch >= "2" && ch <= "7") {
            phase = LexerPhase.LitOdhr;
          } else if (ch === "8" || ch === "9") {
            phase = LexerPhase.LitDhr;
          } else if (ch === "e" || ch === "E") {
            phase = LexerPhase.LitHr;
            tokenType = Z80Tokens.Unknown;
          } else if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.LitH;
            tokenType = Z80Tokens.Unknown;
          } else {
            return makeToken();
          }
          break;

        case LexerPhase.LitOdhr:
          if (isHexaSuffix(ch)) {
            return completeToken(Z80Tokens.HexadecimalLiteral);
          } else if (isOctalSuffix(ch)) {
            return completeToken(Z80Tokens.OctalLiteral);
          } else if (ch === ".") {
            phase = LexerPhase.LitRfrac;
            tokenType = Z80Tokens.Unknown;
          } else if (ch >= "0" && ch <= "7") {
          } else if (ch === "8" || ch === "9") {
            phase = LexerPhase.LitDhr;
          } else if (ch === "e" || ch === "E") {
            phase = LexerPhase.LitHr;
            tokenType = Z80Tokens.Unknown;
          } else if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.LitH;
            tokenType = Z80Tokens.Unknown;
          } else {
            return makeToken();
          }
          break;

        case LexerPhase.LitDhr:
          if (isHexaSuffix(ch)) {
            return completeToken(Z80Tokens.HexadecimalLiteral);
          } else if (ch === ".") {
            phase = LexerPhase.LitRfrac;
            tokenType = Z80Tokens.Unknown;
          } else if (ch >= "0" && ch <= "9") {
          } else if (ch === "e" || ch === "E") {
            phase = LexerPhase.LitHr;
            tokenType = Z80Tokens.Unknown;
          } else if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.LitH;
            tokenType = Z80Tokens.Unknown;
          } else {
            return makeToken();
          }
          break;

        case LexerPhase.LitHr:
          if (isHexaSuffix(ch)) {
            return completeToken(Z80Tokens.HexadecimalLiteral);
          } else if (isDecimalDigit(ch)) {
            phase = LexerPhase.LitHr2;
            tokenType = Z80Tokens.RealLiteral;
          } else if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.LitH;
            tokenType = Z80Tokens.Unknown;
          } else if (ch === "+" || ch === "-") {
            phase = LexerPhase.LitRexps;
            tokenType = Z80Tokens.Unknown;
          } else {
            return makeToken();
          }
          break;

        case LexerPhase.LitHr2:
          if (isHexaSuffix(ch)) {
            return completeToken(Z80Tokens.HexadecimalLiteral);
          } else if (isDecimalDigit(ch)) {
          } else if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.LitH;
            tokenType = Z80Tokens.Unknown;
          } else {
            return makeToken();
          }
          break;

        case LexerPhase.LitH:
          if (isHexaSuffix(ch)) {
            return completeToken(Z80Tokens.HexadecimalLiteral);
          } else if (!isHexadecimalDigit(ch)) {
            return makeToken();
          }
          break;

        // First digit of fractional part
        case LexerPhase.LitRfrac:
          if (!isDecimalDigit(ch)) {
            return completeToken(Z80Tokens.Unknown);
          }
          phase = LexerPhase.LitRfrac2;
          tokenType = Z80Tokens.RealLiteral;
          break;

        // Remaining digits of fractional part
        case LexerPhase.LitRfrac2:
          if (ch === "e" || ch === "E") {
            phase = LexerPhase.LitRexp;
          } else if (!isDecimalDigit(ch)) {
            return makeToken();
          }
          break;

        // Wait for exponent sign
        case LexerPhase.LitRexp:
          if (ch === "+" || ch === "-") {
            tokenType = Z80Tokens.Unknown;
            phase = LexerPhase.LitRexps;
          } else if (isDecimalDigit(ch)) {
            phase = LexerPhase.LitRexp2;
          } else {
            return makeToken();
          }
          break;

        // First digit of exponent
        case LexerPhase.LitRexps:
          if (!isDecimalDigit(ch)) {
            return makeToken();
          }
          phase = LexerPhase.LitRexp2;
          tokenType = Z80Tokens.RealLiteral;
          break;

        // Remaining digits of exponent
        case LexerPhase.LitRexp2:
          if (isDecimalDigit(ch)) {
            break;
          }
          return makeToken();

        // Character data
        case LexerPhase.Char:
          if (isRestrictedInString(ch)) {
            return completeToken(Z80Tokens.Unknown);
          } else if (ch === "\\") {
            phase = LexerPhase.CharBackSlash;
            tokenType = Z80Tokens.Unknown;
          } else {
            phase = LexerPhase.CharTail;
          }
          break;

        // Character literal delimiter
        case LexerPhase.CharTail:
          return ch === "'"
            ? completeToken(Z80Tokens.CharLiteral)
            : completeToken(Z80Tokens.Unknown);

        // Start of character escape
        case LexerPhase.CharBackSlash:
          switch (ch) {
            case "i":
            case "p":
            case "f":
            case "b":
            case "I":
            case "o":
            case "a":
            case "t":
            case "P":
            case "C":
            case "'":
            case '"':
            case "\\":
            case "0":
              phase = LexerPhase.CharTail;
              break;
            default:
              if (ch === "x") {
                phase = LexerPhase.CharHexa1;
              } else {
                phase = LexerPhase.CharTail;
              }
          }
          break;

        // First hexadecimal digit of character escape
        case LexerPhase.CharHexa1:
          if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.CharHexa2;
          } else {
            return completeToken(Z80Tokens.Unknown);
          }
          break;

        // Second hexadecimal digit of character escape
        case LexerPhase.CharHexa2:
          if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.CharTail;
          } else {
            return completeToken(Z80Tokens.Unknown);
          }
          break;

        // String data
        case LexerPhase.String:
          if (ch === '"') {
            return completeToken(Z80Tokens.StringLiteral);
          } else if (isRestrictedInString(ch)) {
            return completeToken(Z80Tokens.Unknown);
          } else if (ch === "\\") {
            phase = LexerPhase.StringBackSlash;
            tokenType = Z80Tokens.Unknown;
          }
          break;

        // Start of string character escape
        case LexerPhase.StringBackSlash:
          switch (ch) {
            case "i":
            case "p":
            case "f":
            case "b":
            case "I":
            case "o":
            case "a":
            case "t":
            case "P":
            case "C":
            case "'":
            case '"':
            case "\\":
            case "0":
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
            return completeToken(Z80Tokens.Unknown);
          }
          break;

        // Second hexadecimal digit of character escape
        case LexerPhase.StringHexa2:
          if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.String;
          } else {
            return completeToken(Z80Tokens.Unknown);
          }
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
      lastEndColumn = input.column;
    }

    /**
     * Fetches the next character from the input stream
     */
    function fetchNextChar(): string | null {
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
    function makeToken(): Token<TToken> {
      if (useResolver) {
        tokenType =
          resolverHash[text] ??
          (isIdStart(text[0]) && text[text.length - 1] !== "'"
            ? Z80Tokens.Identifier
            : Z80Tokens.Unknown);
      }
      return {
        text,
        type: tokenType as TToken,
        location: {
          startPosition: startPos,
          endPosition: lastEndPos,
          startLine: line,
          endLine: input.line,
          startColumn,
          endColumn: lastEndColumn
        }
      };
    }

    /**
     * Add the last character to the token and return it
     */
    function completeToken(suggestedType?: CommonTokenType): Token<TToken> {
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
 * This enumeration defines the token types
 */
export const Z80Tokens = {
  ...CommonTokens,

  A: 1000,
  B: 1001,
  C: 1002,
  D: 1003,
  E: 1004,
  H: 1005,
  L: 1006,
  I: 1007,
  R: 1008,
  XL: 1009,
  XH: 1010,
  YL: 1011,
  YH: 1012,
  BC: 1013,
  DE: 1014,
  HL: 1015,
  SP: 1016,
  IX: 1017,
  IY: 1018,
  AF: 1019,
  AF_: 1020,
  Z: 1021,
  NZ: 1022,
  NC: 1023,
  PO: 1024,
  PE: 1025,
  P: 1026,
  M: 1027,

  Nop: 1028,
  Rlca: 1029,
  Rrca: 1030,
  Rla: 1031,
  Rra: 1032,
  Daa: 1033,
  Cpl: 1034,
  Scf: 1035,
  Ccf: 1036,
  Halt: 1037,
  Ret: 1038,
  Exx: 1039,
  Di: 1040,
  Ei: 1041,
  Neg: 1042,
  Retn: 1043,
  Reti: 1044,
  Rld: 1045,
  Rrd: 1046,
  Ldi: 1047,
  Cpi: 1048,
  Ini: 1049,
  Outi: 1050,
  Ldd: 1051,
  Cpd: 1052,
  Ind: 1053,
  Outd: 1054,
  Ldir: 1055,
  Cpir: 1056,
  Inir: 1057,
  Otir: 1058,
  Lddr: 1059,
  Cpdr: 1060,
  Indr: 1061,
  Otdr: 1062,

  Ld: 1063,
  Inc: 1064,
  Dec: 1065,
  Ex: 1066,
  Add: 1067,
  Adc: 1068,
  Sub: 1069,
  Sbc: 1070,
  And: 1071,
  Xor: 1072,
  Or: 1073,
  Cp: 1074,
  Djnz: 1075,
  Jr: 1076,
  Jp: 1077,
  Call: 1078,
  Rst: 1079,
  Push: 1080,
  Pop: 1081,
  In: 1082,
  Out: 1083,
  Im: 1084,
  Rlc: 1085,
  Rrc: 1086,
  Rl: 1087,
  Rr: 1088,
  Sla: 1089,
  Sra: 1090,
  Sll: 1091,
  Srl: 1092,
  Bit: 1093,
  Res: 1094,
  Set: 1095,

  Swapnib: 1096,
  Mirror: 1097,
  Test: 1098,
  Bsla: 1099,
  Bsra: 1100,
  Bsrl: 1101,
  Bsrf: 1102,
  Brlc: 1103,
  Mul: 1104,
  OutInB: 1105,
  NextReg: 1106,
  PixelDn: 1107,
  PixelAd: 1108,
  SetAE: 1109,
  Ldix: 1110,
  Ldws: 1111,
  Lddx: 1112,
  Ldirx: 1113,
  Ldpirx: 1114,
  Lddrx: 1115,

  Macro: 1116,
  Endm: 1117,
  Proc: 1118,
  Endp: 1119,
  Loop: 1120,
  Endl: 1121,
  Repeat: 1122,
  Until: 1123,
  While: 1124,
  Endw: 1125,
  If: 1126,
  IfUsed: 1127,
  IfNUsed: 1128,
  Elif: 1129,
  Else: 1130,
  Endif: 1131,
  For: 1132,
  To: 1133,
  Step: 1134,
  Next: 1135,
  Break: 1136,
  Continue: 1137,
  Module: 1138,
  EndModule: 1139,
  Struct: 1140,
  Ends: 1141,

  HReg: 1142,
  LReg: 1143,
  IsReg8: 1144,
  IsReg8Std: 1145,
  IsReg8Spec: 1146,
  IsReg8Idx: 1147,
  IsReg16: 1148,
  IsReg16Std: 1149,
  IsReg16Idx: 1150,
  IsRegIndirect: 1151,
  IsCPort: 1152,
  IsIndexedAddr: 1153,
  IsCondition: 1154,
  IsExpr: 1155,
  IsRegA: 1156,
  IsRegAf: 1157,
  IsRegB: 1158,
  IsRegC: 1159,
  IsRegBc: 1160,
  IsRegD: 1161,
  IsRegE: 1162,
  IsRegDe: 1163,
  IsRegH: 1164,
  IsRegL: 1165,
  IsRegHl: 1166,
  IsRegI: 1167,
  IsRegR: 1168,
  IsRegXh: 1169,
  IsRegXl: 1170,
  IsRegIx: 1171,
  IsRegYh: 1172,
  IsRegYl: 1173,
  IsRegIy: 1174,
  IsRegSp: 1175
};

export type Z80TokenType = (typeof Z80Tokens)[keyof typeof Z80Tokens];

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

  // Waiting for the identifier completion
  IdTail,

  // "#" received
  DirectiveOrHexLiteral,

  // "$" received
  Dollar,

  // Wait for the end of "$<none>$"
  NoneArgTail,

  // "%" received
  ModuloOrBinary,

  // Wait for the completion of a binary literal
  BinLiteral,

  LitBodhr,
  LitBodhr2,
  LitHx1,
  LitHx2,
  LitOdhr,
  LitDhr,
  LitHr,
  LitHr2,
  LitH,
  LitRfrac,
  LitRfrac2,
  LitRexp,
  LitRexp2,
  LitRexps,

  // "'" received
  Char,

  CharBackSlash,

  CharHexa1,

  CharHexa2,

  CharTail,

  String,

  StringBackSlash,

  StringHexa1,

  StringHexa2,

  StringTail,

  // Wait for the end of DEFG pragma
  DefgTail
}

/**
 * Tests if a token id EOF
 * @param t Token instance
 */
function isEof(t: Token<CommonTokenType>): boolean {
  return t.type === CommonTokens.Eof;
}

/**
 * Tests if a token is whitespace
 * @param t Token instance
 */
function isWs(t: Token<Z80TokenType>): boolean {
  return t.type <= Z80Tokens.Ws;
}

/**
 * Tests if a character is a letter
 * @param ch Character to test
 */
function isLetterOrDigit(ch: string): boolean {
  return (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9");
}

/**
 * Tests if a character is a binary digit
 * @param ch Character to test
 */
function isBinaryDigit(ch: string): boolean {
  return ch === "0" || ch === "1" || ch === "_";
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
  return (ch >= "0" && ch <= "9") || (ch >= "A" && ch <= "F") || (ch >= "a" && ch <= "f");
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
 * Tests if a character can be the suffix of a binary literal
 * @param ch Character to test
 *
 */
function isBinarySuffix(ch: string | null, ra: string | null): boolean {
  return (
    (ch === "b" || ch === "B") && (!ra || (!isHexadecimalDigit(ra) && ra !== "h" && ra !== "H"))
  );
}

/**
 * Tests if a character can be the suffix of a hexadecimal literal
 * @param ch Character to test
 */
function isHexaSuffix(ch: string | null): boolean {
  return ch === "h" || ch === "H";
}

/**
 * Tests if a character can be the suffix of an octal literal
 * @param ch Character to test
 */
function isOctalSuffix(ch: string | null): boolean {
  return ch === "o" || ch === "O" || ch === "q" || ch === "Q";
}

/**
 * Tests if a character is a hexadecimal mark after 0
 * @param ch Character to test
 */
function isHexaMark(ch: string | null): boolean {
  return ch === "x" || ch === "X";
}

/**
 * Tests if a character is restricted in a string
 * @param ch Character to test
 */
function isRestrictedInString(ch: string): boolean {
  return ch === "\r" || ch === "\n" || ch === "\u0085" || ch === "\u2028" || ch === "\u2029";
}

// A hash of keyword-like tokens starting with a dot
const resolverHash: { [key: string]: Z80TokenType } = {
  ...commonResolverHash,
  a: Z80Tokens.A,
  A: Z80Tokens.A,
  b: Z80Tokens.B,
  B: Z80Tokens.B,
  c: Z80Tokens.C,
  C: Z80Tokens.C,
  d: Z80Tokens.D,
  D: Z80Tokens.D,
  e: Z80Tokens.E,
  E: Z80Tokens.E,
  h: Z80Tokens.H,
  H: Z80Tokens.H,
  l: Z80Tokens.L,
  L: Z80Tokens.L,
  i: Z80Tokens.I,
  I: Z80Tokens.I,
  r: Z80Tokens.R,
  R: Z80Tokens.R,
  xl: Z80Tokens.XL,
  XL: Z80Tokens.XL,
  ixl: Z80Tokens.XL,
  IXL: Z80Tokens.XL,
  IXl: Z80Tokens.XL,
  yl: Z80Tokens.YL,
  YL: Z80Tokens.YL,
  iyl: Z80Tokens.YL,
  IYL: Z80Tokens.YL,
  IYl: Z80Tokens.YL,
  xh: Z80Tokens.XH,
  XH: Z80Tokens.XH,
  ixh: Z80Tokens.XH,
  IXH: Z80Tokens.XH,
  IXh: Z80Tokens.XH,
  yh: Z80Tokens.YH,
  YH: Z80Tokens.YH,
  iyh: Z80Tokens.YH,
  IYH: Z80Tokens.YH,
  IYh: Z80Tokens.YH,

  bc: Z80Tokens.BC,
  BC: Z80Tokens.BC,
  de: Z80Tokens.DE,
  DE: Z80Tokens.DE,
  hl: Z80Tokens.HL,
  HL: Z80Tokens.HL,
  sp: Z80Tokens.SP,
  SP: Z80Tokens.SP,
  ix: Z80Tokens.IX,
  IX: Z80Tokens.IX,
  iy: Z80Tokens.IY,
  IY: Z80Tokens.IY,
  af: Z80Tokens.AF,
  AF: Z80Tokens.AF,
  "af'": Z80Tokens.AF_,
  "AF'": Z80Tokens.AF_,

  z: Z80Tokens.Z,
  Z: Z80Tokens.Z,
  nz: Z80Tokens.NZ,
  NZ: Z80Tokens.NZ,
  nc: Z80Tokens.NC,
  NC: Z80Tokens.NC,
  po: Z80Tokens.PO,
  PO: Z80Tokens.PO,
  pe: Z80Tokens.PE,
  PE: Z80Tokens.PE,
  p: Z80Tokens.P,
  P: Z80Tokens.P,
  m: Z80Tokens.M,
  M: Z80Tokens.M,

  nop: Z80Tokens.Nop,
  NOP: Z80Tokens.Nop,
  rlca: Z80Tokens.Rlca,
  RLCA: Z80Tokens.Rlca,
  rrca: Z80Tokens.Rrca,
  RRCA: Z80Tokens.Rrca,
  rla: Z80Tokens.Rla,
  RLA: Z80Tokens.Rla,
  rra: Z80Tokens.Rra,
  RRA: Z80Tokens.Rra,
  daa: Z80Tokens.Daa,
  DAA: Z80Tokens.Daa,
  cpl: Z80Tokens.Cpl,
  CPL: Z80Tokens.Cpl,
  scf: Z80Tokens.Scf,
  SCF: Z80Tokens.Scf,
  ccf: Z80Tokens.Ccf,
  CCF: Z80Tokens.Ccf,
  halt: Z80Tokens.Halt,
  HALT: Z80Tokens.Halt,
  ret: Z80Tokens.Ret,
  RET: Z80Tokens.Ret,
  exx: Z80Tokens.Exx,
  EXX: Z80Tokens.Exx,
  di: Z80Tokens.Di,
  DI: Z80Tokens.Di,
  ei: Z80Tokens.Ei,
  EI: Z80Tokens.Ei,
  neg: Z80Tokens.Neg,
  NEG: Z80Tokens.Neg,
  retn: Z80Tokens.Retn,
  RETN: Z80Tokens.Retn,
  reti: Z80Tokens.Reti,
  RETI: Z80Tokens.Reti,
  rld: Z80Tokens.Rld,
  RLD: Z80Tokens.Rld,
  rrd: Z80Tokens.Rrd,
  RRD: Z80Tokens.Rrd,
  ldi: Z80Tokens.Ldi,
  LDI: Z80Tokens.Ldi,
  cpi: Z80Tokens.Cpi,
  CPI: Z80Tokens.Cpi,
  ini: Z80Tokens.Ini,
  INI: Z80Tokens.Ini,
  outi: Z80Tokens.Outi,
  OUTI: Z80Tokens.Outi,
  ldd: Z80Tokens.Ldd,
  LDD: Z80Tokens.Ldd,
  cpd: Z80Tokens.Cpd,
  CPD: Z80Tokens.Cpd,
  ind: Z80Tokens.Ind,
  IND: Z80Tokens.Ind,
  outd: Z80Tokens.Outd,
  OUTD: Z80Tokens.Outd,
  ldir: Z80Tokens.Ldir,
  LDIR: Z80Tokens.Ldir,
  cpir: Z80Tokens.Cpir,
  CPIR: Z80Tokens.Cpir,
  inir: Z80Tokens.Inir,
  INIR: Z80Tokens.Inir,
  otir: Z80Tokens.Otir,
  OTIR: Z80Tokens.Otir,
  lddr: Z80Tokens.Lddr,
  LDDR: Z80Tokens.Lddr,
  cpdr: Z80Tokens.Cpdr,
  CPDR: Z80Tokens.Cpdr,
  indr: Z80Tokens.Indr,
  INDR: Z80Tokens.Indr,
  otdr: Z80Tokens.Otdr,
  OTDR: Z80Tokens.Otdr,

  ld: Z80Tokens.Ld,
  LD: Z80Tokens.Ld,
  inc: Z80Tokens.Inc,
  INC: Z80Tokens.Inc,
  dec: Z80Tokens.Dec,
  DEC: Z80Tokens.Dec,
  ex: Z80Tokens.Ex,
  EX: Z80Tokens.Ex,
  add: Z80Tokens.Add,
  ADD: Z80Tokens.Add,
  adc: Z80Tokens.Adc,
  ADC: Z80Tokens.Adc,
  sub: Z80Tokens.Sub,
  SUB: Z80Tokens.Sub,
  sbc: Z80Tokens.Sbc,
  SBC: Z80Tokens.Sbc,
  and: Z80Tokens.And,
  AND: Z80Tokens.And,
  xor: Z80Tokens.Xor,
  XOR: Z80Tokens.Xor,
  or: Z80Tokens.Or,
  OR: Z80Tokens.Or,
  cp: Z80Tokens.Cp,
  CP: Z80Tokens.Cp,
  djnz: Z80Tokens.Djnz,
  DJNZ: Z80Tokens.Djnz,
  jr: Z80Tokens.Jr,
  JR: Z80Tokens.Jr,
  jp: Z80Tokens.Jp,
  JP: Z80Tokens.Jp,
  call: Z80Tokens.Call,
  CALL: Z80Tokens.Call,
  rst: Z80Tokens.Rst,
  RST: Z80Tokens.Rst,
  push: Z80Tokens.Push,
  PUSH: Z80Tokens.Push,
  pop: Z80Tokens.Pop,
  POP: Z80Tokens.Pop,
  in: Z80Tokens.In,
  IN: Z80Tokens.In,
  out: Z80Tokens.Out,
  OUT: Z80Tokens.Out,
  im: Z80Tokens.Im,
  IM: Z80Tokens.Im,
  rlc: Z80Tokens.Rlc,
  RLC: Z80Tokens.Rlc,
  rrc: Z80Tokens.Rrc,
  RRC: Z80Tokens.Rrc,
  rl: Z80Tokens.Rl,
  RL: Z80Tokens.Rl,
  rr: Z80Tokens.Rr,
  RR: Z80Tokens.Rr,
  sla: Z80Tokens.Sla,
  SLA: Z80Tokens.Sla,
  sra: Z80Tokens.Sra,
  SRA: Z80Tokens.Sra,
  sll: Z80Tokens.Sll,
  SLL: Z80Tokens.Sll,
  srl: Z80Tokens.Srl,
  SRL: Z80Tokens.Srl,
  bit: Z80Tokens.Bit,
  BIT: Z80Tokens.Bit,
  set: Z80Tokens.Set,
  SET: Z80Tokens.Set,
  res: Z80Tokens.Res,
  RES: Z80Tokens.Res,

  swapnib: Z80Tokens.Swapnib,
  SWAPNIB: Z80Tokens.Swapnib,
  swap: Z80Tokens.Swapnib,
  SWAP: Z80Tokens.Swapnib,
  mirror: Z80Tokens.Mirror,
  MIRROR: Z80Tokens.Mirror,
  mirr: Z80Tokens.Mirror,
  MIRR: Z80Tokens.Mirror,
  test: Z80Tokens.Test,
  TEST: Z80Tokens.Test,
  bsla: Z80Tokens.Bsla,
  BSLA: Z80Tokens.Bsla,
  bsra: Z80Tokens.Bsra,
  BSRA: Z80Tokens.Bsra,
  bsrl: Z80Tokens.Bsrl,
  BSRL: Z80Tokens.Bsrl,
  bsrf: Z80Tokens.Bsrf,
  BSRF: Z80Tokens.Bsrf,
  brlc: Z80Tokens.Brlc,
  BRLC: Z80Tokens.Brlc,
  mul: Z80Tokens.Mul,
  MUL: Z80Tokens.Mul,
  outinb: Z80Tokens.OutInB,
  OUTINB: Z80Tokens.OutInB,
  otib: Z80Tokens.OutInB,
  OTIB: Z80Tokens.OutInB,
  nextreg: Z80Tokens.NextReg,
  NEXTREG: Z80Tokens.NextReg,
  nreg: Z80Tokens.NextReg,
  NREG: Z80Tokens.NextReg,
  pixeldn: Z80Tokens.PixelDn,
  PIXELDN: Z80Tokens.PixelDn,
  pxdn: Z80Tokens.PixelDn,
  PXDN: Z80Tokens.PixelDn,
  pixelad: Z80Tokens.PixelAd,
  PIXELAD: Z80Tokens.PixelAd,
  pxad: Z80Tokens.PixelAd,
  PXAD: Z80Tokens.PixelAd,
  setae: Z80Tokens.SetAE,
  SETAE: Z80Tokens.SetAE,
  stae: Z80Tokens.SetAE,
  STAE: Z80Tokens.SetAE,
  ldix: Z80Tokens.Ldix,
  LDIX: Z80Tokens.Ldix,
  ldws: Z80Tokens.Ldws,
  LDWS: Z80Tokens.Ldws,
  lddx: Z80Tokens.Lddx,
  LDDX: Z80Tokens.Lddx,
  ldirx: Z80Tokens.Ldirx,
  LDIRX: Z80Tokens.Ldirx,
  lirx: Z80Tokens.Ldirx,
  LIRX: Z80Tokens.Ldirx,
  ldpirx: Z80Tokens.Ldpirx,
  LDPIRX: Z80Tokens.Ldpirx,
  lprx: Z80Tokens.Ldpirx,
  LPRX: Z80Tokens.Ldpirx,
  lddrx: Z80Tokens.Lddrx,
  LDDRX: Z80Tokens.Lddrx,
  ldrx: Z80Tokens.Lddrx,
  LDRX: Z80Tokens.Lddrx,

  hreg: Z80Tokens.HReg,
  HREG: Z80Tokens.HReg,

  lreg: Z80Tokens.LReg,
  LREG: Z80Tokens.LReg,

  isreg8: Z80Tokens.IsReg8,
  ISREG8: Z80Tokens.IsReg8,

  isreg8std: Z80Tokens.IsReg8Std,
  ISREG8STD: Z80Tokens.IsReg8Std,

  isreg8spec: Z80Tokens.IsReg8Spec,
  ISREG8SPEC: Z80Tokens.IsReg8Spec,

  isreg8idx: Z80Tokens.IsReg8Idx,
  ISREG8IDX: Z80Tokens.IsReg8Idx,

  isreg16: Z80Tokens.IsReg16,
  ISREG16: Z80Tokens.IsReg16,

  isreg16std: Z80Tokens.IsReg16Std,
  ISREG16STD: Z80Tokens.IsReg16Std,

  isreg16idx: Z80Tokens.IsReg16Idx,
  ISREG16IDX: Z80Tokens.IsReg16Idx,

  isregindirect: Z80Tokens.IsRegIndirect,
  ISREGINDIRECT: Z80Tokens.IsRegIndirect,

  iscport: Z80Tokens.IsCPort,
  ISCPORT: Z80Tokens.IsCPort,

  iscondition: Z80Tokens.IsCondition,
  ISCONDITION: Z80Tokens.IsCondition,

  isexpr: Z80Tokens.IsExpr,
  ISEXPR: Z80Tokens.IsExpr,

  isrega: Z80Tokens.IsRegA,
  ISREGA: Z80Tokens.IsRegA,
  isregaf: Z80Tokens.IsRegAf,
  ISREGAF: Z80Tokens.IsRegAf,
  isregb: Z80Tokens.IsRegB,
  ISREGB: Z80Tokens.IsRegB,
  isregc: Z80Tokens.IsRegC,
  ISREGC: Z80Tokens.IsRegC,
  isregbc: Z80Tokens.IsRegBc,
  ISREGBC: Z80Tokens.IsRegBc,
  isregd: Z80Tokens.IsRegD,
  ISREGD: Z80Tokens.IsRegD,
  isrege: Z80Tokens.IsRegE,
  ISREGE: Z80Tokens.IsRegE,
  isregde: Z80Tokens.IsRegDe,
  ISREGDE: Z80Tokens.IsRegDe,
  isregh: Z80Tokens.IsRegH,
  ISREGH: Z80Tokens.IsRegH,
  isregl: Z80Tokens.IsRegL,
  ISREGL: Z80Tokens.IsRegL,
  isreghl: Z80Tokens.IsRegHl,
  ISREGHL: Z80Tokens.IsRegHl,
  isregi: Z80Tokens.IsRegI,
  ISREGI: Z80Tokens.IsRegI,
  isregr: Z80Tokens.IsRegR,
  ISREGR: Z80Tokens.IsRegR,
  isregxh: Z80Tokens.IsRegXh,
  ISREGXH: Z80Tokens.IsRegXh,
  isregxl: Z80Tokens.IsRegXl,
  ISREGXL: Z80Tokens.IsRegXl,
  isregix: Z80Tokens.IsRegIx,
  ISREGIX: Z80Tokens.IsRegIx,
  isregyh: Z80Tokens.IsRegYh,
  ISREGYH: Z80Tokens.IsRegYh,
  isregyl: Z80Tokens.IsRegYl,
  ISREGYL: Z80Tokens.IsRegYl,
  isregiy: Z80Tokens.IsRegIy,
  ISREGIY: Z80Tokens.IsRegIy,
  isregsp: Z80Tokens.IsRegSp,
  ISREGSP: Z80Tokens.IsRegSp
};
