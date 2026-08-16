const { statSync } = require("node:fs");
const { buildSpP3eWasm, output } = require("./build-spp3e-wasm.cjs");

// Production ceiling with shared Z80, frame CPU execution, ULA rendering,
// beeper, PSG, tape, and disk ABI linked in.
const DEFAULT_MAX_BYTES = 352_000;

function parseMaxBytes(value = process.env.SPP3E_WASM_MAX_BYTES) {
  if (value == null || value === "") return DEFAULT_MAX_BYTES;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid SPP3E_WASM_MAX_BYTES value '${value}'.`);
  }
  return Math.floor(parsed);
}

function checkSpP3eWasmSize({
  maxBytes = parseMaxBytes(),
  build = buildSpP3eWasm,
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
      `ZX Spectrum +3E WASM artifact is ${actualBytes} bytes; maximum allowed is ${maxBytes} bytes.`
    );
  }
  return report;
}

if (require.main === module) {
  try {
    const report = checkSpP3eWasmSize();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_MAX_BYTES,
  checkSpP3eWasmSize,
  parseMaxBytes
};
