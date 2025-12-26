import { isDisplayArea } from "./matrix-helpers";
import { 
  Layer2Cell,
  LAYER2_DISPLAY_AREA,
  LAYER2_PIXEL_FETCH,
  LAYER2_PALETTE_INDEX
} from "./RenderingCell";
import { TimingConfig } from "./TimingConfig";

/**
 * Generate a single Layer 2 rendering cell for the 256×192 mode at the given (vc, hc) position.
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
 * @param hc Horizontal counter position (firstVisibleHC to maxHC)
 * @returns Layer 2 rendering cell with all activity flags
 */
export function generateLayer2_256x192Cell(
  config: TimingConfig, 
  vc: number, 
  hc: number
): Layer2Cell {
  // Check if we're in the display area
  const displayArea = isDisplayArea(config, vc, hc);
  if (!displayArea) {
    return 0; // No Layer 2 activity outside display area
  }
  
  // Layer 2 renders during the entire display area.
  // In Option B rendering (no cycle-exact timing), pixel fetch, coordinate transformation,
  // clipping, and palette lookup all happen atomically in the rendering pipeline.
  return LAYER2_DISPLAY_AREA;
}

/**
 * Generate a single Layer 2 rendering cell for the 320×256 mode at the given (vc, hc) position.
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
 * @param hc Horizontal counter position (firstVisibleHC to maxHC)
 * @returns Layer 2 rendering cell with all activity flags
 */
export function generateLayer2_320x256Cell(
  config: TimingConfig, 
  vc: number, 
  hc: number
): Layer2Cell {
  // Check if we're in the display area
  const displayArea = isDisplayArea(config, vc, hc);
  if (!displayArea) {
    return 0;
  }
  
  // Layer 2 renders during the entire display area.
  // Coordinate transformation and validity checks happen in the rendering pipeline.
  return LAYER2_DISPLAY_AREA;
}

/**
 * Generate a single Layer 2 rendering cell for the 640×256 mode at the given (vc, hc) position.
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
 * @param hc Horizontal counter position (firstVisibleHC to maxHC)
 * @returns Layer 2 rendering cell with all activity flags
 */
export function generateLayer2_640x256Cell(
  config: TimingConfig, 
  vc: number, 
  hc: number
): Layer2Cell {
  // Check if we're in the display area
  const displayArea = isDisplayArea(config, vc, hc);
  if (!displayArea) {
    return 0;
  }
  
  // In 640×256 mode, we render 2 pixels per CLK_7 cycle.
  // Coordinate transformation and validity checks happen in the rendering pipeline.
  return LAYER2_DISPLAY_AREA;
}
