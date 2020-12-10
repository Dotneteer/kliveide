;; ==========================================================================
;; This file contains the core of the Z80 engine

;; --------------------------------------------------------------------------
;; CPU State signal flags
;;
;; $SIG_NONE# = 0x00      // No signal
;; $SIG_INT# = 0x01       // Interrupt
;; $SIG_NMI# = 0x02       // Non-maskable interrupt
;; $SIG_RST# = 0x04       // Reset
;; $SIG_HLT# = 0x08       // Halt
;; $SIG_INT_MASK# = 0xfe  // Halt mask
;; $SIG_HLT_MASK# = 0xf7  // Halt mask
;;
;; $PREF_NONE# = 0        // No prefix
;; $PREF_EXT# = 1         // Extended mode (0xED prefix)
;; $PREF_BIT# = 2         // Bit mode (0xCB prefix)
;;
;; $IND_NONE# = 0         // No index
;; $IND_IX# = 1            // IX (0xDD prefix)
;; $IND_IY# = 2            // IY (0xFD prefix)
;;
;; --------------------------------------------------------------------------
;; Z80 CPU state

;; CPU registers
;; We keep only PC and SP as global variables.
(global $PC (mut i32) (i32.const 0x00))
(global $SP (mut i32) (i32.const 0x00))

;; Other register are stored in the memory starting at the $$REG_AREA_INDEX 
;; as 8-bit registers. With WA memory access functions they can by addressed
;; quickly. These are their offsets:
;; 00: F
;; 01: A
;; 02: C
;; 03: B
;; 04: E
;; 05: D
;; 06: L
;; 07: H
;; 08: AF'
;; 10: BC'
;; 12: DE'
;; 14: HL'
;; 16: I
;; 17: R
;; 18: 16 bits reserved for PC (not used)
;; 20: 16 bits reserved for SP (not used)
;; 22: IX
;; 24: IY
;; 26: WZ
;; 28: Q: internal register where Z80 assembles the new content of the
;;        F register, before moving it back to F. The behaviour is 
;;        deterministic in Zilog Z80 and nondeterministic in NEC Z80.

;; Number of tacts within one screen rendering frame. This value indicates the
;; number of clock cycles with normal CPU speed.
(global $tactsInFrame (mut i32) (i32.const 1_000_000))

;; Indicates if ZX Spectrum Next extended Z80 operation set is enabled
(global $allowExtendedSet (mut i32) (i32.const 0x00))  ;; 

;; CPU tacts since starting the last screen rendering frame. So this variable is reset
;; at the beginning of each screen rendering frame.
(global $tacts (mut i32) (i32.const 0x0000))

;; Various Z80 state flags
(global $cpuSignalFlags (mut i32) (i32.const 0x00))

;; Should use ZX Spectrum +3 gate array contention?
(global $useGateArrayContention (mut i32) (i32.const 0x0000))

;; Interrupt flip-flop #1
(global $iff1 (mut i32) (i32.const 0x00))

;; Interrupt flip-flop #2
(global $iff2 (mut i32) (i32.const 0x00))

;; Current interrupt mode
(global $interruptMode (mut i32) (i32.const 0x00)) 

;; Current interrupt block. While we're within executing an operation, interrupt is blocked.
(global $isInterruptBlocked (mut i32) (i32.const 0x00)) 

;; Is the CPU currently within processing an instruction?
(global $isInOpExecution (mut i32) (i32.const 0x00))

;; Current operation prefix mode
;; 0: No prefix
;; 1: Extended mode (0xED prefix)
;; 2: Bit mode (0xCB prefix)
(global $prefixMode (mut i32) (i32.const 0x00))

;; Current operation index mode
;; 0: No index
;; 1: IX (0xDD prefix)
;; 2: IY (0xFD prefix)
(global $indexMode (mut i32) (i32.const 0x00)) 

;; Signs that CPU entered into maskable interrupt mode
(global $maskableInterruptModeEntered (mut i32) (i32.const 0x00))

;; Operation code being processed
(global $opCode (mut i32) (i32.const 0x00))

;; CPU diagnostics flags
(global $cpuDiagnostics (mut i32) (i32.const 0x00))

;; ----------------------------------------------------------------------------
;; ALU helper tables

;; INC flags table (256 bytes)
(data (i32.const 0x0120_0000) "\00\00\00\00\00\00\00\08\08\08\08\08\08\08\08\10\00\00\00\00\00\00\00\08\08\08\08\08\08\08\08\30\20\20\20\20\20\20\20\28\28\28\28\28\28\28\28\30\20\20\20\20\20\20\20\28\28\28\28\28\28\28\28\10\00\00\00\00\00\00\00\08\08\08\08\08\08\08\08\10\00\00\00\00\00\00\00\08\08\08\08\08\08\08\08\30\20\20\20\20\20\20\20\28\28\28\28\28\28\28\28\30\20\20\20\20\20\20\20\28\28\28\28\28\28\28\28\94\80\80\80\80\80\80\80\88\88\88\88\88\88\88\88\90\80\80\80\80\80\80\80\88\88\88\88\88\88\88\88\b0\a0\a0\a0\a0\a0\a0\a0\a8\a8\a8\a8\a8\a8\a8\a8\b0\a0\a0\a0\a0\a0\a0\a0\a8\a8\a8\a8\a8\a8\a8\a8\90\80\80\80\80\80\80\80\88\88\88\88\88\88\88\88\90\80\80\80\80\80\80\80\88\88\88\88\88\88\88\88\b0\a0\a0\a0\a0\a0\a0\a0\a8\a8\a8\a8\a8\a8\a8\a8\b0\a0\a0\a0\a0\a0\a0\a0\a8\a8\a8\a8\a8\a8\a8\a8\50")

;; DEC flags table
(data (i32.const 0x0120_0100) "\ba\42\02\02\02\02\02\02\02\0a\0a\0a\0a\0a\0a\0a\1a\02\02\02\02\02\02\02\02\0a\0a\0a\0a\0a\0a\0a\1a\22\22\22\22\22\22\22\22\2a\2a\2a\2a\2a\2a\2a\3a\22\22\22\22\22\22\22\22\2a\2a\2a\2a\2a\2a\2a\3a\02\02\02\02\02\02\02\02\0a\0a\0a\0a\0a\0a\0a\1a\02\02\02\02\02\02\02\02\0a\0a\0a\0a\0a\0a\0a\1a\22\22\22\22\22\22\22\22\2a\2a\2a\2a\2a\2a\2a\3a\22\22\22\22\22\22\22\22\2a\2a\2a\2a\2a\2a\2a\3e\82\82\82\82\82\82\82\82\8a\8a\8a\8a\8a\8a\8a\9a\82\82\82\82\82\82\82\82\8a\8a\8a\8a\8a\8a\8a\9a\a2\a2\a2\a2\a2\a2\a2\a2\aa\aa\aa\aa\aa\aa\aa\ba\a2\a2\a2\a2\a2\a2\a2\a2\aa\aa\aa\aa\aa\aa\aa\ba\82\82\82\82\82\82\82\82\8a\8a\8a\8a\8a\8a\8a\9a\82\82\82\82\82\82\82\82\8a\8a\8a\8a\8a\8a\8a\9a\a2\a2\a2\a2\a2\a2\a2\a2\aa\aa\aa\aa\aa\aa\aa\ba\a2\a2\a2\a2\a2\a2\a2\a2\aa\aa\aa\aa\aa\aa\aa")

;; Logic operations flags table
(data (i32.const 0x0120_0200) "\44\00\00\04\00\04\04\00\08\0c\0c\08\0c\08\08\0c\00\04\04\00\04\00\00\04\0c\08\08\0c\08\0c\0c\08\20\24\24\20\24\20\20\24\2c\28\28\2c\28\2c\2c\28\24\20\20\24\20\24\24\20\28\2c\2c\28\2c\28\28\2c\00\04\04\00\04\00\00\04\0c\08\08\0c\08\0c\0c\08\04\00\00\04\00\04\04\00\08\0c\0c\08\0c\08\08\0c\24\20\20\24\20\24\24\20\28\2c\2c\28\2c\28\28\2c\20\24\24\20\24\20\20\24\2c\28\28\2c\28\2c\2c\28\80\84\84\80\84\80\80\84\8c\88\88\8c\88\8c\8c\88\84\80\80\84\80\84\84\80\88\8c\8c\88\8c\88\88\8c\a4\a0\a0\a4\a0\a4\a4\a0\a8\ac\ac\a8\ac\a8\a8\ac\a0\a4\a4\a0\a4\a0\a0\a4\ac\a8\a8\ac\a8\ac\ac\a8\84\80\80\84\80\84\84\80\88\8c\8c\88\8c\88\88\8c\80\84\84\80\84\80\80\84\8c\88\88\8c\88\8c\8c\88\a0\a4\a4\a0\a4\a0\a0\a4\ac\a8\a8\ac\a8\ac\ac\a8\a4\a0\a0\a4\a0\a4\a4\a0\a8\ac\ac\a8\ac\a8\a8\ac")

;; RLC flags table
(data (i32.const 0x0120_0300) "\44\00\00\04\08\0c\0c\08\00\04\04\00\0c\08\08\0c\20\24\24\20\2c\28\28\2c\24\20\20\24\28\2c\2c\28\00\04\04\00\0c\08\08\0c\04\00\00\04\08\0c\0c\08\24\20\20\24\28\2c\2c\28\20\24\24\20\2c\28\28\2c\80\84\84\80\8c\88\88\8c\84\80\80\84\88\8c\8c\88\a4\a0\a0\a4\a8\ac\ac\a8\a0\a4\a4\a0\ac\a8\a8\ac\84\80\80\84\88\8c\8c\88\80\84\84\80\8c\88\88\8c\a0\a4\a4\a0\ac\a8\a8\ac\a4\a0\a0\a4\a8\ac\ac\a8\01\05\05\01\0d\09\09\0d\05\01\01\05\09\0d\0d\09\25\21\21\25\29\2d\2d\29\21\25\25\21\2d\29\29\2d\05\01\01\05\09\0d\0d\09\01\05\05\01\0d\09\09\0d\21\25\25\21\2d\29\29\2d\25\21\21\25\29\2d\2d\29\85\81\81\85\89\8d\8d\89\81\85\85\81\8d\89\89\8d\a1\a5\a5\a1\ad\a9\a9\ad\a5\a1\a1\a5\a9\ad\ad\a9\81\85\85\81\8d\89\89\8d\85\81\81\85\89\8d\8d\89\a5\a1\a1\a5\a9\ad\ad\a9\a1\a5\a5\a1\ad\a9\a9\ad")

;; RRC flags table
(data (i32.const 0x0120_0400) "\44\81\00\85\00\85\04\81\00\85\04\81\04\81\00\85\08\8d\0c\89\0c\89\08\8d\0c\89\08\8d\08\8d\0c\89\00\85\04\81\04\81\00\85\04\81\00\85\00\85\04\81\0c\89\08\8d\08\8d\0c\89\08\8d\0c\89\0c\89\08\8d\20\a5\24\a1\24\a1\20\a5\24\a1\20\a5\20\a5\24\a1\2c\a9\28\ad\28\ad\2c\a9\28\ad\2c\a9\2c\a9\28\ad\24\a1\20\a5\20\a5\24\a1\20\a5\24\a1\24\a1\20\a5\28\ad\2c\a9\2c\a9\28\ad\2c\a9\28\ad\28\ad\2c\a9\00\85\04\81\04\81\00\85\04\81\00\85\00\85\04\81\0c\89\08\8d\08\8d\0c\89\08\8d\0c\89\0c\89\08\8d\04\81\00\85\00\85\04\81\00\85\04\81\04\81\00\85\08\8d\0c\89\0c\89\08\8d\0c\89\08\8d\08\8d\0c\89\24\a1\20\a5\20\a5\24\a1\20\a5\24\a1\24\a1\20\a5\28\ad\2c\a9\2c\a9\28\ad\2c\a9\28\ad\28\ad\2c\a9\20\a5\24\a1\24\a1\20\a5\24\a1\20\a5\20\a5\24\a1\2c\a9\28\ad\28\ad\2c\a9\28\ad\2c\a9\2c\a9\28\ad")

;; RL flags (no carry) table
(data (i32.const 0x0120_0500) "\44\00\00\04\08\0c\0c\08\00\04\04\00\0c\08\08\0c\20\24\24\20\2c\28\28\2c\24\20\20\24\28\2c\2c\28\00\04\04\00\0c\08\08\0c\04\00\00\04\08\0c\0c\08\24\20\20\24\28\2c\2c\28\20\24\24\20\2c\28\28\2c\80\84\84\80\8c\88\88\8c\84\80\80\84\88\8c\8c\88\a4\a0\a0\a4\a8\ac\ac\a8\a0\a4\a4\a0\ac\a8\a8\ac\84\80\80\84\88\8c\8c\88\80\84\84\80\8c\88\88\8c\a0\a4\a4\a0\ac\a8\a8\ac\a4\a0\a0\a4\a8\ac\ac\a8\45\01\01\05\09\0d\0d\09\01\05\05\01\0d\09\09\0d\21\25\25\21\2d\29\29\2d\25\21\21\25\29\2d\2d\29\01\05\05\01\0d\09\09\0d\05\01\01\05\09\0d\0d\09\25\21\21\25\29\2d\2d\29\21\25\25\21\2d\29\29\2d\81\85\85\81\8d\89\89\8d\85\81\81\85\89\8d\8d\89\a5\a1\a1\a5\a9\ad\ad\a9\a1\a5\a5\a1\ad\a9\a9\ad\85\81\81\85\89\8d\8d\89\81\85\85\81\8d\89\89\8d\a1\a5\a5\a1\ad\a9\a9\ad\a5\a1\a1\a5\a9\ad\ad\a9")

;; RL flags (carry set) table
(data (i32.const 0x0120_0600) "\00\04\04\00\0c\08\08\0c\04\00\00\04\08\0c\0c\08\24\20\20\24\28\2c\2c\28\20\24\24\20\2c\28\28\2c\04\00\00\04\08\0c\0c\08\00\04\04\00\0c\08\08\0c\20\24\24\20\2c\28\28\2c\24\20\20\24\28\2c\2c\28\84\80\80\84\88\8c\8c\88\80\84\84\80\8c\88\88\8c\a0\a4\a4\a0\ac\a8\a8\ac\a4\a0\a0\a4\a8\ac\ac\a8\80\84\84\80\8c\88\88\8c\84\80\80\84\88\8c\8c\88\a4\a0\a0\a4\a8\ac\ac\a8\a0\a4\a4\a0\ac\a8\a8\ac\01\05\05\01\0d\09\09\0d\05\01\01\05\09\0d\0d\09\25\21\21\25\29\2d\2d\29\21\25\25\21\2d\29\29\2d\05\01\01\05\09\0d\0d\09\01\05\05\01\0d\09\09\0d\21\25\25\21\2d\29\29\2d\25\21\21\25\29\2d\2d\29\85\81\81\85\89\8d\8d\89\81\85\85\81\8d\89\89\8d\a1\a5\a5\a1\ad\a9\a9\ad\a5\a1\a1\a5\a9\ad\ad\a9\81\85\85\81\8d\89\89\8d\85\81\81\85\89\8d\8d\89\a5\a1\a1\a5\a9\ad\ad\a9\a1\a5\a5\a1\ad\a9\a9\ad")

;; RR flags (no carry) table
(data (i32.const 0x0120_0700) "\44\45\00\01\00\01\04\05\00\01\04\05\04\05\00\01\08\09\0c\0d\0c\0d\08\09\0c\0d\08\09\08\09\0c\0d\00\01\04\05\04\05\00\01\04\05\00\01\00\01\04\05\0c\0d\08\09\08\09\0c\0d\08\09\0c\0d\0c\0d\08\09\20\21\24\25\24\25\20\21\24\25\20\21\20\21\24\25\2c\2d\28\29\28\29\2c\2d\28\29\2c\2d\2c\2d\28\29\24\25\20\21\20\21\24\25\20\21\24\25\24\25\20\21\28\29\2c\2d\2c\2d\28\29\2c\2d\28\29\28\29\2c\2d\00\01\04\05\04\05\00\01\04\05\00\01\00\01\04\05\0c\0d\08\09\08\09\0c\0d\08\09\0c\0d\0c\0d\08\09\04\05\00\01\00\01\04\05\00\01\04\05\04\05\00\01\08\09\0c\0d\0c\0d\08\09\0c\0d\08\09\08\09\0c\0d\24\25\20\21\20\21\24\25\20\21\24\25\24\25\20\21\28\29\2c\2d\2c\2d\28\29\2c\2d\28\29\28\29\2c\2d\20\21\24\25\24\25\20\21\24\25\20\21\20\21\24\25\2c\2d\28\29\28\29\2c\2d\28\29\2c\2d\2c\2d\28\29")

;; RR flags (carry set) table
(data (i32.const 0x0120_0800) "\80\81\84\85\84\85\80\81\84\85\80\81\80\81\84\85\8c\8d\88\89\88\89\8c\8d\88\89\8c\8d\8c\8d\88\89\84\85\80\81\80\81\84\85\80\81\84\85\84\85\80\81\88\89\8c\8d\8c\8d\88\89\8c\8d\88\89\88\89\8c\8d\a4\a5\a0\a1\a0\a1\a4\a5\a0\a1\a4\a5\a4\a5\a0\a1\a8\a9\ac\ad\ac\ad\a8\a9\ac\ad\a8\a9\a8\a9\ac\ad\a0\a1\a4\a5\a4\a5\a0\a1\a4\a5\a0\a1\a0\a1\a4\a5\ac\ad\a8\a9\a8\a9\ac\ad\a8\a9\ac\ad\ac\ad\a8\a9\84\85\80\81\80\81\84\85\80\81\84\85\84\85\80\81\88\89\8c\8d\8c\8d\88\89\8c\8d\88\89\88\89\8c\8d\80\81\84\85\84\85\80\81\84\85\80\81\80\81\84\85\8c\8d\88\89\88\89\8c\8d\88\89\8c\8d\8c\8d\88\89\a0\a1\a4\a5\a4\a5\a0\a1\a4\a5\a0\a1\a0\a1\a4\a5\ac\ad\a8\a9\a8\a9\ac\ad\a8\a9\ac\ad\ac\ad\a8\a9\a4\a5\a0\a1\a0\a1\a4\a5\a0\a1\a4\a5\a4\a5\a0\a1\a8\a9\ac\ad\ac\ad\a8\a9\ac\ad\a8\a9\a8\a9\ac\ad")

;; SRA flags table
(data (i32.const 0x0120_0900) "\44\45\00\01\00\01\04\05\00\01\04\05\04\05\00\01\08\09\0c\0d\0c\0d\08\09\0c\0d\08\09\08\09\0c\0d\00\01\04\05\04\05\00\01\04\05\00\01\00\01\04\05\0c\0d\08\09\08\09\0c\0d\08\09\0c\0d\0c\0d\08\09\20\21\24\25\24\25\20\21\24\25\20\21\20\21\24\25\2c\2d\28\29\28\29\2c\2d\28\29\2c\2d\2c\2d\28\29\24\25\20\21\20\21\24\25\20\21\24\25\24\25\20\21\28\29\2c\2d\2c\2d\28\29\2c\2d\28\29\28\29\2c\2d\84\85\80\81\80\81\84\85\80\81\84\85\84\85\80\81\88\89\8c\8d\8c\8d\88\89\8c\8d\88\89\88\89\8c\8d\80\81\84\85\84\85\80\81\84\85\80\81\80\81\84\85\8c\8d\88\89\88\89\8c\8d\88\89\8c\8d\8c\8d\88\89\a0\a1\a4\a5\a4\a5\a0\a1\a4\a5\a0\a1\a0\a1\a4\a5\ac\ad\a8\a9\a8\a9\ac\ad\a8\a9\ac\ad\ac\ad\a8\a9\a4\a5\a0\a1\a0\a1\a4\a5\a0\a1\a4\a5\a4\a5\a0\a1\a8\a9\ac\ad\ac\ad\a8\a9\ac\ad\a8\a9\a8\a9\ac\ad")

;; SZ53 flags table (256 bytes)
(data (i32.const 0x0120_0A00) "\40\00\00\00\00\00\00\00\08\08\08\08\08\08\08\08\00\00\00\00\00\00\00\00\08\08\08\08\08\08\08\08\20\20\20\20\20\20\20\20\28\28\28\28\28\28\28\28\20\20\20\20\20\20\20\20\28\28\28\28\28\28\28\28\00\00\00\00\00\00\00\00\08\08\08\08\08\08\08\08\00\00\00\00\00\00\00\00\08\08\08\08\08\08\08\08\20\20\20\20\20\20\20\20\28\28\28\28\28\28\28\28\20\20\20\20\20\20\20\20\28\28\28\28\28\28\28\28\80\80\80\80\80\80\80\80\88\88\88\88\88\88\88\88\80\80\80\80\80\80\80\80\88\88\88\88\88\88\88\88\a0\a0\a0\a0\a0\a0\a0\a0\a8\a8\a8\a8\a8\a8\a8\a8\a0\a0\a0\a0\a0\a0\a0\a0\a8\a8\a8\a8\a8\a8\a8\a8\80\80\80\80\80\80\80\80\88\88\88\88\88\88\88\88\80\80\80\80\80\80\80\80\88\88\88\88\88\88\88\88\a0\a0\a0\a0\a0\a0\a0\a0\a8\a8\a8\a8\a8\a8\a8\a8\a0\a0\a0\a0\a0\a0\a0\a0\a8\a8\a8\a8\a8\a8\a8\a8")

;; SZ53P flags table (256 bytes)
(data (i32.const 0x0120_0B00) "\44\00\00\04\00\04\04\00\08\0c\0c\08\0c\08\08\0c\00\04\04\00\04\00\00\04\0c\08\08\0c\08\0c\0c\08\20\24\24\20\24\20\20\24\2c\28\28\2c\28\2c\2c\28\24\20\20\24\20\24\24\20\28\2c\2c\28\2c\28\28\2c\00\04\04\00\04\00\00\04\0c\08\08\0c\08\0c\0c\08\04\00\00\04\00\04\04\00\08\0c\0c\08\0c\08\08\0c\24\20\20\24\20\24\24\20\28\2c\2c\28\2c\28\28\2c\20\24\24\20\24\20\20\24\2c\28\28\2c\28\2c\2c\28\80\84\84\80\84\80\80\84\8c\88\88\8c\88\8c\8c\88\84\80\80\84\80\84\84\80\88\8c\8c\88\8c\88\88\8c\a4\a0\a0\a4\a0\a4\a4\a0\a8\ac\ac\a8\ac\a8\a8\ac\a0\a4\a4\a0\a4\a0\a0\a4\ac\a8\a8\ac\a8\ac\ac\a8\84\80\80\84\80\84\84\80\88\8c\8c\88\8c\88\88\8c\80\84\84\80\84\80\80\84\8c\88\88\8c\88\8c\8c\88\a0\a4\a4\a0\a4\a0\a0\a4\ac\a8\a8\ac\a8\ac\ac\a8\a4\a0\a0\a4\a0\a4\a4\a0\a8\ac\ac\a8\ac\a8\a8\ac")

;; Overflow ADD table (8 bytes)
(data (i32.const 0x0120_0C00) "\00\00\00\04\04\00\00\00")

;; Overflow SUB table (8 bytes)
(data (i32.const 0x0120_0C10) "\00\04\00\00\00\00\04\00")

;; Half-carry ADD table (8 bytes)
(data (i32.const 0x0120_0C20) "\00\10\10\10\00\00\00\10")

;; Half-carry SUB table (8 bytes)
(data (i32.const 0x0120_0C30) "\00\00\10\00\10\00\10\10")

;; ----------------------------------------------------------------------------
;; Register index conversion tables

;; Z80 8-bit register index conversion table
(data (i32.const 0x0120_0D20) "\03\02\05\04\07\06\00\01")

;; Z80 16-bit register index conversion table
(data (i32.const 0x0120_0D30) "\02\04\06\14")

;; Writes the CPU state to the transfer area so that the JavaScript code
;; can read it. This method copies only the registers that are stored in global
;; variables. When the JavaScript side retrieves register values, it uses
;; the memory directly.
(func $getCpuState
  ;; Registers
  (i32.store8 offset=0 (get_global $STATE_TRANSFER_BUFF) (call $getF))
  (i32.store8 offset=1 (get_global $STATE_TRANSFER_BUFF) (call $getA))
  (i32.store16 offset=18 (get_global $STATE_TRANSFER_BUFF) (get_global $PC))
  (i32.store16 offset=20 (get_global $STATE_TRANSFER_BUFF) (get_global $SP))

  ;; Other CPU state variables
  (i32.store offset=28 (get_global $STATE_TRANSFER_BUFF) (get_global $tactsInFrame))
  (i32.store8 offset=32 (get_global $STATE_TRANSFER_BUFF) (get_global $allowExtendedSet))
  (i32.store offset=33 (get_global $STATE_TRANSFER_BUFF) (get_global $tacts))
  (i32.store8 offset=37 (get_global $STATE_TRANSFER_BUFF) (get_global $cpuSignalFlags))
  (i32.store8 offset=38 (get_global $STATE_TRANSFER_BUFF) (get_global $useGateArrayContention))
  (i32.store8 offset=39 (get_global $STATE_TRANSFER_BUFF) (get_global $iff1))
  (i32.store8 offset=40 (get_global $STATE_TRANSFER_BUFF) (get_global $iff2))
  (i32.store8 offset=41 (get_global $STATE_TRANSFER_BUFF) (get_global $interruptMode))
  (i32.store8 offset=42 (get_global $STATE_TRANSFER_BUFF) (get_global $isInterruptBlocked))
  (i32.store8 offset=43 (get_global $STATE_TRANSFER_BUFF) (get_global $isInOpExecution))
  (i32.store8 offset=44 (get_global $STATE_TRANSFER_BUFF) (get_global $prefixMode))
  (i32.store8 offset=45 (get_global $STATE_TRANSFER_BUFF) (get_global $indexMode))
  (i32.store8 offset=46 (get_global $STATE_TRANSFER_BUFF) (get_global $maskableInterruptModeEntered))
  (i32.store8 offset=47 (get_global $STATE_TRANSFER_BUFF) (get_global $opCode))

  ;; CPU configuration
  (i32.store offset=48 (get_global $STATE_TRANSFER_BUFF) (get_global $baseClockFrequency))      
  (i32.store8 offset=52 (get_global $STATE_TRANSFER_BUFF) (get_global $clockMultiplier))      
  (i32.store8 offset=53 (get_global $STATE_TRANSFER_BUFF) (get_global $supportsNextOperation))  

  ;; Other CPU-related information    
  (i32.store8 offset=54 (get_global $STATE_TRANSFER_BUFF) (get_global $cpuDiagnostics))      
)

;; Restores the CPU state from the transfer area. This method copies register values
;; to global variables. The JavaScript side copies other register values directly to
;; the memory.
(func $updateCpuState
  ;; Registers
  (call $setF (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=0))
  (call $setA (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=1))

  (set_global $PC (get_global $STATE_TRANSFER_BUFF) (i32.load16_u offset=18))
  (set_global $SP (get_global $STATE_TRANSFER_BUFF) (i32.load16_u offset=20))

  ;; Other CPU state variables
  (set_global $tactsInFrame (get_global $STATE_TRANSFER_BUFF) (i32.load offset=28))
  (set_global $allowExtendedSet (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=32))
  (set_global $tacts (get_global $STATE_TRANSFER_BUFF) (i32.load offset=33))
  (set_global $cpuSignalFlags (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=37))
  (set_global $useGateArrayContention (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=38))
  (set_global $iff1 (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=39))
  (set_global $iff2 (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=40))
  (set_global $interruptMode (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=41))
  (set_global $isInterruptBlocked (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=42))
  (set_global $isInOpExecution (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=43))
  (set_global $prefixMode (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=44))
  (set_global $indexMode (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=45))
  (set_global $maskableInterruptModeEntered (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=46))
  (set_global $opCode (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=47))
)

;; Sets the CPU diagnostics flags
(func $setCpuDiagnostics (param $flags i32)
  (set_global $cpuDiagnostics (get_local $flags))
)

;; ----------------------------------------------------------------------------
;; Z80 CPU registers access

;; Gets the value of A
(func $getA (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=1
)

;; Sets the value of A
(func $setA (param $v i32)
  (i32.store8 offset=1 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of F
(func $getF (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=0
)

;; Sets the value of F
(func $setF (param $v i32)
  (i32.store8 offset=0 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of AF
(func $getAF (result i32)
  get_global $REG_AREA_INDEX i32.load16_u offset=0
)

;; Sets the value of AF
(func $setAF (param $v i32)
  (i32.store16 offset=0 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of B
(func $getB (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=3
)

;; Sets the value of B
(func $setB (param $v i32)
  (i32.store8 offset=3 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of C
(func $getC (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=2
)

;; Sets the value of C
(func $setC (param $v i32)
  (i32.store8 offset=2 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of BC
(func $getBC (result i32)
  get_global $REG_AREA_INDEX i32.load16_u offset=2
)

;; Sets the value of BC
(func $setBC (param $v i32)
  (i32.store16 offset=2 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of D
(func $getD (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=5
)

;; Sets the value of D
(func $setD (param $v i32)
  (i32.store8 offset=5 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of E
(func $getE (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=4
)

;; Sets the value of E
(func $setE (param $v i32)
  (i32.store8 offset=4 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of DE
(func $getDE (result i32)
  get_global $REG_AREA_INDEX i32.load16_u offset=4
)

;; Sets the value of DE
(func $setDE (param $v i32)
  (i32.store16 offset=4 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of H
(func $getH (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=7
)

;; Sets the value of H
(func $setH (param $v i32)
  (i32.store8 offset=7 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of L
(func $getL (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=6
)

;; Sets the value of L
(func $setL (param $v i32)
  (i32.store8 offset=6 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of HL
(func $getHL (result i32)
  get_global $REG_AREA_INDEX i32.load16_u offset=6
)

;; Sets the value of HL
(func $setHL (param $v i32)
  (i32.store16 offset=6 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of I
(func $getI (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=16
)

;; Sets the value of I
(func $setI (param $v i32)
  (i32.store8 offset=16 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of R
(func $getR (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=17
)

;; Sets the value of R
(func $setR (param $v i32)
  (i32.store8 offset=17 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of IR
(func $getIR (result i32)
  get_global $REG_AREA_INDEX i32.load16_u offset=16
)

;; Sets the value of PC
(func $setPC (param $v i32)
  (set_global $PC (i32.and (get_local $v) (i32.const 0xffff)))
)

;; Sets the value of SP
(func $setSP (param $v i32)
  (set_global $SP (i32.and (get_local $v) (i32.const 0xffff)))
)

;; Gets the value of XH
(func $getXH (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=23
)

;; Sets the value of XH
(func $setXH (param $v i32)
  (i32.store8 offset=23 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of XL
(func $getXL (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=22
)

;; Sets the value of XL
(func $setXL (param $v i32)
  (i32.store8 offset=22 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of IX
(func $getIX (result i32)
  get_global $REG_AREA_INDEX i32.load16_u offset=22
)

;; Sets the value of IX
(func $setIX (param $v i32)
  (i32.store16 offset=22 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of YH
(func $getYH (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=25
)

;; Sets the value of YH
(func $setYH (param $v i32)
  (i32.store8 offset=25 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of YL
(func $getYL (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=24
)

;; Sets the value of YL
(func $setYL (param $v i32)
  (i32.store8 offset=24 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of IY
(func $getIY (result i32)
  get_global $REG_AREA_INDEX i32.load16_u offset=24
)

;; Sets the value of IY
(func $setIY (param $v i32)
  (i32.store16 offset=24 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of WH
(func $getWH (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=27
)

;; Sets the value of WH
(func $setWH (param $v i32)
  (i32.store8 offset=27 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of WL
(func $getWL (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=26
)

;; Sets the value of WL
(func $setWL (param $v i32)
  (i32.store8 offset=26 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of WZ
(func $getWZ (result i32)
  get_global $REG_AREA_INDEX i32.load16_u offset=26
)

;; Sets the value of WZ
(func $setWZ (param $v i32)
  (i32.store16 offset=26 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of Q
(func $getQ (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=28
)

;; Sets the value of Q
(func $setQ (param $v i32)
  (i32.store8 offset=28 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the specified 8-bit register
;; $r: Register index from 0-7: B, C, D, E, H, L, F, A
;; returns: 8-bit register value
(func $getReg8 (param $r i32) (result i32)
  (i32.eq (get_local $r) (i32.const 0x07))
  if
    call $getA
    return
  end

  get_global $REG_AREA_INDEX

  ;; Convert 8-bit register index to offset
  get_global $REG8_TAB_OFFS
  (i32.and (get_local $r) (i32.const 0x07))
  i32.add
  i32.load8_u

  ;; Load 8-bit register from memory
  i32.add
  i32.load8_u
)

;; Sets the specified 8-bit register
;; $r: Register index from 0-7: B, C, D, E, H, L, F, A
(func $setReg8 (param $r i32) (param $v i32)
  (i32.eq (get_local $r) (i32.const 0x07))
  if
    get_local $v
    (call $setA (i32.and (i32.const 0xff)))
    return
  end

  get_global $REG_AREA_INDEX

  ;; Convert 8-bit register index to offset
  get_global $REG8_TAB_OFFS
  (i32.and (get_local $r) (i32.const 0x07))
  i32.add
  i32.load8_u

  ;; Store register to memory
  i32.add
  get_local $v
  i32.store8
)

;; Gets the specified 16-bit register
;; $r: Register index from 0-3: BC, DE, HL, SP
;; returns: 8-bit register value
(func $getReg16 (param $r i32) (result i32)
  get_global $REG_AREA_INDEX
  
  ;; Convert 16-bit register index to offset
  get_global $REG16_TAB_OFFS
  (i32.and (get_local $r) (i32.const 0x03))
  i32.add
  i32.load8_u

  ;; Load register from memory
  i32.add
  i32.load16_u
)

;; Sets the specified 16-bit register
;; $r: Register index from 0-3: BC, DE, HL, SP
(func $setReg16 (param $r i32) (param $v i32)
  get_global $REG_AREA_INDEX
  
  ;; Convert 16-bit register index to offset
  get_global $REG16_TAB_OFFS
  (i32.and (get_local $r) (i32.const 0x03))
  i32.add
  i32.load8_u

  ;; Store register tomemory
  i32.add
  get_local $v
  i32.store16
)

;; Sets the current index mode
;; $im: Index mode: 1: IX; other: IY
(func $setIndexMode (param $im i32)
  get_local $im
  set_global $indexMode
)

;; Gets the value of the index register according to the current indexing mode
(func $getIndexReg (result i32)
  (i32.eq (get_global $indexMode) (i32.const $IND_IX#))
  if (result i32)
    get_global $REG_AREA_INDEX i32.load16_u offset=22 ;; IX
  else
    get_global $REG_AREA_INDEX i32.load16_u offset=24 ;; IY
  end
)

;; Sets the value of the index register according to the current indexing mode
;; $v: 16-bit index register value
(func $setIndexReg (param $v i32)
  (i32.eq (get_global $indexMode) (i32.const $IND_IX#))
  if
    (i32.store16 offset=22 (get_global $REG_AREA_INDEX) (get_local $v)) ;; IX
  else
    (i32.store16 offset=24 (get_global $REG_AREA_INDEX) (get_local $v)) ;; IY
  end
)

;; ----------------------------------------------------------------------------
;; Z80 clock management

;; Increments the current frame tact with the specified value
;; $inc: Increment
(func $incTacts (param $inc i32)
  (i32.add (get_global $tacts) (get_local $inc))
  set_global $tacts
)

;; ----------------------------------------------------------------------------
;; Z80 CPU life cycle methods

;; Turns on the CPU
(func $turnOnCpu
  i32.const 0xff call $setA
  i32.const 0xff call $setF
  i32.const 0xffff set_global $PC
  i32.const 0xffff set_global $SP
  (i32.store16 offset=0 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=2 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=4 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=6 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=8 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=10 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=12 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=14 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=16 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=18 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=20 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=22 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=24 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=26 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  i32.const 0x0000 set_global $tacts
  i32.const $SIG_NONE# set_global $cpuSignalFlags
  i32.const 0x0000 set_global $useGateArrayContention
  i32.const 0x0000 set_global $iff1
  i32.const 0x0000 set_global $iff2
  i32.const 0x0000 set_global $interruptMode
  i32.const 0x0000 set_global $isInterruptBlocked
  i32.const 0x0000 set_global $isInOpExecution
  i32.const $PREF_NONE# set_global $prefixMode
  i32.const $IND_NONE# set_global $indexMode
  i32.const 0x0000 set_global $maskableInterruptModeEntered
  i32.const 0x0000 set_global $opCode
)

;; Enables/disables extended instruction set
;; $f: True, enable; false, disable
(func $enableExtendedInstructions (param $f i32)
  get_local $f
  set_global $allowExtendedSet
)

;; ----------------------------------------------------------------------------
;; Execution cycle methods

;; Executes the CPU's processing cycle
(func $executeCpuCycle
  ;; Is there any CPU signal raised?
  call $processCpuSignals

  ;; It's time to process the next op code
  ;; Read it from PC and store in opCode
  call $readCodeMemory
  set_global $opCode
  call $hookOpCodeFetched

  ;; Execute a memory refresh
  call $refreshMemory

  ;; Clear helper debug information
  i32.const 0 set_global $retExecuted

  ;; Test for no prefix
  (i32.eqz (get_global $prefixMode))
  if
    ;; Execute the current operation
    i32.const 0 set_global $isInterruptBlocked
    call $processStandardOrIndexedOperations
    (i32.eq (get_global $isInterruptBlocked) (i32.const 0))
    if
      i32.const $IND_NONE# set_global $indexMode
      i32.const $PREF_NONE# set_global $prefixMode
      i32.const 0 set_global $isInOpExecution
    end
    return
  end

  ;; Branch according to prefix modes
  ;; Test for extended mode
  (i32.eq (get_global $prefixMode) (i32.const $PREF_EXT#))
  if
    i32.const 0 set_global $isInterruptBlocked
    call $processExtendedOperations
    i32.const $IND_NONE# set_global $indexMode
    i32.const $PREF_NONE# set_global $prefixMode
    i32.const 0 set_global $isInOpExecution
    return
  end

  ;; Branch according to prefix modes
  ;; Test for bit mode
  (i32.eq (get_global $prefixMode) (i32.const $PREF_BIT#))
  if
    i32.const 0 set_global $isInterruptBlocked
    call $processBitOperations
    i32.const $IND_NONE# set_global $indexMode
    i32.const $PREF_NONE# set_global $prefixMode
    i32.const 0 set_global $isInOpExecution
    return
  end
)

;; Process the CPU signals
;; Returns true, if the signal has been processed; otherwise, false
(func $processCpuSignals
  ;; No signal -- nothing to process
  (i32.eqz (get_global $cpuSignalFlags))
  if return end

  ;; Test for INT
  (i32.and (get_global $cpuSignalFlags) (i32.const $SIG_INT#))
  if
    ;; Test for unblocked interrupt
    (i32.eqz (get_global $isInterruptBlocked))
    if
      get_global $iff1
      if
        call $executeInterrupt
      end
    end
  end

  ;; Test for HLT
  (i32.and (get_global $cpuSignalFlags) (i32.const $SIG_HLT#))
  if
    (call $incTacts (i32.const 3))
    call $refreshMemory
    call $hookHalted
  end

  ;; Test for NMI
  (i32.and (get_global $cpuSignalFlags) (i32.const $SIG_NMI#))
  if
    call $executeNMI
  end

  ;; Test for RST
  (i32.and (get_global $cpuSignalFlags) (i32.const $SIG_RST#))
  if
    call $resetCpu
  end
)

;; Refreshes the memory
(func $refreshMemory
  (local $r i32)
  ;; r := (r + 1) & 0x7f | (r & 0x80)
  call $getR
  tee_local $r
  i32.const 1
  i32.add
  i32.const 0x7f
  i32.and
  get_local $r
  i32.const 0x80
  i32.and
  i32.or
  call $setR
  (call $incTacts (i32.const 1))
)

;; Resets the CPU
(func $resetCpu
  i32.const 0 set_global $iff1
  i32.const 0 set_global $iff2
  i32.const 0 set_global $interruptMode
  i32.const 0 set_global $isInterruptBlocked
  i32.const $SIG_NONE# set_global $cpuSignalFlags
  i32.const $PREF_NONE# set_global $prefixMode
  i32.const $IND_NONE# set_global $indexMode
  (call $setAF (i32.const 0xffff))
  (call $setWZ (i32.const 0x0000))
  (call $setSP (i32.const 0xffff))
  (call $setPC (i32.const 0))
  (call $setI (i32.const 0))
  (call $setR (i32.const 0))
  i32.const 0x0000 set_global $isInOpExecution
  i32.const 0x0000 set_global $tacts
  i32.const 0x0000 set_global $cpuDiagnostics
)

;; Executes the NMI request
(func $executeNMI
    ;; Test for HLT
  (i32.and (get_global $cpuSignalFlags) (i32.const $SIG_HLT#))
  if
    (set_global $PC 
      (i32.and (i32.add (get_global $PC) (i32.const 1)) (i32.const 0xffff)) 
    )
    (i32.and (get_global $cpuSignalFlags) (i32.const $SIG_HLT_MASK#))
    set_global $cpuSignalFlags
  end
  get_global $iff1 set_global $iff2
  i32.const 0 set_global $iff1

  ;; Push PC
  get_global $PC
  call $pushValue

  ;; Set NMI routione address
  (call $setPC (i32.const 0x0066))
  
  call $hookNmiExecuted
)

;; Executes the NMI request
(func $executeInterrupt
  (local $addr i32)
  (local $oldPc i32)

  ;; Save the PC
  get_global $PC set_local $oldPc

  ;; Test for HLT
  (i32.and (get_global $cpuSignalFlags) (i32.const $SIG_HLT#))
  if
    (set_global $PC 
      (i32.and (i32.add (get_global $PC) (i32.const 1)) (i32.const 0xffff)) 
    )
    (i32.and (get_global $cpuSignalFlags) (i32.const $SIG_HLT_MASK#))
    set_global $cpuSignalFlags
  end

  i32.const 0 set_global $iff1
  i32.const 0 set_global $iff2
  
  ;; Push PC
  get_global $PC
  call $pushValue
  
  ;; Test interrupt mode 0
  (i32.eq (get_global $interruptMode) (i32.const 2))
  if
    ;; Interrupt mode 2
    (call $incTacts (i32.const 2))
    
    ;; Let's assume, the device retrieves 0xff (the least significant bit is ignored)
    ;; addr = i << 8 | 0xfe;
    call $getI
    i32.const 8
    i32.shl
    i32.const 0xfe
    i32.or
    tee_local $addr
    (call $incTacts (i32.const 5))
    call $readMemory
    (i32.add (get_local $addr) (i32.const 1))
    call $readMemory
    i32.const 8
    i32.shl
    i32.or
    call $setWZ
    (call $incTacts (i32.const 6))
  else
    ;; Interrupt mode 0 or 1
    (call $setWZ (i32.const 0x0038))
    (call $incTacts (i32.const 5))
  end

  ;; pc := wz
  call $getWZ
  call $setPC

  ;; Support step-over debugging
  (call $pushToStepOver (get_local $oldPc))

  call $hookIntExecuted
)

;; Processes standard or indexed operations
(func $processStandardOrIndexedOperations
  get_global $indexMode
  if
    (i32.add (i32.const $INDEXED_JT#) (get_global $opCode))
    call_indirect (type $OpFunc)
    call $hookIndexedOpExecuted
  else
    (i32.add (i32.const $STANDARD_JT#) (get_global $opCode))
    call_indirect (type $OpFunc)
    call $hookStandardOpExecuted
  end
)

;; Processes bit operations
(func $processBitOperations
  get_global $indexMode
  if
    ;; indexed bit operations
    ;; WZ := IX + opCode
    (i32.add 
      (call $getIndexReg)
      (i32.shr_s 
        (i32.shl (get_global $opCode) (i32.const 24))
        (i32.const 24)
      )
    )
    call $setWZ

    ;; Adjust tacts
    (call $contendRead (get_global $PC) (i32.const 1))

    ;; The address to use with the indexed bit operation
    call $getWZ 

    ;; Get operation function
    i32.const $INDEXED_BIT_JT#
    call $readCodeMemory
    set_global $opCode
    get_global $opCode
    i32.add
    call_indirect (type $IndexedBitFunc)
    call $hookIndexedBitOpExecuted
  else
    ;; Normal bit operations
    (i32.add (i32.const $BIT_JT#) (get_global $opCode))
    call_indirect (type $OpFunc)
    call $hookBitOpExecuted
  end
)

;; Processes extended operations
(func $processExtendedOperations
  (i32.add (i32.const $EXTENDED_JT#) (get_global $opCode))
  call_indirect (type $OpFunc)
  call $hookExtendedOpExecuted
)

;; ----------------------------------------------------------------------------
;; Instruction helpers

;; Adjust flags after an 8-bit INC statement
;; $v: The value **before** the INC operation
(func $adjustIncFlags (param $v i32)
  (i32.or
    ;; Get flag from the table
    (i32.load8_u (i32.add (get_global $INC_FLAGS) (get_local $v)))
    
    ;; Keep the current C flag
    (i32.and (call $getF) (i32.const 0x01))
  )
  ;; Set F through Q
  (call $setQ (i32.and (i32.const 0xff)))
  (call $setF (call $getQ))
)

;; Adjust flags after an 8-bit DEC statement
;; $v: The value **before** the DEC operation
(func $adjustDecFlags (param $v i32)
  (i32.or
    ;; Get flag from the table
    (i32.load8_u (i32.add (get_global $DEC_FLAGS) (get_local $v)))

    ;; Keep C flag  
    (i32.and (call $getF) (i32.const 0x01))
  )
  ;; Set F through Q
  (call $setQ (i32.and (i32.const 0xff)))
  (call $setF (call $getQ))
)

;; Decrements the value of SP
(func $decSP
  (set_global $SP 
    (i32.and (i32.sub (get_global $SP) (i32.const 1)) (i32.const 0xffff)) 
  )
)

;; Pushes the value to the stack
(func $pushValue (param $v i32)
  (local $sp i32)
  call $decSP
  (call $incTacts (i32.const 1))
  get_global $SP
  (i32.shr_u (get_local $v) (i32.const 8))
  call $writeMemory
  call $decSP
  get_global $SP
  get_local $v
  call $writeMemory
)

;; Pops a value to the stack
(func $popValue (result i32)
  get_global $SP
  call $readMemory
  (set_global $SP 
    (i32.and (i32.add (get_global $SP) (i32.const 1)) (i32.const 0xffff)) 
  )
  get_global $SP
  call $readMemory
  (set_global $SP 
    (i32.and (i32.add (get_global $SP) (i32.const 1)) (i32.const 0xffff)) 
  )
  i32.const 8
  i32.shl
  i32.or
)

;; Reads the memory location at PC
(func $readCodeMemory (result i32)
  get_global $PC
  call $readMemory ;; we'll return this value
  (set_global $PC 
    (i32.and (i32.add (get_global $PC) (i32.const 1)) (i32.const 0xffff)) 
  )
)

;; Add two 16-bit values following the add hl,NN logic
(func $AluAdd16 (param $reg i32) (param $other i32) (result i32)
  (local $f i32)
  (local $res i32)

  ;; Calculate WZ
  (i32.add (get_local $reg) (i32.const 1))
  call $setWZ

  ;; Adjust tacts
  (call $incTacts (i32.const 7))

  ;; Keep S, Z, and PV from F
  (set_local $f (i32.and (call $getF) (i32.const 0xc4)))
  
  ;; Calc the value of H flag
  (i32.add
    (i32.and (get_local $reg) (i32.const 0x0fff))
    (i32.and (get_local $other) (i32.const 0x0fff))
  )
  i32.const 0x08
  i32.shr_u
  i32.const 0x10 ;; Mask for H flag
  i32.and        ;; Now, we have H flag on top

  ;; Combine H flag with others
  get_local $f
  i32.or
  set_local $f

  ;; Calculate result
  (i32.add (get_local $reg) (get_local $other))
  tee_local $res

  ;; Test for C flag
  i32.const 0x1_0000
  i32.ge_u
  if
    ;; Set C
    (i32.or (get_local $f) (i32.const 0x01))
    set_local $f
  end

  ;; Calculate R3 and R5 flags
  (i32.shr_u (get_local $res) (i32.const 8))
  i32.const 0x28 ;; Mask for R3, R5
  i32.and

  ;; Combine them with F
  get_local $f
  i32.or
  (call $setQ (i32.and (i32.const 0xff)))
  (call $setF (call $getQ))

  ;; Fetch the result
  get_local $res
)

;; Add two 16-bit values following the sbc hl,NN logic
(func $AluAdcHL (param $other i32)
  (local $res i32)
  (local $f i32)
  (local $signed i32)

  ;; WZ = HL + 1
  (i32.add (call $getHL) (i32.const 1))
  call $setWZ

  ;; Calculate result
  (i32.add (call $getHL) (get_local $other))
  tee_local $res
  (i32.and (call $getF) (i32.const 0x01))
  tee_local $f
  i32.add
  tee_local $res

  ;; Calculate Z
  i32.const 0xffff
  i32.and
  if (result i32)  ;; (Z)
    i32.const 0x00
  else
    i32.const 0x40
  end

  ;; Calculate H
  (i32.and (call $getHL) (i32.const 0x0fff))
  (i32.and (get_local $other) (i32.const 0x0fff))
  i32.add
  get_local $f
  i32.add
  i32.const 8
  i32.shr_u
  i32.const 0x10 ;; Mask for H
  i32.and ;; (Z, H)

  ;; Calculate C
  i32.const 0x01
  i32.const 0x00
  (i32.and (get_local $res) (i32.const 0x1_0000))
  select ;; (Z, H, C)

  ;; Calculate PV
  (i32.shr_s 
    (i32.shl (call $getHL) (i32.const 16))
    (i32.const 16)
  )
  (i32.shr_s 
    (i32.shl (get_local $other) (i32.const 16))
    (i32.const 16)
  )
  i32.add
  get_local $f
  i32.add
  tee_local $signed
  i32.const -0x8000
  i32.lt_s
  get_local $signed
  i32.const 0x8000
  i32.ge_s
  i32.or
  if (result i32) ;; (Z, H, C, PV)
    i32.const 0x04
  else
    i32.const 0x00
  end

  ;; Store the result
  get_local $res
  call $setHL

  ;; Calculate S, R5, R3
  call $getH
  i32.const 0xA8 ;; Mask for S|R5|R3
  i32.and

  ;; Merge flags
  i32.or
  i32.or
  i32.or
  i32.or
  (call $setQ (i32.and (i32.const 0xff)))
  (call $setF (call $getQ))
)

;; Subtract two 16-bit values following the sbc hl,NN logic
(func $AluSbcHL (param $other i32)
  (local $res i32)
  (local $f i32)
  (local $signed i32)

  ;; WZ = HL + 1;
  (i32.add (call $getHL) (i32.const 1))
  call $setWZ

  ;; Calculate result
  (i32.sub (call $getHL) (get_local $other))
  tee_local $res
  (i32.and (call $getF) (i32.const 0x01))
  tee_local $f
  i32.sub
  tee_local $res

  ;; Calculate Z
  i32.const 0xffff
  i32.and
  if (result i32)  ;; (Z)
    i32.const 0x00
  else
    i32.const 0x40
  end

  ;; Set N
  i32.const 0x02 ;; (Z, N)

  ;; Calculate H
  (i32.and (call $getHL) (i32.const 0x0fff))
  (i32.and (get_local $other) (i32.const 0x0fff))
  i32.sub
  get_local $f
  i32.sub
  i32.const 8
  i32.shr_u
  i32.const 0x10 ;; Mask for H
  i32.and ;; (Z, N, H)

  ;; Calculate C
  i32.const 0x01
  i32.const 0x00
  (i32.and (get_local $res) (i32.const 0x1_0000))
  select ;; (Z, N, H, C)

  ;; Calculate PV
  (i32.shr_s 
    (i32.shl (call $getHL) (i32.const 16))
    (i32.const 16)
  )
  (i32.shr_s 
    (i32.shl (get_local $other) (i32.const 16))
    (i32.const 16)
  )
  i32.sub
  get_local $f
  i32.sub
  tee_local $signed
  i32.const -0x8000
  i32.lt_s
  get_local $signed
  i32.const 0x8000
  i32.ge_s
  i32.or
  if (result i32) ;; (Z, N, H, C, PV)
    i32.const 0x04
  else
    i32.const 0x00
  end

  ;; Store the result
  get_local $res
  call $setHL

  ;; Calculate S, R5, R3
  call $getH
  i32.const 0xA8 ;; Mask for S|R5|R3
  i32.and

  ;; Merge flags
  i32.or
  i32.or
  i32.or
  i32.or
  i32.or
  (call $setQ (i32.and (i32.const 0xff)))
  (call $setF (call $getQ))
)

;; Carries out a relative jump
;; $e: 8-bit distance value
(func $relativeJump (param $e i32)
  call $AdjustPcTact5

  ;; Convert the 8-bit distance to i32
  (i32.shr_s 
    (i32.shl (get_local $e) (i32.const 24))
    (i32.const 24)
  )

  ;; Calculate the destination address
  get_global $PC
  i32.add
  call $setPC

  ;; Copy to WZ
  get_global $PC
  call $setWZ
)

;; Adjust tacts for IX-indirect addressing
(func $AdjustPcTact5
  get_global $PC
  call $Adjust5Tacts
)

;; Adjust tacts for IX-indirect addressing
(func $Adjust5Tacts (param $addr i32)
  (call $contendRead (get_local $addr) (i32.const 1))
  (call $contendRead (get_local $addr) (i32.const 1))
  (call $contendRead (get_local $addr) (i32.const 1))
  (call $contendRead (get_local $addr) (i32.const 1))
  (call $contendRead (get_local $addr) (i32.const 1))
)

;; Gets the index address for an operation
(func $getIndexedAddress (result i32)
  call $getIndexReg
  (i32.shr_s 
    (i32.shl (call $readCodeMemory) (i32.const 24))
    (i32.const 24)
  )
  i32.add
)

;; Gets the entry from the SZ53_FLAGS table
(func $getSZ53 (param $arg i32) (result i32)
  (i32.add
    (get_global $SZ53_FLAGS)
    (i32.and (get_local $arg) (i32.const 0xff))
  )
  i32.load8_u
)

;; Gets the entry from the SZ53_FLAGS table
(func $getSZ53P (param $arg i32) (result i32)
  (i32.add
    (get_global $SZ53P_FLAGS)
    (i32.and (get_local $arg) (i32.const 0xff))
  )
  i32.load8_u
)

;; Gets the r12 lookup value for flags
(func $getR12Lookup
  (param $r i32)
  (param $1 i32)
  (param $2 i32)
  (result i32)
  (i32.shr_u 
    (i32.and (get_local $1) (i32.const 0x88))
    (i32.const 3)
  )
  (i32.shr_u 
    (i32.and (get_local $2) (i32.const 0x88))
    (i32.const 2)
  )
  (i32.shr_u 
    (i32.and (get_local $r) (i32.const 0x88))
    (i32.const 1)
  )
  i32.or
  i32.or
)

;; Executes ALU addition; sets A and F
;; $arg: other argument
;; $c: Value of the C flag
(func $AluAdd (param $arg i32) (param $c i32)
  (local $a i32)
  (local $res i32)
  (local $r12 i32)

  ;; Add values (+carry) and store in A
  (tee_local $a (call $getA))
  (i32.add (get_local $arg))
  (i32.add (get_local $c))
  tee_local $res
  (call $setA (i32.and (i32.const 0xff)))

  ;; Get C flag
  (i32.shr_u 
    (i32.and (get_local $res) (i32.const 0x100))
    (i32.const 8)
  )

  ;; Combine with SZ53 flags
  (i32.or (call $getSZ53 (get_local $res)))

  ;; Lookup value
  (call $getR12Lookup (get_local $res) (get_local $a) (get_local $arg))
  set_local $r12

  ;; Combine with half-carry add
  (i32.or
    (i32.load8_u
      (i32.add
        (get_global $HC_ADD)
        (i32.and (get_local $r12) (i32.const 0x07))
      )
    )
  )

  ;; Combine with overflow add
  (i32.or
    (i32.load8_u
      (i32.add
        (get_global $OVF_ADD)
        (i32.shr_u (get_local $r12) (i32.const 4))
      )
    )
  )

  ;; Done
  (call $setQ (i32.and (i32.const 0xff)))
  (call $setF (call $getQ))
)

;; Executes ALU subtraction; sets A and F
;; $arg: other argument
;; $c: Value of the C flag
(func $AluSub (param $arg i32) (param $c i32)
  (local $a i32)
  (local $res i32)
  (local $r12 i32)

  ;; Subtract values (-carry) and store in A
  (tee_local $a (call $getA))
  (i32.sub (get_local $arg))
  (i32.sub (get_local $c))
  tee_local $res
  (call $setA (i32.and (i32.const 0xff)))

  ;; Get C flag
  (i32.shr_u 
    (i32.and (get_local $res) (i32.const 0x100))
    (i32.const 8)
  )

  ;; Set N
  (i32.or (i32.const 0x02))

  ;; Combine with SZ53 flags
  (i32.or (call $getSZ53 (get_local $res)))

  ;; Lookup value
  (call $getR12Lookup (get_local $res) (get_local $a) (get_local $arg))
  set_local $r12

  ;; Combine with half-carry sub
  (i32.or
    (i32.load8_u
      (i32.add
        (get_global $HC_SUB)
        (i32.and (get_local $r12) (i32.const 0x07))
      )
    )
  )

  ;; Combine with overflow sub
  (i32.or
    (i32.load8_u
      (i32.add
        (get_global $OVF_SUB)
        (i32.shr_u (get_local $r12) (i32.const 4))
      )
    )
  )

  ;; Done
  (call $setQ (i32.and (i32.const 0xff)))
  (call $setF (call $getQ))
)

;; Executes ALU AND operations; sets A and F
;; $arg: other argument
(func $AluAnd (param $arg i32)
  (i32.and (call $getA) (get_local $arg))
  (call $setA (i32.and (i32.const 0xff)))

  ;; Adjust flags
  (i32.add (get_global $LOG_FLAGS) (call $getA))
  i32.load8_u

  ;; Set H
  i32.const 0x10 ;; H flag mask
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; Executes ALU XOR operation; sets A and F
;; $arg: other argument
(func $AluXor (param $arg i32)
  (i32.xor (call $getA) (get_local $arg))
  (call $setA (i32.and (i32.const 0xff)))

  ;; Adjust flags
  (i32.add (get_global $LOG_FLAGS) (call $getA))
  i32.load8_u
  (call $setF (i32.and (i32.const 0xff)))
)

;; Executes ALU OOR operation; sets A and F
;; $arg: other argument
(func $AluOr (param $arg i32)
  (i32.or (call $getA) (get_local $arg))
  (call $setA (i32.and (i32.const 0xff)))

  ;; Adjust flags
  (i32.add (get_global $LOG_FLAGS) (call $getA))
  i32.load8_u
  (call $setF (i32.and (i32.const 0xff)))
)

;; Executes ALU 8-add compare; sets F
;; $arg: other argument
(func $AluCp (param $arg i32)
  (local $res i32)
  (local $r12 i32)

  ;; Subtract values
  (i32.sub (call $getA) (get_local $arg))
  set_local $res
  
  ;; Get C flag
  (i32.shr_u 
    (i32.and (get_local $res) (i32.const 0x100))
    (i32.const 8)
  )

  ;; Combine with Z flag
  (i32.or
    (select
      (i32.const 0x00)
      (i32.const 0x40)
      (get_local $res)
    )
  )

  ;; Set N
  (i32.or (i32.const 0x02))

  ;; Lookup value
  (call $getR12Lookup (get_local $res) (call $getA) (get_local $arg))
  set_local $r12

  ;; Combine with half-carry sub
  (i32.or
    (i32.load8_u
      (i32.add
        (get_global $HC_SUB)
        (i32.and (get_local $r12) (i32.const 0x07))
      )
    )
  )

  ;; Combine with overflow sub
  (i32.or
    (i32.load8_u
      (i32.add
        (get_global $OVF_SUB)
        (i32.shr_u (get_local $r12) (i32.const 4))
      )
    )
  )

  ;; Combine with S
  (i32.or
    (i32.and (get_local $res) (i32.const 0x80))
  )

  ;; Combine with R5 and R3
  (i32.or
    (i32.and (get_local $arg) (i32.const 0x28))
  )

  ;; Done
  (call $setQ (i32.and (i32.const 0xff)))
  (call $setF (call $getQ))
)

;; Tests the Z condition
(func $testZ (result i32)
  (i32.and (call $getF) (i32.const 0x40))
)

;; Tests the NZ condition
(func $testNZ (result i32)
  (i32.and (call $getF) (i32.const 0x40))
  i32.eqz
)

;; Tests the C condition
(func $testC (result i32)
  (i32.and (call $getF) (i32.const 0x01))
)

;; Tests the NC condition
(func $testNC (result i32)
  (i32.and (call $getF) (i32.const 0x01))
  i32.eqz
)

;; Tests the PE condition
(func $testPE (result i32)
  (i32.and (call $getF) (i32.const 0x04))
)

;; Tests the PO condition
(func $testPO (result i32)
  (i32.and (call $getF) (i32.const 0x04))
  i32.eqz
)

;; Tests the M condition
(func $testM (result i32)
  (i32.and (call $getF) (i32.const 0x80))
)

;; Tests the P condition
(func $testP (result i32)
  (i32.and (call $getF) (i32.const 0x80))
  i32.eqz
)

;; Read address to WZ
(func $readAddrToWZ
  call $readCodeMemory
  call $readCodeMemory
  i32.const 8
  i32.shl
  i32.or
  call $setWZ
)

;; Read 16 bits from the code
(func $readCode16 (result i32)
  ;; Combine LSB and MSB
  (i32.or
    ;; Next code byte
    (call $readCodeMemory)
    ;; Next code byte << 8
    (i32.shl (call $readCodeMemory) (i32.const 8))
  )
)
