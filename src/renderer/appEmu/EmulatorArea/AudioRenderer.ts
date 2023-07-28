/**
 * Right now, we cannot use AudioWorkletProcessor from TypeScript,
 * so we need to create the worklet in vanilla JavaScript.
 */
import samplingWorklet from "./Sampling.worklet.js?url"

/**
 * This class renders audio samples in the browser
 * through Web Audio Api
 */
export class AudioRenderer {
  private _ctx: AudioContext | undefined;
  private _workletNode: AudioWorkletNode;
  private _isSuspended = false;

  /**
   * Initializes the renderer
   * @param _samplesPerFrame Samples in a single frame
   */
  constructor(private _samplesPerFrame: number) {
  }

  /**
   * Initializes the audio in the browser
   */
  async initializeAudio(): Promise<void> {
    // --- Create and initialize the context and the buffers
    this._ctx = new AudioContext({ latencyHint: 0.01 });
    this._ctx.suspend();
    this._isSuspended = true;
    await this._ctx.audioWorklet.addModule(samplingWorklet);
    this._workletNode = new AudioWorkletNode(this._ctx, "sampling-generator");
    this._workletNode.port.postMessage({ initialize: this._samplesPerFrame });
    this._workletNode.connect(this._ctx.destination);
  }

  /**
   * Plays the sound
   */
  async play(): Promise<void> {
    if (!this._ctx) {
      await this.initializeAudio();
    }
    if (this._isSuspended) {
      this._ctx?.resume();
    }
  }

  /**
   * Stores the samples to render
   * @param samples Next batch of samples to store
   */
  storeSamples(samples: number[]): void {
    if (this._workletNode) {
      this._workletNode.port.postMessage({ samples });
    }
  }

  /**
   * Closes the audio
   */
  async closeAudio(): Promise<void> {
    if (this._ctx) {
      await this._ctx.close();
      this._ctx = undefined;
    }
  }
}