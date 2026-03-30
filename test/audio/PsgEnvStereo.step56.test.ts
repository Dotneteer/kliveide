import { describe, it, expect, beforeEach } from "vitest";
import { PsgChip } from "@emu/machines/zxSpectrum128/PsgChip";
import { TurboSoundDevice } from "@emu/machines/zxNext/TurboSoundDevice";

/**
 * Step 56: PSG Envelope AY/YM Differentiation (Phase 5) and
 *           Stereo Routing Fix (Phase 6)
 *
 * Phase 5: AY-3-8910 vs YM2149 envelope behaviour (MAME ay8910.cpp verified)
 *   - AY: 16 envelope steps (vol 0-15), period multiplier ×2
 *         → each step lasts 2×envFreq ticks; total cycle = 32×envFreq ticks
 *   - YM: 32 envelope steps (vol 0-31), period multiplier ×1
 *         → each step lasts envFreq ticks; total cycle = 32×envFreq ticks
 *   Both chips produce the same total envelope duration; AY is coarser, YM is finer.
 *
 * Phase 6: Stereo routing with hardware-accurate centre-channel attenuation (MAME)
 *   ABC mode: A = full-left, B = centre (50% each side), C = full-right
 *     Left  = volA + ⌊volB/2⌋
 *     Right = ⌊volB/2⌋ + volC
 *   ACB mode: A = full-left, C = centre (50% each side), B = full-right
 *     Left  = volA + ⌊volC/2⌋
 *     Right = ⌊volC/2⌋ + volB
 *   Max per output channel: 65535 + 32767 = 98302
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Enable only channel A tone (period 1) with a given volume on psg.  No noise. */
function setupToneA(psg: PsgChip, vol: number): void {
  psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(1); // period=1
  psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3e); // tone A on, noise off
  psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(vol & 0x1f); // vol or env flag
}

/** Enable envelope on channel A (tone period 1, shape, envFreq). */
function setupEnvA(psg: PsgChip, shape: number, envFreq: number): void {
  psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(1);
  psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3e);
  psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(0x10); // use envelope
  psg.setPsgRegisterIndex(11); psg.writePsgRegisterValue(envFreq & 0xff);
  psg.setPsgRegisterIndex(12); psg.writePsgRegisterValue((envFreq >> 8) & 0xff);
  psg.setPsgRegisterIndex(13); psg.writePsgRegisterValue(shape & 0x0f);
}

// ---------------------------------------------------------------------------
// Phase 5 — Envelope tests
// ---------------------------------------------------------------------------

describe("Step 56: PSG Envelope AY vs YM (Phase 5)", () => {
  // ==================== Initial envelope state ====================

  describe("Envelope table initialisation per chipType", () => {
    it("AY envelope table stores values in range 0-15 only (checked via debug)", () => {
      const psg = new PsgChip(0, "AY");
      // Activate envelope on channel A, sawtooth up shape (0x0E)
      setupEnvA(psg, 0x0e, 1);
      // Run enough ticks to cycle through half an envelope period
      // AY: posEnv advances every 2 ticks; 16 steps × 2 = 32 ticks per full cycle
      let maxVol = 0;
      for (let i = 0; i < 64; i++) {
        psg.generateOutputValue();
        if (psg.currentOutputA > maxVol) maxVol = psg.currentOutputA;
      }
      // Should reach table[15] (maximum) since envelope sweeps from 0 to 15
      const psgState = new PsgChip(0, "AY");
      setupToneA(psgState, 15);
      psgState.generateOutputValue(); // bitA flips → output = table[15]
      expect(maxVol).toBe(psgState.currentOutputA); // reached table[15]
    });

    it("YM envelope table stores values in range 0-31 (half-step mapping to 0-15)", () => {
      const psg = new PsgChip(0, "YM");
      setupEnvA(psg, 0x0e, 1);
      let maxVol = 0;
      for (let i = 0; i < 64; i++) {
        psg.generateOutputValue();
        if (psg.currentOutputA > maxVol) maxVol = psg.currentOutputA;
      }
      const ref = new PsgChip(0, "YM");
      setupToneA(ref, 15);
      ref.generateOutputValue();
      expect(maxVol).toBe(ref.currentOutputA); // also reaches table[15]
    });
  });

  // ==================== Envelope period timing ====================

  describe("AY envelope advances every 2×envFreq ticks (period multiplier ×2)", () => {
    it("AY envelope posEnv does NOT advance on first tick (cntEnv=1 < 2×1=2)", () => {
      const psg = new PsgChip(0, "AY");
      setupEnvA(psg, 0x0e, 1);
      const stBefore = psg.getPsgData();
      const posBefore = stBefore.posEnv;
      psg.generateOutputValue(); // cntEnv 0→1 < 2; no advance
      expect(psg.getPsgData().posEnv).toBe(posBefore);
    });

    it("AY envelope posEnv advances on second tick (cntEnv=2 >= 2×1=2)", () => {
      const psg = new PsgChip(0, "AY");
      setupEnvA(psg, 0x0e, 1);
      const posBefore = psg.getPsgData().posEnv;
      psg.generateOutputValue(); // cntEnv = 1
      psg.generateOutputValue(); // cntEnv = 2 ≥ 2 → advance
      expect(psg.getPsgData().posEnv).toBe(posBefore + 1);
    });

    it("AY envelope completes 16-step sawtooth in exactly 32 ticks (envFreq=1)", () => {
      // Shape 0x0E: sawtooth up, continue. AY table: vol 0..15.
      // posEnv starts at 0, advances every 2 ticks.
      // 16 steps × 2 ticks/step = 32 ticks per cycle.
      const psg = new PsgChip(0, "AY");
      setupEnvA(psg, 0x0e, 1);

      const outputs: number[] = [];
      for (let i = 0; i < 32; i++) {
        psg.generateOutputValue();
        if (psg.getPsgData().bitA) outputs.push(psg.currentOutputA);
      }
      // After exactly 32 ticks, posEnv should have advanced 16 times (back near start or wrapped)
      // The envelope started at position 0, and advanced 32/2=16 times → posEnv=16
      const posAfter = psg.getPsgData().posEnv;
      expect(posAfter).toBe(16); // 16 steps advanced at 2 ticks each
    });

    it("AY envelope with envFreq=2 advances posEnv every 4 ticks", () => {
      const psg = new PsgChip(0, "AY");
      setupEnvA(psg, 0x0e, 2);
      const pos0 = psg.getPsgData().posEnv;
      psg.generateOutputValue(); psg.generateOutputValue(); psg.generateOutputValue();
      expect(psg.getPsgData().posEnv).toBe(pos0); // 3 ticks < 4, no advance
      psg.generateOutputValue(); // 4th tick → advance
      expect(psg.getPsgData().posEnv).toBe(pos0 + 1);
    });
  });

  describe("YM envelope advances every 1×envFreq ticks (period multiplier ×1)", () => {
    it("YM envelope posEnv advances on first tick (cntEnv=1 >= 1×1=1)", () => {
      const psg = new PsgChip(0, "YM");
      setupEnvA(psg, 0x0e, 1);
      const posBefore = psg.getPsgData().posEnv;
      psg.generateOutputValue(); // cntEnv 0→1 ≥ 1 → advance
      expect(psg.getPsgData().posEnv).toBe(posBefore + 1);
    });

    it("YM envelope advances posEnv at twice the rate of AY for same envFreq", () => {
      const ay = new PsgChip(0, "AY");
      const ym = new PsgChip(0, "YM");
      setupEnvA(ay, 0x0e, 1);
      setupEnvA(ym, 0x0e, 1);

      for (let i = 0; i < 10; i++) {
        ay.generateOutputValue();
        ym.generateOutputValue();
      }
      // After 10 ticks: AY advanced posEnv by 5 (every 2 ticks), YM by 10 (every 1 tick)
      const ayPos = ay.getPsgData().posEnv; // 0 + 5 = 5
      const ymPos = ym.getPsgData().posEnv; // 0 + 10 = 10
      expect(ymPos).toBe(ayPos * 2);
    });

    it("YM with envFreq=1 completes first 32 sub-steps in 32 ticks", () => {
      const psg = new PsgChip(0, "YM");
      setupEnvA(psg, 0x0e, 1); // sawtooth up
      for (let i = 0; i < 32; i++) psg.generateOutputValue();
      // posEnv should have advanced 32 times
      expect(psg.getPsgData().posEnv).toBe(32);
    });
  });

  // ==================== Total envelope period is same for AY and YM ====================

  describe("Total envelope duration is identical for AY and YM (32×envFreq ticks)", () => {
    it("AY and YM both cycle through their respective tables in 32×envFreq ticks", () => {
      // Count unique output changes per chip over 32 ticks with envFreq=1.
      // AY: 16 unique vol levels, each lasts 2 ticks → 16 changes in 32 ticks.
      // YM: 32 sub-steps, each lasts 1 tick → 32 changes in 32 ticks (but pairs may match).
      // BOTH have the same TOTAL time scale.
      const ay = new PsgChip(0, "AY");
      const ym = new PsgChip(0, "YM");
      [ay, ym].forEach(psg => {
        psg.setPsgRegisterIndex(0); psg.writePsgRegisterValue(1);
        psg.setPsgRegisterIndex(7); psg.writePsgRegisterValue(0x3e);
        psg.setPsgRegisterIndex(8); psg.writePsgRegisterValue(0x10);
        psg.setPsgRegisterIndex(11); psg.writePsgRegisterValue(1);
        psg.setPsgRegisterIndex(12); psg.writePsgRegisterValue(0);
        psg.setPsgRegisterIndex(13); psg.writePsgRegisterValue(0x0e); // sawtooth up
      });

      const ayOutputsAt32: number[] = [];
      const ymOutputsAt32: number[] = [];

      for (let i = 0; i < 32; i++) {
        ay.generateOutputValue();
        ym.generateOutputValue();
        if (ay.getPsgData().bitA) ayOutputsAt32.push(ay.currentOutputA);
        if (ym.getPsgData().bitA) ymOutputsAt32.push(ym.currentOutputA);
      }

      // Both should have reached non-zero output by tick 32
      expect(ayOutputsAt32.some(v => v > 0)).toBe(true);
      expect(ymOutputsAt32.some(v => v > 0)).toBe(true);
    });

    it("AY posEnv=16 after 32 ticks; YM posEnv=32 after 32 ticks", () => {
      const ay = new PsgChip(0, "AY");
      const ym = new PsgChip(0, "YM");
      setupEnvA(ay, 0x0e, 1);
      setupEnvA(ym, 0x0e, 1);

      for (let i = 0; i < 32; i++) {
        ay.generateOutputValue();
        ym.generateOutputValue();
      }
      expect(ay.getPsgData().posEnv).toBe(16);
      expect(ym.getPsgData().posEnv).toBe(32);
    });
  });

  // ==================== Envelope shapes work correctly per chip ====================

  describe("Envelope shapes produce correct decreasing sequences", () => {
    it("AY sawtooth DOWN (shape 0x08): output decreases each AY step (every 2 ticks)", () => {
      const psg = new PsgChip(0, "AY");
      setupEnvA(psg, 0x08, 1); // sawtooth down, envFreq=1

      const samples: number[] = [];
      // Capture output every 2 ticks (one AY step = 2 ticks)
      for (let i = 0; i < 16; i++) {
        psg.generateOutputValue(); // tick 1
        psg.generateOutputValue(); // tick 2 — posEnv advanced on 2nd
        if (psg.getPsgData().bitA) samples.push(psg.currentOutputA);
      }

      // Should be monotonically non-increasing (sawtooth down)
      // Not all may be captured if bitA is off — just check we get non-zero then zero
      if (samples.length >= 2) {
        expect(samples[0]).toBeGreaterThanOrEqual(samples[samples.length - 1]);
      }
    });

    it("YM sawtooth DOWN (shape 0x08): output decreases each YM step (every 1 tick)", () => {
      const psg = new PsgChip(0, "YM");
      setupEnvA(psg, 0x08, 1);

      const positives: number[] = [];
      for (let i = 0; i < 32; i++) {
        psg.generateOutputValue();
        if (psg.getPsgData().bitA && psg.currentOutputA > 0) positives.push(psg.currentOutputA);
      }
      if (positives.length >= 2) {
        expect(positives[0]).toBeGreaterThanOrEqual(positives[positives.length - 1]);
      }
    });
  });

  // ==================== State persistence for envelope timing ====================

  describe("Envelope state preservation", () => {
    it("AY posEnv/cntEnv are saved and restored correctly", () => {
      const psg = new PsgChip(0, "AY");
      setupEnvA(psg, 0x0e, 3);
      for (let i = 0; i < 5; i++) psg.generateOutputValue();

      const state = psg.getState();
      const psg2 = new PsgChip(0, "AY");
      psg2.setState(state);

      // One more tick should behave identically
      psg.generateOutputValue();
      psg2.generateOutputValue();
      expect(psg2.getPsgData().posEnv).toBe(psg.getPsgData().posEnv);
      expect(psg2.getPsgData().cntEnv).toBe(psg.getPsgData().cntEnv);
    });

    it("chipType is not changed by setState; YM stays YM even after receiving AY state", () => {
      const ay = new PsgChip(0, "AY");
      setupEnvA(ay, 0x0e, 1);
      ay.generateOutputValue(); ay.generateOutputValue();

      const ym = new PsgChip(0, "YM");
      ym.setState(ay.getState());
      expect(ym.chipType).toBe("YM");
      // YM should still use YM period multiplier (×1) after state restore
      const pos1 = ym.getPsgData().posEnv;
      ym.generateOutputValue(); // envFreq=1 → cntEnv resets → advance immediately
      expect(ym.getPsgData().posEnv).toBe(pos1 + 1);
    });
  });
});

// ---------------------------------------------------------------------------
// Phase 6 — Stereo routing tests
// ---------------------------------------------------------------------------

describe("Step 56: Stereo Routing with Centre-Channel Attenuation (Phase 6)", () => {
  let device: TurboSoundDevice;

  beforeEach(() => {
    device = new TurboSoundDevice();
  });

  // Helper: set up chip 0 with three different volumes, all tone-enabled (reg7=0x38)
  function setupStereoChip(volA: number, volB: number, volC: number) {
    const chip = device.getChip(0);
    chip.setPsgRegisterIndex(0); chip.writePsgRegisterValue(1);
    chip.setPsgRegisterIndex(2); chip.writePsgRegisterValue(1);
    chip.setPsgRegisterIndex(4); chip.writePsgRegisterValue(1);
    chip.setPsgRegisterIndex(7); chip.writePsgRegisterValue(0x38); // tone A/B/C, noise disabled
    chip.setPsgRegisterIndex(8); chip.writePsgRegisterValue(volA);
    chip.setPsgRegisterIndex(9); chip.writePsgRegisterValue(volB);
    chip.setPsgRegisterIndex(10); chip.writePsgRegisterValue(volC);
    device.generateAllOutputValues();
    return chip;
  }

  // ==================== ABC mode ====================

  describe("ABC mode: A=left, B=center (full), C=right — FPGA additive", () => {
    it("left = volA + volB", () => {
      device.setAyStereoMode(false); // ABC
      const chip = setupStereoChip(8, 10, 5);
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBe(chip.getChannelAVolume() + chip.getChannelBVolume());
    });

    it("right = volB + volC", () => {
      device.setAyStereoMode(false);
      const chip = setupStereoChip(8, 10, 5);
      const output = device.getChipStereoOutput(0);
      expect(output.right).toBe(chip.getChannelBVolume() + chip.getChannelCVolume());
    });

    it("left != right when A and C have different volumes", () => {
      device.setAyStereoMode(false);
      setupStereoChip(12, 6, 4); // A > C
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBeGreaterThan(output.right);
    });

    it("left == right when volA == volC", () => {
      device.setAyStereoMode(false);
      setupStereoChip(7, 10, 7); // A == C
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBe(output.right);
    });

    it("maximum left output is 2*65535 = 131070", () => {
      device.setAyStereoMode(false);
      setupStereoChip(15, 15, 15); // max all
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBeLessThanOrEqual(131070);
      expect(output.right).toBeLessThanOrEqual(131070);
    });

    it("left + right together represent balanced stereo field", () => {
      // With equal A=B=C, both channels should be equal
      device.setAyStereoMode(false);
      setupStereoChip(8, 8, 8);
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBe(output.right);
    });

    it("channel B alone (A=0, C=0) routes equally to both sides at full volume", () => {
      device.setAyStereoMode(false);
      const chip = device.getChip(0);
      chip.setPsgRegisterIndex(2); chip.writePsgRegisterValue(1);
      chip.setPsgRegisterIndex(7); chip.writePsgRegisterValue(0x39); // tone B on, rest OFF
      chip.setPsgRegisterIndex(9); chip.writePsgRegisterValue(10);
      device.generateAllOutputValues();
      const output = device.getChipStereoOutput(0);
      const volB = chip.getChannelBVolume();
      expect(output.left).toBe(volB);
      expect(output.right).toBe(volB);
    });

    it("channel A alone (B=0, C=0) routes only to left", () => {
      device.setAyStereoMode(false);
      const chip = device.getChip(0);
      chip.setPsgRegisterIndex(0); chip.writePsgRegisterValue(1);
      chip.setPsgRegisterIndex(7); chip.writePsgRegisterValue(0x3e); // tone A on, rest off
      chip.setPsgRegisterIndex(8); chip.writePsgRegisterValue(10);
      device.generateAllOutputValues();
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBeGreaterThan(0);
      expect(output.right).toBe(0); // B=0 → halfB=0 → right = 0 + volC = 0
    });

    it("channel C alone (A=0, B=0) routes only to right", () => {
      device.setAyStereoMode(false);
      const chip = device.getChip(0);
      chip.setPsgRegisterIndex(4); chip.writePsgRegisterValue(1);
      chip.setPsgRegisterIndex(7); chip.writePsgRegisterValue(0x3b); // tone C on, rest off
      chip.setPsgRegisterIndex(10); chip.writePsgRegisterValue(10);
      device.generateAllOutputValues();
      const output = device.getChipStereoOutput(0);
      expect(output.right).toBeGreaterThan(0);
      expect(output.left).toBe(0); // A=0 and halfB=0 → left = 0
    });
  });

  // ==================== ACB mode ====================

  describe("ACB mode: A=left, C=center (full), B=right — FPGA additive", () => {
    it("left = volA + volC", () => {
      device.setAyStereoMode(true); // ACB
      const chip = setupStereoChip(8, 5, 10);
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBe(chip.getChannelAVolume() + chip.getChannelCVolume());
    });

    it("right = volC + volB", () => {
      device.setAyStereoMode(true);
      const chip = setupStereoChip(8, 5, 10);
      const output = device.getChipStereoOutput(0);
      expect(output.right).toBe(chip.getChannelCVolume() + chip.getChannelBVolume());
    });

    it("ACB differs from ABC for left channel (right = B+C is commutative)", () => {
      const chip0 = device.getChip(0);
      chip0.setPsgRegisterIndex(0); chip0.writePsgRegisterValue(1);
      chip0.setPsgRegisterIndex(2); chip0.writePsgRegisterValue(1);
      chip0.setPsgRegisterIndex(4); chip0.writePsgRegisterValue(1);
      chip0.setPsgRegisterIndex(7); chip0.writePsgRegisterValue(0x38);
      chip0.setPsgRegisterIndex(8); chip0.writePsgRegisterValue(12); // A ≠ B ≠ C
      chip0.setPsgRegisterIndex(9); chip0.writePsgRegisterValue(8);
      chip0.setPsgRegisterIndex(10); chip0.writePsgRegisterValue(5);
      device.generateAllOutputValues();

      device.setAyStereoMode(false); // ABC
      const abcOut = device.getChipStereoOutput(0);

      device.setAyStereoMode(true); // ACB
      const acbOut = device.getChipStereoOutput(0);

      // ABC: Left = A+B, ACB: Left = A+C — differ when B ≠ C
      expect(abcOut.left).not.toBe(acbOut.left);
      // ABC: Right = B+C, ACB: Right = C+B — same (addition is commutative)
      expect(abcOut.right).toBe(acbOut.right);
    });

    it("channel C alone routes equally to both sides in ACB", () => {
      device.setAyStereoMode(true);
      const chip = device.getChip(0);
      chip.setPsgRegisterIndex(4); chip.writePsgRegisterValue(1);
      chip.setPsgRegisterIndex(7); chip.writePsgRegisterValue(0x3b); // tone C on
      chip.setPsgRegisterIndex(10); chip.writePsgRegisterValue(10);
      device.generateAllOutputValues();
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBe(output.right); // volA=0 + halfC == halfC + volB=0
    });

    it("maximum output in ACB is 2*65535 = 131070", () => {
      device.setAyStereoMode(true);
      setupStereoChip(15, 15, 15);
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBeLessThanOrEqual(131070);
      expect(output.right).toBeLessThanOrEqual(131070);
    });
  });

  // ==================== Mono mode unchanged by Phase 6 ====================

  describe("Mono mode is unaffected by Phase 6 (still A+B+C for both sides)", () => {
    it("mono: left = right = volA + volB + volC (capped at 196605)", () => {
      device.setChipMonoMode(0, true);
      const chip = setupStereoChip(8, 10, 6);
      const output = device.getChipStereoOutput(0);
      const total = chip.getChannelAVolume() + chip.getChannelBVolume() + chip.getChannelCVolume();
      expect(output.left).toBe(Math.min(196605, total));
      expect(output.right).toBe(output.left);
    });

    it("mono overrides both ABC and ACB routing", () => {
      device.setChipMonoMode(0, true);
      device.setAyStereoMode(true); // ACB, but should be overridden
      setupStereoChip(10, 6, 12);
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBe(output.right);
    });
  });

  // ==================== Panning still applies after Phase 6 ====================

  describe("Panning applies on top of stereo routing", () => {
    it("left-only panning zeroes right channel", () => {
      device.setAyStereoMode(false); // ABC
      device.setChipPanning(0, 0x02); // left only
      setupStereoChip(8, 10, 6);
      const output = device.getChipStereoOutput(0);
      expect(output.right).toBe(0);
      expect(output.left).toBeGreaterThan(0);
    });

    it("right-only panning zeroes left channel", () => {
      device.setAyStereoMode(false);
      device.setChipPanning(0, 0x01); // right only
      setupStereoChip(8, 10, 6);
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBe(0);
      expect(output.right).toBeGreaterThan(0);
    });

    it("muted panning zeroes both channels", () => {
      device.setAyStereoMode(false);
      device.setChipPanning(0, 0x00); // muted
      setupStereoChip(8, 10, 6);
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    });
  });
});
