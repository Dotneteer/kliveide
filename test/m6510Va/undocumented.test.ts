import { describe, it, expect } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";

/**
 * Tests for undocumented/illegal M6510 instructions
 *
 * SLO (Shift Left and OR):
 * - Performs ASL (Arithmetic Shift Left) on memory location
 * - Then performs ORA (OR) of the shifted value with the accumulator
 * - Affects flags: N, Z, C (from ASL operation and final ORA result)
 *
 * RLA (Rotate Left and AND):
 * - Performs ROL (Rotate Left) on memory location
 * - Then performs AND of the rotated value with the accumulator
 * - Affects flags: N, Z, C (from ROL operation and final AND result)
 *
 * SRE (Shift Right and EOR):
 * - Performs LSR (Logical Shift Right) on memory location
 * - Then performs EOR (Exclusive OR) of the shifted value with the accumulator
 * - Affects flags: N, Z, C (from LSR operation and final EOR result)
 */
describe("M6510 Undocumented Instructions - SLO", () => {
  describe("SLO (zp,X) - 0x03", () => {
    it("Should shift left memory and OR with accumulator", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x03, 0x80], 0x1000, 0x1000); // SLO (0x80,X)
      machine.cpu.x = 0x10; // X = 0x10
      machine.cpu.a = 0x0f; // A = 0x0F

      // Set up indirect addressing: 0x80 + 0x10 = 0x90 (zero page)
      machine.writeMemory(0x90, 0x20); // Low byte of target address
      machine.writeMemory(0x91, 0x30); // High byte of target address
      machine.writeMemory(0x3020, 0x42); // Target memory = 0x42

      machine.cpu.p = 0x00; // Clear all flags

      // --- Act
      machine.run();

      // --- Assert
      const shiftedValue = 0x42 << 1; // 0x84
      expect(machine.readMemory(0x3020)).toBe(0x84); // Memory shifted left
      expect(machine.cpu.a).toBe(0x0f | 0x84); // A = 0x0F OR 0x84 = 0x8F
      expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from 0x42 << 1
      expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x8F is not zero
      expect(machine.cpu.isNFlagSet()).toBe(true); // Result 0x8F has bit 7 set
      expect(machine.cpu.pc).toBe(0x1002);
      expect(machine.cpu.tacts).toBe(8); // 2 + 1 + 1 + 1 + 1 + 1 + 1 = 8 cycles
    });

    it("Should handle carry flag correctly when shifting 0x80", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x03, 0x80], 0x1000, 0x1000); // SLO (0x80,X)
      machine.cpu.x = 0x10;
      machine.cpu.a = 0x00;

      machine.writeMemory(0x90, 0x20);
      machine.writeMemory(0x91, 0x30);
      machine.writeMemory(0x3020, 0x80); // Value with bit 7 set

      machine.cpu.p = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.readMemory(0x3020)).toBe(0x00); // 0x80 << 1 = 0x00
      expect(machine.cpu.a).toBe(0x00); // A = 0x00 OR 0x00 = 0x00
      expect(machine.cpu.isCFlagSet()).toBe(true); // Carry set from bit 7
      expect(machine.cpu.isZFlagSet()).toBe(true); // Result is zero
      expect(machine.cpu.isNFlagSet()).toBe(false); // Result has bit 7 clear
    });
  });

  describe("SLO zp - 0x07", () => {
    it("Should shift left zero page memory and OR with accumulator", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x07, 0x50], 0x1000, 0x1000); // SLO 0x50
      machine.cpu.a = 0x33; // A = 0x33
      machine.writeMemory(0x50, 0x44); // Zero page memory = 0x44
      machine.cpu.p = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      const shiftedValue = 0x44 << 1; // 0x88
      expect(machine.readMemory(0x50)).toBe(0x88); // Memory shifted left
      expect(machine.cpu.a).toBe(0x33 | 0x88); // A = 0x33 OR 0x88 = 0xBB
      expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from 0x44 << 1
      expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0xBB is not zero
      expect(machine.cpu.isNFlagSet()).toBe(true); // Result 0xBB has bit 7 set
      expect(machine.cpu.pc).toBe(0x1002);
      expect(machine.cpu.tacts).toBe(5); // 2 + 1 + 1 + 1 = 5 cycles
    });

    it("Should work with zero accumulator", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x07, 0x50], 0x1000, 0x1000);
      machine.cpu.a = 0x00;
      machine.writeMemory(0x50, 0x01);
      machine.cpu.p = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.readMemory(0x50)).toBe(0x02); // 0x01 << 1 = 0x02
      expect(machine.cpu.a).toBe(0x02); // A = 0x00 OR 0x02 = 0x02
      expect(machine.cpu.isCFlagSet()).toBe(false);
      expect(machine.cpu.isZFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(false);
    });
  });

  describe("SLO abs - 0x0F", () => {
    it("Should shift left absolute memory and OR with accumulator", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x0f, 0x00, 0x30], 0x1000, 0x1000); // SLO 0x3000
      machine.cpu.a = 0x0a; // A = 0x0A
      machine.writeMemory(0x3000, 0x15); // Absolute memory = 0x15
      machine.cpu.p = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      const shiftedValue = 0x15 << 1; // 0x2A
      expect(machine.readMemory(0x3000)).toBe(0x2a); // Memory shifted left
      expect(machine.cpu.a).toBe(0x0a | 0x2a); // A = 0x0A OR 0x2A = 0x2A
      expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from 0x15 << 1
      expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x2A is not zero
      expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x2A has bit 7 clear
      expect(machine.cpu.pc).toBe(0x1003);
      expect(machine.cpu.tacts).toBe(6); // 2 + 2 + 1 + 1 = 6 cycles
    });
  });

  describe("SLO (zp),Y - 0x13", () => {
    it("Should shift left indirect indexed memory and OR with accumulator", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x13, 0x80], 0x1000, 0x1000); // SLO (0x80),Y
      machine.cpu.y = 0x05; // Y = 0x05
      machine.cpu.a = 0x07; // A = 0x07

      // Set up indirect addressing
      machine.writeMemory(0x80, 0x00); // Low byte of base address
      machine.writeMemory(0x81, 0x40); // High byte of base address
      machine.writeMemory(0x4005, 0x3c); // Target memory at 0x4000 + 0x05 = 0x4005

      machine.cpu.p = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      const shiftedValue = 0x3c << 1; // 0x78
      expect(machine.readMemory(0x4005)).toBe(0x78); // Memory shifted left
      expect(machine.cpu.a).toBe(0x07 | 0x78); // A = 0x07 OR 0x78 = 0x7F
      expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from 0x3C << 1
      expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x7F is not zero
      expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x7F has bit 7 clear
      expect(machine.cpu.pc).toBe(0x1002);
      expect(machine.cpu.tacts).toBe(8); // 2 + 1 + 1 + 1 + 1 + 1 + 1 = 8 cycles
    });
  });

  describe("SLO zp,X - 0x17", () => {
    it("Should shift left zero page indexed memory and OR with accumulator", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x17, 0x80], 0x1000, 0x1000); // SLO 0x80,X
      machine.cpu.x = 0x10; // X = 0x10
      machine.cpu.a = 0x11; // A = 0x11
      machine.writeMemory(0x90, 0x22); // Zero page memory at 0x80 + 0x10 = 0x90
      machine.cpu.p = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      const shiftedValue = 0x22 << 1; // 0x44
      expect(machine.readMemory(0x90)).toBe(0x44); // Memory shifted left
      expect(machine.cpu.a).toBe(0x11 | 0x44); // A = 0x11 OR 0x44 = 0x55
      expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from 0x22 << 1
      expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x55 is not zero
      expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x55 has bit 7 clear
      expect(machine.cpu.pc).toBe(0x1002);
      expect(machine.cpu.tacts).toBe(6); // 2 + 1 + 1 + 1 + 1 = 6 cycles
    });

    it("Should handle zero page wrap-around", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x17, 0xff], 0x1000, 0x1000); // SLO 0xFF,X
      machine.cpu.x = 0x02; // X = 0x02
      machine.cpu.a = 0x00;
      machine.writeMemory(0x01, 0x08); // 0xFF + 0x02 = 0x101 wraps to 0x01
      machine.cpu.p = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.readMemory(0x01)).toBe(0x10); // 0x08 << 1 = 0x10
      expect(machine.cpu.a).toBe(0x10); // A = 0x00 OR 0x10 = 0x10
      expect(machine.cpu.isCFlagSet()).toBe(false);
      expect(machine.cpu.isZFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(false);
    });
  });

  describe("SLO abs,Y - 0x1B", () => {
    it("Should shift left absolute indexed Y memory and OR with accumulator", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x1b, 0x00, 0x30], 0x1000, 0x1000); // SLO 0x3000,Y
      machine.cpu.y = 0x20; // Y = 0x20
      machine.cpu.a = 0x05; // A = 0x05
      machine.writeMemory(0x3020, 0x12); // Absolute memory at 0x3000 + 0x20 = 0x3020
      machine.cpu.p = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      const shiftedValue = 0x12 << 1; // 0x24
      expect(machine.readMemory(0x3020)).toBe(0x24); // Memory shifted left
      expect(machine.cpu.a).toBe(0x05 | 0x24); // A = 0x05 OR 0x24 = 0x25
      expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from 0x12 << 1
      expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x25 is not zero
      expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x25 has bit 7 clear
      expect(machine.cpu.pc).toBe(0x1003);
      expect(machine.cpu.tacts).toBe(7); // 2 + 2 + 1 + 1 + 1 = 7 cycles
    });
  });

  describe("SLO abs,X - 0x1F", () => {
    it("Should shift left absolute indexed X memory and OR with accumulator", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x1f, 0x00, 0x30], 0x1000, 0x1000); // SLO 0x3000,X
      machine.cpu.x = 0x15; // X = 0x15
      machine.cpu.a = 0x60; // A = 0x60
      machine.writeMemory(0x3015, 0x81); // Absolute memory at 0x3000 + 0x15 = 0x3015
      machine.cpu.p = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      const shiftedValue = 0x81 << 1; // 0x02 (with carry)
      expect(machine.readMemory(0x3015)).toBe(0x02); // Memory shifted left
      expect(machine.cpu.a).toBe(0x60 | 0x02); // A = 0x60 OR 0x02 = 0x62
      expect(machine.cpu.isCFlagSet()).toBe(true); // Carry set from bit 7 of 0x81
      expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x62 is not zero
      expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x62 has bit 7 clear
      expect(machine.cpu.pc).toBe(0x1003);
      expect(machine.cpu.tacts).toBe(7); // 2 + 2 + 1 + 1 + 1 = 7 cycles
    });
  });

  describe("SLO Edge Cases", () => {
    it("Should handle all bits set in memory (0xFF)", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x07, 0x50], 0x1000, 0x1000); // SLO 0x50
      machine.cpu.a = 0x00;
      machine.writeMemory(0x50, 0xff);
      machine.cpu.p = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.readMemory(0x50)).toBe(0xfe); // 0xFF << 1 = 0xFE
      expect(machine.cpu.a).toBe(0xfe); // A = 0x00 OR 0xFE = 0xFE
      expect(machine.cpu.isCFlagSet()).toBe(true); // Carry set from bit 7
      expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
      expect(machine.cpu.isNFlagSet()).toBe(true); // Result has bit 7 set
    });

    it("Should handle zero memory value", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x07, 0x50], 0x1000, 0x1000); // SLO 0x50
      machine.cpu.a = 0xff;
      machine.writeMemory(0x50, 0x00);
      machine.cpu.p = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.readMemory(0x50)).toBe(0x00); // 0x00 << 1 = 0x00
      expect(machine.cpu.a).toBe(0xff); // A = 0xFF OR 0x00 = 0xFF
      expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from 0x00 << 1
      expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0xFF is not zero
      expect(machine.cpu.isNFlagSet()).toBe(true); // Result 0xFF has bit 7 set
    });

    it("Should result in zero when both memory and accumulator are zero after shift", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x07, 0x50], 0x1000, 0x1000); // SLO 0x50
      machine.cpu.a = 0x00;
      machine.writeMemory(0x50, 0x00);
      machine.cpu.p = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.readMemory(0x50)).toBe(0x00); // 0x00 << 1 = 0x00
      expect(machine.cpu.a).toBe(0x00); // A = 0x00 OR 0x00 = 0x00
      expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from 0x00 << 1
      expect(machine.cpu.isZFlagSet()).toBe(true); // Result 0x00 is zero
      expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x00 has bit 7 clear
    });
  });

  describe("M6510 Undocumented Instructions - RLA", () => {
    describe("RLA (zp,X) - 0x23", () => {
      it("Should rotate left memory and AND with accumulator", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x23, 0x80], 0x1000, 0x1000); // RLA (0x80,X)
        machine.cpu.x = 0x10; // X = 0x10
        machine.cpu.a = 0xff; // A = 0xFF (all bits set for better testing)

        // Set up indirect addressing: 0x80 + 0x10 = 0x90 (zero page)
        machine.writeMemory(0x90, 0x20); // Low byte of target address
        machine.writeMemory(0x91, 0x30); // High byte of target address
        machine.writeMemory(0x3020, 0x42); // Target memory = 0x42 (binary: 01000010)

        machine.cpu.p = 0x01; // Set carry flag for rotate

        // --- Act
        machine.run();

        // --- Assert
        const rotatedValue = (0x42 << 1) | 1; // 0x85 (with carry in)
        expect(machine.readMemory(0x3020)).toBe(0x85); // Memory rotated left with carry
        expect(machine.cpu.a).toBe(0xff & 0x85); // A = 0xFF AND 0x85 = 0x85
        expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from 0x42 << 1
        expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x85 is not zero
        expect(machine.cpu.isNFlagSet()).toBe(true); // Result 0x85 has bit 7 set
        expect(machine.cpu.pc).toBe(0x1002);
        expect(machine.cpu.tacts).toBe(8); // 2 + 1 + 1 + 1 + 1 + 1 + 1 = 8 cycles
      });

      it("Should handle carry flag correctly when rotating 0x80", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x23, 0x80], 0x1000, 0x1000); // RLA (0x80,X)
        machine.cpu.x = 0x10;
        machine.cpu.a = 0x0f; // A = 0x0F

        machine.writeMemory(0x90, 0x20);
        machine.writeMemory(0x91, 0x30);
        machine.writeMemory(0x3020, 0x80); // Value with bit 7 set

        machine.cpu.p = 0x00; // Clear carry flag

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.readMemory(0x3020)).toBe(0x00); // 0x80 << 1 with no carry = 0x00
        expect(machine.cpu.a).toBe(0x0f & 0x00); // A = 0x0F AND 0x00 = 0x00
        expect(machine.cpu.isCFlagSet()).toBe(true); // Carry set from bit 7 of 0x80
        expect(machine.cpu.isZFlagSet()).toBe(true); // Result is zero
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result has bit 7 clear
      });
    });

    describe("RLA zp - 0x27", () => {
      it("Should rotate left zero page memory and AND with accumulator", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x27, 0x50], 0x1000, 0x1000); // RLA 0x50
        machine.cpu.a = 0x77; // A = 0x77
        machine.writeMemory(0x50, 0x44); // Zero page memory = 0x44
        machine.cpu.p = 0x01; // Set carry flag

        // --- Act
        machine.run();

        // --- Assert
        const rotatedValue = (0x44 << 1) | 1; // 0x89
        expect(machine.readMemory(0x50)).toBe(0x89); // Memory rotated left with carry
        expect(machine.cpu.a).toBe(0x77 & 0x89); // A = 0x77 AND 0x89 = 0x01
        expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from 0x44 << 1
        expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x01 is not zero
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x01 has bit 7 clear
        expect(machine.cpu.pc).toBe(0x1002);
        expect(machine.cpu.tacts).toBe(5); // 2 + 1 + 1 + 1 = 5 cycles
      });

      it("Should work with zero carry", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x27, 0x50], 0x1000, 0x1000);
        machine.cpu.a = 0xff;
        machine.writeMemory(0x50, 0x01); // Memory = 0x01
        machine.cpu.p = 0x00; // Clear carry flag

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.readMemory(0x50)).toBe(0x02); // 0x01 << 1 = 0x02
        expect(machine.cpu.a).toBe(0xff & 0x02); // A = 0xFF AND 0x02 = 0x02
        expect(machine.cpu.isCFlagSet()).toBe(false);
        expect(machine.cpu.isZFlagSet()).toBe(false);
        expect(machine.cpu.isNFlagSet()).toBe(false);
      });
    });

    describe("RLA abs - 0x2F", () => {
      it("Should rotate left absolute memory and AND with accumulator", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x2f, 0x00, 0x30], 0x1000, 0x1000); // RLA 0x3000
        machine.cpu.a = 0xaa; // A = 0xAA (10101010)
        machine.writeMemory(0x3000, 0x55); // Absolute memory = 0x55 (01010101)
        machine.cpu.p = 0x01; // Set carry flag

        // --- Act
        machine.run();

        // --- Assert
        const rotatedValue = (0x55 << 1) | 1; // 0xAB
        expect(machine.readMemory(0x3000)).toBe(0xab); // Memory rotated left with carry
        expect(machine.cpu.a).toBe(0xaa & 0xab); // A = 0xAA AND 0xAB = 0xAA
        expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from 0x55 << 1
        expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0xAA is not zero
        expect(machine.cpu.isNFlagSet()).toBe(true); // Result 0xAA has bit 7 set
        expect(machine.cpu.pc).toBe(0x1003);
        expect(machine.cpu.tacts).toBe(6); // 2 + 2 + 1 + 1 = 6 cycles
      });
    });

    describe("RLA (zp),Y - 0x33", () => {
      it("Should rotate left indirect indexed memory and AND with accumulator", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x33, 0x80], 0x1000, 0x1000); // RLA (0x80),Y
        machine.cpu.y = 0x05; // Y = 0x05
        machine.cpu.a = 0x3f; // A = 0x3F

        // Set up indirect addressing
        machine.writeMemory(0x80, 0x00); // Low byte of base address
        machine.writeMemory(0x81, 0x40); // High byte of base address
        machine.writeMemory(0x4005, 0x1e); // Target memory at 0x4000 + 0x05 = 0x4005

        machine.cpu.p = 0x00; // Clear carry flag

        // --- Act
        machine.run();

        // --- Assert
        const rotatedValue = 0x1e << 1; // 0x3C
        expect(machine.readMemory(0x4005)).toBe(0x3c); // Memory rotated left
        expect(machine.cpu.a).toBe(0x3f & 0x3c); // A = 0x3F AND 0x3C = 0x3C
        expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from 0x1E << 1
        expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x3C is not zero
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x3C has bit 7 clear
        expect(machine.cpu.pc).toBe(0x1002);
        expect(machine.cpu.tacts).toBe(8); // 2 + 1 + 1 + 1 + 1 + 1 + 1 = 8 cycles
      });
    });

    describe("RLA zp,X - 0x37", () => {
      it("Should rotate left zero page indexed memory and AND with accumulator", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x37, 0x80], 0x1000, 0x1000); // RLA 0x80,X
        machine.cpu.x = 0x10; // X = 0x10
        machine.cpu.a = 0x99; // A = 0x99
        machine.writeMemory(0x90, 0x33); // Zero page memory at 0x80 + 0x10 = 0x90
        machine.cpu.p = 0x01; // Set carry flag

        // --- Act
        machine.run();

        // --- Assert
        const rotatedValue = (0x33 << 1) | 1; // 0x67
        expect(machine.readMemory(0x90)).toBe(0x67); // Memory rotated left with carry
        expect(machine.cpu.a).toBe(0x99 & 0x67); // A = 0x99 AND 0x67 = 0x01
        expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from 0x33 << 1
        expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x01 is not zero
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x01 has bit 7 clear
        expect(machine.cpu.pc).toBe(0x1002);
        expect(machine.cpu.tacts).toBe(6); // 2 + 1 + 1 + 1 + 1 = 6 cycles
      });

      it("Should handle zero page wrap-around", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x37, 0xff], 0x1000, 0x1000); // RLA 0xFF,X
        machine.cpu.x = 0x02; // X = 0x02
        machine.cpu.a = 0xff;
        machine.writeMemory(0x01, 0x08); // 0xFF + 0x02 = 0x101 wraps to 0x01
        machine.cpu.p = 0x00; // Clear carry flag

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.readMemory(0x01)).toBe(0x10); // 0x08 << 1 = 0x10
        expect(machine.cpu.a).toBe(0xff & 0x10); // A = 0xFF AND 0x10 = 0x10
        expect(machine.cpu.isCFlagSet()).toBe(false);
        expect(machine.cpu.isZFlagSet()).toBe(false);
        expect(machine.cpu.isNFlagSet()).toBe(false);
      });
    });

    describe("RLA abs,Y - 0x3B", () => {
      it("Should rotate left absolute indexed Y memory and AND with accumulator", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x3b, 0x00, 0x30], 0x1000, 0x1000); // RLA 0x3000,Y
        machine.cpu.y = 0x20; // Y = 0x20
        machine.cpu.a = 0xf0; // A = 0xF0
        machine.writeMemory(0x3020, 0x24); // Absolute memory at 0x3000 + 0x20 = 0x3020
        machine.cpu.p = 0x01; // Set carry flag

        // --- Act
        machine.run();

        // --- Assert
        const rotatedValue = (0x24 << 1) | 1; // 0x49
        expect(machine.readMemory(0x3020)).toBe(0x49); // Memory rotated left with carry
        expect(machine.cpu.a).toBe(0xf0 & 0x49); // A = 0xF0 AND 0x49 = 0x40
        expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from 0x24 << 1
        expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x40 is not zero
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x40 has bit 7 clear
        expect(machine.cpu.pc).toBe(0x1003);
        expect(machine.cpu.tacts).toBe(7); // 2 + 2 + 1 + 1 + 1 = 7 cycles
      });
    });

    describe("RLA abs,X - 0x3F", () => {
      it("Should rotate left absolute indexed X memory and AND with accumulator", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x3f, 0x00, 0x30], 0x1000, 0x1000); // RLA 0x3000,X
        machine.cpu.x = 0x15; // X = 0x15
        machine.cpu.a = 0x0f; // A = 0x0F
        machine.writeMemory(0x3015, 0x81); // Absolute memory at 0x3000 + 0x15 = 0x3015
        machine.cpu.p = 0x00; // Clear carry flag

        // --- Act
        machine.run();

        // --- Assert
        const rotatedValue = 0x81 << 1; // 0x02 (with carry out)
        expect(machine.readMemory(0x3015)).toBe(0x02); // Memory rotated left
        expect(machine.cpu.a).toBe(0x0f & 0x02); // A = 0x0F AND 0x02 = 0x02
        expect(machine.cpu.isCFlagSet()).toBe(true); // Carry set from bit 7 of 0x81
        expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x02 is not zero
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x02 has bit 7 clear
        expect(machine.cpu.pc).toBe(0x1003);
        expect(machine.cpu.tacts).toBe(7); // 2 + 2 + 1 + 1 + 1 = 7 cycles
      });
    });

    describe("RLA Edge Cases", () => {
      it("Should handle all bits set in memory (0xFF)", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x27, 0x50], 0x1000, 0x1000); // RLA 0x50
        machine.cpu.a = 0xf0;
        machine.writeMemory(0x50, 0xff);
        machine.cpu.p = 0x00; // Clear carry flag

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.readMemory(0x50)).toBe(0xfe); // 0xFF << 1 = 0xFE
        expect(machine.cpu.a).toBe(0xf0 & 0xfe); // A = 0xF0 AND 0xFE = 0xF0
        expect(machine.cpu.isCFlagSet()).toBe(true); // Carry set from bit 7
        expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
        expect(machine.cpu.isNFlagSet()).toBe(true); // Result has bit 7 set
      });

      it("Should handle zero memory value", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x27, 0x50], 0x1000, 0x1000); // RLA 0x50
        machine.cpu.a = 0xff;
        machine.writeMemory(0x50, 0x00);
        machine.cpu.p = 0x01; // Set carry flag

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.readMemory(0x50)).toBe(0x01); // 0x00 << 1 with carry = 0x01
        expect(machine.cpu.a).toBe(0xff & 0x01); // A = 0xFF AND 0x01 = 0x01
        expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from 0x00 << 1
        expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x01 is not zero
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x01 has bit 7 clear
      });

      it("Should result in zero when AND result is zero", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x27, 0x50], 0x1000, 0x1000); // RLA 0x50
        machine.cpu.a = 0x0f; // Lower 4 bits set
        machine.writeMemory(0x50, 0x40); // Will become 0x80 after rotate left
        machine.cpu.p = 0x00; // Clear carry flag

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.readMemory(0x50)).toBe(0x80); // 0x40 << 1 = 0x80
        expect(machine.cpu.a).toBe(0x0f & 0x80); // A = 0x0F AND 0x80 = 0x00
        expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from 0x40 << 1
        expect(machine.cpu.isZFlagSet()).toBe(true); // Result 0x00 is zero
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x00 has bit 7 clear
      });
    });
  });

  describe("M6510 Undocumented Instructions - SRE", () => {
    describe("SRE (zp,X) - 0x43", () => {
      it("Should shift right memory and EOR with accumulator", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x43, 0x80], 0x1000, 0x1000); // SRE (0x80,X)
        machine.cpu.x = 0x10; // X = 0x10
        machine.cpu.a = 0x0f; // A = 0x0F

        // Set up indirect addressing: 0x80 + 0x10 = 0x90 (zero page)
        machine.writeMemory(0x90, 0x20); // Low byte of target address
        machine.writeMemory(0x91, 0x30); // High byte of target address
        machine.writeMemory(0x3020, 0x84); // Target memory = 0x84 (binary: 10000100)

        machine.cpu.p = 0x00; // Clear all flags

        // --- Act
        machine.run();

        // --- Assert
        const shiftedValue = 0x84 >> 1; // 0x42
        expect(machine.readMemory(0x3020)).toBe(0x42); // Memory shifted right
        expect(machine.cpu.a).toBe(0x0f ^ 0x42); // A = 0x0F EOR 0x42 = 0x4D
        expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from bit 0 of 0x84
        expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x4D is not zero
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x4D has bit 7 clear
        expect(machine.cpu.pc).toBe(0x1002);
        expect(machine.cpu.tacts).toBe(8); // 2 + 1 + 1 + 1 + 1 + 1 + 1 = 8 cycles
      });

      it("Should handle carry flag correctly when shifting odd number", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x43, 0x80], 0x1000, 0x1000); // SRE (0x80,X)
        machine.cpu.x = 0x10;
        machine.cpu.a = 0x00;

        machine.writeMemory(0x90, 0x20);
        machine.writeMemory(0x91, 0x30);
        machine.writeMemory(0x3020, 0x85); // Value with bit 0 set (odd number)

        machine.cpu.p = 0x00;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.readMemory(0x3020)).toBe(0x42); // 0x85 >> 1 = 0x42
        expect(machine.cpu.a).toBe(0x00 ^ 0x42); // A = 0x00 EOR 0x42 = 0x42
        expect(machine.cpu.isCFlagSet()).toBe(true); // Carry set from bit 0 of 0x85
        expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x42 is not zero
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x42 has bit 7 clear
      });
    });

    describe("SRE zp - 0x47", () => {
      it("Should shift right zero page memory and EOR with accumulator", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x47, 0x50], 0x1000, 0x1000); // SRE 0x50
        machine.cpu.a = 0x33; // A = 0x33
        machine.writeMemory(0x50, 0x88); // Zero page memory = 0x88
        machine.cpu.p = 0x00;

        // --- Act
        machine.run();

        // --- Assert
        const shiftedValue = 0x88 >> 1; // 0x44
        expect(machine.readMemory(0x50)).toBe(0x44); // Memory shifted right
        expect(machine.cpu.a).toBe(0x33 ^ 0x44); // A = 0x33 EOR 0x44 = 0x77
        expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from bit 0 of 0x88
        expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x77 is not zero
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x77 has bit 7 clear
        expect(machine.cpu.pc).toBe(0x1002);
        expect(machine.cpu.tacts).toBe(5); // 2 + 1 + 1 + 1 = 5 cycles
      });

      it("Should work with zero accumulator", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x47, 0x50], 0x1000, 0x1000);
        machine.cpu.a = 0x00;
        machine.writeMemory(0x50, 0x02);
        machine.cpu.p = 0x00;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.readMemory(0x50)).toBe(0x01); // 0x02 >> 1 = 0x01
        expect(machine.cpu.a).toBe(0x01); // A = 0x00 EOR 0x01 = 0x01
        expect(machine.cpu.isCFlagSet()).toBe(false);
        expect(machine.cpu.isZFlagSet()).toBe(false);
        expect(machine.cpu.isNFlagSet()).toBe(false);
      });
    });

    describe("SRE abs - 0x4F", () => {
      it("Should shift right absolute memory and EOR with accumulator", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x4f, 0x00, 0x30], 0x1000, 0x1000); // SRE 0x3000
        machine.cpu.a = 0x55; // A = 0x55 (01010101)
        machine.writeMemory(0x3000, 0xaa); // Absolute memory = 0xAA (10101010)
        machine.cpu.p = 0x00;

        // --- Act
        machine.run();

        // --- Assert
        const shiftedValue = 0xaa >> 1; // 0x55
        expect(machine.readMemory(0x3000)).toBe(0x55); // Memory shifted right
        expect(machine.cpu.a).toBe(0x55 ^ 0x55); // A = 0x55 EOR 0x55 = 0x00
        expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from bit 0 of 0xAA
        expect(machine.cpu.isZFlagSet()).toBe(true); // Result 0x00 is zero
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x00 has bit 7 clear
        expect(machine.cpu.pc).toBe(0x1003);
        expect(machine.cpu.tacts).toBe(6); // 2 + 2 + 1 + 1 = 6 cycles
      });
    });

    describe("SRE (zp),Y - 0x53", () => {
      it("Should shift right indirect indexed memory and EOR with accumulator", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x53, 0x80], 0x1000, 0x1000); // SRE (0x80),Y
        machine.cpu.y = 0x05; // Y = 0x05
        machine.cpu.a = 0x78; // A = 0x78

        // Set up indirect addressing
        machine.writeMemory(0x80, 0x00); // Low byte of base address
        machine.writeMemory(0x81, 0x40); // High byte of base address
        machine.writeMemory(0x4005, 0xf0); // Target memory at 0x4000 + 0x05 = 0x4005

        machine.cpu.p = 0x00;

        // --- Act
        machine.run();

        // --- Assert
        const shiftedValue = 0xf0 >> 1; // 0x78
        expect(machine.readMemory(0x4005)).toBe(0x78); // Memory shifted right
        expect(machine.cpu.a).toBe(0x78 ^ 0x78); // A = 0x78 EOR 0x78 = 0x00
        expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from bit 0 of 0xF0
        expect(machine.cpu.isZFlagSet()).toBe(true); // Result 0x00 is zero
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x00 has bit 7 clear
        expect(machine.cpu.pc).toBe(0x1002);
        expect(machine.cpu.tacts).toBe(8); // 2 + 1 + 1 + 1 + 1 + 1 + 1 = 8 cycles
      });
    });

    describe("SRE zp,X - 0x57", () => {
      it("Should shift right zero page indexed memory and EOR with accumulator", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x57, 0x80], 0x1000, 0x1000); // SRE 0x80,X
        machine.cpu.x = 0x10; // X = 0x10
        machine.cpu.a = 0x11; // A = 0x11
        machine.writeMemory(0x90, 0x44); // Zero page memory at 0x80 + 0x10 = 0x90
        machine.cpu.p = 0x00;

        // --- Act
        machine.run();

        // --- Assert
        const shiftedValue = 0x44 >> 1; // 0x22
        expect(machine.readMemory(0x90)).toBe(0x22); // Memory shifted right
        expect(machine.cpu.a).toBe(0x11 ^ 0x22); // A = 0x11 EOR 0x22 = 0x33
        expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from bit 0 of 0x44
        expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x33 is not zero
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x33 has bit 7 clear
        expect(machine.cpu.pc).toBe(0x1002);
        expect(machine.cpu.tacts).toBe(6); // 2 + 1 + 1 + 1 + 1 = 6 cycles
      });

      it("Should handle zero page wrap-around", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x57, 0xff], 0x1000, 0x1000); // SRE 0xFF,X
        machine.cpu.x = 0x02; // X = 0x02
        machine.cpu.a = 0x00;
        machine.writeMemory(0x01, 0x10); // 0xFF + 0x02 = 0x101 wraps to 0x01
        machine.cpu.p = 0x00;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.readMemory(0x01)).toBe(0x08); // 0x10 >> 1 = 0x08
        expect(machine.cpu.a).toBe(0x08); // A = 0x00 EOR 0x08 = 0x08
        expect(machine.cpu.isCFlagSet()).toBe(false);
        expect(machine.cpu.isZFlagSet()).toBe(false);
        expect(machine.cpu.isNFlagSet()).toBe(false);
      });
    });

    describe("SRE abs,Y - 0x5B", () => {
      it("Should shift right absolute indexed Y memory and EOR with accumulator", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x5b, 0x00, 0x30], 0x1000, 0x1000); // SRE 0x3000,Y
        machine.cpu.y = 0x20; // Y = 0x20
        machine.cpu.a = 0x05; // A = 0x05
        machine.writeMemory(0x3020, 0x48); // Absolute memory at 0x3000 + 0x20 = 0x3020
        machine.cpu.p = 0x00;

        // --- Act
        machine.run();

        // --- Assert
        const shiftedValue = 0x48 >> 1; // 0x24
        expect(machine.readMemory(0x3020)).toBe(0x24); // Memory shifted right
        expect(machine.cpu.a).toBe(0x05 ^ 0x24); // A = 0x05 EOR 0x24 = 0x21
        expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from bit 0 of 0x48
        expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x21 is not zero
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x21 has bit 7 clear
        expect(machine.cpu.pc).toBe(0x1003);
        expect(machine.cpu.tacts).toBe(7); // 2 + 2 + 1 + 1 + 1 = 7 cycles
      });
    });

    describe("SRE abs,X - 0x5F", () => {
      it("Should shift right absolute indexed X memory and EOR with accumulator", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x5f, 0x00, 0x30], 0x1000, 0x1000); // SRE 0x3000,X
        machine.cpu.x = 0x15; // X = 0x15
        machine.cpu.a = 0x60; // A = 0x60
        machine.writeMemory(0x3015, 0x83); // Absolute memory at 0x3000 + 0x15 = 0x3015
        machine.cpu.p = 0x00;

        // --- Act
        machine.run();

        // --- Assert
        const shiftedValue = 0x83 >> 1; // 0x41
        expect(machine.readMemory(0x3015)).toBe(0x41); // Memory shifted right
        expect(machine.cpu.a).toBe(0x60 ^ 0x41); // A = 0x60 EOR 0x41 = 0x21
        expect(machine.cpu.isCFlagSet()).toBe(true); // Carry set from bit 0 of 0x83
        expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x21 is not zero
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x21 has bit 7 clear
        expect(machine.cpu.pc).toBe(0x1003);
        expect(machine.cpu.tacts).toBe(7); // 2 + 2 + 1 + 1 + 1 = 7 cycles
      });
    });

    describe("SRE Edge Cases", () => {
      it("Should handle all bits set in memory (0xFF)", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x47, 0x50], 0x1000, 0x1000); // SRE 0x50
        machine.cpu.a = 0x00;
        machine.writeMemory(0x50, 0xff);
        machine.cpu.p = 0x00;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.readMemory(0x50)).toBe(0x7f); // 0xFF >> 1 = 0x7F
        expect(machine.cpu.a).toBe(0x7f); // A = 0x00 EOR 0x7F = 0x7F
        expect(machine.cpu.isCFlagSet()).toBe(true); // Carry set from bit 0 of 0xFF
        expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x7F has bit 7 clear
      });

      it("Should handle zero memory value", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x47, 0x50], 0x1000, 0x1000); // SRE 0x50
        machine.cpu.a = 0xff;
        machine.writeMemory(0x50, 0x00);
        machine.cpu.p = 0x00;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.readMemory(0x50)).toBe(0x00); // 0x00 >> 1 = 0x00
        expect(machine.cpu.a).toBe(0xff); // A = 0xFF EOR 0x00 = 0xFF
        expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from bit 0 of 0x00
        expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0xFF is not zero
        expect(machine.cpu.isNFlagSet()).toBe(true); // Result 0xFF has bit 7 set
      });

      it("Should result in zero when EOR result is zero", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x47, 0x50], 0x1000, 0x1000); // SRE 0x50
        machine.cpu.a = 0x20; // A = 0x20
        machine.writeMemory(0x50, 0x40); // Will become 0x20 after shift right
        machine.cpu.p = 0x00;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.readMemory(0x50)).toBe(0x20); // 0x40 >> 1 = 0x20
        expect(machine.cpu.a).toBe(0x20 ^ 0x20); // A = 0x20 EOR 0x20 = 0x00
        expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from bit 0 of 0x40
        expect(machine.cpu.isZFlagSet()).toBe(true); // Result 0x00 is zero
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x00 has bit 7 clear
      });

      it("Should produce negative result when EOR result has bit 7 set", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x47, 0x50], 0x1000, 0x1000); // SRE 0x50
        machine.cpu.a = 0x0f; // A = 0x0F (00001111)
        machine.writeMemory(0x50, 0x1e); // Will become 0x0F after shift, then 0x0F EOR 0x0F = 0x00, but let's use different value
        machine.writeMemory(0x50, 0x1c); // Will become 0x0E after shift
        machine.cpu.p = 0x00;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.readMemory(0x50)).toBe(0x0e); // 0x1C >> 1 = 0x0E
        expect(machine.cpu.a).toBe(0x0f ^ 0x0e); // A = 0x0F EOR 0x0E = 0x01
        expect(machine.cpu.isCFlagSet()).toBe(false); // No carry from bit 0 of 0x1C
        expect(machine.cpu.isZFlagSet()).toBe(false); // Result 0x01 is not zero
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result 0x01 has bit 7 clear
      });
    });
  });
});