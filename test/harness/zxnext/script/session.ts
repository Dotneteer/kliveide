import { writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import type { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { loadNexFileContents, type NexFileContents } from "@renderer/appIde/DocumentPanels/Next/nexFileLoader";

import { framePng } from "../core/capture";
import { compileNexFile } from "../core/compile-nex";
import { captureFrame, pixelHex, rowRuns, type Frame, type RowRun } from "../core/frame";
import { loadNexDirect, readNextReg, writeNextReg } from "../core/load-nex-direct";
import { ALL_CORES, createCore, readNextRegDirect, type CoreName } from "../core/machines";
import { evaluateProbe, type Probe } from "../cases/probes";

/*
 * The scripting layer of the ZX Spectrum Next test harness: one real machine (TypeScript or WASM
 * core), driven only through what the hardware exposes - Z80 code, ports, NextRegs, memory - and
 * observed the same way, plus the picture and the audio the app would show and play.
 *
 * Rules every method follows (keep them when adding one; see README.md "Adding a method"):
 * - It works on BOTH cores through the public `ZxNextMachine` API, or branches explicitly per core.
 * - It never reaches into a device object to set state the hardware could not set. Reading device
 *   state for an assertion is allowed only when the method says so (`nextRegValue`).
 * - A wait never hangs: every run has a frame limit and fails with the PC and what it waited for.
 */

/** The NextReg a test program writes `$A5` to when its setup is done (`SignalReady()`). */
export const READY_REG = 0x7f;
export const READY_VALUE = 0xa5;

/** 8K MMU pages the NEX format (and `loadCode`) promises: ROM, bank 5, bank 2, bank 0. */
const DEFAULT_MMU = [0xff, 0xff, 10, 11, 4, 5, 0, 1];
const NEXT_MODEL = 4;

export type SessionOptions = {
  /** Enables `audio()`. Both cores read the rate at setup, so it cannot be switched on later. */
  audioSampleRate?: number;
};

export type Registers = {
  a: number; f: number; bc: number; de: number; hl: number;
  af_: number; bc_: number; de_: number; hl_: number;
  ix: number; iy: number; sp: number; pc: number; i: number; r: number;
  iff1: boolean; iff2: boolean; im: number;
};

export type WritableRegisters = Partial<Omit<Registers, "im">>;

export type AudioSample = { left: number; right: number };

export type Program = {
  /** Value of a label or `.equ` symbol. Throws for an unknown name. */
  symbol(name: string): number;
  entry: number;
  /** Code segments as [start address, bytes]. */
  segments: Array<[number, Uint8Array]>;
};

type RunLimit = { maxFrames?: number };

/** The function-key hotkeys `pressHotkey` can press. */
export type Hotkey = "F5" | "F6" | "F8";
const HOTKEY_COMMANDS: Record<Hotkey, string> = {
  F5: "enableExpansionBus",
  F6: "disableExpansionBus",
  F8: "cycleCpuSpeed"
};

export class NextTestSession {
  /** Completed frames since the session was created (or since `hardReset`). */
  frames = 0;
  private lastFrame?: Frame;
  private program?: Program;
  private recording?: AudioSample[];

  private constructor(
    readonly core: CoreName,
    /** Escape hatch. Prefer adding a session method over using it in a test; see README.md. */
    readonly machine: ZxNextMachine,
    private readonly options: SessionOptions
  ) {}

  static async create(core: CoreName, options: SessionOptions = {}): Promise<NextTestSession> {
    return new NextTestSession(core, await createCore(core, { audioSampleRate: options.audioSampleRate, hardReset: true }), options);
  }

  /** Power-on reset of the whole machine. */
  hardReset(): this {
    this.machine.hardReset();
    this.frames = 0;
    this.lastFrame = undefined;
    return this;
  }

  /** Soft reset (the reset button / NextReg `$02` bit 0): what hardware keeps across it, stays. */
  reset(): this {
    this.machine.reset();
    this.lastFrame = undefined;
    return this;
  }

  /**
   * Presses a Next function-key hotkey, as the PS/2 keyboard (and the app's machine menu) does:
   * F5 enables and F6 disables the expansion bus, F8 steps the programmed CPU speed. zxnext.vhd
   * ~6290-6293 gates all three with NextReg `$06` bit 7, so they do nothing while it is clear.
   */
  async pressHotkey(key: Hotkey): Promise<this> {
    await this.machine.executeCustomCommand(HOTKEY_COMMANDS[key]);
    return this;
  }

  // ==========================================================================================
  // Loading code

  /**
   * Assembles Z80N source (Klive syntax) into memory and points PC at it; no NEX file involved.
   *
   * The MMU gets the NEX layout (ROM, bank 5, bank 2, bank 0), interrupts are disabled, SP is $BFF0.
   * `.model Next` is added when missing. PC is `.ent`, else `entry`, else the first segment. The
   * source cannot `#include` relative files (it has no folder) - use `loadProgramFile` for that.
   */
  async loadCode(source: string, options: { entry?: number | string; sp?: number } = {}): Promise<Program> {
    const text = /^\s*\.model\b/im.test(source) ? source : `  .model Next\n${source}`;
    const options_ = new AssemblerOptions();
    options_.currentModel = NEXT_MODEL;
    const output = await new Z80Assembler().compile(text, options_);
    // --- Warnings (e.g. unbanked code above $BFFF under .model Next) do not stop a test program
    const errors = output.errors.filter((e) => !e.isWarning);
    if (errors.length) {
      throw new Error(
        "Assembly failed:\n" + errors.map((e) => `  line ${e.line}:${e.startColumn} ${e.errorCode}: ${e.message}`).join("\n")
      );
    }
    if (output.segments.some((s) => s.bank !== undefined)) {
      throw new Error("loadCode does not place .bank segments; use loadProgramFile with .savenex instead.");
    }
    const segments: Array<[number, Uint8Array]> = output.segments
      .filter((s) => s.emittedCode.length)
      .map((s) => [s.startAddress, Uint8Array.from(s.emittedCode)]);
    if (!segments.length) throw new Error("The source emits no code.");

    DEFAULT_MMU.forEach((page, slot) => writeNextReg(this.machine, 0x50 + slot, page));
    for (const [start, bytes] of segments) this.poke(start, bytes);

    const symbol = (name: string) => {
      const s = output.getSymbol(name);
      if (!s?.value) throw new Error(`Unknown symbol '${name}'`);
      return s.value.value as number;
    };
    const entry =
      typeof options.entry === "string" ? symbol(options.entry) : (options.entry ?? output.entryAddress ?? segments[0][0]);
    this.program = { symbol, entry, segments };
    this.machine.sp = options.sp ?? 0xbff0;
    this.machine.pc = entry;
    this.machine.iff1 = this.machine.iff2 = false;
    return this.program;
  }

  /**
   * Loads a `.nex` file, or compiles an `.asm` file with `.savenex` pragmas first, with the harness's
   * direct NEX loader (banks, MMU, border, SP, PC). No NextZXOS: see README.md "Direct load".
   */
  async loadProgramFile(path: string): Promise<NexFileContents> {
    let contents: NexFileContents;
    if (path.toLowerCase().endsWith(".nex")) {
      const parsed = loadNexFileContents(new Uint8Array(await readFile(path)));
      if (parsed.error || !parsed.fileInfo) throw new Error(`${path}: ${parsed.error}`);
      contents = parsed.fileInfo;
    } else {
      contents = (await compileNexFile(path)).contents;
    }
    loadNexDirect(this.machine, contents);
    this.program = undefined;
    return contents;
  }

  /** A label of the last `loadCode` program. */
  symbol(name: string): number {
    if (!this.program) throw new Error("symbol() needs a program loaded with loadCode()");
    return this.program.symbol(name);
  }

  private address(where: number | string): number {
    return typeof where === "string" ? this.symbol(where) : where & 0xffff;
  }

  // ==========================================================================================
  // Running

  /**
   * Runs `count` whole frames the way the emulator panel does (execute, then show). After a mid-frame
   * stop (`runTo`, `step`) the first one finishes that frame.
   */
  runFrames(count = 1): this {
    for (let n = 0; n < count; n++) this.runOneFrame(n === count - 1);
    return this;
  }

  /** Runs whole frames until `done()` is true (checked before each frame). */
  runUntil(done: (s: NextTestSession) => boolean, what: string, { maxFrames = 500 }: RunLimit = {}): this {
    const limit = this.frames + maxFrames;
    while (!done(this)) {
      if (this.frames >= limit) throw new Error(`Timed out after ${maxFrames} frames waiting for ${what} (PC=${hex(this.machine.pc, 4)})`);
      this.runOneFrame(true);
    }
    return this;
  }

  /** Runs until the program wrote `$A5` to NextReg `$7F` (the `SignalReady()` macro). */
  runUntilReady(limit: RunLimit = { maxFrames: 50 }): this {
    return this.runUntil((s) => s.nextRegValue(READY_REG) === READY_VALUE, "the ready marker ($A5 in NextReg $7F)", limit);
  }

  /** Runs until PC reaches the address or label, stopping mid-frame before that instruction executes. */
  runTo(where: number | string, { maxFrames = 100 }: RunLimit = {}): this {
    const target = this.address(where);
    const ctx = this.machine.executionContext;
    ctx.frameTerminationMode = FrameTerminationMode.UntilExecutionPoint;
    ctx.terminationPoint = target;
    const limit = this.frames + maxFrames;
    try {
      while (true) {
        if (this.frames >= limit) throw new Error(`Timed out after ${maxFrames} frames running to ${hex(target, 4)} (PC=${hex(this.machine.pc, 4)})`);
        if (this.execute(true) === FrameTerminationMode.UntilExecutionPoint) return this;
      }
    } finally {
      ctx.frameTerminationMode = FrameTerminationMode.Normal;
      ctx.terminationPoint = undefined;
    }
  }

  /** Executes `count` Z80 instructions. */
  step(count = 1): this {
    const ctx = this.machine.executionContext;
    const savedSupport = ctx.debugSupport;
    ctx.debugSupport ??= new DebugSupport(); // --- the TypeScript core answers StepInto only with one
    ctx.debugStepMode = DebugStepMode.StepInto;
    try {
      for (let i = 0; i < count; i++) this.execute(true);
    } finally {
      ctx.debugStepMode = DebugStepMode.NoDebug;
      ctx.debugSupport = savedSupport;
    }
    return this;
  }

  /**
   * Calls a routine: pushes a return address, jumps, and runs until it returns there. The return
   * address is the current PC unless given; the routine must not execute that address itself.
   */
  call(where: number | string, options: { returnTo?: number } & RunLimit = {}): this {
    const ret = options.returnTo ?? this.machine.pc;
    const sp = (this.machine.sp - 2) & 0xffff;
    this.pokeWord(sp, ret);
    this.machine.sp = sp;
    this.machine.pc = this.address(where);
    return this.runTo(ret, options);
  }

  /** Executes until the current frame completes (a mid-frame stop finishes its frame). */
  private runOneFrame(capture: boolean): void {
    const start = this.frames;
    while (this.frames === start) this.execute(capture);
  }

  private execute(capture: boolean): FrameTerminationMode {
    const termination = this.machine.executeMachineFrame();
    if (this.machine.frameJustCompleted && termination === FrameTerminationMode.Normal && capture) {
      this.lastFrame = captureFrame(this.machine);
    }
    this.afterExecute();
    this.failOnFrameCommand();
    return termination;
  }

  private afterExecute(): void {
    if (!this.machine.frameJustCompleted) return;
    this.frames++;
    if (this.recording) for (const s of this.machine.getAudioSamples()) this.recording.push({ left: s.left, right: s.right });
  }

  private failOnFrameCommand(): void {
    if (this.machine.getFrameCommand()) {
      throw new Error(`The machine issued a frame command (${JSON.stringify(this.machine.getFrameCommand())}); use the browser tier for SD card access.`);
    }
  }

  // ==========================================================================================
  // Memory, ports, NextRegs, CPU

  /** Reads through the current paging, like the CPU. */
  peek(address: number): number {
    return this.machine.doReadMemory(address & 0xffff);
  }
  peekWord(address: number): number {
    return this.peek(address) | (this.peek(address + 1) << 8);
  }
  peekBytes(address: number, length: number): Uint8Array {
    return Uint8Array.from({ length }, (_, i) => this.peek(address + i));
  }

  poke(address: number, value: number | ArrayLike<number>): this {
    if (typeof value === "number") this.machine.doWriteMemory(address & 0xffff, value & 0xff);
    else for (let i = 0; i < value.length; i++) this.machine.doWriteMemory((address + i) & 0xffff, value[i] & 0xff);
    return this;
  }
  pokeWord(address: number, value: number): this {
    return this.poke(address, [value & 0xff, (value >> 8) & 0xff]);
  }

  /** An OUT, with every side effect the hardware has. */
  out(port: number, value: number): this {
    this.machine.doWritePort(port & 0xffff, value & 0xff);
    return this;
  }
  /** An IN, with every side effect the hardware has (e.g. reading $303B clears sprite status). */
  in(port: number): number {
    return this.machine.doReadPort(port & 0xffff);
  }

  /** Writes a NextReg through $243B/$253B, as Z80 code would. */
  setNextReg(reg: number, value: number): this {
    writeNextReg(this.machine, reg, value);
    return this;
  }
  /** Reads a NextReg through $243B/$253B (changes the selected register, like the hardware). */
  readNextReg(reg: number): number {
    return readNextReg(this.machine, reg);
  }
  /** The stored NextReg value, with no port side effects. For assertions and wait conditions. */
  nextRegValue(reg: number): number {
    return readNextRegDirect(this.machine, reg);
  }

  registers(): Registers {
    const m = this.machine;
    return {
      a: m.a, f: m.f, bc: m.bc, de: m.de, hl: m.hl, af_: m.af_, bc_: m.bc_, de_: m.de_, hl_: m.hl_,
      ix: m.ix, iy: m.iy, sp: m.sp, pc: m.pc, i: m.i, r: m.r, iff1: m.iff1, iff2: m.iff2, im: m.interruptMode
    };
  }
  setRegisters(values: WritableRegisters): this {
    const m = this.machine as unknown as Record<string, number | boolean>;
    for (const [k, v] of Object.entries(values)) if (v !== undefined) m[k] = v;
    return this;
  }

  /** Total CPU tacts (T-states at the machine's base clock) since reset. */
  get tacts(): number {
    return this.machine.tacts;
  }

  // ==========================================================================================
  // Screen

  /**
   * The last displayed frame: 720x288 RGBA, captured exactly when the app would paint it. Updated by
   * every `runFrames`/`runUntil*` and by `runTo`/`step` when they complete a frame.
   */
  screen(): Frame {
    if (!this.lastFrame) throw new Error("No frame displayed yet: run at least one whole frame first.");
    return this.lastFrame;
  }
  /** `#RRGGBB` of a buffer pixel in the last displayed frame. */
  pixel(x: number, y: number): string {
    return pixelHex(this.screen(), x, y);
  }
  rowRuns(y: number): RowRun[] {
    return rowRuns(this.screen(), y);
  }
  /** Throws with the probe's detail (first wrong pixel, colours seen) unless it passes. */
  expectProbe(probe: Probe): this {
    const r = evaluateProbe(probe, this.screen());
    if (!r.pass) throw new Error(`Probe ${probe.name ?? probe.kind} failed on ${this.core}: ${r.detail}`);
    return this;
  }
  async saveScreenPng(path: string): Promise<void> {
    writeFileSync(path, await framePng(this.screen()));
  }

  // ==========================================================================================
  // Audio

  /** Starts collecting the mixed audio samples of every completed frame. */
  startAudio(): this {
    if (!this.options.audioSampleRate) throw new Error("Create the session with { audioSampleRate } to record audio.");
    this.recording = [];
    return this;
  }
  /** The samples recorded since `startAudio` (left/right, the mixer's output range). */
  audio(): AudioSample[] {
    if (!this.recording) throw new Error("Call startAudio() first.");
    return this.recording;
  }
}

/** Creates a session on one core. */
export function createSession(core: CoreName, options?: SessionOptions): Promise<NextTestSession> {
  return NextTestSession.create(core, options);
}

/**
 * Runs the same script on each core and returns the results by core - for parity assertions such as
 * `expect(r.wasm).toEqual(r.ts)`.
 */
export async function onEachCore<T>(
  script: (s: NextTestSession) => Promise<T> | T,
  options: SessionOptions & { cores?: CoreName[] } = {}
): Promise<Record<CoreName, T>> {
  const out = {} as Record<CoreName, T>;
  for (const core of options.cores ?? ALL_CORES) out[core] = await script(await createSession(core, options));
  return out;
}

export function hex(value: number, digits = 2): string {
  return "$" + value.toString(16).toUpperCase().padStart(digits, "0");
}
