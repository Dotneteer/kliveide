export type Sp48WasmExports = {
  memory: WebAssembly.Memory;
  sp48MemoryPtr: () => number;
  sp48PixelBufferPtr: () => number;
  sp48AudioSamplesPtr: () => number;
  sp48KeyboardLinesPtr: () => number;
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
  sp48GetCpuBcAlt: () => number;
  sp48GetCpuDeAlt: () => number;
  sp48GetCpuHlAlt: () => number;
  sp48GetCpuIr: () => number;
  sp48GetCpuWz: () => number;
  sp48GetCpuPc: () => number;
  sp48SetCpuPc: (value: number) => void;
  sp48GetCpuSp: () => number;
  sp48SetCpuSp: (value: number) => void;
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

export class WasmZxSpectrum48Machine {
  readonly romId = "sp48";
  readonly screenWidthInPixels: number;
  readonly screenHeightInPixels: number;

  constructor(private readonly wasm: Sp48WasmExports) {
    this.screenWidthInPixels = wasm.sp48GetScreenWidth();
    this.screenHeightInPixels = wasm.sp48GetScreenHeight();
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

  get baseClockFrequency(): number {
    return this.wasm.sp48GetBaseClockFrequency();
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
