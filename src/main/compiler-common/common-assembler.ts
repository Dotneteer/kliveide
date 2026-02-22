import fs from "fs";
import path from "path";

import type { ErrorCodes } from "../compiler-common/assembler-errors";
import { errorMessages } from "../compiler-common/assembler-errors";
import { InputStream } from "../compiler-common/input-stream";
import {
  AssemblerErrorInfo,
  AssemblerOptions,
  AssemblerOutput,
  BinarySegment,
  NexFileHandleMode,
  SourceFileItem
} from "../compiler-common/assembler-in-out";
import { AssemblyModule } from "../compiler-common/assembly-module";
import {
  AssemblySymbolInfo,
  ISymbolScope,
  SymbolInfoMap,
  SymbolScope
} from "../compiler-common/assembly-symbols";
import {
  ExpressionEvaluator,
  ExpressionValue,
  setRandomSeed
} from "../compiler-common/expressions";
import { FixupEntry } from "../compiler-common/fixups";
import { ExpressionValueType } from "@abstractions/CompilerInfo";
import {
  BinaryComparisonInfo,
  FixupType,
  IEvaluationContext,
  IExpressionValue,
  IfDefinition,
  IfSection,
  IListFileItem,
  IMacroDefinition,
  IStructDefinition,
  IValueInfo,
  ParserErrorMessage,
  StructDefinition,
  SymbolType,
  SymbolValueMap,
  TypedObject
} from "../compiler-common/abstractions";
import {
  AlignPragma,
  AssemblyLine,
  BankPragma,
  BreakStatement,
  CompareBinPragma,
  ContinueStatement,
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
  FieldAssignment,
  FillbPragma,
  FillwPragma,
  ForStatement,
  IfLikeStatement,
  IncBinPragma,
  IncludeDirective,
  InjectOptPragma,
  LabelOnlyLine,
  LoopStatement,
  MacroOrStructInvocation,
  MacroStatement,
  ModelPragma,
  ModuleStatement,
  NodePosition,
  OnSuccessPragma,
  OperandType,
  OrgPragma,
  PartialAssemblyLine,
  Pragma,
  RepeatStatement,
  RndSeedPragma,
  SaveNexBarPragma,
  SaveNexBorderPragma,
  SaveNexCopperPragma,
  SaveNexCorePragma,
  SaveNexEntryAddrPragma,
  SaveNexEntryBankPragma,
  SaveNexFileHandlePragma,
  SaveNexFilePragma,
  SaveNexPalettePragma,
  SaveNexPreservePragma,
  SaveNexRamPragma,
  SaveNexScreenPragma,
  SaveNexStackAddrPragma,
  SkipPragma,
  Statement,
  StructStatement,
  TracePragma,
  UntilStatement,
  VarPragma,
  WhileStatement,
  XentPragma,
  XorgPragma
} from "@main/compiler-common/tree-nodes";
import { readTextFile } from "@main/compiler-common/utils";
import { CommonTokenType } from "./common-tokens";
import { CommonTokenStream } from "./common-token-stream";
import { CommonAsmParser } from "./common-asm-parser";
import { findModelTypeByName } from "@main/z80-compiler/SpectrumModelTypes";
import { convertSpectrumString } from "@main/z80-compiler/z80-utils";

/**
 * The file name of a direct text compilation
 */
const NO_FILE_ITEM = "#";

/**
 * Size of an assembly batch. After this batch, the assembler lets the
 * JavaScript event loop process messages
 */
const ASSEMBLY_BATCH_SIZE = 1000;

/**
 * This class provides the functionality of the Z80 Assembler
 */
export abstract class CommonAssembler<
  TInstruction extends TypedObject,
  TToken extends CommonTokenType
> extends ExpressionEvaluator<TInstruction, TToken> {
  // --- Use these options
  protected _options: AssemblerOptions;

  // --- Store the current output
  protected _output: AssemblerOutput<TInstruction, TToken>;

  // --- The current module
  protected _currentModule: AssemblyModule<TInstruction, TToken>;

  // --- The current output segment
  protected _currentSegment: BinarySegment | null = null;

  // --- The current structure invocation
  protected _currentStructInvocation: IStructDefinition | null = null;

  // --- Offset of the current structure invocation
  protected _currentStructOffset = 0;

  // --- Start offset of the current struct invocation
  protected _currentStructStartOffset = 0;

  // --- The current line that invokes the struct
  protected _currentStructLine: MacroOrStructInvocation<TInstruction, TToken> | null = null;

  // --- The current bytes to emit for the structure being invoked
  protected _currentStructBytes: Map<number, number> | null = null;

  // --- Checks if the compiler is currently cloning a structure byte pattern
  protected _isInStructCloning = false;

  // --- Label that overflew from a label-only line
  protected _overflowLabelLine: LabelOnlyLine<TInstruction> | null = null;

  // --- The source line of the experession evaluation context
  protected _currentSourceLine: AssemblyLine<TInstruction>;

  // --- The current list item being processed
  protected _currentListFileItem: IListFileItem | null;

  // --- The stack of macro invocations
  protected _macroInvocations: MacroOrStructInvocation<TInstruction, TToken>[] = [];

  // --- Counter for async batches
  protected _batchCounter = 0;

  /**
   * Creates a token stream from the input stream.
   * @param is Input stream to create the token stream from
   */
  protected abstract createTokenStream(is: InputStream): CommonTokenStream<TToken>;

  /**
   * Creates an assembly parser from the token stream.
   * @param ts Token stream to create the parser from
   * @param fileIndex Index of the source file being parsed
   */
  protected abstract createAsmParser(
    ts: CommonTokenStream<TToken>,
    fileIndex: number,
    macroEmitPhase?: boolean
  ): CommonAsmParser<TInstruction, TToken>;

  /**
   * Emits the assembly operation code for the specified assembly line.
   * @param opLine Assembly line to emit the code for
   */
  protected abstract emitAssemblyOperationCode(opLine: AssemblyLine<TInstruction>): void;

  /**
   * Checks if the specified model type is valid.
   * @param modelType The model type to validate
   */
  protected abstract validateModelType(modelType: string): boolean;

  /**
   * Gets the model name by its ID.
   * @param modelId The model ID to get the name for
   */
  protected abstract getModelNameById(modelId: number): string;

  /**
   * Checks if the specified model ID supports the .bank pragma.
   * @param modelId The model ID to check
   */
  protected abstract modelSupportsBankPragma(modelId: number): ErrorCodes | null;

  /**
   * The condition symbols
   */
  conditionSymbols: SymbolValueMap = {};

  /**
   * Lines after running the preprocessor
   */
  preprocessedLines: AssemblyLine<TInstruction>[] = [];

  /**
   * .comparebin pragma information
   */
  compareBins: BinaryComparisonInfo<TInstruction, TToken>[] = [];

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
  async compileFile(
    filename: string,
    options?: AssemblerOptions
  ): Promise<AssemblerOutput<TInstruction, TToken>> {
    const sourceText = readTextFile(filename);
    return await this.doCompile(new SourceFileItem(filename), sourceText, options);
  }

  /**
   * Compiles he passed Z80 Assembly code into Z80 binary code.
   * binary code.
   * @param sourceText Z80 assembly source code text
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  async compile(
    sourceText: string,
    options?: AssemblerOptions
  ): Promise<AssemblerOutput<TInstruction, TToken>> {
    return await this.doCompile(new SourceFileItem(NO_FILE_ITEM), sourceText, options);
  }

  /**
   * Sets the trace handler function
   * @param handler Trace handler function
   */
  setTraceHandler(handler: (message: string) => void): void {
    this._traceHandler = handler;
  }

  /**
   * Allows events to be processed from the JavaScript message queue
   */
  private async allowEvents(): Promise<void> {
    if (this._batchCounter++ % ASSEMBLY_BATCH_SIZE === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
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
  private async doCompile(
    sourceItem: SourceFileItem,
    sourceText: string,
    options?: AssemblerOptions
  ): Promise<AssemblerOutput<TInstruction, TToken>> {
    this._options = options ?? new AssemblerOptions();

    this._currentModule = this._output = new AssemblerOutput<TInstruction, TToken>(
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
        isUsed: false
      };
    }

    // --- Execute the compilation phases
    let emitSuccess = false;
    const parseResult = await this.executeParse(0, sourceItem, sourceText);
    this.preprocessedLines = parseResult.parsedLines;
    
    // --- Set up unbanked code defaults if using Next auto mode
    if (this._output.isNextAutoMode) {
      this.setupNextUnbankedCodeDefaults();
    }
    
    emitSuccess = await this.emitCode(this.preprocessedLines);
    if (emitSuccess) {
      emitSuccess = (await this.fixupUnresolvedSymbols()) && this.compareBinaries();
    }
    if (!emitSuccess) {
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
  private async executeParse(
    fileIndex: number,
    sourceItem: SourceFileItem,
    sourceText: string
  ): Promise<{
    success: boolean;
    parsedLines?: AssemblyLine<TInstruction>[];
  }> {
    // --- Initialize the parse result
    const parsedLines: AssemblyLine<TInstruction>[] = [];

    // --- Parse the main file
    const is = new InputStream(sourceText);
    const ts = this.createTokenStream(is);
    const parser = this.createAsmParser(ts, fileIndex);
    const parsed = await parser.parseProgram();

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
    const visitedLines = parsed.assemblyLines;

    // --- Traverse through parsed lines
    while (currentLineIndex < visitedLines.length) {
      const line = visitedLines[currentLineIndex];
      this.setSourceLine(line as AssemblyLine<TInstruction>);
      if (processOps.ops) {
        const typedLine = line as any;
        switch (typedLine.type) {
          case "ModelPragma":
            this.processModelPragma(typedLine);
            break;

          case "IncludeDirective": {
            // --- Parse the included file
            const includedLines = await this.applyIncludeDirective(typedLine, sourceItem);
            if (includedLines.success && includedLines.parsedLines) {
              // --- Add the parse result of the include file to the result
              parsedLines.push(...includedLines.parsedLines);
            }
            break;
          }

          case "DefineDirective":
            this.conditionSymbols[typedLine.identifier.name] = new ExpressionValue(true);
            break;

          case "UndefDirective":
            delete this.conditionSymbols[typedLine.identifier.name];
            break;

          case "LineDirective":
            // TODO: Process a #line directive
            break;

          default: {
            if (
              !this.applyScopedDirective(
                line as unknown as Directive<TInstruction, TToken>,
                ifdefStack,
                processOps
              )
            ) {
              line.fileIndex = fileIndex;
              line.sourceText = sourceText.substr(
                line.startPosition,
                line.endPosition - line.startPosition + 1
              );
              parsedLines.push(line);
            }
            break;
          }
        }
      } else {
        this.applyScopedDirective(
          line as unknown as Directive<TInstruction, TToken>,
          ifdefStack,
          processOps
        );
      }
      currentLineIndex++;
    }

    // --- Check if all #if and #ifdef has a closing #endif tag
    if (ifdefStack.length > 0 && visitedLines.length > 0) {
      this.reportAssemblyError("Z0205", visitedLines[visitedLines.length - 1]);
    }

    // --- Done
    return {
      success: this._output.errorCount === 0,
      parsedLines
    };
  }

  /**
   * Emits the binary code according to the specified code lines
   * @param lines Source code lines
   * @returns True, if there were no errors during code emission.
   */
  private async emitCode(lines: AssemblyLine<TInstruction>[]): Promise<boolean> {
    if (!lines) {
      return false;
    }
    this._output.segments.length = 0;
    this._currentSegment = null;
    this.ensureCodeSegment();

    const currentLineIndex = { index: 0 };
    while (currentLineIndex.index < lines.length) {
      await this.allowEvents();
      var asmLine = lines[currentLineIndex.index];
      await this.emitSingleLine(lines, lines, asmLine, currentLineIndex);

      // --- Next line
      currentLineIndex.index++;
    }

    // --- Handle the orphan hanging label
    if (this._overflowLabelLine !== null) {
      await this.createCurrentPointLabel(this._overflowLabelLine);
      this._overflowLabelLine = null;
    }

    // --- Handle unclosed field definitions
    if (this._currentStructInvocation) {
      // --- Check for structure size
      if (this._currentStructOffset > this._currentStructInvocation.size) {
        this.reportAssemblyError(
          "Z0801",
          this._currentStructLine,
          null,
          this._currentStructInvocation.structName,
          this._currentStructInvocation.size,
          this._currentStructOffset
        );
        return false;
      }
      this.recordFixup(
        this._currentStructLine as unknown as AssemblyLine<TInstruction>,
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
  private async fixupUnresolvedSymbols(): Promise<boolean> {
    for (const scope of this._currentModule.localScopes) {
      if (scope.fixups.length === 0) {
        continue;
      }
      if (await this.fixupSymbols(scope, false)) {
        // --- Local scope successfully resolved
        break;
      }
    }
    return await this.fixupSymbols(this._currentModule, true);
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
        this.reportAssemblyError("Z0326", pragma);
        continue;
      }

      // --- Obtain optional offset
      var offset = 0;
      if (pragma.offset) {
        const offsValue = this.evaluateExprImmediate(pragma.offset);
        if (offsValue.type !== ExpressionValueType.Integer) {
          this.reportAssemblyError("Z0603", pragma);
          continue;
        }
        offset = offsValue.asLong();
        if (offset < 0) {
          this.reportAssemblyError("Z0327", pragma);
          continue;
        }
      }

      // --- Obtain optional length
      let length: number | undefined;
      if (pragma.length) {
        const lengthValue = this.evaluateExprImmediate(pragma.length);
        if (lengthValue.type !== ExpressionValueType.Integer) {
          this.reportAssemblyError("Z0603", pragma);
          continue;
        }
        length = lengthValue.asLong();
        if (length < 0) {
          this.reportAssemblyError("Z0328", pragma);
          continue;
        }
      }

      // --- Read the binary file
      const currentSourceFile =
        this._output.sourceFileList[(pragma as unknown as AssemblyLine<TInstruction>).fileIndex];
      const dirname = path.dirname(currentSourceFile.filename) ?? "";
      const filename = path.join(dirname, fileNameValue.asString());

      let contents: Buffer;
      try {
        contents = fs.readFileSync(filename);
      } catch (err) {
        this.reportAssemblyError("Z0329", pragma, null, filename, err.message);
        continue;
      }

      // --- Check content segment
      if (offset >= contents.length) {
        this.reportAssemblyError("Z0327", pragma);
        continue;
      }

      if (!length) {
        length = contents.length - offset;
      }

      // --- Check length
      if (offset + length > contents.length) {
        this.reportAssemblyError("Z0327", pragma);
        continue;
      }

      // --- Everything is ok, do the comparison
      var segment = binInfo.segment;
      if (!segment) {
        this.reportAssemblyError("Z0330", pragma, null, "No output segment to compare.");
        continue;
      }

      // --- Check current segment length
      if (binInfo.segmentLength > length) {
        this.reportAssemblyError(
          "Z0330",
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
          "Z0330",
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
    return this._currentModule.localScopes.filter((s) => !s.isTemporaryScope).length === 0;
  }

  // ==========================================================================
  // Process directives

  /**
   * Apply the #include directive
   * @param includeDir
   * @param sourceItem
   */
  async applyIncludeDirective(
    includeDir: IncludeDirective<TInstruction>,
    sourceItem: SourceFileItem
  ): Promise<{ success: boolean; parsedLines?: AssemblyLine<TInstruction>[] }> {
    // --- Check the #include directive
    let filename = includeDir.filename.trim();

    // --- Now, we have the file name, calculate the path
    if (sourceItem.filename !== NO_FILE_ITEM) {
      // --- The file name is taken into account as relative
      const dirname = path.dirname(sourceItem.filename) ?? "";
      filename = path.join(dirname, filename).replace(/\\/g, "/");
    }

    // --- Check for file existence
    if (!fs.existsSync(filename)) {
      this.reportAssemblyError("Z0201", includeDir, null, filename);
      return { success: false };
    }

    // --- Check for repetition
    var childItem = new SourceFileItem(filename);
    if (sourceItem.containsInIncludeList(childItem)) {
      this.reportAssemblyError("Z0202", includeDir, null, filename);
      return { success: false };
    }

    // --- Check for circular reference
    if (!sourceItem.include(childItem)) {
      this.reportAssemblyError("Z0203", includeDir, null, filename);
      return { success: false };
    }

    // --- Now, add the included item to the output
    this._output.sourceFileList.push(childItem);

    // --- Read the include file
    let sourceText: string;
    try {
      sourceText = readTextFile(filename);
    } catch (err) {
      this.reportAssemblyError("Z0204", includeDir, null, filename, err.toString());
      return { success: false };
    }

    // --- Parse the file
    return await this.executeParse(this._output.sourceFileList.length - 1, childItem, sourceText);
  }

  /**
   * Apply the specified scoped directive
   * @param directive Directive to apply
   * @param ifdefStack Stack if conditional directives
   * @param processOps Object with the "process operation" flag
   * @returns True, if the directive has been processed successfully
   */
  applyScopedDirective(
    directive: Directive<TInstruction, TToken>,
    ifdefStack: (boolean | null)[],
    processOps: ProcessOps
  ): boolean {
    switch (directive.type) {
      case "IfDefDirective":
      case "IfNDefDirective":
      case "IfModDirective":
      case "IfNModDirective":
      case "IfDirective":
        if (processOps.ops) {
          if (directive.type === "IfDirective") {
            const value = this.evaluateExprImmediate(directive.condition);
            processOps.ops = value.isValid && value.value !== 0;
          } else if (directive.type === "IfModDirective" || directive.type === "IfNModDirective") {
            if (!this.validateModelType(directive.identifier.name)) {
              this.reportAssemblyError("Z0206", directive);
              processOps.ops = false;
            } else {
              const refModel = this._output.modelType ?? this._options.currentModel;
              const modelName = this.getModelNameById(refModel).toUpperCase();
              const contains = modelName === directive.identifier.name.toUpperCase();
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
          this.reportAssemblyError("Z0207", directive);
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
          this.reportAssemblyError("Z0208", directive);
        } else {
          ifdefStack.pop();
          processOps.ops = ifdefStack.length === 0 || ifdefStack[ifdefStack.length - 1];
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
  processModelPragma(pragma: ModelPragma<TInstruction>): void {
    if (this._output.modelType) {
      this.reportAssemblyError("Z0302", pragma);
      return;
    }

    const modelType = findModelTypeByName(pragma.modelId);
    if (!modelType) {
      this.reportAssemblyError("Z0303", pragma, null, pragma.modelId);
      return;
    }
    this._output.modelType = modelType;
    
    // Apply Next-specific defaults if using .model next
    if (modelType === 4) { // SpectrumModelType.Next
      this.applyNextDefaults();
    }
  }

  /**
   * Applies automatic defaults for ZX Spectrum Next model
   */
  private applyNextDefaults(): void {
    // Set default .savenex ram if not explicitly set
    if (this._output.nexConfig.ramSize === 768) {
      // 768 is the default in NexConfiguration, but we'll keep it
      // Only override if it's still the default
    }
    
    // Set default .savenex border if not explicitly set
    if (this._output.nexConfig.borderColor === 0) {
      // Only override if it's still the default (0)
      this._output.nexConfig.borderColor = 7;
    }
    
    // Set default .savenex entryaddr if not explicitly set
    if (this._output.nexConfig.entryAddr === undefined) {
      this._output.nexConfig.entryAddr = 0x8000;
    }
    
    // Mark that we're in automatic Next mode (for unbanked code handling)
    this._output.isNextAutoMode = true;
  }

  /**
   * Sets up automatic .org $8000 for unbanked Next code
   * Called during initial assembly setup if conditions are met
   */
  protected setupNextUnbankedCodeDefaults(): void {
    if (!this._output.isNextAutoMode) {
      return; // Not in auto mode
    }
    
    // Create initial segment for unbanked code
    // It starts at $8000 by default, but can be overridden with .org
    this.ensureCodeSegment(0x8000);
    
    // Mark this initial segment as unbanked and track it
    if (!this._output.unbankedSegments) {
      this._output.unbankedSegments = [];
    }
    this._output.unbankedSegments.push(this._currentSegment);
  }

  /**
   * Checks if current unbanked code exceeds typical bank 2 range
   * Emits a warning if address exceeds $bfff
   */
  protected checkUnbankedCodeRange(): void {
    // Only check if in Next auto mode and current segment is unbanked
    if (!this._output.isNextAutoMode || !this._currentSegment || this._currentSegment.bank !== undefined) {
      return; // Not in auto mode, or segment is explicitly banked
    }
    
    const currentAddress = this.getCurrentAssemblyAddress();
    if (currentAddress > 0xbfff) {
      // Mark segment as warned so we don't repeat the warning
      if (!(this._currentSegment as any).rangeWarned) {
        // Report as warning, not error - code can exceed $bfff
        this.reportAssemblyWarning(
          "Z0904",
          this._currentSourceLine,
          null,
          currentAddress.toString(16).toUpperCase()
        );
        (this._currentSegment as any).rangeWarned = true;
      }
    }
  }

  // ==========================================================================
  // Process Expressions

  /**
   * Gets the source line the evaluation context is bound to
   */
  getSourceLine(): AssemblyLine<TInstruction> {
    return this._currentSourceLine;
  }

  /**
   * Sets the source line the evaluation context is bound to
   * @param sourceLine Source line information
   */
  setSourceLine(sourceLine: AssemblyLine<TInstruction>): void {
    this._currentSourceLine = sourceLine;
  }

  /**
   * Gets the current assembly address.
   * Returns the address of the first byte of the current instruction (the value of "$").
   * Uses currentInstructionOffset when available, so that "$" correctly points to the
   * start of the instruction even after opcode prefix bytes have been emitted.
   */
  getCurrentAddress(): number {
    this.ensureCodeSegment();
    const curSegment = this._currentSegment;
    const offset = curSegment.currentInstructionOffset ?? curSegment.emittedCode.length;
    return (
      (curSegment.startAddress + (curSegment?.displacement ?? 0) + offset) &
      0xffff
    );
  }

  /**
   * Gets the value of the specified symbol
   * @param symbol Symbol name
   * @param startFromGlobal Should resolution start from global scope?
   */
  getSymbolValue(symbol: string, startFromGlobal?: boolean): IValueInfo | null {
    let resolved: IValueInfo;
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
      this.reportAssemblyError("Z0705", this._currentSourceLine);
      return ExpressionValue.Error;
    }

    const scope = this.getTopLocalScope();
    if (!scope.isLoopScope) {
      this.reportAssemblyError("Z0705", this._currentSourceLine);
      return ExpressionValue.Error;
    }
    return new ExpressionValue(scope.loopCounter);
  }

  /**
   * Immediately evaluates the specified expression
   * @param opLine Assembly line that contains the expression
   * @param expr Expression to evaluate
   */
  evaluateExpr(expr: Expression<TInstruction, TToken>): IExpressionValue {
    if (!this.readyToEvaluate(expr)) {
      return ExpressionValue.NonEvaluated;
    }
    return this.doEvalExpression(this, expr);
  }

  /**
   * Immediately evaluates the specified expression
   * @param expr Expression to evaluate
   */
  evaluateExprImmediate(expr: Expression<TInstruction, TToken>): IExpressionValue {
    return this.doEvalExpression(this, expr);
  }

  /**
   * Signs if an expression is ready to be evaluated, namely, all
   * subexpression values are known.
   * @param context The context to evaluate the expression
   * @param expr Expression to evaluate
   */
  readyToEvaluate(expr: Expression<TInstruction, TToken>): boolean {
    switch (expr.type) {
      case "UnaryExpression":
        return this.readyToEvaluate(expr.operand);
      case "BinaryExpression":
        return this.readyToEvaluate(expr.left) && this.readyToEvaluate(expr.right);
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
        return this.getSymbolValue(expr.identifier.name, expr.startsFromGlobal) !== null;
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
    context: IEvaluationContext<TInstruction, TToken>,
    code: ErrorCodes,
    node: NodePosition,
    ...parameters: any[]
  ): void {
    this.reportAssemblyError(code, context.getSourceLine(), node, ...parameters);
  }

  // ==========================================================================
  // Code emission methods

  /**
   * Ensures that there is a code segment into which to emit the code
   * @param defaultAddress Default start address of the segment
   * @param maxLength Maximum segment length
   */
  protected ensureCodeSegment(defaultAddress?: number, maxLength: number = 0xffff): void {
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
    
    // --- Track as unbanked segment if we're in Next auto mode and segment has no bank
    if (this._output.isNextAutoMode && segment.bank === undefined) {
      if (!this._output.unbankedSegments) {
        this._output.unbankedSegments = [];
      }
      this._output.unbankedSegments.push(segment);
    }
  }

  /**
   * Creates a label at the current point
   * @param asmLine Assembly line with a label
   */
  private async createCurrentPointLabel(asmLine: LabelOnlyLine<TInstruction>): Promise<void> {
    await this.addSymbol(
      asmLine.label.name,
      asmLine as unknown as AssemblyLine<TInstruction>,
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
  private async emitSingleLine(
    allLines: AssemblyLine<TInstruction>[],
    scopeLines: AssemblyLine<TInstruction>[],
    asmLine: AssemblyLine<TInstruction>,
    currentLineIndex: { index: number },
    fromMacroEmit: boolean = false
  ): Promise<void> {
    const assembler = this;
    this._currentSourceLine = asmLine;
    // --- Capture the instruction start offset BEFORE any bytes are emitted for
    // --- this line, so that "$" in expressions correctly evaluates to the
    // --- address of the first byte of the current instruction.
    this._currentSegment.currentInstructionOffset = this._currentSegment.emittedCode.length;
    this._currentListFileItem = {
      fileIndex: asmLine.fileIndex,
      address: this.getCurrentAddress(),
      lineNumber: asmLine.line,
      segmentIndex: this._output.segments.length - 1,
      codeStartIndex: this._currentSegment.emittedCode.length,
      sourceText: asmLine.sourceText,
      codeLength: 0,
      isMacroInvocation: false
    };

    // --- No parse-time issue, process the line
    if (asmLine.type === "LabelOnlyLine" || asmLine.type === "CommentOnlyLine") {
      // --- This is a line with a label or comment only
      if (!asmLine.label) {
        return;
      }

      // --- Special case: .struct invocation without arguments
      const structDef = this._currentModule.getStruct(asmLine.label.name);
      if (structDef) {
        // --- We have found a structure definition
        this.reportAssemblyError("Z1013", asmLine, null, asmLine.label.name);
        return;
      }

      // // --- Let's handle macro invocation
      const macroDef = this._currentModule.getMacro(asmLine.label.name);
      if (macroDef) {
        // Warn about missing parentheses
        this.reportAssemblyError("Z1014", asmLine, null, asmLine.label.name);
        return;
      }

      // --- This is a label-only line
      if (this._overflowLabelLine) {
        await this.createCurrentPointLabel(this._overflowLabelLine);
      }
      this._overflowLabelLine = asmLine as LabelOnlyLine<TInstruction>;
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
            await this.createCurrentPointLabel(this._overflowLabelLine);
          }
          currentLabel = asmLine.label?.name;
          this._overflowLabelLine = null;
        }
      }
      const isFieldAssignment = asmLine.type === "FieldAssignment";
      // --- Check if there's a label to create
      if (currentLabel) {
        // --- There's a label, we clear the previous hanging label
        this._overflowLabelLine = null;

        // --- Create the label unless the current pragma does it
        if (
          !(
            isLabelSetter(asmLine) ||
            this._isInStructCloning ||
            (isFieldAssignment && isByteEmittingPragma(asmLine) && this._currentStructInvocation)
          )
        ) {
          if (!currentLabel.startsWith("`") && this._currentModule.localScopes.length > 0) {
            // --- Check if temporary scope should be fixed and disposed
            await this.fixupTemporaryScope();
          }
          if (!isFieldAssignment) {
            await this.addSymbol(
              currentLabel,
              asmLine,
              new ExpressionValue(this.getCurrentAddress())
            );
          }
        }
      }

      // --- Let's handle assembly lines with macro parameters
      if (asmLine.macroParams && asmLine.macroParams.length > 0) {
        if (fromMacroEmit) {
          this.reportAssemblyError("Z1010", asmLine);
          return;
        }
        if (this.isInGlobalScope) {
          this.reportAssemblyError("Z1011", asmLine);
        } else {
          const topScope = this.getTopLocalScope();
          if (topScope.isMacroContext) {
            return;
          }
          if (this.shouldReportErrorInCurrentScope("Z1011")) {
            this.reportAssemblyError("Z1011", asmLine);
          }
        }
        return;
      }

      // --- Handle field assignment statement
      if (isFieldAssignment) {
        asmLine = (asmLine as unknown as FieldAssignment<TInstruction, TToken>)
          .assignment as unknown as AssemblyLine<TInstruction>;
      }
      if (this._currentStructInvocation) {
        // --- We are in a .struct invocation...
        if (!isFieldAssignment) {
          // --- ...and just left the invocation scope
          // --- Check for structure size
          if (this._currentStructOffset > this._currentStructInvocation.size) {
            this.reportAssemblyError(
              "Z0801",
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
            this._currentStructLine as unknown as AssemblyLine<TInstruction>,
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
            const fieldDefinition = this._currentStructInvocation.getField(currentLabel);
            if (!fieldDefinition) {
              this.reportAssemblyError(
                "Z0802",
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
          this.reportAssemblyError("Z0803", asmLine);
          return;
        }
      }

      // --- Now, it's time to deal with the assembly line
      if (asmLine.type.endsWith("Pragma")) {
        // --- Process a pragma
        this.ensureCodeSegment();
        await this.applyPragma(asmLine as Pragma<TInstruction, TToken>, currentLabel);
        //emitListItem();
      } else if (asmLine.type.endsWith("Statement")) {
        await this.processStatement(
          allLines,
          scopeLines,
          asmLine as unknown as Statement<TInstruction, TToken>,
          currentLabel,
          currentLineIndex
        );
      } else if (asmLine.type === "MacroOrStructInvocation") {
        await this.processMacroOrStructInvocation(
          asmLine as unknown as MacroOrStructInvocation<TInstruction, TToken>,
          allLines
        );
      } else {
        // --- Process operations
        const addr = this.getCurrentAddress();
        this.emitAssemblyOperationCode(asmLine);

        // --- Generate source map information
        if (asmLine.type !== "LabelOnlyLine" && asmLine.type !== "CommentOnlyLine") {
          this._output.sourceMap[addr] = {
            fileIndex: asmLine.fileIndex,
            line: asmLine.line,
            startColumn: asmLine.startColumn,
            endColumn: asmLine.endColumn
          };
          this._output.addToAddressMap(asmLine.fileIndex, asmLine.line, addr);
          this._currentListFileItem.codeLength =
            this._currentSegment.emittedCode.length - this._currentListFileItem.codeStartIndex;
          this._output.listFileItems.push(assembler._currentListFileItem);
        }
      }
    }

    /**
     * Tests if the specified line is a label-setter
     * @param asmLine Line to test
     */
    function isLabelSetter(asmLine: AssemblyLine<TInstruction>): boolean {
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
  private async addSymbol(
    symbol: string,
    line: AssemblyLine<TInstruction>,
    value: IExpressionValue
  ): Promise<void> {
    const assembler = this;

    // --- Handle case-sensitivity
    if (!this._options.useCaseSensitiveSymbols) {
      symbol = symbol.toLowerCase();
    }

    if (symbol.startsWith(".")) {
      symbol = symbol.substring(1);
      this._output.symbols[symbol] = AssemblySymbolInfo.createLabel(symbol, value);
      return;
    }

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
        await this.fixupSymbols(tempsScope, false);
        this._currentModule.localScopes.pop();
        lookup = getSymbols();
      }
    } else {
      // --- Create a new temporary scope
      const newScope = new SymbolScope<TInstruction, TToken>(null, this.isCaseSensitive);
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
        scope = localScopes.length > 0 ? localScopes[localScopes.length - 1] : null;
        localScopes.push(tmpScope);
      }

      if (scope?.localSymbolBookings.size > 0) {
        // --- We already booked local symbols
        if (!scope.localSymbolBookings.has(symbol)) {
          lookup = this._currentModule.symbols;
        }
      }
    }

    // --- Check for already defined symbols
    const symbolInfo = lookup[symbol];
    if (symbolInfo && symbolInfo.type !== SymbolType.None) {
      this.reportAssemblyError("Z0501", line, null, symbol);
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
    if (!this.isCaseSensitive) {
      symbol = symbol.toLowerCase();
    }
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
  private setVariable(name: string, value: IExpressionValue): void {
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
      this._currentModule.localScopes.length > 0 ? this.getTopLocalScope() : this._currentModule;
    scope.addSymbol(name, AssemblySymbolInfo.createVar(name, value));
  }

  /**
   * Gets the top local scope
   */
  private getTopLocalScope(): SymbolScope<TInstruction, TToken> {
    const localScopes = this._currentModule.localScopes;
    return localScopes[localScopes.length - 1];
  }

  /**
   * Gets the current assembly address
   */
  protected getCurrentAssemblyAddress(): number {
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
  private async applyPragma(
    pragmaLine: Pragma<TInstruction, TToken>,
    label: string | null
  ): Promise<void> {
    switch (pragmaLine.type) {
      case "OrgPragma":
        await this.processOrgPragma(pragmaLine, label);
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
        await this.processVarPragma(pragmaLine, label);
        break;
      case "EquPragma":
        await this.processEquPragma(pragmaLine, label);
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
      case "OnSuccessPragma":
        this.processOnSuccessPragma(pragmaLine);
        break;
      case "SaveNexFilePragma":
        this.processSaveNexFile(pragmaLine);
        break;
      case "SaveNexRamPragma":
        this.processSaveNexRam(pragmaLine);
        break;
      case "SaveNexBorderPragma":
        this.processSaveNexBorder(pragmaLine);
        break;
      case "SaveNexCorePragma":
        this.processSaveNexCore(pragmaLine);
        break;
      case "SaveNexStackAddrPragma":
        this.processSaveNexStackAddr(pragmaLine);
        break;
      case "SaveNexEntryAddrPragma":
        this.processSaveNexEntryAddr(pragmaLine);
        break;
      case "SaveNexEntryBankPragma":
        this.processSaveNexEntryBank(pragmaLine);
        break;
      case "SaveNexFileHandlePragma":
        this.processSaveNexFileHandle(pragmaLine);
        break;
      case "SaveNexPreservePragma":
        this.processSaveNexPreserve(pragmaLine);
        break;
      case "SaveNexScreenPragma":
        this.processSaveNexScreen(pragmaLine);
        break;
      case "SaveNexPalettePragma":
        this.processSaveNexPalette(pragmaLine);
        break;
      case "SaveNexCopperPragma":
        this.processSaveNexCopper(pragmaLine);
        break;
      case "SaveNexBarPragma":
        this.processSaveNexBar(pragmaLine);
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
  async processOrgPragma(
    pragma: OrgPragma<TInstruction, TToken>,
    label: string | null
  ): Promise<void> {
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
      
      // --- Track as unbanked segment if we're in Next auto mode
      if (this._output.isNextAutoMode && segment.bank === undefined) {
        if (!this._output.unbankedSegments) {
          this._output.unbankedSegments = [];
        }
        this._output.unbankedSegments.push(segment);
      }
    } else {
      this._currentSegment.startAddress = value.value;
      
      // --- If current segment is unbanked and we're in Next auto mode,
      // --- make sure it's tracked
      if (this._output.isNextAutoMode && this._currentSegment.bank === undefined) {
        if (!this._output.unbankedSegments) {
          this._output.unbankedSegments = [];
        }
        if (!this._output.unbankedSegments.includes(this._currentSegment)) {
          this._output.unbankedSegments.push(this._currentSegment);
        }
      }
    }

    if (!label) {
      return;
    }

    // --- There is a labels, set its value
    await this.fixupTemporaryScope();
    await this.addSymbol(label, pragma as unknown as AssemblyLine<TInstruction>, value);
  }

  /**
   * Processes the .bank pragma
   * @param pragma Pragma to process
   * @param label Label information
   */
  processBankPragma(pragma: BankPragma<TInstruction, TToken>, label: string | null): void {
    if (label) {
      // --- No label is allowed
      this.reportAssemblyError("Z0305", pragma);
      return;
    }

    // --- Check pragma value
    var value = this.evaluateExprImmediate(pragma.bankId);
    if (!value.isValid) {
      return;
    }
    
    // --- Check for appropriate model type first
    const errCode = this.modelSupportsBankPragma(this._output.modelType);
    if (this._output.modelType === undefined || errCode) {
      this.reportAssemblyError(errCode, pragma);
      return;
    }
    
    // --- Check if noexport flag is used (only allowed for Next model)
    if (pragma.noexport) {
      const isNext = this._output.modelType === 4; // SpectrumModelType.Next
      if (!isNext) {
        this.reportAssemblyError("Z0331", pragma);
        return;
      }
    }
    
    // --- Bank range check depends on model
    const isNext = this._output.modelType === 4; // SpectrumModelType.Next
    const maxBank = isNext ? 111 : 7;
    if (value.asWord() > maxBank) {
      this.reportAssemblyError("Z0306", pragma);
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
        this.reportAssemblyError("Z0307", pragma);
        return;
      }
    }

    this.ensureCodeSegment((0xc000 + offset) & 0xffff);
    if (this._currentSegment.currentOffset !== 0 || this._currentSegment.bank !== undefined) {
      // --- There is already code emitted for the current segment,
      // --- thus create a new segment
      this._currentSegment = new BinarySegment();
      this._output.segments.push(this._currentSegment);
    }
    
    // --- For non-Next models, a bank can be used only once
    // --- For Next, allow multiple segments per bank
    if (!isNext && this._output.segments.some((s) => s.bank === value.value)) {
      this.reportAssemblyError("Z0309", pragma, null, value.value);
      return;
    }
    this._currentSegment.startAddress = (0xc000 + offset) & 0xffff;
    this._currentSegment.bank = value.value;
    this._currentSegment.bankOffset = offset;
    this._currentSegment.nexExport = !pragma.noexport; // Default true, set to false if noexport flag present
    this._currentSegment.maxCodeLength = 0x4000 - offset;
  }

  /**
   * Processes the .xorg pragma
   * @param pragma Pragma to process
   */
  processXorgPragma(pragma: XorgPragma<TInstruction, TToken>): void {
    const value = this.evaluateExprImmediate(pragma.address);
    if (!value.isValid) {
      return;
    }

    this.ensureCodeSegment();
    if (this._currentSegment.currentOffset && this._currentSegment.xorgValue !== undefined) {
      this.reportAssemblyError("Z0314", pragma);
    } else {
      this._currentSegment.xorgValue = value.value;
    }
  }

  /**
   * Processes the .ent pragma
   * @param pragma Pragma to process
   */
  processEntPragma(pragma: EntPragma<TInstruction, TToken>): void {
    if (!this.isInGlobalScope && this.shouldReportErrorInCurrentScope("Z0310")) {
      this.reportAssemblyError("Z0310", pragma, null, ".ent");
    }
    const value = this.evaluateExpr(pragma.address);
    if (value.isNonEvaluated) {
      this.recordFixup(
        pragma as unknown as AssemblyLine<TInstruction>,
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
  processXentPragma(pragma: XentPragma<TInstruction, TToken>): void {
    if (!this.isInGlobalScope && this.shouldReportErrorInCurrentScope("Z0310")) {
      this.reportAssemblyError("Z0310", pragma, null, ".xent");
    }
    const value = this.evaluateExpr(pragma.address);
    if (value.isNonEvaluated) {
      this.recordFixup(
        pragma as unknown as AssemblyLine<TInstruction>,
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
  processDispPragma(pragma: DispPragma<TInstruction, TToken>): void {
    const value = this.evaluateExprImmediate(pragma.offset);
    if (!value.isValid) {
      return;
    }
    this.ensureCodeSegment();
    const curSegment = this._currentSegment;
    curSegment.displacement = value.value;
    curSegment.dispPragmaOffset = (curSegment.startAddress + curSegment.currentOffset) & 0xffff;
  }

  /**
   * Processes the .equ pragma
   * @param pragma Pragma to process
   * @param label Label information
   */
  private async processEquPragma(
    pragma: EquPragma<TInstruction, TToken>,
    label: string | null
  ): Promise<void> {
    if (!label) {
      this.reportAssemblyError("Z0304", pragma);
      return;
    }
    await this.fixupTemporaryScope();

    // --- Do not allow duplicate labels
    if (this.symbolExists(label)) {
      this.reportAssemblyError("Z0501", pragma, null, label);
      return;
    }

    // --- Evaluate .equ value
    const value = this.evaluateExpr(pragma.value);
    const asmLine = pragma as unknown as AssemblyLine<TInstruction>;
    if (value.isNonEvaluated) {
      this.recordFixup(asmLine, FixupType.Equ, pragma.value, label);
    } else {
      await this.addSymbol(label, asmLine, value);
    }
  }

  /**
   * Processes the .var pragma
   * @param pragma Pragma to process
   * @param label Label information
   */
  async processVarPragma(
    pragma: VarPragma<TInstruction, TToken>,
    label: string | null
  ): Promise<void> {
    if (!label) {
      this.reportAssemblyError("Z0311", pragma);
      return;
    }
    await this.fixupTemporaryScope();

    const value = this.evaluateExprImmediate(pragma.value);
    if (!value.isValid) {
      return;
    }

    // --- Do not allow reusing a symbol already declared
    if (this.symbolExists(label)) {
      this.reportAssemblyError("Z0312", pragma);
      return;
    }
    this.setVariable(label, value);
  }

  /**
   * Processes the .skip pragma
   * @param pragma Pragma to process
   */
  processSkipPragma(pragma: SkipPragma<TInstruction, TToken>): void {
    const skipAddr = this.evaluateExprImmediate(pragma.skip);
    if (!skipAddr.isValid) {
      return;
    }

    let currentAddr = this.getCurrentAssemblyAddress();
    if (skipAddr.value < currentAddr) {
      this.reportAssemblyError("Z0313", pragma, null, skipAddr.value, currentAddr);
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
    pragma: DefBPragma<TInstruction, TToken>,
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
            this.reportAssemblyError("Z0601", pragma);
          }
        } else {
          emit(value.value & 0xff);
        }
      } else if (value.isNonEvaluated) {
        this.recordFixup(pragma as unknown as AssemblyLine<TInstruction>, FixupType.Bit8, expr);
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
    pragma: DefWPragma<TInstruction, TToken>,
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
            this.reportAssemblyError("Z0601", pragma);
          }
        } else {
          emit(value.value & 0xffff);
        }
      } else if (value.isNonEvaluated) {
        this.recordFixup(pragma as unknown as AssemblyLine<TInstruction>, FixupType.Bit16, expr);
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
    pragma:
      | DefMPragma<TInstruction, TToken>
      | DefNPragma<TInstruction, TToken>
      | DefCPragma<TInstruction, TToken>,
    emitAction?: (b: number) => void
  ): void {
    const message = this.evaluateExprImmediate(pragma.value);
    if (message.isValid && message.type !== ExpressionValueType.String) {
      if (this._options.flexibleDefPragmas) {
        // --- In flexible mode, the argument expression can be numeric...
        var value = (message.asByte() | (pragma.type === "DefCPragma" ? 0x80 : 0x00)) & 0xff;
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
        this.reportAssemblyError("Z0315", pragma);
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
    pragma: DefHPragma<TInstruction, TToken>,
    emitAction?: (b: number) => void
  ): void {
    const assembler = this;
    const byteVector = this.evaluateExprImmediate(pragma.value);
    if (byteVector.isValid && byteVector.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z0316", pragma);
    }

    const bytesString = byteVector.asString();
    if (bytesString.length % 2 !== 0) {
      this.reportAssemblyError("Z0317", pragma);
      return;
    }

    // --- Convert the byte vector
    for (let i = 0; i < bytesString.length; i += 2) {
      const hexaChars = "0123456789abcdefABCDEF";
      const char1 = bytesString[i];
      const char2 = bytesString[i + 1];
      if (hexaChars.indexOf(char1) < 0 || hexaChars.indexOf(char2) < 0) {
        this.reportAssemblyError("Z0317", pragma);
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
    pragma: DefSPragma<TInstruction, TToken>,
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
    pragma: FillbPragma<TInstruction, TToken>,
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
    pragma: FillwPragma<TInstruction, TToken>,
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
  processAlignPragma(pragma: AlignPragma<TInstruction, TToken>): void {
    let alignment = 0x0100;
    if (pragma.alignExpr) {
      const alignValue = this.evaluateExprImmediate(pragma.alignExpr);
      alignment = alignValue.value;
      if (alignment < 1 || alignment > 0x4000) {
        this.reportAssemblyError("Z0318", pragma, null, alignment);
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
  processTracePragma(pragma: TracePragma<TInstruction, TToken>): void {
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

    this._output.traceOutput.push(message);
    if (this._traceHandler) {
      this._traceHandler(message);
    }
  }

  /**
   * Processes the .rndseed pragma
   * @param pragma Pragma to process
   */
  processRndSeedPragma(pragma: RndSeedPragma<TInstruction, TToken>): void {
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
  processErrorPragma(pragma: ErrorPragma<TInstruction, TToken>): void {
    const errorValue = this.evaluateExprImmediate(pragma.message);
    this.reportAssemblyError("Z2000", pragma, null, errorValue.asString());
  }

  /**
   * Processes the .includebin pragma
   * @param pragma Pragma to process
   */
  processIncBinPragma(pragma: IncBinPragma<TInstruction, TToken>): void {
    // --- Obtain the file name
    const fileNameValue = this.evaluateExprImmediate(pragma.filename);
    if (fileNameValue.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z0319", pragma);
      return;
    }

    // --- Obtain optional offset
    let offset = 0;
    if (pragma.offset) {
      const offsValue = this.evaluateExprImmediate(pragma.offset);
      if (offsValue.type !== ExpressionValueType.Integer) {
        this.reportAssemblyError("Z0602", pragma);
        return;
      }
      offset = offsValue.asLong();
      if (offset < 0) {
        this.reportAssemblyError("Z0320", pragma);
        return;
      }
    }

    // --- Obtain optional length
    let length: number | null = null;
    if (pragma.length) {
      const lengthValue = this.evaluateExprImmediate(pragma.length);
      if (lengthValue.type !== ExpressionValueType.Integer) {
        this.reportAssemblyError("Z0602", pragma);
        return;
      }
      length = lengthValue.asLong();
      if (length < 0) {
        this.reportAssemblyError("Z0321", pragma);
        return;
      }
    }

    // --- Read the binary file
    const currentSourceFile =
      this._output.sourceFileList[(pragma as unknown as AssemblyLine<TInstruction>).fileIndex];
    const dirname = path.dirname(currentSourceFile.filename) ?? "";
    const filename = path.join(dirname, fileNameValue.asString());

    let contents: Buffer | null = null;
    try {
      contents = fs.readFileSync(filename);
    } catch (err) {
      this.reportAssemblyError("Z0322", pragma, null, err.message);
      return;
    }

    // --- Check content segment
    if (offset >= contents.length) {
      this.reportAssemblyError("Z0320", pragma);
      return;
    }

    if (length === null) {
      length = contents.length - offset;
    }

    // --- Check length
    if (offset + length > contents.length) {
      this.reportAssemblyError("Z0321", pragma);
      return;
    }

    // --- Check for too long binary segment
    if (
      this.getCurrentAssemblyAddress() - this._currentSegment.startAddress + length >=
      this._currentSegment.maxCodeLength
    ) {
      this.reportAssemblyError("Z0323", pragma);
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
  processCompareBinPragma(pragma: CompareBinPragma<TInstruction, TToken>): void {
    // --- Obtain the file name
    const fileNameValue = this.evaluateExprImmediate(pragma.filename);
    if (fileNameValue.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z0319", pragma);
      return;
    }

    // --- Store pragma information
    this.compareBins.push(
      new BinaryComparisonInfo(pragma, this._currentSegment, this._currentSegment.currentOffset)
    );
  }

  /**
   * Processes the .injectopt pragma
   * @param pragma Pragma to process
   */
  processInjectOptPragma(pragma: InjectOptPragma<TInstruction>): void {
    for (const id of pragma.identifiers) {
      this._output.injectOptions[id.name.toLowerCase()] = true;
    }
  }

  /**
   * Processes the .defg pragma
   * @param pragma Pragma to process
   * @param emitAction Action to emit a code byte
   */
  processDefGPragma(pragma: DefGPragma<TInstruction>, emitAction?: (b: number) => void): void {
    this.emitDefgBytes(
      pragma as unknown as AssemblyLine<TInstruction>,
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
    pragma: DefGxPragma<TInstruction, TToken>,
    emitAction?: (b: number) => void
  ): void {
    const value = this.evaluateExprImmediate(pragma.pattern);
    if (value.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z0324", pragma);
      return;
    }
    var pattern = value.asString().trim();
    this.emitDefgBytes(pragma as unknown as AssemblyLine<TInstruction>, pattern, true, emitAction);
  }

  /**
   * Processes the .onsuccess pragma
   * @param pragma Pragma to process
   * @param emitAction Action to emit a code byte
   */
  processOnSuccessPragma(pragma: OnSuccessPragma<TInstruction>): void {
    this._output.onSuccessCommands.push(pragma.command);
  }

  /**
   * Processes the .savenex file pragma
   */
  processSaveNexFile(pragma: SaveNexFilePragma<TInstruction, TToken>): void {
    if ((this._output.modelType ?? this._options.currentModel) !== 4) { // SpectrumModelType.Next
      this.reportAssemblyError("Z0340", pragma); // SaveNex only with Next model
      return;
    }

    const filenameValue = this.evaluateExprImmediate(pragma.filename);
    if (filenameValue.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z0341", pragma); // File requires string filename
      return;
    }

    this._output.nexConfig.filename = filenameValue.asString();
  }

  /**
   * Processes the .savenex ram pragma
   */
  processSaveNexRam(pragma: SaveNexRamPragma<TInstruction, TToken>): void {
    if ((this._output.modelType ?? this._options.currentModel) !== 4) { // SpectrumModelType.Next
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const sizeValue = this.evaluateExprImmediate(pragma.size);
    if (sizeValue.type !== ExpressionValueType.Integer) {
      this.reportAssemblyError("Z0342", pragma); // RAM requires 768 or 1792
      return;
    }

    const size = sizeValue.asLong();
    if (size !== 768 && size !== 1792) {
      this.reportAssemblyError("Z0342", pragma);
      return;
    }

    this._output.nexConfig.ramSize = size;
  }

  /**
   * Processes the .savenex border pragma
   */
  processSaveNexBorder(pragma: SaveNexBorderPragma<TInstruction, TToken>): void {
    if ((this._output.modelType ?? this._options.currentModel) !== 4) { // SpectrumModelType.Next
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const colorValue = this.evaluateExprImmediate(pragma.color);
    if (colorValue.type !== ExpressionValueType.Integer) {
      this.reportAssemblyError("Z0343", pragma); // Border requires 0-7
      return;
    }

    const color = colorValue.asLong();
    if (color < 0 || color > 7) {
      this.reportAssemblyError("Z0343", pragma);
      return;
    }

    this._output.nexConfig.borderColor = color;
  }

  /**
   * Processes the .savenex core pragma
   */
  processSaveNexCore(pragma: SaveNexCorePragma<TInstruction, TToken>): void {
    if ((this._output.modelType ?? this._options.currentModel) !== 4) { // SpectrumModelType.Next
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const majorValue = this.evaluateExprImmediate(pragma.major);

    let major: number;
    let minor: number;
    let subminor: number;

    // Check if it's a string format like "3.1.10"
    if (majorValue.type === ExpressionValueType.String && !pragma.minor && !pragma.subminor) {
      const versionStr = majorValue.asString();
      const parts = versionStr.split('.');
      
      if (parts.length !== 3) {
        this.reportAssemblyError("Z0344", pragma); // Core version number ranges
        return;
      }

      major = parseInt(parts[0], 10);
      minor = parseInt(parts[1], 10);
      subminor = parseInt(parts[2], 10);

      if (isNaN(major) || isNaN(minor) || isNaN(subminor)) {
        this.reportAssemblyError("Z0344", pragma);
        return;
      }
    } else {
      // Handle the numeric format with three separate expressions
      if (!pragma.minor || !pragma.subminor) {
        this.reportAssemblyError("Z0344", pragma);
        return;
      }

      const minorValue = this.evaluateExprImmediate(pragma.minor);
      const subminorValue = this.evaluateExprImmediate(pragma.subminor);

      if (majorValue.type !== ExpressionValueType.Integer ||
          minorValue.type !== ExpressionValueType.Integer ||
          subminorValue.type !== ExpressionValueType.Integer) {
        this.reportAssemblyError("Z0344", pragma); // Core version number ranges
        return;
      }

      major = majorValue.asLong();
      minor = minorValue.asLong();
      subminor = subminorValue.asLong();
    }

    if (major < 0 || major > 255 || minor < 0 || minor > 255 || subminor < 0 || subminor > 255) {
      this.reportAssemblyError("Z0344", pragma);
      return;
    }

    this._output.nexConfig.coreVersion = { major, minor, subminor };
  }

  /**
   * Processes the .savenex stackaddr pragma
   */
  processSaveNexStackAddr(pragma: SaveNexStackAddrPragma<TInstruction, TToken>): void {
    if ((this._output.modelType ?? this._options.currentModel) !== 4) { // SpectrumModelType.Next
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const addrValue = this.evaluateExpr(pragma.address);
    if (!addrValue.isValid) {
      // Forward reference - record a fixup
      this.recordFixup(
        pragma as unknown as AssemblyLine<TInstruction>,
        FixupType.NexStackAddr,
        pragma.address
      );
      return;
    }

    if (addrValue.type !== ExpressionValueType.Integer) {
      this.reportAssemblyError("Z0351", pragma); // Value range error
      return;
    }

    const addr = addrValue.asLong();
    if (addr < 0 || addr > 0xffff) {
      this.reportAssemblyError("Z0351", pragma);
      return;
    }

    this._output.nexConfig.stackAddr = addr;
  }

  /**
   * Processes the .savenex entryaddr pragma
   */
  processSaveNexEntryAddr(pragma: SaveNexEntryAddrPragma<TInstruction, TToken>): void {
    if ((this._output.modelType ?? this._options.currentModel) !== 4) { // SpectrumModelType.Next
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const addrValue = this.evaluateExpr(pragma.address);
    if (!addrValue.isValid) {
      // Forward reference - record a fixup
      this.recordFixup(
        pragma as unknown as AssemblyLine<TInstruction>,
        FixupType.NexEntryAddr,
        pragma.address
      );
      return;
    }

    if (addrValue.type !== ExpressionValueType.Integer) {
      this.reportAssemblyError("Z0352", pragma); // Value range error
      return;
    }

    const addr = addrValue.asLong();
    if (addr < 0 || addr > 0xffff) {
      this.reportAssemblyError("Z0352", pragma);
      return;
    }

    this._output.nexConfig.entryAddr = addr;
  }

  /**
   * Processes the .savenex entrybank pragma
   */
  processSaveNexEntryBank(pragma: SaveNexEntryBankPragma<TInstruction, TToken>): void {
    if ((this._output.modelType ?? this._options.currentModel) !== 4) { // SpectrumModelType.Next
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const bankValue = this.evaluateExprImmediate(pragma.bankNo);
    if (bankValue.type !== ExpressionValueType.Integer) {
      this.reportAssemblyError("Z0345", pragma); // Entry bank 0-111
      return;
    }

    const bank = bankValue.asLong();
    if (bank < 0 || bank > 111) {
      this.reportAssemblyError("Z0345", pragma);
      return;
    }

    this._output.nexConfig.entryBank = bank;
  }

  /**
   * Processes the .savenex filehandle pragma
   */
  processSaveNexFileHandle(pragma: SaveNexFileHandlePragma<TInstruction, TToken>): void {
    if ((this._output.modelType ?? this._options.currentModel) !== 4) { // SpectrumModelType.Next
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const modeValue = this.evaluateExprImmediate(pragma.mode);
    if (modeValue.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z0349", pragma); // Filehandle modes
      return;
    }

    const mode = modeValue.asString().toLowerCase();
    if (mode !== "close" && mode !== "open") {
      this.reportAssemblyError("Z0349", pragma);
      return;
    }

    this._output.nexConfig.fileHandle = mode as NexFileHandleMode;
  }

  /**
   * Processes the .savenex preserve pragma
   */
  processSaveNexPreserve(pragma: SaveNexPreservePragma<TInstruction, TToken>): void {
    if ((this._output.modelType ?? this._options.currentModel) !== 4) { // SpectrumModelType.Next
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const valueExpr = this.evaluateExprImmediate(pragma.value);
    
    let preserveValue: boolean;
    if (valueExpr.type === ExpressionValueType.String) {
      const str = valueExpr.asString().toLowerCase();
      if (str === "on" || str === "true") {
        preserveValue = true;
      } else if (str === "off" || str === "false") {
        preserveValue = false;
      } else {
        this.reportAssemblyError("Z0350", pragma); // Preserve requires on/off
        return;
      }
    } else if (valueExpr.type === ExpressionValueType.Integer) {
      preserveValue = valueExpr.asLong() !== 0;
    } else {
      this.reportAssemblyError("Z0350", pragma);
      return;
    }

    this._output.nexConfig.preserveRegs = preserveValue;
  }

  /**
   * Processes the .savenex screen pragma
   */
  processSaveNexScreen(pragma: SaveNexScreenPragma<TInstruction, TToken>): void {
    if ((this._output.modelType ?? this._options.currentModel) !== 4) { // SpectrumModelType.Next
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const typeValue = this.evaluateExprImmediate(pragma.screenType);
    if (typeValue.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z0347", pragma); // Invalid screen type
      return;
    }

    const type = typeValue.asString().toLowerCase();
    const validTypes = ["layer2", "ula", "lores", "hires-color", "hires-mono"];
    if (!validTypes.includes(type)) {
      this.reportAssemblyError("Z0347", pragma);
      return;
    }

    if (!pragma.filename) {
      this._output.nexConfig.screen = { type: type as any };
      return;
    }

    const filenameValue = this.evaluateExprImmediate(pragma.filename);
    if (filenameValue.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z0347", pragma);
      return;
    }

    let paletteOffset: number | undefined;
    if (pragma.paletteOffset) {
      const offsetValue = this.evaluateExprImmediate(pragma.paletteOffset);
      if (offsetValue.type !== ExpressionValueType.Integer) {
        this.reportAssemblyError("Z0347", pragma);
        return;
      }
      paletteOffset = offsetValue.asLong();
    }

    this._output.nexConfig.screen = {
      type: type as any,
      filename: filenameValue.asString(),
      paletteOffset
    };
  }

  /**
   * Processes the .savenex palette pragma
   */
  processSaveNexPalette(pragma: SaveNexPalettePragma<TInstruction, TToken>): void {
    if ((this._output.modelType ?? this._options.currentModel) !== 4) { // SpectrumModelType.Next
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const filenameValue = this.evaluateExprImmediate(pragma.filename);
    if (filenameValue.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z0341", pragma); // Needs string filename
      return;
    }

    this._output.nexConfig.paletteFile = filenameValue.asString();
  }

  /**
   * Processes the .savenex copper pragma
   */
  processSaveNexCopper(pragma: SaveNexCopperPragma<TInstruction, TToken>): void {
    if ((this._output.modelType ?? this._options.currentModel) !== 4) { // SpectrumModelType.Next
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const filenameValue = this.evaluateExprImmediate(pragma.filename);
    if (filenameValue.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z0341", pragma); // Needs string filename
      return;
    }

    this._output.nexConfig.copperFile = filenameValue.asString();
  }

  /**
   * Processes the .savenex bar pragma
   */
  processSaveNexBar(pragma: SaveNexBarPragma<TInstruction, TToken>): void {
    if ((this._output.modelType ?? this._options.currentModel) !== 4) { // SpectrumModelType.Next
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const enabledValue = this.evaluateExprImmediate(pragma.enabled);
    
    let enabled: boolean;
    if (enabledValue.type === ExpressionValueType.String) {
      const str = enabledValue.asString().toLowerCase();
      if (str === "on" || str === "true") {
        enabled = true;
      } else if (str === "off" || str === "false") {
        enabled = false;
      } else {
        this.reportAssemblyError("Z0348", pragma); // Bar requires on/off
        return;
      }
    } else if (enabledValue.type === ExpressionValueType.Integer) {
      enabled = enabledValue.asLong() !== 0;
    } else {
      this.reportAssemblyError("Z0348", pragma);
      return;
    }

    this._output.nexConfig.loadingBar.enabled = enabled;

    if (pragma.color) {
      const colorValue = this.evaluateExprImmediate(pragma.color);
      if (colorValue.type !== ExpressionValueType.Integer) {
        this.reportAssemblyError("Z0348", pragma);
        return;
      }
      const color = colorValue.asLong();
      if (color < 0 || color > 255) {
        this.reportAssemblyError("Z0348", pragma);
        return;
      }
      this._output.nexConfig.loadingBar.color = color;
    }

    if (pragma.delay) {
      const delayValue = this.evaluateExprImmediate(pragma.delay);
      if (delayValue.type !== ExpressionValueType.Integer) {
        this.reportAssemblyError("Z0348", pragma);
        return;
      }
      this._output.nexConfig.loadingBar.delay = delayValue.asLong();
    }

    if (pragma.startDelay) {
      const startDelayValue = this.evaluateExprImmediate(pragma.startDelay);
      if (startDelayValue.type !== ExpressionValueType.Integer) {
        this.reportAssemblyError("Z0348", pragma);
        return;
      }
      this._output.nexConfig.loadingBar.startDelay = startDelayValue.asLong();
    }
  }

  /**
   * Emits the pattern bytes for .defg/.defgx
   * @param line Pragma line
   * @param pattern Pattern to emit
   * @param allowAlign Signs if alignment indicators are allowed or not
   * @param emitAction Action to emit a code byte
   */
  emitDefgBytes(
    line: AssemblyLine<TInstruction>,
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
      this.reportAssemblyError("Z0325", line);
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
   * @param macroOrStructStmt A macro or struct invocation statement
   * @param allLines All parsed lines
   */
  private async processMacroOrStructInvocation(
    macroOrStructStmt: MacroOrStructInvocation<TInstruction, TToken>,
    allLines: AssemblyLine<TInstruction>[]
  ): Promise<void> {
    const structDef = this._currentModule.getStruct(macroOrStructStmt.identifier.name);
    if (structDef) {
      // --- We have found a structure definition
      await this.processStructInvocation(macroOrStructStmt, structDef, allLines);
      return;
    }

    // --- Let's handle macro invocation
    // --- Check if macro definition exists
    const macroName = macroOrStructStmt.identifier.name;
    const macroDef = this._currentModule.getMacro(macroName);
    if (!macroDef) {
      this.reportAssemblyError("Z1007", macroOrStructStmt, null, macroName);
      return;
    }

    // --- Match parameters
    if (macroDef.argNames.length < macroOrStructStmt.operands.length) {
      this.reportAssemblyError(
        "Z1008",
        macroOrStructStmt,
        null,
        macroDef.macroName,
        macroDef.argNames.length,
        macroOrStructStmt.operands.length
      );
      return;
    }

    // --- Save the current state of macro error stack
    const macroStackDepth = this._macroInvocations.length;
    const assembler = this;

    // --- Push the invocation line to the stack
    this._macroInvocations.push(macroOrStructStmt);

    // --- Evaluate arguments
    const macroArgs: Record<string, IExpressionValue> = {};
    let errorFound = false;
    const emptyArgValue = new ExpressionValue("$<none>$");
    for (let i = 0; i < macroDef.argNames.length; i++) {
      if (i >= macroOrStructStmt.operands.length) {
        macroArgs[macroDef.argNames[i].name] = emptyArgValue;
        continue;
      }
      var op = macroOrStructStmt.operands[i];
      let argValue: IExpressionValue;
      switch (op.operandType) {
        case OperandType.Reg8:
        case OperandType.Reg8Idx:
        case OperandType.Reg8Spec:
        case OperandType.Reg16:
        case OperandType.Reg16Idx:
        case OperandType.Reg16Spec:
          argValue = new ExpressionValue(op.register);
          break;
        case OperandType.RegIndirect:
          argValue = new ExpressionValue(`(${op.register})`);
          break;
        case OperandType.Expression:
          argValue = this.evaluateExpr(op.expr);
          if (argValue.isNonEvaluated) {
            argValue = new ExpressionValue(op.expr.sourceText);
          }
          break;
        case OperandType.MemIndirect:
          argValue = this.evaluateExprImmediate(op.expr);
          if (!argValue.isValid) {
            errorFound = true;
          } else {
            argValue = new ExpressionValue(`(${argValue.asString()})`);
          }
          break;
        case OperandType.CPort:
          argValue = new ExpressionValue("(c)");
          break;
        case OperandType.IndexedIndirect:
          if (!op.expr) {
            argValue = new ExpressionValue(`(${op.register})`);
          } else {
            argValue = this.evaluateExprImmediate(op.expr);
            if (!argValue.isValid) {
              errorFound = true;
            } else {
              argValue = new ExpressionValue(
                `(${op.register}${op.offsetSign}${argValue.asString()})`
              );
            }
          }
          break;
        case OperandType.Condition:
          argValue = new ExpressionValue(op.register);
          break;
        default:
          argValue = emptyArgValue;
          break;
      }
      if (errorFound) {
        continue;
      }

      let macroName = macroDef.argNames[i].name;
      if (!this.isCaseSensitive) {
        macroName = macroName.toLowerCase();
      }
      macroArgs[macroName] = argValue;
    }
    if (errorFound) {
      restoreMacroStack();
      return;
    }

    // --- Create a scope for the macro
    const macroScope = new SymbolScope<TInstruction, TToken>(null, this.isCaseSensitive);
    macroScope.macroArguments = macroArgs;
    this._currentModule.localScopes.push(macroScope);

    // --- The macro name will serve as its starting label
    macroScope.addSymbol(
      macroDef.macroName,
      AssemblySymbolInfo.createLabel(
        macroDef.macroName,
        new ExpressionValue(this.getCurrentAssemblyAddress())
      )
    );

    let lineIndex = { index: macroDef.section.firstLine + 1 };
    const lastLine = macroDef.section.lastLine;

    // --- Create source info for the macro invocation
    const currentAddress = this.getCurrentAssemblyAddress();

    // --- Create macro invocation map information
    const asmLine = macroOrStructStmt as unknown as AssemblyLine<TInstruction>;
    this._output.addToAddressMap(asmLine.fileIndex, asmLine.line, currentAddress);

    // --- Store the invocation line for future use
    const macroInvocationFileItem = this._currentListFileItem;
    macroInvocationFileItem.isMacroInvocation = true;
    this._output.listFileItems.push(macroInvocationFileItem);

    // --- We store the original source file information to
    // --- assign it later with the re-parsed macro code
    const sourceInfo: number[] = [];

    // --- Setup the macro source
    let macroSource = "";
    while (lineIndex.index < lastLine) {
      // --- Replace all macro arguments by their actual value
      const curLine = allLines[lineIndex.index];
      const lineText = curLine.sourceText as string;
      let newText = lineText;
      const regExpr = /{{\s*([_a-zA-Z][_a-zA-Z0-9]*)\s*}}/g;
      let matches: RegExpExecArray;
      while ((matches = regExpr.exec(lineText)) !== null) {
        const toReplace = matches[0];
        let argName = matches[1];
        if (!this.isCaseSensitive) {
          argName = argName.toLowerCase();
        }
        if (macroArgs[argName]) {
          newText = newText.replace(toReplace, macroArgs[argName].asString());
        }
      }

      // --- Store the source information for the currently processed macro line
      var newLines = newText.split("\r\n").length;
      for (let i = 0; i < newLines; i++) {
        sourceInfo.push(lineIndex.index);
      }
      macroSource += newText;
      lineIndex.index++;
    }

    // --- Now we have the source text to compile
    const inputStream = new InputStream(macroSource);
    const tokenStream = this.createTokenStream(inputStream);
    const macroParser = this.createAsmParser(tokenStream, 0, true);
    const macroProgram = await macroParser.parseProgram();

    // --- Collect syntax errors
    if (macroParser.hasErrors) {
      this.reportMacroInvocationErrors();
      for (const error of macroParser.errors) {
        // --- Translate the syntax error location
        const origLine = allLines[sourceInfo[error.line - 1]];
        let errorPrefix = "";
        if (this._macroInvocations.length > 0) {
          const lines = this._macroInvocations
            .map((mi) => (mi as unknown as AssemblyLine<TInstruction>).line)
            .join(" -> ");
          errorPrefix = `(from macro invocation through line ${lines}) `;
        }
        const errorInfo = new AssemblerErrorInfo(
          error.code,
          this._output.sourceFileList[origLine.fileIndex].filename,
          origLine.line,
          origLine.startPosition,
          origLine.endPosition,
          origLine.startColumn,
          origLine.endColumn,
          errorPrefix + error.text,
          true
        );
        this._output.errors.push(errorInfo);
        this.reportScopeError(errorInfo.errorCode);
        errorFound = true;
      }
    }

    if (errorFound) {
      // --- Stop compilation, if macro contains error
      restoreMacroStack();
      return;
    }

    // --- Set the source line information
    const visitedLines = macroProgram.assemblyLines;
    for (let i = 0; i < sourceInfo.length; i++) {
      if (i < visitedLines.length) {
        const line = visitedLines[i];
        const origLine = allLines[sourceInfo[i]];
        line.fileIndex = origLine.fileIndex;
        line.line = origLine.line;
      }
    }

    // --- Now, emit the compiled lines
    lineIndex.index = 0;
    while (lineIndex.index < visitedLines.length) {
      var macroLine = visitedLines[lineIndex.index];
      const currentAddress = this.getCurrentAssemblyAddress();
      if (macroLine.type !== "LabelOnlyLine" && macroLine.type !== "CommentOnlyLine") {
        this._output.listFileItems.push({
          ...macroInvocationFileItem,
          address: currentAddress
        });
        this._output.listFileItems.push({
          ...this._currentListFileItem,
          address: currentAddress,
          fileIndex: macroLine.fileIndex,
          lineNumber: macroLine.line,
          isMacroInvocation: false
        });
      }
      await this.emitSingleLine(allLines, visitedLines, macroLine, lineIndex, true);

      // --- Next line
      lineIndex.index++;
    }

    // --- Add the end label to the local scope
    const endLabel = macroDef.endLabel;
    if (endLabel) {
      // --- Add the end label to the macro scope
      var endLine = allLines[lastLine];
      await this.addSymbol(
        endLabel,
        endLine,
        new ExpressionValue(this.getCurrentAssemblyAddress())
      );
    }

    // --- Clean up the hanging label
    this._overflowLabelLine = null;

    // --- Fixup the temporary scope over the iteration scope, if there is any
    const topScope = this.getTopLocalScope();
    if (topScope !== macroScope && topScope.isTemporaryScope) {
      await this.fixupSymbols(topScope, false);
      this._currentModule.localScopes.pop();
    }

    // --- Fixup the symbols locally
    await this.fixupSymbols(macroScope, false);

    // --- Remove the macro's scope
    this._currentModule.localScopes.pop();

    // --- Restore the original depth of macro stack
    restoreMacroStack();

    /**
     * Restores the original depth of the macro stack
     */
    function restoreMacroStack() {
      assembler._macroInvocations.length = macroStackDepth;
    }
  }

  /**
   * Process a structure invocation
   * @param structStmt A macro or struct invocation statement
   * @param structDef Structure definition
   * @param allLines All parsed lines
   */
  private async processStructInvocation(
    structStmt: MacroOrStructInvocation<TInstruction, TToken>,
    structDef: IStructDefinition,
    allLines: AssemblyLine<TInstruction>[]
  ): Promise<void> {
    if (structStmt.operands.length > 0) {
      this.reportAssemblyError("Z0809", structStmt, null, structStmt.identifier.name);
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
        await this.emitSingleLine(allLines, allLines, curLine, structLineIndex);
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
  private async processStatement(
    allLines: AssemblyLine<TInstruction>[],
    scopeLines: AssemblyLine<TInstruction>[],
    stmt: Statement<TInstruction, TToken>,
    label: string,
    currentLineIndex: { index: number }
  ): Promise<void> {
    switch (stmt.type) {
      case "MacroStatement":
        this.collectMacroDefinition(stmt, label, allLines, currentLineIndex);
        break;
      case "MacroEndStatement":
        this.reportAssemblyError("Z0704", stmt, null, ".endm/.mend", ".if/.ifused/.ifnused");
        break;
      case "LoopStatement":
        await this.processLoopStatement(stmt, allLines, scopeLines, currentLineIndex);
        break;
      case "LoopEndStatement":
        this.reportAssemblyError("Z0704", stmt, null, ".endl/.lend", ".loop");
        break;
      case "WhileStatement":
        await this.processWhileStatement(stmt, allLines, scopeLines, currentLineIndex);
        break;
      case "WhileEndStatement":
        this.reportAssemblyError("Z0704", stmt, null, ".endw/.wend", ".while");
        break;
      case "RepeatStatement":
        await this.processRepeatStatement(stmt, allLines, scopeLines, currentLineIndex);
        break;
      case "UntilStatement":
        this.reportAssemblyError("Z0704", stmt, null, ".until", ".repeat");
        break;
      case "ProcStatement":
        await this.processProcStatement(allLines, scopeLines, currentLineIndex);
        break;
      case "ProcEndStatement":
        this.reportAssemblyError("Z0704", stmt, null, ".endp/.pend", ".proc");
        break;
      case "IfStatement":
        await this.processIfStatement(stmt, allLines, scopeLines, currentLineIndex);
        break;
      case "IfUsedStatement":
        await this.processIfStatement(stmt, allLines, scopeLines, currentLineIndex);
        break;
      case "IfNUsedStatement":
        await this.processIfStatement(stmt, allLines, scopeLines, currentLineIndex);
        break;
      case "ElseStatement":
        this.reportAssemblyError("Z0704", stmt, null, ".else", ".if/.ifused/.ifnused");
        break;
      case "ElseIfStatement":
        this.reportAssemblyError("Z0704", stmt, null, ".elseif", ".if/.ifused/.ifnused");
        break;
      case "EndIfStatement":
        this.reportAssemblyError("Z0704", stmt, null, ".endif", ".if/.ifused/.ifnused");
        break;
      case "BreakStatement":
        this.processBreakStatement(stmt);
        break;
      case "ContinueStatement":
        this.processContinueStatement(stmt);
        break;
      case "ModuleStatement":
        await this.processModuleStatement(stmt, label, allLines, scopeLines, currentLineIndex);
        break;
      case "ModuleEndStatement":
        this.reportAssemblyError("Z0704", stmt, null, ".endmodule/.moduleend", ".module");
        break;
      case "StructStatement":
        this.collectStructDefinition(stmt, label, allLines, currentLineIndex);
        break;
      case "StructEndStatement":
        this.reportAssemblyError("Z0704", stmt, null, ".ends", ".struct");
        break;
      case "NextStatement":
        this.reportAssemblyError("Z0704", stmt, null, ".next", ".for");
        break;
      case "ForStatement":
        await this.processForStatement(stmt, allLines, scopeLines, currentLineIndex);
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
    macro: MacroStatement<TInstruction>,
    label: string,
    allLines: AssemblyLine<TInstruction>[],
    currentLineIndex: { index: number }
  ): void {
    let errorFound = false;
    // --- Check for parameter uniqueness
    var args = new Set<string>();
    for (const macroArg of macro.parameters) {
      const argName = macroArg.name.toLowerCase();
      if (args.has(argName)) {
        this.reportAssemblyError("Z1001", macro, null, macroArg.name);
        errorFound = true;
      }
      args.add(argName);
    }

    // --- Check if the macro name is correct
    if (!label) {
      errorFound = true;
      this.reportAssemblyError("Z1002", macro);
    } else if (label.startsWith("`")) {
      errorFound = true;
      this.reportAssemblyError("Z1003", macro, null, label);
    } else if (
      this._currentModule.containsMacro(label) ||
      this._currentModule.containsSymbol(label) ||
      this._currentModule.containsNestedModule(label) ||
      this._currentModule.containsStruct(label)
    ) {
      errorFound = true;
      this.reportAssemblyError("Z1004", macro, null, label);
    }

    // --- Search for the end of the macro
    const firstLine = currentLineIndex.index;
    const searchResult = this.searchForEndStatement("MacroStatement", allLines, currentLineIndex);
    if (!searchResult.found) {
      return;
    }

    // --- Create macro definition
    const macroDef: IMacroDefinition<TInstruction> = {
      macroName: label,
      argNames: macro.parameters,
      endLabel: searchResult.label,
      section: {
        firstLine,
        lastLine: currentLineIndex.index
      }
    };

    // --- Check each macro line for invalid macro parameter names
    // --- or nested macro
    for (let i = firstLine + 1; i < currentLineIndex.index; i++) {
      var macroLine = allLines[i];

      // --- Check for parse-time function parameters
      // --- (they can have only macro parameter arguments)
      if (macroLine.type === "MacroStatement") {
        this.reportAssemblyError("Z1005", macroLine);
        errorFound = true;
        continue;
      }

      const isCaseSensitive = this.isCaseSensitive;
      if (macroLine.macroParams) {
        for (const param of macroLine.macroParams) {
          const findParam = macro.parameters.find(
            (p) =>
              (isCaseSensitive ? p.name : p.name.toLowerCase()) ===
              (isCaseSensitive ? param.identifier.name : param.identifier.name.toLowerCase())
          );
          if (findParam) {
            continue;
          }

          errorFound = true;
          this.reportAssemblyError("Z1006", macroLine, null, param.identifier.name);
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
    structStmt: StructStatement<TInstruction>,
    label: string,
    allLines: AssemblyLine<TInstruction>[],
    currentLineIndex: { index: number }
  ): void {
    let errorFound = false;

    // --- Check if the structure name is correct
    if (!label) {
      errorFound = true;
      this.reportAssemblyError("Z0804", structStmt);
    } else if (label.startsWith("`")) {
      errorFound = true;
      this.reportAssemblyError("Z0805", structStmt, null, label);
    } else if (
      this._currentModule.containsMacro(label) ||
      this._currentModule.containsSymbol(label) ||
      this._currentModule.containsNestedModule(label) ||
      this._currentModule.containsStruct(label)
    ) {
      errorFound = true;
      this.reportAssemblyError("Z0806", structStmt, null, label);
    }

    // --- Search for the end of the structure
    const firstLine = currentLineIndex.index;
    const searchResult = this.searchForEndStatement("StructStatement", allLines, currentLineIndex);
    if (!searchResult.found) {
      return;
    }

    if (searchResult.label) {
      errorFound = true;
      this.reportAssemblyError("Z0807", structStmt);
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
        this.reportAssemblyError("Z0808", structLine);
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
          this.reportAssemblyError("Z0810", structLine, null, fieldLabel);
          errorFound = true;
        } else {
          structDef.addField(fieldLabel, {
            offset: structOffset,
            isUsed: false
          });
        }
      }

      // --- Determine structure size
      const pragma = structLine as Pragma<TInstruction, TToken>;
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
  private async processWhileStatement(
    whileStmt: WhileStatement<TInstruction, TToken>,
    allLines: AssemblyLine<TInstruction>[],
    scopeLines: AssemblyLine<TInstruction>[],
    currentLineIndex: { index: number }
  ): Promise<void> {
    // --- Search for the end of the loop
    const firstLine = currentLineIndex.index;
    const searchResult = this.searchForEndStatement("WhileStatement", scopeLines, currentLineIndex);
    if (!searchResult.found) {
      return;
    }

    // --- End found
    const lastLine = currentLineIndex.index;

    // --- Create a scope for the loop
    const loopScope = new SymbolScope<TInstruction, TToken>(null, this.isCaseSensitive);
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
        this.reportAssemblyError("Z0603", whileStmt);
        return;
      }

      // --- Exit if while condition fails
      if (!loopCondition.asBool()) {
        break;
      }

      const loopLineIndex = { index: firstLine + 1 };
      while (loopLineIndex.index < lastLine) {
        var curLine = scopeLines[loopLineIndex.index];
        await this.emitSingleLine(allLines, scopeLines, curLine, loopLineIndex);
        if (iterationScope.breakReached || iterationScope.continueReached) {
          break;
        }
        loopLineIndex.index++;
      }

      // --- Add the end label to the local scope
      const endLabel = searchResult.label;
      if (endLabel) {
        // --- Add the end label to the loop scope
        await this.addSymbol(
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
        await this.fixupSymbols(topScope, false);
        this._currentModule.localScopes.pop();
      }

      // --- Fixup the symbols locally
      await this.fixupSymbols(iterationScope, false);

      // --- Remove the local scope
      this._currentModule.localScopes.pop();

      // --- Check for the maximum number of error
      if (this._output.errorCount - errorsBefore >= this._options.maxLoopErrorsToReport) {
        this.reportAssemblyError("Z0703", whileStmt);
        break;
      }

      // --- Increment counter, check loop safety
      loopCount++;
      if (loopCount >= 0xffff) {
        this.reportAssemblyError("Z0702", whileStmt);
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
  private async processLoopStatement(
    loop: LoopStatement<TInstruction, TToken>,
    allLines: AssemblyLine<TInstruction>[],
    scopeLines: AssemblyLine<TInstruction>[],
    currentLineIndex: { index: number }
  ): Promise<void> {
    // --- Search for the end of the loop
    const firstLine = currentLineIndex.index;
    const searchResult = this.searchForEndStatement("LoopStatement", scopeLines, currentLineIndex);
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
      this.reportAssemblyError("Z0603", loop);
      return;
    }

    // --- Check the loop counter
    var counter = loopCounter.asLong();
    if (counter >= 0x10000) {
      this.reportAssemblyError("Z0702", loop);
      counter = 1;
    }

    // --- Create a scope for the loop
    const loopScope = new SymbolScope<TInstruction, TToken>(null, this.isCaseSensitive);
    this._currentModule.localScopes.push(loopScope);
    const errorsBefore = this._output.errorCount;

    for (let i = 0; i < counter; i++) {
      // --- Create a local scope for the loop body
      var iterationScope = new SymbolScope<TInstruction, TToken>(loopScope, this.isCaseSensitive);
      this._currentModule.localScopes.push(iterationScope);
      iterationScope.loopCounter = i + 1;

      const loopLineIndex = { index: firstLine + 1 };
      while (loopLineIndex.index < lastLine) {
        const curLine = scopeLines[loopLineIndex.index];
        await this.emitSingleLine(allLines, scopeLines, curLine, loopLineIndex);
        if (iterationScope.breakReached || iterationScope.continueReached) {
          break;
        }
        loopLineIndex.index++;
      }

      // --- Add the end label to the local scope
      const endLabel = searchResult.label;
      if (endLabel) {
        // --- Add the end label to the loop scope
        await this.addSymbol(
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
        await this.fixupSymbols(topScope, false);
        this._currentModule.localScopes.pop();
      }

      // --- Fixup the symbols locally
      await this.fixupSymbols(iterationScope, false);

      // --- Remove the local scope
      this._currentModule.localScopes.pop();

      // --- Check for the maximum number of error
      if (this._output.errorCount - errorsBefore >= this._options.maxLoopErrorsToReport) {
        this.reportAssemblyError("Z0703", loop);
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
  private async processRepeatStatement(
    repeatStmt: RepeatStatement<TInstruction>,
    allLines: AssemblyLine<TInstruction>[],
    scopeLines: AssemblyLine<TInstruction>[],
    currentLineIndex: { index: number }
  ): Promise<void> {
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
    const untilStmt = scopeLines[lastLine] as unknown as UntilStatement<TInstruction, TToken>;

    // --- Create a scope for the loop
    const loopScope = new SymbolScope<TInstruction, TToken>(null, this.isCaseSensitive);
    this._currentModule.localScopes.push(loopScope);
    const errorsBefore = this._output.errorCount;

    let loopCount = 1;
    let condition = false;
    do {
      // --- Create a local scope for the loop body
      var iterationScope = new SymbolScope<TInstruction, TToken>(loopScope, this.isCaseSensitive);
      this._currentModule.localScopes.push(iterationScope);
      iterationScope.loopCounter = loopCount;

      // --- Evaluate the loop expression
      const loopLineIndex = { index: firstLine + 1 };
      while (loopLineIndex.index < lastLine) {
        var curLine = scopeLines[loopLineIndex.index];
        await this.emitSingleLine(allLines, scopeLines, curLine, loopLineIndex);
        if (iterationScope.breakReached || iterationScope.continueReached) {
          break;
        }
        loopLineIndex.index++;
      }

      // --- Add the end label to the local scope
      const endLabel = searchResult.label;
      if (endLabel) {
        // --- Add the end label to the loop scope
        await this.addSymbol(
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
        await this.fixupSymbols(topScope, false);
        this._currentModule.localScopes.pop();
      }

      // --- Fixup the symbols locally
      await this.fixupSymbols(iterationScope, false);

      // --- Check for the maximum number of error
      if (this._output.errorCount - errorsBefore >= this._options.maxLoopErrorsToReport) {
        this.reportAssemblyError("Z0703", repeatStmt);
        break;
      }

      // --- Evaluate the loop expression
      const loopExitCondition = this.evaluateExprImmediate(untilStmt.expr);
      if (!loopExitCondition.isValid) {
        return;
      }
      if (loopExitCondition.type === ExpressionValueType.String) {
        this.reportAssemblyError("Z0603", untilStmt);
        return;
      }
      condition = loopExitCondition.asBool();

      // --- Increment counter, check loop safety
      loopCount++;
      if (loopCount >= 0xffff) {
        this.reportAssemblyError("Z0702", repeatStmt);
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
  private async processForStatement(
    forStmt: ForStatement<TInstruction, TToken>,
    allLines: AssemblyLine<TInstruction>[],
    scopeLines: AssemblyLine<TInstruction>[],
    currentLineIndex: { index: number }
  ): Promise<void> {
    // --- Search for the end of the loop
    const firstLine = currentLineIndex.index;
    const searchResult = this.searchForEndStatement("ForStatement", scopeLines, currentLineIndex);
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
      this.reportAssemblyError("Z0603", forStmt);
      return;
    }

    const toValue = this.evaluateExprImmediate(forStmt.toExpr);
    if (!toValue.isValid) {
      return;
    }
    if (toValue.type === ExpressionValueType.String) {
      this.reportAssemblyError("Z0603", forStmt);
      return;
    }

    let stepValue: IExpressionValue = new ExpressionValue(1);
    if (forStmt.stepExpr) {
      stepValue = this.evaluateExprImmediate(forStmt.stepExpr);
      if (!stepValue.isValid) {
        return;
      }
      if (stepValue.type === ExpressionValueType.String) {
        this.reportAssemblyError("Z0603", forStmt);
        return;
      }
      if (Math.abs(stepValue.asReal()) < Number.EPSILON) {
        this.reportAssemblyError("Z0706", forStmt);
        return;
      }
    }

    // --- Check the FOR variable
    const forVariable = forStmt.identifier.name;
    if (this.variableExists(forVariable)) {
      this.reportAssemblyError("Z0502", forStmt, null, forVariable);
      return;
    }

    // --- Create a scope for the loop
    const loopScope = new SymbolScope<TInstruction, TToken>(null, this.isCaseSensitive);
    this._currentModule.localScopes.push(loopScope);
    const errorsBefore = this._output.errorCount;

    // --- Init the FOR variable
    loopScope.addSymbol(forVariable, AssemblySymbolInfo.createVar(forVariable, fromValue));

    const isIntLoop =
      (fromValue.type === ExpressionValueType.Bool ||
        fromValue.type === ExpressionValueType.Integer) &&
      (toValue.type === ExpressionValueType.Bool || toValue.type === ExpressionValueType.Integer) &&
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
        this.reportAssemblyError("Z0702", forStmt);
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
        await this.emitSingleLine(allLines, scopeLines, curLine, loopLineIndex);
        if (iterationScope.breakReached || iterationScope.continueReached) {
          break;
        }
        loopLineIndex.index++;
      }

      // --- Add the end label to the local scope
      const endLabel = searchResult.label;
      if (endLabel) {
        // --- Add the end label to the loop scope
        await this.addSymbol(
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
        await this.fixupSymbols(topScope, false);
        this._currentModule.localScopes.pop();
      }

      // --- Fixup the symbols locally
      await this.fixupSymbols(iterationScope, false);

      // --- Remove the local scope
      this._currentModule.localScopes.pop();

      // --- Check for the maximum number of error
      if (this._output.errorCount - errorsBefore >= this._options.maxLoopErrorsToReport) {
        this.reportAssemblyError("Z0703", forStmt);
        break;
      }

      // --- BREAK reached, exit the loop
      if (iterationScope.breakReached) {
        break;
      }

      // --- Increment cycle variable
      if (isIntLoop) {
        loopIntValue += incIntValue;
        loopScope.getSymbol(forVariable).value = new ExpressionValue(loopIntValue);
      } else {
        loopRealValue += incRealValue;
        loopScope.getSymbol(forVariable).value = new ExpressionValue(loopRealValue);
      }
    }

    // --- Clean up the loop's scope
    this._currentModule.localScopes.pop();
  }

  /**
   * Processes a BREAK statement
   * @param breakStmt Break statement
   */
  private processBreakStatement(breakStmt: BreakStatement<TInstruction>): void {
    if (this.isInGlobalScope || !this.getTopLocalScope().isLoopScope) {
      this.reportAssemblyError("Z0707", breakStmt);
      return;
    }
    this.getTopLocalScope().breakReached = true;
  }

  /**
   * Processes a CONTINUE statement
   * @param continueStmt Break statement
   */
  private processContinueStatement(continueStmt: ContinueStatement<TInstruction>): void {
    if (this.isInGlobalScope || !this.getTopLocalScope().isLoopScope) {
      this.reportAssemblyError("Z0708", continueStmt);
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
  private async processIfStatement(
    ifStmt: IfLikeStatement<TInstruction, TToken>,
    allLines: AssemblyLine<TInstruction>[],
    scopeLines: AssemblyLine<TInstruction>[],
    currentLineIndex: { index: number }
  ): Promise<void> {
    // --- Map the sections of IF
    const ifDef = this.getIfSections(scopeLines, currentLineIndex);
    if (!ifDef.definition) {
      return;
    }

    // --- Process the IF definition
    let sectionToCompile: IfSection<TInstruction, TToken> | undefined;
    for (const ifSection of ifDef.definition.ifSections) {
      // --- Evaluate the condition
      let conditionValue: IExpressionValue;
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
            var isUsed = (valueInfo && valueInfo.usageInfo && valueInfo.usageInfo.isUsed) || false;
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
        this.reportAssemblyError("Z0603", ifSection.ifStatement);
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
      await this.emitSingleLine(allLines, scopeLines, curLine, loopLineIndex);
      loopLineIndex.index++;
    }

    // --- Add the end label to the local scope
    if (ifDef.label) {
      // --- Add the end label to the loop scope
      await this.addSymbol(
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
    lines: AssemblyLine<TInstruction>[],
    currentLineIndex: { index: number }
  ): {
    definition: IfDefinition<TInstruction, TToken> | null;
    label?: string;
  } {
    let endLabel: string | undefined;
    if (currentLineIndex.index >= lines.length) {
      return { definition: null };
    }

    const ifDef = new IfDefinition<TInstruction, TToken>();
    const firstLine = currentLineIndex.index;
    let sectionStart = firstLine;
    let sectionStmt = lines[sectionStart] as unknown as Statement<TInstruction, TToken>;
    let elseDetected = false;
    let errorDetected = false;
    currentLineIndex.index++;

    // --- Iterate through lines
    while (currentLineIndex.index < lines.length) {
      const curLine = lines[currentLineIndex.index] as unknown as Statement<TInstruction, TToken>;

      // --- Check for ENDIF
      if (curLine.type === "EndIfStatement") {
        // --- We have found the end line, get its label
        endLabel = curLine.label ? curLine.label.name : endLabel;
        if (elseDetected) {
          // --- Store the ELSE section
          ifDef.elseSection = new IfSection(null, sectionStart, currentLineIndex.index);
        } else {
          // --- Store the IF/ELIF section
          ifDef.ifSections.push(new IfSection(sectionStmt, sectionStart, currentLineIndex.index));
        }

        // --- Calculate the entire IF section and return with it
        ifDef.fullSection = {
          firstLine,
          lastLine: currentLineIndex.index
        };
        return errorDetected ? { definition: null } : { definition: ifDef, label: endLabel };
      }

      // --- Check for ELIF section
      if (curLine.type === "ElseIfStatement") {
        endLabel = curLine.label ? curLine.label.name : endLabel;
        if (endLabel) {
          this.reportAssemblyError("Z0503", sectionStmt, null, ".elif");
        }
        if (elseDetected) {
          errorDetected = true;
          this.reportAssemblyError("Z0709", sectionStmt, null, ".elif");
        } else {
          // --- Store the previous section
          ifDef.ifSections.push(new IfSection(sectionStmt, sectionStart, currentLineIndex.index));
          sectionStmt = curLine;
          sectionStart = currentLineIndex.index;
        }
      }

      // --- Check for ELSE section
      else if (curLine.type === "ElseStatement") {
        endLabel = curLine.label ? curLine.label.name : endLabel;
        if (endLabel) {
          this.reportAssemblyError("Z0503", sectionStmt, null, ".else");
        }
        if (elseDetected) {
          errorDetected = true;
          this.reportAssemblyError("Z0709", sectionStmt, null, ".else");
        } else {
          // --- Store the previous section
          ifDef.ifSections.push(new IfSection(sectionStmt, sectionStart, currentLineIndex.index));
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
          const searchResult = this.searchForEndStatement(curLine.type, lines, currentLineIndex);
          if (!searchResult.found) {
            this.reportAssemblyError("Z0701", lines[firstLine], null, ".if/.ifused/.ifnused");
            return { definition: null };
          }
        }
      }
      currentLineIndex.index++;
    }
    this.reportAssemblyError("Z0701", lines[firstLine], null, ".if/.ifused/.ifnused");
    return { definition: null };
  }

  /**
   * Processes the LOOP statement
   * @param proc Loop statement
   * @param allLines All parsed lines
   * @param scopeLines Lines to process in the current scope
   * @param currentLineIndex Current line index
   */
  private async processProcStatement(
    allLines: AssemblyLine<TInstruction>[],
    scopeLines: AssemblyLine<TInstruction>[],
    currentLineIndex: { index: number }
  ): Promise<void> {
    // --- Search for the end of the proc
    const firstLine = currentLineIndex.index;
    const searchResult = this.searchForEndStatement("ProcStatement", scopeLines, currentLineIndex);
    if (!searchResult.found) {
      return;
    }

    // --- End found
    const lastLine = currentLineIndex.index;

    // --- Create a scope for the proc
    const procScope = new SymbolScope<TInstruction, TToken>(null, this.isCaseSensitive);
    procScope.isLoopScope = false;
    procScope.isProcScope = true;
    this._currentModule.localScopes.push(procScope);

    // --- Emit loop instructions
    const procLineIndex = { index: firstLine + 1 };
    while (procLineIndex.index < lastLine) {
      const curLine = scopeLines[procLineIndex.index];
      await this.emitSingleLine(allLines, scopeLines, curLine, procLineIndex);
      procLineIndex.index++;
    }

    // --- Add the end label to the local scope
    const endLabel = searchResult.label;
    if (endLabel) {
      // --- Add the end label to the loop scope
      await this.addSymbol(
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
      await this.fixupSymbols(topScope, false);
      this._currentModule.localScopes.pop();
    }

    // --- Fixup the symbols locally
    await this.fixupSymbols(procScope, false);

    // --- Clean up the loop's scope
    this._currentModule.localScopes.pop();
  }

  /**
   * Processes the MODULE statement
   * @param moduleStmt Module statement
   * @param label Module label
   * @param allLines All parsed lines
   * @param scopeLines Lines to process in the current scope
   * @param currentLineIndex Current line index
   */
  private async processModuleStatement(
    moduleStmt: ModuleStatement<TInstruction>,
    label: string,
    allLines: AssemblyLine<TInstruction>[],
    scopeLines: AssemblyLine<TInstruction>[],
    currentLineIndex: { index: number }
  ): Promise<void> {
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
    const moduleName = moduleStmt.identifier ? moduleStmt.identifier.name : label;
    if (!moduleName) {
      this.reportAssemblyError("Z0901", moduleStmt);
      return;
    }
    if (moduleName.startsWith("`")) {
      this.reportAssemblyError("Z0902", moduleStmt, null, moduleName);
      return;
    }
    if (this._currentModule.containsNestedModule(moduleName)) {
      this.reportAssemblyError("Z0903", moduleStmt, null, moduleName);
      return;
    }

    // --- Create a new nested module
    const newModule = new AssemblyModule(this._currentModule, this.isCaseSensitive);
    this._currentModule.addNestedModule(moduleName, newModule);
    this._currentModule = newModule;

    // --- The module has a label, so create a temporary scope, too
    const newScope = new SymbolScope<TInstruction, TToken>(null, this.isCaseSensitive);
    newScope.isTemporaryScope = true;
    newModule.localScopes.push(newScope);

    // --- Emit module instructions
    const moduleLineIndex = { index: firstLine + 1 };
    while (moduleLineIndex.index < lastLine) {
      const curLine = scopeLines[moduleLineIndex.index];
      await this.emitSingleLine(allLines, scopeLines, curLine, moduleLineIndex);
      moduleLineIndex.index++;
    }

    // --- Add the end label to the local scope
    const endLabel = searchResult.label;
    if (endLabel) {
      // --- Add the end label to the loop scope
      await this.addSymbol(
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
      await this.fixupSymbols(topScope, false);
      this._currentModule.localScopes.pop();
    }

    // --- Fixup the symbols locally
    await this.fixupSymbols(newModule, false);

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
    searchType: Statement<TInstruction, TToken>["type"],
    lines: AssemblyLine<TInstruction>[],
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
          label: curLine.label ? curLine.label.name : endLabel
        };
      }

      if (curLine.type === "CommentOnlyLine" || curLine.type === "LabelOnlyLine") {
        // --- Record the last hanging label
        endLabel = curLine.label ? curLine.label.name : null;
      } else {
        endLabel = undefined;
        if ((curLine as any as Statement<TInstruction, TToken>).isBlock) {
          var nestedSearch = this.searchForEndStatement(
            (curLine as any as Statement<TInstruction, TToken>).type,
            lines,
            currentLineIndex
          );
          if (!nestedSearch.found) {
            this.reportAssemblyError("Z0701", startLine, null, endDisplayName);
            return { found: false };
          }
        }
      }
      currentLineIndex.index++;
    }
    this.reportAssemblyError("Z0701", startLine, null, endDisplayName);
    return { found: false };
  }

  /**
   * Gets information about the end of a statement
   * @param stmtType Statement to check
   */
  private getEndStatementInfo(
    stmtType: Statement<TInstruction, TToken>["type"]
  ): { type: Statement<TInstruction, TToken>["type"]; displayName: string } | null {
    let type: Statement<TInstruction, TToken>["type"] | undefined;
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
   * Emits a new byte to the current code segment
   * @param data Data byte to emit
   */
  protected emitByte(data: number): void {
    this.ensureCodeSegment();
    this.checkUnbankedCodeRange();
    const overflow = this._currentSegment.emitByte(data);
    if (overflow) {
      this.reportAssemblyError(overflow, this._currentSourceLine);
    }
  }

  /**
   * Emits a new word to the current code segment
   * @param data Data byte to emit
   */
  protected emitWord(data: number): void {
    this.emitByte(data & 0xff);
    this.emitByte((data >> 8) & 0xff);
  }

  /**
   * Emits a byte (high 8-bit value is zero)or a word
   * @param data byte or word data
   */
  protected emitOpCode(data: number): void {
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
  protected emitString(
    message: IExpressionValue,
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
    var lastByte = bytes.charCodeAt(bytes.length - 1) | (bit7Terminator ? 0x80 : 0x00);
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

  /**
   * Evaluates the expression and emits bytes accordingly. If the expression
   * cannot be resolved, creates a fixup.
   * @param opLine Assembly line
   * @param expr Expression to evaluate
   * @param type Expression/Fixup type
   */
  protected emitNumericExpr(
    instr: TInstruction,
    expr: Expression<TInstruction, TToken>,
    type: FixupType
  ): void {
    const opLine = instr as unknown as AssemblyLine<TInstruction>;
    let value = this.evaluateExpr(expr);
    if (value.type === ExpressionValueType.Error) {
      return;
    }
    if (value.isNonEvaluated) {
      this.recordFixup(opLine, type, expr);
    }
    if (value.isValid && value.type === ExpressionValueType.String) {
      this.reportAssemblyError("Z0603", opLine);
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
  protected recordFixup(
    opLine: AssemblyLine<TInstruction>,
    type: FixupType,
    expr: Expression<TInstruction, TToken>,
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
    fixup: FixupEntry<TInstruction, TToken>,
    numericOnly: boolean,
    signNotEvaluable: boolean
  ): { success: boolean; value: IExpressionValue } {
    let exprValue: IExpressionValue = new ExpressionValue(0);
    if (!this.readyToEvaluate(fixup.expression)) {
      if (!signNotEvaluable) {
        return {
          success: false,
          value: ExpressionValue.NonEvaluated
        };
      }
    }

    // --- Now, resolve the fixup
    exprValue = fixup.doEvalExpression(fixup, fixup.expression);

    if (!exprValue.isValid) {
      return { success: false, value: ExpressionValue.Error };
    }
    if (numericOnly && exprValue.type === ExpressionValueType.String) {
      this.reportAssemblyError("Z0603", fixup.getSourceLine());
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
  private async fixupSymbols(
    scope: ISymbolScope<TInstruction, TToken>,
    signNotEvaluable: boolean
  ): Promise<boolean> {
    await this.allowEvents();

    // --- #1: fix the .equ values
    let success = true;
    for (const equ of scope.fixups.filter((f) => f.type === FixupType.Equ && !f.resolved)) {
      const evalResult = this.evaluateFixupExpression(equ, false, signNotEvaluable);
      if (evalResult.success) {
        const symbolInfo = scope.getSymbol(equ.label);
        if (symbolInfo) {
          symbolInfo.value = evalResult.value;
        } else {
          scope.addSymbol(equ.label, AssemblySymbolInfo.createLabel(equ.label, evalResult.value));
        }
      } else {
        success = false;
      }
    }

    // --- #2: fix Bit8, Bit16, Bit16Be, Jr, Ent, Xent, NexStackAddr, NexEntryAddr
    for (const fixup of scope.fixups.filter(
      (f) =>
        !f.resolved &&
        (f.type === FixupType.Bit8 ||
          f.type === FixupType.Bit16 ||
          f.type === FixupType.Bit16Be ||
          f.type === FixupType.Jr ||
          f.type === FixupType.Ent ||
          f.type === FixupType.Xent ||
          f.type === FixupType.NexStackAddr ||
          f.type === FixupType.NexEntryAddr)
    )) {
      const evalResult = this.evaluateFixupExpression(fixup, true, signNotEvaluable);

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

          case FixupType.Bit16Be:
            emittedCode[fixup.offset] = evalResult.value.asWord() >> 8;
            emittedCode[fixup.offset + 1] = evalResult.value.asByte();
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
              this.reportAssemblyError("Z0403", fixup.sourceLine, null, dist);
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

          case FixupType.NexStackAddr:
            const stackAddr = evalResult.value.asWord();
            if (stackAddr < 0 || stackAddr > 0xffff) {
              this.reportAssemblyError("Z0351", fixup.sourceLine);
              success = false;
              break;
            }
            this._output.nexConfig.stackAddr = stackAddr;
            break;

          case FixupType.NexEntryAddr:
            const entryAddr = evalResult.value.asWord();
            if (entryAddr < 0 || entryAddr > 0xffff) {
              this.reportAssemblyError("Z0352", fixup.sourceLine);
              success = false;
              break;
            }
            this._output.nexConfig.entryAddr = entryAddr;
            break;
        }
      } else {
        success = false;
      }
    }

    // --- #3: fix Struct
    for (const fixup of scope.fixups.filter((f) => !f.resolved && f.type === FixupType.Struct)) {
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
      (f) => !f.resolved && (f.type === FixupType.FieldBit8 || f.type === FixupType.FieldBit16)
    )) {
      const evalResult = this.evaluateFixupExpression(fixup, true, signNotEvaluable);
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
  private async fixupTemporaryScope(): Promise<void> {
    if (this._currentModule.localScopes.length === 0) {
      return;
    }
    const topScope = this.getTopLocalScope();
    if (topScope.isTemporaryScope) {
      await this.fixupSymbols(topScope, false);
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
    error: ParserErrorMessage<ErrorCodes>
  ): void {
    const errorInfo = new AssemblerErrorInfo(
      error.code,
      sourceItem.filename.replace(/\\/g, "/"),
      error.line,
      error.position,
      error.position + 1,
      error.column,
      error.column + 1,
      error.text
    );
    this._output.errors.push(errorInfo);
    this.reportScopeError(error.code);
  }

  /**
   * Reports macro invocation errors
   */
  private reportMacroInvocationErrors(): void {
    // --- Report macro invocation errors
    for (let i = this._macroInvocations.length - 1; i >= 0; i--) {
      const errorLine = this._macroInvocations[i] as unknown as AssemblyLine<TInstruction>;
      const sourceItem = this._output.sourceFileList[errorLine.fileIndex];
      const errorInfo = new AssemblerErrorInfo(
        "Z1012",
        sourceItem.filename,
        errorLine.line,
        errorLine.startPosition,
        errorLine.endPosition,
        errorLine.startColumn,
        errorLine.endColumn,
        `Error in macro invocation${i > 0 ? " (level" + i + ")" : ""}`
      );
      this._output.errors.push(errorInfo);
    }
  }

  /**
   * Reports an assembly error
   * @param code Error code
   * @param sourceLine Assembly line of the error
   * @param parameters Optional parameters to report
   */
  protected reportAssemblyError(
    code: ErrorCodes,
    sourceLine: PartialAssemblyLine<TInstruction>,
    nodePosition?: NodePosition | null,
    ...parameters: any[]
  ): void {
    if (!(sourceLine as any).fileIndex === undefined) {
      return;
    }

    this.reportMacroInvocationErrors();

    const line = { ...(sourceLine as AssemblyLine<TInstruction>) };

    // --- Cut closing comment, if there is any
    if (line.sourceText) {
      const segments = line.sourceText.split(";");
      line.endColumn = line.startColumn + segments[0].trim().length - 1;
    }
    const sourceItem = this._output.sourceFileList[line.fileIndex];
    let errorText: string = errorMessages[code] ?? "Unkonwn error";
    if (parameters) {
      parameters.forEach(
        (_, idx) => (errorText = replace(errorText, `{${idx}}`, parameters[idx].toString()))
      );
    }

    if (this._macroInvocations.length > 0) {
      const lines = this._macroInvocations
        .map((mi) => (mi as unknown as AssemblyLine<TInstruction>).line)
        .join(", ");
      errorText = `(from macro invocation through ${lines}) ` + errorText;
    }

    const errorInfo = new AssemblerErrorInfo(
      code,
      sourceItem.filename,
      line.line,
      nodePosition ? nodePosition.startPosition : line.startPosition,
      nodePosition ? nodePosition.endPosition : line.endPosition + 1,
      nodePosition ? nodePosition.startColumn : line.startColumn,
      nodePosition ? nodePosition.endColumn : line.endColumn + 1,
      errorText
    );
    this._output.errors.push(errorInfo);
    this.reportScopeError(code);

    function replace(input: string, placeholder: string, replacement: string): string {
      do {
        input = input.replace(placeholder, replacement);
      } while (input.includes(placeholder));
      return input;
    }
  }

  /**
   * Reports an assembly warning
   * @param code Warning code
   * @param sourceLine Assembly line of the warning
   * @param parameters Optional parameters to report
   */
  protected reportAssemblyWarning(
    code: ErrorCodes,
    sourceLine: PartialAssemblyLine<TInstruction>,
    nodePosition?: NodePosition | null,
    ...parameters: any[]
  ): void {
    if ((sourceLine as any).fileIndex === undefined) {
      return;
    }

    this.reportMacroInvocationErrors();

    const line = { ...(sourceLine as AssemblyLine<TInstruction>) };

    // --- Cut closing comment, if there is any
    if (line.sourceText) {
      const segments = line.sourceText.split(";");
      line.endColumn = line.startColumn + segments[0].trim().length - 1;
    }
    const sourceItem = this._output.sourceFileList[line.fileIndex];
    let errorText: string = errorMessages[code] ?? "Unknown warning";
    if (parameters) {
      parameters.forEach(
        (_, idx) => (errorText = replace(errorText, `{${idx}}`, parameters[idx].toString()))
      );
    }

    if (this._macroInvocations.length > 0) {
      const lines = this._macroInvocations
        .map((mi) => (mi as unknown as AssemblyLine<TInstruction>).line)
        .join(", ");
      errorText = `(from macro invocation through ${lines}) ` + errorText;
    }

    const errorInfo = new AssemblerErrorInfo(
      code,
      sourceItem.filename,
      line.line,
      nodePosition ? nodePosition.startPosition : line.startPosition,
      nodePosition ? nodePosition.endPosition : line.endPosition + 1,
      nodePosition ? nodePosition.startColumn : line.startColumn,
      nodePosition ? nodePosition.endColumn : line.endColumn + 1,
      errorText,
      true  // Mark as warning
    );
    this._output.errors.push(errorInfo);

    function replace(input: string, placeholder: string, replacement: string): string {
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

    let localScope = this._output.localScopes[this._output.localScopes.length - 1];
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
 * Is the line a byte-emitting pragma?
 * @param asmLine Assembly line to test
 */
function isByteEmittingPragma<TInstruction extends TypedObject>(
  asmLine: AssemblyLine<TInstruction>
): boolean {
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
