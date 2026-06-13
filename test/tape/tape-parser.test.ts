import { describe, expect, it } from "vitest";
import {
  BIT_0_PL,
  BIT_1_PL,
  PILOT_PL,
  SYNC_1_PL,
  SYNC_2_PL,
  TERM_SYNC
} from "@emu/tape/tape-const";
import { parseTapeFile } from "@emu/tape/tape-parser";

describe("tape parser", () => {
  it("parses TAP files with multiple length-prefixed blocks", () => {
    const result = parseTapeFile(bytes(u16(3), [0x00, 0x01, 0x02], u16(2), [0xff, 0xfe]));

    expect(result.format).toBe("tap");
    expect(result.warnings).toEqual([]);
    expect(result.blocks).toHaveLength(2);
    expect([...result.blocks[0].data]).toEqual([0x00, 0x01, 0x02]);
    expect([...result.blocks[1].data]).toEqual([0xff, 0xfe]);
    expect(result.blocks[0]).toMatchObject({
      pauseAfter: 1000,
      pilotPulseLength: PILOT_PL,
      sync1PulseLength: SYNC_1_PL,
      sync2PulseLength: SYNC_2_PL,
      zeroBitPulseLength: BIT_0_PL,
      oneBitPulseLength: BIT_1_PL,
      endSyncPulseLength: TERM_SYNC
    });
  });

  it("parses TZX standard speed data blocks", () => {
    const result = parseTapeFile(
      bytes(tzxHeader(), [0x10], u16(1500), u16(4), [0x00, 0x11, 0x22, 0x33])
    );

    expect(result.format).toBe("tzx");
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].pauseAfter).toBe(1500);
    expect([...result.blocks[0].data]).toEqual([0x00, 0x11, 0x22, 0x33]);
  });

  it("parses TZX turbo speed data blocks", () => {
    const result = parseTapeFile(
      bytes(
        tzxHeader(),
        [0x11],
        u16(1000),
        u16(600),
        u16(700),
        u16(800),
        u16(1600),
        u16(3000),
        [7],
        u16(900),
        u24(3),
        [0xaa, 0xbb, 0xcc]
      )
    );

    expect(result.format).toBe("tzx");
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({
      pilotPulseLength: 1000,
      sync1PulseLength: 600,
      sync2PulseLength: 700,
      zeroBitPulseLength: 800,
      oneBitPulseLength: 1600,
      pilotPulseCount: 3000,
      lastByteUsedBits: 7,
      pauseAfter: 900
    });
    expect([...result.blocks[0].data]).toEqual([0xaa, 0xbb, 0xcc]);
  });

  it("parses TZX pure data and silence blocks", () => {
    const result = parseTapeFile(
      bytes(tzxHeader(), [0x14], u16(900), u16(1800), [6], u16(250), u24(1), [0x5a], [0x20], u16(750))
    );

    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0]).toMatchObject({
      pilotPulseLength: 0,
      sync1PulseLength: 0,
      sync2PulseLength: 0,
      zeroBitPulseLength: 900,
      oneBitPulseLength: 1800,
      lastByteUsedBits: 6,
      pauseAfter: 250
    });
    expect([...result.blocks[0].data]).toEqual([0x5a]);
    expect(result.blocks[1]).toMatchObject({
      data: new Uint8Array(0),
      pauseAfter: 750,
      pilotPulseLength: 0,
      zeroBitPulseLength: 0,
      endSyncPulseLength: 0
    });
  });

  it("skips known TZX metadata blocks and reports warnings", () => {
    const result = parseTapeFile(
      bytes(tzxHeader(), [0x21, 0x04], "demo", [0x10], u16(1000), u16(1), [0x00])
    );

    expect(result.blocks).toHaveLength(1);
    expect(result.warnings).toEqual(["Skipped non-data TZX block $21."]);
  });

  it("fails clearly for truncated TAP files", () => {
    expect(() => parseTapeFile(bytes(u16(5), [0x01]))).toThrow(/Cannot parse tape file/);
  });

  it("fails clearly for unsupported TZX block types", () => {
    expect(() => parseTapeFile(bytes(tzxHeader(), [0x99]))).toThrow(
      /Unsupported TZX block type: \$99/
    );
  });
});

function tzxHeader(): number[] {
  return [..."ZXTape!"].map((ch) => ch.charCodeAt(0)).concat([0x1a, 0x01, 0x14]);
}

function u16(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function u24(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff];
}

function bytes(...chunks: Array<number[] | string>): Uint8Array {
  return new Uint8Array(
    chunks.flatMap((chunk) =>
      typeof chunk === "string" ? [...chunk].map((ch) => ch.charCodeAt(0)) : chunk
    )
  );
}
