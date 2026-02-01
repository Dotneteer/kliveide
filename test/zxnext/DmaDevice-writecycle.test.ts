import { describe, it, expect, beforeEach } from "vitest";
import { TestZxNextMachine } from "./TestNextMachine";
import { DmaDevice } from "@emu/machines/zxNext/DmaDevice";
import { AddressMode } from "@emu/machines/zxNext/dma-helpers";

describe("DmaDevice - Step 11: Memory/IO Write Cycle", () => {
  let machine: TestZxNextMachine;
  let dma: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dma = machine.dmaDevice;
  });

  describe("Memory Write Operations", () => {
    it("should write to memory address in A->B direction", () => {
      // Configure Port B as memory destination (A->B)
      dma.writeWR0(0x7D); // A->B (bit 6=1)
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x50); // Port B is memory, increment
      
      // Set transfer data byte and destination
      dma.setDestAddress(0x5000);
      const testData = 0x42;
      dma["_transferDataByte"] = testData;
      
      // Perform write cycle
      dma.performWriteCycle();
      
      // Verify memory was written
      const written = machine.memoryDevice.readMemory(0x5000);
      expect(written).toBe(testData);
    });

    it("should write to memory address in B->A direction", () => {
      // Configure Port A as memory destination (B->A)
      dma.writeWR0(0x39); // B->A (bit 6=0)
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR1(0x10); // Port A is memory, increment
      
      // Set transfer data byte and source (which is dest in B->A)
      dma.setSourceAddress(0x4000);
      const testData = 0xAA;
      dma["_transferDataByte"] = testData;
      
      // Perform write cycle
      dma.performWriteCycle();
      
      // Verify memory was written
      const written = machine.memoryDevice.readMemory(0x4000);
      expect(written).toBe(testData);
    });

    it("should write sequential memory addresses", () => {
      // Configure A->B with increment
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x04);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x50); // Port B memory, increment
      
      dma.setDestAddress(0x5000);
      
      // Write multiple bytes
      for (let i = 0; i < 4; i++) {
        dma["_transferDataByte"] = 0x10 + i;
        dma.performWriteCycle();
      }
      
      // Verify all bytes were written
      expect(machine.memoryDevice.readMemory(0x5000)).toBe(0x10);
      expect(machine.memoryDevice.readMemory(0x5001)).toBe(0x11);
      expect(machine.memoryDevice.readMemory(0x5002)).toBe(0x12);
      expect(machine.memoryDevice.readMemory(0x5003)).toBe(0x13);
    });

    it("should handle writing to low memory address", () => {
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x50);
      
      dma.setDestAddress(0x4001);
      dma["_transferDataByte"] = 0x99;
      
      dma.performWriteCycle();
      
      expect(machine.memoryDevice.readMemory(0x4001)).toBe(0x99);
    });

    it("should handle writing to address 0xFFFF", () => {
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x50);
      
      dma.setDestAddress(0xFFFF);
      dma["_transferDataByte"] = 0x88;
      
      dma.performWriteCycle();
      
      expect(machine.memoryDevice.readMemory(0xFFFF)).toBe(0x88);
    });
  });

  describe("IO Port Write Operations", () => {
    it("should write to IO port in A->B direction", () => {
      // Configure Port B as IO destination
      dma.writeWR0(0x7D); // A->B
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x48); // Port B is IO (bit 3=1), increment (bits 5-4=01)
      
      dma.setDestAddress(0x001F); // Kempston joystick port
      dma["_transferDataByte"] = 0xFF;
      
      dma.performWriteCycle();
      
      // Verify write completed without error (IO ports don't store values for readback)
      expect(dma.getTransferState().byteCounter).toBeGreaterThan(0);
    });

    it("should write to IO port in B->A direction", () => {
      // Configure Port A as IO destination
      dma.writeWR0(0x39); // B->A
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR1(0x18); // Port A is IO (bit 3=1), increment (bits 5-4=01)
      
      dma.setSourceAddress(0x00FE); // ULA port
      dma["_transferDataByte"] = 0x07;
      
      dma.performWriteCycle();
      
      // Verify write completed without error (IO ports don't store values for readback)
      expect(dma.getTransferState().byteCounter).toBeGreaterThan(0);
    });

    it("should distinguish between memory and IO writes", () => {
      // Memory write
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x50); // Memory, increment
      
      dma.setDestAddress(0x5000);
      dma["_transferDataByte"] = 0xAB;
      dma.performWriteCycle();
      
      expect(machine.memoryDevice.readMemory(0x5000)).toBe(0xAB);
      
      // IO write
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x48); // IO (bit 3=1), increment (bits 5-4=01)
      
      dma.setDestAddress(0x001F);
      dma["_transferDataByte"] = 0xCD;
      dma.performWriteCycle();
      
      // Verify write completed without error (IO ports don't store values for readback)
      expect(dma.getTransferState().byteCounter).toBeGreaterThan(0);
    });
  });

  describe("Address Mode Updates", () => {
    it("should increment destination address in A->B direction", () => {
      dma.writeWR0(0x7D); // A->B
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x50); // Port B memory, increment
      
      const startAddr = 0x5000;
      dma.setDestAddress(startAddr);
      dma["_transferDataByte"] = 0x11;
      
      dma.performWriteCycle();
      
      const transferState = dma.getTransferState();
      expect(transferState.destAddress).toBe(startAddr + 1);
    });

    it("should decrement destination address", () => {
      dma.writeWR0(0x7D); // A->B
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x40); // Port B memory, decrement
      
      const startAddr = 0x5000;
      dma.setDestAddress(startAddr);
      dma["_transferDataByte"] = 0x22;
      
      dma.performWriteCycle();
      
      const transferState = dma.getTransferState();
      expect(transferState.destAddress).toBe(startAddr - 1);
    });

    it("should keep destination address fixed", () => {
      dma.writeWR0(0x7D); // A->B
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x60); // Port B memory, fixed
      
      const startAddr = 0x5000;
      dma.setDestAddress(startAddr);
      dma["_transferDataByte"] = 0x33;
      
      dma.performWriteCycle();
      
      const transferState = dma.getTransferState();
      expect(transferState.destAddress).toBe(startAddr); // Unchanged
    });

    it("should increment source address in A->B direction", () => {
      dma.writeWR0(0x7D); // A->B
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR1(0x10); // Port A memory (bit 3=0), increment (bits 5-4=01)
      dma.writeWR2(0x50); // Port B memory (bit 3=0), increment (bits 5-4=01)
      
      const startSourceAddr = 0x4000;
      dma.setSourceAddress(startSourceAddr);
      dma.setDestAddress(0x5000);
      dma["_transferDataByte"] = 0x44;
      
      dma.performWriteCycle();
      
      const transferState = dma.getTransferState();
      expect(transferState.sourceAddress).toBe(startSourceAddr + 1);
    });

    it("should handle address wraparound at 0xFFFF", () => {
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x50); // Increment
      
      dma.setDestAddress(0xFFFF);
      dma["_transferDataByte"] = 0x55;
      
      dma.performWriteCycle();
      
      const transferState = dma.getTransferState();
      expect(transferState.destAddress).toBe(0x0000); // Wrapped
    });

    it("should handle address wraparound at 0x0000 with decrement", () => {
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x40); // Decrement
      
      dma.setDestAddress(0x0000);
      dma["_transferDataByte"] = 0x66;
      
      dma.performWriteCycle();
      
      const transferState = dma.getTransferState();
      expect(transferState.destAddress).toBe(0xFFFF); // Wrapped
    });
  });

  describe("Byte Counter Updates", () => {
    it("should increment byte counter after write", () => {
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x50);
      dma.writeWR6(0xCF); // LOAD to initialize counter
      
      const initialCounter = dma.getTransferState().byteCounter;
      
      dma.setDestAddress(0x5000);
      dma["_transferDataByte"] = 0x77;
      
      dma.performWriteCycle();
      
      const transferState = dma.getTransferState();
      expect(transferState.byteCounter).toBe(initialCounter + 1);
    });

    it("should increment counter on each write", () => {
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x04);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x50);
      dma.writeWR6(0xCF); // LOAD
      
      const initialCounter = dma.getTransferState().byteCounter;
      
      dma.setDestAddress(0x5000);
      
      for (let i = 0; i < 4; i++) {
        dma["_transferDataByte"] = 0x10 + i;
        dma.performWriteCycle();
      }
      
      const transferState = dma.getTransferState();
      expect(transferState.byteCounter).toBe(initialCounter + 4);
    });

    it("should handle counter overflow at 65536", () => {
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x60);
      dma.writeWR6(0xCF); // LOAD
      
      // Manually set counter near overflow
      dma["transferState"].byteCounter = 65535;
      
      dma.setDestAddress(0x5000);
      dma["_transferDataByte"] = 0x88;
      
      dma.performWriteCycle();
      
      const transferState = dma.getTransferState();
      // Counter is 16-bit, so 65535+1 wraps to 0
      expect(transferState.byteCounter).toBe(0);
    });
  });

  describe("Mixed Direction and Mode Tests", () => {
    it("should handle B->A transfer with increment", () => {
      // B->A: Port B is source, Port A is destination
      dma.writeWR0(0x39); // B->A
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR1(0x10); // Port A memory, increment
      dma.writeWR2(0x50); // Port B memory, increment
      
      const startDestAddr = 0x4000;
      dma.setSourceAddress(startDestAddr);
      dma.setDestAddress(0x5000);
      dma["_transferDataByte"] = 0x99;
      
      dma.performWriteCycle();
      
      // In B->A, sourceAddress is the destination
      expect(machine.memoryDevice.readMemory(startDestAddr)).toBe(0x99);
      
      const transferState = dma.getTransferState();
      expect(transferState.sourceAddress).toBe(startDestAddr + 1);
    });

    it("should update both addresses in A->B transfer", () => {
      dma.writeWR0(0x7D); // A->B
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR1(0x10); // Port A increment
      dma.writeWR2(0x50); // Port B increment
      
      const startSourceAddr = 0x4000;
      const startDestAddr = 0x5000;
      
      dma.setSourceAddress(startSourceAddr);
      dma.setDestAddress(startDestAddr);
      dma["_transferDataByte"] = 0xAB;
      
      dma.performWriteCycle();
      
      const transferState = dma.getTransferState();
      expect(transferState.sourceAddress).toBe(startSourceAddr + 1);
      expect(transferState.destAddress).toBe(startDestAddr + 1);
    });

    it("should handle mixed address modes (increment source, fixed dest)", () => {
      dma.writeWR0(0x7D); // A->B
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR1(0x10); // Port A increment
      dma.writeWR2(0x60); // Port B fixed
      
      const startSourceAddr = 0x4000;
      const startDestAddr = 0x5000;
      
      dma.setSourceAddress(startSourceAddr);
      dma.setDestAddress(startDestAddr);
      dma["_transferDataByte"] = 0xCD;
      
      dma.performWriteCycle();
      
      const transferState = dma.getTransferState();
      expect(transferState.sourceAddress).toBe(startSourceAddr + 1);
      expect(transferState.destAddress).toBe(startDestAddr); // Fixed
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    it("should handle writing zero value", () => {
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x50);
      
      dma.setDestAddress(0x5000);
      dma["_transferDataByte"] = 0x00;
      
      dma.performWriteCycle();
      
      expect(machine.memoryDevice.readMemory(0x5000)).toBe(0x00);
    });

    it("should handle writing 0xFF value", () => {
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x50);
      
      dma.setDestAddress(0x5000);
      dma["_transferDataByte"] = 0xFF;
      
      dma.performWriteCycle();
      
      expect(machine.memoryDevice.readMemory(0x5000)).toBe(0xFF);
    });

    it("should handle consecutive writes to same address (fixed mode)", () => {
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x60); // Fixed
      
      dma.setDestAddress(0x5000);
      
      dma["_transferDataByte"] = 0x11;
      dma.performWriteCycle();
      expect(machine.memoryDevice.readMemory(0x5000)).toBe(0x11);
      
      dma["_transferDataByte"] = 0x22;
      dma.performWriteCycle();
      expect(machine.memoryDevice.readMemory(0x5000)).toBe(0x22); // Overwritten
    });

    it("should overwrite previous memory value", () => {
      // Pre-fill memory
      machine.memoryDevice.writeMemory(0x5000, 0xAA);
      
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x50);
      
      dma.setDestAddress(0x5000);
      dma["_transferDataByte"] = 0x55;
      
      dma.performWriteCycle();
      
      expect(machine.memoryDevice.readMemory(0x5000)).toBe(0x55);
    });
  });

  describe("Complete Read-Write Cycle Integration", () => {
    it("should perform complete read-write cycle", () => {
      // Set up source data
      machine.memoryDevice.writeMemory(0x4000, 0xDE);
      
      // Configure A->B transfer
      dma.writeWR0(0x7D); // A->B
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR1(0x64); // Port A memory, increment
      dma.writeWR2(0x60); // Port B memory, increment
      
      dma.setSourceAddress(0x4000);
      dma.setDestAddress(0x5000);
      
      // Perform read then write
      const data = dma.performReadCycle();
      expect(data).toBe(0xDE);
      
      dma.performWriteCycle();
      
      // Verify data was copied
      expect(machine.memoryDevice.readMemory(0x5000)).toBe(0xDE);
    });

    it("should perform multiple read-write cycles", () => {
      // Set up source data
      for (let i = 0; i < 4; i++) {
        machine.memoryDevice.writeMemory(0x4000 + i, 0x10 + i);
      }
      
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x04);
      dma.writeWR0(0x00);
      
      dma.writeWR1(0x10);
      dma.writeWR2(0x50);
      
      dma.setSourceAddress(0x4000);
      dma.setDestAddress(0x5000);
      
      // Perform 4 complete cycles
      for (let i = 0; i < 4; i++) {
        dma.performReadCycle();
        dma.performWriteCycle();
      }
      
      // Verify all data was copied
      expect(machine.memoryDevice.readMemory(0x5000)).toBe(0x10);
      expect(machine.memoryDevice.readMemory(0x5001)).toBe(0x11);
      expect(machine.memoryDevice.readMemory(0x5002)).toBe(0x12);
      expect(machine.memoryDevice.readMemory(0x5003)).toBe(0x13);
    });
  });
});
