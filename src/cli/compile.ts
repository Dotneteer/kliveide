import fs from "fs";
import os from "os";
import path from "path";

import type { BuildDiagnostic } from "@common/automation/protocol";
import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import type { AppState } from "@common/state/AppState";
import { checkSourceAnnotations } from "@common/utils/source-annotations";
import { createCompilerRegistry } from "@main/compiler-integration/compiler-registry";
import { SJASMP_EXECUTABLE_PATH, SJASMP_INSTALL_FOLDER } from "@main/sjasmp-integration/sjasmp-config";
import { getSjasmplusExecutableName } from "@main/sjasmp-integration/sjasmplus-resolver";
import { resolveSettingsFilePath } from "@main/settings-path";
import { CliError, EXIT_INTERNAL, usageError } from "./exit-codes";
import { buildRootPath, languageOf, type CliProject } from "./project";

/*
 * The compile step without the renderer (`.plans/UNIT_TESTS_CLI_PLAN.md` D5, D6, T4): the IDE's own
 * compiler registry, given a minimal `AppState` built from the project file and the command line.
 * The Klive assembler needs nothing from it; sjasmplus needs the project folder and its executable.
 */

/** What the compile step reads from the command line */
export type CompileOptions = {
  /** `--sjasmplus <path>` */
  sjasmplus?: string;
  /** `--use-ide-settings`: the IDE's user settings join the project's (Q4) */
  useIdeSettings?: boolean;
  /** `--machine` over the project's (the sjasmplus device follows it) */
  machineId?: string;
  modelId?: string;
};

export type CompileResult = {
  file: string;
  language: string;
  output: KliveCompilerOutput;
  /** Errors and warnings, in the gcc format's fields */
  diagnostics: BuildDiagnostic[];
  failed: boolean;
};

/** The IDE's user settings (`--use-ide-settings`), or an empty object */
export function readIdeUserSettings(env: NodeJS.ProcessEnv): Record<string, any> {
  try {
    const file = resolveSettingsFilePath(os.homedir(), env);
    const settings = JSON.parse(fs.readFileSync(file, "utf8"));
    return settings?.userSettings && typeof settings.userSettings === "object" ? settings.userSettings : {};
  } catch {
    return {};
  }
}

/** Reads a dotted setting (`sjasmp.executablePath`) from a nested settings object */
function readPath(settings: Record<string, any>, key: string): unknown {
  return key.split(".").reduce<any>((obj, part) => (obj && typeof obj === "object" ? obj[part] : undefined), settings);
}

/** Writes a dotted setting into a nested settings object */
function writePath(settings: Record<string, any>, key: string, value: unknown): void {
  const parts = key.split(".");
  let obj = settings;
  for (const part of parts.slice(0, -1)) {
    if (!obj[part] || typeof obj[part] !== "object") obj[part] = {};
    obj = obj[part];
  }
  obj[parts[parts.length - 1]] = value;
}

/** An executable on the PATH, or undefined */
export function findOnPath(name: string, env: NodeJS.ProcessEnv): string | undefined {
  const dirs = (env.PATH ?? env.Path ?? "").split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const candidate = path.join(dir, name);
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // --- Not here
    }
  }
  return undefined;
}

/**
 * The sjasmplus executable (T4): `--sjasmplus`, then `SJASMPLUS`, then the project's (or, with
 * `--use-ide-settings`, the IDE's) setting when the file exists, then `sjasmplus` on the PATH
 * @throws CliError (exit code 3) with a one-line fix when there is none
 */
export function resolveSjasmplus(options: CompileOptions, settings: Record<string, any>, env: NodeJS.ProcessEnv, cwd: string): string {
  const exe = getSjasmplusExecutableName();
  const explicit = options.sjasmplus ?? env.SJASMPLUS;
  if (explicit) {
    const full = path.resolve(cwd, explicit);
    if (!fs.existsSync(full)) {
      throw usageError(`sjasmplus was not found at ${full} (${options.sjasmplus ? "--sjasmplus" : "SJASMPLUS"}).`);
    }
    return full;
  }
  const configured = readPath(settings, SJASMP_EXECUTABLE_PATH);
  if (typeof configured === "string" && configured.trim() && fs.existsSync(configured.trim())) return configured.trim();
  const folder = readPath(settings, SJASMP_INSTALL_FOLDER);
  if (typeof folder === "string" && folder.trim() && fs.existsSync(path.join(folder.trim(), exe))) {
    return path.join(folder.trim(), exe);
  }
  const onPath = findOnPath(exe, env);
  if (onPath) return onPath;
  throw usageError("sjasmplus was not found: pass --sjasmplus <path>, set SJASMPLUS, or put sjasmplus on the PATH.");
}

/** The minimal `AppState` the compilers read (D5) */
export function minimalAppState(
  project: CliProject,
  projectSettings: Record<string, any>,
  userSettings: Record<string, any>,
  machineId?: string,
  modelId?: string
): AppState {
  return {
    project: {
      folderPath: project.folder.replace(/\\/g, "/"),
      isKliveProject: true,
      buildRoots: project.buildRoot ? [project.buildRoot] : []
    },
    projectSettings,
    userSettings,
    emulatorState: { machineId, modelId }
  } as unknown as AppState;
}

/** A compiler error in the gcc format's fields; paths relative to the project folder */
export function toDiagnostic(
  e: { filename?: string; line?: number; startColumn?: number; errorCode?: string; message: string; isWarning?: boolean },
  projectFolder: string
): BuildDiagnostic {
  const file = e.filename ? relativeTo(e.filename, projectFolder) : "";
  return {
    file,
    line: e.line ?? 0,
    ...(typeof e.startColumn === "number" ? { column: e.startColumn + 1 } : {}),
    ...(e.errorCode ? { code: e.errorCode } : {}),
    message: e.message,
    ...(e.isWarning ? { warning: true } : {})
  };
}

/** A path relative to the project folder when it is inside it, with forward slashes */
export function relativeTo(file: string, folder: string): string {
  const rel = path.relative(folder, file);
  return (rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : file).replace(/\\/g, "/");
}

/**
 * Compiles the project's build root
 * @throws CliError (exit code 3) for a missing build root, an unknown language or no sjasmplus
 */
export async function compileProject(project: CliProject, options: CompileOptions, env: NodeJS.ProcessEnv, cwd: string): Promise<CompileResult> {
  const file = buildRootPath(project);
  const userSettings = options.useIdeSettings ? readIdeUserSettings(env) : {};
  const projectSettings = structuredClone(project.settings);
  const language = languageOf(file, { ...userSettings, ...projectSettings });
  const registry = createCompilerRegistry();
  const compiler = language ? registry.getCompiler(language) : undefined;
  if (!language || !compiler) {
    throw usageError(`Klive has no compiler for the build root ${project.buildRoot}; check its file extension.`);
  }
  if (language === "sjasmp") {
    const merged = { ...userSettings, ...projectSettings };
    writePath(projectSettings, SJASMP_EXECUTABLE_PATH, resolveSjasmplus(options, merged, env, cwd));
  }
  compiler.setAppState?.(
    minimalAppState(project, projectSettings, userSettings, options.machineId ?? project.machineId, options.modelId ?? project.modelId)
  );
  let output: KliveCompilerOutput;
  try {
    output = checkSourceAnnotations((await compiler.compileFile(file)) as KliveCompilerOutput);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // --- A compiler that cannot start (a missing executable) is configuration, not a build error
    throw new CliError(`The ${language} compiler failed: ${message}`, /not (set up|found)|ENOENT/i.test(message) ? 3 : EXIT_INTERNAL);
  }
  if (typeof output === "string") throw new CliError(`The ${language} compiler failed: ${output}`, EXIT_INTERNAL);
  const diagnostics = (output.errors ?? []).map((e) => toDiagnostic(e as never, project.folder));
  return { file, language, output, diagnostics, failed: (output.errors ?? []).some((e) => !e.isWarning) };
}
