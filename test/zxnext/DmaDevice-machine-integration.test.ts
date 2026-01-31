/**
 * Unit tests for DMA Machine Integration
 * Step 18: Machine Integration and Bus Arbitration
 * 
 * These tests verify that DMA properly integrates with the machine frame execution loop,
 * including bus arbitration, CPU suspension, and T-state accounting.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DmaDevice } from "@emu/machines/zxNext/DmaDevice";
import { TestZxNextMachine } from "./TestNextMachine";

describe("DMA Machine Integration - Bus Arbitration", () => {
  let dma: DmaDevice;
  let machine: TestZxNextMachine;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dma = machine.dmaDevice;
  });

  // Helper function to configure DMA for continuous transfer
  function configureContinuousTransfer(
    sourceAddr: number,
    destAddr: number,
    blockLength: number
  ) {
    // Reset timing
    dma.writeWR6(0xc7); // RESET_PORT_A_TIMING
    dma.writeWR6(0xcb); // RESET_PORT_B_TIMING

    // WR0: A→B transfer + Port A address + block length
    dma.writeWR0(0x7d); // A→B transfer
    dma.writeWR0((sourceAddr >> 0) & 0xff); // Port A low
    dma.writeWR0((sourceAddr >> 8) & 0xff); // Port A high
    dma.writeWR0((blockLength >> 0) & 0xff); // Block length low
    dma.writeWR0((blockLength >> 8) & 0xff); // Block length high

    // WR1: Port A configuration - increment mode
    dma.writeWR1(0x14); // Increment

    // WR2: Port B configuration - increment mode
    dma.writeWR2(0x10); // Increment

    // WR4: Continuous mode + Port B address
    dma.writeWR4(0xbd); // Continuous mode
    dma.writeWR4((destAddr >> 0) & 0xff); // Port B low
    dma.writeWR4((destAddr >> 8) & 0xff); // Port B high

    // LOAD command to activate configuration
    dma.writeWR6(0xcf); // LOAD
    
    // ENABLE_DMA command to start DMA
    dma.writeWR6(0x87); // ENABLE_DMA
  }

  // Helper function to configure DMA for burst transfer
  function configureBurstTransfer(
    sourceAddr: number,
    destAddr: number,
    blockLength: number,
    prescalar: number = 55
  ) {
    // Reset timing
    dma.writeWR6(0xc7); // RESET_PORT_A_TIMING
    dma.writeWR6(0xcb); // RESET_PORT_B_TIMING

    // WR0: A→B transfer + Port A address + block length
    dma.writeWR0(0x7d); // A→B transfer
    dma.writeWR0((sourceAddr >> 0) & 0xff); // Port A low
    dma.writeWR0((sourceAddr >> 8) & 0xff); // Port A high
    dma.writeWR0((blockLength >> 0) & 0xff); // Block length low
    dma.writeWR0((blockLength >> 8) & 0xff); // Block length high

    // WR1: Port A configuration - increment mode
    dma.writeWR1(0x14); // Increment

    // WR2: Port B configuration - increment mode + prescalar
    dma.writeWR2(0x50); // Increment + timing follows (bit 6=1)
    dma.writeWR2(0x00); // Timing byte (placeholder)
    dma.writeWR2(prescalar); // Prescalar value

    // WR4: Burst mode + Port B address
    dma.writeWR4(0x8d); // Burst mode (bit 6=0)
    dma.writeWR4((destAddr >> 0) & 0xff); // Port B low
    dma.writeWR4((destAddr >> 8) & 0xff); // Port B high

    // LOAD command to activate configuration
    dma.writeWR6(0xcf); // LOAD
    
    // ENABLE_DMA command to start DMA
    dma.writeWR6(0x87); // ENABLE_DMA
  }

  describe("Bus Control State", () => {
    it("should not request bus when DMA is disabled", () => {
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(false);
      expect(busControl.busAcknowledged).toBe(false);
    });

    it("should request bus when DMA is enabled and stepDma is called", () => {
      // Setup transfer
      configureContinuousTransfer(0x8000, 0x9000, 4);

      // Bus should NOT be requested yet (only requested when stepDma is called)
      let busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(false);

      // Call stepDma - this should request the bus
      dma.stepDma();

      // Now bus should be requested
      busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(true);
    });

    it("should release bus after transfer completes", () => {
      // Setup small transfer
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      configureContinuousTransfer(0x8000, 0x9000, 1);

      // First stepDma: request bus (returns 0 - waiting for ack)
      dma.stepDma();
      
      // Acknowledge bus
      dma.acknowledgeBus();
      
      // Second stepDma: perform transfer and release bus upon completion
      dma.stepDma();

      // Transfer complete - bus should be released
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(false);
      expect(busControl.busAcknowledged).toBe(false);
    });
  });

  describe("DMA and CPU Interleaving", () => {
    it("should request bus when DMA transfer is enabled", () => {
      // Setup transfer
      configureContinuousTransfer(0x8000, 0x9000, 10);

      // Call beforeInstructionExecuted - this will trigger stepDma which requests bus
      machine.beforeInstructionExecuted();

      // After stepDma call, bus should be requested
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(true);
    });

    it("should release bus when transfer completes", () => {
      // Setup very small transfer (1 byte)
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      configureContinuousTransfer(0x8000, 0x9000, 1);

      // Multiple calls to simulate DMA progressing
      for (let i = 0; i < 5; i++) {
        machine.beforeInstructionExecuted();
      }
      
      // Bus should be released after completion
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(false);
    });

    it("should not request bus when no DMA activity", () => {
      // No DMA configured
      machine.beforeInstructionExecuted();
      
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(false);
    });
  });

  describe("Incremental DMA Execution via stepDma()", () => {
    it("should transfer bytes incrementally in continuous mode", () => {
      // Setup test data
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      machine.memoryDevice.writeMemory(0x8001, 0x22);
      machine.memoryDevice.writeMemory(0x8002, 0x33);

      // Configure DMA
      configureContinuousTransfer(0x8000, 0x9000, 3);

      // Request bus (first stepDma call)
      dma.stepDma();
      
      // Acknowledge bus
      dma.acknowledgeBus();

      // Step 1: Transfer first byte
      const tStates1 = dma.stepDma();
      expect(tStates1).toBeGreaterThan(0); // Should consume T-states
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0x11);
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(0); // Not transferred yet

      // Step 2: Transfer second byte
      const tStates2 = dma.stepDma();
      expect(tStates2).toBeGreaterThan(0);
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(0x22);

      // Step 3: Transfer third byte
      const tStates3 = dma.stepDma();
      expect(tStates3).toBeGreaterThan(0);
      expect(machine.memoryDevice.readMemory(0x9002)).toBe(0x33);

      // Step 4: Transfer complete - should return 0
      const tStates4 = dma.stepDma();
      expect(tStates4).toBe(0);
    });

    it("should return 0 T-states when waiting for bus acknowledgment", () => {
      // Configure DMA
      configureContinuousTransfer(0x8000, 0x9000, 1);

      // Don't acknowledge bus
      const tStates = dma.stepDma();
      
      // Should return 0 because bus not acknowledged yet
      expect(tStates).toBe(0);
    });

    it("should consume T-states for each transfer operation", () => {
      // Setup test data
      machine.memoryDevice.writeMemory(0x8000, 0xaa);

      // Configure DMA
      configureContinuousTransfer(0x8000, 0x9000, 1);

      // Request bus (first stepDma call)
      dma.stepDma();
      
      // Acknowledge bus
      dma.acknowledgeBus();

      // Execute step
      const tStates = dma.stepDma();
      
      // Continuous mode should consume basic transfer time
      // (read + write, approximately 6 T-states)
      expect(tStates).toBe(6);
    });
  });

  describe("Burst Mode CPU Interleaving", () => {
    it("should release bus between bytes in burst mode", () => {
      // Setup burst transfer
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      machine.memoryDevice.writeMemory(0x8001, 0x22);
      configureBurstTransfer(0x8000, 0x9000, 2, 10);

      // First call: Request bus
      machine.beforeInstructionExecuted();
      
      // Second call: Acknowledge + transfer first byte
      machine.beforeInstructionExecuted();

      // In burst mode, bus should be released after byte
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(false);
    });

    it("should allow CPU and DMA to interleave via beforeInstructionExecuted", () => {
      // Setup burst transfer
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      machine.memoryDevice.writeMemory(0x8001, 0x22);
      configureBurstTransfer(0x8000, 0x9000, 2, 10);

      // Byte 1: Request bus
      machine.beforeInstructionExecuted();
      // Byte 1: Acknowledge + transfer
      machine.beforeInstructionExecuted();
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0x11);
      
      // After burst byte, bus is released so CPU can execute
      const busControl1 = dma.getBusControl();
      expect(busControl1.busRequested).toBe(false);

      // Byte 2: Request bus
      machine.beforeInstructionExecuted();
      // Byte 2: Acknowledge + transfer
      machine.beforeInstructionExecuted();
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(0x22);
    });

    it("should calculate correct prescalar delays for burst mode", () => {
      // Setup burst transfer with prescalar = 55 (common for 16kHz audio)
      configureBurstTransfer(0x8000, 0x9000, 1, 55);

      // Request bus (first stepDma call)
      dma.stepDma();
      
      // Acknowledge bus
      dma.acknowledgeBus();

      // Execute step
      const tStates = dma.stepDma();
      
      // Prescalar formula: (prescalar * 3500000) / 875000
      // For prescalar=55: (55 * 3500000) / 875000 = 220 T-states
      expect(tStates).toBe(220);
    });

    it("should handle different prescalar values", () => {
      // Test with prescalar = 20
      configureBurstTransfer(0x8000, 0x9000, 1, 20);
      
      // Request bus
      dma.stepDma();
      
      // Acknowledge bus
      dma.acknowledgeBus();
      
      const tStates = dma.stepDma();
      
      // (20 * 3500000) / 875000 = 80 T-states
      expect(tStates).toBe(80);
    });
  });

  describe("T-State Accounting", () => {
    it("should increment machine T-states during DMA", () => {
      // Setup transfer
      machine.memoryDevice.writeMemory(0x8000, 0xaa);
      configureContinuousTransfer(0x8000, 0x9000, 1);

      // Get initial tacts
      const initialTacts = machine.tacts;

      // First call: DMA requests bus, returns 0
      machine.beforeInstructionExecuted();
      expect(machine.tacts).toBe(initialTacts); // No T-states yet

      // Second call: DMA transfers byte, consumes T-states
      machine.beforeInstructionExecuted();

      // T-states should have increased
      expect(machine.tacts).toBeGreaterThan(initialTacts);
      expect(machine.tacts - initialTacts).toBe(6); // Basic transfer time
    });

    it("should account for prescalar delays in burst mode", () => {
      // Setup burst transfer
      machine.memoryDevice.writeMemory(0x8000, 0xbb);
      configureBurstTransfer(0x8000, 0x9000, 1, 100);

      // First call: request bus
      machine.beforeInstructionExecuted();
      
      // Get initial tacts before transfer
      const initialTacts = machine.tacts;

      // Second call: transfer byte with prescalar delay
      machine.beforeInstructionExecuted();

      // T-states should reflect prescalar delay
      // (100 * 3500000) / 875000 = 400 T-states
      expect(machine.tacts - initialTacts).toBe(400);
    });
  });

  describe("Multiple Bytes Integration", () => {
    it("should transfer complete block via machine frame loop", () => {
      // Setup test data
      for (let i = 0; i < 10; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, 0xa0 + i);
      }

      // Configure DMA
      configureContinuousTransfer(0x8000, 0x9000, 10);

      // Simulate machine frame loop calling beforeInstructionExecuted repeatedly
      for (let i = 0; i < 20; i++) {
        machine.beforeInstructionExecuted();
        
        // Check if DMA is still active
        const busControl = dma.getBusControl();
        if (!busControl.busRequested) {
          break; // Transfer complete
        }
      }

      // Verify all bytes transferred
      for (let i = 0; i < 10; i++) {
        expect(machine.memoryDevice.readMemory(0x9000 + i)).toBe(0xa0 + i);
      }

      // Verify bus is released after transfer
      const finalBusControl = dma.getBusControl();
      expect(finalBusControl.busRequested).toBe(false);
    });

    it("should handle burst mode with multiple bytes", () => {
      // Setup test data
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      machine.memoryDevice.writeMemory(0x8001, 0x22);
      machine.memoryDevice.writeMemory(0x8002, 0x33);

      // Configure burst transfer
      configureBurstTransfer(0x8000, 0x9000, 3, 10);

      // Execute steps - in burst mode, each byte needs:
      // 1. Request bus (call N) → busRequested=true
      // 2. Ack+Transfer (call N+1) → busRequested=false (released after byte)
      // Then cycle repeats for next byte
      // So we need at least 6 calls for 3 bytes (2 per byte)
      for (let i = 0; i < 20; i++) {
        machine.beforeInstructionExecuted();
        
        // Check if DMA is idle (transfer complete)
        if (dma.getDmaState() === 0) { // DmaState.IDLE
          break;
        }
      }

      // Verify all bytes transferred
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0x11);
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(0x22);
      expect(machine.memoryDevice.readMemory(0x9002)).toBe(0x33);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero-length transfer gracefully", () => {
      // Configure zero-length transfer
      configureContinuousTransfer(0x8000, 0x9000, 0);

      // Should not crash - give it a few calls to complete
      for (let i = 0; i < 5; i++) {
        machine.beforeInstructionExecuted();
      }
      
      // Should complete without requesting bus (zero bytes to transfer)
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(false);
    });

    it("should handle disabled DMA without affecting CPU", () => {
      // Configure but then disable
      configureContinuousTransfer(0x8000, 0x9000, 10);
      dma.writeWR6(0x83); // DISABLE_DMA

      // DMA should not request bus when disabled
      machine.beforeInstructionExecuted();
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(false);
    });

    it("should not interfere with CPU when DMA idle", () => {
      // No DMA activity
      const initialTacts = machine.tacts;
      
      machine.beforeInstructionExecuted();
      
      // Tacts should not increase from DMA (or only by interrupt check overhead)
      expect(machine.tacts).toBe(initialTacts);
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(false);
    });
  });
});
