;; ============================================================================
;; Implements the ZX Spectrum tape device

;; ----------------------------------------------------------------------------
;; Tape device state

;; Current tape mode
;; 0: Passive
;; 1: Load
;; 2: Save
(global $tapeMode (mut i32) (i32.const 0x0000))

;; The address of the Load Bytes routine in the ZX Spectrum 48 ROM
(global $tapeLoadBytesRoutine (mut i32) (i32.const 0x0000))

;; The address of the Load Bytes Resume routine in the ZX Spectrum 48 ROM
(global $tapeLoadBytesResume (mut i32) (i32.const 0x0000))

;; The address of the Load Bytes Invalid Header routine in the ZX Spectrum 48 ROM
(global $tapeLoadBytesInvalidHeader (mut i32) (i32.const 0x0000))

;; The address of the Save Bytes routine in the ZX Spectrum 48 ROM
(global $tapeSaveBytesRoutine (mut i32) (i32.const 0x0000))

;; The number of tape blocks to play
(global $tapeBlocksToPlay (mut i32) (i32.const 0x0000))

;; Is the entire tape played back?
(global $tapeEof (mut i32) (i32.const 0x0000))

;; The current byte in the tape data buffer
(global $tapeBufferPtr (mut i32) (i32.const 0x0000))

;; The address of the next block to play
(global $tapeNextBlockPtr (mut i32) (i32.const 0x0000))

;; The playing phase of the current block
;; 0: none
;; 1: Pilot signal
;; 2: Sync signal
;; 3: Data part
;; 4: Terminating sync
;; 5: Pause
;; 6: Completed
(global $tapePlayPhase (mut i32) (i32.const 0x0000))

;; The start tact of the current block
(global $tapeStartTact (mut i64) (i64.const 0x0000))

;; End tact of the current pilot
(global $tapePilotEndPos (mut i64) (i64.const 0x0000))

;; End tact of the current sync 1 pulse
(global $tapeSync1EndPos (mut i64) (i64.const 0x0000))

;; End tact of the current sync 2 pulse
(global $tapeSync2EndPos (mut i64) (i64.const 0x0000))

;; Start tact of the current bit
(global $tapeBitStartPos (mut i64) (i64.const 0x0000))

;; Start tact of the current bit
(global $tapeBitPulseLen (mut i64) (i64.const 0x0000))

;; End tact of the current sync 1 pulse
(global $tapeBitMask (mut i32) (i32.const 0x0000))

;; End tact of the current sync 1 pulse
(global $tapeFastLoad (mut i32) (i32.const 0x0001))

;; Start tact of the current bit
(global $tapeTermEndPos (mut i64) (i64.const 0x0000))

;; Start tact of the current bit
(global $tapePauseEndPos (mut i64) (i64.const 0x0000))

;; Last MIC bit activity tact
(global $tapeLastMicBitTact (mut i64) (i64.const 0x0000))

;; Lat MIC bit state
(global $tapeLastMicBit (mut i32) (i32.const 0x0000))

;; The current SAVE phase
;; 0: None, no SAVE operation in progress
;; 1: Pilot, emitting PILOT pulses
;; 2: Sync1, emitting SYNC1 pulse
;; 3: Sync2, emitting SYNC2 pulse
;; 4: Data, emitting BIT0/BIT1 pulses
;; 5: Error, unexpected pluse detected
(global $tapeSavePhase (mut i32) (i32.const 0x0000))

;; Number of pilot pulses
(global $tapePilotPulseCount (mut i32) (i32.const 0x0000))

;; Number of saved data blocks
(global $tapeDataBlockCount (mut i32) (i32.const 0x0000))

;; Previous data pulse received
(global $tapePrevDataPulse (mut i32) (i32.const 0x0000))

;; Lenght of the data saved so far
(global $tapeSaveDataLen (mut i32) (i32.const 0x0000))

;; Offset of the bit being saved
(global $tapeBitOffs (mut i32) (i32.const 0x0000))

;; Data byte being saved
(global $tapeDataByte (mut i32) (i32.const 0x0000))

;; ----------------------------------------------------------------------------
;; Tape constants

;; Pilot pulse length
(global $PILOT_PULSE i64 (i64.const 2168))

;; Pilot pulses in the header blcok
(global $HEADER_PILOT_COUNT i64 (i64.const 8063))

;; Pilot pulses in the data block
(global $DATA_PILOT_COUNT i64 (i64.const 3223))

;; Sync 1 pulse length
(global $SYNC_1_PULSE i64 (i64.const 667))

;; Sync 2 pulse length
(global $SYNC_2_PULSE i64 (i64.const 735))

;; Bit 0 pulse length
(global $BIT_0_PULSE i64 (i64.const 855))

;; Bit 1 pulse length
(global $BIT_1_PULSE i64 (i64.const 1710))

;; Terminating sync pulse length
(global $TERM_SYNC i64 (i64.const 947))

;; ==========================================================================
;; Tape device routines

;; Sets the value of the fast load flag
(func $setFastLoad (param $mode i32)
  get_local $mode set_global $tapeFastLoad
)

;; Checks if tape device hook should be applied
(func $checkTapeHooks
  ;; TODO: check if the ZX Spectrum 48 ROM is active; otherwise return

  (i32.eqz (get_global $tapeMode))
  if
    ;; PASSIVE mode, check for load and save routines
    (i32.eq (get_global $PC) (get_global $tapeLoadBytesRoutine))
    if
      ;; Turn on LOAD mode
      i32.const 1 set_global $tapeMode

      ;; Move to the next block
      call $nextTapeBlock

      (i32.ne (get_global $tapeFastLoad) (i32.const 0))
      if
        call $fastLoad
        i32.const 0 set_global $tapeMode
      end
      return
    end
    (i32.eq (get_global $PC) (get_global $tapeSaveBytesRoutine))
    if
      ;; Turn on SAVE mode
      i32.const 2 set_global $tapeMode

      ;; Initialize SAVE mode variables
      call $getCurrentTactAsI64
      set_global $tapeLastMicBitTact
      i32.const 0x08 set_global $tapeLastMicBit
      i32.const 0 set_global $tapeSavePhase
      i32.const 0 set_global $tapePilotPulseCount
      i32.const 0 set_global $tapeDataBlockCount
      i32.const 0 set_global $tapePrevDataPulse
      i32.const 0 set_global $tapeSaveDataLen
      return
    end
    return
  end

  (i32.eq (get_global $tapeMode) (i32.const 1))
  if
    ;; LOAD MODE. Tape EOF?
    get_global $tapeEof
    if 
      ;; Set PASSIVE mode
      i32.const 0 set_global $tapeMode
      return
    end

    ;; LOAD MODE. Tape Error?
    (i32.eq (get_global $PC) (i32.const 0x0008))
    if
      ;; Set PASSIVE mode
      i32.const 0 set_global $tapeMode
      return
    end
    return
  end

  ;; SAVE Mode
  (i32.eq (get_global $PC) (i32.const 0x0008))
  (i64.gt_u 
    (i64.sub (call $getCurrentTactAsI64) (get_global $tapeLastMicBitTact))
    (i64.const 10_500_000)
  )
  i32.or
  if
    ;; Leave SAVE Mode
    i32.const 0 set_global $tapeMode
    (call $saveModeLeft (get_global $tapeSaveDataLen))
  end
)

;; Calculates an i64 value from the current tact
(func $getCurrentTactAsI64 (result i64)
  (i64.add
    (i64.mul
      (i64.extend_u/i32 (get_global $frameCount))
      (i64.extend_u/i32 (i32.mul (get_global $tactsInFrame) (get_global $clockMultiplier)))
    )
    (i64.extend_u/i32 (get_global $tacts))
  )
)

;; Initializes the tape device
(func $initTape (param $blocks i32)
  get_local $blocks set_global $tapeBlocksToPlay

  ;; Rewind to the first data block to play
  get_global $TAPE_DATA_BUFFER set_global $tapeBufferPtr
  i32.const 0 set_global $tapeEof
)

;; Move to the next block to play
(func $nextTapeBlock
  (local $tmp i32)
  ;; Stop playing if no more blocks
  get_global $tapeEof
  if 
    return
  end

  ;; Is there any blocks left?
  get_global $tapeBlocksToPlay
  i32.eqz
  if
    ;; No, stop playing
    i32.const 1 set_global $tapeEof
    return
  end

  ;; Current block completed? If not, return
  (i32.eq (get_global $tapePlayPhase) (i32.const 6))
  if return end

  ;; OK, move to the next block, get the length of the next block
  (i32.load16_u (get_global $tapeBufferPtr)) ;; [ next block length ]

  ;; Skip block length
  (i32.add (get_global $tapeBufferPtr) (i32.const 2))
  set_global $tapeBufferPtr

  ;; Calculate the start of the next buffer
  (i32.add (get_global $tapeBufferPtr))
  set_global $tapeNextBlockPtr

  ;; Decrement the number of remaining blocks
  (i32.sub (get_global $tapeBlocksToPlay) (i32.const 1))
  set_global $tapeBlocksToPlay

  ;; Reset playing the current block
  ;; Set PILOT phase
  i32.const 1 set_global $tapePlayPhase

  ;; Store start tact
  call $getCurrentTactAsI64
  set_global $tapeStartTact

  ;; Calculate pilot signal end positions
  get_global $DATA_PILOT_COUNT
  get_global $HEADER_PILOT_COUNT
  (i32.and 
    (i32.load8_u (get_global $tapeBufferPtr))
    (i32.const 0x80)
  )
  select ;; [ #of pilot pulses]
  (i64.mul (get_global $PILOT_PULSE))
  set_global $tapePilotEndPos

  (i64.add (get_global $tapePilotEndPos) (get_global $SYNC_1_PULSE))
  set_global $tapeSync1EndPos

  (i64.add (get_global $tapeSync1EndPos) (get_global $SYNC_2_PULSE))
  set_global $tapeSync2EndPos

  ;; Set initial bit mask
  i32.const 0x80 set_global $tapeBitMask
)

;; Gets the current ear bit for the tape
(func $getTapeEarBit (result i32)
  (local $pos i64)
  (local $bitPos i64)
  
  ;; Calculate the current position
  call $getCurrentTactAsI64
  get_global $tapeStartTact
  i64.sub
  set_local $pos

  ;; PILOT or SYNC phase?
  (i32.le_u (get_global $tapePlayPhase) (i32.const 2))
  if

    ;; Generate appropriate pilot or sync EAR bit
    (i64.le_u (get_local $pos) (get_global $tapePilotEndPos))
    if
      ;; Alternating pilot pulses
      (i64.rem_u
        (i64.div_u (get_local $pos) (get_global $PILOT_PULSE))
        (i64.const 2)
      )
      i64.eqz ;; => Low/High EAR bit
      return
    end

    ;; Test SYNC_1 position
    (i64.le_u (get_local $pos) (get_global $tapeSync1EndPos))
    if
      ;; Turn to SYNC phase
      i32.const 2 set_global $tapePlayPhase
      i32.const 0 ;; => Low EAR bit
      return
    end

    ;; Test SYNC_2 position
    (i64.le_u (get_local $pos) (get_global $tapeSync2EndPos))
    if
      ;; Turn to SYNC phase
      i32.const 2 set_global $tapePlayPhase
      i32.const 1 ;; => High EAR bit
      return
    end

    ;; Now, we're ready to change to Data phase
    i32.const 3 set_global $tapePlayPhase
    get_global $tapeSync2EndPos set_global $tapeBitStartPos

    ;; Select the bit pulse length of the first bit of the data byte
    get_global $BIT_1_PULSE
    get_global $BIT_0_PULSE
    (i32.and
      (i32.load8_u (get_global $tapeBufferPtr))
      (get_global $tapeBitMask)
    )
    select
    set_global $tapeBitPulseLen
  end

  ;; Data phase?
  (i32.eq (get_global $tapePlayPhase) (i32.const 3))
  if
    ;; Generate current bit pulse
    (i64.sub (get_local $pos) (get_global $tapeBitStartPos))
    set_local $bitPos

    ;; First pulse?
    (i64.lt_u (get_local $bitPos) (get_global $tapeBitPulseLen))
    if
      i32.const 0 ;; => Low EAR bit
      return
    end 
    (i64.lt_u (get_local $bitPos) 
      (i64.shl (get_global $tapeBitPulseLen) (i64.const 1))
    )
    if
      i32.const 1 ;; => High EAR bit
      return
    end

    ;; Move to the next bit
    (i32.shr_u (get_global $tapeBitMask) (i32.const 1))
    set_global $tapeBitMask
    (i32.eqz (get_global $tapeBitMask))
    if
      ;; Move to the next byte
      i32.const 0x80 set_global $tapeBitMask
      (i32.add (get_global $tapeBufferPtr) (i32.const 1))
      set_global $tapeBufferPtr
    end

    ;; Do we have more bits to play?
    (i32.lt_u (get_global $tapeBufferPtr) (get_global $tapeNextBlockPtr))
    if
      ;; Prepare to the next bit
      (i64.add
        (get_global $tapeBitStartPos)
        (i64.shl (get_global $tapeBitPulseLen) (i64.const 1))
      )  
      set_global $tapeBitStartPos

      ;; Select the bit pulse length of the next bit
      get_global $BIT_1_PULSE
      get_global $BIT_0_PULSE
      (i32.and
        (i32.load8_u (get_global $tapeBufferPtr))
        (get_global $tapeBitMask)
      )
      select
      set_global $tapeBitPulseLen

      ;; We're in the first pulse of the next bit
      i32.const 0 ;; => Low EAR bit
      return
    end

    ;; We've played all data bytes, let's send the terminating pulse
    i32.const 4 set_global $tapePlayPhase

    ;; Prepare to the terminating sync
    (i64.add 
      (i64.add
        (get_global $tapeBitStartPos)
        (i64.shl (get_global $tapeBitPulseLen) (i64.const 1))
      )
      (get_global $TERM_SYNC)
    )
    set_global $tapeTermEndPos
  end

  ;; Termination sync?
  (i32.eq (get_global $tapePlayPhase) (i32.const 4))
  if
    (i64.lt_u (get_local $pos) (get_global $tapeTermEndPos))
    if
      i32.const 0 ;; => Low EAR bit
      return
    end

    ;; We terminated the data, it's pause time
    i32.const 5 set_global $tapePlayPhase
    get_global $tapeTermEndPos
    (i32.mul (get_global $baseClockFrequency) (get_global $clockMultiplier))
    i64.extend_u/i32
    i64.add
    set_global $tapePauseEndPos
    i32.const 1 ;; => High EAR bit
    return
  end

  ;; We produce pause signs
  (i64.gt_u (get_local $pos) (get_global $tapePauseEndPos))
  if
    call $nextTapeBlock
    ;; TODO: sign load completion
  end

  ;; Return with a high bit
  i32.const 1
)

;; Fast loading the tape contents
(func $fastLoad
  (local $isVerify i32)
  (local $tmp i32)

  ;; Stop playing if no more blocks
  get_global $tapeEof
  if return end

  ;; Move AF' to AF
  (i32.store16 
    (i32.const  $AF#)
    (i32.load16_u offset=8 (get_global $REG_AREA_INDEX))
  )

  ;; Check if it is a verify
  (i32.eq
    (i32.and (i32.load16_u (i32.const $AF#)) (i32.const 0xff01))
    (i32.const 0xff00)
  )
  set_local $isVerify

  ;; At this point IX contains the address to load the data, 
  ;; DE shows the #of bytes to load. A contains 0x00 for header, 
  ;; 0xFF for data block
  (i32.ne 
    (i32.load8_u (get_global $tapeBufferPtr))
    (i32.load8_u (i32.const $A#))
  )
  if
    ;; This block has a different type we're expecting
    (i32.store8 
      (i32.const $A#)
      (i32.xor (i32.load8_u (i32.const $A#)) (i32.load8_u (i32.const $L#)))
    )

    ;; Reset Z and C
    (i32.store8 (i32.const $F#)
      (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xBE))
    )
    (call $setPC (get_global $tapeLoadBytesInvalidHeader))
    call $nextTapeBlock
    return
  end

  ;; It is time to load the block
  (i32.store8
    (i32.const $H#)
    (i32.load8_u (i32.const $A#))
  )

  ;; Skip the header byte
  (i32.add (get_global $tapeBufferPtr) (i32.const 1))
  set_global $tapeBufferPtr

  loop $loadByte

    (i32.gt_u (i32.load16_u (i32.const $DE#)) (i32.const 0))
    if
      (i32.store8
        (i32.const $L#)
        (i32.load8_u (get_global $tapeBufferPtr))
      )
      get_local $isVerify
      if
        ;; VERIFY operation
        (i32.ne
          (i32.load8_u (i32.load16_u (i32.const $IX#))) 
          (i32.load8_u (i32.const $L#))
        )
        if
          ;; We read a different byte, it's an error
          ;; Reset Z and C
          (i32.store8 (i32.const $F#)
            (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xBE))
          )
          (call $setPC (get_global $tapeLoadBytesInvalidHeader))
          return
        end
      end

      ;; Store the loaded byte
      (call $writeMemory 
        (i32.load16_u (i32.const $IX#))
        (i32.load8_u (i32.const $L#))
      )

      ;; Calc the checksum
      (i32.store8
        (i32.const $H#)
        (i32.xor (i32.load8_u (i32.const $H#)) (i32.load8_u (i32.const $L#)))
      )
      
      ;; Increment the data pointers
      (i32.store16
        (i32.const $IX#)
        (i32.add (get_global $tapeBufferPtr) (i32.const 1))
        (set_global $tapeBufferPtr)
        (i32.add (i32.load16_u (i32.const $IX#)) (i32.const 1))
      )

      ;; Decrement byte count
      (i32.store16
        (i32.const $DE#)
        (i32.sub (i32.load16_u (i32.const $DE#)) (i32.const 1))
      )
      br $loadByte
    end
  end

  ;; Check the end of the data stream
  (i32.gt_u (get_global $tapeBufferPtr) (get_global $tapeNextBlockPtr))
  if
    ;; Read over the expected length
    ;; Reset Carry to sign error
    (i32.store8 (i32.const $F#)
      (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xfe))
    )
  else
    ;; Verify checksum
    (i32.ne 
      (i32.load8_u (get_global $tapeBufferPtr)) 
      (i32.load8_u (i32.const $H#))
    )
    if
      ;; Wrong checksum
      ;; Reset Carry to sign error
      (i32.store8 (i32.const $F#)
        (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xfe))
      )
    else
      ;; Block read successfully, set Carry
      (i32.store8 (i32.const $F#)
        (i32.or (i32.load8_u (i32.const $F#)) (i32.const 0x01))
      )
    end
  end

  (call $setPC (get_global $tapeLoadBytesResume))

  ;; Sign completion of this block
  i32.const 5 set_global $tapePlayPhase

  ;; Imitate, we're over the pause period
  i64.const 0 set_global $tapePauseEndPos

  ;; OK, move to the next block, get the length of the next block
  get_global $tapeNextBlockPtr set_global $tapeBufferPtr
)

;; This function processes the MIC bit (tape device)
(func $processMicBit (param $micBit i32)
  (local $length i64)    ;; Pulse length
  (local $pulse i32)     ;; The pulse type detected
  (local $tact i64)      ;; Current tact
  (local $nextPhase i32) ;; Next SAVE phase

  ;; Ignore processing when not in
  (i32.ne (get_global $tapeMode) (i32.const 2))
  if return end

  ;; Any change in MIC bit?
  (i32.eq (get_global $tapeLastMicBit) (get_local $micBit))
  if return end

  ;; MIC bit changed, process it
  call $getCurrentTactAsI64 tee_local $tact
  (i64.sub (get_global $tapeLastMicBitTact))
  set_local $length

  ;; Initialize pulse
  i32.const 0 set_local $pulse

  ;; Categorize the pulse by its lenght
  (call $pulseLengthInRange (get_local $length) (get_global $BIT_0_PULSE))
  if
    i32.const 6 set_local $pulse ;; BIT_0
  else
    (call $pulseLengthInRange (get_local $length) (get_global $BIT_1_PULSE))
    if
      i32.const 7 set_local $pulse ;; BIT_1
    else
      (call $pulseLengthInRange (get_local $length) (get_global $PILOT_PULSE))
      if
        i32.const 3 set_local $pulse ;; PILOT
      else
        (call $pulseLengthInRange (get_local $length) (get_global $SYNC_1_PULSE))
        if
          i32.const 4 set_local $pulse ;; SYNC_1
        else
          (call $pulseLengthInRange (get_local $length) (get_global $SYNC_2_PULSE))
          if
            i32.const 5 set_local $pulse ;; SYNC_2
          else
            (call $pulseLengthInRange (get_local $length) (get_global $TERM_SYNC))
            if
              i32.const 8 set_local $pulse ;; TERM_SYNC
            else
              (i64.lt_u 
                (get_local $length) 
                (i64.add (get_global $SYNC_1_PULSE) (i64.const 24))
              )
              if
                i32.const 1 set_local $pulse ;; Too short pulse
              else
                (i64.gt_u 
                  (get_local $length) 
                  (i64.add (get_global $PILOT_PULSE) (i64.const 48))
                )
                if
                  i32.const 1 set_local $pulse ;; Too long pulse
                end
              end
            end
          end
        end
      end
    end
  end

  ;; Now, we have a categorized pulse
  get_local $micBit set_global $tapeLastMicBit
  get_local $tact set_global $tapeLastMicBitTact

  ;; Let's process the pulse according to the current SAVE phase and pulse width
  i32.const 5 set_local $nextPhase ;; Assume ERROR
  (i32.eqz (get_global $tapeSavePhase))
  if
    ;; ------------------------------------------------------------------------
    ;; Process the NONE phase
    (i32.le_u (get_local $pulse) (i32.const 2))
    if
      ;; Pulse too short or too long, we stay in NONE phase
      i32.const 0 set_local $nextPhase ;; NONE phase
    else
      (i32.le_u (get_local $pulse) (i32.const 3)) ;; PILOT pulse?
      if
        ;; The first pilot pulse arrived
        i32.const 1 set_global $tapePilotPulseCount
        i32.const 1 set_local $nextPhase ;; PILOT phase
      end
    end
  else
    (i32.eq (get_global $tapeSavePhase) (i32.const 1))
    if
      ;; ----------------------------------------------------------------------
      ;; Process the PILOT phase
      (i32.eq (get_local $pulse) (i32.const 3)) ;; PILOT pulse?
      if
        ;; The next PILOT PULSE arrived
        (i32.add (get_global $tapePilotPulseCount) (i32.const 1))
        set_global $tapePilotPulseCount
        i32.const 1 set_local $nextPhase ;; PILOT phase
      else
        (i32.eq (get_local $pulse) (i32.const 4)) ;; SYNC1 pulse?
        if
          i32.const 2 set_local $nextPhase ;; SYNC1 phase
        end
      end
    else
      (i32.eq (get_global $tapeSavePhase) (i32.const 2))
      if
        ;; --------------------------------------------------------------------
        ;; Process the SYNC1 phase
        (i32.eq (get_local $pulse) (i32.const 5)) ;; SYNC2 pulse?
        if
          i32.const 3 set_local $nextPhase ;; SYNC2 phase
        end
      else
        (i32.eq (get_global $tapeSavePhase) (i32.const 3))
        if
          ;; ------------------------------------------------------------------
          ;; Process the SYNC2 phase
          (i32.or 
            (i32.eq (get_local $pulse) (i32.const 6)) ;; BIT0 pulse?
            (i32.eq (get_local $pulse) (i32.const 7)) ;; BIT1 pulse?
          )
          if
            ;; Next pulse starts data, prepare for it
            get_local $pulse set_global $tapePrevDataPulse
            i32.const 4 set_local $nextPhase ;; DATA phase
            i32.const 0 set_global $tapeBitOffs
            i32.const 0 set_global $tapeDataByte
          end
        else
          ;; ------------------------------------------------------------------
          ;; Process the DATA phase
          (i32.or 
            (i32.eq (get_local $pulse) (i32.const 6)) ;; BIT0 pulse?
            (i32.eq (get_local $pulse) (i32.const 7)) ;; BIT1 pulse?
          )
          if
            (i32.eqz (get_global $tapePrevDataPulse)) ;; Previour pulse was NONE?
            if
              ;; We are waiting for the second half of the bit pulse
              get_local $pulse set_global $tapePrevDataPulse ;; Save the last pulse type
              i32.const 4 set_local $nextPhase ;; DATA phase
            else
              (i32.eq (get_global $tapePrevDataPulse) (get_local $pulse))
              if
                ;; We received a full valid bit pulse
                i32.const 0 set_global $tapePrevDataPulse ;; Save NONE as the previous pulse type
                i32.const 4 set_local $nextPhase ;; DATA phase

                ;; Add this bit to the received data
                (i32.add (get_global $tapeBitOffs) (i32.const 1))
                set_global $tapeBitOffs

                ;; Shift in the received bit
                (i32.shl (get_global $tapeDataByte) (i32.const 1))
                (i32.eq (get_local $pulse) (i32.const 7))
                i32.or
                set_global $tapeDataByte

                ;; Have we received a full byte?
                (i32.eq (get_global $tapeBitOffs) (i32.const 8))
                if
                  ;; Save the received data
                  (i32.store8 
                    (i32.add (get_global $TAPE_SAVE_BUFFER) (get_global $tapeSaveDataLen))
                    (get_global $tapeDataByte)
                  )
                  (i32.add (get_global $tapeSaveDataLen) (i32.const 1))
                  set_global $tapeSaveDataLen

                  ;; Reset byte state
                  i32.const 0 set_global $tapeDataByte
                  i32.const 0 set_global $tapeBitOffs
                end
              end
            end
          else
            (i32.eq (get_local $pulse) (i32.const 8)) ;; TERMSYNC pulse?
            if
              i32.const 0 set_local $nextPhase
              (i32.add (get_global $tapeDataBlockCount) (i32.const 1))
              set_global $tapeDataBlockCount

              ;; TODO: Prepare for the next block
            end
          end
        end
      end
    end
  end

  ;; Store the next phase
  get_local $nextPhase set_global $tapeSavePhase
)

;; Tests in the pulse length is in the tolerance range of the specified reference
(func $pulseLengthInRange (param $length i64) (param $reference i64) (result i32)
  (i64.ge_u 
    (get_local $length)
    (i64.sub (get_local $reference) (i64.const 24))
  )
  if
    (i64.le_u 
      (get_local $length)
      (i64.add (get_local $reference) (i64.const 24))
    )
    return
  end

  ;; Out of expected range
  i32.const 0
)
