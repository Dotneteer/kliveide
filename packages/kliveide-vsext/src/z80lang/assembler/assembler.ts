import * as fs from "fs";
import * as path from "path";

import { ErrorCodes, errorMessages, ParserErrorMessage } from "../errors";
import { InputStream } from "../parser/input-stream";
import { TokenStream } from "../parser/token-stream";

import {
  AlignPragma,
  BankPragma,
  CompareBinPragma,
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
  Expression,
  FillbPragma,
  FillwPragma,
  IncBinPragma,
  IncludeDirective,
  InjectOptPragma,
  LabelOnlyLine,
  MacroOrStructInvocation,
  ModelPragma,
  NodePosition,
  OrgPragma,
  PartialZ80AssemblyLine,
  Pragma,
  RndSeedPragma,
  SimpleZ80Instruction,
  SkipPragma,
  TracePragma,
  VarPragma,
  XentPragma,
  XorgPragma,
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
import { BinaryComparisonInfo, StructDefinition } from "./assembler-types";
import { AssemblyModule } from "./assembly-module";
import {
  AssemblySymbolInfo,
  SymbolInfoMap,
  SymbolScope,
  SymbolType,
} from "./assembly-symbols";
import {
  evalBinaryOperationValue,
  evalConditionalOperationValue,
  evalFunctionInvocationValue,
  evalIdentifierValue,
  evalSymbolValue,
  EvaluationContext,
  evalUnaryOperationValue,
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
export class Z80Assembler implements EvaluationContext {
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
    const sourceText = fs.readFileSync(filename, "utf8");
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
          if (includedLines.success && includedLines.lines) {
            // --- Add the parse result of the include file to the result
            parsedLines.push(...includedLines.lines);
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
    // TODO: Implement this method
    return true;
  }

  /**
   * Compares binaries at the end of comilation
   */
  private compareBinaries(): boolean {
    // TODO: Implement this method
    return true;
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
  ): { success: boolean; lines?: Z80AssemblyLine[] } {
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
      sourceText = fs.readFileSync(filename, "utf8");
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
    // TODO: Implement this method;
    return ExpressionValue.Error;
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
   * Evaluates the value if the specified expression node
   * @param context The context to evaluate the expression
   * @param expr Expression to evaluate
   */
  doEvalExpression(expr: Expression): ExpressionValue {
    try {
      switch (expr.type) {
        case "Identifier":
          return evalIdentifierValue(this, expr);
        case "Symbol":
          return evalSymbolValue(this, expr);
        case "IntegerLiteral":
        case "RealLiteral":
        case "CharLiteral":
        case "StringLiteral":
        case "BooleanLiteral":
          return new ExpressionValue(expr.value);
        case "BinaryExpression":
          return evalBinaryOperationValue(this, expr);
        case "UnaryExpression":
          return evalUnaryOperationValue(this, expr);
        case "ConditionalExpression":
          return evalConditionalOperationValue(this, expr);
        case "CurrentAddressLiteral":
          return new ExpressionValue(this.getCurrentAddress());
          break;
        case "CurrentCounterLiteral":
          // TODO: Implement this
          break;
        case "MacroParameter":
          // TODO: Implement this
          break;
        case "BuiltInFunctionInvocation":
          // TODO: Implement this
          break;
        case "FunctionInvocation":
          return evalFunctionInvocationValue(this, expr);
        default:
          return ExpressionValue.Error;
      }
    } catch (err) {
      this.reportAssemblyError(
        "Z3001",
        this.getSourceLine(),
        null,
        (err as Error).message
      );
      return ExpressionValue.Error;
    }
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
    // TODO: Implement this method
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
        if (asmLine.label) {
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
          asmLine,
          currentLabel,
          currentLineIndex
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
    const symbolIsTemporary = symbol.startsWith("`");

    let lookup = getSymbols();
    if (currentScopeIsTemporary) {
      if (!symbolIsTemporary) {
        // --- Remove the previous temporary scope
        const tempsScope = this.getTopLocalScope();
        this.fixupSymbols(tempsScope.fixups, tempsScope.symbols, false);
        this._currentModule.localScopes.pop();
      }
    } else {
      // --- Create a new temporary scope
      const newScope = new SymbolScope(
        null,
        this._options?.useCaseSensitiveSymbols ?? false
      );
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
        this.processDefGPragma(pragmaLine);
        break;
      case "DefGxPragma":
        this.processDefGXPragma(pragmaLine);
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
        emitAction(value);
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
        emitAction(value & 0xff);
        emitAction((value >> 8) & 0xff);
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
        emitAction(value);
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
        emitAction(fillValue);
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
        emitAction(fillValue);
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
        emitAction(fillValue & 0xff);
        emitAction((fillValue >> 8) & 0xff);
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
        emitAction(bitPattern);
      } else {
        this.emitByte(bitPattern);
      }
      bitPattern = 0x00;
    }
  }

  // ==========================================================================
  // Statement processing methods

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
    stmt: Z80AssemblyLine,
    label: string,
    currentLineIndex: { index: number }
  ): void {
    // TODO: Implement this method
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
      const opCodes = simpleInstructionCodes[mnemonic];
      if (opCodes === undefined) {
        this.reportEvaluationError("Z2023", opLine, null, mnemonic);
      }

      // --- Emit the opcode(s);
      const high = (opCodes >> 8) & 0xff;
      if (high) {
        this.emitByte(high);
      }
      this.emitByte(opCodes & 0xff);
    } else {
      // TODO: Implement this method
    }
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
        emitAction(value);
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
  recordFixup(
    opLine: Z80AssemblyLine,
    type: FixupType,
    expr: Expression,
    label: string | null = null,
    structBytes: Map<number, number> | null = null,
    offset: number | null = null
  ): void {
    // TODO: Implement this method
  }

  /**
   * Tries to create fixups in the specified scope
   * @param fixups Fixup entries in the scope
   * @param symbols Symbols in the scope
   * @param signNotEvaluable Raise error if the symbol is not evaluable
   */
  private fixupSymbols(
    fixups: FixupEntry[],
    symbols: SymbolInfoMap,
    signNotEvaluable: boolean
  ): boolean {
    // TODO: Implement this method
    return false;
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
      this.fixupSymbols(topScope.fixups, topScope.symbols, false);
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
    return localScope.isErrorReported(code);
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
