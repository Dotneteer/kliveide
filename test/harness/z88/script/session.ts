import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import type { BlinkState, Z80CpuState } from "@common/messaging/EmuApi";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { Z88KeyCode } from "@emu/machines/z88/Z88KeyCode";
import type { CardSlotState } from "@emu/machines/z88/memory/CardSlotState";
import { MC_Z88_SLOT1, MC_Z88_SLOT2, MC_Z88_SLOT3 } from "@common/machines/constants";

import {
  createHarnessZ88Machine,
  type CreateHarnessZ88MachineOptions,
  type Z88HarnessBackend,
  type Z88HarnessMachine
} from "../core/machines";

/** A Z88 key, by its `Z88KeyCode` name (`"A"`, `"N1"`, `"Enter"`, `"ShiftL"`, `"Menu"`, ...) */
export type Z88Key = keyof typeof Z88KeyCode & string;

/** The colours the LCD renders (Uint32 ABGR, as the pixel buffer stores them) */
export const Z88_LCD = {
  /** A lit pixel */
  ON: 0xff7d1b46,
  /** An unlit pixel */
  OFF: 0xffb9e0d2,
  /** A lit pixel of a grey character */
  GREY: 0xffa7b090,
  /** Every pixel while the LCD is switched off (COM.LCDON clear) */
  SCREEN_OFF: 0xffa0a0a0
} as const;

/** The paging `loadCode` sets up: internal RAM banks $20-$23 fill the whole 64K */
export const Z88_FLAT_RAM_LAYOUT = {
  /** COM.RAMS: bank $20 at $0000-$1FFF */
  COM: 0x04,
  /** SR0 = $21: the upper half of bank $20 at $2000-$3FFF */
  SR0: 0x21,
  SR1: 0x21,
  SR2: 0x22,
  SR3: 0x23
} as const;

export type Program = {
  /** The value of a label or `.equ` of the program */
  symbol(name: string): number;
  /** The address PC was set to */
  entry: number;
};

export type RunLimit = { maxFrames?: number };

export type Z88Registers = {
  af: number;
  bc: number;
  de: number;
  hl: number;
  ix: number;
  iy: number;
  sp: number;
  pc: number;
  i: number;
  iff1: boolean;
  interruptMode: number;
  halted: boolean;
};

export type Z88Sample = { left: number; right: number };

export type CreateZ88SessionOptions = CreateHarnessZ88MachineOptions;

/**
 * Creates a Z88 test session: a machine on the requested backend (TypeScript by default), wired the
 * way the app wires it. See `test/harness/z88/README.md`.
 */
export async function createZ88Session(options: CreateZ88SessionOptions = {}): Promise<Z88TestSession> {
  const machine = await createHarnessZ88Machine(options);
  return new Z88TestSession(machine, options.backend ?? "typescript");
}

/**
 * Scripts a Cambridge Z88 through what the hardware exposes: memory, ports, CPU registers, keys, the
 * LCD picture and the beeper. It talks to the machine only through the backend-neutral machine API,
 * so the same test runs on every backend.
 */
export class Z88TestSession {
  private program: Program | undefined;
  private recording: Z88Sample[] | undefined;

  /** Frames completed since the session started */
  frames = 0;

  constructor(
    /** Escape hatch; tests should use (or add) session methods instead */
    readonly machine: Z88HarnessMachine,
    readonly backend: Z88HarnessBackend
  ) {}

  // ==========================================================================================
  // Loading code

  /**
   * Assembles Z80 source (Klive syntax) into memory and points PC at it.
   *
   * The whole 64K is mapped to internal RAM (`Z88_FLAT_RAM_LAYOUT`: COM.RAMS, SR0-SR3 through their
   * ports), interrupts are disabled, SP is $BFF0 unless given. PC is `.ent`, else `entry`, else the
   * first segment. The code may use any address, including an IM 1 handler at $0038.
   */
  async loadCode(source: string, options: { entry?: number | string; sp?: number } = {}): Promise<Program> {
    const output = await new Z80Assembler().compile(source, new AssemblerOptions());
    const errors = output.errors.filter((e) => !e.isWarning);
    if (errors.length) {
      throw new Error(
        "Assembly failed:\n" +
          errors.map((e) => `  line ${e.line}:${e.startColumn} ${e.errorCode}: ${e.message}`).join("\n")
      );
    }
    const segments = output.segments
      .filter((s) => s.emittedCode.length)
      .map((s) => [s.startAddress, Uint8Array.from(s.emittedCode)] as const);
    if (!segments.length) throw new Error("The source emits no code.");

    this.mapFlatRam();
    for (const [start, bytes] of segments) this.poke(start, bytes);

    const symbol = (name: string) => {
      const s = output.getSymbol(name);
      if (s?.value === undefined) throw new Error(`Unknown symbol '${name}'`);
      return s.value.value as number;
    };
    const entry =
      typeof options.entry === "string"
        ? symbol(options.entry)
        : (options.entry ?? output.entryAddress ?? segments[0][0]);
    this.program = { symbol, entry };
    this.machine.sp = options.sp ?? 0xbff0;
    this.machine.pc = entry;
    this.machine.iff1 = this.machine.iff2 = false;
    return this.program;
  }

  /** Maps internal RAM banks $20-$23 into the whole 64K (see `Z88_FLAT_RAM_LAYOUT`) */
  mapFlatRam(): this {
    this.out(0xb0, Z88_FLAT_RAM_LAYOUT.COM);
    this.out(0xd0, Z88_FLAT_RAM_LAYOUT.SR0);
    this.out(0xd1, Z88_FLAT_RAM_LAYOUT.SR1);
    this.out(0xd2, Z88_FLAT_RAM_LAYOUT.SR2);
    this.out(0xd3, Z88_FLAT_RAM_LAYOUT.SR3);
    return this;
  }

  /** A label or `.equ` of the last `loadCode` program */
  symbol(name: string): number {
    if (!this.program) throw new Error("No program has been loaded.");
    return this.program.symbol(name);
  }

  // ==========================================================================================
  // Running

  /** Runs `count` whole frames. After a mid-frame stop (`runTo`, `step`) the first one finishes it. */
  runFrames(count = 1): this {
    for (let n = 0; n < count; n++) this.runOneFrame();
    return this;
  }

  /** Runs whole frames until `done()` is true (checked before each frame). */
  runUntil(done: (s: Z88TestSession) => boolean, what: string, { maxFrames = 1000 }: RunLimit = {}): this {
    const limit = this.frames + maxFrames;
    while (!done(this)) {
      if (this.frames >= limit) {
        throw new Error(`Timed out after ${maxFrames} frames waiting for ${what} (PC=${hex(this.machine.pc, 4)})`);
      }
      this.runOneFrame();
    }
    return this;
  }

  /** Runs until PC reaches the address or label, stopping before that instruction executes. */
  runTo(where: number | string, { maxFrames = 100 }: RunLimit = {}): this {
    const target = this.address(where);
    const ctx = this.machine.executionContext;
    ctx.frameTerminationMode = FrameTerminationMode.UntilExecutionPoint;
    ctx.terminationPoint = target;
    const limit = this.frames + maxFrames;
    try {
      while (true) {
        if (this.frames >= limit) {
          throw new Error(`Timed out after ${maxFrames} frames running to ${hex(target, 4)} (PC=${hex(this.machine.pc, 4)})`);
        }
        if (this.execute() === FrameTerminationMode.UntilExecutionPoint) return this;
      }
    } finally {
      ctx.frameTerminationMode = FrameTerminationMode.Normal;
      ctx.terminationPoint = undefined;
    }
  }

  /** Executes `count` instructions (a snoozed CPU's 16-tact pause counts as one) */
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

  /**
   * Runs the way the IDE's debugger does (`MachineController.run`): frames in debug mode until a
   * debug event (a breakpoint, or the end of the step). A step wakes a snoozing CPU first and a
   * step-out marks its target first, as `MachineController.stepInto/stepOver/stepOut` do.
   * @returns The PC where the machine stopped
   */
  debug(action: "continue" | "stepInto" | "stepOver" | "stepOut", { maxFrames = 100 }: RunLimit = {}): number {
    const modes = {
      continue: DebugStepMode.StopAtBreakpoint,
      stepInto: DebugStepMode.StepInto,
      stepOver: DebugStepMode.StepOver,
      stepOut: DebugStepMode.StepOut
    };
    const m = this.machine;
    if (action !== "continue") m.awakeCpu();
    if (action === "stepOut") m.markStepOutAddress();
    const ctx = m.executionContext;
    ctx.frameTerminationMode = FrameTerminationMode.DebugEvent;
    ctx.debugStepMode = modes[action];
    const limit = this.frames + maxFrames;
    try {
      while (this.execute() !== FrameTerminationMode.DebugEvent) {
        if (this.frames >= limit) {
          throw new Error(`Timed out after ${maxFrames} frames in debug ${action} (PC=${hex(m.pc, 4)})`);
        }
      }
      return this.registers().pc;
    } finally {
      ctx.frameTerminationMode = FrameTerminationMode.Normal;
      ctx.debugStepMode = DebugStepMode.NoDebug;
    }
  }

  /** Sets an execution breakpoint at an address or label */
  breakpoint(where: number | string): this {
    this.machine.executionContext.debugSupport.addBreakpoint({ address: this.address(where), exec: true });
    return this;
  }

  /**
   * Sets a memory or I/O breakpoint, as the IDE's `bp-set` creates one: the debugger stops after the
   * instruction that read or wrote the address (a memory address: a label or a number; a port: its
   * 16-bit address)
   */
  watch(where: number | string, access: "memoryRead" | "memoryWrite" | "ioRead" | "ioWrite"): this {
    this.machine.executionContext.debugSupport.addBreakpoint({ address: this.address(where), [access]: true });
    return this;
  }

  /** Power-on reset: memory is cleared and the machine set up again */
  async hardReset(): Promise<this> {
    await this.machine.hardReset();
    return this;
  }

  /** Reset button: memory is kept */
  reset(): this {
    this.machine.reset();
    return this;
  }

  private runOneFrame(): void {
    const start = this.frames;
    while (this.frames === start) this.execute();
  }

  private execute(): FrameTerminationMode {
    const termination = this.machine.executeMachineFrame();
    if (this.machine.frameJustCompleted) {
      this.frames++;
      if (this.recording) {
        for (const s of this.machine.getAudioSamples()) this.recording.push({ left: s.left, right: s.right });
      }
    }
    return termination;
  }

  // ==========================================================================================
  // Memory, ports, CPU

  /** Reads through the current paging, like the CPU (card command states see the read) */
  peek(address: number): number {
    return this.machine.doReadMemory(address & 0xffff);
  }

  peekWord(address: number): number {
    return this.peek(address) | (this.peek(address + 1) << 8);
  }

  peekBytes(address: number, length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) bytes[i] = this.peek(address + i);
    return bytes;
  }

  /** Writes through the current paging, like the CPU (ROM ignores it, flash sees a command cycle) */
  poke(address: number, value: number | ArrayLike<number>): this {
    if (typeof value === "number") {
      this.machine.doWriteMemory(address & 0xffff, value & 0xff);
    } else {
      for (let i = 0; i < value.length; i++) this.machine.doWriteMemory((address + i) & 0xffff, value[i] & 0xff);
    }
    return this;
  }

  pokeWord(address: number, value: number): this {
    return this.poke(address, [value & 0xff, (value >> 8) & 0xff]);
  }

  /** Reads a byte of the 4 MB physical memory (slot N starts at N * $100000) */
  physPeek(absAddress: number): number {
    return this.machine.directReadMemory(absAddress);
  }

  /** Reads a port with every side effect a Z80 `IN` has (a `$B2` read may snooze the CPU) */
  in(port: number): number {
    return this.machine.doReadPort(port & 0xffff);
  }

  /** Writes a port; the high byte is B, which the LCD registers use */
  out(port: number, value: number): this {
    this.machine.doWritePort(port & 0xffff, value & 0xff);
    return this;
  }

  /**
   * The CPU registers, through `getCpuState()` - the IDE's path, which makes a backend that mirrors
   * its CPU lazily (the WASM core) bring the state up to date first.
   */
  registers(): Z88Registers {
    const cpu = this.machine.getCpuState() as Z80CpuState;
    return {
      af: cpu.af,
      bc: cpu.bc,
      de: cpu.de,
      hl: cpu.hl,
      ix: cpu.ix,
      iy: cpu.iy,
      sp: cpu.sp,
      pc: cpu.pc,
      i: (cpu.ir >> 8) & 0xff,
      iff1: cpu.iff1,
      interruptMode: cpu.interruptMode,
      halted: cpu.halted
    };
  }

  setRegisters(regs: Partial<Omit<Z88Registers, "halted">>): this {
    const m = this.machine;
    for (const [name, value] of Object.entries(regs)) {
      (m as any)[name] = value;
    }
    return this;
  }

  get tacts(): number {
    return this.machine.tacts;
  }

  /** The CPU is snoozing: it read the keyboard with INT.KWAIT set and no key down */
  get snoozed(): boolean {
    return this.machine.isCpuSnoozed();
  }

  /** The machine reports sleep mode (HALT with I = $3F) */
  get sleeping(): boolean {
    return this.machine.isInSleepMode;
  }

  /** What the IDE's Blink panel shows */
  blinkState(): BlinkState {
    return this.machine.getBlinkState();
  }

  // ==========================================================================================
  // Keys and commands

  /** Holds keys down */
  keyDown(...keys: Z88Key[]): this {
    for (const key of keys) this.machine.setKeyStatus(keyCode(key), true);
    return this;
  }

  /** Releases keys */
  keyUp(...keys: Z88Key[]): this {
    for (const key of keys) this.machine.setKeyStatus(keyCode(key), false);
    return this;
  }

  /** Opens the flap (as the card slot strip does before a card dialog) */
  flapOpen(): this {
    this.machine.signalFlapOpened();
    return this;
  }

  /** Closes the flap */
  flapClose(): this {
    this.machine.signalFlapClosed();
    return this;
  }

  /**
   * Inserts a card into slot 1-3 while the machine runs - or, with `undefined`, removes it - the way
   * the card dialogs do (`applyCardStateChange`): the slot's configuration changes and the machine
   * configures its slots again. Configuring a slot re-inserts its card, so a flash card comes back
   * erased.
   * @param slot The slot (1-3)
   * @param card The card: its `CardIds` type, its size in KB, and an optional image file
   */
  async plugCard(slot: 1 | 2 | 3, card: CardSlotState | undefined): Promise<this> {
    const key = [MC_Z88_SLOT1, MC_Z88_SLOT2, MC_Z88_SLOT3][slot - 1];
    const config = { ...(this.machine.dynamicConfig ?? this.machine.config) };
    if (card) {
      config[key] = card;
    } else {
      delete config[key];
    }
    this.machine.dynamicConfig = config;
    await this.machine.configure();
    return this;
  }

  /** Runs a machine custom command (`battery_low`, `press_shifts`, `flap_open`, `flap_close`) */
  async command(name: string): Promise<this> {
    await this.machine.executeCustomCommand(name);
    return this;
  }

  // ==========================================================================================
  // LCD and audio

  get lcdWidth(): number {
    return this.machine.screenWidthInPixels;
  }

  get lcdHeight(): number {
    return this.machine.screenHeightInPixels;
  }

  /** A pixel of the last rendered LCD picture (Uint32 ABGR; compare with `Z88_LCD`) */
  pixel(x: number, y: number): number {
    return this.machine.getPixelBuffer()[y * this.lcdWidth + x] >>> 0;
  }

  /** A copy of the last rendered LCD picture */
  screen(): Uint32Array {
    return Uint32Array.from(this.machine.getPixelBuffer().subarray(0, this.lcdWidth * this.lcdHeight));
  }

  /** Starts collecting the audio samples of every completed frame */
  startAudio(): this {
    this.recording = [];
    return this;
  }

  /** The samples collected since `startAudio()` */
  audio(): Z88Sample[] {
    if (!this.recording) throw new Error("Call startAudio() first.");
    return this.recording;
  }

  // ==========================================================================================
  // Helpers

  private address(where: number | string): number {
    return typeof where === "number" ? where & 0xffff : this.symbol(where);
  }
}

/** The key code of a key name */
export function keyCode(key: Z88Key): number {
  const code = Z88KeyCode[key];
  if (code === undefined) throw new Error(`Unknown Z88 key '${key}'`);
  return code;
}

export function hex(value: number, digits = 2): string {
  return "$" + value.toString(16).toUpperCase().padStart(digits, "0");
}
