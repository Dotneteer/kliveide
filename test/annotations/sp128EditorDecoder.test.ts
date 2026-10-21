import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { romDecoderFor } from "@renderer/appIde/annotations/romDecoder";

/*
 * The 128K editor ROM's `RST $28` takes the word after it as a ROM 1 address (its routine at $0028
 * reads the word and returns past it), so a ROM 0 page lists that word as data, not as code.
 */

const ROM0 = new Uint8Array(readFileSync(join(__dirname, "../../src/public/roms/sp128-0.rom")));

describe("the 128K editor ROM's decoding", () => {
  it("reads the word after RST $28 as data", async () => {
    // --- $018A: RST $28, .defw $1661 (ROM 1's LDDR), EX DE,HL
    const decoded = await romDecoderFor("sp128-editor")(ROM0, 0x018a, 0x018d);
    expect(decoded.map((i) => [i.offset, i.length])).toEqual([[0x18a, 1], [0x18b, 2], [0x18d, 1]]);
  });

  it("reads the byte after CALL $05AC as a report code", async () => {
    // --- $05E2: CALL $05AC, .defb $14 (L BREAK), then EI
    const decoded = await romDecoderFor("sp128-editor")(ROM0, 0x05e2, 0x05e6);
    expect(decoded.map((i) => [i.offset, i.length])).toEqual([[0x5e2, 3], [0x5e5, 1], [0x5e6, 1]]);
  });

  it("is not applied to other pages", async () => {
    // --- Plain decoding reads $61 $16 $EB as LD H,C and LD D,$EB, past the EX DE,HL
    const decoded = await romDecoderFor(undefined)(ROM0, 0x018a, 0x018d);
    expect(decoded.map((i) => i.offset)).toEqual([0x18a, 0x18b, 0x18c]);
  });
});

/*
 * The +2A/+3's editor ROM (ROM 0) has the same RST $28, into ROM 3; its $05AC is a stack switch
 * whose calls are followed by code, so nothing after CALL $05AC is taken for data there.
 */
const P3_ROM0 = new Uint8Array(readFileSync(join(__dirname, "../../src/public/roms/spp3-41-0.rom")));

describe("the +3 editor ROM's decoding", () => {
  it("reads the word after RST $28 as data", async () => {
    // --- $0010: RST $28, .defw $0010 (ROM 3's RST $10), RET
    const decoded = await romDecoderFor("plus3-editor")(P3_ROM0, 0x0010, 0x0013);
    expect(decoded.map((i) => [i.offset, i.length])).toEqual([[0x10, 1], [0x11, 2], [0x13, 1]]);
  });

  it("reads the bytes after CALL $05AC as code", async () => {
    // --- $0287: CALL $05AC, then another CALL
    const decoded = await romDecoderFor("plus3-editor")(P3_ROM0, 0x0287, 0x028a);
    expect(decoded.map((i) => [i.offset, i.length])).toEqual([[0x287, 3], [0x28a, 3]]);
  });
});

/*
 * The +3's syntax ROM (ROM 1) also calls +3DOS with CALL $3F00 + word and ROM 0 with CALL $3E80 +
 * word: each word is the address in that ROM.
 */
const P3_ROM1 = new Uint8Array(readFileSync(join(__dirname, "../../src/public/roms/spp3-41-1.rom")));

describe("the +3 syntax ROM's decoding", () => {
  it("reads the word after CALL $3F00 as data", async () => {
    const decoded = await romDecoderFor("plus3-syntax")(P3_ROM1, 0x02db, 0x02e0);
    expect(decoded.map((x) => [x.offset, x.length]).slice(0, 2)).toEqual([[0x02db, 3], [0x02de, 2]]);
  });

  it("reads the word after CALL $3E80 as data", async () => {
    const decoded = await romDecoderFor("plus3-syntax")(P3_ROM1, 0x136d, 0x1372);
    expect(decoded.map((x) => [x.offset, x.length]).slice(0, 2)).toEqual([[0x136d, 3], [0x1370, 2]]);
  });
});
