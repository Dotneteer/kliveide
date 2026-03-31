import { describe, it, expect, beforeEach } from "vitest";
import { DacDevice } from "@emu/machines/zxNext/DacDevice";
import { AudioControlDevice } from "@emu/machines/zxNext/AudioControlDevice";
import {
  writeDacPort0x1F,
  writeDacPort0x0F,
  writeDacPort0x3F,
  writeDacPort0x4F,
  writeDacPort0x5F,
  writeDacPort0xB3,
  writeDacPort0xDF,
  writeDacPort0xF1,
  writeDacPort0xF3,
  writeDacPort0xF9,
  writeDacPort0xFB
} from "@emu/machines/zxNext/io-ports/DacPortHandler";

/**
 * Creates a mock machine with controllable enable flags.
 * All per-port enable flags default to false.
 */
function createMockMachine(enable8BitDacs = false) {
  const dac = new DacDevice();
  const soundDevice = {
    enable8BitDacs,
    beepOnlyToInternalSpeaker: false,
    psgMode: 0,
    ayStereoMode: false,
    enableInternalSpeaker: true,
    enableTurbosound: false,
    ay2Mono: false,
    ay1Mono: false,
    ay0Mono: false,
    silenceHdmiAudio: false,
    reset: () => {},
    machine: undefined as any
  };
  const nextRegDevice = {
    portDacMode1Enabled: false,
    portDacMode2Enabled: false,
    portDacStereoProfiCovoxEnabled: false,
    portDacStereoCovoxEnabled: false,
    portDacMonoPentagonEnabled: false,
    portDacMonoGsCovoxEnabled: false,
    portDacMonoSpecdrumEnabled: false
  };
  const mockMachine = { soundDevice, nextRegDevice, baseClockFrequency: 3_500_000 } as any;
  const audioControlDevice = new AudioControlDevice(mockMachine);
  (audioControlDevice as any).dacDevice = dac;
  mockMachine.audioControlDevice = audioControlDevice;
  return { machine: mockMachine, dac, soundDevice, nextRegDevice };
}

describe("DAC Per-Port Enable Gating (D1, D2, D3, D4)", () => {
  // ==================== D1: Port 0x1F writes DAC A only ====================

  describe("D1: Port 0x1F writes DAC A only (SoundDrive mode 1)", () => {
    it("should write DAC A only when enable8BitDacs and portDacMode1Enabled", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacMode1Enabled = true;

      writeDacPort0x1F(machine, 0x55);

      expect(dac.getDacA()).toBe(0x55);
      expect(dac.getDacB()).toBe(0x80); // unchanged
      expect(dac.getDacC()).toBe(0x80); // unchanged
      expect(dac.getDacD()).toBe(0x80); // unchanged
    });

    it("should NOT write when enable8BitDacs is false", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(false);
      nextRegDevice.portDacMode1Enabled = true;

      writeDacPort0x1F(machine, 0x55);

      expect(dac.getDacA()).toBe(0x80);
    });

    it("should NOT write when portDacMode1Enabled is false", () => {
      const { machine, dac } = createMockMachine(true);

      writeDacPort0x1F(machine, 0x55);

      expect(dac.getDacA()).toBe(0x80);
    });
  });

  // ==================== D2: Port 0x3F writes DAC A only ====================

  describe("D2: Port 0x3F writes DAC A only (profi covox)", () => {
    it("should write DAC A only when enable8BitDacs and portDacStereoProfiCovoxEnabled", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacStereoProfiCovoxEnabled = true;

      writeDacPort0x3F(machine, 0x44);

      expect(dac.getDacA()).toBe(0x44);
      expect(dac.getDacB()).toBe(0x80); // unchanged
      expect(dac.getDacC()).toBe(0x80); // unchanged
      expect(dac.getDacD()).toBe(0x80); // unchanged
    });

    it("should NOT write when enable8BitDacs is false", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(false);
      nextRegDevice.portDacStereoProfiCovoxEnabled = true;

      writeDacPort0x3F(machine, 0x44);

      expect(dac.getDacA()).toBe(0x80);
    });

    it("should NOT write when portDacStereoProfiCovoxEnabled is false", () => {
      const { machine, dac } = createMockMachine(true);

      writeDacPort0x3F(machine, 0x44);

      expect(dac.getDacA()).toBe(0x80);
    });
  });

  // ==================== D3: Per-port enable gating ====================

  describe("D3: Port 0x0F enable gating (SD1 OR covox)", () => {
    it("should write DAC B when portDacMode1Enabled", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacMode1Enabled = true;

      writeDacPort0x0F(machine, 0x33);

      expect(dac.getDacB()).toBe(0x33);
    });

    it("should write DAC B when portDacStereoCovoxEnabled", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacStereoCovoxEnabled = true;

      writeDacPort0x0F(machine, 0x33);

      expect(dac.getDacB()).toBe(0x33);
    });

    it("should NOT write when neither enable bit is set", () => {
      const { machine, dac } = createMockMachine(true);

      writeDacPort0x0F(machine, 0x33);

      expect(dac.getDacB()).toBe(0x80);
    });
  });

  describe("D3: Port 0x4F enable gating (SD1 OR covox)", () => {
    it("should write DAC C when portDacMode1Enabled", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacMode1Enabled = true;

      writeDacPort0x4F(machine, 0x22);

      expect(dac.getDacC()).toBe(0x22);
    });

    it("should write DAC C when portDacStereoCovoxEnabled", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacStereoCovoxEnabled = true;

      writeDacPort0x4F(machine, 0x22);

      expect(dac.getDacC()).toBe(0x22);
    });

    it("should NOT write when neither enable bit is set", () => {
      const { machine, dac } = createMockMachine(true);

      writeDacPort0x4F(machine, 0x22);

      expect(dac.getDacC()).toBe(0x80);
    });
  });

  describe("D3: Port 0x5F enable gating (SD1 OR profi covox)", () => {
    it("should write DAC D when portDacMode1Enabled", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacMode1Enabled = true;

      writeDacPort0x5F(machine, 0x11);

      expect(dac.getDacD()).toBe(0x11);
    });

    it("should write DAC D when portDacStereoProfiCovoxEnabled", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacStereoProfiCovoxEnabled = true;

      writeDacPort0x5F(machine, 0x11);

      expect(dac.getDacD()).toBe(0x11);
    });

    it("should NOT write when neither enable bit is set", () => {
      const { machine, dac } = createMockMachine(true);

      writeDacPort0x5F(machine, 0x11);

      expect(dac.getDacD()).toBe(0x80);
    });
  });

  describe("D3: Port 0xF1 enable gating (SD2 only)", () => {
    it("should write DAC A when portDacMode2Enabled", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacMode2Enabled = true;

      writeDacPort0xF1(machine, 0x66);

      expect(dac.getDacA()).toBe(0x66);
    });

    it("should NOT write when portDacMode2Enabled is false", () => {
      const { machine, dac } = createMockMachine(true);

      writeDacPort0xF1(machine, 0x66);

      expect(dac.getDacA()).toBe(0x80);
    });
  });

  describe("D3: Port 0xF3 enable gating (SD2 only)", () => {
    it("should write DAC B when portDacMode2Enabled", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacMode2Enabled = true;

      writeDacPort0xF3(machine, 0x77);

      expect(dac.getDacB()).toBe(0x77);
    });

    it("should NOT write when portDacMode2Enabled is false", () => {
      const { machine, dac } = createMockMachine(true);

      writeDacPort0xF3(machine, 0x77);

      expect(dac.getDacB()).toBe(0x80);
    });
  });

  describe("D3: Port 0xF9 enable gating (SD2 only)", () => {
    it("should write DAC C when portDacMode2Enabled", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacMode2Enabled = true;

      writeDacPort0xF9(machine, 0x88);

      expect(dac.getDacC()).toBe(0x88);
    });

    it("should NOT write when portDacMode2Enabled is false", () => {
      const { machine, dac } = createMockMachine(true);

      writeDacPort0xF9(machine, 0x88);

      expect(dac.getDacC()).toBe(0x80);
    });
  });

  describe("D3: Port 0xDF enable gating (specdrum, bit 23)", () => {
    it("should write DAC A+D when portDacMonoSpecdrumEnabled", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacMonoSpecdrumEnabled = true;

      writeDacPort0xDF(machine, 0xAA);

      expect(dac.getDacA()).toBe(0xAA);
      expect(dac.getDacD()).toBe(0xAA);
      expect(dac.getDacB()).toBe(0x80); // unchanged
      expect(dac.getDacC()).toBe(0x80); // unchanged
    });

    it("should NOT write when portDacMonoSpecdrumEnabled is false", () => {
      const { machine, dac } = createMockMachine(true);

      writeDacPort0xDF(machine, 0xAA);

      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);
    });
  });

  describe("D3: Port 0xB3 enable gating (gs covox, bit 22)", () => {
    it("should write DAC B+C when portDacMonoGsCovoxEnabled", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacMonoGsCovoxEnabled = true;

      writeDacPort0xB3(machine, 0xBB);

      expect(dac.getDacB()).toBe(0xBB);
      expect(dac.getDacC()).toBe(0xBB);
      expect(dac.getDacA()).toBe(0x80); // unchanged
      expect(dac.getDacD()).toBe(0x80); // unchanged
    });

    it("should NOT write when portDacMonoGsCovoxEnabled is false", () => {
      const { machine, dac } = createMockMachine(true);

      writeDacPort0xB3(machine, 0xBB);

      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
    });
  });

  // ==================== D4: Port 0xFB conditional behavior ====================

  describe("D4: Port 0xFB SoundDrive mode 2 (D only) vs Pentagon (A+D)", () => {
    it("should write D only when portDacMode2Enabled (SD2 takes priority)", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacMode2Enabled = true;
      nextRegDevice.portDacMonoPentagonEnabled = true; // both set

      writeDacPort0xFB(machine, 0x55);

      expect(dac.getDacD()).toBe(0x55); // D written
      expect(dac.getDacA()).toBe(0x80); // A NOT written (SD2 mode = D only)
      expect(dac.getDacB()).toBe(0x80); // unchanged
      expect(dac.getDacC()).toBe(0x80); // unchanged
    });

    it("should write A+D when only portDacMonoPentagonEnabled", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacMonoPentagonEnabled = true;

      writeDacPort0xFB(machine, 0x55);

      expect(dac.getDacA()).toBe(0x55);
      expect(dac.getDacD()).toBe(0x55);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
    });

    it("should write D only when only portDacMode2Enabled", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacMode2Enabled = true;

      writeDacPort0xFB(machine, 0x55);

      expect(dac.getDacD()).toBe(0x55);
      expect(dac.getDacA()).toBe(0x80); // NOT written
    });

    it("should NOT write when neither enable bit is set", () => {
      const { machine, dac } = createMockMachine(true);

      writeDacPort0xFB(machine, 0x55);

      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);
    });

    it("should NOT write when enable8BitDacs is false", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(false);
      nextRegDevice.portDacMode2Enabled = true;
      nextRegDevice.portDacMonoPentagonEnabled = true;

      writeDacPort0xFB(machine, 0x55);

      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);
    });
  });

  // ==================== Combined: All ports with correct enables ====================

  describe("All 11 DAC ports with correct enables (full SoundDrive 1 test)", () => {
    it("should set all 4 channels independently via SD1 ports", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacMode1Enabled = true;

      writeDacPort0x1F(machine, 0x10); // A
      writeDacPort0x0F(machine, 0x20); // B
      writeDacPort0x4F(machine, 0x30); // C
      writeDacPort0x5F(machine, 0x40); // D

      expect(dac.getDacA()).toBe(0x10);
      expect(dac.getDacB()).toBe(0x20);
      expect(dac.getDacC()).toBe(0x30);
      expect(dac.getDacD()).toBe(0x40);
    });

    it("should set all 4 channels independently via SD2 ports", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacMode2Enabled = true;

      writeDacPort0xF1(machine, 0x10); // A
      writeDacPort0xF3(machine, 0x20); // B
      writeDacPort0xF9(machine, 0x30); // C
      writeDacPort0xFB(machine, 0x40); // D (SD2 = D only)

      expect(dac.getDacA()).toBe(0x10);
      expect(dac.getDacB()).toBe(0x20);
      expect(dac.getDacC()).toBe(0x30);
      expect(dac.getDacD()).toBe(0x40);
    });

    it("SD1 ports should not work when only SD2 is enabled", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacMode2Enabled = true;
      // portDacMode1Enabled is false

      writeDacPort0x1F(machine, 0x55);
      writeDacPort0x0F(machine, 0x55);
      writeDacPort0x4F(machine, 0x55);
      writeDacPort0x5F(machine, 0x55);

      expect(dac.getDacA()).toBe(0x80); // unchanged
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);
    });

    it("SD2 ports should not work when only SD1 is enabled", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacMode1Enabled = true;
      // portDacMode2Enabled is false

      writeDacPort0xF1(machine, 0x55);
      writeDacPort0xF3(machine, 0x55);
      writeDacPort0xF9(machine, 0x55);

      expect(dac.getDacA()).toBe(0x80); // unchanged
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
    });
  });

  // ==================== Dynamic enable toggling ====================

  describe("Dynamic per-port enable toggling", () => {
    it("should respond to enable bit changes", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);

      // Initially disabled
      writeDacPort0x1F(machine, 0x55);
      expect(dac.getDacA()).toBe(0x80); // unchanged

      // Enable SD1
      nextRegDevice.portDacMode1Enabled = true;
      writeDacPort0x1F(machine, 0x55);
      expect(dac.getDacA()).toBe(0x55); // written

      // Disable SD1
      nextRegDevice.portDacMode1Enabled = false;
      writeDacPort0x1F(machine, 0xFF);
      expect(dac.getDacA()).toBe(0x55); // unchanged from 0x55
    });

    it("0xFB should switch behavior when SD2 enable changes", () => {
      const { machine, dac, nextRegDevice } = createMockMachine(true);
      nextRegDevice.portDacMonoPentagonEnabled = true;

      // Pentagon mode: A+D
      writeDacPort0xFB(machine, 0x30);
      expect(dac.getDacA()).toBe(0x30);
      expect(dac.getDacD()).toBe(0x30);

      // Enable SD2 — takes priority, D only
      nextRegDevice.portDacMode2Enabled = true;
      dac.setDacA(0x80); // reset A
      writeDacPort0xFB(machine, 0x50);
      expect(dac.getDacD()).toBe(0x50);
      expect(dac.getDacA()).toBe(0x80); // NOT written

      // Disable SD2 — back to pentagon mode
      nextRegDevice.portDacMode2Enabled = false;
      writeDacPort0xFB(machine, 0x70);
      expect(dac.getDacA()).toBe(0x70);
      expect(dac.getDacD()).toBe(0x70);
    });
  });
});
