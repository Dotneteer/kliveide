import fs from "fs";
import os from "os";
import path from "path";
import { expect } from "vitest";

import type { SourceStopInfo } from "@abstractions/SourceDebugInfo";
import { playInjectionFlow, type FrameMachine } from "@common/headless/frameRunner";
import { locateActivations, SourceDebugIndex } from "@emu/machines/SourceStepDecision";
import { buildSourceCallStack } from "@renderer/appIde/debugger/source/call-stack-model";
import { hasSourceLevelDebug } from "@renderer/appIde/utils/compiler-utils";
import type { MemoryView } from "@renderer/appIde/debugger/source/value-decoder";
import { buildVariableSections } from "@renderer/appIde/debugger/source/variables-model";
import { buildTemplate, codeToInjectOf, type TemplateBuild } from "./zccReplay";

/*
 * Runs the shipped z88dk templates (`.plans/ZX_SPECTRUM_C_TEMPLATES_PLAN.md`, T3) on the real cores the
 * way Run delivers them: the template fixture is built by `Z88dkCompiler` (zcc replayed), Run's
 * `CodeToInject` is made from its output as `injectCode` makes it, and the machine's own injection
 * flow plays it. The template prints "n squared is n*n" for `counter` = 1..5, so the loop leaves
 * `counter` at 6, and z88dk's console draws its own font, so the text shows as ink in the top rows.
 */

/** What the run needs of a harness session (the 48K, 128K/+3/Scorpion, Timex and Next sessions all have it). */
export type TemplateSession = {
  machine: unknown;
  peek(address: number): number;
  peekWord(address: number): number;
  runFrames(count?: number): unknown;
};

/** The template's `counter` once the loop is done (`for (counter = 1; counter <= 5; counter++)`). */
export const COUNTER_DONE = 6;

/** The 48K ROM's FRAMES system variable, which its interrupt routine counts up every frame. */
const FRAMES = 0x5c78;

export async function withTemp<T>(body: (temp: string) => Promise<T>): Promise<T> {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "klive-z88dk-tpl-"));
  try {
    return await body(temp);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

/** The address of a C global in a build's symbol table (`counter` → `_counter`). */
export function globalAddress(out: TemplateBuild, name: string): number {
  const symbol = (out.symbols as Record<string, any> | undefined)?.[name];
  const address = symbol?.value?._value;
  if (typeof address !== "number") throw new Error(`The build has no address for '${name}'.`);
  return address;
}

/** Ink anywhere in the first two character rows of the ULA screen. */
export function topRowsHaveInk(s: TemplateSession): boolean {
  // --- Character row r of the top third: pixel line l of it is at $4000 + l * 256 + r * 32
  for (let row = 0; row < 2; row++) {
    for (let line = 0; line < 8; line++) {
      for (let col = 0; col < 32; col++) if (s.peek(0x4000 + line * 256 + row * 32 + col) !== 0) return true;
    }
  }
  return false;
}

/** Runs frames until the template's loop is done; returns the frames it took. */
export function runUntilCounterDone(s: TemplateSession, out: TemplateBuild, maxFrames = 600): number {
  const counter = globalAddress(out, "counter");
  for (let frames = 0; frames < maxFrames; frames++) {
    if (s.peekWord(counter) === COUNTER_DONE) return frames;
    s.runFrames(1);
  }
  throw new Error(`counter is ${s.peekWord(counter)}, not ${COUNTER_DONE}, after ${maxFrames} frames`);
}

/**
 * Builds the template for the machine and model, then plays Run on a Spectrum session: the injection
 * flow for the output's model, the program until its loop is done, then 50 more frames, which must
 * find the program returned into BASIC (PC in the ROM, the ROM's interrupt counting FRAMES again).
 */
export async function runSpectrumTemplate(
  s: TemplateSession,
  fixture: string,
  machineId: string,
  modelId?: string
): Promise<TemplateBuild> {
  return withTemp(async (temp) => {
    const out = await buildTemplate(temp, fixture, machineId, modelId, "build");
    expect(out.z88dkRun).toBe("inject");
    const code = codeToInjectOf(out);
    const machine = s.machine as FrameMachine & { getCodeInjectionFlow(model: string): Promise<any> };
    playInjectionFlow(machine, await machine.getCodeInjectionFlow(code.model), { code });
    runUntilCounterDone(s, out);
    expect(topRowsHaveInk(s), "the template's text in the top rows").toBe(true);
    const framesBefore = s.peekWord(FRAMES);
    s.runFrames(50);
    expect(machine.pc, "PC back in the ROM").toBeLessThan(0x4000);
    expect((s.peekWord(FRAMES) - framesBefore) & 0xffff, "the ROM's interrupt counts FRAMES").toBeGreaterThanOrEqual(45);
    return out;
  });
}

// ─── Debug (`.plans/ZX_SPECTRUM_C_TEMPLATES_PLAN.md` T4) ──────────────────────────────────────────

/** What the debug walkthrough needs of a harness session, beyond running it. */
export type DebugSession = TemplateSession & {
  machine: { pc: number; sp: number; ix: number };
  attachDebugSupport(): {
    addBreakpoint(bp: { address: number; exec: boolean }): unknown;
    removeBreakpoint(bp: { address: number; exec: boolean }): unknown;
  };
  continueToBreakpoint(options?: { returnTo?: number; maxFrames?: number }): number;
  sourceStep(index: SourceDebugIndex, kind: "into" | "over" | "out", options?: { returnTo?: number; maxFrames?: number }): unknown;
};

/** One stop as the IDE shows it: the line, the Call Stack, and the Variables panel's sections. */
export type DebugStop = {
  line: number | undefined;
  callStack: string[];
  topLine: number | undefined;
  locals: Record<string, string>;
  globals: Record<string, string>;
};

/**
 * Walks the template through the debugger as a user does after pressing Debug with a breakpoint on
 * `int result = value * value;` (in `square`): stop there, Step Over, Step Out, Continue to the next
 * call. The breakpoint is resolved as the IDE resolves a C line's breakpoint (the build's list
 * items), stepping is the IDE's source stepping with its default Just My Code, and each stop's Call
 * Stack and Variables are built by the IDE's own models from the machine's memory.
 * @param returnTo where the program returns when it ends (undefined: the Next, which does not return)
 */
export function debugWalkthrough(s: DebugSession, out: TemplateBuild, source: string, returnTo?: number) {
  // --- What Debug sends the emulator (`injectCode`: `setSourceDebugInfo`)
  if (!hasSourceLevelDebug(out)) throw new Error("The debug build carries no source-level debug information.");
  const info = out.sourceLevelDebug;
  const lines = source.split(/\r?\n/);
  const lineOf = (text: string) => {
    const at = lines.findIndex((l) => l.includes(text));
    if (at < 0) throw new Error(`The template has no line with '${text}'.`);
    return at + 1;
  };
  const lineAt = (pc: number) => info.statements.find((st) => pc >= st.startAddress && pc < st.endAddress)?.startLine;
  const index = new SourceDebugIndex(info, true);
  const mem: MemoryView = { byte: (a) => s.peek(a & 0xffff), word: (a) => s.peekWord(a & 0xffff) };
  /** The stop as `MachineController.getSourceStopInfo` builds it, then the IDE's two panels from it. */
  const stopNow = (step?: any): DebugStop => {
    const pc = s.machine.pc;
    const view = { pc, sp: s.machine.sp, ix: s.machine.ix, readWord: (a: number) => s.peekWord(a & 0xffff) };
    const chain = locateActivations(index, view as any);
    let stop: SourceStopInfo;
    if (step?.stoppedAt && step.stopPc === pc) {
      const from = step.stoppedAt === "returnPoint" ? step.chain[step.level - 1] : undefined;
      stop = {
        kind: step.stoppedAt,
        pc,
        statementIndex: step.stopStatement ?? index.statementAt(pc),
        ...(from?.kind === "routine" ? { returnedFrom: from.callableIndex } : {}),
        returned: step.returned
      };
    } else {
      stop = { kind: "other", pc, statementIndex: index.statementAt(pc), returned: step?.returned ?? [] };
    }
    const sections = buildVariableSections(info, chain, 0, stop, mem);
    const rows = (nodes: { name: string; value: string }[] = []) => Object.fromEntries(nodes.map((n) => [n.name, n.value]));
    const top = buildSourceCallStack(info, chain, stop)[0];
    return {
      line: lineAt(pc),
      callStack: chain.map((a) => info.callables[a.callableIndex].name),
      topLine: top && !("runtime" in top) ? top.line : undefined,
      locals: rows(sections.locals),
      globals: rows(sections.globals)
    };
  };

  const resultLine = lineOf("int result = value * value;");
  const returnLine = lineOf("return result;");
  const callLine = lineOf("square(counter)");
  // --- The IDE binds a C line's breakpoint through the build's list items (file + line → address)
  const item = out.listFileItems?.find((i) => i.lineNumber === resultLine);
  if (!item) throw new Error(`Line ${resultLine} has no address in the build: a breakpoint there would not bind.`);
  const breakpoint = { address: item.address, exec: true };
  const debug = s.attachDebugSupport();
  debug.addBreakpoint(breakpoint);

  const firstStop = (s.continueToBreakpoint({ returnTo, maxFrames: 300 }), stopNow());
  debug.removeBreakpoint(breakpoint);
  const afterOver = stopNow(s.sourceStep(index, "over", { returnTo, maxFrames: 300 }));
  const afterOut = stopNow(s.sourceStep(index, "out", { returnTo, maxFrames: 300 }));
  debug.addBreakpoint(breakpoint);
  s.continueToBreakpoint({ returnTo, maxFrames: 300 });
  const secondStop = stopNow();
  return { lines: { resultLine, returnLine, callLine }, firstStop, afterOver, afterOut, secondStop };
}

/** The walkthrough's expected stops, the same for every machine. */
export function expectWalkthrough(w: ReturnType<typeof debugWalkthrough>): void {
  const { resultLine, returnLine, callLine } = w.lines;
  // --- The breakpoint stops on its line, in square called from main, on the first call
  expect(w.firstStop).toMatchObject({ line: resultLine, topLine: resultLine, callStack: ["square", "main", "(startup)"] });
  expect(w.firstStop.locals.value).toBe("1");
  expect(w.firstStop.globals.counter).toBe("1");
  // --- Step Over runs the line: `result` is assigned, and the stop is on `return result;`
  expect(w.afterOver).toMatchObject({ line: returnLine, topLine: returnLine, callStack: ["square", "main", "(startup)"] });
  expect(w.afterOver.locals).toMatchObject({ value: "1", result: "1" });
  // --- Step Out returns into main, at the line that called square
  expect(w.afterOut).toMatchObject({ line: callLine, topLine: callLine, callStack: ["main", "(startup)"] });
  // --- Continue: the next call stops at the breakpoint with the next value
  expect(w.secondStop).toMatchObject({ line: resultLine, topLine: resultLine, callStack: ["square", "main", "(startup)"] });
  expect(w.secondStop.locals.value).toBe("2");
  expect(w.secondStop.globals.counter).toBe("2");
}
