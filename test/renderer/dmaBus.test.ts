import { describe, expect, it } from "vitest";

import { clocksToT, decodeDmaBus, dmaBusFrame, dmaBusFrames, NEXT_DMA_BUS_RECORD_SIZE, type DmaBusHold } from "@common/zxnext/dma/dmaBus";

/*
 * The DMA Bus Timeline's model (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §13), without a core; the core's
 * recording is test/zxnext-hw/dma/dma-bus-timeline.test.ts.
 */

const hold = (over: Partial<DmaBusHold>): DmaBusHold => ({
  seq: 0,
  frame: 10,
  pos28: 0,
  duration28: 48,
  bytes: 1,
  continues: false,
  continued: false,
  intLost: false,
  speed: 0,
  ...over
});

describe("DMA Bus Timeline model", () => {
  it("decodes the 16-byte records", () => {
    const b = new Uint8Array(NEXT_DMA_BUS_RECORD_SIZE * 2);
    b.set([7, 0, 0, 0, 0x10, 0x27, 0, 0, 0x30, 0, 0, 0, 1, 0, 0x05 | 0x10, 0], 0);
    b.set([8, 0, 0, 0, 0x20, 0, 0, 0, 0x00, 0x10, 0, 0, 0x00, 0x02, 0x02, 0], 16);
    expect(decodeDmaBus({ records: b, firstSeq: 40 })).toEqual([
      { seq: 40, frame: 7, pos28: 10000, duration28: 48, bytes: 1, continues: true, continued: false, intLost: true, speed: 1 },
      { seq: 41, frame: 8, pos28: 32, duration28: 4096, bytes: 512, continues: false, continued: true, intLost: false, speed: 0 }
    ]);
  });

  it("converts 28 MHz clocks to T-states at each speed", () => {
    expect([0, 1, 2, 3].map((s) => clocksToT(48, s))).toEqual([6, 12, 24, 48]);
  });

  it("a frame's share, bytes and the paced byte period", () => {
    const holds = [0, 1808, 3624, 5424].map((pos28, i) => hold({ seq: i, pos28 }));
    const f = dmaBusFrame(holds, 10, 70908 * 8);
    expect(f).toMatchObject({ frame: 10, holds: 4, bytes: 4, held28: 192, intLost: false });
    expect(f.share).toBeCloseTo(192 / (70908 * 8), 6);
    // --- 226, 227 and 225 T-states apart
    expect(f.period).toEqual({ min: 225, max: 227, average: 226 });
  });

  it("no period for a continuous hold; a lost interrupt marks the frame", () => {
    const f = dmaBusFrame([hold({ bytes: 4000, duration28: 4000 * 48, intLost: true })], 10, 70908 * 8);
    expect(f.period).toBeUndefined();
    expect(f.intLost).toBe(true);
  });

  it("lists the frames the holds cover, oldest first", () => {
    const frames = dmaBusFrames([hold({ frame: 12 }), hold({ frame: 10 }), hold({ frame: 12, pos28: 500 })], 1000);
    expect(frames.map((f) => [f.frame, f.holds])).toEqual([
      [10, 1],
      [12, 2]
    ]);
  });
});
