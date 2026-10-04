import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";

/**
 * R counts every M1 cycle. The byte after a CB, ED, DD or FD prefix is fetched by a second M1, so a
 * prefixed instruction adds 2 to R; the displacement and opcode bytes of DDCB/FDCB are plain reads
 * and add nothing. Bit 7 of R never changes by counting.
 *
 * The Sinclair ZX81 relies on this: its ROM sets R with `LD R,A` so that the R register's count
 * raises the line-end interrupt (`WAIT-INT`, $0041), and hi-res drivers count R across arbitrary
 * code. The counting moves no tact (each case pins its instruction's T-states too).
 *
 * This file is copied literally to `test/wasm/z80/`, where it runs against the shared C core.
 */
describe("Z80 R register counting", () => {
  const cases: { name: string; code: number[]; r: number; tacts: number }[] = [
    { name: "NOP", code: [0x00], r: 0x01, tacts: 4 },
    { name: "RLC B (CB 00)", code: [0xcb, 0x00], r: 0x02, tacts: 8 },
    { name: "NEG (ED 44)", code: [0xed, 0x44], r: 0x02, tacts: 8 },
    { name: "LD IX,nn (DD 21)", code: [0xdd, 0x21, 0x34, 0x12], r: 0x02, tacts: 14 },
    { name: "LD IY,nn (FD 21)", code: [0xfd, 0x21, 0x34, 0x12], r: 0x02, tacts: 14 },
    { name: "RLC (IX+d) (DD CB d 06)", code: [0xdd, 0xcb, 0x05, 0x06], r: 0x02, tacts: 23 },
    { name: "BIT 0,(IY+d) (FD CB d 46)", code: [0xfd, 0xcb, 0x05, 0x46], r: 0x02, tacts: 20 }
  ];

  for (const c of cases) {
    it(`${c.name} adds ${c.r} to R`, () => {
      const m = new Z80TestMachine(RunMode.OneInstruction);
      m.initCode(c.code);
      m.cpu.r = 0x00;

      m.run();

      expect(m.cpu.r).toBe(c.r);
      expect(m.cpu.tacts).toBe(c.tacts);
    });
  }

  it("counting keeps bit 7 of R and wraps the low seven bits", () => {
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([0xcb, 0x00]);
    m.cpu.r = 0xff;

    m.run();

    expect(m.cpu.r).toBe(0x81);
  });

  it("LD A,R reads R after both M1 cycles", () => {
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([0xed, 0x5f]);
    m.cpu.r = 0x10;

    m.run();

    expect(m.cpu.a).toBe(0x12);
    expect(m.cpu.r).toBe(0x12);
  });

  it("LD R,A writes R after both M1 cycles", () => {
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([0xed, 0x4f]);
    m.cpu.a = 0x80;
    m.cpu.r = 0x10;

    m.run();

    expect(m.cpu.r).toBe(0x80);
  });
});
