const { statSync } = require("node:fs");
const { buildSp128Wasm, output } = require("./build-sp128-wasm.cjs");

// Initial ceiling for the Step 2 skeleton artifact. Raise only with a measured
// production backend size and a short reason in the related change.
const DEFAULT_MAX_BYTES = 40_000;

function parseMaxBytes(value = process.env.SP128_WASM_MAX_BYTES) {
  if (value == null || value === "") return DEFAULT_MAX_BYTES;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid SP128_WASM_MAX_BYTES value '${value}'.`);
  }
  return Math.floor(parsed);
}

function checkSp128WasmSize({
  maxBytes = parseMaxBytes(),
  build = buildSp128Wasm,
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
      `ZX Spectrum 128K WASM artifact is ${actualBytes} bytes; maximum allowed is ${maxBytes} bytes.`
    );
  }
  return report;
}

if (require.main === module) {
  try {
    const report = checkSp128WasmSize();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_MAX_BYTES,
  checkSp128WasmSize,
  parseMaxBytes
};
