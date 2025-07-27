import { describe, it, expect } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

/**
 * Tests for the DCP (Decrement and Compare) undocumented instruction
 *
 * DCP decrements memory by one, then compares the result with the accumulator
 * (like CMP). It affects N, Z, and C flags based on the comparison.
 *
 * Opcodes:
 * - 0xC3: DCP (zp,X) - Indexed Indirect
 * - 0xC7: DCP zp - Zero Page
 * - 0xCF: DCP abs - Absolute
 * - 0xD3: DCP (zp),Y - Indirect Indexed
 * - 0xD7: DCP zp,X - Zero Page,X
 * - 0xDB: DCP abs,Y - Absolute,Y
 * - 0xDF: DCP abs,X - Absolute,X
 */
describe("M6510 Undocumented Instructions - DCP", () => {
  it("DCP zp - should decrement memory and compare with accumulator (0xC7)", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xC7, 0x80], 0x1000, 0x1000); // DCP $80
    machine.writeMemory(0x80, 0x50); // Memory value to decrement
    machine.cpu.a = 0x4F; // Accumulator value

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x80)).toBe(0x4F); // Memory should be decremented: 0x50 - 1 = 0x4F
    expect(machine.cpu.a).toBe(0x4F); // Accumulator should be unchanged
    expect(machine.cpu.isCFlagSet()).toBe(true); // A >= decremented value (0x4F >= 0x4F)
    expect(machine.cpu.isZFlagSet()).toBe(true); // A - decremented = 0x4F - 0x4F = 0
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is not negative
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  it("DCP zp - accumulator less than decremented value (0xC7)", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xC7, 0x80], 0x1000, 0x1000); // DCP $80
    machine.writeMemory(0x80, 0x60); // Memory value to decrement
    machine.cpu.a = 0x50; // Accumulator value

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x80)).toBe(0x5F); // Memory should be decremented: 0x60 - 1 = 0x5F
    expect(machine.cpu.a).toBe(0x50); // Accumulator should be unchanged
    expect(machine.cpu.isCFlagSet()).toBe(false); // A < decremented value (0x50 < 0x5F)
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(true); // Result is negative (0x50 - 0x5F = 0xF1)
  });

  it("DCP zp - accumulator greater than decremented value (0xC7)", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xC7, 0x80], 0x1000, 0x1000); // DCP $80
    machine.writeMemory(0x80, 0x30); // Memory value to decrement
    machine.cpu.a = 0x50; // Accumulator value

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x80)).toBe(0x2F); // Memory should be decremented: 0x30 - 1 = 0x2F
    expect(machine.cpu.a).toBe(0x50); // Accumulator should be unchanged
    expect(machine.cpu.isCFlagSet()).toBe(true); // A >= decremented value (0x50 >= 0x2F)
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is positive (0x50 - 0x2F = 0x21)
  });

  it("DCP abs - absolute addressing (0xCF)", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xCF, 0x00, 0x30], 0x1000, 0x1000); // DCP $3000
    machine.writeMemory(0x3000, 0xFF); // Memory value to decrement
    machine.cpu.a = 0xFE; // Accumulator value

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0xFE); // Memory should be decremented: 0xFF - 1 = 0xFE
    expect(machine.cpu.a).toBe(0xFE); // Accumulator should be unchanged
    expect(machine.cpu.isCFlagSet()).toBe(true); // A >= decremented value (0xFE >= 0xFE)
    expect(machine.cpu.isZFlagSet()).toBe(true); // A - decremented = 0xFE - 0xFE = 0
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is not negative
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(6);
  });

  it("DCP zp,X - zero page indexed addressing (0xD7)", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xD7, 0x80], 0x1000, 0x1000); // DCP $80,X
    machine.cpu.x = 0x05;
    machine.writeMemory(0x85, 0x10); // Memory value at $80 + $05 = $85
    machine.cpu.a = 0x20; // Accumulator value

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x85)).toBe(0x0F); // Memory should be decremented: 0x10 - 1 = 0x0F
    expect(machine.cpu.a).toBe(0x20); // Accumulator should be unchanged
    expect(machine.cpu.isCFlagSet()).toBe(true); // A >= decremented value (0x20 >= 0x0F)
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is positive
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  it("DCP (zp,X) - indexed indirect addressing (0xC3)", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xC3, 0x20], 0x1000, 0x1000); // DCP ($20,X)
    machine.cpu.x = 0x04;
    
    // Set up indirect address at zero page $20+$04=$24 to point to $4000
    machine.writeMemory(0x24, 0x00); // Low byte
    machine.writeMemory(0x25, 0x40); // High byte
    
    machine.writeMemory(0x4000, 0x80); // Target memory value
    machine.cpu.a = 0x7F; // Accumulator value

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x4000)).toBe(0x7F); // Memory should be decremented: 0x80 - 1 = 0x7F
    expect(machine.cpu.a).toBe(0x7F); // Accumulator should be unchanged
    expect(machine.cpu.isCFlagSet()).toBe(true); // A >= decremented value (0x7F >= 0x7F)
    expect(machine.cpu.isZFlagSet()).toBe(true); // A - decremented = 0x7F - 0x7F = 0
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is not negative
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(8);
  });

  it("DCP (zp),Y - indirect indexed addressing (0xD3)", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xD3, 0x30], 0x1000, 0x1000); // DCP ($30),Y
    machine.cpu.y = 0x10;
    
    // Set up indirect address at zero page $30-$31 to point to $5000
    machine.writeMemory(0x30, 0x00); // Low byte
    machine.writeMemory(0x31, 0x50); // High byte
    
    // Target address will be $5000 + $10 = $5010
    machine.writeMemory(0x5010, 0x01); // Target memory value
    machine.cpu.a = 0x05; // Accumulator value

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x5010)).toBe(0x00); // Memory should be decremented: 0x01 - 1 = 0x00
    expect(machine.cpu.a).toBe(0x05); // Accumulator should be unchanged
    expect(machine.cpu.isCFlagSet()).toBe(true); // A >= decremented value (0x05 >= 0x00)
    expect(machine.cpu.isZFlagSet()).toBe(false); // A - decremented = 0x05 - 0x00 = 0x05 (not zero)
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is positive
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(8);
  });

  it("DCP abs,X - absolute indexed addressing (0xDF)", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xDF, 0x00, 0x60], 0x1000, 0x1000); // DCP $6000,X
    machine.cpu.x = 0x20;
    
    // Target address will be $6000 + $20 = $6020
    machine.writeMemory(0x6020, 0x7F); // Target memory value
    machine.cpu.a = 0x7E; // Accumulator value

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x6020)).toBe(0x7E); // Memory should be decremented: 0x7F - 1 = 0x7E
    expect(machine.cpu.a).toBe(0x7E); // Accumulator should be unchanged
    expect(machine.cpu.isCFlagSet()).toBe(true); // A >= decremented value (0x7E >= 0x7E)
    expect(machine.cpu.isZFlagSet()).toBe(true); // A - decremented = 0x7E - 0x7E = 0
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is not negative
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(7);
  });

  it("DCP abs,Y - absolute indexed addressing (0xDB)", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xDB, 0xFF, 0x70], 0x1000, 0x1000); // DCP $70FF,Y
    machine.cpu.y = 0x01;
    
    // Target address will be $70FF + $01 = $7100 (page boundary crossed)
    machine.writeMemory(0x7100, 0x55); // Target memory value
    machine.cpu.a = 0x40; // Accumulator value

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x7100)).toBe(0x54); // Memory should be decremented: 0x55 - 1 = 0x54
    expect(machine.cpu.a).toBe(0x40); // Accumulator should be unchanged
    expect(machine.cpu.isCFlagSet()).toBe(false); // A < decremented value (0x40 < 0x54)
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(true); // Result is negative (0x40 - 0x54 = 0xEC)
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(7);
  });

  it("DCP should handle memory wrapping correctly", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xC7, 0x80], 0x1000, 0x1000); // DCP $80
    machine.writeMemory(0x80, 0x00); // Memory value that will wrap when decremented
    machine.cpu.a = 0xFF; // Accumulator value

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x80)).toBe(0xFF); // Memory should wrap: 0x00 - 1 = 0xFF
    expect(machine.cpu.a).toBe(0xFF); // Accumulator should be unchanged
    expect(machine.cpu.isCFlagSet()).toBe(true); // A >= decremented value (0xFF >= 0xFF)
    expect(machine.cpu.isZFlagSet()).toBe(true); // A - decremented = 0xFF - 0xFF = 0
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is not negative
  });

  it("DCP should not affect other flags", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xC7, 0x80], 0x1000, 0x1000); // DCP $80
    machine.writeMemory(0x80, 0x50);
    machine.cpu.a = 0x4F;
    
    // Set some flags that should be preserved
    machine.cpu.p |= 0x40; // Set overflow flag
    machine.cpu.p |= 0x08; // Set decimal flag
    machine.cpu.p |= 0x04; // Set interrupt flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.isVFlagSet()).toBe(true); // Overflow should be unchanged
    expect(machine.cpu.isDFlagSet()).toBe(true); // Decimal should be unchanged
    expect(machine.cpu.isIFlagSet()).toBe(true); // Interrupt should be unchanged
  });
});
