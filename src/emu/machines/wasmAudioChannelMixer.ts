/*
 * The audio mixer of a WASM core (`dev/plans/AUDIO_MIXER_PLAN.md` §3): a core that exports the mixer's
 * functions under its prefix (`<prefix>AudioSetChannelGain`, `AudioGetChannelGain`,
 * `AudioSetTapsEnabled`, `AudioTapsPtr`, `GetAudioChannelCount`) and a table of its sources, each
 * with the core's slot for it. The Spectrum family's table is `zxSpectrum/spectrumAudioChannels.ts`,
 * the Next's `zxNext/nextAudioChannels.ts`.
 */

import type {
  AudioChannelInfo,
  AudioChannelTaps,
  IAudioChannelMixer
} from "@emu/abstractions/IAudioChannelMixer";

/** The mixer export names without the core's prefix */
export const AUDIO_CHANNEL_EXPORT_SUFFIXES = [
  "AudioSetChannelGain",
  "AudioGetChannelGain",
  "AudioSetTapsEnabled",
  "AudioTapsPtr",
  "GetAudioChannelCount"
] as const;

export type AudioChannelExportSuffix = (typeof AUDIO_CHANNEL_EXPORT_SUFFIXES)[number];

/** The mixer exports of a core with the given prefix */
export type AudioChannelCoreExports<P extends string> = {
  [K in AudioChannelExportSuffix as `${P}${K}`]: (...args: number[]) => number;
};

/** The mixer export names of a core, for its loader's required-export list */
export function audioChannelExportNames<P extends string>(prefix: P): `${P}${AudioChannelExportSuffix}`[] {
  return AUDIO_CHANNEL_EXPORT_SUFFIXES.map((suffix) => `${prefix}${suffix}` as `${P}${AudioChannelExportSuffix}`);
}

/** A source and the core's slot for it */
export type CoreAudioChannel = AudioChannelInfo & { slot: number };

/** What the mixer needs of a core (a loader's runtime) */
export type AudioMixerCore = {
  exports: object;
  memoryBuffer: ArrayBuffer;
};

export type WasmAudioChannelMixerOptions = {
  /** The core's export prefix */
  prefix: string;
  /** The live core, undefined before it is loaded */
  getCore: () => AudioMixerCore | undefined;
  /** The machine's sources (they may follow the model, which a machine may learn late) */
  channels: () => readonly CoreAudioChannel[];
  /** The export that counts the frame's audio samples */
  sampleCountExport: string;
};

/** The core clamps a gain to this */
const MAX_GAIN = 4;

/**
 * A tap word to a level: the conversion of the frame's audio samples (`WASM_AUDIO_SAMPLE_SCALE` in the
 * machines), so a tap reads as its channel's share of what is heard
 */
const TAP_SCALE = 32768;

export class WasmAudioChannelMixer implements IAudioChannelMixer {
  private taps?: AudioChannelTaps;
  /* The core has no getter: the host is its only writer, and a state restore keeps the live value */
  private tapsEnabled = false;

  constructor(private readonly options: WasmAudioChannelMixerOptions) {}

  getAudioChannels(): AudioChannelInfo[] {
    return this.options.channels().map(({ slot: _slot, ...info }) => info);
  }

  setAudioChannelGain(channelId: string, gain: number): void {
    const channel = this.channelOf(channelId);
    const core = this.options.getCore();
    if (!channel || !core || !Number.isFinite(gain)) return;
    const milli = Math.round(Math.min(MAX_GAIN, Math.max(0, gain)) * 1000);
    this.fn(core, "AudioSetChannelGain")(channel.slot, milli);
  }

  getAudioChannelGain(channelId: string): number {
    const channel = this.channelOf(channelId);
    const core = this.options.getCore();
    if (!channel || !core) return 1;
    return this.fn(core, "AudioGetChannelGain")(channel.slot) / 1000;
  }

  setAudioTapsEnabled(enabled: boolean): void {
    const core = this.options.getCore();
    if (!core) return;
    this.fn(core, "AudioSetTapsEnabled")(enabled ? 1 : 0);
    this.tapsEnabled = enabled;
    if (!enabled) this.taps = undefined;
  }

  getAudioTapsEnabled(): boolean {
    return this.tapsEnabled;
  }

  getAudioChannelTaps(): AudioChannelTaps | undefined {
    const core = this.options.getCore();
    if (!core || !this.tapsEnabled) return undefined;
    const channels = this.options.channels();
    const stride = this.fn(core, "GetAudioChannelCount")();
    const sampleCount = this.call(core, this.options.sampleCountExport)();
    const words = new Int16Array(core.memoryBuffer, this.fn(core, "AudioTapsPtr")(), sampleCount * stride);
    const needed = sampleCount * channels.length;
    if (!this.taps || this.taps.samples.length < needed || this.taps.channelCount !== channels.length) {
      this.taps = {
        channelCount: channels.length,
        sampleCount,
        samples: new Float32Array(Math.max(needed, 1024 * channels.length))
      };
    }
    const out = this.taps.samples;
    for (let s = 0; s < sampleCount; s++) {
      const from = s * stride;
      const to = s * channels.length;
      for (let c = 0; c < channels.length; c++) {
        out[to + c] = words[from + channels[c].slot] / TAP_SCALE;
      }
    }
    this.taps.sampleCount = sampleCount;
    return this.taps;
  }

  private channelOf(id: string): CoreAudioChannel | undefined {
    return this.options.channels().find((c) => c.id === id);
  }

  private fn(core: AudioMixerCore, suffix: AudioChannelExportSuffix): (...args: number[]) => number {
    return this.call(core, `${this.options.prefix}${suffix}`);
  }

  private call(core: AudioMixerCore, name: string): (...args: number[]) => number {
    const f = (core.exports as Record<string, unknown>)[name];
    if (typeof f !== "function") throw new Error(`The core does not export ${name}`);
    return f as (...args: number[]) => number;
  }
}
