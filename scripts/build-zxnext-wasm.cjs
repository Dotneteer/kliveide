const { existsSync, mkdirSync, readdirSync, unlinkSync } = require("node:fs");
const { dirname, relative, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = resolve(__dirname, "..");
const source = resolve(root, "src/emu/machines/zxNext/wasm/zxnext/zxnext.c");
const productionOutput = resolve(root, "src/emu/machines/zxNext/wasm/dist/zx-spectrum-next.wasm");
const output = productionOutput;
const wasmDistDirectory = resolve(root, "src/emu/machines/zxNext/wasm/dist");
const packagedResourceDirectory = "wasm/zxNext";
const packagedArtifactRelative = `${packagedResourceDirectory}/zx-spectrum-next.wasm`;

const optimizationProfiles = {
  speed: ["-O3", "-Wl,--strip-all"],
  size: ["-Oz"],
  lto: ["-O3", "-flto"]
};

const productionExports = [
  "memory",
  "zxnextMemoryPtr",
  "zxnextSramPtr",
  "zxnextRomPtr",
  "zxnextKeyboardRowsPtr",
  "zxnextNextRegsPtr",
  "zxnextPixelBufferPtr",
  "zxnextAudioSamplesPtr",
  "zxnextSdCommandBufferPtr",
  "zxnextSdResponseBufferPtr",
  "zxnextDiagnosticBufferPtr",
  "zxnextHardReset",
  "zxnextReset",
  "zxnextExecuteInstruction",
  "zxnextExecuteFrame",
  "zxnextUploadRomByte",
  "zxnextReadRomByte",
  "zxnextReadMemory",
  "zxnextWriteMemory",
  "zxnextReadScreenMemoryOffset",
  "zxnextReadPort",
  "zxnextWritePort",
  "zxnextSetPortReadValue",
  "zxnextSetKeyboardRow",
  "zxnextGetKeyboardRow",
  "zxnextGetKeyboardRowWrites",
  "zxnextSetExtendedKeyReg",
  "zxnextGetExtendedKeyReg",
  "zxnextReadUlaPort",
  "zxnextWriteUlaPort",
  "zxnextGetUlaBorderColor",
  "zxnextGetUlaEarBit",
  "zxnextGetUlaMicBit",
  "zxnextGetUlaBeeperEar",
  "zxnextGetUlaBeeperMic",
  "zxnextGetUlaBit4ChangedFrom0Tacts",
  "zxnextGetUlaBit4ChangedFrom1Tacts",
  "zxnextRenderInstantScreen",
  "zxnextGetPixelBufferStartOffset",
  "zxnextGetScreenRenderingTacts",
  "zxnextGetScreenIntStartTact",
  "zxnextGetScreenIntEndTact",
  "zxnextGetScreenIs60Hz",
  "zxnextGetScreenRenderCount",
  "zxnextGetScreenNonBlankPixelCount",
  "zxnextGetScreenBank",
  "zxnextGetUlaRenderingFlags",
  "zxnextGetRenderingHc",
  "zxnextGetRenderingVc",
  "zxnextGetRenderingPixelIndex",
  "zxnextReadNextReg",
  "zxnextWriteNextReg",
  "zxnextGetFlatMemorySize",
  "zxnextGetSramSize",
  "zxnextGetSramCapacity",
  "zxnextGetRomSize",
  "zxnextGetNextRomOffset",
  "zxnextGetDivMmcRomOffset",
  "zxnextGetMultifaceMemOffset",
  "zxnextGetAltRomOffset",
  "zxnextGetDivMmcRamOffset",
  "zxnextGetNextRamOffset",
  "zxnextGetConfiguredMemorySizeKb",
  "zxnextGetMainRamPageCount",
  "zxnextGetMaxMainRamPageCount",
  "zxnextGetActiveMainRamSize",
  "zxnextGetActiveMemorySize",
  "zxnextGetSentinelOffset",
  "zxnextGetSentinelSize",
  "zxnextConfigureMemorySize",
  "zxnextGetMmuReg",
  "zxnextSetMmuReg",
  "zxnextGetPageReadOffset",
  "zxnextGetPageWriteOffset",
  "zxnextGetPageBank16k",
  "zxnextGetPageBank8k",
  "zxnextGetCurrentPartition",
  "zxnextGetPort7ffdValue",
  "zxnextGetPortDffdValue",
  "zxnextGetPort1ffdValue",
  "zxnextGetPortEff7Value",
  "zxnextGetSelectedRomPage",
  "zxnextGetSelectedRamBank",
  "zxnextGetSelectedBankLsb",
  "zxnextGetSelectedBankMsb",
  "zxnextGetPagingEnabled",
  "zxnextGetAllRamMode",
  "zxnextGetSpecialConfig",
  "zxnextGetUseShadowScreen",
  "zxnextReadDivMmcPortE3",
  "zxnextWriteDivMmcPortE3",
  "zxnextReadSpiDataPort",
  "zxnextWriteSpiDataPort",
  "zxnextWriteSpiCsPort",
  "zxnextGetDivMmcEnabled",
  "zxnextGetDivMmcConmem",
  "zxnextGetDivMmcMapram",
  "zxnextGetDivMmcBank",
  "zxnextGetDivMmcPortE3Value",
  "zxnextGetDivMmcEnableAutomap",
  "zxnextGetDivMmcAutoMapActive",
  "zxnextGetDivMmcRstTrapEnabledMask",
  "zxnextGetDivMmcRstTrapOnlyWithRom3Mask",
  "zxnextGetDivMmcRstTrapInstantMask",
  "zxnextGetDivMmcEntry1",
  "zxnextSetSdCardInfo",
  "zxnextSetSdReadResponseByte",
  "zxnextCommitSdReadResponse",
  "zxnextSetSdWriteResponse",
  "zxnextClearSdPendingCommand",
  "zxnextGetSdSelectedCard",
  "zxnextGetSdPendingCommand",
  "zxnextGetSdPendingSector",
  "zxnextGetSdPendingCard",
  "zxnextGetSdCommandCount",
  "zxnextGetSdReadRequestCount",
  "zxnextGetSdWriteRequestCount",
  "zxnextGetSdResponseReady",
  "zxnextGetSdResponseLength",
  "zxnextGetSdResponseIndex",
  "zxnextGetNextRegIndex",
  "zxnextSetNextRegIndex",
  "zxnextReadNextRegData",
  "zxnextWriteNextRegData",
  "zxnextGetNextRegLastReadValue",
  "zxnextGetNextRegLastWrite",
  "zxnextGetNextRegHasLastWrite",
  "zxnextGetNextRegConfigMode",
  "zxnextIsPortGroupEnabled",
  "zxnextGetInternalPortEnable",
  "zxnextGetBusPortEnable",
  "zxnextNextRegHardReset",
  "zxnextNextRegReset",
  "zxnextReadPhysical",
  "zxnextWritePhysical",
  "zxnextReadSramPage",
  "zxnextWriteSramPage",
  "zxnextGetKeyboardRowCount",
  "zxnextGetNextRegCount",
  "zxnextGetScreenWidth",
  "zxnextGetScreenHeight",
  "zxnextGetAudioSampleCapacity",
  "zxnextGetSdCommandBufferSize",
  "zxnextGetSdResponseBufferSize",
  "zxnextGetDiagnosticBufferSize",
  "zxnextGetFrames",
  "zxnextGetTacts",
  "zxnextGetFrameTacts",
  "zxnextGetCurrentFrameTact",
  "zxnextGetCpuTactsPerFrame",
  "zxnextGetFrameCallCount",
  "zxnextGetLastFrameInstructionsExecuted",
  "zxnextSetTacts",
  "zxnextGetHardResetCount",
  "zxnextGetResetCount",
  "zxnextGetRomUploadCount",
  "zxnextGetUploadedRomMask",
  "zxnextGetCpuInstructionsExecuted",
  "zxnextGetCpuAf",
  "zxnextSetCpuAf",
  "zxnextGetCpuAfAlt",
  "zxnextSetCpuAfAlt",
  "zxnextGetCpuBc",
  "zxnextSetCpuBc",
  "zxnextGetCpuBcAlt",
  "zxnextSetCpuBcAlt",
  "zxnextGetCpuDe",
  "zxnextSetCpuDe",
  "zxnextGetCpuDeAlt",
  "zxnextSetCpuDeAlt",
  "zxnextGetCpuHl",
  "zxnextSetCpuHl",
  "zxnextGetCpuHlAlt",
  "zxnextSetCpuHlAlt",
  "zxnextGetCpuIx",
  "zxnextSetCpuIx",
  "zxnextGetCpuIy",
  "zxnextSetCpuIy",
  "zxnextGetCpuIr",
  "zxnextSetCpuIr",
  "zxnextGetCpuWz",
  "zxnextSetCpuWz",
  "zxnextGetCpuPc",
  "zxnextSetCpuPc",
  "zxnextGetCpuSp",
  "zxnextSetCpuSp",
  "zxnextGetCpuHalted",
  "zxnextGetCpuPrefix",
  "zxnextGetCpuIff1",
  "zxnextSetCpuIff1",
  "zxnextGetCpuIff2",
  "zxnextSetCpuIff2",
  "zxnextGetCpuInterruptMode",
  "zxnextSetCpuInterruptMode",
  "zxnextGetCpuTacts",
  "zxnextGetZ80NMode",
  "zxnextGetLastMemoryAddress",
  "zxnextGetLastMemoryValue",
  "zxnextGetLastMemoryIsWrite",
  "zxnextGetLastPortAddress",
  "zxnextGetLastPortValue",
  "zxnextGetLastPortIsWrite",
  "zxnextGetUnsupportedPortReadCount",
  "zxnextGetUnsupportedPortWriteCount",
  "zxnextGetFirstUnsupportedPortAddress",
  "zxnextGetFirstUnsupportedPortValue",
  "zxnextGetFirstUnsupportedPortIsWrite",
  "zxnextGetFirstUnsupportedPortOwnerStep",
  "zxnextGetLastTbBlueAddress",
  "zxnextGetLastTbBlueValue",
  "zxnextGetLastTbBlueIsWrite",
  "zxnextClearBusEvents",
  "zxnextGetDiagnosticFlags"
];

const buildModes = {
  production: {
    output: productionOutput,
    exports: productionExports,
    sources: [source],
    initialMemory: 8 * 1024 * 1024
  }
};

function normalizeBuildMode(mode = process.env.ZXNEXT_WASM_BUILD_MODE || "production") {
  if (buildModes[mode] == null) {
    throw new Error(`Unknown ZX Spectrum Next WASM build mode '${mode}'. Expected: production.`);
  }
  return mode;
}

function normalizeOptimization(optimization = process.env.ZXNEXT_WASM_OPTIMIZATION || "speed") {
  if (optimizationProfiles[optimization] == null) {
    throw new Error(`Unknown ZX Spectrum Next WASM optimization profile '${optimization}'. Expected one of: ${Object.keys(optimizationProfiles).join(", ")}.`);
  }
  return optimization;
}

function buildZxNextWasm({
  compiler = process.env.ZXNEXT_WASM_CC || "clang",
  mode = process.env.ZXNEXT_WASM_BUILD_MODE || "production",
  optimization = process.env.ZXNEXT_WASM_OPTIMIZATION || "speed",
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
  if (result.status !== 0) throw new Error(`ZX Spectrum Next WASM compilation failed (${result.status}).`);
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

function buildAllZxNextWasm(options = {}) {
  return [buildZxNextWasm(options)];
}

if (require.main === module) buildAllZxNextWasm();

module.exports = {
  buildZxNextWasm,
  buildAllZxNextWasm,
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
