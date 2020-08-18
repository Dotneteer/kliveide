;; ============================================================================
;; Memory structure
;; We keep 2048 KB of memory
(memory (export "memory") 40)

;; ==========================================================================
;; Memory map

;; *
;; 0x01_0000 (64 bytes): Z80 registers
;; The index of the register area (length: 0x1c)
(global $REG_AREA_INDEX i32 (i32.const 0x01_0000))

;; *
;; 0x01_0020 (8 bytes): Z80 8-bit register index conversion table
(global $REG8_TAB_OFFS i32 (i32.const 0x01_0020))
(data (i32.const 0x01_0020) "\03\02\05\04\07\06\00\01")

;; *
;; 0x01_0028 (4 bytes): Z80 16-bit register index conversion table
(global $REG16_TAB_OFFS i32 (i32.const 0x01_0028))
(data (i32.const 0x01_0028) "\02\04\06\14")

;; *
;; 0x01_0040 (448 bytes): State transfer buffer (between WA and JS)
(global $STATE_TRANSFER_BUFF i32 (i32.const 0x01_0040))

;; *
;; 0x01_0200 (256 bytes): Test I/O input buffer
(global $TEST_INPUT_OFFS i32 (i32.const 0x01_0200))

;; *
;; 0x01_0300 (1024 bytes): Test memory access log
(global $TEST_MEM_LOG_OFFS i32 (i32.const 0x01_0300))

;; *
;; 0x01_0700 (1024 bytes): Test I/O access log
(global $TEST_IO_LOG_OFFS i32 (i32.const 0x01_0700))

;; *
;; 0x01_0b00 (1024 bytes): Test TbBlue access log
(global $TEST_TBBLUE_LOG_OFFS i32 (i32.const 0x01_0b00))

;; ***
;; 0x01_0f00 (256 bytes): INC flags table
(global $INC_FLAGS i32 (i32.const 0x01_0f00))
(data (i32.const 0x01_0f00) "\00\00\00\00\00\00\00\08\08\08\08\08\08\08\08\10\00\00\00\00\00\00\00\08\08\08\08\08\08\08\08\30\20\20\20\20\20\20\20\28\28\28\28\28\28\28\28\30\20\20\20\20\20\20\20\28\28\28\28\28\28\28\28\10\00\00\00\00\00\00\00\08\08\08\08\08\08\08\08\10\00\00\00\00\00\00\00\08\08\08\08\08\08\08\08\30\20\20\20\20\20\20\20\28\28\28\28\28\28\28\28\30\20\20\20\20\20\20\20\28\28\28\28\28\28\28\28\94\80\80\80\80\80\80\80\88\88\88\88\88\88\88\88\90\80\80\80\80\80\80\80\88\88\88\88\88\88\88\88\b0\a0\a0\a0\a0\a0\a0\a0\a8\a8\a8\a8\a8\a8\a8\a8\b0\a0\a0\a0\a0\a0\a0\a0\a8\a8\a8\a8\a8\a8\a8\a8\90\80\80\80\80\80\80\80\88\88\88\88\88\88\88\88\90\80\80\80\80\80\80\80\88\88\88\88\88\88\88\88\b0\a0\a0\a0\a0\a0\a0\a0\a8\a8\a8\a8\a8\a8\a8\a8\b0\a0\a0\a0\a0\a0\a0\a0\a8\a8\a8\a8\a8\a8\a8\a8\50")

;; ***
;; 0x01_1000 (256 bytes): DEC flags table
(global $DEC_FLAGS i32 (i32.const 0x01_1000))
(data (i32.const 0x01_1000) "\ba\42\02\02\02\02\02\02\02\0a\0a\0a\0a\0a\0a\0a\1a\02\02\02\02\02\02\02\02\0a\0a\0a\0a\0a\0a\0a\1a\22\22\22\22\22\22\22\22\2a\2a\2a\2a\2a\2a\2a\3a\22\22\22\22\22\22\22\22\2a\2a\2a\2a\2a\2a\2a\3a\02\02\02\02\02\02\02\02\0a\0a\0a\0a\0a\0a\0a\1a\02\02\02\02\02\02\02\02\0a\0a\0a\0a\0a\0a\0a\1a\22\22\22\22\22\22\22\22\2a\2a\2a\2a\2a\2a\2a\3a\22\22\22\22\22\22\22\22\2a\2a\2a\2a\2a\2a\2a\3e\82\82\82\82\82\82\82\82\8a\8a\8a\8a\8a\8a\8a\9a\82\82\82\82\82\82\82\82\8a\8a\8a\8a\8a\8a\8a\9a\a2\a2\a2\a2\a2\a2\a2\a2\aa\aa\aa\aa\aa\aa\aa\ba\a2\a2\a2\a2\a2\a2\a2\a2\aa\aa\aa\aa\aa\aa\aa\ba\82\82\82\82\82\82\82\82\8a\8a\8a\8a\8a\8a\8a\9a\82\82\82\82\82\82\82\82\8a\8a\8a\8a\8a\8a\8a\9a\a2\a2\a2\a2\a2\a2\a2\a2\aa\aa\aa\aa\aa\aa\aa\ba\a2\a2\a2\a2\a2\a2\a2\a2\aa\aa\aa\aa\aa\aa\aa")

;; ***
;; 0x01_1100 (256 bytes): Logic operations flags table
(global $LOG_FLAGS i32 (i32.const 0x01_1100))
(data (i32.const 0x01_1100) "\44\00\00\04\00\04\04\00\08\0c\0c\08\0c\08\08\0c\00\04\04\00\04\00\00\04\0c\08\08\0c\08\0c\0c\08\20\24\24\20\24\20\20\24\2c\28\28\2c\28\2c\2c\28\24\20\20\24\20\24\24\20\28\2c\2c\28\2c\28\28\2c\00\04\04\00\04\00\00\04\0c\08\08\0c\08\0c\0c\08\04\00\00\04\00\04\04\00\08\0c\0c\08\0c\08\08\0c\24\20\20\24\20\24\24\20\28\2c\2c\28\2c\28\28\2c\20\24\24\20\24\20\20\24\2c\28\28\2c\28\2c\2c\28\80\84\84\80\84\80\80\84\8c\88\88\8c\88\8c\8c\88\84\80\80\84\80\84\84\80\88\8c\8c\88\8c\88\88\8c\a4\a0\a0\a4\a0\a4\a4\a0\a8\ac\ac\a8\ac\a8\a8\ac\a0\a4\a4\a0\a4\a0\a0\a4\ac\a8\a8\ac\a8\ac\ac\a8\84\80\80\84\80\84\84\80\88\8c\8c\88\8c\88\88\8c\80\84\84\80\84\80\80\84\8c\88\88\8c\88\8c\8c\88\a0\a4\a4\a0\a4\a0\a0\a4\ac\a8\a8\ac\a8\ac\ac\a8\a4\a0\a0\a4\a0\a4\a4\a0\a8\ac\ac\a8\ac\a8\a8\ac")

;; ***
;; 0x01_1200 (256 bytes): RLC flags table
(global $RLC_FLAGS i32 (i32.const 0x01_1200))
(data (i32.const 0x01_1200) "\44\00\00\04\08\0c\0c\08\00\04\04\00\0c\08\08\0c\20\24\24\20\2c\28\28\2c\24\20\20\24\28\2c\2c\28\00\04\04\00\0c\08\08\0c\04\00\00\04\08\0c\0c\08\24\20\20\24\28\2c\2c\28\20\24\24\20\2c\28\28\2c\80\84\84\80\8c\88\88\8c\84\80\80\84\88\8c\8c\88\a4\a0\a0\a4\a8\ac\ac\a8\a0\a4\a4\a0\ac\a8\a8\ac\84\80\80\84\88\8c\8c\88\80\84\84\80\8c\88\88\8c\a0\a4\a4\a0\ac\a8\a8\ac\a4\a0\a0\a4\a8\ac\ac\a8\01\05\05\01\0d\09\09\0d\05\01\01\05\09\0d\0d\09\25\21\21\25\29\2d\2d\29\21\25\25\21\2d\29\29\2d\05\01\01\05\09\0d\0d\09\01\05\05\01\0d\09\09\0d\21\25\25\21\2d\29\29\2d\25\21\21\25\29\2d\2d\29\85\81\81\85\89\8d\8d\89\81\85\85\81\8d\89\89\8d\a1\a5\a5\a1\ad\a9\a9\ad\a5\a1\a1\a5\a9\ad\ad\a9\81\85\85\81\8d\89\89\8d\85\81\81\85\89\8d\8d\89\a5\a1\a1\a5\a9\ad\ad\a9\a1\a5\a5\a1\ad\a9\a9\ad")

;; ***
;; 0x01_1300 (256 bytes): RRC flags table
(global $RRC_FLAGS i32 (i32.const 0x01_1300))
(data (i32.const 0x01_1300) "\44\81\00\85\00\85\04\81\00\85\04\81\04\81\00\85\08\8d\0c\89\0c\89\08\8d\0c\89\08\8d\08\8d\0c\89\00\85\04\81\04\81\00\85\04\81\00\85\00\85\04\81\0c\89\08\8d\08\8d\0c\89\08\8d\0c\89\0c\89\08\8d\20\a5\24\a1\24\a1\20\a5\24\a1\20\a5\20\a5\24\a1\2c\a9\28\ad\28\ad\2c\a9\28\ad\2c\a9\2c\a9\28\ad\24\a1\20\a5\20\a5\24\a1\20\a5\24\a1\24\a1\20\a5\28\ad\2c\a9\2c\a9\28\ad\2c\a9\28\ad\28\ad\2c\a9\00\85\04\81\04\81\00\85\04\81\00\85\00\85\04\81\0c\89\08\8d\08\8d\0c\89\08\8d\0c\89\0c\89\08\8d\04\81\00\85\00\85\04\81\00\85\04\81\04\81\00\85\08\8d\0c\89\0c\89\08\8d\0c\89\08\8d\08\8d\0c\89\24\a1\20\a5\20\a5\24\a1\20\a5\24\a1\24\a1\20\a5\28\ad\2c\a9\2c\a9\28\ad\2c\a9\28\ad\28\ad\2c\a9\20\a5\24\a1\24\a1\20\a5\24\a1\20\a5\20\a5\24\a1\2c\a9\28\ad\28\ad\2c\a9\28\ad\2c\a9\2c\a9\28\ad")

;; ***
;; 0x01_1400 (256 bytes): RL flags (no carry) table
(global $RL0_FLAGS i32 (i32.const 0x01_1400))
(data (i32.const 0x01_1400) "\44\00\00\04\08\0c\0c\08\00\04\04\00\0c\08\08\0c\20\24\24\20\2c\28\28\2c\24\20\20\24\28\2c\2c\28\00\04\04\00\0c\08\08\0c\04\00\00\04\08\0c\0c\08\24\20\20\24\28\2c\2c\28\20\24\24\20\2c\28\28\2c\80\84\84\80\8c\88\88\8c\84\80\80\84\88\8c\8c\88\a4\a0\a0\a4\a8\ac\ac\a8\a0\a4\a4\a0\ac\a8\a8\ac\84\80\80\84\88\8c\8c\88\80\84\84\80\8c\88\88\8c\a0\a4\a4\a0\ac\a8\a8\ac\a4\a0\a0\a4\a8\ac\ac\a8\45\01\01\05\09\0d\0d\09\01\05\05\01\0d\09\09\0d\21\25\25\21\2d\29\29\2d\25\21\21\25\29\2d\2d\29\01\05\05\01\0d\09\09\0d\05\01\01\05\09\0d\0d\09\25\21\21\25\29\2d\2d\29\21\25\25\21\2d\29\29\2d\81\85\85\81\8d\89\89\8d\85\81\81\85\89\8d\8d\89\a5\a1\a1\a5\a9\ad\ad\a9\a1\a5\a5\a1\ad\a9\a9\ad\85\81\81\85\89\8d\8d\89\81\85\85\81\8d\89\89\8d\a1\a5\a5\a1\ad\a9\a9\ad\a5\a1\a1\a5\a9\ad\ad\a9")

;; ***
;; 0x01_1500 (256 bytes): RL flags (carry set) table
(global $RL1_FLAGS i32 (i32.const 0x01_1500))
(data (i32.const 0x01_1500) "\00\04\04\00\0c\08\08\0c\04\00\00\04\08\0c\0c\08\24\20\20\24\28\2c\2c\28\20\24\24\20\2c\28\28\2c\04\00\00\04\08\0c\0c\08\00\04\04\00\0c\08\08\0c\20\24\24\20\2c\28\28\2c\24\20\20\24\28\2c\2c\28\84\80\80\84\88\8c\8c\88\80\84\84\80\8c\88\88\8c\a0\a4\a4\a0\ac\a8\a8\ac\a4\a0\a0\a4\a8\ac\ac\a8\80\84\84\80\8c\88\88\8c\84\80\80\84\88\8c\8c\88\a4\a0\a0\a4\a8\ac\ac\a8\a0\a4\a4\a0\ac\a8\a8\ac\01\05\05\01\0d\09\09\0d\05\01\01\05\09\0d\0d\09\25\21\21\25\29\2d\2d\29\21\25\25\21\2d\29\29\2d\05\01\01\05\09\0d\0d\09\01\05\05\01\0d\09\09\0d\21\25\25\21\2d\29\29\2d\25\21\21\25\29\2d\2d\29\85\81\81\85\89\8d\8d\89\81\85\85\81\8d\89\89\8d\a1\a5\a5\a1\ad\a9\a9\ad\a5\a1\a1\a5\a9\ad\ad\a9\81\85\85\81\8d\89\89\8d\85\81\81\85\89\8d\8d\89\a5\a1\a1\a5\a9\ad\ad\a9\a1\a5\a5\a1\ad\a9\a9\ad")

;; ***
;; 0x01_1600 (256 bytes): RR flags (no carry) table
(global $RR0_FLAGS i32 (i32.const 0x01_1600))
(data (i32.const 0x01_1600) "\44\45\00\01\00\01\04\05\00\01\04\05\04\05\00\01\08\09\0c\0d\0c\0d\08\09\0c\0d\08\09\08\09\0c\0d\00\01\04\05\04\05\00\01\04\05\00\01\00\01\04\05\0c\0d\08\09\08\09\0c\0d\08\09\0c\0d\0c\0d\08\09\20\21\24\25\24\25\20\21\24\25\20\21\20\21\24\25\2c\2d\28\29\28\29\2c\2d\28\29\2c\2d\2c\2d\28\29\24\25\20\21\20\21\24\25\20\21\24\25\24\25\20\21\28\29\2c\2d\2c\2d\28\29\2c\2d\28\29\28\29\2c\2d\00\01\04\05\04\05\00\01\04\05\00\01\00\01\04\05\0c\0d\08\09\08\09\0c\0d\08\09\0c\0d\0c\0d\08\09\04\05\00\01\00\01\04\05\00\01\04\05\04\05\00\01\08\09\0c\0d\0c\0d\08\09\0c\0d\08\09\08\09\0c\0d\24\25\20\21\20\21\24\25\20\21\24\25\24\25\20\21\28\29\2c\2d\2c\2d\28\29\2c\2d\28\29\28\29\2c\2d\20\21\24\25\24\25\20\21\24\25\20\21\20\21\24\25\2c\2d\28\29\28\29\2c\2d\28\29\2c\2d\2c\2d\28\29")

;; ***
;; 0x01_1700 (256 bytes): RR flags (carry set) table
(global $RR1_FLAGS i32 (i32.const 0x01_1700))
(data (i32.const 0x01_1700) "\80\81\84\85\84\85\80\81\84\85\80\81\80\81\84\85\8c\8d\88\89\88\89\8c\8d\88\89\8c\8d\8c\8d\88\89\84\85\80\81\80\81\84\85\80\81\84\85\84\85\80\81\88\89\8c\8d\8c\8d\88\89\8c\8d\88\89\88\89\8c\8d\a4\a5\a0\a1\a0\a1\a4\a5\a0\a1\a4\a5\a4\a5\a0\a1\a8\a9\ac\ad\ac\ad\a8\a9\ac\ad\a8\a9\a8\a9\ac\ad\a0\a1\a4\a5\a4\a5\a0\a1\a4\a5\a0\a1\a0\a1\a4\a5\ac\ad\a8\a9\a8\a9\ac\ad\a8\a9\ac\ad\ac\ad\a8\a9\84\85\80\81\80\81\84\85\80\81\84\85\84\85\80\81\88\89\8c\8d\8c\8d\88\89\8c\8d\88\89\88\89\8c\8d\80\81\84\85\84\85\80\81\84\85\80\81\80\81\84\85\8c\8d\88\89\88\89\8c\8d\88\89\8c\8d\8c\8d\88\89\a0\a1\a4\a5\a4\a5\a0\a1\a4\a5\a0\a1\a0\a1\a4\a5\ac\ad\a8\a9\a8\a9\ac\ad\a8\a9\ac\ad\ac\ad\a8\a9\a4\a5\a0\a1\a0\a1\a4\a5\a0\a1\a4\a5\a4\a5\a0\a1\a8\a9\ac\ad\ac\ad\a8\a9\ac\ad\a8\a9\a8\a9\ac\ad")

;; ***
;; 0x01_1800 (256 bytes): SRA flags table
(global $SRA_FLAGS i32 (i32.const 0x01_1800))
(data (i32.const 0x01_1800) "\44\45\00\01\00\01\04\05\00\01\04\05\04\05\00\01\08\09\0c\0d\0c\0d\08\09\0c\0d\08\09\08\09\0c\0d\00\01\04\05\04\05\00\01\04\05\00\01\00\01\04\05\0c\0d\08\09\08\09\0c\0d\08\09\0c\0d\0c\0d\08\09\20\21\24\25\24\25\20\21\24\25\20\21\20\21\24\25\2c\2d\28\29\28\29\2c\2d\28\29\2c\2d\2c\2d\28\29\24\25\20\21\20\21\24\25\20\21\24\25\24\25\20\21\28\29\2c\2d\2c\2d\28\29\2c\2d\28\29\28\29\2c\2d\84\85\80\81\80\81\84\85\80\81\84\85\84\85\80\81\88\89\8c\8d\8c\8d\88\89\8c\8d\88\89\88\89\8c\8d\80\81\84\85\84\85\80\81\84\85\80\81\80\81\84\85\8c\8d\88\89\88\89\8c\8d\88\89\8c\8d\8c\8d\88\89\a0\a1\a4\a5\a4\a5\a0\a1\a4\a5\a0\a1\a0\a1\a4\a5\ac\ad\a8\a9\a8\a9\ac\ad\a8\a9\ac\ad\ac\ad\a8\a9\a4\a5\a0\a1\a0\a1\a4\a5\a0\a1\a4\a5\a4\a5\a0\a1\a8\a9\ac\ad\ac\ad\a8\a9\ac\ad\a8\a9\a8\a9\ac\ad")

;; ***
;; 0x01_1900 (1024 bytes): ZX Spectrum execution cyle options
(global $EXEC_OPTIONS_BUFF i32 (i32.const 0x01_1900))

;; ***
;; 0x01_1D00 (16384 bytes): ZX Spectrum 48 ROM
(global $SPECTRUM_48_ROM_INDEX i32 (i32.const 0x01_1D00))

;; ***
;; 0x01_5D00 (256 bytes): Keyboard line status
(global $KEYBOARD_LINES i32 (i32.const 0x01_5D00))

;; ***
;; 0x01_5E00 (0x6_0000 bytes): Rendering tact table
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
(global $RENDERING_TACT_TABLE i32 (i32.const 0x01_5E00))

;; ***
;; 0x07_5E00 (0x1_4000 bytes): Contention value table
(global $CONTENTION_TABLE i32 (i32.const 0x07_5E00))

;; ***
;; 0x08_9E00 (256 bytes): Paper color bytes (flash off)
(global $PAPER_COLORS_OFF_TABLE i32 (i32.const 0x08_9E00))
(data (i32.const 0x08_9E00) "\00\00\00\00\00\00\00\00\01\01\01\01\01\01\01\01\02\02\02\02\02\02\02\02\03\03\03\03\03\03\03\03\04\04\04\04\04\04\04\04\05\05\05\05\05\05\05\05\06\06\06\06\06\06\06\06\07\07\07\07\07\07\07\07\08\08\08\08\08\08\08\08\09\09\09\09\09\09\09\09\0a\0a\0a\0a\0a\0a\0a\0a\0b\0b\0b\0b\0b\0b\0b\0b\0c\0c\0c\0c\0c\0c\0c\0c\0d\0d\0d\0d\0d\0d\0d\0d\0e\0e\0e\0e\0e\0e\0e\0e\0f\0f\0f\0f\0f\0f\0f\0f\00\00\00\00\00\00\00\00\01\01\01\01\01\01\01\01\02\02\02\02\02\02\02\02\03\03\03\03\03\03\03\03\04\04\04\04\04\04\04\04\05\05\05\05\05\05\05\05\06\06\06\06\06\06\06\06\07\07\07\07\07\07\07\07\08\08\08\08\08\08\08\08\09\09\09\09\09\09\09\09\0a\0a\0a\0a\0a\0a\0a\0a\0b\0b\0b\0b\0b\0b\0b\0b\0c\0c\0c\0c\0c\0c\0c\0c\0d\0d\0d\0d\0d\0d\0d\0d\0e\0e\0e\0e\0e\0e\0e\0e\0f\0f\0f\0f\0f\0f\0f\0f")

;; ***
;; 0x08_9F00 (256 bytes): Ink color bytes (flash off)
(global $INK_COLORS_OFF_TABLE i32 (i32.const 0x08_9F00))
(data (i32.const 0x08_9F00) "\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f")

;; ***
;; 0x08_A000 (256 bytes): Paper color bytes (flash on)
(global $PAPER_COLORS_ON_TABLE i32 (i32.const 0x08_A000))
(data (i32.const 0x08_A000) "\00\00\00\00\00\00\00\00\01\01\01\01\01\01\01\01\02\02\02\02\02\02\02\02\03\03\03\03\03\03\03\03\04\04\04\04\04\04\04\04\05\05\05\05\05\05\05\05\06\06\06\06\06\06\06\06\07\07\07\07\07\07\07\07\08\08\08\08\08\08\08\08\09\09\09\09\09\09\09\09\0a\0a\0a\0a\0a\0a\0a\0a\0b\0b\0b\0b\0b\0b\0b\0b\0c\0c\0c\0c\0c\0c\0c\0c\0d\0d\0d\0d\0d\0d\0d\0d\0e\0e\0e\0e\0e\0e\0e\0e\0f\0f\0f\0f\0f\0f\0f\0f\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f")

;; ***
;; 0x08_A100 (256 bytes): Ink color bytes (flash on)
(global $INK_COLORS_ON_TABLE i32 (i32.const 0x08_A100))
(data (i32.const 0x08_A100) "\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\00\00\00\00\00\00\00\00\01\01\01\01\01\01\01\01\02\02\02\02\02\02\02\02\03\03\03\03\03\03\03\03\04\04\04\04\04\04\04\04\05\05\05\05\05\05\05\05\06\06\06\06\06\06\06\06\07\07\07\07\07\07\07\07\08\08\08\08\08\08\08\08\09\09\09\09\09\09\09\09\0a\0a\0a\0a\0a\0a\0a\0a\0b\0b\0b\0b\0b\0b\0b\0b\0c\0c\0c\0c\0c\0c\0c\0c\0d\0d\0d\0d\0d\0d\0d\0d\0e\0e\0e\0e\0e\0e\0e\0e\0f\0f\0f\0f\0f\0f\0f\0f")

;; ***
;; 0x08_A200 (0x2_8000 bytes): Pixel rendering buffer
(global $PIXEL_RENDERING_BUFFER i32 (i32.const 0x08_A200))

;; ***
;; 0x0B_2200 (0x2000 bytes): Beeper sample rendering buffer
(global $BEEPER_SAMPLE_BUFFER i32 (i32.const 0x0B_2200))

;; ***
;; 0x0B_4200 (0xA_0000 bytes): Buffer for pixel colorization
(global $COLORIZATION_BUFFER i32 (i32.const 0x0B_4200))

;; ***
;; 0x15_4200 ZX Spectrum 48 palette
(global $SPECTRUM_PALETTE i32 (i32.const 0x15_4200))
(data (i32.const 0x15_4200) "\00\00\00\ff\00\00\aa\ff\aa\00\00\ff\aa\00\aa\ff\00\aa\00\ff\00\aa\aa\ff\aa\aa\00\ff\aa\aa\aa\ff\00\00\00\ff\00\00\ff\ff\ff\00\00\ff\ff\00\ff\ff\00\ff\00\ff\00\ff\ff\ff\ff\ff\00\ff\ff\ff\ff\ff")

;; ***
;; 0x15_4300 (0xA_0000 bytes): Tape block buffer
(global $TAPE_DATA_BUFFER i32 (i32.const 0x15_4300))

;; ***
;; 0x1F_4300 Breakpoints map
(global $BREAKPOINT_MAP i32 (i32.const 0x1F_4300))

;; ***
;; 0x1F_6300 (512 bytes): Step-out stack
(global $STEP_OUT_STACK i32 (i32.const 0x1F_6300))

;; ***
;; 0x1F_6500 Memory write map map
(global $MEMWRITE_MAP i32 (i32.const 0x1F_6500))

;; 0x1F_8500 Next free slot



;; ============================================================================
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
(global $INC_FLAGS_NEW i32 (i32.const 0x03_C000))

;; DEC flags table (256 bytes)
(global $DEC_FLAGS_NEW i32 (i32.const 0x03_C100))

;; Logic operations flags table (256 bytes)
(global $LOG_FLAGS_NEW i32 (i32.const 0x03_C200))

;; RLC flags table (256 bytes)
(global $RLC_FLAGS_NEW i32 (i32.const 0x03_C300))

;; RRC flags table (256 bytes)
(global $RRC_FLAGS_NEW i32 (i32.const 0x03_C400))

;; RL flags (no carry) table (256 bytes)
(global $RL0_FLAGS_NEW i32 (i32.const 0x03_C500))

;; RL flags (carry set) table (256 bytes)
(global $RL1_FLAGS_NEW i32 (i32.const 0x03_C600))

;; RR flags (no carry) table (256 bytes)
(global $RR0_FLAGS_NEW i32 (i32.const 0x03_C700))

;; RR flags (carry set) table (256 bytes)
(global $RR1_FLAGS_NEW i32 (i32.const 0x03_C800))

;; SRA flags table (256 bytes)
(global $SRA_FLAGS_NEW i32 (i32.const 0x03_C900))

;; DAA flags table (0x800 bytes)
(global $DAA_FLAGS i32 (i32.const 0x03_CA00))

;; ADC flags table (0x2_0000) bytes
(global $ADC_FLAGS i32 (i32.const 0x03_D200))

;; SBC flags table (0x2_0000) bytes
(global $SBC_FLAGS i32 (i32.const 0x05_D200))

;; ----------------------------------------------------------------------------
;; Z80 CPU + State transfer area

;; Z80 registers (32 byte)
;; The index of the register area (length: 0x1c)
(global $REG_AREA_INDEX_NEW i32 (i32.const 0x07_D200))

;; Z80 8-bit register index conversion table
(global $REG8_TAB_OFFS_NEW i32 (i32.const 0x07_D220))

;; Z80 16-bit register index conversion table
(global $REG16_TAB_OFFS_NEW i32 (i32.const 0x07_D228))

;; State transfer buffer between WA and JS (0x3C0 bytes)
(global $STATE_TRANSFER_BUFF_NEW i32 (i32.const 0x07_D240))

;; ----------------------------------------------------------------------------
;; Test machine buffers

;; Test I/O input buffer (256 bytes)
(global $TEST_INPUT_OFFS_NEW i32 (i32.const 0x07_D600))

;; Test memory access log (0x400 bytes)
(global $TEST_MEM_LOG_OFFS_NEW i32 (i32.const 0x07_DA00))

;; Test I/O access log (0x400 bytes)
(global $TEST_IO_LOG_OFFS_NEW i32 (i32.const 0x07_DE00))

;; Test TbBlue access log (0x400 bytes)
(global $TEST_TBBLUE_LOG_OFFS_NEW i32 (i32.const 0x07_E200))

;; ----------------------------------------------------------------------------
;; ZX Spectrum buffers

;; ZX Spectrum execution cyle options (256 bytes)
(global $EXEC_OPTIONS_BUFF_NEW i32 (i32.const 0x07_E600))

;; Keyboard line status (256 bytes)
(global $KEYBOARD_LINES_NEW i32 (i32.const 0x07_E700))

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
(global $RENDERING_TACT_TABLE_NEW i32 (i32.const 0x07_E800))

;; Contention value table (0x1_4000 bytes)
(global $CONTENTION_TABLE_NEW i32 (i32.const 0x0D_E800))

;; Paper color bytes, flash off (256 bytes)
(global $PAPER_COLORS_OFF_TABLE_NEW i32 (i32.const 0x0F_2800))

;; Ink color bytes, flash off (256 bytes)
(global $INK_COLORS_OFF_TABLE_NEW i32 (i32.const 0x0F_2900))

;; Paper color bytes, flash on (256 bytes)
(global $PAPER_COLORS_ON_TABLE_NEW i32 (i32.const 0x0F_2A00))

;; Ink color bytes, flash on (256 bytes)
(global $INK_COLORS_ON_TABLE_NEW i32 (i32.const 0x0F_2B00))

;; ZX Spectrum 48 palette (256 byte)
(global $SPECTRUM_PALETTE_NEW i32 (i32.const 0x0F_2C00))

;; Pixel rendering buffer (0x2_8000 bytes)
(global $PIXEL_RENDERING_BUFFER_NEW i32 (i32.const 0x0F_2D00))

;; Buffer for pixel colorization (0xA_0000 bytes)
(global $COLORIZATION_BUFFER_NEW i32 (i32.const 0x0F_5500))

;; Beeper sample rendering buffer (0x2000 bytes)
(global $BEEPER_SAMPLE_BUFFER_NEW i32 (i32.const 0x19_5500))

;; Sound sample rendering buffer (0x2000 bytes)
(global $PSG_SAMPLE_BUFFER_NEW i32 (i32.const 0x19_7500))

;; Tape block buffer (0xA_0000 bytes)
(global $TAPE_DATA_BUFFER_NEW i32 (i32.const 0x19_9500))

;; Tape save buffer (0x1_0000 bytes)
(global $TAPE_SAVE_BUFFER_NEW i32 (i32.const 0x23_9500))

;; ----------------------------------------------------------------------------
;; ZX Spectrun debug support maps

;; Breakpoints map (0x2000 bytes)
(global $BREAKPOINT_MAP_NEW i32 (i32.const 0x24_9500))

;; Memory write map map (0x2000 bytes)
(global $MEMWRITE_MAP_NEW i32 (i32.const 0x24_B500))

;; Step-out stack (512 bytes)
(global $STEP_OUT_STACK_NEW i32 (i32.const 0x24_D500))

;; Next free slot: 0x24_D700

