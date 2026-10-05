import { describe, expect, it } from "vitest";

import { createSp48Session } from "../harness/sp48";
import { createTimexSession } from "../harness/timex";
import { TIMEX_MODELS_INFO } from "@emu/machines/timex/timexModels";
import { displayFileAddress } from "./_timex-helpers";

/*
 * The SCLD's ports, its interrupt and its timing on the TC2048 (`.plans/TIMEX_SCORPION_PLAN.md` §8).
 * Timing is checked the way G9.1 checked the Pentagon: against a machine with known results (the 48K
 * core), since the TC2048 keeps the 48K's raster.
 */

describe("TC2048 port $FF", () => {
  it("reads back the last value written", async () => {
    const s = await createTimexSession();
    s.bootToBasic();
    for (const value of [0x00, 0x06, 0x3e, 0x41, 0x80, 0xff]) {
      s.out(0x00ff, value);
      expect(s.in(0x00ff)).toBe(value);
      expect(s.portFf).toBe(value);
    }
  });

  it("decodes the full low byte: the high byte does not matter, other low bytes do not reach it", async () => {
    const s = await createTimexSession();
    s.bootToBasic();
    s.out(0x7fff, 0x02);
    expect(s.portFf).toBe(0x02);
    s.out(0x00fd, 0x06).out(0x00fb, 0x06).out(0x00fe, 0x06);
    expect(s.portFf).toBe(0x02);
  });

  it("is cleared by a reset", async () => {
    const s = await createTimexSession();
    s.bootToBasic();
    s.out(0x00ff, 0x46);
    s.machine.reset();
    expect(s.portFf).toBe(0);
  });

  it("bit 6 holds off the frame interrupt; clearing it lets the ROM count frames again", async () => {
    const s = await createTimexSession();
    s.bootToBasic();
    const frames = () => s.peek(23672) | (s.peek(23673) << 8);
    s.runFrames(5);
    const counting = frames();
    s.runFrames(10);
    expect(frames() - counting).toBe(10);

    s.out(0x00ff, 0x40);
    const raised = s.exports.sp48GetInterruptsRaised();
    const held = frames();
    s.runFrames(10);
    expect(frames()).toBe(held);
    expect(s.exports.sp48GetInterruptsRaised()).toBe(raised);

    s.out(0x00ff, 0x00);
    s.runFrames(10);
    expect(frames() - held).toBe(10);
  });
});

describe("TC2048 Kempston joystick", () => {
  it("joystick 1's pins read on port $1F, active high, bits 0-4", async () => {
    const s = await createTimexSession();
    s.bootToBasic();
    expect(s.in(0x001f)).toBe(0x00);
    // --- Right, left, down, up, fire 1 (B) are the connector's bits 0-4, the Kempston's order
    s.timex.setJoystickState("left", 0x01 | 0x08 | 0x10);
    expect(s.in(0x001f)).toBe(0x19);
    // --- Pins above fire 1 do not reach the port; the second connector does not exist
    s.timex.setJoystickState("left", 0xfe0);
    expect(s.in(0x001f)).toBe(0x00);
    s.timex.setJoystickState("right", 0x1f);
    expect(s.in(0x001f)).toBe(0x00);
  });

  it("answers any port with A0 set and A5 clear (Kempston decoding), not one with A5 set", async () => {
    const s = await createTimexSession();
    s.bootToBasic();
    s.timex.setJoystickState("left", 0x04);
    expect(s.in(0x00df)).toBe(0x04);
    expect(s.in(0xff1f)).toBe(0x04);
    s.machine.setTacts(s.machine.tacts - s.machine.currentFrameTact + 100); // --- top border: no fetch
    expect(s.in(0x003f)).toBe(0xff);
  });
});

describe("TC2048 frame and contention", () => {
  it("runs the model's clock and frame (timexModels.ts = timex.c)", async () => {
    const s = await createTimexSession();
    const model = TIMEX_MODELS_INFO.tc2048;
    expect(s.exports.timexGetModel()).toBe(model.coreModel);
    expect(s.exports.sp48GetBaseClockFrequency()).toBe(model.clockHz);
    expect(s.timex.baseClockFrequency).toBe(model.clockHz);
    expect(s.exports.sp48GetTactsInFrame()).toBe(model.tactsPerFrame);
    expect(s.exports.sp48GetScreenLineTime()).toBe(model.tactsPerLine);
    expect(s.exports.sp48GetRasterLines()).toBe(model.linesPerFrame);
    expect(s.exports.timexGetHiresBright() !== 0).toBe(model.hiresBright);
  });

  it("contends memory on the 48K's pattern, tact for tact", async () => {
    const t = await createTimexSession();
    const z = await createSp48Session();
    const tacts = t.exports.sp48GetTactsInFrame();
    const differ: number[] = [];
    for (let tact = 0; tact < tacts; tact++) {
      if (t.exports.sp48GetContentionValue(tact) !== z.machine.wasmV2Runtime!.exports.sp48GetContentionValue(tact)) {
        differ.push(tact);
      }
    }
    expect(differ).toEqual([]);
    expect(t.exports.sp48GetContentionValue(14335)).toBe(6);
  });

  it("measures the same contended loop as the 48K", async () => {
    const program = `
          .org $8000
      Main:
          ei
          halt
          di
          ld hl,$4000
          ld b,0
      Loop:
          ld a,(hl)         ; a contended read every iteration, across the paper
          inc hl
          djnz Loop
          ret
    `;
    const t = await createTimexSession();
    const z = await createSp48Session();
    const measure = async (s: typeof t | typeof z) => {
      s.bootToBasic();
      await s.loadCode(program);
      s.call("Main", { maxFrames: 3 });
      return s.machine.totalContentionDelaySinceStart;
    };
    expect(await measure(t)).toBe(await measure(z));
  });

  it("puts the SCLD's fetch on the floating bus, from the display file the mode selects", async () => {
    const s = await createTimexSession();
    s.bootToBasic();
    s.machine.iff1 = false;
    // --- Paper line 0 starts at frame tact 14336; the bus shows a byte fetched 5 T before the read
    s.poke(displayFileAddress(0, 0), 0xa5).poke(displayFileAddress(0, 0) + 0x2000, 0x5a);
    const at = (frameTact: number) => {
      s.machine.setTacts(s.machine.tacts - s.machine.currentFrameTact + frameTact);
      return s.exports.sp48ReadFloatingBus();
    };
    const fetchTact = (() => {
      for (let tact = 14000; tact < 14400; tact++) if (s.exports.sp48GetRenderingPixelAddress(tact) === 0 && s.exports.sp48GetRenderingPhase(tact) === 2) return tact;
      return -1;
    })();
    expect(fetchTact).toBeGreaterThan(0);
    s.out(0x00ff, 0);
    expect(at(fetchTact + 5)).toBe(0xa5);
    s.out(0x00ff, 1);
    expect(at(fetchTact + 5)).toBe(0x5a);
  });
});
