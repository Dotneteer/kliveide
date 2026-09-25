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
} & {
  [Name in Exclude<(typeof z88WasmV2RequiredExports)[number], "memory">]: Z88WasmV2ExportFunction;
} & {
  /** The RTC test hooks; in the build's allow-list, not required by the loader */
  z88TestResetRtc?: Z88WasmV2ExportFunction;
  z88TestIncrementRtc?: Z88WasmV2ExportFunction;
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
  /**
   * Interleaved left/right samples of the current frame, as doubles in [-1, 1] - the same numbers
   * the TypeScript beeper produces; `z88GetAudioSampleCount()` of them are valid
   */
  readonly audioSamples: Float64Array;
  /** The debugger's breakpoint flags, one word per address (`DebugSupport.breakpointFlags`) */
  readonly breakpointFlags: Uint16Array;
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
  // --- Buffers
  "z88BreakpointFlagsPtr",
  "z88MemoryPtr",
  "z88GetMemorySize",
  "z88PixelBufferPtr",
  "z88GetPixelBufferCapacity",
  "z88AudioSamplesPtr",
  "z88GetAudioSampleCapacity",
  "z88KeyboardLinesPtr",
  // --- Keyboard and sleep
  "z88SetKeyStatus",
  "z88GetKeyLine",
  "z88GetKeyPressed",
  "z88GetSleepMode",
  // --- Audio
  "z88SetAudioSampleRate",
  "z88GetAudioSampleCount",
  "z88GetAudioSampleRate",
  "z88GetAudioOverflows",
  "z88GetOscillatorBit",
  // --- Lifecycle and execution
  "z88Reset",
  "z88HardReset",
  "z88ExecuteFrame",
  "z88ExecuteInstruction",
  "z88ExecuteUntilStop",
  // --- Timing
  "z88GetBaseClockFrequency",
  "z88GetTactsInFrame",
  "z88GetTactsInCurrentFrame",
  "z88GetFrames",
  "z88GetFrameTacts",
  "z88GetFrameCompleted",
  "z88GetTacts",
  "z88SetTacts",
  "z88GetClockMultiplier",
  "z88SetTargetClockMultiplier",
  // --- LCD shape
  "z88SetLcdSize",
  "z88GetScw",
  "z88GetSch",
  "z88GetScreenWidth",
  "z88GetScreenHeight",
  "z88GetLcdSurroundColor",
  // --- Memory and cards
  "z88ReadMemory",
  "z88WriteMemory",
  "z88InsertCard",
  "z88RemoveCard",
  "z88SetInternalRamSize",
  "z88GetSlotCardType",
  "z88GetSlotChipMask",
  "z88GetCardReadArrayMode",
  "z88GetPageBank",
  "z88GetPageOffset",
  "z88GetPageCardType",
  // --- Bus record
  "z88GetBusReadAddress",
  "z88GetBusWriteAddress",
  "z88GetBusReadCount",
  "z88GetBusWriteCount",
  "z88GetBusReadValue",
  "z88GetBusWriteValue",
  "z88GetBusIoReadPort",
  "z88GetBusIoReadValue",
  "z88GetBusIoWritePort",
  "z88GetBusIoWriteValue",
  "z88GetBusFlags",
  "z88GetOpStartAddress",
  // --- Blink
  "z88SignalFlapOpened",
  "z88SignalFlapClosed",
  "z88RaiseBatteryLow",
  "z88ReadPort",
  "z88WritePort",
  "z88GetSr",
  "z88SetSr",
  "z88GetTim",
  "z88GetTsta",
  "z88GetTmk",
  "z88SetTmk",
  "z88GetInt",
  "z88SetInt",
  "z88GetSta",
  "z88SetSta",
  "z88GetCom",
  "z88SetCom",
  "z88GetEpr",
  "z88SetEpr",
  "z88SetTack",
  "z88SetAck",
  "z88GetInterruptSignal",
  "z88GetPb",
  "z88GetSbr",
  "z88GetEarBit",
  // --- CPU and bus events
  "z88GetCpuAf",
  "z88SetCpuAf",
  "z88GetCpuBc",
  "z88SetCpuBc",
  "z88GetCpuDe",
  "z88SetCpuDe",
  "z88GetCpuHl",
  "z88SetCpuHl",
  "z88GetCpuAfAlt",
  "z88SetCpuAfAlt",
  "z88GetCpuBcAlt",
  "z88SetCpuBcAlt",
  "z88GetCpuDeAlt",
  "z88SetCpuDeAlt",
  "z88GetCpuHlAlt",
  "z88SetCpuHlAlt",
  "z88GetCpuIx",
  "z88SetCpuIx",
  "z88GetCpuIy",
  "z88SetCpuIy",
  "z88GetCpuIr",
  "z88SetCpuIr",
  "z88GetCpuWz",
  "z88SetCpuWz",
  "z88GetCpuPc",
  "z88SetCpuPc",
  "z88GetCpuSp",
  "z88SetCpuSp",
  "z88GetCpuIff1",
  "z88SetCpuIff1",
  "z88GetCpuIff2",
  "z88SetCpuIff2",
  "z88GetCpuInterruptMode",
  "z88SetCpuInterruptMode",
  "z88GetCpuHalted",
  "z88GetCpuPrefix",
  "z88GetCpuSnoozed",
  "z88SetCpuSnoozed",
  "z88GetStepOutAddress",
  "z88GetCpuSigInt"
] as const;

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
  assertViewRange(artifactName, "audioSamples", exports.z88AudioSamplesPtr(), audioWords * 8, memoryBuffer);
  assertViewRange(artifactName, "breakpointFlags", exports.z88BreakpointFlagsPtr(), 0x1_0000 * 2, memoryBuffer);

  return {
    memoryBuffer,
    memory: new Uint8Array(memoryBuffer, exports.z88MemoryPtr(), memorySize),
    pixelBuffer: new Uint32Array(memoryBuffer, exports.z88PixelBufferPtr(), pixelWords),
    pixelBufferBytes: new Uint8ClampedArray(memoryBuffer, exports.z88PixelBufferPtr(), pixelWords * 4),
    keyboardLines: new Uint8Array(memoryBuffer, exports.z88KeyboardLinesPtr(), Z88_WASM_V2_KEYBOARD_LINE_COUNT),
    audioSamples: new Float64Array(memoryBuffer, exports.z88AudioSamplesPtr(), audioWords),
    breakpointFlags: new Uint16Array(memoryBuffer, exports.z88BreakpointFlagsPtr(), 0x1_0000)
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
