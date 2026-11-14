import { describe, expect, it } from "vitest";

import { FFT_SIZE } from "@common/audio/audioAnalysis";
import type { AudioChannelInfo, AudioChannelTaps, IAudioChannelMixer } from "@emu/abstractions/IAudioChannelMixer";
import {
  AUDIO_MIXER_WATCH_TIMEOUT_MS,
  AudioMixerMonitor
} from "@renderer/features/emulator/audioMixerMonitor";

/*
 * The audio mixer's emulator side (`dev/plans/AUDIO_MIXER_PLAN.md` §3.2): the taps are on only while a
 * view asks, the settings become the machine's gains, and a view gets each channel's measures.
 */

const RATE = 48_000;

class FakeMixer implements IAudioChannelMixer {
  gains: Record<string, number> = {};
  tapsOn = false;
  frame = 0;
  getAudioChannels(): AudioChannelInfo[] {
    return [
      { id: "beeper", labelKey: "emu.audioMixer.channel.beeper", group: "ula", groupLabelKey: "emu.audioMixer.group.ula" },
      { id: "ayA", labelKey: "emu.audioMixer.channel.ayA", group: "ay", groupLabelKey: "emu.audioMixer.group.ay" }
    ];
  }
  setAudioChannelGain(id: string, gain: number): void {
    this.gains[id] = gain;
  }
  getAudioChannelGain(id: string): number {
    return this.gains[id] ?? 1;
  }
  setAudioTapsEnabled(on: boolean): void {
    this.tapsOn = on;
  }
  getAudioTapsEnabled(): boolean {
    return this.tapsOn;
  }
  /* The beeper silent, AY A a 1 kHz sine */
  getAudioChannelTaps(): AudioChannelTaps | undefined {
    if (!this.tapsOn) return undefined;
    const n = 960;
    const samples = new Float32Array(n * 2);
    for (let s = 0; s < n; s++) samples[s * 2 + 1] = 0.5 * Math.sin((2 * Math.PI * 1000 * (this.frame * n + s)) / RATE);
    this.frame++;
    return { channelCount: 2, sampleCount: n, samples };
  }
}

function rig() {
  let now = 0;
  const monitor = new AudioMixerMonitor(() => now);
  const mixer = new FakeMixer();
  monitor.attach({ machineId: "sp128", audioMixer: mixer });
  const frame = () => monitor.onFrame(Array.from({ length: 960 }, () => ({ left: 0, right: 0 })), RATE);
  return { monitor, mixer, frame, advance: (ms: number) => (now += ms) };
}

describe("audio mixer monitor", () => {
  it("switches the taps on at the first request and off after a second without one", () => {
    const { monitor, mixer, frame, advance } = rig();
    frame();
    expect(mixer.tapsOn).toBe(false);
    monitor.requestFrame();
    expect(mixer.tapsOn).toBe(true);
    advance(AUDIO_MIXER_WATCH_TIMEOUT_MS - 1);
    frame();
    expect(mixer.tapsOn).toBe(true);
    advance(2);
    frame();
    expect(mixer.tapsOn).toBe(false);
    expect(monitor.isWatching).toBe(false);
  });

  it("measures each channel from the taps", () => {
    const { monitor, frame } = rig();
    monitor.requestFrame();
    for (let i = 0; i < Math.ceil(FFT_SIZE / 960) + 1; i++) frame();
    const f = monitor.requestFrame()!;
    expect(f.channels.map((c) => c.id)).toEqual(["beeper", "ayA"]);
    expect(f.channels[0].rms).toBe(0);
    expect(f.channels[1].rms).toBeCloseTo(0.5 * Math.SQRT1_2, 2);
    expect(f.sampleRate).toBe(RATE);
  });

  it("applies the machine type's settings as gains at the next frame", () => {
    const { monitor, mixer, frame } = rig();
    monitor.setSettings({ sp128: { ayA: { solo: true } }, sp48: { beeper: { mute: true } } });
    frame();
    expect(mixer.gains).toEqual({ beeper: 0, ayA: 1 });
    monitor.setSettings({ sp128: { ayA: { level: 0.5 } } });
    frame();
    expect(mixer.gains).toEqual({ beeper: 1, ayA: 0.5 });
    expect(monitor.requestFrame()!.channels.map((c) => c.gain)).toEqual([1, 0.5]);
  });

  it("has no frame for a machine without sound", () => {
    const monitor = new AudioMixerMonitor(() => 0);
    monitor.attach({ machineId: "zx81" });
    expect(monitor.requestFrame()).toBeUndefined();
  });
});
