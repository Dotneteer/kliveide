import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * CPU speed - NextReg $07, the expansion bus override and the $06 hotkey enable (catalogue
 * SPD-001 - SPD-007).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~5729-5739: `nr_07_cpu_speed` is reset to "00", loaded from a `$07` write (bits 1-0) and
 *   incremented by the F8 hotkey.
 * - ~5742-5770: `cpu_speed` (the actual speed) follows `nr_07_cpu_speed` whenever the CPU is between
 *   bus cycles - unless the expansion bus is enabled (`$80` bit 7), when it takes `expbus_speed`,
 *   which is `nr_81_expbus_speed`, hard-wired to "00" (~5472, ~2159).
 * - ~5849: `$07` reads "00" & cpu_speed & "00" & nr_07_cpu_speed.
 * - ~3168-3178: at 28 MHz every CPU memory read from SRAM or bank 5 gets one wait state; bank 7's
 *   first 8K page ($0E, ~2918) is BRAM with no wait.
 * - ~4469: in 48K timing only bank 5 is contended, and contention is off above 3.5 MHz (~4461).
 * - ~1970-2000: the ULA interrupt pulse lasts 32 CPU cycles in 48K timing, counted on the CPU clock.
 * - ~6290-6293: F5/F6/F8 act only while `$06` bit 7 (`nr_06_hotkey_cpu_speed_en`, reset 1, ~4910)
 *   is set; writing `$06` itself never touches the speed.
 *
 * The frame is 28 MHz clocks, so it lasts the same real time at every speed: 8 x 69888 of them in
 * 48K timing (zxula_timing.vhd). A loop that runs N times per frame at 3.5 MHz runs 2N / 4N / 8N
 * times at 7 / 14 / 28 MHz when it has no wait states.
 */

const SPEEDS = [0, 1, 2, 3];
const MHZ = ["3.5", "7", "14", "28"];

/** 48K timing (`$03` bit 7 + timing 001, low bits 000 leave the machine type alone). */
const TIMING_48K = 0x90;
const FRAME_TACTS_48K = 69888;

/** Tacts of one iteration of the counting loop: INC HL (6) + LD A,(nn) (13) + CP B (4) + JR Z (12). */
const LOOP_TACTS = 35;
/** Memory reads of one iteration: 1 + 4 + 1 + 2 - the 28 MHz wait states it takes outside bank 7. */
const LOOP_READS = 8;

/**
 * The IM 2 frame-interrupt counter every program here uses. `Ticks` is 8 bits, incremented by the
 * handler; the vector table sits at $B000 (bank 2), the handler at $B2B2 jumps to `Handler`.
 */
const IM2_SETUP = `
        ld a,$b0
        ld i,a
        im 2
        ld hl,$b000
        ld (hl),$b2
        ld de,$b001
        ld bc,$0100
        ldir
        ld a,$c3
        ld ($b2b2),a
        ld hl,Handler
        ld ($b2b3),hl
`;

/**
 * The frame counter: waits for a frame interrupt, then counts loop iterations until the next one.
 * It is assembled at $6000 (bank 5) and copied, through a staging area at $A000, into MMU slot 3
 * mapped to `page`: $0E is bank 7's BRAM (no 28 MHz wait state), $10 is SRAM (bank 8). Neither is
 * contended in 48K timing. `Ticks` lives in the same page, so every read the loop makes is there.
 *
 * `middle` runs between the first interrupt and the count (for SPD-004).
 */
type CounterOptions = { startSpeed: number; page?: number; middle?: string; setup?: string };

const BANK7_PAGE = 0x0e;
const SRAM_PAGE = 0x10;

function counterProgram(opts: CounterOptions): string {
  return `
        .org $8000
Start:
        nextreg $03,${TIMING_48K}
${opts.setup ?? ""}
${IM2_SETUP}
        ld hl,Counter            ; stage the counter in bank 2, map the page at $6000, copy it back
        ld de,$a000
        ld bc,CounterEnd-Counter
        ldir
        nextreg $53,${opts.page ?? BANK7_PAGE}
        ld hl,$a000
        ld de,Counter
        ld bc,CounterEnd-Counter
        ldir
        nextreg $07,${opts.startSpeed}
        call Counter
        nextreg $7f,$a5
Stop:   jr Stop

Handler:
        push af
        ld a,(Ticks)
        inc a
        ld (Ticks),a
        pop af
        ei
        reti

        .org $6000
Counter:
        ei
        halt                     ; wakes right after a frame interrupt
        ld a,(Ticks)
        ld b,a
${opts.middle ?? ""}
        ld hl,0
Count:  inc hl
        ld a,(Ticks)
        cp b
        jr z,Count
        di
        ld (Result),hl
        ret
Ticks:  .defb 0
Result: .defw 0
CounterEnd:
`;
}

/** Runs `counterProgram` and returns the iteration count of the measured frame. */
async function count(opts: CounterOptions): Promise<number> {
  const s = await createSession();
  await s.loadCode(counterProgram(opts), { entry: "Start" });
  s.runUntilReady({ maxFrames: 10 });
  return s.peekWord(s.symbol("Result"));
}

/** Reads NextReg `reg` the way software does: select through $243B, read $253B. */
const READ_NEXTREG = (reg: number, store: string) => `
        ld bc,$243b
        ld a,${reg}
        out (c),a
        inc b
        in a,(c)
        ld (${store}),a
`;

const within = (actual: number, expected: number, fraction: number) =>
  Math.abs(actual - expected) <= expected * fraction;

describe("CPU speed", () => {
  // --- SPD-001: ~5849 - bits 1-0 the programmed speed, bits 5-4 the actual one, the rest 0
  it("SPD-001: $07 reads the programmed speed in bits 1-0 and the actual speed in bits 5-4", async () => {
    const s = await createSession();
    const writes = [0x00, 0x01, 0x02, 0x03, 0xfd, 0xfe, 0x00];
    await s.loadCode(`
        .org $8000
        ${READ_NEXTREG(0x07, "$a000")}
${writes
  .map(
    (v, i) => `
        nextreg $07,${v}
        ${READ_NEXTREG(0x07, `$a001+${i}`)}`
  )
  .join("")}
        nextreg $7f,$a5
        jr $
    `);
    s.runUntilReady();
    expect(s.peek(0xa000), "after hard reset").toBe(0x00);
    const read = Array.from(s.peekBytes(0xa001, writes.length));
    expect(read.map((v) => v.toString(16))).toEqual(
      writes.map((v) => (((v & 0x03) << 4) | (v & 0x03)).toString(16))
    );
  });

  it("SPD-001: a soft reset returns the speed to 3.5 MHz", async () => {
    const s = await createSession();
    s.setNextReg(0x07, 0x03).reset();
    expect(s.readNextReg(0x07)).toBe(0x00);
  });

  // --- SPD-002: the loop runs from bank 7 (no wait states) with 48K timing (not contended)
  it("SPD-002: the loop count per frame doubles with each speed step", async () => {
    const counts: number[] = [];
    for (const speed of SPEEDS) counts.push(await count({ startSpeed: speed }));

    // --- One frame minus the interrupt handling (~200 tacts) at 35 tacts per iteration
    expect(counts[0], "3.5 MHz iterations per 48K frame").toBeGreaterThan((FRAME_TACTS_48K - 400) / LOOP_TACTS);
    expect(counts[0]).toBeLessThanOrEqual(FRAME_TACTS_48K / LOOP_TACTS);
    for (const speed of [1, 2, 3]) {
      const expected = counts[0] * (1 << speed);
      expect(within(counts[speed], expected, 0.01), `${MHZ[speed]} MHz: ${counts[speed]}, expected ~${expected}`).toBe(true);
    }
  });

  it("SPD-002: at 28 MHz every SRAM read adds a wait state", async () => {
    const base = await count({ startSpeed: 0 });
    const fast = await count({ startSpeed: 3, page: SRAM_PAGE });
    // --- 8x the clock, but 35 + 8 tacts per iteration instead of 35
    const expected = (base * 8 * LOOP_TACTS) / (LOOP_TACTS + LOOP_READS);
    expect(within(fast, expected, 0.01), `28 MHz from SRAM: ${fast}, expected ~${expected.toFixed(0)}`).toBe(true);
  });

  // --- SPD-003: the frame is 28 MHz clocks; the ULA interrupt comes once per frame at every speed
  for (const speed of SPEEDS) {
    it(`SPD-003: ${MHZ[speed]} MHz takes one ULA interrupt per frame`, async () => {
      const s = await createSession();
      await s.loadCode(`
        .org $8000
Start:
        nextreg $03,${TIMING_48K}
${IM2_SETUP}
        nextreg $07,${speed}
        ei
        nextreg $7f,$a5
Spin:   jr Spin                  ; no HALT: a long INT pulse would be taken twice

Handler:
        push af
        ld a,(Ticks)
        inc a
        ld (Ticks),a
        pop af
        ei
        reti
Ticks:  .defb 0
      `, { entry: "Start" });
      s.runUntilReady().runFrames(1);
      const ticks = s.peek(s.symbol("Ticks"));
      const tacts = s.tacts;
      const frames = s.frames;
      s.runFrames(50);
      expect(s.frames - frames).toBe(50);
      expect((s.peek(s.symbol("Ticks")) - ticks) & 0xff, "interrupts in 50 frames").toBe(50);
      // --- the CPU runs 8 >> (3 - speed) times the 3.5 MHz tacts in the same frames
      expect(Math.abs(s.tacts - tacts - 50 * FRAME_TACTS_48K * (1 << speed))).toBeLessThan(50);
    });
  }

  /*
   * The INT pulse is 32 CPU cycles long at every speed (~1989, 48K timing), so a CPU that samples INT
   * between instructions of 23 tacts (27 with the 28 MHz wait states) always sees it. A pulse of fewer
   * tacts than an instruction would fall inside one in some frames and be lost.
   */
  for (const speed of SPEEDS) {
    it(`SPD-003: ${MHZ[speed]} MHz never misses the pulse between 23-tact instructions`, async () => {
      const s = await createSession();
      await s.loadCode(`
        .org $8000
Start:
        nextreg $03,${TIMING_48K}
${IM2_SETUP}
        nextreg $07,${speed}
        ld ix,0
        ei
        nextreg $7f,$a5
Spin:   ex (sp),ix               ; 23 tacts each; the loop drifts 48 tacts against the frame
        ex (sp),ix
        ex (sp),ix
        ex (sp),ix
        ex (sp),ix
        ex (sp),ix
        ex (sp),ix
        ex (sp),ix
        jp Spin

Handler:
        push af
        ld a,(Ticks)
        inc a
        ld (Ticks),a
        pop af
        ei
        reti
Ticks:  .defb 0
      `, { entry: "Start" });
      s.runUntilReady().runFrames(1);
      const ticks = s.peek(s.symbol("Ticks"));
      s.runFrames(50);
      expect((s.peek(s.symbol("Ticks")) - ticks) & 0xff, "interrupts in 50 frames").toBe(50);
    });
  }

  // --- SPD-004: cpu_speed follows nr_07 at the next idle bus state, so the rest of the frame runs at
  // --- the new speed. The first half of the frame is a delay loop at the start speed.
  const SWITCHES: Array<[from: number, to: number, delay: number]> = [
    [0, 3, 1344], // --- 1344 x 26 = 34944 tacts at 3.5 MHz: half a 48K frame
    [3, 0, 10752], // --- 10752 x 26 = 279552 tacts at 28 MHz: the same real time
    [1, 2, 2688]
  ];
  for (const [from, to, delay] of SWITCHES) {
    it(`SPD-004: switching ${MHZ[from]} -> ${MHZ[to]} MHz mid-frame speeds up the rest of the frame`, async () => {
      const base = await count({ startSpeed: 0 });
      const measured = await count({
        startSpeed: from,
        middle: `
        ld hl,${delay}
Delay:  dec hl                   ; 6 + 4 + 4 + 12 = 26 tacts
        ld a,h
        or l
        jr nz,Delay
        nextreg $07,${to}`
      });
      // --- In 28 MHz clocks: the frame is 8 x 35 x base; the delay took delay x 26 x (8 >> from).
      const frame28 = 8 * LOOP_TACTS * base;
      const expected = (frame28 - delay * 26 * (8 >> from)) / (LOOP_TACTS * (8 >> to));
      expect(within(measured, expected, 0.01), `${measured}, expected ~${expected.toFixed(0)}`).toBe(true);
    });
  }

  // --- SPD-005: with $80 bit 7 set cpu_speed takes expbus_speed, which is always "00"
  it("SPD-005: the expansion bus forces the actual speed to 3.5 MHz", async () => {
    const s = await createSession();
    await s.loadCode(`
        .org $8000
        nextreg $80,$80          ; bus on, then ask for 28 MHz
        nextreg $07,$03
        ${READ_NEXTREG(0x07, "$a000")}
        nextreg $80,$00          ; bus off: the programmed speed applies
        ${READ_NEXTREG(0x07, "$a001")}
        nextreg $07,$02          ; 14 MHz, then bus on
        nextreg $80,$80
        ${READ_NEXTREG(0x07, "$a002")}
        nextreg $80,$00
        ${READ_NEXTREG(0x07, "$a003")}
        nextreg $7f,$a5
        jr $
    `);
    s.runUntilReady();
    expect(Array.from(s.peekBytes(0xa000, 4)).map((v) => v.toString(16))).toEqual(["3", "33", "2", "22"]);
  });

  it("SPD-005: with the expansion bus on, 28 MHz runs the loop at the 3.5 MHz rate", async () => {
    const base = await count({ startSpeed: 0 });
    const bus = await count({ startSpeed: 3, setup: "        nextreg $80,$80" });
    expect(within(bus, base, 0.01), `${bus} with the bus on, ${base} at 3.5 MHz`).toBe(true);
  });

  // --- SPD-006: $06 bit 7 is the F5/F6/F8 hotkey enable; ~5846 reads it back
  it("SPD-006: $06 bit 7 reads back and does not change the speed", async () => {
    const s = await createSession();
    expect(s.readNextReg(0x06) & 0x80, "hard reset").toBe(0x80);
    s.setNextReg(0x07, 0x02);
    const others = s.readNextReg(0x06) & 0x7f;
    s.setNextReg(0x06, others);
    expect(s.readNextReg(0x06)).toBe(others);
    expect(s.readNextReg(0x07)).toBe(0x22);
    s.setNextReg(0x06, 0x80 | others);
    expect(s.readNextReg(0x06)).toBe(0x80 | others);
    expect(s.readNextReg(0x07)).toBe(0x22);
  });

  // --- ~5736: F8 adds 1 to the 2-bit nr_07_cpu_speed, so 28 MHz wraps to 3.5 MHz
  it("SPD-006: with $06 bit 7 set, F8 steps the speed and wraps", async () => {
    const s = await createSession();
    const seen: number[] = [];
    for (let i = 0; i < 5; i++) {
      await s.pressHotkey("F8");
      seen.push(s.readNextReg(0x07));
    }
    expect(seen.map((v) => v.toString(16))).toEqual(["11", "22", "33", "0", "11"]);
  });

  // --- ~6290-6293: F5, F6 and F8 are all ANDed with nr_06_hotkey_cpu_speed_en
  it("SPD-006: with $06 bit 7 clear, F5, F6 and F8 do nothing", async () => {
    const s = await createSession();
    s.setNextReg(0x06, s.readNextReg(0x06) & 0x7f);
    await s.pressHotkey("F8");
    await s.pressHotkey("F5");
    expect(s.readNextReg(0x07)).toBe(0x00);
    expect(s.readNextReg(0x80) & 0x80).toBe(0x00);

    s.setNextReg(0x06, s.readNextReg(0x06) | 0x80).setNextReg(0x80, 0x80);
    s.setNextReg(0x06, s.readNextReg(0x06) & 0x7f);
    await s.pressHotkey("F6");
    expect(s.readNextReg(0x80) & 0x80, "F6 ignored too").toBe(0x80);
  });
});

/*
 * SPD-007: the audio is sampled on the 28 MHz frame clock, so a frame yields the same number of
 * samples at every CPU speed.
 */
describe("CPU speed and audio", () => {
  it("SPD-007: audio() returns the same number of samples per frame at every speed", async () => {
    const perFrame: number[] = [];
    for (const speed of SPEEDS) {
      const s: NextTestSession = await createSession({ audioSampleRate: 48000 });
      await s.loadCode(`
        .org $8000
        nextreg $07,${speed}
        nextreg $7f,$a5
        jr $
      `);
      s.runUntilReady().runFrames(2).startAudio().runFrames(50);
      perFrame.push(s.audio().length / 50);
    }
    // --- 48000 Hz over a frame of a few ms more or less than 20 ms
    expect(perFrame[0]).toBeGreaterThan(900);
    expect(perFrame[0]).toBeLessThan(1000);
    for (const speed of [1, 2, 3]) expect(Math.abs(perFrame[speed] - perFrame[0]), MHZ[speed]).toBeLessThanOrEqual(0.1);
  });
});
