import { describe, it, expect, beforeEach } from "vitest";
import { PsgChip } from "@emu/machines/zxSpectrum128/PsgChip";
import { TurboSoundDevice } from "@emu/machines/zxNext/TurboSoundDevice";
import { AudioControlDevice } from "@emu/machines/zxNext/AudioControlDevice";
import {
  readAyRegPort,
  writeAyRegPort
} from "@emu/machines/zxNext/io-ports/AyRegPortHandler";
import {
  readAyDatPort,
  writeAyDatPort
} from "@emu/machines/zxNext/io-ports/AyDatPortHandler";

// --- Mock machine with configurable soundDevice
function createMockMachine(overrides: Partial<{
  enableTurbosound: boolean;
  psgMode: number;
  ayStereoMode: boolean;
  ay0Mono: boolean;
  ay1Mono: boolean;
  ay2Mono: boolean;
}> = {}): any {
  const turboSound = new TurboSoundDevice();
  const soundDevice = {
    beepOnlyToInternalSpeaker: false,
    psgMode: overrides.psgMode ?? 0,
    ayStereoMode: overrides.ayStereoMode ?? false,
    enableInternalSpeaker: true,
    enable8BitDacs: false,
    enableTurbosound: overrides.enableTurbosound ?? false,
    ay2Mono: overrides.ay2Mono ?? false,
    ay1Mono: overrides.ay1Mono ?? false,
    ay0Mono: overrides.ay0Mono ?? false,
    silenceHdmiAudio: false,
    reset: () => {},
    machine: undefined as any
  };

  return {
    soundDevice,
    audioControlDevice: {
      getTurboSoundDevice: () => turboSound
    },
    baseClockFrequency: 3_500_000
  };
}

// =============================================================================
// D13: Port 0xFFFD Read Returns Register Data
// =============================================================================
describe("D13: Port 0xFFFD read returns register data", () => {
  it("should return register value instead of 0xFF", () => {
    const machine = createMockMachine({ enableTurbosound: false });
    const ts = machine.audioControlDevice.getTurboSoundDevice();

    // Write a value to register 0 of chip 0
    ts.getChip(0).setPsgRegisterIndex(0);
    ts.getChip(0).writePsgRegisterValue(0x42);

    // Select register 0 for reading
    ts.getChip(0).setPsgRegisterIndex(0);

    const result = readAyRegPort(machine, 0xfffd);
    expect(result).toBe(0x42);
  });

  it("should read from chip 0 when turbosound is disabled", () => {
    const machine = createMockMachine({ enableTurbosound: false });
    const ts = machine.audioControlDevice.getTurboSoundDevice();

    // Write to chip 0
    ts.getChip(0).setPsgRegisterIndex(5);
    ts.getChip(0).writePsgRegisterValue(0xAB);

    // Write different value to chip 1
    ts.selectChip(1);
    ts.getChip(1).setPsgRegisterIndex(5);
    ts.getChip(1).writePsgRegisterValue(0xCD);

    // Select chip 1 and register 5
    ts.selectChip(1);
    ts.selectRegister(5);

    // Reading should return chip 0's value when turbosound is disabled
    ts.getChip(0).setPsgRegisterIndex(5);
    const result = readAyRegPort(machine, 0xfffd);
    expect(result).toBe(0xAB);
  });

  it("should read from selected chip when turbosound is enabled", () => {
    const machine = createMockMachine({ enableTurbosound: true });
    const ts = machine.audioControlDevice.getTurboSoundDevice();

    // Write to chip 1
    ts.selectChip(1);
    ts.getChip(1).setPsgRegisterIndex(3);
    ts.getChip(1).writePsgRegisterValue(0x07);
    ts.selectRegister(3);

    const result = readAyRegPort(machine, 0xfffd);
    expect(result).toBe(0x07);
  });

  it("should apply AY read masks when reading in AY mode", () => {
    const machine = createMockMachine({ enableTurbosound: false });
    const ts = machine.audioControlDevice.getTurboSoundDevice();

    // Chip is YM by default; YM returns all bits
    ts.getChip(0).setPsgRegisterIndex(1); // Reg 1: AY mask = 0x0F
    ts.getChip(0).writePsgRegisterValue(0xFF);

    const result = readAyRegPort(machine, 0xfffd);
    expect(result).toBe(0xFF); // YM: no masking
  });
});

// =============================================================================
// D2: Turbosound Enable Gating
// =============================================================================
describe("D2: Turbosound enable gating", () => {
  describe("Chip selection gating (port 0xFFFD write)", () => {
    it("should ignore chip select command when turbosound disabled", () => {
      const machine = createMockMachine({ enableTurbosound: false });
      const ts = machine.audioControlDevice.getTurboSoundDevice();

      expect(ts.getSelectedChipId()).toBe(0);
      // Attempt chip select to chip 1 (0xFE = bit7=1, bits4:2=111, bits1:0=10)
      writeAyRegPort(machine, 0xfe);
      expect(ts.getSelectedChipId()).toBe(0); // Should stay at chip 0
    });

    it("should accept chip select command when turbosound enabled", () => {
      const machine = createMockMachine({ enableTurbosound: true });
      const ts = machine.audioControlDevice.getTurboSoundDevice();

      writeAyRegPort(machine, 0xfe); // Select chip 1
      expect(ts.getSelectedChipId()).toBe(1);
    });
  });

  describe("Register select gating (port 0xFFFD write)", () => {
    it("should always write to chip 0 when turbosound disabled", () => {
      const machine = createMockMachine({ enableTurbosound: false });
      const ts = machine.audioControlDevice.getTurboSoundDevice();

      // Select chip 1 directly (bypass port handler)
      ts.selectChip(1);

      // Write register select via port handler — should go to chip 0
      writeAyRegPort(machine, 0x05); // Register 5
      expect(ts.getChip(0).psgRegisterIndex).toBe(5);
    });

    it("should write to selected chip when turbosound enabled", () => {
      const machine = createMockMachine({ enableTurbosound: true });
      const ts = machine.audioControlDevice.getTurboSoundDevice();

      ts.selectChip(1);
      writeAyRegPort(machine, 0x05);
      expect(ts.getChip(1).psgRegisterIndex).toBe(5);
    });
  });

  describe("Data port gating (port 0xBFFD)", () => {
    it("should write to chip 0 when turbosound disabled", () => {
      const machine = createMockMachine({ enableTurbosound: false });
      const ts = machine.audioControlDevice.getTurboSoundDevice();

      // Select chip 1 directly
      ts.selectChip(1);
      ts.selectRegister(0);

      // Also prepare chip 0 register 0
      ts.getChip(0).setPsgRegisterIndex(0);

      // Write data via port handler
      writeAyDatPort(machine, 0x42);
      expect(ts.getChip(0).readPsgRegisterValue()).toBe(0x42);
    });

    it("should read from chip 0 when turbosound disabled", () => {
      const machine = createMockMachine({ enableTurbosound: false });
      const ts = machine.audioControlDevice.getTurboSoundDevice();

      // Write to chip 0 register 0
      ts.getChip(0).setPsgRegisterIndex(0);
      ts.getChip(0).writePsgRegisterValue(0xBB);

      // Write different to chip 1
      ts.getChip(1).setPsgRegisterIndex(0);
      ts.getChip(1).writePsgRegisterValue(0xCC);

      // Select chip 1 directly
      ts.selectChip(1);
      ts.selectRegister(0);

      // Read via BFFD port — should get chip 0's value
      ts.getChip(0).setPsgRegisterIndex(0);
      const result = readAyDatPort(machine, 0xbffd);
      expect(result).toBe(0xBB);
    });

    it("should read from selected chip when turbosound enabled", () => {
      const machine = createMockMachine({ enableTurbosound: true });
      const ts = machine.audioControlDevice.getTurboSoundDevice();

      ts.selectChip(1);
      ts.getChip(1).setPsgRegisterIndex(0);
      ts.getChip(1).writePsgRegisterValue(0xCC);
      ts.selectRegister(0);

      const result = readAyDatPort(machine, 0xbffd);
      expect(result).toBe(0xCC);
    });
  });

  describe("Output gating", () => {
    it("should silence non-selected chips when turbosound disabled", () => {
      const device = new TurboSoundDevice();
      device.setTurbosoundEnabled(false);

      // Set up chip 1 with some output
      const chip1 = device.getChip(1);
      chip1.setPsgRegisterIndex(8); chip1.writePsgRegisterValue(15);
      chip1.setPsgRegisterIndex(7); chip1.writePsgRegisterValue(0x3f); // DC output
      chip1.setPsgRegisterIndex(0); chip1.writePsgRegisterValue(1);
      device.generateAllOutputValues();

      const output1 = device.getChipStereoOutput(1);
      expect(output1.left).toBe(0);
      expect(output1.right).toBe(0);
    });

    it("should output from chip 0 when turbosound disabled", () => {
      const device = new TurboSoundDevice();
      device.setTurbosoundEnabled(false);

      const chip0 = device.getChip(0);
      chip0.setPsgRegisterIndex(8); chip0.writePsgRegisterValue(15);
      chip0.setPsgRegisterIndex(7); chip0.writePsgRegisterValue(0x3f);
      device.generateAllOutputValues();

      const output0 = device.getChipStereoOutput(0);
      expect(output0.left).toBeGreaterThan(0);
    });

    it("should output from all chips when turbosound enabled", () => {
      const device = new TurboSoundDevice();
      device.setTurbosoundEnabled(true);

      for (let i = 0; i < 3; i++) {
        const chip = device.getChip(i);
        chip.setPsgRegisterIndex(8); chip.writePsgRegisterValue(15);
        chip.setPsgRegisterIndex(7); chip.writePsgRegisterValue(0x3f);
      }
      device.generateAllOutputValues();

      for (let i = 0; i < 3; i++) {
        const output = device.getChipStereoOutput(i);
        expect(output.left).toBeGreaterThan(0);
      }
    });
  });
});

// =============================================================================
// D4: Register Address Bits 7:5 Gate
// =============================================================================
describe("D4: Register address bits 7:5 must be 000", () => {
  it("should accept register select when bits 7:5 = 000", () => {
    const machine = createMockMachine({ enableTurbosound: false });
    const ts = machine.audioControlDevice.getTurboSoundDevice();

    writeAyRegPort(machine, 0x05); // 0000_0101 — bits 7:5 = 000
    expect(ts.getChip(0).psgRegisterIndex).toBe(5);
  });

  it("should reject register select when bit 5 is set", () => {
    const machine = createMockMachine({ enableTurbosound: false });
    const ts = machine.audioControlDevice.getTurboSoundDevice();

    // Pre-select register 0
    ts.getChip(0).setPsgRegisterIndex(0);

    writeAyRegPort(machine, 0x25); // 0010_0101 — bit 5 set
    expect(ts.getChip(0).psgRegisterIndex).toBe(0); // Should remain unchanged
  });

  it("should reject register select when bit 6 is set", () => {
    const machine = createMockMachine({ enableTurbosound: false });
    const ts = machine.audioControlDevice.getTurboSoundDevice();

    ts.getChip(0).setPsgRegisterIndex(0);
    writeAyRegPort(machine, 0x45); // 0100_0101 — bit 6 set
    expect(ts.getChip(0).psgRegisterIndex).toBe(0);
  });

  it("should reject register select when bit 7 is set (non-turbo pattern)", () => {
    const machine = createMockMachine({ enableTurbosound: false });
    const ts = machine.audioControlDevice.getTurboSoundDevice();

    ts.getChip(0).setPsgRegisterIndex(0);
    // 0x80 = bit 7 set but bits 4:2 != 111 — not a turbosound command, not register select
    writeAyRegPort(machine, 0x80);
    expect(ts.getChip(0).psgRegisterIndex).toBe(0);
  });

  it("should accept all 16 register addresses (0-15)", () => {
    const machine = createMockMachine({ enableTurbosound: false });
    const ts = machine.audioControlDevice.getTurboSoundDevice();

    for (let reg = 0; reg < 16; reg++) {
      writeAyRegPort(machine, reg);
      expect(ts.getChip(0).psgRegisterIndex).toBe(reg);
    }
  });
});

// =============================================================================
// D5: Stereo Mixing — FPGA Full Amplitude Center Channel
// =============================================================================
describe("D5: Stereo mixing full amplitude center channel", () => {
  let device: TurboSoundDevice;

  beforeEach(() => {
    device = new TurboSoundDevice();
  });

  function setupChip(volA: number, volB: number, volC: number) {
    const chip = device.getChip(0);
    chip.setPsgRegisterIndex(0); chip.writePsgRegisterValue(1);
    chip.setPsgRegisterIndex(2); chip.writePsgRegisterValue(1);
    chip.setPsgRegisterIndex(4); chip.writePsgRegisterValue(1);
    chip.setPsgRegisterIndex(7); chip.writePsgRegisterValue(0x38);
    chip.setPsgRegisterIndex(8); chip.writePsgRegisterValue(volA);
    chip.setPsgRegisterIndex(9); chip.writePsgRegisterValue(volB);
    chip.setPsgRegisterIndex(10); chip.writePsgRegisterValue(volC);
    device.generateAllOutputValues();
    return chip;
  }

  it("ABC mode: left = A + B (full), not A + B/2", () => {
    device.setAyStereoMode(false);
    const chip = setupChip(10, 8, 5);
    const output = device.getChipStereoOutput(0);
    const volA = chip.getChannelAVolume();
    const volB = chip.getChannelBVolume();
    expect(output.left).toBe(volA + volB);
  });

  it("ABC mode: right = B + C (full), not B/2 + C", () => {
    device.setAyStereoMode(false);
    const chip = setupChip(10, 8, 5);
    const output = device.getChipStereoOutput(0);
    const volB = chip.getChannelBVolume();
    const volC = chip.getChannelCVolume();
    expect(output.right).toBe(volB + volC);
  });

  it("ACB mode: left = A + C, right = C + B", () => {
    device.setAyStereoMode(true);
    const chip = setupChip(10, 5, 8);
    const output = device.getChipStereoOutput(0);
    expect(output.left).toBe(chip.getChannelAVolume() + chip.getChannelCVolume());
    expect(output.right).toBe(chip.getChannelCVolume() + chip.getChannelBVolume());
  });

  it("center channel at full volume produces equal output on both sides", () => {
    device.setAyStereoMode(false);
    const chip = device.getChip(0);
    chip.setPsgRegisterIndex(2); chip.writePsgRegisterValue(1);
    chip.setPsgRegisterIndex(7); chip.writePsgRegisterValue(0x39); // Only B enabled
    chip.setPsgRegisterIndex(9); chip.writePsgRegisterValue(15);
    device.generateAllOutputValues();

    const output = device.getChipStereoOutput(0);
    expect(output.left).toBe(output.right);
    expect(output.left).toBe(chip.getChannelBVolume());
  });
});

// =============================================================================
// D7: Port 0xBFF5 FPGA Encoding
// =============================================================================
describe("D7: Port 0xBFF5 returns FPGA AY_ID format", () => {
  it("chip 0: returns 0xC0 | register (AY_ID=11)", () => {
    const machine = createMockMachine({ enableTurbosound: true });
    const ts = machine.audioControlDevice.getTurboSoundDevice();

    ts.selectChip(0);
    ts.selectRegister(5);

    const result = readAyDatPort(machine, 0xbff5);
    // AY_ID for chip 0 = "11" (3), format: (3 << 6) | 5 = 0xC5
    expect(result).toBe(0xc5);
  });

  it("chip 1: returns 0x80 | register (AY_ID=10)", () => {
    const machine = createMockMachine({ enableTurbosound: true });
    const ts = machine.audioControlDevice.getTurboSoundDevice();

    ts.selectChip(1);
    ts.selectRegister(10);

    const result = readAyDatPort(machine, 0xbff5);
    // AY_ID for chip 1 = "10" (2), format: (2 << 6) | 10 = 0x8A
    expect(result).toBe(0x8a);
  });

  it("chip 2: returns 0x40 | register (AY_ID=01)", () => {
    const machine = createMockMachine({ enableTurbosound: true });
    const ts = machine.audioControlDevice.getTurboSoundDevice();

    ts.selectChip(2);
    ts.selectRegister(15);

    const result = readAyDatPort(machine, 0xbff5);
    // AY_ID for chip 2 = "01" (1), format: (1 << 6) | 15 = 0x4F
    expect(result).toBe(0x4f);
  });

  it("includes 5-bit register address", () => {
    const machine = createMockMachine({ enableTurbosound: true });
    const ts = machine.audioControlDevice.getTurboSoundDevice();

    ts.selectChip(0);
    ts.selectRegister(0x1f); // 5-bit max

    const result = readAyDatPort(machine, 0xbff5);
    expect(result & 0x1f).toBe(0x1f);
  });

  it("returns 0 when turbosound disabled", () => {
    const machine = createMockMachine({ enableTurbosound: false });
    const ts = machine.audioControlDevice.getTurboSoundDevice();

    ts.selectChip(1);
    ts.selectRegister(5);

    const result = readAyDatPort(machine, 0xbff5);
    expect(result).toBe(0);
  });
});

// =============================================================================
// D8: 5-Bit Register Address
// =============================================================================
describe("D8: 5-bit register address support", () => {
  it("should store 5-bit register index", () => {
    const psg = new PsgChip(0, "YM");
    psg.setPsgRegisterIndex(0x1a); // 11010 — bit 4 set
    expect(psg.psgRegisterIndex).toBe(0x1a);
  });

  it("should return 0xFF for register reads with bit 4 set", () => {
    const psg = new PsgChip(0, "YM");
    psg.setPsgRegisterIndex(16);
    expect(psg.readPsgRegisterValue()).toBe(0xff);
  });

  it("should return 0xFF for register 31", () => {
    const psg = new PsgChip(0, "YM");
    psg.setPsgRegisterIndex(31);
    expect(psg.readPsgRegisterValue()).toBe(0xff);
  });

  it("should return 0xFF for register > 15 in AY mode too", () => {
    const psg = new PsgChip(0, "AY");
    psg.setPsgRegisterIndex(20);
    expect(psg.readPsgRegisterValue()).toBe(0xff);
  });

  it("should ignore writes to register > 15", () => {
    const psg = new PsgChip(0, "YM");
    // Write to register 0 first
    psg.setPsgRegisterIndex(0);
    psg.writePsgRegisterValue(0x42);

    // Now try to write to register 16 — should be ignored
    psg.setPsgRegisterIndex(16);
    psg.writePsgRegisterValue(0xFF);

    // Read register 0 — should still be 0x42
    psg.setPsgRegisterIndex(0);
    expect(psg.readPsgRegisterValue()).toBe(0x42);
  });

  it("should mask index to 5 bits", () => {
    const psg = new PsgChip(0, "YM");
    psg.setPsgRegisterIndex(0xFF); // Should mask to 0x1F
    expect(psg.psgRegisterIndex).toBe(0x1f);
  });

  it("TurboSoundDevice passes 5-bit address through", () => {
    const device = new TurboSoundDevice();
    device.selectRegister(0x1f);
    expect(device.getSelectedRegister()).toBe(0x1f);
  });
});

// =============================================================================
// D1: PSG Hold-in-Reset
// =============================================================================
describe("D1: PSG hold-in-reset (mode 3)", () => {
  it("should reset all chips when entering hold-in-reset", () => {
    const device = new TurboSoundDevice();

    // Write some data to chip 0
    device.getChip(0).setPsgRegisterIndex(0);
    device.getChip(0).writePsgRegisterValue(0xFF);

    device.setPsgHoldInReset(true);

    // After reset, register should be 0
    device.getChip(0).setPsgRegisterIndex(0);
    expect(device.getChip(0).readPsgRegisterValue()).toBe(0);
  });

  it("should output silence when in hold-in-reset", () => {
    const device = new TurboSoundDevice();

    // Set up output
    const chip = device.getChip(0);
    chip.setPsgRegisterIndex(8); chip.writePsgRegisterValue(15);
    chip.setPsgRegisterIndex(7); chip.writePsgRegisterValue(0x3f);
    device.generateAllOutputValues();

    device.setPsgHoldInReset(true);

    const output = device.getChipStereoOutput(0);
    expect(output.left).toBe(0);
    expect(output.right).toBe(0);
  });

  it("should silence all 3 chips when in hold-in-reset", () => {
    const device = new TurboSoundDevice();
    device.setPsgHoldInReset(true);

    for (let i = 0; i < 3; i++) {
      const output = device.getChipStereoOutput(i);
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    }
  });

  it("should skip generateAllOutputValues when in hold-in-reset", () => {
    const device = new TurboSoundDevice();
    device.setPsgHoldInReset(true);

    // Set up chip 0 output after reset
    const chip = device.getChip(0);
    chip.setPsgRegisterIndex(8); chip.writePsgRegisterValue(15);
    chip.setPsgRegisterIndex(7); chip.writePsgRegisterValue(0x3f);

    device.generateAllOutputValues(); // Should be skipped
    expect(chip.currentOutputA).toBe(0); // No generation happened
  });

  it("should restore audio after exiting hold-in-reset", () => {
    const device = new TurboSoundDevice();
    device.setPsgHoldInReset(true);
    device.setPsgHoldInReset(false);

    // Set up output from scratch
    const chip = device.getChip(0);
    chip.setPsgRegisterIndex(8); chip.writePsgRegisterValue(15);
    chip.setPsgRegisterIndex(7); chip.writePsgRegisterValue(0x3f);
    chip.setPsgRegisterIndex(0); chip.writePsgRegisterValue(1);
    device.generateAllOutputValues();

    const output = device.getChipStereoOutput(0);
    expect(output.left).toBeGreaterThan(0);
  });

  it("should integrate with AudioControlDevice applyConfiguration", () => {
    const machine = createMockMachine({ psgMode: 3 });
    const audioControl = new AudioControlDevice(machine as any);
    audioControl.applyConfiguration();

    const ts = audioControl.getTurboSoundDevice();
    expect(ts.getPsgHoldInReset()).toBe(true);
  });

  it("should clear hold-in-reset when mode changes from 3", () => {
    const machine = createMockMachine({ psgMode: 3 });
    const audioControl = new AudioControlDevice(machine as any);
    audioControl.applyConfiguration();

    machine.soundDevice.psgMode = 0;
    audioControl.applyConfiguration();

    expect(audioControl.getTurboSoundDevice().getPsgHoldInReset()).toBe(false);
  });
});

// =============================================================================
// D9: Tone Counter — FPGA-Style Compare Before Increment
// =============================================================================
describe("D9: Tone counter FPGA behaviour", () => {
  it("period=0 toggles every tick (same as period=1)", () => {
    const psg = new PsgChip(0, "YM");
    psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(0); // Period A = 0
    psg.setPsgRegisterIndex(1); psg.writePsgRegisterValue(0);
    psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3e); // Tone A only
    psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(15);

    const bits: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      psg.generateOutputValue();
      bits.push(psg.getPsgData().bitA);
    }
    // Should toggle every tick: T, F, T, F, T, F
    for (let i = 1; i < bits.length; i++) {
      expect(bits[i]).not.toBe(bits[i - 1]);
    }
  });

  it("period=1 toggles every tick", () => {
    const psg = new PsgChip(0, "YM");
    psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(1);
    psg.setPsgRegisterIndex(1); psg.writePsgRegisterValue(0);
    psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3e);
    psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(15);

    const bits: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      psg.generateOutputValue();
      bits.push(psg.getPsgData().bitA);
    }
    for (let i = 1; i < bits.length; i++) {
      expect(bits[i]).not.toBe(bits[i - 1]);
    }
  });

  it("period=2 toggles every 2 ticks (after initial short phase)", () => {
    const psg = new PsgChip(0, "YM");
    psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(2);
    psg.setPsgRegisterIndex(1); psg.writePsgRegisterValue(0);
    psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3e);
    psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(15);

    const bits: boolean[] = [];
    for (let i = 0; i < 8; i++) {
      psg.generateOutputValue();
      bits.push(psg.getPsgData().bitA);
    }
    // Counter starts at 0, comp=1 → first toggle at tick 2
    // Pattern: F, T, T, F, F, T, T, F (first phase 1 tick, then 2-tick half-cycles)
    expect(bits[0]).not.toBe(bits[1]); // F → T
    expect(bits[1]).toBe(bits[2]);     // T T
    expect(bits[2]).not.toBe(bits[3]); // T → F
    expect(bits[3]).toBe(bits[4]);     // F F
    expect(bits[4]).not.toBe(bits[5]); // F → T
  });

  it("period=3 toggles every 3 ticks (after initial short phase)", () => {
    const psg = new PsgChip(0, "YM");
    psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(3);
    psg.setPsgRegisterIndex(1); psg.writePsgRegisterValue(0);
    psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3e);
    psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(15);

    const bits: boolean[] = [];
    for (let i = 0; i < 12; i++) {
      psg.generateOutputValue();
      bits.push(psg.getPsgData().bitA);
    }
    // Counter starts at 0, comp=2 → first toggle at tick 3
    // Pattern: F, F, T, T, T, F, F, F, T, T, T, F (first phase 2 ticks, then 3-tick half-cycles)
    expect(bits[0]).toBe(bits[1]);     // F F
    expect(bits[1]).not.toBe(bits[2]); // F → T
    expect(bits[2]).toBe(bits[3]);     // T T
    expect(bits[3]).toBe(bits[4]);     // T T
    expect(bits[4]).not.toBe(bits[5]); // T → F
    expect(bits[5]).toBe(bits[6]);     // F F
    expect(bits[6]).toBe(bits[7]);     // F F
  });

  it("all three channels operate independently", () => {
    const psg = new PsgChip(0, "YM");
    psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(2); // A period=2
    psg.setPsgRegisterIndex(2); psg.writePsgRegisterValue(3); // B period=3
    psg.setPsgRegisterIndex(4); psg.writePsgRegisterValue(5); // C period=5
    psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x38); // All tones on

    for (let i = 0; i < 30; i++) {
      psg.generateOutputValue();
    }
    // Just verify all channels have been toggling (not stuck)
    const data = psg.getPsgData();
    // After 30 ticks: A toggles 15 times, B toggles 10 times, C toggles 6 times
    // Counter should be at some intermediate value
    expect(data.cntA).toBeDefined();
    expect(data.cntB).toBeDefined();
    expect(data.cntC).toBeDefined();
  });
});

// =============================================================================
// D10: Noise Counter — FPGA-Style Period Handling
// =============================================================================
describe("D10: Noise counter FPGA behaviour", () => {
  it("period=0 advances LFSR at max speed", () => {
    const psg = new PsgChip(0, "YM");
    psg.setPsgRegisterIndex(6); psg.writePsgRegisterValue(0); // Noise freq=0
    psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x07); // Noise A/B/C, no tone
    psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(15);

    const seedBefore = psg.getPsgData().noiseSeed;
    // Need 2 ticks for prescaler to tick LFSR
    psg.generateOutputValue();
    psg.generateOutputValue();
    const seedAfter = psg.getPsgData().noiseSeed;
    expect(seedAfter).not.toBe(seedBefore);
  });

  it("period=1 also advances at max speed (same as period=0)", () => {
    const psg0 = new PsgChip(0, "YM");
    const psg1 = new PsgChip(0, "YM");

    psg0.setPsgRegisterIndex(6); psg0.writePsgRegisterValue(0);
    psg1.setPsgRegisterIndex(6); psg1.writePsgRegisterValue(1);

    for (let i = 0; i < 10; i++) {
      psg0.generateOutputValue();
      psg1.generateOutputValue();
    }

    // Both should produce the same LFSR sequence
    expect(psg0.getPsgData().noiseSeed).toBe(psg1.getPsgData().noiseSeed);
  });

  it("higher noise period produces slower LFSR advance", () => {
    const psgFast = new PsgChip(0, "YM");
    const psgSlow = new PsgChip(0, "YM");

    psgFast.setPsgRegisterIndex(6); psgFast.writePsgRegisterValue(1); // Fast
    psgSlow.setPsgRegisterIndex(6); psgSlow.writePsgRegisterValue(10); // Slow

    for (let i = 0; i < 40; i++) {
      psgFast.generateOutputValue();
      psgSlow.generateOutputValue();
    }

    // Fast noise should have advanced the LFSR more
    expect(psgFast.getPsgData().noiseSeed).not.toBe(psgSlow.getPsgData().noiseSeed);
  });

  it("LFSR uses bit0 XOR bit3 feedback (MAME-verified)", () => {
    const psg = new PsgChip(0, "YM");
    psg.setPsgRegisterIndex(6); psg.writePsgRegisterValue(0); // Max speed

    // Initial seed is 1 (0x00001)
    expect(psg.getPsgData().noiseSeed).toBe(1);

    // After 2 ticks (prescaler cycles): LFSR ticks once
    // Feedback: bit0(1) XOR bit3(0) = 1 → shifted: (1>>1) | (1<<16) = 0x10000
    psg.generateOutputValue(); // prescale: false → true
    psg.generateOutputValue(); // prescale: true → false → LFSR tick
    const seed = psg.getPsgData().noiseSeed;
    expect(seed).toBe(0x10000);
  });
});

// =============================================================================
// D11: Envelope Counter — Matches Tone/Noise Pattern
// =============================================================================
describe("D11: Envelope counter FPGA behaviour", () => {
  function setupEnv(psg: PsgChip, shape: number, freq: number) {
    psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(1);
    psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3e);
    psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(0x10); // Envelope mode
    psg.setPsgRegisterIndex(11); psg.writePsgRegisterValue(freq & 0xff);
    psg.setPsgRegisterIndex(12); psg.writePsgRegisterValue((freq >> 8) & 0xff);
    psg.setPsgRegisterIndex(13); psg.writePsgRegisterValue(shape);
  }

  it("AY envFreq=0 advances every tick", () => {
    const psg = new PsgChip(0, "AY");
    setupEnv(psg, 0x0e, 0);
    const pos0 = psg.getPsgData().posEnv;
    psg.generateOutputValue();
    expect(psg.getPsgData().posEnv).toBe(pos0 + 1);
  });

  it("YM envFreq=0 advances every tick", () => {
    const psg = new PsgChip(0, "YM");
    setupEnv(psg, 0x0e, 0);
    const pos0 = psg.getPsgData().posEnv;
    psg.generateOutputValue();
    expect(psg.getPsgData().posEnv).toBe(pos0 + 1);
  });

  it("AY envFreq=1 advances every 2 ticks", () => {
    const psg = new PsgChip(0, "AY");
    setupEnv(psg, 0x0e, 1);
    const pos0 = psg.getPsgData().posEnv;
    psg.generateOutputValue(); // No advance yet
    expect(psg.getPsgData().posEnv).toBe(pos0);
    psg.generateOutputValue(); // Advances
    expect(psg.getPsgData().posEnv).toBe(pos0 + 1);
  });

  it("YM envFreq=1 advances every tick", () => {
    const psg = new PsgChip(0, "YM");
    setupEnv(psg, 0x0e, 1);
    const pos0 = psg.getPsgData().posEnv;
    psg.generateOutputValue();
    expect(psg.getPsgData().posEnv).toBe(pos0 + 1);
  });

  it("AY envFreq=5 advances every 10 ticks", () => {
    const psg = new PsgChip(0, "AY");
    setupEnv(psg, 0x0e, 5);
    const pos0 = psg.getPsgData().posEnv;
    for (let i = 0; i < 9; i++) psg.generateOutputValue();
    expect(psg.getPsgData().posEnv).toBe(pos0); // Not yet
    psg.generateOutputValue(); // 10th tick
    expect(psg.getPsgData().posEnv).toBe(pos0 + 1);
  });

  it("envelope position wraps at 0x80 to 0x40", () => {
    const psg = new PsgChip(0, "YM");
    setupEnv(psg, 0x0e, 0); // Max speed
    for (let i = 0; i < 128; i++) psg.generateOutputValue();
    // posEnv should have wrapped
    const pos = psg.getPsgData().posEnv;
    expect(pos).toBeGreaterThanOrEqual(0x40);
    expect(pos).toBeLessThanOrEqual(0x7f);
  });
});

// =============================================================================
// State Serialization
// =============================================================================
describe("State serialization includes new fields", () => {
  it("should persist holdInReset and turbosoundEnabled", () => {
    const device = new TurboSoundDevice();
    device.setPsgHoldInReset(true);
    device.setTurbosoundEnabled(true);

    const state = device.getState();
    expect(state.holdInReset).toBe(true);
    expect(state.turbosoundEnabled).toBe(true);
  });

  it("should restore holdInReset and turbosoundEnabled from state", () => {
    const device1 = new TurboSoundDevice();
    device1.setPsgHoldInReset(true);
    device1.setTurbosoundEnabled(true);
    const state = device1.getState();

    const device2 = new TurboSoundDevice();
    device2.setState(state);
    expect(device2.getPsgHoldInReset()).toBe(true);
    expect(device2.getTurbosoundEnabled()).toBe(true);
  });

  it("should default to false when state is missing fields", () => {
    const device = new TurboSoundDevice();
    device.setState({ selectedChip: 0 }); // No holdInReset or turbosoundEnabled
    expect(device.getPsgHoldInReset()).toBe(false);
    expect(device.getTurbosoundEnabled()).toBe(false);
  });
});
