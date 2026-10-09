import type { UnitTestCase } from "./discovery";
import type { UnitTestErrorKind, UnitTestResult } from "./unitTestTypes";

/*
 * JUnit XML of a unit-test run (`.plans/UNIT_TESTS_CLI_PLAN.md` D7, T2, D10, D14). Shared by the
 * `klive test --junit` command line and the Test panel's "Export results as JUnit…", so a file made
 * in the IDE matches the one CI makes.
 *
 * - `testsuites` (the project) holds one `testsuite` per suite path, in discovery order.
 * - Each test is a `testcase`: `classname` is the suite path, `name` the `UT_` label as written,
 *   `file`/`line` where the label is defined.
 * - `time` is **emulated** seconds (T-states ÷ the machine's clock; T2), so two runs write the same
 *   file. The exact figure is the `tstates` property.
 * - A failed assertion is a `<failure type="assertion">`; a stack guard, timeout, HALT, setup
 *   problem, RET or crash is an `<error>` of its own type. LOGPOINT output goes to `<system-out>`.
 * - A selected test that never ran (`--bail`, a crash) is `<skipped/>`.
 */

/** A result as JUnit sees it: the runner's, or a crash the command line caught (T8) */
export type JUnitResult = Omit<UnitTestResult, "errorKind"> & { errorKind?: UnitTestErrorKind | "internal" };

export type JUnitInput = {
  /** The `testsuites` name: the project's folder name */
  name: string;
  /** The tests the run selected, in discovery order */
  tests: readonly UnitTestCase[];
  /** The results, by test id; a selected test without one was skipped */
  results: Readonly<Record<string, JUnitResult | undefined>>;
  /** The machine's clock in Hz; `time` is 0 without it */
  clockHz?: number;
  /** ISO time of the run; omitted (`--no-timestamp`) for byte-identical files */
  timestamp?: string;
  /** File paths inside it are written relative to it, so the file is the same on every computer */
  projectFolder?: string;
};

/** A path relative to the project folder when it is inside it, with forward slashes */
export function projectRelative(file: string, folder: string | undefined): string {
  const p = file.replace(/\\/g, "/");
  if (!folder) return p;
  const f = folder.replace(/\\/g, "/").replace(/\/$/, "");
  return p.startsWith(`${f}/`) ? p.slice(f.length + 1) : p;
}

/** The root suite's name in JUnit (tests outside any module) */
export const ROOT_SUITE_NAME = "(root)";

/** The JUnit error `type` of a runner error kind (D7) */
export function junitErrorType(result: JUnitResult): string {
  switch (result.errorKind) {
    case "stack":
      return /underflow/i.test(result.message ?? "") ? "stack-underflow" : "stack-overflow";
    case undefined:
      return "error";
    default:
      return result.errorKind;
  }
}

/** Writes the JUnit document */
export function toJUnitXml(input: JUnitInput): string {
  const seconds = (tstates: number) => (input.clockHz ? tstates / input.clockHz : 0).toFixed(6);

  // --- Group by suite path, keeping discovery order
  const suites = new Map<string, UnitTestCase[]>();
  for (const test of input.tests) {
    const name = test.suitePath.join(".") || ROOT_SUITE_NAME;
    let list = suites.get(name);
    if (!list) suites.set(name, (list = []));
    list.push(test);
  }

  type Totals = { tests: number; failures: number; errors: number; skipped: number; tstates: number };
  const totalsOf = (tests: readonly UnitTestCase[]): Totals => {
    const t: Totals = { tests: tests.length, failures: 0, errors: 0, skipped: 0, tstates: 0 };
    for (const test of tests) {
      const r = input.results[test.id];
      if (!r) t.skipped++;
      else {
        t.tstates += r.tstates;
        if (r.status === "failed") t.failures++;
        else if (r.status === "error") t.errors++;
      }
    }
    return t;
  };
  const totalAttrs = (t: Totals) =>
    `tests="${t.tests}" failures="${t.failures}" errors="${t.errors}" skipped="${t.skipped}" time="${seconds(t.tstates)}"`;

  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
  const all = totalsOf(input.tests);
  const stamp = input.timestamp ? ` timestamp="${xmlAttr(input.timestamp)}"` : "";
  lines.push(`<testsuites name="${xmlAttr(input.name)}" ${totalAttrs(all)}${stamp}>`);
  for (const [suite, tests] of suites) {
    lines.push(`  <testsuite name="${xmlAttr(suite)}" ${totalAttrs(totalsOf(tests))}>`);
    for (const test of tests) {
      lines.push(...testCaseLines(test, input.results[test.id], suite, seconds, (f) => projectRelative(f, input.projectFolder)));
    }
    lines.push("  </testsuite>");
  }
  lines.push("</testsuites>");
  return lines.join("\n") + "\n";
}

function testCaseLines(
  test: UnitTestCase,
  result: JUnitResult | undefined,
  suite: string,
  seconds: (tstates: number) => string,
  rel: (file: string) => string
): string[] {
  const where =
    (test.file ? ` file="${xmlAttr(rel(test.file))}"` : "") + (test.line !== undefined ? ` line="${test.line}"` : "");
  const head = `    <testcase classname="${xmlAttr(suite)}" name="${xmlAttr(test.label)}"${where} time="${seconds(result?.tstates ?? 0)}"`;
  if (!result) return [`${head}>`, "      <skipped/>", "    </testcase>"];

  const lines = [`${head}>`, "      <properties>", `        <property name="tstates" value="${result.tstates}"/>`, "      </properties>"];
  if (result.status !== "passed") {
    const tag = result.status === "failed" ? "failure" : "error";
    const type = result.status === "failed" ? "assertion" : junitErrorType(result);
    const message = result.message ?? (tag === "failure" ? "Assertion failed" : "Error");
    // --- The first line is the attribute; the body has the location and the whole description
    const firstLine = message.split("\n")[0];
    const at = result.location ? `${rel(result.location.file)}:${result.location.line}\n` : "";
    lines.push(`      <${tag} message="${xmlAttr(firstLine)}" type="${type}">${xmlText(at + message)}</${tag}>`);
  }
  if (result.log?.length) lines.push(`      <system-out>${xmlText(result.log.join("\n"))}</system-out>`);
  lines.push("    </testcase>");
  return lines;
}

/** Characters XML 1.0 cannot hold at all: dropped */
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

/** Escapes text content */
export function xmlText(text: string): string {
  return text.replace(INVALID_XML, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escapes an attribute value (line breaks kept as character references) */
export function xmlAttr(text: string): string {
  return xmlText(text)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/\n/g, "&#10;")
    .replace(/\r/g, "&#13;")
    .replace(/\t/g, "&#9;");
}
