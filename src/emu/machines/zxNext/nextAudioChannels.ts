/*
 * The ZX Spectrum Next's sound sources for the audio mixer (`zxnext-audio-channels.c`,
 * `dev/plans/AUDIO_MIXER_PLAN.md` §3.1, phase 2), driven by `../wasmAudioChannelMixer.ts`. Every Next
 * profile has every source (the Pi I2S input included), so the table does not follow the model.
 */

import type { MessageKey } from "@common/i18n/keys.generated";
import { WasmAudioChannelMixer, type AudioMixerCore, type CoreAudioChannel } from "../wasmAudioChannelMixer";

/** The core's slots (`ZXNEXT_AUDIO_CH_*` in `zxnext-audio-channels.c`) */
export const ZXNEXT_AUDIO_CH_EAR = 0;
export const ZXNEXT_AUDIO_CH_MIC = 1;
export const ZXNEXT_AUDIO_CH_AY = 2;
export const ZXNEXT_AUDIO_CH_DAC = 11;
export const ZXNEXT_AUDIO_CH_PI_LEFT = 15;
export const ZXNEXT_AUDIO_CH_PI_RIGHT = 16;

const AY_LABELS: MessageKey[] = ["emu.audioMixer.channel.ayA", "emu.audioMixer.channel.ayB", "emu.audioMixer.channel.ayC"];
const AY_GROUPS: MessageKey[] = [
  "emu.audioMixer.group.turboSound1",
  "emu.audioMixer.group.turboSound2",
  "emu.audioMixer.group.turboSound3"
];
const DAC_LABELS: MessageKey[] = [
  "emu.audioMixer.channel.dacA",
  "emu.audioMixer.channel.dacB",
  "emu.audioMixer.channel.dacC",
  "emu.audioMixer.channel.dacD"
];

export const NEXT_AUDIO_CHANNELS: readonly CoreAudioChannel[] = [
  {
    id: "beeper",
    slot: ZXNEXT_AUDIO_CH_EAR,
    labelKey: "emu.audioMixer.channel.beeper",
    group: "ula",
    groupLabelKey: "emu.audioMixer.group.ula"
  },
  {
    // --- The MIC line carries the tape input and the Pi's EAR bit too: the hardware XORs them
    id: "mic",
    slot: ZXNEXT_AUDIO_CH_MIC,
    labelKey: "emu.audioMixer.channel.micTape",
    group: "ula",
    groupLabelKey: "emu.audioMixer.group.ula"
  },
  ...[0, 1, 2].flatMap((chip) =>
    [0, 1, 2].map((channel) => ({
      id: `ay${chip + 1}${"ABC"[channel]}`,
      slot: ZXNEXT_AUDIO_CH_AY + chip * 3 + channel,
      labelKey: AY_LABELS[channel],
      group: `ay${chip + 1}`,
      groupLabelKey: AY_GROUPS[chip]
    }))
  ),
  ...[0, 1, 2, 3].map((dac) => ({
    id: `dac${"ABCD"[dac]}`,
    slot: ZXNEXT_AUDIO_CH_DAC + dac,
    labelKey: DAC_LABELS[dac],
    group: "dac",
    groupLabelKey: "emu.audioMixer.group.dac" as MessageKey
  })),
  {
    id: "piLeft",
    slot: ZXNEXT_AUDIO_CH_PI_LEFT,
    labelKey: "emu.audioMixer.channel.piLeft",
    group: "pi",
    groupLabelKey: "emu.audioMixer.group.pi"
  },
  {
    id: "piRight",
    slot: ZXNEXT_AUDIO_CH_PI_RIGHT,
    labelKey: "emu.audioMixer.channel.piRight",
    group: "pi",
    groupLabelKey: "emu.audioMixer.group.pi"
  }
];

/**
 * The Next's audio mixer
 * @param getCore The live core, undefined before it is loaded
 */
export function createNextAudioMixer(getCore: () => AudioMixerCore | undefined): WasmAudioChannelMixer {
  return new WasmAudioChannelMixer({
    prefix: "zxnext",
    getCore,
    channels: () => NEXT_AUDIO_CHANNELS,
    sampleCountExport: "zxnextGetAudioMixerSampleCount"
  });
}
