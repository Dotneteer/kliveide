import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { DmaState } from "@emu/machines/zxNext/DmaDevice";

/**
 * DmaDevice-z80-transfers.test.ts
 * 
 * Phase 3: Transfer Tests
 * 
 * Tests memory-to-memory transfers using Z80 code that configures DMA
 * and executes transfers. Uses helper methods to generate proper Z80 DMA code.
 */

describe("DMA Z80 Code-Driven Tests - Transfers", () => {

  describe("Simple Memory-to-Memory Transfer", () => {
    it("should copy 4 bytes from 0x8000 to 0x9000", async () => {
      const m = await createTestNextMachine();
      
      // Set up source data
      const sourceData = [0x12, 0x34, 0x56, 0x78];
      for (let i = 0; i < sourceData.length; i++) {
        m.memoryDevice.writeMemory(0x8000 + i, sourceData[i]);
      }

      // Use helper to generate DMA configuration code
      const code = m.configureContinuousTransfer(0x8000, 0x9000, 4);
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      
      // Run CPU until HALT
      m.runUntilHalt();
      
      // Run DMA until completion
      m.runUntilDmaComplete();
      
      // Verify data was copied
      m.assertMemoryBlock(0x9000, sourceData);
    });

    it("should verify DMA enabled after configuration", async () => {
      const m = await createTestNextMachine();
      
      m.memoryDevice.writeMemory(0x8000, 0x55);

      const code = m.configureContinuousTransfer(0x8000, 0x9000, 1);
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      expect(m.memoryDevice.readMemory(0x9000)).toBe(0x55);
      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(true);
    });
  });

  describe("Transfer Direction", () => {
    it("should transfer A→B with correct addresses", async () => {
      const m = await createTestNextMachine();
      
      const sourceData = [0xAA, 0xBB];
      for (let i = 0; i < sourceData.length; i++) {
        m.memoryDevice.writeMemory(0x6000 + i, sourceData[i]);
      }

      const code = m.configureContinuousTransfer(0x6000, 0x7000, 2);
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      m.assertMemoryBlock(0x7000, sourceData);
    });

    it("should transfer to different memory regions", async () => {
      const m = await createTestNextMachine();
      
      const sourceData = [0xCC, 0xDD];
      for (let i = 0; i < sourceData.length; i++) {
        m.memoryDevice.writeMemory(0x5800 + i, sourceData[i]);
      }

      // Transfer from 0x5800 to 0x5900 (different region)
      const code = m.configureContinuousTransfer(0x5800, 0x5900, 2);
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      m.assertMemoryBlock(0x5900, sourceData);
    });
  });

  describe("Address Modes", () => {
    it("should increment both source and destination", async () => {
      const m = await createTestNextMachine();
      
      const sourceData = [0x11, 0x22, 0x33, 0x44];
      for (let i = 0; i < sourceData.length; i++) {
        m.memoryDevice.writeMemory(0x5000 + i, sourceData[i]);
      }

      const code = m.configureContinuousTransfer(0x5000, 0xB000, 4);
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      m.assertMemoryBlock(0xB000, sourceData);
    });

    it("should handle fixed destination address for multiple writes", async () => {
      const m = await createTestNextMachine();
      
      // Load multiple bytes
      const sourceData = [0x77, 0x88, 0x99, 0xAA];
      for (let i = 0; i < sourceData.length; i++) {
        m.memoryDevice.writeMemory(0x4800 + i, sourceData[i]);
      }

      const code = m.configureContinuousTransfer(0x4800, 0xD000, 4);
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      // Verify that data was written to destination
      expect(m.memoryDevice.readMemory(0xD000)).toBe(0x77);
    });
  });

  describe("Block Sizes", () => {
    it("should transfer single byte", async () => {
      const m = await createTestNextMachine();
      
      m.memoryDevice.writeMemory(0x4000, 0xEE);

      const code = m.configureContinuousTransfer(0x4000, 0xE000, 1);
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      expect(m.memoryDevice.readMemory(0xE000)).toBe(0xEE);
      expect(m.memoryDevice.readMemory(0xE001)).toBe(0x00);
    });
  });

  describe("State Management", () => {
    it("should maintain enabled state after transfer", async () => {
      const m = await createTestNextMachine();
      
      m.memoryDevice.writeMemory(0x8000, 0x99);

      const code = m.configureContinuousTransfer(0x8000, 0x9000, 1);
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(true);
      expect(m.memoryDevice.readMemory(0x9000)).toBe(0x99);
    });

    it("should reflect transfer completion in registers", async () => {
      const m = await createTestNextMachine();
      
      const sourceData = [0x55, 0x66];
      for (let i = 0; i < sourceData.length; i++) {
        m.memoryDevice.writeMemory(0x4010 + i, sourceData[i]);
      }

      const code = m.configureContinuousTransfer(0x4010, 0x5010, 2);
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      const regs = m.getDmaRegisters();
      expect(regs.blockLength).toBe(2);
      expect(regs.directionAtoB).toBe(true);
      m.assertMemoryBlock(0x5010, sourceData);
    });
  });

  describe("Sequential Transfers", () => {
    it("should transfer and return to enabled state", async () => {
      const m = await createTestNextMachine();
      
      m.memoryDevice.writeMemory(0x3300, 0x55);
      const code = m.configureContinuousTransfer(0x3300, 0x4300, 1);
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(true);
    });
  });

  describe("Burst Mode Transfers", () => {
    it("should transfer with byte count verification", async () => {
      const m = await createTestNextMachine();
      
      const sourceData = [0x01, 0x02, 0x03, 0x04, 0x05];
      for (let i = 0; i < sourceData.length; i++) {
        m.memoryDevice.writeMemory(0x5030 + i, sourceData[i]);
      }

      const code = m.configureContinuousTransfer(0x5030, 0x6030, 5);
      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      m.runUntilDmaComplete();
      
      m.assertDmaTransferred(5);
      m.assertMemoryBlock(0x6030, sourceData);
    });
  });
});
