import { DiagnosticBag } from "@main/kbasic/diagnostics";
import { generateProgram, type GeneratedProgram } from "@main/kbasic/codegen";
import { runFrontEnd } from "@main/kbasic/KBasicCompiler";
import { defaultOptions, type KBasicOptions } from "@main/kbasic/options/options";

import { createSp48Session, type Sp48Program, type Sp48TestSession } from "../../harness/sp48";

export type Compiled = {
  generated: GeneratedProgram;
  diagnostics: DiagnosticBag;
};

/** Compiles BASIC source; throws with the diagnostics when there is an error. */
export async function compileBasic(source: string, options: Partial<KBasicOptions> = {}): Promise<Compiled> {
  const diagnostics = new DiagnosticBag();
  const base = { ...defaultOptions(), optimize: 0, ...options };
  const front = runFrontEnd("/test/main.bas", source, { read: () => undefined }, base, diagnostics);
  const errors = () => diagnostics.items.filter((d) => d.severity === "error");
  if (errors().length || !front.bound) throw new Error(`Front-end errors: ${errors().map((d) => `${d.code} ${d.message}`).join("; ")}`);
  const generated = await generateProgram(front.bound, front.sources, front.options, "main", diagnostics);
  if (!generated || errors().length) throw new Error(`Code generation errors: ${errors().map((d) => `${d.code} ${d.message}`).join("; ")}`);
  return { generated, diagnostics };
}

export type Run = {
  session: Sp48TestSession;
  program: Sp48Program;
  generated: GeneratedProgram;
  /** The screen's rows 0..n as text, trailing blanks removed. */
  screen(rows?: number): string[];
  /** A global variable's value (`_name`), read as a byte or a word. */
  byte(name: string): number;
  word(name: string): number;
  /** With `traceEntries`: every statement entry the program passed, in order, with SP and IX there. */
  entries: StatementVisit[];
};

export type StatementVisit = { sid: number; sp: number; ix: number };

/** Where the start-up stub goes: it calls the program as a running BASIC line would, then loops. */
const STUB = 0xff00;

export type Started = { session: Sp48TestSession; program: Sp48Program; generated: GeneratedProgram; done: number };

/**
 * Compiles and loads a program on a freshly booted 48K, with PC at a stub that calls it as a running
 * BASIC line would. `done` is the stub's address after the call: the program has returned.
 */
export async function startBasic(source: string, options: Partial<KBasicOptions> = {}): Promise<Started> {
  const { generated } = await compileBasic(source, options);
  const session = await createSp48Session();
  session.bootToBasic();
  const program = session.loadOutput(generated.output, { entry: generated.entryAddress });
  const entry = generated.entryAddress;
  // --- ld hl,$1303 : push hl : ld ($5c3d),sp : call entry : jr $
  session.poke(STUB, [0x21, 0x03, 0x13, 0xe5, 0xed, 0x73, 0x3d, 0x5c, 0xcd, entry & 0xff, entry >> 8, 0x18, 0xfe]);
  session.machine.pc = STUB;
  return { session, program, generated, done: STUB + 11 };
}

/**
 * Compiles, loads and runs a program on a freshly booted 48K until it ends (or `frames` pass, for
 * programs that stop with an error report). The program is called like `USR` from a running BASIC
 * line, so error reports print as they would.
 */
export async function runBasic(
  source: string,
  options: Partial<KBasicOptions> & {
    frames?: number;
    expectEnd?: boolean;
    before?: (session: Sp48TestSession) => void;
    /** Stop at every statement entry (a breakpoint each) and record SP and IX there. */
    traceEntries?: boolean;
  } = {}
): Promise<Run> {
  const { session, program, generated, done } = await startBasic(source, options);
  options.before?.(session);
  const entries: StatementVisit[] = [];
  if (options.traceEntries) traceEntries(session, generated, done, options, entries);
  else if (options.expectEnd === false) session.runFrames(options.frames ?? 50);
  else session.runTo(done, { maxFrames: options.frames ?? 500 });
  const symbol = (name: string) => program.symbol(`_${name}`);
  return {
    session,
    program,
    generated,
    screen(rows = 24) {
      const out: string[] = [];
      for (let r = 0; r < rows; r++) out.push(session.screenLine(r).trimEnd());
      while (out.length && out[out.length - 1] === "") out.pop();
      return out;
    },
    byte: (name) => session.peek(symbol(name)),
    word: (name) => session.peekWord(symbol(name)),
    entries
  };
}

/**
 * Runs the program in debug mode with a breakpoint on every statement entry and one where the stub
 * regains control, recording each entry. A program expected not to end (an error report) runs until
 * no breakpoint is hit for `frames` frames.
 */
function traceEntries(
  session: Sp48TestSession,
  generated: GeneratedProgram,
  done: number,
  options: { frames?: number; expectEnd?: boolean },
  entries: StatementVisit[]
): void {
  const debug = session.attachDebugSupport();
  const sidAt = new Map<number, number>();
  for (const a of generated.debug.addresses) {
    if (a.elided) continue;
    sidAt.set(a.start, a.sid);
    debug.addBreakpoint({ address: a.start, exec: true });
  }
  debug.addBreakpoint({ address: done, exec: true });
  const maxFrames = options.frames ?? (options.expectEnd === false ? 100 : 500);
  while (true) {
    let pc: number;
    try {
      pc = session.continueToBreakpoint({ maxFrames });
    } catch (e) {
      if (options.expectEnd === false) return;
      throw e;
    }
    if (pc === done) return;
    const m = session.machine;
    entries.push({ sid: sidAt.get(pc)!, sp: m.sp, ix: m.ix });
  }
}
