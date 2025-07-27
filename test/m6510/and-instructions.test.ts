import { describe, expect, it } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

describe("M6510 AND instructions", () => {
  // AND # (Immediate): 0x29
  it("AND # works with basic operation: 0x29", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x29, 0x0f], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33 (binary: 00110011)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x03); // 0x33 & 0x0F = 0x03 (binary: 00000011)
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // AND # sets zero flag: 0x29
  it("AND # sets zero flag: 0x29", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x29, 0x0f], 0x1000, 0x1000);
    machine.cpu.a = 0xf0; // Set Accumulator to 0xF0 (binary: 11110000)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0xF0 & 0x0F = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // AND # sets negative flag: 0x29
  it("AND # sets negative flag: 0x29", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x29, 0x80], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0xFF & 0x80 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // AND # with all bits set: 0x29
  it("AND # with all bits set: 0x29", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x29, 0xff], 0x1000, 0x1000);
    machine.cpu.a = 0xaa; // Set Accumulator to 0xAA

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0xaa); // 0xAA & 0xFF = 0xAA
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // AND zp (Zero Page): 0x25
  it("AND zp works: 0x25", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x25, 0x50], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.writeMemory(0x50, 0x0f); // Set memory at 0x50 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x03); // 0x33 & 0x0F = 0x03
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(3);
  });

  // AND zp sets zero flag: 0x25
  it("AND zp sets zero flag: 0x25", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x25, 0x50], 0x1000, 0x1000);
    machine.cpu.a = 0xf0; // Set Accumulator to 0xF0
    machine.writeMemory(0x50, 0x0f); // Set memory at 0x50 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0xF0 & 0x0F = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(3);
  });

  // AND zp sets negative flag: 0x25
  it("AND zp sets negative flag: 0x25", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x25, 0x50], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF
    machine.writeMemory(0x50, 0x80); // Set memory at 0x50 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0xFF & 0x80 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(3);
  });

  // AND zp,X (Zero Page,X): 0x35
  it("AND zp,X works: 0x35", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x35, 0x50], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x0f); // Set memory at 0x50 + 0x05 = 0x55 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x03); // 0x33 & 0x0F = 0x03
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(4);
  });

  // AND zp,X with zero page wrap-around: 0x35
  it("AND zp,X handles zero page wrap-around: 0x35", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x35, 0xff], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x02; // Set X Register to 0x02
    machine.writeMemory(0x01, 0x0f); // Set memory at 0xFF + 0x02 = 0x01 (wrapped) to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x03); // 0x33 & 0x0F = 0x03
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(4);
  });

  // AND zp,X sets zero flag: 0x35
  it("AND zp,X sets zero flag: 0x35", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x35, 0x50], 0x1000, 0x1000);
    machine.cpu.a = 0xf0; // Set Accumulator to 0xF0
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x0f); // Set memory at 0x50 + 0x05 = 0x55 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0xF0 & 0x0F = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(4);
  });

  // AND zp,X sets negative flag: 0x35
  it("AND zp,X sets negative flag: 0x35", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x35, 0x50], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x80); // Set memory at 0x50 + 0x05 = 0x55 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0xFF & 0x80 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(4);
  });

  // AND abs (Absolute): 0x2D
  it("AND abs works: 0x2D", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x2d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.writeMemory(0x3000, 0x0f); // Set memory at 0x3000 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x03); // 0x33 & 0x0F = 0x03
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // AND abs sets zero flag: 0x2D
  it("AND abs sets zero flag: 0x2D", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x2d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0xf0; // Set Accumulator to 0xF0
    machine.writeMemory(0x3000, 0x0f); // Set memory at 0x3000 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0xF0 & 0x0F = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // AND abs sets negative flag: 0x2D
  it("AND abs sets negative flag: 0x2D", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x2d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF
    machine.writeMemory(0x3000, 0x80); // Set memory at 0x3000 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0xFF & 0x80 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // AND abs,X (Absolute,X): 0x3D
  it("AND abs,X works: 0x3D", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x3d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x0f); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x03); // 0x33 & 0x0F = 0x03
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // AND abs,X with page boundary crossing: 0x3D
  it("AND abs,X with page boundary crossing: 0x3D", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x3d, 0xff, 0x2f], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x02; // Set X Register to 0x02
    machine.writeMemory(0x3001, 0x0f); // Set memory at 0x2FFF + 0x02 = 0x3001 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x03); // 0x33 & 0x0F = 0x03
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(5); // Extra cycle for page boundary crossing
  });

  // AND abs,X sets zero flag: 0x3D
  it("AND abs,X sets zero flag: 0x3D", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x3d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0xf0; // Set Accumulator to 0xF0
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x0f); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0xF0 & 0x0F = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // AND abs,X sets negative flag: 0x3D
  it("AND abs,X sets negative flag: 0x3D", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x3d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x80); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0xFF & 0x80 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // AND abs,Y (Absolute,Y): 0x39
  it("AND abs,Y works: 0x39", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x39, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.y = 0x10; // Set Y Register to 0x10
    machine.writeMemory(0x3010, 0x0f); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x03); // 0x33 & 0x0F = 0x03
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // AND abs,Y with page boundary crossing: 0x39
  it("AND abs,Y with page boundary crossing: 0x39", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x39, 0xff, 0x2f], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.y = 0x02; // Set Y Register to 0x02
    machine.writeMemory(0x3001, 0x0f); // Set memory at 0x2FFF + 0x02 = 0x3001 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x03); // 0x33 & 0x0F = 0x03
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(5); // Extra cycle for page boundary crossing
  });

  // AND abs,Y sets zero flag: 0x39
  it("AND abs,Y sets zero flag: 0x39", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x39, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0xf0; // Set Accumulator to 0xF0
    machine.cpu.y = 0x10; // Set Y Register to 0x10
    machine.writeMemory(0x3010, 0x0f); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0xF0 & 0x0F = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // AND abs,Y sets negative flag: 0x39
  it("AND abs,Y sets negative flag: 0x39", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x39, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF
    machine.cpu.y = 0x10; // Set Y Register to 0x10
    machine.writeMemory(0x3010, 0x80); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0xFF & 0x80 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // AND (zp,X) (Indexed Indirect): 0x21
  it("AND (zp,X) works: 0x21", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x21, 0x20], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x04; // Set X Register to 0x04

    // Set up indirect address at zero page location 0x20 + 0x04 = 0x24
    machine.writeMemory(0x24, 0x80); // Low byte of target address
    machine.writeMemory(0x25, 0x30); // High byte of target address (target = 0x3080)
    machine.writeMemory(0x3080, 0x0f); // Set memory at target address to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x03); // 0x33 & 0x0F = 0x03
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // AND (zp,X) with wrap-around: 0x21
  it("AND (zp,X) handles zero page wrap-around: 0x21", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x21, 0xfe], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x03; // Set X Register to 0x03

    // Zero page address 0xFE + 0x03 = 0x01 (wrapped)
    machine.writeMemory(0x01, 0x80); // Low byte of target address
    machine.writeMemory(0x02, 0x30); // High byte of target address (target = 0x3080)
    machine.writeMemory(0x3080, 0x0f); // Set memory at target address to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x03); // 0x33 & 0x0F = 0x03
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // AND (zp,X) sets zero flag: 0x21
  it("AND (zp,X) sets zero flag: 0x21", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x21, 0x20], 0x1000, 0x1000);
    machine.cpu.a = 0xf0; // Set Accumulator to 0xF0
    machine.cpu.x = 0x04; // Set X Register to 0x04

    // Set up indirect address at zero page location 0x20 + 0x04 = 0x24
    machine.writeMemory(0x24, 0x80); // Low byte of target address
    machine.writeMemory(0x25, 0x30); // High byte of target address (target = 0x3080)
    machine.writeMemory(0x3080, 0x0f); // Set memory at target address to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0xF0 & 0x0F = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // AND (zp,X) sets negative flag: 0x21
  it("AND (zp,X) sets negative flag: 0x21", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x21, 0x20], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF
    machine.cpu.x = 0x04; // Set X Register to 0x04

    // Set up indirect address at zero page location 0x20 + 0x04 = 0x24
    machine.writeMemory(0x24, 0x80); // Low byte of target address
    machine.writeMemory(0x25, 0x30); // High byte of target address (target = 0x3080)
    machine.writeMemory(0x3080, 0x80); // Set memory at target address to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0xFF & 0x80 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // AND (zp),Y (Indirect Indexed): 0x31
  it("AND (zp),Y works: 0x31", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x31, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.y = 0x10; // Set Y Register to 0x10

    // Set up indirect address at zero page location 0x30
    machine.writeMemory(0x30, 0x00); // Low byte of base address
    machine.writeMemory(0x31, 0x30); // High byte of base address (base = 0x3000)
    machine.writeMemory(0x3010, 0x0f); // Set memory at base + Y = 0x3000 + 0x10 = 0x3010 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x03); // 0x33 & 0x0F = 0x03
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  // AND (zp),Y with page boundary crossing: 0x31
  it("AND (zp),Y with page boundary crossing: 0x31", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x31, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.y = 0x02; // Set Y Register to 0x02

    // Set up indirect address at zero page location 0x30
    machine.writeMemory(0x30, 0xff); // Low byte of base address
    machine.writeMemory(0x31, 0x2f); // High byte of base address (base = 0x2FFF)
    machine.writeMemory(0x3001, 0x0f); // Set memory at base + Y = 0x2FFF + 0x02 = 0x3001 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x03); // 0x33 & 0x0F = 0x03
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6); // Extra cycle for page boundary crossing
  });

  // AND (zp),Y with zero page wrap-around: 0x31
  it("AND (zp),Y handles zero page wrap-around: 0x31", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x31, 0xff], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.y = 0x10; // Set Y Register to 0x10

    // Set up indirect address at zero page location 0xFF
    machine.writeMemory(0xff, 0x00); // Low byte of base address
    machine.writeMemory(0x00, 0x30); // High byte of base address (wrapped to 0x00, base = 0x3000)
    machine.writeMemory(0x3010, 0x0f); // Set memory at base + Y = 0x3000 + 0x10 = 0x3010 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x03); // 0x33 & 0x0F = 0x03
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  // AND (zp),Y sets zero flag: 0x31
  it("AND (zp),Y sets zero flag: 0x31", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x31, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0xf0; // Set Accumulator to 0xF0
    machine.cpu.y = 0x10; // Set Y Register to 0x10

    // Set up indirect address at zero page location 0x30
    machine.writeMemory(0x30, 0x00); // Low byte of base address
    machine.writeMemory(0x31, 0x30); // High byte of base address (base = 0x3000)
    machine.writeMemory(0x3010, 0x0f); // Set memory at base + Y = 0x3000 + 0x10 = 0x3010 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0xF0 & 0x0F = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  // AND (zp),Y sets negative flag: 0x31
  it("AND (zp),Y sets negative flag: 0x31", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x31, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF
    machine.cpu.y = 0x10; // Set Y Register to 0x10

    // Set up indirect address at zero page location 0x30
    machine.writeMemory(0x30, 0x00); // Low byte of base address
    machine.writeMemory(0x31, 0x30); // High byte of base address (base = 0x3000)
    machine.writeMemory(0x3010, 0x80); // Set memory at base + Y = 0x3000 + 0x10 = 0x3010 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0xFF & 0x80 = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  // Edge case: AND with 0x00 always produces zero
  it("AND # with 0x00 always produces zero: 0x29", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x29, 0x00], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0xFF & 0x00 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Edge case: AND with 0xFF preserves accumulator value
  it("AND # with 0xFF preserves accumulator: 0x29", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x29, 0xff], 0x1000, 0x1000);
    machine.cpu.a = 0x55; // Set Accumulator to 0x55

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x55); // 0x55 & 0xFF = 0x55
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Test specific bit patterns
  it("AND # with alternating bit pattern: 0x29", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x29, 0x55], 0x1000, 0x1000); // 0x55 = binary 01010101
    machine.cpu.a = 0xaa; // Set Accumulator to 0xAA = binary 10101010

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 10101010 & 01010101 = 00000000
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Test same bit patterns
  it("AND # with same bit pattern: 0x29", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x29, 0x55], 0x1000, 0x1000); // 0x55 = binary 01010101
    machine.cpu.a = 0x55; // Set Accumulator to 0x55 = binary 01010101

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x55); // 01010101 & 01010101 = 01010101
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });
});
