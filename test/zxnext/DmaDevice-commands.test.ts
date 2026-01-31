import { describe, it, expect, beforeEach } from "vitest";
import {
  DmaDevice,
  DmaState,
  RegisterWriteSequence,
  AddressMode,
  TransferMode,
  CycleLength,
  DmaMode
} from "@emu/machines/zxNext/DmaDevice";
import { TestZxNextMachine } from "./TestNextMachine";

describe("DmaDevice - Step 5: WR6 Command Register - Basic Commands", () => {
  let machine: TestZxNextMachine;
  let dmaDevice: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dmaDevice = machine.dmaDevice;
  });

  describe("RESET Command (0xC3)", () => {
    it("should reset DMA state to IDLE", () => {
      // Setup - set DMA to a non-IDLE state (simulated)
      dmaDevice.writeWR6(0xc3);
      expect(dmaDevice.getDmaState()).toBe(DmaState.IDLE);
    });

    it("should reset status flags - endOfBlockReached to true", () => {
      dmaDevice.writeWR6(0xc3);
      const statusFlags = dmaDevice.getStatusFlags();
      expect(statusFlags.endOfBlockReached).toBe(true);
    });

    it("should reset status flags - atLeastOneByteTransferred to false", () => {
      dmaDevice.writeWR6(0xc3);
      const statusFlags = dmaDevice.getStatusFlags();
      expect(statusFlags.atLeastOneByteTransferred).toBe(false);
    });

    it("should reset Port A timing to default (3 cycles)", () => {
      // Setup - change Port A timing
      dmaDevice.writeWR1(0x04 | 0x40); // Base byte with timing parameter bit
      dmaDevice.writeWR1(0x00); // Timing byte (4 cycles)

      // Execute RESET
      dmaDevice.writeWR6(0xc3);

      const registers = dmaDevice.getRegisters();
      expect(registers.portATimingCycleLength).toBe(CycleLength.CYCLES_3);
    });

    it("should reset Port B timing to default (3 cycles)", () => {
      // Setup - change Port B timing
      dmaDevice.writeWR2(0x00 | 0x40); // Base byte with timing parameter bit
      dmaDevice.writeWR2(0x00); // Timing byte (4 cycles)
      dmaDevice.writeWR2(0x55); // Prescalar

      // Execute RESET
      dmaDevice.writeWR6(0xc3);

      const registers = dmaDevice.getRegisters();
      expect(registers.portBTimingCycleLength).toBe(CycleLength.CYCLES_3);
    });

    it("should reset prescalar to 0", () => {
      // Setup - set prescalar to non-zero value
      dmaDevice.writeWR2(0x00 | 0x40); // Base byte with timing parameter bit
      dmaDevice.writeWR2(0x00); // Timing byte
      dmaDevice.writeWR2(0x55); // Prescalar = 85

      // Execute RESET
      dmaDevice.writeWR6(0xc3);

      const registers = dmaDevice.getRegisters();
      expect(registers.portBPrescalar).toBe(0);
    });

    it("should reset prescalar timer to 0", () => {
      // Execute RESET
      dmaDevice.writeWR6(0xc3);
      expect(dmaDevice.getPrescalarTimer()).toBe(0);
    });

    it("should reset CE/WAIT multiplexed flag to false", () => {
      // Setup - enable CE/WAIT multiplexed
      dmaDevice.writeWR5(0x82 | 0x10); // Enable CE/WAIT

      // Execute RESET
      dmaDevice.writeWR6(0xc3);

      const registers = dmaDevice.getRegisters();
      expect(registers.ceWaitMultiplexed).toBe(false);
    });

    it("should reset auto-restart flag to false", () => {
      // Setup - enable auto-restart
      dmaDevice.writeWR5(0x82 | 0x20); // Enable auto-restart

      // Execute RESET
      dmaDevice.writeWR6(0xc3);

      const registers = dmaDevice.getRegisters();
      expect(registers.autoRestart).toBe(false);
    });

    it("should keep register write sequence in IDLE", () => {
      dmaDevice.writeWR6(0xc3);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });

    it("should not reset Port A start address", () => {
      // Setup - configure Port A start address
      dmaDevice.writeWR0(0x68); // Base byte with port A address parameters
      dmaDevice.writeWR0(0x34); // Low byte
      dmaDevice.writeWR0(0x12); // High byte

      // Execute RESET
      dmaDevice.writeWR6(0xc3);

      const registers = dmaDevice.getRegisters();
      expect(registers.portAStartAddress).toBe(0x1234);
    });

    it("should not reset block length", () => {
      // Setup - configure block length
      dmaDevice.writeWR0(0x78); // Base byte with all parameters
      dmaDevice.writeWR0(0x00); // Port A low
      dmaDevice.writeWR0(0x00); // Port A high
      dmaDevice.writeWR0(0x00); // Block length low
      dmaDevice.writeWR0(0x01); // Block length high (256 bytes)

      // Execute RESET
      dmaDevice.writeWR6(0xc3);

      const registers = dmaDevice.getRegisters();
      expect(registers.blockLength).toBe(0x0100);
    });

    it("should not reset direction flag", () => {
      // Setup - configure direction A->B
      dmaDevice.writeWR0(0x68 | 0x04); // Base byte with direction bit

      // Execute RESET
      dmaDevice.writeWR6(0xc3);

      const registers = dmaDevice.getRegisters();
      expect(registers.directionAtoB).toBe(true);
    });
  });

  describe("RESET_PORT_A_TIMING Command (0xC7)", () => {
    it("should reset Port A timing to default (3 cycles)", () => {
      // Setup - change Port A timing to 4 cycles
      dmaDevice.writeWR1(0x04 | 0x40); // Base byte with timing parameter
      dmaDevice.writeWR1(0x00); // Timing byte (4 cycles)

      // Execute RESET_PORT_A_TIMING
      dmaDevice.writeWR6(0xc7);

      const registers = dmaDevice.getRegisters();
      expect(registers.portATimingCycleLength).toBe(CycleLength.CYCLES_3);
    });

    it("should not affect Port B timing", () => {
      // Port B timing should remain at default (3 cycles)
      // Note: Cycle length is set via timing byte parameter (not yet implemented)
      
      // Execute RESET_PORT_A_TIMING
      dmaDevice.writeWR6(0xc7);

      const registers = dmaDevice.getRegisters();
      expect(registers.portBTimingCycleLength).toBe(CycleLength.CYCLES_3);
    });

    it("should not affect Port B prescalar", () => {
      // Setup - set prescalar
      dmaDevice.writeWR2(0x00 | 0x40); // Base byte with timing parameter
      dmaDevice.writeWR2(0x00); // Timing byte
      dmaDevice.writeWR2(0x55); // Prescalar = 85

      // Execute RESET_PORT_A_TIMING
      dmaDevice.writeWR6(0xc7);

      const registers = dmaDevice.getRegisters();
      expect(registers.portBPrescalar).toBe(0x55);
    });

    it("should not affect DMA state", () => {
      // Execute RESET_PORT_A_TIMING
      dmaDevice.writeWR6(0xc7);
      expect(dmaDevice.getDmaState()).toBe(DmaState.IDLE);
    });

    it("should not affect status flags", () => {
      // Execute RESET_PORT_A_TIMING
      dmaDevice.writeWR6(0xc7);
      const statusFlags = dmaDevice.getStatusFlags();
      expect(statusFlags.endOfBlockReached).toBe(true);
      expect(statusFlags.atLeastOneByteTransferred).toBe(false);
    });

    it("should keep register write sequence in IDLE", () => {
      dmaDevice.writeWR6(0xc7);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });

    it("should not affect Port A address mode", () => {
      // Setup - configure Port A with decrement mode
      dmaDevice.writeWR1(0x04); // Base byte with decrement mode (D4-D3 = 00)

      // Execute RESET_PORT_A_TIMING
      dmaDevice.writeWR6(0xc7);

      const registers = dmaDevice.getRegisters();
      expect(registers.portAAddressMode).toBe(AddressMode.DECREMENT);
    });

    it("should not affect Port A I/O flag", () => {
      // Setup - configure Port A as I/O
      dmaDevice.writeWR1(0x04 | 0x08); // Base byte with I/O flag (D5)

      // Execute RESET_PORT_A_TIMING
      dmaDevice.writeWR6(0xc7);

      const registers = dmaDevice.getRegisters();
      expect(registers.portAIsIO).toBe(true);
    });
  });

  describe("RESET_PORT_B_TIMING Command (0xCB)", () => {
    it("should reset Port B timing to default (3 cycles)", () => {
      // Setup - change Port B timing to 4 cycles
      dmaDevice.writeWR2(0x00 | 0x40); // Base byte with timing parameter
      dmaDevice.writeWR2(0x00); // Timing byte (4 cycles)
      dmaDevice.writeWR2(0x55); // Prescalar

      // Execute RESET_PORT_B_TIMING
      dmaDevice.writeWR6(0xcb);

      const registers = dmaDevice.getRegisters();
      expect(registers.portBTimingCycleLength).toBe(CycleLength.CYCLES_3);
    });

    it("should reset Port B prescalar to 0", () => {
      // Setup - set prescalar to non-zero
      dmaDevice.writeWR2(0x00 | 0x40); // Base byte with timing parameter
      dmaDevice.writeWR2(0x00); // Timing byte
      dmaDevice.writeWR2(0x55); // Prescalar = 85

      // Execute RESET_PORT_B_TIMING
      dmaDevice.writeWR6(0xcb);

      const registers = dmaDevice.getRegisters();
      expect(registers.portBPrescalar).toBe(0);
    });

    it("should reset prescalar timer to 0", () => {
      // Execute RESET_PORT_B_TIMING
      dmaDevice.writeWR6(0xcb);
      expect(dmaDevice.getPrescalarTimer()).toBe(0);
    });

    it("should not affect Port A timing", () => {
      // Port A timing should remain at default (3 cycles)
      // Note: Cycle length is set via timing byte parameter (not yet implemented)
      
      // Execute RESET_PORT_B_TIMING
      dmaDevice.writeWR6(0xcb);

      const registers = dmaDevice.getRegisters();
      expect(registers.portATimingCycleLength).toBe(CycleLength.CYCLES_3);
    });

    it("should not affect DMA state", () => {
      // Execute RESET_PORT_B_TIMING
      dmaDevice.writeWR6(0xcb);
      expect(dmaDevice.getDmaState()).toBe(DmaState.IDLE);
    });

    it("should not affect status flags", () => {
      // Execute RESET_PORT_B_TIMING
      dmaDevice.writeWR6(0xcb);
      const statusFlags = dmaDevice.getStatusFlags();
      expect(statusFlags.endOfBlockReached).toBe(true);
      expect(statusFlags.atLeastOneByteTransferred).toBe(false);
    });

    it("should keep register write sequence in IDLE", () => {
      dmaDevice.writeWR6(0xcb);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });

    it("should not affect Port B address mode", () => {
      // Setup - configure Port B with fixed mode
      dmaDevice.writeWR2(0x00 | 0x20); // Base byte with fixed mode (D5-D4 = 10)

      // Execute RESET_PORT_B_TIMING
      dmaDevice.writeWR6(0xcb);

      const registers = dmaDevice.getRegisters();
      expect(registers.portBAddressMode).toBe(AddressMode.FIXED);
    });

    it("should not affect Port B I/O flag", () => {
      // Setup - configure Port B as I/O
      dmaDevice.writeWR2(0x00 | 0x08); // Base byte with I/O flag (D5)

      // Execute RESET_PORT_B_TIMING
      dmaDevice.writeWR6(0xcb);

      const registers = dmaDevice.getRegisters();
      expect(registers.portBIsIO).toBe(true);
    });
  });

  describe("DISABLE_DMA Command (0x83)", () => {
    it("should set DMA state to IDLE", () => {
      // Execute DISABLE_DMA
      dmaDevice.writeWR6(0x83);
      expect(dmaDevice.getDmaState()).toBe(DmaState.IDLE);
    });

    it("should set dmaEnabled flag to false", () => {
      // Setup - enable DMA via WR3
      dmaDevice.writeWR3(0xc0 | 0x01); // Enable DMA

      // Execute DISABLE_DMA
      dmaDevice.writeWR6(0x83);

      const registers = dmaDevice.getRegisters();
      expect(registers.dmaEnabled).toBe(false);
    });

    it("should keep register write sequence in IDLE", () => {
      dmaDevice.writeWR6(0x83);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });

    it("should not affect status flags", () => {
      // Execute DISABLE_DMA
      dmaDevice.writeWR6(0x83);
      const statusFlags = dmaDevice.getStatusFlags();
      expect(statusFlags.endOfBlockReached).toBe(true);
      expect(statusFlags.atLeastOneByteTransferred).toBe(false);
    });

    it("should not affect Port A configuration", () => {
      // Setup - configure Port A as I/O
      dmaDevice.writeWR1(0x04 | 0x08); // I/O port (D3=1)

      // Execute DISABLE_DMA
      dmaDevice.writeWR6(0x83);

      const registers = dmaDevice.getRegisters();
      expect(registers.portAIsIO).toBe(true);
      // Note: Cycle length is set via timing byte parameter (not yet implemented)
      expect(registers.portATimingCycleLength).toBe(CycleLength.CYCLES_3);
    });

    it("should not affect Port B configuration", () => {
      // Setup - configure Port B
      dmaDevice.writeWR2(0x00 | 0x08); // I/O port

      // Execute DISABLE_DMA
      dmaDevice.writeWR6(0x83);

      const registers = dmaDevice.getRegisters();
      expect(registers.portBIsIO).toBe(true);
    });

    it("should not affect transfer mode", () => {
      // Setup - configure burst mode
      dmaDevice.writeWR4(0x81 | 0x04); // Burst mode + parameters

      // Execute DISABLE_DMA
      dmaDevice.writeWR6(0x83);

      const registers = dmaDevice.getRegisters();
      expect(registers.transferMode).toBe(TransferMode.BURST);
    });

    it("should not affect auto-restart flag", () => {
      // Setup - enable auto-restart
      dmaDevice.writeWR5(0x82 | 0x20); // Enable auto-restart

      // Execute DISABLE_DMA
      dmaDevice.writeWR6(0x83);

      const registers = dmaDevice.getRegisters();
      expect(registers.autoRestart).toBe(true);
    });

    it("should not affect prescalar", () => {
      // Setup - set prescalar
      dmaDevice.writeWR2(0x00 | 0x40); // Base byte with timing parameter
      dmaDevice.writeWR2(0x00); // Timing byte
      dmaDevice.writeWR2(0x37); // Prescalar = 55

      // Execute DISABLE_DMA
      dmaDevice.writeWR6(0x83);

      const registers = dmaDevice.getRegisters();
      expect(registers.portBPrescalar).toBe(0x37);
    });

    it("should be idempotent - multiple DISABLE commands should work", () => {
      dmaDevice.writeWR6(0x83);
      dmaDevice.writeWR6(0x83);
      dmaDevice.writeWR6(0x83);

      expect(dmaDevice.getDmaState()).toBe(DmaState.IDLE);
      const registers = dmaDevice.getRegisters();
      expect(registers.dmaEnabled).toBe(false);
    });
  });

  describe("READ_MASK_FOLLOWS Command (0xBB)", () => {
    it("should transition to R6_BYTE_0 state", () => {
      dmaDevice.writeWR6(0xbb);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R6_BYTE_0);
    });

    it("should accept read mask byte in next write", () => {
      dmaDevice.writeWR6(0xbb); // READ_MASK_FOLLOWS
      dmaDevice.writeWR6(0x3f); // Read mask value

      const registers = dmaDevice.getRegisters();
      expect(registers.readMask).toBe(0x3f);
    });

    it("should mask read mask to 7 bits (0x7F)", () => {
      dmaDevice.writeWR6(0xbb); // READ_MASK_FOLLOWS
      dmaDevice.writeWR6(0xff); // Write all bits

      const registers = dmaDevice.getRegisters();
      expect(registers.readMask).toBe(0x7f); // Only lower 7 bits
    });

    it("should return to IDLE after read mask byte", () => {
      dmaDevice.writeWR6(0xbb); // READ_MASK_FOLLOWS
      dmaDevice.writeWR6(0x1f); // Read mask value

      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });

    it("should allow setting different read mask values", () => {
      // Set mask to 0x01
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x01);
      expect(dmaDevice.getRegisters().readMask).toBe(0x01);

      // Change mask to 0x7F
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x7f);
      expect(dmaDevice.getRegisters().readMask).toBe(0x7f);

      // Change mask to 0x00
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x00);
      expect(dmaDevice.getRegisters().readMask).toBe(0x00);
    });
  });

  describe("Unknown/Invalid Commands", () => {
    it("should ignore unknown command 0x00", () => {
      // Get initial state
      const initialState = dmaDevice.getDmaState();
      const initialSeq = dmaDevice.getRegisterWriteSeq();

      // Execute unknown command
      dmaDevice.writeWR6(0x00);

      // Verify state unchanged
      expect(dmaDevice.getDmaState()).toBe(initialState);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(initialSeq);
    });

    it("should ignore unknown command 0x50", () => {
      dmaDevice.writeWR6(0x50);
      expect(dmaDevice.getDmaState()).toBe(DmaState.IDLE);
    });

    it("should ignore unknown command 0xFF", () => {
      dmaDevice.writeWR6(0xff);
      expect(dmaDevice.getDmaState()).toBe(DmaState.IDLE);
    });

    it("should not corrupt state with invalid commands", () => {
      // Setup some configuration
      dmaDevice.writeWR1(0x04 | 0x08); // Port A as I/O

      // Execute invalid commands
      dmaDevice.writeWR6(0x12);
      dmaDevice.writeWR6(0x34);
      dmaDevice.writeWR6(0x56);

      // Verify configuration preserved
      const registers = dmaDevice.getRegisters();
      expect(registers.portAIsIO).toBe(true);
    });
  });

  describe("Command Sequencing", () => {
    it("should execute multiple commands in sequence", () => {
      // Reset timing
      dmaDevice.writeWR6(0xc7);
      expect(dmaDevice.getRegisters().portATimingCycleLength).toBe(CycleLength.CYCLES_3);

      // Reset Port B timing
      dmaDevice.writeWR6(0xcb);
      expect(dmaDevice.getRegisters().portBTimingCycleLength).toBe(CycleLength.CYCLES_3);

      // Disable DMA
      dmaDevice.writeWR6(0x83);
      expect(dmaDevice.getDmaState()).toBe(DmaState.IDLE);
    });

    it("should handle RESET after configuration", () => {
      // Configure multiple registers
      dmaDevice.writeWR1(0x04 | 0x08); // Port A as I/O
      dmaDevice.writeWR2(0x00 | 0x40); // Port B with timing
      dmaDevice.writeWR2(0x00); // Timing byte
      dmaDevice.writeWR2(0x55); // Prescalar
      dmaDevice.writeWR5(0x82 | 0x20); // Auto-restart

      // Execute RESET
      dmaDevice.writeWR6(0xc3);

      // Verify reset behavior
      const registers = dmaDevice.getRegisters();
      expect(registers.portBPrescalar).toBe(0);
      expect(registers.autoRestart).toBe(false);
      expect(registers.portATimingCycleLength).toBe(CycleLength.CYCLES_3);
    });

    it("should handle commands interleaved with register writes", () => {
      // Write register
      dmaDevice.writeWR1(0x04);

      // Execute command
      dmaDevice.writeWR6(0xc7);

      // Write another register
      dmaDevice.writeWR2(0x00);

      // Execute another command
      dmaDevice.writeWR6(0xcb);

      // All should work correctly
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });
  });

  describe("Edge Cases", () => {
    it("should handle RESET on already reset device", () => {
      dmaDevice.reset();
      dmaDevice.writeWR6(0xc3);

      expect(dmaDevice.getDmaState()).toBe(DmaState.IDLE);
      expect(dmaDevice.getStatusFlags().endOfBlockReached).toBe(true);
    });

    it("should handle DISABLE_DMA when already disabled", () => {
      dmaDevice.writeWR6(0x83);
      dmaDevice.writeWR6(0x83);

      expect(dmaDevice.getDmaState()).toBe(DmaState.IDLE);
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(false);
    });

    it("should handle timing reset when already at default", () => {
      dmaDevice.writeWR6(0xc7);
      dmaDevice.writeWR6(0xcb);

      const registers = dmaDevice.getRegisters();
      expect(registers.portATimingCycleLength).toBe(CycleLength.CYCLES_3);
      expect(registers.portBTimingCycleLength).toBe(CycleLength.CYCLES_3);
    });

    it("should preserve DMA mode through commands", () => {
      dmaDevice.setDmaMode(DmaMode.LEGACY);
      dmaDevice.writeWR6(0xc3); // RESET

      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
    });

    it("should preserve transfer state through non-reset commands", () => {
      // These would be set during a transfer (not testable yet)
      const initialTransferState = dmaDevice.getTransferState();

      // Execute non-reset commands
      dmaDevice.writeWR6(0xc7);
      dmaDevice.writeWR6(0xcb);
      dmaDevice.writeWR6(0x83);

      const finalTransferState = dmaDevice.getTransferState();
      expect(finalTransferState).toEqual(initialTransferState);
    });
  });
});
