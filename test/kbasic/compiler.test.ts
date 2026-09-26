import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppState } from "@common/state/AppState";
import { lineCanHaveBreakpoint } from "@main/kbasic/breakpoints";
import { KBasicCompiler, runFrontEnd, toErrorInfo } from "@main/kbasic/KBasicCompiler";
import { defaultOptions } from "@main/kbasic/options/options";
import type { FileReader } from "@main/kbasic/syntax/preprocessor";
import { selectedZxBasicCompiler, ZxBasicDispatcher } from "@main/zxb-integration/ZxBasicDispatcher";

const files = (entries: Record<string, string>): FileReader => ({ read: (p) => entries[p] });

describe("runFrontEnd", () => {
  it("applies the header over the base options", () => {
    const result = runFrontEnd("/p/main.bas", "'@target next\n'@optimize 0\nPRINT 1\n", files({}), defaultOptions());
    expect(result.options).toMatchObject({ target: "next", optimize: 0 });
    expect(result.diagnostics.items).toEqual([]);
    expect(result.program.statements.map((s) => s.kind)).toEqual(["print"]);
  });

  it("feeds header defines to the preprocessor", () => {
    const text = "'@define LEVEL=3, DEBUG\n#ifdef DEBUG\nPRINT LEVEL\n#endif\n";
    const result = runFrontEnd("/p/main.bas", text, files({}), defaultOptions());
    expect(result.diagnostics.items).toEqual([]);
    const print = result.program.statements[0];
    expect(print.kind).toBe("print");
    expect(result.preprocessed.tokens.some((t) => t.kind === "number" && t.value === 3)).toBe(true);
  });

  it("resolves a relative include path against the build root's folder", () => {
    const text = "'@include-path lib\n#include <util.bas>\nf\n";
    const reader = files({ "/p/lib/util.bas": "SUB f\nEND SUB\n" });
    const result = runFrontEnd("/p/main.bas", text, reader, defaultOptions());
    expect(result.diagnostics.items).toEqual([]);
    expect(result.sources.files.map((f) => f.name)).toContain("/p/lib/util.bas");
  });

  it("ignores an included file's header with info K012", () => {
    const reader = files({ "/p/util.bas": "'@optimize 0\nSUB f\nEND SUB\n" });
    const result = runFrontEnd("/p/main.bas", '#include "util.bas"\n', reader, defaultOptions());
    expect(result.options.optimize).toBe(defaultOptions().optimize);
    expect(result.diagnostics.items.map((d) => [d.code, d.severity])).toEqual([["K012", "info"]]);
  });

  it("does not take the header of a define's text for a file's", () => {
    const result = runFrontEnd("/p/main.bas", "'@define X=1\nPRINT X\n", files({}), defaultOptions());
    expect(result.diagnostics.items).toEqual([]);
  });

  it("normalises CRLF before reading the header", () => {
    const result = runFrontEnd("/p/main.bas", "'@optimize 1\r\nPRINT 1\r\n", files({}), defaultOptions());
    expect(result.options.optimize).toBe(1);
    expect(result.diagnostics.items).toEqual([]);
  });
});

describe("toErrorInfo", () => {
  it("gives the file, 1-based line and 0-based columns of a diagnostic", () => {
    const result = runFrontEnd("/p/main.bas", "PRINT 1\n  GOTO\n", files({}), defaultOptions());
    const [error] = toErrorInfo(result.diagnostics.items, result.sources);
    expect(error).toMatchObject({ filename: "/p/main.bas", line: 2 });
    expect(error.isWarning).toBeUndefined();
    expect(error.startColumn).toBeGreaterThanOrEqual(2);
  });

  it("marks warnings and infos as warnings", () => {
    const result = runFrontEnd("/p/main.bas", "'@optimise 1\nPRINT 1\n", files({}), defaultOptions());
    const [warning] = toErrorInfo(result.diagnostics.items, result.sources);
    expect(warning).toMatchObject({ errorCode: "K010", isWarning: true, line: 1, startColumn: 0, endColumn: 12 });
  });

  it("follows #line", () => {
    const result = runFrontEnd("/p/main.bas", '#line 100 "other.bas"\nGOTO\n', files({}), defaultOptions());
    const [error] = toErrorInfo(result.diagnostics.items, result.sources);
    expect(error).toMatchObject({ filename: "other.bas", line: 100 });
  });

  it("reports an error in an included file against that file", () => {
    const reader = files({ "/p/util.bas": "PRINT 1\nGOTO\n" });
    const result = runFrontEnd("/p/main.bas", '#include "util.bas"\n', reader, defaultOptions());
    const [error] = toErrorInfo(result.diagnostics.items, result.sources);
    expect(error).toMatchObject({ filename: "/p/util.bas", line: 2 });
  });
});

describe("lineCanHaveBreakpoint", () => {
  it.each([
    "PRINT 1",
    "  LET a = 1",
    "10 PRINT 1",
    "start: PRINT 1",
    "IF a THEN PRINT 1",
    "IF a THEN",
    "FOR i = 1 TO 10",
    "LOOP UNTIL a",
    "ELSE PRINT 1",
    "END",
    "END IF: PRINT 1",
    "SUB f(a AS UByte)",
    "WHILE a < 10",
    "DO"
  ])("allows: %s", (line) => {
    expect(lineCanHaveBreakpoint(line)).toBe(true);
  });

  it.each([
    "",
    "   ",
    "' a comment",
    "REM a comment",
    "#include <input.bas>",
    "#define X 1",
    "10",
    "start:",
    "END IF",
    "ENDIF",
    "END SUB",
    "END FUNCTION",
    "END WHILE",
    "WEND",
    "LOOP",
    "NEXT",
    "NEXT i",
    "ELSE",
    "END ASM",
    "END CODEBANK",
    "DECLARE FUNCTION f AS UByte",
    "END IF ' done"
  ])("refuses: %s", (line) => {
    expect(lineCanHaveBreakpoint(line)).toBe(false);
  });
});

describe("the zxbas compiler", () => {
  let folder: string;
  const state = (settings: Record<string, unknown>, machineId = "sp48") =>
    ({ userSettings: settings, projectSettings: {}, emulatorState: { machineId } }) as unknown as AppState;

  beforeAll(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), "kbasic-"));
    fs.writeFileSync(path.join(folder, "good.bas"), "'@optimise 1\nPRINT 1\n");
    fs.writeFileSync(path.join(folder, "bad.bas"), "PRINT 1\nGOTO\n");
  });
  afterAll(() => fs.rmSync(folder, { recursive: true, force: true }));

  it("defaults to zxbc; 'klive' selects Klive BASIC", () => {
    expect(selectedZxBasicCompiler(undefined)).toBe("zxbc");
    expect(selectedZxBasicCompiler(state({}))).toBe("zxbc");
    expect(selectedZxBasicCompiler(state({ zxbasic: { compiler: "zxbc" } }))).toBe("zxbc");
    expect(selectedZxBasicCompiler(state({ zxbasic: { compiler: " Klive " } }))).toBe("klive");
  });

  it("checks in the background: diagnostics only", async () => {
    const compiler = new KBasicCompiler();
    compiler.setAppState(state({}));
    const output = await compiler.checkFile(path.join(folder, "good.bas"));
    expect(output.errors?.map((e) => e.errorCode)).toEqual(["K010"]);
  });

  it("says in a build that it cannot generate code yet", async () => {
    const compiler = new KBasicCompiler();
    compiler.setAppState(state({}));
    const output = await compiler.compileFile(path.join(folder, "good.bas"));
    expect(output.errors?.map((e) => [e.errorCode, !!e.isWarning])).toEqual([
      ["K010", true],
      ["K001", false]
    ]);
  });

  it("reports only the program's errors when it has some", async () => {
    const compiler = new KBasicCompiler();
    compiler.setAppState(state({}));
    const output = await compiler.compileFile(path.join(folder, "bad.bas"));
    expect(output.errors?.length).toBeGreaterThan(0);
    expect(output.errors?.some((e) => e.errorCode === "K001")).toBe(false);
    expect(output.errors?.[0].line).toBe(2);
    expect(output.errors?.[0].isWarning).toBeFalsy();
  });

  it("returns an error for a file it cannot read", async () => {
    const output = await new KBasicCompiler().checkFile(path.join(folder, "missing.bas"));
    expect(output.errors?.map((e) => e.errorCode)).toEqual(["K002"]);
  });

  it("dispatches to Klive BASIC when selected", async () => {
    const dispatcher = new ZxBasicDispatcher();
    dispatcher.setAppState(state({ zxbasic: { compiler: "klive" } }));
    expect(dispatcher.language).toBe("zxbas");
    const output = await dispatcher.checkFile(path.join(folder, "bad.bas"));
    expect(output.errors?.[0].line).toBe(2);
    expect(await dispatcher.lineCanHaveBreakpoint("PRINT 1")).toBe(true);
  });

  it("keeps zxbc's answers when zxbc is selected", async () => {
    const dispatcher = new ZxBasicDispatcher();
    dispatcher.setAppState(state({}));
    expect(await dispatcher.lineCanHaveBreakpoint("PRINT 1")).toBe(false);
  });
});
