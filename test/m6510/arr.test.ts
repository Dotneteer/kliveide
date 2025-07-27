import { describe, it, expect } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

/**
 * Tests for the ARR (AND and Rotate Right) undocumented instruction
 *
 * ARR performs an AND operation between the accumulator and an immediate value,
 * then rotates the accumulator right one bit (including carry), followed by
 * specific flag behavior based on the VICE implementation:
 * - C flag is set based on bit 6 of the result
 * - V flag is set based on (bit 6 XOR bit 5) of the result
 * - N and Z flags are set normally based on the result
 *
 * Opcodes:
 * - 0x6B: ARR #arg - Immediate
 */
describe("M6510 Undocumented Instructions - ARR", () => {
  it("Should perform AND and rotate right with carry", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x6B, 0xFF], 0x1000, 0x1000); // ARR #$FF
    machine.cpu.a = 0x81; // Binary: 10000001
    machine.cpu.p |= 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    // AND: 0x81 & 0xFF = 0x81
    // Include carry in bit 8: 0x81 | (1 << 8) = 0x181
    // Rotate right: 0x181 >> 1 = 0xC0 (11000000)
    expect(machine.cpu.a).toBe(0xC0);
    expect(machine.cpu.isCFlagSet()).toBe(true); // Bit 6 (0x40) is set in 0xC0
    expect(machine.cpu.isVFlagSet()).toBe(true); // Bit 6 = 1, Bit 5 = 0, XOR = 1
    expect(machine.cpu.isNFlagSet()).toBe(true); // Result has bit 7 set
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  it("Should perform AND and rotate right without carry", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x6B, 0xFE], 0x1000, 0x1000); // ARR #$FE
    machine.cpu.a = 0x82; // Binary: 10000010
    machine.cpu.p &= ~0x01; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    // AND: 0x82 & 0xFE = 0x82
    // Include carry in bit 8: 0x82 | (0 << 8) = 0x82
    // Rotate right: 0x82 >> 1 = 0x41 (01000001)
    expect(machine.cpu.a).toBe(0x41);
    expect(machine.cpu.isCFlagSet()).toBe(true); // Bit 6 (0x40) is set in 0x41
    expect(machine.cpu.isVFlagSet()).toBe(true); // Bit 6 = 1, Bit 5 = 0, XOR = 1
    expect(machine.cpu.isNFlagSet()).toBe(false); // Result has bit 7 clear
    expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
  });

  it("Should set zero flag when result is zero", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x6B, 0x00], 0x1000, 0x1000); // ARR #$00
    machine.cpu.a = 0xFF;
    machine.cpu.p &= ~0x01; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    // AND: 0xFF & 0x00 = 0x00
    // Include carry in bit 8: 0x00 | (0 << 8) = 0x00
    // Rotate right: 0x00 >> 1 = 0x00
    expect(machine.cpu.a).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false); // Bit 6 is clear in 0x00
    expect(machine.cpu.isVFlagSet()).toBe(false); // Bit 6 = 0, Bit 5 = 0, XOR = 0
  });

  describe("ARR flag behavior based on VICE implementation", () => {
    it("should set C when bit 6 is set, clear V when bits 5 and 6 are both set", () => {
      // --- Arrange
      const machine = new M6510TestMachine(RunMode.OneInstruction);
      machine.initCode([0x6B, 0xFF], 0x1000, 0x1000); // ARR #$FF
      machine.cpu.a = 0xE0; // Will become 0x70 after rotate
      machine.cpu.p &= ~0x01; // Clear carry flag

      // --- Act
      machine.run();

      // --- Assert
      // AND: 0xE0 & 0xFF = 0xE0
      // Rotate right: 0xE0 >> 1 = 0x70 (01110000)
      expect(machine.cpu.a).toBe(0x70);
      expect(machine.cpu.isCFlagSet()).toBe(true); // Bit 6 (0x40) is set
      expect(machine.cpu.isVFlagSet()).toBe(false); // Bit 6 = 1, Bit 5 = 1, XOR = 0
    });

    it("should clear C and V when both bits 5 and 6 are clear", () => {
      // --- Arrange
      const machine = new M6510TestMachine(RunMode.OneInstruction);
      machine.initCode([0x6B, 0xFF], 0x1000, 0x1000); // ARR #$FF
      machine.cpu.a = 0x1E; // Will become 0x0F after rotate
      machine.cpu.p &= ~0x01; // Clear carry flag

      // --- Act
      machine.run();

      // --- Assert
      // AND: 0x1E & 0xFF = 0x1E
      // Rotate right: 0x1E >> 1 = 0x0F (00001111)
      expect(machine.cpu.a).toBe(0x0F);
      expect(machine.cpu.isCFlagSet()).toBe(false); // Bit 6 (0x40) is clear
      expect(machine.cpu.isVFlagSet()).toBe(false); // Bit 6 = 0, Bit 5 = 0, XOR = 0
    });

    it("should clear C and set V when only bit 5 is set", () => {
      // --- Arrange
      const machine = new M6510TestMachine(RunMode.OneInstruction);
      machine.initCode([0x6B, 0xFF], 0x1000, 0x1000); // ARR #$FF
      machine.cpu.a = 0x60; // Will become 0x30 after rotate
      machine.cpu.p &= ~0x01; // Clear carry flag

      // --- Act
      machine.run();

      // --- Assert
      // AND: 0x60 & 0xFF = 0x60
      // Rotate right: 0x60 >> 1 = 0x30 (00110000)
      expect(machine.cpu.a).toBe(0x30);
      expect(machine.cpu.isCFlagSet()).toBe(false); // Bit 6 (0x40) is clear
      expect(machine.cpu.isVFlagSet()).toBe(true); // Bit 6 = 0, Bit 5 = 1, XOR = 1
    });

    it("should set C and V when only bit 6 is set", () => {
      // --- Arrange
      const machine = new M6510TestMachine(RunMode.OneInstruction);
      machine.initCode([0x6B, 0xFF], 0x1000, 0x1000); // ARR #$FF
      machine.cpu.a = 0x80; // Will become 0x40 after rotate
      machine.cpu.p &= ~0x01; // Clear carry flag

      // --- Act
      machine.run();

      // --- Assert
      // AND: 0x80 & 0xFF = 0x80
      // Rotate right: 0x80 >> 1 = 0x40 (01000000)
      expect(machine.cpu.a).toBe(0x40);
      expect(machine.cpu.isCFlagSet()).toBe(true); // Bit 6 (0x40) is set
      expect(machine.cpu.isVFlagSet()).toBe(true); // Bit 6 = 1, Bit 5 = 0, XOR = 1
    });
  });

  it("Should preserve other registers", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x6B, 0x55], 0x1000, 0x1000); // ARR #$55
    machine.cpu.a = 0xAA;
    machine.cpu.x = 0x12;
    machine.cpu.y = 0x34;
    machine.cpu.sp = 0xFE;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x12); // X unchanged
    expect(machine.cpu.y).toBe(0x34); // Y unchanged
    expect(machine.cpu.sp).toBe(0xFE); // SP unchanged
    expect(machine.cpu.pc).toBe(0x1002); // PC incremented correctly
  });

  describe("ARR rotation behavior verification", () => {
    const testCases = [
      {
        desc: "rotate with carry set",
        a: 0x42, // 01000010
        value: 0xFF,
        carryIn: true,
        expectedResult: 0xA1, // Include carry: 0x142 >> 1 = 0xA1
        expectedCarryOut: true, // Bit 6 (0x40) is set in 0xA1
        expectedV: true, // VICE: (0x00) ^ (0x20 << 1) = 0x00 ^ 0x40 = 0x40
      },
      {
        desc: "rotate with carry clear",
        a: 0x43, // 01000011
        value: 0xFF,
        carryIn: false,
        expectedResult: 0x21, // 0x43 >> 1 = 0x21
        expectedCarryOut: false, // Bit 6 (0x40) is clear in 0x21
        expectedV: true, // VICE: (0x00) ^ (0x20 << 1) = 0x00 ^ 0x40 = 0x40
      },
      {
        desc: "rotate odd number with carry set",
        a: 0x85, // 10000101
        value: 0xFF,
        carryIn: true,
        expectedResult: 0xC2, // Include carry: 0x185 >> 1 = 0xC2
        expectedCarryOut: true, // Bit 6 (0x40) is set in 0xC2
        expectedV: true, // VICE: (0x40) ^ (0x00 << 1) = 0x40 ^ 0x00 = 0x40
      },
    ];

    it("should handle rotate with carry set", () => {
      // --- Arrange
      const machine = new M6510TestMachine(RunMode.OneInstruction);
      machine.initCode([0x6B, 0xFF], 0x1000, 0x1000);
      machine.cpu.a = 0x42;
      machine.cpu.p |= 0x01; // Set carry

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0xA1);
      expect(machine.cpu.isCFlagSet()).toBe(false); // Bit 6 is clear in 0xA1
      expect(machine.cpu.isVFlagSet()).toBe(true);
    });

    it("should handle rotate with carry clear", () => {
      // --- Arrange
      const machine = new M6510TestMachine(RunMode.OneInstruction);
      machine.initCode([0x6B, 0xFF], 0x1000, 0x1000);
      machine.cpu.a = 0x43;
      machine.cpu.p &= ~0x01; // Clear carry

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x21);
      expect(machine.cpu.isCFlagSet()).toBe(false);
      expect(machine.cpu.isVFlagSet()).toBe(true);
    });

    it("should handle rotate odd number with carry set", () => {
      // --- Arrange
      const machine = new M6510TestMachine(RunMode.OneInstruction);
      machine.initCode([0x6B, 0xFF], 0x1000, 0x1000);
      machine.cpu.a = 0x85;
      machine.cpu.p |= 0x01; // Set carry

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0xC2);
      expect(machine.cpu.isCFlagSet()).toBe(true);
      expect(machine.cpu.isVFlagSet()).toBe(true);
    });
  });

  describe("ARR AND operation verification", () => {
    it("should perform AND before rotation", () => {
      // --- Arrange
      const machine = new M6510TestMachine(RunMode.OneInstruction);
      machine.initCode([0x6B, 0x0F], 0x1000, 0x1000); // ARR #$0F (mask lower 4 bits)
      machine.cpu.a = 0xF8; // 11111000
      machine.cpu.p &= ~0x01; // Clear carry

      // --- Act
      machine.run();

      // --- Assert
      // AND: 0xF8 & 0x0F = 0x08
      // Rotate right: 0x08 >> 1 = 0x04
      expect(machine.cpu.a).toBe(0x04);
      expect(machine.cpu.isCFlagSet()).toBe(false); // Bit 6 (0x40) is clear in 0x04
      expect(machine.cpu.isVFlagSet()).toBe(false); // Bit 6 = 0, Bit 5 = 0, XOR = 0
    });
  });

  describe("ARR comprehensive flag testing", () => {
    const flagTestCases = [
      {
        desc: "result with bit 6 and 5 both clear",
        a: 0x1C, // Will become 0x0E after rotation
        value: 0xFF,
        carryIn: false,
        expectedN: false,
        expectedZ: false,
        expectedC: false, // Bit 6 clear
        expectedV: false, // Bit 6 = 0, Bit 5 = 0, XOR = 0
      },
      {
        desc: "result with only bit 5 set",
        a: 0x60, // Will become 0x30 after rotation
        value: 0xFF,
        carryIn: false,
        expectedN: false,
        expectedZ: false,
        expectedC: false, // Bit 6 clear
        expectedV: true, // Bit 6 = 0, Bit 5 = 1, XOR = 1
      },
      {
        desc: "result with only bit 6 set",
        a: 0x80, // Will become 0x40 after rotation
        value: 0xFF,
        carryIn: false,
        expectedN: false,
        expectedZ: false,
        expectedC: true, // Bit 6 set
        expectedV: true, // Bit 6 = 1, Bit 5 = 0, XOR = 1
      },
      {
        desc: "result with both bits 5 and 6 set",
        a: 0xE0, // Will become 0x70 after rotation
        value: 0xFF,
        carryIn: false,
        expectedN: false,
        expectedZ: false,
        expectedC: true, // Bit 6 set
        expectedV: false, // Bit 6 = 1, Bit 5 = 1, XOR = 0
      },
      {
        desc: "zero result",
        a: 0x00,
        value: 0xFF,
        carryIn: false,
        expectedN: false,
        expectedZ: true,
        expectedC: false, // Bit 6 clear
        expectedV: false, // Bit 6 = 0, Bit 5 = 0, XOR = 0
      },
      {
        desc: "negative result with carry rotation",
        a: 0x40,
        value: 0xFF,
        carryIn: true,
        expectedN: true, // Result will have bit 7 set due to carry rotation
        expectedZ: false,
        expectedC: false, // Bit 6 clear in result 0xA0
        expectedV: true, // VICE: (0x00) ^ (0x20 << 1) = 0x00 ^ 0x40 = 0x40
      },
    ];

    flagTestCases.forEach(({ desc, a, value, carryIn, expectedN, expectedZ, expectedC, expectedV }) => {
      it(`should set flags correctly for ${desc}`, () => {
        // --- Arrange
        const machine = new M6510TestMachine(RunMode.OneInstruction);
        machine.initCode([0x6B, value], 0x1000, 0x1000);
        machine.cpu.a = a;
        if (carryIn) {
          machine.cpu.p |= 0x01;
        } else {
          machine.cpu.p &= ~0x01;
        }

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.isNFlagSet()).toBe(expectedN);
        expect(machine.cpu.isZFlagSet()).toBe(expectedZ);
        expect(machine.cpu.isCFlagSet()).toBe(expectedC);
        expect(machine.cpu.isVFlagSet()).toBe(expectedV);
      });
    });
  });

  describe("ARR edge cases", () => {
    it("should handle all bits set", () => {
      // --- Arrange
      const machine = new M6510TestMachine(RunMode.OneInstruction);
      machine.initCode([0x6B, 0xFF], 0x1000, 0x1000);
      machine.cpu.a = 0xFF;
      machine.cpu.p |= 0x01; // Set carry

      // --- Act
      machine.run();

      // --- Assert
      // AND: 0xFF & 0xFF = 0xFF
      // Include carry: 0xFF | (1 << 8) = 0x1FF
      // Rotate right: 0x1FF >> 1 = 0xFF
      expect(machine.cpu.a).toBe(0xFF);
      expect(machine.cpu.isCFlagSet()).toBe(true); // Bit 6 is set in 0xFF
      expect(machine.cpu.isVFlagSet()).toBe(false); // Bit 6 = 1, Bit 5 = 1, XOR = 0
      expect(machine.cpu.isNFlagSet()).toBe(true); // Result is negative
      expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
    });

    it("should handle minimal AND mask", () => {
      // --- Arrange
      const machine = new M6510TestMachine(RunMode.OneInstruction);
      machine.initCode([0x6B, 0x01], 0x1000, 0x1000);
      machine.cpu.a = 0xFF;
      machine.cpu.p &= ~0x01; // Clear carry

      // --- Act
      machine.run();

      // --- Assert
      // AND: 0xFF & 0x01 = 0x01
      // Rotate right: 0x01 >> 1 = 0x00
      expect(machine.cpu.a).toBe(0x00);
      expect(machine.cpu.isCFlagSet()).toBe(false); // Bit 6 is clear in 0x00
      expect(machine.cpu.isVFlagSet()).toBe(false); // Bit 6 = 0, Bit 5 = 0, XOR = 0
      expect(machine.cpu.isZFlagSet()).toBe(true); // Result is zero
    });
  });
});
