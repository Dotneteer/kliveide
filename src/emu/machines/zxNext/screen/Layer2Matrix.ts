import { isDisplayArea } from "./matrix-helpers";
import { 
  Layer2Cell,
  LAYER2_DISPLAY_AREA,
  LAYER2_PIXEL_FETCH,
  LAYER2_PALETTE_INDEX
} from "./RenderingCell";
import { TimingConfig } from "./TimingConfig";

/**
 * Check if coordinate is valid for Layer 2 256×192 mode.
 * Uses phc (practical horizontal counter) and pvc (practical vertical counter).
 * 
 * @param vc Vertical counter (pvc)
 * @param hc Horizontal counter (phc)
 * @returns true if coordinate is within valid Layer 2 256×192 display area
 */
function isValidLayer2Coordinate_256x192(vc: number, hc: number): boolean {
  // Valid horizontal: phc[8] = 0 (0-255)
  if ((hc & 0x100) !== 0) return false;
  
  // Valid vertical: vc[8] = 0 AND vc[7:6] ≠ 11 (0-191)
  if ((vc & 0x100) !== 0 || (vc & 0xC0) === 0xC0) return false;
  
  return true;
}

/**
 * Check if coordinate is valid for Layer 2 320×256 or 640×256 modes.
 * Uses whc (wide horizontal counter) and wvc (wide vertical counter).
 * 
 * @param vc Vertical counter (wvc)
 * @param hc Horizontal counter (whc)
 * @returns true if coordinate is within valid Layer 2 wide mode display area
 */
function isValidLayer2Coordinate_Wide(vc: number, hc: number): boolean {
  // Valid horizontal: whc[8] = 0 OR whc[7:6] = 00 (0-319)
  const hcValid = (hc & 0x100) === 0 || (hc & 0x1C0) === 0;
  if (!hcValid) return false;
  
  // Valid vertical: wvc[8] = 0 (0-255)
  if ((vc & 0x100) !== 0) return false;
  
  return true;
}

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
  // Check if we're in the display area first
  const displayArea = isDisplayArea(config, vc, hc);
  if (!displayArea) {
    return 0; // No Layer 2 activity outside display area
  }
  
  // Check if coordinate is valid for Layer 2 256×192 mode
  // Layer 2 uses phc/pvc which have different ranges than ULA
  const validCoord = isValidLayer2Coordinate_256x192(vc, hc);
  
  let flags = 0;
  if (validCoord) {
    flags |= LAYER2_DISPLAY_AREA | LAYER2_PIXEL_FETCH | LAYER2_PALETTE_INDEX;
  }
  
  // Layer 2 uses SRAM (no Z80 bus contention)
  return flags;
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
  
  // Check if coordinate is valid for wide mode
  const validCoord = isValidLayer2Coordinate_Wide(vc, hc);
  
  let flags = 0;
  if (validCoord) {
    flags |= LAYER2_DISPLAY_AREA | LAYER2_PIXEL_FETCH | LAYER2_PALETTE_INDEX;
  }
  
  return flags;
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
  
  // Check if coordinate is valid for wide mode (same as 320×256)
  const validCoord = isValidLayer2Coordinate_Wide(vc, hc);
  
  let flags = 0;
  if (validCoord) {
    // In 640×256 mode, we render 2 pixels per CLK_7 cycle
    // Both pixels use the same fetch but different bit selection
    flags |= LAYER2_DISPLAY_AREA | LAYER2_PIXEL_FETCH | LAYER2_PALETTE_INDEX;
  }
  
  return flags;
}
