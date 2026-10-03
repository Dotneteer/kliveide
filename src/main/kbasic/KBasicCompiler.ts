import fs from "fs";

import type { AssemblerErrorInfo, CompileProfile, DebuggableOutput, IKliveCompiler, SimpleAssemblerOutput } from "@abstractions/CompilerInfo";
import type { AppState } from "@common/state/AppState";

import { createSettingsReader } from "@common/utils/SettingsReader";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { effectiveLevel, generateProgram } from "./codegen";
import { emittedFiles } from "./emit-files";
import { lineCanHaveBreakpoint } from "./breakpoints";
import { DiagnosticBag, type Diagnostic } from "./diagnostics";
import { parseProgram, type FrontEndResult } from "./front-end";
import { applyHeader, optionsFromSettings, readHeader, reportIgnoredHeader, type HeaderOption } from "./options/header";
import type { KBasicOptions } from "./options/options";
import { bind, type BindResult } from "./semantics/binder";
import type { FileReader } from "./syntax/preprocessor";
import { SourceFile, type SourceSet } from "./syntax/source";
import { isLibraryPath } from "./stdlib";
import { extractBasicIntel } from "./intel/extract";
import type { BasicIntelData } from "@abstractions/BasicIntel";

export type KBasicFrontEndResult = FrontEndResult & {
  options: KBasicOptions;
  /** The build root's header option lines. */
  header: HeaderOption[];
  /** The typed program; undefined when the source has syntax errors, which would only cascade. */
  bound?: BindResult;
};

/**
 * Klive BASIC, Klive's own ZX BASIC compiler (plan §3). Phase 1 runs the front end only: header
 * options, preprocessor and parser. Its diagnostics feed the editor; a foreground build reports
 * them and then that code generation is not available yet.
 */
export class KBasicCompiler implements IKliveCompiler {
  private state: AppState | undefined;

  readonly id = "KBasicCompiler";
  readonly language = "zxbas";
  readonly providesKliveOutput = true;

  setAppState(state: AppState): void {
    this.state = state;
  }

  /** A build: until code generation exists, the front end's diagnostics and a note saying so. */
  compileFile(filename: string, _options?: Record<string, unknown>, profile?: CompileProfile): Promise<SimpleAssemblerOutput> {
    return this.run(filename, false, profile);
  }

  /** The editor's background diagnostics. */
  checkFile(filename: string): Promise<SimpleAssemblerOutput> {
    return this.run(filename, true);
  }

  private async run(filename: string, background: boolean, profile?: CompileProfile): Promise<SimpleAssemblerOutput> {
    const settings = this.state ? createSettingsReader(this.state) : undefined;
    const base = optionsFromSettings((key) => settings?.readSetting(key), this.state?.emulatorState?.machineId);
    let text: string;
    try {
      text = fs.readFileSync(filename, "utf8");
    } catch (err) {
      return { errors: [fileError(filename, "K002", `Cannot read the file: ${(err as Error).message}`)] };
    }
    try {
      const result = runFrontEnd(filename, text, fileSystemReader, base, undefined, { collectDefines: background });
      if (background) {
        // --- The editor's intel (plan E4): a root with an error keeps its last good snapshot
        const basicIntel = result.diagnostics.hasErrors ? undefined : extractBasicIntel(result);
        return { errors: toErrorInfo(result.diagnostics.items, result.sources), basicIntel: basicIntel ? [basicIntel] : [] } as SimpleAssemblerOutput;
      }
      if (result.diagnostics.hasErrors || !result.bound) {
        return { errors: toErrorInfo(result.diagnostics.items, result.sources) };
      }
      // --- The debug profile (plan §8.6, D11): optimisation capped at 1 unless the header asks for a level
      const capped = profile === "debug" && result.options.optimize > DEBUG_PROFILE_LEVEL && !headerSetsOptimize(filename, text);
      if (capped) result.options = { ...result.options, optimize: DEBUG_PROFILE_LEVEL };
      return await this.build(filename, result, capped);
    } catch (err) {
      // --- A worker that throws is reported as a success (plan §2.1), so a compiler bug is an error
      return { errors: [fileError(filename, "K000", `Internal compiler error: ${(err as Error).message}`)] };
    }
  }

  /**
   * The editor's intel for a file checked as a root of its own: the open `.zxbas` file the build
   * root does not include (plan E14). Undefined when it cannot be read or has errors.
   */
  analyseFile(filename: string): BasicIntelData | undefined {
    const settings = this.state ? createSettingsReader(this.state) : undefined;
    const base = optionsFromSettings((key) => settings?.readSetting(key), this.state?.emulatorState?.machineId);
    try {
      const text = fs.readFileSync(filename, "utf8");
      const result = runFrontEnd(filename, text, fileSystemReader, base, undefined, { collectDefines: true });
      return result.diagnostics.hasErrors ? undefined : extractBasicIntel(result);
    } catch {
      return undefined;
    }
  }

  /** Code generation (the 48K, 128K, +3 and Next targets, optimisation level 0). */
  private async build(filename: string, front: KBasicFrontEndResult, debugProfile = false): Promise<SimpleAssemblerOutput | DebuggableOutput> {
    const diagnostics = front.diagnostics;
    const model = targetModel(front.options.target);
    if (model === undefined) {
      diagnostics.error("E502", `Klive BASIC does not generate code for target '${front.options.target}'`, { file: 0, start: 0, end: 0 });
      return { errors: toErrorInfo(diagnostics.items, front.sources) };
    }
    const generated = await generateProgram(front.bound!, front.sources, front.options, programName(filename), diagnostics);
    const errors = toErrorInfo(diagnostics.items, front.sources);
    if (!generated) return { errors };
    const classic = generated.debug.classic;
    // --- '@emit-asm, '@emit-ir, '@emit-map: files beside the source (a failed write is a warning, not a failed build)
    const requested = front.options.optimize;
    const level = effectiveLevel(requested);
    const traceOutput = [
      `Klive BASIC: code generated at optimisation level ${level}${
        debugProfile
          ? " (the debug profile: debug builds use at most level 1 unless the header sets '@optimize)"
          : level !== requested
            ? ` (level ${requested} was asked for)`
            : ""
      }`
    ];
    const name = programName(filename);
    for (const file of emittedFiles(generated, front.options, name)) {
      const folder = folderOf(filename);
      const target = folder ? `${folder}/${name}${file.suffix}` : `${name}${file.suffix}`;
      try {
        fs.writeFileSync(target, file.content);
        traceOutput.push(`Klive BASIC: wrote ${target}`);
      } catch (err) {
        traceOutput.push(`Klive BASIC: could not write ${target}: ${(err as Error).message}`);
      }
    }
    return {
      errors,
      traceOutput,
      segments: generated.output.segments.map((s) => ({
        startAddress: s.startAddress,
        emittedCode: s.emittedCode,
        ...(s.bank !== undefined ? { bank: s.bank, bankOffset: s.bankOffset } : {})
      })),
      // --- The Next: the IDE exports a NEX (unbanked code goes into bank 2) and launches it with .nexload
      ...(model === SpectrumModelType.Next
        ? {
            nexConfig: generated.output.nexConfig,
            unbankedSegments: generated.output.segments
              .filter((s) => s.bank === undefined)
              .map((s) => ({ startAddress: s.startAddress, emittedCode: s.emittedCode }))
          }
        : {}),
      injectOptions: { subroutine: true },
      sourceFileList: classic.sourceFileList,
      sourceMap: classic.sourceMap,
      listFileItems: classic.listFileItems,
      sourceLevelDebug: generated.debug.sourceLevel,
      modelType: model,
      entryAddress: generated.entryAddress
    } as DebuggableOutput & { modelType: number; entryAddress: number };
  }

  async lineCanHaveBreakpoint(line: string): Promise<boolean> {
    return lineCanHaveBreakpoint(line);
  }
}

/** Reads `#include`d files from the disk; a missing or unreadable file is undefined. */
const fileSystemReader: FileReader = {
  read(path: string): string | undefined {
    try {
      return fs.readFileSync(path, "utf8");
    } catch {
      return undefined;
    }
  }
};

/**
 * The front end of one build: the build root's header over the settings (plan §5.2), then
 * preprocessing and parsing with the options that result, then binding (Phase 2) when the source
 * parsed cleanly. Warnings the options disable are dropped at the end.
 */
export function runFrontEnd(
  rootPath: string,
  rootText: string,
  reader: FileReader,
  base: KBasicOptions,
  diagnostics = new DiagnosticBag(),
  extra: { collectDefines?: boolean } = {}
): KBasicFrontEndResult {
  const normalised = rootText.replace(/\r\n?/g, "\n");
  const header = readHeader(new SourceFile(0, rootPath, normalised), diagnostics);
  const options = applyHeader(base, header, diagnostics);
  const rootFolder = folderOf(rootPath);
  const defines: Record<string, string> = {};
  for (const d of options.defines) defines[d.name] = d.value ?? "";
  const result = parseProgram(
    rootPath,
    normalised,
    reader,
    {
      defines,
      includePaths: options.includePaths.map((p) => (isAbsolutePath(p) || !rootFolder ? p : `${rootFolder}/${p}`)),
      // --- sinclair-compatible brings the Sinclair functions in (the spec's --sinclair)
      ...(options.sinclairCompatible ? { autoIncludes: ["sinclair.bas"] } : {}),
      // --- DRAW x, y, angle draws its arc through a library routine
      onDemandIncludes: [{ keyword: "DRAW", file: "__drawarc.bas" }],
      ...(extra.collectDefines ? { collectDefines: true } : {})
    },
    diagnostics
  );
  for (const file of result.sources.files.slice(1)) {
    if (!file.name.startsWith("<")) reportIgnoredHeader(file, diagnostics);
  }
  applyProgramPragmas(result.program.statements, options);
  const bound = diagnostics.hasErrors ? undefined : bind(result.program, options, diagnostics, result.preprocessed.inits);
  dropDisabledWarnings(diagnostics, options);
  dropLibraryWarnings(diagnostics, result.sources);
  return { ...result, options, header, ...(bound ? { bound } : {}) };
}

/**
 * The `#pragma` lines that set a whole-program option (compatibility plan C7): wherever they stand,
 * they set it for the program, as zxbc's do (plan §5.2: a pragma outranks the header). The ones that
 * change binding from their line onward (array_base, explicit, ...) are the binder's; `sinclair` has
 * no effect in zxbc and none here.
 */
const PROGRAM_PRAGMAS: Record<string, (o: KBasicOptions, v: string) => void> = {
  heap_size: (o, v) => (o.heapSize = pragmaInt(v)),
  heap_address: (o, v) => (o.heapAddress = pragmaInt(v)),
  memory_check: (o, v) => (o.checkMemory = pragmaBool(v)),
  array_check: (o, v) => (o.checkBounds = pragmaBool(v)),
  enable_break: (o, v) => (o.breakKey = pragmaBool(v)),
  optimization_level: (o, v) => (o.optimize = pragmaInt(v)),
  opt_strategy: (o, v) => (o.optimizeFor = v === "size" ? "size" : v === "speed" ? "speed" : "balanced"),
  org: (o, v) => (o.origin = pragmaInt(v)),
  headerless: (o, v) => (o.headerless = pragmaBool(v)),
  zxnext: (o, v) => (o.zxnext = pragmaBool(v)),
  autorun: (o, v) => (o.autorun = pragmaBool(v)),
  expected_warnings: (o, v) => (o.expectWarnings = pragmaInt(v))
};

function pragmaInt(v: string): number {
  const t = v.trim();
  return (t.startsWith("$") ? parseInt(t.slice(1), 16) : /^0x/i.test(t) ? parseInt(t.slice(2), 16) : parseInt(t, 10)) || 0;
}

function pragmaBool(v: string): boolean {
  return ["", "true", "on", "yes", "+", "1"].includes(v.trim().toLowerCase());
}

function applyProgramPragmas(statements: unknown, options: KBasicOptions): void {
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    const o = node as { kind?: string; name?: string; action?: string; value?: string };
    if (o.kind === "pragma") {
      const set = o.name && o.action === "set" ? PROGRAM_PRAGMAS[o.name] : undefined;
      if (set) set(options, o.value ?? "");
      return;
    }
    for (const [key, value] of Object.entries(o)) if (key !== "span") visit(value);
  };
  visit(statements);
}

/** Warnings about Klive's own library code (an unused library FUNCTION, say) are not the user's. */
function dropLibraryWarnings(diagnostics: DiagnosticBag, sources: SourceSet): void {
  const kept = diagnostics.items.filter((d) => d.severity === "error" || !isLibraryPath(sources.get(d.span.file).name));
  diagnostics.items.splice(0, diagnostics.items.length, ...kept);
}

/** `'@disable-warning W150, 170`: those warnings are not reported. */
function dropDisabledWarnings(diagnostics: DiagnosticBag, options: KBasicOptions): void {
  if (!options.disabledWarnings.length) return;
  const disabled = new Set(options.disabledWarnings);
  const kept = diagnostics.items.filter((d) => d.severity === "error" || !disabled.has(d.code));
  diagnostics.items.splice(0, diagnostics.items.length, ...kept);
}

/** Diagnostics as the IDE shows them: `#line`-mapped file and line, 0-based columns. */
export function toErrorInfo(diagnostics: Diagnostic[], sources: SourceSet): AssemblerErrorInfo[] {
  return diagnostics.map((d) => {
    const file = sources.get(d.span.file);
    const start = file.location(d.span.start);
    const end = file.location(Math.max(d.span.start, d.span.end));
    const sameLine = end.line === start.line && end.fileName === start.fileName;
    return {
      errorCode: d.code,
      filename: start.fileName,
      line: start.line,
      startPosition: d.span.start,
      endPosition: d.span.end,
      startColumn: start.column,
      endColumn: sameLine && end.column > start.column ? end.column : null,
      message: d.message,
      ...(d.severity !== "error" ? { isWarning: true } : {})
    };
  });
}

/** An error about the whole file, reported on its first line. */
function fileError(filename: string, errorCode: string, message: string): AssemblerErrorInfo {
  return {
    errorCode,
    filename,
    line: 1,
    startPosition: 0,
    endPosition: null,
    startColumn: 0,
    endColumn: null,
    message
  };
}

/** The build root's name without folder and extension: the generated program's file name. */
/** The highest optimisation level a debug build uses when the header does not set one (plan §8.6). */
export const DEBUG_PROFILE_LEVEL = 1;

/** Whether the build root's header sets the optimisation level itself (`'@optimize`, NextBuild's `'!opt`). */
export function headerSetsOptimize(filename: string, text: string): boolean {
  return readHeader(new SourceFile(0, filename, text.replace(/\r\n?/g, "\n")), new DiagnosticBag()).some((h) => h.name === "optimize" || h.name === "opt");
}

function programName(path: string): string {
  const base = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
  return base.replace(/\.[^.]*$/, "") || "program";
}

function folderOf(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i < 0 ? "" : path.slice(0, i);
}

function isAbsolutePath(path: string): boolean {
  return /^([A-Za-z]:)?[\\/]/.test(path);
}

/** The Spectrum model a target builds for; undefined for a target without code generation yet. */
export function targetModel(target: string): SpectrumModelType | undefined {
  return {
    zx48k: SpectrumModelType.Spectrum48,
    zx128k: SpectrumModelType.Spectrum128,
    zxplus3: SpectrumModelType.SpectrumP3,
    next: SpectrumModelType.Next
  }[target as "zx48k"];
}
