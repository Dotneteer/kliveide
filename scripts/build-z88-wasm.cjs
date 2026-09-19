const { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } = require("node:fs");
const { dirname, relative, resolve, sep } = require("node:path");
const { spawnSync } = require("node:child_process");

const { acquireWasmBuildLock, waitForWasmBuildLock } = require("./wasm-build-lock.cjs");

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
  "memory",
  // --- Buffers
  "z88MemoryPtr",
  "z88GetMemorySize",
  "z88PixelBufferPtr",
  "z88GetPixelBufferCapacity",
  "z88AudioSamplesPtr",
  "z88GetAudioSampleCapacity",
  "z88KeyboardLinesPtr",
  // --- Lifecycle
  "z88Reset",
  "z88HardReset",
  // --- LCD shape
  "z88SetLcdSize",
  "z88GetScw",
  "z88GetSch",
  "z88GetScreenWidth",
  "z88GetScreenHeight",
  // --- Timing
  "z88GetBaseClockFrequency",
  "z88GetTactsInFrame",
  "z88GetFrames",
  "z88GetTacts",
  // --- CPU (the shared-core contract)
  "z88GetCpuAf",
  "z88GetCpuBc",
  "z88GetCpuDe",
  "z88GetCpuHl",
  "z88GetCpuPc",
  "z88GetCpuSp"
];

/*
 * 4 MB of physical memory, an 800x480 pixel buffer (1.5 MB) and the audio buffer fit in 8 MiB;
 * `z88.c` asserts the sum at compile time. Raise this only with a recorded reason.
 */
const Z88_WASM_MEMORY_BYTES = 8 * 1024 * 1024;

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
      selectedOutput
    ];
    const result = run(compiler, args, { cwd: root, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Cambridge Z88 WASM compilation failed (${result.status}).`);
    if (!existsSync(selectedOutput) || statSync(selectedOutput).size === 0) {
      throw new Error(
        `Cambridge Z88 WASM compilation reported success (compiler: '${compiler}'), but '${selectedOutput}' is missing or empty. ` +
          `The build must not continue - packaging this app would ship a broken emulator.`
      );
    }
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
