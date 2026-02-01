import { describe, it, expect, beforeEach } from "vitest";
import {
  DmaDevice,
  DmaMode,
  DmaState,
  CycleLength
} from "@emu/machines/zxNext/DmaDevice";
import { TestZxNextMachine } from "./TestNextMachine";

describe("DmaDevice - Step 16: Port Handler Integration (0x6B)", () => {
  let machine: TestZxNextMachine;
  let dmaDevice: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dmaDevice = machine.dmaDevice;
  });

  describe("Port 0x6B Write Operations", () => {
    it("should set DMA mode to zxnDMA when writing to port 0x6B", () => {
      // Initially in zxnDMA mode
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.ZXNDMA);

      // Change to legacy mode
      dmaDevice.setDmaMode(DmaMode.LEGACY);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);

      // Write to port 0x6B should switch back to zxnDMA mode
      machine.portManager.writePort(0x6b, 0xc3); // RESET command
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.ZXNDMA);
    });

    it("should route WR0 commands through port 0x6B", () => {
      // WR0 base byte (transfer, A->B)
      machine.portManager.writePort(0x6b, 0x7d);
      
      // WR0 Port A low
      machine.portManager.writePort(0x6b, 0x34);
      
      // WR0 Port A high
      machine.portManager.writePort(0x6b, 0x12);
      
      // WR0 Length low
      machine.portManager.writePort(0x6b, 0x10);
      
      // WR0 Length high
      machine.portManager.writePort(0x6b, 0x00);

      const registers = dmaDevice.getRegisters();
      expect(registers.portAStartAddress).toBe(0x1234);
      expect(registers.blockLength).toBe(0x0010);
      expect(registers.directionAtoB).toBe(true);
    });

    it("should route WR4 commands through port 0x6B", () => {
      // WR4 base byte (continuous mode)
      machine.portManager.writePort(0x6b, 0xcd);
      
      // WR4 Port B low
      machine.portManager.writePort(0x6b, 0x78);
      
      // WR4 Port B high
      machine.portManager.writePort(0x6b, 0x56);

      const registers = dmaDevice.getRegisters();
      expect(registers.portBStartAddress).toBe(0x5678);
    });

    it("should route RESET command through port 0x6B", () => {
      // Configure some timing
      machine.portManager.writePort(0x6b, 0x7d);
      machine.portManager.writePort(0x6b, 0x34);
      machine.portManager.writePort(0x6b, 0x12);
      machine.portManager.writePort(0x6b, 0x10);
      machine.portManager.writePort(0x6b, 0x00);

      // Reset - note: RESET doesn't clear addresses/lengths, only timing and control flags
      machine.portManager.writePort(0x6b, 0xc3);

      const registers = dmaDevice.getRegisters();
      expect(dmaDevice.getDmaState()).toBe(DmaState.IDLE);
      expect(registers.portATimingCycleLength).toBe(CycleLength.CYCLES_3); // Reset to default
      expect(registers.portBPrescalar).toBe(0);
    });

    it("should route LOAD command through port 0x6B", () => {
      // Configure addresses
      machine.portManager.writePort(0x6b, 0x7d);
      machine.portManager.writePort(0x6b, 0x34);
      machine.portManager.writePort(0x6b, 0x12);
      machine.portManager.writePort(0x6b, 0x10);
      machine.portManager.writePort(0x6b, 0x00);

      machine.portManager.writePort(0x6b, 0xcd);
      machine.portManager.writePort(0x6b, 0x78);
      machine.portManager.writePort(0x6b, 0x56);

      // Load
      machine.portManager.writePort(0x6b, 0xcf);

      const transferState = dmaDevice.getTransferState();
      expect(transferState.sourceAddress).toBe(0x1234);
      expect(transferState.destAddress).toBe(0x5678);
    });

    it("should route ENABLE_DMA command through port 0x6B", () => {
      // Configure and load
      machine.portManager.writePort(0x6b, 0x7d);
      machine.portManager.writePort(0x6b, 0x00);
      machine.portManager.writePort(0x6b, 0x80);
      machine.portManager.writePort(0x6b, 0x04);
      machine.portManager.writePort(0x6b, 0x00);

      machine.portManager.writePort(0x6b, 0xcd);
      machine.portManager.writePort(0x6b, 0x00);
      machine.portManager.writePort(0x6b, 0x90);

      machine.portManager.writePort(0x6b, 0xcf);

      // Enable DMA
      machine.portManager.writePort(0x6b, 0x87);

      const registers = dmaDevice.getRegisters();
      expect(registers.dmaEnabled).toBe(true);
      
      // In zxnDMA mode, counter should start at 0
      const transferState = dmaDevice.getTransferState();
      expect(transferState.byteCounter).toBe(0);
    });
  });

  describe("Port 0x6B Read Operations", () => {
    it("should read initial status byte from port 0x6B", () => {
      const status = machine.portManager.readPort(0x6b);
      
      // Initial state: endOfBlockReached=true, atLeastOneByteTransferred=false
      expect(status).toBe(0x36);
    });

    it("should read status after INITIALIZE_READ_SEQUENCE command", () => {
      // Initialize read sequence
      machine.portManager.writePort(0x6b, 0xa7);
      
      const status = machine.portManager.readPort(0x6b);
      expect(status).toBe(0x36);
    });

    it("should read counter values after configuring read mask", () => {
      // Configure addresses
      machine.portManager.writePort(0x6b, 0x7d);
      machine.portManager.writePort(0x6b, 0x34);
      machine.portManager.writePort(0x6b, 0x12);
      machine.portManager.writePort(0x6b, 0x10);
      machine.portManager.writePort(0x6b, 0x00);

      // READ_MASK_FOLLOWS
      machine.portManager.writePort(0x6b, 0xbb);
      machine.portManager.writePort(0x6b, 0x7f); // Read all

      // INITIALIZE_READ_SEQUENCE
      machine.portManager.writePort(0x6b, 0xa7);

      // Read status
      const status = machine.portManager.readPort(0x6b);
      expect(status).toBe(0x36);

      // Read counter low
      const counterLo = machine.portManager.readPort(0x6b);
      expect(counterLo).toBe(0x00);

      // Read counter high
      const counterHi = machine.portManager.readPort(0x6b);
      expect(counterHi).toBe(0x00);
    });

    it("should read Port A address through port 0x6B", () => {
      // Configure Port A
      machine.portManager.writePort(0x6b, 0x7d);
      machine.portManager.writePort(0x6b, 0x34);
      machine.portManager.writePort(0x6b, 0x12);
      machine.portManager.writePort(0x6b, 0x10);
      machine.portManager.writePort(0x6b, 0x00);

      machine.portManager.writePort(0x6b, 0xcd);
      machine.portManager.writePort(0x6b, 0x00);
      machine.portManager.writePort(0x6b, 0x80);

      // LOAD
      machine.portManager.writePort(0x6b, 0xcf);

      // READ_MASK_FOLLOWS - Port A only
      machine.portManager.writePort(0x6b, 0xbb);
      machine.portManager.writePort(0x6b, 0x18);

      // INITIALIZE_READ_SEQUENCE
      machine.portManager.writePort(0x6b, 0xa7);

      // Read status
      machine.portManager.readPort(0x6b);

      // Read Port A low
      const portALo = machine.portManager.readPort(0x6b);
      expect(portALo).toBe(0x34);

      // Read Port A high
      const portAHi = machine.portManager.readPort(0x6b);
      expect(portAHi).toBe(0x12);
    });
  });

  describe("Complete Transfer via Port 0x6B", () => {
    it("should complete a simple memory-to-memory transfer via port 0x6B", () => {
      // Setup source memory
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      machine.memoryDevice.writeMemory(0x8001, 0x22);
      machine.memoryDevice.writeMemory(0x8002, 0x33);
      machine.memoryDevice.writeMemory(0x8003, 0x44);

      // Configure WR0: Transfer, A->B, Port A address 0x8000, length 4
      machine.portManager.writePort(0x6b, 0x7d);
      machine.portManager.writePort(0x6b, 0x00);
      machine.portManager.writePort(0x6b, 0x80);
      machine.portManager.writePort(0x6b, 0x04);
      machine.portManager.writePort(0x6b, 0x00);

      // Configure WR4: Continuous mode, Port B address 0x9000
      machine.portManager.writePort(0x6b, 0xdd);
      machine.portManager.writePort(0x6b, 0x00);
      machine.portManager.writePort(0x6b, 0x90);

      // LOAD addresses
      machine.portManager.writePort(0x6b, 0xcf);

      // ENABLE_DMA
      machine.portManager.writePort(0x6b, 0x87);

      // Verify configuration before transfer
      const registers = dmaDevice.getRegisters();
      expect(registers.dmaEnabled).toBe(true);
      expect(registers.blockLength).toBe(4);
      expect(registers.transferMode).toBe(1); // CONTINUOUS
      
      const transferState = dmaDevice.getTransferState();
      expect(transferState.sourceAddress).toBe(0x8000);
      expect(transferState.destAddress).toBe(0x9000);

      // Execute transfer
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
      const transferStateAfter = dmaDevice.getTransferState();
      expect(transferStateAfter.byteCounter).toBe(4);
    });

    it("should verify exact length behavior in zxnDMA mode", () => {
      // Setup source memory
      for (let i = 0; i < 10; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, i + 1);
      }

      // Configure transfer with length 5
      machine.portManager.writePort(0x6b, 0x7d);
      machine.portManager.writePort(0x6b, 0x00);
      machine.portManager.writePort(0x6b, 0x80);
      machine.portManager.writePort(0x6b, 0x05);
      machine.portManager.writePort(0x6b, 0x00);

      machine.portManager.writePort(0x6b, 0xdd);
      machine.portManager.writePort(0x6b, 0x00);
      machine.portManager.writePort(0x6b, 0x90);

      machine.portManager.writePort(0x6b, 0xcf);
      machine.portManager.writePort(0x6b, 0x87);

      // Execute transfer
      const bytesTransferred = dmaDevice.executeContinuousTransfer();
      
      // In zxnDMA mode, length is exact (not length+1)
      expect(bytesTransferred).toBe(5);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.ZXNDMA);

      // Verify exactly 5 bytes transferred
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(1);
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(2);
      expect(machine.memoryDevice.readMemory(0x9002)).toBe(3);
      expect(machine.memoryDevice.readMemory(0x9003)).toBe(4);
      expect(machine.memoryDevice.readMemory(0x9004)).toBe(5);
      expect(machine.memoryDevice.readMemory(0x9005)).toBe(0); // Not transferred
    });

    it("should handle burst mode transfers via port 0x6B", () => {
      // Setup source memory
      machine.memoryDevice.writeMemory(0x8000, 0xAA);
      machine.memoryDevice.writeMemory(0x8001, 0xBB);

      // Configure WR0: Transfer, A->B
      machine.portManager.writePort(0x6b, 0x7d);
      machine.portManager.writePort(0x6b, 0x00);
      machine.portManager.writePort(0x6b, 0x80);
      machine.portManager.writePort(0x6b, 0x02);
      machine.portManager.writePort(0x6b, 0x00);

      // Configure WR1: Port A increment mode
      machine.portManager.writePort(0x6b, 0x14);  // WR1: D5-D4=01 (increment), D2-D0=100

      // Configure WR2: Prescalar = 1, Port B increment mode
      machine.portManager.writePort(0x6b, 0x50);  // WR2 base: D6=1 (timing follows), D5-D4=01 (increment)
      machine.portManager.writePort(0x6b, 0x00);  // Timing byte (unused)
      machine.portManager.writePort(0x6b, 0x01);  // Prescalar = 1

      // Configure WR4: Burst mode, Port B
      machine.portManager.writePort(0x6b, 0x8d);
      machine.portManager.writePort(0x6b, 0x00);
      machine.portManager.writePort(0x6b, 0x90);

      machine.portManager.writePort(0x6b, 0xcf);
      machine.portManager.writePort(0x6b, 0x87);

      // Execute burst transfer with enough T-states
      const bytesTransferred = dmaDevice.executeBurstTransfer(1000);
      expect(bytesTransferred).toBe(2);

      // Verify destination
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0xAA);
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(0xBB);
    });
  });

  describe("Mode Persistence", () => {
    it("should maintain zxnDMA mode across multiple operations", () => {
      // Write to port 0x6B
      machine.portManager.writePort(0x6b, 0xc3);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.ZXNDMA);

      // Read from port 0x6B
      machine.portManager.readPort(0x6b);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.ZXNDMA);

      // Configure transfer
      machine.portManager.writePort(0x6b, 0x7d);
      machine.portManager.writePort(0x6b, 0x00);
      machine.portManager.writePort(0x6b, 0x80);
      machine.portManager.writePort(0x6b, 0x01);
      machine.portManager.writePort(0x6b, 0x00);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.ZXNDMA);
    });

    it("should initialize byte counter to 0 in zxnDMA mode", () => {
      // Configure minimal transfer
      machine.portManager.writePort(0x6b, 0x7d);
      machine.portManager.writePort(0x6b, 0x00);
      machine.portManager.writePort(0x6b, 0x80);
      machine.portManager.writePort(0x6b, 0x01);
      machine.portManager.writePort(0x6b, 0x00);

      machine.portManager.writePort(0x6b, 0xcd);
      machine.portManager.writePort(0x6b, 0x00);
      machine.portManager.writePort(0x6b, 0x90);

      machine.portManager.writePort(0x6b, 0xcf);
      machine.portManager.writePort(0x6b, 0x87);

      const transferState = dmaDevice.getTransferState();
      expect(transferState.byteCounter).toBe(0); // zxnDMA starts at 0, not 0xFFFF
    });
  });

  describe("Status Byte via Port 0x6B", () => {
    it("should read correct status byte format via port 0x6B", () => {
      const status = machine.portManager.readPort(0x6b);
      
      // Bits 7-6 must be 0
      expect(status & 0xc0).toBe(0x00);
      
      // Initial state: 0x36 (end of block, no transfer)
      expect(status).toBe(0x36);
    });

    it("should show status changes through port 0x6B after transfer", () => {
      // Setup and execute transfer
      machine.memoryDevice.writeMemory(0x8000, 0xFF);

      machine.portManager.writePort(0x6b, 0x7d);
      machine.portManager.writePort(0x6b, 0x00);
      machine.portManager.writePort(0x6b, 0x80);
      machine.portManager.writePort(0x6b, 0x01);
      machine.portManager.writePort(0x6b, 0x00);

      machine.portManager.writePort(0x6b, 0xdd);
      machine.portManager.writePort(0x6b, 0x00);
      machine.portManager.writePort(0x6b, 0x90);

      machine.portManager.writePort(0x6b, 0xcf);
      machine.portManager.writePort(0x6b, 0x87);

      // Verify DMA is enabled before transferring
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(true);

      dmaDevice.executeContinuousTransfer();

      // Read status via INITIALIZE_READ_SEQUENCE first
      machine.portManager.writePort(0x6b, 0xa7);
      const status = machine.portManager.readPort(0x6b);
      expect(status).toBe(0x37);
    });
  });
});
