import { describe, it, expect } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";

/**
 * Tests for the SXA (SHX) undocumented instruction
 *
 * SXA performs an AND operation between the X register and the high byte
 * of the target address + 1, then stores the result to memory.
 * This is an unstable instruction that can behave unpredictably.
 *
 * Opcodes:
 * - 0x9E: SXA abs,Y - Store X AND (high byte + 1) to memory
 */
describe("M6510 Undocumented Instructions - SXA", () => {
  it("SXA abs,Y - should store X AND (high+1) to memory (0x9E)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9E, 0x00, 0x40], 0x1000, 0x1000); // SXA $4000,Y
    machine.cpu.x = 0xAA;
    machine.cpu.y = 0x10;
    
    // Target address will be $4000 + $10 = $4010
    // High byte of target address is $40, so high+1 = $41

    // --- Act
    machine.run();

    // --- Assert
    // Result should be X AND (high+1) = 0xAA AND 0x41 = 0x00
    expect(machine.readMemory(0x4010)).toBe(0x00);
    expect(machine.cpu.x).toBe(0xAA); // X register should be unchanged
    expect(machine.cpu.y).toBe(0x10); // Y register should be unchanged
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.checkedTacts).toBe(5);
  });

  it("SXA abs,Y - different bit patterns", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9E, 0x00, 0x30], 0x1000, 0x1000); // SXA $3000,Y
    machine.cpu.x = 0xFF;
    machine.cpu.y = 0x20;
    
    // Target address will be $3000 + $20 = $3020
    // High byte of target address is $30, so high+1 = $31

    // --- Act
    machine.run();

    // --- Assert
    // Result should be X AND (high+1) = 0xFF AND 0x31 = 0x31
    expect(machine.readMemory(0x3020)).toBe(0x31);
    expect(machine.cpu.x).toBe(0xFF); // X register should be unchanged
    expect(machine.cpu.y).toBe(0x20); // Y register should be unchanged
  });

  it("SXA abs,Y - with zero X register", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9E, 0x00, 0x50], 0x1000, 0x1000); // SXA $5000,Y
    machine.cpu.x = 0x00;
    machine.cpu.y = 0x30;
    
    // Target address will be $5000 + $30 = $5030
    // High byte of target address is $50, so high+1 = $51

    // --- Act
    machine.run();

    // --- Assert
    // Result should be X AND (high+1) = 0x00 AND 0x51 = 0x00
    expect(machine.readMemory(0x5030)).toBe(0x00);
    expect(machine.cpu.x).toBe(0x00); // X register should be unchanged
    expect(machine.cpu.y).toBe(0x30); // Y register should be unchanged
  });

  it("SXA abs,Y - with Y causing page boundary cross", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9E, 0xFF, 0x20], 0x1000, 0x1000); // SXA $20FF,Y
    machine.cpu.x = 0x55;
    machine.cpu.y = 0x02;
    
    // Target address will be $20FF + $02 = $2101 (page boundary crossed)
    // High byte of target address is $21, so high+1 = $22

    // --- Act
    machine.run();

    // --- Assert
    // Result should be X AND (high+1) = 0x55 AND 0x22 = 0x00
    expect(machine.readMemory(0x2101)).toBe(0x00);
    expect(machine.cpu.x).toBe(0x55); // X register should be unchanged
    expect(machine.cpu.y).toBe(0x02); // Y register should be unchanged
    expect(machine.cpu.pc).toBe(0x1003);
  });

  it("SXA abs,Y - high byte calculation with maximum values", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9E, 0x00, 0xFF], 0x1000, 0x1000); // SXA $FF00,Y
    machine.cpu.x = 0xFF;
    machine.cpu.y = 0xFF;
    
    // Target address will be $FF00 + $FF = $FFFF
    // High byte of target address is $FF, so high+1 = $00 (wrapped)

    // --- Act
    machine.run();

    // --- Assert
    // Result should be X AND (high+1) = 0xFF AND 0x00 = 0x00
    expect(machine.readMemory(0xFFFF)).toBe(0x00);
    expect(machine.cpu.x).toBe(0xFF); // X register should be unchanged
    expect(machine.cpu.y).toBe(0xFF); // Y register should be unchanged
  });

  it("SXA abs,Y - should not affect any processor flags", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9E, 0x00, 0x60], 0x1000, 0x1000); // SXA $6000,Y
    machine.cpu.x = 0x80;
    machine.cpu.y = 0x40;
    
    // Set all flags initially
    machine.cpu.p = 0xFF;
    const initialFlags = machine.cpu.p;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.p).toBe(initialFlags); // Flags should be unchanged
  });

  it("SXA abs,Y - mixed bit patterns with known result", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9E, 0x00, 0x7F], 0x1000, 0x1000); // SXA $7F00,Y
    machine.cpu.x = 0xCC; // 11001100 in binary
    machine.cpu.y = 0x80;
    
    // Target address will be $7F00 + $80 = $7F80
    // High byte of target address is $7F, so high+1 = $80

    // --- Act
    machine.run();

    // --- Assert
    // Result should be X AND (high+1) = 0xCC AND 0x80 = 0x80
    // 11001100 AND 10000000 = 10000000 = 0x80
    expect(machine.readMemory(0x7F80)).toBe(0x80);
    expect(machine.cpu.x).toBe(0xCC); // X register should be unchanged
    expect(machine.cpu.y).toBe(0x80); // Y register should be unchanged
  });

  it("SXA abs,Y - all bits set in X register", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9E, 0x00, 0x80], 0x1000, 0x1000); // SXA $8000,Y
    machine.cpu.x = 0xFF; // All bits set
    machine.cpu.y = 0x55;
    
    // Target address will be $8000 + $55 = $8055
    // High byte of target address is $80, so high+1 = $81

    // --- Act
    machine.run();

    // --- Assert
    // Result should be X AND (high+1) = 0xFF AND 0x81 = 0x81
    expect(machine.readMemory(0x8055)).toBe(0x81);
    expect(machine.cpu.x).toBe(0xFF); // X register should be unchanged
    expect(machine.cpu.y).toBe(0x55); // Y register should be unchanged
  });

  it("SXA abs,Y - address calculation edge case", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9E, 0x00, 0x01], 0x1000, 0x1000); // SXA $0100,Y
    machine.cpu.x = 0x33;
    machine.cpu.y = 0x00;
    
    // Target address will be $0100 + $00 = $0100
    // High byte of target address is $01, so high+1 = $02

    // --- Act
    machine.run();

    // --- Assert
    // Result should be X AND (high+1) = 0x33 AND 0x02 = 0x02
    expect(machine.readMemory(0x0100)).toBe(0x02);
    expect(machine.cpu.x).toBe(0x33); // X register should be unchanged
    expect(machine.cpu.y).toBe(0x00); // Y register should be unchanged
  });

  it("SXA abs,Y - should not affect accumulator", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9E, 0x00, 0x90], 0x1000, 0x1000); // SXA $9000,Y
    machine.cpu.a = 0x42; // Set accumulator to known value
    machine.cpu.x = 0x77;
    machine.cpu.y = 0x11;
    
    // Target address will be $9000 + $11 = $9011
    // High byte of target address is $90, so high+1 = $91

    // --- Act
    machine.run();

    // --- Assert
    // Result should be X AND (high+1) = 0x77 AND 0x91 = 0x11
    expect(machine.readMemory(0x9011)).toBe(0x11);
    expect(machine.cpu.a).toBe(0x42); // Accumulator should be unchanged
    expect(machine.cpu.x).toBe(0x77); // X register should be unchanged
    expect(machine.cpu.y).toBe(0x11); // Y register should be unchanged
  });

  it("SXA abs,Y - unstable behavior demonstration", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x9E, 0x00, 0xFE], 0x1000, 0x1000); // SXA $FE00,Y
    machine.cpu.x = 0xAB;
    machine.cpu.y = 0x34;
    
    // Target address will be $FE00 + $34 = $FE34
    // High byte of target address is $FE, so high+1 = $FF

    // --- Act
    machine.run();

    // --- Assert
    // Result should be X AND (high+1) = 0xAB AND 0xFF = 0xAB
    expect(machine.readMemory(0xFE34)).toBe(0xAB);
    expect(machine.cpu.x).toBe(0xAB); // X register should be unchanged
    expect(machine.cpu.y).toBe(0x34); // Y register should be unchanged
  });
});
