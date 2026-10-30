const { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } = require("node:fs");
const { dirname, relative, resolve, sep } = require("node:path");
const { spawnSync } = require("node:child_process");

const { acquireWasmBuildLock, waitForWasmBuildLock } = require("./wasm-build-lock.cjs");
const { cpuExports, debugLoopExports, debugLoopVolatileSymbols, Z80_ACCESS_LOG_VOLATILE_SYMBOLS } = require("./z80-cpu-exports.cjs");
const { Z80_CONDITION_EXPORTS, Z80_CONDITION_VOLATILE_SYMBOLS } = require("./z80-condition-exports.cjs");
const { Z80_HISTORY_EXPORTS, Z80_HISTORY_VOLATILE_SYMBOLS } = require("./z80-history-exports.cjs");
const { Z80_PROFILE_EXPORTS, Z80_PROFILE_VOLATILE_SYMBOLS } = require("./z80-profile-exports.cjs");
const {
  discardWasmOutput,
  layoutMapArgs,
  layoutMapPath,
  publishWasmOutput,
  stagingWasmOutput,
  stampWasmLayout
} = require("./wasm-layout.cjs");

/**
 * Statics a Klive state file leaves out (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` trap 10):
 * debugging state and buffers the core rewrites before it reads them, so a restore keeps the live
 * core's bytes there.
 */
const EP_VOLATILE_SYMBOLS = [
  // --- The IDE's breakpoint conditions and the per-instruction access log they read: debugging
  // --- state, not machine state, so a restore never brings back old breakpoints
  ...Z80_CONDITION_VOLATILE_SYMBOLS,
  ...debugLoopVolatileSymbols("ep"),
  ...Z80_ACCESS_LOG_VOLATILE_SYMBOLS,
  // --- The rest of the IDE's bus record, and whether it is being recorded: a fast frame records it only
  // --- near its end, a debug run always (WASM_CORE_LEAN_AND_DEBUG_PLAN Phase 1), so it is no state
  "epOpStartAddress",
  "epCaptureBusEvents",
  // --- The execution-history ring (EXECUTION_HISTORY_ALL_CORES_PLAN)
  ...Z80_HISTORY_VOLATILE_SYMBOLS,
  // --- The access profile: flags, counters and time (CODE_COVERAGE_AND_HEAT_MAP_PLAN T4, T7)
  ...Z80_PROFILE_VOLATILE_SYMBOLS
];

/*
 * Builds the Enterprise 64/128 full-machine WASM core (`.plans/ENTERPRISE_PLAN.md`).
 *
 * The same shape as the TVC and HT-1080Z builds: plain clang for wasm32 (no Emscripten), one translation unit, a
 * fixed linear memory, and an explicit export allow-list. Builds of the production artifact are
 * serialized with a lock file, because vitest workers build it in parallel.
 */

const root = resolve(__dirname, "..");
const source = resolve(root, "src/emu/machines/enterprise/wasm/ep/ep.c");
const wasmDistDirectory = resolve(root, "src/emu/machines/enterprise/wasm/dist");
const productionOutput = resolve(wasmDistDirectory, "ep.wasm");
const output = productionOutput;
const buildLockPath = resolve(wasmDistDirectory, ".ep.wasm.lock");
const packagedResourceDirectory = "wasm/enterprise";
const packagedArtifactRelative = `${packagedResourceDirectory}/ep.wasm`;

const optimizationProfiles = {
  speed: ["-O3", "-Wl,--strip-all"],
  size: ["-Oz", "-Wl,--strip-all"],
  lto: ["-O3", "-flto"]
};

const productionExports = [
  // --- Breakpoint condition evaluator (`src/emu/z80/wasm/z80-condition.c`)
  ...Z80_CONDITION_EXPORTS,
  // --- Execution history recorder (`src/emu/z80/wasm/z80-history.c`)
  ...Z80_HISTORY_EXPORTS,
  // --- Access profile (`src/emu/z80/wasm/z80-profile.c`)
  ...Z80_PROFILE_EXPORTS,
  "memory",
  "epConfigure",
  "epExecuteFrame",
  "epExecuteInstruction",
  ...cpuExports("ep", { accessLog: true, lastPort: true }),
  // --- The debugger's in-core loop (`z80-debug-loop.c`)
  ...debugLoopExports("ep"),
  "epAudioSamplesPtr",
  "epCartRomPtr",
  "epExdosRomPtr",
  "epExosRomPtr",
  "epFileIoRomPtr",
  "epGetAudioOverflows",
  "epGetAudioSampleCapacity",
  "epGetAudioSampleCount",
  "epGetAudioSampleRate",
  "epGetB4",
  "epGetBaseClockFrequency",
  "epGetBf",
  "epGetClockMultiplier",
  "epGetCpuOpCode",
  "epGetDaveRegister",
  "epGetFrameCompleted",
  "epGetFrameTacts",
  "epGetFrames",
  "epGetHalfClock",
  "epGetIntEnable",
  "epGetIntLatch",
  "epGetIs128",
  "epGetKeyboardLine",
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
  "epNickGetSlot",
  "epNickGetState",
  "epNickSetSeed",
  "epPixelBufferPtr",
  "epReadMemory",
  "epReadPhysical",
  "epReadPort",
  "epReset",
  "epSetAudioSampleRate",
  "epSetJoystickJ",
  "epSetKeyStatus",
  "epSetNickSlotPhase",
  "epSetTacts",
  "epSetTargetClockMultiplier",
  "epWriteMemory",
  "epWritePort"
];


/*
 * The 240K of physical memory and the 736 x 288 picture (848 KB) fit in 2 MiB with room for the
 * stack; the 4 MiB execution-history ring (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` D2, D3) and
 * the access profile's flags and counter pool (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D5) make
 * it 8 MiB, as the HT-1080Z's and the TVC's before its disks. Raise this only with a recorded reason
 * (EXDOS's drives will, in Phase 9).
 */
const EP_WASM_MEMORY_BYTES = 8 * 1024 * 1024;

function normalizeOptimization(optimization = process.env.EP_WASM_OPTIMIZATION || "speed") {
  if (optimizationProfiles[optimization] == null) {
    throw new Error(
      `Unknown Enterprise WASM optimization profile '${optimization}'. Expected one of: ${Object.keys(optimizationProfiles).join(", ")}.`
    );
  }
  return optimization;
}

function buildEpWasm({
  compiler = process.env.EP_WASM_CC || "clang",
  optimization = process.env.EP_WASM_OPTIMIZATION || "speed",
  outputPath,
  run = spawnSync
} = {}) {
  const optimizationProfile = normalizeOptimization(optimization);
  const selectedOutput = outputPath ?? productionOutput;
  // --- A real build is staged and renamed into place (see `publishWasmOutput`)
  const compiledOutput = stagingWasmOutput(selectedOutput, run === spawnSync);
  const releaseBuildLock =
    selectedOutput === productionOutput && run === spawnSync
      ? acquireWasmBuildLock(buildLockPath, "Enterprise")
      : () => {};
  try {
    if (existsSync(wasmDistDirectory) && dirname(selectedOutput) === wasmDistDirectory) {
      for (const entry of readdirSync(wasmDistDirectory)) {
        const candidate = resolve(wasmDistDirectory, entry);
        if (entry.endsWith(".wasm") && candidate !== selectedOutput) {
          unlinkSync(candidate);
        }
      }
    }
    mkdirSync(dirname(selectedOutput), { recursive: true });
    const args = [
      "--target=wasm32",
      "-std=c11",
      ...optimizationProfiles[optimizationProfile],
      "-ffreestanding",
      "-fno-builtin",
      "-nostdlib",
      "-Wl,--no-entry",
      "-Wl,--export-memory",
      `-Wl,--initial-memory=${EP_WASM_MEMORY_BYTES}`,
      `-Wl,--max-memory=${EP_WASM_MEMORY_BYTES}`,
      ...productionExports.filter((name) => name !== "memory").map((name) => `-Wl,--export=${name}`),
      source,
      "-o",
      compiledOutput
    ];
    const layoutMap = layoutMapPath(selectedOutput);
    const result = run(compiler, [...args, ...layoutMapArgs(layoutMap)], { cwd: root, stdio: "inherit" });
    if (result.error || result.status !== 0) discardWasmOutput(compiledOutput, selectedOutput);
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Enterprise WASM compilation failed (${result.status}).`);
    if (!existsSync(compiledOutput) || statSync(compiledOutput).size === 0) {
      throw new Error(
        `Enterprise WASM compilation reported success (compiler: '${compiler}'), but '${selectedOutput}' is missing or empty. ` +
          `The build must not continue - packaging this app would ship a broken emulator.`
      );
    }
    // --- The memory layout a Klive state file depends on (scripts/wasm-layout.cjs)
    const layout = stampWasmLayout(compiledOutput, layoutMap, EP_VOLATILE_SYMBOLS);
    publishWasmOutput(compiledOutput, selectedOutput);
    return {
      layout,
      compiler,
      args,
      optimization: optimizationProfile,
      exports: productionExports,
      source,
      sources: [source],
      output: selectedOutput
    };
  } finally {
    releaseBuildLock();
  }
}

/** Waits until no build of the production artifact is in progress (for readers of the artifact). */
function waitForEpWasmBuildLock(timeoutMs) {
  waitForWasmBuildLock(buildLockPath, "Enterprise", timeoutMs);
}

if (require.main === module) buildEpWasm();

function toPosixRelative(from, to) {
  return relative(from, to).split(sep).join("/");
}

module.exports = {
  EP_VOLATILE_SYMBOLS,
  buildEpWasm,
  buildLockPath,
  output,
  productionOutput,
  packagedArtifactRelative,
  packagedResourceDirectory,
  productionExports,
  source,
  waitForEpWasmBuildLock,
  wasmDistDirectory,
  EP_WASM_MEMORY_BYTES,
  outputRelative: toPosixRelative(root, output),
  productionOutputRelative: toPosixRelative(root, productionOutput),
  wasmDistDirectoryRelative: toPosixRelative(root, wasmDistDirectory)
};
