import { describe, it, expect } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";
import { FlagSetMask6510 } from "../../src/emu/abstractions/FlagSetMask6510";

describe("M6510 - Branch Instructions", () => {
  describe("BPL - Branch on Plus (N flag clear)", () => {
    it("should branch when N flag is clear", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x10, 0x03], 0x1000, 0x1000); // BPL +3
      machine.cpu.p &= ~FlagSetMask6510.N; // Clear N flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1005); // 0x1002 + 3
      expect(machine.checkedTacts).toBe(3); // 2 base + 1 branch taken
    });

    it("should not branch when N flag is set", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x10, 0x03], 0x1000, 0x1000); // BPL +3
      machine.cpu.p |= FlagSetMask6510.N; // Set N flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1002); // No branch, just next instruction
      expect(machine.checkedTacts).toBe(2); // 2 base cycles only
    });
  });

  describe("BMI - Branch on Minus (N flag set)", () => {
    it("should branch when N flag is set", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x30, 0x03], 0x1000, 0x1000); // BMI +3
      machine.cpu.p |= FlagSetMask6510.N; // Set N flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1005); // 0x1002 + 3
      expect(machine.checkedTacts).toBe(3); // 2 base + 1 branch taken
    });

    it("should not branch when N flag is clear", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x30, 0x03], 0x1000, 0x1000); // BMI +3
      machine.cpu.p &= ~FlagSetMask6510.N; // Clear N flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1002); // 0x1002, no branch
      expect(machine.checkedTacts).toBe(2); // 2 base cycles only
    });
  });

  describe("BVC - Branch on Overflow Clear (V flag clear)", () => {
    it("should branch when V flag is clear", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x50, 0x03], 0x1000, 0x1000); // BVC +3
      machine.cpu.p &= ~FlagSetMask6510.V; // Clear V flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1005); // 0x1002 + 3
      expect(machine.checkedTacts).toBe(3); // 2 base + 1 branch taken
    });

    it("should not branch when V flag is set", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x50, 0x03], 0x1000, 0x1000); // BVC +3
      machine.cpu.p |= FlagSetMask6510.V; // Set V flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1002); // 0x1002, no branch
      expect(machine.checkedTacts).toBe(2); // 2 base cycles only
    });
  });

  describe("BVS - Branch on Overflow Set (V flag set)", () => {
    it("should branch when V flag is set", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x70, 0x03], 0x1000, 0x1000); // BVS +3
      machine.cpu.p |= FlagSetMask6510.V; // Set V flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1005); // 0x1002 + 3
      expect(machine.checkedTacts).toBe(3); // 2 base + 1 branch taken
    });

    it("should not branch when V flag is clear", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x70, 0x03], 0x1000, 0x1000); // BVS +3
      machine.cpu.p &= ~FlagSetMask6510.V; // Clear V flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1002); // 0x1002, no branch
      expect(machine.checkedTacts).toBe(2); // 2 base cycles only
    });
  });

  describe("BCC - Branch on Carry Clear (C flag clear)", () => {
    it("should branch when C flag is clear", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x90, 0x03], 0x1000, 0x1000); // BCC +3
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear C flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1005); // 0x1002 + 3
      expect(machine.checkedTacts).toBe(3); // 2 base + 1 branch taken
    });

    it("should not branch when C flag is set", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x90, 0x03], 0x1000, 0x1000); // BCC +3
      machine.cpu.p |= FlagSetMask6510.C; // Set C flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1002); // 0x1002, no branch
      expect(machine.checkedTacts).toBe(2); // 2 base cycles only
    });
  });

  describe("BCS - Branch on Carry Set (C flag set)", () => {
    it("should branch when C flag is set", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xB0, 0x03], 0x1000, 0x1000); // BCS +3
      machine.cpu.p |= FlagSetMask6510.C; // Set C flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1005); // 0x1002 + 3
      expect(machine.checkedTacts).toBe(3); // 2 base + 1 branch taken
    });

    it("should not branch when C flag is clear", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xB0, 0x03], 0x1000, 0x1000); // BCS +3
      machine.cpu.p &= ~FlagSetMask6510.C; // Clear C flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1002); // 0x1002, no branch
      expect(machine.checkedTacts).toBe(2); // 2 base cycles only
    });
  });

  describe("BNE - Branch on Not Equal (Z flag clear)", () => {
    it("should branch when Z flag is clear", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xD0, 0x03], 0x1000, 0x1000); // BNE +3
      machine.cpu.p &= ~FlagSetMask6510.Z; // Clear Z flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1005); // 0x1002 + 3
      expect(machine.checkedTacts).toBe(3); // 2 base + 1 branch taken
    });

    it("should not branch when Z flag is set", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xD0, 0x03], 0x1000, 0x1000); // BNE +3
      machine.cpu.p |= FlagSetMask6510.Z; // Set Z flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1002); // 0x1002, no branch
      expect(machine.checkedTacts).toBe(2); // 2 base cycles only
    });
  });

  describe("BEQ - Branch on Equal (Z flag set)", () => {
    it("should branch when Z flag is set", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xF0, 0x03], 0x1000, 0x1000); // BEQ +3
      machine.cpu.p |= FlagSetMask6510.Z; // Set Z flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1005); // 0x1002 + 3
      expect(machine.checkedTacts).toBe(3); // 2 base + 1 branch taken
    });

    it("should not branch when Z flag is clear", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xF0, 0x03], 0x1000, 0x1000); // BEQ +3
      machine.cpu.p &= ~FlagSetMask6510.Z; // Clear Z flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1002); // 0x1002, no branch
      expect(machine.checkedTacts).toBe(2); // 2 base cycles only
    });
  });

  describe("Branch offset calculations", () => {
    it("should handle backward branch", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x10, 0xFC], 0x1004, 0x1004); // BPL -4 (back to 0x1002)
      machine.cpu.p &= ~FlagSetMask6510.N; // Clear N flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1002); // 0x1006 - 4
      expect(machine.checkedTacts).toBe(3); // 2 base + 1 branch taken
    });

    it("should handle maximum forward branch (+127)", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x10, 0x7F], 0x1000, 0x1000); // BPL +127
      machine.cpu.p &= ~FlagSetMask6510.N; // Clear N flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1081); // 0x1002 + 127
      expect(machine.checkedTacts).toBe(3); // 2 base + 1 branch taken
    });

    it("should handle maximum backward branch (-128)", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x10, 0x80], 0x1080, 0x1080); // BPL -128
      machine.cpu.p &= ~FlagSetMask6510.N; // Clear N flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1002); // 0x1082 - 128
      expect(machine.checkedTacts).toBe(3); // 2 base + 1 branch taken
    });
  });

  describe("Page boundary crossing scenarios", () => {
    it("should detect page crossing on forward branch", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x10, 0x7F], 0x1082, 0x1082); // BPL +127 from near page end
      machine.cpu.p &= ~FlagSetMask6510.N; // Clear N flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1103); // Should cross to next page
      expect(machine.checkedTacts).toBe(4); // 2 base + 1 branch + 1 page crossing
    });

    it("should detect page crossing on backward branch", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x10, 0xFD], 0x10FF, 0x10FF); // BPL -3, positioned to cross page backward
      machine.cpu.p &= ~FlagSetMask6510.N; // Clear N flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x10FE); // Crossed page boundary backward  
      expect(machine.checkedTacts).toBe(4); // 2 base + 1 branch + 1 page crossing
    });
  });

  describe("Combined flag scenarios", () => {
    it("should work correctly with multiple flags set", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xF0, 0x03], 0x1000, 0x1000); // BEQ +3
      machine.cpu.p |= FlagSetMask6510.Z | FlagSetMask6510.C | FlagSetMask6510.N; // Set multiple flags
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1005); // Should branch because Z is set
      expect(machine.checkedTacts).toBe(3); // 2 base + 1 branch taken
    });

    it("should handle complex branching scenario", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x30, 0x02], 0x1000, 0x1000); // BMI +2
      machine.cpu.p |= FlagSetMask6510.N; // Set N flag for BMI
      
      machine.run(); // First instruction
      
      expect(machine.cpu.pc).toBe(0x1004); // Branched to 0x1002 + 2
      expect(machine.checkedTacts).toBe(3); // 2 base + 1 branch taken
      
      // Now position at destination and add more code
      machine.initCode([0xD0, 0x04], 0x1004, 0x1004); // BNE +4 at destination
      machine.cpu.p &= ~FlagSetMask6510.Z; // Clear Z flag for BNE
      machine.cpu.tacts = 0; // Reset tacts
      
      machine.run(); // Second instruction
      
      expect(machine.cpu.pc).toBe(0x100A); // Branched to 0x1006 + 4
      expect(machine.checkedTacts).toBe(3); // 2 base + 1 branch taken
    });
  });
});
