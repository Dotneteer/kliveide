import { describe, it, expect } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

describe("M6510 LSR instructions", () => {
  // LSR A (Accumulator): 0x4A
  it("LSR A works with basic operation: 0x4A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x4a], 0x1000, 0x1000);
    machine.cpu.a = 0x66; // Set Accumulator to 0x66 (binary: 01100110)

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

  // LSR A sets carry flag: 0x4A
  it("LSR A sets carry flag: 0x4A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x4a], 0x1000, 0x1000);
    machine.cpu.a = 0x01; // Set Accumulator to 0x01 (bit 0 set)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x01 >> 1 = 0x00 (carry out)
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // LSR A sets zero flag: 0x4A
  it("LSR A sets zero flag: 0x4A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x4a], 0x1000, 0x1000);
    machine.cpu.a = 0x01; // Set Accumulator to 0x01

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

  // LSR A never sets negative flag: 0x4A
  it("LSR A never sets negative flag: 0x4A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x4a], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x7f); // 0xFF >> 1 = 0x7F (bit 7 always clear)
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false); // N flag is never set by LSR
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // LSR zp (Zero Page): 0x46
  it("LSR zp works: 0x46", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x46, 0x50], 0x1000, 0x1000);
    machine.writeMemory(0x50, 0x66); // Set memory at 0x50 to 0x66

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

  // LSR zp sets carry flag: 0x46
  it("LSR zp sets carry flag: 0x46", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x46, 0x50], 0x1000, 0x1000);
    machine.writeMemory(0x50, 0x01); // Set memory at 0x50 to 0x01

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x50)).toBe(0x00); // 0x01 >> 1 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  // LSR zp with high value: 0x46
  it("LSR zp with high value: 0x46", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x46, 0x50], 0x1000, 0x1000);
    machine.writeMemory(0x50, 0x80); // Set memory at 0x50 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x50)).toBe(0x40); // 0x80 >> 1 = 0x40
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false); // N flag never set by LSR
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  // LSR zp,X (Zero Page,X): 0x56
  it("LSR zp,X works: 0x56", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x56, 0x50], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x66); // Set memory at 0x50 + 0x05 = 0x55 to 0x66

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

  // LSR zp,X with zero page wrap-around: 0x56
  it("LSR zp,X handles zero page wrap-around: 0x56", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x56, 0xff], 0x1000, 0x1000);
    machine.cpu.x = 0x02; // Set X Register to 0x02
    machine.writeMemory(0x01, 0x66); // Set memory at 0xFF + 0x02 = 0x01 (wrapped) to 0x66

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x01)).toBe(0x33); // 0x66 >> 1 = 0x33
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // LSR zp,X sets carry flag: 0x56
  it("LSR zp,X sets carry flag: 0x56", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x56, 0x50], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x01); // Set memory at 0x50 + 0x05 = 0x55 to 0x01

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x55)).toBe(0x00); // 0x01 >> 1 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // LSR zp,X with high value: 0x56
  it("LSR zp,X with high value: 0x56", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x56, 0x50], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x80); // Set memory at 0x50 + 0x05 = 0x55 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x55)).toBe(0x40); // 0x80 >> 1 = 0x40
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // LSR abs (Absolute): 0x4E
  it("LSR abs works: 0x4E", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x4e, 0x00, 0x30], 0x1000, 0x1000);
    machine.writeMemory(0x3000, 0x66); // Set memory at 0x3000 to 0x66

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

  // LSR abs sets carry flag: 0x4E
  it("LSR abs sets carry flag: 0x4E", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x4e, 0x00, 0x30], 0x1000, 0x1000);
    machine.writeMemory(0x3000, 0x01); // Set memory at 0x3000 to 0x01

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0x00); // 0x01 >> 1 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(6);
  });

  // LSR abs with high value: 0x4E
  it("LSR abs with high value: 0x4E", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x4e, 0x00, 0x30], 0x1000, 0x1000);
    machine.writeMemory(0x3000, 0x80); // Set memory at 0x3000 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0x40); // 0x80 >> 1 = 0x40
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(6);
  });

  // LSR abs,X (Absolute,X): 0x5E
  it("LSR abs,X works: 0x5E", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x5e, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x66); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x66

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

  // LSR abs,X sets carry flag: 0x5E
  it("LSR abs,X sets carry flag: 0x5E", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x5e, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x01); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x01

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3010)).toBe(0x00); // 0x01 >> 1 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(7);
  });

  // LSR abs,X with high value: 0x5E
  it("LSR abs,X with high value: 0x5E", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x5e, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x80); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3010)).toBe(0x40); // 0x80 >> 1 = 0x40
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(7);
  });

  // Edge case: LSR with 0x00
  it("LSR A with 0x00 produces zero: 0x4A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x4a], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00

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

  // Edge case: LSR with 0xFF (all bits set)
  it("LSR A with 0xFF sets carry: 0x4A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x4a], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x7f); // 0xFF >> 1 = 0x7F
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Test specific bit patterns - alternating bits low
  it("LSR A with alternating bit pattern (0x55): 0x4A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x4a], 0x1000, 0x1000);
    machine.cpu.a = 0x55; // Set Accumulator to 0x55 = binary 01010101

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x2a); // 01010101 >> 1 = 00101010
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Test specific bit patterns - alternating bits high
  it("LSR A with alternating bit pattern (0xAA): 0x4A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x4a], 0x1000, 0x1000);
    machine.cpu.a = 0xaa; // Set Accumulator to 0xAA = binary 10101010

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

  // Test that result of LSR is exactly 0x40
  it("LSR A producing exactly 0x40: 0x4A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x4a], 0x1000, 0x1000);
    machine.cpu.a = 0x80; // Set Accumulator to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x40); // 0x80 >> 1 = 0x40
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false); // N flag never set by LSR
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Test that LSR doesn't affect other flags
  it("LSR A preserves other flags: 0x4A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x4a], 0x1000, 0x1000);
    machine.cpu.a = 0x02; // Set Accumulator to 0x02
    // Set some other flags before the operation
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

  // Test that bit 0 of original determines carry flag
  it("LSR A with even number clears carry: 0x4A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x4a], 0x1000, 0x1000);
    machine.cpu.a = 0x42; // Set Accumulator to 0x42 (even, bit 0 = 0)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x21); // 0x42 >> 1 = 0x21
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false); // Bit 0 was 0
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Test that bit 0 of original determines carry flag
  it("LSR A with odd number sets carry: 0x4A", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x4a], 0x1000, 0x1000);
    machine.cpu.a = 0x43; // Set Accumulator to 0x43 (odd, bit 0 = 1)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x21); // 0x43 >> 1 = 0x21
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(true); // Bit 0 was 1
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
  });
});
