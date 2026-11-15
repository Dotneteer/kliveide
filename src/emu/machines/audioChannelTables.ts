/*
 * The sound sources of the machines on `common/wasm/audio-channels.c` and of the HT-1080Z, for the
 * audio mixer (`dev/plans/AUDIO_MIXER_PLAN.md` §3.1, phase 3). The slots are the cores': the Z88's
 * speaker and the TVC's sound generator are slot 0; the Enterprise's DAVE channels 0-3 (tone 0-2,
 * noise); the HT-1080Z's 0 the beeper, 1-3 the AY.
 */

import { WasmAudioChannelMixer, type AudioMixerCore, type CoreAudioChannel } from "./wasmAudioChannelMixer";

export const Z88_AUDIO_CHANNELS: readonly CoreAudioChannel[] = [
  {
    id: "speaker",
    slot: 0,
    labelKey: "emu.audioMixer.channel.speaker",
    group: "blink",
    groupLabelKey: "emu.audioMixer.group.blink"
  }
];

export const TVC_AUDIO_CHANNELS: readonly CoreAudioChannel[] = [
  {
    id: "sound",
    slot: 0,
    labelKey: "emu.audioMixer.channel.sound",
    group: "sound",
    groupLabelKey: "emu.audioMixer.group.soundGenerator"
  }
];

export const EP_AUDIO_CHANNELS: readonly CoreAudioChannel[] = [
  { id: "tone0", slot: 0, labelKey: "emu.audioMixer.channel.tone0", group: "dave", groupLabelKey: "emu.audioMixer.group.dave" },
  { id: "tone1", slot: 1, labelKey: "emu.audioMixer.channel.tone1", group: "dave", groupLabelKey: "emu.audioMixer.group.dave" },
  { id: "tone2", slot: 2, labelKey: "emu.audioMixer.channel.tone2", group: "dave", groupLabelKey: "emu.audioMixer.group.dave" },
  { id: "noise", slot: 3, labelKey: "emu.audioMixer.channel.noise", group: "dave", groupLabelKey: "emu.audioMixer.group.dave" }
];

export const HT1080Z_AUDIO_CHANNELS: readonly CoreAudioChannel[] = [
  {
    id: "beeper",
    slot: 0,
    labelKey: "emu.audioMixer.channel.beeper",
    group: "portFf",
    groupLabelKey: "emu.audioMixer.group.portFf"
  },
  { id: "ayA", slot: 1, labelKey: "emu.audioMixer.channel.ayA", group: "ay", groupLabelKey: "emu.audioMixer.group.ay8910" },
  { id: "ayB", slot: 2, labelKey: "emu.audioMixer.channel.ayB", group: "ay", groupLabelKey: "emu.audioMixer.group.ay8910" },
  { id: "ayC", slot: 3, labelKey: "emu.audioMixer.channel.ayC", group: "ay", groupLabelKey: "emu.audioMixer.group.ay8910" }
];

/**
 * The audio mixer of a core whose sources do not follow the model
 * @param prefix The core's export prefix
 * @param channels The core's sources
 * @param getCore The live core, undefined before it is loaded
 */
export function createFixedAudioMixer(
  prefix: string,
  channels: readonly CoreAudioChannel[],
  getCore: () => AudioMixerCore | undefined
): WasmAudioChannelMixer {
  return new WasmAudioChannelMixer({
    prefix,
    getCore,
    channels: () => channels,
    sampleCountExport: `${prefix}GetAudioSampleCount`
  });
}
