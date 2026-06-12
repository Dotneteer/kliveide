/**
 * Common interface implemented by screen recording backends.
 */
export interface IRecordingBackend {
  /**
   * Begin a new recording session.
   */
  start(
    outputPath: string,
    width: number,
    height: number,
    fps: number,
    xRatio?: number,
    yRatio?: number,
    sampleRate?: number,
    crf?: number,
    format?: string
  ): void;

  /**
   * Submit one frame of raw RGBA pixel data.
   */
  appendFrame(rgba: Uint8Array): void;

  /**
   * Hold the last frame while recording is paused.
   */
  holdFrame(): void;

  /**
   * Submit a batch of interleaved stereo audio samples.
   */
  appendAudioSamples(samples: Float32Array): void;

  /**
   * Finalize the recording and return the completed output path.
   */
  finish(): Promise<string>;
}
