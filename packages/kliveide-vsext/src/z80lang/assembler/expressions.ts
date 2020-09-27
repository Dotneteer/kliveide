import { HasUsageInfo } from "./assembler-types";

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
