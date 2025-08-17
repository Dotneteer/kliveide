export const VICII_SCREEN_XPIX = 320;
export const VICII_SCREEN_YPIX = 200;
export const VICII_SCREEN_TEXTCOLS = 40;
export const VICII_SCREEN_TEXTLINES = 25;
export const VICII_SCREEN_CHARHEIGHT = 8;
export const VICII_NUM_SPRITES = 8;
export const VICII_MAX_SPRITE_WIDTH = 56; /* expanded sprite in bug area */
export const VICII_NUM_COLORS = 16;
export const VICIIDTV_NUM_COLORS = 256;

/**
 * Cycle # at which the VIC takes the bus in a bad line (BA goes low).
 */
export const VICII_FETCH_CYCLE = 11;

/**
 * Delay for the raster line interrupt. This is not due to the VIC-II, since
 * it triggers the IRQ line at the beginning of the line, but to the 6510
 * that needs at least 2 cycles to detect it.
 */
export const VICII_RASTER_IRQ_DELAY = 2;

/**
 * Common parameters for all video standards
 */
export const VICII_25ROW_START_LINE = 0x33;
export const VICII_25ROW_STOP_LINE = 0xfb;
export const VICII_24ROW_START_LINE = 0x37;
export const VICII_24ROW_STOP_LINE = 0xf7;

/**
 * Bad line range
 */
export const VICII_FIRST_DMA_LINE = 0x30;
export const VICII_LAST_DMA_LINE = 0xf7;

/**
 * Available video modes.  The number is given by
 * ((vicii.regs[0x11] & 0x60) | (vicii.regs[0x16] & 0x10)) >> 4.
 */
export const enum VicVideoModes {
  VICII_NORMAL_TEXT_MODE = 0,
  VICII_MULTICOLOR_TEXT_MODE = 1,
  VICII_HIRES_BITMAP_MODE = 2,
  VICII_MULTICOLOR_BITMAP_MODE = 3,
  VICII_EXTENDED_TEXT_MODE = 4,
  VICII_ILLEGAL_TEXT_MODE = 5,
  VICII_ILLEGAL_BITMAP_MODE_1 = 6,
  VICII_ILLEGAL_BITMAP_MODE_2 = 7,
  VICII_IDLE_MODE = 20 /* Special mode for idle state.  */
}

export const enum VicFetchIndex {
  VICII_FETCH_MATRIX = 0,
  VICII_CHECK_SPRITE_DMA = 1,
  VICII_FETCH_SPRITE = 2
}

export const enum VicIdleDataLocation {
  None = 0,
  At3FFF = 1,
  At39FF = 2
}

/* Common */
export const None = 0;

/* Flags */
export const UpdateMcBase = 0x001;
export const ChkSprExp = 0x002;
export const ChkSprDma = 0x004;
export const ChkSprCrunch = 0x010;
export const ChkBrdL1 = 0x020;
export const ChkBrdL0 = 0x040;
export const ChkBrdR0 = 0x080;
export const ChkBrdR1 = 0x100;
export const UpdateVc = 0x200;
export const UpdateRc = 0x400;

/** Fetch */
export const FetchType_M = 0xf00;
export const FetchSprNum_M = 0x007;
export const Refresh = 0x500;
export const FetchG = 0x600;
export const FetchC = 0x700;
export const Idle = 0x800;

/* BA */
export const BaFetch = 0x100;
export const BaSpr_M = 0xff;

export const FETCH_BA_M = 0x00000100;
export const FETCH_BA_B = 8;
export const SPRITE_BA_MASK_M = 0x000000ff;
export const SPRITE_BA_MASK_B = 0;

/*
 * 15    May FetchC
 */
export const PHI2_FETCH_C_M = 0x00008000;

/*
 * 14-12 Phi1 Fetch sprite num
 */
export const PHI1_SPR_NUM_M = 0x00007000;
export const PHI1_SPR_NUM_B = 12;

/*
 * 11-9 Phi1 Fetch
 *   000 Idle
 *   001 Refresh
 *   010 FetchG
 *   011 Sprite Ptr + DMA0
 *   100 Sprite DMA1 + DMA2
 */
export const PHI1_TYPE_M = 0x00000e00;
export const PHI1_TYPE_B = 9;
export const PHI1_IDLE = 0x00000000;

// --- Issue a DRAM refresh
export const PHI1_REFRESH = 0x00000200;

// --- Access to character generator bitmap
export const PHI1_FETCH_G = 0x00000400;
export const PHI1_SPR_PTR = 0x00000600;
export const PHI1_SPR_DMA1 = 0x00000800;

/*
 * 22    Visible
 */
export const VISIBLE_M = 0x00400000;

/*
 * 21-16 XPos/8
 */
export const XPOS_M = 0x003f0000;
export const XPOS_B = 16;

/*
 * 28-25 Sprites
 *   1--- Check Sprite Exp
 *   -001 Check Sprite Dma
 *   -010 Check Sprite Display
 *   -011 Update MCBASE
 *   -100 Check Sprite Crunch
 */
export const CHECK_SPR_EXP_M = 0x10000000;

export const CHECK_SPR_M = 0x0e000000;
export const CHECK_SPR_DMA = 0x02000000;
export const CHECK_SPR_DISP = 0x04000000;
export const UPDATE_MCBASE = 0x06000000;
export const CHECK_SPR_CRUNCH = 0x08000000;

/*
 * 31-29 Border
 *   000 None
 *   100 Check border L0
 *   101 Check border L1
 *   010 Check border R0
 *   011 Check border R1
 */
export const CHECK_BRD_M = 0xe0000000;
export const CHECK_BRD_L = 0x80000000;
export const CHECK_BRD_R = 0x40000000;
export const CHECK_BRD_CSEL = 0x20000000;

/*
 * 24-23 VcRc
 *   00  None
 *   10  UpdateVc
 *   01  UpdateRc
 */
export const UPDATE_VC_M = 0x01000000;
export const UPDATE_RC_M = 0x00800000;
