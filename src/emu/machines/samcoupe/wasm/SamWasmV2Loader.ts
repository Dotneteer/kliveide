/*
 * Loads the SAM Coupé WASM core (`dist/sam.wasm`, built by `dev/scripts/build-sam-wasm.cjs`): compiles it
 * once per artifact name, instantiates it without imports, checks every export the machine needs, and
 * creates the typed views over the core's buffers. The shape follows `EpWasmV2Loader.ts`.
 * See `dev/plans/SAM_COUPE_PLAN.md`.
 */
import { WASM_CORE_CONDITION_PLAN_WORDS } from "@emu/machines/wasmDebugLoopLayout";
import { CONDITION_CORE_EXPORTS, type ConditionCoreExports } from "@emu/machines/conditionStore";
import { Z80_HISTORY_CORE_EXPORTS, type Z80HistoryCoreExports } from "@emu/machines/history/WasmHistoryReader";
import { WASM_ACCESS_LOG_CAPACITY } from "@emu/machines/wasmAccessLog";
import { audioChannelExportNames, type AudioChannelCoreExports } from "../../wasmAudioChannelMixer";

export const SAM_WASM_V2_ARTIFACT_NAME = "sam.wasm";
export const SAM_WASM_V2_KEYBOARD_LINE_COUNT = 16;
export const SAM_WASM_V2_ROM_SIZE = 0x8000;

export type SamWasmV2ExportFunction = (...args: number[]) => number;

export type SamWasmV2Exports = WebAssembly.Exports &
  ConditionCoreExports &
  AudioChannelCoreExports<"sam"> &
  Z80HistoryCoreExports & {
    memory: WebAssembly.Memory;
  } & {
    [Name in Exclude<
      (typeof samWasmV2RequiredExports)[number],
      "memory" | (typeof CONDITION_CORE_EXPORTS)[number] | (typeof Z80_HISTORY_CORE_EXPORTS)[number]
    >]: SamWasmV2ExportFunction;
  };

export type SamWasmV2Instance = {
  readonly exports: SamWasmV2Exports;
};

export type SamWasmV2LoaderOptions = {
  readonly artifactName?: string;
  readonly readArtifact?: () => Promise<BufferSource>;
  readonly compile?: (bytes: BufferSource) => Promise<WebAssembly.Module>;
  readonly instantiate?: (module: WebAssembly.Module) => Promise<SamWasmV2Instance>;
};

export type SamWasmV2Views = {
  readonly memoryBuffer: ArrayBuffer;
  /** The physical memory: the ROM, the internal and external RAM and an FFh page (`samMachineInfo.ts`) */
  readonly memory: Uint8Array;
  /** The ROM upload area (32K) */
  readonly rom: Uint8Array;
  /** The TV picture, 640 x 288 */
  readonly pixelBuffer: Uint32Array;
  readonly pixelBufferBytes: Uint8ClampedArray;
  /** The keyboard matrix rows (a set bit is a pressed key) */
  readonly keyboardLines: Uint8Array;
  /** The current frame's audio samples: left and right doubles, `samGetAudioSampleCount` of them */
  readonly audioSamples: Float64Array;
  /** The shared core's per-instruction data-access log */
  readonly accessLog: Uint32Array;
  /** The debugger's breakpoint flags, one word per address (`DebugSupport.breakpointFlags`) */
  readonly breakpointFlags: Uint16Array;
  /** The debugger's condition plan (`z80-debug-loop.c`, `WASM_CORE_CONDITION_PLAN_WORDS` words) */
  readonly condPlan: Uint32Array;
  /** The tape's half-periods in Spectrum T-states (`sam-tape.c`) */
  readonly tapeEdges: Uint32Array;
  /** The SAVE recording: MIC half-periods in SAM T-states */
  readonly savedEdges: Uint32Array;
};

export type SamWasmV2Runtime = SamWasmV2Views & {
  readonly artifactName: string;
  readonly module: WebAssembly.Module;
  readonly instance: SamWasmV2Instance;
  readonly exports: SamWasmV2Exports;
};

/** Every export the machine needs; the build's allow-list (`build-sam-wasm.cjs`) must contain all of them */
export const samWasmV2RequiredExports = [
  "memory",
  // --- The audio mixer's gains and taps (`audioChannelTables.ts`)
  ...audioChannelExportNames("sam"),
  "samAudioSamplesPtr",
  "samBreakpointFlagsPtr",
  "samCondPlanPtr",
  "samConfigure",
  "samDiskClearDirty",
  "samDiskDataPtr",
  "samDiskEject",
  "samDiskGetCapacity",
  "samDiskGetCylinders",
  "samDiskGetDirtyRevision",
  "samDiskGetPresent",
  "samDiskGetSectorCount",
  "samDiskGetSectorDirty",
  "samDiskInsert",
  "samDiskSetWriteProtected",
  "samExecuteFrame",
  "samExecuteInstruction",
  "samExecuteUntilStop",
  "samFdcGetBusy",
  "samFdcGetCommand",
  "samFdcGetCylinder",
  "samFdcGetData",
  "samFdcGetMotorOn",
  "samFdcGetSector",
  "samFdcGetSide",
  "samFdcGetTrack",
  "samGetAccessLogCount",
  "samGetAccessLogPtr",
  "samGetAttrLatch",
  "samGetAudioOverflows",
  "samGetAudioSampleCapacity",
  "samGetAudioSampleCount",
  "samGetAudioSampleRate",
  "samGetBaseClockFrequency",
  "samGetBeam",
  "samGetBeeperLevel",
  "samGetBorder",
  "samGetClockMultiplier",
  "samGetClut",
  "samGetContentionMode",
  "samGetContentionWait",
  "samGetCpuAf",
  "samGetCpuAfAlt",
  "samGetCpuBc",
  "samGetCpuBcAlt",
  "samGetCpuDe",
  "samGetCpuDeAlt",
  "samGetCpuHalted",
  "samGetCpuHl",
  "samGetCpuHlAlt",
  "samGetCpuIff1",
  "samGetCpuIff2",
  "samGetCpuInterruptMode",
  "samGetCpuIr",
  "samGetCpuIx",
  "samGetCpuIy",
  "samGetCpuOpCode",
  "samGetCpuPc",
  "samGetCpuPrefix",
  "samGetCpuSp",
  "samGetCpuWz",
  "samGetDebugOpStart",
  "samGetExtPages",
  "samGetFlashCounter",
  "samGetFrameCompleted",
  "samGetFrameStart",
  "samGetFrameTacts",
  "samGetFrames",
  "samGetHepr",
  "samGetHmpr",
  "samGetInterruptDepth",
  "samGetKeyboardLine",
  "samGetLastPortAddress",
  "samGetLastPortIsWrite",
  "samGetLastPortValue",
  "samGetLepr",
  "samGetLineRegister",
  "samGetLmpr",
  "samGetMemoryCapacity",
  "samGetMidiData",
  "samGetOpStartAddress",
  "samGetPaletteRgb",
  "samGetPhysicalAddress",
  "samGetPixelBufferCapacity",
  "samGetRamPages",
  "samGetScreenHeight",
  "samGetScreenOff",
  "samGetScreenWidth",
  "samGetSectionBase",
  "samGetSectionFlags",
  "samGetStatus",
  "samGetStepOutAddress",
  "samGetTacts",
  "samGetTactsInFrame",
  "samGetVmpr",
  "samHardReset",
  "samKeyboardLinesPtr",
  "samMemoryPtr",
  "samMouseGetIndex",
  "samMouseMove",
  "samMouseSetButtons",
  "samPixelBufferPtr",
  "samReadMemory",
  "samReadPage",
  "samReadPort",
  "samReset",
  "samRomPtr",
  "samSaaGetAddress",
  "samSaaGetEnvelope",
  "samSaaGetLevel",
  "samSaaGetLfsr",
  "samSaaGetOctave",
  "samSaaGetOffset",
  "samSaaGetOutputs",
  "samSaaGetRegister",
  "samSetAudioSampleRate",
  "samSetCpuAf",
  "samSetCpuAfAlt",
  "samSetCpuBc",
  "samSetCpuBcAlt",
  "samSetCpuDe",
  "samSetCpuDeAlt",
  "samSetCpuHl",
  "samSetCpuHlAlt",
  "samSetCpuIff1",
  "samSetCpuIff2",
  "samSetCpuInterruptMode",
  "samSetCpuIr",
  "samSetCpuIx",
  "samSetCpuIy",
  "samSetCpuPc",
  "samSetCpuSp",
  "samSetCpuWz",
  "samSetFrameTact",
  "samSetKeyStatus",
  "samSetTacts",
  "samSetTargetClockMultiplier",
  "samTapeEdgesPtr",
  "samTapeGetCapacity",
  "samTapeGetLevel",
  "samTapeGetPlaying",
  "samTapeGetPosition",
  "samTapeGetSavedLength",
  "samTapeGetSavedRevision",
  "samTapePlay",
  "samTapeRewind",
  "samTapeSavedPtr",
  "samTapeSetAuto",
  "samTapeSetLength",
  "samTapeSetRecording",
  "samWriteMemory",
  "samWritePage",
  "samWritePort",
  // --- Last: the breakpoint condition evaluator, identical in every Z80 core
  ...CONDITION_CORE_EXPORTS,
  // --- The execution-history recorder, identical in every core that records history
  ...Z80_HISTORY_CORE_EXPORTS
] as const;

let cachedModule: WebAssembly.Module | undefined;
let cachedArtifactName: string | undefined;

/** Forgets the compiled module, so the next load reads and compiles the artifact again */
export function resetSamWasmV2ModuleCache(): void {
  cachedModule = undefined;
  cachedArtifactName = undefined;
}

/** Loads the core: a fresh instance (its own linear memory) of the cached compiled module */
export async function loadSamWasmV2(options: SamWasmV2LoaderOptions = {}): Promise<SamWasmV2Runtime> {
  const artifactName = options.artifactName ?? SAM_WASM_V2_ARTIFACT_NAME;
  const module = await getCompiledModule(artifactName, options);
  const instantiate = options.instantiate ?? defaultInstantiate;
  const instance = await instantiate(module);
  const wasmExports = instance.exports;
  validateSamWasmV2Exports(wasmExports, artifactName);
  return {
    artifactName,
    module,
    instance,
    exports: wasmExports,
    ...createSamWasmV2Views(wasmExports, artifactName)
  };
}

/** Throws when an export the machine needs is missing */
export function validateSamWasmV2Exports(exports: Partial<SamWasmV2Exports>, artifactName = SAM_WASM_V2_ARTIFACT_NAME): void {
  for (const exportName of samWasmV2RequiredExports) {
    if (exportName === "memory") {
      if (!(exports.memory instanceof WebAssembly.Memory)) {
        throw new Error(`SAM Coupé WASM artifact '${artifactName}' is missing WebAssembly memory.`);
      }
      continue;
    }
    if (typeof exports[exportName] !== "function") {
      throw new Error(`SAM Coupé WASM artifact '${artifactName}' is missing export '${exportName}'.`);
    }
  }
}

/** Creates the typed views over the core's buffers, checking that each lies inside linear memory */
export function createSamWasmV2Views(exports: SamWasmV2Exports, artifactName = SAM_WASM_V2_ARTIFACT_NAME): SamWasmV2Views {
  const memoryBuffer = exports.memory.buffer;
  const memorySize = exports.samGetMemoryCapacity();
  const pixelWords = exports.samGetPixelBufferCapacity();
  const check = (name: string, offset: number, byteLength: number) =>
    assertViewRange(artifactName, name, offset, byteLength, memoryBuffer);
  check("memory", exports.samMemoryPtr(), memorySize);
  check("rom", exports.samRomPtr(), SAM_WASM_V2_ROM_SIZE);
  check("pixelBuffer", exports.samPixelBufferPtr(), pixelWords * 4);
  check("keyboardLines", exports.samKeyboardLinesPtr(), SAM_WASM_V2_KEYBOARD_LINE_COUNT);
  const audioDoubles = exports.samGetAudioSampleCapacity() * 2;
  check("audioSamples", exports.samAudioSamplesPtr(), audioDoubles * 8);
  check("accessLog", exports.samGetAccessLogPtr(), WASM_ACCESS_LOG_CAPACITY * 4);
  check("breakpointFlags", exports.samBreakpointFlagsPtr(), 0x1_0000 * 2);
  check("condPlan", exports.samCondPlanPtr(), WASM_CORE_CONDITION_PLAN_WORDS * 4);
  const tapeWords = exports.samTapeGetCapacity();
  check("tapeEdges", exports.samTapeEdgesPtr(), tapeWords * 4);
  check("savedEdges", exports.samTapeSavedPtr(), 65536 * 4);
  return {
    memoryBuffer,
    memory: new Uint8Array(memoryBuffer, exports.samMemoryPtr(), memorySize),
    rom: new Uint8Array(memoryBuffer, exports.samRomPtr(), SAM_WASM_V2_ROM_SIZE),
    pixelBuffer: new Uint32Array(memoryBuffer, exports.samPixelBufferPtr(), pixelWords),
    pixelBufferBytes: new Uint8ClampedArray(memoryBuffer, exports.samPixelBufferPtr(), pixelWords * 4),
    keyboardLines: new Uint8Array(memoryBuffer, exports.samKeyboardLinesPtr(), SAM_WASM_V2_KEYBOARD_LINE_COUNT),
    audioSamples: new Float64Array(memoryBuffer, exports.samAudioSamplesPtr(), audioDoubles),
    accessLog: new Uint32Array(memoryBuffer, exports.samGetAccessLogPtr(), WASM_ACCESS_LOG_CAPACITY),
    breakpointFlags: new Uint16Array(memoryBuffer, exports.samBreakpointFlagsPtr(), 0x1_0000),
    condPlan: new Uint32Array(memoryBuffer, exports.samCondPlanPtr(), WASM_CORE_CONDITION_PLAN_WORDS),
    tapeEdges: new Uint32Array(memoryBuffer, exports.samTapeEdgesPtr(), tapeWords),
    savedEdges: new Uint32Array(memoryBuffer, exports.samTapeSavedPtr(), 65536)
  };
}

async function getCompiledModule(artifactName: string, options: SamWasmV2LoaderOptions): Promise<WebAssembly.Module> {
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
      `Cannot load SAM Coupé WASM artifact '${artifactName}' from ${artifactUrl.toString()}: ` +
        `${err instanceof Error ? err.message : String(err)}. The packaged app may be missing its compiled WASM binaries.`
    );
  }
  if (!response.ok) {
    throw new Error(`Cannot load SAM Coupé WASM artifact from ${artifactUrl.toString()} (${response.status} ${response.statusText}).`);
  }
  return response.arrayBuffer();
}

async function defaultInstantiate(module: WebAssembly.Module): Promise<SamWasmV2Instance> {
  const instance = await WebAssembly.instantiate(module, {});
  return { exports: instance.exports as SamWasmV2Exports };
}

function assertViewRange(artifactName: string, name: string, offset: number, byteLength: number, memoryBuffer: ArrayBuffer): void {
  if (!Number.isInteger(offset) || offset < 0 || offset + byteLength > memoryBuffer.byteLength) {
    throw new Error(
      `SAM Coupé WASM artifact '${artifactName}' exposes ${name} outside WASM memory: offset ${offset}, length ${byteLength}, memory ${memoryBuffer.byteLength}.`
    );
  }
}
