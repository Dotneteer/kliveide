import { describe, expect, it } from "vitest";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Next WASM advanced video composition samples", () => {
  it("uses the existing Layer 2 regression priority sample rule", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    expect(exports.zxnextComposeLayer2Sample(0x091, 0, 0x1ff)).toBe(0x091);
    expect(exports.zxnextComposeLayer2Sample(0x091, 1, 0x1ff)).toBe(0x1ff);
  });
});
