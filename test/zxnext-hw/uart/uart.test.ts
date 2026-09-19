import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";
import { delay } from "../_timing-helpers";

/*
 * The two UARTs (catalogue UART-001 - UART-010).
 *
 * Hardware (`_input/next-fpga/src`):
 * - zxnext.vhd ~2595: the UART ports are A15-A11 = 00010, A10 xor (A9 and A8), low byte $3B, gated by
 *   internal port enable bit 12 ($83 bit 4); A9-A8 pick the register: 00 $143B RX, 01 $153B select,
 *   10 $163B frame, 11 $133B TX/status. ~3364: the UART's i_reset_hard is '0' ("hard_reset done by core
 *   load" - a $02 hard reset reboots the FPGA, zxnext_top ~1062), so a soft reset keeps the prescalers
 *   and frame registers.
 * - serial/uart.vhd: select bit 6; with bit 4 set, bits 2-0 go to the prescaler MSB of the UART bit 6
 *   selects; read "00000"/"01000" & MSB. $143B writes: bit 7 = 0 prescaler bits 6-0, bit 7 = 1 bits
 *   13-7 (reset 243: 115200 baud at 28 MHz); reads the RX FIFO (0 when empty). $163B stores all 8 bits
 *   (reset $18): bit 7 holds the FIFOs and both state machines in reset while set, bit 6 TX break, bit 5
 *   hardware flow control, 4-3 data bits, 2 parity enable, 1 odd, 0 two stop bits. $133B status: 7 RX
 *   break, 6 framing/parity error, 5 the error flag stored with the next RX byte, 4 TX empty (FIFO empty
 *   and transmitter idle), 3 RX near full, 2 RX overflow, 1 TX full, 0 RX available; the end of the
 *   read clears bits 6 and 2. RX FIFO 512 + one byte held while full (uart0_rx_avail_d; a byte arriving
 *   while one is held is the overflow), TX FIFO 64.
 * - serial/fifop.vhd: near full = at least 384 stored, almost full (RTR) = at least 510.
 * - serial/uart_tx.vhd: a byte takes (start + data + parity + stop bits) x prescaler 28 MHz clocks;
 *   break (bit 6) and reset (bit 7) keep it busy; with flow control it waits for CTS.
 * - serial/uart_rx.vhd: samples mid-bit, so a byte is available half a bit before its frame ends; a
 *   byte with a parity or stop-bit error is thrown away; a break (8 zero bits in the error state) is
 *   reported while the line stays low.
 * - zxnext.vhd ~1897: IM2 requests: UART n RX = near full or (available and not $C6 near-full-only bit),
 *   UART n TX = the TX FIFO empty (not the transmitter); vector index 1/2 RX, 12/13 TX. The request
 *   edge after a reset latches the TX empty status (im2_peripheral int_req_d is 0 in reset).
 *
 * The other end of the lines is the harness's UART peer (`uartSend`, `uartBreak`, `uartSetCts`,
 * `uartLoopback`, `uartOutput`, `uartReadyToReceive`).
 */

const TX = 0x133b;
const RX = 0x143b;
const SEL = 0x153b;
const FRAME = 0x163b;

/** Z80 code setting a UART's 17-bit prescaler through $153B (MSB) and $143B (the two LSB halves). */
function prescalerAsm(uart: 0 | 1, p: number): string {
  return `
        ld bc,$153b
        ld a,${(uart << 6) | 0x10 | (p >> 14)}
        out (c),a
        ld bc,$143b
        ld a,${p & 0x7f}
        out (c),a
        ld a,${0x80 | ((p >> 7) & 0x7f)}
        out (c),a`;
}

/** Z80 code selecting a UART and writing its frame register. */
function frameAsm(uart: 0 | 1, frame: number): string {
  return `
        ld bc,$153b
        ld a,${uart << 6}
        out (c),a
        ld bc,$163b
        ld a,${frame}
        out (c),a`;
}

/** A session with the CPU parked, for tests that drive the ports from outside. */
async function parked(): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(" .org $8000\n di\nPark: jr Park");
  return s;
}

type TxProbe = {
  /** Code run first (prescaler, frame, NextRegs). */
  setup?: string;
  /** Bytes written to $133B back to back (OUT (C),A, 12 T-states apart). */
  writes?: number;
  value?: number;
  /** Code after the OUTs, before the delay. */
  after?: string;
  /** The port the single IN reads after the delay. */
  read?: number;
};

/**
 * Hard reset, then: setup, `writes` OUTs to $133B, exactly `d` T-states, one IN of `read`. Both the OUTs
 * and the IN are fixed-length, so the delay at which a bit changes moves exactly with the UART's timing.
 */
async function probeTx(
  s: NextTestSession,
  d: number,
  { setup = "", writes = 1, value = 0x55, after = "", read = TX }: TxProbe
): Promise<number> {
  s.hardReset();
  await s.loadCode(`
        .org $8000
Start:  di
${setup}
        ld bc,$133b
        ld a,${value}
${"        out (c),a\n".repeat(writes)}
${after}
        ld bc,${read}
${delay(d)}
        in a,(c)
        ld ($9000),a
        nextreg $7f,$a5
Park:   jr Park`);
  s.setNextReg(0x7f, 0).runUntilReady(); // --- $7F has no reset branch: the last probe's $A5 survives
  return s.peek(0x9000);
}

/** The smallest d in (lo, hi] with pred(d) true, for a pred that is false at lo and true at hi. */
async function threshold(lo: number, hi: number, pred: (d: number) => Promise<boolean>): Promise<number> {
  if (await pred(lo)) throw new Error(`threshold: already true at ${lo}`);
  if (!(await pred(hi))) throw new Error(`threshold: still false at ${hi}`);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (await pred(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** The threshold is within 2 T-states of `expected` (the prescaler's 28 MHz clocks round to 1/8 T). */
async function expectThreshold(expected: number, pred: (d: number) => Promise<boolean>, what: string): Promise<void> {
  expect(await pred(Math.floor(expected) - 2), `${what}: not yet at ${Math.floor(expected) - 2}`).toBe(false);
  expect(await pred(Math.ceil(expected) + 2), `${what}: done at ${Math.ceil(expected) + 2}`).toBe(true);
}

const txEmpty = (s: NextTestSession, probe: TxProbe) => async (d: number) => ((await probeTx(s, d, probe)) & 0x10) !== 0;

/** Bit time of the base prescaler in T-states at 3.5 MHz (8 clocks of 28 MHz per T-state). */
const P = 800;
const BIT_T = P / 8;
const BASE = prescalerAsm(0, P);

/** The 8N1 threshold at prescaler 800 (measured once; every timing check is relative to it). */
let baseThreshold: number | undefined;
async function base(s: NextTestSession): Promise<number> {
  baseThreshold ??= await threshold(46, 1300, txEmpty(s, { setup: BASE }));
  return baseThreshold;
}

// ---------------------------------------------------------------------------------------------------
// IM2 scaffolding (as in interrupts/interrupts.test.ts)
// ---------------------------------------------------------------------------------------------------

const TABLE = 0xbe00;
const stub = (v: number) => 0xc000 + v * 8;

const LOG_LIB = `
LogA:   push hl
        ld hl,(LogPtr)
        ld (hl),a
        inc hl
        ld (LogPtr),hl
        pop hl
        ret
LogPtr: .defw Log
Log:    .defs 256
`;

function installVectors(s: NextTestSession): void {
  const common = s.symbol("Common");
  for (let v = 0; v < 256; v += 2) {
    s.pokeWord(TABLE + v, stub(v));
    s.poke(stub(v), [0x3e, v, 0xc3, common & 0xff, common >> 8]);
  }
}

const log = (s: NextTestSession) => {
  const start = s.symbol("Log");
  return Array.from(s.peekBytes(start, s.peekWord(s.symbol("LogPtr")) - start));
};

/**
 * Hardware IM2 mode ($C0 = $01: vector = index * 2), the ULA interrupt off, `$C6` = `c6`, then `body`.
 * Common logs the vector and runs `handler` (default: read one RX byte and log it).
 */
async function im2Session(c6: number, body = "", handler?: string): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(
    `
        .org $8000
Start:  di
        ld a,$be
        ld i,a
        im 2
        nextreg $c4,$00
        nextreg $c0,$01
        nextreg $c6,${c6}
${body}
        ei
        nextreg $7f,$a5
Park:   jr Park
Common: call LogA
${handler ?? "        ld bc,$143b\n        in a,(c)\n        call LogA"}
        ei
        reti
${LOG_LIB}`,
    { entry: "Start" }
  );
  installVectors(s);
  return s.runUntilReady();
}

const bytes = (n: number, first = 0) => Array.from({ length: n }, (_, i) => (first + i) & 0xff);

/** Reads $143B until the status says the RX FIFO is empty. */
function drain(s: NextTestSession): number[] {
  const out: number[] = [];
  while (s.in(TX) & 0x01) out.push(s.in(RX));
  return out;
}

describe("UART", () => {
  // -------------------------------------------------------------------------------------------------
  // UART-001 Select $153B
  // -------------------------------------------------------------------------------------------------

  it("UART-001: $153B bit 6 selects the UART; it reads back with that UART's prescaler MSB", async () => {
    const s = await parked();
    expect(s.in(SEL), "power-on").toBe(0x00);
    expect(s.out(SEL, 0x40).in(SEL), "UART 1: 01000 & MSB").toBe(0x40);
    expect(s.out(SEL, 0x00).in(SEL), "UART 0: 00000 & MSB").toBe(0x00);
    // --- Bit 4 writes bits 2-0 to the MSB of the UART that bit 6 of the SAME write selects
    expect(s.out(SEL, 0x55).in(SEL), "UART 1, MSB 5").toBe(0x45);
    expect(s.out(SEL, 0x00).in(SEL), "UART 0's MSB untouched").toBe(0x00);
    expect(s.out(SEL, 0x40).in(SEL), "UART 1's MSB kept").toBe(0x45);
    expect(s.out(SEL, 0x13).in(SEL), "UART 0, MSB 3").toBe(0x03);
    // --- Without bit 4 the MSB stays; bits 7, 5, 3 are not stored
    expect(s.out(SEL, 0xaf).in(SEL), "bit 4 clear").toBe(0x03);
    expect(s.out(SEL, 0xff).in(SEL), "UART 1, MSB 7").toBe(0x47);
  });

  it("UART-001: the frame, RX and status registers address the selected UART", async () => {
    const s = await parked();
    s.out(FRAME, 0x1b);
    expect(s.out(SEL, 0x40).in(FRAME), "UART 1 frame").toBe(0x18);
    s.out(FRAME, 0x1a);
    expect(s.out(SEL, 0x00).in(FRAME), "UART 0 frame").toBe(0x1b);
    s.uartSend(1, [0x99]).runFrames(1);
    expect(s.in(TX), "UART 0 status").toBe(0x10);
    expect(s.in(RX), "UART 0 RX").toBe(0x00);
    s.out(SEL, 0x40);
    expect(s.in(TX), "UART 1 status").toBe(0x11);
    expect(s.in(RX), "UART 1 RX").toBe(0x99);
  });

  it("UART-001: a soft reset selects UART 0 and keeps both prescaler MSBs", async () => {
    const s = await parked();
    s.out(SEL, 0x12).out(SEL, 0x53);
    s.reset();
    expect(s.in(SEL), "UART 0 selected, MSB 2").toBe(0x02);
    expect(s.out(SEL, 0x40).in(SEL), "UART 1 MSB 3").toBe(0x43);
    s.hardReset();
    expect(s.out(SEL, 0x40).in(SEL), "a hard reset reloads the core").toBe(0x40);
  });

  // -------------------------------------------------------------------------------------------------
  // UART-002 Baud prescaler (observed through the transmitter: the prescaler reads back only its MSB)
  // -------------------------------------------------------------------------------------------------

  it("UART-002: one bit lasts prescaler 28 MHz clocks; the default is 243 (115200 baud)", async () => {
    const s = await createSession();
    const b = await base(s);
    await expectThreshold(b - (10 * 400) / 8, txEmpty(s, { setup: prescalerAsm(0, 400) }), "prescaler 400");
    await expectThreshold(b + (10 * 800) / 8, txEmpty(s, { setup: prescalerAsm(0, 1600) }), "prescaler 1600");
    await expectThreshold(b - (10 * (P - 243)) / 8, txEmpty(s, {}), "power-on prescaler");
  });

  it("UART-002: $143B bit 7 picks the half of the 14-bit LSB it writes; $153B bit 4 the 3-bit MSB", async () => {
    const s = await createSession();
    const b = await base(s);
    // --- 800 = 6 * 128 + 32; bits 6-0 := $10 gives 784, bits 13-7 := 3 gives 416
    const low = `${BASE}\n        ld a,$10\n        out (c),a`;
    const high = `${BASE}\n        ld a,$83\n        out (c),a`;
    await expectThreshold(b - (10 * 16) / 8, txEmpty(s, { setup: low }), "bits 6-0 rewritten");
    await expectThreshold(b - (10 * 384) / 8, txEmpty(s, { setup: high }), "bits 13-7 rewritten");
    await expectThreshold(b + (10 * 16384) / 8, txEmpty(s, { setup: prescalerAsm(0, 16384 + P) }), "MSB 1");
    // --- A select write without bit 4 keeps the MSB
    const keep = `${prescalerAsm(0, 16384 + P)}\n        ld bc,$153b\n        ld a,$00\n        out (c),a`;
    await expectThreshold(b + (10 * 16384) / 8, txEmpty(s, { setup: keep }), "MSB kept");
  });

  it("UART-002: the prescaler belongs to the selected UART and survives a soft reset", async () => {
    const s = await createSession();
    const b = await base(s);
    // --- UART 1 set to 400, then UART 0 selected: UART 0 still has its power-on 243
    const other = `${prescalerAsm(1, 400)}\n        ld bc,$153b\n        ld a,$00\n        out (c),a`;
    await expectThreshold(b - (10 * (P - 243)) / 8, txEmpty(s, { setup: other }), "UART 1's prescaler");

    // --- 1600 set, soft reset, then the probe without setting it again
    const soft = async (d: number) => {
      s.hardReset();
      await s.loadCode(` .org $8000\n di\n${prescalerAsm(0, 1600)}\n nextreg $7f,$a5\n jr $`);
      s.setNextReg(0x7f, 0).runUntilReady().reset();
      await s.loadCode(`
        .org $8000
        di
        ld bc,$133b
        ld a,$55
        out (c),a
${delay(d)}
        in a,(c)
        ld ($9000),a
        nextreg $7f,$a5
        jr $`);
      s.setNextReg(0x7f, 0).runUntilReady();
      return (s.peek(0x9000) & 0x10) !== 0;
    };
    // --- This probe has no `ld bc` between the OUT and the delay: 10 T-states sooner
    await expectThreshold(b + (10 * 800) / 8 + 10, soft, "prescaler after a soft reset");
  });

  // -------------------------------------------------------------------------------------------------
  // UART-003 Status bits
  // -------------------------------------------------------------------------------------------------

  it("UART-003: TX empty until a byte is written; TX full with 64 queued behind the one sending", async () => {
    const s = await parked();
    expect(s.in(TX), "power-on").toBe(0x10);
    expect(s.out(SEL, 0x40).in(TX), "UART 1 power-on").toBe(0x10);
    s.out(SEL, 0x00);
    s.out(TX, 0);
    expect(s.in(TX), "one byte sending").toBe(0x00);
    for (let i = 1; i < 64; i++) s.out(TX, i);
    expect(s.in(TX), "63 queued").toBe(0x00);
    s.out(TX, 64);
    expect(s.in(TX), "64 queued: full").toBe(0x02);
    s.out(TX, 65); // --- dropped: the FIFO is full
    s.runFrames(2);
    expect(s.in(TX), "all sent").toBe(0x10);
    expect(s.uartOutput(0), "what the peer got").toEqual(bytes(65));
  });

  it("UART-003: the framing error and the byte's error flag; a status read clears bits 6 and 2", async () => {
    const s = await parked();
    s.uartSend(0, [{ value: 0x10, error: "framing" }, 0x41]).runFrames(1);
    // --- The bad frame is thrown away; the next byte is stored with the error flag (bit 5)
    expect(s.in(TX), "framing error, flagged byte available").toBe(0x71);
    expect(s.in(TX), "the read cleared the framing error").toBe(0x31);
    expect(s.in(RX), "the good byte").toBe(0x41);
    expect(s.in(TX), "empty").toBe(0x10);
    // --- A parity error only exists with parity on
    s.out(FRAME, 0x1c).uartSend(0, [{ value: 0x22, error: "parity" }, 0x43]).runFrames(1);
    expect(s.in(TX), "parity error").toBe(0x71);
    expect(s.in(RX)).toBe(0x43);
    s.out(FRAME, 0x18).uartSend(0, [{ value: 0x22, error: "parity" }]).runFrames(1);
    expect(s.in(TX), "no parity bit on the line: a good byte").toBe(0x11);
    expect(s.in(RX)).toBe(0x22);
  });

  // -------------------------------------------------------------------------------------------------
  // UART-004 Transmit timing
  // -------------------------------------------------------------------------------------------------

  it("UART-004: TX empty clears on the write and sets after start + data + parity + stop bits", async () => {
    const s = await createSession();
    const b = await base(s);
    const cases: Array<[frame: number, bits: number]> = [
      [0x10, 9], // 7N1
      [0x08, 8], // 6N1
      [0x00, 7], // 5N1
      [0x1c, 11], // 8E1
      [0x1e, 11], // 8O1
      [0x19, 11], // 8N2
      [0x1f, 12] // 8O2
    ];
    for (const [frame, bits] of cases) {
      await expectThreshold(b + (bits - 10) * BIT_T, txEmpty(s, { setup: `${BASE}\n${frameAsm(0, frame)}` }), `frame $${frame.toString(16)}`);
    }
    // --- The second OUT puts the delay 12 T-states later
    await expectThreshold(b + 10 * BIT_T - 12, txEmpty(s, { setup: BASE, writes: 2 }), "two bytes back to back");
  });

  it("UART-004: the peer gets the data bits of the frame; the baud rate does not follow the CPU speed", async () => {
    const s = await createSession();
    const sent = async (frame: number) => {
      s.hardReset();
      await s.loadCode(` .org $8000\n di\n${frameAsm(0, frame)}\n ld bc,$133b\n ld a,$ff\n out (c),a\n jr $`);
      s.runFrames(1);
      return s.uartOutput(0);
    };
    expect(await sent(0x18), "8 bits").toEqual([0xff]);
    expect(await sent(0x10), "7 bits").toEqual([0x7f]);
    expect(await sent(0x00), "5 bits").toEqual([0x1f]);

    // --- At 7 MHz a T-state is 4 clocks: 400 more prescaler clocks per bit are 1000 more T-states
    const at7 = (p: number) => txEmpty(s, { setup: ` nextreg $07,$01\n${prescalerAsm(0, p)}` });
    const b7 = await threshold(46, 2500, at7(400));
    await expectThreshold(b7 + 1000, at7(800), "7 MHz, prescaler 800");
  });

  // -------------------------------------------------------------------------------------------------
  // UART-005 Receive and FIFO
  // -------------------------------------------------------------------------------------------------

  it("UART-005: bytes from the peer arrive in order; $143B reads 0 when the FIFO is empty", async () => {
    const s = await parked();
    s.uartSend(0, [0x41, 0x42, 0x43]);
    expect(s.in(TX), "nothing on the line yet").toBe(0x10);
    s.runFrames(1);
    expect(s.in(TX), "RX available").toBe(0x11);
    expect([s.in(RX), s.in(RX), s.in(RX)]).toEqual([0x41, 0x42, 0x43]);
    expect(s.in(TX), "FIFO empty").toBe(0x10);
    expect(s.in(RX), "empty FIFO").toBe(0x00);
    // --- 7 data bits: the receiver right-aligns them
    s.out(FRAME, 0x10).uartSend(0, [0xff]).runFrames(1);
    expect(s.in(RX), "7-bit frame").toBe(0x7f);
  });

  it("UART-005: a byte is available half a bit before its frame ends (mid stop bit)", async () => {
    const s = await createSession();
    const arrived = (p: number) => async (d: number) => {
      s.hardReset();
      await s.loadCode(`
        .org $8000
Start:  di
${prescalerAsm(0, p)}
        ld bc,$133b
Probe:
${delay(d)}
        in a,(c)
        ld ($9000),a
        nextreg $7f,$a5
Park:   jr Park`);
      s.setNextReg(0x7f, 0).runTo("Probe").uartSend(0, [0x5a]).runUntilReady();
      return (s.peek(0x9000) & 0x01) !== 0;
    };
    const t400 = await threshold(46, 1000, arrived(400));
    await expectThreshold(t400 + (9.5 * 400) / 8, arrived(800), "prescaler 800 (9.5 bits more)");
  });

  it("UART-005: near full at 384 bytes; 512 in the FIFO plus one held; the next one overflows", async () => {
    const s = await parked();
    s.uartSend(0, bytes(383)).runFrames(3);
    expect(s.in(TX), "383 bytes").toBe(0x11);
    s.uartSend(0, [0x7f]).runFrames(1);
    expect(s.in(TX), "384: near full").toBe(0x19);
    s.uartSend(0, bytes(512 - 384 + 1 + 3, 384)).runFrames(2);
    // --- 512 stored, one held, the next arrives while it is held: overflow (its byte is lost)
    expect(s.in(TX), "overflow").toBe(0x1d);
    expect(s.in(TX), "the read cleared it").toBe(0x19);
    const got = drain(s);
    expect(got.length, "512 + the held one").toBe(513);
    expect(got, "in order").toEqual([...bytes(383), 0x7f, ...bytes(129, 384)]);
    expect(s.in(TX)).toBe(0x10);
  });

  it("UART-005: a byte received after an overflow carries the error flag", async () => {
    const s = await parked();
    s.uartSend(0, bytes(514)).runFrames(4);
    // --- Read the 513 bytes without a status read: the overflow stays latched
    for (let i = 0; i < 513; i++) s.in(RX);
    s.uartSend(0, [0x33]).runFrames(1);
    expect(s.in(TX), "flagged byte, overflow still set").toBe(0x35);
    expect(s.in(RX)).toBe(0x33);
    s.uartSend(0, [0x34]).runFrames(1);
    expect(s.in(TX), "the status read cleared the overflow").toBe(0x11);
  });

  it("UART-005: a wire from TX to RX brings the bytes back; UART 1 has its own lines", async () => {
    const s = await parked();
    s.uartLoopback(0, true);
    for (const c of "HELLO") s.out(TX, c.charCodeAt(0));
    s.runFrames(1);
    expect(String.fromCharCode(...drain(s))).toBe("HELLO");
    s.out(SEL, 0x40).out(TX, 0x31);
    s.runFrames(1);
    expect(s.uartOutput(1), "UART 1's peer").toEqual([0x31]);
    expect(s.in(TX), "UART 1 is not looped back").toBe(0x10);
  });

  // -------------------------------------------------------------------------------------------------
  // UART-006 Frame register
  // -------------------------------------------------------------------------------------------------

  it("UART-006: $163B reads back all 8 bits; a soft reset keeps it, a hard reset restores $18", async () => {
    const s = await parked();
    expect(s.in(FRAME), "power-on").toBe(0x18);
    expect(s.out(FRAME, 0x5b).in(FRAME)).toBe(0x5b);
    expect(s.out(FRAME, 0x9f).in(FRAME), "bit 7 is stored").toBe(0x9f);
    s.out(FRAME, 0x1b).reset();
    expect(s.in(FRAME), "soft reset").toBe(0x1b);
    s.hardReset();
    expect(s.in(FRAME), "hard reset").toBe(0x18);
  });

  it("UART-006: bit 7 holds both FIFOs and state machines in reset for as long as it is set", async () => {
    const s = await parked();
    s.uartSend(0, [1, 2, 3]).runFrames(1);
    expect(s.in(TX)).toBe(0x11);
    s.out(FRAME, 0x98);
    // --- In reset: the FIFOs are empty, and TX empty reads 0 (the transmitter reports busy)
    expect(s.in(TX), "in reset").toBe(0x00);
    s.out(TX, 0x33).uartSend(0, [4]).runFrames(1);
    expect(s.in(TX), "still in reset").toBe(0x00);
    s.out(FRAME, 0x18);
    expect(s.in(TX), "released: nothing kept").toBe(0x10);
    s.runFrames(1);
    expect(s.uartOutput(0), "the write was ignored").toEqual([]);
    expect(s.in(RX)).toBe(0x00);
    // --- A byte being sent is cut off
    s.out(TX, 0x44).out(FRAME, 0x98).out(FRAME, 0x18).runFrames(1);
    expect(s.uartOutput(0), "aborted").toEqual([]);
  });

  // -------------------------------------------------------------------------------------------------
  // UART-007 RX interrupt
  // -------------------------------------------------------------------------------------------------

  it("UART-007: $C6 bit 0 interrupts on a received byte (vector index 1)", async () => {
    const s = await im2Session(0x01);
    s.uartSend(0, [0x41]).runFrames(1);
    expect(log(s)).toEqual([0x02, 0x41]);
    // --- The handler empties the FIFO before the next byte arrives: every byte raises the level again
    s.uartSend(0, [0x42, 0x43]).runFrames(1);
    expect(log(s)).toEqual([0x02, 0x41, 0x02, 0x42, 0x02, 0x43]);
  });

  it("UART-007: the request is an edge of the level: bytes left in the FIFO raise no new one", async () => {
    const s = await im2Session(0x01, "", "");
    s.uartSend(0, [0x41, 0x42]).runFrames(1);
    expect(log(s), "the handler reads nothing").toEqual([0x02]);
    expect(drain(s)).toEqual([0x41, 0x42]);
    s.uartSend(0, [0x43]).runFrames(1);
    expect(log(s), "after the FIFO emptied").toEqual([0x02, 0x02]);
  });

  it("UART-007: with $C6 bit 1 only the near-full level (384 bytes) interrupts", async () => {
    const s = await im2Session(0x02);
    s.uartSend(0, [0x10]).runFrames(1);
    expect(log(s), "one byte").toEqual([]);
    s.uartSend(0, bytes(383, 0x11)).runFrames(3);
    expect(log(s), "384 bytes").toEqual([0x02, 0x10]);
  });

  it("UART-007: UART 1 interrupts with vector index 2 ($C6 bit 4)", async () => {
    const s = await im2Session(0x10, "        ld bc,$153b\n        ld a,$40\n        out (c),a");
    s.uartSend(1, [0x99]).uartSend(0, [0x98]).runFrames(1);
    expect(log(s)).toEqual([0x04, 0x99]);
  });

  it("UART-007: disabled, the request still latches $CA bits 1-0 (polled mode)", async () => {
    const s = await im2Session(0x00);
    s.uartSend(0, [0x41]).runFrames(1);
    expect(log(s)).toEqual([]);
    expect(s.readNextReg(0xca) & 0x33, "UART 0 RX status").toBe(0x03);
    s.setNextReg(0xca, 0x01);
    expect(s.readNextReg(0xca) & 0x33, "cleared").toBe(0x00);
    s.uartSend(0, [0x42]).runFrames(1);
    expect(s.readNextReg(0xca) & 0x33, "the level did not fall: no new edge").toBe(0x00);
    drain(s);
    s.uartSend(0, [0x43]).runFrames(1);
    expect(s.readNextReg(0xca) & 0x33, "a new edge").toBe(0x03);
    s.uartSend(1, [0x44]).runFrames(1);
    expect(s.readNextReg(0xca) & 0x33, "UART 1 RX: bits 5-4").toBe(0x33);
    s.setNextReg(0xca, 0x10);
    expect(s.readNextReg(0xca) & 0x33, "either bit clears both").toBe(0x03);
  });

  // -------------------------------------------------------------------------------------------------
  // UART-008 TX empty interrupt
  // -------------------------------------------------------------------------------------------------

  it("UART-008: a reset latches both TX empty status bits ($CA bits 6 and 2)", async () => {
    const s = await parked();
    expect(s.readNextReg(0xca), "power-on").toBe(0x44);
    s.setNextReg(0xca, 0x44);
    expect(s.readNextReg(0xca), "cleared").toBe(0x00);
    s.reset();
    expect(s.readNextReg(0xca), "soft reset").toBe(0x44);
  });

  it("UART-008: the request is the TX FIFO emptying, not the transmitter finishing", async () => {
    const s = await createSession();
    await s.loadCode(`
        .org $8000
Start:  di
        nextreg $ca,$44
        ld bc,$133b
        out (c),a
Park:   jr Park`);
    s.runTo("Park");
    // --- The transmitter takes the byte at once: the FIFO is empty again, the byte is still going out
    expect(s.readNextReg(0xca) & 0x44, "FIFO empty again at once").toBe(0x04);
    expect(s.in(TX) & 0x10, "still sending").toBe(0x00);

    // --- Three bytes, the status cleared after them (20 T-states): the FIFO empties when the third
    // --- starts, one byte time before TX empty sets. The two extra OUTs take 24 T-states.
    const b = await base(s);
    const select = ` ld bc,$243b\n ld a,$ca\n out (c),a\n${BASE}`;
    const intStatus = async (d: number) =>
      ((await probeTx(s, d, { setup: select, writes: 3, after: " nextreg $ca,$44", read: 0x253b })) & 0x04) !== 0;
    await expectThreshold(b + 10 * BIT_T - 24 - 20, intStatus, "status when the third byte starts");
    await expectThreshold(b + 20 * BIT_T - 24, txEmpty(s, { setup: BASE, writes: 3 }), "TX empty after the third");
  });

  it("UART-008: $C6 bit 2 / bit 6 interrupt with vector index 12 / 13", async () => {
    const s = await im2Session(0x04, "", "");
    s.out(TX, 0x55).runFrames(1);
    expect(log(s), "UART 0").toEqual([0x18]);
    const s1 = await im2Session(0x40, "        ld bc,$153b\n        ld a,$40\n        out (c),a", "");
    s1.out(TX, 0x55).runFrames(1);
    expect(log(s1), "UART 1").toEqual([0x1a]);
  });

  // -------------------------------------------------------------------------------------------------
  // UART-009 Break and hardware flow control
  // -------------------------------------------------------------------------------------------------

  it("UART-009: frame bit 6 holds TX in break: busy, nothing sent until released", async () => {
    const s = await parked();
    s.out(FRAME, 0x58);
    expect(s.in(TX), "break").toBe(0x00);
    s.out(TX, 0x66).runFrames(2);
    expect(s.uartOutput(0)).toEqual([]);
    s.out(FRAME, 0x18).runFrames(1);
    expect(s.uartOutput(0)).toEqual([0x66]);
    expect(s.in(TX)).toBe(0x10);
  });

  it("UART-009: a break on the RX line: framing error, then status bit 7 while it lasts", async () => {
    const s = await parked();
    s.uartBreak(0, true).runFrames(1);
    expect(s.in(TX), "break").toBe(0xd0);
    expect(s.in(TX), "framing error cleared, break still on").toBe(0x90);
    s.uartBreak(0, false).runFrames(1);
    expect(s.in(TX), "released").toBe(0x10);
    s.uartSend(0, [0x21]).runFrames(1);
    expect(s.in(RX), "the line works again").toBe(0x21);
  });

  it("UART-009: with flow control ($163B bit 5) the transmitter waits for the peer's CTS", async () => {
    const s = await parked();
    s.uartSetCts(0, false).out(FRAME, 0x38).out(TX, 0x77).runFrames(2);
    expect(s.uartOutput(0), "not clear to send").toEqual([]);
    expect(s.in(TX), "busy").toBe(0x00);
    s.uartSetCts(0, true).runFrames(1);
    expect(s.uartOutput(0)).toEqual([0x77]);
    // --- Without flow control CTS does not matter
    s.uartSetCts(0, false).out(FRAME, 0x18).out(TX, 0x78).runFrames(1);
    expect(s.uartOutput(0)).toEqual([0x77, 0x78]);
  });

  it("UART-009: with flow control RTR stops the peer at 510 bytes: no overflow", async () => {
    const s = await parked();
    s.out(FRAME, 0x38).uartSend(0, bytes(600)).runFrames(5);
    expect(s.uartReadyToReceive(0), "RTR").toBe(false);
    expect(s.in(TX), "near full, no overflow").toBe(0x19);
    const first = drain(s);
    expect(first).toEqual(bytes(510));
    expect(s.uartReadyToReceive(0)).toBe(true);
    s.runFrames(2);
    expect(drain(s)).toEqual(bytes(90, 510));
    expect(s.in(TX) & 0x04, "never overflowed").toBe(0);
    expect(s.out(FRAME, 0x18).uartReadyToReceive(0), "no flow control: always ready").toBe(true);
  });

  // -------------------------------------------------------------------------------------------------
  // UART-010 Port enable
  // -------------------------------------------------------------------------------------------------

  it("UART-010: with $83 bit 4 clear the four ports read $FF and ignore writes", async () => {
    const s = await parked();
    s.setNextReg(0x83, s.readNextReg(0x83) & ~0x10);
    expect([TX, RX, SEL, FRAME].map((p) => s.in(p))).toEqual([0xff, 0xff, 0xff, 0xff]);
    s.out(SEL, 0x40).out(FRAME, 0x1b).out(TX, 0x55).runFrames(1);
    s.setNextReg(0x83, s.readNextReg(0x83) | 0x10);
    expect(s.in(SEL), "select unchanged").toBe(0x00);
    expect(s.in(FRAME), "frame unchanged").toBe(0x18);
    expect(s.uartOutput(0), "nothing sent").toEqual([]);
  });
});
