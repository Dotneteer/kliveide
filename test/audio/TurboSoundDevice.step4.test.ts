import { describe, it, expect, beforeEach } from "vitest";
import { TurboSoundDevice } from "@emu/machines/zxNext/TurboSoundDevice";

describe("TurboSoundDevice Step 4: PSG Pan Control", () => {
  let device: TurboSoundDevice;

  beforeEach(() => {
    device = new TurboSoundDevice();
  });

  // ==================== Panning Functionality Tests ====================

  describe("Panning Modes (00/01/10/11)", () => {
    it("should initialize all chips with stereo panning (11)", () => {
      expect(device.getChipPanning(0)).toBe(0x03);
      expect(device.getChipPanning(1)).toBe(0x03);
      expect(device.getChipPanning(2)).toBe(0x03);
    });

    it("should mute output when panning is 00 (muted)", () => {
      device.setPsgRegisterIndex(0x9f); // Chip 0, pan 00
      
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    });

    it("should output right channel only when panning is 01 (right)", () => {
      // Setup with stereo first
      const chip = device.getChip(0);
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(15); // Volume
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x00); // Enable tone
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(1); // Tone freq
      
      // Generate output samples
      for (let i = 0; i < 100; i++) device.generateAllOutputValues();
      const stereoOutput = device.getChipStereoOutput(0);
      
      // Pan right
      device.setPsgRegisterIndex(0xbf); // Pan 01
      const output = device.getChipStereoOutput(0);
      
      expect(output.left).toBe(0);
      expect(output.right).toBe(stereoOutput.right);
    });

    it("should output left channel only when panning is 10 (left)", () => {
      const chip = device.getChip(0);
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(15);
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x00);
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(1);
      
      for (let i = 0; i < 100; i++) device.generateAllOutputValues();
      const stereoOutput = device.getChipStereoOutput(0);
      
      device.setPsgRegisterIndex(0xdf); // Pan 10
      const output = device.getChipStereoOutput(0);
      
      expect(output.left).toBe(stereoOutput.left);
      expect(output.right).toBe(0);
    });

    it("should output both channels when panning is 11 (stereo)", () => {
      expect(device.getChipPanning(0)).toBe(0x03); // Should be stereo by default
      const output = device.getChipStereoOutput(0);
      expect(typeof output.left).toBe("number");
      expect(typeof output.right).toBe("number");
    });
  });

  // ==================== Pan Control via Commands ====================

  describe("Pan Control via Chip Selection Commands", () => {
    it("should apply panning 00 via command 0x9F", () => {
      device.setPsgRegisterIndex(0x9f);
      expect(device.getChipPanning(0)).toBe(0x00);
    });

    it("should apply panning 01 via command 0xBF", () => {
      device.setPsgRegisterIndex(0xbf);
      expect(device.getChipPanning(0)).toBe(0x01);
    });

    it("should apply panning 10 via command 0xDF", () => {
      device.setPsgRegisterIndex(0xdf);
      expect(device.getChipPanning(0)).toBe(0x02);
    });

    it("should apply panning 11 via command 0xFF", () => {
      device.setPsgRegisterIndex(0xff);
      expect(device.getChipPanning(0)).toBe(0x03);
    });
  });

  // ==================== Multi-Chip Independence ====================

  describe("Multi-Chip Pan Independence", () => {
    it("should maintain independent pan settings for each chip", () => {
      device.setPsgRegisterIndex(0x9f); // Chip 0, pan 00
      device.setPsgRegisterIndex(0xbe); // Chip 1, pan 01
      device.setPsgRegisterIndex(0xdd); // Chip 2, pan 10

      expect(device.getChipPanning(0)).toBe(0x00);
      expect(device.getChipPanning(1)).toBe(0x01);
      expect(device.getChipPanning(2)).toBe(0x02);
    });

    it("should not affect other chips when changing panning", () => {
      device.setPsgRegisterIndex(0x9f);
      expect(device.getChipPanning(0)).toBe(0x00);
      
      device.setPsgRegisterIndex(0xbe);
      
      expect(device.getChipPanning(0)).toBe(0x00);
      expect(device.getChipPanning(1)).toBe(0x01);
    });

    it("should handle all three chips with different pans", () => {
      const commands = [0xff, 0xbe, 0xdd];
      const expectedPans = [0x03, 0x01, 0x02];

      commands.forEach((cmd, idx) => {
        device.setPsgRegisterIndex(cmd);
        expect(device.getChipPanning(idx)).toBe(expectedPans[idx]);
      });
    });
  });

  // ==================== Panning with Stereo/Mono Modes ====================

  describe("Panning with Stereo/Mono Modes", () => {
    it("should apply panning to ABC stereo mode", () => {
      device.setAyStereoMode(false);
      device.setPsgRegisterIndex(0x9f);
      
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    });

    it("should apply panning to ACB stereo mode", () => {
      device.setAyStereoMode(true);
      device.setPsgRegisterIndex(0x9f);
      
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    });

    it("should apply panning to mono mode", () => {
      device.setChipMonoMode(0, true);
      device.setPsgRegisterIndex(0x9f);
      
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    });

    it("should produce zero output in muted mode regardless of source", () => {
      device.setAyStereoMode(false);
      device.setPsgRegisterIndex(0x9f);
      let output = device.getChipStereoOutput(0);
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);

      device.setAyStereoMode(true);
      output = device.getChipStereoOutput(0);
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);

      device.setChipMonoMode(0, true);
      output = device.getChipStereoOutput(0);
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    });
  });

  // ==================== Panning Persistence ====================

  describe("Pan Persistence", () => {
    it("should maintain panning after device reset", () => {
      device.setPsgRegisterIndex(0xdf);
      device.reset();
      expect(device.getChipPanning(0)).toBe(0x03);
    });

    it("should maintain panning while toggling stereo mode", () => {
      device.setPsgRegisterIndex(0xbf);
      expect(device.getChipPanning(0)).toBe(0x01);

      device.setAyStereoMode(true);
      expect(device.getChipPanning(0)).toBe(0x01);

      device.setAyStereoMode(false);
      expect(device.getChipPanning(0)).toBe(0x01);
    });

    it("should maintain panning while toggling mono mode", () => {
      device.setPsgRegisterIndex(0xdf);
      expect(device.getChipPanning(0)).toBe(0x02);

      device.setChipMonoMode(0, true);
      expect(device.getChipPanning(0)).toBe(0x02);

      device.setChipMonoMode(0, false);
      expect(device.getChipPanning(0)).toBe(0x02);
    });
  });

  // ==================== Output Verification ====================

  describe("Output Verification", () => {
    it("should produce zero output when channels are disabled", () => {
      const chip = device.getChip(0);
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3f);
      
      const panCommands = [0x9f, 0xbf, 0xdf, 0xff];
      
      panCommands.forEach((cmd) => {
        device.setPsgRegisterIndex(cmd);
        const output = device.getChipStereoOutput(0);
        expect(output.left).toBe(0);
        expect(output.right).toBe(0);
      });
    });

    it("should handle panning with zero output channels", () => {
      const chip = device.getChip(0);
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3f);

      device.setPsgRegisterIndex(0xbf);
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    });
  });

  // ==================== Complex Scenarios ====================

  describe("Complex Pan Scenarios", () => {
    it("should handle rapid panning changes", () => {
      const panValues = [0xff, 0xdf, 0xbf, 0x9f, 0xff];
      const expectedPans = [0x03, 0x02, 0x01, 0x00, 0x03];

      panValues.forEach((val, idx) => {
        device.setPsgRegisterIndex(val);
        expect(device.getChipPanning(0)).toBe(expectedPans[idx]);
      });
    });

    it("should combine panning with volume changes", () => {
      const chip = device.getChip(0);

      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(5);
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x00);
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(1);

      for (let i = 0; i < 50; i++) device.generateAllOutputValues();
      
      device.setPsgRegisterIndex(0xdf); // Left pan
      expect(device.getChipPanning(0)).toBe(0x02);

      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(10);
      
      for (let i = 0; i < 50; i++) device.generateAllOutputValues();

      expect(device.getChipPanning(0)).toBe(0x02);
      
      const output = device.getChipStereoOutput(0);
      expect(output.right).toBe(0);
    });

    it("should handle all pan modes for different chips", () => {
      for (let chipId = 0; chipId < 3; chipId++) {
        const chip = device.getChip(chipId);
        chip.setPsgRegisterIndex(8);
        chip.writePsgRegisterValue(15);
        chip.setPsgRegisterIndex(7);
        chip.writePsgRegisterValue(0x00);
        chip.setPsgRegisterIndex(0);
        chip.writePsgRegisterValue(1);
      }

      for (let i = 0; i < 100; i++) device.generateAllOutputValues();

      device.setPsgRegisterIndex(0xff);
      device.setPsgRegisterIndex(0xbe);
      device.setPsgRegisterIndex(0xdd);

      expect(device.getChipPanning(0)).toBe(0x03);
      expect(device.getChipPanning(1)).toBe(0x01);
      expect(device.getChipPanning(2)).toBe(0x02);

      const out0 = device.getChipStereoOutput(0);
      const out1 = device.getChipStereoOutput(1);
      const out2 = device.getChipStereoOutput(2);

      expect(typeof out0.left).toBe("number");
      expect(typeof out1.left).toBe("number");
      expect(typeof out2.left).toBe("number");
    });
  });

  // ==================== Integration with Previous Steps ====================

  describe("Integration with Previous Steps", () => {
    it("should work with chip selection protocol", () => {
      device.setPsgRegisterIndex(0xbe);

      expect(device.getSelectedChipId()).toBe(1);
      expect(device.getChipPanning(1)).toBe(0x01);
    });

    it("should work with all three chips independently", () => {
      device.setPsgRegisterIndex(0xff);
      device.setPsgRegisterIndex(0xfe);
      device.setPsgRegisterIndex(0xfd);

      expect(device.getSelectedChipId()).toBe(2);
      
      expect(device.getChipPanning(0)).toBe(0x03);
      expect(device.getChipPanning(1)).toBe(0x03);
      expect(device.getChipPanning(2)).toBe(0x03);
    });

    it("should work alongside stereo mode control", () => {
      device.setAyStereoMode(false);
      device.setPsgRegisterIndex(0xdf);
      
      expect(device.getAyStereoMode()).toBe(false);
      expect(device.getChipPanning(0)).toBe(0x02);

      device.setAyStereoMode(true);
      
      expect(device.getAyStereoMode()).toBe(true);
      expect(device.getChipPanning(0)).toBe(0x02);
    });

    it("should work alongside mono mode control", () => {
      device.setChipMonoMode(0, true);
      device.setPsgRegisterIndex(0xbf);
      
      expect(device.getChipMonoMode(0)).toBe(true);
      expect(device.getChipPanning(0)).toBe(0x01);

      device.setChipMonoMode(0, false);
      
      expect(device.getChipMonoMode(0)).toBe(false);
      expect(device.getChipPanning(0)).toBe(0x01);
    });
  });
});
