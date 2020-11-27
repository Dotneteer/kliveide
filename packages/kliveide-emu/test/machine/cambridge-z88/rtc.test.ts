import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import * as path from "path";
import { MachineApi } from "../../../src/native/api/api";
import { importObject } from "../../import-object";
import {
  CambridgeZ88,
  IntFlags,
  TmkFlags,
  TstaFlags,
} from "../../../src/renderer/machines/CambridgeZ88";

const buffer = fs.readFileSync(
  path.join(__dirname, "../../../build/cz88.wasm")
);
let api: MachineApi;
let machine: CambridgeZ88;

describe("Cambridge Z88 - RTC", function () {
  this.timeout(10_000);

  before(async () => {
    const wasm = await WebAssembly.instantiate(buffer, importObject);
    api = (wasm.instance.exports as unknown) as MachineApi;
    machine = new CambridgeZ88(api);
  });

  beforeEach(() => {
    machine.reset();
  });

  it("blink reset", () => {
    machine.reset();

    const s = machine.getMachineState();

    expect(s.INT).toBe(0);
    expect(s.STA).toBe(0);
    expect(s.COM).toBe(0);

    expect(s.TIM0).toBe(0x98);
    expect(s.TIM1).toBe(0);
    expect(s.TIM2).toBe(0);
    expect(s.TIM3).toBe(0);
    expect(s.TIM4).toBe(0);
    expect(s.TSTA).toBe(0);
    expect(s.TMK).toBe(0);

    expect(s.PB0).toBe(0);
    expect(s.PB1).toBe(0);
    expect(s.PB2).toBe(0);
    expect(s.PB3).toBe(0);
    expect(s.SBR).toBe(0);
    expect(s.SCW).toBe(0xff);
    expect(s.SCH).toBe(0xff);
  });

  const tickSamples = [
    // 1 tick
    {
      tick: 1,
      int: 0,
      tmk: 0,
      tim0: 0x99,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 1,
      int: 0,
      tmk: TmkFlags.BM_TMKTICK,
      tim0: 0x99,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 1,
      int: IntFlags.BM_INTTIME,
      tmk: 0,
      tim0: 0x99,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 1,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK,
      tim0: 0x99,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTATICK,
    },
    // 2 ticks
    {
      tick: 2,
      int: 0,
      tmk: 0,
      tim0: 0x9a,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 2,
      int: 0,
      tmk: TmkFlags.BM_TMKTICK,
      tim0: 0x9a,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 2,
      int: IntFlags.BM_INTTIME,
      tmk: 0,
      tim0: 0x9a,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 2,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK,
      tim0: 0x9a,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTATICK,
    },
    // 48 ticks
    {
      tick: 48,
      int: 0,
      tmk: 0,
      tim0: 0x00,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 48,
      int: 0,
      tmk: TmkFlags.BM_TMKTICK,
      tim0: 0x00,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 48,
      int: IntFlags.BM_INTTIME,
      tmk: 0,
      tim0: 0x00,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 48,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK,
      tim0: 0x00,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTATICK,
    },
    // 49 ticks
    {
      tick: 49,
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
      tick: 49,
      int: 0,
      tmk: TmkFlags.BM_TMKTICK,
      tim0: 0x01,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 49,
      int: IntFlags.BM_INTTIME,
      tmk: 0,
      tim0: 0x01,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 49,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK,
      tim0: 0x01,
      tim1: 0x00,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTATICK,
    },
    // 49 + 127 (176) ticks
    {
      tick: 176,
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
      tick: 176,
      int: 0,
      tmk: TmkFlags.BM_TMKTICK,
      tim0: 0x80,
      tim1: 0x01,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 176,
      int: IntFlags.BM_INTTIME,
      tmk: 0,
      tim0: 0x80,
      tim1: 0x01,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 176,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK,
      tim0: 0x80,
      tim1: 0x01,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTATICK,
    },
    {
      tick: 176,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK | TmkFlags.BM_TMKSEC,
      tim0: 0x80,
      tim1: 0x01,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTATICK | TstaFlags.BM_TSTASEC,
    },
    // 49 + 128 (177) ticks
    {
      tick: 177,
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
      tick: 177,
      int: 0,
      tmk: TmkFlags.BM_TMKTICK,
      tim0: 0x81,
      tim1: 0x01,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 177,
      int: IntFlags.BM_INTTIME,
      tmk: 0,
      tim0: 0x81,
      tim1: 0x01,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 177,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK,
      tim0: 0x81,
      tim1: 0x01,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTATICK,
    },
    {
      tick: 177,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK | TmkFlags.BM_TMKSEC,
      tim0: 0x81,
      tim1: 0x01,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTATICK | TstaFlags.BM_TSTASEC,
    },
    // 49 + 128 + 58 * 200 (11776) ticks
    {
      tick: 11776,
      int: 0,
      tmk: 0,
      tim0: 0x80,
      tim1: 59,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 11776,
      int: 0,
      tmk: TmkFlags.BM_TMKTICK,
      tim0: 0x80,
      tim1: 59,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 11776,
      int: IntFlags.BM_INTTIME,
      tmk: 0,
      tim0: 0x80,
      tim1: 59,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 11776,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK,
      tim0: 0x80,
      tim1: 59,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTATICK,
    },
    {
      tick: 11776,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK | TmkFlags.BM_TMKSEC,
      tim0: 0x80,
      tim1: 59,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTATICK | TstaFlags.BM_TSTASEC,
    },
    {
      tick: 11776,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKSEC,
      tim0: 0x80,
      tim1: 59,
      tim2: 0x00,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTASEC,
    },
    // 49 + 128 + 59 * 200 (11976) ticks
    {
      tick: 11976,
      int: 0,
      tmk: 0,
      tim0: 0x80,
      tim1: 0x00,
      tim2: 0x01,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 11976,
      int: 0,
      tmk: TmkFlags.BM_TMKTICK,
      tim0: 0x80,
      tim1: 0x00,
      tim2: 0x01,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 11976,
      int: IntFlags.BM_INTTIME,
      tmk: 0,
      tim0: 0x80,
      tim1: 0x00,
      tim2: 0x01,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 11976,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK,
      tim0: 0x80,
      tim1: 0x00,
      tim2: 0x01,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTATICK,
    },
    {
      tick: 11976,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK | TmkFlags.BM_TMKSEC,
      tim0: 0x80,
      tim1: 0x00,
      tim2: 0x01,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTATICK | TstaFlags.BM_TSTASEC,
    },
    {
      tick: 11976,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK | TmkFlags.BM_TMKSEC | TmkFlags.BM_TMKMIN,
      tim0: 0x80,
      tim1: 0x00,
      tim2: 0x01,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTATICK | TstaFlags.BM_TSTASEC | TmkFlags.BM_TMKMIN,
    },
    {
      tick: 11976,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKSEC | TmkFlags.BM_TMKMIN,
      tim0: 0x80,
      tim1: 0x00,
      tim2: 0x01,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTASEC | TmkFlags.BM_TMKMIN,
    },
    {
      tick: 11976,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK | TmkFlags.BM_TMKMIN,
      tim0: 0x80,
      tim1: 0x00,
      tim2: 0x01,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTATICK | TmkFlags.BM_TMKMIN,
    },
    // 49 + 128 + 59 * 200 + 250 * 60 * 200 (3_011_976) ticks
    {
      tick: 3011976,
      int: 0,
      tmk: 0,
      tim0: 0x80,
      tim1: 0x00,
      tim2: 251,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 3011976,
      int: 0,
      tmk: TmkFlags.BM_TMKTICK,
      tim0: 0x80,
      tim1: 0x00,
      tim2: 251,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 3011976,
      int: IntFlags.BM_INTTIME,
      tmk: 0,
      tim0: 0x80,
      tim1: 0x00,
      tim2: 251,
      tim3: 0x00,
      tim4: 0x00,
      tsta: 0x00,
    },
    {
      tick: 3011976,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK,
      tim0: 0x80,
      tim1: 0x00,
      tim2: 251,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTATICK,
    },
    {
      tick: 3011976,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK | TmkFlags.BM_TMKSEC,
      tim0: 0x80,
      tim1: 0x00,
      tim2: 251,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTATICK | TstaFlags.BM_TSTASEC,
    },
    {
      tick: 3011976,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK | TmkFlags.BM_TMKSEC | TmkFlags.BM_TMKMIN,
      tim0: 0x80,
      tim1: 0x00,
      tim2: 251,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTATICK | TstaFlags.BM_TSTASEC | TmkFlags.BM_TMKMIN,
    },
    {
      tick: 3011976,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKSEC | TmkFlags.BM_TMKMIN,
      tim0: 0x80,
      tim1: 0x00,
      tim2: 251,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTASEC | TmkFlags.BM_TMKMIN,
    },
    {
      tick: 3011976,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK | TmkFlags.BM_TMKMIN,
      tim0: 0x80,
      tim1: 0x00,
      tim2: 251,
      tim3: 0x00,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTATICK | TmkFlags.BM_TMKMIN,
    },
    // 48 + 128 + 59 * 200 + (250 + 4*256) * 60 * 200 (15_299_976) ticks
    {
      tick: 15_299_976,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK | TmkFlags.BM_TMKSEC | TmkFlags.BM_TMKMIN,
      tim0: 0x80,
      tim1: 0x00,
      tim2: 251,
      tim3: 4,
      tim4: 0x00,
      tsta: TstaFlags.BM_TSTATICK | TstaFlags.BM_TSTASEC | TmkFlags.BM_TMKMIN,
    },
    // 48 + 128 + 59 * 200 + (250 + 257*256) * 60 * 200 (792_515_976) ticks
    {
      tick: 792_515_976,
      int: IntFlags.BM_INTTIME,
      tmk: TmkFlags.BM_TMKTICK | TmkFlags.BM_TMKSEC | TmkFlags.BM_TMKMIN,
      tim0: 0x80,
      tim1: 0x00,
      tim2: 251,
      tim3: 1,
      tim4: 1,
      tsta: TstaFlags.BM_TSTATICK | TstaFlags.BM_TSTASEC | TmkFlags.BM_TMKMIN,
    },
  ];

  tickSamples.forEach((smp) => {
    it(`tick ${smp.tick}/${smp.int}/${smp.tmk}`, () => {
      machine.api.testSetZ88TMK(smp.tmk);
      machine.api.testSetZ88INT(smp.int);
      machine.api.testIncZ88Rtc(smp.tick);

      const s = machine.getMachineState();

      expect(s.TIM0).toBe(smp.tim0);
      expect(s.TIM1).toBe(smp.tim1);
      expect(s.TIM2).toBe(smp.tim2);
      expect(s.TIM3).toBe(smp.tim3);
      expect(s.TIM4).toBe(smp.tim4);
      expect(s.TSTA).toBe(smp.tsta);
    });
  });

  it("RTC reset requested", () => {
    machine.api.testIncZ88Rtc(100);
    machine.api.testSetZ88COM(0x10);
    machine.api.testIncZ88Rtc(1);

    const s = machine.getMachineState();

    expect(s.INT).toBe(0);
    expect(s.STA).toBe(0);
    expect(s.COM).toBe(0x10);

    expect(s.TIM0).toBe(0x98);
    expect(s.TIM1).toBe(0);
    expect(s.TIM2).toBe(0);
    expect(s.TIM3).toBe(0);
    expect(s.TIM4).toBe(0);
    expect(s.TSTA).toBe(0);
  });
});
