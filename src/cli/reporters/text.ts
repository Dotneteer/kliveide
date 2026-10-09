import type { UnitTestCase } from "@common/unit-tests/discovery";
import { ROOT_SUITE_NAME, junitErrorType, type JUnitResult } from "@common/unit-tests/junit";
import { locationText, totalsText, type ConsoleReporter, type RunTotals } from "./reporter";

/*
 * The `pretty` and `plain` reporters (`.plans/UNIT_TESTS_CLI_PLAN.md` D4, T6): suites, one line per
 * test with its T-states, and the failure's message under it with `file:line`. `pretty` adds colour
 * and ✔/✘; `plain` is the same text in ASCII without escape codes, for CI logs.
 */

const ESC = "\u001b[";
const paint = (code: string, text: string) => `${ESC}${code}m${text}${ESC}0m`;

export function createTextReporter(write: (line: string) => void, pretty: boolean): ConsoleReporter {
  const c = {
    suite: (t: string) => (pretty ? paint("1;34", t) : t),
    pass: (t: string) => (pretty ? paint("32", t) : t),
    fail: (t: string) => (pretty ? paint("31", t) : t),
    dim: (t: string) => (pretty ? paint("2", t) : t),
    warn: (t: string) => (pretty ? paint("33", t) : t)
  };
  const marks = pretty ? { pass: "✔", fail: "✘", error: "✘" } : { pass: "ok   ", fail: "FAIL ", error: "ERROR" };
  let suite: string | undefined;

  return {
    start() {
      suite = undefined;
    },
    result(test: UnitTestCase, result: JUnitResult) {
      const name = test.suitePath.join(".") || ROOT_SUITE_NAME;
      if (name !== suite) {
        suite = name;
        write(c.suite(name));
      }
      const tstates = c.dim(`${result.tstates.toLocaleString("en-US")} T`);
      const logLines = () => {
        for (const line of result.log ?? []) write(c.dim(`      log: ${line}`));
      };
      if (result.status === "passed") {
        write(`  ${c.pass(marks.pass)} ${test.label}  ${tstates}`);
        logLines();
        return;
      }
      const kind = result.status === "failed" ? "" : ` [${junitErrorType(result)}]`;
      write(`  ${c.fail(result.status === "failed" ? marks.fail : marks.error)} ${test.label}${kind}  ${tstates}`);
      const where = locationText(test, result);
      const message = (result.message ?? "").split("\n");
      write(`      ${where ? `${where}: ` : ""}${message[0]}`);
      for (const line of message.slice(1)) write(`      ${line}`);
      logLines();
    },
    problem(message: string) {
      write(c.warn(message));
    },
    finish(_tests, totals: RunTotals) {
      const ok = !totals.failed && !totals.errors && !totals.skipped;
      const seconds = (totals.wallMs / 1000).toFixed(2);
      write("");
      write(`${ok ? c.pass(totalsText(totals)) : c.fail(totalsText(totals))} ${c.dim(`(${seconds}s)`)}`);
    }
  };
}
