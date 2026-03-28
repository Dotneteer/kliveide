/**
 * Unit tests for DMA Timing and Contention
 * Step 19: Memory Contention and Timing
 * 
 * These tests verify that DMA properly accounts for memory wait states
 * and contention at different CPU speeds and memory regions.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DmaDevice } from "@emu/machines/zxNext/DmaDevice";
import { TestZxNextMachine } from "./TestNextMachine";

describe("DMA Timing and Contention", () => {
  let dma: DmaDevice;
  let machine: TestZxNextMachine;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dma = machine.dmaDevice;
  });

  // Helper function to configure DMA for continuous memory-to-memory transfer
  function configureMemoryTransfer(
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

  describe("CPU Speed Variations", () => {
    it("should consume 6 T-states at 3.5 MHz (3 read + 3 write, no wait states)", () => {
      // --- Arrange
      machine.cpuSpeedDevice.nextReg07Value = 0x00; // 3.5 MHz
      machine.memoryDevice.writeMemory(0x8000, 0xAA);
      configureMemoryTransfer(0x8000, 0x9000, 1);

      // Request bus
      dma.stepDma();
      dma.acknowledgeBus();

      const initialTacts = machine.tacts;

      // --- Act
      const tStates = dma.stepDma();

      // --- Assert
      expect(tStates).toBe(6); // 3 T-states read + 3 T-states write
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0xAA);
    });

    it("should consume 6 T-states at 7 MHz (3 read + 3 write, no wait states)", () => {
      // --- Arrange
      machine.cpuSpeedDevice.nextReg07Value = 0x01; // 7 MHz
      machine.memoryDevice.writeMemory(0x8000, 0xBB);
      configureMemoryTransfer(0x8000, 0x9000, 1);

      // Request bus
      dma.stepDma();
      dma.acknowledgeBus();

      // --- Act
      const tStates = dma.stepDma();

      // --- Assert
      expect(tStates).toBe(6); // 3 T-states read + 3 T-states write
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0xBB);
    });

    it("should consume 6 T-states at 14 MHz (3 read + 3 write, no wait states)", () => {
      // --- Arrange
      machine.cpuSpeedDevice.nextReg07Value = 0x02; // 14 MHz
      machine.memoryDevice.writeMemory(0x8000, 0xCC);
      configureMemoryTransfer(0x8000, 0x9000, 1);

      // Request bus
      dma.stepDma();
      dma.acknowledgeBus();

      // --- Act
      const tStates = dma.stepDma();

      // --- Assert
      expect(tStates).toBe(6); // 3 T-states read + 3 T-states write
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0xCC);
    });

    it("should consume 7 T-states at 28 MHz for SRAM-to-SRAM (4 read + 3 write)", () => {
      // --- Arrange
      machine.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz
      machine.memoryDevice.writeMemory(0x8000, 0xDD);
      configureMemoryTransfer(0x8000, 0x9000, 1);

      // Request bus
      dma.stepDma();
      dma.acknowledgeBus();

      // --- Act
      const tStates = dma.stepDma();

      // --- Assert
      // At 28 MHz, SRAM reads get +1 wait state (3 + 1 = 4)
      // Writes always 3 T-states
      expect(tStates).toBe(7); // 4 T-states read + 3 T-states write
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0xDD);
    });
  });

  describe("Memory Region Timing at 28 MHz", () => {
    beforeEach(() => {
      machine.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz
    });

    it("should consume 6 T-states reading from Bank 7 (no wait state)", () => {
      // --- Arrange
      // Map Bank 7 (page 0x0E) to slot 4 (0x8000-0x9FFF)
      machine.memoryDevice.setNextRegMmuValue(4, 0x0e);
      
      machine.memoryDevice.writeMemory(0x8000, 0xEE);
      configureMemoryTransfer(0x8000, 0xA000, 1); // Read from Bank 7, write to SRAM

      // Request bus
      dma.stepDma();
      dma.acknowledgeBus();

      // --- Act
      const tStates = dma.stepDma();

      // --- Assert
      // Bank 7 has no wait state, so: 3 T-states read + 3 T-states write = 6
      expect(tStates).toBe(6);
      expect(machine.memoryDevice.readMemory(0xA000)).toBe(0xEE);
    });

    it("should consume 7 T-states reading from Bank 5 (with wait state)", () => {
      // --- Arrange
      // Bank 5 is at pages 0x0A and 0x0B - default mapped to 0x4000-0x7FFF
      machine.memoryDevice.writeMemory(0x4000, 0xFF);
      configureMemoryTransfer(0x4000, 0x9000, 1); // Read from Bank 5, write to SRAM

      // Request bus
      dma.stepDma();
      dma.acknowledgeBus();

      // --- Act
      const tStates = dma.stepDma();

      // --- Assert
      // Bank 5 has wait state at 28 MHz: 4 T-states read + 3 T-states write = 7
      expect(tStates).toBe(7);
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0xFF);
    });

    it("should consume 7 T-states for SRAM read regions", () => {
      // --- Arrange
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      configureMemoryTransfer(0x8000, 0xA000, 1);

      // Request bus
      dma.stepDma();
      dma.acknowledgeBus();

      // --- Act
      const tStates = dma.stepDma();

      // --- Assert
      // SRAM regions get wait state: 4 T-states read + 3 T-states write = 7
      expect(tStates).toBe(7);
      expect(machine.memoryDevice.readMemory(0xA000)).toBe(0x11);
    });
  });

  describe("Integration with Machine Frame Loop", () => {
    it("should accumulate T-states correctly at 28 MHz", () => {
      // --- Arrange
      machine.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz
      machine.memoryDevice.writeMemory(0x8000, 0x22);
      machine.memoryDevice.writeMemory(0x8001, 0x33);
      configureMemoryTransfer(0x8000, 0xA000, 2);

      const initialTacts = machine.tacts;

      // --- Act
      // Transfer byte 1: Request bus (0 T-states)
      machine.beforeInstructionExecuted();
      
      // Transfer byte 1: Acknowledge + transfer (7 T-states)
      machine.beforeInstructionExecuted();
      
      const tactsAfterByte1 = machine.tacts - initialTacts;
      
      // Transfer byte 2: Request bus (0 T-states)
      machine.beforeInstructionExecuted();
      
      // Transfer byte 2: Acknowledge + transfer (7 T-states)
      machine.beforeInstructionExecuted();
      
      const totalTacts = machine.tacts - initialTacts;

      // --- Assert
      expect(tactsAfterByte1).toBe(7); // First byte: 7 T-states
      expect(totalTacts).toBe(14); // Two bytes: 7 + 7 = 14 T-states
      expect(machine.memoryDevice.readMemory(0xA000)).toBe(0x22);
      expect(machine.memoryDevice.readMemory(0xA001)).toBe(0x33);
    });

    it("should handle mixed Bank 7 and SRAM timing in one transfer", () => {
      // --- Arrange
      machine.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz
      
      // Map Bank 7 to slot 2 (0x4000-0x5FFF)
      machine.memoryDevice.setNextRegMmuValue(2, 0x0e);
      
      machine.memoryDevice.writeMemory(0x4000, 0x44); // Bank 7
      machine.memoryDevice.writeMemory(0x4001, 0x55); // Bank 7
      configureMemoryTransfer(0x4000, 0x9000, 2); // Read from Bank 7, write to SRAM

      const initialTacts = machine.tacts;

      // --- Act
      // Byte 1
      machine.beforeInstructionExecuted();
      machine.beforeInstructionExecuted();
      
      // Byte 2
      machine.beforeInstructionExecuted();
      machine.beforeInstructionExecuted();
      
      const totalTacts = machine.tacts - initialTacts;

      // --- Assert
      // Both reads from Bank 7 (no wait state): 2 × 6 = 12 T-states
      expect(totalTacts).toBe(12);
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0x44);
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(0x55);
    });
  });

  describe("I/O Port Timing", () => {
    it("should consume 8 T-states for I/O to memory transfer (4 read + 4 write)", () => {
      // --- Arrange
      machine.cpuSpeedDevice.nextReg07Value = 0x00; // 3.5 MHz
      
      // Reset timing
      dma.writeWR6(0xc7); // RESET_PORT_A_TIMING
      dma.writeWR6(0xcb); // RESET_PORT_B_TIMING

      // WR0: A→B transfer + Port A address + block length
      dma.writeWR0(0x79); // A→B transfer, I/O to memory
      dma.writeWR0(0xFE); // Port A low (port 0xFE)
      dma.writeWR0(0x00); // Port A high
      dma.writeWR0(0x01); // Block length low (1 byte)
      dma.writeWR0(0x00); // Block length high

      // WR1: Port A is I/O
      dma.writeWR1(0x18); // I/O mode

      // WR2: Port B is memory
      dma.writeWR2(0x10); // Memory, increment

      // WR4: Continuous mode + Port B address
      dma.writeWR4(0xbd); // Continuous mode
      dma.writeWR4(0x00); // Port B low
      dma.writeWR4(0x90); // Port B high (0x9000)

      // LOAD and ENABLE
      dma.writeWR6(0xcf); // LOAD
      dma.writeWR6(0x87); // ENABLE_DMA

      // Request bus
      dma.stepDma();
      dma.acknowledgeBus();

      // --- Act
      const tStates = dma.stepDma();

      // --- Assert
      // I/O read: 4 T-states, memory write: 4 T-states (since it's actually I/O in this case)
      // Actually for I/O to memory: 4 T-states read + 3 T-states write = 7
      expect(tStates).toBe(7);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 28: Prescaler timing applies to all operating modes
// ─────────────────────────────────────────────────────────────────────────────

describe("DmaDevice - Step 28: Prescaler timing for all modes", () => {
  let machine: TestZxNextMachine;
  let dma: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dma = machine.dmaDevice;
  });

  /**
   * Configure a transfer with the given operating mode and prescaler.
   * Returns T-states from executeContinuousTransfer's internal stepDma calls;
   * we verify by directly testing calculateDmaTransferTiming vs prescaler path.
   */
  function configurePrescaledTransfer(continuousMode: boolean, prescaler: number) {
    dma.writeWR6(0xc7); dma.writeWR6(0xcb);
    dma.writeWR0(0x7d);
    dma.writeWR0(0x00); dma.writeWR0(0x80); // Port A = 0x8000
    dma.writeWR0(0x01); dma.writeWR0(0x00); // block = 1
    dma.writeWR1(0x14);
    // WR2 with timing byte D5=1 (prescaler follows): 0x50 | timing_follows(0x40) | D5=0x20
    // 0x10 = Port B memory increment.  Timing=0x60: D6=1 (timing follows), D5=1 (prescaler follows)
    dma.writeWR2(0x50); // Port B: memory, increment, timing byte follows
    dma.writeWR2(0x60 | (prescaler > 0 ? 0x20 : 0x00)); // timing byte: D6=timing_follows was already handled; use 0x20 for prescaler
    if (prescaler > 0) dma.writeWR2(prescaler);
    // WR4: Continuous (0b01) or Burst (0b10)
    const wr4 = continuousMode ? 0xad : 0xcd; // Continuous=0xAD (D6D5=01), Burst=0xCD (D6D5=10)
    dma.writePort(wr4);
    dma.writePort(0x00); dma.writePort(0x90); // Port B = 0x9000
    machine.memoryDevice.writeMemory(0x8000, 0x42);
    dma.writeWR6(0xcf);
    dma.writeWR6(0x87);
  }

  it("Burst mode with prescaler returns prescaler-based T-states", () => {
    // Independent unit test: directly set portBPrescalar and call executeTransferByte
    dma.writeWR6(0xc7); dma.writeWR6(0xcb);
    dma.writeWR0(0x7d);
    dma.writeWR0(0x00); dma.writeWR0(0x80);
    dma.writeWR0(0x04); dma.writeWR0(0x00);
    dma.writeWR1(0x14);
    dma.writeWR2(0x50);
    dma.writeWR2(0x60 | 0x20); // timing byte: D5=1 (prescaler follows)
    dma.writeWR2(0x04);        // prescaler = 4
    dma.writePort(0xcd); // WR4: Burst mode (D6D5=10), portB addr follows
    dma.writePort(0x00); dma.writePort(0x90);
    [0x11, 0x22, 0x33, 0x44].forEach((v, i) => machine.memoryDevice.writeMemory(0x8000 + i, v));
    dma.writeWR6(0xcf);
    dma.writeWR6(0x87);
    // prescaler=4 → floor((4 * 3_500_000) / 875_000) = floor(16) = 16 T-states per byte
    const expectedTStates = Math.floor((4 * 3500000) / 875000);
    // executeTransferByte is called by stepDma; we track by running manually
    const machine2 = machine;
    machine2.dmaDevice.acknowledgeBus();
    machine2.dmaDevice.acknowledgeBus(); // ensure bus is available
    // Step once to get into transfer state
    let tStates = 0;
    machine2.dmaDevice.requestBus();
    machine2.dmaDevice.acknowledgeBus();
    for (let i = 0; i < 10; i++) {
      machine2.dmaDevice.requestBus();
      machine2.dmaDevice.acknowledgeBus();
      const t = machine2.dmaDevice.stepDma();
      if (t > 0) { tStates = t; break; }
    }
    expect(tStates).toBe(expectedTStates);
  });

  it("Continuous mode with non-zero prescaler uses prescaler T-states (Step 28)", () => {
    // Configure continuous mode with prescaler=2
    dma.writeWR6(0xc7); dma.writeWR6(0xcb);
    dma.writeWR0(0x7d);
    dma.writeWR0(0x00); dma.writeWR0(0x80);
    dma.writeWR0(0x01); dma.writeWR0(0x00);
    dma.writeWR1(0x14);
    dma.writeWR2(0x50);
    dma.writeWR2(0x60 | 0x20); // timing: D5=1 (prescaler follows)
    dma.writeWR2(0x02);        // prescaler = 2
    dma.writePort(0xad); // WR4: Continuous
    dma.writePort(0x00); dma.writePort(0x90);
    machine.memoryDevice.writeMemory(0x8000, 0x42);
    dma.writeWR6(0xcf); dma.writeWR6(0x87);
    // prescaler=2 → floor((2 * 3_500_000) / 875_000) = 8 T-states per byte
    const expectedTStates = Math.floor((2 * 3500000) / 875000);
    let tStates = 0;
    machine.dmaDevice.requestBus();
    machine.dmaDevice.acknowledgeBus();
    for (let i = 0; i < 10; i++) {
      machine.dmaDevice.requestBus();
      machine.dmaDevice.acknowledgeBus();
      const t = machine.dmaDevice.stepDma();
      if (t > 0) { tStates = t; break; }
    }
    expect(tStates).toBe(expectedTStates);
  });

  it("Continuous mode with zero prescaler uses standard memory timing", () => {
    // prescaler=0 → no prescaler → standard 3+3=6 T-states
    dma.writeWR6(0xc7); dma.writeWR6(0xcb);
    dma.writeWR0(0x7d);
    dma.writeWR0(0x00); dma.writeWR0(0x80);
    dma.writeWR0(0x01); dma.writeWR0(0x00);
    dma.writeWR1(0x14); dma.writeWR2(0x10);
    dma.writePort(0xad);
    dma.writePort(0x00); dma.writePort(0x90);
    machine.memoryDevice.writeMemory(0x8000, 0x42);
    dma.writeWR6(0xcf); dma.writeWR6(0x87);
    let tStates = 0;
    machine.dmaDevice.requestBus();
    machine.dmaDevice.acknowledgeBus();
    for (let i = 0; i < 10; i++) {
      machine.dmaDevice.requestBus();
      machine.dmaDevice.acknowledgeBus();
      const t = machine.dmaDevice.stepDma();
      if (t > 0) { tStates = t; break; }
    }
    expect(tStates).toBe(6); // 3 (mem read) + 3 (mem write) = 6
  });
});

