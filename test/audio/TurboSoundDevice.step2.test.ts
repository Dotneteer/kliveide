import { describe, it, expect, beforeEach } from "vitest";
import { TurboSoundDevice } from "@emu/machines/zxNext/TurboSoundDevice";

describe("Step 2: TurboSoundDevice", () => {
  let device: TurboSoundDevice;

  beforeEach(() => {
    device = new TurboSoundDevice();
  });

  describe("Initialization", () => {
    it("should initialize with 3 chips", () => {
      for (let i = 0; i < 3; i++) {
        const chip = device.getChip(i);
        expect(chip).toBeDefined();
        expect(chip.chipId).toBe(i);
      }
    });

    it("should initialize with chip 0 selected", () => {
      expect(device.getSelectedChipId()).toBe(0);
    });

    it("should initialize all chips in stereo mode", () => {
      for (let i = 0; i < 3; i++) {
        expect(device.getChipPanning(i)).toBe(0x3); // 11 = stereo
      }
    });

    it("should reset all chips", () => {
      device.getSelectedChip().setPsgRegisterIndex(0);
      device.getSelectedChip().writePsgRegisterValue(0xff);

      device.reset();

      device.getSelectedChip().setPsgRegisterIndex(0);
      expect(device.readPsgRegisterValue()).toBe(0);
    });
  });

  describe("Chip Selection via Register Index", () => {
    it("should select chip 0 with command 0xFF (bits 1:0 = 11)", () => {
      device.setPsgRegisterIndex(0xff);
      expect(device.getSelectedChipId()).toBe(0);
    });

    it("should select chip 1 with command 0xFE (bits 1:0 = 10)", () => {
      device.setPsgRegisterIndex(0xfe);
      expect(device.getSelectedChipId()).toBe(1);
    });

    it("should select chip 2 with command 0xFD (bits 1:0 = 01)", () => {
      device.setPsgRegisterIndex(0xfd);
      expect(device.getSelectedChipId()).toBe(2);
    });

    it("should ignore chip selection with command 0xFC (bits 1:0 = 00, reserved)", () => {
      device.setPsgRegisterIndex(0xff); // Select chip 0
      device.setPsgRegisterIndex(0xfc); // Try reserved selection
      expect(device.getSelectedChipId()).toBe(0); // Should remain chip 0
    });

    it("should set register index when bits 7:5 = 000", () => {
      device.setPsgRegisterIndex(0x05); // Bits 7:5 = 000
      const chip = device.getSelectedChip();
      chip.writePsgRegisterValue(0x42);

      device.setPsgRegisterIndex(0x05);
      expect(device.readPsgRegisterValue()).toBe(0x42);
    });

    it("should ignore commands with other bit patterns", () => {
      device.setPsgRegisterIndex(0xff);
      expect(device.getSelectedChipId()).toBe(0);

      // Try patterns that don't match: bit 7=0 or bits 4:2 != 111
      device.setPsgRegisterIndex(0x7f); // bit 7 = 0
      expect(device.getSelectedChipId()).toBe(0); // Unchanged

      device.setPsgRegisterIndex(0x8f); // bit 7=1, bits 4:2=001
      expect(device.getSelectedChipId()).toBe(0); // Unchanged
    });
  });

  describe("Panning Control", () => {
    it("should set panning through bits 6:5 of chip selection command", () => {
      // Commands with bit 7=1, bits 4:2=111, chip 0 (bits 1:0=11), different panning
      // panning = 00: 0x9F (10011111)
      device.setPsgRegisterIndex(0x9f);
      expect(device.getChipPanning(0)).toBe(0x0);

      // panning = 01: 0xBF (10111111)
      device.setPsgRegisterIndex(0xbf);
      expect(device.getChipPanning(0)).toBe(0x1);

      // panning = 10: 0xDF (11011111)
      device.setPsgRegisterIndex(0xdf);
      expect(device.getChipPanning(0)).toBe(0x2);

      // panning = 11: 0xFF (11111111)
      device.setPsgRegisterIndex(0xff);
      expect(device.getChipPanning(0)).toBe(0x3);
    });

    it("should support all panning modes", () => {
      const panningModes = [
        { mode: 0, cmd: 0x9f }, // panning 00, chip 0
        { mode: 1, cmd: 0xbf }, // panning 01, chip 0
        { mode: 2, cmd: 0xdf }, // panning 10, chip 0
        { mode: 3, cmd: 0xff }, // panning 11, chip 0
      ];

      for (const p of panningModes) {
        device.setPsgRegisterIndex(p.cmd);
        expect(device.getChipPanning(0)).toBe(p.mode);
      }
    });

    it("should apply panning per chip independently", () => {
      // Set chip 0 to panning = 00 (muted): 0x9F (10011111)
      device.setPsgRegisterIndex(0x9f); // bits 7:5=100, panning=00, chip 0
      expect(device.getChipPanning(0)).toBe(0);

      // Set chip 1 to panning = 11 (stereo): 0xFE (11111110)
      device.setPsgRegisterIndex(0xfe); // bits 7:5=111, panning=11, chip 1
      expect(device.getChipPanning(1)).toBe(3);

      // Set chip 2 to panning = 10 (left): 0xDD (11011101)
      device.setPsgRegisterIndex(0xdd); // bits 7:5=110, panning=10, chip 2
      expect(device.getChipPanning(2)).toBe(2);

      // Verify chip 0 still muted
      expect(device.getChipPanning(0)).toBe(0);
    });

    it("should maintain panning after chip selection", () => {
      // Set chip 0 with panning = left (10): 0xDF (11011111)
      device.setPsgRegisterIndex(0xdf); // panning = 10
      expect(device.getChipPanning(0)).toBe(2);

      // Switch to chip 1
      device.setPsgRegisterIndex(0xfe); // Select chip 1
      expect(device.getChipPanning(0)).toBe(2); // Should still be left
    });
  });

  describe("Register Operations", () => {
    it("should write and read registers on selected chip", () => {
      device.setPsgRegisterIndex(0x00);
      device.writePsgRegisterValue(0x42);
      expect(device.readPsgRegisterValue()).toBe(0x42);
    });

    it("should maintain isolated register state per chip", () => {
      // Write to chip 0
      device.setPsgRegisterIndex(0x00);
      device.writePsgRegisterValue(0x11);

      // Switch to chip 1 and write different value
      device.setPsgRegisterIndex(0xfe); // Select chip 1
      device.setPsgRegisterIndex(0x00);
      device.writePsgRegisterValue(0x22);

      // Switch to chip 2 and write different value
      device.setPsgRegisterIndex(0xfd); // Select chip 2
      device.setPsgRegisterIndex(0x00);
      device.writePsgRegisterValue(0x33);

      // Verify each chip has its own value
      device.setPsgRegisterIndex(0xff); // Chip 0
      device.setPsgRegisterIndex(0x00);
      expect(device.readPsgRegisterValue()).toBe(0x11);

      device.setPsgRegisterIndex(0xfe); // Chip 1
      device.setPsgRegisterIndex(0x00);
      expect(device.readPsgRegisterValue()).toBe(0x22);

      device.setPsgRegisterIndex(0xfd); // Chip 2
      device.setPsgRegisterIndex(0x00);
      expect(device.readPsgRegisterValue()).toBe(0x33);
    });

    it("should support all 16 registers per chip", () => {
      for (let reg = 0; reg < 16; reg++) {
        device.setPsgRegisterIndex(reg);
        const value = (reg * 17) & 0xff;
        device.writePsgRegisterValue(value);
        expect(device.readPsgRegisterValue()).toBe(value);
      }
    });
  });

  describe("Chip Access Methods", () => {
    it("should provide direct chip access", () => {
      const chip0 = device.getChip(0);
      const chip1 = device.getChip(1);
      const chip2 = device.getChip(2);

      expect(chip0.chipId).toBe(0);
      expect(chip1.chipId).toBe(1);
      expect(chip2.chipId).toBe(2);
    });

    it("should mask chip ID when accessing chips", () => {
      const chip0a = device.getChip(0);
      const chip0b = device.getChip(4); // 4 & 0x03 = 0
      expect(chip0a).toBe(chip0b);
    });

    it("should provide selected chip reference", () => {
      device.setPsgRegisterIndex(0xff);
      const selected = device.getSelectedChip();
      expect(selected.chipId).toBe(0);

      device.setPsgRegisterIndex(0xfe);
      const selected2 = device.getSelectedChip();
      expect(selected2.chipId).toBe(1);
    });

    it("should provide chip state information", () => {
      device.setPsgRegisterIndex(0x00);
      device.writePsgRegisterValue(0x42);

      const state = device.getSelectedChipState();
      expect(state).toBeDefined();
      expect(state.regValues[0]).toBe(0x42);
    });
  });

  describe("Output Generation", () => {
    it("should generate output for specific chip", () => {
      device.getChip(0).setPsgRegisterIndex(0);
      device.getChip(0).writePsgRegisterValue(0x10);
      device.getChip(0).setPsgRegisterIndex(1);
      device.getChip(0).writePsgRegisterValue(0x00);
      device.getChip(0).setPsgRegisterIndex(7);
      device.getChip(0).writePsgRegisterValue(0xfe);
      device.getChip(0).setPsgRegisterIndex(8);
      device.getChip(0).writePsgRegisterValue(0x0f);

      device.generateChipOutputValue(0);
      const orphans = device.getChipOrphanSamples(0);
      expect(orphans.count).toBeGreaterThan(0);
    });

    it("should generate output for all chips", () => {
      // Setup all chips
      for (let chipId = 0; chipId < 3; chipId++) {
        const chip = device.getChip(chipId);
        chip.setPsgRegisterIndex(0);
        chip.writePsgRegisterValue(0x10 * (chipId + 1));
        chip.setPsgRegisterIndex(1);
        chip.writePsgRegisterValue(0x00);
        chip.setPsgRegisterIndex(7);
        chip.writePsgRegisterValue(0xfe);
        chip.setPsgRegisterIndex(8);
        chip.writePsgRegisterValue(0x0f);
      }

      device.generateAllOutputValues();

      // All chips should have samples
      for (let chipId = 0; chipId < 3; chipId++) {
        const orphans = device.getChipOrphanSamples(chipId);
        expect(orphans.count).toBeGreaterThan(0);
      }
    });
  });

  describe("Orphan Sample Management", () => {
    it("should track orphan samples per chip", () => {
      device.getChip(0).setPsgRegisterIndex(0);
      device.getChip(0).writePsgRegisterValue(0x10);
      device.getChip(0).setPsgRegisterIndex(7);
      device.getChip(0).writePsgRegisterValue(0xfe);
      device.getChip(0).setPsgRegisterIndex(8);
      device.getChip(0).writePsgRegisterValue(0x0f);

      // Generate output on chip 0
      for (let i = 0; i < 10; i++) {
        device.generateChipOutputValue(0);
      }

      const orphans0 = device.getChipOrphanSamples(0);
      const orphans1 = device.getChipOrphanSamples(1);

      expect(orphans0.count).toBe(10);
      expect(orphans1.count).toBe(0);
    });

    it("should clear orphan samples for specific chip", () => {
      device.getChip(0).orphanSamples = 5;
      device.getChip(0).orphanSum = 100;

      device.clearChipOrphanSamples(0);

      const orphans = device.getChipOrphanSamples(0);
      expect(orphans.count).toBe(0);
      expect(orphans.sum).toBe(0);
    });

    it("should clear orphan samples for all chips", () => {
      for (let i = 0; i < 3; i++) {
        device.getChip(i).orphanSamples = (i + 1) * 5;
        device.getChip(i).orphanSum = (i + 1) * 100;
      }

      device.clearAllOrphanSamples();

      for (let i = 0; i < 3; i++) {
        const orphans = device.getChipOrphanSamples(i);
        expect(orphans.count).toBe(0);
        expect(orphans.sum).toBe(0);
      }
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle rapid chip switching", () => {
      // Write different values to register 0 on each chip in a pattern
      for (let i = 0; i < 99; i++) {
        const chipSelect = (i % 3) + 1; // 1, 2, 3 (maps to 2, 1, 0)
        const command = 0xfc | chipSelect; // Valid chip selection command
        device.setPsgRegisterIndex(command);

        device.setPsgRegisterIndex(0x00);
        device.writePsgRegisterValue((i % 3) * 0x33); // Different value per chip
      }

      // Verify final state
      device.setPsgRegisterIndex(0xff); // Chip 0
      device.setPsgRegisterIndex(0x00);
      const val0 = device.readPsgRegisterValue();

      device.setPsgRegisterIndex(0xfe); // Chip 1
      device.setPsgRegisterIndex(0x00);
      const val1 = device.readPsgRegisterValue();

      device.setPsgRegisterIndex(0xfd); // Chip 2
      device.setPsgRegisterIndex(0x00);
      const val2 = device.readPsgRegisterValue();

      // All three chips should have been written to and should have values
      expect([val0, val1, val2].some(v => v !== 0)).toBe(true);
    });

    it("should handle mixed register and selection commands", () => {
      // Write sequence: select chip, set registers, select different chip, set registers
      device.setPsgRegisterIndex(0xff); // Select chip 0
      device.setPsgRegisterIndex(0x00);
      device.writePsgRegisterValue(0x11);
      device.setPsgRegisterIndex(0x08);
      device.writePsgRegisterValue(0x0f);

      device.setPsgRegisterIndex(0xfe); // Select chip 1
      device.setPsgRegisterIndex(0x00);
      device.writePsgRegisterValue(0x22);
      device.setPsgRegisterIndex(0x08);
      device.writePsgRegisterValue(0x07);

      // Verify chip 0
      device.setPsgRegisterIndex(0xff);
      device.setPsgRegisterIndex(0x00);
      expect(device.readPsgRegisterValue()).toBe(0x11);
      device.setPsgRegisterIndex(0x08);
      expect(device.readPsgRegisterValue()).toBe(0x0f);

      // Verify chip 1
      device.setPsgRegisterIndex(0xfe);
      device.setPsgRegisterIndex(0x00);
      expect(device.readPsgRegisterValue()).toBe(0x22);
      device.setPsgRegisterIndex(0x08);
      expect(device.readPsgRegisterValue()).toBe(0x07);
    });

    it("should maintain panning and selection through operations", () => {
      // Set different panning for each chip
      // Chip 0 with panning = 11 (stereo): 0xFF (11111111)
      device.setPsgRegisterIndex(0xff); // Chip 0, panning = 11
      expect(device.getSelectedChipId()).toBe(0);
      expect(device.getChipPanning(0)).toBe(3);

      // Chip 1 with panning = 10 (left): 0xDE (11011110)
      device.setPsgRegisterIndex(0xde); // Chip 1, panning = 10
      expect(device.getSelectedChipId()).toBe(1);
      expect(device.getChipPanning(1)).toBe(2);

      // Chip 2 with panning = 01 (right): 0xBD (10111101)
      device.setPsgRegisterIndex(0xbd); // Chip 2, panning = 01
      expect(device.getSelectedChipId()).toBe(2);
      expect(device.getChipPanning(2)).toBe(1);

      // Verify all settings persisted
      expect(device.getChipPanning(0)).toBe(3);
      expect(device.getChipPanning(1)).toBe(2);
      expect(device.getChipPanning(2)).toBe(1);
    });
  });
});
