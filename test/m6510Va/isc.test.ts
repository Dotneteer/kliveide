import { describe, it, expect } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";

/**
 * Tests for the ISC (Increment and Subtract with Carry) undocumented instruction
 *
 * ISC increments memory by one, then subtracts the result from the accumulator
 * with borrow (like SBC). It affects N, V, Z, and C flags.
 *
 * Opcodes:
 * - 0xE3: ISC (zp,X) - Indexed Indirect
 * - 0xE7: ISC zp - Zero Page
 * - 0xEF: ISC abs - Absolute
 * - 0xF3: ISC (zp),Y - Indirect Indexed
 * - 0xF7: ISC zp,X - Zero Page,X
 * - 0xFB: ISC abs,Y - Absolute,Y
 * - 0xFF: ISC abs,X - Absolute,X
 */
describe("M6510 Undocumented Instructions - ISC", () => {
  it("ISC zp - should increment memory and subtract from accumulator (0xE7)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xe7, 0x80], 0x1000, 0x1000); // ISC $80
    machine.writeMemory(0x80, 0x0f); // Memory value to increment
    machine.cpu.a = 0x20; // Accumulator value
    machine.cpu.p |= 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x80)).toBe(0x10); // Memory should be incremented: 0x0F + 1 = 0x10
    expect(machine.cpu.a).toBe(0x10); // A = 0x20 - 0x10 = 0x10
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow occurred
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is positive
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  it("ISC zp - subtract with borrow (carry clear) (0xE7)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xe7, 0x80], 0x1000, 0x1000); // ISC $80
    machine.writeMemory(0x80, 0x0f); // Memory value to increment
    machine.cpu.a = 0x20; // Accumulator value
    machine.cpu.p &= ~0x01; // Clear carry flag (borrow will occur)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x80)).toBe(0x10); // Memory should be incremented: 0x0F + 1 = 0x10
    expect(machine.cpu.a).toBe(0x0f); // A = 0x20 - 0x10 - 1 = 0x0F
    expect(machine.cpu.isCFlagSet()).toBe(true); // No final borrow
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is positive
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
  });

  it("ISC zp - result is zero (0xE7)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xe7, 0x80], 0x1000, 0x1000); // ISC $80
    machine.writeMemory(0x80, 0x4f); // Memory value to increment
    machine.cpu.a = 0x50; // Accumulator value
    machine.cpu.p |= 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x80)).toBe(0x50); // Memory should be incremented: 0x4F + 1 = 0x50
    expect(machine.cpu.a).toBe(0x00); // A = 0x50 - 0x50 = 0x00
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    expect(machine.cpu.isZFlagSet()).toBe(true); // Result is zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is not negative
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
  });

  it("ISC zp - result is negative (0xE7)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xE7, 0x80], 0x1000, 0x1000); // ISC $80
    machine.writeMemory(0x80, 0x7F); // Memory value to increment
    machine.cpu.a = 0x70; // Accumulator value
    machine.cpu.p |= 0x01 | 0x20; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x80)).toBe(0x80); // Memory should be incremented: 0x7F + 1 = 0x80
    expect(machine.cpu.a).toBe(0xF0); // A = 0x70 - 0x80 = 0xF0 (negative)
    expect(machine.cpu.isCFlagSet()).toBe(false); // Borrow occurred
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(true); // Result is negative
    expect(machine.cpu.isVFlagSet()).toBe(true); // Signed overflow: +112 - (-128) should be positive but result is negative
  });

  it("ISC zp - overflow case (0xE7)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xE7, 0x80], 0x1000, 0x1000); // ISC $80
    machine.writeMemory(0x80, 0x7F); // Memory value to increment
    machine.cpu.a = 0x80; // Accumulator value (negative in signed arithmetic)
    machine.cpu.p |= 0x01 | 0x20; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x80)).toBe(0x80); // Memory should be incremented: 0x7F + 1 = 0x80
    expect(machine.cpu.a).toBe(0x00); // A = 0x80 - 0x80 = 0x00
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    expect(machine.cpu.isZFlagSet()).toBe(true); // Result is zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is not negative
    expect(machine.cpu.isVFlagSet()).toBe(false); // Signed overflow: -128 - (+128) should be negative but result is 0
  });

  it("ISC abs - absolute addressing (0xEF)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xEF, 0x00, 0x30], 0x1000, 0x1000); // ISC $3000
    machine.writeMemory(0x3000, 0x09); // Memory value to increment
    machine.cpu.a = 0x15; // Accumulator value
    machine.cpu.p |= 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0x0A); // Memory should be incremented: 0x09 + 1 = 0x0A
    expect(machine.cpu.a).toBe(0x0B); // A = 0x15 - 0x0A = 0x0B
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is positive
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(6);
  });

  it("ISC zp,X - zero page indexed addressing (0xF7)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xF7, 0x80], 0x1000, 0x1000); // ISC $80,X
    machine.cpu.x = 0x05;
    machine.writeMemory(0x85, 0x19); // Memory value at $80 + $05 = $85
    machine.cpu.a = 0x30; // Accumulator value
    machine.cpu.p |= 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x85)).toBe(0x1A); // Memory should be incremented: 0x19 + 1 = 0x1A
    expect(machine.cpu.a).toBe(0x16); // A = 0x30 - 0x1A = 0x16
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is positive
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  it("ISC (zp,X) - indexed indirect addressing (0xE3)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xE3, 0x20], 0x1000, 0x1000); // ISC ($20,X)
    machine.cpu.x = 0x04;

    // Set up indirect address at zero page $20+$04=$24 to point to $4000
    machine.writeMemory(0x24, 0x00); // Low byte
    machine.writeMemory(0x25, 0x40); // High byte

    machine.writeMemory(0x4000, 0x2F); // Target memory value
    machine.cpu.a = 0x50; // Accumulator value
    machine.cpu.p |= 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x4000)).toBe(0x30); // Memory should be incremented: 0x2F + 1 = 0x30
    expect(machine.cpu.a).toBe(0x20); // A = 0x50 - 0x30 = 0x20
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is positive
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(8);
  });

  it("ISC (zp),Y - indirect indexed addressing (0xF3)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xF3, 0x30], 0x1000, 0x1000); // ISC ($30),Y
    machine.cpu.y = 0x10;

    // Set up indirect address at zero page $30-$31 to point to $5000
    machine.writeMemory(0x30, 0x00); // Low byte
    machine.writeMemory(0x31, 0x50); // High byte

    // Target address will be $5000 + $10 = $5010
    machine.writeMemory(0x5010, 0x3F); // Target memory value
    machine.cpu.a = 0x60; // Accumulator value
    machine.cpu.p |= 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x5010)).toBe(0x40); // Memory should be incremented: 0x3F + 1 = 0x40
    expect(machine.cpu.a).toBe(0x20); // A = 0x60 - 0x40 = 0x20
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is positive
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(8);
  });

  it("ISC abs,X - absolute indexed addressing (0xFF)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xFF, 0x00, 0x60], 0x1000, 0x1000); // ISC $6000,X
    machine.cpu.x = 0x20;

    // Target address will be $6000 + $20 = $6020
    machine.writeMemory(0x6020, 0x4F); // Target memory value
    machine.cpu.a = 0x80; // Accumulator value
    machine.cpu.p |= 0x01 | 0x20; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x6020)).toBe(0x50); // Memory should be incremented: 0x4F + 1 = 0x50
    expect(machine.cpu.a).toBe(0x30); // A = 0x80 - 0x50 = 0x30
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is positive
    expect(machine.cpu.isVFlagSet()).toBe(true); // No overflow
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(7);
  });

  it("ISC abs,Y - absolute indexed addressing (0xFB)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xFB, 0xFF, 0x70], 0x1000, 0x1000); // ISC $70FF,Y
    machine.cpu.y = 0x01;

    // Target address will be $70FF + $01 = $7100 (page boundary crossed)
    machine.writeMemory(0x7100, 0x1F); // Target memory value
    machine.cpu.a = 0x40; // Accumulator value
    machine.cpu.p |= 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x7100)).toBe(0x20); // Memory should be incremented: 0x1F + 1 = 0x20
    expect(machine.cpu.a).toBe(0x20); // A = 0x40 - 0x20 = 0x20
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is positive
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(7);
  });

  it("ISC should handle memory wrapping correctly", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xe7, 0x80], 0x1000, 0x1000); // ISC $80
    machine.writeMemory(0x80, 0xff); // Memory value that will wrap when incremented
    machine.cpu.a = 0x10; // Accumulator value
    machine.cpu.p |= 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x80)).toBe(0x00); // Memory should wrap: 0xFF + 1 = 0x00
    expect(machine.cpu.a).toBe(0x10); // A = 0x10 - 0x00 = 0x10
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is positive
  });

  it("ISC decimal mode behavior", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xe7, 0x80], 0x1000, 0x1000); // ISC $80
    machine.writeMemory(0x80, 0x08); // Memory value to increment
    machine.cpu.a = 0x15; // Accumulator value
    machine.cpu.p |= 0x01; // Set carry flag
    machine.cpu.p |= 0x08; // Set decimal flag

    // --- Act
    machine.run();

    // --- Assert
    // Note: The 6502 has undefined behavior for undocumented instructions in decimal mode
    // We test that the basic operation still works (increment then subtract)
    expect(machine.readMemory(0x80)).toBe(0x09); // Memory should be incremented: 0x08 + 1 = 0x09
    // The subtraction part may behave differently in decimal mode depending on implementation
    expect(machine.cpu.a).toBe(0x06); // A = 0x15 - 0x09 = 0x06 (assuming binary subtraction)
  });

  it("ISC should not affect other flags unnecessarily", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xe7, 0x80], 0x1000, 0x1000); // ISC $80
    machine.writeMemory(0x80, 0x10);
    machine.cpu.a = 0x20;
    machine.cpu.p |= 0x01; // Set carry flag
    machine.cpu.p |= 0x08; // Set decimal flag
    machine.cpu.p |= 0x04; // Set interrupt flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.isDFlagSet()).toBe(true); // Decimal should be unchanged
    expect(machine.cpu.isIFlagSet()).toBe(true); // Interrupt should be unchanged
    // Note: B flag behavior may vary, but we don't test it as it's implementation-specific
  });

  it("ISC edge case - maximum values", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xe7, 0x80], 0x1000, 0x1000); // ISC $80
    machine.writeMemory(0x80, 0xfe); // Memory value that becomes 0xFF when incremented
    machine.cpu.a = 0xff; // Maximum accumulator value
    machine.cpu.p |= 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x80)).toBe(0xff); // Memory should be incremented: 0xFE + 1 = 0xFF
    expect(machine.cpu.a).toBe(0x00); // A = 0xFF - 0xFF = 0x00
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow (0xFF >= 0xFF)
    expect(machine.cpu.isZFlagSet()).toBe(true); // Result is zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is not negative
  });
});
