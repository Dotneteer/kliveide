import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";

/*
 * Maskable-interrupt edge cases found while writing the interrupts chapter (catalogue INT-028, INT-029).
 *
 * Hardware (`vendor/next-fpga/3.02.01/src`):
 * - zxnext.vhd ~5272-5275: a NextReg $22 write stores only bit 1 (line interrupt enable) and bit 0 (line
 *   bit 8); bit 2 goes to the ULA disable (~3617). Bit 7 reads the pulse /INT (~5938) and is read-only:
 *   writing it raises no interrupt.
 * - device/im2_device.vhd ~124: S_ISR -> S_0 needs `i_reti_seen and i_iei and i_im2_mode`: a RETI executed
 *   while the CPU is not in IM 2 releases nothing, so the device stays in service and blocks itself and
 *   every device below it; a second request from it merges into the first (im2_peripheral.vhd ~167).
 */

describe("interrupt edge cases", () => {
  it("INT-028: writing NextReg $22 with bit 7 set raises no interrupt", async () => {
    const s = await createSession();
    await s.loadCode(`
        .org $8000
Start:  di
        ld a,$be
        ld i,a
        im 2
        nextreg $c0,$00          ; pulse mode
        nextreg $22,$84          ; bit 7 set, ULA interrupt off, line off
        ei
        ld bc,5000               ; about two frames
Wait:   dec bc
        ld a,b
        or c
        jr nz,Wait
        di
        nextreg $7f,$a5
Park:   jr Park
Isr:    push hl
        ld hl,(Count)
        inc hl
        ld (Count),hl
        pop hl
        ei
        reti
Count:  .defw 0
        .org $beff
        .defw Isr                ; IM 2 in pulse mode reads $BEFF
`, { entry: "Start" });
    s.runUntilReady({ maxFrames: 6 });
    expect(s.peekWord(s.symbol("Count")), "interrupts taken").toBe(0);
  });

  it("INT-029: a RETI while the CPU is in IM 1 leaves the device in service", async () => {
    const s = await createSession();
    await s.loadCode(`
        .org $8000
Start:  di
        ld a,$be
        ld i,a
        im 2
        nextreg $22,$04          ; ULA interrupt off
        nextreg $c0,$a1          ; hardware IM2, vectors from $A0
        ei
        nextreg $20,$01          ; CTC 0 request: vector $A6
        nop
        nop
        im 2
        nextreg $20,$01          ; again: CTC 0 is still in service
        nop
        nop
        di
        nextreg $7f,$a5
Park:   jr Park
Isr:    push hl
        ld hl,(Count)
        inc hl
        ld (Count),hl
        pop hl
        im 1                     ; leave IM 2 before the RETI
        ei
        reti
Count:  .defw 0
        .org $bea6
        .defw Isr
`, { entry: "Start" });
    s.runUntilReady({ maxFrames: 4 });
    expect(s.peekWord(s.symbol("Count")), "the second request is not taken").toBe(1);
  });
});
