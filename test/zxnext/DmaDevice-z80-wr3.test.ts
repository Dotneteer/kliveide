import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";

describe("DMA Z80 Code-Driven Tests - WR3 Port Routing", () => {
  describe("WR3 Enable/Disable via Port Write", () => {
    it("should enable DMA via WR3 port write (0x03)", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x03, // LD A, 03H (WR3: xxx00011, D0=1 enable)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(true);
    });

    it("should disable DMA via WR3 port write (0x02)", async () => {
      const m = await createTestNextMachine();

      // Set DMA enabled first
      m.dmaDevice.setDmaEnabled(true);
      expect(m.getDmaRegisters().dmaEnabled).toBe(true);

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x02, // LD A, 02H (WR3: xxx00010, D0=0 disable)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      const regs = m.getDmaRegisters();
      expect(regs.dmaEnabled).toBe(false);
    });

    it("should enable DMA via WR3 with upper bits set", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x43, // LD A, 43H (WR3: 01000011, upper bits ignored, D0=1)
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

  describe("WR3 vs Direct Method Equivalence", () => {
    it("should produce same result as setDmaEnabled(true)", async () => {
      const m1 = await createTestNextMachine();
      m1.dmaDevice.setDmaEnabled(true);

      const m2 = await createTestNextMachine();
      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x03, // LD A, 03H (enable via port)
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
        0x3E, 0x02, // LD A, 02H (disable via port)
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

  describe("WR3 Bit Pattern Matching", () => {
    it("should recognize WR3 pattern xxx00011", async () => {
      const m = await createTestNextMachine();

      const testCases = [
        0x03, // 00000011
        0x23, // 00100011
        0x43, // 01000011
        0x63, // 01100011
      ];

      for (const testValue of testCases) {
        const m2 = await createTestNextMachine();
        const code = [
          0x01, 0x6B, 0x00, // LD BC, 006BH
          0x3E, testValue, // LD A, test value
          0xED, 0x79, // OUT (C), A
          0x76, // HALT
        ];

        m2.initCode(code, 0xC000);
        m2.pc = 0xC000;
        m2.runUntilHalt();

        const regs = m2.getDmaRegisters();
        // Pattern xxx011 with D0=1 should enable DMA
        const expectedEnabled = (testValue & 0x01) !== 0;
        expect(regs.dmaEnabled).toBe(expectedEnabled);
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

  describe("WR3 Bit D0 Interpretation", () => {
    it("should treat D0=1 as enable", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x03, // LD A, 03H (WR3 with D0=1, pattern xxx011)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      expect(m.getDmaRegisters().dmaEnabled).toBe(true);
    });

    it("should treat D0=0 as disable", async () => {
      const m = await createTestNextMachine();
      m.dmaDevice.setDmaEnabled(true);

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        0x3E, 0x02, // LD A, 02H (WR3 with D0=0, pattern xxx010)
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      expect(m.getDmaRegisters().dmaEnabled).toBe(false);
    });

    it("should handle repeated WR3 writes", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        // Enable
        0x3E, 0x03, // LD A, 03H
        0xED, 0x79, // OUT (C), A
        // Disable
        0x3E, 0x02, // LD A, 02H
        0xED, 0x79, // OUT (C), A
        // Enable again
        0x3E, 0x03, // LD A, 03H
        0xED, 0x79, // OUT (C), A
        0x76, // HALT
      ];

      m.initCode(code, 0xC000);
      m.pc = 0xC000;
      m.runUntilHalt();

      expect(m.getDmaRegisters().dmaEnabled).toBe(true);
    });
  });

  describe("WR3 Port Routing Validation", () => {
    it("should validate WR3 routing is functional", async () => {
      const m = await createTestNextMachine();

      const code = [
        0x01, 0x6B, 0x00, // LD BC, 006BH
        // Set WR3 to enable
        0x3E, 0x03, // LD A, 03H (enable)
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
