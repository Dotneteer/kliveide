export const ZXNEXT_WASM_V2_ARTIFACT_NAME = "zx-spectrum-next.wasm";
export const ZXNEXT_WASM_V2_FLAT_MEMORY_SIZE = 0x10000;
export const ZXNEXT_WASM_V2_SRAM_CAPACITY = 4 * 1024 * 1024;
export const ZXNEXT_WASM_V2_ROM_SIZE = 0x20000;
export const ZXNEXT_WASM_V2_KEYBOARD_ROW_COUNT = 8;
export const ZXNEXT_WASM_V2_NEXTREG_COUNT = 256;

export type ZxNextWasmV2ExportFunction = (...args: number[]) => number;

export type ZxNextWasmV2Exports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  zxnextMemoryPtr: ZxNextWasmV2ExportFunction;
  zxnextSramPtr: ZxNextWasmV2ExportFunction;
  zxnextRomPtr: ZxNextWasmV2ExportFunction;
  zxnextKeyboardRowsPtr: ZxNextWasmV2ExportFunction;
  zxnextNextRegsPtr: ZxNextWasmV2ExportFunction;
  zxnextPixelBufferPtr: ZxNextWasmV2ExportFunction;
  zxnextAudioSamplesPtr: ZxNextWasmV2ExportFunction;
  zxnextSdCommandBufferPtr: ZxNextWasmV2ExportFunction;
  zxnextSdResponseBufferPtr: ZxNextWasmV2ExportFunction;
  zxnextDiagnosticBufferPtr: ZxNextWasmV2ExportFunction;
  zxnextHardReset: ZxNextWasmV2ExportFunction;
  zxnextReset: ZxNextWasmV2ExportFunction;
  zxnextUploadRomByte: ZxNextWasmV2ExportFunction;
  zxnextReadRomByte: ZxNextWasmV2ExportFunction;
  zxnextGetFlatMemorySize: ZxNextWasmV2ExportFunction;
  zxnextGetSramSize: ZxNextWasmV2ExportFunction;
  zxnextGetSramCapacity: ZxNextWasmV2ExportFunction;
  zxnextGetRomSize: ZxNextWasmV2ExportFunction;
  zxnextGetKeyboardRowCount: ZxNextWasmV2ExportFunction;
  zxnextGetNextRegCount: ZxNextWasmV2ExportFunction;
  zxnextGetScreenWidth: ZxNextWasmV2ExportFunction;
  zxnextGetScreenHeight: ZxNextWasmV2ExportFunction;
  zxnextGetAudioSampleCapacity: ZxNextWasmV2ExportFunction;
  zxnextGetSdCommandBufferSize: ZxNextWasmV2ExportFunction;
  zxnextGetSdResponseBufferSize: ZxNextWasmV2ExportFunction;
  zxnextGetDiagnosticBufferSize: ZxNextWasmV2ExportFunction;
  zxnextGetFrames: ZxNextWasmV2ExportFunction;
  zxnextGetTacts: ZxNextWasmV2ExportFunction;
  zxnextGetHardResetCount: ZxNextWasmV2ExportFunction;
  zxnextGetResetCount: ZxNextWasmV2ExportFunction;
  zxnextGetRomUploadCount: ZxNextWasmV2ExportFunction;
  zxnextGetUploadedRomMask: ZxNextWasmV2ExportFunction;
  zxnextGetCpuPc: ZxNextWasmV2ExportFunction;
  zxnextGetCpuSp: ZxNextWasmV2ExportFunction;
  zxnextGetDiagnosticFlags: ZxNextWasmV2ExportFunction;
};

export type ZxNextWasmV2Instance = {
  readonly exports: ZxNextWasmV2Exports;
};

export type ZxNextWasmV2ArtifactReader = () => Promise<BufferSource>;
export type ZxNextWasmV2Compiler = (bytes: BufferSource) => Promise<WebAssembly.Module>;
export type ZxNextWasmV2Instantiator = (module: WebAssembly.Module) => Promise<ZxNextWasmV2Instance>;

export type ZxNextWasmV2LoaderOptions = {
  readonly artifactName?: string;
  readonly readArtifact?: ZxNextWasmV2ArtifactReader;
  readonly compile?: ZxNextWasmV2Compiler;
  readonly instantiate?: ZxNextWasmV2Instantiator;
};

export type ZxNextWasmV2Runtime = {
  readonly artifactName: string;
  readonly module: WebAssembly.Module;
  readonly instance: ZxNextWasmV2Instance;
  readonly exports: ZxNextWasmV2Exports;
  readonly memoryBuffer: ArrayBuffer;
  readonly memory: Uint8Array;
  readonly sram: Uint8Array;
  readonly rom: Uint8Array;
  readonly keyboardRows: Uint8Array;
  readonly nextRegs: Uint8Array;
  readonly pixelBuffer: Uint32Array;
  readonly pixelBufferBytes: Uint8ClampedArray;
  readonly audioSamples: Int16Array;
  readonly sdCommandBuffer: Uint8Array;
  readonly sdResponseBuffer: Uint8Array;
  readonly diagnosticBuffer: Uint32Array;
};

const requiredV2Exports = [
  "memory",
  "zxnextMemoryPtr",
  "zxnextSramPtr",
  "zxnextRomPtr",
  "zxnextKeyboardRowsPtr",
  "zxnextNextRegsPtr",
  "zxnextPixelBufferPtr",
  "zxnextAudioSamplesPtr",
  "zxnextSdCommandBufferPtr",
  "zxnextSdResponseBufferPtr",
  "zxnextDiagnosticBufferPtr",
  "zxnextHardReset",
  "zxnextReset",
  "zxnextUploadRomByte",
  "zxnextReadRomByte",
  "zxnextGetFlatMemorySize",
  "zxnextGetSramSize",
  "zxnextGetSramCapacity",
  "zxnextGetRomSize",
  "zxnextGetKeyboardRowCount",
  "zxnextGetNextRegCount",
  "zxnextGetScreenWidth",
  "zxnextGetScreenHeight",
  "zxnextGetAudioSampleCapacity",
  "zxnextGetSdCommandBufferSize",
  "zxnextGetSdResponseBufferSize",
  "zxnextGetDiagnosticBufferSize",
  "zxnextGetFrames",
  "zxnextGetTacts",
  "zxnextGetHardResetCount",
  "zxnextGetResetCount",
  "zxnextGetRomUploadCount",
  "zxnextGetUploadedRomMask",
  "zxnextGetCpuPc",
  "zxnextGetCpuSp",
  "zxnextGetDiagnosticFlags"
] as const;

export function resetZxNextWasmV2ModuleCache(): void {
  // --- Intentionally empty. During the Next WASM rollout, always load the current artifact.
}

export async function loadZxNextWasmV2(
  options: ZxNextWasmV2LoaderOptions = {}
): Promise<ZxNextWasmV2Runtime> {
  const artifactName = options.artifactName ?? ZXNEXT_WASM_V2_ARTIFACT_NAME;
  const module = await getCompiledV2Module(artifactName, options);
  const instantiate = options.instantiate ?? defaultInstantiateV2;
  const instance = await instantiate(module);
  const wasmExports = instance.exports;

  validateZxNextWasmV2Exports(wasmExports, artifactName);
  return {
    artifactName,
    module,
    instance,
    exports: wasmExports,
    ...createZxNextWasmV2Views(wasmExports, artifactName)
  };
}

export function validateZxNextWasmV2Exports(
  exports: Partial<ZxNextWasmV2Exports>,
  artifactName = ZXNEXT_WASM_V2_ARTIFACT_NAME
): void {
  for (const exportName of requiredV2Exports) {
    if (exportName === "memory") {
      if (!(exports.memory instanceof WebAssembly.Memory)) {
        throw new Error(`ZX Spectrum Next WASM v2 artifact '${artifactName}' is missing WebAssembly memory.`);
      }
      continue;
    }

    if (typeof exports[exportName] !== "function") {
      throw new Error(`ZX Spectrum Next WASM v2 artifact '${artifactName}' is missing export '${exportName}'.`);
    }
  }
}

export function createZxNextWasmV2Views(
  exports: ZxNextWasmV2Exports,
  artifactName = ZXNEXT_WASM_V2_ARTIFACT_NAME
): Omit<ZxNextWasmV2Runtime, "artifactName" | "module" | "instance" | "exports"> {
  const memoryBuffer = exports.memory.buffer;
  const memorySize = exports.zxnextGetFlatMemorySize();
  const sramSize = exports.zxnextGetSramCapacity();
  const romSize = exports.zxnextGetRomSize();
  const keyboardRowCount = exports.zxnextGetKeyboardRowCount();
  const nextRegCount = exports.zxnextGetNextRegCount();
  const screenWidth = exports.zxnextGetScreenWidth();
  const screenHeight = exports.zxnextGetScreenHeight();
  const audioSampleCapacity = exports.zxnextGetAudioSampleCapacity();
  const sdCommandBufferSize = exports.zxnextGetSdCommandBufferSize();
  const sdResponseBufferSize = exports.zxnextGetSdResponseBufferSize();
  const diagnosticBufferSize = exports.zxnextGetDiagnosticBufferSize();
  const pixelWords = screenWidth * screenHeight;
  const pixelBytes = pixelWords * 4;
  const audioWords = audioSampleCapacity * 2;

  assertViewRange(artifactName, "memory", exports.zxnextMemoryPtr(), memorySize, memoryBuffer);
  assertViewRange(artifactName, "sram", exports.zxnextSramPtr(), sramSize, memoryBuffer);
  assertViewRange(artifactName, "rom", exports.zxnextRomPtr(), romSize, memoryBuffer);
  assertViewRange(artifactName, "keyboardRows", exports.zxnextKeyboardRowsPtr(), keyboardRowCount, memoryBuffer);
  assertViewRange(artifactName, "nextRegs", exports.zxnextNextRegsPtr(), nextRegCount, memoryBuffer);
  assertViewRange(artifactName, "pixelBuffer", exports.zxnextPixelBufferPtr(), pixelBytes, memoryBuffer);
  assertViewRange(artifactName, "audioSamples", exports.zxnextAudioSamplesPtr(), audioWords * 2, memoryBuffer);
  assertViewRange(artifactName, "sdCommandBuffer", exports.zxnextSdCommandBufferPtr(), sdCommandBufferSize, memoryBuffer);
  assertViewRange(artifactName, "sdResponseBuffer", exports.zxnextSdResponseBufferPtr(), sdResponseBufferSize, memoryBuffer);
  assertViewRange(artifactName, "diagnosticBuffer", exports.zxnextDiagnosticBufferPtr(), diagnosticBufferSize * 4, memoryBuffer);

  return {
    memoryBuffer,
    memory: new Uint8Array(memoryBuffer, exports.zxnextMemoryPtr(), memorySize),
    sram: new Uint8Array(memoryBuffer, exports.zxnextSramPtr(), sramSize),
    rom: new Uint8Array(memoryBuffer, exports.zxnextRomPtr(), romSize),
    keyboardRows: new Uint8Array(memoryBuffer, exports.zxnextKeyboardRowsPtr(), keyboardRowCount),
    nextRegs: new Uint8Array(memoryBuffer, exports.zxnextNextRegsPtr(), nextRegCount),
    pixelBuffer: new Uint32Array(memoryBuffer, exports.zxnextPixelBufferPtr(), pixelWords),
    pixelBufferBytes: new Uint8ClampedArray(memoryBuffer, exports.zxnextPixelBufferPtr(), pixelBytes),
    audioSamples: new Int16Array(memoryBuffer, exports.zxnextAudioSamplesPtr(), audioWords),
    sdCommandBuffer: new Uint8Array(memoryBuffer, exports.zxnextSdCommandBufferPtr(), sdCommandBufferSize),
    sdResponseBuffer: new Uint8Array(memoryBuffer, exports.zxnextSdResponseBufferPtr(), sdResponseBufferSize),
    diagnosticBuffer: new Uint32Array(memoryBuffer, exports.zxnextDiagnosticBufferPtr(), diagnosticBufferSize)
  };
}

async function getCompiledV2Module(
  artifactName: string,
  options: ZxNextWasmV2LoaderOptions
): Promise<WebAssembly.Module> {
  const readArtifact = options.readArtifact ?? (() => defaultReadV2Artifact(artifactName));
  const compile = options.compile ?? WebAssembly.compile;
  const bytes = await readArtifact();
  return compile(bytes);
}

async function defaultReadV2Artifact(artifactName: string): Promise<ArrayBuffer> {
  const artifactUrl = new URL(`./dist/${artifactName}`, import.meta.url);
  const response = await fetch(artifactUrl);
  if (!response.ok) {
    throw new Error(
      `Cannot load ZX Spectrum Next WASM v2 artifact from ${artifactUrl.toString()} (${response.status} ${response.statusText}).`
    );
  }
  return response.arrayBuffer();
}

async function defaultInstantiateV2(module: WebAssembly.Module): Promise<ZxNextWasmV2Instance> {
  const instance = await WebAssembly.instantiate(module, {});
  return { exports: instance.exports as ZxNextWasmV2Exports };
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
      `ZX Spectrum Next WASM v2 artifact '${artifactName}' exposes ${name} outside WASM memory: offset ${offset}, length ${byteLength}, memory ${memoryBuffer.byteLength}.`
    );
  }
}
