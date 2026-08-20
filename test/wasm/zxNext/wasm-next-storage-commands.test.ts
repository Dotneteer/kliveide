import { describe, expect, it } from "vitest";

import { createZxNextOracleHarness } from "./wasm-next-test-helpers";

const CMD17_SECTOR_5 = [0x51, 0x00, 0x00, 0x00, 0x05, 0xff];
const CMD24_SECTOR_7 = [0x58, 0x00, 0x00, 0x00, 0x07, 0xff];

describe("ZX Spectrum Next WASM storage command handoff", () => {
  it("matches TypeScript single-sector read command handoff and response readiness", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.hardReset();
    wasm.hardReset();
    oracle.sdCardDevice.setCardInfo(4096);
    wasm.wasmV2Runtime!.exports.zxnextSetSdCardInfo(0, 4096);

    selectCard0(oracle, wasm);
    writeBytes(oracle, wasm, CMD17_SECTOR_5);

    expect(oracle.getFrameCommand()).toEqual({ command: "sd-read", sector: 5 });
    expect(wasm.getFrameCommand()).toEqual({ command: "sd-read", sector: 5 });
    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdHostCommand()).toBe(1);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdHostSector()).toBe(5);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdResponseReady(0)).toBe(0);

    const sector = Uint8Array.from({ length: 512 }, (_, index) => index & 0xff);
    oracle.sdCardDevice.setReadResponse(sector);
    const ptr = wasm.wasmV2Runtime!.exports.zxnextGetSdWriteBufferPtr();
    new Uint8Array(wasm.wasmV2Runtime!.memoryBuffer).set(sector, ptr);
    wasm.wasmV2Runtime!.exports.zxnextSetSdReadResponse(0, ptr, sector.length);
    wasm.wasmV2Runtime!.exports.zxnextClearSdHostCommand();
    wasm.setFrameCommand(null);

    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdResponseReady(0)).toBe(1);
    expect(readBytes(oracle, wasm, 8)).toEqual([0x00, 0xff, 0xfe, 0x00, 0x01, 0x02, 0x03, 0x04]);
  });

  it("matches TypeScript write command handoff buffer and final write response", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.hardReset();
    wasm.hardReset();
    oracle.sdCardDevice.setCardInfo(4096);
    wasm.wasmV2Runtime!.exports.zxnextSetSdCardInfo(0, 4096);

    selectCard0(oracle, wasm);
    writeBytes(oracle, wasm, CMD24_SECTOR_7);
    expect(wasm.doReadPort(0xeb)).toBe(oracle.doReadPort(0xeb));

    const block = Uint8Array.from({ length: 514 }, (_, index) => (index * 3) & 0xff);
    writeBytes(oracle, wasm, [0xfe, ...block]);

    expect(oracle.getFrameCommand().command).toBe("sd-write");
    expect(oracle.getFrameCommand().sector).toBe(7);
    expect(wasm.getFrameCommand().command).toBe("sd-write");
    expect(wasm.getFrameCommand().sector).toBe(7);
    expect(Array.from(wasm.getFrameCommand().data.slice(0, 8))).toEqual(Array.from(block.slice(0, 8)));
    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdWriteBufferLength()).toBe(512);

    oracle.sdCardDevice.setWriteResponse();
    wasm.wasmV2Runtime!.exports.zxnextSetSdWriteResponse(0, 1);
    wasm.wasmV2Runtime!.exports.zxnextClearSdHostCommand();
    wasm.setFrameCommand(null);
    expect(readBytes(oracle, wasm, 3)).toEqual([0x05, 0xff, 0xfe]);
  });
});

function selectCard0(oracle: any, wasm: any): void {
  oracle.doWritePort(0xe7, 0x02);
  wasm.doWritePort(0xe7, 0x02);
}

function writeBytes(oracle: any, wasm: any, bytes: number[]): void {
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
