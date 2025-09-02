import { describe, it, expect } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";

/**
 * Tests for the AAC (AND with Carry) undocumented instruction
 *
 * AAC performs an AND operation between the accumulator and an immediate value,
 * then sets the carry flag if the result is negative (bit 7 set).
 *
 * Opcodes:
 * - 0x0B: AAC #arg - Immediate
 * - 0x2B: AAC #arg - Immediate (same as 0x0B)
 */
describe("M6510 Undocumented Instructions - AAC", () => {
  it("Should perform AND operation and set carry flag when result is negative (0x0B)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0B, 0xFF], 0x1000, 0x1000); // AAC #$FF
    machine.cpu.a = 0x80; // Set accumulator to have bit 7 set

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0x80 & 0xFF = 0x80
    expect(machine.cpu.isCFlagSet()).toBe(true); // Carry set because result is negative
    expect(machine.cpu.isNFlagSet()).toBe(true); // Negative flag set
    expect(machine.cpu.isZFlagSet()).toBe(false); // Not zero
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  it("Should perform AND operation and clear carry flag when result is positive (0x0B)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0B, 0x7F], 0x1000, 0x1000); // AAC #$7F
    machine.cpu.a = 0xFF; // Set accumulator

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x7F); // 0xFF & 0x7F = 0x7F
    expect(machine.cpu.isCFlagSet()).toBe(false); // Carry clear because result is positive
    expect(machine.cpu.isNFlagSet()).toBe(false); // Negative flag clear
    expect(machine.cpu.isZFlagSet()).toBe(false); // Not zero
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  it("Should set zero flag when result is zero (0x0B)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0B, 0x00], 0x1000, 0x1000); // AAC #$00
    machine.cpu.a = 0xFF; // Set accumulator

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0xFF & 0x00 = 0x00
    expect(machine.cpu.isCFlagSet()).toBe(false); // Carry clear because result is not negative
    expect(machine.cpu.isNFlagSet()).toBe(false); // Negative flag clear
    expect(machine.cpu.isZFlagSet()).toBe(true); // Zero flag set
  });

  it("Should perform AND operation with alternative opcode (0x2B)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x2B, 0xF0], 0x1000, 0x1000); // AAC #$F0
    machine.cpu.a = 0x8F; // Set accumulator

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0x8F & 0xF0 = 0x80
    expect(machine.cpu.isCFlagSet()).toBe(true); // Carry set because result is negative
    expect(machine.cpu.isNFlagSet()).toBe(true); // Negative flag set
    expect(machine.cpu.isZFlagSet()).toBe(false); // Not zero
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  it("Should not affect other flags besides N, Z, and C", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0B, 0x42], 0x1000, 0x1000); // AAC #$42
    machine.cpu.a = 0x43;

    // Set all other flags
    machine.cpu.p = 0xFF; // Set all flags
    const expectedOtherFlags = machine.cpu.p & 0x7C; // Preserve I, D, B, V flags

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x42); // 0x43 & 0x42 = 0x42
    // Only N, Z, and C flags should change, others should remain the same
    expect(machine.cpu.p & 0x7C).toBe(expectedOtherFlags); // Check I, D, B, V flags unchanged
    expect(machine.cpu.isCFlagSet()).toBe(false); // C flag based on result
    expect(machine.cpu.isNFlagSet()).toBe(false); // N flag based on result
    expect(machine.cpu.isZFlagSet()).toBe(false); // Z flag based on result
  });

  it("Should preserve other registers", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0B, 0x55], 0x1000, 0x1000); // AAC #$55
    machine.cpu.a = 0xAA;
    machine.cpu.x = 0x12;
    machine.cpu.y = 0x34;
    machine.cpu.sp = 0xFE;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0xAA & 0x55 = 0x00
    expect(machine.cpu.x).toBe(0x12); // X unchanged
    expect(machine.cpu.y).toBe(0x34); // Y unchanged
    expect(machine.cpu.sp).toBe(0xFE); // SP unchanged
    expect(machine.cpu.pc).toBe(0x1002); // PC incremented correctly
  });

  describe("AAC flag behavior verification", () => {
    const testCases = [
      { a: 0xFF, value: 0x80, expectedResult: 0x80, expectedC: true, expectedN: true, expectedZ: false, desc: "negative result" },
      { a: 0xFF, value: 0x7F, expectedResult: 0x7F, expectedC: false, expectedN: false, expectedZ: false, desc: "positive result" },
      { a: 0xFF, value: 0x00, expectedResult: 0x00, expectedC: false, expectedN: false, expectedZ: true, desc: "zero result" },
      { a: 0x0F, value: 0xF0, expectedResult: 0x00, expectedC: false, expectedN: false, expectedZ: true, desc: "zero from non-zero inputs" },
      { a: 0x81, value: 0x81, expectedResult: 0x81, expectedC: true, expectedN: true, expectedZ: false, desc: "negative with bit pattern" },
      { a: 0x7E, value: 0x7E, expectedResult: 0x7E, expectedC: false, expectedN: false, expectedZ: false, desc: "positive maximum" },
      { a: 0x80, value: 0x80, expectedResult: 0x80, expectedC: true, expectedN: true, expectedZ: false, desc: "negative minimum" },
    ];

    testCases.forEach(({ a, value, expectedResult, expectedC, expectedN, expectedZ, desc }) => {
      it(`should handle ${desc} (A=$${a.toString(16).padStart(2, '0').toUpperCase()}, value=$${value.toString(16).padStart(2, '0').toUpperCase()})`, () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x0B, value], 0x1000, 0x1000); // AAC #value
        machine.cpu.a = a;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(expectedResult);
        expect(machine.cpu.isCFlagSet()).toBe(expectedC);
        expect(machine.cpu.isNFlagSet()).toBe(expectedN);
        expect(machine.cpu.isZFlagSet()).toBe(expectedZ);
      });
    });
  });

  describe("AAC opcode equivalence", () => {
    it("should behave identically for both opcodes 0x0B and 0x2B", () => {
      const testValues = [0x00, 0x7F, 0x80, 0xFF, 0x42, 0xAA, 0x55];
      const testAccumulators = [0x00, 0x7F, 0x80, 0xFF, 0x33, 0xCC];

      testValues.forEach(value => {
        testAccumulators.forEach(accValue => {
          // Test with 0x0B
          const machine1 = new M6510VaTestMachine(RunMode.OneInstruction);
          machine1.initCode([0x0B, value], 0x1000, 0x1000);
          machine1.cpu.a = accValue;
          machine1.run();

          // Test with 0x2B
          const machine2 = new M6510VaTestMachine(RunMode.OneInstruction);
          machine2.initCode([0x2B, value], 0x1000, 0x1000);
          machine2.cpu.a = accValue;
          machine2.run();

          // Both should produce identical results
          expect(machine2.cpu.a).toBe(machine1.cpu.a);
          expect(machine2.cpu.isCFlagSet()).toBe(machine1.cpu.isCFlagSet());
          expect(machine2.cpu.isNFlagSet()).toBe(machine1.cpu.isNFlagSet());
          expect(machine2.cpu.isZFlagSet()).toBe(machine1.cpu.isZFlagSet());
          expect(machine2.cpu.tacts).toBe(machine1.cpu.tacts);
        });
      });
    });
  });

  describe("AAC carry flag specific behavior", () => {
    it("should set carry flag only when bit 7 is set in result", () => {
      const testCases = [
        { a: 0xFF, value: 0x80, expectedCarry: true },   // Bit 7 set in result
        { a: 0xFF, value: 0x7F, expectedCarry: false },  // Bit 7 clear in result
        { a: 0x80, value: 0xFF, expectedCarry: true },   // Bit 7 set in result
        { a: 0x7F, value: 0xFF, expectedCarry: false },  // Bit 7 clear in result
        { a: 0x00, value: 0xFF, expectedCarry: false },  // Zero result
      ];

      testCases.forEach(({ a, value, expectedCarry }, index) => {
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x0B, value], 0x1000, 0x1000);
        machine.cpu.a = a;
        
        machine.run();
        
        expect(machine.cpu.isCFlagSet()).toBe(expectedCarry);
      });
    });
  });
});
