/**
 * Right now, we cannot use AudioWorkletProcessor from TypeScript,
 * so we need to create the worklet in vanilla JavaScript.
 */
import samplingWorklet from "./Sampling.worklet.js?url";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";

// --- Let's create audio contextes before using the renderers
let beeperAudioContext: AudioContext | undefined;
let beeperWorklet: AudioWorkletNode | undefined;

// --- Infomation about an audio renderer
export type AudioRendererInfo = {
  context: AudioContext;
  worklet: AudioWorkletNode;
  samplesPerFrame: number;
};

// --- Initialize the audio context of the beeper (or use the cached instance)
export async function getBeeperContext(samplesPerFrame: number): Promise<AudioRendererInfo> {
  if (!beeperAudioContext) {
    beeperAudioContext = new AudioContext({ latencyHint: 0.01 });
    await beeperAudioContext.suspend();
    await beeperAudioContext.audioWorklet.addModule(samplingWorklet);
    try {
      beeperWorklet = new AudioWorkletNode(beeperAudioContext, "sampling-generator");
      beeperWorklet.connect(beeperAudioContext.destination);
      beeperWorklet.port.postMessage({ initialize: samplesPerFrame });
    } catch (err) {
      // --- Ignore this error intentionally
    }
  }
  return {
    context: beeperAudioContext,
    worklet: beeperWorklet,
    samplesPerFrame
  };
}

export async function releaseBeeperContext(): Promise<void> {
  if (beeperAudioContext) {
    await beeperAudioContext.close();
  }
  beeperAudioContext = undefined;
}
/**
 * This class renders audio samples in the browser
 * through Web Audio Api
 */
export class AudioRenderer {
  private readonly context: AudioContext;
  private readonly worklet: AudioWorkletNode;
  private readonly samplesPerFrame: number;
  private suspended: boolean;

  /**
   * Initializes the renderer
   * @param _samplesPerFrame Samples in a single frame
   */
  constructor(audioRenderer: AudioRendererInfo) {
    this.context = audioRenderer.context;
    this.worklet = audioRenderer.worklet;
    this.samplesPerFrame = audioRenderer.samplesPerFrame;
    this.context.suspend().then(() => {
      this.suspended = true;
    });
  }

  async play(): Promise<void> {
    if (this.suspended) {
      this.suspended = false;
      await this.context.resume();
    }
  }

  async suspend(): Promise<void> {
    if (this.suspended) return;
    this.suspended = true;
    await this.context.suspend();
    this.worklet.port.postMessage({ initialize: this.samplesPerFrame });
  }

  /**
   * Stores the samples to render
   * @param samples Next batch of stereo samples to store
   * @param soundLevel Sound level multiplier (0.0 to 1.0)
   */
  storeSamples(samples: AudioSample[], soundLevel: number = 1.0): void {
    if (this.suspended) return;
    if (this.worklet) {
      // Downmix stereo to mono: (left + right) / 2
      const monoSamples = samples.map(s => (s.left + s.right) / 2 * soundLevel);
      this.worklet.port.postMessage({ samples: monoSamples });
    }
  }
}
