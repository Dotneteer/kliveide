import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { MC_EP_MODEL, MI_ENTERPRISE } from "@common/machines/constants";
import { connectConditionSupport } from "@emu/machines/conditionStore";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { EpWasmV2Machine } from "@emu/machines/enterprise/EpWasmV2Machine";
import { EP_PHYS_VRAM } from "@emu/machines/enterprise/epMachineInfo";
import { EpMemoryFileStore } from "@emu/machines/enterprise/EpHostFs";

import { buildEpWasm, productionOutput } from "../../../scripts/build-ep-wasm.cjs";

export const REPO_ROOT = join(__dirname, "../../..");
const ROMS = join(REPO_ROOT, "src/public/roms");

export type RunLimit = { maxFrames?: number };
export type EpSessionOptions = {
  /** "ep128" (the default) or "ep64" */
  model?: string;
};

/** NICK as the harness reads it */
export type EpNickState = {
  ports: number[];
  lptBase: number;
  lptAddress: number;
  /** The current LPB's bytes */
  lpb: number[];
  ld1: number;
  ld2: number;
  linesLeft: number;
  slot: number;
  line: number;
  displayOn: boolean;
  vsyncOn: boolean;
  mode: number;
  dataBus: number;
};

/** One Line Parameter Block, decoded (`NICK_VIDEO.md` §3.2) */
export type EpLpb = {
  address: number;
  lines: number;
  mode: number;
  colours: number;
  vres: boolean;
  vint: boolean;
  reload: boolean;
  lm: number;
  rm: number;
  ld1: number;
  ld2: number;
  palette: number[];
};

class HarnessEpMachine extends EpWasmV2Machine {
  constructor(modelId: string) {
    const model = { modelId, displayName: modelId, config: { [MC_EP_MODEL]: modelId === "ep64" ? "64" : "128" } };
    super(MI_ENTERPRISE, model, undefined, undefined, {
      artifactName: "harness-ep.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
  }

  /** Reads the shipped file and records it under the path the app's loader uses, for `getRomSources` */
  protected override async loadRomFromResource(romName: string): Promise<Uint8Array> {
    return this.recordLoadedRom(`roms/${romName}.rom`, new Uint8Array(readFileSync(join(ROMS, `${romName}.rom`))));
  }
}

let wasmBuilt = false;

/** Creates an Enterprise on the real WASM core with the model's real ROMs, powered on. Builds the core once per process. */
export async function createEpSession(options: EpSessionOptions = {}): Promise<EpTestSession> {
  if (!wasmBuilt) {
    buildEpWasm();
    wasmBuilt = true;
  }
  const machine = new HarnessEpMachine(options.model ?? "ep128");
  await machine.setup();
  return new EpTestSession(machine);
}

/**
 * Scripts one real Enterprise (the WASM core) from a vitest test: boot to IS-BASIC, press keys, run
 * frames, to an address or by instruction, and read memory, NICK, DAVE and the screen. See README.md.
 */
export class EpTestSession {
  frames = 0;
  /** The FILE: device's files: an in-memory folder (`files.set("GAME.COM", bytes)` puts one in) */
  readonly files = new EpMemoryFileStore();

  constructor(readonly machine: EpWasmV2Machine) {
    machine.hostFileStore = this.files;
  }

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

  /**
   * Runs frames as the IDE's controller does: after each, a FILE: call waiting for the file store is
   * answered (`processFrameCommand`) before the next
   */
  async runFramesWithHost(n: number): Promise<this> {
    for (let i = 0; i < n; i++) {
      this.runFrames(1);
      if (this.machine.getFrameCommand()) await this.machine.processFrameCommand(undefined as never);
    }
    return this;
  }

  /** Types text, then runs `settle` frames answering FILE: calls (`runFramesWithHost`) */
  async typeWithHost(text: string, { settle = 50 }: { settle?: number } = {}): Promise<this> {
    this.machine.typeText(text);
    for (let i = 0; i < 14 * text.length + 50 && this.machine.getKeyQueueLength() > 0; i++) await this.runFramesWithHost(1);
    return this.runFramesWithHost(settle);
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
    for (let i = 0; i < n; i++) this.wasm.epExecuteInstruction();
    return this;
  }

  // ==========================================================================================
  // The debugger, driven as the IDE drives it

  attachDebugSupport(): DebugSupport {
    const debugSupport = new DebugSupport(undefined, []);
    connectConditionSupport(debugSupport, this.machine);
    this.machine.executionContext.debugSupport = debugSupport;
    return debugSupport;
  }

  // ==========================================================================================
  // EXOS and IS-BASIC

  /**
   * Boots EXOS to IS-BASIC's prompt: the RAM test (its "TESTING" line counts the segments down), the
   * ROM scan, then the flashing ENTERPRISE banner with Intelligent Software's copyright, which waits
   * for a key. After the key IS-BASIC takes over and prints its banner and "ok". About 440 frames on
   * the 128 (observed on the core).
   */
  bootToBasic(limit: RunLimit = { maxFrames: 1500 }): this {
    this.runUntil(() => this.isShowingBanner(), limit, "the ENTERPRISE banner");
    this.runFrames(10).pressKey(70);
    this.runUntil(() => this.isAtBasicPrompt(), limit, "IS-BASIC's prompt");
    return this.runFrames(10);
  }

  /** Whether EXOS shows its start-up banner (the copyright line under the graphic) */
  isShowingBanner(): boolean {
    return this.screenText().includes("Intelligent Software Ltd");
  }

  /** Whether IS-BASIC's banner and its "ok" are on the screen */
  isAtBasicPrompt(): boolean {
    const text = this.screenText();
    return text.includes("IS-BASIC") && /^ok$/m.test(text);
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
   * Types text through the machine's typer (`EpTyper.ts`: each key held 3 frames, released 3) and
   * runs until the queue is empty, then `settle` frames more
   */
  typeKeys(text: string, { settle = 10 }: { settle?: number } = {}): this {
    this.machine.typeText(text);
    this.runUntil(() => this.machine.getKeyQueueLength() === 0, { maxFrames: 14 * text.length + 50 }, "typing");
    return this.runFrames(settle);
  }

  /** Presses a chord of `EpKeyCode` keys for `hold` frames, then releases it for `gap` frames */
  pressKey(codes: number | number[], { hold = 4, gap = 4 }: { hold?: number; gap?: number } = {}): this {
    const list = typeof codes === "number" ? [codes] : codes;
    return this.keyDown(...list).runFrames(hold).keyUp(...list).runFrames(gap);
  }

  // ==========================================================================================
  // Memory

  peek(address: number): number {
    return this.machine.doReadMemory(address & 0xffff);
  }

  poke(address: number, values: number | number[] | Uint8Array): this {
    const list = typeof values === "number" ? [values] : Array.from(values);
    list.forEach((v, i) => this.machine.doWriteMemory(address + i, v));
    return this;
  }

  /** A byte of the 4 MB physical space (segment * 4000h + offset); FFh where nothing is fitted */
  physical(address: number): number {
    return this.wasm.epReadPhysical(address);
  }

  /** A byte of NICK's 64K (segments FCh-FFh) */
  vram(address: number): number {
    return this.machine.wasmV2Runtime!.memory[EP_PHYS_VRAM + (address & 0xffff)];
  }

  /** Writes NICK's 64K directly (no CPU cycle, no contention) */
  pokeVram(address: number, values: number | number[]): this {
    const list = typeof values === "number" ? [values] : values;
    const memory = this.machine.wasmV2Runtime!.memory;
    list.forEach((v, i) => (memory[EP_PHYS_VRAM + ((address + i) & 0xffff)] = v & 0xff));
    return this;
  }

  // ==========================================================================================
  // NICK and DAVE

  nick(): EpNickState {
    const w = this.wasm;
    const state = w.epNickGetState();
    return {
      ports: [0, 1, 2, 3].map((i) => w.epNickGetPort(i)),
      lptBase: w.epNickGetLptBase(),
      lptAddress: w.epNickGetLptAddress(),
      lpb: Array.from({ length: 16 }, (_, i) => w.epNickGetLpbByte(i)),
      ld1: w.epNickGetLd1(),
      ld2: w.epNickGetLd2(),
      linesLeft: w.epNickGetLinesLeft(),
      slot: w.epNickGetSlot(),
      line: w.epNickGetLine(),
      displayOn: (state & 1) !== 0,
      vsyncOn: (state & 2) !== 0,
      mode: (state >> 4) & 7,
      dataBus: w.epNickGetDataBus()
    };
  }

  /** An LPB in video RAM, decoded */
  lpbAt(address: number): EpLpb {
    const b = Array.from({ length: 16 }, (_, i) => this.vram(address + i));
    return {
      address,
      lines: 256 - b[0],
      mode: (b[1] >> 1) & 7,
      colours: (b[1] >> 5) & 3,
      vres: (b[1] & 0x10) !== 0,
      vint: (b[1] & 0x80) !== 0,
      reload: (b[1] & 0x01) !== 0,
      lm: b[2] & 0x3f,
      rm: b[3] & 0x3f,
      ld1: b[4] | (b[5] << 8),
      ld2: b[6] | (b[7] << 8),
      palette: b.slice(8)
    };
  }

  /** The LPT from its base to the RELOAD block (at most 64 blocks) */
  lpt(): EpLpb[] {
    const blocks: EpLpb[] = [];
    let address = this.wasm.epNickGetLptBase();
    for (let i = 0; i < 64; i++) {
      const block = this.lpbAt(address);
      blocks.push(block);
      if (block.reload) break;
      address = (address + 16) & 0xffff;
    }
    return blocks;
  }

  /**
   * The text the LPT shows in its character-mode blocks (CH256/CH128/CH64), one string per character
   * row: the codes LD1 points at, as wide as the margins, with bit 7 (ALTIND) dropped. A block whose
   * margins are closed shows nothing.
   */
  screenText(): string {
    const rows: string[] = [];
    for (const block of this.lpt()) {
      if (block.mode < 3 || block.mode > 5 || block.rm <= block.lm) continue;
      const width = block.rm - block.lm;
      let row = "";
      for (let i = 0; i < width; i++) {
        const code = this.vram(block.ld1 + i) & 0x7f;
        row += code >= 0x20 && code < 0x7f ? String.fromCharCode(code) : " ";
      }
      rows.push(row.trimEnd());
    }
    return rows.join("\n");
  }

  dave(): { b4: number; enable: number; latch: number; bf: number; registers: number[] } {
    const w = this.wasm;
    return {
      b4: w.epGetB4(),
      enable: w.epGetIntEnable(),
      latch: w.epGetIntLatch(),
      bf: w.epGetBf(),
      registers: Array.from({ length: 16 }, (_, i) => w.epGetDaveRegister(i))
    };
  }

  /** The published picture, as a copy (0xAABBGGRR words, 736 x 288) */
  screenPixels(): Uint32Array {
    return this.machine.getPixelBuffer().slice();
  }
}
