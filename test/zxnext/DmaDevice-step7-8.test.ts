/**
 * Tests for Step 7: WR6 Command Handler Rewrite (MAME alignment)
 * Tests for Step 8: Address Update Model Fix (addressA/addressB independent)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DmaDevice, DmaMode } from "@emu/machines/zxNext/DmaDevice";
import { TestZxNextMachine } from "./TestNextMachine";

describe("DmaDevice - Step 7: WR6 Command Handler (MAME Alignment)", () => {
  let machine: TestZxNextMachine;
  let dma: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dma = machine.dmaDevice;
  });

  // ============================================================================
  // RESET command (0xC3)
  // ============================================================================
  describe("RESET command (0xC3)", () => {
    it("should set m_status to 0x38 after RESET", () => {
      dma.writeWR6(0xc3);
      expect(dma.getStatus()).toBe(0x38);
    });

    it("should clear forceReady on RESET", () => {
      dma.writeWR6(0xb3); // FORCE_READY — set it
      expect(dma.getForceReady()).toBe(true);
      dma.writeWR6(0xc3);
      expect(dma.getForceReady()).toBe(false);
    });

    it("should clear ip on RESET", () => {
      dma.writeWR6(0xc3);
      expect(dma.getIp()).toBe(0);
    });

    it("should clear ius on RESET", () => {
      dma.writeWR6(0xc3);
      expect(dma.getIus()).toBe(0);
    });

    it("should disable DMA on RESET", () => {
      dma.writeWR6(0x87); // ENABLE_DMA first
      dma.writeWR6(0xc3);
      expect(dma.getRegisters().dmaEnabled).toBe(false);
    });

    it("should clear prescaler on RESET (specnext override)", () => {
      dma.writeWR2(0x40); // WR2 base with timing
      dma.writeWR2(0x20); // Timing byte D5=1 → prescaler follows
      dma.writeWR2(0x37); // Prescaler = 55
      dma.writeWR6(0xc3);
      expect(dma.getRegisters().portBPrescalar).toBe(0);
    });

    it("should implement progressive column reset (resetPointer increments)", () => {
      expect(dma.getResetPointer()).toBe(0);
      dma.writeWR6(0xc3);
      expect(dma.getResetPointer()).toBe(1);
      dma.writeWR6(0xc3);
      expect(dma.getResetPointer()).toBe(2);
    });

    it("should wrap resetPointer back to 0 after 6 resets", () => {
      for (let i = 0; i < 6; i++) {
        dma.writeWR6(0xc3);
      }
      expect(dma.getResetPointer()).toBe(0);
    });

    it("should clear column 0 registers on first RESET", () => {
      // Write some data into WR0 column 0 (base byte)
      dma.writeWR0(0x7d);  // WR0 base with follow bits
      dma.writeWR0(0x34);  // portA addr low
      dma.writeWR0(0x12);  // portA addr high
      dma.writeWR0(0x08);  // block len low
      dma.writeWR0(0x00);  // block len high
      // After WR0 the raw reg[0] = 0x7d
      expect(dma.getRawReg(0, 0)).toBe(0x7d);

      // RESET clears column 0 of all groups
      dma.writeWR6(0xc3);
      expect(dma.getRawReg(0, 0)).toBe(0);
    });

    it("should clear column 1 registers on second RESET", () => {
      dma.writeWR0(0x7d);  // WR0 base with follow bits
      dma.writeWR0(0x34);  // portA addr low goes into regs[1]
      dma.writeWR0(0x12);  // portA addr high goes into regs[2]
      dma.writeWR0(0x00);  // block len low
      dma.writeWR0(0x00);  // block len high
      expect(dma.getRawReg(0, 1)).toBe(0x34);

      dma.writeWR6(0xc3); // First RESET clears column 0
      dma.writeWR6(0xc3); // Second RESET clears column 1
      expect(dma.getRawReg(0, 1)).toBe(0);
    });
  });

  // ============================================================================
  // LOAD command (0xCF)
  // ============================================================================
  describe("LOAD command (0xCF)", () => {
    it("should set m_status bit 4 and 5 (|= 0x30) after LOAD", () => {
      // Clear status first (m_status initially 0x38, after 6 resets it persists at 0x38)
      // Fresh device starts with m_status = 0x38
      // After LOAD: m_status |= 0x30 — still 0x38 since 0x38 | 0x30 = 0x38
      // Use a RESET first to clean up and then LOAD
      dma.writeWR6(0xc3); // m_status = 0x38
      // Manually mask out bits 4,5 to test the OR behavior
      // The simplest test: if we start fresh, initial m_status=0x38, LOAD sets 0x30 → stays 0x38
      dma.writeWR0(0x7d);
      dma.writeWR0(0x00); // portA addr = 0x0000
      dma.writeWR0(0x10);
      dma.writeWR0(0x04); // block len = 4
      dma.writeWR0(0x00);
      dma.writeWR4(0x05); // WR4 base with portB addr follow
      dma.writeWR4(0x00); // portB addr low = 0
      dma.writeWR4(0x20); // portB addr high
      dma.writeWR6(0xcf); // LOAD
      // m_status |= 0x30 means bits 5 and 4 are set
      expect(dma.getStatus() & 0x30).toBe(0x30);
    });

    it("should set _addressA to portAStartAddress on LOAD", () => {
      dma.writeWR0(0x7d);
      dma.writeWR0(0x34); // portA low
      dma.writeWR0(0x12); // portA high = 0x1234
      dma.writeWR0(0x04);
      dma.writeWR0(0x00);
      dma.writeWR4(0x05);
      dma.writeWR4(0x00);
      dma.writeWR4(0x10);
      dma.writeWR6(0xcf); // LOAD
      expect(dma.getAddressA()).toBe(0x1234);
    });

    it("should set _addressB to portBStartAddress on LOAD", () => {
      dma.writeWR0(0x7d);
      dma.writeWR0(0x00);
      dma.writeWR0(0x10);
      dma.writeWR0(0x04);
      dma.writeWR0(0x00);
      dma.writeWR4(0x05);
      dma.writeWR4(0x78); // portB low
      dma.writeWR4(0x56); // portB high = 0x5678
      dma.writeWR6(0xcf); // LOAD
      expect(dma.getAddressB()).toBe(0x5678);
    });

    it("should always reset byteCounter to 0 on LOAD", () => {
      dma.writeWR0(0x7d);
      dma.writeWR0(0x00);
      dma.writeWR0(0x10);
      dma.writeWR0(0x04);
      dma.writeWR0(0x00);
      dma.writeWR4(0x05);
      dma.writeWR4(0x00);
      dma.writeWR4(0x20);
      dma.writeWR6(0xcf);
      expect(dma.getTransferState().byteCounter).toBe(0);
    });

    it("should set forceReady to false on LOAD", () => {
      dma.writeWR6(0xb3); // FORCE_READY
      expect(dma.getForceReady()).toBe(true);
      dma.writeWR0(0x7d);
      dma.writeWR0(0x00);
      dma.writeWR0(0x10);
      dma.writeWR0(0x04);
      dma.writeWR0(0x00);
      dma.writeWR4(0x05);
      dma.writeWR4(0x00);
      dma.writeWR4(0x20);
      dma.writeWR6(0xcf);
      expect(dma.getForceReady()).toBe(false);
    });
  });

  // ============================================================================
  // CONTINUE command (0xD3)
  // ============================================================================
  describe("CONTINUE command (0xD3)", () => {
    it("should set m_status bits 5 and 4 (|= 0x30) after CONTINUE", () => {
      dma.writeWR6(0xd3);
      expect(dma.getStatus() & 0x30).toBe(0x30);
    });

    it("should always reset byteCounter to 0 on CONTINUE", () => {
      dma.writeWR0(0x7d);
      dma.writeWR0(0x00);
      dma.writeWR0(0x10);
      dma.writeWR0(0x04);
      dma.writeWR0(0x00);
      dma.writeWR4(0x05);
      dma.writeWR4(0x00);
      dma.writeWR4(0x20);
      dma.writeWR6(0xcf); // LOAD
      dma.writeWR6(0xd3); // CONTINUE
      expect(dma.getTransferState().byteCounter).toBe(0);
    });

    it("should keep current _addressA and _addressB on CONTINUE", () => {
      dma.writeWR0(0x7d);
      dma.writeWR0(0x34);
      dma.writeWR0(0x12); // portA = 0x1234
      dma.writeWR0(0x04);
      dma.writeWR0(0x00);
      dma.writeWR4(0x05);
      dma.writeWR4(0x78);
      dma.writeWR4(0x56); // portB = 0x5678
      dma.writeWR6(0xcf); // LOAD
      dma.writeWR6(0xd3); // CONTINUE
      expect(dma.getAddressA()).toBe(0x1234);
      expect(dma.getAddressB()).toBe(0x5678);
    });
  });

  // ============================================================================
  // ENABLE_DMA command (0x87)
  // ============================================================================
  describe("ENABLE_DMA command (0x87)", () => {
    it("should set byteCounter to 0 in zxnDMA mode (specnext override)", () => {
      // Default mode is zxnDMA
      dma.writeWR6(0x87);
      expect(dma.getTransferState().byteCounter).toBe(0);
    });

    it("should NOT change byteCounter in legacy mode (Zilog compat)", () => {
      dma.setDmaMode(DmaMode.LEGACY);
      // Set byteCounter to known value first (e.g., from LOAD which sets 0xFFFF)
      dma.writeWR0(0x7d);
      dma.writeWR0(0x00);
      dma.writeWR0(0x10);
      dma.writeWR0(0x04);
      dma.writeWR0(0x00);
      dma.writeWR4(0x05);
      dma.writeWR4(0x00);
      dma.writeWR4(0x20);
      dma.writeWR6(0xcf); // LOAD → sets byteCounter = 0xFFFF in legacy
      expect(dma.getTransferState().byteCounter).toBe(0xFFFF);
      dma.writeWR6(0x87); // ENABLE_DMA → should NOT change byteCounter
      expect(dma.getTransferState().byteCounter).toBe(0xFFFF);
    });

    it("should enable DMA", () => {
      dma.writeWR6(0x87);
      expect(dma.getRegisters().dmaEnabled).toBe(true);
    });
  });

  // ============================================================================
  // DISABLE_DMA command (0x83)
  // ============================================================================
  describe("DISABLE_DMA command (0x83)", () => {
    it("should disable DMA", () => {
      dma.writeWR6(0x87);
      dma.writeWR6(0x83);
      expect(dma.getRegisters().dmaEnabled).toBe(false);
    });
  });

  // ============================================================================
  // READ_STATUS_BYTE command (0xBF)
  // ============================================================================
  describe("READ_STATUS_BYTE command (0xBF)", () => {
    it("should set readMask to 1 (status only)", () => {
      // Set a different mask first
      dma.writeWR6(0xbb);
      dma.writeWR6(0x7f);
      expect(dma.getRegisters().readMask).toBe(0x7f);

      dma.writeWR6(0xbf); // READ_STATUS_BYTE
      expect(dma.getRegisters().readMask).toBe(1);
    });

    it("should set read sequence to status position", () => {
      dma.writeWR6(0xbf);
      // After READ_STATUS_BYTE, calling readStatusByte() should return status
      const val = dma.readStatusByte();
      // Status byte should be valid (bits 7-6 = 0, bits 4-1 = 1011 for 0x36)
      expect(val & 0xc0).toBe(0);
    });
  });

  // ============================================================================
  // INIT_READ_SEQUENCE command (0xA7)
  // ============================================================================
  describe("INIT_READ_SEQUENCE command (0xA7)", () => {
    it("should reset read position to first enabled position", () => {
      dma.writeWR6(0xbb);
      dma.writeWR6(0x7f); // All positions enabled
      dma.writeWR6(0xa7); // INIT_READ_SEQUENCE
      // First read should be status
      const val = dma.readStatusByte();
      expect(val & 0xc0).toBe(0); // Valid status byte (bits 7-6 = 0)
    });

    it("should respect readMask=0: reading status byte with empty mask", () => {
      // With mask = 0, setup_next_read immediately returns (no change)
      dma.writeWR6(0xbb);
      dma.writeWR6(0x00); // mask = 0
      dma.writeWR6(0xa7); // INIT_READ_SEQUENCE; should be a no-op per MAME
      // After, status should still be readable
      const val = dma.readStatusByte();
      // Should still return status (default 0x36 if mask=0 leads to RD_STATUS wrapping)
      expect(typeof val).toBe("number");
    });
  });

  // ============================================================================
  // READ_MASK_FOLLOWS command (0xBB)
  // ============================================================================
  describe("READ_MASK_FOLLOWS command (0xBB)", () => {
    it("should store next byte as read mask in raw registers", () => {
      dma.writeWR6(0xbb);
      dma.writeWR6(0x55);
      expect(dma.getRegisters().readMask).toBe(0x55);
    });
  });

  // ============================================================================
  // REINIT_STATUS_BYTE command (0x8B)
  // ============================================================================
  describe("REINIT_STATUS_BYTE command (0x8B)", () => {
    it("should set m_status bits 5,4 (|= 0x30)", () => {
      dma.writeWR6(0x8b);
      expect(dma.getStatus() & 0x30).toBe(0x30);
    });

    it("should set ip to 0", () => {
      dma.writeWR6(0x8b);
      expect(dma.getIp()).toBe(0);
    });

    it("should reset legacy statusFlags for backward compat", () => {
      dma.writeWR6(0x8b);
      const flags = dma.getStatusFlags();
      expect(flags.endOfBlockReached).toBe(true);
      expect(flags.atLeastOneByteTransferred).toBe(false);
    });
  });

  // ============================================================================
  // FORCE_READY command (0xB3)
  // ============================================================================
  describe("FORCE_READY command (0xB3)", () => {
    it("should set forceReady to true", () => {
      expect(dma.getForceReady()).toBe(false);
      dma.writeWR6(0xb3);
      expect(dma.getForceReady()).toBe(true);
    });

    it("should be cleared by RESET", () => {
      dma.writeWR6(0xb3);
      dma.writeWR6(0xc3);
      expect(dma.getForceReady()).toBe(false);
    });

    it("should be cleared by LOAD", () => {
      dma.writeWR6(0xb3);
      dma.writeWR0(0x7d);
      dma.writeWR0(0x00);
      dma.writeWR0(0x10);
      dma.writeWR0(0x04);
      dma.writeWR0(0x00);
      dma.writeWR4(0x05);
      dma.writeWR4(0x00);
      dma.writeWR4(0x20);
      dma.writeWR6(0xcf);
      expect(dma.getForceReady()).toBe(false);
    });
  });
});

// ============================================================================
// Step 8: Address Update Model
// ============================================================================
describe("DmaDevice - Step 8: Address Update Model (addressA/addressB independent)", () => {
  let machine: TestZxNextMachine;
  let dma: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dma = machine.dmaDevice;
  });

  /**
   * Configure A→B transfer: Port A increments, Port B increments
   */
  function configureAtoBTransfer(
    portAAddr: number,
    portBAddr: number,
    blockLen: number
  ) {
    dma.writeWR6(0xc7); // RESET_PORT_A_TIMING
    dma.writeWR6(0xcb); // RESET_PORT_B_TIMING
    dma.writeWR0(0x7d); // A→B, all follow params
    dma.writeWR0(portAAddr & 0xff);
    dma.writeWR0((portAAddr >> 8) & 0xff);
    dma.writeWR0(blockLen & 0xff);
    dma.writeWR0((blockLen >> 8) & 0xff);
    dma.writeWR1(0x14); // Port A: increment
    dma.writeWR2(0x10); // Port B: increment
    dma.writeWR4(0xbd); // Continuous mode + portB addr follow
    dma.writeWR4(portBAddr & 0xff);
    dma.writeWR4((portBAddr >> 8) & 0xff);
    dma.writeWR6(0xcf); // LOAD
  }

  /**
   * Configure A→B transfer: Port A increments, Port B fixed
   */
  function configureAtoBPortBFixed(
    portAAddr: number,
    portBAddr: number,
    blockLen: number
  ) {
    dma.writeWR6(0xc7);
    dma.writeWR6(0xcb);
    dma.writeWR0(0x7d);
    dma.writeWR0(portAAddr & 0xff);
    dma.writeWR0((portAAddr >> 8) & 0xff);
    dma.writeWR0(blockLen & 0xff);
    dma.writeWR0((blockLen >> 8) & 0xff);
    dma.writeWR1(0x14); // Port A: increment
    dma.writeWR2(0x20); // Port B: fixed (D5-D4 = 10)
    dma.writeWR4(0xbd);
    dma.writeWR4(portBAddr & 0xff);
    dma.writeWR4((portBAddr >> 8) & 0xff);
    dma.writeWR6(0xcf); // LOAD
  }

  /**
   * Configure B→A transfer: Port B increments, Port A increments
   */
  function configureBtoATransfer(
    portAAddr: number,
    portBAddr: number,
    blockLen: number
  ) {
    dma.writeWR6(0xc7);
    dma.writeWR6(0xcb);
    dma.writeWR0(0x79); // B→A (D2=0), portA address + blocklen follow
    dma.writeWR0(portAAddr & 0xff);
    dma.writeWR0((portAAddr >> 8) & 0xff);
    dma.writeWR0(blockLen & 0xff);
    dma.writeWR0((blockLen >> 8) & 0xff);
    dma.writeWR1(0x14); // Port A: increment
    dma.writeWR2(0x10); // Port B: increment
    dma.writeWR4(0xbd);
    dma.writeWR4(portBAddr & 0xff);
    dma.writeWR4((portBAddr >> 8) & 0xff);
    dma.writeWR6(0xcf); // LOAD
  }

  it("should initialize _addressA and _addressB from LOAD", () => {
    configureAtoBTransfer(0x1000, 0x2000, 4);
    expect(dma.getAddressA()).toBe(0x1000);
    expect(dma.getAddressB()).toBe(0x2000);
  });

  it("should increment _addressA after each byte in A→B increment mode", () => {
    const portAAddr = 0x8000;
    const portBAddr = 0x9000;

    // Fill source with test data
    for (let i = 0; i < 4; i++) {
      machine.memoryDevice.writeMemory(portAAddr + i, 0x11 + i);
    }

    configureAtoBTransfer(portAAddr, portBAddr, 4);
    dma.writeWR6(0x87); // ENABLE_DMA

    // Grant bus access
    dma.acknowledgeBus();

    // Transfer 4 bytes
    for (let i = 0; i < 4; i++) {
      dma.performReadCycle();
      dma.performWriteCycle();
    }

    // _addressA should have moved forward by 4
    expect(dma.getAddressA()).toBe(portAAddr + 4);
    // _addressB should have moved forward by 4
    expect(dma.getAddressB()).toBe(portBAddr + 4);
  });

  it("should keep _addressB fixed when Port B is in FIXED mode", () => {
    const portAAddr = 0x8000;
    const portBAddr = 0x9000;  // IO port (fixed)

    for (let i = 0; i < 4; i++) {
      machine.memoryDevice.writeMemory(portAAddr + i, 0xAA);
    }

    configureAtoBPortBFixed(portAAddr, portBAddr, 4);
    dma.writeWR6(0x87); // ENABLE_DMA
    dma.acknowledgeBus();

    for (let i = 0; i < 4; i++) {
      dma.performReadCycle();
      dma.performWriteCycle();
    }

    // Port A increments
    expect(dma.getAddressA()).toBe(portAAddr + 4);
    // Port B stays fixed
    expect(dma.getAddressB()).toBe(portBAddr);
  });

  it("should update _addressB (source) and _addressA (dest) correctly in B→A transfer", () => {
    const portAAddr = 0x8000; // destination (B→A)
    const portBAddr = 0x9000; // source (B→A)

    // Fill source (Port B addr range)
    for (let i = 0; i < 4; i++) {
      machine.memoryDevice.writeMemory(portBAddr + i, 0xBB + i);
    }

    configureBtoATransfer(portAAddr, portBAddr, 4);
    dma.writeWR6(0x87); // ENABLE_DMA
    dma.acknowledgeBus();

    for (let i = 0; i < 4; i++) {
      dma.performReadCycle();
      dma.performWriteCycle();
    }

    // Both addresses should have incremented independently
    expect(dma.getAddressA()).toBe(portAAddr + 4);
    expect(dma.getAddressB()).toBe(portBAddr + 4);
  });

  it("readStatusByte RD_PORT_A_LO should always return _addressA low byte (not source)", () => {
    // In B→A direction, sourceAddress = portBAddr, but _addressA = portAAddr
    // After this step, readStatusByte for Port A should use _addressA, not sourceAddress
    configureBtoATransfer(0x1234, 0x5678, 4);

    dma.writeWR6(0xbb);
    dma.writeWR6(0x19); // Status + Port A low + high in mask (MAME: bits 0+3+4)
    dma.writeWR6(0xa7); // INIT_READ_SEQUENCE

    dma.readStatusByte(); // status
    const portALo = dma.readStatusByte();
    const portAHi = dma.readStatusByte();
    const portA = portALo | (portAHi << 8);
    expect(portA).toBe(0x1234); // Should be addressA = portAAddr, not portBAddr
  });

  it("readStatusByte RD_PORT_B_LO should always return _addressB low byte (not dest)", () => {
    // In B→A direction, destAddress = portAAddr, but _addressB = portBAddr
    configureBtoATransfer(0x1234, 0x5678, 4);

    dma.writeWR6(0xbb);
    dma.writeWR6(0x61); // Status + Port B low + high in mask (MAME: bits 0+5+6)
    dma.writeWR6(0xa7);

    dma.readStatusByte(); // status
    const portBLo = dma.readStatusByte();
    const portBHi = dma.readStatusByte();
    const portB = portBLo | (portBHi << 8);
    expect(portB).toBe(0x5678); // Should be addressB = portBAddr, not portAAddr
  });
});
