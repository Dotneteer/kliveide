/*
 * Loads the HT-1080Z WASM core (`dist/ht1080z.wasm`, built by `scripts/build-ht1080z-wasm.cjs`):
 * compiles it once per artifact name, instantiates it without imports, checks every export the
 * machine needs, and creates the typed views over the core's buffers. The shape follows
 * `Ht1080zWasmV2Loader.ts`. See `.plans/HT1080Z_PLAN.md`.
 */

import { WASM_CORE_CONDITION_PLAN_WORDS } from "@emu/machines/wasmDebugLoopLayout";
import { CONDITION_CORE_EXPORTS, type ConditionCoreExports } from "@emu/machines/conditionStore";
import { Z80_HISTORY_CORE_EXPORTS, type Z80HistoryCoreExports } from "@emu/machines/history/WasmHistoryReader";
import { WASM_ACCESS_LOG_CAPACITY } from "@emu/machines/wasmAccessLog";

export const HT1080Z_WASM_V2_ARTIFACT_NAME = "ht1080z.wasm";

export const HT1080Z_WASM_V2_KEYBOARD_LINE_COUNT = 8;

export type Ht1080zWasmV2ExportFunction = (...args: number[]) => number;

export type Ht1080zWasmV2Exports = WebAssembly.Exports &
  ConditionCoreExports & Z80HistoryCoreExports & {
    memory: WebAssembly.Memory;
  } & {
    [Name in Exclude<
      (typeof ht1080zWasmV2RequiredExports)[number],
      "memory" | (typeof CONDITION_CORE_EXPORTS)[number] | (typeof Z80_HISTORY_CORE_EXPORTS)[number]
    >]: Ht1080zWasmV2ExportFunction;
  };

export type Ht1080zWasmV2Instance = {
  readonly exports: Ht1080zWasmV2Exports;
};

export type Ht1080zWasmV2LoaderOptions = {
  readonly artifactName?: string;
  readonly readArtifact?: () => Promise<BufferSource>;
  readonly compile?: (bytes: BufferSource) => Promise<WebAssembly.Module>;
  readonly instantiate?: (module: WebAssembly.Module) => Promise<Ht1080zWasmV2Instance>;
};

export type Ht1080zWasmV2Views = {
  readonly memoryBuffer: ArrayBuffer;
  /** The 64K the CPU addresses: the ROMs at $0000-$37FF, the video RAM at $3C00, the RAM from $4000 */
  readonly memory: Uint8Array;
  /** The ROM upload area, $0000-$37FF of `memory`: the BASIC ($0000-$2FFF) and the extension ($3000-$37FF) */
  readonly rom: Uint8Array;
  /** The character generator: 128 glyphs x 16 rows */
  readonly chargen: Uint8Array;
  /** The picture, 528 x 288 */
  readonly pixelBuffer: Uint32Array;
  readonly pixelBufferBytes: Uint8ClampedArray;
  /** The keyboard matrix rows (a set bit is a pressed key) */
  readonly keyboardLines: Uint8Array;
  /** The current frame's audio samples: left and right doubles, `ht1080zGetAudioSampleCount` of them */
  readonly audioSamples: Float64Array;
  /** The tape image's bytes (a `.cas` bit stream), which the pulse player and the traps read */
  readonly tapeData: Uint8Array;
  /** The bytes of the last SAVE that finished: a `.cas`, leader and sync included */
  readonly savedData: Uint8Array;
  /** The shared core's per-instruction data-access log */
  readonly accessLog: Uint32Array;
  /** The debugger's breakpoint flags, one word per address (`DebugSupport.breakpointFlags`) */
  readonly breakpointFlags: Uint16Array;
  /** The debugger's condition plan (`z80-debug-loop.c`, `WASM_CORE_CONDITION_PLAN_WORDS` words) */
  readonly condPlan: Uint32Array;
};

export type Ht1080zWasmV2Runtime = Ht1080zWasmV2Views & {
  readonly artifactName: string;
  readonly module: WebAssembly.Module;
  readonly instance: Ht1080zWasmV2Instance;
  readonly exports: Ht1080zWasmV2Exports;
};

/** Every export the machine needs; the build's allow-list (`build-ht1080z-wasm.cjs`) must contain all of them */
export const ht1080zWasmV2RequiredExports = [
  "memory",
  "ht1080zBreakpointFlagsPtr",
  "ht1080zChargenPtr",
  "ht1080zCondPlanPtr",
  "ht1080zConfigure",
  "ht1080zExecuteFrame",
  "ht1080zExecuteInstruction",
  "ht1080zExecuteUntilStop",
  "ht1080zGetAccessLogCount",
  "ht1080zGetAccessLogPtr",
  "ht1080zGetBaseClockFrequency",
  "ht1080zGetCassetteLatch",
  "ht1080zGetChargenCapacity",
  "ht1080zGetClockMultiplier",
  "ht1080zGetCpuAf",
  "ht1080zGetCpuAfAlt",
  "ht1080zGetCpuBc",
  "ht1080zGetCpuBcAlt",
  "ht1080zGetCpuDe",
  "ht1080zGetCpuDeAlt",
  "ht1080zGetCpuHalted",
  "ht1080zGetCpuHl",
  "ht1080zGetCpuHlAlt",
  "ht1080zGetCpuIff1",
  "ht1080zGetCpuIff2",
  "ht1080zGetCpuInterruptMode",
  "ht1080zGetCpuIr",
  "ht1080zGetCpuIx",
  "ht1080zGetCpuIy",
  "ht1080zGetCpuOpCode",
  "ht1080zGetCpuPc",
  "ht1080zGetCpuPrefix",
  "ht1080zGetCpuSp",
  "ht1080zGetCpuWz",
  "ht1080zGetDebugOpStart",
  "ht1080zGetFrameCompleted",
  "ht1080zGetFrameTacts",
  "ht1080zGetFrames",
  "ht1080zGetInterruptDepth",
  "ht1080zGetKeyWaitLoops",
  "ht1080zGetKeyboardLine",
  "ht1080zGetLastPortAddress",
  "ht1080zGetLastPortIsWrite",
  "ht1080zGetLastPortValue",
  "ht1080zGetMemoryCapacity",
  "ht1080zGetOpStartAddress",
  "ht1080zGetPixelBufferCapacity",
  "ht1080zGetPortFf",
  "ht1080zGetRamSizeKb",
  "ht1080zGetRecorder2",
  "ht1080zGetRomCapacity",
  "ht1080zGetScreenHeight",
  "ht1080zGetScreenWidth",
  "ht1080zGetStepOutAddress",
  "ht1080zGetTacts",
  "ht1080zGetTactsInCurrentFrame",
  "ht1080zGetTactsInFrame",
  "ht1080zHardReset",
  "ht1080zKeyboardLinesPtr",
  "ht1080zMemoryPtr",
  "ht1080zPixelBufferPtr",
  "ht1080zPressResetKey",
  "ht1080zReadMemory",
  "ht1080zReadPort",
  "ht1080zReset",
  "ht1080zRomPtr",
  "ht1080zSetCassetteLatch",
  "ht1080zSetCpuAf",
  "ht1080zSetCpuAfAlt",
  "ht1080zSetCpuBc",
  "ht1080zSetCpuBcAlt",
  "ht1080zSetCpuDe",
  "ht1080zSetCpuDeAlt",
  "ht1080zSetCpuHl",
  "ht1080zSetCpuHlAlt",
  "ht1080zSetCpuIff1",
  "ht1080zSetCpuIff2",
  "ht1080zSetCpuInterruptMode",
  "ht1080zSetCpuIr",
  "ht1080zSetCpuIx",
  "ht1080zSetCpuIy",
  "ht1080zSetCpuPc",
  "ht1080zSetCpuSp",
  "ht1080zSetCpuWz",
  "ht1080zSetKeyStatus",
  "ht1080zSetTacts",
  "ht1080zSetTargetClockMultiplier",
  "ht1080zGetVideoCut",
  "ht1080zGetVideoDash",
  "ht1080zGetVideoPage",
  "ht1080zRenderToBeam",
  "ht1080zSetVideoCut",
  "ht1080zSetVideoDash",
  "ht1080zSetVideoPage",
  "ht1080zAudioSamplesPtr",
  "ht1080zGetAudioOverflows",
  "ht1080zGetAudioSampleCapacity",
  "ht1080zGetAudioSampleCount",
  "ht1080zGetAudioSampleRate",
  "ht1080zGetBeeperLevel",
  "ht1080zGetPsgCurrentOutput",
  "ht1080zGetPsgRegisterIndex",
  "ht1080zGetPsgRegisterValue",
  "ht1080zGetPsgToneA",
  "ht1080zGetPsgToneB",
  "ht1080zGetPsgToneC",
  "ht1080zGetPsgVolumeA",
  "ht1080zGetPsgVolumeB",
  "ht1080zGetPsgVolumeC",
  "ht1080zReadPsgRegisterValue",
  "ht1080zSetAudioSampleRate",
  "ht1080zGetTapeCapacity",
  "ht1080zTapeDataPtr",
  "ht1080zTapeGetBitPosition",
  "ht1080zTapeGetLengthBits",
  "ht1080zTapeGetMotor",
  "ht1080zTapeGetMotorOverride",
  "ht1080zTapeGetPlaying",
  "ht1080zTapeGetRunning",
  "ht1080zTapeGetSaveCapacity",
  "ht1080zTapeGetSaveOpen",
  "ht1080zTapeGetSavedLength",
  "ht1080zTapeGetSavedRevision",
  "ht1080zTapeGetTraps",
  "ht1080zTapeRewind",
  "ht1080zTapeSavedDataPtr",
  "ht1080zTapeSetFastLoad",
  "ht1080zTapeSetLength",
  "ht1080zTapeSetMotorOverride",
  "ht1080zTapeSetPlaying",
  "ht1080zWriteMemory",
  "ht1080zWritePort",
  // --- Last: the breakpoint condition evaluator, identical in every Z80 core
  ...CONDITION_CORE_EXPORTS,
  // --- The execution-history recorder, identical in every core that records history
  ...Z80_HISTORY_CORE_EXPORTS
] as const;

let cachedModule: WebAssembly.Module | undefined;
let cachedArtifactName: string | undefined;

/** Forgets the compiled module, so the next load reads and compiles the artifact again */
export function resetHt1080zWasmV2ModuleCache(): void {
  cachedModule = undefined;
  cachedArtifactName = undefined;
}

/** Loads the core: a fresh instance (its own linear memory) of the cached compiled module */
export async function loadHt1080zWasmV2(options: Ht1080zWasmV2LoaderOptions = {}): Promise<Ht1080zWasmV2Runtime> {
  const artifactName = options.artifactName ?? HT1080Z_WASM_V2_ARTIFACT_NAME;
  const module = await getCompiledModule(artifactName, options);
  const instantiate = options.instantiate ?? defaultInstantiate;
  const instance = await instantiate(module);
  const wasmExports = instance.exports;
  validateHt1080zWasmV2Exports(wasmExports, artifactName);
  return {
    artifactName,
    module,
    instance,
    exports: wasmExports,
    ...createHt1080zWasmV2Views(wasmExports, artifactName)
  };
}

/** Throws when an export the machine needs is missing */
export function validateHt1080zWasmV2Exports(
  exports: Partial<Ht1080zWasmV2Exports>,
  artifactName = HT1080Z_WASM_V2_ARTIFACT_NAME
): void {
  for (const exportName of ht1080zWasmV2RequiredExports) {
    if (exportName === "memory") {
      if (!(exports.memory instanceof WebAssembly.Memory)) {
        throw new Error(`HT-1080Z WASM artifact '${artifactName}' is missing WebAssembly memory.`);
      }
      continue;
    }
    if (typeof exports[exportName] !== "function") {
      throw new Error(`HT-1080Z WASM artifact '${artifactName}' is missing export '${exportName}'.`);
    }
  }
}

/** Creates the typed views over the core's buffers, checking that each lies inside linear memory */
export function createHt1080zWasmV2Views(
  exports: Ht1080zWasmV2Exports,
  artifactName = HT1080Z_WASM_V2_ARTIFACT_NAME
): Ht1080zWasmV2Views {
  const memoryBuffer = exports.memory.buffer;
  const memorySize = exports.ht1080zGetMemoryCapacity();
  const romSize = exports.ht1080zGetRomCapacity();
  const chargenSize = exports.ht1080zGetChargenCapacity();
  const pixelWords = exports.ht1080zGetPixelBufferCapacity();
  const check = (name: string, offset: number, byteLength: number) =>
    assertViewRange(artifactName, name, offset, byteLength, memoryBuffer);
  check("memory", exports.ht1080zMemoryPtr(), memorySize);
  check("rom", exports.ht1080zRomPtr(), romSize);
  check("chargen", exports.ht1080zChargenPtr(), chargenSize);
  check("pixelBuffer", exports.ht1080zPixelBufferPtr(), pixelWords * 4);
  check("keyboardLines", exports.ht1080zKeyboardLinesPtr(), HT1080Z_WASM_V2_KEYBOARD_LINE_COUNT);
  const audioDoubles = exports.ht1080zGetAudioSampleCapacity() * 2;
  const tapeSize = exports.ht1080zGetTapeCapacity();
  const saveSize = exports.ht1080zTapeGetSaveCapacity();
  check("tapeData", exports.ht1080zTapeDataPtr(), tapeSize);
  check("savedData", exports.ht1080zTapeSavedDataPtr(), saveSize);
  check("audioSamples", exports.ht1080zAudioSamplesPtr(), audioDoubles * 8);
  check("accessLog", exports.ht1080zGetAccessLogPtr(), WASM_ACCESS_LOG_CAPACITY * 4);
  check("breakpointFlags", exports.ht1080zBreakpointFlagsPtr(), 0x1_0000 * 2);
  check("condPlan", exports.ht1080zCondPlanPtr(), WASM_CORE_CONDITION_PLAN_WORDS * 4);
  return {
    memoryBuffer,
    memory: new Uint8Array(memoryBuffer, exports.ht1080zMemoryPtr(), memorySize),
    rom: new Uint8Array(memoryBuffer, exports.ht1080zRomPtr(), romSize),
    chargen: new Uint8Array(memoryBuffer, exports.ht1080zChargenPtr(), chargenSize),
    pixelBuffer: new Uint32Array(memoryBuffer, exports.ht1080zPixelBufferPtr(), pixelWords),
    pixelBufferBytes: new Uint8ClampedArray(memoryBuffer, exports.ht1080zPixelBufferPtr(), pixelWords * 4),
    keyboardLines: new Uint8Array(memoryBuffer, exports.ht1080zKeyboardLinesPtr(), HT1080Z_WASM_V2_KEYBOARD_LINE_COUNT),
    audioSamples: new Float64Array(memoryBuffer, exports.ht1080zAudioSamplesPtr(), audioDoubles),
    tapeData: new Uint8Array(memoryBuffer, exports.ht1080zTapeDataPtr(), tapeSize),
    savedData: new Uint8Array(memoryBuffer, exports.ht1080zTapeSavedDataPtr(), saveSize),
    accessLog: new Uint32Array(memoryBuffer, exports.ht1080zGetAccessLogPtr(), WASM_ACCESS_LOG_CAPACITY),
    breakpointFlags: new Uint16Array(memoryBuffer, exports.ht1080zBreakpointFlagsPtr(), 0x1_0000),
    condPlan: new Uint32Array(memoryBuffer, exports.ht1080zCondPlanPtr(), WASM_CORE_CONDITION_PLAN_WORDS)
  };
}

async function getCompiledModule(artifactName: string, options: Ht1080zWasmV2LoaderOptions): Promise<WebAssembly.Module> {
  if (cachedModule != null && cachedArtifactName === artifactName) {
    return cachedModule;
  }
  const readArtifact = options.readArtifact ?? (() => defaultReadArtifact(artifactName));
  const compile = options.compile ?? WebAssembly.compile;
  const module = await compile(await readArtifact());
  cachedModule = module;
  cachedArtifactName = artifactName;
  return module;
}

async function defaultReadArtifact(artifactName: string): Promise<ArrayBuffer> {
  // --- Vite's dynamic-asset-URL pattern; a production build content-hashes the file name
  const artifactUrl = new URL(`./dist/${artifactName}`, import.meta.url);
  let response: Response;
  try {
    response = await fetch(artifactUrl);
  } catch (err) {
    throw new Error(
      `Cannot load HT-1080Z WASM artifact '${artifactName}' from ${artifactUrl.toString()}: ` +
        `${err instanceof Error ? err.message : String(err)}. The packaged app may be missing its compiled WASM binaries.`
    );
  }
  if (!response.ok) {
    throw new Error(
      `Cannot load HT-1080Z WASM artifact from ${artifactUrl.toString()} (${response.status} ${response.statusText}).`
    );
  }
  return response.arrayBuffer();
}

async function defaultInstantiate(module: WebAssembly.Module): Promise<Ht1080zWasmV2Instance> {
  const instance = await WebAssembly.instantiate(module, {});
  return { exports: instance.exports as Ht1080zWasmV2Exports };
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
      `HT-1080Z WASM artifact '${artifactName}' exposes ${name} outside WASM memory: offset ${offset}, length ${byteLength}, memory ${memoryBuffer.byteLength}.`
    );
  }
}
