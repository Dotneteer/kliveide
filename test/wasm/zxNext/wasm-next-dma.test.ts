import { describe, expect, it } from "vitest";
import { DmaMode } from "@emu/machines/zxNext/DmaDevice";
import { TestZxNextMachine } from "../../zxnext/TestNextMachine";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

/*
 * The DMA register and read sequencers of the two cores, byte for byte. Transfers, timing and the
 * hardware behaviour itself are tested on both cores through the harness: test/zxnext-hw/dma/dma.test.ts.
 */
describe("ZX Next WASM DMA device", () => {
  it("matches the TypeScript DMA write and read sequencers", async () => {
    const oracle = new TestZxNextMachine().dmaDevice;
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;
    const write = (mode: DmaMode, ...values: number[]): void => {
      for (const value of values) {
        oracle.setDmaMode(mode);
        oracle.writePort(value);
        exports.zxnextDmaSetMode(mode);
        exports.zxnextDmaWritePort(value);
      }
    };
    const read = (n: number) => {
      const ts: number[] = [];
      const w: number[] = [];
      for (let i = 0; i < n; i++) {
        ts.push(oracle.readStatusByte());
        w.push(exports.zxnextDmaReadStatusByte());
      }
      return { ts, w };
    };

    // --- WR0 A->B, port A $1234, length $0010; WR1/WR2 with timing bytes; WR4 port B $5678; WR5; load
    write(DmaMode.ZXNDMA, 0x7d, 0x34, 0x12, 0x10, 0x00, 0x54, 0x21, 0xee, 0x50, 0x22, 0x40, 0xad, 0x78, 0x56, 0xa2, 0xcf);
    let r = read(15);
    expect(r.w).toEqual(r.ts);
    expect(r.ts.slice(0, 7)).toEqual([0x3a, 0x00, 0x00, 0x34, 0x12, 0x78, 0x56]);

    // --- read mask, B->A, a Z80 DMA load and continue, status reinitialise, an initialise-read-sequence
    write(DmaMode.LEGACY, 0x79, 0x00, 0xc0, 0xbb, 0x1e, 0xcf);
    r = read(9);
    expect(r.w).toEqual(r.ts);
    write(DmaMode.ZXNDMA, 0xd3, 0xa7, 0xbb, 0x61, 0x8b, 0xbf);
    r = read(9);
    expect(r.w).toEqual(r.ts);
    expect(exports.zxnextGetDmaMode()).toBe(oracle.getDmaMode());
    expect(exports.zxnextGetDmaSeq()).toBe(oracle.getDmaSeq());
  });
});
