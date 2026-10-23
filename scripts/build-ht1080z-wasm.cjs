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
const HT1080Z_VOLATILE_SYMBOLS = [
  // --- The IDE's breakpoint conditions and the per-instruction access log they read: debugging
  // --- state, not machine state, so a restore never brings back old breakpoints
  ...Z80_CONDITION_VOLATILE_SYMBOLS,
  ...debugLoopVolatileSymbols("ht1080z"),
  ...Z80_ACCESS_LOG_VOLATILE_SYMBOLS,
  // --- The rest of the IDE's bus record, and whether it is being recorded: a fast frame records it only
  // --- near its end, a debug run always (WASM_CORE_LEAN_AND_DEBUG_PLAN Phase 1), so it is no state
  "htOpStartAddress",
  "htCaptureBusEvents",
  // --- The execution-history ring (EXECUTION_HISTORY_ALL_CORES_PLAN)
  ...Z80_HISTORY_VOLATILE_SYMBOLS,
  // --- The access profile: flags, counters and time (CODE_COVERAGE_AND_HEAT_MAP_PLAN T4, T7)
  ...Z80_PROFILE_VOLATILE_SYMBOLS
];

/*
 * Builds the HT-1080Z full-machine WASM core (`.plans/HT1080Z_PLAN.md`).
 *
 * The same shape as the Z88 build: plain clang for wasm32 (no Emscripten), one translation unit, a
 * fixed linear memory, and an explicit export allow-list. Builds of the production artifact are
 * serialized with a lock file, because vitest workers build it in parallel.
 */

const root = resolve(__dirname, "..");
const source = resolve(root, "src/emu/machines/ht1080z/wasm/ht1080z/ht1080z.c");
const wasmDistDirectory = resolve(root, "src/emu/machines/ht1080z/wasm/dist");
const productionOutput = resolve(wasmDistDirectory, "ht1080z.wasm");
const output = productionOutput;
const buildLockPath = resolve(wasmDistDirectory, ".ht1080z.wasm.lock");
const packagedResourceDirectory = "wasm/ht1080z";
const packagedArtifactRelative = `${packagedResourceDirectory}/ht1080z.wasm`;

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
  "ht1080zChargenPtr",
  "ht1080zConfigure",
  "ht1080zExecuteFrame",
  "ht1080zExecuteInstruction",
  ...cpuExports("ht1080z", { accessLog: true, lastPort: true }),
  // --- The debugger's in-core loop (`z80-debug-loop.c`)
  ...debugLoopExports("ht1080z"),
  "ht1080zGetBaseClockFrequency",
  "ht1080zGetCassetteLatch",
  "ht1080zGetChargenCapacity",
  "ht1080zGetClockMultiplier",
  "ht1080zGetCpuOpCode",
  "ht1080zGetFrameCompleted",
  "ht1080zGetFrameTacts",
  "ht1080zGetFrames",
  "ht1080zGetKeyboardLine",
  "ht1080zGetMemoryCapacity",
  "ht1080zGetOpStartAddress",
  "ht1080zGetPixelBufferCapacity",
  "ht1080zGetPortFf",
  "ht1080zGetRamSizeKb",
  "ht1080zGetRecorder2",
  "ht1080zGetRomCapacity",
  "ht1080zGetScreenHeight",
  "ht1080zGetScreenWidth",
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
  "ht1080zWriteMemory",
  "ht1080zWritePort"
];

/*
 * The 64K memory, the 2K character ROM and the 528 x 288 picture (600 KB) fit in 1 MiB with room for
 * the stack; the 4 MiB execution-history ring (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` D2, D3)
 * and the access profile's 64 KB of flags and 1.5 MB counter pool
 * (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D5) make it 8 MiB, as the ZX80/81 core's. Phases 5-6
 * add the audio and tape buffers. Raise this only with a recorded reason.
 */
const HT1080Z_WASM_MEMORY_BYTES = 8 * 1024 * 1024;

function normalizeOptimization(optimization = process.env.HT1080Z_WASM_OPTIMIZATION || "speed") {
  if (optimizationProfiles[optimization] == null) {
    throw new Error(
      `Unknown HT-1080Z WASM optimization profile '${optimization}'. Expected one of: ${Object.keys(optimizationProfiles).join(", ")}.`
    );
  }
  return optimization;
}

function buildHt1080zWasm({
  compiler = process.env.HT1080Z_WASM_CC || "clang",
  optimization = process.env.HT1080Z_WASM_OPTIMIZATION || "speed",
  outputPath,
  run = spawnSync
} = {}) {
  const optimizationProfile = normalizeOptimization(optimization);
  const selectedOutput = outputPath ?? productionOutput;
  // --- A real build is staged and renamed into place (see `publishWasmOutput`)
  const compiledOutput = stagingWasmOutput(selectedOutput, run === spawnSync);
  const releaseBuildLock =
    selectedOutput === productionOutput && run === spawnSync
      ? acquireWasmBuildLock(buildLockPath, "HT-1080Z")
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
      `-Wl,--initial-memory=${HT1080Z_WASM_MEMORY_BYTES}`,
      `-Wl,--max-memory=${HT1080Z_WASM_MEMORY_BYTES}`,
      ...productionExports.filter((name) => name !== "memory").map((name) => `-Wl,--export=${name}`),
      source,
      "-o",
      compiledOutput
    ];
    const layoutMap = layoutMapPath(selectedOutput);
    const result = run(compiler, [...args, ...layoutMapArgs(layoutMap)], { cwd: root, stdio: "inherit" });
    if (result.error || result.status !== 0) discardWasmOutput(compiledOutput, selectedOutput);
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`HT-1080Z WASM compilation failed (${result.status}).`);
    if (!existsSync(compiledOutput) || statSync(compiledOutput).size === 0) {
      throw new Error(
        `HT-1080Z WASM compilation reported success (compiler: '${compiler}'), but '${selectedOutput}' is missing or empty. ` +
          `The build must not continue - packaging this app would ship a broken emulator.`
      );
    }
    // --- The memory layout a Klive state file depends on (scripts/wasm-layout.cjs)
    const layout = stampWasmLayout(compiledOutput, layoutMap, HT1080Z_VOLATILE_SYMBOLS);
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
function waitForHt1080zWasmBuildLock(timeoutMs) {
  waitForWasmBuildLock(buildLockPath, "HT-1080Z", timeoutMs);
}

if (require.main === module) buildHt1080zWasm();

function toPosixRelative(from, to) {
  return relative(from, to).split(sep).join("/");
}

module.exports = {
  HT1080Z_VOLATILE_SYMBOLS,
  buildHt1080zWasm,
  buildLockPath,
  output,
  productionOutput,
  packagedArtifactRelative,
  packagedResourceDirectory,
  productionExports,
  source,
  waitForHt1080zWasmBuildLock,
  wasmDistDirectory,
  HT1080Z_WASM_MEMORY_BYTES,
  outputRelative: toPosixRelative(root, output),
  productionOutputRelative: toPosixRelative(root, productionOutput),
  wasmDistDirectoryRelative: toPosixRelative(root, wasmDistDirectory)
};
