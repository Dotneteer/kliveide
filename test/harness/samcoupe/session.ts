import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { MC_SAM_DRIVES, MC_SAM_EXTMEM, MC_SAM_MODEL, MC_SAM_ROM, MI_SAM_COUPE } from "@common/machines/constants";
import { connectConditionSupport } from "@emu/machines/conditionStore";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { SamWasmV2Machine } from "@emu/machines/samcoupe/SamWasmV2Machine";
import { SAM_COPYRIGHT_KEY_WAIT } from "@emu/machines/samcoupe/SamWasmHost";
import { SamKeyCode } from "@emu/machines/samcoupe/SamKeyCode";
import { readSamAsicDebugState, readSamSaaDebugState, type SamAsicDebugState, type SamSaaDebugState } from "@emu/machines/samcoupe/SamDebugState";
import { SAM_PHYS_RAM } from "@emu/machines/samcoupe/samMachineInfo";
import { DISK_A_CHANGES, DISK_A_WP, DISK_B_WP, FAST_LOAD } from "@emu/machines/machine-props";
import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_TAPE } from "@common/structs/project-const";
import { DSK_WHOLE_IMAGE_KEY } from "@emu/machines/disk/disk-changes";

import { buildCoreOnce } from "../coreBuild";
import { buildSamWasm, productionOutput } from "../../../dev/scripts/build-sam-wasm.cjs";

export const REPO_ROOT = join(__dirname, "../../..");
const ROMS = join(REPO_ROOT, "src/public/roms");

export type RunLimit = { maxFrames?: number };
export type SamSessionOptions = {
  /** "sam512" (the default) or "sam256" */
  model?: string;
  /** Internal drives, 0-2 (default 1) */
  drives?: number;
  /** A 1 MB external pack */
  extmem?: boolean;
  /** "30" (default) or "31" */
  rom?: string;
};

class HarnessSamMachine extends SamWasmV2Machine {
  constructor(options: SamSessionOptions) {
    const modelId = options.model ?? "sam512";
    const model = { modelId, displayName: modelId, config: { [MC_SAM_MODEL]: modelId === "sam256" ? "256" : "512" } };
    super(
      MI_SAM_COUPE,
      model,
      {
        ...model.config,
        [MC_SAM_DRIVES]: options.drives ?? 1,
        [MC_SAM_EXTMEM]: options.extmem ? 1 : 0,
        [MC_SAM_ROM]: options.rom ?? "30"
      },
      undefined,
      { artifactName: "harness-sam.wasm", readArtifact: async () => readFileSync(productionOutput) }
    );
  }

  /** Reads the shipped file and records it under the path the app's loader uses */
  protected override async loadRomFromResource(romName: string): Promise<Uint8Array> {
    return this.recordLoadedRom(`roms/${romName}.rom`, new Uint8Array(readFileSync(join(ROMS, `${romName}.rom`))));
  }
}

/** Creates a SAM Coupé on the real WASM core with the real ROM, powered on. Builds the core once per process, unless it is current. */
export async function createSamSession(options: SamSessionOptions = {}): Promise<SamTestSession> {
  buildCoreOnce(productionOutput, buildSamWasm);
  const machine = new HarnessSamMachine(options);
  await machine.setup();
  return new SamTestSession(machine);
}

/**
 * Scripts one real SAM Coupé (the WASM core) from a vitest test: boot to the copyright screen and SAM
 * BASIC, press keys, run frames, to an address or by instruction, and read memory, the ASIC and the SAA.
 * See README.md.
 */
export class SamTestSession {
  frames = 0;

  constructor(readonly machine: SamWasmV2Machine) {}

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
    for (let i = 0; i < n; i++) this.wasm.samExecuteInstruction();
    return this;
  }

  /** Runs instructions until PC is `address` or `maxInstructions` pass; returns the T-states it took */
  stepTo(address: number, maxInstructions = 1_000_000): number {
    const start = this.wasm.samGetTacts();
    for (let i = 0; i < maxInstructions; i++) {
      if (this.wasm.samGetCpuPc() === address) return (this.wasm.samGetTacts() - start) >>> 0;
      this.wasm.samExecuteInstruction();
    }
    throw new Error(`PC never reached $${address.toString(16)} in ${maxInstructions} instructions`);
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
  // The ROM

  /** Whether the ROM waits for a key at its copyright screen: PC in its key wait, ROM0 paged in */
  isAtCopyright(): boolean {
    return (this.wasm.samGetLmpr() & 0x20) === 0 && this.wasm.samGetCpuPc() === SAM_COPYRIGHT_KEY_WAIT;
  }

  /**
   * Boots through the memory test to the copyright screen: the ROM's key wait (ROM0 0FA2h), observed by
   * running it. About 190 frames on the 512K model.
   */
  bootToCopyright(limit: RunLimit = { maxFrames: 600 }): this {
    return this.runTo(SAM_COPYRIGHT_KEY_WAIT, limit);
  }

  /** The copyright screen, then a key: SAM BASIC's editor, waiting for input with the screen cleared */
  bootToBasic(limit: RunLimit = { maxFrames: 600 }): this {
    this.bootToCopyright(limit);
    this.runFrames(5).pressKey(SamKeyCode.Space);
    return this.runFrames(60);
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

  /** Types text through the machine's typer (`SamTyper.ts`) and runs until the queue is empty, then `settle` frames */
  typeKeys(text: string, { settle = 10 }: { settle?: number } = {}): this {
    this.machine.typeText(text);
    this.runUntil(() => this.machine.getKeyQueueLength() === 0, { maxFrames: 20 * text.length + 50 }, "typing");
    return this.runFrames(settle);
  }

  /** Presses a chord of `SamKeyCode` keys for `hold` frames, then releases it for `gap` frames */
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

  /** A byte of an internal page (FFh for a page not fitted) */
  page(page: number, offset: number): number {
    return this.wasm.samReadPage(page, offset);
  }

  /** Writes internal page bytes directly (no CPU cycle, no contention) */
  pokePage(page: number, offset: number, values: number | number[] | Uint8Array): this {
    const list = typeof values === "number" ? [values] : Array.from(values);
    list.forEach((v, i) => this.wasm.samWritePage(page + ((offset + i) >> 14), (offset + i) & 0x3fff, v));
    return this;
  }

  /** A word of page 0 (the system variables), little-endian, read through the core's memory */
  sysVarWord(address: number): number {
    return this.page(0, address - 0x4000) | (this.page(0, address - 0x4000 + 1) << 8);
  }

  /** The page allocation table (ALLOCT, 33 bytes at 5100h) */
  alloct(): number[] {
    return Array.from({ length: 33 }, (_, i) => this.page(0, 0x1100 + i));
  }

  /** The physical memory view */
  get memory(): Uint8Array {
    return this.machine.wasmV2Runtime!.memory;
  }

  /** An internal page's bytes as the core holds them */
  pageBytes(page: number): Uint8Array {
    return this.memory.subarray(SAM_PHYS_RAM + page * 0x4000, SAM_PHYS_RAM + (page + 1) * 0x4000);
  }

  // ==========================================================================================
  // Ports, the ASIC and the SAA

  out(port: number, value: number): this {
    this.machine.doWritePort(port, value);
    return this;
  }

  in(port: number): number {
    return this.machine.doReadPort(port);
  }

  asic(): SamAsicDebugState {
    return readSamAsicDebugState(this.wasm as unknown as Parameters<typeof readSamAsicDebugState>[0]);
  }

  saa(): SamSaaDebugState {
    return readSamSaaDebugState(this.wasm as unknown as Parameters<typeof readSamSaaDebugState>[0]);
  }

  /** The picture (640 x 288 RGBA words) */
  pixels(): Uint32Array {
    return this.machine.getPixelBuffer();
  }

  // ==========================================================================================
  // Media

  insertDisk(drive: 0 | 1, image: Uint8Array | undefined, { writeProtected = false } = {}): this {
    this.machine.setMachineProperty(drive === 0 ? DISK_A_WP : DISK_B_WP, writeProtected);
    this.machine.setMachineProperty(drive === 0 ? MEDIA_DISK_A : MEDIA_DISK_B, image);
    return this;
  }

  /** The last whole image the machine published for drive 1 (the guest's writes) */
  publishedDiskA(): Uint8Array | undefined {
    const changes = this.machine.getMachineProperty(DISK_A_CHANGES) as Map<string, Uint8Array> | undefined;
    return changes?.get(DSK_WHOLE_IMAGE_KEY);
  }

  insertTape(tape: unknown, { fastLoad = true }: { fastLoad?: boolean } = {}): this {
    this.machine.setMachineProperty(FAST_LOAD, fastLoad);
    this.machine.setMachineProperty(MEDIA_TAPE, tape);
    return this;
  }
}
