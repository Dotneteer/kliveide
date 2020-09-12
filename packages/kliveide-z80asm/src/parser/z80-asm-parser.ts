import { TokenStream, Token, TokenType } from "./token-stream";
import {
  Program,
  Z80AssemblyLine,
  PartialZ80AssemblyLine,
  LabelOnlyLine,
  SimpleZ80Instruction,
  ExpressionNode,
  UnaryExpression,
  Symbol,
  ConditionalExpression,
  BinaryExpression,
  IntegerLiteral,
  BooleanLiteral,
  CurrentAddressLiteral,
  CurrentCounterLiteral,
  RealLiteral,
  StringLiteral,
  CharLiteral,
  EndIfDirective,
  ElseDirective,
  IfDefDirective,
  Directive,
  IfNDefDirective,
  DefineDirective,
  UndefDirective,
} from "./tree-nodes";
import { ErrorMessage, errorMessages, ErrorCodes } from "../errors";
import { ParserError } from "./parse-errors";
import { getTokenTraits, TokenTraits } from "./token-traits";

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
    return <Program>{
      type: "Program",
      assemblyLines,
    };
  }

  // ==========================================================================
  // Rule parsers

  // --------------------------------------------------------------------------
  // Assembly line parsing
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
      asmLine = this.parseDirective(parsePoint);
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
   * label
   *   : Identifier ":"?
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
      this.skipToken(TokenType.Colon);
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
   * simpleInstruction
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

  /**
   *
   * @param parsePoint
   */
  private parseCompoundInstruction(
    parsePoint: ParsePoint
  ): PartialZ80AssemblyLine | null {
    // TODO: Implement this method
    return null;
  }

  /**
   *
   * @param parsePoint
   */
  private parseDirective(
    parsePoint: ParsePoint
  ): PartialZ80AssemblyLine | null {
    const { start } = parsePoint;
    const parser = this;
    switch (start.type) {
      case TokenType.IfDefDir:
        return createDirectiveWithId<IfDefDirective>("IfDefDirective");
      case TokenType.IfNDefDir:
        return createDirectiveWithId<IfNDefDirective>("IfNDefDirective");
      case TokenType.DefineDir:
        return createDirectiveWithId<DefineDirective>("DefineDirective");
      case TokenType.UndefDir:
        return createDirectiveWithId<UndefDirective>("UndefDirective");
      case TokenType.IfModDir:
        // TODO
        break;
      case TokenType.IfNModDir:
        // TODO
        break;
      case TokenType.EndIfDir:
        this.tokens.get();
        return <EndIfDirective>{
          type: "EndIfDirective",
        };
      case TokenType.ElseDir:
        this.tokens.get();
        return <ElseDirective>{
          type: "ElseDirective",
        };
      case TokenType.IfDir:
        // TODO
        break;
      case TokenType.IncludeDir:
        // TODO
        break;
      case TokenType.LineDir:
        // TODO
        break;
    }
    return null;

    function createDirectiveWithId<T extends Directive>(
      type: Directive["type"]
    ): PartialZ80AssemblyLine | null {
      parser.tokens.get();
      const identifier = parser.getIdentifier();
      if (identifier) {
        return <T>{
          type,
          identifier,
        };
      }
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Expression parsing

  /**
   * expr
   *   : parExpr
   *   | brackExpr
   *   | conditionalExpr
   *   ;
   */
  parseExpr(): ExpressionNode | null {
    const parsePoint = this.getParsePoint();
    const { start, traits } = parsePoint;
    if (start.type === TokenType.LPar) {
      return this.parseParExpr();
    }
    if (start.type === TokenType.LSBrac) {
      return this.parseBrackExpr();
    }
    if (traits.expressionStart) {
      return this.parseCondExpr();
    }
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
   *   : Identifier "(" macroArgument ("," macroArgument)* ")"
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
   *   : "->" byteEmPragma
   *   ;
   */
  private parseFieldAssignment(
    parsePoint: ParsePoint
  ): PartialZ80AssemblyLine | null {
    // TODO: Implement this method
    return null;
  }

  /**
   * parExpr
   *   : "(" expr ")"
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
   *   : "[" expr "]"
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
    const condExpr = this.parseOrExpr();
    if (!condExpr) {
      return null;
    }

    if (!this.skipToken(TokenType.QuestionMark)) {
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
   * primaryExpr
   *   : builtInFuncInvocation
   *   | funcInvocation
   *   | literal
   *   | symbol
   *   | unaryExpression
   *   | macroParam
   */
  private parsePrimaryExpr(): ExpressionNode | null {
    const parsePoint = this.getParsePoint();
    const { start, traits } = parsePoint;

    if (start.type === TokenType.Multiplication) {
      // --- Special case, it might be the "*" operator or the current address
      const ahead = this.tokens.ahead(1);
      const atraits = getTokenTraits(ahead.type);
      if (ahead.type === TokenType.Eof || !atraits.expressionStart) {
        this.tokens.get();
        return <CurrentAddressLiteral>{
          type: "CurrentAddressLiteral",
        };
      }
    }
    if (traits.builtInFunction) {
      return this.parseBuiltInFuncInvocation(parsePoint);
    }
    if (traits.literal) {
      return this.parseLiteral(parsePoint);
    }
    switch (start.type) {
      case TokenType.Identifier:
        const lpar = this.tokens.ahead(1);
        return lpar.type === TokenType.LPar
          ? this.parseFuncInvocation(parsePoint)
          : this.parseSymbol(parsePoint);
      case TokenType.DoubleColon:
        return this.parseSymbol(parsePoint);
      case TokenType.Plus:
      case TokenType.Minus:
      case TokenType.BinaryNot:
      case TokenType.Exclamation:
        return this.parseUnaryExpr(parsePoint);
      case TokenType.LDBrac:
        return this.parseMacroParam(parsePoint);
    }
    return null;
  }

  /**
   *
   * @param parsePoint
   */
  private parseBuiltInFuncInvocation(
    parsePoint: ParsePoint
  ): ExpressionNode | null {
    // TODO: Implement this method
    return null;
  }

  /**
   *
   * @param parsePoint
   */
  private parseFuncInvocation(parsePoint: ParsePoint): ExpressionNode | null {
    // TODO: Implement this method
    return null;
  }

  /**
   * symbol
   *   : "::"? Identifier
   *   ;
   */
  private parseSymbol(parsePoint: ParsePoint): ExpressionNode | null {
    let startsFromGlobal = false;
    if (this.skipToken(TokenType.DoubleColon)) {
      startsFromGlobal = true;
      parsePoint = this.getParsePoint();
    }
    if (parsePoint.start.type === TokenType.Identifier) {
      this.tokens.get();
      return <Symbol>{
        type: "Symbol",
        startsFromGlobal,
        identifier: parsePoint.start.text,
      };
    }
    this.reportError("Z1004");
    return null;
  }

  /**
   * unaryExpr
   *   : ( "+" | "-" | "~" | "!" ) expr
   *   ;
   */
  private parseUnaryExpr(parsePoint: ParsePoint): UnaryExpression | null {
    // --- Obtain and skip the operator token
    const operator = parsePoint.start.text;
    this.tokens.get();

    const operand = this.parseExpr();
    if (operand) {
      return <UnaryExpression>{
        type: "UnaryExpression",
        operator,
        operand,
      };
    }
    this.reportError("Z1003");
    return null;
  }

  /**
   * literal
   *   : binaryLiteral
   *   | octalLiteral
   *   | decimalLiteral
   *   | hexadecimalLiteral
   *   | realLiteral
   *   | charLiteral
   *   | stringLiteral
   *   | booleanLiteral
   *   ;
   */
  private parseLiteral(parsePoint: ParsePoint): ExpressionNode | null {
    const { start } = parsePoint;
    switch (start.type) {
      case TokenType.BinaryLiteral:
        return this.parseBinaryLiteral(start.text);
      case TokenType.OctalLiteral:
        return this.parseOctalLiteral(start.text);
      case TokenType.DecimalLiteral:
        return this.parseDecimalLiteral(start.text);
      case TokenType.HexadecimalLiteral:
        return this.parseHexadecimalLiteral(start.text);
      case TokenType.RealLiteral:
        return this.parseRealLiteral(start.text);
      case TokenType.CharLiteral:
        return this.parseCharLiteral(start.text);
      case TokenType.StringLiteral:
        return this.parseStringLiteral(start.text);
      case TokenType.True:
        return <BooleanLiteral>{
          type: "BooleanLiteral",
          value: true,
        };
      case TokenType.False:
        return <BooleanLiteral>{
          type: "BooleanLiteral",
          value: false,
        };
      case TokenType.CurAddress:
      case TokenType.Dot:
      case TokenType.Multiplication:
        return <CurrentAddressLiteral>{
          type: "CurrentAddressLiteral",
        };
      case TokenType.CurCnt:
        return <CurrentCounterLiteral>{
          type: "CurrentCounterLiteral",
        };
    }
    return null;
  }

  /**
   * BinaryLiteral
   *   : "%" ("_" | "0" | "1")+
   * @param text
   */
  private parseBinaryLiteral(text: string): IntegerLiteral | null {
    if (text.startsWith("%")) {
      text = text.substr(1);
    } else if (text.startsWith("0b")) {
      text = text.substr(2);
    }
    while (text.includes("_")) {
      text = text.replace("_", "");
    }
    const value = parseInt(text, 2);
    if (!isNaN(value)) {
      return <IntegerLiteral>{
        type: "IntegerLiteral",
        value,
      };
    }
    this.reportError("Z1005");
    return null;
  }

  /**
   * OctalLiteral
   *   : ("0".."7")+ ("q" | "Q" | "o" | "O")
   */
  private parseOctalLiteral(text: string): IntegerLiteral | null {
    text = text.substr(0, text.length - 1);
    const value = parseInt(text, 8);
    if (!isNaN(value)) {
      return <IntegerLiteral>{
        type: "IntegerLiteral",
        value,
      };
    }
    this.reportError("Z1005");
    return null;
  }

  /**
   * decimalLiteral
   *   : ("0".."9")+
   * @param text
   */
  private parseDecimalLiteral(text: string): IntegerLiteral | null {
    const value = parseInt(text, 10);
    if (!isNaN(value)) {
      return <IntegerLiteral>{
        type: "IntegerLiteral",
        value,
      };
    }
    this.reportError("Z1005");
    return null;
  }

  /**
   * hexadecimalLiteral
   *   : ("#" | "$" | "0x") ("0".."9" | "a".."f" | "A".."F") {1-4}
   *   | ("0".."9") ("0".."9" | "a".."f" | "A".."F") {1-4} ("h" | "H")
   * @param text
   */
  private parseHexadecimalLiteral(text: string): IntegerLiteral | null {
    if (text.startsWith("#") || text.startsWith("$")) {
      text = text.substring(1);
    } else if (text.endsWith("h") || text.endsWith("H")) {
      text = text.substr(0, text.length - 1);
    }
    const value = parseInt(text, 16);
    if (!isNaN(value)) {
      return <IntegerLiteral>{
        type: "IntegerLiteral",
        value,
      };
    }
    this.reportError("Z1005");
    return null;
  }

  /**
   * realLiteral
   *   : ("0".."9")* "." ("0".."9")+ (("e" | "E") ("+" | "-")? ("0".."9")+)?
   *   | ("0".."9")+ (("e" | "E") ("+" | "-")? ("0".."9")+)
   *   ;
   */
  private parseRealLiteral(text: string): RealLiteral | null {
    const value = parseFloat(text);
    if (!isNaN(value)) {
      return <RealLiteral>{
        type: "RealLiteral",
        value,
      };
    }
    this.reportError("Z1005");
    return null;
  }

  /**
   * Parses a character literal
   *
   */
  private parseCharLiteral(text: string): CharLiteral | null {
    text = text.substr(1, text.length - 2);
    return <CharLiteral>{
      type: "CharLiteral",
      value: this.convertSpectrumString(text),
    };
  }

  private parseStringLiteral(text: string): StringLiteral | null {
    text = text.substr(1, text.length - 2);
    return <StringLiteral>{
      type: "StringLiteral",
      value: this.convertSpectrumString(text),
    };
  }

  /**
   * Converts a ZX Spectrum string to intrinsic string
   * @param input ZX Spectrum string to convert
   */
  private convertSpectrumString(input: string): string {
    let result = "";
    let state: StrParseState = StrParseState.Normal;
    let collect = 0;
    for (const ch of input) {
      switch (state) {
        case StrParseState.Normal:
          if (ch == "\\") {
            state = StrParseState.Backslash;
          } else {
            result += ch;
          }
          break;

        case StrParseState.Backslash:
          state = StrParseState.Normal;
          switch (ch) {
            case "i": // INK
              result += String.fromCharCode(0x10);
              break;
            case "p": // PAPER
              result += String.fromCharCode(0x11);
              break;
            case "f": // FLASH
              result += String.fromCharCode(0x12);
              break;
            case "b": // BRIGHT
              result += String.fromCharCode(0x13);
              break;
            case "I": // INVERSE
              result += String.fromCharCode(0x14);
              break;
            case "o": // OVER
              result += String.fromCharCode(0x15);
              break;
            case "a": // AT
              result += String.fromCharCode(0x16);
              break;
            case "t": // TAB
              result += String.fromCharCode(0x17);
              break;
            case "P": // Pound sign
              result += String.fromCharCode(0x60);
              break;
            case "C": // Copyright sign
              result += String.fromCharCode(0x7f);
              break;
            case "0":
              result += String.fromCharCode(0x00);
              break;
            case "x":
              state = StrParseState.X;
              break;
            default:
              result += ch;
              break;
          }
          break;

        case StrParseState.X:
          if (
            (ch >= "0" && ch <= "9") ||
            (ch >= "a" && ch <= "f") ||
            (ch >= "A" && ch <= "F")
          ) {
            collect = parseInt(ch, 16);
            state = StrParseState.Xh;
          } else {
            result += "x";
            state = StrParseState.Normal;
          }
          break;

        case StrParseState.Xh:
          if (
            (ch >= "0" && ch <= "9") ||
            (ch >= "a" && ch <= "f") ||
            (ch >= "A" && ch <= "F")
          ) {
            collect = collect * 0x10 + parseInt(ch, 16);
            result += String.fromCharCode(collect);
            state = StrParseState.Normal;
          } else {
            result += String.fromCharCode(collect);
            result += ch;
            state = StrParseState.Normal;
          }
          break;
      }
    }

    // --- Handle the final machine state
    switch (state) {
      case StrParseState.Backslash:
        result += "\\";
        break;
      case StrParseState.X:
        result += "x";
        break;
      case StrParseState.Xh:
        result += String.fromCharCode(collect);
        break;
    }
    return result;
  }

  // --------------------------------------------------------------------------
  // Miscellaneous

  /**
   * macroParam
   *   : "{{" Identifier "}}"
   *   ;
   */
  private parseMacroParam(parsePoint: ParsePoint): ExpressionNode | null {
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

  /**
   * Gets an identifier
   */
  private getIdentifier(): string | null {
    const idToken = this.tokens.get();
    if (idToken.type === TokenType.Identifier) {
      return idToken.text;
    }
    this.reportError("Z1004");
    return null;
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

/**
 * States of the string parsing
 */
enum StrParseState {
  Normal,
  Backslash,
  X,
  Xh,
}
