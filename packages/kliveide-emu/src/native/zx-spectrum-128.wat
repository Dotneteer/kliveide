;; ==========================================================================
;; ZX Spectrum 128K functions

;; Reads a port of the ZX Spectrum 48 machine
;; $addr: port address
;; Returns: value read from port
(func $readPortSp128 (param $addr i32) (result i32)
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
(func $writePortSp128 (param $addr i32) (param $v i32)
  (call $applyIOContentionDelay (get_local $addr))
  (i32.and (get_local $addr) (i32.const 0x0001))
  (i32.eq (i32.const 0))
  if
    ;; Handle the 0xfe port
    (call $writePort$FE (get_local $addr) (get_local $v))
    return
  end

  (i32.and (get_local $addr) (i32.const 0x4002))
  (i32.eq (i32.const 0x4000))
  if
    ;; Handle the memory paging port port
    i32.const 444444
    call $trace
    return
  end

)

;; Sets up the ZX Spectrum 48 machine
(func $setupSpectrum128
  ;; CPU configuration
  i32.const 3_546_900 set_global $baseClockFrequency
  i32.const 1 set_global $clockMultiplier
  i32.const 0 set_global $supportsNextOperation
  
  ;; Memory configuration
  i32.const 2 set_global $numberOfRoms
  get_global $ROM_128_1_OFFS set_global $romContentsAddress
  i32.const 1 set_global $spectrum48RomIndex
  i32.const 1 set_global $contentionType
  i32.const 8 set_global $ramBanks
  i32.const 0 set_global $nextMemorySize

  ;; Set up memory pages
  (call $setMemoryPageIndex (i32.const 0) (get_global $ROM_128_0_OFFS) (i32.const 0) (i32.const 1))
  (call $setMemoryPageIndex (i32.const 1) (get_global $BANK_5_OFFS) (i32.const 1) (i32.const 0))
  (call $setMemoryPageIndex (i32.const 2) (get_global $BANK_2_OFFS) (i32.const 0) (i32.const 0))
  (call $setMemoryPageIndex (i32.const 3) (get_global $BANK_0_OFFS) (i32.const 0) (i32.const 0))

  ;; Screen frame configuration
  i32.const 14 set_global $interruptTact
  i32.const 8 set_global $verticalSyncLines
  i32.const 7 set_global $nonVisibleBorderTopLines
  i32.const 48 set_global $borderTopLines
  i32.const 48 set_global $borderBottomLines
  i32.const 8 set_global $nonVisibleBorderBottomLines
  i32.const 192 set_global $displayLines
  i32.const 24 set_global $borderLeftTime
  i32.const 24 set_global $borderRightTime
  i32.const 128 set_global $displayLineTime
  i32.const 40 set_global $horizontalBlankingTime
  i32.const 12 set_global $nonVisibleBorderRightTime
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
(func $getSpectrum128MachineState
)
