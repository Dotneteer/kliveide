import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { CodeToInject } from "@abstractions/CodeToInject";
import { BinaryReader } from "@common/utils/BinaryReader";
import { TapReader } from "@emu/machines/tape/TapReader";
import { SP128_MAIN_WAITING_LOOP, SP128_RETURN_TO_EDITOR } from "@emu/machines/ZxSpectrumBase";
import { SP128_TIMINGS, type Sp128Timing, type Sp128TimingId } from "@emu/machines/zxSpectrum128/sp128Timings";
import { createSp128Session, type Sp128TestSession } from "../harness/sp128";

/*
 * The Pentagon 128 on the real core (`.plans/PENTAGON_128_PLAN.md` Phase 3). Every check runs on the
 * Pentagon *and* the 128K: the 128K's results are known, so they prove each measurement method before
 * the Pentagon's are trusted.
 *
 * Where the expected Pentagon values come from (P6): the frame, the interrupt and the display position
 * from the Next FPGA's Pentagon mode (`zxula_timing.vhd`, `zxnext.vhd`), carried in `sp128Timings.ts`;
 * "no contention" and "no floating bus" from the same source (zxnext.vhd ~4461: contention is off in
 * the Pentagon timing) and plan §4.
 */

type X = Record<string, (...args: number[]) => number>;
const exportsOf = (s: Sp128TestSession) => s.machine.wasmV2Runtime!.exports as unknown as X;

const MODELS: Sp128TimingId[] = ["sp128", "pentagon"];

/** A booted machine (the 128K menu), its exports and its timing */
async function boot(model: Sp128TimingId) {
  const s = await createSp128Session(model);
  s.runFrames(150);
  return { s, x: exportsOf(s), t: SP128_TIMINGS[model] };
}

/**
 * Moves the CPU to `address`, out of the HALT the ROM's menu waits in, with interrupts disabled: near
 * a frame's start the INT line is still active, and the ROM's handler would run before the code's DI
 */
function jump(s: Sp128TestSession, x: X, address: number): void {
  x.sp128SetCpuHalted(0);
  x.sp128SetCpuIff1(0);
  x.sp128SetCpuIff2(0);
  s.machine.pc = address;
}

/** Runs `bytes` from $8000 (bank 2, never contended) until it reaches its last instruction, `JR $` */
function measure(s: Sp128TestSession, x: X, bytes: number[]): number {
  const code = [...bytes, 0x18, 0xfe];
  s.poke(0x8000, code);
  jump(s, x, 0x8000);
  const start = x.sp128GetTacts();
  s.runTo(0x8000 + code.length - 2, { maxFrames: 20 });
  return x.sp128GetTacts() - start;
}

/** Pages a bank in at $C000 (ROM 1, normal screen) */
const page = (x: X, bank: number) => x.sp128WritePort(0x7ffd, 0x10 | bank);

// ------------------------------------------------------------------------------------------------
// A NOP sled at $8000 to stop at chosen frame tacts: DI, `prefix` x LD A,0 (7 T each, to reach every
// T-state phase), 18 000 NOPs, JR $

// --- Longer than a Pentagon frame (71 680 T); it runs into bank 0 at $C000, never contended
const SLED_NOPS = 18_000;

function loadSled(s: Sp128TestSession, prefix: number): void {
  const code = [0xf3];
  for (let i = 0; i < prefix; i++) code.push(0x3e, 0x00);
  for (let i = 0; i < SLED_NOPS; i++) code.push(0x00);
  code.push(0x18, 0xfe);
  s.poke(0x8000, code);
}

/** Starts the sled at the start of a frame; returns the frame tact it starts at */
function startSled(s: Sp128TestSession): number {
  const x = exportsOf(s);
  jump(s, x, 0x8000 + 1 + 2 * 3 + SLED_NOPS); // --- parked on JR $ (in the NOPs) while the frame ends
  s.runFrames(1);
  jump(s, x, 0x8000);
  return s.frameTact();
}

/** Steps the sled until the frame tact reaches `target`; returns the tact it stopped at */
function sledTo(s: Sp128TestSession, prefix: number, target: number): number {
  const start = s.frameTact();
  const nopsBefore = Math.floor((target - start - 4 - 7 * prefix) / 4) - 4;
  if (nopsBefore > 0) s.runTo(0x8000 + 1 + 2 * prefix + nopsBefore, { maxFrames: 1 });
  while (s.frameTact() < target) s.step();
  return s.frameTact();
}

// ------------------------------------------------------------------------------------------------
// The frame tact at which the ULA draws a pixel of the visible window, from the timing's geometry:
// row 0 is the first visible line, `vsync + non-visible top` lines after the raster starts; a row's
// left border is drawn at the end of the line before it; the Pentagon's raster starts 62 T after its
// interrupt (`paperStartTact` - the display's first line x the line length).

function drawTact(t: Sp128Timing, row: number, col: number): number {
  const sc = t.screen;
  const firstVisibleLine = sc.verticalSyncLines + sc.nonVisibleBorderTopLines;
  const firstDisplayLine = firstVisibleLine + sc.borderTopLines;
  const shift = t.paperStartTact - firstDisplayLine * t.tactsPerLine;
  let line: number;
  let tactInLine: number;
  if (col < 2 * sc.borderLeftTime) {
    line = firstVisibleLine + row - 1;
    tactInLine = t.tactsPerLine - sc.borderLeftTime + (col >> 1);
  } else {
    line = firstVisibleLine + row;
    tactInLine = (col >> 1) - sc.borderLeftTime;
  }
  return (line * t.tactsPerLine + tactInLine + shift + t.tactsPerFrame) % t.tactsPerFrame;
}

const PAPER_WHITE = 0xffaaaaaa;
const INK_BLACK = 0xff000000;
const BORDER_RED = 0xff0000aa;

describe.each(MODELS)("%s", (model) => {
  it("frame: the table's T-states per frame, one interrupt each", async () => {
    const { s, x, t } = await boot(model);
    const frameStart = () => x.sp128GetTacts() - s.frameTact();
    const start = frameStart();
    const ints = x.sp128GetInterruptsRaised();
    s.runFrames(10);
    expect(frameStart() - start).toBe(10 * t.tactsPerFrame);
    expect(x.sp128GetInterruptsRaised() - ints).toBe(10);
    expect(s.machine.tactsInFrame).toBe(t.tactsPerFrame);
    // --- 3 500 000 / 71 680 = 48.83 Hz on the Pentagon; 50.02 Hz on the 128K
    expect(t.clockHz / t.tactsPerFrame).toBeCloseTo(model === "pentagon" ? 48.828 : 50.021, 2);
  }, 60_000);

  it("memory: contention only on the 128K, in slot 1 and in odd banks at $C000", async () => {
    const { s, x, t } = await boot(model);
    // --- DI; LD HL,addr; LD C,16; o: LD B,0; l: LD A,(HL); LD (HL),A; DJNZ l; DEC C; JR NZ,o
    const loop = (addr: number) => [0xf3, 0x21, addr & 0xff, addr >> 8, 0x0e, 16, 0x06, 0x00, 0x7e, 0x77, 0x10, 0xfc, 0x0d, 0x20, 0xf7];
    // --- 4 + 10 + 7 + 16 x (7 + 256 x 14 + 255 x 13 + 8 + 4) + 15 x 12 + 7: spans more than a frame
    const uncontended = 110_896;
    const results: Record<string, number> = {};
    for (const [name, addr, bank] of [
      ["$8000", 0x8000, 0],
      ["$4000", 0x4000, 0],
      ["$6000", 0x6000, 0],
      ["$C000 bank 0", 0xc000, 0],
      ["$C000 bank 1", 0xc000, 1],
      ["$C000 bank 4", 0xc000, 4],
      ["$C000 bank 7", 0xc000, 7]
    ] as const) {
      page(x, bank);
      results[name] = measure(s, x, loop(addr));
    }
    page(x, 0);
    expect(results["$8000"]).toBe(uncontended);
    expect(results["$C000 bank 0"]).toBe(uncontended);
    expect(results["$C000 bank 4"]).toBe(uncontended);
    for (const name of ["$4000", "$6000", "$C000 bank 1", "$C000 bank 7"]) {
      if (t.contention) expect(results[name], name).toBeGreaterThan(uncontended);
      else expect(results[name], name).toBe(uncontended);
    }
  }, 60_000);

  it("I/O: ULA and $4000-$7FFF ports cost their base timing only on the Pentagon", async () => {
    const { s, x, t } = await boot(model);
    // --- DI; LD BC,port; LD E,16; o: LD D,0; l: OUT (C),A | IN A,(C); DEC D; JR NZ,l; DEC E; JR NZ,o
    const loop = (port: number, op: number) => [0xf3, 0x01, port & 0xff, port >> 8, 0x1e, 16, 0x16, 0x00, 0xed, op, 0x15, 0x20, 0xfb, 0x1d, 0x20, 0xf6];
    // --- 4 + 10 + 7 + 16 x (7 + 256 x (12 + 4) + 255 x 12 + 7 + 4) + 15 x 12 + 7
    const base = 4 + 10 + 7 + 16 * (7 + 256 * 16 + 255 * 12 + 7 + 4) + 15 * 12 + 7;
    for (const [name, port, op] of [
      ["OUT ($40FE)", 0x40fe, 0x79],
      ["IN ($00FE)", 0x00fe, 0x78],
      ["IN ($7FFD)", 0x7ffd, 0x78],
      ["IN ($80FF)", 0x80ff, 0x78]
    ] as const) {
      const tacts = measure(s, x, loop(port, op));
      if (t.contention && name !== "IN ($80FF)") expect(tacts, name).toBeGreaterThan(base);
      else expect(tacts, name).toBe(base);
    }
  }, 60_000);

  it("floating bus: an unattached port reads $FF at every tact only on the Pentagon", async () => {
    const { s, x, t } = await boot(model);
    s.poke(0x4000, new Array(0x1b00).fill(0x55));
    // --- DI; LD D,$FF; LD E,12; o: LD B,0; l: IN A,($FF); AND D; LD D,A; DJNZ l; DEC E; JR NZ,o
    measure(s, x, [0xf3, 0x16, 0xff, 0x1e, 12, 0x06, 0x00, 0xdb, 0xff, 0xa2, 0x57, 0x10, 0xfa, 0x1d, 0x20, 0xf5]);
    const anded = s.cpu().de >> 8;
    if (t.floatingBus) expect(anded).not.toBe(0xff);
    else expect(anded).toBe(0xff);
    expect(x.sp128ReadFloatingBus() === 0xff || t.floatingBus).toBe(true);
  }, 60_000);

  it("interrupt: active from frame tact 0 for the table's length", async () => {
    const { s, x, t } = await boot(model);
    const seen = new Set<number>();
    for (let prefix = 0; prefix < 4; prefix++) {
      loadSled(s, prefix);
      for (let target = 24; target <= 44; target += 1) {
        startSled(s);
        const at = sledTo(s, prefix, target);
        seen.add(at);
        x.sp128SetCpuInterruptMode(1);
        x.sp128SetCpuIff1(1);
        x.sp128SetCpuIff2(1);
        s.step();
        const accepted = s.cpu().pc === 0x0038;
        expect(accepted, `INT at frame tact ${at}`).toBe(at < t.interruptTacts);
      }
    }
    // --- The sweep straddled the pulse's end on both sides
    expect([...seen].sort((a, b) => a - b).join(",")).toContain(`${t.interruptTacts - 1},${t.interruptTacts}`);
  }, 120_000);

  it("display: the first paper byte is fetched 2 T before the table's paper start", async () => {
    const { s, t } = await boot(model);
    const p = t.paperStartTact;
    const width = s.machine.screenWidthInPixels;
    const pixel = () => s.machine.getPixelBuffer()[48 * width + 48] >>> 0;
    const seen = new Set<number>();
    for (let prefix = 0; prefix < 4; prefix++) {
      loadSled(s, prefix);
      for (let target = p - 6; target <= p + 1; target += 1) {
        s.poke(0x4000, 0x00).poke(0x5800, 0x38);
        startSled(s);
        const at = sledTo(s, prefix, target);
        seen.add(at);
        s.poke(0x4000, 0xff);
        s.finishFrame();
        const shown = pixel();
        expect(shown, `write at frame tact ${at}`).toBe(at < p - 2 ? INK_BLACK : PAPER_WHITE);
      }
    }
    expect([...seen].sort((a, b) => a - b).join(",")).toContain(`${p - 3},${p - 2}`);
  }, 120_000);

  it("border: a colour change lands on the pixel the ULA draws next", async () => {
    const { s, x, t } = await boot(model);
    const width = s.machine.screenWidthInPixels;
    const height = s.machine.screenHeightInPixels;
    const firstVisible = drawTact(t, 0, 0);
    expect(firstVisible).toBe(
      model === "pentagon" ? 62 + 31 * 224 + 200 : 14 * 228 + 204 // --- 7 206 and 3 396
    );
    loadSled(s, 1);
    for (const target of [firstVisible - 3, firstVisible + 41, drawTact(t, 47, 300), t.paperStartTact + 140, drawTact(t, 286, 340)]) {
      x.sp128WritePort(0xfe, 0);
      startSled(s);
      const at = sledTo(s, 1, target);
      x.sp128WritePort(0xfe, 2);
      s.finishFrame();
      const buffer = s.machine.getPixelBuffer();
      let first = -1;
      for (let i = 0; i < width * height; i++) {
        const row = Math.floor(i / width);
        const col = i % width;
        // --- The paper area shows the screen, not the border
        if (row >= 48 && row < 240 && col >= 48 && col < 304) continue;
        if (buffer[i] >>> 0 === BORDER_RED) {
          first = i;
          break;
        }
      }
      expect(first, `change at ${at}`).toBeGreaterThanOrEqual(0);
      const row = Math.floor(first / width);
      const col = first % width;
      expect(drawTact(t, row, col), `change at ${at}: first red pixel (${row}, ${col})`).toBeGreaterThan(at);
      if (first > 0) {
        const before = first - 2;
        expect(drawTact(t, Math.floor(before / width), before % width)).toBeLessThanOrEqual(at);
      }
    }
  }, 120_000);

  it("paging: $7FFD banks, ROM, shadow screen and the lock as on the 128K", async () => {
    const { s, x } = await boot(model);
    x.sp128WritePort(0x7ffd, 0x1b);
    expect(s.paging()).toEqual({ bank: 3, rom: 1, shadowScreen: true, locked: false });
    s.poke(0xc000, 0x5a);
    expect(s.bank(3)[0]).toBe(0x5a);
    x.sp128WritePort(0x7ffd, 0x27);
    expect(s.paging()).toEqual({ bank: 7, rom: 0, shadowScreen: false, locked: true });
    x.sp128WritePort(0x7ffd, 0x01);
    expect(s.paging()).toEqual({ bank: 7, rom: 0, shadowScreen: false, locked: true });
  }, 60_000);

  it("AY: the tone runs at the CPU clock / 2", async () => {
    const { s, x, t } = await boot(model);
    s.poke(0x8000, [0xf3, 0x18, 0xfe]);
    jump(s, x, 0x8000);
    const ay = (reg: number, value: number) => {
      x.sp128WritePort(0xfffd, reg);
      x.sp128WritePort(0xbffd, value);
    };
    for (let reg = 0; reg < 14; reg++) ay(reg, 0);
    ay(0, 100); // --- channel A tone period 100
    ay(7, 0x3e); // --- tone A only
    ay(8, 15);
    s.runFrames(5);
    const levels: number[] = [];
    for (let frame = 0; frame < 60; frame++) {
      s.runFrames(1);
      for (const sample of s.machine.getAudioSamples()) levels.push(sample.left);
    }
    const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
    let changes = 0;
    for (let i = 1; i < levels.length; i++) {
      if (levels[i - 1] - mean < 0 !== levels[i] - mean < 0) changes++;
    }
    const seconds = levels.length / x.sp128GetAudioSampleRate();
    const measured = changes / 2 / seconds;
    const expected = t.clockHz / 2 / (16 * 100);
    expect(Math.abs(measured - expected) / expected).toBeLessThan(0.003);
  }, 60_000);
});

// ------------------------------------------------------------------------------------------------
// The IDE's flows: the Pentagon boots the 128K ROMs, so the 128K's flows and addresses work unchanged

const FLOAT_SPY = new Uint8Array(readFileSync(join(__dirname, "../testfiles/floatspy.tap")));

/** LD A,$42 / LD ($9000),A / RET at $8000, called as a subroutine */
function program(model: "sp48" | "sp128"): CodeToInject {
  return {
    model,
    subroutine: true,
    entryAddress: 0x8000,
    segments: [{ startAddress: 0x8000, bankOffset: 0, emittedCode: [0x3e, 0x42, 0x32, 0x00, 0x90, 0xc9] }],
    options: { noCls: true }
  };
}

describe("pentagon: the IDE's flows", () => {
  it("boots to the 128K menu at the 128K's menu address", async () => {
    const s = await createSp128Session("pentagon");
    s.runTo(SP128_MAIN_WAITING_LOOP, { rom: 0, maxFrames: 600 });
    s.runFrames(5);
    const text = s.screenText();
    for (const item of ["Tape Loader", "128 BASIC", "Calculator", "48 BASIC"]) expect(text).toContain(item);
  }, 60_000);

  it("injects into 128 BASIC; the program returns to a working editor", async () => {
    const s = await createSp128Session("pentagon");
    s.runFlow(await s.machine.getCodeInjectionFlow("sp128"), { code: program("sp128") });
    expect(s.cpu().pc).toBe(0x8000);
    s.runTo(SP128_RETURN_TO_EDITOR, { rom: 0, maxFrames: 5 });
    expect(s.peek(0x9000)).toBe(0x42);
    s.runFrames(30).typeText("PRINT 42\n").runFrames(30);
    expect(s.screenText()).toContain("42");
  }, 60_000);

  it("injects into 48 BASIC", async () => {
    const s = await createSp128Session("pentagon");
    s.runFlow(await s.machine.getCodeInjectionFlow("sp48"), { code: program("sp48") });
    expect(s.cpu().pc).toBe(0x8000);
    expect(s.paging().rom).toBe(1);
  }, 60_000);

  it("the Tape Loader loads a tape", async () => {
    const s = await createSp128Session("pentagon");
    const reader = new TapReader(new BinaryReader(FLOAT_SPY));
    expect(reader.readContent()).toBeNull();
    s.insertTape(reader.dataBlocks);
    s.runFlow(s.machine.getTapeLoadFlow!());
    for (let frame = 0; frame < 3000 && !s.screenText().includes("FLOATING BUS"); frame += 25) {
      s.runFrames(25);
    }
    expect(s.screenText()).toContain("FLOATING BUS test program");
  }, 120_000);
});
