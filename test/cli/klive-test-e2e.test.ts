import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import type { CliIo } from "../../src/cli/io";
import { runCli } from "../../src/cli/run-cli";
import { KLIVE_UNIT_TEST_INCLUDE } from "@main/unit-tests/includes/kliveInclude";
import { parseLcov } from "@common/profile/coverageExport";
import type { AppState } from "@common/state/AppState";
import type { UnitTestResult } from "@common/unit-tests/unitTestTypes";
import { discoverUnitTests } from "@common/unit-tests/discovery";
import { toRunnableCompilation } from "@common/unit-tests/runnableCompilation";
import { runUnitTests } from "@main/unit-tests/UnitTestRunner";
import { junitOfLastRun } from "@renderer/appIde/unit-tests/unitTestJUnit";
import { compileProject } from "../../src/cli/compile";
import { createCliMachine } from "../../src/cli/headless";
import { loadProject } from "../../src/cli/project";
import { buildSp48Wasm } from "../../scripts/build-sp48-wasm.cjs";

/*
 * `klive test` and `klive build` end to end (`.plans/UNIT_TESTS_CLI_PLAN.md` Phase 1, §6): the real
 * command line, in this process, on the fixture projects under `test/cli/fixtures/` - compiled by the
 * Klive assembler and run on the real 48K core with its ROM. It checks D3's exit codes 0-4, the JUnit
 * file (D7) and its byte identity between runs (D10), LCOV (D8) and TAP (D4).
 */

const FIXTURES = path.join(__dirname, "fixtures");

type Run = { code: number; out: string[]; err: string[]; files: Record<string, string> };

async function klive(argv: string[], env: NodeJS.ProcessEnv = {}): Promise<Run> {
  const out: string[] = [];
  const err: string[] = [];
  const files: Record<string, string> = {};
  const io: CliIo = {
    out: (t) => out.push(t),
    err: (t) => err.push(t),
    outBytes: () => {},
    writeFile: (file, data) => {
      const full = path.resolve(FIXTURES, file);
      files[path.basename(file)] = typeof data === "string" ? data : Buffer.from(data).toString("latin1");
      return full;
    },
    env: { PATH: "", ...env },
    cwd: FIXTURES,
    isTty: false,
    waitForInterrupt: () => new Promise(() => {})
  };
  const code = await runCli(argv, io);
  return { code, out, err, files };
}

beforeAll(() => {
  buildSp48Wasm();
}, 120_000);

describe("klive test", () => {
  it("keeps the fixture's include in step with Klive's", () => {
    expect(fs.readFileSync(path.join(FIXTURES, "sp48/code/unit_tests.kz80.asm"), "utf8")).toBe(KLIVE_UNIT_TEST_INCLUDE);
  });

  it("passes the passing project with exit code 0 and the plain reporter off a terminal", async () => {
    const run = await klive(["test", "sp48"]);
    expect(run.err).toEqual([]);
    expect(run.code).toBe(0);
    expect(run.out[0]).toBe("Math");
    expect(run.out[1]).toMatch(/^ {2}ok {4}UT_AddSmall {2}[\d,]+ T$/);
    expect(run.out).toContain("Strings");
    expect(run.out.some((l) => l === "      log: length is $05")).toBe(true);
    expect(run.out[run.out.length - 1]).toMatch(/^4 passed of 4 tests \(\d+\.\d\ds\)$/);
    expect(run.out.join("\n")).not.toMatch(/\u001b/);
  }, 60_000);

  it("lists the tests with --list (exit code 0) and filters them", async () => {
    const list = await klive(["test", "sp48", "--list"]);
    expect(list.code).toBe(0);
    expect(list.out).toEqual([
      expect.stringMatching(/^Math\.UT_AddSmall {2}code\/main\.kz80\.asm:\d+$/),
      expect.stringMatching(/^Math\.UT_AddWraps /),
      expect.stringMatching(/^Strings\.UT_Length /),
      expect.stringMatching(/^Strings\.UT_Empty /)
    ]);
    const filtered = await klive(["test", "sp48", "--list", "--filter", "Strings.*", "--filter", "*.UT_AddWraps"]);
    expect(filtered.out.map((l) => l.split(" ")[0])).toEqual(["Math.UT_AddWraps", "Strings.UT_Length", "Strings.UT_Empty"]);
  }, 60_000);

  it("fails with exit code 1 and writes JUnit with failures, errors and escaping", async () => {
    const run = await klive(["test", "failing", "--junit", "results.xml", "--no-timestamp", "--timeout", "0.1"]);
    expect(run.code).toBe(1);
    const xml = run.files["results.xml"];
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<testsuites name="failing" tests="5" failures="1" errors="2" skipped="0" time="[\d.]+">/);
    expect(xml).not.toContain("timestamp=");
    expect(xml).toContain('<testsuite name="(root)" tests="1" failures="0" errors="0"');
    expect(xml).toMatch(/<testcase classname="Suite" name="UT_Fail" file="code\/main\.kz80\.asm" line="\d+" time="\d\.\d{6}">/);
    expect(xml).toMatch(/<failure message="ASSERTION failed at main\.kz80\.asm:\d+: A == B {2}\(A=\$07, B=\$05\)" type="assertion">code\/main\.kz80\.asm:\d+\nASSERTION failed/);
    expect(xml).toMatch(/<error message="Stack overflow: UT_Overflow[^"]*" type="stack-overflow">/);
    expect(xml).toMatch(/<testcase classname="Slow" name="UT_Timeout"[^>]*>[\s\S]*?<error message="[^"]*" type="timeout">/);
    expect(xml).toContain("<system-out>&lt;a &amp; \"b\"&gt; 'c'</system-out>");
    expect(xml).toMatch(/<property name="tstates" value="\d+"\/>/);
    // --- The console names the failing line
    expect(run.out).toContain(run.out.find((l) => /^ {6}code\/main\.kz80\.asm:\d+: ASSERTION failed/.test(l)));
    expect(run.out.some((l) => /^ {2}ERROR UT_Overflow \[stack-overflow\] {2}[\d,]+ T$/.test(l))).toBe(true);
  }, 60_000);

  it("writes a byte-identical JUnit file on every run (D10), with a timestamp only when asked", async () => {
    const a = await klive(["test", "failing", "--junit", "a.xml", "--no-timestamp", "--timeout", "0.1"]);
    const b = await klive(["test", "failing", "--junit", "b.xml", "--no-timestamp", "--timeout", "0.1"]);
    expect(a.files["a.xml"]).toBe(b.files["b.xml"]);
    const stamped = await klive(["test", "sp48", "--junit", "c.xml"]);
    expect(stamped.files["c.xml"]).toMatch(/<testsuites [^>]* timestamp="\d{4}-\d\d-\d\dT[^"]+Z">/);
  }, 120_000);

  it("stops at the first failure with --bail; the rest are skipped", async () => {
    const run = await klive(["test", "failing", "--bail", "--junit", "bail.xml", "--no-timestamp"]);
    expect(run.code).toBe(1);
    expect(run.files["bail.xml"]).toMatch(/<testsuites name="failing" tests="5" failures="1" errors="0" skipped="3"/);
    expect(run.files["bail.xml"]).toContain("<skipped/>");
  }, 60_000);

  it("reports TAP 13", async () => {
    const run = await klive(["test", "failing", "--reporter", "tap", "--timeout", "0.1", "--filter", "*Fail", "--filter", "UT_Pass"]);
    expect(run.code).toBe(1);
    expect(run.out.slice(0, 2)).toEqual(["TAP version 13", "1..2"]);
    expect(run.out).toContain(run.out.find((l) => /^ok 1 - UT_Pass # \d+ T$/.test(l)));
    expect(run.out.some((l) => /^not ok 2 - Suite\.UT_Fail # \d+ T$/.test(l))).toBe(true);
    expect(run.out).toContain("  severity: fail");
  }, 60_000);

  it("writes LCOV coverage of the source lines (D8)", async () => {
    const run = await klive(["test", "sp48", "--coverage", "coverage.lcov"]);
    expect(run.code).toBe(0);
    const records = parseLcov(run.files["coverage.lcov"]);
    const main = records.find((r) => r.path === "code/main.kz80.asm");
    expect(main).toBeDefined();
    expect(main!.hit).toBeGreaterThan(0);
    // --- Main's RET never runs: not every line is hit
    expect(main!.hit).toBeLessThan(main!.found);
    const kcov = await klive(["test", "sp48", "--coverage", "run.kcov", "--coverage-format", "kcov"]);
    expect(JSON.parse(kcov.files["run.kcov"])).toMatchObject({ format: "kcov", version: 1 });
  }, 120_000);

  it("ends a build with errors with exit code 2, in the gcc format", async () => {
    const run = await klive(["test", "build-error"]);
    expect(run.code).toBe(2);
    expect(run.err[0]).toMatch(/^code\/main\.kz80\.asm:6:\d+: error: Z\d+: .*UndefinedSymbol/i);
    expect(run.err[run.err.length - 1]).toBe("Build failed: 1 error(s).");
    const build = await klive(["build", "build-error"]);
    expect(build.code).toBe(2);
  }, 60_000);

  it("ends configuration problems with exit code 3", async () => {
    const noTests = await klive(["test", "no-tests"]);
    expect(noTests.code).toBe(3);
    expect(noTests.err).toEqual(["The project has no unit tests: no UT_ labels in the build."]);

    const noMatch = await klive(["test", "sp48", "--filter", "Nope.*"]);
    expect(noMatch.code).toBe(3);
    expect(noMatch.err).toEqual(["No unit test matches 'Nope.*'."]);

    const noProject = await klive(["test", "missing-folder"]);
    expect(noProject.code).toBe(3);
    expect(noProject.err[0]).toMatch(/^No Klive project in .*missing-folder: klive\.project is missing\.$/);

    expect((await klive(["test", "sp48", "--machine", "z88"])).code).toBe(3);
    expect((await klive(["test", "sp48", "--reporter", "fancy"])).code).toBe(3);
    expect((await klive(["test", "sp48", "--rom", "sp48=nowhere.rom"])).code).toBe(3);
    expect((await klive(["test", "sp48", "--nope"])).code).toBe(3);
  }, 60_000);

  it("ends an internal error (no machine core) with exit code 4", async () => {
    const run = await klive(["test", "sp48"], { KLIVE_CLI_WASM_DIR: path.join(os.tmpdir(), "klive-no-such-folder") });
    expect(run.code).toBe(4);
    expect(run.err[0]).toBe("The zx-spectrum48.wasm machine core was not found next to the command line.");
  }, 60_000);

  it("uses a ROM from --rom in place of the shipped one", async () => {
    // --- The shipped ROM under another name: the same results
    const rom = path.join(__dirname, "../../src/public/roms/sp48.rom");
    const run = await klive(["test", "sp48", "--rom", `sp48=${rom}`]);
    expect(run.code).toBe(0);
  }, 60_000);
});

describe("the IDE's JUnit export (D14)", () => {
  it("writes the same file as klive test for the same project", async () => {
    const cli = await klive(["test", "failing", "--junit", "cli.xml", "--no-timestamp", "--timeout", "0.1"]);

    // --- The IDE's side: its compilation (absolute paths) and the results its store keeps
    const project = loadProject("failing", FIXTURES);
    const build = await compileProject(project, {}, {}, FIXTURES);
    const compilation = toRunnableCompilation(build.output);
    const program = discoverUnitTests(compilation, "sp48");
    const machine = await createCliMachine({ machineId: "sp48", romOverrides: {}, baseDir: path.join(__dirname, "../../src/cli"), env: {} });
    const results: Record<string, UnitTestResult> = {};
    let clockHz: number | undefined;
    await runUnitTests({ program, compilation, machine: machine as never, options: { timeoutSeconds: 0.1 } }, (e) => {
      if (e.kind === "result") results[e.result.id] = e.result;
      if (e.kind === "finished") clockHz = e.summary.clockHz;
    });
    const state = {
      project: { folderPath: project.folder },
      unitTests: { results, runIds: program.tests.map((t) => t.id), summary: { total: 5, passed: 2, failed: 1, errors: 2, clockHz }, startedAt: 0, version: 1 }
    } as unknown as AppState;
    expect(junitOfLastRun(state, program, false)).toBe(cli.files["cli.xml"]);
    expect(junitOfLastRun({ ...state, unitTests: { results: {}, version: 0 } } as AppState, program)).toBe(
      "Run the tests first: there are no results to export."
    );
  }, 60_000);
});

describe("klive build", () => {
  it("compiles the build root and writes the code", async () => {
    const run = await klive(["build", "sp48", "--out", "main.bin"]);
    expect(run.code).toBe(0);
    expect(run.out[0]).toMatch(/^Built code\/main\.kz80\.asm: \d+ segments?, \d+ bytes\.$/);
    expect(run.files["main.bin"].charCodeAt(0)).toBe(0xc9); // Main: ret at $8000
    const hex = await klive(["build", "sp48", "--out", "main.hex"]);
    expect(hex.files["main.hex"]).toMatch(/^:10800000C9/);
    expect(hex.files["main.hex"].trimEnd().endsWith(":00000001FF")).toBe(true);
  }, 60_000);
});
