import "mocha";
import { expect } from "expect";
import { Z88TestMachine } from "./Z88TestMachine";
import { INTFlags, TMKFlags, TSTAFlags } from "@emu/machines/z88/IZ88BlinkDevice";
import { IZ88BlinkTestDevice } from "@emu/machines/z88/IZ88BlinkTestDevice";

describe("Z88 - RTC", function () {
  this.timeout(10_000);

  it("blink reset", () => {
    const m = new Z88TestMachine();
    const b = m.blinkDevice;

    expect(b.INT).toBe(0x23);
    expect(b.STA).toBe(0);
    expect(b.COM).toBe(0);

    expect(b.TIM0).toBe(0);
    expect(b.TIM1).toBe(0);
    expect(b.TIM2).toBe(0);
    expect(b.TIM3).toBe(0);
    expect(b.TIM4).toBe(0);
    expect(b.TSTA).toBe(0);
    expect(b.TMK).toBe(0x01);
  });

  const tickSamples = [
    // 1 tick
    {
      tick: 1,
      int: 0,
      tmk: 0,
      tim0: 0x01,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 1,
      int: 0,
      tmk: TMKFlags.TICK,
      tim0: 0x01,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 1,
      int: INTFlags.TIME,
      tmk: 0,
      tim0: 0x01,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 1,
      int: INTFlags.TIME | INTFlags.GINT,
      tmk: TMKFlags.TICK,
      tim0: 0x01,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TSTAFlags.TICK,
    },
    // 2 ticks
    {
      tick: 2,
      int: 0,
      tmk: 0,
      tim0: 0x02,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 2,
      int: 0,
      tmk: TMKFlags.TICK,
      tim0: 0x02,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 2,
      int: INTFlags.TIME | INTFlags.GINT,
      tmk: 0,
      tim0: 0x02,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 2,
      int: INTFlags.TIME | INTFlags.GINT,
      tmk: TMKFlags.TICK,
      tim0: 0x02,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TSTAFlags.TICK,
    },
    // 3 ticks
    {
      tick: 3,
      int: INTFlags.TIME | INTFlags.GINT,
      tmk: TMKFlags.TICK,
      tim0: 0x03,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TSTAFlags.TICK,
    },
    // 128 ticks
    {
      tick: 128,
      int: 0,
      tmk: 0,
      tim0: 0x80,
      tim1: 0x01,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 128,
      int: 0,
      tmk: TMKFlags.TICK,
      tim0: 0x80,
      tim1: 0x01,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 128,
      int: INTFlags.TIME | INTFlags.GINT,
      tmk: 0,
      tim0: 0x80,
      tim1: 0x01,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 128,
      int: INTFlags.TIME | INTFlags.GINT,
      tmk: TMKFlags.TICK,
      tim0: 0x80,
      tim1: 0x01,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TSTAFlags.SEC,
    },
    {
      tick: 128,
      int: INTFlags.TIME | INTFlags.GINT,
      tmk: TMKFlags.TICK | TMKFlags.SEC,
      tim0: 0x80,
      tim1: 0x01,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TSTAFlags.SEC,
    },
    // 129 ticks
    {
      tick: 129,
      int: 0,
      tmk: 0,
      tim0: 0x81,
      tim1: 0x01,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 129,
      int: 0,
      tmk: TMKFlags.TICK,
      tim0: 0x81,
      tim1: 0x01,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 129,
      int: INTFlags.TIME | INTFlags.GINT,
      tmk: 0,
      tim0: 0x81,
      tim1: 0x01,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 129,
      int: INTFlags.TIME | INTFlags.GINT,
      tmk: TMKFlags.TICK,
      tim0: 0x81,
      tim1: 0x01,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TSTAFlags.TICK,
    },
    // 32 * 200 + 128 (6328) ticks
    {
      tick: 6328,
      int: 0,
      tmk: 0,
      tim0: 0x80,
      tim1: 0x20,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 6328,
      int: 0,
      tmk: TMKFlags.TICK,
      tim0: 0x80,
      tim1: 0x20,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 6328,
      int: INTFlags.TIME | INTFlags.GINT,
      tmk: TMKFlags.TICK,
      tim0: 0x80,
      tim1: 0x20,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TSTAFlags.MIN,
    },
    {
      tick: 6328,
      int: INTFlags.TIME | INTFlags.GINT,
      tmk: TMKFlags.TICK | TMKFlags.SEC,
      tim0: 0x80,
      tim1: 0x20,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TSTAFlags.MIN,
    },
    // 32 * 200 + 128 + 250 * 60 * 200 (6328) ticks
    // 49 + 128 + 59 * 200 + 250 * 60 * 200 (3_006_328) ticks
    {
      tick: 3006328,
      int: 0,
      tmk: 0,
      tim0: 0x80,
      tim1: 0x20,
      tim2: 250,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 3006328,
      int: 0,
      tmk: TMKFlags.TICK,
      tim0: 0x80,
      tim1: 0x20,
      tim2: 250,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 3006328,
      int: INTFlags.TIME | INTFlags.GINT,
      tmk: 0,
      tim0: 0x80,
      tim1: 0x20,
      tim2: 250,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 3006328,
      int: INTFlags.TIME | INTFlags.GINT,
      tmk: TMKFlags.TICK,
      tim0: 0x80,
      tim1: 0x20,
      tim2: 250,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TSTAFlags.MIN,
    },
    {
      tick: 3006328,
      int: INTFlags.TIME | INTFlags.GINT,
      tmk: TMKFlags.TICK | TMKFlags.SEC,
      tim0: 0x80,
      tim1: 0x20,
      tim2: 250,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TSTAFlags.MIN,
    },
    {
      tick: 3006328,
      int: INTFlags.TIME | INTFlags.GINT,
      tmk: TMKFlags.TICK | TMKFlags.SEC | TMKFlags.MIN,
      tim0: 0x80,
      tim1: 0x20,
      tim2: 250,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TSTAFlags.MIN,
    },
    {
      tick: 3006329,
      int: INTFlags.TIME | INTFlags.GINT,
      tmk: TMKFlags.TICK | TMKFlags.SEC | TMKFlags.MIN,
      tim0: 0x81,
      tim1: 0x20,
      tim2: 250,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TSTAFlags.TICK,
    },
    {
      tick: 3006329,
      int: INTFlags.TIME | INTFlags.GINT,
      tmk: TMKFlags.SEC | TMKFlags.MIN,
      tim0: 0x81,
      tim1: 0x20,
      tim2: 250,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TSTAFlags.TICK,
    },
  ];

  tickSamples.forEach((smp) => {
    it(`tick ${smp.tick}/${smp.int}/${smp.tmk}`, () => {
      const machine = new Z88TestMachine();  
      const b = machine.blinkDevice;
      const bt = b as unknown as IZ88BlinkTestDevice;
      b.TMK = smp.tmk;
      b.setINT(smp.int);
      incRtc(bt, smp.tick);

      expect(b.TIM0).toBe(smp.tim0);
      expect(b.TIM1).toBe(smp.tim1);
      expect(b.TIM2).toBe(smp.tim2);
      expect(b.TIM3).toBe(smp.tim3);
      expect(b.TIM4).toBe(smp.tim4);
      expect(b.TSTA).toBe(smp.tsta);
    });
  });

  it("RTC reset requested", () => {
    const machine = new Z88TestMachine();  
    const b = machine.blinkDevice;
    const bt = b as unknown as IZ88BlinkTestDevice;
    incRtc(bt, 100);
    b.setCOM(0x10);
    incRtc(bt, 1);

    expect(b.INT).toBe(0x23);
    expect(b.STA).toBe(0x01);
    expect(b.COM).toBe(0x10);

    expect(b.TIM0).toBe(0);
    expect(b.TIM1).toBe(0);
    expect(b.TIM2).toBe(0);
    expect(b.TIM3).toBe(0);
    expect(b.TIM4).toBe(0);
    expect(b.TSTA).toBe(0);
  });
});

function incRtc(blink: IZ88BlinkTestDevice, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    blink.incrementRtc();
  }
}