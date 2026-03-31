import { describe, it, expect, beforeEach } from "vitest";
import { DacDevice } from "@emu/machines/zxNext/DacDevice";
import { DacNextRegDevice } from "@emu/machines/zxNext/DacNextRegDevice";
import { DacPortDevice } from "@emu/machines/zxNext/DacPortDevice";
import { AudioControlDevice } from "@emu/machines/zxNext/AudioControlDevice";
import {
  writeDacAPort,
  writeDacBPort,
  writeDacCPort,
  writeDacDPort,
  writeDacAandDPort,
  writeDacBandCPort,
  writeDacAllPort
} from "@emu/machines/zxNext/io-ports/DacPortHandler";

// --- Mock machine for port handler tests
function createMockMachine(enable8BitDacs = false): any {
  const dac = new DacDevice();
  const soundDevice = {
    beepOnlyToInternalSpeaker: false,
    psgMode: 0,
    ayStereoMode: false,
    enableInternalSpeaker: true,
    enable8BitDacs,
    enableTurbosound: false,
    ay2Mono: false,
    ay1Mono: false,
    ay0Mono: false,
    silenceHdmiAudio: false,
    reset: () => {},
    machine: undefined as any
  };
  const mockMachine = { soundDevice, baseClockFrequency: 3_500_000 } as any;
  const audioControlDevice = new AudioControlDevice(mockMachine);
  // Inject the DAC device into the AudioControlDevice for testing
  (audioControlDevice as any).dacDevice = dac;
  return {
    soundDevice,
    audioControlDevice,
    dac // convenience reference
  };
}

describe("DAC Discrepancy Fixes", () => {
  // ==================== D1: enable8BitDacs gating ====================

  describe("D1: enable8BitDacs gating on port handlers", () => {
    it("should ignore writeDacAPort when enable8BitDacs is false", () => {
      const { soundDevice, audioControlDevice, dac } = createMockMachine(false);
      const machine = { soundDevice, audioControlDevice } as any;

      writeDacAPort(machine, 0x55);
      expect(dac.getDacA()).toBe(0x80); // unchanged from reset
    });

    it("should accept writeDacAPort when enable8BitDacs is true", () => {
      const { soundDevice, audioControlDevice, dac } = createMockMachine(true);
      const machine = { soundDevice, audioControlDevice } as any;

      writeDacAPort(machine, 0x55);
      expect(dac.getDacA()).toBe(0x55);
    });

    it("should ignore writeDacBPort when enable8BitDacs is false", () => {
      const { soundDevice, audioControlDevice, dac } = createMockMachine(false);
      const machine = { soundDevice, audioControlDevice } as any;

      writeDacBPort(machine, 0x44);
      expect(dac.getDacB()).toBe(0x80);
    });

    it("should accept writeDacBPort when enable8BitDacs is true", () => {
      const { soundDevice, audioControlDevice, dac } = createMockMachine(true);
      const machine = { soundDevice, audioControlDevice } as any;

      writeDacBPort(machine, 0x44);
      expect(dac.getDacB()).toBe(0x44);
    });

    it("should ignore writeDacCPort when enable8BitDacs is false", () => {
      const { soundDevice, audioControlDevice, dac } = createMockMachine(false);
      const machine = { soundDevice, audioControlDevice } as any;

      writeDacCPort(machine, 0x33);
      expect(dac.getDacC()).toBe(0x80);
    });

    it("should accept writeDacCPort when enable8BitDacs is true", () => {
      const { soundDevice, audioControlDevice, dac } = createMockMachine(true);
      const machine = { soundDevice, audioControlDevice } as any;

      writeDacCPort(machine, 0x33);
      expect(dac.getDacC()).toBe(0x33);
    });

    it("should ignore writeDacDPort when enable8BitDacs is false", () => {
      const { soundDevice, audioControlDevice, dac } = createMockMachine(false);
      const machine = { soundDevice, audioControlDevice } as any;

      writeDacDPort(machine, 0x22);
      expect(dac.getDacD()).toBe(0x80);
    });

    it("should accept writeDacDPort when enable8BitDacs is true", () => {
      const { soundDevice, audioControlDevice, dac } = createMockMachine(true);
      const machine = { soundDevice, audioControlDevice } as any;

      writeDacDPort(machine, 0x22);
      expect(dac.getDacD()).toBe(0x22);
    });

    it("should ignore writeDacAandDPort when enable8BitDacs is false", () => {
      const { soundDevice, audioControlDevice, dac } = createMockMachine(false);
      const machine = { soundDevice, audioControlDevice } as any;

      writeDacAandDPort(machine, 0x77);
      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);
    });

    it("should accept writeDacAandDPort when enable8BitDacs is true", () => {
      const { soundDevice, audioControlDevice, dac } = createMockMachine(true);
      const machine = { soundDevice, audioControlDevice } as any;

      writeDacAandDPort(machine, 0x77);
      expect(dac.getDacA()).toBe(0x77);
      expect(dac.getDacD()).toBe(0x77);
    });

    it("should ignore writeDacBandCPort when enable8BitDacs is false", () => {
      const { soundDevice, audioControlDevice, dac } = createMockMachine(false);
      const machine = { soundDevice, audioControlDevice } as any;

      writeDacBandCPort(machine, 0x66);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
    });

    it("should accept writeDacBandCPort when enable8BitDacs is true", () => {
      const { soundDevice, audioControlDevice, dac } = createMockMachine(true);
      const machine = { soundDevice, audioControlDevice } as any;

      writeDacBandCPort(machine, 0x66);
      expect(dac.getDacB()).toBe(0x66);
      expect(dac.getDacC()).toBe(0x66);
    });

    it("should ignore writeDacAllPort when enable8BitDacs is false", () => {
      const { soundDevice, audioControlDevice, dac } = createMockMachine(false);
      const machine = { soundDevice, audioControlDevice } as any;

      writeDacAllPort(machine, 0xAA);
      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);
    });

    it("should accept writeDacAllPort when enable8BitDacs is true", () => {
      const { soundDevice, audioControlDevice, dac } = createMockMachine(true);
      const machine = { soundDevice, audioControlDevice } as any;

      writeDacAllPort(machine, 0xAA);
      expect(dac.getDacA()).toBe(0xAA);
      expect(dac.getDacB()).toBe(0xAA);
      expect(dac.getDacC()).toBe(0xAA);
      expect(dac.getDacD()).toBe(0xAA);
    });

    it("should dynamically respond to enable8BitDacs toggling", () => {
      const { soundDevice, audioControlDevice, dac } = createMockMachine(false);
      const machine = { soundDevice, audioControlDevice } as any;

      // Initially disabled
      writeDacAPort(machine, 0x55);
      expect(dac.getDacA()).toBe(0x80);

      // Enable
      soundDevice.enable8BitDacs = true;
      writeDacAPort(machine, 0x55);
      expect(dac.getDacA()).toBe(0x55);

      // Disable again
      soundDevice.enable8BitDacs = false;
      writeDacAPort(machine, 0xFF);
      expect(dac.getDacA()).toBe(0x55); // still the old value
    });
  });

  // ==================== D3: 0x2C/0x2D swap ====================

  describe("D3: NextReg 0x2C = DAC B (left), 0x2D = DAC A+D (mono)", () => {
    let dac: DacDevice;
    let nextRegDevice: DacNextRegDevice;

    beforeEach(() => {
      dac = new DacDevice();
      nextRegDevice = new DacNextRegDevice(dac);
    });

    it("NextReg 0x2C should write only DAC B", () => {
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]);
      nextRegDevice.writeNextReg(0x2c, 0x42);

      expect(dac.getDacB()).toBe(0x42);
      expect(dac.getDacA()).toBe(0x80); // unchanged
      expect(dac.getDacC()).toBe(0x80); // unchanged
      expect(dac.getDacD()).toBe(0x80); // unchanged
    });

    it("NextReg 0x2C should read 0 (I2S not implemented)", () => {
      dac.setDacB(0x99);
      expect(nextRegDevice.readNextReg(0x2c)).toBe(0);
    });

    it("NextReg 0x2D should write both DAC A and D", () => {
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]);
      nextRegDevice.writeNextReg(0x2d, 0x42);

      expect(dac.getDacA()).toBe(0x42);
      expect(dac.getDacD()).toBe(0x42);
      expect(dac.getDacB()).toBe(0x80); // unchanged
      expect(dac.getDacC()).toBe(0x80); // unchanged
    });

    it("NextReg 0x2D should read 0 (I2S not implemented)", () => {
      dac.setDacA(0xBB);
      expect(nextRegDevice.readNextReg(0x2d)).toBe(0);
    });

    it("NextReg 0x2E should write only DAC C (unchanged)", () => {
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]);
      nextRegDevice.writeNextReg(0x2e, 0x42);

      expect(dac.getDacC()).toBe(0x42);
      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);
    });

    it("NextReg 0x2E should read 0 (I2S not implemented)", () => {
      dac.setDacC(0xCC);
      expect(nextRegDevice.readNextReg(0x2e)).toBe(0);
    });
  });

  // ==================== D4: Port 0x1F SoundDrive mode 1 ====================

  describe("D4: Port 0x1F writes all four DAC channels (SoundDrive mode 1)", () => {
    it("writeDacAllPort should set all four channels", () => {
      const { soundDevice, audioControlDevice, dac } = createMockMachine(true);
      const machine = { soundDevice, audioControlDevice } as any;

      writeDacAllPort(machine, 0x55);
      expect(dac.getDacA()).toBe(0x55);
      expect(dac.getDacB()).toBe(0x55);
      expect(dac.getDacC()).toBe(0x55);
      expect(dac.getDacD()).toBe(0x55);
    });

    it("writeDacAllPort should handle boundary values", () => {
      const { soundDevice, audioControlDevice, dac } = createMockMachine(true);
      const machine = { soundDevice, audioControlDevice } as any;

      writeDacAllPort(machine, 0x00);
      expect(dac.getDacA()).toBe(0x00);
      expect(dac.getDacB()).toBe(0x00);
      expect(dac.getDacC()).toBe(0x00);
      expect(dac.getDacD()).toBe(0x00);

      writeDacAllPort(machine, 0xFF);
      expect(dac.getDacA()).toBe(0xFF);
      expect(dac.getDacB()).toBe(0xFF);
      expect(dac.getDacC()).toBe(0xFF);
      expect(dac.getDacD()).toBe(0xFF);
    });

    it("DacPortDevice 0x1F should write all four channels", () => {
      const dac = new DacDevice();
      const portDevice = new DacPortDevice(dac);

      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]);
      portDevice.writePort(0x1f, 0x42);

      expect(dac.getDacA()).toBe(0x42);
      expect(dac.getDacB()).toBe(0x42);
      expect(dac.getDacC()).toBe(0x42);
      expect(dac.getDacD()).toBe(0x42);
    });

    it("subsequent individual port writes should override specific channels", () => {
      const { soundDevice, audioControlDevice, dac } = createMockMachine(true);
      const machine = { soundDevice, audioControlDevice } as any;

      writeDacAllPort(machine, 0x80);
      writeDacBPort(machine, 0x30);

      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x30);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);
    });
  });

  // ==================== D5: Port 0x3F writes A+D ====================

  describe("D5: Port 0x3F writes DAC A+D (profi covox stereo)", () => {
    it("writeDacAandDPort should set A and D but not B and C", () => {
      const { soundDevice, audioControlDevice, dac } = createMockMachine(true);
      const machine = { soundDevice, audioControlDevice } as any;

      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]);
      writeDacAandDPort(machine, 0x55);

      expect(dac.getDacA()).toBe(0x55);
      expect(dac.getDacB()).toBe(0x80); // unchanged
      expect(dac.getDacC()).toBe(0x80); // unchanged
      expect(dac.getDacD()).toBe(0x55);
    });

    it("DacPortDevice 0x3F should write A+D", () => {
      const dac = new DacDevice();
      const portDevice = new DacPortDevice(dac);

      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]);
      portDevice.writePort(0x3f, 0x42);

      expect(dac.getDacA()).toBe(0x42);
      expect(dac.getDacB()).toBe(0x80); // unchanged
      expect(dac.getDacC()).toBe(0x80); // unchanged
      expect(dac.getDacD()).toBe(0x42);
    });

    it("DacPortDevice 0xF1 should write only A (not D)", () => {
      const dac = new DacDevice();
      const portDevice = new DacPortDevice(dac);

      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]);
      portDevice.writePort(0xf1, 0x42);

      expect(dac.getDacA()).toBe(0x42);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80); // not changed
    });
  });

  // ==================== D2: NextReg 0x2C/0x2D/0x2E functional ====================

  describe("D2: NextReg 0x2C/0x2D/0x2E are functional (not no-ops)", () => {
    let dac: DacDevice;
    let nextRegDevice: DacNextRegDevice;

    beforeEach(() => {
      dac = new DacDevice();
      nextRegDevice = new DacNextRegDevice(dac);
    });

    it("all three NextRegs should return true on write (handled)", () => {
      expect(nextRegDevice.writeNextReg(0x2c, 0x50)).toBe(true);
      expect(nextRegDevice.writeNextReg(0x2d, 0x50)).toBe(true);
      expect(nextRegDevice.writeNextReg(0x2e, 0x50)).toBe(true);
    });

    it("all three NextRegs should return defined values on read", () => {
      nextRegDevice.writeNextReg(0x2c, 0x10);
      nextRegDevice.writeNextReg(0x2d, 0x20);
      nextRegDevice.writeNextReg(0x2e, 0x30);

      expect(nextRegDevice.readNextReg(0x2c)).toBeDefined();
      expect(nextRegDevice.readNextReg(0x2d)).toBeDefined();
      expect(nextRegDevice.readNextReg(0x2e)).toBeDefined();
    });

    it("write should actually change underlying DAC values", () => {
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]);

      nextRegDevice.writeNextReg(0x2c, 0x10); // B
      nextRegDevice.writeNextReg(0x2d, 0x20); // A+D
      nextRegDevice.writeNextReg(0x2e, 0x30); // C

      expect(dac.getDacA()).toBe(0x20);
      expect(dac.getDacB()).toBe(0x10);
      expect(dac.getDacC()).toBe(0x30);
      expect(dac.getDacD()).toBe(0x20);
    });

    it("read should return 0 regardless of DAC values (I2S not implemented)", () => {
      dac.setDacB(0x11);
      dac.setDacA(0x22);
      dac.setDacC(0x33);

      expect(nextRegDevice.readNextReg(0x2c)).toBe(0);
      expect(nextRegDevice.readNextReg(0x2d)).toBe(0);
      expect(nextRegDevice.readNextReg(0x2e)).toBe(0);
    });
  });

  // ==================== Combined: Port + NextReg interaction ====================

  describe("Port and NextReg DAC interaction", () => {
    it("port writes should NOT be visible through NextReg reads (returns 0, I2S)", () => {
      const dac = new DacDevice();
      const nextRegDevice = new DacNextRegDevice(dac);
      const portDevice = new DacPortDevice(dac);

      portDevice.writePort(0x0f, 0x50); // DAC B via port
      expect(nextRegDevice.readNextReg(0x2c)).toBe(0); // reads return 0, not B

      portDevice.writePort(0xf1, 0x60); // DAC A via port
      expect(nextRegDevice.readNextReg(0x2d)).toBe(0); // reads return 0, not A

      portDevice.writePort(0x4f, 0x70); // DAC C via port
      expect(nextRegDevice.readNextReg(0x2e)).toBe(0); // reads return 0, not C
    });

    it("NextReg writes should be visible through direct DAC reads after port writes", () => {
      const dac = new DacDevice();
      const nextRegDevice = new DacNextRegDevice(dac);
      const portDevice = new DacPortDevice(dac);

      // Set all channels via port 0x1F (all channels)
      portDevice.writePort(0x1f, 0x80);

      // Override B via NextReg 0x2C
      nextRegDevice.writeNextReg(0x2c, 0x30);

      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x30);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);
    });
  });
});
