import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName } from "../../harness/zxnext";

/*
 * The ULA frame interrupt in the first frame after a reset (catalogue INT-020).
 *
 * Hardware: the ULA's hc/vc counters restart at 0 with the reset (zxula_timing.vhd) and the frame
 * interrupt is a pure compare against them (`int_n` at the timing's interrupt position, ~1968-1990 of
 * zxnext.vhd for the pulse length). Nothing gates the first frame, so a CPU that enables interrupts
 * before the position is interrupted in frame 0 like in any other frame.
 *
 * The program is ready with IM 2 and EI after ~30 T-states - well before the interrupt position of
 * every timing (the earliest, 48K, is at 7 MHz hc 124, 62 T-states in). The vector table and the
 * handler are poked in beforehand so no setup time is spent.
 */
describe.each(ALL_CORES)("first-frame interrupt - %s core", (core: CoreName) => {
  it("INT-020: the ULA frame interrupt ends a HALT already in frame 0 after a hard reset", async () => {
    const s = await createSession(core);
    const program = await s.loadCode(`
        .org $8000
Start:  ld a,$b0
        ld i,a
        im 2
        ei
        halt
AfterHalt:
        jr AfterHalt
    `);
    // --- IM 2 vector table at $B000 (the bus reads $FF in pulse mode: any entry), handler at $B2B2
    s.poke(0xb000, new Uint8Array(257).fill(0xb2));
    s.poke(0xb2b2, [0x3e, 0x01, 0x32, 0x00, 0xc0, 0xfb, 0xed, 0x4d]); // ld a,1 / ld ($c000),a / ei / reti
    s.poke(0xc000, 0x00);
    expect(s.frames, "the program starts in frame 0").toBe(0);

    s.runTo(program.symbol("AfterHalt"), { maxFrames: 3 });
    expect(s.peek(0xc000), "the handler ran").toBe(0x01);
    expect(s.frames, "interrupted in the first frame").toBe(0);
  });
});
