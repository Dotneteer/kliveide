import { describe, it, expect, beforeEach } from "vitest";
import { TurboSoundDevice } from "@emu/machines/zxNext/TurboSoundDevice";

/**
 * Step 56: TurboSound stereo routing (turbosound.vhd ~184-201).
 *   ABC mode: L = A + B, R = B + C
 *   ACB mode: L = A + C, R = B + C
 *   Mono: L = R = A + B + C; the per-chip pan bits apply on top.
 *   Max per output channel (stereo): 65535 + 65535 = 131070
 *
 * The envelope tests that used to open this file exercised the retired MAME-shaped `PsgChip`'s AY/YM
 * table modes; the Next's envelope is covered on both cores by `test/zxnext-hw/audio/ay-psg.test.ts`.
 */

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

  describe("ABC mode: L = A + B, R = B + C (FPGA full-addition)", () => {
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

    it("ABC left is the full sum A+B (not halved centre)", () => {
      device.setAyStereoMode(false);
      const chip = setupStereoChip(10, 12, 6);
      const output = device.getChipStereoOutput(0);
      const expectedLeft = chip.getChannelAVolume() + chip.getChannelBVolume();
      expect(output.left).toBe(expectedLeft);
    });

    it("maximum left output is capped at 131070", () => {
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

    it("channel B alone (A=0, C=0) routes to both sides (full volume)", () => {
      device.setAyStereoMode(false);
      const chip = device.getChip(0);
      chip.setPsgRegisterIndex(2); chip.writePsgRegisterValue(1);
      chip.setPsgRegisterIndex(7); chip.writePsgRegisterValue(0x39); // tone B on, rest OFF
      chip.setPsgRegisterIndex(9); chip.writePsgRegisterValue(10);
      device.generateAllOutputValues();
      const output = device.getChipStereoOutput(0);
      const volB = chip.getChannelBVolume();
      expect(output.left).toBe(volB);   // L = A(0) + B
      expect(output.right).toBe(volB);  // R = B + C(0)
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
      expect(output.right).toBe(0); // B=0 → right = 0 + volC = 0
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
      expect(output.left).toBe(0); // A=0 and B=0 → left = 0
    });
  });

  // ==================== ACB mode ====================

  describe("ACB mode: L = A + C, R = B + C (FPGA full-addition)", () => {
    it("left = volA + volC", () => {
      device.setAyStereoMode(true); // ACB
      const chip = setupStereoChip(8, 5, 10);
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBe(chip.getChannelAVolume() + chip.getChannelCVolume());
    });

    it("right = volB + volC", () => {
      device.setAyStereoMode(true);
      const chip = setupStereoChip(8, 5, 10);
      const output = device.getChipStereoOutput(0);
      expect(output.right).toBe(chip.getChannelBVolume() + chip.getChannelCVolume());
    });

    it("ACB differs from ABC for same channel volumes", () => {
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

      expect(abcOut.left).not.toBe(acbOut.left);
      // FPGA: R = B + C in both ABC and ACB modes, so right is identical
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
      expect(output.left).toBe(output.right); // volA=0 + volC == volB=0 + volC
    });

    it("maximum output in ACB is capped at 131070", () => {
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
