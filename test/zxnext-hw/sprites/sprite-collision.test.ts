import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession } from "../../harness/zxnext";

/*
 * Sprite collision flag, driven only through the hardware interface on the real machine (both cores).
 *
 * Hardware (`_input/next-fpga/src/video/sprites.vhd`):
 *   status_reg_s(0) <= status_reg_s(0) or (spr_line_data_o(8) and spr_line_we)
 * - set when a sprite writes an opaque pixel where another sprite already wrote one; reading port
 * $303B returns and clears it. Four attribute bytes per sprite when attr3 bit 6 is 0.
 *
 * Replaces the engine-abstraction style of test/zxnext/sprite-collision-scenarios.ts: no
 * `completeFrame` stand-in - the frames run, and the program talks to the ports itself.
 */
describe.each(ALL_CORES)("sprites: collision flag - %s core", (core) => {
  const program = (secondX: number) => `
      .org $8000
      nextreg $15,$01          ; sprites visible, SLU
      ld bc,$303B
      xor a
      out (c),a                ; select pattern 0 / sprite 0
      ld bc,$005B
      ld d,0                   ; 256 pattern bytes, all opaque
      ld a,$E0
    Pattern:
      out (c),a
      dec d
      jr nz,Pattern
      ; --- sprite 0 at (64,64), sprite 1 at (${secondX},64); attr3 bit 7 = visible, pattern 0
      ld hl,Attrs
      ld bc,$0057
      ld d,8
    Attr:
      ld a,(hl)
      out (c),a
      inc hl
      dec d
      jr nz,Attr
      nextreg $7F,$A5
    Park:
      jr Park
    Attrs:
      .defb 64, 64, 0, $80
      .defb ${secondX}, 64, 0, $80
  `;

  it("is set when two opaque sprites overlap, and reading $303B clears it", async () => {
    const s = await createSession(core);
    await s.loadCode(program(72)); // --- 8 pixels to the right: they overlap
    s.runUntilReady().runFrames(2);
    expect(s.in(0x303b) & 0x01).toBe(1);
    expect(s.in(0x303b) & 0x01).toBe(0);
  });

  it("stays clear when the sprites do not overlap", async () => {
    const s = await createSession(core);
    await s.loadCode(program(96)); // --- 16-pixel sprites, 32 pixels apart
    s.runUntilReady().runFrames(2);
    expect(s.in(0x303b) & 0x01).toBe(0);
  });
});
