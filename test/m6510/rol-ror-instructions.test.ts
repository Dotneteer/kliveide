import { describe, it, expect } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

describe("M6510 ROL and ROR instructions", () => {
  // ROL A (Accumulator): 0x2A
  it("ROL A works with basic operation: 0x2A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x2a], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33 (binary: 00110011)
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x66); // 0x33 << 1 = 0x66 (binary: 01100110)
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // ROL A with carry in: 0x2A
  it("ROL A with carry in: 0x2A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x2a], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33 (binary: 00110011)
    machine.cpu.p = 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x67); // (0x33 << 1) | 1 = 0x67 (binary: 01100111)
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // ROL A sets carry flag: 0x2A
  it("ROL A sets carry flag: 0x2A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x2a], 0x1000, 0x1000);
    machine.cpu.a = 0x80; // Set Accumulator to 0x80 (bit 7 set)
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // (0x80 << 1) & 0xFF = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // ROL A sets negative flag: 0x2A
  it("ROL A sets negative flag: 0x2A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x2a], 0x1000, 0x1000);
    machine.cpu.a = 0x40; // Set Accumulator to 0x40 (binary: 01000000)
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0x40 << 1 = 0x80 (bit 7 set)
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // ROL A with carry in and carry out: 0x2A
  it("ROL A with carry in and carry out: 0x2A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x2a], 0x1000, 0x1000);
    machine.cpu.a = 0x80; // Set Accumulator to 0x80
    machine.cpu.p = 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x01); // (0x80 << 1) | 1 = 0x01
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // ROR A (Accumulator): 0x6A
  it("ROR A works with basic operation: 0x6A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x6a], 0x1000, 0x1000);
    machine.cpu.a = 0x66; // Set Accumulator to 0x66 (binary: 01100110)
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x33); // 0x66 >> 1 = 0x33 (binary: 00110011)
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // ROR A with carry in: 0x6A
  it("ROR A with carry in: 0x6A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x6a], 0x1000, 0x1000);
    machine.cpu.a = 0x66; // Set Accumulator to 0x66 (binary: 01100110)
    machine.cpu.p = 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0xb3); // (0x66 >> 1) | 0x80 = 0xB3 (binary: 10110011)
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // ROR A sets carry flag: 0x6A
  it("ROR A sets carry flag: 0x6A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x6a], 0x1000, 0x1000);
    machine.cpu.a = 0x01; // Set Accumulator to 0x01 (bit 0 set)
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x01 >> 1 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // ROR A with carry in and carry out: 0x6A
  it("ROR A with carry in and carry out: 0x6A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x6a], 0x1000, 0x1000);
    machine.cpu.a = 0x01; // Set Accumulator to 0x01
    machine.cpu.p = 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // (0x01 >> 1) | 0x80 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // ROL zp (Zero Page): 0x26
  it("ROL zp works: 0x26", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x26, 0x50], 0x1000, 0x1000);
    machine.writeMemory(0x50, 0x33); // Set memory at 0x50 to 0x33
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x50)).toBe(0x66); // 0x33 << 1 = 0x66
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  // ROL zp with carry: 0x26
  it("ROL zp with carry: 0x26", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x26, 0x50], 0x1000, 0x1000);
    machine.writeMemory(0x50, 0x80); // Set memory at 0x50 to 0x80
    machine.cpu.p = 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x50)).toBe(0x01); // (0x80 << 1) | 1 = 0x01
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  // ROR zp (Zero Page): 0x66
  it("ROR zp works: 0x66", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x66, 0x50], 0x1000, 0x1000);
    machine.writeMemory(0x50, 0x66); // Set memory at 0x50 to 0x66
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x50)).toBe(0x33); // 0x66 >> 1 = 0x33
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  // ROR zp with carry: 0x66
  it("ROR zp with carry: 0x66", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x66, 0x50], 0x1000, 0x1000);
    machine.writeMemory(0x50, 0x01); // Set memory at 0x50 to 0x01
    machine.cpu.p = 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x50)).toBe(0x80); // (0x01 >> 1) | 0x80 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  // ROL zp,X (Zero Page,X): 0x36
  it("ROL zp,X works: 0x36", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x36, 0x50], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x33); // Set memory at 0x50 + 0x05 = 0x55 to 0x33
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x55)).toBe(0x66); // 0x33 << 1 = 0x66
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // ROL zp,X with zero page wrap-around: 0x36
  it("ROL zp,X handles zero page wrap-around: 0x36", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x36, 0xff], 0x1000, 0x1000);
    machine.cpu.x = 0x02; // Set X Register to 0x02
    machine.writeMemory(0x01, 0x33); // Set memory at 0xFF + 0x02 = 0x01 (wrapped) to 0x33
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x01)).toBe(0x66); // 0x33 << 1 = 0x66
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // ROR zp,X (Zero Page,X): 0x76
  it("ROR zp,X works: 0x76", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x76, 0x50], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x66); // Set memory at 0x50 + 0x05 = 0x55 to 0x66
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x55)).toBe(0x33); // 0x66 >> 1 = 0x33
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // ROL abs (Absolute): 0x2E
  it("ROL abs works: 0x2E", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x2e, 0x00, 0x30], 0x1000, 0x1000);
    machine.writeMemory(0x3000, 0x33); // Set memory at 0x3000 to 0x33
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0x66); // 0x33 << 1 = 0x66
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(6);
  });

  // ROR abs (Absolute): 0x6E
  it("ROR abs works: 0x6E", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x6e, 0x00, 0x30], 0x1000, 0x1000);
    machine.writeMemory(0x3000, 0x66); // Set memory at 0x3000 to 0x66
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0x33); // 0x66 >> 1 = 0x33
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(6);
  });

  // ROL abs,X (Absolute,X): 0x3E
  it("ROL abs,X works: 0x3E", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x3e, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x33); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x33
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3010)).toBe(0x66); // 0x33 << 1 = 0x66
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(7);
  });

  // ROR abs,X (Absolute,X): 0x7E
  it("ROR abs,X works: 0x7E", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x7e, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x66); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x66
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3010)).toBe(0x33); // 0x66 >> 1 = 0x33
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(7);
  });

  // Edge case: ROL with 0x00
  it("ROL A with 0x00 produces zero with carry clear: 0x2A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x2a], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x00 << 1 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Edge case: ROL with 0x00 and carry set
  it("ROL A with 0x00 and carry set produces 0x01: 0x2A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x2a], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00
    machine.cpu.p = 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x01); // (0x00 << 1) | 1 = 0x01
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Edge case: ROR with 0x00
  it("ROR A with 0x00 produces zero with carry clear: 0x6A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x6a], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x00 >> 1 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Edge case: ROR with 0x00 and carry set
  it("ROR A with 0x00 and carry set produces 0x80: 0x6A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x6a], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00
    machine.cpu.p = 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // (0x00 >> 1) | 0x80 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Test specific bit patterns - alternating bits
  it("ROL A with alternating bit pattern (0x55): 0x2A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x2a], 0x1000, 0x1000);
    machine.cpu.a = 0x55; // Set Accumulator to 0x55 = binary 01010101
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0xaa); // 01010101 << 1 = 10101010
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Test specific bit patterns - alternating bits
  it("ROR A with alternating bit pattern (0xAA): 0x6A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x6a], 0x1000, 0x1000);
    machine.cpu.a = 0xaa; // Set Accumulator to 0xAA = binary 10101010
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x55); // 10101010 >> 1 = 01010101
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Test that ROL doesn't affect other flags
  it("ROL A preserves other flags: 0x2A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x2a], 0x1000, 0x1000);
    machine.cpu.a = 0x01; // Set Accumulator to 0x01
    // Set some other flags before the operation (V, B, D)
    machine.cpu.p = 0b01111000; // Set V, B, D flags

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x02); // 0x01 << 1 = 0x02
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    // Check that other flags are preserved
    expect(machine.cpu.isVFlagSet()).toBe(true);
    expect(machine.cpu.isBFlagSet()).toBe(true);
    expect(machine.cpu.isDFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Test that ROR doesn't affect other flags
  it("ROR A preserves other flags: 0x6A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x6a], 0x1000, 0x1000);
    machine.cpu.a = 0x02; // Set Accumulator to 0x02
    // Set some other flags before the operation (V, B, D)
    machine.cpu.p = 0b01111000; // Set V, B, D flags

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x01); // 0x02 >> 1 = 0x01
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    // Check that other flags are preserved
    expect(machine.cpu.isVFlagSet()).toBe(true);
    expect(machine.cpu.isBFlagSet()).toBe(true);
    expect(machine.cpu.isDFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Test complete rotation cycle (ROL then ROR should restore original)
  it("ROL A with 0x42 produces expected result: 0x2A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x2a], 0x1000, 0x1000); // ROL A
    machine.cpu.a = 0x42; // Set Accumulator to 0x42
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x84); // 0x42 << 1 = 0x84
    expect(machine.cpu.isCFlagSet()).toBe(false); // Bit 7 of 0x42 was 0
    expect(machine.cpu.isNFlagSet()).toBe(true); // Bit 7 of result is 1
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Test ROR with the result from ROL
  it("ROR A with 0x84 produces expected result: 0x6A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x6a], 0x1000, 0x1000); // ROR A
    machine.cpu.a = 0x84; // Set Accumulator to 0x84 (result from ROL 0x42)
    machine.cpu.p = 0x00; // Clear carry flag

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x42); // 0x84 >> 1 = 0x42 (back to original)
    expect(machine.cpu.isCFlagSet()).toBe(false); // Bit 0 of 0x84 was 0
    expect(machine.cpu.isNFlagSet()).toBe(false); // Bit 7 of result is 0
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });
});
