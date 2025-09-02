import { describe, expect, it } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";

describe("M6510 Registers store instructions", () => {
  // STA (zp,X): 0x81
  it("STA (zp,X) works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x81, 0x20], 0x1000, 0x1000);
    machine.cpu.a = 0x42; // Set Accumulator to 0x42
    machine.cpu.x = 0x04; // Set X Register to 0x04

    // Set up indirect address at zero page location 0x20 + 0x04 = 0x24
    machine.writeMemory(0x24, 0x80); // Low byte of target address
    machine.writeMemory(0x25, 0x30); // High byte of target address (target = 0x3080)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3080)).toBe(0x42);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // STA (zp,X) with wrap-around: 0x81
  it("STA (zp,X) handles zero page wrap-around", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x81, 0xfe], 0x1000, 0x1000);
    machine.cpu.a = 0x66; // Set Accumulator to 0x66
    machine.cpu.x = 0x03; // Set X Register to 0x03

    // Zero page address 0xFE + 0x03 = 0x01 (wrapped)
    machine.writeMemory(0x01, 0x00); // Low byte of target address
    machine.writeMemory(0x02, 0x50); // High byte of target address (target = 0x5000)

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x5000)).toBe(0x66);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // STY zp: 0x84
  it("STY zp works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x84, 0x50], 0x1000, 0x1000);
    machine.cpu.y = 0x33; // Set Y Register to 0x33

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x50)).toBe(0x33);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(3);
  });

  // STA zp: 0x85
  it("STA zp works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x85, 0x34], 0x1000, 0x1000);
    machine.cpu.a = 0x12; // Set Accumulator to 0x12

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x34)).toBe(0x12);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(3);
  });

  // STX zp: 0x86
  it("STX zp works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x86, 0x60], 0x1000, 0x1000);
    machine.cpu.x = 0x55; // Set X Register to 0x55

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x60)).toBe(0x55);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(3);
  });

  // STY abs: 0x8C
  it("STY abs works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x8c, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.y = 0x77; // Set Y Register to 0x77

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0x77);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // STA abs: 0x8D
  it("STA abs works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x8d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0x88; // Set Accumulator to 0x88

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0x88);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // STX abs: 0x8E
  it("STX abs works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x8e, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.x = 0x99; // Set X Register to 0x99

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0x99);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  // STA (zp),Y: 0x91
  it("STA (zp),Y works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x91, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0xaa; // Set Accumulator to 0xAA
    machine.cpu.y = 0x05; // Set Y Register to 0x05

    // Set up indirect address at zero page location 0x30
    machine.writeMemory(0x30, 0x00); // Low byte of base address
    machine.writeMemory(0x31, 0x40); // High byte of base address (base = 0x4000)
    // Effective address = 0x4000 + 0x05 = 0x4005

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x4005)).toBe(0xaa);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // STA (zp),Y with address wrap-around: 0x91
  it("STA (zp),Y handles address wrap-around", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x91, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0xbb; // Set Accumulator to 0xBB
    machine.cpu.y = 0xff; // Set Y Register to 0xFF

    // Set up indirect address at zero page location 0x30
    machine.writeMemory(0x30, 0x01); // Low byte of base address
    machine.writeMemory(0x31, 0xff); // High byte of base address (base = 0xFF01)
    // Effective address = 0xFF01 + 0xFF = 0x10000 -> wraps to 0x0000

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x0000)).toBe(0xbb);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  // STY zp,X: 0x94
  it("STY zp,X works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x94, 0x40], 0x1000, 0x1000);
    machine.cpu.y = 0xbb; // Set Y Register to 0xBB
    machine.cpu.x = 0x03; // Set X Register to 0x03

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x43)).toBe(0xbb); // Effective address is 0x40 + 0x03 = 0x43
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(4);
  });

  // STA zp,X: 0x95
  it("STA zp,X works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x95, 0x34], 0x1000, 0x1000);
    machine.cpu.a = 0x12; // Set Accumulator to 0x12
    machine.cpu.x = 0x02; // Set X Register to 0x02

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x36)).toBe(0x12); // Effective address is 0x34 + 0x02 = 0x36
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(4);
  });

  // STX zp,Y: 0x96
  it("STX zp,Y works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x96, 0x50], 0x1000, 0x1000);
    machine.cpu.x = 0xcc; // Set X Register to 0xCC
    machine.cpu.y = 0x07; // Set Y Register to 0x07

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x57)).toBe(0xcc); // Effective address is 0x50 + 0x07 = 0x57
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(4);
  });

  // STA abs,Y: 0x99
  it("STA abs,Y works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x99, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0xdd; // Set Accumulator to 0xDD
    machine.cpu.y = 0x10; // Set Y Register to 0x10

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3010)).toBe(0xdd); // Effective address is 0x3000 + 0x10 = 0x3010
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(5);
  });

  // STA abs,X: 0x9D
  it("STA abs,X works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x9d, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.a = 0xee; // Set Accumulator to 0xEE
    machine.cpu.x = 0x08; // Set X Register to 0x08

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3008)).toBe(0xee); // Effective address is 0x3000 + 0x08 = 0x3008
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(5);
  });

  // Test with zero values: 0x85
  it("STA zp works with zero accumulator", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x85, 0x34], 0x1000, 0x1000);
    machine.cpu.a = 0x00; // Set Accumulator to 0x00

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x34)).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(3);
  });

  // Test with 0xFF values: 0x86
  it("STX zp works with 0xFF", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x86, 0x60], 0x1000, 0x1000);
    machine.cpu.x = 0xff; // Set X Register to 0xFF

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x60)).toBe(0xff);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(3);
  });
});

describe("M6510 DEC and INC instructions", () => {
  // DEY: 0x88
  it("DEY works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x88], 0x1000, 0x1000);
    machine.cpu.y = 0x05; // Set Y Register to 0x05

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x04);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
  });

  // DEY with zero result: 0x88
  it("DEY sets zero flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x88], 0x1000, 0x1000);
    machine.cpu.y = 0x01; // Set Y Register to 0x01

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
  });

  // DEY with wrap-around: 0x88
  it("DEY wraps around from 0 to 0xFF", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0x88], 0x1000, 0x1000);
    machine.cpu.y = 0x00; // Set Y Register to 0x00

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0xff);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
  });

  // DEC zp: 0xC6
  it("DEC zp works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xc6, 0x50], 0x1000, 0x1000);
    machine.writeMemory(0x50, 0x05); // Set memory at 0x50 to 0x05

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x50)).toBe(0x04);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);

    expect(machine.cpu.tacts).toBe(5);
  });

  // DEC zp with zero result: 0xC6
  it("DEC zp sets zero flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xc6, 0x50], 0x1000, 0x1000);
    machine.writeMemory(0x50, 0x01); // Set memory at 0x50 to 0x01

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x50)).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);

    expect(machine.cpu.tacts).toBe(5);
  });

  // DEC zp with wrap-around: 0xC6
  it("DEC zp wraps around from 0 to 0xFF", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xc6, 0x50], 0x1000, 0x1000);
    machine.writeMemory(0x50, 0x00); // Set memory at 0x50 to 0x00

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x50)).toBe(0xff);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);

    expect(machine.cpu.tacts).toBe(5);
  });

  // INY: 0xC8
  it("INY works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xc8], 0x1000, 0x1000);
    machine.cpu.y = 0x05; // Set Y Register to 0x05

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x06);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);

    expect(machine.cpu.tacts).toBe(2);
  });

  // INY with wrap-around: 0xC8
  it("INY wraps around from 0xFF to 0x00", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xc8], 0x1000, 0x1000);
    machine.cpu.y = 0xff; // Set Y Register to 0xFF

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
  });

  // INY sets negative flag: 0xC8
  it("INY sets negative flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xc8], 0x1000, 0x1000);
    machine.cpu.y = 0x7f; // Set Y Register to 0x7F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x80);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
  });

  // DEX: 0xCA
  it("DEX works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xca], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X Register to 0x05

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x04);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
  });

  // DEX with zero result: 0xCA
  it("DEX sets zero flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xca], 0x1000, 0x1000);
    machine.cpu.x = 0x01; // Set X Register to 0x01

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
  });

  // DEX with wrap-around: 0xCA
  it("DEX wraps around from 0x00 to 0xFF", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xca], 0x1000, 0x1000);
    machine.cpu.x = 0x00; // Set X Register to 0x00

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0xff);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
  });

  // DEX sets negative flag: 0xCA
  it("DEX sets negative flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xca], 0x1000, 0x1000);
    machine.cpu.x = 0x81; // Set X Register to 0x81

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x80);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
  });

  // DEC abs: 0xCE
  it("DEC abs works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xce, 0x00, 0x30], 0x1000, 0x1000);
    machine.writeMemory(0x3000, 0x05); // Set memory at 0x3000 to 0x05

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0x04);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);

    expect(machine.cpu.tacts).toBe(6);
  });

  // DEC abs sets zero flag: 0xCE
  it("DEC abs sets zero flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xce, 0x00, 0x30], 0x1000, 0x1000);
    machine.writeMemory(0x3000, 0x01); // Set memory at 0x3000 to 0x01

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);

    expect(machine.cpu.tacts).toBe(6);
  });

  // DEC abs with wrap-around: 0xCE
  it("DEC abs wraps around from 0x00 to 0xFF", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xce, 0x00, 0x30], 0x1000, 0x1000);
    machine.writeMemory(0x3000, 0x00); // Set memory at 0x3000 to 0x00

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0xff);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);

    expect(machine.cpu.tacts).toBe(6);
  });

  // DEC abs sets negative flag: 0xCE
  it("DEC abs sets negative flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xce, 0x00, 0x30], 0x1000, 0x1000);
    machine.writeMemory(0x3000, 0x81); // Set memory at 0x3000 to 0x81

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0x80);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);

    expect(machine.cpu.tacts).toBe(6);
  });

  // DEC zp,X: 0xD6
  it("DEC zp,X works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xd6, 0x50], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x08); // Set memory at 0x50 + 0x05 = 0x55 to 0x08

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x55)).toBe(0x07);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);

    expect(machine.cpu.tacts).toBe(6);
  });

  // DEC zp,X with zero page wrap-around: 0xD6
  it("DEC zp,X handles zero page wrap-around", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xd6, 0xff], 0x1000, 0x1000);
    machine.cpu.x = 0x02; // Set X Register to 0x02
    machine.writeMemory(0x01, 0x0a); // Set memory at 0xFF + 0x02 = 0x01 (wrapped) to 0x0A

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x01)).toBe(0x09);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
  });

  // DEC zp,X sets zero flag: 0xD6
  it("DEC zp,X sets zero flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xd6, 0x50], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x01); // Set memory at 0x50 + 0x05 = 0x55 to 0x01

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x55)).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
  });

  // DEC zp,X wraps around from 0x00 to 0xFF: 0xD6
  it("DEC zp,X wraps around from 0x00 to 0xFF", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xd6, 0x50], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x00); // Set memory at 0x50 + 0x05 = 0x55 to 0x00

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x55)).toBe(0xff);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
  });

  // DEC zp,X sets negative flag: 0xD6
  it("DEC zp,X sets negative flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xd6, 0x50], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x81); // Set memory at 0x50 + 0x05 = 0x55 to 0x81

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x55)).toBe(0x80);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
  });

  // DEC abs,X: 0xDE
  it("DEC abs,X works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xde, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x05); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x05

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3010)).toBe(0x04);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);

    expect(machine.cpu.tacts).toBe(7);
  });

  // DEC abs,X sets zero flag: 0xDE
  it("DEC abs,X sets zero flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xde, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x01); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x01

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3010)).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);

    expect(machine.cpu.tacts).toBe(7);
  });

  // DEC abs,X wraps around from 0x00 to 0xFF: 0xDE
  it("DEC abs,X wraps around from 0x00 to 0xFF", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xde, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x00); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x00

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3010)).toBe(0xff);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);

    expect(machine.cpu.tacts).toBe(7);
  });

  // DEC abs,X sets negative flag: 0xDE
  it("DEC abs,X sets negative flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xde, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x81); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x81

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3010)).toBe(0x80);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);

    expect(machine.cpu.tacts).toBe(7);
  });

  // INC zp: 0xE6
  it("INC zp works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xe6, 0x50], 0x1000, 0x1000);
    machine.writeMemory(0x50, 0x05); // Set memory at 0x50 to 0x05

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x50)).toBe(0x06);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);

    expect(machine.cpu.tacts).toBe(5);
  });

  // INC zp with wrap-around: 0xE6
  it("INC zp wraps around from 0xFF to 0x00", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xe6, 0x50], 0x1000, 0x1000);
    machine.writeMemory(0x50, 0xff); // Set memory at 0x50 to 0xFF

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x50)).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);

    expect(machine.cpu.tacts).toBe(5);
  });

  // INC zp sets negative flag: 0xE6
  it("INC zp sets negative flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xe6, 0x50], 0x1000, 0x1000);
    machine.writeMemory(0x50, 0x7f); // Set memory at 0x50 to 0x7F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x50)).toBe(0x80);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);

    expect(machine.cpu.tacts).toBe(5);
  });

  // INX: 0xE8
  it("INX works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xe8], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X Register to 0x05

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x06);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
  });

  // INX with wrap-around
  it("INX wraps around from 0xFF to 0x00", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xe8], 0x1000, 0x1000);
    machine.cpu.x = 0xff; // Set X Register to 0xFF

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
  });

  // INX sets negative flag: 0xE8
  it("INX sets negative flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xe8], 0x1000, 0x1000);
    machine.cpu.x = 0x7f; // Set X Register to 0x7F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x80);
    expect(machine.cpu.pc).toBe(0x1001);
    expect(machine.cpu.tacts).toBe(2);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
  });

  // INC abs: 0xEE
  it("INC abs works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xee, 0x00, 0x30], 0x1000, 0x1000);
    machine.writeMemory(0x3000, 0x05); // Set memory at 0x3000 to 0x05

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0x06);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);

    expect(machine.cpu.tacts).toBe(6);
  });

  // INC abs sets zero flag: 0xEE
  it("INC abs sets zero flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xee, 0x00, 0x30], 0x1000, 0x1000);
    machine.writeMemory(0x3000, 0xff); // Set memory at 0x3000 to 0xFF

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);

    expect(machine.cpu.tacts).toBe(6);
  });

  // INC abs with wrap-around: 0xEE
  it("INC abs wraps around from 0xFF to 0x00", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xee, 0x00, 0x30], 0x1000, 0x1000);
    machine.writeMemory(0x3000, 0xff); // Set memory at 0x3000 to 0xFF

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);

    expect(machine.cpu.tacts).toBe(6);
  });

  // INC abs sets negative flag: 0xEE
  it("INC abs sets negative flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xee, 0x00, 0x30], 0x1000, 0x1000);
    machine.writeMemory(0x3000, 0x7f); // Set memory at 0x3000 to 0x7F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3000)).toBe(0x80);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);

    expect(machine.cpu.tacts).toBe(6);
  });

  // INC zp,X: 0xF6
  it("INC zp,X works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xf6, 0x50], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x08); // Set memory at 0x50 + 0x05 = 0x55 to 0x08

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x55)).toBe(0x09);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);

    expect(machine.cpu.tacts).toBe(6);
  });

  // INC zp,X with zero page wrap-around: 0xF6
  it("INC zp,X handles zero page wrap-around", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xf6, 0xfe], 0x1000, 0x1000);
    machine.cpu.x = 0x03; // Set X Register to 0x03
    machine.writeMemory(0x01, 0x0a); // Set memory at 0xFE + 0x03 = 0x01 (wrapped) to 0x0A

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x01)).toBe(0x0b);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);

    expect(machine.cpu.tacts).toBe(6);
  });

  // INC zp,X sets zero flag: 0xF6
  it("INC zp,X sets zero flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xf6, 0x50], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0xff); // Set memory at 0x50 + 0x05 = 0x55 to 0xFF

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x55)).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);

    expect(machine.cpu.tacts).toBe(6);
  });

  // INC zp,X wraps around from 0xFF to 0x00: 0xF6
  it("INC zp,X wraps around from 0xFF to 0x00", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xf6, 0x50], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0xff); // Set memory at 0x50 + 0x05 = 0x55 to 0xFF

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x55)).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);

    expect(machine.cpu.tacts).toBe(6);
  });

  // INC zp,X sets negative flag: 0xF6
  it("INC zp,X sets negative flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xf6, 0x50], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X Register to 0x05
    machine.writeMemory(0x55, 0x7f); // Set memory at 0x50 + 0x05 = 0x55 to 0x7F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x55)).toBe(0x80);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
  });

  // INC abs,X: 0xFE
  it("INC abs,X works", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xfe, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x05); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x05

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3010)).toBe(0x06);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(7);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
  });

  // INC abs,X with address wrap-around: 0xFE
  it("INC abs,X handles address wrap-around", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xfe, 0xff, 0xff], 0x1000, 0x1000);
    machine.cpu.x = 0x02; // Set X Register to 0x02
    machine.writeMemory(0x0001, 0x7f); // Set memory at 0xFFFF + 0x02 = 0x0001 (wrapped) to 0x7F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x0001)).toBe(0x80);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(7);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
  });

  // INC abs,X sets zero flag: 0xFE
  it("INC abs,X sets zero flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xfe, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0xff); // Set memory at 0x3000 + 0x10 = 0x3010 to 0xFF

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3010)).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(7);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
  });

  // INC abs,X wraps around from 0xFF to 0x00: 0xFE
  it("INC abs,X wraps around from 0xFF to 0x00", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xfe, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0xff); // Set memory at 0x3000 + 0x10 = 0x3010 to 0xFF

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3010)).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(7);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
  });

  // INC abs,X sets negative flag: 0xFE
  it("INC abs,X sets negative flag", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xfe, 0x00, 0x30], 0x1000, 0x1000);
    machine.cpu.x = 0x10; // Set X Register to 0x10
    machine.writeMemory(0x3010, 0x7f); // Set memory at 0x3000 + 0x10 = 0x3010 to 0x7F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x3010)).toBe(0x80);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(7);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
  });

  // Test negative flag behavior with INC: 0xE6
  it("INC sets negative flag correctly", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xe6, 0x50], 0x1000, 0x1000);
    machine.writeMemory(0x50, 0x7f); // Set memory at 0x50 to 0x7F

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x50)).toBe(0x80);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
  });

  // Test negative flag behavior with DEC: 0xC6
  it("DEC clears negative flag correctly", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);

    machine.initCode([0xc6, 0x50], 0x1000, 0x1000);
    machine.writeMemory(0x50, 0x80); // Set memory at 0x50 to 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x50)).toBe(0x7f);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(5);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
  });
});
