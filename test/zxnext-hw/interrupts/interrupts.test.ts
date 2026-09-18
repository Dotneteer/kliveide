import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { delay } from "../_timing-helpers";

/*
 * Maskable interrupts (catalogue INT-001 - INT-005, INT-007 - INT-015, INT-017, INT-018, INT-020, INT-023).
 *
 * Hardware (`_input/next-fpga/src`):
 * - zxnext.vhd ~1884-1955: 14 im2_peripheral devices in one daisy chain, priority = index = vector bits
 *   4-1: 0 line, 1 UART0 RX, 2 UART1 RX, 3-10 CTC 0-7, 11 ULA, 12 UART0 TX, 13 UART1 TX. Hardware IM2
 *   vector = $C0 bits 7-5 & index & '0'. `$20` writes are unqualified requests (bit 7 line, 6 ULA, 3-0
 *   CTC 0-3) that ignore the enables.
 * - device/im2_peripheral.vhd: a request edge sets the status bit (in any mode, enabled or not - "polled
 *   mode") and, when enabled (or unqualified) in hardware IM2 mode ($C0 bit 0), the device's pending
 *   request, which only the RETI ending its service clears. $C8-$CA read status OR pending, and a write
 *   clears only the status (nextreg.txt: "in hw im2 mode the status will continue to read as set until
 *   the interrupt pending condition is cleared"). In pulse mode ($C0 bit 0 = 0) a request starts the
 *   32/36-cycle INT pulse instead (~1968-1985); the ULA alone also pulses in hardware IM2 mode when the
 *   CPU is not in IM 2 (EXCEPTION generic).
 * - device/im2_device.vhd: S_0 -> S_REQ (INT only while the CPU is in IM 2 and IEI = 1) -> S_ACK -> S_ISR
 *   -> S_0 on RETI with IEI = 1. A device in S_REQ, S_ACK or S_ISR drives IEO low: everything below it
 *   waits; a device above it can still interrupt (nesting). RETN (ED 45) ends no service.
 * - device/im2_control.vhd: the IM decoder behind $C0 bits 2-1; RETI = ED 4D.
 * - ~1802-1831: in an interrupt acknowledge without a hardware IM2 vector the bus reads $FF: IM 2 in pulse
 *   mode reads its pointer at I * 256 + $FF, IM 0 executes RST $38.
 * - video/zxula_timing.vhd ~560-585: the line interrupt for line N fires at hc_ula 255 of cvc line N - 1
 *   (line 0: c_max_vc), before line N is drawn.
 */

// ---------------------------------------------------------------------------------------------------
// Scaffolding
// ---------------------------------------------------------------------------------------------------

/** I register value: the vector table is at $BE00-$BF00. */
const TABLE = 0xbe00;
/** Vector v enters a stub at $C000 + 8v: `ld a,v` / `jp Common`. */
const stub = (v: number) => 0xc000 + v * 8;

/** Log routine and storage: LogA appends A. */
const LOG_LIB = `
LogA:   push hl
        ld hl,(LogPtr)
        ld (hl),a
        inc hl
        ld (LogPtr),hl
        pop hl
        ret
LogPtr: .defw Log
Log:    .defs 1024
`;

/**
 * Pokes the IM2 table (I = $BE) and one stub per vector: every even vector v, and the pulse-mode
 * vector $FF (whose pointer overlaps entry $FE's high byte - no test uses $FE).
 */
function installVectors(s: NextTestSession): NextTestSession {
  const common = s.symbol("Common");
  for (let v = 0; v < 256; v += 2) s.pokeWord(TABLE + v, stub(v));
  s.pokeWord(TABLE + 0xff, stub(0xff));
  for (let v = 0; v < 256; v++) {
    if (v % 2 === 1 && v !== 0xff) continue;
    s.poke(stub(v), [0x3e, v, 0xc3, common & 0xff, common >> 8]);
  }
  return s;
}

const log = (s: NextTestSession) => {
  const start = s.symbol("Log");
  return Array.from(s.peekBytes(start, s.peekWord(s.symbol("LogPtr")) - start));
};

/** A session with `source` loaded (not yet run); `after` runs after the load, which resets the MMU. */
async function session(core: CoreName, source: string, after?: (s: NextTestSession) => void): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(" .org $8000\n di\n jr $");
  await s.loadCode(source, { entry: "Start" });
  installVectors(s);
  after?.(s);
  return s;
}

/** An IM2 program: I = $BE, IM 2, the given body; Common logs A and runs `tail`. */
const im2Program = (body: string, tail = "        ei\n        reti", extra = "") => `
        .org $8000
Start:  di
        ld a,$be
        ld i,a
        im 2
${body}
        nextreg $7f,$a5
Park:   jr Park
Common: call LogA
${tail}
${extra}
${LOG_LIB}
`;

/** RAM at $0000 (MMU0/1 = pages 40/41, DivMMC automap off) with an IM 1 / IM 0 handler counting in $BD00. */
function ramRst38(s: NextTestSession): void {
  s.setNextReg(0x0a, s.readNextReg(0x0a) & ~0x10).setNextReg(0x50, 40).setNextReg(0x51, 41);
  // --- push hl / ld hl,($BD00) / inc hl / ld ($BD00),hl / pop hl / ei / ret
  s.poke(0x0038, [0xe5, 0x2a, 0x00, 0xbd, 0x23, 0x22, 0x00, 0xbd, 0xe1, 0xfb, 0xc9]).pokeWord(0xbd00, 0);
}

const counter = (s: NextTestSession) => s.peekWord(0xbd00);

const imProgram = (mode: 0 | 1, body = "") => `
        .org $8000
Start:  di
        im ${mode}
${body}
        ei
        nextreg $7f,$a5
Park:   jr Park
Common: ret
${LOG_LIB}
`;

// ---------------------------------------------------------------------------------------------------

describe.each(ALL_CORES)("interrupts - %s core", (core: CoreName) => {
  // --- ULA interrupt, IM 1 and IM 0 ------------------------------------------------------------------

  for (const mode of [1, 0] as const) {
    it(`${mode === 1 ? "INT-001" : "INT-020"}: IM ${mode} takes the ULA frame interrupt at $0038 once a frame`, async () => {
      const s = await session(core, imProgram(mode), (x) => ramRst38(x));
      s.runUntilReady().runFrames(1);
      const before = counter(s);
      s.runFrames(50);
      expect(counter(s) - before).toBe(50);
    });
  }

  it("INT-002: IM 2 in pulse mode reads its pointer at I * 256 + $FF", async () => {
    const s = await session(core, im2Program("        nextreg $c0,$00\n        ei", "        ei\n        ret"));
    s.runUntilReady().runFrames(3);
    const got = log(s);
    expect(got.length, "one interrupt a frame").toBeGreaterThanOrEqual(3);
    expect([...new Set(got)]).toEqual([0xff]);
  });

  // --- Hardware IM2 ----------------------------------------------------------------------------------

  it("INT-003: hardware IM2 vectors are $C0 bits 7-5 + index * 2: line $A0, ULA $B6", async () => {
    const s = await session(
      core,
      im2Program(`
        nextreg $c0,$a1          ; vector base $A0, hardware IM2
        nextreg $23,100
        nextreg $22,$02          ; line interrupt at line 100, ULA interrupt on
        ei`)
    );
    s.runUntilReady().runFrames(3);
    const got = log(s);
    expect([...new Set(got)].sort(), JSON.stringify(got)).toEqual([0xa0, 0xb6]);
    expect(got.filter((v) => v === 0xa0).length, "a line interrupt a frame").toBeGreaterThanOrEqual(3);
    expect(got.filter((v) => v === 0xb6).length, "a ULA interrupt a frame").toBeGreaterThanOrEqual(3);
  });

  it("INT-003: in hardware IM2 mode a CPU in IM 1 gets only the ULA interrupt (as a pulse), not the line", async () => {
    const s = await session(core, imProgram(1, "        nextreg $c0,$01\n        nextreg $23,100\n        nextreg $22,$02"), (x) => ramRst38(x));
    s.runUntilReady().runFrames(1);
    const before = counter(s);
    s.runFrames(20);
    expect(counter(s) - before).toBe(20);
  });

  it("INT-004: pending together, the sources are served in priority order: line, CTC 0-3, ULA", async () => {
    const s = await session(
      core,
      im2Program(`
        nextreg $22,$04          ; the frame's own ULA and line interrupts off
        nextreg $c0,$01
        nextreg $20,$cf          ; line, ULA, CTC 0-3 at once (unqualified)
        ei
        nop`)
    );
    s.runUntilReady();
    expect(log(s)).toEqual([0, 6, 8, 10, 12, 22]);
  });

  /*
   * INT-016: the ULA handler enables interrupts and raises a line interrupt: the line (higher) nests at
   * once. The line handler raises a ULA interrupt: it waits until the line handler's RETI.
   */
  const nesting = (inner: number, raise: number) =>
    im2Program(
      `
        nextreg $22,$04
        nextreg $c0,$01
        nextreg $20,${inner === 22 ? "$40" : "$80"}
        ei
        nop`,
      `        cp ${inner}
        jr nz,Done
        ei
        nextreg $20,${raise}
        nop
        nop
        ld a,$ee
        call LogA
Done:   ei
        reti`
    );

  it("INT-016: a higher-priority interrupt nests inside a lower one's handler", async () => {
    const s = await session(core, nesting(22, 0x80));
    s.runUntilReady().runFrames(1);
    expect(log(s)).toEqual([22, 0, 0xee]);
  });

  it("INT-016: a lower-priority interrupt waits for the higher one's RETI", async () => {
    const s = await session(core, nesting(0, 0x40));
    s.runUntilReady().runFrames(1);
    expect(log(s)).toEqual([0, 0xee, 22]);
  });

  it("INT-017: RETN ends no service - the chain stays blocked until a RETI", async () => {
    const s = await session(
      core,
      im2Program(
        `
        nextreg $22,$04
        nextreg $c0,$01
        nextreg $20,$80          ; line: its handler returns with RETN
        ei
        nop
        nextreg $20,$40          ; ULA: blocked while the line is still in service
        ld b,0
Wait:   djnz Wait
        ld a,$aa
        call LogA
        ld hl,AfterReti
        push hl
        reti                     ; releases the line; the ULA follows
AfterReti:
        nop`,
        `        ei
        retn`
      )
    );
    s.runUntilReady().runFrames(1);
    expect(log(s)).toEqual([0, 0xaa, 22]);
  });

  // --- Registers -------------------------------------------------------------------------------------

  it("INT-005: $C0 bits 2-1 read the IM the CPU last executed; bits 7-5, 3 and 0 read back, bit 4 is 0", async () => {
    const s = await createSession(core);
    await s.loadCode(`
        .org $8000
Start:  di
        im 1
        im 2
        im 0
        jr $`, { entry: "Start" });
    const im = () => (s.readNextReg(0xc0) >> 1) & 3;
    s.step(1);
    const seen = [];
    for (let i = 0; i < 3; i++) {
      s.step(1);
      seen.push(im());
    }
    expect(seen).toEqual([1, 2, 0]);
    s.setNextReg(0xc0, 0xff);
    expect(s.readNextReg(0xc0)).toBe(0xe9);
  });

  it("INT-010: $C4 resets to $81; bit 1 is $22 bit 1, bit 0 is not $22 bit 2", async () => {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n di\n jr $");
    s.setNextReg(0xc4, 0x00).reset();
    expect(s.readNextReg(0xc4), "after a soft reset").toBe(0x81);
    s.setNextReg(0xc4, 0x02);
    expect([s.readNextReg(0xc4), s.readNextReg(0x22) & 0x06]).toEqual([0x02, 0x06]);
    s.setNextReg(0x22, 0x00);
    expect(s.readNextReg(0xc4)).toBe(0x01);
    s.setNextReg(0xc4, 0xff);
    expect(s.readNextReg(0xc4), "bits 6-2 are not stored").toBe(0x83);
  });

  it("INT-011 / INT-012 / INT-018: $C5 has the four CTC channels; $C6 and $CC-$CE read back their bits", async () => {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n di\n jr $");
    const rb = (r: number, v: number) => (s.setNextReg(r, v), s.readNextReg(r));
    expect({ c5: rb(0xc5, 0xff), c6: rb(0xc6, 0xff), cc: rb(0xcc, 0xff), cd: rb(0xcd, 0xff), ce: rb(0xce, 0xff) }).toEqual({
      c5: 0x0f,
      c6: 0x77,
      cc: 0x83,
      cd: 0xff,
      ce: 0x77
    });
    expect({ c5: rb(0xc5, 0x05), c6: rb(0xc6, 0x42), cc: rb(0xcc, 0x80), cd: rb(0xcd, 0x5a), ce: rb(0xce, 0x31) }).toEqual({
      c5: 0x05,
      c6: 0x42,
      cc: 0x80,
      cd: 0x5a,
      ce: 0x31
    });
  });

  /*
   * INT-011: CTC channel 0 as a timer (prescaler 16, constant 100) without its interrupt enable: the
   * status ($C9 bit 0) latches every zero count, no interrupt; $C5 bit 0 enables vector 6.
   */
  it("INT-011: a CTC channel interrupts only with its enable; its status latches either way", async () => {
    const s = await session(
      core,
      im2Program(`
        nextreg $22,$04
        nextreg $c0,$01
        nextreg $c9,$ff
        ld bc,$183b
        ld a,$05                 ; control word: timer, prescaler 16, constant follows, no interrupt
        out (c),a
        ld a,100
        out (c),a
        ei`)
    );
    s.runUntilReady().runFrames(1);
    expect({ log: log(s).length, status: s.readNextReg(0xc9) & 0x01 }, "disabled").toEqual({ log: 0, status: 1 });
    s.setNextReg(0xc5, 0x01).runFrames(1);
    const got = log(s);
    expect(got.length, "enabled").toBeGreaterThan(10);
    expect([...new Set(got)]).toEqual([6]);
  });

  // --- Status ----------------------------------------------------------------------------------------

  it("INT-013: with interrupts off, $C8 latches the line and ULA interrupts; writing 1 clears", async () => {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n di\n jr $");
    s.setNextReg(0xc0, 0x00).setNextReg(0x23, 50).setNextReg(0x22, 0x02).setNextReg(0xc8, 0x03).runFrames(1);
    expect(s.readNextReg(0xc8), "both happened").toBe(0x03);
    s.setNextReg(0xc8, 0x02);
    expect(s.readNextReg(0xc8), "line cleared").toBe(0x01);
    s.setNextReg(0xc8, 0x01);
    expect(s.readNextReg(0xc8), "ULA cleared").toBe(0x00);
    // --- disabled sources do not happen at all (zxula_timing gates the pulses)
    s.setNextReg(0x22, 0x04).runFrames(2);
    expect(s.readNextReg(0xc8), "both disabled").toBe(0x00);
  });

  it("INT-013: in hardware IM2 mode a cleared status reads set while the interrupt is pending and in service", async () => {
    const s = await session(
      core,
      im2Program(
        `
        nextreg $22,$04
        nextreg $c0,$01
        nextreg $20,$80          ; a line interrupt, pending (DI)
        nextreg $c8,$02          ; clear its status
        ld bc,$243b
        ld a,$c8
        out (c),a
        inc b
        in a,(c)
        ld (Pending),a           ; still set: pending
        ei
        nop
        in a,(c)
        ld (After),a             ; clear: the RETI ended it and the status was cleared`,
        `        ld bc,$253b
        in a,(c)
        ld (InService),a         ; still set: in service
        ei
        reti`,
        "Pending: .defb 0\nInService: .defb 0\nAfter: .defb 0"
      )
    );
    s.runUntilReady();
    expect({
      pending: s.peek(s.symbol("Pending")) & 0x02,
      inService: s.peek(s.symbol("InService")) & 0x02,
      after: s.peek(s.symbol("After")) & 0x02,
      log: log(s)
    }).toEqual({ pending: 0x02, inService: 0x02, after: 0x00, log: [0] });
  });

  // --- $20 -------------------------------------------------------------------------------------------

  it("INT-014: a $20 write interrupts in pulse mode too, ignoring the enables", async () => {
    const body = `
        nextreg $22,$04          ; ULA and line interrupts disabled
        ei
${Array.from({ length: 6 }, () => `        nextreg $20,$40\n${delay(200)}\n        nextreg $20,$80\n${delay(200)}`).join("\n")}
        di`;
    const t = await session(
      core,
      `
        .org $8000
Start:  di
        im 1
${body}
        nextreg $7f,$a5
Park:   jr Park
Common: ret
${LOG_LIB}`,
      (x) => ramRst38(x)
    );
    t.runUntilReady();
    expect(counter(t)).toBe(12);
  });

  it("INT-015: $20 reads the line, ULA and CTC 0-3 status bits", async () => {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n di\n jr $");
    s.setNextReg(0xc0, 0x00).setNextReg(0x22, 0x04).setNextReg(0xc8, 0x03).setNextReg(0xc9, 0xff);
    expect(s.readNextReg(0x20), "clear").toBe(0x00);
    s.setNextReg(0x20, 0xcf);
    expect(s.readNextReg(0x20), "after $20 = $CF").toBe(0xcf);
    expect([s.readNextReg(0xc8), s.readNextReg(0xc9)], "the same bits in $C8 / $C9").toEqual([0x03, 0x0f]);
    s.setNextReg(0xc8, 0x02).setNextReg(0xc9, 0x05);
    expect(s.readNextReg(0x20)).toBe(0x4a);
  });

  // --- Line interrupt --------------------------------------------------------------------------------

  /** 48K 50 Hz (c_max_vc 311): the $1F line value seen right after line interrupt `line` latches $C8 bit 1. */
  async function lineSeen(line: number): Promise<number | undefined> {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n di\n jr $");
    s.setNextReg(0x03, 0x90).setNextReg(0x05, 0x00).runFrames(2);
    s.setNextReg(0x23, line & 0xff).setNextReg(0x22, 0x04 | 0x02 | (line >> 8));
    await s.loadCode(
      `
        .org $8000
Start:  di
        nextreg $c8,$03
        ld bc,$243b
        ld a,$c8
        out (c),a
        inc b
Poll:   in a,(c)                 ; 12
        and $02                  ; 7
        jr z,Poll                ; 12: 31 tacts a pass
        dec b
        ld a,$1f
        out (c),a
        inc b
        in a,(c)                 ; at most ~70 tacts after the interrupt
        ld (Seen),a
        nextreg $7f,$a5
Park:   jr Park
Seen:   .defb 0`,
      { entry: "Start" }
    );
    s.setNextReg(0x7f, 0);
    try {
      s.runUntilReady({ maxFrames: 3 });
    } catch {
      return undefined;
    }
    return s.peek(s.symbol("Seen"));
  }

  it("INT-007 / INT-008: line N fires on line N - 1 (0 on the last line); N past c_max_vc + 1 never", async () => {
    const got: Record<number, number | undefined> = {};
    for (const n of [1, 100, 200, 311, 0, 312, 313, 400]) got[n] = await lineSeen(n);
    expect(got).toEqual({
      1: 0,
      100: 99,
      200: 199,
      311: 310 & 0xff,
      0: 311 & 0xff,
      312: 311 & 0xff, // --- int_line_num = 311 = c_max_vc, the same as line 0
      313: undefined,
      400: undefined
    });
  });

  /*
   * INT-009: from a frame start, wait d tacts and read $C8 (line status, cleared at the start) or $1F with
   * one IN; the line interrupt for line 100 is 255 hc_ula (127.5 tacts) after line 99 begins.
   */
  it("INT-009: the line interrupt is 127.5 tacts (hc_ula 255) into the line before it", async () => {
    const s = await createSession(core);
    const probe = async (reg: number, wait: number): Promise<number> => {
      s.hardReset();
      await s.loadCode(" .org $8000\n di\n jr $");
      s.setNextReg(0x03, 0x90).setNextReg(0x05, 0x00).setNextReg(0x23, 100).setNextReg(0x22, 0x06).runFrames(2);
      await s.loadCode(
        `
        .org $8000
Start:  di
        nextreg $c8,$02          ; 20
        ld bc,$243b              ; 10
        ld a,${reg}              ; 7
        out (c),a                ; 12
        ld b,$25                 ; 7
${delay(wait)}
        in a,(c)
        ld (Result),a
        nextreg $7f,$a5
Stop:   jr Stop
Result: .defb 0`,
        { entry: "Start" }
      );
      s.setNextReg(0x7f, 0);
      s.runUntilReady({ maxFrames: 10 });
      return s.peek(s.symbol("Result"));
    };
    const threshold = async (lo: number, hi: number, pred: (x: number) => Promise<boolean>) => {
      expect(await pred(lo), `false at ${lo}`).toBe(false);
      expect(await pred(hi), `true at ${hi}`).toBe(true);
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (await pred(mid)) hi = mid;
        else lo = mid;
      }
      return hi;
    };
    const intAt = await threshold(100, 69000, async (d) => ((await probe(0xc8, d)) & 0x02) !== 0);
    const lineStart = await threshold(intAt - 300, intAt, async (d) => (await probe(0x1f, d)) === 99);
    expect(Math.abs(intAt - lineStart - 127.5), `${intAt - lineStart} tacts`).toBeLessThanOrEqual(1);
  });

  // --- EI --------------------------------------------------------------------------------------------

  it("INT-023: a pending interrupt is taken after the instruction that follows EI", async () => {
    const s = await session(
      core,
      im2Program(
        `
        nextreg $22,$04
        nextreg $c0,$01
        nextreg $20,$80          ; pending (hardware IM2 holds it)
        ei
First:  nop
Second: nop`,
        `        pop hl
        push hl
        ld (Ret),hl
        ei
        reti`,
        "Ret: .defw 0"
      )
    );
    s.runUntilReady();
    expect(s.peekWord(s.symbol("Ret"))).toBe(s.symbol("Second"));
  });
});
