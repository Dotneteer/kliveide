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
import { EP_EXDOS_ROM_IMAGE, EP_FILEIO_ROM_NAME, EP_ROM_SETS } from "./EpRoms";
import { EP_ROM_SEGMENTS } from "@common/annotations/bankSpace";
import { EpExdosDisks } from "./EpExdosDisks";
import { EpHostFs, type EpHostFileStore, type EpHostFsAsync } from "./EpHostFs";
import { EpMainFileStore } from "./EpMainFileStore";
import {
  readEpDaveDebugState,
  readEpNickDebugState,
  readEpLpt,
  type EpDaveDebugState,
  type EpNickDebugState
} from "./EpDebugState";
import {
  EP_PHYS_UNMAPPED,
  EP_PHYS_VRAM,
  EP_PIXEL_ASPECT,
  EP_ROM_CART,
  EP_ROM_EXDOS,
  EP_ROM_FILEIO,
  EP_SCREEN_HEIGHT,
  EP_SCREEN_WIDTH,
  EP_SEGMENT_SIZE,
  EP_TACTS_PER_LINE,
  EP_TACTS_PER_SLOT,
  EP_TV_FIRST_LINE,
  EP_TV_FIRST_SLOT,
  epPartitionDescriptions,
  epPartitionGroups
} from "./epMachineInfo";
import { beamAt, drawnUpTo, type BeamPosition, type BeamTiming } from "@common/utils/beamGeometry";
import {
  JOY_B,
  JOY_DOWN,
  JOY_LEFT,
  JOY_RIGHT,
  JOY_UP,
  type JoystickConnector
} from "@emu/machines/zxNext/IZxNextHostInputMachine";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import {
  AUDIO_SAMPLE_RATE,
  DISK_A_CHANGES,
  DISK_A_WP,
  DISK_B_CHANGES,
  DISK_B_WP,
  EP_FILEIO_FOLDER,
  FAST_LOAD,
  REWIND_REQUESTED,
  SAVED_TO_TAPE
} from "../machine-props";
import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_TAPE } from "@common/structs/project-const";
import type { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";
import { DSK_WHOLE_IMAGE_KEY } from "../disk/disk-changes";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import { EpTapeRecorder, isEpTapeFile } from "./EpTapeFile";
import type { MessengerBase as Messenger } from "@common/messaging/MessengerBase";

/** The DC filter's cut-off, as the other cores' (`AudioDeviceBase.DC_FILTER_CUTOFF_HZ`); the core has no `exp` */
const DC_FILTER_CUTOFF_HZ = 1.4;

/**
 * Fast load (`FAST_LOAD`, on by default): while the tape plays with its motor on, a displayed frame
 * runs this many machine frames. EXOS decodes the real signal - nothing is trapped - so a load behaves
 * exactly as at normal speed, only sooner. The sound of the skipped frames is dropped.
 */
const FAST_LOAD_FRAMES = 25;

/** Frames a tape-load script waits for EXOS before it is dropped (two minutes) */
const LOAD_SCRIPT_TIMEOUT_FRAMES = 6000;

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
/**
 * A file store that serves the staged files (read-only) before it asks `backing`; as synchronous as
 * `backing` is
 */
function stagedFileStore(staged: ReadonlyMap<string, Uint8Array>, backing: EpHostFileStore | undefined): EpHostFileStore {
  const find = (name: string) => [...staged.keys()].find((k) => k.toUpperCase() === name.toUpperCase());
  const readSync = (name: string) => {
    const key = find(name);
    return key !== undefined ? staged.get(key)!.slice() : backing?.readSync?.(name);
  };
  return {
    synchronous: !!backing?.synchronous,
    read: async (name) => {
      const key = find(name);
      if (key !== undefined) return staged.get(key)!.slice();
      return backing?.read(name);
    },
    write: async (name, data) => {
      if (backing) await backing.write(name, data);
    },
    remove: async (name) => (backing ? backing.remove(name) : false),
    readSync,
    writeSync: (name, data) => backing?.writeSync?.(name, data),
    removeSync: (name) => backing?.removeSync?.(name) ?? false
  };
}

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
    if (hw.hostFs) {
      const fileIo = await this.loadRomFromResource(EP_FILEIO_ROM_NAME);
      writeCoreBytes(runtime, runtime.fileIoRom, fileIo.subarray(0, 0x4000));
    }
    fillCoreBytes(runtime, runtime.exdosRom, 0xff);
    // --- The EXDOS card, with its EXDOS 1.3 ROM at segments 20h-21h (`MC_EP_EXDOS`)
    if (hw.exdos) {
      const exdos = await this.loadRomFromResource(EP_EXDOS_ROM_IMAGE.name);
      writeCoreBytes(runtime, runtime.exdosRom, exdos.subarray(0, EP_EXDOS_ROM_IMAGE.size));
    }
    runtime.exports.epConfigure(
      hw.is128 ? 1 : 0,
      (hw.cartridge ? EP_ROM_CART : 0) | (hw.hostFs ? EP_ROM_FILEIO : 0) | (hw.exdos ? EP_ROM_EXDOS : 0)
    );
    runtime.exports.epNickSetLinearPalette(hw.linearPalette ? 1 : 0);
    const words = runtime.exports.epGetScreenWidth() * runtime.exports.epGetScreenHeight();
    this.screenPixels = runtime.pixelBuffer.subarray(0, words);
    this.screenPixelBytes = runtime.pixelBufferBytes.subarray(0, words * 4);
    this.baseClockFrequency = runtime.exports.epGetBaseClockFrequency();
    this.setTactsInFrame(runtime.exports.epGetTactsInFrame());
    runtime.exports.epHardReset();
    this.syncAudioSampleRate(runtime);
    this.setupTape(runtime);
    this.exdosDisks ??= new EpExdosDisks(runtime.exports);
    this.insertDisk(0, this.getMachineProperty(MEDIA_DISK_A));
    this.insertDisk(1, this.getMachineProperty(MEDIA_DISK_B));
    this.syncCpuFromWasmV2(runtime);
  }

  override setMachineProperty(key: string, value?: any): void {
    super.setMachineProperty(key, value);
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return;
    if (key === AUDIO_SAMPLE_RATE) this.syncAudioSampleRate(runtime);
    this.onTapeProperty(runtime, key, value);
    if (key === MEDIA_DISK_A || key === MEDIA_DISK_B) this.insertDisk(key === MEDIA_DISK_A ? 0 : 1, value);
    else if (key === DISK_A_WP || key === DISK_B_WP) this.exdosDisks?.setWriteProtected(key === DISK_A_WP ? 0 : 1, !!value);
  }

  // ==========================================================================================
  // The EXDOS card's disks (`.plans/ENTERPRISE_PLAN.md` §10, `EpExdosDisks.ts`, `wasm/ep/ep-exdos.c`)

  /** The card's drives (`MEDIA_DISK_A/B`), once the core is loaded; they hold disks with or without the card */
  private exdosDisks?: EpExdosDisks;
  /** Why the last disk inserted could not go in a drive (`EpDiskImage.ts`), per drive */
  diskProblems: (string | undefined)[] = [undefined, undefined];

  private insertDisk(drive: number, contents: unknown): void {
    if (!this.exdosDisks) return;
    this.diskProblems[drive] = this.exdosDisks.insert(drive, contents, !!this.getMachineProperty(drive ? DISK_B_WP : DISK_A_WP));
  }

  /** The guest's writes, as the drives' whole new images, for the main process to write back */
  private publishDiskChanges(): void {
    const published = this.exdosDisks?.publish();
    if (!published) return;
    published.forEach((image, drive) => {
      if (image) super.setMachineProperty(drive ? DISK_B_CHANGES : DISK_A_CHANGES, new Map([[DSK_WHOLE_IMAGE_KEY, image]]) as SectorChanges);
    });
  }

  /** The controller asks for the pending writes before it reads them (a pause, a stop) */
  flushDiskChanges(): void {
    this.publishDiskChanges();
  }

  /** The disk in a drive as a raw `.img` image, the guest's writes included */
  exportDisk(drive: number): Uint8Array | undefined {
    return this.exdosDisks?.image(drive);
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
    // --- A FILE: request returns the frame loop early: answered at once, the frame goes on
    do {
      runtime.exports.epExecuteFrame();
    } while (runtime.exports.epGetFrameCompleted() === 0 && this.serviceHostFs(runtime));
    this.runTapeTurbo(runtime);
    this.publishSavedTape(runtime);
    this.publishDiskChanges();
    this.syncFrameCounters(runtime);
    this.frameCompleted = runtime.exports.epGetFrameCompleted() !== 0;
    this.advanceLoadScript(runtime);
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
      executeInstruction: () => {
        const completed = wasm.epExecuteInstruction() !== 0;
        this.serviceHostFs(runtime);
        return completed;
      },
      // --- The core's own loop runs to the next place the stop policy may stop at (z80-debug-loop.c);
      // --- it returns early for a FILE: request, answered here
      executeUntilStop: (extraStop, mask, accessMask) => {
        const executed = wasm.epExecuteUntilStop(extraStop, mask, accessMask);
        this.serviceHostFs(runtime);
        return executed;
      },
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
      onFrameEnd: () => this.advanceLoadScript(runtime),
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
  // The external joysticks (`.plans/ENTERPRISE_PLAN.md` §9.1)

  /** Each connector's J-column contacts, as rows 0-4 (`left`, joystick 1) and 5-9 (`right`, joystick 2) */
  private joystickRows: Record<JoystickConnector, number> = { left: 0, right: 0 };

  /**
   * The joysticks, driven by the host's joystick bindings (`useEmulatorJoystick`). The CONTROL
   * connectors share the keyboard's row lines: a closed contact pulls B6h bit 0 (the J column) low
   * while its row is selected. Rows 0-4 are joystick 1's fire, up, down, left and right; 5-9 joystick 2's.
   */
  setJoystickState(side: JoystickConnector, bits: number): void {
    const rows =
      (bits & JOY_B ? 0x01 : 0) | (bits & JOY_UP ? 0x02 : 0) | (bits & JOY_DOWN ? 0x04 : 0) | (bits & JOY_LEFT ? 0x08 : 0) | (bits & JOY_RIGHT ? 0x10 : 0);
    this.joystickRows[side] = rows;
    this.wasmV2Runtime?.exports.epSetJoystickJ(this.joystickRows.left | (this.joystickRows.right << 5));
  }

  // ==========================================================================================
  // Klive's FILE: device (`.plans/ENTERPRISE_PLAN.md` §9.2, `EpHostFs.ts`)

  /** The device's channels */
  readonly hostFs = new EpHostFs();
  /** Where its files live: set by the tests; the app's is the main process (`EpMainFileStore`) */
  hostFileStore?: EpHostFileStore;
  /** A call waiting for the file store: the frame command the controller runs */
  private hostFsPending?: EpHostFsAsync;

  override getFrameCommand(): any {
    return this.hostFsPending ? { command: "ep-hostfs" } : undefined;
  }

  override setFrameCommand(command: any): void {
    if (!command) this.hostFsPending = undefined;
  }

  /** Runs the call that needs the file store, then lets the waiting CPU go on */
  override async processFrameCommand(messenger?: Messenger): Promise<void> {
    const pending = this.hostFsPending;
    const runtime = this.wasmV2Runtime;
    if (!pending || !runtime) return;
    this.hostFsPending = undefined;
    const backing = this.hostFileStore ?? (messenger ? new EpMainFileStore(messenger, this.getMachineProperty(EP_FILEIO_FOLDER)) : undefined);
    // --- Run's staged program first (`EpWasmHost.stagedHostFiles`), then the folder
    const store = this.stagedHostFiles.size ? stagedFileStore(this.stagedHostFiles, backing) : backing;
    try {
      if (store) await pending(store);
    } catch (err) {
      console.log("Enterprise FILE: device error", err);
    }
    runtime.exports.epHostFsDone();
  }

  /**
   * Answers a new FILE: request, if there is one: at once when it needs no file store (returns true,
   * the CPU goes on), or later as a frame command (the CPU waits). Returns whether one was answered.
   */
  private serviceHostFs(runtime: EpWasmV2Runtime): boolean {
    const w = runtime.exports;
    const request = w.epHostFsGetRequest();
    if (request >> 8 !== 1) return false;
    w.epHostFsTake();
    const pending = this.hostFs.service({
      call: request & 0xff,
      getBc: () => w.epGetCpuBc(),
      setBc: (v) => w.epSetCpuBc(v & 0xffff),
      getDe: () => w.epGetCpuDe(),
      setDe: (v) => w.epSetCpuDe(v & 0xffff),
      getSp: () => w.epGetCpuSp(),
      read: (a) => w.epReadMemory(a & 0xffff),
      write: (a, v) => w.epWriteMemory(a & 0xffff, v & 0xff),
      readPhysical: (a) => w.epReadPhysical(a),
      writePhysical: (a, v) => w.epWritePhysical(a, v & 0xff)
    });
    if (pending) {
      // --- A synchronous store (the headless runner's) answers inside the frame
      const store = this.syncHostStore();
      if (!store) {
        this.hostFsPending = pending;
        return false;
      }
      void pending(store);
    }
    w.epHostFsDone();
    return true;
  }

  /** The store FILE: uses, when it answers synchronously (`EpHostFileStore.synchronous`) */
  private syncHostStore(): EpHostFileStore | undefined {
    const backing = this.hostFileStore;
    if (!backing?.synchronous) return undefined;
    return this.stagedHostFiles.size ? stagedFileStore(this.stagedHostFiles, backing) : backing;
  }

  // ==========================================================================================
  // Tape (`.plans/ENTERPRISE_PLAN.md` §9.3, `wasm/ep/ep-tape.c`, `EpTapeFile.ts`)

  /** Decodes the core's SAVE recording as it grows */
  private readonly tapeRecorder = new EpTapeRecorder();
  /** Load and Run's steps still to do, each once EXOS shows what it waits for: "banner" (a key), then the command */
  private loadScript: string[] = [];
  private loadScriptIdleFrames = 0;
  private loadScriptAge = 0;

  /** At setup: the deck's tape to the core, the recording read from the core's current count */
  private setupTape(runtime: EpWasmV2Runtime): void {
    this.tapeRecorder.sync(runtime.exports.epTapeGetSavedLength());
    this.uploadTape(runtime, this.getMachineProperty(MEDIA_TAPE));
  }

  /** The deck's machine properties: a tape put in or taken out, a rewind */
  private onTapeProperty(runtime: EpWasmV2Runtime, key: string, value: unknown): void {
    if (key === MEDIA_TAPE) this.uploadTape(runtime, value);
    else if (key === REWIND_REQUESTED && (value === true || value === undefined)) runtime.exports.epTapeRewind();
  }

  /**
   * Puts a tape in the deck: its tape program goes to the core, which plays it while a remote relay
   * runs the motor. Anything that is not an Enterprise tape empties the deck.
   */
  private uploadTape(runtime: EpWasmV2Runtime, value: unknown): void {
    if (!isEpTapeFile(value)) {
      runtime.exports.epTapeSetLength(0);
      return;
    }
    if (value.program.length > runtime.tapeProgram.length) {
      throw new Error(`The tape is too long: ${value.program.length} words (at most ${runtime.tapeProgram.length}).`);
    }
    writeCoreBytes(runtime, runtime.tapeProgram, value.program);
    runtime.exports.epTapeSetLength(value.program.length);
  }

  /**
   * Load and Run (`tape-load -r`): the machine starts, and the frame loop presses a key at EXOS's
   * banner and types a command at IS-BASIC's prompt: `RUN "TAPE:"` for an IS-BASIC program (it loads
   * and runs it), `LOAD "TAPE:"` for anything else (an application module starts itself). EXOS idles in
   * the same loop at the banner and at the prompt, so the steps watch the screen, not an address.
   * @throws when there is no Enterprise tape in the deck
   */
  getTapeLoadFlow(): CodeInjectionFlow {
    const tape = this.getMachineProperty(MEDIA_TAPE);
    if (!isEpTapeFile(tape)) throw new Error("There is no Enterprise tape in the deck.");
    this.loadScript = ["banner", tape.moduleType === 4 ? 'RUN "TAPE:"\n' : 'LOAD "TAPE:"\n'];
    this.loadScriptIdleFrames = 0;
    this.loadScriptAge = 0;
    return [{ type: "Start", message: "EXOS starts; IS-BASIC loads the tape" }, { type: "KeepPc" }];
  }

  /** The tape-load steps still to do (the tests read it) */
  get pendingLoadCommands(): readonly string[] {
    return this.loadScript;
  }

  /** The text rows of EXOS's character-mode LPBs (as the harness's `screenText` reads them) */
  private screenRows(runtime: EpWasmV2Runtime): string[] {
    const vram = (a: number) => runtime.memory[EP_PHYS_VRAM + (a & 0xffff)];
    const rows: string[] = [];
    for (const block of readEpLpt(vram, runtime.exports.epNickGetLptBase())) {
      if (block.mode < 3 || block.mode > 5 || block.rm <= block.lm) continue;
      let row = "";
      for (let i = 0; i < block.rm - block.lm; i++) {
        const code = vram(block.ld1 + i) & 0x7f;
        row += code >= 0x20 && code < 0x7f ? String.fromCharCode(code) : " ";
      }
      rows.push(row.trim());
    }
    return rows;
  }

  /**
   * Does the load script's next step once EXOS waits for it, two frames in a row with nothing being
   * typed and the motor off: the banner (its copyright line) for the key, IS-BASIC's "ok" as the last
   * line for a command. A reverse-debugging replay types nothing (the journal replays the keys the live
   * run typed); a script that never finishes is dropped.
   */
  private advanceLoadScript(runtime: EpWasmV2Runtime): void {
    if (this.loadScript.length === 0 || this.executionContext.isReplayingHistory?.()) return;
    if (++this.loadScriptAge > LOAD_SCRIPT_TIMEOUT_FRAMES) {
      this.loadScript = [];
      return;
    }
    const w = runtime.exports;
    let ready = this.getKeyQueueLength() === 0 && w.epTapeGetMotor() === 0;
    if (ready) {
      const rows = this.screenRows(runtime);
      if (this.loadScript[0] === "banner") {
        ready = rows.some((row) => row.includes("Intelligent Software Ltd"));
        // --- A machine already past the banner goes straight to the command
        if (!ready && rows.some((row) => row.includes("IS-BASIC"))) this.loadScript.shift();
      } else {
        ready = rows.filter((row) => row !== "").pop() === "ok";
      }
    }
    this.loadScriptIdleFrames = ready ? this.loadScriptIdleFrames + 1 : 0;
    if (this.loadScriptIdleFrames >= 2) {
      this.loadScriptIdleFrames = 0;
      const step = this.loadScript.shift()!;
      this.typeText(step === "banner" ? " " : step, 10);
    }
  }

  /** Whether the tape plays with its motor on: fast load runs several frames for each one shown */
  private get isTapeLoading(): boolean {
    const w = this.wasmV2Runtime?.exports;
    return !!w && w.epTapeGetPlaying() !== 0 && w.epTapeGetMotor() !== 0;
  }

  /** Fast load (`FAST_LOAD`, on by default): more machine frames while the tape plays */
  private runTapeTurbo(runtime: EpWasmV2Runtime): void {
    const fast = this.getMachineProperty(FAST_LOAD);
    if (fast !== undefined && !fast) return;
    for (let i = 1; i < FAST_LOAD_FRAMES && this.isTapeLoading && runtime.exports.epGetFrameCompleted() !== 0; i++) {
      do {
        runtime.exports.epExecuteFrame();
      } while (runtime.exports.epGetFrameCompleted() === 0 && this.serviceHostFs(runtime));
    }
  }

  /**
   * Hands a file EXOS saved to the host as an ep128emu `.tap` (`SAVED_TO_TAPE`), as the other machines
   * hand over theirs, once its last chunk is recorded and every CRC checks
   */
  private publishSavedTape(runtime: EpWasmV2Runtime): void {
    const files = this.tapeRecorder.feed(runtime.savedData, runtime.exports.epTapeGetSavedLength());
    for (const file of files) {
      super.setMachineProperty(SAVED_TO_TAPE, { name: `${file.name || "enterprise"}.tap`, contents: file.tap });
    }
  }

  // ==========================================================================================
  // Partitions (`.plans/ENTERPRISE_PLAN.md` §11): the 256 segments, numbered as DAVE numbers them and
  // labelled by that number in hex; the chooser describes and groups them (`epMachineInfo.ts`).

  /** The segment each 8K slot shows (a 16K page's register, twice), as the IDE's slot paging counts */
  override getCurrentPartitions(): number[] {
    const wasm = this.wasmV2Runtime?.exports;
    if (!wasm) return [];
    return [0, 1, 2, 3, 4, 5, 6, 7].map((slot) => wasm.epGetPageRegister(slot >> 1));
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

  override getPartitionDescriptions(): Record<number, string> {
    return epPartitionDescriptions(this.hardware);
  }

  override getPartitionGroups(): Record<number, string> {
    return epPartitionGroups(this.hardware);
  }

  override parsePartitionLabel(label: string): number | undefined {
    const wanted = label.trim().toUpperCase();
    if (!/^[0-9A-F]{1,2}$/.test(wanted)) return undefined;
    return parseInt(wanted, 16);
  }

  /**
   * The ROM segments as the ROM annotations see them: each fitted one its own page, by its segment
   * number (EXOS 00h-01h always; the cartridge 04h, the FILE: ROM 10h and EXDOS 20h-21h when fitted),
   * so the sidecar of the file whose page it holds applies to it. An empty ROM slot is no page.
   */
  protected override getRomPartitionImages(): Map<number, Uint8Array> {
    const hw = this.hardware;
    const fitted: Record<number, boolean> = {
      0x00: true,
      0x01: true,
      0x04: hw.cartridge,
      0x10: hw.hostFs,
      0x20: hw.exdos,
      0x21: hw.exdos
    };
    const images = new Map<number, Uint8Array>();
    for (const segment of EP_ROM_SEGMENTS) {
      if (fitted[segment]) images.set(segment, this.getMemoryPartition(segment).slice());
    }
    return images;
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
   * Whether the television has lost the picture (no vertical sync for two frames). Only once the
   * machine has run a frame: a machine that has not run has no last frame to judge.
   */
  isVideoSignalLost(): boolean {
    const exports = this.wasmV2Runtime?.exports;
    if (!exports || exports.epGetFrames() === 0) return false;
    return exports.epIsVideoSignalLost() !== 0;
  }

  /**
   * The beam position overlay. The frame starts where vertical sync starts, at a slot the LPT chooses
   * (EXOS's: slot 6); buffer pixel (0, 0) is slot 10 of the 25th line after it. A slot is 16 pixels.
   * The paper is EXOS's text screen: slots 12-51 (its margins, one slot late), 252 lines from the
   * 18th row. A program with another LPT moves the picture, and the paper outline no longer matches it.
   */
  getBeamPosition(): BeamPosition {
    const w = this.requireWasmV2Runtime().exports;
    const timing: BeamTiming = {
      unit: "T",
      tactsPerLine: EP_TACTS_PER_LINE,
      linesPerFrame: 312,
      firstVisibleTact: EP_TV_FIRST_LINE * EP_TACTS_PER_LINE + (EP_TV_FIRST_SLOT - w.epNickGetSyncSlot()) * EP_TACTS_PER_SLOT,
      tactsPerBufferPixel: EP_TACTS_PER_SLOT / 16,
      bufferWidth: EP_SCREEN_WIDTH,
      bufferHeight: EP_SCREEN_HEIGHT,
      paperLeft: 32,
      paperTop: 18,
      paperWidth: 640,
      paperHeight: 252
    };
    const frameTact = w.epGetFrameTacts();
    return beamAt(timing, frameTact, drawnUpTo(timing, frameTact));
  }

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
    this.hostFs.reset();
    this.hostFsPending = undefined;
    this.frameCompleted = w.epGetFrameCompleted() !== 0;
    this.syncCpuFromWasmV2(runtime);
  }

  /** Nothing is pushed into the core lazily (it has no clock multiplier), so there is nothing to forget */
  invalidateHostSync(): void {}


  // ==========================================================================================
  // The NICK and DAVE panels (`.plans/ENTERPRISE_PLAN.md` §11, `EpDebugState.ts`)

  /** NICK's ports, counters, current LPB and LPT, for the NICK panel */
  getEpNickState(): EpNickDebugState {
    const runtime = this.requireWasmV2Runtime();
    return readEpNickDebugState(runtime.exports, runtime.memory);
  }

  /** DAVE's page registers, interrupts, BFh and sound registers, for the DAVE panel */
  getEpDaveState(): EpDaveDebugState {
    return readEpDaveDebugState(this.requireWasmV2Runtime().exports, this.getPartitionLabels());
  }

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
