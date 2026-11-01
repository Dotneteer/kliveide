import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { imageFromRomPage, romPageBytes } from "@common/reverse/pipeline/image/romImage";
import { formatListingLine, listImageBank } from "@common/reverse/pipeline/listing";

/*
 * The pipeline's `listing` (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` P0): Klive's disassembler with
 * the image's CPU flag (D2), the ROM kind's custom decoding, and the sidecar's regions.
 */

const ROMS = join(__dirname, "../../src/public/roms");

/** NEXTREG $12,$34; JP (C); RET */
const Z80N_BYTES = new Uint8Array([0xed, 0x91, 0x12, 0x34, 0xed, 0x98, 0xc9]);

describe("listImageBank", () => {
  it("decodes the Z80N's opcodes only when the image's CPU is z80n", async () => {
    const z80n = await listImageBank(imageFromRomPage(Z80N_BYTES, { name: "t", cpu: "z80n" }), "0", 0, 6);
    expect(z80n.map((l) => [l.offset, l.bytes.length, l.text])).toEqual([
      [0, 4, "nextreg $12,$34"],
      [4, 2, "jp (c)"],
      [6, 1, "ret"]
    ]);
    // --- On a plain Z80 the same bytes are ED no-ops, and every boundary after them moves
    const z80 = await listImageBank(imageFromRomPage(Z80N_BYTES, { name: "t", cpu: "z80" }), "0", 0, 6);
    expect(z80.map((l) => l.offset)).toEqual([0, 2, 3, 4, 6]);
  });

  it("lists an Enterprise page at $C000 with the EXOS call decoding", async () => {
    const page = romPageBytes(new Uint8Array(readFileSync(join(ROMS, "ep-exos21.rom"))), 0);
    const image = imageFromRomPage(page, { name: "ep-exos21.rom" });
    const lines = await listImageBank(image, "0", 0x06b1, 0x06b2);
    expect(lines[0]).toMatchObject({ offset: 0x06b1, address: 0xc6b1, text: "rst $30" });
    expect(lines[1].comment).toMatch(/EXOS 27/);
    expect(formatListingLine(lines[0], 0xc000)).toMatch(/^06B1 @C6B1 F7\s+rst \$30/);
  });

  it("follows the regions it is given: a data region is listed as data", async () => {
    const image = imageFromRomPage(Z80N_BYTES, { name: "t", cpu: "z80n" });
    const lines = await listImageBank(image, "0", 0, 6, [
      { start: 0, end: 3, type: "bytes" },
      { start: 4, end: 6, type: "disassemble" }
    ]);
    expect(lines[0].text).toMatch(/^\.defb/);
    expect(lines.at(-1)?.text).toBe("ret");
  });

  it("rejects a range outside the bank", async () => {
    const image = imageFromRomPage(Z80N_BYTES, { name: "t" });
    await expect(listImageBank(image, "0", 0, 7)).rejects.toThrow(/outside bank 0/);
  });
});
