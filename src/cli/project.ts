import fs from "fs";
import path from "path";

import type { UnitTestProjectSettings } from "@common/unit-tests/unitTestTypes";
import { LANGUAGE_SETTINGS, PROJECT_FILE } from "@common/structs/project-const";
import { sanitize } from "@main/unit-tests/unitTestProjectSettings";
import { usageError } from "./exit-codes";

/*
 * `klive.project` read without Electron (`.plans/UNIT_TESTS_CLI_PLAN.md` D2, D6, D13): the build
 * root, the machine, the project's settings (compiler settings live there) and the `unitTests`
 * section. The IDE's loader (`src/main/projects.ts`) applies a project to the store; this one only
 * reads the fields a headless build and test run need.
 */

export type CliProject = {
  /** The project folder, absolute */
  folder: string;
  /** The project's name: its folder's */
  name: string;
  /** The build root as the project names it (relative to the folder), or undefined */
  buildRoot?: string;
  /** The machine and model the project runs on */
  machineId?: string;
  modelId?: string;
  config?: Record<string, any>;
  /** The project's settings (`settings`): sjasmplus, compiler options, language extensions */
  settings: Record<string, any>;
  /** The `unitTests` section, sanitized */
  unitTests: UnitTestProjectSettings;
  /** `unitTests.roms`: ROM overrides by name, paths relative to the project folder (D6) */
  roms: Record<string, string>;
};

/**
 * Reads a project
 * @param dir The project folder (relative to `cwd`)
 * @throws CliError (exit code 3) when there is no readable project
 */
export function loadProject(dir: string, cwd: string): CliProject {
  const folder = path.resolve(cwd, dir);
  const file = path.join(folder, PROJECT_FILE);
  if (!fs.existsSync(file)) {
    throw usageError(`No Klive project in ${folder}: ${PROJECT_FILE} is missing.`);
  }
  let content: any;
  try {
    content = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    throw usageError(`${file} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!content || typeof content !== "object") throw usageError(`${file} does not hold a Klive project.`);

  const roots = content.builder?.roots;
  const buildRoot = Array.isArray(roots) && typeof roots[0] === "string" && roots[0] ? roots[0] : undefined;
  const section = content.unitTests && typeof content.unitTests === "object" ? content.unitTests : {};
  const roms: Record<string, string> = {};
  if (section.roms && typeof section.roms === "object") {
    for (const [name, value] of Object.entries(section.roms)) {
      if (typeof value === "string" && value) roms[name] = value;
    }
  }
  return {
    folder,
    name: path.basename(folder),
    buildRoot,
    machineId: typeof content.machineType === "string" ? content.machineType : undefined,
    modelId: typeof content.modelId === "string" ? content.modelId : undefined,
    config: content.config && typeof content.config === "object" ? content.config : undefined,
    settings: content.settings && typeof content.settings === "object" ? content.settings : {},
    unitTests: sanitize(section),
    roms
  };
}

/** The build root's absolute path, or a usage error */
export function buildRootPath(project: CliProject): string {
  if (!project.buildRoot) {
    throw usageError(`The project in ${project.folder} has no build root. Select one in the IDE (Explorer › Promote to Build Root).`);
  }
  const full = path.resolve(project.folder, project.buildRoot);
  if (!fs.existsSync(full)) throw usageError(`The build root ${project.buildRoot} does not exist.`);
  return full;
}

/**
 * The compiler language of a build root, as the IDE's file-type registry names it: the project's
 * own `languages` extensions first (`{ "sjasmp": ".z80|.s" }`), then the built-in extensions
 */
export function languageOf(file: string, settings: Record<string, any>): string | undefined {
  const name = path.basename(file);
  const extension = name.includes(".") ? name.slice(name.indexOf(".")) : "";
  const custom = settings[LANGUAGE_SETTINGS];
  if (custom && typeof custom === "object") {
    for (const [language, exts] of Object.entries(custom)) {
      if (typeof exts === "string" && exts.split("|").some((e) => e.trim() === extension)) return language;
    }
  }
  const lower = name.toLowerCase();
  // --- The order of the IDE's registry (`src/renderer/registry.ts`): longer extensions first
  const builtIn: [string, string][] = [
    [".kz80.asm", "kz80-asm"],
    [".6510.asm", "6510-asm"],
    [".zxb.asm", "zxbasm"],
    [".sjasm", "sjasmp"],
    [".asm", "kz80-asm"],
    [".zxbas", "zxbas"],
    [".bas", "zxbas"],
    [".pas", "pasta80"]
  ];
  return builtIn.find(([ext]) => lower.endsWith(ext))?.[1];
}
