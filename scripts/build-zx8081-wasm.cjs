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
const ZX8081_VOLATILE_SYMBOLS = [
  // --- The IDE's breakpoint conditions and the per-instruction access log they read: debugging
  // --- state, not machine state, so a restore never brings back old breakpoints
  ...Z80_CONDITION_VOLATILE_SYMBOLS,
  ...debugLoopVolatileSymbols("zx8081"),
  ...Z80_ACCESS_LOG_VOLATILE_SYMBOLS,
  // --- The rest of the IDE's bus record, and whether it is being recorded: a fast frame records it only
  // --- near its end, a debug run always (WASM_CORE_LEAN_AND_DEBUG_PLAN Phase 1), so it is no state
  "zx8081OpStartAddress",
  "zx8081CaptureBusEvents",
  // --- The execution-history ring, and whether the last M1 read a forced NOP (EXECUTION_HISTORY_ALL_CORES_PLAN)
  ...Z80_HISTORY_VOLATILE_SYMBOLS,
  "zx8081HistoryForcedNop",
  // --- The access profile: flags, counters and time (CODE_COVERAGE_AND_HEAT_MAP_PLAN T4, T7)
  ...Z80_PROFILE_VOLATILE_SYMBOLS
];

/*
 * Builds the Sinclair ZX80/ZX81 full-machine WASM core (`.plans/ZX8081_WASM_PLAN.md`).
 *
 * The same shape as the Z88 build: plain clang for wasm32 (no Emscripten), one translation unit, a
 * fixed linear memory, and an explicit export allow-list. Builds of the production artifact are
 * serialized with a lock file, because vitest workers build it in parallel.
 */

const root = resolve(__dirname, "..");
const source = resolve(root, "src/emu/machines/zx8081/wasm/zx8081/zx8081.c");
const wasmDistDirectory = resolve(root, "src/emu/machines/zx8081/wasm/dist");
const productionOutput = resolve(wasmDistDirectory, "zx8081.wasm");
const output = productionOutput;
const buildLockPath = resolve(wasmDistDirectory, ".zx8081.wasm.lock");
const packagedResourceDirectory = "wasm/zx8081";
const packagedArtifactRelative = `${packagedResourceDirectory}/zx8081.wasm`;

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
  "zx8081ArmAutoRun",
  "zx8081Configure",
  "zx8081ExecuteFrame",
  "zx8081ExecuteInstruction",
  ...cpuExports("zx8081", { accessLog: true, lastPort: true }),
  // --- The debugger's in-core loop (`z80-debug-loop.c`)
  ...debugLoopExports("zx8081"),
  "zx8081GetBaseClockFrequency",
  "zx8081GetBeamY",
  "zx8081GetClockMultiplier",
  "zx8081GetCpuOpCode",
  "zx8081GetCpuSigInt",
  "zx8081GetFirstInkLine",
  "zx8081GetFirstInkX",
  "zx8081GetFrameCompleted",
  "zx8081GetFrameTacts",
  "zx8081GetFrames",
  "zx8081GetHcounter",
  "zx8081GetHsync",
  "zx8081GetKeyboardLine",
  "zx8081GetLastFrameLines",
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
];

/*
 * 64K RAM, the 416 x 400 raw raster (650 KB), the 352 x 288 picture (400 KB) and the tape buffer fit
 * in 2 MiB with room for the stack; the 4 MiB execution-history ring
 * (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` D2, D3) makes it 6 MiB; the access profile's 72 KB
 * of flags and its 1.7 MB counter pool, which covers all of it (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md`
 * D5), make it 8 MiB. Raise this only with a recorded reason.
 */
const ZX8081_WASM_MEMORY_BYTES = 8 * 1024 * 1024;

function normalizeOptimization(optimization = process.env.ZX8081_WASM_OPTIMIZATION || "speed") {
  if (optimizationProfiles[optimization] == null) {
    throw new Error(
      `Unknown ZX80/ZX81 WASM optimization profile '${optimization}'. Expected one of: ${Object.keys(optimizationProfiles).join(", ")}.`
    );
  }
  return optimization;
}

function buildZx8081Wasm({
  compiler = process.env.ZX8081_WASM_CC || "clang",
  optimization = process.env.ZX8081_WASM_OPTIMIZATION || "speed",
  outputPath,
  run = spawnSync
} = {}) {
  const optimizationProfile = normalizeOptimization(optimization);
  const selectedOutput = outputPath ?? productionOutput;
  // --- A real build is staged and renamed into place (see `publishWasmOutput`)
  const compiledOutput = stagingWasmOutput(selectedOutput, run === spawnSync);
  const releaseBuildLock =
    selectedOutput === productionOutput && run === spawnSync
      ? acquireWasmBuildLock(buildLockPath, "ZX80/ZX81")
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
      `-Wl,--initial-memory=${ZX8081_WASM_MEMORY_BYTES}`,
      `-Wl,--max-memory=${ZX8081_WASM_MEMORY_BYTES}`,
      ...productionExports.filter((name) => name !== "memory").map((name) => `-Wl,--export=${name}`),
      source,
      "-o",
      compiledOutput
    ];
    const layoutMap = layoutMapPath(selectedOutput);
    const result = run(compiler, [...args, ...layoutMapArgs(layoutMap)], { cwd: root, stdio: "inherit" });
    if (result.error || result.status !== 0) discardWasmOutput(compiledOutput, selectedOutput);
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`ZX80/ZX81 WASM compilation failed (${result.status}).`);
    if (!existsSync(compiledOutput) || statSync(compiledOutput).size === 0) {
      throw new Error(
        `ZX80/ZX81 WASM compilation reported success (compiler: '${compiler}'), but '${selectedOutput}' is missing or empty. ` +
          `The build must not continue - packaging this app would ship a broken emulator.`
      );
    }
    // --- The memory layout a Klive state file depends on (scripts/wasm-layout.cjs)
    const layout = stampWasmLayout(compiledOutput, layoutMap, ZX8081_VOLATILE_SYMBOLS);
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
function waitForZx8081WasmBuildLock(timeoutMs) {
  waitForWasmBuildLock(buildLockPath, "ZX80/ZX81", timeoutMs);
}

if (require.main === module) buildZx8081Wasm();

function toPosixRelative(from, to) {
  return relative(from, to).split(sep).join("/");
}

module.exports = {
  ZX8081_VOLATILE_SYMBOLS,
  buildZx8081Wasm,
  buildLockPath,
  output,
  productionOutput,
  packagedArtifactRelative,
  packagedResourceDirectory,
  productionExports,
  source,
  waitForZx8081WasmBuildLock,
  wasmDistDirectory,
  ZX8081_WASM_MEMORY_BYTES,
  outputRelative: toPosixRelative(root, output),
  productionOutputRelative: toPosixRelative(root, productionOutput),
  wasmDistDirectoryRelative: toPosixRelative(root, wasmDistDirectory)
};
