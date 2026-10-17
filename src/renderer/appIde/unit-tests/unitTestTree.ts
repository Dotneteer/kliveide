import type { UnitTestCase } from "@common/unit-tests/discovery";
import type { UnitTestResult, UnitTestSummary } from "@common/unit-tests/unitTestTypes";
import { t } from "@common/i18n/i18n";

/*
 * The rows of the Unit Tests panel (`.plans/Z80_UNIT_TESTS_PLAN.md` D13): suites, each followed by
 * its tests, each test followed by its message line when it did not pass. Pure, so the tree, the
 * statuses and the filter are tested without rendering.
 */

/** A test's state in the panel */
export type UnitTestRowStatus = "passed" | "failed" | "error" | "running" | "queued" | "notRun";

export type UnitTestRow =
  | {
      kind: "suite";
      key: string;
      name: string;
      /** The worst status of its tests: failed, error, running, queued, passed, notRun */
      status: UnitTestRowStatus;
      count: number;
      failures: number;
    }
  | {
      kind: "test";
      key: string;
      test: UnitTestCase;
      status: UnitTestRowStatus;
      result?: UnitTestResult;
    }
  | {
      kind: "message";
      key: string;
      test: UnitTestCase;
      result: UnitTestResult;
    };

/** The name of a test's suite; the root suite has none */
export function suiteName(test: Pick<UnitTestCase, "suitePath">): string {
  return test.suitePath.join(".");
}

/** A test's state from its result and the run in progress */
export function testStatus(
  test: UnitTestCase,
  result: UnitTestResult | undefined,
  run: { running?: boolean; runningTest?: string; runIds?: string[] }
): UnitTestRowStatus {
  if (run.running && run.runningTest === test.id) return "running";
  if (result) return result.status;
  if (run.running && run.runIds?.includes(test.id)) return "queued";
  return "notRun";
}

const SEVERITY: UnitTestRowStatus[] = ["notRun", "passed", "queued", "running", "error", "failed"];

/**
 * The panel's rows
 * @param tests The discovered tests, in source order
 * @param results The last result of each test, by id
 * @param run The run in progress
 * @param filter Matched against the test id and the failure message, case-insensitively
 */
export function unitTestRows(
  tests: UnitTestCase[],
  results: Record<string, UnitTestResult>,
  run: { running?: boolean; runningTest?: string; runIds?: string[] },
  filter = ""
): UnitTestRow[] {
  const query = filter.trim().toLowerCase();
  const visible = query
    ? tests.filter(
        (tc) => tc.id.toLowerCase().includes(query) || (results[tc.id]?.message ?? "").toLowerCase().includes(query)
      )
    : tests;

  // --- Suites in the order their first test appears; the root suite's tests have no header
  const suites = new Map<string, UnitTestCase[]>();
  for (const test of visible) {
    const name = suiteName(test);
    if (!suites.has(name)) suites.set(name, []);
    suites.get(name)!.push(test);
  }

  const rows: UnitTestRow[] = [];
  for (const [name, members] of suites) {
    const statuses = members.map((tc) => testStatus(tc, results[tc.id], run));
    if (name) {
      rows.push({
        kind: "suite",
        key: `suite:${name}`,
        name,
        status: statuses.reduce((worst, s) => (SEVERITY.indexOf(s) > SEVERITY.indexOf(worst) ? s : worst), "notRun"),
        count: members.length,
        failures: statuses.filter((s) => s === "failed" || s === "error").length
      });
    }
    members.forEach((test, i) => {
      const result = results[test.id];
      rows.push({ kind: "test", key: `test:${test.id}`, test, status: statuses[i], result });
      if (result && result.status !== "passed" && result.message) {
        rows.push({ kind: "message", key: `msg:${test.id}`, test, result });
      }
    });
  }
  return rows;
}

/** `1,234 T` */
export function formatTstates(tstates: number): string {
  return `${tstates.toLocaleString("en-US")} T`;
}

/** A result as text, for Copy result */
export function resultText(test: UnitTestCase, result: UnitTestResult | undefined): string {
  if (!result) return t("debug.unitTest.result.notRun", { id: test.id });
  const head = result.errorKind
    ? t("debug.unitTest.result.headWithKind", {
        id: test.id,
        status: result.status,
        errorKind: result.errorKind,
        tstates: formatTstates(result.tstates)
      })
    : t("debug.unitTest.result.head", { id: test.id, status: result.status, tstates: formatTstates(result.tstates) });
  const lines = [head];
  if (result.message) lines.push(result.message);
  if (result.location) {
    lines.push(t("debug.unitTest.result.at", { location: `${result.location.file}:${result.location.line}` }));
  }
  for (const line of result.log ?? []) lines.push(t("debug.unitTest.result.log", { line }));
  return lines.join("\n");
}

/** `5 tests: 3 passed, 1 failed, 1 error` */
export function summaryText(summary: UnitTestSummary): string {
  return t("debug.unitTest.summary", {
    total: summary.total,
    passed: summary.passed,
    failed: summary.failed ?? 0,
    errors: summary.errors ?? 0,
    cancelled: summary.cancelled ? "yes" : "no"
  });
}
