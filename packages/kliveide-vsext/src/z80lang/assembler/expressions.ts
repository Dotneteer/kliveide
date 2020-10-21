import { ErrorCodes } from "../errors";
import {
  BinaryExpression,
  BooleanLiteral,
  MacroTimeFunctionInvocation,
  ConditionalExpression,
  Expression,
  FunctionInvocation,
  IdentifierNode,
  NodePosition,
  OperandType,
  PartialZ80AssemblyLine,
  Symbol,
  UnaryExpression,
  Z80AssemblyLine,
} from "../parser/tree-nodes";
import { HasUsageInfo } from "./assembler-types";

// --- Evaluation error messages
const STRING_CONVERSION_ERROR = "Cannot convert string to a number";
const DIV_BY_ZERO_ERROR = "Divide by zero error";
const ADD_ERROR = "Cannot add an integral value and a string";
const ADD_STRING_ERROR = "Only a string can be added to a string";
const COMPARE_ERROR = "Cannot compare a number with a string";
const COMPARE_STRING_ERROR = "String can be compared only to another string";

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
export class ExpressionValue {
  private _type: ExpressionValueType;
  private _value: boolean | number | string | undefined;

  /**
   * Used in case of expression evaluation errors
   */
  static Error = new ExpressionValue();

  /**
   * Represents a non-evaluated value
   */
  static NonEvaluated = new ExpressionValue(ExpressionValueType.NonEvaluated);

  /**
   * Initializes a value expression
   * @param value Value to initialize
   */
  constructor(value?: ExpressionValueType | boolean | number | string) {
    if (value === undefined) {
      this._type = ExpressionValueType.Error;
      return;
    }
    switch (typeof value) {
      case "boolean":
        this._type = ExpressionValueType.Bool;
        break;
      case "number":
        this._type = Number.isInteger(value)
          ? ExpressionValueType.Integer
          : ExpressionValueType.Real;
        break;
      case "string":
        this._type = ExpressionValueType.String;
        break;
    }
    this._value = value;
  }

  /**
   * Gets the type of the expression
   */
  get type(): ExpressionValueType {
    return this._type;
  }

  /**
   * Checks if the value of this expression is valid
   */
  get isValid(): boolean {
    return (
      this !== ExpressionValue.NonEvaluated && this !== ExpressionValue.Error
    );
  }

  /**
   * Checks if the value of this expression is not evaluated
   */
  get isNonEvaluated(): boolean {
    return this === ExpressionValue.NonEvaluated;
  }

  /**
   * Gets the value of this instance
   */
  get value(): number {
    return this.asWord();
  }

  /**
   * Returns the value as a long integer
   */
  asLong(): number {
    switch (this.type) {
      case ExpressionValueType.Bool:
        return this._value ? 1 : 0;
      case ExpressionValueType.Integer:
        return this._value as number;
      case ExpressionValueType.Real:
        return Math.floor(this._value as number);
      case ExpressionValueType.String:
        const parsedValue = parseInt(this._value as string);
        if (isNaN(parsedValue)) {
          throw new Error("Cannot convert string to an integer value.");
        } else {
          return parsedValue;
        }
      default:
        throw new Error("Unexpected expression value");
    }
  }

  /**
   * Returns the value as a real number
   */
  asReal(): number {
    switch (this.type) {
      case ExpressionValueType.Bool:
        return this._value ? 1 : 0;
      case ExpressionValueType.Integer:
      case ExpressionValueType.Real:
        return this._value as number;
      case ExpressionValueType.String:
        const parsedValue = parseFloat(this._value as string);
        if (isNaN(parsedValue)) {
          throw new Error("Cannot convert string to a real value.");
        } else {
          return parsedValue;
        }
      default:
        throw new Error("Unexpected expression value");
    }
  }

  /**
   * Returns the value as a string
   */
  asString(): string {
    switch (this.type) {
      case ExpressionValueType.Bool:
        return this._value ? "true" : "false";
      case ExpressionValueType.Integer:
      case ExpressionValueType.Real:
        return (this._value as number).toString();
      case ExpressionValueType.String:
        return this._value as string;
      default:
        throw new Error("Unexpected expression value");
    }
  }

  /**
   * Returns the value as a Boolean
   */
  asBool(): boolean {
    switch (this.type) {
      case ExpressionValueType.Bool:
      case ExpressionValueType.Integer:
      case ExpressionValueType.Real:
        return !!this._value;
      case ExpressionValueType.String:
        return (this._value as string).trim() !== "";
      default:
        throw new Error("Unexpected expression value");
    }
  }

  /**
   * Returns the value as a 16-bit unsigned integer
   */
  asWord(): number {
    return this.asLong() & 0xffff;
  }

  /**
   * Returns the value as an 8-bit unsigned integer
   */
  asByte(): number {
    return this.asLong() & 0xff;
  }
}

/**
 * Map of symbols
 */
export type SymbolValueMap = { [key: string]: ExpressionValue };

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
  getSymbolValue(symbol: string, startFromGlobal?: boolean): ValueInfo | null;

  /**
   * Gets the current loop counter value
   */
  getLoopCounterValue(): ExpressionValue;

  /**
   * Evaluates the value if the specified expression node
   * @param expr Expression to evaluate
   * @param context: Evaluation context
   */
  doEvalExpression(expr: Expression): ExpressionValue;

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
 * Base class that evaluates an expression in a specific contents
 */
export abstract class ExpressionEvaluator implements EvaluationContext {
  /**
   * Gets the source line the evaluation context is bound to
   */
  abstract getSourceLine(): Z80AssemblyLine;

  /**
   * Sets the source line the evaluation context is bound to
   * @param sourceLine Source line information
   */
  abstract setSourceLine(sourceLine: Z80AssemblyLine): void;

  /**
   * Gets the current assembly address
   */
  abstract getCurrentAddress(): number;

  /**
   * Gets the value of the specified symbol
   * @param symbol Symbol name
   * @param startFromGlobal Should resolution start from global scope?
   */
  abstract getSymbolValue(
    symbol: string,
    startFromGlobal?: boolean
  ): ValueInfo | null;

  /**
   * Gets the current loop counter value
   */
  abstract getLoopCounterValue(): ExpressionValue;

  /**
   * Evaluates the value if the specified expression node
   * @param expr Expression to evaluate
   * @param context: Evaluation context
   */
  /**
   * Evaluates the value if the specified expression node
   * @param context The context to evaluate the expression
   * @param expr Expression to evaluate
   */
  doEvalExpression(expr: Expression): ExpressionValue {
    try {
      switch (expr.type) {
        case "Identifier":
          return evalIdentifierValue(this, expr);
        case "Symbol":
          return evalSymbolValue(this, expr);
        case "IntegerLiteral":
        case "RealLiteral":
        case "CharLiteral":
        case "StringLiteral":
        case "BooleanLiteral":
          return new ExpressionValue(expr.value);
        case "BinaryExpression":
          return evalBinaryOperationValue(this, expr);
        case "UnaryExpression":
          return evalUnaryOperationValue(this, expr);
        case "ConditionalExpression":
          return evalConditionalOperationValue(this, expr);
        case "CurrentAddressLiteral":
          return new ExpressionValue(this.getCurrentAddress());
        case "CurrentCounterLiteral":
          return this.getLoopCounterValue();
        case "MacroTimeFunctionInvocation":
          return evalMacroTimeFunctionInvocationValue(this, expr);
        case "FunctionInvocation":
          return evalFunctionInvocationValue(this, expr);
        default:
          return ExpressionValue.Error;
      }
    } catch (err) {
      this.reportEvaluationError("Z3001", null, (err as Error).message);
      return ExpressionValue.Error;
    }

    /**
     * Evaluate the value of an identifier
     * @param context Evaluation context
     * @param expr Expression to evaluate
     */
    function evalIdentifierValue(
      context: EvaluationContext,
      expr: IdentifierNode
    ): ExpressionValue {
      var valueInfo = context.getSymbolValue(expr.name);
      if (valueInfo !== null) {
        if (valueInfo.usageInfo !== null) {
          valueInfo.usageInfo.isUsed = true;
        }
        return valueInfo.value;
      }
      context.reportEvaluationError("Z3000", expr, expr.name);
      return ExpressionValue.NonEvaluated;
    }

    /**
     * Evaluate the value of a symbol
     * @param context Evaluation context
     * @param expr Expression to evaluate
     */
    function evalSymbolValue(
      context: EvaluationContext,
      expr: Symbol
    ): ExpressionValue {
      var valueInfo = context.getSymbolValue(
        expr.identifier.name,
        expr.startsFromGlobal
      );
      if (valueInfo !== null) {
        if (valueInfo.usageInfo !== null) {
          valueInfo.usageInfo.isUsed = true;
        }
        return valueInfo.value;
      }
      context.reportEvaluationError(
        "Z3000",
        expr.identifier,
        expr.identifier.name
      );
      return ExpressionValue.NonEvaluated;
    }

    /**
     * Evaluates a binary operation
     * @param context Evaluation context
     * @param expr Bynary expression
     * @returns The value of the evaluated expression
     */
    function evalBinaryOperationValue(
      context: EvaluationContext,
      expr: BinaryExpression
    ): ExpressionValue {
      const left = context.doEvalExpression(expr.left);
      const right = context.doEvalExpression(expr.right);
      if (!left.isValid || !right.isValid) {
        return ExpressionValue.NonEvaluated;
      }
      switch (expr.operator) {
        case "<?":
          switch (right.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              const rightNum = right.asLong();
              switch (left.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(
                    left.asLong() < rightNum ? left.asLong() : rightNum
                  );
                case ExpressionValueType.Real:
                  return new ExpressionValue(
                    left.asReal() < rightNum ? left.asReal() : rightNum
                  );
                case ExpressionValueType.String:
                  throwStringError("left", expr.operator);
                  return ExpressionValue.Error;
              }
            case ExpressionValueType.Real:
              const rightReal = right.asReal();
              switch (left.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(
                    left.asLong() < rightReal ? left.asLong() : rightReal
                  );
                case ExpressionValueType.Real:
                  return new ExpressionValue(
                    left.asReal() < rightReal ? left.asReal() : rightReal
                  );
                case ExpressionValueType.String:
                  throwStringError("left", expr.operator);
                  return ExpressionValue.Error;
              }
            case ExpressionValueType.String:
              throwStringError("right", expr.operator);
              return ExpressionValue.Error;
          }
          break;

        case ">?":
          switch (right.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              const rightNum = right.asLong();
              switch (left.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(
                    left.asLong() > rightNum ? left.asLong() : rightNum
                  );
                case ExpressionValueType.Real:
                  return new ExpressionValue(
                    left.asReal() > rightNum ? left.asReal() : rightNum
                  );
                case ExpressionValueType.String:
                  throwStringError("left", expr.operator);
                  return ExpressionValue.Error;
              }

            case ExpressionValueType.Real:
              const rightReal = right.asReal();
              switch (left.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(
                    left.asLong() > rightReal ? left.asLong() : rightReal
                  );
                case ExpressionValueType.Real:
                  return new ExpressionValue(
                    left.asReal() > rightReal ? left.asReal() : rightReal
                  );
                case ExpressionValueType.String:
                  throwStringError("left", expr.operator);
                  return ExpressionValue.Error;
              }

            case ExpressionValueType.String:
              throwStringError("right", expr.operator);
              return ExpressionValue.Error;
          }
          break;

        case "*":
          switch (right.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              var rightNum = right.asLong();
              switch (left.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(left.asLong() * rightNum);
                case ExpressionValueType.Real:
                  return new ExpressionValue(left.asReal() * rightNum);
                case ExpressionValueType.String:
                  throwStringError("left", expr.operator);
                  return ExpressionValue.Error;
              }

            case ExpressionValueType.Real:
              var rightReal = right.asReal();
              switch (left.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(left.asLong() * rightReal);
                case ExpressionValueType.Real:
                  return new ExpressionValue(left.asReal() * rightReal);
                case ExpressionValueType.String:
                  throwStringError("left", expr.operator);
                  return ExpressionValue.Error;
              }

            case ExpressionValueType.String:
              throwStringError("right", expr.operator);
              return ExpressionValue.Error;
          }
          break;

        case "/":
          switch (right.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              var rightNum = right.asLong();
              if (rightNum === 0) {
                throw new Error(DIV_BY_ZERO_ERROR);
              }
              switch (left.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(left.asLong() / rightNum);
                case ExpressionValueType.Real:
                  return new ExpressionValue(left.asReal() / rightNum);
                case ExpressionValueType.String:
                  throwStringError("left", expr.operator);
                  return ExpressionValue.Error;
              }

            case ExpressionValueType.Real:
              var rightReal = right.asReal();
              if (Math.abs(rightReal) < Number.EPSILON) {
                throw new Error(DIV_BY_ZERO_ERROR);
              }
              switch (left.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(left.asLong() / rightReal);
                case ExpressionValueType.Real:
                  return new ExpressionValue(left.asReal() / rightReal);
                case ExpressionValueType.String:
                  throwStringError("left", expr.operator);
                  return ExpressionValue.Error;
              }

            case ExpressionValueType.String:
              throwStringError("right", expr.operator);
              return ExpressionValue.Error;
          }
          break;

        case "%":
          switch (right.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              var rightNum = right.asLong();
              if (rightNum === 0) {
                throw new Error(DIV_BY_ZERO_ERROR);
              }
              switch (left.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(left.asLong() % rightNum);
                case ExpressionValueType.Real:
                case ExpressionValueType.String:
                  throwStringError("left", expr.operator);
                  return ExpressionValue.Error;
              }

            case ExpressionValueType.Real:
            case ExpressionValueType.String:
              throwStringError("right", expr.operator);
              return ExpressionValue.Error;
          }
          break;

        case "+":
          switch (left.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              var leftNum = left.asLong();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftNum + right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftNum + right.asReal());
                case ExpressionValueType.String:
                  throw new Error(ADD_ERROR);
              }

            case ExpressionValueType.Real:
              var leftReal = left.asReal();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftReal + right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftReal + right.asReal());
                case ExpressionValueType.String:
                  throw new Error(ADD_ERROR);
              }

            case ExpressionValueType.String:
              if (right.type === ExpressionValueType.String) {
                return new ExpressionValue(
                  `${left.asString()}${right.asString()}`
                );
              } else {
                throw new Error(ADD_STRING_ERROR);
              }
          }
          break;

        case "-":
          switch (left.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              var leftNum = left.asLong();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftNum - right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftNum - right.asReal());
                case ExpressionValueType.String:
                  throwStringError("right", expr.operator);
                  return ExpressionValue.Error;
              }

            case ExpressionValueType.Real:
              var leftReal = left.asReal();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftReal - right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftReal - right.asReal());
                case ExpressionValueType.String:
                  throwStringError("right", expr.operator);
                  return ExpressionValue.Error;
              }

            case ExpressionValueType.String:
              throwStringError("left", expr.operator);
              return ExpressionValue.Error;
          }

          break;
        case "<<":
          if (
            left.type !== ExpressionValueType.Bool &&
            left.type !== ExpressionValueType.Integer
          ) {
            throwStringError("left", expr.operator);
            return ExpressionValue.Error;
          }
          if (
            right.type !== ExpressionValueType.Bool &&
            right.type !== ExpressionValueType.Integer
          ) {
            throwIntegralError("right", expr.operator);
            return ExpressionValue.Error;
          }
          return new ExpressionValue(
            left.asLong() << (right.asLong() & 0xffff)
          );

        case ">>":
          if (
            left.type !== ExpressionValueType.Bool &&
            left.type !== ExpressionValueType.Integer
          ) {
            throwIntegralError("left", expr.operator);
            return ExpressionValue.Error;
          }
          if (
            right.type !== ExpressionValueType.Bool &&
            right.type !== ExpressionValueType.Integer
          ) {
            throwIntegralError("right", expr.operator);
            return ExpressionValue.Error;
          }
          return new ExpressionValue(
            left.asLong() >> (right.asLong() & 0xffff)
          );

        case "<":
          switch (left.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              var leftNum = left.asLong();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftNum < right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftNum < right.asReal());
                case ExpressionValueType.String:
                  throw new Error(COMPARE_ERROR);
              }

            case ExpressionValueType.Real:
              var leftReal = left.asReal();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftReal < right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftReal < right.asReal());
                case ExpressionValueType.String:
                  throw new Error(COMPARE_ERROR);
              }

            case ExpressionValueType.String:
              if (right.type === ExpressionValueType.String) {
                return new ExpressionValue(left.asString() < right.asString());
              }
              throw new Error(COMPARE_STRING_ERROR);
          }
          break;

        case "<=":
          switch (left.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              var leftNum = left.asLong();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftNum <= right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftNum <= right.asReal());
                case ExpressionValueType.String:
                  throw new Error(COMPARE_ERROR);
              }

            case ExpressionValueType.Real:
              var leftReal = left.asReal();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftReal <= right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftReal <= right.asReal());
                case ExpressionValueType.String:
                  throw new Error(COMPARE_ERROR);
              }

            case ExpressionValueType.String:
              if (right.type === ExpressionValueType.String) {
                return new ExpressionValue(left.asString() <= right.asString());
              }
              throw new Error(COMPARE_STRING_ERROR);
          }
          break;

        case ">":
          switch (left.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              var leftNum = left.asLong();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftNum > right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftNum > right.asReal());
                case ExpressionValueType.String:
                  throw new Error(COMPARE_ERROR);
              }

            case ExpressionValueType.Real:
              var leftReal = left.asReal();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftReal > right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftReal > right.asReal());
                case ExpressionValueType.String:
                  throw new Error(COMPARE_ERROR);
              }

            case ExpressionValueType.String:
              if (right.type === ExpressionValueType.String) {
                return new ExpressionValue(left.asString() > right.asString());
              }
              throw new Error(COMPARE_STRING_ERROR);
          }
          break;

        case ">=":
          switch (left.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              var leftNum = left.asLong();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftNum >= right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftNum >= right.asReal());
                case ExpressionValueType.String:
                  throw new Error(COMPARE_ERROR);
              }

            case ExpressionValueType.Real:
              var leftReal = left.asReal();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftReal >= right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftReal >= right.asReal());
                case ExpressionValueType.String:
                  throw new Error(COMPARE_ERROR);
              }

            case ExpressionValueType.String:
              if (right.type === ExpressionValueType.String) {
                return new ExpressionValue(left.asString() >= right.asString());
              }
              throw new Error(COMPARE_STRING_ERROR);
          }
          break;

        case "==":
          switch (left.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              var leftNum = left.asLong();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftNum === right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftNum === right.asReal());
                case ExpressionValueType.String:
                  throw new Error(COMPARE_ERROR);
              }

            case ExpressionValueType.Real:
              var leftReal = left.asReal();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftReal === right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftReal === right.asReal());
                case ExpressionValueType.String:
                  throw new Error(COMPARE_ERROR);
              }

            case ExpressionValueType.String:
              if (right.type === ExpressionValueType.String) {
                return new ExpressionValue(
                  left.asString() === right.asString()
                );
              }
              throw new Error(COMPARE_STRING_ERROR);
          }
          break;

        case "===":
          switch (left.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              var leftNum = left.asLong();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftNum === right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftNum === right.asReal());
                case ExpressionValueType.String:
                  throw new Error(COMPARE_ERROR);
              }

            case ExpressionValueType.Real:
              var leftReal = left.asReal();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftReal === right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftReal === right.asReal());
                case ExpressionValueType.String:
                  throw new Error(COMPARE_ERROR);
              }

            case ExpressionValueType.String:
              if (right.type === ExpressionValueType.String) {
                return new ExpressionValue(
                  left.asString().toLowerCase() ===
                    right.asString().toLowerCase()
                );
              }
              throw new Error(COMPARE_STRING_ERROR);
          }
          break;

        case "!=":
          switch (left.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              var leftNum = left.asLong();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftNum !== right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftNum !== right.asReal());
                case ExpressionValueType.String:
                  throw new Error(COMPARE_ERROR);
              }

            case ExpressionValueType.Real:
              var leftReal = left.asReal();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftReal !== right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftReal !== right.asReal());
                case ExpressionValueType.String:
                  throw new Error(COMPARE_ERROR);
              }

            case ExpressionValueType.String:
              if (right.type === ExpressionValueType.String) {
                return new ExpressionValue(
                  left.asString() !== right.asString()
                );
              }
              throw new Error(COMPARE_STRING_ERROR);
          }
          break;

        case "!==":
          switch (left.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              var leftNum = left.asLong();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftNum !== right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftNum !== right.asReal());
                case ExpressionValueType.String:
                  throw new Error(COMPARE_ERROR);
              }

            case ExpressionValueType.Real:
              var leftReal = left.asReal();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftReal !== right.asLong());
                case ExpressionValueType.Real:
                  return new ExpressionValue(leftReal !== right.asReal());
                case ExpressionValueType.String:
                  throw new Error(COMPARE_ERROR);
              }

            case ExpressionValueType.String:
              if (right.type === ExpressionValueType.String) {
                return new ExpressionValue(
                  left.asString().toLowerCase() !==
                    right.asString().toLowerCase()
                );
              }
              throw new Error(COMPARE_STRING_ERROR);
          }
          break;

        case "&":
          switch (left.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              var leftNum = left.asLong();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftNum & right.asLong());
                case ExpressionValueType.Real:
                case ExpressionValueType.String:
                  throwStringError("right", expr.operator);
                  return ExpressionValue.Error;
              }

            case ExpressionValueType.String:
              if (right.type === ExpressionValueType.String) {
                return new ExpressionValue(
                  `${left.asString()}\r\n${right.asString()}`
                );
              }
              throw new Error(
                `The right side of ${expr.operator} must be a string`
              );

            case ExpressionValueType.Real:
              throw new Error(
                `The left side of ${expr.operator} must be an integral type or a string`
              );
          }

        case "|":
          switch (left.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              var leftNum = left.asLong();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftNum | right.asLong());
                case ExpressionValueType.Real:
                case ExpressionValueType.String:
                  throwIntegralError("right", expr.operator);
                  return ExpressionValue.Error;
              }

            case ExpressionValueType.Real:
            case ExpressionValueType.String:
              throwIntegralError("left", expr.operator);
              return ExpressionValue.Error;
          }
          break;

        case "^":
          switch (left.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              var leftNum = left.asLong();
              switch (right.type) {
                case ExpressionValueType.Bool:
                case ExpressionValueType.Integer:
                  return new ExpressionValue(leftNum ^ right.asLong());
                case ExpressionValueType.Real:
                case ExpressionValueType.String:
                  throwIntegralError("right", expr.operator);
                  return ExpressionValue.Error;
              }

            case ExpressionValueType.Real:
            case ExpressionValueType.String:
              throwIntegralError("left", expr.operator);
              return ExpressionValue.Error;
          }
          break;
      }
      return ExpressionValue.NonEvaluated;
    }

    /**
     * Evaluates a unary operation
     * @param context Evaluation context
     * @param expr Unary expression
     * @returns The value of the evaluated expression
     */
    function evalUnaryOperationValue(
      context: EvaluationContext,
      expr: UnaryExpression
    ): ExpressionValue {
      const operand = context.doEvalExpression(expr.operand);
      if (!operand.isValid) {
        return ExpressionValue.NonEvaluated;
      }
      switch (expr.operator) {
        case "+":
          return operand;

        case "-":
          switch (operand.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              return new ExpressionValue(-operand.asLong());
            case ExpressionValueType.Real:
              return new ExpressionValue(-operand.asReal());
            case ExpressionValueType.String:
              const realValue = parseFloat(operand.asString());
              if (!isNaN(realValue)) {
                return new ExpressionValue(-realValue);
              }
              const intValue = parseInt(operand.asString());
              if (!isNaN(intValue)) {
                return new ExpressionValue(-intValue);
              }
              throw new Error(STRING_CONVERSION_ERROR);
          }
          break;

        case "!":
          switch (operand.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              return new ExpressionValue(operand.asLong() === 0);
            case ExpressionValueType.Real:
            case ExpressionValueType.String:
              throw new Error(
                "Unary logical not operation can be applied only on integral types"
              );
          }
          break;

        case "~":
          switch (operand.type) {
            case ExpressionValueType.Bool:
            case ExpressionValueType.Integer:
              return new ExpressionValue(~operand.asLong());
            case ExpressionValueType.Real:
            case ExpressionValueType.String:
              throw new Error(
                "Unary bitwise not operation can be applied only on integral types"
              );
          }
          break;
      }
      return ExpressionValue.NonEvaluated;
    }

    /**
     * Evaluates a unary operation
     * @param context Evaluation context
     * @param expr Unary expression
     * @returns The value of the evaluated expression
     */
    function evalConditionalOperationValue(
      context: EvaluationContext,
      expr: ConditionalExpression
    ): ExpressionValue {
      const cond = context.doEvalExpression(expr.condition);
      if (!cond.isValid) {
        return ExpressionValue.NonEvaluated;
      }
      return cond.asBool()
        ? context.doEvalExpression(expr.consequent)
        : context.doEvalExpression(expr.alternate);
    }

    function throwStringError(side: string, operator: string): void {
      throw new Error(`The ${side} operand of ${operator} cannot be a string.`);
    }

    function throwIntegralError(side: string, operator: string): void {
      throw new Error(
        `The ${side} operand of ${operator} must be an integral type.`
      );
    }
  }

  /**
   * Reports an error during evaluation
   * @param code Error code
   * @param node Error position
   * @param parameters Optional error parameters
   */
  abstract reportEvaluationError(
    code: ErrorCodes,
    node: NodePosition,
    ...parameters: any[]
  ): void;
}

/**
 * This class implements a seedable random number generator
 */
class SeededRandom {
  private _seed: number;

  /**
   * Initializes the random generator with the specified seed value
   * @param seed Seed value
   */
  constructor(seed: number) {
    this._seed = seed % 2147483647;
    if (this._seed <= 0) {
      this._seed += 2147483646;
    }
  }

  /**
   * Generates the next 32-bit integer random number
   */
  next(): number {
    return (this._seed = (this._seed * 16807) % 2147483647);
  }

  /**
   * Generates the next random number between 0.0 and 1.0 (exclusive)
   */
  nextFloat(): number {
    return (this.next() - 1) / 2147483646;
  }

  /**
   * Generates an integer number within the specified range
   * @param inclusiveFrom The inclusive start of the range
   * @param exclusiveTo The exclusive end of the range
   */
  integer(inclusiveFrom: number, exclusiveTo: number): number {
    return Math.floor(
      inclusiveFrom + this.nextFloat() * (exclusiveTo - inclusiveFrom)
    );
  }
}

let randomGenerator = new SeededRandom(Date.now());

export function setRandomSeed(seed: number): void {
  randomGenerator = new SeededRandom(seed);
}

/**
 * Represents a function evaluator class
 */
class FunctionEvaluator {
  constructor(
    public readonly evaluateFunc: (args: ExpressionValue[]) => ExpressionValue,
    public readonly argTypes: ExpressionValueType[]
  ) {}
}

const FUNCTION_EVALUATORS: { [key: string]: FunctionEvaluator[] } = {
  abs: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.abs(args[0].asLong())),
      [ExpressionValueType.Integer]
    ),
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.abs(args[0].asReal())),
      [ExpressionValueType.Real]
    ),
  ],
  acos: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.acos(args[0].asReal())),
      [ExpressionValueType.Real]
    ),
  ],
  asin: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.asin(args[0].asReal())),
      [ExpressionValueType.Real]
    ),
  ],
  atan: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.atan(args[0].asReal())),
      [ExpressionValueType.Real]
    ),
  ],
  atan2: [
    new FunctionEvaluator(
      (args) =>
        new ExpressionValue(Math.atan2(args[0].asReal(), args[1].asReal())),
      [ExpressionValueType.Real, ExpressionValueType.Real]
    ),
  ],
  ceiling: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.ceil(args[0].asReal())),
      [ExpressionValueType.Real]
    ),
  ],
  cos: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.cos(args[0].asReal())),
      [ExpressionValueType.Real]
    ),
  ],
  cosh: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.cosh(args[0].asReal())),
      [ExpressionValueType.Real]
    ),
  ],
  exp: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.exp(args[0].asReal())),
      [ExpressionValueType.Real]
    ),
  ],
  floor: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.floor(args[0].asReal())),
      [ExpressionValueType.Real]
    ),
  ],
  log: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.log(args[0].asReal())),
      [ExpressionValueType.Real]
    ),
    new FunctionEvaluator(
      (args) =>
        new ExpressionValue(
          Math.log(args[0].asReal()) /
            (args[1].asReal() === 0.0 ? 1 : Math.log(args[1].asReal()))
        ),
      [ExpressionValueType.Real, ExpressionValueType.Real]
    ),
  ],
  log10: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.log10(args[0].asReal())),
      [ExpressionValueType.Real]
    ),
  ],
  max: [
    new FunctionEvaluator(
      (args) =>
        new ExpressionValue(Math.max(args[0].asLong(), args[1].asLong())),
      [ExpressionValueType.Integer, ExpressionValueType.Integer]
    ),
    new FunctionEvaluator(
      (args) =>
        new ExpressionValue(Math.max(args[0].asReal(), args[1].asReal())),
      [ExpressionValueType.Real, ExpressionValueType.Real]
    ),
  ],
  min: [
    new FunctionEvaluator(
      (args) =>
        new ExpressionValue(Math.min(args[0].asLong(), args[1].asLong())),
      [ExpressionValueType.Integer, ExpressionValueType.Integer]
    ),
    new FunctionEvaluator(
      (args) =>
        new ExpressionValue(Math.min(args[0].asReal(), args[1].asReal())),
      [ExpressionValueType.Real, ExpressionValueType.Real]
    ),
  ],
  pow: [
    new FunctionEvaluator(
      (args) =>
        new ExpressionValue(Math.pow(args[0].asReal(), args[1].asReal())),
      [ExpressionValueType.Real, ExpressionValueType.Real]
    ),
  ],
  round: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.round(args[0].asReal())),
      [ExpressionValueType.Real]
    ),
  ],
  sign: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.sign(args[0].asLong())),
      [ExpressionValueType.Integer]
    ),
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.sign(args[0].asReal())),
      [ExpressionValueType.Real]
    ),
  ],
  sin: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.sin(args[0].asReal())),
      [ExpressionValueType.Real]
    ),
  ],
  sinh: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.sinh(args[0].asReal())),
      [ExpressionValueType.Real]
    ),
  ],
  sqrt: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.sqrt(args[0].asReal())),
      [ExpressionValueType.Real]
    ),
  ],
  tan: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.tan(args[0].asReal())),
      [ExpressionValueType.Real]
    ),
  ],
  tanh: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.tanh(args[0].asReal())),
      [ExpressionValueType.Real]
    ),
  ],
  truncate: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(Math.trunc(args[0].asReal())),
      [ExpressionValueType.Real]
    ),
  ],
  pi: [new FunctionEvaluator((args) => new ExpressionValue(Math.PI), [])],
  nat: [new FunctionEvaluator((args) => new ExpressionValue(Math.E), [])],
  low: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(args[0].asLong() & 0xff),
      [ExpressionValueType.Integer]
    ),
  ],
  high: [
    new FunctionEvaluator(
      (args) => new ExpressionValue((args[0].asLong() >> 8) & 0xff),
      [ExpressionValueType.Integer]
    ),
  ],
  word: [
    new FunctionEvaluator((args) => new ExpressionValue(args[0].asWord()), [
      ExpressionValueType.Integer,
    ]),
  ],
  rnd: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(randomGenerator.integer(0, 65536)),
      []
    ),
    new FunctionEvaluator(
      (args) =>
        new ExpressionValue(
          randomGenerator.integer(args[0].asLong(), args[1].asLong())
        ),
      [ExpressionValueType.Integer, ExpressionValueType.Integer]
    ),
  ],
  length: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(args[0].asString().length),
      [ExpressionValueType.String]
    ),
  ],
  len: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(args[0].asString().length),
      [ExpressionValueType.String]
    ),
  ],
  left: [
    new FunctionEvaluator(
      (args) => {
        const str = args[0].asString();
        const len = Math.min(str.length, args[1].asLong());
        return new ExpressionValue(str.substr(0, len));
      },
      [ExpressionValueType.String, ExpressionValueType.Integer]
    ),
  ],
  right: [
    new FunctionEvaluator(
      (args) => {
        const str = args[0].asString();
        const len = Math.min(str.length, args[1].asLong());
        return new ExpressionValue(str.substr(str.length - len, len));
      },
      [ExpressionValueType.String, ExpressionValueType.Integer]
    ),
  ],
  substr: [
    new FunctionEvaluator(
      (args) => {
        const str = args[0].asString();
        const start = Math.min(str.length, args[1].asLong());
        const len = Math.min(str.length - start, args[2].asLong());
        return new ExpressionValue(str.substr(start, len));
      },
      [
        ExpressionValueType.String,
        ExpressionValueType.Integer,
        ExpressionValueType.Integer,
      ]
    ),
  ],
  fill: [
    new FunctionEvaluator(
      (args) => {
        const str = args[0].asString();
        const count = args[1].asLong();
        const resultLen = str.length * count;
        if (resultLen > 0x4000) {
          throw new Error(
            "The result of the fill() function would be longer than #4000 bytes."
          );
        }
        var result = "";
        for (var i = 0; i < count; i++) {
          result += str;
        }
        return new ExpressionValue(result);
      },
      [ExpressionValueType.String, ExpressionValueType.Integer]
    ),
  ],
  int: [
    new FunctionEvaluator((args) => new ExpressionValue(args[0].asLong()), [
      ExpressionValueType.Real,
    ]),
  ],
  frac: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(args[0].asReal() - args[0].asLong()),
      [ExpressionValueType.Real]
    ),
  ],
  lowercase: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(args[0].asString().toLowerCase()),
      [ExpressionValueType.String]
    ),
  ],
  lcase: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(args[0].asString().toLowerCase()),
      [ExpressionValueType.String]
    ),
  ],
  uppercase: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(args[0].asString().toUpperCase()),
      [ExpressionValueType.String]
    ),
  ],
  ucase: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(args[0].asString().toUpperCase()),
      [ExpressionValueType.String]
    ),
  ],
  str: [
    new FunctionEvaluator((args) => new ExpressionValue(args[0].asString()), [
      ExpressionValueType.Bool,
    ]),
    new FunctionEvaluator((args) => new ExpressionValue(args[0].asString()), [
      ExpressionValueType.Integer,
    ]),
    new FunctionEvaluator((args) => new ExpressionValue(args[0].asString()), [
      ExpressionValueType.Real,
    ]),
    new FunctionEvaluator((args) => new ExpressionValue(args[0].asString()), [
      ExpressionValueType.String,
    ]),
  ],
  scraddr: [
    new FunctionEvaluator(
      (args) => {
        const line = args[0].asLong();
        if (line < 0 || line > 191) {
          throw new Error(
            `The 'line' argument of scraddr must be between 0 and 191. It cannot be ${line}.`
          );
        }

        const col = args[1].asLong();
        if (col < 0 || col > 255) {
          throw new Error(
            `The 'col' argument of scraddr must be between 0 and 255. It cannot be ${col}.`
          );
        }
        var da = 0x4000 | (col >> 3) | (line << 5);
        var addr =
          ((da & 0xf81f) | ((da & 0x0700) >> 3) | ((da & 0x00e0) << 3)) &
          0xffff;
        return new ExpressionValue(addr);
      },
      [ExpressionValueType.Integer, ExpressionValueType.Integer]
    ),
  ],
  attraddr: [
    new FunctionEvaluator(
      (args) => {
        const line = args[0].asLong();
        if (line < 0 || line > 191) {
          throw new Error(
            `The 'line' argument of scraddr must be between 0 and 191. It cannot be ${line}.`
          );
        }

        const col = args[1].asLong();
        if (col < 0 || col > 255) {
          throw new Error(
            `The 'col' argument of scraddr must be between 0 and 255. It cannot be ${col}.`
          );
        }
        return new ExpressionValue(0x5800 + (line >> 3) * 32 + (col >> 3));
      },
      [ExpressionValueType.Integer, ExpressionValueType.Integer]
    ),
  ],
  ink: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(args[0].asLong() & 0x07),
      [ExpressionValueType.Integer]
    ),
  ],
  paper: [
    new FunctionEvaluator(
      (args) => new ExpressionValue((args[0].asLong() & 0x07) << 3),
      [ExpressionValueType.Integer]
    ),
  ],
  bright: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(args[0].asLong() === 0 ? 0x00 : 0x40),
      [ExpressionValueType.Integer]
    ),
  ],
  flash: [
    new FunctionEvaluator(
      (args) => new ExpressionValue(args[0].asLong() === 0 ? 0x00 : 0x80),
      [ExpressionValueType.Integer]
    ),
  ],
  attr: [
    new FunctionEvaluator(
      (args) => {
        const ink = args[0].asLong() & 0x07;
        const paper = (args[1].asLong() & 0x07) << 3;
        const bright = args[2].asLong() === 0 ? 0x00 : 0x40;
        const flash = args[3].asLong() === 0 ? 0x00 : 0x80;
        return new ExpressionValue((flash | bright | paper | ink) & 0xff);
      },
      [
        ExpressionValueType.Integer,
        ExpressionValueType.Integer,
        ExpressionValueType.Integer,
        ExpressionValueType.Integer,
      ]
    ),
    new FunctionEvaluator(
      (args) => {
        const ink = args[0].asLong() & 0x07;
        const paper = (args[1].asLong() & 0x07) << 3;
        const bright = args[2].asLong() === 0 ? 0x00 : 0x40;
        return new ExpressionValue((bright | paper | ink) & 0xff);
      },
      [
        ExpressionValueType.Integer,
        ExpressionValueType.Integer,
        ExpressionValueType.Integer,
      ]
    ),
    new FunctionEvaluator(
      (args) => {
        const ink = args[0].asLong() & 0x07;
        const paper = (args[1].asLong() & 0x07) << 3;
        return new ExpressionValue((paper | ink) & 0xff);
      },
      [ExpressionValueType.Integer, ExpressionValueType.Integer]
    ),
  ],
};

/**
 * Evaluates a unary operation
 * @param context Evaluation context
 * @param expr Unary expression
 * @returns The value of the evaluated expression
 */
export function evalFunctionInvocationValue(
  context: EvaluationContext,
  funcExpr: FunctionInvocation
): ExpressionValue {
  // --- Evaluate all arguments from left to right
  const argValues: ExpressionValue[] = [];
  let errorMessage = "";
  let index = 0;
  let errCount = 0;
  for (const expr of funcExpr.args) {
    index++;
    const argValue = context.doEvalExpression(expr);
    if (argValue.isValid) {
      argValues.push(argValue);
    } else {
      errCount++;
    }
  }

  // --- Check for evaluation errors
  if (errCount > 0) {
    return ExpressionValue.Error;
  }

  // --- Function must be defined
  const evaluator = FUNCTION_EVALUATORS[funcExpr.functionName.name];
  if (!evaluator) {
    throw new Error(`Unknown function $'{FunctionName}'`);
  }

  // --- Find the apropriate signature
  let evaluatorFound: FunctionEvaluator | null = null;
  for (const evalOption of evaluator) {
    if (evalOption.argTypes.length !== funcExpr.args.length) {
      continue;
    }

    // --- A viable option found
    let match = true;
    for (let i = 0; i < evalOption.argTypes.length; i++) {
      const type = argValues[i].type;
      switch (evalOption.argTypes[i]) {
        case ExpressionValueType.Bool:
          match = type === ExpressionValueType.Bool;
          break;
        case ExpressionValueType.Integer:
          match =
            type === ExpressionValueType.Bool ||
            type === ExpressionValueType.Integer;
          break;
        case ExpressionValueType.Real:
          match =
            type === ExpressionValueType.Bool ||
            type === ExpressionValueType.Integer ||
            type === ExpressionValueType.Real;
          break;
        case ExpressionValueType.String:
          match = type === ExpressionValueType.String;
          break;
        default:
          return ExpressionValue.Error;
      }

      // --- Abort search if the current argumernt type does not match
      if (!match) {
        break;
      }
    }

    if (match) {
      // --- We have found a matching signature
      evaluatorFound = evalOption;
      break;
    }
  }

  // --- Check whether we found an option
  if (evaluatorFound === null) {
    throw new Error(
      `The arguments of '${funcExpr.functionName.name}' do not match any acceptable signatures`
    );
  }

  // --- Now, it is time to evaluate the function
  try {
    var functionValue = evaluatorFound.evaluateFunc(argValues);
    return functionValue;
  } catch (err) {
    throw new Error(
      `Function value cannot be evaluated: '${funcExpr.functionName.name}': ${err.message}`
    );
  }
}

/**
 * Evaluates a built-in function invocation
 * @param context Evaluation context
 * @param expr Unary expression
 * @returns The value of the evaluated expression
 */
export function evalMacroTimeFunctionInvocationValue(
  context: EvaluationContext,
  funcExpr: MacroTimeFunctionInvocation
): ExpressionValue {
  switch (funcExpr.functionName.toLowerCase()) {
    case "def":
      return new ExpressionValue(
        !!(
          funcExpr.operand &&
          funcExpr.operand.operandType !== OperandType.NoneArg
        )
      );
    case "isreg8":
      return new ExpressionValue(
        !!(
          funcExpr.operand &&
          (funcExpr.operand.operandType === OperandType.Reg8 ||
            funcExpr.operand.operandType === OperandType.Reg8Spec ||
            funcExpr.operand.operandType === OperandType.Reg8Idx)
        )
      );
    case "iscport":
      return new ExpressionValue(
        !!(
          funcExpr.operand && funcExpr.operand.operandType === OperandType.CPort
        )
      );
    case "iscondition":
      return new ExpressionValue(
        !!(
          funcExpr.operand &&
          (funcExpr.operand.operandType === OperandType.Condition ||
            funcExpr.operand?.register === "c")
        )
      );
    case "isexpr":
      return new ExpressionValue(
        !!(
          funcExpr.operand &&
          funcExpr.operand.operandType === OperandType.Expression
        )
      );
    case "isindexedaddr":
      return new ExpressionValue(
        !!(
          funcExpr.operand &&
          funcExpr.operand.operandType === OperandType.IndexedIndirect
        )
      );
    case "isreg16":
      return new ExpressionValue(
        !!(
          funcExpr.operand &&
          (funcExpr.operand.operandType === OperandType.Reg16 ||
            funcExpr.operand.operandType === OperandType.Reg16Spec ||
            funcExpr.operand.operandType === OperandType.Reg16Idx)
        )
      );
    case "isreg16idx":
      return new ExpressionValue(
        !!(
          funcExpr.operand &&
          funcExpr.operand.operandType === OperandType.Reg16Idx
        )
      );
    case "isreg16std":
      return new ExpressionValue(
        !!(
          funcExpr.operand && funcExpr.operand.operandType === OperandType.Reg16
        )
      );
    case "isreg8idx":
      return new ExpressionValue(
        !!(
          funcExpr.operand &&
          funcExpr.operand.operandType === OperandType.Reg8Idx
        )
      );
    case "isreg8spec":
      return new ExpressionValue(
        !!(
          funcExpr.operand &&
          funcExpr.operand.operandType === OperandType.Reg8Spec
        )
      );
    case "isreg8std":
      return new ExpressionValue(
        !!(
          funcExpr.operand && funcExpr.operand.operandType === OperandType.Reg8
        )
      );
    case "isregindirect":
      return new ExpressionValue(
        !!(
          funcExpr.operand &&
          funcExpr.operand.operandType === OperandType.RegIndirect
        )
      );
    case "isrega":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register === "a")
      );
    case "isregb":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register === "b")
      );
    case "isregc":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register === "c")
      );
    case "isregd":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register === "d")
      );
    case "isrege":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register === "e")
      );
    case "isregh":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register === "h")
      );
    case "isregl":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register === "l")
      );
    case "isregi":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register === "i")
      );
    case "isregr":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register === "r")
      );
    case "isregbc":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register === "bc")
      );
    case "isregde":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register === "de")
      );
    case "isreghl":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register === "hl")
      );
    case "isregsp":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register === "sp")
      );
    case "isregxh":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register.indexOf("xh") >= 0)
      );
    case "isregxl":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register.indexOf("xl") >= 0)
      );
    case "isregyh":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register.indexOf("yh") >= 0)
      );
    case "isregyl":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register.indexOf("yl") >= 0)
      );
    case "isregix":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register === "ix")
      );
    case "isregiy":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register === "iy")
      );
    case "isregaf":
      return new ExpressionValue(
        !!(funcExpr.operand && funcExpr.operand?.register === "af")
      );
    case "hreg": {
      let op: string | undefined;
      switch (funcExpr.operand.register) {
        case "af":
          op = "a";
        case "bc":
          op = "b";
        case "de":
          op = "d";
        case "hl":
          op = "h";
        case "ix":
          op = "xh";
        case "iy":
          op = "yh";
      }
      if (op) {
        return new ExpressionValue(op);
      }
      break;
    }
    case "lreg": {
      let op: string | undefined;
      switch (funcExpr.operand.register) {
        case "bc":
          op = "c";
        case "de":
          op = "e";
        case "hl":
          op = "l";
        case "ix":
          op = "xl";
        case "iy":
          op = "yl";
      }
      if (op) {
        return new ExpressionValue(op);
      }
      break;
    }
  }
  context.reportEvaluationError(
    "Z3001",
    funcExpr,
    null,
    `Cannot evaluate ${funcExpr.functionName}(${funcExpr.operand.register})`
  );
}
