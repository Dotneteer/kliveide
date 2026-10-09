import { WasmHistorySource } from "../history/WasmHistorySource";
import { WasmProfileSource } from "../profile/WasmProfileSource";
import type { IExecutionHistorySource } from "@emu/abstractions/IExecutionHistorySource";
import type { IAccessProfileSource } from "@emu/abstractions/IAccessProfileSource";
import type { ProfileCounts, ProfileEdge, ProfileInfo, ProfileTouchedByte } from "@common/profile/profileTypes";
import type { ExecutionHistoryInfo, ExecutionHistoryPage } from "@common/history/historyTypes";
import type { HistoryServiceSpan } from "@common/history/serviceSpans";
import { conditionStoreOf, type ConditionStore } from "../conditionStore";
import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { CpuState } from "@common/messaging/EmuApi";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import type { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";
import type { SpP3eWasmV2LoaderOptions, SpP3eWasmV2Runtime } from "./wasm/SpP3eWasmV2Loader";
import type { TapeDataBlock } from "@common/structs/TapeDataBlock";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import {
  hasWasmAccessBreakpoint,
  runWasmDebugLoop,
  type WasmDebugLoopHost,
  shouldStopAtWasmBreakpoint,
  stepOutAddressFromCore
} from "../wasmDebugLoop";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { TapeMode } from "@emu/abstractions/TapeMode";
import {
  AUDIO_SAMPLE_RATE,
  DISK_A_CHANGES,
  DISK_A_WP,
  DISK_B_CHANGES,
  DISK_B_WP,
  FAST_LOAD,
  REWIND_REQUESTED,
  SAVED_TO_TAPE,
  TAPE_MODE
} from "../machine-props";
import { MC_DISK_SUPPORT } from "@common/machines/constants";
import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_TAPE } from "@common/structs/project-const";
import { BinaryWriter } from "@utils/BinaryWriter";
import { loadSpP3eWasmV2 } from "./wasm/SpP3eWasmV2Loader";
import { readDiskData } from "../disk/disk-readers";
import { TzxHeader } from "../tape/TzxHeader";
import { TzxStandardSpeedBlock } from "../tape/TzxStandardSpeedBlock";
import { ZxSpectrumP3eWasmHost, mergeZxSpectrumP3eConfig } from "./ZxSpectrumP3eWasmHost";
import { importAccessLog } from "../wasmAccessLog";
import type { SpectrumSnapshot } from "@common/spectrum/snapshot/spectrumSnapshot";
import { restoreSpectrumSnapshot } from "../zxSpectrum/spectrumSnapshotRestore";
import {
  captureSpectrumSnapshot,
  type SpectrumSnapshotCaptureMedia
} from "../zxSpectrum/spectrumSnapshotCapture";
import {
  captureWasmImage,
  restoreWasmImage,
  type MachineStateParts
} from "../state/wasmStateImage";
import { assertSnapshotFitsMachine } from "../zxSpectrum/spectrumSnapshotFit";
import { RzxCoreBridge } from "../zxSpectrum/rzx/rzxCoreBridge";
import type { IRzxMachine, IRzxSession } from "../zxSpectrum/rzx/rzxSession";
import { spectrumWasmBeamPosition } from "../zxSpectrum/WasmSpectrumSupport";
import type { BeamPosition } from "@common/utils/beamGeometry";
import { fillCoreBytes, writeCoreBytes } from "@emu/machines/reverse/coreMemoryWrites";

const WASM_AUDIO_SAMPLE_SCALE = 32768.0;

type WasmDiskPayload = {
  data: Uint8Array;
  tracks: number;
  sides: number;
  sectorsPerTrack: number;
  firstSectorId: number;
  sectorLength: number;
};

export type SpP3eWasmV2Diagnostics = {
  backend: "wasm";
  engine: "v2";
  artifactName: string;
  frames: number;
  tacts: number;
  audioSamples: number;
  normalFrames: number;
  audioRateWrites: number;
  tapeUploads: number;
  tapeBlocks: number;
  tapeBytes: number;
  tapeLoaded: boolean;
  tapeMode: number;
  tapeCurrentBlockIndex: number;
  tapeSavedBlocks: number;
  tapeSavedRevision: number;
  fdcEnabledDriveCount: number;
  fdcMainStatusRegister: number;
  fdcCurrentDrive: number;
  diskMotorOn: boolean;
};

/**
 * Full-machine WASM v2 adapter for the ZX Spectrum +2E/+3E migration path.
 */
export class ZxSpectrumP3eWasmV2Machine
  extends ZxSpectrumP3eWasmHost
  implements IExecutionHistorySource, IAccessProfileSource, IRzxMachine
{
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
  // read through the shared reader; the machine id names the layout

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
  public wasmV2Runtime?: SpP3eWasmV2Runtime;
  /** The RZX session playing or recording on this machine (`.plans/RZX_PLAN.md` §4.3) */
  public rzxSession?: IRzxSession;
  private rzxCoreBridge?: RzxCoreBridge;
  private readonly wasmV2AudioSamples: AudioSample[] = [];
  private readonly wasmV2KeyboardRows = new Uint8Array(8);
  private wasmV2KeyboardRowsValid = false;
  private wasmV2AudioSampleRate = -1;
  private wasmV2NormalFrames = 0;
  private wasmV2AudioRateWrites = 0;
  private wasmV2TapeUploadCount = 0;
  private wasmV2SavedTapeRevision = 0;
  private wasmV2DiskChangeRevision = 0;
  private wasmV2ContentionPauseBase = 0;
  private readonly wasmV2DiskPayloads: (WasmDiskPayload | undefined)[] = [];

  constructor(
    public readonly requestedModelInfo?: MachineModel,
    public readonly requestedConfig?: MachineConfigSet,
    private readonly wasmV2LoaderOptions?: SpP3eWasmV2LoaderOptions
  ) {
    super(requestedModelInfo, requestedConfig);
  }

  // --- CPU registers: the core owns them. Reads come from it and every write is pushed into it, so the
  // --- IDE's register editor reaches the core and a register read after a normal frame (which
  // --- refreshes only PC and the counters) is never stale - `getMemoryContents` reads them directly.

  override get af(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.spp3eGetCpuAf() : super.af;
  }

  override set af(value: number) {
    super.af = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuAf(super.af);
  }

  override get bc(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.spp3eGetCpuBc() : super.bc;
  }

  override set bc(value: number) {
    super.bc = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuBc(super.bc);
  }

  override get de(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.spp3eGetCpuDe() : super.de;
  }

  override set de(value: number) {
    super.de = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuDe(super.de);
  }

  override get hl(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.spp3eGetCpuHl() : super.hl;
  }

  override set hl(value: number) {
    super.hl = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuHl(super.hl);
  }

  override get af_(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.spp3eGetCpuAfAlt() : super.af_;
  }

  override set af_(value: number) {
    super.af_ = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuAfAlt(super.af_);
  }

  override get bc_(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.spp3eGetCpuBcAlt() : super.bc_;
  }

  override set bc_(value: number) {
    super.bc_ = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuBcAlt(super.bc_);
  }

  override get de_(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.spp3eGetCpuDeAlt() : super.de_;
  }

  override set de_(value: number) {
    super.de_ = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuDeAlt(super.de_);
  }

  override get hl_(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.spp3eGetCpuHlAlt() : super.hl_;
  }

  override set hl_(value: number) {
    super.hl_ = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuHlAlt(super.hl_);
  }

  override get ix(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.spp3eGetCpuIx() : super.ix;
  }

  override set ix(value: number) {
    super.ix = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuIx(super.ix);
  }

  override get iy(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.spp3eGetCpuIy() : super.iy;
  }

  override set iy(value: number) {
    super.iy = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuIy(super.iy);
  }

  override get ir(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.spp3eGetCpuIr() : super.ir;
  }

  override set ir(value: number) {
    super.ir = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuIr(super.ir);
  }

  override get wz(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.spp3eGetCpuWz() : super.wz;
  }

  override set wz(value: number) {
    super.wz = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuWz(super.wz);
  }

  override get pc(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.spp3eGetCpuPc() : super.pc;
  }

  override set pc(value: number) {
    super.pc = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuPc(super.pc);
  }

  override get sp(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.spp3eGetCpuSp() : super.sp;
  }

  override set sp(value: number) {
    super.sp = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuSp(super.sp);
  }

  // --- The 8-bit halves: `Z80Cpu` writes them into its own register views, which the core never
  // --- sees; the register editor (`setRegisterValue`) sets them one by one. They go through the pairs.

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

  override async setup(): Promise<void> {
    this.wasmV2Runtime = await loadSpP3eWasmV2(this.wasmV2LoaderOptions);
    this.hardResetWasmV2(this.wasmV2Runtime);
    this.uploadRomBytes(-1, await this.loadRomFromResource(this.romId, 0));
    this.uploadRomBytes(-2, await this.loadRomFromResource(this.romId, 1));
    this.uploadRomBytes(-3, await this.loadRomFromResource(this.romId, 2));
    this.uploadRomBytes(-4, await this.loadRomFromResource(this.romId, 3));
    this.syncAudioSampleRateToWasmV2(this.wasmV2Runtime);
    this.syncTapeStateToWasmV2(this.wasmV2Runtime);
    this.syncDiskStateToWasmV2(this.wasmV2Runtime);
    this.syncFrameCountersFromWasmV2(this.wasmV2Runtime);
  }

  override hardReset(): void {
    super.hardReset();
    if (this.wasmV2Runtime != null) {
      this.hardResetWasmV2(this.wasmV2Runtime);
      this.replayUploadedRomPages((partition, data) => this.uploadRomBytes(partition, data));
      this.syncAudioSampleRateToWasmV2(this.wasmV2Runtime);
      this.syncTapeStateToWasmV2(this.wasmV2Runtime);
      this.syncDiskStateToWasmV2(this.wasmV2Runtime);
      this.syncFrameCountersFromWasmV2(this.wasmV2Runtime);
    }
  }

  override reset(): void {
    super.reset();
    if (this.wasmV2Runtime != null) {
      this.wasmV2Runtime.exports.spp3eReset();
      this.wasmV2ContentionPauseBase = 0;
      this.invalidateWasmV2Sync();
      this.syncAudioSampleRateToWasmV2(this.wasmV2Runtime);
      this.syncTapeStateToWasmV2(this.wasmV2Runtime);
      this.syncDiskStateToWasmV2(this.wasmV2Runtime);
      this.syncFrameCountersFromWasmV2(this.wasmV2Runtime);
    }
  }

  override executeMachineFrame(): FrameTerminationMode {
    const runtime = this.wasmV2Runtime;
    if (runtime == null) {
      return super.executeMachineFrame();
    }

    if (
      this.executionContext.debugStepMode !== DebugStepMode.NoDebug ||
      this.executionContext.frameTerminationMode !== FrameTerminationMode.Normal
    ) {
      return this.executeWasmV2DebugLoop(runtime);
    }

    this.emulateKeystroke();
    const rzx = this.rzxSession?.active ? this.rzxSession : undefined;
    // --- While a recording plays, every port value comes from the file (trap 8)
    if (rzx?.mode !== "play") this.syncKeyboardToWasmV2(runtime);
    this.syncAudioSampleRateToWasmV2(runtime);
    if (rzx) {
      if (!rzx.runFastFrame(() => runtime.exports.spp3eExecuteFrame())) {
        return this.stopForRzx(runtime);
      }
    } else {
      runtime.exports.spp3eExecuteFrame();
    }
    this.wasmV2NormalFrames++;
    this.syncFrameCountersFromWasmV2(runtime);
    this.publishSavedTapeFromWasmV2(runtime);
    this.flushDiskChanges();
    this.frameCompleted = true;
    this.executionContext.lastTerminationReason = FrameTerminationMode.Normal;
    return FrameTerminationMode.Normal;
  }

  flushDiskChanges(): void {
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      this.publishDiskChangesFromWasmV2(runtime);
    }
    this.floppyDevice?.flushDiskChanges();
  }

  override setMachineProperty(key: string, value?: any): void {
    super.setMachineProperty(key, value);
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      this.syncDiskPropertyToWasmV2(runtime, key, value);
      this.syncTapePropertyToWasmV2(runtime, key, value);
      if (key === AUDIO_SAMPLE_RATE) {
        this.syncAudioSampleRateToWasmV2(runtime);
      }
    }
  }

  override uploadRomBytes(partition: number, data: Uint8Array): void {
    super.uploadRomBytes(partition, data);
    const runtime = this.wasmV2Runtime;
    if (runtime == null) {
      return;
    }
    const bank = partition < 0 ? -partition - 1 : partition;
    const romBankSize = runtime.exports.spp3eGetRomSize() / 4;
    if (bank < 0 || bank >= 4 || data.length !== romBankSize) {
      return;
    }
    for (let i = 0; i < data.length; i++) {
      runtime.exports.spp3eUploadRomByte(bank, i, data[i]);
    }
  }

  /** The core's RZX module */
  get rzxCore(): RzxCoreBridge {
    const runtime = this.requireWasmV2Runtime();
    if (this.rzxCoreBridge == null) {
      this.rzxCoreBridge = new RzxCoreBridge("spp3e", runtime.exports, runtime.exports.memory);
    }
    return this.rzxCoreBridge;
  }

  /** An RZX session stopped: the frame ends as a debug stop, which pauses the machine (D11, D12) */
  private stopForRzx(runtime: SpP3eWasmV2Runtime): FrameTerminationMode {
    this.finishWasmV2DebugLoop(FrameTerminationMode.DebugEvent);
    this.syncFrameCountersFromWasmV2(runtime);
    // --- The call that sees the stop completes no frame (the last picture was reported already)
    this.frameCompleted = false;
    return FrameTerminationMode.DebugEvent;
  }

  override readScreenMemory(offset: number): number {
    const runtime = this.requireWasmV2Runtime();
    // --- A host read: no floating-bus latch (the ULA's own reads do that inside the core)
    const value = runtime.exports.spp3ePeekScreenMemoryOffset(offset & 0x3fff);
    this.importWasmV2BusAccess(runtime);
    return value;
  }

  override get64KFlatMemory(): Uint8Array {
    return this.requireWasmV2Runtime().memory;
  }

  override get isOsInitialized(): boolean {
    const runtime = this.wasmV2Runtime;
    return runtime != null ? runtime.exports.spp3eGetCpuIy() === 0x5c3a : super.isOsInitialized;
  }

  override getMemoryPartition(index: number): Uint8Array {
    const runtime = this.requireWasmV2Runtime();
    if (index < 0) {
      const romIndex = Math.max(0, Math.min(3, -index - 1));
      return runtime.rom.subarray(romIndex * 0x4000, (romIndex + 1) * 0x4000);
    }
    const bank = index & 0x07;
    return runtime.ram.subarray(bank * 0x4000, (bank + 1) * 0x4000);
  }

  /** A RAM bank goes through the core, which keeps its flat copy of the paged-in memory in step */
  override writeMemoryPartition(index: number, offset: number, value: number): void {
    if (index < 0 || offset < 0 || offset >= 0x4000) {
      super.writeMemoryPartition(index, offset, value);
      return;
    }
    this.requireWasmV2Runtime().exports.spp3eWriteRamBank(index & 0x07, offset, value & 0xff);
  }

  override getCurrentPartitions(): number[] {
    const wasm = this.requireWasmV2Runtime().exports;
    const slot0 = wasm.spp3eGetCurrentPartition(0);
    const slot1 = wasm.spp3eGetCurrentPartition(1);
    const slot2 = wasm.spp3eGetCurrentPartition(2);
    const slot3 = wasm.spp3eGetCurrentPartition(3);
    return [slot0, slot0, slot1, slot1, slot2, slot2, slot3, slot3];
  }

  override getSelectedRomPage(): number {
    return this.requireWasmV2Runtime().exports.spp3eGetSelectedRom();
  }

  override getSelectedRamBank(): number {
    return this.requireWasmV2Runtime().exports.spp3eGetSelectedBank();
  }

  override getPartition(address: number): number | undefined {
    return this.getCurrentPartitions()[(address >>> 13) & 0x07];
  }

  override getRomFlags(): boolean[] {
    const wasm = this.requireWasmV2Runtime().exports;
    const slot0 = wasm.spp3eGetRomFlag(0) !== 0;
    const slot1 = wasm.spp3eGetRomFlag(1) !== 0;
    const slot2 = wasm.spp3eGetRomFlag(2) !== 0;
    const slot3 = wasm.spp3eGetRomFlag(3) !== 0;
    return [slot0, slot0, slot1, slot1, slot2, slot2, slot3, slot3];
  }

  override doReadMemory(address: number): number {
    const runtime = this.requireWasmV2Runtime();
    // --- A host read: no floating-bus latch (the CPU's own reads do that inside the core)
    const value = runtime.exports.spp3ePeekMemory(address & 0xffff);
    this.importWasmV2BusAccess(runtime);
    return value;
  }

  override doWriteMemory(address: number, value: number): void {
    const runtime = this.requireWasmV2Runtime();
    runtime.exports.spp3eWriteMemory(address & 0xffff, value & 0xff);
    this.importWasmV2BusAccess(runtime);
  }

  override delayAddressBusAccess(address: number): void {
    const runtime = this.requireWasmV2Runtime();
    runtime.exports.spp3eDelayAddressBusAccess(address & 0xffff);
    this.syncFrameCountersFromWasmV2(runtime);
  }

  override doReadPort(address: number): number {
    const runtime = this.requireWasmV2Runtime();
    this.syncKeyboardToWasmV2(runtime);
    const value = runtime.exports.spp3eReadPort(address & 0xffff);
    this.importWasmV2BusAccess(runtime);
    return value;
  }

  override delayPortRead(address: number): void {
    const runtime = this.requireWasmV2Runtime();
    runtime.exports.spp3eDelayPortRead(address & 0xffff);
    this.syncFrameCountersFromWasmV2(runtime);
  }

  override doWritePort(address: number, value: number): void {
    const runtime = this.requireWasmV2Runtime();
    runtime.exports.spp3eWritePort(address & 0xffff, value & 0xff);
    this.syncPagingStateFromWasmV2(runtime);
    this.importWasmV2BusAccess(runtime);
  }

  override delayPortWrite(address: number): void {
    const runtime = this.requireWasmV2Runtime();
    runtime.exports.spp3eDelayPortWrite(address & 0xffff);
    this.syncFrameCountersFromWasmV2(runtime);
  }

  override setTacts(value: number): void {
    super.setTacts(value);
    if (this.wasmV2Runtime != null) {
      this.wasmV2Runtime.exports.spp3eSetTacts(value >>> 0);
      this.syncFrameCountersFromWasmV2(this.wasmV2Runtime);
    }
  }

  override get screenWidthInPixels(): number {
    return this.wasmV2Runtime?.exports.spp3eGetScreenWidth() ?? super.screenWidthInPixels;
  }

  override get screenHeightInPixels(): number {
    return this.wasmV2Runtime?.exports.spp3eGetScreenHeight() ?? super.screenHeightInPixels;
  }

  override get tactsInDisplayLine(): number {
    return this.screenWidthInPixels / 2;
  }

  override getPixelBuffer(): Uint32Array {
    return this.requireWasmV2Runtime().pixelBuffer;
  }

  override getPixelBufferBytes(): Uint8ClampedArray {
    return this.requireWasmV2Runtime().pixelBufferBytes;
  }

  override renderInstantScreen(savedPixelBuffer?: Uint32Array): Uint32Array {
    const runtime = this.requireWasmV2Runtime();
    const pixels = runtime.pixelBuffer;
    const snapshot = new Uint32Array(pixels);
    if (savedPixelBuffer != null) {
      pixels.set(savedPixelBuffer.subarray(0, pixels.length));
    } else {
      runtime.exports.spp3eRenderInstantScreen();
    }
    return snapshot;
  }

  override getBufferStartOffset(): number {
    return this.requireWasmV2Runtime().exports.spp3eGetPixelBufferStartOffset();
  }

  /** The beam position overlay (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` §4.3, D4) */
  getBeamPosition(): BeamPosition {
    const ex = this.requireWasmV2Runtime().exports;
    return spectrumWasmBeamPosition(
      (field) => ex.spp3eGetBeamInfo(field),
      this.screenWidthInPixels,
      this.screenHeightInPixels,
      this.getBufferStartOffset()
    );
  }

  /** Renders the paused picture up to the beam: the ULA's own catch-up, which changes nothing later (T2) */
  renderToBeamPreview(): void {
    this.requireWasmV2Runtime().exports.spp3eRenderToBeam();
  }

  override getAudioSamples(): AudioSample[] {
    const runtime = this.requireWasmV2Runtime();
    const words = runtime.audioSamples;
    const sampleCount = runtime.exports.spp3eGetAudioSampleCount();
    this.wasmV2AudioSamples.length = 0;
    for (let i = 0; i < sampleCount; i++) {
      this.wasmV2AudioSamples.push({
        left: words[i * 2] / WASM_AUDIO_SAMPLE_SCALE,
        right: words[i * 2 + 1] / WASM_AUDIO_SAMPLE_SCALE
      });
    }
    return this.wasmV2AudioSamples;
  }

  override getCpuState(): CpuState {
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      this.syncCpuFromWasmV2(runtime);
      this.importWasmV2BusAccess(runtime);
    }
    return super.getCpuState();
  }

  getWasmV2Diagnostics(): SpP3eWasmV2Diagnostics {
    const runtime = this.requireWasmV2Runtime();
    return {
      backend: "wasm",
      engine: "v2",
      artifactName: runtime.artifactName,
      frames: runtime.exports.spp3eGetFrames(),
      tacts: runtime.exports.spp3eGetTacts(),
      audioSamples: runtime.exports.spp3eGetAudioSampleCount(),
      normalFrames: this.wasmV2NormalFrames,
      audioRateWrites: this.wasmV2AudioRateWrites,
      tapeUploads: this.wasmV2TapeUploadCount,
      tapeBlocks: runtime.exports.spp3eTapeGetBlockCount(),
      tapeBytes: runtime.exports.spp3eTapeGetDataLength(),
      tapeLoaded: runtime.exports.spp3eTapeGetLoaded() !== 0,
      tapeMode: runtime.exports.spp3eTapeGetMode(),
      tapeCurrentBlockIndex: runtime.exports.spp3eTapeGetCurrentBlockIndex(),
      tapeSavedBlocks: runtime.exports.spp3eTapeGetSavedBlockCount(),
      tapeSavedRevision: runtime.exports.spp3eTapeGetSavedRevision(),
      fdcEnabledDriveCount: runtime.exports.spp3eGetFdcEnabledDriveCount(),
      fdcMainStatusRegister: runtime.exports.spp3eFdcGetMainStatusRegister(),
      fdcCurrentDrive: runtime.exports.spp3eFdcGetCurrentDrive(),
      diskMotorOn: runtime.exports.spp3eGetDiskMotorOn() !== 0
    };
  }

  private hardResetWasmV2(runtime: SpP3eWasmV2Runtime): void {
    runtime.exports.spp3eHardReset();
    this.wasmV2NormalFrames = 0;
    this.wasmV2ContentionPauseBase = 0;
    this.invalidateWasmV2Sync();
    this.wasmV2SavedTapeRevision = 0;
    this.wasmV2DiskChangeRevision = runtime.exports.spp3eFdcGetDirtyRevision();
    this.setTactsInFrame(runtime.exports.spp3eGetTactsInFrame());
    this.syncDiskConfigToWasmV2(runtime);
    this.syncDiskStateToWasmV2(runtime);
  }

  private syncAudioSampleRateToWasmV2(runtime: SpP3eWasmV2Runtime): void {
    const audioRate = this.getMachineProperty(AUDIO_SAMPLE_RATE);
    if (typeof audioRate === "number" && audioRate !== this.wasmV2AudioSampleRate) {
      runtime.exports.spp3eSetAudioSampleRate(audioRate);
      this.wasmV2AudioSampleRate = audioRate;
      this.wasmV2AudioRateWrites++;
    }
  }

  private syncTapeStateToWasmV2(runtime: SpP3eWasmV2Runtime): void {
    const tapeBlocks = this.getMachineProperty(MEDIA_TAPE);
    if (Array.isArray(tapeBlocks)) {
      this.uploadTapeToWasmV2(runtime, tapeBlocks);
    } else {
      runtime.exports.spp3eTapeClear();
      this.wasmV2SavedTapeRevision = 0;
    }
    this.syncTapeControlPropertiesToWasmV2(runtime);
  }

  private syncTapePropertyToWasmV2(runtime: SpP3eWasmV2Runtime, key: string, value?: any): void {
    switch (key) {
      case MEDIA_TAPE:
        if (Array.isArray(value)) {
          this.uploadTapeToWasmV2(runtime, value);
        } else {
          runtime.exports.spp3eTapeClear();
          this.wasmV2SavedTapeRevision = 0;
        }
        this.syncTapeControlPropertiesToWasmV2(runtime);
        break;

      case TAPE_MODE:
        runtime.exports.spp3eTapeSetMode(this.normalizeTapeMode(value));
        break;

      case REWIND_REQUESTED:
        if (value === true || value === undefined) {
          runtime.exports.spp3eTapeRewind();
          this.syncTapeControlPropertiesToWasmV2(runtime);
        }
        break;

      case FAST_LOAD:
        runtime.exports.spp3eTapeSetFastLoad(value ? 1 : 0);
        break;
    }
  }

  private syncTapeControlPropertiesToWasmV2(runtime: SpP3eWasmV2Runtime): void {
    runtime.exports.spp3eTapeSetFastLoad(this.getMachineProperty(FAST_LOAD) ? 1 : 0);
    runtime.exports.spp3eTapeSetMode(this.normalizeTapeMode(this.getMachineProperty(TAPE_MODE)));
  }

  private uploadTapeToWasmV2(runtime: SpP3eWasmV2Runtime, blocks: TapeDataBlock[]): void {
    const totalDataLength = blocks.reduce((sum, block) => sum + block.data.length, 0);
    const wasm = runtime.exports;
    if (totalDataLength > runtime.tapeData.length) {
      throw new Error(
        `ZX Spectrum +3E WASM v2 tape is too large: ${totalDataLength} bytes. Capacity: ${runtime.tapeData.length}.`
      );
    }

    if (wasm.spp3eTapeBeginUpload(blocks.length, totalDataLength) === 0) {
      throw new Error(`ZX Spectrum +3E WASM v2 rejected tape upload with ${blocks.length} blocks.`);
    }

    let offset = 0;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      writeCoreBytes(runtime, runtime.tapeData, block.data, offset);
      if (
        wasm.spp3eTapeSetBlock(
          i,
          offset,
          block.data.length,
          block.pauseAfter,
          block.pilotPulseLength,
          block.sync1PulseLength,
          block.sync2PulseLength,
          block.zeroBitPulseLength,
          block.oneBitPulseLength,
          block.endSyncPulseLength,
          block.lastByteUsedBits ?? 8,
          block.pilotPulseCount ?? 0
        ) === 0
      ) {
        throw new Error(`ZX Spectrum +3E WASM v2 rejected tape block ${i}.`);
      }
      offset += block.data.length;
    }

    if (wasm.spp3eTapeFinishUpload() === 0) {
      throw new Error("ZX Spectrum +3E WASM v2 could not finish tape upload.");
    }
    this.wasmV2SavedTapeRevision = 0;
    this.wasmV2TapeUploadCount++;
  }

  private publishSavedTapeFromWasmV2(runtime: SpP3eWasmV2Runtime): void {
    const wasm = runtime.exports;
    const revision = wasm.spp3eTapeGetSavedRevision();
    if (revision === this.wasmV2SavedTapeRevision || revision === 0) {
      return;
    }

    this.wasmV2SavedTapeRevision = revision;
    const blockCount = wasm.spp3eTapeGetSavedBlockCount();
    if (blockCount === 0) {
      return;
    }

    const writer = new BinaryWriter();
    new TzxHeader().writeTo(writer);
    let savedName = "export";

    for (let i = 0; i < blockCount; i++) {
      const offset = wasm.spp3eTapeGetSavedBlockOffset(i);
      const length = wasm.spp3eTapeGetSavedBlockLength(i);
      const blockData = new Uint8Array(runtime.tapeSaveData.subarray(offset, offset + length));
      if (blockData.length === 0x13 && blockData[0] === 0x00) {
        savedName = this.getSpectrumHeaderName(blockData) ?? savedName;
      }

      const tzxBlock = new TzxStandardSpeedBlock();
      tzxBlock.pauseAfter = 1000;
      tzxBlock.dataLength = blockData.length;
      tzxBlock.data = blockData;
      tzxBlock.writeTo(writer);
    }

    super.setMachineProperty(SAVED_TO_TAPE, {
      name: `${savedName}.tzx`,
      contents: writer.buffer
    });
  }

  private getSpectrumHeaderName(blockData: Uint8Array): string | undefined {
    const chars: string[] = [];
    for (let i = 2; i < 12; i++) {
      const charCode = blockData[i];
      if (charCode >= 32 && charCode <= 126) {
        chars.push(String.fromCharCode(charCode));
      }
    }
    const name = chars.join("").trim();
    return name.length > 0 ? name : undefined;
  }

  private normalizeTapeMode(value: unknown): TapeMode {
    return typeof value === "number" && value >= TapeMode.Passive && value <= TapeMode.Save
      ? value
      : TapeMode.Passive;
  }

  private syncKeyboardToWasmV2(runtime: SpP3eWasmV2Runtime): void {
    for (let line = 0; line < 8; line++) {
      const lineValue = this.keyboardDevice.getKeyLineValue(line) & 0x1f;
      if (this.wasmV2KeyboardRowsValid && this.wasmV2KeyboardRows[line] === lineValue) {
        continue;
      }
      const oldLineValue = this.wasmV2KeyboardRowsValid ? this.wasmV2KeyboardRows[line] : 0;
      const changedBits = oldLineValue ^ lineValue;
      for (let bit = 0; bit < 5; bit++) {
        const mask = 1 << bit;
        if ((changedBits & mask) !== 0) {
          runtime.exports.spp3eSetKeyStatus(line * 5 + bit, (lineValue & mask) !== 0 ? 1 : 0);
        }
      }
      this.wasmV2KeyboardRows[line] = lineValue;
    }
    this.wasmV2KeyboardRowsValid = true;
  }

  private syncDiskConfigToWasmV2(runtime: SpP3eWasmV2Runtime): void {
    const driveCount = typeof this.config?.[MC_DISK_SUPPORT] === "number"
      ? Number(this.config[MC_DISK_SUPPORT])
      : 0;
    runtime.exports.spp3eSetFdcEnabledDriveCount(Math.max(0, Math.min(2, driveCount)));
  }

  private syncDiskStateToWasmV2(runtime: SpP3eWasmV2Runtime): void {
    this.syncDiskConfigToWasmV2(runtime);
    this.syncDiskMediaToWasmV2(
      runtime,
      0,
      this.getMachineProperty(MEDIA_DISK_A),
      !!this.getMachineProperty(DISK_A_WP)
    );
    this.syncDiskMediaToWasmV2(
      runtime,
      1,
      this.getMachineProperty(MEDIA_DISK_B),
      !!this.getMachineProperty(DISK_B_WP)
    );
  }

  private syncDiskPropertyToWasmV2(runtime: SpP3eWasmV2Runtime, key: string, value?: any): void {
    if (key === MEDIA_DISK_A) {
      this.syncDiskMediaToWasmV2(runtime, 0, value, !!this.getMachineProperty(DISK_A_WP));
    } else if (key === MEDIA_DISK_B) {
      this.syncDiskMediaToWasmV2(runtime, 1, value, !!this.getMachineProperty(DISK_B_WP));
    } else if (key === DISK_A_WP) {
      runtime.exports.spp3eDiskSetWriteProtected(0, value ? 1 : 0);
    } else if (key === DISK_B_WP) {
      runtime.exports.spp3eDiskSetWriteProtected(1, value ? 1 : 0);
    }
  }

  private syncDiskMediaToWasmV2(
    runtime: SpP3eWasmV2Runtime,
    drive: number,
    value: unknown,
    writeProtected: boolean
  ): void {
    if (!(value instanceof Uint8Array)) {
      runtime.exports.spp3eDiskEject(drive);
      this.wasmV2DiskPayloads[drive] = undefined;
      return;
    }
    const payload = this.createWasmDiskPayload(value);
    if (
      runtime.exports.spp3eDiskBeginUpload(
        drive,
        payload.data.length,
        writeProtected ? 1 : 0,
        payload.tracks,
        payload.sides,
        payload.sectorsPerTrack,
        payload.firstSectorId,
        payload.sectorLength
      ) === 0
    ) {
      this.wasmV2DiskPayloads[drive] = undefined;
      return;
    }
    for (let i = 0; i < payload.data.length; i++) {
      runtime.exports.spp3eDiskWriteData(drive, i, payload.data[i]);
    }
    runtime.exports.spp3eDiskFinishUpload(drive);
    this.wasmV2DiskPayloads[drive] = payload;
  }

  private publishDiskChangesFromWasmV2(runtime: SpP3eWasmV2Runtime): void {
    const revision = runtime.exports.spp3eFdcGetDirtyRevision();
    if (revision === this.wasmV2DiskChangeRevision) {
      return;
    }

    this.mergePendingDiskChanges(
      DISK_A_CHANGES,
      this.collectWasmDiskChanges(runtime, 0, runtime.diskChanges)
    );
    this.mergePendingDiskChanges(
      DISK_B_CHANGES,
      this.collectWasmDiskChanges(runtime, 1, runtime.diskBChanges)
    );
    fillCoreBytes(runtime, runtime.diskChanges, 0);
    fillCoreBytes(runtime, runtime.diskBChanges, 0);
    this.wasmV2DiskChangeRevision = revision;
  }

  /**
   * After a reverse-debugging fork (REVERSE_DEBUGGING_PLAN D13): every sector of the inserted disks
   * goes to the write-back, so the `.dsk` files follow the restored in-core disks
   * @returns true when there was a disk to write back
   */
  republishDisks(): boolean {
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return false;
    let any = false;
    for (let drive = 0; drive < 2; drive++) {
      const payload = this.wasmV2DiskPayloads[drive];
      if (payload == null || payload.sectorLength === 0) continue;
      const diskData = drive === 0 ? runtime.diskData : runtime.diskBData;
      const changes: SectorChanges = new Map();
      this.collectWasmDiskRangeChanges(changes, diskData, payload, 0, Math.min(payload.data.length, diskData.length));
      if (changes.size === 0) continue;
      this.mergePendingDiskChanges(drive === 0 ? DISK_A_CHANGES : DISK_B_CHANGES, changes);
      any = true;
    }
    return any;
  }

  private collectWasmDiskChanges(
    runtime: SpP3eWasmV2Runtime,
    drive: number,
    journal: Uint8Array
  ): SectorChanges | undefined {
    const payload = this.wasmV2DiskPayloads[drive];
    if (payload == null || payload.sectorLength === 0) {
      return undefined;
    }

    const diskData = drive === 0 ? runtime.diskData : runtime.diskBData;
    const changes: SectorChanges = new Map();
    for (let entryOffset = 0; entryOffset + 8 <= journal.length; entryOffset += 8) {
      const length = this.readUint32Le(journal, entryOffset + 4);
      if (length === 0) {
        break;
      }
      const offset = this.readUint32Le(journal, entryOffset);
      this.collectWasmDiskRangeChanges(changes, diskData, payload, offset, length);
    }

    return changes.size > 0 ? changes : undefined;
  }

  private collectWasmDiskRangeChanges(
    changes: SectorChanges,
    diskData: Uint8Array,
    payload: WasmDiskPayload,
    offset: number,
    length: number
  ): void {
    const sectorLength = payload.sectorLength;
    const firstSector = Math.floor(offset / sectorLength);
    const lastSector = Math.floor((offset + length - 1) / sectorLength);
    for (let sectorOrdinal = firstSector; sectorOrdinal <= lastSector; sectorOrdinal++) {
      const sectorIndex = sectorOrdinal % payload.sectorsPerTrack;
      const trackOrdinal = Math.floor(sectorOrdinal / payload.sectorsPerTrack);
      const trackIndex = trackOrdinal;
      const sectorId = payload.firstSectorId + sectorIndex;
      const sectorOffset = sectorOrdinal * sectorLength;
      if (sectorOffset + sectorLength > diskData.length) {
        continue;
      }
      changes.set(
        trackIndex * 100 + sectorId,
        new Uint8Array(diskData.subarray(sectorOffset, sectorOffset + sectorLength))
      );
    }
  }

  private mergePendingDiskChanges(property: string, changes: SectorChanges | undefined): void {
    if (!changes || changes.size === 0) {
      return;
    }
    const pendingChanges = this.getMachineProperty(property) as SectorChanges;
    if (pendingChanges) {
      changes.forEach((sectorData, sectorKey) => pendingChanges.set(sectorKey, sectorData));
    } else {
      super.setMachineProperty(property, changes);
    }
  }

  private readUint32Le(buffer: Uint8Array, offset: number): number {
    return (
      buffer[offset] |
      (buffer[offset + 1] << 8) |
      (buffer[offset + 2] << 16) |
      (buffer[offset + 3] << 24)
    ) >>> 0;
  }

  private createWasmDiskPayload(contents: Uint8Array): WasmDiskPayload {
    try {
      const disk = readDiskData(contents);
      const sectors = disk.tracks.flatMap((track) => track.sectors);
      if (sectors.length === 0) {
        throw new Error("Disk has no sectors.");
      }

      const sides = Math.max(1, Math.min(2, disk.numSides));
      const sectorsPerTrack = Math.max(...disk.tracks.map((track) => track.sectorCount));
      const firstSectorId = Math.min(...sectors.map((sector) => sector.R));
      const sectorLength = Math.max(
        ...sectors.map((sector) => Math.max(0x80 << (sector.N & 0x07), sector.actualLength))
      );
      const data = new Uint8Array(disk.numTracks * sides * sectorsPerTrack * sectorLength);
      data.fill(0xe5);

      for (const track of disk.tracks) {
        for (const sector of track.sectors) {
          const sectorIndex = sector.R - firstSectorId;
          const side = sector.H & 0x01;
          if (sectorIndex < 0 || sectorIndex >= sectorsPerTrack || side >= sides) {
            continue;
          }
          const offset =
            (((sector.C * sides + side) * sectorsPerTrack + sectorIndex) * sectorLength);
          data.set(sector.sectorData.subarray(0, sectorLength), offset);
        }
      }

      return { data, tracks: disk.numTracks, sides, sectorsPerTrack, firstSectorId, sectorLength };
    } catch {
      return {
        data: contents,
        tracks: 42,
        sides: 2,
        sectorsPerTrack: 32,
        firstSectorId: 1,
        sectorLength: 0
      };
    }
  }

  /**
   * The WASM backend owns the contention counters, so the JS-side fields are refreshed from the
   * backend whenever machine state is synced. `contentionDelaySincePause` restarts at every run, so
   * it is reported relative to the backend value captured at the last reset.
   */
  override resetContentionDelaySincePause(): void {
    this.wasmV2ContentionPauseBase =
      this.wasmV2Runtime?.exports.spp3eGetContentionDelaySincePause() ?? 0;
    this.contentionDelaySincePause = 0;
  }

  private syncContentionCountersFromWasmV2(runtime: SpP3eWasmV2Runtime): void {
    const wasm = runtime.exports;
    this.totalContentionDelaySinceStart = wasm.spp3eGetTotalContentionDelaySinceStart();
    this.contentionDelaySincePause =
      wasm.spp3eGetContentionDelaySincePause() - this.wasmV2ContentionPauseBase;
  }

  /**
   * The core's breakpoint condition evaluator: its program store. The shared C evaluator reads the
   * registers and memory inside the core (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md`).
   */
  getConditionStore(): ConditionStore | undefined {
    return this.wasmV2Runtime ? conditionStoreOf(this.wasmV2Runtime) : undefined;
  }


  private syncCpuFromWasmV2(runtime: SpP3eWasmV2Runtime): void {
    const wasm = runtime.exports;
    super.af = wasm.spp3eGetCpuAf();
    super.af_ = wasm.spp3eGetCpuAfAlt();
    super.bc = wasm.spp3eGetCpuBc();
    super.bc_ = wasm.spp3eGetCpuBcAlt();
    super.de = wasm.spp3eGetCpuDe();
    super.de_ = wasm.spp3eGetCpuDeAlt();
    super.hl = wasm.spp3eGetCpuHl();
    super.hl_ = wasm.spp3eGetCpuHlAlt();
    super.ix = wasm.spp3eGetCpuIx();
    super.iy = wasm.spp3eGetCpuIy();
    super.ir = wasm.spp3eGetCpuIr();
    super.wz = wasm.spp3eGetCpuWz();
    super.pc = wasm.spp3eGetCpuPc();
    super.sp = wasm.spp3eGetCpuSp();
    this.tacts = wasm.spp3eGetTacts();
    this.frames = wasm.spp3eGetFrames();
    this.frameTacts = wasm.spp3eGetCurrentFrameTact();
    this.currentFrameTact = this.frameTacts;
    this.halted = wasm.spp3eGetCpuHalted() !== 0;
    this.opCode = wasm.spp3eGetCpuPrefix();
    this.iff1 = wasm.spp3eGetCpuIff1() !== 0;
    this.iff2 = wasm.spp3eGetCpuIff2() !== 0;
    this.interruptMode = wasm.spp3eGetCpuInterruptMode();
    this.syncPagingStateFromWasmV2(runtime);
    this.syncContentionCountersFromWasmV2(runtime);
  }

  private syncFrameCountersFromWasmV2(runtime: SpP3eWasmV2Runtime): void {
    const wasm = runtime.exports;
    super.pc = wasm.spp3eGetCpuPc();
    this.frames = wasm.spp3eGetFrames();
    this.tacts = wasm.spp3eGetTacts();
    this.frameTacts = wasm.spp3eGetCurrentFrameTact();
    this.currentFrameTact = this.frameTacts;
    this.syncPagingStateFromWasmV2(runtime);
    this.syncContentionCountersFromWasmV2(runtime);
  }

  private syncPagingStateFromWasmV2(runtime: SpP3eWasmV2Runtime): void {
    const wasm = runtime.exports;
    this.selectedRom = wasm.spp3eGetSelectedRom();
    this.selectedBank = wasm.spp3eGetSelectedBank();
    this.pagingEnabled = wasm.spp3eGetPagingEnabled() !== 0;
    this.useShadowScreen = wasm.spp3eGetUseShadowScreen() !== 0;
    this.inSpecialPagingMode = wasm.spp3eGetInSpecialPagingMode() !== 0;
    this.specialConfigMode = wasm.spp3eGetSpecialConfigMode();
    this.diskMotorOn = wasm.spp3eGetDiskMotorOn() !== 0;
  }

  protected readPsgExport(name: string, ...args: number[]): number | undefined {
    const fn = this.wasmV2Runtime?.exports[`spp3e${name}` as keyof SpP3eWasmV2Runtime["exports"]];
    return typeof fn === "function" ? fn(...args) : undefined;
  }

  protected writePsgIndex(index: number): void {
    this.wasmV2Runtime?.exports.spp3eSetPsgRegisterIndex(index & 0x0f);
  }

  protected writePsgValue(value: number): void {
    this.wasmV2Runtime?.exports.spp3eWritePsgRegisterValue(value & 0xff);
  }

  /**
   * Runs instructions one at a time until the frame ends or something asks the loop to stop.
   *
   * Everything outside `NoDebug` + `Normal` arrives here, which includes the plain non-debug
   * `ReachExecPoint` steps of a code-injection flow - so this loop, not just the debugger, carries
   * the machine's boot whenever the IDE starts a compiled project. It therefore only mirrors per
   * instruction what the stop tests below actually read. The full register set is mirrored once, on
   * the way out, by `finishWasmV2DebugLoop()`.
   */
  /** The debug loop's hooks, built once per core instance and RZX session: a stable object lets the JIT inline them */
  private wasmV2DebugLoopHost?: { runtime: SpP3eWasmV2Runtime; rzx: IRzxSession | undefined; host: WasmDebugLoopHost };

  private executeWasmV2DebugLoop(runtime: SpP3eWasmV2Runtime): FrameTerminationMode {
    const rzx = this.rzxSession?.active ? this.rzxSession : undefined;
    const cached = this.wasmV2DebugLoopHost;
    if (cached?.runtime !== runtime || cached.rzx !== rzx) {
      this.wasmV2DebugLoopHost = { runtime, rzx, host: this.createWasmV2DebugLoopHost(runtime, rzx) };
    }
    return runWasmDebugLoop(this.wasmV2DebugLoopHost!.host);
  }

  private createWasmV2DebugLoopHost(runtime: SpP3eWasmV2Runtime, rzx: IRzxSession | undefined): WasmDebugLoopHost {
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
          this.onInitNewFrame(false);
          this.frameCompleted = false;
        }

        this.syncCpuFromWasmV2(runtime);

        // --- Frame-level concerns, done once per entry exactly as the full-frame path above does them.
        // --- Queued keystrokes are timed in tacts and held for whole frames, so the queue cannot
        // --- advance faster than the frame counter it is measured against anyway.
        this.emulateKeystroke();
        if (rzx?.mode !== "play") this.syncKeyboardToWasmV2(runtime);
        this.syncAudioSampleRateToWasmV2(runtime);
        return undefined;
      },
      // --- An RZX session decides around every instruction call (`zx-spectrum-rzx.c`)
      beforeInstruction: rzx
        ? () => (rzx.beforeInstruction() ? undefined : FrameTerminationMode.DebugEvent)
        : undefined,
      executeInstruction: () => {
        wasm.spp3eExecuteInstruction();
      },
      afterInstruction: rzx ? () => rzx.afterInstruction() : undefined,
      // --- The core's own loop runs to the next place the stop policy may stop at (z80-debug-loop.c);
      // --- an RZX session decides around every instruction call, so it keeps the run in TypeScript
      executeUntilStop: (extraStop, mask, accessMask) => wasm.spp3eExecuteUntilStop(extraStop, mask, accessMask),
      lastOpStart: () => wasm.spp3eGetDebugOpStart(),
      pushBreakpointFlags: (flags) => runtime.breakpointFlags.set(flags),
      conditionPlan: () => runtime.condPlan,
      canRunInCore: () => rzx === undefined,
      // --- In playback a frame completes only at an RZX frame end
      coreFrameCompleted: () => (rzx?.mode === "play" ? false : wasm.spp3eGetFrameCompleted() !== 0),
      // --- Past this class's `pc` setter, which would push the value just read from the core back into it
      mirrorPc: () => {
        const pc = wasm.spp3eGetCpuPc();
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

  /**
   * Single exit of the debug loop: brings the TypeScript-side machine state back in step with the
   * WASM core before anyone can observe it. The loop itself only keeps the handful of fields its
   * stop tests read up to date, so the registers, counters and bus mirror are refreshed here.
   */
  private finishWasmV2DebugLoop(termination: FrameTerminationMode): FrameTerminationMode {
    const runtime = this.requireWasmV2Runtime();
    const rzx = this.rzxSession;
    if (rzx?.active && !rzx.afterRun(this.frameCompleted)) {
      termination = FrameTerminationMode.DebugEvent;
    }
    this.syncCpuFromWasmV2(runtime);
    this.importWasmV2BusAccess(runtime);
    this.publishSavedTapeFromWasmV2(runtime);
    this.flushDiskChanges();
    this.executionContext.lastTerminationReason = termination;
    return termination;
  }

  /**
   * Records where a step-out should land, reading the core's shadow stack.
   *
   * The inherited implementation walks a stack that `Z80Cpu` pushes on every CALL and RST — code
   * that never runs here, because the CPU executes inside the WASM core. It therefore always
   * produced -1, so `stepOutAddress === pc` could never be true and step-out had nothing to stop
   * on. The core keeps the equivalent stack now; this reads the top of it.
   *
   * `0xffffffff` is the core's "nothing has been called" sentinel, mapped back to the -1 the rest
   * of the debugger expects.
   */
  /** Interrupt handlers running now, from the core's shadow stack (source stepping, plan §10.2.7). */
  override getInterruptDepth(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.spp3eGetInterruptDepth() : super.getInterruptDepth();
  }

  override markStepOutAddress(): void {
    this.stepOutAddress = stepOutAddressFromCore(this.requireWasmV2Runtime().exports.spp3eGetStepOutAddress());
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
    return hasWasmAccessBreakpoint(
      this.executionContext.debugSupport,
      this,
      (address) => this.getPartition(address),
      this.lastMemoryReadValues,
      this.lastMemoryWriteValues
    );
  }

  private importWasmV2BusAccess(runtime: SpP3eWasmV2Runtime): void {
    const wasm = runtime.exports;
    this.lastContendedValue = wasm.spp3eGetLastContendedValue();
    this.lastUlaReadValue = wasm.spp3eGetLastUlaReadValue();
    this.lastIoReadPort = undefined;
    this.lastIoWritePort = undefined;
    importAccessLog(this, runtime.accessLog, wasm.spp3eGetAccessLogCount());

    const portAddress = wasm.spp3eGetLastPortAddress();
    const portValue = wasm.spp3eGetLastPortValue();
    if (wasm.spp3eGetLastPortIsWrite() !== 0) {
      this.lastIoWritePort = portAddress;
      this.lastIoWriteValue = portValue;
    } else if (portAddress !== 0 || portValue !== 0) {
      this.lastIoReadPort = portAddress;
      this.lastIoReadValue = portValue;
    }
  }








  /**
   * Replaces the machine's state with a snapshot's (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.4).
   * Call it through `IMachineController.restoreState`, which leaves the machine Paused. The disks
   * stay as inserted: the floppy controller is reset, not restored (trap 7).
   * @returns The frame tact the machine stands at
   * @throws When the snapshot needs another machine
   */
  loadSnapshotState(snapshot: SpectrumSnapshot): number {
    assertSnapshotFitsMachine(snapshot, "spp3e", undefined);
    const runtime = this.requireWasmV2Runtime();
    const frameTact = restoreSpectrumSnapshot(
      { prefix: "spp3e", exports: runtime.exports, ram: runtime.ram, reset: () => this.reset() },
      snapshot
    );
    this.invalidateWasmV2Sync();
    this.syncCpuFromWasmV2(runtime);
    return frameTact;
  }

  /**
   * Reads the machine's state as a snapshot model, without changing it
   * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.1). The machine must be paused.
   * @param media The tape and disk files the media store holds
   * @throws When the CPU stands inside a prefixed instruction
   */
  captureSnapshotState(media?: SpectrumSnapshotCaptureMedia): SpectrumSnapshot {
    const runtime = this.requireWasmV2Runtime();
    return captureSpectrumSnapshot(
      { prefix: "spp3e", exports: runtime.exports, ram: runtime.ram, romSet: this.romSet },
      media
    );
  }

  /**
   * Captures the machine's whole state: the core's memory image plus this wrapper's own fields
   * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.5). The machine must be paused.
   */
  saveMachineState(): MachineStateParts {
    const runtime = this.requireWasmV2Runtime();
    return {
      ...captureWasmImage("spp3e", runtime.module, runtime.exports.memory.buffer),
      host: this.captureHostState()
    };
  }

  // ------------------------------------------------------------------------------------------------
  // Reverse debugging (`.plans/REVERSE_DEBUGGING_PLAN.md` §4.2, `reverse/Timeline.ts`)

  /** The core, as the export contract names it */
  get reverseCoreId(): string {
    return "spp3e";
  }

  get reverseRuntime(): SpP3eWasmV2Runtime | undefined {
    return this.wasmV2Runtime;
  }

  readonly reverseFrameExport = "spp3eExecuteFrame";

  isAtFrameBoundary(): boolean {
    return this.wasmV2Runtime?.exports.spp3eGetFrameCompleted() !== 0;
  }

  /** The wrapper's own fields: what a state file and a keyframe keep besides the image */
  captureHostState(): Record<string, unknown> {
    return { normalFrames: this.wasmV2NormalFrames };
  }

  /**
   * After the core changed under the wrapper (a replay, a return to the present, T7): the wrapper's
   * fields from `state`, the mirrors re-read from the core. Nothing live is pushed - the controller
   * calls `invalidateHostSync` when live input resumes - and queued keystrokes of the replaced run go.
   * What the core holds - a saved tape, the disks' write revision - is not published again as new;
   * unlike a state load, the disks stay attached to their files (the timeline's past is theirs).
   */
  restoreHostState(state: unknown): void {
    const runtime = this.requireWasmV2Runtime();
    const host = (state ?? {}) as { normalFrames?: number };
    this.wasmV2NormalFrames = host.normalFrames ?? 0;
    this.wasmV2AudioSamples.length = 0;
    this.emulatedKeyStrokes.length = 0;
    this.wasmV2SavedTapeRevision = runtime.exports.spp3eTapeGetSavedRevision();
    this.wasmV2DiskChangeRevision = runtime.exports.spp3eFdcGetDirtyRevision();
    this.frameCompleted = runtime.exports.spp3eGetFrameCompleted() !== 0;
    this.syncFrameCountersFromWasmV2(runtime);
    this.syncCpuFromWasmV2(runtime);
  }

  /**
   * Puts the machine back into a saved state. The core's memory - tape and disks included - comes
   * from the state; the host-side caches are invalidated so the next frame pushes the live host's
   * keyboard, audio rate and clock speed. Queued work of the run being replaced is dropped.
   * @throws MachineStateMismatchError when the state was saved by another core or layout
   */
  loadMachineState(parts: MachineStateParts): void {
    const runtime = this.requireWasmV2Runtime();
    restoreWasmImage(parts, "spp3e", runtime.module, runtime.exports.memory.buffer);
    const host = parts.host as { normalFrames?: number };
    this.wasmV2NormalFrames = host.normalFrames ?? 0;
    this.wasmV2AudioSamples.length = 0;
    this.invalidateWasmV2Sync();
    // --- What the core already holds must not be published again as new
    this.wasmV2SavedTapeRevision = runtime.exports.spp3eTapeGetSavedRevision();
    // --- The restored disks are detached from their files (D11): with no payload, no sector the
    // --- rewound machine writes is merged back into a host .dsk; inserting a disk attaches again
    this.wasmV2DiskChangeRevision = runtime.exports.spp3eFdcGetDirtyRevision();
    this.wasmV2DiskPayloads.length = 0;
    fillCoreBytes(runtime, runtime.diskChanges, 0);
    fillCoreBytes(runtime, runtime.diskBChanges, 0);
    this.syncFrameCountersFromWasmV2(runtime);
    this.syncCpuFromWasmV2(runtime);
  }

  /** Forgets what was last pushed into the core, so the next frame pushes the live state (D8) */
  invalidateHostSync(): void {
    this.invalidateWasmV2Sync();
  }

  private invalidateWasmV2Sync(): void {
    this.wasmV2KeyboardRowsValid = false;
    this.wasmV2AudioSampleRate = -1;
  }

  private requireWasmV2Runtime(): SpP3eWasmV2Runtime {
    if (this.wasmV2Runtime == null) {
      throw new Error("ZX Spectrum +3E WASM v2 runtime is not loaded.");
    }
    return this.wasmV2Runtime;
  }
}
