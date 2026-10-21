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
