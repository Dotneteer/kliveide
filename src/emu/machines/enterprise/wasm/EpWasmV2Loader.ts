/*
 * Loads the Enterprise 64/128 WASM core (`dist/ep.wasm`, built by `scripts/build-ep-wasm.cjs`):
 * compiles it once per artifact name, instantiates it without imports, checks every export the machine
 * needs, and creates the typed views over the core's buffers. The shape follows `TvcWasmV2Loader.ts`.
 * See `.plans/ENTERPRISE_PLAN.md`.
 */

import { WASM_CORE_CONDITION_PLAN_WORDS } from "@emu/machines/wasmDebugLoopLayout";
import { CONDITION_CORE_EXPORTS, type ConditionCoreExports } from "@emu/machines/conditionStore";
import { Z80_HISTORY_CORE_EXPORTS, type Z80HistoryCoreExports } from "@emu/machines/history/WasmHistoryReader";
import { WASM_ACCESS_LOG_CAPACITY } from "@emu/machines/wasmAccessLog";

export const EP_WASM_V2_ARTIFACT_NAME = "ep.wasm";

export const EP_WASM_V2_KEYBOARD_LINE_COUNT = 16;
export const EP_WASM_V2_SEGMENT_SIZE = 0x4000;

export type EpWasmV2ExportFunction = (...args: number[]) => number;

export type EpWasmV2Exports = WebAssembly.Exports &
  ConditionCoreExports &
  Z80HistoryCoreExports & {
    memory: WebAssembly.Memory;
  } & {
    [Name in Exclude<
      (typeof epWasmV2RequiredExports)[number],
      "memory" | (typeof CONDITION_CORE_EXPORTS)[number] | (typeof Z80_HISTORY_CORE_EXPORTS)[number]
    >]: EpWasmV2ExportFunction;
  };

export type EpWasmV2Instance = {
  readonly exports: EpWasmV2Exports;
};

export type EpWasmV2LoaderOptions = {
  readonly artifactName?: string;
  readonly readArtifact?: () => Promise<BufferSource>;
  readonly compile?: (bytes: BufferSource) => Promise<WebAssembly.Module>;
  readonly instantiate?: (module: WebAssembly.Module) => Promise<EpWasmV2Instance>;
};

export type EpWasmV2Views = {
  readonly memoryBuffer: ArrayBuffer;
  /** The physical memory: the ROM segments, the RAM and an FFh segment for the empty ones (`epMachineInfo.ts`) */
  readonly memory: Uint8Array;
  /** EXOS, segments 00h-01h (32K) */
  readonly exosRom: Uint8Array;
  /** The cartridge, segment 04h (16K) */
  readonly cartRom: Uint8Array;
  /** Klive's FILE: ROM, segment 10h (16K) */
  readonly fileIoRom: Uint8Array;
  /** EXDOS, segments 20h-21h (32K) */
  readonly exdosRom: Uint8Array;
  /** The TV picture, 736 x 288 */
  readonly pixelBuffer: Uint32Array;
  readonly pixelBufferBytes: Uint8ClampedArray;
  /** The keyboard matrix rows (a set bit is a pressed key) */
  readonly keyboardLines: Uint8Array;
  /** The current frame's audio samples: left and right doubles, `epGetAudioSampleCount` of them */
  readonly audioSamples: Float64Array;
  /** The shared core's per-instruction data-access log */
  readonly accessLog: Uint32Array;
  /** The debugger's breakpoint flags, one word per address (`DebugSupport.breakpointFlags`) */
  readonly breakpointFlags: Uint16Array;
  /** The debugger's condition plan (`z80-debug-loop.c`, `WASM_CORE_CONDITION_PLAN_WORDS` words) */
  readonly condPlan: Uint32Array;
};

export type EpWasmV2Runtime = EpWasmV2Views & {
  readonly artifactName: string;
  readonly module: WebAssembly.Module;
  readonly instance: EpWasmV2Instance;
  readonly exports: EpWasmV2Exports;
};

/** Every export the machine needs; the build's allow-list (`build-ep-wasm.cjs`) must contain all of them */
export const epWasmV2RequiredExports = [
  "memory",
  "epAudioSamplesPtr",
  "epBreakpointFlagsPtr",
  "epCartRomPtr",
  "epCondPlanPtr",
  "epConfigure",
  "epExdosRomPtr",
  "epExecuteFrame",
  "epExecuteInstruction",
  "epExecuteUntilStop",
  "epExosRomPtr",
  "epFileIoRomPtr",
  "epGetAccessLogCount",
  "epGetAccessLogPtr",
  "epGetAudioOverflows",
  "epGetAudioSampleCapacity",
  "epGetAudioSampleCount",
  "epGetAudioSampleRate",
  "epGetB4",
  "epGetBaseClockFrequency",
  "epGetBf",
  "epGetClockMultiplier",
  "epGetCpuAf",
  "epGetCpuAfAlt",
  "epGetCpuBc",
  "epGetCpuBcAlt",
  "epGetCpuDe",
  "epGetCpuDeAlt",
  "epGetCpuHalted",
  "epGetCpuHl",
  "epGetCpuHlAlt",
  "epGetCpuIff1",
  "epGetCpuIff2",
  "epGetCpuInterruptMode",
  "epGetCpuIr",
  "epGetCpuIx",
  "epGetCpuIy",
  "epGetChannelOutputs",
  "epGetCpuOpCode",
  "epGetPoly",
  "epGetSideLevel",
  "epGetCpuPc",
  "epGetCpuPrefix",
  "epGetCpuSp",
  "epGetCpuWz",
  "epGetDaveRegister",
  "epGetDebugOpStart",
  "epGetFrameCompleted",
  "epGetFrameTacts",
  "epGetFrames",
  "epGetHalfClock",
  "epGetIntEnable",
  "epGetIntLatch",
  "epGetInterruptDepth",
  "epGetIs128",
  "epGetKeyboardLine",
  "epGetLastPortAddress",
  "epGetLastPortIsWrite",
  "epGetLastPortValue",
  "epGetMemoryCapacity",
  "epGetNickSlotPhase",
  "epGetOpStartAddress",
  "epGetPageRegister",
  "epGetPhysicalAddress",
  "epGetPixelBufferCapacity",
  "epGetPortB5",
  "epGetScreenHeight",
  "epGetScreenWidth",
  "epGetSegmentBase",
  "epGetStepOutAddress",
  "epGetTacts",
  "epGetTactsInCurrentFrame",
  "epGetTactsInFrame",
  "epHardReset",
  "epKeyboardLinesPtr",
  "epMemoryPtr",
  "epNickGetDataBus",
  "epNickGetLd1",
  "epNickGetLd2",
  "epNickGetLine",
  "epNickGetLinesLeft",
  "epNickGetLpbByte",
  "epNickGetLptAddress",
  "epNickGetLptBase",
  "epNickGetPort",
  "epNickGetRgb",
  "epNickGetSlot",
  "epNickGetSyncSlot",
  "epNickSetLinearPalette",
  "epIsVideoSignalLost",
  "epNickGetState",
  "epNickSetSeed",
  "epPixelBufferPtr",
  "epReadMemory",
  "epReadPhysical",
  "epReadPort",
  "epReset",
  "epSetAudioSampleRate",
  "epSetCpuAf",
  "epSetCpuAfAlt",
  "epSetCpuBc",
  "epSetCpuBcAlt",
  "epSetCpuDe",
  "epSetCpuDeAlt",
  "epSetCpuHl",
  "epSetCpuHlAlt",
  "epSetCpuIff1",
  "epSetCpuIff2",
  "epSetCpuInterruptMode",
  "epSetCpuIr",
  "epSetCpuIx",
  "epSetCpuIy",
  "epSetCpuPc",
  "epSetCpuSp",
  "epSetCpuWz",
  "epSetJoystickJ",
  "epSetKeyStatus",
  "epSetNickSlotPhase",
  "epSetTacts",
  "epSetTargetClockMultiplier",
  "epWriteMemory",
  "epWritePort",
  // --- Last: the breakpoint condition evaluator, identical in every Z80 core
  ...CONDITION_CORE_EXPORTS,
  // --- The execution-history recorder, identical in every core that records history
  ...Z80_HISTORY_CORE_EXPORTS
] as const;

let cachedModule: WebAssembly.Module | undefined;
let cachedArtifactName: string | undefined;

/** Forgets the compiled module, so the next load reads and compiles the artifact again */
export function resetEpWasmV2ModuleCache(): void {
  cachedModule = undefined;
  cachedArtifactName = undefined;
}

/** Loads the core: a fresh instance (its own linear memory) of the cached compiled module */
export async function loadEpWasmV2(options: EpWasmV2LoaderOptions = {}): Promise<EpWasmV2Runtime> {
  const artifactName = options.artifactName ?? EP_WASM_V2_ARTIFACT_NAME;
  const module = await getCompiledModule(artifactName, options);
  const instantiate = options.instantiate ?? defaultInstantiate;
  const instance = await instantiate(module);
  const wasmExports = instance.exports;
  validateEpWasmV2Exports(wasmExports, artifactName);
  return {
    artifactName,
    module,
    instance,
    exports: wasmExports,
    ...createEpWasmV2Views(wasmExports, artifactName)
  };
}

/** Throws when an export the machine needs is missing */
export function validateEpWasmV2Exports(
  exports: Partial<EpWasmV2Exports>,
  artifactName = EP_WASM_V2_ARTIFACT_NAME
): void {
  for (const exportName of epWasmV2RequiredExports) {
    if (exportName === "memory") {
      if (!(exports.memory instanceof WebAssembly.Memory)) {
        throw new Error(`Enterprise WASM artifact '${artifactName}' is missing WebAssembly memory.`);
      }
      continue;
    }
    if (typeof exports[exportName] !== "function") {
      throw new Error(`Enterprise WASM artifact '${artifactName}' is missing export '${exportName}'.`);
    }
  }
}

/** Creates the typed views over the core's buffers, checking that each lies inside linear memory */
export function createEpWasmV2Views(exports: EpWasmV2Exports, artifactName = EP_WASM_V2_ARTIFACT_NAME): EpWasmV2Views {
  const memoryBuffer = exports.memory.buffer;
  const memorySize = exports.epGetMemoryCapacity();
  const pixelWords = exports.epGetPixelBufferCapacity();
  const check = (name: string, offset: number, byteLength: number) =>
    assertViewRange(artifactName, name, offset, byteLength, memoryBuffer);
  check("memory", exports.epMemoryPtr(), memorySize);
  check("exosRom", exports.epExosRomPtr(), 2 * EP_WASM_V2_SEGMENT_SIZE);
  check("cartRom", exports.epCartRomPtr(), EP_WASM_V2_SEGMENT_SIZE);
  check("fileIoRom", exports.epFileIoRomPtr(), EP_WASM_V2_SEGMENT_SIZE);
  check("exdosRom", exports.epExdosRomPtr(), 2 * EP_WASM_V2_SEGMENT_SIZE);
  check("pixelBuffer", exports.epPixelBufferPtr(), pixelWords * 4);
  check("keyboardLines", exports.epKeyboardLinesPtr(), EP_WASM_V2_KEYBOARD_LINE_COUNT);
  const audioDoubles = exports.epGetAudioSampleCapacity() * 2;
  check("audioSamples", exports.epAudioSamplesPtr(), audioDoubles * 8);
  check("accessLog", exports.epGetAccessLogPtr(), WASM_ACCESS_LOG_CAPACITY * 4);
  check("breakpointFlags", exports.epBreakpointFlagsPtr(), 0x1_0000 * 2);
  check("condPlan", exports.epCondPlanPtr(), WASM_CORE_CONDITION_PLAN_WORDS * 4);
  return {
    memoryBuffer,
    memory: new Uint8Array(memoryBuffer, exports.epMemoryPtr(), memorySize),
    exosRom: new Uint8Array(memoryBuffer, exports.epExosRomPtr(), 2 * EP_WASM_V2_SEGMENT_SIZE),
    cartRom: new Uint8Array(memoryBuffer, exports.epCartRomPtr(), EP_WASM_V2_SEGMENT_SIZE),
    fileIoRom: new Uint8Array(memoryBuffer, exports.epFileIoRomPtr(), EP_WASM_V2_SEGMENT_SIZE),
    exdosRom: new Uint8Array(memoryBuffer, exports.epExdosRomPtr(), 2 * EP_WASM_V2_SEGMENT_SIZE),
    pixelBuffer: new Uint32Array(memoryBuffer, exports.epPixelBufferPtr(), pixelWords),
    pixelBufferBytes: new Uint8ClampedArray(memoryBuffer, exports.epPixelBufferPtr(), pixelWords * 4),
    keyboardLines: new Uint8Array(memoryBuffer, exports.epKeyboardLinesPtr(), EP_WASM_V2_KEYBOARD_LINE_COUNT),
    audioSamples: new Float64Array(memoryBuffer, exports.epAudioSamplesPtr(), audioDoubles),
    accessLog: new Uint32Array(memoryBuffer, exports.epGetAccessLogPtr(), WASM_ACCESS_LOG_CAPACITY),
    breakpointFlags: new Uint16Array(memoryBuffer, exports.epBreakpointFlagsPtr(), 0x1_0000),
    condPlan: new Uint32Array(memoryBuffer, exports.epCondPlanPtr(), WASM_CORE_CONDITION_PLAN_WORDS)
  };
}

async function getCompiledModule(artifactName: string, options: EpWasmV2LoaderOptions): Promise<WebAssembly.Module> {
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
      `Cannot load Enterprise WASM artifact '${artifactName}' from ${artifactUrl.toString()}: ` +
        `${err instanceof Error ? err.message : String(err)}. The packaged app may be missing its compiled WASM binaries.`
    );
  }
  if (!response.ok) {
    throw new Error(`Cannot load Enterprise WASM artifact from ${artifactUrl.toString()} (${response.status} ${response.statusText}).`);
  }
  return response.arrayBuffer();
}

async function defaultInstantiate(module: WebAssembly.Module): Promise<EpWasmV2Instance> {
  const instance = await WebAssembly.instantiate(module, {});
  return { exports: instance.exports as EpWasmV2Exports };
}

function assertViewRange(artifactName: string, name: string, offset: number, byteLength: number, memoryBuffer: ArrayBuffer): void {
  if (!Number.isInteger(offset) || offset < 0 || offset + byteLength > memoryBuffer.byteLength) {
    throw new Error(
      `Enterprise WASM artifact '${artifactName}' exposes ${name} outside WASM memory: offset ${offset}, length ${byteLength}, memory ${memoryBuffer.byteLength}.`
    );
  }
}
