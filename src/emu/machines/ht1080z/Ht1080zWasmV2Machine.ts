import { WasmHistorySource } from "../history/WasmHistorySource";
import { WasmProfileSource } from "../profile/WasmProfileSource";
import type { IExecutionHistorySource } from "@emu/abstractions/IExecutionHistorySource";
import type { IAccessProfileSource } from "@emu/abstractions/IAccessProfileSource";
import type { ProfileCounts, ProfileEdge, ProfileInfo, ProfileTouchedByte } from "@common/profile/profileTypes";
import type { ExecutionHistoryInfo, ExecutionHistoryPage } from "@common/history/historyTypes";
import type { HistoryServiceSpan } from "@common/history/serviceSpans";
import { captureWasmImage, restoreWasmImage, type MachineStateParts } from "../state/wasmStateImage";
import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import { beamAt, drawnUpTo, type BeamPosition, type BeamTiming } from "@common/utils/beamGeometry";
import type { MessengerBase } from "@common/messaging/MessengerBase";
import type { CpuState } from "@common/messaging/EmuApi";
import type { Ht1080zWasmV2LoaderOptions, Ht1080zWasmV2Runtime } from "./wasm/Ht1080zWasmV2Loader";

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
import { fillCoreBytes, writeCoreBytes } from "@emu/machines/reverse/coreMemoryWrites";
import { loadHt1080zWasmV2 } from "./wasm/Ht1080zWasmV2Loader";
import { Ht1080zWasmHost } from "./Ht1080zWasmHost";
import { HT1080Z_ROM_SETS } from "./Ht1080zRoms";
import { HT1080Z_PIXEL_ASPECT } from "./ht1080zMachineInfo";
import { HT1080Z_FIRST_SWITCH_KEY, Ht1080zKeyCode } from "./Ht1080zKeyCode";
import {
  AUDIO_SAMPLE_RATE,
  FAST_LOAD,
  HT_VIDEO_CUT,
  HT_VIDEO_DASH,
  HT_VIDEO_PAGE,
  REWIND_REQUESTED,
  SAVED_TO_TAPE
} from "../machine-props";
import { MEDIA_TAPE } from "@common/structs/project-const";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import { ht1080zSavedFileName, isHt1080zTapeFile } from "./Ht1080zTapeFile";
import { ht1080zStrokesForText } from "./Ht1080zTyper";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import type { ISpectrumPsgDevice } from "../zxSpectrum/ISpectrumPsgDevice";
import type { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { WasmSpectrumPsgDevice } from "../zxSpectrum/WasmSpectrumSupport";

/** The ROM's wait-for-key loop (`JR 0049h` at 004Eh): where a tape-load flow finds BASIC idle */
const HT1080Z_KEY_WAIT_LOOP = 0x004e;

/** Frames after which an unfinished tape-load script is dropped (about two minutes) */
const LOAD_SCRIPT_TIMEOUT_FRAMES = 6000;

/** The DC filter's cut-off, as the other cores' (`AudioDeviceBase.DC_FILTER_CUTOFF_HZ`); the core has no `exp` */
const DC_FILTER_CUTOFF_HZ = 1.4;

/** The raster as the beam overlay sees it (`getBeamPosition`) */
const HT1080Z_BEAM_TIMING: BeamTiming = {
  unit: "T",
  tactsPerLine: 112,
  linesPerFrame: 312,
  // --- Slot 2 of line 0 is dot 72 of row 48: 48 lines and 12 slots (72 dots) earlier is (0, 0)
  firstVisibleTact: -48 * 112 + 2 - 12,
  tactsPerBufferPixel: 1 / 6,
  bufferWidth: 528,
  bufferHeight: 288,
  paperLeft: 72,
  paperTop: 48,
  paperWidth: 384,
  paperHeight: 192
};

/** The model numbers `ht1080zConfigure` takes */
const CORE_MODEL = { s1: 0, s2: 1, s64: 2 } as const;

/**
 * An HT-1080Z on the WASM core (`wasm/ht1080z/`, `.plans/HT1080Z_PLAN.md`): one core for every
 * model, configured by the model at setup.
 *
 * The registers are read live from the core and every write is pushed into it; the debugger runs
 * instruction by instruction, or - when the stop policy can only stop at known addresses - the core
 * runs on to the next candidate, exactly as on the ZX80/ZX81.
 *
 * The core carries the shared execution-history recorder and access profile, and its whole state is
 * its linear memory: state files and reverse debugging save and restore that image (§11).
 */
export class Ht1080zWasmV2Machine extends Ht1080zWasmHost implements IExecutionHistorySource, IAccessProfileSource {
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
  // read through the shared reader; every model shares one layout (`layouts/ht1080z.ts`)

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
  public wasmV2Runtime?: Ht1080zWasmV2Runtime;

  private screenPixels?: Uint32Array;
  private screenPixelBytes?: Uint8ClampedArray;
  private syncedTargetClockMultiplier = -1;
  /** Whether the PAGE key is down: it latches on the press, and host key repeats must not flip it */
  private pageKeyDown = false;
  /** Whether F1 is down, and whether it holds the recorder's motor on (a latching key) */
  private f1KeyDown = false;
  private motorOverride = false;
  /** The core's SAVE revision already published (`ht1080zTapeGetSavedRevision`) */
  private savedTapeRevision = 0;
  /**
   * The tape-load flow's commands still to type, each once BASIC is idle at a prompt again: the
   * answer to the power-on question, CLOAD or SYSTEM and the name, then RUN or `/`
   */
  private loadScript: string[] = [];
  private loadScriptLoops = -1;
  private loadScriptAge = 0;
  /** The current frame's samples; the array and its objects are reused, as the Z88's are */
  private readonly wasmV2AudioSamples: AudioSample[] = [];

  /**
   * The AY for the PSG panel (`MF_PSG`): the Spectrum cores' adapter, reading the core's
   * `ht1080zGetPsg*` exports. It only keeps the machine reference; the HT is no Spectrum.
   */
  readonly psgDevice: ISpectrumPsgDevice = new WasmSpectrumPsgDevice(this as unknown as IZxSpectrumMachine, (name, ...args) => {
    const fn = (this.wasmV2Runtime?.exports as Record<string, unknown> | undefined)?.[`ht1080z${name}`];
    return typeof fn === "function" ? (fn as (...a: number[]) => number)(...args) : undefined;
  });

  constructor(
    machineId: string,
    modelInfo?: MachineModel,
    config?: MachineConfigSet,
    messenger?: MessengerBase,
    private readonly wasmV2LoaderOptions?: Ht1080zWasmV2LoaderOptions
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
    return this.w ? this.w.ht1080zGetCpuAf() : super.af;
  }
  override set af(value: number) {
    super.af = value;
    this.w?.ht1080zSetCpuAf(super.af);
  }
  override get bc(): number {
    return this.w ? this.w.ht1080zGetCpuBc() : super.bc;
  }
  override set bc(value: number) {
    super.bc = value;
    this.w?.ht1080zSetCpuBc(super.bc);
  }
  override get de(): number {
    return this.w ? this.w.ht1080zGetCpuDe() : super.de;
  }
  override set de(value: number) {
    super.de = value;
    this.w?.ht1080zSetCpuDe(super.de);
  }
  override get hl(): number {
    return this.w ? this.w.ht1080zGetCpuHl() : super.hl;
  }
  override set hl(value: number) {
    super.hl = value;
    this.w?.ht1080zSetCpuHl(super.hl);
  }
  override get af_(): number {
    return this.w ? this.w.ht1080zGetCpuAfAlt() : super.af_;
  }
  override set af_(value: number) {
    super.af_ = value;
    this.w?.ht1080zSetCpuAfAlt(super.af_);
  }
  override get bc_(): number {
    return this.w ? this.w.ht1080zGetCpuBcAlt() : super.bc_;
  }
  override set bc_(value: number) {
    super.bc_ = value;
    this.w?.ht1080zSetCpuBcAlt(super.bc_);
  }
  override get de_(): number {
    return this.w ? this.w.ht1080zGetCpuDeAlt() : super.de_;
  }
  override set de_(value: number) {
    super.de_ = value;
    this.w?.ht1080zSetCpuDeAlt(super.de_);
  }
  override get hl_(): number {
    return this.w ? this.w.ht1080zGetCpuHlAlt() : super.hl_;
  }
  override set hl_(value: number) {
    super.hl_ = value;
    this.w?.ht1080zSetCpuHlAlt(super.hl_);
  }
  override get ix(): number {
    return this.w ? this.w.ht1080zGetCpuIx() : super.ix;
  }
  override set ix(value: number) {
    super.ix = value;
    this.w?.ht1080zSetCpuIx(super.ix);
  }
  override get iy(): number {
    return this.w ? this.w.ht1080zGetCpuIy() : super.iy;
  }
  override set iy(value: number) {
    super.iy = value;
    this.w?.ht1080zSetCpuIy(super.iy);
  }
  override get ir(): number {
    return this.w ? this.w.ht1080zGetCpuIr() : super.ir;
  }
  override set ir(value: number) {
    super.ir = value;
    this.w?.ht1080zSetCpuIr(super.ir);
  }
  override get wz(): number {
    return this.w ? this.w.ht1080zGetCpuWz() : super.wz;
  }
  override set wz(value: number) {
    super.wz = value;
    this.w?.ht1080zSetCpuWz(super.wz);
  }
  override get pc(): number {
    return this.w ? this.w.ht1080zGetCpuPc() : super.pc;
  }
  override set pc(value: number) {
    super.pc = value;
    this.w?.ht1080zSetCpuPc(super.pc);
  }
  override get sp(): number {
    return this.w ? this.w.ht1080zGetCpuSp() : super.sp;
  }
  override set sp(value: number) {
    super.sp = value;
    this.w?.ht1080zSetCpuSp(super.sp);
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
    return this.w ? this.w.ht1080zGetCpuIff1() !== 0 : super.iff1;
  }
  override set iff1(value: boolean) {
    super.iff1 = value;
    this.w?.ht1080zSetCpuIff1(value ? 1 : 0);
  }
  override get iff2(): boolean {
    return this.w ? this.w.ht1080zGetCpuIff2() !== 0 : super.iff2;
  }
  override set iff2(value: boolean) {
    super.iff2 = value;
    this.w?.ht1080zSetCpuIff2(value ? 1 : 0);
  }
  override get interruptMode(): number {
    return this.w ? this.w.ht1080zGetCpuInterruptMode() : super.interruptMode;
  }
  override set interruptMode(value: number) {
    super.interruptMode = value;
    this.w?.ht1080zSetCpuInterruptMode(value);
  }

  override setTacts(value: number): void {
    super.setTacts(value);
    this.w?.ht1080zSetTacts(value >>> 0);
  }

  // ==========================================================================================
  // Lifecycle

  /** Loads the core (once), configures the model, uploads its ROMs and powers the machine on */
  async setup(): Promise<void> {
    if (this.wasmV2Runtime == null) {
      this.wasmV2Runtime = await loadHt1080zWasmV2(this.wasmV2LoaderOptions);
    }
    const runtime = this.wasmV2Runtime;
    const hw = this.hardware;
    runtime.exports.ht1080zConfigure(CORE_MODEL[hw.romSet], hw.ramKb);
    const romSet = HT1080Z_ROM_SETS[hw.romSet];
    const basic = await this.loadRomFromResource(romSet.basic.name);
    const extension = await this.loadRomFromResource(romSet.extension.name);
    const chargen = await this.loadRomFromResource(romSet.chargen.name);
    fillCoreBytes(runtime, runtime.rom, 0xff);
    writeCoreBytes(runtime, runtime.rom, basic.subarray(0, romSet.basic.size));
    writeCoreBytes(runtime, runtime.rom, extension.subarray(0, romSet.extension.size), romSet.basic.size);
    fillCoreBytes(runtime, runtime.chargen, 0);
    writeCoreBytes(runtime, runtime.chargen, chargen.subarray(0, runtime.chargen.length));
    const words = runtime.exports.ht1080zGetScreenWidth() * runtime.exports.ht1080zGetScreenHeight();
    this.screenPixels = runtime.pixelBuffer.subarray(0, words);
    this.screenPixelBytes = runtime.pixelBufferBytes.subarray(0, words * 4);
    this.baseClockFrequency = runtime.exports.ht1080zGetBaseClockFrequency();
    this.setTactsInFrame(runtime.exports.ht1080zGetTactsInFrame());
    runtime.exports.ht1080zHardReset();
    this.syncVideoControls(runtime);
    this.syncAudioSampleRate(runtime);
    this.savedTapeRevision = runtime.exports.ht1080zTapeGetSavedRevision();
    this.syncTapeFromProperties(runtime);
    this.syncCpuFromWasmV2(runtime);
  }

  /** Power on: the RAM cleared and every register reset */
  override hardReset(): void {
    super.hardReset();
    this.reset();
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      runtime.exports.ht1080zHardReset();
      this.syncTapeFromProperties(runtime);
      this.syncCpuFromWasmV2(runtime);
    }
  }

  override reset(): void {
    super.reset();
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      this.syncTargetClockMultiplier(runtime);
      runtime.exports.ht1080zReset();
      this.syncTapeFromProperties(runtime);
      this.syncCpuFromWasmV2(runtime);
    }
  }

  /**
   * The RESET key on the back panel: an NMI to $0066, which returns to READY with the memory kept
   * (HARDWARE.md §2, §10). Not the IDE's reset, which is a power-on.
   */
  pressResetKey(): void {
    this.requireWasmV2Runtime().exports.ht1080zPressResetKey();
  }

  /**
   * The machine-menu commands (`ht1080z-menus.ts`): `reset_key` presses the RESET key, `page_key`
   * presses the latching PAGE key once
   */
  override async executeCustomCommand(command: string): Promise<any> {
    if (command === "reset_key") this.pressResetKey();
    else if (command === "page_key") this.setMachineProperty(HT_VIDEO_PAGE, !this.getMachineProperty(HT_VIDEO_PAGE));
  }

  override setMachineProperty(key: string, value?: any): void {
    super.setMachineProperty(key, value);
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return;
    switch (key) {
      case HT_VIDEO_CUT:
      case HT_VIDEO_PAGE:
      case HT_VIDEO_DASH:
        this.syncVideoControls(runtime);
        break;
      case AUDIO_SAMPLE_RATE:
        this.syncAudioSampleRate(runtime);
        break;
      case MEDIA_TAPE:
        this.uploadTape(runtime, value);
        break;
      case FAST_LOAD:
        runtime.exports.ht1080zTapeSetFastLoad(value === undefined || value ? 1 : 0);
        break;
      case REWIND_REQUESTED:
        if (value === true || value === undefined) runtime.exports.ht1080zTapeRewind();
        break;
    }
  }

  // ==========================================================================================
  // Tape (`.plans/HT1080Z_PLAN.md` §8-9, `wasm/ht1080z/ht1080z-tape.c`)

  /**
   * Puts a tape in the deck: its `.cas` bit stream goes to the core, which plays it while the
   * recorder's motor runs, or reads it through the fast-load traps. Anything that is not an HT tape
   * (a Spectrum tape) empties the deck.
   */
  private uploadTape(runtime: Ht1080zWasmV2Runtime, value: unknown): void {
    if (!isHt1080zTapeFile(value)) {
      runtime.exports.ht1080zTapeSetLength(0);
      runtime.exports.ht1080zTapeSetPlaying(0);
      return;
    }
    const bytes = value.tapeBytes;
    if (bytes.length > runtime.tapeData.length) {
      throw new Error(`The tape is too large: ${bytes.length} bytes (at most ${runtime.tapeData.length}).`);
    }
    writeCoreBytes(runtime, runtime.tapeData, bytes);
    runtime.exports.ht1080zTapeSetLength(bytes.length);
    runtime.exports.ht1080zTapeSetPlaying(1);
  }

  private syncTapeFromProperties(runtime: Ht1080zWasmV2Runtime): void {
    const fast = this.getMachineProperty(FAST_LOAD);
    runtime.exports.ht1080zTapeSetFastLoad(fast === undefined || fast ? 1 : 0);
    runtime.exports.ht1080zTapeSetMotorOverride(this.motorOverride ? 1 : 0);
    this.uploadTape(runtime, this.getMachineProperty(MEDIA_TAPE));
  }

  /**
   * Hands a SAVE the ROM finished to the host as a `.cas` (`SAVED_TO_TAPE`), as the other machines
   * hand over theirs: a new revision of the core's capture is a new file. The controller writes it
   * to the save folder.
   */
  private publishSavedTape(runtime: Ht1080zWasmV2Runtime): void {
    const revision = runtime.exports.ht1080zTapeGetSavedRevision();
    if (revision === this.savedTapeRevision) return;
    this.savedTapeRevision = revision;
    const contents = new Uint8Array(runtime.savedData.subarray(0, runtime.exports.ht1080zTapeGetSavedLength()));
    super.setMachineProperty(SAVED_TO_TAPE, { name: ht1080zSavedFileName(contents), contents });
  }

  /**
   * Loads and starts the tape in the deck. The flow powers the machine on and runs it to its first
   * idle prompt; the machine then types, each once BASIC is idle at a prompt again: NEW LINE (the
   * power-on question), then `CLOAD` and `RUN` for a BASIC tape, or `SYSTEM`, the name and `/` for a
   * machine-code one.
   */
  getTapeLoadFlow(): CodeInjectionFlow {
    const tape = this.getMachineProperty(MEDIA_TAPE);
    if (!isHt1080zTapeFile(tape)) throw new Error("There is no HT-1080Z tape in the deck.");
    const script =
      tape.kind === "system" ? ["\n", "SYSTEM\n", `${tape.name}\n`, "/\n"] : ["\n", "CLOAD\n", "RUN\n"];
    // --- A name the keyboard cannot type fails here, before anything runs
    script.forEach((text) => ht1080zStrokesForText(text, this.hardware.romSet));
    this.loadScript = script;
    this.loadScriptLoops = -1;
    this.loadScriptAge = 0;
    return [
      {
        type: "ReachExecPoint",
        rom: 0,
        execPoint: HT1080Z_KEY_WAIT_LOOP,
        message: "BASIC is waiting for a key ($004E)"
      },
      { type: "KeepPc" },
      { type: "Start" }
    ];
  }

  /** The tape-load commands still to type (the tests read it) */
  get pendingLoadCommands(): readonly string[] {
    return this.loadScript;
  }

  /**
   * Types the load script's next command once BASIC is idle at a prompt: nothing is being typed and
   * the core counted passes of the wait-for-key loop since the last frame. A reverse-debugging replay
   * types nothing (the journal replays the keys the live run typed); a script that never finishes is
   * dropped.
   */
  private advanceLoadScript(runtime: Ht1080zWasmV2Runtime): void {
    if (this.loadScript.length === 0 || this.executionContext.isReplayingHistory?.()) return;
    if (++this.loadScriptAge > LOAD_SCRIPT_TIMEOUT_FRAMES) {
      this.loadScript = [];
      return;
    }
    const loops = runtime.exports.ht1080zGetKeyWaitLoops();
    const idle = this.loadScriptLoops >= 0 && loops > this.loadScriptLoops && this.getKeyQueueLength() === 0;
    this.loadScriptLoops = loops;
    if (idle) this.typeText(this.loadScript.shift()!);
  }

  /** The host's audio rate (`AUDIO_SAMPLE_RATE`) and the DC filter's coefficient for it */
  private syncAudioSampleRate(runtime: Ht1080zWasmV2Runtime): void {
    const rate = this.getMachineProperty(AUDIO_SAMPLE_RATE);
    if (typeof rate === "number" && rate > 0) {
      runtime.exports.ht1080zSetAudioSampleRate(rate, Math.exp((-2 * Math.PI * DC_FILTER_CUTOFF_HZ) / rate));
    }
  }

  /**
   * The current frame's samples (the beeper and the AY, mono in both channels), read from the core's
   * double buffer
   */
  getAudioSamples(): AudioSample[] {
    const runtime = this.requireWasmV2Runtime();
    const values = runtime.audioSamples;
    const count = runtime.exports.ht1080zGetAudioSampleCount();
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

  /**
   * The video switches, from the machine properties (D7: the dash is on unless turned off). They are
   * switches on the machine, not ports, so a reset keeps them.
   */
  private syncVideoControls(runtime: Ht1080zWasmV2Runtime): void {
    const w = runtime.exports;
    w.ht1080zSetVideoCut(this.getMachineProperty(HT_VIDEO_CUT) ? 1 : 0);
    w.ht1080zSetVideoPage(this.getMachineProperty(HT_VIDEO_PAGE) ? 1 : 0);
    w.ht1080zSetVideoDash(this.getMachineProperty(HT_VIDEO_DASH) === false ? 0 : 1);
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
    this.syncTargetClockMultiplier(runtime);
    runtime.exports.ht1080zExecuteFrame();
    this.syncFrameCounters(runtime);
    this.advanceLoadScript(runtime);
    this.publishSavedTape(runtime);
    this.frameCompleted = runtime.exports.ht1080zGetFrameCompleted() !== 0;
    this.executionContext.lastTerminationReason = FrameTerminationMode.Normal;
    return FrameTerminationMode.Normal;
  }

  /** The debug path, as the Z88's: one instruction at a time, or on to the next candidate stop */
  private debugLoopHost?: { runtime: Ht1080zWasmV2Runtime; host: WasmDebugLoopHost };

  private executeDebugLoop(runtime: Ht1080zWasmV2Runtime): FrameTerminationMode {
    if (this.debugLoopHost?.runtime !== runtime) {
      this.debugLoopHost = { runtime, host: this.createDebugLoopHost(runtime) };
    }
    return runWasmDebugLoop(this.debugLoopHost.host);
  }

  private createDebugLoopHost(runtime: Ht1080zWasmV2Runtime): WasmDebugLoopHost {
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
        this.syncTargetClockMultiplier(runtime);
        return undefined;
      },
      // --- The instruction export returns whether the frame completed
      executeInstruction: () => wasm.ht1080zExecuteInstruction() !== 0,
      // --- The core's own loop runs to the next place the stop policy may stop at (z80-debug-loop.c)
      executeUntilStop: (extraStop, mask, accessMask) => wasm.ht1080zExecuteUntilStop(extraStop, mask, accessMask),
      lastOpStart: () => wasm.ht1080zGetDebugOpStart(),
      pushBreakpointFlags: (flags) => runtime.breakpointFlags.set(flags),
      conditionPlan: () => runtime.condPlan,
      coreFrameCompleted: () => wasm.ht1080zGetFrameCompleted() !== 0,
      // --- Past this class's `pc` setter, which would push the value just read from the core back into it
      mirrorPc: () => {
        const pc = wasm.ht1080zGetCpuPc();
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
    return this.w ? this.w.ht1080zGetInterruptDepth() : super.getInterruptDepth();
  }

  override markStepOutAddress(): void {
    this.stepOutAddress = stepOutAddressFromCore(this.requireWasmV2Runtime().exports.ht1080zGetStepOutAddress());
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
  private importBusAccess(runtime: Ht1080zWasmV2Runtime): void {
    const wasm = runtime.exports;
    this.lastIoReadPort = undefined;
    this.lastIoWritePort = undefined;
    importAccessLog(this, runtime.accessLog, wasm.ht1080zGetAccessLogCount());
    const portAddress = wasm.ht1080zGetLastPortAddress();
    const portValue = wasm.ht1080zGetLastPortValue();
    if (wasm.ht1080zGetLastPortIsWrite() !== 0) {
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
    return this.requireWasmV2Runtime().exports.ht1080zReadMemory(address & 0xffff);
  }

  override doWriteMemory(address: number, value: number): void {
    this.requireWasmV2Runtime().exports.ht1080zWriteMemory(address & 0xffff, value & 0xff);
  }

  /** The ROMs as one page at `-1`: the BASIC and the extension, $0000-$37FF */
  protected override getRomPartitionImages(): Map<number, Uint8Array> {
    return new Map([[-1, this.get64KFlatMemory().slice(0, 0x3800)]]);
  }

  /** The 64K the CPU sees, through the memory map (the keyboard reads as the CPU would read it) */
  get64KFlatMemory(): Uint8Array {
    const wasm = this.requireWasmV2Runtime().exports;
    const flat = new Uint8Array(0x1_0000);
    for (let address = 0; address < 0x1_0000; address++) flat[address] = wasm.ht1080zReadMemory(address);
    return flat;
  }

  override doReadPort(address: number): number {
    return this.requireWasmV2Runtime().exports.ht1080zReadPort(address & 0xffff);
  }

  override doWritePort(address: number, value: number): void {
    this.requireWasmV2Runtime().exports.ht1080zWritePort(address & 0xffff, value & 0xff);
  }

  // ==========================================================================================
  // Keyboard and screen

  /** Whether F1 holds the recorder's motor on */
  get isMotorOverride(): boolean {
    return this.motorOverride;
  }

  /**
   * A key of the matrix goes to the core. PAGE, outside the matrix, is a latching key: each press
   * flips the 32-column page (`HT_VIDEO_PAGE`); holding it down does nothing more.
   */
  setKeyStatus(key: number, isDown: boolean): void {
    if (key >= HT1080Z_FIRST_SWITCH_KEY) {
      if (key === Ht1080zKeyCode.Page) {
        if (isDown && !this.pageKeyDown) this.setMachineProperty(HT_VIDEO_PAGE, !this.getMachineProperty(HT_VIDEO_PAGE));
        this.pageKeyDown = isDown;
      } else if (key === Ht1080zKeyCode.F1) {
        // --- F1 latches too: it holds the internal recorder's motor on, for winding by hand
        if (isDown && !this.f1KeyDown) {
          this.motorOverride = !this.motorOverride;
          this.requireWasmV2Runtime().exports.ht1080zTapeSetMotorOverride(this.motorOverride ? 1 : 0);
        }
        this.f1KeyDown = isDown;
      }
      return;
    }
    this.requireWasmV2Runtime().exports.ht1080zSetKeyStatus(key, isDown ? 1 : 0);
  }

  get screenWidthInPixels(): number {
    return this.requireWasmV2Runtime().exports.ht1080zGetScreenWidth();
  }

  get screenHeightInPixels(): number {
    return this.requireWasmV2Runtime().exports.ht1080zGetScreenHeight();
  }

  /** HT dots are narrower than they are tall (D6) */
  getAspectRatio = (): [number, number] => [HT1080Z_PIXEL_ASPECT, 1];

  /**
   * The picture. The core draws straight into it as the beam goes, so between frames it holds the
   * last complete frame, and on a machine paused mid-frame the new frame down to the beam
   * (`renderInstantScreen` draws up to it) over the rest of the previous one.
   */
  getPixelBuffer(): Uint32Array {
    this.requireWasmV2Runtime();
    return this.screenPixels!;
  }

  getPixelBufferBytes(): Uint8ClampedArray {
    this.requireWasmV2Runtime();
    return this.screenPixelBytes!;
  }

  /**
   * The beam position overlay (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` §4.3). One T-state is one
   * character slot of 6 dots; slot `s` of a line shows the byte read at slot `s - 2`, so visible slots
   * 2-65 of lines 0-191 are the picture, which sits 72 dots and 48 lines into the 528 x 288 buffer
   * (`ht1080z-video.c`). Buffer pixel (0, 0) is therefore drawn 48 lines and 12 slots before the
   * frame starts: the top border belongs to the previous frame's last lines, all black.
   */
  getBeamPosition(): BeamPosition {
    const w = this.requireWasmV2Runtime().exports;
    const frameTact = Math.floor(w.ht1080zGetFrameTacts() / Math.max(1, w.ht1080zGetClockMultiplier()));
    // --- The renderer draws by read slot: read `r` is the picture at slot `r + 2`
    return beamAt(HT1080Z_BEAM_TIMING, frameTact, drawnUpTo(HT1080Z_BEAM_TIMING, w.ht1080zGetVideoRenderedRead() + 2));
  }

  /** Draws the paused picture up to the beam: the core's own catch-up, which later frames redraw the same */
  renderToBeamPreview(): void {
    this.requireWasmV2Runtime().exports.ht1080zRenderToBeam();
  }

  renderInstantScreen(_savedPixelBuffer?: Uint32Array): Uint32Array {
    // --- Drawing is output only: the catch-up renderer would draw the same slots the same way later
    this.requireWasmV2Runtime().exports.ht1080zRenderToBeam();
    return this.getPixelBuffer();
  }

  // ==========================================================================================
  // State files and reverse debugging (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.5,
  // `.plans/REVERSE_DEBUGGING_PLAN.md` §4.2)

  /**
   * Captures the machine's whole state: the core's memory image, which holds the tape deck, the
   * video switches and the motor override too. The machine must be paused.
   */
  saveMachineState(): MachineStateParts {
    const runtime = this.requireWasmV2Runtime();
    return {
      ...captureWasmImage("ht1080z", runtime.module, runtime.exports.memory.buffer),
      host: this.captureHostState()
    };
  }

  /**
   * Puts the machine back into a saved state. The wrapper's mirrors of core state are re-read from
   * it, and the tape-load flow of the run being replaced is dropped. The PAGE latch comes back with
   * the state; VIDEO CUT and the dash keep the IDE's settings.
   * @throws MachineStateMismatchError when the state was saved by another core or layout
   */
  loadMachineState(parts: MachineStateParts): void {
    const runtime = this.requireWasmV2Runtime();
    // --- VIDEO CUT and the dash are the IDE's settings (the menu's check marks): they stay as they are
    const cut = this.getMachineProperty(HT_VIDEO_CUT);
    const dash = this.getMachineProperty(HT_VIDEO_DASH);
    restoreWasmImage(parts, "ht1080z", runtime.module, runtime.exports.memory.buffer);
    this.syncedTargetClockMultiplier = -1;
    this.restoreHostState(parts.host);
    super.setMachineProperty(HT_VIDEO_CUT, cut);
    super.setMachineProperty(HT_VIDEO_DASH, dash);
    this.syncVideoControls(runtime);
  }

  /** The core, as the export contract names it */
  get reverseCoreId(): string {
    return "ht1080z";
  }

  get reverseRuntime(): Ht1080zWasmV2Runtime | undefined {
    return this.wasmV2Runtime;
  }

  readonly reverseFrameExport = "ht1080zExecuteFrame";

  isAtFrameBoundary(): boolean {
    return this.wasmV2Runtime?.exports.ht1080zGetFrameCompleted() !== 0;
  }

  /** The wrapper keeps no state of its own a keyframe needs: the core holds it all */
  captureHostState(): Record<string, unknown> {
    return {};
  }

  /**
   * After the core changed under the wrapper (a state load, a replay, a return to the present): the
   * mirrors re-read from the core, nothing pushed, queued keystrokes and load commands dropped
   */
  restoreHostState(_state: unknown): void {
    const runtime = this.requireWasmV2Runtime();
    const w = runtime.exports;
    this.emulatedKeyStrokes.length = 0;
    this.loadScript = [];
    this.loadScriptLoops = -1;
    this.motorOverride = w.ht1080zTapeGetMotorOverride() !== 0;
    // --- The video switches are the core's now; the properties follow without pushing them back
    super.setMachineProperty(HT_VIDEO_CUT, w.ht1080zGetVideoCut() !== 0);
    super.setMachineProperty(HT_VIDEO_PAGE, w.ht1080zGetVideoPage() !== 0);
    super.setMachineProperty(HT_VIDEO_DASH, w.ht1080zGetVideoDash() !== 0);
    // --- What the core already holds must not be published again as new
    this.savedTapeRevision = w.ht1080zTapeGetSavedRevision();
    this.frameCompleted = w.ht1080zGetFrameCompleted() !== 0;
    this.syncCpuFromWasmV2(runtime);
  }

  getConditionStore(): ConditionStore | undefined {
    return this.wasmV2Runtime ? conditionStoreOf(this.wasmV2Runtime) : undefined;
  }

  // ==========================================================================================
  // Helpers

  /** Forgets what was last pushed into the core, so the next frame pushes the live state */
  invalidateHostSync(): void {
    this.syncedTargetClockMultiplier = -1;
  }

  private syncTargetClockMultiplier(runtime: Ht1080zWasmV2Runtime): void {
    if (this.targetClockMultiplier !== this.syncedTargetClockMultiplier) {
      runtime.exports.ht1080zSetTargetClockMultiplier(this.targetClockMultiplier);
      this.syncedTargetClockMultiplier = this.targetClockMultiplier;
    }
  }

  private syncCpuFromWasmV2(runtime: Ht1080zWasmV2Runtime): void {
    const w = runtime.exports;
    super.af = w.ht1080zGetCpuAf();
    super.bc = w.ht1080zGetCpuBc();
    super.de = w.ht1080zGetCpuDe();
    super.hl = w.ht1080zGetCpuHl();
    super.af_ = w.ht1080zGetCpuAfAlt();
    super.bc_ = w.ht1080zGetCpuBcAlt();
    super.de_ = w.ht1080zGetCpuDeAlt();
    super.hl_ = w.ht1080zGetCpuHlAlt();
    super.ix = w.ht1080zGetCpuIx();
    super.iy = w.ht1080zGetCpuIy();
    super.ir = w.ht1080zGetCpuIr();
    super.wz = w.ht1080zGetCpuWz();
    super.pc = w.ht1080zGetCpuPc();
    super.sp = w.ht1080zGetCpuSp();
    super.iff1 = w.ht1080zGetCpuIff1() !== 0;
    super.iff2 = w.ht1080zGetCpuIff2() !== 0;
    super.interruptMode = w.ht1080zGetCpuInterruptMode();
    this.halted = w.ht1080zGetCpuHalted() !== 0;
    this.opCode = w.ht1080zGetCpuOpCode();
    this.syncFrameCounters(runtime);
  }

  private syncFrameCounters(runtime: Ht1080zWasmV2Runtime): void {
    const w = runtime.exports;
    super.pc = w.ht1080zGetCpuPc();
    this.tacts = w.ht1080zGetTacts();
    this.frames = w.ht1080zGetFrames();
    this.clockMultiplier = w.ht1080zGetClockMultiplier();
    this.tactsInCurrentFrame = w.ht1080zGetTactsInCurrentFrame();
    this.frameTacts = w.ht1080zGetFrameTacts();
    this.currentFrameTact = Math.floor(this.frameTacts / this.clockMultiplier);
    this.opStartAddress = w.ht1080zGetOpStartAddress();
    this.sigINT = false;
  }

  private requireWasmV2Runtime(): Ht1080zWasmV2Runtime {
    if (this.wasmV2Runtime == null) {
      throw new Error("The HT-1080Z WASM core is not loaded; call setup() first.");
    }
    return this.wasmV2Runtime;
  }
}
