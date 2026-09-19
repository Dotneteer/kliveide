import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";

/**
 * The two resets of the CPU. `reset()` is the reset button: like a real Z80, it leaves BC, DE, HL,
 * their alternates, IX and IY alone. `hardReset()` is power-on: it sets them too.
 *
 * This file is copied literally to `test/wasm/z80/`, where `reset()` and `hardReset()` run the shared
 * C core's `z80SoftReset` and `z80Reset` (`src/emu/z80/wasm/z80.c`).
 */
describe("Z80 reset and hard reset", () => {
  function prepared(): Z80TestMachine {
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0x3e,
      0x42 // LD A,42H
    ]);
    m.run();
    m.cpu.bc = 0x1234;
    m.cpu.de = 0x2345;
    m.cpu.hl = 0x3456;
    m.cpu.bc_ = 0x4567;
    m.cpu.de_ = 0x5678;
    m.cpu.hl_ = 0x6789;
    m.cpu.ix = 0x789a;
    m.cpu.iy = 0x89ab;
    m.cpu.af_ = 0x1111;
    m.cpu.sp = 0x8000;
    m.cpu.ir = 0x3f22;
    m.cpu.wz = 0x4444;
    m.cpu.interruptMode = 1;
    m.cpu.iff1 = true;
    m.cpu.iff2 = true;
    return m;
  }

  it("reset keeps BC, DE, HL, their alternates, IX and IY", () => {
    const m = prepared();
    m.cpu.reset();
    expect(m.cpu.bc).toBe(0x1234);
    expect(m.cpu.de).toBe(0x2345);
    expect(m.cpu.hl).toBe(0x3456);
    expect(m.cpu.bc_).toBe(0x4567);
    expect(m.cpu.de_).toBe(0x5678);
    expect(m.cpu.hl_).toBe(0x6789);
    expect(m.cpu.ix).toBe(0x789a);
    expect(m.cpu.iy).toBe(0x89ab);
  });

  it("reset sets AF, AF', IR, PC, SP, WZ, the interrupt state and the tacts", () => {
    const m = prepared();
    m.cpu.reset();
    expect(m.cpu.af).toBe(0xffff);
    expect(m.cpu.af_).toBe(0xffff);
    expect(m.cpu.ir).toBe(0x0000);
    expect(m.cpu.pc).toBe(0x0000);
    expect(m.cpu.sp).toBe(0xffff);
    expect(m.cpu.wz).toBe(0x0000);
    expect(m.cpu.interruptMode).toBe(0);
    expect(m.cpu.iff1).toBe(false);
    expect(m.cpu.iff2).toBe(false);
    expect(m.cpu.tacts).toBe(0);
  });

  it("hard reset sets the general registers too", () => {
    const m = prepared();
    m.cpu.hardReset();
    expect(m.cpu.af).toBe(0xffff);
    expect(m.cpu.bc).toBe(0x0000);
    expect(m.cpu.de).toBe(0x0000);
    expect(m.cpu.hl).toBe(0x0000);
    expect(m.cpu.af_).toBe(0xffff);
    expect(m.cpu.bc_).toBe(0xffff);
    expect(m.cpu.de_).toBe(0xffff);
    expect(m.cpu.hl_).toBe(0xffff);
    expect(m.cpu.ix).toBe(0x0000);
    expect(m.cpu.iy).toBe(0x0000);
    expect(m.cpu.pc).toBe(0x0000);
    expect(m.cpu.sp).toBe(0xffff);
    expect(m.cpu.interruptMode).toBe(0);
    expect(m.cpu.iff1).toBe(false);
  });
});
