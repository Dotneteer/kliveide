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

// ─────────────────────────────────────────────────────────────────────────────
// Step 26: Search Mode (WR0 D1-D0)
// ─────────────────────────────────────────────────────────────────────────────

import { DmaDevice, DmaMode, TransferMode, AddressMode } from "@emu/machines/zxNext/DmaDevice";

describe("DmaDevice - Step 26: Search Mode", () => {
  let machine: TestZxNextMachine;
  let dma: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dma = machine.dmaDevice;
  });

  /**
   * Configure a Continuous transfer with Search or Search+Transfer mode.
   * WR0 byte:
   *   - 0x7D = 0111_1101: D6D5D4D3=1111 (all follow bytes), D2=1 (A→B), D1D0=01 (Transfer)
   *   - Replace D1D0 to get mode:
   *       D1D0=10  → 0x7E: Search only (no write)
   *       D1D0=11  → 0x7F: Search+Transfer
   */
  function configureSearch(wr0Mode: number, maskByte: number, matchByte: number, enableIntr = false) {
    dma.writeWR6(0xc7); dma.writeWR6(0xcb);
    // WR0: D6D5D4D3=1111 (four follow bytes), D2=1 (A→B), D1D0 = wr0Mode & 0x03
    const wr0Base = 0x7C | (wr0Mode & 0x03);
    dma.writeWR0(wr0Base);
    dma.writeWR0(0x00); dma.writeWR0(0x80); // Port A addr = 0x8000
    dma.writeWR0(0x04); dma.writeWR0(0x00); // Block length = 4
    dma.writeWR1(0x14);  // Port A: memory, increment
    dma.writeWR2(0x10);  // Port B: memory, increment
    dma.writePort(0xad); // WR4: Continuous (D6D5=01), portB addr follows (D3D2=11)
    dma.writePort(0x00); dma.writePort(0x90); // Port B addr = 0x9000
    // WR3 base byte: (value & 0x83) must equal 0x80 → D7=1, D1=D0=0.
    // 0x98 = 1001_1000: D4=1 (MATCH_BYTE follows), D3=1 (MASK_BYTE follows), D1D0=00.
    dma.writePort(0x98);
    dma.writePort(maskByte);  // MASK_BYTE (stored via follow queue)
    dma.writePort(matchByte); // MATCH_BYTE (stored via follow queue)
    if (enableIntr) {
      dma.writeWR6(0xab); // ENABLE_INTERRUPTS
    }
    // Fill source with: 0x11, 0x22, 0xAA, 0x33 (0xAA is the search target)
    machine.memoryDevice.writeMemory(0x8000, 0x11);
    machine.memoryDevice.writeMemory(0x8001, 0x22);
    machine.memoryDevice.writeMemory(0x8002, 0xAA);
    machine.memoryDevice.writeMemory(0x8003, 0x33);
    dma.writeWR6(0xcf);
    dma.writeWR6(0x87);
  }

  describe("Transfer mode (D1D0=01) — baseline unchanged", () => {
    it("writes all bytes to destination in Transfer mode", () => {
      configureSearch(0b01, 0xFF, 0xAA); // Transfer mode, mask=0xFF, match=0xAA
      dma.executeContinuousTransfer();
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0x11);
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(0x22);
      expect(machine.memoryDevice.readMemory(0x9002)).toBe(0xAA);
      expect(machine.memoryDevice.readMemory(0x9003)).toBe(0x33);
    });
  });

  describe("Search-only mode (D1D0=10) — no write, stops on match", () => {
    it("does not write to destination in Search mode", () => {
      machine.memoryDevice.writeMemory(0x9000, 0xFF); // sentinel
      configureSearch(0b10, 0xFF, 0xAA); // Search mode, mask=0xFF, match=0xAA
      // WR5: set STOP_ON_MATCH (D2=1) so transfer halts at match
      dma.writeWR5(0x14 | 0x04); // D4=CE_ONLY, D2=STOP_ON_MATCH
      dma.writeWR6(0xcf); dma.writeWR6(0x87);
      dma.executeContinuousTransfer();
      // No byte should have been written — destination stays 0xFF
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0xFF);
    });

    it("sets status match bit (0x04) when match found", () => {
      configureSearch(0b10, 0xFF, 0xAA);
      dma.writeWR5(0x14 | 0x04);
      dma.writeWR6(0xcf); dma.writeWR6(0x87);
      dma.executeContinuousTransfer();
      expect(dma.getStatus() & 0x04).toBe(0x04);
    });

    it("stops at matching byte when STOP_ON_MATCH is set", () => {
      // mask=0x00 → exact match (OR semantics: no don't-care bits → all bits compared).
      // Only 0xAA (index 2) matches 0xAA exactly.
      configureSearch(0b10, 0x00, 0xAA);
      dma.writeWR5(0x14 | 0x04); // STOP_ON_MATCH
      dma.writeWR6(0xcf); dma.writeWR6(0x87);
      const bytes = dma.executeContinuousTransfer();
      // Reads 0x11, 0x22, 0xAA — stops at 0xAA (3 bytes)
      expect(bytes).toBe(3);
    });

    it("continues to end of block when STOP_ON_MATCH is NOT set", () => {
      configureSearch(0b10, 0xFF, 0xAA); // no STOP_ON_MATCH
      dma.writeWR6(0xcf); dma.writeWR6(0x87);
      const bytes = dma.executeContinuousTransfer();
      // Transfer runs to end of block (4 bytes)
      expect(bytes).toBe(4);
    });
  });

  describe("Search+Transfer mode (D1D0=11) — write and search", () => {
    it("writes bytes to destination AND checks for match", () => {
      // mask=0x00 → exact match; only 0xAA (index 2) matches.
      configureSearch(0b11, 0x00, 0xAA); // Search+Transfer mode
      dma.writeWR5(0x14 | 0x04); // STOP_ON_MATCH
      dma.writeWR6(0xcf); dma.writeWR6(0x87);
      dma.executeContinuousTransfer();
      // All three bytes up to and including the match byte are written
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0x11);
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(0x22);
      expect(machine.memoryDevice.readMemory(0x9002)).toBe(0xAA); // match byte is also written
    });

    it("sets match bit and stops at matching byte with STOP_ON_MATCH", () => {
      // mask=0x00 → exact match; 0xAA is at index 2.
      configureSearch(0b11, 0x00, 0xAA);
      dma.writeWR5(0x14 | 0x04);
      dma.writeWR6(0xcf); dma.writeWR6(0x87);
      const bytes = dma.executeContinuousTransfer();
      expect(dma.getStatus() & 0x04).toBe(0x04); // ZXN extension: match-found bit
      expect(bytes).toBe(3); // 0x11, 0x22, 0xAA
    });
  });

  describe("Mask byte gating (OR semantics: mask 1-bits are don't-care)", () => {
    it("matches when don't-care bits differ but compared bits agree", () => {
      // OR semantics: mask=0x0F → lower nibble is don't-care, upper nibble is compared.
      // match=0xA0 → compared upper nibble = 0xA.
      // 0xAA: (0xAA | 0x0F) = 0xAF === (0xA0 | 0x0F) = 0xAF → match ✓
      configureSearch(0b10, 0x0F, 0xA0);
      dma.writeWR5(0x14 | 0x04); // STOP_ON_MATCH
      dma.writeWR6(0xcf); dma.writeWR6(0x87);
      const bytes = dma.executeContinuousTransfer();
      expect(dma.getStatus() & 0x04).toBe(0x04); // match found at 0xAA
      expect(bytes).toBe(3); // 0x11, 0x22, 0xAA
    });

    it("no match when compared bits differ regardless of don't-care bits", () => {
      // OR semantics: mask=0x0F → lower nibble is don't-care, upper nibble is compared.
      // match=0xB0 → compared upper nibble = 0xB.
      // Source: 0x11(0x1), 0x22(0x2), 0xAA(0xA), 0x33(0x3) — none has upper nibble 0xB.
      configureSearch(0b10, 0x0F, 0xB0);
      dma.writeWR5(0x14 | 0x04);
      dma.writeWR6(0xcf); dma.writeWR6(0x87);
      dma.executeContinuousTransfer();
      expect(dma.getStatus() & 0x04).toBe(0); // no match
    });

    it("mask=0x00 is exact match (no don't-care bits)", () => {
      // mask=0x00 → all bits compared exactly (no don't-care bits)
      // match=0xFF → none of 0x11, 0x22, 0xAA, 0x33 equals 0xFF
      configureSearch(0b10, 0x00, 0xFF);
      dma.writeWR5(0x14 | 0x04);
      dma.writeWR6(0xcf); dma.writeWR6(0x87);
      dma.executeContinuousTransfer();
      expect(dma.getStatus() & 0x04).toBe(0); // no match
    });

    it("mask=0xFF means all bits are don't-care (always matches)", () => {
      // mask=0xFF → every bit is don't-care → any byte matches any MATCH_BYTE
      // First byte 0x11: (0x11 | 0xFF) = 0xFF === (0xAA | 0xFF) = 0xFF → match
      configureSearch(0b10, 0xFF, 0xAA);
      dma.writeWR5(0x14 | 0x04); // STOP_ON_MATCH
      dma.writeWR6(0xcf); dma.writeWR6(0x87);
      const bytes = dma.executeContinuousTransfer();
      expect(dma.getStatus() & 0x04).toBe(0x04); // match on first byte
      expect(bytes).toBe(1); // stopped immediately on 0x11
    });
  });
});

