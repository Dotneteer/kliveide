/**
 * Right now, we cannot use AudioWorkletProcessor from TypeScript,
 * so we need to create the worklet in vanilla JavaScript.
 */
import samplingWorklet from "./Sampling.worklet.js?url";

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
export async function getBeeperContext (
  samplesPerFrame: number
): Promise<AudioRendererInfo> {
  if (!beeperAudioContext) {
    beeperAudioContext = new AudioContext({ latencyHint: 0.01 });
    beeperAudioContext.suspend();
    await beeperAudioContext.audioWorklet.addModule(samplingWorklet);
    beeperWorklet = new AudioWorkletNode(
      beeperAudioContext,
      "sampling-generator"
    );
    beeperWorklet.connect(beeperAudioContext.destination);
    beeperWorklet.port.postMessage({ initialize: samplesPerFrame });
  }
  return {
    context: beeperAudioContext,
    worklet: beeperWorklet,
    samplesPerFrame
  };
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
  constructor (audioRenderer: AudioRendererInfo) {
    this.context = audioRenderer.context;
    this.worklet = audioRenderer.worklet;
    this.samplesPerFrame = audioRenderer.samplesPerFrame;
    this.context.suspend().then(() => {
      this.suspended = true;
    });
  }

  async play (): Promise<void> {
    if (this.suspended) {
      this.suspended = false;
      await this.context.resume();
    }
  }

  async suspend (): Promise<void> {
    if (this.suspended) return;
    this.suspended = true;
    await this.context.suspend();
    this.worklet.port.postMessage({ initialize: this.samplesPerFrame });
  }

  /**
   * Stores the samples to render
   * @param samples Next batch of samples to store
   */
  storeSamples (samples: number[]): void {
    if (this.suspended) return;
    if (this.worklet) {
      this.worklet.port.postMessage({ samples });
    }
  }
}
