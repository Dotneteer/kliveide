import { describe, it, expect } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";

describe("M6510 ASL instructions", () => {
  // ASL A (Accumulator): 0x0A
  it("ASL A works with basic operation: 0x0A", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0a], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33 (binary: 00110011)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x66); // 0x33 << 1 = 0x66 (binary: 01100110)
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.checkedTacts).toBe(2);
  });

  // ASL A sets carry flag: 0x0A
  it("ASL A sets carry flag: 0x0A", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0a], 0x1000, 0x1000);
    machine.cpu.a = 0x80; // Set Accumulator to 0x80 (bit 7 set)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x80 << 1 = 0x00 (carry out)
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.checkedTacts).toBe(2);
  });

  // ASL A sets negative flag: 0x0A
  it("ASL A sets negative flag: 0x0A", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0a], 0x1000, 0x1000);
    machine.cpu.a = 0x40; // Set Accumulator to 0x40 (binary: 01000000)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0x40 << 1 = 0x80 (bit 7 set)
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.checkedTacts).toBe(2);
  });

  // ASL A sets both carry and zero flags: 0x0A
  it("ASL A sets both carry and zero flags: 0x0A", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0a], 0x1000, 0x1000);
    machine.cpu.a = 0x80; // Set Accumulator to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x80 << 1 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.checkedTacts).toBe(2);
  });

  // ASL zp (Zero Page): 0x06
  it("ASL zp works: 0x06", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x06, 0x50], 0x1000, 0x1000);
    machine.writeMemory(0x50, 0x33); // Set memory at 0x50 to 0x33

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x50)).toBe(0x66); // 0x33 << 1 = 0x66
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.checkedTacts).toBe(5);
  });

  // ASL zp sets carry flag: 0x06
  it("ASL zp sets carry flag: 0x06", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x06, 0x50], 0x1000, 0x1000);
    machine.writeMemory(0x50, 0x80); // Set memory at 0x50 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x50)).toBe(0x00); // 0x80 << 1 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.checkedTacts).toBe(5);
  });

  // ASL zp sets negative flag: 0x06
  it("ASL zp sets negative flag: 0x06", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x06, 0x50], 0x1000, 0x1000);
    machine.writeMemory(0x50, 0x40); // Set memory at 0x50 to 0x40

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x50)).toBe(0x80); // 0x40 << 1 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.checkedTacts).toBe(5);
  });

  // ASL zp,X (Zero Page,X): 0x16
  it("ASL zp,X works: 0x16", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x16, 0x50], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x33); // Set memory at 0x50 + 0x05 = 0x55 to 0x33

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x55)).toBe(0x66); // 0x33 << 1 = 0x66
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.checkedTacts).toBe(6);
  });

  // ASL zp,X with zero page wrap-around: 0x16
  it("ASL zp,X handles zero page wrap-around: 0x16", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x16, 0xff], 0x1000, 0x1000);
    machine.cpu.x = 0x02; // Set X Register to 0x02
    machine.writeMemory(0x01, 0x33); // Set memory at 0xFF + 0x02 = 0x01 (wrapped) to 0x33

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x01)).toBe(0x66); // 0x33 << 1 = 0x66
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.checkedTacts).toBe(6);
  });

  // ASL zp,X sets carry flag: 0x16
  it("ASL zp,X sets carry flag: 0x16", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x16, 0x50], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x80); // Set memory at 0x50 + 0x05 = 0x55 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x55)).toBe(0x00); // 0x80 << 1 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.checkedTacts).toBe(6);
  });

  // ASL zp,X sets negative flag: 0x16
  it("ASL zp,X sets negative flag: 0x16", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x16, 0x50], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x40); // Set memory at 0x50 + 0x05 = 0x55 to 0x40

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x55)).toBe(0x80); // 0x40 << 1 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.checkedTacts).toBe(6);
  });

  // ASL abs (Absolute): 0x0E
  it("ASL abs works: 0x0E", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0e, 0x00, 0x30], 0x1000, 0x1000);
    machine.writeMemory(0x3000, 0x33); // Set memory at 0x3000 to 0x33

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0x66); // 0x33 << 1 = 0x66
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.checkedTacts).toBe(6);
  });

  // ASL abs sets carry flag: 0x0E
  it("ASL abs sets carry flag: 0x0E", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0e, 0x00, 0x30], 0x1000, 0x1000);
    machine.writeMemory(0x3000, 0x80); // Set memory at 0x3000 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0x00); // 0x80 << 1 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.checkedTacts).toBe(6);
  });

  // ASL abs sets negative flag: 0x0E
  it("ASL abs sets negative flag: 0x0E", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0e, 0x00, 0x30], 0x1000, 0x1000);
    machine.writeMemory(0x3000, 0x40); // Set memory at 0x3000 to 0x40

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0x80); // 0x40 << 1 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.checkedTacts).toBe(6);
  });

  // ASL abs,X (Absolute,X): 0x1E
  it("ASL abs,X works: 0x1E", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x1e, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x33); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x33

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3010)).toBe(0x66); // 0x33 << 1 = 0x66
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.checkedTacts).toBe(7);
  });

  // ASL abs,X sets carry flag: 0x1E
  it("ASL abs,X sets carry flag: 0x1E", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x1e, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x80); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3010)).toBe(0x00); // 0x80 << 1 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.checkedTacts).toBe(7);
  });

  // ASL abs,X sets negative flag: 0x1E
  it("ASL abs,X sets negative flag: 0x1E", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x1e, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x40); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x40

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3010)).toBe(0x80); // 0x40 << 1 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.checkedTacts).toBe(7);
  });

  // Edge case: ASL with 0x00
  it("ASL A with 0x00 produces zero: 0x0A", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0a], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x00 << 1 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.checkedTacts).toBe(2);
  });

  // Edge case: ASL with 0xFF (all bits set)
  it("ASL A with 0xFF sets carry and negative: 0x0A", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0a], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0xfe); // 0xFF << 1 = 0xFE
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.checkedTacts).toBe(2);
  });

  // Test specific bit patterns - alternating bits low
  it("ASL A with alternating bit pattern (0x55): 0x0A", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0a], 0x1000, 0x1000);
    machine.cpu.a = 0x55; // Set Accumulator to 0x55 = binary 01010101

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0xaa); // 01010101 << 1 = 10101010
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.checkedTacts).toBe(2);
  });

  // Test specific bit patterns - alternating bits high
  it("ASL A with alternating bit pattern (0xAA): 0x0A", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0a], 0x1000, 0x1000);
    machine.cpu.a = 0xaa; // Set Accumulator to 0xAA = binary 10101010

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x54); // 10101010 << 1 = 01010100
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.checkedTacts).toBe(2);
  });

  // Test bit pattern that produces exactly 0x80 (negative flag boundary)
  it("ASL A producing exactly 0x80: 0x0A", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0a], 0x1000, 0x1000);
    machine.cpu.a = 0x40; // Set Accumulator to 0x40

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0x40 << 1 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.checkedTacts).toBe(2);
  });

  // Test that ASL doesn't affect other flags
  it("ASL A preserves other flags: 0x0A", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0a], 0x1000, 0x1000);
    machine.cpu.a = 0x01; // Set Accumulator to 0x01
    // Set some other flags before the operation
    machine.cpu.p = 0b01101000; // Set V, B, D flags

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x02); // 0x01 << 1 = 0x02
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.isCFlagSet()).toBe(false);
    // Check that other flags are preserved
    expect(machine.cpu.isVFlagSet()).toBe(true);
    expect(machine.cpu.isBFlagSet()).toBe(false);
    expect(machine.cpu.isDFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.checkedTacts).toBe(2);
  });
});
