/**
 * Options of a recording session beyond the frame geometry and the encoding choices.
 */
export type RecordingStartOptions = {
  /**
   * The byte order of the frames passed to `appendFrame` (default "rgba"). The IDE + Emulator
   * recording sends Electron's `NativeImage` bitmaps as they are, which are BGRA.
   */
  pixelFormat?: "rgba" | "bgra";
  /**
   * Favour encoding speed over file size (default false). Used when the frames are large and come
   * from the wall clock, so the encoder has to keep up with real time.
   */
  realtime?: boolean;
};

/**
 * Common interface implemented by every recording backend.
 * Phase A: StubRecordingBackend (writes a text report).
 * Phase B: FfmpegRecordingBackend (writes a real MP4).
 */
export interface IRecordingBackend {
  /**
   * Begin a new recording session.
   * @param outputPath  Absolute path of the file to write.
   * @param width       Frame width in pixels (raw machine resolution).
   * @param height      Frame height in pixels (raw machine resolution).
   * @param fps         Target frames-per-second written to the file.
   * @param xRatio      Horizontal pixel aspect-ratio factor (default 1).
   * @param yRatio      Vertical pixel aspect-ratio factor (default 1).
   * @param sampleRate  Audio sample rate in Hz (default 44100).
   * @param crf         Quality parameter for H.264/H.265 (default 18).
   * @param format      Output format: "mp4" (H.264), "webm" (VP9), or "mkv" (H.265).
   * @param options     Pixel format and speed options (see `RecordingStartOptions`).
   */
  start(outputPath: string, width: number, height: number, fps: number, xRatio?: number, yRatio?: number, sampleRate?: number, crf?: number, format?: string, options?: RecordingStartOptions): void;

  /**
   * Submit one frame of raw pixel data (RGBA, or BGRA when the session was started so).
   * @param onWritten Called once the frame has been handed to the encoder, after which the caller
   * may reuse the buffer. A backend that copies the frame immediately calls it at once.
   * @returns false when the encoder's input is backed up; the caller should wait for
   * `onceDrained` before composing more frames. A backend without backpressure returns true.
   */
  appendFrame(rgba: Uint8Array, onWritten?: () => void): boolean;

  /**
   * Calls `callback` once the encoder's input has drained after `appendFrame` returned false
   * (immediately when it is not backed up).
   */
  onceDrained(callback: () => void): void;

  /**
   * Hold the last frame (called while the machine is paused).
   * Implementations should count it the same as appendFrame so the
   * video timeline stays continuous.
   */
  holdFrame(): void;

  /**
   * Submit one batch of interleaved stereo audio samples (f32le, [L, R, L, R, …]).
   * No-op if the implementation does not support audio.
   */
  appendAudioSamples(samples: Float32Array): void;

  /**
   * Finalise the recording and flush/close the file.
   * @returns The absolute path of the finished file.
   * @throws When no file could be written; the message says why, for the user.
   */
  finish(): Promise<string>;
}
