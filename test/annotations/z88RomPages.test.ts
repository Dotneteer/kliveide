import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { romDecoderFor, romRunOrigin } from "@renderer/appIde/annotations/romDecoder";
import { partitionSite } from "@renderer/appIde/annotations/liveAnnotatedDisassembly";
import { KNOWN_ROM_PAGES, knownRomPageKind, romKindOrigin, romPageIdentity } from "@common/roms/romIdentity";
import {
  annotationMachineFor,
  bankSpaceFor,
  bankSpaceForAnnotationMachine,
  isRomPartitionOf,
  z88BankSpace
} from "@common/annotations/bankSpace";
import { hasSourceCode, PROVENANCE_VALUES } from "@common/roms/romAnnotationTools";
import { MC_Z88_INTRAM, MI_Z88 } from "@common/machines/constants";

/*
 * The Cambridge Z88's memory and its OZ 4.7 ROM as the annotations read them
 * (`dev/plans/Z88_OZ47_ROM_ANNOTATIONS_PLAN.md`, Phase 1): the `z88` bank space follows the core's paging
 * rule (`z88SetMemoryPageInfo` in `z88-memory.c`), the ROM banks that hold something are known by their
 * bytes, and the decoder lists each run in the segment it runs in.
 */

const ROMS = join(__dirname, "../../src/public/roms");
const oz47 = new Uint8Array(readFileSync(join(ROMS, "z88v47.rom")));
const bank = (n: number) => oz47.subarray(n * 0x4000, (n + 1) * 0x4000);

describe("the z88 bank space", () => {
  const space = z88BankSpace(0x80000);
  // --- Bank $00's lower half, SR0 = $21 (the upper half of bank $20), SR1 = $3F, SR2 = $0A, SR3 = $09
  const slots = [0x00, 0x21, 0x3f, 0x3f, 0x0a, 0x0a, 0x09, 0x09];

  it("is the Z88's, with the internal RAM from bank $20", () => {
    expect(bankSpaceFor(MI_Z88)?.id).toBe("z88");
    expect(annotationMachineFor(MI_Z88)).toBe("z88");
    expect(bankSpaceForAnnotationMachine("z88")?.id).toBe("z88");
    expect(space.ramBanks[0]).toBe(0x20);
    expect(space.ramBanks).toHaveLength(32);
    // --- A 128K internal RAM (mask $07) is banks $20-$27
    expect(bankSpaceFor(MI_Z88, { [MC_Z88_INTRAM]: 0x07 })?.ramBanks).toEqual([
      0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27
    ]);
  });

  it("names segments 1-3 by the whole bank they show", () => {
    expect(space.siteAt(0x4123, slots)).toEqual({ kind: "bank", bank: 0x3f, offset: 0x0123 });
    expect(space.siteAt(0x6123, slots)).toEqual({ kind: "bank", bank: 0x3f, offset: 0x2123 });
    expect(space.siteAt(0x8000, slots)).toEqual({ kind: "rom", partition: 0x0a, offset: 0 });
    expect(space.siteAt(0xe400, slots)).toEqual({ kind: "rom", partition: 0x09, offset: 0x2400 });
  });

  it("splits segment 0: bank $00 (or $20) below $2000, half of SR0 & $FE above", () => {
    expect(space.siteAt(0x0038, slots)).toEqual({ kind: "rom", partition: 0x00, offset: 0x0038 });
    // --- SR0 = $21: the upper half of bank $20
    expect(space.siteAt(0x2010, slots)).toEqual({ kind: "bank", bank: 0x20, offset: 0x2010 });
    // --- SR0 = $20: its lower half
    const even = [0x00, 0x20, ...slots.slice(2)];
    expect(space.siteAt(0x2010, even)).toEqual({ kind: "bank", bank: 0x20, offset: 0x0010 });
    // --- COM.RAMS: RAM bank $20 at $0000
    const rams = [0x20, ...slots.slice(1)];
    expect(space.siteAt(0x0038, rams)).toEqual({ kind: "bank", bank: 0x20, offset: 0x0038 });
  });

  it("finds every address a bank site is visible at", () => {
    expect(space.addressesOf({ bank: 0x20, offset: 0x2010 }, slots)).toEqual([0x2010]);
    expect(space.addressesOf({ bank: 0x20, offset: 0x0010 }, slots)).toEqual([]);
    expect(space.addressesOf({ bank: 0x3f, offset: 0x2123 }, slots)).toEqual([0x6123]);
    // --- The same bank in two segments
    const twice = [0x00, 0x20, 0x3f, 0x3f, 0x3f, 0x3f, 0x09, 0x09];
    expect(space.addressesOf({ bank: 0x3f, offset: 0x0100 }, twice)).toEqual([0x4100, 0x8100]);
    expect(space.candidateAddresses({ bank: 0x3f, offset: 0x0100 })).toEqual([0x0100, 0x2100, 0x4100, 0x8100, 0xc100]);
  });

  it("treats slot 0's banks $00-$1F as ROM pages under their own numbers", () => {
    for (const rom of [0x00, 0x0a, 0x1f]) expect(isRomPartitionOf(space, rom)).toBe(true);
    for (const ram of [0x20, 0x3f, 0x40, 0xff]) expect(isRomPartitionOf(space, ram)).toBe(false);
    expect(partitionSite(0x0a, space)).toEqual({ kind: "rom", partition: 0x0a, offset: 0 });
    expect(partitionSite(0x40, space)).toEqual({ kind: "bank", bank: 0x40, offset: 0 });
    expect(space.partitionOf({ bank: 0x0a, offset: 0 })).toBe(0x0a);
  });
});

describe("the OZ 4.7 ROM banks", () => {
  const filled = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x10, 0x1f];

  it("are known by their bytes, each as its own page of z88v47.rom", () => {
    for (const n of filled) {
      const identity = romPageIdentity(bank(n));
      expect(knownRomPageKind(identity), `bank ${n}`).toBe("z88-oz");
      expect(KNOWN_ROM_PAGES[identity.crc32].file, `bank ${n}`).toBe("z88v47.rom");
      expect(KNOWN_ROM_PAGES[identity.crc32].page, `bank ${n}`).toBe(n);
    }
    expect(romKindOrigin("z88-oz")).toBe(0xc000);
  });

  it("leave the empty banks unknown: every ROM has them", () => {
    for (let n = 0; n < 0x20; n++) {
      if (filled.includes(n)) continue;
      expect(bank(n).every((b) => b === 0xff), `bank ${n}`).toBe(true);
      expect(knownRomPageKind(romPageIdentity(bank(n))), `bank ${n}`).toBeUndefined();
    }
  });

  it("carry the V4.7 tag's revision in the lower kernel bank", () => {
    // --- `ozrev` ($0603C979, commit 603c979a) at bank 1's $1E36: the build identification of Phase 0
    expect(Array.from(bank(1).subarray(0x1e36, 0x1e3a))).toEqual([0x79, 0xc9, 0x03, 0x06]);
  });
});

describe("the z88-oz decoder", () => {
  it("lists RST 20h with its OZ call bytes, and RST 18h with its operation byte", async () => {
    const bytes = new Uint8Array(0x4000);
    // --- RST 20h / $09 $3A (a two-byte GN call), LD A,5; RST 18h / $45, NOP
    bytes.set([0xe7, 0x09, 0x3a, 0x3e, 0x05, 0xdf, 0x45, 0x00], 0x100);
    const decoded = await romDecoderFor("z88-oz")(bytes, 0x100, 0x107);
    expect(decoded.map((i) => [i.offset, i.length])).toEqual([
      [0x100, 3],
      [0x103, 2],
      [0x105, 2],
      [0x107, 1]
    ]);
  });

  it("decodes each run in its own segment", async () => {
    const bytes = new Uint8Array(0x4000);
    // --- A segment 2 run at offset 0 (JP $8010) and a segment 3 run at $2400 (JP $E410), as in bank $0A
    bytes.set([0xc3, 0x10, 0x80], 0x0000);
    bytes.set([0xc3, 0x10, 0xe4], 0x2400);
    const segments = [
      { start: 0x0000, segment: 2 },
      { start: 0x2400, segment: 3 }
    ];
    const decode = romDecoderFor("z88-oz", segments);
    expect((await decode(bytes, 0x0000, 0x0002))[0].target).toBe(0x0010);
    expect((await decode(bytes, 0x2400, 0x2402))[0].target).toBe(0x2410);
    // --- Without the segments every run is at $C000: JP $8010 leaves the page
    expect((await romDecoderFor("z88-oz")(bytes, 0x0000, 0x0002))[0].target).toBeUndefined();
  });

  it("takes a run's segment from the last entry at or before its start", () => {
    const segments = [
      { start: 0x2400, segment: 3 },
      { start: 0x0000, segment: 2 }
    ];
    expect(romRunOrigin("z88-oz", segments, 0x0000)).toBe(0x8000);
    expect(romRunOrigin("z88-oz", segments, 0x23ff)).toBe(0x8000);
    expect(romRunOrigin("z88-oz", segments, 0x2400)).toBe(0xc000);
    expect(romRunOrigin("z88-oz", undefined, 0x2400)).toBe(0xc000);
    expect(romRunOrigin("z88-oz", [{ start: 0x0800, segment: 0 }], 0x0800)).toBe(0x0000);
  });
});

describe("the source provenance", () => {
  it("is a provenance value, valid only with a sidecar that names its source code", () => {
    expect(PROVENANCE_VALUES).toContain("source");
    expect(hasSourceCode({})).toBe(false);
    expect(hasSourceCode({ sourceCode: { repository: "https://bitbucket.org/cambridge/oz" } })).toBe(false);
    expect(
      hasSourceCode({
        sourceCode: { repository: "https://bitbucket.org/cambridge/oz", tag: "V4.7", commit: "603c979a" }
      })
    ).toBe(true);
  });
});
