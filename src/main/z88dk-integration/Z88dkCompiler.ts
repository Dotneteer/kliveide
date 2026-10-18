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
import { createSettingsReader } from "@common/utils/SettingsReader";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";

import {
  Z88DK_BACKGROUND_CHECK,
  Z88DK_CLIB,
  Z88DK_COMPILER,
  Z88DK_EXTRA_ARGS,
  Z88DK_LIBS,
  Z88DK_OPTIMISE,
  Z88DK_PRAGMAS,
  Z88DK_SETUP_ERROR_CODE,
  Z88DK_STARTUP,
  Z88DK_SUBTYPE
} from "./z88dk-config";
import { parseZccDiagnostics, z88dkBuildError } from "./z88dk-diagnostics";
import {
  loadAddressOf,
  parseZ88dkMap,
  projectFileTest,
  z88dkBanks,
  z88dkLineDebug,
  z88dkLineRecords,
  z88dkSymbols,
  type Z88dkMapSymbol
} from "./z88dk-map";
import {
  isZ88dkRoot,
  resolveZ88dkInstall,
  z88dkNotWorkingMessage,
  z88dkRunEnvironment,
  Z88DK_NOT_CONFIGURED_MESSAGE
} from "./z88dk-resolver";
import { z88dkTargetFor, type Z88dkTarget } from "./z88dk-targets";
import { adaptZ88dkDebugInfo } from "./z88dk-debug-adapter";

/*
 * z88dk as Klive's compiler for C (`.plans/Z88DK_INTEGRATION_PLAN.md` §5, decision C1). It runs `zcc`
 * for the machine's target (C5) with the project's options (C6), and turns its outputs into Klive's:
 * diagnostics, the image as segments, the line tables from the map (C8), and the native file
 * `-create-app` wrote (a `.nex` the Next runs, a `.P`/`.O` the ZX81/ZX80 load, what Export copies).
 * Every problem is a returned error: a throw in the background worker would read as success.
 */

export type ZccRun = { exitCode?: number; stdout: string; stderr: string; timedOut: boolean; error?: string };
export type ZccRunner = (
  zcc: string,
  args: string[],
  options: { cwd: string; env: Record<string, string>; timeoutMs: number }
) => Promise<ZccRun>;

export const runZcc: ZccRunner = async (zcc, args, { cwd, env, timeoutMs }) => {
  const result = await execa(zcc, args, {
    cwd,
    env,
    extendEnv: false,
    reject: false,
    stdin: "ignore",
    timeout: timeoutMs,
    killSignal: "SIGKILL"
  });
  return {
    exitCode: result.exitCode,
    stdout: String(result.stdout ?? ""),
    stderr: String(result.stderr ?? ""),
    timedOut: !!result.timedOut,
    error: result.failed && !result.timedOut && result.exitCode === undefined ? result.message : undefined
  };
};

export const BUILD_TIMEOUT_MS = 180_000;
export const CHECK_TIMEOUT_MS = 60_000;

/** The C build options a project sets (C6), with Klive's defaults. */
export type Z88dkOptions = {
  compiler: "sccz80" | "sdcc";
  clib: "classic" | "new";
  subtype?: string;
  startup?: number;
  optimise: "none" | "O1" | "O2" | "O3" | "SO3";
  extraArgs: string[];
  /** Undefined: the target's default (`ndos` where the classic library needs it for printf). */
  libs?: string[];
  pragmas: string[];
  backgroundCheck: boolean;
};

export function z88dkOptionsFrom(read: (key: string) => unknown): Z88dkOptions {
  const str = (key: string) => {
    const value = read(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const list = (key: string): string[] | undefined => {
    const value = read(key);
    if (Array.isArray(value)) return value.filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim());
    if (typeof value === "string" && value.trim()) return value.trim().split(/\s+/);
    return undefined;
  };
  const startup = Number(read(Z88DK_STARTUP));
  const compiler = str(Z88DK_COMPILER) === "sdcc" ? "sdcc" : "sccz80";
  const optimise = str(Z88DK_OPTIMISE);
  return {
    compiler,
    clib: str(Z88DK_CLIB) === "new" ? "new" : "classic",
    subtype: str(Z88DK_SUBTYPE) || undefined,
    startup: Number.isInteger(startup) && read(Z88DK_STARTUP) !== undefined && read(Z88DK_STARTUP) !== "" ? startup : undefined,
    optimise: (["none", "O1", "O2", "O3", "SO3"].includes(optimise) ? optimise : "O2") as Z88dkOptions["optimise"],
    extraArgs: list(Z88DK_EXTRA_ARGS) ?? [],
    libs: list(Z88DK_LIBS),
    pragmas: list(Z88DK_PRAGMAS) ?? [],
    backgroundCheck: read(Z88DK_BACKGROUND_CHECK) === true || read(Z88DK_BACKGROUND_CHECK) === "true"
  };
}

/**
 * The zcc arguments for a build (§5.1): the target, the library and compiler choice, the profile's
 * debug or optimisation flags, the project's options, `-m` (the map) and `-create-app`.
 * SDCC cannot build with `-debug` (C4), so its debug builds leave it out.
 */
export function zccArgumentsFor(
  target: Z88dkTarget,
  options: Z88dkOptions,
  profile: CompileProfile,
  output: string,
  sources: string[]
): string[] {
  const args = [...target.args];
  if (options.compiler === "sdcc") {
    args.push("-compiler=sdcc");
    if (options.clib === "new") args.push("-clib=sdcc_iy");
    else if (target.classicClib) args.push(target.classicClib);
  } else if (options.clib === "new") {
    args.push("-clib=new");
  } else if (target.classicClib) {
    args.push(target.classicClib);
  }
  if (options.startup !== undefined) args.push(`-startup=${options.startup}`);
  if (profile === "debug") {
    if (options.compiler === "sccz80") args.push("-debug");
    // --- No optimisation: the line records stay on the lines that emit the code (§12)
    args.push("-O0");
  } else if (options.optimise === "none") {
    args.push("-O0");
  } else {
    args.push(`-${options.optimise}`);
  }
  const libs = options.libs ?? (target.needsNdos && options.clib === "classic" ? ["ndos"] : []);
  for (const lib of libs) args.push(`-l${lib}`);
  for (const pragma of options.pragmas) args.push(`-pragma-define:${pragma}`);
  args.push("-m", "-create-app", "-o", output, ...sources, ...options.extraArgs);
  return args;
}

/** What a z88dk build adds to Klive's output. */
export type Z88dkBuildOutput = KliveCompilerOutput & {
  /** The `.nex` appmake wrote: the Next runs it, Export copies it. */
  prebuiltNex?: number[];
  /** The ZX80/ZX81 program file appmake wrote, which Run loads as `tape-load -r` does. */
  programFile?: string;
  /** Every native file `-create-app` wrote, by extension (`tap`, `nex`, `P`, `O`, `dsk`, `epr`). */
  z88dkArtefacts?: Record<string, string>;
  /** How Run delivers the program (`z88dk-targets.ts`). */
  z88dkRun?: string;
  /** A Z88 application: the card image, its size, and the key OZ starts it with (□ + key). */
  z88Card?: { file: string; sizeKb: number; appKey: string };
};

export class Z88dkCompiler implements IKliveCompiler {
  private state: AppState | undefined;

  readonly id = "Z88dkCompiler";
  readonly language = "c";
  readonly providesKliveOutput = true;

  constructor(private readonly runner: ZccRunner = runZcc) {}

  setAppState(state: AppState): void {
    this.state = state;
  }

  /**
   * A C line that can hold a breakpoint: not blank, not only a comment, a preprocessor line or a
   * brace. The build's line records decide where it binds (§6).
   */
  async lineCanHaveBreakpoint(line: string): Promise<boolean> {
    return cLineCanHaveBreakpoint(line);
  }

  /**
   * The editor's background check: `zcc -c` on the build root, only when the project opts in
   * (`z88dk.backgroundCheck`): a zcc run is far slower than Klive's in-process parsers (§5.1).
   */
  async checkFile(filename: string): Promise<KliveCompilerOutput> {
    const settings = this.state ? createSettingsReader(this.state) : undefined;
    const options = z88dkOptionsFrom((key) => settings?.readSetting(key));
    if (!options.backgroundCheck) return { errors: [] };
    const prepared = this.prepare(filename, "check");
    if ("errors" in prepared) return prepared;
    const { install, target, cwd, buildFolder } = prepared;
    const args = [...target.args, ...(options.compiler === "sdcc" ? ["-compiler=sdcc"] : []), "-c", "-o", path.join(buildFolder, "check.o"), path.basename(filename)];
    const run = await this.invoke(install.root, install.zcc, args, cwd, CHECK_TIMEOUT_MS, filename);
    return "errors" in run ? run : { errors: run.diagnostics };
  }

  async compileFile(filename: string, _options?: Record<string, unknown>, profile?: CompileProfile): Promise<KliveCompilerOutput> {
    try {
      return await this.build(filename, profile ?? "build");
    } catch (error) {
      return { errors: [z88dkBuildError(filename, `z88dk build failed: ${(error as Error).message}`)] };
    }
  }

  private async build(filename: string, profile: CompileProfile): Promise<Z88dkBuildOutput> {
    const prepared = this.prepare(filename, profile);
    if ("errors" in prepared) return prepared;
    const { install, target, options, cwd, buildFolder, trace } = prepared;

    const name = programName(filename);
    const output = path.join(buildFolder, name);
    for (const file of fs.readdirSync(buildFolder)) {
      if (file === name || file.startsWith(`${name}.`) || file.startsWith(`${name}_`)) {
        fs.rmSync(path.join(buildFolder, file), { force: true });
      }
    }
    const args = zccArgumentsFor(target, options, profile, output, [path.basename(filename)]);
    trace.push(`z88dk: zcc ${args.join(" ")}`);
    const run = await this.invoke(install.root, install.zcc, args, cwd, BUILD_TIMEOUT_MS, filename);
    if ("errors" in run) return { ...run, traceOutput: trace };
    const diagnostics = run.diagnostics;
    if (diagnostics.some((d) => !d.isWarning)) return { errors: diagnostics, traceOutput: trace };
    if (options.compiler === "sdcc" && profile === "debug") {
      diagnostics.push({
        ...z88dkBuildError(
          filename,
          "SDCC builds cannot carry z88dk's line debug information: breakpoints and stepping work in the disassembly only. Choose sccz80 (Settings › Integrations) to debug C lines."
        ),
        isWarning: true
      });
    }

    // --- The image: `<name>` (classic library), or `<name>_CODE.bin` (new library)
    const codeBin = `${output}_CODE.bin`;
    const useCodeBin = (!fs.existsSync(output) || fs.statSync(output).size === 0) && fs.existsSync(codeBin);
    const imageFile = useCodeBin ? codeBin : output;
    if (!fs.existsSync(imageFile)) {
      return { errors: [...diagnostics, z88dkBuildError(filename, "zcc reported success but wrote no program image.")], traceOutput: trace };
    }
    const image = fs.readFileSync(imageFile);
    const mapText = fs.existsSync(`${output}.map`) ? fs.readFileSync(`${output}.map`, "utf8") : "";
    const symbols = parseZ88dkMap(mapText);
    const origin = loadAddressOf(symbols, useCodeBin);
    if (origin === undefined) {
      return { errors: [...diagnostics, z88dkBuildError(filename, "The z88dk map does not say where the program loads (no CRT_ORG_CODE).")], traceOutput: trace };
    }

    // --- Banked code (§9): one segment per filled bank, from `<name>_BANK_n.bin`
    const segments: BinarySegment[] = [{ startAddress: origin & 0xffff, emittedCode: Array.from(image) }];
    for (const bank of z88dkBanks(symbols)) {
      const bankFile = `${output}_BANK_${bank.bank}.bin`;
      if (!fs.existsSync(bankFile)) continue;
      segments.push({
        bank: bank.bank,
        bankOffset: 0,
        startAddress: bank.address,
        emittedCode: Array.from(fs.readFileSync(bankFile))
      });
      trace.push(`z88dk: ${fs.statSync(bankFile).size} bytes in bank ${bank.bank}`);
    }

    const artefacts: Record<string, string> = {};
    for (const ext of ["tap", "nex", "P", "O", "dsk", "epr"]) {
      const file = `${output}.${ext}`;
      if (fs.existsSync(file)) artefacts[ext] = file;
    }

    // --- Line tables from the map (§6): only the project's files
    const isProjectFile = projectFileTest([this.state?.project?.folderPath, cwd], install.root);
    // --- A 16K bank is one partition on the 128K family and two 8K pages on the Next
    const partitionOf = (bank: number, address: number) =>
      target.model === SpectrumModelType.Next ? bank * 2 + ((address & 0x3fff) >> 13) : bank;
    const segmentOf = (bank: number) => {
      const index = segments.findIndex((s) => s.bank === bank);
      return index >= 0 ? index : undefined;
    };
    const lineDebug = z88dkLineDebug(z88dkLineRecords(symbols, cwd, isProjectFile), partitionOf, segmentOf);
    const fileIndexOf = (file: string) => {
      const index = lineDebug.sourceFileList.findIndex((f) => f.filename === file);
      return index >= 0 ? index : undefined;
    };
    const symbolTable = z88dkSymbols(symbols, cwd, isProjectFile, fileIndexOf, partitionOf);
    if (profile === "debug" && options.compiler === "sccz80" && lineDebug.listFileItems.length === 0) {
      diagnostics.push({ ...z88dkBuildError(filename, "The z88dk map holds no line records for the project's files: breakpoints will not bind."), isWarning: true });
    }
    trace.push(
      `z88dk: ${image.length} bytes at $${(origin & 0xffff).toString(16).toUpperCase().padStart(4, "0")} (${target.name})` +
        (lineDebug.listFileItems.length ? `, ${lineDebug.listFileItems.length} source lines mapped` : "")
    );

    // --- Source-level debugging (§8, phase Z5): variables, frames and the call stack from the CDB records
    let sourceLevelDebug: unknown;
    if (profile === "debug" && options.compiler === "sccz80") {
      try {
        const adapted = adaptZ88dkDebugInfo({ symbols, lineDebug, cwd, isProjectFile, partitionOf, image, origin: origin & 0xffff });
        if (adapted) {
          sourceLevelDebug = adapted.sourceLevelDebug;
          trace.push(`z88dk: source-level debug information for ${adapted.sourceLevelDebug.statements.length} statements in ${adapted.sourceLevelDebug.callables.length} functions`);
          for (const problem of adapted.problems) trace.push(`z88dk: debug information check: ${problem}`);
        }
      } catch (error) {
        diagnostics.push({ ...z88dkBuildError(filename, `No source-level debugging: ${(error as Error).message}`), isWarning: true });
      }
    }

    const result: Z88dkBuildOutput = {
      errors: diagnostics,
      traceOutput: trace,
      segments,
      injectOptions: { subroutine: true },
      sourceType: "c",
      ...(target.model !== undefined ? { modelType: target.model } : {}),
      entryAddress: origin & 0xffff,
      sourceFileList: lineDebug.sourceFileList,
      sourceMap: lineDebug.sourceMap,
      listFileItems: lineDebug.listFileItems,
      symbols: symbolTable,
      ...(sourceLevelDebug ? { sourceLevelDebug } : {}),
      z88dkArtefacts: artefacts,
      z88dkRun: target.run
    } as Z88dkBuildOutput;

    if (target.run === "nex") {
      if (!artefacts.nex) {
        return { errors: [...diagnostics, z88dkBuildError(filename, "zcc wrote no .nex file for the Next.")], traceOutput: trace };
      }
      (result as any).nexConfig = { filename: `${name}.nex` };
      result.prebuiltNex = Array.from(fs.readFileSync(artefacts.nex));
    }
    if (target.run === "card") {
      if (!artefacts.epr) {
        return { errors: [...diagnostics, z88dkBuildError(filename, "zcc wrote no .epr card image for the Z88 application.")], traceOutput: trace };
      }
      result.z88Card = {
        file: artefacts.epr,
        sizeKb: Math.max(32, Math.ceil(fs.statSync(artefacts.epr).size / 1024)),
        appKey: appKeyOf(filename)
      };
    }
    if (target.run === "program") {
      const file = artefacts.P ?? artefacts.O;
      if (!file) {
        return { errors: [...diagnostics, z88dkBuildError(filename, `zcc wrote no ${target.appExtension} program file.`)], traceOutput: trace };
      }
      result.programFile = file;
    }
    return result;
  }

  /** Settings, install, target and folders; or the error that stops the build before zcc runs. */
  private prepare(
    filename: string,
    profile: CompileProfile | "check"
  ):
    | { install: { root: string; zcc: string }; target: Z88dkTarget; options: Z88dkOptions; cwd: string; buildFolder: string; trace: string[] }
    | { errors: AssemblerErrorInfo[] } {
    const settings = this.state ? createSettingsReader(this.state) : undefined;
    const install = resolveZ88dkInstall(settings);
    if (!install) return { errors: [z88dkBuildError(filename, Z88DK_NOT_CONFIGURED_MESSAGE, Z88DK_SETUP_ERROR_CODE)] };
    if (!isZ88dkRoot(install.root)) {
      return { errors: [z88dkBuildError(filename, z88dkNotWorkingMessage(install.root), Z88DK_SETUP_ERROR_CODE)] };
    }
    const options = z88dkOptionsFrom((key) => settings?.readSetting(key));
    const emu = this.state?.emulatorState;
    const target = z88dkTargetFor(emu?.machineId, emu?.modelId, emu?.config, options.subtype);
    if ("refused" in target) return { errors: [z88dkBuildError(filename, target.refused)] };
    if (!fs.existsSync(filename)) return { errors: [z88dkBuildError(filename, `Cannot read the file: ${filename}`)] };
    const cwd = path.dirname(filename);
    const projectFolder = this.state?.project?.folderPath;
    const buildFolder = path.join(projectFolder || cwd, "_klive", "z88dk", profile);
    fs.mkdirSync(buildFolder, { recursive: true });
    const trace: string[] = [];
    if (install.source !== "settings") trace.push(`z88dk: using ${install.root} (${install.source === "environment" ? "the Z88DK environment variable" : "found on this computer"})`);
    return { install, target, options, cwd, buildFolder, trace };
  }

  private async invoke(
    root: string,
    zcc: string,
    args: string[],
    cwd: string,
    timeoutMs: number,
    filename: string
  ): Promise<{ diagnostics: AssemblerErrorInfo[] } | { errors: AssemblerErrorInfo[] }> {
    let run: ZccRun;
    try {
      run = await this.runner(zcc, args, { cwd, env: z88dkRunEnvironment(root), timeoutMs });
    } catch (error) {
      return { errors: [z88dkBuildError(filename, `zcc could not be started: ${(error as Error).message}`)] };
    }
    if (run.timedOut) {
      return { errors: [z88dkBuildError(filename, `zcc did not finish within ${Math.round(timeoutMs / 1000)} s and was stopped.`)] };
    }
    if (run.error) return { errors: [z88dkBuildError(filename, `zcc could not be started: ${run.error}`)] };
    const output = `${run.stderr}\n${run.stdout}`;
    const diagnostics = parseZccDiagnostics(output, cwd, filename);
    // --- A Z88 application without its DOR fails to link on `applname` (`.ai/z88dk/targets.md`)
    if (/undefined symbol: applname/.test(output)) {
      diagnostics.push({
        ...z88dkBuildError(
          filename,
          "A Z88 application needs its DOR: #include <dor.h>, #define APP_NAME, APP_INFO and APP_KEY, then #include <application.h> (see the z88-dk project template)."
        ),
        isWarning: true
      });
    }
    if (run.exitCode !== 0 && !diagnostics.some((d) => !d.isWarning)) {
      const first = output.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
      diagnostics.push(z88dkBuildError(filename, `zcc failed (exit code ${run.exitCode})${first ? `: ${first}` : "."}`));
    }
    return { diagnostics };
  }
}

/** A C source line that can hold a breakpoint (the build's records decide where it binds). */
export function cLineCanHaveBreakpoint(line: string): boolean {
  const text = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "").trim();
  if (!text) return false;
  if (text.startsWith("#")) return false;
  if (/^[{}();]*$/.test(text)) return false;
  if (text.startsWith("/*") || text.startsWith("*")) return false;
  return true;
}

/** The application key a Z88 program defines (`#define APP_KEY 'K'`), else z88dk's default, `A`. */
export function appKeyOf(filename: string): string {
  try {
    const match = /^\s*#\s*define\s+APP_KEY\s+'([A-Za-z])'/m.exec(fs.readFileSync(filename, "utf8"));
    return match ? match[1].toUpperCase() : "A";
  } catch {
    return "A";
  }
}

function programName(file: string): string {
  return path.basename(file).replace(/\.[^.]*$/, "").replace(/[^A-Za-z0-9_-]/g, "_") || "program";
}

/** The map symbols of a build (exported for the debug adapter's tests). */
export type { Z88dkMapSymbol };
