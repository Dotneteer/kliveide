import { isDisplayArea } from "./matrix-helpers";
import { 
  LoResCell,
  LORES_DISPLAY_AREA,
  LORES_BLOCK_FETCH,
  LORES_PIXEL_REPLICATE
} from "./RenderingCell";
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
  
  let flags = 0;
  if (displayArea) {
    flags |= LORES_DISPLAY_AREA | LORES_BLOCK_FETCH | LORES_PIXEL_REPLICATE;
  }
  // LoRes shares VRAM but different timing, no contention window
  return flags;
}
