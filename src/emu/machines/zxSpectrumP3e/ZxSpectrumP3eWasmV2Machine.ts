import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import type { SpP3eWasmV2LoaderOptions, SpP3eWasmV2Runtime } from "./wasm/SpP3eWasmV2Loader";
import type { TapeDataBlock } from "@common/structs/TapeDataBlock";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { TapeMode } from "@emu/abstractions/TapeMode";
import { AUDIO_SAMPLE_RATE, DISK_A_WP, DISK_B_WP, FAST_LOAD, REWIND_REQUESTED, SAVED_TO_TAPE, TAPE_MODE } from "../machine-props";
import { MC_DISK_SUPPORT } from "@common/machines/constants";
import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_TAPE } from "@common/structs/project-const";
import { BinaryWriter } from "@utils/BinaryWriter";
import { loadSpP3eWasmV2 } from "./wasm/SpP3eWasmV2Loader";
import { readDiskData } from "../disk/disk-readers";
import { TzxHeader } from "../tape/TzxHeader";
import { TzxStandardSpeedBlock } from "../tape/TzxStandardSpeedBlock";
import { ZxSpectrumP3EMachine } from "./ZxSpectrumP3eMachine";

const WASM_AUDIO_SAMPLE_SCALE = 32768.0;

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
export class ZxSpectrumP3eWasmV2Machine extends ZxSpectrumP3EMachine {
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

  constructor(
    public readonly requestedModelInfo?: MachineModel,
    public readonly requestedConfig?: MachineConfigSet,
    private readonly wasmV2LoaderOptions?: SpP3eWasmV2LoaderOptions
  ) {
    super(requestedModelInfo, requestedConfig);
  }

  override async setup(): Promise<void> {
    this.wasmV2Runtime = await loadSpP3eWasmV2(this.wasmV2LoaderOptions);
    this.hardResetWasmV2(this.wasmV2Runtime);
    await super.setup();
    this.syncAudioSampleRateToWasmV2(this.wasmV2Runtime);
    this.syncTapeStateToWasmV2(this.wasmV2Runtime);
    this.syncFrameCountersFromWasmV2(this.wasmV2Runtime);
  }

  override hardReset(): void {
    super.hardReset();
    if (this.wasmV2Runtime != null) {
      this.hardResetWasmV2(this.wasmV2Runtime);
      this.syncAudioSampleRateToWasmV2(this.wasmV2Runtime);
      this.syncTapeStateToWasmV2(this.wasmV2Runtime);
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
      this.syncDiskConfigToWasmV2(this.wasmV2Runtime);
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
      return super.executeMachineFrame();
    }

    this.emulateKeystroke();
    this.syncKeyboardToWasmV2(runtime);
    this.syncAudioSampleRateToWasmV2(runtime);
    runtime.exports.spp3eExecuteFrame();
    this.wasmV2NormalFrames++;
    this.syncFrameCountersFromWasmV2(runtime);
    this.publishSavedTapeFromWasmV2(runtime);
    this.frameCompleted = true;
    this.executionContext.lastTerminationReason = FrameTerminationMode.Normal;
    return FrameTerminationMode.Normal;
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
    return this.requireWasmV2Runtime().exports.spp3eReadScreenMemoryOffset(offset & 0x3fff);
  }

  override doReadPort(address: number): number {
    const runtime = this.requireWasmV2Runtime();
    this.syncKeyboardToWasmV2(runtime);
    return runtime.exports.spp3eReadPort(address & 0xffff);
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
    this.setTactsInFrame(runtime.exports.spp3eGetTactsInFrame());
    this.syncDiskConfigToWasmV2(runtime);
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
      return;
    }
    const { tracks, sides } = this.getDiskGeometry(value);
    if (runtime.exports.spp3eDiskBeginUpload(drive, value.length, writeProtected ? 1 : 0, tracks, sides) === 0) {
      return;
    }
    for (let i = 0; i < value.length; i++) {
      runtime.exports.spp3eDiskWriteData(drive, i, value[i]);
    }
    runtime.exports.spp3eDiskFinishUpload(drive);
  }

  private getDiskGeometry(contents: Uint8Array): { tracks: number; sides: number } {
    try {
      const disk = readDiskData(contents);
      return { tracks: disk.numTracks, sides: disk.numSides };
    } catch {
      return { tracks: 42, sides: 2 };
    }
  }

  private syncFrameCountersFromWasmV2(runtime: SpP3eWasmV2Runtime): void {
    this.frames = runtime.exports.spp3eGetFrames();
    this.tacts = runtime.exports.spp3eGetTacts();
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
