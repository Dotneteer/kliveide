import { describe, expect, it } from "vitest";
import { KNOWN_ROM_PAGES, type RomSource } from "@common/roms/romIdentity";
import { createSession } from "../../harness/zxnext";

/*
 * The Next's ROM pages as the ROM annotations find them (`getRomSources`): NextZXOS's R0-R3, the
 * alternate ROM's X0/X1 and the DivMMC ROM, each known by its bytes with the file and page it came
 * from, so a sidecar `<file>.dis` (a working copy in `~/Klive/RomAnnotations`) applies to it. The
 * DivMMC RAM pages are not ROM.
 */
describe("the Next's ROM sources", () => {
  it("names R0-R3, X0, X1 and the DivMMC ROM by file and page", async () => {
    const s = await createSession();
    const sources = (s.machine as unknown as { getRomSources(): Record<number, RomSource> }).getRomSources();
    expect(Object.keys(sources).map(Number).sort((a, b) => b - a)).toEqual([-1, -2, -3, -4, -5, -6, -7]);
    for (const [partition, page] of [[-1, 0], [-2, 1], [-3, 2], [-4, 3]]) {
      expect(sources[partition], `R${page}`).toMatchObject({ page });
      expect(sources[partition].path).toMatch(/enNextZX\.rom$/);
      expect(KNOWN_ROM_PAGES[sources[partition].crc32]).toBeDefined();
    }
    expect(KNOWN_ROM_PAGES[sources[-4].crc32].kind).toBe("next-basic");
    expect(sources[-5].path).toMatch(/enAltZX\.rom$/);
    expect(sources[-7]).toMatchObject({ size: 0x2000 });
    expect(sources[-7].path).toMatch(/enNxtmmc\.rom$/);
  });
});
