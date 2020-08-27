// --- Audio constants
export const FRAMES_BUFFERED = 400;
export const FRAMES_DELAYED = 4;
export const AUDIO_BUFFER_SIZE = 4096;

/**
 * This class renders audio samples in the browser
 * through Web Audio Api
 */
export class AudioRenderer {
  private _ctx: AudioContext | undefined;
  private _waveBuffer = new Float32Array(0);
  private _writeIndex = 0;
  private _readIndex = 0;

  /**
   * Initializes the renderer
   * @param _samplesPerFrame Samples in a single frame
   */
  constructor(private _samplesPerFrame: number) {
    this.initializeAudio();
  }

  /**
   * Initializes the audio in the browser
   */
  initializeAudio() {
    // --- Close the audio, if already initialized
    this.closeAudio();

    // --- Create and initialize the context and the buffers
    this._ctx = new AudioContext();
    this._waveBuffer = new Float32Array(
      (Math.floor(this._samplesPerFrame) + 1) * FRAMES_BUFFERED
    );
    this._writeIndex = 0;
    this._readIndex = 0;
    for (let i = 0; i < FRAMES_DELAYED * this._samplesPerFrame; i++) {
      this._waveBuffer[this._writeIndex++] = 0.0;
    }

    // --- Initialize the audio node
    const node = this._ctx.createScriptProcessor(AUDIO_BUFFER_SIZE, 1, 1);
    const self = this;
    node.onaudioprocess = (e: AudioProcessingEvent) =>
      self._processAudio(self, e);

    // --- Add filters
    const highpass = this._ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 20;
    const lowpass = this._ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 10000;
    node.connect(lowpass);
    lowpass.connect(this._ctx.destination);
    // node.connect(highpass);
    // highpass.connect(lowpass);
    // lowpass.connect(this._ctx.destination);
  }

  /**
   * Stores the samples to render
   * @param samples Next batch of samples to store
   */
  storeSamples(samples: number[]) {
    for (const sample of samples) {
      this._waveBuffer[this._writeIndex++] = sample;
      if (this._writeIndex >= this._waveBuffer.length) {
        this._writeIndex = 0;
      }
    }
  }

  /**
   * Closes the audio
   */
  closeAudio(): void {
    if (this._ctx) {
      this._ctx.close();
      this._ctx = undefined;
    }
  }

  /**
   * Fiils up the audio buffer from the collected samples
   * @param renderer Audio renderer instance that responds to the event
   * @param e Event arguments
   */
  private _processAudio(
    renderer: AudioRenderer,
    e: AudioProcessingEvent
  ): void {
    var output = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < AUDIO_BUFFER_SIZE; i++) {
      output[i] = renderer._waveBuffer[renderer._readIndex++];
      if (renderer._readIndex >= renderer._waveBuffer.length) {
        renderer._readIndex = 0;
      }
    }
  }
}
