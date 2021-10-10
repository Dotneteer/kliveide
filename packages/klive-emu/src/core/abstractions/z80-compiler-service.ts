import { AssemblerOptions, AssemblerOutput } from "@assembler/assembler-in-out";

// ----------------------------------------------------------------------------
// Messages for communication with the Z80 assembler worker

/**
 * Definition of base compiler messages including requests and responses
 */
export interface CompilerMessageBase {
  type: CompilerMessage["type"];
  correlationId?: number;
}

/**
 * Ask the compiler to compile a source file
 */
export interface CompileFileMessage extends CompilerMessageBase {
  type: "CompileFile";
  filename: string;
  options?: AssemblerOptions;
}

/**
 * Ask the compiler to compile the specified source text
 */
export interface CompileSourceMessage extends CompilerMessageBase {
  type: "Compile";
  sourceText: string;
  options?: AssemblerOptions;
}

/**
 * All compiler requests
 */
export type CompilerRequestMessage = CompileFileMessage | CompileSourceMessage;

/**
 * Result of the assembler call
 */
export interface AssemblerOutputResponse extends CompilerMessageBase {
  type: "CompileResult";
  result: AssemblerOutput;
}

/**
 * All compiler responses
 */
export type CompilerResponseMessage = AssemblerOutputResponse;

/**
 * Defines the messages the compiler accepts
 */
export type CompilerMessage = CompilerRequestMessage | CompilerResponseMessage;

// ----------------------------------------------------------------------------
// The compiler service and related DTO types
/**
 * This interface defines the operations of the Z80 Compiler service
 */
export interface IZ80CompilerService {
  /**
   * Compiles the Z80 Assembly code in the specified file into Z80
   * binary code.
   * @param filename Z80 assembly source file (absolute path)
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  compileFile(
    filename: string,
    options?: CompilerOptions
  ): Promise<AssemblerOutput>;

  /**
   * Compiles the passed Z80 Assembly code into Z80 binary code.
   * binary code.
   * @param sourceText Z80 assembly source code text
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  compile(
    sourceText: string,
    options?: CompilerOptions
  ): Promise<AssemblerOutput>;
}

/**
 * The type of the Spectrum model
 */
 export enum SpectrumModelType {
  Spectrum48,
  Spectrum128,
  SpectrumP3,
  Next,
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
  NonEvaluated,
}

/**
 * Represents the value of an evaluated expression
 */
 export interface IExpressionValue {
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
 }

/**
 * Map of symbols
 */
export type SymbolValueMap = Record<string, IExpressionValue>;

/**
 * Represents the input options of the Klive Z80 Compiler
 */
export type CompilerOptions = {
  /**
   * Predefined compilation symbols
   */
  predefinedSymbols: SymbolValueMap;

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
   * Signs that PROC labels and symbols are not locals by default
   */
  procExplicitLocalsOnly: boolean;

  /**
   * Indicates that assembly symbols should be case sensitively.
   */
  useCaseSensitiveSymbols: boolean;

  /**
   * Allows flexible use of DEFx pragmas
   */
  flexibleDefPragmas: boolean;
};
