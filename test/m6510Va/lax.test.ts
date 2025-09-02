import { describe, it, expect } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";

/**
 * Tests for the LAX (Load A and X) undocumented instruction
 *
 * LAX loads memory into both accumulator (A) and X register with the same value.
 * It affects the N and Z flags based on the loaded value.
 *
 * Opcodes:
 * - 0xA3: LAX (zp,X) - Indexed Indirect
 * - 0xA7: LAX zp - Zero Page
 * - 0xAF: LAX abs - Absolute
 * - 0xB3: LAX (zp),Y - Indirect Indexed
 * - 0xB7: LAX zp,Y - Zero Page,Y
 * - 0xBF: LAX abs,Y - Absolute,Y
 */
describe("M6510 Undocumented Instructions - LAX", () => {
  it("Should load memory into both A and X using indexed indirect addressing", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xA3, 0x10], 0x1000, 0x1000); // LAX ($10,X)
    machine.cpu.x = 0x05;

    // Set up indirect addressing: 0x10 + 0x05 = 0x15 (zero page)
    machine.writeMemory(0x15, 0x20); // Low byte of target address
    machine.writeMemory(0x16, 0x30); // High byte of target address -> $3020
    machine.writeMemory(0x3020, 0x42); // Value to load

    // --- Act
    machine.run();

    // --- Assert
    // Both A and X should be loaded with 0x42
    expect(machine.cpu.a).toBe(0x42);
    expect(machine.cpu.x).toBe(0x42);
    expect(machine.cpu.isNFlagSet()).toBe(false); // 0x42 has bit 7 clear
    expect(machine.cpu.isZFlagSet()).toBe(false); // 0x42 is not zero
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6); // 2 + 1 + 1 + 1 + 1 = 6 cycles
  });

  it("Should handle zero page wrap-around in indexed indirect addressing", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xA3, 0xFE], 0x1000, 0x1000); // LAX ($FE,X)
    machine.cpu.x = 0x02;

    // Address calculation: $FE + $02 = $00 (wraps in zero page)
    machine.writeMemory(0x00, 0x80); // Low byte
    machine.writeMemory(0x01, 0x25); // High byte -> $2580
    machine.writeMemory(0x2580, 0x80); // Value to load (negative)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80);
    expect(machine.cpu.x).toBe(0x80);
    expect(machine.cpu.isNFlagSet()).toBe(true); // 0x80 has bit 7 set
    expect(machine.cpu.isZFlagSet()).toBe(false);
  });

  it("Should load memory into both A and X using zero page addressing", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xA7, 0x50], 0x1000, 0x1000); // LAX $50
    machine.writeMemory(0x50, 0x7F); // Value to load

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x7F);
    expect(machine.cpu.x).toBe(0x7F);
    expect(machine.cpu.isNFlagSet()).toBe(false); // 0x7F has bit 7 clear
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(3); // 2 + 1 = 3 cycles
  });

  it("Should set zero flag when loading zero value", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xA7, 0x60], 0x1000, 0x1000); // LAX $60
    machine.writeMemory(0x60, 0x00); // Zero value

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00);
    expect(machine.cpu.x).toBe(0x00);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isZFlagSet()).toBe(true); // Zero flag set
  });

  it("Should load memory into both A and X using absolute addressing", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xAF, 0x00, 0x40], 0x1000, 0x1000); // LAX $4000
    machine.writeMemory(0x4000, 0xAA); // Value to load

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0xAA);
    expect(machine.cpu.x).toBe(0xAA);
    expect(machine.cpu.isNFlagSet()).toBe(true); // 0xAA has bit 7 set
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4); // 2 + 2 = 4 cycles
  });

  it("Should load memory into both A and X using indirect indexed addressing", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xB3, 0x80], 0x1000, 0x1000); // LAX ($80),Y
    machine.cpu.y = 0x08;

    // Set up indirect addressing
    machine.writeMemory(0x80, 0x00); // Low byte of base address
    machine.writeMemory(0x81, 0x50); // High byte of base address -> $5000
    machine.writeMemory(0x5008, 0x33); // Value at $5000 + $08

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x33);
    expect(machine.cpu.x).toBe(0x33);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5); // 2 + 1 + 1 + 1 = 5 cycles
  });

  it("Should handle page boundary crossing in indirect indexed addressing", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xB3, 0x90], 0x1000, 0x1000); // LAX ($90),Y
    machine.cpu.y = 0xFF;

    // Set up indirect addressing with page boundary crossing
    machine.writeMemory(0x90, 0x01); // Low byte
    machine.writeMemory(0x91, 0x20); // High byte -> $2001
    machine.writeMemory(0x2100, 0x55); // Value at $2001 + $FF = $2100 (crosses page)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x55);
    expect(machine.cpu.x).toBe(0x55);
    expect(machine.cpu.tacts).toBe(6); // Extra cycle for page boundary crossing
  });

  it("Should load memory into both A and X using zero page,Y addressing", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xB7, 0x20], 0x1000, 0x1000); // LAX $20,Y
    machine.cpu.y = 0x03;
    machine.writeMemory(0x23, 0x99); // Value at $20 + $03

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x99);
    expect(machine.cpu.x).toBe(0x99);
    expect(machine.cpu.isNFlagSet()).toBe(true); // 0x99 has bit 7 set
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(4); // 2 + 1 + 1 = 4 cycles
  });

  it("Should wrap around in zero page when Y causes overflow", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xB7, 0xF0], 0x1000, 0x1000); // LAX $F0,Y
    machine.cpu.y = 0x20;
    machine.writeMemory(0x10, 0x44); // Value at $F0 + $20 = $10 (wrapped to zero page)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x44);
    expect(machine.cpu.x).toBe(0x44);
  });

  it("Should load memory into both A and X using absolute,Y addressing", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xBF, 0x00, 0x60], 0x1000, 0x1000); // LAX $6000,Y
    machine.cpu.y = 0x10;
    machine.writeMemory(0x6010, 0x77); // Value at $6000 + $10

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x77);
    expect(machine.cpu.x).toBe(0x77);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4); // No page boundary crossing
  });

  it("Should handle page boundary crossing in absolute,Y addressing", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xBF, 0xFF, 0x70], 0x1000, 0x1000); // LAX $70FF,Y
    machine.cpu.y = 0x01;
    machine.writeMemory(0x7100, 0x88); // Value at $70FF + $01 = $7100 (crosses page)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x88);
    expect(machine.cpu.x).toBe(0x88);
    expect(machine.cpu.tacts).toBe(5); // Extra cycle for page boundary crossing
  });

  it("Should not affect other flags besides N and Z", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xA7, 0x40], 0x1000, 0x1000); // LAX $40
    machine.writeMemory(0x40, 0x42);

    // Set all other flags
    machine.cpu.p = 0xFF; // Set all flags
    machine.cpu.p &= ~0x82; // Clear N and Z flags to test they get set correctly

    const expectedFlags = machine.cpu.p; // Should not change C, I, D, B, V flags

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x42);
    expect(machine.cpu.x).toBe(0x42);
    // Only N and Z flags should change, others should remain the same
    expect(machine.cpu.p & 0x7D).toBe(expectedFlags & 0x7D); // Check C, I, D, B, V flags unchanged
    expect(machine.cpu.isNFlagSet()).toBe(false); // N flag based on value
    expect(machine.cpu.isZFlagSet()).toBe(false); // Z flag based on value
  });

  it("Should preserve other registers", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xAF, 0x00, 0x80], 0x1000, 0x1000); // LAX $8000
    machine.writeMemory(0x8000, 0x66);

    machine.cpu.y = 0x12;
    machine.cpu.sp = 0xFE;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x66);
    expect(machine.cpu.x).toBe(0x66);
    expect(machine.cpu.y).toBe(0x12); // Y unchanged
    expect(machine.cpu.sp).toBe(0xFE); // SP unchanged
    expect(machine.cpu.pc).toBe(0x1003); // PC incremented correctly
  });

  describe("LAX flag behavior verification", () => {
    const testCases = [
      { value: 0x00, expectedN: false, expectedZ: true, desc: "zero value" },
      { value: 0x7F, expectedN: false, expectedZ: false, desc: "positive value" },
      { value: 0x80, expectedN: true, expectedZ: false, desc: "negative value (bit 7 set)" },
      { value: 0xFF, expectedN: true, expectedZ: false, desc: "all bits set" },
      { value: 0x01, expectedN: false, expectedZ: false, desc: "minimal positive" },
    ];

    testCases.forEach(({ value, expectedN, expectedZ, desc }) => {
      it(`should set flags correctly for ${desc} (value=$${value.toString(16).padStart(2, '0').toUpperCase()})`, () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xA7, 0x70], 0x1000, 0x1000); // LAX $70
        machine.writeMemory(0x70, value);

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(value);
        expect(machine.cpu.x).toBe(value);
        expect(machine.cpu.isNFlagSet()).toBe(expectedN);
        expect(machine.cpu.isZFlagSet()).toBe(expectedZ);
      });
    });
  });

  describe("LAX addressing mode timing verification", () => {
    it("should have correct timing for all addressing modes", () => {
      const timingTests = [
        { opcode: 0xA3, operands: [0x10], expectedCycles: 6, desc: "LAX (zp,X)" },
        { opcode: 0xA7, operands: [0x50], expectedCycles: 3, desc: "LAX zp" },
        { opcode: 0xAF, operands: [0x00, 0x40], expectedCycles: 4, desc: "LAX abs" },
        { opcode: 0xB3, operands: [0x80], expectedCycles: 5, desc: "LAX (zp),Y" },
        { opcode: 0xB7, operands: [0x20], expectedCycles: 4, desc: "LAX zp,Y" },
        { opcode: 0xBF, operands: [0x00, 0x60], expectedCycles: 4, desc: "LAX abs,Y" },
      ];

      timingTests.forEach(({ opcode, operands, expectedCycles, desc }) => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([opcode, ...operands], 0x1000, 0x1000);
        
        // Set up memory for tests that need it
        if (desc.includes("(zp,X)")) {
          machine.cpu.x = 0x05;
          machine.writeMemory(0x15, 0x00);
          machine.writeMemory(0x16, 0x30);
          machine.writeMemory(0x3000, 0x42);
        } else if (desc.includes("(zp),Y")) {
          machine.cpu.y = 0x08;
          machine.writeMemory(0x80, 0x00);
          machine.writeMemory(0x81, 0x50);
          machine.writeMemory(0x5008, 0x42);
        } else if (desc.includes("zp,Y")) {
          machine.cpu.y = 0x03;
          machine.writeMemory(0x23, 0x42);
        } else if (desc.includes("abs,Y")) {
          machine.cpu.y = 0x10;
          machine.writeMemory(0x6010, 0x42);
        } else {
          // Simple memory setup for zp and abs
          const addr = desc.includes("zp") ? 0x50 : 0x4000;
          machine.writeMemory(addr, 0x42);
        }

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.tacts).toBe(expectedCycles);
        expect(machine.cpu.a).toBe(0x42);
        expect(machine.cpu.x).toBe(0x42);
      });
    });
  });
});
