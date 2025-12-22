import { isDisplayArea, isVisibleArea, isContentionWindow } from "./matrix-helpers";
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
  ULA_FLOATING_BUS_UPDATE,
  ULA_HIRES_DISPLAY_AREA,
  ULA_HIRES_CONTENTION_WINDOW,
  ULA_HIRES_PIXEL_READ_0,
  ULA_HIRES_PIXEL_READ_1,
  ULA_HIRES_SHIFT_REG_LOAD,
  ULA_HIRES_BORDER_AREA,
  ULA_HICOLOR_DISPLAY_AREA,
  ULA_HICOLOR_CONTENTION_WINDOW,
  ULA_HICOLOR_PIXEL_READ,
  ULA_HICOLOR_COLOR_READ,
  ULA_HICOLOR_SHIFT_REG_LOAD,
  ULA_HICOLOR_BORDER_AREA,
  ULA_BORDER_AREA
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
  // === Base Timing State ===
  // --- Check if we're in blanking area (not visible).
  // --- If so return 0, indicating no rendering activity.
  if (!isVisibleArea(config, vc, hc)) {
    return 0;
  }

  // --- Initialize bit flags
  let flags: number = 0;

  // --- Display area: where ULA layer renders (256×192 in ULA coordinates)
  // --- ULA internally uses HC 0-255 for the 256-pixel-wide display
  // --- In our coordinate system, this maps to HC 144-399
  const displayArea = isDisplayArea(config, vc, hc);
  if (displayArea) {
    flags |= ULA_DISPLAY_AREA;
  } else {
    // --- Border area (outside display area but within visible area)
    flags |= ULA_BORDER_AREA;
  }

  // --- Contention window calculation (for +3 timing)
  if (isContentionWindow(hc, displayArea)) {
    flags |= ULA_CONTENTION_WINDOW;
  }

  // === ULA-Specific Activities ===
  // HARDWARE BEHAVIOR: ULA memory fetch activities occur throughout the ENTIRE frame,
  // not just in the display area. The hardware continuously samples scroll values,
  // generates addresses, and performs VRAM reads even during border periods.
  //
  // This is an intentional design choice enabled by the FPGA's dual-port BRAM architecture.
  // From zxula.vhd lines 48-51:
  //   "Because display memory is held in dual port bram, there is no real contention in
  //   the zx next... And because there is no shortage of memory bandwidth to bram, this
  //   implementation may continually access bram even outside the display area with no
  //   detrimental impact on the system."
  //
  // EMULATOR OPTIMIZATION: However, in software emulation, these border reads waste CPU
  // cycles without affecting observable behavior. We optimize by gating memory operations:
  //
  // 1. Vertical gating: Skip top/bottom borders (rows outside 0-191)
  // 2. Horizontal gating:
  //    - Skip right border (after display area ends)
  //    - Skip left border >16 tacts before display (one full shift register cycle)
  //
  // The shift register loads every 8 HC tacts (16 pixels) at HC[3:0]=0xC and 0x4.
  // Data for each load comes from fetches in the preceding ~8-16 tacts.
  // Starting fetches 16 tacts before display ensures all data for the first visible
  // pixels is available. This optimization has no impact on accuracy.
  //

  // --- Combined optimization gate:
  // --- Vertical display area check (emulator optimization gate)
  // --- Horizontal optimization window: fetch from 16 tacts before display through display end
  // --- 16 tacts = one complete shift register load cycle (HC[3:0]=0xC to next 0xC)
  const fetchActive =
    vc >= config.displayYStart &&
    vc <= config.displayYEnd &&
    hc >= config.displayXStart - 16 &&
    hc <= config.displayXEnd;

  // --- Extract HC subcycle position (hc[3:0])
  const hcSub = hc & 0x0f;

  // --- Scroll sample: capture scroll register values at HC subcycle positions 0x3 and 0xB
  if (fetchActive && (hcSub === 0x07 || hcSub === 0x0f)) {
    flags |= ULA_SCROLL_SAMPLE;
  }

  // --- Pixel read: read pixel byte from VRAM at HC subcycle positions 0x1, 0x5, 0x9, 0xD
  // --- The memory read occurs at HC subcycle 0x0, 0x4, 0x8, 0xC.
 if (fetchActive && (hcSub === 0x00 || hcSub === 0x04 || hcSub === 0x08 || hcSub === 0x0c)) {
    flags |= ULA_PIXEL_READ;
  }

  // --- Attribute read: read attribute byte from VRAM at HC subcycle positions 0x2, 0x6, 0xA, 0xE
  if (fetchActive && (hcSub === 0x02 || hcSub === 0x06 || hcSub === 0x0a || hcSub === 0x0e)) {
    flags |= ULA_ATTR_READ;
  }

  // --- Shift register load: load pixel/attribute data into shift register
  // --- at HC subcycle positions 0xC and 0x4
  if (fetchActive && (hcSub === 0x00 || hcSub === 0x08)) {
    flags |= ULA_SHIFT_REG_LOAD;
  }

  // --- Floating bus update at HC subcycle positions 0x9, 0xB, 0xD, 0xF
  if (displayArea && (hcSub === 0x05 || hcSub === 0x07 || hcSub === 0x09 || hcSub === 0x0b)) {
    flags |= ULA_FLOATING_BUS_UPDATE;
  }

  // --- Done
  return flags;
}

/**
 * Generate a single ULA Hi-Res rendering cell for the given (vc, hc) position.
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position (0 to maxVC, includes blanking)
 * @param hc Horizontal counter position (0 to maxHC, includes blanking)
 * @returns ULA Hi-Res rendering cell as Uint16 bit flags
 */
export function generateULAHiResCell(config: TimingConfig, vc: number, hc: number): ULAHiResCell {
  // Check if we're in blanking area (not visible)
  const visibleArea = isVisibleArea(config, vc, hc);

  // If we're in blanking area, return 0 (no rendering activity)
  if (!visibleArea) {
    return 0;
  }

  const displayArea = isDisplayArea(config, vc, hc);
  const borderArea = !displayArea;
  const contentionWindow = isContentionWindow(hc, displayArea);

  let flags = 0;

  if (displayArea) flags |= ULA_HIRES_DISPLAY_AREA;
  if (borderArea) flags |= ULA_HIRES_BORDER_AREA;
  if (contentionWindow) flags |= ULA_HIRES_CONTENTION_WINDOW;

  if (displayArea) {
    const hcSub = hc & 0xf;

    if (hcSub === 0x0 || hcSub === 0x4 || hcSub === 0x8 || hcSub === 0xc) {
      flags |= ULA_HIRES_PIXEL_READ_0;
    }

    if (hcSub === 0x2 || hcSub === 0x6 || hcSub === 0xa || hcSub === 0xe) {
      flags |= ULA_HIRES_PIXEL_READ_1;
    }

    if (hcSub === 0xc || hcSub === 0x4) {
      flags |= ULA_HIRES_SHIFT_REG_LOAD;
    }
  }

  return flags;
}

/**
 * Generate a single ULA Hi-Color rendering cell for the given (vc, hc) position.
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position (0 to maxVC, includes blanking)
 * @param hc Horizontal counter position (0 to maxHC, includes blanking)
 * @returns ULA Hi-Color rendering cell as Uint16 bit flags
 */
export function generateULAHiColorCell(
  config: TimingConfig,
  vc: number,
  hc: number
): ULAHiColorCell {
  // Check if we're in blanking area (not visible)
  const visibleArea = isVisibleArea(config, vc, hc);

  // If we're in blanking area, return 0 (no rendering activity)
  if (!visibleArea) {
    return 0;
  }

  const displayArea = isDisplayArea(config, vc, hc);
  const borderArea = !displayArea;
  const contentionWindow = isContentionWindow(hc, displayArea);

  let flags = 0;

  if (displayArea) flags |= ULA_HICOLOR_DISPLAY_AREA;
  if (borderArea) flags |= ULA_HICOLOR_BORDER_AREA;
  if (contentionWindow) flags |= ULA_HICOLOR_CONTENTION_WINDOW;

  if (displayArea) {
    const hcSub = hc & 0xf;

    if (hcSub === 0x0 || hcSub === 0x4 || hcSub === 0x8 || hcSub === 0xc) {
      flags |= ULA_HICOLOR_PIXEL_READ;
    }

    if (hcSub === 0x2 || hcSub === 0x6 || hcSub === 0xa || hcSub === 0xe) {
      flags |= ULA_HICOLOR_COLOR_READ;
    }

    if (hcSub === 0xc || hcSub === 0x4) {
      flags |= ULA_HICOLOR_SHIFT_REG_LOAD;
    }
  }

  return flags;
}
