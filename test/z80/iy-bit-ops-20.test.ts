import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";
import { FlagsSetMask } from "@emu/abstractions/FlagSetMask";

describe("Z80 IX bit ops 20-2f", () => {
  it("0x20: SLA (IX+d),B", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x20 // SLA (IX+32H),B
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.iy = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.iy + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory("1032");

    expect(cpu.b).toBe(m.memory[cpu.iy + OFFS]);
    expect(cpu.b).toBe(0x10);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x21: SLA (IX+d),C", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x21 // SLA (IX+32H),C
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.iy = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.iy + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("C, F");
    m.shouldKeepMemory("1032");

    expect(cpu.c).toBe(m.memory[cpu.iy + OFFS]);
    expect(cpu.c).toBe(0x10);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x22: SLA (IX+d),D", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x22 // SLA (IX+32H),D
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.iy = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.iy + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("D, F");
    m.shouldKeepMemory("1032");

    expect(cpu.d).toBe(m.memory[cpu.iy + OFFS]);
    expect(cpu.d).toBe(0x10);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x23: SLA (IX+d),E", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x23 // SLA (IX+32H),E
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.iy = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.iy + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E, F");
    m.shouldKeepMemory("1032");

    expect(cpu.e).toBe(m.memory[cpu.iy + OFFS]);
    expect(cpu.e).toBe(0x10);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x24: SLA (IX+d),H", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x24 // SLA (IX+32H),H
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.iy = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.iy + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("H, F");
    m.shouldKeepMemory("1032");

    expect(cpu.h).toBe(m.memory[cpu.iy + OFFS]);
    expect(cpu.h).toBe(0x10);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x25: SLA (IX+d),L", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x25 // SLA (IX+32H),L
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.iy = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.iy + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("L, F");
    m.shouldKeepMemory("1032");

    expect(cpu.l).toBe(m.memory[cpu.iy + OFFS]);
    expect(cpu.l).toBe(0x10);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x26: SLA (IX+d)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x26 // SLA (IX+32H)
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.iy = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.iy + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F");
    m.shouldKeepMemory("1032");

    expect(0x10).toBe(m.memory[cpu.iy + OFFS]);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x27: SLA (IX+d),A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x27 // SLA (IX+32H),A
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.iy = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.iy + OFFS] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("1032");

    expect(cpu.a).toBe(m.memory[cpu.iy + OFFS]);
    expect(cpu.a).toBe(0x10);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x28: SRA (IX+d),B", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x28 // SRA (IX+32H),B
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.iy = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.iy + OFFS] = 0x10;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory("1032");

    expect(cpu.b).toBe(m.memory[cpu.iy + OFFS]);
    expect(cpu.b).toBe(0x08);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x29: SRA (IX+d),C", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x29 // SRA (IX+32H),C
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.iy = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.iy + OFFS] = 0x10;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("C, F");
    m.shouldKeepMemory("1032");

    expect(cpu.c).toBe(m.memory[cpu.iy + OFFS]);
    expect(cpu.c).toBe(0x08);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x2A: SRA (IX+d),D", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x2a // SRA (IX+32H),D
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.iy = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.iy + OFFS] = 0x10;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("D, F");
    m.shouldKeepMemory("1032");

    expect(cpu.d).toBe(m.memory[cpu.iy + OFFS]);
    expect(cpu.d).toBe(0x08);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x2B: SRA (IX+d),E", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x2b // SRA (IX+32H),E
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.iy = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.iy + OFFS] = 0x10;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E, F");
    m.shouldKeepMemory("1032");

    expect(cpu.e).toBe(m.memory[cpu.iy + OFFS]);
    expect(cpu.e).toBe(0x08);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x2C: SRA (IX+d),H", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x2c // SRA (IX+32H),H
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.iy = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.iy + OFFS] = 0x10;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("H, F");
    m.shouldKeepMemory("1032");

    expect(cpu.h).toBe(m.memory[cpu.iy + OFFS]);
    expect(cpu.h).toBe(0x08);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x2D: SRA (IX+d),L", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x2d // SRA (IX+32H),L
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.iy = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.iy + OFFS] = 0x10;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("L, F");
    m.shouldKeepMemory("1032");

    expect(cpu.l).toBe(m.memory[cpu.iy + OFFS]);
    expect(cpu.l).toBe(0x08);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x2E: SRA (IX+d)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x2e // SRA (IX+32H)
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.iy = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.iy + OFFS] = 0x10;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory("1032");

    expect(0x08).toBe(m.memory[cpu.iy + OFFS]);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x2F: SRA (IX+d),A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x2f // SRA (IX+32H),A
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.iy = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.iy + OFFS] = 0x10;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("1032");

    expect(cpu.a).toBe(m.memory[cpu.iy + OFFS]);
    expect(cpu.a).toBe(0x08);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });
});
