;; ==========================================================================
;; ZX Spectrum 48K functions

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
  get_global $BANK_0_OFFS set_global $memoryScreenOffset

  ;; Set up memory pages
  (call $setMemoryPageIndex (i32.const 0) (get_global $ROM_48_OFFS) (i32.const 0) (i32.const 1))
  (call $setMemoryPageIndex (i32.const 1) (get_global $BANK_0_OFFS) (i32.const 1) (i32.const 0))
  (call $setMemoryPageIndex (i32.const 2) (get_global $BANK_1_OFFS) (i32.const 0) (i32.const 0))
  (call $setMemoryPageIndex (i32.const 3) (get_global $BANK_2_OFFS) (i32.const 0) (i32.const 0))

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

