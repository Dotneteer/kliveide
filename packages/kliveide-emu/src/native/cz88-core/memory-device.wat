;; ============================================================================
;; Implements the Z88 memory device (Blink)

;; ============================================================================
;; Z88 Memory device terms
;;
;; Address slot: 4 slots (0-3), each with a 16K size of the addressable 64K 
;; of Z80. Determined by A15-A14. Each address slot is associated with a slot
;; register, SR0, SR1, SR2, or SR3
;;   Address slot 0: $00: $0000-$3fff --> SR0
;;   Address slot 1: $01: $4000-$7fff --> SR1
;;   Address slot 2: $02: $8000-$bfff --> SR2
;;   Address slot 0: $03: $c000-$ffff --> SR3
;;
;; Card slot: Slots of the Z88 Blink address logic to select the physical
;; RAM/ROM chip:
;;   Card slot 0: internal RAM, 32K - 512K
;;   Card slot 1: card in Slot 1, 32K - 1M
;;   Card slot 2: card in Slot 2, 32K - 1M
;;   Card slot 3: card in Slot 3, 32K - 1M: Can be RAM/ROM
;;   Card slot 4: internal ROM/EPROM, 32K - 512K
;; 
;; Memory bank: 256 individually addressable memory bank, each with 16K
;; Memory banks use 22 bit addresses for 4MB continuous addressable space
;;   A21-A14: 8-bit bank index, $00-$ff
;;   A13-A0: 14-bit address of the CPU range, offset within an address slot
;; Memory banks are associated with card slots:
;;   Card slot 0, internal RAM: bank $20-$3f
;;   Card slot 1, card in Slot 1: bank $40-$7f
;;   Card slot 2, card in Slot 2: bank $80-$bf
;;   Card slot 3, card in Slot 3: bank $c0-$ff
;;   Card slot 4, internal ROM/EPROM: bank $00-$1f
;;
;; Card slot masking: determines the size of memory in a particular card slot.
;; A mask value is 6 bits, and can be used to mask out the lowest 6 bit of a bank
;; index.
;; For example, if Card slot 1 has 32K memory, mask value is $01. When you address
;; slot $40 and slot $42, they result in as if you addressed bank $40, to represent
;; that the memory contents seem to be repeated for each 32K of the addressable 1M
;; space. Similarly, $41, $43, $45, ..., $fd, $ff each repeat the upper 16K of 
;; the 32K memory.
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
;;   associated with the SR that point to the right 16K segment within the 4MB
;;   address range. Later, offsets ($0000-$3fff) should be added to that pointer.
;;   (The pointer for address slot 0 contains the pointer for the RAM. When
;;   reading or writing memory, SR0 has special behavior)
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

;; Sets the specified memory segment (0x00..0x03) to the specified band (8-bit)
(func $setZ88MemorySegment (param $segment i32) (param $value i32)
  (local $srAddr i32)

  ;; Mask out the used bits
  (i32.and (get_local $segment) (i32.const 0x03))
  set_local $segment
  (i32.and (get_local $value) (i32.const 0xff))
  set_local $value

  ;; Calculate the address of the segment register
  (i32.add 
    (get_global $Z88_MEMEXT_REGS)
    (get_local $segment) 
  )
  tee_local $srAddr

  ;; Store the register value
  (i32.store8 (get_local $value))

  ;; Calculate and store index page address
  (i32.add  
    (get_global $PAGE_INDEX_16)
    (i32.mul (get_local $segment) (i32.const 6))
  )

  ;; Calculate back address
  (get_global $Z88_MEM_AREA)  ;; Start of Z88 memory (4MB)
  get_local $segment
  if (result i32)
    ;; SR1-SR3
    (i32.or                                           ;; combine segment (bit 7 and bit 6)
      (i32.shl (get_local $segment) (i32.const 6))    ;; segment << 6
      (i32.and                                        ;; mask out unused address lines
        (i32.and (get_local $value) (i32.const 0x3f)) ;; last 6 bit of segment
        (i32.load8_u offset=4 (get_local $srAddr))    ;; address line bit mask
      )
    ) ;; Bank index
  else
    ;; SR 0
    (i32.and (get_local $value) (i32.const 0x3f)) ;; last 6 bit of segment
    (i32.lt_u (get_local $value) (i32.const 0x20))
    if (result i32)
      ;; SR0: ROM, get size
      (i32.load8_u offset=8 (get_global $Z88_MEMEXT_REGS))
    else
      ;; SR0: RAM, get size
      (i32.load8_u offset=4 (get_global $Z88_MEMEXT_REGS))
    end
    i32.and ;; mask out unused address lines
  end
  i32.const 14 
  i32.shl
  i32.add   ;; use the 8 bit bank as the first 8 bits of the 22-bit address
  i32.store ;; store the start address of the page
)

;; Calculates the absolute Z88 memory address from the specified 16-bit address
(func $calcZ88MemoryAddress (param $addr i32) (result i32)
  ;; TODO: Implement this function
  i32.const 0x0000
  return
)

;; Sets the value of the specified slot mask
(func $setSlotMask (param $slot i32) (param $v i32)
  ;; Clamp slot number
  (i32.gt_u (get_local $slot) (i32.const 4))
  if
    i32.const 4 set_local $slot
  end

  ;; Store slot mask value
  (i32.store8 offset=4
    (i32.add (get_global $Z88_MEMEXT_REGS) (get_local $slot))
    (get_local $v)
  )

  ;; Get reduced slot number
  (i32.and (get_local $slot) (i32.const 0x03))

  ;; Obtain slot value to set
  (i32.add 
    (get_global $Z88_MEMEXT_REGS) 
    (i32.and (get_local $slot) (i32.const 0x03))
  )
  i32.load8_u 

  ;; Update the segment index
  call $setZ88MemorySegment
)
