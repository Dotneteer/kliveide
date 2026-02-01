import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { CycleLength } from "@emu/machines/zxNext/DmaDevice";

describe("DMA Z80 Code-Driven Tests - Timing Parameters", () => {
  describe("WR1 Port A Timing Configuration", () => {
    it("should store Port A timing byte when D6=1", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x54, // LD A, 54H (WR1: D6=1, timing follows, D3=0, D1D0=100)
        0xED, 0x79, // OUT (C), A
        0x3E, 0x02, // LD A, 02H (Timing byte: CYCLES_2)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      const timing = m.dmaDevice.getTimingParameters();
      expect(timing.portA.rawValue).toBe(0x02);
      expect(timing.portA.cycleLength).toBe(CycleLength.CYCLES_2);
    });

    it("should store Port A timing with CYCLES_3", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x54, // LD A, 54H (WR1: D6=1, timing follows)
        0xED, 0x79, // OUT (C), A
        0x3E, 0x01, // LD A, 01H (Timing byte: CYCLES_3)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      const timing = m.dmaDevice.getTimingParameters();
      expect(timing.portA.rawValue).toBe(0x01);
      expect(timing.portA.cycleLength).toBe(CycleLength.CYCLES_3);
    });

    it("should store Port A timing with various raw values", async () => {
      const m = await createTestNextMachine();

      const testCases = [
        { rawValue: 0x00, expectedCycles: CycleLength.CYCLES_4 },   // bits 00
        { rawValue: 0x01, expectedCycles: CycleLength.CYCLES_3 },   // bits 01
        { rawValue: 0x02, expectedCycles: CycleLength.CYCLES_2 },   // bits 10
        { rawValue: 0xFE, expectedCycles: CycleLength.CYCLES_2 },   // Mask to D1-D0 = 10
      ];

      for (const testCase of testCases) {
        const m2 = await createTestNextMachine();
        const code = [
          0x01, 0x6B, 0x00, // LD BC, 006BH
          0x3E, 0x54, // LD A, 54H (WR1: D6=1)
          0xED, 0x79, // OUT (C), A
          0x3E, testCase.rawValue, // LD A, timing byte
          0xED, 0x79, // OUT (C), A
          0x76, // HALT
        ];

        m2.initCode(code, 0xC000);
        m2.pc = 0xC000;
        m2.runUntilHalt();

        const timing = m2.dmaDevice.getTimingParameters();
        expect(timing.portA.rawValue).toBe(testCase.rawValue);
        expect(timing.portA.cycleLength).toBe(testCase.expectedCycles);
      }
    });

    it("should not store timing when D6=0 (no timing byte)", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x14, // LD A, 14H (WR1: D6=0, no timing byte)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      const timing = m.dmaDevice.getTimingParameters();
      expect(timing.portA.rawValue).toBeNull();
      expect(timing.portA.cycleLength).toBe(CycleLength.CYCLES_3); // Default value
    });
  });

  describe("WR2 Port B Timing and Prescalar Configuration", () => {
    it("should store Port B timing byte and prescalar when both present", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x50, // LD A, 50H (WR2: D6=1, timing follows, D3=0)
        0xED, 0x79, // OUT (C), A
        0x3E, 0x01, // LD A, 01H (Timing byte: CYCLES_3)
        0xED, 0x79, // OUT (C), A
        0x3E, 0xAA, // LD A, AAH (Prescalar: 170)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      const timing = m.dmaDevice.getTimingParameters();
      expect(timing.portB.rawValue).toBe(0x01);
      expect(timing.portB.cycleLength).toBe(CycleLength.CYCLES_3);

      const regs = m.getDmaRegisters();
      expect(regs.portBPrescalar).toBe(0xAA);
    });

    it("should store Port B timing with CYCLES_2", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x50, // LD A, 50H (WR2: D6=1, timing follows)
        0xED, 0x79, // OUT (C), A
        0x3E, 0x02, // LD A, 02H (Timing byte: CYCLES_2)
        0xED, 0x79, // OUT (C), A
        0x3E, 0x55, // LD A, 55H (Prescalar: 85)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      const timing = m.dmaDevice.getTimingParameters();
      expect(timing.portB.rawValue).toBe(0x02);
      expect(timing.portB.cycleLength).toBe(CycleLength.CYCLES_2);

      const regs = m.getDmaRegisters();
      expect(regs.portBPrescalar).toBe(0x55);
    });

    it("should not store timing when WR2 D6=0 (no timing/prescalar)", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x10, // LD A, 10H (WR2: D6=0, no timing byte)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      const timing = m.dmaDevice.getTimingParameters();
      expect(timing.portB.rawValue).toBeNull();
      expect(timing.portB.cycleLength).toBe(CycleLength.CYCLES_3); // Default value

      const regs = m.getDmaRegisters();
      expect(regs.portBPrescalar).toBe(0); // No prescalar written
    });

    it("should handle maximum prescalar value", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x50, // LD A, 50H (WR2: D6=1)
        0xED, 0x79, // OUT (C), A
        0x3E, 0x00, // LD A, 00H (Timing byte: CYCLES_4)
        0xED, 0x79, // OUT (C), A
        0x3E, 0xFF, // LD A, FFH (Prescalar: 255)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      const timing = m.dmaDevice.getTimingParameters();
      expect(timing.portB.rawValue).toBe(0x00);
      expect(timing.portB.cycleLength).toBe(CycleLength.CYCLES_4);

      const regs = m.getDmaRegisters();
      expect(regs.portBPrescalar).toBe(0xFF);
    });
  });

  describe("Timing Parameter Getter", () => {
    it("should expose timing parameters with initial null values", async () => {
      const m = await createTestNextMachine();

      const timing = m.dmaDevice.getTimingParameters();
      expect(timing.portA.rawValue).toBeNull();
      expect(timing.portB.rawValue).toBeNull();
      expect(timing.portA.cycleLength).toBe(CycleLength.CYCLES_3);
      expect(timing.portB.cycleLength).toBe(CycleLength.CYCLES_3);
    });

    it("should update timing parameters after configuration", async () => {
      const m = await createTestNextMachine();

      // Configure Port A
      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x54, // LD A, 54H (WR1: timing follows)
        0xED, 0x79, // OUT (C), A
        0x3E, 0x02, // LD A, 02H (Port A timing)
        0xED, 0x79, // OUT (C), A
        0x3E, 0x50, // LD A, 50H (WR2: timing follows)
        0xED, 0x79, // OUT (C), A
        0x3E, 0x01, // LD A, 01H (Port B timing)
        0xED, 0x79, // OUT (C), A
        0x3E, 0x33, // LD A, 33H (Prescalar)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      const timing = m.dmaDevice.getTimingParameters();
      expect(timing.portA.rawValue).toBe(0x02);
      expect(timing.portA.cycleLength).toBe(CycleLength.CYCLES_2);
      expect(timing.portB.rawValue).toBe(0x01);
      expect(timing.portB.cycleLength).toBe(CycleLength.CYCLES_3);
    });
  });

  describe("Timing with Address Mode Configuration", () => {
    it("should preserve timing with Port A increment mode", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x54, // LD A, 54H (WR1: D6=1, D5-D4=01 (increment))
        0xED, 0x79, // OUT (C), A
        0x3E, 0x02, // LD A, 02H (Timing byte)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      const timing = m.dmaDevice.getTimingParameters();
      expect(timing.portA.rawValue).toBe(0x02);

      const regs = m.getDmaRegisters();
      expect(regs.portAAddressMode).toBe(1); // INCREMENT
    });

    it("should preserve timing with Port B decrement mode", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x40, // LD A, 40H (WR2: D6=1, D5-D4=00 (decrement), D3=0 (memory))
        0xED, 0x79, // OUT (C), A
        0x3E, 0x01, // LD A, 01H (Timing byte)
        0xED, 0x79, // OUT (C), A
        0x3E, 0x44, // LD A, 44H (Prescalar)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      const timing = m.dmaDevice.getTimingParameters();
      expect(timing.portB.rawValue).toBe(0x01);

      const regs = m.getDmaRegisters();
      expect(regs.portBAddressMode).toBe(0); // DECREMENT (AddressMode.DECREMENT = 0)
    });
  });

  describe("Timing with I/O Configuration", () => {
    it("should preserve timing when Port A is I/O", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x5C, // LD A, 5CH (WR1: D6=1, D3=1 (I/O))
        0xED, 0x79, // OUT (C), A
        0x3E, 0x02, // LD A, 02H (Timing byte)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      const timing = m.dmaDevice.getTimingParameters();
      expect(timing.portA.rawValue).toBe(0x02);

      const regs = m.getDmaRegisters();
      expect(regs.portAIsIO).toBe(true);
    });

    it("should preserve timing when Port B is I/O", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x58, // LD A, 58H (WR2: D6=1, D3=1 (I/O))
        0xED, 0x79, // OUT (C), A
        0x3E, 0x01, // LD A, 01H (Timing byte)
        0xED, 0x79, // OUT (C), A
        0x3E, 0x77, // LD A, 77H (Prescalar)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      const timing = m.dmaDevice.getTimingParameters();
      expect(timing.portB.rawValue).toBe(0x01);

      const regs = m.getDmaRegisters();
      expect(regs.portBIsIO).toBe(true);
    });
  });
});
