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
};

/** Where the start-up stub goes: it calls the program as a running BASIC line would, then loops. */
const STUB = 0xff00;

/**
 * Compiles, loads and runs a program on a freshly booted 48K until it ends (or `frames` pass, for
 * programs that stop with an error report). The program is called like `USR` from a running BASIC
 * line, so error reports print as they would.
 */
export async function runBasic(source: string, options: Partial<KBasicOptions> & { frames?: number; expectEnd?: boolean } = {}): Promise<Run> {
  const { generated } = await compileBasic(source, options);
  const session = await createSp48Session();
  session.bootToBasic();
  const program = session.loadOutput(generated.output, { entry: generated.entryAddress });
  const entry = generated.entryAddress;
  // --- ld hl,$1303 : push hl : ld ($5c3d),sp : call entry : jr $
  const done = STUB + 11;
  session.poke(STUB, [0x21, 0x03, 0x13, 0xe5, 0xed, 0x73, 0x3d, 0x5c, 0xcd, entry & 0xff, entry >> 8, 0x18, 0xfe]);
  session.machine.pc = STUB;
  if (options.expectEnd === false) session.runFrames(options.frames ?? 50);
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
    word: (name) => session.peekWord(symbol(name))
  };
}
