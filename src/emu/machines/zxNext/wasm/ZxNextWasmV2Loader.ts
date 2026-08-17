import { OFFS_ERR_PAGE } from "../MemoryDevice";

export const ZXNEXT_WASM_V2_ARTIFACT_NAME = "zx-spectrum-next.wasm";
export const ZXNEXT_WASM_V2_MEMORY_SIZE = OFFS_ERR_PAGE + 0x2000;
export const ZXNEXT_WASM_V2_FLAT_MEMORY_SIZE = 0x10000;
export const ZXNEXT_WASM_V2_KEYBOARD_LINE_COUNT = 8;
export const ZXNEXT_WASM_V2_NEXT_REG_COUNT = 0x100;
export const ZXNEXT_WASM_V2_SCREEN_WIDTH = 720;
export const ZXNEXT_WASM_V2_SCREEN_HEIGHT = 288;

export type ZxNextWasmV2ExportFunction = (...args: number[]) => number;

export type ZxNextWasmV2Exports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  zxnextMemoryPtr: ZxNextWasmV2ExportFunction;
  zxnextPixelBufferPtr: ZxNextWasmV2ExportFunction;
  zxnextKeyboardLinesPtr: ZxNextWasmV2ExportFunction;
  zxnextNextRegsPtr: ZxNextWasmV2ExportFunction;
  zxnextReset: ZxNextWasmV2ExportFunction;
  zxnextHardReset: ZxNextWasmV2ExportFunction;
  zxnextExecuteFrame: ZxNextWasmV2ExportFunction;
  zxnextExecuteInstruction: ZxNextWasmV2ExportFunction;
  zxnextRenderInstantScreen: ZxNextWasmV2ExportFunction;
  zxnextReadMemory: ZxNextWasmV2ExportFunction;
  zxnextWriteMemory: ZxNextWasmV2ExportFunction;
  zxnextReadScreenMemoryOffset: ZxNextWasmV2ExportFunction;
  zxnextSetKeyStatus: ZxNextWasmV2ExportFunction;
  zxnextGetKeyboardLine: ZxNextWasmV2ExportFunction;
  zxnextReadPort: ZxNextWasmV2ExportFunction;
  zxnextWritePort: ZxNextWasmV2ExportFunction;
  zxnextGetMemorySize: ZxNextWasmV2ExportFunction;
  zxnextGetFlatMemorySize: ZxNextWasmV2ExportFunction;
  zxnextGetKeyboardLineCount: ZxNextWasmV2ExportFunction;
  zxnextGetNextRegCount: ZxNextWasmV2ExportFunction;
  zxnextGetScreenWidth: ZxNextWasmV2ExportFunction;
  zxnextGetScreenHeight: ZxNextWasmV2ExportFunction;
  zxnextGetPixelBufferStartOffset: ZxNextWasmV2ExportFunction;
  zxnextGetFrames: ZxNextWasmV2ExportFunction;
  zxnextGetTacts: ZxNextWasmV2ExportFunction;
  zxnextGetCurrentFrameTact: ZxNextWasmV2ExportFunction;
  zxnextGetTactsInFrame: ZxNextWasmV2ExportFunction;
  zxnextGetFrameCompleted: ZxNextWasmV2ExportFunction;
  zxnextSetTacts: ZxNextWasmV2ExportFunction;
  zxnextGetCpuAf: ZxNextWasmV2ExportFunction;
  zxnextSetCpuAf: ZxNextWasmV2ExportFunction;
  zxnextGetCpuBc: ZxNextWasmV2ExportFunction;
  zxnextSetCpuBc: ZxNextWasmV2ExportFunction;
  zxnextGetCpuDe: ZxNextWasmV2ExportFunction;
  zxnextSetCpuDe: ZxNextWasmV2ExportFunction;
  zxnextGetCpuHl: ZxNextWasmV2ExportFunction;
  zxnextSetCpuHl: ZxNextWasmV2ExportFunction;
  zxnextGetCpuAfAlt: ZxNextWasmV2ExportFunction;
  zxnextSetCpuAfAlt: ZxNextWasmV2ExportFunction;
  zxnextGetCpuBcAlt: ZxNextWasmV2ExportFunction;
  zxnextSetCpuBcAlt: ZxNextWasmV2ExportFunction;
  zxnextGetCpuDeAlt: ZxNextWasmV2ExportFunction;
  zxnextSetCpuDeAlt: ZxNextWasmV2ExportFunction;
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
  zxnextGetLastMemoryAddress: ZxNextWasmV2ExportFunction;
  zxnextGetLastMemoryValue: ZxNextWasmV2ExportFunction;
  zxnextGetLastMemoryIsWrite: ZxNextWasmV2ExportFunction;
  zxnextGetLastPortAddress: ZxNextWasmV2ExportFunction;
  zxnextGetLastPortValue: ZxNextWasmV2ExportFunction;
  zxnextGetLastPortIsWrite: ZxNextWasmV2ExportFunction;
  zxnextSetNextRegisterIndex: ZxNextWasmV2ExportFunction;
  zxnextGetNextRegisterIndex: ZxNextWasmV2ExportFunction;
  zxnextSetNextRegisterValue: ZxNextWasmV2ExportFunction;
  zxnextGetNextRegisterValue: ZxNextWasmV2ExportFunction;
  zxnextGetNextRegisterDirect: ZxNextWasmV2ExportFunction;
  zxnextSetNextRegisterDirect: ZxNextWasmV2ExportFunction;
  zxnextGetPortFeValue: ZxNextWasmV2ExportFunction;
  zxnextGetBorderColor: ZxNextWasmV2ExportFunction;
  zxnextGetEarBit: ZxNextWasmV2ExportFunction;
  zxnextGetMicBit: ZxNextWasmV2ExportFunction;
  zxnextGetBeeperLevel: ZxNextWasmV2ExportFunction;
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
  readonly flatMemory: Uint8Array;
  readonly pixelBuffer: Uint32Array;
  readonly pixelBufferBytes: Uint8ClampedArray;
  readonly keyboardLines: Uint8Array;
  readonly nextRegs: Uint8Array;
};

const requiredV2Exports = [
  "memory",
  "zxnextMemoryPtr",
  "zxnextPixelBufferPtr",
  "zxnextKeyboardLinesPtr",
  "zxnextNextRegsPtr",
  "zxnextReset",
  "zxnextHardReset",
  "zxnextExecuteFrame",
  "zxnextExecuteInstruction",
  "zxnextRenderInstantScreen",
  "zxnextReadMemory",
  "zxnextWriteMemory",
  "zxnextReadScreenMemoryOffset",
  "zxnextSetKeyStatus",
  "zxnextGetKeyboardLine",
  "zxnextReadPort",
  "zxnextWritePort",
  "zxnextGetMemorySize",
  "zxnextGetFlatMemorySize",
  "zxnextGetKeyboardLineCount",
  "zxnextGetNextRegCount",
  "zxnextGetScreenWidth",
  "zxnextGetScreenHeight",
  "zxnextGetPixelBufferStartOffset",
  "zxnextGetFrames",
  "zxnextGetTacts",
  "zxnextGetCurrentFrameTact",
  "zxnextGetTactsInFrame",
  "zxnextGetFrameCompleted",
  "zxnextSetTacts",
  "zxnextGetCpuAf",
  "zxnextSetCpuAf",
  "zxnextGetCpuBc",
  "zxnextSetCpuBc",
  "zxnextGetCpuDe",
  "zxnextSetCpuDe",
  "zxnextGetCpuHl",
  "zxnextSetCpuHl",
  "zxnextGetCpuAfAlt",
  "zxnextSetCpuAfAlt",
  "zxnextGetCpuBcAlt",
  "zxnextSetCpuBcAlt",
  "zxnextGetCpuDeAlt",
  "zxnextSetCpuDeAlt",
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
  "zxnextGetLastMemoryAddress",
  "zxnextGetLastMemoryValue",
  "zxnextGetLastMemoryIsWrite",
  "zxnextGetLastPortAddress",
  "zxnextGetLastPortValue",
  "zxnextGetLastPortIsWrite",
  "zxnextSetNextRegisterIndex",
  "zxnextGetNextRegisterIndex",
  "zxnextSetNextRegisterValue",
  "zxnextGetNextRegisterValue",
  "zxnextGetNextRegisterDirect",
  "zxnextSetNextRegisterDirect",
  "zxnextGetPortFeValue",
  "zxnextGetBorderColor",
  "zxnextGetEarBit",
  "zxnextGetMicBit",
  "zxnextGetBeeperLevel",
  "zxnextGetDiagnosticFlags"
] as const;

export function resetZxNextWasmV2ModuleCache(): void {
  // Intentionally empty while this scaffold is changing rapidly during migration.
}

export async function loadZxNextWasmV2(options: ZxNextWasmV2LoaderOptions = {}): Promise<ZxNextWasmV2Runtime> {
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
  const memorySize = exports.zxnextGetMemorySize();
  const flatMemorySize = exports.zxnextGetFlatMemorySize();
  const keyboardLineCount = exports.zxnextGetKeyboardLineCount();
  const nextRegCount = exports.zxnextGetNextRegCount();
  const screenWidth = exports.zxnextGetScreenWidth();
  const screenHeight = exports.zxnextGetScreenHeight();
  const pixelWords = screenWidth * screenHeight;
  const pixelBytes = pixelWords * 4;

  assertExpectedSize(artifactName, "memory", memorySize, ZXNEXT_WASM_V2_MEMORY_SIZE);
  assertExpectedSize(artifactName, "flatMemory", flatMemorySize, ZXNEXT_WASM_V2_FLAT_MEMORY_SIZE);
  assertExpectedSize(artifactName, "keyboardLines", keyboardLineCount, ZXNEXT_WASM_V2_KEYBOARD_LINE_COUNT);
  assertExpectedSize(artifactName, "nextRegs", nextRegCount, ZXNEXT_WASM_V2_NEXT_REG_COUNT);
  assertExpectedSize(artifactName, "screenWidth", screenWidth, ZXNEXT_WASM_V2_SCREEN_WIDTH);
  assertExpectedSize(artifactName, "screenHeight", screenHeight, ZXNEXT_WASM_V2_SCREEN_HEIGHT);
  assertViewRange(artifactName, "memory", exports.zxnextMemoryPtr(), memorySize, memoryBuffer);
  assertViewRange(artifactName, "flatMemory", exports.zxnextMemoryPtr(), flatMemorySize, memoryBuffer);
  assertViewRange(artifactName, "pixelBuffer", exports.zxnextPixelBufferPtr(), pixelBytes, memoryBuffer);
  assertViewRange(artifactName, "keyboardLines", exports.zxnextKeyboardLinesPtr(), keyboardLineCount, memoryBuffer);
  assertViewRange(artifactName, "nextRegs", exports.zxnextNextRegsPtr(), nextRegCount, memoryBuffer);

  return {
    memoryBuffer,
    memory: new Uint8Array(memoryBuffer, exports.zxnextMemoryPtr(), memorySize),
    flatMemory: new Uint8Array(memoryBuffer, exports.zxnextMemoryPtr(), flatMemorySize),
    pixelBuffer: new Uint32Array(memoryBuffer, exports.zxnextPixelBufferPtr(), pixelWords),
    pixelBufferBytes: new Uint8ClampedArray(memoryBuffer, exports.zxnextPixelBufferPtr(), pixelBytes),
    keyboardLines: new Uint8Array(memoryBuffer, exports.zxnextKeyboardLinesPtr(), keyboardLineCount),
    nextRegs: new Uint8Array(memoryBuffer, exports.zxnextNextRegsPtr(), nextRegCount)
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

function assertExpectedSize(
  artifactName: string,
  name: string,
  actual: number,
  expected: number
): void {
  if (actual !== expected) {
    throw new Error(
      `ZX Spectrum Next WASM v2 artifact '${artifactName}' reports ${name} size ${actual}; expected ${expected}.`
    );
  }
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
