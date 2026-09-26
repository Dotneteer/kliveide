import fs from "fs";

import type { AssemblerErrorInfo, DebuggableOutput, IKliveCompiler, SimpleAssemblerOutput } from "@abstractions/CompilerInfo";
import type { AppState } from "@common/state/AppState";

import { createSettingsReader } from "@common/utils/SettingsReader";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { generateProgram } from "./codegen";
import { lineCanHaveBreakpoint } from "./breakpoints";
import { DiagnosticBag, type Diagnostic } from "./diagnostics";
import { parseProgram, type FrontEndResult } from "./front-end";
import { applyHeader, optionsFromSettings, readHeader, reportIgnoredHeader } from "./options/header";
import type { KBasicOptions } from "./options/options";
import { bind, type BindResult } from "./semantics/binder";
import type { FileReader } from "./syntax/preprocessor";
import { SourceFile, type SourceSet } from "./syntax/source";

export type KBasicFrontEndResult = FrontEndResult & {
  options: KBasicOptions;
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
  compileFile(filename: string): Promise<SimpleAssemblerOutput> {
    return this.run(filename, false);
  }

  /** The editor's background diagnostics. */
  checkFile(filename: string): Promise<SimpleAssemblerOutput> {
    return this.run(filename, true);
  }

  private async run(filename: string, background: boolean): Promise<SimpleAssemblerOutput> {
    const settings = this.state ? createSettingsReader(this.state) : undefined;
    const base = optionsFromSettings((key) => settings?.readSetting(key), this.state?.emulatorState?.machineId);
    let text: string;
    try {
      text = fs.readFileSync(filename, "utf8");
    } catch (err) {
      return { errors: [fileError(filename, "K002", `Cannot read the file: ${(err as Error).message}`)] };
    }
    try {
      const result = runFrontEnd(filename, text, fileSystemReader, base);
      if (background || result.diagnostics.hasErrors || !result.bound) {
        return { errors: toErrorInfo(result.diagnostics.items, result.sources) };
      }
      return await this.build(filename, result);
    } catch (err) {
      // --- A worker that throws is reported as a success (plan §2.1), so a compiler bug is an error
      return { errors: [fileError(filename, "K000", `Internal compiler error: ${(err as Error).message}`)] };
    }
  }

  /** Code generation (the 48K, 128K and +3 targets, optimisation level 0). */
  private async build(filename: string, front: KBasicFrontEndResult): Promise<SimpleAssemblerOutput | DebuggableOutput> {
    const diagnostics = front.diagnostics;
    const model = targetModel(front.options.target);
    if (model === undefined) {
      diagnostics.error("E502", `Klive BASIC does not generate code for target '${front.options.target}' yet (the ZX Spectrum Next comes with Phase 6)`, { file: 0, start: 0, end: 0 });
      return { errors: toErrorInfo(diagnostics.items, front.sources) };
    }
    const generated = await generateProgram(front.bound!, front.sources, front.options, programName(filename), diagnostics);
    const errors = toErrorInfo(diagnostics.items, front.sources);
    if (!generated) return { errors };
    const classic = generated.debug.classic;
    return {
      errors,
      traceOutput: [`Klive BASIC: code generated at optimisation level 0 (the only level so far)`],
      segments: generated.output.segments.map((s) => ({ startAddress: s.startAddress, emittedCode: s.emittedCode })),
      injectOptions: { subroutine: true },
      sourceFileList: classic.sourceFileList,
      sourceMap: classic.sourceMap,
      listFileItems: classic.listFileItems,
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
  diagnostics = new DiagnosticBag()
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
      includePaths: options.includePaths.map((p) => (isAbsolutePath(p) || !rootFolder ? p : `${rootFolder}/${p}`))
    },
    diagnostics
  );
  for (const file of result.sources.files.slice(1)) {
    if (!file.name.startsWith("<")) reportIgnoredHeader(file, diagnostics);
  }
  const bound = diagnostics.hasErrors ? undefined : bind(result.program, options, diagnostics, result.preprocessed.inits);
  dropDisabledWarnings(diagnostics, options);
  return { ...result, options, ...(bound ? { bound } : {}) };
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
  return { zx48k: SpectrumModelType.Spectrum48, zx128k: SpectrumModelType.Spectrum128, zxplus3: SpectrumModelType.SpectrumP3 }[target as "zx48k"];
}
