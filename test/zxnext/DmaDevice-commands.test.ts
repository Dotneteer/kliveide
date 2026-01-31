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

describe("DmaDevice - Step 6: WR6 Command Register - Transfer Commands", () => {
  let machine: TestZxNextMachine;
  let dmaDevice: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dmaDevice = machine.dmaDevice;
  });

  describe("LOAD Command (0xCF)", () => {
    it("should load addresses with A→B direction", () => {
      // Configure Port A and Port B addresses
      dmaDevice.writeWR0(0x40); // D6=1 (A→B direction)
      dmaDevice.writeWR0(0x00); // Port A low = 0x00
      dmaDevice.writeWR0(0x10); // Port A high = 0x10
      dmaDevice.writeWR0(0x00); // Block length low
      dmaDevice.writeWR0(0x01); // Block length high

      dmaDevice.writeWR4(0x01); // Continuous mode
      dmaDevice.writeWR4(0x00); // Port B low = 0x00
      dmaDevice.writeWR4(0x20); // Port B high = 0x20

      // Execute LOAD
      dmaDevice.writeWR6(0xcf);

      const transferState = dmaDevice.getTransferState();
      expect(transferState.sourceAddress).toBe(0x1000); // Port A
      expect(transferState.destAddress).toBe(0x2000);   // Port B
    });

    it("should load addresses with B→A direction", () => {
      // Configure Port A and Port B addresses
      dmaDevice.writeWR0(0x00); // D6=0 (B→A direction)
      dmaDevice.writeWR0(0x00); // Port A low = 0x00
      dmaDevice.writeWR0(0x10); // Port A high = 0x10
      dmaDevice.writeWR0(0x00); // Block length low
      dmaDevice.writeWR0(0x01); // Block length high

      dmaDevice.writeWR4(0x01); // Continuous mode
      dmaDevice.writeWR4(0x00); // Port B low = 0x00
      dmaDevice.writeWR4(0x20); // Port B high = 0x20

      // Execute LOAD
      dmaDevice.writeWR6(0xcf);

      const transferState = dmaDevice.getTransferState();
      expect(transferState.sourceAddress).toBe(0x2000); // Port B
      expect(transferState.destAddress).toBe(0x1000);   // Port A
    });

    it("should reset byte counter to 0", () => {
      // Configure addresses
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      // Execute LOAD
      dmaDevice.writeWR6(0xcf);

      const transferState = dmaDevice.getTransferState();
      expect(transferState.byteCounter).toBe(0);
    });

    it("should keep register write sequence in IDLE", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xcf);

      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });

    it("should handle multiple LOAD commands", () => {
      // Configure first addresses
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xcf);
      let transferState = dmaDevice.getTransferState();
      expect(transferState.sourceAddress).toBe(0x1000);

      // Change Port A address
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x30);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      // Execute LOAD again
      dmaDevice.writeWR6(0xcf);
      transferState = dmaDevice.getTransferState();
      expect(transferState.sourceAddress).toBe(0x3000);
    });

    it("should work with zero addresses", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x00);

      dmaDevice.writeWR6(0xcf);

      const transferState = dmaDevice.getTransferState();
      expect(transferState.sourceAddress).toBe(0x0000);
      expect(transferState.destAddress).toBe(0x0000);
    });

    it("should work with maximum addresses", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0xff);
      dmaDevice.writeWR0(0xff);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0xff);
      dmaDevice.writeWR4(0xff);

      dmaDevice.writeWR6(0xcf);

      const transferState = dmaDevice.getTransferState();
      expect(transferState.sourceAddress).toBe(0xffff);
      expect(transferState.destAddress).toBe(0xffff);
    });
  });

  describe("CONTINUE Command (0xD3)", () => {
    it("should reset byte counter to 0", () => {
      // Setup addresses first
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xcf); // LOAD

      // Simulate counter increment (would happen during transfer)
      // For now, just verify CONTINUE resets it

      dmaDevice.writeWR6(0xd3); // CONTINUE

      const transferState = dmaDevice.getTransferState();
      expect(transferState.byteCounter).toBe(0);
    });

    it("should preserve source address", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xcf); // LOAD
      const beforeContinue = dmaDevice.getTransferState();

      dmaDevice.writeWR6(0xd3); // CONTINUE
      const afterContinue = dmaDevice.getTransferState();

      expect(afterContinue.sourceAddress).toBe(beforeContinue.sourceAddress);
    });

    it("should preserve destination address", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xcf); // LOAD
      const beforeContinue = dmaDevice.getTransferState();

      dmaDevice.writeWR6(0xd3); // CONTINUE
      const afterContinue = dmaDevice.getTransferState();

      expect(afterContinue.destAddress).toBe(beforeContinue.destAddress);
    });

    it("should keep register write sequence in IDLE", () => {
      dmaDevice.writeWR6(0xd3);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });

    it("should work multiple times", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xcf); // LOAD

      // Execute CONTINUE multiple times
      dmaDevice.writeWR6(0xd3);
      dmaDevice.writeWR6(0xd3);
      dmaDevice.writeWR6(0xd3);

      const transferState = dmaDevice.getTransferState();
      expect(transferState.byteCounter).toBe(0);
      expect(transferState.sourceAddress).toBe(0x1000);
      expect(transferState.destAddress).toBe(0x2000);
    });

    it("should work without prior LOAD command", () => {
      // CONTINUE should work even if addresses weren't loaded
      dmaDevice.writeWR6(0xd3);

      const transferState = dmaDevice.getTransferState();
      expect(transferState.byteCounter).toBe(0);
    });
  });

  describe("ENABLE_DMA Command (0x87)", () => {
    it("should enable DMA", () => {
      dmaDevice.writeWR6(0x87);

      const registers = dmaDevice.getRegisters();
      expect(registers.dmaEnabled).toBe(true);
    });

    it("should initialize counter to 0 in zxnDMA mode", () => {
      dmaDevice.setDmaMode(DmaMode.ZXNDMA);
      dmaDevice.writeWR6(0x87);

      const transferState = dmaDevice.getTransferState();
      expect(transferState.byteCounter).toBe(0);
    });

    it("should initialize counter to -1 (0xFFFF) in legacy mode", () => {
      dmaDevice.setDmaMode(DmaMode.LEGACY);
      dmaDevice.writeWR6(0x87);

      const transferState = dmaDevice.getTransferState();
      expect(transferState.byteCounter).toBe(0xFFFF);
    });

    it("should set DMA state to IDLE (ready for transfer)", () => {
      dmaDevice.writeWR6(0x87);

      expect(dmaDevice.getDmaState()).toBe(DmaState.IDLE);
    });

    it("should keep register write sequence in IDLE", () => {
      dmaDevice.writeWR6(0x87);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });

    it("should enable DMA even if previously disabled", () => {
      // Disable first
      dmaDevice.writeWR6(0x83); // DISABLE_DMA
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(false);

      // Enable
      dmaDevice.writeWR6(0x87);
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(true);
    });

    it("should work multiple times", () => {
      dmaDevice.setDmaMode(DmaMode.ZXNDMA);

      dmaDevice.writeWR6(0x87);
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(true);

      dmaDevice.writeWR6(0x87);
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(true);
      expect(dmaDevice.getTransferState().byteCounter).toBe(0);
    });

    it("should switch counter value when mode changes", () => {
      dmaDevice.setDmaMode(DmaMode.ZXNDMA);
      dmaDevice.writeWR6(0x87);
      expect(dmaDevice.getTransferState().byteCounter).toBe(0);

      dmaDevice.setDmaMode(DmaMode.LEGACY);
      dmaDevice.writeWR6(0x87);
      expect(dmaDevice.getTransferState().byteCounter).toBe(0xFFFF);

      dmaDevice.setDmaMode(DmaMode.ZXNDMA);
      dmaDevice.writeWR6(0x87);
      expect(dmaDevice.getTransferState().byteCounter).toBe(0);
    });
  });

  describe("Command Sequencing", () => {
    it("should execute LOAD then ENABLE in sequence", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xcf); // LOAD
      dmaDevice.writeWR6(0x87); // ENABLE

      const transferState = dmaDevice.getTransferState();
      expect(transferState.sourceAddress).toBe(0x1000);
      expect(transferState.destAddress).toBe(0x2000);
      expect(transferState.byteCounter).toBe(0);
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(true);
    });

    it("should execute LOAD, CONTINUE, then ENABLE", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xcf); // LOAD
      dmaDevice.writeWR6(0xd3); // CONTINUE
      dmaDevice.writeWR6(0x87); // ENABLE

      const transferState = dmaDevice.getTransferState();
      expect(transferState.byteCounter).toBe(0);
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(true);
    });

    it("should handle DISABLE after ENABLE", () => {
      dmaDevice.writeWR6(0x87); // ENABLE
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(true);

      dmaDevice.writeWR6(0x83); // DISABLE
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(false);
    });

    it("should allow LOAD after ENABLE", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0x87); // ENABLE first
      dmaDevice.writeWR6(0xcf); // Then LOAD

      const transferState = dmaDevice.getTransferState();
      expect(transferState.sourceAddress).toBe(0x1000);
      expect(transferState.byteCounter).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle CONTINUE before LOAD", () => {
      // CONTINUE should work even without LOAD
      dmaDevice.writeWR6(0xd3);

      const transferState = dmaDevice.getTransferState();
      expect(transferState.byteCounter).toBe(0);
      expect(transferState.sourceAddress).toBe(0);
      expect(transferState.destAddress).toBe(0);
    });

    it("should handle ENABLE before LOAD", () => {
      dmaDevice.setDmaMode(DmaMode.ZXNDMA);
      dmaDevice.writeWR6(0x87);

      expect(dmaDevice.getRegisters().dmaEnabled).toBe(true);
      expect(dmaDevice.getTransferState().byteCounter).toBe(0);
    });

    it("should preserve addresses through RESET and LOAD", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xc3); // RESET (clears transfer state)
      dmaDevice.writeWR6(0xcf); // LOAD (reloads from registers)

      const transferState = dmaDevice.getTransferState();
      expect(transferState.sourceAddress).toBe(0x1000);
      expect(transferState.destAddress).toBe(0x2000);
    });

    it("should handle all three commands in quick succession", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xcf); // LOAD
      dmaDevice.writeWR6(0xd3); // CONTINUE
      dmaDevice.writeWR6(0x87); // ENABLE

      const transferState = dmaDevice.getTransferState();
      expect(transferState.sourceAddress).toBe(0x1000);
      expect(transferState.destAddress).toBe(0x2000);
      expect(transferState.byteCounter).toBe(0);
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(true);
    });
  });
});

describe("DmaDevice - Step 7: WR6 Command Register - Read Operations", () => {
  let machine: TestZxNextMachine;
  let dmaDevice: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dmaDevice = machine.dmaDevice;
  });

  describe("READ_STATUS_BYTE Command (0xBF)", () => {
    it("should set read sequence to RD_STATUS", () => {
      dmaDevice.writeWR6(0xbf);
      expect(dmaDevice.getRegisterReadSeq()).toBe(0); // RD_STATUS = 0
    });

    it("should keep register write sequence in IDLE", () => {
      dmaDevice.writeWR6(0xbf);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(0); // IDLE = 0
    });

    it("should return status byte with correct format", () => {
      dmaDevice.writeWR6(0xbf);
      const status = dmaDevice.readStatusByte();
      
      // Status format: 00E1101T
      // Initially: endOfBlockReached=true (E bit=0), atLeastOneByteTransferred=false (T=0)
      // Binary: 00011010 = 0x1A
      expect(status).toBe(0x1a);
    });

    it("should reflect endOfBlockReached flag correctly", () => {
      // Initially endOfBlockReached is true (so E bit should be 0)
      dmaDevice.writeWR6(0xbf);
      let status = dmaDevice.readStatusByte();
      
      // E bit is inverted: endOfBlockReached=true means E=0
      // Format: 00E1101T with E=0, T=0 -> 00011010 = 0x1A
      expect(status).toBe(0x1a);
    });

    it("should reflect atLeastOneByteTransferred flag correctly", () => {
      // After reset, atLeastOneByteTransferred is false
      dmaDevice.writeWR6(0xc3); // RESET sets atLeastOneByteTransferred=false
      dmaDevice.writeWR6(0xbf);
      const status = dmaDevice.readStatusByte();
      
      // T bit should be 0
      expect(status & 0x01).toBe(0);
    });

    it("should work multiple times", () => {
      dmaDevice.writeWR6(0xbf);
      const status1 = dmaDevice.readStatusByte();
      
      dmaDevice.writeWR6(0xbf);
      const status2 = dmaDevice.readStatusByte();
      
      expect(status1).toBe(status2);
    });
  });

  describe("INITIALIZE_READ_SEQUENCE Command (0xA7)", () => {
    it("should set read sequence to RD_STATUS", () => {
      dmaDevice.writeWR6(0xa7);
      expect(dmaDevice.getRegisterReadSeq()).toBe(0); // RD_STATUS = 0
    });

    it("should keep register write sequence in IDLE", () => {
      dmaDevice.writeWR6(0xa7);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(0); // IDLE = 0
    });

    it("should reset read sequence even if already reading", () => {
      // Configure read mask to include counter
      dmaDevice.writeWR6(0xbb); // READ_MASK_FOLLOWS
      dmaDevice.writeWR6(0x7f); // All registers
      
      dmaDevice.writeWR6(0xa7); // INITIALIZE_READ_SEQUENCE
      dmaDevice.readStatusByte(); // Read status
      
      // After reading status, should advance to next position
      expect(dmaDevice.getRegisterReadSeq()).not.toBe(0);
      
      // Reinitialize should reset to status
      dmaDevice.writeWR6(0xa7);
      expect(dmaDevice.getRegisterReadSeq()).toBe(0);
    });

    it("should work with different read masks", () => {
      // Set read mask for counter only
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x60); // Counter low + high
      
      dmaDevice.writeWR6(0xa7);
      expect(dmaDevice.getRegisterReadSeq()).toBe(0);
    });

    it("should allow reading full sequence", () => {
      // Setup addresses and counter
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xcf); // LOAD

      // Set full read mask
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x7f);

      dmaDevice.writeWR6(0xa7); // INITIALIZE_READ_SEQUENCE

      // Read status
      const status = dmaDevice.readStatusByte();
      expect(status).toBe(0x1a);

      // Read counter low
      const counterLo = dmaDevice.readStatusByte();
      expect(counterLo).toBe(0x00);

      // Read counter high
      const counterHi = dmaDevice.readStatusByte();
      expect(counterHi).toBe(0x00);

      // Read Port A low
      const portALo = dmaDevice.readStatusByte();
      expect(portALo).toBe(0x00);

      // Read Port A high
      const portAHi = dmaDevice.readStatusByte();
      expect(portAHi).toBe(0x10);

      // Read Port B low
      const portBLo = dmaDevice.readStatusByte();
      expect(portBLo).toBe(0x00);

      // Read Port B high
      const portBHi = dmaDevice.readStatusByte();
      expect(portBHi).toBe(0x20);
    });
  });

  describe("REINITIALIZE_STATUS_BYTE Command (0x8B)", () => {
    it("should reset endOfBlockReached to true", () => {
      dmaDevice.writeWR6(0x8b);
      const statusFlags = dmaDevice.getStatusFlags();
      expect(statusFlags.endOfBlockReached).toBe(true);
    });

    it("should reset atLeastOneByteTransferred to false", () => {
      dmaDevice.writeWR6(0x8b);
      const statusFlags = dmaDevice.getStatusFlags();
      expect(statusFlags.atLeastOneByteTransferred).toBe(false);
    });

    it("should set read sequence to RD_STATUS", () => {
      dmaDevice.writeWR6(0x8b);
      expect(dmaDevice.getRegisterReadSeq()).toBe(0);
    });

    it("should keep register write sequence in IDLE", () => {
      dmaDevice.writeWR6(0x8b);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(0);
    });

    it("should work multiple times", () => {
      dmaDevice.writeWR6(0x8b);
      dmaDevice.writeWR6(0x8b);
      dmaDevice.writeWR6(0x8b);

      const statusFlags = dmaDevice.getStatusFlags();
      expect(statusFlags.endOfBlockReached).toBe(true);
      expect(statusFlags.atLeastOneByteTransferred).toBe(false);
    });
  });

  describe("READ_MASK_FOLLOWS Command (0xBB) - Read Mask Configuration", () => {
    it("should store read mask correctly", () => {
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x7f); // All bits set
      
      const registers = dmaDevice.getRegisters();
      expect(registers.readMask).toBe(0x7f);
    });

    it("should mask to 7 bits", () => {
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0xff); // All 8 bits
      
      const registers = dmaDevice.getRegisters();
      expect(registers.readMask).toBe(0x7f); // Only 7 bits stored
    });

    it("should accept zero mask", () => {
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x00);
      
      const registers = dmaDevice.getRegisters();
      expect(registers.readMask).toBe(0x00);
    });

    it("should accept partial mask", () => {
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x60); // Counter only (bits 6-5)
      
      const registers = dmaDevice.getRegisters();
      expect(registers.readMask).toBe(0x60);
    });

    it("should allow updating mask multiple times", () => {
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x40);
      expect(dmaDevice.getRegisters().readMask).toBe(0x40);
      
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x20);
      expect(dmaDevice.getRegisters().readMask).toBe(0x20);
    });
  });

  describe("Read Mask Filtering", () => {
    beforeEach(() => {
      // Setup addresses and counter
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x34);
      dmaDevice.writeWR0(0x12);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x78);
      dmaDevice.writeWR4(0x56);

      dmaDevice.writeWR6(0xcf); // LOAD
    });

    it("should read only counter with mask 0x60", () => {
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x60); // Counter low + high

      dmaDevice.writeWR6(0xa7);

      // Status
      const status = dmaDevice.readStatusByte();
      expect(status).toBe(0x1a);

      // Counter low
      const counterLo = dmaDevice.readStatusByte();
      expect(counterLo).toBe(0x00);

      // Counter high
      const counterHi = dmaDevice.readStatusByte();
      expect(counterHi).toBe(0x00);

      // Should wrap back to status
      const status2 = dmaDevice.readStatusByte();
      expect(status2).toBe(0x1a);
    });

    it("should read only Port A with mask 0x18", () => {
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x18); // Port A low + high

      dmaDevice.writeWR6(0xa7);

      // Status
      const status = dmaDevice.readStatusByte();
      expect(status).toBe(0x1a);

      // Port A low
      const portALo = dmaDevice.readStatusByte();
      expect(portALo).toBe(0x34);

      // Port A high
      const portAHi = dmaDevice.readStatusByte();
      expect(portAHi).toBe(0x12);

      // Should wrap back to status
      const status2 = dmaDevice.readStatusByte();
      expect(status2).toBe(0x1a);
    });

    it("should read only Port B with mask 0x06", () => {
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x06); // Port B low + high

      dmaDevice.writeWR6(0xa7);

      // Status
      const status = dmaDevice.readStatusByte();
      expect(status).toBe(0x1a);

      // Port B low
      const portBLo = dmaDevice.readStatusByte();
      expect(portBLo).toBe(0x78);

      // Port B high
      const portBHi = dmaDevice.readStatusByte();
      expect(portBHi).toBe(0x56);

      // Should wrap back to status
      const status2 = dmaDevice.readStatusByte();
      expect(status2).toBe(0x1a);
    });

    it("should read only status with mask 0x00", () => {
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x00); // No registers

      dmaDevice.writeWR6(0xa7);

      // Status
      const status1 = dmaDevice.readStatusByte();
      expect(status1).toBe(0x1a);

      // Should immediately wrap to status
      const status2 = dmaDevice.readStatusByte();
      expect(status2).toBe(0x1a);
    });

    it("should read specific combination with mask 0x50", () => {
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x50); // Counter low + Port A low

      dmaDevice.writeWR6(0xa7);

      // Status
      const status = dmaDevice.readStatusByte();
      expect(status).toBe(0x1a);

      // Counter low
      const counterLo = dmaDevice.readStatusByte();
      expect(counterLo).toBe(0x00);

      // Port A low
      const portALo = dmaDevice.readStatusByte();
      expect(portALo).toBe(0x34);

      // Wrap to status
      const status2 = dmaDevice.readStatusByte();
      expect(status2).toBe(0x1a);
    });
  });

  describe("Command Sequencing", () => {
    it("should allow READ_STATUS_BYTE after LOAD", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x10);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x01);

      dmaDevice.writeWR4(0x01);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x20);

      dmaDevice.writeWR6(0xcf); // LOAD
      dmaDevice.writeWR6(0xbf); // READ_STATUS_BYTE

      const status = dmaDevice.readStatusByte();
      expect(status).toBe(0x1a);
    });

    it("should allow REINITIALIZE after INITIALIZE", () => {
      dmaDevice.writeWR6(0xa7); // INITIALIZE
      dmaDevice.writeWR6(0x8b); // REINITIALIZE

      const statusFlags = dmaDevice.getStatusFlags();
      expect(statusFlags.endOfBlockReached).toBe(true);
      expect(statusFlags.atLeastOneByteTransferred).toBe(false);
    });

    it("should handle READ_MASK_FOLLOWS before INITIALIZE", () => {
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x7f);
      dmaDevice.writeWR6(0xa7);

      expect(dmaDevice.getRegisterReadSeq()).toBe(0);
    });

    it("should work with RESET then read commands", () => {
      dmaDevice.writeWR6(0xc3); // RESET
      dmaDevice.writeWR6(0xbf); // READ_STATUS_BYTE

      const status = dmaDevice.readStatusByte();
      // After RESET: endOfBlock=true, atLeastOneByte=false
      // E=0 (inverted), T=0 -> 00011010 = 0x1A
      expect(status).toBe(0x1a);
    });
  });

  describe("Edge Cases", () => {
    it("should handle reading before any LOAD", () => {
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x7f);
      dmaDevice.writeWR6(0xa7);

      const status = dmaDevice.readStatusByte();
      expect(status).toBe(0x1a);

      // Should read zeros for addresses/counter
      const counterLo = dmaDevice.readStatusByte();
      expect(counterLo).toBe(0x00);
    });

    it("should handle multiple sequential reads", () => {
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x60); // Counter only

      dmaDevice.writeWR6(0xa7);

      // Read sequence multiple times
      for (let i = 0; i < 3; i++) {
        const status = dmaDevice.readStatusByte();
        expect(status).toBe(0x1a);

        const counterLo = dmaDevice.readStatusByte();
        expect(counterLo).toBe(0x00);

        const counterHi = dmaDevice.readStatusByte();
        expect(counterHi).toBe(0x00);
      }
    });

    it("should preserve read mask through RESET", () => {
      dmaDevice.writeWR6(0xbb);
      dmaDevice.writeWR6(0x42);

      dmaDevice.writeWR6(0xc3); // RESET

      const registers = dmaDevice.getRegisters();
      // RESET does not clear readMask - it's preserved
      expect(registers.readMask).toBe(0x42);
    });

    it("should handle all commands in sequence", () => {
      dmaDevice.writeWR6(0xbb); // READ_MASK_FOLLOWS
      dmaDevice.writeWR6(0x7f);

      dmaDevice.writeWR6(0x8b); // REINITIALIZE_STATUS_BYTE
      dmaDevice.writeWR6(0xa7); // INITIALIZE_READ_SEQUENCE
      dmaDevice.writeWR6(0xbf); // READ_STATUS_BYTE

      const status = dmaDevice.readStatusByte();
      expect(status).toBe(0x1a);
    });
  });
});
