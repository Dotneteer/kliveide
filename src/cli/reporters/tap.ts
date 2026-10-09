import type { UnitTestCase } from "@common/unit-tests/discovery";
import { junitErrorType, type JUnitResult } from "@common/unit-tests/junit";
import { locationText, type ConsoleReporter, type RunTotals } from "./reporter";

/*
 * TAP 13 (`.plans/UNIT_TESTS_CLI_PLAN.md` D4): the plan line first (the tests are known before the
 * run), one `ok`/`not ok` line per test, and a YAML block under a failure. A test that never ran is
 * `ok … # SKIP`.
 */

export function createTapReporter(write: (line: string) => void): ConsoleReporter {
  let index = 0;
  const reported = new Set<string>();
  return {
    start(tests) {
      index = 0;
      reported.clear();
      write("TAP version 13");
      write(`1..${tests.length}`);
    },
    result(test: UnitTestCase, result: JUnitResult) {
      reported.add(test.id);
      index++;
      const comment = `# ${result.tstates} T`;
      if (result.status === "passed") {
        write(`ok ${index} - ${test.id} ${comment}`);
        return;
      }
      write(`not ok ${index} - ${test.id} ${comment}`);
      write("  ---");
      write(`  message: ${yamlString((result.message ?? "").split("\n")[0])}`);
      write(`  severity: ${result.status === "failed" ? "fail" : "error"}`);
      if (result.status === "error") write(`  type: ${junitErrorType(result)}`);
      const at = locationText(test, result);
      if (at) write(`  at: ${yamlString(at)}`);
      write(`  tstates: ${result.tstates}`);
      if (result.log?.length) {
        write("  log:");
        for (const line of result.log) write(`    - ${yamlString(line)}`);
      }
      write("  ...");
    },
    problem(message: string) {
      write(`# ${message}`);
    },
    finish(tests: readonly UnitTestCase[], totals: RunTotals) {
      for (const test of tests) {
        if (reported.has(test.id)) continue;
        index++;
        write(`ok ${index} - ${test.id} # SKIP not run`);
      }
      write(`# passed ${totals.passed}, failed ${totals.failed}, errors ${totals.errors}, skipped ${totals.skipped}`);
    }
  };
}

/** A YAML scalar in double quotes */
function yamlString(text: string): string {
  return JSON.stringify(text);
}
