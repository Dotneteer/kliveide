const { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } = require("node:fs");
const { dirname, relative, resolve, sep } = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  discardWasmOutput,
  layoutMapArgs,
  layoutMapPath,
  publishWasmOutput,
  stagingWasmOutput,
  stampWasmLayout
} = require("./wasm-layout.cjs");
const { RZX_VOLATILE_SYMBOLS, rzxExports } = require("./rzx-core-exports.cjs");
const { cpuExports, debugLoopExports, debugLoopVolatileSymbols, Z80_ACCESS_LOG_VOLATILE_SYMBOLS } = require("./z80-cpu-exports.cjs");
const { Z80_CONDITION_EXPORTS, Z80_CONDITION_VOLATILE_SYMBOLS } = require("./z80-condition-exports.cjs");
const { Z80_HISTORY_EXPORTS, Z80_HISTORY_VOLATILE_SYMBOLS } = require("./z80-history-exports.cjs");
const { Z80_PROFILE_EXPORTS, Z80_PROFILE_VOLATILE_SYMBOLS } = require("./z80-profile-exports.cjs");

/**
 * Statics a Klive state file leaves out (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` trap 10):
 * debugging state and buffers the core rewrites before it reads them, so a restore keeps the live
 * core's bytes there.
 */
/*
 * Frame-boundary scratch (`.plans/REVERSE_DEBUGGING_PLAN.md` T5): the frame's audio samples, which
 * the core rewrites before it reads them. Keyframes taken at a frame boundary leave them out; the T5
 * proof in `test/wasm/reverse/journal-replay-determinism.test.ts` checks every keyframe interval.
 * Not scratch: the picture, which a step back shows half drawn (D18), and the beeper's transition
 * buffers, whose transitions not yet turned into samples carry over into the next frame.
 */
const SP48_SCRATCH_SYMBOLS = ["sp48AudioSamples"];

const SP48_VOLATILE_SYMBOLS = [
  // --- The IDE's breakpoint conditions and the per-instruction access log they read: debugging
  // --- state, not machine state, so a restore never brings back old breakpoints
  ...Z80_CONDITION_VOLATILE_SYMBOLS,
  ...debugLoopVolatileSymbols("sp48"),
  ...Z80_ACCESS_LOG_VOLATILE_SYMBOLS,
  // --- An RZX session in progress (`zx-spectrum-rzx.c`)
  ...RZX_VOLATILE_SYMBOLS,
  // --- The execution-history ring and the model byte of its contexts (EXECUTION_HISTORY_ALL_CORES_PLAN)
  ...Z80_HISTORY_VOLATILE_SYMBOLS,
  "sp48HistoryModel",
  // --- The access profile: flags, counters and time (CODE_COVERAGE_AND_HEAT_MAP_PLAN T4, T7)
  ...Z80_PROFILE_VOLATILE_SYMBOLS
];

const root = resolve(__dirname, "..");
const source = resolve(root, "src/emu/machines/zxSpectrum48/wasm/sp48/sp48.c");
const productionOutput = resolve(root, "src/emu/machines/zxSpectrum48/wasm/dist/zx-spectrum48.wasm");
const output = productionOutput;
const wasmDistDirectory = resolve(root, "src/emu/machines/zxSpectrum48/wasm/dist");
const packagedResourceDirectory = "wasm/zxSpectrum48";
const packagedArtifactRelative = `${packagedResourceDirectory}/zx-spectrum48.wasm`;

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
  "sp48MemoryPtr",
  "sp48PixelBufferPtr",
  "sp48AudioSamplesPtr",
  "sp48KeyboardLinesPtr",
  "sp48TapeDataPtr",
  "sp48TapeSaveDataPtr",
  "sp48TapeFileNamePtr",
  "sp48Reset",
  "sp48HardReset",
  "sp48ExecuteFrame",
  "sp48ExecuteInstruction",
  "sp48RenderInstantScreen",
  "sp48DelayAddressBusAccess",
  "sp48DelayPortAccess",
  "sp48DelayPortRead",
  "sp48DelayPortWrite",
  "sp48ResetContentionCounters",
  "sp48SetTacts",
  // --- Test hook: advances every absolute tact point, to reach the counter's rebase quickly
  "sp48TestAdvanceTacts",
  "sp48TestGetTactEpoch",
  "sp48UploadRomByte",
  "sp48ReadMemory",
  "sp48WriteMemory",
  "sp48ReadScreenMemoryOffset",
  "sp48SetKeyStatus",
  "sp48ReadPort",
  "sp48ReadFloatingBus",
  "sp48WritePort",
  "sp48SetAudioSampleRate",
  "sp48GetScreenWidth",
  "sp48GetScreenHeight",
  "sp48GetPixelBufferStartOffset",
  "sp48GetRomSize",
  "sp48GetRomUploadCount",
  "sp48GetRomChecksum",
  "sp48GetAudioSampleCount",
  "sp48GetAudioSampleCapacity",
  "sp48GetTactsInFrame",
  "sp48SetTargetClockMultiplier",
  "sp48GetClockMultiplier",
  "sp48GetTargetClockMultiplier",
  "sp48GetTactsInCurrentFrame",
  "sp48GetBaseClockFrequency",
  "sp48GetFrames",
  "sp48GetTacts",
  "sp48GetCurrentFrameTact",
  "sp48GetRasterLines",
  "sp48GetScreenLineTime",
  "sp48GetTimingScreenWidth",
  "sp48GetTimingScreenLines",
  "sp48GetFirstDisplayLine",
  "sp48GetFirstVisibleLine",
  "sp48GetFirstVisibleBorderTact",
  "sp48GetContentionValue",
  "sp48SetContentionValue",
  "sp48GetRenderingPhase",
  "sp48GetRenderingPixelAddress",
  "sp48GetRenderingAttributeAddress",
  "sp48GetRenderingPixelIndex",
  "sp48GetBeamInfo",
  "sp48RenderToBeam",
  "sp48GetTotalContentionDelaySinceStart",
  "sp48GetContentionDelaySincePause",
  "sp48GetNextFrameStartTact",
  "sp48GetFrameCompleted",
  "sp48GetInterruptsRaised",
  "sp48GetInterruptLineActive",
  "sp48GetCpuInstructionsExecuted",
  "sp48GetCpuFrameSliceInstructions",
  "sp48GetCpuTacts",
  ...cpuExports("sp48", { snapshotState: true, accessLog: true, accessLogOverflows: true, lastPort: true }),
  // --- The debugger's in-core loop (`z80-debug-loop.c`)
  ...debugLoopExports("sp48"),
  "sp48TapeClear",
  "sp48TapeSetFileNameByte",
  "sp48TapeBeginUpload",
  "sp48TapeSetBlock",
  "sp48TapeWriteData",
  "sp48TapeFinishUpload",
  "sp48TapeRewind",
  "sp48TapeSetMode",
  "sp48TapeSetFastLoad",
  "sp48TapeGetFastLoad",
  "sp48TapeGetMaxBlocks",
  "sp48TapeGetDataCapacity",
  "sp48TapeGetFileNameCapacity",
  "sp48TapeGetBlockCount",
  "sp48TapeGetDataLength",
  "sp48TapeGetCurrentBlockIndex",
  "sp48TapeGetLoaded",
  "sp48TapeGetEof",
  "sp48TapeGetUploadActive",
  "sp48TapeGetMode",
  "sp48TapeGetPlayPhase",
  "sp48TapeGetCurrentEarBit",
  "sp48TapeGetCurrentDataIndex",
  "sp48TapeGetCurrentBitMask",
  "sp48TapeGetStartTact",
  "sp48TapeGetModeChangeCount",
  "sp48TapeGetLastModeChangeTact",
  "sp48TapeGetLastModeChangePc",
  "sp48TapeGetLoadStartCount",
  "sp48TapeGetSaveStartCount",
  "sp48TapeClassifySavePulse",
  "sp48TapeGetSavePhase",
  "sp48TapeGetSaveLastPulse",
  "sp48TapeGetSaveMicBit",
  "sp48TapeGetSaveLastMicBitTact",
  "sp48TapeGetSavePilotPulseCount",
  "sp48TapeGetSavedBlockCount",
  "sp48TapeGetSavedDataLength",
  "sp48TapeGetSavedRevision",
  "sp48TapeGetSaveDataCapacity",
  "sp48TapeGetSaveMaxBlocks",
  "sp48TapeGetSavedBlockOffset",
  "sp48TapeGetSavedBlockLength",
  "sp48TapeClearSavedBlocks",
  "sp48TapeGetEarBit",
  "sp48TapeGetBlockOffset",
  "sp48TapeGetBlockLength",
  "sp48TapeGetBlockPauseAfter",
  "sp48TapeGetBlockPilotPulseLength",
  "sp48TapeGetBlockSync1PulseLength",
  "sp48TapeGetBlockSync2PulseLength",
  "sp48TapeGetBlockZeroBitPulseLength",
  "sp48TapeGetBlockOneBitPulseLength",
  "sp48TapeGetBlockEndSyncPulseLength",
  "sp48TapeGetBlockLastByteUsedBits",
  "sp48TapeGetBlockPilotPulseCount",
  "sp48GetKeyboardLine",
  "sp48GetPortFeValue",
  "sp48GetBorderColor",
  "sp48GetEarBit",
  "sp48GetMicBit",
  "sp48GetBeeperLevel",
  "sp48GetEarBitChangedFrom0Tacts",
  "sp48GetEarBitChangedFrom1Tacts",
  "sp48GetDiagnosticFlags",
  // --- RZX playback and recording (`.plans/RZX_PLAN.md` §4.2)
  ...rzxExports("sp48")
];

const buildModes = {
  production: {
    output: productionOutput,
    exports: productionExports,
    sources: [source],
    // --- 14 MB: the 4 MB execution-history ring (EXECUTION_HISTORY_ALL_CORES_PLAN D2, D3) and the
    // --- access profile's 64 KB of flags and 1.5 MB counter pool (CODE_COVERAGE_AND_HEAT_MAP_PLAN D5)
    initialMemory: 14 * 1024 * 1024
  }
};

function normalizeBuildMode(mode = process.env.SP48_WASM_BUILD_MODE || "production") {
  if (buildModes[mode] == null) {
    throw new Error(`Unknown ZX Spectrum 48K WASM build mode '${mode}'. Expected: production.`);
  }
  return mode;
}

function normalizeOptimization(optimization = process.env.SP48_WASM_OPTIMIZATION || "speed") {
  if (optimizationProfiles[optimization] == null) {
    throw new Error(`Unknown ZX Spectrum 48K WASM optimization profile '${optimization}'. Expected one of: ${Object.keys(optimizationProfiles).join(", ")}.`);
  }
  return optimization;
}

function buildSp48Wasm({
  compiler = process.env.SP48_WASM_CC || "clang",
  mode = process.env.SP48_WASM_BUILD_MODE || "production",
  optimization = process.env.SP48_WASM_OPTIMIZATION || "speed",
  outputPath,
  run = spawnSync
} = {}) {
  const buildMode = normalizeBuildMode(mode);
  const optimizationProfile = normalizeOptimization(optimization);
  const selected = buildModes[buildMode];
  const selectedOutput = outputPath ?? selected.output;
  // --- A real build is staged and renamed into place (see `publishWasmOutput`)
  const compiledOutput = stagingWasmOutput(selectedOutput, run === spawnSync);
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
    ...selected.exports.filter(name => name !== "memory").map(name => `-Wl,--export=${name}`),
    ...selected.sources,
    "-o",
    compiledOutput
  ];
  const layoutMap = layoutMapPath(selectedOutput);
  const result = run(compiler, [...args, ...layoutMapArgs(layoutMap)], { cwd: root, stdio: "inherit" });
  if (result.error || result.status !== 0) discardWasmOutput(compiledOutput, selectedOutput);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ZX Spectrum 48K WASM compilation failed (${result.status}).`);
  if (!existsSync(compiledOutput) || statSync(compiledOutput).size === 0) {
    throw new Error(
      `ZX Spectrum 48K WASM compilation reported success (compiler: '${compiler}'), but '${selectedOutput}' is missing or empty. ` +
      `The build must not continue - packaging this app would ship a broken emulator.`
    );
  }
  // --- The memory layout a Klive state file depends on (scripts/wasm-layout.cjs)
  const layout = stampWasmLayout(compiledOutput, layoutMap, SP48_VOLATILE_SYMBOLS, SP48_SCRATCH_SYMBOLS);
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
}

function buildAllSp48Wasm(options = {}) {
  return [buildSp48Wasm(options)];
}

if (require.main === module) buildAllSp48Wasm();

// --- electron-builder resource paths and package.json config use forward slashes on
// --- every platform, so never leak Windows backslashes from path.relative().
function toPosixRelative(from, to) {
  return relative(from, to).split(sep).join("/");
}

module.exports = {
  SP48_VOLATILE_SYMBOLS,
  buildSp48Wasm,
  buildAllSp48Wasm,
  buildModes,
  output,
  productionOutput,
  packagedArtifactRelative,
  packagedResourceDirectory,
  productionExports,
  source,
  wasmDistDirectory,
  outputRelative: toPosixRelative(root, output),
  productionOutputRelative: toPosixRelative(root, productionOutput),
  wasmDistDirectoryRelative: toPosixRelative(root, wasmDistDirectory)
};
