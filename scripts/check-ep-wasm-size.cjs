const { statSync } = require("node:fs");
const { buildEpWasm, output } = require("./build-ep-wasm.cjs");

/*
 * The ceiling (`.plans/ENTERPRISE_PLAN.md`). Phase 1-2's core (the shared Z80 with the history recorder and
 * the access profile, DAVE's interrupts, NICK's LPT walker) is 175 KB in the speed build; the renderers
 * (Phase 3), the sound (Phase 4) and EXDOS (Phase 9) add to it. 300,000 leaves room; re-measure and lower
 * it in Phase 10.
 */
const DEFAULT_MAX_BYTES = 300_000;

function parseMaxBytes(value = process.env.EP_WASM_MAX_BYTES) {
  if (value == null || value === "") return DEFAULT_MAX_BYTES;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid EP_WASM_MAX_BYTES value '${value}'.`);
  }
  return Math.floor(parsed);
}

function checkEpWasmSize({ maxBytes = parseMaxBytes(), build = buildEpWasm, artifact = output } = {}) {
  build();
  const actualBytes = statSync(artifact).size;
  const report = { artifact, actualBytes, maxBytes, withinLimit: actualBytes <= maxBytes };
  if (!report.withinLimit) {
    throw new Error(`Enterprise WASM artifact is ${actualBytes} bytes; maximum allowed is ${maxBytes} bytes.`);
  }
  return report;
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(checkEpWasmSize(), null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = { DEFAULT_MAX_BYTES, checkEpWasmSize, parseMaxBytes };
