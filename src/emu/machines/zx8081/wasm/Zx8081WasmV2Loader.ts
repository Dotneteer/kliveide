/*
 * Loads the Sinclair ZX80/ZX81 WASM core (`dist/zx8081.wasm`, built by `scripts/build-zx8081-wasm.cjs`):
 * compiles it once per artifact name, instantiates it without imports, checks every export the
 * machine needs, and creates the typed views over the core's buffers. The shape follows
 * `Z88WasmV2Loader.ts`. See `.plans/ZX8081_WASM_PLAN.md`.
 */

import { WASM_CORE_CONDITION_PLAN_WORDS } from "@emu/machines/wasmDebugLoopLayout";
import { CONDITION_CORE_EXPORTS, type ConditionCoreExports } from "@emu/machines/conditionStore";
import { Z80_HISTORY_CORE_EXPORTS, type Z80HistoryCoreExports } from "@emu/machines/history/WasmHistoryReader";
import { WASM_ACCESS_LOG_CAPACITY } from "@emu/machines/wasmAccessLog";

export const ZX8081_WASM_V2_ARTIFACT_NAME = "zx8081.wasm";

export const ZX8081_WASM_V2_KEYBOARD_LINE_COUNT = 8;

export type Zx8081WasmV2ExportFunction = (...args: number[]) => number;

export type Zx8081WasmV2Exports = WebAssembly.Exports &
  ConditionCoreExports & Z80HistoryCoreExports & {
    memory: WebAssembly.Memory;
  } & {
    [Name in Exclude<
      (typeof zx8081WasmV2RequiredExports)[number],
      "memory" | (typeof CONDITION_CORE_EXPORTS)[number] | (typeof Z80_HISTORY_CORE_EXPORTS)[number]
    >]: Zx8081WasmV2ExportFunction;
  };

export type Zx8081WasmV2Instance = {
  readonly exports: Zx8081WasmV2Exports;
};

export type Zx8081WasmV2LoaderOptions = {
  readonly artifactName?: string;
  readonly readArtifact?: () => Promise<BufferSource>;
  readonly compile?: (bytes: BufferSource) => Promise<WebAssembly.Module>;
  readonly instantiate?: (module: WebAssembly.Module) => Promise<Zx8081WasmV2Instance>;
};

export type Zx8081WasmV2Views = {
  readonly memoryBuffer: ArrayBuffer;
  /** The ROM image (8K; a 4K ZX80 ROM uses its first half) */
  readonly rom: Uint8Array;
  /** The 64K RAM array (a 1K or 16K machine uses its first 1K or 16K) */
  readonly ram: Uint8Array;
  /** The RAM again, under the name the condition store reads its linear memory through */
  readonly memory: Uint8Array;
  /** The visible picture, 352 pixels wide (288 lines PAL, 240 NTSC) */
  readonly pixelBuffer: Uint32Array;
  readonly pixelBufferBytes: Uint8ClampedArray;
  readonly keyboardLines: Uint8Array;
  /** The tape file bytes (the pulse synthesizer and the fast-load traps read them) */
  readonly tapeData: Uint8Array;
  /** The shared core's per-instruction data-access log */
  readonly accessLog: Uint32Array;
  /** The debugger's breakpoint flags, one word per address (`DebugSupport.breakpointFlags`) */
  readonly breakpointFlags: Uint16Array;
  /** The debugger's condition plan (`z80-debug-loop.c`, `WASM_CORE_CONDITION_PLAN_WORDS` words) */
  readonly condPlan: Uint32Array;
};

export type Zx8081WasmV2Runtime = Zx8081WasmV2Views & {
  readonly artifactName: string;
  readonly module: WebAssembly.Module;
  readonly instance: Zx8081WasmV2Instance;
  readonly exports: Zx8081WasmV2Exports;
};

/** Every export the machine needs; the build's allow-list (`build-zx8081-wasm.cjs`) must contain all of them */
export const zx8081WasmV2RequiredExports = [
  "memory",
  "zx8081ArmAutoRun",
  "zx8081BreakpointFlagsPtr",
  "zx8081Configure",
  "zx8081ExecuteFrame",
  "zx8081ExecuteInstruction",
  "zx8081ExecuteUntilStop",
  "zx8081GetDebugOpStart",
  "zx8081CondPlanPtr",
  "zx8081GetAccessLogCount",
  "zx8081GetAccessLogPtr",
  "zx8081GetBaseClockFrequency",
  "zx8081GetBeamY",
  "zx8081GetClockMultiplier",
  "zx8081GetCpuAf",
  "zx8081GetCpuAfAlt",
  "zx8081GetCpuBc",
  "zx8081GetCpuBcAlt",
  "zx8081GetCpuDe",
  "zx8081GetCpuDeAlt",
  "zx8081GetCpuHalted",
  "zx8081GetCpuHl",
  "zx8081GetCpuHlAlt",
  "zx8081GetCpuIff1",
  "zx8081GetCpuIff2",
  "zx8081GetCpuInterruptMode",
  "zx8081GetCpuIr",
  "zx8081GetCpuIx",
  "zx8081GetCpuIy",
  "zx8081GetCpuOpCode",
  "zx8081GetCpuPc",
  "zx8081GetCpuPrefix",
  "zx8081GetCpuSigInt",
  "zx8081GetCpuSp",
  "zx8081GetCpuWz",
  "zx8081GetFirstInkLine",
  "zx8081GetFirstInkX",
  "zx8081GetFrameCompleted",
  "zx8081GetFrameTacts",
  "zx8081GetFrames",
  "zx8081GetHcounter",
  "zx8081GetHsync",
  "zx8081GetInterruptDepth",
  "zx8081GetKeyboardLine",
  "zx8081GetLastFrameLines",
  "zx8081GetLastPortAddress",
  "zx8081GetLastPortIsWrite",
  "zx8081GetLastPortValue",
  "zx8081GetLineCounter",
  "zx8081GetNmiEnabled",
  "zx8081GetOpStartAddress",
  "zx8081GetPixelBufferCapacity",
  "zx8081GetRamBase",
  "zx8081GetRamCapacity",
  "zx8081GetRamSizeKb",
  "zx8081GetRomCapacity",
  "zx8081GetScreenHeight",
  "zx8081GetScreenWidth",
  "zx8081GetStepOutAddress",
  "zx8081GetTacts",
  "zx8081GetTactsInCurrentFrame",
  "zx8081GetTactsInFrame",
  "zx8081GetTapeCapacity",
  "zx8081GetTvFrames",
  "zx8081GetVsync",
  "zx8081HardReset",
  "zx8081KeyboardLinesPtr",
  "zx8081PixelBufferPtr",
  "zx8081RamPtr",
  "zx8081ReadMemory",
  "zx8081ReadPort",
  "zx8081Reset",
  "zx8081RomPtr",
  "zx8081SetCpuAf",
  "zx8081SetCpuAfAlt",
  "zx8081SetCpuBc",
  "zx8081SetCpuBcAlt",
  "zx8081SetCpuDe",
  "zx8081SetCpuDeAlt",
  "zx8081SetCpuHl",
  "zx8081SetCpuHlAlt",
  "zx8081SetCpuIff1",
  "zx8081SetCpuIff2",
  "zx8081SetCpuInterruptMode",
  "zx8081SetCpuIr",
  "zx8081SetCpuIx",
  "zx8081SetCpuIy",
  "zx8081SetCpuPc",
  "zx8081SetCpuSp",
  "zx8081SetCpuWz",
  "zx8081SetKeyStatus",
  "zx8081SetTacts",
  "zx8081SetTargetClockMultiplier",
  "zx8081TakeAutoRunHit",
  "zx8081TapeDataPtr",
  "zx8081TapeGetEar",
  "zx8081TapeGetFastPosition",
  "zx8081TapeGetLength",
  "zx8081TapeGetMotor",
  "zx8081TapeGetPlaying",
  "zx8081TapeGetPulsePosition",
  "zx8081TapeGetTraps",
  "zx8081TapeRewind",
  "zx8081TapeSetAutoMotor",
  "zx8081TapeSetFastLoad",
  "zx8081TapeSetLength",
  "zx8081TapeSetPlaying",
  "zx8081WriteMemory",
  "zx8081WritePort",
  // --- Last: the breakpoint condition evaluator, identical in every Z80 core
  ...CONDITION_CORE_EXPORTS,
  // --- The execution-history recorder, identical in every core that records history
  ...Z80_HISTORY_CORE_EXPORTS
] as const;

let cachedModule: WebAssembly.Module | undefined;
let cachedArtifactName: string | undefined;

/** Forgets the compiled module, so the next load reads and compiles the artifact again */
export function resetZx8081WasmV2ModuleCache(): void {
  cachedModule = undefined;
  cachedArtifactName = undefined;
}

/** Loads the core: a fresh instance (its own linear memory) of the cached compiled module */
export async function loadZx8081WasmV2(options: Zx8081WasmV2LoaderOptions = {}): Promise<Zx8081WasmV2Runtime> {
  const artifactName = options.artifactName ?? ZX8081_WASM_V2_ARTIFACT_NAME;
  const module = await getCompiledModule(artifactName, options);
  const instantiate = options.instantiate ?? defaultInstantiate;
  const instance = await instantiate(module);
  const wasmExports = instance.exports;
  validateZx8081WasmV2Exports(wasmExports, artifactName);
  return {
    artifactName,
    module,
    instance,
    exports: wasmExports,
    ...createZx8081WasmV2Views(wasmExports, artifactName)
  };
}

/** Throws when an export the machine needs is missing */
export function validateZx8081WasmV2Exports(
  exports: Partial<Zx8081WasmV2Exports>,
  artifactName = ZX8081_WASM_V2_ARTIFACT_NAME
): void {
  for (const exportName of zx8081WasmV2RequiredExports) {
    if (exportName === "memory") {
      if (!(exports.memory instanceof WebAssembly.Memory)) {
        throw new Error(`ZX80/ZX81 WASM artifact '${artifactName}' is missing WebAssembly memory.`);
      }
      continue;
    }
    if (typeof exports[exportName] !== "function") {
      throw new Error(`ZX80/ZX81 WASM artifact '${artifactName}' is missing export '${exportName}'.`);
    }
  }
}

/** Creates the typed views over the core's buffers, checking that each lies inside linear memory */
export function createZx8081WasmV2Views(
  exports: Zx8081WasmV2Exports,
  artifactName = ZX8081_WASM_V2_ARTIFACT_NAME
): Zx8081WasmV2Views {
  const memoryBuffer = exports.memory.buffer;
  const romSize = exports.zx8081GetRomCapacity();
  const ramSize = exports.zx8081GetRamCapacity();
  const pixelWords = exports.zx8081GetPixelBufferCapacity();
  const tapeSize = exports.zx8081GetTapeCapacity();
  const check = (name: string, offset: number, byteLength: number) =>
    assertViewRange(artifactName, name, offset, byteLength, memoryBuffer);
  check("rom", exports.zx8081RomPtr(), romSize);
  check("ram", exports.zx8081RamPtr(), ramSize);
  check("pixelBuffer", exports.zx8081PixelBufferPtr(), pixelWords * 4);
  check("keyboardLines", exports.zx8081KeyboardLinesPtr(), ZX8081_WASM_V2_KEYBOARD_LINE_COUNT);
  check("tapeData", exports.zx8081TapeDataPtr(), tapeSize);
  check("accessLog", exports.zx8081GetAccessLogPtr(), WASM_ACCESS_LOG_CAPACITY * 4);
  check("breakpointFlags", exports.zx8081BreakpointFlagsPtr(), 0x1_0000 * 2);
  check("condPlan", exports.zx8081CondPlanPtr(), WASM_CORE_CONDITION_PLAN_WORDS * 4);
  return {
    memoryBuffer,
    rom: new Uint8Array(memoryBuffer, exports.zx8081RomPtr(), romSize),
    ram: new Uint8Array(memoryBuffer, exports.zx8081RamPtr(), ramSize),
    memory: new Uint8Array(memoryBuffer, exports.zx8081RamPtr(), ramSize),
    pixelBuffer: new Uint32Array(memoryBuffer, exports.zx8081PixelBufferPtr(), pixelWords),
    pixelBufferBytes: new Uint8ClampedArray(memoryBuffer, exports.zx8081PixelBufferPtr(), pixelWords * 4),
    keyboardLines: new Uint8Array(memoryBuffer, exports.zx8081KeyboardLinesPtr(), ZX8081_WASM_V2_KEYBOARD_LINE_COUNT),
    tapeData: new Uint8Array(memoryBuffer, exports.zx8081TapeDataPtr(), tapeSize),
    accessLog: new Uint32Array(memoryBuffer, exports.zx8081GetAccessLogPtr(), WASM_ACCESS_LOG_CAPACITY),
    breakpointFlags: new Uint16Array(memoryBuffer, exports.zx8081BreakpointFlagsPtr(), 0x1_0000),
    condPlan: new Uint32Array(memoryBuffer, exports.zx8081CondPlanPtr(), WASM_CORE_CONDITION_PLAN_WORDS)
  };
}

async function getCompiledModule(artifactName: string, options: Zx8081WasmV2LoaderOptions): Promise<WebAssembly.Module> {
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
      `Cannot load ZX80/ZX81 WASM artifact '${artifactName}' from ${artifactUrl.toString()}: ` +
        `${err instanceof Error ? err.message : String(err)}. The packaged app may be missing its compiled WASM binaries.`
    );
  }
  if (!response.ok) {
    throw new Error(
      `Cannot load ZX80/ZX81 WASM artifact from ${artifactUrl.toString()} (${response.status} ${response.statusText}).`
    );
  }
  return response.arrayBuffer();
}

async function defaultInstantiate(module: WebAssembly.Module): Promise<Zx8081WasmV2Instance> {
  const instance = await WebAssembly.instantiate(module, {});
  return { exports: instance.exports as Zx8081WasmV2Exports };
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
      `ZX80/ZX81 WASM artifact '${artifactName}' exposes ${name} outside WASM memory: offset ${offset}, length ${byteLength}, memory ${memoryBuffer.byteLength}.`
    );
  }
}
