import { describe, it, expect } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";

/**
 * Tests for the LAR (LAS) undocumented instruction
 *
 * LAR performs an AND operation between memory and the stack pointer,
 * then stores the result in the accumulator, X register, and stack pointer.
 *
 * Opcodes:
 * - 0xBB: LAR abs,Y - Load A, X, and S with (memory AND stack pointer)
 */
describe("M6510 Undocumented Instructions - LAR", () => {
  it("LAR abs,Y - should AND memory with stack pointer and store in A, X, S (0xBB)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xBB, 0x00, 0x30], 0x1000, 0x1000); // LAR $3000,Y
    machine.cpu.y = 0x05;
    machine.cpu.sp = 0xAA; // Stack pointer value
    
    // Target address will be $3000 + $05 = $3005
    machine.writeMemory(0x3005, 0x55); // Memory value

    // --- Act
    machine.run();

    // --- Assert
    // Result should be SP AND memory = 0xAA AND 0x55 = 0x00
    expect(machine.cpu.a).toBe(0x00); // Accumulator gets result
    expect(machine.cpu.x).toBe(0x00); // X register gets result
    expect(machine.cpu.sp).toBe(0x00); // Stack pointer gets result
    expect(machine.cpu.y).toBe(0x05); // Y register unchanged
    expect(machine.cpu.isZFlagSet()).toBe(true); // Result is zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is not negative
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.checkedTacts).toBe(4);
  });

  it("LAR abs,Y - should work with different values", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xBB, 0x00, 0x40], 0x1000, 0x1000); // LAR $4000,Y
    machine.cpu.y = 0x10;
    machine.cpu.sp = 0xFF; // Stack pointer value
    
    // Target address will be $4000 + $10 = $4010
    machine.writeMemory(0x4010, 0x7F); // Memory value

    // --- Act
    machine.run();

    // --- Assert
    // Result should be SP AND memory = 0xFF AND 0x7F = 0x7F
    expect(machine.cpu.a).toBe(0x7F); // Accumulator gets result
    expect(machine.cpu.x).toBe(0x7F); // X register gets result
    expect(machine.cpu.sp).toBe(0x7F); // Stack pointer gets result
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is not negative
    expect(machine.checkedTacts).toBe(4);
  });

  it("LAR abs,Y - should set negative flag when result is negative", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xBB, 0x00, 0x50], 0x1000, 0x1000); // LAR $5000,Y
    machine.cpu.y = 0x20;
    machine.cpu.sp = 0xFF; // Stack pointer value
    
    // Target address will be $5000 + $20 = $5020
    machine.writeMemory(0x5020, 0x80); // Memory value

    // --- Act
    machine.run();

    // --- Assert
    // Result should be SP AND memory = 0xFF AND 0x80 = 0x80
    expect(machine.cpu.a).toBe(0x80); // Accumulator gets result
    expect(machine.cpu.x).toBe(0x80); // X register gets result
    expect(machine.cpu.sp).toBe(0x80); // Stack pointer gets result
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(true); // Result is negative (bit 7 set)
    expect(machine.checkedTacts).toBe(4);
  });

  it("LAR abs,Y - should work with zero stack pointer", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xBB, 0x00, 0x60], 0x1000, 0x1000); // LAR $6000,Y
    machine.cpu.y = 0x00;
    machine.cpu.sp = 0x00; // Zero stack pointer
    
    // Target address will be $6000 + $00 = $6000
    machine.writeMemory(0x6000, 0xFF); // Memory value

    // --- Act
    machine.run();

    // --- Assert
    // Result should be SP AND memory = 0x00 AND 0xFF = 0x00
    expect(machine.cpu.a).toBe(0x00); // Accumulator gets result
    expect(machine.cpu.x).toBe(0x00); // X register gets result
    expect(machine.cpu.sp).toBe(0x00); // Stack pointer gets result
    expect(machine.cpu.isZFlagSet()).toBe(true); // Result is zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is not negative
    expect(machine.checkedTacts).toBe(4);
  });

  it("LAR abs,Y - should handle page boundary crossing", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xBB, 0xFF, 0x70], 0x1000, 0x1000); // LAR $70FF,Y
    machine.cpu.y = 0x01;
    machine.cpu.sp = 0x33; // Stack pointer value
    
    // Target address will be $70FF + $01 = $7100 (page boundary crossed)
    machine.writeMemory(0x7100, 0x77); // Memory value

    // --- Act
    machine.run();

    // --- Assert
    // Result should be SP AND memory = 0x33 AND 0x77 = 0x33
    expect(machine.cpu.a).toBe(0x33); // Accumulator gets result
    expect(machine.cpu.x).toBe(0x33); // X register gets result
    expect(machine.cpu.sp).toBe(0x33); // Stack pointer gets result
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is not negative
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.checkedTacts).toBe(5); // Extra cycle for page boundary crossing
  });

  it("LAR abs,Y - all bits set case", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xBB, 0x00, 0x90], 0x1000, 0x1000); // LAR $9000,Y
    machine.cpu.y = 0x55;
    machine.cpu.sp = 0xFF; // All bits set in stack pointer
    
    // Target address will be $9000 + $55 = $9055
    machine.writeMemory(0x9055, 0xFF); // All bits set in memory

    // --- Act
    machine.run();

    // --- Assert
    // Result should be SP AND memory = 0xFF AND 0xFF = 0xFF
    expect(machine.cpu.a).toBe(0xFF); // Accumulator gets result
    expect(machine.cpu.x).toBe(0xFF); // X register gets result
    expect(machine.cpu.sp).toBe(0xFF); // Stack pointer gets result
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(true); // Result is negative
  });

  it("LAR abs,Y - mixed bit patterns", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xBB, 0x00, 0xA0], 0x1000, 0x1000); // LAR $A000,Y
    machine.cpu.y = 0xAA;
    machine.cpu.sp = 0xCC; // 11001100 in binary
    
    // Target address will be $A000 + $AA = $A0AA
    machine.writeMemory(0xA0AA, 0x99); // 10011001 in binary

    // --- Act
    machine.run();

    // --- Assert
    // Result should be SP AND memory = 0xCC AND 0x99 = 0x88
    // 11001100 AND 10011001 = 10001000 = 0x88
    expect(machine.cpu.a).toBe(0x88); // Accumulator gets result
    expect(machine.cpu.x).toBe(0x88); // X register gets result
    expect(machine.cpu.sp).toBe(0x88); // Stack pointer gets result
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(true); // Result is negative (bit 7 set)
    expect(machine.checkedTacts).toBe(4);
  });
});
