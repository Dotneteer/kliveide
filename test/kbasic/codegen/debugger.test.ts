import { describe, expect, it } from "vitest";

import type { ClassicTables } from "@main/kbasic/debug/builder";

import { startBasic } from "./run-kit";

/**
 * The IDE's breakpoints and execution point on Klive BASIC builds (plan §10.1, Phase 3's exit
 * criterion): the classic tables are read exactly as the IDE reads them, and the program runs on a
 * real 48K under the emulator's own breakpoint store. (These replace the walking skeleton's checks.)
 */
const SOURCE = ["' Breakpoints", 'PRINT "Hello" : PRINT "World"', "PRINT \"A:B\" ' a colon in a string, a comment after", 'PRINT "Done"', ""].join("\n");
const RESOURCE = "main.bas";

/** `refreshSourceCodeBreakpoints`: a line breakpoint resolves to the line's first list item. */
function resolveLine(classic: ClassicTables, line: number): number | undefined {
  const fileIndex = classic.sourceFileList.findIndex((f) => f.filename.endsWith(RESOURCE));
  return classic.listFileItems.find((li) => li.fileIndex === fileIndex && li.lineNumber === line)?.address;
}

/** `MonacoEditor.refreshCurrentBreakpoint`: the execution point's line and columns. */
function executionPoint(classic: ClassicTables, pc: number) {
  const item = classic.listFileItems.find((li) => li.address === pc);
  const cols = classic.sourceMap[pc];
  return item ? { line: item.lineNumber, startColumn: cols?.startColumn, endColumn: cols?.endColumn } : undefined;
}

describe("breakpoints and the execution point", () => {
  it("lists only the BASIC file, one item per statement, ascending and apart", async () => {
    const { generated } = await startBasic(SOURCE);
    const { classic } = generated.debug;
    expect(classic.sourceFileList.map((f) => f.filename)).toEqual(["/test/main.bas"]);
    expect(classic.listFileItems.map((i) => i.lineNumber)).toEqual([2, 2, 3, 4]);
    for (let i = 1; i < classic.listFileItems.length; i++) {
      const [a, b] = [classic.listFileItems[i - 1], classic.listFileItems[i]];
      expect(b.address).toBeGreaterThanOrEqual(a.address + (a.codeLength ?? 0));
    }
  });

  it("stops at a line breakpoint on the line's first statement, then at a statement breakpoint on its second", async () => {
    const { session: s, generated } = await startBasic(SOURCE);
    const { classic, addresses } = generated.debug;
    const debug = s.attachDebugSupport();
    const lineAddress = resolveLine(classic, 2)!;
    debug.addBreakpoint({ resource: RESOURCE, line: 2, exec: true });
    debug.resolveBreakpoint(RESOURCE, 2, lineAddress);
    const second = addresses[1];
    debug.addBreakpoint({ address: second.start, exec: true });

    const first = s.continueToBreakpoint();
    expect(first).toBe(addresses[0].start);
    expect(executionPoint(classic, first)).toEqual({ line: 2, startColumn: 0, endColumn: 13 });
    expect(s.screenLine(0)).toBe("");
    const sp = s.machine.sp;

    expect(s.continueToBreakpoint()).toBe(second.start);
    expect(executionPoint(classic, second.start)).toEqual({ line: 2, startColumn: 16, endColumn: 29 });
    expect(s.screenLine(0)).toBe("Hello");
    // --- G4: the same SP at both entries, and the prologue recorded it for the debugger
    expect(s.machine.sp).toBe(sp);
    expect(s.peekWord(s.program!.symbol("core.ProgramSP"))).toBe(sp);
  });

  it("gives a statement inside a routine and the routine's END its own stops", async () => {
    const source = "SUB greet()\n PRINT \"in\"\nEND SUB\ngreet\n";
    const { session: s, generated } = await startBasic(source);
    const { classic } = generated.debug;
    const debug = s.attachDebugSupport();
    for (const line of [2, 3]) debug.addBreakpoint({ address: resolveLine(classic, line)!, exec: true });
    expect(executionPoint(classic, s.continueToBreakpoint())?.line).toBe(2);
    expect(executionPoint(classic, s.continueToBreakpoint())).toEqual({ line: 3, startColumn: 0, endColumn: 7 });
    expect(s.screenLine(0)).toBe("in");
  });
});
