import { describe, expect, it } from "vitest";

import { locateActivations, SourceDebugIndex } from "@emu/machines/SourceStepDecision";
import { problemMessage } from "@main/z80-backend/problems";
import { debugLanguageOf } from "@renderer/appIde/debugger/languages/registry";
import { buildSourceCallStack } from "@renderer/appIde/debugger/source/call-stack-model";
import { buildVariableSections } from "@renderer/appIde/debugger/source/variables-model";

import { createSp48Session } from "../../harness/sp48";
import { compileMini } from "./mini";

/**
 * The "mini" language run on the real 48K core (`.plans/SHARED_Z80_BACKEND_PLAN.md` §5, Phase 6):
 * its program prints, and the source-level debugger — which has no plugin for mini — stops at its
 * statements with the right call stack and variables, at every optimisation level.
 */
const PROGRAM = ["var total", "proc show(n)", "  print n * 2", "end", "total = 7 / 2", "while total > 0 do", "  call show(total)", "  total = total - 1", "end", ""].join("\n");

const STUB = 0xff00;

async function start(optimize: number) {
  const result = await compileMini(PROGRAM, { optimize });
  if (!result.ok) throw new Error(result.problems.map(problemMessage).join("; "));
  const { compiled } = result;
  const session = await createSp48Session();
  session.bootToBasic();
  session.loadOutput(compiled.output, { entry: compiled.entryAddress });
  // --- ld hl,$1303 : push hl : ld ($5c3d),sp : call entry : jr $  (as a running BASIC line calls USR)
  const entry = compiled.entryAddress;
  session.poke(STUB, [0x21, 0x03, 0x13, 0xe5, 0xed, 0x73, 0x3d, 0x5c, 0xcd, entry & 0xff, entry >> 8, 0x18, 0xfe]);
  session.machine.pc = STUB;
  return { session, compiled, done: STUB + 11 };
}

describe("the mini language on the 48K", () => {
  for (const optimize of [0, 1, 2, 3]) {
    it(`prints what the program computes (optimize ${optimize})`, async () => {
      const { session, done } = await start(optimize);
      session.runTo(done, { maxFrames: 300 });
      // --- 7 / 2 truncates to 3: show(3), show(2), show(1)
      expect([0, 1, 2].map((row) => session.screenLine(row).trimEnd())).toEqual(["6", "4", "2"]);
    });
  }

  it("stops at a statement of the procedure with the call stack and variables of its activation", async () => {
    const { session, compiled, done } = await start(0);
    const info = compiled.debug.sourceLevel;
    const index = new SourceDebugIndex(info);
    const debug = session.attachDebugSupport();
    const print = info.statements.find((s) => s.startLine === 3)!;
    debug.addBreakpoint({ address: print.startAddress, exec: true });
    session.continueToBreakpoint({ returnTo: done });
    // --- The second time through: show(2)
    session.continueToBreakpoint({ returnTo: done });
    const view = { pc: session.machine.pc, sp: session.machine.sp, ix: session.machine.ix, readWord: (a: number) => session.peekWord(a) };
    const chain = locateActivations(index, view);
    expect(chain.map((a) => a.kind)).toEqual(["routine", "entry"]);
    const stop = { kind: "statement" as const, pc: view.pc, statementIndex: index.statementAt(view.pc), returned: [] };
    const lang = debugLanguageOf(info.language);
    const rows = buildSourceCallStack(info, chain, stop, lang);
    expect(rows.map((r) => ("runtime" in r ? "runtime" : `${r.name}:${r.line}`))).toEqual(["show:3", "main:7"]);
    const mem = { byte: (a: number) => session.peek(a & 0xffff), word: (a: number) => session.peekWord(a & 0xffff) };
    const sections = buildVariableSections(info, chain, 0, stop, mem, lang);
    expect(sections.locals?.map((v) => `${v.name}=${v.value} (${v.type})`)).toEqual(["n=2 (int)"]);
    expect(sections.globals.map((v) => `${v.name}=${v.value}`)).toEqual(["total=2"]);
  });
});
