import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName, type NextTestSession, type RtcTime } from "../../harness/zxnext";

/*
 * The I2C bus and the DS1307 real-time clock (catalogue I2C-001 - I2C-006).
 *
 * Hardware:
 * - zxnext.vhd ~2586: $103B (SCL) and $113B (SDA) are decoded in full, gated by internal port enable
 *   bit 10 ($83 bit 2). ~3224-3265: a bit-banged master - a write latches bit 0 as the pin's open-drain
 *   output (0 pulls low, 1 releases), a reset releases both, a read gives "1111111" & the line (the
 *   AND of every device on it). zxnext_top_issue4 ~1858: the pins are open drain with pull-ups.
 * - The DS1307 (Maxim datasheet) on that bus: slave address $68 ($D0 write, $D1 read), ACK by pulling
 *   SDA low on the 9th clock; any other address gets no ACK. Registers: 0 seconds (bit 7 CH stops the
 *   oscillator), 1 minutes, 2 hours (bit 6 = 12-hour mode, then bit 5 = PM), 3 day 1-7, 4 date,
 *   5 month, 6 year, 7 control, $08-$3F 56 bytes of RAM, all battery backed. The first byte of a write
 *   sets the register pointer, which advances after each byte and wraps from $3F to $00; a read starts
 *   at the pointer. The time is read from user buffers the running registers are copied into on every
 *   START. Writing the seconds register resets the countdown chain: the next second is a whole second
 *   later. Leap years to 2100 (every year divisible by 4).
 * - The chip is not part of the FPGA: no Next reset (soft or hard - a core reload) touches it.
 *
 * The RTC's time comes from `setRtcTime` (the harness's `rtc` capability): a clock set before the test.
 * Frames are 1/49.4 - 1/50.1 s depending on the timing; the tests keep 10% away from each second.
 */

const SCL = 0x103b;
const SDA = 0x113b;

/** Bit-banged I2C master routines (BC, DE, A, F; HL preserved). */
const I2C_LIB = `
; --- START (also repeated START): SDA and SCL high, SDA low, SCL low
I2cStart:
        ld bc,$113b
        ld a,1
        out (c),a
        ld b,$10
        out (c),a
        ld b,$11
        xor a
        out (c),a
        ld b,$10
        out (c),a
        ret

; --- STOP: SDA low, SCL high, SDA high
I2cStop:
        ld bc,$113b
        xor a
        out (c),a
        ld b,$10
        inc a
        out (c),a
        ld b,$11
        out (c),a
        ret

; --- Sends A, MSB first; returns A = the ACK bit (0 = ACK)
I2cWrite:
        ld e,a
        ld d,8
WrBit:  ld bc,$113b
        xor a
        rl e
        rla
        out (c),a
        ld b,$10
        ld a,1
        out (c),a
        xor a
        out (c),a
        dec d
        jr nz,WrBit
        ld bc,$113b
        ld a,1
        out (c),a
        ld b,$10
        out (c),a
        ld b,$11
        in a,(c)
        and 1
        ld e,a
        ld b,$10
        xor a
        out (c),a
        ld a,e
        ret

; --- Receives a byte into A; answers NACK when carry is set, ACK otherwise
I2cRead:
        push af
        ld bc,$113b
        ld a,1
        out (c),a
        ld d,8
        ld e,0
RdBit:  ld b,$10
        ld a,1
        out (c),a
        ld b,$11
        in a,(c)
        rra
        rl e
        ld b,$10
        xor a
        out (c),a
        dec d
        jr nz,RdBit
        pop af
        ld a,0
        rla
        ld b,$11
        out (c),a
        ld b,$10
        ld a,1
        out (c),a
        xor a
        out (c),a
        ld b,$11
        inc a
        out (c),a
        ld a,e
        ret

; --- Reads (Cnt) registers from pointer (Ptr) into Buf: pointer write, repeated START, read
RtcRead:
        call I2cStart
        ld a,$d0
        call I2cWrite
        ld a,(Ptr)
        call I2cWrite
        call I2cStart
        ld a,$d1
        call I2cWrite
        ld hl,Buf
        ld a,(Cnt)
        ld (Left),a
RdLoop: ld a,(Left)
        dec a
        ld (Left),a
        scf
        jr z,RdLast
        or a
RdLast: call I2cRead
        ld (hl),a
        inc hl
        ld a,(Left)
        or a
        jr nz,RdLoop
        jp I2cStop

; --- Writes (Cnt) bytes from Buf from pointer (Ptr); no bytes: sets the pointer only
RtcWrite:
        call I2cStart
        ld a,$d0
        call I2cWrite
        ld a,(Ptr)
        call I2cWrite
        ld hl,Buf
        ld a,(Cnt)
        ld (Left),a
        or a
        jp z,I2cStop
WrLoop: ld a,(hl)
        inc hl
        call I2cWrite
        ld a,(Left)
        dec a
        ld (Left),a
        jr nz,WrLoop
        jp I2cStop

; --- START, the address in (Ptr), STOP; the ACK bit into Buf
AddrProbe:
        call I2cStart
        ld a,(Ptr)
        call I2cWrite
        ld (Buf),a
        jp I2cStop
`;

/**
 * A command loop: the harness pokes Ptr/Cnt/Buf and Cmd (1 read, 2 write, 3 address probe) and the
 * program runs it at once and clears Cmd. Each command takes one frame of the harness's time.
 */
const DRIVER = `
        .org $8000
Start:  di
        nextreg $7f,$a5
Loop:   ld a,(Cmd)
        or a
        jr z,Loop
        cp 1
        call z,RtcRead
        ld a,(Cmd)
        cp 2
        call z,RtcWrite
        ld a,(Cmd)
        cp 3
        call z,AddrProbe
        xor a
        ld (Cmd),a
        jr Loop
${I2C_LIB}
Cmd:    .defb 0
Ptr:    .defb 0
Cnt:    .defb 0
Left:   .defb 0
Buf:    .defs 64
`;

async function boot(s: NextTestSession): Promise<NextTestSession> {
  s.setNextReg(0x7f, 0); // --- $7F survives a soft reset
  await s.loadCode(DRIVER, { entry: "Start" });
  return s.runUntilReady();
}

async function driver(core: CoreName): Promise<NextTestSession> {
  return boot(await createSession(core));
}

function command(s: NextTestSession, cmd: number, ptr: number, cnt: number): void {
  s.poke(s.symbol("Ptr"), ptr).poke(s.symbol("Cnt"), cnt).poke(s.symbol("Cmd"), cmd);
  s.runUntil((t) => t.peek(t.symbol("Cmd")) === 0, "the I2C command", { maxFrames: 3 });
}

function rtcRead(s: NextTestSession, pointer: number, count: number): number[] {
  command(s, 1, pointer, count);
  return Array.from(s.peekBytes(s.symbol("Buf"), count));
}

function rtcWrite(s: NextTestSession, pointer: number, bytes: number[]): void {
  s.poke(s.symbol("Buf"), bytes);
  command(s, 2, pointer, bytes.length);
}

/** The ACK bit the addressed device returns (0 = ACK). */
function addressAck(s: NextTestSession, address: number): number {
  command(s, 3, address, 0);
  return s.peek(s.symbol("Buf"));
}

/** The time registers 0-6 as BCD: [sec, min, hour, day, date, month, year]. */
const regs = (t: RtcTime) =>
  [t.seconds, t.minutes, t.hours, t.day, t.date, t.month, t.year % 100].map((v, i) => (i === 3 ? v : ((v / 10) << 4) | v % 10));

const hexes = (bytes: number[]) => bytes.map((b) => "$" + b.toString(16).padStart(2, "0"));

/** 0.9 s and 1.1 s in frames at 50.1 and 49.4 frames per second */
const UNDER_ONE_SECOND = 44;
const OVER_ONE_SECOND = 55;

describe.each(ALL_CORES)("I2C and the DS1307 - %s core", (core) => {
  // -------------------------------------------------------------------------------------------------
  // I2C-001 SCL/SDA ports
  // -------------------------------------------------------------------------------------------------

  it("I2C-001: bit 0 drives the open-drain line; the read is $FE | the line; a reset releases both", async () => {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n di\n jr $");
    expect([s.in(SCL), s.in(SDA)], "power-on: released").toEqual([0xff, 0xff]);
    // --- SDA first, while SCL is high, is a START: the DS1307 only listens
    for (const port of [SCL, SDA]) {
      expect(s.out(port, 0x00).in(port), "pulled low").toBe(0xfe);
      expect(s.out(port, 0xfe).in(port), "bits 7-1 ignored").toBe(0xfe);
      expect(s.out(port, 0x01).in(port), "released").toBe(0xff);
    }
    s.out(SCL, 0).out(SDA, 0);
    s.reset();
    expect([s.in(SCL), s.in(SDA)], "soft reset").toEqual([0xff, 0xff]);
  });

  // -------------------------------------------------------------------------------------------------
  // I2C-002 START/STOP and the DS1307's ACK / I2C-005 other addresses
  // -------------------------------------------------------------------------------------------------

  it("I2C-002: the DS1307 acknowledges $D0 and $D1; after STOP the bus is released", async () => {
    const s = await driver(core);
    expect(addressAck(s, 0xd0), "write address").toBe(0);
    expect(addressAck(s, 0xd1), "read address").toBe(0);
    expect([s.in(SCL), s.in(SDA)]).toEqual([0xff, 0xff]);
  });

  it("I2C-005: other addresses get no ACK, and what is sent to them does not reach the DS1307", async () => {
    const s = await driver(core);
    rtcWrite(s, 0x08, [0x11]);
    for (const address of [0x00, 0xa0, 0xd2, 0xd3, 0xd8, 0x50]) expect(addressAck(s, address), hexes([address])[0]).toBe(1);
    expect(addressAck(s, 0xd0), "the bus still works").toBe(0);
    // --- The same bytes to $D2: the DS1307 does not store them
    await s.loadCode(
      `${DRIVER}
Other:  call I2cStart
        ld a,$d2
        call I2cWrite
        ld a,$08
        call I2cWrite
        ld a,$77
        call I2cWrite
        call I2cStop
        jr $`,
      { entry: "Other" }
    );
    s.runFrames(1);
    await boot(s);
    expect(rtcRead(s, 0x08, 1), "RAM $08").toEqual([0x11]);
  });

  // -------------------------------------------------------------------------------------------------
  // I2C-003 Reading the time
  // -------------------------------------------------------------------------------------------------

  it("I2C-003: registers 0-6 read back the set time in BCD, and it runs in whole seconds", async () => {
    const s = await driver(core);
    const set: RtcTime = { year: 2026, month: 9, date: 18, day: 6, hours: 12, minutes: 34, seconds: 56 };
    s.setRtcTime(set);
    expect(hexes(rtcRead(s, 0, 7)), "at once").toEqual(hexes(regs(set)));
    s.runFrames(UNDER_ONE_SECOND - 1);
    expect(hexes(rtcRead(s, 0, 1)), "under a second").toEqual(["$56"]);
    s.runFrames(OVER_ONE_SECOND - UNDER_ONE_SECOND);
    expect(hexes(rtcRead(s, 0, 7)), "over a second").toEqual(hexes(regs({ ...set, seconds: 57 })));
  });

  it.each([
    ["the day ends", { year: 26, month: 9, date: 18, day: 6, hours: 23, minutes: 59, seconds: 59 }, { year: 26, month: 9, date: 19, day: 7, hours: 0, minutes: 0, seconds: 0 }],
    ["the week wraps", { year: 26, month: 9, date: 19, day: 7, hours: 23, minutes: 59, seconds: 59 }, { year: 26, month: 9, date: 20, day: 1, hours: 0, minutes: 0, seconds: 0 }],
    ["a 30-day month ends", { year: 26, month: 4, date: 30, day: 5, hours: 23, minutes: 59, seconds: 59 }, { year: 26, month: 5, date: 1, day: 6, hours: 0, minutes: 0, seconds: 0 }],
    ["February, leap year", { year: 24, month: 2, date: 28, day: 4, hours: 23, minutes: 59, seconds: 59 }, { year: 24, month: 2, date: 29, day: 5, hours: 0, minutes: 0, seconds: 0 }],
    ["February, not leap", { year: 25, month: 2, date: 28, day: 6, hours: 23, minutes: 59, seconds: 59 }, { year: 25, month: 3, date: 1, day: 7, hours: 0, minutes: 0, seconds: 0 }],
    ["year 00 is leap", { year: 0, month: 2, date: 28, day: 2, hours: 23, minutes: 59, seconds: 59 }, { year: 0, month: 2, date: 29, day: 3, hours: 0, minutes: 0, seconds: 0 }],
    ["the century ends", { year: 99, month: 12, date: 31, day: 6, hours: 23, minutes: 59, seconds: 59 }, { year: 0, month: 1, date: 1, day: 7, hours: 0, minutes: 0, seconds: 0 }]
  ])("I2C-003: rollover when %s", async (_what, from, to) => {
    const s = await driver(core);
    s.setRtcTime(from as RtcTime).runFrames(OVER_ONE_SECOND);
    expect(hexes(rtcRead(s, 0, 7))).toEqual(hexes(regs(to as RtcTime)));
  });

  it("I2C-003: 12-hour mode: 11 AM becomes 12 PM, 11 PM becomes 12 AM of the next day", async () => {
    const s = await driver(core);
    s.setRtcTime({ year: 26, month: 9, date: 18, day: 6, hours: 0, minutes: 0, seconds: 0 });
    // --- hours register: bit 6 = 12-hour mode, bit 5 = PM
    rtcWrite(s, 0, [0x59, 0x59, 0x51]);
    s.runFrames(OVER_ONE_SECOND);
    expect(hexes(rtcRead(s, 0, 5)), "11:59:59 AM").toEqual(hexes([0x00, 0x00, 0x72, 0x06, 0x18]));
    rtcWrite(s, 0, [0x59, 0x59, 0x71]);
    s.runFrames(OVER_ONE_SECOND);
    expect(hexes(rtcRead(s, 0, 5)), "11:59:59 PM").toEqual(hexes([0x00, 0x00, 0x52, 0x07, 0x19]));
    rtcWrite(s, 0, [0x59, 0x59, 0x52]);
    s.runFrames(OVER_ONE_SECOND);
    expect(hexes(rtcRead(s, 2, 1)), "12:59:59 AM").toEqual(["$41"]);
  });

  it("I2C-003: a read takes the time copied at its START, while the clock runs on", async () => {
    const s = await createSession(core);
    // --- The DS1307 fetches each byte at the master's ACK of the one before: the pause falls between
    // --- reading the minutes and fetching the hours, 12 -> 13 on the running clock
    s.setRtcTime({ year: 26, month: 9, date: 18, day: 6, hours: 12, minutes: 59, seconds: 59 });
    await s.loadCode(
      `
        .org $8000
Start:  di
        call I2cStart
        ld a,$d0
        call I2cWrite
        xor a
        call I2cWrite
        call I2cStart
        ld a,$d1
        call I2cWrite
        or a
        call I2cRead
        ld (Held),a
        nextreg $7f,$a5
Wait:   ld a,(Cmd)
        or a
        jr z,Wait
        or a
        call I2cRead
        ld (Held+1),a
        scf
        call I2cRead
        ld (Held+2),a
        call I2cStop
        ld a,3
        ld (Cnt),a
        xor a
        ld (Ptr),a
        call RtcRead
        xor a
        ld (Cmd),a
        jr $
${I2C_LIB}
Cmd:    .defb 0
Ptr:    .defb 0
Cnt:    .defb 0
Left:   .defb 0
Held:   .defs 3
Buf:    .defs 64`,
      { entry: "Start" }
    );
    s.runUntilReady();
    // --- The second rolls over while the read is held open
    s.runFrames(OVER_ONE_SECOND).poke(s.symbol("Cmd"), 1);
    s.runUntil((t) => t.peek(t.symbol("Cmd")) === 0, "the rest of the read", { maxFrames: 3 });
    expect(hexes(Array.from(s.peekBytes(s.symbol("Held"), 3))), "one START").toEqual(["$59", "$59", "$12"]);
    expect(hexes(Array.from(s.peekBytes(s.symbol("Buf"), 3))), "the next START").toEqual(["$00", "$00", "$13"]);
  });

  // -------------------------------------------------------------------------------------------------
  // I2C-004 Writing
  // -------------------------------------------------------------------------------------------------

  it("I2C-004: a written time, the control register and the 56 RAM bytes read back", async () => {
    const s = await driver(core);
    const time = regs({ year: 1, month: 2, date: 3, day: 4, hours: 5, minutes: 6, seconds: 7 });
    rtcWrite(s, 0, [...time, 0x10]);
    expect(hexes(rtcRead(s, 0, 8))).toEqual(hexes([...time, 0x10]));
    const ram = Array.from({ length: 56 }, (_, i) => (i * 37 + 5) & 0xff);
    rtcWrite(s, 0x08, ram);
    expect(rtcRead(s, 0x08, 56)).toEqual(ram);
  });

  it("I2C-004: the register pointer wraps from $3F to $00 and stays between transactions", async () => {
    const s = await driver(core);
    s.setRtcTime({ year: 26, month: 9, date: 18, day: 6, hours: 12, minutes: 34, seconds: 56 });
    rtcWrite(s, 0x3e, [0xaa, 0xbb]);
    expect(hexes(rtcRead(s, 0x3e, 4))).toEqual(hexes([0xaa, 0xbb, 0x56, 0x34]));
    // --- A write of the pointer alone, then a read with no pointer ("current address read")
    rtcWrite(s, 0x3f, []);
    await s.loadCode(
      `${DRIVER}
Current: call I2cStart
        ld a,$d1
        call I2cWrite
        scf
        call I2cRead
        ld (Buf),a
        call I2cStop
        jr $`,
      { entry: "Current" }
    );
    s.runFrames(1);
    expect(hexes([s.peek(s.symbol("Buf"))])).toEqual(["$bb"]);
  });

  it("I2C-004: writing the seconds restarts the second", async () => {
    const s = await driver(core);
    s.setRtcTime({ year: 26, month: 9, date: 18, day: 6, hours: 12, minutes: 0, seconds: 10 });
    s.runFrames(30); // --- 0.6 s into the second
    rtcWrite(s, 0, [0x30]);
    s.runFrames(29); // --- 0.6 s after the write, 1.2 s after the set time
    expect(hexes(rtcRead(s, 0, 1)), "the old second would have ended").toEqual(["$30"]);
    s.runFrames(29);
    expect(hexes(rtcRead(s, 0, 1)), "1.2 s after the write").toEqual(["$31"]);
  });

  it("I2C-004: CH (seconds bit 7) stops the clock; clearing it starts it again", async () => {
    const s = await driver(core);
    s.setRtcTime({ year: 26, month: 9, date: 18, day: 6, hours: 12, minutes: 0, seconds: 0 });
    rtcWrite(s, 0, [0x80 | 0x15]);
    s.runFrames(2 * OVER_ONE_SECOND);
    expect(hexes(rtcRead(s, 0, 2)), "halted").toEqual(["$95", "$00"]);
    rtcWrite(s, 0, [0x15]);
    s.runFrames(OVER_ONE_SECOND);
    expect(hexes(rtcRead(s, 0, 1)), "running").toEqual(["$16"]);
  });

  it("I2C-004: the DS1307 is battery backed: Next resets keep its RAM and its time", async () => {
    const s = await driver(core);
    rtcWrite(s, 0, regs({ year: 1, month: 2, date: 3, day: 4, hours: 5, minutes: 6, seconds: 7 }));
    rtcWrite(s, 0x08, [0x5a, 0xa5]);
    s.reset();
    await boot(s);
    expect(hexes(rtcRead(s, 0x08, 2)), "soft reset: RAM").toEqual(["$5a", "$a5"]);
    expect(hexes(rtcRead(s, 4, 3)), "soft reset: date").toEqual(["$03", "$02", "$01"]);
    s.hardReset();
    await boot(s);
    expect(hexes(rtcRead(s, 0x08, 2)), "hard reset: RAM").toEqual(["$5a", "$a5"]);
    expect(hexes(rtcRead(s, 4, 3)), "hard reset: date").toEqual(["$03", "$02", "$01"]);
  });

  // -------------------------------------------------------------------------------------------------
  // I2C-006 Port enable
  // -------------------------------------------------------------------------------------------------

  it("I2C-006: with $83 bit 2 clear both ports read $FF and ignore writes", async () => {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n di\n jr $");
    s.out(SCL, 0);
    s.setNextReg(0x83, s.readNextReg(0x83) & ~0x04);
    expect([s.in(SCL), s.in(SDA)], "disabled").toEqual([0xff, 0xff]);
    s.out(SCL, 1).out(SDA, 0);
    s.setNextReg(0x83, s.readNextReg(0x83) | 0x04);
    expect([s.in(SCL), s.in(SDA)], "the writes did nothing").toEqual([0xfe, 0xff]);
  });
});
