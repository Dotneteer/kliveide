import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { MI_HT1080Z } from "@common/machines/constants";
import { connectConditionSupport } from "@emu/machines/conditionStore";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { Ht1080zWasmV2Machine } from "@emu/machines/ht1080z/Ht1080zWasmV2Machine";
import { Ht1080zKeyCode } from "@emu/machines/ht1080z/Ht1080zKeyCode";
import { HT1080Z_ALL_MODELS, HT1080Z_VIDEO_RAM_START } from "@emu/machines/ht1080z/ht1080zMachineInfo";

import { buildHt1080zWasm, productionOutput } from "../../../scripts/build-ht1080z-wasm.cjs";

export const REPO_ROOT = join(__dirname, "../../..");
const ROMS = join(REPO_ROOT, "src/public/roms");

/** The screen: 16 lines of 64 characters in video RAM */
export const HT_SCREEN_COLUMNS = 64;
export const HT_SCREEN_LINES = 16;

export type RunLimit = { maxFrames?: number };
export type Ht1080zSessionOptions = { model?: string };

class HarnessHt1080zMachine extends Ht1080zWasmV2Machine {
  constructor(modelId: string) {
    const model = HT1080Z_ALL_MODELS.find((m) => m.modelId === modelId);
    if (!model) throw new Error(`Unknown HT-1080Z model '${modelId}'`);
    super(MI_HT1080Z, model, undefined, undefined, {
      artifactName: "harness-ht1080z.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
  }

  protected override async loadRomFromResource(romName: string): Promise<Uint8Array> {
    return new Uint8Array(readFileSync(join(ROMS, `${romName}.rom`)));
  }
}

let wasmBuilt = false;

/**
 * Creates an HT-1080Z on the real WASM core with the model's real ROMs, powered on. Builds the core
 * once per test process.
 */
export async function createHtSession(options: Ht1080zSessionOptions = {}): Promise<Ht1080zTestSession> {
  if (!wasmBuilt) {
    buildHt1080zWasm();
    wasmBuilt = true;
  }
  const machine = new HarnessHt1080zMachine(options.model ?? "ht1080z-s2");
  await machine.setup();
  return new Ht1080zTestSession(machine);
}

/**
 * Scripts one real HT-1080Z (the WASM core) from a vitest test: boot to the prompt, press keys, run
 * frames, to an address or by instruction, and read memory and the screen (video RAM as text). See
 * README.md.
 */
export class Ht1080zTestSession {
  frames = 0;

  constructor(readonly machine: Ht1080zWasmV2Machine) {}

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
    for (let i = 0; i < n; i++) this.wasm.ht1080zExecuteInstruction();
    return this;
  }

  /**
   * Boots to the model's first prompt: `READY ?` on Series I/II (the memory-size question) and
   * `MEMORY SIZE?` on the /64, then answers it with NEW LINE and waits for `READY` and the `>` prompt.
   */
  bootToPrompt(limit: RunLimit = { maxFrames: 600 }): this {
    this.runUntil(() => this.hasFirstPrompt(), limit, "the first prompt");
    this.runFrames(5).pressKey(Ht1080zKeyCode.Enter);
    return this.runUntil(() => this.screenText().some((line) => line.startsWith(">")), limit, "the > prompt");
  }

  /** Whether the screen shows the power-on question (`READY ?` or `MEMORY SIZE?`) */
  hasFirstPrompt(): boolean {
    return this.screenText().some((line) => /^(READY ?\?|MEMORY SIZE\?)/.test(line));
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

  /**
   * Presses a chord of `Ht1080zKeyCode` keys for `hold` frames, then releases it for `gap` frames.
   * The ROM scans the keyboard while it waits for a key; the timing the typer needs is Phase 4's.
   */
  pressKey(...codes: number[]): this {
    return this.keyDown(...codes).runFrames(3).keyUp(...codes).runFrames(3);
  }

  /** The RESET key on the back panel (NMI) */
  pressResetKey(): this {
    this.machine.pressResetKey();
    return this;
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

  /** One video RAM byte: line 0-15, column 0-63 */
  screenCode(line: number, column: number): number {
    return this.peek(HT1080Z_VIDEO_RAM_START + line * HT_SCREEN_COLUMNS + column);
  }

  /**
   * The 16 screen lines from video RAM, trailing spaces trimmed: codes 20h-7Fh as ASCII, others as
   * `{xx}` (the /64's Hungarian set and the semigraphics). The model's character map is Phase 7's.
   *
   * On Series I/II codes 00h-1Fh read as 40h-5Fh: the BASIC's display driver (0471h) stores every
   * letter there - 40h-7Fh folded to 00h-1Fh - and the /64's BASIC removes that fold
   * (`.plans/HT1080Z_PLAN.md` §17, "Phase 2" - an open question against D10).
   */
  screenText(): string[] {
    const foldsLetters = this.machine.hardware.romSet !== "s64";
    const lines: string[] = [];
    for (let line = 0; line < HT_SCREEN_LINES; line++) {
      let text = "";
      for (let column = 0; column < HT_SCREEN_COLUMNS; column++) {
        let c = this.screenCode(line, column);
        if (foldsLetters && c < 0x20) c += 0x40;
        text += c >= 0x20 && c < 0x80 ? String.fromCharCode(c) : `{${c.toString(16).padStart(2, "0")}}`;
      }
      lines.push(text.trimEnd());
    }
    return lines;
  }

  /** The published picture, as a copy */
  screenPixels(): Uint32Array {
    return this.machine.getPixelBuffer().slice();
  }
}
