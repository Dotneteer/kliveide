const { statSync } = require("node:fs");
const { buildSamWasm, output } = require("./build-sam-wasm.cjs");

/*
 * The ceiling (`dev/plans/SAM_COUPE_PLAN.md`): the core with the shared Z80, history, profile, the ASIC, the
 * SAA and two controllers. Re-measure and lower it when the plan closes.
 */
const DEFAULT_MAX_BYTES = 300_000;

function parseMaxBytes(value = process.env.SAM_WASM_MAX_BYTES) {
  if (value == null || value === "") return DEFAULT_MAX_BYTES;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid SAM_WASM_MAX_BYTES value '${value}'.`);
  }
  return Math.floor(parsed);
}

function checkSamWasmSize({ maxBytes = parseMaxBytes(), build = buildSamWasm, artifact = output } = {}) {
  build();
  const actualBytes = statSync(artifact).size;
  const report = { artifact, actualBytes, maxBytes, withinLimit: actualBytes <= maxBytes };
  if (!report.withinLimit) {
    throw new Error(`SAM Coupé WASM artifact is ${actualBytes} bytes; maximum allowed is ${maxBytes} bytes.`);
  }
  return report;
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(checkSamWasmSize(), null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = { DEFAULT_MAX_BYTES, checkSamWasmSize, parseMaxBytes };
