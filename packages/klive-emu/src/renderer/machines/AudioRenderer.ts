import { IAudioRenderer } from "./IAudioRenderer";
import { vmEngineService } from "./core/vm-engine-service";
import { KliveConfiguration } from "../../main/main-state/klive-configuration";

/**
 * Right now, we cannot use AudioWorkletProcessor from TypeScript,
 * so we need to create the worklet in vanilla JavaScript.
 */
const samplingWorklet = require("./Sampling.worklet.js");

/**
 * This class renders audio samples in the browser
 * through Web Audio Api
 */
export class AudioRenderer implements IAudioRenderer {
  private _ctx: AudioContext | undefined;
  private _workletNode: AudioWorkletNode;
  private _appConfig: KliveConfiguration;

  /**
   * Initializes the renderer
   * @param _samplesPerFrame Samples in a single frame
   */
  constructor(private _samplesPerFrame: number) {
    this._appConfig = vmEngineService.getAppConfiguration();
  }

  /**
   * Initializes the audio in the browser
   */
  async initializeAudio(): Promise<void> {
    // --- Create and initialize the context and the buffers
    this._ctx = new AudioContext({ latencyHint: 0.01 });
    this._ctx.suspend();
    await this._ctx.audioWorklet.addModule(samplingWorklet);
    this._workletNode = new AudioWorkletNode(this._ctx, "sampling-generator");
    this._workletNode.port.postMessage({ initialize: this._samplesPerFrame });
    this._workletNode.connect(this._ctx.destination);
    this._workletNode.port.onmessage = (msg) => {
      const starving = msg.data?.diff;
      if (
        this._appConfig?.diagnostics?.soundBufferUnderflow &&
        starving < -6 * this._samplesPerFrame
      )
        console.log(`Sound buffer underflow: ${starving}`);
    };
  }

  /**
   * Suspends the sound
   */
  suspend(): void {
    this._ctx?.suspend();
  }

  /**
   * Resumes the sound
   */
  resume(): void {
    this._ctx?.resume();
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
