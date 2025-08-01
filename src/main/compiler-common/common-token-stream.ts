import { Token } from "@main/compiler-common/tree-nodes";
import { InputStream } from "./input-stream";
import { CommonTokens, CommonTokenType } from "@main/compiler-common/common-tokens";

/**
 * This class implements the tokenizer (lexer) of the assembler
 */
export abstract class CommonTokenStream<TToken extends CommonTokenType> {
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
   * Gets the resolver hash for the current token stream
   */
  abstract getResolverHash(): Record<string, TToken>;

  /**
   * Gets the escape characters for the current token stream
   */
  abstract get escapeChars(): string[];

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
      if (token.type === CommonTokens.EolComment) {
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
      if (token.type === CommonTokens.EolComment) {
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
      if (tokenType === CommonTokens.Eof) {
        tokenType = CommonTokens.Unknown;
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
              tokenType = CommonTokens.Ws;
              break;

            // --- Standard assembly comment
            case ";":
              phase = LexerPhase.InEolComment;
              tokenType = CommonTokens.EolComment;
              break;

            // --- Divison or comment
            case "/":
              phase = LexerPhase.InPotentialComment;
              tokenType = CommonTokens.Divide;
              break;

            // --- New line
            case "\n":
              return completeToken(CommonTokens.NewLine);

            // --- Potential new line
            case "\r":
              phase = LexerPhase.PotentialNewLine;
              tokenType = CommonTokens.NewLine;
              break;

            // --- ":", "::", or ":="
            case ":":
              phase = LexerPhase.Colon;
              tokenType = CommonTokens.Colon;
              break;

            // --- Comma
            case ",":
              return completeToken(CommonTokens.Comma);

            // --- "=", "==", and "==="
            case "=":
              phase = LexerPhase.Assign;
              tokenType = CommonTokens.Assign;
              break;

            // --- Left parenthesis
            case "(":
              return completeToken(CommonTokens.LPar);

            // --- Right parenthesis
            case ")":
              return completeToken(CommonTokens.RPar);

            // --- Left square bracket
            case "[":
              return completeToken(CommonTokens.LSBrac);

            // --- Right square bracket
            case "]":
              return completeToken(CommonTokens.RSBrac);

            // --- Question mark
            case "?":
              return completeToken(CommonTokens.QuestionMark);

            // --- Plus mark
            case "+":
              return completeToken(CommonTokens.Plus);

            // --- "-" or "->"
            case "-":
              phase = LexerPhase.Minus;
              tokenType = CommonTokens.Minus;
              break;

            // --- Vertical bar
            case "|":
              return completeToken(CommonTokens.VerticalBar);

            // --- Up arrow
            case "^":
              return completeToken(CommonTokens.UpArrow);

            // --- Ampersand
            case "&":
              return completeToken(CommonTokens.Ampersand);

            // --- "!", "!=", or "!=="
            case "!":
              phase = LexerPhase.Exclamation;
              tokenType = CommonTokens.Exclamation;
              break;

            // --- "<", "<=", "<<", "<?", or file-string
            case "<":
              phase = LexerPhase.AngleLeft;
              tokenType = CommonTokens.LessThan;
              break;

            // --- ">", ">=", ">>", ">?", or file-string
            case ">":
              phase = LexerPhase.AngleRight;
              tokenType = CommonTokens.GreaterThan;
              break;

            // --- Multiplication operation
            case "*":
              return completeToken(CommonTokens.Multiplication);

            // --- Modulo operation or binary literal
            case "%":
              phase = LexerPhase.ModuloOrBinary;
              tokenType = CommonTokens.Modulo;
              break;

            // --- Binary not
            case "~":
              return completeToken(CommonTokens.BinaryNot);

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
              tokenType = CommonTokens.Dot;
              break;

            // --- "#" received
            case "#":
              phase = LexerPhase.DirectiveOrHexLiteral;
              break;

            // --- "$" received
            case "$":
              phase = LexerPhase.Dollar;
              tokenType = CommonTokens.CurAddress;
              break;

            // Start of a numeric literal
            case "0":
              phase = LexerPhase.LitBodhr;
              tokenType = CommonTokens.DecimalLiteral;
              break;

            case "1":
              phase = LexerPhase.LitBodhr2;
              tokenType = CommonTokens.DecimalLiteral;
              break;

            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7":
              phase = LexerPhase.LitOdhr;
              tokenType = CommonTokens.DecimalLiteral;
              break;

            case "8":
            case "9":
              phase = LexerPhase.LitDhr;
              tokenType = CommonTokens.DecimalLiteral;
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
              tokenType = CommonTokens.EolComment;
              break;
            case "*":
              phase = LexerPhase.InlineCommentBody;
              tokenType = CommonTokens.Unknown;
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
            return completeToken(CommonTokens.InlineComment);
          }
          break;

        // --- We already received a "\r", so this is a new line
        case LexerPhase.PotentialNewLine:
          if (ch === "\n") {
            return completeToken(CommonTokens.NewLine);
          }
          return makeToken();

        // ====================================================================
        // Operator-like tokens

        // --- Colon or double colon
        case LexerPhase.Colon:
          if (ch === ":") {
            return completeToken(CommonTokens.DoubleColon);
          } else if (ch === "=") {
            return completeToken(CommonTokens.VarPragma);
          }
          return makeToken();

        // --- Assign or equal
        case LexerPhase.Assign:
          if (ch !== "=") {
            return makeToken();
          }
          phase = LexerPhase.Equal;
          tokenType = CommonTokens.Equal;
          break;

        // --- Equal or case-insensitive equal
        case LexerPhase.Equal:
          if (ch === "=") {
            return completeToken(CommonTokens.CiEqual);
          }
          return makeToken();

        // --- "-" or "->"
        case LexerPhase.Minus:
          if (ch === ">") {
            return completeToken(CommonTokens.GoesTo);
          }
          return makeToken();

        // --- Exclamation ot not equal
        case LexerPhase.Exclamation:
          if (ch !== "=") {
            return makeToken();
          }
          phase = LexerPhase.NotEqual;
          tokenType = CommonTokens.NotEqual;
          break;

        // --- Not equal or case-insensitive not equal
        case LexerPhase.NotEqual:
          if (ch === "=") {
            return completeToken(CommonTokens.CiNotEqual);
          }
          return makeToken();

        // --- "<", "<=", "<<", "<?", or file-string
        case LexerPhase.AngleLeft:
          switch (ch) {
            case "=":
              return completeToken(CommonTokens.LessThanOrEqual);
            case "<":
              return completeToken(CommonTokens.LeftShift);
            case "?":
              return completeToken(CommonTokens.MinOp);
            default:
              return makeToken();
          }

        // --- ">", ">=", ">>", ">?"
        case LexerPhase.AngleRight:
          switch (ch) {
            case "=":
              return completeToken(CommonTokens.GreaterThanOrEqual);
            case ">":
              return completeToken(CommonTokens.RightShift);
            case "?":
              return completeToken(CommonTokens.MaxOp);
            default:
              return makeToken();
          }

        // --- "{{"
        case LexerPhase.LBracket:
          if (ch === "{") {
            return completeToken(CommonTokens.LDBrac);
          }
          return makeToken();

        // --- "}}"
        case LexerPhase.RBracket:
          if (ch === "}") {
            return completeToken(CommonTokens.RDBrac);
          }
          return makeToken();

        // --- ".", keyword-like, real-number
        case LexerPhase.Dot:
          if (isIdStart(ch)) {
            phase = LexerPhase.IdTail;
          } else if (isDecimalDigit(ch)) {
            phase = LexerPhase.LitRfrac2;
            tokenType = CommonTokens.RealLiteral;
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
            return completeToken(CommonTokens.Identifier);
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
              tokenType = CommonTokens.DefgPragma;
              break;
            }
            return makeToken();
          }
          break;

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
              .substring(1)
              .split("")
              .every((c) => isHexadecimalDigit(c))
          ) {
            tokenType = CommonTokens.HexadecimalLiteral;
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
            tokenType = CommonTokens.HexadecimalLiteral;
          } else {
            useResolver = true;
          }
          return makeToken();

        // --- Wait for the completion od "$<none>$" placeholder
        case LexerPhase.NoneArgTail:
          if (ch === "$") {
            useResolver = false;
            tokenType = text === "$<none>" ? CommonTokens.NoneArg : CommonTokens.Unknown;
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
          tokenType = CommonTokens.BinaryLiteral;
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
            tokenType = CommonTokens.Unknown;
          } else if (isHexaSuffix(ch)) {
            return completeToken(CommonTokens.HexadecimalLiteral);
          } else if (isOctalSuffix(ch)) {
            return completeToken(CommonTokens.OctalLiteral);
          } else if (isBinarySuffix(ch, input.ahead(0))) {
            return completeToken(CommonTokens.BinaryLiteral);
          } else if (ch === ".") {
            phase = LexerPhase.LitRfrac;
            tokenType = CommonTokens.Unknown;
          } else if (ch === "0" || ch === "1") {
            phase = LexerPhase.LitBodhr2;
          } else if (ch >= "2" && ch <= "7") {
            phase = LexerPhase.LitOdhr;
          } else if (ch === "8" || ch === "9") {
            phase = LexerPhase.LitDhr;
          } else if (ch === "e" || ch === "E") {
            phase = LexerPhase.LitHr;
            tokenType = CommonTokens.Unknown;
          } else if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.LitH;
            tokenType = CommonTokens.Unknown;
          } else {
            return makeToken();
          }
          break;

        // --- "0x" received
        case LexerPhase.LitHx1:
          if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.LitHx2;
            tokenType = CommonTokens.HexadecimalLiteral;
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
            return completeToken(CommonTokens.HexadecimalLiteral);
          } else if (isOctalSuffix(ch)) {
            return completeToken(CommonTokens.OctalLiteral);
          } else if (isBinarySuffix(ch, input.ahead(0))) {
            return completeToken(CommonTokens.BinaryLiteral);
          } else if (ch === ".") {
            phase = LexerPhase.LitRfrac;
            tokenType = CommonTokens.Unknown;
          } else if (ch === "0" || ch === "1") {
          } else if (ch >= "2" && ch <= "7") {
            phase = LexerPhase.LitOdhr;
          } else if (ch === "8" || ch === "9") {
            phase = LexerPhase.LitDhr;
          } else if (ch === "e" || ch === "E") {
            phase = LexerPhase.LitHr;
            tokenType = CommonTokens.Unknown;
          } else if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.LitH;
            tokenType = CommonTokens.Unknown;
          } else {
            return makeToken();
          }
          break;

        case LexerPhase.LitOdhr:
          if (isHexaSuffix(ch)) {
            return completeToken(CommonTokens.HexadecimalLiteral);
          } else if (isOctalSuffix(ch)) {
            return completeToken(CommonTokens.OctalLiteral);
          } else if (ch === ".") {
            phase = LexerPhase.LitRfrac;
            tokenType = CommonTokens.Unknown;
          } else if (ch >= "0" && ch <= "7") {
          } else if (ch === "8" || ch === "9") {
            phase = LexerPhase.LitDhr;
          } else if (ch === "e" || ch === "E") {
            phase = LexerPhase.LitHr;
            tokenType = CommonTokens.Unknown;
          } else if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.LitH;
            tokenType = CommonTokens.Unknown;
          } else {
            return makeToken();
          }
          break;

        case LexerPhase.LitDhr:
          if (isHexaSuffix(ch)) {
            return completeToken(CommonTokens.HexadecimalLiteral);
          } else if (ch === ".") {
            phase = LexerPhase.LitRfrac;
            tokenType = CommonTokens.Unknown;
          } else if (ch >= "0" && ch <= "9") {
          } else if (ch === "e" || ch === "E") {
            phase = LexerPhase.LitHr;
            tokenType = CommonTokens.Unknown;
          } else if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.LitH;
            tokenType = CommonTokens.Unknown;
          } else {
            return makeToken();
          }
          break;

        case LexerPhase.LitHr:
          if (isHexaSuffix(ch)) {
            return completeToken(CommonTokens.HexadecimalLiteral);
          } else if (isDecimalDigit(ch)) {
            phase = LexerPhase.LitHr2;
            tokenType = CommonTokens.RealLiteral;
          } else if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.LitH;
            tokenType = CommonTokens.Unknown;
          } else if (ch === "+" || ch === "-") {
            phase = LexerPhase.LitRexps;
            tokenType = CommonTokens.Unknown;
          } else {
            return makeToken();
          }
          break;

        case LexerPhase.LitHr2:
          if (isHexaSuffix(ch)) {
            return completeToken(CommonTokens.HexadecimalLiteral);
          } else if (isDecimalDigit(ch)) {
          } else if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.LitH;
            tokenType = CommonTokens.Unknown;
          } else {
            return makeToken();
          }
          break;

        case LexerPhase.LitH:
          if (isHexaSuffix(ch)) {
            return completeToken(CommonTokens.HexadecimalLiteral);
          } else if (!isHexadecimalDigit(ch)) {
            return makeToken();
          }
          break;

        // First digit of fractional part
        case LexerPhase.LitRfrac:
          if (!isDecimalDigit(ch)) {
            return completeToken(CommonTokens.Unknown);
          }
          phase = LexerPhase.LitRfrac2;
          tokenType = CommonTokens.RealLiteral;
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
            tokenType = CommonTokens.Unknown;
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
          tokenType = CommonTokens.RealLiteral;
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
            return completeToken(CommonTokens.Unknown);
          } else if (ch === "\\") {
            phase = LexerPhase.CharBackSlash;
            tokenType = CommonTokens.Unknown;
          } else {
            phase = LexerPhase.CharTail;
          }
          break;

        // Character literal delimiter
        case LexerPhase.CharTail:
          return ch === "'"
            ? completeToken(CommonTokens.CharLiteral)
            : completeToken(CommonTokens.Unknown);

        // Start of character escape
        case LexerPhase.CharBackSlash:
          if (ch === "x") {
            phase = LexerPhase.CharHexa1;
          } else if (this.escapeChars.includes(ch)) {
            phase = LexerPhase.CharTail;
          } else {
            phase = LexerPhase.CharTail;
          }
          break;

        // First hexadecimal digit of character escape
        case LexerPhase.CharHexa1:
          if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.CharHexa2;
          } else {
            return completeToken(CommonTokens.Unknown);
          }
          break;

        // Second hexadecimal digit of character escape
        case LexerPhase.CharHexa2:
          if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.CharTail;
          } else {
            return completeToken(CommonTokens.Unknown);
          }
          break;

        // String data
        case LexerPhase.String:
          if (ch === '"') {
            return completeToken(CommonTokens.StringLiteral);
          } else if (isRestrictedInString(ch)) {
            return completeToken(CommonTokens.Unknown);
          } else if (ch === "\\") {
            phase = LexerPhase.StringBackSlash;
            tokenType = CommonTokens.Unknown;
          }
          break;

        // Start of string character escape
        case LexerPhase.StringBackSlash:
          if (ch === "x") {
            phase = LexerPhase.StringHexa1;
          } else if (this.escapeChars.includes(ch)) {
            phase = LexerPhase.String;
          } else {
            phase = LexerPhase.String;
          }
          break;

        // First hexadecimal digit of string character escape
        case LexerPhase.StringHexa1:
          if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.StringHexa2;
          } else {
            return completeToken(CommonTokens.Unknown);
          }
          break;

        // Second hexadecimal digit of character escape
        case LexerPhase.StringHexa2:
          if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.String;
          } else {
            return completeToken(CommonTokens.Unknown);
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
          lexer.getResolverHash()[text] ??
          (isIdStart(text[0]) && text[text.length - 1] !== "'"
            ? CommonTokens.Identifier
            : CommonTokens.Unknown);
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
function isWs(t: Token<CommonTokenType>): boolean {
  return t.type <= CommonTokens.Ws;
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
