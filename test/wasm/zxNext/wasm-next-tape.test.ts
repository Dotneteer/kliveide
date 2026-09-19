import { describe, expect, it } from "vitest";

import { TapeMode } from "@emu/abstractions/TapeMode";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

/*
 * Tape state is host-facing (the tape device lives outside the core), so it is pinned here rather than
 * covered by the hardware harness. Pinned values are the ones both cores agreed on at tag
 * `pre-zxnext-ts-removal-2026-09-19`.
 */
describe("ZX Spectrum Next WASM tape state", () => {
  it("reports passive tape EAR/MIC state and mode transitions used by ULA port writes", async () => {
    const wasm = await createTestZxNextWasmMachine();

    // --- A fresh tape device is passive, with EAR high and MIC low
    expect(wasm.tapeDevice.tapeMode).toBe(TapeMode.Passive);
    expect(wasm.tapeDevice.getTapeEarBit()).toBe(true);
    expect(wasm.tapeDevice.micBit).toBe(false);

    wasm.tapeDevice.tapeMode = TapeMode.Save;
    wasm.tapeDevice.processMicBit(true);
    expect(wasm.tapeDevice.tapeMode).toBe(TapeMode.Save);
    expect(wasm.tapeDevice.micBit).toBe(true);

    // --- Back in passive mode the MIC bit keeps the value last processed
    wasm.tapeDevice.tapeMode = TapeMode.Passive;
    wasm.tapeDevice.processMicBit(true);
    expect(wasm.tapeDevice.micBit).toBe(true);
  });

  it("handles MIC through ULA port writes in save and passive modes", async () => {
    const wasm = await createTestZxNextWasmMachine();

    // --- Pinned: a $FE write with bit 3 set leaves the tape MIC bit low in save mode, and a $FE
    // --- write of 0 leaves it low in passive mode
    wasm.tapeDevice.tapeMode = TapeMode.Save;
    wasm.doWritePort(0x00fe, 0x08);
    expect(wasm.tapeDevice.micBit).toBe(false);

    wasm.tapeDevice.tapeMode = TapeMode.Passive;
    wasm.doWritePort(0x00fe, 0x00);
    expect(wasm.tapeDevice.micBit).toBe(false);
  });
});
