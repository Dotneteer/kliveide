import { describe, expect, it } from "vitest";

import {
  effectiveGains,
  isChannelAudible,
  unmuteAll,
  withChannelSetting,
  type AudioMixerSettings
} from "@common/audio/audioMixerModel";

/*
 * The mixer's mute/solo/fader model (`dev/plans/AUDIO_MIXER_PLAN.md` §6): solo in place, several solos
 * add up, solo wins over mute, clearing every solo brings the mutes back.
 */

const IDS = ["beeper", "ayA", "ayB", "ayC"];

describe("audio mixer model", () => {
  it("plays every channel at unity with no settings", () => {
    expect(effectiveGains(IDS, {})).toEqual({ beeper: 1, ayA: 1, ayB: 1, ayC: 1 });
  });

  it("mutes a channel and keeps the faders of the others", () => {
    const s: AudioMixerSettings = { ayA: { mute: true }, ayB: { level: 0.5 } };
    expect(effectiveGains(IDS, s)).toEqual({ beeper: 1, ayA: 0, ayB: 0.5, ayC: 1 });
  });

  it("plays only the soloed channels, several at once, even a muted one", () => {
    const s: AudioMixerSettings = { ayA: { solo: true, mute: true }, ayC: { solo: true, level: 1.2 } };
    expect(effectiveGains(IDS, s)).toEqual({ beeper: 0, ayA: 1, ayB: 0, ayC: 1.2 });
    expect(isChannelAudible("beeper", s, IDS)).toBe(false);
  });

  it("brings the mutes back when the last solo is cleared", () => {
    let s: AudioMixerSettings = { ayA: { mute: true } };
    s = withChannelSetting(s, "ayB", { solo: true });
    expect(effectiveGains(IDS, s).ayA).toBe(0);
    expect(effectiveGains(IDS, s).beeper).toBe(0);
    s = withChannelSetting(s, "ayB", { solo: false });
    expect(effectiveGains(IDS, s)).toEqual({ beeper: 1, ayA: 0, ayB: 1, ayC: 1 });
  });

  it("clamps a fader to 0..1.5", () => {
    expect(effectiveGains(["a"], { a: { level: 9 } }).a).toBe(1.5);
    expect(effectiveGains(["a"], { a: { level: -1 } }).a).toBe(0);
  });

  it("drops a channel's setting once it is back to the default", () => {
    const s = withChannelSetting({ ayA: { mute: true } }, "ayA", { mute: false });
    expect(s).toEqual({});
  });

  it("unmutes and unsolos everything, keeping the faders", () => {
    const s: AudioMixerSettings = { ayA: { mute: true, level: 0.7 }, ayB: { solo: true }, ayC: { mute: true } };
    expect(unmuteAll(s)).toEqual({ ayA: { mute: false, solo: false, level: 0.7 } });
  });
});
