import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";
import type { CpuState, TvcVideoState } from "@common/messaging/EmuApi";
import type { TvcWasmV2LoaderOptions, TvcWasmV2Runtime } from "./wasm/TvcWasmV2Loader";

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
import { loadTvcWasmV2 } from "./wasm/TvcWasmV2Loader";
import { TvcWasmHost } from "./TvcWasmHost";
import { TVC_ROM_SETS } from "./TvcRoms";
import {
  TVC_BANK_SIZE,
  TVC_PARTITION_CART,
  TVC_PARTITION_EXT,
  TVC_PARTITION_SYS,
  TVC_PHYS_CART,
  TVC_PHYS_EXT_CARD,
  TVC_PHYS_SYS,
  TVC_PIXEL_ASPECT,
  TVC12_KEY_WAIT_ROUTINE,
  TVC22_KEY_WAIT_ROUTINE
} from "./tvcMachineInfo";
import { TvcKeyCode } from "./TvcKeyCode";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import { beamAt, drawnUpTo, type BeamPosition, type BeamTiming } from "@common/utils/beamGeometry";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import { AUDIO_SAMPLE_RATE, FAST_LOAD, REWIND_REQUESTED, SAVED_TO_TAPE } from "../machine-props";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { isTvcTapeFile, tvcSavedFileOf } from "./TvcCasFile";

/** The DC filter's cut-off, as the other cores' (`AudioDeviceBase.DC_FILTER_CUTOFF_HZ`); the core has no `exp` */
const DC_FILTER_CUTOFF_HZ = 1.4;

/**
 * Fast load (`FAST_LOAD`, on by default): while the tape plays with its motor on, a displayed frame
 * runs this many machine frames. The ROM decodes the real signal - nothing is trapped - so a load
 * behaves exactly as at normal speed, only sooner. The sound of the skipped frames is dropped.
 */
const FAST_LOAD_FRAMES = 25;

/** Frames a tape-load script waits for BASIC's prompt before it is dropped (two minutes) */
const LOAD_SCRIPT_TIMEOUT_FRAMES = 6000;

/**
 * The raster as the beam overlay sees it (`getBeamPosition`), for the BASIC ROM's CRTC values (100
 * characters of 2 T, 314 lines). Buffer pixel (0, 0) is drawn at character 95 of line 289, 25 lines
 * and 190 T before the frame starts (`tvc-video.c`: the window starts 18 characters after the line
 * sync, 26 line syncs after the frame sync); a dot is a quarter T-state. A program that reprograms
 * the CRTC moves the picture, and this map then no longer matches it.
 */
const TVC_BEAM_TIMING: BeamTiming = {
  unit: "T",
  tactsPerLine: 200,
  linesPerFrame: 314,
  firstVisibleTact: -25 * 200 + 95 * 2,
  tactsPerBufferPixel: 0.25,
  bufferWidth: 608,
  bufferHeight: 288,
  paperLeft: 48,
  paperTop: 24,
  paperWidth: 512,
  paperHeight: 240
};

/**
 * A Videoton TVC on the WASM core (`wasm/tvc/`, `.plans/VIDEOTON_TVC_PLAN.md`): one core for both
 * models, configured by the model at setup.
 *
 * The registers are read live from the core and every write is pushed into it; the debugger runs
 * instruction by instruction, or - when the stop policy can only stop at known addresses - the core
 * runs on to the next candidate, exactly as on the HT-1080Z.
 *
 * The core carries the shared execution-history recorder and access profile, and its whole state is
 * its linear memory: state files and reverse debugging save and restore that image.
 */
export class TvcWasmV2Machine extends TvcWasmHost implements IExecutionHistorySource, IAccessProfileSource {
  // ==============================================================================================
  // Execution history: the shared recorder in the core, read through the shared reader; the
  // machine id names the context decoder (`contexts/tvcContext.ts`)

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
  // (`layouts/tvc.ts`)

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
  public wasmV2Runtime?: TvcWasmV2Runtime;

  private screenPixels?: Uint32Array;
  private screenPixelBytes?: Uint8ClampedArray;
  /** The core's SAVE revision already published (`tvcTapeGetSavedRevision`) */
  private savedTapeRevision = 0;
  /**
   * The tape-load flow's commands still to type, each once BASIC is idle at its prompt again (RUN
   * after a program that does not start itself), and how long the script has waited
   */
  private loadScript: string[] = [];
  private loadScriptIdleFrames = 0;
  private loadScriptAge = 0;
  /** The current frame's samples; the array and its objects are reused, as the HT-1080Z's are */
  private readonly wasmV2AudioSamples: AudioSample[] = [];

  constructor(
    machineId: string,
    modelInfo?: MachineModel,
    config?: MachineConfigSet,
    messenger?: MessengerBase,
    private readonly wasmV2LoaderOptions?: TvcWasmV2LoaderOptions
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
    return this.w ? this.w.tvcGetCpuAf() : super.af;
  }
  override set af(value: number) {
    super.af = value;
    this.w?.tvcSetCpuAf(super.af);
  }
  override get bc(): number {
    return this.w ? this.w.tvcGetCpuBc() : super.bc;
  }
  override set bc(value: number) {
    super.bc = value;
    this.w?.tvcSetCpuBc(super.bc);
  }
  override get de(): number {
    return this.w ? this.w.tvcGetCpuDe() : super.de;
  }
  override set de(value: number) {
    super.de = value;
    this.w?.tvcSetCpuDe(super.de);
  }
  override get hl(): number {
    return this.w ? this.w.tvcGetCpuHl() : super.hl;
  }
  override set hl(value: number) {
    super.hl = value;
    this.w?.tvcSetCpuHl(super.hl);
  }
  override get af_(): number {
    return this.w ? this.w.tvcGetCpuAfAlt() : super.af_;
  }
  override set af_(value: number) {
    super.af_ = value;
    this.w?.tvcSetCpuAfAlt(super.af_);
  }
  override get bc_(): number {
    return this.w ? this.w.tvcGetCpuBcAlt() : super.bc_;
  }
  override set bc_(value: number) {
    super.bc_ = value;
    this.w?.tvcSetCpuBcAlt(super.bc_);
  }
  override get de_(): number {
    return this.w ? this.w.tvcGetCpuDeAlt() : super.de_;
  }
  override set de_(value: number) {
    super.de_ = value;
    this.w?.tvcSetCpuDeAlt(super.de_);
  }
  override get hl_(): number {
    return this.w ? this.w.tvcGetCpuHlAlt() : super.hl_;
  }
  override set hl_(value: number) {
    super.hl_ = value;
    this.w?.tvcSetCpuHlAlt(super.hl_);
  }
  override get ix(): number {
    return this.w ? this.w.tvcGetCpuIx() : super.ix;
  }
  override set ix(value: number) {
    super.ix = value;
    this.w?.tvcSetCpuIx(super.ix);
  }
  override get iy(): number {
    return this.w ? this.w.tvcGetCpuIy() : super.iy;
  }
  override set iy(value: number) {
    super.iy = value;
    this.w?.tvcSetCpuIy(super.iy);
  }
  override get ir(): number {
    return this.w ? this.w.tvcGetCpuIr() : super.ir;
  }
  override set ir(value: number) {
    super.ir = value;
    this.w?.tvcSetCpuIr(super.ir);
  }
  override get wz(): number {
    return this.w ? this.w.tvcGetCpuWz() : super.wz;
  }
  override set wz(value: number) {
    super.wz = value;
    this.w?.tvcSetCpuWz(super.wz);
  }
  override get pc(): number {
    return this.w ? this.w.tvcGetCpuPc() : super.pc;
  }
  override set pc(value: number) {
    super.pc = value;
    this.w?.tvcSetCpuPc(super.pc);
  }
  override get sp(): number {
    return this.w ? this.w.tvcGetCpuSp() : super.sp;
  }
  override set sp(value: number) {
    super.sp = value;
    this.w?.tvcSetCpuSp(super.sp);
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
    return this.w ? this.w.tvcGetCpuIff1() !== 0 : super.iff1;
  }
  override set iff1(value: boolean) {
    super.iff1 = value;
    this.w?.tvcSetCpuIff1(value ? 1 : 0);
  }
  override get iff2(): boolean {
    return this.w ? this.w.tvcGetCpuIff2() !== 0 : super.iff2;
  }
  override set iff2(value: boolean) {
    super.iff2 = value;
    this.w?.tvcSetCpuIff2(value ? 1 : 0);
  }
  override get interruptMode(): number {
    return this.w ? this.w.tvcGetCpuInterruptMode() : super.interruptMode;
  }
  override set interruptMode(value: number) {
    super.interruptMode = value;
    this.w?.tvcSetCpuInterruptMode(value);
  }

  override setTacts(value: number): void {
    super.setTacts(value);
    this.w?.tvcSetTacts(value >>> 0);
  }

  // ==========================================================================================
  // Lifecycle

  /** Loads the core (once), configures the model, uploads its ROMs and powers the machine on */
  async setup(): Promise<void> {
    if (this.wasmV2Runtime == null) {
      this.wasmV2Runtime = await loadTvcWasmV2(this.wasmV2LoaderOptions);
    }
    const runtime = this.wasmV2Runtime;
    const hw = this.hardware;
    runtime.exports.tvcConfigure(hw.plus ? 1 : 0);
    const romSet = TVC_ROM_SETS[hw.romSet];
    const sysLow = await this.loadRomFromResource(romSet.sysLow.name);
    const sysHigh = await this.loadRomFromResource(romSet.sysHigh.name);
    const exth = await this.loadRomFromResource(romSet.exth.name);
    fillCoreBytes(runtime, runtime.sysRom, 0xff);
    writeCoreBytes(runtime, runtime.sysRom, sysLow.subarray(0, romSet.sysLow.size));
    writeCoreBytes(runtime, runtime.sysRom, sysHigh.subarray(0, romSet.sysHigh.size), romSet.sysLow.size);
    fillCoreBytes(runtime, runtime.exthRom, 0xff);
    writeCoreBytes(runtime, runtime.exthRom, exth.subarray(0, romSet.exth.size));
    // --- No cartridge: the CART bank reads FFh
    fillCoreBytes(runtime, runtime.cartRom, 0xff);
    const words = runtime.exports.tvcGetScreenWidth() * runtime.exports.tvcGetScreenHeight();
    this.screenPixels = runtime.pixelBuffer.subarray(0, words);
    this.screenPixelBytes = runtime.pixelBufferBytes.subarray(0, words * 4);
    this.baseClockFrequency = runtime.exports.tvcGetBaseClockFrequency();
    this.setTactsInFrame(runtime.exports.tvcGetTactsInFrame());
    runtime.exports.tvcHardReset();
    this.syncAudioSampleRate(runtime);
    this.savedTapeRevision = runtime.exports.tvcTapeGetSavedRevision();
    this.uploadTape(runtime, this.getMachineProperty(MEDIA_TAPE));
    this.syncCpuFromWasmV2(runtime);
  }

  override setMachineProperty(key: string, value?: any): void {
    super.setMachineProperty(key, value);
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return;
    switch (key) {
      case AUDIO_SAMPLE_RATE:
        this.syncAudioSampleRate(runtime);
        break;
      case MEDIA_TAPE:
        this.uploadTape(runtime, value);
        break;
      case REWIND_REQUESTED:
        if (value === true || value === undefined) runtime.exports.tvcTapeRewind();
        break;
    }
  }

  // ==========================================================================================
  // Tape and sound (`.plans/VIDEOTON_TVC_PLAN.md` §9-10, `wasm/tvc/tvc-tape.c`, `tvc-audio.c`)

  /**
   * Puts a tape in the deck: its tape program goes to the core, which plays it while the recorder's
   * motor runs. Anything that is not a TVC tape empties the deck.
   */
  private uploadTape(runtime: TvcWasmV2Runtime, value: unknown): void {
    if (!isTvcTapeFile(value)) {
      runtime.exports.tvcTapeSetLength(0);
      return;
    }
    if (value.program.length > runtime.tapeProgram.length) {
      throw new Error(`The tape is too long: ${value.program.length} words (at most ${runtime.tapeProgram.length}).`);
    }
    writeCoreBytes(runtime, runtime.tapeProgram, value.program);
    runtime.exports.tvcTapeSetLength(value.program.length);
  }

  /**
   * Load and Run (`tape-load -r`): power on, dismiss the sign-on, type `LOAD` at the prompt. A program
   * that starts itself (the autostart flag, as Klive's export writes) runs once loaded; for any other,
   * `RUN` is typed when BASIC is back at its prompt.
   * @throws when there is no TVC tape in the deck
   */
  getTapeLoadFlow(): CodeInjectionFlow {
    const tape = this.getMachineProperty(MEDIA_TAPE);
    if (!isTvcTapeFile(tape)) throw new Error("There is no Videoton TVC tape in the deck.");
    this.loadScript = tape.autostart ? [] : ["RUN\n"];
    this.loadScriptIdleFrames = 0;
    this.loadScriptAge = 0;
    return [
      { type: "ReachExecPoint", rom: 0, execPoint: this.signOnLoop, message: "The TVC shows its sign-on screen" },
      { type: "QueueKey", primary: TvcKeyCode.Space, delayFrames: 10, wait: 0 },
      { type: "Start" },
      { type: "WaitKeyQueue" },
      { type: "ReachExecPoint", rom: 0, execPoint: this.keyWaitLoop, message: "BASIC is at its prompt" },
      { type: "TypeText", text: "LOAD\n", delayFrames: 10 },
      { type: "KeepPc" }
    ];
  }

  /** The tape-load commands still to type (the tests read it) */
  get pendingLoadCommands(): readonly string[] {
    return this.loadScript;
  }

  /**
   * Types the load script's next command once BASIC is idle at its prompt: in its key wait at the
   * end of two frames in a row, with nothing being typed and the recorder's motor off. A
   * reverse-debugging replay types nothing (the journal replays the keys the live run typed); a script
   * that never finishes is dropped.
   */
  private advanceLoadScript(runtime: TvcWasmV2Runtime): void {
    if (this.loadScript.length === 0 || this.executionContext.isReplayingHistory?.()) return;
    if (++this.loadScriptAge > LOAD_SCRIPT_TIMEOUT_FRAMES) {
      this.loadScript = [];
      return;
    }
    const w = runtime.exports;
    const [from, to] = this.hardware.romSet === "22" ? TVC22_KEY_WAIT_ROUTINE : TVC12_KEY_WAIT_ROUTINE;
    const pc = w.tvcGetCpuPc();
    const idle =
      pc >= from && pc < to && ((w.tvcGetPort02() >> 6) & 3) === 1 && this.getKeyQueueLength() === 0 && w.tvcTapeGetMotor() === 0;
    this.loadScriptIdleFrames = idle ? this.loadScriptIdleFrames + 1 : 0;
    if (this.loadScriptIdleFrames >= 2) {
      this.loadScriptIdleFrames = 0;
      this.typeText(this.loadScript.shift()!, 10);
    }
  }

  /** Whether the tape plays with its motor on: fast load runs several frames for each one shown */
  private get isTapeLoading(): boolean {
    const w = this.wasmV2Runtime?.exports;
    return !!w && w.tvcTapeGetPlaying() !== 0 && w.tvcTapeGetMotor() !== 0;
  }

  /**
   * Hands a SAVE the ROM finished to the host as a `.cas` (`SAVED_TO_TAPE`), as the other machines
   * hand over theirs: a new revision of the core's recording is a new file, published when it is a
   * whole, valid one
   */
  private publishSavedTape(runtime: TvcWasmV2Runtime): void {
    const revision = runtime.exports.tvcTapeGetSavedRevision();
    if (revision === this.savedTapeRevision) return;
    this.savedTapeRevision = revision;
    const recording = new Uint8Array(runtime.savedData.subarray(0, runtime.exports.tvcTapeGetSavedLength()));
    const saved = tvcSavedFileOf(recording);
    if (saved) super.setMachineProperty(SAVED_TO_TAPE, { name: `${saved.name || "tvc"}.cas`, contents: saved.cas });
  }

  /** The host's audio rate (`AUDIO_SAMPLE_RATE`) and the DC filter's coefficient for it */
  private syncAudioSampleRate(runtime: TvcWasmV2Runtime): void {
    const rate = this.getMachineProperty(AUDIO_SAMPLE_RATE);
    if (typeof rate === "number" && rate > 0) {
      runtime.exports.tvcSetAudioSampleRate(rate, Math.exp((-2 * Math.PI * DC_FILTER_CUTOFF_HZ) / rate));
    }
  }

  /** The current frame's samples, read from the core's buffer */
  getAudioSamples(): AudioSample[] {
    const runtime = this.requireWasmV2Runtime();
    const values = runtime.audioSamples;
    const count = runtime.exports.tvcGetAudioSampleCount();
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
      runtime.exports.tvcHardReset();
      this.syncCpuFromWasmV2(runtime);
    }
  }

  override reset(): void {
    super.reset();
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      runtime.exports.tvcReset();
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
    runtime.exports.tvcExecuteFrame();
    // --- Fast load: more machine frames while the tape plays (FAST_LOAD_FRAMES)
    const fast = this.getMachineProperty(FAST_LOAD);
    if (fast === undefined || fast) {
      for (let i = 1; i < FAST_LOAD_FRAMES && this.isTapeLoading; i++) runtime.exports.tvcExecuteFrame();
    }
    this.publishSavedTape(runtime);
    this.syncFrameCounters(runtime);
    this.frameCompleted = runtime.exports.tvcGetFrameCompleted() !== 0;
    this.advanceLoadScript(runtime);
    this.executionContext.lastTerminationReason = FrameTerminationMode.Normal;
    return FrameTerminationMode.Normal;
  }

  /** The debug path, as the HT-1080Z's: one instruction at a time, or on to the next candidate stop */
  private debugLoopHost?: { runtime: TvcWasmV2Runtime; host: WasmDebugLoopHost };

  private executeDebugLoop(runtime: TvcWasmV2Runtime): FrameTerminationMode {
    if (this.debugLoopHost?.runtime !== runtime) {
      this.debugLoopHost = { runtime, host: this.createDebugLoopHost(runtime) };
    }
    return runWasmDebugLoop(this.debugLoopHost.host);
  }

  private createDebugLoopHost(runtime: TvcWasmV2Runtime): WasmDebugLoopHost {
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
      executeInstruction: () => wasm.tvcExecuteInstruction() !== 0,
      // --- The core's own loop runs to the next place the stop policy may stop at (z80-debug-loop.c)
      executeUntilStop: (extraStop, mask, accessMask) => wasm.tvcExecuteUntilStop(extraStop, mask, accessMask),
      lastOpStart: () => wasm.tvcGetDebugOpStart(),
      pushBreakpointFlags: (flags) => runtime.breakpointFlags.set(flags),
      conditionPlan: () => runtime.condPlan,
      coreFrameCompleted: () => wasm.tvcGetFrameCompleted() !== 0,
      // --- Past this class's `pc` setter, which would push the value just read from the core back into it
      mirrorPc: () => {
        const pc = wasm.tvcGetCpuPc();
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
    this.executionContext.lastTerminationReason = termination;
    return termination;
  }

  override getInterruptDepth(): number {
    return this.w ? this.w.tvcGetInterruptDepth() : super.getInterruptDepth();
  }

  override markStepOutAddress(): void {
    this.stepOutAddress = stepOutAddressFromCore(this.requireWasmV2Runtime().exports.tvcGetStepOutAddress());
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
  private importBusAccess(runtime: TvcWasmV2Runtime): void {
    const wasm = runtime.exports;
    this.lastIoReadPort = undefined;
    this.lastIoWritePort = undefined;
    importAccessLog(this, runtime.accessLog, wasm.tvcGetAccessLogCount());
    const portAddress = wasm.tvcGetLastPortAddress();
    const portValue = wasm.tvcGetLastPortValue();
    if (wasm.tvcGetLastPortIsWrite() !== 0) {
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
    return this.requireWasmV2Runtime().exports.tvcReadMemory(address & 0xffff);
  }

  override doWriteMemory(address: number, value: number): void {
    this.requireWasmV2Runtime().exports.tvcWriteMemory(address & 0xffff, value & 0xff);
  }

  // ==========================================================================================
  // Partitions (`.plans/VIDEOTON_TVC_PLAN.md` §11): the physical memory as 16K partitions - U0-U3
  // and VID0-VID3 are 0-7, SYS -1, CART -2, EXT -3 (the card window and EXTH, as page 3 shows them)

  /** The partition a physical offset is in */
  private partitionOfPhysical(physical: number): number {
    if (physical < TVC_PHYS_SYS) return physical >> 14;
    if (physical < TVC_PHYS_CART) return TVC_PARTITION_SYS;
    if (physical < TVC_PHYS_EXT_CARD) return TVC_PARTITION_CART;
    return TVC_PARTITION_EXT;
  }

  /** The first physical offset of a partition */
  private physicalOfPartition(partition: number): number {
    if (partition >= 0) return (partition & 0x07) * TVC_BANK_SIZE;
    if (partition === TVC_PARTITION_SYS) return TVC_PHYS_SYS;
    if (partition === TVC_PARTITION_CART) return TVC_PHYS_CART;
    return TVC_PHYS_EXT_CARD;
  }

  /** The partition of each 8K slot, as the paging shows it now */
  override getCurrentPartitions(): number[] {
    const wasm = this.wasmV2Runtime?.exports;
    if (!wasm) return [];
    return [0, 1, 2, 3, 4, 5, 6, 7].map((slot) => this.partitionOfPhysical(wasm.tvcGetPhysicalAddress(slot * 0x2000)));
  }

  override getCurrentPartitionLabels(): string[] {
    const labels = this.getPartitionLabels();
    return this.getCurrentPartitions().map((partition) => labels[partition] ?? "");
  }

  /** U0-U3, the video banks (one on the 64K, four on the 64K+), SYS, CART and EXT */
  override getPartitionLabels(): Record<number, string> {
    const labels: Record<number, string> = {
      [TVC_PARTITION_EXT]: "EXT",
      [TVC_PARTITION_CART]: "CART",
      [TVC_PARTITION_SYS]: "SYS",
      0: "U0",
      1: "U1",
      2: "U2",
      3: "U3",
      4: "V0"
    };
    if (this.hardware.plus) Object.assign(labels, { 5: "V1", 6: "V2", 7: "V3" });
    return labels;
  }

  override parsePartitionLabel(label: string): number | undefined {
    const wanted = label.trim().toUpperCase();
    const found = Object.entries(this.getPartitionLabels()).find(([, l]) => l === wanted);
    return found ? Number(found[0]) : undefined;
  }

  /** A partition's 16K, straight from the core's physical memory */
  override getMemoryPartition(index: number): Uint8Array {
    const runtime = this.requireWasmV2Runtime();
    const start = this.physicalOfPartition(index);
    return runtime.memory.subarray(start, start + TVC_BANK_SIZE);
  }

  override getPartition(address: number): number | undefined {
    return this.getCurrentPartitions()[(address >>> 13) & 0x07];
  }

  /** The 64K as eight 8K pages: a page is ROM when the paging shows SYS, CART or EXTH (or an empty card) there */
  getRomFlags(): boolean[] {
    const wasm = this.wasmV2Runtime?.exports;
    return [0, 1, 2, 3, 4, 5, 6, 7].map((page) => (wasm ? wasm.tvcGetPhysicalAddress(page * 0x2000) >= TVC_PHYS_SYS : page < 2));
  }

  /** The 64K the CPU sees, through the current paging */
  get64KFlatMemory(): Uint8Array {
    const wasm = this.requireWasmV2Runtime().exports;
    const flat = new Uint8Array(0x1_0000);
    for (let address = 0; address < 0x1_0000; address++) flat[address] = wasm.tvcReadMemory(address);
    return flat;
  }

  override doReadPort(address: number): number {
    return this.requireWasmV2Runtime().exports.tvcReadPort(address & 0xffff);
  }

  override doWritePort(address: number, value: number): void {
    this.requireWasmV2Runtime().exports.tvcWritePort(address & 0xffff, value & 0xff);
  }

  // ==========================================================================================
  // Keyboard and screen

  setKeyStatus(key: number, isDown: boolean): void {
    this.requireWasmV2Runtime().exports.tvcSetKeyStatus(key, isDown ? 1 : 0);
  }

  get screenWidthInPixels(): number {
    return this.requireWasmV2Runtime().exports.tvcGetScreenWidth();
  }

  get screenHeightInPixels(): number {
    return this.requireWasmV2Runtime().exports.tvcGetScreenHeight();
  }

  /** TVC dots (12.5 MHz) are narrower than they are tall */
  getAspectRatio = (): [number, number] => [TVC_PIXEL_ASPECT, 1];

  /** Whether the television has lost the picture (a CRTC programmed without usable syncs) */
  isVideoSignalLost(): boolean {
    return this.wasmV2Runtime?.exports.tvcIsVideoSignalLost() !== 0;
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

  /** The beam position overlay: the core draws every character as it runs, so the picture is drawn up to the beam */
  getBeamPosition(): BeamPosition {
    const frameTact = this.requireWasmV2Runtime().exports.tvcGetFrameTacts();
    return beamAt(TVC_BEAM_TIMING, frameTact, drawnUpTo(TVC_BEAM_TIMING, frameTact));
  }

  /** The core draws every character as it runs: the buffer is always up to the beam */
  renderInstantScreen(_savedPixelBuffer?: Uint32Array): Uint32Array {
    return this.getPixelBuffer();
  }

  /** The video circuit, for the TVC Video panel */
  getTvcVideoState(): TvcVideoState {
    const w = this.requireWasmV2Runtime().exports;
    const counters = w.tvcCrtcGetCounters();
    const h = counters & 0xff;
    return {
      crtc: Array.from({ length: 18 }, (_, i) => w.tvcCrtcGetRegister(i)),
      crtcAddress: w.tvcCrtcGetAddressRegister(),
      h,
      raster: (counters >> 8) & 0xff,
      row: (counters >> 16) & 0xff,
      ma: (w.tvcCrtcGetRowStart() + h) & 0x3fff,
      inAdjust: ((counters >> 24) & 1) !== 0,
      mode: w.tvcGetVideoMode(),
      palette: Array.from({ length: 4 }, (_, i) => w.tvcGetPalette(i)),
      border: w.tvcGetBorder(),
      verticalBlank: w.tvcGetVerticalBlank() !== 0,
      itPending: w.tvcGetItPending() !== 0,
      plus: w.tvcGetIsPlus() !== 0,
      port02: w.tvcGetPort02(),
      port0c: w.tvcGetPort0c(),
      displayBank: w.tvcGetDisplayBank()
    };
  }

  getConditionStore(): ConditionStore | undefined {
    return this.wasmV2Runtime ? conditionStoreOf(this.wasmV2Runtime) : undefined;
  }

  // ==========================================================================================
  // State files and reverse debugging (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.5,
  // `.plans/REVERSE_DEBUGGING_PLAN.md` §4.2)

  /**
   * Captures the machine's whole state: the core's memory image, which holds the tape deck and its
   * SAVE recording too. The machine must be paused.
   */
  saveMachineState(): MachineStateParts {
    const runtime = this.requireWasmV2Runtime();
    return {
      ...captureWasmImage("tvc", runtime.module, runtime.exports.memory.buffer),
      host: this.captureHostState()
    };
  }

  /**
   * Puts the machine back into a saved state; the wrapper's mirrors of core state are re-read from it.
   * @throws MachineStateMismatchError when the state was saved by another core or layout
   */
  loadMachineState(parts: MachineStateParts): void {
    const runtime = this.requireWasmV2Runtime();
    restoreWasmImage(parts, "tvc", runtime.module, runtime.exports.memory.buffer);
    this.restoreHostState(parts.host);
    // --- The audio rate is the host's, not the saved machine's
    this.syncAudioSampleRate(runtime);
  }

  /** The core, as the export contract names it */
  get reverseCoreId(): string {
    return "tvc";
  }

  get reverseRuntime(): TvcWasmV2Runtime | undefined {
    return this.wasmV2Runtime;
  }

  readonly reverseFrameExport = "tvcExecuteFrame";

  isAtFrameBoundary(): boolean {
    return this.wasmV2Runtime?.exports.tvcGetFrameCompleted() !== 0;
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
    this.loadScript = [];
    // --- What the core already holds must not be published again as new
    this.savedTapeRevision = w.tvcTapeGetSavedRevision();
    this.frameCompleted = w.tvcGetFrameCompleted() !== 0;
    this.syncCpuFromWasmV2(runtime);
  }

  /** Nothing is pushed into the core lazily (it has no clock multiplier), so there is nothing to forget */
  invalidateHostSync(): void {}


  // ==========================================================================================
  // Helpers

  private syncCpuFromWasmV2(runtime: TvcWasmV2Runtime): void {
    const w = runtime.exports;
    super.af = w.tvcGetCpuAf();
    super.bc = w.tvcGetCpuBc();
    super.de = w.tvcGetCpuDe();
    super.hl = w.tvcGetCpuHl();
    super.af_ = w.tvcGetCpuAfAlt();
    super.bc_ = w.tvcGetCpuBcAlt();
    super.de_ = w.tvcGetCpuDeAlt();
    super.hl_ = w.tvcGetCpuHlAlt();
    super.ix = w.tvcGetCpuIx();
    super.iy = w.tvcGetCpuIy();
    super.ir = w.tvcGetCpuIr();
    super.wz = w.tvcGetCpuWz();
    super.pc = w.tvcGetCpuPc();
    super.sp = w.tvcGetCpuSp();
    super.iff1 = w.tvcGetCpuIff1() !== 0;
    super.iff2 = w.tvcGetCpuIff2() !== 0;
    super.interruptMode = w.tvcGetCpuInterruptMode();
    this.halted = w.tvcGetCpuHalted() !== 0;
    this.opCode = w.tvcGetCpuOpCode();
    this.syncFrameCounters(runtime);
  }

  private syncFrameCounters(runtime: TvcWasmV2Runtime): void {
    const w = runtime.exports;
    super.pc = w.tvcGetCpuPc();
    this.tacts = w.tvcGetTacts();
    this.frames = w.tvcGetFrames();
    this.clockMultiplier = 1;
    this.tactsInCurrentFrame = w.tvcGetTactsInCurrentFrame();
    this.frameTacts = w.tvcGetFrameTacts();
    this.currentFrameTact = this.frameTacts;
    this.opStartAddress = w.tvcGetOpStartAddress();
    this.sigINT = false;
  }

  private requireWasmV2Runtime(): TvcWasmV2Runtime {
    if (this.wasmV2Runtime == null) {
      throw new Error("The TVC WASM core is not loaded; call setup() first.");
    }
    return this.wasmV2Runtime;
  }
}
