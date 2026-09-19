import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";
import type { BlinkState, CpuState } from "@common/messaging/EmuApi";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import type { Z88CardKind, Z88CardSpec } from "./z88CardCatalog";
import type { Z88WasmV2LoaderOptions, Z88WasmV2Runtime } from "./wasm/Z88WasmV2Loader";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { MC_SCREEN_SIZE, MC_Z88_INTRAM } from "@common/machines/constants";
import { AUDIO_SAMPLE_RATE } from "../machine-props";
import { shouldStopAtDebugPoint } from "../DebugStepDecision";
import { loadZ88WasmV2 } from "./wasm/Z88WasmV2Loader";
import { z88LcdSizeRegisters } from "./z88MachineInfo";
import { z88InternalRamSizeInBytes } from "./z88CardCatalog";
import { Z88WasmHost } from "./Z88WasmHost";

/** The size of a slot's region in the 4 MB physical memory */
const Z88_SLOT_SIZE = 0x10_0000;

/** The size of a bank (a 16K partition) */
const Z88_BANK_SIZE = 0x4000;

/** The core's card kind codes (`z88-memory.c`) */
const CARD_KIND_CODES: Record<Z88CardKind, number> = {
  RAM: 1,
  ROM: 2,
  UV_EPROM: 3,
  INTEL_FLASH: 4,
  AMD_FLASH_29F040B: 5,
  AMD_FLASH_29F080B: 6
};

/** The beeper's DC filter cut-off (`AudioDeviceBase.DC_FILTER_CUTOFF_HZ`); the core has no `exp` */
const DC_FILTER_CUTOFF_HZ = 1.4;

/* Local, so the machine does not depend on the renderer's command services */
const toHexa2 = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");

/**
 * The Cambridge Z88 on the WASM core.
 *
 * Status (Step 9, 2026-09-19): the core emulates the memory map and RAM/ROM cards, runs the CPU frame
 * by frame (one boundary call per normal frame; instruction by instruction when debugging), the
 * Blink (ports, RTC, interrupts, flap and battery), the keyboard and sleep detection, the LCD and the
 * beeper. EPROM and flash cards read like ROM cards: their programming (Step 10) is not migrated,
 * so the core ignores writes to them.
 *
 * It extends `Z88WasmHost`, never the TypeScript `Z88Machine` - see
 * `test/wasm/z88/wasm-z88-separation.test.ts`.
 */
export class Z88WasmV2Machine extends Z88WasmHost {
  public readonly implementation = "wasm" as const;
  public wasmV2Runtime?: Z88WasmV2Runtime;

  /** The cards the backend holds, by slot */
  private readonly cards: (Z88CardSpec | undefined)[] = [undefined, undefined, undefined, undefined];

  /** The internal RAM (banks $20-$3F), sized by `MC_Z88_INTRAM` as `Z88BankedMemory` sizes it */
  readonly internalRam: Z88CardSpec;

  /** The LCD's part of the pixel buffer, re-created when the LCD size changes */
  private lcdPixels?: Uint32Array;
  private lcdPixelBytes?: Uint8ClampedArray;

  /** The frame's audio samples, reused from frame to frame */
  private readonly wasmV2AudioSamples: AudioSample[] = [];

  /** The clock multiplier last handed to the core */
  private syncedTargetClockMultiplier = -1;

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
  // CPU registers: the core owns them; every write is pushed into it

  override get af(): number {
    return super.af;
  }
  override set af(value: number) {
    super.af = value;
    this.wasmV2Runtime?.exports.z88SetCpuAf(super.af);
  }
  override get bc(): number {
    return super.bc;
  }
  override set bc(value: number) {
    super.bc = value;
    this.wasmV2Runtime?.exports.z88SetCpuBc(super.bc);
  }
  override get de(): number {
    return super.de;
  }
  override set de(value: number) {
    super.de = value;
    this.wasmV2Runtime?.exports.z88SetCpuDe(super.de);
  }
  override get hl(): number {
    return super.hl;
  }
  override set hl(value: number) {
    super.hl = value;
    this.wasmV2Runtime?.exports.z88SetCpuHl(super.hl);
  }
  override get af_(): number {
    return super.af_;
  }
  override set af_(value: number) {
    super.af_ = value;
    this.wasmV2Runtime?.exports.z88SetCpuAfAlt(super.af_);
  }
  override get bc_(): number {
    return super.bc_;
  }
  override set bc_(value: number) {
    super.bc_ = value;
    this.wasmV2Runtime?.exports.z88SetCpuBcAlt(super.bc_);
  }
  override get de_(): number {
    return super.de_;
  }
  override set de_(value: number) {
    super.de_ = value;
    this.wasmV2Runtime?.exports.z88SetCpuDeAlt(super.de_);
  }
  override get hl_(): number {
    return super.hl_;
  }
  override set hl_(value: number) {
    super.hl_ = value;
    this.wasmV2Runtime?.exports.z88SetCpuHlAlt(super.hl_);
  }
  override get ix(): number {
    return super.ix;
  }
  override set ix(value: number) {
    super.ix = value;
    this.wasmV2Runtime?.exports.z88SetCpuIx(super.ix);
  }
  override get iy(): number {
    return super.iy;
  }
  override set iy(value: number) {
    super.iy = value;
    this.wasmV2Runtime?.exports.z88SetCpuIy(super.iy);
  }
  override get ir(): number {
    return super.ir;
  }
  override set ir(value: number) {
    super.ir = value;
    this.wasmV2Runtime?.exports.z88SetCpuIr(super.ir);
  }
  override get wz(): number {
    return super.wz;
  }
  override set wz(value: number) {
    super.wz = value;
    this.wasmV2Runtime?.exports.z88SetCpuWz(super.wz);
  }
  override get pc(): number {
    return super.pc;
  }
  override set pc(value: number) {
    super.pc = value;
    this.wasmV2Runtime?.exports.z88SetCpuPc(super.pc);
  }
  override get sp(): number {
    return super.sp;
  }
  override set sp(value: number) {
    super.sp = value;
    this.wasmV2Runtime?.exports.z88SetCpuSp(super.sp);
  }
  override get iff1(): boolean {
    return super.iff1;
  }
  override set iff1(value: boolean) {
    super.iff1 = value;
    this.wasmV2Runtime?.exports.z88SetCpuIff1(value ? 1 : 0);
  }
  override get iff2(): boolean {
    return super.iff2;
  }
  override set iff2(value: boolean) {
    super.iff2 = value;
    this.wasmV2Runtime?.exports.z88SetCpuIff2(value ? 1 : 0);
  }
  override get interruptMode(): number {
    return super.interruptMode;
  }
  override set interruptMode(value: number) {
    super.interruptMode = value;
    this.wasmV2Runtime?.exports.z88SetCpuInterruptMode(value);
  }

  override setTacts(value: number): void {
    super.setTacts(value);
    this.wasmV2Runtime?.exports.z88SetTacts(value >>> 0);
  }

  override isCpuSnoozed(): boolean {
    return this.wasmV2Runtime != null ? this.wasmV2Runtime.exports.z88GetCpuSnoozed() !== 0 : super.isCpuSnoozed();
  }

  override snoozeCpu(): void {
    super.snoozeCpu();
    this.wasmV2Runtime?.exports.z88SetCpuSnoozed(1);
  }

  override awakeCpu(): void {
    super.awakeCpu();
    this.wasmV2Runtime?.exports.z88SetCpuSnoozed(0);
  }

  // ==========================================================================================
  // Lifecycle

  /**
   * Loads the core once, and applies the configured LCD size. A freshly loaded core starts the way
   * a constructed `Z88Machine` does: the internal RAM sized by `MC_Z88_INTRAM`, a blank 512K ROM
   * card in slot 0 (which `setup()` then replaces), and a reset (which pages SR0-SR3 to bank 0).
   */
  protected async prepareBackend(): Promise<void> {
    if (this.wasmV2Runtime == null) {
      this.wasmV2Runtime = await loadZ88WasmV2(this.wasmV2LoaderOptions);
      this.wasmV2Runtime.exports.z88SetInternalRamSize(this.internalRam.sizeInBytes);
      this.insertCardIntoBackend(0, { kind: "ROM", sizeInBytes: 0x08_0000 });
      this.reset();
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
      this.syncTargetClockMultiplier(runtime);
      runtime.exports.z88Reset();
      this.syncAudioSampleRate(runtime);
      this.applyLcdSize(runtime);
      this.syncCpuFromWasmV2(runtime);
    }
  }

  override getCpuState(): CpuState {
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      this.syncCpuFromWasmV2(runtime);
      this.importWasmV2BusAccess(runtime);
    }
    return super.getCpuState();
  }

  // ==========================================================================================
  // Running

  /**
   * Runs a frame. A normal frame is one call into the core; debugging, stepping and running to an
   * execution point go instruction by instruction, with the stop policy in TypeScript.
   */
  override executeMachineFrame(): FrameTerminationMode {
    const runtime = this.requireWasmV2Runtime();
    if (
      this.executionContext.debugStepMode !== DebugStepMode.NoDebug ||
      this.executionContext.frameTerminationMode !== FrameTerminationMode.Normal
    ) {
      return this.executeWasmV2DebugLoop(runtime);
    }

    this.emulateKeystroke();
    this.syncTargetClockMultiplier(runtime);
    runtime.exports.z88ExecuteFrame();
    this.syncFrameCountersFromWasmV2(runtime);
    this.frameCompleted = true;
    this.executionContext.lastTerminationReason = FrameTerminationMode.Normal;
    return FrameTerminationMode.Normal;
  }

  /**
   * The debug path: one instruction at a time until the frame completes or a stop condition holds.
   * The shape and the stop order are the other WASM machines' (`ZxSpectrum48WasmV2Machine`).
   */
  private executeWasmV2DebugLoop(runtime: Z88WasmV2Runtime): FrameTerminationMode {
    const wasm = runtime.exports;
    const debugSupport = this.executionContext.debugSupport;
    let instructionsExecuted = 0;
    this.executionContext.lastTerminationReason = undefined;

    // --- The core starts the new frame itself, at its next instruction
    if (this.frameCompleted) {
      this.frameCompleted = false;
    }
    this.syncCpuFromWasmV2(runtime);
    this.emulateKeystroke();
    this.syncTargetClockMultiplier(runtime);

    const watchesBusAccess = debugSupport?.hasAccessBreakpoints() ?? false;

    if (debugSupport && this.pc !== debugSupport.lastStartupBreakpoint) {
      if (this.shouldStopAtWasmV2Breakpoint(instructionsExecuted)) {
        return this.finishWasmV2DebugLoop(FrameTerminationMode.DebugEvent);
      }
    }
    if (debugSupport) {
      debugSupport.lastStartupBreakpoint = undefined;
    }

    while (!this.frameCompleted) {
      this.frameCompleted = wasm.z88ExecuteInstruction() !== 0;
      instructionsExecuted++;

      // --- Through `super`: the value was just read from the core, so it need not be pushed back
      super.pc = wasm.z88GetCpuPc();
      if (watchesBusAccess) {
        this.importWasmV2BusAccess(runtime);
      }

      if (this.executionContext.frameTerminationMode === FrameTerminationMode.UntilExecutionPoint) {
        const point = this.executionContext.terminationPoint;
        if (point != null && this.pc === (point & 0xffff)) {
          return this.finishWasmV2DebugLoop(FrameTerminationMode.UntilExecutionPoint);
        }
      }
      if (watchesBusAccess && this.hasWasmV2AccessBreakpoint()) {
        return this.finishWasmV2DebugLoop(FrameTerminationMode.DebugEvent);
      }
      if (this.shouldStopAtWasmV2Breakpoint(instructionsExecuted)) {
        return this.finishWasmV2DebugLoop(FrameTerminationMode.DebugEvent);
      }
      if (this.executionContext.debugStepMode === DebugStepMode.StepInto) {
        debugSupport && (debugSupport.imminentBreakpoint = undefined);
        return this.finishWasmV2DebugLoop(FrameTerminationMode.DebugEvent);
      }
      if (this.getFrameCommand()) {
        return this.finishWasmV2DebugLoop(FrameTerminationMode.Normal);
      }
    }

    return this.finishWasmV2DebugLoop(FrameTerminationMode.Normal);
  }

  /** The single exit of the debug loop: the TypeScript-visible state catches up with the core */
  private finishWasmV2DebugLoop(termination: FrameTerminationMode): FrameTerminationMode {
    const runtime = this.requireWasmV2Runtime();
    this.syncCpuFromWasmV2(runtime);
    this.importWasmV2BusAccess(runtime);
    this.executionContext.lastTerminationReason = termination;
    return termination;
  }

  /** Where a step-out lands: the top of the core's shadow stack of return addresses */
  override markStepOutAddress(): void {
    const address = this.requireWasmV2Runtime().exports.z88GetStepOutAddress();
    this.stepOutAddress = address === 0xffffffff ? -1 : address;
  }

  private shouldStopAtWasmV2Breakpoint(instructionsExecuted: number): boolean {
    const debugSupport = this.executionContext.debugSupport;
    if (!debugSupport) return false;
    return shouldStopAtDebugPoint({
      debugSupport,
      debugStepMode: this.executionContext.debugStepMode,
      pc: this.pc,
      instructionsExecuted,
      getPartition: (address) => this.getPartition(address),
      getCallInstructionLength: () => this.getCallInstructionLength(),
      stepOutAddress: this.stepOutAddress,
      // --- The core's shadow stack gives the exact step-out target; see ZxSpectrum48WasmV2Machine
      retExecuted: false
    });
  }

  private hasWasmV2AccessBreakpoint(): boolean {
    const debugSupport = this.executionContext.debugSupport;
    if (!debugSupport) return false;
    return (
      debugSupport.hasMemoryRead(this.lastMemoryReads, this.lastMemoryReadsCount, (addr) => this.getPartition(addr)) ||
      debugSupport.hasMemoryWrite(this.lastMemoryWrites, this.lastMemoryWritesCount, (addr) => this.getPartition(addr)) ||
      debugSupport.hasIoRead(this.lastIoReadPort) ||
      debugSupport.hasIoWrite(this.lastIoWritePort)
    );
  }

  private importWasmV2BusAccess(runtime: Z88WasmV2Runtime): void {
    const wasm = runtime.exports;
    this.lastMemoryReadsCount = 0;
    this.lastMemoryWritesCount = 0;
    this.lastIoReadPort = undefined;
    this.lastIoWritePort = undefined;

    const memoryAddress = wasm.z88GetLastMemoryAddress();
    const memoryValue = wasm.z88GetLastMemoryValue();
    if (wasm.z88GetLastMemoryIsWrite() !== 0) {
      this.lastMemoryWrites[this.lastMemoryWritesCount++] = memoryAddress;
      this.lastMemoryWriteValue = memoryValue;
    } else if (memoryAddress !== 0 || memoryValue !== 0) {
      this.lastMemoryReads[this.lastMemoryReadsCount++] = memoryAddress;
      this.lastMemoryReadValue = memoryValue;
    }

    const portAddress = wasm.z88GetLastPortAddress();
    const portValue = wasm.z88GetLastPortValue();
    if (wasm.z88GetLastPortIsWrite() !== 0) {
      this.lastIoWritePort = portAddress;
      this.lastIoWriteValue = portValue;
    } else if (portAddress !== 0 || portValue !== 0) {
      this.lastIoReadPort = portAddress;
      this.lastIoReadValue = portValue;
    }
  }

  // ==========================================================================================
  // Cards

  /**
   * Inserts a card: the core pages it in and erases an EPROM or flash card ($FF), then the card image
   * (if any) is copied into the slot - the order of `Z88BankedMemory.insertCard`.
   */
  protected insertCardIntoBackend(slot: number, card: Z88CardSpec, contents?: Uint8Array): void {
    const runtime = this.requireWasmV2Runtime();
    this.cards[slot] = card;
    runtime.exports.z88InsertCard(slot, CARD_KIND_CODES[card.kind], card.sizeInBytes);
    if (contents) {
      runtime.memory.set(contents, slot * Z88_SLOT_SIZE);
    }
  }

  /** Takes the card out; its bytes stay in physical memory, as on the TypeScript machine */
  protected removeCardFromBackend(slot: number): void {
    this.cards[slot] = undefined;
    this.wasmV2Runtime?.exports.z88RemoveCard(slot);
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

  /** Reads through the current paging, as `Z88BankedMemory.readMemory` (an empty slot reads random) */
  override doReadMemory(address: number): number {
    return this.requireWasmV2Runtime().exports.z88ReadMemory(address & 0xffff);
  }

  /** Writes through the current paging, as `Z88BankedMemory.writeMemory` */
  override doWriteMemory(address: number, value: number): void {
    this.requireWasmV2Runtime().exports.z88WriteMemory(address & 0xffff, value & 0xff);
  }

  /**
   * The 64K the CPU sees, for the memory view. Like `Z88BankedMemory.get64KFlatMemory`, each part is
   * read from the start of its page's bank (for an odd SR0 the $2000-$3FFF part shows the bank's
   * lower half - kept for parity).
   */
  get64KFlatMemory(): Uint8Array {
    const memory = this.requireWasmV2Runtime().memory;
    const banks = this.getCurrentPartitions();
    const flat = new Uint8Array(0x1_0000);
    const copy = (target: number, bank: number, length: number) =>
      flat.set(memory.subarray(bank * Z88_BANK_SIZE, bank * Z88_BANK_SIZE + length), target);
    copy(0x0000, banks[0], 0x2000);
    copy(0x2000, banks[1], 0x2000);
    copy(0x4000, banks[2], 0x4000);
    copy(0x8000, banks[4], 0x4000);
    copy(0xc000, banks[6], 0x4000);
    return flat;
  }

  /** The bank mapped into each 8K page */
  getCurrentPartitions(): number[] {
    const wasm = this.requireWasmV2Runtime().exports;
    return [0, 1, 2, 3, 4, 5, 6, 7].map((page) => wasm.z88GetPageBank(page));
  }

  getCurrentPartitionLabels(): string[] {
    return this.getCurrentPartitions().map((bank) => toHexa2(bank));
  }

  // ==========================================================================================
  // Ports and the Blink

  override doReadPort(address: number): number {
    return this.requireWasmV2Runtime().exports.z88ReadPort(address & 0xffff);
  }

  override doWritePort(address: number, value: number): void {
    this.requireWasmV2Runtime().exports.z88WritePort(address & 0xffff, value & 0xff);
  }

  /** The Blink panel's state, from the core (see `IZ88IdeMachine`) */
  getBlinkState(): BlinkState {
    const runtime = this.requireWasmV2Runtime();
    const w = runtime.exports;
    return {
      SR0: w.z88GetSr(0),
      SR1: w.z88GetSr(1),
      SR2: w.z88GetSr(2),
      SR3: w.z88GetSr(3),
      TIM0: w.z88GetTim(0),
      TIM1: w.z88GetTim(1),
      TIM2: w.z88GetTim(2),
      TIM3: w.z88GetTim(3),
      TIM4: w.z88GetTim(4),
      TSTA: w.z88GetTsta(),
      TMK: w.z88GetTmk(),
      INT: w.z88GetInt(),
      STA: w.z88GetSta(),
      COM: w.z88GetCom(),
      EPR: w.z88GetEpr(),
      keyLines: Array.from(runtime.keyboardLines),
      oscBit: w.z88GetOscillatorBit() !== 0,
      earBit: w.z88GetEarBit() !== 0,
      PB0: w.z88GetPb(0),
      PB1: w.z88GetPb(1),
      PB2: w.z88GetPb(2),
      PB3: w.z88GetPb(3),
      SBR: w.z88GetSbr(),
      SCW: w.z88GetScw(),
      SCH: w.z88GetSch()
    };
  }

  signalFlapOpened(): void {
    this.requireWasmV2Runtime().exports.z88SignalFlapOpened();
  }

  signalFlapClosed(): void {
    this.requireWasmV2Runtime().exports.z88SignalFlapClosed();
  }

  protected raiseBatteryLow(): void {
    this.requireWasmV2Runtime().exports.z88RaiseBatteryLow();
  }

  // ==========================================================================================
  // Keyboard and beeper

  /**
   * Sets a key's state in the core's matrix; a pressed key raises the key interrupt (when enabled)
   * and wakes a CPU snoozed by a KBD read, as `Z88KeyboardDevice.setKeyStatus` does.
   */
  setKeyStatus(key: number, isDown: boolean): void {
    this.requireWasmV2Runtime().exports.z88SetKeyStatus(key, isDown ? 1 : 0);
  }

  /**
   * The current frame's samples, read from the core's double buffer - the same numbers the
   * TypeScript beeper produces. The array and its objects are reused, as `AudioDeviceBase` reuses its.
   */
  getAudioSamples(): AudioSample[] {
    const runtime = this.requireWasmV2Runtime();
    const values = runtime.audioSamples;
    const count = runtime.exports.z88GetAudioSampleCount();
    const samples = this.wasmV2AudioSamples;
    for (let i = 0; i < count; i++) {
      const sample = samples[i];
      if (sample) {
        sample.left = values[i * 2];
        sample.right = values[i * 2 + 1];
      } else {
        samples.push({ left: values[i * 2], right: values[i * 2 + 1] });
      }
    }
    samples.length = count;
    return samples;
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

  /** The core renders the LCD at the start of every 8th frame; the current picture is the answer */
  renderInstantScreen(_savedPixelBuffer?: Uint32Array): Uint32Array {
    return this.getPixelBuffer();
  }

  /** The LCD's pixels as RGBA bytes, for the renderer's zero-copy path */
  getPixelBufferBytes(): Uint8ClampedArray {
    this.requireWasmV2Runtime();
    return this.lcdPixelBytes!;
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

  /** `Z88Machine.reset` hands the beeper the sample rate when the machine property holds one */
  private syncAudioSampleRate(runtime: Z88WasmV2Runtime): void {
    const rate = this.getMachineProperty(AUDIO_SAMPLE_RATE);
    if (typeof rate === "number" && rate > 0) {
      runtime.exports.z88SetAudioSampleRate(rate, Math.exp((-2 * Math.PI * DC_FILTER_CUTOFF_HZ) / rate));
    }
  }

  private syncTargetClockMultiplier(runtime: Z88WasmV2Runtime): void {
    if (this.targetClockMultiplier !== this.syncedTargetClockMultiplier) {
      runtime.exports.z88SetTargetClockMultiplier(this.targetClockMultiplier);
      this.syncedTargetClockMultiplier = this.targetClockMultiplier;
    }
  }

  /**
   * Mirrors the core's CPU and frame state into the TypeScript-visible fields. Assignments go
   * through `super`, so the values just read from the core are not pushed back into it.
   */
  private syncCpuFromWasmV2(runtime: Z88WasmV2Runtime): void {
    const w = runtime.exports;
    super.af = w.z88GetCpuAf();
    super.bc = w.z88GetCpuBc();
    super.de = w.z88GetCpuDe();
    super.hl = w.z88GetCpuHl();
    super.af_ = w.z88GetCpuAfAlt();
    super.bc_ = w.z88GetCpuBcAlt();
    super.de_ = w.z88GetCpuDeAlt();
    super.hl_ = w.z88GetCpuHlAlt();
    super.ix = w.z88GetCpuIx();
    super.iy = w.z88GetCpuIy();
    super.ir = w.z88GetCpuIr();
    super.wz = w.z88GetCpuWz();
    super.pc = w.z88GetCpuPc();
    super.sp = w.z88GetCpuSp();
    super.iff1 = w.z88GetCpuIff1() !== 0;
    super.iff2 = w.z88GetCpuIff2() !== 0;
    super.interruptMode = w.z88GetCpuInterruptMode();
    this.halted = w.z88GetCpuHalted() !== 0;
    this.opCode = w.z88GetCpuPrefix();
    this.syncFrameCountersFromWasmV2(runtime);
  }

  /** The cheap subset a normal frame needs: PC and the frame counters */
  private syncFrameCountersFromWasmV2(runtime: Z88WasmV2Runtime): void {
    const w = runtime.exports;
    super.pc = w.z88GetCpuPc();
    this.tacts = w.z88GetTacts();
    this.frames = w.z88GetFrames();
    this.clockMultiplier = w.z88GetClockMultiplier();
    this.tactsInCurrentFrame = w.z88GetTactsInCurrentFrame();
    this.frameTacts = w.z88GetFrameTacts();
    this.currentFrameTact = Math.floor(this.frameTacts / this.clockMultiplier);
    this.isInSleepMode = w.z88GetSleepMode() !== 0;
  }

  private requireWasmV2Runtime(): Z88WasmV2Runtime {
    if (this.wasmV2Runtime == null) {
      throw new Error("The Cambridge Z88 WASM core is not loaded; call setup() first.");
    }
    return this.wasmV2Runtime;
  }
}
