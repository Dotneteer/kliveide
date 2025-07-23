import { describe, it, expect, beforeEach } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";
import { FlagSetMask6510 } from "../../src/emu/abstractions/FlagSetMask6510";

describe("M6510 - Stack Instructions", () => {
  let machine: M6510TestMachine;

  beforeEach(() => {
    machine = new M6510TestMachine(RunMode.OneInstruction);
  });

  describe("PHA - Push Accumulator (0x48)", () => {
    it("should push accumulator value onto stack", () => {
      // --- Arrange
      machine.initCode([0x48], 0x1000, 0x1000); // PHA
      machine.cpu.a = 0x42;
      machine.cpu.sp = 0xFF; // Full stack

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x42); // Accumulator unchanged
      expect(machine.cpu.sp).toBe(0xFE); // Stack pointer decremented
      expect(machine.readMemory(0x01FF)).toBe(0x42); // Value on stack
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(3); // PHA takes 3 cycles
    });

    it("should handle stack wrap around", () => {
      // --- Arrange
      machine.initCode([0x48], 0x1000, 0x1000); // PHA
      machine.cpu.a = 0x55;
      machine.cpu.sp = 0x00; // Stack pointer at minimum

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.sp).toBe(0xFF); // Stack pointer wraps to 0xFF
      expect(machine.readMemory(0x0100)).toBe(0x55); // Value written to 0x0100
    });

    it("should not affect flags", () => {
      // --- Arrange
      machine.initCode([0x48], 0x1000, 0x1000); // PHA
      machine.cpu.a = 0x80; // Negative value
      machine.cpu.sp = 0xFF;
      machine.cpu.p = FlagSetMask6510.C | FlagSetMask6510.Z | FlagSetMask6510.UNUSED; // Set some flags

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.isCFlagSet()).toBe(true); // Flags unchanged
      expect(machine.cpu.isZFlagSet()).toBe(true);
      expect(machine.cpu.isNFlagSet()).toBe(false);
    });
  });

  describe("PLA - Pull Accumulator (0x68)", () => {
    it("should pull value from stack into accumulator", () => {
      // --- Arrange
      machine.initCode([0x68], 0x1000, 0x1000); // PLA
      machine.cpu.sp = 0xFE; // Stack has one item
      machine.writeMemory(0x01FF, 0x33); // Value on stack
      machine.cpu.a = 0x00; // Clear accumulator

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x33); // Accumulator loaded from stack
      expect(machine.cpu.sp).toBe(0xFF); // Stack pointer incremented
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(4); // PLA takes 4 cycles
    });

    it("should set zero flag when pulled value is zero", () => {
      // --- Arrange
      machine.initCode([0x68], 0x1000, 0x1000); // PLA
      machine.cpu.sp = 0xFE;
      machine.writeMemory(0x01FF, 0x00); // Zero value on stack

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x00);
      expect(machine.cpu.isZFlagSet()).toBe(true);
      expect(machine.cpu.isNFlagSet()).toBe(false);
    });

    it("should set negative flag when pulled value bit 7 is set", () => {
      // --- Arrange
      machine.initCode([0x68], 0x1000, 0x1000); // PLA
      machine.cpu.sp = 0xFE;
      machine.writeMemory(0x01FF, 0x80); // Negative value on stack

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x80);
      expect(machine.cpu.isZFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(true);
    });

    it("should handle stack wrap around", () => {
      // --- Arrange
      machine.initCode([0x68], 0x1000, 0x1000); // PLA
      machine.cpu.sp = 0xFF; // Stack pointer at maximum
      machine.writeMemory(0x0100, 0x77); // Value at wrap-around location

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.sp).toBe(0x00); // Stack pointer wraps to 0x00
      expect(machine.cpu.a).toBe(0x77); // Value pulled from 0x0100
    });

    it("should clear zero flag and set appropriate flags for normal value", () => {
      // --- Arrange
      machine.initCode([0x68], 0x1000, 0x1000); // PLA
      machine.cpu.sp = 0xFE;
      machine.writeMemory(0x01FF, 0x42); // Positive, non-zero value
      machine.cpu.p |= FlagSetMask6510.Z | FlagSetMask6510.N; // Set Z and N flags initially

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x42);
      expect(machine.cpu.isZFlagSet()).toBe(false); // Z flag cleared
      expect(machine.cpu.isNFlagSet()).toBe(false); // N flag cleared
    });
  });

  describe("PHP - Push Processor Status (0x08)", () => {
    it("should push processor status with B flag set", () => {
      // --- Arrange
      machine.initCode([0x08], 0x1000, 0x1000); // PHP
      machine.cpu.sp = 0xFF;
      machine.cpu.p = FlagSetMask6510.C | FlagSetMask6510.Z | FlagSetMask6510.UNUSED; // Set some flags but not B

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.sp).toBe(0xFE); // Stack pointer decremented
      const pushedStatus = machine.readMemory(0x01FF);
      expect(pushedStatus & FlagSetMask6510.B).toBe(FlagSetMask6510.B); // B flag set in pushed value
      expect(pushedStatus & FlagSetMask6510.C).toBe(FlagSetMask6510.C); // C flag preserved
      expect(pushedStatus & FlagSetMask6510.Z).toBe(FlagSetMask6510.Z); // Z flag preserved
      expect(pushedStatus & FlagSetMask6510.UNUSED).toBe(FlagSetMask6510.UNUSED); // UNUSED flag set
      expect(machine.cpu.p & FlagSetMask6510.B).toBe(0); // B flag not changed in actual processor
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(3); // PHP takes 3 cycles
    });

    it("should always set unused flag (bit 5) in pushed status", () => {
      // --- Arrange
      machine.initCode([0x08], 0x1000, 0x1000); // PHP
      machine.cpu.sp = 0xFF;
      machine.cpu.p = 0x00; // Clear all flags

      // --- Act
      machine.run();

      // --- Assert
      const pushedStatus = machine.readMemory(0x01FF);
      expect(pushedStatus & FlagSetMask6510.UNUSED).toBe(FlagSetMask6510.UNUSED); // Bit 5 always set
      expect(pushedStatus & FlagSetMask6510.B).toBe(FlagSetMask6510.B); // B flag set in pushed value
    });

    it("should preserve all processor flags in the actual register", () => {
      // --- Arrange
      machine.initCode([0x08], 0x1000, 0x1000); // PHP
      machine.cpu.sp = 0xFF;
      const originalFlags = FlagSetMask6510.N | FlagSetMask6510.V | FlagSetMask6510.I | FlagSetMask6510.UNUSED;
      machine.cpu.p = originalFlags;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.p).toBe(originalFlags); // Processor flags unchanged
      const pushedStatus = machine.readMemory(0x01FF);
      expect(pushedStatus & FlagSetMask6510.N).toBe(FlagSetMask6510.N);
      expect(pushedStatus & FlagSetMask6510.V).toBe(FlagSetMask6510.V);
      expect(pushedStatus & FlagSetMask6510.I).toBe(FlagSetMask6510.I);
    });
  });

  describe("PLP - Pull Processor Status (0x28)", () => {
    it("should pull processor status from stack", () => {
      // --- Arrange
      machine.initCode([0x28], 0x1000, 0x1000); // PLP
      machine.cpu.sp = 0xFE;
      const stackedStatus = FlagSetMask6510.C | FlagSetMask6510.Z | FlagSetMask6510.N | FlagSetMask6510.UNUSED;
      machine.writeMemory(0x01FF, stackedStatus);
      machine.cpu.p = 0x00; // Clear processor flags

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.sp).toBe(0xFF); // Stack pointer incremented
      expect(machine.cpu.isCFlagSet()).toBe(true); // C flag restored
      expect(machine.cpu.isZFlagSet()).toBe(true); // Z flag restored
      expect(machine.cpu.isNFlagSet()).toBe(true); // N flag restored
      expect(machine.cpu.p & FlagSetMask6510.UNUSED).toBe(FlagSetMask6510.UNUSED); // UNUSED always set
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(4); // PLP takes 4 cycles
    });

    it("should ignore B flag from stack and always set unused flag", () => {
      // --- Arrange
      machine.initCode([0x28], 0x1000, 0x1000); // PLP
      machine.cpu.sp = 0xFE;
      const stackedStatus = FlagSetMask6510.B | FlagSetMask6510.V; // Include B flag in stacked value
      machine.writeMemory(0x01FF, stackedStatus);
      machine.cpu.p = FlagSetMask6510.B; // B flag initially set

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.p & FlagSetMask6510.B).toBe(0); // B flag ignored from stack
      expect(machine.cpu.isVFlagSet()).toBe(true); // V flag restored
      expect(machine.cpu.p & FlagSetMask6510.UNUSED).toBe(FlagSetMask6510.UNUSED); // UNUSED always set
    });

    it("should restore all flags except B flag", () => {
      // --- Arrange
      machine.initCode([0x28], 0x1000, 0x1000); // PLP
      machine.cpu.sp = 0xFE;
      const stackedStatus = 0xFF; // All flags set including B
      machine.writeMemory(0x01FF, stackedStatus);
      machine.cpu.p = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.isCFlagSet()).toBe(true);
      expect(machine.cpu.isZFlagSet()).toBe(true);
      expect(machine.cpu.isIFlagSet()).toBe(true);
      expect(machine.cpu.isDFlagSet()).toBe(true);
      expect(machine.cpu.p & FlagSetMask6510.B).toBe(0); // B flag not restored
      expect(machine.cpu.isVFlagSet()).toBe(true);
      expect(machine.cpu.isNFlagSet()).toBe(true);
      expect(machine.cpu.p & FlagSetMask6510.UNUSED).toBe(FlagSetMask6510.UNUSED);
    });
  });

  describe("TXS - Transfer X to Stack Pointer (0x9A)", () => {
    it("should transfer X register to stack pointer", () => {
      // --- Arrange
      machine.initCode([0x9A], 0x1000, 0x1000); // TXS
      machine.cpu.x = 0x80;
      machine.cpu.sp = 0xFF;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.sp).toBe(0x80); // Stack pointer set to X value
      expect(machine.cpu.x).toBe(0x80); // X register unchanged
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(2); // TXS takes 2 cycles
    });

    it("should not affect flags", () => {
      // --- Arrange
      machine.initCode([0x9A], 0x1000, 0x1000); // TXS
      machine.cpu.x = 0x00; // Zero value
      machine.cpu.sp = 0xFF;
      machine.cpu.p = FlagSetMask6510.N | FlagSetMask6510.C | FlagSetMask6510.UNUSED; // Set some flags

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.sp).toBe(0x00);
      expect(machine.cpu.isNFlagSet()).toBe(true); // Flags unchanged
      expect(machine.cpu.isCFlagSet()).toBe(true);
      expect(machine.cpu.isZFlagSet()).toBe(false); // Z flag not affected by transfer
    });

    it("should handle full range of X values", () => {
      // --- Arrange
      machine.initCode([0x9A], 0x1000, 0x1000); // TXS
      machine.cpu.x = 0xFF;
      machine.cpu.sp = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.sp).toBe(0xFF);
    });
  });

  describe("TSX - Transfer Stack Pointer to X (0xBA)", () => {
    it("should transfer stack pointer to X register", () => {
      // --- Arrange
      machine.initCode([0xBA], 0x1000, 0x1000); // TSX
      machine.cpu.sp = 0x42;
      machine.cpu.x = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.x).toBe(0x42); // X register set to stack pointer value
      expect(machine.cpu.sp).toBe(0x42); // Stack pointer unchanged
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(2); // TSX takes 2 cycles
    });

    it("should set zero flag when stack pointer is zero", () => {
      // --- Arrange
      machine.initCode([0xBA], 0x1000, 0x1000); // TSX
      machine.cpu.sp = 0x00;
      machine.cpu.x = 0xFF;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.x).toBe(0x00);
      expect(machine.cpu.isZFlagSet()).toBe(true);
      expect(machine.cpu.isNFlagSet()).toBe(false);
    });

    it("should set negative flag when stack pointer bit 7 is set", () => {
      // --- Arrange
      machine.initCode([0xBA], 0x1000, 0x1000); // TSX
      machine.cpu.sp = 0x80;
      machine.cpu.x = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.x).toBe(0x80);
      expect(machine.cpu.isZFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(true);
    });

    it("should clear zero and negative flags for normal values", () => {
      // --- Arrange
      machine.initCode([0xBA], 0x1000, 0x1000); // TSX
      machine.cpu.sp = 0x42; // Positive, non-zero value
      machine.cpu.x = 0x00;
      machine.cpu.p |= FlagSetMask6510.Z | FlagSetMask6510.N; // Set Z and N flags initially

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.x).toBe(0x42);
      expect(machine.cpu.isZFlagSet()).toBe(false); // Z flag cleared
      expect(machine.cpu.isNFlagSet()).toBe(false); // N flag cleared
    });
  });

  describe("Stack Operations - Complex Scenarios", () => {
    it("should handle PHA followed by PLA", () => {
      // --- Arrange
      machine.initCode([0x48], 0x1000, 0x1000); // PHA
      machine.cpu.a = 0x55;
      machine.cpu.sp = 0xFF;

      // --- Act: Execute PHA
      machine.run();
      
      // --- Assert after PHA
      expect(machine.cpu.a).toBe(0x55);
      expect(machine.cpu.sp).toBe(0xFE);
      expect(machine.readMemory(0x01FF)).toBe(0x55);
      
      // Create new machine for PLA with state from first instruction
      const machine2 = new M6510TestMachine(RunMode.OneInstruction);
      machine2.initCode([0x68], 0x1000, 0x1000); // PLA
      machine2.cpu.a = 0x00; // Clear accumulator
      machine2.cpu.sp = 0xFE; // Stack pointer from previous instruction
      machine2.writeMemory(0x01FF, 0x55); // Value on stack from previous instruction
      
      // --- Act: Execute PLA
      machine2.run();
      
      // --- Assert after PLA
      expect(machine2.cpu.a).toBe(0x55); // Original value restored
      expect(machine2.cpu.sp).toBe(0xFF); // Stack pointer restored
    });

    it("should handle PHP followed by PLP", () => {
      // --- Arrange
      machine.initCode([0x08], 0x1000, 0x1000); // PHP
      const originalFlags = FlagSetMask6510.C | FlagSetMask6510.Z | FlagSetMask6510.V | FlagSetMask6510.UNUSED;
      machine.cpu.p = originalFlags;
      machine.cpu.sp = 0xFF;

      // --- Act: Execute PHP
      machine.run();
      
      // --- Assert after PHP
      expect(machine.cpu.sp).toBe(0xFE);
      expect(machine.cpu.p).toBe(originalFlags); // Flags unchanged in processor
      
      // Create new machine for PLP with state from first instruction
      const machine2 = new M6510TestMachine(RunMode.OneInstruction);
      machine2.initCode([0x28], 0x1000, 0x1000); // PLP
      machine2.cpu.p = 0x00; // Clear all flags
      machine2.cpu.sp = 0xFE; // Stack pointer from previous instruction
      // Copy the stacked status from the previous instruction
      const stackedStatus = machine.readMemory(0x01FF);
      machine2.writeMemory(0x01FF, stackedStatus);
      
      // --- Act: Execute PLP
      machine2.run();
      
      // --- Assert after PLP
      expect(machine2.cpu.sp).toBe(0xFF); // Stack pointer restored
      expect(machine2.cpu.isCFlagSet()).toBe(true); // Flags restored
      expect(machine2.cpu.isZFlagSet()).toBe(true);
      expect(machine2.cpu.isVFlagSet()).toBe(true);
      expect(machine2.cpu.p & FlagSetMask6510.B).toBe(0); // B flag not restored
      expect(machine2.cpu.p & FlagSetMask6510.UNUSED).toBe(FlagSetMask6510.UNUSED); // UNUSED always set
    });

    it("should handle TXS followed by TSX", () => {
      // --- Arrange
      machine.initCode([0x9A], 0x1000, 0x1000); // TXS
      machine.cpu.x = 0x42;
      machine.cpu.sp = 0xFF;

      // --- Act: Execute TXS
      machine.run();
      
      // --- Assert after TXS
      expect(machine.cpu.sp).toBe(0x42);
      expect(machine.cpu.x).toBe(0x42);
      
      // Create new machine for TSX with state from first instruction
      const machine2 = new M6510TestMachine(RunMode.OneInstruction);
      machine2.initCode([0xBA], 0x1000, 0x1000); // TSX
      machine2.cpu.x = 0x00; // Clear X register
      machine2.cpu.sp = 0x42; // Stack pointer from previous instruction
      
      // --- Act: Execute TSX
      machine2.run();
      
      // --- Assert after TSX
      expect(machine2.cpu.x).toBe(0x42); // X restored from stack pointer
      expect(machine2.cpu.sp).toBe(0x42); // Stack pointer unchanged
      expect(machine2.cpu.isZFlagSet()).toBe(false);
      expect(machine2.cpu.isNFlagSet()).toBe(false);
    });

    it("should handle multiple stack operations", () => {
      // --- Test: Push multiple values using separate machines
      const machine1 = new M6510TestMachine(RunMode.OneInstruction);
      machine1.initCode([0x48], 0x1000, 0x1000); // PHA
      machine1.cpu.sp = 0xFF;
      machine1.cpu.a = 0x11;
      machine1.run();
      expect(machine1.cpu.sp).toBe(0xFE);
      expect(machine1.readMemory(0x01FF)).toBe(0x11);
      
      const machine2 = new M6510TestMachine(RunMode.OneInstruction);
      machine2.initCode([0x48], 0x1000, 0x1000); // PHA
      machine2.cpu.sp = 0xFE;
      machine2.cpu.a = 0x22;
      machine2.writeMemory(0x01FF, 0x11); // Preserve previous stack value
      machine2.run();
      expect(machine2.cpu.sp).toBe(0xFD);
      expect(machine2.readMemory(0x01FE)).toBe(0x22);
      
      const machine3 = new M6510TestMachine(RunMode.OneInstruction);
      machine3.initCode([0x48], 0x1000, 0x1000); // PHA
      machine3.cpu.sp = 0xFD;
      machine3.cpu.a = 0x33;
      machine3.writeMemory(0x01FF, 0x11); // Preserve previous stack values
      machine3.writeMemory(0x01FE, 0x22);
      machine3.run();
      expect(machine3.cpu.sp).toBe(0xFC);
      expect(machine3.readMemory(0x01FD)).toBe(0x33);
      
      // --- Test: Pull values back (LIFO order) using separate machines
      const machine4 = new M6510TestMachine(RunMode.OneInstruction);
      machine4.initCode([0x68], 0x1000, 0x1000); // PLA
      machine4.cpu.sp = 0xFC;
      machine4.writeMemory(0x01FD, 0x33);
      machine4.writeMemory(0x01FE, 0x22);
      machine4.writeMemory(0x01FF, 0x11);
      machine4.run();
      expect(machine4.cpu.a).toBe(0x33); // Last pushed, first pulled
      expect(machine4.cpu.sp).toBe(0xFD);
      
      const machine5 = new M6510TestMachine(RunMode.OneInstruction);
      machine5.initCode([0x68], 0x1000, 0x1000); // PLA
      machine5.cpu.sp = 0xFD;
      machine5.writeMemory(0x01FE, 0x22);
      machine5.writeMemory(0x01FF, 0x11);
      machine5.run();
      expect(machine5.cpu.a).toBe(0x22); // Second value
      expect(machine5.cpu.sp).toBe(0xFE);
      
      const machine6 = new M6510TestMachine(RunMode.OneInstruction);
      machine6.initCode([0x68], 0x1000, 0x1000); // PLA
      machine6.cpu.sp = 0xFE;
      machine6.writeMemory(0x01FF, 0x11);
      machine6.run();
      expect(machine6.cpu.a).toBe(0x11); // First value
      expect(machine6.cpu.sp).toBe(0xFF);
    });

    it("should handle stack underflow and overflow edge cases", () => {
      // --- Test stack underflow (pulling from empty stack)
      machine.initCode([0x68], 0x1000, 0x1000); // PLA
      machine.cpu.sp = 0xFF; // Empty stack
      machine.writeMemory(0x0100, 0xAA); // Set value at wrap-around location
      
      machine.run();
      expect(machine.cpu.sp).toBe(0x00); // Wraps to 0x00
      expect(machine.cpu.a).toBe(0xAA); // Pulls from 0x0100
      
      // --- Test stack overflow (pushing to full stack)
      machine.initCode([0x48], 0x1001, 0x1001); // PHA
      machine.cpu.sp = 0x00; // Full stack (pointing to 0x0100)
      machine.cpu.a = 0xBB;
      
      machine.run();
      expect(machine.cpu.sp).toBe(0xFF); // Wraps to 0xFF
      expect(machine.readMemory(0x0100)).toBe(0xBB); // Pushes to 0x0100
    });
  });
});
