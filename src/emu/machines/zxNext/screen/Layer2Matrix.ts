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
 * 
 * For 320×256 mode, the display area is wider and taller than the standard 256×192 area:
 * - Standard mode: HC 144-399 (256 pixels), VC 64-255 for 50Hz / VC 40-231 for 60Hz (192 lines)
 * - Wide mode (320×256): HC 104-423 (320 pixels), VC 30-285 for 50Hz / VC 6-261 for 60Hz (256 lines)
 * 
 * From VHDL timing:
 * Horizontal:
 * - wide_min_hactive = c_min_hactive - 48 = 136 - 48 = 88
 * - At HC=88, whc resets to -16
 * - whc=0 at HC=104 (start of 320-pixel area)
 * - whc=319 at HC=423 (end of 320-pixel area)
 * 
 * Vertical:
 * - wide_min_vactive = c_min_vactive - 34
 * - For 50Hz +3: c_min_vactive=64, so wide_min_vactive=30, wvc starts at -2
 * - For 60Hz +3: c_min_vactive=40, so wide_min_vactive=6, wvc starts at -2
 * - wvc=0 at VC=32 (50Hz) or VC=8 (60Hz)
 * - wvc=255 at VC=287 (50Hz) or VC=263 (60Hz)
 * - But visible 256 lines: wvc=-2 to 253, so VC=30-285 (50Hz) or VC=6-261 (60Hz)
 * 
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
  // For 320×256 mode, we need a wider horizontal display area
  // Wide display starts 32 pixels earlier: displayXStart - 32 = 144 - 32 = 112
  // Wide display is 320 pixels wide: 112 + 320 - 1 = 431
  const wideDisplayXStart = config.displayXStart - 32;
  const wideDisplayXEnd = wideDisplayXStart + 319;
  
  // Vertical display area is also extended for 320×256 mode
  // wide_min_vactive = c_min_vactive - 34
  // For 50Hz: displayYStart=64, so wide starts at 64-34=30, wvc=-2 to 253 covers 256 lines
  // For 60Hz: displayYStart=40, so wide starts at 40-34=6, wvc=-2 to 253 covers 256 lines
  // The 256 lines span from wide_min_vactive to wide_min_vactive + 255
  const wideDisplayYStart = config.displayYStart - 34;
  const wideDisplayYEnd = wideDisplayYStart + 255;
  console.log(`Wide Display Area HC: ${wideDisplayXStart}-${wideDisplayXEnd}, VC: ${wideDisplayYStart}-${wideDisplayYEnd}`);
  
  // Check if we're in the wide display area
  if (hc < wideDisplayXStart || hc > wideDisplayXEnd ||
      vc < wideDisplayYStart || vc > wideDisplayYEnd) {
    return 0;
  }
  
  // Layer 2 renders during the entire wide display area.
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
