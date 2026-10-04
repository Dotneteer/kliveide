import { describe, expect, it } from "vitest";

import { createZx81Session, type Zx81TestSession } from "../harness/zx81";
import { expectSameBytes } from "../expectBytes";

/**
 * The ZX81 ULA's timing on the real ROM (`.plans/ZX8081_WASM_PLAN.md` §6, §12): VSYNC per TV frame,
 * the 207-T display line timed by the ROM's own WAIT-INT path (LD R,A / EI / JP (HL) and the INT on
 * A6), and the NMI/WAIT synchronisation that makes the picture jitter-free.
 */

const INT_ENTRY = 0x0038;

/** The T-states between successive INT entries ($0038) while the picture is drawn, and the ULA's line timer at each */
function intEntries(s: Zx81TestSession, count: number): { tacts: number; hcounter: number }[] {
  const entries: { tacts: number; hcounter: number }[] = [];
  for (let i = 0; i < 2_000_000 && entries.length < count; i++) {
    s.wasm.zx8081ExecuteInstruction();
    if (s.wasm.zx8081GetCpuPc() === INT_ENTRY) {
      entries.push({ tacts: s.wasm.zx8081GetTacts(), hcounter: s.wasm.zx8081GetHcounter() });
    }
  }
  return entries;
}

describe("ZX81 ULA timing", () => {
  it("a PAL machine in SLOW mode sends a VSYNC every 311 lines (19.8 ms)", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    const tv = s.wasm.zx8081GetTvFrames();
    s.runFrames(100);
    // --- 100 emulation frames of 65,000 T; a TV frame is 311 x 207 = 64,377 T, so 100 or 101 of them
    // --- (6,500,000 / 64,377 = 100.97), depending on where the first one fell
    expect(s.wasm.zx8081GetTvFrames() - tv).toBeGreaterThanOrEqual(100);
    expect(s.wasm.zx8081GetTvFrames() - tv).toBeLessThanOrEqual(101);
    expect(s.wasm.zx8081GetLastFrameLines()).toBe(311);
  });

  it("an NTSC machine reads bit 6 low, sets MARGIN 31 and sends 263-line frames (16.8 ms)", async () => {
    const s = await createZx81Session({ model: "zx81-16k-us" });
    s.bootToBasic();
    expect(s.peek(0x4028)).toBe(31);
    s.runFrames(60);
    expect(s.wasm.zx8081GetLastFrameLines()).toBe(263);
    expect(s.screenHeight).toBe(240);
    // --- Port $FE bit 6 is the TV standard
    expect(s.wasm.zx8081ReadPort(0xfefe) & 0x40).toBe(0);
  });

  it("a PAL machine reads port $FE bit 6 high", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    expect(s.wasm.zx8081ReadPort(0xfefe) & 0x40).toBe(0x40);
  });

  it("each display line is 207 T: the INT on A6 ends it at the same line timer value", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    const entries = intEntries(s, 400);
    // --- 193 INTs a picture (ROM listing, INTERRUPT); look at the lines within one picture
    const gaps = entries.slice(1).map((e, i) => e.tacts - entries[i].tacts);
    const lineGaps = gaps.filter((g) => g < 300);
    expect(lineGaps.length).toBeGreaterThan(300);
    expect(new Set(lineGaps)).toEqual(new Set([207]));
  });

  it("the picture starts at the same T-state of its line every frame: the NMI and WAIT synchronise it", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    // --- A running program, so the NMIs interrupt instructions of every length (at the idle prompt
    // --- the CPU loops in step with the lines, and even an unsynchronised display would look still).
    // --- K mode: L is LET, G is GOTO, R is RUN; SHIFT+L is "=", and RND is a function (SHIFT+NEW
    // --- LINE, then T).
    s.typeKeys("10LA=");
    s.typeChords([0, 30], [14]);
    s.typeKeys("\n20G10\nR\n", { settle: 20 });
    expect(s.screenText()[23]).toBe("");
    // --- The display routine jumps into the display file's upper echo (D_FILE + $8000) once a
    // --- picture, after the HALT the last blank-line NMI woke. Unsynchronised, the line timer there
    // --- would vary with the length of whatever instruction the NMI interrupted.
    const start = s.peekWord(0x400c) | 0x8000;
    // --- The first row's lines all restart there, so only the first hit of each picture counts
    const timers: number[] = [];
    let lastHit = -1_000_000;
    for (let i = 0; i < 5_000_000 && timers.length < 8; i++) {
      s.wasm.zx8081ExecuteInstruction();
      if (s.wasm.zx8081GetCpuPc() === start) {
        const tacts = s.wasm.zx8081GetTacts();
        if (tacts - lastHit > 10_000) timers.push(s.wasm.zx8081GetHcounter());
        lastHit = tacts;
      }
    }
    expect(timers.length).toBe(8);
    expect(new Set(timers).size).toBe(1);
  });

  it("WAIT holds the NMI that ends a HALT to the end of HSYNC: the handler starts at the same T of the line", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    // --- The ROM synchronises its picture this way (NMI-CONT: HALT, then the next NMI): a HALTed CPU
    // --- is not held by WAIT, so the NMI's acknowledge starts within 4 T of HSYNC, and WAIT stretches
    // --- it to HSYNC's end. Here HALTs are reached after code of different lengths, so without WAIT
    // --- the handler would start at different T-states of the line. (An NMI that interrupts running
    // --- code is not synchronised: WAIT ends with HSYNC and the rest of the instruction varies.)
    s.poke(0x6000, [
      0xf3, // DI
      0xd3, 0xfe, // OUT ($FE),A: the NMI generator on
      0x76, // loop: HALT
      0x00, // NOP
      0x76, // HALT
      0xe3, // EX (SP),HL
      0xe3, // EX (SP),HL
      0x76, // HALT
      0xdd, 0x23, // INC IX
      0x3a, 0x00, 0x40, // LD A,($4000)
      0x18, 0xf3 // JR loop
    ]);
    s.machine.pc = 0x6000;
    // --- A' counts the blank lines in the ROM's NMI handler: from $80 it returns at once (NMI-RET)
    s.machine.af_ = 0x8000;
    const timers: number[] = [];
    for (let i = 0; i < 200_000 && timers.length < 60; i++) {
      s.wasm.zx8081ExecuteInstruction();
      if (s.wasm.zx8081GetCpuPc() === 0x0066) timers.push(s.wasm.zx8081GetHcounter());
    }
    expect(timers.length).toBe(60);
    expect(new Set(timers).size).toBe(1);
  });

  it("the picture is identical over 100 frames (no jitter)", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    // --- Long enough for the ROM to print its report: the picture is then still
    s.typeKeys('P"JITTER"\n', { settle: 50 });
    const first = s.screenPixels();
    for (let i = 0; i < 100; i++) {
      s.runFrames(1);
      expectSameBytes(s.screenPixels(), first, `the picture of frame ${i + 1}`);
    }
  });

  it("the boot picture is centred: the K cursor's cell is at (48, 232)", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    // --- 256 x 192 picture in a 352 x 288 window: 48 pixels of border, row 23 at 48 + 23 * 8
    expect(s.pixelArt(48, 232, 8, 8)).toEqual([
      "########",
      "#.###.##",
      "#.##.###",
      "#...####",
      "#.##.###",
      "#.###.##",
      "#.####.#",
      "########"
    ]);
    expect(s.isInk(47, 232)).toBe(false);
    expect(s.isInk(56, 232)).toBe(false);
  });
});
