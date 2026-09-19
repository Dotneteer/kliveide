import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ALL_CORES } from "../core/machines";
import { createSession, onEachCore } from "../script/session";

/*
 * The scripting layer on both cores. Every method a test may rely on is exercised here, so a method
 * that silently does nothing on one core fails in this file first.
 */

const VISUAL_CASES = resolve(__dirname, "../../../visual");

describe.each(ALL_CORES)("harness session - %s core", (core) => {
  it("loadCode + runTo + registers: runs assembled code to a label", async () => {
    const s = await createSession(core);
    const p = await s.loadCode(`
      .org $8000
    Start:
      ld a,$42
      ld hl,$1234
    Done:
      jr Done
    `);
    expect(p.entry).toBe(0x8000);
    s.runTo("Done");
    expect(s.registers()).toMatchObject({ pc: s.symbol("Done"), a: 0x42, hl: 0x1234 });
  });

  it("step executes exactly one instruction per count", async () => {
    const s = await createSession(core);
    await s.loadCode(`
      .org $8000
      ld a,1
      ld b,2
      ld c,3
      jr $
    `);
    s.step();
    expect(s.registers()).toMatchObject({ pc: 0x8002, a: 1 });
    s.step(2);
    expect(s.registers()).toMatchObject({ pc: 0x8006, bc: 0x0203 });
  });

  it("call runs a routine and returns", async () => {
    const s = await createSession(core);
    await s.loadCode(`
      .org $8000
    Idle:
      jr Idle
    Double:
      add a,a
      ret
    `);
    s.setRegisters({ a: 21 });
    s.call("Double");
    expect(s.registers()).toMatchObject({ a: 42, pc: s.symbol("Idle"), sp: 0xbff0 });
  });

  it("memory, ports and NextRegs go through the hardware paths", async () => {
    const s = await createSession(core);
    await s.loadCode(` .org $8000\n jr $`);
    s.poke(0xc000, [1, 2, 3]).pokeWord(0xc010, 0xbeef);
    expect(Array.from(s.peekBytes(0xc000, 3))).toEqual([1, 2, 3]);
    expect(s.peekWord(0xc010)).toBe(0xbeef);

    s.setNextReg(0x14, 0x5a); // global transparency: plain read/write register
    expect(s.readNextReg(0x14)).toBe(0x5a);
    expect(s.nextRegValue(0x14)).toBe(0x5a);

    s.setNextReg(0x56, 20); // MMU slot 6 -> page 20: $C000 now shows different RAM
    expect(s.peek(0xc000)).not.toBe(1);
    s.setNextReg(0x56, 0);
    expect(s.peek(0xc000)).toBe(1);
  });

  it("Z80 code writing a NextReg is visible, and runUntilReady waits for the marker", async () => {
    const s = await createSession(core);
    await s.loadCode(`
      .org $8000
      ld bc,$4000       ; ~26 T-states x 16384: a few frames at 3.5 MHz
    Delay:
      dec bc
      ld a,b
      or c
      jr nz,Delay
      nextreg $7F,$A5
      jr $
    `);
    s.runUntilReady({ maxFrames: 50 });
    expect(s.nextRegValue(0x7f)).toBe(0xa5);
    expect(s.frames).toBeGreaterThanOrEqual(3);
  });

  it("pressHotkey: F8 steps the CPU speed, F5/F6 switch the expansion bus", async () => {
    const s = await createSession(core);
    await s.pressHotkey("F8");
    expect(s.readNextReg(0x07)).toBe(0x11);
    await s.pressHotkey("F5");
    expect(s.readNextReg(0x80) & 0x80).toBe(0x80);
    expect(s.readNextReg(0x07), "the bus forces 3.5 MHz").toBe(0x01);
    await s.pressHotkey("F6");
    expect(s.readNextReg(0x80) & 0x80).toBe(0x00);
    expect(s.readNextReg(0x07)).toBe(0x11);
  });

  it("pressHotkey: F9 / F10 press the M1 / DRIVE NMI buttons", async () => {
    for (const [key, enable] of [["F9", 0x08], ["F10", 0x10]] as const) {
      const s = await createSession(core);
      await s.loadCode(` .org $8000\n jr $`);
      s.setNextReg(0x06, enable).runFrames(1);
      await s.pressHotkey(key);
      s.runTo(0x0066, { maxFrames: 2 });
      expect(s.peekWord(s.registers().sp), `${key}: return address on the stack`).toBe(0x8000);
    }
  });

  it("reset is a soft reset: PC back to 0, RAM kept", async () => {
    const s = await createSession(core);
    await s.loadCode(` .org $8000\n ld a,1\n jr $`);
    s.poke(0xc000, 0x5a).runFrames(1);
    s.reset();
    expect(s.registers().pc).toBe(0);
    s.setNextReg(0x56, 0); // --- reset re-pages slot 6; look at page 0 again
    expect(s.peek(0xc000)).toBe(0x5a);
  });

  it("runs fail with the PC instead of hanging", async () => {
    const s = await createSession(core);
    await s.loadCode(` .org $8000\n jr $`);
    expect(() => s.runUntilReady({ maxFrames: 3 })).toThrow(/Timed out after 3 frames.*PC=\$8000/);
    expect(() => s.runTo(0x9000, { maxFrames: 2 })).toThrow(/running to \$9000/);
  });

  it("loadProgramFile + screen probes: the T00 picture", async () => {
    const s = await createSession(core);
    await s.loadProgramFile(resolve(VISUAL_CASES, "copper/T00-static-ula/program.asm"));
    s.runUntilReady().runFrames(2);
    expect(s.pixel(0, 0)).toBe("#B60000"); // red border
    s.expectProbe({ kind: "rect", x: [96, 607], y: [48, 239], rgb: "ula:6" });
    expect(() => s.expectProbe({ kind: "pixel", x: 0, y: 0, rgb: "ula:1" })).toThrow(/expected #0000B6, is #B60000/);
  });

  it("audio: records the mixer's samples frame by frame", async () => {
    const s = await createSession(core, { audioSampleRate: 44_100 });
    await s.loadCode(` .org $8000\n jr $`);
    s.startAudio().runFrames(5);
    const n = s.audio().length;
    expect(n).toBeGreaterThan(4 * 800);
    expect(n).toBeLessThan(6 * 900);
  });

  it("attachSdCard: a sector read's frame command is answered from the image; sync runs refuse it", async () => {
    // --- select SD card 0, CMD17 for sector 3, poll for the $FE token, read 512 bytes to $A000
    const program = `
        .org $8000
        ld a,$fe
        out ($e7),a
        ld hl,Cmd
        ld bc,$06eb
        otir
        ld de,4000
Tok:    in a,(c)
        cp $fe
        jr z,Data
        dec de
        ld a,d
        or e
        jr nz,Tok
Data:   ld hl,$a000
        ld b,0
        inir
        inir
        nextreg $7f,$a5
        jr $
Cmd:    .defb $51,0,0,0,3,$01`;
    const image = new Uint8Array(16 * 512);
    for (let i = 0; i < 512; i++) image[3 * 512 + i] = (i * 5 + 1) & 0xff;

    const s = await createSession(core);
    await s.loadCode(program);
    s.attachSdCard(image);
    await s.runUntilReadyAsync();
    expect(Array.from(s.peekBytes(0xa000, 512))).toEqual(Array.from(image.subarray(3 * 512, 4 * 512)));
    expect(s.sdCalls.readSdCardSector).toBe(1);

    const t = await createSession(core);
    await t.loadCode(program);
    expect(() => t.runUntilReady()).toThrow(/frame command/);
  });

  it("mouse: packets move the Kempston counters; buttons stay held until the next packet names them", async () => {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n di\n jr $");
    expect([s.in(0xfbdf), s.in(0xffdf), s.in(0xfadf)], "power-on").toEqual([0x00, 0x00, 0x0f]);
    s.mouse({ dx: 3, dy: -2, wheel: 1, buttons: ["left"] });
    expect([s.in(0xfbdf), s.in(0xffdf), s.in(0xfadf)], "one packet").toEqual([0x03, 0xfe, 0x1d]);
    s.mouse({ dx: 1 });
    expect([s.in(0xfbdf), s.in(0xfadf)], "left still held").toEqual([0x04, 0x1d]);
    expect(() => s.mouse({ dx: 300 }), "a PS/2 packet's range").toThrow(/-255..255/);
  });

  it("joystick: buttons reach the Kempston port, the MD pad's extra buttons $B2", async () => {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n di\n jr $");
    s.setNextReg(0x05, 0x48); // --- left: MD 1 on $1F
    expect(s.in(0x1f), "nothing pressed").toBe(0x00);
    s.joystick("left", "UP", "B", "START");
    expect(s.in(0x1f), "UP, fire, START").toBe(0x98);
    s.joystick("left", "X").joystick("right", "MODE");
    expect([s.in(0x1f), s.readNextReg(0xb2)], "X, right MODE").toEqual([0x00, 0x18]);
    s.joystick("right");
    expect(s.readNextReg(0xb2), "right released").toBe(0x08);
  });

  it("keyDown / keyUp: matrix keys reach $xxFE, extra keys $B0 and their matrix combination", async () => {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n di\n jr $");
    expect(s.in(0xfbfe) & 0x1f, "nothing pressed").toBe(0x1f);
    s.keyDown("Q").runFrames(1);
    expect(s.in(0xfbfe) & 0x1f, "Q: row A10, bit 0").toBe(0x1e);
    s.keyUp("Q").keyDown("UP").runFrames(1);
    expect(s.readNextReg(0xb0), "UP in $B0").toBe(0x08);
    expect([s.in(0xfefe) & 0x1f, s.in(0xeffe) & 0x1f], "UP = CAPS + 7").toEqual([0x1e, 0x17]);
    s.keyUp("UP").runFrames(1);
    expect([s.readNextReg(0xb0), s.in(0x00fe) & 0x1f], "released").toEqual([0x00, 0x1f]);
  });

  it("setRtcTime: the DS1307 on the I2C bus reports the set year", async () => {
    // --- Minimal bit-banged read of register 6 (year): START $D0 $06, START $D1, 8 bits, NACK, STOP
    const program = `
        .org $8000
        ld bc,$113b
        ld e,$d0
        call Start
        call Byte
        ld e,$06
        call Byte
        ld e,$d1
        call Start
        call Byte
        ld d,8
Rd:     ld b,$10
        ld a,1
        out (c),a
        ld b,$11
        in a,(c)
        rra
        rl l
        ld b,$10
        xor a
        out (c),a
        dec d
        jr nz,Rd
        ld a,l
        ld ($9000),a
        nextreg $7f,$a5
        jr $
Start:  ld b,$11
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
Byte:   ld d,8
Bit:    ld b,$11
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
        jr nz,Bit
        ld b,$11
        ld a,1
        out (c),a
        ld b,$10
        out (c),a
        xor a
        out (c),a
        ret`;
    for (const year of [31, 2047]) {
      const s = await createSession(core);
      s.setRtcTime({ year, month: 1, date: 1, day: 1, hours: 0, minutes: 0, seconds: 0 });
      await s.loadCode(program);
      s.runUntilReady();
      expect(s.peek(0x9000), `year ${year}`).toBe(year === 31 ? 0x31 : 0x47);
    }
  });

  it("UART peer: frames arrive with time, output collects what the Next sends, CTS/RTR/loopback/break act", async () => {
    // --- A Z80 echo: every received byte goes back out on UART 0
    const s = await createSession(core);
    await s.loadCode(`
        .org $8000
        ld bc,$133b
Wait:   in a,(c)
        rra
        jr nc,Wait
        ld b,$14
        in a,(c)
        ld b,$13
        out (c),a
        jr Wait`);
    s.uartSend(0, [1, 2, 3]);
    expect(s.uartOutput(0), "nothing before time runs").toEqual([]);
    s.runFrames(1);
    expect(s.uartOutput(0), "echoed").toEqual([1, 2, 3]);
    expect(s.uartOutput(1), "UART 1 untouched").toEqual([]);

    // --- A break sets status bit 7 (visible to the program as a pause in echoing)
    const p = await createSession(core);
    await p.loadCode(" .org $8000\n di\n jr $");
    p.uartBreak(0, true).runFrames(1);
    expect(p.in(0x133b) & 0x80, "break").toBe(0x80);
    p.uartBreak(0, false).runFrames(1);
    expect(p.in(0x133b) & 0x80, "released").toBe(0);

    // --- Loopback wires TX to RX; CTS holds the transmitter only with flow control on
    p.uartLoopback(0, true).out(0x163b, 0x38).uartSetCts(0, false).out(0x133b, 0x42).runFrames(1);
    expect(p.in(0x133b) & 0x01, "held by CTS").toBe(0);
    p.uartSetCts(0, true).runFrames(1);
    expect(p.in(0x143b), "looped back").toBe(0x42);
    p.uartLoopback(0, false).uartSend(0, Array(600).fill(0x55)).runFrames(5);
    expect(p.uartReadyToReceive(0), "RTR with flow control and a full FIFO").toBe(false);
  });
});

describe("harness session - parity", () => {
  it("onEachCore returns per-core results for comparison", async () => {
    const r = await onEachCore(async (s) => {
      await s.loadCode(` .org $8000\n ld a,7\n add a,a\n jr $`);
      s.step(2);
      return s.registers().a;
    });
    expect(r).toEqual({ ts: 14, wasm: 14 });
  });
});
