const { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } = require("node:fs");
const { dirname, relative, resolve, sep } = require("node:path");
const { spawnSync } = require("node:child_process");

const { acquireWasmBuildLock, waitForWasmBuildLock } = require("./wasm-build-lock.cjs");
const { cpuExports, debugLoopExports, debugLoopVolatileSymbols } = require("./z80-cpu-exports.cjs");
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
const Z88_VOLATILE_SYMBOLS = [
  // --- The IDE's breakpoint conditions and the per-instruction access log they read: debugging
  // --- state, not machine state, so a restore never brings back old breakpoints
  ...Z80_CONDITION_VOLATILE_SYMBOLS,
  ...debugLoopVolatileSymbols("z88"),
  // --- What the Z88 sent to TXD, held until the host shows it: output the guest never reads back, not
  // --- machine state (a reverse-debugging replay must not depend on when the host emptied it)
  "z88UartTx",
  "z88UartTxCount",
  // --- The execution-history ring (EXECUTION_HISTORY_ALL_CORES_PLAN)
  ...Z80_HISTORY_VOLATILE_SYMBOLS,
  // --- The access profile: flags, counters and time (CODE_COVERAGE_AND_HEAT_MAP_PLAN T4, T7)
  ...Z80_PROFILE_VOLATILE_SYMBOLS
];

/*
 * Builds the Cambridge Z88 full-machine WASM core (`.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`).
 *
 * The same shape as the ZX Spectrum builds: plain clang for wasm32 (no Emscripten), one translation
 * unit, a fixed linear memory, and an explicit export allow-list. Builds of the production artifact
 * are serialized with a lock file, because vitest workers build it in parallel.
 */

const root = resolve(__dirname, "..");
const source = resolve(root, "src/emu/machines/z88/wasm/z88/z88.c");
const wasmDistDirectory = resolve(root, "src/emu/machines/z88/wasm/dist");
const productionOutput = resolve(wasmDistDirectory, "cambridge-z88.wasm");
const output = productionOutput;
const buildLockPath = resolve(wasmDistDirectory, ".cambridge-z88.wasm.lock");
const packagedResourceDirectory = "wasm/z88";
const packagedArtifactRelative = `${packagedResourceDirectory}/cambridge-z88.wasm`;

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
  // --- Buffers
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
  "z88PeekMemory",
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
  "z88GetSbf",
  "z88GetEarBit",
  "z88ResetBlink",
  "z88UartTxPtr",
  "z88GetUartTxCount",
  "z88ClearUartTx",
  // --- Restoring a saved state (.z88 snapshots)
  "z88SetTim",
  "z88SetTsta",
  "z88SetPb",
  "z88SetSbf",
  "z88DrawLcd",
  // --- CPU and bus events
  ...cpuExports("z88"),
  // --- The debugger's in-core loop (`z80-debug-loop.c`)
  ...debugLoopExports("z88"),
  "z88GetCpuSnoozed",
  "z88SetCpuSnoozed",
  "z88GetCpuSigInt",
  // --- Test hooks (in the allow-list, not required by the loader)
  "z88TestResetRtc",
  "z88TestIncrementRtc"
];

/*
 * 4 MB of physical memory, an 800x480 pixel buffer (1.5 MB), the audio buffer and the 4 MB
 * execution-history ring (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` D2, D3) fit in 12 MiB; the
 * access profile adds 16 MB - a flag byte per physical byte (4 MB) and a 64-page counter pool (12 MB)
 * (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D2, D5). `z88.c` asserts the sum at compile time.
 * Raise this only with a recorded reason.
 */
const Z88_WASM_MEMORY_BYTES = 28 * 1024 * 1024;

const buildModes = {
  production: {
    output: productionOutput,
    exports: productionExports,
    sources: [source],
    initialMemory: Z88_WASM_MEMORY_BYTES
  }
};

function normalizeBuildMode(mode = process.env.Z88_WASM_BUILD_MODE || "production") {
  if (buildModes[mode] == null) {
    throw new Error(`Unknown Cambridge Z88 WASM build mode '${mode}'. Expected: production.`);
  }
  return mode;
}

function normalizeOptimization(optimization = process.env.Z88_WASM_OPTIMIZATION || "speed") {
  if (optimizationProfiles[optimization] == null) {
    throw new Error(
      `Unknown Cambridge Z88 WASM optimization profile '${optimization}'. Expected one of: ${Object.keys(optimizationProfiles).join(", ")}.`
    );
  }
  return optimization;
}

function buildZ88Wasm({
  compiler = process.env.Z88_WASM_CC || "clang",
  mode = process.env.Z88_WASM_BUILD_MODE || "production",
  optimization = process.env.Z88_WASM_OPTIMIZATION || "speed",
  outputPath,
  run = spawnSync
} = {}) {
  const buildMode = normalizeBuildMode(mode);
  const optimizationProfile = normalizeOptimization(optimization);
  const selected = buildModes[buildMode];
  const selectedOutput = outputPath ?? selected.output;
  // --- A real build is staged and renamed into place (see `publishWasmOutput`)
  const compiledOutput = stagingWasmOutput(selectedOutput, run === spawnSync);
  const releaseBuildLock =
    selectedOutput === productionOutput && run === spawnSync
      ? acquireWasmBuildLock(buildLockPath, "Cambridge Z88")
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
      `-Wl,--initial-memory=${selected.initialMemory}`,
      `-Wl,--max-memory=${selected.initialMemory}`,
      ...selected.exports.filter((name) => name !== "memory").map((name) => `-Wl,--export=${name}`),
      ...selected.sources,
      "-o",
      compiledOutput
    ];
    const layoutMap = layoutMapPath(selectedOutput);
    const result = run(compiler, [...args, ...layoutMapArgs(layoutMap)], { cwd: root, stdio: "inherit" });
    if (result.error || result.status !== 0) discardWasmOutput(compiledOutput, selectedOutput);
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Cambridge Z88 WASM compilation failed (${result.status}).`);
    if (!existsSync(compiledOutput) || statSync(compiledOutput).size === 0) {
      throw new Error(
        `Cambridge Z88 WASM compilation reported success (compiler: '${compiler}'), but '${selectedOutput}' is missing or empty. ` +
          `The build must not continue - packaging this app would ship a broken emulator.`
      );
    }
    // --- The memory layout a Klive state file depends on (scripts/wasm-layout.cjs)
    const layout = stampWasmLayout(compiledOutput, layoutMap, Z88_VOLATILE_SYMBOLS);
    publishWasmOutput(compiledOutput, selectedOutput);
    return {
      layout,
      compiler,
      args,
      mode: buildMode,
      optimization: optimizationProfile,
      exports: selected.exports,
      source: selected.sources[0],
      sources: selected.sources,
      output: selectedOutput
    };
  } finally {
    releaseBuildLock();
  }
}

function buildAllZ88Wasm(options = {}) {
  return [buildZ88Wasm(options)];
}

/** Waits until no build of the production artifact is in progress (for readers of the artifact). */
function waitForZ88WasmBuildLock(timeoutMs) {
  waitForWasmBuildLock(buildLockPath, "Cambridge Z88", timeoutMs);
}

if (require.main === module) buildAllZ88Wasm();

// --- electron-builder resource paths and package.json config use forward slashes on
// --- every platform, so never leak Windows backslashes from path.relative().
function toPosixRelative(from, to) {
  return relative(from, to).split(sep).join("/");
}

module.exports = {
  Z88_VOLATILE_SYMBOLS,
  buildZ88Wasm,
  buildAllZ88Wasm,
  buildLockPath,
  buildModes,
  output,
  productionOutput,
  packagedArtifactRelative,
  packagedResourceDirectory,
  productionExports,
  source,
  waitForZ88WasmBuildLock,
  wasmDistDirectory,
  Z88_WASM_MEMORY_BYTES,
  outputRelative: toPosixRelative(root, output),
  productionOutputRelative: toPosixRelative(root, productionOutput),
  wasmDistDirectoryRelative: toPosixRelative(root, wasmDistDirectory)
};
