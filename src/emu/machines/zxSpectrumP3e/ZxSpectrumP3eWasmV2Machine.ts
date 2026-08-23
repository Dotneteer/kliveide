import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { CpuState } from "@common/messaging/EmuApi";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import type { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";
import type { SpP3eWasmV2LoaderOptions, SpP3eWasmV2Runtime } from "./wasm/SpP3eWasmV2Loader";
import type { TapeDataBlock } from "@common/structs/TapeDataBlock";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
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
export class ZxSpectrumP3eWasmV2Machine extends ZxSpectrumP3eWasmHost {
  public readonly implementation = "wasm" as const;
  public wasmV2Runtime?: SpP3eWasmV2Runtime;
  private readonly wasmV2AudioSamples: AudioSample[] = [];
  private readonly wasmV2KeyboardRows = new Uint8Array(8);
  private wasmV2KeyboardRowsValid = false;
  private wasmV2AudioSampleRate = -1;
  private wasmV2NormalFrames = 0;
  private wasmV2AudioRateWrites = 0;
  private wasmV2TapeUploadCount = 0;
  private wasmV2SavedTapeRevision = 0;
  private wasmV2DiskChangeRevision = 0;
  private readonly wasmV2DiskPayloads: (WasmDiskPayload | undefined)[] = [];

  constructor(
    public readonly requestedModelInfo?: MachineModel,
    public readonly requestedConfig?: MachineConfigSet,
    private readonly wasmV2LoaderOptions?: SpP3eWasmV2LoaderOptions
  ) {
    super(requestedModelInfo, requestedConfig);
  }

  override get a(): number {
    return super.a;
  }

  override set a(value: number) {
    super.a = value;
    this.syncWasmV2AfFromFacade();
  }

  override get f(): number {
    return super.f;
  }

  override set f(value: number) {
    super.f = value;
    this.syncWasmV2AfFromFacade();
  }

  override get af(): number {
    return super.af;
  }

  override set af(value: number) {
    super.af = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuAf(super.af);
  }

  override get b(): number {
    return super.b;
  }

  override set b(value: number) {
    super.b = value;
    this.syncWasmV2BcFromFacade();
  }

  override get c(): number {
    return super.c;
  }

  override set c(value: number) {
    super.c = value;
    this.syncWasmV2BcFromFacade();
  }

  override get bc(): number {
    return super.bc;
  }

  override set bc(value: number) {
    super.bc = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuBc(super.bc);
  }

  override get d(): number {
    return super.d;
  }

  override set d(value: number) {
    super.d = value;
    this.syncWasmV2DeFromFacade();
  }

  override get e(): number {
    return super.e;
  }

  override set e(value: number) {
    super.e = value;
    this.syncWasmV2DeFromFacade();
  }

  override get de(): number {
    return super.de;
  }

  override set de(value: number) {
    super.de = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuDe(super.de);
  }

  override get h(): number {
    return super.h;
  }

  override set h(value: number) {
    super.h = value;
    this.syncWasmV2HlFromFacade();
  }

  override get l(): number {
    return super.l;
  }

  override set l(value: number) {
    super.l = value;
    this.syncWasmV2HlFromFacade();
  }

  override get hl(): number {
    return super.hl;
  }

  override set hl(value: number) {
    super.hl = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuHl(super.hl);
  }

  override get af_(): number {
    return super.af_;
  }

  override set af_(value: number) {
    super.af_ = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuAfAlt(super.af_);
  }

  override get bc_(): number {
    return super.bc_;
  }

  override set bc_(value: number) {
    super.bc_ = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuBcAlt(super.bc_);
  }

  override get de_(): number {
    return super.de_;
  }

  override set de_(value: number) {
    super.de_ = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuDeAlt(super.de_);
  }

  override get hl_(): number {
    return super.hl_;
  }

  override set hl_(value: number) {
    super.hl_ = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuHlAlt(super.hl_);
  }

  override get xh(): number {
    return super.xh;
  }

  override set xh(value: number) {
    super.xh = value;
    this.syncWasmV2IxFromFacade();
  }

  override get xl(): number {
    return super.xl;
  }

  override set xl(value: number) {
    super.xl = value;
    this.syncWasmV2IxFromFacade();
  }

  override get ix(): number {
    return super.ix;
  }

  override set ix(value: number) {
    super.ix = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuIx(super.ix);
  }

  override get yh(): number {
    return super.yh;
  }

  override set yh(value: number) {
    super.yh = value;
    this.syncWasmV2IyFromFacade();
  }

  override get yl(): number {
    return super.yl;
  }

  override set yl(value: number) {
    super.yl = value;
    this.syncWasmV2IyFromFacade();
  }

  override get iy(): number {
    return super.iy;
  }

  override set iy(value: number) {
    super.iy = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuIy(super.iy);
  }

  override get i(): number {
    return super.i;
  }

  override set i(value: number) {
    super.i = value;
    this.syncWasmV2IrFromFacade();
  }

  override get r(): number {
    return super.r;
  }

  override set r(value: number) {
    super.r = value;
    this.syncWasmV2IrFromFacade();
  }

  override get ir(): number {
    return super.ir;
  }

  override set ir(value: number) {
    super.ir = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuIr(super.ir);
  }

  override get wz(): number {
    return super.wz;
  }

  override set wz(value: number) {
    super.wz = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuWz(super.wz);
  }

  override get pc(): number {
    return super.pc;
  }

  override set pc(value: number) {
    super.pc = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuPc(super.pc);
  }

  override get sp(): number {
    return super.sp;
  }

  override set sp(value: number) {
    super.sp = value;
    this.wasmV2Runtime?.exports.spp3eSetCpuSp(super.sp);
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
      return this.executeWasmV2DebugStep(runtime);
    }

    this.emulateKeystroke();
    this.syncKeyboardToWasmV2(runtime);
    this.syncAudioSampleRateToWasmV2(runtime);
    runtime.exports.spp3eExecuteFrame();
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

  override readScreenMemory(offset: number): number {
    const runtime = this.requireWasmV2Runtime();
    const value = runtime.exports.spp3eReadScreenMemoryOffset(offset & 0x3fff);
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
    const value = runtime.exports.spp3eReadMemory(address & 0xffff);
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
    return this.requireWasmV2Runtime().exports.spp3eGetScreenWidth();
  }

  override get screenHeightInPixels(): number {
    return this.requireWasmV2Runtime().exports.spp3eGetScreenHeight();
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
      runtime.tapeData.set(block.data, offset);
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
    runtime.diskChanges.fill(0);
    runtime.diskBChanges.fill(0);
    this.wasmV2DiskChangeRevision = revision;
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

  private syncCpuFromWasmV2(runtime: SpP3eWasmV2Runtime): void {
    const wasm = runtime.exports;
    this.af = wasm.spp3eGetCpuAf();
    this.af_ = wasm.spp3eGetCpuAfAlt();
    this.bc = wasm.spp3eGetCpuBc();
    this.bc_ = wasm.spp3eGetCpuBcAlt();
    this.de = wasm.spp3eGetCpuDe();
    this.de_ = wasm.spp3eGetCpuDeAlt();
    this.hl = wasm.spp3eGetCpuHl();
    this.hl_ = wasm.spp3eGetCpuHlAlt();
    this.ix = wasm.spp3eGetCpuIx();
    this.iy = wasm.spp3eGetCpuIy();
    this.ir = wasm.spp3eGetCpuIr();
    this.wz = wasm.spp3eGetCpuWz();
    this.pc = wasm.spp3eGetCpuPc();
    this.sp = wasm.spp3eGetCpuSp();
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
  }

  private syncFrameCountersFromWasmV2(runtime: SpP3eWasmV2Runtime): void {
    const wasm = runtime.exports;
    this.pc = wasm.spp3eGetCpuPc();
    this.frames = wasm.spp3eGetFrames();
    this.tacts = wasm.spp3eGetTacts();
    this.frameTacts = wasm.spp3eGetCurrentFrameTact();
    this.currentFrameTact = this.frameTacts;
    this.syncPagingStateFromWasmV2(runtime);
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

  private executeWasmV2DebugStep(runtime: SpP3eWasmV2Runtime): FrameTerminationMode {
    this.emulateKeystroke();
    this.syncKeyboardToWasmV2(runtime);
    this.syncAudioSampleRateToWasmV2(runtime);
    runtime.exports.spp3eExecuteInstruction();
    this.syncCpuFromWasmV2(runtime);
    this.importWasmV2BusAccess(runtime);
    this.publishSavedTapeFromWasmV2(runtime);
    this.flushDiskChanges();
    this.frameCompleted = runtime.exports.spp3eGetFrameCompleted() !== 0;
    this.executionContext.lastTerminationReason = FrameTerminationMode.DebugEvent;
    return FrameTerminationMode.DebugEvent;
  }

  private importWasmV2BusAccess(runtime: SpP3eWasmV2Runtime): void {
    const wasm = runtime.exports;
    this.lastContendedValue = wasm.spp3eGetLastContendedValue();
    this.lastUlaReadValue = wasm.spp3eGetLastUlaReadValue();
    this.lastMemoryReadsCount = 0;
    this.lastMemoryWritesCount = 0;
    this.lastIoReadPort = undefined;
    this.lastIoWritePort = undefined;

    const memoryAddress = wasm.spp3eGetLastMemoryAddress();
    const memoryValue = wasm.spp3eGetLastMemoryValue();
    if (wasm.spp3eGetLastMemoryIsWrite() !== 0) {
      this.lastMemoryWrites[this.lastMemoryWritesCount++] = memoryAddress;
      this.lastMemoryWriteValue = memoryValue;
    } else if (memoryAddress !== 0 || memoryValue !== 0) {
      this.lastMemoryReads[this.lastMemoryReadsCount++] = memoryAddress;
      this.lastMemoryReadValue = memoryValue;
    }

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

  private syncWasmV2AfFromFacade(): void {
    this.wasmV2Runtime?.exports.spp3eSetCpuAf(super.af);
  }

  private syncWasmV2BcFromFacade(): void {
    this.wasmV2Runtime?.exports.spp3eSetCpuBc(super.bc);
  }

  private syncWasmV2DeFromFacade(): void {
    this.wasmV2Runtime?.exports.spp3eSetCpuDe(super.de);
  }

  private syncWasmV2HlFromFacade(): void {
    this.wasmV2Runtime?.exports.spp3eSetCpuHl(super.hl);
  }

  private syncWasmV2IxFromFacade(): void {
    this.wasmV2Runtime?.exports.spp3eSetCpuIx(super.ix);
  }

  private syncWasmV2IyFromFacade(): void {
    this.wasmV2Runtime?.exports.spp3eSetCpuIy(super.iy);
  }

  private syncWasmV2IrFromFacade(): void {
    this.wasmV2Runtime?.exports.spp3eSetCpuIr(super.ir);
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
