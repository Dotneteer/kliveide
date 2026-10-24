import { describe, expect, it } from "vitest";

import {
  createBlankMdr,
  createFormattedMdr,
  eraseMdrFile,
  MDR_FULL_SIZE,
  MDR_SLOT_SIZE,
  mdrChecksum,
  MdrImageError,
  mdrShape,
  QL_MDV_SIZE,
  readMdrCatalog,
  readMdrFile,
  readMdrSector,
  renameMdrFile,
  setMdrLabel,
  withMdrWriteProtect,
  writeMdrFile
} from "@emu/machines/microdrive/mdrImage";

/*
 * The .mdr image (`.plans/MICRODRIVE_PLAN.md` Phase 3.1). The worked example is
 * `_input/microdrive/mdr-and-file-formats.md` §8.
 */

const bytesOf = (text: string) => [...text].map((c) => c.charCodeAt(0));

describe("mdr checksums: the worked example", () => {
  it("a header for TEST, sector 254: HDCHK $02", () => {
    expect(mdrChecksum([0x01, 0xfe, 0x00, 0x00, ...bytesOf("TEST      ")])).toBe(0x02);
  });

  it("a one-record program x of 29 bytes: DESCHK $BC (EOF), $BA (not the last)", () => {
    expect(mdrChecksum([0x06, 0x00, 0x1d, 0x00, ...bytesOf("x         ")])).toBe(0xbc);
    expect(mdrChecksum([0x04, 0x00, 0x1d, 0x00, ...bytesOf("x         ")])).toBe(0xba);
  });

  it("a free sector's descriptor with a blank name: DESCHK $41 (the formats note's $21 is wrong: 10 x $20 = 320)", () => {
    expect(mdrChecksum([0x00, 0x00, 0x00, 0x00, ...bytesOf("          ")])).toBe(0x41);
  });

  it("$FF never results", () => {
    expect(mdrChecksum([0xfe, 0x01])).toBe(0x00);
    expect(mdrChecksum([0xff])).toBe(0x00);
  });
});

describe("mdr image shape", () => {
  it("takes n x 543 with or without the write-protect byte", () => {
    expect(mdrShape(new Uint8Array(MDR_FULL_SIZE))).toEqual({ slots: 254, hasWriteProtectByte: true, writeProtected: false });
    const protectedImage = new Uint8Array(MDR_FULL_SIZE);
    protectedImage[MDR_FULL_SIZE - 1] = 1;
    expect(mdrShape(protectedImage).writeProtected).toBe(true);
    expect(mdrShape(new Uint8Array(180 * MDR_SLOT_SIZE))).toEqual({ slots: 180, hasWriteProtectByte: false, writeProtected: false });
  });

  it("refuses a QL .mdv and odd lengths", () => {
    expect(() => mdrShape(new Uint8Array(QL_MDV_SIZE))).toThrow(MdrImageError);
    expect(() => mdrShape(new Uint8Array(QL_MDV_SIZE))).toThrow(/QL/);
    expect(() => mdrShape(new Uint8Array(1000))).toThrow(/543/);
    expect(() => mdrShape(new Uint8Array(255 * MDR_SLOT_SIZE))).toThrow(MdrImageError);
  });

  it("sets or adds the write-protect byte", () => {
    const bare = createFormattedMdr("T").subarray(0, 254 * MDR_SLOT_SIZE);
    const out = withMdrWriteProtect(bare, true);
    expect(out.length).toBe(MDR_FULL_SIZE);
    expect(out[MDR_FULL_SIZE - 1]).toBe(1);
  });
});

describe("blank and formatted cartridges", () => {
  it("a blank one has no valid block", () => {
    const blank = createBlankMdr(100);
    expect(blank.length).toBe(100 * MDR_SLOT_SIZE + 1);
    expect(readMdrCatalog(blank)).toMatchObject({ slots: 100, formatted: 0, free: 0, files: [] });
  });

  it("a formatted one numbers its slots 254 down, every sector free", () => {
    const mdr = createFormattedMdr("TEST");
    expect(readMdrSector(mdr, 0)).toMatchObject({ number: 254, state: "free", label: "TEST" });
    expect(readMdrSector(mdr, 253)).toMatchObject({ number: 1, state: "free" });
    expect(readMdrCatalog(mdr)).toMatchObject({ label: "TEST", formatted: 254, free: 254, bad: 0, freeK: 127 });
  });

  it("a renamed cartridge carries its new name in every header", () => {
    const mdr = createFormattedMdr("OLD");
    setMdrLabel(mdr, "NEWNAME");
    expect(readMdrCatalog(mdr).label).toBe("NEWNAME");
    expect(readMdrSector(mdr, 100).label).toBe("NEWNAME");
  });
});

describe("files on a cartridge", () => {
  it("a SAVEd program: its 9-byte header in record 0, EOF and SAVE flags", () => {
    const mdr = createFormattedMdr("TEST");
    const program = new Uint8Array(20).fill(0x41);
    const slots = writeMdrFile(mdr, { name: "x", data: program, header: { type: 0, start: 23813, programLength: 20, autorun: 10 } });
    expect(slots).toEqual([0]);
    expect(readMdrSector(mdr, 0).record).toMatchObject({ flag: 0x06, recordNumber: 0, length: 29, name: "x", eof: true, saved: true, dataValid: true });
    const catalog = readMdrCatalog(mdr);
    expect(catalog.free).toBe(253);
    expect(catalog.files).toEqual([
      { name: "x", saved: true, header: { type: 0, length: 20, start: 23813, programLength: 20, autorun: 10 }, size: 20, slots: [0], complete: true }
    ]);
    expect(readMdrFile(mdr, catalog.files[0])).toEqual(program);
  });

  it("a file over several records: 503 bytes in the first, then 512 each, in record order", () => {
    const mdr = createFormattedMdr("TEST");
    const data = Uint8Array.from({ length: 6912 }, (_, i) => i & 0xff);
    const slots = writeMdrFile(mdr, { name: "scr", data, header: { type: 3, start: 16384, programLength: 0xffff, autorun: 0xffff } });
    // --- 6912 + 9 bytes: 14 records
    expect(slots.length).toBe(14);
    const file = readMdrCatalog(mdr).files[0];
    expect(file).toMatchObject({ name: "scr", size: 6912, complete: true });
    expect(readMdrFile(mdr, file)).toEqual(data);
    expect(readMdrSector(mdr, slots[13]).record).toMatchObject({ eof: true, recordNumber: 13, length: 6921 - 13 * 512 });
  });

  it("a PRINT-type file has no header", () => {
    const mdr = createFormattedMdr("TEST");
    writeMdrFile(mdr, { name: "data", data: Uint8Array.from(bytesOf("hello\r")) });
    const file = readMdrCatalog(mdr).files[0];
    expect(file).toMatchObject({ saved: false, size: 6 });
    expect(file.header).toBeUndefined();
    expect(readMdrSector(mdr, 0).record!.flag).toBe(0x02);
  });

  it("files list in name order; a missing record makes one incomplete", () => {
    const mdr = createFormattedMdr("TEST");
    writeMdrFile(mdr, { name: "zz", data: new Uint8Array(10) });
    writeMdrFile(mdr, { name: "aa", data: new Uint8Array(1200) });
    const catalog = readMdrCatalog(mdr);
    expect(catalog.files.map((f) => f.name)).toEqual(["aa", "zz"]);
    // --- Lose the middle record of "aa"
    const middle = catalog.files[0].slots[1];
    mdr[middle * MDR_SLOT_SIZE + 15 + 14] ^= 0xff;
    expect(readMdrCatalog(mdr).files[0].complete).toBe(false);
  });

  it("FORMAT's bad sectors (EOF, a CHR$ 0 name) count as bad and list as nothing", () => {
    const mdr = createFormattedMdr("TEST");
    writeMdrFile(mdr, { name: "\u0000", data: new Uint8Array(512).fill(0xfc) });
    const catalog = readMdrCatalog(mdr);
    expect(catalog.bad).toBe(1);
    expect(catalog.files).toEqual([]);
  });

  it("erase frees the sectors; rename renames every record", () => {
    const mdr = createFormattedMdr("TEST");
    writeMdrFile(mdr, { name: "big", data: new Uint8Array(2000) });
    renameMdrFile(mdr, readMdrCatalog(mdr).files[0], "huge");
    expect(readMdrCatalog(mdr).files.map((f) => f.name)).toEqual(["huge"]);
    expect(readMdrCatalog(mdr).files[0].complete).toBe(true);
    eraseMdrFile(mdr, readMdrCatalog(mdr).files[0]);
    expect(readMdrCatalog(mdr)).toMatchObject({ free: 254, files: [] });
  });

  it("refuses a file larger than the free sectors", () => {
    const mdr = createFormattedMdr("TEST", 3);
    expect(() => writeMdrFile(mdr, { name: "big", data: new Uint8Array(2000) })).toThrow(MdrImageError);
  });

  it("slots are read in tape order: the sector number comes from the header", () => {
    const mdr = createFormattedMdr("TEST");
    // --- Rotate the tape by 10 slots: slot 0 now holds sector 244
    const rotated = new Uint8Array(mdr.length);
    rotated.set(mdr.subarray(10 * MDR_SLOT_SIZE, 254 * MDR_SLOT_SIZE), 0);
    rotated.set(mdr.subarray(0, 10 * MDR_SLOT_SIZE), 244 * MDR_SLOT_SIZE);
    expect(readMdrSector(rotated, 0).number).toBe(244);
    expect(readMdrCatalog(rotated).free).toBe(254);
  });
});
