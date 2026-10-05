import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import { MI_SPECTRUM_3E, MI_SPECTRUM_48 } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { ZxSpectrum48WasmV2Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine";
import { ZxSpectrum128WasmV2Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine";
import { ZxSpectrumP3eWasmV2Machine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine";
import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";
import { DISK_A_CHANGES, DISK_A_UNSAVED, DISK_B_CHANGES, DISK_B_UNSAVED, FAST_LOAD, TRDOS_ROM_FILE } from "@emu/machines/machine-props";
import type { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";
import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_TAPE } from "@common/structs/project-const";
import type { TapeDataBlock } from "@common/structs/TapeDataBlock";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { CodeToInject } from "@abstractions/CodeToInject";
import type { P3ModelId } from "@emu/machines/zxSpectrumP3e/p3RomSets";
import { getSp128Model, type Sp128ModelId } from "@emu/machines/zxSpectrum128/sp128Timings";
import { parseSpectrumSnapshot } from "@common/spectrum/snapshot/parseSpectrumSnapshot";
import { writeSpectrumSnapshot } from "@common/spectrum/snapshot/writeSpectrumSnapshot";
import type { SnapshotWriteResult } from "@common/spectrum/snapshot/snapshotBytes";
import type { SpectrumSnapshot, SpectrumSnapshotFormat } from "@common/spectrum/snapshot/spectrumSnapshot";
import type { RzxPlayer, RzxPlayerOptions } from "@emu/machines/zxSpectrum/rzx/RzxPlayer";
import type { RzxRecorder, RzxRecorderOptions } from "@emu/machines/zxSpectrum/rzx/RzxRecorder";
import type { RzxStop } from "@emu/machines/zxSpectrum/rzx/rzxSession";
import * as rzx from "../spectrumRzx";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

import { buildSp48Wasm, productionOutput as sp48Output } from "../../../scripts/build-sp48-wasm.cjs";
import { buildSp128Wasm, productionOutput as sp128Output } from "../../../scripts/build-sp128-wasm.cjs";
import { buildSpP3eWasm, productionOutput as spp3eOutput } from "../../../scripts/build-spp3e-wasm.cjs";

/** The real ROMs the app ships (`src/public/roms/`) */
const ROM_DIR = join(__dirname, "../../../src/public/roms");

/** A model of the 128K machine (`SP128_MODELS`: the 128K, the Pentagon 128), or any of the +2A/+3/+2E/+3E (`P3_MODELS`) */
export type Sp128SessionModel = Sp128ModelId | P3ModelId;

export type RunLimit = { maxFrames?: number };

/** The character set in the 48 BASIC ROM (ROM 1 of the 128K, ROM 3 of the +2A/+3/+3E) */
const ROM_CHARSET = 0x3d00;

class HarnessSp128Machine extends ZxSpectrum128WasmV2Machine {
  constructor(model?: MachineModel, private readonly trdosRomImage?: Uint8Array) {
    super(model, { ...(model?.config ?? {}) }, {
      artifactName: "harness-sp128-machine-v2.wasm",
      readArtifact: async () => readFileSync(sp128Output)
    });
    // --- The Beta 128 needs a TR-DOS ROM; the harness hands over the bytes it was given
    if (trdosRomImage) this.setMachineProperty(TRDOS_ROM_FILE, "<harness>");
  }

  protected override async loadTrdosRom(): Promise<Uint8Array> {
    if (!this.trdosRomImage) throw new Error("No TR-DOS ROM given to the harness");
    return this.trdosRomImage;
  }

  protected override async loadRomFromResource(_romName: string, page = 0): Promise<Uint8Array> {
    return new Uint8Array(readFileSync(join(ROM_DIR, `sp128-${page}.rom`)));
  }
}

class HarnessSpp3eMachine extends ZxSpectrumP3eWasmV2Machine {
  constructor(model: MachineModel) {
    super(model, { ...model.config }, {
      artifactName: "harness-spp3e-machine-v2.wasm",
      readArtifact: async () => readFileSync(spp3eOutput)
    });
  }

  /** The model's ROM set names the files (`p3RomSets.ts`): `spp3e-*` for the +E models, `spp3-41-*` ... */
  protected override async loadRomFromResource(romName: string, page = 0): Promise<Uint8Array> {
    return new Uint8Array(readFileSync(join(ROM_DIR, `${romName}-${page}.rom`)));
  }
}

const built: Record<string, boolean> = {};

class HarnessSp48Machine extends ZxSpectrum48WasmV2Machine {
  constructor(model: MachineModel | undefined, config: MachineConfigSet) {
    super(model, config, {
      artifactName: "harness-sp48-flow-machine-v2.wasm",
      readArtifact: async () => readFileSync(sp48Output)
    });
  }

  protected override async loadRomFromResource(): Promise<Uint8Array> {
    return new Uint8Array(readFileSync(join(ROM_DIR, "sp48.rom")));
  }
}

/**
 * Creates (and sets up) a ZX Spectrum machine of any of the three types with the real ROMs, for
 * tests that drive a `MachineController` the way `MachineService` does.
 * @param machineId "sp48", "sp128" or "spp3e"
 * @param modelId The registry model ("pal", "ntsc", "pal-16k"; "nofdd", "fdd1", "fdd2")
 */
export async function createHarnessSpectrumMachine(
  machineId: string,
  modelId: string | undefined,
  config: MachineConfigSet = {}
): Promise<ZxSpectrum48WasmV2Machine | ZxSpectrum128WasmV2Machine | ZxSpectrumP3eWasmV2Machine> {
  const info = machineRegistry.find((m) => m.machineId === machineId)?.models?.find((m) => m.modelId === modelId);
  let machine: ZxSpectrum48WasmV2Machine | ZxSpectrum128WasmV2Machine | ZxSpectrumP3eWasmV2Machine;
  if (machineId === MI_SPECTRUM_48) {
    if (!built.sp48) {
      buildSp48Wasm();
      built.sp48 = true;
    }
    machine = new HarnessSp48Machine(info, { ...(info?.config ?? {}), ...config });
  } else if (machineId === MI_SPECTRUM_3E) {
    if (!built.spp3e) {
      buildSpP3eWasm();
      built.spp3e = true;
    }
    machine = new HarnessSpp3eMachine({ ...info!, config: { ...(info?.config ?? {}), ...config } });
  } else {
    if (!built.sp128) {
      buildSp128Wasm();
      built.sp128 = true;
    }
    machine = new HarnessSp128Machine(getSp128Model(modelId) ?? info);
  }
  await machine.setup();
  machine.hardReset();
  return machine;
}

/**
 * Creates a ZX Spectrum 128K, or a +2E/+3E of the given model, with the real ROMs. Builds the WASM
 * core first, once per test process.
 */
/**
 * The TR-DOS ROM named by the `KLIVE_TRDOS_ROM` environment variable, if any. Klive cannot ship the
 * ROM (`.plans/BETA128_TRDOS_PLAN.md` Q1), so the tests that need the real one run only when a
 * developer names their own copy.
 */
export function trdosRomFromEnvironment(): Uint8Array | undefined {
  const path = process.env.KLIVE_TRDOS_ROM;
  return path ? new Uint8Array(readFileSync(path)) : undefined;
}

export type Sp128SessionOptions = {
  /** The Pentagon's TR-DOS ROM (16K); without one its Beta 128 is off, as in the IDE */
  trdosRom?: Uint8Array;
};

export async function createSp128Session(
  model: Sp128SessionModel = "sp128",
  options: Sp128SessionOptions = {}
): Promise<Sp128TestSession> {
  let machine: ZxSpectrum128WasmV2Machine | ZxSpectrumP3eWasmV2Machine;
  const sp128Model = getSp128Model(model);
  if (sp128Model) {
    if (!built.sp128) {
      buildSp128Wasm();
      built.sp128 = true;
    }
    machine = new HarnessSp128Machine(sp128Model, options.trdosRom);
  } else {
    if (!built.spp3e) {
      buildSpP3eWasm();
      built.spp3e = true;
    }
    const info = machineRegistry
      .find((m) => m.machineId === MI_SPECTRUM_3E)!
      .models!.find((m) => m.modelId === model);
    if (!info) throw new Error(`Unknown +2A/+3/+2E/+3E model '${model}'`);
    machine = new HarnessSpp3eMachine({ ...info, config: { ...info.config } });
  }
  await machine.setup();
  return new Sp128TestSession(machine, model);
}

/**
 * Scripts one real ZX Spectrum 128K or +2E/+3E (the WASM core) from a vitest test: load snapshots,
 * run frames and instructions, read memory, banks, paging, the AY and the screen (see README.md).
 */
export class Sp128TestSession {
  /** Frames completed since the session started */
  frames = 0;

  constructor(
    readonly machine: ZxSpectrum128WasmV2Machine | ZxSpectrumP3eWasmV2Machine,
    readonly model: Sp128SessionModel
  ) {}

  private get exports(): Record<string, (...args: number[]) => number> {
    return this.machine.wasmV2Runtime!.exports as unknown as Record<string, (...args: number[]) => number>;
  }

  private get prefix(): "sp128" | "spp3e" {
    return getSp128Model(this.model) ? "sp128" : "spp3e";
  }

  private call(name: string, ...args: number[]): number {
    return this.exports[this.prefix + name](...args);
  }

  // ==========================================================================================
  // Loading and running

  /** Parses and loads a snapshot (its extension picks the format); returns the frame tact */
  loadSnapshot(name: string, bytes: Uint8Array): number {
    return this.machine.loadSnapshotState(parseSpectrumSnapshot(name, bytes));
  }

  // --- RZX (`.plans/RZX_PLAN.md`): see `../spectrumRzx.ts`

  /** Starts recording an RZX file at the machine's current state; returns the recorder */
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

  /** Runs frames until the RZX session stops and returns why; `onFrame` after every picture */
  runRzx(options: RunLimit & { onFrame?: () => void } = {}): RzxStop {
    return rzx.runRzx(this.machine, () => this.frames, () => this.execute(), options);
  }

  /** The RZX session's state */
  get rzxStatus(): rzx.RzxHarnessStatus {
    return rzx.rzxStatus(this.machine);
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

  /** Runs whole frames */
  runFrames(count = 1): this {
    for (let i = 0; i < count; i++) {
      const start = this.frames;
      while (this.frames === start) {
        this.execute();
        rzx.assertRzxRunning(this.machine);
      }
    }
    return this;
  }

  /**
   * Runs the rest of the current frame instruction by instruction, as the debugger does. Unlike
   * `runFrames`, this keeps the picture the frame has drawn so far: a normal frame started in the
   * middle of one re-draws it from its first tact, with the memory as it is by then.
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

  /** Executes single instructions */
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
   * Runs until PC reaches the address, stopping before it executes; with `rom`, only while that ROM
   * is paged in at $0000 (ROM addresses repeat across the four ROMs). Throws after `maxFrames`.
   */
  runTo(address: number, { rom, maxFrames = 500 }: RunLimit & { rom?: number } = {}): this {
    const ctx = this.machine.executionContext;
    const target = address & 0xffff;
    const limit = this.frames + maxFrames;
    ctx.frameTerminationMode = FrameTerminationMode.UntilExecutionPoint;
    ctx.terminationPoint = target;
    try {
      while (true) {
        if (this.frames >= limit) {
          throw new Error(
            `Timed out after ${maxFrames} frames running to ${hex4(target)}${rom === undefined ? "" : ` in ROM ${rom}`} (PC=${hex4(this.machine.pc)}, ROM ${this.paging().rom})`
          );
        }
        if (this.execute() === FrameTerminationMode.UntilExecutionPoint) {
          if (rom === undefined || this.paging().rom === rom) return this;
          // --- The address in another ROM: step past it and keep going
          ctx.frameTerminationMode = FrameTerminationMode.Normal;
          this.step();
          ctx.frameTerminationMode = FrameTerminationMode.UntilExecutionPoint;
        }
      }
    } finally {
      ctx.frameTerminationMode = FrameTerminationMode.Normal;
      ctx.terminationPoint = undefined;
    }
  }

  // ==========================================================================================
  // Keyboard

  /** Holds keys down (`SpectrumKeyCode` names: `"A"`, `"N6"`, `"Enter"`, `"CShift"`, ...) */
  keyDown(...keys: string[]): this {
    for (const key of keys) this.machine.setKeyStatus(keyCode(key), true);
    return this;
  }

  keyUp(...keys: string[]): this {
    for (const key of keys) this.machine.setKeyStatus(keyCode(key), false);
    return this;
  }

  /** Types chords (keys pressed together), each held for `hold` frames and released for `gap` */
  typeKeys(chords: string[][], { hold = 3, gap = 3 }: { hold?: number; gap?: number } = {}): this {
    for (const chord of chords) {
      this.keyDown(...chord).runFrames(hold);
      this.keyUp(...chord).runFrames(gap);
    }
    return this;
  }

  /** Types text: letters, digits, space and ENTER (`"\n"`) */
  typeText(text: string, options?: { hold?: number; gap?: number }): this {
    const chords = [...text].map((ch) => {
      if (ch === "\n") return ["Enter"];
      if (ch === " ") return ["Space"];
      if (/[0-9]/.test(ch)) return [`N${ch}`];
      if (/[a-z]/i.test(ch)) return [ch.toUpperCase()];
      throw new Error(`typeText cannot type '${ch}'`);
    });
    return this.typeKeys(chords, options);
  }

  /**
   * Types a code-injection flow's `QueueKey` steps - the very keys the IDE queues - skipping the
   * other steps: the session must already be where the flow's `ReachExecPoint` takes it.
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

  /**
   * Plays a code-injection flow (`getCodeInjectionFlow`, `getTapeLoadFlow`) the way
   * `MachineController.executeInjectionFlow` does, from a hard reset: `ReachExecPoint` runs to the
   * address (and, with `checkRom`, only in the flow's ROM), `QueueKey` queues the keystroke on the
   * machine's own queue and runs the frames its `wait` stands for (20 ms each), `Inject` and
   * `SetReturn` act on `code`. Ends where the controller would start the machine. Returns the
   * entry point (the PC unless the flow says `KeepPc`).
   */
  runFlow(
    flow: CodeInjectionFlow,
    { code, checkRom = true, maxFrames = 600 }: { code?: CodeToInject; checkRom?: boolean; maxFrames?: number } = {}
  ): number {
    this.machine.hardReset();
    let entry = 0;
    let keepPc = false;
    for (const step of flow) {
      switch (step.type) {
        case "KeepPc":
          keepPc = true;
          break;
        case "ReachExecPoint":
          this.runTo(step.execPoint, { rom: checkRom ? step.rom : undefined, maxFrames });
          break;
        case "QueueKey":
          this.machine.queueKeystroke(0, 5, step.primary, step.secondary);
          if ((step.wait ?? 100) > 0) this.runFrames(Math.ceil((step.wait ?? 100) / 20));
          break;
        case "Inject":
          if (code) entry = this.machine.injectCodeToRun(code);
          break;
        case "SetReturn":
          if (code?.subroutine) {
            const sp = (this.machine.sp - 2) & 0xffff;
            this.machine.doWriteMemory(sp, step.returnPoint & 0xff);
            this.machine.doWriteMemory(sp + 1, step.returnPoint >> 8);
            this.machine.sp = sp;
          }
          break;
      }
    }
    if (!keepPc) this.machine.pc = entry;
    return this.machine.pc;
  }

  // ==========================================================================================
  // Media

  /** Puts a tape in the deck as the IDE does (fast load on unless asked otherwise) */
  insertTape(blocks: TapeDataBlock[], { fastLoad = true }: { fastLoad?: boolean } = {}): this {
    this.machine.setMachineProperty(FAST_LOAD, fastLoad);
    this.machine.setMachineProperty(MEDIA_TAPE, blocks);
    return this;
  }

  /** Inserts a `.dsk` image in drive A (0) or B (1) as the IDE does; +2A/+3/+3E only */
  insertDisk(drive: 0 | 1, bytes: Uint8Array): this {
    this.machine.setMachineProperty(drive ? MEDIA_DISK_B : MEDIA_DISK_A, bytes);
    return this;
  }

  /**
   * The disk writes the machine has handed over since the last call (the Beta 128 publishes them as
   * `.trd` file sectors at frame ends and debug stops), and clears them, as the controller does
   */
  takeDiskChanges(drive: 0 | 1): SectorChanges | undefined {
    const key = drive ? DISK_B_CHANGES : DISK_A_CHANGES;
    const changes = this.machine.getMachineProperty(key) as SectorChanges | undefined;
    this.machine.setMachineProperty(key, undefined);
    return changes;
  }

  /** The guest changed the disk, but its file (an `.scl`) is not written back */
  diskUnsaved(drive: 0 | 1): boolean {
    return !!this.machine.getMachineProperty(drive ? DISK_B_UNSAVED : DISK_A_UNSAVED);
  }

  /** The Beta 128's state, read without side effects */
  beta128() {
    const c = (name: string, ...args: number[]) => this.call(name, ...args);
    return {
      enabled: c("BetaGetEnabled") !== 0,
      paged: c("BetaGetPaged") !== 0,
      system: c("BetaGetSystemRegister"),
      status: c("BetaGetFdcStatus"),
      track: c("BetaGetFdcTrack"),
      sector: c("BetaGetFdcSector"),
      data: c("BetaGetFdcData"),
      command: c("BetaGetFdcCommand"),
      busy: c("BetaGetFdcBusy") !== 0,
      intrq: c("BetaGetIntrq") !== 0,
      drq: c("BetaGetDrq") !== 0,
      cylinders: [c("BetaGetDriveCylinder", 0), c("BetaGetDriveCylinder", 1)]
    };
  }

  // ==========================================================================================
  // Screen

  /**
   * The character in a screen cell (row 0-23, column 0-31), recognised against the ROM character
   * set (codes 32-127), INVERSE ignored; `undefined` for a cell matching none.
   */
  screenChar(row: number, col: number): string | undefined {
    const cell: number[] = [];
    const screen = this.bank(this.paging().shadowScreen ? 7 : 5);
    for (let line = 0; line < 8; line++) {
      cell.push(screen[((row & 0x18) << 8) | (line << 8) | ((row & 0x07) << 5) | col]);
    }
    const font = this.charset();
    for (let code = 32; code < 128; code++) {
      const base = ROM_CHARSET + (code - 32) * 8;
      let same = true;
      let inverse = true;
      for (let line = 0; line < 8; line++) {
        const glyph = font[base + line];
        if (cell[line] !== glyph) same = false;
        if (cell[line] !== (~glyph & 0xff)) inverse = false;
      }
      if (same || inverse) return String.fromCharCode(code);
    }
    return undefined;
  }

  /** One screen row as text (unrecognised cells as `?`), trailing spaces removed */
  screenLine(row: number): string {
    let text = "";
    for (let col = 0; col < 32; col++) text += this.screenChar(row, col) ?? "?";
    return text.replace(/\s+$/, "");
  }

  /** The whole screen as text, one line per row */
  screenText(): string {
    return Array.from({ length: 24 }, (_, row) => this.screenLine(row)).join("\n");
  }

  private charsetCache?: Uint8Array;

  /** The 48 BASIC ROM, read from the file the machine booted */
  private charset(): Uint8Array {
    if (!this.charsetCache) {
      const page = this.prefix === "sp128" ? 1 : 3;
      this.charsetCache = new Uint8Array(readFileSync(join(ROM_DIR, `${this.machine.romId}-${page}.rom`)));
    }
    return this.charsetCache;
  }

  private execute(): FrameTerminationMode {
    const termination = this.machine.executeMachineFrame();
    if (this.machine.frameJustCompleted) this.frames++;
    return termination;
  }

  // ==========================================================================================
  // Code

  /**
   * Assembles Klive Z80 source (`.model Spectrum128` added when missing) and writes it into the
   * memory the CPU sees now. Does not change PC or SP. Returns a symbol lookup and the entry address.
   */
  async loadCode(source: string): Promise<{ entry: number; symbol: (name: string) => number }> {
    const text = /^\s*\.model\b/im.test(source) ? source : `  .model Spectrum128\n${source}`;
    const options = new AssemblerOptions();
    options.currentModel = SpectrumModelType.Spectrum128;
    const output = await new Z80Assembler().compile(text, options);
    const errors = output.errors.filter((e) => !e.isWarning);
    if (errors.length) {
      throw new Error(
        "Assembly failed:\n" + errors.map((e) => `  line ${e.line}: ${e.errorCode}: ${e.message}`).join("\n")
      );
    }
    const segments = output.segments.filter((s) => s.emittedCode.length);
    if (!segments.length) throw new Error("The source emits no code.");
    for (const s of segments) this.poke(s.startAddress, s.emittedCode);
    const symbol = (name: string): number => {
      const value = output.getSymbol(name)?.value?.value;
      if (typeof value !== "number") throw new Error(`Unknown symbol '${name}'`);
      return value;
    };
    return { entry: output.entryAddress ?? segments[0].startAddress, symbol };
  }

  /** Writes bytes into the memory the CPU sees */
  poke(address: number, bytes: number | ArrayLike<number>): this {
    const data = typeof bytes === "number" ? [bytes] : bytes;
    for (let i = 0; i < data.length; i++) this.machine.doWriteMemory((address + i) & 0xffff, data[i] & 0xff);
    return this;
  }

  // ==========================================================================================
  // State

  /** A byte of the 64K the CPU sees */
  peek(address: number): number {
    return this.machine.doReadMemory(address & 0xffff);
  }

  /** A RAM bank (0-7), as stored */
  bank(index: number): Uint8Array {
    return this.machine.getMemoryPartition(index & 0x07);
  }

  /** The paging state */
  paging(): {
    bank: number;
    rom: number;
    shadowScreen: boolean;
    locked: boolean;
    specialPaging?: boolean;
    diskMotor?: boolean;
  } {
    const result = {
      bank: this.call("GetSelectedBank"),
      rom: this.call("GetSelectedRom"),
      shadowScreen: this.call("GetUseShadowScreen") !== 0,
      locked: this.call("GetPagingEnabled") === 0
    };
    if (this.prefix === "spp3e") {
      return {
        ...result,
        specialPaging: this.call("GetInSpecialPagingMode") !== 0,
        diskMotor: this.call("GetDiskMotorOn") !== 0
      };
    }
    return result;
  }

  /** An AY register, and the selected register */
  psgRegister(index: number): number {
    const selected = this.call("GetPsgRegisterIndex");
    this.call("SetPsgRegisterIndex", index);
    const value = this.call("ReadPsgRegisterValue");
    this.call("SetPsgRegisterIndex", selected);
    return value;
  }

  psgSelected(): number {
    return this.call("GetPsgRegisterIndex");
  }

  /** T-states since the start of the current frame */
  frameTact(): number {
    return this.call("GetCurrentFrameTact");
  }

  /** The border colour */
  border(): number {
    return this.call("GetBorderColor");
  }

  /** The CPU's state, read from the core */
  cpu() {
    const c = (n: string) => this.call(n);
    return {
      af: c("GetCpuAf"),
      bc: c("GetCpuBc"),
      de: c("GetCpuDe"),
      hl: c("GetCpuHl"),
      af_: c("GetCpuAfAlt"),
      bc_: c("GetCpuBcAlt"),
      de_: c("GetCpuDeAlt"),
      hl_: c("GetCpuHlAlt"),
      ix: c("GetCpuIx"),
      iy: c("GetCpuIy"),
      ir: c("GetCpuIr"),
      wz: c("GetCpuWz"),
      sp: c("GetCpuSp"),
      pc: c("GetCpuPc"),
      iff1: c("GetCpuIff1") !== 0,
      iff2: c("GetCpuIff2") !== 0,
      im: c("GetCpuInterruptMode"),
      halted: c("GetCpuHalted") !== 0,
      eiBacklog: c("GetCpuEiBacklog")
    };
  }
}

function hex4(value: number): string {
  return "$" + (value & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function keyCode(key: string): number {
  const code = (SpectrumKeyCode as unknown as Record<string, number>)[key];
  if (code === undefined) throw new Error(`Unknown Spectrum key '${key}'`);
  return code;
}
