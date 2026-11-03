import { createSession, type NextTestSession, type RtcTime } from "../../harness/zxnext";

/*
 * The I2C master and the DS1307 driver the I2C tests share: bit-banged routines on $103B/$113B and a
 * resident program that reads, writes and probes the bus on command. See i2c-rtc.test.ts for the
 * hardware it exercises.
 */

export const SCL = 0x103b;
export const SDA = 0x113b;

/** Bit-banged I2C master routines (BC, DE, A, F; HL preserved). */
export const I2C_LIB = `
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
export const DRIVER = `
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

export async function boot(s: NextTestSession): Promise<NextTestSession> {
  s.setNextReg(0x7f, 0); // --- $7F survives a soft reset
  await s.loadCode(DRIVER, { entry: "Start" });
  return s.runUntilReady();
}

export async function driver(): Promise<NextTestSession> {
  return boot(await createSession());
}

export function command(s: NextTestSession, cmd: number, ptr: number, cnt: number): void {
  s.poke(s.symbol("Ptr"), ptr).poke(s.symbol("Cnt"), cnt).poke(s.symbol("Cmd"), cmd);
  s.runUntil((t) => t.peek(t.symbol("Cmd")) === 0, "the I2C command", { maxFrames: 3 });
}

export function rtcRead(s: NextTestSession, pointer: number, count: number): number[] {
  command(s, 1, pointer, count);
  return Array.from(s.peekBytes(s.symbol("Buf"), count));
}

export function rtcWrite(s: NextTestSession, pointer: number, bytes: number[]): void {
  s.poke(s.symbol("Buf"), bytes);
  command(s, 2, pointer, bytes.length);
}

/** The ACK bit the addressed device returns (0 = ACK). */
export function addressAck(s: NextTestSession, address: number): number {
  command(s, 3, address, 0);
  return s.peek(s.symbol("Buf"));
}

/** The time registers 0-6 as BCD: [sec, min, hour, day, date, month, year]. */
export const regs = (t: RtcTime) =>
  [t.seconds, t.minutes, t.hours, t.day, t.date, t.month, t.year % 100].map((v, i) => (i === 3 ? v : ((v / 10) << 4) | v % 10));

export const hexes = (bytes: number[]) => bytes.map((b) => "$" + b.toString(16).padStart(2, "0"));

/** 0.9 s and 1.1 s in frames at 50.1 and 49.4 frames per second */
export const UNDER_ONE_SECOND = 44;
export const OVER_ONE_SECOND = 55;
