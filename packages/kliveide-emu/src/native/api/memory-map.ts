// ============================================================================
// This file contains constant values that define the memory map of the
// WebAssembly code.

export const BANK_0_OFFS = 0x00_0000;
export const BANK_1_OFFS = 0x00_4000;
export const BANK_2_OFFS = 0x00_8000;
export const BANK_3_OFFS = 0x00_C000;
export const BANK_4_OFFS = 0x01_0000;
export const BANK_5_OFFS = 0x01_4000;
export const BANK_6_OFFS = 0x01_8000;
export const BANK_7_OFFS = 0x01_C000;
export const ROM_48_OFFS = 0x02_0000;
export const ROM_128_0_OFFS = 0x02_4000;
export const ROM_128_1_OFFS = 0x02_8000;
export const ROM_P3_0_OFFS = 0x02_C000;
export const ROM_P3_1_OFFS = 0x03_0000;
export const ROM_P3_2_OFFS = 0x03_4000;
export const ROM_P3_3_OFFS = 0x03_8000;
export const REG_AREA_INDEX = 0x40_0A00;
export const PAGE_INDEX_16 = 0x40_0A40;
export const STATE_TRANSFER_BUFF = 0x40_0A80;
export const TEST_INPUT_OFFS = 0x40_1000;
export const TEST_MEM_LOG_OFFS = 0x40_1100;
export const TEST_IO_LOG_OFFS = 0x40_1500;
export const TEST_TBBLUE_LOG_OFFS = 0x40_1900;
export const EXEC_OPTIONS_BUFF = 0x41_0000;
export const KEYBOARD_LINES = 0x41_0100;
export const RENDERING_TACT_TABLE = 0x41_0200;
export const CONTENTION_TABLE = 0x47_0200;
export const PIXEL_RENDERING_BUFFER = 0x48_4700;
export const COLORIZATION_BUFFER = 0x4A_C700;
export const BEEPER_SAMPLE_BUFFER = 0x54_C700;
export const PSG_SAMPLE_BUFFER = 0x54_E700;
export const TAPE_DATA_BUFFER = 0x55_0700;
export const TAPE_SAVE_BUFFER = 0x5F_0700;
export const BREAKPOINT_MAP = 0x60_0700;
export const MEMWRITE_MAP = 0x60_2700;
export const STEP_OUT_STACK = 0x60_4700;
export const PSG_ENVELOP_TABLE = 0x60_4C00;

export const Z88_PAGE_PTRS =  0x41_0020;
export const Z88_MEM_AREA = 0x00_0000;
