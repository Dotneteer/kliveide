import { DiagnosticBag, type Span } from "../diagnostics";
import type { SourceFile } from "../syntax/source";
import {
  defaultOptions,
  OPTIONS_BY_NAME,
  OPTION_SPECS,
  parseNumber,
  type KBasicOptions,
  type OptionSpec,
  type OptionValue,
  type Target
} from "./options";

/** One option line of a file's header. */
export type HeaderOption = {
  /** The Klive option name (a NextBuild alias already translated). */
  name: string;
  /** As written; undefined for a bare flag name. */
  value?: string;
  span: Span;
  /** The NextBuild `'!` spelling, when the line used one. */
  alias?: string;
};

/** NextBuild's `'!name=value` header lines, translated (plan §5.4). */
const NEXTBUILD_ALIASES: Record<string, string> = {
  org: "origin",
  heap: "heap-size",
  opt: "optimize",
  pc: "nex-entry",
  sp: "nex-stack",
  bmp: "nex-loading-screen",
  codebank: "codebank-first-page",
  codebankpages: "codebank-pages",
  codewindow: "codebank-window",
  codewindowsize: "codebank-window-size",
  codebankdepth: "codebank-depth"
};

/** NextBuild header options Klive does not take, with what to use instead. */
const NEXTBUILD_UNSUPPORTED: Record<string, string> = {
  copy: "copy the output with a build script step instead",
  exe: "run the program with Klive's Run command",
  hdf: "Klive exports NEX files; use the NEX export",
  nb: "not needed",
  nosys: "not needed",
  module: "not supported",
  master: "use the project's build root",
  origin: "use '@origin",
  asm: "use '@emit-asm",
  nonex: "use '@output",
  noemu: "not needed"
};

/**
 * The option lines of a file's leading comment block (plan §5.1): every line before the first one
 * with code. `'@name value`, `REM @name value` and NextBuild's `'!name=value`; blank lines and
 * other comments may be mixed in.
 */
export function readHeader(file: SourceFile, diagnostics: DiagnosticBag): HeaderOption[] {
  const options: HeaderOption[] = [];
  const lines = file.text.split("\n");
  let offset = 0;
  for (const line of lines) {
    const lineStart = offset;
    offset += line.length + 1;
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const comment = /^(?:'|rem(?=\s|$))\s*(.*)$/i.exec(trimmed);
    if (!comment) break;
    const at = lineStart + line.indexOf(trimmed);
    const span = { file: file.index, start: at, end: lineStart + line.length };
    const body = comment[1];
    const klive = /^@([A-Za-z][A-Za-z0-9-]*)(?:\s*=?\s*(.*))?$/.exec(body);
    if (klive) {
      const value = stripComment(klive[2] ?? "");
      options.push({ name: klive[1].toLowerCase(), ...(value !== "" ? { value } : {}), span });
      continue;
    }
    const nextBuild = /^!([A-Za-z]+)\s*(?:=\s*(.*))?$/.exec(body);
    if (nextBuild) {
      const alias = nextBuild[1].toLowerCase();
      const name = NEXTBUILD_ALIASES[alias];
      const value = stripComment(nextBuild[2] ?? "");
      if (name) options.push({ name, ...(value !== "" ? { value } : {}), span, alias });
      else if (alias in NEXTBUILD_UNSUPPORTED) {
        diagnostics.warning("K011", `NextBuild's '!${alias} is not supported: ${NEXTBUILD_UNSUPPORTED[alias]}`, span);
      } else diagnostics.warning("K010", `Unknown NextBuild option '!${alias}`, span);
    }
  }
  return options;
}

/**
 * Only the build root's header is read (plan §5.1): a header in an `#include`d file is ignored, with
 * an info diagnostic on its first option line.
 */
export function reportIgnoredHeader(file: SourceFile, diagnostics: DiagnosticBag): void {
  const first = readHeader(file, new DiagnosticBag())[0];
  if (first) {
    diagnostics.info("K012", "Header options are read only from the build root; use #pragma in an included file", first.span);
  }
}

/** A trailing `' comment` after a value (not inside a quoted string). */
function stripComment(value: string): string {
  let inString = false;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '"') inString = !inString;
    else if (value[i] === "'" && !inString) return value.slice(0, i).trim();
  }
  return value.trim();
}

/**
 * Applies header options to a copy of `base`. An unknown name is a warning with a suggestion; a bad
 * value is an error and leaves the option as it was.
 */
export function applyHeader(base: KBasicOptions, header: HeaderOption[], diagnostics: DiagnosticBag): KBasicOptions {
  const options = cloneOptions(base);
  for (const h of header) {
    const spec = OPTIONS_BY_NAME.get(h.name);
    if (!spec) {
      const guess = suggestion(h.name);
      diagnostics.warning("K010", `Unknown option '@${h.name}'${guess ? `; did you mean '@${guess}'?` : ""}`, h.span);
      continue;
    }
    const value = parseValue(spec, h.value);
    if (value === undefined) {
      diagnostics.error("E001", `Invalid value '${h.value ?? ""}' for '@${h.name}': expected ${expectation(spec)}`, h.span);
      continue;
    }
    spec.apply(options, value);
  }
  return options;
}

function parseValue(spec: OptionSpec, raw: string | undefined): OptionValue | undefined {
  const text = raw?.trim();
  switch (spec.value.kind) {
    case "flag": {
      if (text === undefined) return true;
      const t = text.toLowerCase();
      if (["on", "true", "yes", "1"].includes(t)) return true;
      if (["off", "false", "no", "0"].includes(t)) return false;
      return undefined;
    }
    case "int": {
      const n = text === undefined ? undefined : parseNumber(text);
      return n !== undefined && n >= spec.value.min && n <= spec.value.max ? n : undefined;
    }
    case "enum": {
      const t = text?.toLowerCase();
      return t !== undefined && spec.value.values.includes(t) ? t : undefined;
    }
    case "text":
      return text ? unquote(text) : undefined;
    case "version":
      return text && /^\d+\.\d+\.\d+$/.test(text) ? text : undefined;
    case "list": {
      if (!text) return undefined;
      const items = splitList(text).map(unquote).filter((s) => s !== "");
      return items.length ? items : undefined;
    }
  }
}

function expectation(spec: OptionSpec): string {
  const v = spec.value;
  switch (v.kind) {
    case "flag":
      return "on or off";
    case "int":
      return `a number from ${v.min} to ${v.max}`;
    case "enum":
      return v.values.join(", ");
    case "text":
      return "a value";
    case "version":
      return "a version such as 3.0.0";
    case "list":
      return "a comma-separated list";
  }
}

function splitList(text: string): string[] {
  const items: string[] = [];
  let current = "";
  let inString = false;
  for (const c of text) {
    if (c === '"') inString = !inString;
    if (c === "," && !inString) {
      items.push(current.trim());
      current = "";
    } else current += c;
  }
  items.push(current.trim());
  return items;
}

function unquote(text: string): string {
  return /^".*"$/.test(text) ? text.slice(1, -1) : text;
}

/** The closest option name, when one is close enough to be a likely typo. */
function suggestion(name: string): string | undefined {
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const o of OPTION_SPECS) {
    const d = distance(name, o.name);
    if (d < bestDistance) {
      best = o.name;
      bestDistance = d;
    }
  }
  return bestDistance <= Math.max(2, Math.floor(name.length / 3)) ? best : undefined;
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

function cloneOptions(o: KBasicOptions): KBasicOptions {
  return {
    ...o,
    defines: [...o.defines],
    includePaths: [...o.includePaths],
    disabledWarnings: [...o.disabledWarnings],
    enabledWarnings: [...o.enabledWarnings],
    appendBlocks: [...o.appendBlocks],
    ...(o.codebankPages ? { codebankPages: [...o.codebankPages] } : {})
  };
}

// =================================================================================================
// Precedence (plan §5.2): IDE settings < project settings < header < #pragma < debug profile

/** The IDE's `zxbasic.*` settings (project settings over user settings, as the settings reader merges them). */
export type SettingsSource = (key: string) => unknown;

/** The options IDE and project settings give, before the header: the machine picks the target. */
export function optionsFromSettings(read: SettingsSource, machineId?: string): KBasicOptions {
  const target: Target = machineId === "zxnext" ? "next" : machineId === "sp128" ? "zx128k" : machineId === "spp3e" ? "zxplus3" : "zx48k";
  const o = defaultOptions(target);
  const num = (key: string) => {
    const v = read(key);
    return typeof v === "number" ? v : typeof v === "string" ? parseNumber(v) : undefined;
  };
  const bool = (key: string) => {
    const v = read(key);
    return v === true || v === "true" || v === 1;
  };
  const optimize = num("zxbasic.optimizationLevel");
  if (optimize !== undefined && optimize >= 0 && optimize <= 3) o.optimize = optimize;
  const origin = num("zxbasic.machineCodeOrigin");
  if (origin !== undefined) o.origin = origin & 0xffff;
  const heap = num("zxbasic.heapSize");
  if (heap !== undefined && heap >= 0) o.heapSize = heap;
  if (bool("zxbasic.oneAsArrayBaseIndex")) o.arrayBase = 1;
  if (bool("zxbasic.oneAsStringBaseIndex")) o.stringBase = 1;
  if (bool("zxbasic.debugMemory")) o.checkMemory = true;
  if (bool("zxbasic.debugArray")) o.checkBounds = true;
  if (bool("zxbasic.enableBreak")) o.breakKey = true;
  if (bool("zxbasic.explicitVariables")) o.requireDeclarations = true;
  if (bool("zxbasic.strictMode")) o.requireTypes = true;
  if (bool("zxbasic.sinclair")) OPTIONS_BY_NAME.get("sinclair-compatible")!.apply(o, true);
  return o;
}

/** The debug profile (plan §8.6, D11): optimisation capped at 1 unless the header set it. */
export function applyDebugProfile(options: KBasicOptions, header: HeaderOption[]): KBasicOptions {
  if (header.some((h) => h.name === "optimize")) return options;
  return { ...options, optimize: Math.min(options.optimize, 1), debugInfo: "full" };
}
