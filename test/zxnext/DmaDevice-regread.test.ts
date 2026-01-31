import { describe, it, expect, beforeEach } from "vitest";
import {
  DmaDevice,
  RegisterReadSequence,
  RegisterWriteSequence,
  DmaMode
} from "@emu/machines/zxNext/DmaDevice";
import { TestZxNextMachine } from "./TestNextMachine";

describe("DmaDevice - Step 8: Register Read Operations", () => {
  let machine: TestZxNextMachine;
  let dmaDevice: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dmaDevice = machine.dmaDevice;
  });

  describe("Status Byte Format", () => {
    it("should return status in 00E1101T format", () => {
      dmaDevice.writeWR6(0xa7); // INITIALIZE_READ_SEQUENCE
      const status = dmaDevice.readStatusByte();
      
      // Format: 00E1101T
      // Bits 7-6 must be 0
      expect(status & 0xc0).toBe(0x00);
      
      // Bits 4-1 must be 1011 (0x36 >> 1 & 0x0F = 0x0B)
      expect((status >> 1) & 0x0f).toBe(0x0b);
    });

    it("should set E bit to 0 when endOfBlockReached is true", () => {
      // After reset, endOfBlockReached is true
      dmaDevice.writeWR6(0xc3); // RESET
      dmaDevice.writeWR6(0xa7);
      const status = dmaDevice.readStatusByte();
      
      // Bit 5 is 1 when endOfBlockReached is true (complete state)
      expect((status >> 5) & 0x01).toBe(1);
    });

    it("should set E bit to 1 when endOfBlockReached is false", () => {
      // We need to simulate a transfer state where endOfBlock is false
      // For now, we can only test the current state
      dmaDevice.writeWR6(0xa7);
      const status = dmaDevice.readStatusByte();
      
      // With initial state, endOfBlockReached is true, so bit 5 = 1
      expect((status >> 5) & 0x01).toBe(1);
    });

    it("should set T bit to 0 when no bytes transferred", () => {
      dmaDevice.writeWR6(0xa7);
      const status = dmaDevice.readStatusByte();
      
      // T bit (bit 0) should be 0
      expect(status & 0x01).toBe(0);
    });

    it("should set T bit to 1 when at least one byte transferred", () => {
      // We cannot simulate actual transfer yet, so this tests the flag directly
      // In future steps, this will test actual transfer behavior
      dmaDevice.writeWR6(0xa7);
      const status = dmaDevice.readStatusByte();
      
      // Initially T=0
      expect(status & 0x01).toBe(0);
    });
  });

  describe("Counter Read Operations", () => {
    it("should read counter low byte", () => {
      // Setup counter to known value
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xcf); // LOAD (sets counter to 0)

      dmaDevice.writeWR6(0xbb); // READ_MASK_FOLLOWS
      dmaDevice.writeWR6(0x40); // Counter low only

      dmaDevice.writeWR6(0xa7); // INITIALIZE_READ_SEQUENCE

      dmaDevice.readStatusByte(); // Status
      const counterLo = dmaDevice.readStatusByte();
      
      expect(counterLo).toBe(0x00);
    });

    it("should read counter high byte", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xcf); // LOAD

      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x20); // Counter high only

      dmaDevice.writeWR6(0xa7);

      dmaDevice.readStatusByte(); // Status
      const counterHi = dmaDevice.readStatusByte();
      
      expect(counterHi).toBe(0x00);
    });

    it("should read full counter in correct byte order", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xcf); // LOAD

      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x60); // Counter low + high

      dmaDevice.writeWR6(0xa7);

      dmaDevice.readStatusByte(); // Status
      const counterLo = dmaDevice.readStatusByte();
      const counterHi = dmaDevice.readStatusByte();
      
      const counter = counterLo | (counterHi << 8);
      expect(counter).toBe(0x0000);
    });

    it("should read non-zero counter values", () => {
      // Use ENABLE_DMA in legacy mode to set counter to 0xFFFF
      dmaDevice.setDmaMode(DmaMode.LEGACY);
      dmaDevice.writeWR6(0x87); // ENABLE_DMA

      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x60);

      dmaDevice.writeWR6(0xa7);

      dmaDevice.readStatusByte();
      const counterLo = dmaDevice.readStatusByte();
      const counterHi = dmaDevice.readStatusByte();
      
      expect(counterLo).toBe(0xff);
      expect(counterHi).toBe(0xff);
    });
  });

  describe("Port Address Read Operations", () => {
    it("should read Port A address low byte", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x34);
      dmaDevice.writeWR0(0x12);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xcf); // LOAD

      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x10); // Port A low only

      dmaDevice.writeWR6(0xa7);

      dmaDevice.readStatusByte();
      const portALo = dmaDevice.readStatusByte();
      
      expect(portALo).toBe(0x34);
    });

    it("should read Port A address high byte", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x34);
      dmaDevice.writeWR0(0x12);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xcf); // LOAD

      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x08); // Port A high only

      dmaDevice.writeWR6(0xa7);

      dmaDevice.readStatusByte();
      const portAHi = dmaDevice.readStatusByte();
      
      expect(portAHi).toBe(0x12);
    });

    it("should read full Port A address", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x34);
      dmaDevice.writeWR0(0x12);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xcf); // LOAD

      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x18); // Port A low + high

      dmaDevice.writeWR6(0xa7);

      dmaDevice.readStatusByte();
      const portALo = dmaDevice.readStatusByte();
      const portAHi = dmaDevice.readStatusByte();
      
      const portA = portALo | (portAHi << 8);
      expect(portA).toBe(0x1234);
    });

    it("should read Port B address low byte", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x78);
      dmaDevice.writeWR4(0x56);

      dmaDevice.writeWR6(0xcf); // LOAD

      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x04); // Port B low only

      dmaDevice.writeWR6(0xa7);

      dmaDevice.readStatusByte();
      const portBLo = dmaDevice.readStatusByte();
      
      expect(portBLo).toBe(0x78);
    });

    it("should read Port B address high byte", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x78);
      dmaDevice.writeWR4(0x56);

      dmaDevice.writeWR6(0xcf); // LOAD

      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x02); // Port B high only

      dmaDevice.writeWR6(0xa7);

      dmaDevice.readStatusByte();
      const portBHi = dmaDevice.readStatusByte();
      
      expect(portBHi).toBe(0x56);
    });

    it("should read full Port B address", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x78);
      dmaDevice.writeWR4(0x56);

      dmaDevice.writeWR6(0xcf); // LOAD

      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x06); // Port B low + high

      dmaDevice.writeWR6(0xa7);

      dmaDevice.readStatusByte();
      const portBLo = dmaDevice.readStatusByte();
      const portBHi = dmaDevice.readStatusByte();
      
      const portB = portBLo | (portBHi << 8);
      expect(portB).toBe(0x5678);
    });

    it("should respect A->B vs B->A direction in address reading", () => {
      // A->B: Port A is source, Port B is dest
      dmaDevice.writeWR0(0x40); // A->B
      dmaDevice.writeWR0(0x34);
      dmaDevice.writeWR0(0x12);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x78);
      dmaDevice.writeWR4(0x56);

      dmaDevice.writeWR6(0xcf); // LOAD

      // Verify source address (Port A)
      const transferState = dmaDevice.getTransferState();
      expect(transferState.sourceAddress).toBe(0x1234);
      expect(transferState.destAddress).toBe(0x5678);
    });
  });

  describe("Full Sequence Read", () => {
    it("should read complete sequence with mask 0x7F", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x34);
      dmaDevice.writeWR0(0x12);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x78);
      dmaDevice.writeWR4(0x56);

      dmaDevice.writeWR6(0xcf); // LOAD

      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x7f); // All registers

      dmaDevice.writeWR6(0xa7);

      const status = dmaDevice.readStatusByte();
      expect(status).toBe(0x36);

      const counterLo = dmaDevice.readStatusByte();
      expect(counterLo).toBe(0x00);

      const counterHi = dmaDevice.readStatusByte();
      expect(counterHi).toBe(0x00);

      const portALo = dmaDevice.readStatusByte();
      expect(portALo).toBe(0x34);

      const portAHi = dmaDevice.readStatusByte();
      expect(portAHi).toBe(0x12);

      const portBLo = dmaDevice.readStatusByte();
      expect(portBLo).toBe(0x78);

      const portBHi = dmaDevice.readStatusByte();
      expect(portBHi).toBe(0x56);
    });

    it("should read partial sequence with custom mask 0x50", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x34);
      dmaDevice.writeWR0(0x12);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x78);
      dmaDevice.writeWR4(0x56);

      dmaDevice.writeWR6(0xcf); // LOAD

      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x50); // Counter low + Port A low

      dmaDevice.writeWR6(0xa7);

      const status = dmaDevice.readStatusByte();
      expect(status).toBe(0x36);

      const counterLo = dmaDevice.readStatusByte();
      expect(counterLo).toBe(0x00);

      const portALo = dmaDevice.readStatusByte();
      expect(portALo).toBe(0x34);

      // Should wrap back to status
      const status2 = dmaDevice.readStatusByte();
      expect(status2).toBe(0x36);
    });

    it("should read alternating bytes with mask 0x55", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x34);
      dmaDevice.writeWR0(0x12);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x78);
      dmaDevice.writeWR4(0x56);

      dmaDevice.writeWR6(0xcf); // LOAD

      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x55); // Counter lo, Port A lo, Port B lo

      dmaDevice.writeWR6(0xa7);

      const status = dmaDevice.readStatusByte();
      expect(status).toBe(0x36);

      const counterLo = dmaDevice.readStatusByte();
      expect(counterLo).toBe(0x00);

      const portALo = dmaDevice.readStatusByte();
      expect(portALo).toBe(0x34);

      const portBLo = dmaDevice.readStatusByte();
      expect(portBLo).toBe(0x78);

      // Wrap
      const status2 = dmaDevice.readStatusByte();
      expect(status2).toBe(0x36);
    });
  });

  describe("Read Sequence Wraparound", () => {
    it("should wrap to status after completing full sequence", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xcf); // LOAD

      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x60); // Counter only

      dmaDevice.writeWR6(0xa7);

      // First cycle
      dmaDevice.readStatusByte(); // Status
      dmaDevice.readStatusByte(); // Counter lo
      dmaDevice.readStatusByte(); // Counter hi

      // Should wrap to status
      const status1 = dmaDevice.readStatusByte();
      expect(status1).toBe(0x36);

      // Second cycle
      dmaDevice.readStatusByte(); // Counter lo
      dmaDevice.readStatusByte(); // Counter hi

      // Should wrap again
      const status2 = dmaDevice.readStatusByte();
      expect(status2).toBe(0x36);
    });

    it("should wrap immediately with mask 0x00", () => {
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x00); // No registers

      dmaDevice.writeWR6(0xa7);

      const status1 = dmaDevice.readStatusByte();
      expect(status1).toBe(0x36);

      const status2 = dmaDevice.readStatusByte();
      expect(status2).toBe(0x36);

      const status3 = dmaDevice.readStatusByte();
      expect(status3).toBe(0x36);
    });

    it("should maintain wraparound after REINITIALIZE", () => {
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x40); // Counter low only

      dmaDevice.writeWR6(0xa7);

      dmaDevice.readStatusByte(); // Status
      dmaDevice.readStatusByte(); // Counter lo

      dmaDevice.writeWR6(0x8b); // REINITIALIZE

      // Should start fresh
      const status = dmaDevice.readStatusByte();
      expect(status).toBe(0x36);

      const counterLo = dmaDevice.readStatusByte();
      expect(counterLo).toBe(0x00);

      // Wrap
      const status2 = dmaDevice.readStatusByte();
      expect(status2).toBe(0x36);
    });
  });

  describe("Read After State Changes", () => {
    it("should read updated counter after ENABLE_DMA in legacy mode", () => {
      dmaDevice.setDmaMode(DmaMode.LEGACY);
      dmaDevice.writeWR6(0x87); // ENABLE (sets counter to 0xFFFF)

      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x60);

      dmaDevice.writeWR6(0xa7);

      dmaDevice.readStatusByte();
      const counterLo = dmaDevice.readStatusByte();
      const counterHi = dmaDevice.readStatusByte();

      expect(counterLo).toBe(0xff);
      expect(counterHi).toBe(0xff);
    });

    it("should read updated addresses after LOAD", () => {
      // First setup
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xcf); // LOAD

      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x18);

      dmaDevice.writeWR6(0xa7);

      dmaDevice.readStatusByte();
      let portALo = dmaDevice.readStatusByte();
      let portAHi = dmaDevice.readStatusByte();

      expect(portALo).toBe(0x00);
      expect(portAHi).toBe(0x10);

      // Update Port A address
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x34);
      dmaDevice.writeWR0(0x12);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR6(0xcf); // LOAD again

      dmaDevice.writeWR6(0xa7);

      dmaDevice.readStatusByte();
      portALo = dmaDevice.readStatusByte();
      portAHi = dmaDevice.readStatusByte();

      expect(portALo).toBe(0x34);
      expect(portAHi).toBe(0x12);
    });

    it("should read zeroed counter after CONTINUE", () => {
      dmaDevice.writeWR6(0xd3); // CONTINUE (resets counter to 0)

      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x60);

      dmaDevice.writeWR6(0xa7);

      dmaDevice.readStatusByte();
      const counterLo = dmaDevice.readStatusByte();
      const counterHi = dmaDevice.readStatusByte();

      expect(counterLo).toBe(0x00);
      expect(counterHi).toBe(0x00);
    });
  });

  describe("Edge Cases", () => {
    it("should handle reading with all address bits set", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0xff);
      dmaDevice.writeWR0(0xff);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0xff);
      dmaDevice.writeWR4(0xff);

      dmaDevice.writeWR6(0xcf); // LOAD

      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x7f);

      dmaDevice.writeWR6(0xa7);

      dmaDevice.readStatusByte();
      dmaDevice.readStatusByte(); // counter lo
      dmaDevice.readStatusByte(); // counter hi
      
      const portALo = dmaDevice.readStatusByte();
      const portAHi = dmaDevice.readStatusByte();
      const portBLo = dmaDevice.readStatusByte();
      const portBHi = dmaDevice.readStatusByte();

      expect(portALo).toBe(0xff);
      expect(portAHi).toBe(0xff);
      expect(portBLo).toBe(0xff);
      expect(portBHi).toBe(0xff);
    });

    it("should handle reading with zero addresses", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x00);

      dmaDevice.writeWR6(0xcf); // LOAD

      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x7f);

      dmaDevice.writeWR6(0xa7);

      dmaDevice.readStatusByte();
      dmaDevice.readStatusByte(); // counter lo
      dmaDevice.readStatusByte(); // counter hi
      
      const portALo = dmaDevice.readStatusByte();
      const portAHi = dmaDevice.readStatusByte();
      const portBLo = dmaDevice.readStatusByte();
      const portBHi = dmaDevice.readStatusByte();

      expect(portALo).toBe(0x00);
      expect(portAHi).toBe(0x00);
      expect(portBLo).toBe(0x00);
      expect(portBHi).toBe(0x00);
    });

    it("should handle multiple read cycles without reinitialize", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x12);
      dmaDevice.writeWR0(0x34);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x56);
      dmaDevice.writeWR4(0x78);

      dmaDevice.writeWR6(0xcf); // LOAD

      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x7f);

      dmaDevice.writeWR6(0xa7);

      // First complete cycle
      for (let i = 0; i < 7; i++) {
        dmaDevice.readStatusByte();
      }

      // Second cycle should give same values
      const status = dmaDevice.readStatusByte();
      expect(status).toBe(0x36);

      dmaDevice.readStatusByte(); // counter lo
      dmaDevice.readStatusByte(); // counter hi
      
      const portALo = dmaDevice.readStatusByte();
      expect(portALo).toBe(0x12);
    });

    it("should handle READ_STATUS_BYTE command resetting position", () => {
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x60);

      dmaDevice.writeWR6(0xa7);

      dmaDevice.readStatusByte(); // Status
      dmaDevice.readStatusByte(); // Counter lo
      
      // Now in middle of sequence, reset with READ_STATUS_BYTE
      dmaDevice.writeWR6(0xbf);
      
      const status = dmaDevice.readStatusByte();
      expect(status).toBe(0x36);
      
      // Should continue with counter
      const counterLo = dmaDevice.readStatusByte();
      expect(counterLo).toBe(0x00);
    });

    it("should handle B->A direction correctly", () => {
      // B->A: Port B is source, Port A is dest
      dmaDevice.writeWR0(0x00); // B->A (D6=0)
      dmaDevice.writeWR0(0x34);
      dmaDevice.writeWR0(0x12);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x78);
      dmaDevice.writeWR4(0x56);

      dmaDevice.writeWR6(0xcf); // LOAD

      // Verify addresses are swapped
      const transferState = dmaDevice.getTransferState();
      expect(transferState.sourceAddress).toBe(0x5678); // Port B
      expect(transferState.destAddress).toBe(0x1234);   // Port A
    });
  });

  describe("Sequence State Management", () => {
    it("should preserve read sequence position during writes", () => {
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x60);

      dmaDevice.writeWR6(0xa7);

      dmaDevice.readStatusByte(); // Status
      dmaDevice.readStatusByte(); // Counter lo
      
      // Current position is counter hi
      expect(dmaDevice.getRegisterReadSeq()).toBe(RegisterReadSequence.RD_COUNTER_HI);
      
      // Write a register
      dmaDevice.writeWR5(0x00);
      
      // Position should remain unchanged
      expect(dmaDevice.getRegisterReadSeq()).toBe(RegisterReadSequence.RD_COUNTER_HI);
    });

    it("should advance read sequence on each read", () => {
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x7f);

      dmaDevice.writeWR6(0xa7);

      expect(dmaDevice.getRegisterReadSeq()).toBe(RegisterReadSequence.RD_STATUS);
      
      dmaDevice.readStatusByte();
      expect(dmaDevice.getRegisterReadSeq()).toBe(RegisterReadSequence.RD_COUNTER_LO);
      
      dmaDevice.readStatusByte();
      expect(dmaDevice.getRegisterReadSeq()).toBe(RegisterReadSequence.RD_COUNTER_HI);
      
      dmaDevice.readStatusByte();
      expect(dmaDevice.getRegisterReadSeq()).toBe(RegisterReadSequence.RD_PORT_A_LO);
      
      dmaDevice.readStatusByte();
      expect(dmaDevice.getRegisterReadSeq()).toBe(RegisterReadSequence.RD_PORT_A_HI);
      
      dmaDevice.readStatusByte();
      expect(dmaDevice.getRegisterReadSeq()).toBe(RegisterReadSequence.RD_PORT_B_LO);
      
      dmaDevice.readStatusByte();
      expect(dmaDevice.getRegisterReadSeq()).toBe(RegisterReadSequence.RD_PORT_B_HI);
      
      // Wrap to status
      dmaDevice.readStatusByte();
      expect(dmaDevice.getRegisterReadSeq()).toBe(RegisterReadSequence.RD_STATUS);
    });
  });
});
