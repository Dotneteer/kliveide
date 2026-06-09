import samplingWorklet from "./Sampling.worklet.js?url";
import type { Sp48AudioSample } from "../../../emu/sp48/WasmZxSpectrum48Machine";

let beeperAudioContext: AudioContext | undefined;
let beeperWorklet: AudioWorkletNode | undefined;

export type AudioRendererInfo = {
  context: AudioContext;
  worklet: AudioWorkletNode;
  samplesPerFrame: number;
  sampleRate: number;
};

export async function getBeeperContext(
  tactsInFrame: number,
  baseClockFrequency: number
): Promise<AudioRendererInfo> {
  if (!beeperAudioContext) {
    beeperAudioContext = new AudioContext({ latencyHint: 0.01 });
    await beeperAudioContext.suspend();
    await beeperAudioContext.audioWorklet.addModule(samplingWorklet);
    beeperWorklet = new AudioWorkletNode(beeperAudioContext, "sampling-generator", {
      outputChannelCount: [2]
    });
    beeperWorklet.connect(beeperAudioContext.destination);
  }

  if (!beeperWorklet) {
    throw new Error("Cannot initialize beeper audio worklet.");
  }

  const sampleRate = beeperAudioContext.sampleRate;
  const samplesPerFrame = (tactsInFrame * sampleRate) / baseClockFrequency;
  beeperWorklet.port.postMessage({ initialize: samplesPerFrame });

  return {
    context: beeperAudioContext,
    worklet: beeperWorklet,
    samplesPerFrame,
    sampleRate
  };
}

export async function releaseBeeperContext(): Promise<void> {
  if (beeperAudioContext) {
    await beeperAudioContext.close();
  }
  beeperAudioContext = undefined;
  beeperWorklet = undefined;
}

export class AudioRenderer {
  private readonly context: AudioContext;
  private readonly worklet: AudioWorkletNode;
  private readonly samplesPerFrame: number;
  private suspended = true;

  constructor(audioRenderer: AudioRendererInfo) {
    this.context = audioRenderer.context;
    this.worklet = audioRenderer.worklet;
    this.samplesPerFrame = audioRenderer.samplesPerFrame;
  }

  async play(): Promise<void> {
    if (!this.suspended) {
      return;
    }
    this.suspended = false;
    await this.context.resume();
  }

  async suspend(): Promise<void> {
    if (this.suspended) {
      return;
    }
    this.suspended = true;
    await this.context.suspend();
    this.worklet.port.postMessage({ initialize: this.samplesPerFrame });
  }

  storeSamples(samples: Sp48AudioSample[], soundLevel = 1.0): void {
    if (this.suspended) {
      return;
    }

    const stereoSamples: number[] = [];
    for (const sample of samples) {
      const ear = normalizeSample(sample.left);
      const mic = normalizeSample(sample.right);
      const speaker = (ear * 0.66 + mic * 0.33) * soundLevel;
      stereoSamples.push(speaker);
      stereoSamples.push(speaker);
    }
    this.worklet.port.postMessage({ samples: stereoSamples });
  }
}

function normalizeSample(value: number): number {
  const normalized = Math.abs(value) > 1 ? value / 32768 : value;
  if (normalized > 1) {
    return 1;
  }
  if (normalized < -1) {
    return -1;
  }
  return normalized;
}
