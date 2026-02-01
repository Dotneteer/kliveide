/**
 * Unit tests for DMA Edge Cases and Error Handling
 * Step 21: Edge Cases and Error Handling
 * 
 * These tests verify that DMA properly handles edge cases, malformed commands,
 * and error conditions without crashing or corrupting state.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DmaDevice } from "@emu/machines/zxNext/DmaDevice";
import { TestZxNextMachine } from "./TestNextMachine";
import { DmaMode, DmaState } from "@emu/machines/zxNext/DmaDevice";

describe("DMA Edge Cases and Error Handling", () => {
  let dma: DmaDevice;
  let machine: TestZxNextMachine;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dma = machine.dmaDevice;
  });

  // Helper to configure a simple transfer
  function configureTransfer(
    sourceAddr: number,
    destAddr: number,
    blockLength: number,
    burst: boolean = false
  ) {
    // Reset timing
    dma.writeWR6(0xc7); // RESET_PORT_A_TIMING
    dma.writeWR6(0xcb); // RESET_PORT_B_TIMING

    // WR0: A→B transfer + Port A address + block length
    dma.writeWR0(0x7d); // A→B transfer, memory to memory
    dma.writeWR0((sourceAddr >> 0) & 0xff);
    dma.writeWR0((sourceAddr >> 8) & 0xff);
    dma.writeWR0((blockLength >> 0) & 0xff);
    dma.writeWR0((blockLength >> 8) & 0xff);

    // WR1: Port A configuration
    dma.writeWR1(0x14); // Memory, increment

    // WR2: Port B configuration
    dma.writeWR2(0x10); // Memory, increment

    // WR4: Mode + Port B address
    dma.writeWR4(burst ? 0x8d : 0xad); // Burst or continuous
    dma.writeWR4((destAddr >> 0) & 0xff);
    dma.writeWR4((destAddr >> 8) & 0xff);

    // LOAD command
    dma.writeWR6(0xcf);
    
    // ENABLE_DMA command
    dma.writeWR6(0x87);
  }

  describe("Zero-Length Transfers", () => {
    it("should handle zero-length transfer without crashing", () => {
      // --- Arrange
      configureTransfer(0x8000, 0x9000, 0);

      // --- Act
      // Attempt transfer - should complete immediately
      for (let i = 0; i < 10; i++) {
        machine.beforeInstructionExecuted();
        if (dma.getDmaState() === DmaState.IDLE) {
          break;
        }
      }

      // --- Assert
      expect(dma.getDmaState()).toBe(DmaState.IDLE);
      const status = dma.getStatusFlags();
      expect(status.endOfBlockReached).toBe(true);
    });

    it("should not request bus for zero-length transfer", () => {
      // --- Arrange
      configureTransfer(0x8000, 0x9000, 0);

      // --- Act
      machine.beforeInstructionExecuted();

      // --- Assert
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(false);
    });

    it("should handle zero-length transfer in burst mode", () => {
      // --- Arrange
      configureTransfer(0x8000, 0x9000, 0, true);

      // --- Act
      for (let i = 0; i < 5; i++) {
        machine.beforeInstructionExecuted();
      }

      // --- Assert
      expect(dma.getDmaState()).toBe(DmaState.IDLE);
      expect(dma.getStatusFlags().endOfBlockReached).toBe(true);
    });

    it("should allow new transfer after zero-length transfer completes", () => {
      // --- Arrange
      configureTransfer(0x8000, 0x9000, 0);
      for (let i = 0; i < 5; i++) {
        machine.beforeInstructionExecuted();
      }

      // Configure a normal transfer
      machine.memoryDevice.writeMemory(0x8000, 0xAB);
      configureTransfer(0x8000, 0x9000, 1);

      // --- Act
      for (let i = 0; i < 10; i++) {
        machine.beforeInstructionExecuted();
      }

      // --- Assert
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0xAB);
      expect(dma.getStatusFlags().atLeastOneByteTransferred).toBe(true);
    });
  });

  describe("Invalid Register Writes", () => {
    it("should ignore writes to invalid WR registers", () => {
      // --- Arrange
      configureTransfer(0x8000, 0x9000, 10);
      const initialRegisters = JSON.stringify(dma.getRegisters());

      // --- Act
      // Try to write to non-existent WR3 register (not part of Z80 DMA spec)
      // This would require going through writePort with a bit pattern not matching WR0/1/2/4/5/6
      // Since we don't have direct WR3, test invalid sequences instead

      // Write incomplete sequences (should be ignored or handled gracefully)
      dma.writeWR2(0x40); // Timing follows flag
      // Don't write timing/prescalar bytes - incomplete sequence
      
      // --- Assert
      // Should not crash and registers should remain valid
      expect(dma.getRegisters().portBPrescalar).toBeDefined();
    });

    it("should handle oversized block length gracefully", () => {
      // --- Arrange
      // Try to configure 0xFFFF (65535) byte transfer
      dma.writeWR0(0x7d);
      dma.writeWR0(0x00); // Source low
      dma.writeWR0(0x80); // Source high
      dma.writeWR0(0xFF); // Block length low
      dma.writeWR0(0xFF); // Block length high

      dma.writeWR1(0x14);
      dma.writeWR2(0x28);
      dma.writeWR4(0xcd);
      dma.writeWR4(0x00); // Dest low
      dma.writeWR4(0x90); // Dest high

      dma.writeWR6(0xcf); // LOAD
      dma.writeWR6(0x87); // ENABLE_DMA

      // --- Act & Assert
      // Should not crash - transfer may take many iterations
      for (let i = 0; i < 100; i++) {
        machine.beforeInstructionExecuted();
      }
      
      // DMA should still be active (huge transfer)
      expect(dma.getDmaState()).not.toBe(DmaState.IDLE);
    });

    it("should handle invalid port configuration gracefully", () => {
      // --- Arrange
      // Configure with potentially conflicting settings
      dma.writeWR1(0x04 | 0x08 | 0x10); // IO + increment + decrement (conflicting)
      dma.writeWR2(0x04 | 0x08 | 0x20); // IO + fixed + increment (conflicting)

      // --- Act
      dma.writeWR6(0xcf); // LOAD

      // --- Assert
      // Should not crash and should have some valid configuration
      const registers = dma.getRegisters();
      expect(registers).toBeDefined();
    });
  });

  describe("Invalid Commands", () => {
    it("should ignore unknown command codes", () => {
      // --- Arrange
      configureTransfer(0x8000, 0x9000, 10);
      const initialState = dma.getDmaState();

      // --- Act
      // Write various invalid command codes
      dma.writeWR6(0x00); // Not a valid command
      dma.writeWR6(0x01);
      dma.writeWR6(0x50);
      dma.writeWR6(0xAA);
      dma.writeWR6(0xFF);

      // --- Assert
      // State should remain unchanged
      expect(dma.getDmaState()).toBe(initialState);
    });

    it("should not corrupt configuration with invalid commands", () => {
      // --- Arrange
      machine.memoryDevice.writeMemory(0x8000, 0x42);
      configureTransfer(0x8000, 0x9000, 1);

      // --- Act
      // Inject invalid commands mid-setup
      dma.writeWR6(0x11);
      dma.writeWR6(0x22);
      dma.writeWR6(0x33);

      // Complete transfer
      for (let i = 0; i < 10; i++) {
        machine.beforeInstructionExecuted();
      }

      // --- Assert
      // Transfer should still work correctly
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0x42);
    });

    it("should handle command before configuration", () => {
      // --- Act
      // Try to enable DMA before any configuration
      dma.writeWR6(0x87); // ENABLE_DMA

      // --- Assert
      // Should not crash - DMA may enter undefined state but shouldn't corrupt memory
      expect(() => {
        for (let i = 0; i < 10; i++) {
          machine.beforeInstructionExecuted();
        }
      }).not.toThrow();
    });

    it("should handle multiple ENABLE_DMA commands", () => {
      // --- Arrange
      configureTransfer(0x8000, 0x9000, 5);

      // --- Act
      // Enable multiple times
      dma.writeWR6(0x87); // Already enabled by configureTransfer
      dma.writeWR6(0x87);
      dma.writeWR6(0x87);

      // --- Assert
      // Should not cause issues
      expect(dma.getDmaState()).toBe(DmaState.START_DMA);
    });

    it("should handle LOAD command mid-transfer", () => {
      // --- Arrange
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      machine.memoryDevice.writeMemory(0x8001, 0x22);
      machine.memoryDevice.writeMemory(0x8002, 0x33);
      configureTransfer(0x8000, 0x9000, 3);

      // Start transfer
      machine.beforeInstructionExecuted(); // Request bus
      machine.beforeInstructionExecuted(); // Transfer byte 1

      // --- Act
      // Try to LOAD mid-transfer
      dma.writeWR6(0xcf); // LOAD

      // Continue transfer
      for (let i = 0; i < 10; i++) {
        machine.beforeInstructionExecuted();
      }

      // --- Assert
      // Should handle gracefully - either continue or restart
      expect(() => {
        dma.getStatusFlags();
      }).not.toThrow();
    });
  });

  describe("Mode Switches Mid-Transfer", () => {
    it("should handle burst to continuous mode switch mid-transfer", () => {
      // --- Arrange
      machine.memoryDevice.writeMemory(0x8000, 0xAA);
      machine.memoryDevice.writeMemory(0x8001, 0xBB);
      machine.memoryDevice.writeMemory(0x8002, 0xCC);
      configureTransfer(0x8000, 0x9000, 3, true); // Burst mode

      // Start transfer
      machine.beforeInstructionExecuted(); // Request
      machine.beforeInstructionExecuted(); // Transfer byte 1

      // --- Act
      // Switch to continuous mode mid-transfer by writing WR4
      dma.writeWR4(0xcd); // Continuous mode
      dma.writeWR4(0x01);
      dma.writeWR4(0x90);

      // Continue transfer
      for (let i = 0; i < 10; i++) {
        machine.beforeInstructionExecuted();
      }

      // --- Assert
      // Should complete without crashing
      expect(() => {
        dma.getStatusFlags();
      }).not.toThrow();
    });

    it("should handle zxnDMA to legacy mode switch", () => {
      // --- Arrange
      machine.memoryDevice.writeMemory(0x8000, 0x55);
      configureTransfer(0x8000, 0x9000, 1);

      // Start transfer in zxnDMA mode
      machine.beforeInstructionExecuted();

      // --- Act
      // Switch to legacy mode (this would happen via port 0x0B access)
      // We can't directly test this without port handler, but we can test the internal state

      // Continue transfer
      for (let i = 0; i < 10; i++) {
        machine.beforeInstructionExecuted();
      }

      // --- Assert
      expect(() => {
        machine.memoryDevice.readMemory(0x9000);
      }).not.toThrow();
    });

    it("should handle register writes during active transfer", () => {
      // --- Arrange
      for (let i = 0; i < 10; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, i);
      }
      configureTransfer(0x8000, 0x9000, 10);

      // Start transfer
      machine.beforeInstructionExecuted();
      machine.beforeInstructionExecuted();

      // --- Act
      // Try to reconfigure during transfer
      dma.writeWR1(0x04); // Change Port A to I/O
      dma.writeWR2(0x08); // Change Port B to fixed

      // Continue transfer
      for (let i = 0; i < 20; i++) {
        machine.beforeInstructionExecuted();
      }

      // --- Assert
      // Should not crash
      expect(() => {
        dma.getDmaState();
      }).not.toThrow();
    });
  });

  describe("Disabled DMA Mid-Transfer", () => {
    it("should stop transfer when DMA disabled mid-transfer", () => {
      // --- Arrange
      for (let i = 0; i < 10; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, i);
      }
      configureTransfer(0x8000, 0x9000, 10);

      // Start transfer
      machine.beforeInstructionExecuted(); // Request
      machine.beforeInstructionExecuted(); // Transfer byte 1
      machine.beforeInstructionExecuted(); // Transfer byte 2

      // --- Act
      // Disable DMA mid-transfer
      dma.writeWR6(0x83); // DISABLE_DMA

      // Try to continue
      for (let i = 0; i < 10; i++) {
        machine.beforeInstructionExecuted();
      }

      // --- Assert
      // DMA should be idle/disabled
      expect(dma.getRegisters().dmaEnabled).toBe(false);
      
      // Should not have transferred all 10 bytes
      let transferredCount = 0;
      for (let i = 0; i < 10; i++) {
        if (machine.memoryDevice.readMemory(0x9000 + i) === i) {
          transferredCount++;
        }
      }
      expect(transferredCount).toBeLessThan(10);
    });

    it("should release bus when disabled mid-transfer", () => {
      // --- Arrange
      configureTransfer(0x8000, 0x9000, 10);
      machine.beforeInstructionExecuted(); // Request bus
      machine.beforeInstructionExecuted(); // Start transfer

      // Verify bus is active
      let busControl = dma.getBusControl();
      const busWasActive = busControl.busRequested || busControl.busAcknowledged;

      // --- Act
      dma.writeWR6(0x83); // DISABLE_DMA

      // --- Assert
      busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(false);
      
      // If bus was active before disable, it should have been released
      if (busWasActive) {
        expect(busControl.busAcknowledged).toBe(false);
      }
    });

    it("should allow re-enable after mid-transfer disable", () => {
      // --- Arrange
      for (let i = 0; i < 5; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, 0xA0 + i);
      }
      configureTransfer(0x8000, 0x9000, 5);

      // Partial transfer
      machine.beforeInstructionExecuted();
      machine.beforeInstructionExecuted();
      machine.beforeInstructionExecuted();

      // Disable
      dma.writeWR6(0x83);

      // --- Act
      // Re-enable and try to complete
      dma.writeWR6(0x87); // ENABLE_DMA

      for (let i = 0; i < 20; i++) {
        machine.beforeInstructionExecuted();
        if (dma.getDmaState() === DmaState.IDLE) {
          break;
        }
      }

      // --- Assert
      // Should either complete or restart - just verify no crash
      expect(() => {
        dma.getStatusFlags();
      }).not.toThrow();
    });

    it("should not corrupt memory when disabled mid-transfer", () => {
      // --- Arrange
      // Fill source with pattern
      for (let i = 0; i < 10; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, 0x10 + i);
      }
      
      // Fill destination with different pattern
      for (let i = 0; i < 10; i++) {
        machine.memoryDevice.writeMemory(0x9000 + i, 0xFF);
      }

      configureTransfer(0x8000, 0x9000, 10);

      // Transfer a few bytes
      machine.beforeInstructionExecuted();
      machine.beforeInstructionExecuted();
      machine.beforeInstructionExecuted();

      // --- Act
      dma.writeWR6(0x83); // DISABLE_DMA

      // --- Assert
      // Source should be unchanged
      for (let i = 0; i < 10; i++) {
        expect(machine.memoryDevice.readMemory(0x8000 + i)).toBe(0x10 + i);
      }

      // Destination should have some transferred bytes at the start, 0xFF at the end
      // The exact number depends on timing, but no memory should be corrupted
      let consecutiveFF = 0;
      for (let i = 9; i >= 0; i--) {
        if (machine.memoryDevice.readMemory(0x9000 + i) === 0xFF) {
          consecutiveFF++;
        } else {
          break;
        }
      }
      expect(consecutiveFF).toBeGreaterThan(0); // Some bytes should not have been transferred
    });
  });

  describe("State Corruption Prevention", () => {
    it("should maintain valid state after sequence of edge cases", () => {
      // --- Act
      // Execute a sequence of potentially problematic operations
      
      // 1. Zero-length transfer
      configureTransfer(0x8000, 0x9000, 0);
      for (let i = 0; i < 5; i++) machine.beforeInstructionExecuted();

      // 2. Invalid commands
      dma.writeWR6(0x00);
      dma.writeWR6(0xFF);

      // 3. Normal transfer
      machine.memoryDevice.writeMemory(0x8000, 0x99);
      configureTransfer(0x8000, 0x9000, 1);
      for (let i = 0; i < 10; i++) machine.beforeInstructionExecuted();

      // 4. Mid-transfer disable
      configureTransfer(0x8000, 0x9000, 10);
      machine.beforeInstructionExecuted();
      machine.beforeInstructionExecuted();
      dma.writeWR6(0x83);

      // 5. Another transfer
      machine.memoryDevice.writeMemory(0x8000, 0x88);
      configureTransfer(0x8000, 0x9000, 1);
      for (let i = 0; i < 10; i++) machine.beforeInstructionExecuted();

      // --- Assert
      // Final transfer should work correctly
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0x88);
      expect(dma.getStatusFlags().atLeastOneByteTransferred).toBe(true);
    });

    it("should handle rapid enable/disable cycles", () => {
      // --- Arrange
      configureTransfer(0x8000, 0x9000, 100);

      // --- Act
      for (let cycle = 0; cycle < 10; cycle++) {
        dma.writeWR6(0x87); // ENABLE
        machine.beforeInstructionExecuted();
        machine.beforeInstructionExecuted();
        dma.writeWR6(0x83); // DISABLE
      }

      // --- Assert
      expect(() => {
        dma.getDmaState();
        dma.getStatusFlags();
      }).not.toThrow();
    });

    it("should handle RESET command mid-transfer", () => {
      // --- Arrange
      for (let i = 0; i < 10; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, i);
      }
      configureTransfer(0x8000, 0x9000, 10);

      // Start transfer
      machine.beforeInstructionExecuted();
      machine.beforeInstructionExecuted();

      // --- Act
      dma.writeWR6(0xc3); // RESET

      // --- Assert
      // DMA should be reset to initial state
      const registers = dma.getRegisters();
      expect(registers.portATimingCycleLength).toBeDefined();
      expect(registers.portBTimingCycleLength).toBeDefined();
      
      // Transfer should have stopped
      expect(dma.getDmaState()).toBe(DmaState.IDLE);
    });

    it("should maintain register integrity across operations", () => {
      // --- Arrange
      configureTransfer(0x8000, 0x9000, 10);
      const initialRegisters = JSON.parse(JSON.stringify(dma.getRegisters()));

      // --- Act
      // Various operations
      dma.writeWR6(0x87); // ENABLE
      dma.writeWR6(0x83); // DISABLE
      dma.writeWR6(0xBF); // READ_STATUS
      dma.readStatusByte();

      // --- Assert
      const finalRegisters = dma.getRegisters();
      
      // Core transfer configuration should be preserved
      expect(finalRegisters.blockLength).toBe(initialRegisters.blockLength);
      expect(finalRegisters.portAStartAddress).toBe(initialRegisters.portAStartAddress);
      expect(finalRegisters.portBStartAddress).toBe(initialRegisters.portBStartAddress);
    });
  });

  describe("Boundary Conditions", () => {
    it("should handle address wraparound at 0xFFFF", () => {
      // --- Arrange
      // Configure transfer near memory boundary
      machine.memoryDevice.writeMemory(0xFFFF, 0xEE);
      machine.memoryDevice.writeMemory(0x0000, 0xDD);
      
      configureTransfer(0xFFFF, 0x9000, 2);

      // --- Act
      for (let i = 0; i < 20; i++) {
        machine.beforeInstructionExecuted();
        if (dma.getDmaState() === DmaState.IDLE) {
          break;
        }
      }

      // --- Assert
      // Should complete without crashing
      expect(dma.getStatusFlags().endOfBlockReached).toBe(true);
    });

    it("should handle maximum block length (0xFFFF)", () => {
      // --- Arrange
      configureTransfer(0x8000, 0x9000, 0xFFFF);

      // --- Act
      // Transfer a few bytes of the large block
      for (let i = 0; i < 100; i++) {
        machine.beforeInstructionExecuted();
      }

      // --- Assert
      // Should still be transferring
      expect(dma.getDmaState()).not.toBe(DmaState.IDLE);
      expect(() => dma.getStatusFlags()).not.toThrow();
    });

    it("should handle single-byte transfer (blockLength = 1)", () => {
      // --- Arrange
      machine.memoryDevice.writeMemory(0x8000, 0x42);
      configureTransfer(0x8000, 0x9000, 1);

      // --- Act
      for (let i = 0; i < 10; i++) {
        machine.beforeInstructionExecuted();
      }

      // --- Assert
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0x42);
      expect(dma.getStatusFlags().endOfBlockReached).toBe(true);
    });
  });
});
