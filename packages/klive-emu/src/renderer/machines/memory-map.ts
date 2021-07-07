// ============================================================================
// This file contains constant values that define the memory map of the
// WebAssembly code.

// ============================================================================
// Virtual machine memory
export const VM_MEMORY = 0x00_0000

// ============================================================================
// Z80-specific memory map

// --- Register area
export const REG_AREA_INDEX = 0x0100_0080;

// --- 8K page indexes
export const BLOCK_LOOKUP_TABLE = 0x01000000;

// --- CPU state transfer area
export const CPU_STATE_BUFFER = 0x0100009c;

// --- Execution engine state transfer buffer
export const EXEC_ENGINE_STATE_BUFFER = 0x01000de3;

// --- Execution options state transfer buffer
export const EXEC_OPTIONS_BUFFER = 0x01000df0;

// ============================================================================
// Generic virtual machine engine memory map

// --- Map of breakpoints, 1 byte for each 16-bit address
export const BREAKPOINTS_MAP = 0x0106_0000;

// --- Breakpoint partitions map, 2 bytes for each 16-bit address
export const BRP_PARTITION_MAP = 0x0107_0000;

// ============================================================================
// ZX Spectrum memory map

// --- Machine state trasnfer buffer
export const SPECTRUM_MACHINE_STATE_BUFFER = 0x013db434;

// --- The beginning of the rendering tact table
export const RENDERING_TACT_TABLE = 0x010e0fe4;

// --- Offset address for bank 0
export const BANK_0_OFFSET = 0x00_8000;

// --- ZX Spectrum 48 ROM offset
export const ROM_48_OFFSET = 0x00_4000;

// --- ZX Spectrum 128 ROM 0 offset
export const ROM_128_0_OFFSET = 0x00_0000;

// --- Pixel rendering buffer
export const PIXEL_RENDERING_BUFFER = 0x012c0fe4;

// --- Colorization buffer
export const COLORIZATION_BUFFER = 0x012e8fe4;

// --- Beeper samples
export const BEEPER_SAMPLE_BUFFER = 0x013d9434;

// --- AY PSG chip samples
export const PSG_SAMPLE_BUFFER = 0x013efd3f;

// --- Tape LOAD buffer
export const TAPE_DATA_BUFFER = 0x0138942c;

// --- Tape SAVE buffer
export const TAPE_SAVE_BUFFER = 0x013c942c;

// ============================================================================
// Cambridge Z88 memory map

// --- Machine state trasnfer buffer
export const Z88_MACHINE_STATE_BUFFER = 0x016c30f0;

// --- Z88 pixel buffer area
export const Z88_PIXEL_BUFFER = 0x010e30f0;

// --- Z88 beeper buffer area
export const Z88_BEEPER_BUFFER = 0x010e10f0;
