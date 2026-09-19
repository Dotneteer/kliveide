import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName, type NextTestSession } from "../../harness/zxnext";

/*
 * Interrupt status in hardware IM2 mode, DMA break-in by CTC and NMI, and NextReg $02 bit 7
 * (catalogue INT-024 - INT-027). Ported from the hardware-visible cases of the device-level
 * `test/zxnext/InterruptDevice.test.ts` ("Reg $02", "Reg $c9 ... clears in HW IM2 mode too", "DMA
 * interrupt break-in request", "Reg $cc/$cd"); the rest of that file is covered by `interrupts.test.ts`,
 * `nextreg/read-mux.test.ts`, `nextreg/soft-reset.test.ts`, `ula/timex-port.test.ts` (port $FF bit 6),
 * `uart/uart.test.ts` ($C6/$CA/$CE) and `dma/dma.test.ts` (DMA-018, $CC bit 0).
 *
 * Hardware (`_input/next-fpga/src`):
 * - device/im2_peripheral.vhd: `int_status <= int_req or unq or (int_status and not clear)` latches every
 *   request edge, enabled or not; `im2_int_req` (the pending request) is set only by an *enabled* (or
 *   unqualified) request in hardware IM2 mode and cleared only by the RETI ending its service;
 *   `o_int_status <= int_status or im2_int_req`. So in hardware IM2 mode a write of 1 to $C9 clears a
 *   disabled channel's bit, while an enabled, pending one keeps reading 1.
 * - zxnext.vhd ~1897-1909: CTC 0-3 are requests 3-6; enables `ctc_int_en` ($C5 / control-word D7);
 *   status clear `nr_c9_we and nr_wr_dat`. ~1911: `im2_dma_int_en` has `nr_cd_dma_int_en_1` for the CTC.
 * - device/im2_device.vhd: `o_dma_int` is set while the device requests or is in service and its DMA
 *   enable is on. zxnext.vhd ~1955-1965: `im2_dma_delay <= im2_dma_int or (nmi_activated and
 *   nr_cc_dma_int_en_0_7) or (im2_dma_delay and dma_delay)` holds the DMA off at its next byte boundary so
 *   the CPU can take the interrupt / NMI; without it the CPU waits for the end of the transfer.
 * - zxnext.vhd ~3812-3842: a copper MOVE to $02 is an NMI request like a CPU write (`nmi_cu_02_we`).
 * - zxnext.vhd ~5097: $02 bit 7 is stored in `nr_02_bus_reset`, outside the reset branch (~4908-5090)
 *   of the NextReg process (only power-on initialises it); ~5837 reads it back as bit 7; ~1573 it only drives
 *   `o_RESET_PERIPHERAL`, which zxnext_top ~833 puts on the expansion bus reset pin - it does not reset
 *   the Next (the top's reset state machine, ~787-820, takes only soft/hard reset and a bus reset from
 *   outside).
 */

const CTC0 = 0x183b;
const TABLE = 0xbe00;

describe.each(ALL_CORES)("interrupt status and DMA break-in - %s core", (core: CoreName) => {
  // -------------------------------------------------------------------------------------------------
  // INT-024: $C9 in hardware IM2 mode
  // -------------------------------------------------------------------------------------------------

  it("INT-024: in hardware IM2 mode a disabled CTC channel's $C9 bit clears on a write; an enabled, pending one stays set", async () => {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n di\n jr $"); // --- DI: nothing is ever serviced
    s.setNextReg(0x22, 0x04).setNextReg(0xc0, 0x01).setNextReg(0xc5, 0x00).setNextReg(0xc9, 0xff);
    // --- channel 0: timer, prescaler 256, constant 0, no interrupt enable (D7 = 0)
    s.out(CTC0, 0x25).out(CTC0, 0x00).runFrames(1);
    s.out(CTC0, 0x03); // --- software reset without D2: stopped, no more zero counts
    expect(s.readNextReg(0xc9) & 0x01, "status latched while disabled").toBe(0x01);
    s.setNextReg(0xc9, 0x01);
    expect(s.readNextReg(0xc9) & 0x01, "not pending: the write clears it").toBe(0x00);

    // --- channel 1 with its enable: the request is pending (DI) and holds the bit
    s.out(0x193b, 0xa5).out(0x193b, 0x00).runFrames(1);
    s.out(0x193b, 0x03);
    expect(s.readNextReg(0xc9) & 0x02, "latched").toBe(0x02);
    s.setNextReg(0xc9, 0x02);
    expect(s.readNextReg(0xc9) & 0x02, "pending: still reads set").toBe(0x02);
  });

  // -------------------------------------------------------------------------------------------------
  // INT-025 / INT-026: DMA break-in
  // -------------------------------------------------------------------------------------------------

  /**
   * zxnDMA program (port $6B): a continuous 16K fill of $C000-$FFFF from the fixed byte `Fill` - 98304
   * T-states at 3.5 MHz, more than a frame. Loaded but not enabled.
   *   $83 disable; WR0 $7D A->B, port A address, length $4000; WR1 $24 port A memory fixed;
   *   WR2 $10 port B memory increment; WR4 $AD continuous, port B address $C000; WR5 $82; $CF load.
   */
  const DMA_SETUP = `
        ld hl,DmaTable
        ld b,DmaTableEnd-DmaTable
        ld c,$6b
        otir`;
  const DMA_TABLE = `
DmaTable:
        .defb $83, $7d
        .defw Fill
        .defw $4000
        .defb $24, $10, $ad
        .defw $c000
        .defb $82, $cf
DmaTableEnd:
Fill:   .defb $77`;

  /** Whether an interrupt / NMI handler ran while the fill was under way: $C000 written, $FFFF not yet. */
  const DURING = `
        ld a,(Armed)
        or a
        jr z,NotDuring
        ld a,($c000)
        cp $77
        jr nz,NotDuring
        ld a,($ffff)
        or a
        jr nz,NotDuring
        ld hl,(During)
        inc hl
        ld (During),hl
NotDuring:`;

  async function ctcDuringFill(cd: number) {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n di\n jr $");
    await s.loadCode(
      `
        .org $8000
Start:  di
        ld a,$be
        ld i,a
        im 2
        nextreg $c0,$a1          ; hardware IM2, vector base $A0
        nextreg $22,$04          ; ULA and line interrupts off
        nextreg $cc,$00
        nextreg $cd,$${cd.toString(16)}
        nextreg $c9,$ff
${DMA_SETUP}
        ld a,1
        ld (Armed),a
        ld bc,$183b
        ld a,$a5                 ; CTC 0: interrupt, timer, prescaler 256, constant follows
        out (c),a
        xor a                    ; constant 0: first zero count 8192 T-states from now
        out (c),a
        ld a,$87
        ld bc,$006b
        ei
        out (c),a                ; enable: the fill starts
        nop
        nop
        di
        nextreg $7f,$a5
        jr $
Isr:    push af
        push hl
${DURING}
        pop hl
        pop af
        ei
        reti
During: .defw 0
Armed:  .defb 0
${DMA_TABLE}`,
      { entry: "Start" }
    );
    for (let v = 0; v < 256; v += 2) s.pokeWord(TABLE + v, s.symbol("Isr"));
    s.poke(0xffff, 0).poke(0xc000, 0);
    s.runUntilReady({ maxFrames: 10 });
    return { during: s.peekWord(s.symbol("During")), filled: [s.peek(0xc000), s.peek(0xe000), s.peek(0xffff)] };
  }

  it("INT-025: without its $CD enable a CTC interrupt waits for the end of the DMA transfer", async () => {
    expect(await ctcDuringFill(0x00)).toEqual({ during: 0, filled: [0x77, 0x77, 0x77] });
  });

  /*
   * Parity finding, fixed 2026-09-19: the WASM core never breaks a DMA transfer for a CTC interrupt: its
   * `zxnextInterruptsDmaRequestActive` (zxnext-interrupts.c) looks only at the line and ULA bits of
   * $CC; the CTC ($CD) and UART ($CE) sources are not modelled. VHDL zxnext.vhd ~1911 puts
   * `nr_cd_dma_int_en_1` into `im2_dma_int_en` for requests 3-10 and ~1963 turns a pending, DMA-enabled
   * request into `im2_dma_delay`. The TS core does break in.
   */
  it("INT-025: with $CD bit 0 a CTC 0 interrupt breaks into the DMA transfer", async () => {
    const r = await ctcDuringFill(0x01);
    expect(r.during, "taken while the fill was under way").toBeGreaterThanOrEqual(1);
    expect(r.filled, "the transfer still completes").toEqual([0x77, 0x77, 0x77]);
  });

  it("INT-025: $CD bit 1 (CTC 1) does not let a CTC 0 interrupt in", async () => {
    expect(await ctcDuringFill(0x02)).toEqual({ during: 0, filled: [0x77, 0x77, 0x77] });
  });

  /**
   * A DivMMC NMI raised by a copper MOVE $02,$04 at line 100 while the CPU is off the bus: the fill is
   * started just after line 200 has begun, so line 100 comes ~211 lines (~48000 T-states) into it.
   */
  async function nmiDuringFill(cc: number) {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n di\n jr $");
    await s.loadCode(
      `
        .org $8000
Start:  di
        nextreg $cc,$${cc.toString(16)}
        nextreg $06,$10          ; DRIVE (DivMMC) NMI enable
        nextreg $62,$00          ; copper stopped, address 0
        nextreg $61,$00
        nextreg $60,$80          ; WAIT line 100, h 0
        nextreg $60,100
        nextreg $60,$02          ; MOVE $02,$04: DivMMC NMI
        nextreg $60,$04
        nextreg $60,$ff          ; HALT
        nextreg $60,$ff
${DMA_SETUP}
        ld a,1
        ld (Armed),a
        ld bc,$243b
        ld a,$1f
        out (c),a
        inc b
Line:   in a,(c)                 ; wait for line 200 (low byte of the raster line)
        cp 200
        jr nz,Line
        nextreg $62,$40          ; copper: from 0, once
        ld a,$87
        ld bc,$006b
        out (c),a                ; enable: the fill starts
        nop
        nop
        nextreg $7f,$a5
        jr $
NmiEntry:
        push af
        push hl
        ld a,1
        ld (Nmis),a
${DURING}
        pop hl
        pop af
        retn
During: .defw 0
Armed:  .defb 0
Nmis:   .defb 0
${DMA_TABLE}`,
      { entry: "Start" }
    );
    // --- RAM at $0000 (MMU0/1 = pages 40/41, DivMMC automap off) with jp NmiEntry at $0066
    s.setNextReg(0x0a, s.readNextReg(0x0a) & ~0x10).setNextReg(0x50, 40).setNextReg(0x51, 41);
    const entry = s.symbol("NmiEntry");
    s.poke(0x0066, [0xc3, entry & 0xff, entry >> 8]);
    s.poke(0xffff, 0).poke(0xc000, 0);
    s.runUntilReady({ maxFrames: 10 }).runFrames(1);
    return {
      nmi: s.peek(s.symbol("Nmis")),
      during: s.peekWord(s.symbol("During")),
      filled: [s.peek(0xc000), s.peek(0xe000), s.peek(0xffff)]
    };
  }

  it("INT-026: without $CC bit 7 an NMI waits for the end of the DMA transfer", async () => {
    expect(await nmiDuringFill(0x00)).toEqual({ nmi: 1, during: 0, filled: [0x77, 0x77, 0x77] });
  });

  /*
   * Parity finding, fixed 2026-09-19: neither core lets an NMI break into a DMA transfer: both store $CC bit 7 but
   * nothing reads it (TS `InterruptDevice.dmaInterruptRequestActive` and WASM
   * `zxnextInterruptsDmaRequestActive` look only at im2 sources). VHDL zxnext.vhd ~1963:
   * `im2_dma_delay <= im2_dma_int or (nmi_activated and nr_cc_dma_int_en_0_7) or ...`.
   */
  it("INT-026: with $CC bit 7 an NMI breaks into the DMA transfer", async () => {
    expect(await nmiDuringFill(0x80)).toEqual({ nmi: 1, during: 1, filled: [0x77, 0x77, 0x77] });
  });

  // -------------------------------------------------------------------------------------------------
  // INT-027: $02 bit 7
  // -------------------------------------------------------------------------------------------------

  /*
   * Parity finding, fixed 2026-09-19: the TS core clears $02 bit 7 on a soft reset; the WASM core keeps it as the VHDL
   * does (zxnext.vhd ~5095-5097: `nr_02_bus_reset` is assigned only in the `nr_wr_en` branch of a process
   * whose reset branch, ~4908-5090, does not assign it).
   */
  it("INT-027: $02 bit 7 (expansion bus reset) reads back, does not reset the Next, and survives a soft reset", async () => {
    const s = await createSession(core);
    await s.loadCode(`
        .org $8000
        di
Loop:   ld hl,($c000)
        inc hl
        ld ($c000),hl
        jr Loop`);
    s.pokeWord(0xc000, 0).runFrames(1);
    const type = s.readNextReg(0x02) & 0x03;
    s.setNextReg(0x02, 0x80);
    expect(s.readNextReg(0x02) & 0x80, "~5837: bit 7 reads nr_02_bus_reset").toBe(0x80);
    const before = s.peekWord(0xc000);
    s.runFrames(1);
    expect(s.registers().pc, "still in the program").toBeGreaterThanOrEqual(0x8000);
    expect(s.peekWord(0xc000), "still counting").toBeGreaterThan(before);
    expect(s.readNextReg(0x02) & 0x03, "no reset: the reset type is unchanged").toBe(type);
    s.reset();
    expect(s.readNextReg(0x02) & 0x80, "~5095: not in the reset branch").toBe(0x80);
    s.setNextReg(0x02, 0x00);
    expect(s.readNextReg(0x02) & 0x80, "written 0").toBe(0x00);
  });
});
