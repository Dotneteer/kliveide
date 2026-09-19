import { readFileSync } from "node:fs";

import { buildZ88Wasm, productionOutput, waitForZ88WasmBuildLock } from "../../scripts/build-z88-wasm.cjs";

/*
 * Shared plumbing for the Cambridge Z88 WASM tests.
 */

let built = false;

/**
 * The bytes of the current Z88 WASM artifact. The first call in a test worker builds it from the C
 * sources (under the build lock, so parallel workers do not race); later calls reuse that build.
 */
export function z88WasmArtifactBytes(): Uint8Array<ArrayBuffer> {
  if (!built) {
    buildZ88Wasm();
    built = true;
  }
  waitForZ88WasmBuildLock();
  return new Uint8Array(readFileSync(productionOutput));
}
