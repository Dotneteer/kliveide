import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import { CurrentStatementTracker, locateActivations, SourceDebugIndex } from "@emu/machines/SourceStepDecision";
import { parseMemoryMap } from "@main/boriel-integration/boriel-map";
import { adaptBorielDebugInfo } from "@main/boriel-integration/dbg-adapter";
import { buildSourceCallStack } from "@renderer/appIde/debugger/source/call-stack-model";
import type { MemoryView } from "@renderer/appIde/debugger/source/value-decoder";
import { buildVariableSections, type VariableNode } from "@renderer/appIde/debugger/source/variables-model";
import { evaluateWatch } from "@renderer/appIde/debugger/source/watch-expression";

import { createSp48Session } from "../harness/sp48";

/*
 * Klive's source-level debugger on Boriel BASIC programs (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md`
 * §5-§6): each fixture's zxbc-built binary runs on the real 48K with a breakpoint on every statement
 * of the converted debug data, and at each stop the call stack, the Variables panel and watches are
 * built from the machine and checked against each other and against known values.
 */

const FIXTURES = path.join(__dirname, "fixtures");
const ORG = 0x8000;
const STUB = 0xff00;

function load(name: string): SourceLevelDebugInfo {
  const folder = path.join(FIXTURES, name);
  return adaptBorielDebugInfo({
    dbg: JSON.parse(fs.readFileSync(path.join(folder, "program.dbg"), "utf8")),
    map: parseMemoryMap(fs.readFileSync(path.join(folder, "program.map"), "utf8")),
    arch: "zx48k",
    baseFolder: folder,
    optimizationLevel: 2,
    image: { bytes: fs.readFileSync(path.join(folder, "program.bin")), origin: ORG },
    readFile: (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : undefined)
  }).sourceLevelDebug;
}

/** A Variables row with its children read at the stop (memory moves on once the run continues). */
type Row = { name: string; value: string; children?: Row[] };

const snapshot = (nodes: VariableNode[], depth = 2): Row[] =>
  nodes.map((n) => ({
    name: n.name,
    value: n.value,
    ...(n.expand && depth > 0 ? { children: snapshot(n.expand(), depth - 1) } : {})
  }));

type Stop = {
  line: number;
  column: number;
  chain: ReturnType<typeof locateActivations>;
  callStack: ReturnType<typeof buildSourceCallStack>;
  locals: Row[];
  globals: Row[];
  problems: string[];
};

/** Runs a fixture to its end (or its error stop), collecting what the debugger shows at every statement. */
async function debugRun(name: string): Promise<{ info: SourceLevelDebugInfo; stops: Stop[]; errorStop?: { a: number } }> {
  const info = load(name);
  const session = await createSp48Session();
  session.bootToBasic();
  session.poke(ORG, [...fs.readFileSync(path.join(FIXTURES, name, "program.bin"))]);
  // --- ld hl,$1303 : push hl : ld ($5c3d),sp : call ORG : jr $  (as a running BASIC line calls USR)
  session.poke(STUB, [0x21, 0x03, 0x13, 0xe5, 0xed, 0x73, 0x3d, 0x5c, 0xcd, ORG & 0xff, ORG >> 8, 0x18, 0xfe]);
  session.machine.pc = STUB;
  const done = STUB + 11;

  const index = new SourceDebugIndex(info, false);
  const debug = session.attachDebugSupport();
  debug.statementTracker = new CurrentStatementTracker(index);
  const errorEntry = info.extensions!.errorEntry;
  debug.errorStopAddress = errorEntry;
  for (const s of info.statements) debug.addBreakpoint({ address: s.startAddress, exec: true });
  const mem: MemoryView = { byte: (a) => session.peek(a & 0xffff), word: (a) => session.peekWord(a & 0xffff) };

  const stops: Stop[] = [];
  for (let guard = 0; guard < 200; guard++) {
    let pc: number;
    try {
      pc = session.continueToBreakpoint({ returnTo: done, maxFrames: 300 });
    } catch {
      break;
    }
    if (pc === errorEntry) return { info, stops, errorStop: { a: (session.machine as any).a } };
    const statementIndex = index.entryAt(pc);
    const statement = info.statements[statementIndex];
    const view = { pc, sp: session.machine.sp, ix: session.machine.ix, readWord: (a: number) => session.peekWord(a) };
    const chain = locateActivations(index, view);
    const stop = { kind: "statement" as const, pc, statementIndex, returned: [] };
    const sections = buildVariableSections(info, chain, 0, stop, mem);
    const problems: string[] = [];
    // --- A watch naming a scalar shows what its Variables row shows
    for (const row of [...(sections.locals ?? []), ...sections.globals].filter((n) => !n.expand && n.address !== undefined)) {
      const r = evaluateWatch(row.name, { info, chain, frame: 0, mem });
      const text = "error" in r ? `error: ${r.error}` : r.text;
      if (text !== row.value) problems.push(`watch ${row.name} = ${text}, Variables shows ${row.value}`);
    }
    stops.push({
      line: statement.startLine,
      column: statement.startColumn,
      chain,
      callStack: buildSourceCallStack(info, chain, stop),
      locals: snapshot(sections.locals ?? []),
      globals: snapshot(sections.globals),
      problems
    });
  }
  return { info, stops };
}

const value = (nodes: Row[], name: string) => nodes.find((n) => n.name === name)?.value;
const names = (info: SourceLevelDebugInfo, stop: Stop) => stop.chain.map((a) => info.callables[a.callableIndex].name);

describe("the debugger on Boriel BASIC programs", () => {
  it("stops at every statement of the calls program with a consistent call stack and Variables panel", async () => {
    const { info, stops } = await debugRun("calls");
    // --- Every statement with code runs at least once (the ELSE branch is not taken: g = 7)
    const lines = new Set(stops.map((s) => s.line));
    for (const line of [11, 12, 18, 19, 21, 25, 28, 29, 30, 32, 33, 34, 35, 36, 37, 38, 39, 40, 42, 43]) expect(lines, `line ${line}`).toContain(line);
    for (const stop of stops) {
      expect(stop.problems, `line ${stop.line}`).toEqual([]);
      expect(stop.chain[stop.chain.length - 1].kind, `line ${stop.line}`).toBe("main");
      const top = stop.callStack[0];
      expect(top && !("runtime" in top) && top.line, `line ${stop.line}`).toBe(stop.line);
    }

    // --- Inside Square, called twice from one statement: Square over main, its parameter and local
    const square = stops.filter((s) => s.line === 12);
    expect(square).toHaveLength(2);
    expect(names(info, square[0])).toEqual(["Square", "main"]);
    expect(square.map((s) => value(s.locals, "n"))).toEqual(["4", "5"]);
    expect(square.map((s) => value(s.locals, "r"))).toEqual(["16", "25"]);

    // --- Inside Fill: the BYREF parameter, the loop variable, the fixed-size local array
    const fill = stops.find((s) => s.line === 21)!;
    expect(names(info, fill)).toEqual(["Fill", "main"]);
    expect(value(fill.locals, "n")).toBe("3");
    expect(value(fill.locals, "i")).toBe("10");
    const arr = fill.locals.find((n) => n.name === "arr")!;
    expect(arr.children!.map((n) => n.value)).toEqual(["3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);

    // --- GOSUB 1000's subroutine is a GOSUB activation of main
    const gosub = stops.find((s) => s.line === 42)!;
    expect(gosub.chain.map((a) => a.kind)).toEqual(["gosub", "main"]);

    // --- At the last PRINT the globals hold what the program assigned
    const end = stops.find((s) => s.line === 39)!;
    expect(value(end.globals, "name$")).toMatch(/HELLO/);
    expect(value(end.globals, "ratio")).toBe("3.25");
    expect(value(end.globals, "fx")).toBe("1.5");
    expect(value(end.globals, "total")).toBe("12");
    expect(value(end.globals, "g")).toBe("7");
  });

  it("places a FASTCALL routine on the call stack, without a frame (Phase B4)", async () => {
    const { info, stops } = await debugRun("calls");
    const twice = stops.find((s) => s.line === 25)!;
    expect(names(info, twice)).toEqual(["Twice", "main"]);
    expect(twice.chain[0]).toMatchObject({ kind: "routine" });
    expect(twice.chain[0].ix).toBeUndefined();
    // --- Its parameter arrives in A: the .dbg's frame location for it is wrong, so it is not shown
    expect(twice.locals).toEqual([]);
  });

  it("steps into, over and out of FUNCTION and FASTCALL calls", async () => {
    const info = load("calls");
    const session = await createSp48Session();
    session.bootToBasic();
    session.poke(ORG, [...fs.readFileSync(path.join(FIXTURES, "calls", "program.bin"))]);
    session.poke(STUB, [0x21, 0x03, 0x13, 0xe5, 0xed, 0x73, 0x3d, 0x5c, 0xcd, ORG & 0xff, ORG >> 8, 0x18, 0xfe]);
    session.machine.pc = STUB;
    const index = new SourceDebugIndex(info, false);
    const debug = session.attachDebugSupport();
    debug.statementTracker = new CurrentStatementTracker(index);
    const lineAt = (pc: number) => info.statements.find((st) => pc >= st.startAddress && pc < st.endAddress)?.startLine;
    const stopAtLine = (line: number) => {
      const st = info.statements.find((x) => x.startLine === line)!;
      debug.addBreakpoint({ address: st.startAddress, exec: true });
      session.continueToBreakpoint({ maxFrames: 300 });
      debug.removeBreakpoint({ address: st.startAddress, exec: true });
      expect(lineAt(session.machine.pc)).toBe(line);
    };

    // --- PRINT Square(4) + Square(5): into lands in Square, out comes back to the statement
    stopAtLine(34);
    session.sourceStep(index, "into");
    expect(lineAt(session.machine.pc)).toBe(11);
    session.sourceStep(index, "out");
    expect(lineAt(session.machine.pc)).toBe(34);
    // --- over runs the second call too and stops at the next statement
    session.sourceStep(index, "over");
    expect(lineAt(session.machine.pc)).toBe(35);

    // --- PRINT Twice(g): into a FASTCALL routine, out of it, then over
    session.sourceStep(index, "into");
    expect(lineAt(session.machine.pc)).toBe(25);
    session.sourceStep(index, "out");
    expect(lineAt(session.machine.pc)).toBe(35);
    session.sourceStep(index, "over");
    expect(lineAt(session.machine.pc)).toBe(36);
  });

  it("decodes global and fixed-size local arrays, strings, Float, Fixed and Long", async () => {
    const { stops } = await debugRun("arrays");
    expect(stops.every((s) => s.problems.length === 0)).toBe(true);
    const end = stops[stops.length - 1];
    expect(value(end.globals, "name$")).toMatch(/HELLO/);
    expect(value(end.globals, "total")).toBe("1012");
    const grid = end.globals.find((n) => n.name === "grid")!;
    expect(grid.children![1].children![2]).toMatchObject({ name: "grid(1, 2)", value: "42" });
    const words = end.globals.find((n) => n.name === "words$")!;
    expect(words.children![1].value).toMatch(/AB/);
    // --- The dynamic local array is left out; the routine's other locals are shown
    const dyn = stops.find((s) => s.locals.some((n) => n.name === "k"))!;
    expect(dyn.locals.map((n) => n.name)).toEqual(["k"]);
  });

  it("stops at the runtime error routine with the error code in A", async () => {
    const { stops, errorStop } = await debugRun("runtime-error");
    expect(stops.length).toBeGreaterThan(0);
    // --- a(k) = 1 with k = 5 under --debug-array: 2, Subscript wrong
    expect(errorStop).toEqual({ a: 2 });
  });
});
