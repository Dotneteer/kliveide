;; ==========================================================================
;; ZX Spectrum 48K functions

;; Reads the memory of the ZX Spectrum 48 machine
(func $readMemorySp48 (param $addr i32) (result i32)
  get_global $BANK_0_OFFS
  (i32.and (get_local $addr) (i32.const 0xffff))
  i32.add
  i32.load8_u ;; (memory value)

  (i32.and (get_local $addr) (i32.const 0xc000))
  (i32.eq (i32.const 0x4000))
  if
    call $applyContentionDelay
  end
)

;; Reads the memory of the ZX Spectrum 48 machine in non-contended way
(func $readMemoryNcSp48 (param $addr i32) (result i32)
  get_global $BANK_0_OFFS
  (i32.and (get_local $addr) (i32.const 0xffff))
  i32.add
  i32.load8_u ;; (memory value)
)

;; Writes the memory of the ZX Spectrum 48 machine
(func $writememorySp48 (param $addr i32) (param $val i32)
  (local $memSegment i32)
  (i32.and (get_local $addr) (i32.const 0xffff)) ;; ($addr)
  (i32.and (tee_local $addr) (i32.const 0xc000))
  (i32.eq (tee_local $memSegment) (i32.const 0x0000))
  ;; Do not write to ROM
  if return end

  (i32.eq (get_local $memSegment) (i32.const 0x4000))
  if
    call $applyContentionDelay
  end
  (i32.add (get_global $BANK_0_OFFS) (get_local $addr))
  get_local $val
  i32.store8
)

;; Reads a port of the ZX Spectrum 48 machine
;; $addr: port address
;; Returns: value read from port
(func $readPortSp48 (param $addr i32) (result i32)
  (call $applyIOContentionDelay (get_local $addr))
  (i32.and (get_local $addr) (i32.const 0x0001))
  (i32.eq (i32.const 0))
  if
    ;; Handle the 0xfe port
    (call $readPort$FE (get_local $addr))
    return
  end

  (i32.and (get_local $addr) (i32.const 0x00e0))
  (i32.eq (i32.const 0))
  if
    ;; Handle the Kempston port
    i32.const 0xff
    return
  end

  ;; TODO: Implement floating port handling
  i32.const 0xff
)

;; Writes a port of the ZX Spectrum 48 machine
;; $addr: port address
;; $v: Port value
(func $writePortSp48 (param $addr i32) (param $v i32)
  (call $applyIOContentionDelay (get_local $addr))
  (i32.and (get_local $addr) (i32.const 0x0001))
  (i32.eq (i32.const 0))
  if
    ;; Handle the 0xfe port
    (call $writePort$FE (get_local $addr) (get_local $v))
    return
  end
)

;; Sets up the ZX Spectrum 48 machine
(func $setupSpectrum48
  ;; CPU configuration
  i32.const 3_500_000 set_global $baseClockFrequency
  i32.const 1 set_global $clockMultiplier
  i32.const 0 set_global $supportsNextOperation
  
  ;; Memory configuration
  i32.const 1 set_global $numberOfRoms
  get_global $ROM_48_OFFS set_global $romContentsAddress
  i32.const 0 set_global $spectrum48RomIndex
  i32.const 1 set_global $contentionType
  i32.const 0 set_global $ramBanks
  i32.const 0 set_global $nextMemorySize

  ;; Screen frame configuration
  i32.const 11 set_global $interruptTact
  i32.const 8 set_global $verticalSyncLines
  i32.const 8 set_global $nonVisibleBorderTopLines
  i32.const 48 set_global $borderTopLines
  i32.const 48 set_global $borderBottomLines
  i32.const 8 set_global $nonVisibleBorderBottomLines
  i32.const 192 set_global $displayLines
  i32.const 24 set_global $borderLeftTime
  i32.const 24 set_global $borderRightTime
  i32.const 128 set_global $displayLineTime
  i32.const 40 set_global $horizontalBlankingTime
  i32.const 8 set_global $nonVisibleBorderRightTime
  i32.const 2 set_global $pixelDataPrefetchTime
  i32.const 1 set_global $attributeDataPrefetchTime

  call $calcScreenAttributes
  call $initRenderingTactTable

  ;; Tape device data
  i32.const 0x056c set_global $tapeLoadBytesRoutine
  i32.const 0x056b set_global $tapeLoadBytesInvalidHeader
  i32.const 0x05e2 set_global $tapeLoadBytesResume
  i32.const 0x04c2 set_global $tapeSaveBytesRoutine

  ;; Setup ROM
  (call $copyMemory 
    (get_global $ROM_48_OFFS)
    (get_global $BANK_0_OFFS)
    (i32.const 0x4000)
  )
)

;; Gets the ZX Spectrum 48 machine state
(func $getSpectrum48MachineState
)

;; Colotizes the pixel data of ZX Spectrum 48
(func $colorizeSp48
  (local $sourcePtr i32)
  (local $destPtr i32)
  (local $counter i32)

  ;; Calculate the counter
  (i32.mul (get_global $screenLines) (get_global $screenWidth))
  set_local $counter

  ;; Reset the pointers
  get_global $PIXEL_RENDERING_BUFFER set_local $sourcePtr
  get_global $COLORIZATION_BUFFER set_local $destPtr

  loop $colorizeLoop
    get_local $counter
    if
      get_local $destPtr ;; [destPtr]
      get_global $SPECTRUM_PALETTE ;; [destPtr, palette]

      ;; Get the pixel information
      get_local $sourcePtr
      i32.load8_u
      (i32.and (i32.const 0x0f))
      (i32.shl (i32.const 2)) ;; [destPtr, palette, pixelPalOffset]
      i32.add  ;; [destPtr, paletteAddr]
      i32.load ;; [destPtr, color]
      i32.store

      ;; Increment pointers
      (i32.add (get_local $sourcePtr) (i32.const 1))
      set_local $sourcePtr
      (i32.add (get_local $destPtr) (i32.const 4))
      set_local $destPtr

      ;; Decrement counter
      (i32.sub (get_local $counter) (i32.const 1))
      set_local $counter

      ;; Next loop
      br $colorizeLoop
    end
  end
)

;; ==========================================================================
;; Breakpoint management

;; Erases all breakpoints
(func $eraseBreakPoints
  (local $counter i32)
  (local $addr i32)
  i32.const 0x2000 set_local $counter
  get_global $BREAKPOINT_MAP set_local $addr
  loop $eraseLoop
    get_local $counter
    if
      (i32.store8 (get_local $addr) (i32.const 0))
      (i32.add (get_local $addr) (i32.const 1))
      set_local $addr
      (i32.sub (get_local $counter) (i32.const 1))
      set_local $counter
      br $eraseLoop
    end
  end
)

;; Sets the specified breakpoint
(func $setBreakpoint (param $brpoint i32)
  (local $addr i32)
  get_global $BREAKPOINT_MAP
  (i32.shr_u (get_local $brpoint) (i32.const 3))
  i32.add
  tee_local $addr
  get_local $addr
  i32.load8_u ;; [ addr, brpoint byte ]

  (i32.shl
    (i32.const 0x01)
    (i32.and (get_local $brpoint) (i32.const 0x07))
  ) ;; Mask to set
  i32.or ;; [ addr, new brpoint]
  i32.store8
)

;; Erases the specified breakpoint
(func $removeBreakpoint (param $brpoint i32)
  (local $addr i32)
  get_global $BREAKPOINT_MAP
  (i32.shr_u (get_local $brpoint) (i32.const 3))
  i32.add
  tee_local $addr
  get_local $addr
  i32.load8_u ;; [ addr, brpoint byte ]

  (i32.xor
    (i32.shl
      (i32.const 0x01)
      (i32.and (get_local $brpoint) (i32.const 0x07))
    )
    (i32.const 0xff)
  )
  ;; Mask to reset
  i32.and ;; [ addr, new brpoint]
  i32.store8
)

;; Tests the specified breakpoint
(func $testBreakpoint (param $brpoint i32) (result i32)
  get_global $BREAKPOINT_MAP
  (i32.shr_u (get_local $brpoint) (i32.const 3))
  i32.add
  i32.load8_u ;; [ brpoint byte ]

  (i32.shl
    (i32.const 0x01)
    (i32.and (get_local $brpoint) (i32.const 0x07))
  ) ;; Mask to test
  i32.and
)
