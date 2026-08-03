const { statSync } = require("node:fs");
const { buildSp48Wasm, output } = require("./build-sp48-wasm.cjs");

const DEFAULT_MAX_BYTES = 240_000;

function parseMaxBytes(value = process.env.SP48_WASM_MAX_BYTES) {
  if (value == null || value === "") return DEFAULT_MAX_BYTES;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid SP48_WASM_MAX_BYTES value '${value}'.`);
  }
  return Math.floor(parsed);
}

function checkSp48WasmSize({
  maxBytes = parseMaxBytes(),
  build = buildSp48Wasm,
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
      `ZX Spectrum 48K WASM artifact is ${actualBytes} bytes; maximum allowed is ${maxBytes} bytes.`
    );
  }
  return report;
}

if (require.main === module) {
  try {
    const report = checkSp48WasmSize();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_MAX_BYTES,
  checkSp48WasmSize,
  parseMaxBytes
};
