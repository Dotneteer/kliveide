/*
 * The audio mixer's emulator side (`dev/plans/AUDIO_MIXER_PLAN.md` §3.2, phase 4): it lives in the
 * emulator's renderer, beside the machine.
 *
 * - **Watching on demand.** A view (the IDE's Audio Mixer document, the emulator's sound popover) asks
 *   for frames with `requestFrame()`; the first request switches the machine's taps on, and a second
 *   with no request switches them off again, so a closed mixer costs the machine nothing.
 * - **Each emulated frame** (`onFrame`, from the emulator panel's frame loop) adds the frame's taps and
 *   the heard output to the analyzers. The measures are taken only when a view asks.
 * - **The settings** (mute, solo, fader per channel, kept per machine type in a setting) become the
 *   machine's gains through `applyAudioMixerSettings`.
 */

import { AudioChannelAnalyzer, FFT_SIZE, measureWindow, type AudioChannelMeasures } from "@common/audio/audioAnalysis";
import {
  effectiveGains,
  type AudioMixerFrame,
  type AudioMixerSettings
} from "@common/audio/audioMixerModel";
import type { IAudioChannelMixer } from "@emu/abstractions/IAudioChannelMixer";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";

/** A view that has not asked for this long has gone away */
export const AUDIO_MIXER_WATCH_TIMEOUT_MS = 1000;

/** What the monitor needs of a machine */
export type AudioMixerMachine = {
  machineId: string;
  audioMixer?: IAudioChannelMixer;
};

/** Turns one machine type's settings into the machine's gains */
export function applyAudioMixerSettings(machine: AudioMixerMachine | undefined, settings: AudioMixerSettings | undefined): void {
  const mixer = machine?.audioMixer;
  if (!mixer) return;
  const ids = mixer.getAudioChannels().map((c) => c.id);
  const gains = effectiveGains(ids, settings ?? {});
  for (const id of ids) mixer.setAudioChannelGain(id, gains[id]);
}

/** Frames between two applications of the settings (a core set up late, or set up again, gets them) */
const REAPPLY_FRAMES = 50;

export class AudioMixerMonitor {
  private machine?: AudioMixerMachine;
  private settingsByMachine: Record<string, AudioMixerSettings> = {};
  private framesToApply = 0;
  private lastRequest = -Infinity;
  private watching = false;
  private sampleRate = 0;
  private readonly channels = new AudioChannelAnalyzer();
  private readonly output = new AudioChannelAnalyzer();
  private outputBuffer = new Float32Array(0);

  constructor(private readonly now: () => number = () => performance.now()) {}

  /** The machine to watch (a new machine starts every window over) */
  attach(machine: AudioMixerMachine | undefined): void {
    if (machine === this.machine) return;
    this.stopWatching();
    this.machine = machine;
    this.framesToApply = 0;
  }

  /** Every machine type's settings (the setting's value); the machine's gains follow at the next frame */
  setSettings(settingsByMachine: Record<string, AudioMixerSettings> | undefined): void {
    this.settingsByMachine = settingsByMachine ?? {};
    this.framesToApply = 0;
  }

  /** The current machine type's settings */
  get settings(): AudioMixerSettings {
    return (this.machine && this.settingsByMachine[this.machine.machineId]) ?? {};
  }

  /** Whether a view has asked recently */
  get isWatching(): boolean {
    return this.watching;
  }

  /**
   * After an emulated frame: the frame's taps and the heard output join the analyzers
   * @param samples The frame's audio samples (what is heard)
   * @param sampleRate Their rate
   */
  onFrame(samples: readonly AudioSample[], sampleRate: number): void {
    if (--this.framesToApply <= 0) {
      applyAudioMixerSettings(this.machine, this.settings);
      this.framesToApply = REAPPLY_FRAMES;
    }
    if (!this.watching) return;
    if (this.now() - this.lastRequest > AUDIO_MIXER_WATCH_TIMEOUT_MS) {
      this.stopWatching();
      return;
    }
    this.sampleRate = sampleRate;
    const taps = this.machine?.audioMixer?.getAudioChannelTaps();
    if (taps) this.channels.push(taps.samples, taps.sampleCount, taps.channelCount);
    if (this.outputBuffer.length < samples.length) this.outputBuffer = new Float32Array(samples.length * 2);
    for (let i = 0; i < samples.length; i++) this.outputBuffer[i] = (samples[i].left + samples[i].right) / 2;
    this.output.push(this.outputBuffer, samples.length, 1);
  }

  /**
   * A view asks for the current measures: starts (or keeps) the watching
   * @returns undefined when the machine has no sound
   */
  requestFrame(): AudioMixerFrame | undefined {
    const machine = this.machine;
    const mixer = machine?.audioMixer;
    if (!machine || !mixer) return undefined;
    this.lastRequest = this.now();
    if (!this.watching) {
      mixer.setAudioTapsEnabled(true);
      this.watching = true;
    }
    const infos = mixer.getAudioChannels();
    const gains = effectiveGains(
      infos.map((c) => c.id),
      this.settings
    );
    const rate = this.sampleRate || 44_100;
    // --- Before the first frame with taps, every channel reads silence
    const measures = this.channels.measure(rate);
    return {
      machineId: machine.machineId,
      sampleRate: rate,
      channels: infos.map((info, i) => ({
        ...info,
        gain: gains[info.id],
        ...(measures.length === infos.length ? measures[i] : silence())
      })),
      output: this.output.measure(rate)[0] ?? silence()
    };
  }

  private stopWatching(): void {
    if (this.watching) this.machine?.audioMixer?.setAudioTapsEnabled(false);
    this.watching = false;
    this.lastRequest = -Infinity;
    this.channels.reset();
    this.output.reset();
  }
}

/** The measures of a silent window */
function silence(): AudioChannelMeasures {
  return measureWindow(new Float64Array(FFT_SIZE), 44_100);
}

/** The emulator renderer's one monitor */
export const audioMixerMonitor = new AudioMixerMonitor();
