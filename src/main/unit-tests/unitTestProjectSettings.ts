import fs from "fs";
import path from "path";

import type { UnitTestProjectSettings } from "@common/unit-tests/unitTestTypes";
import { PROJECT_FILE } from "@common/structs/project-const";

/*
 * The `unitTests` section of `klive.project` (`.plans/Z80_UNIT_TESTS_PLAN.md` D19). The IDE has no
 * editor for it: users write it by hand, so the main process reads it from the file at every run and
 * a project save carries it over unchanged.
 */

/** The section as the project file holds it, or `undefined` */
export function readUnitTestSettings(projectFolder: string | undefined): UnitTestProjectSettings | undefined {
  if (!projectFolder) return undefined;
  try {
    const content = JSON.parse(fs.readFileSync(path.join(projectFolder, PROJECT_FILE), "utf8"));
    const section = content?.unitTests;
    return section && typeof section === "object" ? sanitize(section) : undefined;
  } catch {
    return undefined;
  }
}

/** Only the fields D19 names, each of the right type: a typo never reaches the runner */
export function sanitize(section: Record<string, unknown>): UnitTestProjectSettings {
  const result: UnitTestProjectSettings = {};
  if (typeof section.timeout === "number" && section.timeout > 0) result.timeout = section.timeout;
  if (section.boot === "rom" || section.boot === "none") result.boot = section.boot;
  if (typeof section.stopAtStart === "boolean") result.stopAtStart = section.stopAtStart;
  if (typeof section.machine === "string" && section.machine) result.machine = section.machine;
  if (typeof section.model === "string" && section.model) result.model = section.model;
  if (Array.isArray(section.include)) {
    const include = section.include.filter((p): p is string => typeof p === "string" && !!p);
    if (include.length) result.include = include;
  }
  return result;
}

/** The raw section to keep when the IDE rewrites the project file */
export function rawUnitTestSection(projectFolder: string | undefined): unknown {
  if (!projectFolder) return undefined;
  try {
    return JSON.parse(fs.readFileSync(path.join(projectFolder, PROJECT_FILE), "utf8"))?.unitTests;
  } catch {
    return undefined;
  }
}
