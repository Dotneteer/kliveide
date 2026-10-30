import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";
import type { CpuState } from "@common/messaging/EmuApi";
import type { EpWasmV2LoaderOptions, EpWasmV2Runtime } from "./wasm/EpWasmV2Loader";

import type { IExecutionHistorySource } from "@emu/abstractions/IExecutionHistorySource";
import type { IAccessProfileSource } from "@emu/abstractions/IAccessProfileSource";
import type { ProfileCounts, ProfileEdge, ProfileInfo, ProfileTouchedByte } from "@common/profile/profileTypes";
import type { ExecutionHistoryInfo, ExecutionHistoryPage } from "@common/history/historyTypes";
import type { HistoryServiceSpan } from "@common/history/serviceSpans";

import { WasmHistorySource } from "../history/WasmHistorySource";
import { WasmProfileSource } from "../profile/WasmProfileSource";
import { conditionStoreOf, type ConditionStore } from "../conditionStore";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import {
  hasWasmAccessBreakpoint,
  runWasmDebugLoop,
  type WasmDebugLoopHost,
  shouldStopAtWasmBreakpoint,
  stepOutAddressFromCore
} from "../wasmDebugLoop";
import { importAccessLog } from "../wasmAccessLog";
import { captureWasmImage, restoreWasmImage, type MachineStateParts } from "../state/wasmStateImage";
import { fillCoreBytes, writeCoreBytes } from "@emu/machines/reverse/coreMemoryWrites";
import { loadEpWasmV2 } from "./wasm/EpWasmV2Loader";
import { EpWasmHost } from "./EpWasmHost";
import { EP_ROM_SETS } from "./EpRoms";
import { EP_PHYS_UNMAPPED, EP_PIXEL_ASPECT, EP_ROM_CART, EP_SEGMENT_SIZE } from "./epMachineInfo";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import { AUDIO_SAMPLE_RATE } from "../machine-props";

/** The DC filter's cut-off, as the other cores' (`AudioDeviceBase.DC_FILTER_CUTOFF_HZ`); the core has no `exp` */
const DC_FILTER_CUTOFF_HZ = 1.4;

/**
 * An Enterprise 64/128 on the WASM core (`wasm/ep/`, `.plans/ENTERPRISE_PLAN.md`): one core for both
 * models, configured by the model at setup.
 *
 * The registers are read live from the core and every write is pushed into it; the debugger runs
 * instruction by instruction, or - when the stop policy can only stop at known addresses - the core
 * runs on to the next candidate, exactly as on the TVC.
 *
 * The core carries the shared execution-history recorder and access profile, and its whole state is
 * its linear memory: state files and reverse debugging save and restore that image.
 */
export class EpWasmV2Machine extends EpWasmHost implements IExecutionHistorySource, IAccessProfileSource {
  // ==============================================================================================
  // Execution history: the shared recorder in the core, read through the shared reader; the
  // machine id names the context decoder (`contexts/epContext.ts`, Phase 7)

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
  // The access profile: the shared module in the core; both models share one layout
  // (`layouts/ep.ts`, Phase 7)

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

  public readonly implementation = "wasm" as const;
  public wasmV2Runtime?: EpWasmV2Runtime;

  private screenPixels?: Uint32Array;
  private screenPixelBytes?: Uint8ClampedArray;
  /** The current frame's samples; the array and its objects are reused, as the HT-1080Z's are */
  private readonly wasmV2AudioSamples: AudioSample[] = [];

  constructor(
    machineId: string,
    modelInfo?: MachineModel,
    config?: MachineConfigSet,
    messenger?: MessengerBase,
    private readonly wasmV2LoaderOptions?: EpWasmV2LoaderOptions
  ) {
    super(machineId, modelInfo, config, messenger);
    this.reset();
  }

  // ==========================================================================================
  // CPU registers: the core owns them

  private get w() {
    return this.wasmV2Runtime?.exports;
  }

  override get af(): number {
    return this.w ? this.w.epGetCpuAf() : super.af;
  }
  override set af(value: number) {
    super.af = value;
    this.w?.epSetCpuAf(super.af);
  }
  override get bc(): number {
    return this.w ? this.w.epGetCpuBc() : super.bc;
  }
  override set bc(value: number) {
    super.bc = value;
    this.w?.epSetCpuBc(super.bc);
  }
  override get de(): number {
    return this.w ? this.w.epGetCpuDe() : super.de;
  }
  override set de(value: number) {
    super.de = value;
    this.w?.epSetCpuDe(super.de);
  }
  override get hl(): number {
    return this.w ? this.w.epGetCpuHl() : super.hl;
  }
  override set hl(value: number) {
    super.hl = value;
    this.w?.epSetCpuHl(super.hl);
  }
  override get af_(): number {
    return this.w ? this.w.epGetCpuAfAlt() : super.af_;
  }
  override set af_(value: number) {
    super.af_ = value;
    this.w?.epSetCpuAfAlt(super.af_);
  }
  override get bc_(): number {
    return this.w ? this.w.epGetCpuBcAlt() : super.bc_;
  }
  override set bc_(value: number) {
    super.bc_ = value;
    this.w?.epSetCpuBcAlt(super.bc_);
  }
  override get de_(): number {
    return this.w ? this.w.epGetCpuDeAlt() : super.de_;
  }
  override set de_(value: number) {
    super.de_ = value;
    this.w?.epSetCpuDeAlt(super.de_);
  }
  override get hl_(): number {
    return this.w ? this.w.epGetCpuHlAlt() : super.hl_;
  }
  override set hl_(value: number) {
    super.hl_ = value;
    this.w?.epSetCpuHlAlt(super.hl_);
  }
  override get ix(): number {
    return this.w ? this.w.epGetCpuIx() : super.ix;
  }
  override set ix(value: number) {
    super.ix = value;
    this.w?.epSetCpuIx(super.ix);
  }
  override get iy(): number {
    return this.w ? this.w.epGetCpuIy() : super.iy;
  }
  override set iy(value: number) {
    super.iy = value;
    this.w?.epSetCpuIy(super.iy);
  }
  override get ir(): number {
    return this.w ? this.w.epGetCpuIr() : super.ir;
  }
  override set ir(value: number) {
    super.ir = value;
    this.w?.epSetCpuIr(super.ir);
  }
  override get wz(): number {
    return this.w ? this.w.epGetCpuWz() : super.wz;
  }
  override set wz(value: number) {
    super.wz = value;
    this.w?.epSetCpuWz(super.wz);
  }
  override get pc(): number {
    return this.w ? this.w.epGetCpuPc() : super.pc;
  }
  override set pc(value: number) {
    super.pc = value;
    this.w?.epSetCpuPc(super.pc);
  }
  override get sp(): number {
    return this.w ? this.w.epGetCpuSp() : super.sp;
  }
  override set sp(value: number) {
    super.sp = value;
    this.w?.epSetCpuSp(super.sp);
  }

  // --- The 8-bit halves go through the pairs: `Z80Cpu` keeps them in views the core never sees
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
    return this.w ? this.w.epGetCpuIff1() !== 0 : super.iff1;
  }
  override set iff1(value: boolean) {
    super.iff1 = value;
    this.w?.epSetCpuIff1(value ? 1 : 0);
  }
  override get iff2(): boolean {
    return this.w ? this.w.epGetCpuIff2() !== 0 : super.iff2;
  }
  override set iff2(value: boolean) {
    super.iff2 = value;
    this.w?.epSetCpuIff2(value ? 1 : 0);
  }
  override get interruptMode(): number {
    return this.w ? this.w.epGetCpuInterruptMode() : super.interruptMode;
  }
  override set interruptMode(value: number) {
    super.interruptMode = value;
    this.w?.epSetCpuInterruptMode(value);
  }

  override setTacts(value: number): void {
    super.setTacts(value);
    this.w?.epSetTacts(value >>> 0);
  }

  // ==========================================================================================
  // Lifecycle

  /** Loads the core (once), configures the model, uploads its ROMs and powers the machine on */
  async setup(): Promise<void> {
    if (this.wasmV2Runtime == null) {
      this.wasmV2Runtime = await loadEpWasmV2(this.wasmV2LoaderOptions);
    }
    const runtime = this.wasmV2Runtime;
    const hw = this.hardware;
    const romSet = EP_ROM_SETS[hw.romSet];
    const exos = await this.loadRomFromResource(romSet.exos.name);
    fillCoreBytes(runtime, runtime.exosRom, 0xff);
    writeCoreBytes(runtime, runtime.exosRom, exos.subarray(0, romSet.exos.size));
    fillCoreBytes(runtime, runtime.cartRom, 0xff);
    if (hw.cartridge) {
      const basic = await this.loadRomFromResource(romSet.basic.name);
      writeCoreBytes(runtime, runtime.cartRom, basic.subarray(0, romSet.basic.size));
    }
    fillCoreBytes(runtime, runtime.fileIoRom, 0xff);
    fillCoreBytes(runtime, runtime.exdosRom, 0xff);
    runtime.exports.epConfigure(hw.is128 ? 1 : 0, hw.cartridge ? EP_ROM_CART : 0);
    const words = runtime.exports.epGetScreenWidth() * runtime.exports.epGetScreenHeight();
    this.screenPixels = runtime.pixelBuffer.subarray(0, words);
    this.screenPixelBytes = runtime.pixelBufferBytes.subarray(0, words * 4);
    this.baseClockFrequency = runtime.exports.epGetBaseClockFrequency();
    this.setTactsInFrame(runtime.exports.epGetTactsInFrame());
    runtime.exports.epHardReset();
    this.syncAudioSampleRate(runtime);
    this.syncCpuFromWasmV2(runtime);
  }

  override setMachineProperty(key: string, value?: any): void {
    super.setMachineProperty(key, value);
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return;
    if (key === AUDIO_SAMPLE_RATE) this.syncAudioSampleRate(runtime);
  }

  // ==========================================================================================
  // Sound (`.plans/ENTERPRISE_PLAN.md` §8, `wasm/ep/ep-audio.c`)

  /** The host's audio rate (`AUDIO_SAMPLE_RATE`) and the DC filter's coefficient for it */
  private syncAudioSampleRate(runtime: EpWasmV2Runtime): void {
    const rate = this.getMachineProperty(AUDIO_SAMPLE_RATE);
    if (typeof rate === "number" && rate > 0) {
      runtime.exports.epSetAudioSampleRate(rate, Math.exp((-2 * Math.PI * DC_FILTER_CUTOFF_HZ) / rate));
    }
  }

  /** The current frame's samples, read from the core's buffer */
  getAudioSamples(): AudioSample[] {
    const runtime = this.requireWasmV2Runtime();
    const values = runtime.audioSamples;
    const count = runtime.exports.epGetAudioSampleCount();
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

  /** Power on: the RAM cleared and every register reset */
  override hardReset(): void {
    super.hardReset();
    this.reset();
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      runtime.exports.epHardReset();
      this.syncCpuFromWasmV2(runtime);
    }
  }

  override reset(): void {
    super.reset();
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      runtime.exports.epReset();
      this.syncCpuFromWasmV2(runtime);
    }
  }

  override getCpuState(): CpuState {
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      this.syncCpuFromWasmV2(runtime);
      this.importBusAccess(runtime);
    }
    return super.getCpuState();
  }

  // ==========================================================================================
  // Running

  override executeMachineFrame(): FrameTerminationMode {
    const runtime = this.requireWasmV2Runtime();
    if (
      this.executionContext.debugStepMode !== DebugStepMode.NoDebug ||
      this.executionContext.frameTerminationMode !== FrameTerminationMode.Normal
    ) {
      return this.executeDebugLoop(runtime);
    }
    this.emulateKeystroke();
    runtime.exports.epExecuteFrame();
    this.syncFrameCounters(runtime);
    this.frameCompleted = runtime.exports.epGetFrameCompleted() !== 0;
    this.executionContext.lastTerminationReason = FrameTerminationMode.Normal;
    return FrameTerminationMode.Normal;
  }

  /** The debug path, as the HT-1080Z's: one instruction at a time, or on to the next candidate stop */
  private debugLoopHost?: { runtime: EpWasmV2Runtime; host: WasmDebugLoopHost };

  private executeDebugLoop(runtime: EpWasmV2Runtime): FrameTerminationMode {
    if (this.debugLoopHost?.runtime !== runtime) {
      this.debugLoopHost = { runtime, host: this.createDebugLoopHost(runtime) };
    }
    return runWasmDebugLoop(this.debugLoopHost.host);
  }

  private createDebugLoopHost(runtime: EpWasmV2Runtime): WasmDebugLoopHost {
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
        if (this.frameCompleted) {
          this.frameCompleted = false;
        }
        this.syncCpuFromWasmV2(runtime);
        this.emulateKeystroke();
        return undefined;
      },
      // --- The instruction export returns whether the frame completed
      executeInstruction: () => wasm.epExecuteInstruction() !== 0,
      // --- The core's own loop runs to the next place the stop policy may stop at (z80-debug-loop.c)
      executeUntilStop: (extraStop, mask, accessMask) => wasm.epExecuteUntilStop(extraStop, mask, accessMask),
      lastOpStart: () => wasm.epGetDebugOpStart(),
      pushBreakpointFlags: (flags) => runtime.breakpointFlags.set(flags),
      conditionPlan: () => runtime.condPlan,
      coreFrameCompleted: () => wasm.epGetFrameCompleted() !== 0,
      // --- Past this class's `pc` setter, which would push the value just read from the core back into it
      mirrorPc: () => {
        const pc = wasm.epGetCpuPc();
        this.setPcMirror(pc);
        return pc;
      },
      historyStopReached: () => wasm.z80HistoryCheckStop() !== 0,
      importBusAccess: () => this.importBusAccess(runtime),
      hasAccessBreakpoint: () => this.hasAccessBreakpoint(),
      shouldStopAtBreakpoint: (instructionsExecuted) => this.shouldStopAtBreakpoint(instructionsExecuted),
      finish: (termination) => this.finishDebugLoop(termination)
    };
  }

  private finishDebugLoop(termination: FrameTerminationMode): FrameTerminationMode {
    const runtime = this.requireWasmV2Runtime();
    this.syncCpuFromWasmV2(runtime);
    this.importBusAccess(runtime);
    this.executionContext.lastTerminationReason = termination;
    return termination;
  }

  override getInterruptDepth(): number {
    return this.w ? this.w.epGetInterruptDepth() : super.getInterruptDepth();
  }

  override markStepOutAddress(): void {
    this.stepOutAddress = stepOutAddressFromCore(this.requireWasmV2Runtime().exports.epGetStepOutAddress());
  }

  private shouldStopAtBreakpoint(instructionsExecuted: number): boolean {
    return shouldStopAtWasmBreakpoint(
      this,
      instructionsExecuted,
      () => this.sp,
      () => ({ af: this.af, bc: this.bc, de: this.de, hl: this.hl })
    );
  }

  private hasAccessBreakpoint(): boolean {
    return hasWasmAccessBreakpoint(
      this.executionContext.debugSupport,
      this,
      (address) => this.getPartition(address),
      this.lastMemoryReadValues,
      this.lastMemoryWriteValues
    );
  }

  /** The shared core's data-access log and last port event, into the fields `Z80Cpu` keeps */
  private importBusAccess(runtime: EpWasmV2Runtime): void {
    const wasm = runtime.exports;
    this.lastIoReadPort = undefined;
    this.lastIoWritePort = undefined;
    importAccessLog(this, runtime.accessLog, wasm.epGetAccessLogCount());
    const portAddress = wasm.epGetLastPortAddress();
    const portValue = wasm.epGetLastPortValue();
    if (wasm.epGetLastPortIsWrite() !== 0) {
      this.lastIoWritePort = portAddress;
      this.lastIoWriteValue = portValue;
    } else if (portAddress !== 0 || portValue !== 0) {
      this.lastIoReadPort = portAddress;
      this.lastIoReadValue = portValue;
    }
  }

  // ==========================================================================================
  // Memory and ports

  override doReadMemory(address: number): number {
    return this.requireWasmV2Runtime().exports.epReadMemory(address & 0xffff);
  }

  override doWriteMemory(address: number, value: number): void {
    this.requireWasmV2Runtime().exports.epWriteMemory(address & 0xffff, value & 0xff);
  }

  // ==========================================================================================
  // Partitions (`.plans/ENTERPRISE_PLAN.md` §11): the 256 segments, numbered as DAVE numbers them.
  // Phase 7 adds their labels, descriptions and groups.

  /** The segment each 16K page shows */
  override getCurrentPartitions(): number[] {
    const wasm = this.wasmV2Runtime?.exports;
    if (!wasm) return [];
    return [0, 1, 2, 3].map((page) => wasm.epGetPageRegister(page));
  }

  override getCurrentPartitionLabels(): string[] {
    const labels = this.getPartitionLabels();
    return this.getCurrentPartitions().map((partition) => labels[partition] ?? "");
  }

  /** Every segment by its number in hex */
  override getPartitionLabels(): Record<number, string> {
    const labels: Record<number, string> = {};
    for (let segment = 0; segment < 256; segment++) labels[segment] = segment.toString(16).toUpperCase().padStart(2, "0");
    return labels;
  }

  override parsePartitionLabel(label: string): number | undefined {
    const wanted = label.trim().toUpperCase();
    if (!/^[0-9A-F]{1,2}$/.test(wanted)) return undefined;
    return parseInt(wanted, 16);
  }

  /** A segment's 16K, straight from the core's physical memory (an empty one reads FFh) */
  override getMemoryPartition(index: number): Uint8Array {
    const runtime = this.requireWasmV2Runtime();
    const start = runtime.exports.epGetSegmentBase(index & 0xff);
    return runtime.memory.subarray(start, start + EP_SEGMENT_SIZE);
  }

  override getPartition(address: number): number | undefined {
    const wasm = this.wasmV2Runtime?.exports;
    return wasm ? wasm.epGetPageRegister((address >> 14) & 3) : undefined;
  }

  /** The 64K as eight 8K pages: a page is ROM unless its segment is RAM */
  getRomFlags(): boolean[] {
    const wasm = this.wasmV2Runtime?.exports;
    return [0, 1, 2, 3, 4, 5, 6, 7].map((page) => {
      if (!wasm) return page < 2;
      const base = wasm.epGetSegmentBase(wasm.epGetPageRegister(page >> 1));
      return base < 0x18000 || base >= EP_PHYS_UNMAPPED;
    });
  }

  /** The 64K the CPU sees, through the current paging */
  get64KFlatMemory(): Uint8Array {
    const wasm = this.requireWasmV2Runtime().exports;
    const flat = new Uint8Array(0x1_0000);
    for (let address = 0; address < 0x1_0000; address++) flat[address] = wasm.epReadMemory(address);
    return flat;
  }

  override doReadPort(address: number): number {
    return this.requireWasmV2Runtime().exports.epReadPort(address & 0xffff);
  }

  override doWritePort(address: number, value: number): void {
    this.requireWasmV2Runtime().exports.epWritePort(address & 0xffff, value & 0xff);
  }

  // ==========================================================================================
  // Keyboard and screen

  setKeyStatus(key: number, isDown: boolean): void {
    this.requireWasmV2Runtime().exports.epSetKeyStatus(key, isDown ? 1 : 0);
  }

  get screenWidthInPixels(): number {
    return this.requireWasmV2Runtime().exports.epGetScreenWidth();
  }

  get screenHeightInPixels(): number {
    return this.requireWasmV2Runtime().exports.epGetScreenHeight();
  }

  /** NICK's pixels (14.2375 MHz) are narrower than they are tall */
  getAspectRatio = (): [number, number] => [EP_PIXEL_ASPECT, 1];

  /**
   * The picture. The core draws straight into it as the beam goes, so between frames it holds the
   * last complete frame, and on a machine paused mid-frame the new frame down to the beam over the
   * rest of the previous one.
   */
  getPixelBuffer(): Uint32Array {
    this.requireWasmV2Runtime();
    return this.screenPixels!;
  }

  getPixelBufferBytes(): Uint8ClampedArray {
    this.requireWasmV2Runtime();
    return this.screenPixelBytes!;
  }

  /** The core draws as the beam goes: the buffer is always up to the beam */
  renderInstantScreen(_savedPixelBuffer?: Uint32Array): Uint32Array {
    return this.getPixelBuffer();
  }

  getConditionStore(): ConditionStore | undefined {
    return this.wasmV2Runtime ? conditionStoreOf(this.wasmV2Runtime) : undefined;
  }

  // ==========================================================================================
  // State files and reverse debugging (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.5,
  // `.plans/REVERSE_DEBUGGING_PLAN.md` §4.2)

  /**
   * Captures the machine's whole state: the core's memory image. The machine must be paused.
   */
  saveMachineState(): MachineStateParts {
    const runtime = this.requireWasmV2Runtime();
    return {
      ...captureWasmImage("ep", runtime.module, runtime.exports.memory.buffer),
      host: this.captureHostState()
    };
  }

  /**
   * Puts the machine back into a saved state; the wrapper's mirrors of core state are re-read from it.
   * @throws MachineStateMismatchError when the state was saved by another core or layout
   */
  loadMachineState(parts: MachineStateParts): void {
    const runtime = this.requireWasmV2Runtime();
    restoreWasmImage(parts, "ep", runtime.module, runtime.exports.memory.buffer);
    this.restoreHostState(parts.host);
    // --- The audio rate is the host's, not the saved machine's
    this.syncAudioSampleRate(runtime);
  }

  /** The core, as the export contract names it */
  get reverseCoreId(): string {
    return "ep";
  }

  get reverseRuntime(): EpWasmV2Runtime | undefined {
    return this.wasmV2Runtime;
  }

  readonly reverseFrameExport = "epExecuteFrame";

  isAtFrameBoundary(): boolean {
    return this.wasmV2Runtime?.exports.epGetFrameCompleted() !== 0;
  }

  /** The wrapper keeps no state of its own a keyframe needs: the core holds it all */
  captureHostState(): Record<string, unknown> {
    return {};
  }

  /**
   * After the core changed under the wrapper (a state load, a replay, a return to the present): the
   * mirrors re-read from the core, nothing pushed, queued keystrokes dropped
   */
  restoreHostState(_state: unknown): void {
    const runtime = this.requireWasmV2Runtime();
    const w = runtime.exports;
    this.emulatedKeyStrokes.length = 0;
    this.frameCompleted = w.epGetFrameCompleted() !== 0;
    this.syncCpuFromWasmV2(runtime);
  }

  /** Nothing is pushed into the core lazily (it has no clock multiplier), so there is nothing to forget */
  invalidateHostSync(): void {}


  // ==========================================================================================
  // Helpers

  private syncCpuFromWasmV2(runtime: EpWasmV2Runtime): void {
    const w = runtime.exports;
    super.af = w.epGetCpuAf();
    super.bc = w.epGetCpuBc();
    super.de = w.epGetCpuDe();
    super.hl = w.epGetCpuHl();
    super.af_ = w.epGetCpuAfAlt();
    super.bc_ = w.epGetCpuBcAlt();
    super.de_ = w.epGetCpuDeAlt();
    super.hl_ = w.epGetCpuHlAlt();
    super.ix = w.epGetCpuIx();
    super.iy = w.epGetCpuIy();
    super.ir = w.epGetCpuIr();
    super.wz = w.epGetCpuWz();
    super.pc = w.epGetCpuPc();
    super.sp = w.epGetCpuSp();
    super.iff1 = w.epGetCpuIff1() !== 0;
    super.iff2 = w.epGetCpuIff2() !== 0;
    super.interruptMode = w.epGetCpuInterruptMode();
    this.halted = w.epGetCpuHalted() !== 0;
    this.opCode = w.epGetCpuOpCode();
    this.syncFrameCounters(runtime);
  }

  private syncFrameCounters(runtime: EpWasmV2Runtime): void {
    const w = runtime.exports;
    super.pc = w.epGetCpuPc();
    this.tacts = w.epGetTacts();
    this.frames = w.epGetFrames();
    this.clockMultiplier = 1;
    this.tactsInCurrentFrame = w.epGetTactsInCurrentFrame();
    this.frameTacts = w.epGetFrameTacts();
    this.currentFrameTact = this.frameTacts;
    this.opStartAddress = w.epGetOpStartAddress();
    this.sigINT = false;
  }

  private requireWasmV2Runtime(): EpWasmV2Runtime {
    if (this.wasmV2Runtime == null) {
      throw new Error("The Enterprise WASM core is not loaded; call setup() first.");
    }
    return this.wasmV2Runtime;
  }
}
