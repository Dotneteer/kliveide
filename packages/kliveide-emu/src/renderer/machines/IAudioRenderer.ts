/**
 * Defines the responsibilities of an audio renderer
 */
export interface IAudioRenderer {
  /**
   * Initializes the audio in the browser
   */
  initializeAudio(): Promise<void>;

  /**
   * Stores the samples to render
   * @param samples Next batch of samples to store
   */
  storeSamples(samples: number[]): void;

  /**
   * Closes the audio
   */
  closeAudio(): Promise<void>;
}
