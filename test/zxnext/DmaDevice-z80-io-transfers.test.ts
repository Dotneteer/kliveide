import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { DmaState } from "@emu/machines/zxNext/DmaDevice";

/**
 * DmaDevice-z80-io-transfers.test.ts
 * 
 * Phase 4: I/O Transfer Tests
 * 
 * Tests I/O port transfers using Z80 code that configures DMA
 * to transfer data between memory and I/O ports.
 */

describe("DMA Z80 Code-Driven Tests - I/O Transfers", () => {

  describe("Memory-to-I/O Transfers", () => {
    it("should transfer data from memory to I/O port", async () => {
      const m = await createTestNextMachine();
      
      // Set up source data in memory
      const sourceData = [0x11, 0x22, 0x33, 0x44];
      for (let i = 0; i < sourceData.length; i++) {
        m.memoryDevice.writeMemory(0x8000 + i, sourceData[i]);
      }

      // Configure DMA: memory (A) → I/O port (B)
      // WR0: Port A address (memory source)
      // WR1: Port A = Memory, Increment
      // WR2: Port B = I/O, Fixed (I/O port doesn't increment)
      // WR4: Port B = I/O port number, Continuous mode
      
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH (DMA port)
        
        // WR0: Port A start address and block length
        0x3E, 0x79,          // LD A, 79H (WR0 base)
        0xED, 0x79,          // OUT (C), A
        0x3E, 0x00, 0xED, 0x79,  // Port A low
        0x3E, 0x80, 0xED, 0x79,  // Port A high (0x8000)
        0x3E, 0x04, 0xED, 0x79,  // Block length low (4)
        0x3E, 0x00, 0xED, 0x79,  // Block length high
        
        // WR1: Port A = Memory, Increment
        0x3E, 0x14, 0xED, 0x79,
        
        // WR2: Port B = I/O, Fixed (D3=1 for I/O, D5-D4=10 for FIXED)
        0x3E, 0x28, 0xED, 0x79,  // D3=1 (I/O), D5-D4=10 (fixed)
        
        // WR4: Port B = I/O port 0x00, Continuous mode
        0x3E, 0xBD, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,  // Port B low
        0x3E, 0x00, 0xED, 0x79,  // Port B high (I/O port 0)
        
        // WR6: LOAD & ENABLE
        0x3E, 0xCF, 0xED, 0x79,
        0x3E, 0x87, 0xED, 0x79,
        
        0x76  // HALT
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      // Verify bytes were transferred (captured via I/O access logging)
      m.assertDmaTransferred(4);
      const regs = m.getDmaRegisters();
      expect(regs.blockLength).toBe(4);
    });

    it("should transfer data to specific I/O port", async () => {
      const m = await createTestNextMachine();
      
      const sourceData = [0x55, 0x66];
      for (let i = 0; i < sourceData.length; i++) {
        m.memoryDevice.writeMemory(0x7000 + i, sourceData[i]);
      }

      const code = [
        0x01, 0x6B, 0x00,
        0x3E, 0x79, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0x70, 0xED, 0x79,
        0x3E, 0x02, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0x14, 0xED, 0x79,
        0x3E, 0x28, 0xED, 0x79,
        0x3E, 0xBD, 0xED, 0x79,
        0x3E, 0x50, 0xED, 0x79,  // Port B = 0x50
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0xCF, 0xED, 0x79,
        0x3E, 0x87, 0xED, 0x79,
        0x76
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      m.assertDmaTransferred(2);
    });
  });

  describe("I/O-to-Memory Transfers", () => {
    it("should transfer data from I/O port to memory", async () => {
      const m = await createTestNextMachine();
      
      // Set up I/O port data by pre-loading memory that will be read via I/O
      // (simulating I/O device returning data)
      for (let i = 0; i < 4; i++) {
        m.memoryDevice.writeMemory(0xA000 + i, 0xAA + i);
      }

      // Configure DMA: I/O port (A) → Memory (B)
      // WR0: Port A = I/O port, Block length
      // WR1: Port A = I/O, Fixed
      // WR2: Port B = Memory, Increment
      // WR4: Port B address (memory destination)
      
      const code = [
        0x01, 0x6B, 0x00,    // LD BC, 006BH
        
        // WR0: Port A = I/O port, Block length
        0x3E, 0x79, 0xED, 0x79,  // WR0 base
        0x3E, 0x20, 0xED, 0x79,  // Port A low (I/O port 0x20)
        0x3E, 0x00, 0xED, 0x79,  // Port A high
        0x3E, 0x04, 0xED, 0x79,  // Block length (4)
        0x3E, 0x00, 0xED, 0x79,  // Length high
        
        // WR1: Port A = I/O, Fixed (D3=1 for I/O)
        0x3E, 0x28, 0xED, 0x79,
        
        // WR2: Port B = Memory, Increment (D3=0 for memory)
        0x3E, 0x14, 0xED, 0x79,
        
        // WR4: Port B = Memory address, Continuous mode
        0x3E, 0xBD, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,  // Destination low
        0x3E, 0xB0, 0xED, 0x79,  // Destination high (0xB000)
        
        // WR6: LOAD & ENABLE
        0x3E, 0xCF, 0xED, 0x79,
        0x3E, 0x87, 0xED, 0x79,
        
        0x76
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      m.assertDmaTransferred(4);
      const regs = m.getDmaRegisters();
      expect(regs.blockLength).toBe(4);
    });

    it("should handle I/O reads to different memory addresses", async () => {
      const m = await createTestNextMachine();
      
      // Pre-load I/O source data
      for (let i = 0; i < 2; i++) {
        m.memoryDevice.writeMemory(0xA000 + i, 0x77 + i);
      }

      const code = [
        0x01, 0x6B, 0x00,
        0x3E, 0x79, 0xED, 0x79,
        0x3E, 0x30, 0xED, 0x79,  // Port A = 0x30 (different I/O port)
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0x02, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0x28, 0xED, 0x79,
        0x3E, 0x14, 0xED, 0x79,
        0x3E, 0xBD, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,  // Destination low
        0x3E, 0xC0, 0xED, 0x79,  // Destination high (0xC000)
        0x3E, 0xCF, 0xED, 0x79,
        0x3E, 0x87, 0xED, 0x79,
        0x76
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      m.assertDmaTransferred(2);
    });
  });

  describe("I/O Port Configuration", () => {
    it("should correctly configure memory source with I/O destination", async () => {
      const m = await createTestNextMachine();
      
      const sourceData = [0x12, 0x34, 0x56, 0x78];
      for (let i = 0; i < sourceData.length; i++) {
        m.memoryDevice.writeMemory(0x6000 + i, sourceData[i]);
      }

      // Memory → I/O transfer
      const code = m.configureContinuousTransfer(0x6000, 0x00, 4);
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      const regs = m.getDmaRegisters();
      expect(regs.directionAtoB).toBe(true);
      m.assertDmaTransferred(4);
    });

    it("should preserve DMA state during I/O transfers", async () => {
      const m = await createTestNextMachine();
      
      for (let i = 0; i < 3; i++) {
        m.memoryDevice.writeMemory(0x5000 + i, 0x99);
      }

      const code = [
        0x01, 0x6B, 0x00,
        0x3E, 0x79, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0x50, 0xED, 0x79,
        0x3E, 0x03, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0x14, 0xED, 0x79,
        0x3E, 0x28, 0xED, 0x79,
        0x3E, 0xBD, 0xED, 0x79,
        0x3E, 0x40, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0xCF, 0xED, 0x79,
        0x3E, 0x87, 0xED, 0x79,
        0x76
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(true);
      expect(regs.blockLength).toBe(3);
    });
  });

  describe("I/O Transfer Completion", () => {
    it("should return to IDLE after I/O memory transfer", async () => {
      const m = await createTestNextMachine();
      
      const sourceData = [0x10, 0x20];
      for (let i = 0; i < sourceData.length; i++) {
        m.memoryDevice.writeMemory(0x7100 + i, sourceData[i]);
      }

      const code = [
        0x01, 0x6B, 0x00,
        0x3E, 0x79, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0x71, 0xED, 0x79,
        0x3E, 0x02, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0x14, 0xED, 0x79,
        0x3E, 0x28, 0xED, 0x79,
        0x3E, 0xBD, 0xED, 0x79,
        0x3E, 0x60, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0xCF, 0xED, 0x79,
        0x3E, 0x87, 0xED, 0x79,
        0x76
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      const state = m.getDmaState();
      expect(state).toBe(DmaState.IDLE);
      m.assertDmaTransferred(2);
    });

    it("should verify byte counter increments during I/O transfer", async () => {
      const m = await createTestNextMachine();
      
      for (let i = 0; i < 5; i++) {
        m.memoryDevice.writeMemory(0x4100 + i, 0x01 << i);
      }

      const code = [
        0x01, 0x6B, 0x00,
        0x3E, 0x79, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0x41, 0xED, 0x79,
        0x3E, 0x05, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0x14, 0xED, 0x79,
        0x3E, 0x28, 0xED, 0x79,
        0x3E, 0xBD, 0xED, 0x79,
        0x3E, 0x70, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0xCF, 0xED, 0x79,
        0x3E, 0x87, 0xED, 0x79,
        0x76
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      m.assertDmaTransferred(5);
    });
  });

  describe("I/O Port Range Tests", () => {
    it("should handle low I/O port addresses", async () => {
      const m = await createTestNextMachine();
      
      const sourceData = [0xAA, 0xBB];
      for (let i = 0; i < sourceData.length; i++) {
        m.memoryDevice.writeMemory(0x5200 + i, sourceData[i]);
      }

      // Transfer to I/O port 0x00 (low port)
      const code = [
        0x01, 0x6B, 0x00,
        0x3E, 0x79, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0x52, 0xED, 0x79,
        0x3E, 0x02, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0x14, 0xED, 0x79,
        0x3E, 0x28, 0xED, 0x79,
        0x3E, 0xBD, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,  // Port 0
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0xCF, 0xED, 0x79,
        0x3E, 0x87, 0xED, 0x79,
        0x76
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      m.assertDmaTransferred(2);
    });

    it("should handle high I/O port addresses", async () => {
      const m = await createTestNextMachine();
      
      const sourceData = [0x11, 0x22, 0x33];
      for (let i = 0; i < sourceData.length; i++) {
        m.memoryDevice.writeMemory(0x5300 + i, sourceData[i]);
      }

      // Transfer to I/O port 0xFF (high port)
      const code = [
        0x01, 0x6B, 0x00,
        0x3E, 0x79, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0x53, 0xED, 0x79,
        0x3E, 0x03, 0xED, 0x79,
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0x14, 0xED, 0x79,
        0x3E, 0x28, 0xED, 0x79,
        0x3E, 0xBD, 0xED, 0x79,
        0x3E, 0xFF, 0xED, 0x79,  // Port 0xFF
        0x3E, 0x00, 0xED, 0x79,
        0x3E, 0xCF, 0xED, 0x79,
        0x3E, 0x87, 0xED, 0x79,
        0x76
      ];
      
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      m.assertDmaTransferred(3);
    });
  });
});
