import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { DmaState, DmaMode, AddressMode, TransferMode } from "@emu/machines/zxNext/DmaDevice";

describe("DMA Z80 Code-Driven Tests - Basic Configuration", () => {
  describe("Initialization and Mode Selection", () => {
    it("should initialize with IDLE state and zxnDMA mode", async () => {
      const m = await createTestNextMachine();
      
      expect(m.getDmaState()).toBe(DmaState.IDLE);
      expect(m.dmaDevice.getDmaMode()).toBe(DmaMode.ZXNDMA);
      
      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(false);
      expect(regs.directionAtoB).toBe(true);
    });

    it("should reset to initial state via Z80 RESET command", async () => {
      const m = await createTestNextMachine();
      
      // Configure some DMA settings first
      const configCode = [
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0x79,                // LD A, 79H (WR0 base)
        0xED, 0x79,                // OUT (C), A
        0x3E, 0x00, 0xED, 0x79,    // Port A addr low
        0x3E, 0x80, 0xED, 0x79,    // Port A addr high (0x8000)
        0x3E, 0x0A, 0xED, 0x79,    // Block length low (10)
        0x3E, 0x00, 0xED, 0x79,    // Block length high
        
        // Now send RESET command (0xC3)
        0x3E, 0xC3,                // LD A, C3H (RESET)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(configCode, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      // Verify reset occurred
      expect(m.getDmaState()).toBe(DmaState.IDLE);
      expect(m.dmaDevice.getRegisterWriteSeq()).toBe(0); // IDLE sequence
    });

    it("should switch to LEGACY mode via port 0x0B", async () => {
      const m = await createTestNextMachine();
      
      // Write to port 0x0B to enable legacy mode
      const legacyCode = [
        0x01, 0x0B, 0x00,          // LD BC, 000BH (legacy DMA port)
        0x3E, 0x79,                // LD A, 79H (WR0 base)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(legacyCode, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      expect(m.dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
    });

    it("should switch back to ZXNDMA mode via port 0x6B", async () => {
      const m = await createTestNextMachine();
      
      // First switch to legacy mode
      const switchCode = [
        0x01, 0x0B, 0x00,          // LD BC, 000BH
        0x3E, 0x79,                // LD A, 79H
        0xED, 0x79,                // OUT (C), A
        
        // Then switch back to zxnDMA
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0x79,                // LD A, 79H
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(switchCode, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      expect(m.dmaDevice.getDmaMode()).toBe(DmaMode.ZXNDMA);
    });
  });

  describe("Direction Flag Configuration (WR0)", () => {
    it("should set direction A→B when D6=1 in WR0", async () => {
      const m = await createTestNextMachine();
      
      const directionCode = [
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0x7D,                // LD A, 7DH (WR0 base with D6=1: 01111101)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(directionCode, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.directionAtoB).toBe(true);
    });

    it("should set direction B→A when D6=0 in WR0", async () => {
      const m = await createTestNextMachine();
      
      const directionCode = [
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0x39,                // LD A, 39H (WR0 base with D6=0: 00111001)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(directionCode, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.directionAtoB).toBe(false);
    });

    it("should preserve direction flag with other bits set", async () => {
      const m = await createTestNextMachine();
      
      const directionCode = [
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0x7F,                // LD A, 7FH (WR0 with D6=1, all others set)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(directionCode, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.directionAtoB).toBe(true);
    });
  });

  describe("Basic Register Initialization", () => {
    it("should initialize default register values correctly", async () => {
      const m = await createTestNextMachine();
      
      const regs = m.getDmaRegisters();
      
      // Default values per DMA specification
      expect(regs.portAStartAddress).toBe(0);
      expect(regs.portBStartAddress).toBe(0);
      expect(regs.blockLength).toBe(0);
      expect(regs.portAAddressMode).toBe(AddressMode.INCREMENT);
      expect(regs.portBAddressMode).toBe(AddressMode.INCREMENT);
      expect(regs.portAIsIO).toBe(false);
      expect(regs.portBIsIO).toBe(false);
      expect(regs.transferMode).toBe(TransferMode.CONTINUOUS);
      expect(regs.autoRestart).toBe(false);
      expect(regs.dmaEnabled).toBe(false);
    });

    it("should configure Port A address via Z80 code", async () => {
      const m = await createTestNextMachine();
      
      const addrCode = [
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0x79,                // LD A, 79H (WR0 base)
        0xED, 0x79,                // OUT (C), A
        0x3E, 0x34,                // LD A, 34H (low byte)
        0xED, 0x79,                // OUT (C), A
        0x3E, 0x12,                // LD A, 12H (high byte)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(addrCode, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.portAStartAddress).toBe(0x1234);
    });

    it("should configure block length via Z80 code", async () => {
      const m = await createTestNextMachine();
      
      const lengthCode = [
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0x79,                // LD A, 79H (WR0 base)
        0xED, 0x79,                // OUT (C), A
        0x3E, 0x00, 0xED, 0x79,    // Port A addr low (skip)
        0x3E, 0x00, 0xED, 0x79,    // Port A addr high (skip)
        0x3E, 0x40,                // LD A, 40H (block length low = 64)
        0xED, 0x79,                // OUT (C), A
        0x3E, 0x00,                // LD A, 00H (block length high)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(lengthCode, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.blockLength).toBe(64);
    });

    it("should configure Port B address via WR4", async () => {
      const m = await createTestNextMachine();
      
      const portBCode = [
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0xBD,                // LD A, BDH (WR4 base, continuous mode)
        0xED, 0x79,                // OUT (C), A
        0x3E, 0x00,                // LD A, 00H (Port B addr low)
        0xED, 0x79,                // OUT (C), A
        0x3E, 0xA0,                // LD A, A0H (Port B addr high)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(portBCode, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.portBStartAddress).toBe(0xA000);
    });
  });

  describe("Address Mode Configuration (WR1 & WR2)", () => {
    it("should configure Port A increment mode via WR1", async () => {
      const m = await createTestNextMachine();
      
      const wr1Code = [
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0x14,                // LD A, 14H (WR1: bits D4-D3=10 = INCREMENT)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(wr1Code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.portAAddressMode).toBe(AddressMode.INCREMENT);
    });

    it("should configure Port A decrement mode via WR1", async () => {
      const m = await createTestNextMachine();
      
      const wr1Code = [
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0x04,                // LD A, 04H (WR1: bits D4-D3=00 = DECREMENT)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(wr1Code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.portAAddressMode).toBe(AddressMode.DECREMENT);
    });

    it("should configure Port A fixed mode via WR1", async () => {
      const m = await createTestNextMachine();
      
      const wr1Code = [
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0x24,                // LD A, 24H (WR1: bits D5-D4=10 = FIXED)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(wr1Code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.portAAddressMode).toBe(AddressMode.FIXED);
    });

    it("should configure Port B increment mode via WR2", async () => {
      const m = await createTestNextMachine();
      
      const wr2Code = [
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0x10,                // LD A, 10H (WR2: bits D5-D4=01 = INCREMENT)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(wr2Code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.portBAddressMode).toBe(AddressMode.INCREMENT);
    });
  });

  describe("Port Type Configuration (Memory vs I/O)", () => {
    it("should configure Port A as memory via WR1", async () => {
      const m = await createTestNextMachine();
      
      const wr1Code = [
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0x14,                // LD A, 14H (WR1: D3=0 = memory)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(wr1Code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.portAIsIO).toBe(false);
    });

    it("should configure Port A as I/O via WR1", async () => {
      const m = await createTestNextMachine();
      
      const wr1Code = [
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0x1C,                // LD A, 1CH (WR1: D3=1 = I/O)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(wr1Code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.portAIsIO).toBe(true);
    });

    it("should configure Port B as memory via WR2", async () => {
      const m = await createTestNextMachine();
      
      const wr2Code = [
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0x10,                // LD A, 10H (WR2: D3=0 = memory)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(wr2Code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.portBIsIO).toBe(false);
    });

    it("should configure Port B as I/O via WR2", async () => {
      const m = await createTestNextMachine();
      
      const wr2Code = [
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0x18,                // LD A, 18H (WR2: D3=1 = I/O)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(wr2Code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.portBIsIO).toBe(true);
    });
  });

  describe("Transfer Mode Configuration (WR4)", () => {
    it("should configure continuous mode via WR4", async () => {
      const m = await createTestNextMachine();
      
      const wr4Code = [
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0xBD,                // LD A, BDH (WR4: bit 4 after shift = 1 = CONTINUOUS)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(wr4Code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.transferMode).toBe(TransferMode.CONTINUOUS);
    });

    it("should configure burst mode via WR4", async () => {
      const m = await createTestNextMachine();
      
      const wr4Code = [
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0xAD,                // LD A, ADH (WR4: bit 4 after shift = 0 = BURST)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(wr4Code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.transferMode).toBe(TransferMode.BURST);
    });
  });

  describe("Enable/Disable DMA (WR6 Commands)", () => {
    it("should enable DMA via ENABLE_DMA command (0x87)", async () => {
      const m = await createTestNextMachine();
      
      const enableCode = [
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0x87,                // LD A, 87H (ENABLE_DMA command)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(enableCode, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(true);
    });

    it("should disable DMA via DISABLE_DMA command (0x83)", async () => {
      const m = await createTestNextMachine();
      
      // First enable, then disable
      const disableCode = [
        0x01, 0x6B, 0x00,          // LD BC, 006BH
        0x3E, 0x87,                // LD A, 87H (ENABLE_DMA)
        0xED, 0x79,                // OUT (C), A
        0x3E, 0x83,                // LD A, 83H (DISABLE_DMA command)
        0xED, 0x79,                // OUT (C), A
        0x76                       // HALT
      ];
      
      m.initCode(disableCode, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();
      
      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(false);
    });
  });
});
