import { describe, it, expect, beforeEach } from "vitest";
import { DacDevice } from "@emu/machines/zxNext/DacDevice";
import { DacPortDevice } from "@emu/machines/zxNext/DacPortDevice";

describe("DacPortDevice Step 6: DAC I/O Ports", () => {
  let dac: DacDevice;
  let portDevice: DacPortDevice;

  beforeEach(() => {
    dac = new DacDevice();
    portDevice = new DacPortDevice(dac);
  });

  // ==================== DAC A Port Tests ====================

  describe("DAC A Ports (0x1F, 0xF1, 0x3F)", () => {
    it("should write to DAC A via port 0x1F", () => {
      portDevice.writePort(0x1f, 0x50);
      expect(dac.getDacA()).toBe(0x50);
    });

    it("should write to DAC A via port 0xF1", () => {
      portDevice.writePort(0xf1, 0x60);
      expect(dac.getDacA()).toBe(0x60);
    });

    it("should write to DAC A via port 0x3F", () => {
      portDevice.writePort(0x3f, 0x70);
      expect(dac.getDacA()).toBe(0x70);
    });

    it("should handle both even and odd port addresses for DAC A (0x1F → 0x1E)", () => {
      portDevice.writePort(0x1f, 0x40);
      portDevice.writePort(0x1e, 0x50);
      // Both should write to the same channel
      expect(dac.getDacA()).toBe(0x50);
    });

    it("should mask values to 8 bits when writing to DAC A", () => {
      portDevice.writePort(0x1f, 0x1ff);
      expect(dac.getDacA()).toBe(0xff);
    });

    it("should only affect DAC A, not other channels", () => {
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]);
      portDevice.writePort(0x1f, 0x30);
      
      expect(dac.getDacA()).toBe(0x30);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);
    });
  });

  // ==================== DAC B Port Tests ====================

  describe("DAC B Ports (0x0F, 0xF3)", () => {
    it("should write to DAC B via port 0x0F", () => {
      portDevice.writePort(0x0f, 0x40);
      expect(dac.getDacB()).toBe(0x40);
    });

    it("should write to DAC B via port 0xF3", () => {
      portDevice.writePort(0xf3, 0x55);
      expect(dac.getDacB()).toBe(0x55);
    });

    it("should handle both even and odd addresses for DAC B (0x0F → 0x0E)", () => {
      portDevice.writePort(0x0f, 0x30);
      portDevice.writePort(0x0e, 0x40);
      expect(dac.getDacB()).toBe(0x40);
    });

    it("should only affect DAC B, not other channels", () => {
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]);
      portDevice.writePort(0x0f, 0x25);
      
      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x25);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);
    });
  });

  // ==================== DAC C Port Tests ====================

  describe("DAC C Ports (0x4F, 0xF9)", () => {
    it("should write to DAC C via port 0x4F", () => {
      portDevice.writePort(0x4f, 0x75);
      expect(dac.getDacC()).toBe(0x75);
    });

    it("should write to DAC C via port 0xF9", () => {
      portDevice.writePort(0xf9, 0x85);
      expect(dac.getDacC()).toBe(0x85);
    });

    it("should only affect DAC C, not other channels", () => {
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]);
      portDevice.writePort(0x4f, 0x35);
      
      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x35);
      expect(dac.getDacD()).toBe(0x80);
    });
  });

  // ==================== DAC D Port Tests ====================

  describe("DAC D Port (0x5F)", () => {
    it("should write to DAC D via port 0x5F", () => {
      portDevice.writePort(0x5f, 0x90);
      expect(dac.getDacD()).toBe(0x90);
    });

    it("should handle both even and odd addresses for DAC D (0x5F → 0x5E)", () => {
      portDevice.writePort(0x5f, 0x20);
      portDevice.writePort(0x5e, 0x30);
      expect(dac.getDacD()).toBe(0x30);
    });

    it("should only affect DAC D, not other channels", () => {
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]);
      portDevice.writePort(0x5f, 0x45);
      
      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x45);
    });
  });

  // ==================== Combined DAC Ports Tests ====================

  describe("Combined DAC Ports", () => {
    it("should write to both DAC A and D via port 0xDF", () => {
      portDevice.writePort(0xdf, 0xaa);
      expect(dac.getDacA()).toBe(0xaa);
      expect(dac.getDacD()).toBe(0xaa);
    });

    it("should write to both DAC A and D via port 0xFB", () => {
      portDevice.writePort(0xfb, 0x55);
      expect(dac.getDacA()).toBe(0x55);
      expect(dac.getDacD()).toBe(0x55);
    });

    it("should not affect other channels when writing to DAC A+D", () => {
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]);
      portDevice.writePort(0xdf, 0x11);
      
      expect(dac.getDacA()).toBe(0x11);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x11);
    });

    it("should write to both DAC B and C via port 0xB3", () => {
      portDevice.writePort(0xb3, 0x77);
      expect(dac.getDacB()).toBe(0x77);
      expect(dac.getDacC()).toBe(0x77);
    });

    it("should handle both even and odd addresses for DAC B+C (0xB3 → 0xB2)", () => {
      portDevice.writePort(0xb3, 0x33);
      portDevice.writePort(0xb2, 0x44);
      expect(dac.getDacB()).toBe(0x44);
      expect(dac.getDacC()).toBe(0x44);
    });

    it("should not affect other channels when writing to DAC B+C", () => {
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]);
      portDevice.writePort(0xb3, 0x22);
      
      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x22);
      expect(dac.getDacC()).toBe(0x22);
      expect(dac.getDacD()).toBe(0x80);
    });
  });

  // ==================== Port Address Normalization Tests ====================

  describe("Port Address Normalization", () => {
    it("should treat odd and even addresses as the same (bit 0 masked)", () => {
      portDevice.writePort(0x1f, 0x10); // Odd
      expect(dac.getDacA()).toBe(0x10);
      dac.reset();
      
      portDevice.writePort(0x1e, 0x10); // Even
      expect(dac.getDacA()).toBe(0x10);
    });

    it("should normalize all DAC A port variants", () => {
      const dacAPorts = [0x1f, 0x1e, 0xf1, 0xf0, 0x3f, 0x3e];
      
      dacAPorts.forEach((port, idx) => {
        dac.reset();
        portDevice.writePort(port, 0x50 + idx);
        expect(dac.getDacA()).toBe((0x50 + idx) & 0xff);
      });
    });

    it("should normalize all DAC B port variants", () => {
      const dacBPorts = [0x0f, 0x0e, 0xf3, 0xf2];
      
      dacBPorts.forEach((port, idx) => {
        dac.reset();
        portDevice.writePort(port, 0x60 + idx);
        expect(dac.getDacB()).toBe((0x60 + idx) & 0xff);
      });
    });
  });

  // ==================== Read Port Tests ====================

  describe("Port Read Operations", () => {
    it("should return 0xFF for any port read (write-only ports)", () => {
      expect(portDevice.readPort(0x1f)).toBe(0xff);
      expect(portDevice.readPort(0x0f)).toBe(0xff);
      expect(portDevice.readPort(0x4f)).toBe(0xff);
      expect(portDevice.readPort(0x5f)).toBe(0xff);
      expect(portDevice.readPort(0xdf)).toBe(0xff);
      expect(portDevice.readPort(0xb3)).toBe(0xff);
    });

    it("should return 0xFF even after writing values", () => {
      portDevice.writePort(0x1f, 0x50);
      portDevice.writePort(0x0f, 0x60);
      
      expect(portDevice.readPort(0x1f)).toBe(0xff);
      expect(portDevice.readPort(0x0f)).toBe(0xff);
    });
  });

  // ==================== Reset Tests ====================

  describe("Reset Behavior", () => {
    it("should reset all DAC channels via port device", () => {
      portDevice.writePort(0x1f, 0x10);
      portDevice.writePort(0x0f, 0x20);
      portDevice.writePort(0x4f, 0x30);
      portDevice.writePort(0x5f, 0x40);

      portDevice.reset();

      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);
    });
  });

  // ==================== Multi-Port Sequence Tests ====================

  describe("Multi-Port Write Sequences", () => {
    it("should handle sequential writes to different ports", () => {
      portDevice.writePort(0x1f, 0x11);
      portDevice.writePort(0x0f, 0x22);
      portDevice.writePort(0x4f, 0x33);
      portDevice.writePort(0x5f, 0x44);

      expect(dac.getDacA()).toBe(0x11);
      expect(dac.getDacB()).toBe(0x22);
      expect(dac.getDacC()).toBe(0x33);
      expect(dac.getDacD()).toBe(0x44);
    });

    it("should handle rapid repeated writes to same port", () => {
      for (let i = 0; i < 256; i++) {
        portDevice.writePort(0x1f, i);
        expect(dac.getDacA()).toBe(i & 0xff);
      }
    });

    it("should handle combined port writes followed by individual writes", () => {
      portDevice.writePort(0xdf, 0xaa); // A+D
      portDevice.writePort(0xb3, 0xbb); // B+C

      expect(dac.getDacA()).toBe(0xaa);
      expect(dac.getDacB()).toBe(0xbb);
      expect(dac.getDacC()).toBe(0xbb);
      expect(dac.getDacD()).toBe(0xaa);

      portDevice.writePort(0x1f, 0x55); // Update A only
      expect(dac.getDacA()).toBe(0x55);
      expect(dac.getDacD()).toBe(0xaa); // D unchanged
    });

    it("should support stereo sweep pattern", () => {
      // Sweep left channel (A+B) from quiet to loud
      for (let i = 0; i <= 255; i++) {
        portDevice.writePort(0x1f, i); // DAC A
        portDevice.writePort(0x0f, i); // DAC B
        
        expect(dac.getDacA()).toBe(i & 0xff);
        expect(dac.getDacB()).toBe(i & 0xff);
      }

      // Sweep right channel (C+D) from loud to quiet
      for (let i = 255; i >= 0; i--) {
        portDevice.writePort(0x4f, i); // DAC C
        portDevice.writePort(0x5f, i); // DAC D
        
        expect(dac.getDacC()).toBe(i & 0xff);
        expect(dac.getDacD()).toBe(i & 0xff);
      }
    });
  });

  // ==================== Port Mapping Verification ====================

  describe("Complete Port Mapping Verification", () => {
    it("should verify all DAC A port aliases write to same channel", () => {
      const dacAPorts = [0x1f, 0x1e, 0xf1, 0xf0, 0x3f, 0x3e];
      
      dacAPorts.forEach((port) => {
        dac.reset();
        portDevice.writePort(port, 0x55);
        expect(dac.getDacA()).toBe(0x55);
        expect(dac.getDacB()).toBe(0x80); // Unchanged
      });
    });

    it("should verify all DAC B port aliases write to same channel", () => {
      const dacBPorts = [0x0f, 0x0e, 0xf3, 0xf2];
      
      dacBPorts.forEach((port) => {
        dac.reset();
        portDevice.writePort(port, 0x66);
        expect(dac.getDacB()).toBe(0x66);
        expect(dac.getDacA()).toBe(0x80); // Unchanged
      });
    });

    it("should verify all DAC C port aliases write to same channel", () => {
      const dacCPorts = [0x4f, 0x4e, 0xf9, 0xf8];
      
      dacCPorts.forEach((port) => {
        dac.reset();
        portDevice.writePort(port, 0x77);
        expect(dac.getDacC()).toBe(0x77);
        expect(dac.getDacA()).toBe(0x80); // Unchanged
      });
    });

    it("should verify DAC D port writes correctly", () => {
      const dacDPorts = [0x5f, 0x5e];
      
      dacDPorts.forEach((port) => {
        dac.reset();
        portDevice.writePort(port, 0x88);
        expect(dac.getDacD()).toBe(0x88);
        expect(dac.getDacA()).toBe(0x80); // Unchanged
      });
    });

    it("should verify combined port A+D", () => {
      const adPorts = [0xdf, 0xde, 0xfb, 0xfa];
      
      adPorts.forEach((port) => {
        dac.reset();
        portDevice.writePort(port, 0x99);
        expect(dac.getDacA()).toBe(0x99);
        expect(dac.getDacD()).toBe(0x99);
        expect(dac.getDacB()).toBe(0x80); // Unchanged
        expect(dac.getDacC()).toBe(0x80); // Unchanged
      });
    });

    it("should verify combined port B+C", () => {
      const bcPorts = [0xb3, 0xb2];
      
      bcPorts.forEach((port) => {
        dac.reset();
        portDevice.writePort(port, 0xaa);
        expect(dac.getDacB()).toBe(0xaa);
        expect(dac.getDacC()).toBe(0xaa);
        expect(dac.getDacA()).toBe(0x80); // Unchanged
        expect(dac.getDacD()).toBe(0x80); // Unchanged
      });
    });
  });

  // ==================== Edge Cases ====================

  describe("Edge Cases", () => {
    it("should handle unrecognized ports gracefully (no-op)", () => {
      dac.reset();
      portDevice.writePort(0x00, 0x50);
      portDevice.writePort(0x02, 0x50);
      portDevice.writePort(0xff, 0x50);

      // All channels should remain at 0x80
      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);
    });

    it("should ignore high bits of port address except for normalization", () => {
      portDevice.writePort(0x1f | 0x100, 0x50); // Port with high bits
      expect(dac.getDacA()).toBe(0x50);
    });

    it("should handle boundary values (0x00, 0xFF)", () => {
      portDevice.writePort(0x1f, 0x00);
      expect(dac.getDacA()).toBe(0x00);

      portDevice.writePort(0x1f, 0xff);
      expect(dac.getDacA()).toBe(0xff);
    });
  });
});
