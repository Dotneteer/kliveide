// ============================================================================
// This file contains constant values that define the memory map of the
// WebAssembly code.

// ============================================================================
// Virtual machine memory
export const VM_MEMORY = 0x00_0000

// ============================================================================
// Z80-specific memory map

// --- Register area
export const REG_AREA_INDEX = 0x40_0D00;

// --- Machine state trasnfer buffer
export const STATE_TRANSFER_BUFF = 0x40_0D60;

// ============================================================================
// Generic virtual machine engine memory map

// --- Map of breakpoints, 1 bit for each 16-bit address
export const BREAKPOINT_MAP = 0x40_2000;

// --- Map of breakpoint pages, 8-bit for each 16-bit address
export const BREAKPOINT_PAGES_MAP = 0x40_4000;

// --- Map of memory write operations, 1 bit for each 16-bit address
export const MEMWRITE_MAP = 0x41_4000;

// --- Map of code read operations, 1 bit for each 16-bit address
export const CODE_READ_MAP = 0x41_6000;

// --- Map of memory read operations, 1 bit for each 16-bit address
export const MEMREAD_MAP = 0x41_8000;

// --- Step-out operation stack
export const STEP_OUT_STACK = 0x41_A000;

// ============================================================================
// Z80 test machine memory map

// --- Input buffer for the Z80 IN instructions
export const TEST_INPUT_OFFS = 0x42_0000;

// --- Memory operations log buffer
export const TEST_MEM_LOG_OFFS = 0x42_0100;

// --- I/O operations log buffer
export const TEST_IO_LOG_OFFS = 0x42_0500;

// --- TBBlue NEXTREG operations log buffer
export const TEST_TBBLUE_LOG_OFFS = 0x42_0900;

// ============================================================================
// ZX Spectrum memory map

// --- Offset address for bank 0
export const BANK_0_OFFS = 0x00_0000;

// --- ZX Spectrum 48 ROM offset
export const ROM_48_OFFS = 0x02_0000;

// --- ZX Spectrum 128 ROM 0 offset
export const ROM_128_0_OFFS = 0x02_4000;

// --- 16K page indexes
export const PAGE_INDEX_16 = 0x42_0180;

// --- Pixel rendering buffer
export const PIXEL_RENDERING_BUFFER = 0x49_4700;

// --- Colorization buffer
export const COLORIZATION_BUFFER = 0x4B_C700;

// --- Beeper samples
export const BEEPER_SAMPLE_BUFFER = 0x55_C700;

// --- AY PSG chip samples
export const PSG_SAMPLE_BUFFER = 0x55_E700;

// --- Tape LOAD buffer
export const TAPE_DATA_BUFFER = 0x56_0700;

// --- Tape SAVE buffer
export const TAPE_SAVE_BUFFER = 0x60_0700;

export const PSG_ENVELOP_TABLE = 0x60_4C00;

// ============================================================================
// Cambridge Z88 memory map

// --- Z88 8K page pointer area
export const Z88_PAGE_PTRS =  0x42_0020;

// --- Z88 memory area
export const Z88_MEM_AREA = 0x00_0000;
