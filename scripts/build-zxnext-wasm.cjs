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
  "zxnextPixelBufferPtr",
  "zxnextKeyboardLinesPtr",
  "zxnextNextRegsPtr",
  "zxnextReset",
  "zxnextHardReset",
  "zxnextExecuteFrame",
  "zxnextExecuteInstruction",
  "zxnextRenderInstantScreen",
  "zxnextReadMemory",
  "zxnextWriteMemory",
  "zxnextReadScreenMemoryOffset",
  "zxnextSetKeyStatus",
  "zxnextGetKeyboardLine",
  "zxnextReadPort",
  "zxnextWritePort",
  "zxnextGetMemorySize",
  "zxnextGetFlatMemorySize",
  "zxnextGetKeyboardLineCount",
  "zxnextGetNextRegCount",
  "zxnextGetScreenWidth",
  "zxnextGetScreenHeight",
  "zxnextGetPixelBufferStartOffset",
  "zxnextGetFrames",
  "zxnextGetTacts",
  "zxnextGetCurrentFrameTact",
  "zxnextGetTactsInFrame",
  "zxnextGetFrameCompleted",
  "zxnextSetTacts",
  "zxnextGetCpuAf",
  "zxnextSetCpuAf",
  "zxnextGetCpuBc",
  "zxnextSetCpuBc",
  "zxnextGetCpuDe",
  "zxnextSetCpuDe",
  "zxnextGetCpuHl",
  "zxnextSetCpuHl",
  "zxnextGetCpuAfAlt",
  "zxnextSetCpuAfAlt",
  "zxnextGetCpuBcAlt",
  "zxnextSetCpuBcAlt",
  "zxnextGetCpuDeAlt",
  "zxnextSetCpuDeAlt",
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
  "zxnextGetLastMemoryAddress",
  "zxnextGetLastMemoryValue",
  "zxnextGetLastMemoryIsWrite",
  "zxnextGetLastPortAddress",
  "zxnextGetLastPortValue",
  "zxnextGetLastPortIsWrite",
  "zxnextSetNextRegisterIndex",
  "zxnextGetNextRegisterIndex",
  "zxnextSetNextRegisterValue",
  "zxnextGetNextRegisterValue",
  "zxnextGetNextRegisterDirect",
  "zxnextSetNextRegisterDirect",
  "zxnextGetPortFeValue",
  "zxnextGetBorderColor",
  "zxnextGetEarBit",
  "zxnextGetMicBit",
  "zxnextGetBeeperLevel",
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
    throw new Error(
      `Unknown ZX Spectrum Next WASM optimization profile '${optimization}'. Expected one of: ${Object.keys(optimizationProfiles).join(", ")}.`
    );
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
