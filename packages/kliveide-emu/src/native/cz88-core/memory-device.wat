;; ============================================================================
;; Implements the Z88 memory device (Blink)

;; ============================================================================
;; Z88 Memory device terms
;;
;; Segments: 4 segments (0-3), each with a 16K size of the addressable 64K 
;; of Z80. Determined by A15-A14. Each segment is associated with a slot
;; register, SR0, SR1, SR2, or SR3
;;   Segment 0: $2000-$3fff --> SR0
;;   Segment 1: $4000-$7fff --> SR1
;;   Segment 2: $8000-$bfff --> SR2
;;   Segment 3: $c000-$ffff --> SR3
;;
;; Chip index to select the physical RAM/ROM chip:
;;   Chip 0: internal ROM/EPROM, 32K - 512K
;;   Chip 1: internal RAM, 32K - 512K
;;   Chip 2: card in Slot 1, 32K - 1M
;;   Chip 3: card in Slot 2, 32K - 1M
;;   Chip 4: card in Slot 3, 32K - 1M: Can be RAM/ROM
;; 
;; Memory bank: 256 individually addressable memory bank, each with 16K
;; Memory banks use 22 bit addresses for 4MB continuous addressable space
;;   A21-A14: 8-bit bank index, $00-$ff
;;   A13-A0: 14-bit address of the CPU range, offset within a segment
;; Memory banks are associated with chips:
;;   Chip 0, internal ROM/EPROM: bank $00-$1f
;;   Chip 1, internal RAM: bank $20-$3f
;;   Chip 2, card in Slot 1: bank $40-$7f
;;   Chip 3, card in Slot 2: bank $80-$bf
;;   Chip 4, card in Slot 3: bank $c0-$ff
;;
;; Chip size masking: determines the size of physical memory of a particular chip.
;;   A mask value is 6 bits, and can be used to mask out the lowest 6 bit of 
;;   a bank index.
;;   For example, if Chip 3 has 32K memory, mask value is $01. When you address
;;   bank $40 and bank $42, they result in as if you addressed bank $40, to 
;;   represent that the memory contents seem to be repeated for each  32K of 
;;   the addressable 1M space. Similarly, $41, $43, $45, ..., $fd, and $ff each
;;   repeat the upper 16K of the 32K memory.
;; Chip size mask values:
;;   $01: 32K
;;   $03: 64K
;;   $07: 128K
;;   $0f: 256K
;;   $1f: 512K
;;   $3f: 1M
;;
;; Addressing logic: 
;;
;; Initialization:
;;   When the Z88 machine starts up, Each of SR0-SR3 contains $00.
;;   Chip size masks are already set.
;; Removing/inserting card:
;;   TBD
;; Setting the value of SR0-SR3:
;;   When a byte is written to port $d0-$d3, those values are stored is SR0-SR3,
;;   respectively. The emulator prepares a pointer for the address slot 
;;   associated with the SR that points to the corresponding 16K segment within
;;   the 4MB address range. Later, offsets ($0000-$3fff) should be added to that
;;   pointer. (The pointer for address slot 0 contains the pointer for the RAM.
;;   When reading or writing memory, SR0 has special behavior.)
;; Addresses for SR0 ($0000-$3fff range):
;;   SR0 points to a bank. Instead of mapping the entire 16K bank into the 
;;   $0000-$3fff range, either the lower or the upper 8K of that particular bank
;;   is mapped to the upper 8K ($2000-$3fff) of address slot 0:
;;   - Even bank indexes: contents of $0000-$1fff --> address slot 0: $2000-$3fff
;;   - Odd bank indexes:  contents of $2000-$3fff --> address slot 0: $2000-$3fff
;;   The lower 8K of address slot 0 uses either bank $00 or bank $20:
;;   - COM.RAMS register set:   $20
;;   - COM.RAMS register reset: $00
;;
;; Address page table:
;;   Keeps offset values for each 8K virtual memory page for accelerating memory
;;   access. Besides, holds a flag that indicates ROM/RAM behavior
;;   The table starts at $Z88_PAGE_PTRS.
;; 0x00-0x03: Offset for range $0000-$1fff
;; 0x04: Indicates if range $0000-$1fff is ROM
;; 0x05-0x08: Offset for range $2000-$3fff
;; 0x09: Indicates if range $2000-$3fff is ROM
;; 0x0a-0x0d: Offset for range $4000-$5fff
;; 0x0e: Indicates if range $4000-$5fff is ROM (always 0)
;; 0x0f-0x12: Offset for range $6000-$7fff
;; 0x13: Indicates if range $6000-$7fff is ROM (always 0)
;; 0x14-0x17: Offset for range $8000-$9fff
;; 0x18: Indicates if range $8000-$9fff is ROM (always 0)
;; 0x19-0x1c: Offset for range $a000-$bfff
;; 0x1d: Indicates if range $a000-$bfff is ROM (always 0)
;; 0x1e-0x21: Offset for range $c000-$dfff
;; 0x22: Indicates if range $c000-$dfff is ROM
;; 0x23-0x26: Offset for range $e000-$ffff
;; 0x27: Indicates if range $e000-$ffff is ROM (always 0)

;; Initial setup of Z88 memory
(func $resetZ88Memory
  (call $setZ88SR0 (i32.const 0))
  (call $setZ88SR1 (i32.const 0))
  (call $setZ88SR2 (i32.const 0))
  (call $setZ88SR3 (i32.const 0))

  ;; 512K internal ROM
  (call $setZ88ChipMask (i32.const 0) (i32.const 0x1f))

  ;; 512K internal RAM
  (call $setZ88ChipMask (i32.const 1) (i32.const 0x1f))

  ;; No cards in any slot
  (call $setZ88ChipMask (i32.const 2) (i32.const 0x00))
  (call $setZ88ChipMask (i32.const 3) (i32.const 0x00))
  (call $setZ88ChipMask (i32.const 4) (i32.const 0x00))

  ;; Card 3 is RAM
  (call $setZ88Card3Rom (i32.const 0))
)

;; Sets SR0 and updates the address page table
(func $setZ88SR0 (param $bank i32)
  (i32.store8 offset=0 (get_global $Z88_SR) (get_local $bank))

  ;; Lower 8K of SR0
  (i32.and (get_global $z88COM) (i32.const $BM_COMRAMS#))
  if 
    ;; Bank $20, RAM
    (i32.store offset=0
      (get_global $Z88_PAGE_PTRS)
      (i32.add (get_global $Z88_MEM_AREA) (i32.const 0x08_0000))
    )
    (i32.store8 offset=4
      (get_global $Z88_PAGE_PTRS)
      (i32.const 0x00) 
    )
  else
    ;; Bank $00, ROM
    (i32.store offset=0
      (get_global $Z88_PAGE_PTRS)
      (get_global $Z88_MEM_AREA)
    )
    (i32.store8 offset=4
      (get_global $Z88_PAGE_PTRS)
      (i32.const 0x01) 
    )
  end

  ;; Upper 8K of SR0

  ;; Prepare to store address offset
  get_global $Z88_PAGE_PTRS

  ;; Calculate bank offset
  (call $z88CalculatePageOffset 
    (i32.and (get_local $bank) (i32.const 0xfe))
  )
  i32.const 0x2000
  i32.const 0x0000
  (i32.and (get_local $bank) (i32.const 1))
  select
  i32.add

  ;; Now, store offset
  i32.store offset=5

  ;; Obtain ROM info
  (i32.store8 offset=9 
    (get_global $Z88_PAGE_PTRS)
    (call $z88GetRomInfo (get_local $bank))
  )
)

;; Sets SR1 and updates the address page table
(func $setZ88SR1 (param $bank i32)
  (local $ptr i32)
  (local $romInfo i32)
  (i32.store8 offset=1 (get_global $Z88_SR) (get_local $bank))

  (call $z88CalculatePageOffset (get_local $bank))
  set_local $ptr
  (call $z88GetRomInfo (get_local $bank))
  set_local $romInfo

  ;; Offset for 0x4000-0x5fff
  (i32.store offset=10 (get_global $Z88_PAGE_PTRS) (get_local $ptr)) 
  (i32.store8 offset=14 (get_global $Z88_PAGE_PTRS) (get_local $romInfo))

  ;; Offset for 0x6000-0x7fff
  (i32.store offset=15 
    (get_global $Z88_PAGE_PTRS) 
    (i32.add (get_local $ptr) (i32.const 0x2000))
  ) 
  (i32.store8 offset=19 (get_global $Z88_PAGE_PTRS) (get_local $romInfo))
)

;; Sets SR2 and updates the address page table
(func $setZ88SR2 (param $bank i32)
  (local $ptr i32)
  (local $romInfo i32)
  (i32.store8 offset=2 (get_global $Z88_SR) (get_local $bank))

  (call $z88CalculatePageOffset (get_local $bank))
  set_local $ptr
  (call $z88GetRomInfo (get_local $bank))
  set_local $romInfo

  ;; Offset for 0x8000-0x9fff
  (i32.store offset=20 (get_global $Z88_PAGE_PTRS) (get_local $ptr)) 
  (i32.store8 offset=24 (get_global $Z88_PAGE_PTRS) (get_local $romInfo))

  ;; Offset for 0xa000-0xbfff
  (i32.store offset=25 
    (get_global $Z88_PAGE_PTRS) 
    (i32.add (get_local $ptr) (i32.const 0x2000))
  ) 
  (i32.store8 offset=29 (get_global $Z88_PAGE_PTRS) (get_local $romInfo))
)

;; Sets SR3 and updates the address page table
(func $setZ88SR3 (param $bank i32)
  (local $ptr i32)
  (local $romInfo i32)
  (i32.store8 offset=3 (get_global $Z88_SR) (get_local $bank))

  (call $z88CalculatePageOffset (get_local $bank))
  set_local $ptr
  (call $z88GetRomInfo (get_local $bank))
  set_local $romInfo

  ;; Offset for 0xc000-0xdfff
  (i32.store offset=30 (get_global $Z88_PAGE_PTRS) (get_local $ptr)) 
  (i32.store8 offset=34 (get_global $Z88_PAGE_PTRS) (get_local $romInfo))

  ;; Offset for 0xe000-0xffff
  (i32.store offset=35 
    (get_global $Z88_PAGE_PTRS) 
    (i32.add (get_local $ptr) (i32.const 0x2000))
  ) 
  (i32.store8 offset=39 (get_global $Z88_PAGE_PTRS) (get_local $romInfo))
)

;; Calculates the offset within the 4MB memory for the specified $bank
;; and chip size mask
(func $z88CalculatePageOffset (param $bank i32) (result i32)
  (local $sizeMask i32)

  ;; Calculate size mask
  (i32.le_u (get_local $bank) (i32.const 0x1f))
  if (result i32)
    i32.const 0
  else
    (i32.add 
      (i32.const 1)
      (i32.shr_u (get_local $bank) (i32.const 6))
    )
  end
  (i32.add (get_global $Z88_CHIP_MASKS))
  i32.load8_u
  set_local $sizeMask

  (i32.and (get_local $bank) (i32.const 0xc0))      ;; [bank & $c0]
  (i32.and (get_local $bank) (get_local $sizeMask)) ;; [bank & $c0, bank & chip size mask]
  i32.const 0x3f                          
  i32.and         ;; [bank, lowest 6 bits of masked bank]
  i32.or          ;; [final bank index]
  
  ;; Complete the address calculation
  (i32.add
    (i32.shl (i32.const 14))
    (get_global $Z88_MEM_AREA)
  )
)

;; Calculates ROM information for the specified bank and size
(func $z88GetRomInfo (param $bank i32) (result i32)
  (i32.le_u (get_local $bank) (i32.const 0x1f))
  if
    ;; Internal ROM
    i32.const 1
    return
  end

  (i32.le_u (get_local $bank) (i32.const 0x3f))
  if
    ;; Internal RAM
    i32.const 0
    return
  end

  (i32.le_u (get_local $bank) (i32.const 0x7f))
  if
    ;; Card Slot 1 RAM
    i32.const 0    ;; RAM
    i32.const 0xff ;; Empty
    (i32.load8_u offset=2 (get_global $Z88_CHIP_MASKS))
    select
    return
  end

  (i32.le_u (get_local $bank) (i32.const 0xbf))
  if
    ;; Card Slot 2 RAM
    i32.const 0    ;; RAM
    i32.const 0xff ;; Empty
    (i32.load8_u offset=3 (get_global $Z88_CHIP_MASKS))
    select
    return
  end

  ;; Card Slot 3 RAM/EPROM
  (i32.load8_u offset=4 (get_global $Z88_CHIP_MASKS))
  if
    ;; Mask determins EPROM/RAM behavior
    (i32.load8_u offset=5 (get_global $Z88_CHIP_MASKS))
    return
  end

  ;; Card 3 is empty
  i32.const 0xff ;; Empty
)

;; Calculates the absolute Z88 memory address from the specified 16-bit address
(func $calcZ88MemoryAddress (param $addr i32) (result i32)
  (i32.or
    ;; Get the address page offset
    (i32.load
      ;; Address table pointer value
      (i32.add
        ;; Index table start
        (get_global $Z88_PAGE_PTRS)
        ;; Index entry offset
        (i32.mul
          ;; Page index: A15-A3 (3 bits)
          (i32.shr_u (get_local $addr) (i32.const 13))
          ;; Index entry size
          (i32.const 5)
        )
      )
    )
    ;; Last 13 bits of the address
    (i32.and (get_local $addr) (i32.const 0x1fff))
  )
)

;; Sets the value of the specified slot mask
(func $setZ88ChipMask (param $chip i32) (param $mask i32)
  (local $segment i32)
  ;; Clamp the slot index
  (i32.gt_u (get_local $chip) (i32.const 4))
  if
    i32.const 4 set_local $chip
  end

  ;; Store the mask value
  (i32.store8 
    (i32.add (get_global $Z88_CHIP_MASKS) (get_local $chip))
    (get_local $mask)
  )

  ;; Recalculate all page indexes
  (call $setZ88SR0 (i32.load8_u offset=0 (get_global $Z88_SR)))
  (call $setZ88SR1 (i32.load8_u offset=1 (get_global $Z88_SR)))
  (call $setZ88SR2 (i32.load8_u offset=2 (get_global $Z88_SR)))
  (call $setZ88SR3 (i32.load8_u offset=3 (get_global $Z88_SR)))
)

;; Sets the ROM flag for Card 3
(func $setZ88Card3Rom (param $isRom i32)
  (i32.store8 offset=5 (get_global $Z88_CHIP_MASKS) (get_local $isRom))
)

;; ============================================================================
;; Test methods

;; Use this method to test Z88 address calculation
(func $testZ88MemoryAddress (param $addr i32) (result i32)
  (call $calcZ88MemoryAddress (get_local $addr))
)