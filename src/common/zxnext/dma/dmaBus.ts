/*
 * The DMA Bus Timeline (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §13): the core's ring of bus holds,
 * decoded, and the per-frame figures the document shows. Pure: shared by the emulator process (which
 * copies the ring) and the renderer. The record layout is `zxnext-dma.c`'s (`zxnextDmaBusCloseHold`).
 */

export const NEXT_DMA_BUS_RECORD_SIZE = 16;

const FLAG_CONTINUES = 0x01;
const FLAG_CONTINUED = 0x02;
const FLAG_INT_LOST = 0x04;

/** The ring's records as the machine hands them over (`IZxNextIdeMachine.getDmaBus`) */
export type NextDmaBus = {
  enabled: boolean;
  capacity: number;
  /** Holds written since the last clear (only ever grows) */
  count: number;
  /** The sequence number of the first record in `records` */
  firstSeq: number;
  records: Uint8Array;
  /** The frame now running, and a frame's length in 28 MHz clocks */
  currentFrame: number;
  tactsInFrame: number;
};

/** One hold of the bus by the DMA (or the part of it in one frame) */
export type DmaBusHold = {
  seq: number;
  frame: number;
  /** Start, in 28 MHz clocks from the frame's start */
  pos28: number;
  /** Length in 28 MHz clocks */
  duration28: number;
  bytes: number;
  /** A frame end cut it: it goes on in the next frame */
  continues: boolean;
  /** It went on from the previous frame */
  continued: boolean;
  /** A pulse-mode interrupt began and ended while it lasted: the CPU never saw it */
  intLost: boolean;
  /** The CPU speed: 0 = 3.5 MHz ... 3 = 28 MHz */
  speed: number;
};

export function decodeDmaBus(bus: Pick<NextDmaBus, "records" | "firstSeq">): DmaBusHold[] {
  const out: DmaBusHold[] = [];
  const b = bus.records;
  const n = Math.floor(b.length / NEXT_DMA_BUS_RECORD_SIZE);
  const u32 = (o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  for (let i = 0; i < n; i++) {
    const o = i * NEXT_DMA_BUS_RECORD_SIZE;
    const flags = b[o + 14];
    out.push({
      seq: bus.firstSeq + i,
      frame: u32(o),
      pos28: u32(o + 4),
      duration28: u32(o + 8),
      bytes: b[o + 12] | (b[o + 13] << 8),
      continues: (flags & FLAG_CONTINUES) !== 0,
      continued: (flags & FLAG_CONTINUED) !== 0,
      intLost: (flags & FLAG_INT_LOST) !== 0,
      speed: (flags >> 4) & 0x03
    });
  }
  return out;
}

/** 28 MHz clocks to CPU T-states at a speed (a T-state is 8 >> speed clocks) */
export const clocksToT = (clocks: number, speed: number) => clocks / (8 >> (speed & 0x03));

/** One frame's figures */
export type DmaBusFrame = {
  frame: number;
  holds: number;
  bytes: number;
  /** 28 MHz clocks the DMA held the bus */
  held28: number;
  /** held28 / the frame's length, 0-1 */
  share: number;
  intLost: boolean;
  /**
   * The byte period of a paced transfer, in CPU T-states: the spacing of consecutive one-byte holds,
   * min and max (undefined without two such holds)
   */
  period?: { min: number; max: number; average: number };
};

/** The holds of one frame, in order */
export const holdsOfFrame = (holds: readonly DmaBusHold[], frame: number) => holds.filter((h) => h.frame === frame);

/** One frame's figures from its holds */
export function dmaBusFrame(holds: readonly DmaBusHold[], frame: number, tactsInFrame: number): DmaBusFrame {
  const mine = holdsOfFrame(holds, frame);
  const held28 = mine.reduce((sum, h) => sum + h.duration28, 0);
  const periods: number[] = [];
  for (let i = 1; i < mine.length; i++) {
    const a = mine[i - 1];
    const b = mine[i];
    if (a.bytes === 1 && b.bytes === 1) periods.push(clocksToT(b.pos28 - a.pos28, b.speed));
  }
  return {
    frame,
    holds: mine.length,
    bytes: mine.reduce((sum, h) => sum + h.bytes, 0),
    held28,
    share: tactsInFrame > 0 ? Math.min(1, held28 / tactsInFrame) : 0,
    intLost: mine.some((h) => h.intLost),
    period:
      periods.length > 0
        ? {
            min: Math.min(...periods),
            max: Math.max(...periods),
            average: periods.reduce((s, p) => s + p, 0) / periods.length
          }
        : undefined
  };
}

/** The frames the held records cover, oldest first, with each one's figures */
export function dmaBusFrames(holds: readonly DmaBusHold[], tactsInFrame: number): DmaBusFrame[] {
  const frames = [...new Set(holds.map((h) => h.frame))].sort((a, b) => a - b);
  return frames.map((f) => dmaBusFrame(holds, f, tactsInFrame));
}
