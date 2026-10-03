import type { LogDialect } from "@abstractions/BreakpointInfo";
import type {
  CompiledCondition,
  CondNode,
  ConditionDiagnostic,
  ConditionEnvironment,
  ConditionRegister,
  ConditionSymbols
} from "./condition-types";
import { ConditionSyntaxError } from "./condition-lexer";
import { parseCondition, type SyntaxNode } from "./condition-parser";
import { bindCondition, compileConditionWith } from "./condition-checker";
import { usesConditionEnv } from "./condition-bytecode";
import { parseDezogExpression } from "./dezog/dezog-parser";

/*
 * Logpoint message templates (`.plans/LOGPOINTS_PLAN.md` §3).
 *
 * A template is literal text with placeholders. Two dialects, chosen by where the logpoint came from
 * (L6), compile to the same thing - literal segments and `(compiled expression, format)` pairs - and
 * every expression is checked by the condition checker and evaluated by the C evaluator, so there is
 * one expression engine whichever surface a template was typed into:
 *
 * - **Klive** (what the user types): `{expr[:format]}`, `{{` and `}}` for literal braces; the
 *   expression is a full breakpoint condition (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §3).
 * - **DeZog** (a `LOGPOINT` source comment): `${expr[:format]}`; every other character, a lone `$`
 *   or `{` included, is literal. The expression is DeZog's (`dezog/dezog-parser.ts`).
 *
 * A leading `[NAME]` is the logpoint's group (L11) in both dialects and is not printed.
 *
 * Imports no machine and no renderer code: the IDE compiles a template to validate what is typed,
 * the emulator to arm it.
 */

/** The formats a placeholder can name (§3.3). */
export const LOG_FORMATS = [
  "hex8",
  "hex16",
  "int8",
  "int16",
  "uint8",
  "uint16",
  "bits",
  "string"
] as const;

export type LogFormat = (typeof LOG_FORMATS)[number];

/** The group of a logpoint whose template names none. */
export const DEFAULT_LOG_GROUP = "DEFAULT";

/** At most this many bytes are read for the `string` format (Q8). */
export const LOG_STRING_MAX = 64;

/** How a value without an explicit format is printed (Q2). */
export type LogDefaultFormat =
  | { kind: "hex"; digits: number }
  | { kind: "flag" }
  | { kind: "decimal" };

export type LogTemplateSegment =
  | { k: "text"; text: string }
  | {
      k: "value";
      /** The expression as written, for messages. */
      source: string;
      compiled: CompiledCondition;
      format?: LogFormat;
      /** Used when `format` is absent. */
      fallback: LogDefaultFormat;
      /** The program reads a fact the emulator writes first (the clock, the frame counter). */
      usesEnv: boolean;
    }
  | { k: "slots" };

export type CompiledLogTemplate = {
  source: string;
  dialect: LogDialect;
  /** Upper-case; `DEFAULT` when the template names none. */
  group: string;
  segments: LogTemplateSegment[];
  /** A label a placeholder names is missing (C14): the logpoint is inactive until a build defines it. */
  inactiveReason?: string;
};

export type CompileLogTemplateResult = {
  /** Absent when `errors` is not empty. */
  template?: CompiledLogTemplate;
  errors: ConditionDiagnostic[];
  warnings: ConditionDiagnostic[];
};

const GROUP_PATTERN = /^\s*\[([A-Za-z0-9_.]+)\]\s*/;

/**
 * The group a template names, without compiling it: the leading `[NAME]`, upper-case, or `DEFAULT`.
 * The IDE lists and switches groups with this.
 */
export function logGroupOf(template: string | undefined): string {
  const match = GROUP_PATTERN.exec(template ?? "");
  return match ? match[1].toUpperCase() : DEFAULT_LOG_GROUP;
}

/**
 * Compile a template. The first error stops compilation (one diagnostic, with its range in the
 * template), as conditions do; label warnings accumulate. When `env.symbols` is given the result is
 * also bound against it.
 */
export function compileLogTemplate(
  text: string,
  dialect: LogDialect,
  env: ConditionEnvironment
): CompileLogTemplateResult {
  const warnings: ConditionDiagnostic[] = [];
  try {
    if (env.isZ80 === false) {
      throw new ConditionSyntaxError("Logpoints are supported on Z80 machines only", 0, text.length);
    }
    const groupMatch = GROUP_PATTERN.exec(text);
    const group = groupMatch ? groupMatch[1].toUpperCase() : DEFAULT_LOG_GROUP;
    const bodyStart = groupMatch ? groupMatch[0].length : 0;

    const segments: LogTemplateSegment[] = [];
    let literal = "";
    const flush = () => {
      if (literal) segments.push({ k: "text", text: literal });
      literal = "";
    };
    const placeholder = (innerStart: number, innerEnd: number, openStart: number) => {
      flush();
      segments.push(compilePlaceholder(text, innerStart, innerEnd, openStart, dialect, env, warnings));
    };

    let pos = bodyStart;
    while (pos < text.length) {
      const c = text[pos];
      if (dialect === "dezog") {
        if (c === "$" && text[pos + 1] === "{") {
          const close = text.indexOf("}", pos + 2);
          if (close < 0) {
            throw new ConditionSyntaxError("Unterminated placeholder: '${' has no '}'", pos, text.length);
          }
          placeholder(pos + 2, close, pos);
          pos = close + 1;
          continue;
        }
        literal += c;
        pos++;
        continue;
      }

      // --- Klive dialect
      if (c === "{") {
        if (text[pos + 1] === "{") {
          literal += "{";
          pos += 2;
          continue;
        }
        const close = findPlaceholderEnd(text, pos + 1);
        placeholder(pos + 1, close, pos);
        pos = close + 1;
        continue;
      }
      if (c === "}") {
        if (text[pos + 1] === "}") {
          literal += "}";
          pos += 2;
          continue;
        }
        throw new ConditionSyntaxError("A literal '}' is written '}}'", pos, pos + 1);
      }
      literal += c;
      pos++;
    }
    flush();

    const template: CompiledLogTemplate = { source: text, dialect, group, segments };
    if (env.symbols) bindLogTemplate(template, env.symbols);
    return { template, errors: [], warnings };
  } catch (err) {
    if (err instanceof ConditionSyntaxError) {
      return { errors: [err.toDiagnostic()], warnings };
    }
    throw err;
  }
}

/**
 * Bind every placeholder's labels to a symbol table, as `bindCondition` does for a condition. A
 * missing label anywhere makes the whole logpoint inactive (C14).
 */
export function bindLogTemplate(template: CompiledLogTemplate, symbols: ConditionSymbols): void {
  const missing: string[] = [];
  for (const segment of template.segments) {
    if (segment.k !== "value") continue;
    bindCondition(segment.compiled, symbols);
    segment.compiled.labels.forEach((key, slot) => {
      if (symbols[key] === undefined) {
        const name = segment.compiled.labelNames[slot];
        if (!missing.includes(name)) missing.push(name);
      }
    });
  }
  template.inactiveReason = missing.length
    ? `unknown label${missing.length > 1 ? "s" : ""} ${missing.join(", ")}`
    : undefined;
}

/** The closing `}` of a Klive placeholder opened before `from`, skipping quoted text. */
function findPlaceholderEnd(text: string, from: number): number {
  let pos = from;
  while (pos < text.length) {
    const c = text[pos];
    if (c === "}") return pos;
    // --- `'` right after AF/BC/DE/HL is a prime, not a quote
    if (c === "'" && /(af|bc|de|hl)$/i.test(text.substring(from, pos))) {
      pos++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      pos++;
      while (pos < text.length && text[pos] !== c) {
        if (text[pos] === "\\" && c !== "`") pos++;
        pos++;
      }
    }
    pos++;
  }
  throw new ConditionSyntaxError("Unterminated placeholder: '{' has no '}'", from - 1, text.length);
}

/**
 * The offset of the `:` that starts a placeholder's format, or -1. Only a **top-level** `:` followed
 * by a format name counts (§3.1), so `{b[05:$C010]}` and `{05:Flags}` keep their meaning; a
 * bank-local label whose name is a format name is written `{(05:hex8)}`.
 */
function formatColon(text: string, start: number, end: number, dialect: LogDialect): number {
  let depth = 0;
  let found = -1;
  for (let pos = start; pos < end; pos++) {
    const c = text[pos];
    if (c === '"' || c === "'" || c === "`") {
      // --- `'` right after AF/BC/DE/HL is a prime, not a quote
      if (c === "'" && /(af|bc|de|hl)$/i.test(text.substring(start, pos))) continue;
      pos++;
      while (pos < end && text[pos] !== c) {
        if (text[pos] === "\\" && c !== "`") pos++;
        pos++;
      }
      continue;
    }
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === ":" && depth === 0) {
      const name = text.substring(pos + 1, end).trim().toLowerCase();
      if ((LOG_FORMATS as readonly string[]).includes(name)) found = pos;
      else if (dialect === "dezog" || /^(hex|int|uint|bit|str)[a-z0-9]*$/.test(name)) {
        throw new ConditionSyntaxError(
          `Unknown format '${text.substring(pos + 1, end).trim()}'; use ${LOG_FORMATS.join(", ")}`,
          pos + 1,
          end
        );
      }
    }
  }
  return found;
}

function compilePlaceholder(
  text: string,
  innerStart: number,
  innerEnd: number,
  openStart: number,
  dialect: LogDialect,
  env: ConditionEnvironment,
  warnings: ConditionDiagnostic[]
): LogTemplateSegment {
  const colon = formatColon(text, innerStart, innerEnd, dialect);
  const exprEnd = colon >= 0 ? colon : innerEnd;
  const format =
    colon >= 0 ? (text.substring(colon + 1, innerEnd).trim().toLowerCase() as LogFormat) : undefined;
  const source = text.substring(innerStart, exprEnd);
  if (!source.trim()) {
    throw new ConditionSyntaxError("Empty placeholder", openStart, innerEnd + 1);
  }
  const parse: (t: string) => SyntaxNode =
    dialect === "dezog" ? parseDezogExpression : parseCondition;
  const shift = (d: ConditionDiagnostic): ConditionDiagnostic => ({
    ...d,
    start: d.start + innerStart,
    end: d.end + innerStart
  });

  // --- `slots()` is text: legal only as a whole placeholder (§3.5)
  let root: SyntaxNode | undefined;
  try {
    root = parse(source);
  } catch {
    root = undefined; // --- reported with its range by the compile below
  }
  if (root?.k === "machine" && root.fn === "slots") {
    if (format) {
      throw new ConditionSyntaxError(
        "The slot map is text; it takes no format",
        colon + 1,
        innerEnd
      );
    }
    return { k: "slots" };
  }

  const result = compileConditionWith(source, env, parse);
  warnings.push(...result.warnings.map(shift));
  if (!result.compiled) {
    const first = shift(result.errors[0]);
    throw new ConditionSyntaxError(first.message, first.start, first.end);
  }
  return {
    k: "value",
    source: source.trim(),
    compiled: result.compiled,
    ...(format ? { format } : {}),
    fallback: defaultFormatOf(result.compiled.tree),
    usesEnv: usesConditionEnv(result.compiled.tree)
  };
}

const EIGHT_BIT = new Set<ConditionRegister>([
  "A", "F", "B", "C", "D", "E", "H", "L", "I", "R", "XH", "XL", "YH", "YL"
]);

/**
 * How a value is printed without a format (Q2): a bare register, flag, access special (`VAL`,
 * `ADDR`) or unsigned memory access as `$` plus hex as wide as what it reads; a flag as 0/1;
 * anything else - an expression, a label, a signed access, a machine special - in decimal.
 */
export function defaultFormatOf(tree: CondNode): LogDefaultFormat {
  switch (tree.k) {
    case "reg":
      return { kind: "hex", digits: EIGHT_BIT.has(tree.r) ? 2 : 4 };
    case "flag":
      return { kind: "flag" };
    case "special":
      return { kind: "hex", digits: tree.s === "val" ? 2 : 4 };
    case "mem":
      return tree.signed ? { kind: "decimal" } : { kind: "hex", digits: tree.width * 2 };
    default:
      return { kind: "decimal" };
  }
}

// ------------------------------------------------------------------------------------------------
// Rendering

/** One placeholder's evaluation, as the emulator reports it. */
export type LogValue =
  | { status: "ok"; value: bigint }
  | { status: "noValue" }
  | { status: "divZero" }
  | { status: "error" };

/** What rendering needs from the machine besides each placeholder's value. */
export type LogRenderHost = {
  /** A side-effect-free read through the current paging (for `string`). */
  peek(address: number): number;
  /** The slot map text (`slots()`). */
  slots(): string;
};

const hex = (value: bigint, digits: number) =>
  BigInt.asUintN(digits * 4, value).toString(16).toUpperCase().padStart(digits, "0");

/** The ZX Spectrum characters that differ from ASCII, mapped back (Q8). */
function zxChar(code: number): string {
  switch (code) {
    case 0x60:
      return "£";
    case 0x7f:
      return "©";
    case 0x5e:
      return "↑";
  }
  return code >= 0x20 && code < 0x7f ? String.fromCharCode(code) : `\\x${hex(BigInt(code), 2)}`;
}

/** Print one value in a format (§3.3). */
export function formatLogValue(
  value: bigint,
  format: LogFormat | undefined,
  fallback: LogDefaultFormat,
  peek?: (address: number) => number
): string {
  switch (format) {
    case "hex8":
      return hex(value, 2);
    case "hex16":
      return hex(value, 4);
    case "uint8":
      return BigInt.asUintN(8, value).toString();
    case "uint16":
      return BigInt.asUintN(16, value).toString();
    case "int8":
      return BigInt.asIntN(8, value).toString();
    case "int16":
      return BigInt.asIntN(16, value).toString();
    case "bits":
      return value >= 0n && value < 256n
        ? BigInt.asUintN(8, value).toString(2).padStart(8, "0")
        : BigInt.asUintN(16, value).toString(2).padStart(16, "0");
    case "string": {
      if (!peek) return "<no memory>";
      const address = Number(BigInt.asUintN(16, value));
      let out = "";
      for (let i = 0; i < LOG_STRING_MAX; i++) {
        const code = peek((address + i) & 0xffff) & 0xff;
        if (code === 0) break;
        out += zxChar(code);
      }
      return out;
    }
  }
  switch (fallback.kind) {
    case "hex":
      return `$${hex(value, fallback.digits)}`;
    case "flag":
      return value !== 0n ? "1" : "0";
    default:
      return value.toString();
  }
}

/**
 * Fill in a compiled template. `evaluate` is asked for each value placeholder, in order, by its
 * index in `template.segments`.
 */
export function renderLogTemplate(
  template: CompiledLogTemplate,
  evaluate: (segmentIndex: number) => LogValue,
  host?: LogRenderHost
): string {
  let out = "";
  template.segments.forEach((segment, index) => {
    switch (segment.k) {
      case "text":
        out += segment.text;
        return;
      case "slots":
        out += host?.slots() ?? "";
        return;
      case "value": {
        const result = evaluate(index);
        switch (result.status) {
          case "ok":
            out += formatLogValue(result.value, segment.format, segment.fallback, host?.peek);
            return;
          case "noValue":
            out += "<no value>";
            return;
          case "divZero":
            out += "<division by zero>";
            return;
          default:
            out += "<error>";
        }
      }
    }
  });
  return out;
}
