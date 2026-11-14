import type { MessageKey } from "@common/i18n/keys.generated";

/*
 * A machine's sound sources, one by one, for the audio mixer (`dev/plans/AUDIO_MIXER_PLAN.md` §3).
 *
 * A machine that makes sound has an `audioMixer`; one without sound (the ZX80, the ZX81) has none,
 * and the mixer is not offered for it. The list of channels comes from the machine, never from the
 * UI. Mute is gain 0; solo is resolved by the mixer's UI into gains, the machine knows only gains.
 */

/** One sound source of a machine, as the audio mixer lists it */
export type AudioChannelInfo = {
  /** Unique within the machine and stable across versions: the settings are stored under it */
  id: string;
  /** The channel's name ("Beeper", "A") */
  labelKey: MessageKey;
  /** The sources of one chip or line share a group ("ay", "ula") */
  group: string;
  /** The group's name ("AY-3-8912") */
  groupLabelKey: MessageKey;
};

/** One frame's per-channel levels, before each channel's gain (a pre-fader tap) */
export type AudioChannelTaps = {
  /** Channels per sample: `getAudioChannels()`'s, in its order */
  channelCount: number;
  /** Samples in the frame: the same as the frame's audio samples */
  sampleCount: number;
  /**
   * `[sample * channelCount + channel]`, at the scale of the machine's audio samples: a level is
   * the channel's share of the output, before the mix's DC filter, so it may carry a constant offset
   * (a silent AY channel sits below zero), which an analysis removes.
   */
  samples: Float32Array;
};

/** A machine's per-channel gains and taps */
export interface IAudioChannelMixer {
  /** The machine's sound sources (the list may follow the model, never the machine's state) */
  getAudioChannels(): AudioChannelInfo[];

  /** A channel's gain: 0 is mute, 1 unity, up to 4; an unknown id is ignored */
  setAudioChannelGain(channelId: string, gain: number): void;

  /** A channel's gain (1 for an unknown id) */
  getAudioChannelGain(channelId: string): number;

  /** Switches the taps on or off; while off, a machine spends nothing on them */
  setAudioTapsEnabled(enabled: boolean): void;

  /** Whether the taps are on */
  getAudioTapsEnabled(): boolean;

  /** The last frame's taps; undefined while they are off */
  getAudioChannelTaps(): AudioChannelTaps | undefined;
}
