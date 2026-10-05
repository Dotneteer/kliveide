import { createHash } from "node:crypto";

import type { Sp128TestSession } from "../harness/sp128";

/*
 * A program that exercises everything the 128K/Pentagon timing touches, and a recorder that hashes
 * what it does frame by frame (`sp128-golden.test.ts`, `.plans/PENTAGON_128_PLAN.md` P7).
 */

/** The program; it runs from $8000 (bank 2, uncontended) with the ROM's IM 1 handler */
export const TIMING_EXERCISE = `
  .org #8000
start:
  di
  ld sp,#7ff0
  im 1
  ei
  ld e,0
main:
  halt
  ld b,32
stripe:
  ld a,b
  and 7
  out (#fe),a
  ld c,20
w1:
  dec c
  jr nz,w1
  djnz stripe
  ld hl,#4000
  ld b,0
fill:
  ld a,e
  add a,l
  ld (hl),a
  inc hl
  djnz fill
  ld hl,#5800
  ld b,64
attr:
  ld (hl),e
  inc hl
  djnz attr
  ld hl,fbsum
  ld b,200
fb:
  in a,(#ff)
  add a,(hl)
  ld (hl),a
  djnz fb
  ld a,e
  and #0f
  or #10
  ld bc,#7ffd
  out (c),a
  ld hl,#e000
  ld b,100
pg:
  ld a,(hl)
  add a,e
  ld (hl),a
  inc hl
  djnz pg
  ld bc,#fffd
  xor a
  out (c),a
  ld b,#bf
  ld a,e
  out (c),a
  ld b,#ff
  ld a,7
  out (c),a
  ld b,#bf
  ld a,#3e
  out (c),a
  ld b,#ff
  ld a,8
  out (c),a
  ld b,#bf
  ld a,15
  out (c),a
  ld b,50
bp:
  ld a,b
  and #10
  out (#fe),a
  djnz bp
  inc e
  jr main
fbsum:
  .defb 0
`;

const hash = (data: ArrayBufferView | string) =>
  createHash("sha1")
    .update(typeof data === "string" ? data : new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
    .digest("hex")
    .slice(0, 16);

/** Boots, runs the exercise and returns what the golden records */
export async function recordTimingExercise(s: Sp128TestSession, frames = 24) {
  s.runFrames(120);
  const program = await s.loadCode(TIMING_EXERCISE);
  s.machine.pc = program.entry;
  const m = s.machine;
  const perFrame: string[] = [];
  for (let i = 0; i < frames; i++) {
    s.runFrames(1);
    const audio = m.getAudioSamples().map((a) => `${a.left.toFixed(6)},${a.right.toFixed(6)}`).join(";");
    perFrame.push(
      [
        hash(m.getPixelBuffer()),
        hash(audio),
        m.tacts,
        m.totalContentionDelaySinceStart,
        s.frameTact(),
        JSON.stringify(s.cpu()),
        s.border(),
        JSON.stringify(s.paging())
      ].join("|")
    );
  }
  const banks = Array.from({ length: 8 }, (_, i) => hash(s.bank(i)));
  return { tactsInFrame: m.tactsInFrame, perFrame, banks, fbsum: s.peek(program.symbol("fbsum")) };
}

