export const SP128_WASM_V2_ARTIFACT_NAME = "zx-spectrum128.wasm";
export const SP128_WASM_V2_MEMORY_SIZE = 0x10000;
export const SP128_WASM_V2_RAM_SIZE = 0x20000;
export const SP128_WASM_V2_ROM_SIZE = 0x8000;
export const SP128_WASM_V2_KEYBOARD_LINE_COUNT = 8;

export type Sp128WasmV2ExportFunction = (...args: number[]) => number;

export type Sp128WasmV2Exports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  sp128MemoryPtr: Sp128WasmV2ExportFunction;
  sp128RamPtr: Sp128WasmV2ExportFunction;
  sp128RomPtr: Sp128WasmV2ExportFunction;
  sp128PixelBufferPtr: Sp128WasmV2ExportFunction;
  sp128AudioSamplesPtr: Sp128WasmV2ExportFunction;
  sp128KeyboardLinesPtr: Sp128WasmV2ExportFunction;
  sp128Reset: Sp128WasmV2ExportFunction;
  sp128HardReset: Sp128WasmV2ExportFunction;
  sp128ExecuteFrame: Sp128WasmV2ExportFunction;
  sp128ExecuteInstruction: Sp128WasmV2ExportFunction;
  sp128RenderInstantScreen: Sp128WasmV2ExportFunction;
  sp128UploadRomByte: Sp128WasmV2ExportFunction;
  sp128ReadMemory: Sp128WasmV2ExportFunction;
  sp128WriteMemory: Sp128WasmV2ExportFunction;
  sp128ReadRamBank: Sp128WasmV2ExportFunction;
  sp128WriteRamBank: Sp128WasmV2ExportFunction;
  sp128ReadRomBank: Sp128WasmV2ExportFunction;
  sp128ReadScreenMemoryOffset: Sp128WasmV2ExportFunction;
  sp128ReadFloatingBus: Sp128WasmV2ExportFunction;
  sp128SetKeyStatus: Sp128WasmV2ExportFunction;
  sp128ReadPort: Sp128WasmV2ExportFunction;
  sp128WritePort: Sp128WasmV2ExportFunction;
  sp128SetAudioSampleRate: Sp128WasmV2ExportFunction;
  sp128DelayAddressBusAccess: Sp128WasmV2ExportFunction;
  sp128DelayPortRead: Sp128WasmV2ExportFunction;
  sp128DelayPortWrite: Sp128WasmV2ExportFunction;
  sp128ResetContentionCounters: Sp128WasmV2ExportFunction;
  sp128SetContentionValue: Sp128WasmV2ExportFunction;
  sp128GetMemorySize: Sp128WasmV2ExportFunction;
  sp128GetRamSize: Sp128WasmV2ExportFunction;
  sp128GetRomSize: Sp128WasmV2ExportFunction;
  sp128GetScreenWidth: Sp128WasmV2ExportFunction;
  sp128GetScreenHeight: Sp128WasmV2ExportFunction;
  sp128GetPixelBufferStartOffset: Sp128WasmV2ExportFunction;
  sp128GetAudioSampleCount: Sp128WasmV2ExportFunction;
  sp128GetAudioSampleCapacity: Sp128WasmV2ExportFunction;
  sp128GetTactsInFrame: Sp128WasmV2ExportFunction;
  sp128GetFrames: Sp128WasmV2ExportFunction;
  sp128GetTacts: Sp128WasmV2ExportFunction;
  sp128SetTacts: Sp128WasmV2ExportFunction;
  sp128GetSelectedRom: Sp128WasmV2ExportFunction;
  sp128GetSelectedBank: Sp128WasmV2ExportFunction;
  sp128GetPagingEnabled: Sp128WasmV2ExportFunction;
  sp128GetUseShadowScreen: Sp128WasmV2ExportFunction;
  sp128GetScreenBank: Sp128WasmV2ExportFunction;
  sp128GetCurrentPartition: Sp128WasmV2ExportFunction;
  sp128GetContentionValue: Sp128WasmV2ExportFunction;
  sp128GetTotalContentionDelaySinceStart: Sp128WasmV2ExportFunction;
  sp128GetContentionDelaySincePause: Sp128WasmV2ExportFunction;
  sp128GetCpuInstructionsExecuted: Sp128WasmV2ExportFunction;
  sp128GetCpuFrameSliceInstructions: Sp128WasmV2ExportFunction;
  sp128GetCpuTacts: Sp128WasmV2ExportFunction;
  sp128GetCpuAf: Sp128WasmV2ExportFunction;
  sp128SetCpuAf: Sp128WasmV2ExportFunction;
  sp128GetCpuBc: Sp128WasmV2ExportFunction;
  sp128SetCpuBc: Sp128WasmV2ExportFunction;
  sp128GetCpuDe: Sp128WasmV2ExportFunction;
  sp128SetCpuDe: Sp128WasmV2ExportFunction;
  sp128GetCpuHl: Sp128WasmV2ExportFunction;
  sp128SetCpuHl: Sp128WasmV2ExportFunction;
  sp128GetCpuIx: Sp128WasmV2ExportFunction;
  sp128SetCpuIx: Sp128WasmV2ExportFunction;
  sp128GetCpuIy: Sp128WasmV2ExportFunction;
  sp128SetCpuIy: Sp128WasmV2ExportFunction;
  sp128GetCpuPc: Sp128WasmV2ExportFunction;
  sp128SetCpuPc: Sp128WasmV2ExportFunction;
  sp128GetCpuSp: Sp128WasmV2ExportFunction;
  sp128SetCpuSp: Sp128WasmV2ExportFunction;
  sp128GetCpuHalted: Sp128WasmV2ExportFunction;
  sp128GetCpuPrefix: Sp128WasmV2ExportFunction;
  sp128GetLastMemoryAddress: Sp128WasmV2ExportFunction;
  sp128GetLastMemoryValue: Sp128WasmV2ExportFunction;
  sp128GetLastMemoryIsWrite: Sp128WasmV2ExportFunction;
  sp128GetLastPortAddress: Sp128WasmV2ExportFunction;
  sp128GetLastPortValue: Sp128WasmV2ExportFunction;
  sp128GetLastPortIsWrite: Sp128WasmV2ExportFunction;
  sp128GetKeyboardLine: Sp128WasmV2ExportFunction;
  sp128GetPortFeValue: Sp128WasmV2ExportFunction;
  sp128GetBorderColor: Sp128WasmV2ExportFunction;
  sp128GetEarBit: Sp128WasmV2ExportFunction;
  sp128GetMicBit: Sp128WasmV2ExportFunction;
  sp128GetBeeperLevel: Sp128WasmV2ExportFunction;
  sp128GetAudioSampleRate: Sp128WasmV2ExportFunction;
  sp128GetPsgRegisterIndex: Sp128WasmV2ExportFunction;
  sp128SetPsgRegisterIndex: Sp128WasmV2ExportFunction;
  sp128GetPsgRegisterValue: Sp128WasmV2ExportFunction;
  sp128WritePsgRegisterValue: Sp128WasmV2ExportFunction;
  sp128ReadPsgRegisterValue: Sp128WasmV2ExportFunction;
  sp128GetPsgToneA: Sp128WasmV2ExportFunction;
  sp128GetPsgVolumeA: Sp128WasmV2ExportFunction;
  sp128GetPsgCurrentOutput: Sp128WasmV2ExportFunction;
  sp128TapeDataPtr: Sp128WasmV2ExportFunction;
  sp128TapeSaveDataPtr: Sp128WasmV2ExportFunction;
  sp128TapeClear: Sp128WasmV2ExportFunction;
  sp128TapeBeginUpload: Sp128WasmV2ExportFunction;
  sp128TapeSetBlock: Sp128WasmV2ExportFunction;
  sp128TapeWriteData: Sp128WasmV2ExportFunction;
  sp128TapeFinishUpload: Sp128WasmV2ExportFunction;
  sp128TapeRewind: Sp128WasmV2ExportFunction;
  sp128TapeSetMode: Sp128WasmV2ExportFunction;
  sp128TapeSetFastLoad: Sp128WasmV2ExportFunction;
  sp128TapeGetFastLoad: Sp128WasmV2ExportFunction;
  sp128TapeGetMaxBlocks: Sp128WasmV2ExportFunction;
  sp128TapeGetDataCapacity: Sp128WasmV2ExportFunction;
  sp128TapeGetSaveDataCapacity: Sp128WasmV2ExportFunction;
  sp128TapeGetSaveMaxBlocks: Sp128WasmV2ExportFunction;
  sp128TapeGetBlockCount: Sp128WasmV2ExportFunction;
  sp128TapeGetDataLength: Sp128WasmV2ExportFunction;
  sp128TapeGetLoaded: Sp128WasmV2ExportFunction;
  sp128TapeGetEof: Sp128WasmV2ExportFunction;
  sp128TapeGetUploadActive: Sp128WasmV2ExportFunction;
  sp128TapeGetMode: Sp128WasmV2ExportFunction;
  sp128TapeGetCurrentBlockIndex: Sp128WasmV2ExportFunction;
  sp128TapeGetCurrentEarBit: Sp128WasmV2ExportFunction;
  sp128TapeGetBlockOffset: Sp128WasmV2ExportFunction;
  sp128TapeGetBlockLength: Sp128WasmV2ExportFunction;
  sp128TapeGetBlockPauseAfter: Sp128WasmV2ExportFunction;
  sp128TapeGetSavedBlockCount: Sp128WasmV2ExportFunction;
  sp128TapeGetSavedDataLength: Sp128WasmV2ExportFunction;
  sp128TapeGetSavedRevision: Sp128WasmV2ExportFunction;
  sp128TapeGetSavedBlockOffset: Sp128WasmV2ExportFunction;
  sp128TapeGetSavedBlockLength: Sp128WasmV2ExportFunction;
  sp128TapeClearSavedBlocks: Sp128WasmV2ExportFunction;
  sp128TapeAppendSavedByte: Sp128WasmV2ExportFunction;
  sp128GetDiagnosticFlags: Sp128WasmV2ExportFunction;
};

export type Sp128WasmV2Instance = {
  readonly exports: Sp128WasmV2Exports;
};

export type Sp128WasmV2ArtifactReader = () => Promise<BufferSource>;
export type Sp128WasmV2Compiler = (bytes: BufferSource) => Promise<WebAssembly.Module>;
export type Sp128WasmV2Instantiator = (module: WebAssembly.Module) => Promise<Sp128WasmV2Instance>;

export type Sp128WasmV2LoaderOptions = {
  readonly artifactName?: string;
  readonly readArtifact?: Sp128WasmV2ArtifactReader;
  readonly compile?: Sp128WasmV2Compiler;
  readonly instantiate?: Sp128WasmV2Instantiator;
};

export type Sp128WasmV2Runtime = {
  readonly artifactName: string;
  readonly module: WebAssembly.Module;
  readonly instance: Sp128WasmV2Instance;
  readonly exports: Sp128WasmV2Exports;
  readonly memoryBuffer: ArrayBuffer;
  readonly memory: Uint8Array;
  readonly ram: Uint8Array;
  readonly rom: Uint8Array;
  readonly pixelBuffer: Uint32Array;
  readonly pixelBufferBytes: Uint8ClampedArray;
  readonly keyboardLines: Uint8Array;
  readonly audioSamples: Int16Array;
  readonly tapeData: Uint8Array;
  readonly tapeSaveData: Uint8Array;
};

const requiredV2Exports = [
  "memory",
  "sp128MemoryPtr",
  "sp128RamPtr",
  "sp128RomPtr",
  "sp128PixelBufferPtr",
  "sp128AudioSamplesPtr",
  "sp128KeyboardLinesPtr",
  "sp128Reset",
  "sp128HardReset",
  "sp128ExecuteFrame",
  "sp128ExecuteInstruction",
  "sp128RenderInstantScreen",
  "sp128UploadRomByte",
  "sp128ReadMemory",
  "sp128WriteMemory",
  "sp128ReadRamBank",
  "sp128WriteRamBank",
  "sp128ReadRomBank",
  "sp128ReadScreenMemoryOffset",
  "sp128ReadFloatingBus",
  "sp128SetKeyStatus",
  "sp128ReadPort",
  "sp128WritePort",
  "sp128SetAudioSampleRate",
  "sp128DelayAddressBusAccess",
  "sp128DelayPortRead",
  "sp128DelayPortWrite",
  "sp128ResetContentionCounters",
  "sp128SetContentionValue",
  "sp128GetMemorySize",
  "sp128GetRamSize",
  "sp128GetRomSize",
  "sp128GetScreenWidth",
  "sp128GetScreenHeight",
  "sp128GetPixelBufferStartOffset",
  "sp128GetAudioSampleCount",
  "sp128GetAudioSampleCapacity",
  "sp128GetTactsInFrame",
  "sp128GetFrames",
  "sp128GetTacts",
  "sp128SetTacts",
  "sp128GetSelectedRom",
  "sp128GetSelectedBank",
  "sp128GetPagingEnabled",
  "sp128GetUseShadowScreen",
  "sp128GetScreenBank",
  "sp128GetCurrentPartition",
  "sp128GetContentionValue",
  "sp128GetTotalContentionDelaySinceStart",
  "sp128GetContentionDelaySincePause",
  "sp128GetCpuInstructionsExecuted",
  "sp128GetCpuFrameSliceInstructions",
  "sp128GetCpuTacts",
  "sp128GetCpuAf",
  "sp128SetCpuAf",
  "sp128GetCpuBc",
  "sp128SetCpuBc",
  "sp128GetCpuDe",
  "sp128SetCpuDe",
  "sp128GetCpuHl",
  "sp128SetCpuHl",
  "sp128GetCpuIx",
  "sp128SetCpuIx",
  "sp128GetCpuIy",
  "sp128SetCpuIy",
  "sp128GetCpuPc",
  "sp128SetCpuPc",
  "sp128GetCpuSp",
  "sp128SetCpuSp",
  "sp128GetCpuHalted",
  "sp128GetCpuPrefix",
  "sp128GetLastMemoryAddress",
  "sp128GetLastMemoryValue",
  "sp128GetLastMemoryIsWrite",
  "sp128GetLastPortAddress",
  "sp128GetLastPortValue",
  "sp128GetLastPortIsWrite",
  "sp128GetKeyboardLine",
  "sp128GetPortFeValue",
  "sp128GetBorderColor",
  "sp128GetEarBit",
  "sp128GetMicBit",
  "sp128GetBeeperLevel",
  "sp128GetAudioSampleRate",
  "sp128GetPsgRegisterIndex",
  "sp128SetPsgRegisterIndex",
  "sp128GetPsgRegisterValue",
  "sp128WritePsgRegisterValue",
  "sp128ReadPsgRegisterValue",
  "sp128GetPsgToneA",
  "sp128GetPsgVolumeA",
  "sp128GetPsgCurrentOutput",
  "sp128TapeDataPtr",
  "sp128TapeSaveDataPtr",
  "sp128TapeClear",
  "sp128TapeBeginUpload",
  "sp128TapeSetBlock",
  "sp128TapeWriteData",
  "sp128TapeFinishUpload",
  "sp128TapeRewind",
  "sp128TapeSetMode",
  "sp128TapeSetFastLoad",
  "sp128TapeGetFastLoad",
  "sp128TapeGetMaxBlocks",
  "sp128TapeGetDataCapacity",
  "sp128TapeGetSaveDataCapacity",
  "sp128TapeGetSaveMaxBlocks",
  "sp128TapeGetBlockCount",
  "sp128TapeGetDataLength",
  "sp128TapeGetLoaded",
  "sp128TapeGetEof",
  "sp128TapeGetUploadActive",
  "sp128TapeGetMode",
  "sp128TapeGetCurrentBlockIndex",
  "sp128TapeGetCurrentEarBit",
  "sp128TapeGetBlockOffset",
  "sp128TapeGetBlockLength",
  "sp128TapeGetBlockPauseAfter",
  "sp128TapeGetSavedBlockCount",
  "sp128TapeGetSavedDataLength",
  "sp128TapeGetSavedRevision",
  "sp128TapeGetSavedBlockOffset",
  "sp128TapeGetSavedBlockLength",
  "sp128TapeClearSavedBlocks",
  "sp128TapeAppendSavedByte",
  "sp128GetDiagnosticFlags"
] as const;

let cachedV2Module: WebAssembly.Module | undefined;
let cachedV2ArtifactName: string | undefined;

export function resetSp128WasmV2ModuleCache(): void {
  cachedV2Module = undefined;
  cachedV2ArtifactName = undefined;
}

export async function loadSp128WasmV2(options: Sp128WasmV2LoaderOptions = {}): Promise<Sp128WasmV2Runtime> {
  const artifactName = options.artifactName ?? SP128_WASM_V2_ARTIFACT_NAME;
  const module = await getCompiledV2Module(artifactName, options);
  const instantiate = options.instantiate ?? defaultInstantiateV2;
  const instance = await instantiate(module);
  const wasmExports = instance.exports;

  validateSp128WasmV2Exports(wasmExports, artifactName);
  return {
    artifactName,
    module,
    instance,
    exports: wasmExports,
    ...createSp128WasmV2Views(wasmExports, artifactName)
  };
}

export function validateSp128WasmV2Exports(
  exports: Partial<Sp128WasmV2Exports>,
  artifactName = SP128_WASM_V2_ARTIFACT_NAME
): void {
  for (const exportName of requiredV2Exports) {
    if (exportName === "memory") {
      if (!(exports.memory instanceof WebAssembly.Memory)) {
        throw new Error(`ZX Spectrum 128K WASM v2 artifact '${artifactName}' is missing WebAssembly memory.`);
      }
      continue;
    }

    if (typeof exports[exportName] !== "function") {
      throw new Error(`ZX Spectrum 128K WASM v2 artifact '${artifactName}' is missing export '${exportName}'.`);
    }
  }
}

export function createSp128WasmV2Views(
  exports: Sp128WasmV2Exports,
  artifactName = SP128_WASM_V2_ARTIFACT_NAME
): Omit<Sp128WasmV2Runtime, "artifactName" | "module" | "instance" | "exports"> {
  const memoryBuffer = exports.memory.buffer;
  const memorySize = exports.sp128GetMemorySize();
  const ramSize = exports.sp128GetRamSize();
  const romSize = exports.sp128GetRomSize();
  const screenWidth = exports.sp128GetScreenWidth();
  const screenHeight = exports.sp128GetScreenHeight();
  const audioSampleCapacity = exports.sp128GetAudioSampleCapacity();
  const tapeDataCapacity = exports.sp128TapeGetDataCapacity();
  const tapeSaveDataCapacity = exports.sp128TapeGetSaveDataCapacity();
  const pixelWords = screenWidth * screenHeight;
  const pixelBytes = pixelWords * 4;
  const audioWords = audioSampleCapacity * 2;

  assertViewRange(artifactName, "memory", exports.sp128MemoryPtr(), memorySize, memoryBuffer);
  assertViewRange(artifactName, "ram", exports.sp128RamPtr(), ramSize, memoryBuffer);
  assertViewRange(artifactName, "rom", exports.sp128RomPtr(), romSize, memoryBuffer);
  assertViewRange(artifactName, "pixelBuffer", exports.sp128PixelBufferPtr(), pixelBytes, memoryBuffer);
  assertViewRange(artifactName, "keyboardLines", exports.sp128KeyboardLinesPtr(), SP128_WASM_V2_KEYBOARD_LINE_COUNT, memoryBuffer);
  assertViewRange(artifactName, "audioSamples", exports.sp128AudioSamplesPtr(), audioWords * 2, memoryBuffer);
  assertViewRange(artifactName, "tapeData", exports.sp128TapeDataPtr(), tapeDataCapacity, memoryBuffer);
  assertViewRange(artifactName, "tapeSaveData", exports.sp128TapeSaveDataPtr(), tapeSaveDataCapacity, memoryBuffer);

  return {
    memoryBuffer,
    memory: new Uint8Array(memoryBuffer, exports.sp128MemoryPtr(), memorySize),
    ram: new Uint8Array(memoryBuffer, exports.sp128RamPtr(), ramSize),
    rom: new Uint8Array(memoryBuffer, exports.sp128RomPtr(), romSize),
    pixelBuffer: new Uint32Array(memoryBuffer, exports.sp128PixelBufferPtr(), pixelWords),
    pixelBufferBytes: new Uint8ClampedArray(memoryBuffer, exports.sp128PixelBufferPtr(), pixelBytes),
    keyboardLines: new Uint8Array(memoryBuffer, exports.sp128KeyboardLinesPtr(), SP128_WASM_V2_KEYBOARD_LINE_COUNT),
    audioSamples: new Int16Array(memoryBuffer, exports.sp128AudioSamplesPtr(), audioWords),
    tapeData: new Uint8Array(memoryBuffer, exports.sp128TapeDataPtr(), tapeDataCapacity),
    tapeSaveData: new Uint8Array(memoryBuffer, exports.sp128TapeSaveDataPtr(), tapeSaveDataCapacity)
  };
}

async function getCompiledV2Module(
  artifactName: string,
  options: Sp128WasmV2LoaderOptions
): Promise<WebAssembly.Module> {
  if (cachedV2Module != null && cachedV2ArtifactName === artifactName) {
    return cachedV2Module;
  }

  const readArtifact = options.readArtifact ?? (() => defaultReadV2Artifact(artifactName));
  const compile = options.compile ?? WebAssembly.compile;
  const bytes = await readArtifact();
  const module = await compile(bytes);

  cachedV2Module = module;
  cachedV2ArtifactName = artifactName;
  return module;
}

async function defaultReadV2Artifact(artifactName: string): Promise<ArrayBuffer> {
  const artifactUrl = new URL(`./dist/${artifactName}`, import.meta.url);
  const response = await fetch(artifactUrl);
  if (!response.ok) {
    throw new Error(
      `Cannot load ZX Spectrum 128K WASM v2 artifact from ${artifactUrl.toString()} (${response.status} ${response.statusText}).`
    );
  }
  return response.arrayBuffer();
}

async function defaultInstantiateV2(module: WebAssembly.Module): Promise<Sp128WasmV2Instance> {
  const instance = await WebAssembly.instantiate(module, {});
  return { exports: instance.exports as Sp128WasmV2Exports };
}

function assertViewRange(
  artifactName: string,
  name: string,
  offset: number,
  byteLength: number,
  memoryBuffer: ArrayBuffer
): void {
  if (!Number.isInteger(offset) || offset < 0 || offset + byteLength > memoryBuffer.byteLength) {
    throw new Error(
      `ZX Spectrum 128K WASM v2 artifact '${artifactName}' exposes ${name} outside WASM memory: offset ${offset}, length ${byteLength}, memory ${memoryBuffer.byteLength}.`
    );
  }
}
