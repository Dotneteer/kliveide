import { describe, it, expect } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";

describe("M6510 ORA instructions", () => {
  // ORA # (Immediate): 0x09
  it("ORA # works with basic operation: 0x09", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x09, 0x0f], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33 (binary: 00110011)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3f); // 0x33 | 0x0F = 0x3F (binary: 00111111)
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // ORA # sets zero flag: 0x09
  it("ORA # sets zero flag: 0x09", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x09, 0x00], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x00 | 0x00 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // ORA # sets negative flag: 0x09
  it("ORA # sets negative flag: 0x09", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x09, 0x80], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0x00 | 0x80 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // ORA # with all bits set: 0x09
  it("ORA # with all bits set: 0x09", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x09, 0xff], 0x1000, 0x1000);
    machine.cpu.a = 0x55; // Set Accumulator to 0x55

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0xff); // 0x55 | 0xFF = 0xFF
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // ORA zp (Zero Page): 0x05
  it("ORA zp works: 0x05", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x05, 0x50], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.writeMemory(0x50, 0x0f); // Set memory at 0x50 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3f); // 0x33 | 0x0F = 0x3F
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(3);
  });

  // ORA zp sets zero flag: 0x05
  it("ORA zp sets zero flag: 0x05", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x05, 0x50], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00
    machine.writeMemory(0x50, 0x00); // Set memory at 0x50 to 0x00

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x00 | 0x00 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(3);
  });

  // ORA zp sets negative flag: 0x05
  it("ORA zp sets negative flag: 0x05", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x05, 0x50], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00
    machine.writeMemory(0x50, 0x80); // Set memory at 0x50 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0x00 | 0x80 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(3);
  });

  // ORA zp,X (Zero Page,X): 0x15
  it("ORA zp,X works: 0x15", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x15, 0x50], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x0f); // Set memory at 0x50 + 0x05 = 0x55 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3f); // 0x33 | 0x0F = 0x3F
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(4);
  });

  // ORA zp,X with zero page wrap-around: 0x15
  it("ORA zp,X handles zero page wrap-around: 0x15", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x15, 0xff], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x02; // Set X Register to 0x02
    machine.writeMemory(0x01, 0x0f); // Set memory at 0xFF + 0x02 = 0x01 (wrapped) to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3f); // 0x33 | 0x0F = 0x3F
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(4);
  });

  // ORA zp,X sets zero flag: 0x15
  it("ORA zp,X sets zero flag: 0x15", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x15, 0x50], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x00); // Set memory at 0x50 + 0x05 = 0x55 to 0x00

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x00 | 0x00 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(4);
  });

  // ORA zp,X sets negative flag: 0x15
  it("ORA zp,X sets negative flag: 0x15", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x15, 0x50], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x80); // Set memory at 0x50 + 0x05 = 0x55 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0x00 | 0x80 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(4);
  });

  // ORA abs (Absolute): 0x0D
  it("ORA abs works: 0x0D", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.writeMemory(0x3000, 0x0f); // Set memory at 0x3000 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3f); // 0x33 | 0x0F = 0x3F
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // ORA abs sets zero flag: 0x0D
  it("ORA abs sets zero flag: 0x0D", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00
    machine.writeMemory(0x3000, 0x00); // Set memory at 0x3000 to 0x00

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x00 | 0x00 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // ORA abs sets negative flag: 0x0D
  it("ORA abs sets negative flag: 0x0D", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00
    machine.writeMemory(0x3000, 0x80); // Set memory at 0x3000 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0x00 | 0x80 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // ORA abs,X (Absolute,X): 0x1D
  it("ORA abs,X works: 0x1D", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x1d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x0f); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3f); // 0x33 | 0x0F = 0x3F
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // ORA abs,X with page boundary crossing: 0x1D
  it("ORA abs,X with page boundary crossing: 0x1D", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x1d, 0xff, 0x2f], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x02; // Set X Register to 0x02
    machine.writeMemory(0x3001, 0x0f); // Set memory at 0x2FFF + 0x02 = 0x3001 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3f); // 0x33 | 0x0F = 0x3F
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(5); // Extra cycle for page boundary crossing
  });

  // ORA abs,X sets zero flag: 0x1D
  it("ORA abs,X sets zero flag: 0x1D", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x1d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x00); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x00

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x00 | 0x00 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // ORA abs,X sets negative flag: 0x1D
  it("ORA abs,X sets negative flag: 0x1D", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x1d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x80); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0x00 | 0x80 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // ORA abs,Y (Absolute,Y): 0x19
  it("ORA abs,Y works: 0x19", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x19, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.y = 0x10; // Set Y Register to 0x10
    machine.writeMemory(0x3010, 0x0f); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3f); // 0x33 | 0x0F = 0x3F
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // ORA abs,Y with page boundary crossing: 0x19
  it("ORA abs,Y with page boundary crossing: 0x19", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x19, 0xff, 0x2f], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.y = 0x02; // Set Y Register to 0x02
    machine.writeMemory(0x3001, 0x0f); // Set memory at 0x2FFF + 0x02 = 0x3001 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3f); // 0x33 | 0x0F = 0x3F
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(5); // Extra cycle for page boundary crossing
  });

  // ORA abs,Y sets zero flag: 0x19
  it("ORA abs,Y sets zero flag: 0x19", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x19, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00
    machine.cpu.y = 0x10; // Set Y Register to 0x10
    machine.writeMemory(0x3010, 0x00); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x00

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x00 | 0x00 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // ORA abs,Y sets negative flag: 0x19
  it("ORA abs,Y sets negative flag: 0x19", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x19, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00
    machine.cpu.y = 0x10; // Set Y Register to 0x10
    machine.writeMemory(0x3010, 0x80); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0x00 | 0x80 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // ORA (zp,X) (Indexed Indirect): 0x01
  it("ORA (zp,X) works: 0x01", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x01, 0x20], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x04; // Set X Register to 0x04

    // Set up indirect address at zero page location 0x20 + 0x04 = 0x24
    machine.writeMemory(0x24, 0x80); // Low byte of target address
    machine.writeMemory(0x25, 0x30); // High byte of target address (target = 0x3080)
    machine.writeMemory(0x3080, 0x0f); // Set memory at target address to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3f); // 0x33 | 0x0F = 0x3F
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // ORA (zp,X) with wrap-around: 0x01
  it("ORA (zp,X) handles zero page wrap-around: 0x01", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x01, 0xfe], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x03; // Set X Register to 0x03

    // Zero page address 0xFE + 0x03 = 0x01 (wrapped)
    machine.writeMemory(0x01, 0x80); // Low byte of target address
    machine.writeMemory(0x02, 0x30); // High byte of target address (target = 0x3080)
    machine.writeMemory(0x3080, 0x0f); // Set memory at target address to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3f); // 0x33 | 0x0F = 0x3F
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // ORA (zp,X) sets zero flag: 0x01
  it("ORA (zp,X) sets zero flag: 0x01", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x01, 0x20], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00
    machine.cpu.x = 0x04; // Set X Register to 0x04

    // Set up indirect address at zero page location 0x20 + 0x04 = 0x24
    machine.writeMemory(0x24, 0x80); // Low byte of target address
    machine.writeMemory(0x25, 0x30); // High byte of target address (target = 0x3080)
    machine.writeMemory(0x3080, 0x00); // Set memory at target address to 0x00

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x00 | 0x00 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // ORA (zp,X) sets negative flag: 0x01
  it("ORA (zp,X) sets negative flag: 0x01", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x01, 0x20], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00
    machine.cpu.x = 0x04; // Set X Register to 0x04

    // Set up indirect address at zero page location 0x20 + 0x04 = 0x24
    machine.writeMemory(0x24, 0x80); // Low byte of target address
    machine.writeMemory(0x25, 0x30); // High byte of target address (target = 0x3080)
    machine.writeMemory(0x3080, 0x80); // Set memory at target address to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0x00 | 0x80 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // ORA (zp),Y (Indirect Indexed): 0x11
  it("ORA (zp),Y works: 0x11", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x11, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.y = 0x10; // Set Y Register to 0x10

    // Set up indirect address at zero page location 0x30
    machine.writeMemory(0x30, 0x00); // Low byte of base address
    machine.writeMemory(0x31, 0x30); // High byte of base address (base = 0x3000)
    machine.writeMemory(0x3010, 0x0f); // Set memory at base + Y = 0x3000 + 0x10 = 0x3010 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3f); // 0x33 | 0x0F = 0x3F
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  // ORA (zp),Y with page boundary crossing: 0x11
  it("ORA (zp),Y with page boundary crossing: 0x11", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x11, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.y = 0x02; // Set Y Register to 0x02

    // Set up indirect address at zero page location 0x30
    machine.writeMemory(0x30, 0xff); // Low byte of base address
    machine.writeMemory(0x31, 0x2f); // High byte of base address (base = 0x2FFF)
    machine.writeMemory(0x3001, 0x0f); // Set memory at base + Y = 0x2FFF + 0x02 = 0x3001 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3f); // 0x33 | 0x0F = 0x3F
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6); // Extra cycle for page boundary crossing
  });

  // ORA (zp),Y with zero page wrap-around: 0x11
  it("ORA (zp),Y handles zero page wrap-around: 0x11", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x11, 0xff], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.y = 0x10; // Set Y Register to 0x10

    // Set up indirect address at zero page location 0xFF
    machine.writeMemory(0xff, 0x00); // Low byte of base address
    machine.writeMemory(0x00, 0x30); // High byte of base address (wrapped to 0x00, base = 0x3000)
    machine.writeMemory(0x3010, 0x0f); // Set memory at base + Y = 0x3000 + 0x10 = 0x3010 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3f); // 0x33 | 0x0F = 0x3F
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  // ORA (zp),Y sets zero flag: 0x11
  it("ORA (zp),Y sets zero flag: 0x11", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x11, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00
    machine.cpu.y = 0x10; // Set Y Register to 0x10

    // Set up indirect address at zero page location 0x30
    machine.writeMemory(0x30, 0x00); // Low byte of base address
    machine.writeMemory(0x31, 0x30); // High byte of base address (base = 0x3000)
    machine.writeMemory(0x3010, 0x00); // Set memory at base + Y = 0x3000 + 0x10 = 0x3010 to 0x00

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x00 | 0x00 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  // ORA (zp),Y sets negative flag: 0x11
  it("ORA (zp),Y sets negative flag: 0x11", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x11, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00
    machine.cpu.y = 0x10; // Set Y Register to 0x10

    // Set up indirect address at zero page location 0x30
    machine.writeMemory(0x30, 0x00); // Low byte of base address
    machine.writeMemory(0x31, 0x30); // High byte of base address (base = 0x3000)
    machine.writeMemory(0x3010, 0x80); // Set memory at base + Y = 0x3000 + 0x10 = 0x3010 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0x00 | 0x80 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  // Edge case: ORA with 0x00 preserves accumulator value
  it("ORA # with 0x00 preserves accumulator: 0x09", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x09, 0x00], 0x1000, 0x1000);
    machine.cpu.a = 0x55; // Set Accumulator to 0x55

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x55); // 0x55 | 0x00 = 0x55
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Edge case: ORA with 0xFF always produces 0xFF  
  it("ORA # with 0xFF always produces 0xFF: 0x09", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x09, 0xff], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0xff); // 0x33 | 0xFF = 0xFF
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Test specific bit patterns - alternating bits
  it("ORA # with alternating bit pattern: 0x09", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x09, 0x55], 0x1000, 0x1000); // 0x55 = binary 01010101
    machine.cpu.a = 0xaa; // Set Accumulator to 0xAA = binary 10101010

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0xff); // 10101010 | 01010101 = 11111111
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Test specific bit patterns - same bits
  it("ORA # with same bit pattern: 0x09", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x09, 0x55], 0x1000, 0x1000); // 0x55 = binary 01010101
    machine.cpu.a = 0x55; // Set Accumulator to 0x55 = binary 01010101

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x55); // 01010101 | 01010101 = 01010101
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });
});
