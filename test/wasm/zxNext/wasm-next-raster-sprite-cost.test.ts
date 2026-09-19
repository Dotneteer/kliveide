import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * Guard for bug B80 (.plans/ZX_NEXT_EMULATOR_BUGS_HANDOVER.md).
 *
 * The beam-racing raster re-renders the pixels the beam has drawn at every picture-changing port write,
 * including each byte written to the sprite ports $57/$5B. That partial render used to recompute the
 * sprite line-timing table for all 256 lines x 128 sprites (zxnextUlaComputeSpriteLineCuts) every
 * time, so a program streaming sprite attributes (ScrollNutter DMAs them every frame) ran at ~30 ms a
 * frame - below real time, and its movements looked half as fast as on the hardware (2026-09-18).
 * Relative, not absolute: frames with ~1000 sprite-port writes must not cost several times more than
 * the same frames without them.
 *
 * The measure is wall-clock time, which other tests running in parallel disturb. So the two programs run
 * in two sessions side by side: each round times a slice of both back to back (alternating which goes
 * first), and the verdict is the median of the per-round ratios - a round that a busy moment slowed on
 * one side only moves one sample. The ratio is ~2.2 with the fix and ~9.6 with B80; the limit sits
 * between them with a factor of about 2 either way.
 */
const ROUNDS = 9;
const FRAMES_PER_SLICE = 10;
const MAX_RATIO = 4.5;

describe("ZX Next WASM raster - sprite port writes", () => {
  const program = (writes: boolean) => `
        .org $8000
        di
        nextreg $07,3              ; 28 MHz
        nextreg $15,$01            ; sprites visible
        ld bc,$303b
        xor a
        out (c),a                  ; sprite 0
        ld c,$57
        ld a,$80
        ld b,4
Attr:   out (c),a                  ; visible sprite 0 (attribute 3 = $80 on the 4th write)
        djnz Attr
Frame:  ld bc,$243b              ; once a frame: wait for raster line 0 ...
        ld a,$1f
        out (c),a
        inc b
Sync:   in a,(c)
        jr nz,Sync
        ld hl,1000                 ; ... then 1000 sprite-port writes, like a DMA upload
Loop:   ${writes ? "out ($57),a" : "nop\n        nop"}
        dec hl
        ld a,h
        or l
        jr nz,Loop
Next:   in a,(c)                   ; leave line 0 before waiting for the next one
        jr z,Next
        jr Frame
`;

  const session = async (writes: boolean): Promise<NextTestSession> => {
    const s = await createSession("wasm");
    await s.loadCode(program(writes));
    return s.runFrames(20); // --- warm-up: JIT, caches, the program past its setup
  };

  /** Milliseconds a frame over one slice. */
  const slice = (s: NextTestSession): number => {
    const t0 = performance.now();
    s.runFrames(FRAMES_PER_SLICE);
    return (performance.now() - t0) / FRAMES_PER_SLICE;
  };

  const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1];

  it("sprite-port writes do not multiply the frame cost (B80)", async () => {
    const quietSession = await session(false);
    const busySession = await session(true);
    const ratios: number[] = [];
    for (let round = 0; round < ROUNDS; round++) {
      let quiet: number;
      let busy: number;
      if (round % 2 === 0) {
        quiet = slice(quietSession);
        busy = slice(busySession);
      } else {
        busy = slice(busySession);
        quiet = slice(quietSession);
      }
      ratios.push(busy / quiet);
    }
    const ratio = median(ratios);
    expect(ratio, `median of ${ratios.map((r) => r.toFixed(2)).join(", ")}`).toBeLessThan(MAX_RATIO);
  });
});
