import { describe, it, expect } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

/**
 * Tests for the undocumented RRA (Rotate Right and Add with Carry) M6510 instruction
 *
 * RRA (Rotate Right and Add with Carry):
 * - Performs ROR (Rotate Right) on memory location
 * - Then performs ADC (Add with Carry) of the rotated value with the accumulator
 * - Affects flags: N, Z, C, V (from ROR operation and final ADC result)
 *
 * The instruction combines two operations:
 * 1. ROR: Rotate memory right through carry flag
 * 2. ADC: Add rotated value to accumulator with carry
 *
 * Opcodes:
 * - 0x63: RRA (zp,X) - Indexed Indirect
 * - 0x67: RRA zp - Zero Page
 * - 0x6F: RRA abs - Absolute
 * - 0x73: RRA (zp),Y - Indirect Indexed
 * - 0x77: RRA zp,X - Zero Page,X
 * - 0x7B: RRA abs,Y - Absolute,Y
 * - 0x7F: RRA abs,X - Absolute,X
 */
describe("M6510 Undocumented Instructions - RRA", () => {
  it("Should rotate right memory and add with carry to accumulator", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x63, 0x80], 0x1000, 0x1000); // RRA (0x80,X)
    machine.cpu.x = 0x10; // X = 0x10
    machine.cpu.a = 0x05; // A = 0x05

    // Set up indirect addressing: 0x80 + 0x10 = 0x90 (zero page)
    machine.writeMemory(0x90, 0x20); // Low byte of target address
    machine.writeMemory(0x91, 0x30); // High byte of target address
    machine.writeMemory(0x3020, 0x82); // Target memory = 0x82 (10000010)

    machine.cpu.p = 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    // ROR: 0x82 >> 1 with carry in = 0x41 | 0x80 = 0xC1 (11000001)
    const rotatedValue = 0xc1;
    expect(machine.readMemory(0x3020)).toBe(rotatedValue); // Memory rotated right

    // ADC: 0x05 + 0xC1 + 0 (carry from ROR was 0) = 0xC6
    expect(machine.cpu.a).toBe(0xc6);
    expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from addition
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0xC6 is not zero
    expect(machine.cpu.isNFlagSet()).toBe(true); // Result 0xC6 has bit 7 set
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow: pos + neg cannot overflow
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(8); // 2 + 1 + 1 + 1 + 1 + 1 + 1 = 8 cycles
  });

  it("Should handle carry from ROR operation correctly", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x63, 0x80], 0x1000, 0x1000); // RRA (0x80,X)
    machine.cpu.x = 0x10;
    machine.cpu.a = 0x10; // A = 0x10

    machine.writeMemory(0x90, 0x20);
    machine.writeMemory(0x91, 0x30);
    machine.writeMemory(0x3020, 0x01); // Value with bit 0 set (will set carry)

    machine.cpu.p = 0x00; // Clear all flags

    // --- Act
    machine.run();

    // --- Assert
    // ROR: 0x01 >> 1 with no carry in = 0x00, but bit 0 was set so carry flag is set
    expect(machine.readMemory(0x3020)).toBe(0x00); // Memory rotated right

    // ADC: 0x10 + 0x00 + 1 (carry from ROR) = 0x11
    expect(machine.cpu.a).toBe(0x11);
    expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from addition
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result has bit 7 clear
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
  });

  it("Should rotate right zero page memory and add with carry to accumulator", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x67, 0x50], 0x1000, 0x1000); // RRA 0x50
    machine.cpu.a = 0x20; // A = 0x20
    machine.writeMemory(0x50, 0x44); // Zero page memory = 0x44 (01000100)
    machine.cpu.p = 0x00; // Clear all flags

    // --- Act
    machine.run();

    // --- Assert
    // ROR: 0x44 >> 1 with no carry in = 0x22 (00100010)
    const rotatedValue = 0x22;
    expect(machine.readMemory(0x50)).toBe(rotatedValue); // Memory rotated right

    // ADC: 0x20 + 0x22 + 0 (no carry from ROR) = 0x42
    expect(machine.cpu.a).toBe(0x42);
    expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from addition
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result has bit 7 clear
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5); // 2 + 1 + 1 + 1 = 5 cycles
  });

  it("Should work with carry flag set initially", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x67, 0x50], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // A = 0x00
    machine.writeMemory(0x50, 0x02); // Zero page memory = 0x02 (00000010)
    machine.cpu.p = 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    // ROR: 0x02 >> 1 with carry in = 0x01 | 0x80 = 0x81 (10000001)
    expect(machine.readMemory(0x50)).toBe(0x81);

    // ADC: 0x00 + 0x81 + 0 (no carry from ROR) = 0x81
    expect(machine.cpu.a).toBe(0x81);
    expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from addition
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(true); // Result has bit 7 set
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
  });

  it("Should rotate right absolute memory and add with carry to accumulator", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x6f, 0x00, 0x30], 0x1000, 0x1000); // RRA 0x3000
    machine.cpu.a = 0x30; // A = 0x30
    machine.writeMemory(0x3000, 0x88); // Absolute memory = 0x88 (10001000)
    machine.cpu.p = 0x00; // Clear all flags

    // --- Act
    machine.run();

    // --- Assert
    // ROR: 0x88 >> 1 with no carry in = 0x44 (01000100)
    const rotatedValue = 0x44;
    expect(machine.readMemory(0x3000)).toBe(rotatedValue); // Memory rotated right

    // ADC: 0x30 + 0x44 + 0 (no carry from ROR) = 0x74
    expect(machine.cpu.a).toBe(0x74);
    expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from addition
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result has bit 7 clear
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(6); // 2 + 2 + 1 + 1 = 6 cycles
  });

  it("Should handle overflow correctly", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x6f, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x7f; // A = 0x7F (max positive in signed)
    machine.writeMemory(0x3000, 0x02); // 0x02 >> 1 = 0x01
    machine.cpu.p = 0x00;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0x01);
    // ADC: 0x7F + 0x01 + 0 = 0x80 (overflow from pos to neg)
    expect(machine.cpu.a).toBe(0x80);
    expect(machine.cpu.isCFlagSet()).toBe(false); // No carry
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(true); // Result is negative
    expect(machine.cpu.isVFlagSet()).toBe(true); // Overflow occurred
  });

  it("Should rotate right indirect indexed memory and add with carry to accumulator", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x73, 0x80], 0x1000, 0x1000); // RRA (0x80),Y
    machine.cpu.y = 0x05; // Y = 0x05
    machine.cpu.a = 0x10; // A = 0x10

    // Set up indirect addressing
    machine.writeMemory(0x80, 0x00); // Low byte of base address
    machine.writeMemory(0x81, 0x40); // High byte of base address
    machine.writeMemory(0x4005, 0x60); // Target memory at 0x4000 + 0x05 = 0x4005

    machine.cpu.p = 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    // ROR: 0x60 >> 1 with carry in = 0x30 | 0x80 = 0xB0
    const rotatedValue = 0xb0;
    expect(machine.readMemory(0x4005)).toBe(rotatedValue); // Memory rotated right

    // ADC: 0x10 + 0xB0 + 0 (no carry from ROR since bit 0 of 0x60 was 0) = 0xC0
    expect(machine.cpu.a).toBe(0xc0);
    expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from addition
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(true); // Result has bit 7 set
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow: pos + neg cannot overflow
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(8); // 2 + 1 + 1 + 1 + 1 + 1 + 1 = 8 cycles
  });

  it("Should rotate right zero page indexed memory and add with carry to accumulator", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x77, 0x80], 0x1000, 0x1000); // RRA 0x80,X
    machine.cpu.x = 0x10; // X = 0x10
    machine.cpu.a = 0x05; // A = 0x05
    machine.writeMemory(0x90, 0x40); // Zero page memory at 0x80 + 0x10 = 0x90
    machine.cpu.p = 0x00; // Clear all flags

    // --- Act
    machine.run();

    // --- Assert
    // ROR: 0x40 >> 1 with no carry in = 0x20
    const rotatedValue = 0x20;
    expect(machine.readMemory(0x90)).toBe(rotatedValue); // Memory rotated right

    // ADC: 0x05 + 0x20 + 0 = 0x25
    expect(machine.cpu.a).toBe(0x25);
    expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from addition
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result has bit 7 clear
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6); // 2 + 1 + 1 + 1 + 1 = 6 cycles
  });

  it("Should handle zero page wrap-around", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x77, 0xf0], 0x1000, 0x1000); // RRA 0xF0,X
    machine.cpu.x = 0x20; // X = 0x20, so 0xF0 + 0x20 = 0x110 wraps to 0x10
    machine.cpu.a = 0x08;
    machine.writeMemory(0x10, 0x81); // Memory at wrapped address
    machine.cpu.p = 0x00;

    // --- Act
    machine.run();

    // --- Assert
    // ROR: 0x81 >> 1 with no carry in = 0x40, carry flag set from bit 0
    expect(machine.readMemory(0x10)).toBe(0x40);

    // ADC: 0x08 + 0x40 + 1 (carry from ROR) = 0x49
    expect(machine.cpu.a).toBe(0x49);
    expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from addition
  });

  it("Should rotate right absolute indexed Y memory and add with carry to accumulator", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x7b, 0x00, 0x40], 0x1000, 0x1000); // RRA 0x4000,Y
    machine.cpu.y = 0x10; // Y = 0x10
    machine.cpu.a = 0x15; // A = 0x15
    machine.writeMemory(0x4010, 0xc2); // Memory at 0x4000 + 0x10 = 0x4010
    machine.cpu.p = 0x00; // Clear all flags

    // --- Act
    machine.run();

    // --- Assert
    // ROR: 0xC2 >> 1 with no carry in = 0x61
    const rotatedValue = 0x61;
    expect(machine.readMemory(0x4010)).toBe(rotatedValue); // Memory rotated right

    // ADC: 0x15 + 0x61 + 0 = 0x76
    expect(machine.cpu.a).toBe(0x76);
    expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from addition
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result has bit 7 clear
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(7); // 2 + 2 + 1 + 1 + 1 = 7 cycles
  });

  it("Should rotate right absolute indexed X memory and add with carry to accumulator", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x7f, 0x00, 0x50], 0x1000, 0x1000); // RRA 0x5000,X
    machine.cpu.x = 0x08; // X = 0x08
    machine.cpu.a = 0x7e; // A = 0x7E (near max positive)
    machine.writeMemory(0x5008, 0x04); // Memory at 0x5000 + 0x08 = 0x5008
    machine.cpu.p = 0x00; // Clear all flags

    // --- Act
    machine.run();

    // --- Assert
    // ROR: 0x04 >> 1 with no carry in = 0x02
    const rotatedValue = 0x02;
    expect(machine.readMemory(0x5008)).toBe(rotatedValue); // Memory rotated right

    // ADC: 0x7E + 0x02 + 0 = 0x80 (overflow)
    expect(machine.cpu.a).toBe(0x80);
    expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from addition
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(true); // Result has bit 7 set
    expect(machine.cpu.isVFlagSet()).toBe(true); // Overflow: pos + pos = neg
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(7); // 2 + 2 + 1 + 1 + 1 = 7 cycles
  });

  it("Should produce zero result and set Z flag", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x7f, 0x00, 0x50], 0x1000, 0x1000);
    machine.cpu.x = 0x08;
    machine.cpu.a = 0x00; // A = 0x00
    machine.writeMemory(0x5008, 0x00); // Memory = 0x00
    machine.cpu.p = 0x00;

    // --- Act
    machine.run();

    // --- Assert
    // ROR: 0x00 >> 1 = 0x00
    expect(machine.readMemory(0x5008)).toBe(0x00);

    // ADC: 0x00 + 0x00 + 0 = 0x00
    expect(machine.cpu.a).toBe(0x00);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.isZFlagSet()).toBe(true); // Result is zero
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isVFlagSet()).toBe(false);
  });

  it("Should handle carry from addition", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x7f, 0x00, 0x50], 0x1000, 0x1000);
    machine.cpu.x = 0x08;
    machine.cpu.a = 0xff; // A = 0xFF
    machine.writeMemory(0x5008, 0x02); // Memory = 0x02
    machine.cpu.p = 0x00;

    // --- Act
    machine.run();

    // --- Assert
    // ROR: 0x02 >> 1 = 0x01
    expect(machine.readMemory(0x5008)).toBe(0x01);

    // ADC: 0xFF + 0x01 + 0 = 0x100, result = 0x00 with carry
    expect(machine.cpu.a).toBe(0x00);
    expect(machine.cpu.isCFlagSet()).toBe(true); // Carry from addition
    expect(machine.cpu.isZFlagSet()).toBe(true); // Result is zero
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isVFlagSet()).toBe(false);
  });
});
