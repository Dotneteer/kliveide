import { AppState } from "@common/state/AppState";
import { ISourceFileItem } from "@main/compiler-common/abstractions";

/**
 * Represents the possible types of an expression value
 */
export enum ExpressionValueType {
  Error = 0,
  Bool,
  Integer,
  Real,
  String,
  NonEvaluated
}

/**
 * Represents the input options of the Klive Z80 Compiler
 */
export type CompilerOptions = {
  /**
   * Predefined compilation symbols
   */
  predefinedSymbols: Record<string, ExpressionValue>;

  /**
   * The default start address of the compilation
   */
  defaultStartAddress?: number;

  /**
   * The current ZX Spectrum model
   */
  currentModel: number;

  /**
   * The maximum number of errors to report within a loop
   */
  maxLoopErrorsToReport: number;

  /**
   * Indicates that assembly symbols should be case sensitively.
   */
  useCaseSensitiveSymbols: boolean;

  /**
   * Allows flexible use of DEFx pragmas
   */
  flexibleDefPragmas: boolean;
};

/**
 * A single segment of the code compilation
 */
export type BinarySegment = {
  /**
   * The bank of the segment
   */
  readonly bank?: number;

  /**
   * Start offset used for banks
   */
  readonly bankOffset?: number;

  /**
   * Start address of the compiled block
   */
  readonly startAddress: number;

  /**
   * Emitted Z80 binary code
   */
  readonly emittedCode: number[];

  /**
   * Intel hex start address of this segment
   */
  readonly xorgValue?: number;
};

/**
 * Represents the entire compiler output
 */
export interface CompilerOutput extends CompiledModule {
  /**
   * Source file item of the compiled code
   */
  readonly sourceItem: SourceFileItem;

  /**
   * The segments of the compilation output
   */
  readonly segments: BinarySegment[];

  /**
   * The errors found during the compilation
   */
  readonly errors: AssemblerErrorInfo[];

  /**
   * Number of errors
   */
  readonly errorCount: number;

  /**
   * The type of Spectrum model to use
   */
  modelType?: number;

  /**
   * Entry address of the code
   */
  entryAddress?: number;

  /**
   * Entry address of the code to use when exporting it
   */
  exportEntryAddress?: number;

  /**
   * Inject options
   */
  injectOptions: Record<string, boolean>;

  /**
   * The source files involved in this compilation, in
   * their file index order
   */
  readonly sourceFileList: SourceFileItem[];

  /**
   * Source map information that assigns source file info with
   * the address
   */
  readonly sourceMap: Record<number, FileLine>;

  /**
   * Source map information that assigns source file info with the address
   */
  readonly addressMap: Map<FileLine, number[]>;

  /**
   * Items of the list file
   */
  readonly listFileItems: ListFileItem[];

  /**
   * Symbol usage references recorded during compilation.
   */
  readonly symbolReferences: SymbolReferenceInfo[];

  /**
   * Trace outputs
   */
  readonly traceOutput: string[];

  /**
   * ZX Spectrum Next NEX file configuration
   */
  readonly nexConfig?: any;
}

/**
 * Represents a compilation error
 */
export interface AssemblerErrorInfo {
  /**
   * Error code
   */
  readonly errorCode: string;
  /**
   * File in which the error is found
   */
  readonly filename: string;

  /**
   * Error line number
   */
  readonly line: number;

  /**
   * Error start position
   */
  readonly startPosition: number;

  /**
   * Error end position
   */
  readonly endPosition: number | null;

  /**
   * Error start column
   */
  readonly startColumn: number;

  /**
   * Error end column
   */
  readonly endColumn: number | null;

  /**
   * Complete error message
   */
  readonly message: string;

  /**
   * Is it just warning?
   */
  readonly isWarning?: boolean;
}

/**
 * Represents the value of an evaluated expression
 */
type ExpressionValue = {
  /**
   * Gets the type of the expression
   */
  readonly type: ExpressionValueType;

  /**
   * Checks if the value of this expression is valid
   */
  readonly isValid: boolean;

  /**
   * Checks if the value of this expression is not evaluated
   */
  readonly isNonEvaluated: boolean;

  /**
   * Gets the value of this instance
   */
  readonly value: number;
};

/**
 * This enum defines the types of assembly symbols
 */
enum SymbolType {
  None,
  Label,
  Var
}

type AssemblySymbolInfo = {
  /**
   * Symbol name
   */
  readonly name: string;

  /**
   * Symbol type
   */
  readonly type: SymbolType;

  /**
   * Symbol value
   */
  readonly value: ExpressionValue;

  /**
   * Tests if this symbol is a local symbol within a module.
   */
  readonly isModuleLocal: boolean;

  /**
   * Tests if this symbol is a short-term symbol.
   */
  readonly isShortTerm: boolean;

  /**
   * Signs if the object has been used
   */
  readonly isUsed: boolean;

  /** Index of the source file where this symbol is defined. */
  readonly definitionFileIndex?: number;

  /** 1-based line number of the definition. */
  readonly definitionLine?: number;

  /** Inclusive start column of the definition. */
  readonly definitionStartColumn?: number;

  /** Exclusive end column of the definition. */
  readonly definitionEndColumn?: number;
};

/**
 * Defines a section of assembly lines
 */
type DefinitionSection = {
  readonly firstLine: number;
  readonly lastLine: number;
};

/**
 * Defines a field of a structure
 */
type FieldDefinition = {
  readonly offset: number;
  readonly isUsed: boolean;
};

/**
 * Represents a struct
 */
type StructDefinition = {
  readonly structName: string;

  /**
   * Struct definition section
   */
  readonly section: DefinitionSection;

  /**
   * The fields of the structure
   */
  readonly fields: Record<string, FieldDefinition>;

  /**
   * The size of the structure
   */
  readonly size: number;
};

/**
 * Represents the definition of a macro
 */
type MacroDefinition = {
  /**
   * Name of the macro
   */
  readonly macroName: string;

  /**
   * Macro identifier
   */
  readonly argNames: IdentifierNode[];

  /**
   * End label of the macro
   */
  readonly endLabel: string | null;

  /**
   * The section of the macro
   */
  readonly section: DefinitionSection;
};

type IdentifierNode = {
  /**
   * Identifies the node type as an identifier
   */
  readonly type: "Identifier";

  /**
   * Identifier name
   */
  readonly name: string;

  /**
   * The expression source code (used for macro argument replacement)
   */
  readonly sourceText: string;

  /**
   * Start line number of the start token of the node
   */
  readonly line: number;

  /**
   * Start position (inclusive) of the node
   */
  readonly startPosition: number;

  /**
   * End position (exclusive)
   */
  readonly endPosition: number;

  /**
   * Start column number (inclusive) of the node
   */
  readonly startColumn: number;

  /**
   * End column number (exclusive) of the node
   */
  readonly endColumn: number;
};

type SymbolScope = {
  /**
   * Owner of this scope
   */
  readonly ownerScope: SymbolScope | null;

  /**
   * Indicates that this scope is for a loop
   */
  readonly isLoopScope: boolean;

  /**
   * Indicates that this scope is for a proc
   */
  readonly isProcScope: boolean;

  /**
   * The current loop counter in the scope
   */
  readonly loopCounter: number;

  /**
   * Indicates if this is a temporary scope
   */
  readonly isTemporaryScope: boolean;

  /**
   * The symbol table with properly defined symbols
   */
  readonly symbols: Record<string, AssemblySymbolInfo>;

  /**
   * Local symbol bookings
   */
  readonly localSymbolBookings: Set<string>;

  /**
   * Indicates if a break statement has been reached in this scope
   */
  readonly breakReached: boolean;

  /**
   * Indicates if a continue statement has been reached in this scope
   */
  readonly continueReached: boolean;

  /**
   * Optional macro arguments
   */
  macroArguments: Record<string, ExpressionValue> | null;

  /**
   * Tests if this context is a macro context
   */
  readonly isMacroContext: boolean;
};

/**
 * Represents the output of a compiled module
 */
interface CompiledModule {
  /**
   * Parent of this module
   */
  readonly parentModule: CompiledModule | null;

  /**
   * Case sensitive module?
   */
  readonly caseSensitive: boolean;

  /**
   * Points to the root module
   */
  readonly rootModule: CompiledModule;

  /**
   * Child modules
   */
  readonly nestedModules: Record<string, CompiledModule>;

  /**
   * The symbol table with properly defined symbols
   */
  readonly symbols: Record<string, AssemblySymbolInfo>;

  /**
   * The map of structures within the module
   */
  readonly structs: Record<string, StructDefinition>;

  /**
   * The map of macro definitions within the module
   */
  readonly macros: Record<string, MacroDefinition>;

  /**
   * Local symbol scopes
   */
  readonly localScopes: SymbolScope[];
}

/**
 * A single symbol usage recorded during compilation.
 */
export type SymbolReferenceInfo = {
  readonly symbolName: string;
  readonly fileIndex: number;
  readonly line: number;
  readonly startColumn: number;
  readonly endColumn: number;
};

/**
 * Location of a symbol definition.
 */
export type SymbolDefinitionInfo = {
  readonly name: string;
  readonly kind: "label" | "var" | "equ" | "macro" | "struct" | "proc" | "module";
  readonly fileIndex: number;
  readonly line: number;
  readonly startColumn: number;
  readonly endColumn: number;
  /** Computed numeric value, if known. */
  readonly value?: number;
  /** Human-readable value string, e.g. "= $6000". */
  readonly description?: string;
  /** For macros: raw source text of each body line (between .macro and .endm). */
  readonly bodyLines?: readonly string[];
};

/**
 * A node in the document outline (labels, macros, structs, modules, procs).
 */
export type DocumentOutlineEntry = {
  readonly name: string;
  readonly kind: "label" | "var" | "equ" | "macro" | "struct" | "proc" | "module";
  readonly fileIndex: number;
  readonly line: number;
  readonly endLine: number;
  readonly children?: DocumentOutlineEntry[];
};

/**
 * Serialisable subset of compiler output used by language intelligence
 * features (autocomplete, hover, go-to-definition, outline, references).
 * This type is safe to send through IPC (no class instances, no Maps).
 */
export type LanguageIntelData = {
  /** All symbol definitions, including nested modules/procs. */
  readonly symbolDefinitions: SymbolDefinitionInfo[];
  /** All symbol usage references. */
  readonly symbolReferences: SymbolReferenceInfo[];
  /** Per-file document outline (labels, macros, structs, modules, procs). */
  readonly documentOutline: DocumentOutlineEntry[];
  /** Source file index → absolute path mapping. */
  readonly sourceFiles: ReadonlyArray<{ index: number; filename: string }>;
  /** Per-line address and emitted bytes for instructions that emit code. */
  readonly lineInfo: LineIntelInfo[];
};

/**
 * Per-line address and emitted bytes, extracted from the compiler's listFileItems.
 * Used by language intelligence to show address/byte info in hover tooltips.
 */
export type LineIntelInfo = {
  readonly fileIndex: number;
  /** 1-based line number in the source file. */
  readonly lineNumber: number;
  /** Assembled address of the first byte emitted by this line. */
  readonly address: number;
  /** Machine-code bytes emitted by this line. */
  readonly bytes: readonly number[];
};

/**
 * Describes a source file item
 */
type SourceFileItem = {
  /**
   * The name of the source file
   */
  readonly filename: string;

  /**
   * Optional parent item
   */
  parent?: SourceFileItem;

  /**
   * Included files
   */
  readonly includes: SourceFileItem[];
};

/**
 * Represents a file line in the compiled assembler output
 */
export type FileLine = {
  fileIndex: number;
  line: number;
  startColumn?: number;
  endColumn?: number;
};

/**
 * Represents an item in the output list
 */
export type ListFileItem = {
  fileIndex: number;
  address: number;
  lineNumber: number;
  segmentIndex?: number;
  codeStartIndex?: number;
  codeLength?: number;
  sourceText?: string;
  isMacroInvocation?: boolean;
};

/**
 * Identifies the kind of a source-level statement.
 * Language-agnostic: covers common constructs in procedural and
 * object-oriented languages (Pascal, C, C++, BASIC, etc.).
 * Compilers may use "other" for language constructs not listed here.
 */
export type StatementKind =
  | "assignment"   // variable = expr  /  x := expr  /  LET x = expr
  | "call"         // standalone subroutine / procedure call
  | "if"           // conditional branch
  | "loop"         // while, for, repeat-until, do-while, NEXT, WEND, …
  | "switch"       // case-of, switch-case, ON-GOTO, …
  | "return"       // return, exit, function-result assignment
  | "jump"         // goto, break, continue
  | "compound"     // begin..end, { }, block
  | "declaration"  // variable / constant declaration with an initialiser
  | "asm"          // inline assembly block
  | "other";

/**
 * Identifies the kind of a callable unit.
 * Language-agnostic: covers common callable constructs across languages.
 */
export type CallableKind =
  | "entrypoint"   // main program body / module initialisation
  | "subroutine"   // procedure, void function, SUB — no return value
  | "function"     // function returning a value
  | "method"       // OOP instance or class method
  | "constructor"  // OOP constructor
  | "destructor"   // OOP destructor
  | "lambda";      // anonymous function / closure

/**
 * A source file entry within a SourceLevelDebugInfo structure.
 */
export type SourceFileEntry = {
  /** Position in the files array — used as a fileIndex key everywhere else. */
  readonly index: number;
  /** Absolute path to the source file. */
  readonly filename: string;
};

/**
 * Describes a single source-level statement — the atomic unit of
 * source-level stepping. One debugger "step" moves from one statement
 * to the next.
 *
 * A statement may span multiple source lines or share a source line
 * with other statements. The precise column range is always recorded
 * so the IDE can highlight exactly the active statement.
 */
export type StatementDebugInfo = {
  /** Unique index (position in the SourceLevelDebugInfo.statements array). */
  readonly index: number;
  /** Source file index. */
  readonly fileIndex: number;
  /** 1-based line number where the statement starts. */
  readonly startLine: number;
  /** 0-based column where the statement starts (inclusive). */
  readonly startColumn: number;
  /** 1-based line number where the statement ends. */
  readonly endLine: number;
  /** 0-based column where the statement ends (exclusive). */
  readonly endColumn: number;
  /** Z80 address of the first machine-code byte emitted for this statement. */
  readonly startAddress: number;
  /** Z80 address one past the last machine-code byte for this statement. */
  readonly endAddress: number;
  /**
   * Memory partition (bank) in which this statement's code resides.
   * Uses the same partition numbering as the Klive emulator's getPartition():
   * negative values are ROM pages, non-negative values are RAM banks.
   * Absent (undefined) means the code is in the flat / unbanked address space.
   */
  readonly partition?: number;
  /**
   * Indices (into SourceLevelDebugInfo.callables) of any user-defined
   * callables invoked by this statement. Absent or empty means no calls
   * to user-defined callables; built-in / runtime calls are not tracked here.
   */
  readonly callTargets?: readonly number[];
  /** Semantic kind of the statement. */
  readonly kind: StatementKind;
  /** Index of the callable that contains this statement. */
  readonly callableIndex: number;
};

/**
 * Describes a callable unit: a subroutine, function, method, or the
 * program entry point. Used for source-level Step-Over and Step-Out.
 */
export type CallableDebugInfo = {
  /** Unique index (position in the SourceLevelDebugInfo.callables array). */
  readonly index: number;
  /** Display name shown in the call stack (e.g. "main", "Factorial"). */
  readonly name: string;
  /** Kind of callable. */
  readonly kind: CallableKind;
  /** Source file index where this callable is defined. */
  readonly fileIndex: number;
  /** 1-based line of the callable's declaration / header. */
  readonly startLine: number;
  /** 1-based line of the callable's closing delimiter. */
  readonly endLine: number;
  /**
   * Z80 address of the callable's entry point (first instruction of the
   * body, after any prologue / stack-frame setup).
   */
  readonly entryAddress: number;
  /**
   * Z80 addresses of every instruction that exits this callable
   * (RET, JP to a shared epilogue, etc.). Used by source-level Step-Out.
   */
  readonly exitAddresses: readonly number[];
  /**
   * Memory partition (bank) in which this callable's code resides.
   * Uses the same partition numbering as the Klive emulator's getPartition().
   * Absent (undefined) means the code is in the flat / unbanked address space.
   */
  readonly partition?: number;
  /** Index of the first statement in this callable's body. */
  readonly firstStatementIndex: number;
  /** Index of the last statement in this callable's body (inclusive). */
  readonly lastStatementIndex: number;
  /**
   * Index of the enclosing callable for nested routines.
   * Absent for top-level callables and the entry point.
   */
  readonly parentCallableIndex?: number;
};

/**
 * Complete source-level debug information produced by a high-level
 * language compiler. This is an optional extension to DebuggableOutput.
 * When present, the IDE offers source-level stepping (one statement at a
 * time) in addition to Z80-instruction-level stepping.
 *
 * Designed to be language-agnostic: covers Pascal, C, C++, BASIC, and
 * other procedural / object-oriented languages compiled to Z80.
 *
 * The entire structure must be JSON-serialisable (no Maps, Sets, or class
 * instances) so it can be stored alongside the binary and sent over IPC.
 */
export type SourceLevelDebugInfo = {
  /**
   * Optional source-language identifier (e.g. "pascal", "c", "basic").
   * Used for language-specific UI hints; not required for core debugging.
   */
  readonly language?: string;
  /**
   * Ordered list of source files. Each entry's index is its fileIndex
   * used throughout the rest of this structure.
   */
  readonly files: SourceFileEntry[];
  /**
   * All statements in the compiled program, in ascending startAddress order.
   */
  readonly statements: StatementDebugInfo[];
  /**
   * All callable units (subroutines, functions, the entry point, etc.).
   */
  readonly callables: CallableDebugInfo[];
  /**
   * When false or absent, the compiled code lives entirely in the flat 64 KB
   * Z80 address space and addressToStatement is the authoritative lookup.
   * When true, the code spans multiple memory banks / pages; use
   * partitionedAddressMap for lookups instead.
   */
  readonly usesBanking?: boolean;
  /**
   * Flat address-range → statement-index map (non-banked code).
   * An array of [address, statementIndex] pairs, in ascending address order.
   * Each pair covers the range [address, nextPair.address).
   * statementIndex = -1 denotes compiler-generated runtime / glue code
   * with no corresponding source statement; the debugger skips these ranges.
   * Ignored when usesBanking is true — use partitionedAddressMap instead.
   */
  readonly addressToStatement: ReadonlyArray<[number, number]>;
  /**
   * Partition-qualified address-range → statement-index map (banked code).
   * Present and authoritative when usesBanking is true.
   * Each entry covers one memory partition (bank). The partition value uses
   * the same numbering as the Klive emulator's getPartition(): negative
   * values are ROM pages, non-negative values are RAM banks.
   * Within each entry, addressToStatement is sorted in ascending address
   * order and follows the same sentinel convention (-1 = glue code).
   */
  readonly partitionedAddressMap?: ReadonlyArray<{
    readonly partition: number;
    readonly addressToStatement: ReadonlyArray<[number, number]>;
  }>;
};

/**
 * Any compiler should be able to retrieve simple error information
 */
export type SimpleAssemblerOutput = {
  failed?: string;
  errors?: AssemblerErrorInfo[];
  debugMessages?: string[];
  traceOutput?: string[];
};

/**
 * Represents a compiler that can generate injectable code
 */
export type InjectableOutput = SimpleAssemblerOutput & {
  readonly segments: BinarySegment[];
  injectOptions: Record<string, boolean>;
  sourceType?: string;
};

export type DebuggableOutput = InjectableOutput & {
  /**
   * The source files involved in this compilation, in
   * their file index order
   */
  readonly sourceFileList: ISourceFileItem[];

  /**
   * Source map information that assigns source file info with
   * the address
   */
  readonly sourceMap: Record<number, FileLine>;

  /**
   * Items of the list file
   */
  readonly listFileItems: ListFileItem[];

  /**
   * Optional source-level debug information. When present the IDE can
   * offer source-code-level stepping (one statement at a time) in addition
   * to Z80-instruction-level stepping.
   */
  readonly sourceLevelDebug?: SourceLevelDebugInfo;
};

/**
 * Output of a Klive compiler
 */
export type KliveCompilerOutput =
  | SimpleAssemblerOutput
  | InjectableOutput
  | DebuggableOutput
  | CompilerOutput;

/**
 * Defines the responsibilities of a compiler that can vork directly with a build root
 */
export interface IKliveCompiler {
  /**
   * The unique ID of the compiler
   */
  readonly id: string;

  /**
   * Compiled language
   */
  readonly language: string;

  /**
   * Indicates if the compiler supports Klive compiler output
   */
  readonly providesKliveOutput: boolean;

  /**
   * Compiles the Z80 Assembly code in the specified file into Z80
   * binary code.
   * @param filename Z80 assembly source file (absolute path)
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  compileFile(filename: string, options?: Record<string, any>): Promise<KliveCompilerOutput>;

  /**
   * Checks if the specified file can have a breakpoint
   * @param line The line content to check
   */
  lineCanHaveBreakpoint(line: string): Promise<boolean>;

  /**
   * Optionally forwards the current state to the compiler
   * @param state State to forward to the compiler
   */
  setAppState?: (state: AppState) => void;
}
