import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";
import type { CpuState } from "@common/messaging/EmuApi";
import type { SamWasmV2LoaderOptions, SamWasmV2Runtime } from "./wasm/SamWasmV2Loader";

import type { IExecutionHistorySource } from "@emu/abstractions/IExecutionHistorySource";
import type { IAccessProfileSource } from "@emu/abstractions/IAccessProfileSource";
import type { ProfileCounts, ProfileEdge, ProfileInfo, ProfileTouchedByte } from "@common/profile/profileTypes";
import type { ExecutionHistoryInfo, ExecutionHistoryPage } from "@common/history/historyTypes";
import type { HistoryServiceSpan } from "@common/history/serviceSpans";
import type { TapeDataBlock } from "@common/structs/TapeDataBlock";

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
import { writeCoreBytes } from "@emu/machines/reverse/coreMemoryWrites";
import { loadSamWasmV2 } from "./wasm/SamWasmV2Loader";
import { SamWasmHost } from "./SamWasmHost";
import { SamKeyCode } from "./SamKeyCode";
import { SamDisks } from "./SamDisks";
import { readSamAsicDebugState, readSamSaaDebugState, type SamAsicDebugState, type SamSaaDebugState } from "./SamDebugState";
import { isSamTape, samDecodeSavedEdges, samTapeFromBlocks } from "./SamTapeFile";
import {
  SAM_PAGE_SIZE,
  SAM_PARTITION_ROM0,
  SAM_PARTITION_ROM1,
  SAM_PHYS_UNMAPPED,
  SAM_PIXEL_ASPECT,
  SAM_SCREEN_FIRST_LINE,
  SAM_SCREEN_HEIGHT,
  SAM_SCREEN_WIDTH,
  SAM_TACTS_PER_LINE,
  SAM_TV_FIRST_HC,
  SAM_TV_TOP_LINES,
  samPartitionBase,
  samPartitionDescriptions,
  samPartitionGroups,
  samPartitionLabels,
  samPartitionOfPhysical
} from "./samMachineInfo";
import { beamAt, drawnUpTo, type BeamPosition, type BeamTiming } from "@common/utils/beamGeometry";
import { JOY_B, JOY_DOWN, JOY_LEFT, JOY_RIGHT, JOY_UP, type JoystickConnector } from "@emu/machines/zxNext/IZxNextHostInputMachine";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import {
  AUDIO_SAMPLE_RATE,
  DISK_A_CHANGES,
  DISK_A_WP,
  DISK_B_CHANGES,
  DISK_B_WP,
  FAST_LOAD,
  REWIND_REQUESTED,
  SAVED_TO_TAPE
} from "../machine-props";
import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_TAPE } from "@common/structs/project-const";
import type { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";
import { DSK_WHOLE_IMAGE_KEY } from "../disk/disk-changes";
import { createFixedAudioMixer, SAM_AUDIO_CHANNELS } from "../audioChannelTables";
import type { IAudioChannelMixer } from "@emu/abstractions/IAudioChannelMixer";

/** The DC filter's cut-off, as the other cores' (`AudioDeviceBase.DC_FILTER_CUTOFF_HZ`); the core has no `exp` */
const DC_FILTER_CUTOFF_HZ = 1.4;

/**
 * Fast load (`FAST_LOAD`, on by default): while the tape plays, a displayed frame runs this many machine
 * frames. The ROM decodes the real signal - nothing is trapped - so a load behaves exactly as at normal
 * speed, only sooner. The sound of the skipped frames is dropped.
 */
const FAST_LOAD_FRAMES = 25;

/**
 * A SAM Coupé on the WASM core (`wasm/sam/`, `dev/plans/SAM_COUPE_PLAN.md`): one core for both models,
 * configured by the model at setup.
 *
 * The registers are read live from the core and every write is pushed into it; the debugger runs
 * instruction by instruction, or - when the stop policy can only stop at known addresses - the core runs on
 * to the next candidate, as on the TVC and the Enterprise. The core carries the shared execution-history
 * recorder and access profile, and its whole state is its linear memory: state files and reverse
 * debugging save and restore that image.
 */
export class SamWasmV2Machine extends SamWasmHost implements IExecutionHistorySource, IAccessProfileSource {
  // ==============================================================================================
  // Execution history: the shared recorder in the core, read through the shared reader; the
  // machine id names the context decoder (`contexts/samContext.ts`)

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
  // (`layouts/sam.ts`)

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
  public wasmV2Runtime?: SamWasmV2Runtime;

  /** The audio mixer's gains and taps (`audioChannelTables.ts`) */
  readonly audioMixer: IAudioChannelMixer = createFixedAudioMixer("sam", SAM_AUDIO_CHANNELS, () => this.wasmV2Runtime);

  private screenPixels?: Uint32Array;
  private screenPixelBytes?: Uint8ClampedArray;
  /** The current frame's samples; the array and its objects are reused, as the HT-1080Z's are */
  private readonly wasmV2AudioSamples: AudioSample[] = [];

  constructor(
    machineId: string,
    modelInfo?: MachineModel,
    config?: MachineConfigSet,
    messenger?: MessengerBase,
    private readonly wasmV2LoaderOptions?: SamWasmV2LoaderOptions
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
    return this.w ? this.w.samGetCpuAf() : super.af;
  }
  override set af(value: number) {
    super.af = value;
    this.w?.samSetCpuAf(super.af);
  }
  override get bc(): number {
    return this.w ? this.w.samGetCpuBc() : super.bc;
  }
  override set bc(value: number) {
    super.bc = value;
    this.w?.samSetCpuBc(super.bc);
  }
  override get de(): number {
    return this.w ? this.w.samGetCpuDe() : super.de;
  }
  override set de(value: number) {
    super.de = value;
    this.w?.samSetCpuDe(super.de);
  }
  override get hl(): number {
    return this.w ? this.w.samGetCpuHl() : super.hl;
  }
  override set hl(value: number) {
    super.hl = value;
    this.w?.samSetCpuHl(super.hl);
  }
  override get af_(): number {
    return this.w ? this.w.samGetCpuAfAlt() : super.af_;
  }
  override set af_(value: number) {
    super.af_ = value;
    this.w?.samSetCpuAfAlt(super.af_);
  }
  override get bc_(): number {
    return this.w ? this.w.samGetCpuBcAlt() : super.bc_;
  }
  override set bc_(value: number) {
    super.bc_ = value;
    this.w?.samSetCpuBcAlt(super.bc_);
  }
  override get de_(): number {
    return this.w ? this.w.samGetCpuDeAlt() : super.de_;
  }
  override set de_(value: number) {
    super.de_ = value;
    this.w?.samSetCpuDeAlt(super.de_);
  }
  override get hl_(): number {
    return this.w ? this.w.samGetCpuHlAlt() : super.hl_;
  }
  override set hl_(value: number) {
    super.hl_ = value;
    this.w?.samSetCpuHlAlt(super.hl_);
  }
  override get ix(): number {
    return this.w ? this.w.samGetCpuIx() : super.ix;
  }
  override set ix(value: number) {
    super.ix = value;
    this.w?.samSetCpuIx(super.ix);
  }
  override get iy(): number {
    return this.w ? this.w.samGetCpuIy() : super.iy;
  }
  override set iy(value: number) {
    super.iy = value;
    this.w?.samSetCpuIy(super.iy);
  }
  override get ir(): number {
    return this.w ? this.w.samGetCpuIr() : super.ir;
  }
  override set ir(value: number) {
    super.ir = value;
    this.w?.samSetCpuIr(super.ir);
  }
  override get wz(): number {
    return this.w ? this.w.samGetCpuWz() : super.wz;
  }
  override set wz(value: number) {
    super.wz = value;
    this.w?.samSetCpuWz(super.wz);
  }
  override get pc(): number {
    return this.w ? this.w.samGetCpuPc() : super.pc;
  }
  override set pc(value: number) {
    super.pc = value;
    this.w?.samSetCpuPc(super.pc);
  }
  override get sp(): number {
    return this.w ? this.w.samGetCpuSp() : super.sp;
  }
  override set sp(value: number) {
    super.sp = value;
    this.w?.samSetCpuSp(super.sp);
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
    return this.w ? this.w.samGetCpuIff1() !== 0 : super.iff1;
  }
  override set iff1(value: boolean) {
    super.iff1 = value;
    this.w?.samSetCpuIff1(value ? 1 : 0);
  }
  override get iff2(): boolean {
    return this.w ? this.w.samGetCpuIff2() !== 0 : super.iff2;
  }
  override set iff2(value: boolean) {
    super.iff2 = value;
    this.w?.samSetCpuIff2(value ? 1 : 0);
  }
  override get interruptMode(): number {
    return this.w ? this.w.samGetCpuInterruptMode() : super.interruptMode;
  }
  override set interruptMode(value: number) {
    super.interruptMode = value;
    this.w?.samSetCpuInterruptMode(value);
  }

  override setTacts(value: number): void {
    super.setTacts(value);
    this.w?.samSetTacts(value >>> 0);
  }


  // ==========================================================================================
  // Lifecycle

  /** Loads the core (once), configures the model, uploads its ROM and powers the machine on */
  async setup(): Promise<void> {
    if (this.wasmV2Runtime == null) {
      this.wasmV2Runtime = await loadSamWasmV2(this.wasmV2LoaderOptions);
    }
    const runtime = this.wasmV2Runtime;
    const hw = this.hardware;
    const rom = await this.loadRomFromResource(hw.rom.name);
    writeCoreBytes(runtime, runtime.rom, rom.subarray(0, hw.rom.size));
    runtime.exports.samConfigure(hw.ramPages, hw.extPages, hw.drives, hw.mouse ? 1 : 0);
    const words = runtime.exports.samGetScreenWidth() * runtime.exports.samGetScreenHeight();
    this.screenPixels = runtime.pixelBuffer.subarray(0, words);
    this.screenPixelBytes = runtime.pixelBufferBytes.subarray(0, words * 4);
    this.baseClockFrequency = runtime.exports.samGetBaseClockFrequency();
    this.setTactsInFrame(runtime.exports.samGetTactsInFrame());
    runtime.exports.samHardReset();
    this.syncAudioSampleRate(runtime);
    this.disks ??= new SamDisks(runtime.exports);
    this.insertDisk(0, this.getMachineProperty(MEDIA_DISK_A));
    this.insertDisk(1, this.getMachineProperty(MEDIA_DISK_B));
    this.uploadTape(runtime, this.getMachineProperty(MEDIA_TAPE));
    this.syncCpuFromWasmV2(runtime);
  }

  override setMachineProperty(key: string, value?: any): void {
    super.setMachineProperty(key, value);
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return;
    if (key === AUDIO_SAMPLE_RATE) this.syncAudioSampleRate(runtime);
    if (key === MEDIA_TAPE) this.uploadTape(runtime, value);
    else if (key === REWIND_REQUESTED && (value === true || value === undefined)) runtime.exports.samTapeRewind();
    if (key === MEDIA_DISK_A || key === MEDIA_DISK_B) this.insertDisk(key === MEDIA_DISK_A ? 0 : 1, value);
    else if (key === DISK_A_WP || key === DISK_B_WP) this.disks?.setWriteProtected(key === DISK_A_WP ? 0 : 1, !!value);
  }

  // ==========================================================================================
  // Disks (`dev/plans/SAM_COUPE_PLAN.md` §10, `SamDisks.ts`, `wasm/sam/sam-fdc.c`)

  private disks?: SamDisks;
  /** Why the last disk inserted could not go in a drive (`SamDiskImage.ts`), per drive */
  diskProblems: (string | undefined)[] = [undefined, undefined];

  private insertDisk(drive: number, contents: unknown): void {
    if (!this.disks) return;
    this.diskProblems[drive] = this.disks.insert(drive, contents, !!this.getMachineProperty(drive ? DISK_B_WP : DISK_A_WP));
  }

  /** The guest's writes, as the drives' whole new images, for the main process to write back */
  private publishDiskChanges(): void {
    const published = this.disks?.publish();
    if (!published) return;
    published.forEach((image, drive) => {
      if (image) super.setMachineProperty(drive ? DISK_B_CHANGES : DISK_A_CHANGES, new Map([[DSK_WHOLE_IMAGE_KEY, image]]) as SectorChanges);
    });
  }

  /** The controller asks for the pending writes before it reads them (a pause, a stop) */
  flushDiskChanges(): void {
    this.publishDiskChanges();
  }

  /** The disk in a drive as an MGT image, the guest's writes included */
  exportDisk(drive: number): Uint8Array | undefined {
    return this.disks?.image(drive);
  }

  // ==========================================================================================
  // Tape (`dev/plans/SAM_COUPE_PLAN.md` §9.4, `wasm/sam/sam-tape.c`, `SamTapeFile.ts`)

  /** How much of the SAVE recording has been decoded */
  private savedRevision = 0;

  /** Puts a tape in the deck: its edges to the core; anything else empties it */
  private uploadTape(runtime: SamWasmV2Runtime, value: unknown): void {
    let tape = isSamTape(value) ? value : undefined;
    if (!tape && Array.isArray(value)) tape = samTapeFromBlocks(value as TapeDataBlock[]);
    if (!tape) {
      runtime.exports.samTapeSetLength(0);
      return;
    }
    if (tape.edges.length > runtime.tapeEdges.length) {
      throw new Error(`The tape is too long: ${tape.edges.length} edges (at most ${runtime.tapeEdges.length}).`);
    }
    writeCoreBytes(runtime, runtime.tapeEdges, tape.edges);
    runtime.exports.samTapeSetLength(tape.edges.length);
  }

  /** Starts or stops the deck (the SAM has no motor control: the user's Play, or `LOAD` typed by Load and Run) */
  playTape(play: boolean): void {
    this.wasmV2Runtime?.exports.samTapePlay(play ? 1 : 0);
  }

  /** Starts recording what the ROM SAVEs */
  recordTape(on: boolean): void {
    this.wasmV2Runtime?.exports.samTapeSetRecording(on ? 1 : 0);
    this.savedRevision = 0;
  }

  /**
   * Load and Run: the machine starts, the deck plays, and `LOAD ""` is typed at the copyright screen
   * (SAM BASIC accepts it there); the ROM decodes the tape.
   */
  getTapeLoadFlow() {
    const tape = this.getMachineProperty(MEDIA_TAPE);
    if (!tape) throw new Error("There is no tape in the deck.");
    return [
      { type: "ReachExecPoint" as const, rom: 0, execPoint: 0x0fa2, message: "The SAM shows its copyright screen" },
      { type: "Start" as const },
      { type: "TypeText" as const, text: 'LOAD ""\n', delayFrames: 10 },
      { type: "KeepPc" as const }
    ];
  }

  /** Whether the tape plays: fast load runs several frames for each one shown */
  private get isTapeLoading(): boolean {
    return this.wasmV2Runtime?.exports.samTapeGetPlaying() !== 0;
  }

  private runTapeTurbo(runtime: SamWasmV2Runtime): void {
    const fast = this.getMachineProperty(FAST_LOAD);
    if (fast !== undefined && !fast) return;
    for (let i = 1; i < FAST_LOAD_FRAMES && this.isTapeLoading && runtime.exports.samGetFrameCompleted() !== 0; i++) {
      runtime.exports.samExecuteFrame();
    }
  }

  /** Hands what the ROM saved to the host as a `.tap`, once the recording has stopped growing */
  private publishSavedTape(runtime: SamWasmV2Runtime): void {
    const revision = runtime.exports.samTapeGetSavedRevision();
    if (revision === this.savedRevision) return;
    // --- Wait for a quiet frame: the recording grows while the ROM saves
    if (this.lastSavedRevision !== revision) {
      this.lastSavedRevision = revision;
      return;
    }
    this.savedRevision = revision;
    const blocks = samDecodeSavedEdges(runtime.savedEdges.subarray(0, runtime.exports.samTapeGetSavedLength()));
    if (!blocks.length) return;
    const size = blocks.reduce((n, b) => n + 2 + b.length, 0);
    const tap = new Uint8Array(size);
    let at = 0;
    for (const b of blocks) {
      tap[at++] = b.length & 0xff;
      tap[at++] = b.length >> 8;
      tap.set(b, at);
      at += b.length;
    }
    super.setMachineProperty(SAVED_TO_TAPE, { name: "sam.tap", contents: tap });
  }
  private lastSavedRevision = 0;

  // ==========================================================================================
  // Sound (`dev/plans/SAM_COUPE_PLAN.md` §8, `wasm/sam/sam-audio.c`)

  private syncAudioSampleRate(runtime: SamWasmV2Runtime): void {
    const rate = this.getMachineProperty(AUDIO_SAMPLE_RATE);
    if (typeof rate === "number" && rate > 0) {
      runtime.exports.samSetAudioSampleRate(rate, Math.exp((-2 * Math.PI * DC_FILTER_CUTOFF_HZ) / rate));
    }
  }

  /** The current frame's samples, read from the core's buffer */
  getAudioSamples(): AudioSample[] {
    const runtime = this.requireWasmV2Runtime();
    const values = runtime.audioSamples;
    const count = runtime.exports.samGetAudioSampleCount();
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

  /** Power on: the RAM filled, every register reset */
  override hardReset(): void {
    super.hardReset();
    this.reset();
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      runtime.exports.samHardReset();
      this.syncCpuFromWasmV2(runtime);
    }
  }

  override reset(): void {
    super.reset();
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      runtime.exports.samReset();
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
    runtime.exports.samExecuteFrame();
    this.runTapeTurbo(runtime);
    this.publishSavedTape(runtime);
    this.publishDiskChanges();
    this.syncFrameCounters(runtime);
    this.frameCompleted = runtime.exports.samGetFrameCompleted() !== 0;
    this.executionContext.lastTerminationReason = FrameTerminationMode.Normal;
    return FrameTerminationMode.Normal;
  }

  private debugLoopHost?: { runtime: SamWasmV2Runtime; host: WasmDebugLoopHost };

  private executeDebugLoop(runtime: SamWasmV2Runtime): FrameTerminationMode {
    if (this.debugLoopHost?.runtime !== runtime) {
      this.debugLoopHost = { runtime, host: this.createDebugLoopHost(runtime) };
    }
    return runWasmDebugLoop(this.debugLoopHost.host);
  }

  private createDebugLoopHost(runtime: SamWasmV2Runtime): WasmDebugLoopHost {
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
      executeInstruction: () => wasm.samExecuteInstruction() !== 0,
      executeUntilStop: (extraStop, mask, accessMask) => wasm.samExecuteUntilStop(extraStop, mask, accessMask),
      lastOpStart: () => wasm.samGetDebugOpStart(),
      pushBreakpointFlags: (flags) => runtime.breakpointFlags.set(flags),
      conditionPlan: () => runtime.condPlan,
      coreFrameCompleted: () => wasm.samGetFrameCompleted() !== 0,
      // --- Past this class's `pc` setter, which would push the value just read from the core back into it
      mirrorPc: () => {
        const pc = wasm.samGetCpuPc();
        this.setPcMirror(pc);
        return pc;
      },
      historyStopReached: () => wasm.z80HistoryCheckStop() !== 0,
      importBusAccess: () => this.importBusAccess(runtime),
      hasAccessBreakpoint: () => this.hasAccessBreakpoint(),
      shouldStopAtBreakpoint: (instructionsExecuted) => this.shouldStopAtBreakpoint(instructionsExecuted),
      onFrameEnd: () => undefined,
      finish: (termination) => this.finishDebugLoop(termination)
    };
  }

  private finishDebugLoop(termination: FrameTerminationMode): FrameTerminationMode {
    const runtime = this.requireWasmV2Runtime();
    this.syncCpuFromWasmV2(runtime);
    this.importBusAccess(runtime);
    this.publishSavedTape(runtime);
    this.publishDiskChanges();
    this.executionContext.lastTerminationReason = termination;
    return termination;
  }

  override getInterruptDepth(): number {
    return this.w ? this.w.samGetInterruptDepth() : super.getInterruptDepth();
  }

  override markStepOutAddress(): void {
    this.stepOutAddress = stepOutAddressFromCore(this.requireWasmV2Runtime().exports.samGetStepOutAddress());
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
  private importBusAccess(runtime: SamWasmV2Runtime): void {
    const wasm = runtime.exports;
    this.lastIoReadPort = undefined;
    this.lastIoWritePort = undefined;
    importAccessLog(this, runtime.accessLog, wasm.samGetAccessLogCount());
    const portAddress = wasm.samGetLastPortAddress();
    const portValue = wasm.samGetLastPortValue();
    if (wasm.samGetLastPortIsWrite() !== 0) {
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
    return this.requireWasmV2Runtime().exports.samReadMemory(address & 0xffff);
  }

  override doWriteMemory(address: number, value: number): void {
    this.requireWasmV2Runtime().exports.samWriteMemory(address & 0xffff, value & 0xff);
  }

  protected writePageByte(page: number, offset: number, value: number): void {
    this.requireWasmV2Runtime().exports.samWritePage(page & 31, offset & 0x3fff, value & 0xff);
  }

  override doReadPort(address: number): number {
    return this.requireWasmV2Runtime().exports.samReadPort(address & 0xffff);
  }

  override doWritePort(address: number, value: number): void {
    this.requireWasmV2Runtime().exports.samWritePort(address & 0xffff, value & 0xff);
  }

  // ==========================================================================================
  // Joysticks (`dev/plans/SAM_COUPE_PLAN.md` §9.1): Interface 2 order on the keyboard's rows

  /** The keys each joystick holds down */
  private joystickKeys: Record<JoystickConnector, number[]> = { left: [], right: [] };

  /**
   * The joysticks, driven by the host's joystick bindings: stick 1 (`left`) is keys 6-0 on row 4 (A12),
   * stick 2 (`right`) keys 1-5 on row 3 (A11), as the SAM's splitter wires them.
   */
  setJoystickState(side: JoystickConnector, bits: number): void {
    const map =
      side === "left"
        ? { fire: SamKeyCode.N0, up: SamKeyCode.N9, down: SamKeyCode.N8, right: SamKeyCode.N7, left: SamKeyCode.N6 }
        : { fire: SamKeyCode.N5, up: SamKeyCode.N4, down: SamKeyCode.N3, right: SamKeyCode.N2, left: SamKeyCode.N1 };
    const keys: number[] = [];
    if (bits & JOY_B) keys.push(map.fire);
    if (bits & JOY_UP) keys.push(map.up);
    if (bits & JOY_DOWN) keys.push(map.down);
    if (bits & JOY_LEFT) keys.push(map.left);
    if (bits & JOY_RIGHT) keys.push(map.right);
    for (const key of this.joystickKeys[side]) if (!keys.includes(key)) this.setKeyStatus(key, false);
    for (const key of keys) this.setKeyStatus(key, true);
    this.joystickKeys[side] = keys;
  }

  // ==========================================================================================
  // The mouse (`dev/plans/SAM_COUPE_PLAN.md` §9.2, `wasm/sam/sam-mouse.c`)

  /** The host's movement (positive x right, positive y up) since the last call */
  moveMouse(dx: number, dy: number): void {
    this.wasmV2Runtime?.exports.samMouseMove(Math.round(dx), Math.round(dy));
  }

  /** The buttons: bit 0 left, bit 1 right, bit 2 middle */
  setMouseButtons(buttons: number): void {
    this.wasmV2Runtime?.exports.samMouseSetButtons(buttons & 7);
  }

  // ==========================================================================================
  // Partitions (`dev/plans/SAM_COUPE_PLAN.md` §11): internal pages 0-31, ROM0/ROM1 (R0, R1), external
  // pages (X00-X3F)

  /** The partition each 8K slot shows (each 16K section twice), as the IDE's slot paging counts */
  override getCurrentPartitions(): number[] {
    const wasm = this.wasmV2Runtime?.exports;
    if (!wasm) return [];
    return [0, 1, 2, 3, 4, 5, 6, 7].map((slot) => this.sectionPartition(slot >> 1) ?? -1);
  }

  private sectionPartition(section: number): number | undefined {
    const wasm = this.wasmV2Runtime?.exports;
    if (!wasm) return undefined;
    const base = wasm.samGetSectionBase(section & 3);
    if (base >= SAM_PHYS_UNMAPPED) {
      // --- A missing internal page still has its number
      const lmpr = wasm.samGetLmpr();
      const hmpr = wasm.samGetHmpr();
      const page = [lmpr, lmpr + 1, hmpr, hmpr + 1][section & 3] & 31;
      return page;
    }
    return samPartitionOfPhysical(base);
  }

  override getCurrentPartitionLabels(): string[] {
    const labels = this.getPartitionLabels();
    return this.getCurrentPartitions().map((partition) => labels[partition] ?? "");
  }

  override getPartitionLabels(): Record<number, string> {
    return samPartitionLabels(this.hardware);
  }

  override getPartitionDescriptions(): Record<number, string> {
    return samPartitionDescriptions(this.hardware);
  }

  override getPartitionGroups(): Record<number, string> {
    return samPartitionGroups(this.hardware);
  }

  override parsePartitionLabel(label: string): number | undefined {
    const wanted = label.trim().toUpperCase();
    for (const [key, value] of Object.entries(this.getPartitionLabels())) {
      if (value === wanted) return Number(key);
    }
    if (/^[0-9]{1,2}$/.test(wanted) && Number(wanted) < 32) return Number(wanted);
    return undefined;
  }

  /** The ROM as the annotations see it: ROM0 and ROM1, each its own page */
  protected override getRomPartitionImages(): Map<number, Uint8Array> {
    const images = new Map<number, Uint8Array>();
    images.set(SAM_PARTITION_ROM0, this.getMemoryPartition(SAM_PARTITION_ROM0).slice());
    images.set(SAM_PARTITION_ROM1, this.getMemoryPartition(SAM_PARTITION_ROM1).slice());
    return images;
  }

  /** A partition's 16K, straight from the core's physical memory (one not fitted reads FFh) */
  override getMemoryPartition(index: number): Uint8Array {
    const runtime = this.requireWasmV2Runtime();
    const start = samPartitionBase(this.hardware, index);
    return runtime.memory.subarray(start, start + SAM_PAGE_SIZE);
  }

  override getPartition(address: number): number | undefined {
    return this.sectionPartition((address >> 14) & 3);
  }

  /** The 64K as eight 8K pages: a page is ROM unless its section is writable RAM */
  getRomFlags(): boolean[] {
    const wasm = this.wasmV2Runtime?.exports;
    return [0, 1, 2, 3, 4, 5, 6, 7].map((slot) => {
      if (!wasm) return slot < 2;
      return (wasm.samGetSectionFlags(slot >> 1) & 0x02) === 0;
    });
  }

  /** The 64K the CPU sees, through the current paging */
  get64KFlatMemory(): Uint8Array {
    const wasm = this.requireWasmV2Runtime().exports;
    const flat = new Uint8Array(0x1_0000);
    for (let address = 0; address < 0x1_0000; address++) flat[address] = wasm.samReadMemory(address);
    return flat;
  }

  // ==========================================================================================
  // Keyboard and screen

  setKeyStatus(key: number, isDown: boolean): void {
    this.requireWasmV2Runtime().exports.samSetKeyStatus(key, isDown ? 1 : 0);
  }

  get screenWidthInPixels(): number {
    return this.requireWasmV2Runtime().exports.samGetScreenWidth();
  }

  get screenHeightInPixels(): number {
    return this.requireWasmV2Runtime().exports.samGetScreenHeight();
  }

  /** The ASIC's pixels (12 MHz) are narrower than they are tall */
  getAspectRatio = (): [number, number] => [SAM_PIXEL_ASPECT, 1];

  /**
   * The beam position overlay. The frame starts at the frame interrupt (vc 244); buffer row 0 is vc 264,
   * 20 lines later, and buffer pixel 0 of a row is hc 96. A T-state is two buffer pixels. The paper is the
   * 512 x 192 screen at (64, 48).
   */
  getBeamPosition(): BeamPosition {
    const w = this.requireWasmV2Runtime().exports;
    const timing: BeamTiming = {
      unit: "T",
      tactsPerLine: SAM_TACTS_PER_LINE,
      linesPerFrame: 312,
      firstVisibleTact: (SAM_SCREEN_FIRST_LINE - SAM_TV_TOP_LINES) * SAM_TACTS_PER_LINE + SAM_TV_FIRST_HC,
      tactsPerBufferPixel: 0.5,
      bufferWidth: SAM_SCREEN_WIDTH,
      bufferHeight: SAM_SCREEN_HEIGHT,
      paperLeft: 64,
      paperTop: SAM_TV_TOP_LINES,
      paperWidth: 512,
      paperHeight: 192
    };
    const frameTact = w.samGetFrameTacts();
    return beamAt(timing, frameTact, drawnUpTo(timing, frameTact));
  }

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
  // State files and reverse debugging

  saveMachineState(): MachineStateParts {
    const runtime = this.requireWasmV2Runtime();
    return {
      ...captureWasmImage("sam", runtime.module, runtime.exports.memory.buffer),
      host: this.captureHostState()
    };
  }

  loadMachineState(parts: MachineStateParts): void {
    const runtime = this.requireWasmV2Runtime();
    restoreWasmImage(parts, "sam", runtime.module, runtime.exports.memory.buffer);
    this.restoreHostState(parts.host);
    this.syncAudioSampleRate(runtime);
  }

  get reverseCoreId(): string {
    return "sam";
  }

  get reverseRuntime(): SamWasmV2Runtime | undefined {
    return this.wasmV2Runtime;
  }

  readonly reverseFrameExport = "samExecuteFrame";

  isAtFrameBoundary(): boolean {
    return this.wasmV2Runtime?.exports.samGetFrameCompleted() !== 0;
  }

  captureHostState(): Record<string, unknown> {
    return {};
  }

  restoreHostState(_state: unknown): void {
    const runtime = this.requireWasmV2Runtime();
    const w = runtime.exports;
    this.emulatedKeyStrokes.length = 0;
    this.frameCompleted = w.samGetFrameCompleted() !== 0;
    this.syncCpuFromWasmV2(runtime);
  }

  invalidateHostSync(): void {}

  // ==========================================================================================
  // The ASIC and SAA panels (`SamDebugState.ts`)

  getSamAsicState(): SamAsicDebugState {
    return readSamAsicDebugState(this.requireWasmV2Runtime().exports as unknown as Parameters<typeof readSamAsicDebugState>[0]);
  }

  getSamSaaState(): SamSaaDebugState {
    return readSamSaaDebugState(this.requireWasmV2Runtime().exports as unknown as Parameters<typeof readSamSaaDebugState>[0]);
  }

  // ==========================================================================================
  // Helpers

  private syncCpuFromWasmV2(runtime: SamWasmV2Runtime): void {
    const w = runtime.exports;
    super.af = w.samGetCpuAf();
    super.bc = w.samGetCpuBc();
    super.de = w.samGetCpuDe();
    super.hl = w.samGetCpuHl();
    super.af_ = w.samGetCpuAfAlt();
    super.bc_ = w.samGetCpuBcAlt();
    super.de_ = w.samGetCpuDeAlt();
    super.hl_ = w.samGetCpuHlAlt();
    super.ix = w.samGetCpuIx();
    super.iy = w.samGetCpuIy();
    super.ir = w.samGetCpuIr();
    super.wz = w.samGetCpuWz();
    super.pc = w.samGetCpuPc();
    super.sp = w.samGetCpuSp();
    super.iff1 = w.samGetCpuIff1() !== 0;
    super.iff2 = w.samGetCpuIff2() !== 0;
    super.interruptMode = w.samGetCpuInterruptMode();
    this.halted = w.samGetCpuHalted() !== 0;
    this.opCode = w.samGetCpuOpCode();
    this.syncFrameCounters(runtime);
  }

  private syncFrameCounters(runtime: SamWasmV2Runtime): void {
    const w = runtime.exports;
    super.pc = w.samGetCpuPc();
    this.tacts = w.samGetTacts();
    this.frames = w.samGetFrames();
    this.clockMultiplier = 1;
    this.tactsInCurrentFrame = w.samGetTactsInFrame();
    this.frameTacts = w.samGetFrameTacts();
    this.currentFrameTact = this.frameTacts;
    this.opStartAddress = w.samGetOpStartAddress();
    this.sigINT = false;
  }

  private requireWasmV2Runtime(): SamWasmV2Runtime {
    if (this.wasmV2Runtime == null) {
      throw new Error("The SAM Coupé WASM core is not loaded; call setup() first.");
    }
    return this.wasmV2Runtime;
  }
}
