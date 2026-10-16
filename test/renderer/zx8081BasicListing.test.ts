import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Zx80Chars } from "@common/machines/char-codes";
import { basicListingText } from "@renderer/appIde/DocumentPanels/basicListing";
import { decodeZx8081Program, zx8081ProgramArea } from "@renderer/appIde/DocumentPanels/zx8081BasicListing";

/*
 * The BASIC Listing view's ZX81/ZX80 detokenizer on hand-made programs. Its agreement with the ROMs'
 * own LIST is checked on the real cores in `test/zx8081-hw/basic-listing.test.ts`.
 */

/** A ZX81 program at $407D in a 64K memory image, D_FILE right after it */
function zx81Memory(...lines: number[][]): Uint8Array {
  const memory = new Uint8Array(0x10000);
  let a = 0x407d;
  for (const body of lines) {
    memory.set(body, a);
    a += body.length;
  }
  memory[0x400c] = a & 0xff;
  memory[0x400d] = a >> 8;
  return memory;
}

/** A ZX81 line: number (big-endian), length, text, NEWLINE */
const zx81Line = (no: number, ...text: number[]) => [no >> 8, no & 0xff, (text.length + 1) & 0xff, (text.length + 1) >> 8, ...text, 0x76];

function list81(memory: Uint8Array, showCodes = false) {
  const { start, end } = zx8081ProgramArea(memory, "zx81");
  return decodeZx8081Program(memory, start, end, "zx81", { showCodes });
}

describe("decodeZx8081Program: ZX81", () => {
  it("lists tokens with the ROM's spacing and skips a number's hidden form", () => {
    // --- 10 PRINT 1;RND  (PRINT $F5, "1", $7E + 5 bytes, ";", RND $40)
    const listing = list81(zx81Memory(zx81Line(10, 0xf5, 0x1d, 0x7e, 0x81, 0, 0, 0, 0, 0x19, 0x40)));
    expect(listing.corrupted).toBe(false);
    expect(basicListingText(listing.lines).trimEnd()).toBe("  10 PRINT 1;RND");
  });

  it("draws inverse characters inverse", () => {
    // --- 1 REM [A]B
    const listing = list81(zx81Memory(zx81Line(1, 0xea, 0xa6, 0x27)));
    const spans = listing.lines[0].spans;
    expect(spans.find((s) => s.text === "A")?.inverse).toBe(true);
    expect(spans.find((s) => s.text === "B")?.inverse).toBeFalsy();
  });

  it("shows a code LIST cannot print as ?, or as $NN with codes on", () => {
    const memory = zx81Memory(zx81Line(1, 0xea, 0x50));
    expect(basicListingText(list81(memory).lines).trimEnd()).toBe("   1 REM ?");
    expect(basicListingText(list81(memory, true).lines).trimEnd()).toBe("   1 REM $50");
  });

  it("marks a program whose last line runs past the end", () => {
    const memory = zx81Memory(zx81Line(1, 0xea, 0x26));
    memory[0x400c]--; // --- D_FILE now cuts the NEWLINE off
    expect(list81(memory).corrupted).toBe(true);
  });
});

describe("decodeZx8081Program: ZX80", () => {
  it("lists a program from VARS back to $4028 (the hi.o fixture)", () => {
    const file = new Uint8Array(readFileSync(resolve(__dirname, "../zx8081-hw/fixtures/hi.o")));
    const memory = new Uint8Array(0x10000);
    memory.set(file, 0x4000);
    const { start, end } = zx8081ProgramArea(memory, "zx80");
    const listing = decodeZx8081Program(memory, start, end, "zx80");
    expect(listing.corrupted).toBe(false);
    expect(listing.lineCount).toBe(1);
    expect(basicListingText(listing.lines).trimEnd()).toBe('  10 PRINT "HI"');
  });

  it("names the 4K ROM's tokens as its table at $00BB does", () => {
    const rom = readFileSync(resolve(__dirname, "../../src/public/roms/zx80.rom"));
    const glyph = (c: number) => (c === 0 ? " " : Zx80Chars[c].v);
    // --- The table's words end with bit 7 set; $D4 is its second word
    const words: string[] = [];
    let word = "";
    for (let a = 0xbb; words.length < 45; a++) {
      word += glyph(rom[a] & 0x3f);
      if (rom[a] & 0x80) {
        words.push(word);
        word = "";
      }
    }
    for (let code = 0xd4; code <= 0xff; code++) {
      expect(Zx80Chars[code], `$${code.toString(16)}`).toEqual({ c: "token", t: words[code - 0xd4 + 1] });
    }
  });
});
