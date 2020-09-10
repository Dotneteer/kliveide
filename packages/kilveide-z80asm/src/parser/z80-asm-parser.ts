import { TokenStream, Token, TokenType } from "./token-stream";
import {
  Program,
  Z80AssemblyLine,
  program,
  simpleZ80Instruction,
  PartialZ80AssemblyLine,
  LabelOnlyLine,
  SimpleZ80Instruction,
  ExpressionNode,
  UnaryExpression,
  Symbol,
  ConditionalExpression,
  BinaryExpression,
} from "./tree-nodes";
import { ErrorMessage, errorMessages, ErrorCodes } from "../errors";
import { ParserError } from "./parse-errors";
import { getTokenTraits, TokenTraits } from "./token-traits";
import { parse } from "path";
import { totalmem } from "os";

/**
 * This class implements the Z80 assembly parser
 */
export class Z80AsmParser {
  private readonly _parseErrors: ErrorMessage[] = [];

  /**
   * Initializes the parser with the specified token stream
   * @param tokens Token stream of the source code
   */
  constructor(public readonly tokens: TokenStream) {}

  /**
   * The errors raised during the parse phase
   */
  get errors(): ErrorMessage[] {
    return this._parseErrors;
  }

  /**
   * Indicates if there were any errors during the parse phase
   */
  get hasErrors(): boolean {
    return this._parseErrors.length > 0;
  }

  /**
   * Finds the end of line to recover from the last parse error
   */
  recoverFromParseError(): void {
    let token: Token;
    do {
      token = this.tokens.get();
      if (token.type === TokenType.NewLine) {
        return;
      }
    } while (token.type !== TokenType.Eof);
  }

  /**
   * program
   *   : (assemblyLine? NewLine*)* EOF
   *   ;
   */
  parseProgram(): Program | null {
    let token: Token;
    const assemblyLines: Z80AssemblyLine[] = [];
    while ((token = this.tokens.peek()).type !== TokenType.Eof) {
      // --- We skip empty lines
      if (token.type === TokenType.NewLine) {
        this.tokens.get();
        continue;
      }

      // --- Parse the subsequent line
      try {
        const parsedLine = this.parseAssemblyLine();
        if (parsedLine) {
          assemblyLines.push(parsedLine);
          this.expectToken(TokenType.NewLine, true);
        }
      } catch (err) {
        // --- We recover from all reported parser errors here
        if (err instanceof ParserError) {
          this.recoverFromParseError();
        } else {
          throw err;
        }
      }
    }
    return program(assemblyLines);
  }

  // ==========================================================================
  // Rule parsers

  /**
   * assemblyLine
   *   : label? lineBody?
   *   | directive
   *   ;
   */
  parseAssemblyLine(): Z80AssemblyLine | null {
    const parsePoint = this.getParsePoint();
    const { start } = parsePoint;
    let asmLine: PartialZ80AssemblyLine | null = null;
    if (this.startsLabel(start) || this.startsLineBody(start)) {
      const label = this.parseLabel(parsePoint);
      asmLine = this.parseLineBody(this.getParsePoint());
      if (asmLine) {
        asmLine.label = label;
      } else {
        asmLine = <LabelOnlyLine>{
          type: "LabelOnlyLine",
          label,
        };
      }
    } else {
      // Handle the "directive" alternative branch
    }

    if (!asmLine) {
      // --- Unsuccessful parsing
      return null;
    }

    // --- Complete the line with position information
    const nextToken = this.tokens.peek();
    const resultLine: Z80AssemblyLine = Object.assign({}, asmLine, {
      line: start.location.line,
      startPosition: start.location.startPos,
      startColumn: start.location.startColumn,
      endPosition: nextToken.location.startPos,
      endColumn: nextToken.location.startColumn,
    });
    return resultLine;
  }

  /**
   * expr
   *   : LPar expr RPar
   *   | LSBrac expr RSBrac
   *   | conditionalExpr
   *   ;
   */
  parseExpr(): ExpressionNode | null {
    const parsePoint = this.getParsePoint();
    const { start, traits } = parsePoint;
    if (!traits.expressionStart) {
      // --- Cannot be an expression
      return null;
    }

    if (start.type === TokenType.LPar) {
      return this.parseParExpr();
    }
    if (start.type === TokenType.LSBrac) {
      return this.parseBrackExpr();
    }
    return this.parseCondExpr();
  }

  /**
   * label
   *   : Identifier Colon?
   *   ;
   */
  private parseLabel(parsePoint: ParsePoint): string | null {
    const { start } = parsePoint;
    if (start.type === TokenType.Identifier) {
      const nextToken = this.tokens.ahead(1);
      if (nextToken.type === TokenType.LPar) {
        // --- Identifier LPar <-- Beginning of a macro or function invocation
        return null;
      }

      // --- The token is an identifier
      // --- Skip the identifier and the optional colon
      this.tokens.get();
      this.tokens.peekAndGet(TokenType.Colon);
      return start.text;
    }
    return null;
  }

  /**
   * lineBody
   *   : pragma
   *   | instruction
   *   | macroParam
   *   | statement
   *   | macroOrStructInvocation
   *   | fieldAssignment
   *   ;
   */
  private parseLineBody(parsePoint: ParsePoint): PartialZ80AssemblyLine | null {
    const { start, traits } = parsePoint;
    if (start.type === TokenType.NewLine || start.type === TokenType.Eof) {
      return null;
    } else if (traits.pragma) {
      return this.parsePragma(parsePoint);
    } else if (traits.instruction) {
      return this.parseInstruction(parsePoint);
    } else if (start.type === TokenType.LDBrac) {
      return this.parseMacroParam(parsePoint);
    } else if (traits.statement) {
      return this.parseStatement(parsePoint);
    } else if (start.type === TokenType.Identifier) {
      return this.parseMacroOrStructInvocation(parsePoint);
    } else if (start.type === TokenType.GoesTo) {
      return this.parseFieldAssignment(parsePoint);
    }
    this.reportError("Z1002", start, [start.text]);
    return null;
  }

  /**
   * pragma
   *   : orgPragma
   *   | xorgPragma
   *   | entPragma
   *   | xentPragma
   *   | dispPragma
   *   | equPragma
   *   | varPragma
   *   | defbPragma
   *   | defwPragma
   *   | defmPragma
   *   | defcPragma
   *   | defnPragma
   *   | defhPragma
   *   | skipPragma
   *   | externPragma
   *   | defsPragma
   *   | fillbPragma
   *   | fillwPragma
   *   | modelPragma
   *   | alignPragma
   *   | tracePragma
   *   | rndSeedPragma
   *   | defgxPragma
   *   | defgPragma
   *   | errorPragma
   *   | incBinPragma
   *   | compareBinPragma
   *   ;
   */
  private parsePragma(parsePoint: ParsePoint): PartialZ80AssemblyLine | null {
    // TODO: Implement this method
    return null;
  }

  /**
   * instruction
   *   : simpleInstruction
   *   | compoundInstruction
   *   ;
   */
  private parseInstruction(
    parsePoint: ParsePoint
  ): PartialZ80AssemblyLine | null {
    const { traits } = parsePoint;
    if (traits.simple) {
      return this.parseSimpleInstruction(parsePoint);
    } else {
      // TODO: Implement this method
    }
    return null;
  }

  /**
   * simpleOperation
   *   : NOP
   *   | RLCA
   *   | RRCA
   *   | RLA
   *   | RRA
   *   | DAA
   *   | CPL
   *   | SCF
   *   | CCF
   *   | HALT
   *   | EXX
   *   | DI
   *   | EI
   *   | NEG
   *   | RETN
   *   | RETI
   *   | RLD
   *   | RRD
   *   | LDI
   *   | CPI
   *   | INI
   *   | OUTI
   *   | LDD
   *   | CPD
   *   | IND
   *   | OUTD
   *   | LDIR
   *   | CPIR
   *   | INIR
   *   | OTIR
   *   | LDDR
   *   | CPDR
   *   | INDR
   *   | OTDR
   *   | LDIX
   *   | LDWS
   *   | LDIRX
   *   | LDDX
   *   | LDDRX
   *   | LDPIRX
   *   | OUTINB
   *   | SWAPNIB
   *   | PIXELDN
   *   | PIXELAD
   *   | SETAE
   *   ;
   */
  private parseSimpleInstruction(
    parsePoint: ParsePoint
  ): SimpleZ80Instruction | null {
    this.tokens.get();
    return {
      type: "SimpleZ80Instruction",
      mnemonic: parsePoint.start.text.toUpperCase(),
    };
  }

  private parseCompoundInstruction(
    parsePoint: ParsePoint
  ): PartialZ80AssemblyLine | null {
    // TODO: Implement this method
    return null;
  }

  /**
   * macroParam
   *   : LDBrac Identifier RDBrac
   *   ;
   */
  private parseMacroParam(parsePoint: ParsePoint): ExpressionNode | null {
    // TODO: Implement this method
    return null;
  }

  /**
   * statement
   *   : macroStatement
   *   | macroEndMarker
   *   | loopStatement
   *   | loopEndMarker
   *   | procStatement
   *   | procEndMarker
   *   | repeatStatement
   *   | untilStatement
   *   | whileStatement
   *   | whileEndMarker
   *   | ifStatement
   *   | elifStatement
   *   | elseStatement
   *   | endifStatement
   *   | forStatement
   *   | nextStatement
   *   | breakStatement
   *   | continueStatement
   *   | moduleStatement
   *   | moduleEndMarker
   *   | structStatement
   *   | structEndMarker
   *   ;
   */
  private parseStatement(
    parsePoint: ParsePoint
  ): PartialZ80AssemblyLine | null {
    // TODO: Implement this method
    return null;
  }

  /**
   * macroOrStructInvocation
   *   : Identifier LPar macroArgument (Comma macroArgument)* RPar
   *   ;
   */
  private parseMacroOrStructInvocation(
    parsePoint: ParsePoint
  ): PartialZ80AssemblyLine | null {
    // TODO: Implement this method
    return null;
  }

  /**
   * fieldAssignment
   *   : GoesTo byteEmPragma
   *   ;
   */
  private parseFieldAssignment(
    parsePoint: ParsePoint
  ): PartialZ80AssemblyLine | null {
    // TODO: Implement this method
    return null;
  }

  /**
   *
   * @param parsePoint
   */
  private parseBuiltInFunctionInvocation(
    parsePoint: ParsePoint
  ): ExpressionNode | null {
    // TODO: Implement this method
    return null;
  }

  /**
   *
   * @param parsePoint
   */
  private parseFunctionInvocation(
    parsePoint: ParsePoint
  ): ExpressionNode | null {
    // TODO: Implement this method
    return null;
  }

  /**
   *
   * @param parsePoint
   */
  private parseSymbol(parsePoint: ParsePoint): ExpressionNode | null {
    // TODO: Implement this method
    return null;
  }

  /**
   *
   * @param parsePoint
   */
  private parseUnaryExpression(parsePoint: ParsePoint): UnaryExpression | null {
    // TODO: Implement this method
    return null;
  }

  /**
   * parExpr
   *   : "[" expr "]"
   *   ;
   */
  private parseParExpr(): ExpressionNode | null {
    if (this.skipToken(TokenType.LPar)) {
      const expr = this.parseExpr();
      if (!expr) {
        return null;
      }
      this.expectToken(TokenType.RPar);
      return expr;
    }
    return null;
  }

  /**
   * brackExpr
   *   : "(" expr ")"
   *   ;
   */
  private parseBrackExpr(): ExpressionNode | null {
    if (this.skipToken(TokenType.LSBrac)) {
      const expr = this.parseExpr();
      if (!expr) {
        return null;
      }
      this.expectToken(TokenType.RSBrac);
      return expr;
    }
    return null;
  }

  /**
   * condExpr
   *   : orExpr ( "?" expr ":" expr )?
   *   ;
   * @param parsePoint
   */
  private parseCondExpr(): ExpressionNode | null {
    // --- Obtain the condition
    const condExpr = this.parseOrExpr();
    if (!condExpr) {
      return null;
    }

    const { start } = this.getParsePoint();
    if (!this.skipToken(TokenType.QuestionMark)) {
      // --- This is not a conditional expression
      return condExpr;
    }

    const trueExpr = this.parseExpr();
    if (!trueExpr) {
      this.reportError("Z1003");
      return null;
    }
    this.expectToken(TokenType.Colon);
    const falseExpr = this.parseExpr();
    if (!falseExpr) {
      this.reportError("Z1003");
      return null;
    }
    return <ConditionalExpression>{
      type: "ConditionalExpression",
      condition: condExpr,
      consequent: trueExpr,
      alternate: falseExpr,
    };
  }

  /**
   * orExpr
   *   : xorExpr ( "|" xorExpr )?
   */
  private parseOrExpr(): ExpressionNode | null {
    let leftExpr = this.parseXorExpr();
    if (!leftExpr) {
      return null;
    }

    // --- Build binary expressions from left to right
    while (this.skipToken(TokenType.VerticalBar)) {
      const rightExpr = this.parseXorExpr();
      if (!rightExpr) {
        this.reportError("Z1003");
        return null;
      }
      leftExpr = <BinaryExpression>{
        type: "BinaryExpression",
        operator: "|",
        left: leftExpr,
        right: rightExpr,
      };
    }
    return leftExpr;
  }

  /**
   * xorExpr
   *   : andExpr ( "^" andExpr )?
   */
  private parseXorExpr(): ExpressionNode | null {
    let leftExpr = this.parseAndExpr();
    if (!leftExpr) {
      return null;
    }

    // --- Build binary expressions from left to right
    while (this.skipToken(TokenType.UpArrow)) {
      const rightExpr = this.parseAndExpr();
      if (!rightExpr) {
        this.reportError("Z1003");
        return null;
      }
      leftExpr = <BinaryExpression>{
        type: "BinaryExpression",
        operator: "^",
        left: leftExpr,
        right: rightExpr,
      };
    }
    return leftExpr;
  }

  /**
   * andExpr
   *   : equExpr ( "&" equExpr )?
   */
  private parseAndExpr(): ExpressionNode | null {
    let leftExpr = this.parseEquExpr();
    if (!leftExpr) {
      return null;
    }

    // --- Build binary expressions from left to right
    while (this.skipToken(TokenType.Ampersand)) {
      const rightExpr = this.parseEquExpr();
      if (!rightExpr) {
        this.reportError("Z1003");
        return null;
      }
      leftExpr = <BinaryExpression>{
        type: "BinaryExpression",
        operator: "&",
        left: leftExpr,
        right: rightExpr,
      };
    }
    return leftExpr;
  }

  /**
   * equExpr
   *   : relExpr ( ( "==" | "===" | "!=" | "!==" ) relExpr )?
   */
  private parseEquExpr(): ExpressionNode | null {
    let leftExpr = this.parseRelExpr();
    if (!leftExpr) {
      return null;
    }

    // --- Build binary expressions from left to right
    let opType: Token | null;
    while (
      (opType = this.skipTokens(
        TokenType.Equal,
        TokenType.CiEqual,
        TokenType.NotEqual,
        TokenType.CiNotEqual
      ))
    ) {
      const rightExpr = this.parseRelExpr();
      if (!rightExpr) {
        this.reportError("Z1003");
        return null;
      }
      leftExpr = <BinaryExpression>{
        type: "BinaryExpression",
        operator: opType.text,
        left: leftExpr,
        right: rightExpr,
      };
    }
    return leftExpr;
  }

  /**
   * relExpr
   *   : shiftExpr ( ( "<" | "<=" | ">" | ">=" ) shiftExpr )?
   */
  private parseRelExpr(): ExpressionNode | null {
    let leftExpr = this.parseShiftExpr();
    if (!leftExpr) {
      return null;
    }

    // --- Build binary expressions from left to right
    let opType: Token | null;
    while (
      (opType = this.skipTokens(
        TokenType.LessThan,
        TokenType.LessThanOrEqual,
        TokenType.GreaterThan,
        TokenType.GreaterThanOrEqual
      ))
    ) {
      const rightExpr = this.parseShiftExpr();
      if (!rightExpr) {
        this.reportError("Z1003");
        return null;
      }
      leftExpr = <BinaryExpression>{
        type: "BinaryExpression",
        operator: opType.text,
        left: leftExpr,
        right: rightExpr,
      };
    }
    return leftExpr;
  }

  /**
   * shiftExpr
   *   : addExpr ( ( "<<" | ">>" ) addExpr )?
   */
  private parseShiftExpr(): ExpressionNode | null {
    let leftExpr = this.parseAddExpr();
    if (!leftExpr) {
      return null;
    }

    // --- Build binary expressions from left to right
    let opType: Token | null;
    while (
      (opType = this.skipTokens(TokenType.LeftShift, TokenType.RightShift))
    ) {
      const rightExpr = this.parseAddExpr();
      if (!rightExpr) {
        this.reportError("Z1003");
        return null;
      }
      leftExpr = <BinaryExpression>{
        type: "BinaryExpression",
        operator: opType.text,
        left: leftExpr,
        right: rightExpr,
      };
    }
    return leftExpr;
  }

  /**
   * addExpr
   *   : multExpr ( ( "+" | "-" ) multExpr )?
   */
  private parseAddExpr(): ExpressionNode | null {
    let leftExpr = this.parseMultExpr();
    if (!leftExpr) {
      return null;
    }

    // --- Build binary expressions from left to right
    let opType: Token | null;
    while ((opType = this.skipTokens(TokenType.Plus, TokenType.Minus))) {
      const rightExpr = this.parseMultExpr();
      if (!rightExpr) {
        this.reportError("Z1003");
        return null;
      }
      leftExpr = <BinaryExpression>{
        type: "BinaryExpression",
        operator: opType.text,
        left: leftExpr,
        right: rightExpr,
      };
    }
    return leftExpr;
  }

  /**
   * multExpr
   *   : minMaxExpr ( ( "*" | "/" | "%") minMaxExpr )?
   */
  private parseMultExpr(): ExpressionNode | null {
    let leftExpr = this.parseMinMaxExpr();
    if (!leftExpr) {
      return null;
    }

    // --- Build binary expressions from left to right
    let opType: Token | null;
    while (
      (opType = this.skipTokens(
        TokenType.Multiplication,
        TokenType.Divide,
        TokenType.Modulo
      ))
    ) {
      const rightExpr = this.parseMinMaxExpr();
      if (!rightExpr) {
        this.reportError("Z1003");
        return null;
      }
      leftExpr = <BinaryExpression>{
        type: "BinaryExpression",
        operator: opType.text,
        left: leftExpr,
        right: rightExpr,
      };
    }
    return leftExpr;
  }

  /**
   * minMaxExpr
   *   : primaryExpr ( ( "<?" | ">?") primaryExpr )?
   */
  private parseMinMaxExpr(): ExpressionNode | null {
    let leftExpr = this.parsePrimaryExpr();
    if (!leftExpr) {
      return null;
    }

    // --- Build binary expressions from left to right
    let opType: Token | null;
    while ((opType = this.skipTokens(TokenType.MinOp, TokenType.MaxOp))) {
      const rightExpr = this.parsePrimaryExpr();
      if (!rightExpr) {
        this.reportError("Z1003");
        return null;
      }
      leftExpr = <BinaryExpression>{
        type: "BinaryExpression",
        operator: opType.text,
        left: leftExpr,
        right: rightExpr,
      };
    }
    return leftExpr;
  }

  /**
   *
   * @param parsePoint
   */
  private parsePrimaryExpr(): ExpressionNode | null {
    const { start } = this.getParsePoint();

    // TODO: Extend this simplified implementation
    if (start.type === TokenType.Identifier) {
      this.tokens.get();
      return <Symbol>{
        type: "Symbol",
        startsFromGlobal: false,
        identifier: start.text,
      };
    }
    return null;
  }

  /**
   *
   * @param parsePoint
   */
  private parseLiteral(parsePoint: ParsePoint): ExpressionNode | null {
    // TODO: Implement this method
    return null;
  }

  /**
   *
   * @param parsePoint
   */
  private parseBinaryExpression(
    leftExpr: ExpressionNode,
    parsePoint: ParsePoint
  ): ExpressionNode | null {
    // TODO: Implement this method
    return null;
  }

  // ==========================================================================
  // Helper methods for parsing

  /**
   * Gets the current parse point
   */
  private getParsePoint(): ParsePoint {
    const start = this.tokens.peek();
    const traits = getTokenTraits(start.type);
    return { start, traits };
  }

  /**
   * Tests the type of the next token
   * @param type Expected token type
   */
  private expectToken(type: TokenType, allowEof?: boolean) {
    const next = this.tokens.peek();
    if (next.type === type || (allowEof && next.type === TokenType.Eof)) {
      // --- Skip the expected token
      this.tokens.get();
      return;
    }

    this.reportError("Z1001", next, [next.text]);
  }

  /**
   * Skips the next token if the type is the specified one
   * @param type Token type to check
   */
  private skipToken(type: TokenType): Token | null {
    const next = this.tokens.peek();
    if (next.type === type) {
      this.tokens.get();
      return next;
    }
    return null;
  }

  /**
   * Skips the next token if the type is the specified one
   * @param type Token type to check
   */
  private skipTokens(...types: TokenType[]): Token | null {
    const next = this.tokens.peek();
    for (const type of types) {
      if (next.type === type) {
        this.tokens.get();
        return next;
      }
    }
    return null;
  }

  /**
   *
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
          (errorText = replace(
            errorText,
            `{{${idx}}}`,
            options[idx].toString()
          ))
      );
    }
    if (!token) {
      token = this.getParsePoint().start;
    }
    this._parseErrors.push({
      code: errorCode,
      text: errorText,
      line: token.location.line,
      column: token.location.startColumn,
      position: token.location.startPos,
    });
    throw new ParserError(errorText, errorCode);

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

  /**
   * Tests if the specified token can be the start of a label
   * @param token Token to test
   */
  private startsLabel(token: Token): boolean {
    return token.type === TokenType.Identifier;
  }

  /**
   * Tests if the specified token can be the start of a line's body
   * @param token Token to test
   */
  private startsLineBody(token: Token): boolean {
    const traits = getTokenTraits(token.type);
    if (
      traits.instruction ||
      traits.pragma ||
      traits.statement ||
      token.type === TokenType.GoesTo ||
      token.type === TokenType.LDBrac
    ) {
      return true;
    }

    return false;
  }
}

/**
 * This interface represents the parsing point that can be passed to parsing methods
 */
interface ParsePoint {
  /**
   * Start token at that point
   */
  start: Token;

  /**
   * Traist of the start token
   */
  traits: TokenTraits;
}
