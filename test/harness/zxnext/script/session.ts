import { writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import type { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import { toBcd } from "@emu/machines/zxNext/I2cDevice";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { loadNexFileContents, type NexFileContents } from "@renderer/appIde/DocumentPanels/Next/nexFileLoader";

import { framePng } from "../core/capture";
import { compileNexFile } from "../core/compile-nex";
import { captureFrame, pixelHex, rowRuns, type Frame, type RowRun } from "../core/frame";
import { loadNexDirect, readNextReg, writeNextReg } from "../core/load-nex-direct";
import { ALL_CORES, createCore, readNextRegDirect, type CoreName } from "../core/machines";
import { evaluateProbe, type Probe } from "../cases/probes";
import { InMemorySdMessenger, MemorySdCard, type SdCardBacking } from "./sd-card";
import { uartPeerOf, type UartFrame, type UartIndex } from "./uart-peer";
import { keyCode, type NextKey } from "./keys";
import { joyBits, setJoystickState, type JoyButton, type JoySide } from "./joystick";
import { mouseButtonBits, sendMousePacket, type MouseEvent } from "./mouse";

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

/** A DS1307 time: `year` is 0-99 (or a full year), `day` the day of week 1-7, hours 0-23. */
export type RtcTime = { year: number; month: number; date: number; day: number; hours: number; minutes: number; seconds: number };

export type Program = {
  /** Value of a label or `.equ` symbol. Throws for an unknown name. */
  symbol(name: string): number;
  entry: number;
  /** Code segments as [start address, bytes]. */
  segments: Array<[number, Uint8Array]>;
};

type RunLimit = { maxFrames?: number };

/** The function-key hotkeys `pressHotkey` can press. */
export type Hotkey = "F5" | "F6" | "F8" | "F9" | "F10";
const HOTKEY_COMMANDS: Record<Hotkey, string> = {
  F5: "enableExpansionBus",
  F6: "disableExpansionBus",
  F8: "cycleCpuSpeed",
  F9: "multifaceNmi",
  F10: "divmmcNmi"
};

export class NextTestSession {
  /** Completed frames since the session was created (or since `hardReset`). */
  frames = 0;
  private lastFrame?: Frame;
  private program?: Program;
  private recording?: AudioSample[];
  private sd?: InMemorySdMessenger;
  private mouseButtons = 0;

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
   *
   * F9 and F10 are the M1 (Multiface) and DRIVE (DivMMC) NMI buttons (~6294-6295, `hotkey_m1`,
   * `hotkey_drive`): one-cycle pulses into the NMI arbiter, gated there by NextReg `$06` bits 3 / 4
   * (~2046-2047). F10 also needs the DivMMC port enabled (`port_divmmc_io_en`, `$83` bit 0).
   */
  async pressHotkey(key: Hotkey): Promise<this> {
    await this.machine.executeCustomCommand(HOTKEY_COMMANDS[key]);
    return this;
  }

  // ==========================================================================================
  // SD card

  /**
   * Puts an SD card in slot 0: a flat image (a whole number of 512-byte sectors) or any `SdCardBacking`. The machines read and write
   * sectors through frame commands answered by the main process in the app; here the async run methods
   * (`runFramesAsync`, `runUntilReadyAsync`) answer them from this image with the machine's own
   * `processFrameCommand`. Writes land in `sdImage`. The sync run methods still fail on a frame command.
   */
  attachSdCard(card: Uint8Array | SdCardBacking): this {
    this.sd = new InMemorySdMessenger(card instanceof Uint8Array ? new MemorySdCard(card) : card);
    return this;
  }

  /** The attached flat image, with the machine's writes in it. */
  get sdImage(): Uint8Array {
    if (!(this.sd?.card instanceof MemorySdCard)) throw new Error("No flat SD image attached (attachSdCard with a Uint8Array)");
    return this.sd.card.image;
  }

  /** Main-API calls the machine made to the attached card, by method (`readSdCardSector`, ...). */
  get sdCalls(): Record<string, number> {
    if (!this.sd) throw new Error("No SD card attached (attachSdCard)");
    return { ...this.sd.calls };
  }

  /** `runFrames`, answering the machine's SD frame commands from the attached image. */
  async runFramesAsync(count = 1): Promise<this> {
    for (let n = 0; n < count; n++) {
      const start = this.frames;
      while (this.frames === start) await this.executeAsync(n === count - 1);
    }
    return this;
  }

  /** `runUntilReady`, answering the machine's SD frame commands from the attached image. */
  async runUntilReadyAsync({ maxFrames = 50 }: RunLimit = {}): Promise<this> {
    const limit = this.frames + maxFrames;
    while (this.nextRegValue(READY_REG) !== READY_VALUE) {
      if (this.frames >= limit) {
        throw new Error(`Timed out after ${maxFrames} frames waiting for the ready marker ($A5 in NextReg $7F) (PC=${hex(this.machine.pc, 4)})`);
      }
      await this.executeAsync(true);
    }
    return this;
  }

  private async executeAsync(capture: boolean): Promise<FrameTerminationMode> {
    const termination = this.execute(capture, true);
    if (this.machine.getFrameCommand()) {
      if (!this.sd) this.failOnFrameCommand();
      await this.machine.processFrameCommand(this.sd!);
      this.machine.setFrameCommand(null);
    }
    return termination;
  }

  // ==========================================================================================
  // UART peer: the device on the other end of UART 0 (ESP) / UART 1 (Pi)

  /**
   * The peer sends frames on the Next's RX line: bytes, or `{ value, error: "parity" | "framing" }` for a
   * frame with a wrong parity bit (only matters with parity on) or a low stop bit. They go back to back
   * after anything already queued, at the Next's own baud rate and framing, sampled at each frame's
   * start. The peer honours the Next's RTR: with flow control on it starts no frame while the Next is
   * not ready. Time runs with the machine: run frames (or `runTo`) for the bytes to arrive.
   */
  uartSend(uart: UartIndex, frames: ArrayLike<UartFrame>): this {
    uartPeerOf(this.machine).send(uart, frames);
    return this;
  }

  /**
   * The peer holds the Next's RX line low (after its queued frames) until released. Modelled as at least
   * one frame long; the receiver reports a framing error, then a break once 8 more bit times pass.
   */
  uartBreak(uart: UartIndex, on: boolean): this {
    uartPeerOf(this.machine).setBreak(uart, on);
    return this;
  }

  /** The peer's RTS into the Next's CTS: with `$163B` bit 5 set, the Next transmits only while clear. */
  uartSetCts(uart: UartIndex, clear: boolean): this {
    uartPeerOf(this.machine).setCts(uart, clear);
    return this;
  }

  /** A wire from the Next's TX to its own RX (the peer stops driving the RX line meanwhile). */
  uartLoopback(uart: UartIndex, on: boolean): this {
    uartPeerOf(this.machine).setLoopback(uart, on);
    return this;
  }

  /** The Next's RTR output as the peer sees it (`o_Rx_rtr_n` = 0). */
  uartReadyToReceive(uart: UartIndex): boolean {
    return uartPeerOf(this.machine).readyToReceive(uart);
  }

  /** The bytes the Next has transmitted on the UART since power-on, whole frames only (the last 4096). */
  uartOutput(uart: UartIndex): number[] {
    return uartPeerOf(this.machine).output(uart);
  }

  // ==========================================================================================
  // Keyboard

  /**
   * Presses keys on the Next's membrane and keeps them down: the 40 matrix keys ("CAPS", "Z", ...,
   * "SYM", "ENTER", "SPACE", "0"-"9") and the 16 extra keys ("UP", "EDIT", ";", ...). The machines see
   * them at once; run frames for a program (or the ROM's interrupt scan) to notice.
   */
  keyDown(...keys: NextKey[]): this {
    for (const key of keys) this.machine.setKeyStatus(keyCode(key), true);
    return this;
  }

  /** Releases keys pressed by `keyDown`. */
  keyUp(...keys: NextKey[]): this {
    for (const key of keys) this.machine.setKeyStatus(keyCode(key), false);
    return this;
  }

  // ==========================================================================================
  // Joysticks

  /**
   * Holds exactly these buttons on a joystick connector (none: everything released): "UP", "DOWN",
   * "LEFT", "RIGHT", "B" (fire 1), "C" (fire 2) and the MD pad's "A", "START", "X", "Y", "Z", "MODE".
   * What the machine makes of them depends on NextReg $05 (Kempston ports, keys, MD pad) and $0B.
   */
  joystick(side: JoySide, ...buttons: JoyButton[]): this {
    setJoystickState(this.machine, side, joyBits(buttons));
    return this;
  }

  // ==========================================================================================
  // Mouse

  /**
   * The PS/2 mouse sends one packet: `dx` / `dy` (-255..255, right / up), `wheel` (-8..7) and the
   * `buttons` held - left out, the buttons of the previous packet stay held, as a mouse reports them.
   * NextReg $0A's DPI and button reverse act on the packet as it arrives.
   */
  mouse({ dx = 0, dy = 0, wheel = 0, buttons }: MouseEvent = {}): this {
    if (buttons) this.mouseButtons = mouseButtonBits(buttons);
    sendMousePacket(this.machine, this.mouseButtons, dx, dy, wheel);
    return this;
  }

  // ==========================================================================================
  // Real-time clock

  /**
   * Sets the DS1307 on the I2C bus to a time (24-hour mode, oscillator running), as a clock set before
   * the test and kept by its battery; the current second starts now. It then runs with the machine:
   * 28M clocks of 28 MHz are one second. Nothing else of the chip changes (RAM, control register).
   */
  setRtcTime(t: RtcTime): this {
    const regs = [t.seconds, t.minutes, t.hours, -1, t.date, t.month, t.year % 100].map((v, i) => (i === 3 ? t.day & 0x07 : toBcd(v)));
    if (this.machine instanceof ZxNextWasmV2Machine) {
      const [sec, min, hour, day, date, month, year] = regs;
      this.machine.wasmV2Runtime!.exports.zxnextRtcSetTime(sec, min, hour, day, date, month, year);
    } else {
      this.machine.i2cDevice.setRtcTime(regs);
    }
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

  private execute(capture: boolean, frameCommandsAnswered = false): FrameTerminationMode {
    const termination = this.machine.executeMachineFrame();
    if (this.machine.frameJustCompleted && termination === FrameTerminationMode.Normal && capture) {
      this.lastFrame = captureFrame(this.machine);
    }
    this.afterExecute();
    if (!frameCommandsAnswered) this.failOnFrameCommand();
    return termination;
  }

  private afterExecute(): void {
    if (!this.machine.frameJustCompleted) return;
    this.frames++;
    if (this.recording) for (const s of this.machine.getAudioSamples()) this.recording.push({ left: s.left, right: s.right });
  }

  private failOnFrameCommand(): void {
    if (this.machine.getFrameCommand()) {
      throw new Error(
        `The machine issued a frame command (${JSON.stringify(this.machine.getFrameCommand())}); attach an image (attachSdCard) and run it with runFramesAsync / runUntilReadyAsync, or use the browser tier.`
      );
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
