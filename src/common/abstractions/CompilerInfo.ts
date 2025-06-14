import { AppState } from "@common/state/AppState";
import { ISourceFileItem } from "@main/z80-compiler/assembler-types";

/**
 * The type of the Spectrum model
 */
export enum SpectrumModelType {
  Spectrum48,
  Spectrum128,
  SpectrumP3,
  Next
}

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
  currentModel: SpectrumModelType;

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
  modelType?: SpectrumModelType;

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
   * Trace outputs
   */
  readonly traceOutput: string[];
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
