/*
 * Loads the Videoton TVC WASM core (`dist/tvc.wasm`, built by `scripts/build-tvc-wasm.cjs`): compiles
 * it once per artifact name, instantiates it without imports, checks every export the machine needs,
 * and creates the typed views over the core's buffers. The shape follows `Ht1080zWasmV2Loader.ts`.
 * See `.plans/VIDEOTON_TVC_PLAN.md`.
 */

import { WASM_CORE_CONDITION_PLAN_WORDS } from "@emu/machines/wasmDebugLoopLayout";
import { CONDITION_CORE_EXPORTS, type ConditionCoreExports } from "@emu/machines/conditionStore";
import { Z80_HISTORY_CORE_EXPORTS, type Z80HistoryCoreExports } from "@emu/machines/history/WasmHistoryReader";
import { WASM_ACCESS_LOG_CAPACITY } from "@emu/machines/wasmAccessLog";

export const TVC_WASM_V2_ARTIFACT_NAME = "tvc.wasm";

export const TVC_WASM_V2_KEYBOARD_LINE_COUNT = 16;
export const TVC_WASM_V2_ROM_BANK_SIZE = 0x4000;
export const TVC_WASM_V2_EXTH_SIZE = 0x2000;

export type TvcWasmV2ExportFunction = (...args: number[]) => number;

export type TvcWasmV2Exports = WebAssembly.Exports &
  ConditionCoreExports &
  Z80HistoryCoreExports & {
    memory: WebAssembly.Memory;
  } & {
    [Name in Exclude<
      (typeof tvcWasmV2RequiredExports)[number],
      "memory" | (typeof CONDITION_CORE_EXPORTS)[number] | (typeof Z80_HISTORY_CORE_EXPORTS)[number]
    >]: TvcWasmV2ExportFunction;
  };

export type TvcWasmV2Instance = {
  readonly exports: TvcWasmV2Exports;
};

export type TvcWasmV2LoaderOptions = {
  readonly artifactName?: string;
  readonly readArtifact?: () => Promise<BufferSource>;
  readonly compile?: (bytes: BufferSource) => Promise<WebAssembly.Module>;
  readonly instantiate?: (module: WebAssembly.Module) => Promise<TvcWasmV2Instance>;
};

export type TvcWasmV2Views = {
  readonly memoryBuffer: ArrayBuffer;
  /** The physical memory: U0-U3, VID0-VID3, SYS, CART, EXTH and the card window (`tvcMachineInfo.ts`) */
  readonly memory: Uint8Array;
  /** The 16K SYS ROM bank */
  readonly sysRom: Uint8Array;
  /** The 8K EXTH ROM */
  readonly exthRom: Uint8Array;
  /** The 16K cartridge ROM (FFh: no cartridge) */
  readonly cartRom: Uint8Array;
  /** The TV picture, 608 x 288 */
  readonly pixelBuffer: Uint32Array;
  readonly pixelBufferBytes: Uint8ClampedArray;
  /** The keyboard matrix rows (a set bit is a pressed key) */
  readonly keyboardLines: Uint8Array;
  /** The current frame's audio samples: left and right doubles, `tvcGetAudioSampleCount` of them */
  readonly audioSamples: Float64Array;
  /** The tape program the core plays (`TvcCasFile.ts`) */
  readonly tapeProgram: Uint32Array;
  /** The blocks of the last SAVE (`tvcSavedFileOf` reads them) */
  readonly savedData: Uint8Array;
  /** The shared core's per-instruction data-access log */
  readonly accessLog: Uint32Array;
  /** The debugger's breakpoint flags, one word per address (`DebugSupport.breakpointFlags`) */
  readonly breakpointFlags: Uint16Array;
  /** The debugger's condition plan (`z80-debug-loop.c`, `WASM_CORE_CONDITION_PLAN_WORDS` words) */
  readonly condPlan: Uint32Array;
};

export type TvcWasmV2Runtime = TvcWasmV2Views & {
  readonly artifactName: string;
  readonly module: WebAssembly.Module;
  readonly instance: TvcWasmV2Instance;
  readonly exports: TvcWasmV2Exports;
};

/** Every export the machine needs; the build's allow-list (`build-tvc-wasm.cjs`) must contain all of them */
export const tvcWasmV2RequiredExports = [
  "memory",
  "tvcBreakpointFlagsPtr",
  "tvcCartRomPtr",
  "tvcCondPlanPtr",
  "tvcConfigure",
  "tvcCrtcGetAddressRegister",
  "tvcCrtcGetCounters",
  "tvcCrtcGetRegister",
  "tvcCrtcGetRowStart",
  "tvcCrtcSetMotorola",
  "tvcExecuteFrame",
  "tvcExecuteInstruction",
  "tvcExecuteUntilStop",
  "tvcExthRomPtr",
  "tvcGetAccessLogCount",
  "tvcGetAccessLogPtr",
  "tvcGetBaseClockFrequency",
  "tvcGetBorder",
  "tvcGetCassetteOut",
  "tvcGetClockMultiplier",
  "tvcGetCpuAf",
  "tvcGetCpuAfAlt",
  "tvcGetCpuBc",
  "tvcGetCpuBcAlt",
  "tvcGetCpuDe",
  "tvcGetCpuDeAlt",
  "tvcGetCpuHalted",
  "tvcGetCpuHl",
  "tvcGetCpuHlAlt",
  "tvcGetCpuIff1",
  "tvcGetCpuIff2",
  "tvcGetCpuInterruptMode",
  "tvcGetCpuIr",
  "tvcGetCpuIx",
  "tvcGetCpuIy",
  "tvcGetCpuOpCode",
  "tvcGetCpuPc",
  "tvcGetCpuPrefix",
  "tvcGetCpuSp",
  "tvcGetCpuWz",
  "tvcGetDebugOpStart",
  "tvcGetDisplayBank",
  "tvcGetFrameCompleted",
  "tvcGetFrameTacts",
  "tvcGetFrames",
  "tvcGetHalfClock",
  "tvcGetInterruptDepth",
  "tvcGetIsPlus",
  "tvcGetItPending",
  "tvcGetKeyboardLine",
  "tvcGetLastPortAddress",
  "tvcGetLastPortIsWrite",
  "tvcGetLastPortValue",
  "tvcGetMemoryCapacity",
  "tvcGetOpStartAddress",
  "tvcGetPalette",
  "tvcGetPhysicalAddress",
  "tvcGetPixelBufferCapacity",
  "tvcGetPort02",
  "tvcGetPort03",
  "tvcGetPort05",
  "tvcGetPort06",
  "tvcGetPort0c",
  "tvcGetScreenHeight",
  "tvcGetScreenWidth",
  "tvcGetStepOutAddress",
  "tvcGetTacts",
  "tvcGetTactsInCurrentFrame",
  "tvcGetTactsInFrame",
  "tvcGetTvPosition",
  "tvcGetVerticalBlank",
  "tvcGetVideoMode",
  "tvcHardReset",
  "tvcIsVideoSignalLost",
  "tvcKeyboardLinesPtr",
  "tvcMemoryPtr",
  "tvcPixelBufferPtr",
  "tvcReadMemory",
  "tvcReadPort",
  "tvcReset",
  "tvcSetColorMonitor",
  "tvcSetCpuAf",
  "tvcSetCpuAfAlt",
  "tvcSetCpuBc",
  "tvcSetCpuBcAlt",
  "tvcSetCpuDe",
  "tvcSetCpuDeAlt",
  "tvcSetCpuHl",
  "tvcSetCpuHlAlt",
  "tvcSetCpuIff1",
  "tvcSetCpuIff2",
  "tvcSetCpuInterruptMode",
  "tvcSetCpuIr",
  "tvcSetCpuIx",
  "tvcSetCpuIy",
  "tvcSetCpuPc",
  "tvcSetCpuSp",
  "tvcSetCpuWz",
  "tvcSetHalfClock",
  "tvcSetKeyStatus",
  "tvcSetTacts",
  "tvcSetTargetClockMultiplier",
  "tvcSysRomPtr",
  "tvcAudioSamplesPtr",
  "tvcGetAudioOverflows",
  "tvcGetAudioSampleCapacity",
  "tvcGetAudioSampleCount",
  "tvcGetAudioSampleRate",
  "tvcGetSoundAmplitude",
  "tvcGetSoundCounter",
  "tvcGetSoundDivisor",
  "tvcSetAudioSampleRate",
  "tvcGetTapeCapacity",
  "tvcTapeGetMotor",
  "tvcTapeGetPlaying",
  "tvcTapeGetPosition",
  "tvcTapeGetSaveCapacity",
  "tvcTapeGetSavedLength",
  "tvcTapeGetSavedRevision",
  "tvcTapeGetSaveDiagnostic",
  "tvcTapeProgramPtr",
  "tvcTapeRewind",
  "tvcTapeSavedDataPtr",
  "tvcTapeSetLength",
  "tvcWriteMemory",
  "tvcWritePort",
  // --- Last: the breakpoint condition evaluator, identical in every Z80 core
  ...CONDITION_CORE_EXPORTS,
  // --- The execution-history recorder, identical in every core that records history
  ...Z80_HISTORY_CORE_EXPORTS
] as const;

let cachedModule: WebAssembly.Module | undefined;
let cachedArtifactName: string | undefined;

/** Forgets the compiled module, so the next load reads and compiles the artifact again */
export function resetTvcWasmV2ModuleCache(): void {
  cachedModule = undefined;
  cachedArtifactName = undefined;
}

/** Loads the core: a fresh instance (its own linear memory) of the cached compiled module */
export async function loadTvcWasmV2(options: TvcWasmV2LoaderOptions = {}): Promise<TvcWasmV2Runtime> {
  const artifactName = options.artifactName ?? TVC_WASM_V2_ARTIFACT_NAME;
  const module = await getCompiledModule(artifactName, options);
  const instantiate = options.instantiate ?? defaultInstantiate;
  const instance = await instantiate(module);
  const wasmExports = instance.exports;
  validateTvcWasmV2Exports(wasmExports, artifactName);
  return {
    artifactName,
    module,
    instance,
    exports: wasmExports,
    ...createTvcWasmV2Views(wasmExports, artifactName)
  };
}

/** Throws when an export the machine needs is missing */
export function validateTvcWasmV2Exports(
  exports: Partial<TvcWasmV2Exports>,
  artifactName = TVC_WASM_V2_ARTIFACT_NAME
): void {
  for (const exportName of tvcWasmV2RequiredExports) {
    if (exportName === "memory") {
      if (!(exports.memory instanceof WebAssembly.Memory)) {
        throw new Error(`TVC WASM artifact '${artifactName}' is missing WebAssembly memory.`);
      }
      continue;
    }
    if (typeof exports[exportName] !== "function") {
      throw new Error(`TVC WASM artifact '${artifactName}' is missing export '${exportName}'.`);
    }
  }
}

/** Creates the typed views over the core's buffers, checking that each lies inside linear memory */
export function createTvcWasmV2Views(exports: TvcWasmV2Exports, artifactName = TVC_WASM_V2_ARTIFACT_NAME): TvcWasmV2Views {
  const memoryBuffer = exports.memory.buffer;
  const memorySize = exports.tvcGetMemoryCapacity();
  const pixelWords = exports.tvcGetPixelBufferCapacity();
  const check = (name: string, offset: number, byteLength: number) =>
    assertViewRange(artifactName, name, offset, byteLength, memoryBuffer);
  check("memory", exports.tvcMemoryPtr(), memorySize);
  check("sysRom", exports.tvcSysRomPtr(), TVC_WASM_V2_ROM_BANK_SIZE);
  check("exthRom", exports.tvcExthRomPtr(), TVC_WASM_V2_EXTH_SIZE);
  check("cartRom", exports.tvcCartRomPtr(), TVC_WASM_V2_ROM_BANK_SIZE);
  check("pixelBuffer", exports.tvcPixelBufferPtr(), pixelWords * 4);
  check("keyboardLines", exports.tvcKeyboardLinesPtr(), TVC_WASM_V2_KEYBOARD_LINE_COUNT);
  const audioDoubles = exports.tvcGetAudioSampleCapacity() * 2;
  const tapeWords = exports.tvcGetTapeCapacity();
  const saveSize = exports.tvcTapeGetSaveCapacity();
  check("audioSamples", exports.tvcAudioSamplesPtr(), audioDoubles * 8);
  check("tapeProgram", exports.tvcTapeProgramPtr(), tapeWords * 4);
  check("savedData", exports.tvcTapeSavedDataPtr(), saveSize);
  check("accessLog", exports.tvcGetAccessLogPtr(), WASM_ACCESS_LOG_CAPACITY * 4);
  check("breakpointFlags", exports.tvcBreakpointFlagsPtr(), 0x1_0000 * 2);
  check("condPlan", exports.tvcCondPlanPtr(), WASM_CORE_CONDITION_PLAN_WORDS * 4);
  return {
    memoryBuffer,
    memory: new Uint8Array(memoryBuffer, exports.tvcMemoryPtr(), memorySize),
    sysRom: new Uint8Array(memoryBuffer, exports.tvcSysRomPtr(), TVC_WASM_V2_ROM_BANK_SIZE),
    exthRom: new Uint8Array(memoryBuffer, exports.tvcExthRomPtr(), TVC_WASM_V2_EXTH_SIZE),
    cartRom: new Uint8Array(memoryBuffer, exports.tvcCartRomPtr(), TVC_WASM_V2_ROM_BANK_SIZE),
    pixelBuffer: new Uint32Array(memoryBuffer, exports.tvcPixelBufferPtr(), pixelWords),
    pixelBufferBytes: new Uint8ClampedArray(memoryBuffer, exports.tvcPixelBufferPtr(), pixelWords * 4),
    keyboardLines: new Uint8Array(memoryBuffer, exports.tvcKeyboardLinesPtr(), TVC_WASM_V2_KEYBOARD_LINE_COUNT),
    audioSamples: new Float64Array(memoryBuffer, exports.tvcAudioSamplesPtr(), audioDoubles),
    tapeProgram: new Uint32Array(memoryBuffer, exports.tvcTapeProgramPtr(), tapeWords),
    savedData: new Uint8Array(memoryBuffer, exports.tvcTapeSavedDataPtr(), saveSize),
    accessLog: new Uint32Array(memoryBuffer, exports.tvcGetAccessLogPtr(), WASM_ACCESS_LOG_CAPACITY),
    breakpointFlags: new Uint16Array(memoryBuffer, exports.tvcBreakpointFlagsPtr(), 0x1_0000),
    condPlan: new Uint32Array(memoryBuffer, exports.tvcCondPlanPtr(), WASM_CORE_CONDITION_PLAN_WORDS)
  };
}

async function getCompiledModule(artifactName: string, options: TvcWasmV2LoaderOptions): Promise<WebAssembly.Module> {
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
      `Cannot load TVC WASM artifact '${artifactName}' from ${artifactUrl.toString()}: ` +
        `${err instanceof Error ? err.message : String(err)}. The packaged app may be missing its compiled WASM binaries.`
    );
  }
  if (!response.ok) {
    throw new Error(`Cannot load TVC WASM artifact from ${artifactUrl.toString()} (${response.status} ${response.statusText}).`);
  }
  return response.arrayBuffer();
}

async function defaultInstantiate(module: WebAssembly.Module): Promise<TvcWasmV2Instance> {
  const instance = await WebAssembly.instantiate(module, {});
  return { exports: instance.exports as TvcWasmV2Exports };
}

function assertViewRange(artifactName: string, name: string, offset: number, byteLength: number, memoryBuffer: ArrayBuffer): void {
  if (!Number.isInteger(offset) || offset < 0 || offset + byteLength > memoryBuffer.byteLength) {
    throw new Error(
      `TVC WASM artifact '${artifactName}' exposes ${name} outside WASM memory: offset ${offset}, length ${byteLength}, memory ${memoryBuffer.byteLength}.`
    );
  }
}
