import { describe, it, expect, beforeEach } from "vitest";
import { DmaDevice, AddressMode } from "@emu/machines/zxNext/DmaDevice";
import { TestZxNextMachine } from "./TestNextMachine";

describe("DmaDevice - Step 10: Memory/IO Read Cycle", () => {
  let machine: TestZxNextMachine;
  let dma: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dma = machine.dmaDevice;
  });

  describe("Memory Read Operations", () => {
    it("should read from memory address in A->B direction", () => {
      // Set up memory at address 0x4000
      machine.memoryDevice.writeMemory(0x4000, 0x42);
      
      // Configure Port A as memory source
      dma.writeWR0(0x7D); // A->B, transfer from A
      dma.writeWR0(0x00); // Port A low = 0x00
      dma.writeWR0(0x40); // Port A high = 0x40 (address 0x4000)
      dma.writeWR0(0x01); // Block length = 1
      dma.writeWR0(0x00);
      
      // Set source address in transfer state
      const transferState = dma.getTransferState();
      dma.setSourceAddress(0x4000);
      
      // Perform read cycle
      const data = dma.performReadCycle();
      
      expect(data).toBe(0x42);
      expect(dma.getTransferDataByte()).toBe(0x42);
    });

    it("should read from memory address in B->A direction", () => {
      // Set up memory at address 0x5000
      machine.memoryDevice.writeMemory(0x5000, 0xAA);
      
      // Configure Port B as memory source (B->A)
      dma.writeWR0(0x39); // B->A (bit 6=0), transfer from B
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x60); // Port B is memory (bit 3=0)
      
      dma.writeWR4(0x85); // Port B address
      dma.writeWR4(0x00); // Port B low = 0x00
      dma.writeWR4(0x50); // Port B high = 0x50 (address 0x5000)
      
      // Set destination address (which is source in B->A)
      const transferState = dma.getTransferState();
      dma.setDestAddress(0x5000);
      
      // Perform read cycle
      const data = dma.performReadCycle();
      
      expect(data).toBe(0xAA);
    });

    it("should read sequential memory addresses", () => {
      // Set up memory pattern
      for (let i = 0; i < 4; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, 0x10 + i);
      }
      
      // Configure Port A
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x80);
      dma.writeWR0(0x04);
      dma.writeWR0(0x00);
      
      const transferState = dma.getTransferState();
      
      // Read multiple bytes
      for (let i = 0; i < 4; i++) {
        dma.setSourceAddress(0x8000 + i);
        const data = dma.performReadCycle();
        expect(data).toBe(0x10 + i);
      }
    });

    it("should handle reading from low memory address", () => {
      machine.memoryDevice.writeMemory(0x4001, 0xFF);
      
      dma.writeWR0(0x7D);
      dma.writeWR0(0x01);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.setSourceAddress(0x4001);
      const data = dma.performReadCycle();
      
      expect(data).toBe(0xFF);
    });

    it("should handle reading from address 0xFFFF", () => {
      machine.memoryDevice.writeMemory(0xFFFF, 0x55);
      
      dma.writeWR0(0x7D);
      dma.writeWR0(0xFF);
      dma.writeWR0(0xFF);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.setSourceAddress(0xFFFF);
      const data = dma.performReadCycle();
      
      expect(data).toBe(0x55);
    });
  });

  describe("IO Port Read Operations", () => {
    it("should read from IO port in A->B direction", () => {
      // Configure Port A as IO source
      dma.writeWR0(0x7D);
      dma.writeWR0(0xFE); // Port 0xFE (ULA border)
      dma.writeWR0(0x00);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      // Configure WR1 with IO flag set
      dma.writeWR1(0x68); // Port A is IO (bit 3=1)
      
      dma.setSourceAddress(0xFE);
      
      // Perform read (will read from ULA port)
      const data = dma.performReadCycle();
      
      // Data should be valid (exact value depends on ULA state)
      expect(typeof data).toBe("number");
      expect(data).toBeGreaterThanOrEqual(0);
      expect(data).toBeLessThanOrEqual(0xFF);
    });

    it("should read from IO port in B->A direction", () => {
      // Configure Port B as IO source (B->A)
      dma.writeWR0(0x79); // B->A
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x68); // Port B is IO (bit 3=1)
      
      dma.writeWR4(0x85);
      dma.writeWR4(0xFE); // Port 0xFE
      dma.writeWR4(0x00);
      
      dma.setDestAddress(0xFE);
      
      const data = dma.performReadCycle();
      
      expect(typeof data).toBe("number");
      expect(data).toBeGreaterThanOrEqual(0);
      expect(data).toBeLessThanOrEqual(0xFF);
    });

    it("should distinguish between memory and IO reads", () => {
      // Set up memory value
      machine.memoryDevice.writeMemory(0x4000, 0x12);
      
      // First read as memory
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR1(0x60); // Port A is memory (bit 3=0)
      dma.setSourceAddress(0x4000);
      
      const memoryData = dma.performReadCycle();
      expect(memoryData).toBe(0x12);
      
      // Now configure as IO and read
      dma.writeWR1(0x68); // Port A is IO (bit 3=1)
      dma.setSourceAddress(0xFE);
      
      const ioData = dma.performReadCycle();
      // IO data will be different from memory
      expect(typeof ioData).toBe("number");
    });
  });

  describe("Read Cycle with Different Address Modes", () => {
    it("should read with increment address mode", () => {
      // Set up memory
      machine.memoryDevice.writeMemory(0x6000, 0x01);
      machine.memoryDevice.writeMemory(0x6001, 0x02);
      
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x60);
      dma.writeWR0(0x02);
      dma.writeWR0(0x00);
      
      // WR1: increment mode (bits 5-4 = 01)
      dma.writeWR1(0x74); // Increment
      
      const transferState = dma.getTransferState();
      dma.setSourceAddress(0x6000);
      
      expect(dma.performReadCycle()).toBe(0x01);
      
      dma.setSourceAddress(0x6001);
      expect(dma.performReadCycle()).toBe(0x02);
    });

    it("should read with fixed address mode", () => {
      // Set up IO port (fixed address typical for IO)
      dma.writeWR0(0x7D);
      dma.writeWR0(0x1F); // Kempston joystick port
      dma.writeWR0(0x00);
      dma.writeWR0(0x02);
      dma.writeWR0(0x00);
      
      // WR1: fixed mode (bits 5-4 = 10), IO (bit 3 = 1)
      dma.writeWR1(0x78); // Fixed + IO
      
      const transferState = dma.getTransferState();
      dma.setSourceAddress(0x1F);
      
      // Read twice from same address
      const data1 = dma.performReadCycle();
      const data2 = dma.performReadCycle();
      
      // Both should be valid reads from same port
      expect(typeof data1).toBe("number");
      expect(typeof data2).toBe("number");
    });
  });

  describe("Transfer State Integration", () => {
    it("should use transfer state source address correctly", () => {
      machine.memoryDevice.writeMemory(0x7000, 0x33);
      machine.memoryDevice.writeMemory(0x7100, 0x44);
      
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x70);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      const transferState = dma.getTransferState();
      
      // Read from first address
      dma.setSourceAddress(0x7000);
      expect(dma.performReadCycle()).toBe(0x33);
      
      // Change address and read again
      dma.setSourceAddress(0x7100);
      expect(dma.performReadCycle()).toBe(0x44);
    });

    it("should store data in transfer data byte", () => {
      machine.memoryDevice.writeMemory(0x9000, 0x99);
      
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x90);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.setSourceAddress(0x9000);
      dma.performReadCycle();
      
      // Verify data is stored in transfer data byte
      expect(dma.getTransferDataByte()).toBe(0x99);
    });

    it("should preserve data byte across multiple calls", () => {
      machine.memoryDevice.writeMemory(0xA000, 0x77);
      
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0xA0);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.setSourceAddress(0xA000);
      dma.performReadCycle();
      
      // Data byte should remain until next read
      expect(dma.getTransferDataByte()).toBe(0x77);
      expect(dma.getTransferDataByte()).toBe(0x77);
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    it("should handle reading zero value", () => {
      machine.memoryDevice.writeMemory(0x5000, 0x00);
      
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x50);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.setSourceAddress(0x5000);
      const data = dma.performReadCycle();
      
      expect(data).toBe(0x00);
    });

    it("should handle reading 0xFF value", () => {
      machine.memoryDevice.writeMemory(0x5000, 0xFF);
      
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x50);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.setSourceAddress(0x5000);
      const data = dma.performReadCycle();
      
      expect(data).toBe(0xFF);
    });

    it("should handle consecutive reads without address change", () => {
      machine.memoryDevice.writeMemory(0x6000, 0xCC);
      
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x60);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.setSourceAddress(0x6000);
      
      // Read same address multiple times
      expect(dma.performReadCycle()).toBe(0xCC);
      expect(dma.performReadCycle()).toBe(0xCC);
      expect(dma.performReadCycle()).toBe(0xCC);
    });

    it("should handle direction changes", () => {
      machine.memoryDevice.writeMemory(0x4000, 0x11);
      machine.memoryDevice.writeMemory(0x5000, 0x22);
      
      // First A->B
      dma.writeWR0(0x7D); // A->B (bit 6=1)
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.setSourceAddress(0x4000);
      expect(dma.performReadCycle()).toBe(0x11);
      
      // Now B->A
      dma.writeWR0(0x39); // B->A (bit 6=0)
      dma.writeWR0(0x00);
      dma.writeWR0(0x40);
      dma.writeWR0(0x01);
      dma.writeWR0(0x00);
      
      dma.writeWR2(0x60); // Port B is memory
      
      dma.writeWR4(0x85);
      dma.writeWR4(0x00);
      dma.writeWR4(0x50);
      
      dma.setDestAddress(0x5000);
      expect(dma.performReadCycle()).toBe(0x22);
    });
  });

  describe("Multiple Read Operations", () => {
    it("should handle rapid sequential reads", () => {
      // Set up pattern in memory
      for (let i = 0; i < 16; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, i * 16);
      }
      
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0x80);
      dma.writeWR0(0x10);
      dma.writeWR0(0x00);
      
      const transferState = dma.getTransferState();
      
      // Read all 16 bytes rapidly
      for (let i = 0; i < 16; i++) {
        dma.setSourceAddress(0x8000 + i);
        const data = dma.performReadCycle();
        expect(data).toBe(i * 16);
      }
    });

    it("should maintain data integrity across reads", () => {
      const testValues = [0x00, 0x55, 0xAA, 0xFF, 0x12, 0x34, 0x56, 0x78];
      
      testValues.forEach((value, index) => {
        const address = 0xC000 + index;
        machine.memoryDevice.writeMemory(address, value);
      });
      
      dma.writeWR0(0x7D);
      dma.writeWR0(0x00);
      dma.writeWR0(0xC0);
      dma.writeWR0(0x08);
      dma.writeWR0(0x00);
      
      const transferState = dma.getTransferState();
      
      testValues.forEach((expected, index) => {
        dma.setSourceAddress(0xC000 + index);
        const data = dma.performReadCycle();
        expect(data).toBe(expected);
      });
    });
  });
});
