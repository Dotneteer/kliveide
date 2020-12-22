;; ==========================================================================
;; Common mappings for all machine types

;; ----------------------------------------------------------------------------
;; Memory area reserved for all Z80-based virtual machines (16MB)
(global $VM_MEMORY i32 (i32.const 0x0000_0000))

;; ----------------------------------------------------------------------------
;; CPU diagnostics area

;; Memory write information map (64K x 2 bytes)
(global $MEM_WR_MAP i32 (i32.const 0x0100_0000))

;; Memory read information map (64K x 2 bytes)
(global $MEM_RD_MAP i32 (i32.const 0x0102_0000))

;; Instruction read information map (64K x 2 bytes)
(global $INSTR_RD_MAP i32 (i32.const 0x0104_0000))

;; ----------------------------------------------------------------------------
;; Breakpoints area

;; Breakpoints map (64K x 1 byte)
(global $BREAKPOINTS_MAP i32 (i32.const 0x0106_0000))

;; Breakpoint partitions map (64K x 2 bytes)
(global $BRP_PARTITION_MAP i32 (i32.const 0x0107_0000))

;; Memory read breakpoints conditions map (64K x 5 bytes)
(global $MEM_RD_CONDITIONS_MAP i32 (i32.const 0x0109_0000))

;; Memory write breakpoints conditions map (64K x 5 bytes)
(global $MEM_WR_CONDITIONS_MAP i32 (i32.const 0x010E_0000))

;; I/O breakpoints condition map (64K x 1 byte)
(global $IO_INDEX_MAP i32 (i32.const 0x0113_0000))

;; I/O breakpoints (32 x 15 bytes)
(global $IO_BREAKPOINTS i32 (i32.const 0x0114_0000))

;; ----------------------------------------------------------------------------
;; Z80 CPU Area

;; Z80 ALU Helper tables

;; INC flags table (256 bytes)
(global $INC_FLAGS i32 (i32.const 0x0120_0000))

;; DEC flags table (256 bytes)
(global $DEC_FLAGS i32 (i32.const 0x0120_0100))

;; Logic operations flags table (256 bytes)
(global $LOG_FLAGS i32 (i32.const 0x0120_0200))

;; RLC flags table (256 bytes)
(global $RLC_FLAGS i32 (i32.const 0x0120_0300))

;; RRC flags table (256 bytes)
(global $RRC_FLAGS i32 (i32.const 0x0120_0400))

;; RL flags (no carry) table (256 bytes)
(global $RL0_FLAGS i32 (i32.const 0x0120_0500))

;; RL flags (carry set) table (256 bytes)
(global $RL1_FLAGS i32 (i32.const 0x0120_0600))

;; RR flags (no carry) table (256 bytes)
(global $RR0_FLAGS i32 (i32.const 0x0120_0700))

;; RR flags (carry set) table (256 bytes)
(global $RR1_FLAGS i32 (i32.const 0x0120_0800))

;; SRA flags table (256 bytes)
(global $SRA_FLAGS i32 (i32.const 0x0120_0900))

;; SZ53 flags table (256 bytes)
(global $SZ53_FLAGS i32 (i32.const 0x0120_0A00))

;; SZ53P flags table (256 bytes)
(global $SZ53P_FLAGS i32 (i32.const 0x0120_0B00))

;; Parity table (256 bytes)
(global $PAR_FLAGS i32 (i32.const 0x0120_0C00))

;; Overflow ADD table (8 bytes)
(global $OVF_ADD i32 (i32.const 0x0120_0D00))

;; Overflow SUB table (8 bytes)
(global $OVF_SUB i32 (i32.const 0x0120_0D10))

;; Half-carry ADD table (8 bytes)
(global $HC_ADD i32 (i32.const 0x0120_0D20))

;; Half-carry SUB table (8 bytes)
(global $HC_SUB i32 (i32.const 0x0120_0D30))

;; ----------------------------------------------------------------------------
;; Z80 CPU + State transfer area

;; Z80 registers (32 byte)
;; The index of the register area (length: 0x1c)
(global $REG_AREA_INDEX i32 (i32.const 0x0120_0E00))

;; Z80 8-bit register index conversion table (8 bytes)
(global $REG8_TAB_OFFS i32 (i32.const 0x0120_0E20))

;; Z80 16-bit register index conversion table (4 bytes)
(global $REG16_TAB_OFFS i32 (i32.const 0x0120_0E30))

;; State transfer buffer between WA and JS (0x672 bytes)
(global $STATE_TRANSFER_BUFF i32 (i32.const 0x0120_0E60))

;; ----------------------------------------------------------------------------
;; Engine infrastructure

;; Breakpoints map (0x2000 bytes)
(global $BREAKPOINT_MAP i32 (i32.const 0x0120_2000))

;; Breakpoint pages map (0x01_0000 bytes)
(global $BREAKPOINT_PAGES_MAP i32 (i32.const 0x0120_4000))

;; Memory write map (0x2000 bytes)
(global $MEMWRITE_MAP i32 (i32.const 0x0121_4000))

;; Code read map (0x2000 bytes)
(global $CODE_READ_MAP i32 (i32.const 0x0121_6000))

;; Memory read map (0x2000 bytes)
(global $MEMREAD_MAP i32 (i32.const 0x0121_8000))

;; Step-out stack (1024 bytes)
(global $STEP_OUT_STACK i32 (i32.const 0x0121_A000))

;; Lookpu table for 8K memory blocks (128 bytes)
(global $BLOCK_LOOKUP_TABLE i32 (i32.const 0x0121_A400))

;; Machine-specific memory: 0x0122_0000
