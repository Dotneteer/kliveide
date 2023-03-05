import { RenderingPhase } from "./RenderingPhase";

/**
 * This structure defines information related to a particular tact of the ULA screen rendering frame.
 */
export type RenderingTact = {
  /**
   * Describe the rendering phase associated with the current tact.
   */
  phase: RenderingPhase;

  /**
   * Display memory address used in the particular tact
   */
  pixelAddress: number;

  /**
   * Display memory address used in the particular tact
   */
  attributeAddress: number;

  /**
   * This property indicates the pixel buffer index associated with the rendering tact. If this tact displays a
   * visible pixel (border or display pixel), this value shows the index in the buffer holding the screen bitmap.
   */
  pixelBufferIndex: number;

  /**
   * This property refers to a function that knows how to render the specified tact.
   * @param tact Tact to render
   */
  renderingAction: (tact: RenderingTact) => void;
};
