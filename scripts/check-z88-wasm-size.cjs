const { statSync } = require("node:fs");
const { buildZ88Wasm, output } = require("./build-z88-wasm.cjs");

/*
 * Provisional ceiling (2026-09-19, Step 1 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`): the
 * skeleton links only buffers and register getters, so it is tiny. The ceiling matches the ZX
 * Spectrum Next's until the machine is complete; Step 12 replaces it with one measured on the real
 * build and records the reason here.
 */
const DEFAULT_MAX_BYTES = 700_000;

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
