import { describe, expect, it } from "vitest";

import { createTvcSession } from "../harness/tvc";
import { TvcKeyCode as K } from "@emu/machines/tvc/TvcKeyCode";
import { bareMachine, PAPER_TOP, pictureHash, pixel, RGB, writeShotIfAsked } from "./bare";

/*
 * Programs on the running machine (`.plans/VIDEOTON_TVC_PLAN.md` Phase 3's exit criteria). The
 * picture hashes were recorded after the pictures were checked by eye (`TVC_SHOTS_PNG=<dir>`): BASIC
 * echoes `print "hello"` and prints `hello` in lower case (its default), then `ok`.
 */

const PRINT_HELLO_SHA1 = "e18056599b0156487df6438a21a92b7509a886f2";

describe("TVC programs", () => {
  it('BASIC runs PRINT "HELLO" typed on the keyboard', async () => {
    const s = await createTvcSession();
    s.bootToBasic();
    const keys: (number | number[])[] = [K.P, K.R, K.I, K.N, K.T, K.Space, [K.Shift, K.N2], K.H, K.E, K.L, K.L, K.O, [K.Shift, K.N2], K.Return];
    for (const key of keys) s.pressKey(key);
    s.runFrames(20);
    await writeShotIfAsked(s, "print-hello");
    expect(await pictureHash(s)).toBe(PRINT_HELLO_SHA1);
  });

  it("an interrupt routine draws a border band that stays put frame after frame", async () => {
    const s = await createTvcSession();
    bareMachine(s, { halt: false });
    // --- 0000h: DI; IM 1; EI; loop: HALT; JR loop
    s.poke(0x0000, [0xf3, 0xed, 0x56, 0xfb, 0x76, 0x18, 0xfd]);
    // --- 0038h: border white (AAh: I, G, R, B in bits 7/5/3/1), wait about 6 lines, border black,
    // --- clear the interrupt flip-flop (OUT (07h)), return
    s.poke(0x0038, [0xf5, 0xc5, 0x3e, 0xaa, 0xd3, 0x00, 0x06, 0x5c, 0x10, 0xfe, 0xaf, 0xd3, 0x00, 0xd3, 0x07, 0xc1, 0xf1, 0xfb, 0xc9]);
    s.machine.pc = 0x0000;
    s.runFrames(5);
    const band = () => {
      // --- The bottom border (paper lines 240-263, picture rows 264-287) at x = 300
      const rows: number[] = [];
      for (let y = PAPER_TOP + 240; y < 288; y++) if (pixel(s, 300, y) === RGB.brightWhite) rows.push(y);
      return rows;
    };
    const first = band();
    await writeShotIfAsked(s, "border-band");
    // --- The interrupt comes at the end of the last paper line, so the band starts at the top of the bottom border
    expect(first.length).toBeGreaterThan(3);
    expect(first[0]).toBe(PAPER_TOP + 240);
    for (let i = 0; i < 5; i++) {
      s.runFrames(1);
      expect(band()).toEqual(first);
    }
  });

  it("reports the beam where the picture shows it: paper dot (0, 0) is drawn at frame tact 2", async () => {
    const s = await createTvcSession();
    bareMachine(s, { halt: false });
    const beam = s.machine.getBeamPosition();
    expect(beam.paperLeft).toBe(48);
    expect(beam.firstVisibleTact + PAPER_TOP * beam.tactsPerLine + 48 * beam.tactsPerBufferPixel).toBe(2);
  });
});
