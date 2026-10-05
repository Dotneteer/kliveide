import { describe, expect, it } from "vitest";

import { TIMEX_MODELS_INFO, type TimexModelId } from "@emu/machines/timex/timexModels";
import { createTimexSession, SPECTRUM_COLORS, type TimexTestSession } from "../harness/timex";
import { displayFileAddress } from "./_timex-helpers";

/*
 * The 2068s' AY and joysticks, and each model's frame (`.plans/TIMEX_SCORPION_PLAN.md` G9.4b, §8).
 * TS2068 Technical Manual: the AY's register select on $F5, its data on $F6 (2.1.6, 2.1.13.4), its
 * clock 14.112 MHz / 8 = CPU / 2 (2.1.6); the joysticks on the AY's port A, read as register 14 from
 * $F6 with A8 (player 1) or A9 (player 2) high, low active: bit 0 up, 1 down, 2 left, 3 right, 7 the
 * button (2.1.7, 4.3).
 */

async function boot(model: TimexModelId): Promise<TimexTestSession> {
  const s = await createTimexSession({ model });
  s.bootToBasic();
  return s;
}

const ay = (s: TimexTestSession, reg: number, value: number) => s.out(0x00f5, reg).out(0x00f6, value);

describe("2068 AY on ports $F5/$F6", () => {
  it("writes and reads back the registers", async () => {
    const s = await boot("ts2068");
    ay(s, 0, 0x34);
    ay(s, 1, 0x02);
    ay(s, 8, 0x0f);
    s.out(0x00f5, 1);
    expect(s.in(0x00f6)).toBe(0x02);
    s.out(0x00f5, 0);
    expect(s.in(0x00f6)).toBe(0x34);
    expect(s.exports.timexGetPsgToneA()).toBe(0x234);
    expect(s.exports.timexGetPsgVolumeA()).toBe(0x0f);
  });

  it("the TC2048 has no AY: $F5/$F6 do nothing", async () => {
    const s = await boot("tc2048");
    ay(s, 0, 0x34);
    expect(s.exports.timexGetPsgRegisterValue(0)).toBe(0);
    expect(s.exports.timexGetHasAy()).toBe(0);
  });

  for (const model of ["ts2068", "tc2068"] as const) {
    it(`${model}: a tone of period 100 sounds at CPU / 32 / 100 (the AY clocked at CPU / 2)`, async () => {
      const s = await boot(model);
      s.machine.iff1 = false;
      ay(s, 0, 100);
      ay(s, 1, 0);
      ay(s, 7, 0x3e); // --- tone A only, noise off, port A input
      ay(s, 8, 0x0f);
      const samples: number[] = [];
      for (let f = 0; f < 60; f++) {
        s.runFrames(1);
        for (const sample of s.machine.getAudioSamples()) samples.push(sample.left);
      }
      // --- Rising edges of the (DC-filtered) square wave, over the frames' real time
      let edges = 0;
      for (let i = 1; i < samples.length; i++) if (samples[i - 1] < 0 && samples[i] >= 0) edges++;
      const seconds = (60 * TIMEX_MODELS_INFO[model].tactsPerFrame) / TIMEX_MODELS_INFO[model].clockHz;
      const expected = TIMEX_MODELS_INFO[model].clockHz / 32 / 100; // --- 1102.5 Hz
      expect(edges / seconds).toBeGreaterThan(expected * 0.97);
      expect(edges / seconds).toBeLessThan(expected * 1.03);
    });
  }
});

describe("2068 joysticks through AY register 14", () => {
  const read = (s: TimexTestSession, port: number) => s.out(0x00f5, 14).in(port);

  it("reads player 1 with A8 high and player 2 with A9 high, low active", async () => {
    const s = await boot("ts2068");
    expect(read(s, 0x01f6)).toBe(0xff);
    // --- Klive's pins: right 1, left 2, down 4, up 8, fire 16
    s.timex.setJoystickState("left", 0x08 | 0x10); // --- up + fire
    s.timex.setJoystickState("right", 0x01 | 0x04); // --- right + down
    expect(read(s, 0x01f6)).toBe(0xff & ~0x01 & ~0x80);
    expect(read(s, 0x02f6)).toBe(0xff & ~0x08 & ~0x02);
    // --- Both strobes: both sticks pull the lines low
    expect(read(s, 0x03f6)).toBe(0xff & ~0x01 & ~0x80 & ~0x08 & ~0x02);
    // --- Neither strobe: nothing
    expect(read(s, 0x00f6)).toBe(0xff);
    // --- Left (2) maps to bit 2
    s.timex.setJoystickState("left", 0x02);
    expect(read(s, 0x01f6)).toBe(0xff & ~0x04);
  });

  it("with port A an output (R7 bit 6) register 14 reads the latched value, not the sticks", async () => {
    const s = await boot("ts2068");
    s.timex.setJoystickState("left", 0x1f);
    ay(s, 7, 0x40);
    ay(s, 14, 0x5a);
    expect(read(s, 0x01f6)).toBe(0x5a);
  });
});

describe("2068 models' frames", () => {
  for (const model of ["tc2068", "ts2068"] as const) {
    it(`${model}: the model table equals the core`, async () => {
      const s = await createTimexSession({ model });
      const info = TIMEX_MODELS_INFO[model];
      expect(s.exports.timexGetModel()).toBe(info.coreModel);
      expect(s.exports.sp48GetBaseClockFrequency()).toBe(info.clockHz);
      expect(s.exports.sp48GetTactsInFrame()).toBe(info.tactsPerFrame);
      expect(s.exports.sp48GetScreenLineTime()).toBe(info.tactsPerLine);
      expect(s.exports.sp48GetRasterLines()).toBe(info.linesPerFrame);
      expect(s.exports.timexGetHiresBright() !== 0).toBe(info.hiresBright);
    });
  }

  it("the TS2068's 64-column colours are not BRIGHT (its manual), the TC2068's are", async () => {
    for (const [model, bright] of [["ts2068", false], ["tc2068", true]] as const) {
      const s = await boot(model);
      s.machine.iff1 = false;
      s.poke(0x4000, new Array(0x1800).fill(0)).poke(displayFileAddress(0, 0), 0xff);
      s.out(0x00ff, 6 | (1 << 3)).renderNow();
      expect(s.paperPixel(0, 0), model).toBe(SPECTRUM_COLORS[1 + (bright ? 8 : 0)]);
      expect(s.paperPixel(16, 0), model).toBe(SPECTRUM_COLORS[6 + (bright ? 8 : 0)]);
    }
  });

  it("the TS2068 runs 60 frames a second: the ROM counts one FRAMES per interrupt", async () => {
    const s = await boot("ts2068");
    const frames = () => s.peek(23672) | (s.peek(23673) << 8);
    s.runFrames(1); // --- boot stops mid-frame; start counting at a frame boundary
    const before = frames();
    s.runFrames(60);
    expect(frames() - before).toBe(60);
    expect(TIMEX_MODELS_INFO.ts2068.clockHz / TIMEX_MODELS_INFO.ts2068.tactsPerFrame).toBeCloseTo(60.11, 1);
  });
});
