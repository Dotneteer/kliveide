const { statSync } = require("node:fs");
const { buildZ88Wasm, output } = require("./build-z88-wasm.cjs");

/*
 * The ceiling, measured on the complete machine (2026-09-19, Step 12 of
 * `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`): the speed build is 151,854 bytes, 141 KB of it code
 * (1,025 functions - the whole shared Z80 core). 200,000 leaves about 30% for fixes before a jump
 * has to be explained. The Z88 is smaller than the 48K (201 KB) on purpose, not by omission: it has no
 * contention, so none of the 48K's memory/port delay hooks is inlined into every opcode, and its one
 * tact hook (the audio sampler) is `noinline`. A jump past the ceiling usually means something hot
 * became inlined into the opcodes again (see `.ai/wasm-migration-intent-and-lessons.md`).
 */
const DEFAULT_MAX_BYTES = 200_000;

function parseMaxBytes(value = process.env.Z88_WASM_MAX_BYTES) {
  if (value == null || value === "") return DEFAULT_MAX_BYTES;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid Z88_WASM_MAX_BYTES value '${value}'.`);
  }
  return Math.floor(parsed);
}

function checkZ88WasmSize({ maxBytes = parseMaxBytes(), build = buildZ88Wasm, artifact = output } = {}) {
  build({ mode: "production" });
  const actualBytes = statSync(artifact).size;
  const report = {
    artifact,
    actualBytes,
    maxBytes,
    withinLimit: actualBytes <= maxBytes
  };
  if (!report.withinLimit) {
    throw new Error(`Cambridge Z88 WASM artifact is ${actualBytes} bytes; maximum allowed is ${maxBytes} bytes.`);
  }
  return report;
}

if (require.main === module) {
  try {
    const report = checkZ88WasmSize();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_MAX_BYTES,
  checkZ88WasmSize,
  parseMaxBytes
};
