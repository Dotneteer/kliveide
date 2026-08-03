import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { CpuState } from "@common/messaging/EmuApi";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import type { Sp48WasmV2LoaderOptions, Sp48WasmV2Runtime } from "./wasm/Sp48WasmV2Loader";
import type { TapeDataBlock } from "@common/structs/TapeDataBlock";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { TapeMode } from "@emu/abstractions/TapeMode";
import { AUDIO_SAMPLE_RATE, FAST_LOAD, REWIND_REQUESTED, SAVED_TO_TAPE, TAPE_MODE } from "../machine-props";
import { MC_MEM_SIZE, MC_SCREEN_FREQ, MC_SP48_ROM_FILE } from "@common/machines/constants";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { BinaryWriter } from "@utils/BinaryWriter";
import { loadSp48WasmV2 } from "./wasm/Sp48WasmV2Loader";
import { TzxHeader } from "../tape/TzxHeader";
import { TzxStandardSpeedBlock } from "../tape/TzxStandardSpeedBlock";
import { ZxSpectrum48Machine } from "./ZxSpectrum48Machine";

export type Sp48WasmV2Diagnostics = {
  backend: "wasm";
  engine: "v2";
  artifactName: string;
  frames: number;
  tacts: number;
  tactsInCurrentFrame: number;
  clockMultiplier: number;
  audioSamples: number;
  normalFrames: number;
  keyboardLineWrites: number;
  audioRateWrites: number;
  clockMultiplierWrites: number;
  cpuRegisterSyncs: number;
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
 * Experimental full-machine WASM v2 adapter.
 *
 * This class deliberately lives beside the current hybrid WASM adapter. It
 * enters the v2 C backend for the normal frame loop and exposes v2-owned memory,
 * pixels, and audio, while later migration phases fill in the complete IDE
 * debugger/tape compatibility surface.
 */
export class ZxSpectrum48WasmV2Machine extends ZxSpectrum48Machine {
  public readonly implementation = "wasm" as const;
  public wasmV2Runtime?: Sp48WasmV2Runtime;
  private readonly wasmV2AudioSamples: AudioSample[] = [];
  private readonly wasmV2KeyboardRows = new Uint8Array(8);
  private wasmV2KeyboardRowsValid = false;
  private wasmV2AudioSampleRate = -1;
  private wasmV2TargetClockMultiplier = -1;
  private wasmV2NormalFrames = 0;
  private wasmV2KeyboardLineWrites = 0;
  private wasmV2AudioRateWrites = 0;
  private wasmV2ClockMultiplierWrites = 0;
  private wasmV2CpuRegisterSyncs = 0;
  private wasmV2TapeUploadCount = 0;
  private wasmV2SavedTapeRevision = 0;

  constructor(
    modelInfo?: MachineModel,
    config?: MachineConfigSet,
    private readonly wasmV2LoaderOptions?: Sp48WasmV2LoaderOptions
  ) {
    super(modelInfo, config);
  }

  override async setup(): Promise<void> {
    this.wasmV2Runtime = await loadSp48WasmV2(this.wasmV2LoaderOptions);
    const runtime = this.requireWasmV2Runtime();
    const customRomFile = this.config?.[MC_SP48_ROM_FILE] as string | undefined;
    const romContents = customRomFile
      ? await this.loadRomFromResource(customRomFile)
      : await this.loadRomFromResource(this.romId);

    this.hardResetWasmV2(runtime);
    this.uploadRomBytes(romContents);
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
      this.wasmV2Runtime.exports.sp48Reset();
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
      return this.executeWasmV2DebugLoop(runtime);
    }

    this.emulateKeystroke();
    this.syncKeyboardToWasmV2(runtime);
    this.syncAudioSampleRateToWasmV2(runtime);
    this.syncTargetClockMultiplierToWasmV2(runtime);
    runtime.exports.sp48ExecuteFrame();
    this.wasmV2NormalFrames++;
    this.syncFrameCountersFromWasmV2(runtime);
    this.publishSavedTapeFromWasmV2(runtime);
    this.frameCompleted = true;
    this.executionContext.lastTerminationReason = FrameTerminationMode.Normal;
    return FrameTerminationMode.Normal;
  }

  override readScreenMemory(offset: number): number {
    return this.requireWasmV2Runtime().exports.sp48ReadMemory(0x4000 + (offset & 0x3fff));
  }

  override get64KFlatMemory(): Uint8Array {
    return this.requireWasmV2Runtime().memory;
  }

  override doReadMemory(address: number): number {
    const runtime = this.requireWasmV2Runtime();
    const value = runtime.exports.sp48ReadMemory(address & 0xffff);
    this.importWasmV2BusAccess(runtime);
    return value;
  }

  override doWriteMemory(address: number, value: number): void {
    const runtime = this.requireWasmV2Runtime();
    runtime.exports.sp48WriteMemory(address & 0xffff, value & 0xff);
    this.importWasmV2BusAccess(runtime);
  }

  override doReadPort(address: number): number {
    const runtime = this.requireWasmV2Runtime();
    this.syncKeyboardToWasmV2(runtime);
    const value = runtime.exports.sp48ReadPort(address & 0xffff);
    this.importWasmV2BusAccess(runtime);
    return value;
  }

  override doWritePort(address: number, value: number): void {
    const runtime = this.requireWasmV2Runtime();
    runtime.exports.sp48WritePort(address & 0xffff, value & 0xff);
    this.importWasmV2BusAccess(runtime);
  }

  override setTacts(value: number): void {
    super.setTacts(value);
    if (this.wasmV2Runtime != null) {
      this.wasmV2Runtime.exports.sp48SetTacts(value >>> 0);
      this.syncFrameCountersFromWasmV2(this.wasmV2Runtime);
    }
  }

  override uploadRomBytes(data: Uint8Array): void {
    const runtime = this.requireWasmV2Runtime();
    const romSize = runtime.exports.sp48GetRomSize();
    if (data.length !== romSize) {
      throw new Error(`Invalid ZX Spectrum 48K ROM size: ${data.length}. Expected ${romSize}.`);
    }
    for (let i = 0; i < data.length; i++) {
      runtime.exports.sp48UploadRomByte(i, data[i]);
    }
  }

  override get screenWidthInPixels(): number {
    return this.requireWasmV2Runtime().exports.sp48GetScreenWidth();
  }

  override get screenHeightInPixels(): number {
    return this.requireWasmV2Runtime().exports.sp48GetScreenHeight();
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
      runtime.exports.sp48RenderInstantScreen();
    }
    return snapshot;
  }

  override getBufferStartOffset(): number {
    return this.requireWasmV2Runtime().exports.sp48GetPixelBufferStartOffset();
  }

  override getAudioSamples(): AudioSample[] {
    const runtime = this.requireWasmV2Runtime();
    const words = runtime.audioSamples;
    const sampleCount = runtime.exports.sp48GetAudioSampleCount();
    this.wasmV2AudioSamples.length = 0;
    for (let i = 0; i < sampleCount; i++) {
      this.wasmV2AudioSamples.push({
        left: words[i * 2],
        right: words[i * 2 + 1]
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

  getWasmV2Diagnostics(): Sp48WasmV2Diagnostics {
    const runtime = this.requireWasmV2Runtime();
    return {
      backend: "wasm",
      engine: "v2",
      artifactName: runtime.artifactName,
      frames: runtime.exports.sp48GetFrames(),
      tacts: runtime.exports.sp48GetTacts(),
      tactsInCurrentFrame: runtime.exports.sp48GetTactsInCurrentFrame(),
      clockMultiplier: runtime.exports.sp48GetClockMultiplier(),
      audioSamples: runtime.exports.sp48GetAudioSampleCount(),
      normalFrames: this.wasmV2NormalFrames,
      keyboardLineWrites: this.wasmV2KeyboardLineWrites,
      audioRateWrites: this.wasmV2AudioRateWrites,
      clockMultiplierWrites: this.wasmV2ClockMultiplierWrites,
      cpuRegisterSyncs: this.wasmV2CpuRegisterSyncs,
      tapeUploads: this.wasmV2TapeUploadCount,
      tapeBlocks: runtime.exports.sp48TapeGetBlockCount(),
      tapeBytes: runtime.exports.sp48TapeGetDataLength(),
      tapeLoaded: runtime.exports.sp48TapeGetLoaded() !== 0,
      tapeMode: runtime.exports.sp48TapeGetMode(),
      tapeCurrentBlockIndex: runtime.exports.sp48TapeGetCurrentBlockIndex(),
      tapeSavedBlocks: runtime.exports.sp48TapeGetSavedBlockCount(),
      tapeSavedRevision: runtime.exports.sp48TapeGetSavedRevision()
    };
  }

  private hardResetWasmV2(runtime: Sp48WasmV2Runtime): void {
    const is16KModel = this.modelInfo?.config?.[MC_MEM_SIZE] === 16 ? 1 : 0;
    const isNtsc = this.modelInfo?.config?.[MC_SCREEN_FREQ] === "ntsc" ? 1 : 0;
    runtime.exports.sp48HardReset(is16KModel, isNtsc);
    this.invalidateWasmV2Sync();
    this.wasmV2SavedTapeRevision = 0;
    this.setTactsInFrame(runtime.exports.sp48GetTactsInFrame());
    this.tactsInCurrentFrame = runtime.exports.sp48GetTactsInCurrentFrame();
  }

  private syncTapeStateToWasmV2(runtime: Sp48WasmV2Runtime): void {
    const tapeBlocks = this.getMachineProperty(MEDIA_TAPE);
    if (Array.isArray(tapeBlocks)) {
      this.uploadTapeToWasmV2(runtime, tapeBlocks);
    } else {
      runtime.exports.sp48TapeClear();
      this.wasmV2SavedTapeRevision = 0;
    }
    this.syncTapeControlPropertiesToWasmV2(runtime);
  }

  private syncTapePropertyToWasmV2(runtime: Sp48WasmV2Runtime, key: string, value?: any): void {
    switch (key) {
      case MEDIA_TAPE:
        if (Array.isArray(value)) {
          this.uploadTapeToWasmV2(runtime, value);
        } else {
          runtime.exports.sp48TapeClear();
          this.wasmV2SavedTapeRevision = 0;
        }
        this.syncTapeControlPropertiesToWasmV2(runtime);
        break;

      case TAPE_MODE:
        runtime.exports.sp48TapeSetMode(this.normalizeTapeMode(value));
        break;

      case REWIND_REQUESTED:
        if (value === true || value === undefined) {
          runtime.exports.sp48TapeRewind();
          this.syncTapeControlPropertiesToWasmV2(runtime);
        }
        break;

      case FAST_LOAD:
        runtime.exports.sp48TapeSetFastLoad(value ? 1 : 0);
        break;
    }
  }

  private syncTapeControlPropertiesToWasmV2(runtime: Sp48WasmV2Runtime): void {
    runtime.exports.sp48TapeSetFastLoad(this.getMachineProperty(FAST_LOAD) ? 1 : 0);
    runtime.exports.sp48TapeSetMode(this.normalizeTapeMode(this.getMachineProperty(TAPE_MODE)));
  }

  private uploadTapeToWasmV2(runtime: Sp48WasmV2Runtime, blocks: TapeDataBlock[]): void {
    const totalDataLength = blocks.reduce((sum, block) => sum + block.data.length, 0);
    const wasm = runtime.exports;
    if (totalDataLength > runtime.tapeData.length) {
      throw new Error(
        `ZX Spectrum 48K WASM v2 tape is too large: ${totalDataLength} bytes. Capacity: ${runtime.tapeData.length}.`
      );
    }

    if (wasm.sp48TapeBeginUpload(blocks.length, totalDataLength) === 0) {
      throw new Error(`ZX Spectrum 48K WASM v2 rejected tape upload with ${blocks.length} blocks.`);
    }

    let offset = 0;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      runtime.tapeData.set(block.data, offset);
      if (
        wasm.sp48TapeSetBlock(
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
        throw new Error(`ZX Spectrum 48K WASM v2 rejected tape block ${i}.`);
      }
      offset += block.data.length;
    }

    if (wasm.sp48TapeFinishUpload() === 0) {
      throw new Error("ZX Spectrum 48K WASM v2 could not finish tape upload.");
    }
    this.wasmV2SavedTapeRevision = 0;
    this.wasmV2TapeUploadCount++;
  }

  private publishSavedTapeFromWasmV2(runtime: Sp48WasmV2Runtime): void {
    const wasm = runtime.exports;
    const revision = wasm.sp48TapeGetSavedRevision();
    if (revision === this.wasmV2SavedTapeRevision || revision === 0) {
      return;
    }

    this.wasmV2SavedTapeRevision = revision;
    const blockCount = wasm.sp48TapeGetSavedBlockCount();
    if (blockCount === 0) {
      return;
    }

    const writer = new BinaryWriter();
    new TzxHeader().writeTo(writer);
    let savedName = "export";

    for (let i = 0; i < blockCount; i++) {
      const offset = wasm.sp48TapeGetSavedBlockOffset(i);
      const length = wasm.sp48TapeGetSavedBlockLength(i);
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

  private syncKeyboardToWasmV2(runtime: Sp48WasmV2Runtime): void {
    for (let line = 0; line < 8; line++) {
      const lineValue = this.keyboardDevice.getKeyLineValue(line) & 0x1f;
      if (this.wasmV2KeyboardRowsValid && this.wasmV2KeyboardRows[line] === lineValue) {
        continue;
      }
      runtime.keyboardLines[line] = lineValue;
      this.wasmV2KeyboardRows[line] = lineValue;
      this.wasmV2KeyboardLineWrites++;
    }
    this.wasmV2KeyboardRowsValid = true;
  }

  private syncAudioSampleRateToWasmV2(runtime: Sp48WasmV2Runtime): void {
    const audioRate = this.getMachineProperty(AUDIO_SAMPLE_RATE);
    if (typeof audioRate === "number" && audioRate !== this.wasmV2AudioSampleRate) {
      runtime.exports.sp48SetAudioSampleRate(audioRate);
      this.wasmV2AudioSampleRate = audioRate;
      this.wasmV2AudioRateWrites++;
    }
  }

  private syncTargetClockMultiplierToWasmV2(runtime: Sp48WasmV2Runtime): void {
    if (this.targetClockMultiplier !== this.wasmV2TargetClockMultiplier) {
      runtime.exports.sp48SetTargetClockMultiplier(this.targetClockMultiplier);
      this.wasmV2TargetClockMultiplier = this.targetClockMultiplier;
      this.wasmV2ClockMultiplierWrites++;
    }
  }

  private executeWasmV2DebugLoop(runtime: Sp48WasmV2Runtime): FrameTerminationMode {
    const debugSupport = this.executionContext.debugSupport;
    let instructionsExecuted = 0;
    this.executionContext.lastTerminationReason = undefined;

    if (this.frameCompleted) {
      this.onInitNewFrame(false);
      this.frameCompleted = false;
      this.emulateKeystroke();
    }

    this.syncCpuFromWasmV2(runtime);
    if (debugSupport && this.pc !== debugSupport.lastStartupBreakpoint) {
      if (this.shouldStopAtWasmV2Breakpoint(instructionsExecuted)) {
        return this.finishWasmV2DebugLoop(FrameTerminationMode.DebugEvent);
      }
    }
    if (debugSupport) {
      debugSupport.lastStartupBreakpoint = undefined;
    }

    while (!this.frameCompleted) {
      this.emulateKeystroke();
      this.syncKeyboardToWasmV2(runtime);
      this.syncAudioSampleRateToWasmV2(runtime);
      this.syncTargetClockMultiplierToWasmV2(runtime);
      runtime.exports.sp48ExecuteInstruction();
      instructionsExecuted++;
      this.syncCpuFromWasmV2(runtime);
      this.importWasmV2BusAccess(runtime);
      this.publishSavedTapeFromWasmV2(runtime);
      this.frameCompleted = runtime.exports.sp48GetFrameCompleted() !== 0;

      if (this.executionContext.frameTerminationMode === FrameTerminationMode.UntilExecutionPoint) {
        const point = this.executionContext.terminationPoint;
        if (point != null && this.pc === (point & 0xffff)) {
          return this.finishWasmV2DebugLoop(FrameTerminationMode.UntilExecutionPoint);
        }
      }
      if (this.hasWasmV2AccessBreakpoint()) {
        return this.finishWasmV2DebugLoop(FrameTerminationMode.DebugEvent);
      }
      if (this.shouldStopAtWasmV2Breakpoint(instructionsExecuted)) {
        return this.finishWasmV2DebugLoop(FrameTerminationMode.DebugEvent);
      }
      if (this.executionContext.debugStepMode === DebugStepMode.StepInto) {
        debugSupport && (debugSupport.imminentBreakpoint = undefined);
        return this.finishWasmV2DebugLoop(FrameTerminationMode.DebugEvent);
      }
      if (this.getFrameCommand()) {
        return this.finishWasmV2DebugLoop(FrameTerminationMode.Normal);
      }
    }

    return this.finishWasmV2DebugLoop(FrameTerminationMode.Normal);
  }

  private finishWasmV2DebugLoop(termination: FrameTerminationMode): FrameTerminationMode {
    this.executionContext.lastTerminationReason = termination;
    return termination;
  }

  private shouldStopAtWasmV2Breakpoint(instructionsExecuted: number): boolean {
    const debugSupport = this.executionContext.debugSupport;
    if (!debugSupport) return false;

    const stopAt = debugSupport.shouldStopAt(this.pc, () => this.getPartition(this.pc));
    if (
      stopAt &&
      (instructionsExecuted > 0 ||
        debugSupport.lastBreakpoint === undefined ||
        debugSupport.lastBreakpoint !== this.pc)
    ) {
      debugSupport.lastBreakpoint = this.pc;
      debugSupport.imminentBreakpoint = undefined;
      return true;
    }

    if (this.executionContext.debugStepMode === DebugStepMode.StopAtBreakpoint) {
      return false;
    }

    if (this.executionContext.debugStepMode === DebugStepMode.StepOver) {
      if (debugSupport.imminentBreakpoint !== undefined) {
        if (debugSupport.imminentBreakpoint === this.pc) {
          debugSupport.imminentBreakpoint = undefined;
          return true;
        }
        return false;
      }
      const length = this.getCallInstructionLength();
      if (length > 0) {
        debugSupport.imminentBreakpoint = (this.pc + length) & 0xffff;
        return false;
      }
      return instructionsExecuted > 0;
    }

    if (this.executionContext.debugStepMode === DebugStepMode.StepOut) {
      if (this.stepOutAddress === this.pc || this.retExecuted) {
        debugSupport.imminentBreakpoint = undefined;
        return true;
      }
      return false;
    }

    return false;
  }

  private hasWasmV2AccessBreakpoint(): boolean {
    const debugSupport = this.executionContext.debugSupport;
    if (!debugSupport) return false;
    return (
      debugSupport.hasMemoryRead(this.lastMemoryReads, this.lastMemoryReadsCount, (addr) => this.getPartition(addr)) ||
      debugSupport.hasMemoryWrite(this.lastMemoryWrites, this.lastMemoryWritesCount, (addr) => this.getPartition(addr)) ||
      debugSupport.hasIoRead(this.lastIoReadPort) ||
      debugSupport.hasIoWrite(this.lastIoWritePort)
    );
  }

  private importWasmV2BusAccess(runtime: Sp48WasmV2Runtime): void {
    const wasm = runtime.exports;
    this.lastMemoryReadsCount = 0;
    this.lastMemoryWritesCount = 0;
    this.lastIoReadPort = undefined;
    this.lastIoWritePort = undefined;

    const memoryAddress = wasm.sp48GetLastMemoryAddress();
    const memoryValue = wasm.sp48GetLastMemoryValue();
    if (wasm.sp48GetLastMemoryIsWrite() !== 0) {
      this.lastMemoryWrites[this.lastMemoryWritesCount++] = memoryAddress;
      this.lastMemoryWriteValue = memoryValue;
    } else if (memoryAddress !== 0 || memoryValue !== 0) {
      this.lastMemoryReads[this.lastMemoryReadsCount++] = memoryAddress;
      this.lastMemoryReadValue = memoryValue;
    }

    const portAddress = wasm.sp48GetLastPortAddress();
    const portValue = wasm.sp48GetLastPortValue();
    if (wasm.sp48GetLastPortIsWrite() !== 0) {
      this.lastIoWritePort = portAddress;
      this.lastIoWriteValue = portValue;
    } else if (portAddress !== 0 || portValue !== 0) {
      this.lastIoReadPort = portAddress;
      this.lastIoReadValue = portValue;
    }
  }

  private syncCpuFromWasmV2(runtime: Sp48WasmV2Runtime): void {
    const wasm = runtime.exports;
    this.af = wasm.sp48GetCpuAf();
    this.bc = wasm.sp48GetCpuBc();
    this.de = wasm.sp48GetCpuDe();
    this.hl = wasm.sp48GetCpuHl();
    this.af_ = wasm.sp48GetCpuAfAlt();
    this.bc_ = wasm.sp48GetCpuBcAlt();
    this.de_ = wasm.sp48GetCpuDeAlt();
    this.hl_ = wasm.sp48GetCpuHlAlt();
    this.ix = wasm.sp48GetCpuIx();
    this.iy = wasm.sp48GetCpuIy();
    this.ir = wasm.sp48GetCpuIr();
    this.wz = wasm.sp48GetCpuWz();
    this.pc = wasm.sp48GetCpuPc();
    this.sp = wasm.sp48GetCpuSp();
    this.tacts = wasm.sp48GetTacts();
    this.frames = wasm.sp48GetFrames();
    this.clockMultiplier = wasm.sp48GetClockMultiplier();
    this.tactsInCurrentFrame = wasm.sp48GetTactsInCurrentFrame();
    this.frameTacts = this.tacts % this.tactsInCurrentFrame;
    this.currentFrameTact = this.frameTacts;
    this.halted = wasm.sp48GetCpuHalted() !== 0;
    this.iff1 = wasm.sp48GetCpuIff1() !== 0;
    this.iff2 = this.iff1;
    this.interruptMode = wasm.sp48GetCpuInterruptMode();
    this.opCode = wasm.sp48GetCpuPrefix();
    this.retExecuted = wasm.sp48GetCpuRetExecuted() !== 0 || wasm.sp48GetCpuRetnExecuted() !== 0;
    this.wasmV2CpuRegisterSyncs++;
  }

  private syncFrameCountersFromWasmV2(runtime: Sp48WasmV2Runtime): void {
    const wasm = runtime.exports;
    this.pc = wasm.sp48GetCpuPc();
    this.tacts = wasm.sp48GetTacts();
    this.frames = wasm.sp48GetFrames();
    this.clockMultiplier = wasm.sp48GetClockMultiplier();
    this.tactsInCurrentFrame = wasm.sp48GetTactsInCurrentFrame();
    this.frameTacts = this.tacts % this.tactsInCurrentFrame;
    this.currentFrameTact = this.frameTacts;
  }

  private invalidateWasmV2Sync(): void {
    this.wasmV2KeyboardRowsValid = false;
    this.wasmV2AudioSampleRate = -1;
    this.wasmV2TargetClockMultiplier = -1;
  }

  private requireWasmV2Runtime(): Sp48WasmV2Runtime {
    if (this.wasmV2Runtime == null) {
      throw new Error("ZX Spectrum 48K WASM v2 runtime has not been loaded.");
    }
    return this.wasmV2Runtime;
  }
}
