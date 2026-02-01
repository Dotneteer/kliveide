import { describe, it, expect, beforeEach } from "vitest";
import { PsgChip } from "@emu/machines/zxSpectrum128/PsgChip";

describe("Step 1: PsgChip Multi-Instance Support", () => {
  describe("Chip ID Support", () => {
    it("should initialize with default chip ID 0", () => {
      const psg = new PsgChip();
      expect(psg.chipId).toBe(0);
    });

    it("should initialize with specified chip ID", () => {
      const psg0 = new PsgChip(0);
      expect(psg0.chipId).toBe(0);

      const psg1 = new PsgChip(1);
      expect(psg1.chipId).toBe(1);

      const psg2 = new PsgChip(2);
      expect(psg2.chipId).toBe(2);
    });

    it("should mask chip ID to 2 bits (0-3)", () => {
      const psg = new PsgChip(5); // 101 in binary -> masked to 01
      expect(psg.chipId).toBe(1);

      const psg3 = new PsgChip(7); // 111 in binary -> masked to 11
      expect(psg3.chipId).toBe(3);

      const psg4 = new PsgChip(4); // 100 in binary -> masked to 00
      expect(psg4.chipId).toBe(0);
    });

    it("should maintain independent state for different chip instances", () => {
      const psg0 = new PsgChip(0);
      const psg1 = new PsgChip(1);
      const psg2 = new PsgChip(2);

      // Set different register values on each chip
      psg0.setPsgRegisterIndex(0);
      psg0.writePsgRegisterValue(0x11);

      psg1.setPsgRegisterIndex(0);
      psg1.writePsgRegisterValue(0x22);

      psg2.setPsgRegisterIndex(0);
      psg2.writePsgRegisterValue(0x33);

      // Verify each chip maintains its own state
      psg0.setPsgRegisterIndex(0);
      expect(psg0.readPsgRegisterValue()).toBe(0x11);

      psg1.setPsgRegisterIndex(0);
      expect(psg1.readPsgRegisterValue()).toBe(0x22);

      psg2.setPsgRegisterIndex(0);
      expect(psg2.readPsgRegisterValue()).toBe(0x33);
    });

    it("should have read-only chipId property", () => {
      const psg = new PsgChip(1);
      expect(psg.chipId).toBe(1);
      // Attempting to change it should not work (TypeScript will prevent this)
      // This test verifies the property exists and has the correct value
    });
  });

  describe("Backward Compatibility with Single Chip", () => {
    let psg: PsgChip;

    beforeEach(() => {
      psg = new PsgChip(); // Default chip 0
    });

    it("should work normally without specifying chip ID", () => {
      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x42);
      expect(psg.readPsgRegisterValue()).toBe(0x42);
    });

    it("should generate output values as before", () => {
      // Set up a simple tone
      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x01);
      psg.setPsgRegisterIndex(1);
      psg.writePsgRegisterValue(0x00);

      // Enable tone A
      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0xfe); // Enable tone on A

      // Set volume A
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x0f);

      // Generate output - should not throw
      expect(() => {
        psg.generateOutputValue();
      }).not.toThrow();

      // Verify state was updated
      const state = psg.getPsgData();
      expect(state.toneAEnabled).toBe(true);
    });

    it("should support full register operations", () => {
      // Test all 16 registers
      for (let reg = 0; reg < 16; reg++) {
        psg.setPsgRegisterIndex(reg);
        const testValue = (reg * 17) & 0xff;
        psg.writePsgRegisterValue(testValue);
        expect(psg.readPsgRegisterValue()).toBe(testValue);
      }
    });

    it("should reset properly", () => {
      // Set some values
      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0xff);
      psg.setPsgRegisterIndex(1);
      psg.writePsgRegisterValue(0x0f);

      // Reset
      psg.reset();

      // Verify reset
      psg.setPsgRegisterIndex(0);
      expect(psg.readPsgRegisterValue()).toBe(0);
      psg.setPsgRegisterIndex(1);
      expect(psg.readPsgRegisterValue()).toBe(0);
    });
  });

  describe("PSG State Independence", () => {
    it("should have independent tone counters per chip", () => {
      const psg0 = new PsgChip(0);
      const psg1 = new PsgChip(1);

      // Set different tone frequencies on each chip
      psg0.setPsgRegisterIndex(0);
      psg0.writePsgRegisterValue(0x10);
      psg0.setPsgRegisterIndex(1);
      psg0.writePsgRegisterValue(0x00);

      psg1.setPsgRegisterIndex(0);
      psg1.writePsgRegisterValue(0x20);
      psg1.setPsgRegisterIndex(1);
      psg1.writePsgRegisterValue(0x00);

      // Generate output from both
      psg0.generateOutputValue();
      psg1.generateOutputValue();

      // Get state from both
      const state0 = psg0.getPsgData();
      const state1 = psg1.getPsgData();

      // Verify different tone values stored
      expect(state0.toneA).toBe(0x10);
      expect(state1.toneA).toBe(0x20);
    });

    it("should have independent envelope state per chip", () => {
      const psg0 = new PsgChip(0);
      const psg1 = new PsgChip(1);

      // Set envelope on chip 0
      psg0.setPsgRegisterIndex(11);
      psg0.writePsgRegisterValue(0x80);
      psg0.setPsgRegisterIndex(12);
      psg0.writePsgRegisterValue(0x01);
      psg0.setPsgRegisterIndex(13);
      psg0.writePsgRegisterValue(0x0f);

      // Set different envelope on chip 1
      psg1.setPsgRegisterIndex(11);
      psg1.writePsgRegisterValue(0x40);
      psg1.setPsgRegisterIndex(12);
      psg1.writePsgRegisterValue(0x00);
      psg1.setPsgRegisterIndex(13);
      psg1.writePsgRegisterValue(0x0c);

      // Verify different envelope states
      const state0 = psg0.getPsgData();
      const state1 = psg1.getPsgData();

      expect(state0.envFreq).toBe(0x0180);
      expect(state1.envFreq).toBe(0x0040);
      expect(state0.envStyle).toBe(0x0f);
      expect(state1.envStyle).toBe(0x0c);
    });

    it("should have independent orphan sample counters per chip", () => {
      const psg0 = new PsgChip(0);
      const psg1 = new PsgChip(1);

      // Setup and generate samples on psg0
      psg0.setPsgRegisterIndex(7);
      psg0.writePsgRegisterValue(0xfe);
      psg0.setPsgRegisterIndex(8);
      psg0.writePsgRegisterValue(0x0f);

      for (let i = 0; i < 10; i++) {
        psg0.generateOutputValue();
      }

      // psg1 should not have orphan samples
      const state0 = psg0.getPsgData();
      const state1 = psg1.getPsgData();

      expect(psg0.orphanSamples).toBeGreaterThan(0);
      expect(psg1.orphanSamples).toBe(0);
    });
  });

  describe("Multi-Chip Array Pattern", () => {
    it("should support creating an array of chip instances", () => {
      const chips = [new PsgChip(0), new PsgChip(1), new PsgChip(2)];

      expect(chips).toHaveLength(3);
      expect(chips[0].chipId).toBe(0);
      expect(chips[1].chipId).toBe(1);
      expect(chips[2].chipId).toBe(2);
    });

    it("should support mapping from chip selection to array index", () => {
      const chips = [new PsgChip(0), new PsgChip(1), new PsgChip(2)];

      // Simulate chip selection: 11 = chip 0, 10 = chip 1, 01 = chip 2
      const chipSelections = {
        0x3: 0, // 11 -> index 0
        0x2: 1, // 10 -> index 1
        0x1: 2, // 01 -> index 2
      };

      for (const [selection, expectedIndex] of Object.entries(chipSelections)) {
        const sel = parseInt(selection);
        // Map selection to chip
        let chipIndex = 0;
        if (sel === 0x2) chipIndex = 1;
        if (sel === 0x1) chipIndex = 2;

        expect(chips[chipIndex].chipId).toBe(expectedIndex);
      }
    });

    it("should handle rapid chip switching", () => {
      const chips = [new PsgChip(0), new PsgChip(1), new PsgChip(2)];

      // Simulate rapid switching and register writes
      let activeChip = 0;
      for (let i = 0; i < 100; i++) {
        activeChip = i % 3;
        chips[activeChip].setPsgRegisterIndex(0);
        chips[activeChip].writePsgRegisterValue(i & 0xff);
      }

      // Verify each chip has its own state
      chips[0].setPsgRegisterIndex(0);
      const val0 = chips[0].readPsgRegisterValue();

      chips[1].setPsgRegisterIndex(0);
      const val1 = chips[1].readPsgRegisterValue();

      chips[2].setPsgRegisterIndex(0);
      const val2 = chips[2].readPsgRegisterValue();

      // Values should be different (last write to each chip)
      expect(new Set([val0, val1, val2]).size).toBe(3);
    });
  });
});
