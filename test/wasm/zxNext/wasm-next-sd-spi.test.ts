import { describe, expect, it } from "vitest";

import { createZxNextOracleHarness } from "./wasm-next-test-helpers";

const CMD0 = [0x40, 0x00, 0x00, 0x00, 0x00, 0x95];
const CMD8 = [0x48, 0x00, 0x00, 0x01, 0xaa, 0x87];
const CMD9 = [0x49, 0x00, 0x00, 0x00, 0x00, 0xff];
const CMD16_512 = [0x50, 0x00, 0x00, 0x02, 0x00, 0xff];

describe("ZX Spectrum Next WASM SD SPI parity", () => {
  it("matches TypeScript chip-select decode and immediate command responses", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.hardReset();
    wasm.hardReset();
    oracle.sdCardDevice.setCardInfo(4096);
    wasm.wasmV2Runtime!.exports.zxnextSetSdCardInfo(0, 4096);

    for (const value of [0x02, 0x01, 0xfb, 0xff, 0x02]) {
      oracle.doWritePort(0xe7, value);
      wasm.doWritePort(0xe7, value);
      expect(wasm.wasmV2Runtime!.exports.zxnextGetSdSelectedCard()).toBe(oracle.sdCardDevice.selectedCard);
    }

    writeCommand(oracle, wasm, CMD0);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdLastCommand(0)).toBe(0x40);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdCommandIndex(0)).toBe(0);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdState(0)).toBe(0);
    expect(wasm.doReadPort(0xeb)).toBe(oracle.doReadPort(0xeb));

    writeCommand(oracle, wasm, CMD8);
    expect(readBytes(oracle, wasm, 5)).toEqual([0x01, 0x00, 0x00, 0x01, 0xaa]);

    writeCommand(oracle, wasm, CMD16_512);
    expect(wasm.doReadPort(0xeb)).toBe(oracle.doReadPort(0xeb));
    expect(wasm.doReadPort(0xeb)).toBe(0xff);
  });

  it("matches TypeScript card 1 SPI command state", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.hardReset();
    wasm.hardReset();
    oracle.sdCardDevice.setCard1Info(2048);
    wasm.wasmV2Runtime!.exports.zxnextSetSdCardInfo(1, 2048);

    oracle.doWritePort(0xe7, 0x01);
    wasm.doWritePort(0xe7, 0x01);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdSelectedCard()).toBe(1);

    writeCommand(oracle, wasm, CMD0);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdLastCommand(1)).toBe(0x40);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdState(1)).toBe(0);
    expect(wasm.doReadPort(0xeb)).toBe(oracle.doReadPort(0xeb));
  });

  it("matches TypeScript card 1 CMD9 zeroed CSD response", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.hardReset();
    wasm.hardReset();

    oracle.doWritePort(0xe7, 0x01);
    wasm.doWritePort(0xe7, 0x01);
    writeCommand(oracle, wasm, CMD9);

    expect(readBytes(oracle, wasm, 19)).toEqual([
      0x00, 0xff, 0xfe,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00
    ]);
  });
});

function writeCommand(oracle: any, wasm: any, bytes: number[]): void {
  for (const byte of bytes) {
    oracle.doWritePort(0xeb, byte);
    wasm.doWritePort(0xeb, byte);
  }
}

function readBytes(oracle: any, wasm: any, length: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < length; i++) {
    const wasmByte = wasm.doReadPort(0xeb);
    const oracleByte = oracle.doReadPort(0xeb);
    expect(wasmByte).toBe(oracleByte);
    result.push(wasmByte);
  }
  return result;
}
