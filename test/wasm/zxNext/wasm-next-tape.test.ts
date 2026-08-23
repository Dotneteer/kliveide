import { describe, expect, it } from "vitest";

import { TapeMode } from "@emu/abstractions/TapeMode";
import { TapeDevice } from "@emu/machines/tape/TapeDevice";

import { createZxNextOracleHarness } from "./wasm-next-test-helpers";

describe("ZX Spectrum Next WASM tape state", () => {
  it("matches passive tape EAR/MIC state and mode transitions used by ULA port writes", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.tapeDevice = new TapeDevice(oracle as any);

    expect(wasm.tapeDevice.tapeMode).toBe(oracle.tapeDevice.tapeMode);
    expect(wasm.tapeDevice.getTapeEarBit()).toBe(oracle.tapeDevice.getTapeEarBit());
    expect(wasm.tapeDevice.micBit).toBe(oracle.tapeDevice.micBit);

    oracle.tapeDevice.tapeMode = TapeMode.Save;
    wasm.tapeDevice.tapeMode = TapeMode.Save;
    oracle.tapeDevice.processMicBit(true);
    wasm.tapeDevice.processMicBit(true);
    expect(wasm.tapeDevice.tapeMode).toBe(oracle.tapeDevice.tapeMode);
    expect(wasm.tapeDevice.micBit).toBe(oracle.tapeDevice.micBit);

    oracle.tapeDevice.tapeMode = TapeMode.Passive;
    wasm.tapeDevice.tapeMode = TapeMode.Passive;
    oracle.tapeDevice.processMicBit(true);
    wasm.tapeDevice.processMicBit(true);
    expect(wasm.tapeDevice.micBit).toBe(oracle.tapeDevice.micBit);
  });

  it("matches TypeScript MIC handling through ULA port writes in save and passive modes", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.tapeDevice = new TapeDevice(oracle as any);

    oracle.tapeDevice.tapeMode = TapeMode.Save;
    wasm.tapeDevice.tapeMode = TapeMode.Save;
    oracle.doWritePort(0x00fe, 0x08);
    wasm.doWritePort(0x00fe, 0x08);
    expect(wasm.tapeDevice.micBit).toBe(oracle.tapeDevice.micBit);

    oracle.tapeDevice.tapeMode = TapeMode.Passive;
    wasm.tapeDevice.tapeMode = TapeMode.Passive;
    oracle.doWritePort(0x00fe, 0x00);
    wasm.doWritePort(0x00fe, 0x00);
    expect(wasm.tapeDevice.micBit).toBe(oracle.tapeDevice.micBit);
  });
});
