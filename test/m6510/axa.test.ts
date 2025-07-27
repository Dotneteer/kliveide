import { describe, it, expect } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

/**
 * Tests for the AXA (AND X with A) undocumented instruction
 *
 * AXA performs an AND operation between the A register, X register, and the high byte
 * of the target address + 1, then stores the result to memory.
 * This is an unstable instruction that can behave unpredictably.
 *
 * Opcodes:
 * - 0x93: AXA (zp),Y - Indirect Indexed
 * - 0x9F: AXA abs,Y - Absolute,Y
 */
describe("M6510 Undocumented Instructions - AXA", () => {
  it("AXA (zp),Y - should store A AND X AND (high+1) to memory (0x93)", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x93, 0x20], 0x1000, 0x1000); // AXA ($20),Y
    machine.cpu.a = 0xFF;
    machine.cpu.x = 0xAA;
    machine.cpu.y = 0x05;
    
    // Set up indirect address at zero page $20-$21 to point to $3000
    machine.writeMemory(0x20, 0x00); // Low byte
    machine.writeMemory(0x21, 0x30); // High byte
    
    // Target address will be $3000 + $05 = $3005
    // High byte of target address is $30, so high+1 = $31

    // --- Act
    machine.run();

    // --- Assert
    // Result should be A AND X AND (high+1) = 0xFF AND 0xAA AND 0x31 = 0x20
    expect(machine.readMemory(0x3005)).toBe(0x20);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6);
  });

  it("AXA abs,Y - should store A AND X AND (high+1) to memory (0x9F)", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x9F, 0x00, 0x40], 0x1000, 0x1000); // AXA $4000,Y
    machine.cpu.a = 0x55;
    machine.cpu.x = 0x33;
    machine.cpu.y = 0x10;
    
    // Target address will be $4000 + $10 = $4010
    // High byte of target address is $40, so high+1 = $41

    // --- Act
    machine.run();

    // --- Assert
    // Result should be A AND X AND (high+1) = 0x55 AND 0x33 AND 0x41 = 0x01
    expect(machine.readMemory(0x4010)).toBe(0x01);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(5);
  });

  it("AXA (zp),Y - with zero page wraparound", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x93, 0xFF], 0x1000, 0x1000); // AXA ($FF),Y
    machine.cpu.a = 0x77;
    machine.cpu.x = 0x88;
    machine.cpu.y = 0x03;
    
    // Set up indirect address at zero page $FF-$00 (wraparound)
    machine.writeMemory(0xFF, 0x50); // Low byte
    machine.writeMemory(0x00, 0x25); // High byte (wraps to $00)
    
    // Target address will be $2550 + $03 = $2553
    // High byte of target address is $25, so high+1 = $26

    // --- Act
    machine.run();

    // --- Assert
    // Result should be A AND X AND (high+1) = 0x77 AND 0x88 AND 0x26 = 0x00
    expect(machine.readMemory(0x2553)).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1002);
  });

  it("AXA abs,Y - with Y causing page boundary cross", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x9F, 0xFF, 0x20], 0x1000, 0x1000); // AXA $20FF,Y
    machine.cpu.a = 0xCC;
    machine.cpu.x = 0x99;
    machine.cpu.y = 0x02;
    
    // Target address will be $20FF + $02 = $2101 (page boundary crossed)
    // High byte of target address is $21, so high+1 = $22

    // --- Act
    machine.run();

    // --- Assert
    // Result should be A AND X AND (high+1) = 0xCC AND 0x99 AND 0x22 = 0x00
    expect(machine.readMemory(0x2101)).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1003);
  });

  it("AXA should not affect any processor flags", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x93, 0x30], 0x1000, 0x1000); // AXA ($30),Y
    machine.cpu.a = 0x80;
    machine.cpu.x = 0x40;
    machine.cpu.y = 0x00;
    
    // Set up indirect address
    machine.writeMemory(0x30, 0x00);
    machine.writeMemory(0x31, 0x50);
    
    // Set all flags initially
    machine.cpu.p = 0xFF;
    const initialFlags = machine.cpu.p;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.p).toBe(initialFlags); // Flags should be unchanged
  });

  it("AXA (zp),Y - with all zeros should result in zero", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x93, 0x40], 0x1000, 0x1000); // AXA ($40),Y
    machine.cpu.a = 0x00;
    machine.cpu.x = 0x00;
    machine.cpu.y = 0x00;
    
    // Set up indirect address
    machine.writeMemory(0x40, 0x00);
    machine.writeMemory(0x41, 0x60);
    
    // Target address will be $6000, high byte is $60, so high+1 = $61

    // --- Act
    machine.run();

    // --- Assert
    // Result should be A AND X AND (high+1) = 0x00 AND 0x00 AND 0x61 = 0x00
    expect(machine.readMemory(0x6000)).toBe(0x00);
  });

  it("AXA abs,Y - unstable behavior with high byte calculation", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x9F, 0x00, 0x7F], 0x1000, 0x1000); // AXA $7F00,Y
    machine.cpu.a = 0xFF;
    machine.cpu.x = 0xFF;
    machine.cpu.y = 0xFF;
    
    // Target address will be $7F00 + $FF = $7FFF
    // High byte of target address is $7F, so high+1 = $80

    // --- Act
    machine.run();

    // --- Assert
    // Result should be A AND X AND (high+1) = 0xFF AND 0xFF AND 0x80 = 0x80
    expect(machine.readMemory(0x7FFF)).toBe(0x80);
    expect(machine.cpu.pc).toBe(0x1003);
  });
});
