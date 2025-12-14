import { isDisplayArea } from "./matrix-helpers";
import { LoResCell } from "./RenderingCell";
import { TimingConfig } from "./TimingConfig";

/**
 * Generate a single LoRes rendering cell for the 128x96 mode at the given (vc, hc) position.
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
 * @param hc Horizontal counter position (firstVisibleHC to maxHC)
 * @returns ULA Standard rendering cell with all activity flags
 */
export function generateLoResCell(
  config: TimingConfig, 
  vc: number, 
  hc: number
): LoResCell {
  const displayArea = isDisplayArea(config, vc, hc);
  
  return {
    displayArea,
    contentionWindow: false, // LoRes shares VRAM but different timing
    blockFetch: displayArea,
    pixelReplicate: displayArea
  };
}
