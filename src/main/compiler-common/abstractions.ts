import { ExpressionValueType } from "@abstractions/CompilerInfo";

/**
 * Describes the structure of error messages
 */
export interface ParserErrorMessage<T> {
  code: T;
  text: string;
  position: number;
  line: number;
  column: number;
}

/**
 * This enum defines the types of assembly symbols
 */
export enum SymbolType {
  None,
  Label,
  Var
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
}
