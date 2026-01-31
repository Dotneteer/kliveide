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

