import { describe, expect, it } from "vitest";

import { createSp48Session, type Sp48TestSession } from "../harness/sp48";
import { createSp128Session, type Sp128TestSession } from "../harness/sp128";
import { startAtFrameTact } from "../harness/spectrumBeam";

/*
 * The ULA's timing against the CPU on the 48K and the 128K (`.plans/SPECTRUM_ULA_ACCURACY_PLAN.md`
 * Phases 1-5), each check at single T-state resolution. Every expectation comes from a hardware
 * source, never from Klive's own output:
 *
 * - the floating bus: on the 48K the ULA reads the bitmap of $4000 when an IN samples the bus at
 *   14,338, then its attribute, the next cell's bitmap and attribute, then the bus idles for four
 *   T-states - FloatSpy and Float48K on real machines, which Klive passes (the author's runs); on the
 *   128K the same from 14,364;
 * - a write racing the beam: the ULA reads three T-states into the contention window (above), and a
 *   write cycle's data is in the RAM by its third T-state, so a write cycle starting at 14,334 is read,
 *   one asking for 14,335 is held to 14,341 by the contention and is not (WoS 48K FAQ: the window
 *   opens at 14,335; 128K FAQ: 14,361);
 * - the border: one colour per 8 pixels, and an OUT ending 14,339-14,342 T-states after the interrupt
 *   changes it exactly at $4000's position (WoS 48K FAQ); 14,365-14,368 on the 128K (WoS 128K FAQ);
 * - snow: the ZXE wiki's "Snow effect" page;
 * - late timing: "one cycle later than normal timings" (the SZX specification, ZXSTMF_ALTERNATETIMINGS).
 */

type Session = Sp48TestSession | Sp128TestSession;
type Core = "sp48" | "sp128";
type X = Record<string, (...args: number[]) => number>;

const exportsOf = (s: Session) => s.machine.wasmV2Runtime!.exports as unknown as X;

/** Per machine: its core, the first T-state of $4000's pixels, the line length */
const MACHINES = [
  { name: "48K", core: "sp48" as Core, paper: 14336, line: 224, create: () => createSp48Session() },
  { name: "128K", core: "sp128" as Core, paper: 14364, line: 228, create: () => createSp128Session("sp128") }
];

async function boot(create: () => Promise<Session>): Promise<Session> {
  const s = await create();
  s.runFrames(100);
  return s;
}

/** The pixel buffer word at a picture position (row 0 is the first visible line, as the core draws) */
function pixelAt(s: Session, row: number, col: number): number {
  const width = s.machine.screenWidthInPixels;
  return s.machine.getPixelBuffer()[row * width + col] >>> 0;
}

/** The buffer row of the first paper line, and of the line above it */
function paperRow(s: Session, core: Core): number {
  const x = exportsOf(s);
  return x[`${core}GetFirstDisplayLine`]() - x[`${core}GetFirstVisibleLine`]();
}

describe.each(MACHINES)("ULA timing on the $name", ({ core, paper, line, create }) => {
  it("floating bus: the ULA's four reads of a cell pair, then four idle T-states (Phase 3)", async () => {
    const s = await boot(create);
    const bitmap = (i: number) => 0x10 + i;
    const attr = (i: number) => 0x40 + i;
    for (let i = 0; i < 32; i++) s.poke(0x4000 + i, bitmap(i)).poke(0x5800 + i, attr(i));
    // --- LD A,$80 (7 T); IN A,($FF): its I/O cycle starts 14 T in and samples the bus 3 T later.
    // --- Port $80FF: an uncontended high byte (the 128K contends $C000-$FFFF when an odd bank is in)
    const code = [0x3e, 0x80, 0xdb, 0xff];
    const sampleOffset = 7 + 7 + 3;
    // --- The first read: three T-states into the contention window (14,338 on the 48K, 14,364 on the 128K)
    const first = paper - 1 - (core === "sp48" ? 0 : 2) + 3;
    for (let sample = first - 3; sample < first + 20; sample++) {
      startAtFrameTact(s, core, sample - sampleOffset, code);
      s.step(2);
      const read = s.machine.a;
      const phase = sample - first;
      const pair = Math.floor(phase / 8);
      const expected =
        phase < 0 || phase % 8 >= 4
          ? 0xff
          : [bitmap(2 * pair), attr(2 * pair), bitmap(2 * pair + 1), attr(2 * pair + 1)][phase % 8];
      expect(read, `IN sampling the bus at ${sample}`).toBe(expected);
    }
  }, 120_000);

  it("a write racing the beam: read from the 4th T-state of its cycle on (Phase 2)", async () => {
    const s = await boot(create);
    const row = paperRow(s, core);
    // --- LD HL,$4000 (10 T); LD A,$FF (7 T); LD (HL),A: its write cycle asks for T-state 21
    const code = [0x21, 0x00, 0x40, 0x3e, 0xff, 0x77];
    // --- The window opens 3 T-states before the read of $4000 (14,335 / 14,361)
    const opens = paper - 1 - (core === "sp48" ? 0 : 2);
    for (let cycle = opens - 4; cycle <= opens + 6; cycle++) {
      s.poke(0x4000, 0x00).poke(0x5800, 0x38);
      startAtFrameTact(s, core, cycle - 21, code);
      s.step(3);
      s.finishFrame();
      const ink = pixelAt(s, row, 48) === 0xff000000;
      expect(ink, `write cycle asking for ${cycle}`).toBe(cycle < opens);
    }
  }, 120_000);

  it("the border: one colour per 8 pixels, the FAQ's OUT window lands on $4000's column (Phase 1)", async () => {
    const s = await boot(create);
    const x = exportsOf(s);
    const row = paperRow(s, core) - 1;
    // --- The border line above the paper: its column 48 is drawn when the line above $4000 is
    const chunk = paper - line;
    // --- LD A,2 (7 T); OUT ($FE),A (11 T): the OUT ends 18 T-states in
    const code = [0x3e, 0x02, 0xd3, 0xfe];
    // --- The FAQ's window, moved one line up: 14,339-14,342 on the 48K, 14,365-14,368 on the 128K
    const windowStart = core === "sp48" ? chunk + 3 : chunk + 1;
    for (let end = windowStart - 5; end <= windowStart + 8; end++) {
      x[`${core}WritePort`](0xfe, 7);
      startAtFrameTact(s, core, end - 18, code);
      s.step(2);
      s.finishFrame();
      let first = -1;
      for (let col = 0; col < 352 && first < 0; col++) if (pixelAt(s, row, col) === 0xff0000aa) first = col;
      // --- Each 4 T-state step of the OUT's end moves the change by one 8-pixel chunk
      const chunks = Math.floor((end - windowStart) / 4);
      expect(first, `OUT ending at ${end}`).toBe(48 + 8 * chunks);
    }
  }, 120_000);
});

describe("ULA snow on the 48K (Phase 5)", () => {
  /** Distinct screen bytes, so a read from the wrong address shows */
  function paint(s: Sp48TestSession): void {
    for (let i = 0; i < 0x80; i++) {
      s.poke(0x4000 + i, (i * 37 + 5) & 0xff);
      s.poke(0x5800 + i, (i * 11 + 0x08) & 0x7f);
    }
  }

  /** The eight pixels of a cell drawn from a bitmap and an attribute byte */
  function cellPixels(bitmap: number, attr: number): number[] {
    const colours = [0xff000000, 0xffaa0000, 0xff0000aa, 0xffaa00aa, 0xff00aa00, 0xffaaaa00, 0xff00aaaa, 0xffaaaaaa];
    const bright = [0xff000000, 0xffff0000, 0xff0000ff, 0xffff00ff, 0xff00ff00, 0xffffff00, 0xff00ffff, 0xffffffff];
    const table = (attr & 0x40) !== 0 ? bright : colours;
    const ink = table[attr & 0x07] >>> 0;
    const paper = table[(attr >> 3) & 0x07] >>> 0;
    return Array.from({ length: 8 }, (_, bit) => ((bitmap >> (7 - bit)) & 1 ? ink : paper));
  }

  function shownCell(s: Sp48TestSession, col: number): number[] {
    const row = paperRow(s, "sp48");
    return Array.from({ length: 8 }, (_, i) => pixelAt(s, row, 48 + 8 * col + i));
  }

  /**
   * Runs one NOP whose M1 starts at `m1` with I = `i` and R = `r`, then finishes the frame. The
   * NOP is in uncontended memory, and only its refresh can meet the ULA's reads.
   */
  async function nopAt(m1: number, i: number, r: number, snow = true): Promise<Sp48TestSession> {
    const s = (await boot(() => createSp48Session())) as Sp48TestSession;
    const x = exportsOf(s);
    x.sp48SetSnowEffect(snow ? 1 : 0);
    paint(s);
    startAtFrameTact(s, "sp48", m1, [0x00]);
    x.sp48SetCpuIr((i << 8) | r);
    s.step(1);
    x.sp48SetCpuIr(0x3f00);
    s.finishFrame();
    return s;
  }

  // --- Cell pair 1 (columns 2 and 3): its first burst (column 2) is read at 14,338 + 8, its second
  // --- (column 3) two T-states later; the refresh's second T-state is the M1's fourth
  const firstBurst = 14338 + 8;
  const R = 0x30;
  const low = (R + 1) & 0x7f;

  it("the refresh on the first burst: column 2 reads its bitmap and attribute at R's address", async () => {
    const s = await nopAt(firstBurst - 3, 0x40, R);
    expect(shownCell(s, 2)).toEqual(cellPixels(s.peek(0x4000 + low), s.peek(0x5800 + low)));
    // --- Column 3 is read as usual
    expect(shownCell(s, 3)).toEqual(cellPixels(s.peek(0x4003), s.peek(0x5803)));
  }, 60_000);

  it("the refresh on the second burst: column 3 shows column 2's bytes again", async () => {
    const s = await nopAt(firstBurst + 2 - 3, 0x40, R);
    expect(shownCell(s, 2)).toEqual(cellPixels(s.peek(0x4002), s.peek(0x5802)));
    expect(shownCell(s, 3)).toEqual(cellPixels(s.peek(0x4002), s.peek(0x5802)));
  }, 60_000);

  it("no snow with I outside $40-$7F, between the bursts, or with the effect switched off", async () => {
    for (const s of [
      await nopAt(firstBurst - 3, 0x3f, R),
      await nopAt(firstBurst - 3 + 1, 0x40, R),
      await nopAt(firstBurst - 3, 0x40, R, false)
    ]) {
      expect(shownCell(s, 2)).toEqual(cellPixels(s.peek(0x4002), s.peek(0x5802)));
      expect(shownCell(s, 3)).toEqual(cellPixels(s.peek(0x4003), s.peek(0x5803)));
    }
  }, 120_000);
});

describe.each(MACHINES)("late ULA timing on the $name (Phase 4)", ({ core, paper }) => {
  it("moves contention, the reads and the border one T-state later", async () => {
    const s = await boot(create(core));
    const x = exportsOf(s);
    const opens = paper - 1 - (core === "sp48" ? 0 : 2);
    expect(x[`${core}GetContentionValue`](opens)).toBe(6);
    x[`${core}SetLateTiming`](1);
    expect(x[`${core}GetLateTiming`]()).toBe(1);
    expect(x[`${core}GetContentionValue`](opens)).toBe(0);
    expect(x[`${core}GetContentionValue`](opens + 1)).toBe(6);

    // --- The floating bus: the first bitmap read one T-state later
    s.poke(0x4000, 0x5a);
    const code = [0x3e, 0x80, 0xdb, 0xff];
    for (const [sample, expected] of [
      [opens + 3, 0xff],
      [opens + 4, 0x5a]
    ]) {
      startAtFrameTact(s, core, sample - 17, code);
      s.step(2);
      expect(s.machine.a, `IN sampling at ${sample}`).toBe(expected);
    }
    x[`${core}SetLateTiming`](0);
    expect(x[`${core}GetContentionValue`](opens)).toBe(6);
  }, 120_000);
});

function create(core: Core): () => Promise<Session> {
  return core === "sp48" ? () => createSp48Session() : () => createSp128Session("sp128");
}

describe.each(MACHINES)("late ULA timing through snapshots on the $name (Phase 4)", ({ core }) => {
  it("an .szx file carries it (ZXSTMF_ALTERNATETIMINGS); a .sna file leaves the machine's own", async () => {
    const late = await boot(create(core));
    exportsOf(late)[`${core}SetLateTiming`](1);
    const szx = late.saveSnapshot("szx").bytes;
    // --- The header's flags byte, bit 0 (the SZX specification's header)
    expect(szx[7] & 0x01).toBe(1);
    expect(late.captureSnapshot().ula.alternateTimings).toBe(true);

    const fresh = await boot(create(core));
    expect(exportsOf(fresh)[`${core}GetLateTiming`]()).toBe(0);
    fresh.loadSnapshot("late.szx", szx);
    expect(exportsOf(fresh)[`${core}GetLateTiming`]()).toBe(1);

    // --- Back to early from an .szx without the flag; a .sna (no such field) changes nothing
    exportsOf(late)[`${core}SetLateTiming`](0);
    fresh.loadSnapshot("early.szx", late.saveSnapshot("szx").bytes);
    expect(exportsOf(fresh)[`${core}GetLateTiming`]()).toBe(0);
    exportsOf(fresh)[`${core}SetLateTiming`](1);
    fresh.loadSnapshot("plain.sna", late.saveSnapshot("sna").bytes);
    expect(exportsOf(fresh)[`${core}GetLateTiming`]()).toBe(1);
  }, 120_000);
});
