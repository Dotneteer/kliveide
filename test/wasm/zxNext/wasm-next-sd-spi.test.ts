import { describe, expect, it } from "vitest";

import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

const CMD0 = [0x40, 0x00, 0x00, 0x00, 0x00, 0x95];
const CMD9 = [0x49, 0x00, 0x00, 0x00, 0x00, 0xff];

/*
 * Card 0 is covered by `test/zxnext-hw/sd/sd-card.test.ts`; the harness has no image for slot 1, so
 * a card present in slot 1 is checked here.
 */
describe("ZX Spectrum Next WASM SD SPI card 1", () => {
  it("selects card 1 and answers CMD0", async () => {
    const wasm = await createTestZxNextWasmMachine();
    wasm.hardReset();
    wasm.wasmV2Runtime!.exports.zxnextSetSdCardInfo(1, 2048);

    // --- $E7 low bits 01 select card 1 (zxnext.vhd; catalogue SPI-001)
    wasm.doWritePort(0xe7, 0x01);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdSelectedCard()).toBe(1);

    writeCommand(wasm, CMD0);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdLastCommand(1)).toBe(0x40);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdState(1)).toBe(0);
    // --- R1 = $01: in idle state (SD spec; the card 0 counterpart is SPI-003)
    expect(wasm.doReadPort(0xeb)).toBe(0x01);
  });

  it("answers card 1 CMD9 with a zeroed CSD", async () => {
    const wasm = await createTestZxNextWasmMachine();
    wasm.hardReset();
    // --- an empty slot does not answer: give card 1 a size
    wasm.wasmV2Runtime!.exports.zxnextSetSdCardInfo(1, 2048);

    wasm.doWritePort(0xe7, 0x01);
    writeCommand(wasm, CMD9);

    // --- R1, a gap byte, the $FE data token, then 16 zero CSD bytes (pinned: the values both cores
    // --- agreed on at tag `pre-zxnext-ts-removal-2026-09-19`)
    expect(readBytes(wasm, 19)).toEqual([
      0x00, 0xff, 0xfe,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00
    ]);
  });
});

function writeCommand(wasm: ZxNextWasmV2Machine, bytes: number[]): void {
  for (const byte of bytes) wasm.doWritePort(0xeb, byte);
}

function readBytes(wasm: ZxNextWasmV2Machine, length: number): number[] {
  return Array.from({ length }, () => wasm.doReadPort(0xeb));
}
