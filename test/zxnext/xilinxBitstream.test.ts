import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { delimiter } from "node:path";

import { TBU_SECTOR, parseTbuFile } from "@common/zxnext/tbuFile";
import { BITSTREAM_PACKET_LIMIT, bitstreamRegisterName, decodeBitstreamPackets } from "@common/zxnext/xilinxBitstream";

/*
 * The bitstream packet list of the TBU viewer (`dev/plans/TBBLUE_TBU_VIEWER_PLAN.md` D8), on bitstreams
 * built here in the shape of the Next's (UG380 for Spartan-6, UG470 for 7-series).
 * `TBU_REAL_FILES` decodes every image of real TBU files as well, never in CI.
 */

const SYNC = [0xaa, 0x99, 0x55, 0x66];

/** 7-series words */
const s7 = {
  nop: 0x20000000,
  t1: (reg: number, words: number) => (0x30000000 | (reg << 13) | words) >>> 0,
  t2: (words: number) => (0x50000000 | words) >>> 0
};

/** Spartan-6 words */
const s6 = {
  nop: 0x2000,
  t1: (reg: number, words: number) => 0x3000 | (reg << 5) | words,
  t2: (reg: number) => 0x5000 | (reg << 5)
};

function bytes32(words: number[]): number[] {
  return words.flatMap((w) => [w >>> 24, (w >> 16) & 0xff, (w >> 8) & 0xff, w & 0xff]);
}

function bytes16(words: number[]): number[] {
  return words.flatMap((w) => [(w >> 8) & 0xff, w & 0xff]);
}

/** Leading `$FF`s, the sync word, the body, then `$FF` padding */
function image(body: number[], lead = 8, pad = 64): Uint8Array {
  return Uint8Array.from([...new Array(lead).fill(0xff), ...SYNC, ...body, ...new Array(pad).fill(0xff)]);
}

/** A 7-series bitstream like the Issue 4 one: header writes, one frame-data block, the tail */
function series7Image(frameWords = 6): Uint8Array {
  return image(
    bytes32([
      s7.nop,
      s7.t1(0x1f, 1), 0x0000026c, // BSPI
      s7.t1(0x04, 1), 0x12, // CMD BSPI_READ
      s7.nop,
      s7.nop,
      s7.t1(0x13, 1), 0, // undocumented register
      s7.t1(0x0c, 1), 0x0362e093, // IDCODE
      s7.t1(0x04, 1), 0x01, // CMD WCFG
      s7.t1(0x02, 0), // FDRI, then a Type 2 with the data
      s7.t2(frameWords), ...new Array(frameWords).fill(0x12345678),
      s7.t1(0x00, 1), 0x620efcaa, // CRC
      s7.t1(0x04, 1), 0x0d // CMD DESYNC
    ])
  );
}

/** A Spartan-6 bitstream like the Issue 2 one: two-word values, a Type 2 FDRI and its AUTO CRC */
function spartan6Image(frameWords = 4): Uint8Array {
  return image(
    bytes16([
      s6.t1(0x05, 1), 0x0007, // CMD RCRC
      s6.nop,
      s6.t1(0x0e, 2), 0x0400, 0x2093, // IDCODE
      s6.nop,
      s6.nop,
      s6.nop,
      s6.t1(0x01, 2), 0x0000, 0x0000, // FAR_MAJ
      s6.t1(0x05, 1), 0x0001, // CMD WCFG
      s6.t2(0x03), 0x0000, frameWords, ...new Array(frameWords).fill(0xabcd), 0x001f, 0xacd6, // FDRI + AUTO CRC
      s6.t1(0x05, 1), 0x000d, // CMD DESYNC
      s6.nop
    ])
  );
}

describe("bitstream packets, 7-series", () => {
  it("lists the header writes, the frame data and the tail", () => {
    const data = series7Image();
    const d = decodeBitstreamPackets(data, 0, data.length, "series7");
    expect(d.syncOffset).toBe(8);
    expect(d.stop).toBe("padding");
    expect(d.frameDataBytes).toBe(24);
    expect(
      d.packets.map((p) => [p.offset, p.type, p.op, p.registerName ?? p.register, p.words, p.value, p.command ?? p.part])
    ).toEqual([
      [12, 1, "nop", 0, 0, undefined, undefined],
      [16, 1, "write", "BSPI", 1, 0x26c, undefined],
      [24, 1, "write", "CMD", 1, 0x12, "BSPI_READ"],
      [32, 1, "nop", 0, 0, undefined, undefined],
      [40, 1, "write", 0x13, 1, 0, undefined],
      [48, 1, "write", "IDCODE", 1, 0x0362e093, "XC7A15T"],
      [56, 1, "write", "CMD", 1, 1, "WCFG"],
      [64, 1, "write", "FDRI", 0, undefined, undefined],
      [68, 2, "write", "FDRI", 6, undefined, undefined],
      [96, 1, "write", "CRC", 1, 0x620efcaa, undefined],
      [104, 1, "write", "CMD", 1, 0x0d, "DESYNC"]
    ]);
    // --- Two NOPs in a row are one packet
    expect(d.packets[3].repeat).toBe(2);
    expect(d.end).toBe(112);
  });

  it("ends at the image's end when there is no padding", () => {
    const data = series7Image();
    const d = decodeBitstreamPackets(data, 0, data.length - 64, "series7");
    expect(d.stop).toBe("end");
    expect(d.end).toBe(data.length - 64);
  });

  it("decodes from an offset in a larger buffer", () => {
    const inner = series7Image();
    const data = new Uint8Array(inner.length + 100);
    data.set(inner, 100);
    const d = decodeBitstreamPackets(data, 100, data.length, "series7");
    expect(d.syncOffset).toBe(8);
    expect(d.packets[5].part).toBe("XC7A15T");
  });

  it("stops at a packet that runs past the end", () => {
    const data = series7Image(6);
    const d = decodeBitstreamPackets(data, 0, 80, "series7");
    expect(d.stop).toBe("truncated");
    expect(d.packets.at(-1)?.registerName).toBe("FDRI");
    expect(d.end).toBe(68);
  });

  it("treats a run of $00 after the bitstream as padding", () => {
    const data = Uint8Array.from([...SYNC, ...bytes32([s7.t1(0x04, 1), 0x0d]), ...new Array(32).fill(0)]);
    expect(decodeBitstreamPackets(data, 0, data.length, "series7").stop).toBe("padding");
  });

  it("stops at a word that is no packet", () => {
    const data = image(bytes32([s7.t1(0x04, 1), 0x07, 0x12345678]), 0, 0);
    const d = decodeBitstreamPackets(data, 0, data.length, "series7");
    expect(d.stop).toBe("unknownWord");
    expect(d.packets).toHaveLength(1);
  });

  it("says when there is no sync word", () => {
    const d = decodeBitstreamPackets(new Uint8Array(256).fill(0xff), 0, 256, "series7");
    expect(d).toMatchObject({ stop: "noSync", packets: [] });
    expect(d.syncOffset).toBeUndefined();
  });

  it("stops at the packet limit", () => {
    const words: number[] = [];
    for (let i = 0; i <= BITSTREAM_PACKET_LIMIT; i++) words.push(s7.t1(0x04, 1), 0);
    const data = image(bytes32(words), 0, 0);
    const d = decodeBitstreamPackets(data, 0, data.length, "series7");
    expect(d.stop).toBe("limit");
    expect(d.packets).toHaveLength(BITSTREAM_PACKET_LIMIT);
  });
});

describe("bitstream packets, Spartan-6", () => {
  it("reads 16-bit packets, two-word values, the FDRI block and its AUTO CRC", () => {
    const data = spartan6Image();
    const d = decodeBitstreamPackets(data, 0, data.length, "spartan6");
    expect(d.stop).toBe("padding");
    expect(d.frameDataBytes).toBe(8);
    expect(d.packets.map((p) => [p.type, p.registerName ?? p.op, p.value, p.command ?? p.part, p.repeat])).toEqual([
      [1, "CMD", 7, "RCRC", undefined],
      [1, "nop", undefined, undefined, undefined],
      [1, "IDCODE", 0x04002093, "XC6SLX16", undefined],
      [1, "nop", undefined, undefined, 3],
      [1, "FAR_MAJ", 0, undefined, undefined],
      [1, "CMD", 1, "WCFG", undefined],
      [2, "FDRI", undefined, undefined, undefined],
      [1, "CMD", 0x0d, "DESYNC", undefined],
      [1, "nop", undefined, undefined, undefined]
    ]);
    const fdri = d.packets[6];
    expect(fdri).toMatchObject({ words: 4, bytes: 12, autoCrc: 0x001facd6 });
  });

  it("takes a Type 2 packet's register from its own header", () => {
    // --- A Type 2 straight after a CMD write still writes FDRI, as the Issue 2 bitstream does
    const data = image(bytes16([s6.t1(0x05, 1), 0x0001, s6.t2(0x03), 0, 1, 0x1234, 0, 0, s6.t1(0x05, 1), 0x000d]));
    const d = decodeBitstreamPackets(data, 0, data.length, "spartan6");
    expect(d.packets.map((p) => p.registerName)).toEqual(["CMD", "FDRI", "CMD"]);
  });
});

describe("bitstream register names", () => {
  it("follows each family's table", () => {
    expect(bitstreamRegisterName("series7", 0x10)).toBe("WBSTAR");
    expect(bitstreamRegisterName("series7", 0x13)).toBeUndefined();
    expect(bitstreamRegisterName("spartan6", 0x13)).toBe("GENERAL1");
    expect(bitstreamRegisterName("spartan6", 0x22)).toBe("CBC_REG");
  });
});

const realFiles = (process.env.TBU_REAL_FILES ?? "").split(delimiter).filter(Boolean);

describe.skipIf(realFiles.length === 0)("real bitstreams (TBU_REAL_FILES)", () => {
  it.each(realFiles)("every image of %s decodes to its last data byte", (path) => {
    expect(existsSync(path)).toBe(true);
    const data = new Uint8Array(readFileSync(path));
    const tbu = parseTbuFile(data);
    const images = tbu.legacy
      ? [{ start: TBU_SECTOR, end: data.length, info: tbu.legacy.bitstream }]
      : tbu.records.map((r) => ({
          start: r.fileOffset,
          end: r.fileOffset + r.byteLength - (r.trailer ? TBU_SECTOR : 0),
          info: r.bitstream!
        }));
    for (const { start, end, info } of images) {
      const d = decodeBitstreamPackets(data, start, end, info.family!);
      expect(["end", "padding"]).toContain(d.stop);
      // --- The probe trims only `$FF`; the legacy file pads with `$00`, so its decode ends earlier
      if (tbu.legacy) expect(d.end).toBeLessThanOrEqual(info.dataLength);
      else expect(d.end).toBe(info.dataLength);
      expect(d.packets.some((p) => p.command === "DESYNC")).toBe(true);
    }
  });
});
