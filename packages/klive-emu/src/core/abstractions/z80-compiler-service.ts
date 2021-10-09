import { AssemblerOptions, AssemblerOutput } from "@assembler/assembler-in-out";

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
    options?: AssemblerOptions
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
    options?: AssemblerOptions
  ): Promise<AssemblerOutput>;
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

  /**
   * Returns the value as a long integer
   */
  asLong(): number;

  /**
   * Returns the value as a real number
   */
  asReal(): number;

  /**
   * Returns the value as a string
   */
  asString(): string;

  /**
   * Returns the value as a Boolean
   */
  asBool(): boolean;

  /**
   * Returns the value as a 16-bit unsigned integer
   */
  asWord(): number;

  /**
   * Returns the value as an 8-bit unsigned integer
   */
  asByte(): number;
}

/**
 * Map of symbols
 */
export type SymbolValueMap = Record<string, IExpressionValue>;

/**
 * Objects implementing this interface have usage information
 */
export interface IHasUsageInfo {
  /**
   * Signs if the object has been used
   */
  isUsed: boolean;
}

/**
 * Information about a symbol's value
 */
 export interface ValueInfo {
  /**
   * The value of the symbol
   */
  value: IExpressionValue;

  /**
   * Symbol usage information
   */
  usageInfo: IHasUsageInfo;
}
