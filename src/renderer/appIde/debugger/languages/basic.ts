import type { SourceValueType } from "@abstractions/SourceDebugInfo";
import { t as translate } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";
import { DiagnosticBag } from "@main/kbasic/diagnostics";
import type { Argument, Expression } from "@main/kbasic/syntax/ast";
import { lex } from "@main/kbasic/syntax/lexer";
import { parseExpression } from "@main/kbasic/syntax/parser";
import { SourceFile } from "@main/kbasic/syntax/source";

import { formatReal, spectrumChar, type DebugLanguageSupport, type WatchBuiltin } from "../source/language-support";
import type { WatchBinaryOp, WatchExpr } from "../source/watch-ast";

/**
 * The source-level debugger's ZX BASIC (`language: "basic"`: Klive BASIC and Boriel BASIC; plan
 * §10.7, §10.8, `.plans/SHARED_Z80_BACKEND_PLAN.md` §12.4). Watches are parsed by Klive BASIC's own
 * expression parser and turned into the neutral watch AST with BASIC's meanings: `/` divides
 * exactly, `MOD` is the remainder of the magnitudes (`-100 MOD 3` is 1, as the compiled program
 * computes it), `+` joins strings, comparisons and logic give 1 or 0. Values are written
 * as BASIC writes them: `TRUE`/`FALSE`, strings in BASIC's escapes, arrays as `Integer(0 TO 9)`.
 */

/**
 * A string's characters as BASIC source text, in double quotes: the Spectrum's character set (`£`
 * for 96, `©` for 127), and every other code in the escape form the compiler reads (`\A` for a UDG,
 * `\#013` for the rest).
 */
export function spectrumText(codes: number[], truncated = false): string {
  let out = "";
  for (const c of codes) {
    if (c === 34) out += '""';
    else if (c === 92) out += "\\\\";
    else if (spectrumChar(c) !== undefined) out += spectrumChar(c);
    else if (c >= 144 && c <= 164) out += "\\" + String.fromCharCode(65 + c - 144);
    else out += `\\#${c.toString().padStart(3, "0")}`;
  }
  return `"${out}${truncated ? "…" : ""}"`;
}

/** PEEK's type argument: the representation and the type's name. */
const PEEK_TYPES: Record<string, [SourceValueType, string]> = {
  BYTE: ["i8", "Byte"],
  UBYTE: ["u8", "UByte"],
  INTEGER: ["i16", "Integer"],
  UINTEGER: ["u16", "UInteger"],
  LONG: ["i32", "Long"],
  ULONG: ["u32", "ULong"],
  FIXED: ["fix16.16", "Fixed"],
  FLOAT: ["float40", "Float"],
  STRING: ["str.heap", "String"]
};

const OPS: Record<string, { op: WatchBinaryOp; extra?: Partial<Extract<WatchExpr, { kind: "binary" }>> }> = {
  "+": { op: "add", extra: { concatStrings: true } },
  "-": { op: "sub" },
  "*": { op: "mul" },
  "/": { op: "div", extra: { mode: "real" } },
  "^": { op: "pow" },
  MOD: { op: "mod", extra: { mode: "magnitude" } },
  "=": { op: "eq" },
  "<>": { op: "ne" },
  "<": { op: "lt" },
  ">": { op: "gt" },
  "<=": { op: "le" },
  ">=": { op: "ge" },
  AND: { op: "and" },
  OR: { op: "or" },
  XOR: { op: "xor" },
  BAND: { op: "band" },
  BOR: { op: "bor" },
  BXOR: { op: "bxor" },
  SHL: { op: "shl" },
  SHR: { op: "shr" }
};

const unsupported = (key: MessageKey, values?: Record<string, string>): WatchExpr => ({ kind: "unsupported", message: translate(key, values) });

function subscripts(args: Argument[]): WatchExpr[] | WatchExpr {
  const out: WatchExpr[] = [];
  for (const a of args) {
    if (a.kind !== "arg") return unsupported("panels.side.watchExpr.slices");
    out.push(toWatch(a.value));
  }
  return out;
}

/** A Klive BASIC expression as a neutral watch expression. */
function toWatch(e: Expression): WatchExpr {
  switch (e.kind) {
    case "number":
      return { kind: "number", value: e.value };
    case "string":
      return { kind: "string", value: e.value };
    case "paren":
      return toWatch(e.expression);
    case "name":
      return { kind: "variable", name: e.name };
    case "call": {
      if (e.callee.kind !== "name") return unsupported("panels.side.watchExpr.onlyArrays");
      const subs = subscripts(e.args);
      return Array.isArray(subs) ? { kind: "element", name: e.callee.name, subscripts: subs } : subs;
    }
    case "addressOf": {
      const t = e.target;
      if (t.kind === "name") return { kind: "addressOf", target: { kind: "variable", name: t.name }, type: "u16", typeLabel: "UInteger" };
      if (t.callee.kind !== "name") return unsupported("panels.side.watchExpr.invalidAddressOf");
      const subs = subscripts(t.args);
      if (!Array.isArray(subs)) return subs;
      return { kind: "addressOf", target: { kind: "element", name: t.callee.name, subscripts: subs }, type: "u16", typeLabel: "UInteger" };
    }
    case "unary":
      return {
        kind: "unary",
        op: e.op === "-" ? "neg" : e.op === "+" ? "plus" : e.op === "NOT" ? "not" : "bitnot",
        operand: toWatch(e.operand)
      };
    case "binary": {
      const { op, extra } = OPS[e.op];
      return { kind: "binary", op, left: toWatch(e.left), right: toWatch(e.right), ...extra };
    }
    case "builtin": {
      if (e.name === "PEEK") {
        if (!e.args[0]) return unsupported("panels.side.watchExpr.needsArgument", { name: e.name });
        const [type, typeLabel] = e.type ? PEEK_TYPES[e.type.name] : ["u8", "UByte"];
        return { kind: "peek", address: toWatch(e.args[0]), type, typeLabel };
      }
      return { kind: "builtin", name: e.name, args: e.args.map(toWatch) };
    }
    default:
      return unsupported("panels.side.watchExpr.unsupportedExpression");
  }
}

const needs = (name: string, args: unknown[], fail: (m: string) => never) =>
  args.length ? undefined : fail(translate("panels.side.watchExpr.needsArgument", { name }));

const BUILTINS: Record<string, WatchBuiltin> = {
  LEN: (args, fail) => {
    needs("LEN", args, fail);
    const v = args[0];
    return v.kind === "string" ? { kind: "number", value: v.value.length } : fail(translate("panels.side.watchExpr.needsString", { name: "LEN" }));
  },
  CODE: (args, fail) => {
    needs("CODE", args, fail);
    const v = args[0];
    return v.kind === "string"
      ? { kind: "number", value: v.value.length ? v.value.charCodeAt(0) : 0 }
      : fail(translate("panels.side.watchExpr.needsString", { name: "CODE" }));
  },
  CHR: (args, fail) => ({
    kind: "string",
    value: args.map((a) => (a.kind === "number" ? String.fromCharCode(a.value & 0xff) : fail(translate("panels.side.watchExpr.numberExpected")))).join("")
  }),
  ABS: (args, fail) => ({ kind: "number", value: Math.abs(number(args, "ABS", fail)) }),
  SGN: (args, fail) => ({ kind: "number", value: Math.sign(number(args, "SGN", fail)) }),
  INT: (args, fail) => ({ kind: "number", value: Math.floor(number(args, "INT", fail)) })
};

function number(args: { kind: string; value: unknown }[], name: string, fail: (m: string) => never): number {
  needs(name, args, fail);
  return args[0].kind === "number" ? (args[0].value as number) : fail(translate("panels.side.watchExpr.numberExpected"));
}

export const BASIC_LANGUAGE: DebugLanguageSupport = {
  id: "basic",
  parseWatch(text) {
    const diagnostics = new DiagnosticBag();
    const file = new SourceFile(0, "watch", text);
    const { tokens } = lex(file, diagnostics);
    const expression = diagnostics.hasErrors ? undefined : parseExpression(tokens, diagnostics);
    if (!expression) return { error: diagnostics.items.find((d) => d.severity === "error")?.message ?? translate("panels.side.watchExpr.invalidExpression") };
    return { expression: toWatch(expression) };
  },
  builtins: BUILTINS,
  // --- BASIC names are matched exactly first, then without regard to case
  caseInsensitiveNames: true,
  formatValue(raw) {
    switch (raw.kind) {
      case "bool":
        return raw.value ? "TRUE" : "FALSE";
      case "real":
        return formatReal(raw.value);
      case "text":
        return spectrumText(raw.codes, raw.truncated);
      default:
        return undefined;
    }
  },
  constantTypeLabel: (typeLabel) => `CONST ${typeLabel}`,
  arrayTypeLabel: (elementLabel, dimensions) =>
    `${elementLabel}(${dimensions.map((d) => (d.count === undefined ? `${d.lower} TO ?` : `${d.lower} TO ${d.lower + d.count - 1}`)).join(", ")})`,
  elementName: (name, subscripts, partial) => `${name}(${subscripts.join(", ")}${partial ? ", …" : ""})`,
  localActivationLabel: (label) => (label === undefined ? "GOSUB" : `GOSUB ${label}`)
};
