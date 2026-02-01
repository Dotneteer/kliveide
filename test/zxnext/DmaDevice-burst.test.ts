/**
 * Unit tests for DMA Burst Transfer Mode with Prescalar
 * Step 13: Burst Transfer Mode - Timed transfers with CPU interleaving
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DmaDevice, TransferMode } from "@emu/machines/zxNext/DmaDevice";
import { TestZxNextMachine } from "./TestNextMachine";

describe("DMA Burst Transfer Mode", () => {
  let dma: DmaDevice;
  let machine: TestZxNextMachine;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dma = machine.dmaDevice;
  });

  // Helper function to configure DMA for burst transfer
  function configureBurstTransfer(
    direction: "AtoB" | "BtoA",
    sourceAddr: number,
    destAddr: number,
    blockLength: number,
    prescalar: number = 1
  ) {
    // Reset timing
    dma.writeWR6(0xc7); // RESET_PORT_A_TIMING
    dma.writeWR6(0xcb); // RESET_PORT_B_TIMING

    // WR0: Transfer direction + Port A address + block length
    if (direction === "AtoB") {
      dma.writeWR0(0x7d); // A→B transfer
    } else {
      dma.writeWR0(0x79); // B→A transfer
    }
    dma.writeWR0((sourceAddr >> 0) & 0xff); // Port A low
    dma.writeWR0((sourceAddr >> 8) & 0xff); // Port A high
    dma.writeWR0((blockLength >> 0) & 0xff); // Block length low
    dma.writeWR0((blockLength >> 8) & 0xff); // Block length high

    // WR1: Port A configuration
    dma.writeWR1(0x14); // Memory, increment mode

    // WR2: Port B configuration with prescalar
    dma.writeWR2(0x50); // Memory, increment, timing byte follows
    dma.writeWR2(0x00); // Timing byte
    dma.writeWR2(prescalar & 0xff); // Prescalar value

    // WR4: Burst mode + Port B address
    dma.writeWR4(0xad); // Burst mode (bit 4=0)
    dma.writeWR4((destAddr >> 0) & 0xff); // Port B low
    dma.writeWR4((destAddr >> 8) & 0xff); // Port B high

    // LOAD and ENABLE_DMA commands
    dma.writeWR6(0xcf); // LOAD
    dma.writeWR6(0x87); // ENABLE_DMA
  }

  describe("Basic Burst Transfer", () => {
    it("should transfer bytes in burst mode with prescalar=1", () => {
      // Setup test data
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      machine.memoryDevice.writeMemory(0x8001, 0x22);
      machine.memoryDevice.writeMemory(0x8002, 0x33);

      configureBurstTransfer("AtoB", 0x8000, 0x9000, 3, 1);

      // Execute with enough T-states for all transfers
      const transferred = dma.executeBurstTransfer(10000);

      expect(transferred).toBe(3);
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0x11);
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(0x22);
      expect(machine.memoryDevice.readMemory(0x9002)).toBe(0x33);
    });

    it("should handle single byte burst transfer", () => {
      machine.memoryDevice.writeMemory(0x8000, 0x42);

      configureBurstTransfer("AtoB", 0x8000, 0x9000, 1, 1);

      const transferred = dma.executeBurstTransfer(1000);

      expect(transferred).toBe(1);
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0x42);
    });

    it("should support B→A direction in burst mode", () => {
      machine.memoryDevice.writeMemory(0x9000, 0xaa);
      machine.memoryDevice.writeMemory(0x9001, 0xbb);

      configureBurstTransfer("BtoA", 0x9000, 0x8000, 2, 1);

      const transferred = dma.executeBurstTransfer(5000);

      expect(transferred).toBe(2);
      expect(machine.memoryDevice.readMemory(0x8000)).toBe(0xaa);
      expect(machine.memoryDevice.readMemory(0x8001)).toBe(0xbb);
    });
  });

  describe("Prescalar Timing", () => {
    it("should handle prescalar=55 (16kHz audio rate)", () => {
      // 16kHz audio: 875kHz / 55 ≈ 15909 Hz
      for (let i = 0; i < 8; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, i + 1);
      }

      configureBurstTransfer("AtoB", 0x8000, 0x9000, 8, 55);

      // At 3.5MHz, prescalar=55 requires ~220 T-states per byte
      // 8 bytes * 220 = 1760 T-states minimum
      const transferred = dma.executeBurstTransfer(2000);

      expect(transferred).toBe(8);
      for (let i = 0; i < 8; i++) {
        expect(machine.memoryDevice.readMemory(0x9000 + i)).toBe(i + 1);
      }
    });

    it("should handle prescalar=110 (8kHz audio rate)", () => {
      // 8kHz audio: 875kHz / 110 ≈ 7954 Hz
      machine.memoryDevice.writeMemory(0x8000, 0x12);
      machine.memoryDevice.writeMemory(0x8001, 0x34);

      configureBurstTransfer("AtoB", 0x8000, 0x9000, 2, 110);

      // At 3.5MHz, prescalar=110 requires ~440 T-states per byte
      const transferred = dma.executeBurstTransfer(1000);

      expect(transferred).toBe(2);
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0x12);
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(0x34);
    });

    it("should handle prescalar=220 (4kHz rate)", () => {
      machine.memoryDevice.writeMemory(0x8000, 0xff);

      configureBurstTransfer("AtoB", 0x8000, 0x9000, 1, 220);

      // At 3.5MHz, prescalar=220 requires ~880 T-states per byte
      const transferred = dma.executeBurstTransfer(1000);

      expect(transferred).toBe(1);
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0xff);
    });
  });

  describe("T-State Budget Management", () => {
    it("should transfer partial block when T-states insufficient", () => {
      for (let i = 0; i < 10; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, i);
      }

      configureBurstTransfer("AtoB", 0x8000, 0x9000, 10, 1);

      // Provide only enough T-states for ~5 bytes
      // At prescalar=1: ~4 T-states per byte at 3.5MHz
      const transferred = dma.executeBurstTransfer(20);

      expect(transferred).toBeGreaterThan(0);
      expect(transferred).toBeLessThan(10);
      
      // Verify that transferred bytes are correct
      for (let i = 0; i < transferred; i++) {
        expect(machine.memoryDevice.readMemory(0x9000 + i)).toBe(i);
      }
    });

    it("should resume transfer on subsequent calls", () => {
      for (let i = 0; i < 10; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, i + 0x10);
      }

      configureBurstTransfer("AtoB", 0x8000, 0x9000, 10, 1);

      // First execution - partial transfer
      const first = dma.executeBurstTransfer(20);
      expect(first).toBeGreaterThan(0);

      // Second execution - complete the rest
      const second = dma.executeBurstTransfer(50);
      
      const total = first + second;
      expect(total).toBeLessThanOrEqual(10);
      
      // Verify transferred data
      for (let i = 0; i < total; i++) {
        expect(machine.memoryDevice.readMemory(0x9000 + i)).toBe(i + 0x10);
      }
    });

    it("should not transfer when T-states is zero", () => {
      machine.memoryDevice.writeMemory(0x8000, 0x42);

      configureBurstTransfer("AtoB", 0x8000, 0x9000, 1, 1);

      const transferred = dma.executeBurstTransfer(0);

      expect(transferred).toBe(0);
    });
  });

  describe("Mode Validation", () => {
    it("should not transfer when DMA disabled", () => {
      machine.memoryDevice.writeMemory(0x8000, 0x42);

      configureBurstTransfer("AtoB", 0x8000, 0x9000, 1, 1);
      dma.writeWR6(0x83); // DISABLE_DMA

      const transferred = dma.executeBurstTransfer(1000);

      expect(transferred).toBe(0);
    });

    it("should not transfer in continuous mode", () => {
      machine.memoryDevice.writeMemory(0x8000, 0x42);

      // Configure for continuous mode
      dma.writeWR6(0xc7);
      dma.writeWR6(0xcb);
      dma.writeWR0(0x7d);
      dma.writeWR0(0x00);
      dma.writeWR0(0x80);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      dma.writeWR1(0x14);
      dma.writeWR2(0x10);
      dma.writeWR4(0xbd); // Continuous mode (bit 4=1)
      dma.writeWR4(0x00);
      dma.writeWR4(0x90);
      dma.writeWR6(0xcf);
      dma.writeWR6(0x87);

      const transferred = dma.executeBurstTransfer(1000);

      expect(transferred).toBe(0);
    });
  });

  describe("Bus Control in Burst Mode", () => {
    it("should release bus between byte transfers", () => {
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      machine.memoryDevice.writeMemory(0x8001, 0x22);

      configureBurstTransfer("AtoB", 0x8000, 0x9000, 2, 1);

      dma.executeBurstTransfer(1000);

      // After burst transfer completes, bus should be released
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(false);
    });
  });

  describe("Large Block Transfers", () => {
    it("should handle 256-byte burst transfer", () => {
      for (let i = 0; i < 256; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, i & 0xff);
      }

      configureBurstTransfer("AtoB", 0x8000, 0x9000, 256, 1);

      const transferred = dma.executeBurstTransfer(2000);

      expect(transferred).toBe(256);
      // Verify sample bytes
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0x00);
      expect(machine.memoryDevice.readMemory(0x9080)).toBe(0x80);
      expect(machine.memoryDevice.readMemory(0x90ff)).toBe(0xff);
    });

    it("should handle partial large transfer across multiple calls", () => {
      for (let i = 0; i < 100; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, i);
      }

      configureBurstTransfer("AtoB", 0x8000, 0x9000, 100, 10);

      // Transfer in chunks
      let totalTransferred = 0;
      let iterations = 0;
      const maxIterations = 10; // Safety limit

      while (totalTransferred < 100 && iterations < maxIterations) {
        const chunk = dma.executeBurstTransfer(500);
        totalTransferred += chunk;
        iterations++;
        
        if (chunk === 0) break; // No more progress
      }

      expect(totalTransferred).toBe(100);
      
      // Verify sample bytes
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0);
      expect(machine.memoryDevice.readMemory(0x9032)).toBe(50);
      expect(machine.memoryDevice.readMemory(0x9063)).toBe(99);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero-length block", () => {
      machine.memoryDevice.writeMemory(0x8000, 0x42);

      configureBurstTransfer("AtoB", 0x8000, 0x9000, 0, 1);

      const transferred = dma.executeBurstTransfer(1000);

      expect(transferred).toBe(0);
    });

    it("should handle prescalar=0 as minimum value 1", () => {
      machine.memoryDevice.writeMemory(0x8000, 0x55);

      configureBurstTransfer("AtoB", 0x8000, 0x9000, 1, 0);

      // Should still work with prescalar treated as 1
      const transferred = dma.executeBurstTransfer(100);

      expect(transferred).toBeGreaterThan(0);
    });

    it("should handle prescalar=255 (maximum)", () => {
      machine.memoryDevice.writeMemory(0x8000, 0xaa);

      configureBurstTransfer("AtoB", 0x8000, 0x9000, 1, 255);

      // At prescalar=255: ~1020 T-states per byte at 3.5MHz
      const transferred = dma.executeBurstTransfer(2000);

      expect(transferred).toBe(1);
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0xaa);
    });
  });

  describe("Transfer State Updates", () => {
    it("should update byte counter during burst transfer", () => {
      for (let i = 0; i < 5; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, i);
      }

      configureBurstTransfer("AtoB", 0x8000, 0x9000, 5, 1);

      dma.executeBurstTransfer(100);

      const transferState = dma.getTransferState();
      expect(transferState.byteCounter).toBeGreaterThan(0);
      expect(transferState.byteCounter).toBeLessThanOrEqual(5);
    });

    it("should update addresses during burst transfer", () => {
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      machine.memoryDevice.writeMemory(0x8001, 0x22);
      machine.memoryDevice.writeMemory(0x8002, 0x33);

      configureBurstTransfer("AtoB", 0x8000, 0x9000, 3, 1);

      dma.executeBurstTransfer(100);

      const transferState = dma.getTransferState();
      expect(transferState.sourceAddress).toBeGreaterThan(0x8000);
      expect(transferState.destAddress).toBeGreaterThan(0x9000);
    });
  });
});
