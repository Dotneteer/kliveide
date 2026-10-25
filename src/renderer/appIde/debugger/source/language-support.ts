import { t as translate } from "@common/i18n/i18n";

import type { MemoryView } from "./value-decoder";
import type { WatchExpr, WatchValue } from "./watch-ast";

/**
 * What the source-level debugger asks of a language (`.plans/SHARED_Z80_BACKEND_PLAN.md` §12.4).
 *
 * The debugger's core — the debug model, stepping, the call stack, the Variables panel, value
 * decoding and watch evaluation — knows machine and calling-convention facts only. Everything a
 * language decides is asked here: how a value is written, what a watch means, how a local
 * subroutine and an array type are labelled. A language without a plugin gets the neutral defaults
 * below (and no watch expressions). Plugins live in `../languages/` and are found through its
 * registry by `SourceLevelDebugInfo.language`.
 */

/** A value decoded from memory or registers, before a language writes it as text. */
export type RawValue =
  | { kind: "int"; value: number }
  | { kind: "real"; value: number }
  | { kind: "bool"; value: boolean }
  /** A character code shown with its character (C's `char`). */
  | { kind: "char"; value: number }
  /** A 16-bit address. */
  | { kind: "address"; value: number }
  /** Character codes of a string; `truncated` when only the first ones were read. */
  | { kind: "text"; codes: number[]; truncated: boolean }
  /** Bytes of a representation nobody has a decoder for. */
  | { kind: "bytes"; bytes: number[] };

/** Decodes and encodes one representation. */
export type ValueDecoder = {
  /** Bytes the value occupies where it is stored. */
  size: number;
  decode(bytes: number[], mem: MemoryView): RawValue;
  /** The bytes of a new value given as a number (editing in the Variables panel); undefined: not editable. */
  encode?(value: number | boolean): number[] | "range" | "whole";
  /** Its range, for the editor's messages. */
  range?: [number, number];
};

/** A watch built-in: evaluated over neutral values. */
export type WatchBuiltin = (args: WatchValue[], fail: (message: string) => never) => WatchValue;

export type DebugLanguageSupport = {
  /** `SourceLevelDebugInfo.language`. */
  id: string;
  /** Parses a watch into the neutral watch AST; absent: the language has no watch expressions. */
  parseWatch?(text: string): { expression: WatchExpr } | { error: string };
  /** The built-ins its parser produces calls to. */
  builtins?: Record<string, WatchBuiltin>;
  /** Whether a name may match a variable case-insensitively when no exact match exists. */
  caseInsensitiveNames?: boolean;
  /** A value as this language writes it; undefined falls back to the neutral form. */
  formatValue?(raw: RawValue): string | undefined;
  /** A constant's type column (`CONST Integer`). */
  constantTypeLabel?(typeLabel: string): string;
  /** An array's type column from its element type and bounds (`count` undefined: unknown). */
  arrayTypeLabel?(elementLabel: string, dimensions: { lower: number; count?: number }[]): string;
  /** An array element's (or a partial subscript list's) name. */
  elementName?(name: string, subscripts: number[], partial: boolean): string;
  /** The call stack's name of a local activation (entered by a `local` call), given the nearest label. */
  localActivationLabel?(label: string | undefined): string;
  /** Decoders for representations only this language uses. */
  decoders?: Record<string, ValueDecoder>;
};

/** The neutral language: what the debugger shows for a language without a plugin. */
export const NEUTRAL_LANGUAGE: DebugLanguageSupport = { id: "" };

/** A real number with at most ten significant digits (the precision the ROM's float carries). */
export function formatReal(x: number): string {
  if (!Number.isFinite(x)) return String(x);
  return String(Number(x.toPrecision(10)));
}

/** A ZX Spectrum character as Unicode where one exists (`£` for 96, `©` for 127), else undefined. */
export function spectrumChar(code: number): string | undefined {
  if (code === 96) return "£";
  if (code === 127) return "©";
  return code >= 32 && code < 127 ? String.fromCharCode(code) : undefined;
}

function neutralText(codes: number[], truncated: boolean): string {
  let out = "";
  for (const c of codes) {
    if (c === 34) out += '\\"';
    else if (c === 92) out += "\\\\";
    else out += spectrumChar(c) ?? `\\x${c.toString(16).padStart(2, "0")}`;
  }
  return `"${out}${truncated ? "…" : ""}"`;
}

/** A value as `lang` writes it, or in the neutral form. */
export function formatRaw(lang: DebugLanguageSupport, raw: RawValue): string {
  const own = lang.formatValue?.(raw);
  if (own !== undefined) return own;
  switch (raw.kind) {
    case "int":
      return String(raw.value);
    case "real":
      return formatReal(raw.value);
    case "bool":
      return raw.value ? "true" : "false";
    case "char": {
      const ch = raw.value & 0xff;
      return ch >= 32 && ch < 127 ? `${raw.value} '${String.fromCharCode(ch)}'` : String(raw.value);
    }
    case "address":
      return `$${raw.value.toString(16).toUpperCase().padStart(4, "0")}`;
    case "text":
      return neutralText(raw.codes, raw.truncated);
    case "bytes":
      return raw.bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
  }
}

export function constantTypeLabel(lang: DebugLanguageSupport, typeLabel: string): string {
  return lang.constantTypeLabel?.(typeLabel) ?? `const ${typeLabel}`;
}

export function arrayTypeLabel(lang: DebugLanguageSupport, elementLabel: string, dimensions: { lower: number; count?: number }[]): string {
  return (
    lang.arrayTypeLabel?.(elementLabel, dimensions) ??
    `${elementLabel}${dimensions.map((d) => `[${d.count === undefined ? `${d.lower}..?` : `${d.lower}..${d.lower + d.count - 1}`}]`).join("")}`
  );
}

export function elementName(lang: DebugLanguageSupport, name: string, subscripts: number[], partial: boolean): string {
  return lang.elementName?.(name, subscripts, partial) ?? `${name}${subscripts.map((s) => `[${s}]`).join("")}${partial ? "[…]" : ""}`;
}

export function localActivationLabel(lang: DebugLanguageSupport, label: string | undefined): string {
  return lang.localActivationLabel?.(label) ?? (label === undefined ? translate("panels.side.callStack.localRoutine") : translate("panels.side.callStack.localRoutineAt", { label }));
}
