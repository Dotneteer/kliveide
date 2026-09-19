import { describe, expect, it } from "vitest";

import { ALL_CORES, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { parkedSession } from "../ula/_ula-helpers";

/*
 * The sprite status register, port $303B read. Replaces the hardware-visible parts of
 * test/zxnext/SpriteDevice-status.test.ts (which set the flags by poking SpriteDevice fields), the
 * $303B read cases of SpriteDevice.test.ts and the zero-on-top case of sprite-collision-scenarios.ts.
 *
 * `_input/next-fpga/src/video/sprites.vhd`:
 * - ~982-1011: status_reg_s bits 7-2 are 0; bit 1 |= sprites_overtime, bit 0 |= (spr_line_data_o(8)
 *   and spr_line_we): both sticky. Only a $303B read (port303b_r_en_s) clears them, copying them to
 *   status_reg_read, which the read returns (~750). No write - $303B, $57, $5B, NextRegs - touches them.
 * - ~979, ~1009: the collision term uses spr_line_we, not the zero-on-top gated spr_line_we_s.
 * - ~984-994: sprites_overtime is raised when a line's work outlasts the line; every pixel of a drawn
 *   sprite costs a clock (S_PROCESS), opaque or transparent.
 */

/** Pattern 0 opaque (index 5), pattern 1 transparent ($E3); every sprite hidden; $15 as given. */
async function statusSession(core: CoreName, nr15 = 0x03): Promise<NextTestSession> {
  const s = await parkedSession(core);
  s.setNextReg(0x4b, 0xe3);
  s.out(0x303b, 0x00);
  for (let i = 0; i < 256; i++) s.out(0x005b, 0x05);
  for (let i = 0; i < 256; i++) s.out(0x005b, 0xe3);
  s.out(0x303b, 0x00);
  for (let i = 0; i < 128 * 4; i++) s.out(0x0057, 0x00);
  s.setNextReg(0x15, nr15);
  return s;
}

/** Sprites 0 and 1, pattern 0, overlapping at (100, 100) / (108, 104). */
function overlap(s: NextTestSession): NextTestSession {
  s.out(0x303b, 0x00);
  for (const b of [100, 100, 0x00, 0x80, 108, 104, 0x00, 0x80]) s.out(0x0057, b);
  return s;
}

/** All 128 sprites on line 100, 128 pixels wide (X scale 8x): far more work than a line has time for. */
function heavy(s: NextTestSession, pattern: number): NextTestSession {
  s.out(0x303b, 0x00);
  for (let i = 0; i < 128; i++) s.out(0x0057, (i * 2) & 0xff).out(0x0057, 100).out(0x0057, 0).out(0x0057, 0xc0 | pattern).out(0x0057, 0x18);
  return s;
}

/** Hides every sprite. */
function hideAll(s: NextTestSession): NextTestSession {
  s.out(0x303b, 0x00);
  for (let i = 0; i < 128 * 4; i++) s.out(0x0057, 0x00);
  return s;
}

/** Writes to everything but a $303B read: the select port, both data ports, sprite NextRegs. */
function otherWrites(s: NextTestSession): NextTestSession {
  s.out(0x303b, 0x05).out(0x303b, 0x82);
  for (let i = 0; i < 16; i++) s.out(0x005b, 0x05);
  s.out(0x303b, 0x10);
  for (const b of [0, 0, 0, 0]) s.out(0x0057, b);
  s.setNextReg(0x34, 0x20).setNextReg(0x35, 0x00).setNextReg(0x75, 0x00).setNextReg(0x4b, 0xe3).setNextReg(0x19, 0x00);
  return s;
}

describe.each(ALL_CORES)("sprite status $303B - %s core", (core) => {
  it("a collision alone reads $01 (bits 7-2 zero); it stays set through writes and quiet frames until read", async () => {
    const s = await statusSession(core);
    expect(s.in(0x303b), "nothing yet").toBe(0x00);
    overlap(s).runFrames(2);
    // --- stop colliding, then write every sprite port and register and run quiet frames
    hideAll(s);
    otherWrites(s);
    s.runFrames(3);
    expect(s.in(0x303b), "sticky collision").toBe(0x01);
    expect(s.in(0x303b), "the read cleared it").toBe(0x00);
    s.runFrames(2);
    expect(s.in(0x303b), "not raised again without a new collision").toBe(0x00);
  });

  it("an overlong line alone reads $02: transparent pixels cost time but do not collide", async () => {
    const s = await statusSession(core);
    heavy(s, 1).runFrames(2); // --- pattern 1 is all transparent
    hideAll(s);
    otherWrites(s);
    s.runFrames(3);
    expect(s.in(0x303b), "sticky overtime").toBe(0x02);
    expect(s.in(0x303b), "the read cleared it").toBe(0x00);
    s.runFrames(2);
    expect(s.in(0x303b), "not raised again on quiet frames").toBe(0x00);
  });

  it("both flags read together as $03, and one read clears both", async () => {
    const s = await statusSession(core);
    heavy(s, 0).runFrames(2); // --- opaque: collisions and overtime
    hideAll(s).runFrames(1);
    expect(s.in(0x303b)).toBe(0x03);
    expect(s.in(0x303b)).toBe(0x00);
  });

  it("the flag comes back when a collision happens again after a read", async () => {
    const s = await statusSession(core);
    overlap(s).runFrames(2);
    expect(s.in(0x303b) & 0x01).toBe(0x01);
    s.runFrames(1); // --- the sprites still overlap: the next frame raises it again
    expect(s.in(0x303b) & 0x01).toBe(0x01);
  });

  it("with sprite 0 on top ($15 bit 6) a collision still sets the flag", async () => {
    // --- ~1009 takes spr_line_we, not the zero-on-top gated spr_line_we_s (~979)
    const s = await statusSession(core, 0x43);
    overlap(s).runFrames(2);
    expect(s.in(0x303b) & 0x01).toBe(0x01);
  });
});
