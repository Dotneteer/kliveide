import { describe, expect, it } from "vitest";

import type { NextLayer2State } from "@common/messaging/EmuApi";
import { LAYER2_NO_PIXEL, layer2Size, writeTarget } from "@common/zxnext/layer2/layer2Decode";
import { displayedImage } from "@common/zxnext/layer2/layer2Geometry";
import { type NextTestSession } from "../../harness/zxnext";
import { hex8 } from "../ula/_ula-helpers";
import { L2_DEFAULT, layer2Index, layer2Screen, pokeBank, randomBank, type L2 } from "./_layer2-helpers";

/*
 * What the Layer 2 Inspector reads (`.plans/LAYER2_INSPECTOR_PLAN.md` Phase 2, D3): the snapshot is
 * the registers a program wrote and the bytes it stored; the *As displayed* image `layer2Decode` and
 * `layer2Geometry` make from that snapshot equals both the layer2.vhd transcription in
 * `_layer2-helpers.ts` and the core's rendered Layer 2 pixels; reading never changes the machine.
 */

const NONE = hex8(0xe3);

/** Sets a configuration's registers and turns Layer 2 on through $123B. */
function apply(s: NextTestSession, p: L2, resolution = p.resolution): NextTestSession {
  s.setNextReg(0x12, p.bank).setNextReg(0x70, (resolution << 4) | p.offset);
  s.setNextReg(0x16, p.sx & 0xff).setNextReg(0x71, p.sx >> 8).setNextReg(0x17, p.sy);
  s.setNextReg(0x1c, 0x01).setNextReg(0x18, p.clip[0]).setNextReg(0x18, p.clip[1]).setNextReg(0x18, p.clip[2]).setNextReg(0x18, p.clip[3]);
  return s.out(0x123b, 0x02);
}

/** The decoded *As displayed* image of a snapshot. */
function decodeDisplayed(state: NextLayer2State): Int16Array {
  const r = state.regs;
  return displayedImage(r, state.displayed, r.activeBank);
}

/** Pixels where the decode differs from the model (at most 8). */
function modelMismatches(mem: Map<number, Uint8Array>, p: L2, image: Int16Array): string[] {
  const { width, height } = layer2Size(p.resolution);
  const bad: string[] = [];
  for (let y = 0; y < height && bad.length < 8; y++) {
    for (let x = 0; x < width && bad.length < 8; x++) {
      const want = layer2Index(mem, p, x, y);
      const got = image[y * width + x];
      if (got !== want) bad.push(`(${x},${y}): decode ${got} != model ${want}`);
    }
  }
  return bad;
}

/** Pixels where the core's picture differs from the decode (at most 8). */
function coreMismatches(s: NextTestSession, resolution: number, image: Int16Array): string[] {
  const size = layer2Size(resolution);
  const bad: string[] = [];
  for (let y = 0; y < size.height && bad.length < 8; y++) {
    for (let x = 0; x < size.width && bad.length < 8; x++) {
      const index = image[y * size.width + x];
      const want = index === LAYER2_NO_PIXEL ? NONE : hex8(index);
      const bx = !size.wide ? 96 + 2 * x : size.nibbles ? 32 + x : 32 + 2 * x;
      const by = (size.wide ? 16 : 48) + y;
      const got = s.pixel(bx, by);
      if (got !== want) bad.push(`(${x},${y}): core ${got} != decode ${want}`);
    }
  }
  return bad;
}

const WIDE: [number, number, number, number] = [0, 159, 0, 255];
const CONFIGS: [string, L2][] = [
  ["L2-001: 256x192 at reset", L2_DEFAULT],
  ["L2-003: 256x192 from $12 = 9", { ...L2_DEFAULT, bank: 9 }],
  ["256x192 scrolled (the Y fold-back)", { ...L2_DEFAULT, sx: 0x1a3, sy: 250 }],
  ["256x192 palette offset 5, clipped", { ...L2_DEFAULT, offset: 5, clip: [10, 200, 20, 150] }],
  ["L2-006: 320x256", { ...L2_DEFAULT, resolution: 1, clip: WIDE }],
  ["320x256 scrolled past 320 (T4)", { ...L2_DEFAULT, resolution: 1, sx: 0x1f7, sy: 77, clip: WIDE }],
  ["320x256 clipped, offset 9", { ...L2_DEFAULT, resolution: 1, offset: 9, clip: [3, 120, 7, 240] }],
  ["640x256", { ...L2_DEFAULT, resolution: 2, clip: WIDE }],
  ["640x256 scrolled, offset 3, clipped", { ...L2_DEFAULT, resolution: 2, offset: 3, sx: 301, sy: 5, clip: [1, 150, 2, 200] }]
];

describe("Layer 2 Inspector state", () => {
  for (const [name, p] of CONFIGS) {
    it(`D3: ${name} - the decode equals the model and the core`, async () => {
      const { s, mem } = await layer2Screen(8, 8);
      apply(s, p).runFrames(2);
      const state = s.layer2State();
      for (let b = 0; b < 5; b++) {
        expect(Array.from(state.displayed.subarray(b * 0x4000, (b + 1) * 0x4000)), `bank ${p.bank + b}`).toEqual(
          Array.from(mem.get(p.bank + b)!)
        );
      }
      const image = decodeDisplayed(state);
      expect(modelMismatches(mem, p, image)).toEqual([]);
      expect(coreMismatches(s, p.resolution, image)).toEqual([]);
    });
  }

  it("$70 resolution %11 is 640x256 too (layer2.vhd: 1X)", async () => {
    const { s } = await layer2Screen(8, 5);
    apply(s, { ...L2_DEFAULT, resolution: 2, clip: WIDE }, 3).runFrames(2);
    const state = s.layer2State();
    expect(state.regs.resolution).toBe(3);
    expect(coreMismatches(s, 3, decodeDisplayed(state))).toEqual([]);
  });

  it("T5: banks past 2 MB have no pixels, in the decode and on screen", async () => {
    const { s, mem } = await layer2Screen(110, 2);
    const p: L2 = { ...L2_DEFAULT, resolution: 1, bank: 110, clip: WIDE };
    apply(s, p).runFrames(2);
    const state = s.layer2State();
    expect(Array.from(state.displayed.subarray(0x8000, 0x8010))).toEqual(new Array(16).fill(0));
    const image = decodeDisplayed(state);
    expect(image[200]).toBe(LAYER2_NO_PIXEL); // --- column 200 is the fourth bank
    expect(modelMismatches(mem, p, image)).toEqual([]);
    expect(coreMismatches(s, 1, image)).toEqual([]);
  });

  it("reads back every register a program wrote, $123B peeked", async () => {
    const { s } = await layer2Screen(8, 1);
    s.setNextReg(0x12, 20).setNextReg(0x13, 30).setNextReg(0x70, 0x1a).setNextReg(0x16, 0x34).setNextReg(0x71, 1).setNextReg(0x17, 9);
    s.setNextReg(0x1c, 0x01).setNextReg(0x18, 1).setNextReg(0x18, 2).setNextReg(0x18, 3).setNextReg(0x18, 4).setNextReg(0x18, 7);
    s.out(0x123b, 0x15).out(0x123b, 0x8f).setNextReg(0x14, 0x12).setNextReg(0x43, 0x04);
    const { regs, copperRunning, shadow } = s.layer2State();
    expect(regs).toEqual({
      enabled: true,
      activeBank: 20,
      shadowBank: 30,
      port123B: 0x8f,
      bankOffset: 5,
      resolution: 1,
      paletteOffset: 0x0a,
      scrollX: 0x134,
      scrollY: 9,
      clip: [7, 2, 3, 4],
      clipIndex: 1,
      globalTransparency: 0x12,
      secondPalette: true
    });
    expect(copperRunning).toBe(false);
    expect(shadow).toBeUndefined();
  });

  it("T1: a program writing through $123B with bit 3 set lands in the shadow set, as writeTarget says", async () => {
    const { s } = await layer2Screen(8, 1);
    s.setNextReg(0x13, 14);
    pokeBank(s, 15, new Uint8Array(0x4000));
    s.out(0x123b, 0x40 | 0x08 | 0x02 | 0x01); // --- segment 1, shadow, displayed, writes mapped
    const bytes = Array.from(randomBank(77).slice(0, 64));
    s.poke(0x0100, bytes);
    const state = s.layer2State({ shadow: true });
    const target = writeTarget(state.regs);
    expect(target).toMatchObject({ mappedForWrites: true, useShadow: true, segment: 1 });
    expect(target.slices[0].bank16).toBe(15);
    expect(Array.from(state.shadow!.subarray(0x4100, 0x4140))).toEqual(bytes);
    expect(Array.from(state.displayed.subarray(0x4100, 0x4140))).not.toEqual(bytes);
  });

  it("the memory mapping data reports the real $123B value", async () => {
    const { s } = await layer2Screen(8, 1);
    s.out(0x123b, 0x47);
    const m = s.machine as unknown as { getNextMemoryMapping(): { portLayer2: number } };
    expect(m.getNextMemoryMapping().portLayer2).toBe(0x47);
  });

  it("D8: two reads in a row are identical, and reading does not change the state image", async () => {
    const { s } = await layer2Screen(8, 5);
    apply(s, { ...L2_DEFAULT, sx: 3 }).runFrames(1);
    const before = s.machine.saveMachineState().image;
    const a = s.layer2State({ shadow: true });
    const b = s.layer2State({ shadow: true });
    const after = s.machine.saveMachineState().image;
    expect(b).toEqual(a);
    expect(Buffer.compare(Buffer.from(before), Buffer.from(after))).toBe(0);
  });
});
