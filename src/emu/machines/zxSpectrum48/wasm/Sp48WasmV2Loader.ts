export const SP48_WASM_V2_ARTIFACT_NAME = "zx-spectrum48.wasm";
export const SP48_WASM_V2_MEMORY_SIZE = 0x10000;
export const SP48_WASM_V2_KEYBOARD_LINE_COUNT = 8;
export const SP48_WASM_V2_PIXEL_GUARD_LINES = 4;

export type Sp48WasmV2ExportFunction = (...args: number[]) => number;

export type Sp48WasmV2Exports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  sp48MemoryPtr: Sp48WasmV2ExportFunction;
  sp48PixelBufferPtr: Sp48WasmV2ExportFunction;
  sp48AudioSamplesPtr: Sp48WasmV2ExportFunction;
  sp48KeyboardLinesPtr: Sp48WasmV2ExportFunction;
  sp48TapeDataPtr: Sp48WasmV2ExportFunction;
  sp48TapeSaveDataPtr: Sp48WasmV2ExportFunction;
  sp48TapeFileNamePtr: Sp48WasmV2ExportFunction;
  sp48Reset: Sp48WasmV2ExportFunction;
  sp48HardReset: Sp48WasmV2ExportFunction;
  sp48ExecuteFrame: Sp48WasmV2ExportFunction;
  sp48ExecuteInstruction: Sp48WasmV2ExportFunction;
  sp48RenderInstantScreen: Sp48WasmV2ExportFunction;
  sp48UploadRomByte: Sp48WasmV2ExportFunction;
  sp48ReadMemory: Sp48WasmV2ExportFunction;
  sp48WriteMemory: Sp48WasmV2ExportFunction;
  sp48ReadPort: Sp48WasmV2ExportFunction;
  sp48WritePort: Sp48WasmV2ExportFunction;
  sp48SetKeyStatus: Sp48WasmV2ExportFunction;
  sp48GetKeyboardLine: Sp48WasmV2ExportFunction;
  sp48SetAudioSampleRate: Sp48WasmV2ExportFunction;
  sp48GetScreenWidth: Sp48WasmV2ExportFunction;
  sp48GetScreenHeight: Sp48WasmV2ExportFunction;
  sp48GetPixelBufferStartOffset: Sp48WasmV2ExportFunction;
  sp48GetAudioSampleCount: Sp48WasmV2ExportFunction;
  sp48GetAudioSampleCapacity: Sp48WasmV2ExportFunction;
  sp48GetTactsInFrame: Sp48WasmV2ExportFunction;
  sp48SetTacts: Sp48WasmV2ExportFunction;
  sp48SetTargetClockMultiplier: Sp48WasmV2ExportFunction;
  sp48GetClockMultiplier: Sp48WasmV2ExportFunction;
  sp48GetTargetClockMultiplier: Sp48WasmV2ExportFunction;
  sp48GetTactsInCurrentFrame: Sp48WasmV2ExportFunction;
  sp48GetFrames: Sp48WasmV2ExportFunction;
  sp48GetTacts: Sp48WasmV2ExportFunction;
  sp48GetCpuAf: Sp48WasmV2ExportFunction;
  sp48SetCpuAf: Sp48WasmV2ExportFunction;
  sp48GetCpuBc: Sp48WasmV2ExportFunction;
  sp48SetCpuBc: Sp48WasmV2ExportFunction;
  sp48GetCpuDe: Sp48WasmV2ExportFunction;
  sp48SetCpuDe: Sp48WasmV2ExportFunction;
  sp48GetCpuHl: Sp48WasmV2ExportFunction;
  sp48SetCpuHl: Sp48WasmV2ExportFunction;
  sp48GetCpuAfAlt: Sp48WasmV2ExportFunction;
  sp48SetCpuAfAlt: Sp48WasmV2ExportFunction;
  sp48GetCpuBcAlt: Sp48WasmV2ExportFunction;
  sp48GetCpuDeAlt: Sp48WasmV2ExportFunction;
  sp48GetCpuHlAlt: Sp48WasmV2ExportFunction;
  sp48GetCpuIx: Sp48WasmV2ExportFunction;
  sp48SetCpuIx: Sp48WasmV2ExportFunction;
  sp48GetCpuIy: Sp48WasmV2ExportFunction;
  sp48SetCpuIy: Sp48WasmV2ExportFunction;
  sp48GetCpuIr: Sp48WasmV2ExportFunction;
  sp48GetCpuWz: Sp48WasmV2ExportFunction;
  sp48GetCpuPc: Sp48WasmV2ExportFunction;
  sp48SetCpuPc: Sp48WasmV2ExportFunction;
  sp48GetCpuSp: Sp48WasmV2ExportFunction;
  sp48SetCpuSp: Sp48WasmV2ExportFunction;
  sp48GetCpuHalted: Sp48WasmV2ExportFunction;
  sp48GetCpuPrefix: Sp48WasmV2ExportFunction;
  sp48GetCpuIff1: Sp48WasmV2ExportFunction;
  sp48SetCpuIff1: Sp48WasmV2ExportFunction;
  sp48GetCpuInterruptMode: Sp48WasmV2ExportFunction;
  sp48SetCpuInterruptMode: Sp48WasmV2ExportFunction;
  sp48GetCpuRetExecuted: Sp48WasmV2ExportFunction;
  sp48GetCpuRetnExecuted: Sp48WasmV2ExportFunction;
  sp48GetLastMemoryAddress: Sp48WasmV2ExportFunction;
  sp48GetLastMemoryValue: Sp48WasmV2ExportFunction;
  sp48GetLastMemoryIsWrite: Sp48WasmV2ExportFunction;
  sp48GetLastPortAddress: Sp48WasmV2ExportFunction;
  sp48GetLastPortValue: Sp48WasmV2ExportFunction;
  sp48GetLastPortIsWrite: Sp48WasmV2ExportFunction;
  sp48GetRomSize: Sp48WasmV2ExportFunction;
  sp48TapeClear: Sp48WasmV2ExportFunction;
  sp48TapeSetFileNameByte: Sp48WasmV2ExportFunction;
  sp48TapeBeginUpload: Sp48WasmV2ExportFunction;
  sp48TapeSetBlock: Sp48WasmV2ExportFunction;
  sp48TapeFinishUpload: Sp48WasmV2ExportFunction;
  sp48TapeRewind: Sp48WasmV2ExportFunction;
  sp48TapeSetMode: Sp48WasmV2ExportFunction;
  sp48TapeSetFastLoad: Sp48WasmV2ExportFunction;
  sp48TapeGetFastLoad: Sp48WasmV2ExportFunction;
  sp48TapeGetBlockCount: Sp48WasmV2ExportFunction;
  sp48TapeGetDataLength: Sp48WasmV2ExportFunction;
  sp48TapeGetLoaded: Sp48WasmV2ExportFunction;
  sp48TapeGetMode: Sp48WasmV2ExportFunction;
  sp48TapeGetCurrentBlockIndex: Sp48WasmV2ExportFunction;
  sp48TapeGetSavedBlockCount: Sp48WasmV2ExportFunction;
  sp48TapeGetSavedDataLength: Sp48WasmV2ExportFunction;
  sp48TapeGetSavedRevision: Sp48WasmV2ExportFunction;
  sp48TapeGetSavedBlockOffset: Sp48WasmV2ExportFunction;
  sp48TapeGetSavedBlockLength: Sp48WasmV2ExportFunction;
  sp48TapeClearSavedBlocks: Sp48WasmV2ExportFunction;
  sp48TapeGetBlockOffset: Sp48WasmV2ExportFunction;
  sp48TapeGetBlockLength: Sp48WasmV2ExportFunction;
  sp48TapeGetBlockPauseAfter: Sp48WasmV2ExportFunction;
  sp48TapeGetBlockPilotPulseLength: Sp48WasmV2ExportFunction;
  sp48TapeGetBlockSync1PulseLength: Sp48WasmV2ExportFunction;
  sp48TapeGetBlockSync2PulseLength: Sp48WasmV2ExportFunction;
  sp48TapeGetBlockZeroBitPulseLength: Sp48WasmV2ExportFunction;
  sp48TapeGetBlockOneBitPulseLength: Sp48WasmV2ExportFunction;
  sp48TapeGetBlockEndSyncPulseLength: Sp48WasmV2ExportFunction;
  sp48TapeGetBlockLastByteUsedBits: Sp48WasmV2ExportFunction;
  sp48TapeGetBlockPilotPulseCount: Sp48WasmV2ExportFunction;
  sp48TapeGetDataCapacity: Sp48WasmV2ExportFunction;
  sp48TapeGetFileNameCapacity: Sp48WasmV2ExportFunction;
  sp48TapeGetSaveDataCapacity: Sp48WasmV2ExportFunction;
};

export type Sp48WasmV2Instance = {
  readonly exports: Sp48WasmV2Exports;
};

export type Sp48WasmV2ArtifactReader = () => Promise<BufferSource>;
export type Sp48WasmV2Compiler = (bytes: BufferSource) => Promise<WebAssembly.Module>;
export type Sp48WasmV2Instantiator = (module: WebAssembly.Module) => Promise<Sp48WasmV2Instance>;

export type Sp48WasmV2LoaderOptions = {
  readonly artifactName?: string;
  readonly readArtifact?: Sp48WasmV2ArtifactReader;
  readonly compile?: Sp48WasmV2Compiler;
  readonly instantiate?: Sp48WasmV2Instantiator;
};

export type Sp48WasmV2Runtime = {
  readonly artifactName: string;
  readonly module: WebAssembly.Module;
  readonly instance: Sp48WasmV2Instance;
  readonly exports: Sp48WasmV2Exports;
  readonly memoryBuffer: ArrayBuffer;
  readonly memory: Uint8Array;
  readonly pixelBuffer: Uint32Array;
  readonly pixelBufferBytes: Uint8ClampedArray;
  readonly keyboardLines: Uint8Array;
  readonly audioSamples: Int16Array;
  readonly tapeData: Uint8Array;
  readonly tapeSaveData: Uint8Array;
  readonly tapeFileName: Uint8Array;
};

const requiredV2Exports = [
  "memory",
  "sp48MemoryPtr",
  "sp48PixelBufferPtr",
  "sp48AudioSamplesPtr",
  "sp48KeyboardLinesPtr",
  "sp48TapeDataPtr",
  "sp48TapeSaveDataPtr",
  "sp48TapeFileNamePtr",
  "sp48Reset",
  "sp48HardReset",
  "sp48ExecuteFrame",
  "sp48ExecuteInstruction",
  "sp48RenderInstantScreen",
  "sp48UploadRomByte",
  "sp48ReadMemory",
  "sp48WriteMemory",
  "sp48ReadPort",
  "sp48WritePort",
  "sp48SetKeyStatus",
  "sp48GetKeyboardLine",
  "sp48SetAudioSampleRate",
  "sp48GetScreenWidth",
  "sp48GetScreenHeight",
  "sp48GetPixelBufferStartOffset",
  "sp48GetAudioSampleCount",
  "sp48GetAudioSampleCapacity",
  "sp48GetTactsInFrame",
  "sp48SetTacts",
  "sp48SetTargetClockMultiplier",
  "sp48GetClockMultiplier",
  "sp48GetTargetClockMultiplier",
  "sp48GetTactsInCurrentFrame",
  "sp48GetFrames",
  "sp48GetTacts",
  "sp48GetCpuAf",
  "sp48SetCpuAf",
  "sp48GetCpuBc",
  "sp48SetCpuBc",
  "sp48GetCpuDe",
  "sp48SetCpuDe",
  "sp48GetCpuHl",
  "sp48SetCpuHl",
  "sp48GetCpuAfAlt",
  "sp48SetCpuAfAlt",
  "sp48GetCpuBcAlt",
  "sp48GetCpuDeAlt",
  "sp48GetCpuHlAlt",
  "sp48GetCpuIx",
  "sp48SetCpuIx",
  "sp48GetCpuIy",
  "sp48SetCpuIy",
  "sp48GetCpuIr",
  "sp48GetCpuWz",
  "sp48GetCpuPc",
  "sp48SetCpuPc",
  "sp48GetCpuSp",
  "sp48SetCpuSp",
  "sp48GetCpuHalted",
  "sp48GetCpuPrefix",
  "sp48GetCpuIff1",
  "sp48SetCpuIff1",
  "sp48GetCpuInterruptMode",
  "sp48SetCpuInterruptMode",
  "sp48GetCpuRetExecuted",
  "sp48GetCpuRetnExecuted",
  "sp48GetLastMemoryAddress",
  "sp48GetLastMemoryValue",
  "sp48GetLastMemoryIsWrite",
  "sp48GetLastPortAddress",
  "sp48GetLastPortValue",
  "sp48GetLastPortIsWrite",
  "sp48GetRomSize",
  "sp48TapeClear",
  "sp48TapeSetFileNameByte",
  "sp48TapeBeginUpload",
  "sp48TapeSetBlock",
  "sp48TapeFinishUpload",
  "sp48TapeRewind",
  "sp48TapeSetMode",
  "sp48TapeSetFastLoad",
  "sp48TapeGetFastLoad",
  "sp48TapeGetBlockCount",
  "sp48TapeGetDataLength",
  "sp48TapeGetLoaded",
  "sp48TapeGetMode",
  "sp48TapeGetCurrentBlockIndex",
  "sp48TapeGetSavedBlockCount",
  "sp48TapeGetSavedDataLength",
  "sp48TapeGetSavedRevision",
  "sp48TapeGetSavedBlockOffset",
  "sp48TapeGetSavedBlockLength",
  "sp48TapeClearSavedBlocks",
  "sp48TapeGetBlockOffset",
  "sp48TapeGetBlockLength",
  "sp48TapeGetBlockPauseAfter",
  "sp48TapeGetBlockPilotPulseLength",
  "sp48TapeGetBlockSync1PulseLength",
  "sp48TapeGetBlockSync2PulseLength",
  "sp48TapeGetBlockZeroBitPulseLength",
  "sp48TapeGetBlockOneBitPulseLength",
  "sp48TapeGetBlockEndSyncPulseLength",
  "sp48TapeGetBlockLastByteUsedBits",
  "sp48TapeGetBlockPilotPulseCount",
  "sp48TapeGetDataCapacity",
  "sp48TapeGetFileNameCapacity",
  "sp48TapeGetSaveDataCapacity"
] as const;

let cachedV2Module: WebAssembly.Module | undefined;
let cachedV2ArtifactName: string | undefined;

export function resetSp48WasmV2ModuleCache(): void {
  cachedV2Module = undefined;
  cachedV2ArtifactName = undefined;
}

export async function loadSp48WasmV2(options: Sp48WasmV2LoaderOptions = {}): Promise<Sp48WasmV2Runtime> {
  const artifactName = options.artifactName ?? SP48_WASM_V2_ARTIFACT_NAME;
  const module = await getCompiledV2Module(artifactName, options);
  const instantiate = options.instantiate ?? defaultInstantiateV2;
  const instance = await instantiate(module);
  const wasmExports = instance.exports;

  validateSp48WasmV2Exports(wasmExports, artifactName);
  return {
    artifactName,
    module,
    instance,
    exports: wasmExports,
    ...createSp48WasmV2Views(wasmExports, artifactName)
  };
}

export function validateSp48WasmV2Exports(
  exports: Partial<Sp48WasmV2Exports>,
  artifactName = SP48_WASM_V2_ARTIFACT_NAME
): void {
  for (const exportName of requiredV2Exports) {
    if (exportName === "memory") {
      if (!(exports.memory instanceof WebAssembly.Memory)) {
        throw new Error(`ZX Spectrum 48K WASM v2 artifact '${artifactName}' is missing WebAssembly memory.`);
      }
      continue;
    }

    if (typeof exports[exportName] !== "function") {
      throw new Error(`ZX Spectrum 48K WASM v2 artifact '${artifactName}' is missing export '${exportName}'.`);
    }
  }
}

export function createSp48WasmV2Views(
  exports: Sp48WasmV2Exports,
  artifactName = SP48_WASM_V2_ARTIFACT_NAME
): Omit<Sp48WasmV2Runtime, "artifactName" | "module" | "instance" | "exports"> {
  const memoryBuffer = exports.memory.buffer;
  const screenWidth = exports.sp48GetScreenWidth();
  const screenHeight = exports.sp48GetScreenHeight();
  const audioSampleCapacity = exports.sp48GetAudioSampleCapacity();
  const tapeDataCapacity = exports.sp48TapeGetDataCapacity();
  const tapeSaveDataCapacity = exports.sp48TapeGetSaveDataCapacity();
  const tapeFileNameCapacity = exports.sp48TapeGetFileNameCapacity();
  const pixelWords = screenWidth * (screenHeight + SP48_WASM_V2_PIXEL_GUARD_LINES);
  const pixelBytes = pixelWords * 4;
  const audioWords = audioSampleCapacity * 2;

  assertViewRange(artifactName, "memory", exports.sp48MemoryPtr(), SP48_WASM_V2_MEMORY_SIZE, memoryBuffer);
  assertViewRange(artifactName, "pixelBuffer", exports.sp48PixelBufferPtr(), pixelBytes, memoryBuffer);
  assertViewRange(artifactName, "keyboardLines", exports.sp48KeyboardLinesPtr(), SP48_WASM_V2_KEYBOARD_LINE_COUNT, memoryBuffer);
  assertViewRange(artifactName, "audioSamples", exports.sp48AudioSamplesPtr(), audioWords * 2, memoryBuffer);
  assertViewRange(artifactName, "tapeData", exports.sp48TapeDataPtr(), tapeDataCapacity, memoryBuffer);
  assertViewRange(artifactName, "tapeSaveData", exports.sp48TapeSaveDataPtr(), tapeSaveDataCapacity, memoryBuffer);
  assertViewRange(artifactName, "tapeFileName", exports.sp48TapeFileNamePtr(), tapeFileNameCapacity, memoryBuffer);

  return {
    memoryBuffer,
    memory: new Uint8Array(memoryBuffer, exports.sp48MemoryPtr(), SP48_WASM_V2_MEMORY_SIZE),
    pixelBuffer: new Uint32Array(memoryBuffer, exports.sp48PixelBufferPtr(), pixelWords),
    pixelBufferBytes: new Uint8ClampedArray(memoryBuffer, exports.sp48PixelBufferPtr(), pixelBytes),
    keyboardLines: new Uint8Array(memoryBuffer, exports.sp48KeyboardLinesPtr(), SP48_WASM_V2_KEYBOARD_LINE_COUNT),
    audioSamples: new Int16Array(memoryBuffer, exports.sp48AudioSamplesPtr(), audioWords),
    tapeData: new Uint8Array(memoryBuffer, exports.sp48TapeDataPtr(), tapeDataCapacity),
    tapeSaveData: new Uint8Array(memoryBuffer, exports.sp48TapeSaveDataPtr(), tapeSaveDataCapacity),
    tapeFileName: new Uint8Array(memoryBuffer, exports.sp48TapeFileNamePtr(), tapeFileNameCapacity)
  };
}

async function getCompiledV2Module(
  artifactName: string,
  options: Sp48WasmV2LoaderOptions
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
      `Cannot load ZX Spectrum 48K WASM v2 artifact from ${artifactUrl.toString()} (${response.status} ${response.statusText}).`
    );
  }
  return response.arrayBuffer();
}

async function defaultInstantiateV2(module: WebAssembly.Module): Promise<Sp48WasmV2Instance> {
  const instance = await WebAssembly.instantiate(module, {});
  return { exports: instance.exports as Sp48WasmV2Exports };
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
      `ZX Spectrum 48K WASM v2 artifact '${artifactName}' exposes ${name} outside WASM memory: offset ${offset}, length ${byteLength}, memory ${memoryBuffer.byteLength}.`
    );
  }
}
