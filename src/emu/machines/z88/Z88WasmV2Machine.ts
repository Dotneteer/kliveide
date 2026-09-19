import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";
import type { BlinkState, CpuState } from "@common/messaging/EmuApi";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import type { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import type { Z88CardSpec } from "./z88CardCatalog";
import type { Z88WasmV2LoaderOptions, Z88WasmV2Runtime } from "./wasm/Z88WasmV2Loader";

import { MC_SCREEN_SIZE, MC_Z88_INTRAM } from "@common/machines/constants";
import { loadZ88WasmV2 } from "./wasm/Z88WasmV2Loader";
import { z88LcdSizeRegisters } from "./z88MachineInfo";
import { z88InternalRamSizeInBytes } from "./z88CardCatalog";
import { Z88WasmHost } from "./Z88WasmHost";

/** The size of a slot's region in the 4 MB physical memory */
const Z88_SLOT_SIZE = 0x10_0000;

/** The size of a bank (a 16K partition) */
const Z88_BANK_SIZE = 0x4000;

/**
 * Thrown by a machine surface the WASM core does not emulate yet. The message names the migration
 * step that adds it (`.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`), so an early caller gets an
 * explicit answer instead of made-up machine state.
 */
export class Z88WasmNotMigratedError extends Error {
  constructor(
    readonly feature: string,
    readonly step: number
  ) {
    super(`The Cambridge Z88 WASM core does not emulate ${feature} yet (migration plan, Step ${step}).`);
    this.name = "Z88WasmNotMigratedError";
  }
}

/**
 * The Cambridge Z88 on the WASM core.
 *
 * Status (Step 2, 2026-09-19): the machine loads its core, sets up and resets it, places the card
 * images of the configured slots into the core's physical memory, sizes the LCD from the
 * configuration and mirrors the CPU registers the core exports. It does not run: the memory map,
 * the frame loop, the Blink, the keyboard, the LCD renderer, the beeper and the card behaviour
 * arrive in Steps 4-10, and until then the surfaces that need them throw `Z88WasmNotMigratedError`.
 *
 * It extends `Z88WasmHost`, never the TypeScript `Z88Machine` - see
 * `test/wasm/z88/wasm-z88-separation.test.ts`.
 */
export class Z88WasmV2Machine extends Z88WasmHost {
  public readonly implementation = "wasm" as const;
  public wasmV2Runtime?: Z88WasmV2Runtime;

  /** The cards the backend holds, by slot (the core's card model arrives in Step 4) */
  private readonly cards: (Z88CardSpec | undefined)[] = [undefined, undefined, undefined, undefined];

  /** The internal RAM (banks $20-$3F), sized by `MC_Z88_INTRAM` as `Z88BankedMemory` sizes it */
  readonly internalRam: Z88CardSpec;

  /** The LCD's part of the pixel buffer, re-created when the LCD size changes */
  private lcdPixels?: Uint32Array;
  private lcdPixelBytes?: Uint8ClampedArray;

  constructor(
    modelInfo?: MachineModel,
    config?: MachineConfigSet,
    messenger?: MessengerBase,
    private readonly wasmV2LoaderOptions?: Z88WasmV2LoaderOptions
  ) {
    super(modelInfo, config, messenger);
    this.internalRam = {
      kind: "RAM",
      sizeInBytes: z88InternalRamSizeInBytes(this.config?.[MC_Z88_INTRAM] ?? 0x1f)
    };

    // --- As the TypeScript machine's constructor does: the Z88 frame length from the start
    this.reset();
  }

  // ==========================================================================================
  // Lifecycle

  /**
   * Loads the core once, and applies the configured LCD size. A freshly loaded core starts the way
   * `Z88BankedMemory` does: a blank 512K ROM card in slot 0, which `setup()` then replaces.
   */
  protected async prepareBackend(): Promise<void> {
    if (this.wasmV2Runtime == null) {
      this.wasmV2Runtime = await loadZ88WasmV2(this.wasmV2LoaderOptions);
      this.insertCardIntoBackend(0, { kind: "ROM", sizeInBytes: 0x08_0000 });
    }
    this.applyLcdSize(this.wasmV2Runtime);
    this.syncCpuFromWasmV2(this.wasmV2Runtime);
  }

  /**
   * Loads the core without setting the machine up: no ROM file is read, slot 0 holds the blank 512K
   * ROM card - the state of a TypeScript `Z88Machine` that was constructed but never set up. The
   * test harness's "blank" machines use it.
   */
  async loadBlankCore(): Promise<void> {
    await this.prepareBackend();
    this.reset();
  }

  /**
   * Power on: the core clears the internal RAM and resets (the cards keep their bytes), then the
   * host sets the machine up again - which re-inserts the cards - and resets.
   */
  override async hardReset(): Promise<void> {
    this.wasmV2Runtime?.exports.z88HardReset();
    await super.hardReset();
  }

  override reset(): void {
    super.reset();
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      runtime.exports.z88Reset();
      this.applyLcdSize(runtime);
      this.syncCpuFromWasmV2(runtime);
    }
  }

  override getCpuState(): CpuState {
    if (this.wasmV2Runtime != null) {
      this.syncCpuFromWasmV2(this.wasmV2Runtime);
    }
    return super.getCpuState();
  }

  /** Does not run yet: the frame loop arrives in Step 5 */
  override executeMachineFrame(): FrameTerminationMode {
    throw new Z88WasmNotMigratedError("the frame loop", 5);
  }

  // ==========================================================================================
  // Cards

  /**
   * Places the card image in the slot's region of the physical memory. The card's behaviour (paging,
   * write protection, EPROM/flash programming, the erased state of a new flash card) is the core's
   * card model, which arrives in Steps 4 and 10.
   */
  protected insertCardIntoBackend(slot: number, card: Z88CardSpec, contents?: Uint8Array): void {
    const runtime = this.requireWasmV2Runtime();
    this.cards[slot] = card;
    if (contents) {
      runtime.memory.set(contents, slot * Z88_SLOT_SIZE);
    }
  }

  /** Takes the card out; its bytes stay in physical memory, as on the TypeScript machine */
  protected removeCardFromBackend(slot: number): void {
    this.cards[slot] = undefined;
  }

  /** The card the backend holds in a slot (undefined when empty) */
  getInsertedCard(slot: number): Z88CardSpec | undefined {
    return this.cards[slot];
  }

  // ==========================================================================================
  // Memory

  /** A byte of the 4 MB physical memory (slot N at N * $100000, internal RAM at $080000) */
  directReadMemory(absAddress: number): number {
    return this.requireWasmV2Runtime().memory[absAddress];
  }

  /** A 16K bank of the physical memory (bank $00-$FF) */
  getMemoryPartition(index: number): Uint8Array {
    const offset = (index & 0xff) * Z88_BANK_SIZE;
    return this.requireWasmV2Runtime().memory.subarray(offset, offset + Z88_BANK_SIZE);
  }

  override doReadMemory(_address: number): number {
    throw new Z88WasmNotMigratedError("the memory map", 4);
  }

  override doWriteMemory(_address: number, _value: number): void {
    throw new Z88WasmNotMigratedError("the memory map", 4);
  }

  get64KFlatMemory(): Uint8Array {
    throw new Z88WasmNotMigratedError("the memory map", 4);
  }

  getCurrentPartitions(): number[] {
    throw new Z88WasmNotMigratedError("the memory map", 4);
  }

  getCurrentPartitionLabels(): string[] {
    throw new Z88WasmNotMigratedError("the memory map", 4);
  }

  // ==========================================================================================
  // Ports, Blink, keyboard, audio

  override doReadPort(_address: number): number {
    throw new Z88WasmNotMigratedError("the Blink ports", 6);
  }

  override doWritePort(_address: number, _value: number): void {
    throw new Z88WasmNotMigratedError("the Blink ports", 6);
  }

  getBlinkState(): BlinkState {
    throw new Z88WasmNotMigratedError("the Blink", 6);
  }

  signalFlapOpened(): void {
    throw new Z88WasmNotMigratedError("the flap", 6);
  }

  signalFlapClosed(): void {
    throw new Z88WasmNotMigratedError("the flap", 6);
  }

  protected raiseBatteryLow(): void {
    throw new Z88WasmNotMigratedError("the battery-low signal", 6);
  }

  setKeyStatus(_key: number, _isDown: boolean): void {
    throw new Z88WasmNotMigratedError("the keyboard", 7);
  }

  getAudioSamples(): AudioSample[] {
    throw new Z88WasmNotMigratedError("the beeper", 9);
  }

  // ==========================================================================================
  // LCD

  get screenWidthInPixels(): number {
    return this.requireWasmV2Runtime().exports.z88GetScreenWidth();
  }

  get screenHeightInPixels(): number {
    return this.requireWasmV2Runtime().exports.z88GetScreenHeight();
  }

  /** The LCD's pixels: the first width x height words of the core's pixel buffer (no copy) */
  getPixelBuffer(): Uint32Array {
    this.requireWasmV2Runtime();
    return this.lcdPixels!;
  }

  /** The LCD's pixels as RGBA bytes, for the renderer's zero-copy path */
  getPixelBufferBytes(): Uint8ClampedArray {
    this.requireWasmV2Runtime();
    return this.lcdPixelBytes!;
  }

  renderInstantScreen(_savedPixelBuffer?: Uint32Array): Uint32Array {
    throw new Z88WasmNotMigratedError("the LCD renderer", 8);
  }

  // ==========================================================================================
  // Helpers

  private applyLcdSize(runtime: Z88WasmV2Runtime): void {
    const { scw, sch } = z88LcdSizeRegisters(this.config?.[MC_SCREEN_SIZE]);
    runtime.exports.z88SetLcdSize(scw, sch);
    const words = runtime.exports.z88GetScreenWidth() * runtime.exports.z88GetScreenHeight();
    if (this.lcdPixels?.length !== words) {
      this.lcdPixels = runtime.pixelBuffer.subarray(0, words);
      this.lcdPixelBytes = runtime.pixelBufferBytes.subarray(0, words * 4);
    }
  }

  /** Mirrors the registers the core exports so far into the TypeScript-visible CPU fields */
  private syncCpuFromWasmV2(runtime: Z88WasmV2Runtime): void {
    const wasm = runtime.exports;
    this.af = wasm.z88GetCpuAf();
    this.bc = wasm.z88GetCpuBc();
    this.de = wasm.z88GetCpuDe();
    this.hl = wasm.z88GetCpuHl();
    this.pc = wasm.z88GetCpuPc();
    this.sp = wasm.z88GetCpuSp();
    this.tacts = wasm.z88GetTacts();
    this.frames = wasm.z88GetFrames();
  }

  private requireWasmV2Runtime(): Z88WasmV2Runtime {
    if (this.wasmV2Runtime == null) {
      throw new Error("The Cambridge Z88 WASM core is not loaded; call setup() first.");
    }
    return this.wasmV2Runtime;
  }
}
