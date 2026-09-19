import { describe, expect, it } from "vitest";

import { type NextTestSession } from "../../harness/zxnext";
import { colours, hex8, parkedSession, writePalette } from "../ula/_ula-helpers";

/*
 * Sprite CPU interface: ports $303B / $57 / $5B and the NextReg attribute mirrors, driven the way
 * software drives them and observed on screen (the attribute and pattern RAMs have no read port).
 * Replaces the hardware-visible parts of test/zxnext/SpriteDevice.test.ts, SpriteDevice-index,
 * SpriteDevice-patterns and SpriteDevice-d4d6d7 (D6/D7), which inspected SpriteDevice fields.
 *
 * All VHDL references are `_input/next-fpga/src/video/sprites.vhd` unless marked zxnext.vhd.
 *
 * Geometry: sprite x is buffer x 32 + 2x, sprite y is buffer row 16 + y ($15 = $03: visible, over
 * the border, so no clip window applies). The ULA is off ($68 bit 7), so where no sprite pixel is the
 * fallback colour $4A = $E0 shows.
 */

const NONE = hex8(0xe0);
const C1 = 0x1c;
const C2 = 0xfc;
const C3 = 0x03;
const C4 = 0x1f;

/** A parked session: sprite palette 1-4 = C1-C4, ULA off, fallback $E0, all 128 sprites invisible. */
async function spriteSession(): Promise<NextTestSession> {
  const s = await parkedSession();
  writePalette(s, [[1, C1], [2, C2], [3, C3], [4, C4]], 0x20);
  s.setNextReg(0x43, 0x00).setNextReg(0x4a, 0xe0).setNextReg(0x68, 0x80).setNextReg(0x4b, 0xe3);
  // --- Attribute RAM has no reset contents on the FPGA: hide every sprite (4-byte form, attr3 = 0)
  s.out(0x303b, 0x00);
  for (let i = 0; i < 128 * 4; i++) s.out(0x0057, 0x00);
  s.setNextReg(0x15, 0x03);
  return s;
}

/** The distinct colours of a w x h sprite-space area at (x, y). */
function area(s: NextTestSession, x: number, y: number, w = 16, h = 16): string {
  return colours(s, [32 + 2 * x, 32 + 2 * (x + w) - 1], [16 + y, 16 + y + h - 1]);
}

/** Writes `n` copies of `value` through port $5B. */
function fill5b(s: NextTestSession, n: number, value: number): NextTestSession {
  for (let i = 0; i < n; i++) s.out(0x005b, value);
  return s;
}

/** Writes attribute bytes through port $57. */
function attrs(s: NextTestSession, ...bytes: number[]): NextTestSession {
  for (const b of bytes) s.out(0x0057, b);
  return s;
}

describe("sprite ports", () => {
  /*
   * $303B write (~658, ~738): attr_index <= d(6:0) & "000" - the sprite for $57; pattern_index <=
   * d(5:0) & d(7) & "0000000" - the pattern for $5B, bit 7 selecting its second 128 bytes. $5B writes
   * auto-increment the 14-bit pattern address (~645-647, ~740), crossing into the next pattern.
   */
  it("$303B selects sprite d(6:0) and pattern d(5:0), d(7) its second half; $5B runs on into the next pattern", async () => {
    const s = await spriteSession();
    s.out(0x303b, 0x05);
    fill5b(s, 128, 3); // --- pattern 5, bytes 0-127 (rows 0-7)
    s.out(0x303b, 0xc5); // --- sprite $45; pattern 5 (d(5:0)), second half (d(7))
    fill5b(s, 128, 1); // --- pattern 5 rows 8-15
    fill5b(s, 128, 2); // --- runs on: pattern 6 rows 0-7
    fill5b(s, 128, 4); // --- pattern 6 rows 8-15
    // --- $5B writes leave the attribute index alone: these land in sprite $45, then $46
    attrs(s, 100, 100, 0x00, 0x80 | 5);
    attrs(s, 140, 100, 0x00, 0x80 | 6);
    s.runFrames(2);
    expect(area(s, 100, 100, 16, 8), "pattern 5 rows 0-7").toBe(hex8(C3));
    expect(area(s, 100, 108, 16, 8), "pattern 5 rows 8-15, written from the half select").toBe(hex8(C1));
    expect(area(s, 140, 100, 16, 8), "pattern 6 rows 0-7").toBe(hex8(C2));
    expect(area(s, 140, 108, 16, 8), "pattern 6 rows 8-15").toBe(hex8(C4));
    // --- it was sprite $45 (d(6:0)), not sprite 5 (d(5:0)): hiding $45 through the mirror removes it
    s.setNextReg(0x34, 0x45).setNextReg(0x38, 0x00).runFrames(1);
    expect(area(s, 100, 100), "sprite $45 hidden").toBe(NONE);
    expect(area(s, 140, 100), "sprite $46 still there").toBe([hex8(C2), hex8(C4)].sort().join(","));
  });

  /*
   * Reset (zxnext.vhd ~4311: reset_i <= reset, soft or hard) clears attr_index (~653-654), pattern_index
   * (~733-734) and mirror_sprite_q (~600-601): $34 reads 0 and the first $57 / $5B writes go to sprite 0
   * attribute 0 and pattern 0 byte 0, without a $303B select.
   *
   * Parity finding, fixed 2026-09-19 (ts): SpriteDevice.reset() (called from ZxNextMachine.reset()) clears the mirror
   * and the attributes but not spriteIndex / spriteSubIndex / patternIndex / patternSubIndex (only the
   * constructor zeroes them), so after a soft reset $57 and $5B carry on where they were.
   */
  it("a reset sends $57 and $5B back to sprite 0 / pattern 0 and $34 to 0", async () => {
    const s = await spriteSession();
    s.out(0x303b, 0xc5).out(0x0057, 0x11).out(0x0057, 0x22); // --- mid-way through sprite $45
    fill5b(s, 3, 0x00);
    s.setNextReg(0x34, 0x22);
    s.reset().setRegisters({ pc: 0x8000 }); // --- the parked program is still at $8000: do not run the ROM
    expect(s.readNextReg(0x34), "$34").toBe(0x00);
    writePalette(s, [[1, C1]], 0x20);
    s.setNextReg(0x43, 0x00).setNextReg(0x4a, 0xe0).setNextReg(0x68, 0x80).setNextReg(0x4b, 0xe3);
    fill5b(s, 256, 1); // --- pattern 0
    attrs(s, 100, 100, 0x00, 0x80); // --- sprite 0
    s.setNextReg(0x15, 0x03).runFrames(2);
    expect(area(s, 100, 100), "sprite 0, pattern 0").toBe(hex8(C1));
  });

  /*
   * The pattern address is 14 bits (TOTAL_PATTERN_BITS + 8, ~178): index_inc_out_s = index + 1 wraps
   * from $3FFF (pattern 63, byte 255) to $0000 (~645-647, ~740).
   */
  it("$5B wraps from the end of pattern 63 to pattern 0", async () => {
    const s = await spriteSession();
    s.out(0x303b, 0x3f);
    fill5b(s, 128, 3); // --- pattern 63 rows 0-7
    s.out(0x303b, 0x80);
    fill5b(s, 128, 4); // --- pattern 0 rows 8-15
    s.out(0x303b, 0xbf); // --- pattern 63, second half
    fill5b(s, 128, 1); // --- pattern 63 rows 8-15 ($3F80-$3FFF)
    fill5b(s, 128, 2); // --- wraps: pattern 0 rows 0-7 ($0000-$007F)
    s.out(0x303b, 0x00);
    attrs(s, 100, 100, 0x00, 0x80 | 63);
    attrs(s, 140, 100, 0x00, 0x80 | 0);
    s.runFrames(2);
    expect(area(s, 100, 100, 16, 8), "pattern 63 rows 0-7").toBe(hex8(C3));
    expect(area(s, 100, 108, 16, 8), "pattern 63 rows 8-15").toBe(hex8(C1));
    expect(area(s, 140, 100, 16, 8), "pattern 0 rows 0-7, after the wrap").toBe(hex8(C2));
    expect(area(s, 140, 108, 16, 8), "pattern 0 rows 8-15").toBe(hex8(C4));
  });

  /*
   * zxnext.vhd ~2507-2508, ~2635-2636: $57 and $5B decode the low address byte only (port_57_lsb,
   * port_5b_lsb); $303B needs the high byte $30 (~2637).
   */
  it("$57 and $5B decode only the low address byte", async () => {
    const s = await spriteSession();
    s.out(0x303b, 0x00);
    for (let i = 0; i < 256; i++) s.out((i << 8) | 0x5b, 1);
    s.out(0x303b, 0x00);
    for (const [i, b] of [100, 100, 0x00, 0x80].entries()) s.out(((0x31 + i * 0x44) << 8) | 0x57, b);
    s.runFrames(2);
    expect(area(s, 100, 100)).toBe(hex8(C1));
  });

  /*
   * ~641-664: after attribute byte 3 with d(6) = 0, or after byte 4, attr_index moves to the next
   * sprite: index_inc_out_s(6 downto 0) & "000" - the sprite number is 7 bits and wraps 127 -> 0.
   */
  it("$57 wraps from sprite 127 to sprite 0, after a 5-byte and after a 4-byte sprite 127", async () => {
    const s = await spriteSession();
    s.out(0x303b, 0x00);
    fill5b(s, 256, 1); // --- pattern 0 solid index 1
    s.out(0x303b, 0x7f);
    attrs(s, 180, 60, 0x00, 0xc0, 0x00); // --- sprite 127, 5 bytes, visible
    s.runFrames(2);
    expect(area(s, 180, 60), "sprite 127").toBe(hex8(C1));
    attrs(s, 100, 100, 0x00, 0x80); // --- the next four bytes: sprite 0
    s.runFrames(1);
    expect(area(s, 100, 100), "the 4 bytes after a 5-byte sprite 127").toBe(hex8(C1));
    s.setNextReg(0x34, 0x00).setNextReg(0x38, 0x00).runFrames(1); // --- hide sprite 0 through the mirror
    expect(area(s, 100, 100), "they went to sprite 0").toBe(NONE);

    s.out(0x303b, 0x7f);
    attrs(s, 140, 100, 0x00, 0x80); // --- sprite 127, 4 bytes
    s.runFrames(1);
    expect(area(s, 140, 100), "sprite 127, 4 bytes").toBe(hex8(C1));
    attrs(s, 20, 100, 0x00, 0x80); // --- the next four bytes: sprite 0
    s.runFrames(1);
    expect(area(s, 20, 100), "the 4 bytes after a 4-byte sprite 127").toBe(hex8(C1));
    s.setNextReg(0x34, 0x00).setNextReg(0x38, 0x00).runFrames(1);
    expect(area(s, 20, 100), "they went to sprite 0").toBe(NONE);
  });

  /*
   * The line engine walks all 128 sprites on every line (~846-870: S_QUALIFY moves on until
   * spr_cur_index wraps to 0), drawing each visible one (attr3 bit 7). Which sprite software wrote
   * last has no part in it.
   *
   * Parity finding, fixed 2026-09-19 (wasm): zxnextUlaProcessSprites (zxnext-ula.c ~792) stops at
   * zxnextSpriteLastVisibleIndex, which zxnext-sprites.c sets to the sprite whose attr3 was *last
   * written* with bit 7 set (~51, ~155) - not the highest visible sprite. Making sprite 3 visible after
   * sprite 10 hides sprite 10.
   */
  it("a sprite made visible later does not hide higher-numbered visible sprites", async () => {
    const s = await spriteSession();
    s.out(0x303b, 0x00);
    fill5b(s, 256, 1);
    s.out(0x303b, 10);
    attrs(s, 140, 100, 0x00, 0x80); // --- sprite 10
    s.out(0x303b, 3);
    attrs(s, 100, 100, 0x00, 0x80); // --- sprite 3, written after it
    s.runFrames(2);
    expect({ sprite3: area(s, 100, 100), sprite10: area(s, 140, 100) }).toEqual({ sprite3: hex8(C1), sprite10: hex8(C1) });
  });

  /*
   * The line engine ignores attr4 while attr3 bit 6 is 0 (~798 Y8, ~809 Y scale, ~914/926 X scale,
   * ~803 4-bit): rewritten as a 4-byte sprite, a scaled 5-byte sprite is 16 x 16 again.
   */
  it("a 4-byte sprite ignores the attr4 an earlier 5-byte write left", async () => {
    const s = await spriteSession();
    s.out(0x303b, 0x00);
    fill5b(s, 256, 1);
    s.out(0x303b, 0x00);
    attrs(s, 100, 100, 0x00, 0xc0, 0x0a); // --- 5 bytes: X scale 2x, Y scale 2x -> 32 x 32
    s.runFrames(2);
    expect(area(s, 100, 100, 32, 32), "32 x 32").toBe(hex8(C1));

    s.out(0x303b, 0x00);
    attrs(s, 100, 100, 0x00, 0x80); // --- 4 bytes: 16 x 16
    s.runFrames(1);
    expect(area(s, 100, 100), "16 x 16").toBe(hex8(C1));
    expect(area(s, 116, 100, 16, 32), "right half gone").toBe(NONE);
    expect(area(s, 100, 116, 16, 16), "bottom half gone").toBe(NONE);
  });

  /*
   * Parity finding, fixed 2026-09-19 (both cores): a 4-byte write does not touch attr4. Byte 3 with d(6) = 0 only moves
   * attr_index on (~641, ~660-664); attr4 is written only when attr_id = "100" (~717), which a 4-byte
   * sprite never reaches. So the attr4 an earlier 5-byte write left applies again once attr3 bit 6 is
   * set through the $38 mirror (which writes attr3 alone). Both cores zero attr4 on the 4-byte write
   * (zxnext-sprites.c zxnextSpritesWritePort57: `zxnextSpriteAttributes[sprite][4] = 0`; SpriteDevice.ts
   * writeSpriteAttribute clears scale / 4-bit / Y8), so the sprite stays 16 x 16.
   */
  it("a 4-byte write leaves attr4 in place: setting attr3 bit 6 again brings the old attr4 back", async () => {
    const s = await spriteSession();
    s.out(0x303b, 0x00);
    fill5b(s, 256, 1);
    s.out(0x303b, 0x00);
    attrs(s, 100, 100, 0x00, 0xc0, 0x0a); // --- 5 bytes: 32 x 32
    s.out(0x303b, 0x00);
    attrs(s, 100, 100, 0x00, 0x80); // --- 4 bytes: attr4 untouched
    s.setNextReg(0x34, 0x00).setNextReg(0x38, 0xc0); // --- attr3 bit 6 again, attr4 not written
    s.runFrames(2);
    expect(area(s, 100, 100, 32, 32), "the kept attr4 scales it again").toBe(hex8(C1));
  });

  /*
   * $09 bit 4 ties $34 and $303B (mirror_tie_i). ~609-611, ~663: with the tie, when $57 moves on to the
   * next sprite (attr_num_change) mirror_sprite_q follows, so $34 reads it (zxnext.vhd ~5978).
   */
  it("with the tie, $34 follows $57 moving on to the next sprite; without it, it does not", async () => {
    const s = await spriteSession();
    s.setNextReg(0x09, 0x10);
    s.out(0x303b, 0x03);
    expect(s.readNextReg(0x34), "after $303B").toBe(0x03);
    attrs(s, 0, 0, 0x00, 0x00); // --- 4-byte sprite 3
    expect(s.readNextReg(0x34), "after a 4-byte sprite").toBe(0x04);
    attrs(s, 0, 0, 0x00, 0x40, 0x00); // --- 5-byte sprite 4
    expect(s.readNextReg(0x34), "after a 5-byte sprite").toBe(0x05);

    s.setNextReg(0x09, 0x00).setNextReg(0x34, 0x20);
    s.out(0x303b, 0x03);
    attrs(s, 0, 0, 0x00, 0x00);
    expect(s.readNextReg(0x34), "untied").toBe(0x20);
  });

  /*
   * ~605-608: a $75-$79 write increments mirror_sprite_q (7 bits, wrapping 127 -> 0) and raises
   * mirror_num_change; with the tie that reloads attr_index <= mirror & "000" (~655-656), so the next
   * $57 write goes to the new sprite. Without the tie $57 keeps its own index.
   */
  it("$75 advances the mirror sprite (127 wraps to 0); with the tie $57 follows it, without it does not", async () => {
    const s = await spriteSession();
    s.setNextReg(0x34, 0x7f).setNextReg(0x75, 0x00);
    expect(s.readNextReg(0x34), "127 + 1").toBe(0x00);

    // --- tied: $34 = $10, $75 -> $11; the next four $57 bytes are sprite $11
    s.setNextReg(0x09, 0x10).setNextReg(0x34, 0x10).setNextReg(0x75, 0x00);
    attrs(s, 100, 100, 0x00, 0x80);
    s.setNextReg(0x09, 0x00);
    s.runFrames(2);
    expect(area(s, 100, 100), "tied: a sprite shows").not.toBe(NONE);
    s.setNextReg(0x34, 0x11).setNextReg(0x38, 0x00).runFrames(1);
    expect(area(s, 100, 100), "tied: it was sprite $11").toBe(NONE);

    // --- untied: $303B = $20, then $34 = $10 and $75; the $57 bytes still go to sprite $20
    s.out(0x303b, 0x20);
    s.setNextReg(0x34, 0x10).setNextReg(0x75, 0x00);
    attrs(s, 140, 100, 0x00, 0x80);
    s.runFrames(1);
    expect(area(s, 140, 100), "untied: a sprite shows").not.toBe(NONE);
    s.setNextReg(0x34, 0x20).setNextReg(0x38, 0x00).runFrames(1);
    expect(area(s, 140, 100), "untied: it was sprite $20").toBe(NONE);
  });

  /*
   * With the tie a mirror sprite change reloads both CPU indices (~655-656, ~735-736): attr_index <=
   * mirror(6:0) & "000", pattern_index <= mirror(5:0) & mirror(7) & "0000000" - the pattern is the
   * sprite number's low 6 bits. A $75-$79 increment keeps the half: mirror(7) <= pattern_index(7) (~607).
   * $34 = $BF: sprite $3F, pattern 63 second half; $75 -> sprite $40, pattern $40(5:0) = 0, second half.
   */
  it("with the tie, $75 moves $57 to the next sprite and $5B to pattern (sprite & 63), keeping the half", async () => {
    const s = await spriteSession();
    s.out(0x303b, 0x00);
    fill5b(s, 256, 3); // --- pattern 0 all index 3
    s.setNextReg(0x09, 0x10).setNextReg(0x34, 0xbf).setNextReg(0x75, 0x00);
    expect(s.readNextReg(0x34), "$34 after $75").toBe(0x40);
    fill5b(s, 128, 1); // --- pattern 0, second half (rows 8-15)
    attrs(s, 100, 100, 0x00, 0x80 | 0); // --- sprite $40
    s.setNextReg(0x09, 0x00);
    s.runFrames(2);
    expect(area(s, 100, 100, 16, 8), "pattern 0 rows 0-7 untouched").toBe(hex8(C3));
    expect(area(s, 100, 108, 16, 8), "pattern 0 rows 8-15 written after $75").toBe(hex8(C1));
    s.setNextReg(0x34, 0x40).setNextReg(0x38, 0x00).runFrames(1);
    expect(area(s, 100, 100), "the attributes went to sprite $40").toBe(NONE);
  });

  /*
   * $76-$79 write attribute bytes 1-4 of the mirror sprite and advance it (zxnext.vhd ~4836-4853, ~4894:
   * nr_sprite_mirror_inc = we and nr_wr_reg(6)); the pattern is read through them in one pass.
   */
  it("$75-$79 write attributes 0-4 of consecutive sprites", async () => {
    const s = await spriteSession();
    s.out(0x303b, 0x00);
    for (let i = 0; i < 256; i++) s.out(0x005b, 1);
    // --- sprite 8 through $35-$38 then $79 (attr4: X scale 2x) -> advances to 9
    s.setNextReg(0x34, 0x08);
    s.setNextReg(0x35, 100).setNextReg(0x36, 100).setNextReg(0x37, 0x00).setNextReg(0x38, 0xc0).setNextReg(0x79, 0x08);
    expect(s.readNextReg(0x34), "$79 advanced").toBe(0x09);
    // --- sprites 9-12: each register once, from the same start
    s.setNextReg(0x34, 0x09).setNextReg(0x76, 60); // --- sprite 9 attr1 (Y)
    s.setNextReg(0x34, 0x09).setNextReg(0x77, 0x00); // --- attr2
    s.setNextReg(0x34, 0x09).setNextReg(0x75, 20); // --- attr0 (X)
    s.setNextReg(0x34, 0x09).setNextReg(0x78, 0x80); // --- attr3: visible, 4-byte
    expect(s.readNextReg(0x34), "$78 advanced").toBe(0x0a);
    s.runFrames(2);
    expect(area(s, 100, 100, 32, 16), "sprite 8, 32 wide from $79").toBe(hex8(C1));
    expect(area(s, 132, 100), "sprite 8 is only 32 wide").toBe(NONE);
    expect(area(s, 20, 60), "sprite 9 from $75-$78").toBe(hex8(C1));
  });
});
