;; ============================================================================
;; Memory structure
;; We keep 2048 KB of memory
(memory (export "memory") 40)

;; ==========================================================================
;; New memory map structure

;; ----------------------------------------------------------------------------
;; RAM banks

;; 128K RAM. These are the RAM banks of ZS Spectrum 123/+3
;; Also, the first 3 banks are used as the RAM of ZX Spectrum 48K
(global $BANK_0_OFFS i32 (i32.const 0x00_0000))
(global $BANK_1_OFFS i32 (i32.const 0x00_4000))
(global $BANK_2_OFFS i32 (i32.const 0x00_8000))
(global $BANK_3_OFFS i32 (i32.const 0x00_C000))
(global $BANK_4_OFFS i32 (i32.const 0x01_0000))
(global $BANK_5_OFFS i32 (i32.const 0x01_4000))
(global $BANK_6_OFFS i32 (i32.const 0x01_8000))
(global $BANK_7_OFFS i32 (i32.const 0x01_C000))

;; ----------------------------------------------------------------------------
;; ROM pages

;; ZX Spectrum 48K ROM (0x4000 bytes)
(global $ROM_48_OFFS i32 (i32.const 0x02_0000))

;; ZX Spectrum 128 ROM 0 (0x4000 bytes)
(global $ROM_128_0_OFFS i32 (i32.const 0x02_4000))

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
;; ALU Helper tables

;; INC flags table (256 bytes)
(global $INC_FLAGS i32 (i32.const 0x03_C000))

;; DEC flags table (256 bytes)
(global $DEC_FLAGS i32 (i32.const 0x03_C100))

;; Logic operations flags table (256 bytes)
(global $LOG_FLAGS i32 (i32.const 0x03_C200))

;; RLC flags table (256 bytes)
(global $RLC_FLAGS i32 (i32.const 0x03_C300))

;; RRC flags table (256 bytes)
(global $RRC_FLAGS i32 (i32.const 0x03_C400))

;; RL flags (no carry) table (256 bytes)
(global $RL0_FLAGS i32 (i32.const 0x03_C500))

;; RL flags (carry set) table (256 bytes)
(global $RL1_FLAGS i32 (i32.const 0x03_C600))

;; RR flags (no carry) table (256 bytes)
(global $RR0_FLAGS i32 (i32.const 0x03_C700))

;; RR flags (carry set) table (256 bytes)
(global $RR1_FLAGS i32 (i32.const 0x03_C800))

;; SRA flags table (256 bytes)
(global $SRA_FLAGS i32 (i32.const 0x03_C900))

;; DAA flags table (0x800 bytes)
(global $DAA_FLAGS i32 (i32.const 0x03_CA00))

;; ----------------------------------------------------------------------------
;; Z80 CPU + State transfer area

;; Z80 registers (32 byte)
;; The index of the register area (length: 0x1c)
(global $REG_AREA_INDEX i32 (i32.const 0x03_D200))

;; Z80 8-bit register index conversion table
(global $REG8_TAB_OFFS i32 (i32.const 0x03_D220))

;; Z80 16-bit register index conversion table
(global $REG16_TAB_OFFS i32 (i32.const 0x03_D228))

;; Page index table for addressing memory
(global $PAGE_INDEX_16 i32 (i32.const 0x03_D240))

;; State transfer buffer between WA and JS (0x380 bytes)
(global $STATE_TRANSFER_BUFF i32 (i32.const 0x03_D280))

;; ----------------------------------------------------------------------------
;; Test machine buffers

;; Test I/O input buffer (256 bytes)
(global $TEST_INPUT_OFFS i32 (i32.const 0x03_D600))

;; Test memory access log (0x400 bytes)
(global $TEST_MEM_LOG_OFFS i32 (i32.const 0x03_DA00))

;; Test I/O access log (0x400 bytes)
(global $TEST_IO_LOG_OFFS i32 (i32.const 0x03_DE00))

;; Test TbBlue access log (0x400 bytes)
(global $TEST_TBBLUE_LOG_OFFS i32 (i32.const 0x03_E200))

;; ----------------------------------------------------------------------------
;; ZX Spectrum buffers

;; ZX Spectrum execution cyle options (256 bytes)
(global $EXEC_OPTIONS_BUFF i32 (i32.const 0x03_E600))

;; Keyboard line status (256 bytes)
(global $KEYBOARD_LINES i32 (i32.const 0x03_E700))

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
(global $RENDERING_TACT_TABLE i32 (i32.const 0x03_E800))

;; Contention value table (0x1_4000 bytes)
(global $CONTENTION_TABLE i32 (i32.const 0x09_E800))

;; Paper color bytes, flash off (256 bytes)
(global $PAPER_COLORS_OFF_TABLE i32 (i32.const 0x0B_2800))

;; Ink color bytes, flash off (256 bytes)
(global $INK_COLORS_OFF_TABLE i32 (i32.const 0x0B_2900))

;; Paper color bytes, flash on (256 bytes)
(global $PAPER_COLORS_ON_TABLE i32 (i32.const 0x0B_2A00))

;; Ink color bytes, flash on (256 bytes)
(global $INK_COLORS_ON_TABLE i32 (i32.const 0x0B_2B00))

;; ZX Spectrum 48 palette (256 byte)
(global $SPECTRUM_PALETTE i32 (i32.const 0x0B_2C00))

;; Pixel rendering buffer (0x2_8000 bytes)
(global $PIXEL_RENDERING_BUFFER i32 (i32.const 0x0B_2D00))

;; Buffer for pixel colorization (0xA_0000 bytes)
(global $COLORIZATION_BUFFER i32 (i32.const 0x0D_AD00))

;; Beeper sample rendering buffer (0x2000 bytes)
(global $BEEPER_SAMPLE_BUFFER i32 (i32.const 0x17_AD00))

;; Sound sample rendering buffer (0x2000 bytes)
(global $PSG_SAMPLE_BUFFER i32 (i32.const 0x17_CD00))

;; Tape block buffer (0xA_0000 bytes)
(global $TAPE_DATA_BUFFER i32 (i32.const 0x17_ED00))

;; Tape save buffer (0x1_0000 bytes)
(global $TAPE_SAVE_BUFFER i32 (i32.const 0x21_ED00))

;; ----------------------------------------------------------------------------
;; ZX Spectrun debug support maps

;; Breakpoints map (0x2000 bytes)
(global $BREAKPOINT_MAP i32 (i32.const 0x22_ED00))

;; Memory write map map (0x2000 bytes)
(global $MEMWRITE_MAP i32 (i32.const 0x23_0D00))

;; Step-out stack (512 bytes)
(global $STEP_OUT_STACK i32 (i32.const 0x23_2D00))

;; Next free slot: 0x23_2F00

