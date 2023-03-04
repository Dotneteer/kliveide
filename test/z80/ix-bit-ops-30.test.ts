import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";
import { FlagsSetMask } from "../../src/emu/abstractions/FlagSetMask";

describe("Z80 IX bit ops 30-3f", () => {
  it("0x30: SLL (IX+d),B", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x30 // SLL (IX+32H),B
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

  it("0x31: SLL (IX+d),C", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x31 // SLL (IX+32H),C
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

  it("0x32: SLL (IX+d),D", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x32 // SLL (IX+32H),D
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

  it("0x33: SLL (IX+d),E", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x33 // SLL (IX+32H),E
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

  it("0x34: SLL (IX+d),H", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x34 // SLL (IX+32H),H
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

  it("0x35: SLL (IX+d),L", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x35 // SLL (IX+32H),L
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

  it("0x36: SLL (IX+d)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x36 // SLL (IX+32H)
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

  it("0x37: SLL (IX+d),A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x37 // SLL (IX+32H),A
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

  it("0x38: SRL (IX+d),B", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x38 // SRL (IX+32H),B
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x10;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory("1032");

    expect(cpu.b).toBe(m.memory[cpu.ix + OFFS]);
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

  it("0x39: SRL (IX+d),C", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x39 // SRL (IX+32H),C
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x10;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("C, F");
    m.shouldKeepMemory("1032");

    expect(cpu.c).toBe(m.memory[cpu.ix + OFFS]);
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

  it("0x3A: SRL (IX+d),D", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x3a // SRL (IX+32H),D
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x10;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("D, F");
    m.shouldKeepMemory("1032");

    expect(cpu.d).toBe(m.memory[cpu.ix + OFFS]);
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

  it("0x3B: SRL (IX+d),E", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x3b // SRL (IX+32H),E
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x10;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E, F");
    m.shouldKeepMemory("1032");

    expect(cpu.e).toBe(m.memory[cpu.ix + OFFS]);
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

  it("0x3C: SRL (IX+d),H", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x3c // SRL (IX+32H),H
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x10;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("H, F");
    m.shouldKeepMemory("1032");

    expect(cpu.h).toBe(m.memory[cpu.ix + OFFS]);
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

  it("0x3D: SRL (IX+d),L", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x3d // SRL (IX+32H),L
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x10;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("L, F");
    m.shouldKeepMemory("1032");

    expect(cpu.l).toBe(m.memory[cpu.ix + OFFS]);
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

  it("0x3E: SRL (IX+d)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x3e // SRL (IX+32H)
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x10;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F");
    m.shouldKeepMemory("1032");

    expect(0x08).toBe(m.memory[cpu.ix + OFFS]);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(23);
  });

  it("0x3F: SRL (IX+d),A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    const OFFS = 0x32;
    m.initCode([
      0xdd,
      0xcb,
      OFFS,
      0x3f // SRL (IX+32H),A
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x10;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("1032");

    expect(cpu.a).toBe(m.memory[cpu.ix + OFFS]);
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
