// ============================================================================
// ZX Spectrum specific memory map

// --- The beginning of the rendering tact table
export const RENDERING_TACT_TABLE = 0x010e_29e8;

// --- Offset address for bank 0
export const BANK_0_OFFSET = 0x00_8000;

// --- ZX Spectrum 48 ROM offset
export const ROM_48_OFFSET = 0x00_4000;

// --- ZX Spectrum 128 ROM 0 offset
export const ROM_128_0_OFFSET = 0x00_0000;

// --- Pixel rendering buffer
export const PIXEL_RENDERING_BUFFER = 0x012c_29e8;

// --- Colorization buffer
export const COLORIZATION_BUFFER = 0x012e_a9e8;

// --- Beeper samples
export const BEEPER_SAMPLE_BUFFER = 0x013d_ae38;

// --- AY PSG chip samples
export const PSG_SAMPLE_BUFFER = 0x0101_610b;

// --- Tape LOAD buffer
export const TAPE_DATA_BUFFER = 0x0138_ae30;

// --- Tape SAVE buffer
export const TAPE_SAVE_BUFFER = 0x013c_ae30;
