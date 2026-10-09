import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { UnitTestCase } from "@common/unit-tests/discovery";
import { junitErrorType, projectRelative, toJUnitXml, xmlAttr, xmlText, type JUnitResult } from "@common/unit-tests/junit";
import { findOnPath, resolveSjasmplus, toDiagnostic } from "../../src/cli/compile";
import { CliError } from "../../src/cli/exit-codes";
import { CliRomProvider, romOverrides } from "../../src/cli/headless";
import type { CliIo } from "../../src/cli/io";
import { languageOf, loadProject } from "../../src/cli/project";
import { defaultReporter, totalsText, type RunTotals } from "../../src/cli/reporters/reporter";
import { createTapReporter } from "../../src/cli/reporters/tap";
import { createTextReporter } from "../../src/cli/reporters/text";
import { runCli } from "../../src/cli/run-cli";
import { toFlatBinary, toIntelHex } from "../../src/cli/verbs/build";
import { machineOf, parseMachineOption, totalsOf } from "../../src/cli/verbs/test";

/*
 * The pure parts of `klive test` and `klive build` (`.plans/UNIT_TESTS_CLI_PLAN.md` §6): the JUnit
 * mapping (D7, T2), the reporters (D4, T6), the project loader and option precedence (D2, D6), the
 * sjasmplus search (T4) and the code writers. The end-to-end runs are `klive-test-e2e.test.ts`.
 */

const temps: string[] = [];
function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-cli-"));
  temps.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function exitCodeOf(fn: () => unknown): number | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof CliError ? err.exitCode : -1;
  }
  return undefined;
}

const test = (id: string, line: number): UnitTestCase => {
  const parts = id.split(".");
  return { id, label: parts[parts.length - 1], suitePath: parts.slice(0, -1), address: 0x8000 + line, file: "/p/code/main.kz80.asm", line };
};

describe("JUnit (D7)", () => {
  const tests = [test("UT_Pass", 10), test("Mod.UT_Fail", 20), test("Mod.UT_Stack", 30), test("Mod.Inner.UT_Crash", 40), test("Mod.Inner.UT_NotRun", 50)];
  const results: Record<string, JUnitResult> = {
    UT_Pass: { id: "UT_Pass", status: "passed", tstates: 3_500_000, log: ["A is $05", "x < y & z"] },
    "Mod.UT_Fail": {
      id: "Mod.UT_Fail",
      status: "failed",
      tstates: 70,
      message: 'ASSERTION failed at main.kz80.asm:22: A == "5"  (A=$07)\nsecond line',
      location: { file: "/p/code/main.kz80.asm", line: 22 }
    },
    "Mod.UT_Stack": { id: "Mod.UT_Stack", status: "error", errorKind: "stack", tstates: 7, message: "Stack underflow: UT_Stack popped more" },
    "Mod.Inner.UT_Crash": { id: "Mod.Inner.UT_Crash", status: "error", errorKind: "internal", tstates: 0, message: "The machine crashed: unreachable" }
  };

  it("writes the golden document", () => {
    expect(toJUnitXml({ name: "proj<1>", tests, results, clockHz: 3_500_000, projectFolder: "/p" })).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<testsuites name="proj&lt;1&gt;" tests="5" failures="1" errors="2" skipped="1" time="1.000022">',
        '  <testsuite name="(root)" tests="1" failures="0" errors="0" skipped="0" time="1.000000">',
        '    <testcase classname="(root)" name="UT_Pass" file="code/main.kz80.asm" line="10" time="1.000000">',
        "      <properties>",
        '        <property name="tstates" value="3500000"/>',
        "      </properties>",
        "      <system-out>A is $05\nx &lt; y &amp; z</system-out>",
        "    </testcase>",
        "  </testsuite>",
        '  <testsuite name="Mod" tests="2" failures="1" errors="1" skipped="0" time="0.000022">',
        '    <testcase classname="Mod" name="UT_Fail" file="code/main.kz80.asm" line="20" time="0.000020">',
        "      <properties>",
        '        <property name="tstates" value="70"/>',
        "      </properties>",
        '      <failure message="ASSERTION failed at main.kz80.asm:22: A == &quot;5&quot;  (A=$07)" type="assertion">code/main.kz80.asm:22',
        'ASSERTION failed at main.kz80.asm:22: A == "5"  (A=$07)',
        "second line</failure>",
        "    </testcase>",
        '    <testcase classname="Mod" name="UT_Stack" file="code/main.kz80.asm" line="30" time="0.000002">',
        "      <properties>",
        '        <property name="tstates" value="7"/>',
        "      </properties>",
        '      <error message="Stack underflow: UT_Stack popped more" type="stack-underflow">Stack underflow: UT_Stack popped more</error>',
        "    </testcase>",
        "  </testsuite>",
        '  <testsuite name="Mod.Inner" tests="2" failures="0" errors="1" skipped="1" time="0.000000">',
        '    <testcase classname="Mod.Inner" name="UT_Crash" file="code/main.kz80.asm" line="40" time="0.000000">',
        "      <properties>",
        '        <property name="tstates" value="0"/>',
        "      </properties>",
        '      <error message="The machine crashed: unreachable" type="internal">The machine crashed: unreachable</error>',
        "    </testcase>",
        '    <testcase classname="Mod.Inner" name="UT_NotRun" file="code/main.kz80.asm" line="50" time="0.000000">',
        "      <skipped/>",
        "    </testcase>",
        "  </testsuite>",
        "</testsuites>",
        ""
      ].join("\n")
    );
  });

  it("adds the timestamp only when given, and writes time 0 without a clock", () => {
    const xml = toJUnitXml({ name: "p", tests: [tests[0]], results, timestamp: "2026-10-09T10:00:00.000Z" });
    expect(xml).toContain('<testsuites name="p" tests="1" failures="0" errors="0" skipped="0" time="0.000000" timestamp="2026-10-09T10:00:00.000Z">');
  });

  it("names each error kind", () => {
    const of = (errorKind: JUnitResult["errorKind"], message = "") => junitErrorType({ id: "x", status: "error", tstates: 0, errorKind, message });
    expect(of("stack", "Stack overflow: ...")).toBe("stack-overflow");
    expect(of("stack", "Stack underflow: ...")).toBe("stack-underflow");
    expect(["timeout", "halt", "setup", "returned", "breakpoint", "internal"].map((k) => of(k as never))).toEqual([
      "timeout",
      "halt",
      "setup",
      "returned",
      "breakpoint",
      "internal"
    ]);
  });

  it("escapes text and attributes, and drops characters XML cannot hold", () => {
    expect(xmlText("a<b>&c\u0001")).toBe("a&lt;b&gt;&amp;c");
    expect(xmlAttr("\"'\n\t")).toBe("&quot;&apos;&#10;&#9;");
    expect(projectRelative("C:\\p\\code\\a.asm", "C:\\p")).toBe("code/a.asm");
    expect(projectRelative("/elsewhere/a.asm", "/p")).toBe("/elsewhere/a.asm");
  });
});

describe("reporters (D4, T6)", () => {
  const t1 = test("Mod.UT_A", 1);
  const t2 = test("Mod.UT_B", 2);
  const t3 = test("UT_C", 3);
  const pass: JUnitResult = { id: t1.id, status: "passed", tstates: 1234, log: ["hi"] };
  const fail: JUnitResult = { id: t2.id, status: "failed", tstates: 5, message: "ASSERTION failed", location: { file: "code/x.asm", line: 9 } };
  const totals: RunTotals = { total: 3, passed: 1, failed: 1, errors: 0, skipped: 1, wallMs: 1500 };

  it("plain: ASCII marks, no colour", () => {
    const lines: string[] = [];
    const r = createTextReporter((l) => lines.push(l), false);
    r.start([t1, t2, t3]);
    r.result(t1, pass);
    r.result(t2, fail);
    r.finish([t1, t2, t3], totals);
    expect(lines).toEqual([
      "Mod",
      "  ok    UT_A  1,234 T",
      "      log: hi",
      "  FAIL  UT_B  5 T",
      "      code/x.asm:9: ASSERTION failed",
      "",
      "1 passed, 1 failed, 1 skipped of 3 tests (1.50s)"
    ]);
  });

  it("pretty: colour and ✔/✘", () => {
    const lines: string[] = [];
    const r = createTextReporter((l) => lines.push(l), true);
    r.start([t1]);
    r.result(t1, pass);
    expect(lines[1]).toContain("✔");
    expect(lines.join("")).toContain("\u001b[");
  });

  it("tap: plan first, YAML under a failure, SKIP for what did not run", () => {
    const lines: string[] = [];
    const r = createTapReporter((l) => lines.push(l));
    r.start([t1, t2, t3]);
    r.result(t1, pass);
    r.result(t2, fail);
    r.finish([t1, t2, t3], totals);
    expect(lines).toEqual([
      "TAP version 13",
      "1..3",
      "ok 1 - Mod.UT_A # 1234 T",
      "not ok 2 - Mod.UT_B # 5 T",
      "  ---",
      '  message: "ASSERTION failed"',
      "  severity: fail",
      '  at: "code/x.asm:9"',
      "  tstates: 5",
      "  ...",
      "ok 3 - UT_C # SKIP not run",
      "# passed 1, failed 1, errors 0, skipped 1"
    ]);
  });

  it("picks plain off a terminal, or with NO_COLOR or CI", () => {
    expect(defaultReporter(true, {})).toBe("pretty");
    expect(defaultReporter(false, {})).toBe("plain");
    expect(defaultReporter(true, { NO_COLOR: "1" })).toBe("plain");
    expect(defaultReporter(true, { CI: "true" })).toBe("plain");
  });

  it("counts the totals over the selected tests", () => {
    const t = totalsOf([t1, t2, t3], { [t1.id]: pass, [t2.id]: fail }, 10);
    expect(t).toMatchObject({ total: 3, passed: 1, failed: 1, errors: 0, skipped: 1 });
    expect(totalsText({ ...t, skipped: 0, total: 1, failed: 0 })).toBe("1 passed of 1 test");
  });
});

describe("the project and the options (D2, D6)", () => {
  it("reads klive.project; a missing or broken one is exit code 3", () => {
    const dir = tempDir();
    expect(exitCodeOf(() => loadProject(dir, "/"))).toBe(3);
    fs.writeFileSync(path.join(dir, "klive.project"), "{ nope");
    expect(exitCodeOf(() => loadProject(dir, "/"))).toBe(3);
    fs.writeFileSync(
      path.join(dir, "klive.project"),
      JSON.stringify({
        machineType: "sp128",
        modelId: "plus2",
        builder: { roots: ["code/a.kz80.asm"] },
        settings: { languages: { sjasmp: ".z80" } },
        unitTests: { timeout: 2, machine: "sp48", include: ["A.*", 3], roms: { sp48: "roms/my.rom", bad: 1 } }
      })
    );
    const project = loadProject(path.basename(dir), path.dirname(dir));
    expect(project).toMatchObject({
      folder: dir,
      name: path.basename(dir),
      buildRoot: "code/a.kz80.asm",
      machineId: "sp128",
      modelId: "plus2",
      unitTests: { timeout: 2, machine: "sp48", include: ["A.*"] },
      roms: { sp48: "roms/my.rom" }
    });
    // --- unitTests.machine over the project's; the project's model only for its own machine
    expect(machineOf(project)).toEqual({ machineId: "sp48", modelId: undefined });
    expect(machineOf({ ...project, unitTests: {} })).toEqual({ machineId: "sp128", modelId: "plus2" });
    expect(machineOf(project, "spp3e:plus3")).toEqual({ machineId: "spp3e", modelId: "plus3" });
    expect(parseMachineOption("zxnext")).toEqual({ machineId: "zxnext" });
  });

  it("finds the build root's language, the project's extensions first", () => {
    expect(languageOf("/p/main.kz80.asm", {})).toBe("kz80-asm");
    expect(languageOf("/p/main.asm", {})).toBe("kz80-asm");
    expect(languageOf("/p/main.sjasm", {})).toBe("sjasmp");
    expect(languageOf("/p/main.z80", { languages: { sjasmp: ".z80|.s" } })).toBe("sjasmp");
    expect(languageOf("/p/main.zxbas", {})).toBe("zxbas");
    expect(languageOf("/p/main.txt", {})).toBeUndefined();
  });

  it("resolves ROM overrides; a missing file or bad option is exit code 3", () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, "a.rom"), "x");
    expect(romOverrides(["sp48=a.rom"], {}, "/", dir)).toEqual({ sp48: path.join(dir, "a.rom") });
    expect(romOverrides(undefined, { sp48: "a.rom" }, dir, "/")).toEqual({ sp48: path.join(dir, "a.rom") });
    expect(exitCodeOf(() => romOverrides(["sp48"], {}, "/", dir))).toBe(3);
    expect(exitCodeOf(() => romOverrides(["sp48=b.rom"], {}, "/", dir))).toBe(3);
    const provider = new CliRomProvider("/public", { sp48: "/my/sp48.rom" });
    expect(provider.resolve("roms/sp48.rom")).toBe("/my/sp48.rom");
    expect(provider.resolve("roms/sp128-0.rom")).toBe(path.join("/public", "roms/sp128-0.rom"));
  });
});

describe("sjasmplus (T4)", () => {
  it("takes --sjasmplus, then SJASMPLUS, then the project's setting, then the PATH", () => {
    const dir = tempDir();
    const exe = process.platform === "win32" ? "sjasmplus.exe" : "sjasmplus";
    for (const sub of ["opt", "env", "proj", "bin"]) {
      fs.mkdirSync(path.join(dir, sub));
      fs.writeFileSync(path.join(dir, sub, exe), "");
    }
    const at = (sub: string) => path.join(dir, sub, exe);
    const settings = { sjasmp: { executablePath: at("proj") } };
    const env = { SJASMPLUS: at("env"), PATH: path.join(dir, "bin") };
    expect(resolveSjasmplus({ sjasmplus: at("opt") }, settings, env, "/")).toBe(at("opt"));
    expect(resolveSjasmplus({}, settings, env, "/")).toBe(at("env"));
    expect(resolveSjasmplus({}, settings, { PATH: env.PATH }, "/")).toBe(at("proj"));
    expect(resolveSjasmplus({}, { sjasmp: { executablePath: "/gone/sjasmplus" } }, { PATH: env.PATH }, "/")).toBe(at("bin"));
    expect(findOnPath(exe, { PATH: "" })).toBeUndefined();
    expect(exitCodeOf(() => resolveSjasmplus({}, {}, { PATH: "" }, "/"))).toBe(3);
    expect(exitCodeOf(() => resolveSjasmplus({ sjasmplus: "/gone" }, {}, {}, "/"))).toBe(3);
  });

  it("writes compiler errors in the gcc format's fields, columns from 1", () => {
    expect(toDiagnostic({ filename: "/p/code/a.asm", line: 4, startColumn: 2, errorCode: "Z1007", message: "m" }, "/p")).toEqual({
      file: "code/a.asm",
      line: 4,
      column: 3,
      code: "Z1007",
      message: "m"
    });
  });
});

describe("klive build's writers", () => {
  const segments = [
    { startAddress: 0x8000, emittedCode: [0xc9] },
    { startAddress: 0x8003, emittedCode: [1, 2] }
  ];
  it("writes a flat binary with zero gaps, and refuses banked code (exit code 3)", () => {
    expect(Array.from(toFlatBinary(segments))).toEqual([0xc9, 0, 0, 1, 2]);
    expect(exitCodeOf(() => toFlatBinary([{ startAddress: 0, emittedCode: [1], bank: 3 }]))).toBe(3);
  });
  it("writes Intel HEX with checksums", () => {
    expect(toIntelHex(segments)).toBe(":01800000C9B6\n:02800300010278\n:00000001FF\n");
  });
});

describe("the verbs' dispatch", () => {
  function io(): { io: CliIo; out: string[]; err: string[] } {
    const out: string[] = [];
    const err: string[] = [];
    return {
      out,
      err,
      io: {
        out: (t) => out.push(t),
        err: (t) => err.push(t),
        outBytes: () => {},
        writeFile: (f) => f,
        env: {},
        cwd: os.tmpdir(),
        waitForInterrupt: () => new Promise(() => {})
      }
    };
  }

  it("lists test and build in the help, and has help of their own", async () => {
    const help = io();
    expect(await runCli(["help"], help.io)).toBe(0);
    expect(help.out[0]).toMatch(/ {2}test \[<dir>\] .*\n {2}build \[<dir>\]/);
    const testHelp = io();
    expect(await runCli(["test", "--help"], testHelp.io)).toBe(0);
    expect(testHelp.out[0]).toMatch(/^Usage: klive test/);
    const buildHelp = io();
    expect(await runCli(["build", "--help"], buildHelp.io)).toBe(0);
    expect(buildHelp.out[0]).toMatch(/^Usage: klive build/);
  });

  it("ends a usage problem with exit code 3 and one line", async () => {
    const r = io();
    expect(await runCli(["test", "a", "b"], r.io)).toBe(3);
    expect(r.err).toEqual(["klive test takes one project folder: a b"]);
    const t = io();
    expect(await runCli(["test", "--timeout", "0"], t.io)).toBe(3);
    const n = io();
    expect(await runCli(["build", path.join(os.tmpdir(), "klive-no-such-project")], n.io)).toBe(3);
  });
});
