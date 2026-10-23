const { statSync } = require("node:fs");
const { buildHt1080zWasm, output } = require("./build-ht1080z-wasm.cjs");

/*
 * The ceiling (`.plans/HT1080Z_PLAN.md`). The Phase 2 skeleton - the whole shared Z80 core with the
 * history recorder and the access profile, the memory map, the keyboard and the ports - is 241 KB in
 * the speed build, about the ZX80/81 core's size. Phases 3-6 add the video renderer, the AY
 * (`zx-spectrum-psg.c`) and the tape, which the ZX80/81 and 128K cores show to be a few tens of KB.
 * The tact hook is `noinline`, as the Z88's and the ZX81's are: inlined into every opcode, per-tact
 * work multiplies the code (`.ai/wasm-migration-intent-and-lessons.md`). 300,000 leaves room for those
 * phases; re-measure and lower it in Phase 9.
 */
const DEFAULT_MAX_BYTES = 300_000;

function parseMaxBytes(value = process.env.HT1080Z_WASM_MAX_BYTES) {
  if (value == null || value === "") return DEFAULT_MAX_BYTES;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid HT1080Z_WASM_MAX_BYTES value '${value}'.`);
  }
  return Math.floor(parsed);
}

function checkHt1080zWasmSize({ maxBytes = parseMaxBytes(), build = buildHt1080zWasm, artifact = output } = {}) {
  build();
  const actualBytes = statSync(artifact).size;
  const report = { artifact, actualBytes, maxBytes, withinLimit: actualBytes <= maxBytes };
  if (!report.withinLimit) {
    throw new Error(`HT-1080Z WASM artifact is ${actualBytes} bytes; maximum allowed is ${maxBytes} bytes.`);
  }
  return report;
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(checkHt1080zWasmSize(), null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = { DEFAULT_MAX_BYTES, checkHt1080zWasmSize, parseMaxBytes };
