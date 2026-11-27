import { describe, expect, it } from "vitest";

import { tapeBlocksOf } from "@common/headless/tapeBlocks";
import { BIT_0_PL, BIT_1_PL, PILOT_PL, SYNC_1_PL, SYNC_2_PL } from "@common/structs/tape-const";
import { samTapeFromBlocks } from "@emu/machines/samcoupe/SamTapeFile";
import { sp48TapeLoadFlow } from "@emu/machines/tapeLoadFlows";
import { createSp48Session } from "../harness/sp48";

/*
 * TZX blocks 12h (pure tone), 13h (pulse sequence), 14h (pure data) and 15h (direct recording). Klive's tape
 * layer used to drop 13h-15h, and the Spectrum-family player played a 12h tone as silence (a block with no
 * data was a pause), so a TZX that builds its blocks from them played incompletely. They now reach the players
 * as explicit pulses (`TapeDataBlock.pulses`) or a data block with no pilot.
 */

const word = (v: number) => [v & 0xff, (v >> 8) & 0xff];
const three = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff];
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const withChecksum = (bytes: number[]) => [...bytes, bytes.reduce((a, b) => a ^ b, 0)];
const tzx = (...blocks: number[][]) => new Uint8Array([...ascii("ZXTape!"), 0x1a, 1, 20, ...blocks.flat()]);

const pureTone = (pulse: number, count: number) => [0x12, ...word(pulse), ...word(count)];
const pulseSequence = (pulses: number[]) => [0x13, pulses.length, ...pulses.flatMap(word)];
const pureData = (zero: number, one: number, lastBits: number, pause: number, data: number[]) => [
  0x14,
  ...word(zero),
  ...word(one),
  lastBits,
  ...word(pause),
  ...three(data.length),
  ...data
];
const directRecording = (tacts: number, pause: number, lastBits: number, data: number[]) => [
  0x15,
  ...word(tacts),
  ...word(pause),
  lastBits,
  ...three(data.length),
  ...data
];
const standard = (pause: number, data: number[]) => [0x10, ...word(pause), ...word(data.length), ...data];

function blocksOf(file: Uint8Array) {
  const result = tapeBlocksOf(file);
  if ("error" in result) throw new Error(result.error);
  return result.blocks;
}

/** `10 PRINT 1` and its header, as the ROM saves them */
const PROGRAM = [0x00, 0x0a, 0x03, 0x00, 0xf5, 0x31, 0x0d];
const HEADER = withChecksum([
  0x00,
  0x00,
  ...ascii("pulses".padEnd(10, " ")),
  ...word(PROGRAM.length),
  ...word(0x8000),
  ...word(PROGRAM.length)
]);
const DATA = withChecksum([0xff, ...PROGRAM]);

/** The standard data block's pulses: pilot, syncs, two per bit */
function standardPulses(data: number[]): number[] {
  const pulses: number[] = Array(3223).fill(PILOT_PL);
  pulses.push(SYNC_1_PL, SYNC_2_PL);
  for (const byte of data) {
    for (let b = 7; b >= 0; b--) {
      const p = (byte >> b) & 1 ? BIT_1_PL : BIT_0_PL;
      pulses.push(p, p);
    }
  }
  return pulses;
}

/** Pulses sampled every `tacts` T-states into a direct recording's bits, starting high */
function sampled(pulses: number[], tacts: number): { bits: number[]; lastBits: number } {
  const samples: number[] = [];
  let level = 1;
  let time = 0;
  let next = 0;
  for (const p of pulses) {
    next += p;
    while (time < next) {
      samples.push(level);
      time += tacts;
    }
    level ^= 1;
  }
  const bits: number[] = [];
  for (let i = 0; i < samples.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte |= (samples[i + b] ?? 0) << (7 - b);
    bits.push(byte);
  }
  return { bits, lastBits: samples.length % 8 || 8 };
}

describe("TZX pulse blocks", () => {
  it("reads 12h, 13h, 14h and 15h into blocks the players play", () => {
    const blocks = blocksOf(
      tzx(
        pureTone(2000, 300),
        pulseSequence([667, 735]),
        pureData(855, 1710, 6, 500, [0xa5, 0xfc]),
        // --- Samples 1 1 1 0 0 0 1 1 | 0 0 0 0 (4 bits used): runs of 3, 3, 2 and 4
        directRecording(100, 250, 4, [0b11100011, 0b00000000])
      )
    );
    expect(blocks).toHaveLength(4);
    expect(blocks[0].pulses).toEqual([{ length: 2000, count: 300 }]);
    expect(blocks[0].pauseAfter).toBe(0);
    expect(blocks[1].pulses).toEqual([
      { length: 667, count: 1 },
      { length: 735, count: 1 }
    ]);
    expect(blocks[2].pulses).toBeUndefined();
    expect(Array.from(blocks[2].data)).toEqual([0xa5, 0xfc]);
    expect([blocks[2].pilotPulseLength, blocks[2].sync1PulseLength, blocks[2].sync2PulseLength]).toEqual([0, 0, 0]);
    expect([blocks[2].zeroBitPulseLength, blocks[2].oneBitPulseLength]).toEqual([855, 1710]);
    expect(blocks[2].endSyncPulseLength).toBe(0);
    expect(blocks[2].lastByteUsedBits).toBe(6);
    expect(blocks[2].pauseAfter).toBe(500);
    expect(blocks[3].pulses).toEqual([300, 300, 200, 400].map((length) => ({ length, count: 1 })));
    expect(blocks[3].pauseAfter).toBe(250);
  });

  it("plays them on the SAM as edges", () => {
    const blocks = blocksOf(tzx(pureTone(2000, 3), pulseSequence([667, 735]), directRecording(100, 1, 8, [0b11110000])));
    expect(Array.from(samTapeFromBlocks(blocks).edges)).toEqual([2000, 2000, 2000, 667, 735, 400, 400, 3500]);
  });

  /** Frames from ENTER until `10 PRINT 1` is in memory, the tape's data block made by `dataBlocks`, fast load off */
  async function framesToLoad(dataBlocks: number[][]): Promise<number> {
    const s = await createSp48Session();
    s.bootToBasic();
    s.insertTape(blocksOf(tzx(standard(1000, HEADER), ...dataBlocks)), { fastLoad: false });
    s.typeFlowKeys(sp48TapeLoadFlow(), { gap: 8 });
    const prog = s.peekWord(0x5c53);
    for (let frame = 1; frame <= 1500; frame++) {
      s.runFrames(1);
      if (PROGRAM.every((b, i) => s.peek(prog + i) === b)) return frame;
    }
    throw new Error(`The program did not load; PC $${s.machine.pc.toString(16)}`);
  }

  it("loads a data block made of a 12h pilot, 13h syncs and 14h data with the 48K ROM", async () => {
    const pulses = await framesToLoad([
      pureTone(PILOT_PL, 3223),
      pulseSequence([SYNC_1_PL, SYNC_2_PL]),
      pureData(BIT_0_PL, BIT_1_PL, 8, 1000, DATA)
    ]);
    // --- The same block at standard speed loads on the same frame, give or take the joins
    const plain = await framesToLoad([standard(1000, DATA)]);
    expect(Math.abs(pulses - plain)).toBeLessThanOrEqual(2);
  }, 120_000);

  it("loads a data block recorded directly (15h) with the 48K ROM", async () => {
    const { bits, lastBits } = sampled(standardPulses(DATA), 79);
    const frames = await framesToLoad([directRecording(79, 1000, lastBits, bits)]);
    expect(frames).toBeGreaterThan(0);
  }, 120_000);
});
