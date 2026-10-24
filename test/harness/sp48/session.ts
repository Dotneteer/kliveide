import type { HistoryRecord } from "@common/history/historyRecord";
import type { ExecutionHistoryInfo } from "@common/history/historyTypes";
import { historyFromOf, historyInfoOf, historyOf } from "../historySupport";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { connectConditionSupport } from "@emu/machines/conditionStore";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { beginSourceStep, type SourceDebugIndex, type SourceStep, type SourceStepKind } from "@emu/machines/SourceStepDecision";
import { SP48_MAIN_ENTRY } from "@emu/machines/ZxSpectrumBase";
import { ZxSpectrum48WasmV2Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine";
import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";
import { FAST_LOAD } from "@emu/machines/machine-props";
import { MEDIA_TAPE } from "@common/structs/project-const";
import type { TapeDataBlock } from "@common/structs/TapeDataBlock";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { parseSpectrumSnapshot } from "@common/spectrum/snapshot/parseSpectrumSnapshot";
import { writeSpectrumSnapshot } from "@common/spectrum/snapshot/writeSpectrumSnapshot";
import type { SnapshotWriteResult } from "@common/spectrum/snapshot/snapshotBytes";
import type { SpectrumSnapshot, SpectrumSnapshotFormat } from "@common/spectrum/snapshot/spectrumSnapshot";
import type { RzxPlayer, RzxPlayerOptions } from "@emu/machines/zxSpectrum/rzx/RzxPlayer";
import type { RzxRecorder, RzxRecorderOptions } from "@emu/machines/zxSpectrum/rzx/RzxRecorder";
import type { RzxStop } from "@emu/machines/zxSpectrum/rzx/rzxSession";
import * as rzx from "../spectrumRzx";
import { tapeBlocksOf } from "@common/headless/tapeBlocks";
import { screenImageOf } from "@common/headless/screenImage";
import { encodePng } from "@common/imaging/png";
import { sp48TapeLoadFlow } from "@emu/machines/tapeLoadFlows";
import type { Interface1DriveState, Interface1State, Interface1Support } from "@emu/machines/zxSpectrum/if1/if1CoreBridge";
import { connectInterface1, insertCartridge, interface1Of, type HarnessCartridge } from "../interface1Support";

import { buildSp48Wasm, productionOutput } from "../../../scripts/build-sp48-wasm.cjs";

/** The real 48K BASIC ROM the app ships (`src/public/roms/sp48.rom`). */
const ROM_PATH = join(__dirname, "../../../src/public/roms/sp48.rom");

/** First byte of the ROM character set (character 32, space). */
const ROM_CHARSET = 0x3d00;

/** An SD card for the DivMMC: 512-byte sectors */
export type HarnessSdCard = {
  readonly sectorCount: number;
  readSector(sector: number): Uint8Array;
  writeSector(sector: number, data: Uint8Array): void;
};

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

const ROM_DIR_48 = join(__dirname, "../../../src/public/roms");

class HarnessSp48Machine extends ZxSpectrum48WasmV2Machine {
  constructor(private readonly rom: Uint8Array) {
    super(undefined, {}, {
      artifactName: "harness-sp48-machine-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
  }

  protected override async loadRomFromResource(romName = ""): Promise<Uint8Array> {
    // --- The Interface 1's shipped ROM (`if1-2`) is a file of its own
    if (romName.startsWith("if1")) return new Uint8Array(readFileSync(join(ROM_DIR_48, `${romName}.rom`)));
    return this.rom;
  }
}

let wasmBuilt = false;

/**
 * Creates a ZX Spectrum 48K with the real ROM (or the one given), ready to boot. Builds the WASM core first, once per
 * test process (the same build the 48K machine tests use).
 */
export async function createSp48Session({ rom }: { rom?: Uint8Array } = {}): Promise<Sp48TestSession> {
  // --- Once per test process: the build runs clang, which is most of a session's start-up cost
  if (!wasmBuilt) {
    buildSp48Wasm();
    wasmBuilt = true;
  }
  // --- `rom`: a 16K ROM in place of the real one (a test program that is a ROM, Time to First INT)
  const machine = new HarnessSp48Machine(rom ?? new Uint8Array(readFileSync(ROM_PATH)));
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
      // --- getSymbol does not follow dotted module names: walk the nested modules for "core.X"; a
      // --- dotted name of the program's own (`_a.data`) is a symbol as it is
      const parts = name.split(".");
      let module: Pick<Sp48Program["output"], "getSymbol" | "getNestedModule"> | undefined = output;
      for (const part of parts.slice(0, -1)) module = module?.getNestedModule(part);
      const s = module?.getSymbol(parts[parts.length - 1]) ?? output.getSymbol(name);
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
    this.completeInstruction();
    const ret = options.returnTo ?? this.machine.pc;
    const sp = (this.machine.sp - 2) & 0xffff;
    this.pokeWord(sp, ret);
    this.machine.sp = sp;
    this.machine.pc = this.address(where);
    return this.runTo(ret, options);
  }

  /**
   * Finishes an instruction a frame left half-way: the core runs a CB/ED/DD/FD prefix as a cycle of
   * its own, so a frame can end between a prefix and its opcode. Moving PC then would run the new
   * code's first byte as the pending prefix's opcode.
   */
  completeInstruction(): this {
    const exports = this.machine.wasmV2Runtime?.exports;
    for (let i = 0; i < 4 && exports && exports.sp48GetCpuPrefix() !== 0; i++) this.step(1);
    return this;
  }

  /** T-states since the start of the current frame */
  frameTact(): number {
    return this.machine.wasmV2Runtime!.exports.sp48GetCurrentFrameTact();
  }

  /**
   * Runs the rest of the current frame instruction by instruction, as the debugger does, so the
   * picture the frame has drawn so far is kept and completed.
   */
  finishFrame(): this {
    const ctx = this.machine.executionContext;
    const start = this.frames;
    ctx.debugStepMode = DebugStepMode.StopAtBreakpoint;
    try {
      while (this.frames === start) this.execute();
    } finally {
      ctx.debugStepMode = DebugStepMode.NoDebug;
    }
    return this;
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
    // --- Conditions read this machine and compile against its facts, as in the IDE's emulator
    connectConditionSupport(debugSupport, this.machine);
    this.machine.executionContext.debugSupport = debugSupport;
    return debugSupport;
  }

  /**
   * Starts a routine like `call` but in debug mode, and runs until a breakpoint stops the machine.
   * Returns the PC it stopped at. Throws if the routine returns first.
   */
  callToBreakpoint(where: number | string, options: { returnTo?: number } & RunLimit = {}): number {
    this.completeInstruction();
    const ret = options.returnTo ?? this.machine.pc;
    const sp = (this.machine.sp - 2) & 0xffff;
    this.pokeWord(sp, ret);
    this.machine.sp = sp;
    this.machine.pc = this.address(where);
    return this.continueToBreakpoint({ ...options, returnTo: ret });
  }

  /**
   * Continues in debug mode until a breakpoint stops the machine; returns the PC. `onFrame` runs
   * after every executed frame - where the emulator's controller drains the logpoint queue.
   */
  continueToBreakpoint(
    options: { returnTo?: number; onFrame?: () => void } & RunLimit = {}
  ): number {
    const { maxFrames = 100, returnTo, onFrame } = options;
    const ctx = this.machine.executionContext;
    if (!ctx.debugSupport) throw new Error("Call attachDebugSupport() first.");
    ctx.debugStepMode = DebugStepMode.StopAtBreakpoint;
    const limit = this.frames + maxFrames;
    try {
      while (true) {
        if (this.frames >= limit) throw new Error(`No breakpoint hit in ${maxFrames} frames (PC=${hex4(this.machine.pc)})`);
        const termination = this.execute();
        onFrame?.();
        if (termination === FrameTerminationMode.DebugEvent) return this.machine.pc;
        if (returnTo !== undefined && this.machine.pc === returnTo) {
          throw new Error(`The routine returned to ${hex4(returnTo)} without hitting a breakpoint.`);
        }
      }
    } finally {
      ctx.debugStepMode = DebugStepMode.NoDebug;
    }
  }

  /**
   * A source-level step (`SourceStepDecision.ts`) of a compiled program, as the IDE's Step
   * Into/Over/Out run it: starts the step at the current state and runs in debug mode until it
   * stops (a statement entry, a return point, or a breakpoint, which always wins). Returns the
   * step, with `stoppedAt` saying how it ended; `undefined` when the program returned to
   * `returnTo` first.
   */
  sourceStep(
    index: SourceDebugIndex,
    kind: SourceStepKind,
    options: { targetFrame?: number; targetCallable?: number; returnTo?: number; stopInInterrupts?: boolean } & RunLimit = {}
  ): SourceStep | undefined {
    const { maxFrames = 100, returnTo, ...stepOptions } = options;
    const ctx = this.machine.executionContext;
    const debugSupport = ctx.debugSupport;
    if (!debugSupport) throw new Error("Call attachDebugSupport() first.");
    const m = this.machine;
    const view = { pc: m.pc, sp: m.sp, ix: m.ix, readWord: (a: number) => this.peekWord(a), interruptDepth: this.interruptDepth() };
    const step = beginSourceStep(index, view, kind, {
      ...stepOptions,
      previous: debugSupport.sourceStep
    });
    debugSupport.sourceStep = step;
    ctx.debugStepMode = DebugStepMode.SourceStep;
    const limit = this.frames + maxFrames;
    try {
      while (true) {
        if (this.frames >= limit) throw new Error(`The source step did not stop in ${maxFrames} frames (PC=${hex4(this.machine.pc)})`);
        if (this.execute() === FrameTerminationMode.DebugEvent) return step;
        if (returnTo !== undefined && this.machine.pc === returnTo) return undefined;
      }
    } finally {
      ctx.debugStepMode = DebugStepMode.NoDebug;
    }
  }

  /** How many interrupt handlers are running (the core's shadow stack, plan §10.2.7). */
  interruptDepth(): number {
    return this.machine.wasmV2Runtime?.exports.sp48GetInterruptDepth() ?? 0;
  }

  // ==========================================================================================
  // Keyboard

  /**
   * Holds keys down: `SpectrumKeyCode` names (`"A"`, `"N1"`, `"Enter"`, `"Space"`, `"CShift"`,
   * `"SShift"`, ...). The machine reads the matrix at the next frame.
   */
  keyDown(...keys: string[]): this {
    for (const key of keys) this.machine.setKeyStatus(keyCode(key), true);
    return this;
  }

  keyUp(...keys: string[]): this {
    for (const key of keys) this.machine.setKeyStatus(keyCode(key), false);
    return this;
  }

  /**
   * Types at the keyboard as a user does: each chord (keys pressed together, e.g. `["CShift", "SShift"]`
   * for extended mode) is held for `hold` frames and released for `gap` frames, short of the ROM's
   * auto-repeat delay. The ROM (or a program reading the keyboard) must be running.
   */
  typeKeys(chords: string[][], { hold = 3, gap = 3 }: { hold?: number; gap?: number } = {}): this {
    for (const chord of chords) {
      this.keyDown(...chord).runFrames(hold);
      this.keyUp(...chord).runFrames(gap);
    }
    return this;
  }

  /**
   * Types a code-injection flow's `QueueKey` steps - the keystrokes the IDE queues for a flow such
   * as `sp48TapeLoadFlow` - so a test checks the very keys the IDE sends. Other steps are skipped:
   * the session is already where the flow's `ReachExecPoint` would take it.
   */
  typeFlowKeys(flow: CodeInjectionFlow, options?: { hold?: number; gap?: number }): this {
    const names = Object.entries(SpectrumKeyCode);
    const nameOf = (code: number) => names.find(([, value]) => value === code)![0];
    const chords = flow.flatMap((step) =>
      step.type === "QueueKey"
        ? [[step.secondary, step.ternary, step.primary].filter((k) => k !== undefined).map((k) => nameOf(k!))]
        : []
    );
    return this.typeKeys(chords, options);
  }

  // ==========================================================================================
  // Tape

  /**
   * Puts a tape in the deck, as the IDE does when it inserts one: the blocks the emulator plays
   * (`MainToEmuProcessor.setTapeFile` makes them from a `.tap` or `.tzx`), with fast load on unless
   * asked otherwise. The ROM's LOAD then reads them.
   */
  insertTape(blocks: TapeDataBlock[], { fastLoad = true }: { fastLoad?: boolean } = {}): this {
    this.machine.setMachineProperty(FAST_LOAD, fastLoad);
    this.machine.setMachineProperty(MEDIA_TAPE, blocks);
    return this;
  }

  /**
   * Loads a `.tap` / `.tzx` file the way a user does: boots to BASIC if the machine has not booted
   * yet, inserts the tape (fast load by default), types `LOAD ""` and ENTER, and returns with the
   * ROM loading it. Run frames (or `runUntilStable`) afterwards for the program to load and start.
   */
  loadTap(path: string, { fastLoad = true }: { fastLoad?: boolean } = {}): this {
    const parsed = tapeBlocksOf(new Uint8Array(readFileSync(path)));
    if ("error" in parsed) throw new Error(`${path} is not a tape: ${parsed.error}`);
    if (this.frames === 0) this.bootToBasic();
    this.insertTape(parsed.blocks, { fastLoad });
    return this.typeFlowKeys(sp48TapeLoadFlow(), { hold: 5, gap: 10 });
  }

  // ==========================================================================================
  // Memory and screen

  /** The whole picture, border included, as RGBA bytes (what the emulator panel draws) */
  screenImage(): { width: number; height: number; pixels: Uint8Array } {
    return screenImageOf(this.machine);
  }

  /** The whole picture as a PNG file */
  screenPng(): Buffer {
    const { width, height, pixels } = this.screenImage();
    return encodePng(pixels, width, height);
  }

  /** A SHA-256 of the whole picture's pixels, for comparing pictures */
  screenHash(): string {
    return createHash("sha256").update(this.screenImage().pixels).digest("hex");
  }

  /**
   * Runs frames until the picture has not changed for `stableFrames` frames in a row (a test
   * program that has finished drawing its result), and returns the frames run. Throws after
   * `maxFrames`. A picture that keeps changing every frame (a flashing cursor counts) never settles:
   * pass `period` to compare frames that many apart instead.
   */
  runUntilStable({ stableFrames = 50, maxFrames = 3000, period = 1 }: { stableFrames?: number; maxFrames?: number; period?: number } = {}): number {
    const hashes: string[] = [];
    let same = 0;
    for (let i = 1; i <= maxFrames; i++) {
      this.runFrames(1);
      hashes.push(this.screenHash());
      if (hashes.length > period) {
        same = hashes[hashes.length - 1] === hashes[hashes.length - 1 - period] ? same + 1 : 0;
        hashes.shift();
      }
      if (same >= stableFrames) return i;
    }
    throw new Error(`The picture did not settle in ${maxFrames} frames.`);
  }

  peek(address: number): number {
    return this.machine.doReadMemory(address & 0xffff);
  }

  /**
   * Loads a `.sna` / `.z80` / `.szx` snapshot into the machine, as the emulator does (minus the
   * controller): parse, then `loadSnapshotState`. Returns the frame tact the machine stands at.
   */
  loadSnapshot(name: string, bytes: Uint8Array): number {
    return this.machine.loadSnapshotState(parseSpectrumSnapshot(name, bytes));
  }

  /** Captures the machine's state as a snapshot model, as saving does (the machine is unchanged) */
  captureSnapshot(): SpectrumSnapshot {
    return this.machine.captureSnapshotState();
  }

  /**
   * Saves the machine as a `.sna` / `.z80` / `.szx` file, as the emulator does (minus the
   * controller): capture, then write. Throws when the format refuses the state.
   */
  saveSnapshot(format: SpectrumSnapshotFormat): SnapshotWriteResult {
    return writeSpectrumSnapshot(this.machine.captureSnapshotState(), format);
  }

  // ==========================================================================================
  // RZX (`.plans/RZX_PLAN.md`)

  /**
   * Starts recording an RZX file at the machine's current state, as the emulator does: a `.szx`
   * snapshot of it, then every IN and every frame's fetch count. Returns the recorder.
   */
  startRzxRecording(options?: RzxRecorderOptions): RzxRecorder {
    return rzx.startRzxRecording(this.machine, options);
  }

  /** Stops the recording and returns the finalised RZX file */
  stopRzxRecording(): Uint8Array {
    return rzx.stopRzxRecording(this.machine);
  }

  /** Parses an RZX file, loads its (first or chosen) segment's snapshot and starts playing it */
  playRzx(bytes: Uint8Array, options?: RzxPlayerOptions): RzxPlayer {
    return rzx.playRzx(this.machine, bytes, options);
  }

  /**
   * Runs frames until the RZX session stops (the recording ended, desynced, ...) and returns why.
   * `onFrame` runs after every completed picture frame.
   */
  runRzx(options: RunLimit & { onFrame?: () => void } = {}): RzxStop {
    return rzx.runRzx(this.machine, () => this.frames, () => this.execute(), options);
  }

  /** The RZX session's state */
  get rzxStatus(): rzx.RzxHarnessStatus {
    return rzx.rzxStatus(this.machine);
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
    while (this.frames === start) {
      this.execute();
      rzx.assertRzxRunning(this.machine);
    }
  }

  private execute(): FrameTerminationMode {
    const termination = this.machine.executeMachineFrame();
    if (this.machine.frameJustCompleted) this.frames++;
    this.serveSdCard();
    return termination;
  }

  // ==========================================================================================
  // The DivMMC (`.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md` C4/C6)

  private sdCard?: HarnessSdCard;
  private if1?: Interface1Support;

  private get interface1Support(): Interface1Support {
    this.if1 ??= interface1Of("sp48", this.machine);
    return this.if1;
  }

  /** Connects the Interface 1 with a ROM (the shipped v2 by default); no reset (see interface1Support.ts) */
  connectInterface1(rom?: Uint8Array): this {
    connectInterface1(this.interface1Support, rom);
    return this;
  }

  /** Puts an .mdr (or `{ blank: slots }`) into drive 0-7; `writeProtected` overrides its last byte */
  insertCartridge(drive: number, cartridge: HarnessCartridge, writeProtected?: boolean): this {
    insertCartridge(this.interface1Support, drive, cartridge, writeProtected);
    return this;
  }

  /** The interface's state, with every drive's */
  interface1(): Interface1State & { drives: Interface1DriveState[] } {
    const support = this.interface1Support;
    return { ...support.state(), drives: Array.from({ length: 8 }, (_, d) => support.drive(d)) };
  }

  /** Drive `drive`'s cartridge as an .mdr, as the guest left it */
  cartridge(drive: number): Uint8Array | undefined {
    return this.interface1Support.cartridge(drive);
  }

  /** The bridge itself, for what the methods above do not cover (slot signal, dirty slots) */
  get interface1Bridge(): Interface1Support {
    return this.interface1Support;
  }

  /** The CPU's T-state counter, as the host sees it (continuous across the core's rebases) */
  tacts(): number {
    return (this.machine.wasmV2Runtime!.exports as unknown as { sp48GetTacts(): number }).sp48GetTacts() >>> 0;
  }

  /** The machine's reset (the RESET button: memory kept, every device reset) */
  reset(): this {
    (this.machine.wasmV2Runtime!.exports as unknown as { sp48Reset(): void }).sp48Reset();
    this.machine.pc = 0;
    return this;
  }

  /**
   * Test hook: as if `amount` T-states passed with nothing happening - every absolute tact point the
   * core keeps moves forward, so a few calls reach the counter's rebase (`sp48TestAdvanceTacts`)
   */
  testAdvanceTacts(amount: number): this {
    (this.machine.wasmV2Runtime!.exports as unknown as { sp48TestAdvanceTacts(n: number): void }).sp48TestAdvanceTacts(amount >>> 0);
    return this;
  }

  /** A Klive machine state, as the IDE saves one */
  saveState(): ReturnType<HarnessSp48Machine["saveMachineState"]> {
    return this.machine.saveMachineState();
  }

  /** Restores a state `saveState` returned */
  loadState(parts: ReturnType<HarnessSp48Machine["saveMachineState"]>): this {
    this.machine.loadMachineState(parts);
    return this;
  }

  /**
   * Connects the DivMMC with an 8K ROM and resets the machine, which boots through it. `sdCard`: the
   * card's sectors, served here as the IDE's controller serves them (none: an empty slot).
   */
  connectDivMmc(rom: Uint8Array, sdCard?: HarnessSdCard): this {
    const x = this.machine.wasmV2Runtime!.exports as unknown as Record<string, (...args: number[]) => number>;
    this.machine.divMmc.uploadRom(rom);
    x.sp48DivMmcSetPresent(1);
    x.sp48SetSdCardInfo(sdCard ? sdCard.sectorCount : 0);
    this.sdCard = sdCard;
    x.sp48Reset();
    this.machine.pc = 0;
    return this;
  }

  /** The DivMMC's card waits for a sector: answers it at once from `sdCard` */
  private serveSdCard(): void {
    const divMmc = this.machine.divMmc;
    const command = divMmc.getFrameCommand();
    if (!command) return;
    divMmc.setFrameCommand(undefined);
    if (command.command === "divmmc-sd-read") {
      divMmc.answerRead(this.sdCard && command.sector < this.sdCard.sectorCount ? this.sdCard.readSector(command.sector) : undefined);
    } else {
      let ok = false;
      if (this.sdCard && command.sector < this.sdCard.sectorCount) {
        this.sdCard.writeSector(command.sector, command.data);
        ok = true;
      }
      divMmc.answerWrite(ok);
    }
  }

  // ==========================================================================================
  // Execution history (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md`): the core's recorder, as the
  // IDE reads it through `IExecutionHistorySource`

  /** Turns the execution-history recorder on or off, as a debug session does */
  recordHistory(on = true): this {
    this.machine.setHistoryEnabled(on);
    return this;
  }

  /** Empties the history ring, as the controller does on a start from Stopped or a restore */
  clearHistory(): this {
    this.machine.clearHistory();
    return this;
  }

  /** What the ring holds: capacity, count, newest and oldest sequence, generation, enabled */
  historyInfo(): ExecutionHistoryInfo {
    return historyInfoOf(this.machine);
  }

  /** The newest `count` records (all held when omitted), oldest first, decoded */
  history(count?: number): HistoryRecord[] {
    return historyOf(this.machine, count);
  }

  /** Records from `fromSequence` on, with the reader's `gone` flag */
  historyFrom(fromSequence: number, count: number): { records: HistoryRecord[]; gone: boolean } {
    return historyFromOf(this.machine, fromSequence, count);
  }
}

function hex4(value: number): string {
  return "$" + (value & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function keyCode(key: string): number {
  const code = SpectrumKeyCode[key];
  if (code === undefined) throw new Error(`Unknown 48K key '${key}'`);
  return code;
}
