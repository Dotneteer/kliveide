import { describe, expect, it } from "vitest";

import { createZ88Session, type Z88TestSession } from "../harness/z88";

/*
 * The Blink's maskable interrupt (IM 1, $0038): RTC events, the flap, battery low; and the flags
 * the Blink panel shows.
 *
 * Hardware (Blink documentation): an interrupt reaches the Z80 only with INT.GINT set; STA holds the
 * pending sources and ACK ($B6) clears them; TACK ($B4) clears TSTA's RTC events. TIM0 counts 5 ms
 * periods and every odd TIM0 is a TICK (10 ms). Opening the flap raises STA.FLAP and STA.FLAPOPEN
 * (with INT.FLAP), and no RTC interrupt comes out while the flap is open.
 *
 * Step 0.3 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`.
 */

const INT_GINT = 0x01;
const INT_TIME = 0x02;
const INT_FLAP = 0x20;
const INT_KWAIT = 0x80;
const STA_TIME = 0x01;
const STA_BTL = 0x08;
const STA_FLAP = 0x20;
const STA_FLAPOPEN = 0x80;

/**
 * An IM 1 handler that counts interrupts in the word at $9000, then acknowledges both an RTC event (TACK) and
 * the flap (ACK). The main program enables interrupts with the given INT value and spins.
 */
async function interruptCounter(s: Z88TestSession, intValue: number): Promise<void> {
  await s.loadCode(`
      .org $0038
      jp handler

      .org $8000
start:
      im 1
      ld a,${intValue}
      out ($b1),a
      ld a,$01
      out ($b5),a         ; TMK = TICK
      ld a,$07
      out ($b4),a         ; TACK: drop any RTC event that was pending before INT was set
      ei
spin:
      jr spin

handler:
      push af
      push hl
      ld hl,($9000)
      inc hl
      ld ($9000),hl
      ld a,$07
      out ($b4),a         ; TACK: TICK | SEC | MIN
      ld a,$20
      out ($b6),a         ; ACK: FLAP
      pop hl
      pop af
      ei
      ret
  `, { entry: "start" });
}

describe("Z88 interrupts", () => {
  it("with INT.TIME and TMK.TICK, the RTC interrupts every 10 ms (every 2nd frame)", async () => {
    const s = await createZ88Session();
    await interruptCounter(s, INT_GINT | INT_TIME);
    s.runFrames(20);
    const count = s.peekWord(0x9000);
    expect(count).toBeGreaterThanOrEqual(9);
    expect(count).toBeLessThanOrEqual(10);
    expect(s.registers().interruptMode).toBe(1);
  });

  it("without INT.GINT, no RTC interrupt comes out", async () => {
    const s = await createZ88Session();
    await interruptCounter(s, INT_TIME);
    s.runFrames(20);
    expect(s.peekWord(0x9000)).toBe(0);
  });

  it("without INT.TIME, the RTC counts but does not interrupt", async () => {
    const s = await createZ88Session();
    await interruptCounter(s, INT_GINT);
    s.runFrames(20);
    expect(s.peekWord(0x9000)).toBe(0);
    expect(s.blinkState().TIM0).toBeGreaterThanOrEqual(19);
    expect(s.blinkState().STA & STA_TIME).toBe(0);
  });

  it("opening the flap (INT.FLAP) sets STA.FLAP and STA.FLAPOPEN; closing clears FLAPOPEN only", async () => {
    const s = await createZ88Session();
    s.out(0xb1, INT_GINT | INT_FLAP);
    s.flapOpen();
    expect(s.blinkState().STA & (STA_FLAP | STA_FLAPOPEN)).toBe(STA_FLAP | STA_FLAPOPEN);
    s.flapClose();
    expect(s.blinkState().STA & (STA_FLAP | STA_FLAPOPEN)).toBe(STA_FLAP);
    s.out(0xb6, STA_FLAP);
    expect(s.blinkState().STA & STA_FLAP).toBe(0);
  });

  it("the flap is ignored without INT.FLAP", async () => {
    const s = await createZ88Session();
    s.out(0xb1, INT_GINT);
    s.flapOpen();
    expect(s.blinkState().STA & (STA_FLAP | STA_FLAPOPEN)).toBe(0);
  });

  it("the flap commands of the machine menu do the same", async () => {
    const s = await createZ88Session();
    s.out(0xb1, INT_GINT | INT_FLAP);
    await s.command("flap_open");
    expect(s.blinkState().STA & STA_FLAPOPEN).toBe(STA_FLAPOPEN);
    await s.command("flap_close");
    expect(s.blinkState().STA & STA_FLAPOPEN).toBe(0);
  });

  it("opening the flap interrupts once; while it is open, no RTC interrupt comes out", async () => {
    const s = await createZ88Session();
    await interruptCounter(s, INT_GINT | INT_TIME | INT_FLAP);
    s.runFrames(1);
    const before = s.peekWord(0x9000);
    s.flapOpen();
    s.runFrames(20);
    // --- One flap interrupt (acknowledged by the handler), then nothing
    expect(s.peekWord(0x9000)).toBe(before + 1);
    expect(s.blinkState().STA & STA_FLAPOPEN).toBe(STA_FLAPOPEN);

    s.flapClose();
    s.runFrames(20);
    expect(s.peekWord(0x9000)).toBeGreaterThan(before + 5);
  });

  it("an open flap is a state, not a source: with INT.KWAIT set, it interrupts once (FLAP)", async () => {
    // --- STA.FLAPOPEN and INT.KWAIT share bit 7, but neither is an interrupt source or enable (Blink
    // --- documentation). Testing INT & STA interrupted for as long as the flap was open (F1).
    const s = await createZ88Session();
    await interruptCounter(s, INT_GINT | INT_FLAP | INT_KWAIT);
    s.runFrames(1);
    s.flapOpen();
    s.runFrames(20);
    expect(s.blinkState().STA & STA_FLAPOPEN).toBe(STA_FLAPOPEN);
    expect(s.peekWord(0x9000)).toBe(1);
  });

  it("a pending STA.TIME does not interrupt once INT.TIME is off (TIME is INT bit 1, STA bit 0)", async () => {
    // --- Testing INT & STA paired STA.TIME with INT.GINT, so a pending RTC event interrupted with
    // --- INT.TIME off (F1). The handler acknowledges nothing: every interrupt would repeat.
    const s = await createZ88Session();
    await s.loadCode(`
      .org $0038
      jp handler

      .org $8000
start:
      im 1
      ld a,${INT_GINT | INT_TIME}
      out ($b1),a
      ld a,$01
      out ($b5),a          ; TMK = TICK
      ld a,$07
      out ($b4),a          ; TACK
wait: in a,($b1)           ; STA
      and ${STA_TIME}
      jr z,wait            ; until an RTC event is pending
      ld a,${INT_GINT}
      out ($b1),a          ; INT.TIME off; STA.TIME still pending
      ld (pending),a
      ei
spin: jr spin

handler:
      push hl
      ld hl,($9000)
      inc hl
      ld ($9000),hl
      pop hl
      ei
      reti

pending: .defb 0
    `, { entry: "start" });
    s.runTo("spin", { maxFrames: 20 });
    expect(s.blinkState().STA & STA_TIME).toBe(STA_TIME);
    s.step(200);
    expect(s.peekWord(0x9000)).toBe(0);
  });

  it("an enabled RTC event wakes a snoozing CPU; without INT.TIME it sleeps on", async () => {
    for (const [intValue, wakes] of [
      [0x80 | INT_TIME | INT_GINT, true],
      [0x80 | INT_GINT, false]
    ] as const) {
      const s = await createZ88Session();
      await s.loadCode(`
      .org $8000
      di
      ld a,${intValue}
      out ($b1),a          ; INT (KWAIT set)
      ld a,$01
      out ($b5),a          ; TMK = TICK
      ld bc,$00b2
      in a,(c)             ; no key down: snooze
      ld a,$55
      ld ($9000),a
spin: jr spin
      `);
      s.runFrames(1);
      expect(s.snoozed).toBe(true);
      s.runFrames(4);
      expect(s.snoozed).toBe(!wakes);
      expect(s.peek(0x9000)).toBe(wakes ? 0x55 : 0x00);
    }
  });

  it("battery_low sets STA.BTL", async () => {
    const s = await createZ88Session();
    expect(s.blinkState().STA & STA_BTL).toBe(0);
    await s.command("battery_low");
    expect(s.blinkState().STA & STA_BTL).toBe(STA_BTL);
  });

  it("COM.RESTIM stops and clears the RTC", async () => {
    const s = await createZ88Session();
    await s.loadCode(`
      .org $8000
spin: jr spin
    `);
    s.runFrames(10);
    expect(s.blinkState().TIM0).toBeGreaterThan(0);
    s.out(0xb0, 0x04 | 0x10); // COM = RAMS | RESTIM
    s.runFrames(10);
    expect(s.blinkState()).toMatchObject({ TIM0: 0, TIM1: 0, TIM2: 0, TIM3: 0, TIM4: 0 });
  });
});
