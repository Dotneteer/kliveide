import { describe, it, expect } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";

/**
 * Tests for the SBC undocumented instruction
 *
 * SBC #imm ($EB) is an undocumented duplicate of the official SBC #imm ($E9).
 * It performs exactly the same operation as the documented version:
 * subtract immediate value from accumulator with borrow.
 *
 * Opcodes:
 * - 0xEB: SBC #imm - Subtract immediate from accumulator with borrow (undocumented duplicate)
 */
describe("M6510 Undocumented Instructions - SBC", () => {
  it("SBC #imm undocumented - should work identically to official SBC (0xEB)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xEB, 0x01], 0x1000, 0x1000); // SBC #$01 (undocumented)
    machine.cpu.a = 0x50;
    machine.cpu.p |= 0x01; // Set carry flag (no borrow)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x4F); // 0x50 - 0x01 = 0x4F
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow occurred
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is positive
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.checkedTacts).toBe(2);
  });

  it("SBC #imm undocumented - should work with borrow (carry clear)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xEB, 0x01], 0x1000, 0x1000); // SBC #$01 (undocumented)
    machine.cpu.a = 0x50;
    machine.cpu.p &= ~0x01; // Clear carry flag (borrow will occur)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x4E); // 0x50 - 0x01 - 1 = 0x4E
    expect(machine.cpu.isCFlagSet()).toBe(true); // No final borrow
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is positive
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
  });

  it("SBC #imm undocumented - should result in zero", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xEB, 0x50], 0x1000, 0x1000); // SBC #$50 (undocumented)
    machine.cpu.a = 0x50;
    machine.cpu.p |= 0x01; // Set carry flag (no borrow)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x50 - 0x50 = 0x00
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    expect(machine.cpu.isZFlagSet()).toBe(true); // Result is zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is not negative
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
  });

  it("SBC #imm undocumented - should result in negative", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xEB, 0x60], 0x1000, 0x1000); // SBC #$60 (undocumented)
    machine.cpu.a = 0x50;
    machine.cpu.p |= 0x01; // Set carry flag (no borrow)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0xF0); // 0x50 - 0x60 = 0xF0 (negative)
    expect(machine.cpu.isCFlagSet()).toBe(false); // Borrow occurred
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(true); // Result is negative
    expect(machine.cpu.isVFlagSet()).toBe(false); // No signed overflow
  });

  it("SBC #imm undocumented - should set overflow flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xEB, 0x01], 0x1000, 0x1000); // SBC #$01 (undocumented)
    machine.cpu.a = 0x80; // -128 in signed arithmetic
    machine.cpu.p |= 0x01; // Set carry flag (no borrow)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x7F); // 0x80 - 0x01 = 0x7F
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is positive
    expect(machine.cpu.isVFlagSet()).toBe(true); // Signed overflow: -128 - 1 should be negative but result is positive
  });

  it("SBC #imm undocumented - should handle maximum values", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xEB, 0xFF], 0x1000, 0x1000); // SBC #$FF (undocumented)
    machine.cpu.a = 0xFF;
    machine.cpu.p |= 0x01; // Set carry flag (no borrow)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0xFF - 0xFF = 0x00
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow (0xFF >= 0xFF)
    expect(machine.cpu.isZFlagSet()).toBe(true); // Result is zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is not negative
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
  });

  it("SBC #imm undocumented - should handle minimum values", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xEB, 0x00], 0x1000, 0x1000); // SBC #$00 (undocumented)
    machine.cpu.a = 0x00;
    machine.cpu.p |= 0x01; // Set carry flag (no borrow)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x00 - 0x00 = 0x00
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    expect(machine.cpu.isZFlagSet()).toBe(true); // Result is zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is not negative
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
  });

  it("SBC #imm undocumented - should work in decimal mode", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xEB, 0x01], 0x1000, 0x1000); // SBC #$01 (undocumented)
    machine.cpu.a = 0x09; // BCD 09
    machine.cpu.p |= 0x01; // Set carry flag (no borrow)
    machine.cpu.p |= 0x08; // Set decimal flag

    // --- Act
    machine.run();

    // --- Assert
    // In decimal mode: 09 - 01 = 08
    expect(machine.cpu.a).toBe(0x08); // BCD result
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is positive
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
  });

  it("SBC #imm undocumented - decimal mode with borrow", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xEB, 0x05], 0x1000, 0x1000); // SBC #$05 (undocumented)
    machine.cpu.a = 0x03; // BCD 03
    machine.cpu.p &= ~0x01; // Clear carry flag (borrow will occur)
    machine.cpu.p |= 0x08; // Set decimal flag

    // --- Act
    machine.run();

    // --- Assert
    // In decimal mode: 03 - 05 - 1 = 97 (BCD borrow from next decade)
    expect(machine.cpu.a).toBe(0x97); // BCD result with borrow
    expect(machine.cpu.isCFlagSet()).toBe(false); // Borrow occurred
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(true); // Result has bit 7 set based on binary N flag
  });

  it("SBC #imm undocumented - decimal mode zero result", () => {
    // --- Arrange  
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xEB, 0x05], 0x1000, 0x1000); // SBC #$05 (undocumented)
    machine.cpu.a = 0x05; // BCD 05
    machine.cpu.p |= 0x01; // Set carry flag (no borrow)
    machine.cpu.p |= 0x08; // Set decimal flag

    // --- Act
    machine.run();

    // --- Assert
    // In decimal mode: 05 - 05 = 00
    expect(machine.cpu.a).toBe(0x00); // BCD result
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    expect(machine.cpu.isZFlagSet()).toBe(true); // Result is zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is not negative
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
  });

  it("SBC #imm undocumented - decimal mode large subtraction", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xEB, 0x23], 0x1000, 0x1000); // SBC #$23 (undocumented)
    machine.cpu.a = 0x45; // BCD 45
    machine.cpu.p |= 0x01; // Set carry flag (no borrow)
    machine.cpu.p |= 0x08; // Set decimal flag

    // --- Act
    machine.run();

    // --- Assert
    // In decimal mode: 45 - 23 = 22
    expect(machine.cpu.a).toBe(0x22); // BCD result
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is positive
    expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
  });

  it("SBC #imm undocumented - should not affect unrelated flags", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xEB, 0x10], 0x1000, 0x1000); // SBC #$10 (undocumented)
    machine.cpu.a = 0x20;
    machine.cpu.p |= 0x01; // Set carry flag
    machine.cpu.p |= 0x08; // Set decimal flag
    machine.cpu.p |= 0x04; // Set interrupt flag

    // --- Act
    machine.run();

    // --- Assert
    // In decimal mode: 20 - 10 = 10 (BCD arithmetic)
    expect(machine.cpu.a).toBe(0x10); // BCD result: 20 - 10 = 10
    expect(machine.cpu.isDFlagSet()).toBe(true); // Decimal should be unchanged
    expect(machine.cpu.isIFlagSet()).toBe(true); // Interrupt should be unchanged
    // Note: B flag behavior may vary, but we don't test it as it's implementation-specific
  });

  it("SBC #imm undocumented - comparison with official SBC", () => {
    // This test ensures the undocumented SBC behaves identically to the official one
    
    // Test with official SBC first
    const machine1 = new M6510VaTestMachine(RunMode.OneInstruction);
    machine1.initCode([0xE9, 0x33], 0x1000, 0x1000); // Official SBC #$33
    machine1.cpu.a = 0x77;
    machine1.cpu.p = 0x20; // Set some initial flags
    
    machine1.run();
    
    const officialResult = {
      a: machine1.cpu.a,
      p: machine1.cpu.p,
      tacts: machine1.cpu.tacts
    };
    
    // Test with undocumented SBC
    const machine2 = new M6510VaTestMachine(RunMode.OneInstruction);
    machine2.initCode([0xEB, 0x33], 0x1000, 0x1000); // Undocumented SBC #$33
    machine2.cpu.a = 0x77;
    machine2.cpu.p = 0x20; // Same initial flags
    
    machine2.run();
    
    const undocumentedResult = {
      a: machine2.cpu.a,
      p: machine2.cpu.p,
      tacts: machine2.cpu.tacts
    };
    
    // Results should be identical
    expect(undocumentedResult.a).toBe(officialResult.a);
    expect(undocumentedResult.p).toBe(officialResult.p);
    expect(undocumentedResult.tacts).toBe(officialResult.tacts);
  });
});

describe("M6510 SBC Instructions - Decimal Mode", () => {
  it("SBC immediate - binary mode vs decimal mode comparison", () => {
    // Test binary mode first
    const machine1 = new M6510VaTestMachine(RunMode.OneInstruction);
    machine1.initCode([0xE9, 0x15], 0x1000, 0x1000); // SBC #$15
    machine1.cpu.a = 0x25;
    machine1.cpu.p |= 0x01; // Set carry (no borrow)
    // Decimal flag is clear by default
    
    machine1.run();
    
    const binaryResult = machine1.cpu.a;
    
    // Test decimal mode
    const machine2 = new M6510VaTestMachine(RunMode.OneInstruction);
    machine2.initCode([0xE9, 0x15], 0x1000, 0x1000); // SBC #$15
    machine2.cpu.a = 0x25;
    machine2.cpu.p |= 0x01; // Set carry (no borrow)
    machine2.cpu.p |= 0x08; // Set decimal flag
    
    machine2.run();
    
    const decimalResult = machine2.cpu.a;
    
    // Binary: 0x25 - 0x15 = 0x10
    expect(binaryResult).toBe(0x10);
    // Decimal: 25 - 15 = 10 (BCD)
    expect(decimalResult).toBe(0x10);
    // In this case they're the same, but the algorithm is different
  });

  it("SBC immediate - decimal mode complex subtraction", () => {
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xE9, 0x19], 0x1000, 0x1000); // SBC #$19
    machine.cpu.a = 0x35;
    machine.cpu.p |= 0x01; // Set carry (no borrow)
    machine.cpu.p |= 0x08; // Set decimal flag
    
    machine.run();
    
    // Decimal: 35 - 19 = 16 (BCD)
    expect(machine.cpu.a).toBe(0x16);
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
  });

  it("SBC zero page - decimal mode", () => {
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xE5, 0x80], 0x1000, 0x1000); // SBC $80
    machine.writeMemory(0x80, 0x07); // Store 07 at zero page $80
    machine.cpu.a = 0x12;
    machine.cpu.p |= 0x01; // Set carry (no borrow)
    machine.cpu.p |= 0x08; // Set decimal flag
    
    machine.run();
    
    // Decimal: 12 - 07 = 05 (BCD)
    expect(machine.cpu.a).toBe(0x05);
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
  });

  it("SBC absolute - decimal mode with complex borrow", () => {
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xED, 0x00, 0x30], 0x1000, 0x1000); // SBC $3000
    machine.writeMemory(0x3000, 0x28); // Store 28 at $3000
    machine.cpu.a = 0x15;
    machine.cpu.p &= ~0x01; // Clear carry (borrow will occur)
    machine.cpu.p |= 0x08; // Set decimal flag
    
    machine.run();
    
    // Decimal: 15 - 28 - 1 = 86 (BCD with borrow)
    expect(machine.cpu.a).toBe(0x86);
    expect(machine.cpu.isCFlagSet()).toBe(false); // Borrow occurred
  });

  it("ISC zero page - decimal mode", () => {
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xE7, 0x80], 0x1000, 0x1000); // ISC $80 (undocumented)
    machine.writeMemory(0x80, 0x08); // Store 08 at zero page $80
    machine.cpu.a = 0x15;
    machine.cpu.p |= 0x01; // Set carry (no borrow)
    machine.cpu.p |= 0x08; // Set decimal flag
    
    machine.run();
    
    // First increment: 08 -> 09
    expect(machine.readMemory(0x80)).toBe(0x09);
    // Then subtract: 15 - 09 = 06 (BCD)
    expect(machine.cpu.a).toBe(0x06);
    expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
  });
});
