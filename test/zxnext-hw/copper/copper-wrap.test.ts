import { describe, expect, it } from "vitest";

import { ALL_CORES, next8ToHex, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { parkedSession } from "../ula/_ula-helpers";

/*
 * The copper's execution address wraps from instruction 1023 to 0 (ported from "Step 5: Wrap-around" of
 * test/zxnext/CopperDevice.test.ts, which ticked the device by hand; the *write* address wrap is COP-003
 * in copper-control.test.ts).
 *
 * Hardware (device/copper.vhd):
 * - ~48, ~95, ~108: `copper_list_addr_s` is a 10-bit counter incremented by every MOVE (NOPs included)
 *   and every WAIT that matches, so after instruction 1023 the copper fetches instruction 0 again.
 *   Nothing stops it at the end of the list: in modes 01 and 10 a list without a HALT runs forever.
 * - ~91-94: WAIT advances when vcount = line and hcount >= H * 8 + 12, so WAIT(50, 0) at instruction 0
 *   holds the copper at line 50 of every frame.
 * - ~98-104: MOVE 0,0 is a NOP: no write, but the address moves on.
 * One instruction per 28 MHz tick: a pass of 1024 instructions takes well under one line, so the MOVE
 * after the WAIT runs again only once line 50 comes round again - in the next frame.
 *
 * The copper's line count wraps too (ported from "Step 7" of the same file: the $64 offset across the
 * totalVC wrap, and the offset applied to the mode-11 restart):
 * - video/zxula_timing.vhd ~455-472: cvc is loaded with $64 at the first paper line and counts on,
 *   wrapping to 0 after c_max_vc (48K 311, 128K/+3 310, Pentagon 319). So paper row r has copper line
 *   (r + $64) mod (c_max_vc + 1).
 * - copper.vhd ~79-83: mode 11 restarts the list at vcount = 0 and hcount = 0 - with a large $64 that
 *   is in the middle of the paper, at paper row c_max_vc + 1 - $64.
 */

const MOVE = (reg: number, value: number) => ((reg & 0x7f) << 8) | (value & 0xff);
const WAIT = (line: number, h = 0) => 0x8000 | ((h & 0x3f) << 9) | (line & 0x1ff);

function upload(s: NextTestSession, list: number[]): NextTestSession {
  s.setNextReg(0x62, 0x00).setNextReg(0x61, 0x00);
  for (const w of list) s.setNextReg(0x60, w >> 8).setNextReg(0x60, w & 0xff);
  return s;
}

/** 1024 instructions: WAIT line 50, MOVE $14,$5A, NOPs, and MOVE $4A,$77 in the last slot. */
function fullList(): number[] {
  const list = new Array<number>(1024).fill(MOVE(0, 0));
  list[0] = WAIT(50);
  list[1] = MOVE(0x14, 0x5a);
  list[1023] = MOVE(0x4a, 0x77);
  return list;
}

describe.each(ALL_CORES)("copper list wrap - %s core", (core: CoreName) => {
  for (const [mode, name] of [[0x40, "01"], [0x80, "10"]] as const) {
    it(`mode ${name}: a list without a HALT runs through instruction 1023 and starts again at 0`, async () => {
      const s = await parkedSession(core);
      upload(s, fullList()).setNextReg(0x14, 0xe3).setNextReg(0x4a, 0xe3);
      // --- the upload wrapped the write address to 0 as well; mode 10 starts at the current address (0)
      s.setNextReg(0x62, mode).runFrames(2);
      expect([s.readNextReg(0x14), s.readNextReg(0x4a)], "first pass, including the last slot").toEqual([0x5a, 0x77]);
      s.setNextReg(0x14, 0x33).setNextReg(0x4a, 0x33).runFrames(2);
      expect([s.readNextReg(0x14), s.readNextReg(0x4a)], "wrapped to instruction 0 and ran again").toEqual([0x5a, 0x77]);
    });
  }

  type Timing = { name: string; nr03: number; lines: number };
  const TIMINGS: Timing[] = [
    { name: "48K", nr03: 0x90, lines: 312 },
    { name: "+3", nr03: 0xb0, lines: 311 },
    { name: "Pentagon", nr03: 0xc0, lines: 320 }
  ];
  for (const t of TIMINGS) {
    it(`${t.name}: with $64 = 200 the copper line wraps in the paper; mode 11 restarts at the wrap`, async () => {
      const OFFSET = 200;
      const restartRow = t.lines - OFFSET; // --- cvc = 0
      const waitLine = 150 + OFFSET - t.lines; // --- copper line of paper row 150
      const s = await parkedSession(core);
      s.setNextReg(0x03, t.nr03).runFrames(2); // --- a timing change applies from the next frame
      // --- PAPER 0 = entry 16; the border (2 = entry 18) stays grey so the paper top can be found
      s.setNextReg(0x43, 0x00).setNextReg(0x40, 18).setNextReg(0x41, 0x49).setNextReg(0x14, 0xe3);
      s.poke(0x4000, new Array(0x1800).fill(0)).poke(0x5800, new Array(768).fill(0)).out(0xfe, 2);
      const RED = 0xe0;
      const BLACK = 0x00;
      const list = [MOVE(0x40, 16), MOVE(0x41, BLACK), WAIT(waitLine), MOVE(0x40, 16), MOVE(0x41, RED), 0xffff];
      upload(s, list).setNextReg(0x64, OFFSET).setNextReg(0x62, 0xc0).runFrames(3);
      const column = Array.from({ length: 288 }, (_, y) => s.pixel(360, y));
      const top = column.findIndex((c) => c !== column[0]);
      const at = (row: number) => s.pixel(360, top + row);
      expect(top, "paper top found").toBeGreaterThan(0);
      expect({
        beforeRestart: at(restartRow - 4),
        afterRestart: at(restartRow + 4),
        beforeWait: at(149),
        afterWait: at(151),
        last: at(191)
      }).toEqual({
        beforeRestart: next8ToHex(RED),
        afterRestart: next8ToHex(BLACK),
        beforeWait: next8ToHex(BLACK),
        afterWait: next8ToHex(RED),
        last: next8ToHex(RED)
      });
    });
  }
});
