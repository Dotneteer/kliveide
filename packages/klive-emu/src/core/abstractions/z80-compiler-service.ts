import { AssemblerOptions, AssemblerOutput } from "@assembler/assembler-in-out";
import { NoParamCallback } from "original-fs";
import { ErrorCodes } from "./z80-assembler-errors";
import {
  Expression,
  NodePosition,
  Z80AssemblyLine,
} from "./z80-assembler-tree-nodes";

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
export interface IValueInfo {
  /**
   * The value of the symbol
   */
  value: IExpressionValue;

  /**
   * Symbol usage information
   */
  usageInfo: IHasUsageInfo;
}

/**
 * Represents the context in which an expression is evaluated
 */
export interface IEvaluationContext {
  /**
   * Gets the source line the evaluation context is bound to
   */
  getSourceLine(): Z80AssemblyLine;

  /**
   * Sets the source line the evaluation context is bound to
   * @param sourceLine Source line information
   */
  setSourceLine(sourceLine: Z80AssemblyLine): void;

  /**
   * Gets the current assembly address
   */
  getCurrentAddress(): number;

  /**
   * Gets the value of the specified symbol
   * @param symbol Symbol name
   * @param startFromGlobal Should resolution start from global scope?
   */
  getSymbolValue(symbol: string, startFromGlobal?: boolean): IValueInfo | null;

  /**
   * Gets the current loop counter value
   */
  getLoopCounterValue(): IExpressionValue;

  /**
   * Evaluates the value if the specified expression node
   * @param expr Expression to evaluate
   * @param context: Evaluation context
   */
  doEvalExpression(expr: Expression): IExpressionValue;

  /**
   * Reports an error during evaluation
   * @param code Error code
   * @param node Error position
   * @param parameters Optional error parameters
   */
  reportEvaluationError(
    code: ErrorCodes,
    node: NodePosition,
    ...parameters: any[]
  ): void;
}

/**
 * A single segment of the code compilation
 */
export interface IBinarySegment {
  /**
   * The bank of the segment
   */
  bank?: number;

  /**
   * Start offset used for banks
   */
  bankOffset: number;

  /**
   * Maximum code length of this segment
   */
  maxCodeLength: number;

  /**
   * Start address of the compiled block
   */
  startAddress: number;

  /**
   * Optional displacement of this segment
   */
  displacement?: number;

  /**
   * The current assembly address when the .disp pragma was used
   */
  dispPragmaOffset?: number;

  /**
   * Intel hex start address of this segment
   */
  xorgValue?: number;

  /**
   * Emitted Z80 binary code
   */
  emittedCode: number[];

  /**
   * Signs if segment overflow has been detected
   */
  overflowDetected: boolean;

  /**
   * Shows the offset of the instruction being compiled
   */
  currentInstructionOffset?: number;

  /**
   * The current code generation offset
   */
  readonly currentOffset: number;

  /**
   * Emits the specified byte to the segment
   * @param data Byte to emit
   * @returns Null, if byte emitted; otherwise, error message
   */
  emitByte(data: number): ErrorCodes | null;
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
 * Describes a source file item
 */
export interface ISourceFileItem {
  /**
   * The name of the source file
   */
  readonly filename: string;

  /**
   * Optional parent item
   */
  parent?: ISourceFileItem;

  /**
   * Included files
   */
  readonly includes: ISourceFileItem[];

  /**
   * Adds the specified item to the "includes" list
   * @param childItem Included source file item
   * @returns True, if including the child item is OK;
   * False, if the inclusion would create a circular reference,
   * or the child is already is in the list
   */
  include(childItem: ISourceFileItem): boolean;

  /**
   * Checks if this item already contains the specified child item in
   * its "includes" list
   * @param childItem Child item to check
   * @returns True, if this item contains the child item; otherwise, false
   */
  containsInIncludeList(childItem: ISourceFileItem): boolean;
}

/**
 * Represents a file line in the compiled assembler output
 */
export interface IFileLine {
  fileIndex: number;
  line: number;
}

/**
 * This type represents a source map
 */
export type SourceMap = Record<number, IFileLine>;

/**
 * Represents a compilation error
 */
export interface IAssemblerErrorInfo {
  readonly errorCode: ErrorCodes;
  readonly fileName: string;
  readonly line: number;
  readonly startPosition: number;
  readonly endPosition: number | null;
  readonly message: string;
  readonly isWarning?: boolean;
}

/**
 * Represents an item in the output list
 */
export interface IListFileItem {
  fileIndex: number;
  address: number;
  segmentIndex: number;
  codeStartIndex: number;
  codeLength: number;
  lineNumber: number;
  sourceText: string;
}

/**
 * This enum defines the types of assembly symbols
 */
export enum SymbolType {
  None,
  Label,
  Var,
}

/**
 * This class represents an assembly symbol
 */
export interface IAssemblySymbolInfo extends IHasUsageInfo {
  readonly name: string;
  readonly type: SymbolType;
  value: IExpressionValue;

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
  isUsed: boolean;
}

/**
 * Type of the fixup
 */
export enum FixupType {
  Jr,
  Bit8,
  Bit16,
  Bit16Be,
  Equ,
  Ent,
  Xent,
  Struct,
  FieldBit8,
  FieldBit16,
}

/**
 * Defines a section of assembly lines
 */
export type DefinitionSection = {
  readonly firstLine: number;
  readonly lastLine: number;
};
