import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { DmaState } from "@emu/machines/zxNext/DmaDevice";

describe("DMA Z80 Code-Driven Tests - Proof of Concept", () => {
  it("should transfer 4 bytes from 0x8000 to 0x9000 in continuous mode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    
    // Set up source data at 0x8000
    const sourceData = [0x11, 0x22, 0x33, 0x44];
    for (let i = 0; i < sourceData.length; i++) {
      m.memoryDevice.writeMemory(0x8000 + i, sourceData[i]);
    }
    
    // Clear destination area
    for (let i = 0; i < 4; i++) {
      m.memoryDevice.writeMemory(0x9000 + i, 0x00);
    }
    
    // Use the helper method to generate DMA configuration code
    const dmaCode = m.configureContinuousTransfer(0x8000, 0x9000, 4);
    
    m.initCode(dmaCode, 0xC000);
    
    // --- Act
    // Run CPU until HALT
    m.pc = 0xC000;
    m.runUntilHalt();
    
    // Run DMA until completion (with automatic bus control)
    m.runUntilDmaComplete();
    
    // --- Assert
    // Check destination memory contains source data
    m.assertMemoryBlock(0x9000, sourceData);
    
    // Check DMA transferred 4 bytes
    m.assertDmaTransferred(4);
    
    // Check DMA returned to IDLE state after completion
    const finalDmaState = m.getDmaState();
    expect(finalDmaState).toBe(DmaState.IDLE);
    
    // Verify source data is unchanged
    m.assertMemoryBlock(0x8000, sourceData);
    
    // Check registers reflect the transfer
    const regs = m.getDmaRegisters();
    expect(regs.dmaEnabled).toBe(true);
    expect(regs.blockLength).toBe(4);
    expect(regs.directionAtoB).toBe(true); // A→B transfer
  });
});
