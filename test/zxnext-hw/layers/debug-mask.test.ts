import { describe, expect, it } from "vitest";

import type { NextTestSession } from "../../harness/zxnext";
import type { Frame } from "../../harness/zxnext/core/frame";
import type { NextLayerId } from "@common/zxnext/layers/layerMix";
import { parkedSession } from "../ula/_ula-helpers";
import { apply, configs, describeConfig, hex9, makeScene, mismatches, sceneSession, type Config } from "./_scene";

/*
 * The IDE's layer debug mask (`.plans/LAYER_COMPOSITION_PLAN.md` Phase 2): hide, solo and "show
 * transparency" act in the mixer only (D1).
 *
 * - With layers hidden, every cell of the random compositing scene still matches the mixer model,
 *   which treats a hidden layer's pixels as transparent and changes nothing else (T4).
 * - Hiding a layer gives the same picture as the program disabling it - except where hiding and
 *   disabling differ by design: stencil mode and a tile's "below" bit (T4), and the blend modes, which
 *   read the ULA even when $68 bit 7 disables it.
 * - The sprite collision and "too many sprites" flags ($303B) are the same with sprites hidden (T1).
 * - The mask is debugging state: it is not machine state and does not reach a program.
 */

const LAYER_MASK: Record<NextLayerId, number> = { ula: 1, tm: 2, l2: 4, spr: 8 };
const idsOf = (bits: number) => (Object.keys(LAYER_MASK) as NextLayerId[]).filter((id) => bits & LAYER_MASK[id]);

const sameFrame = (a: Frame, b: Frame) => a.rgba.length === b.rgba.length && a.rgba.every((v, i) => v === b.rgba[i]);

/** The first pixels where two frames differ, for a readable failure */
function frameDiff(a: Frame, b: Frame, max = 4): string[] {
  const out: string[] = [];
  for (let i = 0; i < a.rgba.length && out.length < max; i += 4) {
    if (a.rgba[i] !== b.rgba[i] || a.rgba[i + 1] !== b.rgba[i + 1] || a.rgba[i + 2] !== b.rgba[i + 2]) {
      const p = i / 4;
      out.push(`(${p % a.width},${Math.floor(p / a.width)})`);
    }
  }
  return out;
}

const copy = (f: Frame): Frame => ({ ...f, rgba: f.rgba.slice() });

describe("layer debug mask", () => {
  for (let order = 0; order < 8; order++) {
    it(`every cell matches the mixer model with layers hidden: $15 order ${order}`, async () => {
      const sc = makeScene(400 + order);
      const s = await sceneSession(sc);
      const bad: string[] = [];
      // --- every other configuration; each single layer hidden and two pairs
      const list = configs(order).filter((_, i) => i % 2 === 0);
      for (const hidden of [1, 2, 4, 8, 5, 10]) {
        for (const cfg of list) {
          const c: Config = { ...cfg, hidden };
          s.setLayerDebug({ hide: idsOf(hidden) });
          apply(s, c).runFrames(2);
          const m = mismatches(s, sc, c);
          if (m.length) bad.push(`hidden ${idsOf(hidden).join("+")}, ${describeConfig(c)}:\n  ${m.join("\n  ")}`);
          if (bad.length >= 4) break;
        }
      }
      expect(bad).toEqual([]);
    });
  }

  it("hiding a layer looks like the program disabling it (orders 0-5, no stencil)", async () => {
    const sc = makeScene(500);
    const s = await sceneSession(sc);
    const disable: Record<NextLayerId, (s: NextTestSession, on: boolean) => void> = {
      ula: (s, on) => s.setNextReg(0x68, on ? 0x00 : 0x80),
      tm: (s, on) => s.setNextReg(0x6b, on ? 0x80 : 0x00),
      l2: (s, on) => s.out(0x123b, on ? 0x02 : 0x00),
      spr: (s, on) => s.setNextReg(0x15, (s.nextRegValue(0x15) & ~0x01) | (on ? 0x01 : 0))
    };
    const bad: string[] = [];
    for (let order = 0; order < 6; order++) {
      for (const id of ["ula", "tm", "l2", "spr"] as NextLayerId[]) {
        apply(s, { order, blend: 0, stencil: false, ulaEn: true, tmEn: true, tmOnTop: false, spritesEn: true, lores: false });
        s.setLayerDebug({ hide: [id] }).runFrames(2);
        const hidden = copy(s.screen());
        s.setLayerDebug();
        disable[id](s, false);
        s.runFrames(2);
        const disabled = copy(s.screen());
        disable[id](s, true);
        if (!sameFrame(hidden, disabled)) bad.push(`order ${order}, ${id}: ${frameDiff(hidden, disabled).join(" ")}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("T4: a hidden tilemap keeps stencil mode on (the ULA goes too); a disabled one turns it off", async () => {
    const sc = makeScene(501);
    const s = await sceneSession(sc);
    const cfg: Config = { order: 0, blend: 0, stencil: true, ulaEn: true, tmEn: true, tmOnTop: false, spritesEn: true, lores: false };
    apply(s, cfg);
    s.setLayerDebug({ hide: ["tm", "l2", "spr"] }).runFrames(2);
    // --- stencil: ULA AND tilemap - with every tilemap pixel transparent, nothing but the fallback
    expect(mismatches(s, sc, { ...cfg, hidden: 2 | 4 | 8 })).toEqual([]);
    expect(s.pixel(32 + 10 * 16 + 6, 16 + 10 * 8 + 3)).toBe(hex9(((sc.fallback << 1) | ((sc.fallback & 3) !== 0 ? 1 : 0)) & 0x1ff));
    // --- the program disabling the tilemap ends stencil mode: the ULA paper shows
    s.setLayerDebug({ hide: ["l2", "spr"] });
    apply(s, { ...cfg, tmEn: false }).runFrames(2);
    expect(mismatches(s, sc, { ...cfg, tmEn: false, hidden: 4 | 8 })).toEqual([]);
  });

  it("T4: a hidden tile keeps its 'below' bit, which places the ULA in the blend modes", async () => {
    const sc = makeScene(502);
    const s = await sceneSession(sc);
    const bad: string[] = [];
    for (const order of [6, 7]) {
      for (const blend of [1, 3]) {
        const cfg: Config = { order, blend, stencil: false, ulaEn: true, tmEn: true, tmOnTop: false, spritesEn: true, lores: false };
        s.setLayerDebug({ hide: ["tm"] });
        apply(s, cfg).runFrames(2);
        bad.push(...mismatches(s, sc, { ...cfg, hidden: 2 }).map((m) => `${describeConfig(cfg)}: ${m}`));
      }
    }
    expect(bad).toEqual([]);
  });

  it("T1: sprite collision and 'too many sprites' ($303B) are the same with sprites hidden", async () => {
    const s = await parkedSession();
    // --- pattern 0 all opaque; 128 sprites on line 100, 4 pixels apart: overlaps and too many per line
    s.setNextReg(0x4b, 0xe3).out(0x303b, 0x00);
    for (let i = 0; i < 256; i++) s.out(0x5b, 0x1c);
    s.out(0x303b, 0x00);
    for (let n = 0; n < 128; n++) for (const b of [(n * 2) & 0xff, 100, 0, 0xc0, 0x00]) s.out(0x57, b);
    s.setNextReg(0x15, 0x03).runFrames(2);
    const shown = s.in(0x303b);
    expect(shown & 0x03).toBe(0x03);
    s.setLayerDebug({ hide: ["spr"] }).runFrames(2);
    expect(s.in(0x303b)).toBe(shown);
    // --- and the sprites are gone from the picture: the row is the one with sprites disabled
    const hiddenRow = s.rowRuns(48 + 100 + 4);
    s.setLayerDebug().setNextReg(0x15, 0x02).runFrames(2);
    expect(s.rowRuns(48 + 100 + 4)).toEqual(hiddenRow);
    s.in(0x303b);
    s.setNextReg(0x15, 0x03).runFrames(2);
    expect(s.in(0x303b)).toBe(shown);
    s.setLayerDebug({ solo: "spr" }).runFrames(2);
    expect(s.in(0x303b)).toBe(shown);
  });

  it("solo shows one layer over a checker; 'show transparency' paints the uncovered pixels magenta", async () => {
    const sc = makeScene(503);
    const s = await sceneSession(sc);
    apply(s, { order: 0, blend: 0, stencil: false, ulaEn: true, tmEn: true, tmOnTop: false, spritesEn: true, lores: false });
    s.setLayerDebug({ solo: "tm" }).runFrames(2);
    const checker = new Set(["#494949", "#6D6D6D"]);
    const bad: string[] = [];
    for (let cy = 0; cy < 32; cy++) {
      for (let cx = 0; cx < 40; cx++) {
        const ci = cy * 40 + cx;
        const got = s.pixel(32 + cx * 16 + 6, 16 + cy * 8 + 3);
        const tile = sc.tile[ci];
        if (tile === 15) {
          if (!checker.has(got)) bad.push(`transparent tile (${cx},${cy}): ${got}`);
        } else {
          const want = hex9(sc.tmPal[(sc.tileAttr[ci] & 0xf0) | tile]);
          if (got !== want) bad.push(`tile (${cx},${cy}): ${got} != ${want}`);
        }
        if (bad.length > 4) break;
      }
    }
    expect(bad).toEqual([]);
    // --- the transparent tiles in magenta instead
    s.setLayerDebug({ solo: "tm", showTransparent: true }).runFrames(2);
    const t = sc.tile.findIndex((v) => v === 15);
    expect(s.pixel(32 + (t % 40) * 16 + 6, 16 + Math.floor(t / 40) * 8 + 3)).toBe("#FF00FF");
  });

  it("'show transparency' without solo marks only where every layer is transparent", async () => {
    const s = await parkedSession();
    // --- only the ULA, every ULA colour transparent ($14 = $E3, paper 0 / border 0 = entry 16 = $E3)
    s.setNextReg(0x43, 0x00).setNextReg(0x40, 16).setNextReg(0x41, 0xe3).setNextReg(0x14, 0xe3);
    s.poke(0x4000, new Array(0x1800).fill(0)).poke(0x5800, new Array(768).fill(0x00)).out(0xfe, 0);
    s.setNextReg(0x4a, 0x03).runFrames(2);
    expect(s.pixel(200, 100)).toBe("#0000FF");
    s.setLayerDebug({ showTransparent: true }).runFrames(2);
    expect(s.pixel(200, 100)).toBe("#FF00FF");
    // --- hiding the ULA takes the fast path's place (T9): the fallback, or magenta
    s.setLayerDebug({ hide: ["ula"] }).setNextReg(0x14, 0x00).runFrames(2);
    expect(s.pixel(200, 100)).toBe("#0000FF");
    s.setLayerDebug().runFrames(2);
    expect(s.pixel(200, 100)).not.toBe("#0000FF");
  });

  it("the mask is not machine state: a reset keeps it, a program cannot see it, the registers stay", async () => {
    const sc = makeScene(504);
    const s = await sceneSession(sc);
    const before = [0x15, 0x68, 0x6b, 0x14, 0x4a].map((r) => s.nextRegValue(r));
    s.setLayerDebug({ hide: ["ula", "spr"], showTransparent: true }).runFrames(1);
    expect([0x15, 0x68, 0x6b, 0x14, 0x4a].map((r) => s.nextRegValue(r))).toEqual(before);
    expect(s.layerDebug()).toEqual({ hidden: 9, solo: 0, showTransparent: true });
    s.reset();
    expect(s.layerDebug()).toEqual({ hidden: 9, solo: 0, showTransparent: true });
    s.hardReset();
    expect(s.layerDebug()).toEqual({ hidden: 9, solo: 0, showTransparent: true });
  });

  it("a paused recompose (no capture) equals the live picture of the same mask on a still scene", async () => {
    const sc = makeScene(505);
    const s = await sceneSession(sc);
    apply(s, { order: 3, blend: 0, stencil: false, ulaEn: true, tmEn: true, tmOnTop: false, spritesEn: true, lores: false });
    s.runFrames(2);
    const plain = s.recomposeLayers();
    expect(plain.status.captured).toBe(false);
    expect(plain.status.exact).toBe(false);
    expect(frameDiff(plain.frame, s.machinePicture())).toEqual([]);
    s.setLayerDebug({ hide: ["l2"] });
    const recomposed = s.recomposeLayers().frame;
    // --- the recompose never touched the machine's picture
    expect(frameDiff(s.machinePicture(), plain.frame)).toEqual([]);
    s.runFrames(2);
    expect(frameDiff(recomposed, s.machinePicture())).toEqual([]);
  });
});
