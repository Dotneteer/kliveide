/**
 * Right now, we cannot use AudioWorkletProcessor from TypeScript,
 * so we need to create the worklet in vanilla JavaScript.
 */
const samplingWorklet = require("./Sampling.worklet.js");

/**
 * This class renders audio samples in the browser
 * through Web Audio Api
 */
export class AudioRenderer {
  private _ctx: AudioContext | undefined;
  private _workletNode: AudioWorkletNode;

  /**
   * Initializes the renderer
   * @param _samplesPerFrame Samples in a single frame
   */
  constructor(private _samplesPerFrame: number) {}

  /**
   * Initializes the audio in the browser
   */
  async initializeAudio(): Promise<void> {
    // --- Create and initialize the context and the buffers
    this._ctx = new AudioContext({ latencyHint: 0.01 });
    await this._ctx.audioWorklet.addModule(samplingWorklet);
    this._workletNode = new AudioWorkletNode(
      this._ctx,
      "sampling-generator"
    );
    this._workletNode.port.postMessage({ initialize: this._samplesPerFrame })
    this._workletNode.connect(this._ctx.destination);
  }

  /**
   * Stores the samples to render
   * @param samples Next batch of samples to store
   */
  storeSamples(samples: number[]) {
    if (this._workletNode) {
      this._workletNode.port.postMessage({samples});
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
