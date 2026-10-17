import type { AppState } from "@common/state/AppState";
import type { UnitTestProgram } from "@common/unit-tests/discovery";
import { toJUnitXml } from "@common/unit-tests/junit";
import { t } from "@common/i18n/i18n";

/**
 * The last run's results as JUnit (`.plans/UNIT_TESTS_CLI_PLAN.md` D14): the command line's writer
 * on the Test panel's results, so a file exported here matches the one `klive test --junit` writes
 * @returns The document, or why there is none
 */
export function junitOfLastRun(state: AppState, program: UnitTestProgram | undefined, withTimestamp = true): string {
  const unitTests = state.unitTests;
  const results = unitTests?.results ?? {};
  if (!program?.tests.length) return t("debug.unitTest.junit.noBuild");
  const ran = new Set(unitTests?.runIds ?? Object.keys(results));
  const tests = program.tests.filter((tc) => ran.has(tc.id));
  if (!tests.length || !tests.some((tc) => results[tc.id])) return t("debug.unitTest.junit.noResults");
  const folder = state.project?.folderPath;
  return toJUnitXml({
    name: folder?.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? "klive",
    tests,
    results,
    clockHz: unitTests?.summary?.clockHz,
    projectFolder: folder,
    ...(withTimestamp && unitTests?.startedAt ? { timestamp: new Date(unitTests.startedAt).toISOString() } : {})
  });
}
