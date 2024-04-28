import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";
import { FlagsSetMask } from "@emu/abstractions/FlagSetMask";

describe("Z80 IY bit ops 30-3f", () => {
  it("0x30: SLL (IY+d),B", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x30 // SLL (IY+32H),B
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

  it("0x31: SLL (IY+d),C", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x31 // SLL (IY+32H),C
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

  it("0x32: SLL (IY+d),D", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x32 // SLL (IY+32H),D
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

  it("0x33: SLL (IY+d),E", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x33 // SLL (IY+32H),E
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

  it("0x34: SLL (IY+d),H", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x34 // SLL (IY+32H),H
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

  it("0x35: SLL (IY+d),L", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x35 // SLL (IY+32H),L
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

  it("0x36: SLL (IY+d)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x36 // SLL (IY+32H)
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

    expect(0x11).toBe(m.memory[cpu.iy + OFFS]);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x37: SLL (IY+d),A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x37 // SLL (IY+32H),A
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

  it("0x38: SRL (IY+d),B", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x38 // SRL (IY+32H),B
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

  it("0x39: SRL (IY+d),C", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x39 // SRL (IY+32H),C
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

  it("0x3A: SRL (IY+d),D", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x3a // SRL (IY+32H),D
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

  it("0x3B: SRL (IY+d),E", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x3b // SRL (IY+32H),E
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

  it("0x3C: SRL (IY+d),H", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x3c // SRL (IY+32H),H
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

  it("0x3D: SRL (IY+d),L", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x3d // SRL (IY+32H),L
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

  it("0x3E: SRL (IY+d)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x3e // SRL (IY+32H)
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.iy = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.iy + OFFS] = 0x10;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F");
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

  it("0x3F: SRL (IY+d),A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xfd,
      0xcb,
      OFFS,
      0x3f // SRL (IY+32H),A
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
