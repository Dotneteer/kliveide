;; ==========================================================================
;; ZX Spectrum specific contents

;; ----------------------------------------------------------------------------
;; RAM banks

;; 128K RAM. These are the RAM banks of ZS Spectrum 128/+3
;; Also, the first 3 banks are used as the RAM of ZX Spectrum 48K
(global $BANK_0_OFFS   i32 (i32.const 0x00_0000))
(global $BANK_0_OFFS_H i32 (i32.const 0x00_2000))
(global $BANK_1_OFFS   i32 (i32.const 0x00_4000))
(global $BANK_1_OFFS_H i32 (i32.const 0x00_6000))
(global $BANK_2_OFFS   i32 (i32.const 0x00_8000))
(global $BANK_2_OFFS_H i32 (i32.const 0x00_A000))
(global $BANK_3_OFFS   i32 (i32.const 0x00_C000))
(global $BANK_3_OFFS_H i32 (i32.const 0x00_E000))
(global $BANK_4_OFFS   i32 (i32.const 0x01_0000))
(global $BANK_4_OFFS_H i32 (i32.const 0x01_2000))
(global $BANK_5_OFFS   i32 (i32.const 0x01_4000))
(global $BANK_5_OFFS_H i32 (i32.const 0x01_6000))
(global $BANK_6_OFFS   i32 (i32.const 0x01_8000))
(global $BANK_6_OFFS_H i32 (i32.const 0x01_A000))
(global $BANK_7_OFFS   i32 (i32.const 0x01_C000))
(global $BANK_7_OFFS_H i32 (i32.const 0x01_E000))

;; ----------------------------------------------------------------------------
;; ROM pages

;; ZX Spectrum 48K ROM (0x4000 bytes)
(global $ROM_48_OFFS i32   (i32.const 0x02_0000))
(global $ROM_48_OFFS_H i32 (i32.const 0x02_2000))

;; ZX Spectrum 128 ROM 0 (0x4000 bytes)
(global $ROM_128_0_OFFS i32 (i32.const 0x02_4000))
(global $ROM_128_0_OFFS_H i32 (i32.const 0x02_6000))

;; ZX Spectrum 128 ROM 1 (0x4000 bytes)
(global $ROM_128_1_OFFS i32 (i32.const 0x02_8000))

;; ZX Spectrum +3 ROM 0 (0x4000 bytes)
(global $ROM_P3_0_OFFS i32 (i32.const 0x02_C000))

;; ZX Spectrum +3 ROM 1 (0x4000 bytes)
(global $ROM_P3_1_OFFS i32 (i32.const 0x03_0000))

;; ZX Spectrum +3 ROM 2 (0x4000 bytes)
(global $ROM_P3_2_OFFS i32 (i32.const 0x03_4000))

;; ZX Spectrum +3 ROM 3 (0x4000 bytes)
(global $ROM_P3_3_OFFS i32 (i32.const 0x03_8000))

;; ----------------------------------------------------------------------------
;; ZX Spectrum buffers

;; ZX Spectrum execution cyle options (256 bytes)
(global $EXEC_OPTIONS_BUFF i32 (i32.const 0x0122_0000))

;; Keyboard line status (128 bytes)
(global $KEYBOARD_LINES i32 (i32.const 0x0122_0100))

;; Page index table for addressing memory (24 bytes)
(global $PAGE_INDEX_16 i32 (i32.const 0x0122_0180))

;; Rendering tact table (0x6_0000 bytes)
;; Each table entry has 5 bytes:
;; Byte 0: 
;;   Bit 4..0: Rendering phase
;;     0x00: None. The ULA does not do any rendering.
;;     0x04: Border. The ULA sets the border color to display the current pixel.
;;     0x05: BorderFetchPixel. The ULA sets the border color to display the
;;           current pixel. It prepares to display the fist pixel in the row
;;           with pre-fetching the corresponding byte from the display memory.
;;     0x06: BorderFetchAttr. The ULA sets the border color to display the
;;           current pixel. It has already fetched the 8 pixel bits to display.
;;           It carries on preparing to display the fist pixel in the row with
;;           pre-fetching the corresponding attribute byte from the display memory.
;;     0x08: DisplayB1. The ULA displays the next two pixels of Byte1 sequentially
;;           during a single Z80 clock cycle.
;;     0x09: DisplayB1FetchB2. The ULA displays the next two pixels of Byte1
;;           sequentially during a single Z80 clock cycle. It prepares to display
;;           the pixels of the next byte in the row with pre-fetching the
;;           corresponding byte from the display memory.
;;     0x0a: DisplayB1FetchA2. The ULA displays the next two pixels of Byte1
;;           sequentially during a single Z80 clock cycle. It prepares to display
;;           the pixels of the next byte in the row with pre-fetching the
;;           corresponding attribute from the display memory.
;;     0x10: DisplayB2. The ULA displays the next two pixels of Byte2 sequentially
;;           during a single Z80 clock cycle.
;;     0x11: DisplayB2FetchB1. The ULA displays the next two pixels of Byte2
;;           sequentially during a single Z80 clock cycle. It prepares to display
;;           the pixels of the next byte in the row with pre-fetching the
;;           corresponding byte from the display memory.
;;     0x12: DisplayB2FetchA1. The ULA displays the next two pixels of Byte2
;;           sequentially during a single Z80 clock cycle. It prepares to display
;;           the pixels of the next byte in the row with pre-fetching the
;;           corresponding attribute from the display memory.
;;   Bit 7..5: Tact contention value
;; Byte 1..2: Pixel address
;; Byte 3..4: Attribute address
(global $RENDERING_TACT_TABLE i32 (i32.const 0x0122_0200))

;; Contention value table (0x1_4000 bytes)
(global $CONTENTION_TABLE i32 (i32.const 0x0128_0200))

;; Paper color bytes, flash off (256 bytes)
(global $PAPER_COLORS_OFF_TABLE i32 (i32.const 0x0129_4200))

;; Ink color bytes, flash off (256 bytes)
(global $INK_COLORS_OFF_TABLE i32 (i32.const 0x0129_4300))

;; Paper color bytes, flash on (256 bytes)
(global $PAPER_COLORS_ON_TABLE i32 (i32.const 0x0129_4400))

;; Ink color bytes, flash on (256 bytes)
(global $INK_COLORS_ON_TABLE i32 (i32.const 0x0129_4500))

;; ZX Spectrum 48 palette (256 byte)
(global $SPECTRUM_PALETTE i32 (i32.const 0x0129_4600))

;; Pixel rendering buffer (0x2_8000 bytes)
(global $PIXEL_RENDERING_BUFFER i32 (i32.const 0x0129_4700))

;; Buffer for pixel colorization (0xA_0000 bytes)
(global $COLORIZATION_BUFFER i32 (i32.const 0x012B_C700))

;; Beeper sample rendering buffer (0x2000 bytes)
(global $BEEPER_SAMPLE_BUFFER i32 (i32.const 0x0135_C700))

;; Sound sample rendering buffer (0x2000 bytes)
(global $PSG_SAMPLE_BUFFER i32 (i32.const 0x0135_E700))

;; Tape block buffer (0xA_0000 bytes)
(global $TAPE_DATA_BUFFER i32 (i32.const 0x0136_0700))

;; Tape save buffer (0x1_0000 bytes)
(global $TAPE_SAVE_BUFFER i32 (i32.const 0x0140_0700))

;; ----------------------------------------------------------------------------
;; Sound generation

;; PSG Register area: 0x23_2F00 (256 bytes)
(global $PSG_REGS i32 (i32.const 0x0141_4B00))

;; Envelop tables for PSG sound generation (0x800 bytes)
(global $PSG_ENVELOP_TABLE i32 (i32.const 0x0141_4C00))

;; PSG volumes (16 words)
(global $PSG_VOLUME_TABLE i32 (i32.const 0x0141_5300))
