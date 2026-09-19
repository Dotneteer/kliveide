import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type AudioSample, type CoreName, type NextTestSession } from "../../harness/zxnext";

/*
 * DAC port decoding details `dac.test.ts` does not list: the low address byte is decoded in full (an
 * even neighbour of a DAC port is not a DAC port), and $5F / $3F with one of their two enables off.
 * Ports the hardware-visible parts of test/audio/DacPortDevice.step6 ("odd and even addresses are the
 * same") and DacPortEnableGating.step21.
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~2469-2518: `port_XX_lsb` is set only for the exact low byte X"0F", X"1F", X"3F", X"4F", X"5F",
 *   X"B3", X"DF", X"F1", X"F3", X"F9", X"FB"; ~2614-2620 build the DAC selects from those alone. An
 *   even address is the ULA port instead (~2538: A0 = 0), and $00 written there sets border 0, EAR 0,
 *   MIC 0 (~3589) - no change to the audio.
 * - ~2617: A = ... or ($3F and bit 19 [Profi Covox]); ~2620: D = ... or ($5F and (bit 17 [Soundrive 1]
 *   or bit 19)). Enable bits 16-23 are NextReg $84 (~2384-2391). Writes need $08 bit 3 (~2731-2734).
 * - audio/soundrive.vhd ~70-76: channels reset to $80; pcm_L = A + B, pcm_R = C + D. zxnext.vhd ~6382:
 *   its reset is `reset or not nr_08_dac_en`, so clearing $08 bit 3 loses the written values.
 */

const RATE = 48_000;
const DAC_ON = 0x18; // --- $08: internal speaker + DACs

async function dac(core: CoreName): Promise<NextTestSession> {
  const s = await createSession(core, { audioSampleRate: RATE });
  await s.loadCode(" .org $8000\n di\nPark: jr Park");
  return s.setNextReg(0x08, DAC_ON);
}

const level = (s: NextTestSession): AudioSample => {
  const a = s.startAudio().runFrames(1).audio();
  return a[a.length - 1];
};

/** $84 with the given enable bits (16-23) cleared. */
const without = (...bits: number[]) => bits.reduce((v, b) => v & ~(1 << (b - 16)), 0xff);

describe.each(ALL_CORES)("DAC port decoding - %s core", (core) => {
  const DAC_PORTS = [0x0f, 0x1f, 0x3f, 0x4f, 0x5f, 0xb3, 0xdf, 0xf1, 0xf3, 0xf9, 0xfb];
  for (const port of DAC_PORTS) {
    const even = port & 0xfe;
    it(`DAC-DEC-1: $${even.toString(16).padStart(2, "0")} (A0 = 0) is not DAC port $${port.toString(16)}`, async () => {
      // --- zxnext.vhd ~2469-2518: the whole low byte is compared
      const s = await dac(core);
      const base = level(s);
      s.out(even, 0x00);
      expect(level(s), "the even neighbour writes no DAC channel").toEqual(base);
      s.out(port, 0x00);
      expect(level(s), "the DAC port itself does").not.toEqual(base);
    });
  }

  it("DAC-DEC-2: $5F writes D with Soundrive 1 on and Profi Covox off", async () => {
    // --- zxnext.vhd ~2620: port_5f and (sd1 enable or profi enable)
    const s = await dac(core);
    s.setNextReg(0x84, without(19));
    const base = level(s);
    s.out(0x5f, 0xff);
    const l = level(s);
    expect([l.left !== base.left, l.right !== base.right], "right side only: channel D").toEqual([false, true]);
  });

  it("DAC-DEC-3: $3F writes A with Soundrive 1 off and Profi Covox on", async () => {
    // --- zxnext.vhd ~2617: port_3f and profi enable, independent of bit 17
    const s = await dac(core);
    s.setNextReg(0x84, without(17));
    const base = level(s);
    s.out(0x3f, 0xff);
    const l = level(s);
    expect([l.left !== base.left, l.right !== base.right], "left side only: channel A").toEqual([true, false]);
  });

  it("DAC-EN-2: clearing and setting $08 bit 3 again leaves every channel at $80, not at its old value", async () => {
    // --- zxnext.vhd ~6382 (reset_i => reset or not nr_08_dac_en); soundrive.vhd ~70-76 (X"80")
    const s = await dac(core);
    const centre = level(s);
    for (const port of [0x1f, 0x0f, 0x4f, 0x5f]) s.out(port, 0xff);
    expect(level(s), "the channels moved").not.toEqual(centre);
    s.setNextReg(0x08, 0x10).runFrames(1).setNextReg(0x08, DAC_ON);
    expect(level(s), "back at the centre after re-enabling").toEqual(centre);
  });
});
