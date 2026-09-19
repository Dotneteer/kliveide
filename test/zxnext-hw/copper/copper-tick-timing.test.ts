import { describe, expect, it } from "vitest";

import { ALL_CORES, next8ToHex, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { parkedSession } from "../ula/_ula-helpers";

/*
 * Copper instruction timing (ported from "Step 10: One-instruction-per-tick execution model" and the
 * MOVE timing of "Step 2" in test/zxnext/CopperDevice.test.ts, which counted calls of a tick method).
 *
 * Hardware (device/copper.vhd ~84-110, clocked by the 28 MHz clock):
 * - a NOP (MOVE with register 0) sets no write pulse, so the next instruction runs on the next tick:
 *   1 tick;
 * - any other MOVE sets copper_dout for one tick and the tick after it only clears it: 2 ticks.
 * - zxula_timing.vhd: hc counts at 7 MHz, so one tick is a quarter of an hc; the frame buffer has two
 *   pixels per hc (WAIT H fires at buffer x 96 + 16H), so one tick moves a raster effect half a pixel.
 *
 * Every list (mode 11): MOVE $40,16 ; MOVE $41,black ; WAIT(96, 0) ; <padding> ; MOVE $40,16 ;
 * MOVE $41,green ; HALT, on PAPER 0 (a $41 write moves the index on, hence the second $40). The
 * green starts on paper row 96 part-way across; the padding moves that edge right by (ticks / 2) buffer
 * pixels. Only the shift against the unpadded list is asserted, so the fixed MOVE and palette delays
 * cancel out.
 */

const MOVE = (reg: number, value: number) => ((reg & 0x7f) << 8) | (value & 0xff);
const WAIT = (line: number, h = 0) => 0x8000 | ((h & 0x3f) << 9) | (line & 0x1ff);
const NOP = 0x0000;
const GREEN = 0x1c;
const ROW = 48 + 96;

function upload(s: NextTestSession, list: number[]): NextTestSession {
  s.setNextReg(0x62, 0x00).setNextReg(0x61, 0x00);
  for (const w of list) s.setNextReg(0x60, w >> 8).setNextReg(0x60, w & 0xff);
  return s;
}

/** Buffer x of the first green pixel on paper row 96 with `padding` between the WAIT and the MOVE. */
async function edge(core: CoreName, padding: number[]): Promise<number> {
  const s = await parkedSession(core);
  s.setNextReg(0x43, 0x00).setNextReg(0x40, 16).setNextReg(0x41, 0x00).setNextReg(0x14, 0xe3);
  s.poke(0x4000, new Array(0x1800).fill(0)).poke(0x5800, new Array(768).fill(0)).out(0xfe, 7);
  const list = [MOVE(0x40, 0x10), MOVE(0x41, 0x00), WAIT(96), ...padding, MOVE(0x40, 0x10), MOVE(0x41, GREEN), 0xffff];
  upload(s, list).setNextReg(0x62, 0xc0).runFrames(3);
  const green = next8ToHex(GREEN);
  for (let x = 96; x < 608; x++) if (s.pixel(x, ROW) === green) return x;
  return -1;
}

describe.each(ALL_CORES)("copper tick timing - %s core", (core: CoreName) => {
  it("a NOP takes one 28 MHz tick, a MOVE two: padding shifts the edge by ticks / 2 buffer pixels", async () => {
    const base = await edge(core, []);
    expect(base, "edge found on the paper").toBeGreaterThanOrEqual(96);
    const shift = async (padding: number[]) => (await edge(core, padding)) - base;
    expect({
      nops200: await shift(new Array(200).fill(NOP)),
      nops400: await shift(new Array(400).fill(NOP)),
      moves100: await shift(new Array(100).fill(MOVE(0x4a, 0x00))),
      moves200: await shift(new Array(200).fill(MOVE(0x4a, 0x00)))
    }).toEqual({ nops200: 100, nops400: 200, moves100: 100, moves200: 200 });
  });
});
