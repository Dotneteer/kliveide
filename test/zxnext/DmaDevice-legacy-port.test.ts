import { describe, it, expect, beforeEach } from "vitest";
import {
  DmaDevice,
  DmaMode,
  DmaState,
  CycleLength
} from "@emu/machines/zxNext/DmaDevice";
import { TestZxNextMachine } from "./TestNextMachine";

describe("DmaDevice - Step 17: Port Handler Integration (0x0B - Legacy Mode)", () => {
  let machine: TestZxNextMachine;
  let dmaDevice: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dmaDevice = machine.dmaDevice;
  });

  describe("Port 0x0B Write Operations", () => {
    it("should set DMA mode to LEGACY when writing to port 0x0B", () => {
      // Initially in zxnDMA mode
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.ZXNDMA);

      // Write to port 0x0B should switch to legacy mode
      machine.portManager.writePort(0x0b, 0xc3); // RESET command
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
    });

    it("should route WR0 commands through port 0x0B", () => {
      // Configure WR0: Transfer, A->B, Port A address 0x8000, length 4
      machine.portManager.writePort(0x0b, 0x7d);
      machine.portManager.writePort(0x0b, 0x00);
      machine.portManager.writePort(0x0b, 0x80);
      machine.portManager.writePort(0x0b, 0x04);
      machine.portManager.writePort(0x0b, 0x00);

      const registers = dmaDevice.getRegisters();
      expect(registers.portAStartAddress).toBe(0x8000);
      expect(registers.blockLength).toBe(4);
      expect(registers.directionAtoB).toBe(true);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
    });

    it("should route WR4 commands through port 0x0B", () => {
      // Configure WR4: Continuous mode, Port B address 0x9000
      machine.portManager.writePort(0x0b, 0xdd);
      machine.portManager.writePort(0x0b, 0x00);
      machine.portManager.writePort(0x0b, 0x90);

      const registers = dmaDevice.getRegisters();
      expect(registers.portBStartAddress).toBe(0x9000);
      expect(registers.transferMode).toBe(1); // CONTINUOUS
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
    });

    it("should route RESET command through port 0x0B", () => {
      // Set some non-default values
      dmaDevice.setDmaMode(DmaMode.ZXNDMA);
      machine.portManager.writePort(0x0b, 0x7d);
      machine.portManager.writePort(0x0b, 0x12);
      machine.portManager.writePort(0x0b, 0x34);
      machine.portManager.writePort(0x0b, 0x56);
      machine.portManager.writePort(0x0b, 0x78);

      // RESET
      machine.portManager.writePort(0x0b, 0xc3);

      const registers = dmaDevice.getRegisters();
      expect(registers.portATimingCycleLength).toBe(CycleLength.CYCLES_3);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
    });

    it("should route LOAD command through port 0x0B", () => {
      // Configure addresses
      machine.portManager.writePort(0x0b, 0x7d);
      machine.portManager.writePort(0x0b, 0x00);
      machine.portManager.writePort(0x0b, 0x80);
      machine.portManager.writePort(0x0b, 0x04);
      machine.portManager.writePort(0x0b, 0x00);

      machine.portManager.writePort(0x0b, 0xdd);
      machine.portManager.writePort(0x0b, 0x00);
      machine.portManager.writePort(0x0b, 0x90);

      // LOAD
      machine.portManager.writePort(0x0b, 0xcf);

      const transferState = dmaDevice.getTransferState();
      expect(transferState.sourceAddress).toBe(0x8000);
      expect(transferState.destAddress).toBe(0x9000);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
    });

    it("should route ENABLE_DMA command through port 0x0B", () => {
      // ENABLE_DMA
      machine.portManager.writePort(0x0b, 0x87);

      const registers = dmaDevice.getRegisters();
      expect(registers.dmaEnabled).toBe(true);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
    });
  });

  describe("Port 0x0B Read Operations", () => {
    it("should read initial status byte from port 0x0B", () => {
      const status = machine.portManager.readPort(0x0b);
      expect(status).toBe(0x36); // End of block, no transfer yet
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
    });

    it("should read status after INITIALIZE_READ_SEQUENCE command", () => {
      machine.portManager.writePort(0x0b, 0xa7); // INITIALIZE_READ_SEQUENCE
      const status = machine.portManager.readPort(0x0b);
      expect(status).toBe(0x36);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
    });

    it("should read counter values after configuring read mask", () => {
      // Configure for reading counter
      machine.portManager.writePort(0x0b, 0xbb); // READ_MASK_FOLLOWS
      machine.portManager.writePort(0x0b, 0x60); // Mask with counter enabled (bits 6,5)
      machine.portManager.writePort(0x0b, 0xa7); // INITIALIZE_READ_SEQUENCE

      // First read should be status
      const status = machine.portManager.readPort(0x0b);
      expect(status).toBe(0x36); // End of block reached
      
      // Second read should be counter low (0 initially - counter initialized to 0)
      const counterLow = machine.portManager.readPort(0x0b);
      expect(counterLow).toBe(0); // Byte counter starts at 0
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
    });

    it("should read Port A address through port 0x0B", () => {
      // Configure Port A address
      machine.portManager.writePort(0x0b, 0x7d);
      machine.portManager.writePort(0x0b, 0x34);
      machine.portManager.writePort(0x0b, 0x12);
      machine.portManager.writePort(0x0b, 0x00);
      machine.portManager.writePort(0x0b, 0x00);

      // Verify address was set
      const registers = dmaDevice.getRegisters();
      expect(registers.portAStartAddress).toBe(0x1234);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
    });
  });

  describe("Complete Transfer via Port 0x0B (Legacy Mode)", () => {
    it("should complete a simple memory-to-memory transfer via port 0x0B", () => {
      // Setup source memory
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      machine.memoryDevice.writeMemory(0x8001, 0x22);
      machine.memoryDevice.writeMemory(0x8002, 0x33);
      machine.memoryDevice.writeMemory(0x8003, 0x44);

      // Configure WR0: Transfer, A->B, Port A address 0x8000, length 4
      machine.portManager.writePort(0x0b, 0x7d);
      machine.portManager.writePort(0x0b, 0x00);
      machine.portManager.writePort(0x0b, 0x80);
      machine.portManager.writePort(0x0b, 0x03); // Length 3 in legacy mode = 4 bytes
      machine.portManager.writePort(0x0b, 0x00);

      // Configure WR1: Port A increment mode
      machine.portManager.writePort(0x0b, 0x14);

      // Configure WR2: Port B increment mode
      machine.portManager.writePort(0x0b, 0x10);

      // Configure WR4: Continuous mode, Port B address 0x9000
      machine.portManager.writePort(0x0b, 0xdd);
      machine.portManager.writePort(0x0b, 0x00);
      machine.portManager.writePort(0x0b, 0x90);

      // LOAD addresses
      machine.portManager.writePort(0x0b, 0xcf);

      // ENABLE_DMA
      machine.portManager.writePort(0x0b, 0x87);

      // Verify configuration before transfer
      const registers = dmaDevice.getRegisters();
      expect(registers.dmaEnabled).toBe(true);
      expect(registers.blockLength).toBe(3);
      expect(registers.transferMode).toBe(1); // CONTINUOUS
      
      const transferState = dmaDevice.getTransferState();
      expect(transferState.sourceAddress).toBe(0x8000);
      expect(transferState.destAddress).toBe(0x9000);

      // Execute transfer - should transfer blockLength+1 = 4 bytes in legacy mode
      const bytesTransferred = dmaDevice.executeContinuousTransfer();
      expect(bytesTransferred).toBe(4);

      // Verify destination
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0x11);
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(0x22);
      expect(machine.memoryDevice.readMemory(0x9002)).toBe(0x33);
      expect(machine.memoryDevice.readMemory(0x9003)).toBe(0x44);

      // Verify status flags
      const statusFlags = dmaDevice.getStatusFlags();
      expect(statusFlags.endOfBlockReached).toBe(true);
      expect(statusFlags.atLeastOneByteTransferred).toBe(true);

      // Verify byte counter (get fresh state after transfer)
      // In legacy mode: starts at 0xFFFF, after 4 bytes transferred = 3
      // (0xFFFF -> 0 -> 1 -> 2 -> 3)
      const transferStateAfter = dmaDevice.getTransferState();
      expect(transferStateAfter.byteCounter).toBe(3);
    });

    it("should verify length+1 behavior in legacy mode", () => {
      // Setup source memory with 10 bytes
      for (let i = 0; i < 10; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, i + 1);
      }

      // Configure transfer with length 4 (should transfer 5 bytes in legacy)
      machine.portManager.writePort(0x0b, 0x7d);
      machine.portManager.writePort(0x0b, 0x00);
      machine.portManager.writePort(0x0b, 0x80);
      machine.portManager.writePort(0x0b, 0x04); // Length 4 in legacy = 5 bytes
      machine.portManager.writePort(0x0b, 0x00);

      // Configure WR1: Port A increment
      machine.portManager.writePort(0x0b, 0x14);

      // Configure WR2: Port B increment
      machine.portManager.writePort(0x0b, 0x10);

      machine.portManager.writePort(0x0b, 0xdd);
      machine.portManager.writePort(0x0b, 0x00);
      machine.portManager.writePort(0x0b, 0x90);

      machine.portManager.writePort(0x0b, 0xcf);
      machine.portManager.writePort(0x0b, 0x87);

      // Execute transfer
      const bytesTransferred = dmaDevice.executeContinuousTransfer();
      
      // In legacy mode, length+1 behavior: 4+1 = 5 bytes
      expect(bytesTransferred).toBe(5);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);

      // Verify exactly 5 bytes transferred
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(1);
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(2);
      expect(machine.memoryDevice.readMemory(0x9002)).toBe(3);
      expect(machine.memoryDevice.readMemory(0x9003)).toBe(4);
      expect(machine.memoryDevice.readMemory(0x9004)).toBe(5);
      expect(machine.memoryDevice.readMemory(0x9005)).toBe(0); // Not transferred
    });

    it("should handle burst mode transfers via port 0x0B", () => {
      // Setup source memory
      machine.memoryDevice.writeMemory(0x8000, 0xAA);
      machine.memoryDevice.writeMemory(0x8001, 0xBB);

      // Configure WR0: Transfer, A->B
      machine.portManager.writePort(0x0b, 0x7d);
      machine.portManager.writePort(0x0b, 0x00);
      machine.portManager.writePort(0x0b, 0x80);
      machine.portManager.writePort(0x0b, 0x01); // Length 1 in legacy = 2 bytes
      machine.portManager.writePort(0x0b, 0x00);

      // Configure WR1: Port A increment mode
      machine.portManager.writePort(0x0b, 0x14);

      // Configure WR2: Prescalar = 1, Port B increment mode
      machine.portManager.writePort(0x0b, 0x50);
      machine.portManager.writePort(0x0b, 0x00);
      machine.portManager.writePort(0x0b, 0x01);

      // Configure WR4: Burst mode, Port B
      machine.portManager.writePort(0x0b, 0x8d);
      machine.portManager.writePort(0x0b, 0x00);
      machine.portManager.writePort(0x0b, 0x90);

      machine.portManager.writePort(0x0b, 0xcf);
      machine.portManager.writePort(0x0b, 0x87);

      // Execute burst transfer with enough T-states
      const bytesTransferred = dmaDevice.executeBurstTransfer(1000);
      expect(bytesTransferred).toBe(2);

      // Verify destination
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0xAA);
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(0xBB);
    });
  });

  describe("Mode Persistence", () => {
    it("should maintain legacy mode across multiple operations", () => {
      // Write to port 0x0B
      machine.portManager.writePort(0x0b, 0xc3);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);

      // Read from port 0x0B
      machine.portManager.readPort(0x0b);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);

      // Configure transfer
      machine.portManager.writePort(0x0b, 0x7d);
      machine.portManager.writePort(0x0b, 0x00);
      machine.portManager.writePort(0x0b, 0x80);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
    });

    it("should initialize byte counter to 0xFFFF in legacy mode", () => {
      // ENABLE_DMA in legacy mode
      machine.portManager.writePort(0x0b, 0x87);

      const transferState = dmaDevice.getTransferState();
      expect(transferState.byteCounter).toBe(0xFFFF); // -1 in 16-bit
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
    });
  });

  describe("Status Byte via Port 0x0B", () => {
    it("should read correct status byte format via port 0x0B", () => {
      machine.portManager.writePort(0x0b, 0xa7); // INITIALIZE_READ_SEQUENCE
      const status = machine.portManager.readPort(0x0b);

      // Status byte format: 0bXX1X_XXX0 where X varies
      expect(status & 0x01).toBe(0); // Bit 0 always 0
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
    });

    it("should show status changes through port 0x0B after transfer", () => {
      // Setup transfer
      machine.memoryDevice.writeMemory(0x8000, 0x42);

      machine.portManager.writePort(0x0b, 0x7d);
      machine.portManager.writePort(0x0b, 0x00);
      machine.portManager.writePort(0x0b, 0x80);
      machine.portManager.writePort(0x0b, 0x00); // Length 0 in legacy = 1 byte
      machine.portManager.writePort(0x0b, 0x00);

      machine.portManager.writePort(0x0b, 0x14); // WR1

      machine.portManager.writePort(0x0b, 0x10); // WR2

      // Configure WR4: Continuous mode (for completeness), Port B address 0x9000
      machine.portManager.writePort(0x0b, 0xdd);
      machine.portManager.writePort(0x0b, 0x00);
      machine.portManager.writePort(0x0b, 0x90);

      // LOAD addresses
      machine.portManager.writePort(0x0b, 0xcf);

      // ENABLE_DMA
      machine.portManager.writePort(0x0b, 0x87);

      // Initialize status register read sequence
      machine.portManager.writePort(0x0b, 0xa7);
      const statusBefore = machine.portManager.readPort(0x0b);

      // Execute transfer
      dmaDevice.executeContinuousTransfer();

      // Read status after transfer
      machine.portManager.writePort(0x0b, 0xa7);
      const status = machine.portManager.readPort(0x0b);
      expect(status).toBe(0x37); // End of block reached, transfer occurred
    });
  });

  describe("Mode Switching", () => {
    it("should switch from zxnDMA mode to legacy mode", () => {
      // Start in zxnDMA mode
      machine.portManager.writePort(0x6b, 0xc3);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.ZXNDMA);

      // Switch to legacy mode
      machine.portManager.writePort(0x0b, 0xc3);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
    });

    it("should switch from legacy mode to zxnDMA mode", () => {
      // Start in legacy mode
      machine.portManager.writePort(0x0b, 0xc3);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);

      // Switch to zxnDMA mode
      machine.portManager.writePort(0x6b, 0xc3);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.ZXNDMA);
    });

    it("should handle transfers after mode switch", () => {
      // Configure in zxnDMA mode (length is exact)
      machine.memoryDevice.writeMemory(0x8000, 0xAA);
      machine.memoryDevice.writeMemory(0x8001, 0xBB);

      machine.portManager.writePort(0x6b, 0x7d);
      machine.portManager.writePort(0x6b, 0x00);
      machine.portManager.writePort(0x6b, 0x80);
      machine.portManager.writePort(0x6b, 0x01); // Length 1 in zxnDMA = 1 byte
      machine.portManager.writePort(0x6b, 0x00);

      machine.portManager.writePort(0x6b, 0x14);
      machine.portManager.writePort(0x6b, 0x10);

      machine.portManager.writePort(0x6b, 0xdd);
      machine.portManager.writePort(0x6b, 0x00);
      machine.portManager.writePort(0x6b, 0x90);

      machine.portManager.writePort(0x6b, 0xcf);
      machine.portManager.writePort(0x6b, 0x87);

      // Transfer in zxnDMA mode
      let bytesTransferred = dmaDevice.executeContinuousTransfer();
      expect(bytesTransferred).toBe(1); // Exact length in zxnDMA
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0xAA);
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(0); // Not transferred

      // Reset
      machine.portManager.writePort(0x0b, 0xc3);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);

      // Configure same transfer in legacy mode
      machine.portManager.writePort(0x0b, 0x7d);
      machine.portManager.writePort(0x0b, 0x00);
      machine.portManager.writePort(0x0b, 0x80);
      machine.portManager.writePort(0x0b, 0x01); // Length 1 in legacy = 2 bytes
      machine.portManager.writePort(0x0b, 0x00);

      machine.portManager.writePort(0x0b, 0x14);
      machine.portManager.writePort(0x0b, 0x10);

      machine.portManager.writePort(0x0b, 0xdd);
      machine.portManager.writePort(0x0b, 0x00);
      machine.portManager.writePort(0x0b, 0xa0); // Different dest address

      machine.portManager.writePort(0x0b, 0xcf);
      machine.portManager.writePort(0x0b, 0x87);

      // Transfer in legacy mode
      bytesTransferred = dmaDevice.executeContinuousTransfer();
      expect(bytesTransferred).toBe(2); // Length+1 in legacy
      expect(machine.memoryDevice.readMemory(0xa000)).toBe(0xAA);
      expect(machine.memoryDevice.readMemory(0xa001)).toBe(0xBB);
    });
  });
});
