import { describe, it, expect } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";

/**
 * Tests for the SYA (SHY) undocumented instruction
 *
 * SYA performs an AND operation between the Y register and the high byte
 * of the target address + 1, then stores the result to memory.
 *
 * Opcodes:
 * - 0x9C: SYA abs,X - Absolute,X
 */
describe("M6510 Undocumented Instructions - SYA", () => {
  it("SYA abs,X - should store Y AND (high+1) to memory (0x9C)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9C, 0x00, 0x30], 0x1000, 0x1000); // SYA $3000,X
    machine.cpu.y = 0xFF;
    machine.cpu.x = 0x05;
    
    // Target address will be $3000 + $05 = $3005
    // High byte of target address is $30, so high+1 = $31

    // --- Act
    machine.run();

    // --- Assert
    // Result should be Y AND (high+1) = 0xFF AND 0x31 = 0x31
    expect(machine.readMemory(0x3005)).toBe(0x31);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(5);
  });

  it("SYA abs,X - with different Y register value", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9C, 0x00, 0x40], 0x1000, 0x1000); // SYA $4000,X
    machine.cpu.y = 0x55;
    machine.cpu.x = 0x10;
    
    // Target address will be $4000 + $10 = $4010
    // High byte of target address is $40, so high+1 = $41

    // --- Act
    machine.run();

    // --- Assert
    // Result should be Y AND (high+1) = 0x55 AND 0x41 = 0x41
    expect(machine.readMemory(0x4010)).toBe(0x41);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(5);
  });

  it("SYA abs,X - with Y causing zero result", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9C, 0x00, 0x50], 0x1000, 0x1000); // SYA $5000,X
    machine.cpu.y = 0x2E; // Binary: 00101110
    machine.cpu.x = 0x20;
    
    // Target address will be $5000 + $20 = $5020
    // High byte of target address is $50, so high+1 = $51 (01010001)

    // --- Act
    machine.run();

    // --- Assert
    // Result should be Y AND (high+1) = 0x2E AND 0x51 = 0x00
    expect(machine.readMemory(0x5020)).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1003);
  });

  it("SYA abs,X - with X causing page boundary cross", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9C, 0xFF, 0x20], 0x1000, 0x1000); // SYA $20FF,X
    machine.cpu.y = 0x88;
    machine.cpu.x = 0x02;
    
    // Target address will be $20FF + $02 = $2101 (page boundary crossed)
    // High byte of target address is $21, so high+1 = $22

    // --- Act
    machine.run();

    // --- Assert
    // Result should be Y AND (high+1) = 0x88 AND 0x22 = 0x00
    expect(machine.readMemory(0x2101)).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1003);
  });

  it("SYA abs,X - should not affect processor flags", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9C, 0x00, 0x60], 0x1000, 0x1000); // SYA $6000,X
    machine.cpu.y = 0x80;
    machine.cpu.x = 0x00;
    
    // Set all flags initially
    machine.cpu.p = 0xFF;
    const initialFlags = machine.cpu.p;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.p).toBe(initialFlags); // Flags should be unchanged
  });

  it("SYA abs,X - with all ones should result in high+1", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9C, 0x00, 0x7F], 0x1000, 0x1000); // SYA $7F00,X
    machine.cpu.y = 0xFF;
    machine.cpu.x = 0xFF;
    
    // Target address will be $7F00 + $FF = $7FFF
    // High byte of target address is $7F, so high+1 = $80

    // --- Act
    machine.run();

    // --- Assert
    // Result should be Y AND (high+1) = 0xFF AND 0x80 = 0x80
    expect(machine.readMemory(0x7FFF)).toBe(0x80);
    expect(machine.cpu.pc).toBe(0x1003);
  });

  it("SYA abs,X - with Y=0 should always result in zero", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9C, 0x00, 0x80], 0x1000, 0x1000); // SYA $8000,X
    machine.cpu.y = 0x00;
    machine.cpu.x = 0x55;
    
    // Target address will be $8000 + $55 = $8055
    // High byte of target address is $80, so high+1 = $81

    // --- Act
    machine.run();

    // --- Assert
    // Result should be Y AND (high+1) = 0x00 AND 0x81 = 0x00
    expect(machine.readMemory(0x8055)).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1003);
  });

  it("SYA abs,X - should preserve Y register value", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9C, 0x00, 0x90], 0x1000, 0x1000); // SYA $9000,X
    machine.cpu.y = 0xAA;
    machine.cpu.x = 0x10;
    
    const initialY = machine.cpu.y;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(initialY); // Y should be unchanged
  });

  it("SYA abs,X - edge case with high byte 0xFF", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9C, 0x00, 0xFF], 0x1000, 0x1000); // SYA $FF00,X
    machine.cpu.y = 0x33;
    machine.cpu.x = 0x50;
    
    // Target address will be $FF00 + $50 = $FF50
    // High byte of target address is $FF, so high+1 = $00 (wraps around)

    // --- Act
    machine.run();

    // --- Assert
    // Result should be Y AND (high+1) = 0x33 AND 0x00 = 0x00
    expect(machine.readMemory(0xFF50)).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1003);
  });

  it("SYA abs,X - bit pattern test", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9C, 0x00, 0x12], 0x1000, 0x1000); // SYA $1200,X
    machine.cpu.y = 0xF0; // 11110000
    machine.cpu.x = 0x34;
    
    // Target address will be $1200 + $34 = $1234
    // High byte of target address is $12, so high+1 = $13 (00010011)

    // --- Act
    machine.run();

    // --- Assert
    // Result should be Y AND (high+1) = 0xF0 AND 0x13 = 0x10
    expect(machine.readMemory(0x1234)).toBe(0x10);
    expect(machine.cpu.pc).toBe(0x1003);
  });
});
