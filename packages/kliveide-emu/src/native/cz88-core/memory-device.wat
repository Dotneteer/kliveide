;; ============================================================================
;; Implements the Z88 memory device (Blink)

;; ============================================================================
;; Z88 Memory device terms
;;
;; Segments: 4 segments (0-3), each with a 16K size of the addressable 64K 
;; of Z80. Determined by A15-A14. Each segment is associated with a slot
;; register, SR0, SR1, SR2, or SR3
;;   Segment 0: $0000-$3fff --> SR0
;;   Segment 1: $4000-$7fff --> SR1
;;   Segment 2: $8000-$bfff --> SR2
;;   Segment 3: $c000-$ffff --> SR3
;;
;; Slots of the Z88 Blink address logic to select the physical
;; RAM/ROM chip:
;;   Slot 0: internal RAM, 32K - 512K
;;   Slot 1: card in Slot 1, 32K - 1M
;;   Slot 2: card in Slot 2, 32K - 1M
;;   Slot 3: card in Slot 3, 32K - 1M: Can be RAM/ROM
;;   Slot 4: internal ROM/EPROM, 32K - 512K
;; 
;; Memory bank: 256 individually addressable memory bank, each with 16K
;; Memory banks use 22 bit addresses for 4MB continuous addressable space
;;   A21-A14: 8-bit bank index, $00-$ff
;;   A13-A0: 14-bit address of the CPU range, offset within a segment
;; Memory banks are associated with slots:
;;   Slot 0, internal RAM: bank $20-$3f
;;   Slot 1, card in Slot 1: bank $40-$7f
;;   Slot 2, card in Slot 2: bank $80-$bf
;;   Slot 3, card in Slot 3: bank $c0-$ff
;;   Slot 4, internal ROM/EPROM: bank $00-$1f
;;
;; Slot masking: determines the size of physical memory in a particular slot.
;;   A mask value is 6 bits, and can be used to mask out the lowest 6 bit of 
;;   a bank index.
;;   For example, if slot 1 has 32K memory, mask value is $01. When you address
;;   bank $40 and bank $42, they result in as if you addressed bank $40, to 
;;   represent that the memory contents seem to be repeated for each  32K of 
;;   the addressable 1M space. Similarly, $41, $43, $45, ..., $fd, and $ff each
;;   repeat the upper 16K of the 32K memory.
;; Slot mask values:
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
;;   Slot mask are already set.
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

;; Initial setup of Z88 memory
(func $resetZ88Memory
  (call $setZ88MemorySegment (i32.const 0) (i32.const 0))
  (call $setZ88MemorySegment (i32.const 1) (i32.const 0))
  (call $setZ88MemorySegment (i32.const 2) (i32.const 0))
  (call $setZ88MemorySegment (i32.const 3) (i32.const 0))

  (call $setSlotMask (i32.const 0) (i32.const 0x1f))
  (call $setSlotMask (i32.const 1) (i32.const 0x00))
  (call $setSlotMask (i32.const 2) (i32.const 0x00))
  (call $setSlotMask (i32.const 3) (i32.const 0x00))
  (call $setSlotMask (i32.const 4) (i32.const 0x1f))
)

;; Sets the specified memory segment (0x00..0x03) to the specified 
;; bank (8-bit)
(func $setZ88MemorySegment (param $segment i32) (param $bank i32)
  ;; Mask out the used bits
  (i32.and (get_local $segment) (i32.const 0x03))
  set_local $segment
  (i32.and (get_local $bank) (i32.const 0xff))
  set_local $bank

  ;; Store the SR value
  (i32.store8
    (i32.add (get_global $Z88_SR) (get_local $segment))
    (get_local $bank)
  )

  ;; Calculate the memory address of the page pointer
  (i32.add (get_global $Z88_PAGE_PTRS) 
    (i32.mul (get_local $segment) (i32.const 4))
  ) ;; Remains in the stack!

  ;; Calculate the memory pointer for the 16K address slot
  ;; managed by the current SR
  (i32.and (get_local $bank) (i32.const 0xc0)) ;; [bank & $c0]
  get_local $bank                              ;; [bank & $c0, bank]

  ;; Obtain the card slot from the bank value
  (i32.load8_u
    (i32.add 
      (get_global $Z88_SLMASKS) 
      (i32.shr_u (get_local $bank) (i32.const 6))
    )
  )               ;; [bank & $c0, bank, card slot mask]
  i32.and         ;; [bank & $c0, bank & card slot mask]
  i32.const 0xbf                          
  i32.and         ;; [bank, lowest 6 bits of masked bank]
  i32.or          ;; [final bank index]
  
  ;; Complete the address calculation
  (i32.add
    (i32.shl (i32.const 14))
    (get_global $Z88_MEM_AREA)
  )
  
  i32.store ;; Store the page pointer
)

;; Calculates the absolute Z88 memory address from the specified 16-bit address
(func $calcZ88MemoryAddress (param $addr i32) (result i32)
  (i32.ge_u (get_local $addr) (i32.const 0x4000))
  if
    ;; 0x4000-0xffff: SR1-SR3, standard addressing
    (i32.add
      ;; Page pointer value (within the 4MB area)
      (i32.load
        ;; Page pointer address
        (i32.add
          ;; Page pointer start area
          (get_global $Z88_PAGE_PTRS)
          ;; Segment offset
          (i32.mul
            ;; A15-A14: Segment value
            (i32.shl (get_local $addr) (i32.const 14))
            ;; Pointer size 
            (i32.const 4)
          )
        )
      )
      ;; Offset
      (i32.and (get_local $addr) (i32.const 0x3fff))
    )
    return
  end

  ;; 0x0000-0x3fff: SR0, special addressing
  (i32.ge_u (get_local $addr) (i32.const 0x2000))
  if
    ;; 0x2000-0x3fff: Upper 8K, get SR0
    ;; The page address for segment 0 already contains the page index
    (i32.load (get_global $Z88_PAGE_PTRS))

    ;; Check if bank is odd or even, and calculate the page offset
    (i32.load8_u (get_global $Z88_SR))
    (i32.and (i32.const 0x0001))
    if (result i32)
      ;; Odd: upper 8K of the bank
      get_local $addr
    else
      ;; Even: lower 8K of the bank
      (i32.and (get_local $addr) (i32.const 0x1fff))
    end
    i32.add
    return
  end

  ;; 0x0000-0x1fff: Lower 8K according to COM.RAMS
  i32.const 0x08_0000 ;; Memory offset of bank $20
  i32.const 0x00_0000 ;; Memory offset of bank $00
  (i32.and (get_global $z88COM) (i32.const $BM_COMRAMS#))
  select ;; Choose the offset of the bank
  ;; Add it to the start of memory area
  (i32.add (get_global $Z88_MEM_AREA))
  ;; $addr is the offset within the page
  (i32.add (get_local $addr))
)

;; Sets the value of the specified slot mask
(func $setSlotMask (param $slot i32) (param $mask i32)
  ;; Clamp the slot index
  (i32.gt_u (get_local $slot) (i32.const 4))
  if
    i32.const 4 set_local $slot
  end

  ;; Store the mask value
  (i32.store8 
    (i32.add (get_global $Z88_SLMASKS) (get_local $slot))
    (get_local $mask)
  )

  ;; Recalculate the page index according to the new slot mask value
  (i32.and (get_local $slot) (i32.const 0x03)) ;; [segment ]
  (i32.add 
    (get_global $Z88_SR)
    (i32.and (get_local $slot) (i32.const 0x03))
  ) 
  i32.load8_u ;; [segment, bank]
  call $setZ88MemorySegment
)
