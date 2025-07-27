import { describe, it, expect } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

/**
 * Tests for the XAS (SHS/TAS) undocumented instruction
 *
 * XAS performs a complex operation:
 * 1. Set stack pointer to X AND A
 * 2. Store (stack pointer AND (high byte of target address + 1)) in memory
 *
 * Opcodes:
 * - 0x9B: XAS abs,Y - Absolute,Y
 */
describe("M6510 Undocumented Instructions - XAS", () => {
  it("XAS abs,Y - should set SP to X&A and store SP&(high+1) to memory (0x9B)", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x9B, 0x00, 0x30], 0x1000, 0x1000); // XAS $3000,Y
    machine.cpu.a = 0xFF;
    machine.cpu.x = 0xAA;
    machine.cpu.y = 0x05;
    machine.cpu.sp = 0xFD; // Initial stack pointer value
    
    // Target address will be $3000 + $05 = $3005
    // High byte of target address is $30, so high+1 = $31

    // --- Act
    machine.run();

    // --- Assert
    // Step 1: SP should be set to X AND A = 0xAA AND 0xFF = 0xAA
    expect(machine.cpu.sp).toBe(0xAA);
    // Step 2: Memory should contain SP AND (high+1) = 0xAA AND 0x31 = 0x20
    expect(machine.readMemory(0x3005)).toBe(0x20);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(5);
  });

  it("XAS abs,Y - with different A and X values", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x9B, 0x00, 0x40], 0x1000, 0x1000); // XAS $4000,Y
    machine.cpu.a = 0x55;
    machine.cpu.x = 0x33;
    machine.cpu.y = 0x10;
    machine.cpu.sp = 0x80; // Initial stack pointer value
    
    // Target address will be $4000 + $10 = $4010
    // High byte of target address is $40, so high+1 = $41

    // --- Act
    machine.run();

    // --- Assert
    // Step 1: SP should be set to X AND A = 0x33 AND 0x55 = 0x11
    expect(machine.cpu.sp).toBe(0x11);
    // Step 2: Memory should contain SP AND (high+1) = 0x11 AND 0x41 = 0x01
    expect(machine.readMemory(0x4010)).toBe(0x01);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(5);
  });

  it("XAS abs,Y - with zero result in memory", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x9B, 0x00, 0x50], 0x1000, 0x1000); // XAS $5000,Y
    machine.cpu.a = 0x2E; // Binary: 00101110
    machine.cpu.x = 0x19; // Binary: 00011001
    machine.cpu.y = 0x20;
    machine.cpu.sp = 0xFE;
    
    // Target address will be $5000 + $20 = $5020
    // High byte of target address is $50, so high+1 = $51 (01010001)

    // --- Act
    machine.run();

    // --- Assert
    // Step 1: SP should be set to X AND A = 0x19 AND 0x2E = 0x08
    expect(machine.cpu.sp).toBe(0x08);
    // Step 2: Memory should contain SP AND (high+1) = 0x08 AND 0x51 = 0x00
    expect(machine.readMemory(0x5020)).toBe(0x00);
  });

  it("XAS abs,Y - with Y causing page boundary cross", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x9B, 0xFF, 0x20], 0x1000, 0x1000); // XAS $20FF,Y
    machine.cpu.a = 0xCC;
    machine.cpu.x = 0x99;
    machine.cpu.y = 0x02;
    machine.cpu.sp = 0x77;
    
    // Target address will be $20FF + $02 = $2101 (page boundary crossed)
    // High byte of target address is $21, so high+1 = $22

    // --- Act
    machine.run();

    // --- Assert
    // Step 1: SP should be set to X AND A = 0x99 AND 0xCC = 0x88
    expect(machine.cpu.sp).toBe(0x88);
    // Step 2: Memory should contain SP AND (high+1) = 0x88 AND 0x22 = 0x00
    expect(machine.readMemory(0x2101)).toBe(0x00);
    expect(machine.cpu.pc).toBe(0x1003);
  });

  it("XAS abs,Y - should not affect processor flags", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x9B, 0x00, 0x60], 0x1000, 0x1000); // XAS $6000,Y
    machine.cpu.a = 0x80;
    machine.cpu.x = 0x40;
    machine.cpu.y = 0x00;
    machine.cpu.sp = 0x12;
    
    // Set all flags initially
    machine.cpu.p = 0xFF;
    const initialFlags = machine.cpu.p;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.p).toBe(initialFlags); // Flags should be unchanged
  });

  it("XAS abs,Y - should not affect A and X registers", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x9B, 0x00, 0x70], 0x1000, 0x1000); // XAS $7000,Y
    machine.cpu.a = 0x44;
    machine.cpu.x = 0x66;
    machine.cpu.y = 0x08;
    machine.cpu.sp = 0x99;
    
    const initialA = machine.cpu.a;
    const initialX = machine.cpu.x;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(initialA); // A should be unchanged
    expect(machine.cpu.x).toBe(initialX); // X should be unchanged
  });

  it("XAS abs,Y - with A=0 should set SP to 0", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x9B, 0x00, 0x80], 0x1000, 0x1000); // XAS $8000,Y
    machine.cpu.a = 0x00;
    machine.cpu.x = 0xFF;
    machine.cpu.y = 0x55;
    machine.cpu.sp = 0xAA;
    
    // Target address will be $8000 + $55 = $8055
    // High byte of target address is $80, so high+1 = $81

    // --- Act
    machine.run();

    // --- Assert
    // Step 1: SP should be set to X AND A = 0xFF AND 0x00 = 0x00
    expect(machine.cpu.sp).toBe(0x00);
    // Step 2: Memory should contain SP AND (high+1) = 0x00 AND 0x81 = 0x00
    expect(machine.readMemory(0x8055)).toBe(0x00);
  });

  it("XAS abs,Y - with X=0 should set SP to 0", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x9B, 0x00, 0x90], 0x1000, 0x1000); // XAS $9000,Y
    machine.cpu.a = 0xFF;
    machine.cpu.x = 0x00;
    machine.cpu.y = 0x10;
    machine.cpu.sp = 0xBB;
    
    // Target address will be $9000 + $10 = $9010
    // High byte of target address is $90, so high+1 = $91

    // --- Act
    machine.run();

    // --- Assert
    // Step 1: SP should be set to X AND A = 0x00 AND 0xFF = 0x00
    expect(machine.cpu.sp).toBe(0x00);
    // Step 2: Memory should contain SP AND (high+1) = 0x00 AND 0x91 = 0x00
    expect(machine.readMemory(0x9010)).toBe(0x00);
  });

  it("XAS abs,Y - edge case with high byte 0xFF", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x9B, 0x00, 0xFF], 0x1000, 0x1000); // XAS $FF00,Y
    machine.cpu.a = 0x33;
    machine.cpu.x = 0x77;
    machine.cpu.y = 0x50;
    machine.cpu.sp = 0x44;
    
    // Target address will be $FF00 + $50 = $FF50
    // High byte of target address is $FF, so high+1 = $00 (wraps around)

    // --- Act
    machine.run();

    // --- Assert
    // Step 1: SP should be set to X AND A = 0x77 AND 0x33 = 0x33
    expect(machine.cpu.sp).toBe(0x33);
    // Step 2: Memory should contain SP AND (high+1) = 0x33 AND 0x00 = 0x00
    expect(machine.readMemory(0xFF50)).toBe(0x00);
  });

  it("XAS abs,Y - with all bits set", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x9B, 0x00, 0x7F], 0x1000, 0x1000); // XAS $7F00,Y
    machine.cpu.a = 0xFF;
    machine.cpu.x = 0xFF;
    machine.cpu.y = 0xFF;
    machine.cpu.sp = 0x00;
    
    // Target address will be $7F00 + $FF = $7FFF
    // High byte of target address is $7F, so high+1 = $80

    // --- Act
    machine.run();

    // --- Assert
    // Step 1: SP should be set to X AND A = 0xFF AND 0xFF = 0xFF
    expect(machine.cpu.sp).toBe(0xFF);
    // Step 2: Memory should contain SP AND (high+1) = 0xFF AND 0x80 = 0x80
    expect(machine.readMemory(0x7FFF)).toBe(0x80);
  });

  it("XAS abs,Y - bit pattern interaction test", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x9B, 0x00, 0x12], 0x1000, 0x1000); // XAS $1200,Y
    machine.cpu.a = 0xF0; // 11110000
    machine.cpu.x = 0x0F; // 00001111
    machine.cpu.y = 0x34;
    machine.cpu.sp = 0x88;
    
    // Target address will be $1200 + $34 = $1234
    // High byte of target address is $12, so high+1 = $13 (00010011)

    // --- Act
    machine.run();

    // --- Assert
    // Step 1: SP should be set to X AND A = 0x0F AND 0xF0 = 0x00
    expect(machine.cpu.sp).toBe(0x00);
    // Step 2: Memory should contain SP AND (high+1) = 0x00 AND 0x13 = 0x00
    expect(machine.readMemory(0x1234)).toBe(0x00);
  });

  it("XAS abs,Y - should work with Y=0", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x9B, 0x34, 0x56], 0x1000, 0x1000); // XAS $5634,Y
    machine.cpu.a = 0xAB;
    machine.cpu.x = 0xCD;
    machine.cpu.y = 0x00; // No Y offset
    machine.cpu.sp = 0x11;
    
    // Target address will be $5634 + $00 = $5634
    // High byte of target address is $56, so high+1 = $57

    // --- Act
    machine.run();

    // --- Assert
    // Step 1: SP should be set to X AND A = 0xCD AND 0xAB = 0x89
    expect(machine.cpu.sp).toBe(0x89);
    // Step 2: Memory should contain SP AND (high+1) = 0x89 AND 0x57 = 0x01
    expect(machine.readMemory(0x5634)).toBe(0x01);
  });

  it("XAS abs,Y - multiple operations should be independent", () => {
    // Test multiple XAS operations to ensure they work correctly in sequence
    const testCases = [
      { a: 0x80, x: 0x40, y: 0x00, addr: 0x1000, expectedSp: 0x00, expectedMem: 0x00 },
      { a: 0xFF, x: 0x81, y: 0x10, addr: 0x2000, expectedSp: 0x81, expectedMem: 0x01 },
      { a: 0x55, x: 0xAA, y: 0x20, addr: 0x3000, expectedSp: 0x00, expectedMem: 0x00 }
    ];
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      
      // --- Arrange
      const machine = new M6510TestMachine(RunMode.OneInstruction);
      const addrLow = testCase.addr & 0xFF;
      const addrHigh = (testCase.addr >> 8) & 0xFF;
      machine.initCode([0x9B, addrLow, addrHigh], 0x1000, 0x1000);
      machine.cpu.a = testCase.a;
      machine.cpu.x = testCase.x;
      machine.cpu.y = testCase.y;
      machine.cpu.sp = 0xFD; // Reset SP
      
      // --- Act
      machine.run();
      
      // --- Assert
      expect(machine.cpu.sp).toBe(testCase.expectedSp);
      expect(machine.readMemory(testCase.addr + testCase.y)).toBe(testCase.expectedMem);
      expect(machine.cpu.pc).toBe(0x1003);
      expect(machine.cpu.tacts).toBe(5);
    }
  });
});
