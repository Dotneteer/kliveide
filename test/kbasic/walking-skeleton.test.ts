/**
 * Klive BASIC walking skeleton (plan §17, R3): BASIC → tagged Klive assembly + Klive-written
 * runtime module → Klive's assembler → classic debug tables → a real 48K (sp48 harness), with
 * breakpoints resolved the way the IDE resolves them and one stop per statement of a
 * multi-statement line. A spike: replaced by the real compiler's tests in Phase 3.
 */
import { describe, expect, it } from "vitest";

import { createSp48Session, type Sp48TestSession } from "../harness/sp48";
import { compileSkeleton, parseSkeleton, type SkeletonOutput } from "./skeleton/walking-skeleton";

const SOURCE = [
  "' Klive BASIC walking skeleton",
  'PRINT "Hello" : PRINT "World"',
  'PRINT "A:B" \' colon inside a string, comment after',
  'PRINT "Done"'
].join("\n");

const RESOURCE = "code/skeleton.zxbas";

async function load(): Promise<{ s: Sp48TestSession; out: SkeletonOutput }> {
  const out = await compileSkeleton(SOURCE, RESOURCE);
  const s = await createSp48Session();
  s.bootToBasic();
  for (const seg of out.segments) s.poke(seg.startAddress, seg.emittedCode);
  return { s, out };
}

/** The IDE's source-breakpoint resolution (`refreshSourceCodeBreakpoints`): first list item of the line. */
function resolveLine(out: SkeletonOutput, resource: string, line: number): number | undefined {
  const fileIndex = out.sourceFileList.findIndex((f) => f.filename.endsWith(resource));
  return out.listFileItems.find((li) => li.fileIndex === fileIndex && li.lineNumber === line)?.address;
}

/** The IDE's execution-point lookup (`MonacoEditor.refreshCurrentBreakpoint`), from the classic tables. */
function executionPoint(out: SkeletonOutput, pc: number) {
  const item = out.listFileItems.find((li) => li.address === pc);
  const cols = out.sourceMap[pc];
  return item ? { line: item.lineNumber, startColumn: cols?.startColumn, endColumn: cols?.endColumn } : undefined;
}

describe("Klive BASIC walking skeleton", () => {
  it("splits a line into statements with exact column ranges", () => {
    const st = parseSkeleton(SOURCE);
    expect(st.map((s) => [s.line, s.startColumn, s.endColumn, s.text])).toEqual([
      [2, 0, 13, 'PRINT "Hello"'],
      [2, 16, 29, 'PRINT "World"'],
      [3, 0, 11, 'PRINT "A:B"'],
      [4, 0, 12, 'PRINT "Done"']
    ]);
  });

  it("compiles, links the Klive runtime module and runs on a real 48K", async () => {
    const { s, out } = await load();

    s.call(out.entry);

    expect([0, 1, 2, 3].map((r) => s.screenLine(r))).toEqual(["Hello", "World", "A:B", "Done"]);
    // --- every statement has its own, ascending, non-overlapping code range
    for (let i = 1; i < out.statements.length; i++) {
      expect(out.statements[i].startAddress).toBeGreaterThanOrEqual(out.statements[i - 1].endAddress);
    }
  });

  it("stops at a BASIC line breakpoint resolved like the IDE does, then at the line's second statement", async () => {
    const { s, out } = await load();
    const debugSupport = s.attachDebugSupport();

    // --- Line breakpoint on line 2: resolved to the first statement of the line
    const lineAddress = resolveLine(out, RESOURCE, 2)!;
    debugSupport.addBreakpoint({ resource: RESOURCE, line: 2, exec: true });
    debugSupport.resolveBreakpoint(RESOURCE, 2, lineAddress);
    // --- Statement breakpoint on the second statement of line 2 (plan §10.3: column breakpoints)
    const second = out.statements[1];
    debugSupport.addBreakpoint({ address: second.startAddress, exec: true });

    const firstStop = s.callToBreakpoint(out.entry);
    expect(firstStop).toBe(out.statements[0].startAddress);
    expect(executionPoint(out, firstStop)).toEqual({ line: 2, startColumn: 0, endColumn: 13 });
    expect(s.screenLine(0)).toBe("");
    const baselineAtFirst = s.machine.sp;

    const secondStop = s.continueToBreakpoint();
    expect(secondStop).toBe(second.startAddress);
    expect(executionPoint(out, secondStop)).toEqual({ line: 2, startColumn: 16, endColumn: 29 });
    expect(s.screenLine(0)).toBe("Hello");
    expect(s.screenLine(1)).toBe("");

    // --- G4 (plan §10.2.2): SP is the same at every statement entry of one activation, and the
    // --- prologue recorded that baseline for the debugger
    expect(s.machine.sp).toBe(baselineAtFirst);
    expect(out.mainBaselineAddress).toBeGreaterThan(0x8000);
    expect(s.peekWord(out.mainBaselineAddress)).toBe(baselineAtFirst);
  });
});
