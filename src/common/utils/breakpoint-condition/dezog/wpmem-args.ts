import type { ConditionSymbols } from "../condition-types";
import type { SyntaxNode } from "../condition-parser";
import { ConditionSyntaxError } from "../condition-lexer";
import { parseDezogExpression } from "./dezog-parser";
import { t } from "@common/i18n/i18n";

/*
 * The arguments of a DeZog `WPMEM` comment (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` §2.2,
 * §4.3), recorded from DeZog's documentation in Klive's words:
 *
 *   WPMEM [addr [, length [, access]]]
 *
 * - `addr`: a DeZog-dialect expression; omitted, the comment line's own (banked) address.
 * - `length`: bytes, default 1.
 * - `access`: `r`, `w` or `rw`, default `rw`.
 *
 * The leading-comma form `WPMEM, 5, w` omits `addr`. `addr` and `length` are constant-folded
 * against the build's symbols: a watchpoint has no condition, so nothing in them may read a
 * register or memory.
 */

export type WpmemAccess = "r" | "w" | "rw";

export type WpmemArgs = {
  /** The explicit 64K address; absent means the comment line's own address. */
  address?: number;
  /** Bytes watched, `1..65536`. */
  length: number;
  access: WpmemAccess;
};

export type WpmemParseResult = { args: WpmemArgs } | { error: string };

/** The largest range a watchpoint covers. */
const MAX_LENGTH = 0x1_0000;

/**
 * Parse a `WPMEM` comment's text (everything after the keyword).
 * @param text The arguments as written
 * @param symbols The build's integer symbols, keyed lower-case; labels missing from them are errors
 */
export function parseWpmemArgs(text: string, symbols: ConditionSymbols = {}): WpmemParseResult {
  const parts = splitTopLevel(text.trim());
  if (parts.length > 3) {
    return { error: t("debug.wpmem.tooManyArgs") };
  }
  const [addrText = "", lengthText = "", accessText = ""] = parts.map((p) => p.trim());

  let address: number | undefined;
  if (addrText) {
    const folded = foldText(addrText, symbols, "debug.wpmem.addressInvalid");
    if ("error" in folded) return folded;
    if (folded.value < 0 || folded.value > 0xffff) {
      return { error: t("debug.wpmem.addressRange", { text: addrText }) };
    }
    address = folded.value;
  }

  let length = 1;
  if (lengthText) {
    const folded = foldText(lengthText, symbols, "debug.wpmem.lengthInvalid");
    if ("error" in folded) return folded;
    if (folded.value < 1 || folded.value > MAX_LENGTH) {
      return { error: t("debug.wpmem.lengthRange", { text: lengthText }) };
    }
    length = folded.value;
  } else if (parts.length > 1 && accessText) {
    return { error: t("debug.wpmem.lengthMissing") };
  }
  if (address !== undefined && address + length > MAX_LENGTH) {
    return { error: t("debug.wpmem.pastEnd") };
  }

  let access: WpmemAccess = "rw";
  if (accessText) {
    const lower = accessText.toLowerCase();
    if (lower !== "r" && lower !== "w" && lower !== "rw") {
      return { error: t("debug.wpmem.badAccess", { text: accessText }) };
    }
    access = lower;
  }

  return { args: { ...(address !== undefined ? { address } : {}), length, access } };
}

/** Split at commas outside parentheses. An empty text has no arguments. */
function splitTopLevel(text: string): string[] {
  if (!text) return [];
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (c === "," && depth === 0) {
      parts.push(text.substring(start, i));
      start = i + 1;
    }
  }
  parts.push(text.substring(start));
  return parts;
}

function foldText(
  text: string,
  symbols: ConditionSymbols,
  message: "debug.wpmem.addressInvalid" | "debug.wpmem.lengthInvalid"
): { value: number } | { error: string } {
  try {
    return { value: foldConstant(parseDezogExpression(text), symbols) };
  } catch (err) {
    if (err instanceof ConditionSyntaxError || err instanceof FoldError) {
      return { error: t(message, { text, reason: err.message }) };
    }
    throw err;
  }
}

class FoldError extends Error {}

/**
 * The value of a DeZog expression made only of numbers, labels and operators, with C semantics on
 * 32-bit integers. Throws `FoldError` for anything that reads the machine.
 */
export function foldConstant(node: SyntaxNode, symbols: ConditionSymbols): number {
  switch (node.k) {
    case "num":
      return node.v;
    case "name": {
      if (!node.quoted) throw new FoldError(t("debug.wpmem.registerNotConstant", { name: node.name }));
      const value = symbols[node.name.toLowerCase()];
      if (value === undefined) throw new FoldError(t("debug.wpmem.unknownLabel", { name: node.name }));
      return value;
    }
    case "un": {
      const v = foldConstant(node.e, symbols);
      switch (node.op) {
        case "-":
          return -v | 0;
        case "~":
          return ~v;
        case "!":
          return v ? 0 : 1;
      }
      break;
    }
    case "bin": {
      const l = foldConstant(node.l, symbols);
      const r = foldConstant(node.r, symbols);
      switch (node.op) {
        case "+":
          return (l + r) | 0;
        case "-":
          return (l - r) | 0;
        case "*":
          return Math.imul(l, r);
        case "/":
          if (r === 0) throw new FoldError(t("debug.wpmem.divisionByZero"));
          return Math.trunc(l / r);
        case "%":
          if (r === 0) throw new FoldError(t("debug.wpmem.divisionByZero"));
          return l % r;
        case "&":
          return l & r;
        case "|":
          return l | r;
        case "^":
          return l ^ r;
        case "<<":
          return l << r;
        case ">>":
          return l >> r;
        case ">>>":
          return l >>> r;
        case "==":
          return l === r ? 1 : 0;
        case "!=":
          return l !== r ? 1 : 0;
        case "<":
          return l < r ? 1 : 0;
        case "<=":
          return l <= r ? 1 : 0;
        case ">":
          return l > r ? 1 : 0;
        case ">=":
          return l >= r ? 1 : 0;
        case "&&":
          return l && r ? 1 : 0;
        case "||":
          return l || r ? 1 : 0;
      }
      break;
    }
    case "mem":
      throw new FoldError(t("debug.wpmem.memoryRead"));
    case "machine":
      throw new FoldError(t("debug.wpmem.machineValue"));
  }
  throw new FoldError(t("debug.wpmem.notConstant"));
}
