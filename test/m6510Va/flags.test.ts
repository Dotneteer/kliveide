import { describe, it, expect } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";
import { FlagSetMask6510 } from "../../src/emu/abstractions/FlagSetMask6510";

describe("M6510 - Flag Instructions", () => {
  describe("CLC - Clear Carry Flag (0x18)", () => {
    it("should clear carry flag when set", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x18], 0x1000, 0x1000); // CLC
      machine.cpu.p |= FlagSetMask6510.C; // Set carry flag
      
      machine.run();
      
      expect(machine.cpu.isCFlagSet()).toBe(false);
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(2);
    });

    it("should leave carry flag clear when already clear", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x18], 0x1000, 0x1000); // CLC
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry flag
      
      machine.run();
      
      expect(machine.cpu.isCFlagSet()).toBe(false);
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(2);
    });

    it("should not affect other flags", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x18], 0x1000, 0x1000); // CLC
      machine.cpu.p = FlagSetMask6510.N | FlagSetMask6510.Z | FlagSetMask6510.V | 
                     FlagSetMask6510.D | FlagSetMask6510.I | FlagSetMask6510.C |
                     FlagSetMask6510.UNUSED;
      
      machine.run();
      
      expect(machine.cpu.isCFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(true);
      expect(machine.cpu.isZFlagSet()).toBe(true);
      expect(machine.cpu.isVFlagSet()).toBe(true);
      expect(machine.cpu.isDFlagSet()).toBe(true);
      expect(machine.cpu.isIFlagSet()).toBe(true);
    });
  });

  describe("SEC - Set Carry Flag (0x38)", () => {
    it("should set carry flag when clear", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x38], 0x1000, 0x1000); // SEC
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear carry flag
      
      machine.run();
      
      expect(machine.cpu.isCFlagSet()).toBe(true);
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(2);
    });

    it("should leave carry flag set when already set", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x38], 0x1000, 0x1000); // SEC
      machine.cpu.p |= FlagSetMask6510.C; // Set carry flag
      
      machine.run();
      
      expect(machine.cpu.isCFlagSet()).toBe(true);
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(2);
    });

    it("should not affect other flags", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x38], 0x1000, 0x1000); // SEC
      machine.cpu.p = FlagSetMask6510.N | FlagSetMask6510.Z | FlagSetMask6510.V | 
                     FlagSetMask6510.D | FlagSetMask6510.I | FlagSetMask6510.UNUSED;
      
      machine.run();
      
      expect(machine.cpu.isCFlagSet()).toBe(true);
      expect(machine.cpu.isNFlagSet()).toBe(true);
      expect(machine.cpu.isZFlagSet()).toBe(true);
      expect(machine.cpu.isVFlagSet()).toBe(true);
      expect(machine.cpu.isDFlagSet()).toBe(true);
      expect(machine.cpu.isIFlagSet()).toBe(true);
    });
  });

  describe("CLI - Clear Interrupt Disable Flag (0x58)", () => {
    it("should clear interrupt disable flag when set", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x58], 0x1000, 0x1000); // CLI
      machine.cpu.p |= FlagSetMask6510.I; // Set interrupt disable flag
      
      machine.run();
      
      expect(machine.cpu.isIFlagSet()).toBe(false);
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(2);
    });

    it("should leave interrupt disable flag clear when already clear", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x58], 0x1000, 0x1000); // CLI
      machine.cpu.p &= ~FlagSetMask6510.I; // Clear interrupt disable flag
      
      machine.run();
      
      expect(machine.cpu.isIFlagSet()).toBe(false);
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(2);
    });

    it("should not affect other flags", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x58], 0x1000, 0x1000); // CLI
      machine.cpu.p = FlagSetMask6510.N | FlagSetMask6510.Z | FlagSetMask6510.V | 
                     FlagSetMask6510.D | FlagSetMask6510.C | FlagSetMask6510.I |
                     FlagSetMask6510.UNUSED;
      
      machine.run();
      
      expect(machine.cpu.isIFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(true);
      expect(machine.cpu.isZFlagSet()).toBe(true);
      expect(machine.cpu.isVFlagSet()).toBe(true);
      expect(machine.cpu.isDFlagSet()).toBe(true);
      expect(machine.cpu.isCFlagSet()).toBe(true);
    });
  });

  describe("SEI - Set Interrupt Disable Flag (0x78)", () => {
    it("should set interrupt disable flag when clear", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x78], 0x1000, 0x1000); // SEI
      machine.cpu.p &= ~FlagSetMask6510.I; // Clear interrupt disable flag
      
      machine.run();
      
      expect(machine.cpu.isIFlagSet()).toBe(true);
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(2);
    });

    it("should leave interrupt disable flag set when already set", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x78], 0x1000, 0x1000); // SEI
      machine.cpu.p |= FlagSetMask6510.I; // Set interrupt disable flag
      
      machine.run();
      
      expect(machine.cpu.isIFlagSet()).toBe(true);
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(2);
    });

    it("should not affect other flags", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x78], 0x1000, 0x1000); // SEI
      machine.cpu.p = FlagSetMask6510.N | FlagSetMask6510.Z | FlagSetMask6510.V | 
                     FlagSetMask6510.D | FlagSetMask6510.C | FlagSetMask6510.UNUSED;
      
      machine.run();
      
      expect(machine.cpu.isIFlagSet()).toBe(true);
      expect(machine.cpu.isNFlagSet()).toBe(true);
      expect(machine.cpu.isZFlagSet()).toBe(true);
      expect(machine.cpu.isVFlagSet()).toBe(true);
      expect(machine.cpu.isDFlagSet()).toBe(true);
      expect(machine.cpu.isCFlagSet()).toBe(true);
    });
  });

  describe("CLV - Clear Overflow Flag (0xB8)", () => {
    it("should clear overflow flag when set", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xB8], 0x1000, 0x1000); // CLV
      machine.cpu.p |= FlagSetMask6510.V; // Set overflow flag
      
      machine.run();
      
      expect(machine.cpu.isVFlagSet()).toBe(false);
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(2);
    });

    it("should leave overflow flag clear when already clear", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xB8], 0x1000, 0x1000); // CLV
      machine.cpu.p &= ~FlagSetMask6510.V; // Clear overflow flag
      
      machine.run();
      
      expect(machine.cpu.isVFlagSet()).toBe(false);
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(2);
    });

    it("should not affect other flags", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xB8], 0x1000, 0x1000); // CLV
      machine.cpu.p = FlagSetMask6510.N | FlagSetMask6510.Z | FlagSetMask6510.V | 
                     FlagSetMask6510.D | FlagSetMask6510.I | FlagSetMask6510.C |
                     FlagSetMask6510.UNUSED;
      
      machine.run();
      
      expect(machine.cpu.isVFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(true);
      expect(machine.cpu.isZFlagSet()).toBe(true);
      expect(machine.cpu.isDFlagSet()).toBe(true);
      expect(machine.cpu.isIFlagSet()).toBe(true);
      expect(machine.cpu.isCFlagSet()).toBe(true);
    });
  });

  describe("CLD - Clear Decimal Mode Flag (0xD8)", () => {
    it("should clear decimal mode flag when set", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xD8], 0x1000, 0x1000); // CLD
      machine.cpu.p |= FlagSetMask6510.D; // Set decimal mode flag
      
      machine.run();
      
      expect(machine.cpu.isDFlagSet()).toBe(false);
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(2);
    });

    it("should leave decimal mode flag clear when already clear", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xD8], 0x1000, 0x1000); // CLD
      machine.cpu.p &= ~FlagSetMask6510.D; // Clear decimal mode flag
      
      machine.run();
      
      expect(machine.cpu.isDFlagSet()).toBe(false);
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(2);
    });

    it("should not affect other flags", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xD8], 0x1000, 0x1000); // CLD
      machine.cpu.p = FlagSetMask6510.N | FlagSetMask6510.Z | FlagSetMask6510.V | 
                     FlagSetMask6510.D | FlagSetMask6510.I | FlagSetMask6510.C |
                     FlagSetMask6510.UNUSED;
      
      machine.run();
      
      expect(machine.cpu.isDFlagSet()).toBe(false);
      expect(machine.cpu.isNFlagSet()).toBe(true);
      expect(machine.cpu.isZFlagSet()).toBe(true);
      expect(machine.cpu.isVFlagSet()).toBe(true);
      expect(machine.cpu.isIFlagSet()).toBe(true);
      expect(machine.cpu.isCFlagSet()).toBe(true);
    });
  });

  describe("SED - Set Decimal Mode Flag (0xF8)", () => {
    it("should set decimal mode flag when clear", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xF8], 0x1000, 0x1000); // SED
      machine.cpu.p &= ~FlagSetMask6510.D; // Clear decimal mode flag
      
      machine.run();
      
      expect(machine.cpu.isDFlagSet()).toBe(true);
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(2);
    });

    it("should leave decimal mode flag set when already set", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xF8], 0x1000, 0x1000); // SED
      machine.cpu.p |= FlagSetMask6510.D; // Set decimal mode flag
      
      machine.run();
      
      expect(machine.cpu.isDFlagSet()).toBe(true);
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.cpu.tacts).toBe(2);
    });

    it("should not affect other flags", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xF8], 0x1000, 0x1000); // SED
      machine.cpu.p = FlagSetMask6510.N | FlagSetMask6510.Z | FlagSetMask6510.V | 
                     FlagSetMask6510.I | FlagSetMask6510.C | FlagSetMask6510.UNUSED;
      
      machine.run();
      
      expect(machine.cpu.isDFlagSet()).toBe(true);
      expect(machine.cpu.isNFlagSet()).toBe(true);
      expect(machine.cpu.isZFlagSet()).toBe(true);
      expect(machine.cpu.isVFlagSet()).toBe(true);
      expect(machine.cpu.isIFlagSet()).toBe(true);
      expect(machine.cpu.isCFlagSet()).toBe(true);
    });
  });

  describe("Flag instruction combinations", () => {
    it("should work with multiple flag instructions in sequence", () => {
      const machine = new M6510VaTestMachine(RunMode.UntilEnd);
      machine.initCode([
        0x18, // CLC - Clear Carry
        0x58, // CLI - Clear Interrupt Disable
        0xB8, // CLV - Clear Overflow
        0xD8, // CLD - Clear Decimal Mode
        0x38, // SEC - Set Carry
        0x78, // SEI - Set Interrupt Disable
        0xF8  // SED - Set Decimal Mode
      ], 0x1000, 0x1000);
      
      // Set all flags initially
      machine.cpu.p = FlagSetMask6510.N | FlagSetMask6510.Z | FlagSetMask6510.V | 
                     FlagSetMask6510.D | FlagSetMask6510.I | FlagSetMask6510.C |
                     FlagSetMask6510.UNUSED;
      
      machine.run();
      
      // After all instructions, should have: N=1, Z=1, V=0, D=1, I=1, C=1
      expect(machine.cpu.isNFlagSet()).toBe(true);  // Unaffected
      expect(machine.cpu.isZFlagSet()).toBe(true);  // Unaffected
      expect(machine.cpu.isVFlagSet()).toBe(false); // Cleared by CLV
      expect(machine.cpu.isDFlagSet()).toBe(true);  // Cleared by CLD, then set by SED
      expect(machine.cpu.isIFlagSet()).toBe(true);  // Cleared by CLI, then set by SEI
      expect(machine.cpu.isCFlagSet()).toBe(true);  // Cleared by CLC, then set by SEC
      expect(machine.cpu.pc).toBe(0x1007);
      expect(machine.cpu.tacts).toBe(14); // 7 instructions × 2 cycles each
    });

    it("should preserve unused flag bit", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x18], 0x1000, 0x1000); // CLC
      machine.cpu.p = 0x00; // Clear all flags including unused bit
      
      machine.run();
      
      // Unused bit should still be set (bit 5 is always 1 in 6510)
      expect(machine.cpu.p & FlagSetMask6510.UNUSED).toBe(FlagSetMask6510.UNUSED);
    });
  });

  describe("Edge cases", () => {
    it("should handle flag instructions at memory boundaries", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x18], 0xFFFF, 0xFFFF); // CLC at last address
      machine.cpu.p |= FlagSetMask6510.C;
      
      machine.run();
      
      expect(machine.cpu.isCFlagSet()).toBe(false);
      expect(machine.cpu.pc).toBe(0x0000); // Wraps around
    });

    it("should verify all flag instruction opcodes", () => {
      // Test that all opcodes are correctly mapped
      const instructions = [
        { opcode: 0x18, name: "CLC", flagMask: FlagSetMask6510.C, shouldSet: false },
        { opcode: 0x38, name: "SEC", flagMask: FlagSetMask6510.C, shouldSet: true },
        { opcode: 0x58, name: "CLI", flagMask: FlagSetMask6510.I, shouldSet: false },
        { opcode: 0x78, name: "SEI", flagMask: FlagSetMask6510.I, shouldSet: true },
        { opcode: 0xB8, name: "CLV", flagMask: FlagSetMask6510.V, shouldSet: false },
        { opcode: 0xD8, name: "CLD", flagMask: FlagSetMask6510.D, shouldSet: false },
        { opcode: 0xF8, name: "SED", flagMask: FlagSetMask6510.D, shouldSet: true }
      ];

      instructions.forEach(instr => {
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([instr.opcode], 0x1000, 0x1000);
        
        if (instr.shouldSet) {
          machine.cpu.p &= ~instr.flagMask; // Clear the flag first
        } else {
          machine.cpu.p |= instr.flagMask; // Set the flag first
        }
        
        machine.run();
        
        const flagIsSet = (machine.cpu.p & instr.flagMask) !== 0;
        expect(flagIsSet).toBe(instr.shouldSet);
        expect(machine.cpu.tacts).toBe(2);
      });
    });
  });
});
