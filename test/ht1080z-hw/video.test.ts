import { describe, expect, it } from "vitest";

import { createHtSession, type Ht1080zTestSession } from "../harness/ht1080z";

/*
 * The Phase 3 video probes (`.plans/HT1080Z_PLAN.md` §6, §13): the beam against the CPU at T-state
 * precision. One instruction is started at a chosen frame tact; its memory cycle's T1 is 10 T later
 * (`LD A,(nn)` and `LD (nn),A`: opcode 4 T, operands 3 + 3 T). The picture of that frame then shows
 * where the beam was:
 *
 * - the display reads column n at slot n and shows it at slot n + 2 (the visible window is 2-65);
 * - an access whose T1 is at slot x blanks the reads at x and x + 1 (the dash, D7);
 * - a write is seen by the reads after its T1 slot, so a column the beam has read already changes
 *   from the next scan line.
 */

const LOOP = 0x6000;
const PROBE = 0x6100;
const WINDOW_X = 72;
const WINDOW_Y = 48;
const WHITE = 0xffffffff;

/** A booted Series II with the CPU parked in a `JR $` outside video RAM */
async function parked(): Promise<Ht1080zTestSession> {
  const s = (await createHtSession()).bootToPrompt();
  s.poke(LOOP, [0x18, 0xfe]);
  s.machine.pc = LOOP;
  return s;
}

/** Fills video RAM through the IDE (no dash) */
function fill(s: Ht1080zTestSession, value: number): void {
  for (let i = 0; i < 0x400; i++) s.poke(0x3c00 + i, value);
}

/**
 * Runs the parked loop until the next instruction starts in [from, to) of the frame, then runs
 * `opcode nn` there, and finishes the frame. Returns the slot of the memory cycle's T1.
 */
function probeAt(s: Ht1080zTestSession, from: number, to: number, opcode: number, address: (t1: number) => number): number {
  s.machine.pc = LOOP;
  let guard = 0;
  while (true) {
    const tact = s.wasm.ht1080zGetFrameTacts();
    if (tact >= from && tact < to) break;
    s.step();
    if (++guard > 10_000) throw new Error("the frame position was never reached");
  }
  const t1 = s.wasm.ht1080zGetFrameTacts() + 10;
  const target = address(t1);
  s.poke(PROBE, [opcode, target & 0xff, target >> 8, 0x18, 0xfe]);
  s.machine.pc = PROBE;
  s.step();
  s.runFrames(1);
  return t1;
}

/** Whether the 6 dots of the cell read at `read` (0-63) on frame line `line` are all white / all black */
function cell(s: Ht1080zTestSession, line: number, read: number): "white" | "black" | "mixed" {
  const pixels = s.machine.getPixelBuffer();
  const start = (WINDOW_Y + line) * 528 + WINDOW_X + read * 6;
  const lit = [0, 1, 2, 3, 4, 5].filter((d) => pixels[start + d] === WHITE).length;
  return lit === 6 ? "white" : lit === 0 ? "black" : "mixed";
}

const LD_A_NN = 0x3a;
const LD_NN_A = 0x32;
/** The probes run on line 30 (text row 2, scan line 6), columns 10-40 */
const LINE = 30;
const FROM = LINE * 112 + 10 - 10;
const TO = LINE * 112 + 40 - 10;

describe("HT-1080Z video: the CPU-access dash", () => {
  it("blanks the two characters read at the access's T1 and the next slot, on that scan line only", async () => {
    const s = await parked();
    fill(s, 0xbf); // --- every cell solid white
    const t1 = probeAt(s, FROM, TO, LD_A_NN, () => 0x3c00);
    const x = t1 % 112;
    expect(Math.floor(t1 / 112)).toBe(LINE);
    expect([x - 1, x, x + 1, x + 2].map((read) => cell(s, LINE, read))).toEqual(["white", "black", "black", "white"]);
    // --- Every other cell of the frame is white
    for (const line of [LINE - 1, LINE + 1, 0, 191]) {
      for (let read = 0; read < 64; read++) expect(cell(s, line, read), `line ${line} read ${read}`).toBe("white");
    }
  });

  it("is not drawn when the dash is turned off", async () => {
    const s = await parked();
    s.wasm.ht1080zSetVideoDash(0);
    fill(s, 0xbf);
    probeAt(s, FROM, TO, LD_A_NN, () => 0x3c00);
    for (let read = 0; read < 64; read++) expect(cell(s, LINE, read)).toBe("white");
  });

  it("does not come from accesses outside video RAM", async () => {
    const s = await parked();
    fill(s, 0xbf);
    probeAt(s, FROM, TO, LD_A_NN, () => 0x3bff);
    probeAt(s, FROM, TO, LD_A_NN, () => 0x4000);
    for (let read = 0; read < 64; read++) expect(cell(s, LINE, read)).toBe("white");
  });
});

describe("HT-1080Z video: the beam against a write", () => {
  /** Row 2 black; a white block written to the column `offset` slots after the write's T1 */
  async function writeAt(offset: number, dash: boolean) {
    const s = await parked();
    s.wasm.ht1080zSetVideoDash(dash ? 1 : 0);
    fill(s, 0x80);
    s.machine.a = 0xbf;
    let column = 0;
    const t1 = probeAt(s, FROM, TO, LD_NN_A, (t) => {
      column = (t % 112) + offset;
      return 0x3c00 + Math.floor(LINE / 12) * 64 + column;
    });
    expect(Math.floor(t1 / 112)).toBe(LINE);
    // --- Earlier scan lines of the row are black, later ones white: the write landed on LINE
    expect(cell(s, LINE - 1, column)).toBe("black");
    expect(cell(s, LINE + 1, column)).toBe("white");
    return cell(s, LINE, column);
  }

  it("a column read at the write's T1 or before still shows the old byte on that line", async () => {
    expect(await writeAt(0, false)).toBe("black");
    expect(await writeAt(-1, false)).toBe("black");
    expect(await writeAt(-1, true)).toBe("black");
  });

  it("a column read after the T1 shows the new byte on that line", async () => {
    expect(await writeAt(1, false)).toBe("white");
    // --- With the dash on, reads at T1 and T1 + 1 are blank; the next one is the new byte
    expect(await writeAt(1, true)).toBe("black");
    expect(await writeAt(2, true)).toBe("white");
  });
});

describe("HT-1080Z video: VIDEO CUT and PAGE", () => {
  /** Column 0 lights its top-left block, column 32 its top-right one; the rest is black */
  async function topLeftCells(cut: boolean, page: boolean): Promise<string[]> {
    const s = await parked();
    fill(s, 0x80);
    s.poke(0x3c00, 0x81).poke(0x3c00 + 32, 0x82);
    s.wasm.ht1080zSetVideoCut(cut ? 1 : 0);
    s.wasm.ht1080zSetVideoPage(page ? 1 : 0);
    s.runFrames(2);
    const pixels = s.machine.getPixelBuffer();
    // --- The first 12 dots of the top scan line, and of the line under the block band (scan 4)
    return [0, 4].map((line) =>
      Array.from({ length: 12 }, (_, d) => (pixels[(WINDOW_Y + line) * 528 + WINDOW_X + d] === WHITE ? "#" : ".")).join("")
    );
  }

  it("draws 64 columns of 6 dots normally", async () => {
    expect(await topLeftCells(false, false)).toEqual(["###.........", "............"]);
  });

  it("draws column 0 at double width in 32 columns", async () => {
    expect(await topLeftCells(true, false)).toEqual(["######......", "............"]);
  });

  it("draws column 32 there with PAGE", async () => {
    expect(await topLeftCells(true, true)).toEqual(["......######", "............"]);
  });

  it("keeps the frame length in 32 columns", async () => {
    const s = await parked();
    s.wasm.ht1080zSetVideoCut(1);
    const tacts = s.wasm.ht1080zGetTacts();
    s.runFrames(3);
    expect(Math.abs(s.wasm.ht1080zGetTacts() - tacts - 3 * 34_944)).toBeLessThan(24);
  });
});
