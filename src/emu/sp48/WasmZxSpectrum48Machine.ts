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
  sp48SetKeyStatus: (key: number, down: number) => void;
  sp48SetAudioSampleRate: (rate: number) => void;
  sp48GetScreenWidth: () => number;
  sp48GetScreenHeight: () => number;
  sp48GetPixelBufferStartOffset: () => number;
  sp48GetAudioSampleCount: () => number;
  sp48GetAudioSampleCapacity: () => number;
  sp48GetTactsInFrame: () => number;
  sp48GetBaseClockFrequency: () => number;
  sp48GetFrames: () => number;
  sp48GetTacts: () => number;
  sp48GetKeyboardLine: (line: number) => number;
  sp48GetDiagnosticFlags: () => number;
};

export type Sp48AudioSample = {
  left: number;
  right: number;
};

export class WasmZxSpectrum48Machine {
  readonly screenWidthInPixels: number;
  readonly screenHeightInPixels: number;
  readonly tactsInFrame: number;
  readonly baseClockFrequency: number;

  constructor(private readonly wasm: Sp48WasmExports) {
    this.screenWidthInPixels = wasm.sp48GetScreenWidth();
    this.screenHeightInPixels = wasm.sp48GetScreenHeight();
    this.tactsInFrame = wasm.sp48GetTactsInFrame();
    this.baseClockFrequency = wasm.sp48GetBaseClockFrequency();
  }

  get frames(): number {
    return this.wasm.sp48GetFrames();
  }

  get tacts(): number {
    return this.wasm.sp48GetTacts();
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

  setKeyStatus(key: number, down: boolean): void {
    this.wasm.sp48SetKeyStatus(key, down ? 1 : 0);
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

  getPixelBuffer(): Uint32Array {
    const length = this.screenWidthInPixels * this.screenHeightInPixels;
    return new Uint32Array(this.wasm.memory.buffer, this.wasm.sp48PixelBufferPtr(), length);
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
