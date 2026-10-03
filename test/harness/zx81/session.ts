import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { MI_ZX80, MI_ZX81 } from "@common/machines/constants";
import { FAST_LOAD } from "@emu/machines/machine-props";
import { connectConditionSupport } from "@emu/machines/conditionStore";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { Zx8081WasmV2Machine } from "@emu/machines/zx8081/Zx8081WasmV2Machine";
import {
  ZX80_LOAD_FINISHED,
  ZX80_MODELS,
  ZX81_LOAD_FINISHED,
  ZX81_MODELS
} from "@emu/machines/zx8081/zx8081MachineInfo";
import { parseZxProgramFile, ZX80_CHARSET, ZX81_CHARSET, type ZxProgramFile } from "@emu/machines/zx8081/ZxPFile";

import { buildZx8081Wasm, productionOutput } from "../../../scripts/build-zx8081-wasm.cjs";

export const REPO_ROOT = join(__dirname, "../../..");
const ROMS = join(REPO_ROOT, "src/public/roms");

/** The ZX81's D_FILE and the inverse K the editor shows in K mode */
const D_FILE = 0x400c;
const K_CURSOR = 0xb0;

export type RunLimit = { maxFrames?: number };
export type Zx81SessionOptions = { machineId?: string; model?: string };

class HarnessZx8081Machine extends Zx8081WasmV2Machine {
  constructor(machineId: string, modelId: string) {
    const models = machineId === MI_ZX81 ? ZX81_MODELS : ZX80_MODELS;
    const model = models.find((m) => m.modelId === modelId);
    if (!model) throw new Error(`Unknown ${machineId} model '${modelId}'`);
    super(machineId, model, undefined, undefined, {
      artifactName: "harness-zx8081.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
  }

  protected override async loadRomFromResource(romName: string): Promise<Uint8Array> {
    return new Uint8Array(readFileSync(join(ROMS, `${romName}.rom`)));
  }
}

let wasmBuilt = false;

/**
 * Creates a ZX81 (or ZX80) on the real WASM core with the real ROM, ready to boot. Builds the core
 * once per test process.
 */
export async function createZx81Session(options: Zx81SessionOptions = {}): Promise<Zx81TestSession> {
  if (!wasmBuilt) {
    buildZx8081Wasm();
    wasmBuilt = true;
  }
  const machineId = options.machineId ?? MI_ZX81;
  const model = options.model ?? (machineId === MI_ZX81 ? "zx81-16k" : "zx80-16k");
  const machine = new HarnessZx8081Machine(machineId, model);
  await machine.setup();
  return new Zx81TestSession(machine);
}

/**
 * Scripts one real ZX81 (the WASM core) from a vitest test: boot to the editor, type, load program
 * files, run frames or to an address, and read memory, the screen text and the picture. See README.md.
 */
export class Zx81TestSession {
  frames = 0;

  constructor(readonly machine: Zx8081WasmV2Machine) {}

  get wasm() {
    return this.machine.wasmV2Runtime!.exports;
  }

  // ==========================================================================================
  // Running

  runFrames(n: number): this {
    for (let i = 0; i < n; i++) {
      this.machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
      this.machine.executionContext.debugStepMode = DebugStepMode.NoDebug;
      this.machine.executeMachineFrame();
      this.frames++;
    }
    return this;
  }

  /** Runs until `predicate` holds after a frame; throws after `maxFrames` */
  runUntil(predicate: () => boolean, { maxFrames = 1000 }: RunLimit = {}, what = "the condition"): this {
    for (let i = 0; i < maxFrames; i++) {
      if (predicate()) return this;
      this.runFrames(1);
    }
    if (predicate()) return this;
    throw new Error(`${what} did not happen in ${maxFrames} frames (PC $${this.machine.pc.toString(16)})`);
  }

  /** Runs until PC reaches `address` (stops before executing it) */
  runTo(address: number, { maxFrames = 500 }: RunLimit = {}): this {
    const m = this.machine;
    for (let i = 0; i < maxFrames; i++) {
      m.executionContext.frameTerminationMode = FrameTerminationMode.UntilExecutionPoint;
      m.executionContext.terminationPoint = address;
      m.executionContext.debugStepMode = DebugStepMode.NoDebug;
      const result = m.executeMachineFrame();
      if (result === FrameTerminationMode.UntilExecutionPoint) return this;
      this.frames++;
    }
    throw new Error(`PC never reached $${address.toString(16)} in ${maxFrames} frames`);
  }

  /** Executes `n` instructions */
  step(n = 1): this {
    for (let i = 0; i < n; i++) this.wasm.zx8081ExecuteInstruction();
    return this;
  }

  /**
   * Boots to the editor: until the display file shows the K cursor and the ROM waits for a key.
   */
  bootToBasic(limit: RunLimit = { maxFrames: 400 }): this {
    return this.runUntil(() => this.hasKCursor(), limit, "the K cursor").runFrames(5);
  }

  /** Whether the display file shows the K cursor (an inverse K on both machines) */
  hasKCursor(): boolean {
    const dfile = this.peekWord(D_FILE);
    if (dfile < 0x4000) return false;
    for (let a = dfile; a < dfile + 24 * 33 + 1 && a < 0x10000; a++) {
      if (this.peek(a) === K_CURSOR) return true;
    }
    return false;
  }

  // ==========================================================================================
  // Debugging, as the IDE drives it (`MachineController.run` in debug mode)

  /** Attaches the emulator's own breakpoint store, as the IDE's emulator does */
  attachDebugSupport(): DebugSupport {
    const debugSupport = new DebugSupport(undefined, []);
    connectConditionSupport(debugSupport, this.machine);
    this.machine.executionContext.debugSupport = debugSupport;
    return debugSupport;
  }

  /** Continues, or steps into, over or out, until the debugger stops; returns the PC */
  debug(action: "continue" | "stepInto" | "stepOver" | "stepOut", { maxFrames = 100 }: RunLimit = {}): number {
    const modes = {
      continue: DebugStepMode.StopAtBreakpoint,
      stepInto: DebugStepMode.StepInto,
      stepOver: DebugStepMode.StepOver,
      stepOut: DebugStepMode.StepOut
    };
    const m = this.machine;
    if (!m.executionContext.debugSupport) this.attachDebugSupport();
    if (action === "stepOut") m.markStepOutAddress();
    const ctx = m.executionContext;
    ctx.frameTerminationMode = FrameTerminationMode.DebugEvent;
    ctx.debugStepMode = modes[action];
    const limit = this.frames + maxFrames;
    try {
      while (m.executeMachineFrame() !== FrameTerminationMode.DebugEvent) {
        this.frames++;
        if (this.frames >= limit) {
          throw new Error(`Timed out after ${maxFrames} frames in debug ${action} (PC $${m.pc.toString(16)})`);
        }
      }
      return m.pc;
    } finally {
      ctx.frameTerminationMode = FrameTerminationMode.Normal;
      ctx.debugStepMode = DebugStepMode.NoDebug;
    }
  }

  /** An execution breakpoint */
  breakpoint(address: number): this {
    (this.machine.executionContext.debugSupport ?? this.attachDebugSupport()).addBreakpoint({ address, exec: true });
    return this;
  }

  /** A memory or I/O breakpoint, as the IDE's `bp-set` creates one */
  watch(address: number, access: "memoryRead" | "memoryWrite" | "ioRead" | "ioWrite"): this {
    (this.machine.executionContext.debugSupport ?? this.attachDebugSupport()).addBreakpoint({ address, [access]: true });
    return this;
  }

  // ==========================================================================================
  // Keys and files

  /** Types text as keystrokes (each key 4 frames down, 4 up) and runs until the queue is empty */
  typeKeys(text: string, { settle = 10 }: { settle?: number } = {}): this {
    this.machine.typeText(text);
    this.runUntil(() => this.machine.getKeyQueueLength() === 0, { maxFrames: 20 * text.length + 50 }, "typing");
    return this.runFrames(settle);
  }

  /**
   * Types key chords (`Zx8081KeyCode` numbers pressed together), each held 4 frames and followed by
   * 6 key-free frames - the ROM's debounce needs 4 (see `Zx8081WasmHost.typeText`)
   */
  typeChords(...chords: number[][]): this {
    for (const chord of chords) {
      this.keyDown(...chord).runFrames(4);
      this.keyUp(...chord).runFrames(6);
    }
    return this;
  }

  keyDown(...codes: number[]): this {
    codes.forEach((c) => this.machine.setKeyStatus(c, true));
    return this;
  }

  keyUp(...codes: number[]): this {
    codes.forEach((c) => this.machine.setKeyStatus(c, false));
    return this;
  }

  /** Puts a program file in the deck (fast load by default), as the IDE does */
  insertProgram(file: ZxProgramFile, { fastLoad = true }: { fastLoad?: boolean } = {}): this {
    this.machine.setMachineProperty(FAST_LOAD, fastLoad);
    this.machine.setMachineProperty(MEDIA_TAPE, file);
    return this;
  }

  /** Reads a program file from `_input/zx81-tapes/` (or a path) */
  static readProgram(path: string): ZxProgramFile {
    const full = path.startsWith("/") ? path : join(REPO_ROOT, "_input/zx81-tapes", path);
    const file = parseZxProgramFile(new Uint8Array(readFileSync(full)), full);
    if (!file) throw new Error(`Not a ZX80/ZX81 program: ${path}`);
    return file;
  }

  /**
   * Loads a program as the IDE's tape-load flow does: types the load command and runs until the ROM
   * has finished the load - when the machine queues the auto-RUN. Returns the frames it took. Run
   * frames afterwards for the RUN to be typed. A program saved to run itself never finishes the
   * load this way; use `insertProgram` and type the command instead.
   */
  loadProgram(
    file: ZxProgramFile,
    { fastLoad = true, autoRun = true, maxFrames = 3000 }: { fastLoad?: boolean; autoRun?: boolean; maxFrames?: number } = {}
  ): number {
    this.insertProgram(file, { fastLoad });
    if (autoRun) this.wasm.zx8081ArmAutoRun(1);
    const start = this.frames;
    this.typeKeys(this.machine.hardware.romZx81 ? 'J""\n' : "W\n", { settle: 0 });
    if (autoRun) {
      // --- The machine notices the end of the load itself and queues RUN, which is how this sees it
      this.runUntil(() => this.machine.getKeyQueueLength() > 0, { maxFrames }, "the end of the load");
    } else {
      // --- Until the ROM finishes the load (bytes after E_LINE are never read), then its report
      this.runTo(this.machine.hardware.romZx81 ? ZX81_LOAD_FINISHED : ZX80_LOAD_FINISHED, { maxFrames });
      this.runFrames(50);
    }
    return this.frames - start;
  }

  // ==========================================================================================
  // Memory and screen

  peek(address: number): number {
    return this.machine.doReadMemory(address & 0xffff);
  }

  peekWord(address: number): number {
    return this.peek(address) | (this.peek(address + 1) << 8);
  }

  poke(address: number, values: number | number[] | Uint8Array): this {
    const list = typeof values === "number" ? [values] : Array.from(values);
    list.forEach((v, i) => this.machine.doWriteMemory(address + i, v));
    return this;
  }

  /** The 24 text lines of the display file (inverse characters in brackets, tokens as `{xx}`) */
  screenText(): string[] {
    const charset = this.machine.hasZx81Rom ? ZX81_CHARSET : ZX80_CHARSET;
    const lines: string[] = [];
    let line = "";
    let a = this.peekWord(D_FILE) + 1;
    while (lines.length < 24 && a < 0x10000) {
      const c = this.peek(a++);
      if (c === 0x76) {
        lines.push(line.trimEnd());
        line = "";
        continue;
      }
      const ch = (c & 0x7f) < 0x40 ? charset[c & 0x3f] : `{${c.toString(16)}}`;
      line += c & 0x80 && (c & 0x7f) < 0x40 ? `[${ch}]` : ch;
    }
    return lines;
  }

  get screenWidth(): number {
    return this.machine.screenWidthInPixels;
  }

  get screenHeight(): number {
    return this.machine.screenHeightInPixels;
  }

  /** The last published TV frame, as a copy */
  screenPixels(): Uint32Array {
    return this.machine.getPixelBuffer().slice();
  }

  /** Whether a pixel of the published frame is black (ink or sync) */
  isInk(x: number, y: number): boolean {
    return this.machine.getPixelBuffer()[y * this.screenWidth + x] === 0xff000000;
  }

  /** ASCII art of a window of the picture: `#` ink, `.` paper */
  pixelArt(x: number, y: number, width: number, height: number): string[] {
    const rows: string[] = [];
    for (let yy = y; yy < y + height; yy++) {
      let row = "";
      for (let xx = x; xx < x + width; xx++) row += this.isInk(xx, yy) ? "#" : ".";
      rows.push(row);
    }
    return rows;
  }
}
