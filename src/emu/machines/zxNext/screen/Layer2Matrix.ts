import { isDisplayArea } from "./matrix-helpers";
import { 
  Layer2Cell,
  LayerOutput,
  LAYER2_DISPLAY_AREA,
} from "./RenderingCell";
import { TimingConfig } from "./TimingConfig";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * Interface for Layer 2 pixel rendering context.
 * Contains all state and configuration needed to render Layer 2 pixels.
 */
export interface ILayer2RenderingState {
  // Machine reference for memory and palette access
  machine: IZxNextMachine;

  // Timing configuration
  confDisplayXStart: number;
  confDisplayYStart: number;

  // Layer 2 configuration
  layer2ScrollX: number;
  layer2ScrollY: number;
  layer2ClipWindowX1: number;
  layer2ClipWindowX2: number;
  layer2ClipWindowY1: number;
  layer2ClipWindowY2: number;
  layer2PaletteOffset: number;
  layer2ActiveRamBank: number;
  layer2ShadowRamBank: number;
  layer2UseShadowBank: boolean;
  globalTransparencyColor: number;
}

/**
 * Scanline state for Layer 2 320×256 mode rendering.
 * Precomputed per scanline to avoid redundant per-pixel calculations.
 */
interface Layer2ScanlineState320x256 {
  vc: number;
  displayVC: number;
  displayVC_wide: number;
  vc_valid: boolean;
  clippedByVertical: boolean;
  y: number;  // Final Y coordinate after scrolling
  bank: number;  // Active memory bank
}

/**
 * Lookup table for 320-pixel X-coordinate wrapping with scrolling.
 * Pre-calculated to avoid branch prediction issues and bit manipulation per pixel.
 */
const xWrappingTable320 = new Uint16Array(1024);

// Initialize X-wrapping lookup table
for (let i = 0; i < 1024; i++) {
  let x = i;
  if (x >= 320 && x < 512) {
    const upper = ((x >> 6) & 0x7) + 3;
    x = (upper << 6) | (x & 0x3F);
  }
  xWrappingTable320[i] = x & 0x1FF;
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

/**
 * Get a pixel byte from Layer 2 SRAM memory.
 * @param device Rendering device state
 * @param bank16K Starting 16K bank number
 * @param offset Byte offset within the Layer 2 display buffer
 * @returns Pixel byte value (0-255)
 */
function getLayer2PixelFromSRAM(
  device: ILayer2RenderingState,
  bank16K: number,
  offset: number
): number {
  const segment16K = (offset >> 14) & 0x07;
  const half8K = (offset >> 13) & 0x01;
  const bank8K = (bank16K + segment16K) * 2 + half8K;
  const offsetWithin8K = offset & 0x1FFF;
  const memoryOffset = 0x040000 + bank8K * 0x2000 + offsetWithin8K;
  return device.machine.memoryDevice.memory[memoryOffset] || 0;
}

/**
 * Render Layer 2 256×192 mode pixel.
 * @param device Rendering device state
 * @param vc Vertical counter position
 * @param hc Horizontal counter position
 * @param cell Layer 2 rendering cell with activity flags
 */
export function renderLayer2_256x192Pixel(
  device: ILayer2RenderingState,
  vc: number,
  hc: number,
  cell: number
): LayerOutput {
  if ((cell & LAYER2_DISPLAY_AREA) === 0) {
    return { rgb333: 0, transparent: true, clipped: false };
  }

  const displayVC = vc - device.confDisplayYStart;
  const displayHC = hc - device.confDisplayXStart;
  
  if (displayHC < device.layer2ClipWindowX1 || displayHC > device.layer2ClipWindowX2 ||
      displayVC < device.layer2ClipWindowY1 || displayVC > device.layer2ClipWindowY2) {
    return { rgb333: 0, transparent: true, clipped: true };
  }
  
  const x = (displayHC + device.layer2ScrollX) & 0xFF;
  const y = (displayVC + device.layer2ScrollY) % 192;
  const bank = device.layer2UseShadowBank ? device.layer2ShadowRamBank : device.layer2ActiveRamBank;
  const offset = (y << 8) | x;
  const pixelValue = getLayer2PixelFromSRAM(device, bank, offset);
  
  if (pixelValue === device.globalTransparencyColor) {
    return { rgb333: 0, transparent: true, clipped: false };
  }
  
  const upperNibble = ((pixelValue >> 4) + (device.layer2PaletteOffset & 0x0F)) & 0x0F;
  const paletteIndex = (upperNibble << 4) | (pixelValue & 0x0F);
  const rgb333 = device.machine.paletteDevice.getLayer2Rgb333(paletteIndex);
  const priority = (rgb333 & 0x100) !== 0;
  
  return { rgb333: rgb333 & 0x1FF, transparent: false, clipped: false, priority };
}

/**
 * Prepare scanline state for 320×256 mode rendering.
 * Precomputes all per-scanline constants to avoid redundant calculations.
 * Priority 1A: Scanline-based state precomputation.
 */
function prepareScanlineState320x256(
  device: ILayer2RenderingState,
  vc: number
): Layer2ScanlineState320x256 | null {
  const displayVC = vc - device.confDisplayYStart;
  const displayVC_wide = displayVC + 32;
  const vc_valid = displayVC_wide >= 0 && displayVC_wide < 256;
  
  // Priority 1B: Early scanline rejection
  if (!vc_valid) {
    return null;
  }
  
  const clipY1 = device.layer2ClipWindowY1;
  const clipY2 = device.layer2ClipWindowY2;
  const clippedByVertical = displayVC_wide < clipY1 || displayVC_wide > clipY2;
  
  // Priority 1B: Early scanline rejection for clipped scanlines
  if (clippedByVertical) {
    return null;
  }
  
  const y_pre = displayVC_wide + device.layer2ScrollY;
  const y = y_pre & 0xFF;
  const bank = device.layer2UseShadowBank ? device.layer2ShadowRamBank : device.layer2ActiveRamBank;
  
  return {
    vc,
    displayVC,
    displayVC_wide,
    vc_valid,
    clippedByVertical,
    y,
    bank
  };
}

/**
 * Fast path for 320×256 mode with no scrolling and full clip window.
 * Priority 1C & 3H: Optimized memory access for common case.
 */
function renderLayer2_320x256Pixel_FastPath(
  device: ILayer2RenderingState,
  scanline: Layer2ScanlineState320x256,
  hc: number
): LayerOutput {
  const displayHC_wide = (hc - device.confDisplayXStart) + 32;
  
  // Fast bounds check (no clipping needed)
  if (displayHC_wide >= 320) {
    return { rgb333: 0, transparent: true, clipped: false };
  }
  
  // Sequential memory access: offset = (x << 8) | y
  const offset = (displayHC_wide << 8) | scanline.y;
  const segment16K = (offset >> 14) & 0x07;
  const half8K = (offset >> 13) & 0x01;
  const bank8K = (scanline.bank + segment16K) * 2 + half8K;
  const offsetWithin8K = offset & 0x1FFF;
  const memoryOffset = 0x040000 + bank8K * 0x2000 + offsetWithin8K;
  const pixelValue = device.machine.memoryDevice.memory[memoryOffset] || 0;
  
  if (pixelValue === device.globalTransparencyColor) {
    return { rgb333: 0, transparent: true, clipped: false };
  }
  
  const upperNibble = ((pixelValue >> 4) + (device.layer2PaletteOffset & 0x0F)) & 0x0F;
  const paletteIndex = (upperNibble << 4) | (pixelValue & 0x0F);
  const rgb333 = device.machine.paletteDevice.getLayer2Rgb333(paletteIndex);
  const priority = (rgb333 & 0x100) !== 0;
  
  return { rgb333: rgb333 & 0x1FF, transparent: false, clipped: false, priority };
}

/**
 * Render Layer 2 320×256 mode pixel (original implementation with optimizations).
 * @param device Rendering device state
 * @param vc Vertical counter position
 * @param hc Horizontal counter position
 * @param cell Layer 2 rendering cell with activity flags
 */
export function renderLayer2_320x256Pixel(
  device: ILayer2RenderingState,
  vc: number,
  hc: number,
  cell: number
): LayerOutput {
  if ((cell & LAYER2_DISPLAY_AREA) === 0) {
    return { rgb333: 0, transparent: true, clipped: false };
  }

  // Priority 1A: Prepare scanline state (would be cached per scanline in real implementation)
  const scanline = prepareScanlineState320x256(device, vc);
  
  // Priority 1B: Early rejection for clipped/invalid scanlines
  if (!scanline) {
    return { rgb333: 0, transparent: true, clipped: true };
  }
  
  // Priority 3H: Fast path for unscrolled, unclipped content
  if (device.layer2ScrollX === 0 && device.layer2ScrollY === 0 &&
      device.layer2ClipWindowX1 === 0 && device.layer2ClipWindowX2 === 159 &&
      device.layer2ClipWindowY1 === 0 && device.layer2ClipWindowY2 === 255) {
    return renderLayer2_320x256Pixel_FastPath(device, scanline, hc);
  }

  // General path with full feature support
  const displayHC_wide = (hc - device.confDisplayXStart) + 32;
  
  const clipX1 = device.layer2ClipWindowX1 << 1;
  const clipX2 = (device.layer2ClipWindowX2 << 1) | 1;
  
  const hc_valid = displayHC_wide < 320;
  
  if (!hc_valid || displayHC_wide < clipX1 || displayHC_wide > clipX2) {
    return { rgb333: 0, transparent: true, clipped: true };
  }
  
  const x_pre = displayHC_wide + device.layer2ScrollX;
  
  // Priority 2D: Use lookup table for X-coordinate wrapping
  const x = xWrappingTable320[x_pre & 0x3FF];
  
  const offset = (x << 8) | scanline.y;
  const pixelValue = getLayer2PixelFromSRAM(device, scanline.bank, offset);
  
  if (pixelValue === device.globalTransparencyColor) {
    return { rgb333: 0, transparent: true, clipped: false };
  }
  
  const upperNibble = ((pixelValue >> 4) + (device.layer2PaletteOffset & 0x0F)) & 0x0F;
  const paletteIndex = (upperNibble << 4) | (pixelValue & 0x0F);
  const rgb333 = device.machine.paletteDevice.getLayer2Rgb333(paletteIndex);
  const priority = (rgb333 & 0x100) !== 0;
  
  return { rgb333: rgb333 & 0x1FF, transparent: false, clipped: false, priority };
}

/**
 * Render Layer 2 640×256 mode pixel.
 * @param device Rendering device state
 * @param _vc Vertical counter position
 * @param _hc Horizontal counter position
 * @param _cell Layer 2 rendering cell with activity flags
 * @param _pixelIndex Which pixel of the pair (0 or 1)
 */
export function renderLayer2_640x256Pixel(
  device: ILayer2RenderingState,
  _vc: number,
  _hc: number,
  _cell: number,
  _pixelIndex: number
): LayerOutput {
  // TODO: Implementation to be documented in a future section
  return { rgb333: 0x00000000, transparent: true, clipped: false };
}
