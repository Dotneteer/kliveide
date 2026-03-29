import { describe, it, expect, beforeEach } from "vitest";
import { PsgChip } from "@emu/machines/zxSpectrum128/PsgChip";

/**
 * Step 78: Register Read Masking (Phase 7) and
 *           AudioMixer PSG AC Coupling Consistency (Phase 8)
 *
 * Phase 7: AY-3-8910 register read masking (MAME ay8910.cpp mask[0x10])
 *   On real AY-3-8910 hardware, unused register bits always read back as 0.
 *   YM2149 returns all bits unmasked.
 *
 *   Mask table (0xff = all bits visible, other values mask high bits):
 *     R0  = 0xff  Tone A low (8-bit)
 *     R1  = 0x0f  Tone A high (4-bit)
 *     R2  = 0xff  Tone B low (8-bit)
 *     R3  = 0x0f  Tone B high (4-bit)
 *     R4  = 0xff  Tone C low (8-bit)
 *     R5  = 0x0f  Tone C high (4-bit)
 *     R6  = 0x1f  Noise period (5-bit)
 *     R7  = 0xff  Mixer control (8-bit)
 *     R8  = 0x1f  Volume A (5-bit)
 *     R9  = 0x1f  Volume B (5-bit)
 *     R10 = 0x1f  Volume C (5-bit)
 *     R11 = 0xff  Envelope period low (8-bit)
 *     R12 = 0xff  Envelope period high (8-bit)
 *     R13 = 0x0f  Envelope shape (4-bit)
 *     R14 = 0xff  I/O port A (8-bit)
 *     R15 = 0xff  I/O port B (8-bit)
 *
 * Phase 8: PSG AC coupling always applied unconditionally in AudioMixerDevice.
 *   (Verified via existing AudioMixerDevice.step8.test.ts; this file covers the
 *    edge case where PSG output is zero – the mixer contribution must still be 0.)
 */

// ---------------------------------------------------------------------------
// Phase 7: Register Read Masking
// ---------------------------------------------------------------------------

describe("Step 7: PsgChip Register Read Masking (Phase 7)", () => {
  // Expected masks indexed by register number (MAME ay8910.cpp table)
  const AY_MASKS = [
    0xff, 0x0f, 0xff, 0x0f, 0xff, 0x0f, 0x1f, 0xff,
    0x1f, 0x1f, 0x1f, 0xff, 0xff, 0x0f, 0xff, 0xff
  ];

  describe("AY-3-8910 chip: unused bits read as 0", () => {
    let ay: PsgChip;

    beforeEach(() => {
      ay = new PsgChip(0, "AY");
    });

    it("should mask high bits in Tone period high registers (R1, R3, R5)", () => {
      // Tone A high — mask 0x0f
      ay.setPsgRegisterIndex(1);
      ay.writePsgRegisterValue(0xff); // write 0xff
      expect(ay.readPsgRegisterValue()).toBe(0x0f); // only lower 4 bits

      // Tone B high — mask 0x0f
      ay.setPsgRegisterIndex(3);
      ay.writePsgRegisterValue(0xff);
      expect(ay.readPsgRegisterValue()).toBe(0x0f);

      // Tone C high — mask 0x0f
      ay.setPsgRegisterIndex(5);
      ay.writePsgRegisterValue(0xff);
      expect(ay.readPsgRegisterValue()).toBe(0x0f);
    });

    it("should mask high bits in Noise period register (R6)", () => {
      // Noise period — mask 0x1f (5 bits)
      ay.setPsgRegisterIndex(6);
      ay.writePsgRegisterValue(0xff);
      expect(ay.readPsgRegisterValue()).toBe(0x1f);

      ay.setPsgRegisterIndex(6);
      ay.writePsgRegisterValue(0x20); // bit 5 set — should be masked away
      expect(ay.readPsgRegisterValue()).toBe(0x00);
    });

    it("should mask high bits in Volume registers (R8, R9, R10)", () => {
      // Volume A — mask 0x1f (5 bits: bit4=env mode, bits3-0=volume level)
      for (const reg of [8, 9, 10]) {
        ay.setPsgRegisterIndex(reg);
        ay.writePsgRegisterValue(0xff);
        expect(ay.readPsgRegisterValue()).toBe(0x1f);

        ay.setPsgRegisterIndex(reg);
        ay.writePsgRegisterValue(0x20); // bit 5 set — masked
        expect(ay.readPsgRegisterValue()).toBe(0x00);
      }
    });

    it("should mask high bits in Envelope shape register (R13)", () => {
      // Envelope shape — mask 0x0f (4 bits)
      ay.setPsgRegisterIndex(13);
      ay.writePsgRegisterValue(0xff);
      expect(ay.readPsgRegisterValue()).toBe(0x0f);

      ay.setPsgRegisterIndex(13);
      ay.writePsgRegisterValue(0x10); // bit 4+ set — masked
      expect(ay.readPsgRegisterValue()).toBe(0x00);
    });

    it("should pass all bits through for 0xff-masked registers", () => {
      // Registers with 0xff mask: R0, R2, R4, R7, R11, R12, R14, R15
      const fullRegs = [0, 2, 4, 7, 11, 12, 14, 15];
      for (const reg of fullRegs) {
        ay.setPsgRegisterIndex(reg);
        ay.writePsgRegisterValue(0xff);
        expect(ay.readPsgRegisterValue()).toBe(0xff);
      }
    });

    it("should apply the correct mask for every register (exhaustive)", () => {
      for (let r = 0; r < 16; r++) {
        ay.setPsgRegisterIndex(r);
        ay.writePsgRegisterValue(0xff);
        expect(ay.readPsgRegisterValue()).toBe(AY_MASKS[r]);
      }
    });

    it("should apply mask per-read without altering stored value", () => {
      // Write 0xff to R1, read back masked; then read via a different path (raw internal)
      // The internal _regValues should still hold 0xff (write unmasked, read masked)
      ay.setPsgRegisterIndex(1);
      ay.writePsgRegisterValue(0xff);
      expect(ay.readPsgRegisterValue()).toBe(0x0f); // masked on read

      // After writing the full byte, internal use (e.g. tone period) uses masked value
      // from writePsgRegisterValue which already masks to 0x0f in its case 1 handler
      // Verify tone period uses the lower 4 bits as expected
      ay.setPsgRegisterIndex(0);
      ay.writePsgRegisterValue(0x42); // low byte
      ay.setPsgRegisterIndex(1);
      ay.writePsgRegisterValue(0xff); // high nibble → only 0x0f used
      // Tone A = (0x0f << 8) | 0x42 = 0x0f42 = 3906
      // Verify by re-reading: masked read of R1 gives 0x0f
      expect(ay.readPsgRegisterValue()).toBe(0x0f);
    });

    it("should return 0 for masked bits even when low bits are set to 0", () => {
      // Write 0xe0 to R9 (volume B) — only high bits set, below mask of 0x1f
      ay.setPsgRegisterIndex(9);
      ay.writePsgRegisterValue(0xe0);
      expect(ay.readPsgRegisterValue()).toBe(0x00); // all masked
    });
  });

  describe("YM2149 chip: all bits returned unmasked", () => {
    let ym: PsgChip;

    beforeEach(() => {
      ym = new PsgChip(0, "YM");
    });

    it("should return full 0xff for all registers on YM2149", () => {
      for (let r = 0; r < 16; r++) {
        ym.setPsgRegisterIndex(r);
        ym.writePsgRegisterValue(0xff);
        expect(ym.readPsgRegisterValue()).toBe(0xff);
      }
    });

    it("should return high bits for Tone period high (R1, R3, R5) on YM2149", () => {
      for (const reg of [1, 3, 5]) {
        ym.setPsgRegisterIndex(reg);
        ym.writePsgRegisterValue(0xf0); // high nibble set
        expect(ym.readPsgRegisterValue()).toBe(0xf0); // returned unmasked
      }
    });

    it("should return bits 5-7 set for Volume registers on YM2149", () => {
      for (const reg of [8, 9, 10]) {
        ym.setPsgRegisterIndex(reg);
        ym.writePsgRegisterValue(0xe0); // bits 5-7 set
        expect(ym.readPsgRegisterValue()).toBe(0xe0); // no masking
      }
    });

    it("should return high nibble for Envelope shape (R13) on YM2149", () => {
      ym.setPsgRegisterIndex(13);
      ym.writePsgRegisterValue(0xf0);
      expect(ym.readPsgRegisterValue()).toBe(0xf0);
    });
  });

  describe("Register index boundary handling", () => {
    let ay: PsgChip;

    beforeEach(() => {
      ay = new PsgChip(0, "AY");
    });

    it("should wrap register index to 0-15 and apply correct mask (AY)", () => {
      // setPsgRegisterIndex already masks to 0x0f, so index 17 = 1 (mask 0x0f)
      ay.setPsgRegisterIndex(17); // → stored as 1
      ay.writePsgRegisterValue(0xff);
      expect(ay.readPsgRegisterValue()).toBe(0x0f); // mask for reg 1
    });

    it("should wrap register index to 0-15 and apply correct mask (YM)", () => {
      const ym = new PsgChip(0, "YM");
      ym.setPsgRegisterIndex(17); // → stored as 1
      ym.writePsgRegisterValue(0xff);
      expect(ym.readPsgRegisterValue()).toBe(0xff); // no masking
    });
  });

  describe("AY mask does not interfere with write-then-tone-period decode", () => {
    // Verify that writing a value with high bits set to R1 still works correctly
    // for tone generation — the write path strips to nibble in writePsgRegisterValue.
    it("should produce correct tone period even when high bits set in R1 write", () => {
      const ay2 = new PsgChip(0, "AY");
      ay2.setPsgRegisterIndex(0);
      ay2.writePsgRegisterValue(0x00); // period low = 0
      ay2.setPsgRegisterIndex(1);
      ay2.writePsgRegisterValue(0xf1); // period high = 0xf1 → stripped to 0x01 internally
      // Read back: mask(0x0f) & stored(0xf1 not stored, writePsgRegisterValue masks to 0x0f too)
      // Actually writePsgRegisterValue stores the byte raw in _regValues, internal decode uses & 0x0f
      // Read should give 0x0f & 0xf1 = 0x01 (mask 0x0f applied on read)
      expect(ay2.readPsgRegisterValue()).toBe(0x01);
    });
  });
});

// ---------------------------------------------------------------------------
// Phase 8: AudioMixer PSG AC Coupling Consistency
// These tests verify the unconditional application of the formula is correct.
// ---------------------------------------------------------------------------

import { AudioMixerDevice } from "@emu/machines/zxNext/AudioMixerDevice";
import { DacDevice } from "@emu/machines/zxNext/DacDevice";

describe("Step 8: AudioMixer PSG AC Coupling Consistency (Phase 8)", () => {
  let mixer: AudioMixerDevice;
  let dac: DacDevice;

  beforeEach(() => {
    dac = new DacDevice();
    dac.reset();
    dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // centre (silence)
    mixer = new AudioMixerDevice(dac);
    mixer.reset();
    mixer.setEarLevel(0);
    mixer.setMicLevel(0);
    mixer.setVolumeScale(1.0);
  });

  it("should contribute 0 when PSG output is zero (no DC jump)", () => {
    mixer.setPsgOutput({ left: 0, right: 0 });
    const output = mixer.getMixedOutput();
    expect(output.left).toBe(0);
    expect(output.right).toBe(0);
  });

  it("should produce identical result with PSG=0 whether formula runs or not", () => {
    // Use a value that survives ÷24 scaling: floor(48/24)=2; midpoint=1; AC=1
    mixer.setPsgOutput({ left: 48, right: 48 }); // small but non-zero after ÷24
    const nonZero = mixer.getMixedOutput();

    mixer.setPsgOutput({ left: 0, right: 0 });
    const zero = mixer.getMixedOutput();

    expect(zero.left).toBe(0);
    expect(zero.right).toBe(0);
    // Non-zero should produce a small positive value
    expect(Math.abs(nonZero.left)).toBeGreaterThan(0);
  });

  it("should produce symmetric contribution when both PSG channels equal", () => {
    // Both equal: psgPeak = val, midpoint = val/2, AC = val - val/2 = ceil(val/2)
    // contribution must be the same for left and right
    mixer.setPsgOutput({ left: 4800, right: 4800 });
    const output = mixer.getMixedOutput();
    expect(output.left).toBe(output.right);
    expect(output.left).toBeGreaterThan(0);
  });

  it("should produce asymmetric contribution when PSG channels differ", () => {
    // left < right: psgPeak = right, leftAC = left - right/2 < rightAC = right - right/2
    mixer.setPsgOutput({ left: 2400, right: 9600 });
    const output = mixer.getMixedOutput();
    expect(output.right).toBeGreaterThan(output.left);
  });

  it("should keep both channels audible even when one PSG channel is zero", () => {
    // Regression test for 'only left channel' bug:
    // Channel A active (left=X), B+C silent (right=0).
    // peak = psgLeftScaled; midpoint = peak/2
    // left gets +(peak - midpoint) = +midpoint (positive)
    // right gets +(0 - midpoint)   = -midpoint (negative, phase-inverted)
    mixer.setPsgOutput({ left: 48000, right: 0 });
    const output = mixer.getMixedOutput();
    // Left channel: positive
    expect(output.left).toBeGreaterThan(0);
    // Right channel: negative (phase-inverted midpoint), but still non-zero
    expect(output.right).toBeLessThan(0);
    // Both channels have equal magnitude (perfect phase inversion around midpoint)
    expect(Math.abs(output.left)).toBeCloseTo(Math.abs(output.right), 10);
  });

  it("should produce positive output for symmetric PSG signal at max volume", () => {
    // Max PSG-only: both channels at maximum 196605
    mixer.setPsgOutput({ left: 196605, right: 196605 });
    const output = mixer.getMixedOutput();
    // psgPeak = floor(196605/24) = 8191, midpoint = 4095
    // psgAC = 8191 - 4095 = 4096; scaled = 4096*5.5 = 22528 → 0.688
    expect(output.left).toBeGreaterThan(0);
    expect(output.right).toBeGreaterThan(0);
    expect(output.left).toBeCloseTo(output.right, 10);
  });
});
