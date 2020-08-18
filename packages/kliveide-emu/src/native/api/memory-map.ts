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
export const REG_AREA_INDEX = 0x07_D200;
export const STATE_TRANSFER_BUFF = 0x07_D240;
export const TEST_INPUT_OFFS = 0x07_D600;
export const TEST_MEM_LOG_OFFS = 0x07_DA00;
export const TEST_IO_LOG_OFFS = 0x07_DE00;
export const TEST_TBBLUE_LOG_OFFS = 0x07_E200;
export const EXEC_OPTIONS_BUFF = 0x07_E600;
export const KEYBOARD_LINES = 0x07_E700;
export const RENDERING_TACT_TABLE = 0x07_E800;
export const CONTENTION_TABLE = 0x0D_E800;
export const PIXEL_RENDERING_BUFFER = 0x0F_2D00;
export const COLORIZATION_BUFFER = 0x11_AD00;
export const BEEPER_SAMPLE_BUFFER = 0x1B_AD00;
export const PSG_SAMPLE_BUFFER = 0x1B_CD00;
export const TAPE_DATA_BUFFER = 0x1B_ED00;
export const TAPE_SAVE_BUFFER = 0x25_ED00;
export const BREAKPOINT_MAP = 0x26_ED00;
export const MEMWRITE_MAP = 0x27_0D00;
export const STEP_OUT_STACK = 0x27_2D00;
