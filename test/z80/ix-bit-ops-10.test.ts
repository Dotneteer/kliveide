import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";
import { FlagsSetMask } from "@emu/abstractions/FlagSetMask";

describe("Z80 IX bit ops 10-1f", () => {
  it("0x10: RL (IX+d),B", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x10 // RL (IX+32H),B
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory("1032");

    expect(cpu.b).toBe(m.memory[cpu.ix + OFFS]);
    expect(cpu.b).toBe(0x11);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x11: RL (IX+d),C", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x11 // RL (IX+32H),C
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("C, F");
    m.shouldKeepMemory("1032");

    expect(cpu.c).toBe(m.memory[cpu.ix + OFFS]);
    expect(cpu.c).toBe(0x11);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x12: RL (IX+d),D", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x12 // RL (IX+32H),D
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("D, F");
    m.shouldKeepMemory("1032");

    expect(cpu.d).toBe(m.memory[cpu.ix + OFFS]);
    expect(cpu.d).toBe(0x11);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x13: RL (IX+d),E", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x13 // RL (IX+32H),E
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E, F");
    m.shouldKeepMemory("1032");

    expect(cpu.e).toBe(m.memory[cpu.ix + OFFS]);
    expect(cpu.e).toBe(0x11);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x14: RL (IX+d),H", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x14 // RL (IX+32H),H
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("H, F");
    m.shouldKeepMemory("1032");

    expect(cpu.h).toBe(m.memory[cpu.ix + OFFS]);
    expect(cpu.h).toBe(0x11);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x15: RL (IX+d),L", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x15 // RL (IX+32H),L
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("L, F");
    m.shouldKeepMemory("1032");

    expect(cpu.l).toBe(m.memory[cpu.ix + OFFS]);
    expect(cpu.l).toBe(0x11);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x16: RL (IX+d)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x16 // RL (IX+32H)
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F");
    m.shouldKeepMemory("1032");

    expect(0x11).toBe(m.memory[cpu.ix + OFFS]);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x17: RL (IX+d),A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x17 // RL (IX+32H),A
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("1032");

    expect(cpu.a).toBe(m.memory[cpu.ix + OFFS]);
    expect(cpu.a).toBe(0x11);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x18: RR (IX+d),B", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x18 // RR (IX+32H),B
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory("1032");

    expect(cpu.b).toBe(m.memory[cpu.ix + OFFS]);
    expect(cpu.b).toBe(0x84);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x19: RR (IX+d),C", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x19 // RR (IX+32H),C
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("C, F");
    m.shouldKeepMemory("1032");

    expect(cpu.c).toBe(m.memory[cpu.ix + OFFS]);
    expect(cpu.c).toBe(0x84);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x1A: RR (IX+d),D", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x1a // RR (IX+32H),D
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("D, F");
    m.shouldKeepMemory("1032");

    expect(cpu.d).toBe(m.memory[cpu.ix + OFFS]);
    expect(cpu.d).toBe(0x84);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x1B: RR (IX+d),E", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x1b // RR (IX+32H),E
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E, F");
    m.shouldKeepMemory("1032");

    expect(cpu.e).toBe(m.memory[cpu.ix + OFFS]);
    expect(cpu.e).toBe(0x84);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x1C: RR (IX+d),H", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x1c // RR (IX+32H),H
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("H, F");
    m.shouldKeepMemory("1032");

    expect(cpu.h).toBe(m.memory[cpu.ix + OFFS]);
    expect(cpu.h).toBe(0x84);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x1D: RR (IX+d),L", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x1d // RR (IX+32H),L
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("L, F");
    m.shouldKeepMemory("1032");

    expect(cpu.l).toBe(m.memory[cpu.ix + OFFS]);
    expect(cpu.l).toBe(0x84);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x1E: RR (IX+d)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x1e // RR (IX+32H)
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E, F");
    m.shouldKeepMemory("1032");

    expect(0x84).toBe(m.memory[cpu.ix + OFFS]);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x1F: RR (IX+d),A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x1f // RR (IX+32H),A
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("1032");

    expect(cpu.a).toBe(m.memory[cpu.ix + OFFS]);
    expect(cpu.a).toBe(0x84);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });
});
