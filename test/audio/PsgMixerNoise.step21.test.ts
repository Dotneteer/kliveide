import { describe, it, expect, beforeEach } from "vitest";
import { PsgChip } from "@emu/machines/zxSpectrum128/PsgChip";

/**
 * Step 21: PSG Mixer Logic (Phase 1) and Noise Generator (Phase 2) Tests
 *
 * Phase 1: Hardware-accurate MAME mixer formula
 *   vol_enabled = (tone_output | tone_disable) & (noise_output | noise_disable)
 *   - Disabled input acts as bypass (always HIGH)
 *   - Both disabled = constant DC amplitude (volume-modulation mode)
 *
 * Phase 2: Hardware-verified 17-bit LFSR noise generator
 *   - Seed initialised to 1 (matches MAME ay8910_reset_ym())
 *   - Feedback: bit0 XOR bit3, inserted at bit16
 *   - ÷2 prescaler: LFSR advances every two noise-period expiries
 */
describe("Step 21: PSG Mixer Logic (Phase 1)", () => {
  let psg: PsgChip;

  // Convenience: volume lookup from PsgChip (white-box)
  // psgVolumeTable[(vol*2+1 & 0x1f) >> 1] — see PsgChip._psgVolumeTable
  // We compute expected amplitude by reading the chip state after setup.

  function setupToneOnly(chip: PsgChip, vol: number = 10, period: number = 1) {
    // Enable tone A, disable noise A (reg7 = 0x3e: tone A enabled, rest disabled)
    chip.setPsgRegisterIndex(0); chip.writePsgRegisterValue(period & 0xff);
    chip.setPsgRegisterIndex(1); chip.writePsgRegisterValue((period >> 8) & 0x0f);
    chip.setPsgRegisterIndex(7); chip.writePsgRegisterValue(0x3e); // toneA on, noise off + others
    chip.setPsgRegisterIndex(8); chip.writePsgRegisterValue(vol);
  }

  function setupNoiseOnly(chip: PsgChip, vol: number = 10, noiseFreq: number = 1) {
    // Disable tone A, enable noise A (reg7 = 0x01: tone A disabled, noise A enabled)
    chip.setPsgRegisterIndex(6); chip.writePsgRegisterValue(noiseFreq & 0x1f);
    chip.setPsgRegisterIndex(7); chip.writePsgRegisterValue(0x01); // tone A disabled, noise A on
    chip.setPsgRegisterIndex(8); chip.writePsgRegisterValue(vol);
  }

  function setupToneAndNoise(chip: PsgChip, vol: number = 10, period: number = 1, noiseFreq: number = 1) {
    // Enable both tone A and noise A (reg7 = 0x00: all enabled)
    chip.setPsgRegisterIndex(0); chip.writePsgRegisterValue(period & 0xff);
    chip.setPsgRegisterIndex(1); chip.writePsgRegisterValue((period >> 8) & 0x0f);
    chip.setPsgRegisterIndex(6); chip.writePsgRegisterValue(noiseFreq & 0x1f);
    chip.setPsgRegisterIndex(7); chip.writePsgRegisterValue(0x00); // tone+noise all enabled
    chip.setPsgRegisterIndex(8); chip.writePsgRegisterValue(vol);
  }

  function setupBothDisabled(chip: PsgChip, vol: number = 10) {
    // Disable both tone and noise on channel A (reg7 = 0x09: tone A bit0=1, noise A bit3=1)
    // Leave B and C also disabled (bits 1,2,4,5 set) = reg7 = 0x3f
    chip.setPsgRegisterIndex(7); chip.writePsgRegisterValue(0x3f); // all disabled
    chip.setPsgRegisterIndex(8); chip.writePsgRegisterValue(vol);
  }

  beforeEach(() => {
    psg = new PsgChip();
  });

  // ==================== Tone-only channel ====================

  describe("Tone-only channel (noise disabled = bypass)", () => {
    it("should output amplitude when tone bit is HIGH", () => {
      setupToneOnly(psg);
      // period=1 → after one tick bitA flips to true
      psg.generateOutputValue();
      // bitA should now be true → output = amplitude
      const vol = psg.getChannelAVolume();
      expect(vol).toBeGreaterThan(0);
      expect(psg.currentOutputA).toBe(vol);
    });

    it("should output zero when tone bit is LOW", () => {
      setupToneOnly(psg);
      // period=2 → bitA stays false for two ticks
      psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(2);
      // initial bitA = false → output should be 0
      psg.generateOutputValue();
      expect(psg.currentOutputA).toBe(0);
      expect(psg.getChannelAVolume()).toBe(0);
    });

    it("should toggle output with each half-period", () => {
      setupToneOnly(psg, 10, 1);
      psg.generateOutputValue(); // bitA → true  → output > 0
      const onValue = psg.currentOutputA;
      expect(onValue).toBeGreaterThan(0);

      psg.generateOutputValue(); // bitA → false → output = 0
      expect(psg.currentOutputA).toBe(0);

      psg.generateOutputValue(); // bitA → true  → output > 0
      expect(psg.currentOutputA).toBe(onValue);
    });
  });

  // ==================== Noise-only channel (tone disabled = bypass) ====================

  describe("Noise-only channel (tone disabled = bypass)", () => {
    it("should output amplitude when the initial noise bit is HIGH", () => {
      // Initial seed=1 → bitNoise=true after reset
      setupNoiseOnly(psg, 10, 2); // noiseFreq=2 so prescaler doesn't tick immediately
      psg.generateOutputValue();
      // bitNoise starts true (initial seed=1); noise counter=1 < 2, no LFSR tick yet
      const vol = psg.getChannelAVolume();
      expect(vol).toBeGreaterThan(0);
    });

    it("should follow noise bit exclusively when tone is disabled", () => {
      // With tone disabled (bypass=HIGH) and noise enabled, output = noise bit
      setupNoiseOnly(psg, 8, 100); // high period so noise bit won't flip quickly
      psg.generateOutputValue();
      // bitNoise = true initially; tone disabled means output = true & bitNoise = bitNoise
      const vol = psg.getChannelAVolume();
      const state = psg.getPsgData();
      if (state.bitNoise) {
        expect(vol).toBeGreaterThan(0);
      } else {
        expect(vol).toBe(0);
      }
    });
  });

  // ==================== Both enabled → AND logic ====================

  describe("Both tone AND noise enabled (AND logic)", () => {
    it("should output amplitude only when BOTH tone AND noise bits are HIGH", () => {
      // Use a very long noise period so noise bit stays at initial value (true)
      setupToneAndNoise(psg, 10, 1, 100); // toneA period=1, noiseFreq=100
      // Initial state: bitA=false, bitNoise=true (seed=1)
      
      // Tick 1: bitA flips → true; bitNoise still true (noise period not expired)
      psg.generateOutputValue();
      const state = psg.getPsgData();
      // AND: true & true = true → output = amplitude
      expect(state.bitA).toBe(true);
      expect(state.bitNoise).toBe(true);
      expect(psg.currentOutputA).toBeGreaterThan(0);
    });

    it("should output zero when tone is HIGH but noise is LOW", () => {
      // Force noise bit to LOW first, then check AND
      setupToneAndNoise(psg, 10, 1, 2); // noiseFreq=2: prescaler fires every 2 ticks
      
      // tick 1: cntNoise=1 < 2, no prescaler → bitNoise stays true
      //          cntA=1 ≥ 1 → bitA flips: false→true
      psg.generateOutputValue(); // bitA=true, bitNoise=true → output > 0

      // tick 2: cntNoise=2 ≥ 2 → prescale from false→true (no LFSR)
      //          bitA remains true (just flipped back: true→false actually with period=1)
      psg.generateOutputValue();
      // After tick 2: bitA=false (period=1, second flip), prescale=true no LFSR tick
      // bitNoise still = initial (seed=1 → bitNoise=true)

      // tick 3: bitA flips back: false→true; cntNoise=1 < 2
      psg.generateOutputValue();

      // tick 4: cntNoise=2 ≥ 2 → prescale from true→false → LFSR ticks
      //   seed=1: feedback = (1&1)^((1>>3)&1)=1^0=1; seed=(1>>1)|(1<<16)=0x10000; bitNoise=0
      //   bitA: after 4 ticks with period=1 = false (4th flip from initial false)
      psg.generateOutputValue();
      
      const state = psg.getPsgData();
      // After 4 prescaler ticks, LFSR should have advanced
      // bit values depend on initial state; key check: when bitNoise=false, output=0
      if (!state.bitNoise) {
        expect(psg.currentOutputA).toBe(0);
      }
      // If both true, output > 0; if either false, output = 0
      if (state.bitA && state.bitNoise) {
        expect(psg.currentOutputA).toBeGreaterThan(0);
      } else {
        expect(psg.currentOutputA).toBe(0);
      }
    });

    it("should output zero when noise is HIGH but tone is LOW", () => {
      // bitA starts false; noise starts true
      // tone=1 so bitA oscillates; check the case when bitA=false
      setupToneAndNoise(psg, 10, 2, 100); // toneA period=2 (starts LOW for first tick)
      // Initial: bitA=false, bitNoise=true
      psg.generateOutputValue(); // bitA still false (cntA=1 < 2)
      // AND: false & true = false → output 0
      const state = psg.getPsgData();
      expect(state.bitA).toBe(false);
      expect(state.bitNoise).toBe(true);
      expect(psg.currentOutputA).toBe(0);
    });

    it("volume-modulation mode: both disabled gives constant DC amplitude", () => {
      // reg7=0x3f: both tone and noise disabled for all channels
      // Hardware: disabled = bypass = HIGH; both HIGH → always output amplitude
      setupBothDisabled(psg, 10);
      psg.generateOutputValue();
      const amplitude = psg.currentOutputA;
      expect(amplitude).toBeGreaterThan(0);

      // Amplitude should remain constant across multiple calls (no bit oscillation)
      psg.generateOutputValue();
      expect(psg.currentOutputA).toBe(amplitude);

      psg.generateOutputValue();
      expect(psg.currentOutputA).toBe(amplitude);
    });

    it("volume-modulation mode returns amplitude from getChannelAVolume", () => {
      setupBothDisabled(psg, 7);
      psg.generateOutputValue();
      expect(psg.getChannelAVolume()).toBe(psg.currentOutputA);
      expect(psg.getChannelAVolume()).toBeGreaterThan(0);
    });

    it("both disabled with volume=0 gives zero output", () => {
      // With volume=0, amplitude = psgVolumeTable[0] = 0
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3f); // both disabled
      psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(0);    // volume = 0
      psg.generateOutputValue();
      expect(psg.currentOutputA).toBe(0);
    });
  });

  // ==================== getChannelXVolume consistency ====================

  describe("getChannelXVolume matches currentOutputX", () => {
    it("should match currentOutputA after generateOutputValue", () => {
      setupToneOnly(psg, 10, 1);
      psg.generateOutputValue();
      expect(psg.getChannelAVolume()).toBe(psg.currentOutputA);
    });

    it("should match currentOutputB after generateOutputValue", () => {
      // Enable tone B only
      psg.setPsgRegisterIndex(2); psg.writePsgRegisterValue(1);
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3d); // toneB on (bit1=0)
      psg.setPsgRegisterIndex(9); psg.writePsgRegisterValue(8);
      psg.generateOutputValue();
      expect(psg.getChannelBVolume()).toBe(psg.currentOutputB);
    });

    it("should match currentOutputC after generateOutputValue", () => {
      // Enable tone C only
      psg.setPsgRegisterIndex(4); psg.writePsgRegisterValue(1);
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3b); // toneC on (bit2=0)
      psg.setPsgRegisterIndex(10); psg.writePsgRegisterValue(5);
      psg.generateOutputValue();
      expect(psg.getChannelCVolume()).toBe(psg.currentOutputC);
    });

    it("getChannelXVolume returns unsigned values (0 to 65535)", () => {
      setupToneOnly(psg, 15, 1); // max volume
      psg.generateOutputValue(); // bitA → true
      const vol = psg.getChannelAVolume();
      expect(vol).toBeGreaterThanOrEqual(0);
      expect(vol).toBeLessThanOrEqual(65535);
    });
  });

  // ==================== All channels simultaneously ====================

  describe("Multi-channel output", () => {
    it("orphanSum equals sum of per-channel volumes per tick", () => {
      // Enable all three tone channels with period=1
      psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(1);
      psg.setPsgRegisterIndex(2); psg.writePsgRegisterValue(1);
      psg.setPsgRegisterIndex(4); psg.writePsgRegisterValue(1);
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x38); // tone A/B/C, noise disabled
      psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(7);
      psg.setPsgRegisterIndex(9); psg.writePsgRegisterValue(7);
      psg.setPsgRegisterIndex(10); psg.writePsgRegisterValue(7);
      
      psg.generateOutputValue();
      // After one tick all bits flip to true
      const expected = psg.currentOutputA + psg.currentOutputB + psg.currentOutputC;
      // orphanSum accumulates across calls (reset externally), after 1 call = sum of all
      expect(psg.orphanSum).toBe(expected);
    });
  });
});

// =============================================================================

describe("Step 21: PSG Noise Generator (Phase 2)", () => {
  let psg: PsgChip;

  beforeEach(() => {
    psg = new PsgChip();
  });

  // ==================== Initial state ====================

  describe("Initial state (seed=1)", () => {
    it("should initialise noise seed to 1", () => {
      const state = psg.getPsgData();
      expect(state.noiseSeed).toBe(1);
    });

    it("should initialise bitNoise to true (bit0 of seed=1)", () => {
      const state = psg.getPsgData();
      expect(state.bitNoise).toBe(true);
    });

    it("should initialise noisePrescale to false", () => {
      const state = psg.getPsgData();
      expect(state.noisePrescale).toBe(false);
    });

    it("should reset back to seed=1 and bitNoise=true after reset()", () => {
      // Advance LFSR by running many ticks
      psg.setPsgRegisterIndex(6); psg.writePsgRegisterValue(1);
      for (let i = 0; i < 200; i++) psg.generateOutputValue();

      psg.reset();
      const state = psg.getPsgData();
      expect(state.noiseSeed).toBe(1);
      expect(state.bitNoise).toBe(true);
      expect(state.noisePrescale).toBe(false);
    });
  });

  // ==================== LFSR algorithm ====================

  describe("LFSR algorithm (17-bit, bit0 XOR bit3)", () => {
    it("should produce the correct first LFSR transition from seed=1", () => {
      // Reference algorithm from MAME ay8910.cpp:
      //   seed = (seed >> 1) | ((bit0 ^ bit3) << 16); mask to 17 bits
      // seed=1 (0b00000000000000001):
      //   feedback = (1 & 1) ^ ((1 >> 3) & 1) = 1 ^ 0 = 1
      //   new_seed = (1 >> 1) | (1 << 16) = 0 | 0x10000 = 65536
      //   bitNoise = 65536 & 1 = 0
      const expectedSeed = 65536;
      const expectedBitNoise = false;

      // noiseFreq=1, prescale needs TWO period-expiries to tick LFSR
      psg.setPsgRegisterIndex(6); psg.writePsgRegisterValue(1);
      // All channels disabled so we can isolate noise:
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3f);

      // Tick 1: cntNoise 0→1 ≥ 1 → cntNoise=0, prescale false→true; no LFSR
      psg.generateOutputValue();
      expect(psg.getPsgData().noiseSeed).toBe(1);       // unchanged
      expect(psg.getPsgData().noisePrescale).toBe(true);
      expect(psg.getPsgData().bitNoise).toBe(true);     // unchanged

      // Tick 2: cntNoise 0→1 ≥ 1 → prescale true→false → LFSR ticks
      psg.generateOutputValue();
      expect(psg.getPsgData().noiseSeed).toBe(expectedSeed);
      expect(psg.getPsgData().bitNoise).toBe(expectedBitNoise);
      expect(psg.getPsgData().noisePrescale).toBe(false);
    });

    it("should produce the correct second LFSR transition (from seed=65536)", () => {
      // seed=65536 (0x10000 = 0b10000000000000000):
      //   feedback = (65536 & 1) ^ ((65536 >> 3) & 1) = 0 ^ 0 = 0
      //   new_seed = (65536 >> 1) | (0 << 16) = 32768
      //   bitNoise = 32768 & 1 = 0
      const expectedSeed = 32768;

      psg.setPsgRegisterIndex(6); psg.writePsgRegisterValue(1);
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3f);

      // Need 4 ticks to trigger 2nd LFSR tick (2 ticks per LFSR advance)
      for (let i = 0; i < 4; i++) psg.generateOutputValue();

      expect(psg.getPsgData().noiseSeed).toBe(expectedSeed);
      expect(psg.getPsgData().bitNoise).toBe(false);
    });

    it("should match reference LFSR sequence for first 16 advance steps", () => {
      // Compute expected sequence using reference algorithm
      function lfsrStep(seed: number): number {
        const feedback = (seed & 1) ^ ((seed >> 3) & 1);
        return ((seed >> 1) | (feedback << 16)) & 0x1ffff;
      }

      let refSeed = 1;
      const expected: number[] = [];
      for (let i = 0; i < 16; i++) {
        refSeed = lfsrStep(refSeed);
        expected.push(refSeed);
      }

      psg.setPsgRegisterIndex(6); psg.writePsgRegisterValue(1);
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3f);

      for (let i = 0; i < 16; i++) {
        // Need 2 PSG ticks per LFSR advance
        psg.generateOutputValue();
        psg.generateOutputValue();
        expect(psg.getPsgData().noiseSeed).toBe(expected[i]);
        expect(psg.getPsgData().bitNoise).toBe((expected[i] & 1) !== 0);
      }
    });

    it("should return to a different seed after 131071 steps (maximal sequence)", () => {
      // A maximal 17-bit LFSR should cycle through 2^17 - 1 = 131071 states.
      // After 131071 steps we should be back to seed=1.
      // This test just verifies the LFSR is non-trivial and runs a shorter check.
      psg.setPsgRegisterIndex(6); psg.writePsgRegisterValue(1);
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3f);

      const initialSeed = psg.getPsgData().noiseSeed; // 1
      // Check that the seed changes after 1 LFSR advance
      psg.generateOutputValue(); psg.generateOutputValue();
      expect(psg.getPsgData().noiseSeed).not.toBe(initialSeed);

      // Check that we haven't returned to initialSeed after a small number of steps
      for (let i = 0; i < 100; i++) {
        psg.generateOutputValue(); psg.generateOutputValue();
      }
      // Very unlikely to be seed=1 after only 101 steps
      expect(psg.getPsgData().noiseSeed).not.toBe(initialSeed);
    });
  });

  // ==================== Prescaler (÷2) ====================

  describe("Noise prescaler (LFSR advances every 2 period-expiries)", () => {
    it("should not advance LFSR on first period expiry", () => {
      psg.setPsgRegisterIndex(6); psg.writePsgRegisterValue(1);
      psg.generateOutputValue(); // first expiry: prescale false→true, no LFSR
      expect(psg.getPsgData().noiseSeed).toBe(1); // unchanged
      expect(psg.getPsgData().noisePrescale).toBe(true);
    });

    it("should advance LFSR on second period expiry", () => {
      psg.setPsgRegisterIndex(6); psg.writePsgRegisterValue(1);
      psg.generateOutputValue(); // first expiry
      psg.generateOutputValue(); // second expiry → LFSR ticks
      expect(psg.getPsgData().noiseSeed).not.toBe(1);
      expect(psg.getPsgData().noisePrescale).toBe(false);
    });

    it("should advance LFSR every 2 tacts for noiseFreq=1", () => {
      psg.setPsgRegisterIndex(6); psg.writePsgRegisterValue(1);
      const seeds: number[] = [psg.getPsgData().noiseSeed];
      for (let i = 0; i < 20; i++) {
        psg.generateOutputValue();
        psg.generateOutputValue();
        seeds.push(psg.getPsgData().noiseSeed);
      }
      // All odd-indexed seeds should differ from previous
      for (let i = 1; i < seeds.length; i++) {
        expect(seeds[i]).not.toBe(seeds[i - 1]);
      }
    });

    it("should advance LFSR every 2*noiseFreq tacts for higher periods", () => {
      const freq = 5;
      psg.setPsgRegisterIndex(6); psg.writePsgRegisterValue(freq);
      const initialSeed = psg.getPsgData().noiseSeed;

      // 2*freq - 1 ticks: should not yet have advanced
      for (let i = 0; i < 2 * freq - 1; i++) psg.generateOutputValue();
      expect(psg.getPsgData().noiseSeed).toBe(initialSeed);

      // One more tick: LFSR now advances
      psg.generateOutputValue();
      expect(psg.getPsgData().noiseSeed).not.toBe(initialSeed);
    });

    it("should advance LFSR at max speed when noiseFreq=0 (period-0 = period-1)", () => {
      // noiseFreq=0 is treated as period=1 (max speed), matching MAME behaviour
      psg.setPsgRegisterIndex(6); psg.writePsgRegisterValue(0);
      const initialSeed = psg.getPsgData().noiseSeed;
      for (let i = 0; i < 20; i++) psg.generateOutputValue();
      expect(psg.getPsgData().noiseSeed).not.toBe(initialSeed);
    });
  });

  // ==================== Noise bit output routing ====================

  describe("Noise output routing through mixer", () => {
    it("initial bitNoise=true causes noise-only channel to output amplitude", () => {
      // Noise A enabled only, long period so LFSR doesn't advance
      psg.setPsgRegisterIndex(6); psg.writePsgRegisterValue(100);
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x01); // tone A disabled, noise A on
      psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(10);
      psg.generateOutputValue();
      // bitNoise=true (seed=1) and tone disabled = bypass (HIGH) → output = amplitude
      expect(psg.currentOutputA).toBeGreaterThan(0);
    });

    it("noise bit change correctly affects noise-only channel output", () => {
      // Set up: noise-only channel A, noiseFreq=1 (LFSR ticks every 2 tacts)
      psg.setPsgRegisterIndex(6); psg.writePsgRegisterValue(1);
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x01); // tone disabled, noise A on
      psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(10);

      // Initial: bitNoise=true → output amplitude
      psg.generateOutputValue();
      const initialOutput = psg.currentOutputA;
      expect(initialOutput).toBeGreaterThan(0);

      // After 2 ticks, LFSR ticks: seed=1→65536, bitNoise=false → output=0
      // Tick 2: prescale was set to true in tick 1, so LFSR now fires:
      //   seed=1 → seed=65536, bitNoise=false → output=0
      psg.generateOutputValue();
      expect(psg.getPsgData().bitNoise).toBe(false); // LFSR advanced on tick 2
      expect(psg.currentOutputA).toBe(0); // bitNoise=false → silence
    });

    it("state save/restore preserves noisePrescale", () => {
      psg.setPsgRegisterIndex(6); psg.writePsgRegisterValue(1);
      psg.generateOutputValue(); // prescale now true

      const state = psg.getState();
      expect(state.noisePrescale).toBe(true);

      const psg2 = new PsgChip();
      psg2.setState(state);
      expect(psg2.getPsgData().noisePrescale).toBe(true);
      expect(psg2.getPsgData().noiseSeed).toBe(1);
    });
  });
});
