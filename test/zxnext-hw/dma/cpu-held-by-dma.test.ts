import { describe, expect, it } from "vitest";

import type { Z80CpuState } from "@common/messaging/EmuApi";

import { createSession } from "../../harness/zxnext";

/*
 * DMA-030: the CPU panel's "snoozed" flag while a DMA transfer holds the bus across a frame end.
 *
 * Hardware: a continuous zxnDMA transfer keeps BUSREQ asserted until its block is done (zxnext.vhd
 * ~5410-5460, dma.vhd), so the CPU executes nothing meanwhile - including across the frame boundary.
 * The machines stop the frame there without running an instruction and report the CPU as snoozed
 * (`getCpuState().snoozed`) until the next frame starts. That report is a host/debugger view rather
 * than a hardware signal, so this test reads it through the machine API (`s.machine.getCpuState()`),
 * deliberately, as the CPU panel does.
 *
 * The program starts a continuous 16K fill ($C000-$FFFF from a fixed byte): 16384 x 6 = 98304 T-states
 * at 3.5 MHz, longer than any frame, so the first frame ends with the DMA still holding the bus, and
 * the second one ends after it has finished.
 */
const PROGRAM = `
        .org $8000
Start:  di
        ld hl,DmaTable
        ld b,DmaTableEnd-DmaTable
        ld c,$6b
        otir
        ld a,$87                 ; enable: the fill starts
        ld bc,$006b
        out (c),a
Done:   jr Done
DmaTable:
        .defb $83, $7d
        .defw Fill
        .defw $4000
        .defb $24, $10, $ad
        .defw $c000
        .defb $82, $cf
DmaTableEnd:
Fill:   .defb $77`;

describe("CPU held by the DMA", () => {
  it("DMA-030: a transfer running across a frame end reports the CPU snoozed; after it, not", async () => {
    const s = await createSession();
    await s.loadCode(PROGRAM, { entry: "Start" });
    s.poke(0xc000, 0).poke(0xffff, 0);

    s.runFrames(1);
    expect((s.machine.getCpuState() as Z80CpuState).snoozed, "frame end inside the fill").toBe(true);
    expect([s.peek(0xc000), s.peek(0xffff)], "the fill is under way").toEqual([0x77, 0x00]);

    s.runFrames(1);
    expect([s.peek(0xc000), s.peek(0xffff)], "the fill is done").toEqual([0x77, 0x77]);
    expect((s.machine.getCpuState() as Z80CpuState).snoozed, "the CPU runs again").toBe(false);
  });
});
