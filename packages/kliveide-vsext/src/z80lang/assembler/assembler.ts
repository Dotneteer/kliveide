import * as fs from "fs";
import * as path from "path";

import { ErrorCodes, errorMessages, ParserErrorMessage } from "../errors";
import { InputStream } from "../parser/input-stream";
import { TokenStream } from "../parser/token-stream";

import {
  Directive,
  EquPragma,
  Expression,
  IncludeDirective,
  LabelOnlyLine,
  MacroOrStructInvocation,
  ModelPragma,
  NodePosition,
  PartialZ80AssemblyLine,
  Pragma,
  Z80AssemblyLine,
} from "../parser/tree-nodes";
import { Z80AsmParser } from "../parser/z80-asm-parser";
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
import { SymbolInfoMap, SymbolType } from "./assembly-symbols";
import {
  evalIdentifierValue,
  evalSymbolValue,
  EvaluationContext,
  ExpressionValue,
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
  conditionSymbols = new Set<string>();

  /**
   * Lines after running the preprocessor
   */
  preprocessedLines: Z80AssemblyLine[] = [];

  /**
   * .comparebin pragma information
   */
  compareBins: BinaryComparisonInfo[] = [];

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
    this.conditionSymbols = new Set<string>(this._options.predefinedSymbols);
    this._currentModule = this._output = new AssemblerOutput(
      sourceItem,
      options?.useCaseSensitiveSymbols ?? false
    );
    this.compareBins = [];

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
    this.ensureCodeSegments();

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
          this.conditionSymbols.add(directive.identifier.name);
        }
        break;

      case "UndefDirective":
        if (doProc) {
          this.conditionSymbols.delete(directive.identifier.name);
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
              const contains = modelName === directive.identifier.name;
              const negate = directive.type === "IfNModDirective";
              processOps.ops = (contains && !negate) || (!contains && negate);
            }
          } else {
            const contains = this.conditionSymbols.has(
              directive.identifier.name
            );
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
    // TODO: Implement this method;
    return 0;
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
    switch (expr.type) {
      case "Identifier":
        return evalIdentifierValue(this, expr);
      case "Symbol":
        return evalSymbolValue(this, expr);
    }
    return ExpressionValue.Error;
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
  private ensureCodeSegments(
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
   * Gets the current assembly address
   */
  private getCurrentAssemblyAddress(): number {
    // TODO: Implement this method
    return 0;
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
      address: this.getCurrentAssemblyAddress(),
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
            new ExpressionValue(this.getCurrentAssemblyAddress())
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
        this.getCurrentAssemblyAddress();
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
        const addr = this.getCurrentAssemblyAddress();
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
    // TODO: Implement this method
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

  // ==========================================================================
  // Pragma processing methods

  /**
   * Processes the specified pragma
   * @param pragmaLine Assembly line with a pragma
   * @param label Pragma label
   */
  private applyPragma(
    pragmaLine: Pragma,
    label: string | null
  ): void {
    switch(pragmaLine.type) {
      case "EquPragma":
        this.processEquPragma(pragmaLine, label);
    }
  }

  /**
   * Processes the .equ pragme
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
    const asmLine = pragma as unknown as Z80AssemblyLine;
    if (value.isNonEvaluated) {
      this.recordFixup(asmLine, FixupType.Equ, pragma.value, label);
    } else {
      this.addSymbol(label, asmLine, value);
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
    // TODO: Implement this method
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
    const localScopes = this._currentModule.localScopes;
    const topScope = localScopes[localScopes.length - 1];
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
            `{{${idx}}}`,
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
}

/**
 * Keep track of directive stack
 */
interface ProcessOps {
  ops: boolean;
}
