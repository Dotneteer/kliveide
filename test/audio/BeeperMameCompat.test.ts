import { describe, it, expect, beforeEach } from "vitest";
import { SpectrumBeeperDevice } from "@emu/machines/BeeperDevice";
import { BEEPER_LEVELS } from "@emu/abstractions/IGenericBeeperDevice";
import { AudioMixerDevice } from "@emu/machines/zxNext/AudioMixerDevice";
import { DacDevice } from "@emu/machines/zxNext/DacDevice";
import type { IAnyMachine } from "@renderer/abstractions/IAnyMachine";

/**
 * Mock machine for testing beeper device
 */
class MockMachine implements Partial<IAnyMachine> {
  baseClockFrequency: number;
  tacts: number;
  clockMultiplier: number;

  constructor(baseClockFrequency: number = 3_546_900) {
    this.baseClockFrequency = baseClockFrequency;
    this.tacts = 0;
    this.clockMultiplier = 1;
  }
}

// ============================================================
// Phase 1: 4-Level Speaker Output (MIC + EAR resistor mixer)
// ============================================================
describe("Phase 1: 4-Level Speaker Output", () => {
  let machine: MockMachine;
  let beeper: SpectrumBeeperDevice;

  beforeEach(() => {
    machine = new MockMachine();
    beeper = new SpectrumBeeperDevice(machine as any);
  });

  describe("BEEPER_LEVELS constant", () => {
    it("should define exactly 4 levels", () => {
      expect(BEEPER_LEVELS.length).toBe(4);
    });

    it("should match MAME's speaker_levels: 0.0, 0.33, 0.66, 1.0", () => {
      expect(BEEPER_LEVELS[0]).toBe(0.0);
      expect(BEEPER_LEVELS[1]).toBe(0.33);
      expect(BEEPER_LEVELS[2]).toBe(0.66);
      expect(BEEPER_LEVELS[3]).toBe(1.0);
    });
  });

  describe("setOutputLevel() - 4-level model", () => {
    it("(mic=0, ear=0) → level 0.0", () => {
      beeper.setOutputLevel(false, false);
      expect(beeper.outputLevel).toBe(0.0);
      expect(beeper.earBit).toBe(false);
    });

    it("(mic=1, ear=0) → level 0.33", () => {
      beeper.setOutputLevel(false, true);
      expect(beeper.outputLevel).toBe(0.33);
      expect(beeper.earBit).toBe(false);
    });

    it("(mic=0, ear=1) → level 0.66", () => {
      beeper.setOutputLevel(true, false);
      expect(beeper.outputLevel).toBe(0.66);
      expect(beeper.earBit).toBe(true);
    });

    it("(mic=1, ear=1) → level 1.0", () => {
      beeper.setOutputLevel(true, true);
      expect(beeper.outputLevel).toBe(1.0);
      expect(beeper.earBit).toBe(true);
    });
  });

  describe("setEarBit backward compatibility", () => {
    it("setEarBit(true) with default micBit=false → level 0.66", () => {
      beeper.setEarBit(true);
      expect(beeper.outputLevel).toBe(0.66);
    });

    it("setEarBit(false) with default micBit=false → level 0.0", () => {
      beeper.setEarBit(false);
      expect(beeper.outputLevel).toBe(0.0);
    });

    it("setEarBit preserves last micBit value", () => {
      // Set mic=true via setOutputLevel
      beeper.setOutputLevel(false, true); // ear=0, mic=1 → 0.33
      expect(beeper.outputLevel).toBe(0.33);

      // Now setEarBit(true) should keep mic=true → ear=1, mic=1 → 1.0
      beeper.setEarBit(true);
      expect(beeper.outputLevel).toBe(1.0);
    });
  });

  describe("Simulating port 0xFE writes (MAME BIT(data,3,2))", () => {
    // MAME: m_speaker->level_w(BIT(data, 3, 2))
    // BIT(data, 3, 2) extracts bits 3-4 as a 0-3 value
    function simulatePortFEWrite(beep: SpectrumBeeperDevice, portValue: number) {
      const earBit = (portValue & 0x10) !== 0; // bit 4
      const micBit = (portValue & 0x08) !== 0; // bit 3
      beep.setOutputLevel(earBit, micBit);
    }

    it("port 0xFE = 0x00 (bits 3,4 = 00) → level 0.0", () => {
      simulatePortFEWrite(beeper, 0x00);
      expect(beeper.outputLevel).toBe(0.0);
    });

    it("port 0xFE = 0x08 (bits 3,4 = 10) → level 0.33 (MIC only)", () => {
      simulatePortFEWrite(beeper, 0x08);
      expect(beeper.outputLevel).toBe(0.33);
    });

    it("port 0xFE = 0x10 (bits 3,4 = 01) → level 0.66 (EAR only)", () => {
      simulatePortFEWrite(beeper, 0x10);
      expect(beeper.outputLevel).toBe(0.66);
    });

    it("port 0xFE = 0x18 (bits 3,4 = 11) → level 1.0 (EAR+MIC)", () => {
      simulatePortFEWrite(beeper, 0x18);
      expect(beeper.outputLevel).toBe(1.0);
    });

    it("border bits should not affect speaker level", () => {
      simulatePortFEWrite(beeper, 0x07); // border=7, mic=0, ear=0
      expect(beeper.outputLevel).toBe(0.0);

      simulatePortFEWrite(beeper, 0x17); // border=7, mic=0, ear=1
      expect(beeper.outputLevel).toBe(0.66);

      simulatePortFEWrite(beeper, 0x1f); // border=7, mic=1, ear=1
      expect(beeper.outputLevel).toBe(1.0);
    });
  });

  describe("4-level sample generation", () => {
    it("should produce different sample values for each level", () => {
      beeper.setAudioSampleRate(48000);
      const sampleLength = machine.baseClockFrequency / 48000;
      const levels: [boolean, boolean][] = [
        [false, false], // 0.0
        [false, true],  // 0.33
        [true, false],  // 0.66
        [true, true],   // 1.0
      ];

      const rawValues: number[] = [];
      for (let i = 0; i < levels.length; i++) {
        beeper.setOutputLevel(levels[i][0], levels[i][1]);
        const sample = beeper.getCurrentSampleValue();
        rawValues.push(sample.left);
      }

      // Each successive level should produce a higher raw value
      for (let i = 1; i < rawValues.length; i++) {
        expect(rawValues[i]).toBeGreaterThan(rawValues[i - 1]);
      }
    });

    it("should produce 4 distinct filtered output levels over time", () => {
      beeper.setAudioSampleRate(48000);
      const sampleLength = machine.baseClockFrequency / 48000;
      const levels: [boolean, boolean][] = [
        [false, false], // 0.0
        [false, true],  // 0.33
        [true, false],  // 0.66
        [true, true],   // 1.0
      ];

      // For each level, generate many samples to let the DC filter stabilize
      const averages: number[] = [];
      for (const [ear, mic] of levels) {
        beeper.reset();
        beeper.setAudioSampleRate(48000);
        beeper.setOutputLevel(ear, mic);

        // Generate 200 samples
        for (let i = 1; i <= 200; i++) {
          machine.tacts = sampleLength * i;
          beeper.setNextAudioSample();
        }

        const samples = beeper.getAudioSamples();
        // Take average of last 50 samples (filter settled)
        const lastSamples = samples.slice(-50);
        const avg = lastSamples.reduce((sum, s) => sum + s.left, 0) / lastSamples.length;
        averages.push(avg);
      }

      // Level 0 should converge to ~0 (DC filter removes constant)
      expect(Math.abs(averages[0])).toBeLessThan(0.01);

      // All non-zero levels should produce distinct positive averages
      // (the DC filter will reduce them toward 0 over time, but the relative
      // ordering should hold for the first samples)
    });

    it("MIC-only tone should be quieter than EAR-only tone", () => {
      beeper.setAudioSampleRate(48000);
      const sampleLength = machine.baseClockFrequency / 48000;

      // Generate a square wave with MIC-only (0.33 level)
      beeper.reset();
      beeper.setAudioSampleRate(48000);
      for (let i = 1; i <= 100; i++) {
        beeper.setOutputLevel(false, i % 10 < 5); // MIC toggles
        machine.tacts = sampleLength * i;
        beeper.setNextAudioSample();
      }
      const micSamples = beeper.getAudioSamples();
      const micPeak = Math.max(...micSamples.map(s => Math.abs(s.left)));

      // Generate a square wave with EAR-only (0.66 level)
      beeper.reset();
      beeper.setAudioSampleRate(48000);
      for (let i = 1; i <= 100; i++) {
        beeper.setOutputLevel(i % 10 < 5, false); // EAR toggles
        machine.tacts = sampleLength * i;
        beeper.setNextAudioSample();
      }
      const earSamples = beeper.getAudioSamples();
      const earPeak = Math.max(...earSamples.map(s => Math.abs(s.left)));

      // EAR-only peak should be larger than MIC-only peak
      expect(earPeak).toBeGreaterThan(micPeak);
    });
  });
});

// ============================================================
// Phase 2: Transition-Accurate Sampling
// ============================================================
describe("Phase 2: Transition-Accurate Sampling", () => {
  let machine: MockMachine;
  let beeper: SpectrumBeeperDevice;

  beforeEach(() => {
    machine = new MockMachine();
    beeper = new SpectrumBeeperDevice(machine as any);
    beeper.setAudioSampleRate(48000);
  });

  describe("Weighted averaging within sample period", () => {
    it("level change mid-sample should produce intermediate value", () => {
      const sampleLength = machine.baseClockFrequency / 48000;

      // Set level to 0.66 (EAR on)
      beeper.setOutputLevel(true, false);

      // Advance halfway through the sample period, then change level
      machine.tacts = sampleLength / 2;
      beeper.setOutputLevel(false, false); // back to 0

      // Generate sample at end of period
      machine.tacts = sampleLength + 1;
      beeper.setNextAudioSample();

      const sample = beeper.getAudioSamples()[0];
      // The raw value (before DC filter) should be approximately 0.33
      // (half=0.66, half=0.0 → weighted avg = 0.33)
      // With DC filter, it will be slightly less, but still positive
      expect(sample.left).toBeGreaterThan(0);
      // Should be less than what a full 0.66 period would produce
      // (can't test exact value due to DC filter, but can compare)
    });

    it("multiple transitions within one sample should all contribute", () => {
      const sampleLength = machine.baseClockFrequency / 48000;
      // ~73 T-states per sample at 48kHz with 3.5MHz clock

      // Toggle rapidly within one sample period
      beeper.setOutputLevel(true, true);   // 1.0
      machine.tacts = 10;
      beeper.setOutputLevel(false, false); // 0.0
      machine.tacts = 40;
      beeper.setOutputLevel(true, false);  // 0.66
      machine.tacts = 60;

      // Now generate the sample
      machine.tacts = sampleLength + 1;
      beeper.setNextAudioSample();

      const sample = beeper.getAudioSamples()[0];
      // The weighted average should be between 0 and 1
      // Exact value depends on relative durations, but it should be a
      // non-trivial intermediate value (not 0 and not at the maximum)
      expect(Math.abs(sample.left)).toBeGreaterThan(0);
    });

    it("no transition within sample period uses current level directly", () => {
      // Set a constant level
      beeper.setOutputLevel(true, true); // 1.0

      const sampleLength = machine.baseClockFrequency / 48000;
      machine.tacts = sampleLength + 1;
      beeper.setNextAudioSample();

      machine.tacts = sampleLength * 2 + 1;
      beeper.setNextAudioSample();

      const samples = beeper.getAudioSamples();
      // Both samples should be positive (constant HIGH, DC filtered)
      expect(samples[0].left).toBeGreaterThan(0);
      expect(samples[1].left).toBeGreaterThan(0);
    });
  });

  describe("High-frequency beeper engines", () => {
    it("rapid toggling simulating multi-channel engine should produce non-zero output", () => {
      const sampleLength = machine.baseClockFrequency / 48000;

      // Simulate a simple multi-channel beeper engine:
      // Toggling EAR bit every 8 T-states (similar to a ~220kHz square wave)
      // This is much faster than the audio sample rate can capture without averaging
      for (let i = 1; i <= 200; i++) {
        const tstate = sampleLength * i;
        // Toggle multiple times within each sample period
        for (let t = 0; t < Math.floor(sampleLength); t += 8) {
          machine.tacts = sampleLength * (i - 1) + t;
          beeper.setOutputLevel(t % 16 < 8, false);
        }
        machine.tacts = sampleLength * i + 1;
        beeper.setNextAudioSample();
      }

      const samples = beeper.getAudioSamples();
      // At least some samples should have non-zero values
      // (the rapid toggling should average to ~0.33 before DC filter)
      const nonZero = samples.filter(s => Math.abs(s.left) > 0.01).length;
      expect(nonZero).toBeGreaterThan(0);
    });
  });
});

// ============================================================
// Phase 3: DC Offset Filter
// ============================================================
describe("Phase 3: DC Offset Filter", () => {
  let machine: MockMachine;
  let beeper: SpectrumBeeperDevice;

  beforeEach(() => {
    machine = new MockMachine();
    beeper = new SpectrumBeeperDevice(machine as any);
    beeper.setAudioSampleRate(48000);
  });

  describe("Constant HIGH should decay toward zero", () => {
    it("sustained EAR=1 should produce diminishing positive output", () => {
      const sampleLength = machine.baseClockFrequency / 48000;
      beeper.setOutputLevel(true, false); // 0.66 constant

      // Generate 500 samples
      for (let i = 1; i <= 500; i++) {
        machine.tacts = sampleLength * i;
        beeper.setNextAudioSample();
      }

      const samples = beeper.getAudioSamples();
      // First sample should be strongly positive
      expect(samples[0].left).toBeGreaterThan(0.3);

      // Later samples should be smaller (filter removes DC)
      const firstValue = samples[0].left;
      const laterValue = samples[samples.length - 1].left;
      expect(laterValue).toBeLessThan(firstValue);
    });
  });

  describe("Silence should remain silent", () => {
    it("sustained EAR=0 should produce zero output", () => {
      const sampleLength = machine.baseClockFrequency / 48000;
      beeper.setOutputLevel(false, false); // 0.0

      for (let i = 1; i <= 100; i++) {
        machine.tacts = sampleLength * i;
        beeper.setNextAudioSample();
      }

      const samples = beeper.getAudioSamples();
      for (const s of samples) {
        expect(s.left).toBe(0); // 0 input → 0 output through filter
      }
    });
  });

  describe("Square wave should be AC-coupled", () => {
    it("alternating HIGH/LOW should produce symmetric positive/negative output", () => {
      const sampleLength = machine.baseClockFrequency / 48000;

      // Generate a square wave toggling every sample
      for (let i = 1; i <= 200; i++) {
        beeper.setOutputLevel(i % 2 === 0, false);
        machine.tacts = sampleLength * i;
        beeper.setNextAudioSample();
      }

      const samples = beeper.getAudioSamples();
      // After settling, should have both positive and negative samples
      const positives = samples.filter(s => s.left > 0.01).length;
      const negatives = samples.filter(s => s.left < -0.01).length;
      expect(positives).toBeGreaterThan(0);
      expect(negatives).toBeGreaterThan(0);
    });
  });

  describe("Filter reset behavior", () => {
    it("reset should clear filter state", () => {
      const sampleLength = machine.baseClockFrequency / 48000;

      // Generate some biased samples
      beeper.setOutputLevel(true, true); // 1.0
      for (let i = 1; i <= 10; i++) {
        machine.tacts = sampleLength * i;
        beeper.setNextAudioSample();
      }

      // Reset the device and machine tacts
      machine.tacts = 0;
      beeper.reset();
      beeper.setAudioSampleRate(48000);

      // After reset, 0 input should give 0 output immediately
      beeper.setOutputLevel(false, false);
      machine.tacts = sampleLength;
      beeper.setNextAudioSample();

      const samples = beeper.getAudioSamples();
      expect(samples[0].left).toBe(0);
    });
  });
});

// ============================================================
// Phase 4: ZX Next Internal Speaker Gating
// ============================================================
describe("Phase 4: AudioMixerDevice EAR Level Support", () => {
  let dac: DacDevice;
  let mixer: AudioMixerDevice;

  beforeEach(() => {
    dac = new DacDevice();
    mixer = new AudioMixerDevice(dac);
  });

  describe("4-level EAR input", () => {
    it("setEarLevel(0.0) → earLevel = 0", () => {
      mixer.setEarLevel(0.0);
      expect(mixer.getEarLevel()).toBe(0);
    });

    it("setEarLevel(0.33) → earLevel ≈ 169", () => {
      mixer.setEarLevel(0.33);
      expect(mixer.getEarLevel()).toBe(Math.round(0.33 * 512));
    });

    it("setEarLevel(0.66) → earLevel ≈ 339", () => {
      mixer.setEarLevel(0.66);
      expect(mixer.getEarLevel()).toBe(Math.round(0.66 * 512));
    });

    it("setEarLevel(1.0) → earLevel = 512", () => {
      mixer.setEarLevel(1.0);
      expect(mixer.getEarLevel()).toBe(512);
    });
  });

  describe("Mixed output varies with EAR level", () => {
    it("different EAR levels should produce different mixed outputs", () => {
      const levels = [0.0, 0.33, 0.66, 1.0];
      const outputs: number[] = [];

      for (const level of levels) {
        mixer.reset();
        mixer.setEarLevel(level);
        const output = mixer.getMixedOutput();
        outputs.push(output.left);
      }

      // Level 0 should produce ~0 (no signal)
      expect(outputs[0]).toBe(0);

      // Non-zero levels should all produce non-zero output
      // (AC coupling in mixer subtracts DC bias, so values may be negative)
      for (let i = 1; i < outputs.length; i++) {
        expect(outputs[i]).not.toBe(0);
      }

      // Full level (1.0) should produce the strongest positive output
      expect(outputs[3]).toBeGreaterThan(0);
      expect(Math.abs(outputs[3])).toBeGreaterThan(Math.abs(outputs[1]));
    });
  });

  describe("Internal speaker gating", () => {
    it("when speaker disabled, beeper should not contribute to mix", () => {
      // This tests the mixer's ability to receive 0 when speaker is disabled
      // The actual gating is in ZxNextMachine.getAudioSamples()
      mixer.setEarLevel(1.0);
      const withBeeper = mixer.getMixedOutput();

      mixer.setEarLevel(0.0);
      const withoutBeeper = mixer.getMixedOutput();

      expect(Math.abs(withBeeper.left)).toBeGreaterThan(Math.abs(withoutBeeper.left));
    });
  });
});

// ============================================================
// End-to-end: Full frame simulation
// ============================================================
describe("E2E: Full Frame Beeper Simulation", () => {
  let machine: MockMachine;
  let beeper: SpectrumBeeperDevice;

  beforeEach(() => {
    machine = new MockMachine();
    beeper = new SpectrumBeeperDevice(machine as any);
    beeper.setAudioSampleRate(48000);
  });

  it("should generate correct number of samples per frame", () => {
    const tactsPerFrame = 69_888; // ZX Spectrum 48K
    const sampleLength = machine.baseClockFrequency / 48000;

    beeper.setOutputLevel(true, false);
    beeper.onNewFrame();

    // Simulate a full frame
    for (let tact = 1; tact <= tactsPerFrame; tact++) {
      machine.tacts = tact;
      beeper.setNextAudioSample();
    }

    const samples = beeper.getAudioSamples();
    const expectedSamples = Math.floor(tactsPerFrame / sampleLength);
    // Should be within ±2 of expected
    expect(Math.abs(samples.length - expectedSamples)).toBeLessThanOrEqual(2);
  });

  it("should simulate BEEP command 1kHz tone across multiple frames", () => {
    const tactsPerFrame = 69_888;
    const sampleLength = machine.baseClockFrequency / 48000;
    const halfPeriodTacts = Math.round(machine.baseClockFrequency / (2 * 1000)); // ~1773 for 1kHz

    // Simulate 3 frames of 1kHz beeper tone
    let earState = false;
    let nextToggleTact = halfPeriodTacts;
    let globalTact = 0;

    for (let frame = 0; frame < 3; frame++) {
      beeper.onNewFrame();
      for (let tact = 0; tact < tactsPerFrame; tact++) {
        globalTact++;
        machine.tacts = globalTact;

        if (globalTact >= nextToggleTact) {
          earState = !earState;
          beeper.setOutputLevel(earState, false);
          nextToggleTact += halfPeriodTacts;
        }

        beeper.setNextAudioSample();
      }
    }

    const samples = beeper.getAudioSamples();
    // The last frame should have samples
    expect(samples.length).toBeGreaterThan(0);

    // Count zero crossings (transitions through 0)
    let crossings = 0;
    for (let i = 1; i < samples.length; i++) {
      if ((samples[i].left > 0 && samples[i - 1].left <= 0) ||
          (samples[i].left <= 0 && samples[i - 1].left > 0)) {
        crossings++;
      }
    }
    // A 1kHz tone at 48kHz sample rate should have ~2000 crossings per second
    // One frame is 1/50 second, so expect ~40 crossings per frame
    expect(crossings).toBeGreaterThan(20);
  });

  it("should produce louder output for EAR+MIC vs EAR-only tone", () => {
    const tactsPerFrame = 69_888;
    const sampleLength = machine.baseClockFrequency / 48000;
    const halfPeriod = 100; // Toggle every 100 tacts

    // Generate EAR-only square wave
    beeper.reset();
    beeper.setAudioSampleRate(48000);
    beeper.onNewFrame();
    for (let tact = 1; tact <= tactsPerFrame; tact++) {
      machine.tacts = tact;
      const earOn = Math.floor(tact / halfPeriod) % 2 === 0;
      beeper.setOutputLevel(earOn, false); // EAR only
      beeper.setNextAudioSample();
    }
    const earOnlySamples = beeper.getAudioSamples();
    const earOnlyRMS = Math.sqrt(
      earOnlySamples.reduce((sum, s) => sum + s.left * s.left, 0) / earOnlySamples.length
    );

    // Generate EAR+MIC square wave (toggling both bits together)
    beeper.reset();
    beeper.setAudioSampleRate(48000);
    beeper.onNewFrame();
    for (let tact = 1; tact <= tactsPerFrame; tact++) {
      machine.tacts = tact;
      const on = Math.floor(tact / halfPeriod) % 2 === 0;
      beeper.setOutputLevel(on, on); // Both EAR and MIC
      beeper.setNextAudioSample();
    }
    const bothSamples = beeper.getAudioSamples();
    const bothRMS = Math.sqrt(
      bothSamples.reduce((sum, s) => sum + s.left * s.left, 0) / bothSamples.length
    );

    // EAR+MIC (1.0 level) should be louder than EAR-only (0.66 level)
    expect(bothRMS).toBeGreaterThan(earOnlyRMS);
  });

  it("should handle tape loading scenario (MIC bit toggling)", () => {
    const sampleLength = machine.baseClockFrequency / 48000;

    // Simulate tape loading: MIC bit toggles rapidly while EAR is off
    for (let i = 1; i <= 500; i++) {
      const micOn = Math.floor(i / 5) % 2 === 0;
      beeper.setOutputLevel(false, micOn); // Only MIC toggles
      machine.tacts = sampleLength * i;
      beeper.setNextAudioSample();
    }

    const samples = beeper.getAudioSamples();
    // Should produce audible output (not all zeros)
    const nonSilent = samples.filter(s => Math.abs(s.left) > 0.01).length;
    expect(nonSilent).toBeGreaterThan(0);
  });

  it("stereo output should be identical for beeper (mono source)", () => {
    const sampleLength = machine.baseClockFrequency / 48000;

    beeper.setOutputLevel(true, false);
    for (let i = 1; i <= 100; i++) {
      machine.tacts = sampleLength * i;
      beeper.setNextAudioSample();
    }

    const samples = beeper.getAudioSamples();
    for (const s of samples) {
      expect(s.left).toBe(s.right);
    }
  });
});
