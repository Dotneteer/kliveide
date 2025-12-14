import { SpritesCell } from "./RenderingCell";
import { TimingConfig } from "./TimingConfig";
import { isDisplayArea } from "./matrix-helpers";

/**
 * Generate a single Sprite layer rendering cell for the given (vc, hc) position.
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
 * @param hc Horizontal counter position (firstVisibleHC to maxHC)
 * @returns Sprite layer rendering cell with all activity flags
 */
export function generateSpritesCell(
  config: TimingConfig, 
  vc: number, 
  hc: number
): SpritesCell {
  const displayArea = isDisplayArea(config, vc, hc);
  
  return {
    displayArea,
    contentionWindow: false, // Sprites use internal memory
    lineBufferRead: displayArea,
    visibilityCheck: displayArea
  };
}
