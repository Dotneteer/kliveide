import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { romDecoderFor } from "@renderer/appIde/annotations/romDecoder";
import { partitionSite } from "@renderer/appIde/annotations/liveAnnotatedDisassembly";
import { KNOWN_ROM_PAGES, knownRomPageKind, romKindIsSam, romKindOrigin, romPageIdentity } from "@common/roms/romIdentity";
import { SAM_ROM0_PARTITION, SAM_ROM1_PARTITION, samBankSpace } from "@common/annotations/bankSpace";
import { SAM_ROM_IMAGES } from "@emu/machines/samcoupe/SamRoms";

/*
 * The SAM Coupé's ROMs as the ROM annotation tools read them (`dev/ai/rom-annotations/sam-authoring-guide.md`):
 * each 32K file is two 16K pages, ROM0 decoded at $0000 and ROM1 at $C000, where the machine maps them; the
 * bank space lists the same partitions at the same addresses.
 */

const ROMS = join(__dirname, "../../src/public/roms");
const page = (name: string, n: number) =>
  new Uint8Array(readFileSync(join(ROMS, name))).subarray(n * 0x4000, (n + 1) * 0x4000);

describe("the SAM Coupé ROM pages", () => {
  it("are known by their bytes, each with its kind and run address", () => {
    for (const image of Object.values(SAM_ROM_IMAGES)) {
      const file = `${image.name}.rom`;
      for (const [n, kind, origin] of [
        [0, "sam-rom0", 0x0000],
        [1, "sam-rom1", 0xc000]
      ] as const) {
        const identity = romPageIdentity(page(file, n));
        expect(knownRomPageKind(identity), `${file}:${n}`).toBe(kind);
        expect(romKindIsSam(kind)).toBe(true);
        expect(KNOWN_ROM_PAGES[identity.crc32].file, `${file}:${n}`).toBe(file);
        expect(KNOWN_ROM_PAGES[identity.crc32].page, `${file}:${n}`).toBe(n);
        expect(romKindOrigin(kind), `${file}:${n}`).toBe(origin);
      }
    }
  });

  it("are four distinct pages: 3.1 differs from 3.0 in each", () => {
    const crcs = ["sam-rom30.rom", "sam-rom31.rom"].flatMap((file) => [0, 1].map((n) => romPageIdentity(page(file, n)).crc32));
    expect(new Set(crcs).size).toBe(4);
  });

  it("decodes ROM1 at $C000 and counts its targets from there", async () => {
    const bytes = page("sam-rom30.rom", 1);
    // --- Offset 9: CALL $3B4B, which is below $C000: ROM0's, not the page's own
    expect(Array.from(bytes.subarray(9, 12))).toEqual([0xcd, 0x4b, 0x3b]);
    const decoded = await romDecoderFor("sam-rom1")(bytes, 0, 0x10);
    expect(decoded.find((i) => i.offset === 9)?.target).toBeUndefined();
  });

  it("decodes ROM0 at $0000", async () => {
    const bytes = page("sam-rom30.rom", 0);
    // --- Offset 1: JP $00B0
    expect(Array.from(bytes.subarray(1, 4))).toEqual([0xc3, 0xb0, 0x00]);
    const decoded = await romDecoderFor("sam-rom0")(bytes, 0, 4);
    expect(decoded.find((i) => i.offset === 1)?.target).toBe(0xb0);
  });

  it("decodes the word after ROM0's RST 30h as data: the jump table at $0100", async () => {
    const bytes = page("sam-rom30.rom", 0);
    // --- $0100: RST 30h / $5256 (a jump to ROM1's $D256), then JP $025E at $0103
    expect(Array.from(bytes.subarray(0x100, 0x106))).toEqual([0xf7, 0x56, 0x52, 0xc3, 0x5e, 0x02]);
    const decoded = await romDecoderFor("sam-rom0")(bytes, 0x100, 0x105);
    expect(decoded.map((i) => [i.offset, i.length])).toEqual([
      [0x100, 1],
      [0x101, 2],
      [0x103, 3]
    ]);
  });

  it("decodes ROM1's calculator streams as data, and its RST 30h as a plain restart", async () => {
    const bytes = page("sam-rom30.rom", 1);
    // --- $09C1: RST 28h / $27 and a 5-byte number / $00 ... ending in $33 or $34
    expect(Array.from(bytes.subarray(0x9c1, 0x9c3))).toEqual([0xef, 0x27]);
    const decoded = await romDecoderFor("sam-rom1")(bytes, 0x9c1, 0x9c9);
    expect(decoded.slice(0, 3).map((i) => [i.offset, i.length])).toEqual([
      [0x9c1, 1],
      [0x9c2, 6],
      [0x9c8, 1]
    ]);
    const rst30 = new Uint8Array(0x4000);
    rst30.set([0xf7, 0x00]);
    expect((await romDecoderFor("sam-rom1")(rst30, 0, 1)).map((i) => i.length)).toEqual([1, 1]);
  });

  it("match the bank space's ROM partitions and bases", () => {
    const space = samBankSpace(32);
    expect(space.romBase?.(SAM_ROM0_PARTITION)).toBe(romKindOrigin("sam-rom0"));
    expect(space.romBase?.(SAM_ROM1_PARTITION)).toBe(romKindOrigin("sam-rom1"));
    expect(partitionSite(SAM_ROM1_PARTITION, space)).toEqual({ kind: "rom", partition: SAM_ROM1_PARTITION, offset: 0 });
  });
});
