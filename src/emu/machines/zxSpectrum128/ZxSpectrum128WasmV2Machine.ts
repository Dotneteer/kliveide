import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import type { Sp128WasmV2LoaderOptions, Sp128WasmV2Runtime } from "./wasm/Sp128WasmV2Loader";
import type { TapeDataBlock } from "@common/structs/TapeDataBlock";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { TapeMode } from "@emu/abstractions/TapeMode";
import { AUDIO_SAMPLE_RATE, FAST_LOAD, REWIND_REQUESTED, SAVED_TO_TAPE, TAPE_MODE } from "../machine-props";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { BinaryWriter } from "@utils/BinaryWriter";
import { loadSp128WasmV2 } from "./wasm/Sp128WasmV2Loader";
import { TzxHeader } from "../tape/TzxHeader";
import { TzxStandardSpeedBlock } from "../tape/TzxStandardSpeedBlock";
import { ZxSpectrum128Machine } from "./ZxSpectrum128Machine";

const WASM_AUDIO_SAMPLE_SCALE = 32768.0;

export type Sp128WasmV2Diagnostics = {
  backend: "wasm";
  engine: "v2";
  artifactName: string;
  frames: number;
  tacts: number;
  audioSamples: number;
  normalFrames: number;
  keyboardLineWrites: number;
  audioRateWrites: number;
  cpuRegisterSyncs: number;
  interruptsRaised: number;
  interruptLineActive: boolean;
  tapeUploads: number;
  tapeBlocks: number;
  tapeBytes: number;
  tapeLoaded: boolean;
  tapeMode: number;
  tapeCurrentBlockIndex: number;
  tapeSavedBlocks: number;
  tapeSavedRevision: number;
};

/**
 * Full-machine WASM v2 adapter for the ZX Spectrum 128K migration path.
 */
export class ZxSpectrum128WasmV2Machine extends ZxSpectrum128Machine {
  public readonly implementation = "wasm" as const;
  public wasmV2Runtime?: Sp128WasmV2Runtime;
  private readonly wasmV2AudioSamples: AudioSample[] = [];
  private readonly wasmV2KeyboardRows = new Uint8Array(8);
  private wasmV2KeyboardRowsValid = false;
  private wasmV2AudioSampleRate = -1;
  private wasmV2TargetClockMultiplier = -1;
  private wasmV2NormalFrames = 0;
  private wasmV2KeyboardLineWrites = 0;
  private wasmV2AudioRateWrites = 0;
  private wasmV2CpuRegisterSyncs = 0;
  private wasmV2TapeUploadCount = 0;
  private wasmV2SavedTapeRevision = 0;

  constructor(
    public readonly requestedModelInfo?: MachineModel,
    public readonly requestedConfig?: MachineConfigSet,
    private readonly wasmV2LoaderOptions?: Sp128WasmV2LoaderOptions
  ) {
    super();
  }

  override async setup(): Promise<void> {
    this.wasmV2Runtime = await loadSp128WasmV2(this.wasmV2LoaderOptions);
    const runtime = this.requireWasmV2Runtime();

    this.hardResetWasmV2(runtime);
    this.uploadRomBytes(-1, await this.loadRomFromResource(this.romId, 0));
    this.uploadRomBytes(-2, await this.loadRomFromResource(this.romId, 1));
    this.syncAudioSampleRateToWasmV2(runtime);
    this.syncTargetClockMultiplierToWasmV2(runtime);
    this.syncTapeStateToWasmV2(runtime);
    this.syncCpuFromWasmV2(runtime);
  }

  override hardReset(): void {
    super.hardReset();
    if (this.wasmV2Runtime != null) {
      this.hardResetWasmV2(this.wasmV2Runtime);
      this.syncAudioSampleRateToWasmV2(this.wasmV2Runtime);
      this.syncTargetClockMultiplierToWasmV2(this.wasmV2Runtime);
      this.syncTapeStateToWasmV2(this.wasmV2Runtime);
      this.syncCpuFromWasmV2(this.wasmV2Runtime);
    }
  }

  override reset(): void {
    super.reset();
    if (this.wasmV2Runtime != null) {
      this.wasmV2Runtime.exports.sp128Reset();
      this.invalidateWasmV2Sync();
      this.syncAudioSampleRateToWasmV2(this.wasmV2Runtime);
      this.syncTargetClockMultiplierToWasmV2(this.wasmV2Runtime);
      this.syncTapeStateToWasmV2(this.wasmV2Runtime);
      this.syncCpuFromWasmV2(this.wasmV2Runtime);
    }
  }

  override setMachineProperty(key: string, value?: any): void {
    super.setMachineProperty(key, value);
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      this.syncTapePropertyToWasmV2(runtime, key, value);
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
    this.syncTargetClockMultiplierToWasmV2(runtime);
    runtime.exports.sp128ExecuteFrame();
    this.wasmV2NormalFrames++;
    this.syncFrameCountersFromWasmV2(runtime);
    this.publishSavedTapeFromWasmV2(runtime);
    this.frameCompleted = true;
    this.executionContext.lastTerminationReason = FrameTerminationMode.Normal;
    return FrameTerminationMode.Normal;
  }

  override readScreenMemory(offset: number): number {
    return this.requireWasmV2Runtime().exports.sp128ReadScreenMemoryOffset(offset & 0x3fff);
  }

  override get64KFlatMemory(): Uint8Array {
    return this.requireWasmV2Runtime().memory;
  }

  override get isOsInitialized(): boolean {
    const runtime = this.wasmV2Runtime;
    return runtime != null ? runtime.exports.sp128GetCpuIy() === 0x5c3a : super.isOsInitialized;
  }

  override getMemoryPartition(index: number): Uint8Array {
    const runtime = this.requireWasmV2Runtime();
    if (index < 0) {
      const romIndex = index === -2 ? 1 : 0;
      return runtime.rom.subarray(romIndex * 0x4000, (romIndex + 1) * 0x4000);
    }
    const bank = index & 0x07;
    return runtime.ram.subarray(bank * 0x4000, (bank + 1) * 0x4000);
  }

  override getCurrentPartitions(): number[] {
    const wasm = this.requireWasmV2Runtime().exports;
    const slot0 = wasm.sp128GetCurrentPartition(0);
    const slot1 = wasm.sp128GetCurrentPartition(1);
    const slot2 = wasm.sp128GetCurrentPartition(2);
    const slot3 = wasm.sp128GetCurrentPartition(3);
    return [slot0, slot0, slot1, slot1, slot2, slot2, slot3, slot3];
  }

  override getSelectedRomPage(): number {
    return this.requireWasmV2Runtime().exports.sp128GetSelectedRom();
  }

  override getSelectedRamBank(): number {
    return this.requireWasmV2Runtime().exports.sp128GetSelectedBank();
  }

  override getPartition(address: number): number | undefined {
    return this.getCurrentPartitions()[(address >>> 13) & 0x07];
  }

  override doReadMemory(address: number): number {
    const runtime = this.requireWasmV2Runtime();
    const value = runtime.exports.sp128ReadMemory(address & 0xffff);
    this.importWasmV2BusAccess(runtime);
    return value;
  }

  override doWriteMemory(address: number, value: number): void {
    const runtime = this.requireWasmV2Runtime();
    runtime.exports.sp128WriteMemory(address & 0xffff, value & 0xff);
    this.importWasmV2BusAccess(runtime);
  }

  override delayAddressBusAccess(address: number): void {
    this.requireWasmV2Runtime().exports.sp128DelayAddressBusAccess(address & 0xffff);
    this.syncFrameCountersFromWasmV2(this.requireWasmV2Runtime());
  }

  override doReadPort(address: number): number {
    const runtime = this.requireWasmV2Runtime();
    this.syncKeyboardToWasmV2(runtime);
    const value = runtime.exports.sp128ReadPort(address & 0xffff);
    this.importWasmV2BusAccess(runtime);
    return value;
  }

  override delayPortRead(address: number): void {
    this.requireWasmV2Runtime().exports.sp128DelayPortRead(address & 0xffff);
    this.syncFrameCountersFromWasmV2(this.requireWasmV2Runtime());
  }

  override doWritePort(address: number, value: number): void {
    const runtime = this.requireWasmV2Runtime();
    runtime.exports.sp128WritePort(address & 0xffff, value & 0xff);
    this.syncPagingStateFromWasmV2(runtime);
    this.importWasmV2BusAccess(runtime);
  }

  override delayPortWrite(address: number): void {
    this.requireWasmV2Runtime().exports.sp128DelayPortWrite(address & 0xffff);
    this.syncFrameCountersFromWasmV2(this.requireWasmV2Runtime());
  }

  override setTacts(value: number): void {
    super.setTacts(value);
    if (this.wasmV2Runtime != null) {
      this.wasmV2Runtime.exports.sp128SetTacts(value >>> 0);
      this.syncFrameCountersFromWasmV2(this.wasmV2Runtime);
    }
  }

  override uploadRomBytes(partition: number, data: Uint8Array): void {
    const runtime = this.requireWasmV2Runtime();
    const romIndex = partition === -2 ? 1 : 0;
    const romSize = runtime.exports.sp128GetRomSize() / 2;
    if (data.length !== romSize) {
      throw new Error(`Invalid ZX Spectrum 128K ROM size: ${data.length}. Expected ${romSize}.`);
    }
    for (let i = 0; i < data.length; i++) {
      runtime.exports.sp128UploadRomByte(romIndex, i, data[i]);
    }
  }

  override get screenWidthInPixels(): number {
    return this.requireWasmV2Runtime().exports.sp128GetScreenWidth();
  }

  override get screenHeightInPixels(): number {
    return this.requireWasmV2Runtime().exports.sp128GetScreenHeight();
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
      runtime.exports.sp128RenderInstantScreen();
    }
    return snapshot;
  }

  override getBufferStartOffset(): number {
    return this.requireWasmV2Runtime().exports.sp128GetPixelBufferStartOffset();
  }

  override getAudioSamples(): AudioSample[] {
    const runtime = this.requireWasmV2Runtime();
    const words = runtime.audioSamples;
    const sampleCount = runtime.exports.sp128GetAudioSampleCount();
    this.wasmV2AudioSamples.length = 0;
    for (let i = 0; i < sampleCount; i++) {
      this.wasmV2AudioSamples.push({
        left: words[i * 2] / WASM_AUDIO_SAMPLE_SCALE,
        right: words[i * 2 + 1] / WASM_AUDIO_SAMPLE_SCALE
      });
    }
    return this.wasmV2AudioSamples;
  }

  override getCpuState(): any {
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      this.syncCpuFromWasmV2(runtime);
      this.importWasmV2BusAccess(runtime);
    }
    return super.getCpuState();
  }

  getWasmV2Diagnostics(): Sp128WasmV2Diagnostics {
    const runtime = this.requireWasmV2Runtime();
    return {
      backend: "wasm",
      engine: "v2",
      artifactName: runtime.artifactName,
      frames: runtime.exports.sp128GetFrames(),
      tacts: runtime.exports.sp128GetTacts(),
      audioSamples: runtime.exports.sp128GetAudioSampleCount(),
      normalFrames: this.wasmV2NormalFrames,
      keyboardLineWrites: this.wasmV2KeyboardLineWrites,
      audioRateWrites: this.wasmV2AudioRateWrites,
      cpuRegisterSyncs: this.wasmV2CpuRegisterSyncs,
      interruptsRaised: runtime.exports.sp128GetInterruptsRaised(),
      interruptLineActive: runtime.exports.sp128GetInterruptLineActive() !== 0,
      tapeUploads: this.wasmV2TapeUploadCount,
      tapeBlocks: runtime.exports.sp128TapeGetBlockCount(),
      tapeBytes: runtime.exports.sp128TapeGetDataLength(),
      tapeLoaded: runtime.exports.sp128TapeGetLoaded() !== 0,
      tapeMode: runtime.exports.sp128TapeGetMode(),
      tapeCurrentBlockIndex: runtime.exports.sp128TapeGetCurrentBlockIndex(),
      tapeSavedBlocks: runtime.exports.sp128TapeGetSavedBlockCount(),
      tapeSavedRevision: runtime.exports.sp128TapeGetSavedRevision()
    };
  }

  private hardResetWasmV2(runtime: Sp128WasmV2Runtime): void {
    runtime.exports.sp128HardReset();
    this.invalidateWasmV2Sync();
    this.wasmV2SavedTapeRevision = 0;
    this.setTactsInFrame(runtime.exports.sp128GetTactsInFrame());
    this.syncPagingStateFromWasmV2(runtime);
  }

  private syncTapeStateToWasmV2(runtime: Sp128WasmV2Runtime): void {
    const tapeBlocks = this.getMachineProperty(MEDIA_TAPE);
    if (Array.isArray(tapeBlocks)) {
      this.uploadTapeToWasmV2(runtime, tapeBlocks);
    } else {
      runtime.exports.sp128TapeClear();
      this.wasmV2SavedTapeRevision = 0;
    }
    this.syncTapeControlPropertiesToWasmV2(runtime);
  }

  private syncTapePropertyToWasmV2(runtime: Sp128WasmV2Runtime, key: string, value?: any): void {
    switch (key) {
      case MEDIA_TAPE:
        if (Array.isArray(value)) {
          this.uploadTapeToWasmV2(runtime, value);
        } else {
          runtime.exports.sp128TapeClear();
          this.wasmV2SavedTapeRevision = 0;
        }
        this.syncTapeControlPropertiesToWasmV2(runtime);
        break;

      case TAPE_MODE:
        runtime.exports.sp128TapeSetMode(this.normalizeTapeMode(value));
        break;

      case REWIND_REQUESTED:
        if (value === true || value === undefined) {
          runtime.exports.sp128TapeRewind();
          this.syncTapeControlPropertiesToWasmV2(runtime);
        }
        break;

      case FAST_LOAD:
        runtime.exports.sp128TapeSetFastLoad(value ? 1 : 0);
        break;
    }
  }

  private syncTapeControlPropertiesToWasmV2(runtime: Sp128WasmV2Runtime): void {
    runtime.exports.sp128TapeSetFastLoad(this.getMachineProperty(FAST_LOAD) ? 1 : 0);
    runtime.exports.sp128TapeSetMode(this.normalizeTapeMode(this.getMachineProperty(TAPE_MODE)));
  }

  private uploadTapeToWasmV2(runtime: Sp128WasmV2Runtime, blocks: TapeDataBlock[]): void {
    const totalDataLength = blocks.reduce((sum, block) => sum + block.data.length, 0);
    const wasm = runtime.exports;
    if (totalDataLength > runtime.tapeData.length) {
      throw new Error(
        `ZX Spectrum 128K WASM v2 tape is too large: ${totalDataLength} bytes. Capacity: ${runtime.tapeData.length}.`
      );
    }

    if (wasm.sp128TapeBeginUpload(blocks.length, totalDataLength) === 0) {
      throw new Error(`ZX Spectrum 128K WASM v2 rejected tape upload with ${blocks.length} blocks.`);
    }

    let offset = 0;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      runtime.tapeData.set(block.data, offset);
      if (
        wasm.sp128TapeSetBlock(
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
        throw new Error(`ZX Spectrum 128K WASM v2 rejected tape block ${i}.`);
      }
      offset += block.data.length;
    }

    if (wasm.sp128TapeFinishUpload() === 0) {
      throw new Error("ZX Spectrum 128K WASM v2 could not finish tape upload.");
    }
    this.wasmV2SavedTapeRevision = 0;
    this.wasmV2TapeUploadCount++;
  }

  private publishSavedTapeFromWasmV2(runtime: Sp128WasmV2Runtime): void {
    const wasm = runtime.exports;
    const revision = wasm.sp128TapeGetSavedRevision();
    if (revision === this.wasmV2SavedTapeRevision || revision === 0) {
      return;
    }

    this.wasmV2SavedTapeRevision = revision;
    const blockCount = wasm.sp128TapeGetSavedBlockCount();
    if (blockCount === 0) {
      return;
    }

    const writer = new BinaryWriter();
    new TzxHeader().writeTo(writer);
    let savedName = "export";

    for (let i = 0; i < blockCount; i++) {
      const offset = wasm.sp128TapeGetSavedBlockOffset(i);
      const length = wasm.sp128TapeGetSavedBlockLength(i);
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

  private syncKeyboardToWasmV2(runtime: Sp128WasmV2Runtime): void {
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
          runtime.exports.sp128SetKeyStatus(line * 5 + bit, (lineValue & mask) !== 0 ? 1 : 0);
        }
      }
      this.wasmV2KeyboardRows[line] = lineValue;
      this.wasmV2KeyboardLineWrites++;
    }
    this.wasmV2KeyboardRowsValid = true;
  }

  private syncAudioSampleRateToWasmV2(runtime: Sp128WasmV2Runtime): void {
    const audioRate = this.getMachineProperty(AUDIO_SAMPLE_RATE);
    if (typeof audioRate === "number" && audioRate !== this.wasmV2AudioSampleRate) {
      runtime.exports.sp128SetAudioSampleRate(audioRate);
      this.wasmV2AudioSampleRate = audioRate;
      this.wasmV2AudioRateWrites++;
    }
  }

  private syncTargetClockMultiplierToWasmV2(runtime: Sp128WasmV2Runtime): void {
    if (this.targetClockMultiplier !== this.wasmV2TargetClockMultiplier) {
      runtime.exports.sp128SetTargetClockMultiplier(this.targetClockMultiplier);
      this.wasmV2TargetClockMultiplier = this.targetClockMultiplier;
    }
  }

  private syncPagingStateFromWasmV2(runtime: Sp128WasmV2Runtime): void {
    const wasm = runtime.exports;
    this.selectedRom = wasm.sp128GetSelectedRom();
    this.selectedBank = wasm.sp128GetSelectedBank();
    this.pagingEnabled = wasm.sp128GetPagingEnabled() !== 0;
    this.useShadowScreen = wasm.sp128GetUseShadowScreen() !== 0;
  }

  private executeWasmV2DebugStep(runtime: Sp128WasmV2Runtime): FrameTerminationMode {
    this.emulateKeystroke();
    this.syncKeyboardToWasmV2(runtime);
    this.syncAudioSampleRateToWasmV2(runtime);
    this.syncTargetClockMultiplierToWasmV2(runtime);
    runtime.exports.sp128ExecuteInstruction();
    this.syncCpuFromWasmV2(runtime);
    this.importWasmV2BusAccess(runtime);
    this.publishSavedTapeFromWasmV2(runtime);
    this.frameCompleted = runtime.exports.sp128GetFrameCompleted() !== 0;
    this.executionContext.lastTerminationReason = FrameTerminationMode.DebugEvent;
    return FrameTerminationMode.DebugEvent;
  }

  private syncCpuFromWasmV2(runtime: Sp128WasmV2Runtime): void {
    const wasm = runtime.exports;
    this.af = wasm.sp128GetCpuAf();
    this.bc = wasm.sp128GetCpuBc();
    this.de = wasm.sp128GetCpuDe();
    this.hl = wasm.sp128GetCpuHl();
    this.ix = wasm.sp128GetCpuIx();
    this.iy = wasm.sp128GetCpuIy();
    this.pc = wasm.sp128GetCpuPc();
    this.sp = wasm.sp128GetCpuSp();
    this.tacts = wasm.sp128GetTacts();
    this.frames = wasm.sp128GetFrames();
    this.clockMultiplier = wasm.sp128GetClockMultiplier();
    this.tactsInCurrentFrame = wasm.sp128GetTactsInCurrentFrame();
    this.frameTacts = this.tacts % this.tactsInCurrentFrame;
    this.currentFrameTact = this.frameTacts;
    this.halted = wasm.sp128GetCpuHalted() !== 0;
    this.opCode = wasm.sp128GetCpuPrefix();
    this.syncPagingStateFromWasmV2(runtime);
    this.wasmV2CpuRegisterSyncs++;
  }

  private syncFrameCountersFromWasmV2(runtime: Sp128WasmV2Runtime): void {
    const wasm = runtime.exports;
    this.pc = wasm.sp128GetCpuPc();
    this.tacts = wasm.sp128GetTacts();
    this.frames = wasm.sp128GetFrames();
    this.clockMultiplier = wasm.sp128GetClockMultiplier();
    this.tactsInCurrentFrame = wasm.sp128GetTactsInCurrentFrame();
    this.frameTacts = this.tacts % this.tactsInCurrentFrame;
    this.currentFrameTact = this.frameTacts;
    this.syncPagingStateFromWasmV2(runtime);
  }

  private importWasmV2BusAccess(runtime: Sp128WasmV2Runtime): void {
    const wasm = runtime.exports;
    this.lastMemoryReadsCount = 0;
    this.lastMemoryWritesCount = 0;
    this.lastIoReadPort = undefined;
    this.lastIoWritePort = undefined;

    const memoryAddress = wasm.sp128GetLastMemoryAddress();
    const memoryValue = wasm.sp128GetLastMemoryValue();
    if (wasm.sp128GetLastMemoryIsWrite() !== 0) {
      this.lastMemoryWrites[this.lastMemoryWritesCount++] = memoryAddress;
      this.lastMemoryWriteValue = memoryValue;
    } else if (memoryAddress !== 0 || memoryValue !== 0) {
      this.lastMemoryReads[this.lastMemoryReadsCount++] = memoryAddress;
      this.lastMemoryReadValue = memoryValue;
    }

    const portAddress = wasm.sp128GetLastPortAddress();
    const portValue = wasm.sp128GetLastPortValue();
    if (wasm.sp128GetLastPortIsWrite() !== 0) {
      this.lastIoWritePort = portAddress;
      this.lastIoWriteValue = portValue;
    } else if (portAddress !== 0 || portValue !== 0) {
      this.lastIoReadPort = portAddress;
      this.lastIoReadValue = portValue;
    }
  }

  private invalidateWasmV2Sync(): void {
    this.wasmV2KeyboardRowsValid = false;
    this.wasmV2AudioSampleRate = -1;
    this.wasmV2TargetClockMultiplier = -1;
  }

  private requireWasmV2Runtime(): Sp128WasmV2Runtime {
    if (this.wasmV2Runtime == null) {
      throw new Error("ZX Spectrum 128K WASM v2 runtime has not been loaded.");
    }
    return this.wasmV2Runtime;
  }
}
