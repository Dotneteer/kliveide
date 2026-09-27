import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DebuggableOutput } from "@abstractions/CompilerInfo";
import type { AppState } from "@common/state/AppState";
import { lineCanHaveBreakpoint } from "@main/kbasic/breakpoints";
import { headerSetsOptimize, KBasicCompiler, runFrontEnd, toErrorInfo } from "@main/kbasic/KBasicCompiler";
import { defaultOptions } from "@main/kbasic/options/options";
import type { FileReader } from "@main/kbasic/syntax/preprocessor";
import { ZxBasicDispatcher } from "@main/zxb-integration/ZxBasicDispatcher";
import { selectedZxBasicCompiler } from "@main/zxb-integration/zxb-config";

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
    const result = runFrontEnd("/p/main.bas", '#include "util.bas"\nf\n', reader, defaultOptions());
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

describe("runFrontEnd: binding (Phase 2)", () => {
  it("binds a program that parses and reports its semantic errors", () => {
    const result = runFrontEnd("/p/main.bas", "DIM a AS UByte\nDIM a AS UByte\n", files({}), defaultOptions());
    expect(result.bound).toBeDefined();
    expect(result.diagnostics.items.map((d) => d.code)).toContain("E403");
  });

  it("does not bind a program with syntax errors", () => {
    const result = runFrontEnd("/p/main.bas", "GOTO\nPRINT undeclaredArray(1)\n", files({}), defaultOptions());
    expect(result.bound).toBeUndefined();
    expect(result.diagnostics.items.map((d) => d.code)).toEqual(["E302"]);
  });

  it("drops the warnings the header disables", () => {
    const text = "'@disable-warning 100, W110\nPRINT q\nIF 1 THEN PRINT 2\n";
    const result = runFrontEnd("/p/main.bas", text, files({}), defaultOptions());
    expect(result.diagnostics.items).toEqual([]);
  });

  it("reports a banked #init routine (E453)", () => {
    const text = "#init setup\nCODEBANK 1\nSUB setup()\nEND SUB\nEND CODEBANK\n";
    const result = runFrontEnd("/p/main.bas", text, files({}), { ...defaultOptions(), optimize: 0 });
    expect(result.diagnostics.items.map((d) => d.code)).toEqual(["E453"]);
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

  it("defaults to Klive BASIC; 'zxbc' selects the external compiler", () => {
    expect(selectedZxBasicCompiler(undefined)).toBe("klive");
    expect(selectedZxBasicCompiler(state({}))).toBe("klive");
    expect(selectedZxBasicCompiler(state({ zxbasic: { compiler: "klive" } }))).toBe("klive");
    expect(selectedZxBasicCompiler(state({ zxbasic: { compiler: " ZXBC " } }))).toBe("zxbc");
    expect(selectedZxBasicCompiler(state({ zxbasic: { compiler: "something" } }))).toBe("klive");
  });

  it("checks in the background: diagnostics only", async () => {
    const compiler = new KBasicCompiler();
    compiler.setAppState(state({}));
    const output = await compiler.checkFile(path.join(folder, "good.bas"));
    expect(output.errors?.map((e) => e.errorCode)).toEqual(["K010"]);
  });

  it("builds code for the 48K with the classic debug tables", async () => {
    const compiler = new KBasicCompiler();
    compiler.setAppState(state({}));
    const output = (await compiler.compileFile(path.join(folder, "good.bas"))) as DebuggableOutput & { entryAddress: number; modelType: number };
    expect(output.errors?.map((e) => [e.errorCode, !!e.isWarning])).toEqual([["K010", true]]);
    expect(output.segments[0].startAddress).toBe(0x8000);
    expect(output.entryAddress).toBe(0x8000);
    expect(output.modelType).toBe(1);
    expect(output.injectOptions).toEqual({ subroutine: true });
    expect(output.sourceFileList.map((f) => f.filename)).toEqual([path.join(folder, "good.bas")]);
    expect(output.listFileItems).toHaveLength(1);
    expect(output.listFileItems[0]).toMatchObject({ fileIndex: 0, lineNumber: 2 });
    expect(output.sourceMap[output.listFileItems[0].address]).toMatchObject({ fileIndex: 0, line: 2, startColumn: 0, endColumn: 7 });
  });

  it.each([
    ["sp128", 2],
    ["spp3e", 3]
  ])("builds for the machine %s (model type %i)", async (machineId, modelType) => {
    const compiler = new KBasicCompiler();
    compiler.setAppState(state({}, machineId));
    const output = (await compiler.compileFile(path.join(folder, "good.bas"))) as DebuggableOutput & { modelType: number };
    expect(output.errors?.filter((e) => !e.isWarning)).toEqual([]);
    expect(output.modelType).toBe(modelType);
  });

  it("builds a NEX for the ZX Spectrum Next (model type 4), with the program's entry after the NEX start stub", async () => {
    const compiler = new KBasicCompiler();
    compiler.setAppState(state({}, "zxnext"));
    const output = (await compiler.compileFile(path.join(folder, "good.bas"))) as DebuggableOutput & {
      modelType: number;
      entryAddress: number;
      nexConfig?: { entryAddr?: number };
    };
    expect(output.errors?.filter((e) => !e.isWarning)).toEqual([]);
    expect(output.modelType).toBe(4);
    expect(output.nexConfig).toBeDefined();
    expect(output.entryAddress).toBeGreaterThan(0x8000);
  });

  it("writes the files '@emit-asm, '@emit-ir and '@emit-map ask for, with the CODEBANK manifest", async () => {
    const source = [
      "'@emit-asm",
      "'@emit-ir",
      "'@emit-map",
      "DIM r AS UInteger",
      "CODEBANK 1",
      "FUNCTION Twice(n AS UInteger) AS UInteger",
      "  RETURN n * 2",
      "END FUNCTION",
      "END CODEBANK",
      "CODEBANK 2",
      "SUB Store(v AS UInteger)",
      "  r = Twice(v)",
      "END SUB",
      "END CODEBANK",
      "Store 21",
      ""
    ].join("\n");
    fs.writeFileSync(path.join(folder, "banked.bas"), source);
    const compiler = new KBasicCompiler();
    compiler.setAppState(state({}, "zxnext"));
    const output = (await compiler.compileFile(path.join(folder, "banked.bas"))) as DebuggableOutput;
    expect(output.errors?.filter((e) => !e.isWarning)).toEqual([]);
    const read = (name: string) => fs.readFileSync(path.join(folder, name), "utf8");
    expect(read("banked.kbasic.asm")).toMatch(/^_Twice\.__far:/m);
    expect(read("banked.kbasic.ir")).toMatch(/^function _Twice\.__far\(n: u16 @ix\+4\): u16 .*CODEBANK 1$/m);
    const map = read("banked.kbasic.map");
    expect(map).toMatch(/^\$6000 B1:_Twice\.__far$/m);
    expect(map).toMatch(/^\$6000 B2:_Store\.__far$/m);
    expect(map).toMatch(/^\$[0-9A-F]{4} core\.FarCall$/m);
    const manifest = JSON.parse(read("banked.banks.json"));
    expect(manifest).toMatchObject({ window: 0x6000, window_size: 0x2000 });
    expect(manifest.banks.map((b: { bank: number; file: string; org: number; page: number; pages: number[] }) => [b.bank, b.file, b.org, b.page, b.pages])).toEqual([
      [1, "banked.bank1.bin", 0x6000, 30, [30]],
      [2, "banked.bank2.bin", 0x6000, 31, [31]]
    ]);
    // --- Each bank's file is the code the NEX loader puts in its page
    for (const b of manifest.banks) {
      const bin = fs.readFileSync(path.join(folder, b.file));
      expect(bin.length).toBe(b.size);
      const segment = output.segments.find((s) => s.bank === b.page >> 1 && (s.bankOffset ?? 0) === (b.page & 1) * 0x2000)!;
      expect([...bin]).toEqual([...segment.emittedCode]);
    }
  });

  it.each([
    ["sp48", "sp48", 1],
    ["sp128", "sp128", 2],
    ["zxnext", "zxnext", 4]
  ])("builds the %s ZX BASIC project template cleanly", async (templateMachine, machineId, modelType) => {
    const compiler = new KBasicCompiler();
    compiler.setAppState(state({}, machineId));
    const template = path.join(__dirname, "../../src/public/project-templates", templateMachine, "zx-basic/code/program.zxbas");
    const output = (await compiler.compileFile(template)) as DebuggableOutput & { modelType: number; nexConfig?: { filename?: string } };
    expect(output.errors).toEqual([]);
    expect(output.modelType).toBe(modelType);
    if (modelType === 4) expect(output.nexConfig?.filename).toBe("program.nex");
  });

  it("builds a debug build with the debug profile unless the header sets '@optimize (plan §8.6)", async () => {
    const compiler = new KBasicCompiler();
    compiler.setAppState(state({}));
    fs.writeFileSync(path.join(folder, "plain.bas"), "PRINT 1\n");
    fs.writeFileSync(path.join(folder, "pinned.bas"), "'@optimize 3\nPRINT 1\n");
    const trace = async (file: string, profile?: "debug" | "build") =>
      ((await compiler.compileFile(path.join(folder, file), undefined, profile)) as { traceOutput: string[] }).traceOutput[0];
    expect(await trace("plain.bas", "debug")).toMatch(/level 1 \(the debug profile/);
    expect(await trace("plain.bas", "build")).toMatch(/level 2$/);
    expect(await trace("pinned.bas", "debug")).toMatch(/level 3$/);
    expect(headerSetsOptimize("x.bas", "' a comment\n'!opt=2\nPRINT 1\n")).toBe(true);
    expect(headerSetsOptimize("x.bas", "PRINT 1\n'@optimize 2\n")).toBe(false);
  });

  it("reports only the program's errors when it has some", async () => {
    const compiler = new KBasicCompiler();
    compiler.setAppState(state({}));
    const output = await compiler.compileFile(path.join(folder, "bad.bas"));
    expect(output.errors?.length).toBeGreaterThan(0);
    expect(output.errors?.[0].line).toBe(2);
    expect(output.errors?.[0].isWarning).toBeFalsy();
  });

  it("returns an error for a file it cannot read", async () => {
    const output = await new KBasicCompiler().checkFile(path.join(folder, "missing.bas"));
    expect(output.errors?.map((e) => e.errorCode)).toEqual(["K002"]);
  });

  it("dispatches to Klive BASIC by default", async () => {
    const dispatcher = new ZxBasicDispatcher();
    dispatcher.setAppState(state({}));
    expect(dispatcher.language).toBe("zxbas");
    const output = await dispatcher.checkFile(path.join(folder, "bad.bas"));
    expect(output.errors?.[0].line).toBe(2);
    expect(await dispatcher.lineCanHaveBreakpoint("PRINT 1")).toBe(true);
  });

  it("keeps zxbc's answers when zxbc is selected", async () => {
    const dispatcher = new ZxBasicDispatcher();
    dispatcher.setAppState(state({ zxbasic: { compiler: "zxbc" } }));
    expect(await dispatcher.lineCanHaveBreakpoint("PRINT 1")).toBe(false);
  });
});
