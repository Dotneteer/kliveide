const { statSync } = require("node:fs");
const { buildZx8081Wasm, output } = require("./build-zx8081-wasm.cjs");

/*
 * The ceiling, measured on the complete machine (2026-10-03, `.plans/ZX8081_WASM_PLAN.md`): the speed
 * build is about 186 KB - the whole shared Z80 core plus a small ULA. Its hooks (`zx8081AdvanceTacts`,
 * the memory and port delays, the refresh) are `noinline`, as the Z88's tact hook is: inlined into
 * every opcode, per-tact work multiplies the code (`.ai/wasm-migration-intent-and-lessons.md`). 240,000
 * leaves about 30% for fixes before a jump has to be explained.
 */
const DEFAULT_MAX_BYTES = 240_000;

function parseMaxBytes(value = process.env.ZX8081_WASM_MAX_BYTES) {
  if (value == null || value === "") return DEFAULT_MAX_BYTES;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ZX8081_WASM_MAX_BYTES value '${value}'.`);
  }
  return Math.floor(parsed);
}

function checkZx8081WasmSize({ maxBytes = parseMaxBytes(), build = buildZx8081Wasm, artifact = output } = {}) {
  build();
  const actualBytes = statSync(artifact).size;
  const report = { artifact, actualBytes, maxBytes, withinLimit: actualBytes <= maxBytes };
  if (!report.withinLimit) {
    throw new Error(`ZX80/ZX81 WASM artifact is ${actualBytes} bytes; maximum allowed is ${maxBytes} bytes.`);
  }
  return report;
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(checkZx8081WasmSize(), null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = { DEFAULT_MAX_BYTES, checkZx8081WasmSize, parseMaxBytes };
