const { existsSync, mkdirSync, statSync } = require("node:fs");
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
const { SP48_VOLATILE_SYMBOLS, productionExports: sp48Exports } = require("./build-sp48-wasm.cjs");

/**
 * The Timex core (`.plans/TIMEX_SCORPION_PLAN.md` G9.4a): `timex.c` builds the 48K machine with the
 * SCLD switched on, so it exports everything the 48K core does (under the same `sp48` names, which
 * lets the host reuse the 48K's loader) plus the SCLD's own `timex*` functions.
 */
const TIMEX_VOLATILE_SYMBOLS = [...SP48_VOLATILE_SYMBOLS];

const root = resolve(__dirname, "..");
const source = resolve(root, "src/emu/machines/timex/wasm/timex/timex.c");
const wasmDistDirectory = resolve(root, "src/emu/machines/timex/wasm/dist");
const productionOutput = resolve(wasmDistDirectory, "zx-timex.wasm");
const output = productionOutput;
const packagedResourceDirectory = "wasm/timex";
const packagedArtifactRelative = `${packagedResourceDirectory}/zx-timex.wasm`;

const optimizationProfiles = {
  speed: ["-O3", "-Wl,--strip-all"],
  size: ["-Oz", "-Wl,--strip-all"]
};

const timexOwnExports = [
  "timexHardReset",
  "timexGetModel",
  "timexGetPortFf",
  "timexSetPortFf",
  "timexSetKempston",
  "timexGetKempston",
  "timexGetHiresBright",
  "timexGetPortF4",
  "timexSetPortF4",
  "timexSetJoystick",
  "timexUploadExromByte",
  "timexExromPtr",
  "timexGetExromLoaded",
  "timexDockPtr",
  "timexDockSetChunkType",
  "timexDockGetChunkType",
  "timexDockEject",
  "timexGetChunkSource",
  "timexGetPsgRegisterIndex",
  "timexGetPsgRegisterValue",
  "timexReadPsgRegisterValue",
  "timexGetPsgToneA",
  "timexGetPsgToneB",
  "timexGetPsgToneC",
  "timexGetPsgVolumeA",
  "timexGetPsgVolumeB",
  "timexGetPsgVolumeC",
  "timexGetPsgCurrentOutput",
  "timexGetHasAy",
  "timexSetTapeTraps",
  "timexGetTapeLoadTrap"
];

const productionExports = [...sp48Exports, ...timexOwnExports];

const INITIAL_MEMORY = 8 * 1024 * 1024;

function buildTimexWasm({
  compiler = process.env.TIMEX_WASM_CC || process.env.SP48_WASM_CC || "clang",
  optimization = process.env.TIMEX_WASM_OPTIMIZATION || "speed",
  outputPath,
  run = spawnSync
} = {}) {
  if (optimizationProfiles[optimization] == null) {
    throw new Error(
      `Unknown Timex WASM optimization profile '${optimization}'. Expected one of: ${Object.keys(optimizationProfiles).join(", ")}.`
    );
  }
  const selectedOutput = outputPath ?? productionOutput;
  // --- A real build is staged and renamed into place (see `publishWasmOutput`)
  const compiledOutput = stagingWasmOutput(selectedOutput, run === spawnSync);
  mkdirSync(dirname(selectedOutput), { recursive: true });
  const args = [
    "--target=wasm32",
    "-std=c11",
    ...optimizationProfiles[optimization],
    "-ffreestanding",
    "-fno-builtin",
    "-nostdlib",
    "-Wl,--no-entry",
    "-Wl,--export-memory",
    `-Wl,--initial-memory=${INITIAL_MEMORY}`,
    `-Wl,--max-memory=${INITIAL_MEMORY}`,
    ...productionExports.filter((name) => name !== "memory").map((name) => `-Wl,--export=${name}`),
    source,
    "-o",
    compiledOutput
  ];
  const layoutMap = layoutMapPath(selectedOutput);
  const result = run(compiler, [...args, ...layoutMapArgs(layoutMap)], { cwd: root, stdio: "inherit" });
  if (result.error || result.status !== 0) discardWasmOutput(compiledOutput, selectedOutput);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Timex WASM compilation failed (${result.status}).`);
  if (!existsSync(compiledOutput) || statSync(compiledOutput).size === 0) {
    throw new Error(
      `Timex WASM compilation reported success (compiler: '${compiler}'), but '${selectedOutput}' is missing or empty. ` +
        `The build must not continue - packaging this app would ship a broken emulator.`
    );
  }
  // --- The memory layout a Klive state file depends on (scripts/wasm-layout.cjs)
  const layout = stampWasmLayout(compiledOutput, layoutMap, TIMEX_VOLATILE_SYMBOLS);
  publishWasmOutput(compiledOutput, selectedOutput);
  return { layout, compiler, args, optimization, exports: productionExports, source, sources: [source], output: selectedOutput };
}

if (require.main === module) buildTimexWasm();

// --- electron-builder resource paths use forward slashes on every platform
function toPosixRelative(from, to) {
  return relative(from, to).split(sep).join("/");
}

module.exports = {
  TIMEX_VOLATILE_SYMBOLS,
  buildTimexWasm,
  output,
  productionOutput,
  packagedArtifactRelative,
  packagedResourceDirectory,
  productionExports,
  timexOwnExports,
  source,
  wasmDistDirectory,
  outputRelative: toPosixRelative(root, output)
};
