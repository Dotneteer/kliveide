// import "mocha";
// import * as expect from "expect";
// import * as fs from "fs";
// import * as path from "path";
// import { MachineApi } from "../../../src/renderer/machines/wa-api";
// import { importObject } from "../../import-object";
// import {
//   CambridgeZ88,
//   IntFlags,
//   TmkFlags,
//   TstaFlags,
// } from "../../../src/renderer/machines/cz88/CambridgeZ88";

// const buffer = fs.readFileSync(
//   path.join(__dirname, "../../../build/cz88.wasm")
// );
// let api: MachineApi;
// let machine: CambridgeZ88;

// describe("Cambridge Z88 - RTC", function () {
//   this.timeout(10_000);

//   before(async () => {
//     const wasm = await WebAssembly.instantiate(buffer, importObject);
//     api = (wasm.instance.exports as unknown) as MachineApi;
//     machine = new CambridgeZ88(api);
//   });

//   beforeEach(() => {
//     machine.reset();
//   });

//   it("blink reset", () => {
//     machine.reset();

//     const s = machine.getMachineState();

//     expect(s.INT).toBe(0x23);
//     expect(s.STA).toBe(0);
//     expect(s.COM).toBe(0);

//     expect(s.TIM0).toBe(0);
//     expect(s.TIM1).toBe(0);
//     expect(s.TIM2).toBe(0);
//     expect(s.TIM3).toBe(0);
//     expect(s.TIM4).toBe(0);
//     expect(s.TSTA).toBe(0);
//     expect(s.TMK).toBe(0x01);

//     expect(s.PB0).toBe(0);
//     expect(s.PB1).toBe(0);
//     expect(s.PB2).toBe(0);
//     expect(s.PB3).toBe(0);
//     expect(s.SBF).toBe(0);
//     expect(s.SCW).toBe(0xff);
//   });

//   const tickSamples = [
//     // 1 tick
//     {
//       tick: 1,
//       int: 0,
//       tmk: 0,
//       tim0: 0x01,
//       tim1: 0x00,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: 0x00,
//     },
//     {
//       tick: 1,
//       int: 0,
//       tmk: TmkFlags.BM_TMKTICK,
//       tim0: 0x01,
//       tim1: 0x00,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: 0x00,
//     },
//     {
//       tick: 1,
//       int: IntFlags.BM_INTTIME,
//       tmk: 0,
//       tim0: 0x01,
//       tim1: 0x00,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: 0x00,
//     },
//     {
//       tick: 1,
//       int: IntFlags.BM_INTTIME | IntFlags.BM_INTGINT,
//       tmk: TmkFlags.BM_TMKTICK,
//       tim0: 0x01,
//       tim1: 0x00,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: TstaFlags.BM_TSTATICK,
//     },
//     // 2 ticks
//     {
//       tick: 2,
//       int: 0,
//       tmk: 0,
//       tim0: 0x02,
//       tim1: 0x00,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: 0x00,
//     },
//     {
//       tick: 2,
//       int: 0,
//       tmk: TmkFlags.BM_TMKTICK,
//       tim0: 0x02,
//       tim1: 0x00,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: 0x00,
//     },
//     {
//       tick: 2,
//       int: IntFlags.BM_INTTIME | IntFlags.BM_INTGINT,
//       tmk: 0,
//       tim0: 0x02,
//       tim1: 0x00,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: 0x00,
//     },
//     {
//       tick: 2,
//       int: IntFlags.BM_INTTIME | IntFlags.BM_INTGINT,
//       tmk: TmkFlags.BM_TMKTICK,
//       tim0: 0x02,
//       tim1: 0x00,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: 0x00,
//     },
//     // 3 ticks
//     {
//       tick: 3,
//       int: IntFlags.BM_INTTIME | IntFlags.BM_INTGINT,
//       tmk: TmkFlags.BM_TMKTICK,
//       tim0: 0x03,
//       tim1: 0x00,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: TstaFlags.BM_TSTATICK,
//     },
//     // 128 ticks
//     {
//       tick: 128,
//       int: 0,
//       tmk: 0,
//       tim0: 0x80,
//       tim1: 0x01,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: 0x00,
//     },
//     {
//       tick: 128,
//       int: 0,
//       tmk: TmkFlags.BM_TMKTICK,
//       tim0: 0x80,
//       tim1: 0x01,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: 0x00,
//     },
//     {
//       tick: 128,
//       int: IntFlags.BM_INTTIME | IntFlags.BM_INTGINT,
//       tmk: 0,
//       tim0: 0x80,
//       tim1: 0x01,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: 0x00,
//     },
//     {
//       tick: 128,
//       int: IntFlags.BM_INTTIME | IntFlags.BM_INTGINT,
//       tmk: TmkFlags.BM_TMKTICK,
//       tim0: 0x80,
//       tim1: 0x01,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: TstaFlags.BM_TSTASEC,
//     },
//     {
//       tick: 128,
//       int: IntFlags.BM_INTTIME | IntFlags.BM_INTGINT,
//       tmk: TmkFlags.BM_TMKTICK | TmkFlags.BM_TMKSEC,
//       tim0: 0x80,
//       tim1: 0x01,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: TstaFlags.BM_TSTASEC,
//     },
//     // 129 ticks
//     {
//       tick: 129,
//       int: 0,
//       tmk: 0,
//       tim0: 0x81,
//       tim1: 0x01,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: 0x00,
//     },
//     {
//       tick: 129,
//       int: 0,
//       tmk: TmkFlags.BM_TMKTICK,
//       tim0: 0x81,
//       tim1: 0x01,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: 0x00,
//     },
//     {
//       tick: 129,
//       int: IntFlags.BM_INTTIME | IntFlags.BM_INTGINT,
//       tmk: 0,
//       tim0: 0x81,
//       tim1: 0x01,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: 0x00,
//     },
//     {
//       tick: 129,
//       int: IntFlags.BM_INTTIME | IntFlags.BM_INTGINT,
//       tmk: TmkFlags.BM_TMKTICK,
//       tim0: 0x81,
//       tim1: 0x01,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: TstaFlags.BM_TSTATICK,
//     },
//     // 32 * 200 + 128 (6328) ticks
//     {
//       tick: 6328,
//       int: 0,
//       tmk: 0,
//       tim0: 0x80,
//       tim1: 0x20,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: 0x00,
//     },
//     {
//       tick: 6328,
//       int: 0,
//       tmk: TmkFlags.BM_TMKTICK,
//       tim0: 0x80,
//       tim1: 0x20,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: 0x00,
//     },
//     {
//       tick: 6328,
//       int: IntFlags.BM_INTTIME | IntFlags.BM_INTGINT,
//       tmk: TmkFlags.BM_TMKTICK,
//       tim0: 0x80,
//       tim1: 0x20,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: TstaFlags.BM_TSTAMIN,
//     },
//     {
//       tick: 6328,
//       int: IntFlags.BM_INTTIME | IntFlags.BM_INTGINT,
//       tmk: TmkFlags.BM_TMKTICK | TmkFlags.BM_TMKSEC,
//       tim0: 0x80,
//       tim1: 0x20,
//       tim2: 0x00,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: TstaFlags.BM_TSTAMIN,
//     },
//     // 32 * 200 + 128 + 250 * 60 * 200 (6328) ticks
//     // 49 + 128 + 59 * 200 + 250 * 60 * 200 (3_006_328) ticks
//     {
//       tick: 3006328,
//       int: 0,
//       tmk: 0,
//       tim0: 0x80,
//       tim1: 0x20,
//       tim2: 250,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: 0x00,
//     },
//     {
//       tick: 3006328,
//       int: 0,
//       tmk: TmkFlags.BM_TMKTICK,
//       tim0: 0x80,
//       tim1: 0x20,
//       tim2: 250,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: 0x00,
//     },
//     {
//       tick: 3006328,
//       int: IntFlags.BM_INTTIME | IntFlags.BM_INTGINT,
//       tmk: 0,
//       tim0: 0x80,
//       tim1: 0x20,
//       tim2: 250,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: 0x00,
//     },
//     {
//       tick: 3006328,
//       int: IntFlags.BM_INTTIME | IntFlags.BM_INTGINT,
//       tmk: TmkFlags.BM_TMKTICK,
//       tim0: 0x80,
//       tim1: 0x20,
//       tim2: 250,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: TstaFlags.BM_TSTAMIN,
//     },
//     {
//       tick: 3006328,
//       int: IntFlags.BM_INTTIME | IntFlags.BM_INTGINT,
//       tmk: TmkFlags.BM_TMKTICK | TmkFlags.BM_TMKSEC,
//       tim0: 0x80,
//       tim1: 0x20,
//       tim2: 250,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: TstaFlags.BM_TSTAMIN,
//     },
//     {
//       tick: 3006328,
//       int: IntFlags.BM_INTTIME | IntFlags.BM_INTGINT,
//       tmk: TmkFlags.BM_TMKTICK | TmkFlags.BM_TMKSEC | TmkFlags.BM_TMKMIN,
//       tim0: 0x80,
//       tim1: 0x20,
//       tim2: 250,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: TstaFlags.BM_TSTAMIN,
//     },
//     {
//       tick: 3006329,
//       int: IntFlags.BM_INTTIME | IntFlags.BM_INTGINT,
//       tmk: TmkFlags.BM_TMKTICK | TmkFlags.BM_TMKSEC | TmkFlags.BM_TMKMIN,
//       tim0: 0x81,
//       tim1: 0x20,
//       tim2: 250,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: TstaFlags.BM_TSTATICK,
//     },
//     {
//       tick: 3006329,
//       int: IntFlags.BM_INTTIME | IntFlags.BM_INTGINT,
//       tmk: TmkFlags.BM_TMKSEC | TmkFlags.BM_TMKMIN,
//       tim0: 0x81,
//       tim1: 0x20,
//       tim2: 250,
//       tim3: 0x00,
//       tim4: 0x00,
//       tsta: TstaFlags.BM_TSTATICK,
//     },
//     // // 48 + 128 + 59 * 200 + (250 + 4*256) * 60 * 200 (15_299_976) ticks
//     // {
//     //   tick: 15_299_976,
//     //   int: IntFlags.BM_INTTIME,
//     //   tmk: TmkFlags.BM_TMKTICK | TmkFlags.BM_TMKSEC | TmkFlags.BM_TMKMIN,
//     //   tim0: 0x80,
//     //   tim1: 0x00,
//     //   tim2: 251,
//     //   tim3: 4,
//     //   tim4: 0x00,
//     //   tsta: TstaFlags.BM_TSTATICK | TstaFlags.BM_TSTASEC | TmkFlags.BM_TMKMIN,
//     // },
//     // // 48 + 128 + 59 * 200 + (250 + 257*256) * 60 * 200 (792_515_976) ticks
//     // {
//     //   tick: 792_515_976,
//     //   int: IntFlags.BM_INTTIME,
//     //   tmk: TmkFlags.BM_TMKTICK | TmkFlags.BM_TMKSEC | TmkFlags.BM_TMKMIN,
//     //   tim0: 0x80,
//     //   tim1: 0x00,
//     //   tim2: 251,
//     //   tim3: 1,
//     //   tim4: 1,
//     //   tsta: TstaFlags.BM_TSTATICK | TstaFlags.BM_TSTASEC | TmkFlags.BM_TMKMIN,
//     // },
//   ];

//   tickSamples.forEach((smp) => {
//     it(`tick ${smp.tick}/${smp.int}/${smp.tmk}`, () => {
//       machine.api.testSetZ88TMK(smp.tmk);
//       machine.api.testSetZ88INT(smp.int);
//       machine.api.testIncZ88Rtc(smp.tick);

//       const s = machine.getMachineState();

//       expect(s.TIM0).toBe(smp.tim0);
//       expect(s.TIM1).toBe(smp.tim1);
//       expect(s.TIM2).toBe(smp.tim2);
//       expect(s.TIM3).toBe(smp.tim3);
//       expect(s.TIM4).toBe(smp.tim4);
//       expect(s.TSTA).toBe(smp.tsta);
//     });
//   });

//   it("RTC reset requested", () => {
//     machine.api.testIncZ88Rtc(100);
//     machine.api.testSetZ88COM(0x10);
//     machine.api.testIncZ88Rtc(1);

//     const s = machine.getMachineState();

//     expect(s.INT).toBe(0x23);
//     expect(s.STA).toBe(0x01);
//     expect(s.COM).toBe(0x10);

//     expect(s.TIM0).toBe(0);
//     expect(s.TIM1).toBe(0);
//     expect(s.TIM2).toBe(0);
//     expect(s.TIM3).toBe(0);
//     expect(s.TIM4).toBe(0);
//     expect(s.TSTA).toBe(0);
//   });
// });
