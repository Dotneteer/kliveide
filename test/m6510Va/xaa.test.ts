import { describe, it, expect } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";

/**
 * Tests for the XAA (ANE) undocumented instruction
 *
 * XAA is an unstable instruction with complex behavior.
 * A common implementation: A = (A | CONST) & X & operand
 * Where CONST is typically 0xEE, 0xEF, or 0xFF depending on the specific chip.
 * 
 * This implementation uses CONST = 0xEE for consistency.
 *
 * Opcodes:
 * - 0x8B: XAA #arg - Immediate
 */
describe("M6510 Undocumented Instructions - XAA", () => {
  it("XAA #imm - should perform (A | 0xEE) & X & operand (0x8B)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x8B, 0xFF], 0x1000, 0x1000); // XAA #$FF
    machine.cpu.a = 0x00;
    machine.cpu.x = 0x55;
    
    // --- Act
    machine.run();

    // --- Assert
    // Result should be (A | 0xEE) & X & operand = (0x00 | 0xEE) & 0x55 & 0xFF = 0xEE & 0x55 & 0xFF = 0x44
    expect(machine.cpu.a).toBe(0x44);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  it("XAA #imm - should set Zero flag when result is zero", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x8B, 0x00], 0x1000, 0x1000); // XAA #$00
    machine.cpu.a = 0x00;
    machine.cpu.x = 0xFF;
    
    // Clear flags initially
    machine.cpu.p = 0x00;

    // --- Act
    machine.run();

    // --- Assert
    // Result should be (A | 0xEE) & X & operand = (0x00 | 0xEE) & 0xFF & 0x00 = 0x00
    expect(machine.cpu.a).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
  });

  it("XAA #imm - should set Negative flag when bit 7 is set", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x8B, 0xFF], 0x1000, 0x1000); // XAA #$FF
    machine.cpu.a = 0x11;
    machine.cpu.x = 0xFF;
    
    // Clear flags initially
    machine.cpu.p = 0x00;

    // --- Act
    machine.run();

    // --- Assert
    // Result should be (A | 0xEE) & X & operand = (0x11 | 0xEE) & 0xFF & 0xFF = 0xFF & 0xFF & 0xFF = 0xFF
    expect(machine.cpu.a).toBe(0xFF);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.isZFlagSet()).toBe(false);
  });

  it("XAA #imm - should clear N and Z flags when result is positive non-zero", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x8B, 0x7F], 0x1000, 0x1000); // XAA #$7F
    machine.cpu.a = 0x01;
    machine.cpu.x = 0x7F;
    
    // Set flags initially
    machine.cpu.p = 0xFF;

    // --- Act
    machine.run();

    // --- Assert
    // Result should be (A | 0xEE) & X & operand = (0x01 | 0xEE) & 0x7F & 0x7F = 0xEF & 0x7F & 0x7F = 0x6F
    expect(machine.cpu.a).toBe(0x6F);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isZFlagSet()).toBe(false);
  });

  it("XAA #imm - should not affect X register", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x8B, 0xAA], 0x1000, 0x1000); // XAA #$AA
    machine.cpu.a = 0x33;
    machine.cpu.x = 0xCC;
    
    const initialX = machine.cpu.x;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(initialX); // X should be unchanged
  });

  it("XAA #imm - should not affect Y register or stack pointer", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x8B, 0x77], 0x1000, 0x1000); // XAA #$77
    machine.cpu.a = 0x88;
    machine.cpu.x = 0x99;
    machine.cpu.y = 0xBB;
    machine.cpu.sp = 0xDD;
    
    const initialY = machine.cpu.y;
    const initialSp = machine.cpu.sp;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(initialY);
    expect(machine.cpu.sp).toBe(initialSp);
  });

  it("XAA #imm - magic constant behavior test", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x8B, 0x11], 0x1000, 0x1000); // XAA #$11
    machine.cpu.a = 0x00; // Starting with A = 0 to clearly see the magic constant effect
    machine.cpu.x = 0xFF; // X = all bits set to see full effect
    
    // --- Act
    machine.run();

    // --- Assert
    // Result should be (A | 0xEE) & X & operand = (0x00 | 0xEE) & 0xFF & 0x11 = 0xEE & 0xFF & 0x11 = 0x00
    expect(machine.cpu.a).toBe(0x00);
  });

  it("XAA #imm - bit pattern interaction test", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x8B, 0x55], 0x1000, 0x1000); // XAA #$55 (01010101)
    machine.cpu.a = 0x10; // 00010000
    machine.cpu.x = 0xAA; // 10101010
    
    // --- Act
    machine.run();

    // --- Assert
    // Result should be (A | 0xEE) & X & operand
    // (0x10 | 0xEE) & 0xAA & 0x55 = 0xFE & 0xAA & 0x55 = 0xAA & 0x55 = 0x00
    expect(machine.cpu.a).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
  });

  it("XAA #imm - should not affect other processor flags", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x8B, 0x42], 0x1000, 0x1000); // XAA #$42
    machine.cpu.a = 0x01;
    machine.cpu.x = 0x43;
    
    // Set specific flags (not N/Z which will be affected)
    machine.cpu.p = 0x7D; // Set V, B, D, I, C flags but clear N, Z

    // --- Act
    machine.run();

    // --- Assert
    // Only N and Z flags should be affected, others should remain
    expect(machine.cpu.isVFlagSet()).toBe(true);  // V should remain set
    expect(machine.cpu.isBFlagSet()).toBe(true);  // B should remain set
    expect(machine.cpu.isDFlagSet()).toBe(true);  // D should remain set
    expect(machine.cpu.isIFlagSet()).toBe(true);  // I should remain set
    expect(machine.cpu.isCFlagSet()).toBe(true);  // C should remain set
  });

  it("XAA #imm - edge case with A = 0xFF", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x8B, 0x80], 0x1000, 0x1000); // XAA #$80
    machine.cpu.a = 0xFF;
    machine.cpu.x = 0x80;
    
    // --- Act
    machine.run();

    // --- Assert
    // Result should be (A | 0xEE) & X & operand = (0xFF | 0xEE) & 0x80 & 0x80 = 0xFF & 0x80 & 0x80 = 0x80
    expect(machine.cpu.a).toBe(0x80);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.isZFlagSet()).toBe(false);
  });

  it("XAA #imm - multiple operations to verify consistency", () => {
    // Test the same operation multiple times to ensure consistent behavior
    const testCases = [
      { a: 0x00, x: 0x55, operand: 0xAA, expected: 0x00 },
      { a: 0x11, x: 0xFF, operand: 0xFF, expected: 0xFF },
      { a: 0x80, x: 0x7F, operand: 0x6E, expected: 0x6E }
    ];
    
    for (const testCase of testCases) {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x8B, testCase.operand], 0x1000, 0x1000);
      machine.cpu.a = testCase.a;
      machine.cpu.x = testCase.x;
      
      // --- Act
      machine.run();
      
      // --- Assert
      expect(machine.cpu.a).toBe(testCase.expected);
      expect(machine.cpu.pc).toBe(0x1002);
      expect(machine.cpu.tacts).toBe(2);
    }
  });
});
