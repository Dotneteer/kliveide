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
const { cpuExports, Z80_ACCESS_LOG_VOLATILE_SYMBOLS } = require("./z80-cpu-exports.cjs");
const { Z80_CONDITION_EXPORTS, Z80_CONDITION_VOLATILE_SYMBOLS } = require("./z80-condition-exports.cjs");
const { Z80_HISTORY_EXPORTS, Z80_HISTORY_VOLATILE_SYMBOLS } = require("./z80-history-exports.cjs");
const { Z80_PROFILE_EXPORTS, Z80_PROFILE_VOLATILE_SYMBOLS } = require("./z80-profile-exports.cjs");

/**
 * Statics a Klive state file leaves out (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` trap 10):
 * debugging state and buffers the core rewrites before it reads them, so a restore keeps the live
 * core's bytes there.
 */
const SPP3E_VOLATILE_SYMBOLS = [
  // --- The IDE's breakpoint conditions and the per-instruction access log they read: debugging
  // --- state, not machine state, so a restore never brings back old breakpoints
  ...Z80_CONDITION_VOLATILE_SYMBOLS,
  ...Z80_ACCESS_LOG_VOLATILE_SYMBOLS,
  // --- An RZX session in progress (`zx-spectrum-rzx.c`)
  ...RZX_VOLATILE_SYMBOLS,
  // --- The execution-history ring (EXECUTION_HISTORY_ALL_CORES_PLAN)
  ...Z80_HISTORY_VOLATILE_SYMBOLS,
  // --- The access profile: flags, counters and time (CODE_COVERAGE_AND_HEAT_MAP_PLAN T4, T7)
  ...Z80_PROFILE_VOLATILE_SYMBOLS
];

const root = resolve(__dirname, "..");
const source = resolve(root, "src/emu/machines/zxSpectrumP3e/wasm/spp3e/spp3e.c");
const productionOutput = resolve(root, "src/emu/machines/zxSpectrumP3e/wasm/dist/zx-spectrum-p3e.wasm");
const output = productionOutput;
const wasmDistDirectory = resolve(root, "src/emu/machines/zxSpectrumP3e/wasm/dist");
const packagedResourceDirectory = "wasm/zxSpectrumP3e";
const packagedArtifactRelative = `${packagedResourceDirectory}/zx-spectrum-p3e.wasm`;

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
  "spp3eMemoryPtr",
  "spp3eRamPtr",
  "spp3eRomPtr",
  "spp3ePixelBufferPtr",
  "spp3eAudioSamplesPtr",
  "spp3eKeyboardLinesPtr",
  "spp3eDiskDataPtr",
  "spp3eDiskBDataPtr",
  "spp3eDiskChangesPtr",
  "spp3eDiskBChangesPtr",
  "spp3eTapeDataPtr",
  "spp3eTapeSaveDataPtr",
  "spp3eReset",
  "spp3eHardReset",
  "spp3eExecuteFrame",
  "spp3eExecuteInstruction",
  "spp3eRenderInstantScreen",
  "spp3eUploadRomByte",
  "spp3eReadMemory",
  "spp3eWriteMemory",
  "spp3eReadRamBank",
  "spp3eWriteRamBank",
  "spp3eReadRomBank",
  "spp3eReadScreenMemoryOffset",
  "spp3ePeekMemory",
  "spp3ePeekScreenMemoryOffset",
  "spp3eReadFloatingBus",
  "spp3eSetKeyStatus",
  "spp3eReadPort",
  "spp3eWritePort",
  "spp3eGetMemorySize",
  "spp3eGetRamSize",
  "spp3eGetRomSize",
  "spp3eGetScreenWidth",
  "spp3eGetScreenHeight",
  "spp3eGetPixelBufferStartOffset",
  "spp3eGetAudioSampleCapacity",
  "spp3eGetAudioSampleCount",
  "spp3eGetAudioSampleRate",
  "spp3eSetAudioSampleRate",
  "spp3eGetDiskDataCapacity",
  "spp3eGetDiskChangeCapacity",
  "spp3eGetDiskDriveCount",
  "spp3eGetFdcEnabledDriveCount",
  "spp3eSetFdcEnabledDriveCount",
  "spp3eFdcResetController",
  "spp3eFdcGetMainStatusRegister",
  "spp3eFdcGetStatusRegister0",
  "spp3eFdcGetStatusRegister1",
  "spp3eFdcGetStatusRegister2",
  "spp3eFdcGetStatusRegister3",
  "spp3eFdcGetOperationPhase",
  "spp3eFdcGetCurrentDrive",
  "spp3eFdcGetResultBytesLeft",
  "spp3eFdcGetDataRegister",
  "spp3eFdcGetResultRegister",
  "spp3eFdcGetCommandId",
  "spp3eFdcGetCommandRegister",
  "spp3eFdcGetCommandBytesReceived",
  "spp3eFdcGetStepRate",
  "spp3eFdcGetHeadUnloadTime",
  "spp3eFdcGetHeadLoadTime",
  "spp3eFdcGetNonDmaMode",
  "spp3eFdcGetDirtyDrive",
  "spp3eFdcGetDirtyOffset",
  "spp3eFdcGetDirtyLength",
  "spp3eFdcGetDirtyRevision",
  "spp3eFdcSetResultPhase",
  "spp3eFdcSelectDrive",
  "spp3eDiskBeginUpload",
  "spp3eDiskWriteData",
  "spp3eDiskFinishUpload",
  "spp3eDiskEject",
  "spp3eDiskSetWriteProtected",
  "spp3eDiskReadData",
  "spp3eDiskGetLoaded",
  "spp3eDiskGetWriteProtected",
  "spp3eDiskGetSelected",
  "spp3eDiskGetHasTwoHeads",
  "spp3eDiskGetCurrentHead",
  "spp3eDiskGetTrack0",
  "spp3eDiskGetReady",
  "spp3eDiskGetMotorOn",
  "spp3eDiskGetMotorSpeed",
  "spp3eDiskGetCurrentCylinder",
  "spp3eDiskGetMaxCylinders",
  "spp3eDiskGetHeadLoaded",
  "spp3eDiskGetLength",
  "spp3eDiskGetRevision",
  "spp3eGetTapeMaxBlocks",
  "spp3eGetTapeDataCapacity",
  "spp3eGetTapeSaveMaxBlocks",
  "spp3eGetTapeSaveDataCapacity",
  "spp3eTapeClear",
  "spp3eTapeBeginUpload",
  "spp3eTapeSetBlock",
  "spp3eTapeWriteData",
  "spp3eTapeFinishUpload",
  "spp3eTapeRewind",
  "spp3eTapeSetMode",
  "spp3eTapeSetFastLoad",
  "spp3eTapeGetFastLoad",
  "spp3eTapeGetBlockCount",
  "spp3eTapeGetDataLength",
  "spp3eTapeGetLoaded",
  "spp3eTapeGetEof",
  "spp3eTapeGetUploadActive",
  "spp3eTapeGetMode",
  "spp3eTapeGetCurrentBlockIndex",
  "spp3eTapeGetCurrentEarBit",
  "spp3eTapeGetBlockOffset",
  "spp3eTapeGetBlockLength",
  "spp3eTapeGetBlockPauseAfter",
  "spp3eTapeClearSavedBlocks",
  "spp3eTapeAppendSavedByte",
  "spp3eTapeGetSavedBlockCount",
  "spp3eTapeGetSavedDataLength",
  "spp3eTapeGetSavedRevision",
  "spp3eTapeGetSavedBlockOffset",
  "spp3eTapeGetSavedBlockLength",
  "spp3eGetPsgRegisterIndex",
  "spp3eSetPsgRegisterIndex",
  "spp3eGetPsgRegisterValue",
  "spp3eWritePsgRegisterValue",
  "spp3eReadPsgRegisterValue",
  "spp3eGetPsgToneA",
  "spp3eGetPsgToneB",
  "spp3eGetPsgToneC",
  "spp3eGetPsgVolumeA",
  "spp3eGetPsgVolumeB",
  "spp3eGetPsgVolumeC",
  "spp3eGetPsgCurrentOutput",
  "spp3eGetTactsInFrame",
  "spp3eGetFrames",
  "spp3eGetTacts",
  "spp3eGetCurrentFrameTact",
  "spp3eGetFrameCompleted",
  "spp3eSetTacts",
  // --- Test hooks: move the tact origin, to reach the counter's rebase quickly
  "spp3eTestAdvanceTacts",
  "spp3eTestGetTactEpoch",
  "spp3eGetSelectedRom",
  "spp3eGetSelectedBank",
  "spp3eGetPagingEnabled",
  "spp3eGetPort7ffd",
  "spp3eGetPort1ffd",
  "spp3eGetUseShadowScreen",
  "spp3eGetScreenBank",
  "spp3eGetInSpecialPagingMode",
  "spp3eGetSpecialConfigMode",
  "spp3eGetDiskMotorOn",
  "spp3eGetCurrentPartition",
  "spp3eGetRomFlag",
  "spp3eGetContentionValue",
  "spp3eSetContentionValue",
  "spp3eGetRenderingPhase",
  "spp3eGetRenderingPixelAddress",
  "spp3eGetRenderingAttributeAddress",
  "spp3eGetRenderingPixelIndex",
  "spp3eGetBeamInfo",
  "spp3eRenderToBeam",
  "spp3eDelayAddressBusAccess",
  "spp3eDelayPortRead",
  "spp3eDelayPortWrite",
  "spp3eResetContentionCounters",
  "spp3eGetTotalContentionDelaySinceStart",
  "spp3eGetContentionDelaySincePause",
  "spp3eGetCpuInstructionsExecuted",
  "spp3eGetCpuFrameSliceInstructions",
  "spp3eGetInterruptsRaised",
  "spp3eGetInterruptLineActive",
  "spp3eGetCpuTacts",
  ...cpuExports("spp3e", { snapshotState: true, accessLog: true, accessLogOverflows: true, lastPort: true }),
  "spp3eGetKeyboardLine",
  "spp3eGetPortFeValue",
  "spp3eGetBorderColor",
  "spp3eGetEarBit",
  "spp3eGetMicBit",
  "spp3eGetBeeperLevel",
  "spp3eGetLastContendedValue",
  "spp3eGetLastUlaReadValue",
  "spp3eSetLastContendedValue",
  "spp3eSetLastUlaReadValue",
  // --- RZX playback and recording (`.plans/RZX_PLAN.md` §4.2)
  ...rzxExports("spp3e")
];

const buildModes = {
  production: {
    output: productionOutput,
    exports: productionExports,
    sources: [source],
    // --- 12 MB: the 4 MB execution-history ring (EXECUTION_HISTORY_ALL_CORES_PLAN D2, D3)
    // --- 18 MB: the access profile's 192 KB of flags and its 24-page (4.5 MB) counter pool, which
    // --- covers all physical memory (CODE_COVERAGE_AND_HEAT_MAP_PLAN D5, T6)
    initialMemory: 18 * 1024 * 1024
  }
};

function normalizeBuildMode(mode = process.env.SPP3E_WASM_BUILD_MODE || "production") {
  if (buildModes[mode] == null) {
    throw new Error(`Unknown ZX Spectrum +3E WASM build mode '${mode}'. Expected: production.`);
  }
  return mode;
}

function normalizeOptimization(optimization = process.env.SPP3E_WASM_OPTIMIZATION || "speed") {
  if (optimizationProfiles[optimization] == null) {
    throw new Error(`Unknown ZX Spectrum +3E WASM optimization profile '${optimization}'. Expected one of: ${Object.keys(optimizationProfiles).join(", ")}.`);
  }
  return optimization;
}

function buildSpP3eWasm({
  compiler = process.env.SPP3E_WASM_CC || "clang",
  mode = process.env.SPP3E_WASM_BUILD_MODE || "production",
  optimization = process.env.SPP3E_WASM_OPTIMIZATION || "speed",
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
  if (result.status !== 0) throw new Error(`ZX Spectrum +3E WASM compilation failed (${result.status}).`);
  if (!existsSync(compiledOutput) || statSync(compiledOutput).size === 0) {
    throw new Error(
      `ZX Spectrum +3E WASM compilation reported success (compiler: '${compiler}'), but '${selectedOutput}' is missing or empty. ` +
      `The build must not continue - packaging this app would ship a broken emulator.`
    );
  }
  // --- The memory layout a Klive state file depends on (scripts/wasm-layout.cjs)
  const layout = stampWasmLayout(compiledOutput, layoutMap, SPP3E_VOLATILE_SYMBOLS);
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

function buildAllSpP3eWasm(options = {}) {
  return [buildSpP3eWasm(options)];
}

if (require.main === module) buildAllSpP3eWasm();

// --- electron-builder resource paths and package.json config use forward slashes on
// --- every platform, so never leak Windows backslashes from path.relative().
function toPosixRelative(from, to) {
  return relative(from, to).split(sep).join("/");
}

module.exports = {
  SPP3E_VOLATILE_SYMBOLS,
  buildSpP3eWasm,
  buildAllSpP3eWasm,
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
