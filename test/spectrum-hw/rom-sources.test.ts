import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { KNOWN_ROM_PAGES, isBasic48RomPage, romCrc32, type RomSource } from "@common/roms/romIdentity";
import { createSp48Session } from "../harness/sp48";
import { createSp128Session } from "../harness/sp128/session";
import { createTimexSession } from "../harness/timex/session";

/*
 * Where each ROM partition came from (`getRomSources`,
 * `.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §5.3), on the real cores: the identity the ROM
 * annotations are found by, and the file and page the user's own annotations of it go beside.
 */

const ROMS = join(__dirname, "../../src/public/roms");
const rom = (name: string) => new Uint8Array(readFileSync(join(ROMS, name)));
const sourcesOf = (machine: unknown) =>
  (machine as { getRomSources(withBytes?: boolean): Record<number, RomSource> }).getRomSources();

describe("getRomSources", () => {
  it("the 48K reports its one ROM as partition -1 (T2)", async () => {
    const s = await createSp48Session();
    expect(sourcesOf(s.machine)).toEqual({
      [-1]: { crc32: "ddee531f", size: 0x4000, path: "roms/sp48.rom", page: 0 }
    });
  });

  it("the 128K reports the editor ROM and the 48K BASIC ROM", async () => {
    const s = await createSp128Session("sp128");
    const sources = sourcesOf(s.machine);
    expect(sources[-1]).toMatchObject({ crc32: "e76799d2", path: "roms/sp128-0.rom" });
    expect(sources[-2]).toMatchObject({ crc32: "b96a36be", path: "roms/sp128-1.rom" });
    expect(isBasic48RomPage("sp128", -2, sources[-2])).toBe(true);
    expect(isBasic48RomPage("sp128", -1, sources[-1])).toBe(false);
  });

  it.each(["nofdd", "plus3-fdd1", "plus3-v40-fdd1", "plus3-es-fdd1"] as const)(
    "the +3 model %s reports four known pages, ROM 3 the 48K BASIC",
    async (model) => {
      const s = await createSp128Session(model);
      const sources = sourcesOf(s.machine);
      expect(Object.keys(sources).map(Number).sort((a, b) => a - b)).toEqual([-4, -3, -2, -1]);
      for (const partition of [-1, -2, -3, -4]) {
        expect(KNOWN_ROM_PAGES[sources[partition].crc32], `partition ${partition}`).toBeDefined();
      }
      expect(KNOWN_ROM_PAGES[sources[-4].crc32].kind).toBe("sp48-basic");
    }
  );

  it("the Scorpion names the pages of its split 64K file by file and page", async () => {
    const image = new Uint8Array(0x10000);
    image.set(rom("sp128-0.rom"), 0);
    image.set(rom("sp128-1.rom"), 0x4000);
    for (let i = 0x8000; i < 0x10000; i++) image[i] = (i * 13) & 0xff;
    const s = await createSp128Session("scorpion", { scorpionRom: image });
    const sources = sourcesOf(s.machine);
    expect(sources[-1]).toMatchObject({ crc32: "e76799d2", path: "<harness-scorpion>", page: 0 });
    expect(sources[-2]).toMatchObject({ crc32: "b96a36be", path: "<harness-scorpion>", page: 1 });
    expect(sources[-3]).toMatchObject({
      crc32: romCrc32(image.subarray(0x8000, 0xc000)),
      path: "<harness-scorpion>",
      page: 2
    });
  });

  it("the Timex reports its HOME ROM as one 16K page: the 48K fallback, or the user's ROM", async () => {
    const fallback = sourcesOf((await createTimexSession()).machine);
    expect(Object.keys(fallback)).toEqual(["-1"]);
    expect(fallback[-1]).toMatchObject({ crc32: "ddee531f", size: 0x4000, path: "roms/sp48.rom" });

    const custom = rom("sp48.rom");
    custom[0x1234] ^= 0xff;
    const own = sourcesOf((await createTimexSession({ rom: { bytes: custom } })).machine);
    expect(own[-1]).toMatchObject({ crc32: romCrc32(custom), path: "test-rom", page: 0 });
    expect(KNOWN_ROM_PAGES[own[-1].crc32]).toBeUndefined();
  });
});
