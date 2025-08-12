import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IC64Machine } from "../IC64Machine";
import { VicChipConfiguration } from "./types";
import {
  BaFetch,
  BaSpr_M,
  CHECK_BRD_CSEL,
  CHECK_BRD_L,
  CHECK_BRD_R,
  CHECK_SPR_CRUNCH,
  CHECK_SPR_DISP,
  CHECK_SPR_DMA,
  CHECK_SPR_EXP_M,
  ChkBrdL0,
  ChkBrdL1,
  ChkBrdR0,
  ChkBrdR1,
  ChkSprCrunch,
  ChkSprDisp,
  ChkSprDma,
  ChkSprExp,
  FETCH_BA_M,
  FetchC,
  FetchG,
  FetchSprNum_M,
  FetchType_M,
  PHI1_FETCH_G,
  PHI1_IDLE,
  PHI1_REFRESH,
  PHI1_SPR_DMA1,
  PHI1_SPR_NUM_B,
  PHI1_SPR_PTR,
  PHI2_FETCH_C_M,
  Refresh,
  SPRITE_BA_MASK_B,
  UPDATE_MCBASE,
  UPDATE_RC_M,
  UPDATE_VC_M,
  UpdateMcBase,
  UpdateRc,
  UpdateVc,
  VISIBLE_M,
  XPOS_B,
  XPOS_M
} from "./constants";
import { SprDma1, SprPtr } from "./vic-models";

/**
 * Implementation of the VIC-II (Video Interface Chip) for the Commodore 64
 * The VIC-II has 47 registers ($D000-$D02E) that control various aspects of the display
 */
export class C64VicDevice implements IGenericDevice<IC64Machine> {
  /**
   * The current VIC bank (0-3)
   */
  private _baseBank: number = 0;

  // --- The current screen configuration
  private _configuration: VicChipConfiguration;

  /**
   * The VIC register values
   */
  private _registers: Uint8Array;

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

  /**
   * Rendering table for each cycle of a raster line. Contains two items per cycle;
   * for the phi1 and phi2 phases. The bits are the following:
   * Bit 31-29: Border operations
   *   | 000: None
   *   | 100: Check if the left border ends (CSEL is clear)
   *   | 101: Check if the left border ends (CSEL is set)
   *   | 010: Check if the right border starts (CSEL is clear)
   *   | 011: Check if the right border starts (CSEL is set)
   * Bit 28-25: Sprites operations
   *   | 1---: Check Sprite Expansion
   *   | -001: Check Sprite Dma
   *   | -010: Check Sprite Display
   *   | -011: Update the sprites base address
   *   | -100: Check if Sprite Crunching
   * Bit 24-23: Counter operations
   *   | 00: None
   *   | 10: Update the internal video counter (VC, 10-bit)
   *   | 01: Update the row counter (RC, 8-bit, the row number within the current character)
   * Bit 22: Indicates that the cycle produces a visible pixel (border or data)
   * Bit 21-16: X position of the pixel in the current raster line (0-39 for 40 columns, 0-37 for 38 columns)
   * Bit 15: May fetch video matrix data (provided there is a bad line)
   * Bit 14-12: Sprite index (0..7): The sprite affected by the current fetch operation
   * Bit 11-09: Phi1 fetch operations
   *   | 000: Idle
   *   | 001: Refresh DRAM
   *   | 010: Fetch Fetch the character generator or bitmap value
   *   | 011: Fetch Sprite pointer + DMA0
   *   | 100: Fetch Sprite DMA1 + DMA2
   * Bit 08: Check fetch BA flag
   * Bit 07: Check Sprite 7 BA flag
   * Bit 06: Check Sprite 6 BA flag
   * Bit 05: Check Sprite 5 BA flag
   * Bit 04: Check Sprite 4 BA flag
   * Bit 03: Check Sprite 3 BA flag
   * Bit 02: Check Sprite 2 BA flag
   * Bit 01: Check Sprite 1 BA flag
   * Bit 00: Check Sprite 0 BA flag
   */
  private _renderingTactTable: number[];

  private _pixelBuffer = new Uint32Array(504 * 312); // Buffer for pixel data (width * height)

  // --------------------------------------------------------------------------
  // Internal VIC variables

  // --- Flag: Enable VIC-IIe features.
  private _vicExtended: boolean;

  // --- Flag: Enable DTV VIC-II features.
  private _vicDTV: boolean;

  // --- VIC-IIe clock mode.
  private _fastmode: boolean;

  // --- C128 2mhz cycle counter
  private _halfCycles: number;

  // --- Last value read by VICII during phi1.
  private _lastReadPhi1: number;

  // --- Last value on the internal VICII bus during phi2.
  private _lastBusPhi2: number;

  // --- Sprite information
  private _sprites: SpriteData[] = [];

  // ---Stores to 0x3fff idle location (used for idle sprite fetch).
  private _numIdle3fff: number;
  private _idle3fff: Idle3fff[];
  private _numIdle3fffOld: number;
  private _idle3fffOld: Idle3fff[];

  constructor(
    public readonly machine: IC64Machine,
    vicChipConfiguration: VicChipConfiguration
  ) {
    this._configuration = vicChipConfiguration;
    this.reset();
  }

  /**
   * Executes the next VIC rendering cycle. Returns the state of the VIC's BA line status.
   * @returns True, if the CPU is stalled; otherwise, false.
   */
  renderNextTact(): boolean {
    // --- By defult allow the CPU to access the bus
    let shouldStall = false;

    return shouldStall;
  }

  /**
   * Sets the current VIC bank (0-3)
   * @param bank The VIC bank number
   */
  setBaseBank(bank: number): void {
    this._baseBank = bank & 0x03; // Limit to 2 bits (0-3)
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
   * The VIC-II chip is responsible for video output in the C64.
   * This method initializes the VIC-II chip with default settings.
   */
  reset(): void {
    this._registers = new Uint8Array(0x2f);
    this._fastmode = false;
    this._halfCycles = 0;

    // --- For future extension
    this._vicExtended = false;
    this._vicDTV = false;

    this.initializeRenderingTactTable();
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
        return this._registers[regIndex] | 0xc0;

      case 0x18:
        return this._registers[regIndex] | 0x01;

      case 0x19:
        // TODO: IRQ flag register
        return 0xff;

      case 0x1a:
        return this._registers[regIndex] | 0xf0;

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
        return this._registers[regIndex] | 0xf0;
      default:
        return this._registers[regIndex];
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

    this._lastBusPhi2 = value; // Store the last value written to the bus

    // --- Handle unused registers
    if (regIndex >= 0x2f) {
      return;
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
  private initializeRenderingTactTable(): void {
    // --- Empty the rendering tact table

    this._renderingTactTable = [];
    // --- Calculate the rendered screen size in pixels
    this.rasterLines = this._configuration.numRasterLines;
    this.tactsInDisplayLine = this._configuration.cyclesPerLine;

    this.screenLines = this._configuration.borderTop + 25 * 8 + this._configuration.borderBottom;
    this.screenWidth = this._configuration.borderLeft + 8 * 40 + this._configuration.borderRight;

    // --- Prepare the pixel buffer to store the rendered screen bitmap
    this._pixelBuffer = new Uint32Array((this.screenLines + 4) * this.screenWidth);

    // --- Calculate the entire rendering time of a single screen line

    // --- Determine the number of tacts in a machine frame
    const tactsInFrame = this.rasterLines * this.tactsInDisplayLine;

    // --- Notify the CPU about it
    this.machine.setTactsInFrame(tactsInFrame);

    // ---
    const xpos_phi: number[] = [];
    const fetch_phi: number[] = [];
    const ba_phi: number[] = [];
    const flags_phi: number[] = [];

    const ct = this._configuration.cycleTable;
    for (let i = 0; i < this.tactsInDisplayLine * 2; i++) {
      const phi = ct[i].cycle & 0x80 ? 1 : 0;
      const cycle = ct[i].cycle & 0x7f;
      const xpos = ct[i].xpos;
      const fetch = ct[i].fetch;
      const ba = ct[i].ba;
      const flags = ct[i].flags;

      xpos_phi[phi] = xpos;
      fetch_phi[phi] = fetch;
      ba_phi[phi] = ba;
      flags_phi[phi] = flags;

      /* Both Phi1 and Phi2 collected, generate table */
      if (phi) {
        const f = flags_phi[0] | flags_phi[1];
        let entry = 0;

        entry |= (ba_phi[0] & BaSpr_M) << SPRITE_BA_MASK_B;
        entry |= ba_phi[0] & BaFetch ? FETCH_BA_M : 0;

        switch (fetch_phi[0] & FetchType_M) {
          case SprPtr(0):
            /* Sprite Ptr (Phi1) + DMA0 (Phi2) */
            entry |= PHI1_SPR_PTR;
            entry |= (fetch_phi[0] & FetchSprNum_M) << PHI1_SPR_NUM_B;
            break;
          case SprDma1(0):
            /* Sprite DMA1 (Phi1) + DMA2 (Phi2) */
            entry |= PHI1_SPR_DMA1;
            entry |= (fetch_phi[0] & FetchSprNum_M) << PHI1_SPR_NUM_B;
            break;
          case Refresh:
            /* Refresh (Phi1) */
            entry |= PHI1_REFRESH;
            break;
          case FetchG:
            /* FetchG (Phi1) */
            entry |= PHI1_FETCH_G;
            break;
          default:
            entry |= PHI1_IDLE;
            break;
        }
        /* FetchC (Phi2) */
        if ((fetch_phi[1] & FetchType_M) == FetchC) {
          entry |= PHI2_FETCH_C_M;
          entry |= VISIBLE_M;
        }
        /* extract xpos */
        entry |= ((xpos_phi[0] >> 3) << XPOS_B) & XPOS_M;

        /* Update VC/RC (Phi2) */
        if (f & UpdateVc) {
          entry |= UPDATE_VC_M;
        }
        if (f & UpdateRc) {
          entry |= UPDATE_RC_M;
        }

        /* Sprites */
        if (f & ChkSprExp) {
          entry |= CHECK_SPR_EXP_M;
        }
        if (f & ChkSprDisp) {
          entry |= CHECK_SPR_DISP;
        }
        if (f & ChkSprDma) {
          entry |= CHECK_SPR_DMA;
        }
        if (f & UpdateMcBase) {
          entry |= UPDATE_MCBASE;
        }
        if (f & ChkSprCrunch) {
          entry |= CHECK_SPR_CRUNCH;
        }

        /* Border */
        if (f & ChkBrdL0) {
          entry |= CHECK_BRD_L;
        }
        if (f & ChkBrdL1) {
          entry |= CHECK_BRD_L | CHECK_BRD_CSEL;
        }
        if (f & ChkBrdR0) {
          entry |= CHECK_BRD_R;
        }
        if (f & ChkBrdR1) {
          entry |= CHECK_BRD_R | CHECK_BRD_CSEL;
        }

        this._renderingTactTable[cycle - 1] = entry;
      }
    }
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

type Idle3fff = {
  cycle: number;
  value: number;
};
