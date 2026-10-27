const { statSync } = require("node:fs");
const { buildTvcWasm, output } = require("./build-tvc-wasm.cjs");

/*
 * The ceiling (`.plans/VIDEOTON_TVC_PLAN.md`). The shared Z80 core with the history recorder and the
 * access profile is about 240 KB in the speed build (the HT-1080Z's measurement); the TVC's memory
 * map, CRTC and video add a few KB, and the sound and tape (Phase 4) a few tens. 300,000 leaves room
 * for them; re-measure and lower it in Phase 9.
 */
const DEFAULT_MAX_BYTES = 300_000;

function parseMaxBytes(value = process.env.TVC_WASM_MAX_BYTES) {
  if (value == null || value === "") return DEFAULT_MAX_BYTES;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid TVC_WASM_MAX_BYTES value '${value}'.`);
  }
  return Math.floor(parsed);
}

function checkTvcWasmSize({ maxBytes = parseMaxBytes(), build = buildTvcWasm, artifact = output } = {}) {
  build();
  const actualBytes = statSync(artifact).size;
  const report = { artifact, actualBytes, maxBytes, withinLimit: actualBytes <= maxBytes };
  if (!report.withinLimit) {
    throw new Error(`TVC WASM artifact is ${actualBytes} bytes; maximum allowed is ${maxBytes} bytes.`);
  }
  return report;
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(checkTvcWasmSize(), null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = { DEFAULT_MAX_BYTES, checkTvcWasmSize, parseMaxBytes };
