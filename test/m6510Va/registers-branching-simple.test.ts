import { describe, it, expect } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";
import { FlagSetMask6510 } from "../../src/emu/abstractions/FlagSetMask6510";

describe("M6510 - Branch Instructions - Simple Tests", () => {
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
      
      expect(machine.cpu.pc).toBe(0x1002); // No branch
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
      
      expect(machine.cpu.pc).toBe(0x1002); // No branch
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
  });

  describe("Backward branches", () => {
    it("should handle backward branch", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x10, 0xFC], 0x1004, 0x1004); // BPL -4 (jump back to 0x1002)
      machine.cpu.p &= ~FlagSetMask6510.N; // Clear N flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x1002); // 0x1006 - 4
      expect(machine.checkedTacts).toBe(3); // 2 base + 1 branch taken
    });
  });

  describe("Page boundary crossing", () => {
    it("should add extra cycle for page boundary crossing", () => {
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      // Position branch at 0x10FF so PC after offset read will be 0x1101
      // Then with offset +2, target will be 0x1103 (same page)
      // But with offset -3, target will be 0x10FE (different page)
      machine.initCode([0x10, 0xFD], 0x10FF, 0x10FF); // BPL -3
      machine.cpu.p &= ~FlagSetMask6510.N; // Clear N flag
      
      machine.run();
      
      expect(machine.cpu.pc).toBe(0x10FE); // Should cross to previous page  
      expect(machine.checkedTacts).toBe(4); // 2 base + 1 branch + 1 page crossing
    });
  });
});
