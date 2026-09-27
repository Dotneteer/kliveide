import type { GeneratedProgram } from "@main/kbasic/codegen";
import type { KBasicOptions } from "@main/kbasic/options/options";

import { createSession, type NextTestSession, type Program } from "../../harness/zxnext";

import { compileBasic } from "./run-kit";

/**
 * Klive BASIC on the ZX Spectrum Next harness (plan §13.2): the program built for the `next` target
 * and loaded page by page as the NEX loader would place it, on a machine made ready for the 48K BASIC
 * ROM (`prepareBasic`), started from a stub that calls it as a running BASIC line would.
 */
export type NextStarted = { session: NextTestSession; program: Program; generated: GeneratedProgram; done: number };

/** The start-up stub: below the 48K machine stack `prepareBasic` copies to $FF00-$FFFF. */
const STUB = 0xfe00;

export async function startBasicNext(source: string, options: Partial<KBasicOptions> = {}): Promise<NextStarted> {
  const { generated } = await compileBasic(source, { target: "next", ...options });
  const session = await createSession();
  await session.prepareBasic();
  const program = session.loadOutput(generated.output, { entry: generated.entryAddress });
  const entry = generated.entryAddress;
  const report = program.symbol("core.ReportError");
  // --- As the NEX start stub: ei : ld hl,core.ReportError : push hl : ld ($5c3d),sp : call entry :
  // --- jr $ (IM 1, the ROM's frame interrupt runs; ERR_SP's slot sends a report to the runtime's)
  session.poke(STUB, [0xfb, 0x21, report & 0xff, report >> 8, 0xe5, 0xed, 0x73, 0x3d, 0x5c, 0xcd, entry & 0xff, entry >> 8, 0x18, 0xfe]);
  session.machine.sp = STUB - 2;
  session.machine.pc = STUB;
  return { session, program, generated, done: STUB + 12 };
}

export type NextRun = NextStarted & {
  screen(rows?: number): string[];
  byte(name: string): number;
  word(name: string): number;
};

/** Compiles, loads and runs a program on the Next until it ends (or `frames` pass). */
export async function runBasicNext(
  source: string,
  options: Partial<KBasicOptions> & { frames?: number; expectEnd?: boolean } = {}
): Promise<NextRun> {
  const { frames, expectEnd, ...compileOptions } = options;
  const started = await startBasicNext(source, compileOptions);
  const { session, program, done } = started;
  if (expectEnd === false) session.runFrames(frames ?? 50);
  else session.runTo(done, { maxFrames: frames ?? 500 });
  const symbol = (name: string) => program.symbol(`_${name}`);
  return {
    ...started,
    screen(rows = 24) {
      const out: string[] = [];
      for (let r = 0; r < rows; r++) out.push(session.screenLine(r));
      while (out.length && out[out.length - 1] === "") out.pop();
      return out;
    },
    byte: (name) => session.peek(symbol(name)),
    word: (name) => session.peekWord(symbol(name))
  };
}
