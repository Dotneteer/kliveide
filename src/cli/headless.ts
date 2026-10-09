import fs from "fs";
import path from "path";

import type { IFileProvider } from "@renderer/core/IFileProvider";
import { createHeadlessMachine, type HeadlessMachine } from "@common/headless/HeadlessMachineFactory";
import { artifactNameOf, headlessUnsupportedMessage } from "@common/headless/headlessMachines";
import { findWasmArtifact } from "@main/unit-tests/wasmArtifacts";
import { CliError, EXIT_INTERNAL, usageError } from "./exit-codes";

/*
 * The machine a headless verb runs (`.plans/UNIT_TESTS_CLI_PLAN.md` D6, T3): G5.5's factory, the
 * core's bytes read from a real file path and the ROMs from the app's public folder, with
 * `--rom <name>=<file>` and the project's `unitTests.roms` taking a ROM's place. Nothing here reads
 * the IDE's settings.
 */

/** The ROMs Klive ships, and the overrides by ROM name (`sp48` stands for `roms/sp48.rom`) */
export class CliRomProvider implements IFileProvider {
  constructor(
    private readonly publicFolder: string,
    private readonly overrides: Record<string, string> = {}
  ) {}
  async readTextFile(file: string): Promise<string> {
    return fs.readFileSync(this.resolve(file), "utf8");
  }
  async readBinaryFile(file: string): Promise<Uint8Array> {
    return new Uint8Array(fs.readFileSync(this.resolve(file)));
  }
  writeTextFile(): Promise<void> {
    throw new Error("The command line does not write machine files.");
  }
  writeBinaryFile(): Promise<void> {
    throw new Error("The command line does not write machine files.");
  }
  resolve(file: string): string {
    const m = file.replace(/\\/g, "/").match(/^roms\/(.+)\.rom$/);
    if (m && this.overrides[m[1]]) return this.overrides[m[1]];
    return path.isAbsolute(file) ? file : path.join(this.publicFolder, file);
  }
}

/**
 * A packaged app's resources folder, when the bundle runs from one: the bundle is
 * `<resources>/app.asar/out/main/cli.js` (or `app/` without an asar), and the folder holds the ROMs
 * and the cores' `wasm/` copies outside the asar (package.json `extraResources`)
 */
export function findResourcesFolder(baseDir: string): string | undefined {
  const candidate = path.resolve(baseDir, "../../..");
  return fs.existsSync(path.join(candidate, "roms")) && fs.existsSync(path.join(candidate, "wasm")) ? candidate : undefined;
}

/**
 * The app's public folder (ROMs and firmware): `PUBLIC`, a packaged app's resources folder, the
 * renderer's output next to the bundle, or the repository's `src/public` above it
 */
export function findPublicFolder(baseDir: string, env: NodeJS.ProcessEnv): string | undefined {
  if (env.PUBLIC && fs.existsSync(env.PUBLIC)) return env.PUBLIC;
  const resources = findResourcesFolder(baseDir);
  if (resources) return resources;
  const beside = path.join(baseDir, "../renderer");
  if (fs.existsSync(path.join(beside, "roms"))) return beside;
  let dir = baseDir;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "src/public");
    if (fs.existsSync(path.join(candidate, "roms"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/**
 * `--rom <name>=<file>` and the project's ROMs, as absolute paths that exist
 * @throws CliError (exit code 3) for a malformed option or a missing file
 */
export function romOverrides(
  options: string[] | undefined,
  projectRoms: Record<string, string>,
  projectFolder: string,
  cwd: string
): Record<string, string> {
  const result: Record<string, string> = {};
  const add = (name: string, file: string, base: string, where: string) => {
    const full = path.resolve(base, file);
    if (!fs.existsSync(full)) throw usageError(`The ROM file ${full} (${where}) does not exist.`);
    result[name] = full;
  };
  for (const [name, file] of Object.entries(projectRoms)) add(name, file, projectFolder, `unitTests.roms.${name}`);
  for (const option of options ?? []) {
    const eq = option.indexOf("=");
    if (eq <= 0 || eq === option.length - 1) {
      throw usageError(`--rom takes <name>=<file>, where <name> is the ROM it replaces (sp48, sp128-0, ...): '${option}'.`);
    }
    add(option.slice(0, eq).trim(), option.slice(eq + 1).trim(), cwd, "--rom");
  }
  return result;
}

export type CliMachineSpec = {
  machineId: string;
  modelId?: string;
  config?: Record<string, any>;
  romOverrides: Record<string, string>;
  /** Where the bundle runs from: the core and the ROMs are found from here */
  baseDir: string;
  env: NodeJS.ProcessEnv;
};

/**
 * Creates the machine
 * @throws CliError: exit code 3 for an unsupported machine, 4 for a missing core or ROM folder
 */
export async function createCliMachine(spec: CliMachineSpec): Promise<HeadlessMachine> {
  const unsupported = headlessUnsupportedMessage(spec.machineId);
  if (unsupported) throw usageError(unsupported);
  const artifactName = artifactNameOf(spec.machineId);
  const artifactPath = spec.env.KLIVE_CLI_WASM_DIR
    ? path.join(spec.env.KLIVE_CLI_WASM_DIR, artifactName)
    : findWasmArtifact(artifactName, spec.baseDir, findResourcesFolder(spec.baseDir));
  if (!artifactPath || !fs.existsSync(artifactPath)) {
    throw new CliError(`The ${artifactName} machine core was not found next to the command line.`, EXIT_INTERNAL);
  }
  const publicFolder = findPublicFolder(spec.baseDir, spec.env);
  if (!publicFolder) throw new CliError("Klive's ROM folder was not found next to the command line.", EXIT_INTERNAL);
  try {
    return await createHeadlessMachine({
      machineId: spec.machineId,
      modelId: spec.modelId,
      config: spec.config,
      readArtifact: () => new Uint8Array(fs.readFileSync(artifactPath)),
      fileProvider: new CliRomProvider(publicFolder, spec.romOverrides)
    });
  } catch (err) {
    throw new CliError(`The machine could not be created: ${err instanceof Error ? err.message : String(err)}`, EXIT_INTERNAL);
  }
}
