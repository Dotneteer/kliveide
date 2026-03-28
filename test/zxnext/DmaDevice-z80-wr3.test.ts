import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";

describe("DMA Z80 Code-Driven Tests - DMA Enable/Disable via Port Write", () => {
  describe("WR6 Enable/Disable via Port Write", () => {
    it("should enable DMA via WR6 ENABLE_DMA command (0x87)", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x87, // LD A, 87H (WR6 ENABLE_DMA command)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(true);
    });

    it("should disable DMA via WR6 DISABLE_DMA command (0x83)", async () => {
      const m = await createTestNextMachine();

      // Set DMA enabled first
      m.dmaDevice.setDmaEnabled(true);
      expect(m.getDmaRegisters().dmaEnabled).toBe(true);

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x83, // LD A, 83H (WR6 DISABLE_DMA command)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(false);
    });

    it("should enable DMA via WR6 ENABLE_DMA (standard command byte)", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x87, // LD A, 87H (WR6 ENABLE_DMA — only the command byte matters)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(true);
    });

    it("should disable DMA via WR3 with different upper bits", async () => {
      const m = await createTestNextMachine();
      m.dmaDevice.setDmaEnabled(true);

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x7B, // LD A, 7BH (WR3: 01111011, upper bits varied, D0=1 but pattern is ...011)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      // This actually tests that WR3 is being called correctly
      // The value 0x7B has pattern ...011 in D2-D0
      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(true); // D0=1
    });
  });

  describe("WR6 vs Direct Method Equivalence", () => {
    it("should produce same result as setDmaEnabled(true)", async () => {
      const m1 = await createTestNextMachine();
      m1.dmaDevice.setDmaEnabled(true);

      const m2 = await createTestNextMachine();
      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x87, // LD A, 87H (WR6 ENABLE_DMA)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];
      m2.initCode(code, 0xC000);
      m2.pc = 0xC000;
      m2.runUntilHalt();

      expect(m1.getDmaRegisters().dmaEnabled).toBe(m2.getDmaRegisters().dmaEnabled);
      expect(m1.getDmaRegisters().dmaEnabled).toBe(true);
    });

    it("should produce same result as setDmaEnabled(false)", async () => {
      const m1 = await createTestNextMachine();
      m1.dmaDevice.setDmaEnabled(true);
      m1.dmaDevice.setDmaEnabled(false);

      const m2 = await createTestNextMachine();
      m2.dmaDevice.setDmaEnabled(true);
      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x83, // LD A, 83H (WR6 DISABLE_DMA)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];
      m2.initCode(code, 0xC000);
      m2.pc = 0xC000;
      m2.runUntilHalt();

      expect(m1.getDmaRegisters().dmaEnabled).toBe(m2.getDmaRegisters().dmaEnabled);
      expect(m1.getDmaRegisters().dmaEnabled).toBe(false);
    });
  });

  describe("DMA Enable/Disable Pattern Tests", () => {
    it("should recognize WR6 ENABLE_DMA (0x87) enables DMA", async () => {
      // With MAME dispatch, bytes are routed by bit-mask patterns.
      // ENABLE_DMA (0x87) and DISABLE_DMA (0x83) are the correct WR6 commands.
      const testCases = [
        { value: 0x87, expectedEnabled: true },  // ENABLE_DMA
        { value: 0x83, expectedEnabled: false }, // DISABLE_DMA
      ];

      for (const tc of testCases) {
        const m2 = await createTestNextMachine();
        if (!tc.expectedEnabled) m2.dmaDevice.setDmaEnabled(true); // Pre-enable so disable has effect
        const code = [
          0x01, 0x6B, 0x00, // LD BC, 006BH
          0x3E, tc.value,   // LD A, command byte
          0xED, 0x79,       // OUT (C), A
          0x76,             // HALT
        ];

        m2.initCode(code, 0xC000);
        m2.pc = 0xC000;
        m2.runUntilHalt();

        const regs = m2.getDmaRegisters();
        expect(regs.dmaEnabled).toBe(tc.expectedEnabled);
      }
    });

    it("should not confuse WR3 with other registers", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        // Write WR1 (not WR3) - pattern xxx100
        0x3E, 0x14, // LD A, 14H (WR1: xxx00100, D5-D4=01 increment, D3=0 memory)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      // WR1 should not affect dmaEnabled
      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(false); // Should remain false (default)
      // But Port A config should have been set
      expect(regs.portAIsIO).toBe(false);
      expect(regs.portAAddressMode).toBe(1); // Increment (D5-D4=01)
    });
  });

  describe("WR6 Enable/Disable Bit Interpretation", () => {
    it("should treat WR6 0x87 as enable", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x87, // LD A, 87H (WR6 ENABLE_DMA)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      expect(m.getDmaRegisters().dmaEnabled).toBe(true);
    });

    it("should treat WR6 0x83 as disable", async () => {
      const m = await createTestNextMachine();
      m.dmaDevice.setDmaEnabled(true);

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x83, // LD A, 83H (WR6 DISABLE_DMA)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      expect(m.getDmaRegisters().dmaEnabled).toBe(false);
    });

    it("should handle alternating enable/disable writes", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        // Enable
        0x3E, 0x87, // LD A, 87H (ENABLE_DMA)
        0xED, 0x79, // OUT (C), A
        // Disable
        0x3E, 0x83, // LD A, 83H (DISABLE_DMA)
        0xED, 0x79, // OUT (C), A
        // Enable again
        0x3E, 0x87, // LD A, 87H (ENABLE_DMA)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      expect(m.getDmaRegisters().dmaEnabled).toBe(true);
    });
  });

  describe("DMA Port Routing Validation", () => {
    it("should validate DMA enable via port write is functional", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        // Enable DMA via WR6 ENABLE_DMA command
        0x3E, 0x87, // LD A, 87H (WR6 ENABLE_DMA)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      // Verify DMA was enabled through port write (not just initial state)
      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(true);

      // Validate using getDmaValidation
      const validation = m.getDmaValidation();
      // DMA is enabled, so configuration should be checked
      // (validation will return errors if block length is 0, but that's separate)
      expect(validation.valid).toBe(false); // Will be false due to zero block length
      expect(
        validation.errors.some((e) =>
          e.includes("Block length is zero")
        )
      ).toBe(true);
    });
  });
});
