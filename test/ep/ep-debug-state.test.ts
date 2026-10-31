import { describe, expect, it } from "vitest";

import {
  buildEpDaveDebugState,
  buildEpNickDebugState,
  decodeEpLpb,
  epColourCss,
  readEpLpt,
  type EpNickCore
} from "@emu/machines/enterprise/EpDebugState";

/*
 * The NICK and DAVE panels' decoding (`EpDebugState.ts`), without a core: the LPB fields
 * (NICK_VIDEO.md §3.2) and DAVE's registers (DAVE_MEMORY_IO.md §4, §5, §8).
 */

describe("decodeEpLpb", () => {
  it("decodes every field of a block, the ALT bits included", () => {
    // --- SC = FCh (4 lines); MB: VINT, 16 colours, VRES, CH128, RELOAD; LM 0Bh + MSBALT; RM 2Eh + ALTIND1
    const b = decodeEpLpb(0x3010, [0xfc, 0x80 | 0x40 | 0x10 | (4 << 1) | 1, 0x80 | 0x0b, 0x40 | 0x2e, 0x34, 0x12, 0x78, 0x56, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(b).toMatchObject({
      address: 0x3010,
      lines: 4,
      mode: 4,
      colours: 2,
      vres: true,
      vint: true,
      reload: true,
      lm: 0x0b,
      rm: 0x2e,
      msbAlt: true,
      lsbAlt: false,
      altInd1: true,
      altInd0: false,
      ld1: 0x1234,
      ld2: 0x5678,
      palette: [1, 2, 3, 4, 5, 6, 7, 8]
    });
  });

  it("gives an SC of 0 256 lines", () => {
    expect(decodeEpLpb(0, new Array(16).fill(0)).lines).toBe(256);
  });
});

describe("readEpLpt", () => {
  it("lists the blocks to the RELOAD one, wrapping in NICK's 64K", () => {
    const vram = new Uint8Array(0x10000);
    vram[0xfff1] = 0x02; // --- a PIXEL block at FFF0h
    vram[0x0001] = 0x01; // --- the RELOAD block after the wrap
    const lpt = readEpLpt((a) => vram[a], 0xfff0);
    expect(lpt.map((b) => b.address)).toEqual([0xfff0, 0x0000]);
    expect(lpt[1].reload).toBe(true);
  });

  it("stops at 64 blocks when no block reloads", () => {
    expect(readEpLpt(() => 0, 0)).toHaveLength(64);
  });
});

describe("buildEpNickDebugState", () => {
  const core: EpNickCore = {
    ports: [0x1b, 0x2c, 0x00, 0x03],
    lptBase: 0x3000,
    lptAddress: 0x3010,
    lpb: [0xff, 0x0e, 10, 52, 0, 0x40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ld1: 0x4005,
    ld2: 0,
    linesLeft: 1,
    slot: 20,
    line: 100,
    displayOn: true,
    vsyncOn: false,
    mode: 7,
    dataBus: 0xff
  };

  it("marks the block at the LPT pointer and decodes FIXBIAS, the border and the colours", () => {
    const vram = new Uint8Array(0x10000);
    vram[0x3021] = 0x01;
    const state = buildEpNickDebugState(core, (a) => vram[a], (c) => 0xff000000 | (c << 16) | (c << 8) | c);
    expect(state.lpt).toHaveLength(3);
    expect(state.currentIndex).toBe(1);
    expect(state.current).toMatchObject({ address: 0x3010, mode: 7, lines: 1, lm: 10, rm: 52, ld1: 0x4000 });
    expect(state.fixBias).toBe(0x1b);
    expect(state.border).toBe(0x2c);
    expect(state.rgb).toHaveLength(256);
    expect(epColourCss(state.rgb, 0x40)).toBe("rgb(64, 64, 64)");
  });
});

describe("buildEpDaveDebugState", () => {
  const registers = new Array(16).fill(0);
  registers[0] = 0x8b; // --- ch0 code 18Bh, 7-bit distortion, high-pass
  registers[1] = 0x01 | 0x30 | 0x40;
  registers[4] = 99; // --- ch2 code 99, ring
  registers[5] = 0x80;
  registers[6] = 0x02 | (1 << 2) | 0x10 | 0x20; // --- noise: ch1 clock, 15-bit, swapped, low-pass
  registers[7] = 0x04 | 0x08 | 0x40; // --- ch2 sync, left D/A, tone 0 interrupts
  registers[8] = 0x3f;
  registers[14] = 0x21;
  registers[15] = 0x0a;

  it("decodes the channels, the noise, A7h and BFh", () => {
    const s = buildEpDaveDebugState({ b4: 0x35, enable: 0x11, latch: 0x22, bf: 0x0c, registers }, [0, 0xf8, 0xf9, 0xff], ["00", "F8", "F9", "FF"]);
    expect(s.tickHz).toBe(250_000);
    expect(s.tones[0]).toMatchObject({ code: 0x18b, distortion: 3, highPass: true, ring: false, sync: false, left: 0x3f });
    expect(s.tones[0].frequency).toBeCloseTo(125_000 / 0x18c);
    expect(s.tones[2]).toMatchObject({ code: 99, frequency: 1250, ring: true, sync: true, right: 0x21 });
    expect(s.noise).toMatchObject({ clock: 2, polyBits: 15, swapPolys: true, lowPass: true, highPass: false, right: 0x0a });
    expect(s.dacLeft).toBe(true);
    expect(s.dacRight).toBe(false);
    expect(s.intSelect).toBe(2);
    expect(s.waitMode).toBe(3);
    expect(s.clock12MHz).toBe(false);
    expect(s.ram16K).toBe(false);
  });

  it("reads B4h's levels and latches and the enables per source", () => {
    const s = buildEpDaveDebugState({ b4: 0x35, enable: 0x11, latch: 0x22, bf: 0, registers }, [], []);
    expect(s.interrupts).toEqual([
      { enabled: true, latched: true, level: true },
      { enabled: false, latched: false, level: true },
      { enabled: true, latched: true, level: true },
      { enabled: false, latched: false, level: false }
    ]);
  });

  it("slows the tick to 2/3 with BFh bit 1", () => {
    const s = buildEpDaveDebugState({ b4: 0, enable: 0, latch: 0, bf: 0x03, registers }, [], []);
    expect(s.clock12MHz).toBe(true);
    expect(s.ram16K).toBe(true);
    expect(s.tickHz).toBeCloseTo(166_666.67, 1);
    expect(s.tones[2].frequency).toBeCloseTo(833.33, 1);
  });
});
