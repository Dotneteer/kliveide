import { describe, expect, it } from "vitest";

import { epCanonicalToDisk, epDiskGeometryOf, epDiskToCanonical } from "@emu/machines/enterprise/EpDiskImage";
import { buildFat12Image, readFat12Files } from "./fat12Image";

/*
 * The EXDOS card's disk images (`EpDiskImage.ts`): the geometry from the FAT12 boot sector, what the
 * card's nine-sector layout refuses, and the conversion to and from the controller's canonical layout
 * (`ep-exdos.c`: 82 cylinders, two sides, nine 512-byte sectors).
 */

const CAPACITY = 82 * 2 * 9 * 512;

describe("EXDOS disk images", () => {
  it("reads the geometry of the 720K, 360K and 180K formats", () => {
    expect(epDiskGeometryOf(buildFat12Image())).toEqual({ cylinders: 80, sides: 2 });
    expect(epDiskGeometryOf(buildFat12Image([], { cylinders: 40, sides: 2, sectorsPerTrack: 9 }))).toEqual({ cylinders: 40, sides: 2 });
    expect(epDiskGeometryOf(buildFat12Image([], { cylinders: 40, sides: 1, sectorsPerTrack: 9 }))).toEqual({ cylinders: 40, sides: 1 });
  });

  it("refuses what the nine-sector layout cannot hold, and what is not a FAT disk", () => {
    expect(epDiskGeometryOf(buildFat12Image([], { cylinders: 80, sides: 2, sectorsPerTrack: 10 }))).toEqual({ error: "sectorsPerTrack" });
    expect(epDiskGeometryOf(buildFat12Image([], { cylinders: 40, sides: 2, sectorsPerTrack: 8 }))).toEqual({ error: "sectorsPerTrack" });
    expect(epDiskGeometryOf(buildFat12Image([], { cylinders: 80, sides: 2, sectorsPerTrack: 18 }))).toEqual({ error: "sectorsPerTrack" });
    expect(epDiskGeometryOf(buildFat12Image([], { cylinders: 84, sides: 2, sectorsPerTrack: 9 }))).toEqual({ error: "size" });
    expect(epDiskGeometryOf(buildFat12Image().subarray(0, 100_000))).toEqual({ error: "size" });
    expect(epDiskGeometryOf(new Uint8Array(737_280))).toEqual({ error: "notFat" });
    expect(epDiskGeometryOf(new Uint8Array(10))).toEqual({ error: "empty" });
  });

  it("converts a double-sided image to the canonical layout and back", () => {
    const image = buildFat12Image([{ name: "A.TXT", contents: new Uint8Array(3000).map((_, i) => i & 0xff) }]);
    image[(2 * 9 + 4) * 512] = 0x5a; // --- cylinder 1, side 0, sector 5
    image[(3 * 9 + 8) * 512 + 7] = 0xa5; // --- cylinder 1, side 1, sector 9
    const geometry = { cylinders: 80, sides: 2 };
    const canonical = epDiskToCanonical(image, geometry, CAPACITY);
    expect(canonical[((1 * 2 + 0) * 9 + 4) * 512]).toBe(0x5a);
    expect(canonical[((1 * 2 + 1) * 9 + 8) * 512 + 7]).toBe(0xa5);
    expect(epCanonicalToDisk(canonical, geometry)).toEqual(image);
  });

  it("spreads a single-sided image over side 0", () => {
    const image = buildFat12Image([], { cylinders: 40, sides: 1, sectorsPerTrack: 9 });
    image[(3 * 9) * 512] = 0x77; // --- track 3, sector 1
    const geometry = { cylinders: 40, sides: 1 };
    const canonical = epDiskToCanonical(image, geometry, CAPACITY);
    expect(canonical[(3 * 2 * 9) * 512]).toBe(0x77);
    expect(epCanonicalToDisk(canonical, geometry)).toEqual(image);
  });

  it("builds FAT12 images the reader reads back (the tests' own writer)", () => {
    const big = new Uint8Array(5000).map((_, i) => (i * 7) & 0xff);
    const image = buildFat12Image([
      { name: "HELLO.TXT", contents: new TextEncoder().encode("hello") },
      { name: "START", contents: big }
    ]);
    const files = readFat12Files(image);
    expect(files.map((f) => [f.name, f.size])).toEqual([
      ["HELLO.TXT", 5],
      ["START", 5000]
    ]);
    expect(files[1].contents).toEqual(big);
  });
});
