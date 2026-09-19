import { describe, expect, it } from "vitest";

import { createSession, type AudioSample, type NextTestSession } from "../../harness/zxnext";

/*
 * DAC-001 - NextReg $08 bit 3 enables the 8-bit DACs.
 *
 * Hardware: zxnext.vhd ~6382 wires the soundrive module's reset to `reset or not nr_08_dac_en`
 * (`nr_08_dac_en <= nr_wr_dat(3)`, ~5157). soundrive.vhd ~70-78: while it is in reset all four
 * channels are held at $80, the silent centre, and port writes are ignored. Channels A and B feed the
 * left side, C and D the right (~35-45); port $1F is soundrive channel A (`port_dac_sd1_ABCD_1f0f4f5f`,
 * zxnext.vhd ~2385).
 */

const SAMPLE_RATE = 48000;
const DAC_OFF = 0x12; // --- $08: internal speaker + TurboSound, bit 3 = 0
const DAC_ON = 0x1a; // --- the same with bit 3 = 1

const swing = (samples: AudioSample[]) => {
  const values = samples.map((s) => s.left);
  return Math.max(...values) - Math.min(...values);
};
const level = (samples: AudioSample[]) => samples[samples.length - 1].left;

/** Writes alternating extremes to soundrive channel A, one value per frame. */
function square(s: NextTestSession, frames = 4): NextTestSession {
  for (let i = 0; i < frames; i++) s.out(0x1f, i % 2 === 0 ? 0x00 : 0xff).runFrames(1);
  return s;
}

async function session(): Promise<NextTestSession> {
  return createSession({ audioSampleRate: SAMPLE_RATE });
}

describe("DAC enable (NextReg 08 bit 3)", () => {
  it("port writes are ignored while the DACs are disabled", async () => {
    const s = await session();
    s.setNextReg(0x08, DAC_OFF).startAudio();
    square(s);
    expect(swing(s.audio())).toBe(0);
  });

  it("port writes reach the left side once the DACs are enabled", async () => {
    const s = await session();
    s.setNextReg(0x08, DAC_ON).startAudio();
    square(s);
    expect(swing(s.audio())).toBeGreaterThan(0);
  });

  it("disabling the DACs holds the channels at the silent centre", async () => {
    const s = await session();
    // --- The level with every DAC channel at its $80 reset value
    s.setNextReg(0x08, DAC_OFF).startAudio().runFrames(2);
    const silent = level(s.audio());

    s.setNextReg(0x08, DAC_ON).out(0x1f, 0xff).runFrames(1);
    expect(level(s.audio())).not.toBe(silent);

    s.setNextReg(0x08, DAC_OFF).runFrames(2);
    expect(level(s.audio())).toBe(silent);
  });
});
