const { existsSync, mkdirSync, readdirSync, unlinkSync } = require("node:fs");
const { dirname, relative, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = resolve(__dirname, "..");
const source = resolve(root, "src/emu/machines/zxSpectrum128/wasm/v2/sp128/sp128.c");
const productionOutput = resolve(root, "src/emu/machines/zxSpectrum128/wasm/dist/zx-spectrum128.wasm");
const output = productionOutput;
const wasmDistDirectory = resolve(root, "src/emu/machines/zxSpectrum128/wasm/dist");
const packagedResourceDirectory = "wasm/zxSpectrum128";
const packagedArtifactRelative = `${packagedResourceDirectory}/zx-spectrum128.wasm`;

const optimizationProfiles = {
  speed: ["-O3"],
  size: ["-Oz"],
  lto: ["-O3", "-flto"]
};

const productionExports = [
  "memory",
  "sp128MemoryPtr",
  "sp128RamPtr",
  "sp128RomPtr",
  "sp128PixelBufferPtr",
  "sp128AudioSamplesPtr",
  "sp128KeyboardLinesPtr",
  "sp128Reset",
  "sp128HardReset",
  "sp128ExecuteFrame",
  "sp128ExecuteInstruction",
  "sp128RenderInstantScreen",
  "sp128UploadRomByte",
  "sp128ReadMemory",
  "sp128WriteMemory",
  "sp128ReadRamBank",
  "sp128WriteRamBank",
  "sp128ReadRomBank",
  "sp128ReadScreenMemoryOffset",
  "sp128ReadFloatingBus",
  "sp128SetKeyStatus",
  "sp128ReadPort",
  "sp128WritePort",
  "sp128SetAudioSampleRate",
  "sp128DelayAddressBusAccess",
  "sp128DelayPortRead",
  "sp128DelayPortWrite",
  "sp128ResetContentionCounters",
  "sp128SetContentionValue",
  "sp128GetMemorySize",
  "sp128GetRamSize",
  "sp128GetRomSize",
  "sp128GetScreenWidth",
  "sp128GetScreenHeight",
  "sp128GetPixelBufferStartOffset",
  "sp128GetAudioSampleCount",
  "sp128GetAudioSampleCapacity",
  "sp128GetTactsInFrame",
  "sp128GetFrames",
  "sp128GetTacts",
  "sp128SetTacts",
  "sp128GetSelectedRom",
  "sp128GetSelectedBank",
  "sp128GetPagingEnabled",
  "sp128GetUseShadowScreen",
  "sp128GetScreenBank",
  "sp128GetCurrentPartition",
  "sp128GetContentionValue",
  "sp128GetTotalContentionDelaySinceStart",
  "sp128GetContentionDelaySincePause",
  "sp128GetCpuInstructionsExecuted",
  "sp128GetCpuFrameSliceInstructions",
  "sp128GetCpuTacts",
  "sp128GetCpuAf",
  "sp128SetCpuAf",
  "sp128GetCpuBc",
  "sp128SetCpuBc",
  "sp128GetCpuDe",
  "sp128SetCpuDe",
  "sp128GetCpuHl",
  "sp128SetCpuHl",
  "sp128GetCpuIx",
  "sp128SetCpuIx",
  "sp128GetCpuIy",
  "sp128SetCpuIy",
  "sp128GetCpuPc",
  "sp128SetCpuPc",
  "sp128GetCpuSp",
  "sp128SetCpuSp",
  "sp128GetCpuHalted",
  "sp128GetCpuPrefix",
  "sp128GetLastMemoryAddress",
  "sp128GetLastMemoryValue",
  "sp128GetLastMemoryIsWrite",
  "sp128GetLastPortAddress",
  "sp128GetLastPortValue",
  "sp128GetLastPortIsWrite",
  "sp128GetKeyboardLine",
  "sp128GetPortFeValue",
  "sp128GetBorderColor",
  "sp128GetEarBit",
  "sp128GetMicBit",
  "sp128GetBeeperLevel",
  "sp128GetAudioSampleRate",
  "sp128GetPsgRegisterIndex",
  "sp128SetPsgRegisterIndex",
  "sp128GetPsgRegisterValue",
  "sp128WritePsgRegisterValue",
  "sp128ReadPsgRegisterValue",
  "sp128GetPsgToneA",
  "sp128GetPsgVolumeA",
  "sp128GetPsgCurrentOutput",
  "sp128TapeDataPtr",
  "sp128TapeSaveDataPtr",
  "sp128TapeClear",
  "sp128TapeBeginUpload",
  "sp128TapeSetBlock",
  "sp128TapeWriteData",
  "sp128TapeFinishUpload",
  "sp128TapeRewind",
  "sp128TapeSetMode",
  "sp128TapeSetFastLoad",
  "sp128TapeGetFastLoad",
  "sp128TapeGetMaxBlocks",
  "sp128TapeGetDataCapacity",
  "sp128TapeGetSaveDataCapacity",
  "sp128TapeGetSaveMaxBlocks",
  "sp128TapeGetBlockCount",
  "sp128TapeGetDataLength",
  "sp128TapeGetLoaded",
  "sp128TapeGetEof",
  "sp128TapeGetUploadActive",
  "sp128TapeGetMode",
  "sp128TapeGetCurrentBlockIndex",
  "sp128TapeGetCurrentEarBit",
  "sp128TapeGetBlockOffset",
  "sp128TapeGetBlockLength",
  "sp128TapeGetBlockPauseAfter",
  "sp128TapeGetSavedBlockCount",
  "sp128TapeGetSavedDataLength",
  "sp128TapeGetSavedRevision",
  "sp128TapeGetSavedBlockOffset",
  "sp128TapeGetSavedBlockLength",
  "sp128TapeClearSavedBlocks",
  "sp128TapeAppendSavedByte",
  "sp128GetDiagnosticFlags"
];

const buildModes = {
  production: {
    output: productionOutput,
    exports: productionExports,
    sources: [source],
    initialMemory: 8 * 1024 * 1024
  }
};

function normalizeBuildMode(mode = process.env.SP128_WASM_BUILD_MODE || "production") {
  if (buildModes[mode] == null) {
    throw new Error(`Unknown ZX Spectrum 128K WASM build mode '${mode}'. Expected: production.`);
  }
  return mode;
}

function normalizeOptimization(optimization = process.env.SP128_WASM_OPTIMIZATION || "speed") {
  if (optimizationProfiles[optimization] == null) {
    throw new Error(`Unknown ZX Spectrum 128K WASM optimization profile '${optimization}'. Expected one of: ${Object.keys(optimizationProfiles).join(", ")}.`);
  }
  return optimization;
}

function buildSp128Wasm({
  compiler = process.env.SP128_WASM_CC || "clang",
  mode = process.env.SP128_WASM_BUILD_MODE || "production",
  optimization = process.env.SP128_WASM_OPTIMIZATION || "speed",
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
  if (result.status !== 0) throw new Error(`ZX Spectrum 128K WASM compilation failed (${result.status}).`);
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

function buildAllSp128Wasm(options = {}) {
  return [buildSp128Wasm(options)];
}

if (require.main === module) buildAllSp128Wasm();

module.exports = {
  buildSp128Wasm,
  buildAllSp128Wasm,
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
