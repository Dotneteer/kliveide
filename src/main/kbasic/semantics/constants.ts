import * as f40 from "./float40";
import type { Float40 } from "./float40";
import { integralRange, isIntegral, literalIntegerType, sizeOf, type KType } from "./types";

/**
 * Compile-time values. Folding computes what the program would compute at run time, in the type the
 * operation has: integral arithmetic wraps to its width, Fixed is 16.16 two's complement, and Float
 * goes through `float40`, which reproduces the ROM calculator bit for bit (plan §7.4).
 */
export type ConstValue =
  | { kind: "int"; value: bigint }
  | { kind: "fixed"; raw: number }
  | { kind: "float"; value: Float40 }
  | { kind: "string"; value: string }
  /** An address the assembler resolves: `@label`, `@global`, `@array(1, 2)`. */
  | { kind: "address"; symbol: string; offset: number };

export type Constant = {
  type: KType;
  value: ConstValue;
  /**
   * Made only of number literals and untyped constants: integer results take the smallest type
   * that holds them instead of wrapping (`200 + 100` is 300, a UInteger).
   */
  literal?: boolean;
};

/** A folding problem the caller reports: `overflow` is the ROM's "Number too big". */
export type FoldProblem = "overflow" | "divisionByZero";

export class FoldError extends Error {
  constructor(readonly problem: FoldProblem) {
    super(problem);
  }
}

// =================================================================================================
// Construction

export function intConstant(value: bigint, type: KType, literal = false): Constant {
  return { type, value: { kind: "int", value }, ...(literal ? { literal } : {}) };
}

export function stringConstant(value: string): Constant {
  return { type: "String", value: { kind: "string", value } };
}

export function booleanConstant(value: boolean): Constant {
  return intConstant(value ? 1n : 0n, "Boolean");
}

/** A number literal: integers take the smallest type that holds them; reals are Float. */
export function numberLiteral(value: number, text: string, form: "integer" | "real" | "based"): Constant {
  if (form !== "real" && Number.isSafeInteger(value)) {
    const v = BigInt(value);
    const type = literalIntegerType(v);
    if (type !== "Float") return intConstant(v, type, true);
    return { type: "Float", value: { kind: "float", value: f40.fromDecimal(v.toString()) }, literal: true };
  }
  const decimal = form === "real" ? text : String(value);
  return { type: "Float", value: { kind: "float", value: f40.fromDecimal(decimal) }, literal: true };
}

// =================================================================================================
// Reading

/** The exact value of a numeric constant (a Float's exact binary value). */
export function numericValue(c: Constant): number {
  const v = c.value;
  switch (v.kind) {
    case "int":
      return Number(v.value);
    case "fixed":
      return v.raw / 65536;
    case "float":
      return f40.toNumber(v.value);
    default:
      throw new Error(`${v.kind} is not a number`);
  }
}

/** Zero is false, anything else true (a string is true unless empty). */
export function isTrueConstant(c: Constant): boolean {
  const v = c.value;
  switch (v.kind) {
    case "int":
      return v.value !== 0n;
    case "fixed":
      return v.raw !== 0;
    case "float":
      return f40.isTrue(v.value);
    case "string":
      return v.value.length > 0;
    case "address":
      return true;
  }
}

/** How a constant is shown in messages. */
export function constantText(c: Constant): string {
  const v = c.value;
  switch (v.kind) {
    case "string":
      return JSON.stringify(v.value);
    case "address":
      return `@${v.symbol}${v.offset ? `+${v.offset}` : ""}`;
    default:
      return String(numericValue(c));
  }
}

// =================================================================================================
// Conversion

/**
 * Converts a numeric constant to another numeric type (spec `types.conversions.constants`): to an
 * integral type it truncates towards minus infinity and masks to the width. `lossy` is W120: a
 * fraction dropped or a value that does not fit. Undefined when the value stays unknown until the
 * program is assembled (an address in a type that cannot hold one).
 */
export function convertConstant(c: Constant, to: KType): { constant: Constant; lossy: boolean } | undefined {
  const v = c.value;
  if (to === c.type && !c.literal) return { constant: c, lossy: false };
  if (v.kind === "string" || to === "String") {
    if (v.kind === "string" && to === "String") return { constant: c, lossy: false };
    throw new Error("String and number constants do not convert");
  }
  if (v.kind === "address") {
    return isIntegral(to) && sizeOf(to) >= 2 ? { constant: { type: to, value: v }, lossy: false } : undefined;
  }
  if (isIntegral(to)) {
    const exact = exactRational(c);
    const floor = floorDiv(exact.num, exact.den);
    const { min, max } = integralRange(to === "Boolean" ? "UByte" : to);
    const lossy = floor * exact.den !== exact.num || floor < min || floor > max;
    const value = to === "Boolean" ? (floor !== 0n ? 1n : 0n) : wrap(floor, to);
    return { constant: intConstant(value, to), lossy };
  }
  if (to === "Fixed") {
    const exact = exactRational(c);
    const scaled = floorDiv(exact.num * 65536n, exact.den);
    const lossy = scaled * exact.den !== exact.num * 65536n || scaled < -(2n ** 31n) || scaled >= 2n ** 31n;
    return { constant: { type: "Fixed", value: { kind: "fixed", raw: Number(BigInt.asIntN(32, scaled)) } }, lossy };
  }
  // --- Float
  switch (v.kind) {
    case "float":
      return { constant: { type: "Float", value: v }, lossy: false };
    case "int":
      return { constant: { type: "Float", value: { kind: "float", value: f40.fromDecimal(v.value.toString()) } }, lossy: false };
    case "fixed":
      return { constant: { type: "Float", value: { kind: "float", value: f40.fromNumber(v.raw / 65536) } }, lossy: false };
  }
}

/** Keeps the low bits of an integer in a type's width, as the machine does. */
export function wrap(value: bigint, type: KType): bigint {
  const bits = sizeOf(type) * 8;
  return integralRange(type).min < 0n ? BigInt.asIntN(bits, value) : BigInt.asUintN(bits, value);
}

type Rational = { num: bigint; den: bigint };

function exactRational(c: Constant): Rational {
  const v = c.value;
  switch (v.kind) {
    case "int":
      return { num: v.value, den: 1n };
    case "fixed":
      return { num: BigInt(v.raw), den: 65536n };
    case "float": {
      // --- A Float is a dyadic rational: scale its exact double value up to an integer
      let x = f40.toNumber(v.value);
      let den = 1n;
      while (!Number.isInteger(x)) {
        x *= 2;
        den *= 2n;
      }
      return { num: BigInt(x), den };
    }
    default:
      throw new Error(`${v.kind} is not a number`);
  }
}

function floorDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  return (a % b !== 0n) && (a < 0n) !== (b < 0n) ? q - 1n : q;
}

// =================================================================================================
// Folding

export type BinaryFoldOp =
  | "+" | "-" | "*" | "/" | "MOD" | "^"
  | "=" | "<>" | "<" | ">" | "<=" | ">="
  | "AND" | "OR" | "XOR"
  | "BAND" | "BOR" | "BXOR" | "SHL" | "SHR";

/**
 * Folds a binary operation on two constants, computed in `operandType` (the operands are converted
 * to it here, so that literal-ness is still known), giving a value of `resultType`. Undefined when the operation is left to the program (an address operand, Float MOD).
 * Throws FoldError for a Float result out of range.
 */
export function foldBinary(
  op: BinaryFoldOp,
  a: Constant,
  b: Constant,
  operandType: KType,
  resultType: KType
): Constant | undefined {
  const literal = !!a.literal && !!b.literal;
  if (a.value.kind === "address" || b.value.kind === "address") return foldAddress(op, a, b, resultType);

  // --- Logical operators look at truth values only
  if (op === "AND" || op === "OR" || op === "XOR") {
    const x = isTrueConstant(a);
    const y = isTrueConstant(b);
    return booleanConstant(op === "AND" ? x && y : op === "OR" ? x || y : x !== y);
  }

  if (operandType === "String") {
    const x = (a.value as { value: string }).value;
    const y = (b.value as { value: string }).value;
    if (op === "+") return stringConstant(x + y);
    return compareResult(op, x < y ? -1 : x > y ? 1 : 0);
  }

  if (op === "^") {
    // --- Provisional (plan R8): the exact power, rounded to a Float. The ROM computes x^y as
    // --- EXP(y * LN x), which can differ in the last bit; confirm with the oracle.
    return floatConstant(f40.fromNumber(numericValue(a) ** numericValue(b)));
  }

  if (operandType === "Float") {
    const x = asFloat(a);
    const y = asFloat(b);
    try {
      switch (op) {
        case "+":
          return floatConstant(f40.add(x, y));
        case "-":
          return floatConstant(f40.subtract(x, y));
        case "*":
          return floatConstant(f40.multiply(x, y));
        case "/":
          if (!f40.isTrue(y)) throw new FoldError("divisionByZero");
          return floatConstant(f40.divide(x, y));
        case "MOD":
          return undefined;
        case "=":
        case "<>":
        case "<":
        case ">":
        case "<=":
        case ">=":
          return booleanConstant(f40.isTrue(f40.compare(x, op, y)));
        default:
          return undefined;
      }
    } catch (e) {
      if (e instanceof f40.Float40Overflow) throw new FoldError("overflow");
      throw e;
    }
  }

  // --- Fixed and integral operations read their operands in the operand type
  a = convertConstant(a, operandType)!.constant;
  b = convertConstant(b, operandType)!.constant;

  if (operandType === "Fixed") {
    const x = BigInt((a.value as { raw: number }).raw);
    const y = BigInt((b.value as { raw: number }).raw);
    const fixed = (raw: bigint): Constant => ({ type: "Fixed", value: { kind: "fixed", raw: Number(BigInt.asIntN(32, raw)) } });
    switch (op) {
      case "+":
        return fixed(x + y);
      case "-":
        return fixed(x - y);
      case "*":
        return fixed(floorDiv(x * y, 65536n));
      case "/":
        if (y === 0n) throw new FoldError("divisionByZero");
        return fixed((x * 65536n) / y);
      case "=":
      case "<>":
      case "<":
      case ">":
      case "<=":
      case ">=":
        return compareResult(op, x < y ? -1 : x > y ? 1 : 0);
      default:
        return undefined;
    }
  }

  // --- Integral
  const x = (a.value as { value: bigint }).value;
  const y = (b.value as { value: bigint }).value;
  let result: bigint;
  switch (op) {
    case "+":
      result = x + y;
      break;
    case "-":
      result = x - y;
      break;
    case "*":
      result = x * y;
      break;
    case "/":
      // --- Truncates towards zero; a zero divisor gives every bit set, as the runtime does
      result = y === 0n ? -1n : x / y;
      break;
    case "MOD":
      // --- The remainder takes the dividend's sign; a zero divisor gives the dividend
      result = y === 0n ? x : x % y;
      break;
    case "BAND":
      result = x & y;
      break;
    case "BOR":
      result = x | y;
      break;
    case "BXOR":
      result = x ^ y;
      break;
    case "SHL":
      result = y >= BigInt(sizeOf(resultType) * 8) ? 0n : x << y;
      break;
    case "SHR":
      // --- Provisional (plan R8): arithmetic for signed types, logical for unsigned
      result = x >> (y > 64n ? 64n : y);
      break;
    default:
      return compareResult(op, x < y ? -1 : x > y ? 1 : 0);
  }
  if (literal && op !== "SHL" && op !== "SHR" && op !== "BAND" && op !== "BOR" && op !== "BXOR") {
    const type = literalIntegerType(result);
    if (type === "Float") return { type, value: { kind: "float", value: f40.fromDecimal(result.toString()) }, literal: true };
    return intConstant(result, type, true);
  }
  return intConstant(wrap(result, resultType), resultType, false);
}

/** Folds a unary operation on a constant already in `type` (the result type for NOT is Boolean). */
export function foldUnary(op: "-" | "+" | "NOT" | "BNOT", c: Constant, type: KType): Constant | undefined {
  const v = c.value;
  if (op === "+") return c;
  if (op === "NOT") return booleanConstant(!isTrueConstant(c));
  if (v.kind === "address" || v.kind === "string") return undefined;
  if (op === "BNOT") {
    if (v.kind !== "int") return undefined;
    return intConstant(wrap(~v.value, type), type);
  }
  switch (v.kind) {
    case "int":
      if (c.literal) {
        const t = literalIntegerType(-v.value);
        if (t !== "Float") return intConstant(-v.value, t, true);
      }
      return intConstant(wrap(-v.value, type), type);
    case "fixed":
      return { type: "Fixed", value: { kind: "fixed", raw: Number(BigInt.asIntN(32, -BigInt(v.raw))) } };
    case "float":
      return { ...floatConstant(f40.negate(v.value)), ...(c.literal ? { literal: true } : {}) };
  }
}

function foldAddress(op: BinaryFoldOp, a: Constant, b: Constant, resultType: KType): Constant | undefined {
  // --- @x + n and @x - n stay link-time constants; anything else is computed by the program
  const address = a.value.kind === "address" ? a.value : b.value.kind === "address" ? b.value : undefined;
  const other = a.value.kind === "address" ? b : a;
  if (!address || other.value.kind !== "int") return undefined;
  const n = Number(other.value.value);
  if (op === "+") return { type: resultType, value: { ...address, offset: address.offset + n } };
  if (op === "-" && a.value.kind === "address") return { type: resultType, value: { ...address, offset: address.offset - n } };
  return undefined;
}

function compareResult(op: BinaryFoldOp, order: number): Constant | undefined {
  switch (op) {
    case "=":
      return booleanConstant(order === 0);
    case "<>":
      return booleanConstant(order !== 0);
    case "<":
      return booleanConstant(order < 0);
    case ">":
      return booleanConstant(order > 0);
    case "<=":
      return booleanConstant(order <= 0);
    case ">=":
      return booleanConstant(order >= 0);
    default:
      return undefined;
  }
}

function floatConstant(value: Float40): Constant {
  return { type: "Float", value: { kind: "float", value } };
}

function asFloat(c: Constant): Float40 {
  const converted = convertConstant(c, "Float");
  return (converted!.constant.value as { value: Float40 }).value;
}
