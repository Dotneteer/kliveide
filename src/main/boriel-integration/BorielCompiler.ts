import fs from "fs";
import path from "path";
import { execa } from "execa";

import type {
  AssemblerErrorInfo,
  CompileProfile,
  IKliveCompiler,
  KliveCompilerOutput
} from "@abstractions/CompilerInfo";
import type { AppState } from "@common/state/AppState";
import { createSettingsReader } from "@common/utils/SettingsReader";
import { DiagnosticBag } from "@main/kbasic/diagnostics";
import { applyHeader, optionsFromSettings, readHeader, type HeaderOption } from "@main/kbasic/options/header";
import type { KBasicOptions, Target } from "@main/kbasic/options/options";
import { SourceFile } from "@main/kbasic/syntax/source";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { argumentErrorText, buildError, parseZxbcDiagnostics } from "./boriel-diagnostics";
import { zxbcArgumentsFor } from "./boriel-options";
import { BORIEL_NOT_CONFIGURED_MESSAGE, resolveBorielExecutable } from "./boriel-resolver";

/*
 * Boriel BASIC 2.x as Klive's `zxbas` compiler (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §4). It runs
 * the external `zxbc` and turns its outputs into Klive's: the code image as one segment, its
 * diagnostics, the model to inject into, and for the Next the `.nex` zxbc wrote. The source-level
 * debug information (`.dbg`) is written and checked here; turning it into Klive's model is Phase B3.
 * Every problem is a returned error: a throw in the background worker would read as success.
 */

/** What one zxbc run produced. */
export type ZxbcRun = { exitCode?: number; stdout: string; stderr: string; timedOut: boolean; error?: string };
export type ZxbcRunner = (executable: string, args: string[], options: { cwd: string; timeoutMs: number }) => Promise<ZxbcRun>;

/** zxbc with stdin closed, in Klive's own folder (zxbc reads `./project.ini` from its cwd), killed on timeout. */
export const runZxbc: ZxbcRunner = async (executable, args, { cwd, timeoutMs }) => {
  const result = await execa(executable, args, {
    cwd,
    reject: false,
    stdin: "ignore",
    timeout: timeoutMs,
    killSignal: "SIGKILL",
    env: { ...process.env, NO_COLOR: "1" }
  });
  return {
    exitCode: result.exitCode,
    stdout: String(result.stdout ?? ""),
    stderr: String(result.stderr ?? ""),
    timedOut: !!result.timedOut,
    error: result.failed && !result.timedOut && result.exitCode === undefined ? result.message : undefined
  };
};

export const BUILD_TIMEOUT_MS = 120_000;
export const CHECK_TIMEOUT_MS = 30_000;

/** The highest optimisation level a debug build uses unless the header sets one (plan §4.1, D11). */
export const DEBUG_PROFILE_LEVEL = 1;

/** The Klive machines Boriel BASIC builds for, as Klive targets and inject models. */
const MACHINES: Record<string, { target: Target; model: SpectrumModelType }> = {
  sp48: { target: "zx48k", model: SpectrumModelType.Spectrum48 },
  timex: { target: "zx48k", model: SpectrumModelType.Spectrum48 },
  sp128: { target: "zx128k", model: SpectrumModelType.Spectrum128 },
  scorpion: { target: "zx128k", model: SpectrumModelType.Spectrum128 },
  spp3e: { target: "zxplus3", model: SpectrumModelType.SpectrumP3 },
  zxnext: { target: "next", model: SpectrumModelType.Next }
};

const MODEL_OF_TARGET: Record<Target, SpectrumModelType> = {
  zx48k: SpectrumModelType.Spectrum48,
  zx128k: SpectrumModelType.Spectrum128,
  zxplus3: SpectrumModelType.SpectrumP3,
  next: SpectrumModelType.Next
};

/** The output a Boriel build adds to Klive's: the `.nex` zxbc wrote, used instead of Klive's NEX writer. */
export type BorielBuildOutput = KliveCompilerOutput & { prebuiltNex?: number[] };

/** Everything a build or a check needs, worked out once. */
type Prepared = {
  executable: string;
  options: KBasicOptions;
  header: HeaderOption[];
  model: SpectrumModelType;
  headerErrors: AssemblerErrorInfo[];
  headerWarnings: AssemblerErrorInfo[];
  buildFolder: string;
  projectIni?: string;
  trace: string[];
};

export class BorielCompiler implements IKliveCompiler {
  private state: AppState | undefined;

  readonly id = "BorielCompiler";
  readonly language = "zxbas";
  readonly providesKliveOutput = true;

  constructor(private readonly runner: ZxbcRunner = runZxbc) {}

  setAppState(state: AppState): void {
    this.state = state;
  }

  /** Breakpoints need the `.dbg` mapped into Klive's model (Phase B3). */
  async lineCanHaveBreakpoint(_line: string): Promise<boolean> {
    return false;
  }

  /** The editor's background check: `zxbc --parse-only`, which writes no files. */
  async checkFile(filename: string): Promise<KliveCompilerOutput> {
    const prepared = this.prepare(filename);
    if ("errors" in prepared) return prepared;
    const { executable, options, header, headerErrors, headerWarnings, buildFolder, projectIni } = prepared;
    if (headerErrors.length) return { errors: [...headerErrors, ...headerWarnings] };
    const args = [filename, ...zxbcArgumentsFor(options, header).args, "--parse-only", ...(projectIni ? ["-F", projectIni] : [])];
    const run = await this.invoke(executable, args, buildFolder, CHECK_TIMEOUT_MS, filename);
    if ("errors" in run) return run;
    return { errors: [...headerWarnings, ...run.diagnostics] };
  }

  async compileFile(filename: string, _options?: Record<string, unknown>, profile?: CompileProfile): Promise<KliveCompilerOutput> {
    try {
      return await this.build(filename, profile);
    } catch (error) {
      return { errors: [buildError(filename, "ZXBC", `Boriel BASIC build failed: ${(error as Error).message}`)] };
    }
  }

  private async build(filename: string, profile?: CompileProfile): Promise<BorielBuildOutput> {
    const prepared = this.prepare(filename);
    if ("errors" in prepared) return prepared;
    const { executable, header, headerErrors, headerWarnings, buildFolder, projectIni, model, trace } = prepared;
    let { options } = prepared;
    if (headerErrors.length) return { errors: [...headerErrors, ...headerWarnings] };

    if (profile === "debug" && options.optimize > DEBUG_PROFILE_LEVEL && !header.some((h) => h.name === "optimize")) {
      options = { ...options, optimize: DEBUG_PROFILE_LEVEL };
      trace.push(`Boriel BASIC: debug build at optimisation level ${DEBUG_PROFILE_LEVEL} (the header sets no '@optimize)`);
    } else {
      trace.push(`Boriel BASIC: optimisation level ${options.optimize}`);
    }

    const name = programName(filename);
    const out = (ext: string) => path.join(buildFolder, `${name}.${ext}`);
    for (const ext of ["bin", "dbg", "map", "err", "nex"]) fs.rmSync(out(ext), { force: true });
    const { args, arch } = zxbcArgumentsFor(options, header);
    const common = [...args, ...(projectIni ? ["-F", projectIni] : [])];

    // --- The code image, its debug file and map: what Klive injects and debugs
    const run = await this.invoke(
      executable,
      [filename, ...common, "-f", "bin", "-o", out("bin"), `--debug=${out("dbg")}`, "-M", out("map"), "-e", out("err")],
      buildFolder,
      BUILD_TIMEOUT_MS,
      filename,
      out("err")
    );
    if ("errors" in run) return { ...run, traceOutput: trace };
    const diagnostics = [...headerWarnings, ...run.diagnostics];
    if (diagnostics.some((d) => !d.isWarning)) return { errors: diagnostics, traceOutput: trace };

    const image = fs.readFileSync(out("bin"));
    const debugFile = readDebugFile(out("dbg"));
    if (typeof debugFile === "string") return { errors: [...diagnostics, buildError(filename, "ZXBC-D", debugFile)], traceOutput: trace };
    // --- A stale or foreign .dbg must never drive the debugger (plan §4.1)
    if (debugFile.binaryLength !== image.length || debugFile.binaryChecksum !== fnv1a32(image)) {
      return {
        errors: [...diagnostics, buildError(filename, "ZXBC-D", "The debug file does not belong to the compiled program (checksum mismatch).")],
        traceOutput: trace
      };
    }
    const entryAddress =
      debugFile.sourceLevelDebug?.callables?.find((c: any) => c.kind === "entrypoint")?.entryAddress ?? options.origin;

    // --- The Next starts programs from a .nex: zxbc writes its own
    let prebuiltNex: number[] | undefined;
    if (arch === "zxnext") {
      const nexRun = await this.invoke(executable, [filename, ...common, "-f", "nex", "-o", out("nex")], buildFolder, BUILD_TIMEOUT_MS, filename);
      if ("errors" in nexRun) return { ...nexRun, traceOutput: trace };
      prebuiltNex = Array.from(fs.readFileSync(out("nex")));
    }

    await this.writeRequestedFiles(executable, filename, common, options, buildFolder, name, out("map"), trace);
    trace.push(`Boriel BASIC: ${image.length} bytes at $${options.origin.toString(16).toUpperCase().padStart(4, "0")} (${arch})`);

    return {
      errors: diagnostics,
      traceOutput: trace,
      segments: [{ startAddress: options.origin, emittedCode: Array.from(image) }],
      injectOptions: { subroutine: true },
      modelType: model,
      entryAddress,
      // --- Source-level debugging arrives with the .dbg adapter (Phase B3)
      sourceFileList: [],
      ...(prebuiltNex ? { nexConfig: { filename: `${name}.nex` }, prebuiltNex } : {})
    } as BorielBuildOutput;
  }

  /** Settings, machine, header and folders; or the error that stops the build before zxbc runs. */
  private prepare(filename: string): Prepared | { errors: AssemblerErrorInfo[] } {
    const settings = this.state ? createSettingsReader(this.state) : undefined;
    const executable = settings ? resolveBorielExecutable(settings) : "";
    if (!executable) return { errors: [buildError(filename, "ZXBC", BORIEL_NOT_CONFIGURED_MESSAGE)] };
    if (!fs.existsSync(executable)) {
      return { errors: [buildError(filename, "ZXBC", `zxbc was not found at ${executable}. Use Integrations | Boriel BASIC to repair it.`)] };
    }
    const machineId = this.state?.emulatorState?.machineId;
    const machine = machineId ? MACHINES[machineId] : MACHINES.sp48;
    if (!machine) {
      return { errors: [buildError(filename, "ZXBC", `Boriel BASIC does not build programs for this machine (${machineId}).`)] };
    }
    let text: string;
    try {
      text = fs.readFileSync(filename, "utf8").replace(/\r\n?/g, "\n");
    } catch (error) {
      return { errors: [buildError(filename, "ZXBC", `Cannot read the file: ${(error as Error).message}`)] };
    }

    const base = { ...optionsFromSettings((key) => settings?.readSetting(key), machineId), target: machine.target };
    const file = new SourceFile(0, filename, text);
    const bag = new DiagnosticBag();
    const header = readHeader(file, bag);
    const options = applyHeader(base, header, bag);
    const rootFolder = path.dirname(filename);
    options.includePaths = options.includePaths.map((p) => (path.isAbsolute(p) ? p : path.resolve(rootFolder, p)));
    const headerErrors = bag.items.filter((d) => d.severity === "error").map((d) => diagnosticInfo(file, d.code, d.message, d.span.start, false));
    const headerWarnings = [
      ...bag.items.filter((d) => d.severity === "warning").map((d) => diagnosticInfo(file, d.code, d.message, d.span.start, true)),
      ...zxbcArgumentsFor(options, header).warnings.map((w) => diagnosticInfo(file, "ZXBC-H", w.message, w.option.span.start, true))
    ];

    const projectFolder = this.state?.project?.folderPath;
    const buildFolder = path.join(projectFolder || rootFolder, "_klive", "boriel");
    fs.mkdirSync(buildFolder, { recursive: true });
    const trace: string[] = [];
    const ini = projectFolder ? path.join(projectFolder, "project.ini") : undefined;
    const projectIni = ini && fs.existsSync(ini) ? ini : undefined;
    if (projectIni) trace.push(`Boriel BASIC: using ${projectIni} (zxbc options file)`);
    // --- The header may name another target; the inject model follows it
    const model = options.target === machine.target ? machine.model : MODEL_OF_TARGET[options.target];
    return { executable, options, header, model, headerErrors, headerWarnings, buildFolder, projectIni, trace };
  }

  /** Runs zxbc and reads its diagnostics: from the `-e` file when given, else from stderr. */
  private async invoke(
    executable: string,
    args: string[],
    cwd: string,
    timeoutMs: number,
    filename: string,
    errFile?: string
  ): Promise<{ diagnostics: AssemblerErrorInfo[] } | { errors: AssemblerErrorInfo[] }> {
    let run: ZxbcRun;
    try {
      run = await this.runner(executable, args, { cwd, timeoutMs });
    } catch (error) {
      return { errors: [buildError(filename, "ZXBC", `zxbc could not be started: ${(error as Error).message}`)] };
    }
    if (run.timedOut) {
      return { errors: [buildError(filename, "ZXBC", `zxbc did not finish within ${Math.round(timeoutMs / 1000)} s and was stopped.`)] };
    }
    if (run.error) return { errors: [buildError(filename, "ZXBC", `zxbc could not be started: ${run.error}`)] };
    if (run.exitCode === 2) return { errors: [buildError(filename, "ZXBC", `zxbc rejected its arguments: ${argumentErrorText(run.stderr)}`)] };
    const text = errFile && fs.existsSync(errFile) ? fs.readFileSync(errFile, "utf8") : `${run.stderr}\n${run.stdout}`;
    const diagnostics = parseZxbcDiagnostics(text, path.dirname(filename));
    if (run.exitCode !== 0 && !diagnostics.some((d) => !d.isWarning)) {
      diagnostics.push(buildError(filename, "ZXBC", `zxbc failed (exit code ${run.exitCode}).`));
    }
    return { diagnostics };
  }

  /** `'@emit-map`, `'@emit-asm`, `'@emit-ir`: files beside the source; a failure is a note, not a failed build. */
  private async writeRequestedFiles(
    executable: string,
    filename: string,
    common: string[],
    options: KBasicOptions,
    buildFolder: string,
    name: string,
    mapFile: string,
    trace: string[]
  ): Promise<void> {
    const beside = (ext: string) => path.join(path.dirname(filename), `${name}.${ext}`);
    if (options.emitMap) {
      try {
        fs.copyFileSync(mapFile, beside("map"));
        trace.push(`Boriel BASIC: wrote ${beside("map")}`);
      } catch (error) {
        trace.push(`Boriel BASIC: could not write ${beside("map")}: ${(error as Error).message}`);
      }
    }
    for (const [wanted, format] of [
      [options.emitAsm, "asm"],
      [options.emitIr, "ir"]
    ] as const) {
      if (!wanted) continue;
      const run = await this.invoke(executable, [filename, ...common, "-f", format, "-o", beside(format)], buildFolder, BUILD_TIMEOUT_MS, filename);
      trace.push("errors" in run ? `Boriel BASIC: could not write ${beside(format)}` : `Boriel BASIC: wrote ${beside(format)}`);
    }
  }
}

/** The parsed `.dbg`, or why it cannot be used. */
function readDebugFile(file: string): any | string {
  let parsed: any;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return `zxbc wrote no readable debug file: ${(error as Error).message}`;
  }
  if (parsed?.format !== "zx-source-debug" || parsed?.version !== 1) {
    return `Unsupported debug file format (${parsed?.format} version ${parsed?.version}).`;
  }
  return parsed;
}

/** The 32-bit FNV-1a hash zxbc records as `binaryChecksum` (`.ai/boriel/dbg-observed.md`). */
export function fnv1a32(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function diagnosticInfo(file: SourceFile, code: string, message: string, offset: number, warning: boolean): AssemblerErrorInfo {
  const location = file.location(offset);
  return {
    errorCode: code,
    filename: location.fileName,
    line: location.line,
    startPosition: offset,
    endPosition: null,
    startColumn: location.column,
    endColumn: null,
    message,
    ...(warning ? { isWarning: true } : {})
  };
}

function programName(file: string): string {
  return path.basename(file).replace(/\.[^.]*$/, "") || "program";
}
