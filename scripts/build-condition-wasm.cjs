/*
 * Builds the breakpoint condition evaluator alone - `src/emu/z80/wasm/z80-condition.c` with
 * `COND_TEST_HOST` - as `src/emu/z80/wasm/dist/condition-test.wasm`.
 *
 * Test-only (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md` §4.2): registers, memory, paging and Next
 * registers come from WebAssembly imports, so the condition language is tested against the very C
 * code every Z80 core includes, without a machine. Nothing ships this module.
 */
const { existsSync, mkdirSync, statSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const { acquireWasmBuildLock } = require("./wasm-build-lock.cjs");

const root = resolve(__dirname, "..");
const source = resolve(root, "src/emu/z80/wasm/z80-condition.c");
const output = resolve(root, "src/emu/z80/wasm/dist/condition-test.wasm");

const exportsList = [
  "condArenaPtr",
  "condArenaCapacity",
  "condSlotTablePtr",
  "condSlotCapacity",
  "condMaxProgramWords",
  "condGetToken",
  "condSetToken",
  "condGetLastStatus",
  "condEvaluate",
  "condEvaluateValue"
];

function buildConditionWasm({
  compiler = process.env.Z80_WASM_CC || "clang",
  outputPath = output,
  force = false,
  run = spawnSync
} = {}) {
  // --- Rebuilt only when the source is newer: every test file of the suite asks for it
  if (!force && existsSync(outputPath) && statSync(outputPath).mtimeMs >= statSync(source).mtimeMs) {
    return { output: outputPath, built: false };
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  const release = acquireWasmBuildLock(`${outputPath}.lock`, "condition-test.wasm");
  try {
    if (!force && existsSync(outputPath) && statSync(outputPath).mtimeMs >= statSync(source).mtimeMs) {
      return { output: outputPath, built: false };
    }
    const args = [
      "--target=wasm32",
      "-std=c11",
      "-O2",
      "-DCOND_TEST_HOST",
      "-ffreestanding",
      "-fno-builtin",
      "-nostdlib",
      "-Wl,--no-entry",
      "-Wl,--export-memory",
      ...exportsList.map((name) => `-Wl,--export=${name}`),
      source,
      "-o",
      outputPath
    ];
    const result = run(compiler, args, { cwd: root, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Condition evaluator compilation failed (${result.status}).`);
    return { output: outputPath, built: true, args };
  } finally {
    release();
  }
}

module.exports = { buildConditionWasm, exports: exportsList, output, source };

if (require.main === module) {
  const result = buildConditionWasm({ force: true });
  console.log(`Built ${result.output}`);
}
