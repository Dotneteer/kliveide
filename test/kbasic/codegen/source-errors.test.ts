import { describe, expect, it } from "vitest";

import { basicErrorReport, CurrentStatementTracker, innermostUserStatement, SourceDebugIndex } from "@emu/machines/SourceStepDecision";
import { buildSourceCallStack } from "@renderer/appIde/debugger/source/call-stack-model";
import { locateActivations } from "@emu/machines/SourceStepDecision";

import { startBasic } from "./run-kit";

/**
 * Runtime-error stops (plan §10.10) on the 48K: a debug run stops at the runtime's error routine,
 * before the ROM's report, and names the BASIC statement that raised the error — also when the
 * routine is reached by a `jp` that leaves no return address to find it by.
 */
async function runToError(source: string, options = {}) {
  const { session, generated, done } = await startBasic(source, options);
  const info = generated.debug.sourceLevel;
  const index = new SourceDebugIndex(info);
  const debugSupport = session.attachDebugSupport();
  debugSupport.errorStopAddress = info.extensions!.errorEntry;
  // --- As MachineController arms it: the ROM's RST 8, while a statement of the program is on the stack
  const machineView = () => ({ pc: session.machine.pc, sp: session.machine.sp, ix: session.machine.ix, readWord: (a: number) => session.peekWord(a) });
  debugSupport.romErrorAddress = 0x0008;
  debugSupport.romErrorGuard = () => innermostUserStatement(index, machineView()) >= 0;
  const tracker = new CurrentStatementTracker(index);
  debugSupport.statementTracker = tracker;
  const pc = session.continueToBreakpoint({ returnTo: done, maxFrames: 400 });
  const lines = source.split("\n");
  const s = info.statements[tracker.current];
  const text = s ? lines[s.startLine - 1].slice(s.startColumn, s.endColumn) : undefined;
  const view = { pc, sp: session.machine.sp, ix: session.machine.ix, readWord: (a: number) => session.peekWord(a) };
  const code = pc === 0x0008 ? session.peek(session.peekWord(session.machine.sp)) : session.machine.a;
  return { session, info, index, pc, tracker, text, code, view };
}

describe("runtime-error stops (§10.10)", () => {
  it("stops at the error routine with the report and the statement that raised it", async () => {
    const r = await runToError(["DIM a AS UByte = 1", "a = a + 1 : ERROR 2 : PRINT a", 'PRINT "never"', ""].join("\n"));
    expect(r.pc).toBe(r.info.extensions!.errorEntry);
    expect(basicErrorReport(r.code)).toBe("3 Subscript wrong");
    expect(r.text).toBe("ERROR 2");
    // --- The ROM has not printed the report yet
    expect(r.session.screenLine(23)).not.toMatch(/Subscript wrong/);
  });

  it("names the statement inside a routine, with the call stack under it", async () => {
    const source = [
      "SUB Fail(n AS UByte)", // 1
      "  PRINT n;", // 2
      "  ERROR n", // 3
      "END SUB", // 4
      "Fail 9", // 5
      ""
    ].join("\n");
    const r = await runToError(source);
    expect(basicErrorReport(r.code)).toBe("A Invalid argument");
    expect(r.text).toBe("ERROR n");
    const stop = { kind: "error" as const, pc: r.pc, statementIndex: -1, userStatementIndex: r.tracker.current, returned: [] };
    const rows = buildSourceCallStack(r.info, locateActivations(r.index, r.view), stop);
    expect(rows.map((x) => ("runtime" in x ? "runtime" : `${x.name}:${x.line}`))).toEqual(["runtime", "Fail:3", "main:5"]);
  });

  it("stops when the runtime raises Out of memory (memory checking on)", async () => {
    const source = ["DIM s$ AS String", "DO", '  s$ = s$ + "0123456789"', "LOOP", ""].join("\n");
    const r = await runToError(source, { heapSize: 200, checkMemory: true });
    expect(basicErrorReport(r.code)).toBe("4 Out of memory");
    expect(r.text).toBe('s$ = s$ + "0123456789"');
  });

  it("stops when the ROM raises an error itself (RST 8), naming the statement", async () => {
    const source = ["DIM x AS Float = 1E30", 'PRINT "before"', "x = x * x * x * x * x", 'PRINT "not reached"', ""].join("\n");
    const r = await runToError(source);
    expect(r.pc).toBe(0x0008);
    expect(basicErrorReport(r.code)).toBe("6 Number too big");
    expect(r.text).toBe("x = x * x * x * x * x");
  });

  it("does not stop at the ROM's errors once the program has ended", async () => {
    const { session, generated, done } = await startBasic('PRINT "done"\n');
    const index = new SourceDebugIndex(generated.debug.sourceLevel);
    session.runTo(done);
    const view = { pc: session.machine.pc, sp: session.machine.sp, ix: session.machine.ix, readWord: (a: number) => session.peekWord(a) };
    expect(innermostUserStatement(index, view)).toBe(-1);
  });
});
