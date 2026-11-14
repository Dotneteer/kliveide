/*
 * The audio mixer views' state (`dev/plans/AUDIO_MIXER_PLAN.md` §3.2-§3.4): the live frame, polled at
 * about 30 Hz while the view is open, and the current machine type's settings, which every window
 * shares through the global setting (`SETTING_EMU_AUDIO_MIXER`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  unmuteAll,
  withChannelSetting,
  type AudioMixerChannelSetting,
  type AudioMixerFrame,
  type AudioMixerSettings,
  type AudioMixerSettingsByMachine
} from "@common/audio/audioMixerModel";
import { SETTING_EMU_AUDIO_MIXER } from "@common/settings/setting-const";
import { useMainApi } from "@renderer/core/MainApi";
import { useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";

/** The views' refresh rate */
export const AUDIO_MIXER_POLL_MS = 33;

/**
 * Polls `fetch` while mounted, one request at a time
 * @returns the last frame; null when the machine has no sound; undefined before the first answer
 */
export function useAudioMixerFrame(fetch: () => Promise<AudioMixerFrame | null>): AudioMixerFrame | null | undefined {
  const [frame, setFrame] = useState<AudioMixerFrame | null>();
  const fetchRef = useRef(fetch);
  fetchRef.current = fetch;
  useEffect(() => {
    let busy = false;
    let alive = true;
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        const next = await fetchRef.current();
        if (alive) setFrame(next);
      } catch {
        if (alive) setFrame(undefined);
      } finally {
        busy = false;
      }
    };
    void tick();
    const timer = setInterval(tick, AUDIO_MIXER_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return frame;
}

/** The current machine type's settings and the ways to change them */
export function useAudioMixerSettings() {
  const machineId = useSelector((s) => s.emulatorState?.machineId) as string | undefined;
  const stored = useGlobalSetting(SETTING_EMU_AUDIO_MIXER) as AudioMixerSettingsByMachine | undefined;
  const all = useMemo(() => stored ?? {}, [stored]);
  const mainApi = useMainApi();
  const settings: AudioMixerSettings = (machineId && all[machineId]) || {};

  const save = useCallback(
    async (next: AudioMixerSettings) => {
      if (!machineId) return;
      const updated: AudioMixerSettingsByMachine = { ...all };
      if (Object.keys(next).length) updated[machineId] = next;
      else delete updated[machineId];
      await mainApi.setGlobalSettingsValue(SETTING_EMU_AUDIO_MIXER, updated);
    },
    [all, machineId, mainApi]
  );

  return {
    machineId,
    settings,
    setChannel: (channelId: string, change: AudioMixerChannelSetting) =>
      save(withChannelSetting(settings, channelId, change)),
    unmuteAll: () => save(unmuteAll(settings)),
    reset: () => save({})
  };
}
