;; ==========================================================================
;; Z80 test machine buffers

;; Test I/O input buffer (256 bytes)
(global $TEST_INPUT_OFFS i32 (i32.const 0x0122_0000))

;; Test memory access log (0x400 bytes)
(global $TEST_MEM_LOG_OFFS i32 (i32.const 0x0122_0100))

;; Test I/O access log (0x400 bytes)
(global $TEST_IO_LOG_OFFS i32 (i32.const 0x0122_0500))

;; Test TbBlue access log (0x400 bytes)
(global $TEST_TBBLUE_LOG_OFFS i32 (i32.const 0x0122_0900))

;; ----------------------------------------------------------------------------
;; RAM banks

;; 128K RAM. These are the RAM banks of ZS Spectrum 128/+3
;; Also, the first 3 banks are used as the RAM of ZX Spectrum 48K
(global $BANK_0_OFFS i32 (i32.const 0x00_0000))
(global $BANK_1_OFFS i32 (i32.const 0x00_4000))
(global $BANK_2_OFFS i32 (i32.const 0x00_8000))
(global $BANK_3_OFFS i32 (i32.const 0x00_C000))
(global $BANK_4_OFFS i32 (i32.const 0x01_0000))
(global $BANK_5_OFFS i32 (i32.const 0x01_4000))
(global $BANK_6_OFFS i32 (i32.const 0x01_8000))
(global $BANK_7_OFFS i32 (i32.const 0x01_C000))
