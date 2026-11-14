/*
 * The audio mixer's model (`dev/plans/AUDIO_MIXER_PLAN.md` §3, phase 5): what the user set per channel,
 * the gains that makes for the machine, and the frame the emulator sends to the mixer's views.
 *
 * Solo works as on a mixing desk ("solo in place", §6): while any channel is soloed, only soloed
 * channels play, whatever their mute; several can be soloed at once; clearing every solo brings the
 * mutes back as they were. The machine knows only gains (`IAudioChannelMixer`), so solo and mute are
 * resolved here.
 */

import type { MessageKey } from "@common/i18n/keys.generated";
import type { AudioChannelMeasures } from "./audioAnalysis";

/** A channel's level fader: 0 to MAX_CHANNEL_LEVEL (1 is unity) */
export const MAX_CHANNEL_LEVEL = 1.5;

/** What the user set for one channel */
export type AudioMixerChannelSetting = {
  mute?: boolean;
  solo?: boolean;
  /** The fader, 0..MAX_CHANNEL_LEVEL; 1 when absent */
  level?: number;
};

/** One machine type's mixer settings, by channel id (absent: unity, not muted, not soloed) */
export type AudioMixerSettings = Record<string, AudioMixerChannelSetting>;

/** All machine types' mixer settings, by machine id: the persisted setting's value */
export type AudioMixerSettingsByMachine = Record<string, AudioMixerSettings>;

/** Whether a channel is heard under these settings */
export function isChannelAudible(channelId: string, settings: AudioMixerSettings, channelIds: readonly string[]): boolean {
  const anySolo = channelIds.some((id) => settings[id]?.solo);
  const s = settings[channelId];
  return anySolo ? !!s?.solo : !s?.mute;
}

/** The gain of each channel the settings make: 0 when not heard, else its fader */
export function effectiveGains(channelIds: readonly string[], settings: AudioMixerSettings): Record<string, number> {
  const gains: Record<string, number> = {};
  for (const id of channelIds) {
    const level = settings[id]?.level;
    const fader = level === undefined ? 1 : Math.max(0, Math.min(MAX_CHANNEL_LEVEL, level));
    gains[id] = isChannelAudible(id, settings, channelIds) ? fader : 0;
  }
  return gains;
}

/** The settings with one channel's setting changed (empty settings are dropped, so a reset is `{}`) */
export function withChannelSetting(
  settings: AudioMixerSettings,
  channelId: string,
  change: AudioMixerChannelSetting
): AudioMixerSettings {
  const merged: AudioMixerChannelSetting = { ...settings[channelId], ...change };
  const next = { ...settings };
  const isDefault = !merged.mute && !merged.solo && (merged.level === undefined || merged.level === 1);
  if (isDefault) delete next[channelId];
  else next[channelId] = merged;
  return next;
}

/** The settings with every mute and solo cleared (the faders kept) */
export function unmuteAll(settings: AudioMixerSettings): AudioMixerSettings {
  let next: AudioMixerSettings = {};
  for (const [id, s] of Object.entries(settings)) next = withChannelSetting(next, id, { ...s, mute: false, solo: false });
  return next;
}

/** One channel in a mixer frame: what the machine says of it, its gain now, and its measures */
export type AudioMixerChannelFrame = AudioChannelMeasures & {
  id: string;
  labelKey: MessageKey;
  group: string;
  groupLabelKey: MessageKey;
  /** The gain the machine applies now (0 while muted or soloed out) */
  gain: number;
};

/**
 * What the emulator sends to the mixer's views after a frame: every channel's measures, and the
 * output's (what is heard, after the gains). Undefined channels: the machine has no sound.
 */
export type AudioMixerFrame = {
  machineId: string;
  sampleRate: number;
  channels: AudioMixerChannelFrame[];
  output: AudioChannelMeasures;
};
