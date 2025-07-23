import { describe, it, expect } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

/**
 * Tests for the AXS (AND X with A and Subtract) undocumented instruction
 *
 * AXS performs an AND operation between the A and X registers, then subtracts
 * an immediate value from this result (without borrow) and stores the result in X.
 * Sets N, Z, and C flags based on the result.
 *
 * Opcode:
 * - 0xCB: AXS #arg - Immediate
 */
describe("M6510 Undocumented Instructions - AXS", () => {
  it("AXS #$10 - basic AND and subtract operation", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xCB, 0x10], 0x1000, 0x1000); // AXS #$10
    machine.cpu.a = 0xFF;
    machine.cpu.x = 0x55;

    // --- Act
    machine.run();

    // --- Assert
    // (A AND X) - immediate = (0xFF AND 0x55) - 0x10 = 0x55 - 0x10 = 0x45
    expect(machine.cpu.x).toBe(0x45);
    expect(machine.cpu.a).toBe(0xFF); // A should be unchanged
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow (result >= 0)
    expect(machine.cpu.isNFlagSet()).toBe(false); // Positive result
    expect(machine.cpu.isZFlagSet()).toBe(false); // Not zero
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  it("AXS #$55 - should result in zero and set Z flag", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xCB, 0x55], 0x1000, 0x1000); // AXS #$55
    machine.cpu.a = 0xFF;
    machine.cpu.x = 0x55;

    // --- Act
    machine.run();

    // --- Assert
    // (A AND X) - immediate = (0xFF AND 0x55) - 0x55 = 0x55 - 0x55 = 0x00
    expect(machine.cpu.x).toBe(0x00);
    expect(machine.cpu.a).toBe(0xFF); // A should be unchanged
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow (result >= 0)
    expect(machine.cpu.isNFlagSet()).toBe(false); // Not negative
    expect(machine.cpu.isZFlagSet()).toBe(true); // Zero result
  });

  it("AXS #$60 - should result in negative and clear C flag (borrow)", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xCB, 0x60], 0x1000, 0x1000); // AXS #$60
    machine.cpu.a = 0xFF;
    machine.cpu.x = 0x55;

    // --- Act
    machine.run();

    // --- Assert
    // (A AND X) - immediate = (0xFF AND 0x55) - 0x60 = 0x55 - 0x60 = -0x0B = 0xF5
    expect(machine.cpu.x).toBe(0xF5);
    expect(machine.cpu.a).toBe(0xFF); // A should be unchanged
    expect(machine.cpu.isCFlagSet()).toBe(false); // Borrow occurred (result < 0)
    expect(machine.cpu.isNFlagSet()).toBe(true); // Negative result
    expect(machine.cpu.isZFlagSet()).toBe(false); // Not zero
  });

  it("AXS #$00 - subtract zero should preserve AND result", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xCB, 0x00], 0x1000, 0x1000); // AXS #$00
    machine.cpu.a = 0xAA;
    machine.cpu.x = 0x33;

    // --- Act
    machine.run();

    // --- Assert
    // (A AND X) - immediate = (0xAA AND 0x33) - 0x00 = 0x22 - 0x00 = 0x22
    expect(machine.cpu.x).toBe(0x22);
    expect(machine.cpu.a).toBe(0xAA); // A should be unchanged
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    expect(machine.cpu.isNFlagSet()).toBe(false); // Positive result
    expect(machine.cpu.isZFlagSet()).toBe(false); // Not zero
  });

  it("AXS #$FF - maximum subtraction", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xCB, 0xFF], 0x1000, 0x1000); // AXS #$FF
    machine.cpu.a = 0xFF;
    machine.cpu.x = 0xFF;

    // --- Act
    machine.run();

    // --- Assert
    // (A AND X) - immediate = (0xFF AND 0xFF) - 0xFF = 0xFF - 0xFF = 0x00
    expect(machine.cpu.x).toBe(0x00);
    expect(machine.cpu.a).toBe(0xFF); // A should be unchanged
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow (0xFF - 0xFF = 0)
    expect(machine.cpu.isNFlagSet()).toBe(false); // Not negative
    expect(machine.cpu.isZFlagSet()).toBe(true); // Zero result
  });

  it("AXS with AND result of zero", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xCB, 0x01], 0x1000, 0x1000); // AXS #$01
    machine.cpu.a = 0xAA; // 10101010
    machine.cpu.x = 0x55; // 01010101

    // --- Act
    machine.run();

    // --- Assert
    // (A AND X) - immediate = (0xAA AND 0x55) - 0x01 = 0x00 - 0x01 = -0x01 = 0xFF
    expect(machine.cpu.x).toBe(0xFF);
    expect(machine.cpu.a).toBe(0xAA); // A should be unchanged
    expect(machine.cpu.isCFlagSet()).toBe(false); // Borrow occurred
    expect(machine.cpu.isNFlagSet()).toBe(true); // Negative result
    expect(machine.cpu.isZFlagSet()).toBe(false); // Not zero
  });

  it("AXS should not affect other flags", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xCB, 0x20], 0x1000, 0x1000); // AXS #$20
    machine.cpu.a = 0xFF;
    machine.cpu.x = 0x77;
    
    // Set some initial flags that should be preserved
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

  it("AXS edge case - result exactly at boundary", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xCB, 0x80], 0x1000, 0x1000); // AXS #$80
    machine.cpu.a = 0xFF;
    machine.cpu.x = 0x80;

    // --- Act
    machine.run();

    // --- Assert
    // (A AND X) - immediate = (0xFF AND 0x80) - 0x80 = 0x80 - 0x80 = 0x00
    expect(machine.cpu.x).toBe(0x00);
    expect(machine.cpu.a).toBe(0xFF); // A should be unchanged
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow (exact subtraction)
    expect(machine.cpu.isNFlagSet()).toBe(false); // Not negative
    expect(machine.cpu.isZFlagSet()).toBe(true); // Zero result
  });

  it("AXS with partial AND result", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xCB, 0x05], 0x1000, 0x1000); // AXS #$05
    machine.cpu.a = 0x3C; // 00111100
    machine.cpu.x = 0x0F; // 00001111

    // --- Act
    machine.run();

    // --- Assert
    // (A AND X) - immediate = (0x3C AND 0x0F) - 0x05 = 0x0C - 0x05 = 0x07
    expect(machine.cpu.x).toBe(0x07);
    expect(machine.cpu.a).toBe(0x3C); // A should be unchanged
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    expect(machine.cpu.isNFlagSet()).toBe(false); // Positive result
    expect(machine.cpu.isZFlagSet()).toBe(false); // Not zero
  });
});
