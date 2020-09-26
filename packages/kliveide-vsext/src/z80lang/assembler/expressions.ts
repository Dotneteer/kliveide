import { HasUsageInfo } from "./assembler-types";

/**
 * Represents the value of an evaluated expression
 */
export class ExpressionValue {
  constructor() {}

  // TODO: Implement this class
  static fromNumber(value: number): ExpressionValue {
    
    return new ExpressionValue();
  }
}

/**
 * Information about a symbol's value
 */
export interface ValueInfo {
  /**
   * The value of the symbol
   */
  value: ExpressionValue;

  /**
   * Symbol usage information
   */
  usageInfo: HasUsageInfo;
}

/**
 * Represents the context in which an expression is evaluated
 */
export interface EvaluationContext {
  /**
   * Gets the current assembly address
   */
  getCurrentAddress(): number;

  /**
   * Gets the value of the specified symbol
   * @param symbol Symbol name
   * @param startFromGlobal Should resolution start from global scope?
   */
  getSymbolValue(symbol: string, startFromGlobal?: boolean): ValueInfo | null;

  /**
   * Gets the current loop counter value
   */
  getLoopCounterValue(): ExpressionValue;
}