import { isDisplayArea, isContentionWindow } from "./matrix-helpers";
import {
  ULAHiColorCell,
  ULAHiResCell,
  ULAStandardCell,
  ULA_DISPLAY_AREA,
  ULA_CONTENTION_WINDOW,
  ULA_SCROLL_SAMPLE,
  ULA_PIXEL_READ,
  ULA_ATTR_READ,
  ULA_SHIFT_REG_LOAD,
  ULA_FLOATING_BUS_UPDATE
} from "./RenderingCell";
import { TimingConfig } from "./TimingConfig";

/**
 * Generate a single ULA Standard rendering cell for the given (vc, hc) position.
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position (0 to maxVC, includes blanking)
 * @param hc Horizontal counter position (0 to maxHC, includes blanking)
 * @returns ULA Standard rendering cell as Uint16 bit flags
 */
export function generateULAStandardCell(
  config: TimingConfig,
  vc: number,
  hc: number
): ULAStandardCell {
  // Display area: where ULA layer renders (256×192 in ULA coordinates)
  // ULA internally uses HC 0-255 for the 256-pixel-wide display
  // In our coordinate system, this maps to HC 144-399
  const displayArea = isDisplayArea(config, vc, hc);

  // Contention window calculation (for +3 timing)
  const contentionWindow = isContentionWindow(hc, displayArea);

  // Initialize bit flags
  let flags: number = 0;

  // Set base flags
  if (displayArea) flags |= ULA_DISPLAY_AREA;
  if (contentionWindow) flags |= ULA_CONTENTION_WINDOW;

  // === ULA-Specific Activities (only in display area) ===
  if (displayArea) {
    // Extract HC subcycle position (hc[3:0])
    const hcSub = hc & 0xf;

    // Scroll sample: capture scroll register values at HC subcycle positions 0x3 and 0xB
    if (hcSub === 0x3 || hcSub === 0xb) {
      flags |= ULA_SCROLL_SAMPLE;
    }

    // Pixel read: read pixel byte from VRAM at HC subcycle positions 0x0, 0x4, 0x8, 0xC
    if (hcSub === 0x0 || hcSub === 0x4 || hcSub === 0x8 || hcSub === 0xc) {
      flags |= ULA_PIXEL_READ;
    }

    // Attribute read: read attribute byte from VRAM at HC subcycle positions 0x2, 0x6, 0xA, 0xE
    if (hcSub === 0x2 || hcSub === 0x6 || hcSub === 0xa || hcSub === 0xe) {
      flags |= ULA_ATTR_READ;
    }

    // Shift register load at HC subcycle positions 0xC and 0x4
    if (hcSub === 0xc || hcSub === 0x4) {
      flags |= ULA_SHIFT_REG_LOAD;
    }

    // Floating bus update at HC subcycle positions 0x9, 0xB, 0xD, 0xF
    if (hcSub === 0x9 || hcSub === 0xb || hcSub === 0xd || hcSub === 0xf) {
      flags |= ULA_FLOATING_BUS_UPDATE;
    }
  }

  return flags;
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
