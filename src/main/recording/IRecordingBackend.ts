/**
 * Common interface implemented by every recording backend.
 * Phase A: StubRecordingBackend (writes a text report).
 * Phase B: FfmpegRecordingBackend (writes a real MP4).
 */
export interface IRecordingBackend {
  /**
   * Begin a new recording session.
   * @param outputPath Absolute path of the file to write.
   * @param width  Frame width in pixels (raw machine resolution).
   * @param height Frame height in pixels (raw machine resolution).
   * @param fps    Target frames-per-second written to the file.
   * @param xRatio Horizontal pixel aspect-ratio factor (default 1).
   * @param yRatio Vertical pixel aspect-ratio factor (default 1).
   */
  start(outputPath: string, width: number, height: number, fps: number, xRatio?: number, yRatio?: number): void;

  /**
   * Submit one frame of raw RGBA pixel data.
   */
  appendFrame(rgba: Uint8Array): void;

  /**
   * Hold the last frame (called while the machine is paused).
   * Implementations should count it the same as appendFrame so the
   * video timeline stays continuous.
   */
  holdFrame(): void;

  /**
   * Finalise the recording and flush/close the file.
   * @returns The absolute path of the finished file.
   */
  finish(): Promise<string>;
}
