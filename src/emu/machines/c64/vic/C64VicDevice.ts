import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IC64Machine } from "../IC64Machine";
import { RenderingTact, VicChipConfiguration } from "./types";
import {
  BaFetch,
  BaSpr_M,
  ChkBrdL0,
  ChkBrdL1,
  ChkBrdR0,
  ChkBrdR1,
  ChkSprCrunch,
  ChkSprDma,
  ChkSprExp,
  FetchC,
  FetchG,
  FetchSprNum_M,
  FetchType_M,
  Refresh,
  UpdateMcBase,
  UpdateRc,
  UpdateVc,
} from "./constants";
import { SprDma1, SprPtr } from "./vic-models";

/**
 * Implementation of the VIC-II (Video Interface Chip) for the Commodore 64
 * The VIC-II has 47 registers ($D000-$D02E) that control various aspects of the display
 */
export class C64VicDevice implements IGenericDevice<IC64Machine> {
  /**
   * The VIC register values
   *
   * VIC-II has 47 registers ($D000-$D02E) that control various aspects of the display:
   *
   * $D000-$D00F: Sprite X/Y coordinates
   * $D000 (0)  - M0X: X coordinate sprite 0
   * $D001 (1)  - M0Y: Y coordinate sprite 0
   * $D002 (2)  - M1X: X coordinate sprite 1
   * $D003 (3)  - M1Y: Y coordinate sprite 1
   * $D004 (4)  - M2X: X coordinate sprite 2
   * $D005 (5)  - M2Y: Y coordinate sprite 2
   * $D006 (6)  - M3X: X coordinate sprite 3
   * $D007 (7)  - M3Y: Y coordinate sprite 3
   * $D008 (8)  - M4X: X coordinate sprite 4
   * $D009 (9)  - M4Y: Y coordinate sprite 4
   * $D00A (10) - M5X: X coordinate sprite 5
   * $D00B (11) - M5Y: Y coordinate sprite 5
   * $D00C (12) - M6X: X coordinate sprite 6
   * $D00D (13) - M6Y: Y coordinate sprite 6
   * $D00E (14) - M7X: X coordinate sprite 7
   * $D00F (15) - M7Y: Y coordinate sprite 7
   *
   * $D010 (16) - Sprite X coordinate MSBs
   * Bit 7: M7X8 - MSB of sprite 7 X coordinate
   * Bit 6: M6X8 - MSB of sprite 6 X coordinate
   * Bit 5: M5X8 - MSB of sprite 5 X coordinate
   * Bit 4: M4X8 - MSB of sprite 4 X coordinate
   * Bit 3: M3X8 - MSB of sprite 3 X coordinate
   * Bit 2: M2X8 - MSB of sprite 2 X coordinate
   * Bit 1: M1X8 - MSB of sprite 1 X coordinate
   * Bit 0: M0X8 - MSB of sprite 0 X coordinate
   *
   * $D011 (17) - Control Register 1
   * Bit 7: RST8 - 9th bit of raster counter
   * Bit 6: ECM - Extended Color Mode (1=on, 0=off)
   * Bit 5: BMM - Bitmap Mode (1=bitmap, 0=text)
   * Bit 4: DEN - Display Enable (1=display on, 0=blank screen)
   * Bit 3: RSEL - Row select (1=25 rows, 0=24 rows)
   * Bits 2-0: YSCROLL - Vertical fine scroll (0-7 pixels)
   *
   * $D012 (18) - RASTER: Raster counter (8 lower bits)
   *
   * $D013 (19) - LPX: Light pen X coordinate
   * $D014 (20) - LPY: Light pen Y coordinate
   *
   * $D015 (21) - Sprite Enable
   * Bit 7: M7E - Sprite 7 enabled (1=visible, 0=hidden)
   * Bit 6: M6E - Sprite 6 enabled (1=visible, 0=hidden)
   * Bit 5: M5E - Sprite 5 enabled (1=visible, 0=hidden)
   * Bit 4: M4E - Sprite 4 enabled (1=visible, 0=hidden)
   * Bit 3: M3E - Sprite 3 enabled (1=visible, 0=hidden)
   * Bit 2: M2E - Sprite 2 enabled (1=visible, 0=hidden)
   * Bit 1: M1E - Sprite 1 enabled (1=visible, 0=hidden)
   * Bit 0: M0E - Sprite 0 enabled (1=visible, 0=hidden)
   *
   * $D016 (22) - Control Register 2
   * Bit 7-6: Unused
   * Bit 5: RES - Reset (unused)
   * Bit 4: MCM - Multicolor Mode (1=multicolor, 0=standard)
   * Bit 3: CSEL - Column select (1=40 columns, 0=38 columns)
   * Bits 2-0: XSCROLL - Horizontal fine scroll (0-7 pixels)
   *
   * $D017 (23) - Sprite Y Expansion
   * Bit 7: M7YE - Sprite 7 Y expansion (1=double height, 0=normal)
   * Bit 6: M6YE - Sprite 6 Y expansion (1=double height, 0=normal)
   * Bit 5: M5YE - Sprite 5 Y expansion (1=double height, 0=normal)
   * Bit 4: M4YE - Sprite 4 Y expansion (1=double height, 0=normal)
   * Bit 3: M3YE - Sprite 3 Y expansion (1=double height, 0=normal)
   * Bit 2: M2YE - Sprite 2 Y expansion (1=double height, 0=normal)
   * Bit 1: M1YE - Sprite 1 Y expansion (1=double height, 0=normal)
   * Bit 0: M0YE - Sprite 0 Y expansion (1=double height, 0=normal)
   *
   * $D018 (24) - Memory Pointers
   * Bits 7-4: VM13-VM10 - Video matrix base address (bits 13-10)
   * Bits 3-1: CB13-CB11 - Character generator base address (bits 13-11)
   * Bit 0: Unused
   *
   * $D019 (25) - Interrupt Register
   * Bit 7: IRQ - Interrupt occurred (1=any enabled interrupt triggered)
   * Bits 6-4: Unused
   * Bit 3: ILP - Light pen interrupt (1=triggered, 0=not triggered)
   * Bit 2: IMMC - Sprite-sprite collision interrupt (1=collision, 0=none)
   * Bit 1: IMBC - Sprite-background collision interrupt (1=collision, 0=none)
   * Bit 0: IRST - Raster interrupt (1=triggered, 0=not triggered)
   *
   * $D01A (26) - Interrupt Enable
   * Bits 7-4: Unused
   * Bit 3: ELP - Light pen interrupt enable (1=enabled, 0=disabled)
   * Bit 2: EMMC - Sprite-sprite collision interrupt enable (1=enabled, 0=disabled)
   * Bit 1: EMBC - Sprite-background collision interrupt enable (1=enabled, 0=disabled)
   * Bit 0: ERST - Raster interrupt enable (1=enabled, 0=disabled)
   *
   * $D01B (27) - Sprite Data Priority
   * Bit 7: M7DP - Sprite 7 data priority (1=behind background, 0=in front)
   * Bit 6: M6DP - Sprite 6 data priority (1=behind background, 0=in front)
   * Bit 5: M5DP - Sprite 5 data priority (1=behind background, 0=in front)
   * Bit 4: M4DP - Sprite 4 data priority (1=behind background, 0=in front)
   * Bit 3: M3DP - Sprite 3 data priority (1=behind background, 0=in front)
   * Bit 2: M2DP - Sprite 2 data priority (1=behind background, 0=in front)
   * Bit 1: M1DP - Sprite 1 data priority (1=behind background, 0=in front)
   * Bit 0: M0DP - Sprite 0 data priority (1=behind background, 0=in front)
   *
   * $D01C (28) - Sprite Multicolor
   * Bit 7: M7MC - Sprite 7 multicolor (1=multicolor mode, 0=standard mode)
   * Bit 6: M6MC - Sprite 6 multicolor (1=multicolor mode, 0=standard mode)
   * Bit 5: M5MC - Sprite 5 multicolor (1=multicolor mode, 0=standard mode)
   * Bit 4: M4MC - Sprite 4 multicolor (1=multicolor mode, 0=standard mode)
   * Bit 3: M3MC - Sprite 3 multicolor (1=multicolor mode, 0=standard mode)
   * Bit 2: M2MC - Sprite 2 multicolor (1=multicolor mode, 0=standard mode)
   * Bit 1: M1MC - Sprite 1 multicolor (1=multicolor mode, 0=standard mode)
   * Bit 0: M0MC - Sprite 0 multicolor (1=multicolor mode, 0=standard mode)
   *
   * $D01D (29) - Sprite X Expansion
   * Bit 7: M7XE - Sprite 7 X expansion (1=double width, 0=normal)
   * Bit 6: M6XE - Sprite 6 X expansion (1=double width, 0=normal)
   * Bit 5: M5XE - Sprite 5 X expansion (1=double width, 0=normal)
   * Bit 4: M4XE - Sprite 4 X expansion (1=double width, 0=normal)
   * Bit 3: M3XE - Sprite 3 X expansion (1=double width, 0=normal)
   * Bit 2: M2XE - Sprite 2 X expansion (1=double width, 0=normal)
   * Bit 1: M1XE - Sprite 1 X expansion (1=double width, 0=normal)
   * Bit 0: M0XE - Sprite 0 X expansion (1=double width, 0=normal)
   *
   * $D01E (30) - Sprite-Sprite Collision
   * Bit 7: M7M - Sprite 7 collision (1=collided with another sprite, 0=no collision)
   * Bit 6: M6M - Sprite 6 collision (1=collided with another sprite, 0=no collision)
   * Bit 5: M5M - Sprite 5 collision (1=collided with another sprite, 0=no collision)
   * Bit 4: M4M - Sprite 4 collision (1=collided with another sprite, 0=no collision)
   * Bit 3: M3M - Sprite 3 collision (1=collided with another sprite, 0=no collision)
   * Bit 2: M2M - Sprite 2 collision (1=collided with another sprite, 0=no collision)
   * Bit 1: M1M - Sprite 1 collision (1=collided with another sprite, 0=no collision)
   * Bit 0: M0M - Sprite 0 collision (1=collided with another sprite, 0=no collision)
   *
   * $D01F (31) - Sprite-Data Collision
   * Bit 7: M7D - Sprite 7 collision with data (1=collided with background, 0=no collision)
   * Bit 6: M6D - Sprite 6 collision with data (1=collided with background, 0=no collision)
   * Bit 5: M5D - Sprite 5 collision with data (1=collided with background, 0=no collision)
   * Bit 4: M4D - Sprite 4 collision with data (1=collided with background, 0=no collision)
   * Bit 3: M3D - Sprite 3 collision with data (1=collided with background, 0=no collision)
   * Bit 2: M2D - Sprite 2 collision with data (1=collided with background, 0=no collision)
   * Bit 1: M1D - Sprite 1 collision with data (1=collided with background, 0=no collision)
   * Bit 0: M0D - Sprite 0 collision with data (1=collided with background, 0=no collision)
   *
   * $D020 (32) - Border Color
   * Bits 7-4: Unused
   * Bits 3-0: EC - Border color
   *
   * $D021 (33) - Background Color 0
   * Bits 7-4: Unused
   * Bits 3-0: B0C - Background color 0
   *
   * $D022 (34) - Background Color 1
   * Bits 7-4: Unused
   * Bits 3-0: B1C - Background color 1
   *
   * $D023 (35) - Background Color 2
   * Bits 7-4: Unused
   * Bits 3-0: B2C - Background color 2
   *
   * $D024 (36) - Background Color 3
   * Bits 7-4: Unused
   * Bits 3-0: B3C - Background color 3
   *
   * $D025 (37) - Sprite Multicolor 0
   * Bits 7-4: Unused
   * Bits 3-0: MM0 - Sprite multicolor 0
   *
   * $D026 (38) - Sprite Multicolor 1
   * Bits 7-4: Unused
   * Bits 3-0: MM1 - Sprite multicolor 1
   *
   * $D027-$D02E (39-46) - Sprite Colors
   * $D027 (39) - M0C: Color sprite 0
   * $D028 (40) - M1C: Color sprite 1
   * $D029 (41) - M2C: Color sprite 2
   * $D02A (42) - M3C: Color sprite 3
   * $D02B (43) - M4C: Color sprite 4
   * $D02C (44) - M5C: Color sprite 5
   * $D02D (45) - M6C: Color sprite 6
   * $D02E (46) - M7C: Color sprite 7
   * Bits 7-4: Unused
   * Bits 3-0: Sprite color
   */
  registers: Uint8Array;

  // ----------------------------------------------------------------------------------------------
  // --- Counters

  // --- Raster lines between 0 and this.configuration.rasterLines
  currentRasterLine: number;

  // --- Current cycle in a raster line (between 0 and this.configuration.cyclesPerLine)
  currentCycle: number;

  // --- VC: 10 bit counter (current video matrix position, between 0 and 999)
  videoMatrixCounter: number;

  // --- VCBASE: 10 bit data register with reset input that can be loaded with the value from VC
  videoCounterBase: number;

  // --- RC: 3 bit counter (row number within a character line, between 0 and 7)
  rowCounter: number;

  firstDmaLine: number;
  lastDmaLine: number;

  /**
   * The 16 standard colors of the Commodore 64
   */
  private readonly s_C64Colors: number[] = [
    0xff000000, // Black
    0xffffffff, // White
    0xff883932, // Red
    0xff67b6bd, // Cyan
    0xff8b3f96, // Purple/Magenta
    0xff55a049, // Green
    0xff40318d, // Blue
    0xffbfce72, // Yellow
    0xff8b5429, // Orange/Brown
    0xff574200, // Light Brown
    0xffb86962, // Light Red
    0xff505050, // Dark Grey
    0xff787878, // Medium Grey
    0xffa4e599, // Light Green
    0xff867ade, // Light Blue
    0xffb8b8b8 // Light Grey
  ];

  // --- The table with rendering tacts for each cycle within a raster line
  private renderingTactTable: RenderingTact[];

  // --- Store the pixels that can be rendered on the physical screen
  private _pixelBuffer: Uint32Array;

  constructor(
    public readonly machine: IC64Machine,
    public readonly configuration: VicChipConfiguration
  ) {
    this.reset();
  }

  /**
   * The VIC-II chip is responsible for video output in the C64.
   * This method initializes the VIC-II chip with default settings.
   */
  reset(): void {
    // --- Reset the register values
    this.registers = new Uint8Array(0x2f);
    for (let i = 0; i < this.registers.length; i++) {
      this.registers[i] = 0x00;
    }

    // --- Counters
    this.currentRasterLine = 0;
    this.currentCycle = 0;
    this.videoMatrixCounter = 0;
    this.videoCounterBase = 0;

    // --- Set up VIC registers to their value after a reset
    // TODO

    // --- Initialize DMA lines based on chip configuration (RSEL=0 initially)
    this.updateDmaLines(false);

    // --- Initialize composed raster interrupt line (RST8=0, $d012=0 initially)
    this.rasterInterruptLine = 0;

    this.initializeRenderingTactTableNew();
  }

  /**
   * Executes the current VIC rendering cycle based on the current clock.
   * @returns True, if the CPU is stalled; otherwise, false.
   */
  renderCurrentTact(): boolean {
    // --- By default allow the CPU to access the bus
    let shouldStall = false;

    // --- TODO: execute the current rendering cycle

    // --- Move to the next cycle
    this.currentCycle++;
    if (this.currentCycle >= this.tactsInDisplayLine) {
      this.currentCycle = 0;
      this.currentRasterLine++;
      if (this.currentRasterLine >= this.rasterLines) {
        this.currentRasterLine = 0;
      }
    }

    return shouldStall;
  }

  /**
   * Sets the current VIC bank (0-3)
   * @param bank The VIC bank number
   */
  setBaseBank(bank: number): void {
    // TODO: Implement bank switching
  }

  /**
   * Get the number of raster lines (height of the screen including non-visible lines).
   */
  rasterLines: number;

  /**
   * Get the width of the rendered screen.
   */
  screenWidth: number;

  /**
   * Get the number of visible screen lines.
   */
  screenLines: number;

  /**
   * The number of tacts in a single display line.
   */
  tactsInDisplayLine: number;

  getPixelBuffer(): Uint32Array {
    return this._pixelBuffer;
  }

  /**
   * Check if the device asks for a non-maskable interrupt (NMI).
   */
  requestsNmi(): boolean {
    // TODO: Implement this method
    return false;
  }

  /**
   * Optional hard reset operation
   */
  hardReset?: () => void = () => {
    // Perform a full reset, including any hardware-specific state
    this.reset();
    // Additional hard reset logic can be added here
  };

  /**
   * Dispose the resources held by the device
   */
  dispose(): void {
    // Clean up resources if necessary
    // For now, nothing to dispose
  }

  /**
   * Read a VIC-II register value
   * @param regIndex Register index (0-47, corresponding to $D000-$D02E)
   * @returns The value of the register
   */
  readRegister(regIndex: number): number {
    regIndex &= 0x3f; // Limit to 64 registers (0-63), with mirroring

    // --- Handle unused registers
    if (regIndex >= 0x2f) {
      return 0xff;
    }

    // --- Handle special read operations
    switch (regIndex) {
      case 0x11:
      case 0x12:
        // TODO: Implement
        return 0xff;

      case 0x13:
        // TODO: Implement light pen X read
        return 0xff;

      case 0x14:
        // TODO: Implement light pen Y read
        return 0xff;

      case 0x16:
        return this.registers[regIndex] | 0xc0;

      case 0x18:
        return this.registers[regIndex] | 0x01;

      case 0x19:
        // TODO: IRQ flag register
        return 0xff;

      case 0x1a:
        return this.registers[regIndex] | 0xf0;

      case 0x1e:
        // TODO: Implement sprite-sprite collision flag read
        return 0xff;

      case 0x1f:
        // TODO: Implement sprite-data collision flag read
        return 0xff;

      case 0x20:
        // TODO: Implement border color read
        return 0xff;

      case 0x21:
      case 0x22:
      case 0x23:
      case 0x24:
      case 0x25:
      case 0x26:
      case 0x27:
      case 0x28:
      case 0x29:
      case 0x2a:
      case 0x2b:
      case 0x2c:
      case 0x2d:
      case 0x2e:
        return this.registers[regIndex] | 0xf0;
      default:
        return this.registers[regIndex];
    }
  }

  /**
   * Write to a VIC-II register
   * @param regIndex Register index (0-47, corresponding to $D000-$D02E)
   * @param value The value to write
   */
  writeRegister(regIndex: number, value: number): void {
    regIndex &= 0x3f; // Limit to 64 registers (0-63), with mirroring
    value &= 0xff; // Ensure it's a byte value
    const currentTacts = this.machine.tacts;

    // TODO
    //this.handlePendingAlarmsExternalWrite();

    /* This is necessary as we must be sure that the previous line has been
       updated and `current_line' is actually set to the current Y position of
       the raster.  Otherwise we might mix the changes for this line with the
       changes for the previous one.  */
    // TODO
    // if (currentTacts >= this._drawTact) {
    //   this.handleRasterDraw(currentTacts - this._drawTact);
    // }

    // this._lastBusPhi2 = value; // Store the last value written to the bus

    // --- Handle unused registers
    if (regIndex >= 0x2f) {
      return;
    }

    switch (regIndex) {
      case 0x0: /* $D000: Sprite #0 X position LSB */
      case 0x2: /* $D002: Sprite #1 X position LSB */
      case 0x4: /* $D004: Sprite #2 X position LSB */
      case 0x6: /* $D006: Sprite #3 X position LSB */
      case 0x8: /* $D008: Sprite #4 X position LSB */
      case 0xa: /* $D00a: Sprite #5 X position LSB */
      case 0xc: /* $D00c: Sprite #6 X position LSB */
      case 0xe /* $D00e: Sprite #7 X position LSB */:
        // TODO: Implement this
        // this.storeSpriteXPositionLsb(regIndex, value);
        break;

      case 0x1: /* $D001: Sprite #0 Y position */
      case 0x3: /* $D003: Sprite #1 Y position */
      case 0x5: /* $D005: Sprite #2 Y position */
      case 0x7: /* $D007: Sprite #3 Y position */
      case 0x9: /* $D009: Sprite #4 Y position */
      case 0xb: /* $D00B: Sprite #5 Y position */
      case 0xd: /* $D00D: Sprite #6 Y position */
      case 0xf /* $D00F: Sprite #7 Y position */:
        // TODO: Implement this
        // this.storeSpriteYPosition(regIndex, value);
        break;

      case 0x10 /* $D010: Sprite X position MSB */:
        // TODO: Implement this
        // this.storeSpriteXPositionMsb(regIndex, value);
        break;

      case 0x11 /* $D011: video mode, Y scroll, 24/25 line mode and raster MSB */:
        this.setRegD011Value(value);
        break;

      case 0x12 /* $D012: Raster line compare */:
        this.setRegD012Value(value);
        break;

      case 0x13: /* $D013: Light Pen X */
      case 0x14 /* $D014: Light Pen Y */:
        break;

      case 0x15 /* $D015: Sprite Enable */:
        this.setRegD015Value(value);
        break;

      case 0x16 /* $D016 */:
        this.setRegD016Value(value);
        break;

      case 0x17 /* $D017: Sprite Y-expand */:
        this.setRegD017Value(value);
        break;

      case 0x18 /* $D018: Video and char matrix base
                                     address */:
        this.setRegD018Value(value);
        break;

      case 0x19:
        this.setRegD019Value(value);
        break;

      case 0x1a:
        this.setRegD01AValue(value);
        break;

      case 0x1b /* $D01B: Sprite priority */:
        this.setRegD01BValue(value);
        break;

      case 0x1c /* $D01C: Sprite Multicolor select */:
        this.setRegD01CValue(value);
        break;

      case 0x1d /* $D01D: Sprite X-expand */:
        this.setRegD01DValue(value);
        break;

      case 0x1e: /* $D01E: Sprite-sprite collision */
      case 0x1f /* $D01F: Sprite-background collision */:
        break;

      case 0x20 /* $D020: Border color */:
        this.setRegD020Value(value);
        break;

      case 0x21 /* $D021: Background #0 color */:
        this.setRegD021Value(value);
        break;

      case 0x22: /* $D022: Background #1 color */
      case 0x23: /* $D023: Background #2 color */
      case 0x24 /* $D024: Background #3 color */:
        this.setExtBackgroundColor(regIndex, value);
        break;

      case 0x25 /* $D025: Sprite multicolor register #0 */:
        this.setRegD025Value(value);
        break;

      case 0x26 /* $D026: Sprite multicolor register #1 */:
        this.setRegD026Value(value);
        break;

      case 0x27: /* $D027: Sprite #0 color */
      case 0x28: /* $D028: Sprite #1 color */
      case 0x29: /* $D029: Sprite #2 color */
      case 0x2a: /* $D02A: Sprite #3 color */
      case 0x2b: /* $D02B: Sprite #4 color */
      case 0x2c: /* $D02C: Sprite #5 color */
      case 0x2d: /* $D02D: Sprite #6 color */
      case 0x2e /* $D02E: Sprite #7 color */:
        this.setSpriteColor(regIndex, value);
        break;
    }
  }

  /**
   * This method renders the entire screen frame as the shadow screen
   * @param savedPixelBuffer Optional pixel buffer to save the rendered screen
   * @returns The pixel buffer that represents the previous screen
   */
  renderInstantScreen(_savedPixelBuffer?: Uint32Array): Uint32Array {
    // TODO: Implement the rendering logic for the C64 VIC-II chip
    return this._pixelBuffer;
  }

  /**
   * Reads data from the VIC-II chip's PHI1 clock cycle
   * @returns The data read from the PHI1 clock cycle
   */
  readPhi1Data(): number {
    const cycle = this.machine.tactsInCurrentFrame % this.tactsInDisplayLine;
    switch (this.tactsInDisplayLine) {
      case 63:
      default:
        return phi1Pal();
      case 64:
        return phi1NtscOld();
      case 65:
        return phi1Ntsc();
    }

    function phi1Pal() {
      // switch (cycle) {
      //   case 0:
      //     return sprite_pointer(3);
      //   case 1:
      //     return sprite_data(3);
      //   case 2:
      //     return sprite_pointer(4);
      //   case 3:
      //     return sprite_data(4);
      //   case 4:
      //     return sprite_pointer(5);
      //   case 5:
      //     return sprite_data(5);
      //   case 6:
      //     return sprite_pointer(6);
      //   case 7:
      //     return sprite_data(6);
      //   case 8:
      //     return sprite_pointer(7);
      //   case 9:
      //     return sprite_data(7);

      //   case 10:
      //   case 11:
      //   case 12:
      //   case 13:
      //   case 14:
      //     return refresh_counter(cycle - 10);

      //   default: /* 15 .. 54 */
      //     return gfx_data(cycle - 15);

      //   case 55:
      //   case 56:
      //     return idle_gap();

      //   case 57:
      //     return sprite_pointer(0);
      //   case 58:
      //     return sprite_data(0);
      //   case 59:
      //     return sprite_pointer(1);
      //   case 60:
      //     return sprite_data(1);
      //   case 61:
      //     return sprite_pointer(2);
      //   case 62:
      //     return sprite_data(2);
      // }
      return 0;
    }

    function phi1NtscOld() {
      // switch (cycle) {
      //   case 0:
      //     return sprite_pointer(3);
      //   case 1:
      //     return sprite_data(3);
      //   case 2:
      //     return sprite_pointer(4);
      //   case 3:
      //     return sprite_data(4);
      //   case 4:
      //     return sprite_pointer(5);
      //   case 5:
      //     return sprite_data(5);
      //   case 6:
      //     return sprite_pointer(6);
      //   case 7:
      //     return sprite_data(6);
      //   case 8:
      //     return sprite_pointer(7);
      //   case 9:
      //     return sprite_data(7);

      //   case 10:
      //   case 11:
      //   case 12:
      //   case 13:
      //   case 14:
      //     return refresh_counter(cycle - 10);

      //   default: /* 15 .. 54 */
      //     return gfx_data(cycle - 15);

      //   case 55:
      //   case 56:
      //   case 57:
      //     return idle_gap();

      //   case 58:
      //     return sprite_pointer(0);
      //   case 59:
      //     return sprite_data(0);
      //   case 60:
      //     return sprite_pointer(1);
      //   case 61:
      //     return sprite_data(1);
      //   case 62:
      //     return sprite_pointer(2);
      //   case 63:
      //     return sprite_data(2);
      // }
      return 0;
    }

    function phi1Ntsc() {
      // switch (cycle) {
      //   case 0:
      //     return sprite_data(3);
      //   case 1:
      //     return sprite_pointer(4);
      //   case 2:
      //     return sprite_data(4);
      //   case 3:
      //     return sprite_pointer(5);
      //   case 4:
      //     return sprite_data(5);
      //   case 5:
      //     return sprite_pointer(6);
      //   case 6:
      //     return sprite_data(6);
      //   case 7:
      //     return sprite_pointer(7);
      //   case 8:
      //     return sprite_data(7);

      //   case 9:
      //     return idle_gap();

      //   case 10:
      //   case 11:
      //   case 12:
      //   case 13:
      //   case 14:
      //     return refresh_counter(cycle - 10);

      //   default: /* 15 .. 54 */
      //     return gfx_data(cycle - 15);

      //   case 55:
      //   case 56:
      //   case 57:
      //     return idle_gap();

      //   case 58:
      //     return sprite_pointer(0);
      //   case 59:
      //     return sprite_data(0);
      //   case 60:
      //     return sprite_pointer(1);
      //   case 61:
      //     return sprite_data(1);
      //   case 62:
      //     return sprite_pointer(2);
      //   case 63:
      //     return sprite_data(2);
      //   case 64:
      //     return sprite_pointer(3);
      // }
      return 0;
    }
  }

  /**
   * Initialize the helper tables that accelerate screen rendering by precalculating rendering tact information.
   */
  private initializeRenderingTactTableNew(): void {
    // --- Calculate the rendered screen size in pixels
    this.rasterLines = this.configuration.numRasterLines;
    this.tactsInDisplayLine = this.configuration.cyclesPerLine;

    this.screenLines = this.configuration.borderTop + 25 * 8 + this.configuration.borderBottom;
    this.screenWidth = this.configuration.borderLeft + 8 * 40 + this.configuration.borderRight;

    // --- Prepare the pixel buffer to store the rendered screen bitmap
    this._pixelBuffer = new Uint32Array((this.screenLines + 4) * this.screenWidth);

    // --- Calculate the entire rendering time of a single screen line

    // --- Determine the number of tacts in a machine frame
    const tactsInFrame = this.rasterLines * this.tactsInDisplayLine;

    // --- Notify the CPU about it
    this.machine.setTactsInFrame(tactsInFrame);

    // --- Calculate the rendering tact table
    this.renderingTactTable = [];
    const xposPhi: number[] = [];
    const fetchPhi: number[] = [];
    const baPhi: number[] = [];
    const flagsPhi: number[] = [];

    const ct = this.configuration.cycleTable;
    for (let i = 0; i < this.tactsInDisplayLine * 2; i++) {
      const phi = ct[i].cycle & 0x80 ? 1 : 0;
      const cycle = ct[i].cycle & 0x7f;
      xposPhi[phi] = ct[i].xpos;
      fetchPhi[phi] = ct[i].fetch;
      baPhi[phi] = ct[i].ba;
      flagsPhi[phi] = ct[i].flags;

      // --- Both Phi1 and Phi2 collected, generate table
      if (phi) {
        const f = flagsPhi[0] | flagsPhi[1];
        const tactInfo: RenderingTact = {
          cycle,
          xPosition: xposPhi[0] >> 3,
          mayFetchVideoMatrix: (fetchPhi[1] & FetchType_M) === FetchC,
          checkFetchBA: !!(baPhi[0] & BaFetch),
          checkSpriteFetchBAMask: baPhi[0] & BaSpr_M
        };

        switch (fetchPhi[0] & FetchType_M) {
          case SprPtr(0):
            // --- Sprite Ptr (Phi1) + DMA0 (Phi2)
            tactInfo.fetchOperation = this.FetchSprPtr;
            tactInfo.spriteIndex = fetchPhi[0] & FetchSprNum_M;
            break;
          case SprDma1(0):
            // --- Sprite DMA1 (Phi1) + DMA2 (Phi2)
            tactInfo.fetchOperation = this.FetchSprData;
            tactInfo.spriteIndex = fetchPhi[0] & FetchSprNum_M;
            break;
          case Refresh:
            tactInfo.fetchOperation = this.FetchRefresh;
            break;
          case FetchG:
            tactInfo.fetchOperation = this.FetchG;
            break;
          default:
            tactInfo.fetchOperation = this.FetchIdle;
            break;
        }

        // --- Update VC/RC (Phi2)
        if (f & UpdateVc) {
          tactInfo.counterOperation = this.UpdateVC;
        }
        if (f & UpdateRc) {
          tactInfo.counterOperation = this.UpdateRC;
        }

        // --- Sprite operations
        if (f & ChkSprExp) {
          tactInfo.spriteOperation = this.CheckSpriteExpansion;
        }
        if (f & ChkSprDma) {
          tactInfo.spriteOperation = this.CheckSpriteDma;
        }
        if (f & UpdateMcBase) {
          tactInfo.spriteOperation = this.UpdateSpriteBaseAddress;
        }
        if (f & ChkSprCrunch) {
          tactInfo.spriteOperation = this.CheckSpriteCrunching;
        }

        // --- Border operations
        if (f & ChkBrdL0) {
          tactInfo.borderOperation = this.CheckLeftBorderWhenNoCSEL;
        }
        if (f & ChkBrdL1) {
          tactInfo.borderOperation = this.CheckLeftBorderWhenCSEL;
        }
        if (f & ChkBrdR0) {
          tactInfo.borderOperation = this.CheckRightBorderWhenNoCSEL;
        }
        if (f & ChkBrdR1) {
          tactInfo.borderOperation = this.CheckRightBorderWhenCSEL;
        }

        // --- This tact is processed
        this.renderingTactTable[cycle - 1] = tactInfo;
      }
    }
  }

  // ----------------------------------------------------------------------------------------------
  // Register $D011
  rst8: boolean;
  ecm: boolean;
  bmm: boolean;
  den: boolean;
  rsel: boolean;
  yScroll: number;

  // --- Set VIC Register $D011 (Control Register 1)
  // --- As per VIC-II doc section 3.2: Registers, section 3.5: Bad Lines, section 3.14.6: DMA delay
  // --- Cross-register dependencies: Interacts with $d016 (MCM bit for graphics modes), 
  // --- $d012 (RST8 for raster interrupts)
  private setRegD011Value(value: number) {
    // --- STEP 1: Extract new values from register bits
    const newRst8 = !!(value & 0x80);
    const newEcm = !!(value & 0x40);
    const newBmm = !!(value & 0x20);
    const newDen = !!(value & 0x10);
    const newRsel = !!(value & 0x08);
    const newYScroll = value & 0x07;

    // --- STEP 2: Detect changes for each bit/field and handle effects
    
    if (this.ecm !== newEcm) {
      // --- ECM (Extended Character Mode) has changed
      // --- As per VIC-II doc section 3.7.3.5: ECM text mode, section 3.6.2: Address types
      // **The ECM bit is the sole determining factor for forcing address lines 9 and 10 to zero.**
      if (newEcm) {
        // --- ECM changes from 0 to 1 (Setting ECM)
        // --- IMMEDIATE EFFECTS (same cycle):
        // - g-accesses: Address lines 9 and 10 are forced to 0
        // - Idle state accesses: Change from $3fff to $39ff
        // - Character set limitation: Only 64 characters available (instead of 256)
        // --- DISPLAY CHANGES:
        // - ECM text mode: Background color selection becomes available via upper 2 bits of character codes
        // - Invalid modes: Screen goes black, but internal graphics generation continues (detectable via sprite collisions)
      } else {
        // --- ECM changes from 1 to 0 (Clearing ECM)
        // --- IMMEDIATE EFFECTS (same cycle):
        // - Address lines 9 and 10 are no longer forced to 0
        // - Full 256-character set becomes available again
        // - Normal color schemes restored
        // - Idle state accesses: Return to $3fff
      }
    }

    if (this.bmm !== newBmm) {
      // --- BMM (Bitmap Mode) has changed
      // --- As per VIC-II doc section 3.7.3: Graphics modes, section 3.7.1: Idle state/display state
      // --- Cross-register dependency: Combined with ECM and MCM bits from $d016 determines graphics mode
      if (newBmm) {
        // --- BMM changes from 0 to 1 (Setting Bitmap Mode)
        // --- CONDITIONAL EFFECTS (depends on display state):
        // - In display state: Switch from character generator to bitmap data addressing
        // - In idle state: BMM bit is ignored, g-accesses remain at $3fff
        // --- IMMEDIATE EFFECTS (same cycle):
        // - Address calculation: VC becomes base address for bitmap data instead of character codes
        // - Character generator: No longer accessed for pixel data (in display state)
        // --- DISPLAY CHANGES:
        // - Text mode: Character shapes replaced by bitmap pixel data
        // - Multicolor: 160x200 4-color bitmap vs 320x200 2-color bitmap
        // - Invalid modes: If ECM=1, screen goes black but collision detection continues
      } else {
        // --- BMM changes from 1 to 0 (Clearing Bitmap Mode)
        // --- IMMEDIATE EFFECTS (same cycle):
        // - g-accesses: Switch back to character generator addressing (in display state)
        // - Address calculation: VC provides character codes, RC provides character line
        // - Character generator: Resumed for pixel pattern lookup
        // --- DISPLAY CHANGES:
        // - Bitmap data: Replaced by character-based text display
        // - Character patterns: Restored from character generator ROM/RAM
      }
    }

    if (this.den !== newDen) {
      // --- DEN (Display Enable) has changed
      if (newDen) {
        // --- DEN changes from 0 to 1 (Setting Display Enable)
        // Immediate effects:
        // - Bad Lines: Enabled when raster line matches display window and YSCROLL
        // - Border generation: Vertical border flip-flop behavior restored
        // - Memory access: Character/bitmap data reading resumes on Bad Lines
        // Display Changes:
        // - Graphics: Text/bitmap content becomes visible
        // - Border: Returns to normal border vs display area behavior
        // - Background: Interior area shows graphics instead of border color
      } else {
        // --- DEN changes from 1 to 0 (Clearing Display Enable)
        // Immediate effects:
        // - Bad Lines: Completely suppressed, no character data reading
        // - Border generation: Vertical border extends across entire screen
        // - Memory access: VC and RC counters stop updating
        // Display Changes:
        // - Graphics: All text/bitmap content disappears
        // - Border: Border color displayed across entire screen area
        // - Background: No distinction between border and display area
      }
    }

    if (this.rsel !== newRsel) {
      // --- RSEL (Row Select) has changed
      if (newRsel) {
        // --- RSEL changes from 0 to 1 (Setting 25-line mode)
        // Immediate effects:
        // - Display window: Expands to 25 text lines (200 pixels) vs 24 lines (192 pixels)
        // - Border comparison: Uses lines 51-250 instead of 55-246
        // - Vertical border: Border area reduced at top and bottom
        // Display Changes:
        // - Visible area: Additional 4 pixels visible at top and bottom
        // - Border: Narrower vertical borders
        // - Bad Line range: Expanded to cover additional display lines
      } else {
        // --- RSEL changes from 1 to 0 (Clearing 25-line mode, 24-line mode)
        // Immediate effects:
        // - Display window: Contracts to 24 text lines (192 pixels)
        // - Border comparison: Uses lines 55-246 instead of 51-250
        // - Vertical border: Border area extended at top and bottom
        // Display Changes:
        // - Visible area: 4 pixels hidden at top and bottom, replaced by border
        // - Border: Wider vertical borders
        // - Bad Line range: Reduced to cover fewer display lines
      }

      // --- Update DMA lines based on new RSEL value
      this.updateDmaLines(newRsel);
    }

    if (this.yScroll !== newYScroll) {
      // --- YSCROLL (Vertical Fine Scrolling) has changed
      // Immediate effects:
      // - Bad Line timing: Bad Lines occur when (raster_line & 7) == YSCROLL
      // - Character row counter: RC advances when Bad Line condition is met
      // - Vertical scrolling: Display shifted vertically by 0-7 pixels
      // - DMA delay: Writes in cycles 15-53 may cause horizontal scrolling effects
      //
      // Critical timing considerations:
      // - Current line effects: May suppress/create Bad Line on current raster line
      // - Future line effects: Changes Bad Line pattern for rest of frame
      // - FLD (Flexible Line Distance): Can suppress Bad Lines by setting non-matching YSCROLL
      // - FLI (Flexible Line Interpretation): Can force extra Bad Lines for color-per-line effects
      //
      // Display Changes:
      // - Fine scrolling: Graphics shifted down by newYScroll pixels
      // - Bad Line suppression: Blank lines where character data isn't read
      // - Character timing: Affects which character line (RC) is displayed
    }

    // --- Activities that occur regardless of YSCROLL value change
    // According to VIC-II documentation, writes to $d011 have timing-sensitive effects:

    // --- DMA delay check (critical timing window: cycles 15-53)
    // TODO: Get current cycle within raster line (0-62 for PAL, 0-64 for NTSC)
    // TODO: Get current raster line number
    if (false /* TODO: currentCycle >= 15 && currentCycle <= 53 */) {
      // --- Write to $d011 in cycles 15-53 causes DMA delay
      // "If a write to register $d011 occurs in cycles 15-53 of a raster line,
      //  the video counter advances by one less than normal"
      // This creates horizontal scrolling effects and affects memory access timing
      // TODO: Implement video counter adjustment for DMA delay
      // TODO: Adjust VC (Video Counter) by -1 for this raster line
      // TODO: This affects horizontal positioning of graphics data
    }

    // --- Bad Line state evaluation (always check regardless of YSCROLL change)
    // Bad Line condition: DEN=1 AND (raster_line >= first_dma_line) AND (raster_line <= last_dma_line)
    //                     AND ((raster_line & 7) == YSCROLL)
    if (
      newDen &&
      false /* TODO: && currentRasterLine >= this._firstDmaLine && currentRasterLine <= this._lastDmaLine */
    ) {
      // TODO: Calculate Bad Line condition: (currentRasterLine & 7) === newYScroll
      // TODO: Compare with previous Bad Line state to detect changes
      // TODO: If Bad Line becomes active: Prepare for character/color data reading
      // TODO: If Bad Line becomes inactive: Handle ongoing display data
      // TODO: Update internal Bad Line flag and related counters
      // TODO: Affect VC and RC (Row Counter) behavior for this line
      // NOTE: this._firstDmaLine and this._lastDmaLine are now updated automatically
      //       when RSEL changes via updateDmaLines() method
    }

    // --- TIMING-CRITICAL: Raster interrupt comparison update (RST8 always affects interrupt timing)
    // --- As per VIC-II doc section 3.12: VIC interrupts
    // --- Cross-register dependency: Combined with $d012 to form 9-bit raster interrupt value
    if (this.rst8 !== newRst8) {
      // --- Store old value before updating rst8
      const oldRasterIrqLine = this.rasterInterruptLine;
      
      // --- Update rst8 first (needed for updateRasterInterruptLine)
      this.rst8 = newRst8;
      
      // --- Update composed 9-bit raster interrupt line
      this.updateRasterInterruptLine();
      
      if (oldRasterIrqLine !== this.rasterInterruptLine) {
        // --- IMMEDIATE EFFECTS (same cycle):
        // - Updated 9-bit raster interrupt comparison value
        // - Raster interrupt timing: VIC tests for matches in cycle 0 of every raster line
        
        // --- CONDITIONAL EFFECTS (depends on current state):
        // TODO: Get current raster line number
        // TODO: Check if new comparison value matches current raster line
        // TODO: Handle immediate interrupt triggering if conditions are met
        // TODO: This affects when the next raster interrupt will occur
      }
    }

    // --- STEP 4: Update internal state (rst8 already updated in RST8 change handler above)
    // this.rst8 = newRst8; // Already updated in RST8 change handler
    this.ecm = newEcm;
    this.bmm = newBmm;
    this.den = newDen;
    this.rsel = newRsel;
    this.yScroll = newYScroll;
    this.registers[0x11] = value & 0xff;
    
    // --- Register handling complete - all effects processed according to VIC-II documentation
  }

  // ----------------------------------------------------------------------------------------------
  // Register $D012 (Raster Counter)
  
  // --- 9-bit raster interrupt line (RST8 from $d011 + 8 bits from $d012)
  // --- This is the composed value used for raster interrupt comparisons
  public rasterInterruptLine: number;

  // --- Set VIC Register $D012 (Raster Counter - lower 8 bits)
  // --- As per VIC-II doc section 3.12: VIC interrupts, section 3.2: Registers
  // --- Cross-register dependencies: Combined with $d011 bit 7 (RST8) to form 9-bit raster interrupt value
  private setRegD012Value(value: number) {
    // --- STEP 1: Extract new values from register bits
    const newRasterIrqLow = value & 0xff;
    
    // --- STEP 2: Detect changes in the composed 9-bit interrupt line
    const oldRasterIrqLine = this.rasterInterruptLine;
    
    // --- STEP 3: Update register first (needed for updateRasterInterruptLine)
    this.registers[0x12] = newRasterIrqLow;
    
    // --- STEP 4: Update composed value and detect changes
    this.updateRasterInterruptLine();
    
    if (oldRasterIrqLine !== this.rasterInterruptLine) {
      // --- Raster interrupt line has changed
      // --- As per VIC-II doc section 3.12: VIC interrupts
      
      // --- IMMEDIATE EFFECTS (same cycle):
      // - Updated internal 9-bit raster interrupt comparison value
      // - Raster interrupt timing: VIC tests for matches in cycle 0 of every raster line
      // - Interrupt condition: Triggers when current raster line equals interrupt line
      
      // --- CONDITIONAL EFFECTS (depends on current state):
      // TODO: Get current raster line number
      // TODO: Check if new interrupt line matches current raster position
      // TODO: If match occurs: Handle immediate raster interrupt triggering
      // TODO: If no immediate match: Update for future interrupt on target line
      
      // --- TIMING-CRITICAL considerations:
      // - Interrupt flag set in cycle 0 of the matching raster line
      // - CPU interrupt signal raised if raster interrupts are enabled (IRQ mask in $d01a)
      // - Special case: Writing during cycle 0 of matching line may affect current interrupt
    }
    
    // --- Register handling complete - raster interrupt line updated according to VIC-II documentation
  }

  /**
   * Updates the composed 9-bit raster interrupt line from RST8 ($d011 bit 7) and $d012.
   * This method should be called whenever either dependency changes.
   */
  private updateRasterInterruptLine(): void {
    this.rasterInterruptLine = (this.rst8 ? 256 : 0) | this.registers[0x12];
    
    // TODO: If value changed, handle raster interrupt logic
    // TODO: Check if new interrupt line matches current raster position
    // TODO: Update interrupt timing for future raster line matches
  }

  // --- Set VIC R15
  private setRegD015Value(value: number) {
    // TODO: Implement the function
  }

  // --- Set VIC R16
  private setRegD016Value(value: number) {
    // TODO: Implement the function
  }

  // --- Set VIC R17
  private setRegD017Value(value: number) {
    // TODO: Implement the function
  }

  // --- Set VIC R18
  private setRegD018Value(value: number) {
    // TODO: Implement the function
  }

  // --- Set VIC R19
  private setRegD019Value(value: number) {
    // TODO: Implement the function
  }

  // --- Set VIC R1A
  private setRegD01AValue(value: number) {
    // TODO: Implement the function
  }

  // --- Set VIC R1B
  private setRegD01BValue(value: number) {
    // TODO: Implement the function
  }

  // --- Set VIC R1C
  private setRegD01CValue(value: number) {
    // TODO: Implement the function
  }

  // --- Set VIC R1D
  private setRegD01DValue(value: number) {
    // TODO: Implement the function
  }

  // --- Set VIC R20
  private setRegD020Value(value: number) {
    // TODO: Implement the function
  }

  // --- Set VIC R21
  private setRegD021Value(value: number) {
    // TODO: Implement the function
  }

  // --- Set VIC R25
  private setRegD025Value(value: number) {
    // TODO: Implement the function
  }

  // --- Set VIC R26
  private setRegD026Value(value: number) {
    // TODO: Implement the function
  }

  // ----------------------------------------------------------------------------------------------
  // Video modes

  // ----------------------------------------------------------------------------------------------
  // IRQ

  /**
   * Check if the device asks for an interrupt request (IRQ).
   * This method is used by the CPU to determine if it should handle an IRQ.
   */
  requestsIrq(): boolean {
    // TODO: Implement the function
    return false;
  }

  // ----------------------------------------------------------------------------------------------
  // Bad line handling

  /**
   * Updates the first and last DMA lines based on chip configuration and RSEL bit.
   * @param rsel The RSEL bit value (true for 25-line mode, false for 24-line mode)
   */
  private updateDmaLines(rsel: boolean): void {
    // Calculate first and last DMA lines based on chip configuration and RSEL
    // RSEL=1 (25 lines): full display window
    // RSEL=0 (24 lines): display window reduced by 4 lines at top and bottom
    this.firstDmaLine = this.configuration.firstDisplayedLine + (rsel ? 0 : 4);
    this.lastDmaLine = this.configuration.lastDisplayedLine - (rsel ? 0 : 4);
  }

  // ----------------------------------------------------------------------------------------------
  // Background color handling

  private setExtBackgroundColor(index: number, value: number) {
    // TODO: Implement the function
  }

  // ----------------------------------------------------------------------------------------------
  // Draw

  // ----------------------------------------------------------------------------------------------
  // Sprites

  private setSpriteColor(index: number, value: number) {
    // TODO: Implement the function
  }

  // ----------------------------------------------------------------------------------------------
  // Rendering operation methods

  private CheckLeftBorderWhenNoCSEL(tact: RenderingTact): void {
    // --- Implement this method
  }

  private CheckLeftBorderWhenCSEL(tact: RenderingTact): void {
    // --- Implement this method
  }

  private CheckRightBorderWhenNoCSEL(tact: RenderingTact): void {
    // --- Implement this method
  }

  private CheckRightBorderWhenCSEL(tact: RenderingTact): void {
    // --- Implement this method
  }

  private CheckSpriteExpansion(tact: RenderingTact): void {
    // --- Implement this method
  }

  private CheckSpriteDma(tact: RenderingTact): void {
    // --- Implement this method
  }

  private UpdateSpriteBaseAddress(tact: RenderingTact): void {
    // --- Implement this method
  }

  private CheckSpriteCrunching(tact: RenderingTact): void {
    // --- Implement this method
  }

  private UpdateVC(tact: RenderingTact): void {
    // --- Implement this method
  }

  private UpdateRC(tact: RenderingTact): void {
    // --- Implement this method
  }

  private FetchIdle(tact: RenderingTact): void {
    // --- Implement this method
  }

  private FetchRefresh(tact: RenderingTact): void {
    // --- Implement this method
  }

  private FetchG(tact: RenderingTact): void {
    // --- Implement this method
  }

  private FetchSprPtr(tact: RenderingTact): void {
    // --- Implement this method
  }

  private FetchSprData(tact: RenderingTact): void {
    // --- Implement this method
  }
}

type SpriteData = {
  // --- Sprite data to display
  data: number;

  // --- 6 bit counters
  mc: number;
  mcbase: number;

  // --- 8 bit pointer
  pointer: number;

  // --- Expansion flop
  exp_flop: boolean;

  // --- X coordinate
  x: number;
};

const enum VideoModes {
  VICII_NORMAL_TEXT_MODE = 0,
  VICII_MULTICOLOR_TEXT_MODE = 1,
  VICII_HIRES_BITMAP_MODE = 2,
  VICII_MULTICOLOR_BITMAP_MODE = 3,
  VICII_EXTENDED_TEXT_MODE = 4,
  VICII_ILLEGAL_TEXT_MODE = 5,
  VICII_ILLEGAL_BITMAP_MODE_1 = 6,
  VICII_ILLEGAL_BITMAP_MODE_2 = 7
}

type Idle3fff = {
  cycle: number;
  value: number;
};
