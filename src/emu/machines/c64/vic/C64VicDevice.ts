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
  UpdateVc
} from "./constants";
import { SprDma1, SprPtr } from "./vic-models";
import { VicState } from "@common/messaging/EmuApi";

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

  // --- Current X position (between 0 and 503/0x1f7)
  currentXPosition: number;

  // --- VC: 10 bit counter (current video matrix position, between 0 and 999)
  videoMatrixCounter: number;

  // --- VCBASE: 10 bit data register with reset input that can be loaded with the value from VC
  videoCounterBase: number;

  // --- RC: 3 bit counter (row number within a character line, between 0 and 7)
  rowCounter: number;

  // --- The first and last DMA lines for display rendering
  firstDmaLine: number;
  lastDmaLine: number;

  // ----------------------------------------------------------------------------------------------
  // --- Memory Pointers ($D018)

  // --- Video matrix base address (VM13-VM10 bits from $D018, bits 13-10 of 16KB VIC address space)
  videoMatrixBase: number;

  // --- Character generator base address (CB13-CB11 bits from $D018, bits 13-11 of 16KB VIC address space)
  characterBase: number;

  // --- VIC bank base address (controlled by CIA2 Port A bits 4-5)
  // --- Each bank is 16KB, so bank 0=$0000, bank 1=$4000, bank 2=$8000, bank 3=$C000
  bankBaseAddress: number;

  // ----------------------------------------------------------------------------------------------
  // --- Interrupts ($D019, $D01A)

  // --- Interrupt latch register ($D019) - holds interrupt status bits
  interruptLatch: number;

  // --- Interrupt enable register ($D01A) - masks which interrupts can trigger IRQ
  interruptEnable: number;

  // ----------------------------------------------------------------------------------------------
  // --- Sprite Priority and Multicolor ($D01B, $D01C)
  // --- These properties are now stored individually in spriteData[index].priority and spriteData[index].multicolor

  // ----------------------------------------------------------------------------------------------
  // --- Colors ($D020-$D02E)

  // --- Border color register ($D020) - exterior color displayed outside the graphics area
  // --- Only bits 3-0 are used (4-bit color index), upper bits ignored
  // --- Values 0-15 correspond to the C64's 16-color palette
  borderColor: number;

  // --- Background color registers ($D021-$D024) - interior colors used in various graphics modes
  // --- Only bits 3-0 are used (4-bit color index), upper bits ignored
  // --- Values 0-15 correspond to the C64's 16-color palette
  backgroundColor0: number; // $D021 - Primary background color (used in all modes)
  backgroundColor1: number; // $D022 - Extended background color 1 (ECM/multicolor modes)
  backgroundColor2: number; // $D023 - Extended background color 2 (ECM/multicolor modes)
  backgroundColor3: number; // $D024 - Extended background color 3 (ECM mode only)

  // --- Sprite multicolor registers ($D025-$D026) - shared colors for all multicolor sprites
  // --- Only bits 3-0 are used (4-bit color index), upper bits ignored
  // --- Values 0-15 correspond to the C64's 16-color palette
  spriteMulticolor0: number; // $D025 - Sprite multicolor 0 (01 bit pattern in multicolor sprites)
  spriteMulticolor1: number; // $D026 - Sprite multicolor 1 (11 bit pattern in multicolor sprites)

  // ----------------------------------------------------------------------------------------------
  // --- Sprites

  // --- Sprite data array (for testing accessibility)
  // --- Each element contains information for the corresponding sprite (0-7)
  // --- Individual sprite colors are now stored in spriteData[index].color ($D027-$D02E)
  spriteData: SpriteInformation[];

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
    this.registers = new Uint8Array(0x40);
    for (let i = 0; i < this.registers.length; i++) {
      this.registers[i] = 0x00;
    }

    // --- Counters
    this.currentRasterLine = 0;
    this.currentCycle = 0;
    this.videoMatrixCounter = 0;
    this.videoCounterBase = 0;

    // --- Initialize memory pointers to their reset state (all 0)
    this.videoMatrixBase = 0; // VM13-VM10 = 0000 -> video matrix at $0000
    this.characterBase = 0; // CB13-CB11 = 000 -> character generator at $0000
    this.bankBaseAddress = 0x0000; // Bank 0 = $0000-$3FFF (CIA2 Port A bits 4-5 = 11 inverted = 00)

    // --- Initialize interrupt system to their reset state (all 0)
    this.interruptLatch = 0; // No interrupts pending
    this.interruptEnable = 0; // All interrupts disabled

    // --- Sprite priority and multicolor are now initialized in spriteData array initialization above

    // --- Initialize colors to reset state (all 0)
    this.borderColor = 0; // Border color = black (color index 0)
    this.backgroundColor0 = 0; // Background color 0 = black (color index 0)
    this.backgroundColor1 = 0; // Background color 1 = black (color index 0)
    this.backgroundColor2 = 0; // Background color 2 = black (color index 0)
    this.backgroundColor3 = 0; // Background color 3 = black (color index 0)
    this.spriteMulticolor0 = 0; // Sprite multicolor 0 = black (color index 0)
    this.spriteMulticolor1 = 0; // Sprite multicolor 1 = black (color index 0)

    // --- Initialize individual sprite colors are now initialized in spriteData array initialization above

    // --- Set up VIC registers to their value after a reset
    // Initialize $d011 bit fields to their reset state (all 0)
    this.rst8 = false;
    this.ecm = false;
    this.bmm = false;
    this.den = false;
    this.rsel = false;
    this.yScroll = 0;

    // Initialize $d016 bit fields to their reset state (all 0)
    this.mcm = false;
    this.csel = false;
    this.xScroll = 0;

    // Initialize sprite data to their reset state (all sprites disabled, X=0, Y=0, no expansion)
    this.spriteData = new Array(8).fill(null).map(() => ({
      enabled: false,
      x: 0,
      y: 0,
      yExpand: false,
      xExpand: false,
      color: 0, // Initialize sprite color to black (color index 0)
      multicolor: false, // Initialize to standard mode (not multicolor)
      priority: false // Initialize to sprite in front of background
    }));

    // --- Initialize DMA lines based on chip configuration (RSEL=0 initially)
    this.updateDmaLines(false);

    // --- Initialize composed raster interrupt line (RST8=0, $d012=0 initially)
    this.rasterInterruptLine = 0;

    this.initializeRenderingTactTableNew();
  }

  /**
   * Executes the current VIC rendering cycle based on the current clock.
   *
   * This method implements cycle-accurate VIC-II behavior based on extensive
   * documentation of the 6567/6569 VIC-II chip timing and operations.
   * Each cycle can perform different memory accesses and rendering operations.
   *
   * @returns True, if the CPU is stalled; otherwise, false.
   */
  renderCurrentTact(): boolean {
    // --- By default allow the CPU to access the bus
    let shouldStall = false;

    // --- Get the current rendering operation for this cycle
    const tact = this.renderingTactTable[this.currentCycle];
    this.currentXPosition = tact.xPosition;

    // --- The border unit may change its flip-flop state
    if (this.currentCycle === 63) {
      // --- Border rule 2: If the Y coordinate reaches the bottom comparison value in cycle 63,
      // --- the vertical border flip flop is set.
      const bottomComparisonValue = this.rsel ? 251 : 247;
      if (this.currentRasterLine === bottomComparisonValue) {
        this.verticalBorderFlipFlop = true;
      }
      // --- Border rule 3: If the Y coordinate reaches the top comparison value in cycle 63 and
      // --- the DEN bit in register $d011 is set, the vertical border flip flop is reset.
      const topComparisonValue = this.rsel ? 51 : 55;
      if (this.currentRasterLine === topComparisonValue && this.den) {
        this.verticalBorderFlipFlop = false;
      }
    }

    // --- The cycle may have border check operations (left or right border)
    tact.borderOperation?.();

    // --- Render the four pixels to be displayed during the PHI1 phase
    this.renderPixel();
    this.renderPixel();
    this.renderPixel();
    this.renderPixel();

    // === TIMING AND CYCLE MANAGEMENT ===
    // VIC-II timing: 6569 has 63 cycles per line, 6567 has 65 cycles per line
    // Current implementation uses tactsInDisplayLine cycles per line

    // ============================================================================
    // === PHI1/PHI2 CLOCK PHASE BARRIER ===
    // ============================================================================
    // PHI1 PHASE (First Half-Cycle): CPU may access the address bus
    // - CPU can perform memory operations and register accesses
    // - VIC performs internal state updates that don't require bus access
    //
    // PHI2 PHASE (Second Half-Cycle): Only VIC can access the address bus
    // - VIC performs all memory accesses (c-access, g-access, p-access, s-access, refresh)
    // - CPU is blocked from bus access during VIC memory operations
    // - BA (Bus Available) and AEC (Address Enable Control) signals coordinate this
    // ============================================================================

    // === MEMORY ACCESS OPERATIONS ===
    // The VIC-II performs different types of memory accesses each cycle:
    // - c-access: Read from video matrix and color RAM (12-bit address)
    // - g-access: Read graphics data from character generator or bitmap (8-bit data)
    // - p-access: Read sprite data pointers from video matrix (8-bit data)
    // - s-access: Read sprite pixel data (8-bit data)
    // - refresh: DRAM refresh cycles (5 per raster line)

    if (tact.fetchOperation) {
      // Execute the fetch operation using the function pointer
      // The fetchOperation function handles the specific type of memory access
      tact.fetchOperation(tact);

      // Only real memory accesses require CPU to wait, not idle operations
      // Idle fetches maintain timing but don't access the bus
      if (tact.fetchOperation !== this.FetchIdle) {
        shouldStall = true;
      }
    }

    // === BAD LINE DETECTION AND HANDLING ===
    // Bad Line Condition: RASTER >= $30 && RASTER <= $f7 && (RASTER & 7) == YSCROLL
    // Bad Lines trigger c-accesses and g-accesses in display state
    // Also require BA signal management for CPU bus access
    const isInDisplayWindow = this.currentRasterLine >= 0x30 && this.currentRasterLine <= 0xf7;
    const yscroll = this.registers[0x11] & 0x07; // YSCROLL from $d011
    const isBadLine = isInDisplayWindow && (this.currentRasterLine & 0x07) === yscroll;

    if (isBadLine && tact.mayFetchVideoMatrix) {
      // TODO: Set BA low 3 cycles before first c-access (cycle 12)
      // TODO: Enable c-accesses and g-accesses for this line (cycles 15-54)
      // TODO: Load VC from VCBASE in cycle 14
      // TODO: Handle display state vs idle state transitions

      // Bad Lines require extended CPU stalling during video matrix fetch
      shouldStall = true;
    }

    // === SPRITE PROCESSING ===
    // Sprite timing is critical and varies by sprite number and raster line
    // Each sprite requires p-access followed by s-accesses when visible

    if (tact.spriteOperation) {
      // Execute sprite-specific operation using the function pointer
      // Handles sprite visibility checking, Y expansion, data counters, etc.
      // TODO: Implement sprite visibility checking (MxE register)
      // TODO: Handle sprite Y expansion (MxYE bits) - affects visibility
      // TODO: Manage sprite data counters (MC0-MC7) - track sprite line
      // TODO: Load sprite data into shift registers for rendering
      // TODO: Check sprite Y coordinate against current raster line

      tact.spriteOperation(tact);

      // Sprite memory accesses also stall CPU
      shouldStall = true;
    }

    // === GRAPHICS SEQUENCER AND RENDERING ===
    // The graphics sequencer manages an 8-bit shift register
    // Shifted 1 bit per pixel, reloaded after each g-access
    // XSCROLL can delay reloading by 0-7 pixels

    // TODO: Shift graphics data register by 1 bit per pixel
    // TODO: Apply XSCROLL delay to graphics data loading
    // TODO: Handle different graphics modes:
    //   - Standard text (ECM/BMM/MCM = 0/0/0)
    //   - Multicolor text (ECM/BMM/MCM = 0/0/1)
    //   - Standard bitmap (ECM/BMM/MCM = 0/1/0)
    //   - Multicolor bitmap (ECM/BMM/MCM = 0/1/1)
    //   - ECM text (ECM/BMM/MCM = 1/0/0)
    //   - Invalid modes (remaining combinations)
    // TODO: Generate 8 pixels of output data for this cycle
    // TODO: Handle color resolution (1 bit/pixel vs 2 bits/pixel in MC mode)

    // === COUNTER AND STATE UPDATES ===
    if (tact.counterOperation) {
      // Execute counter operation using the function pointer
      // Handles Video Counter (VC), Row Counter (RC), and related state

      // Video Counter (VC): Points to current position in video matrix (10 bits)
      // Row Counter (RC): Tracks character row within 8-pixel character (3 bits)
      // Video Matrix Line Increment (VMLI): Backup of VC for next character row

      // TODO: Update VC after each g-access in display state
      // TODO: Update RC at end of each raster line (checked in cycle 58)
      // TODO: Handle VC reload from VCBASE in cycle 14 of Bad Lines
      // TODO: Manage VMLI for character row processing
      // TODO: Handle idle state detection (RC=7 in cycle 58)

      tact.counterOperation(tact);
    }

    // === BA SIGNAL MANAGEMENT ===
    // BA (Bus Available) signal controls CPU access to memory bus
    // Must go low 3 cycles before VIC needs bus access
    if (tact.checkFetchBA) {
      // TODO: Set BA low for upcoming c-access, g-access, or s-access
      // TODO: Coordinate with AEC (Address Enable Control) for proper timing
      // TODO: BA affects when CPU can access memory (extends instruction timing)

      // Check if BA should be set for sprite fetch operations
      if (tact.checkSpriteFetchBAMask !== 0) {
        // TODO: Check sprite visibility flags against mask
        // TODO: Set BA low if any sprites need fetch access
        shouldStall = true;
      }
    }

    // === INTERRUPT PROCESSING ===
    // Check for interrupt conditions specific to this cycle
    if (this.currentCycle === 0 || (this.currentRasterLine === 0 && this.currentCycle === 1)) {
      // Raster interrupt check occurs in cycle 0 of each line (cycle 1 for line 0)
      const rasterInterruptLine = this.registers[0x12] | ((this.registers[0x11] & 0x80) << 1);
      if (this.currentRasterLine === rasterInterruptLine) {
        // TODO: Trigger raster interrupt (set IRQ bit 0 in $d019)
        // TODO: Generate CPU interrupt if enabled in $d01a
      }
    }

    // TODO: Check for sprite-sprite collision during rendering
    //       Set MxM bits in $d01e and trigger interrupt if enabled
    // TODO: Check for sprite-background collision during rendering
    //       Set MxD bits in $d01f and trigger interrupt if enabled
    // TODO: Handle lightpen trigger if LP input goes low
    //       Latch X/Y position in $d013/$d014 and trigger interrupt

    // --- Render the four pixels to be displayed during the PHI2 phase
    this.renderPixel();
    this.renderPixel();
    this.renderPixel();

    // --- The border unit may check for changes
    tact.borderOperation?.();
    this.renderPixel();

    // === FINAL CYCLE MANAGEMENT ===
    // --- Move to the next cycle
    this.currentCycle++;
    if (this.currentCycle >= this.tactsInDisplayLine) {
      this.currentCycle = 0;
      this.currentRasterLine++;
      if (this.currentRasterLine >= this.rasterLines) {
        this.currentRasterLine = 0;
        // TODO: Reset refresh counter to $ff at start of frame
        // TODO: Handle frame-specific state resets
        // TODO: Clear lightpen trigger for next frame
      }
      this.registers[0x12] = this.currentRasterLine & 0xff;
      this.registers[0x11] = (this.registers[0x11] & 0x7f) | ((this.currentRasterLine >> 8) & 0x01);
      // TODO: Handle line-specific state updates (sprite counters, etc.)
    }

    return shouldStall;
  }

  /**
   * Sets the current VIC bank (0-3)
   * @param bank The VIC bank number
   */
  setBaseBank(bank: number): void {
    // Ensure valid bank number (0-3)
    bank = bank & 0x03;

    // Calculate the base address for the bank
    // Bank 0: $0000-$3FFF, Bank 1: $4000-$7FFF, Bank 2: $8000-$BFFF, Bank 3: $C000-$FFFF
    this.bankBaseAddress = bank * 0x4000;

    // TODO: Invalidate any cached address calculations that depend on the bank
    // TODO: Update sprite pointer base addresses (they are relative to current bank)
    // TODO: Update video matrix and character generator effective addresses
    // TODO: Notify any components that cache bank-relative addresses
    // TODO: Handle any pending DMA operations that might be affected by bank change
  }

  /**
   * Gets the current VIC bank base address
   * @returns The base address of the current VIC bank
   */
  getBaseBank(): number {
    return this.bankBaseAddress;
  }

  /**
   * Gets the flat memory value of the VIC-II registers
   */
  getFlatMemory(): Uint8Array {
    const flatMemory = new Uint8Array(0x400);
    for (let i = 0; i < 0x10; i++) {
      flatMemory.set(this.registers, i * 0x40);
    }
    return flatMemory;
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
        return this.currentRasterLine & 0xff;

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
        this.setSpriteXPositionLsb(regIndex, value);
        break;

      case 0x1: /* $D001: Sprite #0 Y position */
      case 0x3: /* $D003: Sprite #1 Y position */
      case 0x5: /* $D005: Sprite #2 Y position */
      case 0x7: /* $D007: Sprite #3 Y position */
      case 0x9: /* $D009: Sprite #4 Y position */
      case 0xb: /* $D00B: Sprite #5 Y position */
      case 0xd: /* $D00D: Sprite #6 Y position */
      case 0xf /* $D00F: Sprite #7 Y position */:
        this.setSpriteYPosition(regIndex, value);
        break;

      case 0x10 /* $D010: Sprite X position MSB */:
        this.setSpriteXPositionMsb(value);
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

      case 0x22 /* $D022: Background #1 color */:
        this.setRegD022Value(value);
        break;

      case 0x23 /* $D023: Background #2 color */:
        this.setRegD023Value(value);
        break;

      case 0x24 /* $D024: Background #3 color */:
        this.setRegD024Value(value);
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
        this.setSpriteColor(regIndex - 0x27, value); // Convert register index to sprite index (0-7)
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

  getVicState(): VicState {
    // Convert internal sprite data to VicState format
    const spriteInfo = this.spriteData.map((sprite) => ({
      x: sprite.x,
      y: sprite.y,
      enabled: sprite.enabled,
      multicolor: sprite.multicolor,
      color: sprite.color,
      xExpansion: sprite.xExpand,
      yExpansion: sprite.yExpand,
      foregroundPriority: !sprite.priority // VIC priority is inverted: true=behind, VicState wants foreground priority
    }));

    return {
      vicBaseAddress: this.bankBaseAddress,
      spriteInfo,
      rst8: this.rst8,
      ecm: this.ecm,
      bmm: this.bmm,
      den: this.den,
      rsel: this.rsel,
      xScroll: this.xScroll,
      yScroll: this.yScroll,
      raster: this.currentRasterLine,
      lpx: this.registers[0x13], // Light pen X from register $D013
      lpy: this.registers[0x14], // Light pen Y from register $D014
      res: false, // RES bit is unused in VIC-II
      mcm: this.mcm,
      csel: this.csel,
      scrMemOffset: this.videoMatrixBase,
      colMemOffset: 0xd800 - this.bankBaseAddress, // Color RAM is always at $D800 regardless of VIC bank
      irqStatus: !!(this.interruptLatch & 0x80), // IRQ bit from interrupt latch register
      ilpStatus: !!(this.interruptLatch & 0x08), // ILP (Light Pen) interrupt status
      ilpEnabled: !!(this.interruptEnable & 0x08), // ILP interrupt enabled
      immcStatus: !!(this.interruptLatch & 0x04), // IMMC (Sprite-Sprite Collision) interrupt status
      immcEnabled: !!(this.interruptEnable & 0x04), // IMMC interrupt enabled
      imbcStatus: !!(this.interruptLatch & 0x02), // IMBC (Sprite-Background Collision) interrupt status
      imbcEnabled: !!(this.interruptEnable & 0x02), // IMBC interrupt enabled
      irstStatus: !!(this.interruptLatch & 0x01), // IRST (Raster) interrupt status
      irstEnabled: !!(this.interruptEnable & 0x01), // IRST interrupt enabled
      borderColor: this.borderColor,
      bgColor0: this.backgroundColor0,
      bgColor1: this.backgroundColor1,
      bgColor2: this.backgroundColor2,
      bgColor3: this.backgroundColor3,
      spriteMcolor0: this.spriteMulticolor0,
      spriteMcolor1: this.spriteMulticolor1,
      spriteSpriteCollision: this.registers[0x1e], // Sprite-Sprite collision register $D01E
      spriteDataCollision: this.registers[0x1f] // Sprite-Data collision register $D01F
    };
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
          tactInfo.borderOperation = this.CheckLeftBorder;
        }
        if (f & ChkBrdL1) {
          tactInfo.borderOperation = this.CheckLeftBorder;
        }
        if (f & ChkBrdR0) {
          tactInfo.borderOperation = this.CheckRightBorder;
        }
        if (f & ChkBrdR1) {
          tactInfo.borderOperation = this.CheckRightBorder;
        }

        // --- This tact is processed
        this.renderingTactTable[cycle - 1] = tactInfo;
      }
    }
  }

  // ----------------------------------------------------------------------------------------------
  // Sprite X coordinate registers ($D000, $D002, $D004, $D006, $D008, $D00A, $D00C, $D00E)

  // --- Set VIC Register $D000, $D002, $D004, $D006, $D008, $D00A, $D00C, $D00E (Sprite X position LSB)
  // --- As per VIC-II doc section 3.2: Registers, section 3.8: Sprites
  // --- Cross-register dependency: Combined with $d010 MSB bits to form 9-bit X coordinate
  private setSpriteXPositionLsb(regIndex: number, value: number): void {
    // --- STEP 1: Extract sprite index from register index
    const spriteIndex = regIndex >> 1; // Register indices 0,2,4,6,8,A,C,E map to sprites 0-7

    // --- STEP 2: Extract new LSB value
    const newXLsb = value & 0xff;

    // --- STEP 3: Get current MSB from sprite data and combine to form 9-bit X coordinate
    const currentMsb = this.spriteData[spriteIndex].x & 0x100 ? 1 : 0;
    const newX = (currentMsb << 8) | newXLsb;

    // --- STEP 4: Detect changes and handle effects
    if (this.spriteData[spriteIndex].x !== newX) {
      // --- Sprite X coordinate has changed
      // --- As per VIC-II doc section 3.8: Sprites, sprite positioning
      // --- IMMEDIATE EFFECTS (same cycle):
      // - Sprite positioning: New X coordinate affects where sprite pixels are drawn
      // - Collision detection: Updated position affects sprite-sprite and sprite-background collisions
      // - Screen boundaries: Sprite visibility affected by screen edge clipping
      // - Horizontal scrolling: Interaction with XSCROLL from $d016 for fine positioning
      // --- CONDITIONAL EFFECTS (depends on current state):
      // - Sprite enable: Only affects display if sprite is enabled via $d015
      // - Sprite DMA: May affect sprite data fetch timing if position changes during critical cycles
      // - Multicolor mode: Affects pixel positioning in both standard and multicolor modes
      // - X expansion: Actual pixel width affected by expansion setting from $d01d
      // --- TIMING-CRITICAL considerations:
      // - Same-line changes: X coordinate changes on current raster line affect immediate display
      // - DMA cycles: Changes during sprite DMA cycles may cause display artifacts
      // - Border collision: Changes near screen borders may affect sprite visibility
      // TODO: Get current cycle within raster line (0-62 for PAL, 0-64 for NTSC)
      // TODO: Get current raster line number
      // TODO: Check if sprite position change affects current line rendering
      // TODO: Handle sprite collision detection updates
      // TODO: Update sprite visibility calculations based on screen boundaries
    }

    // --- STEP 5: Update internal state
    this.spriteData[spriteIndex].x = newX;
    this.registers[regIndex] = value & 0xff;

    // --- Register handling complete - sprite X position updated according to VIC-II documentation
  }

  // ----------------------------------------------------------------------------------------------
  // Sprite X coordinate MSB register ($D010)

  // --- Set VIC Register $D010 (Sprite X position MSBs)
  // --- As per VIC-II doc section 3.2: Registers, section 3.8: Sprites
  // --- Cross-register dependency: Combined with $d000-$d00e LSB values to form 9-bit X coordinates
  private setSpriteXPositionMsb(value: number): void {
    // --- STEP 1: Extract MSB bits for all 8 sprites
    const newMsbBits = [
      !!(value & 0x01), // Sprite 0 MSB (bit 0)
      !!(value & 0x02), // Sprite 1 MSB (bit 1)
      !!(value & 0x04), // Sprite 2 MSB (bit 2)
      !!(value & 0x08), // Sprite 3 MSB (bit 3)
      !!(value & 0x10), // Sprite 4 MSB (bit 4)
      !!(value & 0x20), // Sprite 5 MSB (bit 5)
      !!(value & 0x40), // Sprite 6 MSB (bit 6)
      !!(value & 0x80) // Sprite 7 MSB (bit 7)
    ];

    // --- STEP 2: Update X coordinates for all sprites by combining MSB with existing LSB
    for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
      const currentLsb = this.spriteData[spriteIndex].x & 0xff;
      const newMsb = newMsbBits[spriteIndex] ? 1 : 0;
      const newX = (newMsb << 8) | currentLsb;

      // --- STEP 3: Detect changes and handle effects for each sprite
      if (this.spriteData[spriteIndex].x !== newX) {
        // --- Sprite X coordinate MSB has changed for this sprite
        // --- As per VIC-II doc section 3.8: Sprites, sprite positioning
        // --- IMMEDIATE EFFECTS (same cycle):
        // - Extended positioning: Allows sprite positioning beyond 255 pixels (up to 511)
        // - Screen wrapping: Sprites can be positioned in extended horizontal area
        // - Border effects: MSB change may move sprite into/out of visible screen area
        // --- CONDITIONAL EFFECTS (depends on current state):
        // - Visibility: Sprite may become visible/invisible based on screen boundaries
        // - Collision detection: Position change affects collision calculations
        // - DMA timing: May affect sprite data fetch cycles if position change is significant
        // --- DISPLAY CHANGES:
        // - Horizontal movement: Large jumps (256 pixel increments) when MSB changes
        // - Screen boundaries: Sprite may appear/disappear at screen edges
        // - Positioning accuracy: Enables precise sprite placement across full screen width
        // TODO: Handle immediate sprite positioning effects for current raster line
        // TODO: Update collision detection for affected sprites
        // TODO: Check screen boundary interactions
      }

      // --- STEP 4: Update internal state
      this.spriteData[spriteIndex].x = newX;
    }

    this.registers[0x10] = value & 0xff;

    // --- Register handling complete - all sprite X MSBs updated according to VIC-II documentation
  }

  // ----------------------------------------------------------------------------------------------
  // Sprite Y coordinate registers ($D001, $D003, $D005, $D007, $D009, $D00B, $D00D, $D00F)

  // --- Set VIC Register $D001, $D003, $D005, $D007, $D009, $D00B, $D00D, $D00F (Sprite Y position)
  // --- As per VIC-II doc section 3.2: Registers, section 3.8: Sprites
  // --- Unlike X coordinates, Y coordinates are only 8-bit (0-255)
  private setSpriteYPosition(regIndex: number, value: number): void {
    // --- STEP 1: Extract sprite index from register index
    const spriteIndex = (regIndex - 1) >> 1; // Register indices 1,3,5,7,9,B,D,F map to sprites 0-7

    // --- STEP 2: Extract new Y coordinate value (8-bit, 0-255)
    const newY = value & 0xff;

    // --- STEP 3: Detect changes and handle effects
    if (this.spriteData[spriteIndex].y !== newY) {
      // --- Sprite Y coordinate has changed
      // --- As per VIC-II doc section 3.8: Sprites, sprite positioning
      // --- IMMEDIATE EFFECTS (same cycle):
      // - Sprite positioning: New Y coordinate affects where sprite pixels are drawn
      // - Collision detection: Updated position affects sprite-sprite and sprite-background collisions
      // - Screen boundaries: Sprite visibility affected by top/bottom screen edges
      // - Vertical scrolling: Interaction with YSCROLL from $d011 for fine positioning
      // - Raster line timing: May affect when sprite DMA occurs if sprite moves across DMA lines
      // --- CONDITIONAL EFFECTS (depends on current state):
      // - Sprite enable: Only affects display if sprite is enabled via $d015
      // - Sprite DMA: Y position determines when sprite data fetch occurs (sprites active on raster lines Y to Y+20)
      // - Bad line interaction: Sprite DMA may interfere with character DMA on bad lines
      // - Y expansion: Actual pixel height affected by expansion setting from $d017
      // --- TIMING-CRITICAL considerations:
      // - Same-line changes: Y coordinate changes on current raster line affect immediate display
      // - DMA window: Sprites are active for 21 raster lines (Y to Y+20), affecting memory bandwidth
      // - Sprite crunch: Multiple sprites on same line can cause sprite multiplexing effects
      // - Border collision: Changes near screen borders may affect sprite visibility
      // TODO: Get current raster line number
      // TODO: Check if sprite Y position change affects current line rendering
      // TODO: Handle sprite DMA timing changes if Y position moves into/out of DMA window
      // TODO: Update sprite collision detection calculations
      // TODO: Update sprite visibility calculations based on screen boundaries
      // TODO: Handle sprite crunch conditions if multiple sprites share raster lines
    }

    // --- STEP 4: Update internal state
    this.spriteData[spriteIndex].y = newY;
    this.registers[regIndex] = value & 0xff;

    // --- Register handling complete - sprite Y position updated according to VIC-II documentation
  }

  // ----------------------------------------------------------------------------------------------
  // Register $D011 (Control Register 1)

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
  rasterInterruptLine: number;

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

  // ----------------------------------------------------------------------------------------------
  // Register $D015 (Sprite Enable)

  // --- Set VIC Register $D015 (Sprite Enable)
  // --- As per VIC-II doc section 3.2: Registers, section 3.8: Sprites
  // --- Each bit controls visibility of corresponding sprite (0=hidden, 1=visible)
  private setRegD015Value(value: number) {
    // --- STEP 1: Extract new sprite enable values from register bits
    const newSpriteEnable = [
      !!(value & 0x01), // Sprite 0 enable (bit 0)
      !!(value & 0x02), // Sprite 1 enable (bit 1)
      !!(value & 0x04), // Sprite 2 enable (bit 2)
      !!(value & 0x08), // Sprite 3 enable (bit 3)
      !!(value & 0x10), // Sprite 4 enable (bit 4)
      !!(value & 0x20), // Sprite 5 enable (bit 5)
      !!(value & 0x40), // Sprite 6 enable (bit 6)
      !!(value & 0x80) // Sprite 7 enable (bit 7)
    ];

    // --- STEP 2: Detect changes for each sprite and handle effects
    for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
      if (this.spriteData[spriteIndex].enabled !== newSpriteEnable[spriteIndex]) {
        // --- Sprite enable state has changed
        if (newSpriteEnable[spriteIndex]) {
          // --- Sprite changes from disabled to enabled (0 to 1)
          // --- IMMEDIATE EFFECTS (same cycle):
          // - Sprite becomes visible on display if within screen boundaries
          // - Sprite DMA: May trigger sprite data fetches on current or next raster line
          // - Collision detection: Sprite participates in sprite-sprite and sprite-background collision detection
          // - Priority handling: Sprite participates in sprite-background priority comparisons
          // --- CONDITIONAL EFFECTS (depends on current state):
          // - Sprite positioning: Uses current X/Y coordinates from $d000-$d00f and $d010 MSB
          // - Sprite data: Uses sprite pointer from $07f8-$07ff (or current VIC bank equivalent)
          // - Sprite expansion: Affected by Y expansion ($d017) and X expansion ($d01d) settings
          // - Sprite colors: Uses individual sprite color ($d027-$d02e) and shared multicolor ($d025-$d026)
          // --- DISPLAY CHANGES:
          // - Immediate visibility: Sprite appears on screen starting from next pixel if conditions are met
          // - DMA scheduling: VIC may schedule sprite data reading for upcoming raster lines
          // - Performance impact: Additional memory accesses for sprite data, pointers, and rendering
        } else {
          // --- Sprite changes from enabled to disabled (1 to 0)
          // --- IMMEDIATE EFFECTS (same cycle):
          // - Sprite becomes invisible on display
          // - Sprite DMA: No more sprite data fetches for this sprite
          // - Collision detection: Sprite no longer participates in collision detection
          // - Priority handling: Sprite no longer affects sprite-background priority
          // --- CONDITIONAL EFFECTS (depends on current state):
          // - Ongoing rendering: If sprite is currently being drawn, it stops immediately
          // - Memory bandwidth: Freed sprite DMA slots can be used for other VIC operations
          // - Interrupt flags: Existing collision flags remain set until explicitly cleared
          // --- DISPLAY CHANGES:
          // - Immediate hiding: Sprite disappears from screen immediately
          // - Performance improvement: Reduced memory accesses and rendering overhead
          // - Background restoration: Background pixels become visible where sprite was displayed
        }
      }
    }

    // --- STEP 3: Handle timing-critical effects (sprite enable changes can affect current line)
    // --- As per VIC-II doc section 3.8: Sprites, sprite DMA timing considerations

    // TODO: Get current cycle within raster line (0-62 for PAL, 0-64 for NTSC)
    // TODO: Get current raster line number
    // TODO: Check if any sprite enable changes affect sprite DMA for current raster line
    // TODO: Update sprite DMA schedule if sprites are enabled/disabled during critical timing windows

    // --- Sprite DMA considerations:
    // - Sprite data fetch timing: Sprites enabled during specific cycles may affect DMA timing
    // - Bad Line interaction: Sprite DMA competes with character/bitmap data DMA on Bad Lines
    // - Horizontal positioning: Late enable/disable may cause partial sprite display effects

    // --- STEP 4: Update internal state
    for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
      this.spriteData[spriteIndex].enabled = newSpriteEnable[spriteIndex];
    }
    this.registers[0x15] = value & 0xff;

    // --- Register handling complete - sprite visibility updated according to VIC-II documentation
  }

  // ----------------------------------------------------------------------------------------------
  // Register $D016 (Control Register 2)

  mcm: boolean;
  csel: boolean;
  xScroll: number;

  // --- Set VIC Register $D016 (Control Register 2)
  // --- As per VIC-II doc section 3.2: Registers, section 3.7: Graphics modes, section 3.9: Border units
  // --- Cross-register dependencies: Interacts with $d011 (ECM, BMM bits for graphics modes),
  // --- border timing affected by left/right border positions
  private setRegD016Value(value: number) {
    // --- STEP 1: Extract new values from register bits
    // Bit 5 (RES) has no function on VIC 6567/6569, ignore it
    const newMcm = !!(value & 0x10); // Bit 4: MCM - Multicolor Mode
    const newCsel = !!(value & 0x08); // Bit 3: CSEL - Column select (40/38 columns)
    const newXScroll = value & 0x07; // Bits 2-0: XSCROLL - Horizontal fine scroll

    // --- STEP 2: Detect changes for each bit/field and handle effects

    if (this.mcm !== newMcm) {
      // --- MCM (Multicolor Mode) has changed
      // --- As per VIC-II doc section 3.7.3: Graphics modes
      // --- Cross-register dependency: Combined with ECM and BMM bits from $d011 determines graphics mode
      if (newMcm) {
        // --- MCM changes from 0 to 1 (Setting Multicolor Mode)
        // --- IMMEDIATE EFFECTS (same cycle):
        // - Graphics mode: Changes interpretation of character/bitmap data
        // - Color resolution: Reduces horizontal color resolution but adds more color options
        // - Pixel interpretation: 2 pixels per color information instead of 1
        // --- DISPLAY CHANGES:
        // - Character mode: Background + 3 character colors available per character
        // - Bitmap mode: Background + 3 bitmap colors available per 8x8 cell
        // - Invalid modes: Screen goes black if invalid mode combination (ECM=1, BMM=1, MCM=1)
      } else {
        // --- MCM changes from 1 to 0 (Clearing Multicolor Mode)
        // --- IMMEDIATE EFFECTS (same cycle):
        // - Return to standard color interpretation
        // - Full horizontal resolution restored
        // - Standard 2-color per character/cell mode
      }
    }

    if (this.csel !== newCsel) {
      // --- CSEL (Column Select) has changed
      // --- As per VIC-II doc section 3.9: Border units, section 3.7.1: Display window
      if (newCsel) {
        // --- CSEL changes from 0 to 1 (40 column mode)
        // --- IMMEDIATE EFFECTS (same cycle):
        // - Display window: Expanded horizontally by 7 pixels on each side (14 total)
        // - Border timing: Left border at cycle 24, right border at cycle 56
        // - Character display: 40 characters per line displayed
        // - Scrolling: XSCROLL affects timing of border detection
      } else {
        // --- CSEL changes from 1 to 0 (38 column mode)
        // --- IMMEDIATE EFFECTS (same cycle):
        // - Display window: Reduced horizontally by 7 pixels on each side
        // - Border timing: Left border at cycle 31, right border at cycle 51
        // - Character display: 38 characters per line displayed
        // - Scrolling: XSCROLL affects timing of border detection differently
      }

      // --- TIMING-CRITICAL considerations:
      // - Same-line changes: CSEL changes on current raster line affect immediate border rendering
      // - Border state: May immediately trigger border on/off state changes
      // - DMA timing: Character fetch timing may be affected by border state changes

      // TODO: Get current cycle within raster line
      // TODO: Check if CSEL change affects current line border state
      // TODO: Update border detection timing for current line
      // TODO: Handle immediate border state changes if change occurs during critical cycles
    }

    if (this.xScroll !== newXScroll) {
      if (newXScroll < this.xScroll) {
        if (this.currentCycle < 56) {
        }
      } else {
      }

      // --- XSCROLL (Horizontal Fine Scroll) has changed
      // --- As per VIC-II doc section 3.7.4: Scrolling, section 3.9: Border units
      // --- IMMEDIATE EFFECTS (same cycle):
      // - Pixel display: Shifts character/bitmap data horizontally by 0-7 pixels
      // - Border timing: Affects when left/right borders are activated
      // - Character fetching: May affect timing of character data fetch relative to display
      // - Sprite positioning: Provides fine positioning reference for sprite horizontal placement

      // --- CONDITIONAL EFFECTS (depends on current state):
      // - CSEL interaction: Combined with CSEL determines exact border timing
      // - Bad line interaction: May affect character fetch timing on bad lines
      // - Display state: Only affects display when in display state, ignored in idle state

      // --- TIMING-CRITICAL considerations:
      // - Same-line changes: XSCROLL changes affect immediate pixel alignment on current line
      // - Border critical: Changes during border comparison cycles may affect border state
      // - DMA critical: Changes during character DMA may affect fetch timing

      // TODO: Get current cycle within raster line
      // TODO: Check if XSCROLL change affects current line rendering
      // TODO: Update pixel shift for immediate display effects
      // TODO: Handle border timing changes based on new XSCROLL value
      // TODO: Update character fetch timing if change occurs during DMA cycles
    }

    // --- STEP 3: Update internal state
    this.mcm = newMcm;
    this.csel = newCsel;
    this.xScroll = newXScroll;
    this.registers[0x16] = value & 0xff;

    // --- Register handling complete - control register 2 updated according to VIC-II documentation
  }

  // ----------------------------------------------------------------------------------------------
  // Register $D017 (Sprite Y Expansion)

  // --- Set VIC Register $D017 (Sprite Y Expansion)
  // --- As per VIC-II doc section 3.2: Registers, section 3.8: Sprites, section 3.14.7: Sprite stretching
  // --- Each bit controls Y expansion (height doubling) of corresponding sprite
  private setRegD017Value(value: number) {
    // --- STEP 1: Extract new sprite Y expansion values from register bits
    const newSpriteYExpand = [
      !!(value & 0x01), // Sprite 0 Y expansion (bit 0)
      !!(value & 0x02), // Sprite 1 Y expansion (bit 1)
      !!(value & 0x04), // Sprite 2 Y expansion (bit 2)
      !!(value & 0x08), // Sprite 3 Y expansion (bit 3)
      !!(value & 0x10), // Sprite 4 Y expansion (bit 4)
      !!(value & 0x20), // Sprite 5 Y expansion (bit 5)
      !!(value & 0x40), // Sprite 6 Y expansion (bit 6)
      !!(value & 0x80) // Sprite 7 Y expansion (bit 7)
    ];

    // --- STEP 2: Detect changes for each sprite and handle effects
    for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
      if (this.spriteData[spriteIndex].yExpand !== newSpriteYExpand[spriteIndex]) {
        // --- Sprite Y expansion has changed
        // --- As per VIC-II doc section 3.8: Sprites, section 3.14.7: Sprite stretching

        if (newSpriteYExpand[spriteIndex]) {
          // --- Y expansion changes from 0 to 1 (Enabling Y expansion)
          // --- IMMEDIATE EFFECTS (same cycle):
          // - Sprite height: Doubled from 21 to 42 pixels
          // - Pixel duplication: Each sprite line displayed twice vertically
          // - DMA timing: Sprite remains active for same number of raster lines (21)
          // - Screen coverage: Sprite covers more vertical screen area
          // --- CONDITIONAL EFFECTS (depends on current state):
          // - Sprite enable: Only affects display if sprite is enabled via $d015
          // - Collision detection: Expanded sprite area affects collision calculations
          // - Screen boundaries: May cause sprite to extend beyond visible area
          // - Y coordinate interaction: Same Y position but doubled visual height
          // --- TIMING-CRITICAL considerations:
          // - Same-line changes: Y expansion changes affect immediate sprite rendering
          // - DMA cycles: Expansion doesn't change DMA timing, only display scaling
          // - Sprite crunch: May affect sprite multiplexing on heavily loaded raster lines
        } else {
          // --- Y expansion changes from 1 to 0 (Disabling Y expansion)
          // --- IMMEDIATE EFFECTS (same cycle):
          // - Sprite height: Returns to normal 21 pixels
          // - Pixel display: Each sprite line displayed once (normal)
          // - Screen coverage: Reduced vertical screen area
          // --- CONDITIONAL EFFECTS (depends on current state):
          // - Collision detection: Reduced sprite area affects collision calculations
          // - Screen positioning: Same Y coordinate but halved visual height
        }

        // --- DISPLAY CHANGES:
        // - Vertical scaling: Sprite pixels stretched/compressed vertically
        // - Aspect ratio: Sprite aspect ratio changes (width remains same, height doubles/halves)
        // - Border interaction: May affect sprite visibility at top/bottom screen edges
        // - Overlap effects: Changes in sprite overlap areas for collision detection

        // TODO: Get current raster line number
        // TODO: Check if sprite Y expansion change affects current line rendering
        // TODO: Update sprite collision detection for new expansion state
        // TODO: Handle sprite visibility changes due to expansion at screen edges
        // TODO: Update sprite DMA calculations if expansion affects timing
      }

      // --- STEP 3: Update internal state for this sprite
      this.spriteData[spriteIndex].yExpand = newSpriteYExpand[spriteIndex];
    }

    // --- STEP 4: Update register value
    this.registers[0x17] = value & 0xff;

    // --- Register handling complete - sprite Y expansion updated according to VIC-II documentation
  }

  // ----------------------------------------------------------------------------------------------
  // Register $D018 (Memory Pointers)

  // --- Set VIC Register $D018 (Memory Pointers)
  // --- As per VIC-II doc section 3.2: Registers, section 3.7: Video matrix and character generator
  // --- Controls memory locations for video matrix and character generator within 16KB VIC address space
  private setRegD018Value(value: number) {
    // --- STEP 1: Extract new memory pointer values from register bits
    const newVideoMatrixBase = (value & 0xf0) << 6; // VM13-VM10 (bits 7-4) shifted to bits 13-10
    const newCharacterBase = (value & 0x0e) << 10; // CB13-CB11 (bits 3-1) shifted to bits 13-11

    // --- STEP 2: Detect changes and handle effects
    if (this.videoMatrixBase !== newVideoMatrixBase) {
      // --- Video matrix base address has changed
      // --- As per VIC-II doc section 3.7.3: Text modes, section 3.7.4: Bitmap modes
      // --- IMMEDIATE EFFECTS (same cycle):
      // - Video matrix location: Changes location of 40x25 character matrix (1000 bytes)
      // - Address range: Video matrix moves in 1KB steps within 16KB VIC address space
      // - Character codes: Location where VIC reads character codes for text display
      // - Color information: Associated color data location (Color RAM remains fixed)
      // --- CONDITIONAL EFFECTS (depends on current state):
      // - Text modes: Affects character code reading for all text-based display modes
      // - Bitmap modes: Video matrix still used for color information in bitmap modes
      // - DMA timing: Video matrix accesses occur during specific cycles
      // - Display timing: Changes take effect immediately for next screen refresh
      // --- TIMING-CRITICAL considerations:
      // - Same-line changes: Video matrix address changes affect immediate character data access
      // - Character generation: Combined with character base for complete character lookup
      // - Memory conflicts: May create badlines if video matrix conflicts with CPU access
      // TODO: Invalidate video matrix buffer if cached
      // TODO: Update DMA address calculations for video matrix accesses
      // TODO: Handle potential memory banking conflicts with new address
    }

    if (this.characterBase !== newCharacterBase) {
      // --- Character generator base address has changed
      // --- As per VIC-II doc section 3.7.3: Text modes, section 3.7.4: Bitmap modes
      // --- IMMEDIATE EFFECTS (same cycle):
      // - Character generator location: Changes location of character pixel data
      // - Address range: Character generator moves in 2KB steps within 16KB VIC address space
      // - Bitmap mode: In bitmap mode, CB13 bit selects 8KB bitmap location
      // - Character pixel data: Location where VIC reads 8x8 pixel patterns
      // --- CONDITIONAL EFFECTS (depends on current state):
      // - Text modes: Affects character pixel pattern reading for text display
      // - Bitmap modes: CB13 bit selects between two 8KB bitmap areas
      // - Character ROM: Can redirect from Character ROM to RAM-based character sets
      // - Custom fonts: Enables use of user-defined character sets
      // --- DISPLAY CHANGES:
      // - Font appearance: Different character generator changes displayed font
      // - Bitmap graphics: In bitmap mode, changes which bitmap area is displayed
      // - Character images: 8x8 pixel patterns for each of 256 possible characters
      // TODO: Invalidate character generator cache if cached
      // TODO: Update character generation address calculations
      // TODO: Handle Character ROM vs RAM selection based on address
      // TODO: Update bitmap mode address calculations if in bitmap mode
    }

    // --- STEP 3: Update internal state
    this.videoMatrixBase = newVideoMatrixBase;
    this.characterBase = newCharacterBase;

    // --- STEP 4: Update register value
    this.registers[0x18] = value & 0xfe; // Bit 0 is unused and always reads as 0

    // --- Register handling complete - memory pointers updated according to VIC-II documentation
  }

  // ----------------------------------------------------------------------------------------------
  // Register $D019 (Interrupt Register/Latch)

  // --- Set VIC Register $D019 (Interrupt Register/Latch)
  // --- As per VIC-II doc section 3.12: VIC interrupts
  // --- Writing 1 to a bit clears the corresponding interrupt latch bit
  private setRegD019Value(value: number) {
    // --- STEP 1: Extract interrupt clear bits from write value
    const clearRaster = !!(value & 0x01); // IRST bit (bit 0) - Raster interrupt
    const clearSpriteBackground = !!(value & 0x02); // IMBC bit (bit 1) - Sprite-background collision
    const clearSpriteSprite = !!(value & 0x04); // IMMC bit (bit 2) - Sprite-sprite collision
    const clearLightpen = !!(value & 0x08); // ILP bit (bit 3) - Light pen interrupt

    // --- STEP 2: Clear interrupt latch bits (writing 1 clears the bit)
    // --- As per VIC-II doc: "To clear it, the processor has to write a '1' there 'by hand'"
    if (clearRaster) {
      this.interruptLatch &= ~0x01; // Clear IRST bit
    }
    if (clearSpriteBackground) {
      this.interruptLatch &= ~0x02; // Clear IMBC bit
    }
    if (clearSpriteSprite) {
      this.interruptLatch &= ~0x04; // Clear IMMC bit
    }
    if (clearLightpen) {
      this.interruptLatch &= ~0x08; // Clear ILP bit
    }

    // --- STEP 3: Update IRQ line status (bit 7 reflects IRQ state)
    // --- As per VIC-II doc: "If at least one latch bit and the belonging bit in the enable register is set,
    // --- the IRQ line is held low and so the interrupt is triggered"
    const activeInterrupts = this.interruptLatch & this.interruptEnable & 0x0f;
    const irqActive = activeInterrupts !== 0;

    if (irqActive) {
      this.interruptLatch |= 0x80; // Set IRQ bit (bit 7)
    } else {
      this.interruptLatch &= ~0x80; // Clear IRQ bit (bit 7)
    }

    // --- STEP 4: Update register value (read-only, reflects current latch state)
    // --- Upper 4 bits (7-4) are: IRQ, unused, unused, unused
    // --- Lower 4 bits (3-0) are: ILP, IMMC, IMBC, IRST
    this.registers[0x19] = this.interruptLatch & 0x8f; // IRQ + interrupt bits, unused bits read as 0

    // --- IRQ OUTPUT HANDLING:
    // TODO: Signal CPU interrupt controller if IRQ state changed
    // TODO: Assert/deassert IRQ line to 6510 processor
    // TODO: Update interrupt timing for accurate emulation

    // --- Register handling complete - interrupt latch updated according to VIC-II documentation
  }

  // ----------------------------------------------------------------------------------------------
  // Register $D01A (Interrupt Enable)

  // --- Set VIC Register $D01A (Interrupt Enable)
  // --- As per VIC-II doc section 3.12: VIC interrupts
  // --- Controls which interrupt sources can trigger IRQ line
  private setRegD01AValue(value: number) {
    // --- STEP 1: Extract interrupt enable bits from register value
    const enableRaster = !!(value & 0x01); // ERST bit (bit 0) - Raster interrupt enable
    const enableSpriteBackground = !!(value & 0x02); // EMBC bit (bit 1) - Sprite-background collision enable
    const enableSpriteSprite = !!(value & 0x04); // EMMC bit (bit 2) - Sprite-sprite collision enable
    const enableLightpen = !!(value & 0x08); // ELP bit (bit 3) - Light pen interrupt enable

    // --- STEP 2: Detect changes and handle effects
    const previousEnable = this.interruptEnable;
    const newEnable = value & 0x0f; // Only bits 3-0 are used

    if (previousEnable !== newEnable) {
      // --- Interrupt enable mask has changed
      // --- As per VIC-II doc: "The four interrupt sources can be independently enabled and disabled with the enable bits"

      // --- IMMEDIATE EFFECTS (same cycle):
      // - IRQ masking: Changes which pending interrupts can trigger IRQ line
      // - IRQ line update: May immediately change IRQ line state
      // - Processor impact: May trigger or clear interrupt request to CPU

      // --- CONDITIONAL EFFECTS (depends on current state):
      if (enableRaster && !(previousEnable & 0x01)) {
        // --- Raster interrupt enabled: If raster interrupt is pending, may trigger IRQ
      }
      if (enableSpriteBackground && !(previousEnable & 0x02)) {
        // --- Sprite-background collision interrupt enabled: If collision pending, may trigger IRQ
      }
      if (enableSpriteSprite && !(previousEnable & 0x04)) {
        // --- Sprite-sprite collision interrupt enabled: If collision pending, may trigger IRQ
      }
      if (enableLightpen && !(previousEnable & 0x08)) {
        // --- Light pen interrupt enabled: If light pen event pending, may trigger IRQ
      }

      // --- DISABLE EFFECTS:
      if (!enableRaster && previousEnable & 0x01) {
        // --- Raster interrupt disabled: IRQ may be cleared if this was the only active interrupt
      }
      if (!enableSpriteBackground && previousEnable & 0x02) {
        // --- Sprite-background collision interrupt disabled
      }
      if (!enableSpriteSprite && previousEnable & 0x04) {
        // --- Sprite-sprite collision interrupt disabled
      }
      if (!enableLightpen && previousEnable & 0x08) {
        // --- Light pen interrupt disabled
      }

      // TODO: Handle interrupt priority if multiple interrupts enabled simultaneously
      // TODO: Update interrupt service timing for accurate emulation
    }

    // --- STEP 3: Update internal state
    this.interruptEnable = newEnable;

    // --- STEP 4: Update IRQ line status based on new enable mask
    // --- As per VIC-II doc: IRQ triggered when "(latch bit AND enable bit) is set"
    const activeInterrupts = this.interruptLatch & this.interruptEnable & 0x0f;
    const irqActive = activeInterrupts !== 0;

    if (irqActive) {
      this.interruptLatch |= 0x80; // Set IRQ bit (bit 7) in latch register
    } else {
      this.interruptLatch &= ~0x80; // Clear IRQ bit (bit 7) in latch register
    }

    // --- STEP 5: Update register values
    this.registers[0x1a] = newEnable; // Only lower 4 bits are valid, upper 4 bits read as 0
    this.registers[0x19] = this.interruptLatch & 0x8f; // Update $d019 to reflect IRQ state

    // --- IRQ OUTPUT HANDLING:
    // TODO: Signal CPU interrupt controller if IRQ state changed
    // TODO: Assert/deassert IRQ line to 6510 processor based on irqActive state
    // TODO: Handle interrupt acknowledgment and timing

    // --- Register handling complete - interrupt enable updated according to VIC-II documentation
  }

  // --- Set VIC R1B
  private setRegD01BValue(value: number) {
    // $D01B - Sprite Data Priority Register
    // Each bit controls whether the corresponding sprite appears in front of or behind foreground graphics
    //
    // The VIC-II has a display priority hierarchy:
    // - Border (highest priority - always on top)
    // - Foreground graphics (text/bitmap data with color ≠ background)
    // - Sprites (priority depends on MxDP bits in this register)
    // - Background graphics (lowest priority)
    //
    // For each sprite x (bits 7-0 correspond to sprites 7-0):
    // - MxDP=0: Sprite appears BEHIND foreground graphics
    //   Priority: Background < Foreground < Sprite < Border
    // - MxDP=1: Sprite appears IN FRONT of foreground graphics
    //   Priority: Background < Sprite < Foreground < Border
    //
    // Sprite-to-sprite priority is independent of this register and determined by sprite number
    // (sprite 0 has highest priority, sprite 7 has lowest priority among sprites)
    //
    // Only bits 7-0 are used, no masking needed as this is a full 8-bit register

    // Set priority for each sprite based on corresponding bit
    for (let i = 0; i < 8; i++) {
      this.spriteData[i].priority = (value & (1 << i)) !== 0;
    }
    this.registers[0x1b] = value;
  }

  // --- Set VIC R1C
  private setRegD01CValue(value: number) {
    // $D01C - Sprite Multicolor Select Register
    // Each bit controls whether the corresponding sprite uses multicolor mode
    //
    // Standard mode (MxMC=0):
    // - 8 pixels per byte (1 bit per pixel)
    // - "0": Transparent
    // - "1": Sprite color ($D027-$D02E)
    //
    // Multicolor mode (MxMC=1):
    // - 4 pixels per byte (2 bits per pixel)
    // - "00": Transparent
    // - "01": Sprite multicolor 0 ($D025)
    // - "10": Sprite color ($D027-$D02E)
    // - "11": Sprite multicolor 1 ($D026)
    //
    // In multicolor mode, the sprite appears wider because each data bit represents
    // 2 horizontal pixels instead of 1, and X-expansion further doubles this.
    //
    // For each sprite x (bits 7-0 correspond to sprites 7-0):
    // - MxMC=0: Standard mode (8 pixels, sharper detail)
    // - MxMC=1: Multicolor mode (4 wider pixels, more colors available)
    //
    // Only bits 7-0 are used, no masking needed as this is a full 8-bit register

    // Set multicolor mode for each sprite based on corresponding bit
    for (let i = 0; i < 8; i++) {
      this.spriteData[i].multicolor = (value & (1 << i)) !== 0;
    }
    this.registers[0x1c] = value;
  }

  // ----------------------------------------------------------------------------------------------
  // Register $D01D (Sprite X Expansion)

  // --- Set VIC Register $D01D (Sprite X Expansion)
  // --- As per VIC-II doc section 3.2: Registers, section 3.8: Sprites, section 3.14.7: Sprite stretching
  // --- Each bit controls X expansion (width doubling) of corresponding sprite
  private setRegD01DValue(value: number) {
    // --- STEP 1: Extract new sprite X expansion values from register bits
    const newSpriteXExpand = [
      !!(value & 0x01), // Sprite 0 X expansion (bit 0)
      !!(value & 0x02), // Sprite 1 X expansion (bit 1)
      !!(value & 0x04), // Sprite 2 X expansion (bit 2)
      !!(value & 0x08), // Sprite 3 X expansion (bit 3)
      !!(value & 0x10), // Sprite 4 X expansion (bit 4)
      !!(value & 0x20), // Sprite 5 X expansion (bit 5)
      !!(value & 0x40), // Sprite 6 X expansion (bit 6)
      !!(value & 0x80) // Sprite 7 X expansion (bit 7)
    ];

    // --- STEP 2: Detect changes for each sprite and handle effects
    for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
      if (this.spriteData[spriteIndex].xExpand !== newSpriteXExpand[spriteIndex]) {
        // --- Sprite X expansion has changed
        // --- As per VIC-II doc section 3.8: Sprites, section 3.14.7: Sprite stretching

        if (newSpriteXExpand[spriteIndex]) {
          // --- X expansion changes from 0 to 1 (Enabling X expansion)
          // --- IMMEDIATE EFFECTS (same cycle):
          // - Sprite width: Doubled from 24 to 48 pixels
          // - Pixel duplication: Each sprite pixel displayed twice horizontally
          // - Shift timing: Sprite data sequencer outputs pixels with half frequency
          // - Screen coverage: Sprite covers more horizontal screen area
          // --- CONDITIONAL EFFECTS (depends on current state):
          // - Sprite enable: Only affects display if sprite is enabled via $d015
          // - Collision detection: Expanded sprite area affects collision calculations
          // - Screen boundaries: May cause sprite to extend beyond visible area
          // - X coordinate interaction: Same X position but doubled visual width
          // - Multicolor mode: In multicolor mode, each 2-bit pixel group is doubled
          // --- TIMING-CRITICAL considerations:
          // - Same-line changes: X expansion changes affect immediate sprite rendering
          // - Shift register timing: X expansion changes shift frequency immediately
          // - Sprite multiplexing: May affect timing on heavily loaded raster lines
        } else {
          // --- X expansion changes from 1 to 0 (Disabling X expansion)
          // --- IMMEDIATE EFFECTS (same cycle):
          // - Sprite width: Returns to normal 24 pixels
          // - Pixel display: Each sprite pixel displayed once (normal frequency)
          // - Screen coverage: Reduced horizontal screen area
          // --- CONDITIONAL EFFECTS (depends on current state):
          // - Collision detection: Reduced sprite area affects collision calculations
          // - Screen positioning: Same X coordinate but halved visual width
        }

        // --- DISPLAY CHANGES:
        // - Horizontal scaling: Sprite pixels stretched/compressed horizontally
        // - Aspect ratio: Sprite aspect ratio changes (height remains same, width doubles/halves)
        // - Border interaction: May affect sprite visibility at left/right screen edges
        // - Overlap effects: Changes in sprite overlap areas for collision detection

        // TODO: Get current raster line number and cycle
        // TODO: Check if sprite X expansion change affects current pixel output
        // TODO: Update sprite collision detection for new expansion state
        // TODO: Handle sprite visibility changes due to expansion at screen edges
        // TODO: Update sprite shift register timing if expansion affects current sprite
      }

      // --- STEP 3: Update internal state for this sprite
      this.spriteData[spriteIndex].xExpand = newSpriteXExpand[spriteIndex];
    }

    // --- STEP 4: Update register value
    this.registers[0x1d] = value & 0xff;

    // --- Register handling complete - sprite X expansion updated according to VIC-II documentation
  }

  // --- Set VIC R20
  private setRegD020Value(value: number) {
    // $D020 - Border Color Register
    // Controls the color displayed in the border area around the graphics window
    //
    // The screen layout consists of:
    // - Border: Outermost area displayed in border color (controlled by this register)
    // - Graphics window: Inner area containing text/bitmap/sprites (background colors, sprites, etc.)
    //
    // Only the lower 4 bits (3-0) are used for the color index:
    // - Bits 7-4: Unused, read as undefined but typically 0
    // - Bits 3-0: EC (Exterior Color) - border color index (0-15)
    //
    // Color values 0-15 correspond to the C64's standard 16-color palette:
    // 0=Black, 1=White, 2=Red, 3=Cyan, 4=Purple, 5=Green, 6=Blue, 7=Yellow,
    // 8=Orange, 9=Brown, 10=Light Red, 11=Dark Gray, 12=Medium Gray, 13=Light Green,
    // 14=Light Blue, 15=Light Gray
    //
    // The border is visible around the graphics area and during vertical/horizontal blanking.
    // Border manipulation techniques can create "overscan" effects by opening the border.

    const newBorderColor = value & 0x0f; // Mask to 4 bits (0-15)
    this.borderColor = newBorderColor;
    this.registers[0x20] = newBorderColor; // Store only the valid 4-bit value
  }

  // --- Set VIC R21
  private setRegD021Value(value: number) {
    // $D021 - Background Color 0 Register
    // Controls the primary background color used in all graphics modes
    //
    // This is the most commonly used background color and appears in all VIC-II graphics modes:
    // - Standard text mode: Background behind characters
    // - Multicolor text mode: Background color (00 bit pattern)
    // - Extended Color Mode (ECM): Background color 0 (selected by upper bits 00 of character code)
    // - Standard bitmap mode: Background color
    // - Multicolor bitmap mode: Background color (00 bit pattern)
    //
    // Only the lower 4 bits (3-0) are used for the color index:
    // - Bits 7-4: Unused, read as undefined but typically 0
    // - Bits 3-0: B0C (Background Color 0) - color index (0-15)
    //
    // Color values 0-15 correspond to the C64's standard 16-color palette

    const newBackgroundColor0 = value & 0x0f; // Mask to 4 bits (0-15)
    this.backgroundColor0 = newBackgroundColor0;
    this.registers[0x21] = newBackgroundColor0; // Store only the valid 4-bit value
  }

  // --- Set VIC R22
  private setRegD022Value(value: number) {
    // $D022 - Background Color 1 Register
    // Controls extended background color 1 used in multicolor and ECM modes
    //
    // Usage in different graphics modes:
    // - Standard text mode: Not used
    // - Multicolor text mode: Background color 1 (01 bit pattern in character data)
    // - Extended Color Mode (ECM): Background color 1 (selected by upper bits 01 of character code)
    // - Standard bitmap mode: Not used
    // - Multicolor bitmap mode: Background color 1 (01 bit pattern in bitmap data)
    //
    // Only the lower 4 bits (3-0) are used for the color index:
    // - Bits 7-4: Unused, read as undefined but typically 0
    // - Bits 3-0: B1C (Background Color 1) - color index (0-15)

    const newBackgroundColor1 = value & 0x0f; // Mask to 4 bits (0-15)
    this.backgroundColor1 = newBackgroundColor1;
    this.registers[0x22] = newBackgroundColor1; // Store only the valid 4-bit value
  }

  // --- Set VIC R23
  private setRegD023Value(value: number) {
    // $D023 - Background Color 2 Register
    // Controls extended background color 2 used in multicolor and ECM modes
    //
    // Usage in different graphics modes:
    // - Standard text mode: Not used
    // - Multicolor text mode: Background color 2 (10 bit pattern in character data)
    // - Extended Color Mode (ECM): Background color 2 (selected by upper bits 10 of character code)
    // - Standard bitmap mode: Not used
    // - Multicolor bitmap mode: Background color 2 (10 bit pattern in bitmap data)
    //
    // Only the lower 4 bits (3-0) are used for the color index:
    // - Bits 7-4: Unused, read as undefined but typically 0
    // - Bits 3-0: B2C (Background Color 2) - color index (0-15)

    const newBackgroundColor2 = value & 0x0f; // Mask to 4 bits (0-15)
    this.backgroundColor2 = newBackgroundColor2;
    this.registers[0x23] = newBackgroundColor2; // Store only the valid 4-bit value
  }

  // --- Set VIC R24
  private setRegD024Value(value: number) {
    // $D024 - Background Color 3 Register
    // Controls extended background color 3 used in ECM mode only
    //
    // Usage in different graphics modes:
    // - Standard text mode: Not used
    // - Multicolor text mode: Not used
    // - Extended Color Mode (ECM): Background color 3 (selected by upper bits 11 of character code)
    // - Standard bitmap mode: Not used
    // - Multicolor bitmap mode: Not used
    //
    // Only the lower 4 bits (3-0) are used for the color index:
    // - Bits 7-4: Unused, read as undefined but typically 0
    // - Bits 3-0: B3C (Background Color 3) - color index (0-15)

    const newBackgroundColor3 = value & 0x0f; // Mask to 4 bits (0-15)
    this.backgroundColor3 = newBackgroundColor3;
    this.registers[0x24] = newBackgroundColor3; // Store only the valid 4-bit value
  }

  // --- Set VIC R25
  /**
   * Sets the Sprite Multicolor 0 register ($D025)
   * VIC-II color register for multicolor sprites
   *
   * Register: $D025 (53285) - Sprite multicolor 0
   * Description: The "01" bit pattern in multicolor sprites
   *
   * In multicolor sprite mode (when sprite multicolor bit is set in $D01C):
   * - The sprite data uses 2 bits per pixel instead of 1
   * - 00 = transparent (sprite background shows through)
   * - 01 = sprite multicolor 0 (this register)
   * - 10 = individual sprite color (from $D027-$D02E)
   * - 11 = sprite multicolor 1 (from $D026)
   *
   * This color is shared by all multicolor sprites on the screen.
   *
   * @param value Color index (bits 0-3 only, bits 4-7 ignored)
   */
  private setRegD025Value(value: number) {
    const newSpriteMulticolor0 = value & 0x0f; // Mask to 4 bits (0-15)
    this.spriteMulticolor0 = newSpriteMulticolor0;
    this.registers[0x25] = newSpriteMulticolor0; // Store only the valid 4-bit value
  }

  // --- Set VIC R26
  /**
   * Sets the Sprite Multicolor 1 register ($D026)
   * VIC-II color register for multicolor sprites
   *
   * Register: $D026 (53286) - Sprite multicolor 1
   * Description: The "11" bit pattern in multicolor sprites
   *
   * In multicolor sprite mode (when sprite multicolor bit is set in $D01C):
   * - The sprite data uses 2 bits per pixel instead of 1
   * - 00 = transparent (sprite background shows through)
   * - 01 = sprite multicolor 0 (from $D025)
   * - 10 = individual sprite color (from $D027-$D02E)
   * - 11 = sprite multicolor 1 (this register)
   *
   * This color is shared by all multicolor sprites on the screen.
   *
   * @param value Color index (bits 0-3 only, bits 4-7 ignored)
   */
  private setRegD026Value(value: number) {
    const newSpriteMulticolor1 = value & 0x0f; // Mask to 4 bits (0-15)
    this.spriteMulticolor1 = newSpriteMulticolor1;
    this.registers[0x26] = newSpriteMulticolor1; // Store only the valid 4-bit value
  }

  // ----------------------------------------------------------------------------------------------
  // Video modes

  // ----------------------------------------------------------------------------------------------
  // Border unit

  mainBorderFlipFlop: boolean;
  verticalBorderFlipFlop: boolean;

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

  /**
   * Sets the individual sprite color registers ($D027-$D02E)
   * VIC-II color registers for individual sprite colors
   *
   * Registers: $D027-$D02E (53287-53294) - Sprite 0-7 colors
   * Description: Individual color for each sprite
   *
   * Usage in different sprite modes:
   * - Standard sprite mode (multicolor bit = 0 in $D01C):
   *   * 0 = transparent (sprite background shows through)
   *   * 1 = sprite color (this register)
   *
   * - Multicolor sprite mode (multicolor bit = 1 in $D01C):
   *   * 00 = transparent (sprite background shows through)
   *   * 01 = sprite multicolor 0 (from $D025)
   *   * 10 = sprite color (this register)
   *   * 11 = sprite multicolor 1 (from $D026)
   *
   * Each sprite has its own individual color independent of other sprites.
   *
   * @param index Sprite index (0-7) corresponding to register $D027+index
   * @param value Color index (bits 0-3 only, bits 4-7 ignored)
   */
  private setSpriteColor(index: number, value: number) {
    const newSpriteColor = value & 0x0f; // Mask to 4 bits (0-15)
    const regAddress = 0x27 + index; // Calculate register address

    // Update the sprite color in the spriteData array
    this.spriteData[index].color = newSpriteColor;

    // Update the register array
    this.registers[regAddress] = newSpriteColor;
  }

  // ----------------------------------------------------------------------------------------------
  // Rendering operation methods

  private CheckLeftBorder(): void {
    const compareValue = this.csel ? 24 : 32;
    if (this.currentCycle !== compareValue) return;

    // --- At this point, the X coordinate reaches the left comparison value.

    const topComparison = this.rsel ? 51 : 55; // RSEL=1: 51, RSEL=0: 55
    const bottomComparison = this.rsel ? 251 : 247; // RSEL=1: 251, RSEL=0: 247

    // --- Border Rule 4: If the X coordinate reaches the left comparison value and the Y
    // --- coordinate reaches the bottom one, the vertical border flip flop is set.
    if (this.currentRasterLine === bottomComparison) {
      this.verticalBorderFlipFlop = true;
    }

    // --- Border Rule 5: If X reaches left AND Y reaches top AND DEN=1, reset vertical
    // --- border flip-flop
    if (this.currentRasterLine === topComparison && this.den) {
      this.verticalBorderFlipFlop = false;
    }

    // --- Border Rule 6: If X reaches left AND vertical border flip-flop is NOT set, reset
    // --- main border flip-flop
    if (!this.verticalBorderFlipFlop) {
      this.mainBorderFlipFlop = false;
    }
  }

  private CheckRightBorder(): void {
    const compareValue = this.csel ? 344 : 335;
    if (this.currentCycle !== compareValue) return;

    // --- Border Rule 1:
    this.mainBorderFlipFlop = true;
  }

  private CheckSpriteExpansion(tact: RenderingTact): void {
    // Check sprite Y expansion in cycle 55
    // MxYE bit controls sprite height doubling
    const spriteIndex = tact.spriteIndex;
    if (spriteIndex !== undefined) {
      // TODO: Check if sprite Y expansion bit is set for this sprite
      // TODO: Toggle sprite expansion flip-flop based on MxYE bit
      // TODO: Handle sprite expansion state changes
      // TODO: Update sprite display height calculations
    }
  }

  private CheckSpriteDma(tact: RenderingTact): void {
    // Check if sprite DMA (data fetch) is needed
    // Occurs in cycles 55-56 for sprite visibility testing
    const spriteIndex = tact.spriteIndex;
    if (spriteIndex !== undefined) {
      // TODO: Check sprite Y coordinate against current raster line
      // TODO: Determine if sprite is visible on current line
      // TODO: Set sprite DMA flag if sprite needs data fetch
      // TODO: Handle sprite data counter management
    }
  }

  private UpdateSpriteBaseAddress(): void {
    // Update sprite base address (MCBASE) in cycle 58
    // TODO: Update MCBASE from MC for all sprites
    // TODO: Handle sprite line counter management
    // TODO: Reset sprite data counters as needed
    // TODO: Prepare for next sprite line processing
  }

  private CheckSpriteCrunching(): void {
    // Check for sprite crunching conditions
    // Occurs when too many sprites are active on same line
    // TODO: Count active sprites on current line
    // TODO: Determine if sprite multiplexing is needed
    // TODO: Handle sprite priority conflicts
    // TODO: Manage sprite data fetch timing conflicts
  }

  private UpdateVC(): void {
    // Update Video Counter (VC) after g-access in display state
    // VC points to current position in video matrix (40x25 characters)
    // TODO: Check if in display state (not idle state)
    // TODO: Increment VC after each character/bitmap data fetch
    // TODO: Handle VC wraparound at end of video matrix
    // TODO: Manage VC reload from VCBASE on Bad Lines
  }

  private UpdateRC(): void {
    // Update Row Counter (RC) - tracks character row within 8-pixel character
    // Checked in cycle 58 of each raster line
    // TODO: Check if RC should be incremented (end of character row)
    // TODO: Handle RC reset when character row complete (RC=7)
    // TODO: Manage transition between display state and idle state
    // TODO: Update VMLI (Video Matrix Line Increment) as needed
  }

  private FetchIdle(): void {
    // Idle fetch - no actual memory access, just timing maintenance
    // The VIC maintains cycle timing but doesn't access the bus
    // This allows the CPU to continue normal operation
  }

  private FetchRefresh(): void {
    // DRAM refresh cycle - maintains dynamic RAM integrity
    // TODO: Implement DRAM refresh address generation using refresh counter
    // TODO: Generate refresh address from 8-bit refresh counter (REF)
    // TODO: Perform refresh memory access (read cycle at refresh address)
    // TODO: Decrement refresh counter for next refresh cycle
    // TODO: Handle refresh counter wraparound (resets to $FF at frame start)
  }

  private FetchG(tact: RenderingTact): void {
    // Graphics data fetch (character generator or bitmap access)
    // Address depends on current graphics mode and display state

    // TODO: Determine graphics mode from ECM/BMM/MCM bits
    const ecm = this.ecm;
    const bmm = this.bmm;
    const mcm = this.mcm;

    if (bmm) {
      // Bitmap mode - fetch bitmap data
      // TODO: Calculate bitmap address using VC and RC
      // TODO: Address = CB13|VC9|VC8|VC7|VC6|VC5|VC4|VC3|VC2|VC1|VC0|RC2|RC1|RC0
      // TODO: Perform memory read at calculated address
      // TODO: Load fetched data into graphics shift register
    } else {
      // Text mode - fetch character generator data
      // TODO: Calculate character generator address using character code and RC
      // TODO: Address = CB13|CB12|CB11|CHAR7|CHAR6|CHAR5|CHAR4|CHAR3|CHAR2|CHAR1|CHAR0|RC2|RC1|RC0
      // TODO: Handle ECM mode address line forcing (A9=A10=0 when ECM=1)
      // TODO: Perform memory read at calculated address
      // TODO: Load fetched data into graphics shift register
    }

    // TODO: Handle idle state (always fetch from $3FFF or $39FF if ECM=1)
    // TODO: Apply XSCROLL delay to graphics data loading
  }

  private FetchSprPtr(tact: RenderingTact): void {
    // Sprite data pointer fetch - reads sprite pointer from video matrix
    // Determines which 64-byte block contains sprite data
    // TODO: Calculate sprite pointer address in video matrix
    // TODO: Address = video_matrix_base + $3F8 + sprite_number
    // TODO: Perform memory read to get sprite data pointer
    // TODO: Store sprite pointer for subsequent sprite data fetches
    // TODO: Handle sprite index from tact.spriteIndex if available
  }

  private FetchSprData(tact: RenderingTact): void {
    // Sprite data fetch - reads 24x21 pixel data (3 bytes per line)
    // Fetches actual sprite pixel data using sprite pointer
    // TODO: Calculate sprite data address using sprite pointer and sprite line counter
    // TODO: Address = sprite_pointer * 64 + sprite_line_offset
    // TODO: Perform memory read to get sprite data bytes (3 bytes per sprite line)
    // TODO: Load sprite data into sprite shift register
    // TODO: Handle sprite index from tact.spriteIndex if available
    // TODO: Update sprite line counter after fetch
  }

  // --- Compatibility getters for tests that expect the old property names
  // --- These return the combined 8-bit values for backward compatibility

  /**
   * Get sprite priority register value ($D01B) - backward compatibility getter
   * Returns 8-bit value where each bit represents sprite priority
   * (0 = sprite behind foreground, 1 = sprite in front of foreground)
   */
  get spritePriority(): number {
    let value = 0;
    for (let i = 0; i < 8; i++) {
      if (this.spriteData[i].priority) {
        value |= 1 << i;
      }
    }
    return value;
  }

  /**
   * Get sprite multicolor register value ($D01C) - backward compatibility getter
   * Returns 8-bit value where each bit represents sprite multicolor mode
   * (0 = standard mode, 1 = multicolor mode)
   */
  get spriteMulticolor(): number {
    let value = 0;
    for (let i = 0; i < 8; i++) {
      if (this.spriteData[i].multicolor) {
        value |= 1 << i;
      }
    }
    return value;
  }

  // ----------------------------------------------------------------------------------------------
  // Pixel rendering

  /**
   * Renders the current pixel to the screen.
   */
  private renderPixel(): void {
    // TODO: Implement pixel rendering logic

    // --- Next pixel
    this.currentXPosition++;
  }
}

/**
 * Information about a single sprite (0-7) in the VIC-II chip.
 * Contains all sprite-related state that can be controlled by VIC registers.
 */
type SpriteInformation = {
  /** Whether the sprite is enabled/visible (controlled by $d015) */
  enabled: boolean;
  /** X coordinate (9-bit value from $d000, $d002, etc. + MSB from $d010) */
  x: number;
  /** Y coordinate (8-bit value from $d001, $d003, $d005, $d007, $d009, $d00b, $d00d, $d00f) */
  y: number;
  /** Y expansion (doubled height when true, controlled by $d017) */
  yExpand: boolean;
  /** X expansion (doubled width when true, controlled by $d01d) */
  xExpand: boolean;
  /** Sprite color (4-bit value from $d027-$d02e) */
  color: number;
  /** Multicolor mode (controlled by $d01c) - true = multicolor, false = standard */
  multicolor: boolean;
  /** Sprite-background priority (controlled by $d01b) - true = sprite behind background, false = sprite in front */
  priority: boolean;
  // TODO: Add other sprite properties as we implement more registers:
  // dataPointer: number; // Sprite data pointer (from $07f8-$07ff + VIC bank)
};
