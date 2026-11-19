import { describe, expect, it } from "vitest";

import {
  DDMA_2D,
  DDMA_FILL,
  DDMA_PHYSICAL,
  decodeDmaTransfers,
  lastTransferWriting,
  memoryOverlayOf,
  NEXT_DMA_TRANSFER_RECORD_SIZE,
  transferDestination,
  transferSource,
  type DmaTransfer
} from "@common/zxnext/dma/dmaTransfers";

/*
 * The DMA Transfers' model (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §14), without a core; the core's
 * recording is test/zxnext-hw/dma/dma-transfers.test.ts.
 */

const xfer = (over: Partial<DmaTransfer>): DmaTransfer => ({
  seq: 0,
  frame: 1,
  pos28: 0,
  bytes: 16,
  held28: 0,
  portA: { start: 0x8000, io: false, mode: "increment" },
  portB: { start: 0xc000, io: false, mode: "increment" },
  length: 16,
  pc: 0x6000,
  joined: false,
  aToB: true,
  mode: "continuous",
  autoRestart: false,
  zilog: false,
  intLost: false,
  notLoaded: false,
  prescaler: 0,
  end: "endOfBlock",
  restarts: 0,
  ddma: { flags: 0, extA: 0, extB: 0, fill: 0, rowLength: 0, rowCount: 0, strideA: 0, strideB: 0 },
  speed: 0,
  ...over
});

const memory = (...ranges: [number, number][]) => ({
  kind: "memory",
  physical: false,
  ranges: ranges.map(([from, to]) => ({ from, to }))
});

describe("DMA Transfers model", () => {
  it("decodes the 64-byte records", () => {
    const b = new Uint8Array(NEXT_DMA_TRANSFER_RECORD_SIZE);
    b.set([7, 0, 0, 0, 0x10, 0x27, 0, 0, 8, 0, 0, 0, 0x20, 0, 0, 0], 0);
    b.set([0, 1, 0, 0, 0x30, 0, 0, 0], 16); // --- 256 bytes, 48 clocks
    b.set([0x00, 0x80, 0xdf, 0x00, 0x00, 0x01, 0x07, 0x60], 24);
    b.set([0x02, 0x05, 0x01 | (2 << 1) | 0x08 | 0x40, 55, 2, 3], 32);
    b[46] = 1;
    const [t] = decodeDmaTransfers({ records: b, firstSeq: 12 });
    expect(t).toMatchObject({
      seq: 12,
      frame: 7,
      pos28: 10000,
      endFrame: 8,
      endPos28: 32,
      bytes: 256,
      held28: 48,
      length: 256,
      pc: 0x6007,
      aToB: true,
      mode: "burst",
      autoRestart: true,
      zilog: false,
      intLost: true,
      notLoaded: false,
      prescaler: 55,
      end: "disabled",
      restarts: 3,
      speed: 1
    });
    expect(t.portA).toEqual({ start: 0x8000, io: false, mode: "increment" });
    expect(t.portB).toEqual({ start: 0xdf, io: true, mode: "fixed" });
  });

  it("a running transfer has no end; the host's has no PC", () => {
    const b = new Uint8Array(NEXT_DMA_TRANSFER_RECORD_SIZE);
    b[34] = 0x20;
    const [t] = decodeDmaTransfers({ records: b, firstSeq: 0 });
    expect(t.end).toBe("running");
    expect(t.endFrame).toBeUndefined();
    expect(t.pc).toBeUndefined();
  });

  it("ranges for increment, decrement, fixed and a port", () => {
    expect(transferSource(xfer({}))).toEqual(memory([0x8000, 0x800f]));
    expect(transferSource(xfer({ portA: { start: 0x8000, io: false, mode: "decrement" } }))).toEqual(memory([0x7ff1, 0x8000]));
    expect(transferSource(xfer({ portA: { start: 0x8000, io: false, mode: "fixed" } }))).toEqual(memory([0x8000, 0x8000]));
    expect(transferDestination(xfer({ portB: { start: 0x5b, io: true, mode: "fixed" } }))).toEqual({ kind: "port", port: 0x5b });
    // --- B -> A swaps the sides
    expect(transferSource(xfer({ aToB: false }))).toEqual(memory([0xc000, 0xc00f]));
  });

  it("only the bytes moved so far, but a whole block once restarted; Zilog mode adds one", () => {
    expect(transferDestination(xfer({ bytes: 4, end: "running" }))).toEqual(memory([0xc000, 0xc003]));
    expect(transferDestination(xfer({ bytes: 100, restarts: 6, autoRestart: true }))).toEqual(memory([0xc000, 0xc00f]));
    expect(transferDestination(xfer({ bytes: 17, zilog: true }))).toEqual(memory([0xc000, 0xc010]));
  });

  it("wraps at 64K both ways", () => {
    expect(transferSource(xfer({ portA: { start: 0xfff8, io: false, mode: "increment" } }))).toEqual(
      memory([0xfff8, 0xffff], [0x0000, 0x0007])
    );
    expect(transferSource(xfer({ portA: { start: 0x0004, io: false, mode: "decrement" } }))).toEqual(
      memory([0x0000, 0x0004], [0xfff5, 0xffff])
    );
  });

  it("a rectangle's rows step by the stride; a fill has no source; physical is 22-bit", () => {
    const rect = xfer({
      bytes: 12,
      ddma: { flags: DDMA_2D, extA: 0, extB: 0, fill: 0, rowLength: 4, rowCount: 3, strideA: 4, strideB: 256 }
    });
    expect(transferSource(rect)).toEqual(memory([0x8000, 0x800b]));
    expect(transferDestination(rect)).toEqual(memory([0xc000, 0xc003], [0xc100, 0xc103], [0xc200, 0xc203]));
    const fill = xfer({ ddma: { ...rect.ddma, flags: DDMA_FILL, fill: 0xe3 } });
    expect(transferSource(fill)).toEqual({ kind: "fill", value: 0xe3 });
    const phys = xfer({ ddma: { ...rect.ddma, flags: DDMA_PHYSICAL, extB: 0x24 } });
    expect(transferDestination(phys)).toEqual({ kind: "memory", physical: true, ranges: [{ from: 0x24c000, to: 0x24c00f }] });
  });

  it("the memory overlay: CPU ranges, the working addresses only while running", () => {
    expect(memoryOverlayOf(xfer({ end: "running", bytes: 4 }), { source: 0x8004, destination: 0xc004 })).toEqual({
      seq: 0,
      read: [{ from: 0x8000, to: 0x8003 }],
      written: [{ from: 0xc000, to: 0xc003 }],
      nextRead: 0x8004,
      nextWrite: 0xc004
    });
    const done = memoryOverlayOf(xfer({ portB: { start: 0xdf, io: true, mode: "fixed" } }), { source: 1, destination: 2 });
    expect(done).toEqual({ seq: 0, read: [{ from: 0x8000, to: 0x800f }], written: [], nextRead: undefined, nextWrite: undefined });
  });

  it("a running auto-restarting transfer tints the block under way up to the counter", () => {
    const t = xfer({ end: "running", autoRestart: true, restarts: 3, bytes: 60 });
    expect(memoryOverlayOf(t, { source: 0x8005, destination: 0xc005, blockMoved: 5 })).toMatchObject({
      read: [{ from: 0x8000, to: 0x8004 }],
      written: [{ from: 0xc000, to: 0xc004 }],
      nextRead: 0x8005,
      nextWrite: 0xc005
    });
  });

  it("finds the last transfer that wrote an address", () => {
    const list = [xfer({ seq: 1 }), xfer({ seq: 2, portB: { start: 0xc008, io: false, mode: "increment" } }), xfer({ seq: 3, portB: { start: 0x5b, io: true, mode: "fixed" } })];
    expect(lastTransferWriting(list, 0xc000)?.seq).toBe(1);
    expect(lastTransferWriting(list, 0xc00a)?.seq).toBe(2);
    expect(lastTransferWriting(list, 0x4000)).toBeUndefined();
  });
});
