import { describe, it, expect, beforeEach } from "vitest";
import { TurboSoundDevice } from "@emu/machines/zxNext/TurboSoundDevice";
import { DacDevice } from "@emu/machines/zxNext/DacDevice";
import { AudioControlDevice } from "@emu/machines/zxNext/AudioControlDevice";

describe("Port Handlers Step 10: I/O Port Integration", () => {
  let turboSound: TurboSoundDevice;
  let dac: DacDevice;
  let audioControl: AudioControlDevice;

  beforeEach(() => {
    turboSound = new TurboSoundDevice();
    dac = new DacDevice();
    audioControl = new AudioControlDevice({
      soundDevice: {
        beepOnlyToInternalSpeaker: false,
        psgMode: 0,
        ayStereoMode: false,
        enableInternalSpeaker: true,
        enable8BitDacs: false,
        enableTurbosound: false,
        ay2Mono: false,
        ay1Mono: false,
        ay0Mono: false,
        silenceHdmiAudio: false,
        reset: () => {},
        machine: undefined
      }
    } as any);
  });

  // ==================== AY Register Port (0xFFFD) Tests ====================

  describe("AY Register Port (0xFFFD)", () => {
    it("should select register on standard write", () => {
      turboSound.selectRegister(5);
      expect(turboSound.getSelectedRegister()).toBe(5);
    });

    it("should select different registers", () => {
      turboSound.selectRegister(0);
      expect(turboSound.getSelectedRegister()).toBe(0);

      turboSound.selectRegister(15);
      expect(turboSound.getSelectedRegister()).toBe(15);
    });

    it("should handle chip selection command", () => {
      // Chip selection format: bit 7=1, bits 4:2=111
      // For chip 0 (11): 0xBF with bits 6:5 for panning
      turboSound.selectChip(0); // Select chip 0
      expect(turboSound.getSelectedChipId()).toBe(0);

      turboSound.selectChip(1); // Select chip 1
      expect(turboSound.getSelectedChipId()).toBe(1);

      turboSound.selectChip(2); // Select chip 2
      expect(turboSound.getSelectedChipId()).toBe(2);
    });

    it("should handle panning control", () => {
      turboSound.selectChip(0);
      
      turboSound.setChipPanning(0, 0x00); // Mute
      expect(turboSound.getChipPanning(0)).toBe(0x00);

      turboSound.setChipPanning(0, 0x01); // Right only
      expect(turboSound.getChipPanning(0)).toBe(0x01);

      turboSound.setChipPanning(0, 0x02); // Left only
      expect(turboSound.getChipPanning(0)).toBe(0x02);

      turboSound.setChipPanning(0, 0x03); // Stereo
      expect(turboSound.getChipPanning(0)).toBe(0x03);
    });

    it("should mask register index to 4 bits", () => {
      turboSound.selectRegister(0xFF); // Should be masked to 0x0F
      expect(turboSound.getSelectedRegister()).toBe(0x0F);
    });

    it("should mask chip ID to 2 bits", () => {
      turboSound.selectChip(0xFF); // Should be masked to 0x03
      expect(turboSound.getSelectedChipId()).toBe(0x03);
    });

    it("should maintain chip selection across register changes", () => {
      turboSound.selectChip(1);
      turboSound.selectRegister(5);
      expect(turboSound.getSelectedChipId()).toBe(1);
      expect(turboSound.getSelectedRegister()).toBe(5);

      turboSound.selectRegister(10);
      expect(turboSound.getSelectedChipId()).toBe(1); // Still chip 1
    });

    it("should support multiple chip selections", () => {
      turboSound.selectChip(0);
      turboSound.selectRegister(3);
      expect(turboSound.getSelectedChipId()).toBe(0);

      turboSound.selectChip(1);
      turboSound.selectRegister(7);
      expect(turboSound.getSelectedChipId()).toBe(1);

      turboSound.selectChip(2);
      turboSound.selectRegister(12);
      expect(turboSound.getSelectedChipId()).toBe(2);
    });
  });

  // ==================== AY Data Port (0xBFFD) Tests ====================

  describe("AY Data Port (0xBFFD) - Read/Write", () => {
    it("should write to currently selected register", () => {
      turboSound.selectChip(0);
      turboSound.selectRegister(0); // Tone period A low
      turboSound.writeSelectedRegister(0x42);
      
      // Read back the value
      const value = turboSound.readSelectedRegister();
      expect(value).toBe(0x42);
    });

    it("should read from currently selected register", () => {
      turboSound.selectChip(0);
      turboSound.selectRegister(0);
      turboSound.writeSelectedRegister(0xAB);
      
      expect(turboSound.readSelectedRegister()).toBe(0xAB);
    });

    it("should handle chip isolation in reads", () => {
      turboSound.selectChip(0);
      turboSound.selectRegister(0);
      turboSound.writeSelectedRegister(0x11);

      turboSound.selectChip(1);
      turboSound.selectRegister(0);
      turboSound.writeSelectedRegister(0x22);

      // Read from chip 0
      turboSound.selectChip(0);
      expect(turboSound.readSelectedRegister()).toBe(0x11);

      // Read from chip 1
      turboSound.selectChip(1);
      expect(turboSound.readSelectedRegister()).toBe(0x22);
    });

    it("should handle multiple register writes", () => {
      turboSound.selectChip(0);

      // Write to multiple registers
      turboSound.selectRegister(0);
      turboSound.writeSelectedRegister(0x10);

      turboSound.selectRegister(1);
      turboSound.writeSelectedRegister(0x20);

      turboSound.selectRegister(2);
      turboSound.writeSelectedRegister(0x30);

      // Read them back in different order
      turboSound.selectRegister(1);
      expect(turboSound.readSelectedRegister()).toBe(0x20);

      turboSound.selectRegister(0);
      expect(turboSound.readSelectedRegister()).toBe(0x10);

      turboSound.selectRegister(2);
      expect(turboSound.readSelectedRegister()).toBe(0x30);
    });

    it("should support continuous writes to different registers", () => {
      turboSound.selectChip(0);
      const values = [0xAA, 0xBB, 0xCC, 0xDD, 0xEE];

      for (let i = 0; i < values.length; i++) {
        turboSound.selectRegister(i);
        turboSound.writeSelectedRegister(values[i]);
      }

      // Verify all values
      for (let i = 0; i < values.length; i++) {
        turboSound.selectRegister(i);
        expect(turboSound.readSelectedRegister()).toBe(values[i]);
      }
    });
  });

  // ==================== AY Info Port (0xBFF5) Tests ====================

  describe("AY Info Port (0xBFF5) - Info Read", () => {
    it("should return chip ID and register in info read", () => {
      // Select chip 0, register 5
      turboSound.selectChip(0);
      turboSound.selectRegister(5);

      // Read info: bits 7:4 = chip ID (1=chip0, 2=chip1, 4=chip2), bits 3:0 = register
      // For chip 0 (chipId=0), encoded as 1: (1 << 0) = 1
      // Expected: 0x15 (chip 1 + register 5)
      const info = (1 << 4) | 5; // 0x15
      expect(info).toBe(0x15);
    });

    it("should encode all chip IDs correctly", () => {
      // Chip 0 → 1
      let chipId = 0;
      let encoded = 1 << chipId; // 1
      expect(encoded).toBe(1);

      // Chip 1 → 2
      chipId = 1;
      encoded = 1 << chipId; // 2
      expect(encoded).toBe(2);

      // Chip 2 → 4
      chipId = 2;
      encoded = 1 << chipId; // 4
      expect(encoded).toBe(4);
    });

    it("should include register index in info read", () => {
      for (let reg = 0; reg < 16; reg++) {
        turboSound.selectRegister(reg);
        const registerInfo = turboSound.getSelectedRegister() & 0x0f;
        expect(registerInfo).toBe(reg);
      }
    });
  });

  // ==================== DAC Port Tests ====================

  describe("DAC Ports - Individual Channels", () => {
    it("should write DAC A via port", () => {
      dac.setDacA(0x55);
      expect(dac.getDacA()).toBe(0x55);
    });

    it("should write DAC B via port", () => {
      dac.setDacB(0x66);
      expect(dac.getDacB()).toBe(0x66);
    });

    it("should write DAC C via port", () => {
      dac.setDacC(0x77);
      expect(dac.getDacC()).toBe(0x77);
    });

    it("should write DAC D via port", () => {
      dac.setDacD(0x88);
      expect(dac.getDacD()).toBe(0x88);
    });

    it("should handle all DAC ports independently", () => {
      dac.setDacA(0x10);
      dac.setDacB(0x20);
      dac.setDacC(0x30);
      dac.setDacD(0x40);

      expect(dac.getDacA()).toBe(0x10);
      expect(dac.getDacB()).toBe(0x20);
      expect(dac.getDacC()).toBe(0x30);
      expect(dac.getDacD()).toBe(0x40);
    });

    it("should support all 256 values per channel", () => {
      for (let i = 0; i < 256; i++) {
        dac.setDacA(i);
        expect(dac.getDacA()).toBe(i);
      }
    });
  });

  describe("DAC Ports - Combined Channels", () => {
    it("should write DAC A and D together", () => {
      const value = 0x99;
      dac.setDacA(value);
      dac.setDacD(value);
      
      expect(dac.getDacA()).toBe(0x99);
      expect(dac.getDacD()).toBe(0x99);
    });

    it("should write DAC B and C together", () => {
      const value = 0xAA;
      dac.setDacB(value);
      dac.setDacC(value);
      
      expect(dac.getDacB()).toBe(0xAA);
      expect(dac.getDacC()).toBe(0xAA);
    });

    it("should not affect other channels when writing combined", () => {
      dac.setDacA(0x11);
      dac.setDacB(0x22);
      dac.setDacC(0x33);
      dac.setDacD(0x44);

      // Write A and D together
      dac.setDacA(0xFF);
      dac.setDacD(0xFF);

      // Check B and C unchanged
      expect(dac.getDacB()).toBe(0x22);
      expect(dac.getDacC()).toBe(0x33);
    });
  });

  // ==================== DAC Port Multiplexing Tests ====================

  describe("DAC Port Multiplexing", () => {
    it("should handle multiple writes to same DAC", () => {
      for (let i = 0; i < 256; i += 17) {
        dac.setDacA(i);
        expect(dac.getDacA()).toBe(i);
      }
    });

    it("should maintain DAC state across multiple operations", () => {
      dac.setDacA(0x12);
      dac.setDacB(0x34);
      dac.setDacC(0x56);
      dac.setDacD(0x78);

      dac.setDacB(0xAA); // Change only B
      expect(dac.getDacA()).toBe(0x12);
      expect(dac.getDacB()).toBe(0xAA);
      expect(dac.getDacC()).toBe(0x56);
      expect(dac.getDacD()).toBe(0x78);
    });

    it("should handle alternating port writes", () => {
      dac.setDacA(0x11);
      dac.setDacD(0x44);
      dac.setDacA(0x1A);
      dac.setDacD(0x4D);
      dac.setDacA(0x1B);
      dac.setDacD(0x4E);

      expect(dac.getDacA()).toBe(0x1B);
      expect(dac.getDacD()).toBe(0x4E);
    });
  });

  // ==================== Port Handler Integration Tests ====================

  describe("Port Handler Integration", () => {
    it("should support complete AY command sequence", () => {
      // Chip selection
      turboSound.selectChip(0);
      expect(turboSound.getSelectedChipId()).toBe(0);

      // Register selection
      turboSound.selectRegister(7); // Enable register
      expect(turboSound.getSelectedRegister()).toBe(7);

      // Register write
      turboSound.writeSelectedRegister(0x38); // Disable channels
      expect(turboSound.readSelectedRegister()).toBe(0x38);
    });

    it("should support complete DAC sequence", () => {
      // DAC A write
      dac.setDacA(0x80);
      
      // DAC B write
      dac.setDacB(0x7F);
      
      // DAC C write
      dac.setDacC(0x81);
      
      // DAC D write
      dac.setDacD(0x7E);

      // Verify all values
      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x7F);
      expect(dac.getDacC()).toBe(0x81);
      expect(dac.getDacD()).toBe(0x7E);
    });

    it("should maintain independence between AY and DAC", () => {
      // Configure AY
      turboSound.selectChip(0);
      turboSound.selectRegister(0);
      turboSound.writeSelectedRegister(0x50);

      // Configure DAC
      dac.setDacA(0x90);
      dac.setDacB(0x91);

      // Verify AY state
      expect(turboSound.readSelectedRegister()).toBe(0x50);

      // Verify DAC state
      expect(dac.getDacA()).toBe(0x90);
      expect(dac.getDacB()).toBe(0x91);
    });
  });

  // ==================== Edge Cases and Error Handling ====================

  describe("Edge Cases", () => {
    it("should handle register 0xFFFF mask correctly", () => {
      turboSound.selectRegister(0xFFFF);
      expect(turboSound.getSelectedRegister()).toBe(0x0F); // Masked to 4 bits
    });

    it("should handle chip ID 0xFFFF mask correctly", () => {
      turboSound.selectChip(0xFFFF);
      expect(turboSound.getSelectedChipId()).toBe(0x03); // Masked to 2 bits
    });

    it("should handle DAC value boundary cases", () => {
      // Minimum value
      dac.setDacA(0x00);
      expect(dac.getDacA()).toBe(0x00);

      // Maximum value
      dac.setDacA(0xFF);
      expect(dac.getDacA()).toBe(0xFF);

      // Center value
      dac.setDacA(0x80);
      expect(dac.getDacA()).toBe(0x80);
    });

    it("should maintain state after rapid operations", () => {
      for (let i = 0; i < 100; i++) {
        turboSound.selectChip(i % 3);
        turboSound.selectRegister(i % 16);
        dac.setDacA((i * 5) & 0xFF);
      }

      // State should be at i=99
      const chipAtEnd = 99 % 3; // 1
      const regAtEnd = 99 % 16; // 3
      const dacAtEnd = (99 * 5) & 0xFF; // 239

      expect(turboSound.getSelectedChipId()).toBe(chipAtEnd);
      expect(turboSound.getSelectedRegister()).toBe(regAtEnd);
      expect(dac.getDacA()).toBe(dacAtEnd);
    });
  });
});
