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

/** A statement entry the traced program passed: SP and IX there, and the 32 stack words from SP up. */
export type StatementVisit = { sid: number; sp: number; ix: number; stack: number[] };

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
  return { session, program, generated, done: callFromStub(session, generated.entryAddress) };
}

/** Puts PC at a stub that calls `entry` as a running BASIC line would; gives the address after the call. */
function callFromStub(session: Sp48TestSession, entry: number): number {
  // --- ld hl,$1303 : push hl : ld ($5c3d),sp : call entry : jr $
  session.poke(STUB, [0x21, 0x03, 0x13, 0xe5, 0xed, 0x73, 0x3d, 0x5c, 0xcd, entry & 0xff, entry >> 8, 0x18, 0xfe]);
  session.machine.pc = STUB;
  return STUB + 11;
}

/**
 * Runs a machine-code program (another compiler's `.bin`, for the behavioural oracle) on a freshly
 * booted 48K as `runBasic` runs a Klive BASIC one: loaded at `org`, called from the same stub, until
 * it returns or `frames` pass. `ended` says whether it returned.
 */
export async function runBinary(
  bytes: Uint8Array,
  org: number,
  options: { frames?: number; before?: (session: Sp48TestSession) => void } = {}
): Promise<{ session: Sp48TestSession; ended: boolean }> {
  const session = await createSp48Session();
  session.bootToBasic();
  session.poke(org, [...bytes]);
  const done = callFromStub(session, org);
  options.before?.(session);
  try {
    session.runTo(done, { maxFrames: options.frames ?? 500 });
    return { session, ended: true };
  } catch (e) {
    if (!/Timed out/.test((e as Error).message)) throw e;
    return { session, ended: false };
  }
}

/** The keys that type `RANDOMIZE USR <address>` in the 48K's K mode, then ENTER. */
function randomizeUsrKeys(address: number): string[][] {
  const digits = String(address).split("").map((d) => [`N${d}`]);
  return [["T"], ["CShift", "SShift"], ["L"], ...digits, ["Enter"]];
}

/** BASIC's report on the bottom row, as the ROM prints it after a command ("0 OK, 0:1"). */
const BASIC_REPORT = /^[0-9A-R] .*, \d+:\d+$/;

/**
 * Runs a machine-code program the way a user does (compatibility plan C1): loaded at `org` on a
 * freshly booted 48K, started by typing `RANDOMIZE USR <org>` at the keyboard, and run until BASIC
 * prints its report on the bottom row (or `frames` pass). What the user sees after the program
 * returns - the report BASIC prints, whatever ERR_NR the program left - is on the screen.
 */
export async function runBinaryThroughBasic(
  bytes: Uint8Array,
  org: number,
  options: { frames?: number; before?: (session: Sp48TestSession) => void; then?: string[][] } = {}
): Promise<{ session: Sp48TestSession; report?: string }> {
  const session = await createSp48Session();
  session.bootToBasic();
  session.runFrames(20);
  session.poke(org, [...bytes]);
  // --- `then`: more of the command line after the USR, before ENTER (": PRINT 7")
  const keys = randomizeUsrKeys(org);
  session.typeKeys([...keys.slice(0, -1), ...(options.then ?? []), ...keys.slice(-1)]);
  // --- Keys the program reads go down once the command is typed, so they cannot become part of it
  options.before?.(session);
  const limit = options.frames ?? 500;
  for (let frame = 0; frame < limit; frame += 5) {
    session.runFrames(5);
    const bottom = session.screenLine(23).trimEnd();
    if (BASIC_REPORT.test(bottom)) return { session, report: bottom };
  }
  return { session };
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
    entries.push({ sid: sidAt.get(pc)!, sp: m.sp, ix: m.ix, stack: Array.from({ length: 32 }, (_, k) => session.peekWord((m.sp + 2 * k) & 0xffff)) });
  }
}
