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

/**
 * Statics a Klive state file leaves out (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` trap 10):
 * debugging state and buffers the core rewrites before it reads them, so a restore keeps the live
 * core's bytes there.
 */
const SPP3E_VOLATILE_SYMBOLS = [
  // --- The IDE's breakpoint conditions and the per-instruction access log they read: debugging
  // --- state, not machine state, so a restore never brings back old breakpoints
  "condArena",
  "condSlots",
  "condToken",
  "condLastStatus",
  "condEnv",
  "z80AccessLog",
  "z80AccessLogCount",
  "z80AccessLogOverflows",
  // --- An RZX session in progress (`zx-spectrum-rzx.c`)
  ...RZX_VOLATILE_SYMBOLS
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
  "condArenaPtr",
  "condArenaCapacity",
  "condSlotTablePtr",
  "condSlotCapacity",
  "condMaxProgramWords",
  "condGetToken",
  "condSetToken",
  "condGetLastStatus",
  "condEvaluate",
  "condEvaluateValue",
  "condSetEnv",
  "condPeek",
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
  "spp3eGetCpuAf",
  "spp3eSetCpuAf",
  "spp3eGetCpuAfAlt",
  "spp3eSetCpuAfAlt",
  "spp3eGetCpuBcAlt",
  "spp3eSetCpuBcAlt",
  "spp3eGetCpuDeAlt",
  "spp3eSetCpuDeAlt",
  "spp3eGetCpuHlAlt",
  "spp3eSetCpuHlAlt",
  "spp3eGetCpuBc",
  "spp3eSetCpuBc",
  "spp3eGetCpuDe",
  "spp3eSetCpuDe",
  "spp3eGetCpuHl",
  "spp3eSetCpuHl",
  "spp3eGetCpuIx",
  "spp3eSetCpuIx",
  "spp3eGetCpuIy",
  "spp3eSetCpuIy",
  "spp3eGetCpuIr",
  "spp3eSetCpuIr",
  "spp3eGetCpuWz",
  "spp3eSetCpuWz",
  "spp3eGetCpuPc",
  "spp3eGetStepOutAddress",
  "spp3eGetInterruptDepth",
  "spp3eSetCpuPc",
  "spp3eGetCpuSp",
  "spp3eSetCpuSp",
  "spp3eGetCpuHalted",
  "spp3eSetCpuHalted",
  "spp3eGetCpuEiBacklog",
  "spp3eSetCpuEiBacklog",
  "spp3eGetCpuPrefix",
  "spp3eGetCpuIff1",
  "spp3eSetCpuIff1",
  "spp3eGetCpuIff2",
  "spp3eSetCpuIff2",
  "spp3eGetCpuInterruptMode",
  "spp3eSetCpuInterruptMode",
  "spp3eGetCpuRetExecuted",
  "spp3eGetCpuRetnExecuted",
  "spp3eGetAccessLogPtr",
  "spp3eGetAccessLogCount",
  "spp3eGetAccessLogOverflows",
  "spp3eGetLastPortAddress",
  "spp3eGetLastPortValue",
  "spp3eGetLastPortIsWrite",
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
    initialMemory: 8 * 1024 * 1024
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
