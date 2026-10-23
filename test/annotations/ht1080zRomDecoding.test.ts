import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { romDecoderFor } from "@renderer/appIde/annotations/romDecoder";
import { knownRomPageKind, romKindOrigin, romPageIdentity } from "@common/roms/romIdentity";

/*
 * The HT-1080Z's BASIC ROM as the ROM annotation tools read it (`.ai/rom-annotations/ht1080z-authoring-guide.md`):
 * known by its bytes, and decoded with the byte after `RST $08` as data, as the IDE's disassembly shows it.
 */

const ROMS = join(__dirname, "../../src/public/roms");
const rom = (name: string) => new Uint8Array(readFileSync(join(ROMS, name)));

describe("the HT-1080Z BASIC ROM page", () => {
  it("is known by its bytes on every model, and its extension ROM is not taken for it", () => {
    for (const name of ["ht1080z-s1.rom", "ht1080z-s2.rom", "ht1080z-s64.rom"]) {
      expect(knownRomPageKind(romPageIdentity(rom(name))), name).toBe("ht1080z-basic");
    }
    for (const name of ["ht1080z-s1-ext.rom", "ht1080z-s2-ext.rom", "ht1080z-s64-ext.rom"]) {
      expect(knownRomPageKind(romPageIdentity(rom(name))), name).toBe("ht1080z-ext");
    }
  });

  it("decodes an extension ROM where it runs, $3000, and counts its targets from there", async () => {
    const bytes = rom("ht1080z-s1-ext.rom");
    // --- Offset 3: JP $3021, a jump to the page's own offset $21; offset $1B: CALL $1B61, into BASIC
    expect(Array.from(bytes.subarray(3, 6))).toEqual([0xc3, 0x21, 0x30]);
    expect(Array.from(bytes.subarray(0x1b, 0x1e))).toEqual([0xcd, 0x61, 0x1b]);
    const decoded = await romDecoderFor("ht1080z-ext")(bytes, 0, 0x2f);
    expect(decoded.find((i) => i.offset === 3)?.target).toBe(0x21);
    expect(decoded.find((i) => i.offset === 0x1b)?.target).toBeUndefined();
    expect(romKindOrigin("ht1080z-ext")).toBe(0x3000);
    expect(romKindOrigin("ht1080z-basic")).toBe(0);
  });

  it("decodes the byte after RST $08 as data", async () => {
    const bytes = rom("ht1080z-s1.rom");
    // --- $013B: RST $08 / $28 ("(" expected) / CALL $2B1C. Read as code, the $28 would be a JR.
    expect(Array.from(bytes.subarray(0x013b, 0x013e))).toEqual([0xcf, 0x28, 0xcd]);
    const starts = (await romDecoderFor("ht1080z-basic")(bytes, 0x0100, 0x0150)).map((i) => i.offset);
    expect(starts).toContain(0x013d);
    expect(starts).not.toContain(0x013e);
    const plain = (await romDecoderFor(undefined)(bytes, 0x0100, 0x0150)).map((i) => i.offset);
    expect(plain).toContain(0x013e);
  });
});
