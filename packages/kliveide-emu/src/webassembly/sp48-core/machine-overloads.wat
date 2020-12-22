;; ============================================================================
;; ZX Spectrum machine overload methods

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
;; 0x0A: 6 bytes unused

;; ----------------------------------------------------------------------------
;; Z80 I/O access

;; Reads the specified I/O port of the current machine type
;; $addr: 16-bit port address
;; returns: Port value
(func $readPortInternal (param $addr i32) (result i32)
  (local $tactAddr i32)
  (call $applyIOContentionDelay (get_local $addr))

  (i32.and (get_local $addr) (i32.const 0x0001))
  (i32.eq (i32.const 0))
  if
    ;; Handle the 0xfe port
    (call $readPort$FE (get_local $addr))
    (call $incTacts (i32.const 4))
    return
  end

  (i32.and (get_local $addr) (i32.const 0x00e0))
  (i32.eq (i32.const 0))
  if
    ;; Handle the Kempston port
    i32.const 0xff
    (call $incTacts (i32.const 4))
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
  (i32.and (i32.load8_u) (i32.const 0x03))
  (i32.eq (i32.const 0x02))
  if 
    ;; Fetch the attribute value of the current tact
    (i32.add 
      (get_global $memoryScreenOffset)
      (i32.load16_u offset=3 (get_local $tactAddr))
    )
    i32.load8_u
    (call $incTacts (i32.const 4))
    return
  end

  ;; Return the default port value
  i32.const 0xff
  (call $incTacts (i32.const 4))
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
)

;; Writes the ZX Spectrum machine state to the transfer area
(func $getMachineState
  ;; Start with CPU state
  call $getCpuState
  call $getExecutionEngineState
  call $getCommonSpectrumMachineState
)

;; Sets up the ZX Spectrum machine
(func $setupMachine 
  ;; Let's use ULA issue 3 by default
  i32.const 3 set_global $ulaIssue

  ;; CPU configuration
  i32.const 3_500_000 set_global $baseClockFrequency
  i32.const 1 set_global $clockMultiplier
  call $resetCpu
  
  ;; Memory configuration
  i32.const 1 set_global $numberOfRoms
  get_global $ROM_48_OFFS set_global $romContentsAddress
  i32.const 0 set_global $spectrum48RomIndex
  i32.const $MEMCONT_ULA# set_global $contentionType
  i32.const 0 set_global $ramBanks
  i32.const 0 set_global $nextMemorySize
  get_global $BANK_0_OFFS set_global $memoryScreenOffset

  ;; Set up BLOCK_LOOKUP_TABLE
  (call $setMemoryBlockEntry (i32.const 0) (get_global $ROM_48_OFFS) (i32.const 0) (i32.const 1))
  (call $setMemoryBlockEntry (i32.const 1) (get_global $ROM_48_OFFS_H) (i32.const 0) (i32.const 1))
  (call $setMemoryBlockEntry (i32.const 2) (get_global $BANK_0_OFFS) (i32.const 1) (i32.const 0))
  (call $setMemoryBlockEntry (i32.const 3) (get_global $BANK_0_OFFS_H) (i32.const 1) (i32.const 0))
  (call $setMemoryBlockEntry (i32.const 4) (get_global $BANK_1_OFFS) (i32.const 0) (i32.const 0))
  (call $setMemoryBlockEntry (i32.const 5) (get_global $BANK_1_OFFS_H) (i32.const 0) (i32.const 0))
  (call $setMemoryBlockEntry (i32.const 6) (get_global $BANK_2_OFFS) (i32.const 0) (i32.const 0))
  (call $setMemoryBlockEntry (i32.const 7) (get_global $BANK_2_OFFS_H) (i32.const 0) (i32.const 0))

  ;; Set the initial state of a ZX Spectrum machine
  call $resetSpectrumMachine

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

  ;; PSG sound configuration
  i32.const 0 set_global $psgSupportsSound

  ;; Tape device data
  i32.const 0x056c set_global $tapeLoadBytesRoutine
  i32.const 0x056b set_global $tapeLoadBytesInvalidHeader
  i32.const 0x05e2 set_global $tapeLoadBytesResume
  i32.const 0x04c2 set_global $tapeSaveBytesRoutine
)
