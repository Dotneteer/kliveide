import { describe, it, expect } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

/**
 * Tests for the DOP (Double NOP) undocumented instruction
 *
 * DOP reads a value but performs no operation (like NOP).
 * It reads the operand but doesn't affect any registers or flags.
 *
 * Opcodes:
 * - 0x04: DOP zp - Zero Page
 * - 0x14: DOP zp,X - Zero Page,X
 * - 0x34: DOP zp,X - Zero Page,X
 * - 0x44: DOP zp - Zero Page
 * - 0x54: DOP zp,X - Zero Page,X
 * - 0x64: DOP zp - Zero Page
 * - 0x80: DOP #imm - Immediate
 * - 0x82: DOP #imm - Immediate
 * - 0x89: DOP #imm - Immediate
 * - 0xC2: DOP #imm - Immediate
 * - 0xD4: DOP zp,X - Zero Page,X
 * - 0xE2: DOP #imm - Immediate
 * - 0xF4: DOP zp,X - Zero Page,X
 */
describe("M6510 Undocumented Instructions - DOP", () => {
  it("DOP #imm - immediate addressing - should do nothing but consume cycles (0x80)", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x80, 0x42], 0x1000, 0x1000); // DOP #$42
    
    // Set initial state
    machine.cpu.a = 0x12;
    machine.cpu.x = 0x34;
    machine.cpu.y = 0x56;
    machine.cpu.p = 0x78;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x12); // Accumulator unchanged
    expect(machine.cpu.x).toBe(0x34); // X register unchanged
    expect(machine.cpu.y).toBe(0x56); // Y register unchanged
    expect(machine.cpu.p).toBe(0x78); // Flags unchanged
    expect(machine.cpu.pc).toBe(0x1002); // PC advanced by 2
    expect(machine.cpu.tacts).toBe(2); // 2 cycles for immediate
  });

  it("DOP #imm - immediate addressing variants", () => {
    const opcodes = [0x80, 0x82, 0x89, 0xC2, 0xE2];
    
    opcodes.forEach(opcode => {
      // --- Arrange
      const machine = new M6510TestMachine(RunMode.OneInstruction);
      machine.initCode([opcode, 0xFF], 0x1000, 0x1000);
      
      const initialA = 0xAB;
      const initialX = 0xCD;
      const initialY = 0xEF;
      const initialP = 0x24;
      
      machine.cpu.a = initialA;
      machine.cpu.x = initialX;
      machine.cpu.y = initialY;
      machine.cpu.p = initialP;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(initialA); // No change to A
      expect(machine.cpu.x).toBe(initialX); // No change to X
      expect(machine.cpu.y).toBe(initialY); // No change to Y
      expect(machine.cpu.p).toBe(initialP); // No change to flags
      expect(machine.cpu.pc).toBe(0x1002); // PC advanced by 2
      expect(machine.cpu.tacts).toBe(2); // 2 cycles
    });
  });

  it("DOP zp - zero page addressing - should do nothing but consume cycles (0x04)", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x04, 0x80], 0x1000, 0x1000); // DOP $80
    machine.writeMemory(0x80, 0x55); // Value in zero page
    
    // Set initial state
    machine.cpu.a = 0x12;
    machine.cpu.x = 0x34;
    machine.cpu.y = 0x56;
    machine.cpu.p = 0x78;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x12); // Accumulator unchanged
    expect(machine.cpu.x).toBe(0x34); // X register unchanged
    expect(machine.cpu.y).toBe(0x56); // Y register unchanged
    expect(machine.cpu.p).toBe(0x78); // Flags unchanged
    expect(machine.readMemory(0x80)).toBe(0x55); // Memory unchanged
    expect(machine.cpu.pc).toBe(0x1002); // PC advanced by 2
    expect(machine.cpu.tacts).toBe(3); // 3 cycles for zero page
  });

  it("DOP zp - zero page addressing variants", () => {
    const opcodes = [0x04, 0x44, 0x64];
    
    opcodes.forEach(opcode => {
      // --- Arrange
      const machine = new M6510TestMachine(RunMode.OneInstruction);
      machine.initCode([opcode, 0x90], 0x1000, 0x1000);
      machine.writeMemory(0x90, 0xAA);
      
      const initialA = 0x11;
      const initialX = 0x22;
      const initialY = 0x33;
      const initialP = 0x44;
      
      machine.cpu.a = initialA;
      machine.cpu.x = initialX;
      machine.cpu.y = initialY;
      machine.cpu.p = initialP;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(initialA); // No change to A
      expect(machine.cpu.x).toBe(initialX); // No change to X
      expect(machine.cpu.y).toBe(initialY); // No change to Y
      expect(machine.cpu.p).toBe(initialP); // No change to flags
      expect(machine.readMemory(0x90)).toBe(0xAA); // Memory unchanged
      expect(machine.cpu.pc).toBe(0x1002); // PC advanced by 2
      expect(machine.cpu.tacts).toBe(3); // 3 cycles
    });
  });

  it("DOP zp,X - zero page indexed addressing - should do nothing but consume cycles (0x14)", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x14, 0x80], 0x1000, 0x1000); // DOP $80,X
    machine.cpu.x = 0x05;
    machine.writeMemory(0x85, 0x99); // Value at $80 + $05
    
    // Set initial state
    machine.cpu.a = 0x12;
    machine.cpu.y = 0x56;
    machine.cpu.p = 0x78;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x12); // Accumulator unchanged
    expect(machine.cpu.x).toBe(0x05); // X register unchanged
    expect(machine.cpu.y).toBe(0x56); // Y register unchanged
    expect(machine.cpu.p).toBe(0x78); // Flags unchanged
    expect(machine.readMemory(0x85)).toBe(0x99); // Memory unchanged
    expect(machine.cpu.pc).toBe(0x1002); // PC advanced by 2
    expect(machine.cpu.tacts).toBe(4); // 4 cycles for zero page,X
  });

  it("DOP zp,X - zero page indexed addressing variants", () => {
    const opcodes = [0x14, 0x34, 0x54, 0xD4, 0xF4];
    
    opcodes.forEach(opcode => {
      // --- Arrange
      const machine = new M6510TestMachine(RunMode.OneInstruction);
      machine.initCode([opcode, 0x70], 0x1000, 0x1000);
      machine.cpu.x = 0x0F;
      machine.writeMemory(0x7F, 0xBB); // At $70 + $0F
      
      const initialA = 0x55;
      const initialY = 0x66;
      const initialP = 0x77;
      
      machine.cpu.a = initialA;
      machine.cpu.y = initialY;
      machine.cpu.p = initialP;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(initialA); // No change to A
      expect(machine.cpu.x).toBe(0x0F); // X unchanged (used for addressing)
      expect(machine.cpu.y).toBe(initialY); // No change to Y
      expect(machine.cpu.p).toBe(initialP); // No change to flags
      expect(machine.readMemory(0x7F)).toBe(0xBB); // Memory unchanged
      expect(machine.cpu.pc).toBe(0x1002); // PC advanced by 2
      expect(machine.cpu.tacts).toBe(4); // 4 cycles
    });
  });

  it("DOP zp,X - should handle zero page wrapping", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x14, 0xFF], 0x1000, 0x1000); // DOP $FF,X
    machine.cpu.x = 0x02;
    machine.writeMemory(0x01, 0x33); // At $FF + $02 = $01 (wrapped)
    
    const initialA = 0xAA;
    const initialY = 0xBB;
    const initialP = 0xCC;
    
    machine.cpu.a = initialA;
    machine.cpu.y = initialY;
    machine.cpu.p = initialP;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(initialA); // No change to A
    expect(machine.cpu.x).toBe(0x02); // X unchanged
    expect(machine.cpu.y).toBe(initialY); // No change to Y
    expect(machine.cpu.p).toBe(initialP); // No change to flags
    expect(machine.readMemory(0x01)).toBe(0x33); // Memory unchanged
    expect(machine.cpu.pc).toBe(0x1002); // PC advanced by 2
    expect(machine.cpu.tacts).toBe(4); // 4 cycles
  });

  it("DOP should not affect any memory during read", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x04, 0x50], 0x1000, 0x1000); // DOP $50
    
    // Fill memory with test pattern
    for (let i = 0x50; i < 0x60; i++) {
      machine.writeMemory(i, i & 0xFF);
    }

    // --- Act
    machine.run();

    // --- Assert
    // Verify memory is unchanged
    for (let i = 0x50; i < 0x60; i++) {
      expect(machine.readMemory(i)).toBe(i & 0xFF);
    }
  });

  it("DOP should work with all flag combinations", () => {
    const flagCombinations = [0x00, 0x01, 0x02, 0x04, 0x08, 0x40, 0x80, 0xFF];
    
    flagCombinations.forEach(flags => {
      // --- Arrange
      const machine = new M6510TestMachine(RunMode.OneInstruction);
      machine.initCode([0x80, 0x99], 0x1000, 0x1000); // DOP #$99
      machine.cpu.p = flags;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.p).toBe(flags); // Flags should be completely unchanged
    });
  });

  it("DOP immediate should not access memory beyond the operand", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x89, 0x77], 0x1000, 0x1000); // DOP #$77
    
    // Set a marker value after the instruction
    machine.writeMemory(0x1002, 0xDD);

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x1002)).toBe(0xDD); // Should not be accessed
    expect(machine.cpu.pc).toBe(0x1002); // PC should point to next instruction
  });
});
