/*
 * Loads the Cambridge Z88 WASM core (`dist/cambridge-z88.wasm`, built by
 * `scripts/build-z88-wasm.cjs`): compiles it once per artifact name, instantiates it without imports,
 * checks every export the machine needs, and creates the typed views over the core's buffers.
 *
 * The shape follows `Sp48WasmV2Loader.ts`. See `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`.
 */

export const Z88_WASM_V2_ARTIFACT_NAME = "cambridge-z88.wasm";

/** The 4 MB physical memory: slot N (0-3) at N * $100000, internal RAM at $080000 */
export const Z88_WASM_V2_MEMORY_SIZE = 0x40_0000;

/** The pixel buffer holds the largest LCD: 800 x 480 */
export const Z88_WASM_V2_PIXEL_BUFFER_WORDS = 800 * 480;

export const Z88_WASM_V2_KEYBOARD_LINE_COUNT = 8;

export type Z88WasmV2ExportFunction = (...args: number[]) => number;

export type Z88WasmV2Exports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  // --- Buffers
  z88MemoryPtr: Z88WasmV2ExportFunction;
  z88GetMemorySize: Z88WasmV2ExportFunction;
  z88PixelBufferPtr: Z88WasmV2ExportFunction;
  z88GetPixelBufferCapacity: Z88WasmV2ExportFunction;
  z88AudioSamplesPtr: Z88WasmV2ExportFunction;
  z88GetAudioSampleCapacity: Z88WasmV2ExportFunction;
  z88KeyboardLinesPtr: Z88WasmV2ExportFunction;
  // --- Lifecycle
  z88Reset: Z88WasmV2ExportFunction;
  z88HardReset: Z88WasmV2ExportFunction;
  // --- LCD shape
  z88SetLcdSize: Z88WasmV2ExportFunction;
  z88GetScw: Z88WasmV2ExportFunction;
  z88GetSch: Z88WasmV2ExportFunction;
  z88GetScreenWidth: Z88WasmV2ExportFunction;
  z88GetScreenHeight: Z88WasmV2ExportFunction;
  // --- Timing
  z88GetBaseClockFrequency: Z88WasmV2ExportFunction;
  z88GetTactsInFrame: Z88WasmV2ExportFunction;
  z88GetFrames: Z88WasmV2ExportFunction;
  z88GetTacts: Z88WasmV2ExportFunction;
  // --- CPU
  z88GetCpuAf: Z88WasmV2ExportFunction;
  z88GetCpuBc: Z88WasmV2ExportFunction;
  z88GetCpuDe: Z88WasmV2ExportFunction;
  z88GetCpuHl: Z88WasmV2ExportFunction;
  z88GetCpuPc: Z88WasmV2ExportFunction;
  z88GetCpuSp: Z88WasmV2ExportFunction;
};

export type Z88WasmV2Instance = {
  readonly exports: Z88WasmV2Exports;
};

export type Z88WasmV2ArtifactReader = () => Promise<BufferSource>;
export type Z88WasmV2Compiler = (bytes: BufferSource) => Promise<WebAssembly.Module>;
export type Z88WasmV2Instantiator = (module: WebAssembly.Module) => Promise<Z88WasmV2Instance>;

export type Z88WasmV2LoaderOptions = {
  readonly artifactName?: string;
  readonly readArtifact?: Z88WasmV2ArtifactReader;
  readonly compile?: Z88WasmV2Compiler;
  readonly instantiate?: Z88WasmV2Instantiator;
};

export type Z88WasmV2Views = {
  readonly memoryBuffer: ArrayBuffer;
  /** The 4 MB physical memory */
  readonly memory: Uint8Array;
  /** The whole pixel buffer (800 x 480 words); the LCD uses its first width x height words */
  readonly pixelBuffer: Uint32Array;
  /** The same pixel buffer as RGBA bytes, for the renderer's zero-copy path */
  readonly pixelBufferBytes: Uint8ClampedArray;
  readonly keyboardLines: Uint8Array;
  /** Interleaved left/right int16 samples */
  readonly audioSamples: Int16Array;
};

export type Z88WasmV2Runtime = Z88WasmV2Views & {
  readonly artifactName: string;
  readonly module: WebAssembly.Module;
  readonly instance: Z88WasmV2Instance;
  readonly exports: Z88WasmV2Exports;
};

/** Every export the machine needs; the build's allow-list must contain all of them */
export const z88WasmV2RequiredExports = [
  "memory",
  "z88MemoryPtr",
  "z88GetMemorySize",
  "z88PixelBufferPtr",
  "z88GetPixelBufferCapacity",
  "z88AudioSamplesPtr",
  "z88GetAudioSampleCapacity",
  "z88KeyboardLinesPtr",
  "z88Reset",
  "z88HardReset",
  "z88SetLcdSize",
  "z88GetScw",
  "z88GetSch",
  "z88GetScreenWidth",
  "z88GetScreenHeight",
  "z88GetBaseClockFrequency",
  "z88GetTactsInFrame",
  "z88GetFrames",
  "z88GetTacts",
  "z88GetCpuAf",
  "z88GetCpuBc",
  "z88GetCpuDe",
  "z88GetCpuHl",
  "z88GetCpuPc",
  "z88GetCpuSp"
] as const satisfies readonly (keyof Z88WasmV2Exports)[];

let cachedModule: WebAssembly.Module | undefined;
let cachedArtifactName: string | undefined;

/** Forgets the compiled module, so the next load reads and compiles the artifact again */
export function resetZ88WasmV2ModuleCache(): void {
  cachedModule = undefined;
  cachedArtifactName = undefined;
}

/**
 * Loads the Z88 WASM core: a fresh instance (its own linear memory) of the cached compiled module.
 */
export async function loadZ88WasmV2(options: Z88WasmV2LoaderOptions = {}): Promise<Z88WasmV2Runtime> {
  const artifactName = options.artifactName ?? Z88_WASM_V2_ARTIFACT_NAME;
  const module = await getCompiledModule(artifactName, options);
  const instantiate = options.instantiate ?? defaultInstantiate;
  const instance = await instantiate(module);
  const wasmExports = instance.exports;

  validateZ88WasmV2Exports(wasmExports, artifactName);
  return {
    artifactName,
    module,
    instance,
    exports: wasmExports,
    ...createZ88WasmV2Views(wasmExports, artifactName)
  };
}

/** Throws when an export the machine needs is missing */
export function validateZ88WasmV2Exports(
  exports: Partial<Z88WasmV2Exports>,
  artifactName = Z88_WASM_V2_ARTIFACT_NAME
): void {
  for (const exportName of z88WasmV2RequiredExports) {
    if (exportName === "memory") {
      if (!(exports.memory instanceof WebAssembly.Memory)) {
        throw new Error(`Cambridge Z88 WASM artifact '${artifactName}' is missing WebAssembly memory.`);
      }
      continue;
    }
    if (typeof exports[exportName] !== "function") {
      throw new Error(`Cambridge Z88 WASM artifact '${artifactName}' is missing export '${exportName}'.`);
    }
  }
}

/** Creates the typed views over the core's buffers, checking that each lies inside linear memory */
export function createZ88WasmV2Views(
  exports: Z88WasmV2Exports,
  artifactName = Z88_WASM_V2_ARTIFACT_NAME
): Z88WasmV2Views {
  const memoryBuffer = exports.memory.buffer;
  const memorySize = exports.z88GetMemorySize();
  const pixelWords = exports.z88GetPixelBufferCapacity();
  const audioWords = exports.z88GetAudioSampleCapacity() * 2;

  assertViewRange(artifactName, "memory", exports.z88MemoryPtr(), memorySize, memoryBuffer);
  assertViewRange(artifactName, "pixelBuffer", exports.z88PixelBufferPtr(), pixelWords * 4, memoryBuffer);
  assertViewRange(
    artifactName,
    "keyboardLines",
    exports.z88KeyboardLinesPtr(),
    Z88_WASM_V2_KEYBOARD_LINE_COUNT,
    memoryBuffer
  );
  assertViewRange(artifactName, "audioSamples", exports.z88AudioSamplesPtr(), audioWords * 2, memoryBuffer);

  return {
    memoryBuffer,
    memory: new Uint8Array(memoryBuffer, exports.z88MemoryPtr(), memorySize),
    pixelBuffer: new Uint32Array(memoryBuffer, exports.z88PixelBufferPtr(), pixelWords),
    pixelBufferBytes: new Uint8ClampedArray(memoryBuffer, exports.z88PixelBufferPtr(), pixelWords * 4),
    keyboardLines: new Uint8Array(memoryBuffer, exports.z88KeyboardLinesPtr(), Z88_WASM_V2_KEYBOARD_LINE_COUNT),
    audioSamples: new Int16Array(memoryBuffer, exports.z88AudioSamplesPtr(), audioWords)
  };
}

async function getCompiledModule(artifactName: string, options: Z88WasmV2LoaderOptions): Promise<WebAssembly.Module> {
  if (cachedModule != null && cachedArtifactName === artifactName) {
    return cachedModule;
  }
  const readArtifact = options.readArtifact ?? (() => defaultReadArtifact(artifactName));
  const compile = options.compile ?? WebAssembly.compile;
  const bytes = await readArtifact();
  const module = await compile(bytes);
  cachedModule = module;
  cachedArtifactName = artifactName;
  return module;
}

async function defaultReadArtifact(artifactName: string): Promise<ArrayBuffer> {
  // Built via new URL("./dist/" + artifactName, import.meta.url), which is Vite's supported
  // dynamic-asset-URL pattern. In a production build Vite content-hashes the emitted file
  // (e.g. '...-<hash>.wasm'), so the resolved URL will NOT end with the literal artifactName -
  // that is expected. A genuinely missing artifact is reported by the fetch() checks below.
  const artifactUrl = new URL(`./dist/${artifactName}`, import.meta.url);

  let response: Response;
  try {
    response = await fetch(artifactUrl);
  } catch (err) {
    throw new Error(
      `Cannot load Cambridge Z88 WASM artifact '${artifactName}' from ${artifactUrl.toString()}: ` +
        `${err instanceof Error ? err.message : String(err)}. The packaged app may be missing its compiled WASM binaries.`
    );
  }
  if (!response.ok) {
    throw new Error(
      `Cannot load Cambridge Z88 WASM artifact from ${artifactUrl.toString()} (${response.status} ${response.statusText}).`
    );
  }
  return response.arrayBuffer();
}

async function defaultInstantiate(module: WebAssembly.Module): Promise<Z88WasmV2Instance> {
  const instance = await WebAssembly.instantiate(module, {});
  return { exports: instance.exports as Z88WasmV2Exports };
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
      `Cambridge Z88 WASM artifact '${artifactName}' exposes ${name} outside WASM memory: offset ${offset}, length ${byteLength}, memory ${memoryBuffer.byteLength}.`
    );
  }
}
