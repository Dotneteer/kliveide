import { describe, it, expect } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

describe("M6510 EOR instructions", () => {
  // EOR # (Immediate): 0x49
  it("EOR # works with basic operation: 0x49", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x49, 0x0f], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33 (binary: 00110011)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3c); // 0x33 ^ 0x0F = 0x3C (binary: 00111100)
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // EOR # sets zero flag: 0x49
  it("EOR # sets zero flag: 0x49", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x49, 0x33], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x33 ^ 0x33 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // EOR # sets negative flag: 0x49
  it("EOR # sets negative flag: 0x49", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x49, 0x7f], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0xFF ^ 0x7F = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // EOR # with all bits set: 0x49
  it("EOR # with all bits set (complement): 0x49", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x49, 0xff], 0x1000, 0x1000);
    machine.cpu.a = 0xaa; // Set Accumulator to 0xAA

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x55); // 0xAA ^ 0xFF = 0x55 (complement)
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // EOR zp (Zero Page): 0x45
  it("EOR zp works: 0x45", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x45, 0x50], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.writeMemory(0x50, 0x0f); // Set memory at 0x50 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3c); // 0x33 ^ 0x0F = 0x3C
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(3);
  });

  // EOR zp sets zero flag: 0x45
  it("EOR zp sets zero flag: 0x45", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x45, 0x50], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.writeMemory(0x50, 0x33); // Set memory at 0x50 to 0x33

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x33 ^ 0x33 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(3);
  });

  // EOR zp sets negative flag: 0x45
  it("EOR zp sets negative flag: 0x45", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x45, 0x50], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF
    machine.writeMemory(0x50, 0x7f); // Set memory at 0x50 to 0x7F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0xFF ^ 0x7F = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(3);
  });

  // EOR zp,X (Zero Page,X): 0x55
  it("EOR zp,X works: 0x55", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x55, 0x50], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x0f); // Set memory at 0x50 + 0x05 = 0x55 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3c); // 0x33 ^ 0x0F = 0x3C
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(4);
  });

  // EOR zp,X with zero page wrap-around: 0x55
  it("EOR zp,X handles zero page wrap-around: 0x55", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x55, 0xff], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x02; // Set X Register to 0x02
    machine.writeMemory(0x01, 0x0f); // Set memory at 0xFF + 0x02 = 0x01 (wrapped) to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3c); // 0x33 ^ 0x0F = 0x3C
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(4);
  });

  // EOR zp,X sets zero flag: 0x55
  it("EOR zp,X sets zero flag: 0x55", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x55, 0x50], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x33); // Set memory at 0x50 + 0x05 = 0x55 to 0x33

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x33 ^ 0x33 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(4);
  });

  // EOR zp,X sets negative flag: 0x55
  it("EOR zp,X sets negative flag: 0x55", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x55, 0x50], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x7f); // Set memory at 0x50 + 0x05 = 0x55 to 0x7F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0xFF ^ 0x7F = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(4);
  });

  // EOR abs (Absolute): 0x4D
  it("EOR abs works: 0x4D", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x4d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.writeMemory(0x3000, 0x0f); // Set memory at 0x3000 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3c); // 0x33 ^ 0x0F = 0x3C
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // EOR abs sets zero flag: 0x4D
  it("EOR abs sets zero flag: 0x4D", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x4d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.writeMemory(0x3000, 0x33); // Set memory at 0x3000 to 0x33

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x33 ^ 0x33 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // EOR abs sets negative flag: 0x4D
  it("EOR abs sets negative flag: 0x4D", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x4d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF
    machine.writeMemory(0x3000, 0x7f); // Set memory at 0x3000 to 0x7F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0xFF ^ 0x7F = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // EOR abs,X (Absolute,X): 0x5D
  it("EOR abs,X works: 0x5D", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x5d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x0f); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3c); // 0x33 ^ 0x0F = 0x3C
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // EOR abs,X with page boundary crossing: 0x5D
  it("EOR abs,X with page boundary crossing: 0x5D", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x5d, 0xff, 0x2f], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x02; // Set X Register to 0x02
    machine.writeMemory(0x3001, 0x0f); // Set memory at 0x2FFF + 0x02 = 0x3001 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3c); // 0x33 ^ 0x0F = 0x3C
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(5); // Extra cycle for page boundary crossing
  });

  // EOR abs,X sets zero flag: 0x5D
  it("EOR abs,X sets zero flag: 0x5D", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x5d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x33); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x33

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x33 ^ 0x33 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // EOR abs,X sets negative flag: 0x5D
  it("EOR abs,X sets negative flag: 0x5D", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x5d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x7f); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x7F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0xFF ^ 0x7F = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // EOR abs,Y (Absolute,Y): 0x59
  it("EOR abs,Y works: 0x59", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x59, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.y = 0x10; // Set Y Register to 0x10
    machine.writeMemory(0x3010, 0x0f); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3c); // 0x33 ^ 0x0F = 0x3C
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // EOR abs,Y with page boundary crossing: 0x59
  it("EOR abs,Y with page boundary crossing: 0x59", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x59, 0xff, 0x2f], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.y = 0x02; // Set Y Register to 0x02
    machine.writeMemory(0x3001, 0x0f); // Set memory at 0x2FFF + 0x02 = 0x3001 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3c); // 0x33 ^ 0x0F = 0x3C
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(5); // Extra cycle for page boundary crossing
  });

  // EOR abs,Y sets zero flag: 0x59
  it("EOR abs,Y sets zero flag: 0x59", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x59, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.y = 0x10; // Set Y Register to 0x10
    machine.writeMemory(0x3010, 0x33); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x33

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x33 ^ 0x33 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // EOR abs,Y sets negative flag: 0x59
  it("EOR abs,Y sets negative flag: 0x59", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x59, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF
    machine.cpu.y = 0x10; // Set Y Register to 0x10
    machine.writeMemory(0x3010, 0x7f); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x7F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0xFF ^ 0x7F = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // EOR (zp,X) (Indexed Indirect): 0x41
  it("EOR (zp,X) works: 0x41", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x41, 0x20], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x04; // Set X Register to 0x04

    // Set up indirect address at zero page location 0x20 + 0x04 = 0x24
    machine.writeMemory(0x24, 0x80); // Low byte of target address
    machine.writeMemory(0x25, 0x30); // High byte of target address (target = 0x3080)
    machine.writeMemory(0x3080, 0x0f); // Set memory at target address to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3c); // 0x33 ^ 0x0F = 0x3C
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // EOR (zp,X) with wrap-around: 0x41
  it("EOR (zp,X) handles zero page wrap-around: 0x41", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x41, 0xfe], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x03; // Set X Register to 0x03

    // Zero page address 0xFE + 0x03 = 0x01 (wrapped)
    machine.writeMemory(0x01, 0x80); // Low byte of target address
    machine.writeMemory(0x02, 0x30); // High byte of target address (target = 0x3080)
    machine.writeMemory(0x3080, 0x0f); // Set memory at target address to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3c); // 0x33 ^ 0x0F = 0x3C
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // EOR (zp,X) sets zero flag: 0x41
  it("EOR (zp,X) sets zero flag: 0x41", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x41, 0x20], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.x = 0x04; // Set X Register to 0x04

    // Set up indirect address at zero page location 0x20 + 0x04 = 0x24
    machine.writeMemory(0x24, 0x80); // Low byte of target address
    machine.writeMemory(0x25, 0x30); // High byte of target address (target = 0x3080)
    machine.writeMemory(0x3080, 0x33); // Set memory at target address to 0x33

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x33 ^ 0x33 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // EOR (zp,X) sets negative flag: 0x41
  it("EOR (zp,X) sets negative flag: 0x41", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x41, 0x20], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF
    machine.cpu.x = 0x04; // Set X Register to 0x04

    // Set up indirect address at zero page location 0x20 + 0x04 = 0x24
    machine.writeMemory(0x24, 0x80); // Low byte of target address
    machine.writeMemory(0x25, 0x30); // High byte of target address (target = 0x3080)
    machine.writeMemory(0x3080, 0x7f); // Set memory at target address to 0x7F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0xFF ^ 0x7F = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // EOR (zp),Y (Indirect Indexed): 0x51
  it("EOR (zp),Y works: 0x51", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x51, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.y = 0x10; // Set Y Register to 0x10

    // Set up indirect address at zero page location 0x30
    machine.writeMemory(0x30, 0x00); // Low byte of base address
    machine.writeMemory(0x31, 0x30); // High byte of base address (base = 0x3000)
    machine.writeMemory(0x3010, 0x0f); // Set memory at base + Y = 0x3000 + 0x10 = 0x3010 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3c); // 0x33 ^ 0x0F = 0x3C
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  // EOR (zp),Y with page boundary crossing: 0x51
  it("EOR (zp),Y with page boundary crossing: 0x51", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x51, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.y = 0x02; // Set Y Register to 0x02

    // Set up indirect address at zero page location 0x30
    machine.writeMemory(0x30, 0xff); // Low byte of base address
    machine.writeMemory(0x31, 0x2f); // High byte of base address (base = 0x2FFF)
    machine.writeMemory(0x3001, 0x0f); // Set memory at base + Y = 0x2FFF + 0x02 = 0x3001 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3c); // 0x33 ^ 0x0F = 0x3C
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6); // Extra cycle for page boundary crossing
  });

  // EOR (zp),Y with zero page wrap-around: 0x51
  it("EOR (zp),Y handles zero page wrap-around: 0x51", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x51, 0xff], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.y = 0x10; // Set Y Register to 0x10

    // Set up indirect address at zero page location 0xFF
    machine.writeMemory(0xff, 0x00); // Low byte of base address
    machine.writeMemory(0x00, 0x30); // High byte of base address (wrapped to 0x00, base = 0x3000)
    machine.writeMemory(0x3010, 0x0f); // Set memory at base + Y = 0x3000 + 0x10 = 0x3010 to 0x0F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x3c); // 0x33 ^ 0x0F = 0x3C
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  // EOR (zp),Y sets zero flag: 0x51
  it("EOR (zp),Y sets zero flag: 0x51", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x51, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33
    machine.cpu.y = 0x10; // Set Y Register to 0x10

    // Set up indirect address at zero page location 0x30
    machine.writeMemory(0x30, 0x00); // Low byte of base address
    machine.writeMemory(0x31, 0x30); // High byte of base address (base = 0x3000)
    machine.writeMemory(0x3010, 0x33); // Set memory at base + Y = 0x3000 + 0x10 = 0x3010 to 0x33

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 0x33 ^ 0x33 = 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  // EOR (zp),Y sets negative flag: 0x51
  it("EOR (zp),Y sets negative flag: 0x51", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x51, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0xff; // Set Accumulator to 0xFF
    machine.cpu.y = 0x10; // Set Y Register to 0x10

    // Set up indirect address at zero page location 0x30
    machine.writeMemory(0x30, 0x00); // Low byte of base address
    machine.writeMemory(0x31, 0x30); // High byte of base address (base = 0x3000)
    machine.writeMemory(0x3010, 0x7f); // Set memory at base + Y = 0x3000 + 0x10 = 0x3010 to 0x7F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // 0xFF ^ 0x7F = 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
  });

  // Edge case: EOR with 0x00 preserves accumulator value
  it("EOR # with 0x00 preserves accumulator: 0x49", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x49, 0x00], 0x1000, 0x1000);
    machine.cpu.a = 0x55; // Set Accumulator to 0x55

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x55); // 0x55 ^ 0x00 = 0x55
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Edge case: EOR with 0xFF complements accumulator value  
  it("EOR # with 0xFF complements accumulator: 0x49", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x49, 0xff], 0x1000, 0x1000);
    machine.cpu.a = 0x33; // Set Accumulator to 0x33

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0xcc); // 0x33 ^ 0xFF = 0xCC (complement)
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Test specific bit patterns - alternating bits
  it("EOR # with alternating bit pattern: 0x49", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x49, 0x55], 0x1000, 0x1000); // 0x55 = binary 01010101
    machine.cpu.a = 0xaa; // Set Accumulator to 0xAA = binary 10101010

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0xff); // 10101010 ^ 01010101 = 11111111
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });

  // Test specific bit patterns - same bits
  it("EOR # with same bit pattern produces zero: 0x49", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x49, 0x55], 0x1000, 0x1000); // 0x55 = binary 01010101
    machine.cpu.a = 0x55; // Set Accumulator to 0x55 = binary 01010101

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // 01010101 ^ 01010101 = 00000000
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(2);
  });
});
