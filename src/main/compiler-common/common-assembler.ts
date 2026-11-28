import { t } from "@common/i18n/i18n";
import fs from "fs";
import { annotationsInComment } from "@common/utils/source-annotations";
import path from "path";

import type { ErrorCodes } from "../compiler-common/assembler-errors";
import { assemblerMessage } from "../compiler-common/assembler-errors";
import { InputStream } from "../compiler-common/input-stream";
import {
  AssemblerErrorInfo,
  AssemblerOptions,
  AssemblerOutput,
  BinarySegment,
  SourceFileItem
} from "../compiler-common/assembler-in-out";
import { AssemblyModule } from "../compiler-common/assembly-module";
import {
  AssemblySymbolInfo,
  ISymbolScope,
  SymbolDefinitionLocation,
  SymbolInfoMap,
  SymbolScope
} from "../compiler-common/assembly-symbols";
import {
  ExpressionEvaluator,
  ExpressionValue,
  setRandomSeed,
  ValueConversionError
} from "../compiler-common/expressions";
import { FixupEntry } from "../compiler-common/fixups";
import { ExpressionValueType } from "@abstractions/CompilerInfo";
import {
  BinaryComparisonInfo,
  FixupType,
  IAssemblerErrorInfo,
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
  PagePragma,
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
  LineDirective,
  LabelOnlyLine,
  LoopStatement,
  MacroOrStructInvocation,
  MacroStatement,
  ModelPragma,
  ModuleStatement,
  NodePosition,
  OnSuccessPragma,
  CommonOperandType,
  Operand,
  OrgPragma,
  PartialAssemblyLine,
  Pragma,
  RepeatStatement,
  RndSeedPragma,
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
 * One parsed and preprocessed source file, ready for `compileProgram`
 */
export type ParsedSourceUnit<TInstruction extends TypedObject> = {
  /** The unit's own file first, then the files it included; `fileIndex` of `lines` indexes this list. */
  files: SourceFileItem[];
  /** The lines to assemble, after `#include`, `#if`-family and `#define` processing. */
  lines: AssemblyLine<TInstruction>[];
  /** The unit's first `.model` pragma, applied when the unit is assembled. */
  modelPragma?: ModelPragma<TInstruction>;
  /** Errors and warnings found while parsing; copied into every output the unit is part of. */
  errors: IAssemblerErrorInfo[];
};

/**
 * The CPU-neutral assembler: the preprocessor, symbols, modules, macros, structures, loops,
 * conditionals, pragmas, fixups, segments, the list file and the source map. A CPU subclass supplies
 * the tokens, the parser of its instructions and operands, the instruction encoder and the target
 * machines' rules through the hooks below (`dev/plans/ASSEMBLER_CPU_NEUTRAL_PLAN.md`, §3).
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

  /** The names of the `.proc` blocks being assembled, innermost last (PROFILER_PLAN D7) */
  private _procNames: string[] = [];

  /** The last label defined in a module's global scope: an unnamed `.proc` is named after it (D7) */
  private _lastGlobalLabel: string | undefined;

  // --- The source line of the experession evaluation context
  protected _currentSourceLine: AssemblyLine<TInstruction>;

  // --- The current list item being processed
  protected _currentListFileItem: IListFileItem | null;

  // --- The stack of macro invocations
  protected _macroInvocations: MacroOrStructInvocation<TInstruction, TToken>[] = [];

  // --- Stack of modules that *define* the currently expanding macro(s).
  // --- Maintained in parallel with _macroInvocations (one entry per
  // --- cross-module invocation level). Used so that @-prefixed module-local
  // --- symbols inside a macro body are resolved against the defining module
  // --- even when _currentModule is the calling module.
  protected _macroDefiningModuleStack: AssemblyModule<TInstruction, TToken>[] = [];

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
   * Tells if a model supports the `.bank` pragma: null if it does, else the error to report. The
   * default: no model has memory banks.
   * @param _modelId The model ID to check
   */
  protected modelSupportsBankPragma(_modelId: number): ErrorCodes | null {
    return "Z0308";
  }

  /**
   * Gets the model ID of a `.model` name, or undefined when the CPU's machines have no such model
   * @param modelName The name in the `.model` pragma
   */
  protected abstract getModelIdByName(modelName: string): number | undefined;

  /**
   * Where code with no `.org` goes on the current model (`.model` or the options' `currentModel`).
   * `AssemblerOptions.defaultStartAddress`, when set, overrides it.
   */
  protected abstract getDefaultStartAddress(): number;

  /**
   * Converts the text of a string expression into the bytes `.defm`, `.defn`, `.defc`, `.defb` and
   * `.tracehex` emit (one character code per byte). The default keeps the text as it is.
   * @param text The string's text
   */
  protected convertStringToBytes(text: string): string {
    return text;
  }

  /**
   * Called when a compilation starts, so the CPU and machine layers can reset their own state
   */
  protected resetCpuCompilationState(): void {}

  /**
   * Called when a `.model` pragma selected a model
   * @param _modelId The selected model's ID
   */
  protected onModelSelected(_modelId: number): void {}

  /**
   * Called when a new code segment starts (no `.org`, `.org` or a new segment for `.org`)
   * @param _segment The segment
   */
  protected onSegmentStarted(_segment: BinarySegment): void {}

  /**
   * Called before every byte the assembler emits, so a machine can warn about the address
   * (for example, code where it cannot run). The current segment exists.
   */
  protected checkEmitAddress(): void {}

  /**
   * Processes a pragma the CPU-neutral core does not know (one parsed by the CPU parser's
   * `parseCpuPragma`). The default reports nothing: the parser already refused unknown pragmas.
   * @param _pragma The pragma line
   * @param _label The line's label, if any
   * @param _emitAction When set, the pragma emits its bytes through it (structure fields)
   */
  protected applyCpuPragma(
    _pragma: AssemblyLine<TInstruction>,
    _label: string | null,
    _emitAction?: (b: number) => void
  ): void {}

  /**
   * Tells if a CPU (or machine) pragma line emits bytes, and so can be a structure field
   * @param _asmLine The pragma line
   */
  protected isCpuByteEmittingPragma(_asmLine: AssemblyLine<TInstruction>): boolean {
    return false;
  }

  /**
   * Resolves a fixup type the core does not know (the CPU's, like a relative jump, or a machine's).
   * The default resolves none.
   * @param _fixup The fixup
   * @param _value The evaluated value of its expression
   * @returns True if the fixup is resolved without error
   */
  protected resolveCpuFixup(_fixup: FixupEntry<TInstruction, TToken>, _value: IExpressionValue): boolean {
    return false;
  }

  /**
   * Converts a macro argument that is a CPU operand (a register, an indirect address, ...) into the
   * value the macro body sees. The core converts expressions and missing arguments itself.
   * @param _operand The operand
   * @returns The argument value; `null` when its expression has an error (already reported);
   * `undefined` when the operand is not an argument (the argument is then empty)
   */
  protected operandToMacroArgument(_operand: Operand<TInstruction, TToken>): IExpressionValue | null | undefined {
    return undefined;
  }

  /**
   * Called after the code is emitted and the fixups are resolved, before the output is returned
   * @param emitSuccess Whether the code emission and the fixups succeeded
   * @returns Whether the assembly succeeded (a machine's final checks may fail it)
   */
  protected completeAssembly(emitSuccess: boolean): boolean {
    return emitSuccess;
  }

  /**
   * Processes the `.bank` pragma. Memory banks belong to the target machine; the core knows none.
   * @param pragma Pragma to process
   * @param _label Label information
   */
  processBankPragma(pragma: BankPragma<TInstruction, TToken>, _label: string | null): void {
    this.reportAssemblyError(this.modelSupportsBankPragma(this._output.modelType) ?? "Z0308", pragma);
  }

  /**
   * Processes the `.page` pragma. Memory pages belong to the target machine; the core knows none.
   * @param pragma Pragma to process
   * @param _label Label information
   */
  processPagePragma(pragma: PagePragma<TInstruction, TToken>, _label: string | null): void {
    this.reportAssemblyError("Z0333", pragma);
  }

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

  // --- The `.model` pragmas met while parsing, in source order
  private _modelPragmas: ModelPragma<TInstruction>[] = [];

  /**
   * Store the handler of trace messages
   */
  private _traceHandler: (message: string) => void;

  /**
   * Compiles the assembly code in the specified file into
   * binary code.
   * @param filename Assembly source file (absolute path)
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
   * Compiles the passed assembly code into binary code.
   * binary code.
   * @param sourceText Assembly source code text
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
   * Compiles the passed assembly code into binary code.
   * @param sourceItem Represents the source file item to add to the output
   * @param sourceText Assembly source code text
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  private async doCompile(
    sourceItem: SourceFileItem,
    sourceText: string,
    options?: AssemblerOptions
  ): Promise<AssemblerOutput<TInstruction, TToken>> {
    this.initCompilation(sourceItem, options);
    const parseResult = await this.executeParse(0, sourceItem, sourceText);
    return await this.assembleParsedLines(parseResult.parsedLines);
  }

  /**
   * Parses and preprocesses one source file into a unit that `compileProgram` can assemble, any
   * number of times and together with other units. Parsing is the expensive part of a build, so a
   * caller may cache the unit and reuse it across builds, as long as the text and the options that
   * affect preprocessing (`predefinedSymbols`, `currentModel`, case sensitivity) are unchanged.
   * @param filename The (possibly virtual) file name the unit's lines and errors refer to
   * @param sourceText Assembly source code text
   * @param options Compiler options used for preprocessing
   */
  async parseSourceUnit(
    filename: string,
    sourceText: string,
    options?: AssemblerOptions
  ): Promise<ParsedSourceUnit<TInstruction>> {
    const sourceItem = new SourceFileItem(filename);
    this.initCompilation(sourceItem, options);
    const parseResult = await this.executeParse(0, sourceItem, sourceText);
    return {
      files: this._output.sourceFileList.slice() as SourceFileItem[],
      lines: parseResult.parsedLines,
      modelPragma: this._modelPragmas[0],
      errors: this._output.errors.slice()
    };
  }

  /**
   * Assembles a program made of parsed units (see `parseSourceUnit`) as one compilation, as if the
   * units were concatenated in order. The first unit's first file is the output's `sourceItem`. The
   * units' files are appended to `sourceFileList` in order, and every line's `fileIndex` is shifted
   * accordingly, so list items, the source map and errors refer to the right virtual file.
   *
   * Each unit is preprocessed on its own: a `#define` in one unit is not visible in the next.
   * @param program The units of the program, in assembly order
   * @param options Compiler options. If not defined, the compiler uses the default options.
   */
  async compileProgram(
    program: ParsedSourceUnit<TInstruction>[],
    options?: AssemblerOptions
  ): Promise<AssemblerOutput<TInstruction, TToken>> {
    if (program.length === 0 || program[0].files.length === 0) {
      throw new Error("compileProgram needs at least one unit with a source file.");
    }
    this.initCompilation(program[0].files[0], options);
    const fileList = this._output.sourceFileList;
    fileList.length = 0;

    const lines: AssemblyLine<TInstruction>[] = [];
    for (const unit of program) {
      const offset = fileList.length;
      fileList.push(...unit.files);
      this._output.errors.push(...unit.errors);
      for (const line of unit.lines) {
        // --- Units are shared between builds: never mutate their lines
        lines.push({ ...line, fileIndex: line.fileIndex + offset });
      }
      if (unit.modelPragma) {
        const pragma = {
          ...unit.modelPragma,
          fileIndex: (unit.modelPragma as unknown as AssemblyLine<TInstruction>).fileIndex + offset
        };
        this.setSourceLine(pragma as unknown as AssemblyLine<TInstruction>);
        this.processModelPragma(pragma);
      }
    }
    return await this.assembleParsedLines(lines);
  }

  /**
   * Resets the assembler's state for a new compilation
   */
  private initCompilation(sourceItem: SourceFileItem, options?: AssemblerOptions): void {
    this._options = options ?? new AssemblerOptions();

    this._currentModule = this._output = new AssemblerOutput<TInstruction, TToken>(
      sourceItem,
      options?.useCaseSensitiveSymbols ?? false
    );
    this.compareBins = [];
    this._modelPragmas = [];

    // --- The emission state of a previous compilation on this instance
    this._currentSegment = null;
    this._currentStructInvocation = null;
    this._currentStructLine = null;
    this._currentStructBytes = null;
    this._isInStructCloning = false;
    this._overflowLabelLine = null;
    this._procNames = [];
    this._lastGlobalLabel = undefined;
    this._macroInvocations = [];
    this._macroDefiningModuleStack = [];
    this.resetCpuCompilationState();

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
  }

  /**
   * Emits code for preprocessed lines and resolves fixups: the stages after parsing
   */
  private async assembleParsedLines(
    parsedLines: AssemblyLine<TInstruction>[]
  ): Promise<AssemblerOutput<TInstruction, TToken>> {
    this.preprocessedLines = parsedLines;

    let emitSuccess = await this.emitCode(this.preprocessedLines);
    if (emitSuccess) {
      emitSuccess = (await this.fixupUnresolvedSymbols()) && this.compareBinaries();
    }

    // --- The CPU's and machine's final steps (they may fail the assembly)
    emitSuccess = this.completeAssembly(emitSuccess);
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

    // Keep processing the parser's recovered lines after syntax errors. The
    // compilation will remain unsuccessful (and no binary will be emitted),
    // but later declarations must still be available to editor intelligence.

    // --- Now, process directives and the .model pragma
    let currentLineIndex = 0;
    let ifdefStack: (boolean | null)[] = [];
    let processOps: ProcessOps = { ops: true };
    const visitedLines = parsed.assemblyLines;

    // --- Where `#line` redirects the lines that follow it
    let lineFileIndex = fileIndex;
    let lineDelta = 0;

    // --- Traverse through parsed lines
    while (currentLineIndex < visitedLines.length) {
      const line = visitedLines[currentLineIndex];
      this.setSourceLine(line as AssemblyLine<TInstruction>);
      if (processOps.ops) {
        const typedLine = line as any;
        switch (typedLine.type) {
          case "ModelPragma":
            this._modelPragmas.push(typedLine);
            this.processModelPragma(typedLine);
            break;

          case "IncludeDirective": {
            // --- Parse the included file
            const includedLines = await this.applyIncludeDirective(typedLine, sourceItem);
            if (includedLines.parsedLines) {
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

          case "LineDirective": {
            const target = this.applyLineDirective(typedLine, sourceItem);
            if (target) {
              lineFileIndex = target.fileIndex ?? lineFileIndex;
              lineDelta = target.nextLine - (typedLine.line + 1);
            }
            break;
          }

          default: {
            if (
              !this.applyScopedDirective(
                line as unknown as Directive<TInstruction, TToken>,
                ifdefStack,
                processOps
              )
            ) {
              line.sourceText = sourceText.substr(
                line.startPosition,
                line.endPosition - line.startPosition + 1
              );
              line.fileIndex = lineFileIndex;
              if (lineDelta) {
                line.line += lineDelta;
              }
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
      await this.fixupSymbols(scope, false);
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
      const filename = resolveSourcePath(currentSourceFile.filename, fileNameValue.asString());

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
   * Evaluates a `#line <number> ["<file>"]` directive: the line after it is reported as line
   * `<number>` of `<file>` (of the current file when omitted). A relative file name is resolved like
   * an `#include`; a file not yet in the source file list is added to it without being read.
   * @returns The line number of the next line and the file index to report, or null on error
   */
  private applyLineDirective(
    lineDir: LineDirective<TInstruction, TToken>,
    sourceItem: SourceFileItem
  ): { nextLine: number; fileIndex?: number } | null {
    const value = this.evaluateExprImmediate(lineDir.lineNumber);
    if (!value.isValid) {
      return null;
    }
    if (value.type !== ExpressionValueType.Integer || value.asLong() < 1) {
      this.reportAssemblyError("Z0209", lineDir);
      return null;
    }
    const nextLine = value.asLong();
    if (lineDir.filename === null || lineDir.filename === undefined) {
      return { nextLine };
    }

    let filename = lineDir.filename.trim();
    if (sourceItem.filename !== NO_FILE_ITEM) {
      filename = resolveSourcePath(sourceItem.filename, filename);
    }
    const fileItem = new SourceFileItem(filename);
    const fileList = this._output.sourceFileList;
    let fileIndex = fileList.findIndex((f) => f.filename === fileItem.filename);
    if (fileIndex < 0) {
      fileList.push(fileItem);
      fileIndex = fileList.length - 1;
    }
    return { nextLine, fileIndex };
  }

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
      // --- A relative file name is relative to the including file
      filename = resolveSourcePath(sourceItem.filename, filename).replace(/\\/g, "/");
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

    const modelType = this.getModelIdByName(pragma.modelId);
    if (modelType === undefined) {
      this.reportAssemblyError("Z0303", pragma, null, pragma.modelId);
      return;
    }
    this._output.modelType = modelType;
    this.onModelSelected(modelType);
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
    // --- For @-prefixed module-local symbols that were not found in the
    // --- current module chain, also try the module that defines the
    // --- currently expanding macro (if any). This allows cross-module macro
    // --- invocations to find @-symbols that live in the defining module while
    // --- all other symbol lookups remain anchored to the calling module.
    if (!resolved && symbol.startsWith("@") && this._macroDefiningModuleStack.length > 0) {
      const defModule = this._macroDefiningModuleStack[this._macroDefiningModuleStack.length - 1];
      if (defModule !== this._currentModule) {
        resolved = defModule.resolveSimpleSymbol(symbol);
      }
    }
    return resolved;
  }

  /**
   * Records a symbol reference at the given node position.
   * Called from the expression evaluator when an identifier is resolved.
   */
  recordSymbolReference(symbolName: string, node: NodePosition): void {
    if (!this._currentSourceLine) return;
    this._output.symbolReferences.push({
      symbolName: this.isCaseSensitive ? symbolName : symbolName.toLowerCase(),
      fileIndex: this._currentSourceLine.fileIndex,
      line: node.line,
      startColumn: node.startColumn,
      endColumn: node.endColumn
    });
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

  /**
   * When true, `reportAssemblyError` and `reportAssemblyWarning` skip pushing
   * `Z1012` invocation markers. Used while reporting deferred (fixup-time)
   * errors so we don't synthesize new invocation-marker errors at a phase
   * where the macro stack has been re-applied artificially.
   */
  private _suppressMacroInvocationMarkers = false;

  /**
   * Captures a snapshot of the current macro invocation stack so it can be
   * re-applied later when reporting deferred (fixup-time) errors.
   */
  captureMacroInvocationContext(): unknown {
    return this._macroInvocations.slice();
  }

  /**
   * Temporarily restores a previously captured macro invocation stack while
   * `fn` runs, then restores the previous one. Marker emission is suppressed
   * for the duration so that only the descriptive prefix is added to the
   * error message — the deferred error itself is the only entry produced.
   */
  withMacroInvocationContext<T>(snapshot: unknown, fn: () => T): T {
    const stack = snapshot as MacroOrStructInvocation<TInstruction, TToken>[] | undefined;
    if (!stack || stack.length === 0) {
      return fn();
    }
    const previousStack = this._macroInvocations;
    const previousSuppress = this._suppressMacroInvocationMarkers;
    this._macroInvocations = stack;
    this._suppressMacroInvocationMarkers = true;
    try {
      return fn();
    } finally {
      this._macroInvocations = previousStack;
      this._suppressMacroInvocationMarkers = previousSuppress;
    }
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
        ? this._options?.defaultStartAddress ?? this.getDefaultStartAddress()
        : defaultAddress) & 0xffff;
    segment.currentInstructionOffset = 0;
    segment.maxCodeLength = maxLength & 0xffff;
    this._output.segments.push(segment);
    this._currentSegment = segment;
    this.onSegmentStarted(segment);
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
    /*
     * A DeZog `LOGPOINT`, `ASSERTION` or `WPMEM` comment (`dev/plans/LOGPOINTS_PLAN.md` §4.7,
     * `dev/plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` §4.3) on any line that is assembled -
     * comment-only and label-only lines included; lines of a false IF branch never get here. It
     * fires at the line's own address when the line emits code, and otherwise at the location
     * counter after it: the next instruction emitted in the same segment. Each macro expansion
     * passes through here with its own address, so it yields its own annotation.
     */
    const found = annotationsInComment(asmLine.comment);
    if (found.length === 0) {
      await this.emitLineReportingConversions(allLines, scopeLines, asmLine, currentLineIndex, fromMacroEmit);
      return;
    }
    const segmentBefore = this._currentSegment;
    const lengthBefore = segmentBefore?.emittedCode.length ?? 0;
    const addressBefore = this.getCurrentAssemblyAddress();
    await this.emitLineReportingConversions(allLines, scopeLines, asmLine, currentLineIndex, fromMacroEmit);
    const emitted =
      this._currentSegment === segmentBefore &&
      (this._currentSegment?.emittedCode.length ?? 0) > lengthBefore;
    // --- `ASSERTION` and `WPMEM` (G1.5) follow the same address rule: an assertion on an
    // --- instruction's line is checked before that instruction runs; on its own line, before the
    // --- next one. A WPMEM without an address watches the line's own address.
    // --- In a macro body, the outermost invocation is the line the user wrote: a failure names it
    // --- (`dev/plans/Z80_UNIT_TESTS_PLAN.md` T2)
    const invocation = this._macroInvocations[0] as unknown as AssemblyLine<TInstruction> | undefined;
    const invokedAt =
      invocation && (invocation.fileIndex !== asmLine.fileIndex || invocation.line !== asmLine.line)
        ? { fileIndex: invocation.fileIndex, line: invocation.line }
        : undefined;
    for (const { kind, text } of found) {
      this._output.debugAnnotations.push({
        kind,
        fileIndex: asmLine.fileIndex,
        line: asmLine.line,
        address: (emitted ? addressBefore : this.getCurrentAssemblyAddress()) & 0xffff,
        segmentIndex: this._output.segments.length - 1,
        text,
        ...(invokedAt ? { invokedAt } : {})
      });
    }
  }

  /**
   * `emitSingleLineCore`, reporting a string used as a number (`.org "a"`, `jr "a"`) as Z0601 on the
   * line instead of letting the conversion's exception end the compilation
   */
  private async emitLineReportingConversions(
    allLines: AssemblyLine<TInstruction>[],
    scopeLines: AssemblyLine<TInstruction>[],
    asmLine: AssemblyLine<TInstruction>,
    currentLineIndex: { index: number },
    fromMacroEmit: boolean
  ): Promise<void> {
    try {
      await this.emitSingleLineCore(allLines, scopeLines, asmLine, currentLineIndex, fromMacroEmit);
    } catch (err) {
      if (!(err instanceof ValueConversionError)) {
        throw err;
      }
      this.reportAssemblyError("Z0601", asmLine);
    }
  }

  /** `emitSingleLine` without the source-annotation scan. */
  private async emitSingleLineCore(
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
      const structDef = this._currentModule.resolveCompoundStruct(asmLine.label.name);
      if (structDef) {
        // --- We have found a structure definition
        this.reportAssemblyError("Z1013", asmLine, null, asmLine.label.name);
        return;
      }

      // // --- Let's handle macro invocation
      const macroDef = this._currentModule.resolveCompoundMacro(asmLine.label.name);
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
      let currentLabelLine: AssemblyLine<TInstruction> = asmLine;
      if (!this._overflowLabelLine) {
        // --- No hanging label, use the current line
        currentLabel = asmLine.label?.name;
      } else {
        if (!asmLine.label) {
          // --- No current label, use the hanging label
          currentLabel = this._overflowLabelLine.label?.name;
          currentLabelLine = this._overflowLabelLine as unknown as AssemblyLine<TInstruction>;
        } else {
          // --- Create a point for the hanging label and then use the current label
          if (
            !(
              this._isInStructCloning ||
              (this.isByteEmittingPragma(asmLine) && this._currentStructInvocation)
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
            (isFieldAssignment && this.isByteEmittingPragma(asmLine) && this._currentStructInvocation)
          )
        ) {
          if (!currentLabel.startsWith("`") && this._currentModule.localScopes.length > 0) {
            // --- Check if temporary scope should be fixed and disposed
            await this.fixupTemporaryScope();
          }
          if (!isFieldAssignment) {
            await this.addSymbol(
              currentLabel,
              currentLabelLine,
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
    value: IExpressionValue,
    symbolType: SymbolType = SymbolType.Label
  ): Promise<void> {
    const assembler = this;
    const displayName = symbol;

    // --- Handle case-sensitivity
    if (!this._options.useCaseSensitiveSymbols) {
      symbol = symbol.toLowerCase();
    }

    if (symbol.startsWith(".")) {
      // --- A dot-prefixed name is defined in the global scope, even in a macro or a module: the
      // --- unit-test include lays down DeZog's `UNITTEST_*` labels this way (Z80_UNIT_TESTS_PLAN D4)
      symbol = symbol.substring(1);
      const info = new AssemblySymbolInfo(symbol, symbolType, value, locationFromLine(line));
      if (displayName.substring(1) !== symbol) info.writtenName = displayName.substring(1);
      this._output.symbols[symbol] = info;
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

    const info = new AssemblySymbolInfo(symbol, symbolType, value, locationFromLine(line));
    if (displayName !== symbol) info.writtenName = displayName;
    lookup[symbol] = info;
    if (symbolType === SymbolType.Label && lookup === this._currentModule.symbols && !symbolIsTemporary) {
      this._lastGlobalLabel = displayName;
    }

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
    return symbolInfo && (symbolInfo.type === SymbolType.Label || symbolInfo.type === SymbolType.Equ);
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
  private setVariable(
    name: string,
    value: IExpressionValue,
    location?: SymbolDefinitionLocation
  ): void {
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
    scope.addSymbol(name, AssemblySymbolInfo.createVar(name, value, location));
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
    // --- Inside a structure invocation, the byte-emitting pragmas emit into the structure's bytes
    const structEmit = this._currentStructInvocation ? (b: number) => this.emitStructByte(b) : undefined;
    switch (pragmaLine.type) {
      case "OrgPragma":
        await this.processOrgPragma(pragmaLine, label);
        break;
      case "BankPragma":
        this.processBankPragma(pragmaLine, label);
        break;
      case "PagePragma":
        this.processPagePragma(pragmaLine, label);
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
        this.processDefBPragma(pragmaLine, structEmit);
        break;
      case "DefWPragma":
        this.processDefWPragma(pragmaLine, structEmit);
        break;
      case "DefMPragma":
      case "DefNPragma":
      case "DefCPragma":
        this.processDefMNCPragma(pragmaLine, structEmit);
        break;
      case "DefHPragma":
        this.processDefHPragma(pragmaLine, structEmit);
        break;
      case "DefSPragma":
        this.processDefSPragma(pragmaLine, structEmit);
        break;
      case "FillbPragma":
        this.processFillbPragma(pragmaLine, structEmit);
        break;
      case "FillwPragma":
        this.processFillwPragma(pragmaLine, structEmit);
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
        this.processDefGPragma(pragmaLine, structEmit);
        break;
      case "DefGxPragma":
        this.processDefGXPragma(pragmaLine, structEmit);
        break;
      case "OnSuccessPragma":
        this.processOnSuccessPragma(pragmaLine);
        break;
      default:
        // --- A pragma of the CPU or of its target machines
        this.applyCpuPragma(pragmaLine as unknown as AssemblyLine<TInstruction>, label, structEmit);
        break;
    }
  }

  /**
   * Tests if the specified line is a byte-emitting pragma (one that can be a structure field)
   * @param asmLine Assembly line to test
   */
  private isByteEmittingPragma(asmLine: AssemblyLine<TInstruction>): boolean {
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
        return asmLine.type.endsWith("Pragma") && this.isCpuByteEmittingPragma(asmLine);
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
    } else {
      this._currentSegment.startAddress = value.value;
    }
    this.onSegmentStarted(this._currentSegment);

    if (!label) {
      return;
    }

    // --- There is a labels, set its value
    await this.fixupTemporaryScope();
    await this.addSymbol(label, pragma as unknown as AssemblyLine<TInstruction>, value);
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
      await this.addSymbol(label, asmLine, value, SymbolType.Equ);
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
    this.setVariable(label, value, locationFromLine(pragma));
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
      if (!fillValue.isValid) {
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
          // --- A string emits its characters, one byte each, so text and numbers can be
          // --- mixed (`.defb 22, 9, 5, "TEXT"`), as in other assemblers
          this.emitString(value, false, false, emitAction);
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
    if (!byteVector.isValid) {
      return;
    }
    if (byteVector.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z0316", pragma);
      return;
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
              intValue >= 0x10000
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
            const bytes = this.convertStringToBytes(exprValue.asString());
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
    const filename = resolveSourcePath(currentSourceFile.filename, fileNameValue.asString());

    let contents: Buffer | null = null;
    try {
      contents = fs.readFileSync(filename);
    } catch (err) {
      this.reportAssemblyError("Z0322", pragma, null, filename, err.message);
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
      this._currentSegment.currentOffset + length >
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
    const invocationName = macroOrStructStmt.identifier.name;
    const structDef = this._currentModule.resolveCompoundStruct(invocationName);
    if (structDef) {
      // --- We have found a structure definition
      this.recordSymbolReference(invocationName, macroOrStructStmt.identifier);
      await this.processStructInvocation(macroOrStructStmt, structDef, allLines);
      return;
    }

    // --- Let's handle macro invocation
    // --- Check if macro definition exists
    const macroName = invocationName;
    const macroEntry = this._currentModule.resolveCompoundMacroEntry(macroName);
    if (!macroEntry) {
      this.reportAssemblyError("Z1007", macroOrStructStmt, null, macroName);
      return;
    }
    const macroDef = macroEntry.macro;

    // --- Record the macro invocation as a symbol reference
    this.recordSymbolReference(macroName, macroOrStructStmt.identifier);

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

    // --- If the defining module differs from the calling module, push it
    // --- onto the defining-module stack so that @-prefixed symbols inside
    // --- the macro body resolve against the defining module while all other
    // --- symbol lookups (including macro arguments) remain in the caller's
    // --- context. This is symmetric with the pop in restoreMacroStack().
    const definerPushed = macroEntry.owner !== this._currentModule;
    if (definerPushed) {
      this._macroDefiningModuleStack.push(macroEntry.owner);
    }

    // --- Push the invocation line to the stack
    this._macroInvocations.push(macroOrStructStmt);

    // --- Evaluate arguments
    // --- No prototype: an argument named `constructor` or `toString` is an ordinary name
    const macroArgs: Record<string, IExpressionValue> = Object.create(null);
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
        case CommonOperandType.Expression:
          // Forward references are not evaluated yet, but they are still
          // source-level usages and must be visible to editor references.
          if (!this.readyToEvaluate(op.expr) && op.expr.type === "Symbol") {
            this.recordSymbolReference(op.expr.identifier.name, op.expr.identifier);
          }
          argValue = this.evaluateExpr(op.expr);
          if (argValue.isNonEvaluated) {
            argValue = new ExpressionValue(op.expr.sourceText);
          }
          break;
        case CommonOperandType.NoneArg:
          argValue = emptyArgValue;
          break;
        default: {
          // --- A CPU operand (a register, an indirect address, ...)
          const cpuArg = this.operandToMacroArgument(op);
          if (cpuArg === null) {
            errorFound = true;
          } else {
            argValue = cpuArg ?? emptyArgValue;
          }
          break;
        }
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
        new ExpressionValue(this.getCurrentAssemblyAddress()),
        locationFromLine(macroOrStructStmt as unknown as AssemblyLine<TInstruction>)
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
          // --- A function replacement: `$$`, `$&` in the argument are kept as they are
          const argText = macroArgs[argName].asString();
          newText = newText.replace(toReplace, () => argText);
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
        const errorPrefix = this.buildMacroInvocationPrefix();
        const errorInfo = new AssemblerErrorInfo(
          error.code,
          this._output.sourceFileList[origLine.fileIndex].filename,
          origLine.line,
          origLine.startPosition,
          origLine.endPosition,
          origLine.startColumn,
          origLine.endColumn,
          // --- An error, not a warning: it stops the macro and fails the compilation
          errorPrefix + error.text
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
     * Restores the original depth of the macro stack and pops the
     * defining-module stack if we pushed an entry for this invocation.
     */
    function restoreMacroStack() {
      assembler._macroInvocations.length = macroStackDepth;
      if (definerPushed) {
        assembler._macroDefiningModuleStack.pop();
      }
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
        this.reportAssemblyError("Z0704", stmt, null, ".endm/.mend", ".macro");
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
        await this.processProcStatement(allLines, scopeLines, currentLineIndex, label);
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
    const macroLine = allLines[firstLine];
    const bodyLines: string[] = [];
    for (let bi = firstLine + 1; bi < currentLineIndex.index; bi++) {
      bodyLines.push((allLines[bi].sourceText as string) ?? "");
    }
    const macroDef: IMacroDefinition<TInstruction> = {
      macroName: label,
      argNames: macro.parameters,
      endLabel: searchResult.label,
      section: {
        firstLine,
        lastLine: currentLineIndex.index
      },
      fileIndex: (macroLine as any).fileIndex ?? 0,
      sourceLine: macroLine.line,
      startColumn: macroLine.startColumn,
      endColumn: macroLine.endColumn,
      bodyLines: bodyLines.length > 0 ? bodyLines : undefined
    };

    // --- Check each macro line for invalid macro parameter names
    // --- or nested macro
    for (let i = firstLine + 1; i < currentLineIndex.index; i++) {
      var mLine = allLines[i];

      // --- Check for parse-time function parameters
      // --- (they can have only macro parameter arguments)
      if (mLine.type === "MacroStatement") {
        this.reportAssemblyError("Z1005", mLine);
        errorFound = true;
        continue;
      }

      const isCaseSensitive = this.isCaseSensitive;
      if (mLine.macroParams) {
        for (const param of mLine.macroParams) {
          const findParam = macro.parameters.find(
            (p) =>
              (isCaseSensitive ? p.name : p.name.toLowerCase()) ===
              (isCaseSensitive ? param.identifier.name : param.identifier.name.toLowerCase())
          );
          if (findParam) {
            continue;
          }

          errorFound = true;
          this.reportAssemblyError("Z1006", mLine, null, param.identifier.name);
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
        !this.isByteEmittingPragma(structLine) &&
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

        default:
          // --- A byte-emitting pragma of the CPU or of its target machines
          this.applyCpuPragma(structLine, null, emitAction);
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
      AssemblySymbolInfo.createLabel(label, new ExpressionValue(structOffset), locationFromLine(structStmt))
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
    // --- Every exit path restores the scope stack to this depth (the loop and iteration scopes)
    const scopeDepth = this._currentModule.localScopes.length;
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
        break;
      }
      if (loopCondition.type === ExpressionValueType.String) {
        this.reportAssemblyError("Z0603", whileStmt);
        break;
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
    this._currentModule.localScopes.length = scopeDepth;
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
    // --- Every exit path restores the scope stack to this depth (the loop and iteration scopes)
    const scopeDepth = this._currentModule.localScopes.length;
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
        break;
      }
      if (loopExitCondition.type === ExpressionValueType.String) {
        this.reportAssemblyError("Z0603", untilStmt);
        break;
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
    this._currentModule.localScopes.length = scopeDepth;
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

      // --- The first true condition selects the section
      if (conditionValue.asBool()) {
        sectionToCompile = ifSection;
        break;
      }
    }

    // --- Emit the matching section (no matching IF, ELIF, and no ELSE: nothing to emit)
    sectionToCompile = sectionToCompile ?? ifDef.definition.elseSection;
    if (sectionToCompile) {
      const loopLineIndex = { index: sectionToCompile.section.firstLine + 1 };
      while (loopLineIndex.index < sectionToCompile.section.lastLine) {
        const curLine = scopeLines[loopLineIndex.index];
        await this.emitSingleLine(allLines, scopeLines, curLine, loopLineIndex);
        loopLineIndex.index++;
      }
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
    currentLineIndex: { index: number },
    label?: string | null
  ): Promise<void> {
    // --- Search for the end of the proc
    const firstLine = currentLineIndex.index;
    const searchResult = this.searchForEndStatement("ProcStatement", scopeLines, currentLineIndex);
    if (!searchResult.found) {
      return;
    }

    // --- End found
    const lastLine = currentLineIndex.index;

    // --- The procedure's extent (`dev/plans/PROFILER_PLAN.md` D7): its name is the label on the
    // --- `.proc` line, or the enclosing one - the open proc's, else the last global label
    const procStart = this.getCurrentAssemblyAddress();
    const procSegment = this._output.segments.length - 1;
    const enclosing = this._procNames[this._procNames.length - 1];
    const ownName = label && !label.startsWith("`") ? label : undefined;
    const baseName = ownName
      ? enclosing
        ? `${enclosing}.${ownName}`
        : ownName
      : (enclosing ?? this._lastGlobalLabel ?? `proc_${procStart.toString(16).padStart(4, "0")}`);
    const modulePath = this.modulePathOf(this._currentModule);
    const procName = modulePath && !enclosing ? `${modulePath}.${baseName}` : baseName;
    this._procNames.push(procName);

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

    // --- Record the extent; a proc that emitted nothing has none
    this._procNames.pop();
    const procEnd = this.getCurrentAssemblyAddress();
    if (procEnd !== procStart || this._output.segments.length - 1 !== procSegment) {
      const startLine = scopeLines[firstLine];
      this._output.procedures.push({
        name: procName,
        startAddress: procStart,
        endAddress: procEnd,
        segmentIndex: procSegment,
        fileIndex: startLine.fileIndex,
        startLine: startLine.line,
        endLine: scopeLines[lastLine].line
      });
    }
  }

  /** The dotted path of a nested module ("" for the root) */
  private modulePathOf(module: AssemblyModule<TInstruction, TToken>): string {
    const parts: string[] = [];
    let current = module;
    while (current.parentModule) {
      const parent = current.parentModule;
      const name = Object.keys(parent.nestedModules).find((key) => parent.nestedModules[key] === current);
      if (name) parts.unshift(name);
      current = parent;
    }
    return parts.join(".");
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
    // --- The name as written: unit-test suites are named after it (`dev/plans/Z80_UNIT_TESTS_PLAN.md` T3)
    newModule.writtenName = moduleName;
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
  // Code emission helpers for the CPU encoders

  /**
   * Emits a new byte to the current code segment
   * @param data Data byte to emit
   */
  protected emitByte(data: number): void {
    this.ensureCodeSegment();
    this.checkEmitAddress();
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
    const bytes = this.convertStringToBytes(message.asString());
    if (bytes.length === 0) {
      // --- An empty string emits nothing but its terminator (`.defn ""` is a single zero)
      if (nullTerminator) {
        emit(0x00);
      }
      return;
    }
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
   * @param data Optional fixup-specific data
   */
  protected recordFixup(
    opLine: AssemblyLine<TInstruction>,
    type: FixupType,
    expr: Expression<TInstruction, TToken>,
    label: string | null = null,
    structBytes: Map<number, number> | null = null,
    offset: number | null = null,
    data: number | null = null
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
      structBytes,
      data
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
          scope.addSymbol(
            equ.label,
            AssemblySymbolInfo.createEqu(
              equ.label,
              evalResult.value,
              locationFromLine(equ.sourceLine)
            )
          );
        }
      } else {
        success = false;
      }
    }

    // --- #2: fix Bit8, Bit16, Bit16Be, Ent, Xent, and the CPU's and machine's own fixups
    // --- (Jr, BitIndex, NexStackAddr, NexEntryAddr, CopperWait, CopperMove, ...)
    for (const fixup of scope.fixups.filter(
      (f) =>
        !f.resolved &&
        f.type !== FixupType.Equ &&
        f.type !== FixupType.Struct &&
        f.type !== FixupType.FieldBit8 &&
        f.type !== FixupType.FieldBit16
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

          case FixupType.Ent:
            this._output.entryAddress = evalResult.value.asWord();
            break;

          case FixupType.Xent:
            this._output.exportEntryAddress = evalResult.value.asWord();
            break;

          default:
            // --- The CPU's or the machine's own fixup
            if (!this.resolveCpuFixup(fixup, evalResult.value)) {
              success = false;
            }
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

      // --- The same fixup is in every enclosing scope: applying it again from an outer scope would
      // --- overwrite the field values an inner scope's field fixups have patched since
      fixup.resolved = true;
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
    const depth = this._macroInvocations.length;
    for (let i = depth - 1; i >= 0; i--) {
      const invocation = this._macroInvocations[i];
      const errorLine = invocation as unknown as AssemblyLine<TInstruction>;
      const sourceItem = this._output.sourceFileList[errorLine.fileIndex];
      const macroName = invocation.identifier?.name ?? "<anonymous>";
      const levelText = depth > 1 ? ` (level ${i + 1} of ${depth})` : "";
      const errorInfo = new AssemblerErrorInfo(
        "Z1012",
        sourceItem.filename,
        errorLine.line,
        errorLine.startPosition,
        errorLine.endPosition,
        errorLine.startColumn,
        errorLine.endColumn,
        `Error in invocation of macro '${macroName}'${levelText} at ${sourceItem.filename}:${errorLine.line}:${errorLine.startColumn}`
      );
      this._output.errors.push(errorInfo);
    }
  }

  /**
   * Builds a human-readable prefix that describes the chain of pending macro
   * invocations. The chain runs from the outermost invocation (the one the
   * user wrote) to the innermost one whose body is currently being expanded.
   * Returns an empty string when no macro invocation is active.
   */
  private buildMacroInvocationPrefix(): string {
    if (this._macroInvocations.length === 0) {
      return "";
    }
    const parts: string[] = [];
    for (let i = 0; i < this._macroInvocations.length; i++) {
      const invocation = this._macroInvocations[i];
      const invLine = invocation as unknown as AssemblyLine<TInstruction>;
      const macroName = invocation.identifier?.name ?? "<anonymous>";
      const sourceItem = this._output.sourceFileList[invLine.fileIndex];
      const file = sourceItem ? sourceItem.filename : "<unknown>";
      parts.push(`'${macroName}' at ${file}:${invLine.line}:${invLine.startColumn}`);
    }
    return `(in macro invocation ${parts.join(" -> ")}) `;
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

    if (!this._suppressMacroInvocationMarkers) {
      this.reportMacroInvocationErrors();
    }

    const line = { ...(sourceLine as AssemblyLine<TInstruction>) };

    // --- Cut closing comment, if there is any
    if (line.sourceText) {
      const segments = line.sourceText.split(";");
      line.endColumn = line.startColumn + segments[0].trim().length - 1;
    }
    const sourceItem = this._output.sourceFileList[line.fileIndex];
    let errorText: string = assemblerMessage(code, parameters) ?? t("compiler.asm.unknownError");

    errorText = this.buildMacroInvocationPrefix() + errorText;

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

    if (!this._suppressMacroInvocationMarkers) {
      this.reportMacroInvocationErrors();
    }

    const line = { ...(sourceLine as AssemblyLine<TInstruction>) };

    // --- Cut closing comment, if there is any
    if (line.sourceText) {
      const segments = line.sourceText.split(";");
      line.endColumn = line.startColumn + segments[0].trim().length - 1;
    }
    const sourceItem = this._output.sourceFileList[line.fileIndex];
    let errorText: string = assemblerMessage(code, parameters) ?? t("compiler.asm.unknownWarning");

    errorText = this.buildMacroInvocationPrefix() + errorText;

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
 * Extracts a SymbolDefinitionLocation from an AssemblyLine.
 */
function locationFromLine<TInstruction extends TypedObject>(
  line: AssemblyLine<TInstruction>
): SymbolDefinitionLocation {
  return {
    fileIndex: line.fileIndex,
    line: line.line,
    startColumn: line.startColumn,
    endColumn: line.endColumn
  };
}

/**
 * One `.copper` word as it was emitted: where it is, and which line produced it
 */

/**
 * Resolves a file name in a source file (`#include`, `.includebin`, `.comparebin`, `#line`): an
 * absolute name as it is, a relative one from the source file's folder
 * @param sourceFile The source file the name is in
 * @param fileName The file name
 */
function resolveSourcePath(sourceFile: string, fileName: string): string {
  return path.isAbsolute(fileName) ? fileName : path.join(path.dirname(sourceFile) ?? "", fileName);
}
