import { describe, expect, it } from "vitest";

import { createZxNextOracleHarness } from "./wasm-next-test-helpers";

const KEY_CASES = [0, 6, 14, 23, 39];
const PORT_CASES = [0xfefe, 0xfdfe, 0xfbfe, 0x7ffe, 0x00fe];

describe("ZX Spectrum Next WASM keyboard and ULA ports", () => {
  it("matches TypeScript keyboard row values and ULA port reads", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();

    for (const key of KEY_CASES) {
      oracle.setKeyStatus(key, true);
      wasm.setKeyStatus(key, true);
    }

    expect(Array.from({ length: 8 }, (_, line) => wasm.wasmV2Runtime!.exports.zxnextGetKeyboardLine(line))).toEqual(
      Array.from({ length: 8 }, (_, line) => oracle.keyboardDevice.getKeyLineValue(line))
    );
    expect(PORT_CASES.map(port => wasm.doReadPort(port))).toEqual(PORT_CASES.map(port => oracle.doReadPort(port)));

    for (const key of KEY_CASES) {
      oracle.setKeyStatus(key, false);
      wasm.setKeyStatus(key, false);
    }
    expect(PORT_CASES.map(port => wasm.doReadPort(port))).toEqual(PORT_CASES.map(port => oracle.doReadPort(port)));
  });

  it("matches issue 2/3 MIC contribution and border state through port $FE", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();

    oracle.doWritePort(0x00fe, 0x08);
    wasm.doWritePort(0x00fe, 0x08);
    expect(wasm.doReadPort(0x00fe)).toBe(oracle.doReadPort(0x00fe));
    expect(wasm.doReadPort(0x00fe) & 0x40).toBe(0x00);

    oracle.tbblueOut(0x08, 0x1b);
    wasm.tbblueOut(0x08, 0x1b);
    expect(wasm.doReadPort(0x00fe)).toBe(oracle.doReadPort(0x00fe));
    expect(wasm.doReadPort(0x00fe) & 0x40).toBe(0x40);

    oracle.doWritePort(0x00fe, 0x17);
    wasm.doWritePort(0x00fe, 0x17);
    expect(wasm.getWasmV2UlaState()).toMatchObject({
      bor: oracle.composedScreenDevice.borderColor,
      ear: true,
      mic: false
    });
    expect(wasm.floatingBusDevice.readFloatingBus()).toBe(oracle.doReadPort(0xffff));
  });

  it("matches TypeScript analog EAR discharge timing on port $FE bit 6", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();

    oracle.setTacts(100);
    wasm.setTacts(100);
    oracle.doWritePort(0x00fe, 0x10);
    wasm.doWritePort(0x00fe, 0x10);

    oracle.setTacts(110);
    wasm.setTacts(110);
    oracle.doWritePort(0x00fe, 0x00);
    wasm.doWritePort(0x00fe, 0x00);

    oracle.setTacts(149);
    wasm.setTacts(149);
    expect(wasm.doReadPort(0x00fe)).toBe(oracle.doReadPort(0x00fe));
    expect(wasm.doReadPort(0x00fe) & 0x40).toBe(0x40);

    oracle.setTacts(150);
    wasm.setTacts(150);
    expect(wasm.doReadPort(0x00fe)).toBe(oracle.doReadPort(0x00fe));
    expect(wasm.doReadPort(0x00fe) & 0x40).toBe(0x00);
  });
});
