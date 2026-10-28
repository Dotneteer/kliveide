import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { MI_TVC } from "@common/machines/constants";
import { connectConditionSupport } from "@emu/machines/conditionStore";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { TvcWasmV2Machine } from "@emu/machines/tvc/TvcWasmV2Machine";
import { TvcKeyCode } from "@emu/machines/tvc/TvcKeyCode";
import { TVC_MODELS } from "@emu/machines/tvc/tvcMachineInfo";
import { parseTvcCasFile, type TvcTapeFile } from "@emu/machines/tvc/TvcCasFile";
import { FAST_LOAD, SAVED_TO_TAPE } from "@emu/machines/machine-props";
import { MEDIA_TAPE } from "@common/structs/project-const";

import { buildTvcWasm, productionOutput } from "../../../scripts/build-tvc-wasm.cjs";

export const REPO_ROOT = join(__dirname, "../../..");
const ROMS = join(REPO_ROOT, "src/public/roms");

/**
 * BASIC 1.2's keyboard-read routine (KB_CHIN, D618h-D62Ch with SYS in page 3): BASIC loops inside it
 * (D61Bh-D61Dh) while it waits for a key at its prompt. A behaviour fact read from the ROM
 * (`.plans/VIDEOTON_TVC_PLAN.md` §0.1).
 */
export const TVC12_KEY_WAIT = 0xd618;
export const TVC12_KEY_WAIT_END = 0xd62d;
/**
 * BASIC 2.2's key wait at its prompt (SYS in page 3): where the ROM was seen looping after its banner
 * (CA9Fh-CAABh). There is no BASIC 2.2 listing in the research pack: this window is observed, not read.
 */
export const TVC22_KEY_WAIT = 0xca9f;
export const TVC22_KEY_WAIT_END = 0xcaac;

export type RunLimit = { maxFrames?: number };
export type TvcSessionOptions = { model?: string };

/** The CRTC as the harness reads it */
export type TvcCrtcState = {
  registers: number[];
  h: number;
  raster: number;
  row: number;
  inAdjust: boolean;
  rowStart: number;
};

class HarnessTvcMachine extends TvcWasmV2Machine {
  constructor(modelId: string) {
    const model = TVC_MODELS.find((m) => m.modelId === modelId);
    if (!model) throw new Error(`Unknown TVC model '${modelId}'`);
    super(MI_TVC, model, undefined, undefined, {
      artifactName: "harness-tvc.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
  }

  /** Reads the shipped file and records it under the path the app's loader uses, for `getRomSources` */
  protected override async loadRomFromResource(romName: string): Promise<Uint8Array> {
    return this.recordLoadedRom(`roms/${romName}.rom`, new Uint8Array(readFileSync(join(ROMS, `${romName}.rom`))));
  }
}

let wasmBuilt = false;

/**
 * Creates a Videoton TVC on the real WASM core with the model's real ROMs, powered on. Builds the
 * core once per test process.
 */
export async function createTvcSession(options: TvcSessionOptions = {}): Promise<TvcTestSession> {
  if (!wasmBuilt) {
    buildTvcWasm();
    wasmBuilt = true;
  }
  const machine = new HarnessTvcMachine(options.model ?? "tvc64");
  await machine.setup();
  return new TvcTestSession(machine);
}

/**
 * Scripts one real Videoton TVC (the WASM core) from a vitest test: boot to BASIC, press keys, run
 * frames, to an address or by instruction, and read memory, the CRTC and the picture. See README.md.
 */
export class TvcTestSession {
  frames = 0;

  constructor(readonly machine: TvcWasmV2Machine) {}

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
    for (let i = 0; i < n; i++) this.wasm.tvcExecuteInstruction();
    return this;
  }

  // ==========================================================================================
  // The debugger, driven as the IDE drives it

  /** Gives the machine a breakpoint store, as the IDE's debug run does */
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

  /**
   * Boots BASIC (1.2 on the 64K, 2.2 on the 64K+) to its prompt. The ROM first tests every RAM page (about 5 seconds, 250 frames),
   * then shows the animated VIDEOTON sign-on (blue paper) and waits for any key; after the key it
   * finishes the animation, clears the screen to black paper and prints its banner and `ok`. The
   * animation reads the keyboard without the key wait (`TVC12_SIGN_ON_LOOP`), so the prompt is: palette
   * 0 black, and the ROM looping in the key wait with SYS in page 3.
   */
  bootToBasic(limit: RunLimit = { maxFrames: 600 }): this {
    this.runUntil(() => this.isShowingSignOn(), limit, "the sign-on screen");
    this.runFrames(10).pressKey(TvcKeyCode.Space);
    this.runUntil(() => this.wasm.tvcGetPalette(0) === 0 && this.isWaitingForKey(), limit, "BASIC's prompt");
    return this.runFrames(3);
  }

  /** Whether the sign-on animation runs: the memory test is over, interrupts are on, four-colour mode */
  isShowingSignOn(): boolean {
    return this.wasm.tvcGetCpuIff1() !== 0 && this.wasm.tvcGetVideoMode() === 1;
  }

  /** Whether the ROM is in its key wait (BASIC 1.2's or 2.2's), with SYS in page 3 */
  isWaitingForKey(): boolean {
    const pc = this.machine.pc;
    const [from, to] =
      this.machine.hardware.romSet === "22" ? [TVC22_KEY_WAIT, TVC22_KEY_WAIT_END] : [TVC12_KEY_WAIT, TVC12_KEY_WAIT_END];
    return pc >= from && pc < to && ((this.wasm.tvcGetPort02() >> 6) & 3) === 1;
  }

  /**
   * Runs at most one frame, stopping where PC reaches `address` with SYS in page 3 (the BASIC ROM's
   * own addresses); returns whether it got there
   */
  passes(address: number): boolean {
    const m = this.machine;
    m.executionContext.frameTerminationMode = FrameTerminationMode.UntilExecutionPoint;
    m.executionContext.terminationPoint = address;
    m.executionContext.debugStepMode = DebugStepMode.NoDebug;
    const reached = m.executeMachineFrame() === FrameTerminationMode.UntilExecutionPoint;
    m.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
    this.frames++;
    return reached && ((this.wasm.tvcGetPort02() >> 6) & 3) === 1;
  }

  // ==========================================================================================
  // Keys

  keyDown(...codes: number[]): this {
    codes.forEach((c) => this.machine.setKeyStatus(c, true));
    return this;
  }

  keyUp(...codes: number[]): this {
    codes.forEach((c) => this.machine.setKeyStatus(c, false));
    return this;
  }

  /** Presses a chord of `TvcKeyCode` keys for `hold` frames, then releases it for `gap` frames */
  pressKey(codes: number | number[], { hold = 3, gap = 3 }: { hold?: number; gap?: number } = {}): this {
    const list = typeof codes === "number" ? [codes] : codes;
    return this.keyDown(...list).runFrames(hold).keyUp(...list).runFrames(gap);
  }

  /**
   * Types text through the machine's typer (`TvcTyper.ts`: each key held 3 frames, released 3) and
   * runs until the queue is empty, then `settle` frames more
   */
  typeKeys(text: string, { settle = 10 }: { settle?: number } = {}): this {
    this.machine.typeText(text);
    this.runUntil(() => this.machine.getKeyQueueLength() === 0, { maxFrames: 8 * text.length + 50 }, "typing");
    return this.runFrames(settle);
  }

  // ==========================================================================================
  // Tape

  /** A tape file from `.cas` bytes, as the IDE reads one (`TvcCasFile.ts`) */
  static tape(bytes: Uint8Array, fileName: string): TvcTapeFile {
    return parseTvcCasFile(bytes, fileName);
  }

  /** Puts a tape in the deck (fast load by default), as the IDE does */
  insertTape(tape: TvcTapeFile, { fastLoad = true }: { fastLoad?: boolean } = {}): this {
    this.machine.setMachineProperty(FAST_LOAD, fastLoad);
    this.machine.setMachineProperty(MEDIA_TAPE, tape);
    return this;
  }

  /** Whether the recorder's motor runs (port 05h bits 7-6) */
  get motorOn(): boolean {
    return this.wasm.tvcTapeGetMotor() !== 0;
  }

  /** The last SAVE the machine published (`SAVED_TO_TAPE`), if any; reading it clears it */
  takeSavedTape(): { name: string; contents: Uint8Array } | undefined {
    const saved = this.machine.getMachineProperty(SAVED_TO_TAPE);
    this.machine.setMachineProperty(SAVED_TO_TAPE, undefined);
    return saved;
  }

  /** Runs until the motor has started and stopped again (a LOAD or SAVE of one file) */
  runWhileMotor({ maxFrames = 3000 }: RunLimit = {}): this {
    this.runUntil(() => this.motorOn, { maxFrames: 200 }, "the motor to start");
    // --- The ROM stops the motor between a file's blocks: wait until it stays off
    let off = 0;
    return this.runUntil(
      () => {
        off = this.motorOn ? 0 : off + 1;
        return off >= 60;
      },
      { maxFrames },
      "the motor to stop"
    );
  }

  // ==========================================================================================
  // Memory, CRTC and picture

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

  /** A byte of the physical memory (`tvcMachineInfo.ts` TVC_PHYS_*) */
  physical(offset: number): number {
    return this.machine.wasmV2Runtime!.memory[offset];
  }

  crtc(): TvcCrtcState {
    const w = this.wasm;
    const counters = w.tvcCrtcGetCounters();
    return {
      registers: Array.from({ length: 18 }, (_, i) => w.tvcCrtcGetRegister(i)),
      h: counters & 0xff,
      raster: (counters >> 8) & 0xff,
      row: (counters >> 16) & 0xff,
      inAdjust: ((counters >> 24) & 1) !== 0,
      rowStart: w.tvcCrtcGetRowStart()
    };
  }

  /** The published picture, as a copy (0xAABBGGRR words, 608 x 288) */
  screenPixels(): Uint32Array {
    return this.machine.getPixelBuffer().slice();
  }
}
