import { describe, it, expect, beforeEach } from "vitest";
import { PsgChip } from "@emu/machines/zxSpectrum128/PsgChip";
import { AudioDeviceBase } from "@emu/machines/AudioDeviceBase";
import type { IAnyMachine } from "@renderer/abstractions/IAnyMachine";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";

/**
 * Steps 9-14: Cross-check fixes from MAME vs Klive audit.
 *
 * Phase 9:  Noise period=0 should advance at max speed (not freeze)
 * Phase 10: Envelope period=0 should advance at fastest rate (not freeze)
 * Phase 11: DC filter uses MAME form: y = x - x_prev + α·y_prev
 * Phase 12: DAC D port import (tested via compile; port-level test below)
 * Phase 14: Register 7 resets to 0x00 (all channels enabled)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupNoiseOnlyA(chip: PsgChip, noiseFreq: number, vol: number = 10): void {
  // Disable tone A, enable noise A only on channel A
  chip.setPsgRegisterIndex(6); chip.writePsgRegisterValue(noiseFreq & 0x1f);
  chip.setPsgRegisterIndex(7); chip.writePsgRegisterValue(0x37); // tone A off, noise A on; B,C off
  chip.setPsgRegisterIndex(8); chip.writePsgRegisterValue(vol);
}

function setupEnvA(chip: PsgChip, shape: number, envFreq: number): void {
  chip.setPsgRegisterIndex(0); chip.writePsgRegisterValue(1); // tone period = 1
  chip.setPsgRegisterIndex(7); chip.writePsgRegisterValue(0x3e); // tone A on, noise off
  chip.setPsgRegisterIndex(8); chip.writePsgRegisterValue(0x10); // use envelope
  chip.setPsgRegisterIndex(11); chip.writePsgRegisterValue(envFreq & 0xff);
  chip.setPsgRegisterIndex(12); chip.writePsgRegisterValue((envFreq >> 8) & 0xff);
  chip.setPsgRegisterIndex(13); chip.writePsgRegisterValue(shape & 0x0f);
}

// ---------------------------------------------------------------------------
// Phase 9: Noise period=0 handling
// ---------------------------------------------------------------------------

describe("Phase 9: Noise period=0 advances LFSR at max speed", () => {
  let psg: PsgChip;

  beforeEach(() => {
    psg = new PsgChip();
  });

  it("should NOT freeze noise when noiseFreq register is 0", () => {
    setupNoiseOnlyA(psg, 0, 15);

    const dataBefore = psg.getPsgData();
    const seedBefore = dataBefore.noiseSeed;

    // Tick enough for at least one LFSR advance (need 2 ticks due to ÷2 prescaler)
    psg.generateOutputValue();
    psg.generateOutputValue();

    const dataAfter = psg.getPsgData();
    // With period=0 treated as period=1, counter overflows every tick.
    // After 2 ticks the prescaler toggles twice → at least 1 LFSR shift
    expect(dataAfter.noiseSeed).not.toBe(seedBefore);
  });

  it("noise period=0 should behave identically to period=1", () => {
    const psg0 = new PsgChip();
    const psg1 = new PsgChip();

    setupNoiseOnlyA(psg0, 0, 15);
    setupNoiseOnlyA(psg1, 1, 15);

    // Run both for the same number of ticks and compare seeds
    for (let i = 0; i < 20; i++) {
      psg0.generateOutputValue();
      psg1.generateOutputValue();
    }

    const data0 = psg0.getPsgData();
    const data1 = psg1.getPsgData();

    expect(data0.noiseSeed).toBe(data1.noiseSeed);
    expect(data0.bitNoise).toBe(data1.bitNoise);
    expect(data0.noisePrescale).toBe(data1.noisePrescale);
  });

  it("noise period=0 LFSR seed should evolve over several ticks", () => {
    setupNoiseOnlyA(psg, 0, 15);

    const seeds = new Set<number>();
    for (let i = 0; i < 40; i++) {
      psg.generateOutputValue();
      seeds.add(psg.getPsgData().noiseSeed);
    }

    // Over 40 ticks with max-speed noise, we should see multiple distinct seeds
    expect(seeds.size).toBeGreaterThan(5);
  });

  it("noise period=1 still works correctly (regression check)", () => {
    setupNoiseOnlyA(psg, 1, 15);

    const seedBefore = psg.getPsgData().noiseSeed;
    psg.generateOutputValue();
    psg.generateOutputValue();

    expect(psg.getPsgData().noiseSeed).not.toBe(seedBefore);
  });

  it("noise period=2 advances slower than period=0 or period=1", () => {
    const psgFast = new PsgChip();
    const psgSlow = new PsgChip();

    setupNoiseOnlyA(psgFast, 0, 15); // max speed
    setupNoiseOnlyA(psgSlow, 2, 15); // half speed

    // After 4 ticks, fast should have shifted LFSR 2 times, slow only 1 time
    for (let i = 0; i < 4; i++) {
      psgFast.generateOutputValue();
      psgSlow.generateOutputValue();
    }

    // Verify by seed divergence — both start at seed=1 but fast evolves faster
    const dataFast = psgFast.getPsgData();
    const dataSlow = psgSlow.getPsgData();
    expect(dataFast.noiseSeed).not.toBe(dataSlow.noiseSeed);
  });
});

// ---------------------------------------------------------------------------
// Phase 10: Envelope period=0 handling
// ---------------------------------------------------------------------------

describe("Phase 10: Envelope period=0 advances at max speed", () => {
  it("AY envelope should NOT freeze when envFreq is 0", () => {
    const psg = new PsgChip(0, "AY");
    setupEnvA(psg, 0x0e, 0); // sawtooth up, freq=0

    const posBefore = psg.getPsgData().posEnv;
    psg.generateOutputValue();

    // With envFreq=0, AY period = 0*2 = 0; treated as 1 → advances every tick
    expect(psg.getPsgData().posEnv).toBe(posBefore + 1);
  });

  it("YM envelope should NOT freeze when envFreq is 0", () => {
    const psg = new PsgChip(0, "YM");
    setupEnvA(psg, 0x0e, 0); // sawtooth up, freq=0

    const posBefore = psg.getPsgData().posEnv;
    psg.generateOutputValue();

    // With envFreq=0, YM period = 0; treated as 1 → advances every tick
    expect(psg.getPsgData().posEnv).toBe(posBefore + 1);
  });

  it("AY envelope period=0 advances faster than period=1", () => {
    const psgFast = new PsgChip(0, "AY");
    const psgSlow = new PsgChip(0, "AY");

    setupEnvA(psgFast, 0x0e, 0); // period=0 → treated as 1 (max speed)
    setupEnvA(psgSlow, 0x0e, 1); // period=1 → AY multiplier ×2 = effective period 2

    // After 2 ticks, fast should have advanced 2 steps, slow should have advanced 1 step
    psgFast.generateOutputValue();
    psgFast.generateOutputValue();
    psgSlow.generateOutputValue();
    psgSlow.generateOutputValue();

    // envFreq=0: effectiveEnvPeriod = max(0*2,1) = 1 → advances 2 times in 2 ticks
    // envFreq=1: envPeriod = 1*2 = 2 → advances 1 time in 2 ticks
    expect(psgFast.getPsgData().posEnv).toBe(2);
    expect(psgSlow.getPsgData().posEnv).toBe(1);
  });

  it("YM envelope period=0 advances every tick", () => {
    const psg = new PsgChip(0, "YM");
    setupEnvA(psg, 0x0e, 0); // period=0 → treated as 1

    for (let i = 0; i < 10; i++) {
      psg.generateOutputValue();
    }

    // Should have advanced 10 positions
    expect(psg.getPsgData().posEnv).toBe(10);
  });

  it("AY envelope period=0 is 2× faster than period=1 (MAME spec)", () => {
    // MAME: "period = 0 is half as period = 1"
    const psg0 = new PsgChip(0, "AY");
    const psg1 = new PsgChip(0, "AY");

    setupEnvA(psg0, 0x0e, 0);
    setupEnvA(psg1, 0x0e, 1);

    // Run for 16 ticks (AY: period=1 → effective 2 → 8 advances)
    for (let i = 0; i < 16; i++) {
      psg0.generateOutputValue();
      psg1.generateOutputValue();
    }

    const pos0 = psg0.getPsgData().posEnv;
    const pos1 = psg1.getPsgData().posEnv;

    // period=0 → 16 advances; period=1 → 8 advances → ratio is 2:1
    expect(pos0).toBe(16);
    expect(pos1).toBe(8);
    expect(pos0).toBe(pos1 * 2);
  });

  it("envelope period=0 should cycle through full envelope shape", () => {
    const psg = new PsgChip(0, "AY");
    // Shape 0x08 = Continue, Attack = ////// (sawtooth up, then repeat)
    setupEnvA(psg, 0x0c, 0);

    let maxOutput = 0;
    let minOutput = Infinity;
    for (let i = 0; i < 128; i++) {
      psg.generateOutputValue();
      if (psg.currentOutputA > maxOutput) maxOutput = psg.currentOutputA;
      if (psg.currentOutputA < minOutput) minOutput = psg.currentOutputA;
    }

    // Should have cycled through the envelope (min < max)
    expect(maxOutput).toBeGreaterThan(0);
    expect(minOutput).toBeLessThan(maxOutput);
  });

  it("non-zero envelope period still works (regression)", () => {
    const psg = new PsgChip(0, "AY");
    setupEnvA(psg, 0x0e, 5); // envFreq=5, AY period = 10

    for (let i = 0; i < 10; i++) {
      psg.generateOutputValue();
    }
    // After 10 ticks with period=10, should advance exactly 1 step
    expect(psg.getPsgData().posEnv).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Phase 11: DC filter formula — MAME form: y = x - x_prev + α·y_prev
// ---------------------------------------------------------------------------

class MockMachine implements Partial<IAnyMachine> {
  baseClockFrequency = 3_546_900;
  tacts = 0;
  clockMultiplier = 1;
}

class TestAudioDevice extends AudioDeviceBase<IAnyMachine> {
  private _val = { left: 0.0, right: 0.0 };

  setSample(left: number, right: number): void {
    this._val = { left, right };
  }

  override getCurrentSampleValue(): AudioSample {
    return this._val;
  }
}

describe("Phase 11: DC filter uses MAME form y = x - x_prev + α·y_prev", () => {
  let machine: MockMachine;
  let device: TestAudioDevice;

  beforeEach(() => {
    machine = new MockMachine();
    device = new TestAudioDevice(machine as IAnyMachine);
    device.setAudioSampleRate(44100);
  });

  function collectSamples(values: number[], count?: number): AudioSample[] {
    const n = count ?? values.length;
    const sampleLength = machine.baseClockFrequency / 44100;
    for (let i = 0; i < n; i++) {
      const v = values[Math.min(i, values.length - 1)];
      device.setSample(v, v);
      machine.tacts += sampleLength;
      device.setNextAudioSample();
    }
    return device.getAudioSamples();
  }

  it("should pass through zero unchanged", () => {
    const samples = collectSamples([0]);
    expect(samples[0].left).toBe(0);
    expect(samples[0].right).toBe(0);
  });

  it("should pass through first non-zero sample unattenuated", () => {
    // First sample: y = x - 0 + 0.995·0 = x (exactly)
    const samples = collectSamples([1.0]);
    expect(samples[0].left).toBe(1.0);
    expect(samples[0].right).toBe(1.0);
  });

  it("constant input should decay toward zero (removes DC offset)", () => {
    // Feed constant 1.0 for many samples — α=0.995 decays slowly
    const samples = collectSamples([1.0], 1000);

    // First sample: y = 1 - 0 + 0 = 1.0
    expect(samples[0].left).toBe(1.0);

    // After 1000 samples: ~0.995^999 ≈ 0.0067
    const lastSample = samples[samples.length - 1];
    expect(Math.abs(lastSample.left)).toBeLessThan(0.05);
  });

  it("second sample of constant input should be α·y_prev (MAME form)", () => {
    // Sample 0: y[0] = 1.0 - 0 + 0.995·0 = 1.0
    // Sample 1: y[1] = 1.0 - 1.0 + 0.995·1.0 = 0.995 (exactly)
    // With old formula: y[1] = 0.995·(1.0 + 1.0 - 1.0) = 0.995 (same for this case)
    const samples = collectSamples([1.0, 1.0]);
    expect(samples[1].left).toBeCloseTo(0.995, 6);
  });

  it("MAME form differs from old form on subsequent samples", () => {
    // The MAME and old forms diverge after 2+ samples.
    // MAME: y[2] = 1.0 - 1.0 + 0.995·0.995 = 0.990025
    // Old:  y[2] = 0.995·(0.995 + 1.0 - 1.0) = 0.990025 (still same for constant!)
    // They diverge when input changes:
    // After [1.0, 0.0]:
    //   MAME: y[0]=1.0, y[1] = 0 - 1.0 + 0.995·1.0 = -0.005
    //   Old:  y[0]=1.0, y[1] = 0.995·(1.0 + 0 - 1.0) = 0.995·0 = 0
    const samples = collectSamples([1.0, 0.0]);
    // MAME form: y[1] = 0.0 - 1.0 + 0.995 * 1.0 = -0.005
    expect(samples[1].left).toBeCloseTo(-0.005, 6);
  });

  it("step response down should produce small negative undershoot (MAME characteristic)", () => {
    // Constant 1.0 then sudden drop to 0.0
    const vals = [1.0, 1.0, 1.0, 0.0];
    const samples = collectSamples(vals);

    // The sample after the drop should be negative
    expect(samples[3].left).toBeLessThan(0);
  });

  it("should handle symmetric Left/Right channels", () => {
    device.setSample(0.5, -0.3);
    machine.tacts += machine.baseClockFrequency / 44100;
    device.setNextAudioSample();

    const s = device.getAudioSamples()[0];
    expect(s.left).toBeCloseTo(0.5, 6);
    expect(s.right).toBeCloseTo(-0.3, 6);
  });
});

// ---------------------------------------------------------------------------
// Phase 14: Register 7 resets to 0xFF (all channels disabled), matching FPGA ym2149.vhd
// ---------------------------------------------------------------------------

describe("Phase 14: Register 7 resets to 0xFF (FPGA-accurate)", () => {
  it("register 7 should be 0xFF after construction", () => {
    const psg = new PsgChip();
    const data = psg.getPsgData();
    expect(data.regValues[7]).toBe(0xff);
  });

  it("all tone channels should be disabled after reset", () => {
    const psg = new PsgChip();
    const data = psg.getPsgData();
    expect(data.toneAEnabled).toBe(false);
    expect(data.toneBEnabled).toBe(false);
    expect(data.toneCEnabled).toBe(false);
  });

  it("all noise channels should be disabled after reset", () => {
    const psg = new PsgChip();
    const data = psg.getPsgData();
    expect(data.noiseAEnabled).toBe(false);
    expect(data.noiseBEnabled).toBe(false);
    expect(data.noiseCEnabled).toBe(false);
  });

  it("register 7 should be 0xFF after explicit reset", () => {
    const psg = new PsgChip();
    // Enable everything
    psg.setPsgRegisterIndex(7);
    psg.writePsgRegisterValue(0x00);
    expect(psg.getPsgData().regValues[7]).toBe(0x00);

    // Reset
    psg.reset();
    expect(psg.getPsgData().regValues[7]).toBe(0xff);
  });

  it("YM chip should also reset R7 to 0xFF", () => {
    const psg = new PsgChip(0, "YM");
    const data = psg.getPsgData();
    expect(data.regValues[7]).toBe(0xff);
    expect(data.toneAEnabled).toBe(false);
    expect(data.noiseAEnabled).toBe(false);
  });

  it("initial output should be zero despite channels disabled (volumes are 0)", () => {
    const psg = new PsgChip();
    psg.generateOutputValue();
    // All channels disabled → tone/noise bits are 1 (bypass), but volumes are 0 → output is 0
    expect(psg.currentOutputA).toBe(0);
    expect(psg.currentOutputB).toBe(0);
    expect(psg.currentOutputC).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Phase 12: DAC D port import — compile-time verification
// ---------------------------------------------------------------------------

describe("Phase 12: DAC D port handler import", () => {
  it("writeDacDPort should be importable from DacPortHandler", async () => {
    // This test verifies the import is valid at compile time.
    // If the import was missing, this file wouldn't even compile.
    const { writeDacDPort } = await import(
      "@emu/machines/zxNext/io-ports/DacPortHandler"
    );
    expect(typeof writeDacDPort).toBe("function");
  });
});
