import { describe, expect, it } from "vitest";

import { TapeMode } from "@emu/abstractions/TapeMode";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

/*
 * The Next's tape lines as the host sees them (`ZxNextWasmV2Machine.tapeDevice`): the player is the
 * Spectrum cores' (`zx-spectrum-tape.c`, `.plans/NEXT_TAPE_PLAN.md`), so the device follows its
 * conventions - the socket's level rests high (1) between and without tapes, the SAVE capture's MIC
 * line starts high and follows port $FE bit 3 only while the deck records. What the machine reads is
 * the conditioned input, `test/zxnext-hw/tape/tape.test.ts`.
 */
describe("ZX Spectrum Next WASM tape state", () => {
  it("starts passive, with the socket's level high and the conditioned input at rest (0)", async () => {
    const wasm = await createTestZxNextWasmMachine();
    expect(wasm.tapeDevice.tapeMode).toBe(TapeMode.Passive);
    expect(wasm.tapeDevice.getTapeEarBit()).toBe(true);
    expect(wasm.tapeDevice.micBit).toBe(true);
    expect(wasm.wasmV2Runtime!.exports.zxnextTapeGetInputBit()).toBe(0);
  });

  it("the SAVE capture follows port $FE bit 3 while recording, and ignores it otherwise", async () => {
    const wasm = await createTestZxNextWasmMachine();
    wasm.doWritePort(0x00fe, 0x00);
    expect(wasm.tapeDevice.micBit, "passive: not captured").toBe(true);

    wasm.tapeDevice.tapeMode = TapeMode.Save;
    expect(wasm.tapeDevice.tapeMode).toBe(TapeMode.Save);
    wasm.doWritePort(0x00fe, 0x00);
    expect(wasm.tapeDevice.micBit).toBe(false);
    wasm.doWritePort(0x00fe, 0x08);
    expect(wasm.tapeDevice.micBit).toBe(true);
  });
});
