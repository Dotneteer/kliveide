import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { compileBasic, runBasic, runBinary } from "../codegen/run-kit";
import { oracleDifferences, readExpectations } from "../corpus/expectations";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const oracle = require("../../../scripts/kbasic-oracle.cjs");

/** The behavioural oracle's parts that run without an installed zxbc (plan D12, R9). */
describe("behavioural oracle", () => {
  it("maps a program's header to zxbc's flags", () => {
    const options = oracle.headerOptions("' A test\n'@expect screen 0 \"x\"\n'@string-base 1\n'@case-insensitive\n'@origin $9000\n'@check-bounds false\nPRINT 1\n'@array-base 1\n");
    expect(options).toEqual([
      { name: "string-base", value: "1" },
      { name: "case-insensitive", value: "" },
      { name: "origin", value: "$9000" },
      { name: "check-bounds", value: "false" }
    ]);
    expect(oracle.zxbcArguments(options)).toEqual({ args: ["--string-base", "1", "--ignore-case", "--org", "36864"], org: 0x9000 });
    expect(oracle.zxbcArguments([{ name: "sinclair-compatible", value: "" }]).args).toEqual(["--sinclair", "--org", "32768"]);
    expect(oracle.zxbcArguments([{ name: "target", value: "next" }]).skip).toMatch(/48K/);
  });

  it("refuses to run in CI", () => {
    const run = spawnSync(process.execPath, [path.join(__dirname, "../../../scripts/kbasic-oracle.cjs")], {
      env: { ...process.env, CI: "1" },
      encoding: "utf8"
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/never runs in CI/);
  });

  it("finds where the oracle's screen, report and peeks differ from the expectations", () => {
    const expectations = readExpectations("'@expect screen 0 \"1 2\"\n'@expect error 5\n'@expect peek 40000 7\nPRINT 1\n");
    const screen = Array.from({ length: 24 }, () => "");
    screen[0] = "1 2";
    screen[23] = "6 Number too big, 0:1";
    const same = { program: "p", zxbc: "zxbc 1.19.0", screen, peeks: { "peek 40000": 7 } };
    expect(oracleDifferences(expectations, same)).toEqual([]);
    const other = { ...same, screen: ["1  2", ...screen.slice(1, 23), "B Integer out of range, 0:1"], peeks: { "peek 40000": 8 } };
    expect(oracleDifferences(expectations, other)).toEqual([
      'screen row 0: Klive "1 2", zxbc "1  2"',
      'error: Klive 6, zxbc "B Integer out of range, 0:1"',
      "peek 40000: Klive 7, zxbc 8"
    ]);
    expect(oracleDifferences(expectations, { program: "p", zxbc: "z", compileError: "x.bas:1: error: nope" })).toEqual([]);
  });

  it("runs a binary as the corpus runs a program", async () => {
    // --- A Klive-built program stands in for zxbc's output: same bytes, same stub, same screen
    const source = 'PRINT "oracle"; 6 * 7\n';
    const { generated } = await compileBasic(source);
    const segment = generated.output.segments[0];
    expect(generated.entryAddress).toBe(segment.startAddress);
    const { session, ended } = await runBinary(Uint8Array.from(segment.emittedCode), segment.startAddress);
    expect(ended).toBe(true);
    expect(session.screenLine(0).trimEnd()).toBe((await runBasic(source)).screen(1)[0]);
  });
});
