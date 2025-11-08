import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 standard ops 50-5f", () => {
  it("0x50: LD D,B", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x06,
      0xb9, // LD B,B9H
      0x50 // LD D,B
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("D, B");
    m.shouldKeepMemory();

    expect(cpu.d).toBe(0xb9);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x51: LD D,C", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x0e,
      0xb9, // LD C,B9H
      0x51 // LD D,C
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("D, C");
    m.shouldKeepMemory();

    expect(cpu.d).toBe(0xb9);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x52: LD D,D", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x16,
      0xb9, // LD D,B9H
      0x52 // LD D,D
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("D");
    m.shouldKeepMemory();

    expect(cpu.d).toBe(0xb9);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x53: LD D,E", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x1e,
      0xb9, // LD E,B9H
      0x53 // LD D,E
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("D, E");
    m.shouldKeepMemory();

    expect(cpu.d).toBe(0xb9);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x54: LD D,H", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x26,
      0xb9, // LD H,B9H
      0x54 // LD D,H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("D, H");
    m.shouldKeepMemory();

    expect(cpu.d).toBe(0xb9);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x55: LD D,L", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x2e,
      0xb9, // LD L,B9H
      0x55 // LD D,L
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("D, L");
    m.shouldKeepMemory();

    expect(cpu.d).toBe(0xb9);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x56: LD D,(HL)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x21,
      0x00,
      0x10, // LD HL,1000H
      0x56 // LD D,(HL)
    ]);
    m.memory[0x1000] = 0xb9;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("D, HL");
    m.shouldKeepMemory();

    expect(cpu.d).toBe(0xb9);
    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(17);
  });

  it("0x57: LD D,A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0xb9, // LD A,B9H
      0x57 // LD D,A
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("D, A");
    m.shouldKeepMemory();

    expect(cpu.d).toBe(0xb9);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x58: LD E,B", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x06,
      0xb9, // LD B,B9H
      0x58 // LD E,B
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E, B");
    m.shouldKeepMemory();

    expect(cpu.e).toBe(0xb9);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x59: LD E,C", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x0e,
      0xb9, // LD C,B9H
      0x59 // LD E,C
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E, C");
    m.shouldKeepMemory();

    expect(cpu.e).toBe(0xb9);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x5A: LD E,D", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x16,
      0xb9, // LD D,B9H
      0x5a // LD E,D
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E, D");
    m.shouldKeepMemory();

    expect(cpu.e).toBe(0xb9);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x5B: LD E,E", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x1e,
      0xb9, // LD E,B9H
      0x5b // LD E,E
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E");
    m.shouldKeepMemory();

    expect(cpu.e).toBe(0xb9);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x5C: LD E,H", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x26,
      0xb9, // LD H,B9H
      0x5c // LD E,H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E, H");
    m.shouldKeepMemory();

    expect(cpu.e).toBe(0xb9);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x5D: LD E,L", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x2e,
      0xb9, // LD L,B9H
      0x5d // LD E,L
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E, L");
    m.shouldKeepMemory();

    expect(cpu.e).toBe(0xb9);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x5E: LD E,(HL)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x21,
      0x00,
      0x10, // LD HL,1000H
      0x5e // LD E,(HL)
    ]);
    m.memory[0x1000] = 0xb9;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E, HL");
    m.shouldKeepMemory();

    expect(cpu.e).toBe(0xb9);
    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(17);
  });

  it("0x5F: LD E,A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0xb9, // LD A,B9H
      0x5f // LD E,A
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E, A");
    m.shouldKeepMemory();

    expect(cpu.e).toBe(0xb9);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });
});
