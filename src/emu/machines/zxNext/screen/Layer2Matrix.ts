import { isDisplayArea } from "./matrix-helpers";
import { 
  Layer2Cell,
  LAYER2_DISPLAY_AREA,
  LAYER2_PIXEL_FETCH,
  LAYER2_PALETTE_INDEX
} from "./RenderingCell";
import { TimingConfig } from "./TimingConfig";

/**
 * Generate a single Layer 2 rendering cell for the 256x192 mode at the given (vc, hc) position.
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
 * @param hc Horizontal counter position (firstVisibleHC to maxHC)
 * @returns ULA Standard rendering cell with all activity flags
 */
export function generateLayer2_256x192Cell(
  config: TimingConfig, 
  vc: number, 
  hc: number
): Layer2Cell {
  const displayArea = isDisplayArea(config, vc, hc);
  
  let flags = 0;
  if (displayArea) {
    flags |= LAYER2_DISPLAY_AREA | LAYER2_PIXEL_FETCH | LAYER2_PALETTE_INDEX;
  }
  // Layer 2 uses SRAM, no contention window
  return flags;
}

/**
 * Generate a single Layer 2 rendering cell for the 320x256 mode at the given (vc, hc) position.
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
 * @param hc Horizontal counter position (firstVisibleHC to maxHC)
 * @returns ULA Standard rendering cell with all activity flags
 */
export function generateLayer2_320x256Cell(
  config: TimingConfig, 
  vc: number, 
  hc: number
): Layer2Cell {
  const displayArea = isDisplayArea(config, vc, hc);
  
  let flags = 0;
  if (displayArea) {
    flags |= LAYER2_DISPLAY_AREA | LAYER2_PIXEL_FETCH | LAYER2_PALETTE_INDEX;
  }
  return flags;
}

/**
 * Generate a single Layer 2 rendering cell for the 640x256 mode at the given (vc, hc) position.
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
 * @param hc Horizontal counter position (firstVisibleHC to maxHC)
 * @returns ULA Standard rendering cell with all activity flags
 */
export function generateLayer2_640x256Cell(
  config: TimingConfig, 
  vc: number, 
  hc: number
): Layer2Cell {
  const displayArea = isDisplayArea(config, vc, hc);
  
  let flags = 0;
  if (displayArea) {
    flags |= LAYER2_DISPLAY_AREA | LAYER2_PIXEL_FETCH | LAYER2_PALETTE_INDEX;
  }
  return flags;
}


