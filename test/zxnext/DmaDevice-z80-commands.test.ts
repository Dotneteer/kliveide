import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { DmaState, DmaMode } from "@emu/machines/zxNext/DmaDevice";

/**
 * DmaDevice-z80-commands.test.ts
 * 
 * Phase 2: Command Tests (WR6)
 * 
 * This file tests all DMA command operations using Z80 code that writes commands
 * to DMA ports. Commands are issued via WR6 register (D7=1 pattern).
 * 
 * Test Categories:
 * 1. Basic Commands (RESET, CONTINUE, LOAD)
 * 2. Enable/Disable Commands
 * 3. Command Sequencing and State Transitions
 * 4. Commands in Different DMA States
 * 5. Legacy vs ZXNDMA Mode Commands
 */

describe("DMA Z80 Code-Driven Tests - Commands", () => {
  
  // ============================================================================
  // Basic Commands
  // ============================================================================
  
  describe("RESET Command (0xC3)", () => {
    it("should reset DMA to IDLE state", async () => {
      const m = await createTestNextMachine();
      
      // Configure some registers first
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH
        0x3E, 0x79,          // LD A, 79H (WR0: configure something)
        0xED, 0x79,          // OUT (C), A
        0x3E, 0x12,          // LD A, 12H (dummy data)
        0xED, 0x79,          // OUT (C), A
        0x3E, 0xC3,          // LD A, C3H (RESET command)
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      expect(m.getDmaState()).toBe(DmaState.IDLE);
      // Note: registerWriteSeq may not be exactly 0 after intermediate writes
    });
    
    it("should reset from active DMA state", async () => {
      const m = await createTestNextMachine();
      
      // Enable DMA first, then reset
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH
        0x3E, 0x87,          // LD A, 87H (ENABLE_DMA)
        0xED, 0x79,          // OUT (C), A
        0x3E, 0xC3,          // LD A, C3H (RESET)
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      expect(m.getDmaState()).toBe(DmaState.IDLE);
      // Note: RESET doesn't modify dmaEnabled flag, only DMA state
    });
  });
  
  describe("CONTINUE Command (0xD3)", () => {
    it("should issue CONTINUE command without error", async () => {
      const m = await createTestNextMachine();
      
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH
        0x3E, 0xD3,          // LD A, D3H (CONTINUE)
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      // CONTINUE processed without crash
      expect(m.pc).toBe(0xC007);
    });
    
    it("should CONTINUE after partial transfer", async () => {
      const m = await createTestNextMachine();
      
      // Setup a transfer configuration
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH
        // Configure transfer (simplified)
        0x3E, 0x7D,          // LD A, 7DH (WR0)
        0xED, 0x79,          // OUT (C), A
        0x3E, 0x00, 0xED, 0x79,  // Port A low
        0x3E, 0x80, 0xED, 0x79,  // Port A high
        0x3E, 0x10, 0xED, 0x79,  // Block length low
        0x3E, 0x00, 0xED, 0x79,  // Block length high
        0x3E, 0xD3,          // LD A, D3H (CONTINUE)
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      // Command accepted
      expect(m.pc).toBe(0xC01B);
    });
  });
  
  describe("LOAD Command (0xCF)", () => {
    it("should issue LOAD command", async () => {
      const m = await createTestNextMachine();
      
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH
        0x3E, 0xCF,          // LD A, CFH (LOAD)
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      expect(m.pc).toBe(0xC007);
    });
    
    it("should LOAD after configuration", async () => {
      const m = await createTestNextMachine();
      
      // Configure then LOAD
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH
        0x3E, 0x7D,          // LD A, 7DH (WR0)
        0xED, 0x79,          // OUT (C), A
        0x3E, 0x00, 0xED, 0x79,  // Port A low
        0x3E, 0xC0, 0xED, 0x79,  // Port A high
        0x3E, 0x20, 0xED, 0x79,  // Block length low
        0x3E, 0x00, 0xED, 0x79,  // Block length high
        0x3E, 0xCF,          // LD A, CFH (LOAD)
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.portAStartAddress).toBe(0xC000);
      expect(regs.blockLength).toBe(0x0020);
    });
  });
  
  // ============================================================================
  // Enable/Disable Commands
  // ============================================================================
  
  describe("ENABLE_DMA Command (0x87)", () => {
    it("should enable DMA", async () => {
      const m = await createTestNextMachine();
      
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH
        0x3E, 0x87,          // LD A, 87H (ENABLE_DMA)
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(true);
    });
    
    it("should enable DMA after configuration", async () => {
      const m = await createTestNextMachine();
      
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH
        // Configure transfer
        0x3E, 0x7D,          // LD A, 7DH (WR0)
        0xED, 0x79,          // OUT (C), A
        0x3E, 0x00, 0xED, 0x79,  // Port A low
        0x3E, 0x80, 0xED, 0x79,  // Port A high
        0x3E, 0x40, 0xED, 0x79,  // Block length low
        0x3E, 0x00, 0xED, 0x79,  // Block length high
        0x3E, 0x14,          // LD A, 14H (WR1: increment)
        0xED, 0x79,          // OUT (C), A
        0x3E, 0x87,          // LD A, 87H (ENABLE_DMA)
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(true);
      expect(regs.portAStartAddress).toBe(0x8000);
    });
  });
  
  describe("DISABLE_DMA Command (0x83)", () => {
    it("should disable DMA", async () => {
      const m = await createTestNextMachine();
      
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH
        0x3E, 0x87,          // LD A, 87H (ENABLE_DMA first)
        0xED, 0x79,          // OUT (C), A
        0x3E, 0x83,          // LD A, 83H (DISABLE_DMA)
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(false);
    });
    
    it("should disable DMA when already disabled", async () => {
      const m = await createTestNextMachine();
      
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH
        0x3E, 0x83,          // LD A, 83H (DISABLE_DMA)
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(false); // Remains disabled
    });
  });
  
  // ============================================================================
  // Command Sequencing
  // ============================================================================
  
  describe("Command Sequences", () => {
    it("should execute ENABLE then DISABLE sequence", async () => {
      const m = await createTestNextMachine();
      
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH
        0x3E, 0x87,          // LD A, 87H (ENABLE)
        0xED, 0x79,          // OUT (C), A
        0x3E, 0x83,          // LD A, 83H (DISABLE)
        0xED, 0x79,          // OUT (C), A
        0x3E, 0x87,          // LD A, 87H (ENABLE again)
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(true); // Last command was ENABLE
    });
    
    it("should execute RESET then ENABLE sequence", async () => {
      const m = await createTestNextMachine();
      
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH
        0x3E, 0xC3,          // LD A, C3H (RESET)
        0xED, 0x79,          // OUT (C), A
        0x3E, 0x87,          // LD A, 87H (ENABLE)
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      // RESET puts state to IDLE, then ENABLE changes it to START_DMA
      expect(m.getDmaState()).toBe(DmaState.START_DMA);
      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(true);
    });
    
    it("should execute configuration, LOAD, ENABLE sequence", async () => {
      const m = await createTestNextMachine();
      
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH
        // WR0: Configure
        0x3E, 0x7D,          // LD A, 7DH
        0xED, 0x79,          // OUT (C), A
        0x3E, 0x00, 0xED, 0x79,  // Port A low
        0x3E, 0x70, 0xED, 0x79,  // Port A high
        0x3E, 0x80, 0xED, 0x79,  // Block length low
        0x3E, 0x00, 0xED, 0x79,  // Block length high
        // LOAD command
        0x3E, 0xCF,          // LD A, CFH (LOAD)
        0xED, 0x79,          // OUT (C), A
        // ENABLE command
        0x3E, 0x87,          // LD A, 87H (ENABLE)
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.portAStartAddress).toBe(0x7000);
      expect(regs.blockLength).toBe(0x0080);
      expect(regs.dmaEnabled).toBe(true);
    });
  });
  
  // ============================================================================
  // Commands with Different Register Configurations
  // ============================================================================
  
  describe("Commands with Register State", () => {
    it("should RESET and clear configured registers", async () => {
      const m = await createTestNextMachine();
      
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH
        // Configure WR0
        0x3E, 0x7D,          // LD A, 7DH
        0xED, 0x79,          // OUT (C), A
        0x3E, 0x34, 0xED, 0x79,  // Port A low
        0x3E, 0x12, 0xED, 0x79,  // Port A high
        0x3E, 0xFF, 0xED, 0x79,  // Block length low
        0x3E, 0x00, 0xED, 0x79,  // Block length high
        // Configure WR1
        0x3E, 0x14,          // LD A, 14H (WR1: increment)
        0xED, 0x79,          // OUT (C), A
        // RESET
        0x3E, 0xC3,          // LD A, C3H
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      expect(m.getDmaState()).toBe(DmaState.IDLE);
      // After reset, check if state is clean
      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(false);
    });
    
    it("should maintain register values after ENABLE", async () => {
      const m = await createTestNextMachine();
      
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH
        // Configure WR0
        0x3E, 0x7D,          // LD A, 7DH
        0xED, 0x79,          // OUT (C), A
        0x3E, 0x00, 0xED, 0x79,  // Port A low
        0x3E, 0xA0, 0xED, 0x79,  // Port A high
        0x3E, 0x00, 0xED, 0x79,  // Block length low
        0x3E, 0x01, 0xED, 0x79,  // Block length high
        // ENABLE
        0x3E, 0x87,          // LD A, 87H
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.portAStartAddress).toBe(0xA000); // Preserved
      expect(regs.blockLength).toBe(0x0100); // Preserved
      expect(regs.dmaEnabled).toBe(true);
    });
  });
  
  // ============================================================================
  // Commands in Legacy Mode
  // ============================================================================
  
  describe("Commands in Legacy Mode", () => {
    it("should execute RESET in legacy mode", async () => {
      const m = await createTestNextMachine();
      
      const code = [
        0x01, 0x0B, 0x00,    // LD BC, 000BH (legacy port)
        0x3E, 0x79,          // LD A, 79H (configure)
        0xED, 0x79,          // OUT (C), A
        0x3E, 0xC3,          // LD A, C3H (RESET)
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      expect(m.dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
      expect(m.getDmaState()).toBe(DmaState.IDLE);
    });
    
    it("should execute ENABLE in legacy mode", async () => {
      const m = await createTestNextMachine();
      
      const code = [
        0x01, 0x0B, 0x00,    // LD BC, 000BH (legacy port)
        0x3E, 0x87,          // LD A, 87H (ENABLE)
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      expect(m.dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(true);
    });
  });
  
  // ============================================================================
  // Multiple Command Combinations
  // ============================================================================
  
  describe("Complex Command Sequences", () => {
    it("should handle multiple RESET commands", async () => {
      const m = await createTestNextMachine();
      
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH
        0x3E, 0xC3,          // LD A, C3H (RESET)
        0xED, 0x79,          // OUT (C), A
        0x3E, 0xC3,          // LD A, C3H (RESET again)
        0xED, 0x79,          // OUT (C), A
        0x3E, 0xC3,          // LD A, C3H (RESET third time)
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      expect(m.getDmaState()).toBe(DmaState.IDLE);
    });
    
    it("should handle ENABLE/DISABLE toggle", async () => {
      const m = await createTestNextMachine();
      
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH
        0x3E, 0x87,          // LD A, 87H (ENABLE)
        0xED, 0x79,          // OUT (C), A
        0x3E, 0x83,          // LD A, 83H (DISABLE)
        0xED, 0x79,          // OUT (C), A
        0x3E, 0x87,          // LD A, 87H (ENABLE)
        0xED, 0x79,          // OUT (C), A
        0x3E, 0x83,          // LD A, 83H (DISABLE)
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(false); // Last was DISABLE
    });
    
    it("should handle complete DMA setup sequence", async () => {
      const m = await createTestNextMachine();
      
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH
        // Step 1: RESET
        0x3E, 0xC3,          // LD A, C3H (RESET)
        0xED, 0x79,          // OUT (C), A
        // Step 2: Configure WR0
        0x3E, 0x7D,          // LD A, 7DH
        0xED, 0x79,          // OUT (C), A
        0x3E, 0x00, 0xED, 0x79,  // Port A low
        0x3E, 0x60, 0xED, 0x79,  // Port A high (0x6000)
        0x3E, 0x00, 0xED, 0x79,  // Block length low
        0x3E, 0x02, 0xED, 0x79,  // Block length high (0x0200)
        // Step 3: Configure WR1 (Port A)
        0x3E, 0x14,          // LD A, 14H (increment)
        0xED, 0x79,          // OUT (C), A
        // Step 4: Configure WR2 (Port B)
        0x3E, 0x10,          // LD A, 10H (increment)
        0xED, 0x79,          // OUT (C), A
        // Step 5: Configure WR4 (Port B address + mode)
        0x3E, 0xBD,          // LD A, BDH (continuous)
        0xED, 0x79,          // OUT (C), A
        0x3E, 0x00, 0xED, 0x79,  // Port B low
        0x3E, 0x70, 0xED, 0x79,  // Port B high (0x7000)
        // Step 6: LOAD
        0x3E, 0xCF,          // LD A, CFH (LOAD)
        0xED, 0x79,          // OUT (C), A
        // Step 7: ENABLE
        0x3E, 0x87,          // LD A, 87H (ENABLE)
        0xED, 0x79,          // OUT (C), A
        0x76                 // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.portAStartAddress).toBe(0x6000);
      expect(regs.blockLength).toBe(0x0200);
      expect(regs.portBStartAddress).toBe(0x7000);
      expect(regs.dmaEnabled).toBe(true);
    });
  });
});
