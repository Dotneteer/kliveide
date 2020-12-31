;; ============================================================================
;; ZX Spectrum 128 Machine overloads

;; ----------------------------------------------------------------------------
;; BLOCK_LOOKUP_TABLE entry (for each 8K blocks)

;; 0x00: RD_PTR: Read pointer (4 bytes)
;; 0x04: WR_PTR: Write pointer (4 bytes)
;; 0x08: BL_FLAGS: Flags for the type of memory behind that block
;;       0x00: RAM, can be read and written
;;       0x01: ROM, read-only
;; 0x09: BL_CONT: Contention mode
;;       0x00: Not contended
;;       0x01: Contended
;; 0x0A: Page index, 2 bytes
;; 0x0C: 4 bytes unused

;; ----------------------------------------------------------------------------
;; Z80 I/O access

;; Reads the specified I/O port of the current machine type
;; $addr: 16-bit port address
;; returns: Port value
(func $readPortInternal (param $addr i32) (result i32)
  (local $tactAddr i32)
  (local $phase i32)
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

  ;; Floating port handling
  ;; Get rendering table entry of the current ULA tact
  (i32.add
    (get_global $RENDERING_TACT_TABLE)
    (i32.mul 
      (i32.div_u (get_global $tacts) (get_global $clockMultiplier))
      (i32.const 5)
    )
  )
  tee_local $tactAddr

  ;; Check phase
  i32.load8_u tee_local $phase
  (i32.and (i32.const 0x03))
  (i32.eq (i32.const 0x02))
  if 
    ;; Fetch the attribute value of the current tact
    (i32.add 
      (get_global $memoryScreenOffset)
      (i32.load16_u offset=3 (get_local $tactAddr))
    )
    i32.load8_u
    return
  end

  ;; Return the default port value
  i32.const 0xff
)

;; Writes the specified port of the current machine type
;; $addr: 16-bit port address
;; $v: 8-bit value to write
(func $writePortInternal (param $addr i32) (param $v i32)
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
  (local $pageOffset i32)
  (local $contention i32)
  (local $rom i32)

  ;; Check if memory paging is enabled
  (i32.eqz (get_global $memoryPagingEnabled))
  if return end

  ;; Set up block #6 values
  (call $setMemoryBlockEntry
    (i32.const 6)
    (tee_local $pageOffset
      (i32.add
        (i32.shl 
          (i32.and (get_local $v) (i32.const 0x07))
          (i32.const 14)
        )
        (get_global $BANK_0_OFFS)
      )
    )
    (tee_local $contention (i32.and (get_local $v) (i32.const 0x01)))
    (i32.const 0)
  )

  ;; Set up block #7 values
  (call $setMemoryBlockEntry
    (i32.const 7)
    (i32.add (get_local $pageOffset) (i32.const 0x2000))
    (get_local $contention)
    (i32.const 0)
  )

  ;; Set page indexes
  (call $setMemoryPageIndex
    (i32.const 6)
    (i32.and (get_local $v) (i32.const 0x07))
  )
  (call $setMemoryPageIndex
    (i32.const 7)
    (i32.and (get_local $v) (i32.const 0x07))
  )

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
    (call $setMemoryPageIndex (i32.const 0) (i32.const 0x11))
    (call $setMemoryPageIndex (i32.const 1) (i32.const 0x11))
    i32.const 1 set_global $memorySelectedRom
    get_global $ROM_128_1_OFFS
  else
    (call $setMemoryPageIndex (i32.const 0) (i32.const 0x10))
    (call $setMemoryPageIndex (i32.const 1) (i32.const 0x10))
    i32.const 0 set_global $memorySelectedRom
    get_global $ROM_128_0_OFFS
  end
  tee_local $pageOffset

  ;; Set block #0
  (call $setMemoryBlockEntry (i32.const 0) (i32.const 1))

  ;; Set block #1
  (call $setMemoryBlockEntry 
    (i32.const 1)
    (i32.add (get_local $pageOffset) (i32.const 0x2000))
    (i32.const 0)
    (i32.const 1)
  )

  ;; Paging enabled flag
  (i32.xor
    (i32.and (get_local $v) (i32.const 0x20))
    (i32.const 0x20)
  )
  set_global $memoryPagingEnabled
)

;; Writes the ZX Spectrum machine state to the transfer area
(func $getMachineState
  call $getCpuState
  call $getExecutionEngineState
  call $getCommonSpectrumMachineState

  ;; Obtain PSG attributes
  (i32.store16 offset=420 (get_global $STATE_TRANSFER_BUFF) (get_global $psgToneA))
  (i32.store8 offset=422 (get_global $STATE_TRANSFER_BUFF) (get_global $psgToneAEnabled))
  (i32.store8 offset=423 (get_global $STATE_TRANSFER_BUFF) (get_global $psgNoiseAEnabled))
  (i32.store8 offset=424 (get_global $STATE_TRANSFER_BUFF) (get_global $psgVolA))
  (i32.store8 offset=425 (get_global $STATE_TRANSFER_BUFF) (get_global $psgEnvA))
  (i32.store16 offset=426 (get_global $STATE_TRANSFER_BUFF) (get_global $psgCntA))
  (i32.store8 offset=428 (get_global $STATE_TRANSFER_BUFF) (get_global $psgBitA))

  (i32.store16 offset=429 (get_global $STATE_TRANSFER_BUFF) (get_global $psgToneB))
  (i32.store8 offset=431 (get_global $STATE_TRANSFER_BUFF) (get_global $psgToneBEnabled))
  (i32.store8 offset=432 (get_global $STATE_TRANSFER_BUFF) (get_global $psgNoiseBEnabled))
  (i32.store8 offset=433 (get_global $STATE_TRANSFER_BUFF) (get_global $psgVolB))
  (i32.store8 offset=434 (get_global $STATE_TRANSFER_BUFF) (get_global $psgEnvB))
  (i32.store16 offset=435 (get_global $STATE_TRANSFER_BUFF) (get_global $psgCntB))
  (i32.store8 offset=437 (get_global $STATE_TRANSFER_BUFF) (get_global $psgBitB))

  (i32.store16 offset=438 (get_global $STATE_TRANSFER_BUFF) (get_global $psgToneC))
  (i32.store8 offset=440 (get_global $STATE_TRANSFER_BUFF) (get_global $psgToneCEnabled))
  (i32.store8 offset=441 (get_global $STATE_TRANSFER_BUFF) (get_global $psgNoiseCEnabled))
  (i32.store8 offset=442 (get_global $STATE_TRANSFER_BUFF) (get_global $psgVolC))
  (i32.store8 offset=443 (get_global $STATE_TRANSFER_BUFF) (get_global $psgEnvC))
  (i32.store16 offset=444 (get_global $STATE_TRANSFER_BUFF) (get_global $psgCntC))
  (i32.store8 offset=446 (get_global $STATE_TRANSFER_BUFF) (get_global $psgBitC))

  (i32.store16 offset=447 (get_global $STATE_TRANSFER_BUFF) (get_global $psgNoiseSeed))
  (i32.store16 offset=449 (get_global $STATE_TRANSFER_BUFF) (get_global $psgNoiseFreq))
  (i32.store16 offset=451 (get_global $STATE_TRANSFER_BUFF) (get_global $psgCntNoise))
  (i32.store8 offset=453 (get_global $STATE_TRANSFER_BUFF) (get_global $psgBitNoise))
  (i32.store16 offset=454 (get_global $STATE_TRANSFER_BUFF) (get_global $psgEnvFreq))
  (i32.store8 offset=456 (get_global $STATE_TRANSFER_BUFF) (get_global $psgEnvStyle))
  (i32.store16 offset=457 (get_global $STATE_TRANSFER_BUFF) (get_global $psgCntEnv))
  (i32.store16 offset=459 (get_global $STATE_TRANSFER_BUFF) (get_global $psgPosEnv))
)

;; Sets up the ZX Spectrum machine
(func $setupMachine 
  ;; Let's use ULA issue 3 by default
  i32.const 3 set_global $ulaIssue

  ;; CPU configuration
  (set_global $baseClockFrequency (i32.const 3_546_900))
  (set_global $clockMultiplier (get_global $defaultClockMultiplier))

  call $resetCpu
  
  ;; Memory configuration
  (set_global $numberOfRoms (i32.const 2))
  (set_global $romContentsAddress (get_global $ROM_128_1_OFFS))
  (set_global $spectrum48RomIndex (i32.const 1))
  (set_global $contentionType (i32.const 1))
  (set_global $ramBanks (i32.const 8))
  (set_global $nextMemorySize (i32.const 0))
  (set_global $memoryScreenOffset (get_global $BANK_5_OFFS))

  ;; Set up BLOCK_LOOKUP_TABLE
  (call $setMemoryBlockEntry (i32.const 0) (get_global $ROM_128_0_OFFS) (i32.const 0) (i32.const 1))
  (call $setMemoryPageIndex (i32.const 0) (i32.const 0x10))
  (call $setMemoryBlockEntry (i32.const 1) (get_global $ROM_128_0_OFFS_H) (i32.const 0) (i32.const 1))
  (call $setMemoryPageIndex (i32.const 1) (i32.const 0x10))
  (call $setMemoryBlockEntry (i32.const 2) (get_global $BANK_5_OFFS) (i32.const 1) (i32.const 0))
  (call $setMemoryPageIndex (i32.const 2) (i32.const 5))
  (call $setMemoryBlockEntry (i32.const 3) (get_global $BANK_5_OFFS_H) (i32.const 1) (i32.const 0))
  (call $setMemoryPageIndex (i32.const 3) (i32.const 5))
  (call $setMemoryBlockEntry (i32.const 4) (get_global $BANK_2_OFFS) (i32.const 0) (i32.const 0))
  (call $setMemoryPageIndex (i32.const 4) (i32.const 2))
  (call $setMemoryBlockEntry (i32.const 5) (get_global $BANK_2_OFFS_H) (i32.const 0) (i32.const 0))
  (call $setMemoryPageIndex (i32.const 5) (i32.const 2))
  (call $setMemoryBlockEntry (i32.const 6) (get_global $BANK_0_OFFS) (i32.const 0) (i32.const 0))
  (call $setMemoryPageIndex (i32.const 6) (i32.const 0))
  (call $setMemoryBlockEntry (i32.const 7) (get_global $BANK_0_OFFS_H) (i32.const 0) (i32.const 0))
  (call $setMemoryPageIndex (i32.const 7) (i32.const 0))

  ;; Set the initial state of a ZX Spectrum machine
  call $resetSpectrumMachine

  ;; Screen frame configuration
  (set_global $interruptTact (i32.const 14))
  (set_global $verticalSyncLines (i32.const 8))
  (set_global $nonVisibleBorderTopLines (i32.const 7))
  (set_global $borderTopLines (i32.const 48))
  (set_global $borderBottomLines (i32.const 48))
  (set_global $nonVisibleBorderBottomLines (i32.const 8))
  (set_global $displayLines (i32.const 192))
  (set_global $borderLeftTime (i32.const 24))
  (set_global $borderRightTime (i32.const 24)) 
  (set_global $displayLineTime (i32.const 128))
  (set_global $horizontalBlankingTime (i32.const 40))
  (set_global $nonVisibleBorderRightTime (i32.const 12))
  (set_global $pixelDataPrefetchTime (i32.const 2))
  (set_global $attributeDataPrefetchTime (i32.const 1))

  call $calcScreenAttributes
  call $initRenderingTactTable
  call $initEnvelopeTables
  call $initSound

  ;; PSG sound configuration
  (set_global $psgSupportsSound (i32.const 1))

  ;; Tape device data
  (set_global $tapeLoadBytesRoutine (i32.const 0x056c))
  (set_global $tapeLoadBytesInvalidHeader (i32.const 0x056b))
  (set_global $tapeLoadBytesResume (i32.const 0x05e2))
  (set_global $tapeSaveBytesRoutine (i32.const 0x04c2))
)

;; Sets the memory page index for the specified block
(func $setMemoryPageIndex (param $block i32) (param $index i32)
  (i32.add
    (get_global $BLOCK_LOOKUP_TABLE)
    (i32.mul
      (i32.and (get_local $block) (i32.const 0x07))
      (i32.const 16)
    )
  )
  (i32.store8 offset=10 (get_local $index))
)
