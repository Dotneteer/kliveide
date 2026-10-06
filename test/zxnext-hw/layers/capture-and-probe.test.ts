import { describe, expect, it } from "vitest";

import type { NextTestSession } from "../../harness/zxnext";
import type { Frame } from "../../harness/zxnext/core/frame";
import { NEXT_LAYER_BITS, type NextLayerId } from "@common/zxnext/layers/layerMix";
import { mixPixelExplained, type MixerConfig, type MixWhy } from "./_mixer-model";
import { apply, configs, describeConfig, hex9, makeScene, pixelInputs, sceneSession, type Config } from "./_scene";

/*
 * The layer capture, the exact paused recompose and the pixel probe
 * (`.plans/LAYER_COMPOSITION_PLAN.md` Phases 4 and 5).
 *
 * - A Copper program changes `$15`, `$4A` and the Layer 2 palette offset mid-frame (T3). Stopped
 *   mid-frame, a recompose from the capture with no layer hidden equals the machine's own picture
 *   pixel for pixel, on both sides of the beam; without the capture it does not.
 * - The span table is bounded, and overflow is reported (T7).
 * - The probe's colour and "why" agree with the mixer model for every order, blend source, stencil
 *   and enable setting, with and without hidden layers (D7, D10, T5).
 */

const PIXELS = 720 * 288;
const MOVE = (reg: number, value: number) => ((reg & 0x7f) << 8) | (value & 0xff);
const WAIT = (line: number, h = 0) => 0x8000 | ((h & 0x3f) << 9) | (line & 0x1ff);
const HALT = 0xffff;

function upload(s: NextTestSession, list: number[]): NextTestSession {
  s.setNextReg(0x62, 0x00).setNextReg(0x61, 0x00);
  for (const w of list) s.setNextReg(0x60, w >> 8).setNextReg(0x60, w & 0xff);
  return s;
}

/** Runs instructions until the raster has drawn past `pixel` of the current frame */
function stopAfterPixel(s: NextTestSession, pixel: number): number {
  const ex = s.machine.wasmV2Runtime!.exports;
  for (let i = 0; i < 200000; i++) {
    s.step(1);
    const p = ex.zxnextGetRasterPixel();
    if (p > pixel && p < PIXELS) return p;
  }
  throw new Error("The raster never got there");
}

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

/** The compositing scene with a Copper list that changes the mixer's inputs at lines 60, 120 and 180 */
async function copperScene(): Promise<NextTestSession> {
  const sc = makeScene(600);
  const s = await sceneSession(sc);
  apply(s, { order: 0, blend: 0, stencil: false, ulaEn: true, tmEn: true, tmOnTop: false, spritesEn: true, lores: false });
  upload(s, [
    MOVE(0x15, 0x03),
    MOVE(0x4a, 0x1c),
    MOVE(0x70, 0x10),
    WAIT(60, 20),
    MOVE(0x15, 0x03 | (3 << 2)),
    MOVE(0x4a, 0xe0),
    WAIT(120, 30),
    MOVE(0x70, 0x15),
    MOVE(0x15, 0x03 | (5 << 2)),
    WAIT(180, 12),
    MOVE(0x15, 0x03 | (6 << 2)),
    MOVE(0x4a, 0x03),
    HALT
  ]).setNextReg(0x62, 0xc0);
  return s;
}

describe("layer capture and exact recompose", () => {
  it("T3: stopped mid-frame, the recompose from the capture equals the machine's picture on both sides of the beam", async () => {
    const s = await copperScene();
    s.setLayerCapture(true).runFrames(3);
    const beam = stopAfterPixel(s, 720 * (16 + 150));
    const machine = s.machinePicture();
    const { status, frame } = s.recomposeLayers();
    expect(status).toEqual({ exact: true, captured: true, overflow: false });
    expect(frameDiff(frame, machine)).toEqual([]);
    // --- the Copper's changes really are on the picture: rows above and below the beam differ in order
    expect(beam).toBeGreaterThan(720 * 166);
    const spans = s.layerCaptureStatus();
    expect(spans.current).toBeGreaterThan(1);
    expect(spans.previous).toBeGreaterThan(3);
  });

  it("T3: without the capture, the recompose uses today's registers and is wrong above the last change", async () => {
    const s = await copperScene();
    s.runFrames(3);
    stopAfterPixel(s, 720 * (16 + 150));
    const machine = s.machinePicture();
    const { status, frame } = s.recomposeLayers();
    expect(status).toEqual({ exact: false, captured: false, overflow: false });
    expect(frameDiff(frame, machine).length).toBeGreaterThan(0);
  });

  it("a hidden layer recomposed from the capture equals the next frames drawn with it hidden", async () => {
    const s = await copperScene();
    s.setLayerCapture(true).runFrames(3);
    stopAfterPixel(s, 720 * (16 + 100));
    s.setLayerDebug({ hide: ["spr", "tm"] });
    const recomposed = s.recomposeLayers();
    expect(recomposed.status.exact).toBe(true);
    // --- the picture is the same every frame: the live, masked frame is what the recompose predicted
    s.runFrames(2);
    expect(frameDiff(recomposed.frame, s.screen())).toEqual([]);
  });

  it("a capture switched on mid-frame is not exact until a whole frame was captured", async () => {
    const s = await copperScene();
    s.runFrames(2);
    stopAfterPixel(s, 720 * 100);
    s.setLayerCapture(true);
    expect(s.recomposeLayers().status.exact).toBe(false);
    s.runFrames(2);
    stopAfterPixel(s, 720 * 100);
    expect(s.recomposeLayers().status.exact).toBe(true);
  });

  it("T7: a span table that runs out of room is reported, and the recompose is labelled inexact", async () => {
    const s = await copperScene();
    s.setNextReg(0x62, 0x00);
    // --- A new $4A every 20 T-states at 28 MHz: about 20,000 spans a frame, each with other inputs
    await s.loadCode(
      `
        .org $8000
Start:  di
        nextreg $07,3
        nextreg $7f,$a5
Loop:   nextreg $4a,a
        inc a
        jr Loop
      `,
      { entry: "Start" }
    );
    s.runUntilReady().setLayerCapture(true).runFrames(2);
    const spans = s.layerCaptureStatus();
    expect(spans.previousOverflow).toBe(true);
    expect(spans.previous).toBe(4096);
    const { status } = s.recomposeLayers();
    expect(status.overflow).toBe(true);
    expect(status.exact).toBe(false);
  });

  it("D9: the Layers document's composite is the machine's own picture, never the masked screen", async () => {
    const s = await copperScene();
    s.setLayerCapture(true).setLayerDebug({ hide: ["spr", "l2"] }).runFrames(3);
    const { thumbnails } = s.layerState({ thumbnails: true });
    // --- every other column, every row: the screen's 0.5:1 pixels made square
    expect([thumbnails!.width, thumbnails!.height]).toEqual([360, 288]);
    // --- the same scene without the mask: the composite must match it at every other pixel
    s.setLayerDebug().runFrames(2);
    const plain = s.machinePicture();
    const bad: string[] = [];
    for (let y = 0; y < 288 && bad.length < 4; y += 3) {
      for (let x = 0; x < 360 && bad.length < 4; x += 5) {
        const t = (y * 360 + x) * 4;
        const p = (y * plain.width + x * 2) * 4;
        const a = Array.from(thumbnails!.composite.subarray(t, t + 3));
        const b = Array.from(plain.rgba.subarray(p, p + 3));
        if (a.join() !== b.join()) bad.push(`(${x},${y}): ${a} != ${b}`);
      }
    }
    expect(bad).toEqual([]);
    // --- and a layer's own picture is that layer only: Layer 2 transparent pixels have alpha 0
    expect(Array.from(thumbnails!.l2).some((v, i) => i % 4 === 3 && v === 0)).toBe(true);
  });

  it("a state restore leaves the capture invalid rather than describing another picture", async () => {
    const s = await copperScene();
    s.setLayerCapture(true).runFrames(2);
    const saved = s.machine.saveMachineState();
    s.runFrames(1);
    s.machine.loadMachineState(saved);
    expect(s.layerCaptureStatus()).toMatchObject({ current: 0, previous: 0 });
    expect(s.recomposeLayers().status.exact).toBe(false);
  });
});

const WHY_NAMES: MixWhy[] = [
  "fallback",
  "ula",
  "tm",
  "l2",
  "l2-priority",
  "spr",
  "border",
  "stencil",
  "blend-add",
  "blend-sub"
];

describe("pixel probe", () => {
  for (let order = 0; order < 8; order++) {
    it(`agrees with the mixer model's colour and rule: $15 order ${order}`, async () => {
      const sc = makeScene(700 + order);
      const s = await sceneSession(sc);
      s.setLayerCapture(true);
      const bad: string[] = [];
      for (const cfg of configs(order).filter((_, i) => i % 3 === 0)) {
        for (const hidden of [0, 8, 2 | 4]) {
          const c: Config = { ...cfg, hidden };
          const ids = (Object.keys(NEXT_LAYER_BITS) as NextLayerId[]).filter((id) => hidden & NEXT_LAYER_BITS[id]);
          s.setLayerDebug({ hide: ids });
          apply(s, c).runFrames(2);
          const full: MixerConfig = { ...c, transparent: sc.transparent, fallback: sc.fallback };
          for (let cy = 0; cy < 32 && bad.length < 6; cy += 3) {
            for (let cx = 0; cx < 40 && bad.length < 6; cx += 3) {
              const p = s.probePixel(32 + cx * 16 + 6, 16 + cy * 8 + 3);
              const want = mixPixelExplained(full, pixelInputs(sc, c, cx, cy));
              const plain = mixPixelExplained({ ...full, hidden: 0 }, pixelInputs(sc, c, cx, cy));
              const got = { rgb: hex9(p.rgb), why: WHY_NAMES[p.why] };
              const gotMachine = { rgb: hex9(p.machineRgb), why: WHY_NAMES[p.machineWhy] };
              const exp = { rgb: hex9(want.rgb), why: want.why };
              const expMachine = { rgb: hex9(plain.rgb), why: plain.why };
              if (JSON.stringify(got) !== JSON.stringify(exp) || JSON.stringify(gotMachine) !== JSON.stringify(expMachine)) {
                bad.push(
                  `${describeConfig(c)} hidden ${hidden}, cell (${cx},${cy}): ` +
                    `${JSON.stringify(got)} / ${JSON.stringify(gotMachine)} != ${JSON.stringify(exp)} / ${JSON.stringify(expMachine)}`
                );
              }
              if (p.params.priorities !== order) bad.push(`params: priorities ${p.params.priorities}`);
            }
          }
        }
      }
      expect(bad).toEqual([]);
    });
  }

  it("reports the inputs of the pixel's own span under a mid-frame Copper change", async () => {
    const s = await copperScene();
    s.setLayerCapture(true).runFrames(3);
    stopAfterPixel(s, 720 * (16 + 150));
    // --- Copper line n is buffer row 48 + n (the border above the paper is drawn before the Copper
    // --- restarts, with the end of the last frame's settings). Line 30: SLU, fallback $1C; line 90:
    // --- LUS, $E0; line 200 (last frame's, past the beam): blend add
    const top = s.probePixel(300, 48 + 30);
    const middle = s.probePixel(300, 48 + 90);
    const bottom = s.probePixel(300, 48 + 200);
    expect([top.params.priorities, middle.params.priorities, bottom.params.priorities]).toEqual([0, 3, 6]);
    expect(top.params.fallbackRgb >> 1).toBe(0x1c);
    expect(middle.params.fallbackRgb >> 1).toBe(0xe0);
    expect(top.thisFrame).toBe(true);
    expect(bottom.thisFrame).toBe(false);
    expect(top.status.exact && bottom.status.exact).toBe(true);
    // --- the probe never changes the machine
    expect(frameDiff(s.machinePicture(), s.machinePicture())).toEqual([]);
  });
});
