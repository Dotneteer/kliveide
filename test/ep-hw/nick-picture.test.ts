import { describe, expect, it } from "vitest";

import { createEpSession, type EpTestSession } from "../harness/enterprise";
import { bareMachine, pictureHash, standardLpt, stepUntil, writeShotIfAsked, type Lpb } from "./bare";

/*
 * NICK's picture (`.plans/ENTERPRISE_PLAN.md` Phase 3, §7): the modes and colour modes on a worked
 * byte, the ALT options, the palette and FIXBIAS, the one-slot pipeline, blanking, mid-line writes,
 * the TV window, and EXOS's own screen.
 *
 * Geometry of the bare machine's frame (`standardLpt`): vertical sync starts on LPT line 260 and the TV
 * window starts 25 lines after it, so LPT line L is picture row L + 27. Slot n is picture column
 * (n - 10) * 16, and what slot n fetches is shown in slot n + 1: with LM = 10 the first byte is at x 16.
 */

const W = 736;
const rowOf = (lptLine: number) => lptLine + 27;
const xOfSlot = (slot: number) => (slot - 10) * 16;

/** Eight palette colours that are easy to tell apart, and FIXBIAS 1Fh: entries 8-15 are F8h-FFh */
const PALETTE = [0x00, 0x49, 0x92, 0x24, 0xff, 0x36, 0x2d, 0x1b];

const px = (s: EpTestSession, x: number, y: number) => s.screenPixels()[y * W + x] >>> 0;
const rgb = (s: EpTestSession, colour: number) => s.wasm.epNickGetRgb(colour) >>> 0;
/** The colour byte palette index `i` gives (FIXBIAS 1Fh) */
const entry = (i: number) => (i < 8 ? PALETTE[i] : 0xf8 | (i & 7));

/** Runs a bare machine whose first 100 lines are `block`, with FIXBIAS 1Fh and a black border */
async function showBlock(block: Omit<Lpb, "lines">, data: { at: number; bytes: number[] }[]): Promise<EpTestSession> {
  const s = await createEpSession();
  const picture: Lpb[] = [
    { ...block, lines: 100, palette: block.palette ?? PALETTE },
    { lines: 156, mode: 7, lm: 63, rm: 0 }
  ];
  bareMachine(s, { lpt: standardLpt({ picture }), settle: 0 });
  for (const d of data) s.pokeVram(d.at, d.bytes);
  s.wasm.epWritePort(0x80, 0x1f);
  s.wasm.epWritePort(0x81, 0x00);
  s.runFrames(2);
  return s;
}

/** The 16 pixels of slot `slot` on LPT line `line` */
function slotPixels(s: EpTestSession, slot: number, line = 10): number[] {
  const pixels = s.screenPixels();
  const at = rowOf(line) * W + xOfSlot(slot);
  return Array.from(pixels.subarray(at, at + 16), (p) => p >>> 0);
}

/** 16 pixels from palette indexes, each `width` dots wide */
function expected(s: EpTestSession, indexes: number[], width: number): number[] {
  return indexes.flatMap((i) => Array(width).fill(rgb(s, entry(i))));
}

describe("NICK's modes and colour modes (worked byte B4h = 1011 0100)", () => {
  it("LPIXEL: 2 colours 1 0 1 1 0 1 0 0, 4 colours 1 2 1 1, 16 colours 5 6, 256 colours the byte itself", async () => {
    for (const [colours, indexes, width] of [
      [0, [1, 0, 1, 1, 0, 1, 0, 0], 2],
      [1, [1, 2, 1, 1], 4],
      [2, [5, 6], 8]
    ] as const) {
      const s = await showBlock({ mode: 7, colours, lm: 10, rm: 52, ld1: 0x4000 }, [{ at: 0x4000, bytes: [0xb4] }]);
      expect(slotPixels(s, 11), `colours ${colours}`).toEqual(expected(s, [...indexes], width));
    }
    const s = await showBlock({ mode: 7, colours: 3, lm: 10, rm: 52, ld1: 0x4000 }, [{ at: 0x4000, bytes: [0xb4] }]);
    expect(slotPixels(s, 11)).toEqual(Array(16).fill(rgb(s, 0xb4)));
  });

  it("PIXEL: two bytes a slot, at twice LPIXEL's resolution", async () => {
    const s = await showBlock({ mode: 1, colours: 0, lm: 10, rm: 52, ld1: 0x4000 }, [{ at: 0x4000, bytes: [0xb4, 0x0f] }]);
    expect(slotPixels(s, 11)).toEqual(expected(s, [1, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], 1));
  });

  it("takes palette entries 8-15 from FIXBIAS (16 colours: byte 02h's left pixel is index 8)", async () => {
    const s = await showBlock({ mode: 7, colours: 2, lm: 10, rm: 52, ld1: 0x4000 }, [{ at: 0x4000, bytes: [0x02] }]);
    expect(slotPixels(s, 11)).toEqual([...expected(s, [8], 8), ...expected(s, [0], 8)]);
    expect(entry(8)).toBe(0xf8);
  });

  it("ATTRIBUTE: the bitmap's 1s in the low nibble's colour, its 0s in the high nibble's (a block's first line)", async () => {
    const s = await showBlock({ mode: 2, colours: 0, lm: 10, rm: 52, ld1: 0x4000, ld2: 0x5000 }, [
      { at: 0x4000, bytes: [0x3a] },
      { at: 0x5000, bytes: [0xf0] }
    ]);
    // --- Line 0: with VRES clear LD1 starts again each line but LD2 does not (Q5), so later lines read on
    expect(slotPixels(s, 11, 0)).toEqual([...expected(s, [10, 10, 10, 10], 2), ...expected(s, [3, 3, 3, 3], 2)]);
  });

  it("CH128: the glyph at LD2 * 128 + code, one byte across the slot, the font row stepping each line", async () => {
    const s = await showBlock({ mode: 4, colours: 0, lm: 10, rm: 52, ld1: 0x4000, ld2: 0x00a0 }, [
      { at: 0x4000, bytes: [0x41] },
      // --- Row 0 of the font at A0h * 128 = 5000h, row 10 (LPT line 10) at 5000h + 10 * 128
      { at: 0x5000 + 0x41, bytes: [0x81] },
      { at: 0x5000 + 10 * 128 + 0x41, bytes: [0x3c] }
    ]);
    expect(slotPixels(s, 11, 0)).toEqual(expected(s, [1, 0, 0, 0, 0, 0, 0, 1], 2));
    expect(slotPixels(s, 11, 10)).toEqual(expected(s, [0, 0, 1, 1, 1, 1, 0, 0], 2));
  });
});

describe("the ALT options", () => {
  it("MSBALT takes a bitmap byte's bit 7 off it as +2, LSBALT its bit 0 as +4 (LM bits 7 and 6)", async () => {
    let s = await showBlock({ mode: 7, colours: 0, lm: 10 | 0x80, rm: 52, ld1: 0x4000 }, [{ at: 0x4000, bytes: [0x81] }]);
    expect(slotPixels(s, 11)).toEqual(expected(s, [2, 2, 2, 2, 2, 2, 2, 3], 2));
    s = await showBlock({ mode: 7, colours: 0, lm: 10 | 0x40, rm: 52, ld1: 0x4000 }, [{ at: 0x4000, bytes: [0x81] }]);
    expect(slotPixels(s, 11)).toEqual(expected(s, [5, 4, 4, 4, 4, 4, 4, 4], 2));
  });

  it("ALTIND1 (RM bit 6) takes colours 2/3 for a code with bit 7 set; ALTIND0 (bit 7) 4-7 for bit 6 (plan Q2)", async () => {
    const font = [{ at: 0x5000 + 0x41, bytes: [0xf0] }];
    let s = await showBlock({ mode: 4, lm: 10, rm: 52 | 0x40, ld1: 0x4000, ld2: 0x00a0 }, [{ at: 0x4000, bytes: [0xc1] }, ...font]);
    expect(slotPixels(s, 11, 0)).toEqual(expected(s, [3, 3, 3, 3, 2, 2, 2, 2], 2));
    s = await showBlock({ mode: 4, lm: 10, rm: 52 | 0x80, ld1: 0x4000, ld2: 0x00a0 }, [{ at: 0x4000, bytes: [0x41] }, ...font]);
    expect(slotPixels(s, 11, 0)).toEqual(expected(s, [5, 5, 5, 5, 4, 4, 4, 4], 2));
  });
});

describe("the pipeline, the border and blanking", () => {
  it("shows a slot's fetch one slot later: LM 31, RM 32 puts 16 pixels in slot 32 and border either side", async () => {
    const s = await showBlock({ mode: 7, colours: 3, lm: 31, rm: 32, ld1: 0x4000 }, [{ at: 0x4000, bytes: [0xb4] }]);
    s.wasm.epWritePort(0x81, 0x49);
    s.runFrames(1);
    expect(slotPixels(s, 31)).toEqual(Array(16).fill(rgb(s, 0x49)));
    expect(slotPixels(s, 32)).toEqual(Array(16).fill(rgb(s, 0xb4)));
    expect(slotPixels(s, 33)).toEqual(Array(16).fill(rgb(s, 0x49)));
  });

  it("shows the last bytes fetched again in slots 54 and 55 when the margins reach them", async () => {
    const bytes = Array.from({ length: 64 }, (_, i) => i);
    const s = await showBlock({ mode: 7, colours: 3, lm: 50, rm: 56, ld1: 0x4000 }, [{ at: 0x4000, bytes }]);
    // --- Fetches in 50-53 (bytes 0-3), shown in 51-54; slot 54 fetches nothing, so 55 repeats byte 3
    expect(slotPixels(s, 54)[0]).toBe(rgb(s, 3));
    expect(slotPixels(s, 55)[0]).toBe(rgb(s, 3));
  });

  it("blanks a VSYNC line to colour 0 whatever the border", async () => {
    const s = await createEpSession();
    bareMachine(s);
    s.wasm.epWritePort(0x81, 0xff);
    s.runFrames(1);
    // --- LPT line 260 (the first VSYNC line) is the window's last row; line 259 shows the border
    expect(px(s, 300, rowOf(259))).toBe(rgb(s, 0xff));
    expect(px(s, 300, rowOf(260))).toBe(rgb(s, 0x00));
  });

  it("lands a border write at the slot it is made in", async () => {
    const s = await createEpSession();
    bareMachine(s);
    s.wasm.epWritePort(0x81, 0x92);
    s.runFrames(1);
    // --- The picture runs from slot 11 to 52 (LM 10, RM 52, one slot late); 53-55 are border
    stepUntil(s, () => s.nick().line === (100 + 52) % 312 && s.nick().slot === 54);
    s.wasm.epWritePort(0x81, 0x49);
    stepUntil(s, () => s.nick().line === (101 + 52) % 312);
    expect(slotPixels(s, 53, 100)).toEqual(Array(16).fill(rgb(s, 0x92)));
    expect(slotPixels(s, 54, 100)).toEqual(Array(16).fill(rgb(s, 0x49)));
    expect(slotPixels(s, 55, 100)).toEqual(Array(16).fill(rgb(s, 0x49)));
  });
});

describe("the colour levels", () => {
  it("uses the board's resistor DAC by default, the guide's linear levels on request", async () => {
    const s = await createEpSession();
    // --- 07h: R, G and B at their most significant bit only: R = G = 4/7, B = 2/3 linearly
    expect(rgb(s, 0x07)).toBe(0xff_ba_99_99 >>> 0);
    s.wasm.epNickSetLinearPalette(1);
    expect(rgb(s, 0x07)).toBe(0xff_aa_92_92 >>> 0);
    expect(rgb(s, 0xff)).toBe(0xffffffff >>> 0);
    expect(rgb(s, 0x00)).toBe(0xff000000 >>> 0);
  });
});

describe("the TV", () => {
  it("reports the beam where the picture is being drawn", async () => {
    const s = await createEpSession();
    bareMachine(s);
    stepUntil(s, () => s.nick().line === (100 + 52) % 312 && s.nick().slot === 30);
    const beam = s.machine.getBeamPosition();
    expect(beam.bufferY).toBe(rowOf(100));
    expect(Math.abs(beam.bufferX! - xOfSlot(30))).toBeLessThanOrEqual(16);
    expect(beam.region).toBe("paper");
  });

  it("places the IS 1984 demo's 312-line frame: sync from slot 4 for 4 lines, its 512 x 256 bitmap at (80, 16)", async () => {
    const s = await createEpSession();
    // --- "Programming the NICK chip" (Jan 84) p. 22, as NICK_VIDEO_BACKGROUND.md §6.1 transcribes it
    const black = [0, 0, 0, 0, 0, 0, 0, 0];
    const demo: Lpb[] = [
      { lines: 256, mode: 1, colours: 1, vres: true, lm: 14, rm: 46, ld1: 0x0000, palette: [0x00, 0x49, 0x92, 0xff, 0, 0, 0, 0] },
      { lines: 5, mode: 7, lm: 63, rm: 0 },
      { lines: 10, mode: 7, lm: 4, rm: 63, palette: black },
      { lines: 4, mode: 0, lm: 4, rm: 63 },
      { lines: 1, mode: 0, lm: 63, rm: 4 },
      { lines: 30, mode: 7, lm: 4, rm: 63, palette: black },
      { lines: 6, mode: 7, lm: 63, rm: 0, reload: true }
    ];
    expect(demo.reduce((n, b) => n + b.lines, 0)).toBe(312);
    bareMachine(s, { lpt: demo, lptBase: 0x8000, settle: 0 });
    // --- A white bitmap (4 colours: every pixel colour 3), a red border
    for (let i = 0; i < 0x4000; i++) s.pokeVram(i, 0xff);
    s.wasm.epWritePort(0x81, 0x49);
    s.runFrames(3);
    expect(Math.abs(s.wasm.epGetTactsInCurrentFrame() - 79_941.9)).toBeLessThan(5);
    expect(s.wasm.epNickGetSyncSlot()).toBe(4);
    // --- Sync starts on LPT line 271, so LPT line 0 is 41 lines later: row 16. LM 14 shows from slot 15.
    const white = rgb(s, 0xff);
    const red = rgb(s, 0x49);
    expect(px(s, 79, 16)).toBe(red);
    expect(px(s, 80, 16)).toBe(white);
    expect(px(s, 591, 271)).toBe(white);
    expect(px(s, 592, 271)).toBe(red);
    expect(px(s, 300, 15)).not.toBe(white);
    expect(px(s, 300, 272)).toBe(red);
    await writeShotIfAsked(s, "is1984-demo-lpt");
  });

  it("loses the picture when no vertical sync comes, and finds it again", async () => {
    const s = await createEpSession();
    bareMachine(s);
    expect(s.wasm.epIsVideoSignalLost()).toBe(0);
    bareMachine(s, { lpt: [{ lines: 256, mode: 7, lm: 10, rm: 52, ld1: 0x4000, reload: true }], settle: 3 });
    expect(s.wasm.epIsVideoSignalLost()).toBe(1);
    bareMachine(s);
    expect(s.wasm.epIsVideoSignalLost()).toBe(0);
  });
});

describe("EXOS's screen", () => {
  /**
   * The IS-BASIC picture after boot, checked by eye: the status line "IS-BASIC  program 0" in red and
   * cyan, then "131072 bytes in system", "116102 bytes unused" and "ok" in green on black. (116121
   * without Klive's FILE: ROM: EXOS keeps 19 bytes of system RAM for its device.)
   */
  const BASIC_PICTURE_SHA1 = "ef4980f0405b180b7f51ae6b2c26129963110f11";

  it("draws IS-BASIC's screen, the picture checked by eye", async () => {
    const s = await createEpSession();
    s.bootToBasic();
    await writeShotIfAsked(s, "basic");
    expect(await pictureHash(s)).toBe(BASIC_PICTURE_SHA1);
  });

  it("colours the status line's IS-BASIC (codes with bit 7) red and plain text green: RM bit 6 is ALTIND1 (Q2)", async () => {
    const s = await createEpSession();
    s.bootToBasic();
    const lpt = s.lpt();
    // --- EXOS sets RM = 73h: bit 6, not bit 7
    expect(s.vram(lpt[0].address + 3)).toBe(0x73);
    const colours = (from: number, to: number) => {
      const seen = new Set<number>();
      const pixels = s.screenPixels();
      for (let y = from; y < to; y++) for (let x = 0; x < W; x++) seen.add(pixels[y * W + x] >>> 0);
      return seen;
    };
    // --- The status line (rows 18-26): black, cyan "program 0" (colour 1, 36h) and red "IS-BASIC"
    // --- (colour 3, 49h, through ALTIND1). The next row: black and green (92h) only.
    expect(colours(18, 27)).toEqual(new Set([rgb(s, 0x00), rgb(s, 0x36), rgb(s, 0x49)]));
    expect(colours(27, 36)).toEqual(new Set([rgb(s, 0x00), rgb(s, 0x92)]));
  });
});
