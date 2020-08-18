;; ==========================================================================
;; ZX Spectrum engine core
;; ==========================================================================
;; ZX Spectrum configuration

;; Base CPU clock frequency
(global $baseClockFrequency (mut i32) (i32.const 0x0000))

;; Clock frequency multiplier
(global $clockMultiplier (mut i32) (i32.const 0x0000))

;; Supports ZX Spectrrum Next operations?
(global $supportsNextOperation (mut i32) (i32.const 0x0000))

;; Number of ROMs
(global $numberOfRoms (mut i32) (i32.const 0x0000))

;; The address in memory where the machine's ROM contents start
(global $romContentsAddress (mut i32) (i32.const 0x0000))

;; The index of the ROM with ZX Spectrum 48 code
(global $spectrum48RomIndex (mut i32) (i32.const 0x0000))

;; Contention type of memory
;; 0: No contention
;; 1: ULA
;; 2: GateArray
;; 3: ZX Spectrum Next
(global $contentionType (mut i32) (i32.const 0x0000))

;; Number of RAM banks
(global $ramBanks (mut i32) (i32.const 0x0000))

;; Size of Next memory in KBytes
;; 0 - Legacy models that do not support Next memory mapping
;; 512 - 512KBytes
;; 1024 - 1024 KBytes
;; 1536 - 1.5MBytes
;; 2048 - 2 MBytes
(global $nextMemorySize (mut i32) (i32.const 0x0000))

;; The tact index of the interrupt relative to the top-left screen pixel
(global $interruptTact (mut i32) (i32.const 0x0000))

;; Number of lines used for vertical sync
(global $verticalSyncLines (mut i32) (i32.const 0x0000))

;; The number of top border lines that are not visible when rendering the screen
(global $nonVisibleBorderTopLines (mut i32) (i32.const 0x0000))

;; The number of border lines before the display
(global $borderTopLines (mut i32) (i32.const 0x0000))

;; Number of display lines
(global $displayLines (mut i32) (i32.const 0x0000))

;; The number of border lines after the display
(global $borderBottomLines (mut i32) (i32.const 0x0000))

;; The number of bottom border lines that are not visible when rendering the screen
(global $nonVisibleBorderBottomLines (mut i32) (i32.const 0x0000))

;; Horizontal blanking time (HSync+blanking). Given in Z80 clock cycles.
(global $horizontalBlankingTime (mut i32) (i32.const 0x0000))

;; The time of displaying left part of the border. Given in Z80 clock cycles.
(global $borderLeftTime (mut i32) (i32.const 0x0000))

;; The time of displaying a pixel row. Given in Z80 clock cycles.
(global $displayLineTime (mut i32) (i32.const 0x0000))

;; The time of displaying right part of the border. Given in Z80 clock cycles.
(global $borderRightTime (mut i32) (i32.const 0x0000))

;; The time used to render the nonvisible right part of the border. Given in Z80 clock cycles.
(global $nonVisibleBorderRightTime (mut i32) (i32.const 0x0000))

;; The time the data of a particular pixel should be prefetched before displaying it.
;; Given in Z80 clock cycles.
(global $pixelDataPrefetchTime (mut i32) (i32.const 0x0000))

;; The time the data of a particular pixel attribute should be prefetched before displaying it.
;; Given in Z80 clock cycles.
(global $attributeDataPrefetchTime (mut i32) (i32.const 0x0000))

;; Total number of screen lines
(global $screenLines (mut i32) (i32.const 0x0000))

;; First visible display line
(global $firstDisplayLine (mut i32) (i32.const 0x0000))

;; Last visible display line
(global $lastDisplayLine (mut i32) (i32.const 0x0000))

;; Number of pixels in the left border
(global $borderLeftPixels (mut i32) (i32.const 0x0000))

;; Number of pixels in the right border
(global $borderRightPixels (mut i32) (i32.const 0x0000))

;; Width of display in pixels
(global $displayWidth (mut i32) (i32.const 0x0000))

;; Total width of the screen
(global $screenWidth (mut i32) (i32.const 0x0000))

;; Total time of a screen line
(global $screenLineTime (mut i32) (i32.const 0x0000))

;; Total number of raster lines (including the non-visible ones)
(global $rasterLines (mut i32) (i32.const 0x0000))

;; The tact in which the top left pixel should be displayed. Given in Z80 clock cycles.
(global $firstDisplayPixelTact (mut i32) (i32.const 0x0000))

;; The tact at which the first pixel is displayed
(global $firstScreenPixelTact (mut i32) (i32.const 0x0000))

;; ==========================================================================
;; ZX Spectrum execution engine state

;; The ULA issue of the engine
(global $ulaIssue (mut i32) (i32.const 0x0000))

;; The last rendered ULA tact
(global $lastRenderedUlaTact (mut i32) (i32.const 0x0000))

;; Number of frames rendered
(global $frameCount (mut i32) (i32.const 0x0000))

;; Indicates that a screen frame has just completed
(global $frameCompleted (mut i32) (i32.const 0x0000))

;; Gets or sets the value of the contention accummulated since the start
;; of the machine
(global $contentionAccummulated (mut i32) (i32.const 0x0000))

;; Gets the value of the contention accummulated since the last execution
;; cycle started
(global $lastExecutionContentionValue (mut i32) (i32.const 0x0000))

;; The emulation mode to use with the execution cycle
;; 0: Debugger
;; 1: UntilHalt
;; 2: UntilCpuFrameEnds
;; 3: UntilUlaFrameEnds
;; 4: UntilExecutionPoint
(global $emulationMode (mut i32) (i32.const 0x0000))

;; The debug step mode to use with the execution cycle
;; (only when $emulationMode is Debugger)
;; 0: StopAtBreakPoints
;; 1: StepInto
;; 2: StepOver
;; 3: StepOut
(global $debugStepMode (mut i32) (i32.const 0x0000))

;; Indicates if fast tape mode is allowed
(global $fastTapeMode (mut i32) (i32.const 0x0000))

;; The index of the ROM when a termination point is defined
(global $terminationRom (mut i32) (i32.const 0x0000))

;; The value of the PC register to reach when a termination point 
;; is defined
(global $terminationPoint (mut i32) (i32.const 0x0000))

;; This flag shows that the virtual machine should run in hidden mode
;; (no screen, no sound, no delays)
(global $fastVmMode (mut i32) (i32.const 0x0000))

;; This flag shows whether the virtual machine should render the screen.
;; True, renders the screen; false, does not render the screen.
;; This flag overrides the $fastVmMode setting.
(global $disableScreenRendering (mut i32) (i32.const 0x0000))

;; The reason the execution cycle completed.
;; 0: The machine is still executing
;; 1: Termination point reached
;; 2: Breakpoint reached
;; 3: Halted
;; 4: CPU frame completed
;; 5: Screen rendering frame/ULA frame completed
(global $executionCompletionReason (mut i32) (i32.const 0x0000))

;; The step-over breakpoint
(global $stepOverBreakpoint (mut i32) (i32.const 0x0000))

;; ==========================================================================
;; Port device state

;; Last value of bit 3 on port $FE
(global $portBit3LastValue (mut i32) (i32.const 0x0000))

;; Last value of bit 4 on port $FE
(global $portBit4LastValue (mut i32) (i32.const 0x0000))

;; Tacts value when last time bit 4 of $fe changed from 0 to 1
(global $portBit4ChangedFrom0Tacts (mut i32) (i32.const 0x0000))

;; Tacts value when last time bit 4 of $fe changed from 1 to 0
(global $portBit4ChangedFrom1Tacts (mut i32) (i32.const 0x0000))

;; ==========================================================================
;; Interrupt device state

;; Signs that an interrupt has been raised in the current frame.
(global $interruptRaised (mut i32) (i32.const 0x0000))

;; Signs that the interrupt request has been revoked.
(global $interruptRevoked (mut i32) (i32.const 0x0000))

;; ==========================================================================
;; Screen device state

;; The current border color
(global $borderColor (mut i32) (i32.const 0x0000))

;; The current flash phase (normal/inverse)
(global $flashPhase (mut i32) (i32.const 0x0000))

;; Pixel byte #1 read by ULA
(global $pixelByte1 (mut i32) (i32.const 0x0000))

;; Pixel byte #2 read by ULA
(global $pixelByte2 (mut i32) (i32.const 0x0000))

;; Attribute byte #1 read by ULA
(global $attrByte1 (mut i32) (i32.const 0x0000))

;; Attribute byte #2 read by ULA
(global $attrByte2 (mut i32) (i32.const 0x0000))

;; Number of flash frames
(global $flashFrames (mut i32) (i32.const 0x0000))

;; Pointer to the next tact in the rendering table
(global $renderingTablePtr (mut i32) (i32.const 0x0000))

;; Pointer to the next pixel in the rendering buffet
(global $pixelBufferPtr (mut i32) (i32.const 0x0000))

;; ==========================================================================
;; Beeper device state

;; Sample rate of the beeper audio
(global $beeperSampleRate (mut i32) (i32.const 0x0000))

;; Sample length (lower) in CPU clock tacts
(global $beeperSampleLength (mut i32) (i32.const 0x0000))

;; Lower gate for sample length
(global $beeperLowerGate (mut i32) (i32.const 0x0000))

;; Upper gate for sample length
(global $beeperUpperGate (mut i32) (i32.const 0x0000))

;; Current beeper gate value
(global $beeperGateValue (mut i32) (i32.const 0x0000))

;; Tact value of the last sample
(global $beeperNextSampleTact (mut i32) (i32.const 0x0000))

;; Last EAR bit value
(global $beeperLastEarBit (mut i32) (i32.const 0x0000))

;; Count of samples in this frame
(global $beeperSampleCount (mut i32) (i32.const 0x0000))


;; ==========================================================================
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





;; ==========================================================================
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
;; Public functions to manage a ZX Spectrum machine


;; Initializes a ZX Spectrum machine with the specified type
;; $type: Machine type
;;   0: ZX Spectrum 48K
;;   1: ZX Spectrum 128K
;;   2: ZX Spectrum 3+
;;   3: ZX Spectrum Next
;; $edition: Machine edition (ignored, as of now)
(func $initZxSpectrum (param $type i32) (param $edition i32)
  ;; Store machine type
  (i32.gt_u (get_local $type) (i32.const 3))
  if (result i32)
    i32.const 0
  else
    get_local $type
  end
  set_global $MACHINE_TYPE

  call $setupMachine
)

;; Turns on the ZX Spectrum machine
(func $turnOnMachine)

;; Resets the ZX Spectrum machine
(func $resetMachine
  call $resetCpu

  ;; Reset engine state variables
  i32.const 0 set_global $lastRenderedUlaTact
  i32.const 0 set_global $frameCount
  i32.const 0 set_global $tacts
  i32.const 1 set_global $frameCompleted
  i32.const 0 set_global $contentionAccummulated
  i32.const 0 set_global $lastExecutionContentionValue
  i32.const 0 set_global $emulationMode
  i32.const 0 set_global $debugStepMode
  i32.const 0 set_global $fastTapeMode
  i32.const -1 set_global $terminationRom
  i32.const -1 set_global $terminationPoint
  i32.const 0 set_global $fastVmMode
  i32.const 0 set_global $disableScreenRendering
  i32.const 0 set_global $executionCompletionReason

  ;; Reset keyboard line status
  (i32.store offset=0 (get_global $KEYBOARD_LINES) (i32.const 0))
  (i32.store offset=4 (get_global $KEYBOARD_LINES) (i32.const 0))

  ;; Reset port state
  i32.const 0 set_global $portBit3LastValue
  i32.const 0 set_global $portBit4LastValue
  i32.const 0 set_global $portBit4ChangedFrom0Tacts
  i32.const 0 set_global $portBit4ChangedFrom1Tacts

  ;; Reset interrupt state
  i32.const 0 set_global $interruptRaised
  i32.const 0 set_global $interruptRevoked

  ;; Reset beeper state
  i32.const 0 set_global $beeperGateValue
  i32.const 0 set_global $beeperNextSampleTact
  i32.const 0 set_global $beeperLastEarBit

  ;; Reset tape state
  i32.const 0 set_global $tapeMode
  i32.const 0 set_global $tapeBlocksToPlay
  i32.const 1 set_global $tapeEof
  get_global $TAPE_DATA_BUFFER set_global $tapeBufferPtr
  get_global $TAPE_DATA_BUFFER set_global $tapeNextBlockPtr
  i32.const 0 set_global $tapePlayPhase
  i64.const 0 set_global $tapeStartTact

  ;; Reset debugging state
  i32.const 0 set_global $stepOutStackDepth
)

;; Sets the ULA issue to use
(func $setUlaIssue (param $ula i32)
  i32.const 0x02
  i32.const 0x03
  (i32.eq (get_local $ula) (i32.const 2))
  select
  set_global $ulaIssue
)

;; Writes the ZX Spectrum machine state to the transfer area
(func $getMachineState
  ;; Start with CPU state
  call $getCpuState
  call $getCommonSpectrumMachineState
  (i32.add
    (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
    (i32.const 8)
  )
  call_indirect (type $ActionFunc)
)

;; Copies exeution options from the transfer area
(func $setExecutionOptions
  (i32.load8_u offset=0 (get_global $STATE_TRANSFER_BUFF)) set_global $emulationMode
  (i32.load8_u offset=1 (get_global $STATE_TRANSFER_BUFF)) set_global $debugStepMode
  (i32.load8_u offset=2 (get_global $STATE_TRANSFER_BUFF)) set_global $fastTapeMode
  (i32.load8_u offset=3 (get_global $STATE_TRANSFER_BUFF)) set_global $terminationRom
  (i32.load16_u offset=4 (get_global $STATE_TRANSFER_BUFF)) set_global $terminationPoint
  (i32.load8_u offset=6 (get_global $STATE_TRANSFER_BUFF)) set_global $fastVmMode
  (i32.load8_u offset=7 (get_global $STATE_TRANSFER_BUFF)) set_global $disableScreenRendering
  (i32.load offset=8 (get_global $STATE_TRANSFER_BUFF)) set_global $stepOverBreakpoint
)


;; Executes the ZX Spectrum machine cycle
(func $executeMachineCycle
  (local $currentUlaTact i32)
  (local $nextOpCode i32)
  (local $length i32)

  ;; Initialize the execution cycle
  i32.const 0 set_global $executionCompletionReason
  get_global $contentionAccummulated set_global $lastExecutionContentionValue

  ;; The physical frame cycle that goes on while CPU and ULA
  ;; processes everything within a screen rendering frame
  loop $frameCycle
    ;; Check if we're just about starting the next frame
    get_global $frameCompleted
    if
      ;; Reset frame information
      (i32.div_u (get_global $tacts) (get_global $clockMultiplier))
      set_global $lastRenderedUlaTact

      ;; Reset interrupt information
      i32.const 0 set_global $interruptRevoked
      i32.const 0 set_global $interruptRaised

      ;; Reset pointers used for screen rendering
      (i32.add
        (get_global $RENDERING_TACT_TABLE)
        (i32.mul (get_global $lastRenderedUlaTact) (i32.const 5))
      )
      set_global $renderingTablePtr

      get_global $PIXEL_RENDERING_BUFFER set_global $pixelBufferPtr
      i32.const 0 set_global $frameCompleted

      ;; Calculate flash phase
      (i32.rem_u (get_global $frameCount) (get_global $flashFrames))
      i32.eqz
      if
        (i32.xor (get_global $flashPhase) (i32.const 0x01))
        set_global $flashPhase
      end

      ;; Reset beeper frame state and create samples
      i32.const 0 set_global $beeperSampleCount
      call $createEarBitSamples

      call $startNewFrame
    end

    ;; Calculate the current frame tact
    (i32.div_u (get_global $tacts) (get_global $clockMultiplier))

    ;; Take care of raising the interrupt
    (call $checkForInterrupt (tee_local $currentUlaTact))

    ;; Execute an entire instruction
    call $executeCpuCycle
    loop $instructionLoop
      get_global $isInOpExecution
      if
        call $executeCpuCycle
        br $instructionLoop
      end
    end 

    ;; Render the screen
    (call $renderScreen (get_local $currentUlaTact))

    ;; Check breakpoints
    (i32.eq (get_global $debugStepMode) (i32.const 1))
    if
      ;; Stop at breakpoints mode
      (call $testBreakpoint (get_global $PC))
      if
        i32.const 2 set_global $executionCompletionReason ;; Reason: Break
        return
      end
    else
      ;; Check step-into mode
      (i32.eq (get_global $debugStepMode) (i32.const 2))
      if
        i32.const 2 set_global $executionCompletionReason ;; Reason: Break
        return
      else
        ;; Check step-over mode
        (i32.eq (get_global $debugStepMode) (i32.const 3))
        if
          (i32.eq (get_global $PC) (get_global $stepOverBreakpoint))
          if
            i32.const 2 set_global $executionCompletionReason ;; Reason: Break
            return
          end
        else
          ;; Check step-out mode
          (i32.eq (get_global $debugStepMode) (i32.const 4))
          if
            get_global $retExecuted
            if
              ;; Last statement was a RET. Is it the call frame we're looking for?
              (i32.eq 
                (get_global $stepOutStartDepth)
                (i32.add (get_global $stepOutStackDepth) (i32.const 1))
              )
              if
                ;; PC is the return address after RET
                (i32.ne (get_global $PC) (get_global $stepOutAddress))
                if
                  ;; Some invalid code is used, clear the step over stack
                  call $resetStepOverStack
                end
                i32.const 2 set_global $executionCompletionReason ;; Reason: Break
                return
              end
            end
          end
        end
      end
    end 

    ;; Exit if halted and execution mode is UntilHalted
    (i32.eq (get_global $emulationMode) (i32.const 1))
    if
      (i32.and (get_global $stateFlags) (i32.const 0x08)) ;; HLT signal set?
      if
        i32.const 3 set_global $executionCompletionReason ;; Reason: halted
        return
      end
    end     

    ;; Notify the tape device to check tape hooks
    call $checkTapeHooks

    ;; Test frame completion
    (i32.ge_u (get_local $currentUlaTact) (get_global $tactsInFrame))
    set_global $frameCompleted
    (br_if $frameCycle (i32.eqz (get_global $frameCompleted)))
  end

  ;; The current screen rendering frame completed
  ;; Create the missing beeper samples
  call $createEarBitSamples

  ;; Prepare for the next beeper sample rate
  (i32.gt_u (get_global $beeperNextSampleTact) (get_global $tacts))
  if
    (i32.sub 
      (get_global $beeperNextSampleTact)
      (i32.mul (get_global $tactsInFrame) (get_global $clockMultiplier))
    )
    set_global $beeperNextSampleTact
  end

  ;; Adjust tacts
  (i32.sub 
    (get_global $tacts)
    (i32.mul (get_global $tactsInFrame) (get_global $clockMultiplier))
  )
  set_global $tacts

  (i32.add (get_global $frameCount) (i32.const 1))
  set_global $frameCount

  ;; Sign frame completion
  call $completeFrame
  i32.const 5 set_global $executionCompletionReason ;; Reason: frame completed
)

;; Sets the status of the specified key
(func $setKeyStatus (param $keyCode i32) (param $isDown i32)
  (local $line i32)
  (local $mask i32)

  ;; Ignore invalid key codes
  (i32.gt_u (get_local $keyCode) (i32.const 39))
  if return end

  ;; Calculate line address
  (i32.add 
    (get_global $KEYBOARD_LINES)
    (i32.div_u (get_local $keyCode) (i32.const 5))
  )
  set_local $line

  ;; Calculate line mask
  (i32.shl 
    (i32.const 1)
    (i32.rem_u (get_local $keyCode) (i32.const 5))
  )
  set_local $mask

  get_local $isDown
  if
    ;; Key is down
    get_local $line
    (i32.load8_u (get_local $line))
    get_local $mask
    i32.or
    i32.store8
  else
    get_local $line
    (i32.load8_u (get_local $line))
    get_local $mask
    i32.const 0xff
    i32.xor
    i32.and
    i32.store8
  end
)

;; Gets the status of the specified key
(func $getKeyStatus (param $keyCode i32) (result i32)
  ;; Ignore invalid key codes
  (i32.gt_u (get_local $keyCode) (i32.const 39))
  if 
    i32.const 0
    return
  end

  ;; Get line value
  (i32.add 
    (get_global $KEYBOARD_LINES)
    (i32.div_u (get_local $keyCode) (i32.const 5))
  )
  i32.load8_u

  ;; Calculate line mask
  (i32.shl 
    (i32.const 1)
    (i32.rem_u (get_local $keyCode) (i32.const 5))
  )

  ;; Return the result
  i32.and
)

;; Gets the byte we would get when querying the I/O address with the
;; specified byte as the highest 8 bits of the address line
;; $line: The highest 8 bits of the address line
;; Returns the status value to be received when querying the I/O
(func $getKeyLineStatus (param $line i32) (result i32)
  (local $status i32)
  (local $lineIndex i32)
  ;; Init query loop
  (i32.xor (get_local $line) (i32.const 0xff))
  set_local $line
  i32.const 0 set_local $status
  i32.const 0 set_local $lineIndex

  ;; Iterate through all lines
  loop $lineLoop
    (i32.gt_u (get_local $line) (i32.const 0))
    if
      (i32.and (get_local $line) (i32.const 0x01))
      if
        (i32.add (get_global $KEYBOARD_LINES) (get_local $lineIndex))
        i32.load8_u
        get_local $status
        i32.or
        set_local $status
      end
      ;; Update for next iteration
      (i32.add (get_local $lineIndex) (i32.const 1))
      set_local $lineIndex
      (i32.shr_u (get_local $line) (i32.const 1))
      set_local $line
      br $lineLoop
    end
  end
  get_local $status
  i32.const 0xff
  i32.xor
)

;; Sets the interrupt tact for test purposes
(func $setInterruptTact (param $tact i32)
  get_local $tact set_global $interruptTact
)

;; ==========================================================================
;; Helper functions to manage a ZX Spectrum machine

;; Sets up the ZX Spectrum machine
(func $setupMachine 
  ;; Let's use ULA issue 3 by default
  i32.const 3 set_global $ulaIssue

  call $resetMachine

  ;; Invoke machine type specific setup
  (i32.add
    (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
    (i32.const 7)
  )
  call_indirect (type $ActionFunc)
)

;; Calculates extra screen attributes from screen configuration parameters
(func $calcScreenAttributes
  (i32.add 
    (i32.add (get_global $borderTopLines) (get_global $displayLines))
    (get_global $borderBottomLines)
  )
  set_global $screenLines

  (i32.add 
    (i32.add (get_global $verticalSyncLines) (get_global $nonVisibleBorderTopLines))
    (get_global $borderTopLines)
  )
  set_global $firstDisplayLine

  (i32.sub
    (i32.add (get_global $firstDisplayLine) (get_global $displayLines))
    (i32.const 1)
  )
  set_global $lastDisplayLine

  (i32.mul (i32.const 2) (get_global $borderLeftTime))
  set_global $borderLeftPixels

  (i32.mul (i32.const 2) (get_global $borderRightTime))
  set_global $borderRightPixels

  (i32.mul (i32.const 2) (get_global $displayLineTime))
  set_global $displayWidth

  (i32.add 
    (i32.add (get_global $borderLeftPixels) (get_global $displayWidth))
    (get_global $borderRightPixels)
  )
  set_global $screenWidth

  (i32.add (get_global $borderLeftTime) (get_global $displayLineTime))
  (i32.add (get_global $borderRightTime) (get_global $nonVisibleBorderRightTime))
  get_global $horizontalBlankingTime
  i32.add
  i32.add
  set_global $screenLineTime

  (i32.add (get_global $firstDisplayLine) (get_global $displayLines))
  (i32.add (get_global $borderBottomLines) (get_global $nonVisibleBorderBottomLines))
  i32.add
  set_global $rasterLines

  (i32.mul (get_global $rasterLines) (get_global $screenLineTime))
  set_global $tactsInFrame

  (i32.add 
    (i32.mul (get_global $firstDisplayLine) (get_global $screenLineTime))
    (get_global $borderLeftTime)
  )
  set_global $firstDisplayPixelTact

  (i32.mul
    (i32.add (get_global $verticalSyncLines) (get_global $nonVisibleBorderTopLines))
    (get_global $screenLineTime)
  )
  set_global $firstScreenPixelTact

  (f32.div 
    (f32.div 
      (f32.convert_u/i32 (get_global $baseClockFrequency)) 
      (f32.convert_u/i32 (get_global $tactsInFrame))
    )
    (f32.const 2.0)
  )
  i32.trunc_u/f32
  set_global $flashFrames
)

;; Gets the ZX Spectrum 48 machine state
(func $getCommonSpectrumMachineState
  ;; CPU configuration
  (i32.store offset=48 (get_global $STATE_TRANSFER_BUFF) (get_global $baseClockFrequency))      
  (i32.store8 offset=52 (get_global $STATE_TRANSFER_BUFF) (get_global $clockMultiplier))      
  (i32.store8 offset=53 (get_global $STATE_TRANSFER_BUFF) (get_global $supportsNextOperation))      

  ;; Memory configuration
  (i32.store8 offset=54 (get_global $STATE_TRANSFER_BUFF) (get_global $numberOfRoms))      
  (i32.store offset=55 (get_global $STATE_TRANSFER_BUFF) (get_global $romContentsAddress))      
  (i32.store8 offset=59 (get_global $STATE_TRANSFER_BUFF) (get_global $spectrum48RomIndex))      
  (i32.store8 offset=60 (get_global $STATE_TRANSFER_BUFF) (get_global $contentionType))      
  (i32.store8 offset=61 (get_global $STATE_TRANSFER_BUFF) (get_global $ramBanks))      
  (i32.store8 offset=62 (get_global $STATE_TRANSFER_BUFF) (get_global $nextMemorySize))

  ;; Screen frame configuration
  (i32.store16 offset=63 (get_global $STATE_TRANSFER_BUFF) (get_global $interruptTact))      
  (i32.store16 offset=65 (get_global $STATE_TRANSFER_BUFF) (get_global $verticalSyncLines))      
  (i32.store16 offset=67 (get_global $STATE_TRANSFER_BUFF) (get_global $nonVisibleBorderTopLines))      
  (i32.store16 offset=69 (get_global $STATE_TRANSFER_BUFF) (get_global $borderTopLines))      
  (i32.store16 offset=71 (get_global $STATE_TRANSFER_BUFF) (get_global $displayLines))      
  (i32.store16 offset=73 (get_global $STATE_TRANSFER_BUFF) (get_global $borderBottomLines))      
  (i32.store16 offset=75 (get_global $STATE_TRANSFER_BUFF) (get_global $nonVisibleBorderBottomLines))      
  (i32.store16 offset=77 (get_global $STATE_TRANSFER_BUFF) (get_global $horizontalBlankingTime))      
  (i32.store16 offset=79 (get_global $STATE_TRANSFER_BUFF) (get_global $borderLeftTime))      
  (i32.store16 offset=81 (get_global $STATE_TRANSFER_BUFF) (get_global $displayLineTime))      
  (i32.store16 offset=83 (get_global $STATE_TRANSFER_BUFF) (get_global $borderRightTime))      
  (i32.store16 offset=85 (get_global $STATE_TRANSFER_BUFF) (get_global $nonVisibleBorderRightTime))      
  (i32.store16 offset=87 (get_global $STATE_TRANSFER_BUFF) (get_global $pixelDataPrefetchTime))      
  (i32.store16 offset=89 (get_global $STATE_TRANSFER_BUFF) (get_global $attributeDataPrefetchTime))      

  ;; Calculated screen attributes
  (i32.store offset=91 (get_global $STATE_TRANSFER_BUFF) (get_global $screenLines))      
  (i32.store offset=95 (get_global $STATE_TRANSFER_BUFF) (get_global $firstDisplayLine))
  (i32.store offset=99 (get_global $STATE_TRANSFER_BUFF) (get_global $lastDisplayLine))
  (i32.store offset=103 (get_global $STATE_TRANSFER_BUFF) (get_global $borderLeftPixels))      
  (i32.store offset=107 (get_global $STATE_TRANSFER_BUFF) (get_global $borderRightPixels))      
  (i32.store offset=111 (get_global $STATE_TRANSFER_BUFF) (get_global $displayWidth))      
  (i32.store offset=115 (get_global $STATE_TRANSFER_BUFF) (get_global $screenWidth))      
  (i32.store offset=119 (get_global $STATE_TRANSFER_BUFF) (get_global $screenLineTime))      
  (i32.store offset=123 (get_global $STATE_TRANSFER_BUFF) (get_global $rasterLines))      
  (i32.store offset=127 (get_global $STATE_TRANSFER_BUFF) (get_global $firstDisplayPixelTact))      
  (i32.store offset=131 (get_global $STATE_TRANSFER_BUFF) (get_global $firstScreenPixelTact))

  ;; ZX Spectrum engine state
  (i32.store8 offset=135 (get_global $STATE_TRANSFER_BUFF) (get_global $ulaIssue))
  (i32.store offset=136 (get_global $STATE_TRANSFER_BUFF) (get_global $lastRenderedUlaTact))
  (i32.store offset=140 (get_global $STATE_TRANSFER_BUFF) (get_global $frameCount))
  (i32.store8 offset=144 (get_global $STATE_TRANSFER_BUFF) (get_global $frameCompleted))
  (i32.store offset=145 (get_global $STATE_TRANSFER_BUFF) (get_global $contentionAccummulated))
  (i32.store offset=149 (get_global $STATE_TRANSFER_BUFF) (get_global $lastExecutionContentionValue))
  (i32.store8 offset=153 (get_global $STATE_TRANSFER_BUFF) (get_global $emulationMode))
  (i32.store8 offset=154 (get_global $STATE_TRANSFER_BUFF) (get_global $debugStepMode))
  (i32.store8 offset=155 (get_global $STATE_TRANSFER_BUFF) (get_global $fastTapeMode))
  (i32.store8 offset=156 (get_global $STATE_TRANSFER_BUFF) (get_global $terminationRom))
  (i32.store16 offset=157 (get_global $STATE_TRANSFER_BUFF) (get_global $terminationPoint))
  (i32.store8 offset=159 (get_global $STATE_TRANSFER_BUFF) (get_global $fastVmMode))
  (i32.store8 offset=160 (get_global $STATE_TRANSFER_BUFF) (get_global $disableScreenRendering))
  (i32.store8 offset=161 (get_global $STATE_TRANSFER_BUFF) (get_global $executionCompletionReason))

  ;; Keyboard lines
  (i32.store offset=162 (get_global $STATE_TRANSFER_BUFF) (i32.load offset=0 (get_global $KEYBOARD_LINES)))
  (i32.store offset=166 (get_global $STATE_TRANSFER_BUFF) (i32.load offset=4 (get_global $KEYBOARD_LINES)))

  ;; Port state
  (i32.store8 offset=170 (get_global $STATE_TRANSFER_BUFF) (get_global $portBit3LastValue))
  (i32.store8 offset=171 (get_global $STATE_TRANSFER_BUFF) (get_global $portBit4LastValue))
  (i32.store offset=172 (get_global $STATE_TRANSFER_BUFF) (get_global $portBit4ChangedFrom0Tacts))
  (i32.store offset=176 (get_global $STATE_TRANSFER_BUFF) (get_global $portBit4ChangedFrom1Tacts))

  ;; Interrupt state
  (i32.store8 offset=180 (get_global $STATE_TRANSFER_BUFF) (get_global $interruptRaised))
  (i32.store8 offset=181 (get_global $STATE_TRANSFER_BUFF) (get_global $interruptRevoked))

  ;; Screen state
  (i32.store8 offset=182 (get_global $STATE_TRANSFER_BUFF) (get_global $borderColor))
  (i32.store8 offset=183 (get_global $STATE_TRANSFER_BUFF) (get_global $flashPhase))
  (i32.store8 offset=184 (get_global $STATE_TRANSFER_BUFF) (get_global $pixelByte1))
  (i32.store8 offset=185 (get_global $STATE_TRANSFER_BUFF) (get_global $pixelByte2))
  (i32.store8 offset=186 (get_global $STATE_TRANSFER_BUFF) (get_global $attrByte1))
  (i32.store8 offset=187 (get_global $STATE_TRANSFER_BUFF) (get_global $attrByte2))
  (i32.store8 offset=188 (get_global $STATE_TRANSFER_BUFF) (get_global $flashFrames))
  (i32.store offset=189 (get_global $STATE_TRANSFER_BUFF) (get_global $renderingTablePtr))
  (i32.store offset=193 (get_global $STATE_TRANSFER_BUFF) (get_global $pixelBufferPtr))

  ;; Beeper state
  (i32.store offset=197 (get_global $STATE_TRANSFER_BUFF) (get_global $beeperSampleRate))
  (i32.store offset=201 (get_global $STATE_TRANSFER_BUFF) (get_global $beeperSampleLength))
  (i32.store offset=205 (get_global $STATE_TRANSFER_BUFF) (get_global $beeperLowerGate))
  (i32.store offset=209 (get_global $STATE_TRANSFER_BUFF) (get_global $beeperUpperGate))
  (i32.store offset=213 (get_global $STATE_TRANSFER_BUFF) (get_global $beeperGateValue))
  (i32.store offset=217 (get_global $STATE_TRANSFER_BUFF) (get_global $beeperNextSampleTact))
  (i32.store8 offset=221 (get_global $STATE_TRANSFER_BUFF) (get_global $beeperLastEarBit))
  (i32.store offset=222 (get_global $STATE_TRANSFER_BUFF) (get_global $beeperSampleCount))

  ;; Tape device state
  (i32.store8 offset=226 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeMode))
  (i32.store16 offset=227 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeLoadBytesRoutine))
  (i32.store16 offset=229 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeLoadBytesResume))
  (i32.store16 offset=231 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeLoadBytesInvalidHeader))
  (i32.store16 offset=233 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeSaveBytesRoutine))
  (i32.store8 offset=235 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeBlocksToPlay))
  (i32.store8 offset=236 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeEof))
  (i32.store offset=237 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeBufferPtr))
  (i32.store offset=241 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeNextBlockPtr))
  (i32.store8 offset=245 (get_global $STATE_TRANSFER_BUFF) (get_global $tapePlayPhase))
  (i64.store offset=246 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeStartTact))
  (i32.store8 offset=254 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeBitMask))
)

;; Copies a segment of memory
;; $from: Source address
;; $to: Destination address
;; $count #of bytes to copy
(func $copyMemory (param $from i32) (param $to i32) (param $count i32)
  loop $copy
    (i32.gt_u (get_local $count) (i32.const 0))
    if
      ;; Copy a single byte
      get_local $to
      get_local $from
      i32.load8_u
      i32.store8

      ;; Increment indexes
      (i32.add (get_local $from) (i32.const 1))
      set_local $from
      (i32.add (get_local $to) (i32.const 1))
      set_local $to

      ;; Decrement counter
      (i32.sub (get_local $count) (i32.const 1))
      set_local $count
      
      ;; continue
      br $copy
    end
  end
)

;; Starts a new frame
(func $startNewFrame
    ;; TODO: Init a new frame
    ;; Invoke machine type specific "New frame" function
    (i32.add
    (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
    (i32.const 9)
  )
  call_indirect (type $ActionFunc)
)

;; Executes the actions to respond a screen rendering frame completion
(func $completeFrame
    ;; TODO: Complete
    ;; Invoke machine type specific "Frame completed" function
    (i32.add
    (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
    (i32.const 10)
  )
  call_indirect (type $ActionFunc)
)

;; Colorizes the data in pixel buffer
(func $colorize
  (i32.add
    (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
    (i32.const 11)
  )
  call_indirect (type $ActionFunc)
)

;; Checks and executes interrupt, it it's time
(func $checkForInterrupt (param $currentUlaTact i32)
  ;; We've already handled the interrupt
  get_global $interruptRevoked
  if return end

  ;; Is it too early to raise the interrupt?
  (i32.lt_u (get_local $currentUlaTact) (get_global $interruptTact))
  if return end

  ;; Are we over the longest op after the interrupt tact?
  (i32.gt_u 
    (get_local $currentUlaTact)
    (i32.add (get_global $interruptTact) (i32.const 23)) ;; tacts of the longest op
  )
  if
    ;; Let's revoke the INT signal
    i32.const 1 set_global $interruptRevoked
    (i32.and (get_global $stateFlags) (i32.const 0xfe))
    set_global $stateFlags ;; Reset the interrupt signal
    return
  end

  ;; The interrupt is raised, not revoked, but the CPU has not handled it yet
  get_global $interruptRaised
  if return end

  ;; Do not raise interrupt when CPU blocks
  get_global $isInterruptBlocked
  if return end

  ;; It is time to raise the interrupt
  i32.const 1 set_global $interruptRaised
  (i32.or (get_global $stateFlags) (i32.const 0x01))
  set_global $stateFlags ;; Set the interrupt signal
)

;; ==========================================================================
;; Screen device routines

;; Initializes the table used for screen rendering
(func $initRenderingTactTable
  (local $firstVisibleLine i32)
  (local $lastVisibleLine i32)
  (local $lastVisibleLineTact i32)
  (local $lastDisplayLineTact i32)
  (local $borderPixelFetchTact i32)
  (local $borderAttrFetchTact i32)
  (local $tact i32)
  (local $line i32)
  (local $tactInLine i32)
  (local $phase i32)
  (local $contentionDelay i32)
  (local $pixelAddr i32)
  (local $attrAddr i32)
  (local $tablePointer i32)
  (local $contentionPtr i32)
  (local $pixelTact i32)

  ;; Calculate the first and last visible lines
  (i32.add (get_global $verticalSyncLines) (get_global $nonVisibleBorderTopLines))
  set_local $firstVisibleLine
  (i32.sub (get_global $rasterLines) (get_global $nonVisibleBorderBottomLines))
  set_local $lastVisibleLine

  ;; Calculate the last visible line and display tacts
  (i32.sub 
    (i32.sub (get_global $screenLineTime) (get_global $nonVisibleBorderRightTime))
    (get_global $horizontalBlankingTime)
  )
  set_local $lastVisibleLineTact
  (i32.add (get_global $borderLeftTime) (get_global $displayLineTime))
  set_local $lastDisplayLineTact

  ;; Calculate border pixel and attribute fetch tacts
  (i32.sub (get_global $borderLeftTime) (get_global $pixelDataPrefetchTime))
  set_local $borderPixelFetchTact
  (i32.sub (get_global $borderLeftTime) (get_global $attributeDataPrefetchTime))
  set_local $borderAttrFetchTact

  ;; Init the loop over tacts
  get_global $RENDERING_TACT_TABLE set_local $tablePointer
  get_global $CONTENTION_TABLE set_local $contentionPtr
  i32.const 0 set_local $tact

  loop $tactLoop
    (i32.lt_u (get_local $tact) (get_global $tactsInFrame))
    if
      ;; Init the current tact
      i32.const 0 set_local $phase
      i32.const 0 set_local $contentionDelay
      i32.const 0 set_local $pixelAddr
      i32.const 0 set_local $attrAddr

      ;; Calculate line and tact in line
      (i32.div_u (get_local $tact) (get_global $screenLineTime))
      set_local $line
      (i32.rem_u (get_local $tact) (get_global $screenLineTime))
      set_local $tactInLine

      ;; Test, if the current tact is visible
      (i32.ge_u (get_local $line) (get_local $firstVisibleLine))
      if (result i32)
        (i32.lt_u (get_local $line) (get_local $lastVisibleLine))
        if (result i32)
          (i32.lt_u (get_local $tactInLine) (get_local $lastVisibleLineTact))
        else
          i32.const 0
        end
      else
        i32.const 0
      end

      ;; At this point, the test result is at the top of the stack
      if
        ;; Yes, the tact is visible.
        ;; Test, if it is in the display area
        (i32.ge_u (get_local $line) (get_global $firstDisplayLine))
        if (result i32)
          (i32.le_u (get_local $line) (get_global $lastDisplayLine))
          if (result i32)
            (i32.ge_u (get_local $tactInLine) (get_global $borderLeftTime))
            if (result i32)
              (i32.lt_u (get_local $tactInLine) (get_local $lastDisplayLineTact))
            else
              i32.const 0
            end
          else
            i32.const 0
          end
        else
          i32.const 0
        end

        ;; At this point, the test result is at the top of the stack
        if
          ;; Yes, it is the display area
          ;; Carry out actions according to pixel tact
          (i32.and
            (i32.sub (get_local $tactInLine) (get_global $borderLeftTime))
            (i32.const 0x07)
          )
          (i32.eq (tee_local $pixelTact) (i32.const 0))
          if
            ;; Pixel tact 0
            i32.const 0x09 set_local $phase ;; DisplayB1FetchB2
            (call $calcPixelAddr 
              (get_local $line)
              (i32.add (get_local $tactInLine) (i32.const 4))
            )
            set_local $pixelAddr
            i32.const 5
            i32.const 0
            (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
            select
            set_local $contentionDelay
          else
            (i32.eq (get_local $pixelTact) (i32.const 1))
            if
              ;; Pixel tact 1
              i32.const 0x0a set_local $phase ;; DisplayB1FetchA2
              (call $calcAttrAddr 
                (get_local $line)
                (i32.add (get_local $tactInLine) (i32.const 3))
              )
              set_local $attrAddr
              i32.const 4
              i32.const 7
              (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
              select
              set_local $contentionDelay
            else
              (i32.eq (get_local $pixelTact) (i32.const 2))
              if
                ;; Pixel tact 2
                i32.const 0x08 set_local $phase ;; DisplayB1
                i32.const 3
                i32.const 6
                (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
                select
                set_local $contentionDelay
              else
                (i32.eq (get_local $pixelTact) (i32.const 3))
                if
                  ;; Pixel tact 3
                  i32.const 0x08 set_local $phase ;; DisplayB1
                  i32.const 2
                  i32.const 5
                  (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
                  select
                  set_local $contentionDelay
                else
                  (i32.eq (get_local $pixelTact) (i32.const 4))
                  if
                    ;; Pixel tact 4
                    i32.const 0x10 set_local $phase ;; DisplayB2
                    i32.const 1
                    i32.const 4
                    (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
                    select
                    set_local $contentionDelay
                  else
                    (i32.eq (get_local $pixelTact) (i32.const 5))
                    if
                      ;; Pixel tact 5
                      i32.const 0x10 set_local $phase ;; DisplayB2
                      i32.const 0
                      i32.const 3
                      (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
                      select
                      set_local $contentionDelay
                    else
                      (i32.eq (get_local $pixelTact) (i32.const 6))
                      if
                        ;; Pixel tact 6
                        ;; Test, if there are more pixels to display in this line
                        (i32.lt_u 
                          (get_local $tactInLine)
                          (i32.sub 
                            (i32.add (get_global $borderLeftTime) (get_global $displayLineTime))
                            (get_global $pixelDataPrefetchTime)
                          )
                        )
                        if
                          ;; Yes, there are still more bytes
                          i32.const 0x11 set_local $phase ;; DisplayB2FetchB1
                          (call $calcPixelAddr 
                            (get_local $line)
                            (i32.add (get_local $tactInLine) (get_global $pixelDataPrefetchTime))
                          )
                          set_local $pixelAddr
                          i32.const 0
                          i32.const 2
                          (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
                          select
                          set_local $contentionDelay
                        else
                          ;; Last byte in this line
                          i32.const 0x10 set_local $phase ;; DisplayB2
                        end
                      else
                        ;; Pixel tact 7
                        ;; Test, if there are more pixels to display in this line
                        (i32.lt_u 
                          (get_local $tactInLine)
                          (i32.sub 
                            (i32.add (get_global $borderLeftTime) (get_global $displayLineTime))
                            (get_global $attributeDataPrefetchTime)
                          )
                        )
                        if
                          ;; Yes, there are still more bytes
                          i32.const 0x12 set_local $phase ;; DisplayB2FetchA1
                          (call $calcAttrAddr 
                            (get_local $line)
                            (i32.add (get_local $tactInLine) (get_global $attributeDataPrefetchTime))
                          )
                          set_local $attrAddr
                          i32.const 6
                          i32.const 1
                          (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
                          select
                          set_local $contentionDelay
                        else
                          ;; Last byte in this line
                          i32.const 0x10 set_local $phase ;; DisplayB2
                        end
                      end
                    end
                  end
                end
              end
            end
          end
        else
          ;; No, it is the border area
          i32.const 0x04 set_local $phase

          ;; Is it left or right border?
          (i32.ge_u (get_local $line) (get_global $firstDisplayLine))
          if 
            (i32.le_u (get_local $line) (get_global $lastDisplayLine))
            if
              ;; Yes, it is left or right border
              ;; Is it pixel data prefetch time?
              (i32.eq (get_local $tactInLine) (get_local $borderPixelFetchTact))
              if
                ;; Yes, prefetch pixel data
                i32.const 0x05 set_local $phase ;; BorderFetchPixel
                (call $calcPixelAddr 
                  (get_local $line)
                  (i32.add (get_local $tactInLine) (get_global $pixelDataPrefetchTime))
                )
                set_local $pixelAddr
                i32.const 0
                i32.const 2
                (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
                select
                set_local $contentionDelay
              else
                ;; Is it attribute data prefetch time?
                (i32.eq (get_local $tactInLine) (get_local $borderAttrFetchTact))
                if
                  ;; Yes, prefetch attribute data
                  i32.const 0x06 set_local $phase ;; BorderFetchAttr
                  (call $calcAttrAddr 
                    (get_local $line)
                    (i32.add (get_local $tactInLine) (get_global $attributeDataPrefetchTime))
                  )
                  set_local $attrAddr
                  i32.const 6
                  i32.const 1
                  (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
                  select
                  set_local $contentionDelay
                end
              end
            end
          end
        end
      end 

      ;; Store the current item
      (i32.store8 (get_local $tablePointer) (get_local $phase))
      (i32.store16 offset=1 (get_local $tablePointer) (get_local $pixelAddr))
      (i32.store16 offset=3 (get_local $tablePointer) (get_local $attrAddr))
      (i32.store8 (get_local $contentionPtr) (get_local $contentionDelay))

      ;; Move to the next table item
      (i32.add (get_local $tablePointer) (i32.const 5))
      set_local $tablePointer
      (i32.add (get_local $contentionPtr) (i32.const 1))
      set_local $contentionPtr

      ;; Continue the loop
      (i32.add (get_local $tact) (i32.const 1))
      set_local $tact

      br $tactLoop
    end
  end

  ;; Add extra (non-rendering) tacts to protect frame overflow
  i32.const 100 set_local $line
  loop $trailLoop
    get_local $line
    if
      (i32.store8 (get_local $tablePointer) (i32.const 0)) ;; "None" rendering phase
      (i32.store16 offset=1 (get_local $tablePointer) (i32.const 0))
      (i32.store16 offset=3 (get_local $tablePointer) (i32.const 0))

      ;; Move to the next table item
      (i32.add (get_local $tablePointer) (i32.const 5))
      set_local $tablePointer

      ;; Decrement counter
      (i32.sub (get_local $line) (i32.const 1))
      set_local $line
      br $trailLoop
    end
  end
)

;; Calculates pixel address
;; $line: Screen line
;; $tactInLine: Tact in screen line
(func $calcPixelAddr (param $line i32) (param $tactInLine i32) (result i32)
  (local $row i32)
  (i32.sub (get_local $line) (get_global $firstDisplayLine))

  ;; (row & 0xc0) << 5
  (i32.and (tee_local $row) (i32.const 0xc0))
  i32.const 5
  i32.shl

  ;; (row & 0x07) << 8
  (i32.and (get_local $row) (i32.const 0x07))
  i32.const 8
  i32.shl

  ;; (row & 0x38) << 2
  (i32.and (get_local $row) (i32.const 0x38))
  i32.const 2
  i32.shl

  ;; colum >> 3
  (i32.shr_u 
    (i32.shl 
      (i32.sub (get_local $tactInLine) (get_global $borderLeftTime))
      (i32.const 1)
    ) 
    (i32.const 3)
  )

  ;; Calculate the address
  i32.const 0x4000
  i32.add
  i32.add
  i32.add
  i32.add
)

;; Calculates attribute address
;; $line: Screen line
;; $tactInLine: Tact in screen line
(func $calcAttrAddr (param $line i32) (param $tactInLine i32) (result i32)
  ;; Calculate (column >> 3)
  (i32.shr_u
    (i32.shl 
      (i32.sub (get_local $tactInLine) (get_global $borderLeftTime))
      (i32.const 1)
    )
    (i32.const 3)
  )

  ;; Calculate ((row >> 3) << 5)
  (i32.shl
    (i32.shr_u
      (i32.sub (get_local $line) (get_global $firstDisplayLine))
      (i32.const 3)
    )
    (i32.const 5)
  )

  ;; Combine address parts
  i32.or
  i32.const 0x5800
  i32.add
)

;; Renders the next screen portion
;; $toTact: last tact to render
(func $renderScreen (param $toTact i32)
  (local $tact i32)
  (local $phase i32)
  (local $tmp i32)

  get_global $lastRenderedUlaTact
  set_local $tact

  ;; Iterate through tacts
  loop $tactLoop
    (i32.le_u (get_local $tact) (get_local $toTact))
    if
      ;; Obtain rendering phase information
      (i32.load8_u offset=0 (get_global $renderingTablePtr))
      
      ;;Process the current rendering tact
      (i32.gt_u (tee_local $phase) (i32.const 0))
      if
        ;; Test for border procesing
        (i32.and (get_local $phase) (i32.const 0x04))
        if
          ;; Store border pixels
          (i32.store8 offset=0 (get_global $pixelBufferPtr) (get_global $borderColor))
          (i32.store8 offset=1 (get_global $pixelBufferPtr) (get_global $borderColor))

          ;; Fetch border byte?
          (i32.and (get_local $phase) (i32.const 0x01))
          if
            ;; Fetch pixel byte 1
            (call $readMemoryNc (i32.load16_u offset=1 (get_global $renderingTablePtr)))
            set_global $pixelByte1
          else
            (i32.and (get_local $phase) (i32.const 0x02))
            if
              ;; Fetch attr byte 1
              (call $readMemoryNc (i32.load16_u offset=3 (get_global $renderingTablePtr)))
              set_global $attrByte1
            end
          end
        else
          ;; Test for Byte1 processing
          (i32.and (get_local $phase) (i32.const 0x08))
          if
            ;; Process Byte1 pixels
            get_global $pixelBufferPtr
            (call $getAttrColor
              (i32.and (get_global $pixelByte1) (i32.const 0x80))
              (get_global $attrByte1)
            )
            i32.store8 offset=0
            get_global $pixelBufferPtr

            (call $getAttrColor
              (i32.and (get_global $pixelByte1) (i32.const 0x40))
              (get_global $attrByte1)
            )
            i32.store8 offset=1
            (i32.shl (get_global $pixelByte1) (i32.const 2))
            (i32.and (i32.const 0xff))
            set_global $pixelByte1

            ;; Fetch pixel byte?
            (i32.and (get_local $phase) (i32.const 0x01))
            if
              ;; Fetch pixel byte 2
              (call $readMemoryNc (i32.load16_u offset=1 (get_global $renderingTablePtr)))
              set_global $pixelByte2
            else
              (i32.and (get_local $phase) (i32.const 0x02))
              if
                ;; Fetch attr byte 2
                (call $readMemoryNc (i32.load16_u offset=3 (get_global $renderingTablePtr)))
                set_global $attrByte2
              end
            end
          else
            ;; Process Byte2 pixels
            get_global $pixelBufferPtr
            (call $getAttrColor
              (i32.and (get_global $pixelByte2) (i32.const 0x80))
              (get_global $attrByte2)
            )
            i32.store8 offset=0
            get_global $pixelBufferPtr
            (call $getAttrColor
              (i32.and (get_global $pixelByte2) (i32.const 0x40))
              (get_global $attrByte2)
            )
            i32.store8 offset=1
            (i32.shl (get_global $pixelByte2) (i32.const 2))
            (i32.and (i32.const 0xff))
            set_global $pixelByte2

            ;; Fetch pixel byte?
            (i32.and (get_local $phase) (i32.const 0x01))
            if
              ;; Fetch pixel byte 1
              (call $readMemoryNc (i32.load16_u offset=1 (get_global $renderingTablePtr)))
              set_global $pixelByte1
            else
              (i32.and (get_local $phase) (i32.const 0x02))
              if
                ;; Fetch attr byte 1
                (call $readMemoryNc (i32.load16_u offset=3 (get_global $renderingTablePtr)))
                set_global $attrByte1
              end
            end
          end
        end

        ;; Move to the next pixel in the buffer
        (i32.add (get_global $pixelBufferPtr) (i32.const 2))
        set_global $pixelBufferPtr
      end

      ;; Move to the next rendering tact
      (i32.add (get_global $renderingTablePtr) (i32.const 5))
      set_global $renderingTablePtr

      ;; Increment loop counter
      (i32.add (get_local $tact) (i32.const 1))
      set_local $tact

      ;; continue
      br $tactLoop
    end
    get_local $tact set_global $lastRenderedUlaTact
  end
)

;; Gets the color for the specified pixel
;; $pixel: 0: paper, other: ink
(func $getAttrColor (param $pixel i32) (param $attr i32) (result i32)
  get_local $pixel
  if (result i32)
    get_global $flashPhase
    if (result i32)
      get_global $INK_COLORS_ON_TABLE
    else
      get_global $INK_COLORS_OFF_TABLE
    end
  else
    get_global $flashPhase
    if (result i32)
      get_global $PAPER_COLORS_ON_TABLE
    else
      get_global $PAPER_COLORS_OFF_TABLE
    end
  end
  get_local $attr
  i32.add
  i32.load8_u
)

;; Puts a pair of pixels into the rendering buffer
(func $setPixels (param $pixelAddr i32) (param $pixel1Color i32) (param $pixel2Color i32)
)

;; ==========================================================================
;; Beeper device routines

;; Sets the specified beeper sample rate
;; $rate: New beeper sample rate
(func $setBeeperSampleRate (param $rate i32)
  (local $sampleLength f32)
  get_local $rate set_global $beeperSampleRate

  ;; Calculate the sample length
  (f32.div
    (f32.convert_u/i32 (i32.mul (get_global $baseClockFrequency) (get_global $clockMultiplier)))
    (f32.convert_u/i32 (get_local $rate))
  )
  tee_local $sampleLength
  i32.trunc_u/f32
  set_global $beeperSampleLength

  ;; Calculate the gate values for the sample length
  (f32.mul 
    (f32.sub 
      (get_local $sampleLength) 
      (f32.convert_u/i32 (get_global $beeperSampleLength))
    )
    (f32.const 100_000)
  )
  i32.trunc_u/f32
  set_global $beeperLowerGate
  i32.const 100_000 set_global $beeperUpperGate
)

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
  (i32.load16_u offset=8 (get_global $REG_AREA_INDEX))
  call $setAF

  ;; Check if it is a verify
  (i32.eq
    (i32.and (call $getAF) (i32.const 0xff01))
    (i32.const 0xff00)
  )
  set_local $isVerify

  ;; At this point IX contains the address to load the data, 
  ;; DE shows the #of bytes to load. A contains 0x00 for header, 
  ;; 0xFF for data block
  (i32.ne 
    (i32.load8_u (get_global $tapeBufferPtr))
    (call $getA)
  )
  if
    ;; This block has a different type we're expecting
    (i32.xor (call $getA) (call $getL))
    call $setA

    ;; Reset Z and C
    (i32.and (call $getF) (i32.const 0xBE))
    call $setF
    (call $setPC (get_global $tapeLoadBytesInvalidHeader))
    call $nextTapeBlock
    return
  end

  ;; It is time to load the block
  call $getA call $setH

  ;; Skip the header byte
  (i32.add (get_global $tapeBufferPtr) (i32.const 1))
  set_global $tapeBufferPtr

  loop $loadByte

    (i32.gt_u (call $getDE) (i32.const 0))
    if
      (i32.load8_u (get_global $tapeBufferPtr))
      call $setL
      get_local $isVerify
      if
        ;; VERIFY operation
        (i32.ne (i32.load8_u (call $getIX)) (call $getL))
        if
          ;; We read a different byte, it's an error
          ;; Reset Z and C
          (i32.and (call $getF) (i32.const 0xBE))
          call $setF
          (call $setPC (get_global $tapeLoadBytesInvalidHeader))
          return
        end
      end

      ;; Store the loaded byte
      (i32.store8 (call $getIX) (call $getL))

      ;; Calc the checksum
      (i32.xor (call $getH) (call $getL))
      call $setH
      
      ;; Increment the data pointers
      (i32.add (get_global $tapeBufferPtr) (i32.const 1))
      set_global $tapeBufferPtr
      (i32.add (call $getIX) (i32.const 1))
      call $setIX

      ;; Decrement byte count
      (i32.sub (call $getDE) (i32.const 1))
      call $setDE
      br $loadByte
    end
  end

  ;; Check the end of the data stream
  (i32.gt_u (get_global $tapeBufferPtr) (get_global $tapeNextBlockPtr))
  if
    ;; Read over the expected length
    ;; Reset Carry to sign error
    (i32.and (call $getF) (i32.const 0xfe))
    call $setF
  else
    ;; Verify checksum
    (i32.ne (i32.load8_u (get_global $tapeBufferPtr)) (call $getH))
    if
      ;; Wrong checksum
      ;; Reset Carry to sign error
      (i32.and (call $getF) (i32.const 0xfe))
      call $setF
    else
      ;; Block read successfully, set Carry
      (i32.or (call $getF) (i32.const 0x01))
      call $setF
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

;; ==========================================================================
;; Generic I/O device routines

;; Applies memory contention delay according to the current
;; screen rendering tact
(func $applyContentionDelay
  (i32.add
    (get_global $CONTENTION_TABLE) 
    (i32.div_u (get_global $tacts) (get_global $clockMultiplier))
  )
  i32.load8_u
  call $incTacts
)

;; Applies I/O contention wait
;; $addr: port address
(func $applyIOContentionDelay (param $addr i32)
  (local $lowbit i32)

  ;; Calculate the low bit value
  (i32.and (get_local $addr) (i32.const 0x0001))
  set_local $lowbit

  ;; Check for contended range
  (i32.eq
    (i32.and (get_local $addr) (i32.const 0xc000))
    (i32.const 0x4000)
  )
  if
    ;; Contended address
    get_local $lowbit
    if
      ;; Low bit set, C:1, C:1, C:1, C:1 
      call $applyContentionDelay
      (call $incTacts (i32.const 1))
      call $applyContentionDelay
      (call $incTacts (i32.const 1))
      call $applyContentionDelay
      (call $incTacts (i32.const 1))
      call $applyContentionDelay
      (call $incTacts (i32.const 1))
    else
      ;; Low bit reset, C:1, C:3
      call $applyContentionDelay
      (call $incTacts (i32.const 1))
      call $applyContentionDelay
      (call $incTacts (i32.const 3))
    end
  else
    ;; Non-contended address
    get_local $lowbit
    if
      ;; Low bit set, N:4
      (call $incTacts (i32.const 4))
    else
      ;; Low bit reset, N:1, C:3
      (call $incTacts (i32.const 1))
      call $applyContentionDelay
      (call $incTacts (i32.const 3))
    end
  end
)

;; Reads information from the 0xfe port
(func $readPort$FE (param $addr i32) (result i32)
  (local $portValue i32)
  (local $bit4Sensed i32)
  (local $chargeTime i32)
  (local $bit6Value i32)
  (local $earBit i32)

  ;; Scan keyboard line status
  (call $getKeyLineStatus (i32.shr_u (get_local $addr) (i32.const 8)))
  set_local $portValue

  ;; Check for LOAD mode
  (i32.eq (get_global $tapeMode) (i32.const 1))
  if (result i32)
    (i32.and (get_local $portValue) (i32.const 0xbf))
    call $getTapeEarBit tee_local $earBit
    (i32.shl (i32.const 4))
    call $processEarBit
    (i32.shl (get_local $earBit) (i32.const 6))
    i32.or
  else
    ;; Handle analog EAR bit
    get_global $portBit4LastValue
    (i32.eq (tee_local $bit4Sensed) (i32.const 0))
    if
      ;; Changed later to 1 from 0 than to 0 from 1?
      (i32.sub (get_global $portBit4ChangedFrom1Tacts) (get_global $portBit4ChangedFrom0Tacts))
      (i32.gt_s (tee_local $chargeTime) (i32.const 0))
      if 
        ;; Yes, calculate charge time
        (i32.gt_u (get_local $chargeTime) (i32.const 700))
        if (result i32)
          i32.const 2800
        else
          (i32.mul (i32.const 4) (get_local $chargeTime))
        end
        set_local $chargeTime

        ;; Calculate time ellapsed since last change from 1 to 0
        (i32.sub (get_global $tacts) (get_global $portBit4ChangedFrom1Tacts))
        ;; Less than charge time?
        (i32.lt_u (get_local $chargeTime))
        i32.const 4
        i32.shl
        set_local $bit4Sensed
      end
    end

    ;; Calculate bit 6 value
    get_global $portBit3LastValue
    if (result i32)
      i32.const 0x40
    else
      i32.const 0x40
      i32.const 0x00
      get_local $bit4Sensed
      select
    end
    set_local $bit6Value

    ;; Check for ULA 3
    (i32.eq (get_global $ulaIssue) (i32.const 3))
    if
      get_global $portBit3LastValue
      if
        (i32.eq (get_local $bit4Sensed) (i32.const 0))
        if
        i32.const 0
        set_local $bit6Value
        end
      end
    end

    ;; Merge bit 6 with port value
    (i32.and (get_local $portValue) (i32.const 0xbf))
    get_local $bit6Value
    i32.or
  end
)

;; Writes information to the 0xfe port
(func $writePort$FE (param $addr i32) (param $v i32)
  (local $bit4 i32)

  ;; Extract border color
  (i32.and (get_local $v) (i32.const 0x07))
  set_global $borderColor

  ;; Let the beeper device process the EAR bit
  (i32.and (get_local $v) (i32.const 0x10))
  (call $processEarBit (tee_local $bit4))

  ;; Set the last value of bit3
  (i32.and (get_local $v) (i32.const 0x08))
  set_global $portBit3LastValue

  ;; Have the tape device process the MIC bit
  (call $processMicBit (get_global $portBit3LastValue))

  ;; Manage bit 4 value
  get_global $portBit4LastValue
  if
    ;; Bit 4 was 1, is it now 0?
    (i32.eq (get_local $bit4) (i32.const 0))
    if
      get_global $tacts set_global $portBit4ChangedFrom1Tacts
      i32.const 0 set_global $portBit4LastValue
    end
  else
    ;; Bit 4 was 0, is it now 1?
    get_local $bit4
    if
      get_global $tacts set_global $portBit4ChangedFrom0Tacts
      i32.const 0x10 set_global $portBit4LastValue
    end
  end
)

;; This function processes the EAR bit (beeper device)
(func $processEarBit (param $earBit i32)
  call $createEarBitSamples
  get_local $earBit set_global $beeperLastEarBit
)

;; Creates EAR bit samples until the current CPU tact
(func $createEarBitSamples
  loop $earBitLoop
    (i32.le_u (get_global $beeperNextSampleTact) (get_global $tacts))
    if
      ;; Store the next sample
      (i32.add (get_global $BEEPER_SAMPLE_BUFFER) (get_global $beeperSampleCount))
      i32.const 1
      i32.const 0
      get_global $beeperLastEarBit
      select
      i32.store8 

      ;; Adjust sample count
      (i32.add (get_global $beeperSampleCount) (i32.const 1))
      set_global $beeperSampleCount

      ;; Calculate the next beeper sample tact
      (i32.add (get_global $beeperGateValue) (get_global $beeperLowerGate))
      set_global $beeperGateValue
      (i32.add (get_global $beeperNextSampleTact) (get_global $beeperSampleLength))
      set_global $beeperNextSampleTact

      (i32.ge_u (get_global $beeperGateValue) (get_global $beeperUpperGate))
      if
        ;; Shift the next sample 
        (i32.add (get_global $beeperNextSampleTact) (i32.const 1))
        set_global $beeperNextSampleTact

        (i32.sub (get_global $beeperGateValue) (get_global $beeperUpperGate))
        set_global $beeperGateValue
      end
      br $earBitLoop
    end
  end
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
                    (i32.add (get_global $TAPE_DATA_BUFFER) (get_global $tapeSaveDataLen))
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

;; Gets the current cursor mode
(func $getCursorMode (result i32)
  ;; Get the value of the MODE ZX Spectrum system variable
  (i32.add (get_global $BANK_0_OFFS) (i32.const 0x5c41))
  i32.load8_u
)
