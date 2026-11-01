import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { defaultCpuForRomKind, isCpu, parseCpu } from "@common/reverse/pipeline/image/cpu";
import { imageBank } from "@common/reverse/pipeline/image/binaryImage";
import {
  imageFromRomPage,
  romPageBytes,
  romPageCount,
  ROM_PAGE_SIZE
} from "@common/reverse/pipeline/image/romImage";

/*
 * The pipeline's image model and its ROM-page adapter (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` P0,
 * D2, D3): the CPU flag, the page split, the origin and the CPU's fixed entries.
 */

const ROMS = join(__dirname, "../../src/public/roms");
const rom = (name: string) => new Uint8Array(readFileSync(join(ROMS, name)));

describe("pipeline CPU flag", () => {
  it("accepts z80 and z80n in any case, and nothing else", () => {
    expect(isCpu("z80")).toBe(true);
    expect(isCpu("Z80N")).toBe(true);
    expect(isCpu("z81")).toBe(false);
    expect(isCpu(undefined)).toBe(false);
    expect(parseCpu("Z80N")).toBe("z80n");
    expect(() => parseCpu("8080")).toThrow(/z80 or z80n/);
  });

  it("takes the default from the ROM kind: the Next's pages are Z80N, the rest plain Z80", () => {
    expect(defaultCpuForRomKind("next-os0")).toBe("z80n");
    expect(defaultCpuForRomKind("next-basic")).toBe("z80n");
    expect(defaultCpuForRomKind("sp48-basic")).toBe("z80");
    expect(defaultCpuForRomKind("ep-ext")).toBe("z80");
    expect(defaultCpuForRomKind(undefined)).toBe("z80");
  });
});

describe("ROM pages", () => {
  it("splits a file into 16K pages; a smaller file is one page", () => {
    expect(romPageCount(new Uint8Array(0x8000))).toBe(2);
    expect(romPageCount(new Uint8Array(0x2000))).toBe(1);
    const file = new Uint8Array(0x8000);
    file[0x4000] = 0x5a;
    expect(romPageBytes(file, 1)[0]).toBe(0x5a);
    expect(romPageBytes(file, 1).length).toBe(ROM_PAGE_SIZE);
    expect(() => romPageBytes(file, 2)).toThrow(/2 page/);
  });
});

describe("imageFromRomPage", () => {
  it("recognises a page by its CRC and lists the CPU's fixed entries on a page at $0000", () => {
    const image = imageFromRomPage(rom("sp48.rom"), { name: "sp48.rom" });
    expect(image.romKind).toBe("sp48-basic");
    expect(image.cpu).toBe("z80");
    expect(image.banks).toHaveLength(1);
    expect(imageBank(image, "0").origin).toBe(0);
    expect(image.entries.map((e) => e.offset)).toEqual([0x00, 0x08, 0x10, 0x18, 0x20, 0x28, 0x30, 0x38, 0x66]);
    expect(image.entries.every((e) => e.source === "cpu-vector" && e.bank === "0")).toBe(true);
  });

  it("decodes an Enterprise page at $C000, with no CPU entries of its own", () => {
    const file = rom("ep-exdos13.rom");
    const image = imageFromRomPage(romPageBytes(file, 1), { name: "ep-exdos13.rom", page: 1 });
    expect(image.romKind).toBe("ep-ext");
    expect(image.banks[0]).toMatchObject({ id: "1", origin: 0xc000 });
    expect(image.entries).toEqual([]);
  });

  it("gives a Next page the Z80N, and lets the caller override the CPU (D2)", () => {
    const file = rom("zxnext/nextzxos-2.10/enNextZX.rom");
    const page = romPageBytes(file, 3);
    expect(imageFromRomPage(page, { name: "enNextZX.rom", page: 3 }).cpu).toBe("z80n");
    expect(imageFromRomPage(page, { name: "enNextZX.rom", page: 3, cpu: "z80" }).cpu).toBe("z80");
  });

  it("takes an unknown page as plain Z80 at $0000 unless a kind is given", () => {
    const bytes = new Uint8Array(0x40); // too short for the NMI at $0066
    const unknown = imageFromRomPage(bytes, { name: "mystery.rom" });
    expect(unknown.romKind).toBeUndefined();
    expect(unknown.cpu).toBe("z80");
    expect(unknown.entries.map((e) => e.offset)).toEqual([0x00, 0x08, 0x10, 0x18, 0x20, 0x28, 0x30, 0x38]);
    const typed = imageFromRomPage(bytes, { name: "mystery.rom", kind: "tvc-sys-low" });
    expect(typed.banks[0].origin).toBe(0xc000);
  });

  it("names the banks it has when asked for a missing one", () => {
    const image = imageFromRomPage(new Uint8Array(16), { name: "tiny.rom" });
    expect(() => imageBank(image, "3")).toThrow(/has no bank "3" \(it has 0\)/);
  });
});
