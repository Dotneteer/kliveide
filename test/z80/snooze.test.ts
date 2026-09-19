import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";

/**
 * The CPU snooze state the Cambridge Z88's Blink uses: reading the keyboard with INT.KWAIT set and
 * no key down stops the CPU clock until a key, an RTC event or the flap wakes it.
 *
 * The CPU only carries the flag. The machine's frame loop runs `onSnooze()` (16 tacts, no
 * instruction) instead of `executeCpuCycle()` while it is set, and wakes the CPU with `awakeCpu()`.
 *
 * This file is copied literally to `test/wasm/z80/`, where it runs against the shared C core
 * (`src/emu/z80/wasm/z80.c`: `z80SnoozeCpu`, `z80AwakeCpu`, `z80IsCpuSnoozed`, `z80SnoozeCycle`).
 */
describe("Z80 snooze", () => {
  it("a new CPU is not snoozed", () => {
    const m = new Z80TestMachine(RunMode.OneInstruction);
    expect(m.cpu.isCpuSnoozed()).toBe(false);
  });

  it("snoozeCpu and awakeCpu set and clear the snooze", () => {
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.cpu.snoozeCpu();
    expect(m.cpu.isCpuSnoozed()).toBe(true);
    m.cpu.snoozeCpu();
    expect(m.cpu.isCpuSnoozed()).toBe(true);
    m.cpu.awakeCpu();
    expect(m.cpu.isCpuSnoozed()).toBe(false);
    m.cpu.awakeCpu();
    expect(m.cpu.isCpuSnoozed()).toBe(false);
  });

  it("onSnooze passes 16 tacts and executes nothing", () => {
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0x3e,
      0x42 // LD A,42H
    ]);
    m.cpu.snoozeCpu();
    const pc = m.cpu.pc;
    const af = m.cpu.af;
    const tacts = m.cpu.tacts;

    m.cpu.onSnooze();
    m.cpu.onSnooze();

    expect(m.cpu.tacts).toBe(tacts + 32);
    expect(m.cpu.pc).toBe(pc);
    expect(m.cpu.af).toBe(af);
    expect(m.cpu.isCpuSnoozed()).toBe(true);
  });

  it("the CPU neither checks nor clears the snooze when it executes an instruction", () => {
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0x3e,
      0x42 // LD A,42H
    ]);
    m.cpu.snoozeCpu();

    m.run();

    expect(m.cpu.a).toBe(0x42);
    expect(m.cpu.pc).toBe(0x0002);
    expect(m.cpu.tacts).toBe(7);
    expect(m.cpu.isCpuSnoozed()).toBe(true);
  });

  it("reset clears the snooze", () => {
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.cpu.snoozeCpu();
    m.cpu.reset();
    expect(m.cpu.isCpuSnoozed()).toBe(false);
  });
});
