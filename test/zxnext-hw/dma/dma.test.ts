import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { delay } from "../_timing-helpers";
import { MASTER_CLOCK, side } from "../audio/_audio-helpers";
import { colours, hex8, writePalette } from "../ula/_ula-helpers";

/*
 * zxnDMA / Z80 DMA (catalogue DMA-001 - DMA-023).
 *
 * Hardware (`_input/next-fpga/src`):
 * - zxnext.vhd ~1729-1776: the DMA is clocked by `i_CLK_CPU` (the CPU clock, 3.5-28 MHz) with
 *   `turbo_i => cpu_speed`. `dma_mode` is latched from `port_0b_lsb` on every DMA port read or write:
 *   the last access through $0B makes it a Z80 DMA, through $6B a zxnDMA (it matters where the byte
 *   counter is initialised: $CF, $D3, auto restart).
 * - ~2599, ~2361, ~2396: ports $6B (internal port enable bit 5, `$82` bit 5) and $0B (bit 25, `$85`
 *   bit 1), low byte only. ~2724: the ports do not respond while the DMA holds the bus.
 * - ~1913, ~1955-1965: `im2_dma_delay` - an interrupt source enabled in `$CC`-`$CE` that is requesting
 *   or in service holds the DMA off at its next byte boundary, so the CPU can take the interrupt.
 * - device/dma.vhd:
 *   - Register writes. WR0 (D7 = 0, D1-D0 /= 00): D2 A->B, D3-D6 announce port A address lo/hi and block
 *     length lo/hi. Search (D1) is not implemented: every WR0 is a transfer. WR1 (D7 = 0, D2-D0 = 100)
 *     and WR2 (000): D3 I/O, D5-D4 address mode (00 decrement, 01 increment, 1x fixed), D6 timing byte
 *     follows; its D1-D0 cycle length, D5 one more byte - port A's is swallowed, port B's is the
 *     zxnDMA prescaler. WR3 (D7 = 1, D1-D0 = 00): D6 enables, D3/D4 announce mask/match (swallowed).
 *     WR4 (01): D6-D5 mode (00 byte, 01 continuous, 10 burst), D2/D3 announce port B address lo/hi; D4
 *     (interrupt control) only matters without D2/D3, and then the write sequencer enters a state
 *     with no handler: every later write is ignored until reset. WR5 (D7-D6 = 10, D2-D0 = 010): D5
 *     auto restart. WR6 (D1-D0 = 11): commands.
 *   - Commands: $C3 reset (idle, status reset, timings "01", prescaler 0, CE/WAIT and auto restart
 *     off - addresses, length, mode and read mask stay), $C7/$CB port timing reset, $CF load (addresses
 *     from the start registers by direction, counter 0 or $FFFF by mode, end-of-block cleared), $D3
 *     continue (counter only, end-of-block cleared), $87 enable, $83 disable, $BB read mask follows,
 *     $A7 initialise the read sequence, $BF next read is the status, $8B reinitialise the status.
 *     $AF/$AB/$A3/$B7/$B3 do nothing.
 *   - Transfer: a byte is a read cycle then a write cycle of 2/3/4 clocks each (timing byte, "01" = 3
 *     after reset): 6 CPU clocks a byte by default. The counter counts up from its load value and the
 *     transfer continues while counter < block length after each byte: a zxnDMA moves `length` bytes,
 *     a Z80 DMA `length` + 1, and length 0 moves one byte in both modes.
 *   - Prescaler: `DMA_timer_s` adds 8/4/2/1 per CPU clock at 3.5/7/14/28 MHz (28 MHz units) and restarts
 *     at each byte; after the write the DMA waits while prescaler > timer / 32, i.e. 32 x prescaler
 *     clocks of 28 MHz (875 kHz / prescaler) from one byte to the next. Burst mode releases the bus
 *     while it waits; continuous and byte mode keep it. Without a prescaler every mode keeps the bus.
 *   - Status byte = "00" & end_of_block_n & "1101" & at_least_one. `at_least_one` is cleared whenever
 *     the DMA is idle, so it reads 1 only while a transfer is under way.
 *   - Read sequence: status, counter lo, counter hi, port A lo, port A hi, port B lo, port B hi - the
 *     entries enabled in the read mask ($7F after reset), in that order, cyclically. Port A/B read
 *     port A's/B's current address whatever the direction.
 */

// ---------------------------------------------------------------------------------------------------
// Scaffolding
// ---------------------------------------------------------------------------------------------------

const ZXN = 0x6b;
const Z80 = 0x0b;

const ENABLE = 0x87;
const DISABLE = 0x83;
const LOAD = 0xcf;
const CONTINUE = 0xd3;
const RESET = 0xc3;
const READ_STATUS = 0xbf;
const INIT_READ = 0xa7;
const REINIT_STATUS = 0x8b;
const READ_MASK = 0xbb;

/** Status bytes: end of block not reached / reached, and a byte transferred in the current run. */
const STATUS_IDLE = 0x3a;
const STATUS_DONE = 0x1a;
const STATUS_RUNNING = 0x3b;

type AddrMode = "inc" | "dec" | "fixed";
const ADDR_MODE: Record<AddrMode, number> = { dec: 0, inc: 1, fixed: 2 };
const OP_MODE = { byte: 0, continuous: 1, burst: 2 };

interface Transfer {
  a: number;
  b: number;
  len: number;
  /** Direction B -> A (default A -> B). */
  bToA?: boolean;
  aMode?: AddrMode;
  bMode?: AddrMode;
  aIo?: boolean;
  bIo?: boolean;
  mode?: keyof typeof OP_MODE;
  prescaler?: number;
  restart?: boolean;
}

const lo = (v: number) => v & 0xff;
const hi = (v: number) => (v >> 8) & 0xff;

/** WR0-WR5 for a transfer, then LOAD. Not enabled. */
function setup(x: Transfer): number[] {
  const wr0 = 0x79 | (x.bToA ? 0 : 0x04);
  const wr1 = 0x04 | (x.aIo ? 0x08 : 0) | (ADDR_MODE[x.aMode ?? "inc"] << 4);
  const wr2 = (x.bIo ? 0x08 : 0) | (ADDR_MODE[x.bMode ?? "inc"] << 4) | (x.prescaler ? 0x40 : 0);
  const wr2Follow = x.prescaler ? [0x21, x.prescaler] : []; // --- timing "01" (the reset value), prescaler follows
  const wr4 = 0x8d | (OP_MODE[x.mode ?? "continuous"] << 5); // --- port B address lo and hi follow
  const wr5 = 0x82 | (x.restart ? 0x20 : 0);
  return [DISABLE, wr0, lo(x.a), hi(x.a), lo(x.len), hi(x.len), wr1, wr2, ...wr2Follow, wr4, lo(x.b), hi(x.b), wr5, LOAD];
}

/** Writes bytes to a DMA port from outside (the CPU parked). */
const write = (s: NextTestSession, bytes: number[], port = ZXN) => {
  for (const b of bytes) s.out(port, b);
  return s;
};

const reads = (s: NextTestSession, n: number, port = ZXN) => Array.from({ length: n }, () => s.in(port));

/** The whole default read sequence (after $A7): status, counter, port A, port B. */
function readBack(s: NextTestSession, port = ZXN) {
  s.out(port, INIT_READ);
  const r = reads(s, 7, port);
  return { status: r[0], counter: r[1] | (r[2] << 8), a: r[3] | (r[4] << 8), b: r[5] | (r[6] << 8) };
}

const status = (s: NextTestSession, port = ZXN) => s.out(port, READ_STATUS).in(port);

async function parked(core: CoreName): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(" .org $8000\n di\nPark: jr Park");
  return s;
}

/** Numbered source bytes 1, 2, 3, ... at `addr`. */
const numbered = (s: NextTestSession, addr: number, n: number) => s.poke(addr, Array.from({ length: n }, (_, i) => (i + 1) & 0xff));

/** A table of bytes as assembler source, and the code sending it to a port with OTIR. */
const table = (label: string, bytes: number[]) => `${label}: .defb ${bytes.map((b) => `$${b.toString(16)}`).join(",")}\n${label}End:`;
const otir = (label: string, port = ZXN) => `
        ld hl,${label}
        ld b,${label}End-${label}
        ld c,$${port.toString(16)}
        otir`;

/**
 * A program that sends `bytes` (a setup) to the DMA, then enables it at `Enable`; `Done` follows one
 * NOP later. `between` runs after the enable. Returns the session, not yet run.
 */
async function enableProgram(core: CoreName, bytes: number[], opts: { speed?: number; between?: string; extra?: string } = {}) {
  const s = await createSession(core);
  await s.loadCode(" .org $8000\n di\nPark: jr Park");
  await s.loadCode(
    `
        .org $8000
Start:  di
        nextreg $07,${opts.speed ?? 0}
${otir("Setup")}
        ld a,$87
        ld bc,$006b
Enable: out (c),a                ; 12
After:  nop                      ; 4
Done:
${opts.between ?? ""}
        nextreg $7f,$a5
        jr $
${table("Setup", bytes)}
${opts.extra ?? ""}`,
    { entry: "Start" }
  );
  return s;
}

/** CPU tacts from the start of the enabling OUT to `Done`, minus the OUT (12) and the NOP (4). */
function timeEnable(s: NextTestSession): number {
  s.runTo("Enable");
  const t0 = s.tacts;
  s.runTo("Done");
  return s.tacts - t0 - 16;
}

// ---------------------------------------------------------------------------------------------------

describe.each(ALL_CORES)("DMA - %s core", (core: CoreName) => {
  // --- DMA-001: the two ports --------------------------------------------------------------------------

  for (const [port, name, moved] of [
    [ZXN, "$6B (zxnDMA)", 4],
    [Z80, "$0B (Z80 DMA)", 5]
  ] as const) {
    it(`DMA-001: through ${name} a block length of 4 moves ${moved} bytes`, async () => {
      const s = await parked(core);
      numbered(s, 0xc000, 8);
      write(s, [...setup({ a: 0xc000, b: 0xc100, len: 4 }), ENABLE], port).runFrames(1);
      expect(Array.from(s.peekBytes(0xc100, 6))).toEqual([1, 2, 3, 4, 5, 6].map((v, i) => (i < moved ? v : 0)));
    });
  }

  it("DMA-001: the mode is the port of the last access - a load through $0B counts from $FFFF", async () => {
    const s = await parked(core);
    numbered(s, 0xc000, 8);
    const bytes = setup({ a: 0xc000, b: 0xc100, len: 4 });
    write(s, bytes.slice(0, -1)); // --- everything but LOAD through $6B
    write(s, [LOAD], Z80).out(ZXN, ENABLE).runFrames(1); // --- $87 does not touch the counter
    expect(Array.from(s.peekBytes(0xc100, 6)), "Z80 load: 5 bytes").toEqual([1, 2, 3, 4, 5, 0]);

    const t = await parked(core);
    numbered(t, 0xc000, 8);
    write(t, bytes.slice(0, -1), Z80);
    write(t, [LOAD]).out(Z80, ENABLE).runFrames(1);
    expect(Array.from(t.peekBytes(0xc100, 6)), "zxnDMA load: 4 bytes").toEqual([1, 2, 3, 4, 0, 0]);
  });

  // --- DMA-002: WR0 and the read-back --------------------------------------------------------------------

  it("DMA-002: after a load the read sequence gives status, counter, port A and port B", async () => {
    const s = await parked(core);
    write(s, setup({ a: 0x1234, b: 0x5678, len: 0x10 }));
    expect(reads(s, 8), "from reset: status first, mask $7F").toEqual([STATUS_IDLE, 0, 0, 0x34, 0x12, 0x78, 0x56, STATUS_IDLE]);
    write(s, setup({ a: 0x1234, b: 0x5678, len: 0x10, bToA: true }));
    expect(readBack(s), "B -> A: still port A's and port B's address").toEqual({ status: STATUS_IDLE, counter: 0, a: 0x1234, b: 0x5678 });
    write(s, setup({ a: 0x4321, b: 0x8765, len: 0x10 }), Z80);
    expect(readBack(s, Z80), "a Z80 DMA loads the counter with $FFFF").toEqual({ status: STATUS_IDLE, counter: 0xffff, a: 0x4321, b: 0x8765 });
  });

  // --- DMA-003 - DMA-005: memory to memory ----------------------------------------------------------------

  it("DMA-003: memory to memory copies 256 bytes; the source is unchanged", async () => {
    const s = await parked(core);
    const data = Array.from({ length: 256 }, (_, i) => (i * 37 + 11) & 0xff);
    s.poke(0xc000, data);
    write(s, [...setup({ a: 0xc000, b: 0xd000, len: 256 }), ENABLE]).runFrames(1);
    expect(Array.from(s.peekBytes(0xd000, 256)), "destination").toEqual(data);
    expect(Array.from(s.peekBytes(0xc000, 256)), "source").toEqual(data);
    expect(s.peek(0xd100), "no byte beyond the block").toBe(0);
    expect(readBack(s), "counter = length, both addresses past the block").toEqual({ status: STATUS_DONE, counter: 256, a: 0xc100, b: 0xd100 });
  });

  it("DMA-004: decrementing addresses copy downwards; an overlapping move up is correct", async () => {
    const s = await parked(core);
    const data = Array.from({ length: 256 }, (_, i) => (i * 13 + 5) & 0xff);
    s.poke(0xc000, data);
    write(s, [...setup({ a: 0xc0ff, b: 0xd0ff, len: 256, aMode: "dec", bMode: "dec" }), ENABLE]).runFrames(1);
    expect(Array.from(s.peekBytes(0xd000, 256)), "same bytes").toEqual(data);
    expect(readBack(s)).toEqual({ status: STATUS_DONE, counter: 256, a: 0xbfff, b: 0xcfff });
    // --- move $C000-$C0FF up by 16 bytes, from the top down
    write(s, [...setup({ a: 0xc0ff, b: 0xc10f, len: 256, aMode: "dec", bMode: "dec" }), ENABLE]).runFrames(1);
    expect(Array.from(s.peekBytes(0xc010, 256)), "moved").toEqual(data);
    // --- increment one side, decrement the other: reversed
    write(s, [...setup({ a: 0xc010, b: 0xd2ff, len: 256, bMode: "dec" }), ENABLE]).runFrames(1);
    expect(Array.from(s.peekBytes(0xd200, 256)), "reversed").toEqual([...data].reverse());
  });

  it("DMA-005: a fixed source fills; a fixed destination keeps the last byte", async () => {
    const s = await parked(core);
    s.poke(0xc000, 0xa5);
    write(s, [...setup({ a: 0xc000, b: 0xd000, len: 256, aMode: "fixed" }), ENABLE]).runFrames(1);
    expect(Array.from(s.peekBytes(0xd000, 257))).toEqual([...new Array(256).fill(0xa5), 0]);
    expect(readBack(s).a, "port A did not move").toBe(0xc000);
    numbered(s, 0xc100, 8);
    write(s, [...setup({ a: 0xc100, b: 0xd200, len: 8, bMode: "fixed" }), ENABLE]).runFrames(1);
    expect(Array.from(s.peekBytes(0xd200, 2))).toEqual([8, 0]);
  });

  // --- DMA-006 / DMA-007: I/O ------------------------------------------------------------------------

  it("DMA-006: memory to I/O writes every byte to the port - the AY register keeps the last", async () => {
    const s = await parked(core);
    s.poke(0xc000, [0x11, 0x22, 0x33, 0x44]).out(0xfffd, 0x00); // --- AY register 0 (8 bits)
    write(s, [...setup({ a: 0xc000, b: 0xbffd, len: 4, bIo: true, bMode: "fixed" }), ENABLE]).runFrames(1);
    expect(s.out(0xfffd, 0x00).in(0xfffd)).toBe(0x44);
  });

  it("DMA-007: I/O to memory reads the port repeatedly", async () => {
    const s = await parked(core);
    s.out(0xfffd, 0x00).out(0xbffd, 0x5a).out(0xfffd, 0x00);
    write(s, [...setup({ a: 0xfffd, b: 0xd000, len: 16, aIo: true, aMode: "fixed" }), ENABLE]).runFrames(1);
    expect(Array.from(s.peekBytes(0xd000, 17))).toEqual([...new Array(16).fill(0x5a), 0]);
  });

  // --- DMA-008: operating modes ------------------------------------------------------------------------

  /**
   * After the enable, the CPU counts loop passes (35 T-states each) until the last destination byte
   * arrives. A prescaled 16-byte block lasts about 16 x 400 T-states.
   */
  async function passesDuringTransfer(mode: keyof typeof OP_MODE, prescaler: number) {
    const s = await enableProgram(core, [...setup({ a: 0xc000, b: 0xd000, len: 16, mode, prescaler })], {
      between: `
        ld hl,0
Wait:   inc hl                   ; 6
        ld a,($d00f)             ; 13
        or a                     ; 4
        jr z,Wait                ; 12
        ld (Passes),hl`,
      extra: "Passes: .defw 0"
    });
    s.poke(0xc000, new Array(16).fill(0xee));
    s.runUntilReady();
    return s.peekWord(s.symbol("Passes"));
  }

  it("DMA-008: burst mode gives the bus back to the CPU while the prescaler waits", async () => {
    expect(await passesDuringTransfer("burst", 100)).toBeGreaterThan(100);
  });

  it("DMA-008: continuous and byte mode keep the bus, prescaler or not", async () => {
    expect(await passesDuringTransfer("continuous", 100), "continuous").toBe(1);
    expect(await passesDuringTransfer("byte", 100), "byte").toBe(1);
    expect(await passesDuringTransfer("burst", 0), "burst without a prescaler").toBe(1);
  });

  // --- DMA-009: prescaler ----------------------------------------------------------------------------

  it("DMA-009: with prescaler 100 a byte moves every 400 T-states at 3.5 MHz (875 kHz / 100)", async () => {
    // --- continuous: the CPU waits for the whole block; one byte = 4 x 100 T-states + 2 clocks
    const s = await enableProgram(core, setup({ a: 0xc000, b: 0xd000, len: 20, prescaler: 100 }));
    const t = timeEnable(s);
    expect(t, `${t} T-states for 20 bytes`).toBeGreaterThanOrEqual(20 * 400);
    expect(t).toBeLessThanOrEqual(20 * 404 + 20);
  });

  it("DMA-009: burst mode paces at the same rate while the CPU runs", async () => {
    // --- read the byte counter after 40000 T-states of CPU time plus what the DMA took
    const s = await enableProgram(core, [...setup({ a: 0xc000, b: 0xd000, len: 1000, mode: "burst", prescaler: 100 }), READ_MASK, 0x06], {
      between: `${delay(40000)}
Read:   in a,(c)                 ; counter lo (c = $6B)
        ld (Count),a
        in a,(c)
        ld (Count+1),a`,
      extra: "Count: .defw 0"
    });
    s.runTo("Enable");
    const t0 = s.tacts;
    s.runTo("Read");
    const elapsed = s.tacts - t0;
    s.runUntilReady();
    const count = s.peekWord(s.symbol("Count"));
    expect(count, `${count} bytes in ${elapsed} T-states`).toBeGreaterThanOrEqual(Math.floor(elapsed / 412));
    expect(count).toBeLessThanOrEqual(Math.ceil(elapsed / 400) + 1);
  });

  it("DMA-009: the prescaler counts 28 MHz time, so at 28 MHz a byte takes 32 x prescaler CPU clocks", async () => {
    const s = await enableProgram(core, setup({ a: 0xc000, b: 0xd000, len: 20, prescaler: 100 }), { speed: 3 });
    const t = timeEnable(s);
    expect(t, `${t} T-states at 28 MHz`).toBeGreaterThanOrEqual(20 * 3200);
    expect(t).toBeLessThanOrEqual(20 * 3220 + 40);
  });

  // --- DMA-010 - DMA-013: commands -------------------------------------------------------------------

  it("DMA-010: $83 stops a transfer where it is; $87 carries on from there", async () => {
    const s = await enableProgram(core, [...setup({ a: 0xc000, b: 0xd000, len: 64, mode: "burst", prescaler: 100 }), READ_MASK, 0x02], {
      between: `${delay(8000)}
        ld a,$83
        out (c),a                ; disable
        in a,(c)
        ld (Stop1),a
${delay(8000)}
        in a,(c)
        ld (Stop2),a
        ld a,$87
        out (c),a                ; enable again
${delay(40000)}`,
      extra: "Stop1: .defb 0\nStop2: .defb 0"
    });
    const data = Array.from({ length: 64 }, (_, i) => i + 1);
    s.poke(0xc000, data);
    s.runUntilReady();
    const stop1 = s.peek(s.symbol("Stop1"));
    expect(stop1, "part of the block").toBeGreaterThan(5);
    expect(stop1).toBeLessThan(40);
    expect(s.peek(s.symbol("Stop2")), "nothing moved while disabled").toBe(stop1);
    expect(Array.from(s.peekBytes(0xd000, 65)), "the whole block, once").toEqual([...data, 0]);
    expect(s.out(ZXN, INIT_READ).in(ZXN), "counter").toBe(64);
  });

  it("DMA-011: $CF loads the start addresses and clears the counter and end of block", async () => {
    const s = await parked(core);
    write(s, [...setup({ a: 0xc000, b: 0xd000, len: 32 }), ENABLE]).runFrames(1);
    expect(readBack(s)).toEqual({ status: STATUS_DONE, counter: 32, a: 0xc020, b: 0xd020 });
    s.out(ZXN, LOAD);
    expect(readBack(s)).toEqual({ status: STATUS_IDLE, counter: 0, a: 0xc000, b: 0xd000 });
  });

  it("DMA-012: $D3 restarts the counter but keeps the addresses", async () => {
    const s = await parked(core);
    numbered(s, 0xc000, 64);
    write(s, [...setup({ a: 0xc000, b: 0xd000, len: 16 }), ENABLE]).runFrames(1);
    write(s, [CONTINUE]);
    expect(readBack(s), "after $D3").toEqual({ status: STATUS_IDLE, counter: 0, a: 0xc010, b: 0xd010 });
    write(s, [ENABLE]).runFrames(1);
    expect(Array.from(s.peekBytes(0xd000, 33)), "the next 16 bytes").toEqual([...Array.from({ length: 32 }, (_, i) => i + 1), 0]);
    // --- a Z80 DMA continues with the counter at $FFFF: one byte more
    write(s, [CONTINUE, ENABLE], Z80).runFrames(1);
    expect(Array.from(s.peekBytes(0xd020, 18)), "Z80: 17 bytes").toEqual([...Array.from({ length: 17 }, (_, i) => i + 33), 0]);
  });

  it("DMA-013: with auto restart (WR5 D5) the block repeats from the start addresses", async () => {
    const s = await parked(core);
    s.poke(0xc000, [1, 2, 3, 4]);
    write(s, [...setup({ a: 0xc000, b: 0xd000, len: 4, mode: "burst", prescaler: 50, restart: true }), ENABLE]).runFrames(1);
    expect(Array.from(s.peekBytes(0xd000, 5)), "first blocks").toEqual([1, 2, 3, 4, 0]);
    s.poke(0xc000, [5, 6, 7, 8]).runFrames(1);
    expect(Array.from(s.peekBytes(0xd000, 5)), "restarted with the new source").toEqual([5, 6, 7, 8, 0]);
    expect(status(s) & 0x20, "the end of block stays reached").toBe(0);
  });

  // --- DMA-014 / DMA-015: status and read sequence ---------------------------------------------------

  it("DMA-014: status $3A idle, $3B while a transfer is under way, $1A at its end, $3A after $8B", async () => {
    const s = await parked(core);
    expect(s.in(ZXN), "after reset").toBe(STATUS_IDLE);
    write(s, [...setup({ a: 0xc000, b: 0xd000, len: 8, mode: "burst", prescaler: 255 }), ENABLE]);
    expect(status(s), "loaded, enabled, nothing moved").toBe(STATUS_IDLE);
    s.step(3);
    expect(status(s), "between bytes").toBe(STATUS_RUNNING);
    s.runFrames(1);
    expect(status(s), "block done").toBe(STATUS_DONE);
    s.out(ZXN, REINIT_STATUS);
    expect(status(s), "$8B").toBe(STATUS_IDLE);
    write(s, [ENABLE]).runFrames(1);
    s.out(ZXN, LOAD);
    expect(status(s), "$CF").toBe(STATUS_IDLE);
  });

  it("DMA-015: $BB sets the read mask; reads cycle through the enabled entries", async () => {
    const s = await parked(core);
    write(s, setup({ a: 0x1234, b: 0x5678, len: 0x10 }));
    write(s, [READ_MASK, 0x06]);
    expect(reads(s, 5), "counter lo, hi").toEqual([0, 0, 0, 0, 0]);
    write(s, [READ_MASK, 0x18]);
    expect(reads(s, 3), "port A lo, hi").toEqual([0x34, 0x12, 0x34]);
    write(s, [INIT_READ]);
    expect(reads(s, 2), "$A7 starts at the first enabled entry").toEqual([0x34, 0x12]);
    write(s, [READ_MASK, 0x61]);
    expect(reads(s, 4), "status, port B lo, hi").toEqual([STATUS_IDLE, 0x78, 0x56, STATUS_IDLE]);
    write(s, [READ_MASK, 0x00]);
    expect(reads(s, 2), "an empty mask reads the status").toEqual([STATUS_IDLE, STATUS_IDLE]);
  });

  it("DMA-015: $BF makes the next read the status, then the sequence carries on through the mask", async () => {
    const s = await parked(core);
    write(s, setup({ a: 0x1234, b: 0x5678, len: 0x10 }));
    write(s, [READ_MASK, 0x7f]);
    expect(reads(s, 4)).toEqual([STATUS_IDLE, 0, 0, 0x34]);
    write(s, [READ_STATUS]);
    expect(reads(s, 3)).toEqual([STATUS_IDLE, 0, 0]);
  });

  // --- DMA-016: reset --------------------------------------------------------------------------------

  it("DMA-016: $C3 stops a transfer and resets the status", async () => {
    const s = await parked(core);
    write(s, [...setup({ a: 0xc000, b: 0xd000, len: 200, mode: "burst", prescaler: 255 }), ENABLE]);
    s.step(3);
    write(s, [RESET]);
    const at = readBack(s).counter;
    expect(at, "stopped early").toBeLessThan(200);
    s.runFrames(2);
    expect(readBack(s)).toEqual({ status: STATUS_IDLE, counter: at, a: 0xc000 + at, b: 0xd000 + at });
  });

  it("DMA-016: $C3 clears auto restart and the prescaler but keeps addresses, length and read mask", async () => {
    const s = await parked(core);
    s.poke(0xc000, [1, 2, 3, 4]);
    write(s, [...setup({ a: 0xc000, b: 0xd000, len: 4, mode: "burst", prescaler: 50, restart: true }), ENABLE]);
    s.runFrames(1);
    write(s, [RESET]);
    s.poke(0xc000, [5, 6, 7, 8]).poke(0xd000, [0, 0, 0, 0]);
    // --- same block again: no prescaler left, so burst mode keeps the bus - the CPU sees it done
    write(s, [LOAD, ENABLE]).step(1);
    expect(Array.from(s.peekBytes(0xd000, 5)), "the kept block, at once").toEqual([5, 6, 7, 8, 0]);
    s.poke(0xc000, [9, 9, 9, 9]).runFrames(2);
    expect(Array.from(s.peekBytes(0xd000, 4)), "no restart").toEqual([5, 6, 7, 8]);
  });

  it("DMA-016: $C3 keeps the read mask", async () => {
    const s = await parked(core);
    write(s, setup({ a: 0x1234, b: 0x5678, len: 0x10 }));
    write(s, [READ_MASK, 0x18, RESET]);
    expect(reads(s, 3)).toEqual([0x34, 0x12, 0x34]);
  });

  // --- DMA-017: the CPU while the DMA has the bus ----------------------------------------------------

  it("DMA-017: a continuous 256-byte copy stops the CPU for 6 T-states a byte at 3.5 MHz", async () => {
    const s = await enableProgram(core, setup({ a: 0xc000, b: 0xd000, len: 256 }));
    const t = timeEnable(s);
    expect(t, `${t} T-states`).toBeGreaterThanOrEqual(256 * 6);
    expect(t).toBeLessThanOrEqual(256 * 6 + 12);
  });

  it("DMA-017: 2-cycle timing (port timing bytes D1-D0 = 10) makes a byte 4 T-states", async () => {
    // --- WR1 / WR2 with timing bytes $02
    const bytes = [DISABLE, 0x7d, 0x00, 0xc0, 0x00, 0x01, 0x54, 0x02, 0x50, 0x02, 0xad, 0x00, 0xd0, 0x82, LOAD];
    const s = await enableProgram(core, bytes);
    const t = timeEnable(s);
    expect(t, `${t} T-states`).toBeGreaterThanOrEqual(256 * 4);
    expect(t).toBeLessThanOrEqual(256 * 4 + 12);
  });

  // --- DMA-018: interrupts during a transfer ---------------------------------------------------------

  /**
   * A 16K continuous fill (98304 T-states: more than a frame) with the ULA interrupt on in hardware
   * IM2 mode, started right after a frame interrupt. The handler counts the interrupts it takes after
   * the enable and before the last byte ($FFFF) is written.
   */
  async function interruptsDuringFill(cc: number) {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n di\nPark: jr Park");
    await s.loadCode(
      `
        .org $8000
Start:  di
        ld a,$be
        ld i,a
        im 2
        nextreg $c0,$a1          ; hardware IM2
        nextreg $22,$00          ; ULA interrupt on, line interrupt off
        nextreg $cc,$${cc.toString(16)}
${otir("Setup")}
        ei
        halt                     ; frame start: the next ULA interrupt is a frame away
        ld a,1
        ld (Armed),a
        ld a,$87
        ld bc,$006b
        out (c),a
        nop
        nop
        di
        nextreg $7f,$a5
        jr $
Isr:    push af
        push hl
        ld a,(Armed)
        or a
        jr z,IsrOut
        ld a,($ffff)
        or a
        jr nz,IsrOut
        ld hl,(During)
        inc hl
        ld (During),hl
IsrOut: pop hl
        pop af
        ei
        reti
During: .defw 0
Armed:  .defb 0
Fill:   .defb $77
${table("Setup", setup({ a: 0, b: 0xc000, len: 0x4000, aMode: "fixed" }))}`,
      { entry: "Start" }
    );
    // --- port A = Fill: patch the address bytes of WR0 in the table
    const fill = s.symbol("Fill");
    s.poke(s.symbol("Setup") + 2, [fill & 0xff, fill >> 8]);
    for (let v = 0; v < 256; v += 2) s.pokeWord(0xbe00 + v, s.symbol("Isr"));
    s.poke(0xffff, 0);
    s.runUntilReady({ maxFrames: 10 });
    return { during: s.peekWord(s.symbol("During")), filled: [s.peek(0xc000), s.peek(0xe000), s.peek(0xffff)] };
  }

  it("DMA-018: without its $CC-$CE enable an interrupt waits for the end of the transfer", async () => {
    const r = await interruptsDuringFill(0x00);
    expect(r).toEqual({ during: 0, filled: [0x77, 0x77, 0x77] });
  });

  it("DMA-018: with its enable ($CC bit 0: ULA) the interrupt is taken during the transfer", async () => {
    const r = await interruptsDuringFill(0x01);
    expect(r.during).toBeGreaterThanOrEqual(1);
    expect(r.filled, "the transfer still completes").toEqual([0x77, 0x77, 0x77]);
  });

  // --- DMA-019: Layer 2 ------------------------------------------------------------------------------

  it("DMA-019: a DMA fill of a paged-in Layer 2 bank shows on screen", async () => {
    const s = await parked(core);
    writePalette(s, [[0x5a, 0x1c]], 0x10);
    s.setNextReg(0x56, 16); // --- MMU6: page 16, the first half of Layer 2 bank 8 (rows 0-31)
    s.poke(0xc000, new Array(512).fill(0)).poke(0x9000, 0x5a);
    write(s, [...setup({ a: 0x9000, b: 0xc000, len: 256, aMode: "fixed" }), ENABLE]).runFrames(1);
    expect(s.peek(0xc100), "256 bytes only").toBe(0);
    s.out(0x123b, 0x02).runFrames(2);
    expect(colours(s, [96, 607], [48, 48]), "row 0").toBe(hex8(0x1c));
  });

  // --- DMA-020: DAC playback -------------------------------------------------------------------------

  it("DMA-020: burst mode to Specdrum $DF at prescaler 109 plays a 256-step ramp at ~8 kHz", async () => {
    const RATE = 48_000;
    const P = 109;
    const s = await createSession(core, { audioSampleRate: RATE });
    await s.loadCode(" .org $8000\n di\nPark: jr Park");
    s.setNextReg(0x08, 0x18); // --- DACs on
    s.poke(0xc000, Array.from({ length: 256 }, (_, i) => i));
    write(s, setup({ a: 0xc000, b: 0x00df, len: 256, bIo: true, bMode: "fixed", mode: "burst", prescaler: P }));
    s.startAudio();
    s.out(ZXN, ENABLE);
    const left = side(s.runFrames(3).audio(), "left");
    const low = Math.min(...left);
    const high = Math.max(...left);
    const floor = left.indexOf(low);
    const start = left.findIndex((v, i) => i > floor && v > low);
    const end = left.findIndex((v, i) => i > start && v === high);
    // --- one step = 4P T-states (32P clocks of 28 MHz) plus a few clocks to get the bus back
    const perTact = (8 * RATE) / MASTER_CLOCK;
    expect(end - start, "254 steps").toBeGreaterThan(254 * 4 * P * perTact - 2);
    expect(end - start).toBeLessThan(254 * (4 * P + 12) * perTact + 2);
    const ramp = left.slice(start, end);
    expect(ramp.every((v, i) => i === 0 || v >= ramp[i - 1]), "never falls").toBe(true);
  });

  // --- DMA-021: length 0 ------------------------------------------------------------------------------

  for (const [port, name] of [
    [ZXN, "$6B"],
    [Z80, "$0B"]
  ] as const) {
    it(`DMA-021: through ${name} a block length of 0 moves one byte`, async () => {
      const s = await parked(core);
      numbered(s, 0xc000, 4);
      write(s, [...setup({ a: 0xc000, b: 0xc100, len: 0 }), ENABLE], port).runFrames(1);
      expect(Array.from(s.peekBytes(0xc100, 3))).toEqual([1, 0, 0]);
    });
  }

  it("DMA-021: a block length of 1 moves one byte through $6B, two through $0B", async () => {
    const s = await parked(core);
    numbered(s, 0xc000, 4);
    write(s, [...setup({ a: 0xc000, b: 0xc100, len: 1 }), ENABLE]).runFrames(1);
    write(s, [...setup({ a: 0xc000, b: 0xc200, len: 1 }), ENABLE], Z80).runFrames(1);
    expect([Array.from(s.peekBytes(0xc100, 3)), Array.from(s.peekBytes(0xc200, 3))]).toEqual([
      [1, 0, 0],
      [1, 2, 0]
    ]);
  });

  // --- DMA-022: port enables -------------------------------------------------------------------------

  it("DMA-022: $82 bit 5 gates $6B only, $85 bit 1 gates $0B only", async () => {
    const s = await parked(core);
    numbered(s, 0xc000, 4);
    const e82 = s.readNextReg(0x82);
    const e85 = s.readNextReg(0x85);
    s.setNextReg(0x82, e82 & ~0x20);
    write(s, [...setup({ a: 0xc000, b: 0xc100, len: 2 }), ENABLE]).runFrames(1);
    write(s, [...setup({ a: 0xc000, b: 0xc200, len: 2 }), ENABLE], Z80).runFrames(1);
    s.setNextReg(0x82, e82).setNextReg(0x85, e85 & ~0x02);
    write(s, [...setup({ a: 0xc000, b: 0xc300, len: 2 }), ENABLE], Z80).runFrames(1);
    write(s, [...setup({ a: 0xc000, b: 0xc400, len: 2 }), ENABLE]).runFrames(1);
    expect([0xc100, 0xc200, 0xc300, 0xc400].map((a) => Array.from(s.peekBytes(a, 3)))).toEqual([
      [0, 0, 0],
      [1, 2, 3],
      [0, 0, 0],
      [1, 2, 0]
    ]);
  });

  // --- DMA-023: the write sequencer's corners --------------------------------------------------------

  it("DMA-023: WR3 mask/match bytes, WR1's second timing byte and the interrupt commands are swallowed", async () => {
    const s = await parked(core);
    numbered(s, 0xc000, 8);
    write(s, [
      DISABLE,
      0x98, 0xff, 0x00, // --- WR3: mask and match follow
      0x7d, 0x00, 0xc0, 0x04, 0x00, // --- WR0
      0x54, 0x21, 0xee, // --- WR1: timing follows; its D5 announces a byte port A ignores
      0x50, 0x01, // --- WR2 with timing byte "01"
      0xad, 0x00, 0xc1, // --- WR4
      0xab, 0xaf, 0xa3, 0xb7, 0xb3, // --- interrupt / force-ready commands
      0x82,
      LOAD,
      ENABLE
    ]).runFrames(1);
    expect(Array.from(s.peekBytes(0xc100, 5))).toEqual([1, 2, 3, 4, 0]);
  });

  it("DMA-023: WR0 search bits (D1) do not stop the transfer - search is not implemented", async () => {
    const s = await parked(core);
    numbered(s, 0xc000, 8);
    write(s, [DISABLE, 0x7e, 0x00, 0xc0, 0x04, 0x00, 0x14, 0x10, 0xad, 0x00, 0xc1, 0x82, LOAD, ENABLE]).runFrames(1);
    expect(Array.from(s.peekBytes(0xc100, 5))).toEqual([1, 2, 3, 4, 0]);
  });

  it("DMA-023: after WR4 with port B address and D4, the next byte is a new register write", async () => {
    const s = await parked(core);
    numbered(s, 0xc000, 8);
    write(s, setup({ a: 0xc000, b: 0xc100, len: 4 }));
    // --- WR4 again, with interrupt control announced: VHDL takes only the address bytes; $87 enables
    write(s, [0xbd, 0x00, 0xc2, ENABLE]).runFrames(1);
    expect(Array.from(s.peekBytes(0xc100, 5)), "loaded before the second WR4").toEqual([1, 2, 3, 4, 0]);
  });

  it("DMA-023: WR4 with D4 but no port B address leaves the DMA deaf until reset", async () => {
    const s = await parked(core);
    numbered(s, 0xc000, 8);
    write(s, [0x91]); // --- WR4, byte mode, interrupt control announced
    write(s, [...setup({ a: 0xc000, b: 0xc100, len: 4 }), ENABLE]).runFrames(1);
    expect(Array.from(s.peekBytes(0xc100, 2)), "ignored").toEqual([0, 0]);
    s.reset();
    await s.loadCode(" .org $8000\n di\nPark: jr Park");
    numbered(s, 0xc000, 8);
    write(s, [...setup({ a: 0xc000, b: 0xc100, len: 4 }), ENABLE]).runFrames(1);
    expect(Array.from(s.peekBytes(0xc100, 5)), "after reset").toEqual([1, 2, 3, 4, 0]);
  });
});
