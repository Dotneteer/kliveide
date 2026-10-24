import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { checkInterface1Rom, IF1_ROM_RESOURCE } from "@emu/machines/zxSpectrum/if1/if1Rom";

/*
 * The shipped ZX Interface 1 ROM (`.plans/MICRODRIVE_PLAN.md` Phase 0, Q1). A replaced or corrupted
 * image fails here instead of crashing the first RST 8. The CRC32 is MAME's v2 BIOS, recorded in
 * `src/public/roms/if1-roms-readme.txt`. The paging checks pin the facts the device relies on (§3 M2):
 * the IF1 ROM and the 48K ROM hold the same instruction at the page-in addresses, so paging before or
 * after the fetch there makes no difference, but differ at $0700, so the page-out must come after the
 * fetch of the IF1 ROM's RET.
 */

const ROM_DIR = join(__dirname, "../../src/public/roms");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const read = (name: string) => new Uint8Array(readFileSync(join(ROM_DIR, name)));
const hex = (bytes: Uint8Array, from: number, length: number) =>
  Buffer.from(bytes.subarray(from, from + length)).toString("hex");

describe("ZX Interface 1 ROM image", () => {
  const if1 = read("if1-2.rom");

  it("has the recorded size and CRC32 (v2)", () => {
    expect(if1.length).toBe(0x2000);
    expect(crc32(if1).toString(16)).toBe("bb66dd1e");
  });

  it("carries Sinclair Research's notice", () => {
    expect(Buffer.from(if1).toString("latin1")).toContain(" 1983 Sinclair Research Ltd");
  });

  for (const romName of ["sp48.rom", "sp128-1.rom"]) {
    const basic = read(romName);

    it(`holds the same instructions as ${romName} at the page-in addresses`, () => {
      // $0008: LD HL,(CH_ADD); $1708: INC HL
      expect(hex(if1, 0x0008, 3)).toBe("2a5d5c");
      expect(hex(basic, 0x0008, 3)).toBe("2a5d5c");
      expect(if1[0x1708]).toBe(0x23);
      expect(basic[0x1708]).toBe(0x23);
    });

    it(`differs from ${romName} at the page-out address`, () => {
      expect(if1[0x0700]).toBe(0xc9); // RET (UNPAGE)
      expect(basic[0x0700]).toBe(0x71); // LD (HL),C
    });
  }

  it("is the resource the machines load, and identifies as v2", () => {
    expect(read(`${IF1_ROM_RESOURCE}.rom`)).toEqual(if1);
    expect(checkInterface1Rom(if1)).toEqual({ ok: true, edition: "v2", crc32: 0xbb66dd1e });
  });

  it("calls any other 8K ROM custom, and refuses another size", () => {
    const patched = if1.slice();
    patched[0x1000] ^= 0xff;
    expect(checkInterface1Rom(patched)).toMatchObject({ ok: true, edition: "custom" });
    expect(checkInterface1Rom(new Uint8Array(0x4000))).toEqual({ ok: false, problem: "size", size: 0x4000 });
  });

  it("does not scan the keyboard or count frames while paged", () => {
    expect(hex(if1, 0x0038, 2)).toBe("fbc9"); // EI : RET
    expect(hex(if1, 0x0066, 2)).toBe("ed45"); // RETN
  });
});
