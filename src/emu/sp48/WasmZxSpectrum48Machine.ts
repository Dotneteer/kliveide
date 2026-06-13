import type { Sp48TapeBlock } from "../tape/tape-parser";

export type Sp48WasmExports = {
  memory: WebAssembly.Memory;
  sp48MemoryPtr: () => number;
  sp48PixelBufferPtr: () => number;
  sp48AudioSamplesPtr: () => number;
  sp48KeyboardLinesPtr: () => number;
  sp48TapeDataPtr: () => number;
  sp48TapeSaveDataPtr: () => number;
  sp48TapeFileNamePtr: () => number;
  sp48Reset: () => void;
  sp48HardReset: (is16k: number, isNtsc: number) => void;
  sp48ExecuteFrame: () => number;
  sp48ExecuteInstruction: () => number;
  sp48RenderInstantScreen: () => void;
  sp48DelayAddressBusAccess: (address: number) => void;
  sp48DelayPortAccess: (address: number) => void;
  sp48DelayPortRead: (address: number) => void;
  sp48DelayPortWrite: (address: number) => void;
  sp48ResetContentionCounters: () => void;
  sp48SetTacts: (value: number) => void;
  sp48UploadRomByte: (offset: number, value: number) => void;
  sp48ReadMemory: (address: number) => number;
  sp48WriteMemory: (address: number, value: number) => void;
  sp48ReadScreenMemoryOffset: (offset: number) => number;
  sp48SetKeyStatus: (key: number, down: number) => void;
  sp48ReadPort: (address: number) => number;
  sp48ReadFloatingBus: () => number;
  sp48WritePort: (address: number, value: number) => void;
  sp48SetAudioSampleRate: (rate: number) => void;
  sp48GetScreenWidth: () => number;
  sp48GetScreenHeight: () => number;
  sp48GetPixelBufferStartOffset: () => number;
  sp48GetRomSize: () => number;
  sp48GetRomUploadCount: () => number;
  sp48GetRomChecksum: () => number;
  sp48GetAudioSampleCount: () => number;
  sp48GetAudioSampleCapacity: () => number;
  sp48GetTactsInFrame: () => number;
  sp48SetTargetClockMultiplier: (value: number) => void;
  sp48GetClockMultiplier: () => number;
  sp48GetTargetClockMultiplier: () => number;
  sp48GetTactsInCurrentFrame: () => number;
  sp48GetBaseClockFrequency: () => number;
  sp48GetFrames: () => number;
  sp48GetTacts: () => number;
  sp48GetCurrentFrameTact: () => number;
  sp48GetRasterLines: () => number;
  sp48GetScreenLineTime: () => number;
  sp48GetTimingScreenWidth: () => number;
  sp48GetTimingScreenLines: () => number;
  sp48GetFirstDisplayLine: () => number;
  sp48GetFirstVisibleLine: () => number;
  sp48GetFirstVisibleBorderTact: () => number;
  sp48GetContentionValue: (tact: number) => number;
  sp48GetRenderingPhase: (tact: number) => number;
  sp48GetRenderingPixelAddress: (tact: number) => number;
  sp48GetRenderingAttributeAddress: (tact: number) => number;
  sp48GetRenderingPixelIndex: (tact: number) => number;
  sp48GetTotalContentionDelaySinceStart: () => number;
  sp48GetContentionDelaySincePause: () => number;
  sp48GetNextFrameStartTact: () => number;
  sp48GetFrameCompleted: () => number;
  sp48GetInterruptsRaised: () => number;
  sp48GetInterruptLineActive: () => number;
  sp48GetCpuInstructionsExecuted: () => number;
  sp48GetCpuFrameSliceInstructions: () => number;
  sp48GetCpuTacts: () => number;
  sp48GetCpuAf: () => number;
  sp48SetCpuAf: (value: number) => void;
  sp48GetCpuBc: () => number;
  sp48SetCpuBc: (value: number) => void;
  sp48GetCpuDe: () => number;
  sp48SetCpuDe: (value: number) => void;
  sp48GetCpuHl: () => number;
  sp48SetCpuHl: (value: number) => void;
  sp48GetCpuIx: () => number;
  sp48SetCpuIx: (value: number) => void;
  sp48GetCpuIy: () => number;
  sp48SetCpuIy: (value: number) => void;
  sp48GetCpuAfAlt: () => number;
  sp48SetCpuAfAlt: (value: number) => void;
  sp48GetCpuBcAlt: () => number;
  sp48GetCpuDeAlt: () => number;
  sp48GetCpuHlAlt: () => number;
  sp48GetCpuIr: () => number;
  sp48GetCpuWz: () => number;
  sp48GetCpuPc: () => number;
  sp48SetCpuPc: (value: number) => void;
  sp48GetCpuSp: () => number;
  sp48SetCpuSp: (value: number) => void;
  sp48TapeClear: () => void;
  sp48TapeSetFileNameByte: (index: number, value: number) => void;
  sp48TapeBeginUpload: (blockCount: number, totalDataLength: number) => number;
  sp48TapeSetBlock: (
    index: number,
    offset: number,
    length: number,
    pauseAfter: number,
    pilotPulseLength: number,
    sync1PulseLength: number,
    sync2PulseLength: number,
    zeroBitPulseLength: number,
    oneBitPulseLength: number,
    endSyncPulseLength: number,
    lastByteUsedBits: number,
    pilotPulseCount: number
  ) => number;
  sp48TapeWriteData: (offset: number, value: number) => number;
  sp48TapeFinishUpload: () => number;
  sp48TapeRewind: () => void;
  sp48TapeSetMode: (mode: number) => void;
  sp48TapeSetFastLoad?: (enabled: number) => void;
  sp48TapeGetFastLoad?: () => number;
  sp48TapeGetMaxBlocks: () => number;
  sp48TapeGetDataCapacity: () => number;
  sp48TapeGetFileNameCapacity: () => number;
  sp48TapeGetBlockCount: () => number;
  sp48TapeGetDataLength: () => number;
  sp48TapeGetCurrentBlockIndex: () => number;
  sp48TapeGetLoaded: () => number;
  sp48TapeGetEof: () => number;
  sp48TapeGetUploadActive: () => number;
  sp48TapeGetMode: () => number;
  sp48TapeGetPlayPhase: () => number;
  sp48TapeGetCurrentEarBit: () => number;
  sp48TapeGetCurrentDataIndex: () => number;
  sp48TapeGetCurrentBitMask: () => number;
  sp48TapeGetStartTact: () => number;
  sp48TapeGetModeChangeCount: () => number;
  sp48TapeGetLastModeChangeTact: () => number;
  sp48TapeGetLastModeChangePc: () => number;
  sp48TapeGetLoadStartCount: () => number;
  sp48TapeGetSaveStartCount: () => number;
  sp48TapeClassifySavePulse: (length: number) => number;
  sp48TapeGetSavePhase: () => number;
  sp48TapeGetSaveLastPulse: () => number;
  sp48TapeGetSaveMicBit: () => number;
  sp48TapeGetSaveLastMicBitTact: () => number;
  sp48TapeGetSavePilotPulseCount: () => number;
  sp48TapeGetSavedBlockCount: () => number;
  sp48TapeGetSavedDataLength: () => number;
  sp48TapeGetSavedRevision: () => number;
  sp48TapeGetSaveDataCapacity: () => number;
  sp48TapeGetSaveMaxBlocks: () => number;
  sp48TapeGetSavedBlockOffset: (index: number) => number;
  sp48TapeGetSavedBlockLength: (index: number) => number;
  sp48TapeClearSavedBlocks: () => void;
  sp48TapeGetEarBit: () => number;
  sp48TapeGetBlockOffset: (index: number) => number;
  sp48TapeGetBlockLength: (index: number) => number;
  sp48TapeGetBlockPauseAfter: (index: number) => number;
  sp48TapeGetBlockPilotPulseLength: (index: number) => number;
  sp48TapeGetBlockSync1PulseLength: (index: number) => number;
  sp48TapeGetBlockSync2PulseLength: (index: number) => number;
  sp48TapeGetBlockZeroBitPulseLength: (index: number) => number;
  sp48TapeGetBlockOneBitPulseLength: (index: number) => number;
  sp48TapeGetBlockEndSyncPulseLength: (index: number) => number;
  sp48TapeGetBlockLastByteUsedBits: (index: number) => number;
  sp48TapeGetBlockPilotPulseCount: (index: number) => number;
  sp48GetCpuHalted: () => number;
  sp48GetCpuPrefix: () => number;
  sp48GetCpuIff1: () => number;
  sp48SetCpuIff1: (value: number) => void;
  sp48GetCpuInterruptMode: () => number;
  sp48SetCpuInterruptMode: (value: number) => void;
  sp48GetCpuRetExecuted: () => number;
  sp48GetCpuRetnExecuted: () => number;
  sp48GetLastMemoryAddress: () => number;
  sp48GetLastMemoryValue: () => number;
  sp48GetLastMemoryIsWrite: () => number;
  sp48GetLastPortAddress: () => number;
  sp48GetLastPortValue: () => number;
  sp48GetLastPortIsWrite: () => number;
  sp48GetKeyboardLine: (line: number) => number;
  sp48GetPortFeValue: () => number;
  sp48GetBorderColor: () => number;
  sp48GetEarBit: () => number;
  sp48GetMicBit: () => number;
  sp48GetBeeperLevel: () => number;
  sp48GetEarBitChangedFrom0Tacts: () => number;
  sp48GetEarBitChangedFrom1Tacts: () => number;
  sp48GetDiagnosticFlags: () => number;
};

export type Sp48AudioSample = {
  left: number;
  right: number;
};

export type Sp48CpuState = {
  af: number;
  bc: number;
  de: number;
  hl: number;
  afAlt: number;
  bcAlt: number;
  deAlt: number;
  hlAlt: number;
  ix: number;
  iy: number;
  ir: number;
  wz: number;
  pc: number;
  sp: number;
  tacts: number;
  prefix: number;
  halted: boolean;
  iff1: boolean;
  interruptMode: number;
  retExecuted: boolean;
  retnExecuted: boolean;
};

export type Sp48BusAccess = {
  address: number;
  value: number;
  isWrite: boolean;
};

export type Sp48TapeBlockInfo = {
  offset: number;
  length: number;
  pauseAfter: number;
  pilotPulseLength: number;
  sync1PulseLength: number;
  sync2PulseLength: number;
  zeroBitPulseLength: number;
  oneBitPulseLength: number;
  endSyncPulseLength: number;
  lastByteUsedBits: number;
  pilotPulseCount: number;
};

export type Sp48SavedTapeBlock = {
  offset: number;
  length: number;
  data: Uint8Array;
};

export const Sp48TapeMode = {
  Passive: 0,
  Load: 1,
  Save: 2
} as const;

export const Sp48TapePlayPhase = {
  None: 0,
  Pilot: 1,
  Sync: 2,
  Data: 3,
  TermSync: 4,
  Pause: 5,
  Completed: 6
} as const;

export const Sp48TapeSavePhase = {
  None: 0,
  Pilot: 1,
  Sync1: 2,
  Sync2: 3,
  Data: 4,
  Error: 5
} as const;

export const Sp48TapeMicPulse = {
  None: 0,
  TooShort: 1,
  TooLong: 2,
  Pilot: 3,
  Sync1: 4,
  Sync2: 5,
  Bit0: 6,
  Bit1: 7,
  TermSync: 8
} as const;

export class WasmZxSpectrum48Machine {
  readonly romId = "sp48";

  constructor(private readonly wasm: Sp48WasmExports) {}

  get screenWidthInPixels(): number {
    return this.wasm.sp48GetScreenWidth();
  }

  get screenHeightInPixels(): number {
    return this.wasm.sp48GetScreenHeight();
  }

  get frames(): number {
    return this.wasm.sp48GetFrames();
  }

  get tacts(): number {
    return this.wasm.sp48GetTacts();
  }

  get tactsInFrame(): number {
    return this.wasm.sp48GetTactsInFrame();
  }

  get clockMultiplier(): number {
    return this.wasm.sp48GetClockMultiplier();
  }

  get targetClockMultiplier(): number {
    return this.wasm.sp48GetTargetClockMultiplier();
  }

  get tactsInCurrentFrame(): number {
    return this.wasm.sp48GetTactsInCurrentFrame();
  }

  get baseClockFrequency(): number {
    return this.wasm.sp48GetBaseClockFrequency();
  }

  setTargetClockMultiplier(value: number): void {
    this.wasm.sp48SetTargetClockMultiplier(value);
  }

  reset(): void {
    this.wasm.sp48Reset();
  }

  hardReset(is16k = false, isNtsc = false): void {
    this.wasm.sp48HardReset(is16k ? 1 : 0, isNtsc ? 1 : 0);
  }

  executeMachineFrame(): number {
    return this.wasm.sp48ExecuteFrame();
  }

  executeInstruction(): number {
    return this.wasm.sp48ExecuteInstruction();
  }

  renderInstantScreen(): Uint32Array {
    this.wasm.sp48RenderInstantScreen();
    return this.getPixelBuffer();
  }

  delayAddressBusAccess(address: number): void {
    this.wasm.sp48DelayAddressBusAccess(address);
  }

  delayPortAccess(address: number): void {
    this.wasm.sp48DelayPortAccess(address);
  }

  delayPortRead(address: number): void {
    this.wasm.sp48DelayPortRead(address);
  }

  delayPortWrite(address: number): void {
    this.wasm.sp48DelayPortWrite(address);
  }

  resetContentionCounters(): void {
    this.wasm.sp48ResetContentionCounters();
  }

  setTacts(value: number): void {
    this.wasm.sp48SetTacts(value);
  }

  async setup(
    readBinaryFile: (path: string, resolveIn?: string) => Promise<Uint8Array>,
    romName = this.romId
  ): Promise<void> {
    const romContents = await this.loadRomFromResource(readBinaryFile, romName);
    this.uploadRomBytes(romContents);
  }

  async loadRomFromResource(
    readBinaryFile: (path: string, resolveIn?: string) => Promise<Uint8Array>,
    romName: string,
    page = -1
  ): Promise<Uint8Array> {
    const isAbsolutePath = romName.startsWith("/") || /^[A-Za-z]:[\\/]/.test(romName);
    const filename = isAbsolutePath
      ? romName
      : `roms/${romName}${page === -1 ? "" : "-" + page}.rom`;
    return readBinaryFile(filename, isAbsolutePath ? undefined : "public");
  }

  uploadRomBytes(data: Uint8Array): void {
    const romSize = this.getRomSize();
    if (data.length !== romSize) {
      throw new Error(`Invalid ZX Spectrum 48K ROM size: ${data.length}. Expected ${romSize}.`);
    }

    for (let i = 0; i < data.length; i++) {
      this.wasm.sp48UploadRomByte(i, data[i]);
    }
  }

  readMemory(address: number): number {
    return this.wasm.sp48ReadMemory(address);
  }

  writeMemory(address: number, value: number): void {
    this.wasm.sp48WriteMemory(address, value);
  }

  readScreenMemoryOffset(offset: number): number {
    return this.wasm.sp48ReadScreenMemoryOffset(offset);
  }

  setKeyStatus(key: number, down: boolean): void {
    this.wasm.sp48SetKeyStatus(key, down ? 1 : 0);
  }

  readPort(address: number): number {
    return this.wasm.sp48ReadPort(address);
  }

  readFloatingBus(): number {
    return this.wasm.sp48ReadFloatingBus();
  }

  writePort(address: number, value: number): void {
    this.wasm.sp48WritePort(address, value);
  }

  setAudioSampleRate(rate: number): void {
    this.wasm.sp48SetAudioSampleRate(rate);
  }

  getMemory(): Uint8Array {
    return new Uint8Array(this.wasm.memory.buffer, this.wasm.sp48MemoryPtr(), 0x10000);
  }

  getKeyboardLines(): Uint8Array {
    return new Uint8Array(this.wasm.memory.buffer, this.wasm.sp48KeyboardLinesPtr(), 8);
  }

  getTapeData(): Uint8Array {
    return new Uint8Array(
      this.wasm.memory.buffer,
      this.wasm.sp48TapeDataPtr(),
      this.getTapeDataCapacity()
    );
  }

  getTapeFileNameBytes(): Uint8Array {
    return new Uint8Array(
      this.wasm.memory.buffer,
      this.wasm.sp48TapeFileNamePtr(),
      this.getTapeFileNameCapacity()
    );
  }

  getKeyboardLine(line: number): number {
    return this.wasm.sp48GetKeyboardLine(line);
  }

  getCurrentFrameTact(): number {
    return this.wasm.sp48GetCurrentFrameTact();
  }

  getRasterLines(): number {
    return this.wasm.sp48GetRasterLines();
  }

  getScreenLineTime(): number {
    return this.wasm.sp48GetScreenLineTime();
  }

  getTimingScreenWidth(): number {
    return this.wasm.sp48GetTimingScreenWidth();
  }

  getTimingScreenLines(): number {
    return this.wasm.sp48GetTimingScreenLines();
  }

  getFirstDisplayLine(): number {
    return this.wasm.sp48GetFirstDisplayLine();
  }

  getFirstVisibleLine(): number {
    return this.wasm.sp48GetFirstVisibleLine();
  }

  getFirstVisibleBorderTact(): number {
    return this.wasm.sp48GetFirstVisibleBorderTact();
  }

  getContentionValue(tact: number): number {
    return this.wasm.sp48GetContentionValue(tact);
  }

  getRenderingPhase(tact: number): number {
    return this.wasm.sp48GetRenderingPhase(tact);
  }

  getRenderingPixelAddress(tact: number): number {
    return this.wasm.sp48GetRenderingPixelAddress(tact);
  }

  getRenderingAttributeAddress(tact: number): number {
    return this.wasm.sp48GetRenderingAttributeAddress(tact);
  }

  getRenderingPixelIndex(tact: number): number {
    return this.wasm.sp48GetRenderingPixelIndex(tact);
  }

  getTotalContentionDelaySinceStart(): number {
    return this.wasm.sp48GetTotalContentionDelaySinceStart();
  }

  getContentionDelaySincePause(): number {
    return this.wasm.sp48GetContentionDelaySincePause();
  }

  getNextFrameStartTact(): number {
    return this.wasm.sp48GetNextFrameStartTact();
  }

  getFrameCompleted(): boolean {
    return this.wasm.sp48GetFrameCompleted() !== 0;
  }

  getInterruptsRaised(): number {
    return this.wasm.sp48GetInterruptsRaised();
  }

  getInterruptLineActive(): boolean {
    return this.wasm.sp48GetInterruptLineActive() !== 0;
  }

  getCpuInstructionsExecuted(): number {
    return this.wasm.sp48GetCpuInstructionsExecuted();
  }

  getCpuFrameSliceInstructions(): number {
    return this.wasm.sp48GetCpuFrameSliceInstructions();
  }

  getCpuTacts(): number {
    return this.wasm.sp48GetCpuTacts();
  }

  getCpuAf(): number {
    return this.wasm.sp48GetCpuAf();
  }

  setCpuAf(value: number): void {
    this.wasm.sp48SetCpuAf(value);
  }

  getCpuBc(): number {
    return this.wasm.sp48GetCpuBc();
  }

  setCpuBc(value: number): void {
    this.wasm.sp48SetCpuBc(value);
  }

  getCpuDe(): number {
    return this.wasm.sp48GetCpuDe();
  }

  setCpuDe(value: number): void {
    this.wasm.sp48SetCpuDe(value);
  }

  getCpuHl(): number {
    return this.wasm.sp48GetCpuHl();
  }

  setCpuHl(value: number): void {
    this.wasm.sp48SetCpuHl(value);
  }

  getCpuIx(): number {
    return this.wasm.sp48GetCpuIx();
  }

  setCpuIx(value: number): void {
    this.wasm.sp48SetCpuIx(value);
  }

  getCpuIy(): number {
    return this.wasm.sp48GetCpuIy();
  }

  setCpuIy(value: number): void {
    this.wasm.sp48SetCpuIy(value);
  }

  getCpuAfAlt(): number {
    return this.wasm.sp48GetCpuAfAlt();
  }

  setCpuAfAlt(value: number): void {
    this.wasm.sp48SetCpuAfAlt(value);
  }

  getCpuBcAlt(): number {
    return this.wasm.sp48GetCpuBcAlt();
  }

  getCpuDeAlt(): number {
    return this.wasm.sp48GetCpuDeAlt();
  }

  getCpuHlAlt(): number {
    return this.wasm.sp48GetCpuHlAlt();
  }

  getCpuIr(): number {
    return this.wasm.sp48GetCpuIr();
  }

  getCpuWz(): number {
    return this.wasm.sp48GetCpuWz();
  }

  getCpuPc(): number {
    return this.wasm.sp48GetCpuPc();
  }

  setCpuPc(value: number): void {
    this.wasm.sp48SetCpuPc(value);
  }

  getCpuSp(): number {
    return this.wasm.sp48GetCpuSp();
  }

  setCpuSp(value: number): void {
    this.wasm.sp48SetCpuSp(value);
  }

  clearTape(): void {
    this.wasm.sp48TapeClear();
  }

  uploadTape(blocks: Sp48TapeBlock[], fileName = ""): void {
    const totalDataLength = blocks.reduce((sum, block) => sum + block.data.length, 0);
    if (this.wasm.sp48TapeBeginUpload(blocks.length, totalDataLength) === 0) {
      throw new Error("Cannot begin SP48 tape upload.");
    }

    this.uploadTapeFileName(fileName);

    let offset = 0;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (
        this.wasm.sp48TapeSetBlock(
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
        throw new Error(`Cannot upload SP48 tape block ${i}.`);
      }

      for (let j = 0; j < block.data.length; j++) {
        if (this.wasm.sp48TapeWriteData(offset + j, block.data[j]) === 0) {
          throw new Error(`Cannot upload SP48 tape byte at offset ${offset + j}.`);
        }
      }
      offset += block.data.length;
    }

    if (this.wasm.sp48TapeFinishUpload() === 0) {
      throw new Error("Cannot finish SP48 tape upload.");
    }
  }

  rewindTape(): void {
    this.wasm.sp48TapeRewind();
  }

  setTapeMode(mode: number): void {
    this.wasm.sp48TapeSetMode(mode);
  }

  setTapeFastLoad(enabled: boolean): void {
    this.wasm.sp48TapeSetFastLoad?.(enabled ? 1 : 0);
  }

  getTapeFastLoad(): boolean {
    return this.wasm.sp48TapeGetFastLoad?.() !== 0;
  }

  getTapeMode(): number {
    return this.wasm.sp48TapeGetMode();
  }

  getTapePlayPhase(): number {
    return this.wasm.sp48TapeGetPlayPhase();
  }

  getTapeEarBit(): boolean {
    return this.wasm.sp48TapeGetEarBit() !== 0;
  }

  getTapeCurrentEarBit(): boolean {
    return this.wasm.sp48TapeGetCurrentEarBit() !== 0;
  }

  getTapeCurrentDataIndex(): number {
    return this.wasm.sp48TapeGetCurrentDataIndex();
  }

  getTapeCurrentBitMask(): number {
    return this.wasm.sp48TapeGetCurrentBitMask();
  }

  getTapeStartTact(): number {
    return this.wasm.sp48TapeGetStartTact();
  }

  getTapeModeChangeCount(): number {
    return this.wasm.sp48TapeGetModeChangeCount();
  }

  getTapeLastModeChangeTact(): number {
    return this.wasm.sp48TapeGetLastModeChangeTact();
  }

  getTapeLastModeChangePc(): number {
    return this.wasm.sp48TapeGetLastModeChangePc();
  }

  getTapeLoadStartCount(): number {
    return this.wasm.sp48TapeGetLoadStartCount();
  }

  getTapeSaveStartCount(): number {
    return this.wasm.sp48TapeGetSaveStartCount();
  }

  classifyTapeSavePulse(length: number): number {
    return this.wasm.sp48TapeClassifySavePulse(length);
  }

  getTapeSavePhase(): number {
    return this.wasm.sp48TapeGetSavePhase();
  }

  getTapeSaveLastPulse(): number {
    return this.wasm.sp48TapeGetSaveLastPulse();
  }

  getTapeSaveMicBit(): boolean {
    return this.wasm.sp48TapeGetSaveMicBit() !== 0;
  }

  getTapeSaveLastMicBitTact(): number {
    return this.wasm.sp48TapeGetSaveLastMicBitTact();
  }

  getTapeSavePilotPulseCount(): number {
    return this.wasm.sp48TapeGetSavePilotPulseCount();
  }

  getSavedTapeBlockCount(): number {
    return this.wasm.sp48TapeGetSavedBlockCount();
  }

  getSavedTapeDataLength(): number {
    return this.wasm.sp48TapeGetSavedDataLength();
  }

  getSavedTapeRevision(): number {
    return this.wasm.sp48TapeGetSavedRevision();
  }

  clearSavedTapeBlocks(): void {
    this.wasm.sp48TapeClearSavedBlocks();
  }

  getTapeSaveDataCapacity(): number {
    return this.wasm.sp48TapeGetSaveDataCapacity();
  }

  getTapeSaveMaxBlocks(): number {
    return this.wasm.sp48TapeGetSaveMaxBlocks();
  }

  getSavedTapeBlockInfo(index: number): { offset: number; length: number } {
    return {
      offset: this.wasm.sp48TapeGetSavedBlockOffset(index),
      length: this.wasm.sp48TapeGetSavedBlockLength(index)
    };
  }

  getSavedTapeBlock(index: number): Sp48SavedTapeBlock {
    const { offset, length } = this.getSavedTapeBlockInfo(index);
    const saveData = this.getTapeSaveData();
    return {
      offset,
      length,
      data: new Uint8Array(saveData.slice(offset, offset + length))
    };
  }

  getTapeSaveData(): Uint8Array {
    return new Uint8Array(
      this.wasm.memory.buffer,
      this.wasm.sp48TapeSaveDataPtr(),
      this.getTapeSaveDataCapacity()
    );
  }

  getTapeMaxBlocks(): number {
    return this.wasm.sp48TapeGetMaxBlocks();
  }

  getTapeDataCapacity(): number {
    return this.wasm.sp48TapeGetDataCapacity();
  }

  getTapeFileNameCapacity(): number {
    return this.wasm.sp48TapeGetFileNameCapacity();
  }

  getTapeBlockCount(): number {
    return this.wasm.sp48TapeGetBlockCount();
  }

  getTapeDataLength(): number {
    return this.wasm.sp48TapeGetDataLength();
  }

  getTapeCurrentBlockIndex(): number {
    return this.wasm.sp48TapeGetCurrentBlockIndex();
  }

  isTapeLoaded(): boolean {
    return this.wasm.sp48TapeGetLoaded() !== 0;
  }

  isTapeEof(): boolean {
    return this.wasm.sp48TapeGetEof() !== 0;
  }

  isTapeUploadActive(): boolean {
    return this.wasm.sp48TapeGetUploadActive() !== 0;
  }

  getTapeBlockInfo(index: number): Sp48TapeBlockInfo {
    return {
      offset: this.wasm.sp48TapeGetBlockOffset(index),
      length: this.wasm.sp48TapeGetBlockLength(index),
      pauseAfter: this.wasm.sp48TapeGetBlockPauseAfter(index),
      pilotPulseLength: this.wasm.sp48TapeGetBlockPilotPulseLength(index),
      sync1PulseLength: this.wasm.sp48TapeGetBlockSync1PulseLength(index),
      sync2PulseLength: this.wasm.sp48TapeGetBlockSync2PulseLength(index),
      zeroBitPulseLength: this.wasm.sp48TapeGetBlockZeroBitPulseLength(index),
      oneBitPulseLength: this.wasm.sp48TapeGetBlockOneBitPulseLength(index),
      endSyncPulseLength: this.wasm.sp48TapeGetBlockEndSyncPulseLength(index),
      lastByteUsedBits: this.wasm.sp48TapeGetBlockLastByteUsedBits(index),
      pilotPulseCount: this.wasm.sp48TapeGetBlockPilotPulseCount(index)
    };
  }

  getCpuHalted(): boolean {
    return this.wasm.sp48GetCpuHalted() !== 0;
  }

  getCpuPrefix(): number {
    return this.wasm.sp48GetCpuPrefix();
  }

  getCpuIff1(): boolean {
    return this.wasm.sp48GetCpuIff1() !== 0;
  }

  setCpuIff1(value: boolean): void {
    this.wasm.sp48SetCpuIff1(value ? 1 : 0);
  }

  getCpuInterruptMode(): number {
    return this.wasm.sp48GetCpuInterruptMode();
  }

  setCpuInterruptMode(value: number): void {
    this.wasm.sp48SetCpuInterruptMode(value);
  }

  getCpuRetExecuted(): boolean {
    return this.wasm.sp48GetCpuRetExecuted() !== 0;
  }

  getCpuRetnExecuted(): boolean {
    return this.wasm.sp48GetCpuRetnExecuted() !== 0;
  }

  getCpuState(): Sp48CpuState {
    return {
      af: this.getCpuAf(),
      bc: this.getCpuBc(),
      de: this.getCpuDe(),
      hl: this.getCpuHl(),
      afAlt: this.getCpuAfAlt(),
      bcAlt: this.getCpuBcAlt(),
      deAlt: this.getCpuDeAlt(),
      hlAlt: this.getCpuHlAlt(),
      ix: this.getCpuIx(),
      iy: this.getCpuIy(),
      ir: this.getCpuIr(),
      wz: this.getCpuWz(),
      pc: this.getCpuPc(),
      sp: this.getCpuSp(),
      tacts: this.getCpuTacts(),
      prefix: this.getCpuPrefix(),
      halted: this.getCpuHalted(),
      iff1: this.getCpuIff1(),
      interruptMode: this.getCpuInterruptMode(),
      retExecuted: this.getCpuRetExecuted(),
      retnExecuted: this.getCpuRetnExecuted()
    };
  }

  getLastMemoryAccess(): Sp48BusAccess {
    return {
      address: this.wasm.sp48GetLastMemoryAddress(),
      value: this.wasm.sp48GetLastMemoryValue(),
      isWrite: this.wasm.sp48GetLastMemoryIsWrite() !== 0
    };
  }

  getLastPortAccess(): Sp48BusAccess {
    return {
      address: this.wasm.sp48GetLastPortAddress(),
      value: this.wasm.sp48GetLastPortValue(),
      isWrite: this.wasm.sp48GetLastPortIsWrite() !== 0
    };
  }

  getPortFeValue(): number {
    return this.wasm.sp48GetPortFeValue();
  }

  getBorderColor(): number {
    return this.wasm.sp48GetBorderColor();
  }

  getEarBit(): boolean {
    return this.wasm.sp48GetEarBit() !== 0;
  }

  getMicBit(): boolean {
    return this.wasm.sp48GetMicBit() !== 0;
  }

  getBeeperLevel(): number {
    return this.wasm.sp48GetBeeperLevel();
  }

  getEarBitChangedFrom0Tacts(): number {
    return this.wasm.sp48GetEarBitChangedFrom0Tacts();
  }

  getEarBitChangedFrom1Tacts(): number {
    return this.wasm.sp48GetEarBitChangedFrom1Tacts();
  }

  getPixelBuffer(): Uint32Array {
    const length = this.screenWidthInPixels * (this.screenHeightInPixels + 4);
    return new Uint32Array(this.wasm.memory.buffer, this.wasm.sp48PixelBufferPtr(), length);
  }

  getPixelBufferBytes(): Uint8ClampedArray {
    const byteLength = this.screenWidthInPixels * (this.screenHeightInPixels + 4) * 4;
    return new Uint8ClampedArray(this.wasm.memory.buffer, this.wasm.sp48PixelBufferPtr(), byteLength);
  }

  getAudioSampleWords(): Int16Array {
    return new Int16Array(this.wasm.memory.buffer, this.wasm.sp48AudioSamplesPtr(), this.getAudioSampleCount() * 2);
  }

  getAudioSamples(): Sp48AudioSample[] {
    const words = this.getAudioSampleWords();
    const samples: Sp48AudioSample[] = [];
    for (let i = 0; i < words.length; i += 2) {
      samples.push({ left: words[i], right: words[i + 1] });
    }
    return samples;
  }

  getAudioSampleCount(): number {
    return this.wasm.sp48GetAudioSampleCount();
  }

  getAudioSampleCapacity(): number {
    return this.wasm.sp48GetAudioSampleCapacity();
  }

  getPixelBufferStartOffset(): number {
    return this.wasm.sp48GetPixelBufferStartOffset();
  }

  getRomSize(): number {
    return this.wasm.sp48GetRomSize();
  }

  getRomUploadCount(): number {
    return this.wasm.sp48GetRomUploadCount();
  }

  getRomChecksum(): number {
    return this.wasm.sp48GetRomChecksum();
  }

  getDiagnosticFlags(): number {
    return this.wasm.sp48GetDiagnosticFlags();
  }

  private uploadTapeFileName(fileName: string): void {
    const capacity = this.getTapeFileNameCapacity();
    const encoded = new TextEncoder().encode(fileName);
    const length = Math.min(encoded.length, capacity - 1);
    for (let i = 0; i < capacity; i++) {
      this.wasm.sp48TapeSetFileNameByte(i, i < length ? encoded[i] : 0);
    }
  }
}

export async function instantiateWasmZxSpectrum48Machine(
  wasmBytes: BufferSource
): Promise<WasmZxSpectrum48Machine> {
  const result = await WebAssembly.instantiate(wasmBytes, {});
  return new WasmZxSpectrum48Machine(result.instance.exports as Sp48WasmExports);
}

export async function loadWasmZxSpectrum48Machine(
  url = new URL("wasm/sp48.wasm", window.location.href).href
): Promise<WasmZxSpectrum48Machine> {
  const response = await fetch(url);
  const wasmBytes = await response.arrayBuffer();
  return instantiateWasmZxSpectrum48Machine(wasmBytes);
}
