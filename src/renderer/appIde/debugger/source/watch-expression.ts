import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import type { SourceActivationInfo, SourceValueType, VariableDebugInfo } from "@abstractions/SourceDebugInfo";
// --- `t` is a local name in this file (an address-of target): the translator is `translate`
import { t as translate } from "@common/i18n/i18n";

import { formatRaw, NEUTRAL_LANGUAGE, type DebugLanguageSupport } from "./language-support";
import { decodeValue, memoryFor, type MemoryView } from "./value-decoder";
import { arrayLayout, elementAddress, frameIx, variableAddress } from "./variables-model";
import type { WatchExpr, WatchValue } from "./watch-ast";

/**
 * Watch expressions (plan §10.8, `.plans/SHARED_Z80_BACKEND_PLAN.md` §12.3): a watch is parsed by
 * the language's plugin into the neutral watch AST (`watch-ast.ts`) and evaluated here, for every
 * language, over a snapshot of the machine's memory — nothing runs in the machine. Numbers evaluate
 * as JavaScript numbers; every meaning that differs between languages (division, remainders,
 * truth values, string `+`) is stated by the parser on the node.
 */

export type { WatchValue } from "./watch-ast";

export type WatchResult = { value: WatchValue; text: string; type?: string } | { error: string };

export type WatchContext = {
  info: SourceLevelDebugInfo;
  chain: SourceActivationInfo[];
  frame: number;
  mem: MemoryView;
  /** The program's language (its plugin, or the neutral one). */
  lang?: DebugLanguageSupport;
};

class WatchError extends Error {}
const fail = (message: string): never => {
  throw new WatchError(message);
};

/** Parses and evaluates a watch with the language's parser. */
export function evaluateWatch(text: string, ctx: WatchContext): WatchResult {
  const lang = ctx.lang ?? NEUTRAL_LANGUAGE;
  if (!lang.parseWatch) return { error: translate("panels.side.watchExpr.notAvailable") };
  const parsed = lang.parseWatch(text);
  if ("error" in parsed) return parsed;
  try {
    const value = evaluate(parsed.expression, { ...ctx, lang });
    return { value, text: formatWatchValue(value, lang), ...(value.kind === "number" && value.typeLabel ? { type: value.typeLabel } : {}) };
  } catch (e) {
    if (e instanceof WatchError) return { error: e.message };
    throw e;
  }
}

/** A watch's value as the language writes it. */
export function formatWatchValue(v: WatchValue, lang: DebugLanguageSupport = NEUTRAL_LANGUAGE): string {
  if (v.kind === "string") return formatRaw(lang, { kind: "text", codes: [...v.value].map((c) => c.charCodeAt(0)), truncated: false });
  if (v.type === "bool" || v.type === "bool/ff") return formatRaw(lang, { kind: "bool", value: v.value !== 0 });
  // --- Whole numbers print in full within the 32-bit range; reals as the Variables panel prints them
  const whole = Number.isInteger(v.value) && Math.abs(v.value) < 2 ** 32 && v.type !== "float40" && v.type !== "fix16.16";
  return whole ? String(v.value) : formatRaw(lang, { kind: "real", value: v.value });
}

type Ctx = WatchContext & { lang: DebugLanguageSupport };

/** The variable a name means in the selected frame: its locals first, then the globals. */
export function resolveVariable(ctx: WatchContext, name: string): VariableDebugInfo | undefined {
  const variables = ctx.info.extensions?.variables ?? [];
  const callableIndex = ctx.chain[ctx.frame]?.callableIndex;
  const candidates = [
    ...variables.filter((v) => v.scope !== "global" && v.scope.callableIndex === callableIndex),
    ...variables.filter((v) => v.scope === "global")
  ];
  const exact = candidates.find((v) => v.name === name);
  if (exact || !ctx.lang?.caseInsensitiveNames) return exact;
  return candidates.find((v) => v.name.toLowerCase() === name.toLowerCase());
}

/** A variable, its address, and the memory it is read through (its bank's pages for bank-local data). */
function variableOf(ctx: Ctx, name: string): { v: VariableDebugInfo; address?: number; mem: MemoryView } {
  const v = resolveVariable(ctx, name) ?? fail(translate("panels.side.watchExpr.unknownVariable", { name }));
  const mem = memoryFor(ctx.mem, v);
  if (v.location.at === "constant") return { v, mem };
  const ix = v.scope === "global" ? undefined : frameIx(ctx.chain, ctx.frame);
  const address = variableAddress(v, mem, ix);
  if (address === undefined) fail(translate("panels.side.watchExpr.frameNotSetUp", { name }));
  return { v, address, mem };
}

function valueAt(ctx: Ctx, mem: MemoryView, type: SourceValueType, typeLabel: string, address: number): WatchValue {
  const decoded = decodeValue(type, mem, address, ctx.lang);
  if (decoded.string !== undefined) return { kind: "string", value: decoded.string };
  if (decoded.number === undefined) fail(translate("panels.side.watchExpr.unsupportedExpression"));
  return { kind: "number", value: decoded.number!, type, typeLabel, ...(decoded.raw?.kind === "real" ? { real: true } : {}) };
}

function num(ctx: Ctx, e: WatchExpr): number {
  const v = evaluate(e, ctx);
  if (v.kind !== "number") fail(translate("panels.side.watchExpr.numberExpected"));
  return (v as { value: number }).value;
}

function elementOf(ctx: Ctx, name: string, subscripts: WatchExpr[]): { address: number; type: SourceValueType; typeLabel: string; mem: MemoryView } {
  const { v, address, mem } = variableOf(ctx, name);
  if (!v.array) fail(translate("panels.side.watchExpr.notArray", { name }));
  const layout = arrayLayout(v, mem, address!, ctx.lang);
  if (subscripts.length !== layout.dimensions.length) fail(translate("panels.side.watchExpr.dimensions", { name, count: layout.dimensions.length }));
  if (!layout.data) fail(translate("panels.side.watchExpr.notAllocated", { name }));
  const at = elementAddress(layout, subscripts.map((a) => Math.trunc(num(ctx, a))));
  if (at === undefined) fail(translate("panels.side.watchExpr.subscriptOutOfRange"));
  return { address: at!, type: layout.elementType, typeLabel: layout.elementLabel, mem };
}

const truth = (b: boolean, trueValue = 1): WatchValue => ({ kind: "number", value: b ? trueValue : 0 });

function evaluate(e: WatchExpr, ctx: Ctx): WatchValue {
  switch (e.kind) {
    case "number":
      return { kind: "number", value: e.value, ...(e.real ? { real: true } : {}) };
    case "string":
      return { kind: "string", value: e.value };
    case "variable": {
      const { v, address, mem } = variableOf(ctx, e.name);
      if (v.location.at === "constant") {
        const c = v.location.value;
        return typeof c === "string" ? { kind: "string", value: c } : { kind: "number", value: c, type: v.type, typeLabel: v.typeLabel };
      }
      if (v.array) fail(translate("panels.side.watchExpr.isArray", { name: e.name }));
      return valueAt(ctx, mem, v.type, v.typeLabel, address!);
    }
    case "element": {
      const element = elementOf(ctx, e.name, e.subscripts);
      return valueAt(ctx, element.mem, element.type, element.typeLabel, element.address);
    }
    case "addressOf": {
      const t = e.target;
      if (t.kind === "variable") {
        const { address } = variableOf(ctx, t.name);
        if (address === undefined) fail(translate("panels.side.watchExpr.noAddress", { name: t.name }));
        return { kind: "number", value: address!, type: e.type, typeLabel: e.typeLabel };
      }
      return { kind: "number", value: elementOf(ctx, t.name, t.subscripts).address, type: e.type, typeLabel: e.typeLabel };
    }
    case "peek":
      return valueAt(ctx, ctx.mem, e.type, e.typeLabel, Math.trunc(num(ctx, e.address)) & 0xffff);
    case "unary": {
      const x = num(ctx, e.operand);
      if (e.op === "neg") return { kind: "number", value: -x };
      if (e.op === "plus") return { kind: "number", value: x };
      if (e.op === "not") return truth(x === 0, e.trueValue);
      return { kind: "number", value: ~x };
    }
    case "binary":
      return binary(e, ctx);
    case "builtin": {
      const builtin = ctx.lang.builtins?.[e.name] ?? fail(translate("panels.side.watchExpr.unsupportedFunction", { name: e.name }));
      return builtin(
        e.args.map((a) => evaluate(a, ctx)),
        fail
      );
    }
    case "unsupported":
      return fail(e.message);
  }
}

function binary(e: Extract<WatchExpr, { kind: "binary" }>, ctx: Ctx): WatchValue {
  const l = evaluate(e.left, ctx);
  const r = evaluate(e.right, ctx);
  const t = e.trueValue;
  if (l.kind === "string" || r.kind === "string") {
    if (l.kind !== r.kind) fail(translate("panels.side.watchExpr.stringAndNumber"));
    const a = l.value as string;
    const b = r.value as string;
    switch (e.op) {
      case "add":
        return e.concatStrings ? { kind: "string", value: a + b } : fail(translate("panels.side.watchExpr.operatorOnStrings", { op: "+" }));
      case "eq":
        return truth(a === b, t);
      case "ne":
        return truth(a !== b, t);
      case "lt":
        return truth(a < b, t);
      case "gt":
        return truth(a > b, t);
      case "le":
        return truth(a <= b, t);
      case "ge":
        return truth(a >= b, t);
      default:
        return fail(translate("panels.side.watchExpr.operatorOnStrings", { op: e.op }));
    }
  }
  const a = l.value;
  const b = r.value;
  // --- A real operand makes a real result (C's usual arithmetic conversions)
  const real = !!(l.real || r.real);
  const n = (value: number): WatchValue => ({ kind: "number", value, ...(real ? { real: true } : {}) });
  switch (e.op) {
    case "add":
      return n(a + b);
    case "sub":
      return n(a - b);
    case "mul":
      return n(a * b);
    case "div": {
      if (b === 0) return fail(translate("panels.side.watchExpr.divisionByZero"));
      const integers = !real && Number.isInteger(a) && Number.isInteger(b);
      if (e.mode === "trunc" || (e.mode === "c" && integers)) return n(Math.trunc(a / b));
      if (e.mode === "floor") return n(Math.floor(a / b));
      return n(a / b);
    }
    case "pow":
      return n(a ** b);
    case "mod":
      if (b === 0) return fail(translate("panels.side.watchExpr.divisionByZero"));
      if (e.mode === "magnitude") return n(Math.abs(a) % Math.abs(b));
      return n(e.mode === "floor" ? a - b * Math.floor(a / b) : a % b);
    case "eq":
      return truth(a === b, t);
    case "ne":
      return truth(a !== b, t);
    case "lt":
      return truth(a < b, t);
    case "gt":
      return truth(a > b, t);
    case "le":
      return truth(a <= b, t);
    case "ge":
      return truth(a >= b, t);
    case "and":
      return truth(a !== 0 && b !== 0, t);
    case "or":
      return truth(a !== 0 || b !== 0, t);
    case "xor":
      return truth((a !== 0) !== (b !== 0), t);
    case "band":
      return n(a & b);
    case "bor":
      return n(a | b);
    case "bxor":
      return n(a ^ b);
    case "shl":
      return n(a << b);
    case "shr":
      return n(e.mode === "arith" ? a >> b : a >>> b);
  }
}
