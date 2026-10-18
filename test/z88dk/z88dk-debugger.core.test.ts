import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import { locateActivations, SourceDebugIndex } from "@emu/machines/SourceStepDecision";
import { adaptZ88dkDebugInfo } from "@main/z88dk-integration/z88dk-debug-adapter";
import { mapValue, parseZ88dkMap, projectFileTest, z88dkLineDebug, z88dkLineRecords } from "@main/z88dk-integration/z88dk-map";
import { buildSourceCallStack } from "@renderer/appIde/debugger/source/call-stack-model";
import type { MemoryView } from "@renderer/appIde/debugger/source/value-decoder";
import { buildVariableSections } from "@renderer/appIde/debugger/source/variables-model";

import { createSp48Session } from "../harness/sp48";

/*
 * Klive's source-level debugger on a z88dk C program (`.plans/Z88DK_INTEGRATION_PLAN.md` §8): the
 * committed zcc output runs on the real 48K with a breakpoint on every statement of the adapted
 * debug data; at each stop the call stack and the Variables panel are built from the machine through
 * sccz80's memory frame pointer (`framePointerAddress`) and checked against the program's values.
 */

const FIXTURE = path.join(__dirname, "fixtures", "zx-hello");
const ORG = 0x8000;

function load(): { info: SourceLevelDebugInfo; problems: string[] } {
  const symbols = parseZ88dkMap(fs.readFileSync(path.join(FIXTURE, "program.map"), "utf8"));
  const isProjectFile = projectFileTest([FIXTURE], "/opt/z88dk");
  const lineDebug = z88dkLineDebug(z88dkLineRecords(symbols, FIXTURE, isProjectFile));
  const out = adaptZ88dkDebugInfo({
    symbols,
    lineDebug,
    cwd: FIXTURE,
    isProjectFile,
    partitionOf: (b) => b,
    image: new Uint8Array(fs.readFileSync(path.join(FIXTURE, "program"))),
    origin: ORG
  })!;
  return { info: out.sourceLevelDebug, problems: out.problems };
}

describe("the debugger on a z88dk C program", () => {
  it("stops at every statement with the C call stack, parameters, locals and globals", async () => {
    const { info } = load();
    const session = await createSp48Session();
    session.bootToBasic();
    session.poke(ORG, [...fs.readFileSync(path.join(FIXTURE, "program"))]);
    const done = session.machine.pc;
    // --- `call` pushes the BASIC loop as the return address; the crt0 returns there
    session.machine.sp = (session.machine.sp - 2) & 0xffff;
    session.pokeWord(session.machine.sp, done);
    session.machine.pc = ORG;

    const index = new SourceDebugIndex(info, false);
    const debug = session.attachDebugSupport();
    for (const s of info.statements) debug.addBreakpoint({ address: s.startAddress, exec: true });
    const mem: MemoryView = { byte: (a) => session.peek(a & 0xffff), word: (a) => session.peekWord(a & 0xffff) };

    const stops: { line: number; chain: string[]; locals: Record<string, string>; globals: Record<string, string>; top?: number }[] = [];
    for (let guard = 0; guard < 50; guard++) {
      let pc: number;
      try {
        pc = session.continueToBreakpoint({ returnTo: done, maxFrames: 300 });
      } catch {
        break;
      }
      const statement = info.statements[index.entryAt(pc)];
      const view = { pc, sp: session.machine.sp, ix: session.machine.ix, readWord: (a: number) => session.peekWord(a) };
      const chain = locateActivations(index, view);
      const stop = { kind: "statement" as const, pc, statementIndex: statement.index, returned: [] };
      const sections = buildVariableSections(info, chain, 0, stop, mem);
      const rows = (nodes: { name: string; value: string }[] = []) => Object.fromEntries(nodes.map((n) => [n.name, n.value]));
      const callStack = buildSourceCallStack(info, chain, stop);
      const top = callStack[0];
      stops.push({
        line: statement.startLine,
        chain: chain.map((a) => info.callables[a.callableIndex].name),
        locals: rows(sections.locals),
        globals: rows(sections.globals),
        top: top && !("runtime" in top) ? top.line : undefined
      });
    }

    expect(stops.map((s) => s.line)).toEqual([16, 10, 11, 18]);
    // --- Every stop's call stack ends at the startup code and names the stopped line first
    for (const s of stops) {
      expect(s.chain[s.chain.length - 1], `line ${s.line}`).toBe("(startup)");
      expect(s.top, `line ${s.line}`).toBe(s.line);
    }
    // --- Inside add, called from main: its parameters, and its local once the declaration ran
    const inAdd = stops.find((s) => s.line === 11)!;
    expect(inAdd.chain).toEqual(["add", "main", "(startup)"]);
    expect(inAdd.locals).toEqual({ a: "3", b: "4", s: "7" });
    const firstInAdd = stops.find((s) => s.line === 10)!;
    expect(firstInAdd.locals).toMatchObject({ a: "3", b: "4" });
    // --- Back in main after the call: the global holds add's result
    const afterCall = stops.find((s) => s.line === 18)!;
    expect(afterCall.chain).toEqual(["main", "(startup)"]);
    expect(afterCall.globals.counter).toBe("7");
    expect(session.peekWord(mapValue(parseZ88dkMap(fs.readFileSync(path.join(FIXTURE, "program.map"), "utf8")), "_counter")!)).toBe(7);
  });

  it("steps over, into and out of a C function", async () => {
    const { info } = load();
    const session = await createSp48Session();
    session.bootToBasic();
    session.poke(ORG, [...fs.readFileSync(path.join(FIXTURE, "program"))]);
    const done = session.machine.pc;
    session.machine.sp = (session.machine.sp - 2) & 0xffff;
    session.pokeWord(session.machine.sp, done);
    session.machine.pc = ORG;

    const index = new SourceDebugIndex(info, false);
    const debug = session.attachDebugSupport();
    const lineAt = (pc: number) => info.statements.find((st) => pc >= st.startAddress && pc < st.endAddress)?.startLine;
    const line16 = info.statements.find((x) => x.startLine === 16)!;
    debug.addBreakpoint({ address: line16.startAddress, exec: true });
    session.continueToBreakpoint({ returnTo: done, maxFrames: 300 });
    debug.removeBreakpoint({ address: line16.startAddress, exec: true });
    expect(lineAt(session.machine.pc)).toBe(16);

    // --- counter = add(3, 4): into lands on add's first statement, over walks its body, out returns
    session.sourceStep(index, "into", { maxFrames: 300 });
    expect(lineAt(session.machine.pc)).toBe(10);
    session.sourceStep(index, "over", { maxFrames: 300 });
    expect(lineAt(session.machine.pc)).toBe(11);
    session.sourceStep(index, "out", { maxFrames: 300 });
    // --- Out stops back in main: at the return point in line 16, or the next statement
    expect([16, 18]).toContain(lineAt(session.machine.pc));
    if (lineAt(session.machine.pc) === 16) session.sourceStep(index, "over", { maxFrames: 300 });
    expect(lineAt(session.machine.pc)).toBe(18);
  });
});

