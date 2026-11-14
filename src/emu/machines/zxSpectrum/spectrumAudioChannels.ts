/*
 * The Spectrum family's sound sources for the audio mixer (`zx-spectrum-audio-channels.c`,
 * `dev/plans/AUDIO_MIXER_PLAN.md` §3.1). The 48K (and the Timex, which builds the 48K's source), 128K
 * and +2E/+3E cores export the mixer under their own prefix; `dev/scripts/zx-audio-channel-exports.cjs`
 * keeps the build side of the list, `../wasmAudioChannelMixer.ts` drives it.
 */

import {
  audioChannelExportNames,
  WasmAudioChannelMixer,
  type AudioChannelCoreExports,
  type AudioChannelExportSuffix,
  type AudioMixerCore,
  type CoreAudioChannel
} from "../wasmAudioChannelMixer";

/** The mixer exports of a Spectrum core with the given prefix */
export type ZxAudioChannelCoreExports<P extends string> = AudioChannelCoreExports<P>;

/** The mixer export names of a Spectrum core, for its loader's required-export list */
export function zxAudioChannelExportNames<P extends string>(prefix: P): `${P}${AudioChannelExportSuffix}`[] {
  return audioChannelExportNames(prefix);
}

export type ZxAudioCorePrefix = "sp48" | "sp128" | "spp3e";

/** The core's channel slots (`ZX_AUDIO_CH_*` in `zx-spectrum-audio-channels.c`) */
export const ZX_AUDIO_CH_BEEPER = 0;
export const ZX_AUDIO_CH_MIC = 1;
export const ZX_AUDIO_CH_TAPE = 2;
export const ZX_AUDIO_CH_AY_A = 3;
export const ZX_AUDIO_CH_AY_B = 4;
export const ZX_AUDIO_CH_AY_C = 5;

const ULA_CHANNELS: CoreAudioChannel[] = [
  {
    id: "beeper",
    slot: ZX_AUDIO_CH_BEEPER,
    labelKey: "emu.audioMixer.channel.beeper",
    group: "ula",
    groupLabelKey: "emu.audioMixer.group.ula"
  },
  {
    id: "mic",
    slot: ZX_AUDIO_CH_MIC,
    labelKey: "emu.audioMixer.channel.mic",
    group: "ula",
    groupLabelKey: "emu.audioMixer.group.ula"
  },
  {
    id: "tape",
    slot: ZX_AUDIO_CH_TAPE,
    labelKey: "emu.audioMixer.channel.tape",
    group: "tape",
    groupLabelKey: "emu.audioMixer.group.tape"
  }
];

const AY_CHANNELS: CoreAudioChannel[] = [
  {
    id: "ayA",
    slot: ZX_AUDIO_CH_AY_A,
    labelKey: "emu.audioMixer.channel.ayA",
    group: "ay",
    groupLabelKey: "emu.audioMixer.group.ay"
  },
  {
    id: "ayB",
    slot: ZX_AUDIO_CH_AY_B,
    labelKey: "emu.audioMixer.channel.ayB",
    group: "ay",
    groupLabelKey: "emu.audioMixer.group.ay"
  },
  {
    id: "ayC",
    slot: ZX_AUDIO_CH_AY_C,
    labelKey: "emu.audioMixer.channel.ayC",
    group: "ay",
    groupLabelKey: "emu.audioMixer.group.ay"
  }
];

const WITH_AY = [...ULA_CHANNELS, ...AY_CHANNELS];

/**
 * The audio mixer of a Spectrum-family core
 * @param prefix The core's export prefix
 * @param getCore The live core, undefined before it is loaded
 * @param hasAy Whether the model has an AY (a Timex learns its model late)
 */
export function createSpectrumAudioMixer(
  prefix: ZxAudioCorePrefix,
  getCore: () => AudioMixerCore | undefined,
  hasAy: () => boolean
): WasmAudioChannelMixer {
  return new WasmAudioChannelMixer({
    prefix,
    getCore,
    channels: () => (hasAy() ? WITH_AY : ULA_CHANNELS),
    sampleCountExport: `${prefix}GetAudioSampleCount`
  });
}
