import { describe, expect, it } from "vitest";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

// --- Port $6B (zxnDMA) and port $0B (Z80 DMA / legacy) modes, as zxnextDmaSetMode takes them
const ZXNDMA = 0;
const LEGACY = 1;

/*
 * The DMA register and read sequencers, byte for byte. Transfers, timing and the hardware behaviour
 * itself are tested through the harness: test/zxnext-hw/dma/dma.test.ts.
 *
 * Pinned values are the ones both cores (TypeScript and WASM) agreed on at tag
 * pre-zxnext-ts-removal-2026-09-19.
 */
describe("ZX Next WASM DMA device", () => {
  it("runs the DMA write and read sequencers", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;
    const write = (mode: number, ...values: number[]): void => {
      for (const value of values) {
        exports.zxnextDmaSetMode(mode);
        exports.zxnextDmaWritePort(value);
      }
    };
    const read = (n: number): number[] => {
      const w: number[] = [];
      for (let i = 0; i < n; i++) {
        w.push(exports.zxnextDmaReadStatusByte());
      }
      return w;
    };

    // --- WR0 A->B, port A $1234, length $0010; WR1/WR2 with timing bytes; WR4 port B $5678; WR5; load
    write(ZXNDMA, 0x7d, 0x34, 0x12, 0x10, 0x00, 0x54, 0x21, 0xee, 0x50, 0x22, 0x40, 0xad, 0x78, 0x56, 0xa2, 0xcf);
    // --- A full read mask cycles status, counter lo/hi, port A lo/hi, port B lo/hi
    expect(read(15)).toEqual([
      0x3a, 0x00, 0x00, 0x34, 0x12, 0x78, 0x56,
      0x3a, 0x00, 0x00, 0x34, 0x12, 0x78, 0x56,
      0x3a
    ]);

    // --- read mask, B->A, a Z80 DMA load and continue, status reinitialise, an initialise-read-sequence
    write(LEGACY, 0x79, 0x00, 0xc0, 0xbb, 0x1e, 0xcf);
    expect(read(9)).toEqual([0xff, 0xff, 0x00, 0xc0, 0x78, 0x56, 0x3a, 0xff, 0xff]);
    write(ZXNDMA, 0xd3, 0xa7, 0xbb, 0x61, 0x8b, 0xbf);
    expect(read(9)).toEqual([0x3a, 0x78, 0x56, 0x3a, 0x78, 0x56, 0x3a, 0x78, 0x56]);
    expect(exports.zxnextGetDmaMode()).toBe(ZXNDMA);
    expect(exports.zxnextGetDmaSeq()).toBe(0);
  });
});
