import { WasmHistorySource } from "../history/WasmHistorySource";
import { WasmProfileSource } from "../profile/WasmProfileSource";
import type { IExecutionHistorySource } from "@emu/abstractions/IExecutionHistorySource";
import type { IAccessProfileSource } from "@emu/abstractions/IAccessProfileSource";
import type { ProfileCounts, ProfileEdge, ProfileInfo, ProfileTouchedByte } from "@common/profile/profileTypes";
import type { ExecutionHistoryInfo, ExecutionHistoryPage } from "@common/history/historyTypes";
import type { HistoryServiceSpan } from "@common/history/serviceSpans";
import { conditionStoreOf, type ConditionStore } from "../conditionStore";
import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";
import type { BlinkState, CpuState } from "@common/messaging/EmuApi";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import type { Z88CardKind, Z88CardSpec } from "./z88CardCatalog";
import type { Z88WasmV2LoaderOptions, Z88WasmV2Runtime } from "./wasm/Z88WasmV2Loader";
import type { Z88Snapshot } from "@common/z88/z88Snapshot";
import type { Z88SnapshotMapping } from "@common/z88/z88SnapshotMapping";
import type { Z88Tim } from "@common/z88/z88Rtc";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { MC_SCREEN_SIZE, MC_Z88_INTRAM } from "@common/machines/constants";
import { AUDIO_SAMPLE_RATE } from "../machine-props";
import {
  hasWasmAccessBreakpoint,
  runWasmDebugLoop,
  type WasmDebugLoopHost,
  shouldStopAtWasmBreakpoint,
  stepOutAddressFromCore
} from "../wasmDebugLoop";
import { loadZ88WasmV2 } from "./wasm/Z88WasmV2Loader";
import { z88LcdSizeRegisters } from "./z88MachineInfo";
import { z88InternalRamSizeInBytes } from "./z88CardCatalog";
import { Z88WasmHost } from "./Z88WasmHost";
import { Z88_INTERNAL_RAM_BANK } from "@common/z88/z88Snapshot";
import { adjustZ88LostTime } from "@common/z88/z88Rtc";
import { createIdeApi } from "@common/messaging/IdeApi";
import { PANE_ID_EMU } from "@common/integration/constants";
import { Z88UartTxLines } from "./z88UartTx";
import {
  captureWasmImage,
  restoreWasmImage,
  type MachineStateParts
} from "../state/wasmStateImage";
import { fillCoreBytes, writeCoreBytes } from "@emu/machines/reverse/coreMemoryWrites";

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

/** Which values and ports of the core's bus record are known (`z88GetBusFlags`, z88-memory.c) */
const BUS_READ_VALUE = 0x01;
const BUS_WRITE_VALUE = 0x02;
const BUS_IO_READ_PORT = 0x04;
const BUS_IO_READ_VALUE = 0x08;
const BUS_IO_WRITE_PORT = 0x10;
const BUS_IO_WRITE_VALUE = 0x20;

/** The beeper's DC filter cut-off (`AudioDeviceBase.DC_FILTER_CUTOFF_HZ`); the core has no `exp` */
const DC_FILTER_CUTOFF_HZ = 1.4;

/** The core's slot index of the internal RAM card (`Z88_INTERNAL_RAM_CARD`, z88-memory.c) */
const INTERNAL_RAM_CARD = 4;

/**
 * Where a bank's bytes live in the 4 MB physical memory: the core's `z88BankOffset` (z88-memory.c).
 *
 * A card smaller than its slot is mirrored across it, so the bank number is masked by the card's chip
 * mask within its slot. Banks $00-$1F are slot 0 and $20-$3F the internal RAM, both 32-bank halves;
 * slots 1-3 are 64 banks each. An empty slot has mask 0, mirroring onto its first bank like the core.
 * @param bank The bank number, $00-$FF
 * @param chipMaskOf The chip mask of a slot (0-3) or of the internal RAM card (4)
 */
export function z88BankStorageOffset(bank: number, chipMaskOf: (slot: number) => number): number {
  const b = bank & 0xff;
  const mask = b >= 0x20 && b <= 0x3f ? chipMaskOf(INTERNAL_RAM_CARD) : chipMaskOf(b >> 6);
  const base = b < 0x40 ? b & 0xe0 : b & 0xc0;
  return (base | (b & mask & 0x3f)) * Z88_BANK_SIZE;
}

/* Local, so the machine does not depend on the renderer's command services */
const toHexa2 = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");

/**
 * The Cambridge Z88 on the WASM core.
 *
 * Status (Step 12, 2026-09-19): the whole machine - the memory map and every card type (RAM, ROM, UV
 * EPROM, Intel and AMD flash with their command states), the CPU frame by frame (one boundary call per
 * normal frame), the Blink (ports, RTC, interrupts, flap and battery), the keyboard and sleep
 * detection, the LCD and the beeper - with the IDE surfaces the TypeScript machine had: the registers
 * (read live from the core, every write pushed into it), the bus record the CPU panel and the memory
 * and I/O breakpoints read, and the debugger (instruction by instruction, or - when the stop policy
 * can only stop at known addresses - the core running on to the next candidate).
 *
 * It is the only Z88 emulation: the TypeScript `Z88Machine` it was held to in lockstep - named in the
 * comments below with its `Z88BankedMemory`, devices and `AudioDeviceBase` beeper - was removed once
 * the core had matched it (`.plans/CAMBRIDGE_Z88_TYPESCRIPT_REMOVAL_PLAN.md`, tag
 * `z88-typescript-last`); its recorded behaviour is in `test/wasm/z88/goldens/`.
 */
export class Z88WasmV2Machine extends Z88WasmHost implements IExecutionHistorySource, IAccessProfileSource {
  // ==============================================================================================
  // Execution history (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md`): the shared recorder in the
  // core, read through the shared reader; the machine id names the context decoder

  get historyMachineId(): string {
    return this.machineId;
  }

  private readonly wasmV2History = new WasmHistorySource(
    () => this.wasmV2Runtime?.exports,
    () => this.historyMachineId
  );

  getHistoryInfo(): ExecutionHistoryInfo | undefined {
    return this.wasmV2History.info();
  }

  readHistory(fromSequence: number, count: number): ExecutionHistoryPage | undefined {
    return this.wasmV2History.read(fromSequence, count);
  }

  getHistoryServiceSpans(): HistoryServiceSpan[] | undefined {
    return this.wasmV2History.serviceSpans();
  }

  clearHistory(): void {
    this.wasmV2History.clear();
  }

  setHistoryEnabled(enabled: boolean): void {
    this.wasmV2History.setEnabled(enabled);
  }

  // ==============================================================================================
  // The access profile (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md`): the shared module in the core,
  // read through the shared reader; the machine id names the layout (`layouts/z88.ts`). Its offsets
  // are physical (`z88Memory`), so a byte is one byte whichever bank or mirror the CPU reached it by.

  get profileMachineId(): string {
    return this.machineId;
  }

  private readonly wasmV2Profile = new WasmProfileSource(
    () => this.wasmV2Runtime?.exports,
    () => this.profileMachineId
  );

  getProfileInfo(): ProfileInfo | undefined {
    return this.wasmV2Profile.info();
  }

  setProfiling(enabled: boolean, counters: boolean): void {
    this.wasmV2Profile.setEnabled(enabled, counters);
  }

  resetProfile(): void {
    this.wasmV2Profile.reset();
  }

  readProfileFlags(start: number, length: number): Uint8Array | undefined {
    return this.wasmV2Profile.flags(start, length);
  }

  readProfileCounts(start: number, length: number): ProfileCounts | undefined {
    return this.wasmV2Profile.counts(start, length);
  }

  readProfileTouched(mask?: number): ProfileTouchedByte[] | undefined {
    return this.wasmV2Profile.touched(mask);
  }

  mergeProfile(bytes: readonly ProfileTouchedByte[], totals: { instructions: number; timeTotal: number }): void {
    this.wasmV2Profile.merge(bytes, totals);
  }

  setProfileCalls(on: boolean): void {
    this.wasmV2Profile.setCalls(on);
  }

  armProfileWindow(start: number | undefined, stop: number | undefined): void {
    this.wasmV2Profile.arm(start, stop);
  }

  readProfileEdges(): ProfileEdge[] | undefined {
    return this.wasmV2Profile.edges();
  }
  /**
   * The profile offset the CPU reaches at an address now (D11): the Z88 names no partition per
   * address, and a small card's mirrors and segment 0's half bank make the bank number alone
   * ambiguous, so the core's own page map answers
   */
  currentProfileOffset(address: number): number | undefined {
    const w = this.wasmV2Runtime?.exports;
    if (!w) return undefined;
    const page = (address >>> 13) & 0x07;
    if (w.z88GetPageCardType(page) === 0) return undefined;
    return w.z88GetPageOffset(page) + (address & 0x1fff);
  }


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

  /** The serial port's TXD bytes, collected into lines for the IDE's output */
  private readonly uartTxLines = new Z88UartTxLines();

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

    // --- As the TypeScript machine's constructor did: the Z88 frame length from the start
    this.reset();
  }

  // ==========================================================================================
  // CPU registers: the core owns them - reads come from it and every write is pushed into it, so a
  // register is never stale, whether or not the frame just run synchronized the mirror

  override get af(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.z88GetCpuAf() : super.af;
  }
  override set af(value: number) {
    super.af = value;
    this.wasmV2Runtime?.exports.z88SetCpuAf(super.af);
  }
  override get bc(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.z88GetCpuBc() : super.bc;
  }
  override set bc(value: number) {
    super.bc = value;
    this.wasmV2Runtime?.exports.z88SetCpuBc(super.bc);
  }
  override get de(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.z88GetCpuDe() : super.de;
  }
  override set de(value: number) {
    super.de = value;
    this.wasmV2Runtime?.exports.z88SetCpuDe(super.de);
  }
  override get hl(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.z88GetCpuHl() : super.hl;
  }
  override set hl(value: number) {
    super.hl = value;
    this.wasmV2Runtime?.exports.z88SetCpuHl(super.hl);
  }
  override get af_(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.z88GetCpuAfAlt() : super.af_;
  }
  override set af_(value: number) {
    super.af_ = value;
    this.wasmV2Runtime?.exports.z88SetCpuAfAlt(super.af_);
  }
  override get bc_(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.z88GetCpuBcAlt() : super.bc_;
  }
  override set bc_(value: number) {
    super.bc_ = value;
    this.wasmV2Runtime?.exports.z88SetCpuBcAlt(super.bc_);
  }
  override get de_(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.z88GetCpuDeAlt() : super.de_;
  }
  override set de_(value: number) {
    super.de_ = value;
    this.wasmV2Runtime?.exports.z88SetCpuDeAlt(super.de_);
  }
  override get hl_(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.z88GetCpuHlAlt() : super.hl_;
  }
  override set hl_(value: number) {
    super.hl_ = value;
    this.wasmV2Runtime?.exports.z88SetCpuHlAlt(super.hl_);
  }
  override get ix(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.z88GetCpuIx() : super.ix;
  }
  override set ix(value: number) {
    super.ix = value;
    this.wasmV2Runtime?.exports.z88SetCpuIx(super.ix);
  }
  override get iy(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.z88GetCpuIy() : super.iy;
  }
  override set iy(value: number) {
    super.iy = value;
    this.wasmV2Runtime?.exports.z88SetCpuIy(super.iy);
  }
  override get ir(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.z88GetCpuIr() : super.ir;
  }
  override set ir(value: number) {
    super.ir = value;
    this.wasmV2Runtime?.exports.z88SetCpuIr(super.ir);
  }
  override get wz(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.z88GetCpuWz() : super.wz;
  }
  override set wz(value: number) {
    super.wz = value;
    this.wasmV2Runtime?.exports.z88SetCpuWz(super.wz);
  }
  override get pc(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.z88GetCpuPc() : super.pc;
  }
  override set pc(value: number) {
    super.pc = value;
    this.wasmV2Runtime?.exports.z88SetCpuPc(super.pc);
  }
  override get sp(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.z88GetCpuSp() : super.sp;
  }
  override set sp(value: number) {
    super.sp = value;
    this.wasmV2Runtime?.exports.z88SetCpuSp(super.sp);
  }

  // --- The 8-bit halves: `Z80Cpu` writes them into its own register views, which the core never
  // --- sees - the IDE's register editor sets them one by one (`setRegisterValue`)
  override get a(): number {
    return this.af >> 8;
  }
  override set a(value: number) {
    this.af = ((value & 0xff) << 8) | (this.af & 0xff);
  }
  override get f(): number {
    return this.af & 0xff;
  }
  override set f(value: number) {
    this.af = (this.af & 0xff00) | (value & 0xff);
  }
  override get b(): number {
    return this.bc >> 8;
  }
  override set b(value: number) {
    this.bc = ((value & 0xff) << 8) | (this.bc & 0xff);
  }
  override get c(): number {
    return this.bc & 0xff;
  }
  override set c(value: number) {
    this.bc = (this.bc & 0xff00) | (value & 0xff);
  }
  override get d(): number {
    return this.de >> 8;
  }
  override set d(value: number) {
    this.de = ((value & 0xff) << 8) | (this.de & 0xff);
  }
  override get e(): number {
    return this.de & 0xff;
  }
  override set e(value: number) {
    this.de = (this.de & 0xff00) | (value & 0xff);
  }
  override get h(): number {
    return this.hl >> 8;
  }
  override set h(value: number) {
    this.hl = ((value & 0xff) << 8) | (this.hl & 0xff);
  }
  override get l(): number {
    return this.hl & 0xff;
  }
  override set l(value: number) {
    this.hl = (this.hl & 0xff00) | (value & 0xff);
  }
  override get xh(): number {
    return this.ix >> 8;
  }
  override set xh(value: number) {
    this.ix = ((value & 0xff) << 8) | (this.ix & 0xff);
  }
  override get xl(): number {
    return this.ix & 0xff;
  }
  override set xl(value: number) {
    this.ix = (this.ix & 0xff00) | (value & 0xff);
  }
  override get yh(): number {
    return this.iy >> 8;
  }
  override set yh(value: number) {
    this.iy = ((value & 0xff) << 8) | (this.iy & 0xff);
  }
  override get yl(): number {
    return this.iy & 0xff;
  }
  override set yl(value: number) {
    this.iy = (this.iy & 0xff00) | (value & 0xff);
  }
  override get i(): number {
    return this.ir >> 8;
  }
  override set i(value: number) {
    this.ir = ((value & 0xff) << 8) | (this.ir & 0xff);
  }
  override get r(): number {
    return this.ir & 0xff;
  }
  override set r(value: number) {
    this.ir = (this.ir & 0xff00) | (value & 0xff);
  }
  override get iff1(): boolean {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.z88GetCpuIff1() !== 0 : super.iff1;
  }
  override set iff1(value: boolean) {
    super.iff1 = value;
    this.wasmV2Runtime?.exports.z88SetCpuIff1(value ? 1 : 0);
  }
  override get iff2(): boolean {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.z88GetCpuIff2() !== 0 : super.iff2;
  }
  override set iff2(value: boolean) {
    super.iff2 = value;
    this.wasmV2Runtime?.exports.z88SetCpuIff2(value ? 1 : 0);
  }
  override get interruptMode(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.z88GetCpuInterruptMode() : super.interruptMode;
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
   * a constructed `Z88Machine` did: the internal RAM sized by `MC_Z88_INTRAM`, a blank 512K ROM
   * card in slot 0 (which `setup()` then replaces), the Blink in its power-on state (SR0-SR3 page
   * bank 0) and a reset. The reset button alone leaves the Blink as it is.
   */
  protected async prepareBackend(): Promise<void> {
    if (this.wasmV2Runtime == null) {
      this.wasmV2Runtime = await loadZ88WasmV2(this.wasmV2LoaderOptions);
      this.wasmV2Runtime.exports.z88SetInternalRamSize(this.internalRam.sizeInBytes);
      this.insertCardIntoBackend(0, { kind: "ROM", sizeInBytes: 0x08_0000 });
      this.wasmV2Runtime.exports.z88ResetBlink();
      this.reset();
    }
    this.applyLcdSize(this.wasmV2Runtime);
    this.syncCpuFromWasmV2(this.wasmV2Runtime);
  }

  /**
   * Loads the core without setting the machine up: no ROM file is read, slot 0 holds the blank 512K
   * ROM card - the state a TypeScript `Z88Machine` had when constructed but never set up. The
   * test harness's "blank" machines use it.
   */
  async loadBlankCore(): Promise<void> {
    await this.prepareBackend();
    this.reset();
  }

  /**
   * Power on: the core clears every RAM (internal and RAM cards) and resets the Blink and the CPU;
   * ROM, EPROM and flash keep their bytes. Then the host sets the machine up again - inserting only
   * the cards that changed - and resets.
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
    this.flushUartTx(runtime);
    // --- A reverse-debugging stop target can end the call mid-frame (REVERSE_DEBUGGING_PLAN D4)
    this.frameCompleted = runtime.exports.z88GetFrameCompleted() !== 0;
    this.executionContext.lastTerminationReason = FrameTerminationMode.Normal;
    return FrameTerminationMode.Normal;
  }

  /**
   * The debug path: one instruction at a time until the frame completes or a stop condition holds.
   * The shape and the stop order are the other WASM machines' (`ZxSpectrum48WasmV2Machine`).
   */
  /** The debug loop's hooks, built once per core instance: a stable object lets the JIT inline them */
  private wasmV2DebugLoopHost?: { runtime: Z88WasmV2Runtime; host: WasmDebugLoopHost };

  private executeWasmV2DebugLoop(runtime: Z88WasmV2Runtime): FrameTerminationMode {
    const cached = this.wasmV2DebugLoopHost;
    if (cached?.runtime !== runtime) {
      this.wasmV2DebugLoopHost = { runtime, host: this.createWasmV2DebugLoopHost(runtime) };
    }
    return runWasmDebugLoop(this.wasmV2DebugLoopHost!.host);
  }

  private createWasmV2DebugLoopHost(runtime: Z88WasmV2Runtime): WasmDebugLoopHost {
    const wasm = runtime.exports;
    const self = this;
    return {
      get executionContext() {
        return self.executionContext;
      },
      get frameCompleted() {
        return self.frameCompleted;
      },
      set frameCompleted(value: boolean) {
        self.frameCompleted = value;
      },
      get pc() {
        return self.pc;
      },
      get stepOutAddress() {
        return self.stepOutAddress;
      },
      getFrameCommand: () => this.getFrameCommand(),
      enter: () => {
        // --- The core starts the new frame itself, at its next instruction
        if (this.frameCompleted) {
          this.frameCompleted = false;
        }
        this.syncCpuFromWasmV2(runtime);
        this.emulateKeystroke();
        this.syncTargetClockMultiplier(runtime);
        return undefined;
      },
      // --- The instruction export returns whether the frame completed
      executeInstruction: () => wasm.z88ExecuteInstruction() !== 0,
      // --- The core's own loop runs to the next place the stop policy may stop at (z80-debug-loop.c)
      executeUntilStop: (extraStop, mask) => wasm.z88ExecuteUntilStop(extraStop, mask),
      pushBreakpointFlags: (flags) => runtime.breakpointFlags.set(flags),
      coreFrameCompleted: () => wasm.z88GetFrameCompleted() !== 0,
      // --- Past this class's `pc` setter, which would push the value just read from the core back into it
      mirrorPc: () => {
        const pc = wasm.z88GetCpuPc();
        this.setPcMirror(pc);
        return pc;
      },
      historyStopReached: () => wasm.z80HistoryCheckStop() !== 0,
      importBusAccess: () => this.importWasmV2BusAccess(runtime),
      hasAccessBreakpoint: () => this.hasWasmV2AccessBreakpoint(),
      shouldStopAtBreakpoint: (instructionsExecuted) => this.shouldStopAtWasmV2Breakpoint(instructionsExecuted),
      finish: (termination) => this.finishWasmV2DebugLoop(termination)
    };
  }

  /** The single exit of the debug loop: the TypeScript-visible state catches up with the core */
  private finishWasmV2DebugLoop(termination: FrameTerminationMode): FrameTerminationMode {
    const runtime = this.requireWasmV2Runtime();
    this.syncCpuFromWasmV2(runtime);
    this.importWasmV2BusAccess(runtime);
    this.flushUartTx(runtime);
    this.executionContext.lastTerminationReason = termination;
    return termination;
  }

  /** Where a step-out lands: the top of the core's shadow stack of return addresses */
  /** Interrupt handlers running now, from the core's shadow stack (source stepping, plan §10.2.7). */
  override getInterruptDepth(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.z88GetInterruptDepth() : super.getInterruptDepth();
  }

  override markStepOutAddress(): void {
    this.stepOutAddress = stepOutAddressFromCore(this.requireWasmV2Runtime().exports.z88GetStepOutAddress());
  }

  private shouldStopAtWasmV2Breakpoint(instructionsExecuted: number): boolean {
    return shouldStopAtWasmBreakpoint(
      this,
      instructionsExecuted,
      () => this.sp,
      () => ({ af: this.af, bc: this.bc, de: this.de, hl: this.hl })
    );
  }

  private hasWasmV2AccessBreakpoint(): boolean {
    // --- The Z88's bus record holds addresses only: a condition's `VAL` reads memory now
    return hasWasmAccessBreakpoint(
      this.executionContext.debugSupport,
      this,
      (address) => this.getPartition(address),
      this.conditionAccessValues(this.lastMemoryReads, this.lastMemoryReadsCount),
      this.conditionAccessValues(this.lastMemoryWrites, this.lastMemoryWritesCount)
    );
  }

  /**
   * Copies the core's bus record into the fields `Z80Cpu` keeps: the eight-entry address lists with
   * their counts, the last values, and the last ports - undefined where the TypeScript CPU has not
   * set one (see z88-memory.c for the rules).
   */
  /**
   * The byte at each accessed address, for a condition's `VAL`. The Z88 core records addresses and
   * only the *last* value, so this reads memory now: exact for a write (memory holds what was
   * written), and for a read unless the same instruction wrote the address afterwards
   * (`INC (HL)`). Asked only while an access breakpoint is set.
   */
  private conditionAccessValues(addresses: ArrayLike<number>, count: number): number[] {
    const w = this.requireWasmV2Runtime().exports;
    const values: number[] = [];
    for (let i = 0; i < count; i++) values.push(w.z88ReadMemory(addresses[i] & 0xffff));
    return values;
  }

  private importWasmV2BusAccess(runtime: Z88WasmV2Runtime): void {
    const w = runtime.exports;
    for (let i = 0; i < 8; i++) {
      this.lastMemoryReads[i] = w.z88GetBusReadAddress(i);
      this.lastMemoryWrites[i] = w.z88GetBusWriteAddress(i);
    }
    this.lastMemoryReadsCount = w.z88GetBusReadCount();
    this.lastMemoryWritesCount = w.z88GetBusWriteCount();
    const flags = w.z88GetBusFlags();
    this.lastMemoryReadValue = flags & BUS_READ_VALUE ? w.z88GetBusReadValue() : undefined;
    this.lastMemoryWriteValue = flags & BUS_WRITE_VALUE ? w.z88GetBusWriteValue() : undefined;
    this.lastIoReadPort = flags & BUS_IO_READ_PORT ? w.z88GetBusIoReadPort() : undefined;
    this.lastIoReadValue = flags & BUS_IO_READ_VALUE ? w.z88GetBusIoReadValue() : undefined;
    this.lastIoWritePort = flags & BUS_IO_WRITE_PORT ? w.z88GetBusIoWritePort() : undefined;
    this.lastIoWriteValue = flags & BUS_IO_WRITE_VALUE ? w.z88GetBusIoWriteValue() : undefined;
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
      writeCoreBytes(runtime, runtime.memory, contents, slot * Z88_SLOT_SIZE);
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
  // Snapshots

  /**
   * Captures the machine's whole state: the core's memory image plus this wrapper's own fields
   * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.5). The machine must be paused.
   */
  saveMachineState(): MachineStateParts {
    const runtime = this.requireWasmV2Runtime();
    return {
      ...captureWasmImage("z88", runtime.module, runtime.exports.memory.buffer),
      host: this.captureHostState()
    };
  }

  // ------------------------------------------------------------------------------------------------
  // Reverse debugging (`.plans/REVERSE_DEBUGGING_PLAN.md` §4.2, `reverse/Timeline.ts`)

  /** The core, as the export contract names it */
  get reverseCoreId(): string {
    return "z88";
  }

  get reverseRuntime(): Z88WasmV2Runtime | undefined {
    return this.wasmV2Runtime;
  }

  readonly reverseFrameExport = "z88ExecuteFrame";

  isAtFrameBoundary(): boolean {
    return this.wasmV2Runtime?.exports.z88GetFrameCompleted() !== 0;
  }

  /** The wrapper's own fields: what a state file and a keyframe keep besides the image */
  captureHostState(): Record<string, unknown> {
    return { cards: this.cards.map((c) => (c ? { ...c } : null)) };
  }

  /**
   * After the core changed under the wrapper (a replay, a return to the present, T7): the wrapper's
   * fields from `state`, the mirrors re-read from the core. Nothing is pushed - the cards' contents
   * are in the image - and queued keystrokes and audio of the replaced run go.
   */
  restoreHostState(state: unknown): void {
    const runtime = this.requireWasmV2Runtime();
    const host = (state ?? {}) as { cards?: (Z88CardSpec | null)[] };
    (host.cards ?? []).forEach((card, slot) => {
      if (slot < this.cards.length) this.cards[slot] = card ? { ...card } : undefined;
    });
    this.wasmV2AudioSamples.length = 0;
    this.emulatedKeyStrokes.length = 0;
    // --- Serial output a replay produced was shown when the live run produced it
    runtime.exports.z88ClearUartTx();
    this.frameCompleted = runtime.exports.z88GetFrameCompleted() !== 0;
    this.syncFrameCountersFromWasmV2(runtime);
    this.syncCpuFromWasmV2(runtime);
  }

  /** Forgets what was last pushed into the core, so the next frame pushes the live state (D8) */
  invalidateHostSync(): void {
    this.syncedTargetClockMultiplier = -1;
  }

  /**
   * Puts the machine back into a saved state; the host-side caches are invalidated so the next
   * frame pushes the live host's settings. Queued work of the run being replaced is dropped.
   * @throws MachineStateMismatchError when the state was saved by another core or layout
   */
  loadMachineState(parts: MachineStateParts): void {
    const runtime = this.requireWasmV2Runtime();
    restoreWasmImage(parts, "z88", runtime.module, runtime.exports.memory.buffer);
    const host = parts.host as { cards?: (Z88CardSpec | null)[] };
    (host.cards ?? []).forEach((card, slot) => {
      if (slot < this.cards.length) this.cards[slot] = card ?? undefined;
    });
    this.wasmV2AudioSamples.length = 0;
    this.syncedTargetClockMultiplier = -1;
    this.adoptConfiguredSlots();
    // --- The RTC stays as saved (D20); the audio rate is the live host's
    this.syncAudioSampleRate(runtime);
    this.syncFrameCountersFromWasmV2(runtime);
    this.syncCpuFromWasmV2(runtime);
  }


  /**
   * Replaces the whole machine state with a `.z88` snapshot's (`.plans/Z88_SNAPSHOT_PLAN.md` §4.4).
   *
   * The machine is reset first, as OZvm resets the Blink and wipes memory before a load: that clears
   * what the snapshot does not store (HALT, the keyboard matrix, EPR, a snooze, sleep, queued keys).
   * Then the cards go in - slot 0 included, replacing the configured ROM in the core only - and the
   * Blink and the CPU are restored, with the RTC advanced by the time the file spent on disk.
   *
   * The machine's configuration is not touched: the caller rebuilds the machine first when the
   * internal RAM size differs, and records the cards (§4.5).
   * @param snapshot The parsed snapshot
   * @param mapping Its mapping to Klive cards; it must have no errors
   * @param nowMs The host time, for the RTC catch-up
   * @returns TIM0..TIM4 as restored, after the catch-up
   * @throws When the mapping has errors, or the internal RAM differs from this machine's
   */
  loadSnapshotState(snapshot: Z88Snapshot, mapping: Z88SnapshotMapping, nowMs: number): Z88Tim {
    if (mapping.errors.length > 0) {
      throw new Error(`The snapshot cannot be loaded: ${mapping.errors.join("; ")}`);
    }
    if (snapshot.ram.length !== this.internalRam.sizeInBytes) {
      throw new Error(
        `The snapshot has ${snapshot.ram.length / 1024}K internal RAM, the machine ` +
          `${this.internalRam.sizeInBytes / 1024}K`
      );
    }
    const runtime = this.requireWasmV2Runtime();
    const w = runtime.exports;

    // --- A clean machine, with no stale bytes of a card the snapshot does not have
    this.reset();
    w.z88ResetBlink();
    fillCoreBytes(runtime, runtime.memory, 0);

    // --- Cards, then the internal RAM (banks $20-$3F, at $080000)
    for (let slot = 0; slot < 4; slot++) {
      const card = mapping.slots[slot];
      if (card) {
        this.insertCardIntoBackend(slot, card.spec, card.bytes);
      } else {
        this.removeCardFromBackend(slot);
      }
    }
    writeCoreBytes(runtime, runtime.memory, snapshot.ram, Z88_INTERNAL_RAM_BANK * Z88_BANK_SIZE);
    // --- A later card change or hard reset keeps the snapshot's cards and what they hold
    this.adoptConfiguredSlots();

    // --- The Blink. COM first: SR0's paging depends on COM.RAMS, and COM.RESTIM clears TIM.
    const blink = snapshot.blink;
    w.z88SetCom(blink.com);
    blink.sr.forEach((bank, index) => w.z88SetSr(index, bank));
    w.z88SetInt(blink.int);
    w.z88SetSta(blink.sta);
    w.z88SetTmk(blink.tmk);
    w.z88SetTsta(blink.tsta);
    blink.pb.forEach((value, index) => w.z88SetPb(index, value));
    w.z88SetSbf(blink.sbf);
    const tim = adjustZ88LostTime(blink.tim, snapshot.stoppedAt, nowMs);
    tim.forEach((value, index) => w.z88SetTim(index, value));

    // --- The CPU
    const cpu = snapshot.cpu;
    w.z88SetCpuAf(cpu.af);
    w.z88SetCpuBc(cpu.bc);
    w.z88SetCpuDe(cpu.de);
    w.z88SetCpuHl(cpu.hl);
    w.z88SetCpuAfAlt(cpu.af_);
    w.z88SetCpuBcAlt(cpu.bc_);
    w.z88SetCpuDeAlt(cpu.de_);
    w.z88SetCpuHlAlt(cpu.hl_);
    w.z88SetCpuIx(cpu.ix);
    w.z88SetCpuIy(cpu.iy);
    w.z88SetCpuIr((cpu.i << 8) | cpu.r);
    w.z88SetCpuIff1(cpu.iff1 ? 1 : 0);
    w.z88SetCpuIff2(cpu.iff2 ? 1 : 0);
    w.z88SetCpuInterruptMode(cpu.im);
    w.z88SetCpuSp(cpu.sp);
    w.z88SetCpuPc(cpu.pc);

    // --- The picture the snapshot holds, before the first frame (a debug stop is seen at once)
    w.z88DrawLcd();

    this.syncCpuFromWasmV2(runtime);
    return tim;
  }

  // ==========================================================================================
  // Memory

  /** A byte of the 4 MB physical memory (slot N at N * $100000, internal RAM at $080000) */
  directReadMemory(absAddress: number): number {
    return this.requireWasmV2Runtime().memory[absAddress];
  }

  /**
   * A 16K bank (bank $00-$FF) as the CPU sees it when the bank is paged in.
   *
   * A card smaller than its slot is mirrored across the slot, so a bank number does not name its own
   * storage: with a 32K card in slot 2, bank $BF is bank $81's storage. Reading `bank * 16K` showed the
   * never-used (all-zero) storage of the mirror instead of the code the CPU runs.
   */
  getMemoryPartition(index: number): Uint8Array {
    const exports = this.requireWasmV2Runtime().exports;
    const offset = z88BankStorageOffset(index, (slot) => exports.z88GetSlotChipMask(slot));
    return this.requireWasmV2Runtime().memory.subarray(offset, offset + Z88_BANK_SIZE);
  }

  /**
   * The raw storage at bank index `index` of the 4 MB physical memory, with no card mirroring:
   * what a whole-memory digest hashes. The IDE wants `getMemoryPartition`.
   */
  getPhysicalBank(index: number): Uint8Array {
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
   * The 64K the CPU sees, for the memory and disassembly views: each 8K page is copied from the
   * physical offset the core itself reads it from (`z88GetPageOffset`). That offset already carries
   * card mirroring and the half of SR0's bank that an odd SR0 selects; recomputing it from the bank
   * numbers showed zeros for any bank of a card smaller than its slot.
   */
  get64KFlatMemory(): Uint8Array {
    const runtime = this.requireWasmV2Runtime();
    const flat = new Uint8Array(0x1_0000);
    for (let page = 0; page < 8; page++) {
      const offset = runtime.exports.z88GetPageOffset(page);
      flat.set(runtime.memory.subarray(offset, offset + 0x2000), page * 0x2000);
    }
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

  /**
   * Sends the bytes the Z88 wrote to TXD ($E3) since the last frame to the IDE's emulator output, a
   * line at a time (OZvm echoes them to its runtime message panel). One boundary call when there are
   * none.
   */
  private flushUartTx(runtime: Z88WasmV2Runtime): void {
    const w = runtime.exports;
    // --- A reverse-debugging replay re-sends what the IDE has shown already (REVERSE_DEBUGGING_PLAN
    // --- D13): emptied, not shown. The buffer is volatile, so emptying it is not an input.
    if (this.executionContext.isReplayingHistory?.()) {
      w.z88ClearUartTx();
      return;
    }
    const count = w.z88GetUartTxCount();
    if (count === 0) return;
    const bytes = new Uint8Array(w.memory.buffer, w.z88UartTxPtr(), count).slice();
    w.z88ClearUartTx();
    const lines = this.uartTxLines.push(bytes);
    if (lines.length === 0 || !this.messenger) return;
    void createIdeApi(this.messenger)
      .displayOutputBatch(
        lines.map((text) => ({ pane: PANE_ID_EMU, text: `[Z88 serial] ${text}`, foreground: "bright-cyan", writeLine: true }))
      )
      .catch(() => {
        // --- The output is a debugging aid; a lost line must not stop the machine
      });
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
      SBF: w.z88GetSbf(),
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
   * and wakes a CPU snoozed by a KBD read, as `Z88KeyboardDevice.setKeyStatus` did.
   */
  setKeyStatus(key: number, isDown: boolean): void {
    this.requireWasmV2Runtime().exports.z88SetKeyStatus(key, isDown ? 1 : 0);
  }

  /**
   * The current frame's samples, read from the core's double buffer - the same numbers the
   * TypeScript beeper produced. The array and its objects are reused, as `AudioDeviceBase` reuses its.
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

  /** The glass around the LCD: unlit green, or grey once the LCD was painted off (see `IAnyMachine`) */
  getScreenSurroundColor(): number {
    return this.requireWasmV2Runtime().exports.z88GetLcdSurroundColor() >>> 0;
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

  /** `Z88Machine.reset` handed the beeper the sample rate when the machine property holds one */
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
  /**
   * The core's breakpoint condition evaluator: its program store. The shared C evaluator reads the
   * registers and memory inside the core (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md`).
   */
  getConditionStore(): ConditionStore | undefined {
    return this.wasmV2Runtime ? conditionStoreOf(this.wasmV2Runtime) : undefined;
  }


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
    // --- The Breakpoints panel reads these without asking for the CPU state first
    this.opStartAddress = w.z88GetOpStartAddress();
    this.sigINT = w.z88GetCpuSigInt() !== 0;
  }

  private requireWasmV2Runtime(): Z88WasmV2Runtime {
    if (this.wasmV2Runtime == null) {
      throw new Error("The Cambridge Z88 WASM core is not loaded; call setup() first.");
    }
    return this.wasmV2Runtime;
  }
}
