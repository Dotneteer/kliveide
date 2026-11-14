import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { delimiter } from "node:path";

import {
  TBU_INDEX_CAPACITY,
  TBU_SECTOR,
  fletcher16,
  formatCoreVersion,
  fpgaPartName,
  isTbuFileName,
  parseTbuFile,
  type TbuProblemCode
} from "@common/zxnext/tbuFile";

/*
 * The TBBLUE.TBU reader (`dev/plans/TBBLUE_TBU_VIEWER_PLAN.md` §1, §1a). The files are built here,
 * shaped like the real ones (the 26.11a index: shared images, type 3, board variants, unsorted); no
 * multi-megabyte fixture is committed. `TBU_REAL_FILES` (paths separated by the platform's delimiter)
 * checks real files as well, never in CI.
 */

type CoreSpec = {
  type?: number;
  board: number;
  major?: number;
  sub?: number;
  /** Bitstream bytes (before padding and the trailer) */
  bitstream?: Uint8Array;
  /** Image length in sectors, trailer included */
  sectors?: number;
  /** Reuse the image of an earlier core (its index in the list) */
  shareWith?: number;
  trailer?: boolean;
};

/** A 7-series bitstream start: padding, sync, a NOOP, the IDCODE write */
function series7(idcode: number, size = 600): Uint8Array {
  const b = new Uint8Array(size).fill(0xff);
  b.set([0xaa, 0x99, 0x55, 0x66], 16);
  b.set([0x20, 0, 0, 0], 20);
  b.set([0x30, 0x01, 0x80, 0x01], 24);
  b.set([idcode >>> 24, (idcode >> 16) & 0xff, (idcode >> 8) & 0xff, idcode & 0xff], 28);
  b.fill(0x12, 32, size - 100);
  return b;
}

/** A Spartan-6 bitstream start: sync, a CMD write, the IDCODE write of two 16-bit words */
function spartan6(idcode: number, size = 600): Uint8Array {
  const b = new Uint8Array(size).fill(0xff);
  b.set([0xaa, 0x99, 0x55, 0x66], 16);
  b.set([0x30, 0xa1, 0x00, 0x07], 20);
  b.set([0x31, 0xc2], 24);
  b.set([idcode >>> 24, (idcode >> 16) & 0xff, (idcode >> 8) & 0xff, idcode & 0xff], 26);
  b.fill(0x34, 30, size - 50);
  return b;
}

const PARTS: Record<number, () => Uint8Array> = {
  0: () => spartan6(0x04002093),
  1: () => spartan6(0x04002093),
  2: () => series7(0x0362e093),
  3: () => series7(0x0362d093)
};

/** Build a multi-core file the way the maker lays it out */
function buildTbu(cores: CoreSpec[]): Uint8Array {
  const header = new Uint8Array(TBU_SECTOR).fill(0xff);
  header.set(Array.from("TBUFILE\0", (c) => c.charCodeAt(0)), 0);
  header.set(Array.from("ZX SPECTRUM NEXT\0", (c) => c.charCodeAt(0)), 8);
  const images: Uint8Array[] = [];
  const placed: { offset: number; sectors: number; checksum: number }[] = [];
  let nextSector = 0;
  cores.forEach((core, i) => {
    const type = core.type ?? 1;
    const major = core.major ?? 0x33;
    const sub = core.sub ?? 3;
    let where = core.shareWith !== undefined ? placed[core.shareWith] : undefined;
    if (!where) {
      const sectors = core.sectors ?? 4;
      const image = new Uint8Array(sectors * TBU_SECTOR).fill(0xff);
      image.set((core.bitstream ?? PARTS[core.board & 0x0f]()).subarray(0, image.length - TBU_SECTOR));
      if (core.trailer !== false) {
        const t = image.length - TBU_SECTOR;
        const text = `ZX SPECTRUM NEXT\0ZXN ISSUE ${(core.board & 0x0f) + 2} ZX SPECTRUM NEXT\0`;
        image.set(Array.from(text, (c) => c.charCodeAt(0)), t);
        image.set([7, type, core.board, major, sub, 0xff, 0xff], t + text.length);
      }
      where = { offset: nextSector, sectors, checksum: fletcher16(image) };
      nextSector += sectors;
      images.push(image);
    }
    placed.push(where);
    const r = 25 + i * 15;
    header[r] = 15;
    header[r + 1] = type;
    header[r + 2] = core.board;
    header[r + 3] = major;
    header[r + 4] = sub;
    new DataView(header.buffer).setUint32(r + 5, where.offset, true);
    new DataView(header.buffer).setUint32(r + 9, where.sectors, true);
    new DataView(header.buffer).setUint16(r + 13, where.checksum, true);
  });
  const file = new Uint8Array(TBU_SECTOR + nextSector * TBU_SECTOR);
  file.set(header);
  let at = TBU_SECTOR;
  for (const image of images) {
    file.set(image, at);
    at += image.length;
  }
  return file;
}

/** The 26.11a index's shape (§1a), with small images */
function shaped2611a(): Uint8Array {
  return buildTbu([
    { board: 0x20 },
    { board: 0x02, sectors: 6 },
    { board: 0x03, sectors: 6 },
    { board: 0x10 },
    { board: 0x00, shareWith: 0 },
    { type: 3, board: 0x40, major: 0x32, sub: 4, sectors: 3 },
    { type: 3, board: 0x41, major: 0x32, sub: 4, shareWith: 5 }
  ]);
}

const codes = (data: Uint8Array): TbuProblemCode[] => parseTbuFile(data).problems.map((p) => p.code);

describe("TBBLUE.TBU file name", () => {
  it("matches the update file in any case and folder", () => {
    expect(isTbuFileName("TBBLUE.TBU")).toBe(true);
    expect(isTbuFileName("/Volumes/NEXT/tbblue.tbu")).toBe(true);
    expect(isTbuFileName("C:\\sd\\TbBlue.Tbu")).toBe(true);
  });

  it("does not match other .tbu files", () => {
    expect(isTbuFileName("GAME.TBU")).toBe(false);
    expect(isTbuFileName("/x/MYTBBLUE.TBU")).toBe(false);
    expect(isTbuFileName("TBBLUE.HDMI.TBU")).toBe(false);
    expect(isTbuFileName("TBBLUE.TBU/x")).toBe(false);
  });
});

describe("TBBLUE.TBU helpers", () => {
  it("computes Fletcher-16 as the index stores it", () => {
    // --- The classic test vectors (sum1 low, sum2 high)
    const bytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
    expect(fletcher16(bytes("abcde"))).toBe(0xc8f0);
    expect(fletcher16(bytes("abcdef"))).toBe(0x2057);
    expect(fletcher16(bytes("abcdefgh"))).toBe(0x0627);
  });

  it("gives the same result in pieces as in one go, over long runs of $FF", () => {
    const data = new Uint8Array(5000).fill(0xff);
    data[17] = 3;
    const whole = fletcher16(data);
    expect(fletcher16(data, fletcher16(data, 0, 0, 1234), 1234)).toBe(whole);
  });

  it("formats versions and names parts", () => {
    expect(formatCoreVersion(0x33, 3)).toBe("3.03.03");
    expect(formatCoreVersion(0x20, 26)).toBe("2.00.26");
    expect(fpgaPartName(0x0362e093)).toBe("XC7A15T");
    expect(fpgaPartName(0x1362d093)).toBe("XC7A35T");
    expect(fpgaPartName(0x04002093)).toBe("XC6SLX16");
    expect(fpgaPartName(0x12345678)).toBeUndefined();
  });

  it("has room for 32 records", () => {
    expect(TBU_INDEX_CAPACITY).toBe(32);
  });
});

describe("TBBLUE.TBU multi-core files", () => {
  it("reads a clean file with one core per board", () => {
    const tbu = parseTbuFile(buildTbu([{ board: 0, sectors: 3 }, { board: 2, sectors: 5 }, { board: 3, sectors: 5 }]));
    expect(tbu.format).toBe("multi");
    expect(tbu.machine).toBe("ZX SPECTRUM NEXT");
    expect(tbu.problems).toEqual([]);
    expect(tbu.indexBytesUsed).toBe(3 * 15 + 1);
    expect(tbu.imagesEnd).toBe(tbu.fileSize);
    const [i2, i4, i5] = tbu.records;
    expect(i2).toMatchObject({ number: 1, type: 1, slot: 1, boardId: 0, issue: 2, variant: 0, version: "3.03.03" });
    expect(i2).toMatchObject({ sectorOffset: 0, sectorLength: 3, fileOffset: 512, byteLength: 1536 });
    expect(i2.computedChecksum).toBe(i2.storedChecksum);
    expect(i2.pullName).toBe("zxnext-2-30303.bin");
    expect(i2.slotSize).toBe(512 * 1024);
    expect(i4.fileOffset).toBe(512 + 3 * 512);
    expect(i4.slotSize).toBe(2176 * 1024);
    expect(i5.pullName).toBe("zxnext-5-30303.bin");
  });

  it("decodes the trailer sector and its flash record", () => {
    const record = parseTbuFile(buildTbu([{ board: 2, sectors: 3 }])).records[0];
    expect(record.trailer).toMatchObject({
      fileOffset: 512 + 2 * 512,
      machine: "ZX SPECTRUM NEXT",
      description: "ZXN ISSUE 4 ZX SPECTRUM NEXT",
      matchesRecord: true
    });
    expect(record.trailer!.flash).toEqual({
      length: 7,
      type: 1,
      boardByte: 2,
      coreMajor: 0x33,
      coreSub: 3,
      screenOffset: 0xffff
    });
  });

  it("reads what the bitstream says", () => {
    const [s6, a7] = parseTbuFile(buildTbu([{ board: 0, sectors: 3 }, { board: 2, sectors: 3 }])).records;
    expect(s6.bitstream).toMatchObject({ syncOffset: 16, family: "spartan6", idcode: 0x04002093, idcodeOffset: 26, part: "XC6SLX16" });
    expect(a7.bitstream).toMatchObject({ syncOffset: 16, family: "series7", idcode: 0x0362e093, idcodeOffset: 28, part: "XC7A15T" });
    // --- Data up to the last non-$FF byte, then padding to the trailer sector
    expect(a7.bitstream!.dataLength).toBe(500);
    expect(a7.bitstream!.paddingLength).toBe(2 * 512 - 500);
  });

  it("reads the 26.11a shape: shared images, type 3, variants, unsorted", () => {
    const tbu = parseTbuFile(shaped2611a());
    expect(tbu.problems).toEqual([]);
    expect(tbu.records.map((r) => r.boardByte)).toEqual([0x20, 0x02, 0x03, 0x10, 0x00, 0x40, 0x41]);
    expect(tbu.records[0]).toMatchObject({ boardId: 0, variant: 2, issue: 2, sharedWith: [5] });
    expect(tbu.records[4]).toMatchObject({ boardId: 0, variant: 0, sharedWith: [1] });
    expect(tbu.records[5]).toMatchObject({ type: 3, slot: undefined, boardId: 0, variant: 4, version: "3.02.04", sharedWith: [7] });
    expect(tbu.records[6]).toMatchObject({ boardId: 1, issue: 3, sharedWith: [6] });
    expect(tbu.records[6].pullName).toBe("zxnext-3-30204.bin");
    expect(tbu.records[0].computedChecksum).toBe(tbu.records[4].computedChecksum);
  });

  it("names a slot 0 image as the maker's pull does", () => {
    const record = parseTbuFile(buildTbu([{ type: 0, board: 2 }])).records[0];
    expect(record.slot).toBe(0);
    expect(record.pullName).toBe("zxnext-4-30303-ab.bin");
  });

  it("reads a file with no cores", () => {
    const tbu = parseTbuFile(buildTbu([]));
    expect(tbu.records).toEqual([]);
    expect(tbu.problems).toEqual([]);
    expect(tbu.indexBytesUsed).toBe(1);
  });
});

describe("TBBLUE.TBU problems", () => {
  it("refuses a file that is not a TBU", () => {
    expect(codes(new Uint8Array(1024))).toEqual(["notTbu"]);
    expect(codes(new Uint8Array(3))).toEqual(["notTbu"]);
    expect(parseTbuFile(new Uint8Array(1024)).format).toBe("unknown");
  });

  it("reports a header cut short", () => {
    expect(codes(buildTbu([{ board: 2 }]).subarray(0, 300))).toEqual(["tooShort"]);
  });

  it("reports a damaged image", () => {
    const data = buildTbu([{ board: 2 }]);
    data[512 + 100] ^= 0x55;
    const tbu = parseTbuFile(data);
    expect(tbu.problems).toEqual([{ code: "checksumMismatch", severity: "error", record: 1 }]);
    expect(tbu.records[0].computedChecksum).not.toBe(tbu.records[0].storedChecksum);
  });

  it("reports an image beyond the end of the file", () => {
    const data = buildTbu([{ board: 2 }, { board: 3 }]);
    const cut = data.subarray(0, data.length - 512);
    expect(codes(cut)).toEqual(["imageOutOfRange"]);
    expect(parseTbuFile(cut).records[1].computedChecksum).toBeUndefined();
  });

  it("reports a file that is not whole sectors, and data after the last image", () => {
    const data = buildTbu([{ board: 2 }]);
    const longer = new Uint8Array(data.length + 100);
    longer.set(data);
    expect(codes(longer)).toEqual(["notSectorAligned", "trailingData"]);
  });

  it("reports images that partly overlap, but not shared ones", () => {
    const data = buildTbu([{ board: 2, sectors: 4 }, { board: 3, sectors: 4 }]);
    // --- Record 2 starts one sector into record 1
    new DataView(data.buffer).setUint32(25 + 15 + 5, 1, true);
    const problems = parseTbuFile(data).problems;
    expect(problems).toContainEqual({ code: "imageOverlap", severity: "error", record: 1, otherRecord: 2 });
  });

  it("reports a duplicate record", () => {
    expect(codes(buildTbu([{ board: 2 }, { board: 2, shareWith: 0 }]))).toEqual(["duplicateRecord"]);
  });

  it("reports an index with no end", () => {
    const data = buildTbu([]);
    for (let i = 0; i < TBU_INDEX_CAPACITY; i++) {
      const r = 25 + i * 15;
      data.set([15, 1, 2, 0x33, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], r);
    }
    data[25 + TBU_INDEX_CAPACITY * 15] = 0;
    const tbu = parseTbuFile(data);
    expect(tbu.records).toHaveLength(TBU_INDEX_CAPACITY);
    expect(tbu.problems.map((p) => p.code)).toContain("indexNotTerminated");
  });

  it("reports a record length it cannot walk, and stops there", () => {
    const data = buildTbu([{ board: 2 }, { board: 3 }]);
    data[25 + 15] = 4;
    const tbu = parseTbuFile(data);
    expect(tbu.records).toHaveLength(1);
    // --- The second image is now in no record: data after the last image
    expect(tbu.problems.map((p) => p.code)).toEqual(["recordLength", "indexNotTerminated", "trailingData"]);
  });

  it("accepts a shared image whose trailer repeats one of its records, not one that repeats none", () => {
    const tbu = parseTbuFile(shaped2611a());
    // --- Records 1 and 5 share an image whose trailer names `$20`, record 1's board byte
    expect(tbu.records[0].trailer!.matchesRecord).toBe(true);
    expect(tbu.records[4].trailer!.matchesRecord).toBe(false);

    const data = buildTbu([{ board: 0x20 }, { board: 0x00, shareWith: 0 }]);
    const flashAt = 512 + 3 * 512 + "ZX SPECTRUM NEXT\0ZXN ISSUE 2 ZX SPECTRUM NEXT\0".length;
    data[flashAt + 2] = 0x10;
    const checksum = fletcher16(data, 0, 512, 512 + 4 * 512);
    new DataView(data.buffer).setUint16(25 + 13, checksum, true);
    new DataView(data.buffer).setUint16(25 + 15 + 13, checksum, true);
    expect(parseTbuFile(data).problems).toEqual([
      { code: "trailerMismatch", severity: "warning", record: 1 },
      { code: "trailerMismatch", severity: "warning", record: 2 }
    ]);
  });

  it("walks a longer record by its length", () => {
    const data = buildTbu([]);
    const r = 25;
    data.set([17, 1, 2, 0x33, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xaa, 0xbb], r);
    data[r + 17] = 0xff;
    const tbu = parseTbuFile(data);
    expect(tbu.records).toHaveLength(1);
    expect(tbu.problems.map((p) => p.code)).toEqual(["recordLength", "imageOutOfRange"]);
  });

  it("reports a trailer that does not repeat its record", () => {
    const data = buildTbu([{ board: 2, sectors: 3 }]);
    const t = 512 + 2 * 512;
    const flashAt = t + "ZX SPECTRUM NEXT\0ZXN ISSUE 4 ZX SPECTRUM NEXT\0".length;
    data[flashAt + 4] = 9;
    // --- Keep the checksum right, so only the trailer is wrong
    new DataView(data.buffer).setUint16(25 + 13, fletcher16(data, 0, 512, 512 + 3 * 512), true);
    expect(codes(data)).toEqual(["trailerMismatch"]);
  });

  it("accepts an image with no trailer", () => {
    const record = parseTbuFile(buildTbu([{ board: 2, trailer: false }])).records[0];
    expect(record.trailer).toBeUndefined();
    expect(record.bitstream!.part).toBe("XC7A15T");
  });

  it("reports a bitstream for another board's FPGA", () => {
    expect(codes(buildTbu([{ board: 2, bitstream: series7(0x0362d093) }]))).toEqual(["partMismatch"]);
  });

  it("reports an image larger than the board's flash slot", () => {
    expect(codes(buildTbu([{ board: 0, sectors: 1025 }]))).toEqual(["tooBigForSlot"]);
  });
});

/** A legacy single-core file as the original maker writes it */
function buildLegacy(image: Uint8Array, hwid = 10, version = 0x20, sub = 26): Uint8Array {
  const file = new Uint8Array(TBU_SECTOR + image.length);
  file.set(Array.from("TBUFILE    ", (c) => c.charCodeAt(0)), 0);
  new DataView(file.buffer).setUint32(7, image.length, true);
  let xor = 0;
  for (const b of image) xor ^= b;
  file[11] = hwid;
  file[12] = version;
  file[13] = xor;
  file.set(Array.from("ZX Spectrum Next\0", (c) => c.charCodeAt(0)), 14);
  file[500] = sub;
  file.set(image, TBU_SECTOR);
  return file;
}

describe("TBBLUE.TBU legacy files", () => {
  it("reads the single-core header", () => {
    const tbu = parseTbuFile(buildLegacy(spartan6(0x04002093, 2048)));
    expect(tbu.format).toBe("legacy");
    expect(tbu.records).toEqual([]);
    expect(tbu.problems).toEqual([]);
    expect(tbu.legacy).toMatchObject({
      hardwareId: 10,
      hardwareName: "ZX Spectrum Next",
      knownHardware: "ZX Spectrum Next",
      version: "2.00.26",
      statedSize: 2048,
      actualSize: 2048
    });
    expect(tbu.legacy!.computedXor).toBe(tbu.legacy!.storedXor);
    expect(tbu.legacy!.bitstream.part).toBe("XC6SLX16");
  });

  it("reports a wrong size, a wrong checksum and another machine", () => {
    const data = buildLegacy(new Uint8Array(1024).fill(7), 9);
    data[600] ^= 1;
    expect(codes(data)).toEqual(["legacyChecksumMismatch", "legacyNotNext"]);
    expect(codes(buildLegacy(new Uint8Array(1024)).subarray(0, 1000))).toEqual([
      "legacySizeMismatch",
      "legacyChecksumMismatch"
    ]);
  });
});

const realFiles = (process.env.TBU_REAL_FILES ?? "").split(delimiter).filter(Boolean);

describe.skipIf(realFiles.length === 0)("real TBBLUE.TBU files (TBU_REAL_FILES)", () => {
  it.each(realFiles)("%s reads without errors", (path) => {
    expect(existsSync(path)).toBe(true);
    const tbu = parseTbuFile(new Uint8Array(readFileSync(path)));
    expect(tbu.format).not.toBe("unknown");
    expect(tbu.problems.filter((p) => p.severity === "error")).toEqual([]);
  });
});
