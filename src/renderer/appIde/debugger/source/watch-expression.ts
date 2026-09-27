import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import type { SourceActivationInfo, SourceValueType, VariableDebugInfo } from "@abstractions/SourceDebugInfo";
import { DiagnosticBag } from "@main/kbasic/diagnostics";
import type { Expression } from "@main/kbasic/syntax/ast";
import { lex } from "@main/kbasic/syntax/lexer";
import { parseExpression } from "@main/kbasic/syntax/parser";
import { SourceFile } from "@main/kbasic/syntax/source";

import { decodeValue, formatFloat, spectrumText, typeName, type MemoryView } from "./value-decoder";
import { arrayLayout, elementAddress, frameIx, variableAddress } from "./variables-model";

/**
 * BASIC watch expressions (plan §10.8): a watch is parsed by the compiler's own expression parser
 * and evaluated here, over a snapshot of the machine's memory — nothing runs in the machine.
 *
 * The language: variables of the selected frame and globals, array elements with any subscripts,
 * `@var` and `@a(i)`, `PEEK([type,] address)`, `LEN`, `CODE`, `CHR$`, `ABS`, `SGN`, `INT`,
 * arithmetic, comparisons and the logical and bitwise operators. Numbers evaluate as JavaScript
 * numbers; comparisons and logic give 1 or 0, as in BASIC.
 */

export type WatchValue = { kind: "number"; value: number; type?: SourceValueType } | { kind: "string"; value: string };

export type WatchResult = { value: WatchValue; text: string; type?: string } | { error: string };

export type WatchContext = {
  info: SourceLevelDebugInfo;
  chain: SourceActivationInfo[];
  frame: number;
  mem: MemoryView;
};

/** Parses a watch; the error is the parser's first message. */
export function parseWatch(text: string): { expression: Expression } | { error: string } {
  const diagnostics = new DiagnosticBag();
  const file = new SourceFile(0, "watch", text);
  const { tokens } = lex(file, diagnostics);
  const expression = diagnostics.hasErrors ? undefined : parseExpression(tokens, diagnostics);
  if (!expression) return { error: diagnostics.items.find((d) => d.severity === "error")?.message ?? "Invalid expression" };
  return { expression };
}

class WatchError extends Error {}
const fail = (message: string): never => {
  throw new WatchError(message);
};

/** Parses and evaluates a watch. */
export function evaluateWatch(text: string, ctx: WatchContext): WatchResult {
  const parsed = parseWatch(text);
  if ("error" in parsed) return parsed;
  try {
    const value = evaluate(parsed.expression, ctx);
    return { value, text: formatWatchValue(value), ...(value.kind === "number" && value.type ? { type: typeName(value.type) } : {}) };
  } catch (e) {
    if (e instanceof WatchError) return { error: e.message };
    throw e;
  }
}

export function formatWatchValue(v: WatchValue): string {
  if (v.kind === "string") return spectrumText([...v.value].map((c) => c.charCodeAt(0)));
  if (v.type === "boolean") return v.value ? "TRUE" : "FALSE";
  return Number.isInteger(v.value) ? String(v.value) : formatFloat(v.value);
}

/** The variable a name means in the selected frame: its locals first, then the globals. */
export function resolveVariable(ctx: WatchContext, name: string): VariableDebugInfo | undefined {
  const variables = ctx.info.extensions?.variables ?? [];
  const callableIndex = ctx.chain[ctx.frame]?.callableIndex;
  const candidates = [
    ...variables.filter((v) => v.scope !== "global" && v.scope.callableIndex === callableIndex),
    ...variables.filter((v) => v.scope === "global")
  ];
  return candidates.find((v) => v.name === name) ?? candidates.find((v) => v.name.toLowerCase() === name.toLowerCase());
}

function variableOf(ctx: WatchContext, name: string): { v: VariableDebugInfo; address?: number } {
  const v = resolveVariable(ctx, name) ?? fail(`Unknown variable '${name}'`);
  if (v.location.at === "constant") return { v };
  const ix = v.scope === "global" ? undefined : frameIx(ctx.chain, ctx.frame);
  const address = variableAddress(v, ctx.mem, ix);
  if (address === undefined) fail(`'${name}' cannot be read here: the routine's frame is not set up`);
  return { v, address };
}

function valueAt(ctx: WatchContext, type: SourceValueType, address: number): WatchValue {
  const decoded = decodeValue(type, ctx.mem, address);
  return decoded.string !== undefined ? { kind: "string", value: decoded.string } : { kind: "number", value: decoded.number!, type };
}

function num(ctx: WatchContext, e: Expression): number {
  const v = evaluate(e, ctx);
  if (v.kind !== "number") fail("A number is expected here");
  return (v as { value: number }).value;
}

function elementOf(ctx: WatchContext, name: string, args: Expression[]): { address: number; type: SourceValueType } {
  const { v, address } = variableOf(ctx, name);
  if (!v.array) fail(`'${name}' is not an array`);
  const layout = arrayLayout(v, ctx.mem, address!);
  if (args.length !== layout.dimensions.length) fail(`'${name}' has ${layout.dimensions.length} dimension(s)`);
  if (!layout.data) fail(`'${name}' is not allocated`);
  const at = elementAddress(layout, args.map((a) => Math.trunc(num(ctx, a))));
  if (at === undefined) fail("Subscript out of range");
  return { address: at!, type: layout.elementType };
}

function callArgs(e: Extract<Expression, { kind: "call" }>): Expression[] {
  return e.args.map((a) => (a.kind === "arg" ? a.value : fail("Slices and named arguments are not supported in watches")));
}

const truth = (b: boolean): WatchValue => ({ kind: "number", value: b ? 1 : 0 });

function evaluate(e: Expression, ctx: WatchContext): WatchValue {
  switch (e.kind) {
    case "number":
      return { kind: "number", value: e.value };
    case "string":
      return { kind: "string", value: e.value };
    case "paren":
      return evaluate(e.expression, ctx);
    case "name": {
      const { v, address } = variableOf(ctx, e.name);
      if (v.location.at === "constant") {
        const c = v.location.value;
        return typeof c === "string" ? { kind: "string", value: c } : { kind: "number", value: c, type: v.type };
      }
      if (v.array) fail(`'${e.name}' is an array: give its subscripts`);
      return valueAt(ctx, v.type, address!);
    }
    case "call": {
      if (e.callee.kind !== "name") return fail("Only array elements can be subscripted");
      const element = elementOf(ctx, e.callee.name, callArgs(e));
      return valueAt(ctx, element.type, element.address);
    }
    case "addressOf": {
      const t = e.target;
      if (t.kind === "name") {
        const { address } = variableOf(ctx, t.name);
        if (address === undefined) fail(`'${t.name}' has no address`);
        return { kind: "number", value: address!, type: "uinteger" };
      }
      if (t.callee.kind !== "name") return fail("Invalid address-of target");
      return { kind: "number", value: elementOf(ctx, t.callee.name, callArgs(t)).address, type: "uinteger" };
    }
    case "unary": {
      const x = num(ctx, e.operand);
      if (e.op === "-") return { kind: "number", value: -x };
      if (e.op === "+") return { kind: "number", value: x };
      if (e.op === "NOT") return truth(x === 0);
      return { kind: "number", value: ~x };
    }
    case "binary":
      return binary(e, ctx);
    case "builtin":
      return builtin(e, ctx);
    default:
      return fail("This expression is not supported in watches");
  }
}

function binary(e: Extract<Expression, { kind: "binary" }>, ctx: WatchContext): WatchValue {
  const l = evaluate(e.left, ctx);
  const r = evaluate(e.right, ctx);
  if (l.kind === "string" || r.kind === "string") {
    if (l.kind !== r.kind) fail("A String cannot be combined with a number");
    const a = l.value as string;
    const b = r.value as string;
    switch (e.op) {
      case "+":
        return { kind: "string", value: a + b };
      case "=":
        return truth(a === b);
      case "<>":
        return truth(a !== b);
      case "<":
        return truth(a < b);
      case ">":
        return truth(a > b);
      case "<=":
        return truth(a <= b);
      case ">=":
        return truth(a >= b);
      default:
        return fail(`'${e.op}' does not apply to Strings`);
    }
  }
  const a = l.value;
  const b = r.value;
  const n = (value: number): WatchValue => ({ kind: "number", value });
  switch (e.op) {
    case "+":
      return n(a + b);
    case "-":
      return n(a - b);
    case "*":
      return n(a * b);
    case "/":
      return b === 0 ? fail("Division by zero") : n(a / b);
    case "^":
      return n(a ** b);
    case "MOD":
      return b === 0 ? fail("Division by zero") : n(a % b);
    case "=":
      return truth(a === b);
    case "<>":
      return truth(a !== b);
    case "<":
      return truth(a < b);
    case ">":
      return truth(a > b);
    case "<=":
      return truth(a <= b);
    case ">=":
      return truth(a >= b);
    case "AND":
      return truth(a !== 0 && b !== 0);
    case "OR":
      return truth(a !== 0 || b !== 0);
    case "XOR":
      return truth((a !== 0) !== (b !== 0));
    case "BAND":
      return n(a & b);
    case "BOR":
      return n(a | b);
    case "BXOR":
      return n(a ^ b);
    case "SHL":
      return n(a << b);
    case "SHR":
      return n(a >>> b);
  }
}

const PEEK_TYPES: Record<string, SourceValueType> = {
  BYTE: "byte",
  UBYTE: "ubyte",
  INTEGER: "integer",
  UINTEGER: "uinteger",
  LONG: "long",
  ULONG: "ulong",
  FIXED: "fixed",
  FLOAT: "float",
  STRING: "string"
};

function builtin(e: Extract<Expression, { kind: "builtin" }>, ctx: WatchContext): WatchValue {
  const arg = (i = 0) => e.args[i] ?? fail(`${e.name} needs an argument`);
  switch (e.name) {
    case "PEEK": {
      const type = e.type ? PEEK_TYPES[e.type.name] : "ubyte";
      return valueAt(ctx, type, Math.trunc(num(ctx, arg())) & 0xffff);
    }
    case "LEN": {
      const v = evaluate(arg(), ctx);
      return v.kind === "string" ? { kind: "number", value: v.value.length } : fail("LEN needs a String");
    }
    case "CODE": {
      const v = evaluate(arg(), ctx);
      return v.kind === "string" ? { kind: "number", value: v.value.length ? v.value.charCodeAt(0) : 0 } : fail("CODE needs a String");
    }
    case "CHR":
      return { kind: "string", value: e.args.map((a) => String.fromCharCode(num(ctx, a) & 0xff)).join("") };
    case "ABS":
      return { kind: "number", value: Math.abs(num(ctx, arg())) };
    case "SGN":
      return { kind: "number", value: Math.sign(num(ctx, arg())) };
    case "INT":
      return { kind: "number", value: Math.floor(num(ctx, arg())) };
    default:
      return fail(`${e.name} is not supported in watches`);
  }
}
