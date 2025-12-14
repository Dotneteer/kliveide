import { isDisplayArea, isContentionWindow } from "./matrix-helpers";
import { ULAHiColorCell, ULAHiResCell, ULAStandardCell } from "./RenderingCell";
import { TimingConfig } from "./TimingConfig";

/**
 * Generate a single ULA Standard rendering cell for the given (vc, hc) position.
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
 * @param hc Horizontal counter position (firstVisibleHC to maxHC)
 * @returns ULA Standard rendering cell with all activity flags
 */
export function generateULAStandardCell(
  config: TimingConfig,
  vc: number,
  hc: number
): ULAStandardCell {
  // Note: Blanking cells are not generated (sparse matrix optimization)
  // This function is only called for visible positions where:
  // vc >= firstBitmapVC && vc <= lastBitmapVC && hc >= firstVisibleHC

  // Display area: where ULA layer renders (256×192 in ULA coordinates)
  // ULA internally uses HC 0-255 for the 256-pixel-wide display
  // In our coordinate system, this maps to HC 144-399
  const displayArea = isDisplayArea(config, vc, hc);

  // Contention window calculation (for +3 timing)
  const contentionWindow = isContentionWindow(hc, displayArea);

  // === ULA-Specific Activities (only in display area) ===

  // Extract HC subcycle position (hc[3:0])
  const hcSub = hc & 0xf;

  // Scroll sample: capture scroll register values
  // Occurs at HC subcycle positions 0x3 and 0xB
  const scrollSample = displayArea && (hcSub === 0x3 || hcSub === 0xb);

  // Pixel read: read pixel byte from VRAM
  // Occurs at HC subcycle positions 0x0, 0x4, 0x8, 0xC
  // These are the "even" read cycles in the ULA's memory access pattern
  const pixelRead =
    displayArea && (hcSub === 0x0 || hcSub === 0x4 || hcSub === 0x8 || hcSub === 0xc);

  // Attribute read: read attribute byte from VRAM
  // Occurs at HC subcycle positions 0x2, 0x6, 0xA, 0xE
  // These are the "odd" read cycles in the ULA's memory access pattern
  const attrRead =
    displayArea && (hcSub === 0x2 || hcSub === 0x6 || hcSub === 0xa || hcSub === 0xe);

  // Shift register load: load pixel/attribute data into shift register
  // Occurs at HC subcycle positions 0xC and 0x4
  // This happens after the previous read cycle completes
  const shiftRegLoad = displayArea && (hcSub === 0xc || hcSub === 0x4);

  // Floating bus update: update floating bus with last read data
  // Occurs at HC subcycle positions 0x9, 0xB, 0xD, 0xF (when data becomes available)
  // Only active in display area (cleared to 0xFF in border)
  const floatingBusUpdate =
    displayArea && (hcSub === 0x9 || hcSub === 0xb || hcSub === 0xd || hcSub === 0xf);

  return {
    // Base state (all cells in sparse matrix are visible, no blanking)
    displayArea,
    contentionWindow,

    // ULA-specific activities
    scrollSample,
    pixelRead,
    attrRead,
    shiftRegLoad,
    floatingBusUpdate
  };
}

/**
 * Generate a single ULA Hi-Res rendering cell for the given (vc, hc) position.
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
 * @param hc Horizontal counter position (firstVisibleHC to maxHC)
 * @returns ULA Standard rendering cell with all activity flags
 */
export function generateULAHiResCell(config: TimingConfig, vc: number, hc: number): ULAHiResCell {
  // Note: Blanking cells are not generated (sparse matrix optimization)
  // This function is only called for visible positions where:
  // vc >= firstBitmapVC && vc <= lastBitmapVC && hc >= firstVisibleHC
  const displayArea = isDisplayArea(config, vc, hc);
  const contentionWindow = isContentionWindow(hc, displayArea);
  const hcSub = hc & 0xf;

  return {
    displayArea,
    contentionWindow,
    pixelRead0: displayArea && (hcSub === 0x0 || hcSub === 0x4 || hcSub === 0x8 || hcSub === 0xc),
    pixelRead1: displayArea && (hcSub === 0x2 || hcSub === 0x6 || hcSub === 0xa || hcSub === 0xe),
    shiftRegLoad: displayArea && (hcSub === 0xc || hcSub === 0x4)
  };
}

/**
 * Generate a single ULA Hi-Color rendering cell for the given (vc, hc) position.
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
 * @param hc Horizontal counter position (firstVisibleHC to maxHC)
 * @returns ULA Hi-Color rendering cell with all activity flags
 */
export function generateULAHiColorCell(
  config: TimingConfig,
  vc: number,
  hc: number
): ULAHiColorCell {
  // Note: Blanking cells are not generated (sparse matrix optimization)
  // This function is only called for visible positions where:
  // vc >= firstBitmapVC && vc <= lastBitmapVC && hc >= firstVisibleHC
  const displayArea = isDisplayArea(config, vc, hc);
  const contentionWindow = isContentionWindow(hc, displayArea);
  const hcSub = hc & 0xf;

  return {
    displayArea,
    contentionWindow,
    pixelRead: displayArea && (hcSub === 0x0 || hcSub === 0x4 || hcSub === 0x8 || hcSub === 0xc),
    colorRead: displayArea && (hcSub === 0x2 || hcSub === 0x6 || hcSub === 0xa || hcSub === 0xe),
    shiftRegLoad: displayArea && (hcSub === 0xc || hcSub === 0x4)
  };
}
