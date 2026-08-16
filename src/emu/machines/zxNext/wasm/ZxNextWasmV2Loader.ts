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
  zxnextExecuteInstruction: ZxNextWasmV2ExportFunction;
  zxnextUploadRomByte: ZxNextWasmV2ExportFunction;
  zxnextReadRomByte: ZxNextWasmV2ExportFunction;
  zxnextReadMemory: ZxNextWasmV2ExportFunction;
  zxnextWriteMemory: ZxNextWasmV2ExportFunction;
  zxnextReadPort: ZxNextWasmV2ExportFunction;
  zxnextWritePort: ZxNextWasmV2ExportFunction;
  zxnextSetPortReadValue: ZxNextWasmV2ExportFunction;
  zxnextReadNextReg: ZxNextWasmV2ExportFunction;
  zxnextWriteNextReg: ZxNextWasmV2ExportFunction;
  zxnextGetFlatMemorySize: ZxNextWasmV2ExportFunction;
  zxnextGetSramSize: ZxNextWasmV2ExportFunction;
  zxnextGetSramCapacity: ZxNextWasmV2ExportFunction;
  zxnextGetRomSize: ZxNextWasmV2ExportFunction;
  zxnextGetNextRomOffset: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcRomOffset: ZxNextWasmV2ExportFunction;
  zxnextGetMultifaceMemOffset: ZxNextWasmV2ExportFunction;
  zxnextGetAltRomOffset: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcRamOffset: ZxNextWasmV2ExportFunction;
  zxnextGetNextRamOffset: ZxNextWasmV2ExportFunction;
  zxnextGetConfiguredMemorySizeKb: ZxNextWasmV2ExportFunction;
  zxnextGetMainRamPageCount: ZxNextWasmV2ExportFunction;
  zxnextGetMaxMainRamPageCount: ZxNextWasmV2ExportFunction;
  zxnextGetActiveMainRamSize: ZxNextWasmV2ExportFunction;
  zxnextGetActiveMemorySize: ZxNextWasmV2ExportFunction;
  zxnextGetSentinelOffset: ZxNextWasmV2ExportFunction;
  zxnextGetSentinelSize: ZxNextWasmV2ExportFunction;
  zxnextConfigureMemorySize: ZxNextWasmV2ExportFunction;
  zxnextGetMmuReg: ZxNextWasmV2ExportFunction;
  zxnextSetMmuReg: ZxNextWasmV2ExportFunction;
  zxnextGetPageReadOffset: ZxNextWasmV2ExportFunction;
  zxnextGetPageWriteOffset: ZxNextWasmV2ExportFunction;
  zxnextGetPageBank16k: ZxNextWasmV2ExportFunction;
  zxnextGetPageBank8k: ZxNextWasmV2ExportFunction;
  zxnextGetCurrentPartition: ZxNextWasmV2ExportFunction;
  zxnextGetPort7ffdValue: ZxNextWasmV2ExportFunction;
  zxnextGetPortDffdValue: ZxNextWasmV2ExportFunction;
  zxnextGetPort1ffdValue: ZxNextWasmV2ExportFunction;
  zxnextGetPortEff7Value: ZxNextWasmV2ExportFunction;
  zxnextGetSelectedRomPage: ZxNextWasmV2ExportFunction;
  zxnextGetSelectedRamBank: ZxNextWasmV2ExportFunction;
  zxnextGetSelectedBankLsb: ZxNextWasmV2ExportFunction;
  zxnextGetSelectedBankMsb: ZxNextWasmV2ExportFunction;
  zxnextGetPagingEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetAllRamMode: ZxNextWasmV2ExportFunction;
  zxnextGetSpecialConfig: ZxNextWasmV2ExportFunction;
  zxnextGetUseShadowScreen: ZxNextWasmV2ExportFunction;
  zxnextReadPhysical: ZxNextWasmV2ExportFunction;
  zxnextWritePhysical: ZxNextWasmV2ExportFunction;
  zxnextReadSramPage: ZxNextWasmV2ExportFunction;
  zxnextWriteSramPage: ZxNextWasmV2ExportFunction;
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
  zxnextSetTacts: ZxNextWasmV2ExportFunction;
  zxnextGetHardResetCount: ZxNextWasmV2ExportFunction;
  zxnextGetResetCount: ZxNextWasmV2ExportFunction;
  zxnextGetRomUploadCount: ZxNextWasmV2ExportFunction;
  zxnextGetUploadedRomMask: ZxNextWasmV2ExportFunction;
  zxnextGetCpuInstructionsExecuted: ZxNextWasmV2ExportFunction;
  zxnextGetCpuAf: ZxNextWasmV2ExportFunction;
  zxnextSetCpuAf: ZxNextWasmV2ExportFunction;
  zxnextGetCpuAfAlt: ZxNextWasmV2ExportFunction;
  zxnextSetCpuAfAlt: ZxNextWasmV2ExportFunction;
  zxnextGetCpuBc: ZxNextWasmV2ExportFunction;
  zxnextSetCpuBc: ZxNextWasmV2ExportFunction;
  zxnextGetCpuBcAlt: ZxNextWasmV2ExportFunction;
  zxnextSetCpuBcAlt: ZxNextWasmV2ExportFunction;
  zxnextGetCpuDe: ZxNextWasmV2ExportFunction;
  zxnextSetCpuDe: ZxNextWasmV2ExportFunction;
  zxnextGetCpuDeAlt: ZxNextWasmV2ExportFunction;
  zxnextSetCpuDeAlt: ZxNextWasmV2ExportFunction;
  zxnextGetCpuHl: ZxNextWasmV2ExportFunction;
  zxnextSetCpuHl: ZxNextWasmV2ExportFunction;
  zxnextGetCpuHlAlt: ZxNextWasmV2ExportFunction;
  zxnextSetCpuHlAlt: ZxNextWasmV2ExportFunction;
  zxnextGetCpuIx: ZxNextWasmV2ExportFunction;
  zxnextSetCpuIx: ZxNextWasmV2ExportFunction;
  zxnextGetCpuIy: ZxNextWasmV2ExportFunction;
  zxnextSetCpuIy: ZxNextWasmV2ExportFunction;
  zxnextGetCpuIr: ZxNextWasmV2ExportFunction;
  zxnextSetCpuIr: ZxNextWasmV2ExportFunction;
  zxnextGetCpuWz: ZxNextWasmV2ExportFunction;
  zxnextSetCpuWz: ZxNextWasmV2ExportFunction;
  zxnextGetCpuPc: ZxNextWasmV2ExportFunction;
  zxnextSetCpuPc: ZxNextWasmV2ExportFunction;
  zxnextGetCpuSp: ZxNextWasmV2ExportFunction;
  zxnextSetCpuSp: ZxNextWasmV2ExportFunction;
  zxnextGetCpuHalted: ZxNextWasmV2ExportFunction;
  zxnextGetCpuPrefix: ZxNextWasmV2ExportFunction;
  zxnextGetCpuIff1: ZxNextWasmV2ExportFunction;
  zxnextSetCpuIff1: ZxNextWasmV2ExportFunction;
  zxnextGetCpuIff2: ZxNextWasmV2ExportFunction;
  zxnextSetCpuIff2: ZxNextWasmV2ExportFunction;
  zxnextGetCpuInterruptMode: ZxNextWasmV2ExportFunction;
  zxnextSetCpuInterruptMode: ZxNextWasmV2ExportFunction;
  zxnextGetCpuTacts: ZxNextWasmV2ExportFunction;
  zxnextGetZ80NMode: ZxNextWasmV2ExportFunction;
  zxnextGetLastMemoryAddress: ZxNextWasmV2ExportFunction;
  zxnextGetLastMemoryValue: ZxNextWasmV2ExportFunction;
  zxnextGetLastMemoryIsWrite: ZxNextWasmV2ExportFunction;
  zxnextGetLastPortAddress: ZxNextWasmV2ExportFunction;
  zxnextGetLastPortValue: ZxNextWasmV2ExportFunction;
  zxnextGetLastPortIsWrite: ZxNextWasmV2ExportFunction;
  zxnextGetLastTbBlueAddress: ZxNextWasmV2ExportFunction;
  zxnextGetLastTbBlueValue: ZxNextWasmV2ExportFunction;
  zxnextGetLastTbBlueIsWrite: ZxNextWasmV2ExportFunction;
  zxnextClearBusEvents: ZxNextWasmV2ExportFunction;
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
  "zxnextExecuteInstruction",
  "zxnextUploadRomByte",
  "zxnextReadRomByte",
  "zxnextReadMemory",
  "zxnextWriteMemory",
  "zxnextReadPort",
  "zxnextWritePort",
  "zxnextSetPortReadValue",
  "zxnextReadNextReg",
  "zxnextWriteNextReg",
  "zxnextGetFlatMemorySize",
  "zxnextGetSramSize",
  "zxnextGetSramCapacity",
  "zxnextGetRomSize",
  "zxnextGetNextRomOffset",
  "zxnextGetDivMmcRomOffset",
  "zxnextGetMultifaceMemOffset",
  "zxnextGetAltRomOffset",
  "zxnextGetDivMmcRamOffset",
  "zxnextGetNextRamOffset",
  "zxnextGetConfiguredMemorySizeKb",
  "zxnextGetMainRamPageCount",
  "zxnextGetMaxMainRamPageCount",
  "zxnextGetActiveMainRamSize",
  "zxnextGetActiveMemorySize",
  "zxnextGetSentinelOffset",
  "zxnextGetSentinelSize",
  "zxnextConfigureMemorySize",
  "zxnextGetMmuReg",
  "zxnextSetMmuReg",
  "zxnextGetPageReadOffset",
  "zxnextGetPageWriteOffset",
  "zxnextGetPageBank16k",
  "zxnextGetPageBank8k",
  "zxnextGetCurrentPartition",
  "zxnextGetPort7ffdValue",
  "zxnextGetPortDffdValue",
  "zxnextGetPort1ffdValue",
  "zxnextGetPortEff7Value",
  "zxnextGetSelectedRomPage",
  "zxnextGetSelectedRamBank",
  "zxnextGetSelectedBankLsb",
  "zxnextGetSelectedBankMsb",
  "zxnextGetPagingEnabled",
  "zxnextGetAllRamMode",
  "zxnextGetSpecialConfig",
  "zxnextGetUseShadowScreen",
  "zxnextReadPhysical",
  "zxnextWritePhysical",
  "zxnextReadSramPage",
  "zxnextWriteSramPage",
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
  "zxnextSetTacts",
  "zxnextGetHardResetCount",
  "zxnextGetResetCount",
  "zxnextGetRomUploadCount",
  "zxnextGetUploadedRomMask",
  "zxnextGetCpuInstructionsExecuted",
  "zxnextGetCpuAf",
  "zxnextSetCpuAf",
  "zxnextGetCpuAfAlt",
  "zxnextSetCpuAfAlt",
  "zxnextGetCpuBc",
  "zxnextSetCpuBc",
  "zxnextGetCpuBcAlt",
  "zxnextSetCpuBcAlt",
  "zxnextGetCpuDe",
  "zxnextSetCpuDe",
  "zxnextGetCpuDeAlt",
  "zxnextSetCpuDeAlt",
  "zxnextGetCpuHl",
  "zxnextSetCpuHl",
  "zxnextGetCpuHlAlt",
  "zxnextSetCpuHlAlt",
  "zxnextGetCpuIx",
  "zxnextSetCpuIx",
  "zxnextGetCpuIy",
  "zxnextSetCpuIy",
  "zxnextGetCpuIr",
  "zxnextSetCpuIr",
  "zxnextGetCpuWz",
  "zxnextSetCpuWz",
  "zxnextGetCpuPc",
  "zxnextSetCpuPc",
  "zxnextGetCpuSp",
  "zxnextSetCpuSp",
  "zxnextGetCpuHalted",
  "zxnextGetCpuPrefix",
  "zxnextGetCpuIff1",
  "zxnextSetCpuIff1",
  "zxnextGetCpuIff2",
  "zxnextSetCpuIff2",
  "zxnextGetCpuInterruptMode",
  "zxnextSetCpuInterruptMode",
  "zxnextGetCpuTacts",
  "zxnextGetZ80NMode",
  "zxnextGetLastMemoryAddress",
  "zxnextGetLastMemoryValue",
  "zxnextGetLastMemoryIsWrite",
  "zxnextGetLastPortAddress",
  "zxnextGetLastPortValue",
  "zxnextGetLastPortIsWrite",
  "zxnextGetLastTbBlueAddress",
  "zxnextGetLastTbBlueValue",
  "zxnextGetLastTbBlueIsWrite",
  "zxnextClearBusEvents",
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
