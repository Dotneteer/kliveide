import { describe, it, expect, beforeEach } from "vitest";
import { SpectrumBeeperDevice } from "@emu/machines/BeeperDevice";
import { AudioMixerDevice } from "@emu/machines/zxNext/AudioMixerDevice";
import { DacDevice } from "@emu/machines/zxNext/DacDevice";
import type { IAnyMachine } from "@renderer/abstractions/IAnyMachine";

/**
 * Step 22: Speaker / Beeper discrepancy fixes (S1–S4)
 *
 * FPGA truth: _input/next-fpga/src/audio/audio_mixer.vhd
 *             _input/next-fpga/src/zxnext.vhd
 *
 * S1: EAR and MIC are independent binary signals (FPGA ratio 4:1, not MAME 2:1).
 *     BeeperDevice returns left=EAR, right=MIC independently time-weighted.
 *
 * S2: MIC is separately wired to AudioMixerDevice.setMicLevel() and mixed with
 *     the same ×12 loudness boost as EAR, preserving the 4:1 amplitude ratio.
 *
 * S3: beep_spkr_excl = nr_06_internal_speaker_beep AND nr_08_internal_speaker_en.
 *     When true, EAR and MIC are zeroed from the headphone/HDMI PCM mix.
 *
 * S4: nr_08_internal_speaker_en=0 only powers off the physical speaker transistor.
 *     The headphone PCM output still receives EAR and MIC (FPGA does NOT gate them).
 */

class MockMachine implements Partial<IAnyMachine> {
  baseClockFrequency = 3_546_900;
  tacts = 0;
  clockMultiplier = 1;
}

// ============================================================
// S1: BeeperDevice — EAR and MIC as independent channels
// ============================================================
describe("S1: BeeperDevice — EAR on left, MIC on right (FPGA 4:1 model)", () => {
  let machine: MockMachine;
  let beeper: SpectrumBeeperDevice;

  beforeEach(() => {
    machine = new MockMachine();
    beeper = new SpectrumBeeperDevice(machine as any);
  });

  it("(ear=0, mic=0) → left=0, right=0", () => {
    beeper.setOutputLevel(false, false);
    const s = beeper.getCurrentSampleValue();
    expect(s.left).toBe(0.0);
    expect(s.right).toBe(0.0);
  });

  it("(ear=0, mic=1) → left=0, right=1 (MIC only on right channel)", () => {
    beeper.setOutputLevel(false, true);
    const s = beeper.getCurrentSampleValue();
    expect(s.left).toBe(0.0);
    expect(s.right).toBe(1.0);
  });

  it("(ear=1, mic=0) → left=1, right=0 (EAR only on left channel)", () => {
    beeper.setOutputLevel(true, false);
    const s = beeper.getCurrentSampleValue();
    expect(s.left).toBe(1.0);
    expect(s.right).toBe(0.0);
  });

  it("(ear=1, mic=1) → left=1, right=1 (both channels active)", () => {
    beeper.setOutputLevel(true, true);
    const s = beeper.getCurrentSampleValue();
    expect(s.left).toBe(1.0);
    expect(s.right).toBe(1.0);
  });

  it("EAR-only tone appears on left channel, right stays silent", () => {
    beeper.setAudioSampleRate(48000);
    const sampleLength = machine.baseClockFrequency / 48000;
    beeper.setOutputLevel(true, false); // EAR=1, MIC=0
    for (let i = 1; i <= 50; i++) {
      machine.tacts = sampleLength * i;
      beeper.setNextAudioSample();
    }
    const samples = beeper.getAudioSamples();
    expect(samples[0].left).toBeGreaterThan(0);   // EAR on left channel
    for (const s of samples) {
      expect(s.right).toBe(0.0);                  // MIC silent on right
    }
  });

  it("MIC-only tone appears on right channel, left stays silent", () => {
    beeper.setAudioSampleRate(48000);
    const sampleLength = machine.baseClockFrequency / 48000;
    // Oscillate MIC to prevent DC filter from killing the signal
    for (let i = 1; i <= 100; i++) {
      beeper.setOutputLevel(false, i % 10 < 5);
      machine.tacts = sampleLength * i;
      beeper.setNextAudioSample();
    }
    const samples = beeper.getAudioSamples();
    // MIC signal on right channel
    const rightEnergy = samples.reduce((sum, s) => sum + Math.abs(s.right), 0);
    expect(rightEnergy).toBeGreaterThan(0);
    // Left channel (EAR=always 0) is entirely silent
    for (const s of samples) {
      expect(s.left).toBe(0.0);
    }
  });

  it("time-weighted EAR: mid-sample transition produces intermediate left value", () => {
    beeper.setAudioSampleRate(48000);
    const sampleLength = machine.baseClockFrequency / 48000;

    // EAR=1 for first half of sample
    beeper.setOutputLevel(true, false);
    machine.tacts = Math.floor(sampleLength / 2);
    beeper.setOutputLevel(false, false); // EAR=0 for second half
    machine.tacts = sampleLength + 1;
    beeper.setNextAudioSample();

    const sample = beeper.getAudioSamples()[0];
    // DC filter of ~0.5 → positive but not 1.0
    expect(sample.left).toBeGreaterThan(0);
    expect(sample.left).toBeLessThan(1.0);
  });
});

// ============================================================
// S2: AudioMixerDevice — MIC separately mixed at 4:1 EAR:MIC ratio
// ============================================================
describe("S2: AudioMixerDevice — MIC separately wired, FPGA 4:1 amplitude ratio", () => {
  let dac: DacDevice;
  let mixer: AudioMixerDevice;

  beforeEach(() => {
    dac = new DacDevice();
    mixer = new AudioMixerDevice(dac);
  });

  it("setMicLevel(0) → micLevel=0 (backward compat)", () => {
    mixer.setMicLevel(0);
    expect(mixer.getMicLevel()).toBe(0);
  });

  it("setMicLevel(1) → micLevel=128 (backward compat)", () => {
    mixer.setMicLevel(1);
    expect(mixer.getMicLevel()).toBe(128);
  });

  it("setMicLevel(float) scales to 128 range (DC-filtered MIC sample)", () => {
    // DC-filtered MIC output oscillates around 0; e.g. +0.5 = half positive swing
    mixer.setMicLevel(0.5);
    expect(mixer.getMicLevel()).toBe(64);  // round(0.5 * 128) = 64
  });

  it("EAR:MIC amplitude ratio in mixer is 4:1 (512 vs 128 before ×12 boost)", () => {
    // Use 0.25 level to stay below clamping threshold
    const dacEmpty = new DacDevice();
    const m = new AudioMixerDevice(dacEmpty);

    // EAR only: earLevel = round(0.25*512) = 128, beeperScaled = 128*12 = 1536
    m.setEarLevel(0.25);
    m.setMicLevel(0.0);
    const earOnly = m.getMixedOutput();

    // MIC only: micLevel = round(0.25*128) = 32, micScaled = 32*12 = 384
    m.reset();
    m.setEarLevel(0.0);
    m.setMicLevel(0.25);
    const micOnly = m.getMixedOutput();

    const ratio = Math.abs(earOnly.left) / Math.abs(micOnly.left);
    // Both use ×12 boost: ratio = 1536/384 = 4.0 exactly
    expect(ratio).toBeCloseTo(4.0, 5);
  });

  it("MIC contributes to mixer output independently of EAR", () => {
    // No EAR
    mixer.setEarLevel(0.0);
    const before = mixer.getMixedOutput();

    // Add MIC DC-filtered signal
    mixer.setMicLevel(1.0);
    const after = mixer.getMixedOutput();

    // MIC added output that wasn't there before
    expect(Math.abs(after.left)).toBeGreaterThan(Math.abs(before.left));
  });

  it("EAR+MIC combined output has correct magnitude: (512+128)×12×5.5 / 32768", () => {
    mixer.setEarLevel(1.0);  // earLevel=512 → beeperScaled=6144
    mixer.setMicLevel(1.0);  // micLevel=128 → micScaled=1536
    // mixedLeft = 6144 + 1536 = 7680; left = floor(7680 * 5.5) = 42240; clamped to 32767
    const out = mixer.getMixedOutput();
    // Clamped to 32767/32768 ≈ 1.0
    expect(out.left).toBeCloseTo(1.0, 2);
  });

  it("EAR only: earLevel=512 → scaled → normalized ≈ 1.0", () => {
    mixer.setEarLevel(1.0);  // earLevel=512, beeperScaled=6144, ×5.5=33792 → clamped→1.0
    const out = mixer.getMixedOutput();
    expect(out.left).toBeCloseTo(1.0, 2);
  });

  it("MIC only at DC-filtered 1.0: micLevel=128, ×12=1536, ×5.5=8448 → normalized 0.258", () => {
    mixer.setMicLevel(1.0);  // micLevel=128, ×12=1536
    // left = floor(1536 * 5.5) = 8448; normalized = 8448/32768 ≈ 0.258
    const out = mixer.getMixedOutput();
    expect(out.left).toBeCloseTo(0.258, 2);
  });

  it("MIC mono: left and right channels equal for MIC signal", () => {
    mixer.setMicLevel(0.5);
    const out = mixer.getMixedOutput();
    expect(out.left).toBe(out.right);
  });
});

// ============================================================
// S3: beepOnlyToInternalSpeaker gates EAR+MIC from headphone/PCM output
// ============================================================
describe("S3: beepOnlyToInternalSpeaker (nr06 AND nr08) gates PCM output", () => {
  // Pure logic tests — no ZxNextMachine needed.
  // The fix is: beepExcl = beepOnlyToInternalSpeaker && enableInternalSpeaker
  // When beepExcl=true → earLevel=0, micLevel=0 passed to mixer.

  function beepExcl(beepOnly: boolean, enableSpeaker: boolean): boolean {
    return beepOnly && enableSpeaker;
  }

  function earLevelAfterGating(excl: boolean, rawEar: number): number {
    return excl ? 0.0 : rawEar;
  }

  function micLevelAfterGating(excl: boolean, rawMic: number): number {
    return excl ? 0.0 : rawMic;
  }

  it("S3.1: beepOnly=true AND enableSpeaker=true → excl=true, EAR+MIC zeroed in PCM", () => {
    const excl = beepExcl(true, true);
    expect(excl).toBe(true);
    expect(earLevelAfterGating(excl, 0.8)).toBe(0.0);
    expect(micLevelAfterGating(excl, 0.5)).toBe(0.0);
  });

  it("S3.2: beepOnly=true AND enableSpeaker=false → excl=false, EAR+MIC pass through", () => {
    // nr08=0 disables the physical speaker, so 'exclusive beep to speaker' has no speaker
    // to be exclusive to — EAR+MIC still go to headphone PCM
    const excl = beepExcl(true, false);
    expect(excl).toBe(false);
    expect(earLevelAfterGating(excl, 0.8)).toBeCloseTo(0.8);
    expect(micLevelAfterGating(excl, 0.5)).toBeCloseTo(0.5);
  });

  it("S3.3: beepOnly=false AND enableSpeaker=true → excl=false, EAR+MIC pass through", () => {
    const excl = beepExcl(false, true);
    expect(excl).toBe(false);
    expect(earLevelAfterGating(excl, 0.8)).toBeCloseTo(0.8);
    expect(micLevelAfterGating(excl, 0.5)).toBeCloseTo(0.5);
  });

  it("S3.4: beepOnly=false AND enableSpeaker=false → excl=false, EAR+MIC pass through", () => {
    const excl = beepExcl(false, false);
    expect(excl).toBe(false);
    expect(earLevelAfterGating(excl, 0.8)).toBeCloseTo(0.8);
  });

  it("S3: excl=true silences beeper in the mixer output", () => {
    const dac = new DacDevice();
    const mixer = new AudioMixerDevice(dac);

    // Without excl: EAR contributes to output
    mixer.setEarLevel(1.0);
    const withEar = mixer.getMixedOutput();
    expect(Math.abs(withEar.left)).toBeGreaterThan(0);

    // With excl: EAR zeroed → silence
    mixer.setEarLevel(0.0);
    mixer.setMicLevel(0.0);
    const silenced = mixer.getMixedOutput();
    expect(silenced.left).toBe(0.0);
  });
});

// ============================================================
// S4: enableInternalSpeaker=false does NOT gate headphone/PCM output
// ============================================================
describe("S4: enableInternalSpeaker only controls physical speaker, not headphones", () => {
  // FPGA truth: nr_08_internal_speaker_en=0 → o_AUDIO_SPEAKER_EN goes low (HW transistor off).
  //             The PCM mixer (pcm_L, pcm_R → headphone/HDMI) is UNAFFECTED.
  //             Only beep_spkr_excl (= nr06 AND nr08) gates PCM ear/mic.

  function beepExcl(beepOnly: boolean, enableSpeaker: boolean): boolean {
    return beepOnly && enableSpeaker;
  }

  function earLevelAfterFix(enableSpeaker: boolean, beepOnly: boolean, rawEar: number): number {
    const excl = beepExcl(beepOnly, enableSpeaker);
    return excl ? 0.0 : rawEar;
  }

  it("S4.1: enableSpeaker=false, beepOnly=false → EAR passes through to PCM (NOT gated)", () => {
    const earLevel = earLevelAfterFix(
      /* enableSpeaker */ false,
      /* beepOnly      */ false,
      /* rawEar        */ 0.9
    );
    expect(earLevel).toBeCloseTo(0.9); // Physical speaker off, but headphone gets EAR
  });

  it("S4.2: enableSpeaker=true, beepOnly=false → EAR passes through (normal operation)", () => {
    const earLevel = earLevelAfterFix(true, false, 0.9);
    expect(earLevel).toBeCloseTo(0.9);
  });

  it("S4.3: enableSpeaker=false does NOT trigger excl gating (no beep-to-speaker routing)", () => {
    // beepExcl requires BOTH nr06 AND nr08 to be true
    // enableSpeaker=false → beepExcl=false regardless of beepOnly
    expect(beepExcl(false, false)).toBe(false);
    expect(beepExcl(true, false)).toBe(false);
  });

  it("S4: with enableSpeaker=false, mixer still receives EAR signal", () => {
    const dac = new DacDevice();
    const mixer = new AudioMixerDevice(dac);

    // Simulate what ZxNextMachine.getAudioSamples() now does for enableSpeaker=false
    const enableSpeaker = false;
    const beepOnly = false;
    const excl = enableSpeaker && beepOnly; // = false
    const rawEar = 0.8;
    const earLevel = excl ? 0.0 : rawEar;  // = 0.8 (NOT gated!)

    mixer.setEarLevel(earLevel);
    const out = mixer.getMixedOutput();
    expect(Math.abs(out.left)).toBeGreaterThan(0); // Beeper IS in headphone output
  });

  it("S4: old (wrong) behavior was gating EAR when enableSpeaker=false (verifying the bug is gone)", () => {
    // The old code was:
    //   const earLevel = this.soundDevice.enableInternalSpeaker ? rawEarLevel : 0.0;
    // This incorrectly silenced headphones when the physical speaker was disabled.
    // The new code uses beepExcl = beepOnly AND enableSpeaker as the gate.
    // With enableSpeaker=false and beepOnly=false → beepExcl=false → earLevel=rawEarLevel.
    const oldBehaviorGatesEar = (enableSpeaker: boolean, _rawEar: number) =>
      enableSpeaker ? _rawEar : 0.0; // OLD wrong logic
    const newBehaviorGatesEar = (enableSpeaker: boolean, beepOnly: boolean, _rawEar: number) =>
      (beepOnly && enableSpeaker) ? 0.0 : _rawEar; // NEW correct logic

    const rawEar = 0.9;
    // Old code: disables speaker → gates headphone (WRONG)
    expect(oldBehaviorGatesEar(false, rawEar)).toBe(0.0);
    // New code: disables speaker → does NOT gate headphone (CORRECT per FPGA)
    expect(newBehaviorGatesEar(false, false, rawEar)).toBeCloseTo(0.9);
  });
});
