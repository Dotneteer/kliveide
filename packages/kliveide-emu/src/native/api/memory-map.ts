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
export const REG_AREA_INDEX = 0x03_D200;
export const PAGE_INDEX_16 = 0x03_D240;
export const STATE_TRANSFER_BUFF = 0x03_D280;
export const TEST_INPUT_OFFS = 0x03_D600;
export const TEST_MEM_LOG_OFFS = 0x03_DA00;
export const TEST_IO_LOG_OFFS = 0x03_DE00;
export const TEST_TBBLUE_LOG_OFFS = 0x03_E200;
export const EXEC_OPTIONS_BUFF = 0x03_E600;
export const KEYBOARD_LINES = 0x03_E700;
export const RENDERING_TACT_TABLE = 0x03_E800;
export const CONTENTION_TABLE = 0x09_E800;
export const PIXEL_RENDERING_BUFFER = 0x0B_2D00;
export const COLORIZATION_BUFFER = 0x0D_AD00;
export const BEEPER_SAMPLE_BUFFER = 0x17_AD00;
export const PSG_SAMPLE_BUFFER = 0x17_CD00;
export const TAPE_DATA_BUFFER = 0x17_ED00;
export const TAPE_SAVE_BUFFER = 0x21_ED00;
export const BREAKPOINT_MAP = 0x22_ED00;
export const MEMWRITE_MAP = 0x23_0D00;
export const STEP_OUT_STACK = 0x23_2D00;
export const PSG_ENVELOP_TABLE = 0x23_3000;

export const Z88_PAGE_PTRS = 0x23_3920;
export const Z88_MEM_AREA = 0x23_4000;
