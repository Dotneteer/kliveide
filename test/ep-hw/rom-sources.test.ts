import { describe, expect, it } from "vitest";
import { KNOWN_ROM_PAGES, type RomSource } from "@common/roms/romIdentity";
import { createEpSession } from "../harness/enterprise";

/*
 * The Enterprise's ROM segments as the ROM annotations find them (`getRomSources`,
 * `.ai/rom-annotations/ep-authoring-guide.md`): each fitted ROM segment its own 16K page, by its segment
 * number, known by its bytes and named by its file and page, so the file's sidecar applies to it.
 */
describe("the Enterprise's ROM sources", () => {
  const sourcesOf = async (model: string, exdos = false) => {
    const s = await createEpSession({ model, exdos });
    return (s.machine as unknown as { getRomSources(): Record<number, RomSource> }).getRomSources();
  };

  for (const [model, exos, basic] of [
    ["ep128", "ep-exos21.rom", "ep-basic21.rom"],
    ["ep64", "ep-exos20.rom", "ep-basic20.rom"]
  ]) {
    it(`names ${model}'s EXOS segments and IS-BASIC by file and page`, async () => {
      const sources = await sourcesOf(model);
      for (const [segment, file, page] of [[0x00, exos, 0], [0x01, exos, 1], [0x04, basic, 0]] as const) {
        expect(sources[segment], file).toMatchObject({ size: 0x4000, page });
        expect(sources[segment].path, file).toBe(`roms/${file}`);
        expect(KNOWN_ROM_PAGES[sources[segment].crc32]?.file, file).toBe(file);
      }
      // --- No EXDOS card: its segments are no pages; nothing negative is reported
      expect(sources[0x20]).toBeUndefined();
      expect(Object.keys(sources).some((key) => Number(key) < 0)).toBe(false);
    });
  }

  it("names the EXDOS card's two segments when it is fitted", async () => {
    const sources = await sourcesOf("ep128", true);
    expect(sources[0x20]).toMatchObject({ path: "roms/ep-exdos13.rom", page: 0 });
    expect(sources[0x21]).toMatchObject({ path: "roms/ep-exdos13.rom", page: 1 });
  });
});
