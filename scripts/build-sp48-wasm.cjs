const { existsSync, mkdirSync, readdirSync, unlinkSync } = require("node:fs");
const { dirname, relative, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = resolve(__dirname, "..");
const source = resolve(root, "src/emu/machines/zxSpectrum48/wasm/v2/sp48/sp48.c");
const productionOutput = resolve(root, "src/emu/machines/zxSpectrum48/wasm/dist/zx-spectrum48.wasm");
const output = productionOutput;
const wasmDistDirectory = resolve(root, "src/emu/machines/zxSpectrum48/wasm/dist");
const packagedResourceDirectory = "wasm/zxSpectrum48";
const packagedArtifactRelative = `${packagedResourceDirectory}/zx-spectrum48.wasm`;

const optimizationProfiles = {
  speed: ["-O3"],
  size: ["-Oz"],
  lto: ["-O3", "-flto"]
};

const productionExports = [
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
  "sp48GetRenderingPhase",
  "sp48GetRenderingPixelAddress",
  "sp48GetRenderingAttributeAddress",
  "sp48GetRenderingPixelIndex",
  "sp48GetTotalContentionDelaySinceStart",
  "sp48GetContentionDelaySincePause",
  "sp48GetNextFrameStartTact",
  "sp48GetFrameCompleted",
  "sp48GetInterruptsRaised",
  "sp48GetInterruptLineActive",
  "sp48GetCpuInstructionsExecuted",
  "sp48GetCpuFrameSliceInstructions",
  "sp48GetCpuTacts",
  "sp48GetCpuAf",
  "sp48SetCpuAf",
  "sp48GetCpuBc",
  "sp48SetCpuBc",
  "sp48GetCpuDe",
  "sp48SetCpuDe",
  "sp48GetCpuHl",
  "sp48SetCpuHl",
  "sp48GetCpuIx",
  "sp48SetCpuIx",
  "sp48GetCpuIy",
  "sp48SetCpuIy",
  "sp48GetCpuAfAlt",
  "sp48SetCpuAfAlt",
  "sp48GetCpuBcAlt",
  "sp48GetCpuDeAlt",
  "sp48GetCpuHlAlt",
  "sp48GetCpuIr",
  "sp48GetCpuWz",
  "sp48GetCpuPc",
  "sp48SetCpuPc",
  "sp48GetCpuSp",
  "sp48SetCpuSp",
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
  "sp48GetCpuHalted",
  "sp48GetCpuPrefix",
  "sp48GetCpuIff1",
  "sp48SetCpuIff1",
  "sp48GetCpuInterruptMode",
  "sp48SetCpuInterruptMode",
  "sp48GetCpuRetExecuted",
  "sp48GetCpuRetnExecuted",
  "sp48GetLastMemoryAddress",
  "sp48GetLastMemoryValue",
  "sp48GetLastMemoryIsWrite",
  "sp48GetLastPortAddress",
  "sp48GetLastPortValue",
  "sp48GetLastPortIsWrite",
  "sp48GetKeyboardLine",
  "sp48GetPortFeValue",
  "sp48GetBorderColor",
  "sp48GetEarBit",
  "sp48GetMicBit",
  "sp48GetBeeperLevel",
  "sp48GetEarBitChangedFrom0Tacts",
  "sp48GetEarBitChangedFrom1Tacts",
  "sp48GetDiagnosticFlags"
];

const buildModes = {
  production: {
    output: productionOutput,
    exports: productionExports,
    sources: [source],
    initialMemory: 8 * 1024 * 1024
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
  if (existsSync(wasmDistDirectory)) {
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
    selectedOutput
  ];
  const result = run(compiler, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ZX Spectrum 48K WASM compilation failed (${result.status}).`);
  return {
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

module.exports = {
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
  outputRelative: relative(root, output),
  productionOutputRelative: relative(root, productionOutput),
  wasmDistDirectoryRelative: relative(root, wasmDistDirectory)
};
