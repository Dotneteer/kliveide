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
      // Create worklet with stereo output (2 channels)
      beeperWorklet = new AudioWorkletNode(beeperAudioContext, "sampling-generator", {
        outputChannelCount: [2]
      });
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
    this.suspended = this.context.state !== "running";
  }

  async play(): Promise<void> {
    // --- A closed context belongs to a machine that has been replaced; its successor plays instead
    if (this.context.state === "closed") return;
    if (this.suspended || this.context.state !== "running") {
      await this.context.resume();
      this.suspended = this.context.state !== "running";
    }
  }

  async suspend(): Promise<void> {
    if (this.suspended || this.context.state === "closed") return;
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
    if (this.worklet) {
      // --- Interleaved stereo samples [L, R, L, R, ...], in a typed array whose buffer is
      // --- *transferred* to the audio thread: no copy, and none of the ~1,900 boxed numbers a plain
      // --- array cost every frame, whose garbage collection could stall the frame loop long enough
      // --- to run the worklet dry
      const stereoSamples = new Float32Array(samples.length * 2);
      for (let i = 0; i < samples.length; i++) {
        stereoSamples[2 * i] = samples[i].left * soundLevel;
        stereoSamples[2 * i + 1] = samples[i].right * soundLevel;
      }
      this.worklet.port.postMessage({ samples: stereoSamples }, [stereoSamples.buffer]);
    }
  }
}
