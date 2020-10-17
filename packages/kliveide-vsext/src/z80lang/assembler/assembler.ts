import * as fs from "fs";
import * as path from "path";

import { ErrorCodes, errorMessages, ParserErrorMessage } from "../errors";
import { InputStream } from "../parser/input-stream";
import { TokenStream } from "../parser/token-stream";

import {
  AdcInstruction,
  AddInstruction,
  AlignPragma,
  AndInstruction,
  BankPragma,
  BitInstruction,
  BreakStatement,
  CallInstruction,
  CompareBinPragma,
  ContinueStatement,
  CpInstruction,
  DecInstruction,
  DefBPragma,
  DefCPragma,
  DefGPragma,
  DefGxPragma,
  DefHPragma,
  DefMPragma,
  DefNPragma,
  DefSPragma,
  DefWPragma,
  Directive,
  DispPragma,
  EntPragma,
  EquPragma,
  ErrorPragma,
  ExInstruction,
  Expression,
  FieldAssignment,
  FillbPragma,
  FillwPragma,
  ForStatement,
  IfLikeStatement,
  IfNUsedStatement,
  IfStatement,
  IfUsedStatement,
  ImInstruction,
  IncBinPragma,
  IncInstruction,
  IncludeDirective,
  InInstruction,
  InjectOptPragma,
  Instruction,
  JpInstruction,
  JrInstruction,
  LabelOnlyLine,
  LdInstruction,
  LocalStatement,
  LoopStatement,
  MacroOrStructInvocation,
  MacroStatement,
  ModelPragma,
  ModuleStatement,
  NextRegInstruction,
  NodePosition,
  Operand,
  OperandType,
  OrgPragma,
  OrInstruction,
  OutInstruction,
  PartialZ80AssemblyLine,
  PopInstruction,
  Pragma,
  ProcStatement,
  PushInstruction,
  RepeatStatement,
  ResInstruction,
  RetInstruction,
  RndSeedPragma,
  RstInstruction,
  SbcInstruction,
  SetInstruction,
  ShiftRotateInstruction,
  SimpleZ80Instruction,
  SkipPragma,
  Statement,
  StructStatement,
  SubInstruction,
  TestInstruction,
  TracePragma,
  UntilStatement,
  VarPragma,
  WhileStatement,
  XentPragma,
  XorgPragma,
  XorInstruction,
  Z80AssemblyLine,
} from "../parser/tree-nodes";
import { Z80AsmParser } from "../parser/z80-asm-parser";
import { convertSpectrumString } from "../utils";
import {
  AssemblerErrorInfo,
  AssemblerOptions,
  AssemblerOutput,
  BinarySegment,
  ListFileItem,
  SourceFileItem,
  SpectrumModelType,
} from "./assembler-in-out";
import {
  BinaryComparisonInfo,
  DefinitionSection,
  FieldDefinition,
  IfDefinition,
  IfSection,
  MacroDefinition,
  StructDefinition,
} from "./assembler-types";
import { AssemblyModule } from "./assembly-module";
import {
  AssemblySymbolInfo,
  ISymbolScope,
  SymbolInfoMap,
  SymbolScope,
  SymbolType,
} from "./assembly-symbols";
import {
  ExpressionEvaluator,
  ExpressionValue,
  ExpressionValueType,
  setRandomSeed,
  SymbolValueMap,
  ValueInfo,
} from "./expressions";
import { FixupEntry, FixupType } from "./fixups";

/**
 * The file name of a direct text compilation
 */
const NO_FILE_ITEM = "#";

/**
 * The valid Spectrum model values
 */
const VALID_MODELS = ["SPECTRUM48", "SPECTRUM128", "SPECTRUMP3", "NEXT"];

/**
 * This class provides the functionality of the Z80 Assembler
 */
export class Z80Assembler extends ExpressionEvaluator {
  // --- Use these options
  private _options: AssemblerOptions;

  // --- Store the current output
  private _output: AssemblerOutput;

  // --- The current module
  private _currentModule: AssemblyModule;

  // --- The current output segment
  private _currentSegment: BinarySegment | null = null;

  // --- The current structure invocation
  private _currentStructInvocation: StructDefinition | null = null;

  // --- Offset of the current structure invocation
  private _currentStructOffset = 0;

  // --- Start offset of the current struct invocation
  private _currentStructStartOffset = 0;

  // --- The current line that invokes the struct
  private _currentStructLine: MacroOrStructInvocation | null = null;

  // --- The current bytes to emit for the structure being invoked
  private _currentStructBytes: Map<number, number> | null = null;

  // --- Checks if the compiler is currently cloning a structure byte pattern
  private _isInStructCloning = false;

  // --- Label that overflew from a label-only line
  private _overflowLabelLine: LabelOnlyLine | null = null;

  // --- The source line of the experession evaluation context
  private _currentSourceLine: Z80AssemblyLine;

  // --- The current list item being processed
  private _currentListFileItem: ListFileItem | null;

  /**
   * The condition symbols
   */
  conditionSymbols: SymbolValueMap = {};

  /**
   * Lines after running the preprocessor
   */
  preprocessedLines: Z80AssemblyLine[] = [];

  /**
   * .comparebin pragma information
   */
  compareBins: BinaryComparisonInfo[] = [];

  /**
   * Store the handler of trace messages
   */
  private _traceHandler: (message: string) => void;

  /**
   * Compiles the Z80 Assembly code in the specified file into Z80
   * binary code.
   * @param filename Z80 assembly source file (absolute path)
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  compileFile(filename: string, options?: AssemblerOptions): AssemblerOutput {
    const sourceText = readSourceFile(filename);
    return this.doCompile(new SourceFileItem(filename), sourceText, options);
  }

  /**
   * Compiles he passed Z80 Assembly code into Z80 binary code.
   * binary code.
   * @param sourceText Z80 assembly source code text
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  compile(sourceText: string, options?: AssemblerOptions): AssemblerOutput {
    return this.doCompile(
      new SourceFileItem(NO_FILE_ITEM),
      sourceText,
      options
    );
  }

  /**
   * Sets the trace handler function
   * @param handler Trace handler function
   */
  setTraceHandler(handler: (message: string) => void): void {
    this._traceHandler = handler;
  }

  /**
   * Tests if the current compilation mode is case sensitive.
   */
  private get isCaseSensitive(): boolean {
    return !!this._options?.useCaseSensitiveSymbols;
  }

  /**
   * Compiles the passed Z80 Assembly code into Z80 binary code.
   * @param sourceItem Represents the source file item to add to the output
   * @param sourceText Z80 assembly source code text
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  private doCompile(
    sourceItem: SourceFileItem,
    sourceText: string,
    options?: AssemblerOptions
  ): AssemblerOutput {
    this._options = options ?? new AssemblerOptions();

    this._currentModule = this._output = new AssemblerOutput(
      sourceItem,
      options?.useCaseSensitiveSymbols ?? false
    );
    this.compareBins = [];

    // --- Prepare pre-defined symbols
    this.conditionSymbols = Object.assign({}, this._options.predefinedSymbols);
    for (const key in this.conditionSymbols) {
      this._currentModule.symbols[key] = {
        name: key,
        type: SymbolType.Var,
        value: this.conditionSymbols[key],
        isModuleLocal: false,
        isShortTerm: false,
        isUsed: false,
      };
    }

    // --- Execute the compilation phases
    let success = false;
    const parseResult = this.executeParse(0, sourceItem, sourceText);
    if (parseResult.success) {
      this.preprocessedLines = parseResult.parsedLines;
      success =
        this.emitCode(this.preprocessedLines) &&
        this.fixupUnresolvedSymbols() &&
        this.compareBinaries();
    }
    if (!success) {
      // --- If failed, clear output segments
      this._output.segments.length = 0;
    }

    // --- Done
    return this._output;
  }

  // ==========================================================================
  // Main compilation methods

  /**
   * Parses the source code passed to the compiler. Executes the preprocessor.
   * @param fileIndex Source file index
   * @param sourceItem Source file item
   * @param sourceText Source code to parse
   * @returns An object with `success` property to indicate compilation success, and
   * a `parsedLines` property with all lines parsed.
   */
  private executeParse(
    fileIndex: number,
    sourceItem: SourceFileItem,
    sourceText: string
  ): {
    success: boolean;
    parsedLines?: Z80AssemblyLine[];
  } {
    // --- Initialize the parse result
    const parsedLines: Z80AssemblyLine[] = [];

    // --- Parse the main file
    const is = new InputStream(sourceText);
    const ts = new TokenStream(is);
    const parser = new Z80AsmParser(ts, fileIndex);
    const parsed = parser.parseProgram();

    // --- Collect syntax errors
    for (const error of parser.errors) {
      this.reportParserError(sourceItem, error);
    }

    // --- Exit if there are any errors
    if (parser.hasErrors) {
      return { success: false };
    }

    // --- Now, process directives and the .model pragma
    let currentLineIndex = 0;
    let ifdefStack: (boolean | null)[] = [];
    let processOps: ProcessOps = { ops: true };
    var anyProcessed = false;
    const visitedLines = parsed.assemblyLines;

    // --- Traverse through parsed lines
    while (currentLineIndex < visitedLines.length) {
      const line = visitedLines[currentLineIndex];
      this.setSourceLine(line);
      switch (line.type) {
        case "ZxBasicPragma": {
          if (anyProcessed) {
            this.reportAssemblyError("Z2002", line);
            break;
          }

          this._options.useCaseSensitiveSymbols = true;
          this._options.procExplicitLocalsOnly = true;
          this._options.flexibleDefPragmas = true;
          this._currentModule = this._output = new AssemblerOutput(
            sourceItem,
            true
          );
          this._output.sourceType = "zxbasic";
          anyProcessed = true;
          break;
        }
        case "ModelPragma":
          this.processModelPragma((line as unknown) as ModelPragma);
          anyProcessed = true;
          break;
        case "IncludeDirective": {
          // --- Parse the included file
          const includedLines = this.applyIncludeDirective(
            (line as unknown) as IncludeDirective,
            sourceItem
          );
          if (includedLines.success && includedLines.parsedLines) {
            // --- Add the parse result of the include file to the result
            parsedLines.push(...includedLines.parsedLines);
            anyProcessed = true;
          }

          break;
        }
        case "LineDirective":
          // TODO: Process a #line directive
          break;
        default: {
          if (
            this.applyDirective(
              (line as unknown) as Directive,
              ifdefStack,
              processOps
            )
          ) {
            anyProcessed = true;
            break;
          }
          if (processOps.ops) {
            line.fileIndex = fileIndex;
            line.sourceText = sourceText.substr(
              line.startPosition,
              line.endPosition - line.startPosition + 1
            );
            parsedLines.push(line);
            anyProcessed = true;
          }

          break;
        }
      }
      currentLineIndex++;
    }

    // --- Check if all #if and #ifdef has a closing #endif tag
    if (ifdefStack.length > 0 && visitedLines.length > 0) {
      this.reportAssemblyError("Z2003", visitedLines[visitedLines.length - 1]);
    }

    // --- Done
    return {
      success: this._output.errorCount === 0,
      parsedLines,
    };
  }

  /**
   * Emits the binary code according to the specified code lines
   * @param lines Source code lines
   * @returns True, if there were no errors during code emission.
   */
  private emitCode(lines: Z80AssemblyLine[]): boolean {
    this._output.segments.length = 0;
    this.ensureCodeSegment();

    const currentLineIndex = { index: 0 };
    while (currentLineIndex.index < lines.length) {
      var asmLine = lines[currentLineIndex.index];
      this.emitSingleLine(lines, lines, asmLine, currentLineIndex);

      // --- Next line
      currentLineIndex.index++;
    }

    // --- Handle the orphan hanging label
    if (this._overflowLabelLine !== null) {
      this.createCurrentPointLabel(this._overflowLabelLine);
      this._overflowLabelLine = null;
    }

    // --- Handle unclosed field definitions
    if (this._currentStructInvocation) {
      // --- Check for structure size
      if (this._currentStructOffset > this._currentStructInvocation.size) {
        this.reportAssemblyError(
          "Z2013",
          this._currentStructLine,
          null,
          this._currentStructInvocation.structName,
          this._currentStructInvocation.size,
          this._currentStructOffset
        );
        return false;
      }
      this.recordFixup(
        (this._currentStructLine as unknown) as Z80AssemblyLine,
        FixupType.Struct,
        null,
        null,
        this._currentStructBytes,
        this._currentStructStartOffset
      );
    }

    // --- Ok, it's time to return with the result
    return this._output.errorCount === 0;
  }

  /**
   * Fixes the unresolved symbols after code emission
   */
  private fixupUnresolvedSymbols(): boolean {
    for (const scope of this._currentModule.localScopes) {
      if (scope.fixups.length === 0) {
        continue;
      }
      if (this.fixupSymbols(scope, false)) {
        // --- Local scope successfully resolved
        break;
      }
    }
    return this.fixupSymbols(this._currentModule, true);
  }

  /**
   * Compares binaries at the end of comilation
   */
  private compareBinaries(): boolean {
    for (const binInfo of this.compareBins) {
      const pragma = binInfo.comparePragma;

      // --- Get the file name
      const fileNameValue = this.evaluateExprImmediate(pragma.filename);
      if (!fileNameValue.isValid) {
        continue;
      }

      if (fileNameValue.type !== ExpressionValueType.String) {
        this.reportAssemblyError("Z2081", pragma);
        continue;
      }

      // --- Obtain optional offset
      var offset = 0;
      if (pragma.offset) {
        const offsValue = this.evaluateExprImmediate(pragma.offset);
        if (offsValue.type !== ExpressionValueType.Integer) {
          this.reportAssemblyError("Z2042", pragma);
          continue;
        }
        offset = offsValue.asLong();
        if (offset < 0) {
          this.reportAssemblyError("Z2082", pragma);
          continue;
        }
      }

      // --- Obtain optional length
      let length: number | undefined;
      if (pragma.length) {
        const lengthValue = this.evaluateExprImmediate(pragma.length);
        if (lengthValue.type !== ExpressionValueType.Integer) {
          this.reportAssemblyError("Z2042", pragma);
          continue;
        }
        length = lengthValue.asLong();
        if (length < 0) {
          this.reportAssemblyError("Z2083", pragma);
          continue;
        }
      }

      // --- Read the binary file
      const currentSourceFile = this._output.sourceFileList[
        ((pragma as unknown) as Z80AssemblyLine).fileIndex
      ];
      const dirname = path.dirname(currentSourceFile.filename) ?? "";
      const filename = path.join(dirname, fileNameValue.asString());

      let contents: Buffer;
      try {
        contents = fs.readFileSync(filename);
      } catch (err) {
        this.reportAssemblyError("Z2084", pragma, null, filename, err.message);
        continue;
      }

      // --- Check content segment
      if (offset >= contents.length) {
        this.reportAssemblyError("Z2082", pragma);
        continue;
      }

      if (!length) {
        length = contents.length - offset;
      }

      // --- Check length
      if (offset + length > contents.length) {
        this.reportAssemblyError("Z2082", pragma);
        continue;
      }

      // --- Everything is ok, do the comparison
      var segment = binInfo.segment;
      if (!segment) {
        this.reportAssemblyError(
          "Z2085",
          pragma,
          null,
          "No output segment to compare."
        );
        continue;
      }

      // --- Check current segment length
      if (binInfo.segmentLength > length) {
        this.reportAssemblyError(
          "Z2085",
          pragma,
          null,
          `Current binary length is only ${length} while segment length to check is ${binInfo.segmentLength}`
        );
        continue;
      }

      for (let i = 0; i < binInfo.segmentLength; i++) {
        var segmData = segment.emittedCode[i];
        var binData = contents[i + offset];
        if (segmData === binData) {
          continue;
        }
        this.reportAssemblyError(
          "Z2085",
          pragma,
          null,
          `Output segment at offset ${i} is ${segmData}, but in binary it is ${binData}`
        );
        break;
      }
    }
    return this._output.errorCount === 0;
  }

  // ==========================================================================
  // Compilation helpers

  /**
   * Tests if the compilation point is in the global scope
   */
  get isInGlobalScope(): boolean {
    return (
      this._currentModule.localScopes.filter((s) => !s.isTemporaryScope)
        .length === 0
    );
  }

  // ==========================================================================
  // Process directives

  /**
   * Apply the #include directive
   * @param includeDir
   * @param sourceItem
   */
  applyIncludeDirective(
    includeDir: IncludeDirective,
    sourceItem: SourceFileItem
  ): { success: boolean; parsedLines?: Z80AssemblyLine[] } {
    const parsedLines: Z80AssemblyLine[] = [];

    // --- Check the #include directive
    let filename = includeDir.filename.trim();

    // --- Now, we have the file name, calculate the path
    if (sourceItem.filename !== NO_FILE_ITEM) {
      // --- The file name is taken into account as relative
      const dirname = path.dirname(sourceItem.filename) ?? "";
      filename = path.join(dirname, filename);
    }

    // --- Check for file existence
    if (!fs.existsSync(filename)) {
      this.reportAssemblyError("Z2004", includeDir, null, filename);
      return { success: false };
    }

    // --- Check for repetition
    var childItem = new SourceFileItem(filename);
    if (sourceItem.containsInIncludeList(childItem)) {
      this.reportAssemblyError("Z2005", includeDir, null, filename);
      return { success: false };
    }

    // --- Check for circular reference
    if (!sourceItem.include(childItem)) {
      this.reportAssemblyError("Z2006", includeDir, null, filename);
      return { success: false };
    }

    // --- Now, add the included item to the output
    this._output.sourceFileList.push(childItem);

    // --- Read the include file
    let sourceText: string;
    try {
      sourceText = readSourceFile(filename);
    } catch (err) {
      this.reportAssemblyError(
        "Z2007",
        includeDir,
        null,
        filename,
        err.toString()
      );
      return { success: false };
    }

    // --- Parse the file
    return this.executeParse(
      this._output.sourceFileList.length - 1,
      childItem,
      sourceText
    );
  }

  /**
   * Apply the specified directive
   * @param directive Directive to apply
   * @param ifdefStack Stack if conditional directives
   * @param processOps Object with the "process operation" flag
   * @returns True, if the directive has been processed successfully
   */
  applyDirective(
    directive: Directive,
    ifdefStack: (boolean | null)[],
    processOps: ProcessOps
  ): boolean {
    const doProc = processOps.ops;
    switch (directive.type) {
      case "DefineDirective":
        if (doProc) {
          this.conditionSymbols[
            directive.identifier.name
          ] = new ExpressionValue(true);
        }
        break;

      case "UndefDirective":
        if (doProc) {
          delete this.conditionSymbols[directive.identifier.name];
        }
        break;

      case "IfDefDirective":
      case "IfNDefDirective":
      case "IfModDirective":
      case "IfNModDirective":
      case "IfDirective":
        if (doProc) {
          if (directive.type === "IfDirective") {
            const value = this.evaluateExprImmediate(directive.condition);
            processOps.ops = value.isValid && value.value !== 0;
          } else if (
            directive.type === "IfModDirective" ||
            directive.type === "IfNModDirective"
          ) {
            if (
              VALID_MODELS.indexOf(directive.identifier.name.toUpperCase()) < 0
            ) {
              this.reportAssemblyError("Z2008", directive);
              processOps.ops = false;
            } else {
              const refModel =
                this._output.modelType ?? this._options.currentModel;
              const modelName = SpectrumModelType[refModel].toUpperCase();
              const contains =
                modelName === directive.identifier.name.toUpperCase();
              const negate = directive.type === "IfNModDirective";
              processOps.ops = (contains && !negate) || (!contains && negate);
            }
          } else {
            const contains = !!this.conditionSymbols[directive.identifier.name];
            const negate = directive.type === "IfNDefDirective";
            processOps.ops = (contains && !negate) || (!contains && negate);
          }
          ifdefStack.push(processOps.ops);
        } else {
          ifdefStack.push(null);
        }
        break;

      case "ElseDirective":
        if (ifdefStack.length === 0) {
          this.reportAssemblyError("Z2009", directive);
        } else {
          const peekVal = ifdefStack.pop();
          if (peekVal !== null) {
            processOps.ops = !peekVal;
            ifdefStack.push(processOps.ops);
          } else {
            ifdefStack.push(null);
          }
        }
        break;

      case "EndIfDirective":
        if (ifdefStack.length === 0) {
          this.reportAssemblyError("Z2010", directive);
        } else {
          ifdefStack.pop();
          processOps.ops =
            ifdefStack.length === 0 || ifdefStack[ifdefStack.length - 1];
        }
        break;

      default:
        return false;
    }
    return true;
  }

  // ==========================================================================
  // Process pragmas

  /**
   * Process the specified .model pragma
   * @param pragma Pragma to process
   */
  processModelPragma(pragma: ModelPragma): void {
    if (this._output.modelType) {
      this.reportAssemblyError("Z2011", pragma);
      return;
    }

    let modelType: SpectrumModelType;
    switch (pragma.modelId.toUpperCase()) {
      case "SPECTRUM48":
        modelType = SpectrumModelType.Spectrum48;
        break;
      case "SPECTRUM128":
        modelType = SpectrumModelType.Spectrum128;
        break;
      case "SPECTRUMP3":
        modelType = SpectrumModelType.SpectrumP3;
        break;
      case "NEXT":
        modelType = SpectrumModelType.Next;
        break;
      default:
        this.reportAssemblyError("Z2012", pragma);
        return;
    }
    this._output.modelType = modelType;
  }

  // ==========================================================================
  // Process Expressions

  /**
   * Gets the source line the evaluation context is bound to
   */
  getSourceLine(): Z80AssemblyLine {
    return this._currentSourceLine;
  }

  /**
   * Sets the source line the evaluation context is bound to
   * @param sourceLine Source line information
   */
  setSourceLine(sourceLine: Z80AssemblyLine): void {
    this._currentSourceLine = sourceLine;
  }

  /**
   * Gets the current assembly address
   */
  getCurrentAddress(): number {
    this.ensureCodeSegment();
    const curSegment = this._currentSegment;
    return (
      (curSegment.startAddress +
        (curSegment?.displacement ?? 0) +
        curSegment.emittedCode.length) &
      0xffff
    );
  }

  /**
   * Gets the value of the specified symbol
   * @param symbol Symbol name
   * @param startFromGlobal Should resolution start from global scope?
   */
  getSymbolValue(symbol: string, startFromGlobal?: boolean): ValueInfo | null {
    let resolved: ValueInfo;
    if (startFromGlobal) {
      // --- Most be a compound symbol
      resolved = this._currentModule.resolveCompoundSymbol(symbol, true);
    } else if (symbol.indexOf(".") >= 0) {
      resolved = this._currentModule.resolveCompoundSymbol(symbol, false);
      if (resolved === null) {
        resolved = this._currentModule.resolveSimpleSymbol(symbol);
      }
    } else {
      resolved = this._currentModule.resolveSimpleSymbol(symbol);
    }
    return resolved;
  }

  /**
   * Gets the current loop counter value
   */
  getLoopCounterValue(): ExpressionValue {
    if (this.isInGlobalScope) {
      this.reportAssemblyError("Z2056", this._currentSourceLine);
      return ExpressionValue.Error;
    }

    const scope = this.getTopLocalScope();
    if (!scope.isLoopScope) {
      this.reportAssemblyError("Z2056", this._currentSourceLine);
      return ExpressionValue.Error;
    }
    return new ExpressionValue(scope.loopCounter);
  }

  /**
   * Immediately evaluates the specified expression
   * @param opLine Assembly line that contains the expression
   * @param expr Expression to evaluate
   */
  evaluateExpr(expr: Expression): ExpressionValue {
    if (!this.readyToEvaluate(expr)) {
      return ExpressionValue.NonEvaluated;
    }
    return this.doEvalExpression(expr);
  }

  /**
   * Immediately evaluates the specified expression
   * @param expr Expression to evaluate
   */
  evaluateExprImmediate(expr: Expression): ExpressionValue {
    return this.doEvalExpression(expr);
  }

  /**
   * Signs if an expression is ready to be evaluated, namely, all
   * subexpression values are known.
   * @param context The context to evaluate the expression
   * @param expr Expression to evaluate
   */
  readyToEvaluate(expr: Expression): boolean {
    switch (expr.type) {
      case "UnaryExpression":
        return this.readyToEvaluate(expr.operand);
      case "BinaryExpression":
        return (
          this.readyToEvaluate(expr.left) && this.readyToEvaluate(expr.right)
        );
      case "ConditionalExpression":
        return (
          this.readyToEvaluate(expr.condition) &&
          this.readyToEvaluate(expr.consequent) &&
          this.readyToEvaluate(expr.alternate)
        );
      case "FunctionInvocation":
        return expr.args.every((arg) => this.readyToEvaluate(arg));
      case "Identifier":
        return this.getSymbolValue(expr.name) !== null;
      case "Symbol":
        return (
          this.getSymbolValue(expr.identifier.name, expr.startsFromGlobal) !==
          null
        );
      case "MacroParameter":
        return this.getSymbolValue(expr.identifier.name) !== null;
    }
    return true;
  }

  /**
   * Reports an error during evaluation
   * @param code Error code
   * @param node Error position
   */
  reportEvaluationError(
    code: ErrorCodes,
    node: NodePosition,
    ...parameters: any[]
  ): void {
    this.reportAssemblyError(
      code,
      this._currentSourceLine,
      node,
      ...parameters
    );
  }

  // ==========================================================================
  // Code emission methods

  /**
   * Ensures that there is a code segment into which to emit the code
   * @param defaultAddress Default start address of the segment
   * @param maxLength Maximum segment length
   */
  private ensureCodeSegment(
    defaultAddress?: number,
    maxLength: number = 0xffff
  ): void {
    if (this._currentSegment) {
      return;
    }
    const segment = new BinarySegment();
    segment.startAddress =
      (defaultAddress === undefined
        ? this._options?.defaultStartAddress ?? 0x8000
        : defaultAddress) & 0xffff;
    segment.currentInstructionOffset = 0;
    segment.maxCodeLength = maxLength & 0xffff;
    this._output.segments.push(segment);
    this._currentSegment = segment;
  }

  /**
   * Creates a label at the current point
   * @param asmLine Assembly line with a lable
   */
  private createCurrentPointLabel(asmLine: LabelOnlyLine): void {
    this.addSymbol(
      asmLine.label.name,
      (asmLine as unknown) as Z80AssemblyLine,
      new ExpressionValue(this.getCurrentAssemblyAddress())
    );
  }

  /**
   * Emits the binary code for a single source line
   * @param allLines All parsed lines
   * @param scopeLines Lines to process in the current scope
   * @param asmLine The source code line to emit the binary code for
   * @param currentLineIndex The index of the line to emit
   * @param fromMacroEmit Is this method called during macro emit?
   */
  private emitSingleLine(
    allLines: Z80AssemblyLine[],
    scopeLines: Z80AssemblyLine[],
    asmLine: Z80AssemblyLine,
    currentLineIndex: { index: number },
    fromMacroEmit: boolean = false
  ): void {
    const assembler = this;
    this._currentSourceLine = asmLine;
    this._currentListFileItem = {
      fileIndex: asmLine.fileIndex,
      address: this.getCurrentAddress(),
      lineNumber: asmLine.line,
      segmentIndex: this._output.segments.length - 1,
      codeStartIndex: this._currentSegment.emittedCode.length,
      sourceText: asmLine.sourceText,
      codeLength: 0,
    };

    // --- Report any parse-time function issue
    // TODO: Implement this feature

    // --- No parse-time issue, process the line
    if (
      asmLine.type === "LabelOnlyLine" ||
      asmLine.type === "CommentOnlyLine"
    ) {
      // --- This is a line with a label or comment only
      emitListItem();
      if (!asmLine.label) {
        return;
      }

      // --- This is a label-only line
      if (this._overflowLabelLine) {
        this.createCurrentPointLabel(this._overflowLabelLine);
      }
      this._overflowLabelLine = asmLine as LabelOnlyLine;
    } else {
      // --- This line contains elements to process
      let currentLabel: string | null;
      if (!this._overflowLabelLine) {
        // --- No hanging label, use the current line
        currentLabel = asmLine.label?.name;
      } else {
        if (!asmLine.label) {
          // --- No current label, use the hanging label
          currentLabel = this._overflowLabelLine.label?.name;
        } else {
          // --- Create a point for the hanging label and then use the current label
          if (
            !(
              this._isInStructCloning ||
              (isByteEmittingPragma(asmLine) && this._currentStructInvocation)
            )
          ) {
            this.createCurrentPointLabel(this._overflowLabelLine);
          }
          currentLabel = asmLine.label?.name;
          this._overflowLabelLine = null;
        }
      }
      // --- Check if there's a label to create
      if (currentLabel) {
        // --- There's a label, we clear the previous hanging label
        this._overflowLabelLine = null;

        // --- Create the label unless the current pragma does it
        if (
          !(
            isLabelSetter(asmLine) ||
            this._isInStructCloning ||
            (isByteEmittingPragma(asmLine) && this._currentStructInvocation)
          )
        ) {
          if (
            !currentLabel.startsWith("`") &&
            this._currentModule.localScopes.length > 0
          ) {
            // --- Check if temporary scope should be fixed and disposed
            this.fixupTemporaryScope();
          }
          this.addSymbol(
            currentLabel,
            asmLine,
            new ExpressionValue(this.getCurrentAddress())
          );
        }
      }

      // --- Let's handle assembly lines with macro parameters
      // TODO: Implement this feature

      // --- Handle field assignment statement
      const isFieldAssignment = asmLine.type === "FieldAssignment";
      if (isFieldAssignment) {
        asmLine = (((asmLine as unknown) as FieldAssignment)
          .assignment as unknown) as Z80AssemblyLine;
      }
      if (this._currentStructInvocation) {
        // --- We are in a .struct invocation...
        if (!isFieldAssignment) {
          // --- ...and just left the invocation scope
          // --- Check for structure size
          if (this._currentStructOffset > this._currentStructInvocation.size) {
            this.reportAssemblyError(
              "Z2013",
              this._currentStructLine,
              null,
              this._currentStructInvocation.structName,
              this._currentStructInvocation.size,
              this._currentStructOffset
            );
            return;
          }

          // --- Complete emitting the structure
          this.recordFixup(
            (this._currentStructLine as unknown) as Z80AssemblyLine,
            FixupType.Struct,
            null,
            null,
            this._currentStructBytes,
            this._currentStructStartOffset
          );
          this._currentStructInvocation = null;
        } else {
          if (currentLabel) {
            // --- If there's a label, that should be a field
            const fieldDefinition = this._currentStructInvocation.getField(
              currentLabel
            );
            if (!fieldDefinition) {
              this.reportAssemblyError(
                "Z2014",
                asmLine,
                null,
                this._currentStructInvocation.structName,
                currentLabel
              );
              return;
            }

            // --- Use the field offset as the current one for subsequent emits
            this._currentStructOffset = fieldDefinition.offset;
          }
        }
      } else {
        // --- We are outside of a .struct invocation...
        if (isFieldAssignment) {
          // --- so field assignment is invalid here
          this.reportAssemblyError("Z2015", asmLine);
          return;
        }
      }

      // --- Now, it's time to deal with the assembly line
      if (asmLine.type.endsWith("Pragma")) {
        // --- Process a pragma
        // TODO: Check if ensureCodeSegment() is enough
        this.getCurrentAddress();
        this._currentSegment.currentInstructionOffset = this._currentSegment.emittedCode.length;
        this.applyPragma(asmLine as Pragma, currentLabel);
        emitListItem();
      } else if (asmLine.type.endsWith("Statement")) {
        this.processStatement(
          allLines,
          scopeLines,
          (asmLine as unknown) as Statement,
          currentLabel,
          currentLineIndex
        );
      } else if (asmLine.type === "MacroOrStructInvocation") {
        this.processMacroOrStructInvocation(
          (asmLine as unknown) as MacroOrStructInvocation,
          allLines
        );
      } else {
        // --- Process operations
        const addr = this.getCurrentAddress();
        this._currentSegment.currentInstructionOffset = this._currentSegment.emittedCode.length;
        this.emitAssemblyOperationCode(asmLine);

        // --- Generate source map information
        //const sourceInfo =
        this._output.sourceMap[addr] = {
          fileIndex: asmLine.fileIndex,
          line: asmLine.line,
        };
        this._output.addToAddressMap(asmLine.fileIndex, asmLine.line, addr);
        emitListItem();
      }
    }

    /**
     * Emits the current list item
     */
    function emitListItem(): void {
      assembler._currentListFileItem.codeLength =
        assembler._currentSegment.emittedCode.length -
        assembler._currentListFileItem.codeStartIndex;
      assembler._output.listFileItems.push(assembler._currentListFileItem);
    }
    /**
     * Tests if the specified line is a label-setter
     * @param asmLine Line to test
     */
    function isLabelSetter(asmLine: Z80AssemblyLine): boolean {
      switch (asmLine.type) {
        case "EquPragma":
        case "OrgPragma":
        case "VarPragma":
        case "MacroStatement":
        case "StructStatement":
          return true;
        default:
          return false;
      }
    }
  }

  /**
   * Adds a symbol to the current scope
   * @param symbol Symbol name
   * @param line Source code line
   * @param value Symbol value
   */
  private addSymbol(
    symbol: string,
    line: Z80AssemblyLine,
    value: ExpressionValue
  ): void {
    const assembler = this;
    let currentScopeIsTemporary = false;
    if (this._currentModule.localScopes.length > 0) {
      currentScopeIsTemporary = this.getTopLocalScope().isTemporaryScope;
    }
    if (!this._options.useCaseSensitiveSymbols) {
      symbol = symbol.toLowerCase();
    }
    const symbolIsTemporary = symbol.startsWith("`");

    let lookup = getSymbols();
    if (currentScopeIsTemporary) {
      if (!symbolIsTemporary) {
        // --- Remove the previous temporary scope
        const tempsScope = this.getTopLocalScope();
        this.fixupSymbols(tempsScope, false);
        this._currentModule.localScopes.pop();
        lookup = getSymbols();
      }
    } else {
      // --- Create a new temporary scope
      const newScope = new SymbolScope(null, this.isCaseSensitive);
      newScope.isTemporaryScope = true;
      this._currentModule.localScopes.push(newScope);
      if (symbolIsTemporary) {
        lookup = getSymbols();
      }
    }

    if (this._currentModule.localScopes.length > 0) {
      // --- We are in a local scope, get the next non-temporary scope
      let localScopes = this._currentModule.localScopes;
      let scope = localScopes[localScopes.length - 1];
      if (scope.isTemporaryScope) {
        const tmpScope = localScopes.pop();
        scope =
          localScopes.length > 0 ? localScopes[localScopes.length - 1] : null;
        localScopes.push(tmpScope);
      }

      if (scope?.localSymbolBookings.size > 0) {
        // --- We already booked local symbols
        if (!scope.localSymbolBookings.has(symbol)) {
          lookup = this._currentModule.symbols;
        }
      } else {
        if (this._options.procExplicitLocalsOnly) {
          lookup = this._currentModule.symbols;
        }
      }
    }

    // --- Check for already defined symbols
    const symbolInfo = lookup[symbol];
    if (symbolInfo && symbolInfo.type === SymbolType.Label) {
      this.reportAssemblyError("Z2017", line, null, symbol);
      return;
    }

    lookup[symbol] = AssemblySymbolInfo.createLabel(symbol, value);

    /**
     * Gets the current symbol map that can be used for symbol resolution
     */
    function getSymbols(): SymbolInfoMap {
      return assembler._currentModule.localScopes.length === 0
        ? assembler._currentModule.symbols
        : assembler.getTopLocalScope().symbols;
    }
  }

  /**
   * Check if the specified symbol exists
   * @param symbol Symbol to check
   */
  private symbolExists(symbol: string): boolean {
    let lookup = this._currentModule.symbols;
    if (this._currentModule.localScopes.length > 0) {
      const localScopes = this._currentModule.localScopes;
      lookup = localScopes[localScopes.length - 1].symbols;
    }
    const symbolInfo = lookup[symbol];
    return symbolInfo && symbolInfo.type === SymbolType.Label;
  }

  /**
   * Checks if the variable with the specified name exists
   * @param name Variable name
   */
  private variableExists(name: string): boolean {
    // --- Search for the variable from inside out
    for (const scope of this._currentModule.localScopes) {
      const symbolInfo = scope.getSymbol(name);
      if (symbolInfo && symbolInfo.type === SymbolType.Var) {
        return true;
      }
    }

    // --- Check the global scope
    const globalSymbol = this._currentModule.getSymbol(name);
    return globalSymbol && globalSymbol.type === SymbolType.Var;
  }

  /**
   * Sets the value of a variable
   * @param name Variable name
   * @param value Variable value
   */
  private setVariable(name: string, value: ExpressionValue): void {
    // --- Search for the variable from inside out
    for (const scope of this._currentModule.localScopes) {
      const symbolInfo = scope.getSymbol(name);
      if (symbolInfo && symbolInfo.type === SymbolType.Var) {
        symbolInfo.value = value;
        return;
      }
    }

    // --- Check the global scope
    const globalSymbol = this._currentModule.getSymbol(name);
    if (globalSymbol && globalSymbol.type === SymbolType.Var) {
      globalSymbol.value = value;
      return;
    }

    // --- The variable does not exist, create it in the current scope
    const scope =
      this._currentModule.localScopes.length > 0
        ? this.getTopLocalScope()
        : this._currentModule;
    scope.addSymbol(name, AssemblySymbolInfo.createVar(name, value));
  }

  /**
   * Gets the top local scope
   */
  private getTopLocalScope(): SymbolScope {
    const localScopes = this._currentModule.localScopes;
    return localScopes[localScopes.length - 1];
  }

  /**
   * Gets the current assembly address
   */
  private getCurrentAssemblyAddress(): number {
    this.ensureCodeSegment();
    return (
      (this._currentSegment.startAddress +
        (this._currentSegment?.displacement ?? 0) +
        this._currentSegment.emittedCode.length) &
      0xffff
    );
  }

  // ==========================================================================
  // Pragma processing methods

  /**
   * Processes the specified pragma
   * @param pragmaLine Assembly line with a pragma
   * @param label Pragma label
   */
  private applyPragma(pragmaLine: Pragma, label: string | null): void {
    switch (pragmaLine.type) {
      case "OrgPragma":
        this.processOrgPragma(pragmaLine, label);
        break;
      case "BankPragma":
        this.processBankPragma(pragmaLine, label);
        break;
      case "XorgPragma":
        this.processXorgPragma(pragmaLine);
        break;
      case "EntPragma":
        this.processEntPragma(pragmaLine);
        break;
      case "XentPragma":
        this.processXentPragma(pragmaLine);
        break;
      case "DispPragma":
        this.processDispPragma(pragmaLine);
        break;
      case "VarPragma":
        this.processVarPragma(pragmaLine, label);
        break;
      case "EquPragma":
        this.processEquPragma(pragmaLine, label);
        break;
      case "SkipPragma":
        this.processSkipPragma(pragmaLine);
        break;
      case "DefBPragma":
        if (this._currentStructInvocation) {
          this.processDefBPragma(pragmaLine, this.emitStructByte);
        } else {
          this.processDefBPragma(pragmaLine);
        }
        break;
      case "DefWPragma":
        if (this._currentStructInvocation) {
          this.processDefWPragma(pragmaLine, this.emitStructByte);
        } else {
          this.processDefWPragma(pragmaLine);
        }
        break;
      case "DefMPragma":
      case "DefNPragma":
      case "DefCPragma":
        if (this._currentStructInvocation) {
          this.processDefMNCPragma(pragmaLine, this.emitStructByte);
        } else {
          this.processDefMNCPragma(pragmaLine);
        }
        break;
      case "DefHPragma":
        if (this._currentStructInvocation) {
          this.processDefHPragma(pragmaLine, this.emitStructByte);
        } else {
          this.processDefHPragma(pragmaLine);
        }
        break;
      case "DefSPragma":
        if (this._currentStructInvocation) {
          this.processDefSPragma(pragmaLine, this.emitStructByte);
        } else {
          this.processDefSPragma(pragmaLine);
        }
        break;
      case "FillbPragma":
        if (this._currentStructInvocation) {
          this.processFillbPragma(pragmaLine, this.emitStructByte);
        } else {
          this.processFillbPragma(pragmaLine);
        }
        break;
      case "FillwPragma":
        if (this._currentStructInvocation) {
          this.processFillwPragma(pragmaLine, this.emitStructByte);
        } else {
          this.processFillwPragma(pragmaLine);
        }
        break;
      case "AlignPragma":
        this.processAlignPragma(pragmaLine);
        break;
      case "TracePragma":
        this.processTracePragma(pragmaLine);
        break;
      case "RndSeedPragma":
        this.processRndSeedPragma(pragmaLine);
        break;
      case "ErrorPragma":
        this.processErrorPragma(pragmaLine);
        break;
      case "IncBinPragma":
        this.processIncBinPragma(pragmaLine);
        break;
      case "CompareBinPragma":
        this.processCompareBinPragma(pragmaLine);
        break;
      case "InjectOptPragma":
        this.processInjectOptPragma(pragmaLine);
        break;
      case "DefGPragma":
        if (this._currentStructInvocation) {
          this.processDefGPragma(pragmaLine, this.emitStructByte);
        } else {
          this.processDefGPragma(pragmaLine);
        }
        break;
      case "DefGxPragma":
        if (this._currentStructInvocation) {
          this.processDefGXPragma(pragmaLine, this.emitStructByte);
        } else {
          this.processDefGXPragma(pragmaLine);
        }
        break;
    }
  }

  /**
   * Emits a new byte for a structure
   * @param data
   */
  private emitStructByte(data: number): void {
    this._currentStructBytes.set(this._currentStructOffset++, data & 0xff);
  }

  /**
   * Processes the .org pragma
   * @param pragma Pragma to process
   * @param label Label information
   */
  processOrgPragma(pragma: OrgPragma, label: string | null): void {
    const value = this.evaluateExprImmediate(pragma.address);
    if (!value.isValid) {
      return;
    }

    this.ensureCodeSegment();
    if (this._currentSegment.currentOffset) {
      // --- There is already code emitted for the current segment
      const segment = new BinarySegment();
      segment.startAddress = value.value;
      segment.maxCodeLength = 0x10000 - value.value;
      this._output.segments.push(segment);
      this._currentSegment = segment;
    } else {
      this._currentSegment.startAddress = value.value;
    }

    if (!label) {
      return;
    }

    // --- There is a labels, set its value
    this.fixupTemporaryScope();
    this.addSymbol(label, (pragma as unknown) as Z80AssemblyLine, value);
  }

  /**
   * Processes the .bank pragma
   * @param pragma Pragma to process
   * @param label Label information
   */
  processBankPragma(pragma: BankPragma, label: string | null): void {
    if (label) {
      // --- No label is allowed
      this.reportAssemblyError("Z2018", pragma);
      return;
    }

    // --- Check pragma value
    var value = this.evaluateExprImmediate(pragma.bankId);
    if (!value.isValid) {
      return;
    }
    if (value.asWord() > 7) {
      this.reportAssemblyError("Z2019", pragma);
      return;
    }

    // --- Check offsetValue
    let offset = 0;
    if (pragma.offset !== null) {
      var offsetValue = this.evaluateExprImmediate(pragma.offset);
      if (!offsetValue.isValid) {
        return;
      }
      offset = offsetValue.asWord();
      if (offset > 0x3fff) {
        this.reportAssemblyError("Z2020", pragma);
        return;
      }
    }

    // --- Check for appropriate model type
    if (
      this._output.modelType === undefined ||
      this._output.modelType === SpectrumModelType.Spectrum48
    ) {
      this.reportAssemblyError("Z2021", pragma);
      return;
    }

    this.ensureCodeSegment((0xc000 + offset) & 0xffff);
    if (
      this._currentSegment.currentOffset !== 0 ||
      this._currentSegment.bank !== undefined
    ) {
      // --- There is already code emitted for the current segment,
      // --- thus create a new segment
      this._currentSegment = new BinarySegment();
      this._output.segments.push(this._currentSegment);
    }
    if (this._output.segments.some((s) => s.bank === value.value)) {
      // --- A bank can be used only once
      this.reportAssemblyError("Z2022", pragma, null, value.value);
      return;
    }
    this._currentSegment.startAddress = (0xc000 + offset) & 0xffff;
    this._currentSegment.bank = value.value;
    this._currentSegment.bankOffset = offset;
    this._currentSegment.maxCodeLength = 0x4000 - offset;
  }

  /**
   * Processes the .xorg pragma
   * @param pragma Pragma to process
   */
  processXorgPragma(pragma: XorgPragma): void {
    const value = this.evaluateExprImmediate(pragma.address);
    if (!value.isValid) {
      return;
    }

    this.ensureCodeSegment();
    if (
      this._currentSegment.currentOffset &&
      this._currentSegment.xorgValue !== undefined
    ) {
      this.reportAssemblyError("Z2024", pragma);
    } else {
      this._currentSegment.xorgValue = value.value;
    }
  }

  /**
   * Processes the .ent pragma
   * @param pragma Pragma to process
   */
  processEntPragma(pragma: EntPragma): void {
    if (
      !this.isInGlobalScope &&
      this.shouldReportErrorInCurrentScope("Z2025")
    ) {
      this.reportAssemblyError("Z2025", pragma, null, ".ent");
    }
    const value = this.evaluateExprImmediate(pragma.address);
    if (value.isNonEvaluated) {
      this.recordFixup(
        (pragma as unknown) as Z80AssemblyLine,
        FixupType.Ent,
        pragma.address
      );
      return;
    }
    this._output.entryAddress = value.value;
  }

  /**
   * Processes the .xent pragma
   * @param pragma Pragma to process
   */
  processXentPragma(pragma: XentPragma): void {
    if (
      !this.isInGlobalScope &&
      this.shouldReportErrorInCurrentScope("Z2025")
    ) {
      this.reportAssemblyError("Z2025", pragma, null, ".xent");
    }
    const value = this.evaluateExprImmediate(pragma.address);
    if (value.isNonEvaluated) {
      this.recordFixup(
        (pragma as unknown) as Z80AssemblyLine,
        FixupType.Xent,
        pragma.address
      );
      return;
    }
    this._output.exportEntryAddress = value.value;
  }

  /**
   * Processes the .disp pragma
   * @param pragma Pragma to process
   */
  processDispPragma(pragma: DispPragma): void {
    const value = this.evaluateExprImmediate(pragma.offset);
    if (!value.isValid) {
      return;
    }
    this.ensureCodeSegment();
    const curSegment = this._currentSegment;
    curSegment.displacement = value.value;
    curSegment.dispPragmaOffset =
      (curSegment.startAddress + curSegment.currentOffset) & 0xffff;
  }

  /**
   * Processes the .equ pragma
   * @param pragma Pragma to process
   * @param label Label information
   */
  private processEquPragma(pragma: EquPragma, label: string | null): void {
    if (!label) {
      this.reportAssemblyError("Z2016", pragma);
      return;
    }
    this.fixupTemporaryScope();

    // --- Do not allow duplicate labels
    if (this.symbolExists(label)) {
      this.reportAssemblyError("Z2017", pragma, null, label);
      return;
    }

    // --- Evaluate .equ value
    const value = this.evaluateExpr(pragma.value);
    const asmLine = (pragma as unknown) as Z80AssemblyLine;
    if (value.isNonEvaluated) {
      this.recordFixup(asmLine, FixupType.Equ, pragma.value, label);
    } else {
      this.addSymbol(label, asmLine, value);
    }
  }

  /**
   * Processes the .var pragma
   * @param pragma Pragma to process
   * @param label Label information
   */
  processVarPragma(pragma: VarPragma, label: string | null): void {
    if (!label) {
      this.reportAssemblyError("Z2026", pragma);
      return;
    }
    this.fixupTemporaryScope();

    const value = this.evaluateExprImmediate(pragma.value);
    if (!value.isValid) {
      return;
    }

    // --- Do not allow reusing a symbol already declared
    if (this.symbolExists(label)) {
      this.reportAssemblyError("Z2027", pragma);
      return;
    }
    this.setVariable(label, value);
  }

  /**
   * Processes the .skip pragma
   * @param pragma Pragma to process
   */
  processSkipPragma(pragma: SkipPragma): void {
    const skipAddr = this.evaluateExprImmediate(pragma.skip);
    if (!skipAddr.isValid) {
      return;
    }

    let currentAddr = this.getCurrentAssemblyAddress();
    if (skipAddr.value < currentAddr) {
      this.reportAssemblyError("Z2028", pragma, null, skipAddr, currentAddr);
      return;
    }
    var fillByte = 0xff;
    if (pragma.fill !== null) {
      var fillValue = this.evaluateExprImmediate(pragma.fill);
      if (fillValue === null) {
        return;
      }
      fillByte = fillValue.value;
    }

    while (currentAddr < skipAddr.value) {
      this.emitByte(fillByte & 0xff);
      currentAddr++;
    }
  }

  /**
   * Processes the .defb pragma
   * @param pragma Pragma to process
   * @param emitAction Action to emit a code byte
   */
  processDefBPragma(
    pragma: DefBPragma,
    emitAction?: (b: number) => void
  ): void {
    const assembler = this;
    for (const expr of pragma.values) {
      const value = this.evaluateExpr(expr);
      if (value.isValid) {
        if (value.type === ExpressionValueType.String) {
          if (this._options.flexibleDefPragmas) {
            // --- In flexible mode, we allow strings...
            this.emitString(value, false, false, emitAction);
          } else {
            // --- ...otherwise, we accept only numeric values
            this.reportAssemblyError("Z2029", pragma);
          }
        } else {
          emit(value.value & 0xff);
        }
      } else if (value.isNonEvaluated) {
        this.recordFixup(
          (pragma as unknown) as Z80AssemblyLine,
          FixupType.Bit8,
          expr
        );
        emit(0x00);
      }
    }

    // --- Emits a byte
    function emit(value: number): void {
      if (emitAction) {
        const emitter = emitAction.bind(assembler);
        emitter(value);
      } else {
        assembler.emitByte(value);
      }
    }
  }

  /**
   * Processes the .defb pragma
   * @param pragma Pragma to process
   * @param emitAction Action to emit a code byte
   */
  processDefWPragma(
    pragma: DefWPragma,
    emitAction?: (b: number) => void
  ): void {
    const assembler = this;
    for (const expr of pragma.values) {
      var value = this.evaluateExpr(expr);
      if (value.isValid) {
        if (value.type === ExpressionValueType.String) {
          if (this._options.flexibleDefPragmas) {
            // --- In flexible mode, we allow strings...
            this.emitString(value, false, false, emitAction);
          } else {
            // --- ...otherwise, we accept only numeric values
            this.reportAssemblyError("Z2029", pragma);
          }
        } else {
          emit(value.value & 0xffff);
        }
      } else if (value.isNonEvaluated) {
        this.recordFixup(
          (pragma as unknown) as Z80AssemblyLine,
          FixupType.Bit16,
          expr
        );
        emit(0x0000);
      }
    }

    // --- Emits a byte
    function emit(value: number): void {
      if (emitAction) {
        const emitter = emitAction.bind(assembler);
        emitter(value & 0xff);
        emitter((value >> 8) & 0xff);
      } else {
        assembler.emitWord(value);
      }
    }
  }

  /**
   * Processes the .defm, .defn, .defc pragma
   * @param pragma Pragma to process
   * @param emitAction Action to emit a code byte
   */
  processDefMNCPragma(
    pragma: DefMPragma | DefNPragma | DefCPragma,
    emitAction?: (b: number) => void
  ): void {
    const message = this.evaluateExprImmediate(pragma.value);
    if (message.isValid && message.type !== ExpressionValueType.String) {
      if (this._options.flexibleDefPragmas) {
        // --- In flexible mode, the argument expression can be numeric...
        var value =
          (message.asByte() | (pragma.type === "DefCPragma" ? 0x80 : 0x00)) &
          0xff;
        if (emitAction) {
          emitAction(value);
          if (pragma.type === "DefNPragma") {
            emitAction(0x00);
          }
        } else {
          this.emitByte(value);
          if (pragma.type === "DefNPragma") {
            this.emitByte(0x00);
          }
        }
      } else {
        // --- otherwise, only string is accepted.
        this.reportAssemblyError("Z2030", pragma);
      }
    } else {
      this.emitString(
        message,
        pragma.type === "DefCPragma",
        pragma.type === "DefNPragma",
        emitAction
      );
    }
  }

  /**
   * Processes the .defh pragma
   * @param pragma Pragma to process
   * @param emitAction Action to emit a code byte
   */
  processDefHPragma(
    pragma: DefHPragma,
    emitAction?: (b: number) => void
  ): void {
    const assembler = this;
    const byteVector = this.evaluateExprImmediate(pragma.value);
    if (byteVector.isValid && byteVector.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z2031", pragma);
    }

    const bytesString = byteVector.asString();
    if (bytesString.length % 2 !== 0) {
      this.reportAssemblyError("Z2032", pragma);
      return;
    }

    // --- Convert the byte vector
    for (let i = 0; i < bytesString.length; i += 2) {
      const hexaChars = "0123456789abcdefABCDEF";
      const char1 = bytesString[i];
      const char2 = bytesString[i + 1];
      if (hexaChars.indexOf(char1) < 0 || hexaChars.indexOf(char2) < 0) {
        this.reportAssemblyError("Z2032", pragma);
        return;
      }
      emit(parseInt(bytesString.substr(i, 2), 16));
    }

    // --- Emits a byte
    function emit(value: number): void {
      if (emitAction) {
        const emitter = emitAction.bind(assembler);
        emitter(value);
      } else {
        assembler.emitByte(value);
      }
    }
  }

  /**
   * Processes the .defs pragma
   * @param pragma Pragma to process
   * @param emitAction Action to emit a code byte
   */
  processDefSPragma(
    pragma: DefSPragma,
    emitAction?: (b: number) => void
  ): void {
    const count = this.evaluateExprImmediate(pragma.count);
    let fillValue = 0x00;
    if (pragma.fill) {
      fillValue = this.evaluateExprImmediate(pragma.fill).asByte();
    }

    for (let i = 0; i < count.value; i++) {
      if (emitAction) {
        const emitter = emitAction.bind(this);
        emitter(fillValue);
      } else {
        this.emitByte(fillValue);
      }
    }
  }

  /**
   * Processes the .fillb pragma
   * @param pragma Pragma to process
   * @param emitAction Action to emit a code byte
   */
  processFillbPragma(
    pragma: FillbPragma,
    emitAction?: (b: number) => void
  ): void {
    const count = this.evaluateExprImmediate(pragma.count);
    let fillValue = 0x00;
    fillValue = this.evaluateExprImmediate(pragma.fill).asByte();

    for (let i = 0; i < count.value; i++) {
      if (emitAction) {
        const emitter = emitAction.bind(this);
        emitter(fillValue);
      } else {
        this.emitByte(fillValue);
      }
    }
  }

  /**
   * Processes the .fillw pragma
   * @param pragma Pragma to process
   * @param emitAction Action to emit a code byte
   */
  processFillwPragma(
    pragma: FillwPragma,
    emitAction?: (b: number) => void
  ): void {
    const count = this.evaluateExprImmediate(pragma.count);
    let fillValue = 0x00;
    fillValue = this.evaluateExprImmediate(pragma.fill).asWord();

    for (let i = 0; i < count.value; i++) {
      if (emitAction) {
        const emitter = emitAction.bind(this);
        emitter(fillValue & 0xff);
        emitter((fillValue >> 8) & 0xff);
      } else {
        this.emitWord(fillValue);
      }
    }
  }

  /**
   * Processes the .align pragma
   * @param pragma Pragma to process
   */
  processAlignPragma(pragma: AlignPragma): void {
    let alignment = 0x0100;
    if (pragma.alignExpr) {
      const alignValue = this.evaluateExprImmediate(pragma.alignExpr);
      alignment = alignValue.value;
      if (alignment < 1 || alignment > 0x4000) {
        this.reportAssemblyError("Z2033", pragma, null, alignment);
        return;
      }
    }

    var currentAddress = this.getCurrentAssemblyAddress();
    var newAddress =
      currentAddress % alignment === 0
        ? currentAddress
        : (Math.floor(currentAddress / alignment) + 1) * alignment;
    for (var i = currentAddress; i < newAddress; i++) {
      this.emitByte(0x00);
    }
  }

  /**
   * Processes the .trace pragma
   * @param pragma Pragma to process
   */
  processTracePragma(pragma: TracePragma): void {
    let message = "";
    for (const expr of pragma.values) {
      const exprValue = this.evaluateExprImmediate(expr);

      switch (exprValue.type) {
        case ExpressionValueType.Bool:
          message += exprValue.asBool();
          break;
        case ExpressionValueType.Integer:
          let intValue = exprValue.asLong();
          if (pragma.isHex) {
            const valueStr =
              intValue > 0x10000
                ? `${intValue.toString(16).padStart(8, "0")}`
                : `${intValue.toString(16).padStart(4, "0")}`;
            message += valueStr;
          } else {
            message += intValue;
          }
          break;
        case ExpressionValueType.Real:
          message += exprValue.asReal();
          break;
        case ExpressionValueType.String:
          if (pragma.isHex) {
            var bytes = convertSpectrumString(exprValue.asString());
            for (let i = 0; i < bytes.length; i++) {
              message += `${bytes.charCodeAt(i).toString(16).padStart(2, "0")}`;
            }
          } else {
            message += exprValue.asString();
          }
          break;
      }
    }
    if (this._traceHandler) {
      this._traceHandler(message);
    }
  }

  /**
   * Processes the .rndseed pragma
   * @param pragma Pragma to process
   */
  processRndSeedPragma(pragma: RndSeedPragma): void {
    if (pragma.seedExpr) {
      const seedValue = this.evaluateExprImmediate(pragma.seedExpr);
      setRandomSeed(seedValue.value);
    } else {
      setRandomSeed(Date.now());
    }
  }

  /**
   * Processes the .error pragma
   * @param pragma Pragma to process
   */
  processErrorPragma(pragma: ErrorPragma): void {
    const errorValue = this.evaluateExprImmediate(pragma.message);
    this.reportAssemblyError("Z4000", pragma, null, errorValue.asString());
  }

  /**
   * Processes the .includebin pragma
   * @param pragma Pragma to process
   */
  processIncBinPragma(pragma: IncBinPragma): void {
    // --- Obtain the file name
    const fileNameValue = this.evaluateExprImmediate(pragma.filename);
    if (fileNameValue.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z2034", pragma);
      return;
    }

    // --- Obtain optional offset
    let offset = 0;
    if (pragma.offset) {
      const offsValue = this.evaluateExprImmediate(pragma.offset);
      if (offsValue.type !== ExpressionValueType.Integer) {
        this.reportAssemblyError("Z2035", pragma);
        return;
      }
      offset = offsValue.asLong();
      if (offset < 0) {
        this.reportAssemblyError("Z2036", pragma);
        return;
      }
    }

    // --- Obtain optional length
    let length: number | null = null;
    if (pragma.length) {
      const lengthValue = this.evaluateExprImmediate(pragma.length);
      if (lengthValue.type !== ExpressionValueType.Integer) {
        this.reportAssemblyError("Z2035", pragma);
        return;
      }
      length = lengthValue.asLong();
      if (length < 0) {
        this.reportAssemblyError("Z2037", pragma);
        return;
      }
    }

    // --- Read the binary file
    const currentSourceFile = this._output.sourceFileList[
      ((pragma as unknown) as Z80AssemblyLine).fileIndex
    ];
    const dirname = path.dirname(currentSourceFile.filename) ?? "";
    const filename = path.join(dirname, fileNameValue.asString());

    let contents: Buffer | null = null;
    try {
      contents = fs.readFileSync(filename);
    } catch (err) {
      this.reportAssemblyError("Z2038", pragma, null, err.message);
      return;
    }

    // --- Check content segment
    if (offset >= contents.length) {
      this.reportAssemblyError("Z2036", pragma);
      return;
    }

    if (length === null) {
      length = contents.length - offset;
    }

    // --- Check length
    if (offset + length > contents.length) {
      this.reportAssemblyError("Z2037", pragma);
      return;
    }

    // --- Check for too long binary segment
    if (
      this.getCurrentAssemblyAddress() + length >=
      this._currentSegment.maxCodeLength
    ) {
      this.reportAssemblyError("Z2038", pragma);
      return;
    }

    // --- Everything is ok, emit the binary data
    for (let i = offset; i < offset + length; i++) {
      this.emitByte(contents[i]);
    }
  }

  /**
   * Processes the .comparebin pragma
   * @param pragma Pragma to process
   */
  processCompareBinPragma(pragma: CompareBinPragma): void {
    // --- Obtain the file name
    const fileNameValue = this.evaluateExprImmediate(pragma.filename);
    if (fileNameValue.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z2034", pragma);
      return;
    }

    // --- Store pragma information
    this.compareBins.push(
      new BinaryComparisonInfo(
        pragma,
        this._currentSegment,
        this._currentSegment.currentOffset
      )
    );
  }

  /**
   * Processes the .injectopt pragma
   * @param pragma Pragma to process
   */
  processInjectOptPragma(pragma: InjectOptPragma): void {
    // --- Obtain the file name
    this._output.injectOptions[pragma.identifier.name] = true;
  }

  /**
   * Processes the .defg pragma
   * @param pragma Pragma to process
   * @param emitAction Action to emit a code byte
   */
  processDefGPragma(
    pragma: DefGPragma,
    emitAction?: (b: number) => void
  ): void {
    this.emitDefgBytes(
      (pragma as unknown) as Z80AssemblyLine,
      pragma.pattern.trim(),
      false,
      emitAction
    );
  }

  /**
   * Processes the .defgx pragma
   * @param pragma Pragma to process
   * @param emitAction Action to emit a code byte
   */
  processDefGXPragma(
    pragma: DefGxPragma,
    emitAction?: (b: number) => void
  ): void {
    const value = this.evaluateExprImmediate(pragma.pattern);
    if (value.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z2040", pragma);
      return;
    }
    var pattern = value.asString().trim();
    this.emitDefgBytes(
      (pragma as unknown) as Z80AssemblyLine,
      pattern,
      true,
      emitAction
    );
  }

  /**
   * Emits the pattern bytes for .defg/.defgx
   * @param line Pragma line
   * @param pattern Pattern to emit
   * @param allowAlign Signs if alignment indicators are allowed or not
   * @param emitAction Action to emit a code byte
   */
  emitDefgBytes(
    line: Z80AssemblyLine,
    pattern: string,
    allowAlign: boolean = true,
    emitAction?: (b: number) => void
  ): void {
    let parts = pattern.split(";");
    if (parts.length > 1) {
      pattern = parts[0];
    } else {
      parts = pattern.split("//");
      if (parts.length > 1) {
        pattern = parts[0];
      }
    }
    if (!pattern) {
      this.reportAssemblyError("Z2041", line);
      return;
    }

    // --- Go through all values
    let alignToLeft = true;
    if (pattern[0] === "<" && allowAlign) {
      pattern = pattern.substr(1);
    } else if (pattern[0] === ">" && allowAlign) {
      alignToLeft = false;
      pattern = pattern.substr(1);
    }
    pattern = pattern.split(" ").join("");
    if (pattern.length === 0) {
      return;
    }

    var remainingBits = pattern.length % 8;
    if (remainingBits > 0) {
      pattern = alignToLeft
        ? pattern.padEnd(pattern.length + 8 - remainingBits, "_")
        : pattern.padStart(pattern.length + 8 - remainingBits, "_");
    }

    var bitPattern = 0x00;
    for (var i = 0; i < pattern.length; i++) {
      // --- Calculate the bit pattern
      switch (pattern[i]) {
        case "-":
        case ".":
        case "_":
          bitPattern <<= 1;
          break;
        default:
          bitPattern = (bitPattern << 1) | 1;
          break;
      }
      if ((i + 1) % 8 !== 0) {
        continue;
      }

      // --- Emit a full byte
      if (emitAction) {
        const emitter = emitAction.bind(this);
        emitter(bitPattern);
      } else {
        this.emitByte(bitPattern);
      }
      bitPattern = 0x00;
    }
  }

  // ==========================================================================
  // Statement processing methods

  /**
   * Process macro or structure invocation
   * @param macroOrStructStatement A macro or struct invocation statement
   * @param allLines All parsed lines
   */
  private processMacroOrStructInvocation(
    macroOrStructStatement: MacroOrStructInvocation,
    allLines: Z80AssemblyLine[]
  ): void {
    const structDef = this._currentModule.getStruct(
      macroOrStructStatement.identifier.name
    );
    if (structDef) {
      // --- We have found a structure definition
      this.processStructInvocation(macroOrStructStatement, structDef, allLines);
      return;
    }
  }

  /**
   * Process a structure invocation
   * @param structStmt A macro or struct invocation statement
   * @param structDef Structure definition
   * @param allLines All parsed lines
   */
  private processStructInvocation(
    structStmt: MacroOrStructInvocation,
    structDef: StructDefinition,
    allLines: Z80AssemblyLine[]
  ): void {
    if (structStmt.operands.length > 0) {
      this.reportAssemblyError(
        "Z2086",
        structStmt,
        null,
        structStmt.identifier.name
      );
    }

    this.ensureCodeSegment();
    this._currentStructStartOffset = this._currentSegment.currentOffset;

    // --- Emit the default pattern of the structure (including fixups)
    try {
      this._isInStructCloning = true;
      for (
        let lineIndex = structDef.section.firstLine + 1;
        lineIndex < structDef.section.lastLine;
        lineIndex++
      ) {
        const structLineIndex = { index: lineIndex };
        const curLine = allLines[lineIndex];
        this.emitSingleLine(allLines, allLines, curLine, structLineIndex);
      }
    } finally {
      this._isInStructCloning = false;
    }

    // --- Sign that we are inside a struct invocation
    this._currentStructInvocation = structDef;
    this._currentStructLine = structStmt;
    this._currentStructBytes = new Map<number, number>();
    this._currentStructOffset = 0;
  }

  /**
   * Processes a compiler statement
   * @param allLines All parsed lines
   * @param scopeLines Lines to process in the current scope
   * @param stmt Statement to process
   * @param label Label to process
   * @param currentLineIndex Current line index
   */
  private processStatement(
    allLines: Z80AssemblyLine[],
    scopeLines: Z80AssemblyLine[],
    stmt: Statement,
    label: string,
    currentLineIndex: { index: number }
  ): void {
    switch (stmt.type) {
      case "MacroStatement":
        this.collectMacroDefinition(stmt, label, allLines, currentLineIndex);
        break;
      case "MacroEndStatement":
        this.reportAssemblyError(
          "Z2055",
          stmt,
          null,
          ".endm/.mend",
          ".if/.ifused/.ifnused"
        );
        break;
      case "LoopStatement":
        this.processLoopStatement(stmt, allLines, scopeLines, currentLineIndex);
        break;
      case "LoopEndStatement":
        this.reportAssemblyError("Z2055", stmt, null, ".endl/.lend", ".loop");
        break;
      case "WhileStatement":
        this.processWhileStatement(
          stmt,
          allLines,
          scopeLines,
          currentLineIndex
        );
        break;
      case "WhileEndStatement":
        this.reportAssemblyError("Z2055", stmt, null, ".endw/.wend", ".while");
        break;
      case "RepeatStatement":
        this.processRepeatStatement(
          stmt,
          allLines,
          scopeLines,
          currentLineIndex
        );
        break;
      case "UntilStatement":
        this.reportAssemblyError("Z2055", stmt, null, ".until", ".repeat");
        break;
      case "ProcStatement":
        this.processProcStatement(stmt, allLines, scopeLines, currentLineIndex);
        break;
      case "ProcEndStatement":
        this.reportAssemblyError("Z2055", stmt, null, ".endp/.pend", ".proc");
        break;
      case "IfStatement":
        this.processIfStatement(stmt, allLines, scopeLines, currentLineIndex);
        break;
      case "IfUsedStatement":
        this.processIfStatement(stmt, allLines, scopeLines, currentLineIndex);
        break;
      case "IfNUsedStatement":
        this.processIfStatement(stmt, allLines, scopeLines, currentLineIndex);
        break;
      case "ElseStatement":
        this.reportAssemblyError(
          "Z2055",
          stmt,
          null,
          ".else",
          ".if/.ifused/.ifnused"
        );
        break;
      case "ElseIfStatement":
        this.reportAssemblyError(
          "Z2055",
          stmt,
          null,
          ".elseif",
          ".if/.ifused/.ifnused"
        );
        break;
      case "EndIfStatement":
        this.reportAssemblyError(
          "Z2055",
          stmt,
          null,
          ".endif",
          ".if/.ifused/.ifnused"
        );
        break;
      case "BreakStatement":
        this.processBreakStatement(stmt);
        break;
      case "ContinueStatement":
        this.processContinueStatement(stmt);
        break;
      case "ModuleStatement":
        this.processModuleStatement(
          stmt,
          label,
          allLines,
          scopeLines,
          currentLineIndex
        );
        break;
      case "ModuleEndStatement":
        this.reportAssemblyError(
          "Z2055",
          stmt,
          null,
          ".endmodule/.moduleend",
          ".module"
        );
        break;
      case "StructStatement":
        this.collectStructDefinition(stmt, label, allLines, currentLineIndex);
        break;
      case "StructEndStatement":
        this.reportAssemblyError("Z2055", stmt, null, ".ends", ".struct");
        break;
      case "LocalStatement":
        this.processLocalStatement(stmt);
        break;
      case "NextStatement":
        this.reportAssemblyError("Z2055", stmt, null, ".next", ".for");
        break;
      case "ForStatement":
        this.processForStatement(stmt, allLines, scopeLines, currentLineIndex);
        break;
    }
  }

  /**
   * Collects macro definition
   * @param macro Struct statement
   * @param label Label of the structure
   * @param allLines All parsed lines
   * @param currentLineIndex Current line index
   */
  private collectMacroDefinition(
    macro: MacroStatement,
    label: string,
    allLines: Z80AssemblyLine[],
    currentLineIndex: { index: number }
  ): void {
    let errorFound = false;
    // --- Check for parameter uniqueness
    var args = new Set<string>();
    for (const macroArg of macro.parameters) {
      const argName = macroArg.name.toLowerCase();
      if (args.has(argName)) {
        this.reportAssemblyError("Z2075", macro, null, macroArg.name);
        errorFound = true;
      }
      args.add(argName);
    }

    // --- Check if the macro name is correct
    if (!label) {
      errorFound = true;
      this.reportAssemblyError("Z2076", macro);
    } else if (label.startsWith("`")) {
      errorFound = true;
      this.reportAssemblyError("Z2077", macro, null, label);
    } else if (
      this._currentModule.containsMacro(label) ||
      this._currentModule.containsSymbol(label) ||
      this._currentModule.containsNestedModule(label) ||
      this._currentModule.containsStruct(label)
    ) {
      errorFound = true;
      this.reportAssemblyError("Z2078", macro, null, label);
    }

    // --- Search for the end of the macro
    const firstLine = currentLineIndex.index;
    const searchResult = this.searchForEndStatement(
      "MacroStatement",
      allLines,
      currentLineIndex
    );
    if (!searchResult.found) {
      return;
    }

    // --- Create macro definition
    const macroDef = new MacroDefinition(
      label,
      firstLine,
      currentLineIndex.index,
      macro.parameters,
      searchResult.label
    );

    // --- Check each macro line for invalid macro parameter names
    // --- or nested macro
    for (let i = firstLine + 1; i < currentLineIndex.index; i++) {
      var macroLine = allLines[i];

      // TODO: Check for parse-time function parameters (they can have only macro parameter arguments)
      if (macroLine.type === "MacroStatement") {
        this.reportAssemblyError("Z2079", macroLine);
        errorFound = true;
        continue;
      }

      if (macroLine.macroParams) {
        for (const param of macroLine.macroParams) {
          const findParam = macro.parameters.find(
            (p) => p.name.toLowerCase() === param.identifier.name
          );
          if (findParam) {
            continue;
          }

          errorFound = true;
          this.reportAssemblyError(
            "Z2080",
            macroLine,
            null,
            param.identifier.name
          );
        }
      }
    }

    // --- If macro is OK, store it
    if (!errorFound) {
      this._currentModule.addMacro(label, macroDef);
    }
  }

  /**
   * Collects structure definition
   * @param structStmt Struct statement
   * @param label Label of the structure
   * @param allLines All parsed lines
   * @param currentLineIndex Current line index
   */
  private collectStructDefinition(
    structStmt: StructStatement,
    label: string,
    allLines: Z80AssemblyLine[],
    currentLineIndex: { index: number }
  ): void {
    let errorFound = false;

    // --- Check if the structure name is correct
    if (!label) {
      errorFound = true;
      this.reportAssemblyError("Z2069", structStmt);
    } else if (label.startsWith("`")) {
      errorFound = true;
      this.reportAssemblyError("Z2070", structStmt, null, label);
    } else if (
      this._currentModule.containsMacro(label) ||
      this._currentModule.containsSymbol(label) ||
      this._currentModule.containsNestedModule(label) ||
      this._currentModule.containsStruct(label)
    ) {
      errorFound = true;
      this.reportAssemblyError("Z2071", structStmt, null, label);
    }

    // --- Search for the end of the structure
    const firstLine = currentLineIndex.index;
    const searchResult = this.searchForEndStatement(
      "StructStatement",
      allLines,
      currentLineIndex
    );
    if (!searchResult.found) {
      return;
    }

    if (searchResult.label) {
      errorFound = true;
      this.reportAssemblyError("Z2072", structStmt);
    }

    // --- Create structure definition
    const structDef = new StructDefinition(
      label,
      firstLine,
      currentLineIndex.index,
      this.isCaseSensitive
    );

    // --- Check each macro line for valid instruction type
    let structErrors = 0;
    let structOffset = 0;
    for (let i = firstLine + 1; i < currentLineIndex.index; i++) {
      const structLine = allLines[i];
      if (
        !isByteEmittingPragma(structLine) &&
        structLine.type !== "CommentOnlyLine" &&
        structLine.type !== "LabelOnlyLine"
      ) {
        this.reportAssemblyError("Z2073", structLine);
        errorFound = true;
        structErrors++;
        if (structErrors > 16) {
          break;
        }
      }

      // --- Check for field definition
      if (structLine.label) {
        const fieldLabel = structLine.label.name;
        if (structDef.containsField(fieldLabel)) {
          this.reportAssemblyError("Z2074", structLine, null, fieldLabel);
          errorFound = true;
        } else {
          structDef.addField(fieldLabel, new FieldDefinition(structOffset));
        }
      }

      // --- Determine structure size
      const pragma = structLine as Pragma;
      switch (pragma.type) {
        case "DefBPragma":
          structOffset += pragma.values.length;
          break;

        case "DefWPragma":
          structOffset += pragma.values.length * 2;
          break;

        case "DefMPragma":
        case "DefNPragma":
        case "DefCPragma":
          this.processDefMNCPragma(pragma, emitAction);
          break;

        case "DefHPragma":
          this.processDefHPragma(pragma, emitAction);
          break;

        case "DefSPragma":
          this.processDefSPragma(pragma, emitAction);
          break;

        case "FillwPragma":
          this.processFillwPragma(pragma, emitAction);
          break;

        case "FillbPragma":
          this.processFillbPragma(pragma, emitAction);
          break;

        case "DefGPragma":
          this.processDefGPragma(pragma, emitAction);
          break;

        case "DefGxPragma":
          this.processDefGXPragma(pragma, emitAction);
          break;
      }

      // --- We use this fuction to emit a byte
      function emitAction(_data: number): void {
        // ReSharper disable once AccessToModifiedClosure
        structOffset++;
      }
    }

    // --- Store the structure size
    structDef.size = structOffset;

    // -- Stop, if error found
    if (errorFound) {
      return;
    }

    // --- Register the structure and the structure symbol
    this._currentModule.addStruct(label, structDef);
    this._currentModule.addSymbol(
      label,
      AssemblySymbolInfo.createLabel(label, new ExpressionValue(structOffset))
    );
  }

  /**
   * Processes the WHILE statement
   * @param whileStmt While statement
   * @param allLines All parsed lines
   * @param scopeLines Lines to process in the current scope
   * @param currentLineIndex Current line index
   */
  private processWhileStatement(
    whileStmt: WhileStatement,
    allLines: Z80AssemblyLine[],
    scopeLines: Z80AssemblyLine[],
    currentLineIndex: { index: number }
  ): void {
    // --- Search for the end of the loop
    const firstLine = currentLineIndex.index;
    const searchResult = this.searchForEndStatement(
      "WhileStatement",
      scopeLines,
      currentLineIndex
    );
    if (!searchResult.found) {
      return;
    }

    // --- End found
    const lastLine = currentLineIndex.index;

    // --- Create a scope for the loop
    const loopScope = new SymbolScope(null, this.isCaseSensitive);
    this._currentModule.localScopes.push(loopScope);
    const errorsBefore = this._output.errorCount;

    let loopCount = 1;
    while (true) {
      // --- Create a local scope for the loop body
      var iterationScope = new SymbolScope(loopScope, this.isCaseSensitive);
      this._currentModule.localScopes.push(iterationScope);
      iterationScope.loopCounter = loopCount;

      // --- Evaluate the loop expression
      var loopCondition = this.evaluateExprImmediate(whileStmt.expr);
      if (!loopCondition.isValid) {
        return;
      }
      if (loopCondition.type === ExpressionValueType.String) {
        this.reportAssemblyError("Z2042", whileStmt);
        return;
      }

      // --- Exit if while condition fails
      if (!loopCondition.asBool()) {
        break;
      }

      const loopLineIndex = { index: firstLine + 1 };
      while (loopLineIndex.index < lastLine) {
        var curLine = scopeLines[loopLineIndex.index];
        this.emitSingleLine(allLines, scopeLines, curLine, loopLineIndex);
        if (iterationScope.breakReached || iterationScope.continueReached) {
          break;
        }
        loopLineIndex.index++;
      }

      // --- Add the end label to the local scope
      const endLabel = searchResult.label;
      if (endLabel) {
        // --- Add the end label to the loop scope
        this.addSymbol(
          endLabel,
          scopeLines[currentLineIndex.index],
          new ExpressionValue(this.getCurrentAssemblyAddress())
        );
      }

      // --- Clean up the hanging label
      this._overflowLabelLine = null;

      // --- Fixup the temporary scope over the iteration scope, if there is any
      const topScope = this.getTopLocalScope();
      if (topScope !== iterationScope && topScope.isTemporaryScope) {
        this.fixupSymbols(topScope, false);
        this._currentModule.localScopes.pop();
      }

      // --- Fixup the symbols locally
      this.fixupSymbols(iterationScope, false);

      // --- Remove the local scope
      this._currentModule.localScopes.pop();

      // --- Check for the maximum number of error
      if (
        this._output.errorCount - errorsBefore >=
        this._options.maxLoopErrorsToReport
      ) {
        this.reportAssemblyError("Z2054", whileStmt);
        break;
      }

      // --- Increment counter, check loop safety
      loopCount++;
      if (loopCount >= 0xffff) {
        this.reportAssemblyError("Z2053", whileStmt);
        break;
      }

      // --- BREAK reached, exit the loop
      if (iterationScope.breakReached) {
        break;
      }
    }

    // --- Clean up the loop's scope
    this._currentModule.localScopes.pop();
  }

  /**
   * Processes the LOOP statement
   * @param loop Loop statement
   * @param allLines All parsed lines
   * @param scopeLines Lines to process in the current scope
   * @param currentLineIndex Current line index
   */
  private processLoopStatement(
    loop: LoopStatement,
    allLines: Z80AssemblyLine[],
    scopeLines: Z80AssemblyLine[],
    currentLineIndex: { index: number }
  ): void {
    // --- Search for the end of the loop
    const firstLine = currentLineIndex.index;
    const searchResult = this.searchForEndStatement(
      "LoopStatement",
      scopeLines,
      currentLineIndex
    );
    if (!searchResult.found) {
      return;
    }

    // --- End found
    const lastLine = currentLineIndex.index;

    // --- Now, we can process the loop
    const loopCounter = this.evaluateExprImmediate(loop.expr);
    if (!loopCounter.isValid) {
      return;
    }
    if (loopCounter.type === ExpressionValueType.String) {
      this.reportAssemblyError("Z2042", loop);
      return;
    }

    // --- Check the loop counter
    var counter = loopCounter.asLong();
    if (counter >= 0x10000) {
      this.reportAssemblyError("Z2053", loop);
      counter = 1;
    }

    // --- Create a scope for the loop
    const loopScope = new SymbolScope(null, this.isCaseSensitive);
    this._currentModule.localScopes.push(loopScope);
    const errorsBefore = this._output.errorCount;

    for (let i = 0; i < counter; i++) {
      // --- Create a local scope for the loop body
      var iterationScope = new SymbolScope(loopScope, this.isCaseSensitive);
      this._currentModule.localScopes.push(iterationScope);
      iterationScope.loopCounter = i + 1;

      const loopLineIndex = { index: firstLine + 1 };
      while (loopLineIndex.index < lastLine) {
        const curLine = scopeLines[loopLineIndex.index];
        this.emitSingleLine(allLines, scopeLines, curLine, loopLineIndex);
        if (iterationScope.breakReached || iterationScope.continueReached) {
          break;
        }
        loopLineIndex.index++;
      }

      // --- Add the end label to the local scope
      const endLabel = searchResult.label;
      if (endLabel) {
        // --- Add the end label to the loop scope
        this.addSymbol(
          endLabel,
          scopeLines[currentLineIndex.index],
          new ExpressionValue(this.getCurrentAssemblyAddress())
        );
      }

      // --- Clean up the hanging label
      this._overflowLabelLine = null;

      // --- Fixup the temporary scope over the iteration scope, if there is any
      const topScope = this.getTopLocalScope();
      if (topScope !== iterationScope && topScope.isTemporaryScope) {
        this.fixupSymbols(topScope, false);
        this._currentModule.localScopes.pop();
      }

      // --- Fixup the symbols locally
      this.fixupSymbols(iterationScope, false);

      // --- Remove the local scope
      this._currentModule.localScopes.pop();

      // --- Check for the maximum number of error
      if (
        this._output.errorCount - errorsBefore >=
        this._options.maxLoopErrorsToReport
      ) {
        this.reportAssemblyError("Z2054", loop);
        break;
      }

      // --- BREAK reached, exit the loop
      if (iterationScope.breakReached) {
        break;
      }
    }

    // --- Clean up the loop's scope
    this._currentModule.localScopes.pop();
  }

  /**
   * Processes the REPEAT statement
   * @param repeatStmt While statement
   * @param allLines All parsed lines
   * @param scopeLines Lines to process in the current scope
   * @param currentLineIndex Current line index
   */
  private processRepeatStatement(
    repeatStmt: RepeatStatement,
    allLines: Z80AssemblyLine[],
    scopeLines: Z80AssemblyLine[],
    currentLineIndex: { index: number }
  ): void {
    // --- Search for the end of the loop
    const firstLine = currentLineIndex.index;
    const searchResult = this.searchForEndStatement(
      "RepeatStatement",
      scopeLines,
      currentLineIndex
    );
    if (!searchResult.found) {
      return;
    }

    // --- End found
    const lastLine = currentLineIndex.index;
    const untilStmt = (scopeLines[lastLine] as unknown) as UntilStatement;

    // --- Create a scope for the loop
    const loopScope = new SymbolScope(null, this.isCaseSensitive);
    this._currentModule.localScopes.push(loopScope);
    const errorsBefore = this._output.errorCount;

    let loopCount = 1;
    let condition = false;
    do {
      // --- Create a local scope for the loop body
      var iterationScope = new SymbolScope(loopScope, this.isCaseSensitive);
      this._currentModule.localScopes.push(iterationScope);
      iterationScope.loopCounter = loopCount;

      // --- Evaluate the loop expression
      const loopLineIndex = { index: firstLine + 1 };
      while (loopLineIndex.index < lastLine) {
        var curLine = scopeLines[loopLineIndex.index];
        this.emitSingleLine(allLines, scopeLines, curLine, loopLineIndex);
        if (iterationScope.breakReached || iterationScope.continueReached) {
          break;
        }
        loopLineIndex.index++;
      }

      // --- Add the end label to the local scope
      const endLabel = searchResult.label;
      if (endLabel) {
        // --- Add the end label to the loop scope
        this.addSymbol(
          endLabel,
          scopeLines[currentLineIndex.index],
          new ExpressionValue(this.getCurrentAssemblyAddress())
        );
      }

      // --- Clean up the hanging label
      this._overflowLabelLine = null;

      // --- Fixup the temporary scope over the iteration scope, if there is any
      const topScope = this.getTopLocalScope();
      if (topScope !== iterationScope && topScope.isTemporaryScope) {
        this.fixupSymbols(topScope, false);
        this._currentModule.localScopes.pop();
      }

      // --- Fixup the symbols locally
      this.fixupSymbols(iterationScope, false);

      // --- Check for the maximum number of error
      if (
        this._output.errorCount - errorsBefore >=
        this._options.maxLoopErrorsToReport
      ) {
        this.reportAssemblyError("Z2054", repeatStmt);
        break;
      }

      // --- Evaluate the loop expression
      const loopExitCondition = this.evaluateExprImmediate(untilStmt.expr);
      if (!loopExitCondition.isValid) {
        return;
      }
      if (loopExitCondition.type === ExpressionValueType.String) {
        this.reportAssemblyError("Z2042", untilStmt);
        return;
      }
      condition = loopExitCondition.asBool();

      // --- Increment counter, check loop safety
      loopCount++;
      if (loopCount >= 0xffff) {
        this.reportAssemblyError("Z2053", repeatStmt);
        break;
      }

      // --- Remove the local scope
      this._currentModule.localScopes.pop();

      // --- BREAK reached, exit the loop
      if (iterationScope.breakReached) {
        break;
      }
    } while (!condition);

    // --- Clean up the loop's scope
    this._currentModule.localScopes.pop();
  }

  /**
   * Processes the FOR statement
   * @param forStmt While statement
   * @param allLines All parsed lines
   * @param scopeLines Lines to process in the current scope
   * @param currentLineIndex Current line index
   */
  private processForStatement(
    forStmt: ForStatement,
    allLines: Z80AssemblyLine[],
    scopeLines: Z80AssemblyLine[],
    currentLineIndex: { index: number }
  ): void {
    // --- Search for the end of the loop
    const firstLine = currentLineIndex.index;
    const searchResult = this.searchForEndStatement(
      "ForStatement",
      scopeLines,
      currentLineIndex
    );
    if (!searchResult.found) {
      return;
    }

    // --- End found
    const lastLine = currentLineIndex.index;

    // --- Evaluate FROM, TO, and STEP expressions
    const fromValue = this.evaluateExprImmediate(forStmt.startExpr);
    if (!fromValue.isValid) {
      return;
    }
    if (fromValue.type === ExpressionValueType.String) {
      this.reportAssemblyError("Z2042", forStmt);
      return;
    }

    const toValue = this.evaluateExprImmediate(forStmt.toExpr);
    if (!toValue.isValid) {
      return;
    }
    if (toValue.type === ExpressionValueType.String) {
      this.reportAssemblyError("Z2042", forStmt);
      return;
    }

    let stepValue = new ExpressionValue(1);
    if (forStmt.stepExpr) {
      stepValue = this.evaluateExprImmediate(forStmt.stepExpr);
      if (!stepValue.isValid) {
        return;
      }
      if (stepValue.type === ExpressionValueType.String) {
        this.reportAssemblyError("Z2042", forStmt);
        return;
      }
      if (Math.abs(stepValue.asReal()) < Number.EPSILON) {
        this.reportAssemblyError("Z2057", forStmt);
        return;
      }
    }

    // --- Check the FOR variable
    const forVariable = forStmt.identifier.name;
    if (this.variableExists(forVariable)) {
      this.reportAssemblyError("Z2058", forStmt, null, forVariable);
      return;
    }

    // --- Create a scope for the loop
    const loopScope = new SymbolScope(null, this.isCaseSensitive);
    this._currentModule.localScopes.push(loopScope);
    const errorsBefore = this._output.errorCount;

    // --- Init the FOR variable
    loopScope.addSymbol(
      forVariable,
      AssemblySymbolInfo.createVar(forVariable, fromValue)
    );

    const isIntLoop =
      (fromValue.type === ExpressionValueType.Bool ||
        fromValue.type === ExpressionValueType.Integer) &&
      (toValue.type === ExpressionValueType.Bool ||
        toValue.type === ExpressionValueType.Integer) &&
      (stepValue.type === ExpressionValueType.Bool ||
        stepValue.type === ExpressionValueType.Integer);

    let loopIntValue = fromValue.asLong();
    const endIntValue = toValue.asLong();
    const incIntValue = stepValue.asLong();
    let loopRealValue = fromValue.asReal();
    const endRealValue = toValue.asReal();
    const incRealValue = stepValue.asReal();

    let loopCount = 0;
    while (true) {
      // --- Check the loop's exit condition
      if (isIntLoop) {
        if (incIntValue > 0 && loopIntValue > endIntValue) {
          break;
        }
        if (incIntValue < 0 && loopIntValue < endIntValue) {
          break;
        }
      } else {
        if (incRealValue > 0 && loopRealValue > endRealValue) {
          break;
        }
        if (incRealValue < 0 && loopRealValue < endRealValue) {
          break;
        }
      }

      // --- Increment counter, check loop safety
      loopCount++;
      if (loopCount >= 0xffff) {
        this.reportAssemblyError("Z2053", forStmt);
        break;
      }

      // --- Create a local scope for the loop body
      var iterationScope = new SymbolScope(loopScope, this.isCaseSensitive);
      this._currentModule.localScopes.push(iterationScope);
      iterationScope.loopCounter = loopCount;

      // --- Evaluate the loop expression
      const loopLineIndex = { index: firstLine + 1 };
      while (loopLineIndex.index < lastLine) {
        var curLine = scopeLines[loopLineIndex.index];
        this.emitSingleLine(allLines, scopeLines, curLine, loopLineIndex);
        if (iterationScope.breakReached || iterationScope.continueReached) {
          break;
        }
        loopLineIndex.index++;
      }

      // --- Add the end label to the local scope
      const endLabel = searchResult.label;
      if (endLabel) {
        // --- Add the end label to the loop scope
        this.addSymbol(
          endLabel,
          scopeLines[currentLineIndex.index],
          new ExpressionValue(this.getCurrentAssemblyAddress())
        );
      }

      // --- Clean up the hanging label
      this._overflowLabelLine = null;

      // --- Fixup the temporary scope over the iteration scope, if there is any
      const topScope = this.getTopLocalScope();
      if (topScope !== iterationScope && topScope.isTemporaryScope) {
        this.fixupSymbols(topScope, false);
        this._currentModule.localScopes.pop();
      }

      // --- Fixup the symbols locally
      this.fixupSymbols(iterationScope, false);

      // --- Remove the local scope
      this._currentModule.localScopes.pop();

      // --- Check for the maximum number of error
      if (
        this._output.errorCount - errorsBefore >=
        this._options.maxLoopErrorsToReport
      ) {
        this.reportAssemblyError("Z2054", forStmt);
        break;
      }

      // --- BREAK reached, exit the loop
      if (iterationScope.breakReached) {
        break;
      }

      // --- Increment cycle variable
      if (isIntLoop) {
        loopIntValue += incIntValue;
        loopScope.getSymbol(forVariable).value = new ExpressionValue(
          loopIntValue
        );
      } else {
        loopRealValue += incRealValue;
        loopScope.getSymbol(forVariable).value = new ExpressionValue(
          loopRealValue
        );
      }
    }

    // --- Clean up the loop's scope
    this._currentModule.localScopes.pop();
  }

  /**
   * Processes a BREAK statement
   * @param breakStmt Break statement
   */
  private processBreakStatement(breakStmt: BreakStatement): void {
    if (this.isInGlobalScope || !this.getTopLocalScope().isLoopScope) {
      this.reportAssemblyError("Z2059", breakStmt);
      return;
    }
    this.getTopLocalScope().breakReached = true;
  }

  /**
   * Processes a CONTINUE statement
   * @param continueStmt Break statement
   */
  private processContinueStatement(continueStmt: ContinueStatement): void {
    if (this.isInGlobalScope || !this.getTopLocalScope().isLoopScope) {
      this.reportAssemblyError("Z2060", continueStmt);
      return;
    }
    this.getTopLocalScope().continueReached = true;
  }

  /**
   * Processes the IF/IFUSED/IFNUSED statement
   * @param ifStmt IF statement
   * @param allLines All parsed lines
   * @param scopeLines Lines to process in the current scope
   * @param currentLineIndex Current line index
   */
  private processIfStatement(
    ifStmt: IfLikeStatement,
    allLines: Z80AssemblyLine[],
    scopeLines: Z80AssemblyLine[],
    currentLineIndex: { index: number }
  ): void {
    // --- Map the sections of IF
    const ifDef = this.getIfSections(ifStmt, scopeLines, currentLineIndex);
    if (!ifDef.definition) {
      return;
    }

    // --- Process the IF definition
    let sectionToCompile: IfSection | undefined;
    for (const ifSection of ifDef.definition.ifSections) {
      // --- Evaluate the condition
      let conditionValue: ExpressionValue;
      if (ifSection.ifStatement.type === "ElseIfStatement") {
        conditionValue = this.evaluateExprImmediate(ifSection.ifStatement.expr);
      } else {
        switch (ifStmt.type) {
          case "IfStatement":
            conditionValue = this.evaluateExprImmediate(ifStmt.expr);
            break;
          case "IfUsedStatement":
          case "IfNUsedStatement":
            const idSymbol = ifStmt.symbol;
            const valueInfo = this.getSymbolValue(
              idSymbol.identifier.name,
              idSymbol.startsFromGlobal
            );
            var isUsed =
              (valueInfo &&
                valueInfo.usageInfo &&
                valueInfo.usageInfo.isUsed) ||
              false;
            conditionValue = new ExpressionValue(
              ifStmt.type === "IfUsedStatement" ? isUsed : !isUsed
            );
            break;
          default:
            // --- Just for the sake of completeness
            conditionValue = new ExpressionValue(false);
            break;
        }
      }

      // --- Handle evaluation errors
      if (!conditionValue.isValid) {
        continue;
      }
      if (conditionValue.type === ExpressionValueType.String) {
        this.reportAssemblyError("Z2042", ifSection.ifStatement);
        continue;
      }

      // --- Check the condition
      if (conditionValue.asBool()) {
        sectionToCompile = ifSection;
      }
    }

    // --- Check if there is any section to compile
    sectionToCompile = sectionToCompile ?? ifDef.definition.elseSection;
    if (!sectionToCompile) {
      // --- No matching IF, ELIF, and no ELSE, so there's nothing to emit
      return;
    }

    // --- Emit the matching section
    let loopLineIndex = { index: sectionToCompile.section.firstLine + 1 };
    while (loopLineIndex.index < sectionToCompile.section.lastLine) {
      var curLine = scopeLines[loopLineIndex.index];
      this.emitSingleLine(allLines, scopeLines, curLine, loopLineIndex);
      loopLineIndex.index++;
    }

    // --- Add the end label to the local scope
    if (ifDef.label) {
      // --- Add the end label to the loop scope
      this.addSymbol(
        ifDef.label,
        scopeLines[currentLineIndex.index],
        new ExpressionValue(this.getCurrentAssemblyAddress())
      );
    }

    // --- Clean up the hanging label
    this._overflowLabelLine = null;
  }

  /**
   * Collects the structural information of an IF statement and makes fundamental
   * syntax checks
   * @param ifStmt IF statement
   * @param lines Parsed assembly lines
   * @param currentLineIndex Index of the IF defintion line
   */
  private getIfSections(
    ifStmt: IfLikeStatement,
    lines: Z80AssemblyLine[],
    currentLineIndex: { index: number }
  ): {
    definition: IfDefinition | null;
    label?: string;
  } {
    let endLabel: string | undefined;
    if (currentLineIndex.index >= lines.length) {
      return { definition: null };
    }

    const ifDef = new IfDefinition();
    const firstLine = currentLineIndex.index;
    let sectionStart = firstLine;
    let sectionStmt = (lines[sectionStart] as unknown) as Statement;
    let elseDetected = false;
    let errorDetected = false;
    currentLineIndex.index++;

    // --- Iterate through lines
    while (currentLineIndex.index < lines.length) {
      const curLine = (lines[currentLineIndex.index] as unknown) as Statement;

      // --- Check for ENDIF
      if (curLine.type === "EndIfStatement") {
        // --- We have found the end line, get its label
        endLabel = curLine.label ? curLine.label.name : endLabel;
        if (elseDetected) {
          // --- Store the ELSE section
          ifDef.elseSection = new IfSection(
            null,
            sectionStart,
            currentLineIndex.index
          );
        } else {
          // --- Store the IF/ELIF section
          ifDef.ifSections.push(
            new IfSection(sectionStmt, sectionStart, currentLineIndex.index)
          );
        }

        // --- Calculate the entire IF section and return with it
        ifDef.fullSection = new DefinitionSection(
          firstLine,
          currentLineIndex.index
        );
        return errorDetected
          ? { definition: null }
          : { definition: ifDef, label: endLabel };
      }

      // --- Check for ELIF section
      if (curLine.type === "ElseIfStatement") {
        endLabel = curLine.label ? curLine.label.name : endLabel;
        if (endLabel) {
          this.reportAssemblyError("Z2061", sectionStmt, null, ".elif");
        }
        if (elseDetected) {
          errorDetected = true;
          this.reportAssemblyError("Z2062", sectionStmt, null, ".elif");
        } else {
          // --- Store the previous section
          ifDef.ifSections.push(
            new IfSection(sectionStmt, sectionStart, currentLineIndex.index)
          );
          sectionStmt = curLine;
          sectionStart = currentLineIndex.index;
        }
      }

      // --- Check for ELSE section
      else if (curLine.type === "ElseStatement") {
        endLabel = curLine.label ? curLine.label.name : endLabel;
        if (endLabel) {
          this.reportAssemblyError("Z2061", sectionStmt, null, ".else");
        }
        if (elseDetected) {
          errorDetected = true;
          this.reportAssemblyError("Z2062", sectionStmt, null, ".else");
        } else {
          // --- Store the previous section
          ifDef.ifSections.push(
            new IfSection(sectionStmt, sectionStart, currentLineIndex.index)
          );
          sectionStart = currentLineIndex.index;
        }
        elseDetected = true;
      }

      if (
        (curLine as any).type === "LabelOnlyLine" ||
        (curLine as any).type === "CommentOnlyLine"
      ) {
        // --- Record the last hanging label
        endLabel = curLine.label ? curLine.label.name : endLabel;
      } else {
        endLabel = null;
        if (curLine.isBlock) {
          // --- Search for the end of an embedded block statement
          const searchResult = this.searchForEndStatement(
            curLine.type,
            lines,
            currentLineIndex
          );
          if (!searchResult.found) {
            this.reportAssemblyError(
              "Z2052",
              lines[firstLine],
              null,
              ".if/.ifused/.ifnused"
            );
            return { definition: null };
          }
        }
      }
      currentLineIndex.index++;
    }
    this.reportAssemblyError(
      "Z2052",
      lines[firstLine],
      null,
      ".if/.ifused/.ifnused"
    );
    return { definition: null };
  }

  /**
   * Processes the LOOP statement
   * @param proc Loop statement
   * @param allLines All parsed lines
   * @param scopeLines Lines to process in the current scope
   * @param currentLineIndex Current line index
   */
  private processProcStatement(
    proc: ProcStatement,
    allLines: Z80AssemblyLine[],
    scopeLines: Z80AssemblyLine[],
    currentLineIndex: { index: number }
  ): void {
    // --- Search for the end of the proc
    const firstLine = currentLineIndex.index;
    const searchResult = this.searchForEndStatement(
      "ProcStatement",
      scopeLines,
      currentLineIndex
    );
    if (!searchResult.found) {
      return;
    }

    // --- End found
    const lastLine = currentLineIndex.index;

    // --- Create a scope for the proc
    const procScope = new SymbolScope(null, this.isCaseSensitive);
    procScope.isLoopScope = false;
    procScope.isProcScope = true;
    this._currentModule.localScopes.push(procScope);

    // --- Collect and process LOCAL statements

    for (let line = firstLine + 1; line < lastLine; line++) {
      const localLine = scopeLines[line];
      if (localLine.type !== "LocalStatement") {
        continue;
      }
      for (const symbol of ((localLine as unknown) as LocalStatement)
        .identifiers) {
        if (symbol.name.startsWith("`")) {
          this.reportAssemblyError("Z2063", localLine, null, symbol.name);
        }
        if (procScope.containsLocalBooking(symbol.name)) {
          this.reportAssemblyError("Z2064", localLine, null, symbol.name);
        }
        procScope.addLocalBooking(symbol.name);
      }
    }

    // --- Emit loop instructions
    const procLineIndex = { index: firstLine + 1 };
    while (procLineIndex.index < lastLine) {
      const curLine = scopeLines[procLineIndex.index];
      this.emitSingleLine(allLines, scopeLines, curLine, procLineIndex);
      procLineIndex.index++;
    }

    // --- Add the end label to the local scope
    const endLabel = searchResult.label;
    if (endLabel) {
      // --- Add the end label to the loop scope
      this.addSymbol(
        endLabel,
        scopeLines[currentLineIndex.index],
        new ExpressionValue(this.getCurrentAssemblyAddress())
      );
    }

    // --- Clean up the hanging label
    this._overflowLabelLine = null;

    // --- Fixup the temporary scope over the iteration scope, if there is any
    const topScope = this.getTopLocalScope();
    if (topScope !== procScope && topScope.isTemporaryScope) {
      this.fixupSymbols(topScope, false);
      this._currentModule.localScopes.pop();
    }

    // --- Fixup the symbols locally
    this.fixupSymbols(procScope, false);

    // --- Clean up the loop's scope
    this._currentModule.localScopes.pop();
  }

  /**
   * Processes LOCAL statement
   * @param localStmt LOCAL statement
   */
  private processLocalStatement(localStmt: LocalStatement): void {
    if (this.isInGlobalScope) {
      this.reportAssemblyError("Z2065", localStmt);
      return;
    }

    const localScopes = this._currentModule.localScopes;
    let scope: SymbolScope | null = localScopes[localScopes.length - 1];
    if (scope.isTemporaryScope) {
      const tmpScope = localScopes.pop();
      scope =
        localScopes.length > 0 ? localScopes[localScopes.length - 1] : null;
      localScopes.push(tmpScope);
    }

    if (!scope || !scope.isProcScope) {
      this.reportAssemblyError("Z2065", localStmt);
    }
  }

  /**
   * Processes the MODULE statement
   * @param moduleStmt Module statement
   * @param label Module label
   * @param allLines All parsed lines
   * @param scopeLines Lines to process in the current scope
   * @param currentLineIndex Current line index
   */
  private processModuleStatement(
    moduleStmt: ModuleStatement,
    label: string,
    allLines: Z80AssemblyLine[],
    scopeLines: Z80AssemblyLine[],
    currentLineIndex: { index: number }
  ): void {
    // --- Search for the end of the proc
    const firstLine = currentLineIndex.index;
    const searchResult = this.searchForEndStatement(
      "ModuleStatement",
      scopeLines,
      currentLineIndex
    );
    if (!searchResult.found) {
      return;
    }

    // --- End found
    const lastLine = currentLineIndex.index;

    // --- Process label
    const moduleName = moduleStmt.identifier
      ? moduleStmt.identifier.name
      : label;
    if (!moduleName) {
      this.reportAssemblyError("Z2066", moduleStmt);
      return;
    }
    if (moduleName.startsWith("`")) {
      this.reportAssemblyError("Z2067", moduleStmt, null, moduleName);
      return;
    }
    if (this._currentModule.containsNestedModule(moduleName)) {
      this.reportAssemblyError("Z2068", moduleStmt, null, moduleName);
      return;
    }

    // --- Create a new nested module
    const newModule = new AssemblyModule(
      this._currentModule,
      this.isCaseSensitive
    );
    this._currentModule.addNestedModule(moduleName, newModule);
    this._currentModule = newModule;

    // --- The module has a label, so create a temporary scope, too
    const newScope = new SymbolScope(null, this.isCaseSensitive);
    newScope.isTemporaryScope = true;
    newModule.localScopes.push(newScope);

    // --- Emit module instructions
    const moduleLineIndex = { index: firstLine + 1 };
    while (moduleLineIndex.index < lastLine) {
      const curLine = scopeLines[moduleLineIndex.index];
      this.emitSingleLine(allLines, scopeLines, curLine, moduleLineIndex);
      moduleLineIndex.index++;
    }

    // --- Add the end label to the local scope
    const endLabel = searchResult.label;
    if (endLabel) {
      // --- Add the end label to the loop scope
      this.addSymbol(
        endLabel,
        scopeLines[currentLineIndex.index],
        new ExpressionValue(this.getCurrentAssemblyAddress())
      );
    }

    // --- Clean up the hanging label
    this._overflowLabelLine = null;

    // --- Fixup the temporary scope over the iteration scope, if there is any
    const topScope = this.getTopLocalScope();
    if (topScope && topScope.isTemporaryScope) {
      this.fixupSymbols(topScope, false);
      this._currentModule.localScopes.pop();
    }

    // --- Fixup the symbols locally
    this.fixupSymbols(newModule, false);

    // --- Step back to the outer module
    this._currentModule = newModule.parentModule;
  }

  /**
   * Searches the assembly lines for the end of the block
   * @param searchType Line type to search for
   * @param lines Lines to search in
   * @param endType Type of end statement
   * @param currentLineIndex
   */
  private searchForEndStatement(
    searchType: Statement["type"],
    lines: Z80AssemblyLine[],
    currentLineIndex: { index: number }
  ): { found: boolean; label?: string } {
    let endLabel: string | undefined;
    if (currentLineIndex.index >= lines.length) {
      return { found: false };
    }

    const endStmt = this.getEndStatementInfo(searchType);
    if (!endStmt) {
      return { found: false };
    }

    const endType = endStmt.type;
    const endDisplayName = endStmt.displayName;

    // --- Store the start line for error reference
    const startLine = lines[currentLineIndex.index];
    currentLineIndex.index++;

    // --- Iterate through lines
    while (currentLineIndex.index < lines.length) {
      var curLine = lines[currentLineIndex.index];
      if (curLine.type === endType) {
        // --- We have found the end line, get its label
        return {
          found: true,
          label: curLine.label ? curLine.label.name : endLabel,
        };
      }

      if (
        curLine.type === "CommentOnlyLine" ||
        curLine.type === "LabelOnlyLine"
      ) {
        // --- Record the last hanging label
        endLabel = curLine.label ? curLine.label.name : null;
      } else {
        endLabel = undefined;
        if (((curLine as any) as Statement).isBlock) {
          var nestedSearch = this.searchForEndStatement(
            ((curLine as any) as Statement).type,
            lines,
            currentLineIndex
          );
          if (!nestedSearch.found) {
            this.reportAssemblyError("Z2052", startLine, null, endDisplayName);
            return { found: false };
          }
        }
      }
      currentLineIndex.index++;
    }
    this.reportAssemblyError("Z2052", startLine, null, endDisplayName);
    return { found: false };
  }

  /**
   * Gets information about the end of a statement
   * @param stmtType Statement to check
   */
  private getEndStatementInfo(
    stmtType: Statement["type"]
  ): { type: Statement["type"]; displayName: string } | null {
    let type: Statement["type"] | undefined;
    let displayName: string | undefined;
    switch (stmtType) {
      case "MacroStatement":
        type = "MacroEndStatement";
        displayName = ".macro";
        break;
      case "LoopStatement":
        type = "LoopEndStatement";
        displayName = ".loop";
        break;
      case "WhileStatement":
        type = "WhileEndStatement";
        displayName = ".while";
        break;
      case "RepeatStatement":
        type = "UntilStatement";
        displayName = ".repeat";
        break;
      case "ForStatement":
        type = "NextStatement";
        displayName = ".for";
        break;
      case "IfStatement":
        type = "EndIfStatement";
        displayName = ".if";
        break;
      case "IfUsedStatement":
        type = "EndIfStatement";
        displayName = ".ifused";
        break;
      case "IfNUsedStatement":
        type = "EndIfStatement";
        displayName = ".infused";
        break;
      case "ModuleStatement":
        type = "ModuleEndStatement";
        displayName = ".module";
        break;
      case "ModuleStatement":
        type = "ModuleEndStatement";
        displayName = ".module";
        break;
      case "ProcStatement":
        type = "ProcEndStatement";
        displayName = ".proc";
        break;
      case "StructStatement":
        type = "StructEndStatement";
        displayName = ".struct";
        break;
    }

    if (!type || !displayName) {
      return null;
    }
    return { type, displayName };
  }

  // ==========================================================================
  // Z80 instruction processing methods

  /**
   * Emits code for the specified operation
   * @param opLine Operation to emit the code for
   */
  private emitAssemblyOperationCode(opLine: Z80AssemblyLine): void {
    if (opLine.type === "SimpleZ80Instruction") {
      const mnemonic = ((opLine as unknown) as SimpleZ80Instruction).mnemonic.toLowerCase();

      // --- Get the op codes for the instruction
      if (
        nextInstructionCodes[mnemonic] !== undefined &&
        this._output.modelType !== SpectrumModelType.Next
      ) {
        this.reportAssemblyError("Z5001", opLine);
        return;
      }
      const opCodes = simpleInstructionCodes[mnemonic];
      if (opCodes === undefined) {
        this.reportEvaluationError("Z2023", opLine, null, mnemonic);
      }

      // --- Emit the opcode(s);
      this.emitOpCode(opCodes);
      return;
    }
    const instr = opLine as Instruction;
    switch (instr.type) {
      case "NextRegInstruction":
        this.processNextRegInst(instr);
        break;
      case "PushInstruction":
      case "PopInstruction":
        this.processStackInst(instr);
        break;
      case "CallInstruction":
        this.processCallInst(instr);
        break;
      case "JpInstruction":
        this.processJpInst(instr);
        break;
      case "JrInstruction":
        this.processJrInst(instr);
        break;
      case "RetInstruction":
        this.processRetInst(instr);
        break;
      case "RstInstruction":
        this.processRstInst(instr);
        break;
      case "DjnzInstruction":
        this.emitJumpRelativeOp(instr, instr.target, 0x10);
        break;
      case "ImInstruction":
        this.processImInst(instr);
        break;
      case "IncInstruction":
      case "DecInstruction":
        this.processIncDecInst(instr);
        break;
      case "LdInstruction":
        this.processLdInst(instr);
        break;
      case "ExInstruction":
        this.processExInst(instr);
        break;
      case "AddInstruction":
      case "AdcInstruction":
      case "SbcInstruction":
        this.processAlu1Inst(instr);
        break;
      case "SubInstruction":
      case "AndInstruction":
      case "XorInstruction":
      case "OrInstruction":
      case "CpInstruction":
        this.processAlu2Inst(instr);
        break;
      case "InInstruction":
        this.processInInst(instr);
        break;
      case "OutInstruction":
        this.processOutInst(instr);
        break;
      case "RlcInstruction":
      case "RrcInstruction":
      case "RlInstruction":
      case "RrInstruction":
      case "SlaInstruction":
      case "SraInstruction":
      case "SllInstruction":
      case "SrlInstruction":
        this.processShiftRotateInst(instr);
        break;
      case "BitInstruction":
        this.processBitInst(instr, 0x40);
        break;
      case "ResInstruction":
        this.processBitInst(instr, 0x80);
        break;
      case "SetInstruction":
        this.processBitInst(instr, 0xc0);
        break;
      case "TestInstruction":
        this.processTestInst(instr);
        break;
    }
  }

  /**
   * Processes a MUL instruction
   * @param op Instruction
   */
  private processNextRegInst(op: NextRegInstruction): void {
    if (this.invalidNextInst(op)) {
      return;
    }
    if (op.value !== null) {
      this.emitOpCode(0xed91);
      this.emitNumericExpr(op, op.register, FixupType.Bit8);
      this.emitNumericExpr(op, op.value, FixupType.Bit8);
    } else {
      this.emitOpCode(0xed92);
      this.emitNumericExpr(op, op.register, FixupType.Bit8);
    }
  }

  /**
   * Processes a PUSH or POP operation
   * @param op Instruction
   */
  private processStackInst(op: PushInstruction | PopInstruction): void {
    switch (op.operand.operandType) {
      case OperandType.Expression:
        // --- PUSH NNNN operation
        if (op.type === "PopInstruction") {
          this.reportAssemblyError("Z5000", op);
          return;
        }
        if (this.invalidNextInst(op)) {
          return;
        }
        this.emitOpCode(0xed8a);
        this.emitNumericExpr(op, op.operand.expr, FixupType.Bit16Be);
        return;
      case OperandType.Reg16:
      case OperandType.Reg16Spec:
      case OperandType.Reg16Idx:
        let opcode = popOpBytes[op.operand.register];
        if (opcode) {
          if (op.type === "PushInstruction") {
            opcode |= 0x04;
          }
          this.emitOpCode(opcode);
          return;
        }
    }
    this.reportAssemblyError("Z5002", op);
  }

  /**
   * Processes a CALL operation
   * @param op Instruction
   */
  private processCallInst(op: CallInstruction): void {
    if (op.condition) {
      const order = conditionOrder[op.condition] ?? 0;
      this.emitOpCode(0xc4 + order * 8);
    } else {
      this.emitOpCode(0xcd);
    }
    this.emitNumericExpr(op, op.target, FixupType.Bit16);
  }

  /**
   * Processes a JP operation
   * @param op Instruction
   */
  private processJpInst(op: JpInstruction): void {
    if (op.condition) {
      const order = conditionOrder[op.condition] ?? 0;
      if (op.target.operandType !== OperandType.Expression) {
        this.reportAssemblyError("Z1003", op);
        return;
      }
      this.emitOpCode(0xc2 + order * 8);
      this.emitNumericExpr(op, op.target.expr, FixupType.Bit16);
    } else {
      switch (op.target.operandType) {
        case OperandType.CPort:
          this.emitOpCode(0xed98);
          return;
        case OperandType.Reg16:
        case OperandType.RegIndirect:
          if (op.target.register !== "hl") {
            break;
          }
          this.emitOpCode(0xe9);
          return;
        case OperandType.IndexedIndirect:
          if (op.target.offsetSign) {
            break;
          }
        // --- Flow to the next label is intentional
        case OperandType.Reg16Idx:
          if (op.target.register === "ix") {
            this.emitOpCode(0xdde9);
            return;
          }
          if (op.target.register === "iy") {
            this.emitOpCode(0xfde9);
            return;
          }
          break;
        case OperandType.Expression:
          this.emitOpCode(0xc3);
          this.emitNumericExpr(op, op.target.expr, FixupType.Bit16);
          return;
      }
      this.reportAssemblyError("Z2043", op);
    }
  }

  /**
   * Processes a JR operation
   * @param op Instruction
   */
  private processJrInst(op: JrInstruction): void {
    let opCode = 0x18;
    if (op.condition) {
      const order = conditionOrder[op.condition] ?? 0;
      if (order >= 4) {
        this.reportAssemblyError("Z2044", op);
        return;
      }
      opCode = 0x20 + order * 8;
    }
    this.emitJumpRelativeOp(op, op.target, opCode);
  }

  /**
   * Processes a RET operation
   * @param op Instruction
   */
  private processRetInst(op: RetInstruction): void {
    if (op.condition) {
      const order = conditionOrder[op.condition] ?? 0;
      this.emitByte(0xc0 + order * 8);
      return;
    }
    this.emitOpCode(0xc9);
  }

  /**
   * Processes an RST operation
   * @param op Instruction
   */
  private processRstInst(op: RstInstruction): void {
    const value = this.evaluateExprImmediate(op.target).value;
    if (value > 0x38 || value % 8 !== 0) {
      this.reportAssemblyError("Z2046", op, null, value);
      return;
    }
    this.emitOpCode(0xc7 + value);
  }

  /**
   * Processes an IM operation
   * @param op Instruction
   */
  private processImInst(op: ImInstruction): void {
    const value = this.evaluateExprImmediate(op.mode).value;
    if (value < 0 || value > 2) {
      this.reportAssemblyError("Z2047", op, null, value);
      return;
    }
    this.emitOpCode([0xed46, 0xed56, 0xed5e][value]);
  }

  /**
   * Processes an EX operation
   * @param op Instruction
   */
  private processExInst(op: ExInstruction): void {
    switch (op.operand1.operandType) {
      case OperandType.Reg16Spec:
        if (op.operand1.register === "af") {
          if (op.operand2.register === "af'") {
            this.emitOpCode(0x08);
            return;
          }
        }
        break;
      case OperandType.Reg16:
        if (op.operand1.register === "de") {
          if (op.operand2.register === "hl") {
            this.emitOpCode(0xeb);
            return;
          }
        }
        break;
      case OperandType.RegIndirect:
        if (op.operand1.register !== "sp") {
          break;
        }
        if (op.operand2.register === "hl") {
          this.emitOpCode(0xe3);
          return;
        } else if (op.operand2.operandType === OperandType.Reg16Idx) {
          this.emitOpCode(op.operand2.register === "ix" ? 0xdde3 : 0xfde3);
          return;
        }
        break;
    }
    this.reportAssemblyError("Z2043", op);
  }

  /**
   * Processes an IN operation
   * @param op Instruction
   */
  private processInInst(op: InInstruction): void {
    switch (op.operand1.operandType) {
      case OperandType.CPort:
        if (op.operand2) {
          break;
        }
        this.emitOpCode(0xed70);
        return;
      case OperandType.Reg8:
        if (!op.operand2) {
          break;
        }
        if (op.operand1.register === "a") {
          if (op.operand2.operandType === OperandType.MemIndirect) {
            this.emitOpCode(0xdb);
            this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit8);
            return;
          }
          if (op.operand2.operandType === OperandType.CPort) {
            this.emitOpCode(0xed78);
            return;
          }
        }
        if (op.operand2?.operandType !== OperandType.CPort) {
          break;
        }
        this.emitOpCode(0xed40 + 8 * reg8Order[op.operand1.register]);
        return;
    }
    this.reportAssemblyError("Z2043", op);
  }

  /**
   * Processes an OUT operation
   * @param op Instruction
   */
  private processOutInst(op: OutInstruction): void {
    switch (op.operand1.operandType) {
      case OperandType.MemIndirect:
        if (!op.operand2) {
          break;
        }
        if (op.operand2.register === "a") {
          this.emitOpCode(0xd3);
          this.emitNumericExpr(op, op.operand1.expr, FixupType.Bit8);
          return;
        }
        break;
      case OperandType.CPort:
        if (!op.operand2) {
          break;
        }
        if (op.operand2.operandType === OperandType.Reg8) {
          this.emitOpCode(0xed41 + 8 * reg8Order[op.operand2.register]);
          return;
        }
        if (op.operand2.operandType !== OperandType.Expression) {
          break;
        }
        const value = this.evaluateExprImmediate(op.operand2.expr).value;
        if (value !== 0) {
          this.reportAssemblyError("Z2048", op);
        } else {
          this.emitOpCode(0xed71);
        }
        return;
    }
    this.reportAssemblyError("Z2043", op);
  }

  /**
   * Processes a BIT/RES/SET operation
   * @param op Instruction
   * @param opByte Operation base value
   */
  private processBitInst(
    op: BitInstruction | ResInstruction | SetInstruction,
    opByte: number
  ): void {
    if (op.operand1.operandType !== OperandType.Expression) {
      this.reportAssemblyError("Z2043", op);
      return;
    }
    const bitIndex = this.evaluateExprImmediate(op.operand1.expr).value;
    if (bitIndex < 0 || bitIndex > 7) {
      this.reportAssemblyError("Z2049", op, null, bitIndex);
      return;
    }
    switch (op.operand2.operandType) {
      case OperandType.IndexedIndirect:
        if (op.type !== "BitInstruction") {
          if (!op.operand3) {
            opByte |= 0x06;
          } else if (op.operand3.operandType === OperandType.Reg8) {
            opByte |= reg8Order[op.operand3.register];
          } else {
            this.reportAssemblyError("Z2043", op);
            return;
          }
        } else {
          opByte |= 0x06;
        }
        this.emitIndexedBitOperation(
          (op as unknown) as Z80AssemblyLine,
          op.operand2.register,
          op.operand2.offsetSign,
          op.operand2.expr,
          opByte + 8 * bitIndex
        );
        return;
      // Flows to the next label intentionally
      case OperandType.Reg8:
        opByte |= reg8Order[op.operand2.register];
        this.emitByte(0xcb);
        this.emitByte(opByte + 8 * bitIndex);
        return;
      case OperandType.RegIndirect:
        if (op.operand2.register !== "hl") {
          break;
        }
        this.emitByte(0xcb);
        this.emitByte((opByte | 0x06) + 8 * bitIndex);
        return;
    }
    this.reportAssemblyError("Z2043", op);
  }

  /**
   * Processes an RLC/RRC/RL/RR/SLA/SRA/SLL/SRL operation
   * @param op Instruction
   */
  private processShiftRotateInst(op: ShiftRotateInstruction): void {
    let opCode = 8 * shiftOpOrder[op.type];
    let error = false;
    switch (op.operand1.operandType) {
      case OperandType.Reg8:
        opCode |= reg8Order[op.operand1.register];
        if (op.operand2) {
          error = true;
        }
        break;
      case OperandType.RegIndirect:
        if (op.operand1.register === "hl") {
          opCode |= 0x06;
          if (op.operand2) {
            error = true;
          }
        } else {
          error = true;
        }
        break;
      case OperandType.IndexedIndirect:
        if (!op.operand2) {
          opCode |= 0x06;
        } else if (op.operand2.operandType !== OperandType.Reg8) {
          error = true;
          break;
        } else {
          opCode |= reg8Order[op.operand2.register];
        }
        this.emitIndexedBitOperation(
          (op as unknown) as Z80AssemblyLine,
          op.operand1.register,
          op.operand1.offsetSign,
          op.operand1.expr,
          opCode
        );
        return;
      default:
        error = true;
        break;
    }
    if (error) {
      this.reportAssemblyError("Z2043", op);
    } else {
      this.emitByte(0xcb);
      this.emitByte(opCode);
    }
  }

  /**
   * Processes an INC/DEC operation
   * @param op Instruction
   */
  private processIncDecInst(op: IncInstruction | DecInstruction): void {
    switch (op.operand.operandType) {
      case OperandType.Reg8:
        this.emitOpCode(
          (op.type === "IncInstruction" ? 0x04 : 0x05) +
            8 * reg8Order[op.operand.register]
        );
        return;
      case OperandType.Reg8Idx:
      case OperandType.Reg16:
      case OperandType.Reg16Idx:
        this.emitOpCode(
          op.type === "IncInstruction"
            ? incOpCodes[op.operand.register]
            : decOpCodes[op.operand.register]
        );
        return;
      case OperandType.RegIndirect:
        if (op.operand.register !== "hl") {
          break;
        }
        this.emitOpCode(op.type === "IncInstruction" ? 0x34 : 0x35);
        return;
      case OperandType.IndexedIndirect:
        this.emitIndexedOperation(
          (op as unknown) as Z80AssemblyLine,
          op.operand,
          op.type === "IncInstruction" ? 0x34 : 0x35
        );
        return;
    }
    this.reportAssemblyError("Z2043", op);
  }

  /**
   * Processes a ADD/ADC/SBC operation
   * @param op Instruction
   */
  private processAlu1Inst(
    op: AddInstruction | AdcInstruction | SbcInstruction
  ): void {
    const aluIdx = aluOpOrder[op.type];
    switch (op.operand1.operandType) {
      case OperandType.Reg8:
        if (op.operand1.register !== "a") {
          this.reportAssemblyError("Z2051", op);
          return;
        }
        switch (op.operand2.operandType) {
          case OperandType.Reg8:
            this.emitOpCode(
              0x80 + aluIdx * 8 + reg8Order[op.operand2.register]
            );
            return;
          case OperandType.RegIndirect:
            if (op.operand2.register !== "hl") {
              break;
            }
            this.emitOpCode(0x86 + aluIdx * 8);
            return;
          case OperandType.Reg8Idx:
            this.emitByte(op.operand2.register.indexOf("x") >= 0 ? 0xdd : 0xfd);
            this.emitByte(
              aluIdx * 8 + (op.operand2.register.endsWith("h") ? 0x84 : 0x85)
            );
            return;
          case OperandType.IndexedIndirect:
            this.emitIndexedOperation(
              (op as unknown) as Z80AssemblyLine,
              op.operand2,
              0x86 + aluIdx * 8
            );
            return;
          case OperandType.Expression:
            this.emitOpCode(0xc6 + aluIdx * 8);
            this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit8);
            return;
        }
        break;

      case OperandType.Reg16:
        switch (op.operand2.operandType) {
          case OperandType.Reg16:
            if (op.operand1.register !== "hl") {
              break;
            }
            let opCodeBase = 0xed42;
            if (op.type === "AddInstruction") {
              opCodeBase = 0x09;
            } else if (op.type === "AdcInstruction") {
              opCodeBase = 0xed4a;
            }
            this.emitOpCode(opCodeBase + reg16Order[op.operand2.register] * 16);
            return;
          case OperandType.Reg8:
            if (
              this.invalidNextInst(op) ||
              op.operand1.register === "sp" ||
              op.operand2.register !== "a"
            ) {
              break;
            }
            {
              let opCodeBase = 0xed33;
              if (op.operand1.register === "hl") {
                opCodeBase = 0xed31;
              } else if (op.operand1.register === "de") {
                opCodeBase = 0xed32;
              }
              this.emitOpCode(opCodeBase);
              return;
            }
          case OperandType.Expression:
            if (this.invalidNextInst(op) || op.operand1.register === "sp") {
              break;
            }
            {
              let opCodeBase = 0xed36;
              if (op.operand1.register === "hl") {
                opCodeBase = 0xed34;
              } else if (op.operand1.register === "de") {
                opCodeBase = 0xed35;
              }
              this.emitOpCode(opCodeBase);
              this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit16);
              return;
            }
        }
        break;

      case OperandType.Reg16Idx:
        if (op.type !== "AddInstruction") {
          break;
        }
        const opCode = op.operand1.register === "ix" ? 0xdd09 : 0xfd09;
        switch (op.operand2.operandType) {
          case OperandType.Reg16:
            if (op.operand2.register === "hl") {
              break;
            }
            this.emitOpCode(opCode + reg16Order[op.operand2.register] * 16);
            return;
          case OperandType.Reg16Idx:
            if (op.operand1.register !== op.operand2.register) {
              break;
            }
            this.emitOpCode(opCode + 0x20);
            return;
        }
        break;
    }
    this.reportAssemblyError("Z2043", op);
  }

  /**
   * Processes a SUB/AND/XOR/OR/CP operation
   * @param op Instruction
   */
  private processAlu2Inst(
    op:
      | SubInstruction
      | AndInstruction
      | XorInstruction
      | OrInstruction
      | CpInstruction
  ): void {
    let operand = op.operand1;
    let opType = op.operand1.operandType;
    let opReg = op.operand1.register;

    // --- Check for alternative syntax (A register as the first operand)
    if (op.operand2) {
      if (opType !== OperandType.Reg8 || opReg !== "a") {
        this.reportAssemblyError("Z2050", op);
        return;
      }
      operand = op.operand2;
      opType = op.operand2.operandType;
      opReg = op.operand2.register;
    }

    const aluIdx = aluOpOrder[op.type];
    switch (opType) {
      case OperandType.Reg8:
        this.emitOpCode(0x80 + aluIdx * 8 + reg8Order[opReg]);
        return;
      case OperandType.RegIndirect:
        if (opReg !== "hl") {
          break;
        }
        this.emitOpCode(0x86 + aluIdx * 8);
        return;
      case OperandType.Reg8Idx:
        this.emitByte(opReg.indexOf("x") >= 0 ? 0xdd : 0xfd);
        this.emitByte(aluIdx * 8 + (opReg.endsWith("h") ? 0x84 : 0x85));
        return;
      case OperandType.Expression:
        this.emitByte(0xc6 + aluIdx * 8);
        this.emitNumericExpr(op, operand.expr, FixupType.Bit8);
        return;
      case OperandType.IndexedIndirect:
        this.emitIndexedOperation(
          (op as unknown) as Z80AssemblyLine,
          operand,
          0x86 + aluIdx * 8
        );
        return;
    }
    this.reportAssemblyError("Z2043", op);
  }

  /**
   * Processes an LD operation
   * @param op Instruction
   */
  private processLdInst(op: LdInstruction): void {
    switch (op.operand1.operandType) {
      case OperandType.Reg8: {
        const destReg = op.operand1.register;
        const destRegIdx = reg8Order[destReg];
        const sourceReg = op.operand2.register;
        switch (op.operand2.operandType) {
          case OperandType.Reg8:
            this.emitOpCode(0x40 + destRegIdx * 8 + reg8Order[sourceReg]);
            return;

          case OperandType.RegIndirect:
            if (sourceReg === "bc" && destReg === "a") {
              this.emitOpCode(0x0a);
              return;
            } else if (sourceReg === "de" && destReg === "a") {
              this.emitOpCode(0x1a);
              return;
            } else if (sourceReg === "hl") {
              this.emitOpCode(0x46 + destRegIdx * 8);
              return;
            }
            break;

          case OperandType.Reg8Spec:
            if (destReg !== "a") {
              break;
            }
            this.emitOpCode(sourceReg === "r" ? 0xed5f : 0xed57);
            return;

          case OperandType.Reg8Idx:
            if (destRegIdx >= 4 && destRegIdx <= 6) {
              break;
            }
            this.emitOpCode(
              (sourceReg.indexOf("x") >= 0 ? 0xdd44 : 0xfd44) +
                destRegIdx * 8 +
                (sourceReg.endsWith("h") ? 0 : 1)
            );
            return;

          case OperandType.Expression:
            this.emitOpCode(0x06 + destRegIdx * 8);
            this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit8);
            return;

          case OperandType.MemIndirect:
            if (destReg !== "a") {
              break;
            }
            this.emitOpCode(0x3a);
            this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit16);
            return;

          case OperandType.IndexedIndirect:
            this.emitIndexedOperation(
              (op as unknown) as Z80AssemblyLine,
              op.operand2,
              0x46 + destRegIdx * 8
            );
            return;
        }
        break;
      }

      case OperandType.Reg8Idx:
        {
          const destReg = op.operand1.register;
          const sourceReg = op.operand2.register;
          switch (op.operand2.operandType) {
            case OperandType.Reg8:
              const sourceRegIdx = reg8Order[op.operand2.register];
              if (sourceRegIdx >= 4 && sourceRegIdx <= 6) {
                break;
              }
              this.emitOpCode(
                (destReg.indexOf("x") >= 0 ? 0xdd60 : 0xfd60) +
                  (destReg.endsWith("h") ? 0 : 8) +
                  sourceRegIdx
              );
              return;

            case OperandType.Reg8Idx:
              if (
                (sourceReg.indexOf("x") >= 0 && destReg.indexOf("y") >= 0) ||
                (sourceReg.indexOf("y") >= 0 && destReg.indexOf("x") >= 0)
              ) {
                break;
              }
              this.emitOpCode(
                (destReg.indexOf("x") >= 0 ? 0xdd64 : 0xfd64) +
                  (destReg.endsWith("h") ? 0 : 8) +
                  (sourceReg.endsWith("h") ? 0 : 1)
              );
              return;

            case OperandType.Expression:
              this.emitOpCode(
                (destReg.indexOf("x") >= 0 ? 0xdd26 : 0xfd26) +
                  (destReg.endsWith("h") ? 0 : 8)
              );
              this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit8);
              return;
          }
        }
        break;

      case OperandType.Reg8Spec:
        if (op.operand2.register !== "a") {
          break;
        }
        this.emitOpCode(op.operand1.register === "r" ? 0xed4f : 0xed47);
        return;

      case OperandType.RegIndirect:
        {
          const destReg = op.operand1.register;
          switch (op.operand2.operandType) {
            case OperandType.Reg8:
              const sourceReg = op.operand2.register;
              if (destReg === "bc" && sourceReg === "a") {
                this.emitOpCode(0x02);
                return;
              } else if (destReg === "de" && sourceReg === "a") {
                this.emitOpCode(0x12);
                return;
              } else if (destReg === "hl") {
                this.emitOpCode(0x70 + reg8Order[sourceReg]);
                return;
              }
              break;

            case OperandType.Expression:
              if (destReg !== "hl") {
                break;
              }
              this.emitByte(0x36);
              this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit8);
              return;
          }
        }
        break;

      case OperandType.MemIndirect: {
        let opCode = 0x00;
        switch (op.operand2.operandType) {
          case OperandType.Reg8:
            if (op.operand2.register !== "a") {
              break;
            }
            opCode = 0x32;
            break;

          case OperandType.Reg16:
            const sourceReg = op.operand2.register;
            opCode = 0x22;
            if (sourceReg === "bc") {
              opCode = 0xed43;
            } else if (sourceReg === "de") {
              opCode = 0xed53;
            } else if (sourceReg === "sp") {
              opCode = 0xed73;
            }
            break;

          case OperandType.Reg16Idx:
            opCode = op.operand2.register === "ix" ? 0xdd22 : 0xfd22;
            break;
        }
        if (!opCode) {
          break;
        }
        this.emitOpCode(opCode);
        this.emitNumericExpr(op, op.operand1.expr, FixupType.Bit16);
        return;
      }

      case OperandType.Reg16:
        {
          const destReg = op.operand1.register;
          const sourceReg = op.operand2.register;
          switch (op.operand2.operandType) {
            case OperandType.MemIndirect:
              let opCode = 0x2a;
              if (destReg === "bc") {
                opCode = 0xed4b;
              } else if (destReg === "de") {
                opCode = 0xed5b;
              } else if (destReg === "sp") {
                opCode = 0xed7b;
              }
              this.emitOpCode(opCode);
              this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit16);
              return;

            case OperandType.Expression:
              this.emitOpCode(0x01 + reg16Order[op.operand1.register] * 16);
              this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit16);
              return;

            default: {
              if (destReg !== "sp") {
                break;
              }
              let opCode = 0xf9;
              if (sourceReg === "ix") {
                opCode = 0xddf9;
              } else if (sourceReg === "iy") {
                opCode = 0xfdf9;
              } else if (sourceReg !== "hl") {
                break;
              }
              this.emitOpCode(opCode);
              return;
            }
          }
        }
        break;

      case OperandType.Reg16Idx:
        {
          const destReg = op.operand1.register;
          switch (op.operand2.operandType) {
            case OperandType.MemIndirect:
              this.emitOpCode(destReg === "ix" ? 0xdd2a : 0xfd2a);
              this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit16);
              return;

            case OperandType.Expression:
              this.emitOpCode(destReg === "ix" ? 0xdd21 : 0xfd21);
              this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit16);
              return;
          }
        }
        break;

      case OperandType.IndexedIndirect: {
        switch (op.operand2.operandType) {
          case OperandType.Reg8:
            this.emitIndexedOperation(
              (op as unknown) as Z80AssemblyLine,
              op.operand1,
              0x70 + reg8Order[op.operand2.register]
            );
            return;
          case OperandType.Expression:
            this.emitIndexedOperation(
              (op as unknown) as Z80AssemblyLine,
              op.operand1,
              0x36
            );
            this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit8);
            return;
        }
        break;
      }
    }
    this.reportAssemblyError("Z2043", op);
  }

  /**
   * Processes a TEST operation
   * @param op Instruction
   */
  private processTestInst(op: TestInstruction): void {
    if (this.invalidNextInst(op)) {
      return;
    }
    this.emitOpCode(0xed27);
    this.emitNumericExpr(op, op.expr, FixupType.Bit8);
  }

  /**
   * Checks if the specified operation results an error as it
   * can be used only with the ZX Spectrum Next
   * @param op Instruction to test
   */
  private invalidNextInst(op: Instruction): boolean {
    if (this._output.modelType !== SpectrumModelType.Next) {
      this.reportAssemblyError("Z5001", op);
      return true;
    }
    return false;
  }

  /**
   * Evaluates the expression and emits bytes accordingly. If the expression
   * cannot be resolved, creates a fixup.
   * @param opLine Assembly line
   * @param expr Expression to evaluate
   * @param type Expression/Fixup type
   */
  private emitNumericExpr(
    instr: Instruction,
    expr: Expression,
    type: FixupType
  ): void {
    const opLine = (instr as unknown) as Z80AssemblyLine;
    let value = this.evaluateExpr(expr);
    if (value.isNonEvaluated) {
      this.recordFixup(opLine, type, expr);
    }
    if (value.isValid && value.type === ExpressionValueType.String) {
      this.reportAssemblyError("Z2042", opLine);
      value = new ExpressionValue(0);
    }
    const fixupValue = value.value;
    if (type === FixupType.Bit16Be) {
      this.emitByte(fixupValue >> 8);
      this.emitByte(fixupValue);
    } else {
      this.emitByte(fixupValue);
      if (type === FixupType.Bit16) {
        this.emitByte(fixupValue >> 8);
      }
    }
  }

  /**
   *
   * @param instr Control flow operation line
   * @param target Target expression
   * @param opCode Operation code
   */
  private emitJumpRelativeOp(
    instr: Instruction,
    target: Expression,
    opCode: number
  ) {
    const value = this.evaluateExpr(target);
    let dist = 0;
    const opLine = (instr as unknown) as Z80AssemblyLine;
    if (value.isNonEvaluated) {
      this.recordFixup(opLine, FixupType.Jr, target);
    } else {
      dist = value.value - (this.getCurrentAssemblyAddress() + 2);
      if (dist < -128 || dist > 127) {
        this.reportAssemblyError("Z2045", opLine, null, dist);
        return;
      }
    }
    this.emitByte(opCode);
    this.emitByte(dist);
  }

  /**
   * Emits an indexed operation with the specified operand and operation code
   * @param opLine Operation source line
   * @param register Index register
   * @param sign Displacement sign
   * @param expr Displacement expression
   * @param opCode Operation code
   */
  private emitIndexedOperation(
    opLine: Z80AssemblyLine,
    operand: Operand,
    opCode: number
  ): void {
    const idxByte = operand.register === "ix" ? 0xdd : 0xfd;
    let dispValue = 0x00;
    let evaluated = true;
    if (operand.offsetSign) {
      const value = this.evaluateExpr(operand.expr);
      if (!value.isValid) {
        evaluated = false;
      } else {
        dispValue = value.value;
        if (operand.offsetSign === "-") {
          dispValue = -dispValue;
        }
      }
    }
    this.emitByte(idxByte);
    this.emitByte(opCode);
    if (!evaluated) {
      this.recordFixup(opLine, FixupType.Bit8, operand.expr);
    }
    this.emitByte(dispValue);
  }

  /**
   * Emits an indexed bit operation with the specified operand and operation code
   * @param opLine Operation source line
   * @param register Index register
   * @param sign Displacement sign
   * @param expr Displacement expression
   * @param opCode Operation code
   */
  private emitIndexedBitOperation(
    opLine: Z80AssemblyLine,
    register: string,
    sign: string,
    expr: Expression,
    opCode: number
  ): void {
    const idxByte = register === "ix" ? 0xdd : 0xfd;
    let dispValue = 0x00;
    let evaluated = true;
    if (sign) {
      const value = this.evaluateExpr(expr);
      if (!value.isValid) {
        evaluated = false;
      } else {
        dispValue = value.value;
        if (sign === "-") {
          dispValue = -dispValue;
        }
      }
    }
    this.emitByte(idxByte);
    this.emitByte(0xcb);
    if (!evaluated) {
      this.recordFixup(opLine, FixupType.Bit8, expr);
    }
    this.emitByte(dispValue);
    this.emitByte(opCode);
  }

  /**
   * Emits a new byte to the current code segment
   * @param data Data byte to emit
   */
  private emitByte(data: number): void {
    this.ensureCodeSegment();
    const overflow = this._currentSegment.emitByte(data);
    if (overflow) {
      this.reportAssemblyError(overflow, this._currentSourceLine);
    }
  }

  /**
   * Emits a new word to the current code segment
   * @param data Data byte to emit
   */
  private emitWord(data: number): void {
    this.emitByte(data & 0xff);
    this.emitByte((data >> 8) & 0xff);
  }

  /**
   * Emits a byte (high 8-bit value is zero)or a word
   * @param data byte or word data
   */
  private emitOpCode(data: number): void {
    const high = (data >> 8) & 0xff;
    if (high) {
      this.emitByte(high);
    }
    this.emitByte(data & 0xff);
  }
  /**
   * Emits a string
   * @param message Expression with the string
   * @param bit7Terminator Bit 7 terminator flag
   * @param nullTerminator Null terminator flag
   * @param emitAction Action to emit a code byte
   */
  private emitString(
    message: ExpressionValue,
    bit7Terminator: boolean,
    nullTerminator: boolean,
    emitAction?: (byte: number) => void
  ): void {
    const assembler = this;
    const bytes = convertSpectrumString(message.asString());
    if (bytes.length > 1) {
      for (let i = 0; i < bytes.length - 1; i++) {
        emit(bytes.charCodeAt(i));
      }
    }
    var lastByte =
      bytes.charCodeAt(bytes.length - 1) | (bit7Terminator ? 0x80 : 0x00);
    emit(lastByte);
    if (nullTerminator) {
      emit(0x00);
    }

    // --- Emits a byte
    function emit(value: number) {
      if (emitAction) {
        const emitter = emitAction.bind(assembler);
        emitter(value);
      } else {
        assembler.emitByte(value);
      }
    }
  }

  // ==========================================================================
  // Fixup methods

  /**
   * Records fixup information for later use
   * @param opLine The source code line
   * @param type Type of fixup opration
   * @param expr Fixup expression
   * @param label Optional .equ label
   * @param structBytes Optional structure bytes
   * @param offset Fixup offset, if not the current position
   */
  private recordFixup(
    opLine: Z80AssemblyLine,
    type: FixupType,
    expr: Expression,
    label: string | null = null,
    structBytes: Map<number, number> | null = null,
    offset: number | null = null
  ): void {
    let fixupOffset = this._currentSegment.currentOffset;

    // --- Translate field invocation fixups so that field-related fixups will be
    // --- processed only after other fixups.
    if (this._currentStructInvocation) {
      fixupOffset = this._currentStructStartOffset + this._currentStructOffset;
      if (type === FixupType.Bit8) {
        type = FixupType.FieldBit8;
      } else if (type === FixupType.Bit16) {
        type = FixupType.FieldBit16;
      }
    }

    // --- Create to fixup entry to resolve
    const fixup = new FixupEntry(
      this,
      this._currentModule,
      opLine,
      type,
      this._output.segments.length - 1,
      offset ?? fixupOffset,
      expr,
      label,
      structBytes
    );

    // --- Record fixups in every local scope up to the root
    for (const scope of this._currentModule.localScopes) {
      scope.fixups.push(fixup);
    }

    // --- Record fixup in every module up to the root
    var currentModule = this._currentModule;
    while (currentModule) {
      currentModule.fixups.push(fixup);
      currentModule = currentModule.parentModule;
    }
  }

  /**
   * Evaluates the fixup entry
   * @param fixup Fixup item
   * @param numericOnly Signs if only numeric expressions are expected
   * @param signNotEvaluable Raise error if the symbol is not evaluable
   */
  private evaluateFixupExpression(
    fixup: FixupEntry,
    numericOnly: boolean,
    signNotEvaluable: boolean
  ): { success: boolean; value: ExpressionValue } {
    let exprValue = new ExpressionValue(0);
    if (!this.readyToEvaluate(fixup.expression)) {
      if (!signNotEvaluable) {
        return {
          success: false,
          value: ExpressionValue.NonEvaluated,
        };
      }
    }

    // --- Now, resolve the fixup
    exprValue = fixup.doEvalExpression(fixup.expression);

    if (!exprValue.isValid) {
      return { success: false, value: ExpressionValue.Error };
    }
    if (numericOnly && exprValue.type === ExpressionValueType.String) {
      this.reportAssemblyError("Z2042", fixup.getSourceLine());
      return { success: false, value: ExpressionValue.Error };
    }

    fixup.resolved = true;
    return { success: true, value: exprValue };
  }

  /**
   * Tries to create fixups in the specified scope
   * @param fixups Fixup entries in the scope
   * @param symbols Symbols in the scope
   * @param signNotEvaluable Raise error if the symbol is not evaluable
   */
  private fixupSymbols(
    scope: ISymbolScope,
    signNotEvaluable: boolean
  ): boolean {
    // --- #1: fix the .equ values
    let success = true;
    for (const equ of scope.fixups.filter(
      (f) => f.type === FixupType.Equ && !f.resolved
    )) {
      const evalResult = this.evaluateFixupExpression(
        equ,
        false,
        signNotEvaluable
      );
      if (evalResult.success) {
        const symbolInfo = scope.getSymbol(equ.label);
        if (symbolInfo) {
          symbolInfo.value = evalResult.value;
        } else {
          scope.addSymbol(
            equ.label,
            AssemblySymbolInfo.createLabel(equ.label, evalResult.value)
          );
        }
      } else {
        success = false;
      }
    }

    // --- #2: fix Bit8, Bit16, Jr, Ent, Xent
    for (const fixup of scope.fixups.filter(
      (f) =>
        !f.resolved &&
        (f.type === FixupType.Bit8 ||
          f.type === FixupType.Bit16 ||
          f.type === FixupType.Jr ||
          f.type === FixupType.Ent ||
          f.type === FixupType.Xent)
    )) {
      const evalResult = this.evaluateFixupExpression(
        fixup,
        true,
        signNotEvaluable
      );

      if (evalResult.success) {
        const segment = this._output.segments[fixup.segmentIndex];
        const emittedCode = segment.emittedCode;
        switch (fixup.type) {
          case FixupType.Bit8:
            emittedCode[fixup.offset] = evalResult.value.asByte();
            break;

          case FixupType.Bit16:
            emittedCode[fixup.offset] = evalResult.value.asByte();
            emittedCode[fixup.offset + 1] = evalResult.value.asWord() >> 8;
            break;

          case FixupType.Jr:
            // --- Check for Relative address
            var currentAssemblyAddress =
              segment.startAddress +
              ((segment.startAddress + fixup.offset >= segment.dispPragmaOffset
                ? segment.displacement ?? 0
                : 0) &
                0xffff) +
              fixup.offset;
            var dist = evalResult.value.asWord() - (currentAssemblyAddress + 2);
            if (dist < -128 || dist > 127) {
              this.reportAssemblyError("Z2045", fixup.sourceLine, null, dist);
              success = false;
              break;
            }
            emittedCode[fixup.offset + 1] = dist & 0xff;
            break;

          case FixupType.Ent:
            this._output.entryAddress = evalResult.value.asWord();
            break;

          case FixupType.Xent:
            this._output.exportEntryAddress = evalResult.value.asWord();
            break;
        }
      } else {
        success = false;
      }
    }

    // --- #3: fix Struct
    for (const fixup of scope.fixups.filter(
      (f) => !f.resolved && f.type === FixupType.Struct
    )) {
      const segment = this._output.segments[fixup.segmentIndex];
      const emittedCode = segment.emittedCode;

      // --- Override structure bytes
      for (const key of fixup.structBytes.keys()) {
        const entry = fixup.structBytes.get(key);
        const offset = fixup.offset + key;
        emittedCode[offset] = entry;
      }
    }

    // --- #4: fix FieldBit8, and FieldBit16
    for (const fixup of scope.fixups.filter(
      (f) =>
        !f.resolved &&
        (f.type === FixupType.FieldBit8 || f.type === FixupType.FieldBit16)
    )) {
      const evalResult = this.evaluateFixupExpression(
        fixup,
        true,
        signNotEvaluable
      );
      if (evalResult.success) {
        var segment = this._output.segments[fixup.segmentIndex];
        var emittedCode = segment.emittedCode;

        switch (fixup.type) {
          case FixupType.FieldBit8:
            emittedCode[fixup.offset] = evalResult.value.asByte();
            break;

          case FixupType.FieldBit16:
            emittedCode[fixup.offset] = evalResult.value.asByte();
            emittedCode[fixup.offset + 1] = evalResult.value.asWord() >> 8;
            break;
        }
      } else {
        success = false;
      }
    }
    return success;
  }

  /**
   * Checks if there's a temporary scope, and dispoese it after a fixup.
   */
  private fixupTemporaryScope(): void {
    if (this._currentModule.localScopes.length === 0) {
      return;
    }
    const topScope = this.getTopLocalScope();
    if (topScope.isTemporaryScope) {
      this.fixupSymbols(topScope, false);
      this._currentModule.localScopes.pop();
    }
  }

  // ==========================================================================
  // Error reporting
  /**
   * Translates a parser error into an assembler error
   * @param sourceItem Source information to allow tracking the filename in which
   * the error occurred
   * @param error The error raised by the parser
   */
  private reportParserError(
    sourceItem: SourceFileItem,
    error: ParserErrorMessage
  ): void {
    const errorInfo = new AssemblerErrorInfo(
      error.code,
      sourceItem.filename,
      error.position,
      null,
      error.text
    );
    this._output.errors.push(errorInfo);
    this.reportScopeError(error.code);
  }

  /**
   * Reports an assembly error
   * @param code Error code
   * @param sourceLine Assembly line of the error
   * @param parameters Optional parameters to report
   */
  private reportAssemblyError(
    code: ErrorCodes,
    sourceLine: PartialZ80AssemblyLine,
    nodePosition?: NodePosition | null,
    ...parameters: any[]
  ): void {
    if (!(sourceLine as any).fileIndex === undefined) {
      return;
    }
    const line = sourceLine as Z80AssemblyLine;
    const sourceItem = this._output.sourceFileList[line.fileIndex];
    let errorText: string = errorMessages[code] ?? "Unkonwn error";
    if (parameters) {
      parameters.forEach(
        (o, idx) =>
          (errorText = replace(
            errorText,
            `{${idx}}`,
            parameters[idx].toString()
          ))
      );
    }
    const errorInfo = new AssemblerErrorInfo(
      code,
      sourceItem.filename,
      nodePosition ? nodePosition.startPosition : line.startPosition,
      nodePosition ? nodePosition.endPosition : line.endPosition,
      errorText
    );
    this._output.errors.push(errorInfo);
    this.reportScopeError(code);

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
   * Administer the error in the local scope
   * @param errorCode
   */
  private reportScopeError(errorCode: ErrorCodes): void {
    if (this._output.localScopes.length === 0) {
      // --- No local scopes, no administration
      return;
    }

    let localScope = this._output.localScopes[
      this._output.localScopes.length - 1
    ];
    if (localScope.ownerScope) {
      localScope = localScope.ownerScope;
    }
    localScope.reportError(errorCode);
  }

  /**
   *
   * @param code Checks if the specified error should be reported
   * in the local scope
   */
  private shouldReportErrorInCurrentScope(code: ErrorCodes): boolean {
    if (this.isInGlobalScope) {
      return true;
    }
    let localScope = this.getTopLocalScope();
    if (localScope.ownerScope) {
      localScope = localScope.ownerScope;
    }
    return !localScope.isErrorReported(code);
  }
}

/**
 * Keep track of directive stack
 */
interface ProcessOps {
  ops: boolean;
}

/**
 * Represents the operation codes for simple Z80 instructions.
 */
const simpleInstructionCodes: { [key: string]: number } = {
  bsla: 0xed28,
  bsra: 0xed29,
  bsrl: 0xed2a,
  bsrf: 0xed2b,
  brlc: 0xed2c,
  ccf: 0x3f,
  cpd: 0xeda9,
  cpdr: 0xedb9,
  cpi: 0xeda1,
  cpir: 0xedb1,
  cpl: 0x2f,
  daa: 0x27,
  di: 0xf3,
  ei: 0xfb,
  exx: 0xd9,
  halt: 0x76,
  ind: 0xedaa,
  indr: 0xedba,
  ini: 0xeda2,
  inir: 0xedb2,
  ldd: 0xeda8,
  lddr: 0xedb8,
  lddrx: 0xedbc,
  lddx: 0xedac,
  ldi: 0xeda0,
  ldir: 0xedb0,
  ldirx: 0xedb4,
  ldix: 0xeda4,
  ldpirx: 0xedb7,
  ldws: 0xeda5,
  mirror: 0xed24,
  mul: 0xed30,
  neg: 0xed44,
  nop: 0x00,
  otdr: 0xedbb,
  otir: 0xedb3,
  outinb: 0xed90,
  outd: 0xedab,
  outi: 0xeda3,
  pixelad: 0xed94,
  pixeldn: 0xed93,
  reti: 0xed4d,
  retn: 0xed45,
  rla: 0x17,
  rlca: 0x07,
  rld: 0xed6f,
  rra: 0x1f,
  rrca: 0x0f,
  rrd: 0xed67,
  scf: 0x37,
  setae: 0xed95,
  swapnib: 0xed23,
};

/**
 * Represents the Z80 NEXT operations
 */
const nextInstructionCodes: { [key: string]: boolean } = {
  ldix: true,
  lsws: true,
  ldirx: true,
  lddx: true,
  lddrx: true,
  ldpirx: true,
  outinb: true,
  mul: true,
  swapnib: true,
  mirror: true,
  nextreg: true,
  pixeldn: true,
  pixelad: true,
  setae: true,
  test: true,
  bsla: true,
  bsra: true,
  bsrl: true,
  bsrf: true,
  brlc: true,
};

/**
 * Instruction codes for pop operations
 */
const popOpBytes: { [key: string]: number } = {
  af: 0xf1,
  bc: 0xc1,
  de: 0xd1,
  hl: 0xe1,
  ix: 0xdde1,
  iy: 0xfde1,
};

/**
 * Order of conditions
 */
const conditionOrder: { [key: string]: number } = {
  nz: 0,
  z: 1,
  nc: 2,
  c: 3,
  po: 4,
  pe: 5,
  p: 6,
  m: 7,
};

/**
 * Order of 8-bit registers
 */
const reg8Order: { [key: string]: number } = {
  a: 7,
  b: 0,
  c: 1,
  d: 2,
  e: 3,
  h: 4,
  l: 5,
};

/**
 * Order of shift operations
 */
const shiftOpOrder: { [key: string]: number } = {
  RlcInstruction: 0,
  RrcInstruction: 1,
  RlInstruction: 2,
  RrInstruction: 3,
  SlaInstruction: 4,
  SraInstruction: 5,
  SllInstruction: 6,
  SrlInstruction: 7,
};

/**
 * Increment operation codes
 */
const incOpCodes: { [key: string]: number } = {
  xl: 0xdd2c,
  xh: 0xdd24,
  yl: 0xfd2c,
  yh: 0xfd24,
  ixl: 0xdd2c,
  ixh: 0xdd24,
  iyl: 0xfd2c,
  iyh: 0xfd24,
  bc: 0x03,
  de: 0x13,
  hl: 0x23,
  sp: 0x33,
  ix: 0xdd23,
  iy: 0xfd23,
};

/**
 * Decrement operation codes
 */
const decOpCodes: { [key: string]: number } = {
  xl: 0xdd2d,
  xh: 0xdd25,
  yl: 0xfd2d,
  yh: 0xfd25,
  ixl: 0xdd2d,
  ixh: 0xdd25,
  iyl: 0xfd2d,
  iyh: 0xfd25,
  bc: 0x0b,
  de: 0x1b,
  hl: 0x2b,
  sp: 0x3b,
  ix: 0xdd2b,
  iy: 0xfd2b,
};

/**
 * Order of shift operations
 */
const aluOpOrder: { [key: string]: number } = {
  AddInstruction: 0,
  AdcInstruction: 1,
  SubInstruction: 2,
  SbcInstruction: 3,
  AndInstruction: 4,
  XorInstruction: 5,
  OrInstruction: 6,
  CpInstruction: 7,
};

/**
 * Order of 16-bit registers
 */
const reg16Order: { [key: string]: number } = {
  bc: 0,
  de: 1,
  hl: 2,
  sp: 3,
};

/**
 * Is the line a byte-emitting pragma?
 * @param asmLine Assembly line to test
 */
function isByteEmittingPragma(asmLine: Z80AssemblyLine): boolean {
  switch (asmLine.type) {
    case "DefBPragma":
    case "DefWPragma":
    case "DefCPragma":
    case "DefMPragma":
    case "DefNPragma":
    case "DefHPragma":
    case "DefSPragma":
    case "FillbPragma":
    case "FillwPragma":
    case "DefGPragma":
    case "DefGxPragma":
      return true;
    default:
      return false;
  }
}

/**
 * Reads the source code text of the specified file
 * @param filename File name
 * @param Handles UTF-8 with and without BOM header
 */
function readSourceFile(filename: string): string {
  const sourceText = fs.readFileSync(filename, "utf8");
  if (sourceText.length < 4) {
    return sourceText;
  }
  return sourceText.charCodeAt(0) >= 0xbf00 ? sourceText.substr(1) : sourceText;
}
