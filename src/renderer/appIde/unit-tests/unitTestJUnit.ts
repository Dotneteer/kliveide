import type { AppState } from "@common/state/AppState";
import type { UnitTestProgram } from "@common/unit-tests/discovery";
import { toJUnitXml } from "@common/unit-tests/junit";

/**
 * The last run's results as JUnit (`.plans/UNIT_TESTS_CLI_PLAN.md` D14): the command line's writer
 * on the Test panel's results, so a file exported here matches the one `klive test --junit` writes
 * @returns The document, or why there is none
 */
export function junitOfLastRun(state: AppState, program: UnitTestProgram | undefined, withTimestamp = true): string {
  const unitTests = state.unitTests;
  const results = unitTests?.results ?? {};
  if (!program?.tests.length) return "Build the project first: the tests come from the last successful build.";
  const ran = new Set(unitTests?.runIds ?? Object.keys(results));
  const tests = program.tests.filter((t) => ran.has(t.id));
  if (!tests.length || !tests.some((t) => results[t.id])) return "Run the tests first: there are no results to export.";
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
