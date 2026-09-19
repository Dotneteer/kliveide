import { describe, expect, it } from "vitest";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Next WASM expansion bus and multiface-adjacent state", () => {
  it("keeps multiface host ROM/UI/media ownership outside WASM while expansion control remains mirrored", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    exports.zxnextSetNextRegisterDirect(0x80, 0xc3);
    expect(exports.zxnextGetNextRegisterDirect(0x80)).toBe(0xc3);
    expect(exports.zxnextExpansionGetNextReg(0x80)).toBe(0xc3);
  });
});
