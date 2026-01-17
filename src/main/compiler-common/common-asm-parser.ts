import { ParserError } from "./parse-errors";
import { ParserErrorMessage, TypedObject } from "../compiler-common/abstractions";
import { CommonTokens, CommonTokenType, TokenTraits } from "@main/compiler-common/common-tokens";
import {
  AlignPragma,
  AssemblyLine,
  BankPragma,
  BinaryExpression,
  BreakStatement,
  CompareBinPragma,
  ConditionalExpression,
  ContinueStatement,
  CurrentAddressLiteral,
  DefBPragma,
  DefCPragma,
  DefGPragma,
  DefGxPragma,
  DefHPragma,
  DefineDirective,
  DefMPragma,
  DefNPragma,
  DefSPragma,
  DefWPragma,
  Directive,
  DispPragma,
  ElseDirective,
  ElseIfStatement,
  ElseStatement,
  EndIfDirective,
  EndIfStatement,
  EntPragma,
  EquPragma,
  ErrorPragma,
  Expression,
  ExpressionNode,
  ExternPragma,
  FieldAssignment,
  FillbPragma,
  FillwPragma,
  ForStatement,
  FunctionInvocation,
  IdentifierNode,
  IfDefDirective,
  IfDirective,
  IfModDirective,
  IfNDefDirective,
  IfNModDirective,
  IfNUsedStatement,
  IfStatement,
  IfUsedStatement,
  IncBinPragma,
  IncludeDirective,
  InjectOptPragma,
  LabelOnlyLine,
  LineDirective,
  LoopEndStatement,
  LoopStatement,
  MacroEndStatement,
  MacroOrStructInvocation,
  MacroParameter,
  MacroStatement,
  MacroTimeFunctionInvocation,
  ModelPragma,
  ModuleEndStatement,
  ModuleStatement,
  NextStatement,
  OnSuccessPragma,
  Operand,
  OperandType,
  OrgPragma,
  PartialAssemblyLine,
  ProcEndStatement,
  ProcStatement,
  Program,
  RepeatStatement,
  RndSeedPragma,
  SkipPragma,
  StringLiteral,
  StructEndStatement,
  StructStatement,
  Token,
  TracePragma,
  UndefDirective,
  UntilStatement,
  VarPragma,
  WhileEndStatement,
  WhileStatement,
  XentPragma,
  XorgPragma,
  Symbol,
  UnaryExpression,
  BooleanLiteral,
  CurrentCounterLiteral,
  IntegerLiteral,
  RealLiteral
} from "@main/compiler-common/tree-nodes";
import { ErrorCodes, errorMessages } from "./assembler-errors";
import { CommonTokenStream } from "./common-token-stream";

/**
 * Size of an assembly batch. After this batch, the assembler lets the
 * JavaScript event loop process messages
 */
const PARSER_BATCH_SIZE = 1000;

/**
 * This class implements the Z80 assembly parser
 */
export abstract class CommonAsmParser<
  TInstruction extends TypedObject,
  TToken extends CommonTokenType
> {
  private readonly _parseErrors: ParserErrorMessage<ErrorCodes>[] = [];
  private readonly _macroParamsCollected: MacroParameter<TInstruction>[] = [];

  // --- Counter for async batches
  private _batchCounter = 0;

  /**
   * Initializes the parser with the specified token stream
   * @param tokens Token stream of the source code
   * @param fileIndex Optional file index of the file being parsed
   */
  constructor(
    public readonly tokens: CommonTokenStream<TToken>,
    private readonly fileIndex = 0,
    private readonly macroEmitPhase = false
  ) {}

  /**
   * Gets the token traits for the specified token type
   * @param type Token type to get the traits for
   */
  protected abstract getTokenTraits(type: CommonTokenType): TokenTraits;

  /**
   * instruction
   *   : simpleInstruction
   *   | compoundInstruction
   *   ;
   */
  protected abstract parseInstruction(
    parsePoint: ParsePoint
  ): PartialAssemblyLine<TInstruction> | null;

  /**
   * Parses an operand
   */
  protected abstract parseOperand(): Operand<TInstruction, TToken> | null;

  /**
   * Converts an escaped string to its unescaped form
   * @param inp String to convert
   */
  protected abstract convertEscapedString(inp: string): string;

  /**
   * The errors raised during the parse phase
   */
  get errors(): ParserErrorMessage<ErrorCodes>[] {
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
    let token: Token<CommonTokenType>;
    do {
      token = this.tokens.get();
      if (token.type === CommonTokens.NewLine) {
        return;
      }
    } while (token.type !== CommonTokens.Eof);
  }

  /**
   * Allows events to be processed from the JavaScript message queue
   */
  private async allowEvents(): Promise<void> {
    if (this._batchCounter++ % PARSER_BATCH_SIZE === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  /**
   * program
   *   : (assemblyLine? NewLine*)* EOF
   *   ;
   */
  async parseProgram(): Promise<Program<TInstruction> | null> {
    let token: Token<CommonTokenType> = this.tokens.peek(true);
    const assemblyLines: PartialAssemblyLine<TInstruction>[] = [];
    this.tokens.resetComment();
    while ((token = this.tokens.peek(true)).type !== CommonTokens.Eof) {
      // --- We skip empty lines
      if (token.type === CommonTokens.EolComment || token.type === CommonTokens.NewLine) {
        const endToken = this.tokens.get(true);
        if (this.tokens.lastComment) {
          assemblyLines.push(<AssemblyLine<TInstruction>>{
            type: "CommentOnlyLine",
            line: token.location.startLine,
            startPosition: endToken.location.startPosition,
            startColumn: endToken.location.startColumn,
            endPosition: endToken.location.endPosition,
            endColumn: endToken.location.endColumn,
            comment: this.tokens.lastComment
          });
        }
        this.tokens.resetComment();
        continue;
      }

      // --- Skipe white spaces at the beginning of the line
      if (token.type < 0) {
        this.tokens.get(true);
        continue;
      }

      // --- Parse the subsequent line
      try {
        await this.allowEvents();
        const parsedLine = this.parseAssemblyLine();
        if (parsedLine) {
          assemblyLines.push(parsedLine);
          this.expectToken(CommonTokens.NewLine, null, true);
        }
      } catch (err) {
        // --- We recover from all reported parser errors here
        if (err instanceof ParserError) {
          this.recoverFromParseError();
        } else {
          throw err;
        }
      }

      this.tokens.resetComment();
    }

    // --- Done
    return {
      type: "Program",
      assemblyLines
    } as Program<TInstruction>;
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
  parseAssemblyLine(): PartialAssemblyLine<TInstruction> | null {
    const parsePoint = this.getParsePoint();
    let { start } = parsePoint;
    let asmLine: PartialAssemblyLine<TInstruction> | null = null;
    let label: IdentifierNode<TInstruction> | null = null;

    // --- Does the line start with a label?
    if (start.type === CommonTokens.Identifier) {
      const ahead = this.tokens.ahead(1);
      if (
        !keywordLikeIDs[start.text] ||
        ahead.type === CommonTokens.Colon ||
        this.startsLineBody(ahead)
      ) {
        label = this.parseLabel(parsePoint);
      }
    }

    const mainToken = this.tokens.peek();
    if (mainToken.type === CommonTokens.NewLine || mainToken.type === CommonTokens.Eof) {
      asmLine = {
        type: "LabelOnlyLine",
        label
      } as LabelOnlyLine<TInstruction>;
    } else {
      // --- Is the token the start of line body?
      if (this.startsLineBody(mainToken) || mainToken.type === CommonTokens.Identifier) {
        this._macroParamsCollected.length = 0;
        asmLine = this.parseLineBody(this.getParsePoint());
        if (asmLine) {
          asmLine.label = label;
          if (this._macroParamsCollected.length > 0) {
            asmLine.macroParams = this._macroParamsCollected.slice(0);
          }
        }
      } else {
        // --- So, it must be a directive
        asmLine = this.parseDirective(parsePoint);
      }
    }

    if (!asmLine) {
      // --- Unsuccessful parsing
      this.reportError("Z0002", mainToken, [mainToken.text]);
    }

    // --- Complete the line with position information
    const nextToken = this.tokens.peek();
    const resultLine: AssemblyLine<TInstruction> = Object.assign({}, asmLine, {
      fileIndex: this.fileIndex,
      line: start.location.startLine,
      startPosition: start.location.startPosition,
      startColumn: start.location.startColumn,
      endPosition: nextToken.location.startPosition,
      endColumn: nextToken.location.startColumn,
      comment: this.tokens.lastComment
    });
    return resultLine;
  }

  /**
   * label
   *   : Identifier ":"?
   *   ;
   */
  private parseLabel(parsePoint: ParsePoint): IdentifierNode<TInstruction> | null {
    const { start } = parsePoint;
    if (start.type === CommonTokens.Identifier) {
      const nextToken = this.tokens.ahead(1);
      if (nextToken.type === CommonTokens.LPar) {
        // --- Identifier LPar <-- Beginning of a macro or function invocation
        return null;
      }

      // --- The token is an identifier
      // --- Skip the identifier and the optional colon
      const identifier = this.getIdentifier();
      this.skipToken(CommonTokens.Colon);
      return identifier;
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
  private parseLineBody(parsePoint: ParsePoint): PartialAssemblyLine<TInstruction> | null {
    const { start, traits } = parsePoint;
    if (start.type === CommonTokens.NewLine || start.type === CommonTokens.Eof) {
      return null;
    }
    if (traits.pragma) {
      return this.parsePragma(parsePoint);
    }
    if (traits.instruction) {
      return this.parseInstruction(parsePoint);
    }
    if (start.type === CommonTokens.LDBrac) {
      return this.parseMacroParam();
    }
    if (traits.statement) {
      return this.parseStatement(parsePoint);
    }
    if (start.type === CommonTokens.Identifier) {
      const text = start.text.toLowerCase();
      if (text === "loop") {
        this.tokens.get();
        return this.parseLoopStatement();
      }
      if (text === "endl" || text === "lend") {
        this.tokens.get();
        return {
          type: "LoopEndStatement"
        } as LoopEndStatement<TInstruction>;
      }
      if (text === "while") {
        this.tokens.get();
        return this.parseWhileStatement();
      }
      if (text === "endw" || text === "wend") {
        this.tokens.get();
        return {
          type: "WhileEndStatement"
        } as WhileEndStatement<TInstruction>;
      }
      if (text === "repeat") {
        this.tokens.get();
        return {
          type: "RepeatStatement",
          isBlock: true
        } as RepeatStatement<TInstruction>;
      }
      if (text === "until") {
        this.tokens.get();
        return this.parseUntilStatement();
      }
      if (text === "proc") {
        this.tokens.get();
        return {
          type: "ProcStatement",
          isBlock: true
        } as ProcStatement<TInstruction>;
      }
      if (text === "endp" || text === "pend") {
        this.tokens.get();
        return {
          type: "ProcEndStatement"
        } as ProcEndStatement<TInstruction>;
      }
      if (text === "endm" || text === "mend") {
        this.tokens.get();
        return {
          type: "MacroEndStatement"
        } as MacroEndStatement<TInstruction>;
      }
      if (text === "else") {
        this.tokens.get();
        return {
          type: "ElseStatement"
        } as ElseStatement<TInstruction>;
      }
      if (text === "elif") {
        this.tokens.get();
        return this.parseElseIfStatement();
      }
      if (text === "endif") {
        this.tokens.get();
        return {
          type: "EndIfStatement"
        } as EndIfStatement<TInstruction>;
      }
      if (text === "break") {
        this.tokens.get();
        return {
          type: "BreakStatement"
        } as BreakStatement<TInstruction>;
      }
      if (text === "continue") {
        this.tokens.get();
        return {
          type: "ContinueStatement"
        } as ContinueStatement<TInstruction>;
      }
      if (text === "ends") {
        this.tokens.get();
        return {
          type: "StructEndStatement"
        } as StructEndStatement<TInstruction>;
      }
      if (text === "next") {
        this.tokens.get();
        return {
          type: "NextStatement"
        } as NextStatement<TInstruction>;
      }
      return this.parseMacroOrStructInvocation();
    }
    if (start.type === CommonTokens.GoesTo) {
      return this.parseFieldAssignment();
    }
    this.reportError("Z0002", start, [start.text]);
    return null;
  }

  /**
   * pragma
   *   : orgPragma
   *   | bankPragma
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
   *   | zxBasicPragma
   *   | injectOptPragma
   *   ;
   */
  private parsePragma(parsePoint: ParsePoint): PartialAssemblyLine<TInstruction> | null {
    const { start } = parsePoint;

    // --- Skip the pragma token
    this.tokens.get();
    switch (start.type) {
      case CommonTokens.OrgPragma:
        const orgExpr = this.getExpression();
        return {
          type: "OrgPragma",
          address: orgExpr
        } as OrgPragma<TInstruction, TToken>;
      case CommonTokens.BankPragma:
        const bankExpr = this.getExpression();
        const bankOffsExpr = this.getExpression(true, true);
        let noexport = false;
        // --- Check for optional noexport flag
        const bankToken = this.tokens.peek();
        if (bankToken.type === CommonTokens.Identifier && bankToken.text?.toLowerCase() === "noexport") {
          this.tokens.get(); // consume the noexport token
          noexport = true;
        }
        return {
          type: "BankPragma",
          bankId: bankExpr,
          offset: bankOffsExpr,
          noexport
        } as BankPragma<TInstruction, TToken>;
      case CommonTokens.XorgPragma:
        const xorgExpr = this.getExpression();
        return {
          type: "XorgPragma",
          address: xorgExpr
        } as XorgPragma<TInstruction, TToken>;
      case CommonTokens.EntPragma:
        const entExpr = this.getExpression();
        return {
          type: "EntPragma",
          address: entExpr
        } as EntPragma<TInstruction, TToken>;
      case CommonTokens.XentPragma:
        const xentExpr = this.getExpression();
        return {
          type: "XentPragma",
          address: xentExpr
        } as XentPragma<TInstruction, TToken>;
      case CommonTokens.EquPragma:
        const equExpr = this.getExpression();
        return {
          type: "EquPragma",
          value: equExpr
        } as EquPragma<TInstruction, TToken>;
      case CommonTokens.VarPragma:
      case CommonTokens.Assign:
        const varExpr = this.getExpression();
        return {
          type: "VarPragma",
          value: varExpr
        } as VarPragma<TInstruction, TToken>;
      case CommonTokens.DispPragma:
        const dispExpr = this.getExpression();
        return {
          type: "DispPragma",
          offset: dispExpr
        } as DispPragma<TInstruction, TToken>;
      case CommonTokens.DefbPragma:
        const defbExprs = this.getExpressionList(true);
        return {
          type: "DefBPragma",
          values: defbExprs
        } as DefBPragma<TInstruction, TToken>;
      case CommonTokens.DefwPragma:
        const defwExprs = this.getExpressionList(true);
        return {
          type: "DefWPragma",
          values: defwExprs
        } as DefWPragma<TInstruction, TToken>;
        break;
      case CommonTokens.DefmPragma:
        const defmExpr = this.getExpression();
        return {
          type: "DefMPragma",
          value: defmExpr
        } as DefMPragma<TInstruction, TToken>;
      case CommonTokens.DefnPragma:
        const defnExpr = this.getExpression();
        return {
          type: "DefNPragma",
          value: defnExpr
        } as DefNPragma<TInstruction, TToken>;
      case CommonTokens.DefhPragma:
        const defhExpr = this.getExpression();
        return {
          type: "DefHPragma",
          value: defhExpr
        } as DefHPragma<TInstruction, TToken>;
      case CommonTokens.DefgxPragma:
        const defgxExpr = this.getExpression();
        return {
          type: "DefGxPragma",
          pattern: defgxExpr
        } as DefGxPragma<TInstruction, TToken>;
      case CommonTokens.DefgPragma:
        let pattern = "";
        let fspace = start.text.indexOf(" ");
        if (fspace < 0) {
          fspace = start.text.indexOf("\t");
        }
        if (fspace >= 0 && fspace < start.text.length - 1) {
          pattern = start.text.substr(fspace + 1);
        }
        return {
          type: "DefGPragma",
          pattern
        } as DefGPragma<TInstruction>;
      case CommonTokens.DefcPragma:
        const defcExpr = this.getExpression();
        return {
          type: "DefCPragma",
          value: defcExpr
        } as DefCPragma<TInstruction, TToken>;
      case CommonTokens.SkipPragma:
        const skipExpr = this.getExpression();
        const skipFillExpr = this.getExpression(true, true);
        return {
          type: "SkipPragma",
          skip: skipExpr,
          fill: skipFillExpr
        } as SkipPragma<TInstruction, TToken>;
      case CommonTokens.ExternPragma:
        return {
          type: "ExternPragma"
        } as ExternPragma<TInstruction>;
      case CommonTokens.DefsPragma:
        const defsExpr = this.getExpression();
        const defsFillExpr = this.getExpression(true, true);
        return {
          type: "DefSPragma",
          count: defsExpr,
          fill: defsFillExpr
        } as DefSPragma<TInstruction, TToken>;
      case CommonTokens.FillbPragma:
        const fillbExpr = this.getExpression();
        const fillValbExpr = this.getExpression(false, true);
        return {
          type: "FillbPragma",
          count: fillbExpr,
          fill: fillValbExpr
        } as FillbPragma<TInstruction, TToken>;
      case CommonTokens.FillwPragma:
        const fillwExpr = this.getExpression();
        const fillValwExpr = this.getExpression(false, true);
        return {
          type: "FillwPragma",
          count: fillwExpr,
          fill: fillValwExpr
        } as FillwPragma<TInstruction, TToken>;
      case CommonTokens.ModelPragma:
        const nextToken = this.tokens.peek();
        let modelId: string | null = null;
        if (nextToken.type === CommonTokens.Identifier || nextToken.type === CommonTokens.Next) {
          modelId = nextToken.text;
          this.tokens.get();
        } else {
          this.reportError("Z0107");
        }
        return {
          type: "ModelPragma",
          modelId
        } as ModelPragma<TInstruction>;
      case CommonTokens.AlignPragma:
        const alignExpr = this.getExpression(true);
        return {
          type: "AlignPragma",
          alignExpr: alignExpr
        } as AlignPragma<TInstruction, TToken>;
      case CommonTokens.TracePragma:
        const traceExprs = this.getExpressionList(true);
        return {
          type: "TracePragma",
          isHex: false,
          values: traceExprs
        } as TracePragma<TInstruction, TToken>;
      case CommonTokens.TraceHexPragma:
        const traceHexExprs = this.getExpressionList(true);
        return {
          type: "TracePragma",
          isHex: true,
          values: traceHexExprs
        } as TracePragma<TInstruction, TToken>;
      case CommonTokens.RndSeedPragma:
        const rndSeedExpr = this.getExpression(true);
        return {
          type: "RndSeedPragma",
          seedExpr: rndSeedExpr
        } as RndSeedPragma<TInstruction, TToken>;
      case CommonTokens.ErrorPragma:
        const errorExpr = this.getExpression();
        return {
          type: "ErrorPragma",
          message: errorExpr
        } as ErrorPragma<TInstruction, TToken>;
      case CommonTokens.IncludeBinPragma:
        const incBinExpr = this.getExpression();
        const incBinOffsExpr = this.getExpression(true, true);
        const incBinLenExpr = incBinOffsExpr ? this.getExpression(true, true) : null;
        return {
          type: "IncBinPragma",
          filename: incBinExpr,
          offset: incBinOffsExpr,
          length: incBinLenExpr
        } as IncBinPragma<TInstruction, TToken>;
      case CommonTokens.CompareBinPragma:
        const compBinExpr = this.getExpression();
        const compBinOffsExpr = this.getExpression(true, true);
        const compBinLenExpr = compBinOffsExpr ? this.getExpression(true, true) : null;
        return {
          type: "CompareBinPragma",
          filename: compBinExpr,
          offset: compBinOffsExpr,
          length: compBinLenExpr
        } as CompareBinPragma<TInstruction, TToken>;
      case CommonTokens.InjectOptPragma:
        const optIds = this.getIdentifierNodeList(true);
        return {
          type: "InjectOptPragma",
          identifiers: optIds
        } as InjectOptPragma<TInstruction>;

      case CommonTokens.OnSuccessPragma: {
        const expr = this.getExpression();
        if (expr.type !== "StringLiteral") {
          this.reportError("Z0108");
          return null;
        }
        return {
          type: "OnSuccessPragma",
          command: expr.value
        } as OnSuccessPragma<TInstruction>;
      }
    }
    return null;
  }

  /**
   *
   * @param parsePoint
   */
  private parseDirective(parsePoint: ParsePoint): PartialAssemblyLine<TInstruction> | null {
    const { start } = parsePoint;
    const parser = this;
    switch (start.type) {
      case CommonTokens.IfDefDir:
        return createDirectiveWithId<IfDefDirective<TInstruction>>("IfDefDirective");
      case CommonTokens.IfNDefDir:
        return createDirectiveWithId<IfNDefDirective<TInstruction>>("IfNDefDirective");
      case CommonTokens.DefineDir:
        return createDirectiveWithId<DefineDirective<TInstruction>>("DefineDirective");
      case CommonTokens.UndefDir:
        return createDirectiveWithId<UndefDirective<TInstruction>>("UndefDirective");
      case CommonTokens.IfModDir:
        return createDirectiveWithId<IfModDirective<TInstruction>>("IfModDirective");
      case CommonTokens.IfNModDir:
        return createDirectiveWithId<IfNModDirective<TInstruction>>("IfNModDirective");
      case CommonTokens.EndIfDir:
        this.tokens.get();
        return <EndIfDirective<TInstruction>>{
          type: "EndIfDirective"
        };
      case CommonTokens.ElseDir:
        this.tokens.get();
        return <ElseDirective<TInstruction>>{
          type: "ElseDirective"
        };
      case CommonTokens.IfDir:
        return createIfDirective();
      case CommonTokens.IncludeDir:
        return createIncludeDirective();
      case CommonTokens.LineDir:
        return createLineDirective();
    }
    return null;

    function createDirectiveWithId<T extends Directive<TInstruction, TToken>>(
      type: Directive<TInstruction, TToken>["type"]
    ): PartialAssemblyLine<TInstruction> | null {
      parser.tokens.get();
      const identifier = parser.getIdentifier();
      if (identifier) {
        return <T>{
          type,
          identifier
        };
      }
      return null;
    }

    function createIfDirective(): PartialAssemblyLine<TInstruction> | null {
      parser.tokens.get();
      return <IfDirective<TInstruction, TToken>>{
        type: "IfDirective",
        condition: parser.getExpression()
      };
    }

    function createIncludeDirective(): PartialAssemblyLine<TInstruction> | null {
      parser.tokens.get();
      const token = parser.skipToken(CommonTokens.StringLiteral);
      if (token) {
        const literal = parser.parseStringLiteral(token.text);
        return <IncludeDirective<TInstruction>>{
          type: "IncludeDirective",
          filename: literal.value
        };
      }
      parser.reportError("Z0108");
      return null;
    }

    function createLineDirective(): PartialAssemblyLine<TInstruction> | null {
      parser.tokens.get();
      const expr = parser.getExpression();

      let stringValue: string | null = null;
      let token = parser.tokens.peek();
      if (token.type === CommonTokens.StringLiteral) {
        const literal = parser.parseStringLiteral(token.text);
        parser.tokens.get();
        stringValue = literal.value;
      } else if (token.type !== CommonTokens.NewLine && token.type !== CommonTokens.Eof) {
        parser.reportError("Z0108");
        return null;
      }
      return <LineDirective<TInstruction, TToken>>{
        type: "LineDirective",
        lineNumber: expr,
        filename: stringValue
      };
    }
  }

  // --------------------------------------------------------------------------
  // Expression parsing

  /**
   * expr
   *   : conditionalExpr
   *   ;
   */
  parseExpr(): Expression<TInstruction, TToken> | null {
    const parsePoint = this.getParsePoint();
    const { traits } = parsePoint;
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
  private parseStatement(parsePoint: ParsePoint): PartialAssemblyLine<TInstruction> | null {
    const { start } = parsePoint;
    this.tokens.get();
    if (start.type === CommonTokens.Macro) {
      return this.parseMacroStatement();
    }
    if (start.type === CommonTokens.Endm) {
      return <MacroEndStatement<TInstruction>>{
        type: "MacroEndStatement"
      };
    }

    if (start.type === CommonTokens.Loop) {
      return this.parseLoopStatement();
    }
    if (start.type === CommonTokens.Endl) {
      return <LoopEndStatement<TInstruction>>{
        type: "LoopEndStatement"
      };
    }

    if (start.type === CommonTokens.While) {
      return this.parseWhileStatement();
    }
    if (start.type === CommonTokens.Endw) {
      return <WhileEndStatement<TInstruction>>{
        type: "WhileEndStatement"
      };
    }

    if (start.type === CommonTokens.Repeat) {
      return <RepeatStatement<TInstruction>>{
        type: "RepeatStatement",
        isBlock: true
      };
    }
    if (start.type === CommonTokens.Until) {
      return this.parseUntilStatement();
    }

    if (start.type === CommonTokens.Proc) {
      return <ProcStatement<TInstruction>>{
        type: "ProcStatement",
        isBlock: true
      };
    }
    if (start.type === CommonTokens.Endp) {
      return <ProcEndStatement<TInstruction>>{
        type: "ProcEndStatement"
      };
    }

    if (start.type === CommonTokens.If) {
      return this.parseIfStatement();
    }
    if (start.type === CommonTokens.IfUsed) {
      return this.parseIfUsedStatement();
    }
    if (start.type === CommonTokens.IfNUsed) {
      return this.parseIfNUsedStatement();
    }
    if (start.type === CommonTokens.Else) {
      return <ElseStatement<TInstruction>>{
        type: "ElseStatement"
      };
    }
    if (start.type === CommonTokens.Endif) {
      return <EndIfStatement<TInstruction>>{
        type: "EndIfStatement"
      };
    }
    if (start.type === CommonTokens.Elif) {
      return this.parseElseIfStatement();
    }

    if (start.type === CommonTokens.Break) {
      return <BreakStatement<TInstruction>>{
        type: "BreakStatement"
      };
    }
    if (start.type === CommonTokens.Continue) {
      return <ContinueStatement<TInstruction>>{
        type: "ContinueStatement"
      };
    }

    if (start.type === CommonTokens.Module) {
      return this.parseModuleStatement();
    }
    if (start.type === CommonTokens.EndModule) {
      return <ModuleEndStatement<TInstruction>>{
        type: "ModuleEndStatement"
      };
    }

    if (start.type === CommonTokens.Struct) {
      return <StructStatement<TInstruction>>{
        type: "StructStatement",
        isBlock: true
      };
    }
    if (start.type === CommonTokens.Ends) {
      return <StructEndStatement<TInstruction>>{
        type: "StructEndStatement"
      };
    }

    if (start.type === CommonTokens.For) {
      return this.parseForStatement();
    }
    if (start.type === CommonTokens.Next) {
      return <NextStatement<TInstruction>>{
        type: "NextStatement"
      };
    }
    return null;
  }

  /**
   * macroStatement
   *   : "macro" "(" Identifier? ( "," Identifier)* ")"
   */
  private parseMacroStatement(): PartialAssemblyLine<TInstruction> | null {
    this.expectToken(CommonTokens.LPar, "Z0004");
    const parameters = this.getIdentifierNodeList();
    this.expectToken(CommonTokens.RPar, "Z0005");
    return <MacroStatement<TInstruction>>{
      type: "MacroStatement",
      isBlock: true,
      parameters
    };
  }

  /**
   * loopStatement
   *   : ".loop" expression
   */
  private parseLoopStatement(): PartialAssemblyLine<TInstruction> | null {
    return <LoopStatement<TInstruction, TToken>>{
      type: "LoopStatement",
      isBlock: true,
      expr: this.getExpression()
    };
  }

  /**
   * whileStatement
   *   : ".while" expression
   */
  private parseWhileStatement(): PartialAssemblyLine<TInstruction> | null {
    return <WhileStatement<TInstruction, TToken>>{
      type: "WhileStatement",
      isBlock: true,
      expr: this.getExpression()
    };
  }

  /**
   * untilStatement
   *   : ".until" expression
   */
  private parseUntilStatement(): PartialAssemblyLine<TInstruction> | null {
    return <UntilStatement<TInstruction, TToken>>{
      type: "UntilStatement",
      expr: this.getExpression()
    };
  }

  /**
   * ifStatement
   *   : ".if" expression
   */
  private parseIfStatement(): PartialAssemblyLine<TInstruction> | null {
    return <IfStatement<TInstruction, TToken>>{
      type: "IfStatement",
      isBlock: true,
      expr: this.getExpression()
    };
  }

  /**
   * ifUsedStatement
   *   : ".ifused" expression
   */
  private parseIfUsedStatement(): PartialAssemblyLine<TInstruction> | null {
    const parsePoint = this.getParsePoint();
    const symbol = this.parseSymbol(parsePoint);
    return <IfUsedStatement<TInstruction>>{
      type: "IfUsedStatement",
      isBlock: true,
      symbol
    };
  }

  /**
   * ifNUsedStatement
   *   : ".ifnused" expression
   */
  private parseIfNUsedStatement(): PartialAssemblyLine<TInstruction> | null {
    const parsePoint = this.getParsePoint();
    const symbol = this.parseSymbol(parsePoint);
    return <IfNUsedStatement<TInstruction>>{
      type: "IfNUsedStatement",
      isBlock: true,
      symbol
    };
  }

  /**
   * elseIfStatement
   *   : ".elseif" expression
   */
  private parseElseIfStatement(): PartialAssemblyLine<TInstruction> | null {
    return <ElseIfStatement<TInstruction, TToken>>{
      type: "ElseIfStatement",
      expr: this.getExpression()
    };
  }

  /**
   * moduleStatement
   *   : ".loop" expression
   */
  private parseModuleStatement(): PartialAssemblyLine<TInstruction> | null {
    let identifier: IdentifierNode<TInstruction> | undefined = undefined;
    const idToken = this.tokens.peek();
    if (idToken.type === CommonTokens.Identifier) {
      identifier = this.getIdentifier();
    }
    return <ModuleStatement<TInstruction>>{
      type: "ModuleStatement",
      isBlock: true,
      identifier
    };
  }

  /**
   * forStatement
   *   : ".for" identifier "=" expression ".to" expression ( ".step" expression )?
   */
  private parseForStatement(): PartialAssemblyLine<TInstruction> | null {
    const identifier = this.getIdentifier();
    this.expectToken(CommonTokens.Assign, "Z0007");
    const startExpr = this.getExpression();
    this.expectToken(CommonTokens.To, "Z0008");
    const toExpr = this.getExpression();
    let stepExpr: Expression<TInstruction, TToken> | undefined = undefined;
    if (this.tokens.peek().type === CommonTokens.Step) {
      this.tokens.get();
      stepExpr = this.getExpression();
    }
    return <ForStatement<TInstruction, TToken>>{
      type: "ForStatement",
      isBlock: true,
      identifier,
      startExpr,
      toExpr,
      stepExpr
    };
  }

  /**
   * macroOrStructInvocation
   *   : Identifier "(" macroArgument ("," macroArgument)* ")"
   *   ;
   */
  private parseMacroOrStructInvocation(): PartialAssemblyLine<TInstruction> | null {
    const identifier = this.getIdentifier();
    this.expectToken(CommonTokens.LPar, "Z0004");
    const operands: Operand<TInstruction, TToken>[] = [];
    if (this.tokens.peek().type !== CommonTokens.RPar) {
      const operand = this.parseOperand();
      if (operand) {
        operands.push(operand);
      } else {
        operands.push(<Operand<TInstruction, TToken>>{
          type: "Operand",
          operandType: OperandType.NoneArg
        });
      }
      while (this.skipToken(CommonTokens.Comma)) {
        const operand = this.parseOperand();
        if (operand) {
          operands.push(operand);
        } else {
          operands.push(<Operand<TInstruction, TToken>>{
            type: "Operand",
            operandType: OperandType.NoneArg
          });
        }
      }
    }
    this.expectToken(CommonTokens.RPar, "Z0005");
    return <MacroOrStructInvocation<TInstruction, TToken>>{
      type: "MacroOrStructInvocation",
      identifier,
      operands
    };
  }

  /**
   * fieldAssignment
   *   : "->" byteEmPragma
   *   ;
   */
  private parseFieldAssignment(): PartialAssemblyLine<TInstruction> | null {
    this.tokens.get();
    const parsePoint = this.getParsePoint();
    const { start } = parsePoint;
    switch (start.type) {
      case CommonTokens.DefbPragma:
      case CommonTokens.DefwPragma:
      case CommonTokens.DefcPragma:
      case CommonTokens.DefmPragma:
      case CommonTokens.DefnPragma:
      case CommonTokens.DefhPragma:
      case CommonTokens.DefsPragma:
      case CommonTokens.FillbPragma:
      case CommonTokens.FillwPragma:
      case CommonTokens.DefgPragma:
      case CommonTokens.DefgxPragma:
        return <FieldAssignment<TInstruction, TToken>>{
          type: "FieldAssignment",
          assignment: this.parsePragma(parsePoint)
        };
      default:
        this.reportError("Z0110");
        return null;
    }
  }

  /**
   * parExpr
   *   : "(" expr ")"
   *   ;
   */
  private parseParExpr(): Expression<TInstruction, TToken> | null {
    if (this.skipToken(CommonTokens.LPar)) {
      const expr = this.parseExpr();
      if (!expr) {
        return null;
      }
      this.expectToken(CommonTokens.RPar);
      return expr;
    }
    return null;
  }

  /**
   * brackExpr
   *   : "[" expr "]"
   *   ;
   */
  private parseBrackExpr(): Expression<TInstruction, TToken> | null {
    if (this.skipToken(CommonTokens.LSBrac)) {
      const expr = this.parseExpr();
      if (!expr) {
        return null;
      }
      this.expectToken(CommonTokens.RSBrac);
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
  private parseCondExpr(): Expression<TInstruction, TToken> | null {
    const startToken = this.tokens.peek();
    const condExpr = this.parseOrExpr();
    if (!condExpr) {
      return null;
    }

    if (!this.skipToken(CommonTokens.QuestionMark)) {
      return condExpr;
    }

    const trueExpr = this.getExpression();
    this.expectToken(CommonTokens.Colon);
    const falseExpr = this.getExpression();
    const endToken = this.tokens.peek();

    return this.createExpressionNode<ConditionalExpression<TInstruction, TToken>>(
      "ConditionalExpression",
      {
        condition: condExpr,
        consequent: trueExpr,
        alternate: falseExpr
      },
      startToken,
      endToken
    );
  }

  /**
   * orExpr
   *   : xorExpr ( "|" xorExpr )?
   */
  private parseOrExpr(): Expression<TInstruction, TToken> | null {
    let leftExpr = this.parseXorExpr();
    if (!leftExpr) {
      return null;
    }

    while (this.skipToken(CommonTokens.VerticalBar)) {
      const startToken = this.tokens.peek();
      const rightExpr = this.parseXorExpr();
      if (!rightExpr) {
        this.reportError("Z0111");
        return null;
      }
      const endToken = this.tokens.peek();
      leftExpr = this.createExpressionNode<BinaryExpression<TInstruction, TToken>>(
        "BinaryExpression",
        {
          operator: "|",
          left: leftExpr,
          right: rightExpr
        },
        startToken,
        endToken
      );
    }
    return leftExpr;
  }

  /**
   * xorExpr
   *   : andExpr ( "^" andExpr )?
   */
  private parseXorExpr(): Expression<TInstruction, TToken> | null {
    let leftExpr = this.parseAndExpr();
    if (!leftExpr) {
      return null;
    }

    while (this.skipToken(CommonTokens.UpArrow)) {
      const startToken = this.tokens.peek();
      const rightExpr = this.parseAndExpr();
      if (!rightExpr) {
        this.reportError("Z0111");
        return null;
      }
      const endToken = this.tokens.peek();
      leftExpr = this.createExpressionNode<BinaryExpression<TInstruction, TToken>>(
        "BinaryExpression",
        {
          operator: "^",
          left: leftExpr,
          right: rightExpr
        },
        startToken,
        endToken
      );
    }
    return leftExpr;
  }

  /**
   * andExpr
   *   : equExpr ( "&" equExpr )?
   */
  private parseAndExpr(): Expression<TInstruction, TToken> | null {
    let leftExpr = this.parseEquExpr();
    if (!leftExpr) {
      return null;
    }

    while (this.skipToken(CommonTokens.Ampersand)) {
      const startToken = this.tokens.peek();
      const rightExpr = this.parseEquExpr();
      if (!rightExpr) {
        this.reportError("Z0111");
        return null;
      }
      const endToken = this.tokens.peek();
      leftExpr = this.createExpressionNode<BinaryExpression<TInstruction, TToken>>(
        "BinaryExpression",
        {
          operator: "&",
          left: leftExpr,
          right: rightExpr
        },
        startToken,
        endToken
      );
    }
    return leftExpr;
  }

  /**
   * equExpr
   *   : relExpr ( ( "==" | "===" | "!=" | "!==" ) relExpr )?
   */
  private parseEquExpr(): Expression<TInstruction, TToken> | null {
    let leftExpr = this.parseRelExpr();
    if (!leftExpr) {
      return null;
    }

    let opType: Token<CommonTokenType> | null;
    while (
      (opType = this.skipTokens(
        CommonTokens.Equal,
        CommonTokens.CiEqual,
        CommonTokens.NotEqual,
        CommonTokens.CiNotEqual
      ))
    ) {
      const startToken = this.tokens.peek();
      const rightExpr = this.parseRelExpr();
      if (!rightExpr) {
        this.reportError("Z0111");
        return null;
      }
      const endToken = this.tokens.peek();
      leftExpr = this.createExpressionNode<BinaryExpression<TInstruction, TToken>>(
        "BinaryExpression",
        {
          type: "BinaryExpression",
          operator: opType.text,
          left: leftExpr,
          right: rightExpr
        },
        startToken,
        endToken
      );
    }
    return leftExpr;
  }

  /**
   * relExpr
   *   : shiftExpr ( ( "<" | "<=" | ">" | ">=" ) shiftExpr )?
   */
  private parseRelExpr(): Expression<TInstruction, TToken> | null {
    let leftExpr = this.parseShiftExpr();
    if (!leftExpr) {
      return null;
    }

    let opType: Token<CommonTokenType> | null;
    while (
      (opType = this.skipTokens(
        CommonTokens.LessThan,
        CommonTokens.LessThanOrEqual,
        CommonTokens.GreaterThan,
        CommonTokens.GreaterThanOrEqual
      ))
    ) {
      const startToken = this.tokens.peek();
      const rightExpr = this.parseShiftExpr();
      if (!rightExpr) {
        this.reportError("Z0111");
        return null;
      }
      const endToken = this.tokens.peek();
      leftExpr = this.createExpressionNode<BinaryExpression<TInstruction, TToken>>(
        "BinaryExpression",
        {
          operator: opType.text,
          left: leftExpr,
          right: rightExpr
        },
        startToken,
        endToken
      );
    }
    return leftExpr;
  }

  /**
   * shiftExpr
   *   : addExpr ( ( "<<" | ">>" ) addExpr )?
   */
  private parseShiftExpr(): Expression<TInstruction, TToken> | null {
    let leftExpr = this.parseAddExpr();
    if (!leftExpr) {
      return null;
    }

    let opType: Token<CommonTokenType> | null;
    while ((opType = this.skipTokens(CommonTokens.LeftShift, CommonTokens.RightShift))) {
      const startToken = this.tokens.peek();
      const rightExpr = this.parseAddExpr();
      if (!rightExpr) {
        this.reportError("Z0111");
        return null;
      }
      const endToken = this.tokens.peek();
      leftExpr = this.createExpressionNode<BinaryExpression<TInstruction, TToken>>(
        "BinaryExpression",
        {
          operator: opType.text,
          left: leftExpr,
          right: rightExpr
        },
        startToken,
        endToken
      );
    }
    return leftExpr;
  }

  /**
   * addExpr
   *   : multExpr ( ( "+" | "-" ) multExpr )?
   */
  private parseAddExpr(): Expression<TInstruction, TToken> | null {
    let leftExpr = this.parseMultExpr();
    if (!leftExpr) {
      return null;
    }

    let opType: Token<CommonTokenType> | null;
    while ((opType = this.skipTokens(CommonTokens.Plus, CommonTokens.Minus))) {
      const startToken = this.tokens.peek();
      const rightExpr = this.parseMultExpr();
      if (!rightExpr) {
        this.reportError("Z0111");
        return null;
      }
      const endToken = this.tokens.peek();
      leftExpr = this.createExpressionNode<BinaryExpression<TInstruction, TToken>>(
        "BinaryExpression",
        {
          operator: opType.text,
          left: leftExpr,
          right: rightExpr
        },
        startToken,
        endToken
      );
    }
    return leftExpr;
  }

  /**
   * multExpr
   *   : minMaxExpr ( ( "*" | "/" | "%") minMaxExpr )?
   */
  private parseMultExpr(): Expression<TInstruction, TToken> | null {
    let leftExpr = this.parseMinMaxExpr();
    if (!leftExpr) {
      return null;
    }

    let opType: Token<CommonTokenType> | null;
    while (
      (opType = this.skipTokens(
        CommonTokens.Multiplication,
        CommonTokens.Divide,
        CommonTokens.Modulo
      ))
    ) {
      const startToken = this.tokens.peek();
      const rightExpr = this.parseMinMaxExpr();
      if (!rightExpr) {
        this.reportError("Z0111");
        return null;
      }
      const endToken = this.tokens.peek();
      leftExpr = this.createExpressionNode<BinaryExpression<TInstruction, TToken>>(
        "BinaryExpression",
        {
          operator: opType.text,
          left: leftExpr,
          right: rightExpr
        },
        startToken,
        endToken
      );
    }
    return leftExpr;
  }

  /**
   * minMaxExpr
   *   : primaryExpr ( ( "<?" | ">?") primaryExpr )?
   */
  private parseMinMaxExpr(): Expression<TInstruction, TToken> | null {
    let leftExpr = this.parsePrimaryExpr();
    if (!leftExpr) {
      return null;
    }

    let opType: Token<CommonTokenType> | null;
    while ((opType = this.skipTokens(CommonTokens.MinOp, CommonTokens.MaxOp))) {
      const startToken = this.tokens.peek();
      const rightExpr = this.parsePrimaryExpr();
      if (!rightExpr) {
        this.reportError("Z0111");
        return null;
      }
      const endToken = this.tokens.peek();
      leftExpr = this.createExpressionNode<BinaryExpression<TInstruction, TToken>>(
        "BinaryExpression",
        {
          operator: opType.text,
          left: leftExpr,
          right: rightExpr
        },
        startToken,
        endToken
      );
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
  private parsePrimaryExpr(): Expression<TInstruction, TToken> | null {
    const parsePoint = this.getParsePoint();
    const { start, traits } = parsePoint;

    if (start.type === CommonTokens.Multiplication) {
      // --- Special case, it might be the "*" operator or the current address
      const ahead = this.tokens.ahead(1);
      const atraits = this.getTokenTraits(ahead.type);
      if (ahead.type === CommonTokens.Eof || !atraits.expressionStart) {
        this.tokens.get();
        return this.createExpressionNode<CurrentAddressLiteral<TInstruction>>(
          "CurrentAddressLiteral",
          {},
          start,
          this.tokens.peek()
        );
      }
    }

    if (traits.parseTimeFunction) {
      return this.parseParseTimeFunctionInvocation(parsePoint);
    }

    if (traits.macroTimeFunction) {
      const funcInvocation = this.parseMacroTimeFuncInvocation(parsePoint);
      const operand = funcInvocation.operand;
      if (
        !this.macroEmitPhase &&
        operand &&
        (operand.operandType !== OperandType.Expression || operand.expr.type !== "MacroParameter")
      ) {
        this.reportError("Z1009", start);
      }
      return funcInvocation;
    }
    if (traits.literal) {
      return this.parseLiteral(parsePoint);
    }
    switch (start.type) {
      case CommonTokens.LPar:
        return this.parseParExpr();
      case CommonTokens.LSBrac:
        return this.parseBrackExpr();
      case CommonTokens.Identifier:
        const lpar = this.tokens.ahead(1);
        return lpar.type === CommonTokens.LPar
          ? this.parseFunctionInvocation()
          : this.parseSymbol(parsePoint);
      case CommonTokens.DoubleColon:
        return this.parseSymbol(parsePoint);
      case CommonTokens.Plus:
      case CommonTokens.Minus:
      case CommonTokens.BinaryNot:
      case CommonTokens.Exclamation:
        return this.parseUnaryExpr(parsePoint);
      case CommonTokens.LDBrac:
        return this.parseMacroParam() as Expression<TInstruction, TToken>;
    }
    return null;
  }

  /**
   * Parses macro-time function invocations
   */
  private parseMacroTimeFuncInvocation(
    parsePoint: ParsePoint
  ): MacroTimeFunctionInvocation<TInstruction, TToken> | null {
    const { start } = parsePoint;
    this.tokens.get();
    this.expectToken(CommonTokens.LPar, "Z0004");
    const operand = this.parseOperand();
    this.expectToken(CommonTokens.RPar, "Z0005");
    return this.createExpressionNode<MacroTimeFunctionInvocation<TInstruction, TToken>>(
      "MacroTimeFunctionInvocation",
      {
        functionName: start.text.toLowerCase(),
        operand
      },
      start,
      this.tokens.peek()
    );
  }

  /**
   * Parses parse-time function invocations
   */
  private parseParseTimeFunctionInvocation(
    parsePoint: ParsePoint
  ): Expression<TInstruction, TToken> | null {
    const { start } = parsePoint;
    this.tokens.get();
    this.expectToken(CommonTokens.LPar, "Z0004");
    const argToken = this.tokens.peek();
    const traits = this.getTokenTraits(argToken.type);
    if (traits.instruction || traits.reg || traits.condition) {
      this.tokens.get();
      this.expectToken(CommonTokens.RPar, "Z0005");
      return <StringLiteral<TInstruction>>{
        type: "StringLiteral",
        value:
          start.type === CommonTokens.LTextOf
            ? argToken.text.toLowerCase()
            : argToken.text.toUpperCase()
      };
    }
    if (argToken.type === CommonTokens.LPar) {
      this.tokens.get();
      const reg16 = this.tokens.peek();
      const reg16Traits = this.getTokenTraits(reg16.type);
      if (!reg16Traits.reg16) {
        this.reportError("Z0106");
        return null;
      }
      this.tokens.get();
      this.expectToken(CommonTokens.RPar, "Z0005");
      this.expectToken(CommonTokens.RPar, "Z0005");
      return <StringLiteral<TInstruction>>{
        type: "StringLiteral",
        value: `(${
          start.type === CommonTokens.LTextOf ? reg16.text.toLowerCase() : reg16.text.toUpperCase()
        })`
      };
    }

    if (!this.macroEmitPhase) {
      // --- Accept macro parameters in this phase
      if (argToken.type === CommonTokens.LDBrac) {
        const macroParam = this.parseMacroParam();
        this.expectToken(CommonTokens.RPar, "Z0005");
        return macroParam as Expression<TInstruction, TToken>;
      }
    }
    this.reportError("Z0112");
    return null;
  }

  /**
   * functionInvocation
   *   : identifier "(" expression? ("," expression)* ")"
   */
  private parseFunctionInvocation(): Expression<TInstruction, TToken> | null {
    const startToken = this.tokens.peek();
    const functionName = this.getIdentifier();
    this.expectToken(CommonTokens.LPar, "Z0004");
    const args = this.getExpressionList(false);
    this.expectToken(CommonTokens.RPar, "Z0005");
    return this.createExpressionNode<FunctionInvocation<TInstruction, TToken>>(
      "FunctionInvocation",
      {
        functionName,
        args
      },
      startToken,
      this.tokens.peek()
    );
  }

  /**
   * symbol
   *   : "::"? Identifier
   *   ;
   */
  private parseSymbol(parsePoint: ParsePoint): Expression<TInstruction, TToken> | null {
    const startToken = this.tokens.peek();
    let startsFromGlobal = false;
    if (this.skipToken(CommonTokens.DoubleColon)) {
      startsFromGlobal = true;
      parsePoint = this.getParsePoint();
    }
    if (parsePoint.start.type === CommonTokens.Identifier) {
      const identifier = this.getIdentifier();
      return this.createExpressionNode<Symbol<TInstruction>>(
        "Symbol",
        {
          startsFromGlobal,
          identifier
        },
        startToken,
        this.tokens.peek()
      );
    }
    this.reportError("Z0107");
    return null;
  }

  /**
   * unaryExpr
   *   : ( "+" | "-" | "~" | "!" ) expr
   *   ;
   */
  private parseUnaryExpr(
    parsePoint: ParsePoint
  ): UnaryExpression<TInstruction, TToken> | null {
    // --- Obtain and skip the operator token
    const operator = parsePoint.start.text;
    this.tokens.get();

    const operand = this.getExpression();
    return this.createExpressionNode<UnaryExpression<TInstruction, TToken>>(
      "UnaryExpression",
      {
        operator,
        operand
      },
      parsePoint.start,
      this.tokens.peek()
    );
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
  private parseLiteral(parsePoint: ParsePoint): Expression<TInstruction, TToken> | null {
    const { start } = parsePoint;
    let literal: Expression<TInstruction, TToken> | null = null;
    switch (start.type) {
      case CommonTokens.BinaryLiteral:
        literal = this.parseBinaryLiteral(start.text);
        break;
      case CommonTokens.OctalLiteral:
        literal = this.parseOctalLiteral(start.text);
        break;
      case CommonTokens.DecimalLiteral:
        literal = this.parseDecimalLiteral(start.text);
        break;
      case CommonTokens.HexadecimalLiteral:
        literal = this.parseHexadecimalLiteral(start.text);
        break;
      case CommonTokens.RealLiteral:
        literal = this.parseRealLiteral(start.text);
        break;
      case CommonTokens.CharLiteral:
        literal = this.parseCharLiteral(start.text);
        break;
      case CommonTokens.StringLiteral:
        literal = this.parseStringLiteral(start.text);
        break;
      case CommonTokens.True:
        literal = <BooleanLiteral<TInstruction>>{
          type: "BooleanLiteral",
          value: true
        };
        break;
      case CommonTokens.False:
        literal = <BooleanLiteral<TInstruction>>{
          type: "BooleanLiteral",
          value: false
        };
        break;
      case CommonTokens.CurAddress:
      case CommonTokens.Dot:
      case CommonTokens.Multiplication:
        literal = this.createExpressionNode<CurrentAddressLiteral<TInstruction>>(
          "CurrentAddressLiteral",
          {},
          start,
          this.tokens.peek()
        );
        break;
      case CommonTokens.CurCnt:
        literal = this.createExpressionNode<CurrentCounterLiteral<TInstruction>>(
          "CurrentCounterLiteral",
          {
            type: "CurrentCounterLiteral"
          },
          start,
          this.tokens.peek()
        );
        break;
    }
    if (literal) {
      // --- Skip the parsed literal
      this.tokens.get();
    }
    return this.createExpressionNode(literal.type, literal, start, this.tokens.peek());
  }

  /**
   * BinaryLiteral
   *   : "%" ("_" | "0" | "1")+
   * @param text
   */
  private parseBinaryLiteral(text: string): IntegerLiteral<TInstruction> | null {
    if (text.startsWith("%")) {
      text = text.substr(1);
    } else if (text.endsWith("b")) {
      text = text.substr(0, text.length - 1);
    }
    while (text.includes("_")) {
      text = text.replace("_", "");
    }
    const value = parseInt(text, 2);
    if (!isNaN(value)) {
      return <IntegerLiteral<TInstruction>>{
        type: "IntegerLiteral",
        value
      };
    }
    this.reportError("Z0114");
    return null;
  }

  /**
   * OctalLiteral
   *   : ("0".."7")+ ("q" | "Q" | "o" | "O")
   */
  private parseOctalLiteral(text: string): IntegerLiteral<TInstruction> | null {
    text = text.substring(0, text.length - 1);
    const value = parseInt(text, 8);
    if (!isNaN(value)) {
      return <IntegerLiteral<TInstruction>>{
        type: "IntegerLiteral",
        value
      };
    }
    this.reportError("Z0114");
    return null;
  }

  /**
   * decimalLiteral
   *   : ("0".."9")+
   * @param text
   */
  private parseDecimalLiteral(text: string): IntegerLiteral<TInstruction> | null {
    const value = parseInt(text, 10);
    if (!isNaN(value)) {
      return <IntegerLiteral<TInstruction>>{
        type: "IntegerLiteral",
        value
      };
    }
    this.reportError("Z0114");
    return null;
  }

  /**
   * hexadecimalLiteral
   *   : ("#" | "$" | "0x") ("0".."9" | "a".."f" | "A".."F") {1-4}
   *   | ("0".."9") ("0".."9" | "a".."f" | "A".."F") {1-4} ("h" | "H")
   * @param text
   */
  private parseHexadecimalLiteral(text: string): IntegerLiteral<TInstruction> | null {
    if (text.startsWith("#") || text.startsWith("$")) {
      text = text.substring(1);
    } else if (text.endsWith("h") || text.endsWith("H")) {
      text = text.substr(0, text.length - 1);
    }
    const value = parseInt(text, 16);
    if (!isNaN(value)) {
      return <IntegerLiteral<TInstruction>>{
        type: "IntegerLiteral",
        value
      };
    }
    this.reportError("Z0114");
    return null;
  }

  /**
   * realLiteral
   *   : ("0".."9")* "." ("0".."9")+ (("e" | "E") ("+" | "-")? ("0".."9")+)?
   *   | ("0".."9")+ (("e" | "E") ("+" | "-")? ("0".."9")+)
   *   ;
   */
  private parseRealLiteral(text: string): RealLiteral<TInstruction> | null {
    const value = parseFloat(text);
    if (!isNaN(value)) {
      return <RealLiteral<TInstruction>>{
        type: "RealLiteral",
        value
      };
    }
    this.reportError("Z0114");
    return null;
  }

  /**
   * Parses a character literal
   *
   */
  private parseCharLiteral(text: string): IntegerLiteral<TInstruction> | null {
    text = this.convertEscapedString(text.substr(1, text.length - 2));
    return <IntegerLiteral<TInstruction>>{
      type: "IntegerLiteral",
      value: text.length > 0 ? text.charCodeAt(0) : 0x00
    };
  }

  private parseStringLiteral(text: string): StringLiteral<TInstruction> | null {
    text = text.substr(1, text.length - 2);
    return <StringLiteral<TInstruction>>{
      type: "StringLiteral",
      value: this.convertEscapedString(text)
    };
  }

  // --------------------------------------------------------------------------
  // Miscellaneous

  /**
   * macroParam
   *   : "{{" Identifier "}}"
   *   ;
   */
  parseMacroParam(): PartialAssemblyLine<TInstruction> | null {
    const paramToken = this.tokens.get();
    const identifier = this.getIdentifier();
    this.expectToken(CommonTokens.RDBrac, "Z0006");
    const nextToken = this.tokens.peek();
    const macroParam = this.createExpressionNode<MacroParameter<TInstruction>>(
      "MacroParameter",
      { identifier },
      paramToken,
      nextToken
    );
    this._macroParamsCollected.push(macroParam);
    return macroParam;
  }

  // ==========================================================================
  // Helper methods for parsing

  private createExpressionNode<T extends ExpressionNode<TInstruction>>(
    type: ExpressionNode<TInstruction>["type"],
    stump: any,
    startToken: Token<CommonTokenType>,
    endToken: Token<CommonTokenType>
  ): T {
    const startPosition = startToken.location.startPosition;
    const endPosition = endToken.location.startPosition;
    return Object.assign({}, stump, {
      type,
      startPosition,
      endPosition,
      line: startToken.location.startLine,
      startColumn: startToken.location.startColumn,
      endColumn: endToken.location.startColumn,
      sourceText: this.tokens.getSourceSpan(startPosition, endPosition)
    });
  }

  /**
   * Gets the current parse point
   */
  getParsePoint(): ParsePoint {
    const start = this.tokens.peek();
    const traits = this.getTokenTraits(start.type);
    return { start, traits };
  }

  /**
   * Tests the type of the next token
   * @param type Expected token type
   */
  expectToken(type: CommonTokenType, errorCode?: ErrorCodes, allowEof?: boolean) {
    const next = this.tokens.peek();
    if (next.type === type || (allowEof && next.type === CommonTokens.Eof)) {
      // --- Skip the expected token
      this.tokens.get();
      return;
    }

    this.reportError(errorCode ?? "Z0001", next, [next.text]);
  }

  /**
   * Skips the next token if the type is the specified one
   * @param type Token type to check
   */
  skipToken(type: CommonTokenType): Token<CommonTokenType> | null {
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
  skipTokens(...types: CommonTokenType[]): Token<CommonTokenType> | null {
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
   * Reports the specified error
   * @param errorCode Error code
   * @param token Token that represents the error's position
   * @param options Error message options
   */
  reportError(
    errorCode: ErrorCodes,
    token?: Token<CommonTokenType>,
    options?: any[]
  ): void {
    let errorText: string = errorMessages[errorCode] ?? "Unknown error";
    if (options) {
      options.forEach(
        (_, idx) => (errorText = replace(errorText, `{${idx}}`, options[idx].toString()))
      );
    }
    if (!token) {
      token = this.getParsePoint().start;
    }
    this._parseErrors.push({
      code: errorCode,
      text: errorText,
      line: token.location.startLine,
      column: token.location.startColumn,
      position: token.location.startPosition
    });
    throw new ParserError(errorText, errorCode);

    function replace(input: string, placeholder: string, replacement: string): string {
      do {
        input = input.replace(placeholder, replacement);
      } while (input.includes(placeholder));
      return input;
    }
  }

  /**
   * Tests if the specified token can be the start of a line's body
   * @param token Token to test
   */
  private startsLineBody(token: Token<CommonTokenType>): boolean {
    const traits = this.getTokenTraits(token.type);
    if (
      traits.instruction ||
      traits.pragma ||
      traits.statement ||
      token.type === CommonTokens.GoesTo ||
      token.type === CommonTokens.LDBrac
    ) {
      return true;
    }

    return false;
  }

  /**
   * Gets an identifier node
   */
  private getIdentifier(): IdentifierNode<TInstruction> {
    const idToken = this.tokens.get();
    if (idToken.type !== CommonTokens.Identifier) {
      this.reportError("Z0107");
    }
    return <IdentifierNode<TInstruction>>{
      type: "Identifier",
      name: idToken.text,
      startPosition: idToken.location.startPosition,
      endPosition: idToken.location.endPosition,
      line: idToken.location.startLine,
      startColumn: idToken.location.startColumn,
      endColumn: idToken.location.endColumn
    };
  }

  /**
   * Gets an expression
   * @param optional Is the expression optional?
   * @param leadingComma Test for leading comma?
   */
  getExpression(
    optional: boolean = false,
    leadingComma: boolean = false
  ): Expression<TInstruction, TToken> | null {
    if (leadingComma) {
      if (!this.skipToken(CommonTokens.Comma)) {
        if (!optional) {
          this.reportError("Z0003");
        }
        return null;
      } else {
        // --- We have a comma, so the expression in not optional
        optional = false;
      }
    }
    const expr = this.parseExpr();
    if (expr) {
      return expr;
    }
    if (!optional) {
      this.reportError("Z0111");
    }
    return null;
  }

  /**
   * Gets a list of expressions
   * @param atLeastOne Is the first expression mandatory?
   */
  private getExpressionList(atLeastOne: boolean): Expression<TInstruction, TToken>[] {
    const expressions: Expression<TInstruction, TToken>[] = [];
    const first = this.getExpression(!atLeastOne);
    if (first) {
      expressions.push(first);
    }
    while (this.skipToken(CommonTokens.Comma)) {
      const next = this.getExpression();
      if (next) {
        expressions.push(next);
      }
    }
    return expressions;
  }

  /**
   * Gets a list of identifiers
   */
  private getIdentifierNodeList(needsOne: boolean = false): IdentifierNode<TInstruction>[] {
    const expressions: IdentifierNode<TInstruction>[] = [];
    if (this.tokens.peek().type === CommonTokens.Identifier) {
      const first = this.getIdentifier();
      if (first) {
        expressions.push(first);
      }
      while (this.skipToken(CommonTokens.Comma)) {
        const next = this.getIdentifier();
        if (next) {
          expressions.push(next);
        }
      }
    } else if (needsOne) {
      this.reportError("Z0107");
      return null;
    }
    return expressions;
  }
}

/**
 * This interface represents the parsing point that can be passed to parsing methods
 */
export interface ParsePoint {
  /**
   * Start token at that point
   */
  start: Token<number>;

  /**
   * Traist of the start token
   */
  traits: TokenTraits;
}

/**
 * IDs that can be contextual keywords
 */
const keywordLikeIDs: { [key: string]: boolean } = {
  continue: true,
  CONTINUE: true,
  break: true,
  BREAK: true,
  endm: true,
  ENDM: true,
  mend: true,
  MEND: true,
  endl: true,
  ENDL: true,
  lend: true,
  LEND: true,
  proc: true,
  PROC: true,
  endp: true,
  ENDP: true,
  pend: true,
  PEND: true,
  repeat: true,
  REPEAT: true,
  endw: true,
  ENDW: true,
  wend: true,
  WEND: true,
  ends: true,
  ENDS: true,
  else: true,
  ELSE: true,
  elif: true,
  ELIF: true,
  endif: true,
  ENDIF: true,
  while: true,
  WHILE: true,
  until: true,
  UNTIL: true,
  loop: true,
  LOOP: true,
  next: true,
  NEXT: true
};
