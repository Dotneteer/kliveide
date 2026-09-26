import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { SP48_MAIN_ENTRY } from "@emu/machines/ZxSpectrumBase";
import { ZxSpectrum48WasmV2Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

import { buildSp48Wasm, productionOutput } from "../../../scripts/build-sp48-wasm.cjs";

/** The real 48K BASIC ROM the app ships (`src/public/roms/sp48.rom`). */
const ROM_PATH = join(__dirname, "../../../src/public/roms/sp48.rom");

/** First byte of the ROM character set (character 32, space). */
const ROM_CHARSET = 0x3d00;

export type RunLimit = { maxFrames?: number };

/** A program assembled by `loadCode`. */
export type Sp48Program = {
  /** Address of a label or `.equ` symbol; throws if unknown. */
  symbol(name: string): number;
  /** Entry address: `.ent`, the `entry` option, or the first segment. */
  entry: number;
  /** The assembler's full output, for tests that inspect source maps and list items. */
  output: Awaited<ReturnType<Z80Assembler["compile"]>>;
};

class HarnessSp48Machine extends ZxSpectrum48WasmV2Machine {
  constructor(private readonly rom: Uint8Array) {
    super(undefined, {}, {
      artifactName: "harness-sp48-machine-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
  }

  protected override async loadRomFromResource(): Promise<Uint8Array> {
    return this.rom;
  }
}

/**
 * Creates a ZX Spectrum 48K with the real ROM, ready to boot. Build the WASM core first if it is
 * missing or stale (the same build the 48K machine tests use).
 */
export async function createSp48Session(): Promise<Sp48TestSession> {
  buildSp48Wasm();
  const machine = new HarnessSp48Machine(new Uint8Array(readFileSync(ROM_PATH)));
  await machine.setup();
  return new Sp48TestSession(machine);
}

/**
 * Scripts one real ZX Spectrum 48K (the WASM core) from a vitest test: boot to BASIC, load Klive
 * assembler source, call routines and run them to their return, read memory and the screen, and
 * run to breakpoints. Built for Klive BASIC's execution tests (see README.md).
 */
export class Sp48TestSession {
  /** Frames completed since the session started. */
  frames = 0;
  program?: Sp48Program;

  constructor(readonly machine: ZxSpectrum48WasmV2Machine) {}

  // ==========================================================================================
  // Booting and loading

  /**
   * Runs the ROM from reset until it reaches the BASIC main loop entry ($12AC). After this the
   * system variables are initialised, IY is $5C3A, interrupts run in IM 1, and the ROM's own
   * stack is in place: the state the IDE injects code into.
   */
  bootToBasic(limit: RunLimit = { maxFrames: 400 }): this {
    return this.runTo(SP48_MAIN_ENTRY, limit);
  }

  /**
   * Assembles Klive Z80 source in memory (`.model Spectrum48` added when missing) and writes it
   * into RAM. Does not change PC or SP: use `call` to run a routine. Banked segments are rejected
   * (the 48K has none).
   */
  async loadCode(source: string, options: { entry?: number | string } = {}): Promise<Sp48Program> {
    const text = /^\s*\.model\b/im.test(source) ? source : `  .model Spectrum48\n${source}`;
    const assemblerOptions = new AssemblerOptions();
    assemblerOptions.currentModel = SpectrumModelType.Spectrum48;
    return this.loadOutput(await new Z80Assembler().compile(text, assemblerOptions), options);
  }

  /**
   * Writes an assembler output into RAM - one built with `compileProgram`, for example. Throws on
   * assembly errors and on banked segments. Does not change PC or SP.
   */
  loadOutput(output: Sp48Program["output"], options: { entry?: number | string } = {}): Sp48Program {
    const errors = output.errors.filter((e) => !e.isWarning);
    if (errors.length) {
      throw new Error(
        "Assembly failed:\n" +
          errors.map((e) => `  ${e.filename} line ${e.line}:${e.startColumn} ${e.errorCode}: ${e.message}`).join("\n")
      );
    }
    const segments = output.segments.filter((s) => s.emittedCode.length);
    if (!segments.length) throw new Error("The source emits no code.");
    if (segments.some((s) => s.bank !== undefined)) throw new Error("The 48K has no banks.");
    for (const s of segments) this.poke(s.startAddress, s.emittedCode);

    const symbol = (name: string): number => {
      // --- getSymbol does not follow dotted module names: walk the nested modules for "core.X"
      const parts = name.split(".");
      let module: Pick<Sp48Program["output"], "getSymbol" | "getNestedModule"> | undefined = output;
      for (const part of parts.slice(0, -1)) module = module?.getNestedModule(part);
      const s = module?.getSymbol(parts[parts.length - 1]);
      if (!s?.value) throw new Error(`Unknown symbol '${name}'`);
      return s.value.value as number;
    };
    const entry =
      typeof options.entry === "string"
        ? symbol(options.entry)
        : (options.entry ?? output.entryAddress ?? segments[0].startAddress);
    this.program = { symbol, entry, output };
    return this.program;
  }

  // ==========================================================================================
  // Running

  /** Runs whole frames. */
  runFrames(count = 1): this {
    for (let i = 0; i < count; i++) this.runOneFrame();
    return this;
  }

  /** Runs until PC reaches the address (or label of the loaded program), stopping before it executes. */
  runTo(where: number | string, { maxFrames = 100 }: RunLimit = {}): this {
    const target = this.address(where);
    const ctx = this.machine.executionContext;
    ctx.frameTerminationMode = FrameTerminationMode.UntilExecutionPoint;
    ctx.terminationPoint = target;
    const limit = this.frames + maxFrames;
    try {
      while (true) {
        if (this.frames >= limit) {
          throw new Error(`Timed out after ${maxFrames} frames running to ${hex4(target)} (PC=${hex4(this.machine.pc)})`);
        }
        if (this.execute() === FrameTerminationMode.UntilExecutionPoint) return this;
      }
    } finally {
      ctx.frameTerminationMode = FrameTerminationMode.Normal;
      ctx.terminationPoint = undefined;
    }
  }

  /**
   * Calls a routine the way BASIC's `USR` does: pushes a return address (the current PC unless
   * given), jumps, and runs until the routine returns there. The routine must not execute that
   * address itself; after `bootToBasic` the current PC ($12AC) is safe.
   */
  call(where: number | string, options: { returnTo?: number } & RunLimit = {}): this {
    const ret = options.returnTo ?? this.machine.pc;
    const sp = (this.machine.sp - 2) & 0xffff;
    this.pokeWord(sp, ret);
    this.machine.sp = sp;
    this.machine.pc = this.address(where);
    return this.runTo(ret, options);
  }

  /** Executes `count` Z80 instructions. */
  step(count = 1): this {
    const ctx = this.machine.executionContext;
    ctx.debugStepMode = DebugStepMode.StepInto;
    try {
      for (let i = 0; i < count; i++) this.execute();
    } finally {
      ctx.debugStepMode = DebugStepMode.NoDebug;
    }
    return this;
  }

  // ==========================================================================================
  // Breakpoints

  /**
   * Attaches a fresh `DebugSupport` (the emulator's breakpoint store) and returns it, so a test can
   * add address breakpoints or resolve source breakpoints exactly as the IDE does.
   */
  attachDebugSupport(): DebugSupport {
    const debugSupport = new DebugSupport(undefined, []);
    this.machine.executionContext.debugSupport = debugSupport;
    return debugSupport;
  }

  /**
   * Starts a routine like `call` but in debug mode, and runs until a breakpoint stops the machine.
   * Returns the PC it stopped at. Throws if the routine returns first.
   */
  callToBreakpoint(where: number | string, options: { returnTo?: number } & RunLimit = {}): number {
    const ret = options.returnTo ?? this.machine.pc;
    const sp = (this.machine.sp - 2) & 0xffff;
    this.pokeWord(sp, ret);
    this.machine.sp = sp;
    this.machine.pc = this.address(where);
    return this.continueToBreakpoint({ ...options, returnTo: ret });
  }

  /** Continues in debug mode until a breakpoint stops the machine; returns the PC. */
  continueToBreakpoint(options: { returnTo?: number } & RunLimit = {}): number {
    const { maxFrames = 100, returnTo } = options;
    const ctx = this.machine.executionContext;
    if (!ctx.debugSupport) throw new Error("Call attachDebugSupport() first.");
    ctx.debugStepMode = DebugStepMode.StopAtBreakpoint;
    const limit = this.frames + maxFrames;
    try {
      while (true) {
        if (this.frames >= limit) throw new Error(`No breakpoint hit in ${maxFrames} frames (PC=${hex4(this.machine.pc)})`);
        const termination = this.execute();
        if (termination === FrameTerminationMode.DebugEvent) return this.machine.pc;
        if (returnTo !== undefined && this.machine.pc === returnTo) {
          throw new Error(`The routine returned to ${hex4(returnTo)} without hitting a breakpoint.`);
        }
      }
    } finally {
      ctx.debugStepMode = DebugStepMode.NoDebug;
    }
  }

  // ==========================================================================================
  // Memory and screen

  peek(address: number): number {
    return this.machine.doReadMemory(address & 0xffff);
  }

  peekWord(address: number): number {
    return this.peek(address) | (this.peek(address + 1) << 8);
  }

  poke(address: number, bytes: number | ArrayLike<number>): this {
    const data = typeof bytes === "number" ? [bytes] : bytes;
    for (let i = 0; i < data.length; i++) this.machine.doWriteMemory((address + i) & 0xffff, data[i] & 0xff);
    return this;
  }

  pokeWord(address: number, value: number): this {
    return this.poke(address, [value & 0xff, (value >> 8) & 0xff]);
  }

  /**
   * The character shown in a screen cell (row 0–23, column 0–31), recognised by comparing the
   * cell's eight pixel rows with the ROM character set (codes 32–127), ignoring INVERSE. Returns
   * `undefined` for a cell that matches no ROM character (UDGs, graphics, other fonts).
   */
  screenChar(row: number, col: number): string | undefined {
    const cell: number[] = [];
    for (let line = 0; line < 8; line++) {
      const address = 0x4000 | ((row & 0x18) << 8) | (line << 8) | ((row & 0x07) << 5) | col;
      cell.push(this.peek(address));
    }
    for (let code = 32; code < 128; code++) {
      const base = ROM_CHARSET + (code - 32) * 8;
      let same = true;
      let inverse = true;
      for (let line = 0; line < 8; line++) {
        const glyph = this.peek(base + line);
        if (cell[line] !== glyph) same = false;
        if (cell[line] !== (~glyph & 0xff)) inverse = false;
      }
      if (same || inverse) return String.fromCharCode(code);
    }
    return undefined;
  }

  /** One screen row as text (unrecognised cells as `?`), trailing spaces removed. */
  screenLine(row: number): string {
    let text = "";
    for (let col = 0; col < 32; col++) text += this.screenChar(row, col) ?? "?";
    return text.replace(/\s+$/, "");
  }

  // ==========================================================================================
  // Helpers

  address(where: number | string): number {
    if (typeof where === "number") return where & 0xffff;
    if (!this.program) throw new Error(`No program loaded to resolve '${where}'.`);
    return this.program.symbol(where);
  }

  private runOneFrame(): void {
    const start = this.frames;
    while (this.frames === start) this.execute();
  }

  private execute(): FrameTerminationMode {
    const termination = this.machine.executeMachineFrame();
    if (this.machine.frameJustCompleted) this.frames++;
    return termination;
  }
}

function hex4(value: number): string {
  return "$" + (value & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}
