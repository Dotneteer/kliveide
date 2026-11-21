import { describe, expect, it } from "vitest";

import { createBareSam } from "./bare";
import type { SamTestSession } from "../harness/samcoupe";

/*
 * The ASIC's contention against Simon Owen's published instruction timings ("SAM Instruction Timings",
 * simonowen.com/sam/timings/, measured on a real SAM; ASIC_VIDEO_MEMORY_TIMING.md §4.5). The values below
 * are those facts, cited, not his table copied: steady-state T-states of an instruction repeated, with
 * its code and data in internal RAM ("Int") or external memory ("Ext", ROM behaves the same), in the
 * border or the screen area, in mode 4 with the screen on.
 *
 * Each case runs the instruction four times in a row from a chosen raster position and measures the
 * last three (the first aligns to the grid, Owen's "a single contended access aligns the instruction's
 * end to the contention grid").
 */

type Place = "int" | "ext";
type Region = "border" | "screen";

/** Frame tacts: a border line (frame line 10) and a screen line (screen line 100, hc 140) */
const REGION_TACT: Record<Region, number> = {
  border: 10 * 384 + 40,
  screen: (68 + 100) * 384 + 140
};

/** Where code runs: internal page 4 in section A at 0000h, or external page 0 in section C at 8000h */
const CODE_AT: Record<Place, number> = { int: 0x0100, ext: 0x8100 };
/** Where data lives: internal page 4 (section A) or external page 1 (section D) */
const DATA_AT: Record<Place, number> = { int: 0x2000, ext: 0xe000 };

async function measure(
  bytes: number[],
  code: Place,
  data: Place,
  region: Region,
  { mode = 4, setup }: { mode?: number; setup?: (s: SamTestSession) => void } = {}
): Promise<number> {
  const s = await createBareSam({ extmem: true });
  // --- External memory on: section C = external page 0, D = external page 1
  s.out(0x0080, 0x00);
  s.out(0x0081, 0x01);
  s.out(0x00fb, 0x80);
  // --- The screen mode (VMPR) on page 30
  s.out(0x00fc, (((mode - 1) & 3) << 5) | 30);
  const repeats = 4;
  const program: number[] = [];
  for (let i = 0; i < repeats; i++) program.push(...bytes);
  s.poke(CODE_AT[code], program);
  s.wasm.samSetCpuPc(CODE_AT[code]);
  s.wasm.samSetCpuHl(DATA_AT[data]);
  s.wasm.samSetCpuDe(DATA_AT[data] + 0x100);
  s.wasm.samSetCpuSp(DATA_AT[data] + 0x200);
  s.wasm.samSetCpuBc(0x0004);
  // --- A = 0: an OUT (FEh),A then keeps the border black and SOFF off
  s.wasm.samSetCpuAf(0x0000);
  setup?.(s);
  s.wasm.samSetFrameTact(REGION_TACT[region]);
  const times: number[] = [];
  let last = s.wasm.samGetTacts();
  for (let i = 0; i < repeats; i++) {
    s.wasm.samExecuteInstruction();
    const now = s.wasm.samGetTacts();
    times.push((now - last) >>> 0);
    last = now;
  }
  const steady = times.slice(1);
  return Math.round(steady.reduce((a, b) => a + b, 0) / steady.length);
}

describe("SAM contention (Owen's instruction timings)", () => {
  const cases: [string, number[], Record<string, number>][] = [
    ["NOP", [0x00], { intIntBorder: 4, intIntScreen: 8, extIntBorder: 4, extIntScreen: 4, extExt: 4 }],
    ["LD B,n", [0x06, 0x12], { intIntBorder: 8, intIntScreen: 16, extIntBorder: 7, extIntScreen: 7, extExt: 7 }],
    ["LD (HL),n", [0x36, 0x55], { intIntBorder: 12, intIntScreen: 24, extIntBorder: 12, extIntScreen: 16, extExt: 10 }],
    ["PUSH BC", [0xc5], { intIntBorder: 16, intIntScreen: 24, extIntBorder: 12, extIntScreen: 16, extExt: 11 }],
    ["EX (SP),HL", [0xe3], { intIntBorder: 24, intIntScreen: 40, extIntBorder: 24, extIntScreen: 40, extExt: 19 }]
  ];
  for (const [name, bytes, expected] of cases) {
    it(`${name}: Int/Int border ${expected.intIntBorder}, screen ${expected.intIntScreen}`, async () => {
      expect(await measure(bytes, "int", "int", "border")).toBe(expected.intIntBorder);
      expect(await measure(bytes, "int", "int", "screen")).toBe(expected.intIntScreen);
    });
    it(`${name}: Ext/Int border ${expected.extIntBorder}, screen ${expected.extIntScreen}; Ext/Ext ${expected.extExt}`, async () => {
      expect(await measure(bytes, "ext", "int", "border")).toBe(expected.extIntBorder);
      expect(await measure(bytes, "ext", "int", "screen")).toBe(expected.extIntScreen);
      expect(await measure(bytes, "ext", "ext", "border")).toBe(expected.extExt);
      expect(await measure(bytes, "ext", "ext", "screen")).toBe(expected.extExt);
    });
  }

  it("OUT (n),A: 12 (16 on an ASIC port) in the border, 16 (24) on the screen, with code in internal RAM", async () => {
    expect(await measure([0xd3, 0xe8], "int", "int", "border")).toBe(12);
    expect(await measure([0xd3, 0xfe], "int", "int", "border")).toBe(16);
    expect(await measure([0xd3, 0xe8], "int", "int", "screen")).toBe(16);
    expect(await measure([0xd3, 0xfe], "int", "int", "screen")).toBe(24);
    expect(await measure([0xd3, 0xe8], "ext", "int", "screen")).toBe(11);
    expect(await measure([0xd3, 0xfe], "ext", "int", "screen")).toBe(16);
  });

  it("IN A,(C): 12 (16 on an ASIC port) in the border, 16 (24) on the screen, with code in internal RAM", async () => {
    const port = (p: number) => ({ setup: (s: SamTestSession) => s.wasm.samSetCpuBc(p) });
    expect(await measure([0xed, 0x78], "int", "int", "border", port(0x00e8))).toBe(12);
    expect(await measure([0xed, 0x78], "int", "int", "border", port(0x00fe))).toBe(16);
    expect(await measure([0xed, 0x78], "int", "int", "screen", port(0x00e8))).toBe(16);
    expect(await measure([0xed, 0x78], "int", "int", "screen", port(0x00fe))).toBe(24);
    expect(await measure([0xed, 0x78], "ext", "int", "border", port(0x00fe))).toBe(16);
  });

  it("SOFF in mode 4 makes the screen area border: a NOP takes 4 T there", async () => {
    const soff = { setup: (s: SamTestSession) => s.out(0x00fe, 0x80) };
    expect(await measure([0x00], "int", "int", "screen", soff)).toBe(4);
  });

  it("mode 1's stripes hold internal RAM to 1 in 8 in parts of the border", async () => {
    // --- Frame line 10: hc 0-59 is a stripe (1 in 8), hc 64-119 is not (1 in 4)
    const s = await createBareSam();
    s.out(0x00fc, 30);
    // --- The contention region follows the mode from the next cell
    s.step(2);
    let stripe = 0;
    let free = 0;
    for (let hc = 0; hc < 384; hc++) {
      // --- The worst wait in each T is 7 in a 1-in-8 region, 3 in a 1-in-4 one
      const w = s.wasm.samGetContentionWait(0, 10 * 384 + hc);
      if (w > 3) stripe++;
      else free++;
    }
    // --- Three 64-T stripes a line: 3 x 64 positions, of which half have waits above 3
    expect(stripe).toBe(96);
    expect(free).toBe(384 - 96);
  });
});
