import { isDisplayArea, isVisibleArea, isContentionWindow } from "./matrix-helpers";
import {
  ULAHiResCell,
  ULAStandardCell,
  LayerOutput,
  ULA_DISPLAY_AREA,
  ULA_CONTENTION_WINDOW,
  ULA_NREG_SAMPLE,
  ULA_BYTE1_READ,
  ULA_BYTE2_READ,
  ULA_SHIFT_REG_LOAD,
  ULA_FLOATING_BUS_UPDATE,
  ULA_BORDER_AREA
} from "./RenderingCell";
import { TimingConfig } from "./TimingConfig";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * Interface for ULA Standard pixel rendering context.
 * Contains all state and configuration needed to render a single ULA Standard pixel.
 */
export interface IPixelRenderingState {
  // Machine reference for memory and palette access
  machine: IZxNextMachine;

  // Timing configuration
  confDisplayXStart: number;
  confDisplayYStart: number;

  // ULA scroll values
  ulaScrollX: number;
  ulaScrollY: number;
  ulaScrollXSampled: number;
  ulaScrollYSampled: number;

  // ULA standard mode values
  disableUlaOutput: boolean;
  disableUlaOutputSampled: boolean;

  // ULA HiRes mode values
  ulaHiResMode: boolean;
  ulaHiResModeSampled: boolean;
  ulaHiResColor: number;
  ulaHiResColorSampled: number; // 0-7: ink/paper color pair

  // ULA HiColor mode values
  ulaHiColorMode: boolean;
  ulaHiColorModeSampled: boolean;

  // Lo-Res mode configuration
  loResEnabled: boolean;
  loResEnabledSampled: boolean;

  // ULA shift registers and pixel/attribute bytes
  ulaPixelByte1: number;
  ulaPixelByte2: number;
  ulaShiftReg: number;
  ulaShiftAttr: number;
  ulaShiftAttr2: number;
  ulaShiftAttrCount: number;
  ulaAttrByte1: number;
  ulaAttrByte2: number;

  // Pre-computed address lookup tables
  ulaPixelLineBaseAddr: Uint16Array;
  ulaAttrLineBaseAddr: Uint16Array;

  // Attribute decode lookup tables
  flashFlag: boolean;
  activeAttrToInk: Uint8Array;
  activeAttrToPaper: Uint8Array;

  // Border color
  borderRgbCache: number;

  // Clipping window
  ulaClipWindowX1: number;
  ulaClipWindowX2: number;
  ulaClipWindowY1: number;
  ulaClipWindowY2: number;

  // Transparency
  globalTransparencyColor: number;

  // Floating bus
  floatingBusValue: number;
}

/**
 * Interface for ULA Hi-Res pixel rendering context.
 * Contains all state and configuration needed to render a single ULA Hi-Res pixel.
 */
export interface IUlaHiResPixelRenderingState {
  // Machine reference for memory and palette access
  machine: IZxNextMachine;

  // Timing configuration
  confDisplayXStart: number;
  confDisplayYStart: number;

  // ULA scroll registers
  ulaScrollX: number;
  ulaScrollY: number;
  ulaScrollXSampled: number;
  ulaScrollYSampled: number;

  // Hi-Res mode configuration
  ulaHiResMode: boolean;
  ulaHiResModeSampled: boolean;
  ulaHiResColor: number; // 0-7: ink/paper color pair

  // Hi-Res pixel byte buffers (4 bytes total: 2 from each bank)
  ulaHiResPixelByte00: number; // Even bank, first byte
  ulaHiResPixelByte01: number; // Even bank, second byte
  ulaHiResPixelByte10: number; // Odd bank, first byte
  ulaHiResPixelByte11: number; // Odd bank, second byte

  // Hi-Res shift register (16 bits, interleaved pixels from both banks)
  ulaHiResShiftReg: number;

  // Pre-computed address lookup tables
  ulaPixelLineBaseAddr: Uint16Array;

  // Border color
  borderRgbCache: number;

  // Clipping window
  ulaClipWindowX1: number;
  ulaClipWindowX2: number;
  ulaClipWindowY1: number;
  ulaClipWindowY2: number;

  // Transparency
  globalTransparencyColor: number;
}

/**
 * Generate a single ULA Standard rendering cell for the given (vc, hc) position.
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position (0 to maxVC, includes blanking)
 * @param hc Horizontal counter position (0 to maxHC, includes blanking)
 * @returns ULA Standard rendering cell as Uint16 bit flags
 */
export function generateULARenderingFlag(
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
    flags |= ULA_NREG_SAMPLE;
  }

  // --- Pixel read: read pixel byte from VRAM at HC subcycle positions 0x1, 0x5, 0x9, 0xD
  // --- The memory read occurs at HC subcycle 0x0, 0x4, 0x8, 0xC.
  if (fetchActive && (hcSub === 0x00 || hcSub === 0x04 || hcSub === 0x08 || hcSub === 0x0c)) {
    flags |= ULA_BYTE1_READ;
  }

  // --- Attribute read: read attribute byte from VRAM at HC subcycle positions 0x2, 0x6, 0xA, 0xE
  if (fetchActive && (hcSub === 0x02 || hcSub === 0x06 || hcSub === 0x0a || hcSub === 0x0e)) {
    flags |= ULA_BYTE2_READ;
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
 * Render ULA Standard pixel for the current tact position (Stage 1: Pixel Generation).
 *
 * This function executes Stage 1 of the rendering pipeline as described in Section 1.
 * It generates the ULA pixel color and flags but does NOT write to the bitmap.
 * The returned output will be combined with other layers in the composition stage.
 *
 * @param device - Device context implementing IUlaStandardPixel interface
 * @param vc - Vertical counter position (ULA coordinate system)
 * @param hc - Horizontal counter position (ULA coordinate system)
 * @param cell - ULA Standard rendering cell flags (Uint16 bit flags)
 * @returns Layer output (RGB333 + flags) for composition stage
 */
export function renderULAStandardPixel(
  device: IPixelRenderingState,
  vc: number,
  hc: number,
  cell: ULAStandardCell
): LayerOutput {
  // === Display Area: ULA Standard Rendering ===
  // --- Scroll Sampling ---
  if ((cell & ULA_NREG_SAMPLE) !== 0) {
    sampleNextRegistersForUlaMode(device);

    // Calculate scrolled Y position with vertical scroll offset
    device.ulaScrollYSampled = vc - device.confDisplayYStart + device.ulaScrollY;
    if (device.ulaScrollYSampled >= 0xc0) {
      device.ulaScrollYSampled -= 0xc0; // Wrap Y at 192 for vertical scrolling
    }
  }

  // --- Shift Register Load ---
  if ((cell & ULA_SHIFT_REG_LOAD) !== 0) {
    // Load pixel and attribute data into shift register
    // This prepares the next 8 pixels for output
    device.ulaShiftReg =
      ((((device.ulaPixelByte1 << 8) | device.ulaPixelByte2) <<
        (device.ulaScrollXSampled & 0x07)) >>
        8) &
      0xff;
    device.ulaShiftAttr = device.ulaAttrByte1; // Load attribute byte 1
    device.ulaShiftAttr2 = device.ulaAttrByte2; // Load attribute byte 2
    device.ulaShiftAttrCount = 8 - (device.ulaScrollXSampled & 0x07); // Reset attribute shift counter
  }

  // --- Memory Read Activities ---
  if ((cell & ULA_BYTE1_READ) !== 0) {
    // --- Calculate pixel address using pre-computed Y-dependent base + X component
    const baseCol = (hc + 0x0c - device.confDisplayXStart) >> 3;
    const shiftCols = (baseCol + (device.ulaScrollXSampled >> 3)) & 0x1f;
    const pixelAddr = device.ulaPixelLineBaseAddr[device.ulaScrollYSampled] | shiftCols;
    // Read pixel byte from Bank 5 or Bank 7
    const pixelByte = device.machine.memoryDevice.readScreenMemory(pixelAddr);
    if (hc & 0x04) {
      device.ulaPixelByte2 = pixelByte;
    } else {
      device.ulaPixelByte1 = pixelByte;
    }

    // --- Update floating bus with pixel data
    if ((cell & ULA_FLOATING_BUS_UPDATE) !== 0) {
      device.floatingBusValue = pixelByte;
    }
  }

  if ((cell & ULA_BYTE2_READ) !== 0) {
    // --- Calculate attribute address using pre-computed Y-dependent base + X component
    const baseCol = (hc + 0x0a - device.confDisplayXStart) >> 3;
    const shiftCols = (baseCol + (device.ulaScrollXSampled >> 3)) & 0x1f;
    const attrAddr = device.ulaAttrLineBaseAddr[device.ulaScrollYSampled] | shiftCols;

    // --- Read attribute byte from Bank 5 or Bank 7
    const ulaAttrByte = device.machine.memoryDevice.readScreenMemory(attrAddr);
    if (hc & 0x04) {
      device.ulaAttrByte2 = ulaAttrByte;
    } else {
      device.ulaAttrByte1 = ulaAttrByte;
    }

    // --- Update floating bus with attribute data
    if ((cell & ULA_FLOATING_BUS_UPDATE) !== 0) {
      device.floatingBusValue = ulaAttrByte;
    }
  }

  // === Border Area ===
  if ((cell & ULA_DISPLAY_AREA) === 0) {
    // --- Use cached border RGB value (updated when borderColor changes)
    // --- This eliminates method call overhead for ~30% of pixels
    return {
      rgb333: device.borderRgbCache,
      transparent: false,
      clipped: false
    };
  }

  // // --- Pixel Generation ---
  // Generate pixel from shift register (happens every HC position)
  // Extract current pixel bit from shift register
  const displayHC = hc - device.confDisplayXStart;
  const displayVC = vc - device.confDisplayYStart;
  const pixelWithinByte = displayHC & 0x07; // Pixel position within byte (0-7)
  const pixelBit = (device.ulaShiftReg >> (7 - pixelWithinByte)) & 0x01;

  // Use pre-calculated lookup tables with BRIGHT already applied
  // Direct palette index lookup (0-15) - no bit operations needed
  const paletteIndex = pixelBit
    ? device.activeAttrToInk[device.ulaShiftAttr]
    : device.activeAttrToPaper[device.ulaShiftAttr];

  device.ulaShiftAttrCount--;
  if (device.ulaShiftAttrCount === 0) {
    device.ulaShiftAttrCount = 8;
    device.ulaShiftAttr = device.ulaShiftAttr2; // Load attribute byte 2
  }

  // Lookup color in ULA palette (16 entries for standard + bright colors)
  const pixelRGB = device.machine.paletteDevice.getUlaRgb333(paletteIndex);

  // --- Clipping Test ---
  // Check if pixel is within ULA clip window (NextReg 0x1C, 0x1D)
  const clipped =
    displayHC < device.ulaClipWindowX1 ||
    displayHC > device.ulaClipWindowX2 ||
    displayVC < device.ulaClipWindowY1 ||
    displayVC > device.ulaClipWindowY2;

  // --- Transparency Check ---
  const transparent = pixelRGB >> 1 === device.globalTransparencyColor;

  // Return layer output for composition stage
  return {
    rgb333: pixelRGB,
    transparent: transparent || clipped, // Treat clipped pixels as transparent
    clipped: clipped
  };
}

/**
 * Render ULA Hi-Res pixel for the current tact position (Stage 1: Pixel Generation).
 *
 * ULA Hi-Res mode (Timex Hi-Res mode):
 * - 512×192 monochrome display (double horizontal resolution)
 * - Uses BOTH memory read cycles for pixel data (not pixel + attribute like Standard mode)
 * - Bank 0 reads (HC 0x0/0x4/0x8/0xC): pixel data from 0x4000-0x57FF
 * - Bank 1 reads (HC 0x2/0x6/0xA/0xE): pixel data from 0x6000-0x77FF (via 0x2000 offset)
 * - Both reads use PIXEL addresses (not attribute addresses)
 * - Uses same 16-bit shift register as Standard mode
 * - 32-bit pre-shift value constructed with byte interleaving: [pbyte_hi][abyte_hi][pbyte_lo][abyte_lo]
 * - Color determined by ulaHiResColor register (0-7 for 8 ink/paper pairs from Timex port 0xFF)
 *
 * @param device - Device context implementing IUlaHiResPixelRenderingState interface
 * @param vc - Vertical counter position (ULA coordinate system)
 * @param hc - Horizontal counter position (ULA coordinate system)
 * @param cell - ULA Hi-Res rendering cell flags (Uint16 bit flags)
 * @param pixelIndex - Which pixel of the pair (0 or 1) to output
 * @returns Layer output (RGB333 + flags) for composition stage
 */
export function renderULAHiResPixel(
  _device: IUlaHiResPixelRenderingState,
  _vc: number,
  _hc: number,
  _cell: ULAHiResCell,
  _pixelIndex: number
): LayerOutput {
  // === Border Area ===
  // if ((cell & ULA_HIRES_BORDER_AREA) !== 0) {
  //   return {
  //     rgb333: device.borderRgbCache,
  //     transparent: false,
  //     clipped: false
  //   };
  // }

  // // === Display Area: ULA Hi-Res Rendering ===

  // // --- Scroll Sampling ---
  // // Sample scroll registers at HC subcycles 0x3 and 0xB (same timing as Standard mode)
  // // Note: generateULAHiResCell doesn't set scroll sample flags, so we check hcSub directly
  // const hcSub = hc & 0x0f;
  // if (hcSub === 0x03 || hcSub === 0x0b) {
  //   device.ulaScrollXSampled = device.ulaScrollX;
  //   device.ulaScrollYSampled = vc - device.confDisplayYStart + device.ulaScrollY;
  //   if (device.ulaScrollYSampled >= 0xc0) {
  //     device.ulaScrollYSampled -= 0xc0; // Wrap Y at 192 for vertical scrolling
  //   }
  // }

  // // --- Memory Read Activities ---
  // // HYPOTHESIS VERIFIED: HiRes mode repurposes the attribute read cycle for pixel data
  // // Both read cycles use PIXEL addresses (not attribute addresses like Standard mode)

  // // Read pixel data from Bank 0 at HC subcycles 0x0, 0x4, 0x8, 0xC
  // if ((cell & ULA_HIRES_PIXEL_READ_0) !== 0) {
  //   // Calculate pixel address (same Y-dependent address as Standard mode)
  //   const baseCol = (hc + 0x0c - device.confDisplayXStart) >> 3;
  //   const shiftCols = (baseCol + (device.ulaScrollXSampled >> 3)) & 0x1f;
  //   const pixelAddr = device.ulaPixelLineBaseAddr[device.ulaScrollYSampled] | shiftCols;

  //   // Read from Bank 0 (0x4000-0x57FF range)
  //   const pixelByte = device.machine.memoryDevice.readScreenMemory(pixelAddr);

  //   // Store in byte buffer based on which 8-HC group we're in
  //   // Pattern: HC 0x0→byte1, HC 0x4→byte2, HC 0x8→byte1, HC 0xC→byte2
  //   if (hc & 0x04) {
  //     device.ulaHiResPixelByte01 = pixelByte; // Bank 0, second byte
  //   } else {
  //     device.ulaHiResPixelByte00 = pixelByte; // Bank 0, first byte
  //   }
  // }

  // // Read pixel data from Bank 1 at HC subcycles 0x2, 0x6, 0xA, 0xE
  // if ((cell & ULA_HIRES_PIXEL_READ_1) !== 0) {
  //   // Calculate pixel address with 0x2000 offset for Bank 1
  //   // HYPOTHESIS VERIFIED: Uses pixel address (not attribute address) + 0x2000 offset
  //   const baseCol = (hc + 0x0a - device.confDisplayXStart) >> 3;
  //   const shiftCols = (baseCol + (device.ulaScrollXSampled >> 3)) & 0x1f;
  //   const pixelAddr = 0x2000 | device.ulaPixelLineBaseAddr[device.ulaScrollYSampled] | shiftCols;

  //   // Read from Bank 1 (0x6000-0x77FF range via 0x2000 offset)
  //   const pixelByte = device.machine.memoryDevice.readScreenMemory(pixelAddr);

  //   // Store in byte buffer based on which 8-HC group we're in
  //   // Pattern: HC 0x2→byte1, HC 0x6→byte2, HC 0xA→byte1, HC 0xE→byte2
  //   if (hc & 0x04) {
  //     device.ulaHiResPixelByte11 = pixelByte; // Bank 1, second byte
  //   } else {
  //     device.ulaHiResPixelByte10 = pixelByte; // Bank 1, first byte
  //   }
  // }

  // // --- Shift Register Load ---
  // // Load shift register at HC subcycles 0xC and 0x4 (same timing as Standard mode)
  // if ((cell & ULA_HIRES_SHIFT_REG_LOAD) !== 0) {
  //   // Combine byte buffers into 16-bit values (pbyte from Bank 0, abyte from Bank 1)
  //   const pbyte = (device.ulaHiResPixelByte00 << 8) | device.ulaHiResPixelByte01;
  //   const abyte = (device.ulaHiResPixelByte10 << 8) | device.ulaHiResPixelByte11;

  //   // Construct 32-bit pre-shift value with byte interleaving
  //   // VHDL: shift_reg_32 <= shift_pbyte(15:8) & shift_abyte(15:8) & shift_pbyte(7:0) & shift_abyte(7:0)
  //   // This interleaves high bytes and low bytes: [pbyte_hi][abyte_hi][pbyte_lo][abyte_lo]
  //   const shift_reg_32 =
  //     (((pbyte >> 8) & 0xff) << 24) |  // pbyte high byte
  //     (((abyte >> 8) & 0xff) << 16) |  // abyte high byte
  //     ((pbyte & 0xff) << 8) |          // pbyte low byte
  //     (abyte & 0xff);                  // abyte low byte

  //   // Apply horizontal scroll offset and extract upper 16 bits
  //   // VHDL: shift_reg <= shift_reg_ld(31 downto 16) where shift_reg_ld = shift_reg_32 sll to_integer(shift_x_ula)
  //   const scrollOffset = device.ulaScrollXSampled & 0x07;
  //   device.ulaHiResShiftReg = ((shift_reg_32 << scrollOffset) >>> 16) & 0xffff;
  // }

  // // --- Pixel Generation ---
  // // Generate pixel from shift register (happens every HC position)
  // const displayHC = hc - device.confDisplayXStart;
  // const displayVC = vc - device.confDisplayYStart;

  // // Each HC outputs 2 pixels (512 pixels total vs 256 in Standard mode)
  // // Calculate bit position in 16-bit shift register
  // const pixelWithinByte = displayHC & 0x07; // Pixel position within 8-HC window (0-7)
  // const pixelOffset = pixelWithinByte * 2 + pixelIndex; // 0-15 within 16-pixel window
  // const bitPos = 15 - pixelOffset;
  // const pixelBit = (device.ulaHiResShiftReg >> bitPos) & 0x01;

  // // HYPOTHESIS VERIFIED: HiRes uses fixed colors from Timex port 0xFF (not memory attributes)
  // // ulaHiResColor (0-7) selects one of 8 predefined ink/paper pairs
  // const colorPairs = [
  //   [0, 7],   // 0: black ink on white paper
  //   [1, 6],   // 1: blue ink on yellow paper
  //   [2, 5],   // 2: red ink on cyan paper
  //   [3, 4],   // 3: magenta ink on green paper
  //   [4, 3],   // 4: green ink on magenta paper
  //   [5, 2],   // 5: cyan ink on red paper
  //   [6, 1],   // 6: yellow ink on blue paper
  //   [7, 0]    // 7: white ink on black paper
  // ];

  // const [inkIndex, paperIndex] = colorPairs[device.ulaHiResColor & 0x07];
  // const paletteIndex = pixelBit ? inkIndex : paperIndex;

  // // Lookup color in ULA palette (16 entries for standard + bright colors)
  // const pixelRGB = device.machine.paletteDevice.getUlaRgb333(paletteIndex);

  // // --- Clipping Test ---
  // const clipped =
  //   displayHC < device.ulaClipWindowX1 ||
  //   displayHC > device.ulaClipWindowX2 ||
  //   displayVC < device.ulaClipWindowY1 ||
  //   displayVC > device.ulaClipWindowY2;

  // // --- Transparency Check ---
  // const transparent = pixelRGB >> 1 === device.globalTransparencyColor;

  return {
    rgb333: 0x00000000,
    transparent: true,
    clipped: false
  };
}

/**
 * Samples Next registers for ULA mode.
 * @param device Device context implementing IUlaStandardPixelRenderingState
 */
function sampleNextRegistersForUlaMode(device: IPixelRenderingState): void {
  // --- Scroll
  device.ulaScrollXSampled = device.ulaScrollX;
  device.ulaScrollYSampled = device.ulaScrollY;

  // --- ULA Standard mode
  device.disableUlaOutputSampled = device.disableUlaOutput;

  // --- ULA Hi-Res mode
  device.ulaHiResModeSampled = device.ulaHiResMode;
  device.ulaHiResColorSampled = device.ulaHiResColor;

  // --- Lo-Res mode
  device.loResEnabledSampled = device.loResEnabled;
}
