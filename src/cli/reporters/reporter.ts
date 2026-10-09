import type { UnitTestCase } from "@common/unit-tests/discovery";
import type { JUnitResult } from "@common/unit-tests/junit";
import type { UnitTestSummary } from "@common/unit-tests/unitTestTypes";

/*
 * What `klive test` streams to the console (`.plans/UNIT_TESTS_CLI_PLAN.md` D4): one reporter at a
 * time, chosen by `--reporter` or by whether stdout is a terminal (T6). JUnit and LCOV are files,
 * written after the run.
 */

export type ReporterName = "pretty" | "plain" | "tap";

export type RunTotals = UnitTestSummary & {
  /** Selected tests that did not run (`--bail`, a crash) */
  skipped: number;
  /** Wall-clock milliseconds: the console's summary only, never a file (T2) */
  wallMs: number;
};

export interface ConsoleReporter {
  /** The run starts with these tests */
  start(tests: readonly UnitTestCase[]): void;
  /** A test ended */
  result(test: UnitTestCase, result: JUnitResult): void;
  /** Something stopped the run, or is worth saying */
  problem(message: string): void;
  /** The run ended */
  finish(tests: readonly UnitTestCase[], totals: RunTotals): void;
}

/** "3 passed, 1 failed, 1 error" */
export function totalsText(t: RunTotals): string {
  const parts = [`${t.passed} passed`];
  if (t.failed) parts.push(`${t.failed} failed`);
  if (t.errors) parts.push(`${t.errors} error${t.errors === 1 ? "" : "s"}`);
  if (t.skipped) parts.push(`${t.skipped} skipped`);
  return `${parts.join(", ")} of ${t.total} test${t.total === 1 ? "" : "s"}`;
}

/** The default reporter (T6): `plain` unless stdout is a terminal and neither `NO_COLOR` nor `CI` is set */
export function defaultReporter(isTty: boolean, env: NodeJS.ProcessEnv): ReporterName {
  return isTty && !env.NO_COLOR && !env.CI ? "pretty" : "plain";
}

/** A result's location, `file:line` */
export function locationText(test: UnitTestCase, result: JUnitResult): string | undefined {
  if (result.location) return `${result.location.file}:${result.location.line}`;
  if (test.file) return `${test.file}${test.line !== undefined ? `:${test.line}` : ""}`;
  return undefined;
}
