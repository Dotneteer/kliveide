import { describe, it, expect, beforeEach } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";
import { FlagSetMask6510 } from "../../src/emu/abstractions/FlagSetMask6510";

describe("M6510 - Jump and Subroutine Instructions", () => {
  let machine: M6510VaTestMachine;

  beforeEach(() => {
    machine = new M6510VaTestMachine(RunMode.OneInstruction);
  });

  describe("JMP - Jump Absolute (0x4C)", () => {
    it("should jump to absolute address", () => {
      // --- Arrange
      machine.initCode([0x4C, 0x00, 0x30], 0x1000, 0x1000); // JMP $3000
      machine.cpu.pc = 0x1000;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x3000); // Jumped to target address
      expect(machine.checkedTacts).toBe(3); // JMP absolute takes 3 cycles
    });

    it("should handle jump to low memory", () => {
      // --- Arrange
      machine.initCode([0x4C, 0x34, 0x12], 0x8000, 0x8000); // JMP $1234
      machine.cpu.pc = 0x8000;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x1234);
      expect(machine.checkedTacts).toBe(3); // JMP absolute takes 3 cycles
    });

    it("should handle jump to high memory", () => {
      // --- Arrange
      machine.initCode([0x4C, 0xCD, 0xAB], 0x1000, 0x1000); // JMP $ABCD
      machine.cpu.pc = 0x1000;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0xABCD);
      expect(machine.checkedTacts).toBe(3); // JMP absolute takes 3 cycles
    });

    it("should not affect any flags", () => {
      // --- Arrange
      machine.initCode([0x4C, 0x00, 0x20], 0x1000, 0x1000); // JMP $2000
      machine.cpu.p = FlagSetMask6510.C | FlagSetMask6510.Z | FlagSetMask6510.N | FlagSetMask6510.V | FlagSetMask6510.UNUSED;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x2000);
      expect(machine.cpu.isCFlagSet()).toBe(true); // All flags unchanged
      expect(machine.cpu.isZFlagSet()).toBe(true);
      expect(machine.cpu.isNFlagSet()).toBe(true);
      expect(machine.cpu.isVFlagSet()).toBe(true);
      expect(machine.checkedTacts).toBe(3); // JMP absolute takes 3 cycles
    });

    it("should not affect registers", () => {
      // --- Arrange
      machine.initCode([0x4C, 0x00, 0x40], 0x1000, 0x1000); // JMP $4000
      machine.cpu.a = 0x42;
      machine.cpu.x = 0x33;
      machine.cpu.y = 0x24;
      machine.cpu.sp = 0xFE;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x4000);
      expect(machine.cpu.a).toBe(0x42); // All registers unchanged
      expect(machine.cpu.x).toBe(0x33);
      expect(machine.cpu.y).toBe(0x24);
      expect(machine.cpu.sp).toBe(0xFE);
      expect(machine.checkedTacts).toBe(3); // JMP absolute takes 3 cycles
    });
  });

  describe("JMP - Jump Indirect (0x6C)", () => {
    it("should jump to address stored at indirect address", () => {
      // --- Arrange
      machine.initCode([0x6C, 0x00, 0x20], 0x1000, 0x1000); // JMP ($2000)
      machine.writeMemory(0x2000, 0x34); // Target address low byte
      machine.writeMemory(0x2001, 0x12); // Target address high byte
      machine.cpu.pc = 0x1000;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x1234); // Jumped to target address from indirect
      expect(machine.checkedTacts).toBe(5); // JMP indirect takes 5 cycles
    });

    it("should handle page boundary bug", () => {
      // --- Arrange
      machine.initCode([0x6C, 0xFF, 0x20], 0x1000, 0x1000); // JMP ($20FF)
      machine.writeMemory(0x20FF, 0x78); // Target address low byte
      machine.writeMemory(0x2000, 0x56); // Target address high byte (wrapped due to bug)
      machine.writeMemory(0x2100, 0x99); // This should NOT be read due to page boundary bug

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x5678); // Should use 0x2000 for high byte, not 0x2100
      expect(machine.checkedTacts).toBe(5); 
    });

    it("should handle normal (non-boundary) indirect addressing", () => {
      // --- Arrange
      machine.initCode([0x6C, 0x50, 0x30], 0x1000, 0x1000); // JMP ($3050)
      machine.writeMemory(0x3050, 0xAB); // Target address low byte
      machine.writeMemory(0x3051, 0xCD); // Target address high byte
      machine.cpu.pc = 0x1000;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0xCDAB);
      expect(machine.checkedTacts).toBe(5);
    });

    it("should not affect flags or registers", () => {
      // --- Arrange
      machine.initCode([0x6C, 0x80, 0x25], 0x1000, 0x1000); // JMP ($2580)
      machine.writeMemory(0x2580, 0x00);
      machine.writeMemory(0x2581, 0x60);
      machine.cpu.a = 0x11;
      machine.cpu.x = 0x22;
      machine.cpu.y = 0x33;
      machine.cpu.sp = 0xFD;
      machine.cpu.p = FlagSetMask6510.N | FlagSetMask6510.C | FlagSetMask6510.UNUSED;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x6000);
      expect(machine.cpu.a).toBe(0x11); // All registers unchanged
      expect(machine.cpu.x).toBe(0x22);
      expect(machine.cpu.y).toBe(0x33);
      expect(machine.cpu.sp).toBe(0xFD);
      expect(machine.cpu.isNFlagSet()).toBe(true); // Flags unchanged
      expect(machine.cpu.isCFlagSet()).toBe(true);
      expect(machine.checkedTacts).toBe(5);
    });
  });

  describe("JSR - Jump to Subroutine (0x20)", () => {
    it("should jump to subroutine and push return address", () => {
      // --- Arrange
      machine.initCode([0x20, 0x00, 0x30], 0x1000, 0x1000); // JSR $3000
      machine.cpu.pc = 0x1000;
      machine.cpu.sp = 0xFF;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x3000); // Jumped to subroutine
      expect(machine.cpu.sp).toBe(0xFD); // Stack pointer decremented by 2
      expect(machine.readMemory(0x01FF)).toBe(0x10); // Return address high byte (PC after JSR - 1)
      expect(machine.readMemory(0x01FE)).toBe(0x02); // Return address low byte (PC after JSR - 1)
      expect(machine.checkedTacts).toBe(6); // JSR takes 6 cycles
    });

    it("should push correct return address", () => {
      // --- Arrange
      machine.initCode([0x20, 0x34, 0x12], 0x2000, 0x2000); // JSR $1234
      machine.cpu.pc = 0x2000;
      machine.cpu.sp = 0xFF;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x1234);
      expect(machine.cpu.sp).toBe(0xFD);
      // JSR pushes PC - 1, so for PC=0x2003 after reading operands, it pushes 0x2002
      expect(machine.readMemory(0x01FF)).toBe(0x20); // High byte of 0x2002
      expect(machine.readMemory(0x01FE)).toBe(0x02); // Low byte of 0x2002
      expect(machine.checkedTacts).toBe(6);
    });

    it("should handle stack wrap around", () => {
      // --- Arrange
      machine.initCode([0x20, 0x00, 0x40], 0x1000, 0x1000); // JSR $4000
      machine.cpu.sp = 0x01; // Near stack overflow

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x4000);
      expect(machine.cpu.sp).toBe(0xFF); // Stack pointer wrapped around
      expect(machine.readMemory(0x0101)).toBe(0x10); // Return address high byte
      expect(machine.readMemory(0x0100)).toBe(0x02); // Return address low byte
      expect(machine.checkedTacts).toBe(6);
    });

    it("should not affect flags", () => {
      // --- Arrange
      machine.initCode([0x20, 0x00, 0x50], 0x1000, 0x1000); // JSR $5000
      machine.cpu.sp = 0xFF;
      machine.cpu.p = FlagSetMask6510.C | FlagSetMask6510.Z | FlagSetMask6510.N | FlagSetMask6510.V | FlagSetMask6510.UNUSED;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x5000);
      expect(machine.cpu.isCFlagSet()).toBe(true); // All flags unchanged
      expect(machine.cpu.isZFlagSet()).toBe(true);
      expect(machine.cpu.isNFlagSet()).toBe(true);
      expect(machine.cpu.isVFlagSet()).toBe(true);
      expect(machine.checkedTacts).toBe(6);
    });

    it("should not affect registers except PC and SP", () => {
      // --- Arrange
      machine.initCode([0x20, 0x00, 0x60], 0x1000, 0x1000); // JSR $6000
      machine.cpu.a = 0x55;
      machine.cpu.x = 0x66;
      machine.cpu.y = 0x77;
      machine.cpu.sp = 0xFF;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x6000);
      expect(machine.cpu.sp).toBe(0xFD);
      expect(machine.cpu.a).toBe(0x55); // Other registers unchanged
      expect(machine.cpu.x).toBe(0x66);
      expect(machine.cpu.y).toBe(0x77);
      expect(machine.checkedTacts).toBe(6);
    });
  });

  describe("RTS - Return from Subroutine (0x60)", () => {
    it("should return from subroutine", () => {
      // --- Arrange
      machine.initCode([0x60], 0x3000, 0x3000); // RTS
      machine.cpu.sp = 0xFD;
      machine.writeMemory(0x01FF, 0x10); // Return address high byte
      machine.writeMemory(0x01FE, 0x02); // Return address low byte

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x1003); // Returned to address + 1 (0x1002 + 1)
      expect(machine.cpu.sp).toBe(0xFF); // Stack pointer restored
      expect(machine.checkedTacts).toBe(6); // RTS takes 6 cycles
      expect(machine.checkedTacts).toBe(6);
    });

    it("should handle return to different addresses", () => {
      // --- Arrange
      machine.initCode([0x60], 0x5000, 0x5000); // RTS
      machine.cpu.sp = 0xFD;
      machine.writeMemory(0x01FF, 0x80); // Return address high byte (0x8055)
      machine.writeMemory(0x01FE, 0x55); // Return address low byte

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x8056); // 0x8055 + 1
      expect(machine.cpu.sp).toBe(0xFF);
      expect(machine.checkedTacts).toBe(6);
    });

    it("should handle stack wrap around", () => {
      // --- Arrange
      machine.initCode([0x60], 0x7000, 0x7000); // RTS
      machine.cpu.sp = 0xFF; // Stack underflow condition
      machine.writeMemory(0x0100, 0x34); // Return address high byte
      machine.writeMemory(0x0101, 0x20); // Return address low byte (wrapped)

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x2035); // 0x2034 + 1
      expect(machine.cpu.sp).toBe(0x01); // Stack pointer wrapped
      expect(machine.checkedTacts).toBe(6);
    });

    it("should not affect flags", () => {
      // --- Arrange
      machine.initCode([0x60], 0x4000, 0x4000); // RTS
      machine.cpu.sp = 0xFD;
      machine.writeMemory(0x01FF, 0x15);
      machine.writeMemory(0x01FE, 0x50);
      machine.cpu.p = FlagSetMask6510.C | FlagSetMask6510.Z | FlagSetMask6510.N | FlagSetMask6510.V | FlagSetMask6510.UNUSED;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x1551);
      expect(machine.cpu.isCFlagSet()).toBe(true); // All flags unchanged
      expect(machine.cpu.isZFlagSet()).toBe(true);
      expect(machine.cpu.isNFlagSet()).toBe(true);
      expect(machine.cpu.isVFlagSet()).toBe(true);
      expect(machine.checkedTacts).toBe(6);
    });

    it("should not affect registers except PC and SP", () => {
      // --- Arrange
      machine.initCode([0x60], 0x6000, 0x6000); // RTS
      machine.cpu.sp = 0xFD;
      machine.writeMemory(0x01FF, 0x25);
      machine.writeMemory(0x01FE, 0x80);
      machine.cpu.a = 0xAA;
      machine.cpu.x = 0xBB;
      machine.cpu.y = 0xCC;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x2581);
      expect(machine.cpu.sp).toBe(0xFF);
      expect(machine.cpu.a).toBe(0xAA); // Other registers unchanged
      expect(machine.cpu.x).toBe(0xBB);
      expect(machine.cpu.y).toBe(0xCC);
      expect(machine.checkedTacts).toBe(6);
    });
  });

  describe("RTI - Return from Interrupt (0x40)", () => {
    it("should return from interrupt and restore flags", () => {
      // --- Arrange
      machine.initCode([0x40], 0x8000, 0x8000); // RTI
      machine.cpu.sp = 0xFC;
      const originalFlags = FlagSetMask6510.C | FlagSetMask6510.Z | FlagSetMask6510.N | FlagSetMask6510.UNUSED;
      machine.writeMemory(0x01FD, originalFlags); // Processor status (pulled first)
      machine.writeMemory(0x01FE, 0x34); // Return address low byte (pulled second)
      machine.writeMemory(0x01FF, 0x12); // Return address high byte (pulled third)
      machine.cpu.p = 0x00; // Clear all flags

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x1234); // Returned to interrupt address
      expect(machine.cpu.sp).toBe(0xFF); // Stack pointer restored
      expect(machine.cpu.isCFlagSet()).toBe(true); // Flags restored
      expect(machine.cpu.isZFlagSet()).toBe(true);
      expect(machine.cpu.isNFlagSet()).toBe(true);
      expect(machine.cpu.p & FlagSetMask6510.UNUSED).toBe(FlagSetMask6510.UNUSED); // UNUSED always set
      expect(machine.checkedTacts).toBe(6); // RTI takes 6 cycles
    });

    it("should ignore B flag from stack and always set unused flag", () => {
      // --- Arrange
      machine.initCode([0x40], 0x9000, 0x9000); // RTI
      machine.cpu.sp = 0xFC;
      const stackedStatus = FlagSetMask6510.B | FlagSetMask6510.V | FlagSetMask6510.I; // Include B flag
      machine.writeMemory(0x01FD, stackedStatus); // Processor status (pulled first)
      machine.writeMemory(0x01FE, 0x00); // Return address low byte (pulled second)
      machine.writeMemory(0x01FF, 0x70); // Return address high byte (pulled third)
      machine.cpu.p = FlagSetMask6510.B; // B flag initially set

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x7000);
      expect(machine.cpu.p & FlagSetMask6510.B).toBe(0); // B flag ignored from stack
      expect(machine.cpu.isVFlagSet()).toBe(true); // V flag restored
      expect(machine.cpu.isIFlagSet()).toBe(true); // I flag restored
      expect(machine.cpu.p & FlagSetMask6510.UNUSED).toBe(FlagSetMask6510.UNUSED); // UNUSED always set
      expect(machine.checkedTacts).toBe(6);
    });

    it("should restore all flags except B flag", () => {
      // --- Arrange
      machine.initCode([0x40], 0xA000, 0xA000); // RTI
      machine.cpu.sp = 0xFC;
      const stackedStatus = 0xFF; // All flags set including B
      machine.writeMemory(0x01FD, stackedStatus); // Processor status (pulled first)
      machine.writeMemory(0x01FE, 0x56); // Return address low byte (pulled second)
      machine.writeMemory(0x01FF, 0x34); // Return address high byte (pulled third)
      machine.cpu.p = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x3456);
      expect(machine.cpu.isCFlagSet()).toBe(true);
      expect(machine.cpu.isZFlagSet()).toBe(true);
      expect(machine.cpu.isIFlagSet()).toBe(true);
      expect(machine.cpu.isDFlagSet()).toBe(true);
      expect(machine.cpu.p & FlagSetMask6510.B).toBe(0); // B flag not restored
      expect(machine.cpu.isVFlagSet()).toBe(true);
      expect(machine.cpu.isNFlagSet()).toBe(true);
      expect(machine.cpu.p & FlagSetMask6510.UNUSED).toBe(FlagSetMask6510.UNUSED);
      expect(machine.checkedTacts).toBe(6);
    });

    it("should handle stack wrap around", () => {
      // --- Arrange
      machine.initCode([0x40], 0xB000, 0xB000); // RTI
      machine.cpu.sp = 0xFE; // Near stack underflow
      machine.writeMemory(0x01FF, FlagSetMask6510.C | FlagSetMask6510.UNUSED);
      machine.writeMemory(0x0100, 0x88); // Return address low byte (wrapped)
      machine.writeMemory(0x0101, 0x77); // Return address high byte (wrapped)

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x7788);
      expect(machine.cpu.sp).toBe(0x01); // Stack pointer wrapped
      expect(machine.cpu.isCFlagSet()).toBe(true);
      expect(machine.checkedTacts).toBe(6);
    });

    it("should not affect registers except PC, SP, and P", () => {
      // --- Arrange
      machine.initCode([0x40], 0xC000, 0xC000); // RTI
      machine.cpu.sp = 0xFC;
      machine.writeMemory(0x01FD, FlagSetMask6510.N | FlagSetMask6510.UNUSED); // Processor status (pulled first)
      machine.writeMemory(0x01FE, 0x99); // Return address low byte (pulled second)
      machine.writeMemory(0x01FF, 0x88); // Return address high byte (pulled third)
      machine.cpu.a = 0x11;
      machine.cpu.x = 0x22;
      machine.cpu.y = 0x33;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x8899);
      expect(machine.cpu.sp).toBe(0xFF);
      expect(machine.cpu.isNFlagSet()).toBe(true);
      expect(machine.cpu.a).toBe(0x11); // Other registers unchanged
      expect(machine.cpu.x).toBe(0x22);
      expect(machine.cpu.y).toBe(0x33);
      expect(machine.checkedTacts).toBe(6);
    });
  });

  describe("Jump and Subroutine Operations - Complex Scenarios", () => {
    it("should handle JSR followed by RTS", () => {
      // --- Arrange: Execute JSR
      machine.initCode([0x20, 0x00, 0x30], 0x1000, 0x1000); // JSR $3000
      machine.cpu.sp = 0xFF;

      // --- Act: Execute JSR
      machine.run();
      
      // --- Assert after JSR
      expect(machine.cpu.pc).toBe(0x3000);
      expect(machine.cpu.sp).toBe(0xFD);
      expect(machine.readMemory(0x01FF)).toBe(0x10); // Return address high
      expect(machine.readMemory(0x01FE)).toBe(0x02); // Return address low
      
      // Create new machine for RTS with state from JSR
      const machine2 = new M6510VaTestMachine(RunMode.OneInstruction);
      machine2.initCode([0x60], 0x3000, 0x3000); // RTS
      machine2.cpu.sp = 0xFD; // Stack pointer from JSR
      machine2.writeMemory(0x01FF, 0x10); // Return address from JSR
      machine2.writeMemory(0x01FE, 0x02);
      
      // --- Act: Execute RTS
      machine2.run();
      
      // --- Assert after RTS
      expect(machine2.cpu.pc).toBe(0x1003); // Returned to instruction after JSR
      expect(machine2.cpu.sp).toBe(0xFF); // Stack pointer restored
      expect(machine.checkedTacts).toBe(6);
    });

    it("should handle nested subroutine calls", () => {
      // --- First JSR
      const machine1 = new M6510VaTestMachine(RunMode.OneInstruction);
      machine1.initCode([0x20, 0x00, 0x20], 0x1000, 0x1000); // JSR $2000
      machine1.cpu.sp = 0xFF;
      machine1.run();
      
      expect(machine1.cpu.pc).toBe(0x2000);
      expect(machine1.cpu.sp).toBe(0xFD);
      expect(machine1.readMemory(0x01FF)).toBe(0x10);
      expect(machine1.readMemory(0x01FE)).toBe(0x02);
      
      // --- Second JSR (nested)
      const machine2 = new M6510VaTestMachine(RunMode.OneInstruction);
      machine2.initCode([0x20, 0x00, 0x30], 0x2000, 0x2000); // JSR $3000
      machine2.cpu.sp = 0xFD;
      machine2.writeMemory(0x01FF, 0x10); // Preserve first return address
      machine2.writeMemory(0x01FE, 0x02);
      machine2.run();
      
      expect(machine2.cpu.pc).toBe(0x3000);
      expect(machine2.cpu.sp).toBe(0xFB);
      expect(machine2.readMemory(0x01FD)).toBe(0x20); // Second return address high
      expect(machine2.readMemory(0x01FC)).toBe(0x02); // Second return address low
      
      // --- First RTS (return from nested call)
      const machine3 = new M6510VaTestMachine(RunMode.OneInstruction);
      machine3.initCode([0x60], 0x3000, 0x3000); // RTS
      machine3.cpu.sp = 0xFB;
      machine3.writeMemory(0x01FF, 0x10); // Preserve stack state
      machine3.writeMemory(0x01FE, 0x02);
      machine3.writeMemory(0x01FD, 0x20);
      machine3.writeMemory(0x01FC, 0x02);
      machine3.run();
      
      expect(machine3.cpu.pc).toBe(0x2003); // Returned to second instruction after nested JSR
      expect(machine3.cpu.sp).toBe(0xFD);
      
      // --- Second RTS (return from first call)
      const machine4 = new M6510VaTestMachine(RunMode.OneInstruction);
      machine4.initCode([0x60], 0x2003, 0x2003); // RTS
      machine4.cpu.sp = 0xFD;
      machine4.writeMemory(0x01FF, 0x10);
      machine4.writeMemory(0x01FE, 0x02);
      machine4.run();
      
      expect(machine4.cpu.pc).toBe(0x1003); // Returned to original caller
      expect(machine4.cpu.sp).toBe(0xFF);
    });

    it("should handle JMP followed by other instructions", () => {
      // --- Execute JMP
      machine.initCode([0x4C, 0x00, 0x50], 0x1000, 0x1000); // JMP $5000
      machine.cpu.a = 0x42;
      machine.cpu.x = 0x33;
      
      machine.run();
      
      // --- Assert after JMP
      expect(machine.cpu.pc).toBe(0x5000);
      expect(machine.cpu.a).toBe(0x42); // Registers preserved
      expect(machine.cpu.x).toBe(0x33);
      
      // The execution would continue from 0x5000 with the next instruction
    });

    it("should handle indirect jump with page boundary bug correctly", () => {
      // --- Test the famous 6502 JMP indirect bug
      machine.initCode([0x6C, 0xFF, 0x10], 0x2000, 0x2000); // JMP ($10FF)
      
      // Set up the bug scenario
      machine.writeMemory(0x10FF, 0x00); // Low byte of target address
      machine.writeMemory(0x1000, 0x80); // High byte should come from same page due to bug
      machine.writeMemory(0x1100, 0x90); // This should NOT be used due to the bug
      
      machine.run();
      
      // Should jump to 0x8000, not 0x9000
      expect(machine.cpu.pc).toBe(0x8000);
    });

    it("should preserve processor state across jumps", () => {
      // --- Set up initial state
      machine.initCode([0x4C, 0x00, 0x60], 0x1000, 0x1000); // JMP $6000
      machine.cpu.a = 0x55;
      machine.cpu.x = 0x66;
      machine.cpu.y = 0x77;
      machine.cpu.sp = 0xFE;
      machine.cpu.p = FlagSetMask6510.C | FlagSetMask6510.Z | FlagSetMask6510.V | FlagSetMask6510.UNUSED;
      
      machine.run();
      
      // --- Assert all state preserved except PC
      expect(machine.cpu.pc).toBe(0x6000); // Only PC changed
      expect(machine.cpu.a).toBe(0x55);
      expect(machine.cpu.x).toBe(0x66);
      expect(machine.cpu.y).toBe(0x77);
      expect(machine.cpu.sp).toBe(0xFE);
      expect(machine.cpu.isCFlagSet()).toBe(true);
      expect(machine.cpu.isZFlagSet()).toBe(true);
      expect(machine.cpu.isVFlagSet()).toBe(true);
    });
  });

  describe("BRK - Force Break (0x00)", () => {
    it("should execute break and jump to interrupt vector", () => {
      // --- Arrange
      machine.initCode([0x00, 0xEA], 0x1000, 0x1000); // BRK + operand byte
      machine.cpu.sp = 0xFF;
      machine.cpu.p = FlagSetMask6510.C | FlagSetMask6510.Z; // Set some flags
      machine.writeMemory(0xFFFE, 0x00); // IRQ vector low byte
      machine.writeMemory(0xFFFF, 0x80); // IRQ vector high byte

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x8000); // Jumped to IRQ vector
      expect(machine.cpu.sp).toBe(0xFC); // Stack pointer decremented by 3
      expect(machine.cpu.isIFlagSet()).toBe(true); // Interrupt disable flag set
      
      // Check stack contents
      expect(machine.readMemory(0x01FF)).toBe(0x10); // PC high byte (0x1002)
      expect(machine.readMemory(0x01FE)).toBe(0x02); // PC low byte (0x1002)
      expect(machine.readMemory(0x01FD) & FlagSetMask6510.B).toBe(FlagSetMask6510.B); // B flag set in pushed status
      expect(machine.readMemory(0x01FD) & FlagSetMask6510.UNUSED).toBe(FlagSetMask6510.UNUSED); // UNUSED flag set
      expect(machine.readMemory(0x01FD) & FlagSetMask6510.C).toBe(FlagSetMask6510.C); // Original C flag preserved
      expect(machine.readMemory(0x01FD) & FlagSetMask6510.Z).toBe(FlagSetMask6510.Z); // Original Z flag preserved
    });

    it("should preserve original flags except I and B flags", () => {
      // --- Arrange
      machine.initCode([0x00, 0xEA], 0x2000, 0x2000); // BRK + operand byte
      machine.cpu.sp = 0xFF;
      machine.cpu.p = FlagSetMask6510.N | FlagSetMask6510.V | FlagSetMask6510.D; // Set various flags
      machine.writeMemory(0xFFFE, 0x34);
      machine.writeMemory(0xFFFF, 0x12);

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x1234);
      expect(machine.cpu.isIFlagSet()).toBe(true); // I flag set by BRK
      expect(machine.cpu.p & FlagSetMask6510.B).toBe(0); // B flag not set in processor (only in pushed value)
      expect(machine.cpu.isNFlagSet()).toBe(true); // Original flags preserved
      expect(machine.cpu.isVFlagSet()).toBe(true);
      expect(machine.cpu.isDFlagSet()).toBe(true);
      
      // Check that B flag was set in the pushed status
      expect(machine.readMemory(0x01FD) & FlagSetMask6510.B).toBe(FlagSetMask6510.B);
    });

    it("should handle different interrupt vectors", () => {
      // --- Arrange
      machine.initCode([0x00, 0xEA], 0x3000, 0x3000); // BRK + operand byte
      machine.cpu.sp = 0xFF;
      machine.writeMemory(0xFFFE, 0xAB); // Different vector
      machine.writeMemory(0xFFFF, 0xCD);

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0xCDAB); // Jumped to specified vector
      expect(machine.readMemory(0x01FF)).toBe(0x30); // Correct return address high
      expect(machine.readMemory(0x01FE)).toBe(0x02); // Correct return address low (PC after operand)
    });

    it("should handle stack wrap around", () => {
      // --- Arrange
      machine.initCode([0x00, 0xEA], 0x4000, 0x4000); // BRK + operand byte
      machine.cpu.sp = 0x01; // Near stack overflow
      machine.writeMemory(0xFFFE, 0x56);
      machine.writeMemory(0xFFFF, 0x78);

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x7856);
      expect(machine.cpu.sp).toBe(0xFE); // Stack pointer wrapped around
      expect(machine.readMemory(0x0101)).toBe(0x40); // PC high byte at wrap location
      expect(machine.readMemory(0x0100)).toBe(0x02); // PC low byte at wrap location
      expect(machine.readMemory(0x01FF) & FlagSetMask6510.B).toBe(FlagSetMask6510.B); // Status at wrap location
    });

    it("should set unused flag in pushed status", () => {
      // --- Arrange
      machine.initCode([0x00, 0xEA], 0x5000, 0x5000); // BRK + operand byte
      machine.cpu.sp = 0xFF;
      machine.cpu.p = 0x00; // Clear all flags
      machine.writeMemory(0xFFFE, 0x99);
      machine.writeMemory(0xFFFF, 0x88);

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x8899);
      expect(machine.readMemory(0x01FD) & FlagSetMask6510.UNUSED).toBe(FlagSetMask6510.UNUSED); // UNUSED always set
      expect(machine.readMemory(0x01FD) & FlagSetMask6510.B).toBe(FlagSetMask6510.B); // B flag set
    });

    it("should not affect registers except PC, SP, and P", () => {
      // --- Arrange
      machine.initCode([0x00, 0xEA], 0x6000, 0x6000); // BRK + operand byte
      machine.cpu.sp = 0xFF;
      machine.cpu.a = 0xAA;
      machine.cpu.x = 0xBB;
      machine.cpu.y = 0xCC;
      machine.writeMemory(0xFFFE, 0x11);
      machine.writeMemory(0xFFFF, 0x22);

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x2211);
      expect(machine.cpu.sp).toBe(0xFC);
      expect(machine.cpu.isIFlagSet()).toBe(true);
      expect(machine.cpu.a).toBe(0xAA); // Other registers unchanged
      expect(machine.cpu.x).toBe(0xBB);
      expect(machine.cpu.y).toBe(0xCC);
    });

    it("should work with BRK followed by RTI", () => {
      // --- Execute BRK first
      machine.initCode([0x00, 0xEA], 0x7000, 0x7000); // BRK + operand byte
      machine.cpu.sp = 0xFF;
      machine.cpu.p = FlagSetMask6510.C | FlagSetMask6510.V | FlagSetMask6510.UNUSED;
      machine.writeMemory(0xFFFE, 0x00);
      machine.writeMemory(0xFFFF, 0x90);
      
      machine.run();
      
      // --- Assert after BRK
      expect(machine.cpu.pc).toBe(0x9000);
      expect(machine.cpu.sp).toBe(0xFC);
      expect(machine.cpu.isIFlagSet()).toBe(true);
      expect(machine.readMemory(0x01FF)).toBe(0x70); // Return address high
      expect(machine.readMemory(0x01FE)).toBe(0x02); // Return address low
      
      // Create new machine for RTI with state from BRK
      const machine2 = new M6510VaTestMachine(RunMode.OneInstruction);
      machine2.initCode([0x40], 0x9000, 0x9000); // RTI
      machine2.cpu.sp = 0xFC; // Stack pointer from BRK
      machine2.writeMemory(0x01FD, FlagSetMask6510.C | FlagSetMask6510.V | FlagSetMask6510.B | FlagSetMask6510.UNUSED); // Status from BRK
      machine2.writeMemory(0x01FE, 0x02); // Return address from BRK
      machine2.writeMemory(0x01FF, 0x70);
      
      // --- Act: Execute RTI
      machine2.run();
      
      // --- Assert after RTI
      expect(machine2.cpu.pc).toBe(0x7002); // Returned to instruction after BRK
      expect(machine2.cpu.sp).toBe(0xFF); // Stack pointer restored
      expect(machine2.cpu.isCFlagSet()).toBe(true); // Original flags restored
      expect(machine2.cpu.isVFlagSet()).toBe(true);
      expect(machine2.cpu.p & FlagSetMask6510.B).toBe(0); // B flag not restored (RTI behavior)
    });
  });
});
