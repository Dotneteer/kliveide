import { describe, expect, it } from "vitest";

import { BinaryReader } from "@common/utils/BinaryReader";
import { TERM_SYNC } from "@common/structs/tape-const";
import { TzxReader } from "@emu/machines/tape/TzxReader";
import { TzxTurboSpeedBlock } from "@emu/machines/tape/TzxTurboSpeedBlock";
import { sp48TapeLoadFlow } from "@emu/machines/tapeLoadFlows";
import { createSp48Session } from "../harness/sp48";

/*
 * A TZX turbo-speed block ($11) as Klive's tape players receive it. `getDataBlock` used to put the
 * block's pilot pulse *count* into `endSyncPulseLength` and leave `pilotPulseCount` unset, so the
 * players played the ROM's default pilot and then a terminating pulse thousands of T-states long.
 */

const word = (v: number) => [v & 0xff, (v >> 8) & 0xff];
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const withChecksum = (bytes: number[]) => [...bytes, bytes.reduce((a, b) => a ^ b, 0)];

/** `10 PRINT 1` - a program small enough to load at ROM speed in a test */
const PROGRAM = [0x00, 0x0a, 0x03, 0x00, 0xf5, 0x31, 0x0d];

function turboTape(pilotCount: number): Uint8Array {
  const header = withChecksum([
    0x00,
    0x00,
    ...ascii("turbo".padEnd(10, " ")),
    ...word(PROGRAM.length),
    ...word(0x8000),
    ...word(PROGRAM.length)
  ]);
  const data = withChecksum([0xff, ...PROGRAM]);
  return new Uint8Array([
    ...ascii("ZXTape!"),
    0x1a,
    1,
    20,
    // --- The header at standard speed
    0x10,
    ...word(1000),
    ...word(header.length),
    ...header,
    // --- The data as a turbo block with ROM timings, but its own pilot length
    0x11,
    ...word(2168),
    ...word(667),
    ...word(735),
    ...word(855),
    ...word(1710),
    ...word(pilotCount),
    8,
    ...word(1000),
    data.length & 0xff,
    (data.length >> 8) & 0xff,
    0,
    ...data
  ]);
}

/** The blocks the emulator plays, as `MainToEmuProcessor.setTapeFile` makes them */
function playedBlocks(tape: Uint8Array) {
  const reader = new TzxReader(new BinaryReader(tape));
  expect(reader.readContent()).toBeNull();
  return reader.dataBlocks.map((b) => b.getDataBlock()).filter((b) => b);
}

describe("TZX turbo block playback", () => {
  it("hands the players the block's pilot count and the standard terminating pulse", () => {
    const block = new TzxTurboSpeedBlock();
    block.pilotPulseLength = 2000;
    block.pilotToneLength = 1234;
    block.lastByteUsedBits = 6;
    block.data = [0xff, 0x01, 0xfe];
    block.pauseAfter = 500;
    const played = block.getDataBlock();
    expect(played.pilotPulseLength).toBe(2000);
    expect(played.pilotPulseCount).toBe(1234);
    expect(played.endSyncPulseLength).toBe(TERM_SYNC);
    expect(played.lastByteUsedBits).toBe(6);
    expect(played.pauseAfter).toBe(500);
  });

  it("plays the block's own pilot length on the real machine", async () => {
    /** Frames from typing ENTER until the program is in memory, with fast load off */
    async function framesToLoad(pilotCount: number): Promise<number> {
      const s = await createSp48Session();
      s.bootToBasic();
      s.insertTape(playedBlocks(turboTape(pilotCount)), { fastLoad: false });
      s.typeFlowKeys(sp48TapeLoadFlow(), { gap: 8 });
      const prog = s.peekWord(0x5c53);
      for (let frame = 1; frame <= 1500; frame++) {
        s.runFrames(1);
        if (PROGRAM.every((b, i) => s.peek(prog + i) === b)) return frame;
      }
      const rows = [...Array(24).keys()].map((r) => s.screenLine(r)).filter((l) => l.trim());
      throw new Error(
        `The program did not load (pilot count ${pilotCount}); PC $${s.machine.pc.toString(16)}; screen: ${rows.join(" | ")}`
      );
    }

    /*
     * Both pilots are longer than the ~1.2 s the ROM's LD-BYTES waits before it listens for a
     * leader: a shorter one (1,000 pulses is 0.6 s) is over before the ROM looks, on a real
     * Spectrum as here, and the block never loads.
     */
    const short = await framesToLoad(4000);
    const long = await framesToLoad(8000);
    // --- 4,000 more pilot pulses of 2,168 T-states: ~124 frames of 69,888 T-states. Before the fix
    // --- both played the same default pilot and loaded on the same frame.
    const expected = (4000 * 2168) / 69_888;
    expect(long - short).toBeGreaterThan(expected - 10);
    expect(long - short).toBeLessThan(expected + 10);
  }, 120_000);
});
