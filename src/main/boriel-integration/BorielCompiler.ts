import fs from "fs";
import path from "path";
import { execa } from "execa";

import type {
  AssemblerErrorInfo,
  BinarySegment,
  CompileProfile,
  IKliveCompiler,
  KliveCompilerOutput
} from "@abstractions/CompilerInfo";
import type { AppState } from "@common/state/AppState";
import { parseZ80File } from "@common/spectrum/snapshot/z80File";
import { createSettingsReader } from "@common/utils/SettingsReader";
import { loadNexFileContents } from "@renderer/appIde/DocumentPanels/Next/nexFileLoader";
import { DiagnosticBag } from "@main/kbasic/diagnostics";
import { applyHeader, optionsFromSettings, readHeader, type HeaderOption } from "@main/kbasic/options/header";
import type { KBasicOptions, Target } from "@main/kbasic/options/options";
import { SourceFile } from "@main/kbasic/syntax/source";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { argumentErrorText, buildError, parseZxbcDiagnostics } from "./boriel-diagnostics";
import { zxbcArgumentsFor } from "./boriel-options";
import { BORIEL_NOT_CONFIGURED_MESSAGE, resolveBorielExecutable } from "./boriel-resolver";
import { parseMemoryMap } from "./boriel-map";
import { bankedSegments, extractBankedProgram, fnv1a32, programBankIds, segmentOfPartition } from "./boriel-banked";
import { adaptBorielDebugInfo, type DbgAdapterOutput } from "./dbg-adapter";
import { lineCanHaveBreakpoint } from "@main/kbasic/breakpoints";

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

/** The `.dbg` the build's other zxbc runs write only because `--debug` changes the code (never read). */
const SECOND_DBG = "same-code.dbg";

/**
 * Whether a `.nex` loads `image`. zxbc lays the program's banks out in the file in load order (5, 2,
 * 0, ...), which is address order for $4000-$FFFF, so a program the `.nex` holds is one run of bytes.
 */
export function nexHoldsImage(nex: Uint8Array, image: Uint8Array): boolean {
  return image.length > 0 && Buffer.from(nex.buffer, nex.byteOffset, nex.byteLength).indexOf(Buffer.from(image)) >= 0;
}

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

  /** The same rule as Klive BASIC's: a line that holds a statement (not a comment, label or DATA). */
  async lineCanHaveBreakpoint(line: string): Promise<boolean> {
    return lineCanHaveBreakpoint(line);
  }

  /** The editor's background check: `zxbc --parse-only`, which writes no files. */
  async checkFile(filename: string): Promise<KliveCompilerOutput> {
    const prepared = this.prepare(filename);
    if ("errors" in prepared) return prepared;
    const { executable, options, header, headerErrors, headerWarnings, buildFolder, projectIni } = prepared;
    if (headerErrors.length) return { errors: [...headerErrors, ...headerWarnings] };
    const args = [filename, ...zxbcArgumentsFor(options, header, undefined, path.dirname(filename)).args, "--parse-only", ...(projectIni ? ["-F", projectIni] : [])];
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
    for (const ext of ["bin", "dbg", "map", "err", "nex", "z80", SECOND_DBG]) fs.rmSync(out(ext), { force: true });
    const { args, arch } = zxbcArgumentsFor(options, header, undefined, path.dirname(filename));
    const common = [...args, ...(projectIni ? ["-F", projectIni] : [])];
    // --- `--debug` changes the code zxbc generates (`.ai/boriel/dbg-observed.md`): every other
    // --- output of this build passes it too, or it holds other code than the one debugged
    const sameCode = [...common, `--debug=${out(SECOND_DBG)}`];

    // --- The code image, its debug file and map: what Klive injects and debugs. zxbc refuses `bin`
    // --- for a banked build (plan §7): the program then comes out of a 128K snapshot or the .nex
    const banked = args.includes("--split-modules");
    const format = !banked ? "bin" : arch === "zxnext" ? "nex" : "z80";
    const run = await this.invoke(
      executable,
      [
        filename,
        ...common,
        "-f",
        format,
        ...(format === "z80" ? ["-B", "-a"] : []),
        "-o",
        out(format),
        `--debug=${out("dbg")}`,
        "-M",
        out("map"),
        "-e",
        out("err")
      ],
      buildFolder,
      BUILD_TIMEOUT_MS,
      filename,
      out("err")
    );
    if ("errors" in run) return { ...run, traceOutput: trace };
    const diagnostics = [...headerWarnings, ...run.diagnostics];
    if (diagnostics.some((d) => !d.isWarning)) return { errors: diagnostics, traceOutput: trace };

    const debugFile = readDebugFile(out("dbg"));
    if (typeof debugFile === "string") return { errors: [...diagnostics, buildError(filename, "ZXBC-D", debugFile)], traceOutput: trace };
    // --- A stale or foreign .dbg must never drive the debugger (plan §4.1)
    const program = programOf(fs.readFileSync(out(format)), format, options.origin, debugFile, arch);
    if (typeof program === "string") {
      return { errors: [...diagnostics, buildError(filename, "ZXBC-D", `The debug file does not belong to the compiled program: ${program}.`)], traceOutput: trace };
    }
    const { image, segments } = program;
    const entryAddress =
      debugFile.sourceLevelDebug?.callables?.find((c: any) => c.kind === "entrypoint")?.entryAddress ?? options.origin;

    // --- The .dbg in Klive's model (plan §5); a build whose debug data cannot be read still runs
    let debug: DbgAdapterOutput | undefined;
    try {
      debug = adaptBorielDebugInfo({
        dbg: debugFile,
        map: parseMemoryMap(fs.existsSync(out("map")) ? fs.readFileSync(out("map"), "utf8") : ""),
        arch,
        baseFolder: buildFolder,
        libraryFolder: path.join(path.dirname(executable), "lib"),
        optimizationLevel: options.optimize,
        image: { bytes: image, origin: options.origin },
        bankImages: segments
          .filter((s) => s.bank !== undefined)
          .map((s) => ({ partition: arch === "zxnext" ? s.bank! * 2 : s.bank!, bytes: s.emittedCode, origin: s.startAddress })),
        readFile: (file) => {
          try {
            return fs.readFileSync(file, "utf8");
          } catch {
            return undefined;
          }
        }
      });
      const sld = debug.sourceLevelDebug;
      trace.push(
        `Boriel BASIC: source-level debug information for ${sld.statements.length} statements in ${sld.callables.length} routines` +
          (debug.dropped.length ? ` (${debug.dropped.length} records left out)` : "")
      );
      for (const problem of debug.problems) trace.push(`Boriel BASIC: debug information check: ${problem}`);
      // --- Boriel promises none of Klive BASIC's stepping guarantees (plan §6.2): say when the data breaks one
      if (debug.problems.length) {
        diagnostics.push({
          ...buildError(
            filename,
            "ZXBC-D",
            `The debug information failed ${debug.problems.length} check(s) (see the build output): ` +
              "source stepping may stop in the wrong place."
          ),
          isWarning: true
        });
      }
    } catch (error) {
      diagnostics.push({ ...buildError(filename, "ZXBC-D", `No source-level debugging: ${(error as Error).message}`), isWarning: true });
    }

    // --- A banked program's breakpoints need their bank: each list item names its bank's segment
    if (banked && debug) {
      for (const item of debug.listFileItems) item.segmentIndex = segmentOfPartition(segments, item.partition, arch);
    }

    // --- The Next starts programs from a .nex: zxbc writes its own (a banked build's is the first run's)
    let prebuiltNex: number[] | undefined;
    if (arch === "zxnext" && banked) {
      prebuiltNex = Array.from(fs.readFileSync(out("nex")));
    } else if (arch === "zxnext") {
      const nexRun = await this.invoke(executable, [filename, ...sameCode, "-f", "nex", "-o", out("nex")], buildFolder, BUILD_TIMEOUT_MS, filename);
      if ("errors" in nexRun) return { ...nexRun, traceOutput: trace };
      const nex = fs.readFileSync(out("nex"));
      // --- The Next runs the .nex, the debugger reads the .bin's .dbg: they must hold the same code
      if (!nexHoldsImage(nex, image)) {
        diagnostics.push({
          ...buildError(
            filename,
            "ZXBC-D",
            "The .nex zxbc wrote holds other code than the debugged build: breakpoints and stepping will not match it."
          ),
          isWarning: true
        });
      }
      prebuiltNex = Array.from(nex);
    }

    await this.writeRequestedFiles(executable, filename, sameCode, options, buildFolder, name, out("map"), trace);
    fs.rmSync(out(SECOND_DBG), { force: true });
    trace.push(`Boriel BASIC: ${image.length} bytes at $${options.origin.toString(16).toUpperCase().padStart(4, "0")} (${arch})`);
    for (const segment of segments.filter((s) => s.bank !== undefined)) {
      trace.push(`Boriel BASIC: ${segment.emittedCode.length} bytes in bank ${segment.bank}`);
    }

    return {
      errors: diagnostics,
      traceOutput: trace,
      segments,
      injectOptions: { subroutine: true },
      modelType: model,
      entryAddress,
      sourceFileList: debug?.sourceFileList ?? [],
      ...(debug
        ? { sourceMap: debug.sourceMap, listFileItems: debug.listFileItems, sourceLevelDebug: debug.sourceLevelDebug }
        : {}),
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

  /**
   * `'@emit-map`, `'@emit-asm`, `'@emit-ir`: files beside the source; a failure is a note, not a failed
   * build. `common` carries `--debug`, so a listing shows the code that runs.
   */
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

/**
 * The program a build wrote, checked against its `.dbg`: the resident code image, and the segments
 * Klive injects (one, or one per bank for a banked build); or why it does not match.
 */
function programOf(
  file: Uint8Array,
  format: string,
  origin: number,
  debugFile: any,
  arch: string
): { image: Uint8Array; segments: BinarySegment[] } | string {
  if (format === "bin") {
    if (debugFile.binaryLength !== file.length || debugFile.binaryChecksum !== fnv1a32(file)) return "checksum mismatch";
    return { image: file, segments: [{ startAddress: origin, emittedCode: Array.from(file) }] as BinarySegment[] };
  }
  let ram: Map<number, Uint8Array>;
  if (format === "z80") {
    ram = parseZ80File(file).ram;
  } else {
    const nex = loadNexFileContents(file);
    if (!nex.fileInfo) return `zxbc's .nex cannot be read (${nex.error})`;
    ram = new Map(nex.fileInfo.bankData);
  }
  const ids = programBankIds(debugFile.sourceLevelDebug?.extensions?.codebank, arch);
  const parts = extractBankedProgram(ram, origin, ids, debugFile.binaryLength, debugFile.binaryChecksum);
  if (typeof parts === "string") return parts;
  return { image: parts.find((p) => p.bank === undefined)?.bytes ?? new Uint8Array(), segments: bankedSegments(parts) };
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
