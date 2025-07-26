import { describe, it, expect, beforeEach } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";
import { FlagSetMask6510 } from "../../src/emu/abstractions/FlagSetMask6510";

describe("M6510 - NOP, ADC, and SBC Instructions", () => {
  let machine: M6510TestMachine;

  beforeEach(() => {
    machine = new M6510TestMachine(RunMode.OneInstruction);
  });

  describe("NOP - No Operation (0xEA)", () => {
    it("should do nothing and consume 2 cycles", () => {
      // --- Arrange
      machine.initCode([0xEA], 0x1000, 0x1000); // NOP
      const initialA = machine.cpu.a = 0x42;
      const initialX = machine.cpu.x = 0x33;
      const initialY = machine.cpu.y = 0x24;
      const initialP = machine.cpu.p = 0x75; // Include bit 5 (UNUSED) which is always 1

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(2);
      expect(machine.cpu.a).toBe(initialA);
      expect(machine.cpu.x).toBe(initialX);
      expect(machine.cpu.y).toBe(initialY);
      expect(machine.cpu.p).toBe(initialP);
    });
  });

  describe("ADC - Add with Carry (Immediate)", () => {
    it("should add immediate value to accumulator without carry", () => {
      // --- Arrange
      machine.initCode([0x69, 0x30], 0x1000, 0x1000); // ADC #$30
      machine.cpu.a = 0x20;
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x50); // 0x20 + 0x30 = 0x50
      expect(machine.cpu.pc).toBe(0x1002);
      expect(machine.cpu.tacts).toBe(2);
      expect(machine.cpu.isCFlagSet()).toBe(false);
      expect(machine.cpu.isZFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(false);
      expect(machine.cpu.isVFlagSet()).toBe(false);
    });

    it("should add immediate value to accumulator with carry in", () => {
      // --- Arrange
      machine.initCode([0x69, 0x30], 0x1000, 0x1000); // ADC #$30
      machine.cpu.a = 0x20;
      machine.cpu.p |= FlagSetMask6510.C; // Set carry

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x51); // 0x20 + 0x30 + 1 = 0x51
      expect(machine.cpu.isCFlagSet()).toBe(false);
      expect(machine.cpu.isZFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(false);
      expect(machine.cpu.isVFlagSet()).toBe(false);
    });

    it("should set carry flag on overflow", () => {
      // --- Arrange
      machine.initCode([0x69, 0xFF], 0x1000, 0x1000); // ADC #$FF
      machine.cpu.a = 0x02;
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x01); // (0x02 + 0xFF) & 0xFF = 0x01
      expect(machine.cpu.isCFlagSet()).toBe(true); // Carry out
      expect(machine.cpu.isZFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(false);
      expect(machine.cpu.isVFlagSet()).toBe(false);
    });

    it("should set zero flag when result is zero", () => {
      // --- Arrange
      machine.initCode([0x69, 0xFF], 0x1000, 0x1000); // ADC #$FF
      machine.cpu.a = 0x01;
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x00); // (0x01 + 0xFF) & 0xFF = 0x00
      expect(machine.cpu.isCFlagSet()).toBe(true); // Carry out
      expect(machine.cpu.isZFlagSet()).toBe(true); // Zero result
      expect(machine.cpu.isNFlagSet()).toBe(false);
      expect(machine.cpu.isVFlagSet()).toBe(false);
    });

    it("should set negative flag when result bit 7 is set", () => {
      // --- Arrange
      machine.initCode([0x69, 0x60], 0x1000, 0x1000); // ADC #$60
      machine.cpu.a = 0x30;
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x90); // 0x30 + 0x60 = 0x90
      expect(machine.cpu.isCFlagSet()).toBe(false);
      expect(machine.cpu.isZFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(true); // Bit 7 set
      expect(machine.cpu.isVFlagSet()).toBe(true); // Overflow: positive + positive = negative
    });

    it("should set overflow flag on signed overflow (positive + positive = negative)", () => {
      // --- Arrange
      machine.initCode([0x69, 0x7F], 0x1000, 0x1000); // ADC #$7F
      machine.cpu.a = 0x01;
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x80); // 0x01 + 0x7F = 0x80
      expect(machine.cpu.isCFlagSet()).toBe(false);
      expect(machine.cpu.isZFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(true);
      expect(machine.cpu.isVFlagSet()).toBe(true); // Overflow: positive + positive = negative
    });

    it("should set overflow flag on signed overflow (negative + negative = positive)", () => {
      // --- Arrange
      machine.initCode([0x69, 0x80], 0x1000, 0x1000); // ADC #$80
      machine.cpu.a = 0x80;
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x00); // (0x80 + 0x80) & 0xFF = 0x00
      expect(machine.cpu.isCFlagSet()).toBe(true); // Carry out
      expect(machine.cpu.isZFlagSet()).toBe(true); // Zero result
      expect(machine.cpu.isNFlagSet()).toBe(false);
      expect(machine.cpu.isVFlagSet()).toBe(true); // Overflow: negative + negative = positive
    });
  });

  describe("ADC - Add with Carry (Zero Page)", () => {
    it("should add zero page value to accumulator", () => {
      // --- Arrange
      machine.initCode([0x65, 0x80], 0x1000, 0x1000); // ADC $80
      machine.writeMemory(0x80, 0x25);
      machine.cpu.a = 0x15;
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x3A); // 0x15 + 0x25 = 0x3A
      expect(machine.cpu.pc).toBe(0x1002);
      expect(machine.cpu.tacts).toBe(3);
      expect(machine.cpu.isCFlagSet()).toBe(false);
      expect(machine.cpu.isZFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(false);
      expect(machine.cpu.isVFlagSet()).toBe(false);
    });
  });

  describe("ADC - Add with Carry (Zero Page,X)", () => {
    it("should add zero page,X value to accumulator", () => {
      // --- Arrange
      machine.initCode([0x75, 0x80], 0x1000, 0x1000); // ADC $80,X
      machine.cpu.x = 0x05;
      machine.writeMemory(0x85, 0x30); // $80 + $05 = $85
      machine.cpu.a = 0x10;
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x40); // 0x10 + 0x30 = 0x40
      expect(machine.cpu.pc).toBe(0x1002);
      expect(machine.cpu.tacts).toBe(4);
      expect(machine.cpu.isCFlagSet()).toBe(false);
    });

    it("should wrap around in zero page", () => {
      // --- Arrange
      machine.initCode([0x75, 0xFF], 0x1000, 0x1000); // ADC $FF,X
      machine.cpu.x = 0x02;
      machine.writeMemory(0x01, 0x42); // $FF + $02 = $01 (wraps in zero page)
      machine.cpu.a = 0x08;
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x4A); // 0x08 + 0x42 = 0x4A
      expect(machine.cpu.tacts).toBe(4);
    });
  });

  describe("ADC - Add with Carry (Absolute)", () => {
    it("should add absolute value to accumulator", () => {
      // --- Arrange
      machine.initCode([0x6D, 0x00, 0x20], 0x1000, 0x1000); // ADC $2000
      machine.writeMemory(0x2000, 0x35);
      machine.cpu.a = 0x25;
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x5A); // 0x25 + 0x35 = 0x5A
      expect(machine.cpu.pc).toBe(0x1003);
      expect(machine.cpu.tacts).toBe(4);
      expect(machine.cpu.isCFlagSet()).toBe(false);
    });
  });

  describe("ADC - Add with Carry (Absolute,X)", () => {
    it("should add absolute,X value to accumulator", () => {
      // --- Arrange
      machine.initCode([0x7D, 0x00, 0x20], 0x1000, 0x1000); // ADC $2000,X
      machine.cpu.x = 0x10;
      machine.writeMemory(0x2010, 0x45); // $2000 + $10 = $2010
      machine.cpu.a = 0x15;
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x5A); // 0x15 + 0x45 = 0x5A
      expect(machine.cpu.pc).toBe(0x1003);
      expect(machine.cpu.tacts).toBe(4); // No page boundary crossed
      expect(machine.cpu.isCFlagSet()).toBe(false);
    });

    it("should add extra cycle when page boundary is crossed", () => {
      // --- Arrange
      machine.initCode([0x7D, 0xFF, 0x20], 0x1000, 0x1000); // ADC $20FF,X
      machine.cpu.x = 0x01;
      machine.writeMemory(0x2100, 0x30); // $20FF + $01 = $2100 (page boundary crossed)
      machine.cpu.a = 0x20;
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x50); // 0x20 + 0x30 = 0x50
      expect(machine.cpu.tacts).toBe(5); // +1 cycle for page boundary cross
    });
  });

  describe("ADC - Add with Carry (Absolute,Y)", () => {
    it("should add absolute,Y value to accumulator", () => {
      // --- Arrange
      machine.initCode([0x79, 0x00, 0x20], 0x1000, 0x1000); // ADC $2000,Y
      machine.cpu.y = 0x08;
      machine.writeMemory(0x2008, 0x55); // $2000 + $08 = $2008
      machine.cpu.a = 0x25;
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x7A); // 0x25 + 0x55 = 0x7A
      expect(machine.cpu.pc).toBe(0x1003);
      expect(machine.cpu.tacts).toBe(4); // No page boundary crossed
      expect(machine.cpu.isCFlagSet()).toBe(false);
    });
  });

  describe("ADC - Add with Carry (Indexed Indirect)", () => {
    it("should add indexed indirect value to accumulator", () => {
      // --- Arrange
      machine.initCode([0x61, 0x20], 0x1000, 0x1000); // ADC ($20,X)
      machine.cpu.x = 0x04;
      machine.writeMemory(0x24, 0x00); // Low byte of address
      machine.writeMemory(0x25, 0x30); // High byte of address
      machine.writeMemory(0x3000, 0x65); // Value at target address
      machine.cpu.a = 0x15;
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x7A); // 0x15 + 0x65 = 0x7A
      expect(machine.cpu.pc).toBe(0x1002);
      expect(machine.cpu.tacts).toBe(6);
      expect(machine.cpu.isCFlagSet()).toBe(false);
    });
  });

  describe("ADC - Add with Carry (Indirect Indexed)", () => {
    it("should add indirect indexed value to accumulator", () => {
      // --- Arrange
      machine.initCode([0x71, 0x20], 0x1000, 0x1000); // ADC ($20),Y
      machine.cpu.y = 0x10;
      machine.writeMemory(0x20, 0x00); // Low byte of base address
      machine.writeMemory(0x21, 0x30); // High byte of base address
      machine.writeMemory(0x3010, 0x75); // Value at ($3000 + Y)
      machine.cpu.a = 0x05;
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x7A); // 0x05 + 0x75 = 0x7A
      expect(machine.cpu.pc).toBe(0x1002);
      expect(machine.cpu.tacts).toBe(5); // No page boundary crossed
      expect(machine.cpu.isCFlagSet()).toBe(false);
    });
  });

  describe("ADC - Add with Carry (Decimal Mode)", () => {
    it("should add BCD numbers correctly in decimal mode", () => {
      // --- Arrange
      machine.initCode([0x69, 0x05], 0x1000, 0x1000); // ADC #$05
      machine.cpu.a = 0x09; // BCD 09
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry
      machine.cpu.p |= 0x08; // Set decimal flag

      // --- Act
      machine.run();

      // --- Assert
      // In decimal mode: 09 + 05 = 14 (BCD)
      expect(machine.cpu.a).toBe(0x14); // BCD result
      expect(machine.cpu.isCFlagSet()).toBe(false); // No carry
      expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
      expect(machine.cpu.isNFlagSet()).toBe(false); // Based on binary calculation
      expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
    });

    it("should handle BCD carry correctly in decimal mode", () => {
      // --- Arrange
      machine.initCode([0x69, 0x09], 0x1000, 0x1000); // ADC #$09
      machine.cpu.a = 0x08; // BCD 08
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry
      machine.cpu.p |= 0x08; // Set decimal flag

      // --- Act
      machine.run();

      // --- Assert
      // In decimal mode: 08 + 09 = 17 (BCD)
      expect(machine.cpu.a).toBe(0x17); // BCD result
      expect(machine.cpu.isCFlagSet()).toBe(false); // No decimal carry out
      expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
      expect(machine.cpu.isNFlagSet()).toBe(false); // Based on binary calculation
      expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
    });

    it("should set carry flag when BCD result exceeds 99", () => {
      // --- Arrange
      machine.initCode([0x69, 0x05], 0x1000, 0x1000); // ADC #$05
      machine.cpu.a = 0x95; // BCD 95
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry
      machine.cpu.p |= 0x08; // Set decimal flag

      // --- Act
      machine.run();

      // --- Assert
      // In decimal mode: 95 + 05 = 100, result = 00 with carry
      expect(machine.cpu.a).toBe(0x00); // BCD result
      expect(machine.cpu.isCFlagSet()).toBe(true); // Decimal carry out
      expect(machine.cpu.isZFlagSet()).toBe(false); // Z flag based on binary result (0x95 + 0x05 = 0x9A ≠ 0)
      expect(machine.cpu.isNFlagSet()).toBe(false); // N flag based on BCD result (0x00 has bit 7 clear)
      expect(machine.cpu.isVFlagSet()).toBe(false); // No signed overflow
    });

    it("should handle carry input in decimal mode", () => {
      // --- Arrange
      machine.initCode([0x69, 0x05], 0x1000, 0x1000); // ADC #$05
      machine.cpu.a = 0x09; // BCD 09
      machine.cpu.p |= FlagSetMask6510.C; // Set carry
      machine.cpu.p |= 0x08; // Set decimal flag

      // --- Act
      machine.run();

      // --- Assert
      // In decimal mode: 09 + 05 + 1 = 15 (BCD)
      expect(machine.cpu.a).toBe(0x15); // BCD result
      expect(machine.cpu.isCFlagSet()).toBe(false); // No carry out
      expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
      expect(machine.cpu.isNFlagSet()).toBe(false); // Based on binary calculation
      expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
    });

    it("should handle double BCD carry (from ones and tens)", () => {
      // --- Arrange
      machine.initCode([0x69, 0x99], 0x1000, 0x1000); // ADC #$99
      machine.cpu.a = 0x99; // BCD 99
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry
      machine.cpu.p |= 0x08; // Set decimal flag

      // --- Act
      machine.run();

      // --- Assert
      // In decimal mode: 99 + 99 = 198, result = 98 with carry
      expect(machine.cpu.a).toBe(0x98); // BCD result (198 - 100 = 98)
      expect(machine.cpu.isCFlagSet()).toBe(true); // Decimal carry out
      expect(machine.cpu.isZFlagSet()).toBe(false); // Z flag based on binary result (0x132 & 0xFF = 0x32 ≠ 0)
      expect(machine.cpu.isNFlagSet()).toBe(true); // N flag based on BCD result (0x98 has bit 7 set)
      expect(machine.cpu.isVFlagSet()).toBe(true); // Signed overflow (0x99 + 0x99 = 0x132, truncated to 0x32)
    });

    it("should handle edge case: adding 1 to 99 in decimal mode", () => {
      // --- Arrange
      machine.initCode([0x69, 0x01], 0x1000, 0x1000); // ADC #$01
      machine.cpu.a = 0x99; // BCD 99
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry
      machine.cpu.p |= 0x08; // Set decimal flag

      // --- Act
      machine.run();

      // --- Assert
      // In decimal mode: 99 + 01 = 100, result = 00 with carry
      expect(machine.cpu.a).toBe(0x00); // BCD result
      expect(machine.cpu.isCFlagSet()).toBe(true); // Decimal carry out
      expect(machine.cpu.isZFlagSet()).toBe(false); // Z flag based on binary result (0x99 + 0x01 = 0x9A ≠ 0)
      expect(machine.cpu.isNFlagSet()).toBe(false); // N flag based on BCD result (0x00 has bit 7 clear)
      expect(machine.cpu.isVFlagSet()).toBe(false); // No signed overflow
    });

    it("should work with zero page addressing in decimal mode", () => {
      // --- Arrange
      machine.initCode([0x65, 0x80], 0x1000, 0x1000); // ADC $80
      machine.writeMemory(0x80, 0x25); // BCD 25
      machine.cpu.a = 0x34; // BCD 34
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry
      machine.cpu.p |= 0x08; // Set decimal flag

      // --- Act
      machine.run();

      // --- Assert
      // In decimal mode: 34 + 25 = 59 (BCD)
      expect(machine.cpu.a).toBe(0x59); // BCD result
      expect(machine.cpu.isCFlagSet()).toBe(false); // No carry
      expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
      expect(machine.cpu.isNFlagSet()).toBe(false); // Based on binary calculation
      expect(machine.cpu.isVFlagSet()).toBe(false); // No overflow
    });

    it("should work with absolute addressing in decimal mode", () => {
      // --- Arrange
      machine.initCode([0x6D, 0x00, 0x30], 0x1000, 0x1000); // ADC $3000
      machine.writeMemory(0x3000, 0x47); // BCD 47
      machine.cpu.a = 0x38; // BCD 38
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry
      machine.cpu.p |= 0x08; // Set decimal flag

      // --- Act
      machine.run();

      // --- Assert
      // In decimal mode: 38 + 47 = 85 (BCD)
      expect(machine.cpu.a).toBe(0x85); // BCD result
      expect(machine.cpu.isCFlagSet()).toBe(false); // No carry
      expect(machine.cpu.isZFlagSet()).toBe(false); // Result is not zero
      expect(machine.cpu.isNFlagSet()).toBe(true); // Based on binary calculation (0x38 + 0x47 = 0x7F, but BCD 0x85 has bit 7 set)
      expect(machine.cpu.isVFlagSet()).toBe(false); // No signed overflow
    });
  });

  describe("SBC - Subtract with Carry (Immediate)", () => {
    it("should subtract immediate value from accumulator without borrow", () => {
      // --- Arrange
      machine.initCode([0xE9, 0x30], 0x1000, 0x1000); // SBC #$30
      machine.cpu.a = 0x50;
      machine.cpu.p |= FlagSetMask6510.C; // Set carry (no borrow)

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x20); // 0x50 - 0x30 - 0 = 0x20
      expect(machine.cpu.pc).toBe(0x1002);
      expect(machine.cpu.tacts).toBe(2);
      expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
      expect(machine.cpu.isZFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(false);
      expect(machine.cpu.isVFlagSet()).toBe(false);
    });

    it("should subtract immediate value from accumulator with borrow", () => {
      // --- Arrange
      machine.initCode([0xE9, 0x30], 0x1000, 0x1000); // SBC #$30
      machine.cpu.a = 0x50;
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry (borrow)

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x1F); // 0x50 - 0x30 - 1 = 0x1F
      expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow result
      expect(machine.cpu.isZFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(false);
      expect(machine.cpu.isVFlagSet()).toBe(false);
    });

    it("should clear carry flag on borrow", () => {
      // --- Arrange
      machine.initCode([0xE9, 0xFF], 0x1000, 0x1000); // SBC #$FF
      machine.cpu.a = 0x7F;
      machine.cpu.p |= FlagSetMask6510.C; // Set carry (no borrow initially)

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x80); // 0x7F - 0xFF = 0x80 (with borrow)
      expect(machine.cpu.isCFlagSet()).toBe(false); // Borrow occurred
      expect(machine.cpu.isZFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(true); // Bit 7 set
      expect(machine.cpu.isVFlagSet()).toBe(true); // Signed overflow: positive - negative = negative (127 - (-1) = 128, wraps to -128)
    });

    it("should set zero flag when result is zero", () => {
      // --- Arrange
      machine.initCode([0xE9, 0x42], 0x1000, 0x1000); // SBC #$42
      machine.cpu.a = 0x42;
      machine.cpu.p |= FlagSetMask6510.C; // Set carry (no borrow)

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x00); // 0x42 - 0x42 - 0 = 0x00
      expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
      expect(machine.cpu.isZFlagSet()).toBe(true); // Zero result
      expect(machine.cpu.isNFlagSet()).toBe(false);
      expect(machine.cpu.isVFlagSet()).toBe(false);
    });

    it("should set negative flag when result bit 7 is set", () => {
      // --- Arrange
      machine.initCode([0xE9, 0x10], 0x1000, 0x1000); // SBC #$10
      machine.cpu.a = 0x05;
      machine.cpu.p |= FlagSetMask6510.C; // Set carry (no borrow)

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0xF5); // 0x05 - 0x10 = 0xF5 (with borrow)
      expect(machine.cpu.isCFlagSet()).toBe(false); // Borrow occurred
      expect(machine.cpu.isZFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(true); // Bit 7 set
      expect(machine.cpu.isVFlagSet()).toBe(false);
    });

    it("should set overflow flag on signed overflow (positive - negative = negative)", () => {
      // --- Arrange
      machine.initCode([0xE9, 0x80], 0x1000, 0x1000); // SBC #$80
      machine.cpu.a = 0x7F;
      machine.cpu.p |= FlagSetMask6510.C; // Set carry (no borrow)

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0xFF); // 0x7F - 0x80 = 0xFF
      expect(machine.cpu.isCFlagSet()).toBe(false); // Borrow occurred
      expect(machine.cpu.isZFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(true);
      expect(machine.cpu.isVFlagSet()).toBe(true); // Overflow: positive - negative = negative
    });

    it("should set overflow flag on signed overflow (negative - positive = positive)", () => {
      // --- Arrange
      machine.initCode([0xE9, 0x01], 0x1000, 0x1000); // SBC #$01
      machine.cpu.a = 0x80;
      machine.cpu.p |= FlagSetMask6510.C; // Set carry (no borrow)

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x7F); // 0x80 - 0x01 = 0x7F
      expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
      expect(machine.cpu.isZFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(false);
      expect(machine.cpu.isVFlagSet()).toBe(true); // Overflow: negative - positive = positive
    });
  });

  describe("SBC - Subtract with Carry (Zero Page)", () => {
    it("should subtract zero page value from accumulator", () => {
      // --- Arrange
      machine.initCode([0xE5, 0x80], 0x1000, 0x1000); // SBC $80
      machine.writeMemory(0x80, 0x25);
      machine.cpu.a = 0x60;
      machine.cpu.p |= FlagSetMask6510.C; // Set carry (no borrow)

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x3B); // 0x60 - 0x25 - 0 = 0x3B
      expect(machine.cpu.pc).toBe(0x1002);
      expect(machine.cpu.tacts).toBe(3);
      expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
      expect(machine.cpu.isZFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(false);
      expect(machine.cpu.isVFlagSet()).toBe(false);
    });
  });

  describe("SBC - Subtract with Carry (Zero Page,X)", () => {
    it("should subtract zero page,X value from accumulator", () => {
      // --- Arrange
      machine.initCode([0xF5, 0x80], 0x1000, 0x1000); // SBC $80,X
      machine.cpu.x = 0x05;
      machine.writeMemory(0x85, 0x30); // $80 + $05 = $85
      machine.cpu.a = 0x50;
      machine.cpu.p |= FlagSetMask6510.C; // Set carry (no borrow)

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x20); // 0x50 - 0x30 - 0 = 0x20
      expect(machine.cpu.pc).toBe(0x1002);
      expect(machine.cpu.tacts).toBe(4);
      expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    });
  });

  describe("SBC - Subtract with Carry (Absolute)", () => {
    it("should subtract absolute value from accumulator", () => {
      // --- Arrange
      machine.initCode([0xED, 0x00, 0x20], 0x1000, 0x1000); // SBC $2000
      machine.writeMemory(0x2000, 0x35);
      machine.cpu.a = 0x70;
      machine.cpu.p |= FlagSetMask6510.C; // Set carry (no borrow)

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x3B); // 0x70 - 0x35 - 0 = 0x3B
      expect(machine.cpu.pc).toBe(0x1003);
      expect(machine.cpu.tacts).toBe(4);
      expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    });
  });

  describe("SBC - Subtract with Carry (Absolute,X)", () => {
    it("should subtract absolute,X value from accumulator", () => {
      // --- Arrange
      machine.initCode([0xFD, 0x00, 0x20], 0x1000, 0x1000); // SBC $2000,X
      machine.cpu.x = 0x10;
      machine.writeMemory(0x2010, 0x25); // $2000 + $10 = $2010
      machine.cpu.a = 0x45;
      machine.cpu.p |= FlagSetMask6510.C; // Set carry (no borrow)

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x20); // 0x45 - 0x25 - 0 = 0x20
      expect(machine.cpu.pc).toBe(0x1003);
      expect(machine.cpu.tacts).toBe(4); // No page boundary crossed
      expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    });
  });

  describe("SBC - Subtract with Carry (Absolute,Y)", () => {
    it("should subtract absolute,Y value from accumulator", () => {
      // --- Arrange
      machine.initCode([0xF9, 0x00, 0x20], 0x1000, 0x1000); // SBC $2000,Y
      machine.cpu.y = 0x08;
      machine.writeMemory(0x2008, 0x15); // $2000 + $08 = $2008
      machine.cpu.a = 0x55;
      machine.cpu.p |= FlagSetMask6510.C; // Set carry (no borrow)

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x40); // 0x55 - 0x15 - 0 = 0x40
      expect(machine.cpu.pc).toBe(0x1003);
      expect(machine.cpu.tacts).toBe(4); // No page boundary crossed
      expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    });
  });

  describe("SBC - Subtract with Carry (Indexed Indirect)", () => {
    it("should subtract indexed indirect value from accumulator", () => {
      // --- Arrange
      machine.initCode([0xE1, 0x20], 0x1000, 0x1000); // SBC ($20,X)
      machine.cpu.x = 0x04;
      machine.writeMemory(0x24, 0x00); // Low byte of address
      machine.writeMemory(0x25, 0x30); // High byte of address
      machine.writeMemory(0x3000, 0x25); // Value at target address
      machine.cpu.a = 0x65;
      machine.cpu.p |= FlagSetMask6510.C; // Set carry (no borrow)

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x40); // 0x65 - 0x25 - 0 = 0x40
      expect(machine.cpu.pc).toBe(0x1002);
      expect(machine.cpu.tacts).toBe(6);
      expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    });
  });

  describe("SBC - Subtract with Carry (Indirect Indexed)", () => {
    it("should subtract indirect indexed value from accumulator", () => {
      // --- Arrange
      machine.initCode([0xF1, 0x20], 0x1000, 0x1000); // SBC ($20),Y
      machine.cpu.y = 0x10;
      machine.writeMemory(0x20, 0x00); // Low byte of base address
      machine.writeMemory(0x21, 0x30); // High byte of base address
      machine.writeMemory(0x3010, 0x35); // Value at ($3000 + Y)
      machine.cpu.a = 0x75;
      machine.cpu.p |= FlagSetMask6510.C; // Set carry (no borrow)

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x40); // 0x75 - 0x35 - 0 = 0x40
      expect(machine.cpu.pc).toBe(0x1002);
      expect(machine.cpu.tacts).toBe(5); // No page boundary crossed
      expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
    });
  });

  describe("Edge Cases and Complex Scenarios", () => {
    it("should handle ADC with all flags", () => {
      // --- Arrange
      machine.initCode([0x69, 0xFF], 0x1000, 0x1000); // ADC #$FF
      machine.cpu.a = 0x81; // Negative number
      machine.cpu.p |= FlagSetMask6510.C; // Set carry

      // --- Act
      machine.run();

      // --- Assert  
      expect(machine.cpu.a).toBe(0x81); // (0x81 + 0xFF + 1) & 0xFF = 0x81
      expect(machine.cpu.isCFlagSet()).toBe(true); // Carry out
      expect(machine.cpu.isZFlagSet()).toBe(false); 
      expect(machine.cpu.isNFlagSet()).toBe(true); // Bit 7 set
      expect(machine.cpu.isVFlagSet()).toBe(false);
    });

    it("should handle SBC with borrow and zero result", () => {
      // --- Arrange
      machine.initCode([0xE9, 0x41], 0x1000, 0x1000); // SBC #$41
      machine.cpu.a = 0x42;
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry (borrow)

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x00); // 0x42 - 0x41 - 1 = 0x00
      expect(machine.cpu.isCFlagSet()).toBe(true); // No further borrow
      expect(machine.cpu.isZFlagSet()).toBe(true); // Zero result
      expect(machine.cpu.isNFlagSet()).toBe(false);
      expect(machine.cpu.isVFlagSet()).toBe(false);
    });

    it("should handle chained arithmetic operations", () => {
      // --- Arrange: ADC followed by SBC
      machine.initCode([0x69, 0x30, 0xE9, 0x10], 0x1000, 0x1000); // ADC #$30, SBC #$10
      machine.cpu.a = 0x20;
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry

      // --- Act: Run first instruction (ADC)
      machine.run();
      
      // --- Assert after ADC
      expect(machine.cpu.a).toBe(0x50); // 0x20 + 0x30 = 0x50
      expect(machine.cpu.isCFlagSet()).toBe(false);
      
      // Create new machine for second instruction
      const machine2 = new M6510TestMachine(RunMode.OneInstruction);
      machine2.initCode([0xE9, 0x10], 0x1000, 0x1000); // SBC #$10
      machine2.cpu.a = 0x50; // Result from previous operation
      machine2.cpu.p &= ~FlagSetMask6510.C; // Clear carry (borrow)
      
      // --- Act: Run second instruction (SBC)
      machine2.run();
      
      // --- Assert after SBC
      expect(machine2.cpu.a).toBe(0x3F); // 0x50 - 0x10 - 1 = 0x3F (with borrow)
      expect(machine2.cpu.isCFlagSet()).toBe(true); // No borrow
    });
  });
});
