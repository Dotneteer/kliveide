import { describe, expect, it } from "vitest";

import type { DebuggableOutput } from "@abstractions/CompilerInfo";
import { getBreakpointStorageKey, statementAtColumn } from "@common/utils/breakpoints";
import { locateSource } from "@renderer/appIde/utils/source-location";
import { runToCursorAddress, sourceFileIndex, statementMarkers } from "@renderer/features/editor/monaco/statementBreakpoints";

import { compileBasic } from "./run-kit";

/**
 * The IDE's side of source-level debugging (plan §10.3–§10.5), on a program Klive BASIC built:
 * statement breakpoints, Run to Cursor and the execution point's source location.
 */
const SOURCE = [
  "FUNCTION f(n AS UByte) AS UByte", // 1
  "  RETURN n + 1", // 2
  "END FUNCTION", // 3
  "DIM a, b AS UByte", // 4
  "a = 1 : b = f(a) : PRINT a + b", // 5
  "IF a > 0 THEN a = 2 : b = 3", // 6
  "PRINT b", // 7
  ""
].join("\n");

async function output(): Promise<DebuggableOutput & { sourceLevelDebug: NonNullable<DebuggableOutput["sourceLevelDebug"]> }> {
  const { generated } = await compileBasic(SOURCE);
  const classic = generated.debug.classic;
  return {
    errors: [],
    segments: [],
    injectOptions: {},
    sourceFileList: classic.sourceFileList,
    sourceMap: classic.sourceMap,
    listFileItems: classic.listFileItems,
    sourceLevelDebug: generated.debug.sourceLevel
  } as unknown as DebuggableOutput & { sourceLevelDebug: NonNullable<DebuggableOutput["sourceLevelDebug"]> };
}

describe("statement breakpoints (§10.3)", () => {
  it("keys a statement breakpoint by its column; a line breakpoint keeps its key", () => {
    expect(getBreakpointStorageKey({ resource: "main.bas", line: 5 })).toBe("[main.bas]:5");
    expect(getBreakpointStorageKey({ resource: "main.bas", line: 5, column: 8 })).toBe("[main.bas]:5:8");
  });

  it("puts a marker before each further statement of a line", async () => {
    const out = await output();
    const info = out.sourceLevelDebug;
    const fileIndex = sourceFileIndex(info, "/test/main.bas", false);
    expect(fileIndex).toBe(0);
    const markers = statementMarkers(info, fileIndex).map((s) => [s.startLine, s.startColumn]);
    expect(markers).toEqual([
      [5, 8],
      [5, 19],
      [6, 14],
      [6, 22]
    ]);
  });

  it("resolves a column to the statement that holds it, or the next one", async () => {
    const info = (await output()).sourceLevelDebug;
    const at = (line: number, column: number) => {
      const s = statementAtColumn(info, 0, line, column);
      return s ? SOURCE.split("\n")[line - 1].slice(s.startColumn, s.endColumn) : undefined;
    };
    expect(at(5, 0)).toBe("a = 1");
    expect(at(5, 10)).toBe("b = f(a)");
    // --- On the separator: the next statement
    expect(at(5, 6)).toBe("b = f(a)");
    expect(at(5, 25)).toBe("PRINT a + b");
    expect(at(5, 40)).toBeUndefined();
  });

  it("runs to the statement under the cursor, or a line's first code without source-level info", async () => {
    const out = await output();
    const info = out.sourceLevelDebug;
    const second = info.statements.find((s) => s.startLine === 5 && s.startColumn === 8)!;
    expect(runToCursorAddress(out, "/test/main.bas", false, 5, 12)).toBe(second.startAddress);
    const classicOnly = { ...out, sourceLevelDebug: undefined };
    const first = info.statements.find((s) => s.startLine === 5 && s.startColumn === 0)!;
    expect(runToCursorAddress(classicOnly, "/test/main.bas", false, 5, 12)).toBe(first.startAddress);
    expect(runToCursorAddress(out, "/other.bas", false, 5, 12)).toBeUndefined();
  });
});

describe("the execution point's source location (§10.4, §10.5)", () => {
  it("names the statement the emulator stopped at, with its columns", async () => {
    const out = await output();
    const info = out.sourceLevelDebug;
    const s = info.statements.find((x) => x.startLine === 5 && x.startColumn === 19)!;
    const location = locateSource(out, s.startAddress, { kind: "statement", pc: s.startAddress, statementIndex: s.index, returned: [] });
    expect(location).toMatchObject({ filename: "/test/main.bas", line: 5, startColumn: 19, endColumn: 30, kind: "statement", sourceLevel: true });
  });

  it("shows a return point on the calling statement, naming the routine that returned", async () => {
    const out = await output();
    const info = out.sourceLevelDebug;
    const call = info.statements.find((x) => x.startLine === 5 && x.startColumn === 8)!;
    const f = info.callables.findIndex((c) => c.name === "f");
    const location = locateSource(out, 0x1234, { kind: "returnPoint", pc: 0x1234, statementIndex: call.index, returnedFrom: f, returned: [] });
    expect(location).toMatchObject({ line: 5, startColumn: 8, endColumn: 16, kind: "returnPoint", returnedFrom: "f" });
    expect(locateSource(out, 0x1234, { kind: "returnPoint", pc: 0x1234, statementIndex: call.index, returnedFromGosub: true, returned: [] })?.returnedFrom).toBe("GOSUB");
  });

  it("shows an error stop on the statement that raised it, with the report", async () => {
    const out = await output();
    const s = out.sourceLevelDebug.statements.find((x) => x.startLine === 6 && x.startColumn === 14)!;
    const stop = {
      kind: "error" as const,
      pc: 0x9000,
      statementIndex: -1,
      userStatementIndex: s.index,
      error: { code: 2, report: "3 Subscript wrong" },
      returned: []
    };
    expect(locateSource(out, 0x9000, stop)).toMatchObject({ line: 6, startColumn: 14, kind: "error", error: "3 Subscript wrong" });
  });

  it("falls back to the classic source map without a stop report", async () => {
    const out = await output();
    const s = out.sourceLevelDebug.statements.find((x) => x.startLine === 7)!;
    expect(locateSource(out, s.startAddress)).toMatchObject({ line: 7, kind: "statement", sourceLevel: false });
    expect(locateSource(out, 0x0005)).toBeUndefined();
  });
});
