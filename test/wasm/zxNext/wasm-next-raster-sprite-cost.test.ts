import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";

/*
 * The beam-racing raster re-renders the pixels the beam has drawn at every picture-changing port write,
 * including each byte written to the sprite ports $57/$5B. That partial render used to recompute the
 * sprite line-timing table for all 256 lines x 128 sprites (zxnextUlaComputeSpriteLineCuts) every
 * time, so a program streaming sprite attributes (ScrollNutter DMAs them every frame) ran at ~30 ms a
 * frame - below real time, and its movements looked half as fast as on the hardware (2026-09-18).
 * Relative, not absolute: frames with ~1000 sprite-port writes must not cost several times more than
 * the same frames without them.
 */
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
  const msPerFrame = async (writes: boolean) => {
    const s = await createSession("wasm");
    await s.loadCode(program(writes));
    s.runFrames(20);
    const t0 = performance.now();
    s.runFrames(100);
    return (performance.now() - t0) / 100;
  };

  it("sprite-port writes do not multiply the frame cost", async () => {
    const quiet = await msPerFrame(false);
    const busy = await msPerFrame(true);
    expect(busy / quiet, `${busy.toFixed(2)} vs ${quiet.toFixed(2)} ms a frame`).toBeLessThan(2.5);
  });
});
