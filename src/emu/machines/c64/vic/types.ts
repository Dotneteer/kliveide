/**
 * This type describes the configuration of a particular VIC chip.
 */
export type VicChipConfiguration = {
  // --- Informative name
  name: string;

  // --- The number of cycles for each line
  cyclesPerLine: number;

  // --- The number of raster lines
  numRasterLines: number;

  // --- The width of visible left border
  borderLeft: number;

  // --- The width of visible right border
  borderRight: number;

  // --- The width of visible top border
  borderTop: number;

  // --- The width of visible bottom border
  borderBottom: number;

  // --- The first displayed line
  firstDisplayedLine: number;

  // --- The last displayed line
  lastDisplayedLine: number;

  // --- The table describing the behavior of each cycle (phi1 and phi2 phases)
  cycleTable: VicCycle[];

  // --- The color latency
  colorLatency: boolean;

  // --- The lightpen old IRQ mode
  lightpenOldIrqMode: boolean;

  // --- This chip supports the new luminance values
  newLuminances: boolean;
};

/**
 * This type describes a single cycle in the VIC chip's operation.
 */
export type VicCycle = {
  // --- The cycle number (ID)
  cycle: number;

  // --- The X coordinate of the pixel (see section 3.6.1 in vic-ii.txt)
  xpos: number;

  // --- Is the result of this cycle visible?
  visible: number;

  // --- The phi1 phase fetch operation
  fetch: number;

  // --- Operation influencing the BA line
  ba: number;

  // --- Various flags for this cycle
  flags: number;
};

// --- This type describes the operations for a particular rendering cycle's phase
export type RenderingTact = {
  // --- The cycle number (ID)
  cycle: number;

  // --- X position of the pixel in the current raster line
  // --- (0-39 for 40 columns, 0-37 for 38 columns)
  xPosition: number;

  // --- Border operation
  // --- | CheckLeftBorder
  // --- | CheckRightBorder
  borderOperation?: BorderRenderingOperation;

  // --- Sprite operation
  // --- | CheckSpriteExpansion
  // --- | CheckSpriteDma
  // --- | CheckSpriteDisplay
  // --- | UpdateSpriteBaseAddress
  // --- | CheckSpriteCrunching
  spriteOperation?: RenderingOperation;

  // --- Counter operation
  // --- | UpdateVC
  // --- | UpdateRC
  counterOperation?: RenderingOperation;

  // --- Indicates if this phase may fetch the video matrix, provided a bad line is detected
  mayFetchVideoMatrix: boolean;

  // --- Index of the sprite affected in a sprite operation
  spriteIndex?: number;

  // --- Fetch operation
  // --- | IdleFetch: Idle fetch, no actual data access
  // --- | RefreshFetch: DRAM refresh
  // --- | FetchG: Access to character generator or bitmap (g-access)
  // --- | FetchSprPtr: Reading the sprite data pointer for sprite 0-7 (p-access)
  // --- | FetchSprData: Reading the sprite data (s-access)
  fetchOperation?: RenderingOperation;

  // --- Indicates if this phase checks if BA should be set
  checkFetchBA: boolean;

  // --- Sprite flags to check if BA should be set
  checkSpriteFetchBAMask: number;
};

// --- A border rendering operation
export type BorderRenderingOperation = () => void; 

// --- An operation working with the specified tact information
export type RenderingOperation = (tact: RenderingTact) => void;

export type VicLightPen = {
  state: number;
  triggered: number;
  x: number;
  y: number;
  x_extra_bits: number;
};
