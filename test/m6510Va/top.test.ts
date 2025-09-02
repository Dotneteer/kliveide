import { describe, it, expect } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";

/**
 * Tests for the TOP (Triple NOP) undocumented instruction
 *
 * TOP is a "triple NOP" - it performs no operation but consumes different
 * numbers of cycles depending on the addressing mode.
 *
 * Opcodes:
 * - 0x0C: TOP abs - Absolute (4 cycles)
 * - 0x1C: TOP abs,X - Absolute,X (4 cycles, +1 if page boundary crossed)
 * - 0x3C: TOP abs,X - Absolute,X (4 cycles, +1 if page boundary crossed)
 * - 0x5C: TOP abs,X - Absolute,X (4 cycles, +1 if page boundary crossed)
 * - 0x7C: TOP abs,X - Absolute,X (4 cycles, +1 if page boundary crossed)
 * - 0xDC: TOP abs,X - Absolute,X (4 cycles, +1 if page boundary crossed)
 * - 0xFC: TOP abs,X - Absolute,X (4 cycles, +1 if page boundary crossed)
 */
describe("M6510 Undocumented Instructions - TOP", () => {
  it("TOP abs - should do nothing and take 4 cycles (0x0C)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0C, 0x34, 0x12], 0x1000, 0x1000); // TOP $1234
    
    // Store initial register values
    const initialA = machine.cpu.a = 0x55;
    const initialX = machine.cpu.x = 0xAA;
    const initialY = machine.cpu.y = 0x77;
    const initialSp = machine.cpu.sp = 0xFD;
    const initialP = machine.cpu.p = 0x24;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
    
    // All registers should be unchanged
    expect(machine.cpu.a).toBe(initialA);
    expect(machine.cpu.x).toBe(initialX);
    expect(machine.cpu.y).toBe(initialY);
    expect(machine.cpu.sp).toBe(initialSp);
    expect(machine.cpu.p).toBe(initialP);
  });

  it("TOP abs,X - should do nothing and take 4 cycles without page boundary cross (0x1C)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x1C, 0x00, 0x30], 0x1000, 0x1000); // TOP $3000,X
    machine.cpu.x = 0x10;
    
    // Store initial register values
    const initialA = machine.cpu.a = 0x88;
    const initialY = machine.cpu.y = 0x99;
    const initialSp = machine.cpu.sp = 0xFE;
    const initialP = machine.cpu.p = 0x30;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4); // No page boundary cross
    
    // All registers should be unchanged
    expect(machine.cpu.a).toBe(initialA);
    expect(machine.cpu.x).toBe(0x10); // X should be unchanged
    expect(machine.cpu.y).toBe(initialY);
    expect(machine.cpu.sp).toBe(initialSp);
    expect(machine.cpu.p).toBe(initialP);
  });

  it("TOP abs,X - should take 5 cycles with page boundary cross (0x3C)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x3C, 0xFF, 0x20], 0x1000, 0x1000); // TOP $20FF,X
    machine.cpu.x = 0x02; // This will cause page boundary cross: $20FF + $02 = $2101
    
    // Store initial register values
    const initialA = machine.cpu.a = 0xCC;
    const initialY = machine.cpu.y = 0xDD;
    const initialSp = machine.cpu.sp = 0xFC;
    const initialP = machine.cpu.p = 0x26;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(5); // Extra cycle for page boundary cross
    
    // All registers should be unchanged
    expect(machine.cpu.a).toBe(initialA);
    expect(machine.cpu.x).toBe(0x02); // X should be unchanged
    expect(machine.cpu.y).toBe(initialY);
    expect(machine.cpu.sp).toBe(initialSp);
    expect(machine.cpu.p).toBe(initialP);
  });

  it("TOP abs,X - should not affect memory (0x5C)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x5C, 0x00, 0x40], 0x1000, 0x1000); // TOP $4000,X
    machine.cpu.x = 0x50;
    
    // Set some memory values that should not be affected
    machine.writeMemory(0x4050, 0x42);
    machine.writeMemory(0x4051, 0x84);

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
    
    // Memory should be unchanged
    expect(machine.readMemory(0x4050)).toBe(0x42);
    expect(machine.readMemory(0x4051)).toBe(0x84);
  });

  it("TOP abs,X - multiple opcodes should behave identically (0x7C)", () => {
    // --- Arrange
    const machine1 = new M6510VaTestMachine(RunMode.OneInstruction);
    machine1.initCode([0x7C, 0x80, 0x50], 0x1000, 0x1000); // TOP $5080,X
    machine1.cpu.x = 0x20;
    machine1.cpu.a = 0x11;
    machine1.cpu.y = 0x22;
    machine1.cpu.p = 0x33;

    const machine2 = new M6510VaTestMachine(RunMode.OneInstruction);
    machine2.initCode([0xDC, 0x80, 0x50], 0x1000, 0x1000); // TOP $5080,X (different opcode)
    machine2.cpu.x = 0x20;
    machine2.cpu.a = 0x11;
    machine2.cpu.y = 0x22;
    machine2.cpu.p = 0x33;

    // --- Act
    machine1.run();
    machine2.run();

    // --- Assert
    // Both should behave identically
    expect(machine1.cpu.pc).toBe(machine2.cpu.pc);
    expect(machine1.cpu.tacts).toBe(machine2.cpu.tacts);
    expect(machine1.cpu.a).toBe(machine2.cpu.a);
    expect(machine1.cpu.x).toBe(machine2.cpu.x);
    expect(machine1.cpu.y).toBe(machine2.cpu.y);
    expect(machine1.cpu.p).toBe(machine2.cpu.p);
  });

  it("TOP abs,X - should work with X=0 (0xFC)", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0xFC, 0x00, 0x60], 0x1000, 0x1000); // TOP $6000,X
    machine.cpu.x = 0x00; // No offset
    
    const initialA = machine.cpu.a = 0xEE;
    const initialY = machine.cpu.y = 0xFF;
    const initialP = machine.cpu.p = 0x44; // Will become 0x64 due to bit 5 always being set

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4); // No page boundary with X=0
    expect(machine.cpu.a).toBe(initialA);
    expect(machine.cpu.x).toBe(0x00);
    expect(machine.cpu.y).toBe(initialY);
    expect(machine.cpu.p).toBe(0x64); // 0x44 | 0x20 (bit 5 always set)
  });

  it("TOP abs,X - edge case with maximum page boundary cross", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x1C, 0xFF, 0xFF], 0x1000, 0x1000); // TOP $FFFF,X
    machine.cpu.x = 0x01; // This will cause wrap: $FFFF + $01 = $0000
    
    const initialRegisters = {
      a: machine.cpu.a = 0x12,
      y: machine.cpu.y = 0x34,
      sp: machine.cpu.sp = 0x56,
      p: machine.cpu.p = 0x78
    };

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(5); // Page boundary cross
    expect(machine.cpu.a).toBe(initialRegisters.a);
    expect(machine.cpu.x).toBe(0x01);
    expect(machine.cpu.y).toBe(initialRegisters.y);
    expect(machine.cpu.sp).toBe(initialRegisters.sp);
    expect(machine.cpu.p).toBe(initialRegisters.p);
  });

  it("TOP abs - should not affect stack pointer", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x0C, 0xAB, 0xCD], 0x1000, 0x1000); // TOP $CDAB
    
    const initialSp = machine.cpu.sp = 0x80;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.sp).toBe(initialSp); // Stack pointer unchanged
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });

  it("TOP abs,X - timing consistency across all opcodes", () => {
    const opcodes = [0x1C, 0x3C, 0x5C, 0x7C, 0xDC, 0xFC];
    const results: Array<{ pc: number; tacts: number }> = [];
    
    for (const opcode of opcodes) {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([opcode, 0x00, 0x20], 0x1000, 0x1000); // TOP $2000,X
      machine.cpu.x = 0x30; // No page boundary cross
      
      // --- Act
      machine.run();
      
      // --- Assert
      results.push({ pc: machine.cpu.pc, tacts: machine.cpu.tacts });
    }
    
    // All should have identical timing
    const firstResult = results[0];
    for (const result of results) {
      expect(result.pc).toBe(firstResult.pc);
      expect(result.tacts).toBe(firstResult.tacts);
    }
  });

  it("TOP abs,X - should handle all flag states correctly", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine(RunMode.OneInstruction);
    machine.initCode([0x3C, 0x12, 0x34], 0x1000, 0x1000); // TOP $3412,X
    machine.cpu.x = 0x56;
    
    // Set all flags
    machine.cpu.p = 0xFF;
    const initialFlags = machine.cpu.p;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.p).toBe(initialFlags); // All flags unchanged
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4);
  });
});
