import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  extractSegmentsFromListFile,
  extractSldInfo,
  sldAnnotations,
  sldSymbols
} from "@main/sjasmp-integration/SjasmPCompiler";
import { discoverUnitTests } from "@common/unit-tests/discovery";
import { runUnitTests } from "@main/unit-tests/UnitTestRunner";
import { SJASMPLUS_UNIT_TEST_INCLUDE } from "@main/unit-tests/includes/sjasmplusInclude";
import { SLDOPT_ALL_KEYWORDS } from "@common/utils/source-annotations";
import type { UnitTestEvent, UnitTestResult } from "@common/unit-tests/unitTestTypes";

import { MI_SPECTRUM_48, createTestMachine } from "./unitTestSupport";

/*
 * The compatibility fixture (`.plans/Z80_UNIT_TESTS_PLAN.md` §6, D5, T1): a program in DeZog's
 * conventions - modules, TC_END, assertion macros, init code - assembled by an installed sjasmplus
 * with Klive's sjasmplus include, read through the SLD exactly as the IDE reads it, run on the 48K.
 *
 * sjasmplus is found through `SJASMPLUS` (the executable) or on the PATH; without it the tests skip
 * with a message, as no sjasmplus ships with Klive.
 */

function findSjasmplus(): string | undefined {
  const candidates = [process.env.SJASMPLUS, "sjasmplus"].filter((c): c is string => !!c);
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (!probe.error && probe.status === 0) return candidate;
  }
  return undefined;
}

const SJASMPLUS = findSjasmplus();
if (!SJASMPLUS) {
  console.log("runner-sjasmplus: sjasmplus is not installed (set SJASMPLUS or put it on the PATH); skipped");
}

const PROGRAM = `
    DEVICE ZXSPECTRUM48
    ${SLDOPT_ALL_KEYWORDS}
    include "unit_tests.inc"
    org $8000
    UNITTEST_INITIALIZE
    xor a
    ld (Counter),a
    ret
Counter: db 0
Text: db "HELLO",0

    MODULE Suite
UT_pass:
    ld a,5
    TEST_A 5
    TEST_STRING Text, "HELLO", 1
    TC_END
UT_fail:
    ld a,7
    TEST_A 5
    TC_END
UT_returns:
    ret
    ENDMODULE
`;

/** Assembles with sjasmplus and builds the output the IDE builds from it */
function assemble(source: string) {
  const dir = mkdtempSync(join(tmpdir(), "klive-ut-sjasm-"));
  writeFileSync(join(dir, "unit_tests.inc"), SJASMPLUS_UNIT_TEST_INCLUDE);
  writeFileSync(join(dir, "main.asm"), source);
  const run = spawnSync(
    SJASMPLUS!,
    ["--nologo", "--fullpath", `--raw=${join(dir, "out.bin")}`, `--lst=${join(dir, "out.lst")}`, `--sld=${join(dir, "out.sld")}`, join(dir, "main.asm")],
    { cwd: dir, encoding: "utf8" }
  );
  if (run.status !== 0) throw new Error(`sjasmplus failed:\n${run.stdout}\n${run.stderr}`);
  const bin = new Uint8Array(readFileSync(join(dir, "out.bin")));
  let index = 0;
  const segments = extractSegmentsFromListFile(readFileSync(join(dir, "out.lst"), "utf8")).map((s) => {
    const emittedCode = Array.from(bin.slice(index, index + s.size));
    index += s.size;
    return { startAddress: s.origin, emittedCode };
  });
  const files: string[] = [];
  const fileIndexOf = (f: string) => {
    if (!files.includes(f)) files.push(f);
    return files.indexOf(f);
  };
  const lines = extractSldInfo(readFileSync(join(dir, "out.sld"), "utf8"));
  const symbols = sldSymbols(lines, { fileIndexOf });
  const debugAnnotations = sldAnnotations(lines, fileIndexOf);
  return { segments, symbols, debugAnnotations, sourceFileList: files.map((filename) => ({ filename })), listFileItems: [] };
}

describe.skipIf(!SJASMPLUS)("unit-test runner, sjasmplus (DeZog conventions)", () => {
  it("reads one ASSERTION per macro expansion, at the invocation line (T1)", () => {
    const output = assemble(PROGRAM);
    const assertions = output.debugAnnotations.filter((a) => a.kind === "ASSERTION");
    const file = output.sourceFileList.findIndex((f) => f.filename.endsWith("main.asm"));
    const invocations = PROGRAM.split("\n")
      .map((l, i) => ({ l, line: i + 1 }))
      .filter(({ l }) => /^\s+TEST_/.test(l))
      .map(({ line }) => line);
    expect(assertions.filter((a) => a.fileIndex === file).map((a) => a.line).sort((a, b) => a - b)).toEqual(invocations);
  });

  it("runs the tests unchanged", async () => {
    const output = assemble(PROGRAM);
    const program = discoverUnitTests(output as never, MI_SPECTRUM_48);
    expect(program.problems).toEqual([]);
    expect(program.tests.map((t) => t.id)).toEqual(["Suite.UT_pass", "Suite.UT_fail", "Suite.UT_returns"]);
    const machine = await createTestMachine(MI_SPECTRUM_48);
    const events: UnitTestEvent[] = [];
    await runUnitTests({ program, compilation: output as never, machine: machine as never }, (e) => events.push(e));
    const results: Record<string, UnitTestResult> = {};
    for (const e of events) if (e.kind === "result") results[e.result.id] = e.result;
    expect(results["Suite.UT_pass"].status).toBe("passed");
    expect(results["Suite.UT_fail"]).toMatchObject({ status: "failed" });
    expect(results["Suite.UT_fail"].message).toContain("(A=$07, B=$05)");
    expect(results["Suite.UT_returns"]).toMatchObject({ status: "error", errorKind: "returned" });
  });
});
