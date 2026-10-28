import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { romDecoderFor } from "@renderer/appIde/annotations/romDecoder";
import { KNOWN_ROM_PAGES, knownRomPageKind, romKindOrigin, romPageIdentity } from "@common/roms/romIdentity";
import { TVC_ROM_PAGE_SYS_HIGH, tvcBankSpace } from "@common/annotations/bankSpace";

/*
 * The Videoton TVC's BASIC ROM chips as the ROM annotation tools read them
 * (`.ai/rom-annotations/tvc-authoring-guide.md`): known by their bytes, each decoded where BASIC runs it,
 * with the function code after `RST $30` as data; and the bank space naming each 8K chip its own ROM page.
 */

const ROMS = join(__dirname, "../../src/public/roms");
const rom = (name: string) => new Uint8Array(readFileSync(join(ROMS, name)));

describe("the TVC ROM chips", () => {
  it("are known by their bytes, each with its kind and run address", () => {
    const expected: [string, string, number][] = [
      ["tvc12-d4.rom", "tvc-sys-low", 0xc000],
      ["tvc12-d3.rom", "tvc-sys-high", 0xe000],
      ["tvc12-d7.rom", "tvc-exth", 0xe000],
      ["tvc22-d6.rom", "tvc-sys-low", 0xc000],
      ["tvc22-d4.rom", "tvc-sys-high", 0xe000],
      ["tvc22-d7.rom", "tvc-exth", 0xe000]
    ];
    for (const [name, kind, origin] of expected) {
      const identity = romPageIdentity(rom(name));
      expect(knownRomPageKind(identity), name).toBe(kind);
      expect(KNOWN_ROM_PAGES[identity.crc32].file, name).toBe(name);
      expect(romKindOrigin(knownRomPageKind(identity)), name).toBe(origin);
    }
    // --- VT-DOS has no kind yet: its four 4K pages all run at $C000
    expect(knownRomPageKind(romPageIdentity(rom("tvc-vtdos.rom")))).toBeUndefined();
  });

  it("decodes the low SYS chip at $C000 and counts its targets from there", async () => {
    const bytes = rom("tvc12-d4.rom");
    // --- Offset 0: JP $0229, the reset entry, at a $0000-based address; $1FF6: JP NC,$DB81, its own $1B81
    expect(Array.from(bytes.subarray(0, 3))).toEqual([0xc3, 0x29, 0x02]);
    expect(Array.from(bytes.subarray(0x1ff6, 0x1ff9))).toEqual([0xd2, 0x81, 0xdb]);
    const decoded = await romDecoderFor("tvc-sys-low")(bytes, 0, 0x1fff);
    expect(decoded.find((i) => i.offset === 0)?.target).toBeUndefined();
    expect(decoded.find((i) => i.offset === 0x1ff6)?.target).toBe(0x1b81);
  });

  it("decodes the byte after RST $30 as data", async () => {
    const bytes = rom("tvc12-d4.rom");
    // --- $1099: RST $30 / $91. Read as code, the $91 would be SUB C
    expect(Array.from(bytes.subarray(0x1099, 0x109b))).toEqual([0xf7, 0x91]);
    const decoded = await romDecoderFor("tvc-sys-low")(bytes, 0x1099, 0x10a0);
    expect(decoded.find((i) => i.offset === 0x1099)?.length).toBe(1);
    expect(decoded.find((i) => i.offset === 0x109a)).toBeDefined();
    expect(decoded.find((i) => i.offset === 0x109b)).toBeDefined();
  });
});

describe("the TVC bank space's ROM pages", () => {
  // --- Each 8K slot's partition: SYS in page 0 (after a reset) or page 3 (BASIC), EXT in page 3
  const SYS = -1;
  const EXT = -3;
  const reset = [SYS, SYS, 1, 1, 4, 4, -2, -2];
  const basic = [0, 0, 1, 1, 4, 4, SYS, SYS];
  const ext = [0, 0, 1, 1, 4, 4, EXT, EXT];
  const space = tvcBankSpace(false);

  it("names SYS's halves as two chips, whichever page shows SYS", () => {
    expect(space.siteAt(0xc229, basic)).toEqual({ kind: "rom", partition: -1, offset: 0x229 });
    expect(space.siteAt(0x0229, reset)).toEqual({ kind: "rom", partition: -1, offset: 0x229 });
    expect(space.siteAt(0xe010, basic)).toEqual({ kind: "rom", partition: TVC_ROM_PAGE_SYS_HIGH, offset: 0x10 });
    expect(space.siteAt(0x2010, reset)).toEqual({ kind: "rom", partition: TVC_ROM_PAGE_SYS_HIGH, offset: 0x10 });
  });

  it("names EXTH, and not the card window below it", () => {
    expect(space.siteAt(0xe123, ext)).toEqual({ kind: "rom", partition: EXT, offset: 0x123 });
    expect(space.siteAt(0xc123, ext)).toBeUndefined();
  });

  it("keeps CART a whole partition and RAM a bank", () => {
    expect(space.siteAt(0xc123, reset)).toEqual({ kind: "rom", partition: -2, offset: 0x0123 });
    expect(space.siteAt(0x4567, basic)).toEqual({ kind: "bank", bank: 1, offset: 0x0567 });
  });

  it("lists each chip from where BASIC runs it", () => {
    expect(space.romBase?.(-1)).toBe(0xc000);
    expect(space.romBase?.(TVC_ROM_PAGE_SYS_HIGH)).toBe(0xe000);
    expect(space.romBase?.(-3)).toBe(0xe000);
    expect(space.romBase?.(-2)).toBeUndefined();
  });
});
