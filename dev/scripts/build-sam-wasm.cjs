const { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } = require("node:fs");
const { dirname, relative, resolve, sep } = require("node:path");
const { spawnSync } = require("node:child_process");

const { acquireWasmBuildLock, waitForWasmBuildLock } = require("./wasm-build-lock.cjs");
const { cpuExports, debugLoopExports, debugLoopVolatileSymbols, Z80_ACCESS_LOG_VOLATILE_SYMBOLS } = require("./z80-cpu-exports.cjs");
const { Z80_CONDITION_EXPORTS, Z80_CONDITION_VOLATILE_SYMBOLS } = require("./z80-condition-exports.cjs");
const { Z80_HISTORY_EXPORTS, Z80_HISTORY_VOLATILE_SYMBOLS } = require("./z80-history-exports.cjs");
const { Z80_PROFILE_EXPORTS, Z80_PROFILE_VOLATILE_SYMBOLS } = require("./z80-profile-exports.cjs");
const { REPO_ROOT } = require("./repo-root.cjs");
const { KLIVE_AUDIO_CHANNEL_VOLATILE_SYMBOLS, zxAudioChannelExports } = require("./zx-audio-channel-exports.cjs");
const {
  discardWasmOutput,
  layoutMapArgs,
  layoutMapPath,
  publishWasmOutput,
  stagingWasmOutput,
  stampWasmLayout
} = require("./wasm-layout.cjs");

/**
 * Statics a Klive state file leaves out (`dev/plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` trap 10):
 * debugging state and buffers the core rewrites before it reads them, so a restore keeps the live
 * core's bytes there.
 */
const SAM_VOLATILE_SYMBOLS = [
  // --- The IDE's breakpoint conditions and the per-instruction access log they read: debugging
  // --- state, not machine state, so a restore never brings back old breakpoints
  ...Z80_CONDITION_VOLATILE_SYMBOLS,
  ...debugLoopVolatileSymbols("sam"),
  ...Z80_ACCESS_LOG_VOLATILE_SYMBOLS,
  // --- The rest of the IDE's bus record, and whether it is being recorded
  "samOpStartAddress",
  "samCaptureBusEvents",
  // --- The execution-history ring (EXECUTION_HISTORY_ALL_CORES_PLAN)
  ...Z80_HISTORY_VOLATILE_SYMBOLS,
  // --- The access profile: flags, counters and time (CODE_COVERAGE_AND_HEAT_MAP_PLAN T4, T7)
  ...Z80_PROFILE_VOLATILE_SYMBOLS,
  // --- The audio mixer's gains and taps, and the heard mix's integrator and filter (sam-audio.c): a gain
  // --- change between recording and a Step Back must not read as a diverged replay
  ...KLIVE_AUDIO_CHANNEL_VOLATILE_SYMBOLS,
  "samAudioHeardSamples",
  "samAudioLastPoint",
  "samAudioAccSaaLeft",
  "samAudioAccSaaRight",
  "samAudioAccBeeper",
  "samAudioAccTape",
  "samAudioAccUnits",
  "samAudioDcInLeft",
  "samAudioDcInRight",
  "samAudioDcOutLeft",
  "samAudioDcOutRight"
];

/*
 * Builds the SAM Coupé full-machine WASM core (`dev/plans/SAM_COUPE_PLAN.md`).
 *
 * The Enterprise's shape: plain clang for wasm32 (no Emscripten), one translation unit, a fixed linear
 * memory, and an explicit export allow-list. Builds of the production artifact are serialized with a lock
 * file, because vitest workers build it in parallel.
 */

const root = REPO_ROOT;
const source = resolve(root, "src/emu/machines/samcoupe/wasm/sam/sam.c");
const wasmDistDirectory = resolve(root, "src/emu/machines/samcoupe/wasm/dist");
const productionOutput = resolve(wasmDistDirectory, "sam.wasm");
const output = productionOutput;
const buildLockPath = resolve(wasmDistDirectory, ".sam.wasm.lock");
const packagedResourceDirectory = "wasm/samcoupe";
const packagedArtifactRelative = `${packagedResourceDirectory}/sam.wasm`;

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
  ...cpuExports("sam", { accessLog: true, lastPort: true }),
  // --- The debugger's in-core loop (`z80-debug-loop.c`)
  ...debugLoopExports("sam"),
  // --- The audio mixer
  ...zxAudioChannelExports("sam"),
  "samAudioSamplesPtr",
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
  "samFdcGetBusy",
  "samFdcGetCommand",
  "samFdcGetCylinder",
  "samFdcGetData",
  "samFdcGetMotorOn",
  "samFdcGetSector",
  "samFdcGetSide",
  "samFdcGetTrack",
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
  "samGetCpuOpCode",
  "samGetExtPages",
  "samGetFlashCounter",
  "samGetFrameCompleted",
  "samGetFrameStart",
  "samGetFrameTacts",
  "samGetFrames",
  "samGetHepr",
  "samGetHmpr",
  "samGetKeyboardLine",
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
  "samTapeSetLength",
  "samTapeSetRecording",
  "samWriteMemory",
  "samWritePage",
  "samWritePort"
];


/*
 * The physical memory (1.55 MB: the ROM, 512K of internal RAM, a 1 MB external pack, the FFh page), the
 * 640 x 288 picture (720 KB), the two drives in the controllers' layout (2 x 820 KB), the tape (1 MB of
 * edges, 256 KB of SAVE ring), the 4 MiB execution-history ring and the access profile's flags (one per
 * physical byte) and counter pool.
 */
const SAM_WASM_MEMORY_BYTES = 16 * 1024 * 1024;

function normalizeOptimization(optimization = process.env.SAM_WASM_OPTIMIZATION || "speed") {
  if (optimizationProfiles[optimization] == null) {
    throw new Error(
      `Unknown SAM Coupé WASM optimization profile '${optimization}'. Expected one of: ${Object.keys(optimizationProfiles).join(", ")}.`
    );
  }
  return optimization;
}

function buildSamWasm({
  compiler = process.env.SAM_WASM_CC || "clang",
  optimization = process.env.SAM_WASM_OPTIMIZATION || "speed",
  outputPath,
  run = spawnSync
} = {}) {
  const optimizationProfile = normalizeOptimization(optimization);
  const selectedOutput = outputPath ?? productionOutput;
  // --- A real build is staged and renamed into place (see `publishWasmOutput`)
  const compiledOutput = stagingWasmOutput(selectedOutput, run === spawnSync);
  const releaseBuildLock =
    selectedOutput === productionOutput && run === spawnSync
      ? acquireWasmBuildLock(buildLockPath, "SAM Coupé")
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
      `-Wl,--initial-memory=${SAM_WASM_MEMORY_BYTES}`,
      `-Wl,--max-memory=${SAM_WASM_MEMORY_BYTES}`,
      ...productionExports.filter((name) => name !== "memory").map((name) => `-Wl,--export=${name}`),
      source,
      "-o",
      compiledOutput
    ];
    const layoutMap = layoutMapPath(selectedOutput);
    const result = run(compiler, [...args, ...layoutMapArgs(layoutMap)], { cwd: root, stdio: "inherit" });
    if (result.error || result.status !== 0) discardWasmOutput(compiledOutput, selectedOutput);
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`SAM Coupé WASM compilation failed (${result.status}).`);
    if (!existsSync(compiledOutput) || statSync(compiledOutput).size === 0) {
      throw new Error(
        `SAM Coupé WASM compilation reported success (compiler: '${compiler}'), but '${selectedOutput}' is missing or empty. ` +
          `The build must not continue - packaging this app would ship a broken emulator.`
      );
    }
    // --- The memory layout a Klive state file depends on (dev/scripts/wasm-layout.cjs)
    const layout = stampWasmLayout(compiledOutput, layoutMap, SAM_VOLATILE_SYMBOLS);
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
function waitForSamWasmBuildLock(timeoutMs) {
  waitForWasmBuildLock(buildLockPath, "SAM Coupé", timeoutMs);
}

if (require.main === module) buildSamWasm();

function toPosixRelative(from, to) {
  return relative(from, to).split(sep).join("/");
}

module.exports = {
  SAM_VOLATILE_SYMBOLS,
  buildSamWasm,
  buildLockPath,
  output,
  productionOutput,
  packagedArtifactRelative,
  packagedResourceDirectory,
  productionExports,
  source,
  waitForSamWasmBuildLock,
  wasmDistDirectory,
  SAM_WASM_MEMORY_BYTES,
  outputRelative: toPosixRelative(root, output),
  productionOutputRelative: toPosixRelative(root, productionOutput),
  wasmDistDirectoryRelative: toPosixRelative(root, wasmDistDirectory)
};
