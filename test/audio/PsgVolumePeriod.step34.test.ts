import { describe, it, expect, beforeEach } from "vitest";
import { PsgChip } from "@emu/machines/zxSpectrum128/PsgChip";

/**
 * Step 34: PSG Volume Table / DAC Curve (Phase 3) and Tone Period-0 Handling (Phase 4) Tests
 *
 * Phase 3: Separate hardware-accurate volume tables for AY-3-8910 and YM2149
 *   - AY table: from real-chip measurements on AY-3-8910 (Spectrum 128K)
 *   - YM table: from YM2149 resistor model (ZX Next / TurboSound)
 *   - Tables differ in shape; maximum is always 65535 for both
 *   - Default chipType is 'AY'
 *
 * Phase 4: Tone period 0 treated as period 1 (highest possible frequency)
 *   - MAME: `const int period = std::max<int>(1, tone->period);`
 *   - Old Klive: `if (this._toneA)` guard — period 0 produced silence
 *   - With period 0, the tone bit should toggle every single sample tick
 */
describe("Step 34: PSG chipType and Volume Tables (Phase 3)", () => {
  // ------- Known table values for sanity checks -------
  // AY-3-8910 table (phase 3 specification)
  const AY_TABLE = [
    0, 836, 1212, 1773, 2619, 3875, 5765, 8589,
    10207, 17157, 24956, 32768, 43520, 55424, 65120, 65535
  ];
  // YM2149 table (phase 3 specification)
  const YM_TABLE = [
    0, 0, 1057, 1521, 2130, 2987, 4119, 5765,
    7783, 10207, 13311, 17157, 23420, 32768, 43520, 65535
  ];

  // Helper: enable only tone A (no noise), then read instantaneous amplitude
  function amplitudeAt(psg: PsgChip, vol: number): number {
    psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(1); // period=1
    psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3e); // tone A on, others off
    psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(vol);
    psg.generateOutputValue(); // bit flips to true → amplitude emitted
    return psg.currentOutputA;
  }

  // ==================== chipType property ====================

  describe("chipType property", () => {
    it("default chipType is 'AY'", () => {
      const psg = new PsgChip();
      expect(psg.chipType).toBe("AY");
    });

    it("chipType 'AY' is returned when explicitly specified", () => {
      const psg = new PsgChip(0, "AY");
      expect(psg.chipType).toBe("AY");
    });

    it("chipType 'YM' is returned when specified", () => {
      const psg = new PsgChip(0, "YM");
      expect(psg.chipType).toBe("YM");
    });

    it("chipId and chipType are independent", () => {
      const psg = new PsgChip(2, "YM");
      expect(psg.chipId).toBe(2);
      expect(psg.chipType).toBe("YM");
    });

    it("chipType is visible in debug info", () => {
      const ay = new PsgChip(0, "AY");
      const ym = new PsgChip(1, "YM");
      expect(ay.getDebugInfo().chipType).toBe("AY");
      expect(ym.getDebugInfo().chipType).toBe("YM");
    });
  });

  // ==================== AY volume table values ====================

  describe("AY-3-8910 volume table (chipType='AY')", () => {
    let psg: PsgChip;

    beforeEach(() => {
      psg = new PsgChip(0, "AY");
    });

    it("volume 0 produces zero output", () => {
      expect(amplitudeAt(psg, 0)).toBe(0);
    });

    it("volume 15 produces maximum output (65535)", () => {
      expect(amplitudeAt(psg, 15)).toBe(65535);
    });

    it("matches AY table for all 16 volume levels", () => {
      for (let v = 0; v < 16; v++) {
        const psgLocal = new PsgChip(0, "AY");
        expect(amplitudeAt(psgLocal, v)).toBe(AY_TABLE[v]);
      }
    });

    it("volume curve is monotonically non-decreasing", () => {
      for (let v = 1; v < 16; v++) {
        const psgLocal = new PsgChip(0, "AY");
        const a = amplitudeAt(new PsgChip(0, "AY"), v - 1);
        const b = amplitudeAt(psgLocal, v);
        expect(b).toBeGreaterThanOrEqual(a);
      }
    });

    it("AY curve is exponential-like (mid-volume < 50% of max)", () => {
      // Level 7 (index 7) should be well below half of 65535
      const midAmp = amplitudeAt(new PsgChip(0, "AY"), 7);
      expect(midAmp).toBeLessThan(65535 / 2);
    });
  });

  // ==================== YM volume table values ====================

  describe("YM2149 volume table (chipType='YM')", () => {
    let psg: PsgChip;

    beforeEach(() => {
      psg = new PsgChip(0, "YM");
    });

    it("volume 0 produces zero output", () => {
      expect(amplitudeAt(psg, 0)).toBe(0);
    });

    it("volume 15 produces maximum output (65535)", () => {
      expect(amplitudeAt(psg, 15)).toBe(65535);
    });

    it("matches YM table for all 16 volume levels", () => {
      for (let v = 0; v < 16; v++) {
        const psgLocal = new PsgChip(0, "YM");
        expect(amplitudeAt(psgLocal, v)).toBe(YM_TABLE[v]);
      }
    });

    it("volume curve is monotonically non-decreasing", () => {
      for (let v = 1; v < 16; v++) {
        const a = amplitudeAt(new PsgChip(0, "YM"), v - 1);
        const b = amplitudeAt(new PsgChip(0, "YM"), v);
        expect(b).toBeGreaterThanOrEqual(a);
      }
    });

    it("YM vol 1 equals AY vol 0 (YM steps 0-1 are both 0)", () => {
      // YM table[0]=0, table[1]=0 — first two levels identical
      const ym0 = amplitudeAt(new PsgChip(0, "YM"), 0);
      const ym1 = amplitudeAt(new PsgChip(0, "YM"), 1);
      expect(ym0).toBe(0);
      expect(ym1).toBe(0);
    });
  });

  // ==================== AY vs YM differ in the middle ====================

  describe("AY and YM tables differ in mid-range", () => {
    it("AY vol 5 differs from YM vol 5", () => {
      const ay = amplitudeAt(new PsgChip(0, "AY"), 5);
      const ym = amplitudeAt(new PsgChip(0, "YM"), 5);
      expect(ay).not.toBe(ym);
      expect(ay).toBe(AY_TABLE[5]); // 3875
      expect(ym).toBe(YM_TABLE[5]); // 2987
    });

    it("both produce 65535 at maximum volume", () => {
      const ay = amplitudeAt(new PsgChip(0, "AY"), 15);
      const ym = amplitudeAt(new PsgChip(0, "YM"), 15);
      expect(ay).toBe(65535);
      expect(ym).toBe(65535);
    });

    it("AY is louder than YM at mid-range (AY table shifted higher)", () => {
      // AY table is generally brighter in midrange  
      for (let v = 2; v < 14; v++) {
        const ay = AY_TABLE[v];
        const ym = YM_TABLE[v];
        expect(ay).toBeGreaterThan(ym);
      }
    });
  });

  // ==================== Volume table used by both-disabled mode ====================

  describe("Volume table applies to both-disabled (DC amplitude) mode", () => {
    it("AY both-disabled at vol=10 outputs correct AY table value", () => {
      const psg = new PsgChip(0, "AY");
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3f); // both disabled
      psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(10);
      psg.generateOutputValue();
      expect(psg.currentOutputA).toBe(AY_TABLE[10]); // 24956
    });

    it("YM both-disabled at vol=10 outputs correct YM table value", () => {
      const psg = new PsgChip(0, "YM");
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3f);
      psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(10);
      psg.generateOutputValue();
      expect(psg.currentOutputA).toBe(YM_TABLE[10]); // 13311
    });
  });

  // ==================== getChannelXVolume uses chipType table ====================

  describe("getChannelXVolume uses chipType-selected table", () => {
    it("AY getChannelAVolume returns AY table value", () => {
      const psg = new PsgChip(0, "AY");
      psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(1);
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3e);
      psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(8);
      psg.generateOutputValue();
      expect(psg.getChannelAVolume()).toBe(AY_TABLE[8]); // 10207
    });

    it("YM getChannelAVolume returns YM table value", () => {
      const psg = new PsgChip(0, "YM");
      psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(1);
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3e);
      psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(8);
      psg.generateOutputValue();
      expect(psg.getChannelAVolume()).toBe(YM_TABLE[8]); // 7783
    });

    it("YM getChannelBVolume returns YM table value", () => {
      const psg = new PsgChip(0, "YM");
      psg.setPsgRegisterIndex(2); psg.writePsgRegisterValue(1);
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3d); // tone B on
      psg.setPsgRegisterIndex(9); psg.writePsgRegisterValue(6);
      psg.generateOutputValue();
      expect(psg.getChannelBVolume()).toBe(YM_TABLE[6]); // 4119
    });

    it("YM getChannelCVolume returns YM table value", () => {
      const psg = new PsgChip(0, "YM");
      psg.setPsgRegisterIndex(4); psg.writePsgRegisterValue(1);
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3b); // tone C on
      psg.setPsgRegisterIndex(10); psg.writePsgRegisterValue(12);
      psg.generateOutputValue();
      expect(psg.getChannelCVolume()).toBe(YM_TABLE[12]); // 23420
    });
  });

  // ==================== chipType preserved across reset() ====================

  describe("chipType is preserved across reset()", () => {
    it("YM chip stays YM after reset", () => {
      const psg = new PsgChip(0, "YM");
      psg.reset();
      expect(psg.chipType).toBe("YM");
      // Volume table still YM
      const vol8 = amplitudeAt(psg, 8);
      expect(vol8).toBe(YM_TABLE[8]);
    });

    it("AY chip stays AY after reset", () => {
      const psg = new PsgChip(0, "AY");
      psg.reset();
      expect(psg.chipType).toBe("AY");
      const vol8 = amplitudeAt(psg, 8);
      expect(vol8).toBe(AY_TABLE[8]);
    });
  });

  // ==================== chipType consistency via getState/setState ====================

  describe("chipType not in persisted state (it is constructor config)", () => {
    it("setState does not change chipType; YM chip stays YM after setState", () => {
      const src = new PsgChip(0, "AY");
      src.setPsgRegisterIndex(8); src.writePsgRegisterValue(10);
      const state = src.getState();

      // Apply AY state to YM chip
      const dest = new PsgChip(0, "YM");
      dest.setState(state);

      // chipType unchanged — still YM
      expect(dest.chipType).toBe("YM");
      // Volume for level 10 should be YM value, not AY value
      dest.setPsgRegisterIndex(7); dest.writePsgRegisterValue(0x3f);
      dest.generateOutputValue();
      expect(dest.currentOutputA).toBe(YM_TABLE[10]);
    });
  });
});

// =============================================================================

describe("Step 34: Tone Period-0 Handling (Phase 4)", () => {
  // ==================== Period 0 produces highest frequency ====================

  describe("Period 0 acts as period 1 (highest frequency)", () => {
    it("channel A with period 0 toggles bit every tick", () => {
      const psg = new PsgChip();
      psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(0); // period A = 0
      psg.setPsgRegisterIndex(1); psg.writePsgRegisterValue(0);
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3e); // tone A on
      psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(8);

      // Initial bitA = false → output = 0
      psg.generateOutputValue();
      // After 1 tick with period=1, bitA should flip to true → output > 0
      expect(psg.currentOutputA).toBeGreaterThan(0);

      psg.generateOutputValue(); // bitA → false → 0
      expect(psg.currentOutputA).toBe(0);

      psg.generateOutputValue(); // bitA → true → > 0
      expect(psg.currentOutputA).toBeGreaterThan(0);
    });

    it("channel B with period 0 toggles bit every tick", () => {
      const psg = new PsgChip();
      psg.setPsgRegisterIndex(2); psg.writePsgRegisterValue(0);
      psg.setPsgRegisterIndex(3); psg.writePsgRegisterValue(0);
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3d); // tone B on
      psg.setPsgRegisterIndex(9); psg.writePsgRegisterValue(8);

      psg.generateOutputValue();
      expect(psg.currentOutputB).toBeGreaterThan(0);

      psg.generateOutputValue();
      expect(psg.currentOutputB).toBe(0);
    });

    it("channel C with period 0 toggles bit every tick", () => {
      const psg = new PsgChip();
      psg.setPsgRegisterIndex(4); psg.writePsgRegisterValue(0);
      psg.setPsgRegisterIndex(5); psg.writePsgRegisterValue(0);
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3b); // tone C on
      psg.setPsgRegisterIndex(10); psg.writePsgRegisterValue(8);

      psg.generateOutputValue();
      expect(psg.currentOutputC).toBeGreaterThan(0);

      psg.generateOutputValue();
      expect(psg.currentOutputC).toBe(0);
    });

    it("period 0 produces same toggle rate as period 1", () => {
      const psgZero = new PsgChip();
      psgZero.setPsgRegisterIndex(0); psgZero.writePsgRegisterValue(0);
      psgZero.setPsgRegisterIndex(7); psgZero.writePsgRegisterValue(0x3e);
      psgZero.setPsgRegisterIndex(8); psgZero.writePsgRegisterValue(8);

      const psgOne = new PsgChip();
      psgOne.setPsgRegisterIndex(0); psgOne.writePsgRegisterValue(1);
      psgOne.setPsgRegisterIndex(7); psgOne.writePsgRegisterValue(0x3e);
      psgOne.setPsgRegisterIndex(8); psgOne.writePsgRegisterValue(8);

      // Both should produce identical output patterns
      for (let i = 0; i < 10; i++) {
        psgZero.generateOutputValue();
        psgOne.generateOutputValue();
        expect(psgZero.currentOutputA).toBe(psgOne.currentOutputA);
      }
    });

    it("period 0 does NOT produce silence (old behaviour was silent)", () => {
      const psg = new PsgChip();
      psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(0);
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3e);
      psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(8);

      let nonZeroCount = 0;
      for (let i = 0; i < 20; i++) {
        psg.generateOutputValue();
        if (psg.currentOutputA > 0) nonZeroCount++;
      }
      // With period=1 and 20 ticks, ~10 should be non-zero (toggling at each tick)
      expect(nonZeroCount).toBeGreaterThan(0);
    });

    it("period 2 does NOT toggle every tick", () => {
      const psg = new PsgChip();
      psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(2);
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3e);
      psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(8);

      // Tick 1: cnt=1 < 2, bitA stays false → 0
      psg.generateOutputValue();
      expect(psg.currentOutputA).toBe(0);

      // Tick 2: cnt=2 ≥ 2, bitA flips → true → > 0
      psg.generateOutputValue();
      expect(psg.currentOutputA).toBeGreaterThan(0);
    });
  });

  // ==================== Period-0 state check ====================

  describe("Period 0 counter state", () => {
    it("counter resets to 0 every tick when period=0", () => {
      const psg = new PsgChip();
      psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(0);
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3e);
      psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(5);

      psg.generateOutputValue();
      const state = psg.getPsgData();
      // Counter should have reset to 0 (since periodA=1, cntA increments to 1 then resets)
      expect(state.cntA).toBe(0);
    });

    it("bitA alternates on period 0", () => {
      const psg = new PsgChip();
      psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(0);
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3e);
      psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(5);

      const bits: boolean[] = [];
      for (let i = 0; i < 6; i++) {
        psg.generateOutputValue();
        bits.push(psg.getPsgData().bitA);
      }
      // Should alternate: true, false, true, false, ...
      expect(bits[0]).toBe(true);
      expect(bits[1]).toBe(false);
      expect(bits[2]).toBe(true);
      expect(bits[3]).toBe(false);
      expect(bits[4]).toBe(true);
      expect(bits[5]).toBe(false);
    });
  });

  // ==================== Period 0 with envelope ====================

  describe("Period 0 with envelope-driven volume", () => {
    it("envelope volume is applied with period-0 tone", () => {
      const psg = new PsgChip();
      psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(0); // period 0
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3e); // tone A on
      psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(0x10); // use envelope
      psg.setPsgRegisterIndex(11); psg.writePsgRegisterValue(1);   // env freq
      psg.setPsgRegisterIndex(13); psg.writePsgRegisterValue(0x08); // sawtooth up

      // After first tick bitA should flip → tone is HIGH → envelope amplitude emitted
      psg.generateOutputValue();
      expect(psg.currentOutputA).toBeGreaterThan(0);
    });
  });

  // ==================== Interaction: period 0 + noise ====================

  describe("Period 0 tone with noise (AND logic)", () => {
    it("period-0 tone AND noise behaves like AND gate", () => {
      const psg = new PsgChip();
      psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(0); // tone period 0
      psg.setPsgRegisterIndex(6); psg.writePsgRegisterValue(100); // noise period large
      psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x00); // both enabled
      psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(8);

      // Initial: bitA=false, bitNoise=true (seed=1)
      // Tick 1: bitA flips → true; bitNoise=true → AND → amplitude
      psg.generateOutputValue();
      expect(psg.currentOutputA).toBeGreaterThan(0);

      // Tick 2: bitA flips → false; bitNoise=true → AND → 0
      psg.generateOutputValue();
      expect(psg.currentOutputA).toBe(0);
    });
  });
});
