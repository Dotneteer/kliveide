import { describe, expect, it } from "vitest";

import { KNOWN_ROM_PAGES, type RomSource } from "@common/roms/romIdentity";
import { createZ88Session } from "../harness/z88";

/*
 * The Z88's ROM pages as the ROM annotations find them (`getRomSources`,
 * `dev/plans/Z88_OZ47_ROM_ANNOTATIONS_PLAN.md`, Phase 1): every bank of the slot 0 card under its own
 * bank number (the `z88` bank space's ROM partitions), named by its file and page, so the file's
 * sidecar applies to it.
 */
describe("the Z88's ROM sources", () => {
  const sourcesOf = async (model: string) => {
    const s = await createZ88Session({ model, rom: "model" });
    return (s.machine as unknown as { getRomSources(): Record<number, RomSource> }).getRomSources();
  };

  it("names OZ 4.7's 32 banks by file and page", async () => {
    const sources = await sourcesOf("OZ47");
    expect(Object.keys(sources).map(Number)).toEqual(Array.from({ length: 32 }, (_, bank) => bank));
    for (const bank of [0x00, 0x01, 0x0a, 0x1f]) {
      expect(sources[bank], `bank ${bank}`).toMatchObject({ size: 0x4000, page: bank });
      expect(sources[bank].path, `bank ${bank}`).toBe("roms/z88v47.rom");
      expect(KNOWN_ROM_PAGES[sources[bank].crc32]?.page, `bank ${bank}`).toBe(bank);
    }
    // --- Nothing negative: the Z88's ROM partitions are its bank numbers
    expect(Object.keys(sources).some((key) => Number(key) < 0)).toBe(false);
  });

  it("reports a 128K ROM's eight banks, not its mirrors", async () => {
    const sources = await sourcesOf("OZ40");
    expect(Object.keys(sources).map(Number)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(sources[0].path).toBe("roms/z88ukv40.rom");
  });
});
