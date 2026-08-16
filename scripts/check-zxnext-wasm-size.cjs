const { statSync } = require("node:fs");
const { buildZxNextWasm, output } = require("./build-zxnext-wasm.cjs");

// Skeleton backend ceiling. Later CPU/device slices should raise this only with
// a measured artifact size and a short explanation in the migration plan.
const DEFAULT_MAX_BYTES = 80_000;

function parseMaxBytes(value = process.env.ZXNEXT_WASM_MAX_BYTES) {
  if (value == null || value === "") return DEFAULT_MAX_BYTES;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ZXNEXT_WASM_MAX_BYTES value '${value}'.`);
  }
  return Math.floor(parsed);
}

function checkZxNextWasmSize({
  maxBytes = parseMaxBytes(),
  build = buildZxNextWasm,
  artifact = output
} = {}) {
  build({ mode: "production" });
  const actualBytes = statSync(artifact).size;
  const report = {
    artifact,
    actualBytes,
    maxBytes,
    withinLimit: actualBytes <= maxBytes
  };
  if (!report.withinLimit) {
    throw new Error(
      `ZX Spectrum Next WASM artifact is ${actualBytes} bytes; maximum allowed is ${maxBytes} bytes.`
    );
  }
  return report;
}

if (require.main === module) {
  try {
    const report = checkZxNextWasmSize();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_MAX_BYTES,
  checkZxNextWasmSize,
  parseMaxBytes
};
