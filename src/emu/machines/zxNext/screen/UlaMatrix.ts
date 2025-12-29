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
import { getULANextInkIndex, getULANextPaperIndex } from "./rendering-tables";

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
  loResMode: number;              // 0 = standard 8-bit, 1 = radastan 4-bit
  loResModeSampled: number;
  loResBlockByte: number;         // Current block data byte
  loresPaletteOffset: number;     // Palette offset for radastan mode
  loResScrollXSampled: number;    // Sampled X scroll for LoRes
  loResScrollYSampled: number;    // Sampled Y scroll for LoRes
  timexDFile: number;             // Timex display file selector (0 or 1)

  // ULA+ palette extension
  ulaPlusEnabled: boolean;

  // ULANext palette extension
  ulaNextEnabled: boolean;
  ulaNextFormat: number; // Attribute byte format mask (NextReg 0x42)

  // ULA shift registers and pixel/attribute bytes
  ulaPixelByte1: number;
  ulaPixelByte2: number;
  ulaPixelByte3: number;
  ulaPixelByte4: number;
  ulaShiftReg: number;
  ulaShiftAttr: number;
  ulaShiftAttr2: number;
  ulaShiftAttrCount: number;
  ulaAttrByte1: number;
  ulaAttrByte2: number;
  ulaHiResInkRgb333: number;
  ulaHiResPaperRgb333: number;

  // Pre-computed address lookup tables
  ulaPixelLineBaseAddr: Uint16Array;
  ulaAttrLineBaseAddr: Uint16Array;

  // Attribute decode lookup tables
  flashFlag: boolean;
  activeAttrToInk: Uint8Array;
  activeAttrToPaper: Uint8Array;

  // ULA+ attribute decode lookup tables (indices 192-255)
  ulaPlusAttrToInk: Uint8Array;
  ulaPlusAttrToPaper: Uint8Array;

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

  // === Layer 2 state properties ===
  // Display enable and configuration
  layer2Enabled: boolean;              // Port 0x123B bit 1: Layer 2 display enabled
  layer2Resolution: number;            // NextReg 0x70 bits [5:4]: 00=256x192, 01=320x256, 10/11=640x256
  layer2PaletteOffset: number;         // NextReg 0x70 bits [3:0]: Added to upper nibble before palette lookup
  
  // Scrolling
  layer2ScrollX: number;               // 9-bit: NextReg 0x71 bit 0 (MSB) + NextReg 0x16 (LSB)
  layer2ScrollY: number;               // NextReg 0x17: 8-bit Y scroll (0-191 in 256x192, 0-255 in wide modes)
  
  // Clipping window
  layer2ClipWindowX1: number;          // NextReg 0x18 write 1: X1 clip coordinate (inclusive)
  layer2ClipWindowX2: number;          // NextReg 0x18 write 2: X2 clip coordinate (inclusive)
  layer2ClipWindowY1: number;          // NextReg 0x18 write 3: Y1 clip coordinate (inclusive)
  layer2ClipWindowY2: number;          // NextReg 0x18 write 4: Y2 clip coordinate (inclusive)
  
  // Bank selection
  layer2ActiveBank: number;            // NextReg 0x12 bits [6:0]: Starting 16K bank for Layer 2 display
  layer2ShadowBank: number;            // NextReg 0x13 bits [6:0]: Shadow buffer starting bank
  layer2UseShadowBank: boolean;        // Port 0x123B bit 3: Use shadow (1) or active (0) bank
}


