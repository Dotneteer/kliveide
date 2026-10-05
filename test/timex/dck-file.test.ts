import { describe, expect, it } from "vitest";

import { DCK_BANK_DOCK, DCK_BANK_EXROM, dockBankOf, parseDckFile, writeDckFile } from "@common/timex/dckFile";

/* `.dck` cartridge images (`.plans/TIMEX_SCORPION_PLAN.md` G9.4b) */
describe(".dck files", () => {
  it("reads a header and the images of the chunks that carry one", () => {
    const bytes = new Uint8Array(9 + 2 * 0x2000);
    bytes.set([DCK_BANK_DOCK, 0x02, 0x00, 0x01, 0x03, 0, 0, 0, 0]);
    bytes.fill(0xaa, 9, 9 + 0x2000);
    bytes.fill(0xbb, 9 + 0x2000);
    const image = parseDckFile(bytes);
    const dock = dockBankOf(image)!;
    expect(dock.chunkTypes).toEqual([2, 0, 1, 3, 0, 0, 0, 0]);
    expect(dock.chunks[0]![0]).toBe(0xaa);
    expect(dock.chunks[1]).toBeUndefined();
    expect(dock.chunks[2]).toBeUndefined(); // --- RAM without an image
    expect(dock.chunks[3]![0x1fff]).toBe(0xbb);
  });

  it("reads several banks, and writes what it reads", () => {
    const original = {
      banks: [
        { bank: DCK_BANK_DOCK, chunkTypes: [2, 0, 0, 0, 0, 0, 0, 1], chunks: [new Uint8Array(0x2000).fill(1)] },
        { bank: DCK_BANK_EXROM, chunkTypes: [3, 0, 0, 0, 0, 0, 0, 0], chunks: [new Uint8Array(0x2000).fill(2)] }
      ]
    };
    const bytes = writeDckFile(original);
    expect(bytes.length).toBe(2 * (9 + 0x2000));
    const back = parseDckFile(bytes);
    expect(back.banks.map((b) => b.bank)).toEqual([DCK_BANK_DOCK, DCK_BANK_EXROM]);
    expect(back.banks[0].chunkTypes).toEqual([2, 0, 0, 0, 0, 0, 0, 1]);
    expect(back.banks[1].chunks[0]![5]).toBe(2);
  });

  it("refuses a truncated header or image, and an empty file", () => {
    expect(() => parseDckFile(new Uint8Array([0, 2, 0]))).toThrow(/header/);
    expect(() => parseDckFile(new Uint8Array([0, 2, 0, 0, 0, 0, 0, 0, 0, 1, 2]))).toThrow(/chunk 0/);
    expect(() => parseDckFile(new Uint8Array(0))).toThrow(/no bank/);
  });
});
