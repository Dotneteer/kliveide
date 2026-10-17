import { delimiter as pathDelimiter } from "path";

import type { HeaderOption } from "@main/kbasic/options/header";
import type { KBasicOptions } from "@main/kbasic/options/options";

/*
 * Klive's build options, as Boriel BASIC's `zxbc` arguments (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md`
 * §4.2). The options come from Klive's own pipeline - the `zxbasic.*` settings, then the build root's
 * `'@name value` header (NextBuild's `'!` aliases included) - so one source file builds under both
 * compilers. `.ai/boriel/options.md` is the human-readable table of this mapping.
 */

/** zxbc's `--arch` for Klive's targets. The +3 runs zxbc's generic 128K code. */
export const ZXBC_ARCH: Record<KBasicOptions["target"], string> = {
  zx48k: "zx48k",
  zx128k: "zx128k",
  zxplus3: "zx128k",
  next: "zxnext"
};

/**
 * Header options zxbc has no counterpart for. Each one the header sets is reported as a warning
 * and has no effect, rather than silently ignored.
 */
export const KLIVE_ONLY_OPTIONS: Record<string, string> = {
  "asm-dialect": "Boriel BASIC's ASM blocks are always in zxbasm dialect",
  "debug-info": "Boriel BASIC builds always write full debug information",
  "default-byref": "zxbc has no option for BYREF as the default",
  "codebank-window": "CODEBANK is Klive BASIC syntax; Boriel BASIC banks MODULEs instead",
  "codebank-window-size": "CODEBANK is Klive BASIC syntax; Boriel BASIC banks MODULEs instead",
  "codebank-first-page": "CODEBANK is Klive BASIC syntax; Boriel BASIC banks MODULEs instead",
  "codebank-pages": "CODEBANK is Klive BASIC syntax; Boriel BASIC banks MODULEs instead",
  "codebank-depth": "CODEBANK is Klive BASIC syntax; Boriel BASIC banks MODULEs instead",
  "nex-entry": "zxbc's NEX starts at the program's origin",
  "nex-loading-screen": "zxbc writes no NEX loading screen",
  "nex-core": "zxbc sets the NEX core version itself"
};

/**
 * Header options that decide how the IDE exports or runs the program rather than how it compiles,
 * so they mean the same under both compilers and need no zxbc argument for a build.
 */
export const EXPORT_OPTIONS = new Set(["output", "basic-loader", "autorun", "append-block"]);

/**
 * Options that map to zxbc arguments (or to extra files the build writes). Together with the two
 * sets above, every header option is accounted for; a unit test keeps it that way.
 */
export const MAPPED_OPTIONS = new Set([
  "target",
  "optimize",
  "optimize-for",
  "origin",
  "heap-size",
  "heap-address",
  "array-base",
  "string-base",
  "case-insensitive",
  "sinclair-compatible",
  "require-declarations",
  "require-types",
  "check-memory",
  "check-bounds",
  "break-key",
  "headerless",
  "zxnext",
  "define",
  "include-path",
  "disable-warning",
  "enable-warning",
  "expect-warnings",
  "emit-asm",
  "emit-ir",
  "emit-map",
  "nex-stack",
  "split-modules"
]);

export type ZxbcArguments = {
  arch: string;
  /** The option arguments (no program, output, debug or diagnostics paths). */
  args: string[];
  /** One message per header option that has no effect under Boriel BASIC. */
  warnings: { option: HeaderOption; message: string }[];
};

/**
 * The zxbc arguments for `options`; `header` names the options the source itself set, and
 * `sourceFolder` (the build root's folder) heads the module path.
 */
export function zxbcArgumentsFor(
  options: KBasicOptions,
  header: HeaderOption[],
  delimiter: string = pathDelimiter,
  sourceFolder?: string
): ZxbcArguments {
  const args: string[] = [];
  const arch = ZXBC_ARCH[options.target] ?? "zx48k";
  args.push("--arch", arch);
  args.push("-O", String(options.optimize));
  args.push("--opt-strategy", options.optimizeFor === "balanced" ? "auto" : options.optimizeFor);
  args.push("-S", String(options.origin));
  args.push("-H", String(options.heapSize));
  if (options.heapAddress !== undefined) args.push("--heap-address", String(options.heapAddress));
  if (options.sinclairCompatible) {
    // --- -Z sets both bases to 1 and makes identifiers case-insensitive, as the Klive option does
    args.push("-Z");
  } else {
    args.push("--array-base", String(options.arrayBase), "--string-base", String(options.stringBase));
    if (options.caseInsensitive) args.push("-i");
  }
  if (options.requireDeclarations) args.push("--explicit");
  if (options.requireTypes) args.push("--strict");
  if (options.checkMemory) args.push("--debug-memory");
  if (options.checkBounds) args.push("--debug-array");
  if (options.breakKey) args.push("--enable-break");
  if (options.headerless) args.push("--headerless");
  if (options.zxnext && arch !== "zxnext") args.push("-N");
  for (const d of options.defines) args.push("-D", d.value !== undefined ? `${d.name}=${d.value}` : d.name);
  // --- One list: a repeated -I keeps only the last one (B0). zxbc's help says colon-separated;
  // --- Windows paths hold colons, so there the platform's ";" is used (to verify on Windows)
  if (options.includePaths.length) args.push("-I", options.includePaths.join(delimiter));
  for (const code of options.disabledWarnings) args.push("-W", warningNumber(code));
  for (const code of options.enabledWarnings) args.push(`+W`, warningNumber(code));
  if (options.expectWarnings !== undefined) args.push("--expect-warnings", String(options.expectWarnings));
  if (options.nexStack !== undefined && arch === "zxnext") args.push("--set:nex:sp", String(options.nexStack));
  // --- USE finds modules only on the module path, which is zxbc's cwd unless -m says otherwise (B5):
  // --- the source's own folder first, then the include folders
  if (sourceFolder) args.push("-m", [sourceFolder, ...options.includePaths].join(delimiter));

  const warnings: ZxbcArguments["warnings"] = [];
  // --- The 48K has no banks: zxbc rejects the flag there, so a build without it is the useful answer
  if (options.splitModules) {
    if (arch === "zx48k") {
      const option = header.find((h) => h.name === "split-modules");
      if (option) warnings.push({ option, message: "'@split-modules has no effect on this machine: it has no RAM banks." });
    } else {
      args.push("--split-modules");
    }
  }
  for (const option of header) {
    const reason = KLIVE_ONLY_OPTIONS[option.name];
    // --- The zxbasm dialect is Boriel's own, so asking for it explicitly needs no warning
    if (option.name === "asm-dialect" && options.asmDialect === "zxbasm") continue;
    if (reason) warnings.push({ option, message: `'@${option.name} has no effect with Boriel BASIC: ${reason}.` });
  }
  return { arch, args, warnings };
}

/** "W150" or "150" → "150", as zxbc's -W and +W take it. */
function warningNumber(code: string): string {
  return code.replace(/^W/i, "");
}
