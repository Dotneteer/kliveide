import { describe, it, expect } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

/**
 * Tests for the ATX (AND and Transfer to X) undocumented instruction
 *
 * ATX performs an AND operation between the accumulator and an immediate value,
 * then transfers the result from the accumulator to the X register.
 *
 * Opcode:
 * - 0xAB: ATX #arg - Immediate
 */
describe("M6510 Undocumented Instructions - ATX", () => {
  it("ATX #$55 - AND immediate with accumulator and transfer to X", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xAB, 0x55], 0x1000, 0x1000); // ATX #$55
    machine.cpu.a = 0xFF;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x55); // 0xFF AND 0x55 = 0x55
    expect(machine.cpu.x).toBe(0x55); // X should equal A after ATX
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
    expect(machine.cpu.isNFlagSet()).toBe(false); // Bit 7 is 0
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
  });

  it("ATX #$00 - should set zero flag and clear negative flag", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xAB, 0x00], 0x1000, 0x1000); // ATX #$00
    machine.cpu.a = 0x55;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x55 AND 0x00 = 0x00
    expect(machine.cpu.x).toBe(0x00); // X should equal A after ATX
    expect(machine.cpu.isNFlagSet()).toBe(false); // Bit 7 is 0
    expect(machine.cpu.isZFlagSet()).toBe(true); // Result is zero
  });

  it("ATX #$80 - should set negative flag and clear zero flag", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xAB, 0x80], 0x1000, 0x1000); // ATX #$80
    machine.cpu.a = 0xFF;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0xFF AND 0x80 = 0x80
    expect(machine.cpu.x).toBe(0x80); // X should equal A after ATX
    expect(machine.cpu.isNFlagSet()).toBe(true); // Bit 7 is 1
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
  });

  it("ATX #$AA - partial AND operation", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xAB, 0xAA], 0x1000, 0x1000); // ATX #$AA
    machine.cpu.a = 0x55;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x55 AND 0xAA = 0x00
    expect(machine.cpu.x).toBe(0x00); // X should equal A after ATX
    expect(machine.cpu.isNFlagSet()).toBe(false); // Bit 7 is 0
    expect(machine.cpu.isZFlagSet()).toBe(true); // Result is zero
  });

  it("ATX #$FF - should preserve all bits", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xAB, 0xFF], 0x1000, 0x1000); // ATX #$FF
    machine.cpu.a = 0x77;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x77); // 0x77 AND 0xFF = 0x77
    expect(machine.cpu.x).toBe(0x77); // X should equal A after ATX
    expect(machine.cpu.isNFlagSet()).toBe(false); // Bit 7 is 0
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
  });

  it("ATX should not affect other flags", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xAB, 0x55], 0x1000, 0x1000); // ATX #$55
    machine.cpu.a = 0xFF;
    
    // Set some initial flags
    machine.cpu.p |= 0x01; // Set carry flag
    machine.cpu.p |= 0x40; // Set overflow flag
    machine.cpu.p |= 0x08; // Set decimal flag
    machine.cpu.p |= 0x04; // Set interrupt flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.isCFlagSet()).toBe(true); // Carry should be unchanged
    expect(machine.cpu.isVFlagSet()).toBe(true); // Overflow should be unchanged
    expect(machine.cpu.isDFlagSet()).toBe(true); // Decimal should be unchanged
    expect(machine.cpu.isIFlagSet()).toBe(true); // Interrupt should be unchanged
  });

  it("ATX should work with different initial X values", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xAB, 0x33], 0x1000, 0x1000); // ATX #$33
    machine.cpu.a = 0x77;
    machine.cpu.x = 0x99; // Initial X value should not matter

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x33); // 0x77 AND 0x33 = 0x33
    expect(machine.cpu.x).toBe(0x33); // X should equal A after ATX, not related to initial X
    expect(machine.cpu.isNFlagSet()).toBe(false); // Bit 7 is 0
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
  });
});
