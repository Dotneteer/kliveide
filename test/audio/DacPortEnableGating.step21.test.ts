import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine } from "../zxnext/TestNextMachine";
import type { TestZxNextMachine } from "../zxnext/TestNextMachine";

/**
 * D5: DAC port-enable gating per mode
 * D6: Port 0xFB dual-mode routing (SD2 → D only, Pentagon → A+D)
 * D8: Multi-mode OR for 0x0F/0x4F/0x5F
 *
 * FPGA: Each DAC port only responds when its specific mode-enable bit is set.
 * internal_port_enable bits 17-23 control 7 DAC modes independently.
 */
describe("Step 21: DAC Port Enable Gating (D5/D6/D8)", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    // Enable 8-bit DACs globally (NR 0x08 bit 3)
    machine.soundDevice.enable8BitDacs = true;
    // Disable all DAC modes by default
    machine.nextRegDevice.portDacMode1Enabled = false;
    machine.nextRegDevice.portDacMode2Enabled = false;
    machine.nextRegDevice.portDacStereoProfiCovoxEnabled = false;
    machine.nextRegDevice.portDacStereoCovoxEnabled = false;
    machine.nextRegDevice.portDacMonoPentagonEnabled = false;
    machine.nextRegDevice.portDacMonoGsCovoxEnabled = false;
    machine.nextRegDevice.portDacMonoSpecdrumEnabled = false;
    // Reset DAC channels to 0x80
    machine.audioControlDevice.getDacDevice().reset();
  });

  function getDac() {
    return machine.audioControlDevice.getDacDevice();
  }

  function writePort(port: number, value: number) {
    machine.doWritePort(port, value);
  }

  // ==================== D5: SounDrive Mode 1 (SD1) ====================

  describe("SounDrive Mode 1 (SD1) — ports 0x1F/0x0F/0x4F/0x5F", () => {
    it("should NOT write to port 0x1F (A) when SD1 disabled", () => {
      writePort(0x1f, 0x42);
      expect(getDac().getDacA()).toBe(0x80);
    });

    it("should write to port 0x1F (A) when SD1 enabled", () => {
      machine.nextRegDevice.portDacMode1Enabled = true;
      writePort(0x1f, 0x42);
      expect(getDac().getDacA()).toBe(0x42);
    });

    it("should NOT write to port 0x0F (B) when SD1 and Covox disabled", () => {
      writePort(0x0f, 0x55);
      expect(getDac().getDacB()).toBe(0x80);
    });

    it("should write to port 0x0F (B) when SD1 enabled", () => {
      machine.nextRegDevice.portDacMode1Enabled = true;
      writePort(0x0f, 0x55);
      expect(getDac().getDacB()).toBe(0x55);
    });

    it("should NOT write to port 0x4F (C) when SD1 and Covox disabled", () => {
      writePort(0x4f, 0x66);
      expect(getDac().getDacC()).toBe(0x80);
    });

    it("should write to port 0x4F (C) when SD1 enabled", () => {
      machine.nextRegDevice.portDacMode1Enabled = true;
      writePort(0x4f, 0x66);
      expect(getDac().getDacC()).toBe(0x66);
    });

    it("should NOT write to port 0x5F (D) when SD1 and Profi disabled", () => {
      writePort(0x5f, 0x77);
      expect(getDac().getDacD()).toBe(0x80);
    });

    it("should write to port 0x5F (D) when SD1 enabled", () => {
      machine.nextRegDevice.portDacMode1Enabled = true;
      writePort(0x5f, 0x77);
      expect(getDac().getDacD()).toBe(0x77);
    });
  });

  // ==================== D5: SounDrive Mode 2 (SD2) ====================

  describe("SounDrive Mode 2 (SD2) — ports 0xF1/0xF3/0xF9/0xFB", () => {
    it("should NOT write to port 0xF1 (A) when SD2 disabled", () => {
      writePort(0xf1, 0x30);
      expect(getDac().getDacA()).toBe(0x80);
    });

    it("should write to port 0xF1 (A) when SD2 enabled", () => {
      machine.nextRegDevice.portDacMode2Enabled = true;
      writePort(0xf1, 0x30);
      expect(getDac().getDacA()).toBe(0x30);
    });

    it("should NOT write to port 0xF3 (B) when SD2 disabled", () => {
      writePort(0xf3, 0x31);
      expect(getDac().getDacB()).toBe(0x80);
    });

    it("should write to port 0xF3 (B) when SD2 enabled", () => {
      machine.nextRegDevice.portDacMode2Enabled = true;
      writePort(0xf3, 0x31);
      expect(getDac().getDacB()).toBe(0x31);
    });

    it("should NOT write to port 0xF9 (C) when SD2 disabled", () => {
      writePort(0xf9, 0x32);
      expect(getDac().getDacC()).toBe(0x80);
    });

    it("should write to port 0xF9 (C) when SD2 enabled", () => {
      machine.nextRegDevice.portDacMode2Enabled = true;
      writePort(0xf9, 0x32);
      expect(getDac().getDacC()).toBe(0x32);
    });
  });

  // ==================== D5: Profi Covox (Stereo A+D, 3F/5F) ====================

  describe("Profi Covox — ports 0x3F/0x5F", () => {
    it("should NOT write to port 0x3F when Profi Covox disabled", () => {
      writePort(0x3f, 0x44);
      expect(getDac().getDacA()).toBe(0x80);
      expect(getDac().getDacD()).toBe(0x80);
    });

    it("should write to A+D via port 0x3F when Profi Covox enabled", () => {
      machine.nextRegDevice.portDacStereoProfiCovoxEnabled = true;
      writePort(0x3f, 0x44);
      expect(getDac().getDacA()).toBe(0x44);
      expect(getDac().getDacD()).toBe(0x44);
      // B and C unchanged
      expect(getDac().getDacB()).toBe(0x80);
      expect(getDac().getDacC()).toBe(0x80);
    });

    it("should write to D via port 0x5F when Profi Covox enabled", () => {
      machine.nextRegDevice.portDacStereoProfiCovoxEnabled = true;
      writePort(0x5f, 0x55);
      expect(getDac().getDacD()).toBe(0x55);
    });
  });

  // ==================== D8: Multi-mode OR for 0x0F/0x4F ====================

  describe("Stereo Covox OR — ports 0x0F/0x4F", () => {
    it("should write to port 0x0F (B) when Stereo Covox enabled", () => {
      machine.nextRegDevice.portDacStereoCovoxEnabled = true;
      writePort(0x0f, 0xAA);
      expect(getDac().getDacB()).toBe(0xAA);
    });

    it("should write to port 0x4F (C) when Stereo Covox enabled", () => {
      machine.nextRegDevice.portDacStereoCovoxEnabled = true;
      writePort(0x4f, 0xBB);
      expect(getDac().getDacC()).toBe(0xBB);
    });

    it("should write to port 0x0F (B) when EITHER SD1 OR Covox enabled", () => {
      // Only Covox enabled
      machine.nextRegDevice.portDacStereoCovoxEnabled = true;
      writePort(0x0f, 0x11);
      expect(getDac().getDacB()).toBe(0x11);

      getDac().reset();

      // Only SD1 enabled
      machine.nextRegDevice.portDacStereoCovoxEnabled = false;
      machine.nextRegDevice.portDacMode1Enabled = true;
      writePort(0x0f, 0x22);
      expect(getDac().getDacB()).toBe(0x22);

      getDac().reset();

      // Both enabled
      machine.nextRegDevice.portDacStereoCovoxEnabled = true;
      writePort(0x0f, 0x33);
      expect(getDac().getDacB()).toBe(0x33);
    });

    it("should write to port 0x4F (C) when EITHER SD1 OR Covox enabled", () => {
      machine.nextRegDevice.portDacStereoCovoxEnabled = true;
      writePort(0x4f, 0x11);
      expect(getDac().getDacC()).toBe(0x11);

      getDac().reset();

      machine.nextRegDevice.portDacStereoCovoxEnabled = false;
      machine.nextRegDevice.portDacMode1Enabled = true;
      writePort(0x4f, 0x22);
      expect(getDac().getDacC()).toBe(0x22);
    });
  });

  // ==================== D8: Multi-mode OR for 0x5F ====================

  describe("Multi-mode OR for port 0x5F (SD1 OR Profi Covox)", () => {
    it("should write to D when SD1 enabled (not Profi)", () => {
      machine.nextRegDevice.portDacMode1Enabled = true;
      writePort(0x5f, 0xCC);
      expect(getDac().getDacD()).toBe(0xCC);
    });

    it("should write to D when Profi Covox enabled (not SD1)", () => {
      machine.nextRegDevice.portDacStereoProfiCovoxEnabled = true;
      writePort(0x5f, 0xDD);
      expect(getDac().getDacD()).toBe(0xDD);
    });

    it("should write to D when both SD1 and Profi enabled", () => {
      machine.nextRegDevice.portDacMode1Enabled = true;
      machine.nextRegDevice.portDacStereoProfiCovoxEnabled = true;
      writePort(0x5f, 0xEE);
      expect(getDac().getDacD()).toBe(0xEE);
    });

    it("should NOT write to D when neither SD1 nor Profi enabled", () => {
      writePort(0x5f, 0xFF);
      expect(getDac().getDacD()).toBe(0x80);
    });
  });

  // ==================== D5: SpecDrum (port 0xDF) ====================

  describe("SpecDrum — port 0xDF", () => {
    it("should NOT write via 0xDF when SpecDrum disabled", () => {
      writePort(0xdf, 0x50);
      expect(getDac().getDacA()).toBe(0x80);
      expect(getDac().getDacD()).toBe(0x80);
    });

    it("should write A+D via 0xDF when SpecDrum enabled", () => {
      machine.nextRegDevice.portDacMonoSpecdrumEnabled = true;
      writePort(0xdf, 0x50);
      expect(getDac().getDacA()).toBe(0x50);
      expect(getDac().getDacD()).toBe(0x50);
    });
  });

  // ==================== D5: GS Covox (port 0xB3) ====================

  describe("GS Covox — port 0xB3", () => {
    it("should NOT write via 0xB3 when GS Covox disabled", () => {
      writePort(0xb3, 0x60);
      expect(getDac().getDacB()).toBe(0x80);
      expect(getDac().getDacC()).toBe(0x80);
    });

    it("should write B+C via 0xB3 when GS Covox enabled", () => {
      machine.nextRegDevice.portDacMonoGsCovoxEnabled = true;
      writePort(0xb3, 0x60);
      expect(getDac().getDacB()).toBe(0x60);
      expect(getDac().getDacC()).toBe(0x60);
    });
  });

  // ==================== D6: Port 0xFB dual-mode routing ====================

  describe("Port 0xFB dual-mode routing (D6)", () => {
    it("should NOT write via 0xFB when both SD2 and Pentagon disabled", () => {
      writePort(0xfb, 0x70);
      expect(getDac().getDacA()).toBe(0x80);
      expect(getDac().getDacD()).toBe(0x80);
    });

    it("should write to D only via 0xFB when SD2 enabled", () => {
      machine.nextRegDevice.portDacMode2Enabled = true;
      writePort(0xfb, 0x70);
      expect(getDac().getDacD()).toBe(0x70);
      expect(getDac().getDacA()).toBe(0x80); // A unchanged
    });

    it("should write to A+D via 0xFB when Pentagon enabled (SD2 off)", () => {
      machine.nextRegDevice.portDacMonoPentagonEnabled = true;
      writePort(0xfb, 0x70);
      expect(getDac().getDacA()).toBe(0x70);
      expect(getDac().getDacD()).toBe(0x70);
    });

    it("should prefer SD2 (D only) over Pentagon (A+D) when both enabled", () => {
      machine.nextRegDevice.portDacMode2Enabled = true;
      machine.nextRegDevice.portDacMonoPentagonEnabled = true;
      writePort(0xfb, 0x70);
      // SD2 takes priority: only D written
      expect(getDac().getDacD()).toBe(0x70);
      expect(getDac().getDacA()).toBe(0x80); // A unchanged
    });
  });

  // ==================== D1 interaction: dac_en overrides mode ====================

  describe("Global DAC enable interaction", () => {
    it("should NOT write even with mode enabled if dac_en is off", () => {
      machine.soundDevice.enable8BitDacs = false;
      machine.nextRegDevice.portDacMode1Enabled = true;
      writePort(0x1f, 0x42);
      expect(getDac().getDacA()).toBe(0x80);
    });

    it("should require BOTH dac_en AND mode enable for writes", () => {
      machine.soundDevice.enable8BitDacs = true;
      machine.nextRegDevice.portDacMode1Enabled = true;
      writePort(0x1f, 0x42);
      expect(getDac().getDacA()).toBe(0x42);
    });
  });
});
