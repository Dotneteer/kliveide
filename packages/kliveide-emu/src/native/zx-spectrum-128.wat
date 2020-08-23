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

  ;; Test for PSG register index port
  (i32.and (get_local $addr) (i32.const 0xc002))
  (i32.eq (i32.const 0xc000))
  if
    (call $psgReadPsgRegisterValue)
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

  ;; Test for memory paging port
  (i32.and (get_local $addr) (i32.const 0xc002))
  (i32.eq (i32.const 0x4000))
  if
    (call $handleMemoryPagingPort (get_local $v))
    return
  end

  ;; Test for PSG register index port
  (i32.and (get_local $addr) (i32.const 0xc002))
  (i32.eq (i32.const 0xc000))
  if
    ;; Store the selected PSG reginster index
    (i32.and (get_local $v) (i32.const 0x0f))
    set_global $psgRegisterIndex
    return
  end

  ;; Test for PSG register value port
  (i32.and (get_local $addr) (i32.const 0xc002))
  (i32.eq (i32.const 0x8000))
  if
    (call $psgWriteRegisterValue (get_local $v))
    return
  end
)

;; Handles port writes to the memory paging port
(func $handleMemoryPagingPort (param $v i32)
  ;; Check if memory paging is enabled
  (i32.eqz (get_global $memoryPagingEnabled))
  if return end

  ;; Update the current bank
  ;; Get page index
  i32.const 3

  ;; Get page offset
  (i32.add
    (i32.shl 
      (i32.and (get_local $v) (i32.const 0x07))
      (i32.const 14)
    )
    (get_global $BANK_0_OFFS)
  )

  ;; Get contention information
  (i32.and (get_local $v) (i32.const 0x01))

  ;; Get read-only flag
  i32.const 0
  call $setMemoryPageIndex

  ;; Handle shadow screen
  (i32.and (get_local $v) (i32.const 0x08))
  if
    i32.const 1 set_global $memoryUseShadowScreen
    get_global $BANK_7_OFFS set_global $memoryScreenOffset
  else
    i32.const 0 set_global $memoryUseShadowScreen
    get_global $BANK_5_OFFS set_global $memoryScreenOffset
  end

  ;; Set memory page index
  i32.const 0

  ;; Select ROM page
  (i32.and (get_local $v) (i32.const 0x10))
  if (result i32)
    i32.const 1 set_global $memorySelectedRom
    get_global $ROM_128_1_OFFS
  else
    i32.const 0 set_global $memorySelectedRom
    get_global $ROM_128_0_OFFS
  end
  (call $setMemoryPageIndex (i32.const 0) (i32.const 1))

  ;; Paging enabled flag
  (i32.xor
    (i32.and (get_local $v) (i32.const 0x20))
    (i32.const 0x20)
  )
  set_global $memoryPagingEnabled
)

;; Handles writes to the PSG value port
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
  get_global $BANK_5_OFFS set_global $memoryScreenOffset

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
