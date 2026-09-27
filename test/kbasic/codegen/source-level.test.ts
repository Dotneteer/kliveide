import { describe, expect, it } from "vitest";

import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";

import { compileBasic, runBasic } from "./run-kit";

/**
 * The source-level tables (plan §8.4, `.docs/kbasic-debug-builder.md` §4) that source stepping, the
 * call stack and the Variables panel read, checked against the program they describe running on the
 * 48K: every frame description must match the real stack at every statement entry.
 */
const PROGRAM = [
  "#include <hex.bas>", // 1
  "CONST LIMIT AS UByte = 3", // 2
  "DIM total AS UInteger", // 3
  "DIM names(1 TO 2) AS String", // 4
  "SUB add(n AS UByte, BYREF t AS UInteger)", // 5
  "  DIM twice AS UInteger", // 6
  "  twice = n * 2: t = t + twice", // 7
  "END SUB", // 8
  "FUNCTION square(x AS Integer) AS Integer", // 9
  "  RETURN x * x", // 10
  "END FUNCTION", // 11
  "DIM i AS UByte", // 12
  "FOR i = 1 TO LIMIT", // 13
  "  add(i, total): total = total + square(i) + square(1)", // 14
  "NEXT i", // 15
  "GOSUB extra", // 16
  "PRINT total; hex8(total)", // 17
  "END", // 18
  "extra:", // 19
  "  total = total + 100", // 20
  "  RETURN", // 21
  ""
].join("\n");

describe("the source-level tables", () => {
  it("lists the user's statements in address order with their columns and callables", async () => {
    const { generated } = await compileBasic(PROGRAM);
    const info = generated.debug.sourceLevel;
    expect(info.language).toBe("basic");
    expect(info.files.map((f) => f.filename)).toEqual(["/test/main.bas", "<kbasic-stdlib>/hex.bas"]);
    const addresses = info.statements.map((s) => s.startAddress);
    expect(addresses).toEqual([...addresses].sort((a, b) => a - b));
    info.statements.forEach((s, i) => expect(s.index).toBe(i));
    // --- Only the user's file: the library's statements are runtime to the debugger
    expect(new Set(info.statements.map((s) => s.fileIndex))).toEqual(new Set([0]));
    // --- Two statements on line 7, each with its own columns
    const line7 = info.statements.filter((s) => s.startLine === 7);
    expect(line7.map((s) => [s.startColumn, s.endColumn])).toEqual([
      [2, 15],
      [17, 30]
    ]);
    const names = info.callables.map((c) => [c.name, c.kind]);
    expect(names).toEqual(expect.arrayContaining([["main", "entrypoint"], ["add", "subroutine"], ["square", "function"], ["hex8", "function"]]));
    const add = info.callables.find((c) => c.name === "add")!;
    expect([add.startLine, add.endLine]).toEqual([5, 8]);
    expect(info.statements[add.firstStatementIndex].startLine).toBe(7);
    expect(add.exitAddresses.length).toBe(1);
    // --- The FOR line's call statement names both routines it calls
    const calls = info.statements.find((s) => s.startLine === 14 && s.startColumn > 2)!;
    expect(calls.callTargets?.map((i) => info.callables[i].name)).toEqual(["square"]);
  });

  it("maps every address to its statement, and the rest to runtime", async () => {
    const { generated } = await compileBasic(PROGRAM);
    const info = generated.debug.sourceLevel;
    const lookup = (address: number) => {
      let found = -1;
      for (const [a, s] of info.addressToStatement) {
        if (a > address) break;
        found = s;
      }
      return found;
    };
    for (const s of info.statements) {
      expect(lookup(s.startAddress)).toBe(s.index);
      expect(lookup(s.endAddress - 1)).toBe(s.index);
    }
    expect(lookup(info.extensions!.mainBaselineSymbol)).toBe(-1);
  });

  it("records every user call with its return address, kind and order", async () => {
    const { generated } = await compileBasic(PROGRAM);
    const info = generated.debug.sourceLevel;
    const sites = info.extensions!.callSites;
    const callee = (i?: number) => (i === undefined ? undefined : info.callables[i].name);
    const summary = sites.map((c) => [info.statements[c.statementIndex]?.startLine, c.kind, callee(c.calleeIndex), c.order, c.moreCallsFollow]);
    expect(summary).toEqual(
      expect.arrayContaining([
        [14, "sub", "add", 0, false],
        [14, "function", "square", 0, true],
        [14, "function", "square", 1, false],
        [16, "gosub", undefined, 0, false],
        [17, "function", "hex8", 0, false]
      ])
    );
    // --- The library's own call (hex8 calls __kbHexDigits) is a call site of a library callable
    const inner = sites.find((c) => callee(c.calleeIndex) === "__kbHexDigits")!;
    expect(inner.statementIndex).toBe(-1);
    expect(info.callables[inner.callerIndex].name).toBe("hex8");
    expect(info.extensions!.frames[inner.callerIndex].library).toBe(true);
  });

  it("describes variables: globals by address, parameters and locals by IX offset, arrays, constants", async () => {
    const { generated } = await compileBasic(PROGRAM);
    const info = generated.debug.sourceLevel;
    const vars = info.extensions!.variables;
    const byName = (name: string) => vars.find((v) => v.name === name)!;
    expect(byName("total")).toMatchObject({ type: "uinteger", kind: "global", scope: "global", location: { at: "absolute" } });
    expect(byName("names")).toMatchObject({ type: "string", array: { elementType: "string", dimensions: [{ lower: 1, upper: 2 }] } });
    expect(byName("LIMIT")).toMatchObject({ kind: "constant", location: { at: "constant", value: 3 } });
    const add = info.callables.findIndex((c) => c.name === "add");
    expect(byName("n")).toMatchObject({ kind: "parameter", type: "ubyte", scope: { callableIndex: add }, location: { at: "frame", ixOffset: 5 } });
    expect(byName("t")).toMatchObject({ kind: "parameter", byRef: true, location: { at: "frame", ixOffset: 6 } });
    expect(byName("twice")).toMatchObject({ kind: "local", location: { at: "frame", ixOffset: -2 } });
    expect(byName("twice").declaredAt).toEqual({ fileIndex: 0, line: 6, column: 6 });
    // --- The library's own variables are not the user's
    expect(vars.some((v) => v.name === "digits")).toBe(false);
  });

  it("describes frames that match the real stack at every statement entry", async () => {
    const r = await runBasic(PROGRAM, { traceEntries: true });
    const info: SourceLevelDebugInfo = r.generated.debug.sourceLevel;
    const ext = info.extensions!;
    // --- The stack as it was at each entry (memory now holds what later calls left)
    const word = (v: (typeof r.entries)[number], a: number) => v.stack[(a - v.sp) / 2];
    const bySid = new Map(r.generated.debug.addresses.map((a) => [a.sid, a.start]));
    const statementAt = new Map(info.statements.map((s) => [s.startAddress, s]));
    const returnAddresses = new Map(ext.callSites.map((c) => [c.returnAddress, c]));
    const mainBaseline = r.session.peekWord(ext.mainBaselineSymbol);
    let checked = 0;
    let gosubLevels = 0;
    for (const v of r.entries) {
      const s = statementAt.get(bySid.get(v.sid)!);
      if (!s) continue;
      const frame = ext.frames[s.callableIndex];
      if (frame.convention === "entrypoint") {
        // --- The main program: its baseline, less a word per pending GOSUB
        const depth = (mainBaseline - v.sp) / 2;
        if (depth > 0) {
          const site = returnAddresses.get(word(v, v.sp))!;
          expect(site.kind).toBe("gosub");
          gosubLevels++;
        } else expect(v.sp).toBe(mainBaseline);
      } else {
        // --- A routine: the return address at IX+2 is a call site that calls it; the baseline is below
        const slot = v.ix + 2;
        const site = returnAddresses.get(word(v, slot));
        expect(site?.calleeIndex, `statement ${s.index} (line ${s.startLine})`).toBe(s.callableIndex);
        expect(v.sp).toBe(slot - frame.returnSlotOffset!);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
    expect(gosubLevels).toBe(2);
  });

  it("names the runtime's entry points, the error routine and the optimisation level", async () => {
    const { generated } = await compileBasic(PROGRAM);
    const ext = generated.debug.sourceLevel.extensions!;
    const names = ext.runtimeSymbols.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(["core.PrintU16", "core.ProgramSP", "core.RaiseError"]));
    expect(ext.errorEntry).toBe(ext.runtimeSymbols.find((s) => s.name === "core.RaiseError")!.address);
    expect(ext.optimizationLevel).toBe(0);
    expect(JSON.parse(JSON.stringify(generated.debug.sourceLevel))).toEqual(generated.debug.sourceLevel);
  });
});
