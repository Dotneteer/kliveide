import { describe, expect, it } from "vitest";

import {
  bankedSegments,
  extractBankedProgram,
  fnv1a32,
  programBankIds,
  segmentOfPartition
} from "@main/boriel-integration/boriel-banked";

/*
 * Finding a banked Boriel BASIC program in the 16K banks of zxbc's snapshot or `.nex`
 * (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §7): the resident part from the origin to $C000, then
 * each listed bank, with the `.dbg`'s length and checksum deciding how long each part is.
 */

const bank = (fill: [number, number[]][]) => {
  const bytes = new Uint8Array(0x4000);
  for (const [offset, data] of fill) bytes.set(data, offset);
  return bytes;
};
const checksumOf = (...parts: number[][]) => fnv1a32(new Uint8Array(parts.flat()));

describe("extractBankedProgram", () => {
  const resident = [0xf3, 0x21, 0x00, 0xc9];
  const b0 = [1, 2, 3];
  const b1 = [7, 8];
  const ram = new Map([
    [2, bank([[0, resident]])],
    [0, bank([[0, b0]])],
    [1, bank([[0, b1]])],
    [3, bank([])]
  ]);

  it("takes the resident part and each non-empty listed bank, in checksum order", () => {
    const parts = extractBankedProgram(ram, 0x8000, [0, 1, 3], 9, checksumOf(resident, b0, b1));
    expect(typeof parts).not.toBe("string");
    expect(parts).toEqual([
      { startAddress: 0x8000, bytes: new Uint8Array(resident) },
      { bank: 0, startAddress: 0xc000, bytes: new Uint8Array(b0) },
      { bank: 1, startAddress: 0xc000, bytes: new Uint8Array(b1) }
    ]);
  });

  it("puts back trailing zeros that were the program's", () => {
    const parts = extractBankedProgram(ram, 0x8000, [0, 1], 11, checksumOf(resident, [...b0, 0, 0], b1));
    expect(typeof parts === "string" ? parts : parts.map((p) => p.bytes.length)).toEqual([4, 5, 2]);
  });

  it("reads a resident part that starts in bank 5", () => {
    const low = new Map([...ram, [5, bank([[0x3ffe, [0xaa, 0xbb]]])]]);
    const parts = extractBankedProgram(low, 0x7ffe, [0, 1], 11, checksumOf([0xaa, 0xbb], resident, b0, b1));
    expect(typeof parts === "string" ? parts : Array.from(parts[0].bytes)).toEqual([0xaa, 0xbb, ...resident]);
  });

  it("refuses data that does not match the debug file", () => {
    expect(extractBankedProgram(ram, 0x8000, [0, 1], 9, 12345)).toMatch(/checksum mismatch/);
    expect(extractBankedProgram(ram, 0x8000, [0, 1], 3, 0)).toMatch(/more than the debug file/);
    expect(extractBankedProgram(ram, 0xc000, [0, 1], 9, 0)).toMatch(/not below the paging window/);
  });
});

describe("banked segments", () => {
  it("names the 16K banks of codebank ids: the bank on the 128K, the first 8K page on the Next", () => {
    expect(programBankIds({ banks: [{ id: 3 }, { id: 0 }, { id: 1 }] }, "zx128k")).toEqual([0, 1, 3]);
    expect(programBankIds({ banks: [{ id: 34 }, { id: 32 }] }, "zxnext")).toEqual([16, 17]);
    expect(programBankIds(undefined, "zx128k")).toEqual([]);
  });

  it("makes segments and finds a partition's segment", () => {
    const segments = bankedSegments([
      { startAddress: 0x8000, bytes: new Uint8Array([1]) },
      { bank: 16, startAddress: 0xc000, bytes: new Uint8Array([2]) },
      { bank: 17, startAddress: 0xc000, bytes: new Uint8Array([3]) }
    ]);
    expect(segments).toEqual([
      { startAddress: 0x8000, emittedCode: [1] },
      { startAddress: 0xc000, emittedCode: [2], bank: 16, bankOffset: 0 },
      { startAddress: 0xc000, emittedCode: [3], bank: 17, bankOffset: 0 }
    ]);
    // --- Next pages 34 and 35 are bank 17; a resident line has no partition
    expect(segmentOfPartition(segments, 35, "zxnext")).toBe(2);
    expect(segmentOfPartition(segments, undefined, "zxnext")).toBe(0);
    expect(segmentOfPartition([{ startAddress: 0x8000, emittedCode: [] }, { startAddress: 0xc000, emittedCode: [], bank: 1 }] as any, 1, "zx128k")).toBe(1);
  });
});
