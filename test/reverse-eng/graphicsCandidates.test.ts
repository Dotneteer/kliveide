import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { findGraphicCandidates } from "@common/reverse/graphicsCandidates";
import { PF_EXECUTED, PF_CODE, PF_READ, PF_WRITTEN } from "@common/profile/profileTypes";

/*
 * The graphics finder's candidates (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §5.4, §8 G7.4): the
 * 48K ROM's character set is found, random data is not.
 */

describe("findGraphicCandidates", () => {
  it("finds the 48K ROM's character set at $3D00", () => {
    const rom = new Uint8Array(readFileSync("src/public/roms/sp48.rom"));
    const fonts = findGraphicCandidates({ bytes: rom, base: 0 }).filter((c) => c.kind === "font");
    expect(fonts.map((c) => [c.start, c.end])).toEqual([[0x3d00, 0x3fff]]);
  });

  it("finds nothing in random data", () => {
    let seed = 12345;
    const random = new Uint8Array(0x4000).map(() => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed >> 16;
    });
    expect(findGraphicCandidates({ bytes: random, base: 0x8000 })).toEqual([]);
  });

  it("lists the UDG area and read-only data, ranked by reads", () => {
    const bytes = new Uint8Array(0x4000);
    bytes.set([0x18, 0x3c, 0x7e], 0x3f58);
    const flags = new Uint8Array(0x4000);
    const reads = new Uint32Array(0x4000);
    for (let i = 0x100; i < 0x110; i++) {
      flags[i] = PF_READ;
      reads[i] = 2;
    }
    for (let i = 0x200; i < 0x220; i++) {
      flags[i] = PF_READ;
      reads[i] = 9;
    }
    for (let i = 0x300; i < 0x320; i++) flags[i] = PF_READ | PF_WRITTEN;
    flags[0x10] = PF_EXECUTED | PF_CODE;
    const found = findGraphicCandidates({ bytes, base: 0xc000, flags, reads });
    expect(found.map((c) => [c.kind, c.start])).toEqual([
      ["udg", 0x3f58],
      ["data", 0x200],
      ["data", 0x100]
    ]);
    expect(found[1].description).toBe("Read-only data at $C200, 32 bytes, read 288×");
  });
});
