import { describe, expect, it } from "vitest";
import { KNOWN_ROM_PAGES, type RomSource } from "@common/roms/romIdentity";
import { TVC_ROM_PAGE_SYS_HIGH } from "@common/annotations/bankSpace";
import { createTvcSession } from "../harness/tvc";

/*
 * The TVC's ROM chips as the ROM annotations find them (`getRomSources`,
 * `.ai/rom-annotations/tvc-authoring-guide.md`): SYS's two halves and EXTH, each its own 8K page known by
 * its bytes and named by its file, so the file's sidecar applies to it. CART stays a whole partition.
 */
describe("the TVC's ROM sources", () => {
  const sourcesOf = async (model: string) => {
    const s = await createTvcSession({ model });
    return (s.machine as unknown as { getRomSources(): Record<number, RomSource> }).getRomSources();
  };

  for (const [model, low, high, exth] of [
    ["tvc64", "tvc12-d4.rom", "tvc12-d3.rom", "tvc12-d7.rom"],
    ["tvc64p", "tvc22-d6.rom", "tvc22-d4.rom", "tvc22-d7.rom"]
  ]) {
    it(`names ${model}'s SYS halves and EXTH by file`, async () => {
      const sources = await sourcesOf(model);
      for (const [partition, file] of [[-1, low], [TVC_ROM_PAGE_SYS_HIGH, high], [-3, exth]] as const) {
        expect(sources[partition], file).toMatchObject({ size: 0x2000, page: 0 });
        expect(sources[partition].path, file).toMatch(new RegExp(`${file.replace(".", "\\.")}$`));
        expect(KNOWN_ROM_PAGES[sources[partition].crc32]?.file, file).toBe(file);
      }
      expect(sources[-2]).toMatchObject({ size: 0x4000 });
    });
  }
});
