/**
 * Klive BASIC's compile options (plan §5.3): what the header's `'@name value` lines, the project and
 * IDE settings and `#pragma` lines set. Every upstream `zxbc` option is either here, dropped (plan
 * §5.3 lists why) or replaced by an IDE feature.
 */
export type Target = "next" | "zx48k" | "zx128k" | "zxplus3";

export type KBasicOptions = {
  target: Target;
  optimize: number;
  optimizeFor: "speed" | "size" | "balanced";
  origin: number;
  heapSize: number;
  heapAddress?: number;
  arrayBase: number;
  stringBase: number;
  caseInsensitive: boolean;
  sinclairCompatible: boolean;
  requireDeclarations: boolean;
  requireTypes: boolean;
  defaultByref: boolean;
  checkMemory: boolean;
  checkBounds: boolean;
  breakKey: boolean;
  headerless: boolean;
  defines: { name: string; value?: string }[];
  includePaths: string[];
  disabledWarnings: string[];
  enabledWarnings: string[];
  expectWarnings?: number;
  output: "bin" | "tap" | "tzx" | "nex" | "sna" | "z80";
  basicLoader: boolean;
  autorun: boolean;
  appendBlocks: { file: string; headless: boolean }[];
  emitAsm: boolean;
  emitIr: boolean;
  emitMap: boolean;
  debugInfo: "full" | "lines" | "none";
  asmDialect: "klive" | "zxbasm";
  codebankWindow: number;
  codebankWindowSize: "8k" | "16k";
  codebankFirstPage: number;
  codebankPages?: number[];
  codebankDepth: number;
  nexEntry?: number;
  nexStack?: number;
  nexLoadingScreen?: string;
  nexCore: string;
};

export function defaultOptions(target: Target = "zx48k"): KBasicOptions {
  return {
    target,
    optimize: 2,
    optimizeFor: "balanced",
    origin: 0x8000,
    heapSize: 4768,
    arrayBase: 0,
    stringBase: 0,
    caseInsensitive: false,
    sinclairCompatible: false,
    requireDeclarations: false,
    requireTypes: false,
    defaultByref: false,
    checkMemory: false,
    checkBounds: false,
    breakKey: false,
    headerless: false,
    defines: [],
    includePaths: [],
    disabledWarnings: [],
    enabledWarnings: [],
    output: target === "next" ? "nex" : "bin",
    basicLoader: false,
    autorun: false,
    appendBlocks: [],
    emitAsm: false,
    emitIr: false,
    emitMap: false,
    debugInfo: "full",
    asmDialect: "klive",
    codebankWindow: 0x6000,
    codebankWindowSize: "8k",
    codebankFirstPage: 30,
    codebankDepth: 16,
    nexCore: "3.0.0"
  };
}

/** How an option's value is written and checked. */
export type OptionKind =
  | { kind: "flag" }
  | { kind: "int"; min: number; max: number }
  | { kind: "enum"; values: readonly string[] }
  | { kind: "text" }
  | { kind: "list" }
  | { kind: "version" };

export type OptionSpec = {
  name: string;
  value: OptionKind;
  describe: string;
  apply(options: KBasicOptions, value: OptionValue): void;
};

export type OptionValue = boolean | number | string | string[];

const ADDRESS = { kind: "int", min: 0, max: 0xffff } as const;
const flag = { kind: "flag" } as const;

const set =
  <K extends keyof KBasicOptions>(key: K) =>
  (o: KBasicOptions, v: OptionValue) => {
    (o as Record<string, unknown>)[key] = v;
  };

/** The header options, by name (plan §5.3). */
export const OPTION_SPECS: readonly OptionSpec[] = [
  { name: "target", value: { kind: "enum", values: ["next", "zx48k", "zx128k", "zxplus3"] }, describe: "the machine to compile for", apply: set("target") },
  { name: "optimize", value: { kind: "int", min: 0, max: 3 }, describe: "optimisation level 0-3", apply: set("optimize") },
  { name: "optimize-for", value: { kind: "enum", values: ["speed", "size", "balanced"] }, describe: "optimisation strategy", apply: set("optimizeFor") },
  { name: "origin", value: ADDRESS, describe: "the program's start address", apply: set("origin") },
  { name: "heap-size", value: { kind: "int", min: 0, max: 0xffff }, describe: "heap size in bytes", apply: set("heapSize") },
  { name: "heap-address", value: ADDRESS, describe: "a fixed heap address", apply: set("heapAddress") },
  { name: "array-base", value: { kind: "int", min: 0, max: 1 }, describe: "the default lower bound of arrays", apply: set("arrayBase") },
  { name: "string-base", value: { kind: "int", min: 0, max: 1 }, describe: "the index of a string's first character", apply: set("stringBase") },
  { name: "case-insensitive", value: flag, describe: "identifiers ignore case", apply: set("caseInsensitive") },
  {
    name: "sinclair-compatible",
    value: flag,
    describe: "Sinclair BASIC compatibility",
    apply: (o, v) => {
      o.sinclairCompatible = v as boolean;
      if (v) {
        o.arrayBase = 1;
        o.stringBase = 1;
        o.caseInsensitive = true;
      }
    }
  },
  { name: "require-declarations", value: flag, describe: "variables must be declared (--explicit)", apply: set("requireDeclarations") },
  { name: "require-types", value: flag, describe: "declarations must name a type (--strict)", apply: set("requireTypes") },
  { name: "default-byref", value: flag, describe: "scalar parameters default to BYREF", apply: set("defaultByref") },
  { name: "check-memory", value: flag, describe: "stop with 'Out of memory' when the heap is full", apply: set("checkMemory") },
  { name: "check-bounds", value: flag, describe: "check array subscripts", apply: set("checkBounds") },
  { name: "break-key", value: flag, describe: "BREAK stops the program", apply: set("breakKey") },
  { name: "headerless", value: flag, describe: "no program start-up and END code", apply: set("headerless") },
  {
    name: "define",
    value: { kind: "list" },
    describe: "macros: NAME or NAME=value",
    apply: (o, v) => {
      for (const item of v as string[]) {
        const m = /^([A-Za-z_]\w*)(?:\s*=\s*(.*))?$/.exec(item);
        if (m) o.defines.push(m[2] !== undefined ? { name: m[1], value: m[2] } : { name: m[1] });
      }
    }
  },
  { name: "include-path", value: { kind: "list" }, describe: "folders searched by #include", apply: (o, v) => o.includePaths.push(...(v as string[])) },
  { name: "disable-warning", value: { kind: "list" }, describe: "warnings not to report", apply: (o, v) => o.disabledWarnings.push(...(v as string[]).map(warningCode)) },
  { name: "enable-warning", value: { kind: "list" }, describe: "warnings to report", apply: (o, v) => o.enabledWarnings.push(...(v as string[]).map(warningCode)) },
  { name: "expect-warnings", value: { kind: "int", min: 0, max: 0xffff }, describe: "the number of warnings expected", apply: set("expectWarnings") },
  { name: "output", value: { kind: "enum", values: ["bin", "tap", "tzx", "nex", "sna", "z80"] }, describe: "the output format", apply: set("output") },
  { name: "basic-loader", value: flag, describe: "add a BASIC loader", apply: set("basicLoader") },
  { name: "autorun", value: flag, describe: "start the program after loading", apply: set("autorun") },
  {
    name: "append-block",
    value: { kind: "list" },
    describe: "files appended to the tape: file or headless:file",
    apply: (o, v) => {
      for (const item of v as string[]) {
        const headless = /^headless:/i.test(item);
        o.appendBlocks.push({ file: headless ? item.slice(9) : item, headless });
      }
    }
  },
  { name: "emit-asm", value: flag, describe: "write the generated assembly", apply: set("emitAsm") },
  { name: "emit-ir", value: flag, describe: "write the intermediate code", apply: set("emitIr") },
  { name: "emit-map", value: flag, describe: "write the label map", apply: set("emitMap") },
  { name: "debug-info", value: { kind: "enum", values: ["full", "lines", "none"] }, describe: "the debug information produced", apply: set("debugInfo") },
  { name: "asm-dialect", value: { kind: "enum", values: ["klive", "zxbasm"] }, describe: "the dialect of ASM blocks", apply: set("asmDialect") },
  { name: "codebank-window", value: ADDRESS, describe: "the CODEBANK window's address", apply: set("codebankWindow") },
  { name: "codebank-window-size", value: { kind: "enum", values: ["8k", "16k"] }, describe: "the CODEBANK window's size", apply: set("codebankWindowSize") },
  { name: "codebank-first-page", value: { kind: "int", min: 0, max: 223 }, describe: "the 8K page of CODEBANK 1", apply: set("codebankFirstPage") },
  {
    name: "codebank-pages",
    value: { kind: "list" },
    describe: "the 8K pages of the CODEBANKs",
    apply: (o, v) => {
      o.codebankPages = (v as string[]).map((p) => parseNumber(p) ?? -1);
    }
  },
  { name: "codebank-depth", value: { kind: "int", min: 1, max: 255 }, describe: "far-call nesting depth", apply: set("codebankDepth") },
  { name: "nex-entry", value: ADDRESS, describe: "the NEX entry address", apply: set("nexEntry") },
  { name: "nex-stack", value: ADDRESS, describe: "the NEX stack address", apply: set("nexStack") },
  { name: "nex-loading-screen", value: { kind: "text" }, describe: "the NEX loading screen file", apply: set("nexLoadingScreen") },
  { name: "nex-core", value: { kind: "version" }, describe: "the minimum core version of the NEX", apply: set("nexCore") }
];

export const OPTIONS_BY_NAME = new Map(OPTION_SPECS.map((o) => [o.name, o]));

/** `W150` or `150` -> `W150`. */
function warningCode(text: string): string {
  return /^\d+$/.test(text) ? `W${text}` : text.toUpperCase();
}

/** A number in decimal, `$hex`, `0xhex` or `%binary`; undefined when it is not one. */
export function parseNumber(text: string): number | undefined {
  const t = text.trim();
  if (/^-?\d+$/.test(t)) return Number(t);
  if (/^\$[0-9A-Fa-f]+$/.test(t)) return parseInt(t.slice(1), 16);
  if (/^0x[0-9A-Fa-f]+$/i.test(t)) return parseInt(t.slice(2), 16);
  if (/^%[01]+$/.test(t)) return parseInt(t.slice(1), 2);
  return undefined;
}
