import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";
import { colours, hex8, PAPER_LEFT, PAPER_TOP, writePalette } from "./_ula-helpers";

/*
 * The 48K ROM boot picture (catalogue ULA-021).
 *
 * The stock 48K ROM (`src/public/roms/sp48.rom`) is copied into RAM pages 32-33 and mapped at
 * $0000-$3FFF with MMU0/MMU1 (NextRegs $50/$51 take a RAM page; zxnext.vhd MMU), DivMMC automap off
 * ($0A bit 4), then entered at $0000 - a cold start with no NextZXOS involved. After it initialises
 * it prints the copyright message on the bottom line and waits for a key.
 *
 * The expected picture is computed from the ROM itself, not from emulator output: the message bytes
 * (the text ending in "Research Ltd", last character with bit 7 set) drawn from column 0 of character
 * row 23 with the ROM font at $3D00 (8 bytes per character from code 32), INK 0 on PAPER 7 everywhere
 * (ATTR-P $38), and BORDER 7. Standard ULA colours: ink 0 is palette entry 0, paper 7 entry 23, border 7
 * entry 23 (zxula.vhd ~541-553), written here because palette RAM has no reset contents.
 */

const ROM = readFileSync("src/public/roms/sp48.rom");

function copyrightMessage(): number[] {
  const at = ROM.indexOf(Buffer.from("Sinclair Research Lt"));
  if (at < 0) throw new Error("message not found in the ROM");
  let start = at;
  while (start > 0 && ROM[start - 1] >= 0x20 && ROM[start - 1] < 0x80) start--;
  const out: number[] = [];
  for (let i = start; ; i++) {
    out.push(ROM[i] & 0x7f);
    if (ROM[i] & 0x80) break;
  }
  return out;
}

describe("48K ROM boot picture", () => {
  it("ULA-021: a cold-started 48K ROM shows its copyright line in its own font, and nothing else", async () => {
    const message = copyrightMessage();
    expect(String.fromCharCode(...message.slice(1))).toBe(" 1982 Sinclair Research Ltd");
    expect(message[0], "the (c) sign").toBe(0x7f);

    const s = await createSession();
    await s.loadCode(" .org $8000\n di\n jr $");
    s.setNextReg(0x56, 32).poke(0xc000, ROM.subarray(0, 0x2000)).setNextReg(0x56, 33).poke(0xc000, ROM.subarray(0x2000));
    s.setNextReg(0x56, 0x00);
    writePalette(s, [[0, 0x00], [23, 0xb6]]);
    s.setNextReg(0x14, 0xe3).setNextReg(0x4a, 0xe3);
    await s.loadCode(`
        .org $8000
Start:  di
        nextreg $0a,$00          ; DivMMC automap off
        nextreg $50,32           ; RAM pages 32-33 (the ROM copy) at $0000-$3FFF
        nextreg $51,33
        jp 0
    `, { entry: "Start" });
    s.runFrames(150);

    // --- expected ink pixels: message character i at column i of character row 23
    const expected: string[] = [];
    message.forEach((ch, col) => {
      for (let line = 0; line < 8; line++) {
        const bits = ROM[0x3d00 + (ch - 32) * 8 + line];
        for (let b = 0; b < 8; b++) if (bits & (0x80 >> b)) expected.push(`${184 + line}:${col * 8 + b}`);
      }
    });
    const ink = hex8(0x00);
    const found: string[] = [];
    const other = new Set<string>();
    for (let y = 0; y < 192; y++) {
      for (let x = 0; x < 256; x++) {
        const left = s.pixel(PAPER_LEFT + 2 * x, PAPER_TOP + y);
        if (left === ink) found.push(`${y}:${x}`);
        else if (left !== hex8(0xb6)) other.add(left);
      }
    }
    expect(found.length).toBeGreaterThan(100);
    // --- `found` is in raster order; put `expected` (built character by character) in the same order
    const raster = (p: string) => p.split(":").map(Number).reduce((y, x) => y * 256 + x);
    expect(found).toEqual(expected.sort((a, b) => raster(a) - raster(b)));
    expect([...other], "no other colour on the paper").toEqual([]);
    expect(colours(s, [0, 719], [0, 47]) + " " + colours(s, [0, 95], [48, 239]) + " " + colours(s, [0, 719], [240, 287]), "border 7").toBe(
      [hex8(0xb6), hex8(0xb6), hex8(0xb6)].join(" ")
    );
  });
});
