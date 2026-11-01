import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { romDecoderFor } from "@renderer/appIde/annotations/romDecoder";
import { partitionSite } from "@renderer/appIde/annotations/liveAnnotatedDisassembly";
import { KNOWN_ROM_PAGES, knownRomPageKind, romKindOrigin, romPageIdentity } from "@common/roms/romIdentity";
import { epBankSpace, isRomPartitionOf, sp128BankSpace } from "@common/annotations/bankSpace";

/*
 * The Enterprise's ROMs as the ROM annotation tools read them (`.ai/rom-annotations/ep-authoring-guide.md`):
 * every 16K page known by its bytes and decoded at $C000, where EXOS runs it, with the function code after
 * `RST 30h` as data; and the bank space telling its ROM segments (positive partitions) from its RAM.
 */

const ROMS = join(__dirname, "../../src/public/roms");
const rom = (name: string) => new Uint8Array(readFileSync(join(ROMS, name)));
const page = (name: string, n: number) => rom(name).subarray(n * 0x4000, (n + 1) * 0x4000);

describe("the Enterprise ROM pages", () => {
  it("are known by their bytes, each with its kind and run address", () => {
    const expected: [string, number, string][] = [
      ["ep-exos21.rom", 0, "ep-exos"],
      ["ep-exos21.rom", 1, "ep-exos"],
      ["ep-exos20.rom", 0, "ep-exos"],
      ["ep-exos20.rom", 1, "ep-exos"],
      ["ep-basic21.rom", 0, "ep-ext"],
      ["ep-basic20.rom", 0, "ep-ext"],
      ["ep-exdos13.rom", 0, "ep-ext"],
      ["ep-exdos13.rom", 1, "ep-ext"]
    ];
    for (const [name, n, kind] of expected) {
      const identity = romPageIdentity(page(name, n));
      expect(knownRomPageKind(identity), `${name}:${n}`).toBe(kind);
      expect(KNOWN_ROM_PAGES[identity.crc32].file, `${name}:${n}`).toBe(name);
      expect(KNOWN_ROM_PAGES[identity.crc32].page ?? 0, `${name}:${n}`).toBe(n);
      expect(romKindOrigin(knownRomPageKind(identity)), `${name}:${n}`).toBe(0xc000);
    }
  });

  it("decodes EXOS at $C000 and counts its targets from there", async () => {
    const bytes = page("ep-exos21.rom", 0);
    // --- Offset 5: JP $C02E, the reset code's jump into page 3, is offset $002E
    expect(Array.from(bytes.subarray(5, 8))).toEqual([0xc3, 0x2e, 0xc0]);
    const decoded = await romDecoderFor("ep-exos")(bytes, 0, 0x40);
    expect(decoded.find((i) => i.offset === 5)?.target).toBe(0x2e);
  });

  it("decodes the byte after RST 30h as data", async () => {
    const bytes = page("ep-exos21.rom", 0);
    // --- $3FAD: RST 30h / $08 (write block). Read as code, the $08 would be EX AF,AF'
    expect(Array.from(bytes.subarray(0x3fad, 0x3faf))).toEqual([0xf7, 0x08]);
    const decoded = await romDecoderFor("ep-exos")(bytes, 0x3fad, 0x3fb3);
    expect(decoded.find((i) => i.offset === 0x3fad)?.length).toBe(1);
    expect(decoded.find((i) => i.offset === 0x3fae)).toBeDefined();
    expect(decoded.find((i) => i.offset === 0x3faf)).toBeDefined();
  });
});

describe("the Enterprise bank space's ROM segments", () => {
  const space = epBankSpace(true);
  // --- Page 0 the null segment F8h, page 1 F9h, page 2 the system segment, page 3 EXOS's segment 1
  const slots = [0xf8, 0xf8, 0xf9, 0xf9, 0xff, 0xff, 0x01, 0x01];

  it("names a ROM segment a ROM page, though its partition is positive", () => {
    expect(space.siteAt(0xc123, slots)).toEqual({ kind: "rom", partition: 1, offset: 0x123 });
    expect(space.siteAt(0x4123, slots)).toEqual({ kind: "bank", bank: 0xf9, offset: 0x123 });
    for (const segment of [0x00, 0x01, 0x04, 0x10, 0x20, 0x21]) expect(isRomPartitionOf(space, segment)).toBe(true);
    expect(isRomPartitionOf(space, 0xf8)).toBe(false);
    expect(partitionSite(0x00, space)).toEqual({ kind: "rom", partition: 0, offset: 0 });
    expect(partitionSite(0xf8, space)).toEqual({ kind: "bank", bank: 0xf8, offset: 0 });
  });

  it("lists a ROM segment at $C000", () => {
    expect(space.romBase?.(0x00)).toBe(0xc000);
    expect(space.romBase?.(0x20)).toBe(0xc000);
    expect(space.romBase?.(0xf8)).toBeUndefined();
  });

  it("keeps the negative partitions as ROM elsewhere", () => {
    expect(isRomPartitionOf(sp128BankSpace, -1)).toBe(true);
    expect(isRomPartitionOf(sp128BankSpace, 3)).toBe(false);
  });
});
