import samplingWorkletSource from "./Sampling.worklet.js?raw";
import type { Sp48AudioSample } from "../../../emu/sp48/WasmZxSpectrum48Machine";

let beeperAudioContext: AudioContext | undefined;
let beeperWorklet: AudioWorkletNode | undefined;
let beeperContextPromise: Promise<AudioRendererInfo> | undefined;
let samplingWorkletUrl: string | undefined;

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
  const audioInfo = await getOrCreateBeeperContext();

  const sampleRate = audioInfo.sampleRate;
  const samplesPerFrame = (tactsInFrame * sampleRate) / baseClockFrequency;
  audioInfo.worklet.port.postMessage({ initialize: samplesPerFrame });

  return {
    context: audioInfo.context,
    worklet: audioInfo.worklet,
    samplesPerFrame,
    sampleRate
  };
}

export async function releaseBeeperContext(): Promise<void> {
  await beeperContextPromise;
  if (beeperAudioContext) {
    await beeperAudioContext.close();
  }
  beeperAudioContext = undefined;
  beeperWorklet = undefined;
  beeperContextPromise = undefined;
}

async function getOrCreateBeeperContext(): Promise<AudioRendererInfo> {
  if (beeperAudioContext && beeperWorklet) {
    return {
      context: beeperAudioContext,
      worklet: beeperWorklet,
      samplesPerFrame: 0,
      sampleRate: beeperAudioContext.sampleRate
    };
  }

  beeperContextPromise ??= createBeeperContext().catch((err) => {
    beeperContextPromise = undefined;
    throw err;
  });
  return beeperContextPromise;
}

async function createBeeperContext(): Promise<AudioRendererInfo> {
  try {
    return await createBeeperContextCore(false);
  } catch (err) {
    await closePendingBeeperContext();
    if (!isMissingProcessorError(err)) {
      throw err;
    }
    return createBeeperContextCore(true);
  }
}

async function createBeeperContextCore(forceFreshWorkletUrl: boolean): Promise<AudioRendererInfo> {
  beeperAudioContext = new AudioContext({ latencyHint: 0.01 });
  await beeperAudioContext.suspend();
  await beeperAudioContext.audioWorklet.addModule(getSamplingWorkletUrl(forceFreshWorkletUrl));
  beeperWorklet = new AudioWorkletNode(beeperAudioContext, "sampling-generator", {
    outputChannelCount: [2]
  });
  beeperWorklet.connect(beeperAudioContext.destination);

  return {
    context: beeperAudioContext,
    worklet: beeperWorklet,
    samplesPerFrame: 0,
    sampleRate: beeperAudioContext.sampleRate
  };
}

async function closePendingBeeperContext(): Promise<void> {
  const context = beeperAudioContext;
  beeperAudioContext = undefined;
  beeperWorklet = undefined;
  beeperContextPromise = undefined;
  if (context && context.state !== "closed") {
    await context.close();
  }
}

function getSamplingWorkletUrl(forceFresh = false): string {
  if (forceFresh && samplingWorkletUrl) {
    URL.revokeObjectURL(samplingWorkletUrl);
    samplingWorkletUrl = undefined;
  }
  samplingWorkletUrl ??= URL.createObjectURL(
    new Blob([samplingWorkletSource], { type: "text/javascript" })
  );
  return samplingWorkletUrl;
}

function isMissingProcessorError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("sampling-generator");
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
