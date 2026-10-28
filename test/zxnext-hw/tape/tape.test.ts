import { describe, expect, it } from "vitest";

import { tapeBlocksOf } from "@common/headless/tapeBlocks";
import type { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { createSession, type NextTestSession } from "../../harness/zxnext";
import { edgeStep, side } from "../audio/_audio-helpers";

/*
 * The Next's tape (`.plans/NEXT_TAPE_PLAN.md`; catalogue TAPE-001 - TAPE-008).
 *
 * Hardware (`_input/next-fpga/src`):
 * - zxnext_top_issue4.vhd ~620-690: the EAR socket goes through `debounce` (COUNTER_SIZE 1 on the
 *   1.75 MHz enable: a level must hold for two enables) and `relaxation` (a 1 held for 64 enables of
 *   512 clocks, about 1.15 ms, falls to 0); idle it is 0.
 * - zxnext.vhd ~3456: port $FE bit 6 = (EAR input xor Pi EAR) or EAR out or (MIC and issue 2).
 *   ~6449: the mixer's MIC line = port $FE bit 3 xor EAR input xor Pi EAR (128 units).
 * - ROM 3 of enNextZX.rom: the 48K ROM's LD-BYTES ($0556) and SA-BYTES ($04C2), which the tape traps.
 *
 * The programs call LD-BYTES / SA-BYTES themselves, after `prepareBasic` (ROM 3 paged, the system
 * variables the routines read, IM 1). Port $FE reads are sampled by a loop of 51 T-states at 3.5 MHz
 * with contention off, a logic analyser of the conditioned input.
 */

const RATE = 48_000;
const CPU_HZ = 3_500_000;
const UNIT = 12.8 / 32768; // --- one mixer unit as a normalised sample (the jack's gain)

/** A `.tap` with one data block (flag $FF) holding `data` */
function tapOf(data: Uint8Array): TapeDataBlock[] {
  const block = [0xff, ...data];
  const checksum = block.reduce((x, b) => x ^ b, 0);
  const length = block.length + 1;
  const parsed = tapeBlocksOf(new Uint8Array([length & 0xff, length >> 8, ...block, checksum]));
  if ("error" in parsed) throw new Error(parsed.error);
  return parsed.blocks;
}

const PAYLOAD = new Uint8Array([...Array(64)].map((_, i) => (i * 37 + 11) & 0xff));

async function basic(): Promise<NextTestSession> {
  const s = await createSession({ audioSampleRate: RATE });
  await s.prepareBasic();
  return s;
}

/** Calls LD-BYTES for `length` bytes of flag $FF to `dest` at the given CPU speed; result at $BF00 (1 = loaded) */
async function loadProgram(s: NextTestSession, dest: number, length: number, speed = 0): Promise<void> {
  await s.loadCode(
    `
        .org $8000
Start:  di
        nextreg $07,${speed}
        nextreg $08,$50       ; contention off, speaker on
        ld ix,$${dest.toString(16)}
        ld de,${length}
        ld a,$ff
        scf
        call $0556            ; LD-BYTES
        ld a,0
        jr nc,Done
        ld a,1
Done:   ld ($bf00),a
        di
        nextreg $7f,$a5
        jr $
`,
    { entry: "Start" }
  );
}

/** Samples port $FE bit 6 every 51 T-states into $C000 onwards, `count` samples */
async function sampler(s: NextTestSession, count: number): Promise<void> {
  await s.loadCode(
    `
        .org $8000
Start:  di
        nextreg $07,0
        nextreg $08,$50
        ld bc,$fefe
        ld hl,$c000
        ld de,${count}
Loop:   in a,(c)              ; 12
        ld (hl),a             ; 7
        inc hl                ; 6
        dec de                ; 6
        ld a,d                ; 4
        or e                  ; 4
        jr nz,Loop            ; 12
        nextreg $7f,$a5
        jr $
`,
    { entry: "Start" }
  );
}
const SAMPLE_T = 51;

/** The sampled bit 6 as 0/1 */
function samples(s: NextTestSession, count: number): number[] {
  return [...s.peekBytes(0xc000, count)].map((b) => (b & 0x40 ? 1 : 0));
}

/** Runs of equal samples */
function runs(bits: number[]): Array<{ v: number; n: number }> {
  const out: Array<{ v: number; n: number }> = [];
  for (const b of bits) {
    if (out.length && out[out.length - 1].v === b) out[out.length - 1].n++;
    else out.push({ v: b, n: 1 });
  }
  return out;
}

/** A block of pilot pulses only (and one data byte the test never reaches) */
function pilotBlock(pulse: number, count: number): TapeDataBlock[] {
  const [block] = tapOf(new Uint8Array([0]));
  return [{ ...block, pilotPulseLength: pulse, pilotPulseCount: count }];
}

describe("Next tape", () => {
  it("TAPE-001: fast load lands a block through ROM 3's LD-BYTES at 3.5 MHz and at 28 MHz", async () => {
    for (const speed of [0, 3]) {
      const s = await basic();
      await loadProgram(s, 0xc000, PAYLOAD.length, speed);
      s.insertTape(tapOf(PAYLOAD));
      s.runUntilReady({ maxFrames: 5 });
      expect(s.peek(0xbf00), `speed ${speed}`).toBe(1);
      expect([...s.peekBytes(0xc000, PAYLOAD.length)]).toEqual([...PAYLOAD]);
    }
  });

  it("TAPE-002: real-time loading at 3.5 MHz loads the block, and the tape is heard at MIC level", async () => {
    const s = await basic();
    await loadProgram(s, 0xc000, PAYLOAD.length);
    s.insertTape(tapOf(PAYLOAD), { fastLoad: false });
    s.runFrames(20);
    const loading = side(s.startAudio().runFrames(10).audio(), "left");
    // --- The pilot through the input stage into the MIC line: 128 units a step
    expect(edgeStep(loading) / UNIT).toBeGreaterThan(115);
    expect(edgeStep(loading) / UNIT).toBeLessThan(135);
    s.runUntilReady({ maxFrames: 200 });
    expect(s.peek(0xbf00)).toBe(1);
    expect([...s.peekBytes(0xc000, PAYLOAD.length)]).toEqual([...PAYLOAD]);
  });

  it("TAPE-003: real-time loading fails at 7 MHz, as the ROM's timing runs faster than the tape", async () => {
    const s = await basic();
    await loadProgram(s, 0xc000, PAYLOAD.length, 1);
    s.insertTape(tapOf(PAYLOAD), { fastLoad: false });
    s.runFrames(250);
    expect(s.peek(0xbf00) === 1 && [...s.peekBytes(0xc000, PAYLOAD.length)].every((b, i) => b === PAYLOAD[i])).toBe(false);
  });

  it("TAPE-004: with no tape playing, the input is 0 and port $FE bit 6 reads 0", async () => {
    const s = await basic();
    await sampler(s, 2000);
    s.runUntilReady({ maxFrames: 10 });
    expect(s.tapeInput()).toBe(0);
    expect(samples(s, 2000).every((b) => b === 0)).toBe(true);
  });

  it("TAPE-005: a standard pilot passes the input stage as it is: 2,168 T-states high, 2,168 low", async () => {
    const s = await basic();
    await sampler(s, 4000);
    s.insertTape(pilotBlock(2168, 400), { fastLoad: false }).tapeMode("load");
    s.runUntilReady({ maxFrames: 20 });
    const r = runs(samples(s, 4000)).slice(1, -1);
    expect(r.length).toBeGreaterThan(50);
    for (const { n } of r) expect(Math.abs(n * SAMPLE_T - 2168)).toBeLessThanOrEqual(SAMPLE_T);
  });

  it("TAPE-006: the relaxation drops a 1 held for 2 ms to 0 after about 1.15 ms", async () => {
    const s = await basic();
    await sampler(s, 4000);
    s.insertTape(pilotBlock(7000, 40), { fastLoad: false }).tapeMode("load");
    s.runUntilReady({ maxFrames: 20 });
    const r = runs(samples(s, 4000)).slice(1, -1);
    const highs = r.filter((x) => x.v === 1).map((x) => (x.n * SAMPLE_T * 1e6) / CPU_HZ);
    const lows = r.filter((x) => x.v === 0).map((x) => (x.n * SAMPLE_T * 1e6) / CPU_HZ);
    expect(highs.length).toBeGreaterThan(4);
    // --- 64 enables of 512 clocks: 1,152 to 1,170 µs, give or take a sample
    for (const us of highs) expect(us).toBeGreaterThan(1152 - 16);
    for (const us of highs) expect(us).toBeLessThan(1170 + 16);
    // --- ... and the 2 ms low pulse plus the 0.85 ms the high one lost
    for (const us of lows) expect(Math.abs(us - (4000 - 1161))).toBeLessThan(40);
  });

  it("TAPE-007: the debounce drops pulses shorter than about 1.14 µs, and keeps longer ones", async () => {
    const short = await basic();
    await sampler(short, 2000);
    short.insertTape(pilotBlock(2, 400000), { fastLoad: false }).tapeMode("load"); // --- 0.57 µs pulses
    short.runUntilReady({ maxFrames: 10 });
    expect(samples(short, 2000).every((b) => b === 0)).toBe(true);

    const long = await basic();
    await sampler(long, 2000);
    long.insertTape(pilotBlock(20, 40000), { fastLoad: false }).tapeMode("load"); // --- 5.7 µs pulses
    long.runUntilReady({ maxFrames: 10 });
    const bits = samples(long, 2000);
    expect(bits.some((b) => b === 1) && bits.some((b) => b === 0)).toBe(true);
  });

  it("TAPE-008: SA-BYTES is captured as a TZX that loads back", async () => {
    const s = await basic();
    s.poke(0xc000, PAYLOAD);
    await s.loadCode(
      `
        .org $8000
Start:  di
        nextreg $07,0
        nextreg $08,$50
        ld ix,$c000
        ld de,${PAYLOAD.length}
        ld a,$ff
        call $04c2            ; SA-BYTES
        di
        nextreg $7f,$a5
        jr $
`,
      { entry: "Start" }
    );
    s.runUntilReady({ maxFrames: 300 });
    s.runFrames(2);
    const saved = s.savedTape();
    expect(saved).toBeDefined();
    const parsed = tapeBlocksOf(saved!.contents);
    if ("error" in parsed) throw new Error(parsed.error);
    expect([...parsed.blocks[0].data]).toEqual([0xff, ...PAYLOAD, [0xff, ...PAYLOAD].reduce((x, b) => x ^ b, 0)]);

    const back = await basic();
    await loadProgram(back, 0xe000, PAYLOAD.length);
    back.insertTape(parsed.blocks);
    back.runUntilReady({ maxFrames: 5 });
    expect(back.peek(0xbf00)).toBe(1);
    expect([...back.peekBytes(0xe000, PAYLOAD.length)]).toEqual([...PAYLOAD]);
  });
});
