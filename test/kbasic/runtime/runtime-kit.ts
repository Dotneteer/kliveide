import { expect } from "vitest";

import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { ExpressionValue } from "@main/compiler-common/expressions";
import {
  endSource,
  prologueSource,
  resolveRuntimeModules,
  runtimeInitialisers,
  runtimeUnits,
  type RuntimeLayout
} from "@main/kbasic/runtime/runtime-linker";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

import { createSp48Session, type Sp48Program, type Sp48TestSession } from "../../harness/sp48";

export type RuntimeProgramOptions = {
  /** Runtime labels the program uses (`core.X` or `X`); their modules and requirements are linked. */
  uses: string[];
  /** Klive assembly placed after `Main`'s prologue and before its END (the "main program"). */
  main?: string;
  /** Klive assembly placed after the main program: test stubs and data. */
  extra?: string;
  /** Compiler-defined symbols (`KB_CHECK_MEMORY`, ...). */
  defines?: string[];
  layout?: RuntimeLayout;
};

/** The registers a runtime call takes and gives back. */
export type Regs = Partial<Record<"a" | "f" | "bc" | "de" | "hl" | "ix" | "iy" | "hl_", number>>;

/** A 48K booted to BASIC with a program and its runtime loaded, initialised through `Main`. */
export type RuntimeRig = {
  session: Sp48TestSession;
  program: Sp48Program;
  /** Calls a routine with the given registers; checks the stack is balanced; returns the registers. */
  call(where: string | number, regs?: Regs): Required<Regs>;
  /** Runs `Main`: prologue, initialisers, main program, END. */
  runMain(): void;
  /**
   * Starts `Main` as if a running BASIC line had called it and runs `frames` frames: the ROM keeps
   * MAIN-4 ($1303) under ERR_SP while it runs a line, so an error report is printed. (After
   * `bootToBasic` the ROM is in its line editor, where an error only rasps.)
   */
  startAsRunningLine(frames?: number): void;
};

const AS_RUNNING_LINE = ["AsRunningLine:", "    ld hl,$1303", "    push hl", "    ld ($5c3d),sp", "    jp Main"].join("\n");

export async function assembleRuntimeProgram(options: RuntimeProgramOptions) {
  const assemblerOptions = new AssemblerOptions();
  assemblerOptions.currentModel = SpectrumModelType.Spectrum48;
  for (const d of options.defines ?? []) assemblerOptions.predefinedSymbols[d] = new ExpressionValue(true);

  const modules = resolveRuntimeModules(options.uses, ["program"]);
  const source = [
    "    .model Spectrum48",
    "    .org $8000",
    "Main:",
    prologueSource(runtimeInitialisers(modules)),
    options.main ?? "",
    endSource(0),
    options.extra ?? "",
    AS_RUNNING_LINE
  ].join("\n");
  const assembler = new Z80Assembler();
  const programUnit = await assembler.parseSourceUnit("test-program.kbasic.asm", source, assemblerOptions);
  const units = [programUnit, ...(await runtimeUnits(modules, assemblerOptions, options.layout))];
  return { output: await new Z80Assembler().compileProgram(units, assemblerOptions), modules };
}

/** Links, loads and initialises a runtime test program on a freshly booted 48K. */
export async function createRuntimeRig(options: RuntimeProgramOptions & { init?: boolean }): Promise<RuntimeRig> {
  const session = await createSp48Session();
  session.bootToBasic();
  const { output } = await assembleRuntimeProgram(options);
  const program = session.loadOutput(output, { entry: "Main" });
  const m = session.machine;

  const rig: RuntimeRig = {
    session,
    program,
    runMain() {
      session.call("Main", { maxFrames: 500 });
    },
    startAsRunningLine(frames = 20) {
      m.pc = program.symbol("AsRunningLine");
      session.runFrames(frames);
    },
    call(where, regs = {}) {
      if (regs.a !== undefined || regs.f !== undefined) m.af = (((regs.a ?? m.a) & 0xff) << 8) | ((regs.f ?? m.f) & 0xff);
      if (regs.bc !== undefined) m.bc = regs.bc;
      if (regs.de !== undefined) m.de = regs.de;
      if (regs.hl !== undefined) m.hl = regs.hl;
      if (regs.ix !== undefined) m.ix = regs.ix;
      if (regs.iy !== undefined) m.iy = regs.iy;
      if (regs.hl_ !== undefined) m.hl_ = regs.hl_;
      const sp = m.sp;
      session.call(where, { maxFrames: 500 });
      expect(m.sp, `stack balanced across ${String(where)}`).toBe(sp);
      return { a: m.a, f: m.f, bc: m.bc, de: m.de, hl: m.hl, ix: m.ix, iy: m.iy, hl_: m.hl_ };
    }
  };
  if (options.init !== false) rig.runMain();
  return rig;
}

/** Signed 16-bit view of a register value. */
export function s16(value: number): number {
  return value & 0x8000 ? value - 0x10000 : value;
}

/** Signed 8-bit view of a register value. */
export function s8(value: number): number {
  return value & 0x80 ? value - 0x100 : value;
}

/** Bytes of the heap in use: the heap size minus the free blocks' sizes. */
export function heapUsed(rig: RuntimeRig): number {
  const s = rig.session;
  let free = 0;
  for (let p = s.peekWord(rig.program.symbol("core.FreeList")); p !== 0; p = s.peekWord(p + 2)) free += s.peekWord(p);
  return rig.program.symbol("core.HeapSize") - free;
}

/** Allocates a String through the runtime and writes its characters. Returns 0 for "". */
export function makeString(rig: RuntimeRig, text: string): number {
  if (text === "") return 0;
  const p = rig.call("core.StrAlloc", { bc: text.length }).hl;
  expect(p, "StrAlloc succeeded").not.toBe(0);
  rig.session.poke(p + 2, [...text].map((c) => c.charCodeAt(0)));
  return p;
}

/** The text of the String at p (0 = ""). */
export function readString(rig: RuntimeRig, p: number): string {
  if (p === 0) return "";
  const s = rig.session;
  const length = s.peekWord(p);
  let text = "";
  for (let i = 0; i < length; i++) text += String.fromCharCode(s.peek(p + 2 + i));
  return text;
}
