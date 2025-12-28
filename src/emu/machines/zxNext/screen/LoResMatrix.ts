import { isDisplayArea, isVisibleArea } from "./matrix-helpers";
import { 
  LoResCell,
  LayerOutput,
  LORES_DISPLAY_AREA,
  LORES_NREG_SAMPLE,
  LORES_BLOCK_FETCH,
  LORES_PIXEL_REPLICATE
} from "./RenderingCell";
import { TimingConfig } from "./TimingConfig";
import type { IPixelRenderingState } from "./UlaMatrix";

/**
 * Generate a single LoRes rendering cell for the 128x96 mode at the given (vc, hc) position.
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
 * @param hc Horizontal counter position (firstVisibleHC to maxHC)
 * @returns LoRes rendering cell with all activity flags
 */
export function generateLoResCell(
  config: TimingConfig, 
  vc: number, 
  hc: number
): LoResCell {
  // Check if we're in visible area
  if (!isVisibleArea(config, vc, hc)) {
    return 0;
  }
  
  const displayArea = isDisplayArea(config, vc, hc);
  let flags = 0;
  
  if (displayArea) {
    flags |= LORES_DISPLAY_AREA;
    
    // Extract HC subcycle position (hc[3:0])
    const hcSub = hc & 0x0f;
    
    // Scroll/mode sample at HC subcycle positions 0x7 and 0xF (like ULA)
    if (hcSub === 0x07 || hcSub === 0x0f) {
      flags |= LORES_NREG_SAMPLE;
    }
    
    // Block fetch and pixel replicate on every HC position in display area
    flags |= LORES_BLOCK_FETCH | LORES_PIXEL_REPLICATE;
  }
  
  return flags;
}

/**
 * Render LoRes pixel for the current tact position (Stage 1: Pixel Generation).
 *
 * LoRes mode (Radastan mode from ZX Uno):
 * - 128×96 resolution in standard 256×192 display area (each LoRes pixel = 2×2 ULA pixels)
 * - Two sub-modes:
 *   * Standard LoRes: 8-bit color (256 colors), $4000-$57FF top, $6000-$77FF bottom
 *   * Radastan LoRes: 4-bit color (16 colors), uses Timex dfile selector
 * - Each memory byte covers a 2×2 pixel block (standard) or 2×4 block (radastan, 2 nibbles)
 * - Simpler addressing than ULA: y(7:1) & x(7:1) for standard, linear with y/2
 * - No shift register needed: pixels replicated directly from block byte
 * - Scrolling wraps at 192 lines (like ULA), not 96
 *
 * @param device - Device context implementing IPixelRenderingState interface
 * @param vc - Vertical counter position (ULA coordinate system)
 * @param hc - Horizontal counter position (ULA coordinate system)
 * @param cell - LoRes rendering cell flags (Uint16 bit flags)
 * @returns Layer output (RGB333 + flags) for composition stage
 */
export function renderLoResPixel(
  device: IPixelRenderingState,
  vc: number,
  hc: number,
  cell: LoResCell
): LayerOutput {
  // === STAGE 1: Scroll & Mode Sampling ===
  if ((cell & LORES_NREG_SAMPLE) !== 0) {
    // Sample scroll registers and mode flags
    device.loResScrollXSampled = device.ulaScrollX;
    device.loResScrollYSampled = device.ulaScrollY;
    device.loResEnabledSampled = device.loResEnabled;
    device.loResModeSampled = device.loResMode;
  }

  // === STAGE 2: Block Memory Fetch ===
  // Fetch every 2 HC positions (one LoRes block = 2×2 pixels in 256×192 space)
  // Standard mode: each byte = 2×2 pixels, Radastan: each byte = 2 nibbles for 2×4 pixels
  if ((cell & LORES_BLOCK_FETCH) !== 0) {
    // Calculate display coordinates
    const displayHC = hc - device.confDisplayXStart;
    const displayVC = vc - device.confDisplayYStart;
    
    // Apply scroll (matching VHDL: x <= hc_i(7 downto 0) + scroll_x_i)
    const x = (displayHC + device.loResScrollXSampled) & 0xff;
    
    // Apply Y scroll with 192-line wrap (matching VHDL logic)
    let y_pre = displayVC + device.loResScrollYSampled;
    let y: number;
    if (y_pre >= 192) {
      // Wrap: y(7 downto 6) <= (y_pre(7 downto 6) + 1)
      const upperBits = ((y_pre >> 6) + 1) & 0x03;
      y = (upperBits << 6) | (y_pre & 0x3f);
    } else {
      y = y_pre & 0xff;
    }
    
    // Fetch when entering new block horizontally
    // Standard mode: fetch when x[0]=0 (every 2 pixels)
    // Radastan mode: fetch when x[1:0]=0 (every 4 pixels)
    // Note: Y coordinate is already used in address calculation - we fetch on every scanline
    const shouldFetch = device.loResModeSampled === 0 ? 
      ((x & 0x01) === 0) :
      ((x & 0x03) === 0);
    
    if (shouldFetch) {
      let blockAddr: number;
      
      if (device.loResModeSampled === 0) {
        // Standard LoRes: 8-bit color, 128×96 blocks
        // Address: y(7 downto 1) & x(7 downto 1) - from VHDL
        const lores_addr_pre = ((y >> 1) << 7) | (x >> 1);
        
        // Top/bottom half split: when y >= 96, increment bits 13:11 (adds 0x0800)
        // VHDL: lores_addr(13 downto 11) <= (lores_addr_pre(13 downto 11) + 1)
        blockAddr = (y >= 96) ? (lores_addr_pre + 0x0800) : lores_addr_pre;
      } else {
        // Radastan LoRes: 4-bit color, uses Timex display file selector
        // Address: timexDFile bit + y(7 downto 1) * 64 + x(7 downto 2)
        // VHDL: lores_addr_rad <= dfile_i & y(7 downto 1) & x(7 downto 2)
        // Bit layout: [dfile(1)][y(7:1)(7)][x(7:2)(6)] = 14 bits
        blockAddr = (device.timexDFile << 13) | ((y >> 1) << 6) | (x >> 2);
      }
      
      // Read from Bank 5 memory (ULA memory space)
      device.loResBlockByte = device.machine.memoryDevice.readScreenMemory(blockAddr);
    }
  }

  // === STAGE 3: Border Area ===
  if ((cell & LORES_DISPLAY_AREA) === 0) {
    // Border uses cached border RGB value (same as ULA)
    return {
      rgb333: device.borderRgbCache,
      transparent: false,
      clipped: false
    };
  }

  // === STAGE 4: Pixel Generation ===
  // Generate pixel from block byte (happens every HC position)
  const displayHC = hc - device.confDisplayXStart;
  const displayVC = vc - device.confDisplayYStart;
  
  // Apply scroll to get pixel position (matching VHDL)
  const x = (displayHC + device.loResScrollXSampled) & 0xff;
  
  let pixelRgb333: number;
  
  if (device.loResModeSampled === 0) {
    // Standard LoRes: 8-bit color with palette offset on high nibble
    // VHDL: pixel_lores_nib_H <= lores_data_i(7 downto 4) + lores_palette_offset_i
    //       lores_pixel_o <= pixel_lores_nib_H & lores_data_i(3 downto 0)
    // High nibble gets palette offset added, low nibble used directly
    const highNibble = ((device.loResBlockByte >> 4) + device.loresPaletteOffset) & 0x0f;
    const lowNibble = device.loResBlockByte & 0x0f;
    const paletteIndex = (highNibble << 4) | lowNibble;
    pixelRgb333 = device.machine.paletteDevice.getUlaRgb333(paletteIndex);
  } else {
    // Radastan LoRes: 4-bit color with palette offset
    // Each byte has 2 nibbles: high nibble for left pixels, low nibble for right pixels
    // Bit 1 of X position selects nibble (matching VHDL: x(1) = '0')
    const nibble = (x & 0x02) ?
      (device.loResBlockByte & 0x0f) :           // Right nibble (when x[1]=1)
      ((device.loResBlockByte >> 4) & 0x0f);     // Left nibble (when x[1]=0)
    
    // Palette index construction follows VHDL implementation (lores.vhd lines 110-112)
    let paletteIndex: number;
    if (device.ulaPlusEnabled) {
      // ULA+ mode: use group 3 (bits 7:6 = 11) with palette offset in bits 3:2
      paletteIndex = 0xc0 | ((device.loresPaletteOffset & 0x03) << 2) | nibble;
    } else {
      // Standard mode: palette offset in upper nibble
      paletteIndex = ((device.loresPaletteOffset & 0x0f) << 4) | nibble;
    }
    
    pixelRgb333 = device.machine.paletteDevice.getUlaRgb333(paletteIndex);
  }

  // === STAGE 5: Clipping Test ===
  // Check if pixel is within ULA clip window (LoRes uses ULA clip window)
  const clipped =
    displayHC < device.ulaClipWindowX1 ||
    displayHC > device.ulaClipWindowX2 ||
    displayVC < device.ulaClipWindowY1 ||
    displayVC > device.ulaClipWindowY2;

  // === STAGE 6: Return Layer Output ===
  return {
    rgb333: pixelRgb333,
    transparent: pixelRgb333 >> 1 === device.globalTransparencyColor || clipped,
    clipped: clipped
  };
}
