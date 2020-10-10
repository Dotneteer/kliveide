import { TokenStream, Token, TokenType } from "./token-stream";
import {
  Program,
  Z80AssemblyLine,
  PartialZ80AssemblyLine,
  LabelOnlyLine,
  SimpleZ80Instruction,
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
  IfModDirective,
  IfNModDirective,
  IfDirective,
  IncludeDirective,
  LineDirective,
  ZxBasicPragma,
  OrgPragma,
  XorgPragma,
  EntPragma,
  XentPragma,
  EquPragma,
  VarPragma,
  DispPragma,
  DefCPragma,
  DefMPragma,
  DefNPragma,
  DefHPragma,
  DefGxPragma,
  ErrorPragma,
  ExternPragma,
  AlignPragma,
  RndSeedPragma,
  BankPragma,
  SkipPragma,
  DefSPragma,
  FillbPragma,
  FillwPragma,
  IncBinPragma,
  CompareBinPragma,
  DefBPragma,
  DefWPragma,
  TracePragma,
  ModelPragma,
  InjectOptPragma,
  DefGPragma,
  TestInstruction,
  NextRegInstruction,
  DjnzInstruction,
  RstInstruction,
  ImInstruction,
  JrInstruction,
  JpInstruction,
  CallInstruction,
  RetInstruction,
  Operand,
  OperandType,
  IncInstruction,
  DecInstruction,
  PushInstruction,
  PopInstruction,
  Node,
  Z80InstructionWithTwoOperands,
  LdInstruction,
  Z80InstructionWithOneOperand,
  ExInstruction,
  AddInstruction,
  AdcInstruction,
  SbcInstruction,
  BitInstruction,
  Z80InstructionWithOneOrTwoOperands,
  SubInstruction,
  AndInstruction,
  XorInstruction,
  CpInstruction,
  InInstruction,
  OutInstruction,
  RlcInstruction,
  RrcInstruction,
  RlInstruction,
  RrInstruction,
  SlaInstruction,
  SraInstruction,
  SllInstruction,
  SrlInstruction,
  OrInstruction,
  Z80InstructionWithTwoOrThreeOperands,
  ResInstruction,
  SetInstruction,
  MacroStatement,
  MacroEndStatement,
  LoopStatement,
  LoopEndStatement,
  WhileStatement,
  WhileEndStatement,
  RepeatStatement,
  UntilStatement,
  ProcEndStatement,
  ProcStatement,
  IfStatement,
  IfUsedStatement,
  IfNUsedStatement,
  ElseStatement,
  EndIfStatement,
  ElseIfStatement,
  BreakStatement,
  ContinueStatement,
  ModuleStatement,
  ModuleEndStatement,
  StructStatement,
  StructEndStatement,
  LocalStatement,
  ForStatement,
  NextStatement,
  FieldAssignment,
  MacroOrStructInvocation,
  MacroParameter,
  BuiltInFunctionInvocation,
  FunctionInvocation,
  IdentifierNode,
  Expression,
} from "./tree-nodes";
import { ParserErrorMessage, errorMessages, ErrorCodes } from "../errors";
import { ParserError } from "./parse-errors";
import { getTokenTraits, TokenTraits } from "./token-traits";
import { convertSpectrumString } from "../utils";

/**
 * This class implements the Z80 assembly parser
 */
export class Z80AsmParser {
  private readonly _parseErrors: ParserErrorMessage[] = [];

  /**
   * Initializes the parser with the specified token stream
   * @param tokens Token stream of the source code
   * @param fileIndex Optional file index of the file being parsed
   */
  constructor(
    public readonly tokens: TokenStream,
    private readonly fileIndex = 0
  ) {}

  /**
   * The errors raised during the parse phase
   */
  get errors(): ParserErrorMessage[] {
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
    this.tokens.resetComment();
    while ((token = this.tokens.peek(true)).type !== TokenType.Eof) {
      // --- We skip empty lines
      if (
        token.type === TokenType.EolComment ||
        token.type === TokenType.NewLine
      ) {
        const endToken = this.tokens.get(true);
        if (this.tokens.lastComment) {
          assemblyLines.push(<Z80AssemblyLine>{
            type: "CommentOnlyLine",
            line: token.location.line,
            startPosition: endToken.location.startPos,
            startColumn: endToken.location.startColumn,
            endPosition: endToken.location.endPos,
            endColumn: endToken.location.endColumn,
            comment: this.tokens.lastComment,
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
        const parsedLine = this.parseAssemblyLine();
        if (parsedLine) {
          assemblyLines.push(parsedLine);
          this.expectToken(TokenType.NewLine, null, true);
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
    let label: IdentifierNode | null = null;
    if (this.startsLabel(start)) {
      label = this.parseLabel(parsePoint);
    }
    if (this.startsLineBody(start)) {
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
      this.reportError("Z1017", start, [start.text]);
    }

    // --- Complete the line with position information
    const nextToken = this.tokens.peek();
    const resultLine: Z80AssemblyLine = Object.assign({}, asmLine, {
      fileIndex: this.fileIndex,
      line: start.location.line,
      startPosition: start.location.startPos,
      startColumn: start.location.startColumn,
      endPosition: nextToken.location.startPos,
      endColumn: nextToken.location.startColumn,
      comment: this.tokens.lastComment,
    });
    return resultLine;
  }

  /**
   * label
   *   : Identifier ":"?
   *   ;
   */
  private parseLabel(parsePoint: ParsePoint): IdentifierNode | null {
    const { start } = parsePoint;
    if (start.type === TokenType.Identifier) {
      const nextToken = this.tokens.ahead(1);
      if (nextToken.type === TokenType.LPar) {
        // --- Identifier LPar <-- Beginning of a macro or function invocation
        return null;
      }

      // --- The token is an identifier
      // --- Skip the identifier and the optional colon
      const identifier = this.getIdentifier();
      this.skipToken(TokenType.Colon);
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
  private parseLineBody(parsePoint: ParsePoint): PartialZ80AssemblyLine | null {
    const { start, traits } = parsePoint;
    if (start.type === TokenType.NewLine || start.type === TokenType.Eof) {
      return null;
    }
    if (traits.pragma) {
      return this.parsePragma(parsePoint);
    }
    if (traits.instruction) {
      return this.parseInstruction(parsePoint);
    }
    if (start.type === TokenType.LDBrac) {
      return this.parseMacroParam();
    }
    if (traits.statement) {
      return this.parseStatement(parsePoint);
    }
    if (start.type === TokenType.Identifier) {
      const text = start.text.toLowerCase();
      if (text === "loop") {
        this.tokens.get();
        return this.parseLoopStatement();
      }
      if (text === "endl" || text === "lend") {
        this.tokens.get();
        return <LoopEndStatement>{
          type: "LoopEndStatement",
        };
      }
      if (text === "while") {
        this.tokens.get();
        return this.parseWhileStatement();
      }
      if (text === "endw" || text === "wend") {
        this.tokens.get();
        return <WhileEndStatement>{
          type: "WhileEndStatement",
        };
      }
      if (text === "repeat") {
        this.tokens.get();
        return <RepeatStatement>{
          type: "RepeatStatement",
          isBlock: true,
        };
      }
      if (text === "until") {
        this.tokens.get();
        return this.parseUntilStatement();
      }
      if (text === "proc") {
        this.tokens.get();
        return <ProcStatement>{
          type: "ProcStatement",
          isBlock: true,
        };
      }
      if (text === "endp" || text === "pend") {
        this.tokens.get();
        return <ProcEndStatement>{
          type: "ProcEndStatement",
        };
      }
      if (text === "else") {
        this.tokens.get();
        return <ElseStatement>{
          type: "ElseStatement",
        };
      }
      if (text === "elif") {
        this.tokens.get();
        return this.parseElseIfStatement();
      }
      if (text === "break") {
        this.tokens.get();
        return <BreakStatement>{
          type: "BreakStatement",
        };
      }
      if (text === "continue") {
        this.tokens.get();
        return <ContinueStatement>{
          type: "ContinueStatement",
        };
      }
      if (text === "ends") {
        this.tokens.get();
        return <StructEndStatement>{
          type: "StructEndStatement",
        };
      }
      if (text === "next") {
        this.tokens.get();
        return <NextStatement>{
          type: "NextStatement",
        };
      }
      return this.parseMacroOrStructInvocation();
    }
    if (start.type === TokenType.GoesTo) {
      return this.parseFieldAssignment();
    }
    this.reportError("Z1002", start, [start.text]);
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
  private parsePragma(parsePoint: ParsePoint): PartialZ80AssemblyLine | null {
    const { start } = parsePoint;

    // --- Skip the pragma token
    this.tokens.get();
    switch (start.type) {
      case TokenType.OrgPragma:
        const orgExpr = this.getExpression();
        return <OrgPragma>{
          type: "OrgPragma",
          address: orgExpr,
        };
      case TokenType.BankPragma:
        const bankExpr = this.getExpression();
        const bankOffsExpr = this.getExpression(true, true);
        return <BankPragma>{
          type: "BankPragma",
          bankId: bankExpr,
          offset: bankOffsExpr,
        };
      case TokenType.XorgPragma:
        const xorgExpr = this.getExpression();
        return <XorgPragma>{
          type: "XorgPragma",
          address: xorgExpr,
        };
      case TokenType.EntPragma:
        const entExpr = this.getExpression();
        return <EntPragma>{
          type: "EntPragma",
          address: entExpr,
        };
      case TokenType.XentPragma:
        const xentExpr = this.getExpression();
        return <XentPragma>{
          type: "XentPragma",
          address: xentExpr,
        };
      case TokenType.EquPragma:
        const equExpr = this.getExpression();
        return <EquPragma>{
          type: "EquPragma",
          value: equExpr,
        };
      case TokenType.VarPragma:
      case TokenType.Assign:
        const varExpr = this.getExpression();
        return <VarPragma>{
          type: "VarPragma",
          value: varExpr,
        };
      case TokenType.DispPragma:
        const dispExpr = this.getExpression();
        return <DispPragma>{
          type: "DispPragma",
          offset: dispExpr,
        };
      case TokenType.DefbPragma:
        const defbExprs = this.getExpressionList(true);
        return <DefBPragma>{
          type: "DefBPragma",
          values: defbExprs,
        };
      case TokenType.DefwPragma:
        const defwExprs = this.getExpressionList(true);
        return <DefWPragma>{
          type: "DefWPragma",
          values: defwExprs,
        };
        break;
      case TokenType.DefmPragma:
        const defmExpr = this.getExpression();
        return <DefMPragma>{
          type: "DefMPragma",
          value: defmExpr,
        };
      case TokenType.DefnPragma:
        const defnExpr = this.getExpression();
        return <DefNPragma>{
          type: "DefNPragma",
          value: defnExpr,
        };
      case TokenType.DefhPragma:
        const defhExpr = this.getExpression();
        return <DefHPragma>{
          type: "DefHPragma",
          value: defhExpr,
        };
      case TokenType.DefgxPragma:
        const defgxExpr = this.getExpression();
        return <DefGxPragma>{
          type: "DefGxPragma",
          pattern: defgxExpr,
        };
      case TokenType.DefgPragma:
        let pattern = "";
        let fspace = start.text.indexOf(" ");
        if (fspace < 0) {
          fspace = start.text.indexOf("\t");
        }
        if (fspace >= 0 && fspace < start.text.length - 1) {
          pattern = start.text.substr(fspace + 1);
        }
        return <DefGPragma>{
          type: "DefGPragma",
          pattern,
        };
      case TokenType.DefcPragma:
        const defcExpr = this.getExpression();
        return <DefCPragma>{
          type: "DefCPragma",
          value: defcExpr,
        };
      case TokenType.SkipPragma:
        const skipExpr = this.getExpression();
        const skipFillExpr = this.getExpression(true, true);
        return <SkipPragma>{
          type: "SkipPragma",
          skip: skipExpr,
          fill: skipFillExpr,
        };
      case TokenType.ExternPragma:
        return <ExternPragma>{
          type: "ExternPragma",
        };
      case TokenType.DefsPragma:
        const defsExpr = this.getExpression();
        const defsFillExpr = this.getExpression(true, true);
        return <DefSPragma>{
          type: "DefSPragma",
          count: defsExpr,
          fill: defsFillExpr,
        };
      case TokenType.FillbPragma:
        const fillbExpr = this.getExpression();
        const fillValbExpr = this.getExpression(false, true);
        return <FillbPragma>{
          type: "FillbPragma",
          count: fillbExpr,
          fill: fillValbExpr,
        };
      case TokenType.FillwPragma:
        const fillwExpr = this.getExpression();
        const fillValwExpr = this.getExpression(false, true);
        return <FillwPragma>{
          type: "FillwPragma",
          count: fillwExpr,
          fill: fillValwExpr,
        };
      case TokenType.ModelPragma:
        const nextToken = this.tokens.peek();
        let modelId: string | null = null;
        if (
          nextToken.type === TokenType.Identifier ||
          nextToken.type === TokenType.Next
        ) {
          modelId = nextToken.text;
          this.tokens.get();
        } else {
          this.reportError("Z1004");
        }
        return <ModelPragma>{
          type: "ModelPragma",
          modelId,
        };
      case TokenType.AlignPragma:
        const alignExpr = this.getExpression(true);
        return <AlignPragma>{
          type: "AlignPragma",
          alignExpr: alignExpr,
        };
      case TokenType.TracePragma:
        const traceExprs = this.getExpressionList(true);
        return <TracePragma>{
          type: "TracePragma",
          isHex: false,
          values: traceExprs,
        };
      case TokenType.TraceHexPragma:
        const traceHexExprs = this.getExpressionList(true);
        return <TracePragma>{
          type: "TracePragma",
          isHex: true,
          values: traceHexExprs,
        };
      case TokenType.RndSeedPragma:
        const rndSeedExpr = this.getExpression(true);
        return <RndSeedPragma>{
          type: "RndSeedPragma",
          seedExpr: rndSeedExpr,
        };
      case TokenType.ErrorPragma:
        const errorExpr = this.getExpression();
        return <ErrorPragma>{
          type: "ErrorPragma",
          message: errorExpr,
        };
      case TokenType.IncludeBinPragma:
        const incBinExpr = this.getExpression();
        const incBinOffsExpr = this.getExpression(true, true);
        const incBinLenExpr = incBinOffsExpr
          ? this.getExpression(true, true)
          : null;
        return <IncBinPragma>{
          type: "IncBinPragma",
          filename: incBinExpr,
          offset: incBinOffsExpr,
          length: incBinLenExpr,
        };
      case TokenType.CompareBinPragma:
        const compBinExpr = this.getExpression();
        const compBinOffsExpr = this.getExpression(true, true);
        const compBinLenExpr = compBinOffsExpr
          ? this.getExpression(true, true)
          : null;
        return <CompareBinPragma>{
          type: "CompareBinPragma",
          filename: compBinExpr,
          offset: compBinOffsExpr,
          length: compBinLenExpr,
        };
      case TokenType.ZxBasicPragma:
        return <ZxBasicPragma>{
          type: "ZxBasicPragma",
        };
      case TokenType.InjectOptPragma:
        const optId = this.getIdentifier();
        return <InjectOptPragma>{
          type: "InjectOptPragma",
          identifier: optId,
        };
    }
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
    return traits.simple
      ? this.parseSimpleInstruction(parsePoint)
      : this.parseCompoundInstruction(parsePoint);
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
    const { start } = parsePoint;
    const parser = this;
    this.tokens.get();
    switch (start.type) {
      case TokenType.Ld:
        return twoOperands<LdInstruction>("LdInstruction");

      case TokenType.Inc:
        return <IncInstruction>oneOperand("IncInstruction");

      case TokenType.Dec:
        return <DecInstruction>oneOperand("DecInstruction");

      case TokenType.Ex:
        return twoOperands<ExInstruction>("ExInstruction");

      case TokenType.Add:
        return twoOperands<AddInstruction>("AddInstruction");

      case TokenType.Adc:
        return twoOperands<AdcInstruction>("AdcInstruction");

      case TokenType.Sub:
        return oneOrTwoOperands<SubInstruction>("SubInstruction");

      case TokenType.Sbc:
        return twoOperands<SbcInstruction>("SbcInstruction");

      case TokenType.And:
        return oneOrTwoOperands<AndInstruction>("AndInstruction");

      case TokenType.Xor:
        return oneOrTwoOperands<XorInstruction>("XorInstruction");

      case TokenType.Or:
        return oneOrTwoOperands<OrInstruction>("OrInstruction");

      case TokenType.Cp:
        return oneOrTwoOperands<CpInstruction>("CpInstruction");

      case TokenType.Djnz:
        const djnzTarget = this.getExpression();
        return <DjnzInstruction>{
          type: "DjnzInstruction",
          target: djnzTarget,
        };

      case TokenType.Jr:
        const jrNext = this.tokens.peek();
        const jrTrait = getTokenTraits(jrNext.type);
        let jrCondition: string | undefined = undefined;
        if (jrTrait.condition) {
          jrCondition = jrNext.text.toLowerCase();
          this.tokens.get();
          this.expectToken(TokenType.Comma, "Z1007");
        }
        return <JrInstruction>{
          type: "JrInstruction",
          condition: jrCondition,
          target: this.getExpression(),
        };

      case TokenType.Jp:
        const jpNext = this.tokens.peek();
        const jpTrait = getTokenTraits(jpNext.type);
        let condition: string | undefined;
        if (jpTrait.condition) {
          condition = jpNext.text.toLowerCase();
          this.tokens.get();
          this.expectToken(TokenType.Comma, "Z1007");
        }
        return <JpInstruction>{
          type: "JpInstruction",
          condition,
          target: this.getOperand()
        };

      case TokenType.Call:
        const callNext = this.tokens.peek();
        const callTrait = getTokenTraits(callNext.type);
        let callCondition: string | undefined = undefined;
        if (callTrait.condition) {
          callCondition = callNext.text.toLowerCase();
          this.tokens.get();
          this.expectToken(TokenType.Comma, "Z1007");
        }
        return <CallInstruction>{
          type: "CallInstruction",
          condition: callCondition,
          target: this.getExpression(),
        };

      case TokenType.Ret:
        const retNext = this.tokens.peek();
        const retTrait = getTokenTraits(retNext.type);
        let retCondition: string | undefined = undefined;
        if (retTrait.condition) {
          retCondition = retNext.text.toLowerCase();
          this.tokens.get();
        }
        return <RetInstruction>{
          type: "RetInstruction",
          condition: retCondition,
        };

      case TokenType.Rst:
        const rstTarget = this.getExpression();
        return <RstInstruction>{
          type: "RstInstruction",
          target: rstTarget,
        };

      case TokenType.Push:
        return <PushInstruction>oneOperand("PushInstruction");

      case TokenType.Pop:
        return <PopInstruction>oneOperand("PopInstruction");

      case TokenType.In:
        return oneOrTwoOperands<InInstruction>("InInstruction");

      case TokenType.Out:
        return oneOrTwoOperands<OutInstruction>("OutInstruction");

      case TokenType.Im:
        const mode = this.getExpression();
        return <ImInstruction>{
          type: "ImInstruction",
          mode,
        };

      case TokenType.Rlc:
        return oneOrTwoOperands<RlcInstruction>("RlcInstruction");

      case TokenType.Rrc:
        return oneOrTwoOperands<RrcInstruction>("RrcInstruction");

      case TokenType.Rl:
        return oneOrTwoOperands<RlInstruction>("RlInstruction");

      case TokenType.Rr:
        return oneOrTwoOperands<RrInstruction>("RrInstruction");

      case TokenType.Sla:
        return oneOrTwoOperands<SlaInstruction>("SlaInstruction");

      case TokenType.Sra:
        return oneOrTwoOperands<SraInstruction>("SraInstruction");

      case TokenType.Sll:
        return oneOrTwoOperands<SllInstruction>("SllInstruction");

      case TokenType.Srl:
        return oneOrTwoOperands<SrlInstruction>("SrlInstruction");

      case TokenType.Bit:
        return twoOperands<BitInstruction>("BitInstruction");

      case TokenType.Res:
        return twoOrThreeOperands<ResInstruction>("ResInstruction");

      case TokenType.Set:
        return twoOrThreeOperands<SetInstruction>("SetInstruction");

      case TokenType.Mul:
        parser.expectToken(TokenType.D, "Z1011");
        parser.expectToken(TokenType.Comma, "Z1007");
        parser.expectToken(TokenType.E, "Z1012");
        return <SimpleZ80Instruction>{
          type: "SimpleZ80Instruction",
          mnemonic: "mul"
        };

      case TokenType.Mirror:
        this.expectToken(TokenType.A, "Z1010");
        return <SimpleZ80Instruction>{
          type: "SimpleZ80Instruction",
          mnemonic: "mirror"
        };

      case TokenType.NextReg:
        const nextReg = this.getExpression();
        let nextRegValue = null;
        if (this.skipToken(TokenType.Comma)) {
          const valueToken = this.tokens.peek();
          if (valueToken.type === TokenType.A) {
            this.tokens.get();
          } else {
            nextRegValue = this.getExpression();
          }
        }
        return <NextRegInstruction>{
          type: "NextRegInstruction",
          register: nextReg,
          value: nextRegValue,
        };

      case TokenType.Test:
        return <TestInstruction>{
          type: "TestInstruction",
          expr: this.getExpression(),
        };

      case TokenType.Bsla:
        return expectDeAndA("bsla");

      case TokenType.Bsra:
        return expectDeAndA("bsra");

      case TokenType.Bsrl:
        return expectDeAndA("bsrl");

      case TokenType.Bsrf:
        return expectDeAndA("bsrf");

      case TokenType.Brlc:
        return expectDeAndA("brlc");
    }
    return null;

    function oneOperand<T extends Z80InstructionWithOneOperand>(
      instrType: Node["type"]
    ): T | null {
      return <T>{
        type: instrType,
        operand: parser.getOperand(),
      };
    }

    function twoOperands<T extends Z80InstructionWithTwoOperands>(
      instrType: Node["type"]
    ): T | null {
      const operand1 = parser.getOperand();
      parser.expectToken(TokenType.Comma, "Z1007");
      const operand2 = parser.getOperand();
      return <T>{
        type: instrType,
        operand1,
        operand2,
      };
    }

    function oneOrTwoOperands<T extends Z80InstructionWithOneOrTwoOperands>(
      instrType: Node["type"]
    ): T | null {
      const operand1 = parser.getOperand();
      let operand2: Operand | undefined = undefined;
      if (parser.skipToken(TokenType.Comma)) {
        operand2 = parser.getOperand();
      }
      return <T>{
        type: instrType,
        operand1,
        operand2,
      };
    }

    function twoOrThreeOperands<T extends Z80InstructionWithTwoOrThreeOperands>(
      instrType: Node["type"]
    ): T | null {
      const operand1 = parser.getOperand();
      parser.expectToken(TokenType.Comma, "Z1007");
      const operand2 = parser.getOperand();
      let operand3: Operand | undefined = undefined;
      if (parser.skipToken(TokenType.Comma)) {
        operand3 = parser.getOperand();
      }
      return <T>{
        type: instrType,
        operand1,
        operand2,
        operand3,
      };
    }

    function expectDeAndA(mnemonic: string): SimpleZ80Instruction {
      parser.expectToken(TokenType.DE, "Z1008");
      parser.expectToken(TokenType.Comma, "Z1007");
      parser.expectToken(TokenType.B, "Z1009");
      return <SimpleZ80Instruction>{
        type: "SimpleZ80Instruction",
        mnemonic,
      };
    }
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
        return createDirectiveWithId<IfModDirective>("IfModDirective");
      case TokenType.IfNModDir:
        return createDirectiveWithId<IfNModDirective>("IfNModDirective");
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
        return createIfDirective();
      case TokenType.IncludeDir:
        return createIncludeDirective();
      case TokenType.LineDir:
        return createLineDirective();
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

    function createIfDirective(): PartialZ80AssemblyLine | null {
      parser.tokens.get();
      return <IfDirective>{
        type: "IfDirective",
        condition: parser.getExpression(),
      };
    }

    function createIncludeDirective(): PartialZ80AssemblyLine | null {
      parser.tokens.get();
      const token = parser.skipToken(TokenType.StringLiteral);
      if (token) {
        const literal = parser.parseStringLiteral(token.text);
        return <IncludeDirective>{
          type: "IncludeDirective",
          filename: literal.value,
        };
      }
      parser.reportError("Z1006");
      return null;
    }

    function createLineDirective(): PartialZ80AssemblyLine | null {
      parser.tokens.get();
      const expr = parser.getExpression();

      let stringValue: string | null = null;
      let token = parser.skipToken(TokenType.Comma);
      if (token) {
        token = parser.skipToken(TokenType.StringLiteral);
        if (token) {
          const literal = parser.parseStringLiteral(token.text);
          stringValue = literal.value;
        } else {
          parser.reportError("Z1006");
          return null;
        }
      }
      return <LineDirective>{
        type: "LineDirective",
        lineNumber: expr,
        lineComment: stringValue,
      };
    }
  }

  /**
   * Parses an operand
   */
  private parseOperand(): Operand | null {
    const { start, traits } = this.getParsePoint();

    // --- Check registers
    if (traits.reg) {
      // --- We have a register operand
      this.tokens.get();
      const register = start.text.toLowerCase();
      let operandType = OperandType.Reg8;
      if (traits.reg8Spec) {
        operandType = OperandType.Reg8Spec;
      } else if (traits.reg8Idx) {
        operandType = OperandType.Reg8Idx;
      } else if (traits.reg16) {
        operandType = OperandType.Reg16;
      } else if (traits.reg16Idx) {
        operandType = OperandType.Reg16Idx;
      } else if (traits.reg16Spec) {
        operandType = OperandType.Reg16Spec;
      }
      return <Operand>{
        type: "Operand",
        operandType,
        register,
      };
    }

    // --- Check NONEARG
    if (start.type === TokenType.NoneArg) {
      this.tokens.get();
      return <Operand>{
        type: "Operand",
        operandType: OperandType.NoneArg,
      };
    }

    // --- Check for HREG/LREG operation
    if (start.type === TokenType.HReg || start.type === TokenType.LReg) {
      this.tokens.get();
      const regOperation = start.text.toLowerCase();
      this.expectToken(TokenType.LPar, "Z1013");
      const argToken = this.tokens.peek();
      const traits = getTokenTraits(argToken.type);
      let register: string | undefined = undefined;
      let macroParam: IdentifierNode | undefined = undefined;
      if (argToken.type === TokenType.LDBrac) {
        // Macro parameter
        this.tokens.get();
        macroParam = this.getIdentifier();
        this.expectToken(TokenType.RDBrac, "Z1015");
      } else if (traits.reg16 || traits.reg16Idx) {
        // 16-bit register
        this.tokens.get();
        register = argToken.text.toLowerCase();
      }
      this.expectToken(TokenType.RPar, "Z1014");
      return <Operand>{
        type: "Operand",
        operandType: OperandType.RegOperation,
        regOperation,
        register,
        macroParam,
      };
    }

    // --- Check for "("
    if (start.type === TokenType.LPar) {
      const ahead = this.tokens.ahead(1);
      const traits = getTokenTraits(ahead.type);
      if (ahead.type === TokenType.C) {
        // C port
        this.tokens.get();
        this.tokens.get();
        this.expectToken(TokenType.RPar, "Z1014");
        return <Operand>{
          type: "Operand",
          operandType: OperandType.CPort,
        };
      }
      if (traits.reg16) {
        // 16-bit register indirection
        this.tokens.get();
        this.tokens.get();
        this.expectToken(TokenType.RPar, "Z1014");
        return <Operand>{
          type: "Operand",
          operandType: OperandType.RegIndirect,
          register: ahead.text.toLowerCase(),
        };
      }
      if (traits.reg16Idx) {
        // 16-bit index register indirection
        this.tokens.get();
        this.tokens.get();
        let expr: Expression | undefined = undefined;
        const register = ahead.text.toLowerCase();
        let sign = this.tokens.peek();
        let offsetSign =
          sign.type === TokenType.Plus || sign.type === TokenType.Minus
            ? sign.text
            : undefined;
        if (offsetSign) {
          this.tokens.get();
          expr = this.getExpression();
          sign = this.tokens.peek();
        }
        this.expectToken(TokenType.RPar, "Z1014");
        return <Operand>{
          type: "Operand",
          operandType: OperandType.IndexedIndirect,
          register,
          offsetSign,
          expr,
        };
      }
      if (traits.expressionStart) {
        // Memory indirection
        this.tokens.get();
        const expr = this.getExpression();
        this.expectToken(TokenType.RPar, "Z1014");
        return <Operand>{
          type: "Operand",
          operandType: OperandType.MemIndirect,
          expr,
        };
      }
    }

    // --- Check for an expression
    if (traits.expressionStart) {
      // Expression
      return <Operand>{
        type: "Operand",
        operandType: OperandType.Expression,
        expr: this.getExpression(),
      };
    }

    // --- It's not an operand
    return null;
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
  parseExpr(): Expression | null {
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
    const { start } = parsePoint;
    this.tokens.get();
    if (start.type === TokenType.Macro) {
      return this.parseMacroStatement();
    }
    if (start.type === TokenType.Endm) {
      return <MacroEndStatement>{
        type: "MacroEndStatement",
      };
    }

    if (start.type === TokenType.Loop) {
      return this.parseLoopStatement();
    }
    if (start.type === TokenType.Endl) {
      return <LoopEndStatement>{
        type: "LoopEndStatement",
      };
    }

    if (start.type === TokenType.While) {
      return this.parseWhileStatement();
    }
    if (start.type === TokenType.Endw) {
      return <WhileEndStatement>{
        type: "WhileEndStatement",
      };
    }

    if (start.type === TokenType.Repeat) {
      return <RepeatStatement>{
        type: "RepeatStatement",
        isBlock: true,
      };
    }
    if (start.type === TokenType.Until) {
      return this.parseUntilStatement();
    }

    if (start.type === TokenType.Proc) {
      return <ProcStatement>{
        type: "ProcStatement",
        isBlock: true,
      };
    }
    if (start.type === TokenType.Endp) {
      return <ProcEndStatement>{
        type: "ProcEndStatement",
      };
    }

    if (start.type === TokenType.If) {
      return this.parseIfStatement();
    }
    if (start.type === TokenType.IfUsed) {
      return this.parseIfUsedStatement();
    }
    if (start.type === TokenType.IfNUsed) {
      return this.parseIfNUsedStatement();
    }
    if (start.type === TokenType.Else) {
      return <ElseStatement>{
        type: "ElseStatement",
      };
    }
    if (start.type === TokenType.Endif) {
      return <EndIfStatement>{
        type: "EndIfStatement",
      };
    }
    if (start.type === TokenType.Elif) {
      return this.parseElseIfStatement();
    }

    if (start.type === TokenType.Break) {
      return <BreakStatement>{
        type: "BreakStatement",
      };
    }
    if (start.type === TokenType.Continue) {
      return <ContinueStatement>{
        type: "ContinueStatement",
      };
    }

    if (start.type === TokenType.Module) {
      return this.parseModuleStatement();
    }
    if (start.type === TokenType.EndModule) {
      return <ModuleEndStatement>{
        type: "ModuleEndStatement",
      };
    }

    if (start.type === TokenType.Struct) {
      return <StructStatement>{
        type: "StructStatement",
        isBlock: true,
      };
    }
    if (start.type === TokenType.Ends) {
      return <StructEndStatement>{
        type: "StructEndStatement",
      };
    }
    if (start.type === TokenType.Local) {
      return this.parseLocalStatement();
    }

    if (start.type === TokenType.For) {
      return this.parseForStatement();
    }
    if (start.type === TokenType.Next) {
      return <NextStatement>{
        type: "NextStatement",
      };
    }
    return null;
  }

  /**
   * macroStatement
   *   : "macro" "(" Identifier? ( "," Identifier)* ")"
   */
  private parseMacroStatement(): PartialZ80AssemblyLine | null {
    this.expectToken(TokenType.LPar, "Z1013");
    const parameters = this.getIdentifierNodeList();
    this.expectToken(TokenType.RPar, "Z1014");
    return <MacroStatement>{
      type: "MacroStatement",
      isBlock: true,
      parameters,
    };
  }

  /**
   * loopStatement
   *   : ".loop" expression
   */
  private parseLoopStatement(): PartialZ80AssemblyLine | null {
    return <LoopStatement>{
      type: "LoopStatement",
      isBlock: true,
      expr: this.getExpression(),
    };
  }

  /**
   * whileStatement
   *   : ".while" expression
   */
  private parseWhileStatement(): PartialZ80AssemblyLine | null {
    return <WhileStatement>{
      type: "WhileStatement",
      isBlock: true,
      expr: this.getExpression(),
    };
  }

  /**
   * untilStatement
   *   : ".until" expression
   */
  private parseUntilStatement(): PartialZ80AssemblyLine | null {
    return <UntilStatement>{
      type: "UntilStatement",
      expr: this.getExpression(),
    };
  }

  /**
   * ifStatement
   *   : ".if" expression
   */
  private parseIfStatement(): PartialZ80AssemblyLine | null {
    return <IfStatement>{
      type: "IfStatement",
      isBlock: true,
      expr: this.getExpression(),
    };
  }

  /**
   * ifUsedStatement
   *   : ".ifused" expression
   */
  private parseIfUsedStatement(): PartialZ80AssemblyLine | null {
    const parsePoint = this.getParsePoint();
    const symbol = this.parseSymbol(parsePoint);
    return <IfUsedStatement>{
      type: "IfUsedStatement",
      isBlock: true,
      symbol,
    };
  }

  /**
   * ifNUsedStatement
   *   : ".ifnused" expression
   */
  private parseIfNUsedStatement(): PartialZ80AssemblyLine | null {
    const parsePoint = this.getParsePoint();
    const symbol = this.parseSymbol(parsePoint);
    return <IfNUsedStatement>{
      type: "IfNUsedStatement",
      isBlock: true,
      symbol,
    };
  }

  /**
   * elseIfStatement
   *   : ".elseif" expression
   */
  private parseElseIfStatement(): PartialZ80AssemblyLine | null {
    return <ElseIfStatement>{
      type: "ElseIfStatement",
      expr: this.getExpression(),
    };
  }

  /**
   * moduleStatement
   *   : ".loop" expression
   */
  private parseModuleStatement(): PartialZ80AssemblyLine | null {
    let identifier: IdentifierNode | undefined = undefined;
    const idToken = this.tokens.peek();
    if (idToken.type === TokenType.Identifier) {
      identifier = this.getIdentifier();
    }
    return <ModuleStatement>{
      type: "ModuleStatement",
      isBlock: true,
      identifier,
    };
  }

  /**
   * localStatement
   *   : ".local" Identifier ("," Identifier)*
   */
  private parseLocalStatement(): PartialZ80AssemblyLine | null {
    const identifiers = this.getIdentifierNodeList();
    if (identifiers.length === 0) {
      this.reportError("Z1004");
    }
    return <LocalStatement>{
      type: "LocalStatement",
      identifiers,
    };
  }

  /**
   * forStatement
   *   : ".for" identifier "=" expression ".to" expression ( ".step" expression )?
   */
  private parseForStatement(): PartialZ80AssemblyLine | null {
    const identifier = this.getIdentifier();
    this.expectToken(TokenType.Assign, "Z1019");
    const startExpr = this.getExpression();
    this.expectToken(TokenType.To, "Z1020");
    const toExpr = this.getExpression();
    let stepExpr: Expression | undefined = undefined;
    if (this.tokens.peek().type === TokenType.Step) {
      this.tokens.get();
      stepExpr = this.getExpression();
    }
    return <ForStatement>{
      type: "ForStatement",
      isBlock: true,
      identifier,
      startExpr,
      toExpr,
      stepExpr,
    };
  }

  /**
   * macroOrStructInvocation
   *   : Identifier "(" macroArgument ("," macroArgument)* ")"
   *   ;
   */
  private parseMacroOrStructInvocation(): PartialZ80AssemblyLine | null {
    const identifier = this.getIdentifier();
    this.expectToken(TokenType.LPar, "Z1013");
    const operands: Operand[] = [];
    if (this.tokens.peek().type !== TokenType.RPar) {
      operands.push(this.getOperand());
      while (this.skipToken(TokenType.Comma)) {
        operands.push(this.getOperand());
      }
    }
    this.expectToken(TokenType.RPar, "Z1014");
    return <MacroOrStructInvocation>{
      type: "MacroOrStructInvocation",
      identifier,
      operands,
    };
  }

  /**
   * fieldAssignment
   *   : "->" byteEmPragma
   *   ;
   */
  private parseFieldAssignment(): PartialZ80AssemblyLine | null {
    this.tokens.get();
    const parsePoint = this.getParsePoint();
    const { start } = parsePoint;
    switch (start.type) {
      case TokenType.DefbPragma:
      case TokenType.DefwPragma:
      case TokenType.DefcPragma:
      case TokenType.DefmPragma:
      case TokenType.DefnPragma:
      case TokenType.DefhPragma:
      case TokenType.DefsPragma:
      case TokenType.FillbPragma:
      case TokenType.FillwPragma:
      case TokenType.DefgPragma:
      case TokenType.DefgxPragma:
        return <FieldAssignment>{
          type: "FieldAssignment",
          assignment: this.parsePragma(parsePoint),
        };
      default:
        this.reportError("Z1021");
        return null;
    }
  }

  /**
   * parExpr
   *   : "(" expr ")"
   *   ;
   */
  private parseParExpr(): Expression | null {
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
  private parseBrackExpr(): Expression | null {
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
  private parseCondExpr(): Expression | null {
    const condExpr = this.parseOrExpr();
    if (!condExpr) {
      return null;
    }

    if (!this.skipToken(TokenType.QuestionMark)) {
      return condExpr;
    }

    const trueExpr = this.getExpression();
    this.expectToken(TokenType.Colon);
    const falseExpr = this.getExpression();

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
  private parseOrExpr(): Expression | null {
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
  private parseXorExpr(): Expression | null {
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
  private parseAndExpr(): Expression | null {
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
  private parseEquExpr(): Expression | null {
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
  private parseRelExpr(): Expression | null {
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
  private parseShiftExpr(): Expression | null {
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
  private parseAddExpr(): Expression | null {
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
  private parseMultExpr(): Expression | null {
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
  private parseMinMaxExpr(): Expression | null {
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
  private parsePrimaryExpr(): Expression | null {
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
          ? this.parseFunctionInvocation()
          : this.parseSymbol(parsePoint);
      case TokenType.DoubleColon:
        return this.parseSymbol(parsePoint);
      case TokenType.Plus:
      case TokenType.Minus:
      case TokenType.BinaryNot:
      case TokenType.Exclamation:
        return this.parseUnaryExpr(parsePoint);
      case TokenType.LDBrac:
        return this.parseMacroParam();
    }
    return null;
  }

  /**
   *
   * @param parsePoint
   */
  private parseBuiltInFuncInvocation(
    parsePoint: ParsePoint
  ): Expression | null {
    const { start } = parsePoint;
    this.tokens.get();
    if (start.type === TokenType.TextOf || start.type === TokenType.LTextOf) {
      this.expectToken(TokenType.LPar, "Z1013");
      const argToken = this.tokens.peek();
      const traits = getTokenTraits(argToken.type);
      let mnemonic: string | undefined;
      let regsOrConds: string | undefined;
      let macroParam: IdentifierNode | undefined;
      if (traits.instruction) {
        mnemonic = argToken.text.toLowerCase();
        this.tokens.get();
      } else if (traits.reg || traits.condition) {
        regsOrConds = argToken.text.toLowerCase();
        this.tokens.get();
      } else if (argToken.type === TokenType.LDBrac) {
        const param = this.parseMacroParam();
        macroParam = param.identifier;
      } else if (argToken.type === TokenType.LPar) {
        this.tokens.get();
        const reg16 = this.tokens.peek();
        const reg16Traits = getTokenTraits(reg16.type);
        if (reg16Traits.reg16) {
          this.tokens.get();
          regsOrConds = `(${reg16.text.toLowerCase()})`;
        } else {
          this.reportError("Z1022");
        }
        this.expectToken(TokenType.RPar, "Z1014");
      }
      this.expectToken(TokenType.RPar, "Z1014");
      return <BuiltInFunctionInvocation>{
        type: "BuiltInFunctionInvocation",
        functionName: start.text.toLowerCase(),
        mnemonic,
        regsOrConds,
        macroParam,
      };
    }
    this.expectToken(TokenType.LPar, "Z1013");
    const operand = this.getOperand();
    this.expectToken(TokenType.RPar, "Z1014");
    return <BuiltInFunctionInvocation>{
      type: "BuiltInFunctionInvocation",
      functionName: start.text.toLowerCase(),
      operand,
    };
  }

  /**
   * functionInvocation
   *   : identifier "(" expression? ("," expression)* ")"
   */
  private parseFunctionInvocation(): Expression | null {
    const functionName = this.getIdentifier();
    this.expectToken(TokenType.LPar, "Z1013");
    const args = this.getExpressionList(false);
    this.expectToken(TokenType.RPar, "Z1014");
    return <FunctionInvocation>{
      type: "FunctionInvocation",
      functionName,
      args,
    };
  }

  /**
   * symbol
   *   : "::"? Identifier
   *   ;
   */
  private parseSymbol(parsePoint: ParsePoint): Expression | null {
    let startsFromGlobal = false;
    if (this.skipToken(TokenType.DoubleColon)) {
      startsFromGlobal = true;
      parsePoint = this.getParsePoint();
    }
    if (parsePoint.start.type === TokenType.Identifier) {
      const identifier = this.getIdentifier();
      return <Symbol>{
        type: "Symbol",
        startsFromGlobal,
        identifier,
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

    const operand = this.getExpression();
    return <UnaryExpression>{
      type: "UnaryExpression",
      operator,
      operand,
    };
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
  private parseLiteral(parsePoint: ParsePoint): Expression | null {
    const { start } = parsePoint;
    let literal: Expression | null = null;
    switch (start.type) {
      case TokenType.BinaryLiteral:
        literal = this.parseBinaryLiteral(start.text);
        break;
      case TokenType.OctalLiteral:
        literal = this.parseOctalLiteral(start.text);
        break;
      case TokenType.DecimalLiteral:
        literal = this.parseDecimalLiteral(start.text);
        break;
      case TokenType.HexadecimalLiteral:
        literal = this.parseHexadecimalLiteral(start.text);
        break;
      case TokenType.RealLiteral:
        literal = this.parseRealLiteral(start.text);
        break;
      case TokenType.CharLiteral:
        literal = this.parseCharLiteral(start.text);
        break;
      case TokenType.StringLiteral:
        literal = this.parseStringLiteral(start.text);
        break;
      case TokenType.True:
        literal = <BooleanLiteral>{
          type: "BooleanLiteral",
          value: true,
        };
        break;
      case TokenType.False:
        literal = <BooleanLiteral>{
          type: "BooleanLiteral",
          value: false,
        };
        break;
      case TokenType.CurAddress:
      case TokenType.Dot:
      case TokenType.Multiplication:
        literal = <CurrentAddressLiteral>{
          type: "CurrentAddressLiteral",
        };
        break;
      case TokenType.CurCnt:
        literal = <CurrentCounterLiteral>{
          type: "CurrentCounterLiteral",
        };
        break;
    }
    if (literal) {
      // --- Skip the parsed literal
      this.tokens.get();
    }
    return literal;
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
      value: convertSpectrumString(text),
    };
  }

  private parseStringLiteral(text: string): StringLiteral | null {
    text = text.substr(1, text.length - 2);
    return <StringLiteral>{
      type: "StringLiteral",
      value: convertSpectrumString(text),
    };
  }

  // --------------------------------------------------------------------------
  // Miscellaneous

  /**
   * macroParam
   *   : "{{" Identifier "}}"
   *   ;
   */
  private parseMacroParam(): MacroParameter | null {
    this.tokens.get();
    const identifier = this.getIdentifier();
    this.expectToken(TokenType.RDBrac, "Z1015");
    return <MacroParameter>{
      type: "MacroParameter",
      identifier,
    };
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
  private expectToken(
    type: TokenType,
    errorCode?: ErrorCodes,
    allowEof?: boolean
  ) {
    const next = this.tokens.peek();
    if (next.type === type || (allowEof && next.type === TokenType.Eof)) {
      // --- Skip the expected token
      this.tokens.get();
      return;
    }

    this.reportError(errorCode ?? "Z1001", next, [next.text]);
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
            `{${idx}}`,
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
    if (token.type !== TokenType.Identifier) {
      return false;
    }
    const text = token.text.toLowerCase();
    return (
      text !== "continue" &&
      text !== "break" &&
      text !== "endm" &&
      text !== "mend" &&
      text !== "endl" &&
      text !== "lend" &&
      text !== "proc" &&
      text !== "endp" &&
      text !== "pend" &&
      text !== "repeat" &&
      text !== "endw" &&
      text !== "wend" &&
      text !== "ends" &&
      text !== "else" &&
      text !== "elif" &&
      text !== "endif" &&
      text !== "while" &&
      text !== "repeat" &&
      text !== "until" &&
      text !== "loop" &&
      text !== "next"
    );
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
      token.type === TokenType.LDBrac ||
      token.type === TokenType.Identifier
    ) {
      return true;
    }

    return false;
  }

  /**
   * Gets an identifier node
   */
  private getIdentifier(): IdentifierNode {
    const idToken = this.tokens.get();
    if (idToken.type !== TokenType.Identifier) {
      this.reportError("Z1004");
    }
    return <IdentifierNode>{
      type: "Identifier",
      name: idToken.text,
      startPosition: idToken.location.startPos,
      endPosition: idToken.location.endPos,
      line: idToken.location.line,
      startColumn: idToken.location.startColumn,
      endColumn: idToken.location.endColumn,
    };
  }

  /**
   * Gets an expression
   * @param optional Is the expression optional?
   * @param leadingComma Test for leading comma?
   */
  private getExpression(
    optional: boolean = false,
    leadingComma: boolean = false
  ): Expression | null {
    if (leadingComma) {
      if (!this.skipToken(TokenType.Comma)) {
        if (!optional) {
          this.reportError("Z1007");
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
      this.reportError("Z1003");
    }
    return null;
  }

  /**
   * Gets a list of expressions
   * @param atLeastOne Is the first expression mandatory?
   */
  private getExpressionList(atLeastOne: boolean): Expression[] {
    const expressions: Expression[] = [];
    const first = this.getExpression(!atLeastOne);
    if (first) {
      expressions.push(first);
    }
    while (this.skipToken(TokenType.Comma)) {
      const next = this.getExpression();
      if (next) {
        expressions.push(next);
      }
    }
    return expressions;
  }

  /**
   * Gets a mandatory operand
   */
  private getOperand(): Operand | null {
    const operand = this.parseOperand();
    if (operand) {
      return operand;
    }
    this.reportError("Z1016");
    return null;
  }

  /**
   * Gets a list of identifiers
   */
  private getIdentifierNodeList(): IdentifierNode[] {
    const expressions: IdentifierNode[] = [];
    if (this.tokens.peek().type === TokenType.Identifier) {
      const first = this.getIdentifier();
      if (first) {
        expressions.push(first);
      }
      while (this.skipToken(TokenType.Comma)) {
        const next = this.getIdentifier();
        if (next) {
          expressions.push(next);
        }
      }
    }
    return expressions;
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

