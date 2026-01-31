import { describe, it, expect, beforeEach } from "vitest";
import {
  DmaDevice,
  DmaState,
  RegisterWriteSequence,
  RegisterReadSequence,
  AddressMode,
  TransferMode,
  CycleLength,
  DmaMode
} from "@emu/machines/zxNext/DmaDevice";
import { TestZxNextMachine } from "./TestNextMachine";

describe("DmaDevice - Step 1: Core Data Structures", () => {
  let machine: TestZxNextMachine;
  let dmaDevice: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dmaDevice = machine.dmaDevice;
  });

  describe("Initialization and Reset", () => {
    it("should initialize with IDLE state", () => {
      expect(dmaDevice.getDmaState()).toBe(DmaState.IDLE);
    });

    it("should initialize with IDLE register write sequence", () => {
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });

    it("should initialize with RD_STATUS register read sequence", () => {
      expect(dmaDevice.getRegisterReadSeq()).toBe(RegisterReadSequence.RD_STATUS);
    });

    it("should initialize with zxnDMA mode", () => {
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.ZXNDMA);
    });

    it("should initialize prescalar timer to 0", () => {
      expect(dmaDevice.getPrescalarTimer()).toBe(0);
    });

    it("should reset to initial state", () => {
      dmaDevice.reset();
      expect(dmaDevice.getDmaState()).toBe(DmaState.IDLE);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
      expect(dmaDevice.getPrescalarTimer()).toBe(0);
    });
  });

  describe("Register State Initialization", () => {
    it("should initialize WR0 registers correctly", () => {
      const registers = dmaDevice.getRegisters();
      expect(registers.directionAtoB).toBe(true);
      expect(registers.portAStartAddress).toBe(0);
      expect(registers.blockLength).toBe(0);
    });

    it("should initialize WR1 registers correctly", () => {
      const registers = dmaDevice.getRegisters();
      expect(registers.portAIsIO).toBe(false);
      expect(registers.portAAddressMode).toBe(AddressMode.INCREMENT);
      expect(registers.portATimingCycleLength).toBe(CycleLength.CYCLES_3);
    });

    it("should initialize WR2 registers correctly", () => {
      const registers = dmaDevice.getRegisters();
      expect(registers.portBIsIO).toBe(false);
      expect(registers.portBAddressMode).toBe(AddressMode.INCREMENT);
      expect(registers.portBTimingCycleLength).toBe(CycleLength.CYCLES_3);
      expect(registers.portBPrescalar).toBe(0);
    });

    it("should initialize WR4 registers correctly", () => {
      const registers = dmaDevice.getRegisters();
      expect(registers.transferMode).toBe(TransferMode.CONTINUOUS);
      expect(registers.portBStartAddress).toBe(0);
    });

    it("should initialize WR5 registers correctly", () => {
      const registers = dmaDevice.getRegisters();
      expect(registers.ceWaitMultiplexed).toBe(false);
      expect(registers.autoRestart).toBe(false);
    });

    it("should initialize WR6 registers correctly", () => {
      const registers = dmaDevice.getRegisters();
      expect(registers.readMask).toBe(0x7f);
      expect(registers.dmaEnabled).toBe(false);
    });
  });

  describe("Transfer State Initialization", () => {
    it("should initialize source address to 0", () => {
      const transferState = dmaDevice.getTransferState();
      expect(transferState.sourceAddress).toBe(0);
    });

    it("should initialize destination address to 0", () => {
      const transferState = dmaDevice.getTransferState();
      expect(transferState.destAddress).toBe(0);
    });

    it("should initialize byte counter to 0", () => {
      const transferState = dmaDevice.getTransferState();
      expect(transferState.byteCounter).toBe(0);
    });
  });

  describe("Status Flags Initialization", () => {
    it("should initialize atLeastOneByteTransferred to false", () => {
      const statusFlags = dmaDevice.getStatusFlags();
      expect(statusFlags.atLeastOneByteTransferred).toBe(false);
    });

    it("should initialize endOfBlockReached to true", () => {
      const statusFlags = dmaDevice.getStatusFlags();
      expect(statusFlags.endOfBlockReached).toBe(true);
    });
  });

  describe("DMA Mode Management", () => {
    it("should allow setting DMA mode to LEGACY", () => {
      dmaDevice.setDmaMode(DmaMode.LEGACY);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
    });

    it("should allow setting DMA mode back to ZXNDMA", () => {
      dmaDevice.setDmaMode(DmaMode.LEGACY);
      dmaDevice.setDmaMode(DmaMode.ZXNDMA);
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.ZXNDMA);
    });

    it("should maintain mode across other operations", () => {
      dmaDevice.setDmaMode(DmaMode.LEGACY);
      const registers = dmaDevice.getRegisters();
      expect(registers).toBeDefined();
      expect(dmaDevice.getDmaMode()).toBe(DmaMode.LEGACY);
    });
  });

  describe("Enum Values - Positive Cases", () => {
    it("DmaState enum should have all required states", () => {
      expect(DmaState.IDLE).toBe(0);
      expect(DmaState.START_DMA).toBe(1);
      expect(DmaState.WAITING_ACK).toBe(2);
      expect(DmaState.TRANSFERRING_READ_1).toBe(3);
      expect(DmaState.TRANSFERRING_READ_4).toBe(6);
      expect(DmaState.TRANSFERRING_WRITE_1).toBe(7);
      expect(DmaState.FINISH_DMA).toBe(12);
    });

    it("RegisterWriteSequence enum should have all required sequences", () => {
      expect(RegisterWriteSequence.IDLE).toBe(0);
      expect(RegisterWriteSequence.R0_BYTE_0).toBe(1);
      expect(RegisterWriteSequence.R0_BYTE_3).toBe(4);
      expect(RegisterWriteSequence.R6_BYTE_0).toBe(16);
    });

    it("RegisterReadSequence enum should have all required sequences", () => {
      expect(RegisterReadSequence.RD_STATUS).toBe(0);
      expect(RegisterReadSequence.RD_COUNTER_LO).toBe(1);
      expect(RegisterReadSequence.RD_PORT_B_HI).toBe(6);
    });

    it("AddressMode enum should have all modes", () => {
      expect(AddressMode.DECREMENT).toBe(0);
      expect(AddressMode.INCREMENT).toBe(1);
      expect(AddressMode.FIXED).toBe(2);
    });

    it("TransferMode enum should have all modes", () => {
      expect(TransferMode.CONTINUOUS).toBe(1);
      expect(TransferMode.BURST).toBe(2);
    });

    it("CycleLength enum should have all lengths", () => {
      expect(CycleLength.CYCLES_4).toBe(0);
      expect(CycleLength.CYCLES_3).toBe(1);
      expect(CycleLength.CYCLES_2).toBe(2);
    });

    it("DmaMode enum should have both modes", () => {
      expect(DmaMode.ZXNDMA).toBe(0);
      expect(DmaMode.LEGACY).toBe(1);
    });
  });

  describe("State Isolation - Negative Cases", () => {
    it("resetting should not affect other instances", () => {
      const machine2 = new TestZxNextMachine();
      const dmaDevice2 = machine2.dmaDevice;

      dmaDevice.setDmaMode(DmaMode.LEGACY);
      dmaDevice.reset();

      expect(dmaDevice.getDmaMode()).toBe(DmaMode.ZXNDMA);
      expect(dmaDevice2.getDmaMode()).toBe(DmaMode.ZXNDMA);
    });

    it("modifying returned register state should not affect internal state", () => {
      const registers = dmaDevice.getRegisters();
      (registers as any).blockLength = 9999;

      expect(dmaDevice.getRegisters().blockLength).toBe(0);
    });

    it("modifying returned transfer state should not affect internal state", () => {
      const transferState = dmaDevice.getTransferState();
      (transferState as any).byteCounter = 5555;

      expect(dmaDevice.getTransferState().byteCounter).toBe(0);
    });

    it("modifying returned status flags should not affect internal state", () => {
      const statusFlags = dmaDevice.getStatusFlags();
      (statusFlags as any).atLeastOneByteTransferred = true;

      expect(dmaDevice.getStatusFlags().atLeastOneByteTransferred).toBe(false);
    });
  });

  describe("Edge Cases - Boundary Values", () => {
    it("should handle 16-bit max address value", () => {
      const registers = dmaDevice.getRegisters();
      expect(registers.portAStartAddress).toBeGreaterThanOrEqual(0);
      expect(registers.portAStartAddress).toBeLessThanOrEqual(0xffff);
    });

    it("should handle 16-bit max block length value", () => {
      const registers = dmaDevice.getRegisters();
      expect(registers.blockLength).toBeGreaterThanOrEqual(0);
      expect(registers.blockLength).toBeLessThanOrEqual(0xffff);
    });

    it("should handle 8-bit max prescalar value", () => {
      const registers = dmaDevice.getRegisters();
      expect(registers.portBPrescalar).toBeGreaterThanOrEqual(0);
      expect(registers.portBPrescalar).toBeLessThanOrEqual(0xff);
    });
  });

  describe("State Getters - Consistency", () => {
    it("should return consistent state across multiple calls", () => {
      const state1 = dmaDevice.getDmaState();
      const state2 = dmaDevice.getDmaState();
      expect(state1).toBe(state2);
    });

    it("should return consistent registers across multiple calls", () => {
      const registers1 = dmaDevice.getRegisters();
      const registers2 = dmaDevice.getRegisters();
      expect(registers1).toEqual(registers2);
    });

    it("should return consistent transfer state across multiple calls", () => {
      const transferState1 = dmaDevice.getTransferState();
      const transferState2 = dmaDevice.getTransferState();
      expect(transferState1).toEqual(transferState2);
    });

    it("should return consistent status flags across multiple calls", () => {
      const statusFlags1 = dmaDevice.getStatusFlags();
      const statusFlags2 = dmaDevice.getStatusFlags();
      expect(statusFlags1).toEqual(statusFlags2);
    });
  });
});

describe("DmaDevice - Step 2: Register Write Sequencing (WR0)", () => {
  let machine: TestZxNextMachine;
  let dmaDevice: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dmaDevice = machine.dmaDevice;
  });

  describe("WR0 Base Byte - Direction Flag", () => {
    it("should set direction flag when D6=1 (A->B)", () => {
      dmaDevice.writeWR0(0x40); // D6=1
      expect(dmaDevice.getRegisters().directionAtoB).toBe(true);
    });

    it("should clear direction flag when D6=0 (B->A)", () => {
      dmaDevice.writeWR0(0x00); // D6=0
      expect(dmaDevice.getRegisters().directionAtoB).toBe(false);
    });

    it("should set direction flag with other bits set", () => {
      dmaDevice.writeWR0(0x7f); // D6=1, all other bits set
      expect(dmaDevice.getRegisters().directionAtoB).toBe(true);
    });

    it("should transition to R0_BYTE_0 sequence after base byte", () => {
      dmaDevice.writeWR0(0x40);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R0_BYTE_0);
    });
  });

  describe("WR0 Parameter Sequencing", () => {
    it("should sequence through all WR0 parameters in order", () => {
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
      
      dmaDevice.writeWR0(0x40); // Base byte
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R0_BYTE_0);
      
      dmaDevice.writeWR0(0x00); // Port A address low
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R0_BYTE_1);
      
      dmaDevice.writeWR0(0x10); // Port A address high
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R0_BYTE_2);
      
      dmaDevice.writeWR0(0x20); // Block length low
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R0_BYTE_3);
      
      dmaDevice.writeWR0(0x04); // Block length high
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });

    it("should return to IDLE after complete WR0 sequence", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });

    it("should allow starting new WR0 sequence after completing previous one", () => {
      // First sequence
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);

      // Second sequence
      dmaDevice.writeWR0(0x00);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R0_BYTE_0);
      expect(dmaDevice.getRegisters().directionAtoB).toBe(false);
    });
  });

  describe("WR0 Port A Address Handling", () => {
    it("should correctly handle Port A start address - low byte only", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x34); // Port A address low byte
      
      expect(dmaDevice.getRegisters().portAStartAddress).toBe(0x0034);
    });

    it("should correctly handle Port A start address - complete 16-bit", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x34); // Port A address low byte
      dmaDevice.writeWR0(0x12); // Port A address high byte
      dmaDevice.writeWR0(0x00); // Block length low (dummy)
      dmaDevice.writeWR0(0x00); // Block length high (dummy)
      
      expect(dmaDevice.getRegisters().portAStartAddress).toBe(0x1234);
    });

    it("should preserve lower bits when writing high byte of Port A address", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0xff); // Port A address low byte = 0xff
      dmaDevice.writeWR0(0xaa); // Port A address high byte = 0xaa
      dmaDevice.writeWR0(0x00); // Block length low (dummy)
      dmaDevice.writeWR0(0x00); // Block length high (dummy)
      
      expect(dmaDevice.getRegisters().portAStartAddress).toBe(0xaaff);
    });

    it("should handle Port A address 0x0000", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      
      expect(dmaDevice.getRegisters().portAStartAddress).toBe(0x0000);
    });

    it("should handle Port A address 0xffff", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0xff);
      dmaDevice.writeWR0(0xff);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      
      expect(dmaDevice.getRegisters().portAStartAddress).toBe(0xffff);
    });
  });

  describe("WR0 Block Length Handling", () => {
    it("should correctly handle block length - low byte only", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00); // Port A address low
      dmaDevice.writeWR0(0x00); // Port A address high
      dmaDevice.writeWR0(0x78); // Block length low byte
      
      expect(dmaDevice.getRegisters().blockLength).toBe(0x0078);
    });

    it("should correctly handle block length - complete 16-bit", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00); // Port A address low
      dmaDevice.writeWR0(0x00); // Port A address high
      dmaDevice.writeWR0(0x56); // Block length low byte
      dmaDevice.writeWR0(0x34); // Block length high byte
      
      expect(dmaDevice.getRegisters().blockLength).toBe(0x3456);
    });

    it("should preserve lower bits when writing high byte of block length", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0xff); // Block length low byte = 0xff
      dmaDevice.writeWR0(0xaa); // Block length high byte = 0xaa
      
      expect(dmaDevice.getRegisters().blockLength).toBe(0xaaff);
    });

    it("should handle block length 0x0000", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      
      expect(dmaDevice.getRegisters().blockLength).toBe(0x0000);
    });

    it("should handle block length 0xffff", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0xff);
      dmaDevice.writeWR0(0xff);
      
      expect(dmaDevice.getRegisters().blockLength).toBe(0xffff);
    });
  });

  describe("WR0 Combined Parameters", () => {
    it("should correctly load all parameters in a single sequence", () => {
      dmaDevice.writeWR0(0x40); // Base: A->B
      dmaDevice.writeWR0(0xcd); // Port A address low
      dmaDevice.writeWR0(0xab); // Port A address high
      dmaDevice.writeWR0(0x34); // Block length low
      dmaDevice.writeWR0(0x12); // Block length high
      
      const registers = dmaDevice.getRegisters();
      expect(registers.directionAtoB).toBe(true);
      expect(registers.portAStartAddress).toBe(0xabcd);
      expect(registers.blockLength).toBe(0x1234);
    });

    it("should correctly load with B->A direction", () => {
      dmaDevice.writeWR0(0x00); // Base: B->A
      dmaDevice.writeWR0(0x11);
      dmaDevice.writeWR0(0x22);
      dmaDevice.writeWR0(0x33);
      dmaDevice.writeWR0(0x44);
      
      const registers = dmaDevice.getRegisters();
      expect(registers.directionAtoB).toBe(false);
      expect(registers.portAStartAddress).toBe(0x2211);
      expect(registers.blockLength).toBe(0x4433);
    });

    it("should allow overwriting previous WR0 values with new sequence", () => {
      // First write
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      dmaDevice.writeWR0(0x00);
      
      const firstRegisters = dmaDevice.getRegisters();
      expect(firstRegisters.portAStartAddress).toBe(0x0000);
      
      // Second write
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0xff);
      dmaDevice.writeWR0(0xff);
      dmaDevice.writeWR0(0xff);
      dmaDevice.writeWR0(0xff);
      
      const secondRegisters = dmaDevice.getRegisters();
      expect(secondRegisters.portAStartAddress).toBe(0xffff);
      expect(secondRegisters.blockLength).toBe(0xffff);
    });
  });

  describe("WR0 Partial Sequences", () => {
    it("should maintain sequence state when partially written", () => {
      dmaDevice.writeWR0(0x40); // Base
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R0_BYTE_0);
      
      dmaDevice.writeWR0(0x11); // Port A address low
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R0_BYTE_1);
      
      // At this point, values should be partially loaded but not complete
      let registers = dmaDevice.getRegisters();
      expect(registers.portAStartAddress).toBe(0x0011);
      expect(registers.blockLength).toBe(0x0000); // Not written yet
    });

    it("should complete partial sequence on subsequent calls", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x11);
      dmaDevice.writeWR0(0x22);
      dmaDevice.writeWR0(0x33);
      
      let registers = dmaDevice.getRegisters();
      expect(registers.blockLength).toBe(0x0033);
      
      // Complete the sequence
      dmaDevice.writeWR0(0x44);
      registers = dmaDevice.getRegisters();
      expect(registers.blockLength).toBe(0x4433);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });
  });

  describe("WR0 Multiple Sequential Writes", () => {
    it("should handle rapid successive writes", () => {
      const testCases = [
        { direction: true, addr: 0x1000, length: 0x0100 },
        { direction: false, addr: 0x2000, length: 0x0200 },
        { direction: true, addr: 0x3000, length: 0x0300 }
      ];

      testCases.forEach(testCase => {
        dmaDevice.writeWR0(testCase.direction ? 0x40 : 0x00);
        dmaDevice.writeWR0(testCase.addr & 0xff);
        dmaDevice.writeWR0((testCase.addr >> 8) & 0xff);
        dmaDevice.writeWR0(testCase.length & 0xff);
        dmaDevice.writeWR0((testCase.length >> 8) & 0xff);

        const registers = dmaDevice.getRegisters();
        expect(registers.directionAtoB).toBe(testCase.direction);
        expect(registers.portAStartAddress).toBe(testCase.addr);
        expect(registers.blockLength).toBe(testCase.length);
      });
    });
  });

  describe("WR0 State Isolation", () => {
    it("should not affect other register groups", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0xff);
      dmaDevice.writeWR0(0xff);
      dmaDevice.writeWR0(0xff);
      dmaDevice.writeWR0(0xff);

      const registers = dmaDevice.getRegisters();
      // Verify Port A config is unchanged
      expect(registers.portAIsIO).toBe(false);
      expect(registers.portAAddressMode).toBe(AddressMode.INCREMENT);
      // Verify Port B config is unchanged
      expect(registers.portBIsIO).toBe(false);
      expect(registers.portBAddressMode).toBe(AddressMode.INCREMENT);
    });

    it("should preserve reset state after WR0 writes", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x11);
      dmaDevice.writeWR0(0x22);
      dmaDevice.writeWR0(0x33);
      dmaDevice.writeWR0(0x44);

      dmaDevice.reset();

      const registers = dmaDevice.getRegisters();
      expect(registers.portAStartAddress).toBe(0x0000);
      expect(registers.blockLength).toBe(0x0000);
      expect(registers.directionAtoB).toBe(true);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });
  });
});

describe("DmaDevice - Step 3: Register Write Sequencing (WR1-WR2)", () => {
  let machine: TestZxNextMachine;
  let dmaDevice: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dmaDevice = machine.dmaDevice;
  });

  describe("WR1 - Port A Configuration Base Byte", () => {
    it("should parse Port A as memory (D5=0)", () => {
      dmaDevice.writeWR1(0x00);
      expect(dmaDevice.getRegisters().portAIsIO).toBe(false);
    });

    it("should parse Port A as I/O (D3=1)", () => {
      dmaDevice.writeWR1(0x08);
      expect(dmaDevice.getRegisters().portAIsIO).toBe(true);
    });

    it("should parse Port A address mode - Decrement (D5-D4=00)", () => {
      dmaDevice.writeWR1(0x00);
      expect(dmaDevice.getRegisters().portAAddressMode).toBe(AddressMode.DECREMENT);
    });

    it("should parse Port A address mode - Increment (D5-D4=01)", () => {
      dmaDevice.writeWR1(0x10);
      expect(dmaDevice.getRegisters().portAAddressMode).toBe(AddressMode.INCREMENT);
    });

    it("should parse Port A address mode - Fixed (D5-D4=10)", () => {
      dmaDevice.writeWR1(0x20);
      expect(dmaDevice.getRegisters().portAAddressMode).toBe(AddressMode.FIXED);
    });

    it("should keep Port A timing cycle length at default (3 cycles) when D6=0", () => {
      dmaDevice.writeWR1(0x00); // No timing byte follows
      expect(dmaDevice.getRegisters().portATimingCycleLength).toBe(CycleLength.CYCLES_3);
    });

    it("should keep Port A timing cycle length at default when no timing parameter", () => {
      dmaDevice.writeWR1(0x10); // Increment mode, no timing byte
      expect(dmaDevice.getRegisters().portATimingCycleLength).toBe(CycleLength.CYCLES_3);
    });

    it("should transition to R1_BYTE_0 when D6=1 (timing byte follows)", () => {
      dmaDevice.writeWR1(0x40); // D6=1, timing byte follows
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R1_BYTE_0);
    });

    it("should return to IDLE when D6=0 (no timing byte)", () => {
      dmaDevice.writeWR1(0x20); // D6=0, no timing byte
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });

    it("should combine Port A type and address mode", () => {
      dmaDevice.writeWR1(0x18); // D4=1 (Increment), D3=1 (I/O)
      const registers = dmaDevice.getRegisters();
      expect(registers.portAIsIO).toBe(true);
      expect(registers.portAAddressMode).toBe(AddressMode.INCREMENT);
    });

    it("should combine Port A I/O and address mode with default timing", () => {
      dmaDevice.writeWR1(0x18); // D4=1 (Increment), D3=1 (I/O), D6=0 (no timing byte)
      const registers = dmaDevice.getRegisters();
      expect(registers.portAIsIO).toBe(true);
      expect(registers.portAAddressMode).toBe(AddressMode.INCREMENT);
      expect(registers.portATimingCycleLength).toBe(CycleLength.CYCLES_3);
    });
  });

  describe("WR1 Sequencing", () => {
    it("should complete WR1 sequence with timing byte", () => {
      dmaDevice.writeWR1(0x48); // D6=1 (timing byte follows), D3=1 (I/O)
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R1_BYTE_0);
      
      dmaDevice.writeWR1(0x00); // Optional timing byte
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });

    it("should allow starting new WR1 after completing sequence", () => {
      dmaDevice.writeWR1(0x40); // D6=1, no other flags
      dmaDevice.writeWR1(0x00);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
      
      dmaDevice.writeWR1(0x48); // D6=1, D3=1
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R1_BYTE_0);
    });
  });

  describe("WR2 - Port B Configuration Base Byte", () => {
    it("should parse Port B as memory (D5=0)", () => {
      dmaDevice.writeWR2(0x00);
      expect(dmaDevice.getRegisters().portBIsIO).toBe(false);
    });

    it("should parse Port B as I/O (D3=1)", () => {
      dmaDevice.writeWR2(0x08);
      expect(dmaDevice.getRegisters().portBIsIO).toBe(true);
    });

    it("should parse Port B address mode - Decrement (D4-D3=00)", () => {
      dmaDevice.writeWR2(0x00);
      expect(dmaDevice.getRegisters().portBAddressMode).toBe(AddressMode.DECREMENT);
    });

    it("should parse Port B address mode - Increment (D5-D4=01)", () => {
      dmaDevice.writeWR2(0x10);
      expect(dmaDevice.getRegisters().portBAddressMode).toBe(AddressMode.INCREMENT);
    });

    it("should parse Port B address mode - Fixed (D5-D4=10)", () => {
      dmaDevice.writeWR2(0x20);
      expect(dmaDevice.getRegisters().portBAddressMode).toBe(AddressMode.FIXED);
    });

    it("should parse Port B timing cycle length - default 3 cycles without timing byte", () => {
      dmaDevice.writeWR2(0x00); // No timing byte (D6=0)
      expect(dmaDevice.getRegisters().portBTimingCycleLength).toBe(CycleLength.CYCLES_3);
    });

    it("should parse Port B timing cycle length - default remains 3 cycles", () => {
      dmaDevice.writeWR2(0x01); // No timing byte (D6=0), D0 is unused
      expect(dmaDevice.getRegisters().portBTimingCycleLength).toBe(CycleLength.CYCLES_3);
    });

    it("should keep default cycle length when timing byte not requested", () => {
      dmaDevice.writeWR2(0x02); // No timing byte (D6=0), D1 is unused
      expect(dmaDevice.getRegisters().portBTimingCycleLength).toBe(CycleLength.CYCLES_3);
    });

    it("should transition to R2_BYTE_0 after base byte with timing flag", () => {
      dmaDevice.writeWR2(0x60); // D6=1 (timing byte follows), D5=1 (address mode)
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R2_BYTE_0);
    });

    it("should combine Port B type and address mode", () => {
      dmaDevice.writeWR2(0x18); // D4=1 (Increment), D3=1 (I/O)
      const registers = dmaDevice.getRegisters();
      expect(registers.portBIsIO).toBe(true);
      expect(registers.portBAddressMode).toBe(AddressMode.INCREMENT);
    });

    it("should combine Port B I/O and address mode with default timing", () => {
      dmaDevice.writeWR2(0x18); // D4=1 (Increment), D3=1 (I/O), D6=0 (no timing byte)
      const registers = dmaDevice.getRegisters();
      expect(registers.portBIsIO).toBe(true);
      expect(registers.portBAddressMode).toBe(AddressMode.INCREMENT);
      expect(registers.portBTimingCycleLength).toBe(CycleLength.CYCLES_3);
    });
  });

  describe("WR2 Sequencing with Prescalar", () => {
    it("should complete WR2 sequence with timing and prescalar bytes", () => {
      dmaDevice.writeWR2(0x48); // D6=1 (timing byte follows), D3=1 (I/O)
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R2_BYTE_0);
      
      dmaDevice.writeWR2(0x00); // Timing byte
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R2_BYTE_1);
      
      dmaDevice.writeWR2(0x00); // Prescalar byte
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });

    it("should store prescalar value", () => {
      dmaDevice.writeWR2(0x40); // D6=1, timing byte follows
      dmaDevice.writeWR2(0x00);
      dmaDevice.writeWR2(0x7b); // Prescalar = 123
      
      expect(dmaDevice.getRegisters().portBPrescalar).toBe(0x7b);
    });

    it("should handle prescalar 0x00", () => {
      dmaDevice.writeWR2(0x40);
      dmaDevice.writeWR2(0x00);
      dmaDevice.writeWR2(0x00);
      
      expect(dmaDevice.getRegisters().portBPrescalar).toBe(0x00);
    });

    it("should handle prescalar 0xff", () => {
      dmaDevice.writeWR2(0x40);
      dmaDevice.writeWR2(0x00);
      dmaDevice.writeWR2(0xff);
      
      expect(dmaDevice.getRegisters().portBPrescalar).toBe(0xff);
    });

    it("should allow starting new WR2 after completing sequence", () => {
      dmaDevice.writeWR2(0x40);
      dmaDevice.writeWR2(0x00);
      dmaDevice.writeWR2(0x00);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
      
      dmaDevice.writeWR2(0x48);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R2_BYTE_0);
    });
  });

  describe("WR1 and WR2 Independence", () => {
    it("should allow Port A and Port B to be configured independently", () => {
      // Configure Port A as I/O with Increment
      dmaDevice.writeWR1(0x18); // D4=1 (Increment), D3=1 (I/O)

      // Configure Port B as Memory with Fixed
      dmaDevice.writeWR2(0x60); // D6=1 (timing byte), D5=1 (Fixed), D3=0 (Memory)
      dmaDevice.writeWR2(0x00);
      dmaDevice.writeWR2(0x50); // Prescalar = 80

      const registers = dmaDevice.getRegisters();
      expect(registers.portAIsIO).toBe(true);
      expect(registers.portAAddressMode).toBe(AddressMode.INCREMENT);
      expect(registers.portBIsIO).toBe(false);
      expect(registers.portBAddressMode).toBe(AddressMode.FIXED);
      expect(registers.portBPrescalar).toBe(0x50);
    });

    it("should preserve Port A configuration when writing WR2", () => {
      dmaDevice.writeWR1(0x58); // D6=1, D4=1 (Increment), D3=1 (I/O)
      dmaDevice.writeWR1(0x00);

      const registersAfterWR1 = dmaDevice.getRegisters();
      expect(registersAfterWR1.portAIsIO).toBe(true);
      expect(registersAfterWR1.portAAddressMode).toBe(AddressMode.INCREMENT);
      expect(registersAfterWR1.portATimingCycleLength).toBe(CycleLength.CYCLES_3);

      dmaDevice.writeWR2(0x60); // D6=1, D5=1 (Fixed), D3=0 (Memory)
      dmaDevice.writeWR2(0x00);
      dmaDevice.writeWR2(0x64);

      const registersAfterWR2 = dmaDevice.getRegisters();
      // Port A should be unchanged
      expect(registersAfterWR2.portAIsIO).toBe(true);
      expect(registersAfterWR2.portAAddressMode).toBe(AddressMode.INCREMENT);
      expect(registersAfterWR2.portATimingCycleLength).toBe(CycleLength.CYCLES_3);
      // Port B should be updated
      expect(registersAfterWR2.portBIsIO).toBe(false);
      expect(registersAfterWR2.portBAddressMode).toBe(AddressMode.FIXED);
      expect(registersAfterWR2.portBTimingCycleLength).toBe(CycleLength.CYCLES_3);
      expect(registersAfterWR2.portBPrescalar).toBe(0x64);
    });
  });

  describe("WR1 and WR2 Address Mode Combinations", () => {
    it("should configure all address mode combinations", () => {
      const addressModes = [
        { value: 0x00, mode: AddressMode.DECREMENT }, // D5-D4 = 00
        { value: 0x10, mode: AddressMode.INCREMENT }, // D5-D4 = 01
        { value: 0x20, mode: AddressMode.FIXED }      // D5-D4 = 10
      ];

      addressModes.forEach(({ value, mode }) => {
        dmaDevice.reset();
        
        dmaDevice.writeWR1(value);
        expect(dmaDevice.getRegisters().portAAddressMode).toBe(mode);
        
        dmaDevice.reset();
        
        dmaDevice.writeWR2(value);
        expect(dmaDevice.getRegisters().portBAddressMode).toBe(mode);
      });
    });
  });

  describe("WR1 and WR2 Timing Cycle Combinations", () => {
    it("should keep timing cycle length at default (3 cycles) for Port A", () => {
      // Timing cycle length is not in base byte - it's in optional timing parameter byte
      // Without timing byte (D6=0), timing stays at default CYCLES_3
      dmaDevice.writeWR1(0x00); // D6=0, no timing byte
      expect(dmaDevice.getRegisters().portATimingCycleLength).toBe(CycleLength.CYCLES_3);
      
      dmaDevice.reset();
      dmaDevice.writeWR1(0x10); // D6=0, increment mode
      expect(dmaDevice.getRegisters().portATimingCycleLength).toBe(CycleLength.CYCLES_3);
    });

    it("should keep timing cycle length at default (3 cycles) for Port B", () => {
      // Timing cycle length is not in base byte - it's in optional timing parameter byte
      // Without timing byte (D6=0), timing stays at default CYCLES_3
      dmaDevice.writeWR2(0x00); // D6=0, no timing byte
      expect(dmaDevice.getRegisters().portBTimingCycleLength).toBe(CycleLength.CYCLES_3);
      
      dmaDevice.reset();
      dmaDevice.writeWR2(0x20); // D6=0, fixed mode
      expect(dmaDevice.getRegisters().portBTimingCycleLength).toBe(CycleLength.CYCLES_3);
    });
  });

  describe("WR1 and WR2 with Reset", () => {
    it("should reset WR1 configuration on device reset", () => {
      dmaDevice.writeWR1(0x2b); // Port A: I/O, Increment, 3 cycles
      dmaDevice.writeWR1(0x00);

      dmaDevice.reset();

      const registers = dmaDevice.getRegisters();
      expect(registers.portAIsIO).toBe(false);
      expect(registers.portAAddressMode).toBe(AddressMode.INCREMENT);
      expect(registers.portATimingCycleLength).toBe(CycleLength.CYCLES_3);
    });

    it("should reset WR2 configuration on device reset", () => {
      dmaDevice.writeWR2(0x2c); // Port B: I/O, Increment, 2 cycles
      dmaDevice.writeWR2(0x00);
      dmaDevice.writeWR2(0xaa);

      dmaDevice.reset();

      const registers = dmaDevice.getRegisters();
      expect(registers.portBIsIO).toBe(false);
      expect(registers.portBAddressMode).toBe(AddressMode.INCREMENT);
      expect(registers.portBTimingCycleLength).toBe(CycleLength.CYCLES_3);
      expect(registers.portBPrescalar).toBe(0x00);
    });
  });

  describe("WR1 and WR2 Edge Cases", () => {
    it("should handle WR1 with all address mode bits combinations", () => {
      // Test D5-D4 combinations (address mode is in bits 5-4)
      for (let i = 0; i < 4; i++) {
        dmaDevice.reset();
        const value = i << 4; // Shift to bits 5-4
        dmaDevice.writeWR1(value);
        const expectedMode = i & 0x03;
        expect(dmaDevice.getRegisters().portAAddressMode).toBe(expectedMode);
      }
    });

    it("should handle WR2 with maximum prescalar value", () => {
      dmaDevice.writeWR2(0x40); // D6=1, timing byte follows
      dmaDevice.writeWR2(0x00);
      dmaDevice.writeWR2(0xff);

      expect(dmaDevice.getRegisters().portBPrescalar).toBe(0xff);
    });

    it("should handle WR1 timing byte not affecting configuration", () => {
      dmaDevice.writeWR1(0x58); // D6=1 (timing follows), D4=1 (Increment), D3=1 (I/O)
      const registersAfterBase = dmaDevice.getRegisters();
      
      dmaDevice.writeWR1(0xff); // Timing byte with all bits set
      const registersAfterTiming = dmaDevice.getRegisters();

      // Configuration should remain unchanged
      expect(registersAfterTiming.portAIsIO).toBe(registersAfterBase.portAIsIO);
      expect(registersAfterTiming.portAAddressMode).toBe(registersAfterBase.portAAddressMode);
      expect(registersAfterTiming.portATimingCycleLength).toBe(registersAfterBase.portATimingCycleLength);
    });

    it("should handle WR2 timing byte not affecting configuration", () => {
      dmaDevice.writeWR2(0x58); // D6=1 (timing follows), D4=1 (Increment), D3=1 (I/O)
      const registersAfterBase = dmaDevice.getRegisters();
      
      dmaDevice.writeWR2(0xff); // Timing byte
      const registersAfterTiming = dmaDevice.getRegisters();
      
      // Configuration should remain unchanged
      expect(registersAfterTiming.portBIsIO).toBe(registersAfterBase.portBIsIO);
      expect(registersAfterTiming.portBAddressMode).toBe(registersAfterBase.portBAddressMode);
      expect(registersAfterTiming.portBTimingCycleLength).toBe(registersAfterBase.portBTimingCycleLength);
    });
  });
});

describe("DmaDevice - Step 4: Register Write Sequencing (WR3-WR5)", () => {
  let machine: TestZxNextMachine;
  let dmaDevice: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dmaDevice = machine.dmaDevice;
  });

  describe("WR3 - DMA Enable Control", () => {
    it("should set DMA enabled when D0=1", () => {
      dmaDevice.writeWR3(0x01);
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(true);
    });

    it("should clear DMA enabled when D0=0", () => {
      dmaDevice.writeWR3(0x00);
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(false);
    });

    it("should ignore other bits in WR3", () => {
      dmaDevice.writeWR3(0xfe); // All bits except D0
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(false);
    });

    it("should set DMA enabled with other bits set", () => {
      dmaDevice.writeWR3(0xff); // All bits set
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(true);
    });

    it("should return to IDLE sequence after WR3", () => {
      dmaDevice.writeWR3(0x01);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });

    it("should allow repeated WR3 writes", () => {
      dmaDevice.writeWR3(0x01);
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(true);
      
      dmaDevice.writeWR3(0x00);
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(false);
      
      dmaDevice.writeWR3(0x01);
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(true);
    });

    it("should not affect other registers", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x11);
      dmaDevice.writeWR0(0x22);
      dmaDevice.writeWR0(0x33);
      dmaDevice.writeWR0(0x44);

      const registersBeforeWR3 = dmaDevice.getRegisters();
      
      dmaDevice.writeWR3(0x01);
      
      const registersAfterWR3 = dmaDevice.getRegisters();
      expect(registersAfterWR3.portAStartAddress).toBe(registersBeforeWR3.portAStartAddress);
      expect(registersAfterWR3.blockLength).toBe(registersBeforeWR3.blockLength);
    });
  });

  describe("WR4 - Mode and Port B Address Configuration", () => {
    it("should set transfer mode - Continuous (D4=1)", () => {
      dmaDevice.writeWR4(0x10);
      expect(dmaDevice.getRegisters().transferMode).toBe(TransferMode.CONTINUOUS);
    });

    it("should set transfer mode - Burst (D4=0)", () => {
      dmaDevice.writeWR4(0x00);
      expect(dmaDevice.getRegisters().transferMode).toBe(TransferMode.BURST);
    });

    it("should transition to R4_BYTE_0 after base byte", () => {
      dmaDevice.writeWR4(0x10);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R4_BYTE_0);
    });

    it("should correctly handle Port B start address - low byte", () => {
      dmaDevice.writeWR4(0x10);
      dmaDevice.writeWR4(0x78);
      
      expect(dmaDevice.getRegisters().portBStartAddress).toBe(0x0078);
    });

    it("should correctly handle Port B start address - complete 16-bit", () => {
      dmaDevice.writeWR4(0x10);
      dmaDevice.writeWR4(0xcd);
      dmaDevice.writeWR4(0xab);
      
      expect(dmaDevice.getRegisters().portBStartAddress).toBe(0xabcd);
    });

    it("should return to IDLE after complete WR4 sequence", () => {
      dmaDevice.writeWR4(0x10);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x00);
      
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });

    it("should handle Port B address 0x0000", () => {
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x00);
      
      expect(dmaDevice.getRegisters().portBStartAddress).toBe(0x0000);
    });

    it("should handle Port B address 0xffff", () => {
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0xff);
      dmaDevice.writeWR4(0xff);
      
      expect(dmaDevice.getRegisters().portBStartAddress).toBe(0xffff);
    });

    it("should allow starting new WR4 sequence after completing previous one", () => {
      dmaDevice.writeWR4(0x10);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x00);

      dmaDevice.writeWR4(0x00);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R4_BYTE_0);
    });

    it("should preserve transfer mode across address writes", () => {
      dmaDevice.writeWR4(0x10); // Continuous mode
      expect(dmaDevice.getRegisters().transferMode).toBe(TransferMode.CONTINUOUS);
      
      dmaDevice.writeWR4(0x11); // Address low byte
      expect(dmaDevice.getRegisters().transferMode).toBe(TransferMode.CONTINUOUS);
      
      dmaDevice.writeWR4(0x22); // Address high byte
      expect(dmaDevice.getRegisters().transferMode).toBe(TransferMode.CONTINUOUS);
    });
  });

  describe("WR5 - Auto-Restart and CE/WAIT Configuration", () => {
    it("should set auto-restart when D5=1", () => {
      dmaDevice.writeWR5(0x20);
      expect(dmaDevice.getRegisters().autoRestart).toBe(true);
    });

    it("should clear auto-restart when D5=0", () => {
      dmaDevice.writeWR5(0x00);
      expect(dmaDevice.getRegisters().autoRestart).toBe(false);
    });

    it("should set CE/WAIT multiplexed when D4=1", () => {
      dmaDevice.writeWR5(0x10);
      expect(dmaDevice.getRegisters().ceWaitMultiplexed).toBe(true);
    });

    it("should clear CE/WAIT multiplexed when D4=0", () => {
      dmaDevice.writeWR5(0x00);
      expect(dmaDevice.getRegisters().ceWaitMultiplexed).toBe(false);
    });

    it("should set both auto-restart and CE/WAIT", () => {
      dmaDevice.writeWR5(0x30);
      expect(dmaDevice.getRegisters().autoRestart).toBe(true);
      expect(dmaDevice.getRegisters().ceWaitMultiplexed).toBe(true);
    });

    it("should ignore bits outside D5 and D4", () => {
      dmaDevice.writeWR5(0xcf); // All other bits set
      expect(dmaDevice.getRegisters().autoRestart).toBe(false);
      expect(dmaDevice.getRegisters().ceWaitMultiplexed).toBe(false);
    });

    it("should return to IDLE sequence after WR5", () => {
      dmaDevice.writeWR5(0x20);
      expect(dmaDevice.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
    });

    it("should allow repeated WR5 writes", () => {
      dmaDevice.writeWR5(0x20);
      expect(dmaDevice.getRegisters().autoRestart).toBe(true);
      
      dmaDevice.writeWR5(0x00);
      expect(dmaDevice.getRegisters().autoRestart).toBe(false);
      
      dmaDevice.writeWR5(0x30);
      expect(dmaDevice.getRegisters().autoRestart).toBe(true);
      expect(dmaDevice.getRegisters().ceWaitMultiplexed).toBe(true);
    });
  });

  describe("WR3, WR4, WR5 Combined Configuration", () => {
    it("should configure all control registers independently", () => {
      // Configure WR3
      dmaDevice.writeWR3(0x01);
      
      // Configure WR4
      dmaDevice.writeWR4(0x10);
      dmaDevice.writeWR4(0x34);
      dmaDevice.writeWR4(0x12);
      
      // Configure WR5
      dmaDevice.writeWR5(0x30);
      
      const registers = dmaDevice.getRegisters();
      expect(registers.dmaEnabled).toBe(true);
      expect(registers.transferMode).toBe(TransferMode.CONTINUOUS);
      expect(registers.portBStartAddress).toBe(0x1234);
      expect(registers.autoRestart).toBe(true);
      expect(registers.ceWaitMultiplexed).toBe(true);
    });

    it("should preserve previous configuration when setting control registers", () => {
      // Set up Port A configuration via WR0
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x11);
      dmaDevice.writeWR0(0x22);
      dmaDevice.writeWR0(0x33);
      dmaDevice.writeWR0(0x44);

      const registersAfterWR0 = dmaDevice.getRegisters();

      // Now configure control registers
      dmaDevice.writeWR3(0x01);
      dmaDevice.writeWR4(0x10);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR5(0x20);

      const registersAfterControl = dmaDevice.getRegisters();
      
      // Port A config should be preserved
      expect(registersAfterControl.portAStartAddress).toBe(registersAfterWR0.portAStartAddress);
      expect(registersAfterControl.blockLength).toBe(registersAfterWR0.blockLength);
      expect(registersAfterControl.directionAtoB).toBe(registersAfterWR0.directionAtoB);
    });

    it("should allow interleaved configuration of all register groups", () => {
      dmaDevice.writeWR3(0x01);
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(true);
      
      dmaDevice.writeWR4(0x10);
      dmaDevice.writeWR4(0xaa);
      dmaDevice.writeWR4(0xbb);
      expect(dmaDevice.getRegisters().portBStartAddress).toBe(0xbbaa);
      
      dmaDevice.writeWR5(0x30);
      expect(dmaDevice.getRegisters().autoRestart).toBe(true);
      
      dmaDevice.writeWR3(0x00);
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(false);
    });
  });

  describe("WR4 Continuous vs Burst Mode", () => {
    it("should configure Continuous mode correctly", () => {
      dmaDevice.writeWR4(0x10);
      expect(dmaDevice.getRegisters().transferMode).toBe(TransferMode.CONTINUOUS);
    });

    it("should configure Burst mode correctly", () => {
      dmaDevice.writeWR4(0x00);
      expect(dmaDevice.getRegisters().transferMode).toBe(TransferMode.BURST);
    });

    it("should switch between modes in consecutive writes", () => {
      dmaDevice.writeWR4(0x10);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x00);
      expect(dmaDevice.getRegisters().transferMode).toBe(TransferMode.CONTINUOUS);
      
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x00);
      expect(dmaDevice.getRegisters().transferMode).toBe(TransferMode.BURST);
    });
  });

  describe("WR3-WR5 with Reset", () => {
    it("should reset WR3 (dmaEnabled) on device reset", () => {
      dmaDevice.writeWR3(0x01);
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(true);
      
      dmaDevice.reset();
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(false);
    });

    it("should reset WR4 (transferMode and Port B address) on device reset", () => {
      dmaDevice.writeWR4(0x10);
      dmaDevice.writeWR4(0xff);
      dmaDevice.writeWR4(0xff);
      
      const registersBeforeReset = dmaDevice.getRegisters();
      expect(registersBeforeReset.transferMode).toBe(TransferMode.CONTINUOUS);
      expect(registersBeforeReset.portBStartAddress).toBe(0xffff);
      
      dmaDevice.reset();
      
      const registersAfterReset = dmaDevice.getRegisters();
      expect(registersAfterReset.transferMode).toBe(TransferMode.CONTINUOUS);
      expect(registersAfterReset.portBStartAddress).toBe(0x0000);
    });

    it("should reset WR5 (autoRestart, ceWaitMultiplexed) on device reset", () => {
      dmaDevice.writeWR5(0x30);
      
      const registersBeforeReset = dmaDevice.getRegisters();
      expect(registersBeforeReset.autoRestart).toBe(true);
      expect(registersBeforeReset.ceWaitMultiplexed).toBe(true);
      
      dmaDevice.reset();
      
      const registersAfterReset = dmaDevice.getRegisters();
      expect(registersAfterReset.autoRestart).toBe(false);
      expect(registersAfterReset.ceWaitMultiplexed).toBe(false);
    });
  });

  describe("WR3-WR5 Edge Cases", () => {
    it("should handle WR3 with all bits set", () => {
      dmaDevice.writeWR3(0xff);
      expect(dmaDevice.getRegisters().dmaEnabled).toBe(true);
    });

    it("should handle WR4 with maximum Port B address", () => {
      dmaDevice.writeWR4(0x1f); // Mode bit + address bits
      dmaDevice.writeWR4(0xff);
      dmaDevice.writeWR4(0xff);
      
      expect(dmaDevice.getRegisters().portBStartAddress).toBe(0xffff);
    });

    it("should handle WR5 with bits not D5 or D4", () => {
      dmaDevice.writeWR5(0x8f); // D7 and low bits set
      
      expect(dmaDevice.getRegisters().autoRestart).toBe(false);
      expect(dmaDevice.getRegisters().ceWaitMultiplexed).toBe(false);
    });

    it("should preserve Port B address across multiple WR4 configurations", () => {
      // First configuration
      dmaDevice.writeWR4(0x10);
      dmaDevice.writeWR4(0x12);
      dmaDevice.writeWR4(0x34);
      
      let registers = dmaDevice.getRegisters();
      expect(registers.portBStartAddress).toBe(0x3412);
      
      // Second configuration overwrites
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0xaa);
      dmaDevice.writeWR4(0xbb);
      
      registers = dmaDevice.getRegisters();
      expect(registers.portBStartAddress).toBe(0xbbaa);
    });
  });

  describe("WR3-WR5 State Isolation", () => {
    it("should not affect WR0 registers", () => {
      dmaDevice.writeWR0(0x40);
      dmaDevice.writeWR0(0x11);
      dmaDevice.writeWR0(0x22);
      dmaDevice.writeWR0(0x33);
      dmaDevice.writeWR0(0x44);

      const registersBeforeControl = dmaDevice.getRegisters();

      dmaDevice.writeWR3(0x01);
      dmaDevice.writeWR4(0x10);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR5(0x30);

      const registersAfterControl = dmaDevice.getRegisters();
      
      expect(registersAfterControl.portAStartAddress).toBe(registersBeforeControl.portAStartAddress);
      expect(registersAfterControl.blockLength).toBe(registersBeforeControl.blockLength);
      expect(registersAfterControl.directionAtoB).toBe(registersBeforeControl.directionAtoB);
    });

    it("should not affect WR1/WR2 registers", () => {
      dmaDevice.writeWR1(0x2a);
      dmaDevice.writeWR1(0x00);
      dmaDevice.writeWR2(0x28);
      dmaDevice.writeWR2(0x00);
      dmaDevice.writeWR2(0x80);

      const registersBeforeControl = dmaDevice.getRegisters();

      dmaDevice.writeWR3(0x01);
      dmaDevice.writeWR4(0x10);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR4(0x00);
      dmaDevice.writeWR5(0x30);

      const registersAfterControl = dmaDevice.getRegisters();
      
      expect(registersAfterControl.portAIsIO).toBe(registersBeforeControl.portAIsIO);
      expect(registersAfterControl.portAAddressMode).toBe(registersBeforeControl.portAAddressMode);
      expect(registersAfterControl.portBPrescalar).toBe(registersBeforeControl.portBPrescalar);
    });
  });
});

