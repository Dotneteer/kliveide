import { describe, it, expect } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";

/**
 * Tests for the ASR (AND and Shift Right) undocumented instruction
 *
 * ASR performs an AND operation between the accumulator and an immediate value,
 * then shifts the accumulator right one bit (logical shift, bit 7 becomes 0).
 * The carry flag is set to the value of bit 0 before the shift.
 *
 * Opcodes:
 * - 0x4B: ASR #arg - Immediate
 */
describe("M6510 Undocumented Instructions - ASR", () => {
  it("Should perform AND and shift right with carry from bit 0", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x4B, 0xFF], 0x1000, 0x1000); // ASR #$FF
    machine.cpu.a = 0x85; // Binary: 10000101

    // --- Act
    machine.run();

    // --- Assert
    // AND: 0x85 & 0xFF = 0x85
    // Shift right: 0x85 becomes 01000010 = 0x42 (bit 7 becomes 0)
    expect(machine.cpu.a).toBe(0x42);
    expect(machine.cpu.isCFlagSet()).toBe(true); // Bit 0 of AND result was 1
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result has bit 7 clear (logical shift)
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  it("Should clear carry flag when bit 0 is clear", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x4B, 0xFE], 0x1000, 0x1000); // ASR #$FE
    machine.cpu.a = 0x86; // Binary: 10000110

    // --- Act
    machine.run();

    // --- Assert
    // AND: 0x86 & 0xFE = 0x86
    // Shift right: 0x86 becomes 01000011 = 0x43
    expect(machine.cpu.a).toBe(0x43);
    expect(machine.cpu.isCFlagSet()).toBe(false); // Bit 0 of AND result was 0
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result has bit 7 clear
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
  });

  it("Should set zero flag when result is zero", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x4B, 0x00], 0x1000, 0x1000); // ASR #$00
    machine.cpu.a = 0xFF;

    // --- Act
    machine.run();

    // --- Assert
    // AND: 0xFF & 0x00 = 0x00
    // Shift right: 0x00 becomes 0x00
    expect(machine.cpu.a).toBe(0x00);
    expect(machine.cpu.isCFlagSet()).toBe(false); // Bit 0 of AND result was 0
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result is not negative
    expect(machine.cpu.isZFlagSet()).toBe(true); // Result is zero
  });

  it("Should handle single bit shift", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x4B, 0x01], 0x1000, 0x1000); // ASR #$01
    machine.cpu.a = 0xFF;

    // --- Act
    machine.run();

    // --- Assert
    // AND: 0xFF & 0x01 = 0x01
    // Shift right: 0x01 becomes 0x00
    expect(machine.cpu.a).toBe(0x00);
    expect(machine.cpu.isCFlagSet()).toBe(true); // Bit 0 of AND result was 1
    expect(machine.cpu.isZFlagSet()).toBe(true); // Result is zero
  });

  it("Should never set negative flag (logical shift always clears bit 7)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x4B, 0xFF], 0x1000, 0x1000); // ASR #$FF
    machine.cpu.a = 0xFF; // All bits set

    // --- Act
    machine.run();

    // --- Assert
    // AND: 0xFF & 0xFF = 0xFF
    // Shift right: 0xFF becomes 01111111 = 0x7F (bit 7 always becomes 0)
    expect(machine.cpu.a).toBe(0x7F);
    expect(machine.cpu.isCFlagSet()).toBe(true); // Bit 0 was 1
    expect(machine.cpu.isNFlagSet()).toBe(false); // Logical shift never sets negative flag
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
  });

  it("Should not affect other flags besides N, Z, and C", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x4B, 0x42], 0x1000, 0x1000); // ASR #$42
    machine.cpu.a = 0x43;

    // Set all other flags
    machine.cpu.p = 0xFF; // Set all flags
    const expectedOtherFlags = machine.cpu.p & 0x7C; // Preserve I, D, B, V flags

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x21); // (0x43 & 0x42) >> 1 = 0x42 >> 1 = 0x21
    // Only N, Z, and C flags should change, others should remain the same
    expect(machine.cpu.p & 0x7C).toBe(expectedOtherFlags); // Check I, D, B, V flags unchanged
    expect(machine.cpu.isCFlagSet()).toBe(false); // C flag based on bit 0 of AND result
    expect(machine.cpu.isNFlagSet()).toBe(false); // N flag always clear for ASR
    expect(machine.cpu.isZFlagSet()).toBe(false); // Z flag based on result
  });

  it("Should preserve other registers", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x4B, 0x55], 0x1000, 0x1000); // ASR #$55
    machine.cpu.a = 0xAA;
    machine.cpu.x = 0x12;
    machine.cpu.y = 0x34;
    machine.cpu.sp = 0xFE;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // (0xAA & 0x55) >> 1 = 0x00 >> 1 = 0x00
    expect(machine.cpu.x).toBe(0x12); // X unchanged
    expect(machine.cpu.y).toBe(0x34); // Y unchanged
    expect(machine.cpu.sp).toBe(0xFE); // SP unchanged
    expect(machine.cpu.pc).toBe(0x1002); // PC incremented correctly
  });

  describe("ASR AND operation verification", () => {
    const andTestCases = [
      { a: 0xFF, mask: 0xF0, expectedAnd: 0xF0, expectedResult: 0x78, expectedCarry: false },
      { a: 0xFF, mask: 0x0F, expectedAnd: 0x0F, expectedResult: 0x07, expectedCarry: true },
      { a: 0xAA, mask: 0x55, expectedAnd: 0x00, expectedResult: 0x00, expectedCarry: false },
      { a: 0x33, mask: 0xCC, expectedAnd: 0x00, expectedResult: 0x00, expectedCarry: false },
      { a: 0xFF, mask: 0x81, expectedAnd: 0x81, expectedResult: 0x40, expectedCarry: true },
    ];

    andTestCases.forEach(({ a, mask, expectedAnd, expectedResult, expectedCarry }, index) => {
      it(`should perform correct AND operation (case ${index + 1})`, () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x4B, mask], 0x1000, 0x1000);
        machine.cpu.a = a;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(expectedResult);
        expect(machine.cpu.isCFlagSet()).toBe(expectedCarry);
      });
    });
  });

  describe("ASR shift operation verification", () => {
    const shiftTestCases = [
      { andResult: 0x00, expectedShift: 0x00, expectedCarry: false, desc: "zero" },
      { andResult: 0x01, expectedShift: 0x00, expectedCarry: true, desc: "single bit" },
      { andResult: 0x02, expectedShift: 0x01, expectedCarry: false, desc: "even number" },
      { andResult: 0x03, expectedShift: 0x01, expectedCarry: true, desc: "odd number" },
      { andResult: 0xFE, expectedShift: 0x7F, expectedCarry: false, desc: "large even" },
      { andResult: 0xFF, expectedShift: 0x7F, expectedCarry: true, desc: "all bits set" },
      { andResult: 0x80, expectedShift: 0x40, expectedCarry: false, desc: "high bit only" },
      { andResult: 0x42, expectedShift: 0x21, expectedCarry: false, desc: "typical pattern" },
    ];

    shiftTestCases.forEach(({ andResult, expectedShift, expectedCarry, desc }) => {
      it(`should shift ${desc} correctly`, () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x4B, 0xFF], 0x1000, 0x1000); // Use 0xFF to preserve AND result
        machine.cpu.a = andResult;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(expectedShift);
        expect(machine.cpu.isCFlagSet()).toBe(expectedCarry);
      });
    });
  });

  describe("ASR flag behavior verification", () => {
    const flagTestCases = [
      { a: 0xFF, value: 0xFF, expectedN: false, expectedZ: false, expectedC: true, desc: "maximum values" },
      { a: 0x00, value: 0xFF, expectedN: false, expectedZ: true, expectedC: false, desc: "zero accumulator" },
      { a: 0xFF, value: 0x00, expectedN: false, expectedZ: true, expectedC: false, desc: "zero mask" },
      { a: 0x80, value: 0xFF, expectedN: false, expectedZ: false, expectedC: false, desc: "high bit only" },
      { a: 0x01, value: 0xFF, expectedN: false, expectedZ: true, expectedC: true, desc: "low bit only" },
      { a: 0x7E, value: 0xFF, expectedN: false, expectedZ: false, expectedC: false, desc: "positive even" },
      { a: 0x7F, value: 0xFF, expectedN: false, expectedZ: false, expectedC: true, desc: "positive odd" },
    ];

    flagTestCases.forEach(({ a, value, expectedN, expectedZ, expectedC, desc }) => {
      it(`should set flags correctly for ${desc}`, () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x4B, value], 0x1000, 0x1000);
        machine.cpu.a = a;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.isNFlagSet()).toBe(expectedN);
        expect(machine.cpu.isZFlagSet()).toBe(expectedZ);
        expect(machine.cpu.isCFlagSet()).toBe(expectedC);
      });
    });
  });

  describe("ASR comprehensive behavior", () => {
    it("should handle all possible single-bit patterns", () => {
      for (let bit = 0; bit < 8; bit++) {
        const value = 1 << bit;
        
        // Test with full mask
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x4B, 0xFF], 0x1000, 0x1000);
        machine.cpu.a = value;
        
        machine.run();
        
        const expectedResult = value >> 1;
        const expectedCarry = (value & 0x01) !== 0;
        
        expect(machine.cpu.a).toBe(expectedResult);
        expect(machine.cpu.isCFlagSet()).toBe(expectedCarry);
        expect(machine.cpu.isNFlagSet()).toBe(false); // Never negative for ASR
        expect(machine.cpu.isZFlagSet()).toBe(expectedResult === 0);
      }
    });

    it("should handle combined operations correctly", () => {
      const testCases = [
        { a: 0xAB, mask: 0xCD, description: "complex pattern 1" },
        { a: 0x12, mask: 0x34, description: "complex pattern 2" },
        { a: 0xF0, mask: 0x0F, description: "complementary patterns" },
        { a: 0x55, mask: 0xAA, description: "alternating bits" },
      ];

      testCases.forEach(({ a, mask, description }) => {
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x4B, mask], 0x1000, 0x1000);
        machine.cpu.a = a;
        
        machine.run();
        
        const expectedAnd = a & mask;
        const expectedResult = expectedAnd >> 1;
        const expectedCarry = (expectedAnd & 0x01) !== 0;
        
        expect(machine.cpu.a).toBe(expectedResult);
        expect(machine.cpu.isCFlagSet()).toBe(expectedCarry);
        expect(machine.cpu.isNFlagSet()).toBe(false);
        expect(machine.cpu.isZFlagSet()).toBe(expectedResult === 0);
      });
    });
  });

  describe("ASR edge cases", () => {
    it("should handle minimum and maximum values", () => {
      const extremeCases = [
        { a: 0x00, mask: 0x00, desc: "both zero" },
        { a: 0xFF, mask: 0xFF, desc: "both maximum" },
        { a: 0x00, mask: 0xFF, desc: "zero with full mask" },
        { a: 0xFF, mask: 0x00, desc: "maximum with zero mask" },
      ];

      extremeCases.forEach(({ a, mask, desc }) => {
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x4B, mask], 0x1000, 0x1000);
        machine.cpu.a = a;
        
        machine.run();
        
        const expectedAnd = a & mask;
        const expectedResult = expectedAnd >> 1;
        const expectedCarry = (expectedAnd & 0x01) !== 0;
        
        expect(machine.cpu.a).toBe(expectedResult);
        expect(machine.cpu.isCFlagSet()).toBe(expectedCarry);
        expect(machine.cpu.isNFlagSet()).toBe(false);
        expect(machine.cpu.isZFlagSet()).toBe(expectedResult === 0);
      });
    });
  });
});
